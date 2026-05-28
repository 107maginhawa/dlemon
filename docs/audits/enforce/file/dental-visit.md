# oli-enforce-file: dental-visit

**Generated:** 2026-05-27
**Skill:** oli-enforce-file --module dental-visit --auto
**MODULE_SPEC:** docs/product/modules/dental-visit/MODULE_SPEC.md
**API_CONTRACTS:** docs/product/modules/dental-visit/API_CONTRACTS.md

---

## Summary

| Category | FOUND | MISSING / GAP |
|----------|-------|---------------|
| Backend handlers | 14/15 | 1 gap (BR-001 not in createDentalVisit) |
| API contract alignment | 9/12 | 3 deviations |
| Business rules | 5/8 | 3 gaps |
| Frontend components | 5/5 | — |
| Frontend hooks | 12/12 | — |
| Data model | 4/4 | — |

**Critical defects: 4 | Warnings: 6**

---

## Backend Handlers

### POST /dental/visits — createDentalVisit.ts

**FOUND:**
- Auth guard (UnauthorizedError when no user)
- assertBranchRole with dentist_owner, dentist_associate, hygienist
- VisitRepository.createOne
- Auto-create empty notes row (VisitNotesRepository.upsert)
- Audit log (logAuditEvent)

**MISSING / GAP — BLOCKER:**

**BR-001 concurrent active visit guard is absent.** `createDentalVisit` never calls `findActiveByPatient` or `findInProgressByPatient`. The handler proceeds to `repo.createOne` without checking whether an active or draft visit already exists for the patient. The DB-level unique index (`dental_visit_active_patient_unique`) only covers `status = 'active'` — a second `draft` visit can be created freely, and even for `active`, the DB will throw a raw constraint error instead of the specified `409 ACTIVE_VISIT_EXISTS`. The `findInProgressByPatient` / `findInProgressVisitByPatient` service function exists and is used by `checkInAppointment` but is never wired into this handler.

**Expected per MODULE_SPEC BR-001 / AC-VIS-001:** 409 ACTIVE_VISIT_EXISTS before any insert.

**API contract deviation:** Spec requires `visit_type` (enum: checkup/treatment/emergency/recall) and `provider_id` as required request fields. The handler reads `dentistMemberId` and `chiefComplaint` from body but has no `visit_type` field; the schema column `dental_visit` has no `visitType` column either. These spec-required fields are silently ignored.

---

### PATCH /dental/visits/:id — updateDentalVisit.ts

**FOUND:**
- Auth guard
- assertBranchRole (dentist_owner, dentist_associate)
- Locked visit rejection (`VISIT_LOCKED`)
- VISIT_TRANSITIONS enforced via `VISIT_TRANSITIONS` constant
- BR-005 auto-discard logic (empty visit → discard)
- VISIT_IMMUTABLE on chiefComplaint edit of completed visit
- Consent check before completion (`VISIT_CONSENT_REQUIRED`)
- Audit log on completion

**MISSING / GAP — BLOCKER:**

**Completed visit is not fully immutable.** The `completed` status is only blocked for `chiefComplaint` when `body.status === undefined` (line 56). If a caller sends `{ status: 'completed', chiefComplaint: 'X' }` simultaneously, the `chiefComplaint` is allowed through at line 67. More critically, the transition guard at line 45-53 permits `completed → locked` (correct), but any call with an undefined `body.status` and a `chiefComplaint` on a `completed` visit is rejected — this logic is subtly correct for that case — however per BR-003, ANY write to a completed visit should be 422; the current code only guards `chiefComplaint` when no status change accompanies it. A write of `{ chiefComplaint: 'X', status: 'completed' }` slips through.

**Non-spec error codes in completion path:** `VISIT_HAS_OPEN_TREATMENTS` and `VISIT_CONSENT_REQUIRED` are thrown by `updateDentalVisit` but are not in the MODULE_SPEC error table (§15) or API contract. These block completion in ways not documented and not testable against the spec.

**API contract deviation:** Spec says PATCH body allows `status` with only `completed` as valid value (no `locked` from client). However the handler accepts `status: 'locked'` from clients directly (lines 142-147). Spec §10 implies locking is a system/job operation, not a client-driven PATCH.

---

### POST /dental/visits/:id/treatments — createDentalTreatment.ts

**FOUND:**
- Auth guard
- assertBranchRole (dentist_owner, dentist_associate)
- Visit existence check
- BR-003 immutability (completed/locked → VISIT_IMMUTABLE)
- EC2 extracted tooth guard
- Treatment creation with carriedOver=false

**GAP — WARNING:**

