"""
Department Classifier for Metro Complaints.
Performs 6-way classification:
- safety
- cleanliness
- fare
- lifts_escalators
- staff_behaviour
- other

Outputs primary department, optional secondary department, and confidence scores.
Triggers 'REVIEW' status if top confidence < 0.60.
"""

import math
import re
from typing import Dict, List, Tuple, Any

DEPARTMENT_TAXONOMY = [
    "safety",
    "cleanliness",
    "fare",
    "lifts_escalators",
    "staff_behaviour",
    "other"
]

# Multilingual keywords and domain tokens for each department
TAXONOMY_KEYWORDS = {
    "safety": {
        # English
        "fire": 5.0, "smoke": 4.5, "gas": 4.5, "leak": 3.5, "track": 4.0, "tracks": 4.0,
        "rails": 4.0, "jumped": 5.0, "fell": 4.0, "injured": 5.0, "injury": 4.5,
        "bleeding": 5.0, "unconscious": 5.0, "harassment": 5.0, "molestation": 5.0,
        "assault": 5.0, "fight": 3.5, "trapped": 4.0, "shock": 4.5, "wire": 3.5,
        "bomb": 5.0, "unattended": 4.0, "danger": 3.5, "emergency": 4.0, "hazard": 4.0,
        # Devanagari
        "आग": 5.0, "धुआं": 4.5, "गैस": 4.5, "पटरी": 4.5, "गिर": 4.0, "घायल": 5.0,
        "चोट": 4.5, "खून": 5.0, "बेहोश": 5.0, "छेड़छाड़": 5.0, "हमला": 4.5,
        "मारपीट": 4.0, "करंट": 4.5, "बम": 5.0, "लावारिस": 4.5, "खतरा": 4.0,
        # Gujarati
        "આગ": 5.0, "ધુમાડો": 4.5, "ગેસ": 4.5, "પાટા": 4.5, "ઇજા": 5.0, "ઈજા": 5.0,
        "લોહી": 5.0, "બેભાન": 5.0, "છેડતી": 5.0, "હુમલો": 4.5, "મારામારી": 4.0,
        "કરંટ": 4.5, "બોમ્બ": 5.0, "લાવારિસ": 4.5, "જોખમ": 4.0, "તણખા": 4.0,
        # Gujlish
        "aag": 5.0, "dhua": 4.5, "dhuvado": 4.5, "lohi": 5.0, "behosh": 5.0, "chhedti": 5.0,
        "pata": 4.0, "patari": 4.0, "kood": 4.5
    },
    "cleanliness": {
        # English
        "dirty": 4.0, "clean": 3.0, "cleanliness": 4.5, "garbage": 4.5, "trash": 4.0,
        "bin": 3.0, "dustbin": 4.0, "smell": 3.0, "stink": 4.0, "odor": 3.5,
        "washroom": 4.5, "toilet": 4.5, "urinal": 4.5, "spit": 4.5, "spitting": 4.5,
        "vomit": 4.5, "stain": 3.5, "floor": 2.5, "filthy": 4.5, "hygiene": 4.0,
        # Devanagari
        "सफाई": 4.5, "गंदगी": 4.5, "कचरा": 4.5, "बदबू": 4.0, "शौचालय": 4.5,
        "टॉयलेट": 4.5, "थूक": 4.5, "उल्टी": 4.5, "मैला": 3.5, "कूड़ा": 4.0,
        # Gujarati
        "સફાઈ": 4.5, "ગંદકી": 4.5, "કચરો": 4.5, "બદબૂ": 4.0, "શૌચાલય": 4.5,
        "થૂંક": 4.5, "ઉલટી": 4.5, "કચરાપેટી": 4.0, "વાસ": 3.5,
        # Gujlish
        "safai": 4.5, "kachro": 4.5, "kachra": 4.0, "gandagi": 4.5, "toilet": 4.5,
        "badboo": 4.0, "dustbin": 4.0
    },
    "fare": {
        # English
        "fare": 4.5, "ticket": 4.5, "token": 4.5, "card": 3.5, "smartcard": 4.5,
        "smart": 3.0, "recharge": 4.5, "refund": 4.5, "deducted": 4.5, "deduct": 4.0,
        "money": 3.5, "amount": 3.0, "charged": 3.5, "overcharged": 4.5, "gate": 3.5,
        "afc": 4.5, "turnstile": 4.0, "balance": 4.0, "transaction": 4.0, "payment": 4.0,
        # Devanagari
        "किराया": 4.5, "टिकट": 4.5, "टोकन": 4.5, "कार्ड": 3.5, "स्मार्टकार्ड": 4.5,
        "रिचार्ज": 4.5, "रिफंड": 4.5, "पैसे": 4.0, "कट": 3.5, "गेट": 3.0, "बैलेंस": 4.0,
        # Gujarati
        "ભાડું": 4.5, "ટિકિટ": 4.5, "ટોકન": 4.5, "કાર્ડ": 3.5, "રિચાર્જ": 4.5,
        "રિફંડ": 4.5, "રૂપિયા": 4.0, "પૈસા": 4.0, "કપાયા": 4.5, "બેલેન્સ": 4.0,
        # Gujlish
        "paisa": 4.0, "paise": 4.0, "kapai": 4.5, "kapi": 4.0, "recharge": 4.5,
        "balance": 4.0, "ticket": 4.5, "token": 4.5, "gate": 3.0
    },
    "lifts_escalators": {
        # English
        "lift": 5.0, "elevator": 5.0, "escalator": 5.0, "stairs": 2.5, "moving": 2.5,
        "stuck": 3.0, "broken": 2.5, "not working": 3.5, "repair": 2.5, "button": 3.0,
        # Devanagari
        "लिफ्ट": 5.0, "एस्केलेटर": 5.0, "सीढ़ी": 3.0, "खराब": 3.0, "बंद": 3.0,
        # Gujarati
        "લિફ્ટ": 5.0, "એસ્કેલેટર": 5.0, "પગથિયા": 3.0, "બંધ": 3.0, "ખરાબ": 3.0,
        # Gujlish
        "lift": 5.0, "escalator": 5.0, "band": 3.5, "chaltu nathi": 3.5, "bigdi": 3.0
    },
    "staff_behaviour": {
        # English
        "staff": 4.5, "controller": 4.0, "guard": 4.0, "clerk": 4.0, "officer": 3.5,
        "employee": 4.0, "rude": 5.0, "misbehaved": 5.0, "misbehaviour": 5.0,
        "shouting": 4.0, "arrogant": 4.5, "attitude": 4.0, "refused": 3.5,
        "sleeping": 4.0, "absent": 4.0, "bad service": 4.0, "unhelpful": 4.0,
        # Devanagari
        "स्टाफ": 4.5, "कर्मचारी": 4.5, "अधिकारी": 4.0, "गार्ड": 4.0, "बदतमीज": 5.0,
        "बदतमीजी": 5.0, "रूखा": 4.5, "चिल्ला": 4.0, "अनुपस्थित": 3.5,
        # Gujarati
        "સ્ટાફ": 4.5, "કર્મચારી": 4.5, "અધિકારી": 4.0, "ગાર્ડ": 4.0, "ગેરવર્તણૂક": 5.0,
        "તોછડું": 4.5, "તોછડાઈ": 5.0, "જવાબ ન આપ્યો": 4.5,
        # Gujlish
        "staff": 4.5, "karmachari": 4.0, "guard": 4.0, "rude": 5.0, "badtameez": 5.0,
        "ghamad": 4.5, "shout": 4.0
    },
    "other": {
        "ac": 3.5, "cooling": 3.5, "fan": 3.0, "announcement": 4.0, "screen": 3.0,
        "display": 3.0, "lost": 3.5, "found": 3.5, "network": 3.0, "wifi": 3.5,
        "signboard": 3.5, "board": 2.5, "sound": 3.0, "light": 3.0, "lighting": 3.0
    }
}


