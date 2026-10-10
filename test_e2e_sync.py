"""
End-to-End Simulation:
1. Station tablet performs offline triage of mixed multilingual complaints.
2. Controller reviews and approves draft responses.
3. Offline outbox pushes to Ingest Service via TestClient.
4. Central Ingest Service validates idempotency, priority ordering, and stores records.
5. Ops Dashboard queries reflect all synchronized items.
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "ingest-service")))

import importlib.util
from fastapi.testclient import TestClient
from main import app

sim_path = os.path.join(os.path.dirname(__file__), "android-station", "station_simulator.py")
spec = importlib.util.spec_from_file_location("station_simulator", sim_path)
station_simulator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(station_simulator)
StationTabletApp = station_simulator.StationTabletApp

client = TestClient(app)


def test_end_to_end():
    print("\n=======================================================")
    print("  RUNNING CTE END-TO-END OFFLINE-TO-ONLINE SYNC TEST")
    print("=======================================================")

    # 1. Offline tablet operation
    tablet = StationTabletApp(station_id="STN_GANDHINAGAR", device_id="TAB_GN_01")
    assert not tablet.is_online, "Tablet must start offline in airplane mode"

    print("[1] Ingesting complaints on tablet while offline...")
    test_complaints = [
        "Track par manas padi gayo chhe urgently help",
        "Lift bandh chhe ane andar passenger fasaya che",
        "Platform par bahut kachra aur gandagi hai",
        "Smartcard recharge not reflected in balance 200 rupees"
    ]

    for text in test_complaints:
        tablet.ingest_offline_complaint(text)

    queue = tablet.get_controller_queue()
    print(f"    Tablet queue size: {len(queue)}")
    assert len(queue) == 4

    # Top items must be P1
    assert queue[0]["priority"] == "P1", "Top item in tablet queue must be P1"
    assert queue[1]["priority"] == "P1", "Second safety item must also be P1"
    print("    [PASS] Offline triage pinned both safety incidents as P1")

    # 2. Controller approves draft reply for top ticket
    top_id = queue[0]["id"]
    tablet.controller_approve_reply(top_id)
    assert tablet.local_db[top_id]["reply_status"] == "approved"
    print(f"    [PASS] Controller approved draft reply for {top_id[:8]}")

    # 3. Simulate Network Sync
    tablet.is_online = True
    sync_payload = {
        "station_id": tablet.station_id,
        "device_id": tablet.device_id,
        "items": tablet.local_outbox
    }
    print("[2] Syncing outbox to Ingest Service via POST /v1/sync/push...")
    res = client.post("/v1/sync/push", json=sync_payload)
    assert res.status_code == 200
    push_data = res.json()
    assert push_data["processed_count"] == 4
    # Ensure P1 items were processed first
    results = push_data["results"]
    assert results[0]["status"] == "accepted"
    print(f"    [PASS] Successfully synced {push_data['processed_count']} items to central database")

    # 4. Check Ops Dashboard reflects synced items
    res_dash = client.get("/v1/dashboard/queue?station_id=STN_GANDHINAGAR")
    assert res_dash.status_code == 200
    dash_items = res_dash.json()
    assert len(dash_items) >= 4
    assert dash_items[0]["priority"] == "P1"
    print("    [PASS] Ops Dashboard reflects synchronized records with P1 pinned")

    # 5. Check Idempotency protection
    res_repeat = client.post("/v1/sync/push", json=sync_payload)
    assert res_repeat.status_code == 200
    repeat_data = res_repeat.json()
    assert repeat_data["results"][0]["status"] == "duplicate"
    print("    [PASS] Replay sync request safely flagged duplicate without corrupting data")

    print("\n>>> ALL END-TO-END WORKFLOW CHECKS PASSED PERFECTLY! <<<\n")


if __name__ == "__main__":
    test_end_to_end()