**`patientId` in body:** The handler reads `body.patientId` and passes it directly to `repo.createOne`. The API contract does not include `patientId` in the POST /treatments request body — this should be derived from the visit record (visit.patientId), not accepted from the caller. Accepting a caller-supplied patientId allows a treatment to be created with a mismatched patientId vs the visit's patient.

**Missing `status` default guard:** API contract allows `status: diagnosed | planned` at creation. If the validator passes through an unlisted status value and Zod is lenient, no application-level check enforces this. (Depends on validator strictness — flagged as risk.)

---

### PATCH /dental/visits/:id/treatments/:tid — updateDentalTreatment.ts

**FOUND:**
- Auth guard
- TREATMENT_TRANSITIONS constant enforcement (BR-006)
- BR-007: verified treatment field immutability
- Consent required before performed (P0-003)
- dismiss with reason
- declined with refusalReason (required)
- Audit log on performed
- Visit immutability check via visit lookup

**GAP — BLOCKER:**

**Branch access check is conditional (line 39):** `if (visit) await assertBranchRole(...)`. If `visitRepo.findOneById(treatment.visitId)` returns null (orphaned treatment — visit deleted), the authorization check is skipped entirely and the handler proceeds to modify the treatment without any branch access verification. The audit log at line 101 also silently skips when `visit` is null.

**GAP — WARNING:**

**BR-007 scope is narrower than spec.** The spec says "completed treatment immutable (code, tooth, surface, price)". The handler checks `verified` status (line 42), not `performed`. `performed` treatments can still have cdtCode, toothNumber, surfaces updated — only `verified` is guarded.

---

### POST /dental/visits/:id/chart — upsertDentalChart.ts

**FOUND:**
- Auth guard
- assertBranchRole (dentist_owner, dentist_associate, hygienist)
- Visit existence check
- Chart upsert + version save
- Baseline merge

**MISSING / GAP — BLOCKER:**

**BR-003 not enforced.** `upsertDentalChart` never checks `visit.status`. A `completed` or `locked` visit's chart can be overwritten freely. No `VISIT_IMMUTABLE` check present. This directly violates BR-003 / AC-VIS-002 and MODULE_SPEC §20 AI Instruction #1.

---

### GET /dental/visits/:id/chart — getDentalChart.ts

**FOUND:**
- Auth guard
- assertBranchAccess
- Visit and chart existence checks

No gaps.

---

### POST /dental/visits/:id/notes — upsertVisitNotes.ts

**FOUND:**
- Auth guard
- assertBranchRole (dentist_owner, dentist_associate)
- Visit existence check
- Locked visit guard (VISIT_LOCKED)
- Membership resolution
- Signed note immutability (via repo.upsert throwing NOTE_SIGNED)

**GAP — BLOCKER:**

**Completed visit is not blocked.** `upsertVisitNotes` only throws for `locked` status (line 35). A `completed` visit's notes can be freely modified. Per BR-003 and MODULE_SPEC §20 instruction #1, completed visits must be immutable for all write operations.

**API contract deviation:** Contract spec (`POST /dental/visits/:id/notes`) expects `note_type` field (enum: clinical, soap, progress) and `content` field. Handler uses `subjective/objective/assessment/plan/notes` SOAP fields. The response shape (VisitNotes SOAP fields) also differs from the spec's `ClinicalNote` type. This is a protocol mismatch between spec and implementation.

---

### GET /dental/visits/:id/notes — getVisitNotes.ts

**FOUND:**
- Auth guard
- assertBranchAccess
- History returned alongside notes

**GAP — WARNING:**

`getVisitNotes` throws `NotFoundError` when notes row is absent (line 30). Because `createDentalVisit` auto-creates an empty notes row, this should never happen for well-created visits. However if a visit was created before this auto-create was added (or via a direct DB insert), the GET returns 404 instead of an empty/default notes object, causing the frontend SOAP sheet to fail on load.

---

### POST /dental/visits/:id/notes/sign — signVisitNotes.ts

**FOUND:**
- Auth guard
- assertBranchRole (dentist_owner, dentist_associate)
- Already-signed guard (NOTE_ALREADY_SIGNED)
- Snapshot version created on sign

**API contract deviation:** Contract specifies `POST /dental/visits/:id/notes/:nid/sign` (note-level endpoint, requires nid path param). Implementation uses `POST /dental/visits/:id/notes/sign` (no nid, looks up note by visitId). This means the response shape and URL differ from the contract. `{ data: { ok: true, signed_at } }` per contract vs full note object returned by implementation.

---

### POST /dental/patients/:patientId/dentition — initializeDentition.ts

