# dental-perio — Module Enforcement
<!-- oli-enforce-module v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->

## Summary

- **Findings:** 10 (P0: 0, P1: 3, P2: 5, P3: 2)
- **Service-Layer Pattern:** ABSENT (`.repo.ts` present; no `.service.ts`)
- **Compliance Score:** 41/100
- **vs Prior Run (2026-05-27):** Prior BLOCKERs BL-01/BL-02 (wrong HTTP codes) persist as P2. Prior WR-04 (locked cascade) promoted to P1. F2 focus surfaces two new P1s: DI violation (EM-PER-002) and deep pocket threshold mismatch (EM-PER-003). WR-01 (staff_scheduling read access) downgraded — spec cross-check shows `getPerioChart` and `getVisitPerioChart` admit `staff_full` which is correct; `staff_scheduling` is the undeclared extension.

---

## Findings

| ID | Sev | Description | File | Line | Spec Ref |
|----|-----|-------------|------|------|----------|
| EM-PER-001 | **P1** | `completed→locked` state transition unimplemented — no cascade handler locks perio chart when parent visit is locked; `perio.chart.locked` event never emitted | `dental-perio/` (missing `lockPerioChartByVisit.ts`) | — | §8 State Transitions, §10b Domain Events |
| EM-PER-002 | **P1** | **F2 DI violation** — no `.service.ts` file; business logic (BR-P01/P02/P05/P07, summary stat computation) lives inline in all 5 handlers; repos instantiated per-request via `new PerioChartRepository(db)` — not injectable or mockable without real DB | `createPerioChart.ts:48`, `upsertToothReading.ts:44,56`, `completePerioChart.ts:38,48`, `getPerioChart.ts:25,38`, `getVisitPerioChart.ts:38,45` | 48 | F2 Service-Layer/DI |
| EM-PER-003 | **P1** | Deep pocket threshold mismatch — `DEEP_POCKET_THRESHOLD_MM = 5` (depth ≥5 counted); spec WF-P02 color coding defines ≥6 mm = red (severe); clinical threshold must be ≥6 mm | `completePerioChart.ts` | 25 | §2 Domain Terms, WF-P02 color coding |
| EM-PER-004 | P2 | BR-P01 duplicate chart: `createPerioChart` throws `BusinessLogicError` → 422 instead of spec-required 409 Conflict | `createPerioChart.ts` | 57 | API_CONTRACTS POST → 409 `PERIO_CHART_DUPLICATE` |
| EM-PER-005 | P2 | `completePerioChart` already-completed guard returns 422 instead of spec-required 409 | `completePerioChart.ts` | 40 | API_CONTRACTS POST `:id/complete` → 409 |
| EM-PER-006 | P2 | `hygienist` role admitted to write operations (create/upsert/complete) — undeclared in §6 Permissions (only `dentist_owner`, `dentist_associate` listed for writes) | `createPerioChart.ts:39`, `upsertToothReading.ts:53`, `completePerioChart.ts:44` | 39 | §6 Permissions |
| EM-PER-007 | P2 | Domain events `perio.chart.created` and `perio.chart.completed` are Pino log entries only — not published to `dental-audit` event bus; audit consumer cannot observe perio events | `createPerioChart.ts`, `completePerioChart.ts` | — | §10b Domain Events |
| EM-PER-008 | P2 | `getPerioChart` (GET `/dental/perio-charts/:chartId`) missing from `dental-perio-coverage.test.ts` — only 4 of 5 endpoints tested | `dental-perio-coverage.test.ts` | — | §12 Test Expectations |
| EM-PER-009 | P3 | No Hurl contract tests for dental-perio — §12 requires scenarios for all 5 endpoints (happy path + error paths) | `specs/api/tests/contract/` (missing) | — | §12 Test Expectations |
| EM-PER-010 | P3 | WF-P05 Print perio chart — no export/print endpoint; not annotated as deferred in implementation | `dental-perio/` (missing) | — | WF-P05 |

---

## Coverage Matrix

| Workflow | Endpoint | Handler File | Test Coverage | Status |
|----------|----------|--------------|---------------|--------|
| WF-P01 Create perio chart | POST /dental/perio-charts | `createPerioChart.ts` | `dental-perio-coverage.test.ts` | PASS (P2: HTTP code) |
| WF-P02 Record tooth readings | PUT /dental/perio-charts/:id/readings/:tooth | `upsertToothReading.ts` | `dental-perio-coverage.test.ts` | PASS |
| WF-P03 Complete chart | POST /dental/perio-charts/:id/complete | `completePerioChart.ts` | `dental-perio-coverage.test.ts` | PASS (P1: threshold) |
| WF-P04 View historical chart | GET /dental/perio-charts/:id + GET /dental/visits/:id/perio-chart | `getPerioChart.ts`, `getVisitPerioChart.ts` | Partial (`getPerioChart` untested) | WARN |
| WF-P05 Print chart | — | NOT IMPLEMENTED | — | MISSING (P3) |

