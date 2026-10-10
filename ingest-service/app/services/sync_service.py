"""Sync Protocol Service implementing TRD Section 5.5.
Handles idempotent push of station outbox items and pull delta updates.
Orders P1 items first, handles conflicts and updates.
"""

import datetime
import json
import uuid
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from ..models.db_models import Complaint, ReviewEvent, OutboxItem
from ..models.schemas import SyncPushItemResult, SyncPushResponse, SyncPullResponse, ComplaintResponse
from .triage_bridge import get_pipeline


class SyncService:
    @staticmethod
    def process_push(db: Session, client_uuid: str, items: List[Dict[str, Any]]) -> SyncPushResponse:
        results: List[SyncPushItemResult] = []
        synced_count = 0

        # Sort items: P1 priority items first if specified in payload, else normal order
        def priority_weight(item):
            payload = item.get("payload", {})
            prio = payload.get("priority", "P3")
            if prio == "P1":
                return 0
            if prio == "P2":
                return 1
            return 2

        sorted_items = sorted(items, key=priority_weight)

        for item_data in sorted_items:
            idempotency_key = item_data.get("idempotency_key")
            op_type = item_data.get("op_type", "CREATE_COMPLAINT")
            payload = item_data.get("payload", {})

            # 1. Check idempotency
            existing_outbox = db.query(OutboxItem).filter(OutboxItem.idempotency_key == idempotency_key).first()
            if existing_outbox:
                results.append(SyncPushItemResult(
                    idempotency_key=idempotency_key,
                    status="duplicate",
                    message="Item already processed idempotently.",
                    server_id=existing_outbox.id
                ))
                continue

            try:
                server_id = None
                if op_type == "CREATE_COMPLAINT":
                    raw_text = payload.get("raw_text", "")
                    station_id = payload.get("station_id", "STN_UNKNOWN")
                    channel = payload.get("channel", "paper")
                    complaint_id = payload.get("id") or str(uuid.uuid4())

                    # Check if complaint ID already exists in DB
                    existing_c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
                    if existing_c:
                        server_id = existing_c.id
                        status = "duplicate"
                    else:
                        pipeline = get_pipeline()
                        triage_res = pipeline.process(
                            raw_text=raw_text,
                            station_id=station_id,
                            channel=channel,
                            complaint_id=complaint_id
                        )

                        complaint = Complaint(
                            id=complaint_id,
                            station_id=station_id,
                            channel=channel,
                            raw_text=raw_text,
                            normalised=triage_res.get("normalised", raw_text),
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
                        server_id = complaint_id
                        status = "accepted"
                        synced_count += 1

                elif op_type == "REVIEW_COMPLAINT":
                    complaint_id = payload.get("complaint_id")
                    actor = payload.get("actor", client_uuid)
                    field = payload.get("field")
                    new_val = str(payload.get("new_value"))

                    target = db.query(Complaint).filter(Complaint.id == complaint_id).first()
                    if not target:
                        status = "conflict"
                        msg = "Complaint not found on server for review event."
                    else:
                        old_val = str(getattr(target, field, ""))
                        setattr(target, field, new_val)
                        target.updated_at = datetime.datetime.now(datetime.timezone.utc)

                        review = ReviewEvent(
                            complaint_id=complaint_id,
                            actor=actor,
                            field=field,
                            old_value=old_val,
                            new_value=new_val,
                            at=datetime.datetime.now(datetime.timezone.utc)
                        )
                        db.add(review)
                        server_id = review.id
                        status = "accepted"
                        synced_count += 1

                elif op_type == "APPROVE_REPLY":
                    complaint_id = payload.get("complaint_id")
                    target = db.query(Complaint).filter(Complaint.id == complaint_id).first()
                    if target:
                        target.reply_status = "approved"
                        if "custom_reply" in payload and payload["custom_reply"]:
                            target.reply_draft = payload["custom_reply"]
                        target.updated_at = datetime.datetime.now(datetime.timezone.utc)
                        status = "accepted"
                        server_id = complaint_id
                        synced_count += 1
                    else:
                        status = "conflict"

                else:
                    status = "error"

                # Record in outbox table
                outbox_rec = OutboxItem(
                    client_uuid=client_uuid,
                    idempotency_key=idempotency_key,
                    op_type=op_type,
                    payload=json.dumps(payload),
                    synced=True
                )
                db.add(outbox_rec)
                db.commit()

                results.append(SyncPushItemResult(
                    idempotency_key=idempotency_key,
                    status=status,
                    server_id=server_id
                ))

            except Exception as e:
                db.rollback()
                results.append(SyncPushItemResult(
                    idempotency_key=idempotency_key,
                    status="error",
                    message=str(e)
                ))

        return SyncPushResponse(results=results, synced_count=synced_count)

    @staticmethod
    def process_pull(db: Session, since: str = None) -> SyncPullResponse:
        query = db.query(Complaint)
        if since:
            try:
                dt_since = datetime.datetime.fromisoformat(since.replace("Z", "+00:00"))
                query = query.filter(Complaint.updated_at > dt_since)
            except Exception:
                pass

        complaints_rows = query.order_by(Complaint.updated_at.asc()).limit(100).all()
        now_cursor = datetime.datetime.now(datetime.timezone.utc).isoformat()

        complaint_dtos = [ComplaintResponse(**c.to_dict()) for c in complaints_rows]

        return SyncPullResponse(
            cursor=now_cursor,
            complaints=complaint_dtos,
            bundle_version="1.0.0",
            bundle_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        )
