# Dentalemon — Requirements Traceability Matrix (Auto-Generated)

**Generated:** 2026-05-20  
**Script:** `bun run audit:trace`  
**Note:** BR coverage is inferred from tag mentions (`BR-NNN`) in test files.
          Add `// @BR-NNN` to test descriptions for intentional traceability.

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Total BRs | 47 |
| ✅ Fully Covered (unit + E2E) | 12 (26%) |
| ⚠️ Unit Covered (no E2E yet) | 22 (47%) |
| ❌ Untested | 12 (26%) |
| 🚫 Not implemented | 1 |
| Total ACs | 40 |

## Coverage Gaps

| Priority | BR | Status | Summary |
|----------|----|--------|---------|
| P0 | BR-002 | ⚠️ UNIT_COVERED | Visit state transitions are strictly linear: `draft` → `active` → `completed` →  |
| P1 | BR-001 | ⚠️ UNIT_COVERED | — |
| P1 | BR-004 | ⚠️ UNIT_COVERED | An appointment check-in creates a visit record. Deleting the appointment does no |
| P1 | BR-007 | ⚠️ UNIT_COVERED | `business-rules.test.ts` — describe('BR-007') field-edit guard enforced |
| P1 | BR-009 | ⚠️ UNIT_COVERED | `business-rules.test.ts` — describe('BR-009') `[BR-009]` |
| P1 | BR-012 | ⚠️ UNIT_COVERED | Invoice state lifecycle: `draft` → `sent` → `paid` / `partial` / `overdue` / `vo |
| P1 | BR-018 | ⚠️ UNIT_COVERED | Lab order state lifecycle: `ordered` → `in_progress` → `completed` / `cancelled` |
| P1 | BR-021 | ⚠️ UNIT_COVERED | `business-rules.test.ts` — describe('BR-021') snapshot/checksum `[BR-021]` (4 te |
| P2 | BR-005 | ⚠️ UNIT_COVERED | `business-rules.test.ts` — describe.skip (placeholder) |
| P2 | BR-008 | ⚠️ UNIT_COVERED | Carried-over treatments from a treatment plan appear in the workspace treatment  |
| P2 | BR-010 | ⚠️ UNIT_COVERED | Tax is always 0. Fee schedule prices are pre-tax. Tax calculation is a stub pend |
| P2 | BR-022 | ⚠️ UNIT_COVERED | An imported external PMD is stored as-is (read-only). Its data is not merged int |
| P2 | BR-023 | ⚠️ UNIT_COVERED | 21 |
| P2 | BR-025 | ⚠️ UNIT_COVERED | 4 |
| P2 | BR-027 | ⚠️ UNIT_COVERED | 2 |
| P2 | BR-028 | ⚠️ UNIT_COVERED | Image deletion is soft-only. DELETE sets `status='archived'`; no row is physical |
| P2 | BR-029 | ⚠️ UNIT_COVERED |  |
| P2 | BR-031 | ⚠️ UNIT_COVERED | — |
| P2 | BR-032 | ⚠️ UNIT_COVERED |  |
| P2 | BR-033 | ⚠️ UNIT_COVERED | 2 |
| P2 | BR-034 | ⚠️ UNIT_COVERED | Allowed image formats: JPEG, PNG, TIFF, BMP. Uploads with other MIME types are r |
| P2 | BR-035 | ⚠️ UNIT_COVERED | 1 |
| P2 | BR-036 | ❌ UNTESTED | `CIMG-07 batch upsert landmarks` |
| P2 | BR-037 | ❌ UNTESTED | A batch upsert of landmarks is rejected in its entirety if any landmark in the b |
| P2 | BR-038 | ❌ UNTESTED | `CIMG-15 recompute idempotent` |
| P2 | BR-039 | ❌ UNTESTED | Calibration provenance is captured in the report snapshot at creation time. The  |
| P2 | BR-040 | ❌ UNTESTED | _(no dedicated test)_ |
| P2 | BR-041 | ❌ UNTESTED | Any `CephMgmt_*` operation on a non-existent image returns 404. Non-members also |
| P2 | BR-042 | ❌ UNTESTED | `Version monotonicity` |
| P2 | BR-043 | ❌ UNTESTED | The `steiner_hybrid_sn` label is the mandatory analysis type for all v1.4 ceph a |
| P2 | BR-044 | ❌ UNTESTED | `CIMG-14 lock matrix` (confirmed vs locked delete) |
| P2 | BR-045 | ❌ UNTESTED | Ceph report snapshot measurement fields (`sna`, `snb`, `anb`, `witsAppraisal`, e |
| P2 | BR-046 | ❌ UNTESTED | _(no dedicated stale-read test)_ |
| P2 | BR-047 | ❌ UNTESTED | All image-scoped `CephMgmt_*` routes require a valid `imageId` that exists in th |

## Business Rule Coverage

| BR | Summary | Backend Unit | Frontend Unit | E2E | Status |
|----|---------|-------------|---------------|-----|--------|
| BR-001 | — | ✅ (1) | ✅ (1) | ❌ | ⚠️ UNIT_COVERED |
| BR-002 | Visit state transitions are strictly linear: `draft` → `acti | ✅ (1) | ❌ | ❌ | ⚠️ UNIT_COVERED |
| BR-003 | — | ✅ (1) | ✅ (1) | ✅ (1) | ✅ FULLY_COVERED |
| BR-004 | An appointment check-in creates a visit record. Deleting the | ✅ (1) | ✅ (1) | ❌ | ⚠️ UNIT_COVERED |
| BR-005 | `business-rules.test.ts` — describe.skip (placeholder) | ✅ (4) | ❌ | ❌ | ⚠️ UNIT_COVERED |
| BR-006 | Treatment state transitions are forward-only: `diagnosed` →  | ✅ (1) | ✅ (2) | ✅ (1) | ✅ FULLY_COVERED |
| BR-007 | `business-rules.test.ts` — describe('BR-007') field-edit gua | ✅ (1) | ✅ (1) | ❌ | ⚠️ UNIT_COVERED |
| BR-008 | Carried-over treatments from a treatment plan appear in the  | ✅ (2) | ✅ (1) | ❌ | ⚠️ UNIT_COVERED |
| BR-009 | `business-rules.test.ts` — describe('BR-009') `[BR-009]` | ✅ (1) | ✅ (1) | ❌ | ⚠️ UNIT_COVERED |
| BR-010 | Tax is always 0. Fee schedule prices are pre-tax. Tax calcul | ✅ (1) | ❌ | ❌ | ⚠️ UNIT_COVERED |
| BR-011 | `business-rules.test.ts` — describe('BR-011') void blocked b | ✅ (2) | ✅ (1) | ✅ (2) | ✅ FULLY_COVERED |
| BR-012 | Invoice state lifecycle: `draft` → `sent` → `paid` / `partia | ✅ (1) | ✅ (1) | ❌ | ⚠️ UNIT_COVERED |
| BR-013 | `business-rules.test.ts` — describe.skip (placeholder) | ✅ (1) | ❌ | ✅ (1) | ✅ FULLY_COVERED |
| BR-014 | Consent form is immutable once signed. No edits, no re-signi | ✅ (1) | ✅ (1) | ✅ (1) | ✅ FULLY_COVERED |
| BR-015 | `business-rules.test.ts` — consent guard enforced (handler f | ✅ (1) | ✅ (1) | ✅ (1) | ✅ FULLY_COVERED |
| BR-016 | Branch membership is required for all clinical data access.  | ✅ (1) | ❌ | ✅ (1) | ✅ FULLY_COVERED |
| BR-017 | `business-rules.test.ts` — describe('BR-017') missing prescr | ✅ (1) | ✅ (1) | ✅ (1) | ✅ FULLY_COVERED |
| BR-018 | Lab order state lifecycle: `ordered` → `in_progress` → `comp | ✅ (1) | ❌ | ❌ | ⚠️ UNIT_COVERED |
| BR-019 | `business-rules.test.ts` — test.skip (placeholder) | ✅ (2) | ❌ | ✅ (1) | ✅ FULLY_COVERED |
| BR-020 | Patient merge and unmerge are not implemented. Duplicate pat | ✅ (1) | ❌ | ❌ | 🚫 NOT_IMPLEMENTED |
| BR-021 | `business-rules.test.ts` — describe('BR-021') snapshot/check | ✅ (1) | ❌ | ❌ | ⚠️ UNIT_COVERED |
| BR-022 | An imported external PMD is stored as-is (read-only). Its da | ✅ (1) | ❌ | ❌ | ⚠️ UNIT_COVERED |
| BR-023 | 21 | ✅ (1) | ✅ (1) | ❌ | ⚠️ UNIT_COVERED |
| BR-024 | Panoramic images display a measurement-accuracy warning unti | ✅ (1) | ❌ | ✅ (1) | ✅ FULLY_COVERED |
| BR-025 | 4 | ✅ (1) | ✅ (1) | ❌ | ⚠️ UNIT_COVERED |
| BR-026 | Image deletion is default-deny. Only `dentist` and `associat | ✅ (1) | ❌ | ✅ (1) | ✅ FULLY_COVERED |
| BR-027 | 2 | ✅ (1) | ✅ (1) | ❌ | ⚠️ UNIT_COVERED |
| BR-028 | Image deletion is soft-only. DELETE sets `status='archived'` | ✅ (1) | ✅ (1) | ❌ | ⚠️ UNIT_COVERED |
| BR-029 |  | ✅ (1) | ✅ (1) | ❌ | ⚠️ UNIT_COVERED |
| BR-030 | Legacy `dental_attachment` records (xray → other, photo → in | ✅ (2) | ❌ | ✅ (1) | ✅ FULLY_COVERED |
| BR-031 | — | ❌ | ✅ (1) | ❌ | ⚠️ UNIT_COVERED |
| BR-032 |  | ✅ (1) | ✅ (1) | ❌ | ⚠️ UNIT_COVERED |
| BR-033 | 2 | ✅ (1) | ❌ | ❌ | ⚠️ UNIT_COVERED |
| BR-034 | Allowed image formats: JPEG, PNG, TIFF, BMP. Uploads with ot | ✅ (1) | ❌ | ❌ | ⚠️ UNIT_COVERED |
| BR-035 | 1 | ✅ (1) | ✅ (1) | ❌ | ⚠️ UNIT_COVERED |
| BR-036 | `CIMG-07 batch upsert landmarks` | ❌ | ❌ | ❌ | ❌ UNTESTED |
| BR-037 | A batch upsert of landmarks is rejected in its entirety if a | ❌ | ❌ | ❌ | ❌ UNTESTED |
| BR-038 | `CIMG-15 recompute idempotent` | ❌ | ❌ | ❌ | ❌ UNTESTED |
| BR-039 | Calibration provenance is captured in the report snapshot at | ❌ | ❌ | ❌ | ❌ UNTESTED |
| BR-040 | _(no dedicated test)_ | ❌ | ❌ | ❌ | ❌ UNTESTED |
| BR-041 | Any `CephMgmt_*` operation on a non-existent image returns 4 | ❌ | ❌ | ❌ | ❌ UNTESTED |
| BR-042 | `Version monotonicity` | ❌ | ❌ | ❌ | ❌ UNTESTED |
| BR-043 | The `steiner_hybrid_sn` label is the mandatory analysis type | ❌ | ❌ | ❌ | ❌ UNTESTED |
| BR-044 | `CIMG-14 lock matrix` (confirmed vs locked delete) | ❌ | ❌ | ❌ | ❌ UNTESTED |
| BR-045 | Ceph report snapshot measurement fields (`sna`, `snb`, `anb` | ❌ | ❌ | ❌ | ❌ UNTESTED |
| BR-046 | _(no dedicated stale-read test)_ | ❌ | ❌ | ❌ | ❌ UNTESTED |
| BR-047 | All image-scoped `CephMgmt_*` routes require a valid `imageI | ❌ | ❌ | ❌ | ❌ UNTESTED |

