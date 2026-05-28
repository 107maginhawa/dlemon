# Enforcement Audit: dental-imaging

**Generated:** 2026-05-27
**Skill:** oli-enforce-file
**MODULE_SPEC:** docs/product/modules/dental-imaging/MODULE_SPEC.md
**API_CONTRACTS:** docs/product/modules/dental-imaging/API_CONTRACTS.md
**Depth:** adversarial (full read — every declared spec item checked)

---

## 1. Spec Item Coverage

### 1.1 Endpoints (MODULE_SPEC §10 / API_CONTRACTS)

| Spec Endpoint | Handler File | Status | Notes |
|---|---|---|---|
| POST /dental/imaging/studies | `ImagingMgmt_createImagingStudy.ts` → `createImagingStudy.ts` | FOUND | Body schema diverges — see CR-01 |
| GET /dental/imaging/studies | NOT FOUND as a dedicated handler | MISSING | See CR-02 |
| POST /dental/imaging/studies/:id/images | NOT FOUND as a dedicated handler | MISSING | See CR-03 |
| POST /dental/imaging/studies/:id/annotations | NOT FOUND as a dedicated handler | MISSING | See CR-04 |
| PATCH /dental/imaging/studies/:id/annotations/:aid | NOT FOUND as a dedicated handler | MISSING | See CR-04 |
| POST /dental/imaging/studies/:id/findings | CONTRACT says `studies/:id/findings`; impl uses `images/:imageId/findings` | MISMATCH | See CR-05 |
| POST /dental/imaging/ceph-analyses | NOT FOUND as a dedicated handler | MISSING | See CR-06 |
| PUT /dental/imaging/ceph-analyses/:id/landmarks | NOT FOUND — impl uses `images/:imageId/ceph/landmarks` (POST) | PATH MISMATCH | See CR-07 |
| POST /dental/imaging/ceph-analyses/:id/recompute | NOT FOUND — impl uses `images/:imageId/ceph/analysis/recompute` | PATH MISMATCH | See CR-07 |

### 1.2 Domain Data Model (MODULE_SPEC §7)

| Spec Field | Schema Location | Status | Notes |
|---|---|---|---|
| `imaging_study.id` | `imaging.schema.ts` via `baseEntityFields` | FOUND | |
| `imaging_study.patient_id` | `imaging.schema.ts` | FOUND | |
| `imaging_study.branch_id` | `imaging.schema.ts` | FOUND | |
| `imaging_study.dentist_member_id` | `imaging.schema.ts` → `acquiredBy` | FOUND (renamed) | Column name differs from spec |
| `imaging_study.study_type` | `imaging.schema.ts` → `modality` | FOUND (renamed) | Column name differs from spec |
| `imaging_study.capture_method` | NOT IN SCHEMA | MISSING | Spec field absent from Drizzle schema |
| `imaging_study.created_at` | `imaging.schema.ts` via `baseEntityFields` | FOUND | |
| `imaging_study_image.id` | FOUND | FOUND | |
| `imaging_study_image.study_id` | FOUND | FOUND | |
| `imaging_study_image.storage_file_id` | → `file_id` | FOUND (renamed) | |
| `imaging_study_image.tooth_fdi` | → via join table `imaging_study_tooth.tooth_number` | FOUND (different design) | |
| `imaging_study_image.sequence_order` | → `sequence_number` | FOUND (renamed) | |
| `imaging_annotation.id` | FOUND | FOUND | |
| `imaging_annotation.study_id` | NOT IN SCHEMA — only `image_id` present | MISSING | Spec says study_id; impl only has image_id |
| `imaging_annotation.image_id` | FOUND | FOUND | |
| `imaging_annotation.type` | FOUND | FOUND | |
| `imaging_annotation.coordinates` | → `geometry` (JSONB) | FOUND (renamed) | |
| `imaging_annotation.status` | NOT IN SCHEMA | MISSING | Spec states draft/confirmed/resolved; no status column on annotation table |
| `imaging_finding.id` | FOUND | FOUND | |
| `imaging_finding.study_id` | NOT IN SCHEMA — only `image_id` | MISSING | Spec says study_id; impl links via image_id |
| `imaging_finding.tooth_fdi` | → `tooth_number` | FOUND (renamed) | |
| `imaging_finding.finding_type` | → `type` | FOUND (renamed) | |
| `imaging_finding.status` | FOUND | FOUND | |
| `ceph_analysis.id` | FOUND | FOUND | |
| `ceph_analysis.study_id` | NOT IN SCHEMA — uses `image_id` | MISSING | See CR-08 |
| `ceph_analysis.analysis_type` | FOUND | FOUND | |
| `ceph_analysis.status` | NOT IN SCHEMA | MISSING | Spec names a `status` field; impl has no analysis status column |
| `ceph_analysis.calibration_method` | FOUND | FOUND | |
| `ceph_analysis.mm_per_pixel` | → `calibration_value` / `pixel_spacing_mm` | FOUND (renamed) | |
| `ceph_landmark.id` | FOUND | FOUND | |
| `ceph_landmark.analysis_id` | NOT IN SCHEMA — uses `image_id` as root | MISSING | See CR-08 |
| `ceph_landmark.landmark_type` | → `landmark_code` | FOUND (renamed) | |
| `ceph_landmark.x` | FOUND | FOUND | |
| `ceph_landmark.y` | FOUND | FOUND | |
| `ceph_landmark.status` | FOUND | FOUND | |
| `ceph_landmark.source` | FOUND | FOUND | |

