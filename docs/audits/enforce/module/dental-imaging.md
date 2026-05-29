<!-- oli-version: 1.1 | generated: 2026-05-29 | skill: oli-enforce-module | run: 7 | module: dental-imaging -->

# Enforcement Report: dental-imaging

**Run:** 7 | **Date:** 2026-05-29 | **Skill:** oli-enforce-module v1.1
**Spec:** docs/product/modules/dental-imaging/MODULE_SPEC.md (v1.0, 2026-05-24)
**Handler path:** services/api-ts/src/handlers/dental-imaging/
**Codebase-map artifacts:** ABSENT — fallback to source scanning (all dimensions)
**Auth verification method:** Three-tier (handler → router → app level)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total findings | 17 |
| P0 (critical) | 2 |
| P1 (missing spec-declared items) | 8 |
| P2 (drift/inconsistency) | 5 |
| P3 (optional/deferred) | 2 |
| Compliance score | 42 / 100 |
| v1 status | PARTIAL |
| Service layer | ABSENT |

Wave 3 claimed 56 P0 regressions fixed. This run-7 audit confirms auth middleware is consistently applied across all 21 registered routes (no auth P0s). Residual gaps: **2 new P0s** (schema divergence that breaks AC-IMG-002 and AC-IMG-003), **8 P1s** (missing endpoints, unpublished events, absent guards), **5 P2s** (domain term drift, schema field mismatches).

---

## Dimension 1: Public API Completeness

**Spec §10 declares 9 endpoint shapes.** Checked against registered routes in `services/api-ts/src/generated/openapi/routes.ts`.

### FOUND (7/9)

| Endpoint | Route | Handler | Status |
|----------|-------|---------|--------|
| POST /dental/imaging/studies | routes.ts:733 | ImagingMgmt_createImagingStudy | FOUND |
| GET /dental/imaging/studies/:studyId | routes.ts:740 | ImagingMgmt_getImagingStudy | FOUND |
| POST /dental/imaging/images/:imageId/findings | routes.ts:688 | ImagingFindingsMgmt_createFinding | FOUND |
| POST /dental/imaging/images/:imageId/ceph/landmarks | routes.ts:643 | CephMgmt_batchUpsertCephLandmarks | FOUND (path differs from spec) |
| PATCH /dental/imaging/images/:imageId/ceph/landmarks/:code | routes.ts:658 | CephMgmt_updateCephLandmark | FOUND (path differs from spec) |
| POST /dental/imaging/images/:imageId/ceph/analysis/recompute | routes.ts:636 | CephMgmt_recomputeCephAnalysis | FOUND (path differs from spec) |
| GET /dental/patients/:patientId/images | routes.ts:974 | PatientImageMgmt_listPatientImages | FOUND |

### MISSING (2/9)

---

### EM-IMG-001 — P1 — GET /dental/imaging/studies (patient-scoped list) Missing

**Spec §10:** `GET /dental/imaging/studies (patient-scoped)` is a declared API requirement for WF-087 (View Imaging Study List).

**Finding:** No route matching `GET /dental/imaging/studies` (with patientId query param) exists in `routes.ts`. The only study-level GET is `GET /dental/imaging/studies/:studyId` (single-study fetch). `PatientImageMgmt_listPatientImages` at `/dental/patients/:patientId/images` returns a cross-source image union but does NOT return study container objects.

**File:** services/api-ts/src/generated/openapi/routes.ts (no `GET /dental/imaging/studies` entry)
**Confidence:** HIGH
**Spec section:** §10 API Expectations, §3 WF-087

---

### EM-IMG-002 — P1 — POST/PATCH Annotation Endpoints Missing

**Spec §10:** `POST /dental/imaging/studies/:id/annotations` and `PATCH /dental/imaging/studies/:id/annotations/:aid`

**Finding:** No routes matching either pattern exist. Annotation storage is handled via `createMeasurement` / `deleteMeasurement` at `/dental/imaging/images/:imageId/measurements`. This diverges from the spec URL scheme and lacks a PATCH endpoint. WF-020 step 4 ("only creator may edit") has no enforcement path since no annotation update handler exists.

