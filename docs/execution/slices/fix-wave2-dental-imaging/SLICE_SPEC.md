# SLICE SPEC: Wave 2 — dental-imaging P1 Structural Fixes

**Slice ID:** fix-wave2-dental-imaging
**Date:** 2026-05-29
**Module:** dental-imaging
**Branch:** main

---

## Findings in Scope

### EF-IMG-007 — CephMgmt wrapper test coverage absent (FIXED)

**Severity:** P1
**Check:** F (Test Coverage)
**Finding:** `imaging-coverage.test.ts` covered ImagingMgmt, ImagingFindingsMgmt, and
PatientImageMgmt wrappers but all 8 CephMgmt_ wrappers had zero coverage.

**Fix applied:**
- Added `makeCephCoverageDb` factory function to `imaging-coverage.test.ts`
- Added 25 new tests covering all 8 CephMgmt_ wrappers:
  - `CephMgmt_listCephLandmarks` (3 tests)
  - `CephMgmt_batchUpsertCephLandmarks` (3 tests)
  - `CephMgmt_updateCephLandmark` (3 tests)
  - `CephMgmt_deleteCephLandmark` (3 tests)
  - `CephMgmt_getCephAnalysis` (3 tests)
  - `CephMgmt_recomputeCephAnalysis` (3 tests)
  - `CephMgmt_createCephReport` (3 tests)
  - `CephMgmt_getCephReport` (4 tests: happy-path, 401, 404, 403-basic-tier)
- Each wrapper tested for: happy-path success, 401 unauthenticated, and 403
  on `basic` tier (EF-IMG-009 regression test)

**Files changed:**
- `services/api-ts/src/handlers/dental-imaging/imaging-coverage.test.ts`

**Commit:** `755530c0`

---

### EF-IMG-009 — imagingTier gate `=== 'free'` allows `basic` tier through (FIXED)

**Severity:** P2 (escalated to P1 for this wave due to correctness impact)
**Check:** B (imagingTier Gate)
**Finding:** All 8 ceph handlers gated on `imagingTier === 'free'` → 403. MODULE_SPEC §WF-030
states `imagingTier = cbct` is required. The DB enum `['free','basic','addon']` has no
`cbct` value — `addon` IS the cbct tier. `basic` orgs were incorrectly passing through.

**Decision made:** `addon` === cbct. Gate changed from `=== 'free'` to `!== 'addon'` so
that both `free` and `basic` orgs are blocked from ceph features.

**Fix applied:**
- Changed tier gate in 8 ceph handler files from `=== 'free'` to `!== 'addon'`
- Updated `MODULE_SPEC.md` §5 BR-016c to document the decision:
  > `addon` IS the cbct tier — DB enum `['free','basic','addon']` maps to `free` (no ceph),
  > `basic` (2D only), `addon` (ceph/CBCT). Gate: `!== 'addon'` blocks both `free` and `basic`.

**Files changed:**
- `services/api-ts/src/handlers/dental-imaging/batchUpsertCephLandmarks.ts`
- `services/api-ts/src/handlers/dental-imaging/listCephLandmarks.ts`
- `services/api-ts/src/handlers/dental-imaging/getCephAnalysis.ts`
- `services/api-ts/src/handlers/dental-imaging/getCephReport.ts`
- `services/api-ts/src/handlers/dental-imaging/deleteCephLandmark.ts`
- `services/api-ts/src/handlers/dental-imaging/recomputeCephAnalysis.ts`
- `services/api-ts/src/handlers/dental-imaging/updateCephLandmark.ts`
- `services/api-ts/src/handlers/dental-imaging/createCephReport.ts` (uses `orgData.imagingTier`)
- `docs/product/modules/dental-imaging/MODULE_SPEC.md`

**Commit:** `df6dd2c9`

---

### EF-IMG-008 — Service layer absent (BLOCKED)

**Severity:** P2
**Check:** C (Service Layer)
**Finding:** No `ImagingService` class exists. All handlers query DB directly via repo
functions. Inconsistent with service-layer DI pattern in dental-org, dental-clinical, etc.

**Status:** BLOCKED — EF-IMG-008 is the F2 service-layer sprint. Extracting DB calls into
`imaging.service.ts` requires refactoring all 21 handler files and is a BACKEND_ARCHITECTURE.md
compliance sprint, not a P1 structural fix. Deferred to the F2 service-layer sprint.

**No action taken in this slice.**

---

## Test Results

| File | Before | After | Delta |
|------|--------|-------|-------|
| `imaging-coverage.test.ts` | 30 pass | 55 pass | +25 |
| `ceph.test.ts` | 56 pass | 56 pass | 0 |
| **Total** | **86 pass** | **111 pass** | **+25** |

TypeScript errors in `dental-imaging`: 0 (unchanged from baseline).

---

## Quality Gate Status

- `bun test imaging-coverage.test.ts`: 55 pass, 0 fail
- `bun test ceph.test.ts`: 56 pass, 0 fail
- `bun run typecheck` (dental-imaging scope): 0 errors
