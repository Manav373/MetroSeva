"""Operations and Station Controller Dashboard Router (TRD Section 8.6)."""

import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from ..database import get_db
from ..models.db_models import Complaint, ReviewEvent
from ..models.schemas import ComplaintResponse, StatsOverview

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/queue", response_model=List[ComplaintResponse])
def get_dashboard_queue(
    station_id: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    reply_status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Fetches real-time triage queue for station controllers and HQ ops."""
    query = db.query(Complaint)

    if station_id:
        query = query.filter(Complaint.station_id == station_id)
    if department:
        query = query.filter(Complaint.dept_primary == department)
    if priority:
        query = query.filter(Complaint.priority == priority)
    if channel:
        query = query.filter(Complaint.channel == channel)
    if reply_status:
        query = query.filter(Complaint.reply_status == reply_status)
    if search:
        query = query.filter(Complaint.raw_text.ilike(f"%{search}%"))

    # Priority custom sort: P1 first, then P2, then REVIEW, then P3, then by urgency desc
    # In SQLite, we can sort by urgency descending, and priority
    query = query.order_by(
        Complaint.priority == "P1",  # SQLite boolean desc
        Complaint.urgency.desc(),
        Complaint.created_at.desc()
    )

    items = query.offset(offset).limit(limit).all()
    # Sort in python to guarantee strict P1 -> P2 -> REVIEW -> P3 ordering
    priority_order = {"P1": 0, "P2": 1, "REVIEW": 2, "P3": 3}
    items.sort(key=lambda c: (priority_order.get(c.priority, 4), -c.urgency))

    return [ComplaintResponse(**c.to_dict()) for c in items]


@router.get("/stats", response_model=StatsOverview)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Computes key operational metrics, SLA breaches, and distribution counts."""
    total = db.query(Complaint).count()
    p1_count = db.query(Complaint).filter(Complaint.priority == "P1").count()
    p2_count = db.query(Complaint).filter(Complaint.priority == "P2").count()
    p3_count = db.query(Complaint).filter(Complaint.priority == "P3").count()
    review_count = db.query(Complaint).filter(Complaint.priority == "REVIEW").count()

    # Department distribution
    dept_rows = db.query(Complaint.dept_primary, func.count(Complaint.id)).group_by(Complaint.dept_primary).all()
    dept_dist = {dept: count for dept, count in dept_rows}

    # Channel distribution
    chan_rows = db.query(Complaint.channel, func.count(Complaint.id)).group_by(Complaint.channel).all()
    chan_dist = {chan: count for chan, count in chan_rows}

    # Language distribution
    lang_rows = db.query(Complaint.reply_lang, func.count(Complaint.id)).group_by(Complaint.reply_lang).all()
    lang_dist = {lang: count for lang, count in lang_rows}

    # SLA Breaches: P1 complaints older than 15 minutes whose reply_status is still draft
    cutoff_15m = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=15)
    sla_breaches = db.query(Complaint).filter(
        Complaint.priority == "P1",
        Complaint.reply_status == "draft",
        Complaint.created_at < cutoff_15m
    ).count()

    # Safety alerts today
    start_of_day = datetime.datetime.now(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    safety_today = db.query(Complaint).filter(
        Complaint.dept_primary == "safety",
        Complaint.created_at >= start_of_day
    ).count()

    return StatsOverview(
        total_complaints=total,
        p1_active=p1_count,
        p2_active=p2_count,
        p3_active=p3_count,
        review_needed=review_count,
        sla_breaches=sla_breaches,
        dept_distribution=dept_dist,
        channel_distribution=chan_dist,
        language_distribution=lang_dist,
        safety_alerts_today=safety_today
    )


@router.get("/hotspots")
def get_location_hotspots(db: Session = Depends(get_db)):
    """Returns top station complaint hotspots."""
    rows = db.query(Complaint.station_id, func.count(Complaint.id).label("count"))\
        .group_by(Complaint.station_id)\
        .order_by(desc("count"))\
        .limit(10)\
        .all()
    return [{"station_id": station, "count": count} for station, count in rows]


@router.get("/reviews")
def get_review_audit_log(limit: int = 50, db: Session = Depends(get_db)):
    """Returns audit log of controller overrides and reviews."""
    events = db.query(ReviewEvent).order_by(ReviewEvent.at.desc()).limit(limit).all()
    return [e.to_dict() for e in events]