### 1.3 State Machines

| Spec SM | Location | Status | Notes |
|---|---|---|---|
| SM-01 Annotation: draft→confirmed→resolved | `imaging_finding.schema.ts` `FINDING_TRANSITIONS` | MISMATCH | SM-01 per spec is for annotations; impl applies SM-01 transitions to **findings** (suspected/confirmed/monitoring/resolved), not annotations. Annotation table has no status column at all. See CR-09 |
| SM-02 Ceph Landmark: not_placed→placed→locked | `imaging_ceph.schema.ts` `CEPH_LANDMARK_TRANSITIONS` | MISMATCH | SM-02 per spec includes `not_placed` state; impl starts at `placed` (no `not_placed`). See CR-10 |

### 1.4 Business Rules

| Rule | Expected | Status | Notes |
|---|---|---|---|
| BR-016c imagingTier gate | 403 if tier insufficient | FOUND | All ceph handlers check tier. |
| BR-023–035 Annotation/finding rules | Per SM-01 | PARTIAL | Annotation SM-01 (draft/confirmed/resolved) not enforced — no annotation status column. Finding SM enforced. |
| BR-036–047 Ceph landmark + analysis rules | Per SM-02 | PARTIAL | SM-02 `not_placed` start state absent. |
| Loose coupling / no DB FKs to other modules | UUID refs only | PARTIAL | `imaging_finding.schema.ts` has `.references(() => dentalVisits.id)`, `.references(() => patients.id)`, `.references(() => dentalBranches.id)` — three DB-level FKs to external modules violating stated design. See CR-11 |

### 1.5 Acceptance Criteria

| AC | Requirement | Status | Notes |
|---|---|---|---|
| AC-IMG-001 | Ceph without imagingTier → 403 | FOUND | Tested in `ceph.test.ts` |
| AC-IMG-002 | Annotation status reversal (confirmed→draft) → 422 | MISSING | Annotation has no status column; spec AC is untestable against current impl |
| AC-IMG-003 | Ceph landmark placed→not_placed → 422 | NOT TESTED | `not_placed` state absent from enum; test for this specific transition absent |
| AC-IMG-004 | Study images stored in S3 — URL returned, not raw data | FOUND | `createImagingStudy` returns `uploadUrl` |
| AC-IMG-005 | Study list returns only studies for requesting user's branch | MISSING | No `GET /dental/imaging/studies` handler exists |

### 1.6 Test Coverage

