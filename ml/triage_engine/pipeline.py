"""
Unified Triage Pipeline for Metro Complaints.
Orchestrates:
1. Text normalization & noise stripping
2. Script detection & Language ID (gu, hi, en, gu-latn)
3. Gujlish lexicon canonicalization
4. Safety rules evaluation & Safety floor enforcement (forces P1, urgency >= 80)
5. Department classification (6-way + confidence + secondary)
6. Urgency scoring (60% rules, 25% severity, 15% repeat-location boost)
7. Channel-independent deduplication (2-hour window)
8. Multilingual draft reply generation
"""

import datetime
import os
import uuid
from typing import Dict, Any, Optional

from .normalizer import normalize_text
from .language_detector import LanguageDetector
from .safety_engine import SafetyRuleEngine
from .classifier import DepartmentClassifier
from .urgency_scorer import UrgencyScorer
from .deduplicator import Deduplicator
from .reply_engine import ReplyEngine


class TriagePipeline:
    def __init__(
        self,
        rules_path: str = None,
        lexicon_path: str = None,
        templates_base_dir: str = None
    ):
        self.model_version = "v1.0.0-rules-tfidf"
        self.language_detector = LanguageDetector(lexicon_path=lexicon_path)
        self.safety_engine = SafetyRuleEngine(rules_path=rules_path)
        self.classifier = DepartmentClassifier(confidence_threshold=0.60)
        self.urgency_scorer = UrgencyScorer(safety_floor=80)
        self.deduplicator = Deduplicator(window_seconds=7200)
        self.reply_engine = ReplyEngine(templates_base_dir=templates_base_dir)

    def process(
        self,
        raw_text: str,
        station_id: str,
        channel: str = "app",
        complaint_id: Optional[str] = None,
        raw_image_ref: Optional[str] = None,
        timestamp: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Executes complete on-device triage flow for a single complaint.
        """
        cid = complaint_id or str(uuid.uuid4())
        now_dt = datetime.datetime.now(datetime.timezone.utc)
        iso_now = now_dt.isoformat()
        ts = timestamp or now_dt.timestamp()

        # Step 1: Normalization
        cleaned_text = normalize_text(raw_text)

        # Step 2: Language & Script Detection
        lang_detected, script_detected = self.language_detector.identify_language(cleaned_text)

        # Step 3: Gujlish Lexicon Canonicalization
        if lang_detected == "gu-latn":
            canonical_text = self.language_detector.canonicalize_gujlish(cleaned_text)
        else:
            canonical_text = cleaned_text

        # Step 4: Safety Rules Evaluation (Cannot be overridden)
        safety_eval = self.safety_engine.evaluate(canonical_text)

        # Step 5: Department Classification
        dept_result = self.classifier.classify(cleaned_text, normalized_text=canonical_text)

        # Override primary department to safety if safety rules fired
        primary_dept = dept_result["primary"]
        secondary_dept = dept_result["secondary"]
        dept_conf = dept_result["confidence"]

        if safety_eval["is_safety"]:
            if primary_dept != "safety":
                secondary_dept = primary_dept  # preserve original as secondary
            primary_dept = "safety"
            dept_conf = max(dept_conf, 0.95)

        # Step 6: Deduplication & Repeat Location Density
        dedupe_key, duplicate_of, recent_location_count = self.deduplicator.check_and_register(
            complaint_id=cid,
            normalized_text=canonical_text,
            station_id=station_id,
            department=primary_dept,
            timestamp=ts
        )

        # Step 7: Urgency & Priority Scoring
        urgency_eval = self.urgency_scorer.calculate_urgency(
            safety_eval=safety_eval,
            dept_info={"primary": primary_dept, "is_review": dept_result["is_review"] and not safety_eval["is_safety"]},
            recent_location_complaint_count=recent_location_count
        )

        final_priority = urgency_eval["priority"]
        final_urgency = urgency_eval["urgency"]

        # Step 8: Multilingual Draft Reply Generation
        reply_draft, reply_lang, is_fallback = self.reply_engine.generate_draft(
            department=primary_dept,
            priority=final_priority,
            lang_detected=lang_detected,
            station_id=station_id,
            ticket_id=cid[:8]
        )

        # Compile output record matching Section 5.3 data model
        return {
            "id": cid,
            "channel": channel,
            "station_id": station_id,
            "received_at": iso_now,
            "raw_text": raw_text,
            "raw_image_ref": raw_image_ref,
            "lang_detected": lang_detected,
            "script_detected": script_detected,
            "normalised": canonical_text,
            "dept_primary": primary_dept,
            "dept_secondary": secondary_dept,
            "dept_conf": dept_conf,
            "urgency": final_urgency,
            "priority": final_priority,
            "safety_hits": safety_eval["matched_rules"],
            "reply_lang": reply_lang,
            "reply_draft": reply_draft,
            "reply_status": "draft",
            "reply_lang_fallback": is_fallback,
            "dedupe_key": dedupe_key,
            "duplicate_of": duplicate_of,
            "explanation": f"{safety_eval['explanation']} | {urgency_eval['explanation']} | {dept_result['explanation']}",
            "model_version": self.model_version,
            "rule_version": self.safety_engine.version,
            "updated_at": iso_now,
            "sync_state": "local"
        }
