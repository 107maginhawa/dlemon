<!-- oli-enforce-module: dental-imaging | generated: 2026-05-27 -->

# Enforcement Report: dental-imaging

**Module:** dental-imaging  
**Spec:** `docs/product/modules/dental-imaging/MODULE_SPEC.md` v1.0  
**Contracts:** `docs/product/modules/dental-imaging/API_CONTRACTS.md`  
**Reference:** `docs/audits/reference/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md` §3.10, §5.9  
**Reviewed:** 2026-05-27  
**Reviewer:** Claude (oli-enforce-module)  
**Depth:** deep (cross-file, all 7 declared workflows checked)

---

## Summary

All 7 declared workflows and all major handler paths were inspected. The implementation is substantially complete and structurally sound. However, **5 blockers and 7 warnings** were identified spanning: spec-declared error codes not emitted, domain events never published, a missing study-level state machine, `patient_display_id` using raw UUID instead of a human-readable identifier, a loose coupling boundary violation in `imaging_finding.schema.ts`, and several workflow gaps not enforced by any code path.

---

## Findings

### BLOCKER

---

#### BL-01: Domain events DE-018, DE-019, DE-020 never published

**Files:** All `dental-imaging` handlers  
**Spec refs:** MODULE_SPEC §10b, API_CONTRACTS.md (every endpoint that emits)

The spec declares three domain events:
- DE-018 `ImagingStudyUploaded` — published after first image added (POST studies + POST studies/:id/images)
- DE-019 `ImagingFindingConfirmed` — published when annotation status → confirmed
- DE-020 `CephAnalysisComputed` — published async on recompute completion

A grep over all handler files for `emit`, `publish`, `eventBus`, `publishEvent`, `DE-018`, `DE-019`, `DE-020` returns zero matches. No event bus call exists anywhere in the module. The events are listed in API_CONTRACTS.md under the `Events emitted:` field of four endpoints but are silently dropped.

**Impact:** Any downstream module that consumes these events (dental-pmd for PMD snapshot, audit trail, notifications) will never receive them. Represents a silent data pipeline break.

**Fix:** Implement event emission at each call site. Example for `createImagingStudy.ts`:
```typescript
// After repo.createImage()
await ctx.get('eventBus')?.publish('DE-018', {
  type: 'ImagingStudyUploaded',
  studyId: study.id,
  branchId: study.branchId,
  patientId: study.patientId,
  imageId: image.id,
});
```

---

#### BL-02: Error code `IMAGING_TIER_REQUIRED` never emitted — `ForbiddenError` emits `FORBIDDEN` instead

**Files:** `CephMgmt_batchUpsertCephLandmarks.ts`, `CephMgmt_createCephReport.ts`, `CephMgmt_recomputeCephAnalysis.ts`, `CephMgmt_updateCephLandmark.ts`, `CephMgmt_deleteCephLandmark.ts`, `CephMgmt_getCephAnalysis.ts`, `CephMgmt_listCephLandmarks.ts`, `CephMgmt_getCephReport.ts`, `createMeasurement.ts`

**Spec refs:** MODULE_SPEC §15, API_CONTRACTS.md (errors field on every ceph endpoint)

```
services/api-ts/src/core/errors.ts:30: ForbiddenError → code: 'FORBIDDEN'
```

Every tier-gate block throws `new ForbiddenError(...)` which emits `{ code: 'FORBIDDEN', statusCode: 403 }`. The spec contract declares `IMAGING_TIER_REQUIRED(403)` as the machine-readable code for this condition. Clients checking `body.code === 'IMAGING_TIER_REQUIRED'` to show an upgrade prompt will never match.

Checked via grep: `NOT_CALIBRATED`, `INSUFFICIENT_LANDMARKS`, `IMAGING_TIER_REQUIRED`, `UNSUPPORTED_MIME_TYPE` — none appear in any non-test handler file.

**Fix:** Either subclass `ForbiddenError` with a custom code, or pass the code to the constructor:
```typescript
throw new ForbiddenError('Cephalometric analysis requires an imaging add-on.', 'IMAGING_TIER_REQUIRED');
```
Apply to all 9 tier-gate throw sites.

---

#### BL-03: `imaging_finding.schema.ts` has DB-level FKs to other modules — violates loose coupling boundary

**File:** `services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.schema.ts` lines 11-13, 64-66

```typescript
import { dentalVisits } from '../../dental-visit/repos/visit.schema';
import { patients } from '../../patient/repos/patient.schema';
import { dentalBranches } from '../../dental-org/repos/branch.schema';
...
visitId: uuid('visit_id').references(() => dentalVisits.id),
patientId: uuid('patient_id').notNull().references(() => patients.id),
branchId: uuid('branch_id').notNull().references(() => dentalBranches.id),
```

