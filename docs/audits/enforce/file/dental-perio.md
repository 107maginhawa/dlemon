# dental-perio — File Enforcement
<!-- oli-enforce-file --strict | run: run-6-strict-2026-05-29 | 2026-05-29 -->

---

## Run Metadata

| Field | Value |
|-------|-------|
| Run ID | run-6-strict-2026-05-29 |
| Module | dental-perio |
| Handler path | services/api-ts/src/handlers/dental-perio/ |
| Files checked | 12 |
| Audit date | 2026-05-29 |

---

## Summary

| Severity | Count |
|----------|-------|
| P0 | 1 |
| P1 | 1 |
| P2 | 1 |
| P3 | 0 |

---

## Findings

### EF-PER-001 · P0 · Visit Lock Not Propagated to Chart

**Files:** `upsertToothReading.ts`, `completePerioChart.ts`

**Rule:** BR-P02 — Chart immutable after visit locked. Spec: `locked` state auto-applied when parent visit is locked.

**Finding:** Both write handlers check `chart.status !== 'draft'` to block writes. This works only if the chart status has already been updated to `locked`. However, there is no mechanism in the codebase to propagate a visit lock event to perio chart status. If a visit transitions to `locked` after a perio chart was created, the chart status remains `draft` and all writes succeed — violating BR-P02.

Neither `upsertToothReading` nor `completePerioChart` performs a live lookup of the parent visit's current status. The check is entirely chart-status-based with no visit join or event hook.

**Required fix (choose one):**
1. In `upsertToothReading` and `completePerioChart`, fetch the parent visit and check `visit.status === 'locked'` — throw `VISIT_LOCKED` (422) if so.
2. Add a DB trigger / domain event that sets `perio_chart.status = 'locked'` when `dental_visit.status` transitions to `locked`.

Option 1 is safer (no eventual consistency lag). The chart row already carries `visitId`; the visit lookup adds one DB round-trip.

**AC violated:** AC-P08 — Any write to chart when visit is locked returns 422.

---

### EF-PER-002 · P1 · staff_scheduling Allowed to View Chart (Spec Forbids)

**Files:** `getVisitPerioChart.ts` (line 35), `getPerioChart.ts` (line 35)

**Rule:** MODULE_SPEC §6 Permissions — `staff_scheduling` row: View chart ❌, Print chart ❌.

**Finding:** Both read handlers pass `'staff_scheduling'` in the `assertBranchRole` allowed-roles array, granting view access to a role the spec explicitly excludes.

```typescript
// getVisitPerioChart.ts lines 30-36 — same pattern in getPerioChart.ts
await assertBranchRole(db, user.id, visit.branchId, [
  'dentist_owner',
  'dentist_associate',
  'hygienist',
  'staff_full',
  'staff_scheduling',  // ← must be removed per spec
]);
```

**Required fix:** Remove `'staff_scheduling'` from allowed roles in both `getVisitPerioChart.ts` and `getPerioChart.ts`.

**Test gap:** `dental-perio-coverage.test.ts` tests staff_scheduling 403 for create/write only (AC-P09). No test asserts 403 on GET for staff_scheduling. Add a test case.

---

### EF-PER-003 · P2 · No Service Layer (Repositories Instantiated Directly in Handlers)

**Files:** createPerioChart.ts, upsertToothReading.ts, completePerioChart.ts, getVisitPerioChart.ts, getPerioChart.ts

**Rule:** F2 Service Layer / DI baseline — handlers must delegate to a service class with constructor-injected dependencies.

**Finding:** All five handlers instantiate `PerioChartRepository` and `PerioReadingRepository` directly via `new PerioChartRepository(db)` / `new PerioReadingRepository(db)`. No `PerioService` class exists. No singleton export for DI. Unit testing handlers with mocked repos is not possible.

**Required fix:** Extract a `PerioService` class at `services/api-ts/src/handlers/dental-perio/perio.service.ts` encapsulating chart and reading operations with constructor-injected repos. Export a singleton `perioService`. Handlers receive the service instance via DI (context or default parameter).

---

## Check Results

| Check | Result | Notes |
|-------|--------|-------|
| A. assertBranchRole | ✅ Present | All write handlers call assertBranchRole with correct dentist/hygienist roles |
| B. Visit Lock Check | ❌ MISSING — P0 | Chart status checked but visit lock not propagated — EF-PER-001 |
| C. Depth Validation [0,20] | ✅ Present | assertValidDepths in utils/perio-validation.ts, called in upsertToothReading |
| D. FDI Validation | ✅ Present | assertValidToothNumber: adult 11-18/21-28/31-38/41-48, primary 51-55/61-65/71-75/81-85 |
| E. Completion Gate ≥16 | ✅ Present | MIN_READINGS_FOR_COMPLETE = 16 enforced in completePerioChart |
| F. Unique Constraint | ✅ Present | visitId UNIQUE on perio_chart; (chartId, toothNumber) UNIQUE on perio_reading |
| G. Service Layer | ❌ Missing — P2 | Direct repo instantiation in all handlers — EF-PER-003 |
| H. Test Coverage | ⚠️ Partial | All AC covered except staff_scheduling view restriction (read 403 untested) |

---

## File Inventory

| File | Role | Issues |
|------|------|--------|
| `createPerioChart.ts` | Handler | No service layer (P2) |
| `upsertToothReading.ts` | Handler | Visit lock not checked (P0); no service layer (P2) |
| `completePerioChart.ts` | Handler | Visit lock not checked (P0); no service layer (P2) |
| `getVisitPerioChart.ts` | Handler | staff_scheduling allowed (P1); no service layer (P2) |
| `getPerioChart.ts` | Handler | staff_scheduling allowed (P1); no service layer (P2) |
| `repos/perio-chart.schema.ts` | Schema | Clean — UNIQUE on visitId present |
| `repos/perio-reading.schema.ts` | Schema | Clean — UNIQUE on (chartId, toothNumber) present |
| `repos/perio-chart.repo.ts` | Repository | Clean — extends DatabaseRepository, complete() method present |
| `repos/perio-reading.repo.ts` | Repository | Clean — upsert uses onConflictDoUpdate on (chartId, toothNumber) |
| `repos/perio-chart.repo.test.ts` | Test | Clean — covers create/upsert/complete/countByChart via openTestTx |
| `dental-perio-coverage.test.ts` | Integration test | Partial — staff_scheduling view restriction untested |
| `utils/perio-validation.ts` | Util | Clean — correct FDI sets and depth range [0,20] |
