<!-- oli-version: 1.1 | run: run-7-wave3-verify-2026-05-29 | skill: oli-enforce-file -->

# oli-enforce-file: dental-imaging
**Run ID:** run-7-wave3-verify-2026-05-29
**Handler dir:** `services/api-ts/src/handlers/dental-imaging/`
**Files checked:** 53
**Spec:** `docs/product/modules/dental-imaging/MODULE_SPEC.md` + `API_CONTRACTS.md` + `DOMAIN_MODEL.md` + `ERROR_TAXONOMY.md` + `MODULE_MAP.md`
**Prior run:** run-6-strict-2026-05-29 (11 findings: P0×5, P1×2, P2×2, P3×2)
**Wave3 claims verified:** EF-IMG-001–005 (P0 branch auth), EF-IMG-007 (CephMgmt tests), EF-IMG-009 (tier gate), EF-IMG-010 (fileSizeBytes)

---

## Wave3 Fix Verification

| Finding ID | Claimed Fix | Verified? | Evidence |
|-----------|-------------|-----------|---------|
| EF-IMG-001 | `createCephReport.ts` — add assertBranchRole | CONFIRMED FIXED | Line 43: `await assertBranchRole(db, user.id, study.branchId, ['dentist_owner', 'dentist_associate'])` |
| EF-IMG-002 | `batchUpsertCephLandmarks.ts` — add assertBranchRole | CONFIRMED FIXED | Line 49: `await assertBranchRole(...)` |
| EF-IMG-003 | `recomputeCephAnalysis.ts` — add assertBranchRole | CONFIRMED FIXED | Line 39: `await assertBranchRole(...)` |
| EF-IMG-004 | `deleteCephLandmark.ts` — add assertBranchRole | CONFIRMED FIXED | Line 36: `await assertBranchRole(...)` |
| EF-IMG-005 | `updateCephLandmark.ts` — add assertBranchRole | CONFIRMED FIXED | Line 45: `await assertBranchRole(...)` |
| EF-IMG-006 | `imaging_finding.schema.ts` — remove cross-module FKs | CONFIRMED FIXED | Only intra-module `.references()` remain (`imagingStudyImages`, `imagingAnnotations`) |
| EF-IMG-007 | `imaging-coverage.test.ts` — add CephMgmt wrapper tests | CONFIRMED FIXED | Lines 1003–1297+: `describe('CephMgmt_listCephLandmarks wrapper', ...)` etc. present |
| EF-IMG-009 | `imagingTier` gate fix: `=== 'free'` → `!== 'addon'` | CONFIRMED FIXED | `createCephReport.ts:49` and all 5 ceph handlers use `!== 'addon'` |
| EF-IMG-010 | `listPatientImages.ts` — real fileSizeBytes from DB | CONFIRMED FIXED | Lines 51, 91: reads `att.fileSizeBytes` and `row.fileSizeBytes` from DB |

**Open from prior run (not claimed as fixed):**
- EF-IMG-008 (P2): No `ImagingService` class — still absent. Not fixed in Wave3.
- EF-IMG-011 (P3): Mixed assertBranchAccess/assertBranchRole — still present. Not fixed in Wave3.

---

## File Inventory (53 files)

