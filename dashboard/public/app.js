/**
 * Metro Complaint Triage System — Station Controller & Operations UI
 * Demonstrates:
 * - On-device / Offline triage mode with Outbox Sync
 * - P1 Safety Alert prioritization and rules enforcement
 * - Multilingual handling: Gujarati (gu), Hindi (hi), English (en), Gujlish (gu-latn)
 * - Review and draft reply approval workflow
 */

const API_BASE = "http://localhost:8000/v1";

// State
let isOnline = true;
let currentStation = "STN_PALDI";
let currentDept = "";
let currentPriority = "";
let searchQuery = "";
let localComplaints = [];
let localOutbox = []; // Items queued while offline

// Initial seed complaints for offline simulation fallback
const SEED_COMPLAINTS = [
  {
    id: "p1-seed-001",
    station_id: "STN_PALDI",
    channel: "app",
    raw_text: "Platform 2 par track par manas padi gayo chhe urgently madad karo!",
    normalised: "platform 2 par track par manas padi gayo chhe urgently madad karo",
    dept_primary: "safety",
    dept_conf: 0.96,
    urgency: 98,
    priority: "P1",
    safety_hits: [{ id: "SAFE_TRACK_INTRUSION", description: "Person on track" }],
    reply_lang: "gu-latn",
    reply_draft: "Dear Passenger, your report regarding safety at STN_PALDI (Ref: p1-seed) has been immediately dispatched to the station safety controller and emergency response team.",
    reply_status: "draft",
    sync_state: "synced",
    created_at: new Date().toISOString()
  },
  {
    id: "p2-seed-002",
    station_id: "STN_PALDI",
    channel: "social",
    raw_text: "Platform 1 ni lift bandh chhe ane elderly passengers suffer thay chhe",
    normalised: "platform 1 ni lift bandh chhe ane elderly passengers suffer thay chhe",
    dept_primary: "lifts_escalators",
    dept_conf: 0.92,
    urgency: 70,
    priority: "P2",
    safety_hits: [],
    reply_lang: "gu-latn",
    reply_draft: "Dear Passenger, your report regarding lifts_escalators at STN_PALDI (Ref: p2-seed) has been registered. Our maintenance crew has been notified.",
    reply_status: "draft",
    sync_state: "synced",
    created_at: new Date(Date.now() - 5 * 60000).toISOString()
  },
  {
    id: "p3-seed-003",
    station_id: "STN_PALDI",
    channel: "paper",
    raw_text: "વોશરૂમ ખૂબ ગંદો છે અને પાણી નથી આવતું",
    normalised: "વોશરૂમ ખૂબ ગંદો છે અને પાણી નથી આવતું",
    dept_primary: "cleanliness",
    dept_conf: 0.95,
    urgency: 45,
    priority: "P3",
    safety_hits: [],
    reply_lang: "gu",
    reply_draft: "માનનીય મુસાફર, STN_PALDI ખાતે સ્વચ્છતા અંગેની તમારી ફરિયાદ નોંધી લેવામાં આવી છે.",
    reply_status: "draft",
    sync_state: "synced",
    created_at: new Date(Date.now() - 12 * 60000).toISOString()
  },
  {
    id: "p3-seed-004",
    station_id: "STN_PALDI",
    channel: "app",
    raw_text: "टिकट काउंटर पर कर्मचारी बहुत बदतमीजी से बात कर रहा था",
    normalised: "टिकट काउंटर पर कर्मचारी बहुत बदतमीजी से बात कर रहा था",
    dept_primary: "staff_behaviour",
    dept_conf: 0.88,
    urgency: 55,
    priority: "P2",
    safety_hits: [],
    reply_lang: "hi",
    reply_draft: "प्रिय यात्री, STN_PALDI पर कर्मचारी के व्यवहार संबंधी आपकी शिकायत स्टेशन प्रबंधक को भेज दी गई है।",
    reply_status: "draft",
    sync_state: "synced",
    created_at: new Date(Date.now() - 25 * 60000).toISOString()
  }
];

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  loadOutbox();
  loadComplaints();
  setupEventListeners();
  setInterval(() => {
    if (isOnline) loadComplaints();
  }, 10000);
});

function loadOutbox() {
  const saved = localStorage.getItem("cte_outbox");
  if (saved) {
    try { localOutbox = JSON.parse(saved); } catch (e) { localOutbox = []; }
  }
  updateOutboxUI();
}

