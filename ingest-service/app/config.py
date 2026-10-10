"""Configuration settings for Metro Ingest & Sync Service."""

import os
from pydantic import BaseModel


class Settings(BaseModel):
    PROJECT_NAME: str = "Metro Complaint Triage Engine (CTE) Ingest & Sync Service"
    API_V1_PREFIX: str = "/v1"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./metro_cte.db")
    RULES_PATH: str = os.getenv("RULES_PATH", os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../ml/rules/safety_rules.json")))
    LEXICON_PATH: str = os.getenv("LEXICON_PATH", os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../ml/lexicon/gujlish_lexicon.json")))
    TEMPLATES_DIR: str = os.getenv("TEMPLATES_DIR", os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../ml/templates/reply_templates")))


settings = Settings()