---

## Business Rule Coverage

| Rule | Description | Status | Finding |
|------|-------------|--------|---------|
| BR-P01 | One chart per visit → 409 | PARTIAL | EM-PER-004 (emits 422) |
| BR-P02 | Immutable after visit locked | PARTIAL | EM-PER-001 (cascade not wired) |
| BR-P03 | Depths 0–20 mm → 422 INVALID_DEPTH | PASS | `assertValidDepths` correct |
| BR-P04 | Valid FDI tooth numbers | PASS | `assertValidToothNumber` correct (adult 11-48, primary 51-85) |
| BR-P05 | Dentist role required → 403 | PARTIAL | EM-PER-006 (hygienist undeclared) |
| BR-P06 | Tooth reading upsert idempotent | PASS | ON CONFLICT upsert in `perio-reading.repo.ts` |
| BR-P07 | Min 16 readings to complete | PASS | `MIN_READINGS_FOR_COMPLETE = 16` enforced |
| Deep pocket threshold | ≥6 mm = severe (WF-P02 spec) | FAIL | EM-PER-003 (code uses ≥5) |

---

## State Transition Coverage

```
draft ──► completed ──► locked
               └──── (auto-locked when parent visit locked)
```

| Transition | Handler | Enforced |
|------------|---------|----------|
| (new) → draft | `createPerioChart` | YES |
| draft → completed | `completePerioChart` | YES |
| completed → locked (visit lock cascade) | NOT IMPLEMENTED | MISSING — EM-PER-001 |
| Write to completed/locked chart → 422 | `upsertToothReading` | YES (`PERIO_CHART_LOCKED`) |

---

## API Contract Compliance

| Endpoint | Wired | Auth Guard | HTTP Codes | Status |
|----------|-------|------------|------------|--------|
| POST /dental/perio-charts | ✅ generated routes | `assertBranchRole` ✅ | 201 OK; 409 FAIL (emits 422) | PARTIAL |
| GET /dental/perio-charts/:chartId | ✅ | `assertBranchRole` ✅ | 200/404 OK | PASS |
| GET /dental/visits/:visitId/perio-chart | ✅ | `assertBranchRole` ✅ | 200/204/404 OK | PASS |
| PUT /dental/perio-charts/:chartId/readings/:toothNumber | ✅ | `assertBranchRole` ✅ | 200/404/422 OK | PASS |
| POST /dental/perio-charts/:chartId/complete | ✅ | `assertBranchRole` ✅ | 200 OK; 409 FAIL (emits 422) | PARTIAL |

All 5 endpoints registered in `services/api-ts/src/generated/openapi/routes.ts` (lines 1020–1300) via TypeSpec-generated route registry. Auth via `authMiddleware()` at route level + `assertBranchRole` in each handler.

---

## Domain Event Coverage

| Event | Spec Trigger | Emitted | Notes |
|-------|-------------|---------|-------|
| `perio.chart.created` | WF-P01 | PARTIAL | Pino structured log only; not on audit event bus |
| `perio.chart.completed` | WF-P03 | PARTIAL | Pino structured log with stats; not on audit event bus |
| `perio.chart.locked` | Visit lock cascade | NOT IMPLEMENTED | No cascade handler — EM-PER-001 |

---

## F2: Service-Layer/DI Assessment

### Pattern Status: ABSENT

No `.service.ts` file exists. Repository layer is present and structurally sound. Business logic lives directly in handler functions, repos are instantiated per-request inline.

### Code Evidence

**No `.service.ts` — repo instantiation is per-request in all 5 handlers:**

```typescript
// createPerioChart.ts:48
const repo = new PerioChartRepository(db);          // inline, not injected

// upsertToothReading.ts:44,56
const chartRepo = new PerioChartRepository(db);
const repo = new PerioReadingRepository(db);         // two inline instantiations

// completePerioChart.ts:38,48
const chartRepo = new PerioChartRepository(db);
const readingRepo = new PerioReadingRepository(db);  // two inline instantiations
```

**Business logic inline in handler (completePerioChart.ts:60–90):**
```typescript
// 18-line summary stat loop lives in handler body, not a service method:
for (const r of readings) {
  for (const f of DEPTH_FIELDS) {
    const v = r[f];
    if (typeof v === 'number') { depthSum += v; depthCount += 1;
      if (v >= DEEP_POCKET_THRESHOLD_MM) deepPocketCount += 1;
    }
  }
  ...
}
```

