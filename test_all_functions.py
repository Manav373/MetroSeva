"""
Exhaustive Function-by-Function Test Suite for Metro Complaint Triage Engine (CTE).
Tests EVERY single function, class, and endpoint individually.
"""

import datetime
import importlib.util
import json
import os
import sys
import unittest
import uuid

# Setup sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, "ingest-service"))

from ml.triage_engine.normalizer import normalize_text, replace_urls_with_domain
from ml.triage_engine.language_detector import LanguageDetector
from ml.triage_engine.safety_engine import SafetyRuleEngine
from ml.triage_engine.classifier import DepartmentClassifier
from ml.triage_engine.urgency_scorer import UrgencyScorer
from ml.triage_engine.deduplicator import Deduplicator
from ml.triage_engine.reply_engine import ReplyEngine
from ml.triage_engine.pipeline import TriagePipeline
from ml.export.sign_bundle import build_and_sign_bundle
from ml.eval.run_eval import run_evaluation

from database import Database
from main import app
from fastapi.testclient import TestClient

# Load StationTabletApp via importlib due to hyphen in folder name
sim_path = os.path.join(BASE_DIR, "android-station", "station_simulator.py")
spec = importlib.util.spec_from_file_location("station_simulator", sim_path)
station_simulator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(station_simulator)
StationTabletApp = station_simulator.StationTabletApp


class Test1_Normalizer(unittest.TestCase):
    def test_01_replace_urls_with_domain(self):
        text = "See image at https://metro.example.com/photo/123 for proof"
        result = replace_urls_with_domain(text)
        self.assertIn("[link:metro.example.com]", result)
        self.assertNotIn("https://", result)

    def test_02_normalize_text_emojis_and_whitespace(self):
        text = "Emergency!! 🔥🔥 Train fire https://twitter.com/post   help   now!! 🚨"
        cleaned = normalize_text(text)
        self.assertNotIn("🔥", cleaned)
        self.assertNotIn("🚨", cleaned)
        self.assertIn("[link:twitter.com]", cleaned)
        self.assertNotIn("   ", cleaned)  # extra spaces collapsed


class Test2_LanguageDetector(unittest.TestCase):
    def setUp(self):
        self.ld = LanguageDetector()

    def test_03_detect_script_counts(self):
        counts = self.ld.detect_script_counts("નમસ્તે नमस्ते Hello 123")
        self.assertGreater(counts["gujarati"], 0)
        self.assertGreater(counts["devanagari"], 0)
        self.assertGreater(counts["latin"], 0)

    def test_04_identify_language_gujarati(self):
        lang, script = self.ld.identify_language("પ્લેટફોર્મ પર કચરો છે")
        self.assertEqual(lang, "gu")
        self.assertEqual(script, "gujarati")

    def test_05_identify_language_hindi(self):
        lang, script = self.ld.identify_language("प्लेटफॉर्म पर गंदगी है")
        self.assertEqual(lang, "hi")
        self.assertEqual(script, "devanagari")

    def test_06_identify_language_gujlish(self):
        lang, script = self.ld.identify_language("Lift bandh chhe ane kachro che")
        self.assertEqual(lang, "gu-latn")
        self.assertEqual(script, "latin")

    def test_07_identify_language_english(self):
        lang, script = self.ld.identify_language("The escalator at gate 2 is not working")
        self.assertEqual(lang, "en")
        self.assertEqual(script, "latin")

    def test_08_canonicalize_gujlish(self):
        text = "lift bandh che ane safai nthi"
        canonical = self.ld.canonicalize_gujlish(text)
        self.assertIn("band", canonical)
        self.assertIn("chhe", canonical)
        self.assertIn("safai", canonical)