**Files:** services/api-ts/src/generated/openapi/routes.ts (absent), services/api-ts/src/handlers/dental-imaging/createMeasurement.ts
**Confidence:** HIGH
**Spec section:** §10, §4 WF-020

---

## Dimension 2: Workflow Implementation

**Workflows assigned to dental-imaging:** WF-019, WF-020, WF-030, WF-031, WF-040, WF-067, WF-087

| WF | Name | Code Path | Status |
|----|------|-----------|--------|
| WF-019 | Upload Radiographic Study | createImagingStudy.ts — presigned URL, BR-034 MIME check, assertBranchRole | PARTIAL (step 5 pending_review→reviewed absent — EM-IMG-006) |
| WF-020 | Annotate Radiograph | createMeasurement.ts handles geometry overlays | PARTIAL (no update path, creator ownership not enforced — EM-IMG-002) |
| WF-040 | Record Imaging Finding | createFinding.ts, updateFinding.ts, listFindings.ts, deleteFinding.ts | PRESENT |
| WF-067 | Add Images to Study | No dedicated add-image-to-existing-study handler found | PARTIAL |
| WF-087 | View Imaging Study List | No list endpoint | ABSENT (EM-IMG-001) |
| WF-030 | Run Ceph Analysis | batchUpsertCephLandmarks + getCephAnalysis + recomputeCephAnalysis | PRESENT |
| WF-031 | Place/Adjust Ceph Landmarks | updateCephLandmark.ts with SM-02 guard | PRESENT (SM-02 states differ — EM-IMG-004) |

---

## Dimension 3: Domain Term Consistency

### EM-IMG-003 — P2 — SM-01 Finding States Diverge from Spec

**Spec §8 / DOMAIN_MODEL §6 SM-IMAGING-FINDING:**
```
draft → confirmed → resolved
```
AC-IMG-002: `confirmed → draft → 422 (SM-01)`.

**Code (`imaging_finding.schema.ts:33–47`):**
```typescript
imagingFindingStatusEnum: ['suspected', 'confirmed', 'monitoring', 'resolved']
FINDING_TRANSITIONS = {
  suspected: ['confirmed', 'monitoring', 'resolved'],
  confirmed: ['monitoring', 'resolved'],
  monitoring: ['confirmed', 'resolved'],
  resolved: [],
}
```

4 states vs 3 in spec. Initial state is `suspected` (not `draft`). State `monitoring` is undeclared in spec. State `draft` does not exist in code — AC-IMG-002 is literally untestable.

**File:** services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.schema.ts:33–47
**Confidence:** HIGH
**Spec section:** §8, §11 AC-IMG-002

---

### EM-IMG-004 — P2 — SM-02 Ceph Landmark States Diverge from Spec

**Spec §8 / DOMAIN_MODEL §6 SM-CEPH-LANDMARK:**
```
not_placed → placed → locked
```
AC-IMG-003: `placed → not_placed → 422 (SM-02)`.

**Code (`imaging_ceph.schema.ts:34–39`):**
```typescript
cephLandmarkStatusEnum: ['placed', 'confirmed', 'locked']
CEPH_LANDMARK_TRANSITIONS = { placed: ['confirmed'], confirmed: ['locked'], locked: [] }
```

State `not_placed` does not exist — AC-IMG-003 is untestable. Code adds undeclared `confirmed` intermediate state.

**File:** services/api-ts/src/handlers/dental-imaging/repos/imaging_ceph.schema.ts:34–39
**Confidence:** HIGH
**Spec section:** §8, §11 AC-IMG-003

---

### EM-IMG-005 — P2 — imaging_annotation Has No status Field; Field Renamed

**Spec §7:** `imaging_annotation: id, study_id, image_id, type (enum), coordinates (JSONB), status (draft/confirmed/resolved)`

**Code (`imaging.schema.ts:95–111`):** The `imagingAnnotations` table has no `status` column. The JSONB payload column is named `geometry` (code) vs `coordinates` (spec). Both are schema-level divergences.

**File:** services/api-ts/src/handlers/dental-imaging/repos/imaging.schema.ts:95–111
**Confidence:** HIGH
**Spec section:** §7 Data Requirements

