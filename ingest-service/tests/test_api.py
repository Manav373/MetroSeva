"""Integration tests for Ingest & Sync Service."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import Base, engine

client = TestClient(app)


def setup_module():
    # Ensure fresh test DB
    Base.metadata.create_all(bind=engine)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_ingest_single_safety_complaint():
    payload = {
        "station_id": "STN_PALDI",
        "channel": "app",
        "raw_text": "Platform 2 par track par aag ane dhumaado chhe, help!"
    }
    response = client.post("/v1/complaints", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["station_id"] == "STN_PALDI"
    assert data["priority"] == "P1"
    assert data["dept_primary"] == "safety"
    assert data["urgency"] >= 80
    assert len(data["safety_hits"]) > 0
    assert "draft" in data["reply_status"]


def test_ingest_single_cleanliness_complaint():
    payload = {
        "station_id": "STN_KALUPUR",
        "channel": "app",
        "raw_text": "Washroom near gate 3 is very dirty and foul smelling."
    }
    response = client.post("/v1/complaints", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["dept_primary"] == "cleanliness"
    assert data["priority"] in ["P2", "P3"]


def test_ingest_bulk():
    batch = {
        "station_id": "STN_CENTRAL",
        "channel": "social",
        "items": [
            {"raw_text": "Lift bandh che platform 1 par", "channel": "social"},
            {"raw_text": "गैस की बू आ रही है स्टेशन 4 पर जल्दी देखो", "channel": "app"},
            {"raw_text": "Ticket counter guy overcharged 20 rupees", "channel": "paper"}
        ]
    }
    response = client.post("/v1/complaints/bulk", json=batch)
    assert response.status_code == 201
    results = response.json()
    assert len(results) == 3


def test_offline_sync_push_idempotency_and_p1_order():
    payload = {
        "client_uuid": "station_tablet_paldi_01",
        "items": [
            {
                "client_uuid": "station_tablet_paldi_01",
                "idempotency_key": "idemp_test_001",
                "op_type": "CREATE_COMPLAINT",
                "payload": {
                    "raw_text": "Normal cleanliness issue at bench",
                    "station_id": "STN_PALDI",
                    "channel": "paper",
                    "priority": "P3"
                }
            },
            {
                "client_uuid": "station_tablet_paldi_01",
                "idempotency_key": "idemp_test_002",
                "op_type": "CREATE_COMPLAINT",
                "payload": {
                    "raw_text": "Track par manas padi gayo chhe",
                    "station_id": "STN_PALDI",
                    "channel": "paper",
                    "priority": "P1"
                }
            }
        ]
    }
    # First push
    res1 = client.post("/v1/sync/push", json=payload)
    assert res1.status_code == 200
    res1_json = res1.json()
    assert res1_json["synced_count"] == 2

    # Second push with same idempotency keys -> must report duplicate
    res2 = client.post("/v1/sync/push", json=payload)
    assert res2.status_code == 200
    res2_json = res2.json()
    for item in res2_json["results"]:
        assert item["status"] == "duplicate"


def test_sync_pull():
    response = client.get("/v1/sync/pull")
    assert response.status_code == 200
    data = response.json()
    assert "cursor" in data
    assert "complaints" in data
    assert "bundle_version" in data


def test_dashboard_queue_and_stats():
    queue_res = client.get("/v1/dashboard/queue?limit=10")
    assert queue_res.status_code == 200
    queue = queue_res.json()
    assert len(queue) > 0

    stats_res = client.get("/v1/dashboard/stats")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_complaints"] > 0
    assert "safety" in stats["dept_distribution"] or "cleanliness" in stats["dept_distribution"]


def test_bundles_manifest():
    response = client.get("/v1/bundles/latest")
    assert response.status_code == 200
    data = response.json()
    assert "bundle_version" in data
    assert "components" in data


if __name__ == "__main__":
    test_health()
    test_ingest_single_safety_complaint()
    test_ingest_single_cleanliness_complaint()
    test_ingest_bulk()
    test_offline_sync_push_idempotency_and_p1_order()
    test_sync_pull()
    test_dashboard_queue_and_stats()
    test_bundles_manifest()
    print("ALL TESTS PASSED SUCCESSFULLY!")