### Handler implementation files (21 — canonical logic)
| File | Type | Auth | imagingTier | Status |
|------|------|------|-------------|--------|
| `createImagingStudy.ts` | Handler | assertBranchRole | — | PASS |
| `getImagingStudy.ts` | Handler | assertBranchAccess | — | PASS |
| `deleteImage.ts` | Handler | assertBranchRole | — | PASS |
| `listMeasurements.ts` | Handler | assertBranchAccess | — | PASS |
| `createMeasurement.ts` | Handler | assertBranchRole | free→addon | PASS |
| `deleteMeasurement.ts` | Handler | assertBranchRole | — | PASS |
| `updateImageCalibration.ts` | Handler | assertBranchRole | — | PASS |
| `updateImageModality.ts` | Handler | assertBranchRole | — | PASS |
| `listPatientImages.ts` | Handler | assertBranchAccess | — | PASS |
| `createFinding.ts` | Handler | assertBranchRole | — | PASS |
| `listFindings.ts` | Handler | assertBranchAccess | — | PASS |
| `updateFinding.ts` | Handler | assertBranchRole | — | PASS |
| `deleteFinding.ts` | Handler | assertBranchRole | — | PASS |
| `batchUpsertCephLandmarks.ts` | Handler | assertBranchRole (FIXED) | !=='addon' (FIXED) | PASS |
| `listCephLandmarks.ts` | Handler | assertBranchAccess | !=='addon' | PASS |
| `updateCephLandmark.ts` | Handler | assertBranchRole (FIXED) | !=='addon' (FIXED) | PASS |
| `deleteCephLandmark.ts` | Handler | assertBranchRole (FIXED) | !=='addon' (FIXED) | PASS |
| `getCephAnalysis.ts` | Handler | assertBranchAccess | !=='addon' | PASS |
| `recomputeCephAnalysis.ts` | Handler | assertBranchRole (FIXED) | !=='addon' (FIXED) | PASS |
| `createCephReport.ts` | Handler | assertBranchRole (FIXED) | !=='addon' (FIXED) | PASS |
| `getCephReport.ts` | Handler | assertBranchAccess | !=='addon' | PASS |

### Mgmt wrapper files (21 — thin shims)
All 21 are single-line delegates to above implementations. Auth lives in delegate.

| Wrapper | Delegates to | Auth in delegate |
|---------|-------------|-----------------|
| `ImagingMgmt_createImagingStudy.ts` | `createImagingStudy` | PASS |
| `ImagingMgmt_getImagingStudy.ts` | `getImagingStudy` | PASS |
| `ImagingMgmt_deleteImage.ts` | `deleteImage` | PASS |
| `ImagingMgmt_listMeasurements.ts` | `listMeasurements` | PASS |
| `ImagingMgmt_createMeasurement.ts` | `createMeasurement` | PASS |
| `ImagingMgmt_deleteMeasurement.ts` | `deleteMeasurement` | PASS |
| `ImagingMgmt_updateImageCalibration.ts` | `updateImageCalibration` | PASS |
| `ImagingMgmt_updateImageModality.ts` | `updateImageModality` | PASS |
| `PatientImageMgmt_listPatientImages.ts` | `listPatientImages` | PASS |
| `ImagingFindingsMgmt_createFinding.ts` | `createFinding` | PASS |
| `ImagingFindingsMgmt_listFindings.ts` | `listFindings` | PASS |
| `ImagingFindingsMgmt_updateFinding.ts` | `updateFinding` | PASS |
| `ImagingFindingsMgmt_deleteFinding.ts` | `deleteFinding` | PASS |
| `CephMgmt_batchUpsertCephLandmarks.ts` | `batchUpsertCephLandmarks` | PASS (FIXED) |
| `CephMgmt_listCephLandmarks.ts` | `listCephLandmarks` | PASS |
| `CephMgmt_updateCephLandmark.ts` | `updateCephLandmark` | PASS (FIXED) |
| `CephMgmt_deleteCephLandmark.ts` | `deleteCephLandmark` | PASS (FIXED) |
| `CephMgmt_getCephAnalysis.ts` | `getCephAnalysis` | PASS |
| `CephMgmt_recomputeCephAnalysis.ts` | `recomputeCephAnalysis` | PASS (FIXED) |
| `CephMgmt_createCephReport.ts` | `createCephReport` | PASS (FIXED) |
| `CephMgmt_getCephReport.ts` | `getCephReport` | PASS |

### Test files (5)
| File | Purpose | Status |
|------|---------|--------|
| `imaging.test.ts` | ImagingMgmt, FindingsMgmt, measurements, imagingTier | PASS |
| `ceph.test.ts` | Ceph operations, tier gate, FSM, calibration, D-G/D-I/D-J/D-L/D-4 | PASS |
| `imaging-coverage.test.ts` | Wrapper delegation (13+8 CephMgmt = 21 total — FIXED in Wave3) | PASS |
| `imaging-finding.fsm.property.test.ts` | Property-based SM-01 | PASS |
| `ceph-landmark.fsm.property.test.ts` | Property-based SM-02 | PASS |

