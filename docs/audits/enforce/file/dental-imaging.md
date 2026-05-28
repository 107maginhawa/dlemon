# oli-enforce-file: dental-imaging
**Run ID:** run-6-strict-2026-05-29
**Handler dir:** `services/api-ts/src/handlers/dental-imaging/`
**Files checked:** 53
**Spec:** `docs/product/modules/dental-imaging/MODULE_SPEC.md`

---

## File Inventory

### Legacy handler files (21 — canonical implementations)
| File | Auth | imagingTier | Storage | Notes |
|------|------|-------------|---------|-------|
| `createImagingStudy.ts` | `assertBranchRole` | — | `StorageProvider` via ctx | PASS: uses assertBranchRole + storage module |
| `createFinding.ts` | `assertBranchRole` | — | — | PASS |
| `createMeasurement.ts` | `assertBranchRole` | — | — | PASS |
| `createCephReport.ts` | MISSING | `free` gate only | — | **P0-A** no assertBranchAccess/assertBranchRole |
| `deleteCephLandmark.ts` | MISSING | `free` gate only | — | **P0-A** no assertBranchAccess/assertBranchRole |
| `deleteFinding.ts` | `assertBranchAccess` (2) | — | — | PASS |
| `deleteImage.ts` | `assertBranchRole` | — | — | PASS |
| `deleteMeasurement.ts` | `assertBranchRole` | — | — | PASS |
| `getCephAnalysis.ts` | `assertBranchAccess` (2) | `free` gate | — | PASS |
| `getCephReport.ts` | `assertBranchAccess` (2) | `free` gate | — | PASS |
| `getImagingStudy.ts` | `assertBranchAccess` (3) | — | — | PASS |
| `listCephLandmarks.ts` | `assertBranchAccess` (2) | `free` gate | — | PASS |
| `listFindings.ts` | `assertBranchAccess` (2) | — | — | PASS |
| `listMeasurements.ts` | `assertBranchAccess` (2) | — | — | PASS |
| `listPatientImages.ts` | `assertBranchAccess` (2) | — | — | PASS |
| `recomputeCephAnalysis.ts` | MISSING | `free` gate only | — | **P0-A** no assertBranchAccess/assertBranchRole |
| `updateCephLandmark.ts` | MISSING | `free` gate only | — | **P0-A** no assertBranchAccess/assertBranchRole |
| `updateFinding.ts` | `assertBranchRole` | — | — | PASS |
| `updateImageCalibration.ts` | `assertBranchAccess` (2) | — | — | PASS |
| `updateImageModality.ts` | `assertBranchRole` | — | — | PASS |
| `batchUpsertCephLandmarks.ts` | MISSING | `free` gate only | — | **P0-A** no assertBranchAccess/assertBranchRole |

### Mgmt wrapper files (21 — thin shims delegating to legacy handlers)

All 21 wrappers are one-line delegates (`return legacyHandler(ctx as BaseContext)`).
They intentionally carry no auth logic (auth lives in legacy handler). This is correct architecture.
However, 5 ceph wrappers delegate to P0-auth-missing legacy handlers (see above).

| Wrapper | Delegates to | Auth in delegate |
|---------|-------------|-----------------|
| `CephMgmt_batchUpsertCephLandmarks.ts` | `batchUpsertCephLandmarks` | **P0-A** missing |
| `CephMgmt_createCephReport.ts` | `createCephReport` | **P0-A** missing |
| `CephMgmt_deleteCephLandmark.ts` | `deleteCephLandmark` | **P0-A** missing |
| `CephMgmt_getCephAnalysis.ts` | `getCephAnalysis` | PASS |
| `CephMgmt_getCephReport.ts` | `getCephReport` | PASS |
| `CephMgmt_listCephLandmarks.ts` | `listCephLandmarks` | PASS |
| `CephMgmt_recomputeCephAnalysis.ts` | `recomputeCephAnalysis` | **P0-A** missing |
| `CephMgmt_updateCephLandmark.ts` | `updateCephLandmark` | **P0-A** missing |
| `ImagingFindingsMgmt_createFinding.ts` | `createFinding` | PASS |
| `ImagingFindingsMgmt_deleteFinding.ts` | `deleteFinding` | PASS |
| `ImagingFindingsMgmt_listFindings.ts` | `listFindings` | PASS |
| `ImagingFindingsMgmt_updateFinding.ts` | `updateFinding` | PASS |
| `ImagingMgmt_createImagingStudy.ts` | `createImagingStudy` | PASS |
| `ImagingMgmt_createMeasurement.ts` | `createMeasurement` | PASS |
| `ImagingMgmt_deleteImage.ts` | `deleteImage` | PASS |
| `ImagingMgmt_deleteMeasurement.ts` | `deleteMeasurement` | PASS |
| `ImagingMgmt_getImagingStudy.ts` | `getImagingStudy` | PASS |
| `ImagingMgmt_listMeasurements.ts` | `listMeasurements` | PASS |
| `ImagingMgmt_updateImageCalibration.ts` | `updateImageCalibration` | PASS |
| `ImagingMgmt_updateImageModality.ts` | `updateImageModality` | PASS |
| `PatientImageMgmt_listPatientImages.ts` | `listPatientImages` | PASS |

