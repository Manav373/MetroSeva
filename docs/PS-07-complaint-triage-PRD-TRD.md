# PS-07 · Metro Complaint Triage: PRD, TRD, Workflow and Build Setup

---

## Part 1. Understanding the problem

**Who is hurt today**
- Passengers whose complaints arrive by app, social media, email or paper, in Gujarati, Hindi, English or Gujlish (Gujarati written in Latin script, mixed with English and Hindi).
- Station controllers and the customer care team, who sort everything by hand. It takes hours.
- Operations, because urgent items (a smell of gas, a broken escalator with a child on it, harassment) sit in the same pile as "the tea stall is dirty".

**What goes wrong**
1. Volume and channel fragmentation. The same complaint can arrive three times, through app, Twitter and email.
2. Language. Sorting depends on whoever can read the language. Gujlish is spelled inconsistently ("lift bandh chhe", "lift band che", "LIFT BAND").
3. Urgency is buried. A safety report and a fare query look alike in the queue.
4. Offline stations. A controller on a platform with no network cannot wait for a cloud service.

**What "done" looks like**
A mixed batch goes in, and out come department queues (safety, cleanliness, fare, lifts, staff behaviour), each item with an urgency score and a draft reply in the complainant's language. This works with no network. When the network returns, everything syncs.

---

## Part 2. Workflow (plain English)

```
 Channel in          Normalise           Understand            Route & score        Respond           Sync
 ───────────         ──────────          ──────────            ─────────────        ───────           ────
 App (JSON)    ─┐
 Social (export)─┤    Detect script      Language ID           Department           Draft reply       Outbox
 Email (.eml)  ──┼──► Transliterate  ──► Gujlish normalise ──► Urgency score   ──► (template or      queue
 Paper (photo) ─┘    Strip noise         Safety keyword scan   Safety floor         on-device LLM)     │
                     Dedupe (hash)       Department classify   Human review flag                     ▼
                                                                                              Upload when online
```

Step by step, as a controller sees it:
1. Controller opens the app at a station. A batch of 40 complaints is already on the device from the morning sync.
2. Paper forms are photographed. On-device OCR reads them into the same batch.
3. The tool shows the list sorted by urgency, with department tabs.
4. P1 (safety) items are pinned to the top and flagged red. They cannot be dismissed without a note.
5. The controller reviews the draft reply, edits if needed, and approves. Replies go out in the complainant's language.
6. Actions are saved locally. When connectivity returns, the outbox uploads and the central system merges.

---

## Part 3. What we build

**Product name (working):** Complaint Triage Engine (CTE)

Three parts:

| Part | Where it runs | What it does |
|---|---|---|
| **Station app** | Android tablets / phones at stations | Offline triage, review, approve replies, sync |
| **Ingest service** | Cloud (metro data centre or cloud region) | Receives app, email, social exports; holds the master record; pushes model and rule updates |
| **Ops dashboard** | Web, head office | Cross-station view, trends, SLA tracking, model/rule audit |

Core features, by priority:

- **P0 (must have for the demo):** multilingual ingest of text, offline classification into 5 departments, urgency score with safety floor, draft replies in 3 languages, offline queue with sync.
- **P1:** paper form OCR (Gujarati + Hindi + English), duplicate detection across channels, reviewer feedback loop (controller corrects a label, it is logged for retraining).
- **P2:** on-device LLM for free-form reply drafting, trend dashboard, SLA alerts.

Out of scope for v1: voice complaints, automatic replies sent without human approval, compensation decisions, direct social-media posting.

---

## Part 4. PRD (Product Requirements)

### 4.1 Goals
- Cut manual triage time from hours to under 15 minutes per 100 complaints.
- Zero P1 (safety) items sitting below P3 in the queue.
- Works fully offline for at least 72 hours of station operation.

### 4.2 Users
| Persona | Need |
|---|---|
| Station controller | Fast, offline, clear priority list, one-tap reply approval |
| Customer care agent (head office) | Full queue across channels, dedupe, reply editing |
| Safety officer | Immediate view of all P1 items across all stations |
| Ops manager | Department trends, SLA breaches, model accuracy |

### 4.3 Functional requirements

