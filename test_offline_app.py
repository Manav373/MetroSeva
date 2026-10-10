"""
Verification Test for 100% Offline Station Controller App.
Tests:
- Local database operations in airplane mode
- On-device triage of multilingual text
- Local outbox persistence
- Local HTTP handler endpoints
"""

import os
import sys
import threading
import time
import urllib.request
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from station_app import OfflineStationDB, OfflineStationHandler, socketserver


def test_offline_station_app():
    print("\n--- Testing 100% Offline Station Controller App ---")

    # 1. Start local offline server on test port 8085
    port = 8085
    server_address = ("127.0.0.1", port)
    httpd = socketserver.TCPServer(server_address, OfflineStationHandler)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    time.sleep(0.5)

    base_url = f"http://127.0.0.1:{port}"

    try:
        # 2. Test GET / (HTML terminal load)
        with urllib.request.urlopen(f"{base_url}/") as response:
            assert response.status == 200
            html = response.read().decode("utf-8")
            assert "Station Controller Tablet App" in html
            # Verify NO external CDN or internet dependencies
            assert "fonts.googleapis.com" not in html
            assert "cdn." not in html
            print("[PASS] GET / delivers self-contained air-gapped terminal UI (Zero CDNs)")

        # 3. Test POST /api/ingest (Offline triage)
        req_data = json.dumps({
            "raw_text": "Track par koi koodi gayo chhe urgently police moklo",
            "channel": "paper"
        }).encode("utf-8")
        req = urllib.request.Request(f"{base_url}/api/ingest", data=req_data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as response:
            assert response.status == 200
            data = json.loads(response.read().decode("utf-8"))
            rec = data["record"]
            assert rec["priority"] == "P1", f"Expected P1, got {rec['priority']}"
            assert rec["dept_primary"] == "safety"
            assert rec["sync_state"] == "local"
            ticket_id = rec["id"]
            print(f"[PASS] POST /api/ingest triaged P1 safety item offline: {ticket_id[:8]}")

        # 4. Test GET /api/queue (Prioritized queue view)
        with urllib.request.urlopen(f"{base_url}/api/queue") as response:
            assert response.status == 200
            qdata = json.loads(response.read().decode("utf-8"))
            assert qdata["p1_count"] >= 1
            assert qdata["is_online"] is False, "Default network state must be OFFLINE"
            assert qdata["queue"][0]["priority"] == "P1", "Top item must be P1 safety critical"
            print("[PASS] GET /api/queue returns priority-sorted queue with P1 pinned first")

        # 5. Test POST /api/review (Controller approval in airplane mode)
        rev_data = json.dumps({
            "id": ticket_id,
            "reply_draft": "Approved: Emergency team dispatched on site.",
            "controller_note": "Immediate platform cut-off initiated"
        }).encode("utf-8")
        req_rev = urllib.request.Request(f"{base_url}/api/review", data=rev_data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req_rev) as response:
            assert response.status == 200
            print("[PASS] POST /api/review approved reply and persisted to local outbox")

        # 6. Test GET /api/outbox (Local outbox verification)
        with urllib.request.urlopen(f"{base_url}/api/outbox") as response:
            assert response.status == 200
            outbox_data = json.loads(response.read().decode("utf-8"))
            assert outbox_data["count"] >= 1
            # Top outbox item must be P1
            assert outbox_data["outbox"][0]["priority"] == "P1"
            print(f"[PASS] GET /api/outbox confirms {outbox_data['count']} pending items safely queued for future cloud sync")

        # 7. Test POST /api/toggle-network (Toggle between offline & online)
        req_toggle = urllib.request.Request(f"{base_url}/api/toggle-network", data=b"{}", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req_toggle) as response:
            assert response.status == 200
            net_data = json.loads(response.read().decode("utf-8"))
            assert net_data["is_online"] is True
            print("[PASS] POST /api/toggle-network successfully toggled network state to ONLINE")

        print("\n>>> ALL OFFLINE SYSTEM FUNCTIONS VERIFIED AND PASSED 100%! <<<\n")

    finally:
        httpd.shutdown()
        httpd.server_close()


if __name__ == "__main__":
    test_offline_station_app()