| Spec Test Expectation | Test File | Status | Notes |
|---|---|---|---|
| Unit: SM-01 annotation states | `imaging.test.ts` | MISSING | Tests cover finding SM, not annotation SM |
| Unit: SM-02 landmark states | `ceph.test.ts` | PARTIAL | Tests cover placed→confirmed→locked; `not_placed` start state not tested |
| Unit: BR-016c tier gate | `ceph.test.ts` | FOUND | |
| Integration: upload → S3 → URL accessible | Not present | MISSING | No integration test for the presigned URL flow |
| `imaging.test.ts` | FOUND | FOUND | Present and covers BR-033, BR-034, BR-026, BR-027, BR-030, BR-035 |
| `ceph.test.ts` | FOUND | FOUND | Present and covers CIMG-07..15, D-G, D-I, D-J, D-L, D-4 |
| Property test: `imaging-finding.fsm.property.test.ts` | Expected | MISSING | File listed in directory but content not readable (empty/deleted) |
| Property test: `ceph-landmark.fsm.property.test.ts` | Expected | FOUND (filename present) | |

### 1.7 Workflows

| Workflow | Status | Notes |
|---|---|---|
| WF-019 Upload radiographic study | PARTIAL | Handler exists but diverges from contract schema — see CR-01 |
| WF-020 Annotate radiograph | MISSING | No annotation create/update handlers at the spec URLs |
| WF-040 Record imaging finding | FOUND | `createFinding.ts` / `ImagingFindingsMgmt_*` handlers |
| WF-067 Add images to study | MISSING | No `POST /studies/:id/images` handler |
| WF-087 View imaging study list | MISSING | No `GET /dental/imaging/studies` handler |
| WF-030 Run ceph analysis | PARTIAL | No `POST /ceph-analyses` creation endpoint; landmarks/recompute handlers exist under different URL scheme |
| WF-031 Place/adjust ceph landmarks | FOUND | `CephMgmt_batchUpsertCephLandmarks`, `CephMgmt_updateCephLandmark` |

### 1.8 Domain Events

| Event | Spec | Status | Notes |
|---|---|---|---|
| DE-018 ImagingStudyUploaded | Published after first image added | MISSING | No event emission in `createImagingStudy.ts` or any image handler |
| DE-019 ImagingFindingConfirmed | Published when annotation status → confirmed | MISSING | No event emission; annotation has no status column |
| DE-020 CephAnalysisComputed | Published async on completion | MISSING | No event emission in recompute handler |

### 1.9 Error Codes

| Spec Error Code | Handler | Status | Notes |
|---|---|---|---|
| `IMAGING_TIER_REQUIRED(403)` | All ceph handlers | FOUND | Code is `ForbiddenError` (maps to 403) but code string is a message not the defined code |
| `INVALID_STATUS_TRANSITION(422)` | `updateFinding.ts`, `CephMgmt_updateCephLandmark.ts` | FOUND | |
| `NOT_CALIBRATED(422)` | Recompute handler | MISSING | Recompute does not enforce calibration-before-recompute; returns results even uncalibrated (warns via `uncalibrated` flag only) |
| `UNSUPPORTED_MIME_TYPE(422)` | `createImagingStudy.ts` | WRONG STATUS | Returns 400, spec says 422 |

### 1.10 Feature Flags

| Flag | Spec Default | Status |
|---|---|---|
| `dental_imaging_ceph_enabled` | false | NOT FOUND — no feature flag check in any handler |
| `dental_imaging_auto_landmark` | false | NOT FOUND — no feature flag check |

### 1.11 Frontend

