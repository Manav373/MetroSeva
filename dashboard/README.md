# Metro CTE — Station Controller & Operations Dashboard

Built with **React 18 + TypeScript + Vite + Lucide Icons**.
Part of **PS-07: Metro Complaint Triage System (CTE)**.

---

## 🚇 Features

1. **Multilingual Ingest & Queue**:
   - Supports Gujarati (`gu`), Hindi (`hi`), English (`en`), and Gujlish (`gu-latn`).
   - Normalised token inspector for variant Gujlish spellings.
   - P1 Safety alerts pinned to the top with immediate audio/visual alert banner.

2. **Station Controller Operations**:
   - Multi-station filtering (STN_PALDI, STN_KALUPUR, STN_CENTRAL, STN_APMC, STN_THALTEJ, and Central HQ view).
   - Department queue tabs (Safety & Security, Cleanliness, Lifts & Escalators, Fare, Staff Behaviour, Other).
   - One-tap draft reply approval in complainant's language with legal liability safeguards.
   - Human-in-the-loop review modal allowing department / priority overrides, logged to the active-learning retraining audit trail.

3. **Offline Platform Mode & Outbox Sync**:
   - Switch between **Central Online** and **Offline Mode (Platform)**.
   - Offline actions (reply approvals, grievance submissions, reviews) are queued locally with client UUID and idempotency keys.
   - **Sync Outbox** uploads in order, prioritizing P1 safety items first.

4. **Interactive Ingest Simulator**:
   - 1-click test scenarios for Gujarati fire hazards, Gujlish lift breakdowns, Hindi fare deductions, English staff behavior, and paper form OCR digitization.

5. **Ops Analytics & Retraining Audit**:
   - Live department distribution chart.
   - Complainant language mix.
   - Top repeat-location station hotspots.
   - Reviewer override audit trail table.

---

## 🚀 Running the Dashboard

### Option A: Unified Demo (Backend + Dashboard together)
```bash
py -3.11 run_demo.py
```
Open **http://localhost:8000/dashboard** in your browser.

### Option B: Vite Dev Server (with Hot Reloading)
```bash
cd dashboard
npm install
npm run dev
```
Open **http://localhost:5173** in your browser. Vite proxies API calls directly to `http://localhost:8000`.