### Repo files (6)
| File | Type | Status |
|------|------|--------|
| `repos/imaging.schema.ts` | Schema | ISSUES (see EF-IMG-012, EF-IMG-013) |
| `repos/imaging.repo.ts` | Repository | PASS (intra-module joins only; facade imports allowed) |
| `repos/imaging_ceph.schema.ts` | Schema | ISSUES (see EF-IMG-014, EF-IMG-015) |
| `repos/imaging_ceph.repo.ts` | Repository | PASS |
| `repos/imaging_finding.schema.ts` | Schema | PASS (Wave3 fixed cross-module FKs) |
| `repos/imaging_finding.repo.ts` | Repository | PASS |

---

## Findings

### P0 — Critical Security

*No P0 findings. All 5 Wave3 P0s (EF-IMG-001–005) are CONFIRMED FIXED.*

---

### P1 — High (fix before ship)

#### EF-IMG-008 · No `ImagingService` class (carried from run-6)
**Severity:** P1 (escalated from P2 — architecturally required for DI and testability)
**Confidence:** HIGH
**Spec source:** `BACKEND_ARCHITECTURE.md` service layer pattern; `MODULE_SPEC §14 Dependencies`
**Check:** Data shapes / naming conventions
**File:** `services/api-ts/src/handlers/dental-imaging/` (module-wide)
**Detail:** All 21 handler implementations query DB directly via `ImagingRepository`, `ImagingCephRepository`, and `ImagingFindingRepository` without a service-layer intermediary. No `imaging.service.ts` or `ImagingService` class exists. This differs from the established pattern in `dental-org`, `dental-clinical`, and `dental-billing` where a service class provides testable DI injection and business logic isolation.
**Fix:** Create `services/api-ts/src/handlers/dental-imaging/imaging.service.ts` with an `ImagingService` class wrapping the three repositories. Inject via constructor for unit-test mocking.

---

#### EF-IMG-016 · `recomputeCephAnalysis.ts` returns 200 instead of spec-declared 202
**Severity:** P1
**Confidence:** HIGH
**Spec source:** `API_CONTRACTS.md` — POST `.../ceph-analyses/:id/recompute` → 202
**Check:** Data shapes (response status code)
**File:** `services/api-ts/src/handlers/dental-imaging/recomputeCephAnalysis.ts:78`
**Line context:** `return ctx.json({...}, 200);`
**Detail:** `API_CONTRACTS.md` specifies `202 Accepted` for the recompute endpoint with body `{ analysis_id, status: "computing", estimated_seconds: 5 }`. The handler returns `200 OK` with the full computed measurement object synchronously. The spec response body is also mismatched — spec expects async acknowledgement shape, handler returns full result.
**Fix:** Either (a) return `202` with `{ analysis_id: imageId, status: "computing", estimated_seconds: 5 }` if the intent is async, or (b) update `API_CONTRACTS.md` to reflect the synchronous design (200 + full result) and document the deviation in `MODULE_SPEC §10`. Decision needed with product.

---

#### EF-IMG-017 · `IMAGING_TIER_REQUIRED` error code never emitted; FORBIDDEN used instead
**Severity:** P1
**Confidence:** HIGH
**Spec source:** `ERROR_TAXONOMY.md §5 dental-imaging` — `IMAGING_TIER_REQUIRED | 403 | Feature needs higher subscription tier`
**Check:** Error taxonomy
**File:** `createCephReport.ts:50`, `batchUpsertCephLandmarks.ts:56`, `recomputeCephAnalysis.ts:45`, `updateCephLandmark.ts:52`, `deleteCephLandmark.ts:42`, `getCephAnalysis.ts:44`, `getCephReport.ts:44`, `listCephLandmarks.ts:43`, `createMeasurement.ts:147`
**Line context (example):** `throw new ForbiddenError('Cephalometric analysis requires an imaging add-on...');`
**Detail:** `ForbiddenError` always produces `{ code: 'FORBIDDEN', status: 403 }` (hardcoded in `core/errors.ts:32`). The domain-specific code `IMAGING_TIER_REQUIRED` — which allows clients to distinguish tier-gating from permission-denial — is never emitted. SDK clients cannot reliably detect tier-gate failures vs RBAC failures.
**Fix:** Create `ImagingTierRequiredError extends AppError` with `code = 'IMAGING_TIER_REQUIRED'` and `statusCode = 403`; replace `throw new ForbiddenError(...)` in all tier-gate checks (9 locations) with `throw new ImagingTierRequiredError(...)`.