**FR-1 Ingest**
- FR-1.1 Accept app submissions (JSON via API).
- FR-1.2 Accept email (.eml or forwarding address) and parse body and attachments.
- FR-1.3 Accept social exports (CSV/JSON from the social team, or platform API where permitted).
- FR-1.4 Accept paper forms as photos; OCR runs on-device.
- FR-1.5 Each complaint gets a stable ID, channel, received time, station, and raw text kept unchanged.

**FR-2 Language**
- FR-2.1 Detect script (Gujarati, Devanagari, Latin) and language (gu, hi, en, Gujlish).
- FR-2.2 Normalise Gujlish with a lexicon of common variant spellings mapped to canonical forms.
- FR-2.3 Reply language defaults to the complainant's language; falls back to English if unclear, and the controller is told.

**FR-3 Department classification**
- FR-3.1 Assign one primary department: Safety, Cleanliness, Fare, Lifts/Escalators, Staff Behaviour, Other.
- FR-3.2 Allow a secondary department (e.g. "lift broken AND staff ignored it").
- FR-3.3 Confidence below threshold goes to "Needs review" and is never silently assigned.

**FR-4 Urgency**
- FR-4.1 Score 0–100 mapped to P1 (safety-critical, ≥80), P2 (service-impacting, 50–79), P3 (routine, <50).
- FR-4.2 **Safety floor:** any safety keyword or pattern (fire, smoke, gas, fall, track, injured, harassment, unconscious, child alone, and Gujarati/Hindi/Gujlish equivalents) forces P1, regardless of model score.
- FR-4.3 Score explanation: the UI shows which words or rules raised the score.
- FR-4.4 Repeat-location boost: multiple complaints about the same lift or platform in 2 hours raise urgency.

**FR-5 Draft replies**
- FR-5.1 Template reply per department × urgency × language, with slots for station, ticket ID, and expected action.
- FR-5.2 Replies never admit liability, promise compensation, or give a time commitment unless the controller fills it in.
- FR-5.3 Optional on-device LLM polish, only on devices that pass the capability check (FR-8.4).
- FR-5.4 No reply is sent without controller approval.

**FR-6 Review and feedback**
- FR-6.1 Controller can change department, urgency, and reply.
- FR-6.2 Every change is logged as a labelled example for later retraining.

**FR-7 Offline and sync**
- FR-7.1 Full triage, review, approval and OCR work with no network.
- FR-7.2 All actions write to a local outbox first.
- FR-7.3 On reconnect, the outbox uploads in order; the server confirms each item.
- FR-7.4 Conflicts (two controllers edit the same item) resolved by: server keeps all versions, the latest human action is shown, the earlier one is kept in history.
- FR-7.5 Safety items sync first, ahead of routine items.

**FR-8 Device**
- FR-8.1 Local data encrypted at rest.
- FR-8.2 Runs on mid-range Android tablet (4 GB RAM, 2019 or later).
- FR-8.3 Model and rule bundles versioned; the app shows which version each decision used.
- FR-8.4 Capability check on first launch decides whether the LLM polish is enabled.

**FR-9 Dashboard**
- FR-9.1 Cross-station queue, filter by department, urgency, station, channel, date.
- FR-9.2 Safety officer alert on any P1 item, within 60 seconds of ingest when online.
- FR-9.3 Accuracy view: controller corrections per department per week.

### 4.4 Non-functional requirements
| Area | Target |
|---|---|
| Offline duration | 72 hours normal use, no data loss |
| Classification latency (on device) | < 300 ms per complaint, text |
| OCR latency | < 3 s per form photo |
| Sync | Full outbox of 500 items in < 2 min on 4G |
| Privacy | Passenger phone numbers and names masked in logs; retained 90 days on device, then purged |
| Accessibility | Font scaling; high-contrast P1 colour; works in all three scripts |
| Availability (cloud) | 99.5% |

### 4.5 Success metrics
- Department accuracy ≥ 85% on held-out set (overall), ≥ 90% on Safety class recall.
- **Safety recall ≥ 98%** (this is the metric that matters most; missing a P1 is the worst failure).
- Median triage time per 100 complaints under 15 minutes.
- Controller override rate under 20% after month 2.

### 4.6 Out of scope (v1)
Voice complaints, auto-send replies, compensation logic, social posting, passenger-facing chatbot.

