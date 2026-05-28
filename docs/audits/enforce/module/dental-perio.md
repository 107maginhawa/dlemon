<!--
oli: oli-enforce-module v1.0 | generated: 2026-05-27 | module: dental-perio
-->

# Module Enforcement Report: dental-perio

**Generated:** 2026-05-27  
**Module:** `dental-perio` — Periodontal Charting  
**Scope:** `services/api-ts/src/handlers/dental-perio/`  
**Status:** BACKEND EXISTS (frontend intentionally deferred — UI prototype phase)  
**Verdict:** CONDITIONAL PASS — 6 defects found (2 BLOCKERs, 4 WARNINGs)

---

## Coverage Matrix

| Workflow | Spec | Handler | Test | Verdict |
|----------|------|---------|------|---------|
| WF-P01 Create perio chart | POST /dental/perio-charts | `createPerioChart.ts` | coverage.test.ts | PASS |
| WF-P02 Record tooth readings | PUT /dental/perio-charts/:id/readings/:tooth | `upsertToothReading.ts` | coverage.test.ts | PASS |
| WF-P03 Complete chart | POST /dental/perio-charts/:id/complete | `completePerioChart.ts` | coverage.test.ts | PASS |
| WF-P04 View historical chart | GET /dental/perio-charts/:id + GET /dental/visits/:id/perio-chart | `getPerioChart.ts`, `getVisitPerioChart.ts` | coverage.test.ts (partial) | WARN (see WR-01) |
| WF-P05 Print chart (PDF) | None declared | NOT IMPLEMENTED | — | WARN (see WR-04) |

---

## Business Rule Coverage

| Rule | Description | Implemented | Notes |
|------|-------------|-------------|-------|
| BR-P01 | One chart per visit → 409 | Partial | See **BL-01** — wrong HTTP code |
| BR-P02 | Immutable after visit locked → 422 VISIT_LOCKED | Partial | See **BL-02** — wrong error code emitted |
| BR-P03 | Depths 0–20 mm → 422 INVALID_DEPTH | YES | `assertValidDepths` correct |
| BR-P04 | Valid FDI tooth numbers → 422 INVALID_TOOTH_NUMBER | YES | `assertValidToothNumber` correct |
| BR-P05 | Dentist role required → 403 | Partial | See **WR-02** — `hygienist` role admitted, not in spec |
| BR-P06 | Tooth reading upsert idempotent | YES | Correct ON CONFLICT upsert |
| BR-P07 | Min 16 readings to complete | YES | Enforced in `completePerioChart.ts` |

---

## API Contract Compliance

| Endpoint | Spec Status | Path | Auth | Notes |
|----------|-------------|------|------|-------|
| POST /dental/perio-charts | PARTIAL | ✅ | dentist only | Wrong 409→422 on duplicate (BL-01) |
| GET /dental/perio-charts/:id | PARTIAL | ✅ | dentist+staff_full | staff_scheduling admitted (WR-01) |
| GET /dental/visits/:visitId/perio-chart | PARTIAL | ✅ | dentist+staff_full | staff_scheduling admitted (WR-01) |
| PUT /dental/perio-charts/:chartId/readings/:toothNumber | PARTIAL | ✅ | dentist only | Wrong error code on locked chart (BL-02); hygienist role admitted (WR-02) |
| POST /dental/perio-charts/:id/complete | PARTIAL | ✅ | dentist only | Wrong error code on already-complete (WR-03); hygienist role admitted (WR-02) |

---

## State Transition Coverage

```
draft ──► completed ──► locked
```

| Transition | Handler | Enforced |
|------------|---------|---------|
| (new) → draft | createPerioChart | YES |
| draft → completed | completePerioChart | YES |
| completed → locked (visit lock cascade) | NOT IMPLEMENTED | MISSING (WR-04) |
| Write to completed chart → 422 CHART_COMPLETED | upsertToothReading | YES (wrong code: PERIO_CHART_LOCKED) |
| Write to locked chart → 422 VISIT_LOCKED | upsertToothReading | Partial (BL-02) |

