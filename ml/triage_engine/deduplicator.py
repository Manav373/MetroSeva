"""
Deduplicator and Repeat-location tracker.
Generates channel-independent deduplication hashes based on normalized text,
station, and a 2-hour time window.
Tracks duplicate complaints and recent location density.
"""

import hashlib
import time
from typing import Dict, List, Optional, Tuple


class Deduplicator:
    def __init__(self, window_seconds: int = 7200):  # 2 hours
        self.window_seconds = window_seconds
        # Maps dedupe_key -> {"first_complaint_id": str, "timestamp": float, "count": int}
        self.seen_hashes: Dict[str, Dict] = {}
        # Maps station_id -> [(timestamp, complaint_id, department)]
        self.station_history: Dict[str, List[Tuple[float, str, str]]] = {}

    def compute_dedupe_key(self, normalized_text: str, station_id: str, timestamp: float = None) -> str:
        """
        Computes a stable hash based on normalized text tokens, station ID, and a 2-hour bucket.
        """
        if timestamp is None:
            timestamp = time.time()

        # Bucket timestamp to 2-hour window
        window_bucket = int(timestamp // self.window_seconds)

        # Simplify text: lower, strip non-alphanumeric
        clean_tokens = "".join(ch for ch in normalized_text.lower() if ch.isalnum() or ch.isspace()).split()
        sorted_tokens = " ".join(sorted(clean_tokens))
        
        raw_key = f"{station_id.strip().lower()}|{sorted_tokens}|{window_bucket}"
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()[:16]

    def check_and_register(
        self,
        complaint_id: str,
        normalized_text: str,
        station_id: str,
        department: str,
        timestamp: float = None
    ) -> Tuple[str, Optional[str], int]:
        """
        Registers complaint and checks for duplicate.
        Returns:
            (dedupe_key, duplicate_of_complaint_id, recent_location_count)
        """
        if timestamp is None:
            timestamp = time.time()

        dedupe_key = self.compute_dedupe_key(normalized_text, station_id, timestamp)
        station_clean = station_id.strip().lower()

        # Clean old entries
        cutoff = timestamp - self.window_seconds

        # Check deduplication
        dup_of = None
        if dedupe_key in self.seen_hashes:
            entry = self.seen_hashes[dedupe_key]
            if entry["timestamp"] >= cutoff:
                dup_of = entry["first_complaint_id"]
                entry["count"] += 1
            else:
                self.seen_hashes[dedupe_key] = {
                    "first_complaint_id": complaint_id,
                    "timestamp": timestamp,
                    "count": 1
                }
        else:
            self.seen_hashes[dedupe_key] = {
                "first_complaint_id": complaint_id,
                "timestamp": timestamp,
                "count": 1
            }

        # Calculate recent location complaints in same department
        if station_clean not in self.station_history:
            self.station_history[station_clean] = []

        # Filter out expired events
        self.station_history[station_clean] = [
            (t, cid, dep) for t, cid, dep in self.station_history[station_clean] if t >= cutoff
        ]

        recent_dept_count = sum(
            1 for t, cid, dep in self.station_history[station_clean]
            if dep == department and cid != complaint_id
        )

        # Register this event in station history
        self.station_history[station_clean].append((timestamp, complaint_id, department))

        return dedupe_key, dup_of, recent_dept_count