| Spec UI Component | File | Status | Notes |
|---|---|---|---|
| Imaging workspace | `components/imaging-workspace.tsx` | FOUND | |
| Finding list panel | `components/FindingsSidebar.tsx` | FOUND | |
| Ceph workspace panel | `components/CephWorkspacePanel.tsx` | FOUND | |
| Ceph landmark layer | `components/CephLandmarkLayer.tsx` | FOUND | |
| Ceph tracing overlay | `components/CephTracingOverlay.tsx` | FOUND | |
| Ceph measurements panel | `components/CephMeasurementsPanel.tsx` | FOUND | |
| Ceph report view | `components/CephReportView.tsx` | FOUND | |
| Ceph angle arc layer | `components/CephAngleArcLayer.tsx` | FOUND | |
| Ceph layer panel | `components/CephLayerPanel.tsx` | FOUND | |
| Calibration dialog | `components/calibration-dialog.tsx` | FOUND | |
| Annotation toolbar | `components/annotation-toolbar.tsx` | FOUND | |
| Measurement toolbar | `components/measurement-toolbar.tsx` | FOUND | |
| Patient image list | `components/patient-image-list.tsx` | FOUND | |
| Image upload component | `components/image-upload.tsx` | FOUND | |
| Comparison view | `components/comparison-view.tsx` | FOUND | |
| imagingTier upgrade prompt | NOT FOUND as dedicated component | MISSING | Spec requires an upgrade prompt UI state |
| Empty state (no studies) | NOT FOUND as dedicated component | MISSING | Spec requires empty state UI |
| Ceph print route | `routes/imaging-ceph-report.$imageId.tsx` | FOUND | |

### 1.12 Frontend Hooks

| Hook | File | Status |
|---|---|---|
| `useImagingStudies` | `hooks/use-imaging-studies.ts` | FOUND |
| `useImagingUpload` | `hooks/use-imaging-upload.ts` | FOUND |
| `useImagingFindings` | `hooks/use-imaging-findings.ts` | FOUND |
| `useCephLandmarks` | `hooks/use-ceph-landmarks.ts` | FOUND |
| `useCephAnalysis` | `hooks/use-ceph-analysis.ts` | FOUND |
| `useMeasurements` | `hooks/use-measurements.ts` | FOUND |
| `useOfflineCache` | `hooks/use-offline-cache.ts` | FOUND |
| Business rules hook | `hooks/use-imaging-br.test.ts` (test only, no impl) | MISSING | Test file present but no corresponding `.ts` impl |

---

## 2. Critical Issues

### CR-01: POST /dental/imaging/studies — request body schema diverges from contract

**File:** `services/api-ts/src/handlers/dental-imaging/createImagingStudy.ts:26-36`

**Issue:** The API contract (API_CONTRACTS.md) defines the request body as `{ branch_id, patient_id, visit_id, modality, study_date, notes }`. The implementation parses `{ patientId, visitId, branchId, modality, filename, mimeType, size, toothNumbers, sequenceNumber }`. Three problems:

1. Contract requires `study_date` (mandatory). Implementation ignores it — no study date recorded.
2. Contract does not include `filename`, `mimeType`, `size` in this endpoint; those belong in a separate image upload step. Implementation conflates study creation with single-image upload.
3. Response body contract returns `{ id, branch_id, patient_id, visit_id, modality, status, image_count, study_date, created_at }`. Implementation returns `{ study, image, uploadUrl, uploadMethod, fileId, expiresAt }` — a completely different shape.

The frontend `use-imaging-upload.ts:29-38` is coded against the implementation's non-standard shape, so the frontend and backend are internally consistent but both violate the published contract.

**Fix:** Either update API_CONTRACTS.md to reflect the combined create+upload flow (and update MODULE_SPEC §10), or split into two endpoints matching the contract: `POST /studies` returns `{ id, status, ... }` and `POST /studies/:id/images` handles file upload.

---

### CR-02: GET /dental/imaging/studies — handler missing entirely

**File:** `services/api-ts/src/handlers/dental-imaging/` (no handler file)

**Issue:** The spec (MODULE_SPEC §10, API_CONTRACTS §GET /studies, WF-087, AC-IMG-005) requires a paginated, patient-scoped list of imaging studies filtered by branch. No handler implementing this endpoint exists. The existing `listPatientImages.ts` returns a different shape (legacy attachment union), not the `ImagingStudy[]` contract.

**Fix:** Implement `GET /dental/imaging/studies?branch_id=&patient_id=` handler returning paginated `ImagingStudy` objects. Add corresponding `ImagingMgmt_listImagingStudies.ts` wrapper.

---