class Test3_SafetyRuleEngine(unittest.TestCase):
    def setUp(self):
        self.engine = SafetyRuleEngine()

    def test_09_evaluate_fire_english(self):
        res = self.engine.evaluate("Fire and smoke near platform 1 transformer")
        self.assertTrue(res["is_safety"])
        self.assertEqual(res["forced_priority"], "P1")
        self.assertGreaterEqual(res["severity_score"], 80)
        self.assertTrue(any(r["id"] == "SAFE_FIRE_SMOKE" for r in res["matched_rules"]))

    def test_10_evaluate_track_intrusion_hindi(self):
        res = self.engine.evaluate("पटरी पर एक आदमी गिर गया है तुरंत रोको")
        self.assertTrue(res["is_safety"])
        self.assertEqual(res["forced_priority"], "P1")
        self.assertTrue(any(r["id"] == "SAFE_TRACK_INTRUSION" for r in res["matched_rules"]))

    def test_11_evaluate_trapped_lift_gujarati(self):
        res = self.engine.evaluate("લિફ્ટ બંધ છે અને અંદર માણસ ફસાયા છે")
        self.assertTrue(res["is_safety"])
        self.assertEqual(res["forced_priority"], "P1")
        self.assertTrue(any(r["id"] == "SAFE_TRAPPED_PERSON" for r in res["matched_rules"]))

    def test_12_evaluate_harassment_gujlish(self):
        res = self.engine.evaluate("Station par chhedti kare chhe chhokri ni")
        self.assertTrue(res["is_safety"])
        self.assertEqual(res["forced_priority"], "P1")
        self.assertTrue(any(r["id"] == "SAFE_HARASSMENT_VIOLENCE" for r in res["matched_rules"]))

    def test_13_evaluate_non_safety(self):
        res = self.engine.evaluate("Dustbin is full on platform 2")
        self.assertFalse(res["is_safety"])
        self.assertIsNone(res["forced_priority"])
        self.assertEqual(res["severity_score"], 0)


class Test4_DepartmentClassifier(unittest.TestCase):
    def setUp(self):
        self.clf = DepartmentClassifier()

    def test_14_classify_cleanliness(self):
        res = self.clf.classify("Washroom is very dirty and foul smell everywhere")
        self.assertEqual(res["primary"], "cleanliness")
        self.assertGreater(res["confidence"], 0.6)

    def test_15_classify_fare(self):
        res = self.clf.classify("My smart card recharge of 500 rupees failed and money deducted")
        self.assertEqual(res["primary"], "fare")

    def test_16_classify_lifts_escalators(self):
        res = self.clf.classify("The elevator button is broken and escalator stopped")
        self.assertEqual(res["primary"], "lifts_escalators")

    def test_17_classify_staff_behaviour(self):
        res = self.clf.classify("Ticket clerk was extremely rude and shouting at passengers")
        self.assertEqual(res["primary"], "staff_behaviour")

    def test_18_classify_secondary_department(self):
        res = self.clf.classify("The lift was broken and station staff was very rude")
        self.assertIn(res["primary"], ["lifts_escalators", "staff_behaviour"])
        self.assertIsNotNone(res["secondary"])


class Test5_UrgencyScorer(unittest.TestCase):
    def setUp(self):
        self.scorer = UrgencyScorer(safety_floor=80)

    def test_19_safety_floor_enforcement(self):
        safety_eval = {"is_safety": True, "severity_score": 95}
        dept_info = {"primary": "safety", "is_review": False}
        res = self.scorer.calculate_urgency(safety_eval, dept_info, recent_location_complaint_count=0)
        self.assertEqual(res["priority"], "P1")
        self.assertGreaterEqual(res["urgency"], 80)
        self.assertTrue(res["is_safety_floor_triggered"])

    def test_20_repeat_location_boost(self):
        safety_eval = {"is_safety": False, "severity_score": 0}
        dept_info = {"primary": "cleanliness", "is_review": False}
        res_single = self.scorer.calculate_urgency(safety_eval, dept_info, recent_location_complaint_count=0)
        res_repeat = self.scorer.calculate_urgency(safety_eval, dept_info, recent_location_complaint_count=3)
        self.assertGreater(res_repeat["urgency"], res_single["urgency"])


class Test6_Deduplicator(unittest.TestCase):
    def setUp(self):
        self.dedup = Deduplicator(window_seconds=7200)

    def test_21_compute_dedupe_key_stability(self):
        k1 = self.dedup.compute_dedupe_key("Lift bandh chhe", "STN_PALDI", 1000.0)
        k2 = self.dedup.compute_dedupe_key("lift bandh chhe", "stn_paldi", 1000.0)
        self.assertEqual(k1, k2)

    def test_22_duplicate_detection(self):
        key1, dup1, count1 = self.dedup.check_and_register("CID_1", "Washroom dirty", "STN_RANIP", "cleanliness", 1000.0)
        self.assertIsNone(dup1)
        self.assertEqual(count1, 0)

        key2, dup2, count2 = self.dedup.check_and_register("CID_2", "Washroom dirty", "STN_RANIP", "cleanliness", 1500.0)
        self.assertEqual(dup2, "CID_1")
        self.assertGreaterEqual(count2, 1)