### Test files (5)
| File | Coverage |
|------|----------|
| `imaging.test.ts` | ImagingMgmt, ImagingFindingsMgmt, measurements, annotations, imagingTier |
| `ceph.test.ts` | All ceph operations: batch upsert, recompute, report, tier gate, FSM, calibration |
| `imaging-coverage.test.ts` | 13 Mgmt wrapper delegation tests (ImagingMgmt×8, ImagingFindingsMgmt×4, PatientImageMgmt×1); **CephMgmt wrappers NOT covered** |
| `imaging-finding.fsm.property.test.ts` | Property-based FSM via `fast-check` — PRESENT |
| `ceph-landmark.fsm.property.test.ts` | Property-based FSM via `fast-check` — PRESENT |

### Repo files (6)
- `repos/imaging.schema.ts` — PASS (patientId/branchId stored as bare UUID, no `.references()` — correct loose coupling)
- `repos/imaging.repo.ts` — PASS (innerJoin only within `imagingStudies`/`imagingStudyImages` — intra-module)
- `repos/imaging_ceph.schema.ts` — PASS (all FK references are intra-module `imagingStudyImages`)
- `repos/imaging_ceph.repo.ts` — PASS (no cross-module joins found)
- `repos/imaging_finding.schema.ts` — **P1-FK**: 3 cross-module DB-level FK violations
- `repos/imaging_finding.repo.ts` — not individually audited for joins

---

## Findings

### P0 — Critical (fix before merge)

#### EF-IMG-001 · `createCephReport.ts` missing branch auth
**Severity:** P0
**Check:** A (assertBranchAccess)
**Detail:** Handler checks `imagingTier === 'free'` but calls no `assertBranchAccess` or `assertBranchRole`. Authenticated user from any branch can create ceph reports on any branch's data.
**Fix:** Add `await assertBranchRole(db, user.id, analysis.branchId, ['dentist_owner', 'dentist_associate'])` after analysis fetch, before write.

#### EF-IMG-002 · `batchUpsertCephLandmarks.ts` missing branch auth
**Severity:** P0
**Check:** A (assertBranchAccess)
**Detail:** Handler checks `imagingTier === 'free'` but no branch membership check. Any authenticated user can upsert landmarks on any branch's ceph analysis.
**Fix:** Add `assertBranchRole` before landmark write.

#### EF-IMG-003 · `recomputeCephAnalysis.ts` missing branch auth
**Severity:** P0
**Check:** A (assertBranchAccess)
**Detail:** Handler checks `imagingTier` but no branch auth. Triggers server-side math engine on any branch's data.
**Fix:** Add `assertBranchRole` after study fetch.

#### EF-IMG-004 · `deleteCephLandmark.ts` missing branch auth
**Severity:** P0
**Check:** A (assertBranchAccess)
**Detail:** Handler checks `imagingTier` but no branch membership validation.
**Fix:** Add `assertBranchRole` before delete.

#### EF-IMG-005 · `updateCephLandmark.ts` missing branch auth
**Severity:** P0
**Check:** A (assertBranchAccess)
**Detail:** Handler checks `imagingTier` but no branch auth.
**Fix:** Add `assertBranchRole` before update.

### P1 — High (fix before ship)

#### EF-IMG-006 · `imaging_finding.schema.ts` cross-module DB-level FK violations
**Severity:** P1
**Check:** D (Loose Coupling)
**Detail:** `imaging_findings` table has 3 live `.references()` calls to schemas from other modules:
- `patientId` → `.references(() => patients.id)` (patient module)
- `visitId` → `.references(() => dentalVisits.id)` (dental-visit module)
- `branchId` → `.references(() => dentalBranches.id)` (dental-org module)

MODULE_SPEC §1 and §7b mandate "no DB-level FKs to other modules; UUID references only." `imaging.schema.ts` correctly uses bare UUIDs for the same fields — `imaging_finding.schema.ts` is inconsistent.
Note: `treatmentId` is correctly defined without `.references()`.
**Fix:** Remove `.references()` from `patientId`, `visitId`, `branchId` in `imaging_finding.schema.ts`. Store as bare `uuid()`. Remove the 3 cross-module schema imports (`dentalVisits`, `patients`, `dentalBranches`) from that file. Regenerate migration.