### CR-03: POST /dental/imaging/studies/:id/images — image upload endpoint missing

**File:** `services/api-ts/src/handlers/dental-imaging/` (no handler file)

**Issue:** The contract defines `POST /studies/:id/images` as the file upload endpoint (`multipart/form-data`, multiple files, up to 50 MB each, up to 20 files). This endpoint does not exist. The implementation bundles a single-file presigned URL flow inside study creation (CR-01). Clients cannot add images to an existing study.

**Fix:** Implement `POST /dental/imaging/studies/:id/images` accepting multipart form data, delegating to the storage module for each file.

---

### CR-04: Annotation endpoints entirely absent

**File:** `services/api-ts/src/handlers/dental-imaging/` (no handler files)

**Issue:** The contract and spec (WF-020, §10) require:
- `POST /dental/imaging/studies/:id/annotations` — create annotation
- `PATCH /dental/imaging/studies/:id/annotations/:aid` — update annotation / promote to confirmed

Neither endpoint has a handler. The `ImagingAnnotation` table and its schema exist in Drizzle, and `findAnnotationById`/`createAnnotation` methods exist in `imaging.repo.ts`, but no HTTP handler routes exist for the annotation lifecycle. The annotation state machine (SM-01: draft→confirmed→resolved) is therefore unreachable.

**Fix:** Implement annotation handlers for create and PATCH update with SM-01 enforcement.

---

### CR-05: Finding endpoint URL does not match contract

**File:** `services/api-ts/src/handlers/dental-imaging/createFinding.ts:7`

**Issue:** The contract specifies `POST /dental/imaging/studies/:id/findings` (linked to study). The implementation registers at `POST /dental/imaging/images/:imageId/findings` (linked to image). The frontend `use-imaging-findings.ts:65,76` calls `/dental/imaging/images/${imageId}/findings` — internally consistent, but violates the published contract. Any external client following the API contract will receive 404.

**Fix:** Align implementation URL with contract, or formally update the contract to document the image-scoped design.

---

### CR-06: POST /dental/imaging/ceph-analyses — creation endpoint missing

**File:** `services/api-ts/src/handlers/dental-imaging/` (no handler file)

**Issue:** The contract defines `POST /dental/imaging/ceph-analyses` to create a CephAnalysis record (requires `branch_id`, `patient_id`, `study_id`, `image_id`, `analysis_type`). No such endpoint exists. The implementation uses an image-anchored model where ceph analysis is implicitly created or upserted on first landmark batch. A client cannot create a named analysis record per the contract.

**Fix:** Implement `POST /dental/imaging/ceph-analyses` or formally document the image-anchored upsert pattern as the intended design (updating contract).

---

### CR-07: Ceph landmark/recompute URLs diverge from contract

**File:** `services/api-ts/src/handlers/dental-imaging/CephMgmt_batchUpsertCephLandmarks.ts:8`, `CephMgmt_recomputeCephAnalysis.ts:8`

**Issue:**
- Contract: `PUT /dental/imaging/ceph-analyses/:id/landmarks` (analysis-ID-scoped, PUT method)
- Implementation: `POST /dental/imaging/images/:imageId/ceph/landmarks` (image-ID-scoped, POST method)

- Contract: `POST /dental/imaging/ceph-analyses/:id/recompute`
- Implementation: `POST /dental/imaging/images/:imageId/ceph/analysis/recompute`

Both the resource anchor (analysis ID vs image ID) and the URL structure differ. A client following the contract will 404 on all ceph write operations.

**Fix:** Reconcile URLs with the contract or update the contract to the image-anchored design.

---

### CR-08: ceph_analysis and ceph_landmark anchor on image_id, not analysis_id

**File:** `services/api-ts/src/handlers/dental-imaging/repos/imaging_ceph.schema.ts:57,80`

**Issue:** The MODULE_SPEC §7 data model specifies:
- `ceph_analysis.study_id` — FK to imaging study
- `ceph_landmark.analysis_id` — FK to ceph analysis