---

## Domain Event Coverage

| Event | Spec | Emitted | Notes |
|-------|------|---------|-------|
| `perio.chart.created` | WF-P01 | Partial | Structured log emitted; no audit event to `dental-audit` module |
| `perio.chart.completed` | WF-P03 | Partial | Structured log with stats; no audit event |
| `perio.chart.locked` | Visit lock cascade | NOT IMPLEMENTED | No cascade handler exists |

---

## Findings

---

### BL-01 — BLOCKER: BR-P01 emits 422 instead of spec-required 409 on duplicate chart

**File:** `services/api-ts/src/handlers/dental-perio/createPerioChart.ts:57-59`

**Issue:** The duplicate chart guard throws `BusinessLogicError` with code `PERIO_CHART_DUPLICATE`. `BusinessLogicError` maps to HTTP 422. The spec (BR-P01, AC-P02, API_CONTRACTS.md POST errors) mandates HTTP 409. The test at `dental-perio-coverage.test.ts:168` asserts `res.status === 422`, meaning the test is also wrong — it validates the incorrect behaviour.

**Fix:**
```typescript
// createPerioChart.ts line 57-59
import { ConflictError } from '@/core/errors';

if (existing) {
  throw new ConflictError('A periodontal chart already exists for this visit');
  // ConflictError maps to HTTP 409 with code CONFLICT
}
```
Also update `dental-perio-coverage.test.ts:168` to assert `toBe(409)` and `body.code === 'CHART_EXISTS'`.

---

### BL-02 — BLOCKER: BR-P02 visit lock check in createPerioChart uses wrong error code and does not check the `completed` visit status

**File:** `services/api-ts/src/handlers/dental-perio/createPerioChart.ts:37-40`

**Issue:** The handler throws `BusinessLogicError('...', 'PERIO_VISIT_LOCKED')`. The API contract mandates error code `VISIT_LOCKED` (HTTP 422). The internal code `PERIO_VISIT_LOCKED` will reach the client and break any consumer checking for `VISIT_LOCKED`. Additionally, the same guard is absent from `upsertToothReading.ts` — the handler there only checks `chart.status !== 'draft'` (line 49) but never validates that the *parent visit* is locked. A chart can remain in `draft` status even after the parent visit transitions to `locked`, allowing reads through `chart.status === 'draft'` when they should be blocked.

**Fix:**
```typescript
// createPerioChart.ts line 39
throw new BusinessLogicError(
  `Cannot create perio chart on ${visit.status} visit`,
  'VISIT_LOCKED',  // matches API contract error code
);

// upsertToothReading.ts — add visit lock check after chart is fetched:
const visit = await getVisitOrThrow(db, chart.visitId);
if (visit.status === 'locked' || visit.status === 'completed' || visit.status === 'discarded') {
  throw new BusinessLogicError('Cannot modify chart on locked visit', 'VISIT_LOCKED');
}
```

---

### WR-01 — WARNING: getPerioChart admits staff_scheduling role — spec forbids it

**File:** `services/api-ts/src/handlers/dental-perio/getPerioChart.ts:30-36`

**Issue:** The `assertBranchRole` call includes `'staff_scheduling'` in the allowed list. The MODULE_SPEC §6 permissions table explicitly marks "View chart" as `❌` for `staff_scheduling`. The API contract likewise specifies auth as `dentist_owner | dentist_associate | staff_full` only. Granting view access to `staff_scheduling` exposes clinical periodontal records (PHI) to a role that has no clinical need.

**Fix:**
```typescript
// getPerioChart.ts line 30-36
await assertBranchRole(db, user.id, chart.branchId, [
  'dentist_owner',
  'dentist_associate',
  'hygienist',
  'staff_full',
  // Remove 'staff_scheduling'
]);
```
Apply the same fix to `getVisitPerioChart.ts:30-36`.

---

### WR-02 — WARNING: `hygienist` role granted clinical write access — not declared in spec

**File:** `services/api-ts/src/handlers/dental-perio/createPerioChart.ts:43`, `upsertToothReading.ts:54`, `completePerioChart.ts:46`

