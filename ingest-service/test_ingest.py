"""
Integration test suite for Ingest & Sync Service.
Tests single ingest, bulk ingest, outbox synchronization, P1 priority order, and review feedback.
"""

import sys
import os
import uuid

# Ensure ingest-service directory is on PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_service_flow():
    print("\n--- Running Ingest Service Integration Tests ---")

    # 1. Health check
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("[PASS] GET /health returned 200 OK")

    # 2. Single Ingest (Hindi Fire Emergency)
    payload_single = {
        "station_id": "STN_PALDI",
        "channel": "app",
        "raw_text": "प्लेटफॉर्म 1 पर भयंकर आग लग गई है तुरंत दमकल भेजो"
    }
    res = client.post("/v1/complaints", json=payload_single)
    assert res.status_code == 201
    data = res.json()
    assert data["priority"] == "P1", f"Expected P1, got {data['priority']}"
    assert data["dept_primary"] == "safety"
    complaint_id = data["id"]
    print(f"[PASS] POST /v1/complaints successfully triaged P1 safety item: {complaint_id}")

    # 3. Bulk Ingest (Social Media Export)
    payload_bulk = {
        "source": "twitter_export",
        "complaints": [
            {
                "station_id": "STN_KALUPUR",
                "channel": "social",
                "raw_text": "Washroom at gate 2 is smelling terribly and dirty"
            },
            {
                "station_id": "STN_KALUPUR",
                "channel": "social",
                "raw_text": "Lift bandh chhe 3 divas thi"
            }
        ]
    }
    res = client.post("/v1/complaints/bulk", json=payload_bulk)
    assert res.status_code == 201
    bulk_data = res.json()
    assert bulk_data["count"] == 2
    print("[PASS] POST /v1/complaints/bulk successfully ingested 2 items")

    # 4. Outbox Sync Push (simulating Station Device offline sync)
    item_p1_id = str(uuid.uuid4())
    item_p3_id = str(uuid.uuid4())
    sync_payload = {
        "station_id": "STN_RANIP",
        "device_id": "TAB_RANIP_01",
        "items": [
            {
                "id": item_p3_id,
                "op_type": "upsert",
                "payload": {
                    "id": item_p3_id,
                    "channel": "paper",
                    "station_id": "STN_RANIP",
                    "received_at": "2026-10-10T15:00:00Z",
                    "raw_text": "Dustbin overflow on platform",
                    "dept_primary": "cleanliness",
                    "urgency": 35,
                    "priority": "P3"
                },
                "created_at": "2026-10-10T15:00:00Z",
                "idempotency_key": f"key_{item_p3_id}",
                "priority": "P3"
            },
            {
                "id": item_p1_id,
                "op_type": "upsert",
                "payload": {
                    "id": item_p1_id,
                    "channel": "paper",
                    "station_id": "STN_RANIP",
                    "received_at": "2026-10-10T15:05:00Z",
                    "raw_text": "Person jumped on rails track urgently cut power",
                    "dept_primary": "safety",
                    "urgency": 98,
                    "priority": "P1"
                },
                "created_at": "2026-10-10T15:05:00Z",
                "idempotency_key": f"key_{item_p1_id}",
                "priority": "P1"
            }
        ]
    }
    res = client.post("/v1/sync/push", json=sync_payload)
    assert res.status_code == 200
    push_res = res.json()
    assert push_res["processed_count"] == 2
    # Verify P1 was processed first in results
    assert push_res["results"][0]["id"] == item_p1_id, "P1 safety item must be processed first!"
    print("[PASS] POST /v1/sync/push prioritized P1 safety items ahead of P3 items")

    # 5. Test Idempotency with replay
    res_dup = client.post("/v1/sync/push", json=sync_payload)
    assert res_dup.status_code == 200
    dup_res = res_dup.json()
    assert dup_res["results"][0]["status"] == "duplicate"
    print("[PASS] POST /v1/sync/push idempotency check detected duplicate transmission")

    # 6. Dashboard Queue & Stats
    res_queue = client.get("/v1/dashboard/queue")
    assert res_queue.status_code == 200
    queue = res_queue.json()
    assert len(queue) >= 4
    # Top item must be P1
    assert queue[0]["priority"] == "P1", "Queue must pin P1 safety items to the top"
    print("[PASS] GET /v1/dashboard/queue returns prioritized queue with P1 pinned")

    res_stats = client.get("/v1/dashboard/stats")
    assert res_stats.status_code == 200
    stats = res_stats.json()
    assert stats["p1_active_count"] >= 2
    print(f"[PASS] GET /v1/dashboard/stats shows {stats['total_complaints']} complaints, {stats['p1_active_count']} P1 alerts")

    # 7. Controller Review & Retraining Feedback Loop
    review_payload = {
        "actor": "controller_patel_station02",
        "field": "dept_primary",
        "old_value": "other",
        "new_value": "cleanliness",
        "notes": "Controller reclassified minor trash spill from other to cleanliness"
    }
    res_review = client.post(f"/v1/complaints/{item_p3_id}/review", json=review_payload)
    assert res_review.status_code == 200
    print("[PASS] POST /v1/complaints/{id}/review successfully recorded controller correction for retraining")

    print("\n>>> ALL INGEST & SYNC TESTS PASSED SUCCESSFULLY! <<<\n")


if __name__ == "__main__":
    test_service_flow()