The implementation anchors both on `image_id` (FK to `imaging_study_image`). This means:
1. Multiple analyses of the same image (e.g., re-analysis after correction) share a single `imagingCephAnalyses` row (unique constraint on `(image_id, analysis_type)`) rather than being separate records. The contract's `analysis_id`-based API cannot work.
2. Landmarks are image-scoped, not analysis-scoped — there is no way to represent a landmark set for analysis version A vs analysis version B on the same image.

**Fix:** Align the schema to the spec model (`analysis_id` as anchor for landmarks) or update the spec to document the image-anchored design decision.

---

### CR-09: Annotation SM-01 (draft/confirmed/resolved) not implemented — no status column

**File:** `services/api-ts/src/handlers/dental-imaging/repos/imaging.schema.ts:94-113`

**Issue:** MODULE_SPEC §8, §5 (BR-023–035) and AC-IMG-002 require:
- `Annotation: draft → confirmed → resolved` (SM-01)

The `imagingAnnotations` Drizzle table has no `status` column. The schema tracks `type`, `geometry`, `measurementValue`, `visible` — but no lifecycle state. AC-IMG-002 ("Annotation status reversal → 422") is therefore impossible to satisfy. The SM-01 state machine defined in the spec is silently absent.

**Fix:** Add `status` column to `imagingAnnotations` (enum: `draft`, `confirmed`, `resolved`) and enforce transitions in annotation update handler.

---

### CR-10: SM-02 missing `not_placed` initial state

**File:** `services/api-ts/src/handlers/dental-imaging/repos/imaging_ceph.schema.ts:35-38`

**Issue:** MODULE_SPEC §8 defines SM-02: `not_placed → placed → locked`. The `cephLandmarkStatusEnum` starts at `placed` (no `not_placed` value). AC-IMG-003 ("placed → not_placed → 422") tests a backward transition that cannot be tested because `not_placed` doesn't exist. More significantly, the landmark lifecycle is missing its initial "template" state — all landmarks are immediately `placed` on creation, with no way to represent "this landmark point is expected but not yet positioned."

**Fix:** Add `not_placed` to `cephLandmarkStatusEnum` and add it as the initial state in `CEPH_LANDMARK_TRANSITIONS`. Update batchUpsert to default new records to `not_placed` if no position is provided.

---

### CR-11: imaging_finding.schema.ts has DB-level FKs to three external modules

**File:** `services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.schema.ts:12-14, 64-66`

**Issue:** MODULE_SPEC §14 and §20 (AI Instruction 1) explicitly state "NO DB-level foreign keys to other modules — UUID references only (loose coupling pattern)." The `imagingFindings` table violates this with three `.references()` calls:
- `.references(() => dentalVisits.id)` — cross-module FK to dental-visit
- `.references(() => patients.id)` — cross-module FK to patient
- `.references(() => dentalBranches.id)` — cross-module FK to dental-org

These create hard DB-level dependencies that the spec explicitly prohibits. A migration to drop these FKs would be a breaking schema change, so this needs a planned migration.

**Fix:** Remove the three `.references()` calls. Keep the UUID columns but with no DB-level constraint. Document the UUID cross-references in comments (as `imaging.schema.ts` does correctly).

---

### CR-12: `UNSUPPORTED_MIME_TYPE` returns 400, spec defines 422

**File:** `services/api-ts/src/handlers/dental-imaging/createImagingStudy.ts:39-43`

**Issue:** The MODULE_SPEC §15 error table specifies `UNSUPPORTED_MIME_TYPE` must return HTTP 422. The handler throws `ValidationError` which maps to 400. The test in `imaging.test.ts:382` asserts `expect(res.status).toBe(400)` — confirming the 400 behavior and cementing the spec violation in the test suite.

**Fix:** Use a `422` status code for MIME validation failure, consistent with the error taxonomy.

---

### CR-13: `imaging_finding.fsm.property.test.ts` — test file is empty / unreadable

**File:** `services/api-ts/src/handlers/dental-imaging/imaging_finding.fsm.property.test.ts`