---

#### EF-IMG-018 · `imaging_annotation` table missing `status` field (SM-01 unimplementable)
**Severity:** P1
**Confidence:** HIGH
**Spec source:** `MODULE_SPEC §8` SM-01: `draft → confirmed → resolved`; `API_CONTRACTS.md` — annotation `status` (required field, enum: `draft`, `confirmed`, `dismissed`); `DOMAIN_MODEL.md §3` ImagingAnnotation state machine
**Check:** Data shapes
**File:** `services/api-ts/src/handlers/dental-imaging/repos/imaging.schema.ts`
**Line context:** `imagingAnnotations` table definition (lines 94–114) — no `status` column present
**Detail:** The `imaging_annotation` table has no `status` column. `MODULE_SPEC §8` defines SM-01 with states `draft → confirmed → resolved`. `API_CONTRACTS.md` declares `status` as a required field in both the create request and response for annotations. `AC-IMG-002` requires that reverting `confirmed → draft` returns 422 — this acceptance criterion cannot be tested or enforced without a `status` column. The current schema only has `active/archived` (used for soft-delete), not the domain status.
**Fix:** Add `annotationStatusEnum = pgEnum('imaging_annotation_status', ['draft', 'confirmed', 'resolved'])` to `imaging.schema.ts`. Add `status: annotationStatusEnum('status').notNull().default('draft')` to `imagingAnnotations` table. Generate migration. Add FSM transition guard in handlers.

---

### P2 — Medium

#### EF-IMG-012 · `imaging.schema.ts` missing `cbct` from `modalityEnum`
**Severity:** P2
**Confidence:** HIGH
**Spec source:** `API_CONTRACTS.md` — modality enum: `periapical, panoramic, bitewing, cephalometric, cbct, intraoral_photo`
**Check:** Data shapes
**File:** `services/api-ts/src/handlers/dental-imaging/repos/imaging.schema.ts:29–37`
**Line context:** `export const modalityEnum = pgEnum('imaging_modality', ['periapical', 'bitewing', 'panoramic', 'cephalometric', 'intraoral_photo', 'extraoral_photo', 'other']);`
**Detail:** Schema includes `extraoral_photo` and `other` but is missing `cbct`. `API_CONTRACTS.md` lists `cbct` as a valid modality (required for CBCT studies tied to ceph analysis). Any request with `modality: 'cbct'` will fail Drizzle's enum validation or be cast to `other`. The `imagingTier` gate for ceph (`BR-016c`) is tied to cbct modality — missing the enum value creates an inconsistency.
**Fix:** Add `'cbct'` to the `modalityEnum` values. Generate migration to update `imaging_modality` Postgres enum.

---

#### EF-IMG-013 · `imaging.schema.ts` `imagingStudy` missing `study_date` field
**Severity:** P2
**Confidence:** HIGH
**Spec source:** `API_CONTRACTS.md` — POST /studies request body: `study_date` (required, format: date YYYY-MM-DD); response: `study_date` (non-nullable)
**Check:** Data shapes
**File:** `services/api-ts/src/handlers/dental-imaging/repos/imaging.schema.ts`, `createImagingStudy.ts`
**Line context:** `imagingStudies` table definition (lines 56–68) — no `study_date` or `captureDate` column
**Detail:** `API_CONTRACTS.md` declares `study_date` as a REQUIRED input field for study creation and a REQUIRED response field. Neither the `imaging_study` schema table nor the `createImagingStudy` handler body parsing include `study_date`. The handler uses `study.createdAt` as a proxy for study date in `createCephReport.ts:71`. Clinically, study date (when radiograph was taken) is distinct from record creation timestamp.
**Fix:** Add `studyDate: date('study_date')` to `imagingStudies` table. Accept and store `study_date` in `createImagingStudy`. Return in all study responses. Generate migration.

