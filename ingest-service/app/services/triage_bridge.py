"""Triage Bridge: Integrates the ML triage engine with the ingest service."""

import os
import sys
import uuid
from typing import Dict, Any

# Ensure cte root is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
cte_root = os.path.abspath(os.path.join(current_dir, "../../../"))
if cte_root not in sys.path:
    sys.path.insert(0, cte_root)

_pipeline_instance = None


def get_pipeline():
    global _pipeline_instance
    if _pipeline_instance is None:
        try:
            from ml.triage_engine.pipeline import TriagePipeline
            _pipeline_instance = TriagePipeline()
        except Exception as e:
            print(f"[TriageBridge] Note: Loading TriagePipeline failed ({e}), using fallback rule engine.")
            _pipeline_instance = FallbackTriagePipeline()
    return _pipeline_instance


class FallbackTriagePipeline:
    """Fallback triage pipeline when ML pipeline dependencies are initializing."""
    def __init__(self):
        self.model_version = "v1.0.0-fallback"

    def process(self, raw_text: str, station_id: str, channel: str = "app", complaint_id: str = None) -> Dict[str, Any]:
        cid = complaint_id or str(uuid.uuid4())
        lower = raw_text.lower()

        # Check safety indicators
        is_safety = any(w in lower for w in ["fire", "aag", "smoke", "dhua", "gas", "leak", "track", "jump", "blood", "emergency", "marpit", "harass"])
        
        if is_safety:
            dept = "safety"
            priority = "P1"
            urgency = 95
            safety_hits = ["FALLBACK_SAFETY_RULE"]
        elif any(w in lower for w in ["lift", "elevator", "escalator", "c-escalator"]):
            dept = "lifts_escalators"
            priority = "P2"
            urgency = 65
            safety_hits = []
        elif any(w in lower for w in ["clean", "dirt", "kachra", "safai", "smell", "toilet", "washroom", "gandagi"]):
            dept = "cleanliness"
            priority = "P3"
            urgency = 40
            safety_hits = []
        elif any(w in lower for w in ["ticket", "card", "recharge", "fare", "paisa", "token", "gate", "afc"]):
            dept = "fare"
            priority = "P3"
            urgency = 45
            safety_hits = []
        elif any(w in lower for w in ["staff", "rude", "behaviour", "guard", "misconduct"]):
            dept = "staff_behaviour"
            priority = "P2"
            urgency = 55
            safety_hits = []
        else:
            dept = "other"
            priority = "REVIEW"
            urgency = 30
            safety_hits = []

        return {
            "complaint_id": cid,
            "station_id": station_id,
            "channel": channel,
            "raw_text": raw_text,
            "normalised": raw_text.strip(),
            "dept_primary": dept,
            "dept_secondary": None,
            "dept_conf": 0.85 if dept != "other" else 0.40,
            "urgency": urgency,
            "priority": priority,
            "safety_hits": safety_hits,
            "reply_lang": "en",
            "reply_draft": f"Dear Passenger, your report regarding {dept} at {station_id} (Ref: {cid[:8]}) has been registered with operational support.",
            "reply_status": "draft",
            "dedupe_key": None,
            "duplicate_of": None,
            "model_version": self.model_version,
            "rule_version": "v1.0.0",
            "sync_state": "synced"
        }