**Issue:** The file is listed in the directory but returns an error when read ("File does not exist"). The spec §12 requires property tests for SM-01 annotation states and SM-01 finding states. Given the file name exists but content is absent (likely created as a placeholder), SM-01 property coverage is zero.

**Fix:** Implement property tests for the finding FSM at minimum. If the annotation SM-01 is ever implemented, add matching tests.

---

### CR-14: Domain events DE-018 / DE-019 / DE-020 never emitted

**File:** `services/api-ts/src/handlers/dental-imaging/createImagingStudy.ts`, `createFinding.ts`, `CephMgmt_recomputeCephAnalysis.ts`

**Issue:** MODULE_SPEC §10b declares three domain events:
- DE-018 `ImagingStudyUploaded` — emitted after first image added
- DE-019 `ImagingFindingConfirmed` — emitted when annotation status → confirmed
- DE-020 `CephAnalysisComputed` — emitted async on recompute completion

None of these are emitted anywhere in the implementation. The audit log (Pino) is used for structured logging but this is not event emission to subscribers.

**Fix:** Implement event emission at the defined trigger points. If the event bus is not yet available, document this gap and create placeholder emission points.

---

## 3. Warnings

### WR-01: `use-imaging-br.test.ts` has no corresponding implementation

**File:** `apps/dentalemon/src/features/imaging/hooks/use-imaging-br.test.ts`

**Issue:** A test file for a `use-imaging-br` hook exists but the hook file itself (`use-imaging-br.ts`) is absent. Tests reference undefined implementation.

**Fix:** Either create `use-imaging-br.ts` or delete the orphan test file.

---

### WR-02: `upsertAnalysis` does not update calibration fields on conflict

**File:** `services/api-ts/src/handlers/dental-imaging/repos/imaging_ceph.repo.ts:150-157`

**Issue:** The `onConflictDoUpdate` set only updates `{ measurements, updatedAt }`. Fields `calibrationValue`, `calibrationMethod`, `calibratedAt`, `calibratedBy` are NOT included in the conflict update path. If calibration is applied after the first analysis upsert (which creates the row), subsequent calls to `upsertAnalysis` will silently ignore the new calibration state — the row retains stale calibration values.

**Fix:** Include calibration fields in the `onConflictDoUpdate.set`:
```typescript
set: {
  measurements: data.measurements,
  calibrationValue: data.calibrationValue ?? null,
  calibrationMethod: data.calibrationMethod ?? 'not_calibrated',
  calibratedAt: data.calibratedAt ?? null,
  calibratedBy: data.calibratedBy ?? null,
  updatedAt: sql`now()`,
},
```

---

### WR-03: `ceph-report.ts` fetch URL uses `/ceph/report` (singular), `getCephReport` handler may use `/reports` (plural) — mismatch risk

**File:** `apps/dentalemon/src/routes/imaging-ceph-report.$imageId.tsx:35-36`

**Issue:** The print route fetches `/dental/imaging/images/${imageId}/ceph/report` (singular). If the backend registers the route as `/ceph/reports` (plural, matching the `CephMgmt_getCephReport.ts` file naming convention), the print route silently 404s. This cannot be confirmed without reading the route registration file, but the naming inconsistency is a risk.

**Fix:** Verify the backend route registration for `CephMgmt_getCephReport` and confirm the URL matches `/ceph/report` or `/ceph/reports`. Make the frontend and backend consistent.

---

### WR-04: `createImagingStudy.ts` — MIME type check uses `as any` cast

**File:** `services/api-ts/src/handlers/dental-imaging/createImagingStudy.ts:39`

**Issue:** `ALLOWED_IMAGING_MIME_TYPES.includes(body.mimeType as any)` uses an `as any` cast to bypass TypeScript's narrowing on a `readonly` array `includes`. This masks potential type errors if `body.mimeType` is not a string. More importantly, the cast means TypeScript cannot catch if `ALLOWED_IMAGING_MIME_TYPES` type changes.

**Fix:**
```typescript
const mimeTypes: readonly string[] = ALLOWED_IMAGING_MIME_TYPES;
if (!mimeTypes.includes(body.mimeType)) { ... }
```