### 4.7 Risks (summary; see Part 6 for detail)
Gujarati handwriting OCR, lack of labelled data, low-end device limits, sync conflicts, legal wording of replies.

---

## Part 5. TRD (Technical Requirements and Design)

### 5.1 Architecture

```
            ┌────────────────────── Cloud ──────────────────────┐
 App ───┐   │  Ingest API ──► Postgres ◄── Ops Dashboard (web)  │
 Email ─┼──►│     │                ▲                            │
 Social ┘   │     ▼                │ sync (push/pull)           │
            │  Object store (paper scans)   Model/rule registry │
            └──────────────────┬───────────────────▲────────────┘
                               │ sync              │ bundle updates
            ┌──────────────────▼───────────────────┴────────────┐
            │              Station device (Android)              │
            │  UI ─► Triage service ─► Local SQLite (encrypted)  │
            │          ├─ Normaliser (lexicon)                   │
            │          ├─ Rule engine (safety floor, keywords)   │
            │          ├─ Classifier (TFLite, quantised)         │
            │          ├─ OCR (on-device, gu/hi/en)              │
            │          ├─ Template engine (replies)              │
            │          └─ Optional LLM polish (if capable)       │
            │  Outbox queue ─► Sync worker                       │
            └────────────────────────────────────────────────────┘
```

### 5.2 Components and choices

| Component | Choice | Reason |
|---|---|---|
| Station app | Kotlin + Jetpack Compose (native Android) | Reliable offline, good OCR/TFLite integration, tablet support |
| Local DB | SQLite via Room, encrypted with SQLCipher | Offline-first, encrypted |
| Language ID | fastText lid model (176 languages, ~1 MB quantised) plus script heuristics | Small, fast; script check catches Gujlish |
| Normaliser | Custom Gujlish lexicon (JSON, versioned) + Unicode normalisation (NFC) | Gujlish has no standard spelling; rules beat models here |
| Safety rules | Regex/keyword rule engine, versioned bundle | Auditable, cannot be overridden by the model |
| Classifier | Multilingual small encoder (e.g. multilingual-e5-small or LaBSE-distilled), fine-tuned head, exported to TFLite with int8 quantisation | Handles cross-lingual text; ~100 MB or less |
| Fallback classifier | TF-IDF character n-gram + linear model (~2 MB) | Runs on the weakest tablet; also a sanity check |
| OCR | ML Kit Text Recognition (Devanagari for Hindi; Latin for English); Gujarati via Tesseract 5 `guj` traineddata, bundled | ML Kit has no Gujarati; Tesseract covers it |
| Reply engine | Templates (JSON) by dept × urgency × language; optional quantised small LLM (≈1B params, int4) | Templates are reliable offline; LLM is an enhancement |
| Sync | Outbox pattern, WorkManager for retries, idempotency keys | Simple and robust on flaky networks |
| Backend | Python FastAPI, Postgres, S3-compatible object store | Fast to build; good ML tooling |
| Model registry | MLflow or a simple versioned bucket with manifest | Pins which model answered which complaint |
| Dashboard | React + TypeScript | Standard, easy hiring |
| Auth | Station-level device certificates + staff SSO | Offline login via cached, time-limited token |

### 5.3 Data model (core tables, device and server share the shape)

```
complaint
  id            uuid (client-generated, idempotent)
  channel       enum(app, email, social, paper)
  station_id    string
  received_at   timestamp
  raw_text      text            -- never modified
  raw_image_ref string nullable -- paper scan
  lang_detected string
  normalised    text
  dept_primary  enum
  dept_secondary enum nullable
  dept_conf     float
  urgency       int 0..100
  priority      enum(P1,P2,P3,REVIEW)
  safety_hits   json            -- which rules fired
  reply_lang    string
  reply_draft   text
  reply_status  enum(draft, approved, sent)
  dedupe_key    string           -- hash of normalised text + station + 2h window
  model_version string
  rule_version  string
  updated_at    timestamp
  sync_state    enum(local, pending, synced)

review_event
  id, complaint_id, actor, field, old_value, new_value, at

outbox
  id, op_type, payload json, created_at, attempts, last_error
```

### 5.4 Triage pipeline (per complaint, on device)

