"""
Urgency Scorer and Priority Calculator.
Implements the 60/25/15 weighted urgency calculation with repeat-location boost,
safety floor override, and detailed score explanations.
"""

from typing import Dict, Any, List


class UrgencyScorer:
    def __init__(self, safety_floor: int = 80):
        self.safety_floor = safety_floor

    def calculate_urgency(
        self,
        safety_eval: Dict[str, Any],
        dept_info: Dict[str, Any],
        recent_location_complaint_count: int = 0
    ) -> Dict[str, Any]:
        """
        Calculates urgency score (0..100) and priority (P1, P2, P3, REVIEW).
        
        Formula:
        - Rules component (60%): safety rules severity score (0..100)
        - Classifier/Department component (25%): base departmental severity (e.g. lifts: 50, fare: 40, clean: 30)
        - Repeat-location boost (15%): scaled based on recent complaint density in 2 hours
        - Safety floor: forced to >= 80 (P1) if safety keywords fired.
        """
        # 1. Rules component (0..100)
        rules_score = safety_eval.get("severity_score", 0)

        # 2. Department baseline severity (0..100)
        dept_base_severity = {
            "safety": 90,
            "lifts_escalators": 60,
            "staff_behaviour": 45,
            "fare": 40,
            "cleanliness": 35,
            "other": 30
        }
        primary_dept = dept_info.get("primary", "other")
        dept_severity = dept_base_severity.get(primary_dept, 30)

        # 3. Repeat-location boost (0..100 scaled)
        # 0 extra: 0 pts, 1 extra: 40 pts, 2+ extra: 80-100 pts
        if recent_location_complaint_count <= 0:
            repeat_boost = 0
        elif recent_location_complaint_count == 1:
            repeat_boost = 45
        elif recent_location_complaint_count == 2:
            repeat_boost = 75
        else:
            repeat_boost = 100

        # Weighted calculation
        raw_urgency = (0.60 * rules_score) + (0.25 * dept_severity) + (0.15 * repeat_boost)
        urgency = int(round(raw_urgency))

        explanation_factors = []
        if rules_score > 0:
            explanation_factors.append(f"Rules match: {rules_score}pts (60% wt)")
        explanation_factors.append(f"Dept baseline ({primary_dept}): {dept_severity}pts (25% wt)")
        if repeat_boost > 0:
            explanation_factors.append(f"Repeat location boost ({recent_location_complaint_count} recent): {repeat_boost}pts (15% wt)")

        # Enforce safety floor last
        safety_applied = False
        if safety_eval.get("is_safety", False):
            if urgency < self.safety_floor:
                urgency = self.safety_floor
                safety_applied = True
            priority = "P1"
        else:
            if urgency >= 80:
                priority = "P1"
            elif urgency >= 50:
                priority = "P2"
            else:
                priority = "P3"

            # Review flag override if classifier is uncertain and not safety
            if dept_info.get("is_review", False):
                priority = "REVIEW"

        if safety_applied:
            explanation_factors.append(f"Safety floor applied (forced min {self.safety_floor})")

        return {
            "urgency": min(100, max(0, urgency)),
            "priority": priority,
            "is_safety_floor_triggered": safety_eval.get("is_safety", False),
            "explanation": " | ".join(explanation_factors)
        }