**FOUND:**
- Auth guard
- assertBranchRole (dentist_owner, dentist_associate)
- Age-based dentition type calculation (deciduous/mixed/permanent)
- ISO 3950 tooth number sets
- Response includes chartId, patientId, dentitionType, toothCount, teeth

**MISSING / GAP — BLOCKER:**

**Idempotency not enforced (Edge case §13).** The handler calls `repo.upsert` which will overwrite an existing chart silently. The API contract specifies `DENTITION_ALREADY_INITIALIZED(409)` as an error. No check exists to detect whether dentition has already been initialized for this patient/visit combination. Calling it twice silently replaces the chart.

**GAP — WARNING:**

**Mixed dentition: 60 teeth returned.** When `age <= 12`, the handler returns all 20 deciduous + all 32 permanent = 52 teeth (or 40+32=72 — actually DECIDUOUS_TEETH has 20, PERMANENT_TEETH has 32, total 52). The FDI chart component does not handle overlapping tooth numbers from mixed dentition at render time (both deciduous 51-85 and permanent 11-48 are returned simultaneously). The `DentalChart` component's quadrant splits only handle `primary` (pediatric 51-85) or `permanent` (11-48) — not `mixed`. The `dentitionType='mixed'` value is never a valid `DentitionType` in the frontend type definition (`dental-chart.helpers.ts` type `DentitionType`), confirmed by the carousel's `getDentitionType` returning only `'permanent' | 'primary'`.

---

### GET /dental/patients/:id/treatment-plan — getTreatmentPlan.ts

**FOUND:**
- Auth guard
- patientId validation
- assertBranchAccess when branchId provided
- Pending treatment aggregation (diagnosed/planned/declined)
- byTooth grouping
- totalEstimateCents, treatmentCount, toothCount

**GAP — WARNING:**

**`branchId` is optional in implementation, required per API contract.** The contract specifies `branch_id` as a required query param. The handler makes it optional (line 28: `if (branchId) await assertBranchAccess(...)`) — missing `branchId` bypasses authorization entirely and returns all treatments for the patient across all branches/organizations. This is a data scope leak.

**GAP — WARNING:**

**No visit status filter.** getTreatmentPlan queries all visits for a patient including `discarded` and `locked` visits (line 36: `eq(dentalVisits.patientId, patientId)` with no status filter). Treatments from discarded visits appear in the treatment plan. API contract says "all non-dismissed treatments, sorted by visit date" — the description implies only active/completed/locked visits should be included, not discarded ones.

---

### POST /dental/visits/:id/carry-over — carryOverTreatments.ts

**FOUND:**
- Auth guard
- assertBranchRole (dentist_owner, dentist_associate)
- Current visit existence + immutability check
- Previous visit lookup
- Pending treatments copied with carriedOver=true, sourceVisitId set (BR-008)
- Restore-from-dismissed optional path

**GAP — WARNING:**

**API contract body mismatch.** Contract requires `{ source_visit_id: string }` (required). Implementation accepts `{ restoreDismissedIds?: string[] }` (optional) and auto-discovers the source visit itself by querying the last 5 visits. A caller cannot specify a particular source visit as the contract requires. The contract field `source_visit_id` is not read.

**GAP — WARNING:**

**Cross-branch carry-over not blocked.** MODULE_SPEC §13 edge case: "Carry-over from visit in different branch (blocked — assertBranchAccess)." The handler fetches previous visits by `patientId` alone with no `branchId` filter. Treatments from a visit at Branch A can be carried over into Branch B's visit.

---

### Remaining handlers (no gaps)

| Handler | Status |
|---------|--------|
| getDentalVisit.ts | FOUND — auth, branch access, not-found guard |
| listDentalVisits.ts | FOUND — auth, branchId required, pagination, branch access |
| signVisitNotes.ts | FOUND (see API contract deviation above) |
| getVisitNoteHistory.ts | FOUND |
| createVisitNoteAddendum.ts | FOUND |
| listDentalTreatments.ts | FOUND |
| getToothHistory.ts | FOUND |
| acceptTreatmentPlan.ts | FOUND |
| applyTemplate.ts | FOUND |
| treatmentTemplates.ts | FOUND (list/create/update/delete) |
| getTreatmentPlanVersion.ts | FOUND |
| updateTooth.ts | FOUND |

---

## Business Rules Audit