---

### WR-05: `listFindings` uses `buildPaginationMeta(items, total, total || 1, 0)` — pagination always returns page size = total

**File:** `services/api-ts/src/handlers/dental-imaging/listFindings.ts:45`

**Issue:** Calling `buildPaginationMeta(items, total, total || 1, 0)` passes `total || 1` as the page size argument, making the effective page size equal to the total item count. Pagination is non-functional — every response is a single page of all results regardless of actual pagination parameters. The contract says `per_page` default 20, max 100; neither is respected.

**Fix:** Accept and apply `page` and `per_page` query parameters. Pass the actual `per_page` (defaulting to 20) to `buildPaginationMeta`. Apply `LIMIT`/`OFFSET` in the repo query.

---

### WR-06: `deleteFinding` allows deletion of confirmed findings — no immutability enforcement

**File:** `services/api-ts/src/handlers/dental-imaging/deleteFinding.ts:44`

**Issue:** The spec note "Findings are immutable after visit lock; amendments via WF-038 pattern" (WF-040 step 5) implies findings should not be deletable once confirmed. The handler performs no status check before deletion — a confirmed or resolved finding can be hard-deleted with no safeguard.

**Fix:** Add a status guard: if `finding.status === 'confirmed' || finding.status === 'resolved'`, reject delete with a 422. Alternatively document that delete is intentionally allowed regardless of status.

---

### WR-07: `use-imaging-findings.ts` logs errors to `console.error`

**File:** `apps/dentalemon/src/features/imaging/hooks/use-imaging-findings.ts:84,105`

**Issue:** `onError: (e) => console.error('[imaging-findings]', e)` — direct `console.error` calls in production hook code. PHI or sensitive error context (file names, IDs) could be logged to browser console.

**Fix:** Remove `console.error` calls or replace with a sanitized error handler that does not expose raw error objects.

---

### WR-08: Feature flags `dental_imaging_ceph_enabled` and `dental_imaging_auto_landmark` defined in spec but never checked

**File:** MODULE_SPEC §18; no implementation

**Issue:** Both flags have `default: false` in the spec but no handler reads them. The ceph workspace is always active for addon-tier users with no kill-switch. The auto-landmark flag is also never checked (auto-landmark detection is described in WF-030 step 3 but has no server-side implementation).

**Fix:** Implement feature flag reads (from config or a feature flag store) and guard the respective code paths.

---

### WR-09: `CephMgmt_updateCephLandmark` allows status=locked on confirmed landmark without coordinate update — locked state unreachable via normal PATCH

**File:** `services/api-ts/src/handlers/dental-imaging/CephMgmt_updateCephLandmark.ts:78-85`

**Issue:** The lock transition (`confirmed → locked`) is permitted by `CEPH_LANDMARK_TRANSITIONS`. However the handler only rejects x/y changes on locked landmarks (line 70). A client can PATCH `{ status: 'locked' }` on any confirmed landmark to lock it. Once locked, there is no "Lock Analysis" endpoint to lock all at once, so the locking mechanism is fragmented (each landmark must be locked individually). The spec WF-031 step 4 says "Lock Analysis commits the final landmark set" — suggesting an atomic lock-all operation is required.

**Fix:** Implement a dedicated `POST /images/:imageId/ceph/analysis/lock` endpoint that atomically transitions all confirmed landmarks to locked, consistent with the spec workflow.

---

## 4. Summary

| Category | Count |
|---|---|
| CRITICAL | 14 |
| WARNING | 9 |

**Overall assessment:** The dental-imaging module has substantial schema and API shape mismatches against its own spec and contract. The core data model diverges (annotation lacks a status column, ceph is image-anchored rather than analysis-anchored, three prohibited cross-module DB FKs exist). Seven of the nine specified API endpoints are either missing, at the wrong URL, or respond with a non-contract body shape. The ceph handlers and tests are internally coherent and well-tested, but they are built against a different API design than the published contract. The backend and frontend are consistent with each other but both diverge from the spec.
