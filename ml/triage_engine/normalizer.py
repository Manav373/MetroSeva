"""
Normalizer for multilingual complaint text.
Performs Unicode NFC normalization, URL reduction, and noise/emoji stripping.
"""

import re
import unicodedata
from urllib.parse import urlparse

# Pattern to detect emojis and non-standard symbols
EMOJI_PATTERN = re.compile(
    "["
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F680-\U0001F6FF"  # transport & map symbols
    "\U0001F1E0-\U0001F1FF"  # flags (iOS)
    "\U00002702-\U000027B0"
    "\U000024C2-\U0001F251"
    "\U0001F900-\U0001F9FF"  # supplemental symbols
    "\U0001FA00-\U0001FA6F"  # chess, symbols
    "\U0001FA70-\U0001FAFF"
    "]+",
    flags=re.UNICODE,
)

URL_PATTERN = re.compile(r"https?://[^\s/$.?#].[^\s]*", re.IGNORECASE)


def replace_urls_with_domain(text: str) -> str:
    """Replaces full URLs with just their domain name to preserve context."""
    def _replacer(match):
        url = match.group(0)
        try:
            parsed = urlparse(url)
            domain = parsed.netloc or parsed.path
            domain = domain.split(":")[0]  # strip port
            return f"[link:{domain}]"
        except Exception:
            return "[link]"

    return URL_PATTERN.sub(_replacer, text)


def normalize_text(raw_text: str) -> str:
    """
    Applies standard normalization:
    1. Unicode NFC
    2. URL reduction (keeps domain name)
    3. Strips emojis
    4. Normalizes whitespace
    """
    if not raw_text:
        return ""

    # 1. Unicode NFC
    text = unicodedata.normalize("NFC", raw_text)

    # 2. URL reduction
    text = replace_urls_with_domain(text)

    # 3. Strip emoji
    text = EMOJI_PATTERN.sub(" ", text)

    # 4. Normalize multiple whitespaces and control characters
    text = re.sub(r"[\r\n\t]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    return text