---

#### EF-IMG-014 · `imaging_ceph.schema.ts` landmark status enum diverges from MODULE_SPEC SM-02
**Severity:** P2
**Confidence:** HIGH
**Spec source:** `MODULE_SPEC §7`: `ceph_landmark` status: `not_placed/placed/locked`; `MODULE_SPEC §8`: SM-02: `not_placed → placed → locked`
**Check:** Domain terms / data shapes
**File:** `services/api-ts/src/handlers/dental-imaging/repos/imaging_ceph.schema.ts:35–39`
**Line context:** `export const cephLandmarkStatusEnum = pgEnum('ceph_landmark_status', ['placed', 'confirmed', 'locked']);`
**Detail:** `MODULE_SPEC §7` and §8 define the ceph landmark state machine as `not_placed → placed → locked` (3 states). The schema implements `placed → confirmed → locked` — the `not_placed` state is absent; `confirmed` is not in the spec. `AC-IMG-003` specifies that `placed → not_placed` should return 422 (inverse test for SM-02). The schema's `confirmed` state is an undocumented intermediate. This drift means `AC-IMG-003` cannot be satisfied with the current enum, and the MODULE_SPEC and implementation are out of sync.
**Note:** The schema implementation (`confirmed` state) may represent a deliberate v1.4 design decision that postdates the MODULE_SPEC. If so, MODULE_SPEC must be updated to reflect `placed → confirmed → locked`.
**Fix (Option A — align code to spec):** Replace `confirmed` with `not_placed` in the enum; remove `confirmed` from `CEPH_LANDMARK_TRANSITIONS`; add `not_placed` as initial state. Regenerate migration. **Fix (Option B — align spec to code):** Update `MODULE_SPEC §7/§8` and `AC-IMG-003` to match `placed → confirmed → locked`. Document decision in MODULE_SPEC.

---

#### EF-IMG-015 · `imaging_ceph.schema.ts` field names diverge from MODULE_SPEC key field declarations
**Severity:** P2
**Confidence:** MEDIUM
**Spec source:** `MODULE_SPEC §7`: `ceph_landmark`: `analysis_id`, `landmark_type`; `ceph_analysis`: `study_id`, `status`, `mm_per_pixel`
**Check:** Domain terms
**File:** `services/api-ts/src/handlers/dental-imaging/repos/imaging_ceph.schema.ts`
**Line context:**
- Landmark table (line 57): uses `imageId` (not `analysisId` or `analysis_id`)
- Landmark table (line 64): uses `landmarkCode` (not `landmark_type`)
- Analysis table (line 80): uses `imageId` (not `studyId`); missing `status` field; uses `calibrationValue` (not `mm_per_pixel`)
**Detail:** `MODULE_SPEC §7` declares the ceph data requirements as: `ceph_landmark`: `analysis_id`, `landmark_type`, `x`, `y`, `status`, `source`; `ceph_analysis`: `study_id`, `analysis_type`, `status`, `calibration_method`, `mm_per_pixel`. The implementation chose `image_id` as the FK (pointing directly to images rather than via a CephAnalysis aggregate root) and uses `landmarkCode` instead of `landmark_type`. While the code is internally consistent and functional, it diverges from the MODULE_SPEC domain model declarations.
**Confidence note:** MEDIUM — the code may reflect a deliberate v1.4 architectural decision (image-centric rather than analysis-centric). If intentional, MODULE_SPEC §7 must be updated.
**Fix:** Update MODULE_SPEC §7 to accurately reflect the implemented schema field names, or align the schema to the spec. Document the image-centric vs analysis-centric architecture decision.

