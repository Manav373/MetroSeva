"""Convenience runner to start the Metro CTE Ingest Backend and Dashboard."""

import subprocess
import sys
import os
import time
import webbrowser

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    ingest_dir = os.path.join(root_dir, "ingest-service")
    dashboard_html = os.path.join(root_dir, "dashboard", "public", "index.html")

    print("=" * 70)
    print("🚇 METRO COMPLAINT TRIAGE ENGINE (CTE) — RUNTIME CONTROLLER")
    print("=" * 70)
    print(f"Working Directory: {root_dir}")
    print(f"Ingest Service:    {ingest_dir}")
    print(f"Dashboard UI:      {dashboard_html}")
    print("Starting FastAPI backend on http://localhost:8000 ...")

    # Launch uvicorn
    cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "app.main:app",
        "--app-dir",
        ingest_dir,
        "--host",
        "0.0.0.0",
        "--port",
        "8000",
        "--reload"
    ]

    try:
        proc = subprocess.Popen(cmd)
        time.sleep(2)
        print("\n✅ Backend is up!")
        print("🔗 API Documentation: http://localhost:8000/docs")
        print("🔗 Ops & Station UI:   http://localhost:8000/dashboard (or file://...)")
        
        # Open browser
        webbrowser.open("http://localhost:8000/dashboard")
        
        print("\nPress Ctrl+C to terminate the server.\n")
        proc.wait()
    except KeyboardInterrupt:
        print("\nStopping Metro CTE service...")
        proc.terminate()
        proc.wait()
        print("Done.")

if __name__ == "__main__":
    main()
