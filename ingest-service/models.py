"""
Pydantic schemas and data models matching TRD Section 5.3.
"""

from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class ChannelEnum(str, Enum):
    app = "app"
    email = "email"
    social = "social"
    paper = "paper"


class PriorityEnum(str, Enum):
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    REVIEW = "REVIEW"


class ReplyStatusEnum(str, Enum):
    draft = "draft"
    approved = "approved"
    sent = "sent"


class SyncStateEnum(str, Enum):
    local = "local"
    pending = "pending"
    synced = "synced"


class ComplaintCreate(BaseModel):
    station_id: str
    channel: ChannelEnum = ChannelEnum.app
    raw_text: str
    raw_image_ref: Optional[str] = None
    passenger_id: Optional[str] = None  # Masked in logs per privacy rules


class BulkComplaintCreate(BaseModel):
    source: str = "social_export"
    complaints: List[ComplaintCreate]


class ReviewEventCreate(BaseModel):
    actor: str = "controller"
    field: str
    old_value: Any
    new_value: Any
    notes: Optional[str] = None


class OutboxItem(BaseModel):
    id: str
    op_type: str = "upsert"
    payload: Dict[str, Any]
    created_at: str
    attempts: int = 0
    idempotency_key: str
    priority: Optional[str] = "P3"


class SyncPushRequest(BaseModel):
    station_id: str
    device_id: str
    items: List[OutboxItem]


class SyncItemStatus(BaseModel):
    id: str
    status: str  # accepted, duplicate, conflict, error
    detail: Optional[str] = None


class SyncPushResponse(BaseModel):
    station_id: str
    processed_count: int
    results: List[SyncItemStatus]


class SyncPullResponse(BaseModel):
    cursor: str
    has_more: bool
    complaints: List[Dict[str, Any]]
    bundle_manifest: Dict[str, Any]