**Spec refs:** MODULE_SPEC §1 "No DB-level FKs to other modules; UUID references only", MODULE_SPEC §7b "Both reference Patient, Visit by UUID only — no DB FKs (intentional loose coupling pattern)", MODULE_SPEC AI Instructions #1.

This is an explicit architectural rule repeated four times in the spec. The `imagingStudies` and `imagingStudyImages` tables correctly use bare `uuid()` columns with comment annotations. The `imaging_finding` table silently regresses to hard FKs on three cross-module tables. This creates schema-level coupling that will fail migrations if dental-visit or patient tables are renamed, and breaks the loose-coupling guarantee for the aggregate.

**Fix:** Remove `.references(() => ...)` from `visitId`, `patientId`, and `branchId`. Remove cross-module imports. Add comment annotations matching `imaging.schema.ts` pattern:
```typescript
// loose-coupling: references dental_visit.id (cross-module — no DB-level FK)
visitId: uuid('visit_id'),
// loose-coupling: references patients.id (cross-module — no DB-level FK)
patientId: uuid('patient_id').notNull(),
// loose-coupling: references dental_branch.id (cross-module — no DB-level FK)
branchId: uuid('branch_id').notNull(),
```

---

#### BL-04: `CephMgmt_recomputeCephAnalysis` missing `NOT_CALIBRATED` and `INSUFFICIENT_LANDMARKS` guard — spec declares both as 422 errors

**File:** `services/api-ts/src/handlers/dental-imaging/CephMgmt_recomputeCephAnalysis.ts`

**Spec refs:** API_CONTRACTS.md POST /api/v1/dental/imaging/ceph-analyses/:id/recompute, MODULE_SPEC §15

The spec contract for recompute declares:
```
Errors: NOT_FOUND(404), NOT_CALIBRATED(422), INSUFFICIENT_LANDMARKS(422), FORBIDDEN(403), IMAGING_TIER_REQUIRED(403)
```

The handler at line 60-68 calls `computeCephAnalysis(landmarkMap, ...)` and `upsertAnalysis()` unconditionally regardless of:
1. Whether any landmarks exist at all (INSUFFICIENT_LANDMARKS condition)
2. Whether calibration is present (NOT_CALIBRATED condition)

The `result.missing` field from `computeCephAnalysis` is computed but the handler proceeds to upsert and return 200 even when missing is non-empty. The spec's `Response 202` contract implies the endpoint should be gated, not silently succeed with partial data.

**Fix:**
```typescript
const allLandmarks = await cephRepo.listByImage(params.imageId);
if (allLandmarks.length === 0) {
  throw new BusinessLogicError('No landmarks placed. Place landmarks before recomputing.', 'INSUFFICIENT_LANDMARKS');
}
// Minimum required landmark count check (define threshold in schema constants)
const result = computeCephAnalysis(landmarkMap, image.pixelSpacingMm ?? null);
if (!image.pixelSpacingMm) {
  throw new BusinessLogicError('Image not calibrated. Set pixel spacing before recomputing.', 'NOT_CALIBRATED');
}
```

---

#### BL-05: `patient_display_id` in ceph report snapshot uses raw UUID — not a human-readable identifier

**File:** `services/api-ts/src/handlers/dental-imaging/CephMgmt_createCephReport.ts` line 106

```typescript
patient_display_id: study.patientId,  // raw UUID, not a human-readable display ID
```

**Spec refs:** MODULE_SPEC §4 WF-031 "Locked analysis results included in PMD export and printable ceph report", MODULE_SPEC D-4 "Snapshot includes study_date, patient_display_id, branch_name"

The field is named `patient_display_id` explicitly to hold a human-facing identifier (patient record number, name abbreviation, or similar) for the printable ceph report. Storing the raw UUID (`dddddddd-0000-0000-0000-000000000004`) in this field means printed ceph reports will show a UUID as the patient identifier, which is unusable in a clinical context. The patient module has a `displayId` or similar identifier that should be looked up.

**Fix:** Fetch the patient's display identifier before building the snapshot. This requires a cross-module read (acceptable for report generation, not for routine queries):
```typescript
// Fetch patient display ID (one-time read for immutable snapshot)
const patientRow = await db.select({ displayId: patients.displayId })
  .from(patients).where(eq(patients.id, study.patientId)).limit(1);
// ...
patient_display_id: patientRow[0]?.displayId ?? study.patientId,
```

---

### WARNING

---

