"""FastAPI Main Application Entry Point."""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import engine, Base
from .routers import complaints, sync, dashboard, bundles

# Create database tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="High-performance backend for Metro Operations Complaint Triage & Offline Sync (PS-07)",
    version="1.0.0"
)

# Enable CORS for web clients & local dashboards
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(complaints.router, prefix=settings.API_V1_PREFIX)
app.include_router(sync.router, prefix=settings.API_V1_PREFIX)
app.include_router(dashboard.router, prefix=settings.API_V1_PREFIX)
app.include_router(bundles.router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "Metro Ingest & Sync Backend",
        "version": "1.0.0"
    }


@app.get("/", tags=["Root"])
def root():
    return {
        "message": "Metro Complaint Triage Engine (CTE) API is running.",
        "docs": "/docs",
        "health": "/health",
        "version": "1.0.0"
    }


# Mount static dashboard if build exists (prefers React dist build, falls back to public)
dashboard_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../dashboard/dist"))
dashboard_pub = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../dashboard/public"))

if os.path.exists(dashboard_dist):
    app.mount("/dashboard", StaticFiles(directory=dashboard_dist, html=True), name="dashboard")
elif os.path.exists(dashboard_pub):
    app.mount("/dashboard", StaticFiles(directory=dashboard_pub, html=True), name="dashboard")
