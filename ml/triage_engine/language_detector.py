"""
Script detection, Language Identification, and Gujlish Normalization.
Supports Gujarati (gu), Hindi (hi), English (en), and Gujlish (gu-latn).
"""

import json
import os
import re
from typing import Dict, Tuple, Any

# Unicode blocks
GUJARATI_RANGE = (0x0A80, 0x0AFF)
DEVANAGARI_RANGE = (0x0900, 0x097F)
LATIN_RANGE = (0x0041, 0x007A)


class LanguageDetector:
    def __init__(self, lexicon_path: str = None):
        if lexicon_path is None:
            # Default to standard path
            curr_dir = os.path.dirname(os.path.abspath(__file__))
            lexicon_path = os.path.join(curr_dir, "..", "lexicon", "gujlish_lexicon.json")

        self.lexicon_path = os.path.normpath(lexicon_path)
        self.word_mappings: Dict[str, str] = {}
        self.gujlish_markers = {
            "chhe", "che", "nathi", "nthi", "thayu", "gayu", "karo", "ma", "ne",
            "pan", "su", "shu", "hav", "haju", "aavo", "jova", "bandh", "bndh",
            "kachro", "paisa", "aapyo", "karyu", "hatun", "hatu", "chho"
        }
        self.load_lexicon()

    def load_lexicon(self):
        if os.path.exists(self.lexicon_path):
            try:
                with open(self.lexicon_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.word_mappings = data.get("word_mappings", {})
            except Exception as e:
                print(f"Warning: Failed to load lexicon from {self.lexicon_path}: {e}")

    def detect_script_counts(self, text: str) -> Dict[str, int]:
        counts = {"gujarati": 0, "devanagari": 0, "latin": 0, "other": 0}
        for ch in text:
            cp = ord(ch)
            if GUJARATI_RANGE[0] <= cp <= GUJARATI_RANGE[1]:
                counts["gujarati"] += 1
            elif DEVANAGARI_RANGE[0] <= cp <= DEVANAGARI_RANGE[1]:
                counts["devanagari"] += 1
            elif 65 <= cp <= 90 or 97 <= cp <= 122:
                counts["latin"] += 1
            elif not ch.isspace() and not ch.isdigit():
                counts["other"] += 1
        return counts

    def identify_language(self, text: str) -> Tuple[str, str]:
        """
        Returns (primary_language_code, script_name)
        Codes: 'gu' (Gujarati), 'hi' (Hindi), 'gu-latn' (Gujlish), 'en' (English)
        """
        counts = self.detect_script_counts(text)
        gu_count = counts["gujarati"]
        hi_count = counts["devanagari"]
        lat_count = counts["latin"]

        # If Indic scripts dominate
        if gu_count > 0 and gu_count >= hi_count and gu_count >= lat_count:
            return "gu", "gujarati"
        if hi_count > 0 and hi_count > gu_count and hi_count >= lat_count:
            return "hi", "devanagari"

        # If Latin script dominates
        if lat_count > 0:
            # Check for Gujlish markers & lexicon
            words = [w.strip().lower() for w in re.split(r"\W+", text) if w.strip()]
            gujlish_score = 0
            for w in words:
                if w in self.gujlish_markers or w in self.word_mappings:
                    gujlish_score += 1

            # If 15% or at least 2 words match Gujlish markers
            if len(words) > 0 and (gujlish_score >= 2 or (gujlish_score >= 1 and len(words) <= 4) or (gujlish_score / len(words) >= 0.15)):
                return "gu-latn", "latin"

            return "en", "latin"

        # Fallback if text is numeric or empty
        return "en", "latin"

    def canonicalize_gujlish(self, text: str) -> str:
        """
        Replaces known Gujlish variant spellings with canonical forms.
        """
        if not self.word_mappings:
            return text

        words = text.split()
        result_words = []
        for word in words:
            # Strip punctuation for lookup
            clean_word = re.sub(r"^[^\w]+|[^\w]+$", "", word).lower()
            if clean_word in self.word_mappings:
                canonical = self.word_mappings[clean_word]
                # Preserve leading/trailing punctuation
                result_words.append(word.lower().replace(clean_word, canonical))
            else:
                result_words.append(word)

        return " ".join(result_words)
