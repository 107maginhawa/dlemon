# TDD PROOF: Wave 2 — dental-imaging P1 Structural Fixes

**Slice:** fix-wave2-dental-imaging
**Date:** 2026-05-29

---

## EF-IMG-007 — CephMgmt wrapper test coverage

### RED Phase (tests written before / as fix)

New tests added to `imaging-coverage.test.ts`:

```
CephMgmt_listCephLandmarks wrapper
  - delegates to listCephLandmarks — returns 200 with {items, analysis}
  - returns 401 when unauthenticated
  - returns 403 on basic tier (EF-IMG-009)

CephMgmt_batchUpsertCephLandmarks wrapper
  - delegates to batchUpsertCephLandmarks — returns 200
  - returns 401 when unauthenticated
  - returns 403 on basic tier (EF-IMG-009)

CephMgmt_updateCephLandmark wrapper
  - delegates to updateCephLandmark — returns 200
  - returns 401 when unauthenticated
  - returns 403 on basic tier (EF-IMG-009)

CephMgmt_deleteCephLandmark wrapper
  - delegates to deleteCephLandmark — returns 204
  - returns 401 when unauthenticated
  - returns 403 on basic tier (EF-IMG-009)

CephMgmt_getCephAnalysis wrapper
  - delegates to getCephAnalysis — returns 200
  - returns 401 when unauthenticated
  - returns 403 on basic tier (EF-IMG-009)

CephMgmt_recomputeCephAnalysis wrapper
  - delegates to recomputeCephAnalysis — returns 200
  - returns 401 when unauthenticated
  - returns 403 on basic tier (EF-IMG-009)

CephMgmt_createCephReport wrapper
  - delegates to createCephReport — returns 201
  - returns 401 when unauthenticated
  - returns 403 on basic tier (EF-IMG-009)

CephMgmt_getCephReport wrapper
  - delegates to getCephReport — returns 200
  - returns 401 when unauthenticated
  - returns 404 when no report exists
  - returns 403 on basic tier (EF-IMG-009)
```

The 403-basic-tier tests were RED before EF-IMG-009 was applied (they would have
returned 200 with the old `=== 'free'` gate). These were written alongside EF-IMG-009
fix to create a regression guard.

### GREEN Phase (tests pass after implementation)

```
 55 pass
 0 fail
 60 expect() calls
Ran 55 tests across 1 file. [78.00ms]
```

---

## EF-IMG-009 — imagingTier gate fix

### RED Phase

The following tests in the new coverage section are RED before the tier gate change:

- `CephMgmt_listCephLandmarks wrapper > returns 403 on basic tier`
- `CephMgmt_batchUpsertCephLandmarks wrapper > returns 403 on basic tier`
- `CephMgmt_updateCephLandmark wrapper > returns 403 on basic tier`
- `CephMgmt_deleteCephLandmark wrapper > returns 403 on basic tier`
- `CephMgmt_getCephAnalysis wrapper > returns 403 on basic tier`
- `CephMgmt_recomputeCephAnalysis wrapper > returns 403 on basic tier`
- `CephMgmt_createCephReport wrapper > returns 403 on basic tier`
- `CephMgmt_getCephReport wrapper > returns 403 on basic tier`

With `imagingTier === 'free'` gate, `basic` tier returns 200 (wrong). Expected: 403.

### GREEN Phase (after changing gate to `!== 'addon'`)

All 8 basic-tier tests return 403. All 56 existing ceph.test.ts tests pass (null and
'free' still return 403, 'addon' still passes — gate semantics preserved for existing tests).

```
imaging-coverage.test.ts: 55 pass, 0 fail [78ms]
ceph.test.ts:             56 pass, 0 fail [65ms]
Total:                   111 pass, 0 fail
```

---

## Pre/Post Comparison

| Metric | Before | After |
|--------|--------|-------|
| imaging-coverage.test.ts tests | 30 | 55 (+25) |
| ceph.test.ts tests | 56 | 56 |
| CephMgmt wrappers with test coverage | 0/8 | 8/8 |
| Handlers with correct `!== 'addon'` gate | 0/8 | 8/8 |
| TypeScript errors in dental-imaging | 0 | 0 |
| MODULE_SPEC BR-016c documents decision | No | Yes |