1. Normalise: NFC, strip emoji and URLs (keep the URL domain only), keep the raw text.
2. Script detection: count Gujarati, Devanagari, Latin code points.
3. Language ID with script override: Latin script plus Gujlish lexicon hits → `gu-latn` (Gujlish).
4. Lexicon normalise: map variant spellings to canonical tokens.
5. Safety rules run first. Any hit sets `priority = P1` and `urgency ≥ 80`. The classifier cannot lower it.
6. Department classifier returns top-2 with confidences. If top-1 < 0.6, mark `REVIEW`.
7. Urgency = weighted sum (rules 60%, classifier severity head 25%, repeat-location boost 15%), then the safety floor applied last.
8. Dedupe: hash over normalised text, station, channel-independent; match in a 2-hour window links the item as a duplicate of an existing ID.
9. Reply: pick template by (dept, priority, lang); fill slots; if LLM enabled, polish only the wording, never the facts or promises.
10. Write to local DB and outbox in one transaction.

### 5.5 Sync protocol
- Client sends `POST /sync/push` with an array of outbox items, each carrying a client UUID and idempotency key.
- Server returns per-item status: `accepted`, `duplicate`, `conflict`, `error`.
- Client pulls `GET /sync/pull?since=<cursor>` for model/rule bundle updates and changes from other stations.
- Order: P1 items first, then P2, then P3.
- Exponential backoff, max 5 min between retries; outbox entries kept until server acknowledges.

### 5.6 Model and rule updates
- Bundles are signed (ed25519) and carry a manifest with version, hash, and training data date.
- The app applies a bundle only at a safe moment (no triage in progress) and keeps the previous version for rollback.
- Rule bundles can ship faster than model bundles; a safety keyword addition is pushed the same day.

### 5.7 Security and privacy
- SQLCipher key stored in Android Keystore.
- Phone numbers and names hashed or masked in logs and in the dashboard unless the user role allows full view.
- Passenger data retention: 90 days on device; server policy set by the metro's data protection rules.
- Audit log of every reviewer change.
- No third-party analytics SDKs on station devices.

### 5.8 Performance budget (mid-range tablet)
- Cold start under 4 s.
- Classifier + rules under 300 ms per item.
- Batch of 100 text complaints triaged in under 40 s.
- OCR under 3 s per photo.
- Storage: app ≈ 250–350 MB including OCR and models (Gujarati traineddata is the big one).

### 5.9 Testing
- Unit: normaliser, rule engine, dedupe, sync state machine.
- Golden set: 1,500 labelled complaints (balanced across scripts and departments), with Safety items over-sampled.
- Adversarial set: misspellings, mixed script, emoji-only, sarcasm, all-caps.
- Offline test: airplane-mode run of a full shift; kill-app-during-sync test; power-loss test.
- Native speaker review of every reply template in gu, hi, en.
- Load test on ingest (2,000 complaints in 10 min).

---

## Part 6. The catches (what trips up teams on this problem)

1. **Gujarati OCR on handwriting is weak.** Printed forms are fine; handwritten Gujarati will have low accuracy. Mitigation: confidence per field, controller must confirm low-confidence text, and design the form for block print.
2. **Gujlish has no standard spelling.** "Lift bandh", "lift band", "LIFT BAND CHHE" are the same thing. A model trained on clean Gujarati will fail. Mitigation: lexicon plus a labelled Gujlish set collected from real complaints.
3. **There is no labelled data on day one.** Teams stall waiting for it. Mitigation: start with rules and keyword lists, have controllers label live items through the review screen, and grow the golden set from that.
4. **False negatives on safety cost far more than false positives.** A "P1 but actually routine" costs a few seconds. A missed gas leak costs a life. Thresholds must be asymmetric; measure safety recall, not overall accuracy.
5. **Accuracy numbers can look good while the important class fails.** If Safety is 5% of data, 95% accuracy can mean zero safety detected. Report per-class recall.
6. **The same complaint arrives on three channels.** Without dedupe, the queue looks three times as busy and the same fix gets raised three times. Dedupe must be in the device, not only on the server.
7. **Offline sync conflicts are quiet.** Two controllers can answer the same complaint. Mitigation: visible "already actioned at station X" flag, and the safety officer sees all actions.
8. **Low-end tablets run out of memory** when the classifier, OCR and LLM load together. Mitigation: load models lazily; LLM only on capable devices; test on the weakest tablet in the fleet.
9. **Model updates during a shift** can change urgency mid-batch. Mitigation: apply bundles only between sessions and record `model_version` on every item.
10. **Auto-generated replies create legal exposure.** A reply saying "we will refund you" or "the lift will be fixed by 5 pm" becomes a commitment. Mitigation: templates reviewed by legal, no promises, controller fills the commitment.
11. **Passenger data on a shared station tablet.** A lost or shared device leaks personal data. Mitigation: encryption, auto-lock, remote wipe, 90-day purge.
12. **Social media data access.** Platform APIs and terms restrict scraping and retention. Mitigation: use the metro's official exports or approved API access only; confirm with the social team before building.
13. **Department taxonomy disagreement.** Teams argue whether "staff ignored a broken lift" is Lifts or Staff. Mitigation: allow secondary department and agree the taxonomy with operations in week 1.
14. **Tempting to over-build the LLM.** A 1B-parameter model on a tablet is slow, warm and hard to test. Templates handle most of the value. Ship without the LLM first.

