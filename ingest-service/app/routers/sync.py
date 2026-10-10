"""Offline Sync Protocol Router (TRD Section 5.5)."""

from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.schemas import SyncPushRequest, SyncPushResponse, SyncPullResponse
from ..services.sync_service import SyncService

router = APIRouter(prefix="/sync", tags=["Sync"])


@router.post("/push", response_model=SyncPushResponse, status_code=status.HTTP_200_OK)
def push_outbox(request: SyncPushRequest, db: Session = Depends(get_db)):
    """Receives offline outbox items from station tablets and synchronizes state idempotently."""
    items_data = [item.model_dump() for item in request.items]
    return SyncService.process_push(db=db, client_uuid=request.client_uuid, items=items_data)


@router.get("/pull", response_model=SyncPullResponse, status_code=status.HTTP_200_OK)
def pull_updates(since: Optional[str] = Query(None, description="ISO timestamp cursor"), db: Session = Depends(get_db)):
    """Pulls updates since timestamp cursor and current bundle version manifest."""
    return SyncService.process_pull(db=db, since=since)