**Issue:** All three write handlers pass `['dentist_owner', 'dentist_associate', 'hygienist']` to `assertBranchRole`. The MODULE_SPEC §6 permission matrix and API_CONTRACTS.md both declare that write operations (create chart, record readings, complete chart) require `dentist_owner` or `dentist_associate` only. `hygienist` is not a declared role in the spec's permission matrix for any perio write operation. If `hygienist` is a valid system role (it is in the membership schema), admitting it here is an undocumented permission escalation that bypasses the spec.

**Fix:** Either remove `hygienist` from all three write-path `assertBranchRole` calls to match the spec, or explicitly update MODULE_SPEC §6 as an approved deviation with justification.

```typescript
// Matching spec exactly:
await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);
```

---

### WR-03 — WARNING: completePerioChart already-complete error emits 422 instead of spec-required 409

**File:** `services/api-ts/src/handlers/dental-perio/completePerioChart.ts:42-44`

**Issue:** When a chart is already completed or locked, the handler throws `BusinessLogicError(...)` which maps to HTTP 422. The API_CONTRACTS.md specifies `409 CHART_COMPLETED` for this condition. HTTP semantics: 409 Conflict is correct for "this resource is already in the terminal state"; 422 is wrong.

**Fix:**
```typescript
// completePerioChart.ts line 42-44
import { ConflictError } from '@/core/errors';

if (chart.status === 'completed' || chart.status === 'locked') {
  throw new ConflictError(`Perio chart is already ${chart.status}`);
  // ConflictError → 409 with code CONFLICT; rename to CHART_COMPLETED if desired
}
```
Also update `dental-perio-coverage.test.ts:273` to assert `toBe(409)`.

---

### WR-04 — WARNING: `perio.chart.locked` event and visit-lock cascade not implemented

**File:** `services/api-ts/src/handlers/dental-perio/` (no file)

**Issue:** MODULE_SPEC §10b declares the `perio.chart.locked` domain event triggered by "Visit lock cascade". The spec §8 state machine shows `completed → locked` auto-transition when the parent visit is locked. No handler, listener, or service hook exists to cascade visit lock → perio chart lock. Charts will remain in `completed` status indefinitely even after the parent visit is locked, violating the immutability guarantee in the spec ("Chart locked automatically when parent visit is locked — visit lifecycle BR-003").

**Fix:** Implement a `lockPerioChartByVisit(db, visitId)` service function in the perio module. Call it from the dental-visit lock handler (or a domain event bus) when a visit transitions to `locked`:
```typescript
// New: services/api-ts/src/handlers/dental-perio/lockPerioChartByVisit.ts
export async function lockPerioChartByVisit(db: DatabaseInstance, visitId: string): Promise<void> {
  await db
    .update(dentalPerioCharts)
    .set({ status: 'locked', updatedAt: new Date() })
    .where(and(
      eq(dentalPerioCharts.visitId, visitId),
      ne(dentalPerioCharts.status, 'locked'),
    ));
  // Emit perio.chart.locked audit event
}
```

---

## Summary

| Severity | Count | IDs |
|----------|-------|-----|
| BLOCKER | 2 | BL-01, BL-02 |
| WARNING | 4 | WR-01, WR-02, WR-03, WR-04 |
| INFO | 0 | — |

**BL-01** and **BL-02** must be fixed before any contract tests are authored — they produce wrong HTTP status codes that break API consumers and the acceptance criteria in the spec. The companion test assertions for BL-01 and WR-03 are also incorrect and validate wrong behavior.

**WR-01** is a PHI exposure risk: `staff_scheduling` must not read periodontal clinical records per the spec permission matrix.

**WR-04** leaves the `locked` state unreachable in production, breaking the immutability guarantee that is central to the clinical integrity model.

Frontend implementation status: **NOT STARTED** (intentional per brief — UI prototype phase). No frontend findings applicable.

---

_Enforced by: oli-enforce-module v1.0_  
_Reference standard: docs/audits/reference/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md §3.4, §3.5_
