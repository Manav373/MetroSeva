"""Complaint ingestion, review, and lookup router."""

import datetime
import json
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.db_models import Complaint, ReviewEvent
from ..models.schemas import ComplaintCreate, ComplaintBulkCreate, ComplaintResponse, ComplaintReview
from ..services.triage_bridge import get_pipeline

router = APIRouter(prefix="/complaints", tags=["Complaints"])


@router.post("", response_model=ComplaintResponse, status_code=status.HTTP_201_CREATED)
def ingest_complaint(payload: ComplaintCreate, db: Session = Depends(get_db)):
    """Ingest a single complaint, triaging it immediately via TriagePipeline."""
    pipeline = get_pipeline()
    cid = payload.id or str(uuid.uuid4())

    triage_res = pipeline.process(
        raw_text=payload.raw_text,
        station_id=payload.station_id,
        channel=payload.channel,
        complaint_id=cid
    )

    complaint = Complaint(
        id=cid,
        station_id=payload.station_id,
        channel=payload.channel,
        raw_text=payload.raw_text,
        normalised=triage_res.get("normalised", payload.raw_text),
        dept_primary=triage_res.get("dept_primary", "other"),
        dept_secondary=triage_res.get("dept_secondary"),
        dept_conf=triage_res.get("dept_conf", 0.0),
        urgency=triage_res.get("urgency", 50),
        priority=triage_res.get("priority", "REVIEW"),
        safety_hits=json.dumps(triage_res.get("safety_hits", [])),
        reply_lang=triage_res.get("reply_lang", "en"),
        reply_draft=triage_res.get("reply_draft"),
        reply_status="draft",
        dedupe_key=triage_res.get("dedupe_key"),
        duplicate_of=triage_res.get("duplicate_of"),
        model_version=triage_res.get("model_version", "v1.0.0"),
        rule_version=triage_res.get("rule_version", "v1.0.0"),
        sync_state="synced",
        created_at=datetime.datetime.now(datetime.timezone.utc),
        updated_at=datetime.datetime.now(datetime.timezone.utc)
    )

    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    return ComplaintResponse(**complaint.to_dict())


@router.post("/bulk", response_model=List[ComplaintResponse], status_code=status.HTTP_201_CREATED)
def ingest_bulk_complaints(payload: ComplaintBulkCreate, db: Session = Depends(get_db)):
    """Batch ingest complaints (e.g. social exports, email dumps, paper scans)."""
    pipeline = get_pipeline()
    created_list = []

    for item in payload.items:
        # Accept either dict with 'text' or string
        if isinstance(item, str):
            text = item
            station = payload.station_id or "STN_CENTRAL"
            channel = payload.channel or "social"
        else:
            text = item.get("raw_text") or item.get("text") or item.get("complaint", "")
            station = item.get("station_id") or payload.station_id or "STN_CENTRAL"
            channel = item.get("channel") or payload.channel or "social"

        if not text.strip():
            continue

        cid = str(uuid.uuid4())
        triage_res = pipeline.process(
            raw_text=text,
            station_id=station,
            channel=channel,
            complaint_id=cid
        )

        complaint = Complaint(
            id=cid,
            station_id=station,
            channel=channel,
            raw_text=text,
            normalised=triage_res.get("normalised", text),
            dept_primary=triage_res.get("dept_primary", "other"),
            dept_secondary=triage_res.get("dept_secondary"),
            dept_conf=triage_res.get("dept_conf", 0.0),
            urgency=triage_res.get("urgency", 50),
            priority=triage_res.get("priority", "REVIEW"),
            safety_hits=json.dumps(triage_res.get("safety_hits", [])),
            reply_lang=triage_res.get("reply_lang", "en"),
            reply_draft=triage_res.get("reply_draft"),
            reply_status="draft",
            dedupe_key=triage_res.get("dedupe_key"),
            duplicate_of=triage_res.get("duplicate_of"),
            model_version=triage_res.get("model_version", "v1.0.0"),
            rule_version=triage_res.get("rule_version", "v1.0.0"),
            sync_state="synced",
            created_at=datetime.datetime.now(datetime.timezone.utc),
            updated_at=datetime.datetime.now(datetime.timezone.utc)
        )
        db.add(complaint)
        created_list.append(complaint)

    db.commit()
    return [ComplaintResponse(**c.to_dict()) for c in created_list]


@router.get("/{complaint_id}", response_model=ComplaintResponse)
def get_complaint(complaint_id: str, db: Session = Depends(get_db)):
    """Fetch complaint details by ID."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return ComplaintResponse(**complaint.to_dict())


@router.post("/{complaint_id}/review", response_model=ComplaintResponse)
def review_complaint(complaint_id: str, review: ComplaintReview, db: Session = Depends(get_db)):
    """Station controller or Supervisor review/override logging."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    old_val = str(getattr(complaint, review.field, ""))
    setattr(complaint, review.field, review.new_value)
    complaint.updated_at = datetime.datetime.now(datetime.timezone.utc)

    # If priority or dept was changed, adjust if necessary
    if review.field == "priority" and review.new_value != "P1":
        # Check if safety rules allow de-escalation
        pass

    event = ReviewEvent(
        complaint_id=complaint_id,
        actor=review.actor,
        field=review.field,
        old_value=old_val,
        new_value=review.new_value,
        at=datetime.datetime.now(datetime.timezone.utc)
    )
    db.add(event)
    db.commit()
    db.refresh(complaint)
    return ComplaintResponse(**complaint.to_dict())


@router.post("/{complaint_id}/approve", response_model=ComplaintResponse)
def approve_reply(complaint_id: str, actor: str = Query("station_controller"), custom_text: Optional[str] = None, db: Session = Depends(get_db)):
    """Approves the draft reply to send to the passenger."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    old_status = complaint.reply_status
    complaint.reply_status = "approved"
    if custom_text:
        complaint.reply_draft = custom_text
    complaint.updated_at = datetime.datetime.now(datetime.timezone.utc)

    event = ReviewEvent(
        complaint_id=complaint_id,
        actor=actor,
        field="reply_status",
        old_value=old_status,
        new_value="approved",
        at=datetime.datetime.now(datetime.timezone.utc)
    )
    db.add(event)
    db.commit()
    db.refresh(complaint)
    return ComplaintResponse(**complaint.to_dict())