---

## Part 7. Chokepoints in our solution (ranked by risk)

| Rank | Chokepoint | Why it blocks | Owner | Unblock by |
|---|---|---|---|---|
| 1 | Labelled Gujlish and handwritten Gujarati data | Classifier and OCR quality depend on it | Data + ops | Week 2: sample 2,000 real complaints, native-speaker labelling |
| 2 | Safety keyword list signed off by safety officer | Safety floor is only as good as its list | Safety officer | Week 1 workshop, then weekly review |
| 3 | Gujarati OCR accuracy on real forms | Paper channel may be unusable | Mobile + design | Week 3 OCR bake-off on 200 real forms; decide form design |
| 4 | Target tablet hardware specs confirmed | Decides whether the LLM and OCR fit | Ops IT | Week 1: inventory of station devices |
| 5 | Legal sign-off on reply templates | Replies cannot go to production without it | Legal | Week 4 review of template set |
| 6 | Integration with existing ticketing system | Without it, the tool is a second inbox | Backend + IT | Week 2: API or export contract |
| 7 | Controller adoption | Tool ignored if it adds steps | Product + station leads | Week 5 pilot at 2 stations |
| 8 | Department taxonomy | Labels change the model and the queues | Ops + product | Week 1 workshop |

---

## Part 8. Setup: how to build it

### 8.1 Repository layout

```
cte/
├── android-station/        Kotlin app (Compose, Room, WorkManager, TFLite)
├── ingest-service/         FastAPI, Postgres, sync endpoints
├── dashboard/              React + TS
├── ml/
│   ├── data/               golden set (not in git; DVC-tracked)
│   ├── lexicon/            gujlish_lexicon.json (versioned)
│   ├── rules/              safety_rules.json (versioned)
│   ├── templates/          reply_templates/{gu,hi,en}/*.json
│   ├── train/              training scripts
│   ├── export/             TFLite int8 export + bundle signer
│   └── eval/               per-class recall, golden set runner
├── docs/                   this document, runbooks, ADRs
└── infra/                  docker-compose for local, Terraform for cloud
```

### 8.2 Prerequisites
- Android Studio (latest stable), JDK 17, Android SDK 34, an Android tablet for testing (a 2019-era mid-range device is the target).
- Python 3.11, `uv` or `pip`, Docker Desktop, Postgres 16 (via docker-compose).
- Node 20 LTS for the dashboard.
- DVC for dataset versioning; Git LFS if you keep small models in git.
- Tesseract 5 with `guj`, `hin`, `eng` traineddata for OCR tests.

### 8.3 Step-by-step (first two weeks)

**Day 1–2: project skeleton**
```bash
mkdir cte && cd cte && git init
mkdir -p android-station ingest-service dashboard ml/{data,lexicon,rules,templates,train,export,eval} docs infra
```
- Create the Android project in `android-station` with Compose, Room, WorkManager.
- Create `ingest-service` with FastAPI, SQLAlchemy, Alembic:
```bash
cd ingest-service && uv init && uv add fastapi uvicorn sqlalchemy alembic psycopg[binary] pydantic
```
- `docker-compose.yml` in `infra/` with Postgres 16 and the ingest service.

