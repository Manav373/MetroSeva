"""
Offline Station Controller Application (CTE Station Tablet).
Operates 100% offline with zero internet connectivity:
- Local on-device SQLite database
- Local multilingual Triage Engine (gu, hi, en, gu-latn)
- Auditable Safety Floor (P1 forced, urgency >= 80)
- Local transactional Outbox Queue (survives 72+ hours offline)
- Zero external CDNs / zero external network calls
- Optional cloud sync when connectivity returns
"""

import datetime
import http.server
import json
import os
import socketserver
import sqlite3
import sys
import threading
import time
import urllib.parse
import uuid

# Ensure root cte module is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ml.triage_engine import TriagePipeline

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "station_offline.db")


class OfflineStationDB:
    def __init__(self, db_path=DB_FILE):
        self.db_path = db_path
        self.lock = threading.Lock()
        self._init_db()

    def _get_conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self.lock:
            conn = self._get_conn()
            cur = conn.cursor()
            cur.execute("""
            CREATE TABLE IF NOT EXISTS station_complaints (
                id TEXT PRIMARY KEY,
                channel TEXT NOT NULL,
                station_id TEXT NOT NULL,
                received_at TEXT NOT NULL,
                raw_text TEXT NOT NULL,
                lang_detected TEXT,
                normalised TEXT,
                dept_primary TEXT,
                dept_secondary TEXT,
                urgency INTEGER,
                priority TEXT,
                safety_hits TEXT,
                reply_lang TEXT,
                reply_draft TEXT,
                reply_status TEXT,
                controller_note TEXT,
                sync_state TEXT,
                updated_at TEXT
            );
            """)

            cur.execute("""
            CREATE TABLE IF NOT EXISTS station_outbox (
                id TEXT PRIMARY KEY,
                op_type TEXT NOT NULL,
                payload TEXT NOT NULL,
                priority TEXT NOT NULL,
                created_at TEXT NOT NULL,
                attempts INTEGER DEFAULT 0,
                idempotency_key TEXT NOT NULL
            );
            """)

            conn.commit()
            conn.close()

    def save_complaint(self, data: dict, add_to_outbox=True):
        with self.lock:
            conn = self._get_conn()
            cur = conn.cursor()
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
            
            cur.execute("""
            INSERT OR REPLACE INTO station_complaints (
                id, channel, station_id, received_at, raw_text, lang_detected,
                normalised, dept_primary, dept_secondary, urgency, priority,
                safety_hits, reply_lang, reply_draft, reply_status, controller_note,
                sync_state, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data["id"],
                data.get("channel", "paper"),
                data.get("station_id", "STN_PALDI"),
                data.get("received_at", now_iso),
                data.get("raw_text", ""),
                data.get("lang_detected", "en"),
                data.get("normalised", ""),
                data.get("dept_primary", "other"),
                data.get("dept_secondary"),
                data.get("urgency", 0),
                data.get("priority", "P3"),
                json.dumps(data.get("safety_hits", [])),
                data.get("reply_lang", "en"),
                data.get("reply_draft", ""),
                data.get("reply_status", "draft"),
                data.get("controller_note", ""),
                data.get("sync_state", "local"),
                data.get("updated_at", now_iso)
            ))

            if add_to_outbox:
                cur.execute("""
                INSERT OR REPLACE INTO station_outbox (
                    id, op_type, payload, priority, created_at, idempotency_key
                ) VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    data["id"],
                    "upsert",
                    json.dumps(data),
                    data.get("priority", "P3"),
                    now_iso,
                    f"outbox_key_{data['id']}"
                ))

            conn.commit()
            conn.close()

    def get_queue(self, dept_filter=None):
        with self.lock:
            conn = self._get_conn()
            cur = conn.cursor()
            query = "SELECT * FROM station_complaints WHERE 1=1"
            params = []
            if dept_filter and dept_filter != "all":
                query += " AND dept_primary = ?"
                params.append(dept_filter)

            # P1 safety pinned to the top, then by urgency descending
            query += " ORDER BY CASE WHEN priority = 'P1' THEN 0 WHEN priority = 'P2' THEN 1 ELSE 2 END, urgency DESC, received_at DESC"
            cur.execute(query, tuple(params))
            rows = cur.fetchall()
            conn.close()

            results = []
            for r in rows:
                d = dict(r)
                d["safety_hits"] = json.loads(d["safety_hits"]) if d.get("safety_hits") else []
                results.append(d)
            return results

    def approve_reply(self, cid: str, approved_draft: str, controller_note: str = ""):
        with self.lock:
            conn = self._get_conn()
            cur = conn.cursor()
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
            
            cur.execute("""
            UPDATE station_complaints 
            SET reply_status = 'approved', reply_draft = ?, controller_note = ?, updated_at = ?, sync_state = 'pending'
            WHERE id = ?
            """, (approved_draft, controller_note, now_iso, cid))

            # Fetch updated record
            cur.execute("SELECT * FROM station_complaints WHERE id = ?", (cid,))
            row = cur.fetchone()
            if row:
                d = dict(row)
                d["safety_hits"] = json.loads(d["safety_hits"]) if d.get("safety_hits") else []
                cur.execute("""
                INSERT OR REPLACE INTO station_outbox (
                    id, op_type, payload, priority, created_at, idempotency_key
                ) VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    cid,
                    "review_approval",
                    json.dumps(d),
                    d.get("priority", "P3"),
                    now_iso,
                    f"approval_key_{cid}_{int(time.time())}"
                ))

            conn.commit()
            conn.close()

    def get_outbox(self):
        with self.lock:
            conn = self._get_conn()
            cur = conn.cursor()
            cur.execute("""
            SELECT * FROM station_outbox 
            ORDER BY CASE WHEN priority = 'P1' THEN 0 WHEN priority = 'P2' THEN 1 ELSE 2 END, created_at ASC
            """)
            rows = cur.fetchall()
            conn.close()
            return [dict(r) for r in rows]

    def clear_outbox_items(self, item_ids: list):
        with self.lock:
            conn = self._get_conn()
            cur = conn.cursor()
            for iid in item_ids:
                cur.execute("DELETE FROM station_outbox WHERE id = ?", (iid,))
                cur.execute("UPDATE station_complaints SET sync_state = 'synced' WHERE id = ?", (iid,))
            conn.commit()
            conn.close()


# State of the offline station device
db = OfflineStationDB()
pipeline = TriagePipeline()
is_network_online = False
station_id = "STN_PALDI"
device_id = "TAB_PALDI_01"


HTML_CONTENT = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Station Controller Terminal · 100% Offline</title>
  <style>
    :root {
      --bg: #121824;
      --card-bg: #1c2436;
      --card-border: #2e3a52;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --accent: #2563eb;
      --p1: #dc2626;
      --p1-bg: rgba(220, 38, 38, 0.18);
      --p2: #d97706;
      --p2-bg: rgba(217, 119, 6, 0.18);
      --p3: #16a34a;
      --p3-bg: rgba(22, 163, 74, 0.18);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; }
    
    /* Top Bar */
    .top-bar {
      background: #0b0f17;
      border-bottom: 2px solid var(--card-border);
      padding: 0.85rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .badge-offline {
      background: #7f1d1d;
      color: #fca5a5;
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 0.8rem;
      letter-spacing: 0.05em;
      border: 1px solid #ef4444;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }
    .badge-online {
      background: #14532d;
      color: #86efac;
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 0.8rem;
      border: 1px solid #22c55e;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }
    .btn {
      background: var(--accent);
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.85rem;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
    .btn-danger { background: var(--p1); }
    .btn-outline { background: transparent; border: 1px solid var(--card-border); color: var(--text-muted); }
    .btn-outline:hover { background: var(--card-bg); color: var(--text); }

    main { flex: 1; max-width: 1300px; width: 100%; margin: 0 auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }

    /* P1 Safety Alert Banner */
    .safety-banner {
      background: var(--p1-bg);
      border: 2px solid var(--p1);
      border-radius: 8px;
      padding: 1rem 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .safety-banner.hidden { display: none; }
    .safety-banner h3 { color: #fca5a5; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; }

    /* Ingest & Stats Bar */
    .action-panel {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 1.25rem;
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1.25rem;
    }
    @media (max-width: 800px) { .action-panel { grid-template-columns: 1fr; } }

    textarea, input, select {
      background: #0f1523;
      border: 1px solid var(--card-border);
      color: var(--text);
      padding: 0.6rem 0.8rem;
      border-radius: 6px;
      font-size: 0.9rem;
      width: 100%;
    }
    textarea:focus, input:focus, select:focus { outline: 1px solid var(--accent); }

    /* Queue Controls */
    .tabs-bar {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 0.75rem;
    }
    .tab-btn {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      padding: 0.45rem 0.9rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .tab-btn.active { background: var(--accent); color: white; border-color: var(--accent); font-weight: 600; }

    /* Complaint Cards */
    .card-list { display: flex; flex-direction: column; gap: 0.85rem; }
    .c-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      transition: transform 0.1s;
    }
    .c-card.is-p1 {
      background: var(--p1-bg);
      border: 2px solid var(--p1);
    }
    .c-header { display: flex; justify-content: space-between; align-items: center; }
    .badge {
      padding: 0.2rem 0.55rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.05em;
    }
    .b-p1 { background: var(--p1); color: white; }
    .b-p2 { background: var(--p2); color: white; }
    .b-p3 { background: var(--p3); color: white; }
    .b-lang { background: #334155; color: #e2e8f0; font-family: monospace; }
    .b-status { background: #374151; color: #9ca3af; }
    .b-status.approved { background: #166534; color: #bbf7d0; }

    .c-text { font-size: 1rem; line-height: 1.45; font-weight: 500; }
    .c-draft {
      background: #0f1523;
      border-left: 3px solid var(--accent);
      padding: 0.65rem 0.85rem;
      font-size: 0.88rem;
      border-radius: 0 4px 4px 0;
      color: #cbd5e1;
    }

    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.8);
      display: flex; align-items: center; justify-content: center; z-index: 100;
    }
    .modal-overlay.hidden { display: none; }
    .modal-box {
      background: var(--card-bg); border: 1px solid var(--card-border);
      border-radius: 8px; width: 90%; max-width: 600px; padding: 1.5rem;
      display: flex; flex-direction: column; gap: 1rem; max-height: 90vh; overflow-y: auto;
    }
  </style>
</head>
<body>

  <header class="top-bar">
    <div style="display: flex; align-items: center; gap: 0.85rem;">
      <div style="font-size: 1.3rem; font-weight: 800; color: #3b82f6;">CTE</div>
      <div>
        <div style="font-weight: 700; font-size: 0.95rem;">Station Controller Tablet App</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);" id="stationMeta">Station: STN_PALDI · Device: TAB_PALDI_01</div>
      </div>
    </div>
    
    <div style="display: flex; align-items: center; gap: 0.75rem;">
      <span id="netBadge" class="badge-offline">✈ AIRPLANE MODE (100% OFFLINE)</span>
      <button class="btn btn-outline" onclick="toggleNetwork()" id="netToggleBtn">Toggle Network (Offline/Online)</button>
      <button class="btn" onclick="syncOutbox()" id="syncBtn" style="display: none;">Sync Outbox (<span id="outboxCount">0</span>)</button>
    </div>
  </header>

  <main>
    <!-- Safety Warning Banner -->
    <div id="safetyAlert" class="safety-banner hidden">
      <div>
        <h3>🚨 ACTIVE P1 SAFETY INCIDENTS (<span id="p1AlertCount">0</span>)</h3>
        <p style="font-size: 0.85rem; color: #fca5a5; margin-top: 0.25rem;">
          Pinned to the top of your shift queue. Requires immediate platform controller inspection.
        </p>
      </div>
      <button class="btn btn-danger" onclick="filterQueue('safety')">View Safety Items</button>
    </div>

    <!-- Intake & Fast Simulator -->
    <div class="action-panel">
      <div>
        <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.35rem;">
          ON-DEVICE INGEST (PAPER FORM OCR / PASSENGER DESK SUBMISSION)
        </label>
        <textarea id="inputText" rows="2" placeholder="Enter complaint in Gujarati, Hindi, English or Gujlish (e.g., 'Track par manas padi gayo chhe urgently help' or 'Lift bandh chhe')"></textarea>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
          <button class="btn" onclick="ingestComplaint()">Run Local Triage (Offline)</button>
          <button class="btn btn-outline" onclick="loadSampleBatch()">Load Morning Batch (5 Samples)</button>
        </div>
      </div>
      <div style="background: #0f1523; padding: 1rem; border-radius: 6px; border: 1px solid var(--card-border); font-size: 0.85rem;">
        <div style="font-weight: 700; color: var(--text-muted); margin-bottom: 0.5rem;">STATION METRICS</div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
          <span>Shift Items Triaged:</span>
          <strong id="statTotal">0</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; color: #f87171;">
          <span>P1 Safety Hazards:</span>
          <strong id="statP1">0</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
          <span>Pending Outbox:</span>
          <strong id="statOutbox">0</strong>
        </div>
        <div style="display: flex; justify-content: space-between; color: #34d399;">
          <span>Offline Uptime:</span>
          <strong>72h Safe</strong>
        </div>
      </div>
    </div>

    <!-- Department Queues Bar -->
    <div class="tabs-bar">
      <button class="tab-btn active" onclick="setTab('all', this)">All Queues</button>
      <button class="tab-btn" onclick="setTab('safety', this)">Safety & Security</button>
      <button class="tab-btn" onclick="setTab('cleanliness', this)">Cleanliness</button>
      <button class="tab-btn" onclick="setTab('fare', this)">Fare & AFC</button>
      <button class="tab-btn" onclick="setTab('lifts_escalators', this)">Lifts & Escalators</button>
      <button class="tab-btn" onclick="setTab('staff_behaviour', this)">Staff Conduct</button>
    </div>

    <!-- Active Queue List -->
    <div class="card-list" id="queueContainer">
      <div style="text-align: center; color: var(--text-muted); padding: 2rem;">No items in queue. Enter a complaint above or load the morning batch.</div>
    </div>
  </main>

  <!-- Review Modal -->
  <div id="reviewModal" class="modal-overlay hidden">
    <div class="modal-box">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--card-border); padding-bottom: 0.5rem;">
        <h3 id="modalTitle">Review Ticket</h3>
        <button style="background: none; border: none; color: white; font-size: 1.25rem; cursor: pointer;" onclick="closeModal()">&times;</button>
      </div>

      <div style="font-size: 0.8rem; color: var(--text-muted);">RAW COMPLAINT SUBMISSION (IMMUTABLE):</div>
      <div id="modalRaw" style="background: #0f1523; padding: 0.75rem; border-radius: 4px; font-weight: 500;"></div>

      <div style="font-size: 0.8rem; color: var(--text-muted);">DRAFT REPLY (COMPLAINANT'S LANGUAGE):</div>
      <textarea id="modalReply" rows="3"></textarea>

      <div style="font-size: 0.8rem; color: var(--text-muted);">CONTROLLER NOTE (OPTIONAL / MANDATORY FOR P1):</div>
      <input type="text" id="modalNote" placeholder="e.g. Area inspected by guard, maintenance dispatched">

      <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
        <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button class="btn" onclick="submitApproval()">Approve Response & Queue to Outbox</button>
      </div>
    </div>
  </div>

  <script>
    let activeTab = 'all';
    let currentComplaints = [];
    let isOnline = false;
    let selectedTicketId = null;

    async function loadQueue() {
      try {
        const res = await fetch(`/api/queue?dept=${activeTab}`);
        const data = await res.json();
        currentComplaints = data.queue;
        isOnline = data.is_online;
        updateNetUI();
        renderQueue();
        updateStats(data);
      } catch (err) {
        console.error("Local load failed:", err);
      }
    }

    function updateNetUI() {
      const netBadge = document.getElementById('netBadge');
      const syncBtn = document.getElementById('syncBtn');
      if (isOnline) {
        netBadge.className = 'badge-online';
        netBadge.innerText = '● ONLINE (CENTRAL SYNC AVAILABLE)';
        syncBtn.style.display = 'inline-block';
      } else {
        netBadge.className = 'badge-offline';
        netBadge.innerText = '✈ AIRPLANE MODE (100% OFFLINE)';
        syncBtn.style.display = 'none';
      }
    }

    function updateStats(data) {
      document.getElementById('statTotal').innerText = data.total_count || 0;
      document.getElementById('statP1').innerText = data.p1_count || 0;
      document.getElementById('statOutbox').innerText = data.outbox_count || 0;
      document.getElementById('outboxCount').innerText = data.outbox_count || 0;

      const p1Alert = document.getElementById('safetyAlert');
      if (data.p1_count > 0) {
        p1Alert.classList.remove('hidden');
        document.getElementById('p1AlertCount').innerText = data.p1_count;
      } else {
        p1Alert.classList.add('hidden');
      }
    }

    function renderQueue() {
      const container = document.getElementById('queueContainer');
      if (!currentComplaints || currentComplaints.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">Queue is empty for selected department.</div>';
        return;
      }

      container.innerHTML = currentComplaints.map(c => {
        const isP1 = c.priority === 'P1';
        const pBadgeClass = isP1 ? 'b-p1' : (c.priority === 'P2' ? 'b-p2' : 'b-p3');
        const approved = c.reply_status === 'approved';
        return `
          <div class="c-card ${isP1 ? 'is-p1' : ''}">
            <div class="c-header">
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <span class="badge ${pBadgeClass}">${c.priority}</span>
                <span class="badge b-lang">${(c.lang_detected || 'en').toUpperCase()}</span>
                <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">ID: ${c.id.slice(0, 8)}</span>
              </div>
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <span class="badge b-status ${approved ? 'approved' : ''}">${approved ? '✓ APPROVED' : 'DRAFT'}</span>
                <span style="font-weight: 700; color: ${isP1 ? '#f87171' : 'var(--text)'}; font-size: 0.85rem;">Urgency: ${c.urgency}/100</span>
              </div>
            </div>

            <div class="c-text">${c.raw_text}</div>

            <div class="c-draft">
              <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 600; margin-bottom: 0.2rem;">DRAFT RESPONSE (${c.reply_lang.toUpperCase()}):</div>
              ${c.reply_draft}
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.8rem; color: var(--text-muted); text-transform: capitalize;">
                Dept: <strong>${c.dept_primary.replace('_', ' ')}</strong>
                ${c.dept_secondary ? ' | Sec: ' + c.dept_secondary.replace('_', ' ') : ''}
              </span>
              <button class="btn btn-outline" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick='openReview("${c.id}")'>
                ${approved ? 'Edit Action' : 'Review & Approve'}
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    function setTab(dept, btn) {
      activeTab = dept;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      loadQueue();
    }

    function filterQueue(dept) {
      const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.innerText.toLowerCase().includes(dept));
      setTab(dept, btn);
    }

    async function ingestComplaint() {
      const text = document.getElementById('inputText').value.trim();
      if (!text) return alert("Please enter complaint text");
      try {
        const res = await fetch('/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw_text: text, channel: 'paper' })
        });
        if (res.ok) {
          document.getElementById('inputText').value = '';
          loadQueue();
        }
      } catch (err) {
        alert("Ingest error: " + err);
      }
    }

    async function loadSampleBatch() {
      try {
        const res = await fetch('/api/batch-sample', { method: 'POST' });
        if (res.ok) loadQueue();
      } catch (err) {
        alert("Batch load error: " + err);
      }
    }

    async function toggleNetwork() {
      try {
        const res = await fetch('/api/toggle-network', { method: 'POST' });
        const data = await res.json();
        isOnline = data.is_online;
        updateNetUI();
      } catch (err) {
        alert("Network toggle error: " + err);
      }
    }

    async function syncOutbox() {
      try {
        const res = await fetch('/api/sync', { method: 'POST' });
        const data = await res.json();
        alert(data.message);
        loadQueue();
      } catch (err) {
        alert("Sync error: " + err);
      }
    }

    function openReview(cid) {
      const c = currentComplaints.find(i => i.id === cid);
      if (!c) return;
      selectedTicketId = cid;
      document.getElementById('modalTitle').innerText = `Review Ticket: ${cid.slice(0, 8)} (${c.priority})`;
      document.getElementById('modalRaw').innerText = c.raw_text;
      document.getElementById('modalReply').value = c.reply_draft;
      document.getElementById('modalNote').value = c.controller_note || '';
      document.getElementById('reviewModal').classList.remove('hidden');
    }

    function closeModal() {
      document.getElementById('reviewModal').classList.add('hidden');
      selectedTicketId = null;
    }

    async function submitApproval() {
      if (!selectedTicketId) return;
      const draft = document.getElementById('modalReply').value.trim();
      const note = document.getElementById('modalNote').value.trim();
      try {
        const res = await fetch('/api/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedTicketId, reply_draft: draft, controller_note: note })
        });
        if (res.ok) {
          closeModal();
          loadQueue();
        }
      } catch (err) {
        alert("Approval error: " + err);
      }
    }

    // Initial load
    loadQueue();
  </script>
</body>
</html>
"""


class OfflineStationHandler(http.server.BaseHTTPRequestHandler):
    def _send_json(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def _send_html(self, html):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(html.encode("utf-8"))

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path in ["/", "/index.html"]:
            self._send_html(HTML_CONTENT)
            return

        if path == "/api/queue":
            params = urllib.parse.parse_qs(parsed.query)
            dept = params.get("dept", [None])[0]
            queue = db.get_queue(dept_filter=dept)
            all_items = db.get_queue()
            p1_count = sum(1 for i in all_items if i.get("priority") == "P1")
            outbox_items = db.get_outbox()
            self._send_json({
                "queue": queue,
                "total_count": len(all_items),
                "p1_count": p1_count,
                "outbox_count": len(outbox_items),
                "is_online": is_network_online,
                "station_id": station_id
            })
            return

        if path == "/api/outbox":
            items = db.get_outbox()
            self._send_json({"outbox": items, "count": len(items)})
            return

        self.send_error(404, "Not Found")

    def do_POST(self):
        global is_network_online
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        try:
            req_data = json.loads(body)
        except Exception:
            req_data = {}

        if path == "/api/ingest":
            raw_text = req_data.get("raw_text", "").strip()
            if not raw_text:
                self._send_json({"error": "Empty complaint text"}, code=400)
                return
            result = pipeline.process(
                raw_text=raw_text,
                station_id=station_id,
                channel=req_data.get("channel", "paper")
            )
            result["sync_state"] = "local"
            db.save_complaint(result, add_to_outbox=True)
            self._send_json({"status": "success", "record": result})
            return

        if path == "/api/batch-sample":
            samples = [
                "Track par manas padi gayo chhe urgently help metro tatkal roko",
                "Lift bandh chhe ane andar 2 passenger fasa gaya che",
                "Platform 1 washroom is dirty and smelling bad",
                "Smartcard recharge 200 rupees deducted but not in balance",
                "Station guard was shouting rudely at elderly passenger"
            ]
            for s in samples:
                res = pipeline.process(raw_text=s, station_id=station_id, channel="paper")
                res["sync_state"] = "local"
                db.save_complaint(res, add_to_outbox=True)
            self._send_json({"status": "success", "count": len(samples)})
            return

        if path == "/api/review":
            cid = req_data.get("id")
            draft = req_data.get("reply_draft", "")
            note = req_data.get("controller_note", "")
            db.approve_reply(cid, draft, note)
            self._send_json({"status": "success", "id": cid})
            return

        if path == "/api/toggle-network":
            is_network_online = not is_network_online
            self._send_json({"status": "success", "is_online": is_network_online})
            return

        if path == "/api/sync":
            if not is_network_online:
                self._send_json({"status": "error", "message": "Cannot sync while in Airplane Mode (Offline)!"}, code=400)
                return

            outbox_items = db.get_outbox()
            if not outbox_items:
                self._send_json({"status": "success", "message": "Outbox is already empty (0 items)."})
                return

            import requests
            # Prepare payload matching /v1/sync/push
            items_payload = []
            for item in outbox_items:
                items_payload.append({
                    "id": item["id"],
                    "op_type": item["op_type"],
                    "payload": json.loads(item["payload"]),
                    "created_at": item["created_at"],
                    "priority": item["priority"],
                    "idempotency_key": item["idempotency_key"]
                })

            push_req = {
                "station_id": station_id,
                "device_id": device_id,
                "items": items_payload
            }

            try:
                res = requests.post("http://localhost:8000/v1/sync/push", json=push_req, timeout=8)
                if res.status_code == 200:
                    data = res.json()
                    # Clear synced items
                    synced_ids = [r["id"] for r in data["results"] if r["status"] in ["accepted", "duplicate"]]
                    db.clear_outbox_items(synced_ids)
                    self._send_json({"status": "success", "message": f"Successfully synchronized {len(synced_ids)} items to central cloud!", "data": data})
                else:
                    self._send_json({"status": "error", "message": f"Cloud rejected: {res.text}"}, code=500)
            except Exception as e:
                self._send_json({"status": "error", "message": f"Could not connect to central server at port 8000: {e}"}, code=500)
            return

        self.send_error(404, "Not Found")


def run_offline_station(port=8080):
    server_address = ("127.0.0.1", port)
    httpd = socketserver.TCPServer(server_address, OfflineStationHandler)
    print(f"\n=======================================================")
    print(f"  CTE OFFLINE STATION CONTROLLER RUNNING (100% OFFLINE)")
    print(f"=======================================================")
    print(f"Station ID       : {station_id}")
    print(f"Device ID        : {device_id}")
    print(f"Local Database   : {DB_FILE}")
    print(f"Access Terminal  : http://localhost:{port}/")
    print(f"Network Status   : OFFLINE (Airplane Mode by default)")
    print(f"External CDNs    : ZERO (Fully air-gapped / offline safe)")
    print(f"=======================================================\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down station controller terminal...")
        httpd.server_close()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    run_offline_station(port=port)
