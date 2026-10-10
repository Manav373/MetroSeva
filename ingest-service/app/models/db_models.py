"""SQLAlchemy database models adhering to TRD Section 5.3 schema."""

import datetime
import json
import uuid
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, Boolean, ForeignKey
from ..database import Base


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    station_id = Column(String(64), nullable=False, index=True)
    channel = Column(String(32), nullable=False, default="app", index=True)  # app, social, email, paper
    raw_text = Column(Text, nullable=False)
    normalised = Column(Text, nullable=True)
    dept_primary = Column(String(64), nullable=False, default="other", index=True)
    dept_secondary = Column(String(64), nullable=True)
    dept_conf = Column(Float, nullable=False, default=0.0)
    urgency = Column(Integer, nullable=False, default=0, index=True)  # 0..100
    priority = Column(String(16), nullable=False, default="REVIEW", index=True)  # P1, P2, P3, REVIEW
    safety_hits = Column(Text, nullable=True)  # JSON-encoded array of fired rules
    reply_lang = Column(String(16), nullable=False, default="en")  # gu, hi, en, gu-latn
    reply_draft = Column(Text, nullable=True)
    reply_status = Column(String(16), nullable=False, default="draft", index=True)  # draft, approved, sent
    dedupe_key = Column(String(64), nullable=True, index=True)
    duplicate_of = Column(String(36), nullable=True, index=True)
    model_version = Column(String(64), nullable=False, default="v1.0.0")
    rule_version = Column(String(64), nullable=False, default="v1.0.0")
    sync_state = Column(String(16), nullable=False, default="synced", index=True)  # local, pending, synced
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), onupdate=lambda: datetime.datetime.now(datetime.timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "station_id": self.station_id,
            "channel": self.channel,
            "raw_text": self.raw_text,
            "normalised": self.normalised,
            "dept_primary": self.dept_primary,
            "dept_secondary": self.dept_secondary,
            "dept_conf": self.dept_conf,
            "urgency": self.urgency,
            "priority": self.priority,
            "safety_hits": json.loads(self.safety_hits) if self.safety_hits else [],
            "reply_lang": self.reply_lang,
            "reply_draft": self.reply_draft,
            "reply_status": self.reply_status,
            "dedupe_key": self.dedupe_key,
            "duplicate_of": self.duplicate_of,
            "model_version": self.model_version,
            "rule_version": self.rule_version,
            "sync_state": self.sync_state,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ReviewEvent(Base):
    __tablename__ = "review_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    complaint_id = Column(String(36), ForeignKey("complaints.id"), nullable=False, index=True)
    actor = Column(String(128), nullable=False)  # Station Controller / Supervisor ID
    field = Column(String(64), nullable=False)   # dept_primary, priority, reply_draft, reply_status
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=False)
    at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "complaint_id": self.complaint_id,
            "actor": self.actor,
            "field": self.field,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "at": self.at.isoformat() if self.at else None,
        }


class OutboxItem(Base):
    __tablename__ = "outbox"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    client_uuid = Column(String(64), nullable=False, index=True)  # Client device UUID
    idempotency_key = Column(String(128), nullable=False, unique=True, index=True)
    op_type = Column(String(32), nullable=False)  # CREATE_COMPLAINT, REVIEW_COMPLAINT, APPROVE_REPLY
    payload = Column(Text, nullable=False)  # JSON payload
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), index=True)
    attempts = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)
    synced = Column(Boolean, default=False, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "client_uuid": self.client_uuid,
            "idempotency_key": self.idempotency_key,
            "op_type": self.op_type,
            "payload": json.loads(self.payload) if self.payload else {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "attempts": self.attempts,
            "last_error": self.last_error,
            "synced": self.synced,
        }
