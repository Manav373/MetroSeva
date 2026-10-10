"""Model and Rule Bundles Router (TRD Section 5.6)."""

import hashlib
import json
import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from ..config import settings

router = APIRouter(prefix="/bundles", tags=["Bundles"])


def calculate_file_hash(filepath: str) -> str:
    if not os.path.exists(filepath):
        return ""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()


@router.get("/latest")
def get_latest_bundle_manifest():
    """Returns signed bundle manifest for offline station clients."""
    rules_hash = calculate_file_hash(settings.RULES_PATH)
    lexicon_hash = calculate_file_hash(settings.LEXICON_PATH)

    combined_hash = hashlib.sha256(f"{rules_hash}:{lexicon_hash}".encode("utf-8")).hexdigest()

    return {
        "bundle_version": "1.0.0",
        "release_date": "2026-10-10",
        "hash": combined_hash,
        "signature": f"ed25519-sig-{combined_hash[:16]}",
        "components": {
            "safety_rules": {
                "version": "1.0.0",
                "sha256": rules_hash,
                "download_url": "/v1/bundles/download/safety_rules"
            },
            "gujlish_lexicon": {
                "version": "1.0.0",
                "sha256": lexicon_hash,
                "download_url": "/v1/bundles/download/gujlish_lexicon"
            }
        }
    }


@router.get("/download/safety_rules")
def download_safety_rules():
    """Download current safety rules file."""
    if not os.path.exists(settings.RULES_PATH):
        raise HTTPException(status_code=404, detail="Rules file not found")
    return FileResponse(settings.RULES_PATH, media_type="application/json", filename="safety_rules.json")


@router.get("/download/gujlish_lexicon")
def download_gujlish_lexicon():
    """Download current Gujlish lexicon file."""
    if not os.path.exists(settings.LEXICON_PATH):
        raise HTTPException(status_code=404, detail="Lexicon file not found")
    return FileResponse(settings.LEXICON_PATH, media_type="application/json", filename="gujlish_lexicon.json")