#### EF-IMG-007 · `imaging-coverage.test.ts` missing CephMgmt wrapper tests
**Severity:** P1
**Check:** F (Test Coverage)
**Detail:** `imaging-coverage.test.ts` covers 13 wrappers (ImagingMgmt×8, ImagingFindingsMgmt×4, PatientImageMgmt×1) but has **zero** `describe` blocks for the 8 `CephMgmt_*` wrapper files. `ceph.test.ts` tests the legacy handler logic but not the wrapper delegation layer.
**Fix:** Add `describe('CephMgmt_* wrapper', ...)` blocks in `imaging-coverage.test.ts` (or new `ceph-coverage.test.ts`) covering delegation returns correct status + 401 when unauthenticated for each of the 8 CephMgmt wrappers.

### P2 — Medium

#### EF-IMG-008 · Service layer absent — no `ImagingService` class
**Severity:** P2
**Check:** C (Service Layer)
**Detail:** No `ImagingService` (or `imaging.service.ts`) exists. All handlers query DB directly via repo functions. Run-5 noted PARTIAL; current run confirms still absent. Inconsistent with service-layer DI pattern in other modules (dental-org, dental-clinical, etc.).
**Fix:** Extract DB calls into `imaging.service.ts` with injectable constructor. Not a correctness bug but required for BACKEND_ARCHITECTURE.md compliance.

#### EF-IMG-009 · `imagingTier` gate uses `=== 'free'` (deny free) not `=== 'cbct'` (require cbct)
**Severity:** P2
**Check:** B (imagingTier Gate)
**Detail:** All 5 ceph handlers gate on `imagingTier === 'free'` → 403, passing `basic` and `addon` tiers. MODULE_SPEC §WF-030 states `imagingTier = cbct` is required. If `cbct` is a distinct tier from `addon`, this is a logic error allowing non-cbct tiers through.
**Fix:** Confirm with product: is `addon` === `cbct`? If not, change gate to `if (imagingTier !== 'cbct')`. Document the decision in MODULE_SPEC §5 (BR-016c row).

### P3 — Low

#### EF-IMG-010 · `listPatientImages.ts` sets `fileSizeBytes: 0` as stub
**Severity:** P3
**Detail:** `fileSizeBytes` hardcoded to `0` for legacy mapped rows (line 91). Incomplete data in API response. Not a security issue.

#### EF-IMG-011 · Mixed auth function: `assertBranchRole` vs `assertBranchAccess` across handlers
**Severity:** P3 (observation, not a bug)
**Detail:** Some handlers use `assertBranchAccess` (membership-only check), others use `assertBranchRole` (role-gated). Both provide branch isolation. No security gap but inconsistent pattern within the module. Consider standardizing on `assertBranchRole` for write operations.

---

## Summary Table

| ID | Severity | Check | File | Description |
|----|----------|-------|------|-------------|
| EF-IMG-001 | P0 | A | `createCephReport.ts` | assertBranchAccess missing |
| EF-IMG-002 | P0 | A | `batchUpsertCephLandmarks.ts` | assertBranchAccess missing |
| EF-IMG-003 | P0 | A | `recomputeCephAnalysis.ts` | assertBranchAccess missing |
| EF-IMG-004 | P0 | A | `deleteCephLandmark.ts` | assertBranchAccess missing |
| EF-IMG-005 | P0 | A | `updateCephLandmark.ts` | assertBranchAccess missing |
| EF-IMG-006 | P1 | D | `repos/imaging_finding.schema.ts` | Cross-module DB FK violations (3) |
| EF-IMG-007 | P1 | F | `imaging-coverage.test.ts` | CephMgmt wrapper tests absent |
| EF-IMG-008 | P2 | C | (module-wide) | No ImagingService class |
| EF-IMG-009 | P2 | B | ceph handlers (5) | imagingTier gate 'free' vs 'cbct' ambiguity |
| EF-IMG-010 | P3 | — | `listPatientImages.ts` | fileSizeBytes=0 stub |
| EF-IMG-011 | P3 | — | module-wide | assertBranchRole vs assertBranchAccess inconsistency |

---

## Check Results

| Check | Result | Notes |
|-------|--------|-------|
| A. assertBranchAccess | PARTIAL | 5/21 legacy handlers missing (P0×5) |
| B. imagingTier Gate | PARTIAL | All ceph handlers gate; 'free' not 'cbct' (P2) |
| C. Service Layer | FAIL | No ImagingService class (P2) |
| D. Loose Coupling (DB) | PARTIAL | imaging.schema.ts clean; imaging_finding.schema.ts has 3 cross-module FKs (P1) |
| E. File Storage | PASS | createImagingStudy delegates to StorageProvider via ctx |
| F. Test Coverage | PARTIAL | 13/21 wrappers covered; 8 CephMgmt_ wrappers absent (P1) |
| imaging-coverage.test.ts endpoints | PARTIAL | ImagingMgmt+FindingsMgmt+PatientImage covered; CephMgmt absent |
| imaging-finding.fsm.property.test.ts | PASS | fast-check present, SM-01 states tested |
| ceph-landmark.fsm.property.test.ts | PASS | fast-check present, SM-02 states tested |

---

*Generated: 2026-05-29 | run-6-strict-2026-05-29*