class DepartmentClassifier:
    def __init__(self, confidence_threshold: float = 0.60):
        self.confidence_threshold = confidence_threshold
        self.taxonomy = DEPARTMENT_TAXONOMY
        self.keywords = TAXONOMY_KEYWORDS

    def classify(self, text: str, normalized_text: str = None) -> Dict[str, Any]:
        """
        Calculates scores for all 6 departments based on weighted matching.
        Returns:
            {
                "primary": str,
                "secondary": str or None,
                "confidence": float (0..1),
                "is_review": bool,
                "dept_scores": Dict[str, float],
                "explanation": str
            }
        """
        eval_text = (normalized_text or text).lower()
        scores = {dept: 0.1 for dept in self.taxonomy}  # smoothing baseline

        matched_dept_words: Dict[str, List[str]] = {dept: [] for dept in self.taxonomy}

        for dept, kw_dict in self.keywords.items():
            for kw, weight in kw_dict.items():
                pattern = rf"(?:\b|\s|^){re.escape(kw.lower())}(?:\b|\s|$)"
                if re.search(pattern, eval_text) or kw.lower() in eval_text:
                    scores[dept] += weight
                    matched_dept_words[dept].append(kw)

        # Softmax normalisation to get confidence distribution
        total_exp = sum(math.exp(min(s, 20.0)) for s in scores.values())
        probs = {dept: math.exp(min(s, 20.0)) / total_exp for dept, s in scores.items()}

        # Sort departments by probability descending
        sorted_depts = sorted(probs.items(), key=lambda x: x[1], reverse=True)
        top1_dept, top1_prob = sorted_depts[0]
        top2_dept, top2_prob = sorted_depts[1]

        # Secondary department if score is notable (> 0.20 and not 'other')
        secondary = None
        if top2_prob >= 0.20 and top2_dept != "other" and top2_dept != top1_dept:
            secondary = top2_dept

        is_review = top1_prob < self.confidence_threshold

        explanation = (
            f"Classified as '{top1_dept}' with {top1_prob:.1%} confidence. "
            f"Keywords: {', '.join(matched_dept_words[top1_dept][:5]) if matched_dept_words[top1_dept] else 'none'}."
        )
        if secondary:
            explanation += f" Secondary department: '{secondary}' ({top2_prob:.1%})."

        return {
            "primary": top1_dept,
            "secondary": secondary,
            "confidence": round(top1_prob, 3),
            "is_review": is_review,
            "dept_scores": {k: round(v, 4) for k, v in probs.items()},
            "explanation": explanation
        }
