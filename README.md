# MetroSeva · Metro Complaint Triage Engine (CTE)

The **MetroSeva** (Complaint Triage Engine) is a high-reliability, offline-first triage system designed for metro stations. It ingests passenger complaints in **Gujarati, Hindi, English, and Gujlish** (Latin transliteration), sorts them across 5 core departments with an auditable safety floor, drafts legally compliant replies in the complainant's language, and synchronizes via an offline outbox queue.

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

### 3. Launch 100% Offline Station Controller Terminal (Zero-Network / Air-Gapped)
Runs a self-contained local controller terminal with zero external CDNs, zero remote dependencies, and on-device SQLite storage:
```bash
cd d:\dev\cte
py station_app.py
```
- Open in any browser: [`http://localhost:8080`](http://localhost:8080)
- **100% Offline Operations**: Ingest paper forms/text, view department tabs, examine P1 safety incidents pinned at the top, review draft responses, and approve tickets.
- **Local Outbox**: Actions persist in `station_offline.db` even across reboots or after 72 hours of disconnected station operation.
- **Toggle Connectivity**: Switch to Online when station WiFi/cellular is available to sync pending outbox items to the central server.

---

### 4. Run Station Tablet Simulator (Command-line)
```bash
cd d:\dev\cte
py android-station/station_simulator.py
```

---

### 5. Run End-to-End Tests
```bash
cd d:\dev\cte
py test_all_functions.py      # Exhaustive 43-function test suite
py test_offline_app.py        # 100% offline station terminal verification
py test_e2e_sync.py           # Offline tablet -> Cloud sync verification
```

---

## 🔒 Safety Floor Architecture (FR-4.2)
Any complaint matching a safety pattern (fire, smoke, gas leak, person on track, trapped in lift/escalator, injury, harassment, unattended luggage, live electrical wire) triggers:
1. **Forced Priority:** `P1` (pinned red at the top of station and ops queues).
2. **Forced Urgency Floor:** $\ge 80 / 100$.
3. **Audit Explanation:** Logs matched rule ID and keyword snippets.
4. Downstream machine learning classifiers **cannot** demote or lower a safety rule match.