#### WR-01: WF-019 study state machine (`pending_review → reviewed`) not implemented

**File:** `services/api-ts/src/handlers/dental-imaging/createImagingStudy.ts`, `repos/imaging.schema.ts`

**Spec refs:** MODULE_SPEC §4 WF-019 step 5: "Study created in `pending_review` state → dentist reviews → transitions to `reviewed`"

The `imagingStatusEnum` only defines `['active', 'archived']`. There is no `pending_review` or `reviewed` state. The `createImagingStudy` handler sets no explicit status on the study — it defaults to `active` via the enum default. The spec's two-step review workflow is entirely absent.

**Impact:** Studies are immediately `active` without any review gating. Any downstream assertion that a study is `reviewed` before findings can be added will fail silently.

**Fix:** Add `pending_review` and `reviewed` to `imagingStatusEnum`. Set initial status to `pending_review` on creation. Add a PATCH endpoint or handler for `reviewStudy` to transition to `reviewed`.

---

#### WR-02: `study_date` field falls back to `createdAt` — acknowledged gap in code comment

**File:** `services/api-ts/src/handlers/dental-imaging/CephMgmt_createCephReport.ts` line 82-83

```typescript
// study_date: use study.createdAt as fallback (no study_date column yet)
const studyDate = study.createdAt.toISOString().split('T')[0] ?? study.createdAt.toISOString();
```

**Spec refs:** MODULE_SPEC §7 `imaging_study` fields include `created_at` but API_CONTRACTS.md POST /dental/imaging/studies request body includes `study_date` (YYYY-MM-DD, required). The schema has no `study_date` column.

The handler acknowledges missing `study_date` in a comment. The API contract accepts a `study_date` on study creation but the schema never stores it. The ceph report snapshot uses `createdAt` as a substitute. For studies uploaded retroactively (common in dental practice), `createdAt` diverges from actual study date.

**Fix:** Add `studyDate date` column to `imaging_study` schema. Persist it in `createImagingStudy`. Use it in the ceph snapshot.

---

#### WR-03: `createImagingStudy` comment says "hygienist may upload" but `assertBranchRole` only allows `dentist_owner`, `dentist_associate`

**File:** `services/api-ts/src/handlers/dental-imaging/createImagingStudy.ts` lines 8 and 49

```typescript
// line 8: "Role-gated: dentist, associate, hygienist may upload."
// line 49: await assertBranchRole(db, user.id, body.branchId, ['dentist_owner', 'dentist_associate']);
```

Comment claims hygienist can upload. The role assertion forbids it. The spec §6 grants upload to `dentist_owner, dentist_associate` only — so the assertion is spec-correct but the comment is wrong. Same discrepancy in `updateImageModality.ts` lines 7 and 34.

**Impact:** Stale misleading comments cause maintenance confusion. If hygienist upload is intentional per clinic operations, the assertion needs updating. If not, the comment needs correction.

**Fix:** Align comment with assertion. If hygienist upload is desired, add `'hygienist'` to the role list and update MODULE_SPEC §6 accordingly:
```typescript
// Role-gated: dentist_owner and dentist_associate only per MODULE_SPEC §6
await assertBranchRole(db, user.id, body.branchId, ['dentist_owner', 'dentist_associate']);
```

---

#### WR-04: WF-019 `imagingTier` derivation from study type not implemented — tier check bypassed at study creation

**Spec refs:** MODULE_SPEC §4 WF-019 step 3: "`imagingTier` derived from study type: `basic` (periapical/bitewing), `panoramic` (OPG), `cbct` (3D)"

No handler derives or stores `imagingTier` from the modality at study creation time. The tier is checked at runtime from the organization's configured tier (via `resolveImagingTier`), but the spec describes a per-study computed tier for display/gating purposes. A user who uploads a `cephalometric` study on a free-tier org will only discover the tier block when they attempt ceph analysis, not at upload time.

**Impact:** Spec step 3 of WF-019 is silent — no validation, no storage, no UI feedback at upload time. This is a workflow gap, not a crash, but misleads users.

**Fix:** At study creation, derive and return an `effective_tier` field in the response indicating what features are available for this study modality. Block ceph-modality uploads if `imagingTier === 'free'`.

---

#### WR-05: `upsertAnalysis` in `ImagingCephRepository` does not update `calibrationValue`/`calibrationMethod` on conflict

**File:** `services/api-ts/src/handlers/dental-imaging/repos/imaging_ceph.repo.ts` lines 150-155

```typescript
.onConflictDoUpdate({
  target: [imagingCephAnalyses.imageId, imagingCephAnalyses.analysisType],
  set: {
    measurements: data.measurements,
    updatedAt: sql`now()`,
  },
```

