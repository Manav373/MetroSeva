"""
Safety Rule Engine.
Evaluates safety patterns and enforces safety floor:
- Priority = P1
- Urgency >= 80
- Cannot be overridden by any downstream classifier
"""

import json
import os
import re
from typing import Dict, List, Any, Tuple


class SafetyRuleEngine:
    def __init__(self, rules_path: str = None):
        if rules_path is None:
            curr_dir = os.path.dirname(os.path.abspath(__file__))
            rules_path = os.path.join(curr_dir, "..", "rules", "safety_rules.json")

        self.rules_path = os.path.normpath(rules_path)
        self.rules: List[Dict[str, Any]] = []
        self.compiled_rules: List[Tuple[Dict[str, Any], List[re.Pattern]]] = []
        self.version = "1.0.0"
        self.min_floor = 80
        self.load_rules()

    def load_rules(self):
        if not os.path.exists(self.rules_path):
            raise FileNotFoundError(f"Safety rules file not found at {self.rules_path}")

        with open(self.rules_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            self.version = data.get("version", "1.0.0")
            self.min_floor = data.get("min_urgency_floor", 80)
            self.rules = data.get("rules", [])

        self.compiled_rules = []
        for rule in self.rules:
            patterns = []
            for pat_str in rule.get("patterns", []):
                try:
                    compiled = re.compile(pat_str, re.IGNORECASE | re.UNICODE)
                    patterns.append(compiled)
                except re.error as e:
                    print(f"Error compiling pattern '{pat_str}' in rule {rule.get('id')}: {e}")
            self.compiled_rules.append((rule, patterns))

    def evaluate(self, text: str) -> Dict[str, Any]:
        """
        Evaluates input text against safety patterns.
        Returns:
            {
                "is_safety": bool,
                "forced_priority": "P1" or None,
                "severity_score": int (0..100),
                "matched_rules": [
                    {
                        "id": str,
                        "description": str,
                        "severity_score": int,
                        "matched_snippets": [str]
                    }
                ],
                "explanation": str
            }
        """
        matched_rules = []
        max_severity = 0

        for rule, patterns in self.compiled_rules:
            snippets = []
            for pat in patterns:
                matches = pat.findall(text)
                if matches:
                    for m in matches:
                        if isinstance(m, tuple):
                            snippet = " ".join([part for part in m if part])
                        else:
                            snippet = str(m)
                        if snippet and snippet not in snippets:
                            snippets.append(snippet)

            if snippets:
                sev = rule.get("severity_score", self.min_floor)
                max_severity = max(max_severity, sev)
                matched_rules.append({
                    "id": rule.get("id"),
                    "description": rule.get("description"),
                    "severity_score": sev,
                    "matched_snippets": snippets
                })

        is_safety = len(matched_rules) > 0
        if is_safety:
            final_urgency = max(self.min_floor, max_severity)
            rule_names = ", ".join([r["id"] for r in matched_rules])
            explanation = f"Safety floor triggered: {rule_names} (matched patterns: {', '.join([s for r in matched_rules for s in r['matched_snippets']])})"
            return {
                "is_safety": True,
                "forced_priority": "P1",
                "severity_score": final_urgency,
                "matched_rules": matched_rules,
                "explanation": explanation
            }
        else:
            return {
                "is_safety": False,
                "forced_priority": None,
                "severity_score": 0,
                "matched_rules": [],
                "explanation": "No safety keywords matched."
            }
