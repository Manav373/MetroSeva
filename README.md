<p align="center">
  <strong>🚇 COMPLAINT TRIAGE ENGINE</strong><br/>
  <em>PS-07 · Metro Operations · "Every Complaint Heard"</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.11+-blue?logo=python&logoColor=white" alt="Python 3.11+"/>
  <img src="https://img.shields.io/badge/FastAPI-0.109+-009688?logo=fastapi&logoColor=white" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black" alt="React 18"/>
  <img src="https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Kotlin-Jetpack_Compose-7F52FF?logo=kotlin&logoColor=white" alt="Kotlin"/>
  <img src="https://img.shields.io/badge/SQLite-SQLCipher-003B57?logo=sqlite&logoColor=white" alt="SQLite"/>
  <img src="https://img.shields.io/badge/Safety_Recall-≥98%25-red" alt="Safety Recall"/>
  <img src="https://img.shields.io/badge/Offline-72h+-green" alt="72h Offline"/>
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="MIT License"/>
  <a href="https://cte-liard.vercel.app"><img src="https://img.shields.io/badge/Vercel-Live_Deployment-black?logo=vercel&logoColor=white" alt="Vercel Live"/></a>
</p>

> 🚀 **Live Production Deployment:** [https://cte-liard.vercel.app](https://cte-liard.vercel.app)

---

## Table of Contents

- [Overview](#overview)
- [The Problem](#the-problem)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Quick Start (One-Click Demo)](#quick-start-one-click-demo)
  - [Manual Setup](#manual-setup)
- [ML Triage Pipeline](#ml-triage-pipeline)
  - [8-Stage Processing Flow](#8-stage-processing-flow)
  - [Safety Floor Architecture](#safety-floor-architecture)
  - [Department Taxonomy](#department-taxonomy)
  - [Urgency Scoring Formula](#urgency-scoring-formula)
  - [Language Support](#language-support)
- [API Reference](#api-reference)
  - [Complaint Endpoints](#complaint-endpoints)
  - [Dashboard Endpoints](#dashboard-endpoints)
  - [Sync Endpoints](#sync-endpoints)
  - [Bundle Endpoints](#bundle-endpoints)
- [Frontend Dashboard](#frontend-dashboard)
  - [Screens & Components](#screens--components)
  - [Design System](#design-system)
  - [Offline Mode](#offline-mode)
- [Android Station App](#android-station-app)
  - [Architecture](#android-architecture)
  - [Offline Sync Protocol](#offline-sync-protocol)
- [Database Schema](#database-schema)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security & Legal Guardrails](#security--legal-guardrails)
- [Performance Benchmarks](#performance-benchmarks)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The **Complaint Triage Engine (CTE)** is a high-reliability, **offline-first**, AI-powered triage system designed for metro rail operations. It automatically ingests passenger complaints in **4 languages** (Gujarati, Hindi, English, and Gujlish — romanized Gujarati), classifies them across **6 departments**, assigns urgency scores (0–100), enforces an unbreachable **Safety Floor** for life-threatening situations, generates legally compliant draft replies in the complainant's language, and synchronizes via an idempotent offline outbox queue.

Built for station controllers working on underground platforms with **zero or intermittent network connectivity**, the system guarantees **72+ hours of continuous offline operation** with zero data loss.

> **Safety Recall ≥ 98%** — The non-negotiable operational gate. No emergency complaint (fire, gas leak, track intrusion, harassment, trapped passenger) is ever buried below routine issues.

---

## The Problem

| Pain Point | Impact |
|---|---|
| Complaints arrive simultaneously across **4+ disconnected channels** (mobile app, email, social media, paper forms) | Fragmented view, duplicates missed |
| **Multilingual input** in Gujarati, Hindi, English, and informal "Gujlish" with wild phonetic spelling variations | Manual reading errors, misrouting |
| Manual triage takes **hours per 100 complaints** | Critical safety issues get buried |
| Station controllers work **underground** with no internet | Cannot access cloud systems |
| Auto-generated responses risk **legal liability** | Unauthorized refund promises, liability admission |

---

## Key Features

| Feature | Description |
|---|---|
| 🧠 **8-Stage ML Triage Pipeline** | Normalize → Detect Language → Canonicalize Gujlish → Safety Scan → Classify Department → Deduplicate → Score Urgency → Draft Reply |
| 🛡️ **Deterministic Safety Floor** | 9 safety rule categories with multilingual regex. Fires → forced P1, urgency ≥ 80. ML models **cannot** downgrade. |
| 🌐 **4-Language Support** | Native Gujarati (ગુજરાતી), Hindi (हिंदी), English, and Gujlish (romanized Gujarati with phonetic variant canonicalization) |
| 📡 **100% Offline Operation** | Station tablet runs entirely air-gapped with local SQLite, on-device triage, and transactional outbox queue for 72+ hours |
| 🔄 **Idempotent Sync Protocol** | P1-first push ordering, UUID idempotency keys, cursor-based delta pull, duplicate detection |
| 📊 **Real-Time Ops Dashboard** | Live P1 safety banners, KPI telemetry, department queue filters, station hotspot clusters, SLA breach alerts |
| 📝 **Legally Safe Auto-Replies** | Template-based drafts with slot filling ({station}, {ticket_id}). Never auto-sent — controller approval required |
| 🔐 **Signed Bundle Distribution** | Ed25519-signed, SHA-256 hashed rule/lexicon bundles for secure offline updates |
| 📱 **Mobile-First Design** | Phone-native cockpit with 52px touch targets, bottom nav bar, bottom-sheet modals (WCAG compliant) |
| 🔍 **Active Learning Loop** | Every controller override logged as `ReviewEvent` for model retraining ground truth |
| 🔗 **Cross-Channel Deduplication** | SHA-256 hash across normalized text + station + 2h time window detects duplicates across App/Email/Social/Paper |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         METRO CTE ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────┐     ┌──────────────────────────────────────┐  │
│  │   STATION TABLET     │     │       CENTRAL CLOUD SERVICE          │  │
│  │   (Offline-First)    │     │                                      │  │
│  │                      │     │  ┌──────────────┐  ┌──────────────┐  │  │
│  │  ┌────────────────┐  │     │  │  FastAPI      │  │  Ops         │  │  │
│  │  │ On-Device      │  │     │  │  Ingest       │  │  Dashboard   │  │  │
│  │  │ TriagePipeline │  │     │  │  Service      │  │  (React+TS)  │  │  │
│  │  └───────┬────────┘  │     │  └──────┬───────┘  └──────────────┘  │  │
│  │          │           │     │         │                             │  │
│  │  ┌───────▼────────┐  │     │  ┌──────▼───────┐                    │  │
│  │  │ SQLite/        │  │────▶│  │ SQLite /     │                    │  │
│  │  │ SQLCipher      │  │sync │  │ PostgreSQL   │                    │  │
│  │  └───────┬────────┘  │◀────│  └──────────────┘                    │  │
│  │          │           │     │                                      │  │
│  │  ┌───────▼────────┐  │     │  ┌──────────────┐                    │  │
│  │  │ Transactional  │  │     │  │  ML Triage    │                    │  │
│  │  │ Outbox Queue   │  │     │  │  Engine       │                    │  │
│  │  └────────────────┘  │     │  │  (8 Stages)   │                    │  │
│  │                      │     │  └──────────────┘                    │  │
│  │  ┌────────────────┐  │     │                                      │  │
│  │  │ Android App /  │  │     │  ┌──────────────┐                    │  │
│  │  │ Web Terminal   │  │     │  │ Bundle       │                    │  │
│  │  └────────────────┘  │     │  │ Signing      │                    │  │
│  └──────────────────────┘     │  └──────────────┘                    │  │
│                               └──────────────────────────────────────┘  │
│                                                                         │
│  CHANNELS:  📱 App  ·  🐦 Social  ·  📧 Email  ·  📄 Paper (OCR)       │
│  LANGUAGES: ગુજરાતી  ·  हिंदी  ·  English  ·  Gujlish (gu-latn)        │
└─────────────────────────────────────────────────────────────────────────┘
```

The system follows a **three-tier architecture**:

1. **Station Edge App** — Native Android (Kotlin + Jetpack Compose) or standalone Python web server for station tablets. Runs 100% offline with local SQLite/SQLCipher storage, on-device triage pipeline, and transactional outbox queue.

2. **Central Ingest Service** — FastAPI backend that receives multi-channel complaints, executes the ML triage pipeline, serves the ops dashboard, manages sync protocol, and distributes signed rule bundles.

3. **Ops Dashboard** — React + TypeScript web interface for HQ operations monitoring with real-time P1 safety alerts, queue management, analytics, and controller override audit trails.

---

## Tech Stack

### Backend & ML

| Technology | Purpose |
|---|---|
| **Python 3.11+** | Core runtime for ML pipeline and backend services |
| **FastAPI** + **Uvicorn** | High-performance async REST API framework |
| **SQLAlchemy 2.0** | Database ORM (SQLite for development, PostgreSQL for production) |
| **Pydantic v2** | Request/response validation and schema enforcement |
| **Regex + TF-IDF** | Lightweight on-device classification (no GPU required) |
| **Ed25519 + SHA-256** | Cryptographic bundle signing for secure offline distribution |

### Frontend

| Technology | Purpose |
|---|---|
| **React 18** + **TypeScript** | Reactive UI framework with strict typing |
| **Vite 5** | Fast build tool with HMR and API proxy |
| **Lucide React** | Minimalist SVG icon library |
| **CSS Custom Properties** | Dual-theme system (Dark/Light) without framework overhead |
| **Plus Jakarta Sans** + **JetBrains Mono** | UI typography + telemetry monospace |

### Android Station App

| Technology | Purpose |
|---|---|
| **Kotlin** + **Jetpack Compose** | Modern Android UI toolkit |
| **Room** + **SQLCipher** | Encrypted local database |
| **WorkManager** | Background sync with exponential backoff |
| **OkHttp** | HTTP client for sync operations |

### Infrastructure

| Technology | Purpose |
|---|---|
| **Docker** + **Docker Compose** | Container orchestration |
| **SQLite** (dev) / **PostgreSQL 16** (prod) | Data persistence |

---

## Repository Structure

```
cte/
├── ml/                              # 🧠 ML Triage Engine
│   ├── triage_engine/               # Core pipeline modules
│   │   ├── __init__.py
│   │   ├── pipeline.py              # Main orchestrator (8-stage flow)
│   │   ├── normalizer.py            # Unicode NFC, URL/emoji strip, whitespace
│   │   ├── language_detector.py     # Script analysis + Gujlish canonicalization
│   │   ├── safety_engine.py         # 9-category deterministic safety scanner
│   │   ├── classifier.py            # 6-way department classifier (TF-IDF)
│   │   ├── urgency_scorer.py        # Composite scoring (60/25/15 formula)
│   │   ├── deduplicator.py          # Cross-channel SHA-256 dedup + density
│   │   └── reply_engine.py          # Multilingual template reply drafter
│   ├── rules/
│   │   └── safety_rules.json        # 9 safety categories, multilingual regex
│   ├── lexicon/
│   │   └── gujlish_lexicon.json     # 50+ phonetic variant mappings
│   ├── templates/
│   │   └── reply_templates/
│   │       ├── en/templates.json    # English reply templates
│   │       ├── gu/templates.json    # Gujarati reply templates
│   │       └── hi/templates.json    # Hindi reply templates
│   ├── data/
│   │   └── golden_dataset.json      # 87 curated eval test cases
│   ├── eval/
│   │   └── run_eval.py              # Benchmark runner (Safety Recall gate)
│   └── export/
│       ├── sign_bundle.py           # Ed25519 bundle signing
│       └── bundles/                 # Signed release artifacts
│
├── ingest-service/                  # 🌐 Central FastAPI Backend
│   ├── app/
│   │   ├── main.py                  # FastAPI app entry point
│   │   ├── database.py              # SQLAlchemy engine config
│   │   ├── config.py                # Environment configuration
│   │   ├── models/
│   │   │   ├── db_models.py         # Complaint, ReviewEvent, OutboxItem
│   │   │   └── schemas.py           # Pydantic request/response schemas
│   │   ├── routers/
│   │   │   ├── complaints.py        # CRUD + triage + review + approve
│   │   │   ├── dashboard.py         # Queue, stats, hotspots, audit log
│   │   │   ├── sync.py              # Push/pull sync protocol
│   │   │   └── bundles.py           # Signed bundle distribution
│   │   └── services/
│   │       ├── triage_bridge.py     # ML pipeline bridge + fallback engine
│   │       └── sync_service.py      # Idempotent sync business logic
│   ├── requirements.txt             # Python dependencies
│   ├── Dockerfile                   # Container definition
│   └── tests/
│       └── test_api.py              # API integration tests
│
├── dashboard/                       # 📊 Ops Dashboard (React + TS)
│   ├── src/
│   │   ├── App.tsx                  # Root coordinator + state management
│   │   ├── main.tsx                 # React DOM entry point
│   │   ├── index.css                # Dual-theme design system (CSS vars)
│   │   ├── types/
│   │   │   └── index.ts             # Domain type definitions
│   │   ├── services/
│   │   │   ├── api.ts               # API client with offline fallback
│   │   │   ├── offlineStorage.ts    # localStorage + on-device triage
│   │   │   └── mockData.ts          # Seed demo data
│   │   └── components/
│   │       ├── Navbar.tsx           # Navigation + station picker
│   │       ├── SafetyAlertBanner.tsx # P1 emergency alert banner
│   │       ├── KPIGrid.tsx          # Telemetry metrics sidebar
│   │       ├── DepartmentTabs.tsx   # Queue filtering index
│   │       ├── ComplaintCard.tsx     # Complaint display card
│   │       ├── ComplaintDetailModal.tsx # Override + approval modal
│   │       ├── IngestModal.tsx      # Complaint ingestion form
│   │       ├── AnalyticsView.tsx    # Charts + audit trail
│   │       └── Footer.tsx           # Editorial footer
│   ├── package.json
│   ├── vite.config.ts               # Vite + API proxy config
│   └── tsconfig.json
│
├── android-station/                 # 📱 Android Tablet App (Kotlin)
│   ├── app/src/main/java/com/metro/cte/
│   │   ├── data/
│   │   │   ├── AppDatabase.kt       # Room DB with SQLCipher encryption
│   │   │   ├── ComplaintDao.kt      # Priority-ordered complaint queries
│   │   │   ├── ComplaintEntity.kt   # Complaint Room entity
│   │   │   └── OutboxEntity.kt      # Transactional outbox entity
│   │   ├── sync/
│   │   │   └── SyncWorker.kt        # WorkManager coroutine sync worker
│   │   └── ui/
│   │       ├── QueueScreen.kt       # Main triage queue (Compose)
│   │       └── ComplaintDetailScreen.kt # Detail + override screen
│   ├── build.gradle.kts             # Android build config (SDK 34)
│   └── station_simulator.py         # Python simulator for testing
│
├── docs/
│   └── taxonomy.md                  # Department & priority taxonomy
│
├── infra/
│   ├── Dockerfile                   # Production container
│   ├── docker-compose.yml           # Container orchestration
│   └── seed_data.py                 # 22+ multilingual test complaints
│
├── station_app.py                   # Standalone offline station terminal
├── run_demo.py                      # One-click demo launcher
├── test_all_functions.py            # 43-function comprehensive test suite
├── test_e2e_sync.py                 # End-to-end sync integration tests
├── test_offline_app.py              # Offline station app verification
└── README.md                        # ← You are here
```

---

## Getting Started

### Prerequisites

- **Python 3.11+** — Core runtime
- **Node.js 18+** (optional) — For frontend development with Vite HMR
- **Android Studio** (optional) — For native Android app development

### Quick Start (One-Click Demo)

```bash
# Clone the repository
git clone https://github.com/your-username/metro-cte.git
cd metro-cte/cte

# Install Python dependencies
pip install -r ingest-service/requirements.txt

# Launch everything (backend + dashboard)
python run_demo.py
```

This will:
1. Start the FastAPI server on **port 8000**
2. Open the **Ops Dashboard** at `http://localhost:8000/dashboard/`
3. The **Swagger API docs** are available at `http://localhost:8000/docs`

### Manual Setup

#### 1. Run the ML Evaluation Suite

Verify the triage engine meets safety and accuracy benchmarks:

```bash
python ml/eval/run_eval.py
```

**Expected Output:**
```
╔══════════════════════════════════════╗
║    TRIAGE ENGINE EVALUATION REPORT  ║
╠══════════════════════════════════════╣
║  Safety Recall:    100.0%  ✅ PASS  ║  (Gate: ≥ 98%)
║  Dept Accuracy:     92.1%  ✅ PASS  ║  (Gate: ≥ 85%)
║  Avg Latency:      ~3.7ms  ✅ PASS  ║  (Budget: < 300ms)
╚══════════════════════════════════════╝
```

#### 2. Start the Ingest Backend + Dashboard

```bash
cd ingest-service
uvicorn app.main:app --reload --port 8000
```

| URL | Description |
|---|---|
| `http://localhost:8000/dashboard` | Ops Dashboard |
| `http://localhost:8000/docs` | Swagger API Documentation |
| `http://localhost:8000/health` | Health Check |

#### 3. Start the Offline Station Terminal

Run a fully air-gapped station controller terminal (zero external dependencies):

```bash
python station_app.py
```

Open `http://localhost:8080` — operates 100% offline with local SQLite storage.

#### 4. Seed Test Data

Populate the database with 22+ realistic multilingual complaints:

```bash
python infra/seed_data.py
```

#### 5. Frontend Development (with HMR)

```bash
cd dashboard
npm install
npm run dev
```

Vite dev server runs on `http://localhost:5173` and proxies `/v1` API calls to the FastAPI backend.

---

## ML Triage Pipeline

### 8-Stage Processing Flow

```
                           [ Raw Complaint Input ]
            (raw_text, station_id, channel, optional image_ref)
                                    │
                                    ▼
               ┌─── Stage 1: TEXT NORMALIZATION ───┐
               │  • Unicode NFC normalization       │
               │  • URL → [link:<domain>]           │
               │  • Emoji & symbol stripping         │
               │  • Whitespace compaction            │
               └──────────────┬─────────────────────┘
                              │
                              ▼
               ┌─── Stage 2: LANGUAGE DETECTION ───┐
               │  • Unicode block analysis           │
               │    (Gujarati gu / Devanagari hi)    │
               │  • Gujlish marker word density      │
               │  • Output: lang + script            │
               └──────────────┬─────────────────────┘
                              │
                              ▼
               ┌─── Stage 3: GUJLISH CANONICALIZATION ─┐
               │  • 50+ phonetic variant mappings       │
               │  • "bndh" → "band"                     │
               │  • "kachra" → "kachro"                 │
               │  • "paise" → "paisa"                   │
               └──────────────┬────────────────────────┘
                              │
                              ▼
           ┌─── Stage 4: SAFETY RULE EVALUATION ───────┐
           │  • 9 categories × multilingual regex       │
           │  • If MATCH → is_safety=True               │
           │  • FORCED: priority="P1", urgency ≥ 80     │
           │  • ML models CANNOT downgrade this         │
           └──────────────┬────────────────────────────┘
                          │
                          ▼
           ┌─── Stage 5: DEPARTMENT CLASSIFICATION ────┐
           │  • 6-way weighted token matching           │
           │  • Softmax probability distribution        │
           │  • Primary + optional secondary dept       │
           │  • Confidence < 0.60 → REVIEW queue        │
           │  • Safety override if Stage 4 fired        │
           └──────────────┬────────────────────────────┘
                          │
                          ▼
           ┌─── Stage 6: CROSS-CHANNEL DEDUPLICATION ──┐
           │  • SHA-256(tokens + station + 2h window)   │
           │  • Detects duplicates across App/Social/   │
           │    Email/Paper channels                    │
           │  • Tracks station complaint density        │
           └──────────────┬────────────────────────────┘
                          │
                          ▼
           ┌─── Stage 7: URGENCY & PRIORITY SCORING ───┐
           │  • Composite: 60% Rules + 25% Dept +      │
           │    15% Repeat-Location Boost               │
           │  • P1 (≥80) · P2 (≥50) · P3 (<50)        │
           │  • REVIEW if low confidence + non-safety   │
           │  • Safety Floor enforces P1 ≥ 80           │
           └──────────────┬────────────────────────────┘
                          │
                          ▼
           ┌─── Stage 8: MULTILINGUAL REPLY DRAFTING ──┐
           │  • Template lookup: dept × priority × lang │
           │  • Slot fill: {station}, {ticket_id}       │
           │  • gu-latn routes to gu templates          │
           │  • Fallback chain → English                │
           │  • Legal guardrails enforced               │
           └──────────────┬────────────────────────────┘
                          │
                          ▼
                [ Triage Output Record ]
      (dept_primary, dept_secondary, dept_conf, urgency,
       priority, safety_hits, dedupe_key, reply_draft,
       reply_lang, explanation)
```

### Safety Floor Architecture

The **Safety Floor** is the cornerstone design principle: deterministic regex rules that can **never** be overridden by statistical ML classifiers.

**9 Safety Rule Categories:**

| Rule ID | Category | Severity | Example Patterns |
|---|---|---|---|
| `SAFE_FIRE_SMOKE` | Fire / Smoke | 98 | fire, smoke, आग, ધુમાડો, aag, dhua |
| `SAFE_GAS_LEAK` | Gas Leak | 95 | gas leak, ગૂંગળામણ, गैस लीक |
| `SAFE_TRACK_INTRUSION` | Track Intrusion | 100 | tracks, fell, पटरी, પાટા, patari |
| `SAFE_TRAPPED_PERSON` | Trapped Person | 92 | trapped, stuck, ફસાયા, फंस गया |
| `SAFE_INJURY_MEDICAL` | Injury / Medical | 94 | bleeding, fainted, બેભાન, बेहोश |
| `SAFE_HARASSMENT_VIOLENCE` | Harassment | 90 | assault, molest, છેડતી, छेड़छाड़ |
| `SAFE_CHILD_ALONE` | Lost Child | 88 | lost child, બાળક ખોવાયું, बच्चा खो गया |
| `SAFE_ELECTRICAL_HAZARD` | Electrical | 86 | live wire, shock, કરંટ, बिजली |
| `SAFE_SUSPICIOUS_OBJECT` | Suspicious Object | 90 | unattended bag, લાવારિસ, संदिग्ध |

**When any rule fires:**
1. **Priority** → forced to `P1` (pinned to top of all queues)
2. **Urgency** → forced to `≥ 80` out of 100
3. **Department** → forced to `safety`
4. **Audit** → matched rule ID and trigger words logged for accountability
5. **ML Override** → downstream classifiers **cannot** demote or lower the score

### Department Taxonomy

| Department | Code | SLA (P2) | Description |
|---|---|---|---|
| 🛡️ Safety & Security | `safety` | 15 min (P1) | Fire, gas, track intrusion, harassment, medical |
| 🧹 Cleanliness & Hygiene | `cleanliness` | 4 hours | Dirty platforms, trash, pest issues, odors |
| 💰 Ticketing & Fare | `fare` | 4 hours | Smart card errors, double billing, gate failures |
| 🛗 Lifts & Escalators | `lifts_escalators` | 4 hours | Broken lifts, stuck escalators, accessibility |
| 👤 Staff Behaviour | `staff_behaviour` | 4 hours | Rude staff, absent controller, misconduct |
| 📋 General / Other | `other` | 24 hours | Announcements, AC, signage, lost & found |

**Priority Levels:**

| Priority | Urgency Range | SLA | Visual Treatment |
|---|---|---|---|
| **P1** | 80–100 | 15 minutes | 🔴 Red banner, pinned to top, pulsing alert |
| **P2** | 50–79 | 4 hours | 🟠 Orange badge |
| **P3** | 25–49 | 24 hours | 🟢 Green badge |
| **REVIEW** | <25 or low confidence | Manual review | ⚪ Gray badge, human triage required |

### Urgency Scoring Formula

```
urgency = (0.60 × rules_score) + (0.25 × dept_severity) + (0.15 × repeat_boost)
```

| Component | Weight | Source |
|---|---|---|
| `rules_score` | 60% | 100 if safety rules fired, else 0 |
| `dept_severity` | 25% | Base severity by department (safety=90, lifts=60, staff=45, fare=40, cleanliness=35, other=30) |
| `repeat_boost` | 15% | Same station complaint count in 2h window (1 extra → 45pts, 2 → 75pts, 3+ → 100pts) |

### Language Support

| Code | Language | Script | Detection Method |
|---|---|---|---|
| `gu` | Gujarati | ગુજરાતી (Unicode) | Unicode block `U+0A80–U+0AFF` frequency > 30% |
| `hi` | Hindi | देवनागरी (Devanagari) | Unicode block `U+0900–U+097F` frequency > 30% |
| `en` | English | Latin | Default Latin script without Gujlish markers |
| `gu-latn` | Gujlish | Latin (romanized) | Gujlish lexical markers: "chhe", "nathi", "karo", "paisa", etc. |

**Gujlish Canonicalization Examples:**

| Input Variants | Canonical Form |
|---|---|
| `bandh`, `bnd`, `bndh`, `bandhe` | `band` |
| `che`, `chhey`, `chey` | `chhe` |
| `bighadi`, `bigadi`, `bagdi` | `kharab` |
| `paise`, `rupiya`, `rupee` | `paisa` |
| `safayee`, `saaf` | `safai` |
| `kachra`, `kachdo` | `kachro` |

---

## API Reference

Base URL: `http://localhost:8000/v1`

### Complaint Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/complaints` | Ingest single complaint → auto-triage → store |
| `POST` | `/v1/complaints/bulk` | Batch ingest (social dumps, email, paper OCR) |
| `GET` | `/v1/complaints/{id}` | Get complaint by ID |
| `POST` | `/v1/complaints/{id}/review` | Controller field override (logs `ReviewEvent`) |
| `POST` | `/v1/complaints/{id}/approve` | Approve draft reply for dispatch |

**Example — Ingest a complaint:**
```bash
curl -X POST http://localhost:8000/v1/complaints \
  -H "Content-Type: application/json" \
  -d '{
    "raw_text": "Platform 2 par track par manas padi gayo chhe, bahuj khatarnak",
    "station_id": "STN_PALDI",
    "channel": "app"
  }'
```

**Response:**
```json
{
  "id": "a1b2c3d4-...",
  "station_id": "STN_PALDI",
  "channel": "app",
  "raw_text": "Platform 2 par track par manas padi gayo chhe...",
  "normalised": "platform 2 par track par manas padi gayo chhe...",
  "lang": "gu-latn",
  "dept_primary": "safety",
  "dept_secondary": null,
  "dept_conf": 0.95,
  "urgency": 95,
  "priority": "P1",
  "safety_hits": [{"rule_id": "SAFE_TRACK_INTRUSION", "matched": "track"}],
  "reply_draft": "પ્રિય મુસાફર, STN_PALDI ખાતે સુરક્ષા અંગેનો આપનો અહેવાલ...",
  "reply_lang": "gu",
  "reply_status": "draft",
  "dedupe_key": "a3f2b1c9e8d7..."
}
```

### Dashboard Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/v1/dashboard/queue` | Filtered queue (station, dept, priority, channel, search) |
| `GET` | `/v1/dashboard/stats` | Live KPIs: P1/P2/P3 counts, SLA breaches, distributions |
| `GET` | `/v1/dashboard/hotspots` | Top 10 complaint stations |
| `GET` | `/v1/dashboard/reviews` | Controller override audit trail |

**Queue sorting:** P1 → P2 → REVIEW → P3, then by urgency descending.

### Sync Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/sync/push` | Receive station outbox items (P1-first, idempotent) |
| `GET` | `/v1/sync/pull?since=<cursor>` | Delta pull: complaints updated since cursor |

### Bundle Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/v1/bundles/latest` | Signed bundle manifest (version, SHA-256, Ed25519 sig) |
| `GET` | `/v1/bundles/download/safety_rules` | Download safety rules JSON |
| `GET` | `/v1/bundles/download/gujlish_lexicon` | Download Gujlish lexicon JSON |

---

## Frontend Dashboard

### Screens & Components

| Component | Description |
|---|---|
| **Safety Alert Banner** | Pulsing red emergency banner for active P1 items. Shows triggered rule IDs and "INSPECT" button to auto-scroll to the complaint. |
| **KPI Grid** | 2×2 telemetry: P1 Safety count, Active Queue, SLA Breaches (P1 > 15min), Outbox Pending. Plus hotspot clusters. |
| **Department Tabs** | Indexed filter sidebar (Safety, Cleanliness, Fare, Lifts, Staff, Other) with live count badges. |
| **Complaint Card** | Priority badge, urgency gauge (0-100), raw text, Gujlish normalization toggle, safety rule pills, draft reply preview, approve/override buttons. |
| **Detail Modal** | Full review: department/priority override, draft response editor, legal disclaimer, audit logging. |
| **Ingest Modal** | Complaint submission form with pre-loaded multilingual test scenarios. |
| **Analytics View** | Department/language/channel distribution charts + controller override audit trail table. |
| **Navbar** | Station picker, online/offline toggle, outbox sync button, theme switcher. |

### Design System

The dashboard follows a **Nothin' Paris**-inspired editorial aesthetic:

| Property | Dark Mode | Light Mode |
|---|---|---|
| Background | `#080808` (jet black) | `#f4f5f7` (off-white) |
| Surface | `#121212` | `#ffffff` |
| Borders | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.08)` |
| Typography | White | `#111827` (charcoal) |

**Signal Colors:**
- 🔴 **Red** (`#ff3333`) — P1 safety, emergencies
- 🟠 **Amber** (`#f59e0b`) — P2, SLA warnings, offline
- 🟢 **Green** (`#22c55e`) — Online, approved, P3
- 🔵 **Blue** (`#38bdf8`) — Gujlish normalization links

**Mobile Cockpit:**
- 52px full-width touch buttons (WCAG 44×44 compliant)
- Bottom navigation bar with center FAB (+Ingest)
- Bottom-sheet station picker drawer
- Horizontally scrollable department chips
- 18px complaint text for readability

### Offline Mode

The dashboard operates in two modes:

| Mode | Behavior |
|---|---|
| **Online** | Direct REST calls to FastAPI `/v1` endpoints. 8-second polling interval. |
| **Offline** | Falls back to `localStorage` cache. Client-side regex triage engine mirrors the Python safety rules. All mutations queued in transactional outbox with UUID idempotency keys. |

**Sync Flow:**
1. Controller toggles to Online → clicks "Sync Outbox"
2. Outbox items pushed to `POST /v1/sync/push` (P1 items first)
3. Server processes idempotently, returns accepted/duplicate/conflict status
4. Client pulls updates via `GET /v1/sync/pull?since=<cursor>`
5. Local cache refreshed with server-authoritative data

---

## Android Station App

### Android Architecture

```
com.metro.cte/
├── data/
│   ├── AppDatabase.kt          # Room DB + SQLCipher encryption
│   ├── ComplaintDao.kt          # P1-first ordered queries
│   ├── ComplaintEntity.kt       # Full complaint lifecycle entity
│   └── OutboxEntity.kt          # Transactional outbox with idempotency
├── sync/
│   └── SyncWorker.kt            # WorkManager coroutine worker
└── ui/
    ├── QueueScreen.kt           # Compose triage queue
    └── ComplaintDetailScreen.kt  # Detail + override + approve
```

**Key Features:**
- **SQLCipher Encryption**: All complaint data encrypted at rest
- **Room DAO**: Queries auto-sorted by priority (P1 = 0 → top) then urgency descending
- **Atomic Transactions**: `@Transaction saveTriageWithOutbox()` ensures complaint + outbox entry committed atomically
- **Min SDK 26**, Target SDK 34

### Offline Sync Protocol

```
Station Tablet (Offline)              Central Cloud (Online)
        │                                      │
        │  1. Complaints triaged locally       │
        │  2. Outbox queue accumulates         │
        │                                      │
        │  ══ Network Reconnects ══            │
        │                                      │
        │  3. P1 items pushed FIRST            │
        ├─────POST /v1/sync/push──────────────▶│
        │     (idempotency keys)               │
        │                                      │  4. Server deduplicates
        │◀────accepted/duplicate/conflict──────┤  5. Server triages new items
        │                                      │
        │  6. Pull delta updates               │
        ├─────GET /v1/sync/pull?since=cursor──▶│
        │                                      │
        │◀────updated complaints + cursor──────┤
        │                                      │
        │  7. Local DB synced                  │
        │                                      │
```

**WorkManager Configuration:**
- Periodic sync every 15 minutes (when `NetworkType.CONNECTED`)
- Exponential backoff on failure (up to 5 retries)
- P1 items always pushed before P2/P3

---

## Database Schema

### Complaint Table

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Unique complaint identifier |
| `station_id` | String (indexed) | Metro station code (e.g., `STN_PALDI`) |
| `channel` | Enum | `app` \| `social` \| `email` \| `paper` |
| `raw_text` | Text | Original unmodified complaint text |
| `normalised` | Text | Cleaned text after pipeline Stage 1-3 |
| `lang` | String | Detected language: `gu` \| `hi` \| `en` \| `gu-latn` |
| `dept_primary` | String (indexed) | Primary department classification |
| `dept_secondary` | String (nullable) | Secondary department (dual-issue complaints) |
| `dept_conf` | Float | Classification confidence (0.0–1.0) |
| `urgency` | Integer | Urgency score (0–100) |
| `priority` | Enum | `P1` \| `P2` \| `P3` \| `REVIEW` |
| `safety_hits` | JSON | List of matched safety rule objects |
| `reply_draft` | Text | Auto-generated response in complainant's language |
| `reply_lang` | String | Language of the draft reply |
| `reply_status` | Enum | `draft` \| `approved` \| `sent` |
| `dedupe_key` | String | SHA-256 deduplication hash |
| `duplicate_of` | String (nullable) | ID of original complaint if duplicate |
| `model_version` | String | Pipeline version used for triage |
| `sync_state` | Enum | `local` \| `pending` \| `synced` |
| `created_at` | DateTime | Ingestion timestamp |
| `updated_at` | DateTime | Last modification timestamp |

### ReviewEvent Table (Immutable Audit Log)

| Column | Type | Description |
|---|---|---|
| `id` | Integer (PK) | Auto-increment ID |
| `complaint_id` | String (FK) | Reference to complaint |
| `actor` | String | Controller/supervisor who made the change |
| `field` | String | Field modified (e.g., `dept_primary`, `priority`) |
| `old_value` | String | Original value before override |
| `new_value` | String | New value after override |
| `at` | DateTime | Timestamp of the override |

### OutboxItem Table (Sync Tracking)

| Column | Type | Description |
|---|---|---|
| `id` | Integer (PK) | Auto-increment ID |
| `client_uuid` | String | Client device UUID |
| `idempotency_key` | String (unique) | Prevents duplicate processing on replay |
| `op_type` | Enum | `CREATE_COMPLAINT` \| `REVIEW_COMPLAINT` \| `APPROVE_REPLY` |
| `payload` | JSON | Operation payload |
| `synced` | Boolean | Whether successfully pushed to server |

---

## Testing

### Test Suite Overview

| Test File | Tests | Coverage Area |
|---|---|---|
| `test_all_functions.py` | 43 tests / 13 suites | Exhaustive unit + integration tests |
| `test_e2e_sync.py` | E2E sync | Offline → push → pull → consistency |
| `test_offline_app.py` | Station terminal | Air-gapped HTML, zero CDN, API endpoints |

### Running Tests

```bash
# Comprehensive 43-test suite (ML pipeline + API + database)
python test_all_functions.py

# End-to-end sync: offline tablet → cloud push → dashboard
python test_e2e_sync.py

# Offline station terminal verification
python test_offline_app.py

# ML benchmark evaluation (Safety Recall gate)
python ml/eval/run_eval.py
```

### Test Coverage Areas

1. **Normalizer** — URL tokenization, emoji stripping, whitespace normalization
2. **Language Detector** — Gujarati, Hindi, English, Gujlish detection + canonicalization
3. **Safety Engine** — All 9 categories across all 4 languages
4. **Classifier** — Single-issue and multi-department classification
5. **Urgency Scorer** — Safety floor enforcement, repeat-location boost
6. **Deduplicator** — Hash stability, time window bucketing, duplicate linking
7. **Reply Engine** — Multilingual template generation, slot interpolation
8. **Full Pipeline** — End-to-end raw text → triage output
9. **Bundle Signer** — SHA-256 generation, Ed25519 cryptographic signing
10. **Golden Dataset** — Safety Recall ≥ 98% gate
11. **Database** — CRUD, filtering, idempotency, audit trails
12. **API Endpoints** — All REST endpoints + error cases
13. **Station Simulator** — Offline ingest, queue sorting, approvals

---

## Deployment

### Docker

```bash
cd infra

# Build and run
docker-compose up --build

# Or build manually
docker build -t metro-cte .
docker run -p 8000:8000 metro-cte
```

**Docker Compose Configuration:**
- Service: `metro_cte_ingest`
- Port: `8000:8000`
- Database: SQLite (mounted volume) or PostgreSQL via `DATABASE_URL`
- Restart: `unless-stopped`

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./metro_cte.db` | Database connection string |
| `PORT` | `8000` | Server port |

---

## Security & Legal Guardrails

### Data Privacy
- **PII Masking**: Passenger phone numbers and names masked in logs and general dashboard views
- **SQLCipher Encryption**: All data encrypted at rest on station tablets
- **90-Day Retention**: Local device complaints auto-purged after 90 days
- **No Third-Party Analytics**: Zero tracker SDKs on station devices

### Legal Constraints (TRD 5.4)
- ⚖️ **No Auto-Dispatch**: Replies are **never** sent to passengers without explicit controller approval
- ⚖️ **No Liability Admission**: Templates never admit fault, promise refunds, or commit to repair timelines
- ⚖️ **No Financial Commitments**: Automated messages cannot authorize compensation
- ⚖️ **Audit Trail**: Every human override creates an immutable `ReviewEvent` record

### Cryptographic Security
- **Ed25519 Signatures**: Rule and model bundles are digitally signed
- **SHA-256 Digests**: File integrity verification for offline updates
- **Idempotency Keys**: UUID-based replay protection for sync operations

---

## Performance Benchmarks

| Metric | Target | Achieved | Status |
|---|---|---|---|
| **Safety Recall** | ≥ 98% | **100.0%** | ✅ PASS |
| **Department Accuracy** | ≥ 85% | **92.1%** | ✅ PASS |
| **Classification Latency** | < 300ms / complaint | **~3.7ms** | ✅ PASS |
| **Batch Processing** | < 40s / 100 complaints | **< 1s** | ✅ PASS |
| **Offline Operation** | 72+ hours | **72+ hours** | ✅ PASS |
| **App Package Size** | 250–350 MB | **Within budget** | ✅ PASS |

---

## Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feat/your-feature`)
3. **Run tests** before committing:
   ```bash
   python test_all_functions.py
   python ml/eval/run_eval.py
   ```
4. **Ensure** Safety Recall ≥ 98% passes (this is a CI gate)
5. **Submit** a pull request

### Development Guidelines
- All safety rules changes must pass the golden dataset evaluation
- Controller override audit trails must never be deleted or modified
- Reply templates must be reviewed for legal compliance before merging
- Offline functionality must be tested with `test_offline_app.py`

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <em>"Safety precedes speed. Clarity precedes automation."</em><br/>
  <strong>Metro CTE · PS-07 · Every Complaint Heard</strong>
</p>