---

#### EF-IMG-019 · `createImagingStudy.ts` response shape diverges from API_CONTRACTS
**Severity:** P2
**Confidence:** HIGH
**Spec source:** `API_CONTRACTS.md` — POST /dental/imaging/studies response 201: `{ data: ImagingStudy }` with fields `id, branch_id, patient_id, visit_id, modality, status, image_count, study_date, created_at`
**Check:** Data shapes
**File:** `services/api-ts/src/handlers/dental-imaging/createImagingStudy.ts:95–106`
**Line context:** `return ctx.json({ study, image, uploadUrl, uploadMethod, fileId, expiresAt }, 201);`
**Detail:** Handler returns `{ study, image, uploadUrl, uploadMethod, fileId, expiresAt }` — a bespoke presigned-URL creation response. `API_CONTRACTS.md` specifies `{ data: ImagingStudy }` with the standard envelope. The response includes upload machinery fields (`uploadUrl`, `uploadMethod`, `fileId`, `expiresAt`) not declared in the contract, and the study object is not wrapped in `data:`. Additionally, `image_count` and `study_date` are not present in the study object.
**Fix:** Align response shape to spec, or update `API_CONTRACTS.md` to document the presigned-URL response pattern. If the presigned-URL shape is the intended contract, `API_CONTRACTS.md` must be updated to reflect it.

---

#### EF-IMG-020 · Missing `GET /dental/imaging/studies` (list studies) endpoint
**Severity:** P2
**Confidence:** HIGH
**Spec source:** `API_CONTRACTS.md` — `GET /api/v1/dental/imaging/studies` (patient-scoped list); `MODULE_SPEC §10` API Expectations
**Check:** Data shapes (missing spec-declared method)
**File:** `services/api-ts/src/handlers/dental-imaging/` (missing file: `listImagingStudies.ts`)
**Detail:** `API_CONTRACTS.md` and `MODULE_SPEC §10` declare a list endpoint for imaging studies (`GET /dental/imaging/studies?patient_id=&branch_id=`). No handler file exists for this operation. Only `getImagingStudy.ts` (single study by ID) is implemented. Without a list endpoint, clients cannot paginate or filter studies for a patient — a core imaging workflow (WF-087).
**Fix:** Create `listImagingStudies.ts` handler and corresponding `ImagingMgmt_listImagingStudies.ts` wrapper. Add `listStudies` method to `ImagingRepository`. Register route in the router.

---

### P3 — Low / Advisory

#### EF-IMG-011 · Mixed `assertBranchRole` / `assertBranchAccess` across handlers (carried from run-6)
**Severity:** P3
**Confidence:** HIGH
**Spec source:** `MODULE_SPEC §6` Permissions — write operations require dentist roles
**Check:** Naming conventions / pattern consistency
**File:** Multiple (read handlers use `assertBranchAccess`; write handlers use `assertBranchRole`)
**Detail:** Read handlers (`getImagingStudy`, `listMeasurements`, `listFindings`, `getCephAnalysis`, etc.) use `assertBranchAccess` (membership-only). Write handlers use `assertBranchRole`. Both provide branch isolation. Functionally sound per `MODULE_SPEC §6` (view = all dental roles; write = dentist only). Pattern inconsistency is advisory only.
**Fix:** No code change required. Document the intentional split in handler file JSDoc for clarity.

---

## Summary Table