---

### EM-IMG-006 — P2 — imaging_study Missing study_type, capture_method, pending_review Status

**Spec §7:** `imaging_study: id, patient_id, branch_id, dentist_member_id, study_type (enum), capture_method (enum), created_at`
**Spec §4 WF-019 step 5:** Created in `pending_review` → transitions to `reviewed`.

**Code:** `imagingStudies` table has `modality` but no `study_type` or `capture_method`. Status enum is `['active', 'archived']` — `pending_review` and `reviewed` absent.

**File:** services/api-ts/src/handlers/dental-imaging/repos/imaging.schema.ts
**Confidence:** HIGH
**Spec section:** §7, §4 WF-019

---

### EM-IMG-007 — P2 — ceph_analysis Missing status; ceph_landmark FK to image_id not analysis_id

**Spec §7:** `ceph_analysis: id, study_id, analysis_type, status, calibration_method, mm_per_pixel`; `ceph_landmark: id, analysis_id, landmark_type, x, y, status, source`

**Code:** `imagingCephAnalyses` has no `status` field. `imagingCephLandmarks` has `imageId` FK (not `analysisId`), uses `landmarkCode` text (not enum `landmark_type`), and has no connection to `ceph_analysis` via FK. This is an architectural divergence (image-centric vs analysis-centric).

**File:** services/api-ts/src/handlers/dental-imaging/repos/imaging_ceph.schema.ts:57–130
**Confidence:** HIGH
**Spec section:** §7 Data Requirements

---

## Dimension 4: State Machine Enforcement

SM-01 guard is implemented in `updateFinding.ts` via `FINDING_TRANSITIONS`. SM-02 guard is implemented in `updateCephLandmark.ts` via `CEPH_LANDMARK_TRANSITIONS`. Both guards are structurally correct for the code's state set — they enforce the wrong state machines (see EM-IMG-003/004).

### EM-IMG-008 — P0 — AC-IMG-002 and AC-IMG-003 Structurally Untestable

AC-IMG-002: "confirmed → draft → 422 (SM-01)" — `draft` is not an enum value in `imagingFindingStatusEnum`. A consumer passing `status: "draft"` gets a Zod validation error, not a 422 INVALID_STATUS_TRANSITION as specified.

AC-IMG-003: "placed → not_placed → 422 (SM-02)" — `not_placed` is not an enum value in `cephLandmarkStatusEnum`. Same outcome.

Both acceptance criteria are **structurally unenforceable** with current schemas. This is a contract violation for any consumer depending on the error shape.

**Files:**
- services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.schema.ts:33–47
- services/api-ts/src/handlers/dental-imaging/repos/imaging_ceph.schema.ts:35–39
**Confidence:** HIGH
**Spec section:** §11 AC-IMG-002, AC-IMG-003

---

## Dimension 5: Event Publishing

**Spec §10b declares 3 published events:** DE-018 `ImagingStudyUploaded`, DE-019 `ImagingFindingConfirmed`, DE-020 `CephAnalysisComputed`.

Grep across all dental-imaging handler files for event bus / emit / publish patterns returned no results. Only `logAuditEvent` (audit trail, not domain events) is present.

### EM-IMG-009 — P1 — DE-018 ImagingStudyUploaded Not Published

`createImagingStudy.ts` writes an audit log but does not publish `ImagingStudyUploaded`.

**File:** services/api-ts/src/handlers/dental-imaging/createImagingStudy.ts
**Confidence:** HIGH — **Spec section:** §10b

---

### EM-IMG-010 — P1 — DE-019 ImagingFindingConfirmed Not Published

`updateFinding.ts` guards the `→ confirmed` transition but does not publish `ImagingFindingConfirmed`. DOMAIN_MODEL §5 lists dental-clinical and dental-audit as consumers.

**File:** services/api-ts/src/handlers/dental-imaging/updateFinding.ts
**Confidence:** HIGH — **Spec section:** §10b

---

### EM-IMG-011 — P1 — DE-020 CephAnalysisComputed Not Published

