"""
Station Controller Offline Tablet Simulator.
Simulates an Android station tablet operating in airplane mode:
1. On-device triage (normalizing, safety floor, classification, draft reply generation).
2. Department-tabbed queue with P1 pinned to top.
3. Review and approval of draft replies in complainant's language (gu, hi, en).
4. Local transactional outbox queue.
5. Online reconnect and outbox sync to central ingest backend.
"""

import json
import os
import sys
import time
import uuid
from typing import Dict, List, Any

# Ensure root cte module is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ml.triage_engine import TriagePipeline


class StationTabletApp:
    def __init__(self, station_id: str = "STN_PALDI", device_id: str = "TAB_PALDI_01"):
        self.station_id = station_id
        self.device_id = device_id
        self.pipeline = TriagePipeline()
        self.is_online = False  # Start in airplane mode by default
        self.local_db: Dict[str, Dict[str, Any]] = {}
        self.local_outbox: List[Dict[str, Any]] = []

    def ingest_offline_complaint(self, raw_text: str, channel: str = "paper") -> Dict[str, Any]:
        """Triages complaint locally with zero network dependency."""
        result = self.pipeline.process(
            raw_text=raw_text,
            station_id=self.station_id,
            channel=channel
        )
        cid = result["id"]
        result["sync_state"] = "local"
        self.local_db[cid] = result

        # Transactional outbox write
        outbox_entry = {
            "id": cid,
            "op_type": "upsert",
            "payload": result,
            "created_at": result["received_at"],
            "idempotency_key": f"key_{cid}",
            "priority": result["priority"]
        }
        self.local_outbox.append(outbox_entry)
        return result

    def get_controller_queue(self, department: str = None) -> List[Dict[str, Any]]:
        """Returns sorted queue with P1 pinned at top, then urgency descending."""
        items = list(self.local_db.values())
        if department:
            items = [i for i in items if i["dept_primary"] == department]

        priority_order = {"P1": 0, "P2": 1, "P3": 2, "REVIEW": 3}
        return sorted(items, key=lambda x: (priority_order.get(x["priority"], 2), -x["urgency"]))

    def controller_approve_reply(self, complaint_id: str, final_reply: str = None):
        """Controller approves draft response."""
        if complaint_id not in self.local_db:
            return False
        complaint = self.local_db[complaint_id]
        complaint["reply_status"] = "approved"
        if final_reply:
            complaint["reply_draft"] = final_reply

        # Update outbox
        for item in self.local_outbox:
            if item["id"] == complaint_id:
                item["payload"] = complaint

        return True

    def sync_outbox_to_cloud(self, api_base_url: str = "http://localhost:8000") -> Dict[str, Any]:
        """Drains outbox to central backend when online."""
        if not self.is_online:
            return {"status": "error", "message": "Cannot sync: device is in airplane mode"}

        if not self.local_outbox:
            return {"status": "success", "message": "Outbox is empty"}

        import requests
        payload = {
            "station_id": self.station_id,
            "device_id": self.device_id,
            "items": self.local_outbox
        }

        try:
            res = requests.post(f"{api_base_url}/v1/sync/push", json=payload, timeout=10)
            if res.status_code == 200:
                data = res.json()
                synced_count = len(self.local_outbox)
                self.local_outbox.clear()
                for cid in self.local_db:
                    self.local_db[cid]["sync_state"] = "synced"
                return {"status": "success", "synced_items": synced_count, "server_response": data}
            else:
                return {"status": "error", "message": f"Server error: {res.text}"}
        except Exception as e:
            return {"status": "error", "message": f"Connection failed: {e}"}


def demo_shift_workflow():
    print("\n=======================================================")
    print("  STATION CONTROLLER TABLET SIMULATOR (AIRPLANE MODE)")
    print("=======================================================")
    tablet = StationTabletApp(station_id="STN_PALDI")

    # Step 1: Controller starts shift offline
    print("\n[Shift Start] Device status: AIRPLANE MODE (OFFLINE = TRUE)")
    print(f"Station: {tablet.station_id} | Device: {tablet.device_id}")

    # Step 2: Triaging batch of paper/local complaints offline
    test_batch = [
        ("Lift bandh chhe ane andar 2 passengers fasa gaya che", "paper"),  # Safety P1
        ("Platform 2 washroom is dirty and overflowing with water", "paper"),  # Cleanliness P2
        ("Station guard was extremely rude at counter", "paper"),  # Staff behaviour P2
        ("AFC gate par 50 rupiya kapai gaya ticket na aavyu", "paper"),  # Fare P2
        ("Track par koi koodi gayo chhe metro tatkal roko", "paper")  # Critical Safety P1
    ]

    print(f"\n[Ingest] Ingesting {len(test_batch)} paper forms via on-device OCR/triage...")
    for text, channel in test_batch:
        res = tablet.ingest_offline_complaint(text, channel=channel)
        print(f"  -> Triage: [{res['priority']}] {res['dept_primary'].upper()} | Lang: {res['lang_detected']} | Text: {text[:45]}...")

    # Step 3: Controller inspects prioritized queue
    print("\n[Controller Queue View - Priority Sorted]:")
    queue = tablet.get_controller_queue()
    for idx, item in enumerate(queue, 1):
        print(f"  {idx}. [{item['priority']}] Urgency: {item['urgency']} | Dept: {item['dept_primary']} | ID: {item['id'][:8]}")
        print(f"     Draft Reply ({item['reply_lang']}): {item['reply_draft'][:70]}...")

    # Step 4: Controller approves draft response for top Safety item
    top_p1 = queue[0]
    print(f"\n[Action] Controller approves response for Ticket {top_p1['id'][:8]}:")
    tablet.controller_approve_reply(top_p1["id"])
    print("  -> Reply marked: APPROVED")

    # Step 5: Check outbox status
    print(f"\n[Outbox Status] Pending items queued for sync: {len(tablet.local_outbox)}")

    # Step 6: Network restored - Sync outbox
    print("\n[Network Restored] Turning airplane mode OFF -> ONLINE")
    tablet.is_online = True
    sync_result = tablet.sync_outbox_to_cloud()
    print(f"[Sync Result]: {sync_result['status'].upper()}")
    if sync_result['status'] == 'success':
        print(f"  Successfully synchronized {sync_result['synced_items']} items to central cloud!")
    else:
        print(f"  Sync note: {sync_result.get('message')}")

    print("\n=======================================================\n")


if __name__ == "__main__":
    demo_shift_workflow()