**No singleton exports found in any dental-perio file:**
```bash
# grep result: zero matches for singletons
grep -rn 'export const.*Repo\|export const.*Service\|= new Perio' dental-perio/
# → 0 results (only test-local `new PerioChartRepository(db)` in repo.test.ts)
```

### Per-Handler DI Status

| Handler | Inline `new` calls | Business Rules Inline |
|---------|-------------------|-----------------------|
| `createPerioChart.ts` | `new PerioChartRepository(db)` | BR-P01, BR-P02, BR-P05 |
| `getPerioChart.ts` | 2× inline repos | — |
| `getVisitPerioChart.ts` | 2× inline repos | — |
| `upsertToothReading.ts` | 2× inline repos | BR-P02, BR-P03, BR-P04 |
| `completePerioChart.ts` | 2× inline repos | BR-P07, summary stats computation |

### What F2-Compliant State Looks Like

```typescript
// Target: services/api-ts/src/handlers/dental-perio/dental-perio.service.ts
export class PerioService {
  constructor(
    private readonly chartRepo: PerioChartRepository,
    private readonly readingRepo: PerioReadingRepository,
  ) {}

  async createChart(db: DatabaseInstance, body: CreatePerioChartBody, userId: string): Promise<DentalPerioChart> {
    // BR-P01, BR-P02, BR-P05 logic here
  }

  async completeChart(chartId: string, userId: string): Promise<DentalPerioChart> {
    // BR-P07 + summary stat computation here
  }

  async upsertReading(...): Promise<DentalPerioToothReading> { ... }
  async getChart(...): Promise<DentalPerioChart & { readings: ... }> { ... }
  async getVisitChart(...): Promise<...> { ... }
}

// Singleton export (one instance per server lifetime)
export const perioService = new PerioService(perioChartRepo, perioReadingRepo);
```

Handlers become thin: `auth check → service call → ctx.json(result)`.

### Repo Pattern Quality: GOOD

`PerioChartRepository` and `PerioReadingRepository` both extend `DatabaseRepository<T>` base class correctly. `PerioChartRepository` has a purpose-built `complete()` method for atomic status+stats update. Schema has correct unique constraints (`dental_perio_chart_visit_unique`, `dental_perio_tooth_reading_chart_tooth_unique`). This is solid repo code — F2 extraction needs only a service wrapper, not a repo rewrite.

### Tenant Isolation Note

No `tenant_id` column on perio tables (consistent with project-wide branch-scoped tenancy model). Isolation enforced via `branchId` + `assertBranchRole(db, userId, branchId, roles)` on every write/read path. Pattern matches `dental-visit`, `dental-org`, and other modules. Not a finding.

---

## Stabilization Plan

### Fix Now — P1 (block before new work)

**EM-PER-001** — Implement `lockPerioChartByVisit(db, visitId)` utility and wire into dental-visit lock handler. Emit `perio.chart.locked` event.

**EM-PER-002** — Extract `PerioService` class. Move BR-P01/P02/P05/P07 + summary computation into service methods. Export singleton. Thin all 5 handlers.

**EM-PER-003** — Change `DEEP_POCKET_THRESHOLD_MM` from `5` to `6` in `completePerioChart.ts:25`. Update repo test expected `deepPocketCount` value.

### Fix Before New Perio Work — P2

**EM-PER-004** — Use `ConflictError` (409) for duplicate chart, not `BusinessLogicError` (422). Fix companion test assertion.

**EM-PER-005** — Return 409 for already-completed chart. Fix companion test assertion.

**EM-PER-006** — Decide hygienist write policy with clinical spec owner. Either remove from write-path `assertBranchRole` calls or update §6 Permissions with justification.

**EM-PER-007** — Publish `perio.chart.created` and `perio.chart.completed` to `dental-audit` domain event bus.

**EM-PER-008** — Add `getPerioChart` tests to `dental-perio-coverage.test.ts`.

### Fix When Touching — P3

**EM-PER-009** — Add Hurl contract tests for all 5 endpoints.

**EM-PER-010** — Document WF-P05 as deferred or implement PDF export endpoint.

---

## What's Next

- **Immediate:** EM-PER-002 (F2 service extraction) + EM-PER-003 (threshold fix) — both mechanical, low-risk changes.
- **Before v1.5 merge:** EM-PER-001 (locked cascade) blocks full state machine compliance and the `perio.chart.locked` audit trail.
- **Before ship:** EM-PER-004/005 (HTTP status codes) fix client-facing contract.
- **Route to:** `run-6-*` should verify F2 service extraction complete and EM-PER-001 cascade wired.

---

_Enforced by: oli-enforce-module v1.0 | run: run-5-f2-service-layer-di | 2026-05-28_