## Acceptance Criteria

_Note: AC coverage requires BR tags in tests to auto-detect._
_The full hand-maintained AC coverage table is in `docs/audits/TRACEABILITY_MATRIX.md`._

| AC | Summary |
|----|---------|
| AC-REG-01 | Register new patient with consent |
| AC-REG-02 | Registration blocked without consent |
| AC-REG-03 | Walk-in from calendar |
| AC-SCHED-01 | Create appointment |
| AC-SCHED-02 | Edit existing appointment |
| AC-SCHED-03 | Check in from appointment |
| AC-SCHED-04 | Cancel appointment |
| AC-VISIT-01 | Open clinical workspace |
| AC-VISIT-02 | Workspace is read-only after checkout |
| AC-VISIT-03 | Create new visit |
| AC-VISIT-04 | Year filter |
| AC-CHART-01 | Select tooth and open slideout |
| AC-CHART-02 | Save tooth chart entry |
| AC-CHART-03 | Chart entry blocked for completed visit |
| AC-CHART-04 | View tooth history |
| AC-CHART-05 | Five-surface selector |
| AC-TXPLAN-01 | View treatment plan |
| AC-TXPLAN-02 | Carried-over treatments appear in workspace |
| AC-MED-01 | Record medical history entry |
| AC-MED-02 | Safety floor shows active alerts |
| AC-MED-03 | Collect e-signature consent |
| AC-RX-01 | Write prescription |
| AC-RX-02 | Prescription requires prescriber |
| AC-LAB-01 | Create lab order |
| AC-LAB-02 | Lab order status progression |
| AC-ATTACH-01 | Upload attachment |
| AC-ATTACH-02 | View attachments |
| AC-INV-01 | Continue to payment from workspace |
| AC-INV-02 | Invoice requires line items |
| AC-INV-03 | Invoice generated on checkout |
| AC-INV-04 | View invoice from completed visit |
| AC-PAY-01 | Record payment against invoice |
| AC-PAY-02 | Partial payment creates payment plan |
| AC-PAY-03 | Payment plan blocks invoice void |
| AC-PMD-01 | Generate PMD for completed visit |
| AC-PMD-02 | Share PMD |
| AC-PMD-03 | Import external PMD |
| AC-PROF-01 | View patient profile |
| AC-PROF-02 | Navigate workspace from profile |
| AC-REPORT-01 | View daily report |

---

_To improve this report: add `// @BR-NNN` tags to test `describe`/`test` blocks._
_See `docs/superpowers/specs/2026-05-09-br-tagged-test-suite-design.md` for the tagging spec._