| Rule | Status | Notes |
|------|--------|-------|
| BR-001 no concurrent active visit | **MISSING** | createDentalVisit never calls findInProgress; DB constraint alone not sufficient for draft visits and returns raw DB error not 409 |
| BR-002 linear status transitions | FOUND | VISIT_TRANSITIONS enforced in updateDentalVisit |
| BR-003 visit immutable after completed/locked | **PARTIAL** | upsertDentalChart missing; upsertVisitNotes only blocks locked; createDentalTreatment blocks both — inconsistent |
| BR-005 auto-discard empty draft | FOUND | Implemented in updateDentalVisit (completion path) |
| BR-006 treatment state forward-only | FOUND | TREATMENT_TRANSITIONS constant enforced |
| BR-007 performed treatment immutable | **PARTIAL** | Guards `verified` not `performed` — spec says `performed` is the immutable threshold for code/tooth/surface/price |
| BR-008 carry-over creates new rows with carriedOver=true, sourceVisitId | FOUND | Correct |
| Edge: dentition init idempotent | **MISSING** | No DENTITION_ALREADY_INITIALIZED 409 check |

---

## API Contract Alignment

| Endpoint | Status | Notes |
|----------|--------|-------|
| POST /dental/visits | PARTIAL | Missing BR-001 check; visit_type/provider_id fields not in schema |
| GET /dental/visits/:id | FOUND | |
| PATCH /dental/visits/:id | PARTIAL | Allows client to send status:'locked' (spec: system-only); non-spec error codes VISIT_HAS_OPEN_TREATMENTS, VISIT_CONSENT_REQUIRED |
| POST /dental/visits/:id/treatments | PARTIAL | caller-supplied patientId risk |
| PATCH /dental/visits/:id/treatments/:tid | PARTIAL | BR-007 guards `verified` not `performed` |
| POST /dental/visits/:id/chart | FOUND (route) | Missing BR-003 immutability guard |
| GET /dental/visits/:id/chart | FOUND | |
| POST /dental/patients/:patientId/dentition | PARTIAL | No 409 DENTITION_ALREADY_INITIALIZED |
| GET /dental/visits/:id/notes | FOUND | |
| POST /dental/visits/:id/notes | PARTIAL | SOAP fields vs spec content/note_type fields |
| POST /dental/visits/:id/notes/:nid/sign | PARTIAL | URL path differs (no :nid), response shape differs |
| GET /dental/patients/:id/treatment-plan | PARTIAL | branchId optional not required; discarded visit treatments included |
| POST /dental/visits/:id/carry-over | PARTIAL | source_visit_id not read; cross-branch not blocked |

---

## Frontend Components (visit-domain)

### DentalChart (dental-chart.tsx)

**FOUND:**
- FDI + pediatric tooth number support
- 4-quadrant layout
- Color filter toggle
- Accessible (aria-pressed, aria-label)
- Loading/empty states via parent

**GAP — WARNING:**

**`mixed` dentition type not handled.** `DentitionType` at the component level only supports `'permanent' | 'primary'` (from helpers). `initializeDentition` returns `dentitionType: 'mixed'` but the carousel's `getDentitionType` returns only `'permanent' | 'primary'` — `mixed` falls through to `'permanent'`. Mixed-dentition patients age 6-12 will have their deciduous teeth (51-85) invisible in the chart.

---

### TimelineCarousel (timeline-carousel.tsx)

**FOUND:**
- Swiper EffectCoverflow with keyboard + pagination
- Sorted oldest→newest, initialSlide = last
- Active slide: interactive chart, border highlight, accent bar
- Non-active slides: preview-only chart (xs size)
- Lock button on completed slides
- Status badges

**GAP — WARNING:**

**`discarded` status missing from VisitCard type.** `VisitCard.status` is typed as `'draft' | 'active' | 'completed' | 'locked'`. The schema allows `'discarded'`. Discarded visits returned by the API will silently fail TypeScript narrowing and their status badge will render as the default grey case with the raw string `"discarded"` — no visual treatment. Not a crash but a display regression.

**INFO:**

**currentVisitId prop unused.** `TimelineCarousel` accepts `currentVisitId` but never uses it to pre-select the matching slide. `initialSlide` is always the last index regardless. The active `currentVisitId` from the workspace may not match the selected carousel slide on first render when the active visit is not the most recent.

---

### TreatmentTable (treatment-table.tsx)

**FOUND:**
- TXTBL-01 dual subtotals (this visit / carried over)
- TXTBL-02 inline price edit
- TXTBL-03 dismiss popover with reason
- TXTBL-04 chevron notes sub-row
- TXTBL-05 view completed toggle
- P1.4 informed refusal popover
- readOnly prop respected

**GAP — WARNING:**