function saveOutbox() {
  localStorage.setItem("cte_outbox", JSON.stringify(localOutbox));
  updateOutboxUI();
}

function updateOutboxUI() {
  const elCount = document.getElementById("outboxCount");
  const elKpi = document.getElementById("kpiOutbox");
  if (elCount) elCount.textContent = localOutbox.length;
  if (elKpi) elKpi.textContent = localOutbox.length;
}

// Fetch complaints
async function loadComplaints() {
  if (!isOnline) {
    renderComplaints(localComplaints);
    updateKPIs(localComplaints);
    return;
  }

  try {
    const params = new URLSearchParams();
    if (currentStation) params.append("station_id", currentStation);
    if (currentDept) params.append("department", currentDept);
    if (currentPriority) params.append("priority", currentPriority);
    if (searchQuery) params.append("search", searchQuery);

    const res = await fetch(`${API_BASE}/dashboard/queue?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      localComplaints = data.length > 0 ? data : SEED_COMPLAINTS;
      renderComplaints(localComplaints);
      updateKPIs(localComplaints);
      loadAnalyticsData();
      return;
    }
  } catch (err) {
    console.warn("API offline or unreachable, falling back to local storage cache.");
  }

  if (localComplaints.length === 0) {
    localComplaints = [...SEED_COMPLAINTS];
  }
  renderComplaints(localComplaints);
  updateKPIs(localComplaints);
}

// Render cards
function renderComplaints(items) {
  const container = document.getElementById("complaintsList");
  if (!container) return;

  // Filter based on active controls
  let filtered = items.filter(item => {
    if (currentStation && item.station_id !== currentStation) return false;
    if (currentDept && item.dept_primary !== currentDept) return false;
    if (currentPriority && item.priority !== currentPriority) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const txt = (item.raw_text || "").toLowerCase();
      const stn = (item.station_id || "").toLowerCase();
      if (!txt.includes(q) && !stn.includes(q)) return false;
    }
    return true;
  });

  // Sort: P1 first, then urgency desc
  const prioRank = { "P1": 0, "P2": 1, "REVIEW": 2, "P3": 3 };
  filtered.sort((a, b) => {
    const diff = (prioRank[a.priority] || 4) - (prioRank[b.priority] || 4);
    if (diff !== 0) return diff;
    return (b.urgency || 0) - (a.urgency || 0);
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-hint" style="text-align: center; padding: 40px; color: #94a3b8;">
      No complaints in this queue matching current filters.
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const isP1 = item.priority === "P1";
    const gaugeColor = item.urgency >= 80 ? "#ef4444" : item.urgency >= 50 ? "#f59e0b" : "#3b82f6";
    const lang = item.reply_lang || "en";
    const langLabel = lang === "gu" ? "ગુજરાતી" : lang === "hi" ? "हिंदी" : lang === "gu-latn" ? "Gujlish" : "English";
    const langClass = lang === "gu-latn" ? "gl" : lang;

    const safetyBadges = (item.safety_hits || []).map(h => {
      const code = typeof h === "string" ? h : h.id || "SAFETY_RULE";
      return `<span class="safety-tag">🚨 ${code}</span>`;
    }).join(" ");

    return `
      <div class="complaint-card ${isP1 ? 'p1-alert' : ''}" id="card-${item.id}">
        <div class="card-header">
          <div class="card-meta-left">
            <span class="pill pill-${item.priority.toLowerCase()}">${item.priority}</span>
            <span class="station-tag">${item.station_id}</span>
            <span class="channel-tag">Channel: ${item.channel.toUpperCase()}</span>
            <span class="lang-badge ${langClass}">${langLabel}</span>
            ${item.sync_state === 'pending' ? '<span class="badge" style="background:#f59e0b; color:#1e1e1e;">⏳ Local Outbox</span>' : ''}
          </div>
          <div class="urgency-gauge">
            <span>Urgency: ${item.urgency}/100</span>
            <div class="gauge-bar-outer">
              <div class="gauge-bar-inner" style="width: ${item.urgency}%; background: ${gaugeColor};"></div>
            </div>
          </div>
        </div>

        <div class="complaint-text">
          "${escapeHtml(item.raw_text)}"
        </div>

        ${safetyBadges ? `<div class="safety-alert-tags">${safetyBadges}</div>` : ''}

        <div class="draft-reply-box">
          <div class="reply-header">
            <span>AI Draft Reply (${langLabel})</span>
            <span style="color: ${item.reply_status === 'approved' ? '#10b981' : '#94a3b8'}">
              Status: ${item.reply_status.toUpperCase()}
            </span>
          </div>
          <div class="reply-content">
            "${escapeHtml(item.reply_draft || 'Generating draft response...')}"
          </div>
        </div>

        <div class="card-actions">
          <button class="btn btn-sm btn-outline" onclick="openReviewModal('${item.id}')">✏️ Edit / Review</button>
          ${item.reply_status !== 'approved' ? `
            <button class="btn btn-sm btn-primary" onclick="approveReply('${item.id}')">✓ Approve Draft</button>
          ` : `
            <span style="color: #10b981; font-size: 0.82rem; font-weight: 600; padding: 6px;">✓ Dispatched</span>
          `}
        </div>
      </div>
    `;
  }).join("");
}

// Update KPIs & Header Banner
function updateKPIs(items) {
  const p1Items = items.filter(i => i.priority === "P1");
  const elKpiP1 = document.getElementById("kpiP1");
  const elKpiTotal = document.getElementById("kpiTotal");
  const elKpiSLA = document.getElementById("kpiSLA");
  const banner = document.getElementById("safetyAlertBanner");
  const bannerText = document.getElementById("safetyAlertText");

  if (elKpiP1) elKpiP1.textContent = p1Items.length;
  if (elKpiTotal) elKpiTotal.textContent = items.length;

  // SLA breach (P1 draft > 15m)
  const slaBreaches = p1Items.filter(i => {
    const ageMin = (Date.now() - new Date(i.created_at).getTime()) / 60000;
    return ageMin > 15 && i.reply_status === "draft";
  });
  if (elKpiSLA) elKpiSLA.textContent = slaBreaches.length;

  // Safety banner
  if (p1Items.length > 0 && !banner.dataset.dismissed) {
    banner.classList.remove("hidden");
    const topP1 = p1Items[0];
    bannerText.textContent = `[${topP1.station_id}] "${topP1.raw_text.substring(0, 60)}..."`;
  } else {
    banner.classList.add("hidden");
  }

  // Update department badges
  const depts = ["safety", "cleanliness", "lifts_escalators", "fare", "staff_behaviour", "other"];
  const bAll = document.getElementById("bAll");
  if (bAll) bAll.textContent = items.length;

  depts.forEach(d => {
    const count = items.filter(i => i.dept_primary === d).length;
    const badge = document.querySelector(`.filter-tab[data-dept="${d}"] .badge`);
    if (badge) badge.textContent = count;
  });
}

// Action: Approve Reply
async function approveReply(id) {
  const complaint = localComplaints.find(c => c.id === id);
  if (!complaint) return;

  complaint.reply_status = "approved";

  if (isOnline) {
    try {
      await fetch(`${API_BASE}/complaints/${id}/approve`, { method: "POST" });
    } catch (e) {
      console.warn("Online call failed, queuing to local outbox");
      queueOutbox("APPROVE_REPLY", { complaint_id: id });
    }
  } else {
    complaint.sync_state = "pending";
    queueOutbox("APPROVE_REPLY", { complaint_id: id });
  }

  renderComplaints(localComplaints);
}

// Action: Open Review Modal
function openReviewModal(id) {
  const complaint = localComplaints.find(c => c.id === id);
  if (!complaint) return;

  document.getElementById("replyComplaintId").value = id;
  document.getElementById("replyTextarea").value = complaint.reply_draft || "";
  document.getElementById("replyModal").classList.remove("hidden");
}

function queueOutbox(opType, payload) {
  const item = {
    client_uuid: "station_controller_paldi",
    idempotency_key: `idemp_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    op_type: opType,
    payload: payload,
    created_at: new Date().toISOString()
  };
  localOutbox.push(item);
  saveOutbox();
}

// Synchronize Outbox to Server
async function syncOutboxNow() {
  if (localOutbox.length === 0) {
    alert("Outbox is already empty. All local actions are synced.");
    return;
  }

  const btn = document.getElementById("syncNowBtn");
  btn.textContent = "Syncing...";
  btn.disabled = true;

  try {
    const payload = {
      client_uuid: "station_controller_paldi",
      items: localOutbox
    };

    const res = await fetch(`${API_BASE}/sync/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      alert(`Sync Successful! ${data.synced_count} items merged into operational database.`);
      localOutbox = [];
      saveOutbox();
      await loadComplaints();
    } else {
      alert("Sync failed: Server returned error.");
    }
  } catch (err) {
    alert(`Sync Failed: Cannot reach server (${err.message}). Verify backend is running.`);
  } finally {
    btn.innerHTML = `🔄 Sync Outbox (<span id="outboxCount">${localOutbox.length}</span>)`;
    btn.disabled = false;
  }
}

// Setup UI Event Listeners
function setupEventListeners() {
  // Station filter
  document.getElementById("stationSelect").addEventListener("change", (e) => {
    currentStation = e.target.value;
    loadComplaints();
  });

  // Toggle Network Online/Offline
  document.getElementById("toggleNetBtn").addEventListener("click", () => {
    isOnline = !isOnline;
    const dot = document.getElementById("netDot");
    const label = document.getElementById("netLabel");
    const btn = document.getElementById("toggleNetBtn");

    if (isOnline) {
      dot.className = "status-indicator online";
      label.textContent = "Online";
      btn.textContent = "Go Offline";
      loadComplaints();
    } else {
      dot.className = "status-indicator offline";
      label.textContent = "Offline (Platform Mode)";
      btn.textContent = "Go Online";
    }
  });

  // Sync button
  document.getElementById("syncNowBtn").addEventListener("click", syncOutboxNow);

  // Department tabs
  document.querySelectorAll(".filter-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".filter-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentDept = tab.dataset.dept || "";
      renderComplaints(localComplaints);
    });
  });

  // Priority pills
  document.querySelectorAll(".p-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".p-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      currentPriority = pill.dataset.prio || "";
      renderComplaints(localComplaints);
    });
  });

  // Search input
  document.getElementById("searchInput").addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderComplaints(localComplaints);
  });

  // Dismiss safety banner
  document.getElementById("dismissBannerBtn").addEventListener("click", () => {
    const banner = document.getElementById("safetyAlertBanner");
    banner.classList.add("hidden");
    banner.dataset.dismissed = "true";
  });

  // Modal open/close
  document.getElementById("newComplaintBtn").addEventListener("click", () => {
    document.getElementById("ingestModal").classList.remove("hidden");
  });
  document.getElementById("closeModalBtn").addEventListener("click", () => {
    document.getElementById("ingestModal").classList.add("hidden");
  });
  document.getElementById("cancelModalBtn").addEventListener("click", () => {
    document.getElementById("ingestModal").classList.add("hidden");
  });

  // Sample chips in modal
  document.querySelectorAll(".sample-chips .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.getElementById("modalRawText").value = chip.dataset.text;
    });
  });

  // Submit new complaint
  document.getElementById("submitTriageBtn").addEventListener("click", async () => {
    const rawText = document.getElementById("modalRawText").value.trim();
    const stationId = document.getElementById("modalStation").value;
    const channel = document.getElementById("modalChannel").value;

    if (!rawText) {
      alert("Please enter complaint text.");
      return;
    }

    const payload = { station_id: stationId, channel: channel, raw_text: rawText };

    if (isOnline) {
      try {
        const res = await fetch(`${API_BASE}/complaints`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          document.getElementById("ingestModal").classList.add("hidden");
          document.getElementById("modalRawText").value = "";
          await loadComplaints();
          return;
        }
      } catch (e) {
        console.warn("Online POST failed, falling back to on-device offline queue.");
      }
    }

    // Offline simulation triage
    const newId = `off-${Date.now()}`;
    const isSafety = /track|fire|aag|smoke|dhua|gas|leak|jump|padi/i.test(rawText);
    const mockComplaint = {
      id: newId,
      station_id: stationId,
      channel: channel,
      raw_text: rawText,
      normalised: rawText.toLowerCase(),
      dept_primary: isSafety ? "safety" : "other",
      dept_conf: isSafety ? 0.98 : 0.60,
      urgency: isSafety ? 95 : 50,
      priority: isSafety ? "P1" : "P3",
      safety_hits: isSafety ? [{ id: "SAFE_DETECTED_OFFLINE" }] : [],
      reply_lang: /[\u0A80-\u0AFF]/.test(rawText) ? "gu" : /[\u0900-\u097F]/.test(rawText) ? "hi" : "en",
      reply_draft: `Dear Passenger, your report at ${stationId} has been registered by the station controller.`,
      reply_status: "draft",
      sync_state: "pending",
      created_at: new Date().toISOString()
    };

    localComplaints.unshift(mockComplaint);
    queueOutbox("CREATE_COMPLAINT", mockComplaint);

    document.getElementById("ingestModal").classList.add("hidden");
    document.getElementById("modalRawText").value = "";
    renderComplaints(localComplaints);
    updateKPIs(localComplaints);
  });

  // Reply modal actions
  document.getElementById("closeReplyModalBtn").addEventListener("click", () => {
    document.getElementById("replyModal").classList.add("hidden");
  });
  document.getElementById("cancelReplyBtn").addEventListener("click", () => {
    document.getElementById("replyModal").classList.add("hidden");
  });

  document.getElementById("approveReplyBtn").addEventListener("click", async () => {
    const id = document.getElementById("replyComplaintId").value;
    const text = document.getElementById("replyTextarea").value;
    const c = localComplaints.find(i => i.id === id);
    if (c) {
      c.reply_draft = text;
      c.reply_status = "approved";
    }

    if (isOnline) {
      try {
        await fetch(`${API_BASE}/complaints/${id}/approve?custom_text=${encodeURIComponent(text)}`, { method: "POST" });
      } catch (e) {
        queueOutbox("APPROVE_REPLY", { complaint_id: id, custom_reply: text });
      }
    } else {
      c.sync_state = "pending";
      queueOutbox("APPROVE_REPLY", { complaint_id: id, custom_reply: text });
    }

    document.getElementById("replyModal").classList.add("hidden");
    renderComplaints(localComplaints);
  });

  // Switch between queue view and analytics view
  const qBtn = document.getElementById("viewQueueBtn");
  const aBtn = document.getElementById("viewAnalyticsBtn");
  const qSec = document.getElementById("queueSection");
  const aSec = document.getElementById("analyticsSection");

  qBtn.addEventListener("click", () => {
    qBtn.classList.add("active");
    aBtn.classList.remove("active");
    qSec.classList.remove("hidden");
    aSec.classList.add("hidden");
  });

  aBtn.addEventListener("click", () => {
    aBtn.classList.add("active");
    qBtn.classList.remove("active");
    qSec.classList.add("hidden");
    aSec.classList.remove("hidden");
    loadAnalyticsData();
  });
}

// Load Analytics and Hotspots
async function loadAnalyticsData() {
  if (!isOnline) return;

  try {
    const [statsRes, hotRes, revRes] = await Promise.all([
      fetch(`${API_BASE}/dashboard/stats`),
      fetch(`${API_BASE}/dashboard/hotspots`),
      fetch(`${API_BASE}/dashboard/reviews`)
    ]);

    if (statsRes.ok) {
      const stats = await statsRes.json();
      renderBarChart("deptBarChart", stats.dept_distribution);
      renderBarChart("langBarChart", stats.language_distribution);
    }

    if (hotRes.ok) {
      const hotspots = await hotRes.json();
      const cont = document.getElementById("hotspotsList");
      if (cont && hotspots.length > 0) {
        cont.innerHTML = hotspots.map(h => `
          <div class="hotspot-row">
            <span>📍 ${h.station_id}</span>
            <span style="font-weight:700; color:#38bdf8;">${h.count} reports</span>
          </div>
        `).join("");
      }
    }

    if (revRes.ok) {
      const reviews = await revRes.json();
      const tbody = document.getElementById("auditTableBody");
      if (tbody && reviews.length > 0) {
        tbody.innerHTML = reviews.map(r => `
          <tr>
            <td>${r.at ? new Date(r.at).toLocaleTimeString() : 'N/A'}</td>
            <td><code>${r.complaint_id.substring(0, 8)}</code></td>
            <td>${escapeHtml(r.actor)}</td>
            <td><strong>${escapeHtml(r.field)}</strong></td>
            <td>${escapeHtml(r.old_value || '-')}</td>
            <td style="color:#10b981;">${escapeHtml(r.new_value)}</td>
          </tr>
        `).join("");
      }
    }
  } catch (e) {
    console.warn("Analytics fetch failed:", e);
  }
}

function renderBarChart(containerId, dataMap) {
  const container = document.getElementById(containerId);
  if (!container || !dataMap) return;

  const entries = Object.entries(dataMap);
  const max = Math.max(...entries.map(([_, v]) => v), 1);

  container.innerHTML = entries.map(([k, v]) => {
    const pct = Math.round((v / max) * 100);
    return `
      <div class="chart-row">
        <div class="chart-label">${k}</div>
        <div class="chart-bar-bg">
          <div class="chart-bar-fill" style="width: ${pct}%;"></div>
        </div>
        <div class="chart-val">${v}</div>
      </div>
    `;
  }).join("");
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