`recomputeCephAnalysis.ts` and `batchUpsertCephLandmarks.ts` complete analysis computation but publish nothing.

**Files:** services/api-ts/src/handlers/dental-imaging/recomputeCephAnalysis.ts, batchUpsertCephLandmarks.ts
**Confidence:** HIGH — **Spec section:** §10b

---

## Dimension 6: Unprotected Route Detection

All 21 dental-imaging routes checked for `authMiddleware()` in `routes.ts`:

| Route | Auth | Status |
|-------|------|--------|
| PATCH /dental/imaging/findings/:findingId | authMiddleware() | PROTECTED |
| DELETE /dental/imaging/findings/:findingId | authMiddleware() | PROTECTED |
| DELETE /dental/imaging/images/:imageId | authMiddleware() | PROTECTED |
| PATCH /dental/imaging/images/:imageId/calibration | authMiddleware() | PROTECTED |
| GET /dental/imaging/images/:imageId/ceph/analysis | authMiddleware() | PROTECTED |
| POST /dental/imaging/images/:imageId/ceph/analysis/recompute | authMiddleware() | PROTECTED |
| POST /dental/imaging/images/:imageId/ceph/landmarks | authMiddleware() | PROTECTED |
| GET /dental/imaging/images/:imageId/ceph/landmarks | authMiddleware() | PROTECTED |
| PATCH /dental/imaging/images/:imageId/ceph/landmarks/:landmarkCode | authMiddleware() | PROTECTED |
| DELETE /dental/imaging/images/:imageId/ceph/landmarks/:landmarkCode | authMiddleware() | PROTECTED |
| POST /dental/imaging/images/:imageId/ceph/reports | authMiddleware() | PROTECTED |
| GET /dental/imaging/images/:imageId/ceph/reports | authMiddleware() | PROTECTED |
| POST /dental/imaging/images/:imageId/findings | authMiddleware() | PROTECTED |
| GET /dental/imaging/images/:imageId/findings | authMiddleware() | PROTECTED |
| POST /dental/imaging/images/:imageId/measurements | authMiddleware() | PROTECTED |
| GET /dental/imaging/images/:imageId/measurements | authMiddleware() | PROTECTED |
| PATCH /dental/imaging/images/:imageId/modality | authMiddleware() | PROTECTED |
| DELETE /dental/imaging/measurements/:measurementId | authMiddleware() | PROTECTED |
| POST /dental/imaging/studies | authMiddleware() | PROTECTED |
| GET /dental/imaging/studies/:studyId | authMiddleware() | PROTECTED |
| GET /dental/patients/:patientId/images | authMiddleware() | PROTECTED |

**Result: 21/21 routes protected. No unprotected routes. Wave 3 auth fixes confirmed effective.**

---

## Additional Findings

### EM-IMG-012 — P1 — Error Codes IMAGING_TIER_REQUIRED and NOT_CALIBRATED Not Used

**Spec §15:**
- `imagingTier insufficient → 403, IMAGING_TIER_REQUIRED`
- `Not calibrated → 422, NOT_CALIBRATED`

Code throws `ForbiddenError(message)` with no machine-readable code. Neither `IMAGING_TIER_REQUIRED` nor `NOT_CALIBRATED` appears in any handler source. Machine-readable error codes are required for contract compliance.

**Files:** services/api-ts/src/handlers/dental-imaging/getCephAnalysis.ts:44, batchUpsertCephLandmarks.ts:56
**Confidence:** HIGH — **Spec section:** §15

---

### EM-IMG-013 — P1 — NOT_CALIBRATED Guard Absent Before Landmark Placement

**Spec §13 Edge Case:** "Calibration not set before landmark placement → 422 NOT_CALIBRATED"

`batchUpsertCephLandmarks.ts` and `updateCephLandmark.ts` proceed regardless of whether `image.pixelSpacingMm` is null. No calibration pre-check exists.

**Files:** services/api-ts/src/handlers/dental-imaging/batchUpsertCephLandmarks.ts, updateCephLandmark.ts
**Confidence:** HIGH — **Spec section:** §13, §15

---

### EM-IMG-014 — P0 — Observability Hooks Not Implemented Per Spec §17

