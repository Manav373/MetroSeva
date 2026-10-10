"""Pydantic schemas for request validation and response serialization."""

from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field


# Complaint schemas
class ComplaintCreate(BaseModel):
    station_id: str = Field(..., example="STN_PALDI")
    channel: str = Field("app", example="app")  # app, social, email, paper
    raw_text: str = Field(..., example="Lift bandh chhe platform 2 par")
    id: Optional[str] = None


class ComplaintBulkCreate(BaseModel):
    station_id: Optional[str] = "STN_CENTRAL"
    channel: Optional[str] = "social"
    items: List[Dict[str, Any]] = Field(..., description="Array of complaint items or raw texts")


class ComplaintReview(BaseModel):
    actor: str = Field(..., example="controller_sharma")
    field: str = Field(..., example="dept_primary")  # dept_primary, priority, reply_draft, reply_status
    new_value: str = Field(..., example="lifts_escalators")


class ComplaintResponse(BaseModel):
    id: str
    station_id: str
    channel: str
    raw_text: str
    normalised: Optional[str]
    dept_primary: str
    dept_secondary: Optional[str]
    dept_conf: float
    urgency: int
    priority: str
    safety_hits: List[Any] = []
    reply_lang: str
    reply_draft: Optional[str]
    reply_status: str
    dedupe_key: Optional[str]
    duplicate_of: Optional[str]
    model_version: str
    rule_version: str
    sync_state: str
    created_at: Optional[str]
    updated_at: Optional[str]


# Sync Protocol schemas (TRD Section 5.5)
class OutboxPushItem(BaseModel):
    client_uuid: str
    idempotency_key: str
    op_type: str  # CREATE_COMPLAINT, REVIEW_COMPLAINT, APPROVE_REPLY
    payload: Dict[str, Any]


class SyncPushRequest(BaseModel):
    client_uuid: str
    items: List[OutboxPushItem]


class SyncPushItemResult(BaseModel):
    idempotency_key: str
    status: str  # accepted, duplicate, conflict, error
    message: Optional[str] = None
    server_id: Optional[str] = None


class SyncPushResponse(BaseModel):
    results: List[SyncPushItemResult]
    synced_count: int


class SyncPullResponse(BaseModel):
    cursor: str
    complaints: List[ComplaintResponse]
    bundle_version: str
    bundle_hash: str


# Dashboard & Analytics
class QueueFilter(BaseModel):
    station_id: Optional[str] = None
    department: Optional[str] = None
    priority: Optional[str] = None
    channel: Optional[str] = None
    reply_status: Optional[str] = None
    limit: int = 50
    offset: int = 0


class StatsOverview(BaseModel):
    total_complaints: int
    p1_active: int
    p2_active: int
    p3_active: int
    review_needed: int
    sla_breaches: int
    dept_distribution: Dict[str, int]
    channel_distribution: Dict[str, int]
    language_distribution: Dict[str, int]
    safety_alerts_today: int