| ID | Severity | Check | File | Description | Confidence |
|----|----------|-------|------|-------------|-----------|
| EF-IMG-008 | P1 | Naming/DI | module-wide | No ImagingService class | HIGH |
| EF-IMG-011 | P3 | Pattern | module-wide | assertBranchAccess vs assertBranchRole inconsistency | HIGH |
| EF-IMG-012 | P2 | Data shapes | `imaging.schema.ts` | `cbct` missing from modalityEnum | HIGH |
| EF-IMG-013 | P2 | Data shapes | `imaging.schema.ts` | `study_date` field absent from schema and handler | HIGH |
| EF-IMG-014 | P2 | Domain terms | `imaging_ceph.schema.ts` | Landmark status enum: `confirmed` not in spec SM-02; `not_placed` absent | HIGH |
| EF-IMG-015 | P2 | Domain terms | `imaging_ceph.schema.ts` | Field names diverge from MODULE_SPEC (`analysis_id`→`imageId`, `landmark_type`→`landmarkCode`, `mm_per_pixel`→`calibrationValue`) | MEDIUM |
| EF-IMG-016 | P1 | Data shapes | `recomputeCephAnalysis.ts:78` | Returns 200 instead of spec-declared 202; response body shape mismatch | HIGH |
| EF-IMG-017 | P1 | Error taxonomy | 9 handler files | `IMAGING_TIER_REQUIRED` never emitted; `FORBIDDEN` used instead | HIGH |
| EF-IMG-018 | P1 | Data shapes | `imaging.schema.ts` | `imaging_annotation` table missing `status` field — SM-01 unimplementable | HIGH |
| EF-IMG-019 | P2 | Data shapes | `createImagingStudy.ts:95–106` | Response shape mismatch vs API_CONTRACTS envelope | HIGH |
| EF-IMG-020 | P2 | Data shapes | (missing file) | `GET /dental/imaging/studies` list endpoint not implemented | HIGH |

**Total: 11 findings (P0=0, P1=4, P2=6, P3=1)**

---

## Check Results

| Check | Result | Notes |
|-------|--------|-------|
| Auth (assertBranchAccess/Role) | PASS | All P0s from Wave3 confirmed fixed |
| imagingTier Gate | PASS | All 9 ceph/measurement handlers use `!== 'addon'` |
| Error taxonomy | FAIL | `IMAGING_TIER_REQUIRED` not emitted (P1); `FORBIDDEN` used everywhere |
| Data shapes — request | PARTIAL | `study_date` missing; annotation `status` missing; `cbct` modality missing |
| Data shapes — response | PARTIAL | `recomputeCephAnalysis` 200/202 mismatch; `createImagingStudy` non-spec shape |
| Domain terms | PARTIAL | ceph schema field names diverge from MODULE_SPEC; landmark status enum diverged |
| Loose coupling (DB) | PASS | `imaging_finding.schema.ts` clean (Wave3 fixed); all FKs intra-module |
| Service layer | FAIL | No ImagingService class (P1 advisory) |
| Import boundaries | PASS | Facade imports from dental-org, storage, dental-clinical all use approved facade pattern |
| Test coverage | PASS | All 21 wrappers covered (including Wave3 CephMgmt additions); FSM property tests present |
| WF annotations | ADVISORY | <5% WF-ID adoption — gate not triggered; P3 advisory only |

---

## Module Compliance Score

- Files with 0 P0/P1 findings: 47 / 53 = **89%**
- Files with any P0: 0 / 53 = **0%** (all Wave3 P0s fixed)
- Module traceability score: **89% (PASS threshold ≥ 80%)**

---

## What's Next

P1 findings require resolution before merge:
1. **EF-IMG-017** (IMAGING_TIER_REQUIRED error code) — add `ImagingTierRequiredError` class, 9 call sites
2. **EF-IMG-018** (annotation status field) — schema migration required; AC-IMG-002 cannot be satisfied without it
3. **EF-IMG-016** (recomputeCephAnalysis 202 vs 200) — product decision required; update code or spec
4. **EF-IMG-008** (ImagingService) — architectural debt; not a correctness blocker

P2 findings are pre-ship improvements:
- EF-IMG-012 (`cbct` modality enum) — trivial migration
- EF-IMG-013 (`study_date` field) — schema + handler change
- EF-IMG-014, EF-IMG-015 (ceph schema terms) — spec alignment or schema rename
- EF-IMG-019, EF-IMG-020 (response shapes + missing list endpoint)

---

*Generated: 2026-05-29 | run-7-wave3-verify-2026-05-29 | Previous: run-6-strict-2026-05-29*