The `onConflictDoUpdate` SET clause only updates `measurements` and `updatedAt`. It omits `calibrationValue`, `calibrationMethod`, `calibratedAt`, `calibratedBy`. When a user sets calibration and then re-runs landmark batch upsert (which calls `upsertAnalysis`), the calibration provenance fields from the new call are silently discarded.

**Impact:** After calibrating an image (`updateImageCalibration`), the analysis row retains the old `calibrationValue` until a manual recompute. D-J calibration provenance becomes stale.

**Fix:**
```typescript
.onConflictDoUpdate({
  target: [imagingCephAnalyses.imageId, imagingCephAnalyses.analysisType],
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

#### WR-06: WF-040 finding immutability after visit lock not enforced

**File:** `services/api-ts/src/handlers/dental-imaging/updateFinding.ts`

**Spec refs:** MODULE_SPEC §4 WF-040 step 5: "Findings are immutable after visit lock; amendments via WF-038 pattern"

`updateFinding` enforces the SM-01 state machine but does not check whether the parent visit is locked. There is no `visitLocked` check before allowing status/type/note edits. A finding on a locked visit can be freely mutated.

**Fix:** Before applying update, check visit lock status:
```typescript
if (finding.visitId) {
  const visit = await visitRepo.findById(finding.visitId);
  if (visit?.status === 'locked') {
    throw new BusinessLogicError('Cannot edit findings on a locked visit. Use the amendment workflow.', 'VISIT_LOCKED');
  }
}
```

---

#### WR-07: AC-IMG-002 (annotation status reversal 422) — no annotation status state machine exists

**Spec refs:** MODULE_SPEC §11 `AC-IMG-002: Annotation status reversal (confirmed → draft) → 422 (SM-01)`, MODULE_SPEC §8 "Annotation/Finding: draft → confirmed → resolved"

The spec defines SM-01 as applying to both annotations AND findings. The `imaging_annotation` table has no `status` column in `imaging.schema.ts`. There is no annotation update handler that enforces state transitions. The `PATCH /studies/:id/annotations/:aid` endpoint described in API_CONTRACTS.md has no implementation file in the handler directory.

Searching for annotation status state machine: zero matches. The `FINDING_TRANSITIONS` map exists only for findings. There is no `ANNOTATION_TRANSITIONS` equivalent.

**Impact:** AC-IMG-002 is untestable and not enforced. Annotations can be set to any status without guard. The spec acceptance criteria for this AC are silently unmet.

**Fix:** Add `status` column to `imaging_annotation` schema. Implement `ANNOTATION_TRANSITIONS` constant parallel to `FINDING_TRANSITIONS`. Add PATCH annotation handler with transition enforcement.

---

### INFO

---

#### IN-01: DICOM MIME type (`application/dicom`) absent from `ALLOWED_IMAGING_MIME_TYPES`

**File:** `services/api-ts/src/handlers/dental-imaging/repos/imaging.schema.ts` lines 120-125

```typescript
export const ALLOWED_IMAGING_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/tiff', 'image/bmp',
] as const;
```

MODULE_SPEC §4 WF-019 step 4 explicitly says: "File upload (DICOM or JPEG/PNG)". The DICOM MIME type `application/dicom` (and common alias `image/x-dicom`) is absent. This silently rejects all DICOM uploads with a 400/422 UNSUPPORTED_MIME_TYPE error, despite the spec listing DICOM as the primary format for clinical radiographs.

**Fix:** Add DICOM MIME types:
```typescript
export const ALLOWED_IMAGING_MIME_TYPES = [
  'application/dicom',
  'image/x-dicom',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/bmp',
] as const;
```

---

#### IN-02: `listPatientImages` missing `mimeType` and `fileSizeBytes` for imaging-source rows

**File:** `services/api-ts/src/handlers/dental-imaging/listPatientImages.ts` lines 86-99

```typescript
mimeType: '',       // empty string — no source of truth
fileSizeBytes: 0,   // zero — no source of truth
```

Legacy rows include proper `mimeType` and `fileSizeBytes` from `dental_attachment`. Imaging rows hardcode empty string / zero because `imaging_study_image` schema lacks these fields. The `PatientImageItem` interface declares both fields as non-nullable. Callers receiving imaging-source items will see misleading zero-byte sizes and empty MIME types.

---

#### IN-03: Ceph report `imagingTier` check uses `resolveImagingTier(...) === 'free'` but `resolveImagingTier` in `organization.schema.ts` is not visible in this review — verify null-tier → free mapping is the only gate

The module spec requires `cbct` tier for ceph (BR-016c), but all handlers gate only on `!== 'free'`. A `basic` or `panoramic` tier org would pass the gate and access full ceph analysis. This may be intentional (any paid tier = ceph access) but contradicts the spec text: "imagingTier = cbct required" in WF-030. Verify `resolveImagingTier` maps `basic`/`panoramic` → non-free, and whether the spec's "cbct required" means the cbct tier specifically.

---

## Workflow Coverage Matrix

| Workflow | Declared | Backend handler(s) exist | State machine enforced | Tests present | Status |
|----------|----------|--------------------------|----------------------|---------------|--------|
| WF-019 Upload study | YES | `createImagingStudy.ts` | PARTIAL (no `pending_review/reviewed`) | YES | PARTIAL |
| WF-020 Annotate radiograph | YES | `createMeasurement.ts` | PARTIAL (no annotation status SM) | YES | PARTIAL |
| WF-040 Record imaging finding | YES | `createFinding.ts`, `updateFinding.ts` | YES (SM-01 on findings) | YES | COMPLETE (minus visit-lock gate) |
| WF-067 Add images to study | YES [INFERRED] | via `createImagingStudy.ts` (combined flow) | N/A | YES | COMPLETE |
| WF-087 View imaging study list | YES [INFERRED] | `getImagingStudy.ts`, `listPatientImages.ts` | N/A | YES | COMPLETE |
| WF-030 Run ceph analysis | YES | `CephMgmt_batchUpsertCephLandmarks.ts`, `CephMgmt_recomputeCephAnalysis.ts` | YES (tier gate, D-L, D-I) | YES | PARTIAL (missing NOT_CALIBRATED/INSUFFICIENT_LANDMARKS guards in recompute) |
| WF-031 Place ceph landmarks | YES | `CephMgmt_batchUpsertCephLandmarks.ts`, `CephMgmt_updateCephLandmark.ts`, `CephMgmt_deleteCephLandmark.ts` | YES (SM-02, locked-immutable) | YES | COMPLETE |

---

## Business Rule Coverage

| Rule | Spec | Implemented | Notes |
|------|------|-------------|-------|
| BR-016c imagingTier gate | `403 IMAGING_TIER_REQUIRED` | Partial — 403 emitted, wrong code (`FORBIDDEN`) | BL-02 |
| BR-023 Annotations non-destructive | YES | YES — geometry stored as JSON overlay | OK |
| BR-026 Delete roles | hygienist/front_desk → 403 | YES | OK |
| BR-027 Associate own-only delete | YES | YES | OK |
| BR-034 MIME type allowlist | YES | YES (but no DICOM) | IN-01 |
| SM-01 Annotation FSM | draft→confirmed→resolved | MISSING — no status column on annotation | WR-07 |
| SM-01 Finding FSM | suspected→confirmed→monitoring→resolved | YES | OK |
| SM-02 Landmark FSM | placed→confirmed→locked | YES | OK |
| D-I Report immutability | append-only | YES | OK |
| D-L Confirm gate | A/B/Go/Po must be confirmed | YES | OK |
| ATT-BR-001 Link to patient | YES | YES | OK |
| ATT-BR-002 Category/type | YES | YES | OK |
| ATT-BR-004 Metadata preserved | Partial | filename stored in dicomMetadata JSONB; mimeType/size absent for imaging rows | IN-02 |

---

## Domain Term Consistency

| Term | Spec definition | Implementation | Deviation |
|------|----------------|----------------|-----------|
| Imaging Study | Container for images | `imaging_study` table | OK |
| Imaging Image | Individual radiograph | `imaging_study_image` table | OK |
| Imaging Annotation | Per-image overlay | `imaging_annotation` table — **no status column** | BL-AC-IMG-002 |
| Imaging Finding | Clinical observation; SM-01 | `imaging_finding` table + FINDING_TRANSITIONS | OK (minus visit-lock) |
| Ceph Analysis | Measurement set | `imaging_ceph_analysis` table | OK |
| Ceph Landmark | SM-02 | `imaging_ceph_landmark` + CEPH_LANDMARK_TRANSITIONS | OK |
| imagingTier | Subscription gate | `resolveImagingTier()` + all ceph handlers | Partial — error code mismatch |

---

## Totals

| Severity | Count |
|----------|-------|
| BLOCKER | 5 |
| WARNING | 7 |
| INFO | 3 |
| **Total** | **15** |

---

_Enforcement run: 2026-05-27_  
_Skill: oli-enforce-module v1.1_  
_Module: dental-imaging_