**Spec §17 requires:**
- `dental-imaging.study-uploaded` (INFO, studyId, branchId)
- `dental-imaging.ceph-computed` (INFO)
- `dental-imaging.tier-blocked` (WARN, tier, feature)

Code: `createImagingStudy.ts` has no structured log with key `dental-imaging.study-uploaded`. Ceph handlers log generic messages (not spec-declared hook names). No `dental-imaging.tier-blocked` WARN is emitted on tier gate fires — all tier-block paths are silent `ForbiddenError` throws.

The `dental-imaging.tier-blocked` WARN is operationally critical for monitoring upgrade conversion rates; its absence is rated P0.

**Files:** services/api-ts/src/handlers/dental-imaging/createImagingStudy.ts, getCephAnalysis.ts, batchUpsertCephLandmarks.ts, updateCephLandmark.ts, deleteCephLandmark.ts, recomputeCephAnalysis.ts
**Confidence:** HIGH — **Spec section:** §17

---

### EM-IMG-015 — P3 — WF-019 Step 5 Study Review State Not Implemented

**Spec §4 WF-019 step 5:** "Study created in `pending_review` state → dentist reviews → transitions to `reviewed`."

The `imagingStudies.status` enum is `['active', 'archived']`. No review state or transition handler exists.

**File:** services/api-ts/src/handlers/dental-imaging/repos/imaging.schema.ts:39
**Confidence:** HIGH — **Spec section:** §4 WF-019

---

### EM-IMG-016 — P3 — Feature Flags Not Implemented

**Spec §18:** `dental_imaging_ceph_enabled` (default: false) and `dental_imaging_auto_landmark` (default: false).

No feature flag checks exist in any handler. imagingTier gate is the only runtime check but operates on subscription tier, not a deployable feature flag.

**Confidence:** HIGH — **Spec section:** §18

---

### EM-IMG-017 — P1 — Service Layer Absent

All business logic (BR-034, BR-016c, SM-01, SM-02, D-L gate) lives inline in handler functions. No `*.service.ts` or service class exists. Logic cannot be unit-tested without HTTP context and cannot be reused across handlers.

**Files:** services/api-ts/src/handlers/dental-imaging/ (all handlers)
**Confidence:** HIGH — **Spec section:** ARCHITECTURE.md Module Structure

---

## Compliance Score

### Per-Dimension Scores

| Dimension | Score (0–10) | Notes |
|-----------|-------------|-------|
| 1. API Completeness | 6/10 | 7/9 spec endpoints present; 2 missing |
| 2. Workflow Implementation | 5/10 | 4/7 fully present; 2 partial; 1 absent |
| 3. Domain Term Consistency | 3/10 | SM states wrong; 3+ schema fields missing/renamed |
| 4. State Machine Enforcement | 4/10 | Guards exist but enforce wrong states; 2 ACs untestable |
| 5. Event Publishing | 0/10 | 0/3 declared events published |
| 6. Unprotected Routes | 10/10 | All 21 routes auth-protected |

**Raw average:** (6+5+3+4+0+10)/6 = 4.67 → **47/100**
**P0 cap applied (2 P0s):** capped at **42/100**

**Final compliance score: 42 / 100**

---

## Finding Index

