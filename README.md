# Complaint Triage Engine (CTE) · Metro Operations

The **Complaint Triage Engine (CTE)** is a high-reliability, offline-first triage system designed for metro stations. It ingests passenger complaints in **Gujarati, Hindi, English, and Gujlish** (Latin transliteration), sorts them across 5 core departments with an auditable safety floor, drafts legally compliant replies in the complainant's language, and synchronizes via an offline outbox queue.

---

## 🏗️ Repository Layout

```
cte/
├── android-station/        Android tablet app (Kotlin, Compose, Room, WorkManager) & offline simulator
├── ingest-service/         FastAPI central ingest & sync backend with SQLite/Postgres
├── dashboard/              Ops Head Office Web Dashboard (live P1 banner, filters, review audit)
├── ml/
│   ├── data/               Golden evaluation dataset (gu, hi, en, gu-latn)
│   ├── lexicon/            gujlish_lexicon.json (phonetic spelling variant normalizer)
│   ├── rules/              safety_rules.json (multilingual safety patterns, forced P1)
│   ├── templates/          reply_templates/{gu,hi,en}/*.json (liability-free templates)
│   ├── triage_engine/      Unified Python pipeline (normalizer, lang-ID, safety, 6-way classifier)
│   └── eval/               run_eval.py (benchmark verifying Safety Recall ≥ 98%)
├── docs/                   taxonomy.md, PRD, architecture notes
└── infra/                  docker-compose.yml, Dockerfile
```

---

## ⚡ Quick Start

### 1. Run the Golden Evaluation Suite
Evaluates the triage engine across all 4 language variants:
```bash
cd d:\dev\cte
py ml/eval/run_eval.py
```
**Benchmark Results:**
- **Safety Recall:** **100.0%** (Exceeds critical gate of $\ge 98\%$)
- **Overall Department Accuracy:** **92.1%** (Target $\ge 85\%$)
- **Processing Latency:** **~3.7 ms / complaint** (Budget $< 300\text{ ms}$)

---

### 2. Launch the Ingest & Sync Backend (with Ops Dashboard)
```bash
cd d:\dev\cte\ingest-service
py -m uvicorn main:app --reload --port 8000
```
- **Ops Dashboard:** Open [`http://localhost:8000/dashboard`](http://localhost:8000/dashboard) or [`http://localhost:8000/`](http://localhost:8000/)
- **Swagger API Docs:** Open [`http://localhost:8000/docs`](http://localhost:8000/docs)

---

### 3. Run the Station Controller Tablet Simulator (Offline Airplane Mode)
Simulates an Android tablet on a station platform operating without network connectivity:
```bash
cd d:\dev\cte
py android-station/station_simulator.py
```
- Ingests paper forms & local complaints offline.
- Pins P1 safety items to the top.
- Drafts responses in Gujarati, Hindi, or English.
- Drains local outbox to cloud when reconnected.

---

### 4. Run End-to-End Sync Tests
```bash
cd d:\dev\cte
py test_e2e_sync.py
```

---

## 🔒 Safety Floor Architecture (FR-4.2)
Any complaint matching a safety pattern (fire, smoke, gas leak, person on track, trapped in lift/escalator, injury, harassment, unattended luggage, live electrical wire) triggers:
1. **Forced Priority:** `P1` (pinned red at the top of station and ops queues).
2. **Forced Urgency Floor:** $\ge 80 / 100$.
3. **Audit Explanation:** Logs matched rule ID and keyword snippets.
4. Downstream machine learning classifiers **cannot** demote or lower a safety rule match.