**TXTBL-02 price edit sends `priceCents` field to API but API contract says price is locked at creation (EC4 / MODULE_SPEC).** `updateDentalTreatment` API does not accept `priceCents` per spec, but `TreatmentRepository.update` accepts it. The frontend mutation at line 390 sends `{ priceCents: cents }` — whether this silently succeeds (overriding EC4) or fails depends on the Zod validator; if the validator strips unknown fields it silently drops the update.

**INFO:**

`_markDoneError` at line 102 is assigned but never used (prefixed `_` intentionally, acceptable).

---

### ToothSlideout (tooth-slideout.tsx)

**FOUND:**
- 3-step wizard: Overview → Treatment → Review
- Per-surface condition assignment
- CDT code browser integration
- Save & Next flow
- ReadOnly mode with amendment entry
- Reset on tooth/open change (useEffect)

**GAP — INFO:**

**Save button enabled when `!primaryState && entryClassification`** (line 461). The review step shows a blocking message "Assign at least one surface condition before saving" when `!primaryState` (line 378), but the Save button is still clickable when `entryClassification` is set without any surface condition. `buildSaveData()` will return `state: ''` as `ToothState`, which is not a valid state per the type. This is a cosmetic/data-quality gap, not a crash.

---

### TreatmentPlansSheet (treatment-plans-sheet.tsx)

**FOUND:**
- B4 plan listing with FSM status badges
- FSM: draft→presented→approved→partially_completed→completed|cancelled
- Transition buttons per plan
- Loading + empty states

No significant gaps.

---

## Data Model Audit

| Table | Status |
|-------|--------|
| dental_visit | FOUND — all MODULE_SPEC §7 fields present |
| dental_treatment | FOUND — all fields including carriedOver, sourceVisitId, performedAt, billedInvoiceId |
| dental_chart (via DentalChartRepository) | FOUND |
| visit_notes + visit_note_version | FOUND — append-only versioning, signed flag |

**NOTE:** `dental_visit` schema has no `visit_type` column despite `visit_type` being a required field in the API contract's POST /dental/visits. This is a schema gap corroborating the handler finding above.

---

## Critical Defects (Blockers)

| ID | Location | Defect |
|----|----------|--------|
| VIS-B01 | createDentalVisit.ts | BR-001 missing: no concurrent active/draft visit check before insert; 409 ACTIVE_VISIT_EXISTS never returned by this handler |
| VIS-B02 | upsertDentalChart.ts | BR-003 missing: no visit status check; completed/locked visit chart can be overwritten |
| VIS-B03 | upsertVisitNotes.ts:35 | BR-003 incomplete: only `locked` is blocked; `completed` visits' notes are freely editable |
| VIS-B04 | updateDentalTreatment.ts:39 | Branch authorization skipped when visit is null (orphaned treatment); `if (visit)` guard makes assertBranchRole optional |
| VIS-B05 | initializeDentition.ts | DENTITION_ALREADY_INITIALIZED 409 never returned; idempotency spec not met |

## Warnings

| ID | Location | Defect |
|----|----------|--------|
| VIS-W01 | updateDentalTreatment.ts:42 | BR-007 guards `verified`, not `performed` — spec immutability threshold is `performed` |
| VIS-W02 | getTreatmentPlan.ts:28 | branchId optional: missing branchId bypasses authorization, returns cross-org data |
| VIS-W03 | carryOverTreatments.ts | spec source_visit_id not read; cross-branch carry-over not blocked |
| VIS-W04 | timeline-carousel.tsx:26 | `discarded` status absent from VisitCard type; carousel mis-renders discarded visits |
| VIS-W05 | dental-chart.tsx | `mixed` dentition type falls through to `permanent`; 6-12yr patients' deciduous teeth invisible |
| VIS-W06 | treatment-table.tsx:390 | Price edit sends priceCents to API but EC4 says price is locked at creation |

## Info

| ID | Location | Note |
|----|----------|------|
| VIS-I01 | createDentalVisit.ts | visit_type / provider_id required by API contract but absent from schema and handler |
| VIS-I02 | signVisitNotes.ts | URL and response shape differ from API contract (no :nid, returns full note not `{ok,signed_at}`) |
| VIS-I03 | timeline-carousel.tsx | currentVisitId prop received but not used for slide selection |
| VIS-I04 | $patientId.tsx:147 | `useOrgContextStore.getState()` inside event handler is safe (not a hook call) — non-issue |
| VIS-I05 | tooth-slideout.tsx:461 | Save enabled when entryClassification set but no surface condition; state:'' passed to save |
| VIS-I06 | upsertVisitNotes.ts | API contract expects content/note_type fields; implementation uses SOAP struct — protocol mismatch with spec |
