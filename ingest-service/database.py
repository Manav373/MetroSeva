"""
Database persistence layer for Ingest Service.
Implements SQLite storage matching Section 5.3 data models with thread-safety.
"""

import json
import os
import sqlite3
import threading
from typing import Dict, List, Optional, Any, Tuple


class Database:
    def __init__(self, db_path: str = None):
        if db_path is None:
            curr_dir = os.path.dirname(os.path.abspath(__file__))
            db_path = os.path.join(curr_dir, "cte_central.db")

        self.db_path = os.path.normpath(db_path)
        self.lock = threading.Lock()
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self.lock:
            conn = self._get_connection()
            cur = conn.cursor()

            # Complaints table
            cur.execute("""
            CREATE TABLE IF NOT EXISTS complaints (
                id TEXT PRIMARY KEY,
                channel TEXT NOT NULL,
                station_id TEXT NOT NULL,
                received_at TEXT NOT NULL,
                raw_text TEXT NOT NULL,
                raw_image_ref TEXT,
                lang_detected TEXT,
                normalised TEXT,
                dept_primary TEXT,
                dept_secondary TEXT,
                dept_conf REAL,
                urgency INTEGER,
                priority TEXT,
                safety_hits TEXT,
                reply_lang TEXT,
                reply_draft TEXT,
                reply_status TEXT,
                dedupe_key TEXT,
                duplicate_of TEXT,
                model_version TEXT,
                rule_version TEXT,
                updated_at TEXT,
                sync_state TEXT
            );
            """)

            # Review events table
            cur.execute("""
            CREATE TABLE IF NOT EXISTS review_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                complaint_id TEXT NOT NULL,
                actor TEXT NOT NULL,
                field TEXT NOT NULL,
                old_value TEXT,
                new_value TEXT,
                at TEXT NOT NULL,
                notes TEXT,
                FOREIGN KEY (complaint_id) REFERENCES complaints(id)
            );
            """)

            # Idempotency log table
            cur.execute("""
            CREATE TABLE IF NOT EXISTS idempotency_keys (
                idempotency_key TEXT PRIMARY KEY,
                item_id TEXT NOT NULL,
                processed_at TEXT NOT NULL,
                status TEXT NOT NULL
            );
            """)

            conn.commit()
            conn.close()

    def save_complaint(self, c: Dict[str, Any]) -> str:
        with self.lock:
            conn = self._get_connection()
            cur = conn.cursor()
            cur.execute("""
            INSERT OR REPLACE INTO complaints (
                id, channel, station_id, received_at, raw_text, raw_image_ref,
                lang_detected, normalised, dept_primary, dept_secondary, dept_conf,
                urgency, priority, safety_hits, reply_lang, reply_draft,
                reply_status, dedupe_key, duplicate_of, model_version,
                rule_version, updated_at, sync_state
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                c.get("id"),
                c.get("channel", "app"),
                c.get("station_id", "STN_DEFAULT"),
                c.get("received_at"),
                c.get("raw_text"),
                c.get("raw_image_ref"),
                c.get("lang_detected"),
                c.get("normalised"),
                c.get("dept_primary"),
                c.get("dept_secondary"),
                c.get("dept_conf", 0.0),
                c.get("urgency", 0),
                c.get("priority", "P3"),
                json.dumps(c.get("safety_hits", [])),
                c.get("reply_lang"),
                c.get("reply_draft"),
                c.get("reply_status", "draft"),
                c.get("dedupe_key"),
                c.get("duplicate_of"),
                c.get("model_version"),
                c.get("rule_version"),
                c.get("updated_at"),
                c.get("sync_state", "synced")
            ))
            conn.commit()
            conn.close()
            return c.get("id")

    def get_complaint(self, cid: str) -> Optional[Dict[str, Any]]:
        with self.lock:
            conn = self._get_connection()
            cur = conn.cursor()
            cur.execute("SELECT * FROM complaints WHERE id = ?", (cid,))
            row = cur.fetchone()
            conn.close()
            if not row:
                return None
            d = dict(row)
            d["safety_hits"] = json.loads(d["safety_hits"]) if d.get("safety_hits") else []
            return d

    def list_complaints(
        self,
        station_id: Optional[str] = None,
        department: Optional[str] = None,
        priority: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        with self.lock:
            conn = self._get_connection()
            cur = conn.cursor()

            query = "SELECT * FROM complaints WHERE 1=1"
            params = []

            if station_id:
                query += " AND station_id = ?"
                params.append(station_id)
            if department:
                query += " AND dept_primary = ?"
                params.append(department)
            if priority:
                query += " AND priority = ?"
                params.append(priority)

            # P1 safety items pinned first, then by urgency descending, then by received_at
            query += " ORDER BY CASE WHEN priority = 'P1' THEN 0 WHEN priority = 'P2' THEN 1 ELSE 2 END, urgency DESC, received_at DESC"
            query += " LIMIT ? OFFSET ?"
            params.extend([limit, offset])

            cur.execute(query, tuple(params))
            rows = cur.fetchall()
            conn.close()

            results = []
            for r in rows:
                d = dict(r)
                d["safety_hits"] = json.loads(d["safety_hits"]) if d.get("safety_hits") else []
                results.append(d)
            return results

    def add_review_event(self, event: Dict[str, Any]):
        with self.lock:
            conn = self._get_connection()
            cur = conn.cursor()
            cur.execute("""
            INSERT INTO review_events (complaint_id, actor, field, old_value, new_value, at, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                event["complaint_id"],
                event["actor"],
                event["field"],
                str(event.get("old_value")),
                str(event.get("new_value")),
                event["at"],
                event.get("notes")
            ))
            conn.commit()
            conn.close()

    def check_and_log_idempotency(self, key: str, item_id: str, status: str) -> bool:
        """Returns True if new, False if already processed."""
        with self.lock:
            conn = self._get_connection()
            cur = conn.cursor()
            cur.execute("SELECT status FROM idempotency_keys WHERE idempotency_key = ?", (key,))
            row = cur.fetchone()
            if row:
                conn.close()
                return False  # Already seen
            cur.execute("""
            INSERT INTO idempotency_keys (idempotency_key, item_id, processed_at, status)
            VALUES (?, ?, datetime('now'), ?)
            """, (key, item_id, status))
            conn.commit()
            conn.close()
            return True
