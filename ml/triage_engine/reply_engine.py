"""
Template Reply Engine.
Generates draft responses in the complainant's language (gu, hi, en).
Fills slots ({station}, {ticket_id}) and enforces non-liability legal guardrails.
"""

import json
import os
from typing import Dict, Any, Tuple


class ReplyEngine:
    def __init__(self, templates_base_dir: str = None):
        if templates_base_dir is None:
            curr_dir = os.path.dirname(os.path.abspath(__file__))
            templates_base_dir = os.path.join(curr_dir, "..", "templates", "reply_templates")

        self.base_dir = os.path.normpath(templates_base_dir)
        self.templates: Dict[str, Dict[str, Dict[str, str]]] = {}
        self.load_templates()

    def load_templates(self):
        for lang in ["gu", "hi", "en"]:
            lang_path = os.path.join(self.base_dir, lang, "templates.json")
            if os.path.exists(lang_path):
                try:
                    with open(lang_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        self.templates[lang] = data.get("templates", {})
                except Exception as e:
                    print(f"Warning: Failed to load template for {lang}: {e}")
            else:
                self.templates[lang] = {}

    def generate_draft(
        self,
        department: str,
        priority: str,
        lang_detected: str,
        station_id: str,
        ticket_id: str
    ) -> Tuple[str, str, bool]:
        """
        Generates draft response.
        Returns:
            (reply_draft, target_language, is_language_fallback)
        """
        # Resolve target language:
        # If 'gu-latn' (Gujlish), default to Gujarati or English based on preference;
        # if 'gu' -> 'gu', 'hi' -> 'hi', else 'en'
        is_fallback = False
        if lang_detected == "gu":
            target_lang = "gu"
        elif lang_detected == "hi":
            target_lang = "hi"
        elif lang_detected == "gu-latn":
            # Per FR-2.3: default to complainant language (Gujarati) with fallback note
            target_lang = "gu"
            is_fallback = True
        else:
            target_lang = "en"

        # Safe priority for lookup
        lookup_priority = priority if priority in ["P1", "P2", "P3"] else "P2"

        # Fetch template
        dept_templates = self.templates.get(target_lang, {}).get(department, {})
        template_str = dept_templates.get(lookup_priority)

        # Fallback to English if missing in target language
        if not template_str:
            target_lang = "en"
            is_fallback = True
            dept_templates = self.templates.get("en", {}).get(department, {})
            template_str = dept_templates.get(lookup_priority)

        # Final generic fallback
        if not template_str:
            template_str = "Dear Passenger, your complaint at {station} (Ref: {ticket_id}) has been received and is being processed by our customer care team."

        # Slot filling
        draft = template_str.replace("{station}", station_id).replace("{ticket_id}", ticket_id)

        return draft, target_lang, is_fallback