| ID | Sev | Title | File |
|----|-----|-------|------|
| EM-IMG-001 | P1 | GET /dental/imaging/studies list Missing | routes.ts |
| EM-IMG-002 | P1 | POST/PATCH annotation endpoints Missing | routes.ts |
| EM-IMG-003 | P2 | SM-01 Finding States Diverge (suspected vs draft) | imaging_finding.schema.ts |
| EM-IMG-004 | P2 | SM-02 Ceph Landmark States Diverge (confirmed vs not_placed) | imaging_ceph.schema.ts |
| EM-IMG-005 | P2 | imaging_annotation missing status; coordinates→geometry rename | imaging.schema.ts |
| EM-IMG-006 | P2 | imaging_study missing study_type, capture_method, pending_review | imaging.schema.ts |
| EM-IMG-007 | P2 | ceph_analysis missing status; ceph_landmark FK to image not analysis | imaging_ceph.schema.ts |
| EM-IMG-008 | P0 | AC-IMG-002 and AC-IMG-003 Structurally Untestable | imaging_finding.schema.ts, imaging_ceph.schema.ts |
| EM-IMG-009 | P1 | DE-018 ImagingStudyUploaded Not Published | createImagingStudy.ts |
| EM-IMG-010 | P1 | DE-019 ImagingFindingConfirmed Not Published | updateFinding.ts |
| EM-IMG-011 | P1 | DE-020 CephAnalysisComputed Not Published | recomputeCephAnalysis.ts |
| EM-IMG-012 | P1 | Error Codes IMAGING_TIER_REQUIRED / NOT_CALIBRATED Not Used | getCephAnalysis.ts + others |
| EM-IMG-013 | P1 | NOT_CALIBRATED Guard Absent Before Landmark Placement | batchUpsertCephLandmarks.ts |
| EM-IMG-014 | P0 | Observability Hooks Not Implemented (spec §17) | createImagingStudy.ts + others |
| EM-IMG-015 | P3 | WF-019 Step 5 Study Review State Not Implemented | imaging.schema.ts |
| EM-IMG-016 | P3 | Feature Flags Not Implemented | all handlers |
| EM-IMG-017 | P1 | Service Layer Absent | all handlers |

---

## Stabilization Plan

### Fix Now (P0)

1. **EM-IMG-008** — Schema alignment for SM-01 and SM-02. Requires DB migration + schema file + transition table update. Two options: (A) align code to spec (`suspected→draft`, remove `monitoring`; `confirmed→placed`, add `not_placed` to ceph) — preferred; (B) update spec with domain expert sign-off.

2. **EM-IMG-014** — Add structured log emissions with spec-declared hook names. Add WARN log in all tier-gate throws.

### Fix Before New Work (P1)

3. **EM-IMG-001** — Add `GET /dental/imaging/studies` handler with patientId + branchId query, TypeSpec definition, route registration.

4. **EM-IMG-002** — Add annotation CRUD endpoints or reconcile spec URL scheme to use measurements pattern (requires spec amendment).

5. **EM-IMG-009 / EM-IMG-010 / EM-IMG-011** — Implement DE-018, DE-019, DE-020 event publishing via project event bus.

6. **EM-IMG-012** — Add `IMAGING_TIER_REQUIRED` and `NOT_CALIBRATED` machine-readable error codes to respective throws.

7. **EM-IMG-013** — Add calibration pre-check in `batchUpsertCephLandmarks` and `updateCephLandmark`: if `image.pixelSpacingMm` is null, throw 422 `NOT_CALIBRATED`.

8. **EM-IMG-017** — Extract business logic to a service class (start with tier-gate and state-machine logic).

### Fix When Touching (P2)

9. **EM-IMG-003 / EM-IMG-004** — Resolved automatically by EM-IMG-008 fix.

10. **EM-IMG-005** — Add `status` column to `imaging_annotation`; resolve coordinates vs geometry naming.

11. **EM-IMG-006** — Add `study_type`, `capture_method` columns; extend status enum.

12. **EM-IMG-007** — Architectural decision: keep image-centric landmark model (update spec) or migrate to analysis-centric.

### Track (P3)

13. **EM-IMG-015** — Study review state: defer to review-workflow sprint.
14. **EM-IMG-016** — Feature flags: defer to feature-flag infrastructure sprint.

---

## What's Next

- **Immediate:** Fix EM-IMG-008 (P0 schema/SM mismatch) before any new imaging features land. This is a DB migration — coordinate with any existing data.
- **Sprint:** Run `/oli-enforce-fix --module=dental-imaging --severity=P1` after P0 resolution.
- **Spec reconciliation:** SM-01 `suspected` + `monitoring` states may be clinically correct for the dental domain. Requires dentist domain expert sign-off. If accepted, update MODULE_SPEC to match code and close EM-IMG-003/004 as spec amendments rather than code fixes.
- **Run 8 target:** Resolve 2 P0s + 8 P1s → expected score 72–78 / 100.