**Day 3–4: data and rules (start here, not with the model)**
- Gather 200–500 real complaints from the metro (anonymised, with permission).
- Write `ml/lexicon/gujlish_lexicon.json`: variant → canonical, with examples.
- Write `ml/rules/safety_rules.json`: keywords and patterns per script, with the safety officer.
- Write the department taxonomy in `docs/taxonomy.md` and get sign-off.

**Day 5–7: labelling and golden set**
- Build a simple labelling UI (can be a spreadsheet at first) with columns: text, lang, dept, priority, notes.
- Target 1,500 labelled items; over-sample Safety.
- Version the set with DVC: `dvc init && dvc add ml/data/golden_v1.csv`.

**Day 8–10: triage pipeline in Python (for fast iteration)**
- Implement normaliser, rules engine, dedupe, and a baseline TF-IDF + logistic regression classifier in `ml/train/`.
- Write `ml/eval/run_eval.py` that prints per-class precision and recall, and Safety recall in bold.
- Gate: Safety recall ≥ 0.98 on held-out set before moving on. If not, fix rules first.

**Day 11–14: small multilingual model and export**
- Fine-tune a small multilingual encoder for the 6-way department head plus a severity regression head.
- Export to TFLite with int8 quantisation; check size and latency on the target tablet.
- Keep the TF-IDF model as fallback in the same bundle.
- Sign the bundle: `ml/export/sign_bundle.py` with ed25519 key kept outside the repo.

### 8.4 Android station app: first build
- Port the triage pipeline: normaliser and rules in Kotlin (shared test vectors with the Python version so behaviour matches), TFLite model loaded from the bundle.
- Room entities mirror the data model in 5.3; SQLCipher wrapper around Room.
- Screens, in order: Queue (tabs by department, P1 pinned), Complaint detail (raw text, safety hits shown, reply draft), Approve reply, Capture paper form (CameraX + Tesseract), Sync status.
- Outbox: every write goes to `outbox` table in the same transaction; WorkManager job drains it when network is available.
- Test with airplane mode on before every demo.

### 8.5 Ingest service endpoints (first cut)
```
POST /v1/complaints              single complaint (app channel)
POST /v1/complaints/bulk         email/social exports
POST /v1/sync/push               outbox upload, idempotent
GET  /v1/sync/pull?since=        changes and bundle manifest
GET  /v1/bundles/latest          signed model/rule/template bundle
GET  /v1/dashboard/queue         filtered queue for web
```

### 8.6 Dashboard (first cut)
- Single page: queue table with filters, P1 banner, per-department counts, accuracy panel (controller overrides per week).
- Auth via SSO; role-based visibility for passenger PII.

### 8.7 Definition of done for the first demo (week 6)
- Mixed batch of 100 complaints (gu, hi, en, Gujlish, some paper scans) triaged on a tablet in airplane mode.
- All Safety items shown as P1 at the top, with the rule that fired.
- Draft replies in the complainant's language, approved by a controller, queued offline.
- Reconnect: outbox syncs, dashboard shows the items, duplicates merged.
- Eval report: Safety recall, per-department precision and recall, median triage time.

### 8.8 Suggested timeline (team of 5–6)

| Weeks | Focus |
|---|---|
| 1 | Workshops (taxonomy, safety list), device inventory, repo skeleton |
| 2 | Data collection, labelling starts, lexicon v1 |
| 3 | Rules engine, baseline classifier, OCR bake-off |
| 4 | Small model, TFLite export, Android triage port, templates reviewed by legal |
| 5 | Offline queue, sync, dashboard v1, pilot at 2 stations |
| 6 | Hardening, eval, demo, feedback loop to retraining |

### 8.9 Team roles
- Android engineer (2), ML engineer (1–2), backend engineer (1), frontend (1, part-time), product/ops lead (1), native-speaker reviewer for gu/hi (part-time), safety officer (advisory).

---

## Part 9. Decisions still open (to resolve in week 1)
1. Are reply templates allowed to include a ticket ID and expected timeline, or only a generic acknowledgement?
2. Which social channels are officially sanctioned for ingest?
3. Minimum device spec the metro will fund for station tablets.
4. Retention period for passenger complaint text (90 days proposed).
5. Who on the metro side owns the safety keyword list after launch.
