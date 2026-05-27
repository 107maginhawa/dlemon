# Enforcement Fix Report

<!-- oli-enforce-fix v1 | run-id: enforce-fix-004-section-10-2-auth | 2026-05-27 -->

**Scope:** `--scope section-10.2` — §10.2 auth/security P0 findings  
**Run:** enforce-fix-004 | Branch: main | Commit: 80f11f7

---

## Fix Summary

| Metric | Value |
|--------|-------|
| Findings in scope | 8 |
| Fixed this session | 8 |
| Blocked | 0 |
| Regressions introduced | 0 |
| Loops used | 1 of 3 |

All 8 §10.2 P0 findings closed in a single loop. Zero regressions. Typecheck clean on all modified modules.

---

## Wave Classification

| Wave | Label | Findings | Count |
|------|-------|----------|-------|
| 1 | Mechanical | EF-ORG-001, EF-ORG-002, EM-PAT-005 | 3 |
| 2 | Structural | EM-PAT-007, EM-VISIT-003, EM-PMD-004, EM-VISIT-001 | 4 |
| 3 | Design/Frontend | UJ-SCHED-003 | 1 |

Sum: 3 + 4 + 1 = 8 ✅

---

## Fix Log

| Finding | Severity | File | Fix | Commit |
|---------|----------|------|-----|--------|
| EF-ORG-001 | P0 | `dental-org/deactivateMember.ts` | Upgraded `assertBranchAccess` → `assertBranchRole(['dentist_owner'])` | 80f11f7 |
| EF-ORG-002 | P0 | `dental-org/DentalBranchManagement_get.ts` | Added `assertBranchAccess` before returning branch data | 80f11f7 |
| EM-PAT-005 | P0 | `dental-patient/createDentalPatient.ts` | Made `branchId` required; removed optional guard | 80f11f7 |
| EM-PAT-007 | P0 | `dental-patient/getDentalPatient.ts` | Throw `ForbiddenError` when patient has no branch; removed optional access check | 80f11f7 |
| EM-VISIT-003 | P0 | `dental-visit/updateDentalTreatment.ts` | Throw `NotFoundError` on null visit; always assert branch role | 80f11f7 |
| EM-PMD-004 | P0 | `dental-pmd/getImportedPMD.ts` | Auth-before-data: lightweight `patientId` probe before loading sensitive `content` field | 80f11f7 |
| EM-VISIT-001 | P0 | `dental-visit/carryOverTreatments.ts` | Added `eq(dentalTreatments.patientId, currentVisit.patientId)` to dismissed restore query (cross-patient IDOR) | 80f11f7 |
| UJ-SCHED-003 | P0 | `apps/dentalemon/…/appointment-modal.tsx` | Import `updateAppointment`; branch in `handleSave` on `!!appointmentId` — edit mode now calls PATCH | 80f11f7 |

---

## Finding Manifest

| ID | Module | Severity | Status | Notes |
|----|--------|----------|--------|-------|
| EF-ORG-001 | dental-org | P0 | FIXED | assertBranchAccess → assertBranchRole |
| EF-ORG-002 | dental-org | P0 | FIXED | missing auth on branch GET |
| EM-PAT-005 | dental-patient | P0 | FIXED | branchId optional → required |
| EM-PAT-007 | dental-patient | P0 | FIXED | patients without branch bypassed auth |
| EM-VISIT-003 | dental-visit | P0 | FIXED | null visit silently skipped auth guard |
| EM-PMD-004 | dental-pmd | P0 | FIXED | sensitive content loaded before auth |
| EM-VISIT-001 | dental-visit | P0 | FIXED | dismissed restore lacked patientId scope |
| UJ-SCHED-003 | scheduling (UI) | P0 | FIXED | edit mode always called createAppointment |

---

## Blocked Findings

None.

---

## What's Next

All P0/P1 in scope are fixed. Routing: **continue down P0 backlog**.

Per `ENFORCEMENT_REPORT.md §11`, 157 open P0s remain across all modules. Recommended next targets (highest density):

1. **EX-006** — Event bus (all 23 domain events never emitted): still BLOCKED as own-phase. Plan with `/office-hours` before committing scope.
2. **322 pre-existing test failures** in `.allowed-failures` — start with `dental-org` and `dental-billing` modules (most critical auth surfaces).
3. **TypeSpec `@useAuth` annotations** for `recoverPin`, `set-pin`, `verify-pin` in `specs/api/src/` — needed to preserve `authMiddleware` config added in commit 61ed52c through future codegen.
4. Run `/oli-enforce-all` to reclassify the 8 newly fixed findings as RESOLVED in the baseline and get an updated P0 count.