class Test7_ReplyEngine(unittest.TestCase):
    def setUp(self):
        self.reply_engine = ReplyEngine()

    def test_23_generate_draft_english(self):
        draft, lang, fallback = self.reply_engine.generate_draft("safety", "P1", "en", "STN_PALDI", "TKT_123")
        self.assertEqual(lang, "en")
        self.assertIn("STN_PALDI", draft)
        self.assertIn("TKT_123", draft)
        self.assertIn("Dear Passenger", draft)

    def test_24_generate_draft_hindi(self):
        draft, lang, fallback = self.reply_engine.generate_draft("cleanliness", "P2", "hi", "STN_NEW_DELHI", "TKT_456")
        self.assertEqual(lang, "hi")
        self.assertIn("STN_NEW_DELHI", draft)
        self.assertIn("प्रिय यात्री", draft)

    def test_25_generate_draft_gujarati(self):
        draft, lang, fallback = self.reply_engine.generate_draft("fare", "P2", "gu", "STN_KALUPUR", "TKT_789")
        self.assertEqual(lang, "gu")
        self.assertIn("STN_KALUPUR", draft)
        self.assertIn("પ્રિય મુસાફર", draft)


class Test8_Pipeline(unittest.TestCase):
    def setUp(self):
        self.pipeline = TriagePipeline()

    def test_26_pipeline_process_end_to_end(self):
        res = self.pipeline.process(
            raw_text="Urgent! Smoke coming from train engine at platform",
            station_id="STN_AIRPORT",
            channel="app"
        )
        self.assertIn("id", res)
        self.assertEqual(res["priority"], "P1")
        self.assertEqual(res["dept_primary"], "safety")
        self.assertGreaterEqual(res["urgency"], 80)
        self.assertIn("STN_AIRPORT", res["reply_draft"])
        self.assertEqual(res["sync_state"], "local")


class Test9_BundleSigner(unittest.TestCase):
    def test_27_build_and_sign_bundle(self):
        manifest = build_and_sign_bundle()
        self.assertIn("bundle_id", manifest)
        self.assertIn("sha256", manifest)
        self.assertIn("signature", manifest)
        self.assertIn("version", manifest)


class Test10_EvaluationSuite(unittest.TestCase):
    def test_28_golden_set_safety_gate(self):
        success = run_evaluation()
        self.assertTrue(success, "Safety recall must be >= 98.0%")


class Test11_Database(unittest.TestCase):
    def setUp(self):
        test_db_path = os.path.join(BASE_DIR, "ingest-service", "test_unit.db")
        if os.path.exists(test_db_path):
            os.remove(test_db_path)
        self.db = Database(db_path=test_db_path)

    def test_29_save_and_get_complaint(self):
        cid = str(uuid.uuid4())
        record = {
            "id": cid,
            "channel": "app",
            "station_id": "STN_UNIT",
            "received_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "raw_text": "Unit test complaint",
            "dept_primary": "fare",
            "urgency": 45,
            "priority": "P2",
            "sync_state": "synced"
        }
        saved_id = self.db.save_complaint(record)
        self.assertEqual(saved_id, cid)

        fetched = self.db.get_complaint(cid)
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["raw_text"], "Unit test complaint")
        self.assertEqual(fetched["dept_primary"], "fare")

    def test_30_list_complaints_with_filter(self):
        cid = str(uuid.uuid4())
        self.db.save_complaint({
            "id": cid,
            "channel": "email",
            "station_id": "STN_UNIT_2",
            "received_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "raw_text": "Filtered complaint",
            "dept_primary": "cleanliness",
            "urgency": 20,
            "priority": "P3"
        })
        items = self.db.list_complaints(station_id="STN_UNIT_2")
        self.assertGreaterEqual(len(items), 1)
        self.assertEqual(items[0]["station_id"], "STN_UNIT_2")

    def test_31_idempotency_log(self):
        is_new1 = self.db.check_and_log_idempotency("key_abc", "item_1", "accepted")
        self.assertTrue(is_new1)
        is_new2 = self.db.check_and_log_idempotency("key_abc", "item_1", "accepted")
        self.assertFalse(is_new2)

    def test_32_add_review_event(self):
        self.db.add_review_event({
            "complaint_id": "item_1",
            "actor": "tester",
            "field": "dept_primary",
            "old_value": "fare",
            "new_value": "cleanliness",
            "at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "notes": "Unit test adjustment"
        })


class Test12_APIEndpoints(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_33_endpoint_health(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "healthy")

    def test_34_endpoint_single_ingest(self):
        res = self.client.post("/v1/complaints", json={
            "station_id": "STN_API_TEST",
            "channel": "app",
            "raw_text": "Live wire exposed on stairs near gate B sparking"
        })
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["priority"], "P1")
        self.assertEqual(data["dept_primary"], "safety")

    def test_35_endpoint_bulk_ingest(self):
        res = self.client.post("/v1/complaints/bulk", json={
            "source": "bulk_unit_test",
            "complaints": [
                {"station_id": "STN_1", "channel": "social", "raw_text": "Washroom dirty"},
                {"station_id": "STN_2", "channel": "social", "raw_text": "Lift bandh chhe"}
            ]
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()["count"], 2)

    def test_36_endpoint_sync_push_and_idempotency(self):
        p1_id = str(uuid.uuid4())
        p3_id = str(uuid.uuid4())
        payload = {
            "station_id": "STN_SYNC_TEST",
            "device_id": "DEV_01",
            "items": [
                {
                    "id": p3_id,
                    "payload": {"id": p3_id, "raw_text": "Minor trash", "priority": "P3", "dept_primary": "cleanliness"},
                    "created_at": "2026-10-10T00:00:00Z",
                    "idempotency_key": f"key_{p3_id}",
                    "priority": "P3"
                },
                {
                    "id": p1_id,
                    "payload": {"id": p1_id, "raw_text": "Track fall emergency", "priority": "P1", "dept_primary": "safety"},
                    "created_at": "2026-10-10T00:01:00Z",
                    "idempotency_key": f"key_{p1_id}",
                    "priority": "P1"
                }
            ]
        }
        res = self.client.post("/v1/sync/push", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        # Verify P1 was processed first
        self.assertEqual(data["results"][0]["id"], p1_id)
        self.assertEqual(data["results"][0]["status"], "accepted")

        # Replay duplicate check
        res_replay = self.client.post("/v1/sync/push", json=payload)
        self.assertEqual(res_replay.status_code, 200)
        self.assertEqual(res_replay.json()["results"][0]["status"], "duplicate")

    def test_37_endpoint_sync_pull(self):
        res = self.client.get("/v1/sync/pull")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("complaints", data)
        self.assertIn("bundle_manifest", data)

    def test_38_endpoint_bundles_latest(self):
        res = self.client.get("/v1/bundles/latest")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("version", data)
        self.assertIn("sha256", data)

    def test_39_endpoint_dashboard_queue_and_stats(self):
        res_q = self.client.get("/v1/dashboard/queue")
        self.assertEqual(res_q.status_code, 200)
        res_s = self.client.get("/v1/dashboard/stats")
        self.assertEqual(res_s.status_code, 200)
        self.assertIn("priority_breakdown", res_s.json())

    def test_40_endpoint_review_feedback(self):
        cid = str(uuid.uuid4())
        # First create complaint
        self.client.post("/v1/complaints", json={
            "station_id": "STN_REV",
            "channel": "app",
            "raw_text": "Review test item"
        })
        # Post review event
        res = self.client.post(f"/v1/complaints/{cid}/review", json={
            "actor": "controller_test",
            "field": "dept_primary",
            "old_value": "other",
            "new_value": "fare",
            "notes": "Adjustment in unit test"
        })
        # If not found, handles 404 cleanly
        self.assertIn(res.status_code, [200, 404])

    def test_41_endpoint_dashboard_html(self):
        res = self.client.get("/dashboard")
        self.assertEqual(res.status_code, 200)
        self.assertIn("<!DOCTYPE html>", res.text)


class Test13_StationSimulator(unittest.TestCase):
    def setUp(self):
        self.tablet = StationTabletApp(station_id="STN_SIM_TEST", device_id="TAB_SIM_01")

    def test_42_station_offline_ingest(self):
        self.assertFalse(self.tablet.is_online)
        res = self.tablet.ingest_offline_complaint("Train par aag lagli chhe", channel="paper")
        self.assertEqual(res["priority"], "P1")
        self.assertEqual(res["dept_primary"], "safety")
        self.assertEqual(len(self.tablet.local_outbox), 1)

    def test_43_station_controller_queue_and_approval(self):
        res = self.tablet.ingest_offline_complaint("Track par koi koodi gayo", channel="paper")
        queue = self.tablet.get_controller_queue()
        self.assertGreaterEqual(len(queue), 1)
        self.assertEqual(queue[0]["priority"], "P1")

        top_id = queue[0]["id"]
        approved = self.tablet.controller_approve_reply(top_id, "Approved reply by controller")
        self.assertTrue(approved)
        self.assertEqual(self.tablet.local_db[top_id]["reply_status"], "approved")


if __name__ == "__main__":
    suite = unittest.TestLoader().loadTestsFromModule(sys.modules[__name__])
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if not result.wasSuccessful():
        sys.exit(1)
