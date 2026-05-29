<!--
oli: oli-enforce-file v1.0 | generated: 2026-05-29 | module: dental-perio
source: MODULE_SPEC.md + API_CONTRACTS.md + DOMAIN_MODEL.md + ROLE_PERMISSION_MATRIX.md + MODULE_MAP.md
-->

# Enforce-File Audit: dental-perio

> **Module:** `dental-perio` — Periodontal Charting
> **Files inspected:** 12
> **Spec artifacts loaded:** MODULE_SPEC.md, API_CONTRACTS.md, DOMAIN_MODEL.md, ROLE_PERMISSION_MATRIX.md, MODULE_MAP.md

---

## File Inventory & Classification

| # | File | Type (Routing Table) | Spec Set Loaded |
|---|------|---------------------|-----------------|
| 1 | `createPerioChart.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 2 | `completePerioChart.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 3 | `getPerioChart.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 4 | `getVisitPerioChart.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 5 | `upsertToothReading.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 6 | `repos/perio-chart.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 7 | `repos/perio-chart.schema.ts` | Schema (entity) | DOMAIN_MODEL + MODULE_SPEC |
| 8 | `repos/perio-reading.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| 9 | `repos/perio-reading.schema.ts` | Schema (entity) | DOMAIN_MODEL + MODULE_SPEC |
| 10 | `utils/perio-validation.ts` | Util / lib | MODULE_SPEC |
| 11 | `dental-perio-coverage.test.ts` | Test | Mirror: MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| 12 | `repos/perio-chart.repo.test.ts` | Test | Mirror: MODULE_SPEC + DOMAIN_MODEL |

**Total:** 12 files classified | 12 globbed | Coverage: 100%

---

## Findings

### P1 Findings (Spec-Declared Gaps / Wrong Error Taxonomy on User-Facing Endpoints)

---

#### EF-PER-001 — `createPerioChart` emits wrong HTTP status and error code for duplicate chart

| Field | Value |
|-------|-------|
| **ID** | EF-PER-001 |
| **Severity** | P1 |
| **Confidence** | HIGH |
| **File** | `services/api-ts/src/handlers/dental-perio/createPerioChart.ts` |
| **Lines** | 52–54 |
| **Spec Source** | MODULE_SPEC §15 Error Handling; API_CONTRACTS POST /dental/perio-charts Errors |
| **Check Type** | Error taxonomy |

**Description:**
The handler throws `BusinessLogicError('...', 'PERIO_CHART_DUPLICATE')` which emits HTTP 422. The spec defines this condition as `409 CHART_EXISTS`. Two violations: (a) wrong HTTP status (422 vs 409), and (b) wrong error code (`PERIO_CHART_DUPLICATE` vs `CHART_EXISTS`). The test file is co-broken — it asserts `toBe(422)` and `PERIO_CHART_DUPLICATE`, validating the incorrect behavior. Should use `ConflictError` (409) with code `CHART_EXISTS`.

**Line context:**
```typescript
// createPerioChart.ts lines 52-54
if (existing) {
  throw new BusinessLogicError('A periodontal chart already exists for this visit', 'PERIO_CHART_DUPLICATE');
}
```

**Spec:**
```
MODULE_SPEC §15: CHART_EXISTS | 409 | Second chart for same visitId
API_CONTRACTS:   | 409 | CHART_EXISTS | Chart already exists for visitId
```

---

#### EF-PER-002 — `completePerioChart` emits wrong HTTP status and error code for already-completed chart

| Field | Value |
|-------|-------|
| **ID** | EF-PER-002 |
| **Severity** | P1 |
| **Confidence** | HIGH |
| **File** | `services/api-ts/src/handlers/dental-perio/completePerioChart.ts` |
| **Lines** | 42–44 |
| **Spec Source** | API_CONTRACTS POST /dental/perio-charts/:id/complete Errors |
| **Check Type** | Error taxonomy |

**Description:**
The handler throws `BusinessLogicError('...', 'PERIO_CHART_ALREADY_COMPLETE')` which emits HTTP 422. The spec defines this condition as `409 CHART_COMPLETED`. Two violations: (a) wrong HTTP status (422 vs 409), (b) wrong error code. Should use `ConflictError` (409) with code `CHART_COMPLETED`.

**Line context:**
```typescript
// completePerioChart.ts lines 42-44
if (chart.status === 'completed' || chart.status === 'locked') {
  throw new BusinessLogicError(`Perio chart is already ${chart.status}`, 'PERIO_CHART_ALREADY_COMPLETE');
}
```

**Spec:**
```
API_CONTRACTS: | 409 | CHART_COMPLETED | Already completed
```

---

#### EF-PER-003 — `perio-validation.ts` emits HTTP 400 for depth/tooth errors; spec requires 422

| Field | Value |
|-------|-------|
| **ID** | EF-PER-003 |
| **Severity** | P1 |
| **Confidence** | HIGH |
| **File** | `services/api-ts/src/handlers/dental-perio/utils/perio-validation.ts` |
| **Lines** | 9, 24, 35, 41 |
| **Spec Source** | API_CONTRACTS PUT readings Errors; MODULE_SPEC §15 Error Handling |
| **Check Type** | Error taxonomy |

**Description:**
`assertValidToothNumber` and `assertValidDepths` throw `ValidationError` which maps to HTTP 400 (`super(message, 'VALIDATION_ERROR', 400)` in errors.ts). The spec defines `INVALID_DEPTH` and `INVALID_TOOTH_NUMBER` as 422 errors. Additionally the spec-defined error codes (`INVALID_DEPTH`, `INVALID_TOOTH_NUMBER`) are not used — `ValidationError` always emits generic `VALIDATION_ERROR` code. Should use `BusinessLogicError(message, 'INVALID_DEPTH')` and `BusinessLogicError(message, 'INVALID_TOOTH_NUMBER')`.

**Line context:**
```typescript
// perio-validation.ts line 24
throw new ValidationError(`Invalid FDI tooth number: ${n}`);  // emits 400, code=VALIDATION_ERROR
// perio-validation.ts line 35
throw new ValidationError(`Periodontal depth ${f} must be an integer 0-20mm`);  // emits 400, code=VALIDATION_ERROR
```

**Spec:**
```
API_CONTRACTS: | 422 | INVALID_DEPTH | Any depth value < 0 or > 20
API_CONTRACTS: | 422 | INVALID_TOOTH_NUMBER | toothNumber not in valid FDI set
MODULE_SPEC §15: INVALID_DEPTH | 422 | Probing depth < 0 or > 20
MODULE_SPEC §15: INVALID_TOOTH_NUMBER | 422 | FDI tooth number not in valid set
```

---

#### EF-PER-004 — Error codes for VISIT_LOCKED are non-spec identifiers across handlers

| Field | Value |
|-------|-------|
| **ID** | EF-PER-004 |
| **Severity** | P1 |
| **Confidence** | HIGH |
| **Files** | `createPerioChart.ts` (line 38), `upsertToothReading.ts` (line 59) |
| **Spec Source** | MODULE_SPEC §15 Error Handling; API_CONTRACTS Errors tables |
| **Check Type** | Error taxonomy |

**Description:**
The spec defines a single error code `VISIT_LOCKED` (422) for "write attempt on locked visit." The code uses two different non-spec codes: `PERIO_VISIT_LOCKED` in `createPerioChart.ts` and `VISIT_IMMUTABLE` in `upsertToothReading.ts`. Neither matches the canonical `VISIT_LOCKED` code. Client error-handling code would need to handle three different identifiers across the module for the same condition.

**Line context:**
```typescript
// createPerioChart.ts line 38
throw new BusinessLogicError(`Cannot create perio chart on ${visit.status} visit`, 'PERIO_VISIT_LOCKED');

// upsertToothReading.ts line 59
throw new BusinessLogicError('Visit is immutable and cannot be modified', 'VISIT_IMMUTABLE');
```

**Spec:**
```
MODULE_SPEC §15: VISIT_LOCKED | 422 | Write attempt on locked visit
API_CONTRACTS:   | 422 | VISIT_LOCKED | Parent visit is locked
```

---

#### EF-PER-005 — `completePerioChart` missing VISIT_LOCKED check (spec-declared error path absent)

| Field | Value |
|-------|-------|
| **ID** | EF-PER-005 |
| **Severity** | P1 |
| **Confidence** | HIGH |
| **File** | `services/api-ts/src/handlers/dental-perio/completePerioChart.ts` |
| **Lines** | 29–117 (entire function body) |
| **Spec Source** | API_CONTRACTS POST /dental/perio-charts/:id/complete Errors; MODULE_SPEC BR-P02 |
| **Check Type** | Data shapes / missing spec-declared error path |

**Description:**
`POST /complete` must return `422 VISIT_LOCKED` if the parent visit is locked. The handler checks `chart.status` (catching charts already cascade-locked), but a `draft` chart whose parent visit became locked after the chart was created (before cascade propagates) can be incorrectly completed. The handler must explicitly fetch the parent visit and check `visit.status` before proceeding — consistent with how `upsertToothReading` handles this. The API_CONTRACTS explicitly lists this error path.

**Line context:**
```typescript
// completePerioChart.ts — no visit status check present; only chart.status is checked (line 42)
if (chart.status === 'completed' || chart.status === 'locked') { ... }
// Missing: fetch visit via chart.visitId, check visit.status === 'locked' | 'completed'
```

**Spec:**
```
API_CONTRACTS: | 422 | VISIT_LOCKED | Parent visit is locked
MODULE_SPEC BR-P02: Chart immutable after visit locked → 422 VISIT_LOCKED on any write
```

---

#### EF-PER-006 — `hygienist` role granted write access in all write handlers; absent from MODULE_SPEC permissions

| Field | Value |
|-------|-------|
| **ID** | EF-PER-006 |
| **Severity** | P1 |
| **Confidence** | HIGH |
| **Files** | `createPerioChart.ts` (line 42), `completePerioChart.ts` (line 46), `upsertToothReading.ts` (line 63) |
| **Spec Source** | MODULE_SPEC §6 Permissions; ROLE_PERMISSION_MATRIX.md |
| **Check Type** | Role-permission spec compliance |

**Description:**
All three write handlers call `assertBranchRole(db, user.id, ..., ['dentist_owner', 'dentist_associate', 'hygienist'])`. The `hygienist` role is not listed in MODULE_SPEC §6 for create/record/complete operations — only `dentist_owner` and `dentist_associate` are authorized. The ROLE_PERMISSION_MATRIX defines no `hygienist` scope for perio charting. While `hygienist` was added to the platform membership enum (MASTER_AUDIT P1-001), its per-module authorization scope must be explicitly codified in MODULE_SPEC before being granted.

**Line context:**
```typescript
// createPerioChart.ts lines 41-42
// BR-P05: dentist or hygienist role required on branch.
await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate', 'hygienist']);
```

**Spec:**
```
MODULE_SPEC §6 Permissions:
| Create chart    | dentist_owner ✅ | dentist_associate ✅ | staff_full ❌ | staff_scheduling ❌ |
| Record readings | dentist_owner ✅ | dentist_associate ✅ | staff_full ❌ | staff_scheduling ❌ |
| Complete chart  | dentist_owner ✅ | dentist_associate ✅ | staff_full ❌ | staff_scheduling ❌ |
```

---

### P2 Findings (Domain Term Drift / Internal Shape Mismatch / Convention Violations)

---

#### EF-PER-007 — `DEEP_POCKET_THRESHOLD_MM = 5` contradicts spec definition of ≥6 mm

| Field | Value |
|-------|-------|
| **ID** | EF-PER-007 |
| **Severity** | P2 |
| **Confidence** | HIGH |
| **File** | `services/api-ts/src/handlers/dental-perio/completePerioChart.ts` |
| **Lines** | 25, 72 |
| **Spec Source** | MODULE_SPEC §7 Data Requirements; MODULE_SPEC WF-P02; MODULE_SPEC WF-P04 |
| **Check Type** | Domain terms / data shapes |

**Description:**
`DEEP_POCKET_THRESHOLD_MM = 5` causes `summaryDeepPocketCount` to count teeth with any site depth ≥5 mm. The spec consistently defines "deep pockets" as ≥6 mm in three separate locations: WF-P02 color coding (≥6 mm = red), WF-P04 historical list ("teeth with deep pockets ≥6 mm"), and `summaryDeepPocketCount` field definition ("Teeth with max depth ≥6 mm"). This is a clinical accuracy error — the summary statistic will overcount affected teeth, misrepresenting periodontal severity.

**Line context:**
```typescript
// completePerioChart.ts line 25
const DEEP_POCKET_THRESHOLD_MM = 5;  // WRONG: spec defines deep pockets as >=6mm
// line 72
if (v >= DEEP_POCKET_THRESHOLD_MM) deepPocketCount += 1;  // should be >= 6
```

**Spec:**
```
MODULE_SPEC §7: summaryDeepPocketCount | int? | Teeth with max depth ≥6 mm
MODULE_SPEC WF-P02: ≥6 mm = red
MODULE_SPEC WF-P04: teeth with deep pockets (≥6 mm)
```

---

#### EF-PER-008 — Generic `Error()` thrown in `perio-reading.repo.ts` bypasses typed AppError middleware

| Field | Value |
|-------|-------|
| **ID** | EF-PER-008 |
| **Severity** | P2 |
| **Confidence** | HIGH |
| **File** | `services/api-ts/src/handlers/dental-perio/repos/perio-reading.repo.ts` |
| **Lines** | 76 |
| **Spec Source** | MODULE_SPEC §15 Error Handling (general pattern) |
| **Check Type** | Error taxonomy |

**Description:**
Line 76 throws a raw `Error('Upsert returned no row')` rather than a typed `AppError` subclass. This bypasses the centralized error-handling middleware which maps `AppError` subclasses to structured JSON responses with `code` and `statusCode`. A raw `Error` in this path will surface as an unhandled 500 with `{ error: "Upsert returned no row" }` without a machine-readable `code` field. Should use an `InternalServerError` or equivalent typed subclass.

**Line context:**
```typescript
// perio-reading.repo.ts line 76
if (!row) throw new Error('Upsert returned no row');
```

---

#### EF-PER-009 — `dental-perio` not registered in MODULE_MAP.md

| Field | Value |
|-------|-------|
| **ID** | EF-PER-009 |
| **Severity** | P2 |
| **Confidence** | HIGH |
| **File** | `docs/product/MODULE_MAP.md` |
| **Lines** | Gap between M8 and M9 |
| **Spec Source** | MODULE_MAP.md; MODULE_SPEC §1 Module Overview; MODULE_SPEC §14 Dependencies |
| **Check Type** | Naming conventions / module registration |

**Description:**
`dental-perio` has a full MODULE_SPEC, 12 implemented files, and routes registered in generated `routes.ts` — but is absent from `docs/product/MODULE_MAP.md`. The dependency graph omits dental-perio's declared runtime dependencies on `dental-visit`, `dental-patient`, and `dental-org`. Cross-module boundary analysis cannot flag dental-perio's direct schema imports from sibling module directories without this registration.

**Line context:**
```
MODULE_MAP.md: M8 (dental-pmd) → M9 (dental-emr-integration) — dental-perio absent
MODULE_SPEC §14 Dependencies:
  dental-visit | Runtime | visitId FK, status check
  dental-patient | Runtime | patientId
  dental-org | Runtime | branchId + examinerMemberId
```

---

#### EF-PER-010 — Stale comment in `dental-perio-coverage.test.ts` claims routes not wired in app.ts

| Field | Value |
|-------|-------|
| **ID** | EF-PER-010 |
| **Severity** | P2 |
| **Confidence** | HIGH |
| **File** | `services/api-ts/src/handlers/dental-perio/dental-perio-coverage.test.ts` |
| **Lines** | 13 |
| **Spec Source** | MODULE_SPEC §12 Test Expectations |
| **Check Type** | Naming conventions / documentation accuracy |

**Description:**
Line 13 states "Routes registered inline — not yet wired in app.ts." This is factually incorrect: routes are registered in `services/api-ts/src/generated/openapi/routes.ts` (lines 1020–1046) and handlers imported in `registry.ts` (lines 154–158). The stale comment may mislead developers into duplicating route registration.

**Line context:**
```typescript
// dental-perio-coverage.test.ts line 13
 * Routes registered inline — not yet wired in app.ts.
// STALE: routes.ts lines 1020-1046 register all 5 perio endpoints
// STALE: registry.ts lines 154-158 import all 5 handlers
```

---

### P3 Findings (Advisory)

---

#### EF-PER-011 — No WF-P0x workflow annotations in handler files

| Field | Value |
|-------|-------|
| **ID** | EF-PER-011 |
| **Severity** | P3 |
| **Confidence** | MEDIUM |
| **Files** | All 5 handler `.ts` files |
| **Spec Source** | MODULE_SPEC §3 Workflows (WF-P01 through WF-P05) |
| **Check Type** | Workflow annotation traceability |

**Description:**
MODULE_SPEC §3 defines 5 workflows (WF-P01 through WF-P05). No handler files contain `// WF-P0x` traceability annotations. Current adoption is 0/~20 exported functions (0%), below the 5% activation gate — advisory only. Adding annotations (e.g., `// WF-P01 — Create Perio Chart` in `createPerioChart.ts`) would improve spec traceability.

---

## File Compliance Scores

| File | Checks Applied | Findings | Compliance |
|------|---------------|----------|-----------|
| `createPerioChart.ts` | 6 | EF-PER-001, EF-PER-004, EF-PER-006 | 3/6 = 50% |
| `completePerioChart.ts` | 6 | EF-PER-002, EF-PER-005, EF-PER-006, EF-PER-007 | 2/6 = 33% |
| `getPerioChart.ts` | 6 | — | 6/6 = 100% |
| `getVisitPerioChart.ts` | 6 | — | 6/6 = 100% |
| `upsertToothReading.ts` | 6 | EF-PER-004, EF-PER-006 | 4/6 = 67% |
| `repos/perio-chart.repo.ts` | 5 | — | 5/5 = 100% |
| `repos/perio-chart.schema.ts` | 4 | — | 4/4 = 100% |
| `repos/perio-reading.repo.ts` | 5 | EF-PER-008 | 4/5 = 80% |
| `repos/perio-reading.schema.ts` | 4 | — | 4/4 = 100% |
| `utils/perio-validation.ts` | 3 | EF-PER-003 | 2/3 = 67% |
| `dental-perio-coverage.test.ts` | 4 | EF-PER-010 | 3/4 = 75% |
| `repos/perio-chart.repo.test.ts` | 3 | — | 3/3 = 100% |

---

## Module-Level Summary

| Metric | Value |
|--------|-------|
| Total files | 12 |
| Files with 0 P0/P1 findings | 7 |
| Files with P1 findings | 5 |
| Files with P2 findings | 4 |
| Module traceability score | 7/12 = 58% |
| Total findings | 11 |
| P0 | 0 |
| P1 | 6 |
| P2 | 4 |
| P3 | 1 |

---

## Findings Table

| ID | Severity | Confidence | File | Check Type | Description |
|----|----------|-----------|------|-----------|-------------|
| EF-PER-001 | P1 | HIGH | `createPerioChart.ts:52` | Error taxonomy | Wrong HTTP status (422) + wrong code `PERIO_CHART_DUPLICATE`; spec: 409 CHART_EXISTS |
| EF-PER-002 | P1 | HIGH | `completePerioChart.ts:42` | Error taxonomy | Wrong HTTP status (422) + wrong code `PERIO_CHART_ALREADY_COMPLETE`; spec: 409 CHART_COMPLETED |
| EF-PER-003 | P1 | HIGH | `utils/perio-validation.ts:24,35` | Error taxonomy | ValidationError (400) for INVALID_DEPTH/INVALID_TOOTH_NUMBER; spec: 422 with named codes |
| EF-PER-004 | P1 | HIGH | `createPerioChart.ts:38`, `upsertToothReading.ts:59` | Error taxonomy | VISIT_LOCKED spec code diverged: `PERIO_VISIT_LOCKED` and `VISIT_IMMUTABLE` used instead |
| EF-PER-005 | P1 | HIGH | `completePerioChart.ts` (entire) | Missing spec error path | POST /complete has no parent visit lock check; API_CONTRACTS declares 422 VISIT_LOCKED |
| EF-PER-006 | P1 | HIGH | 3 write handlers | Role-permission | `hygienist` role granted write access; not in MODULE_SPEC §6 permission table |
| EF-PER-007 | P2 | HIGH | `completePerioChart.ts:25` | Domain terms | `DEEP_POCKET_THRESHOLD_MM = 5`; spec defines deep pockets as ≥6 mm (clinical accuracy) |
| EF-PER-008 | P2 | HIGH | `repos/perio-reading.repo.ts:76` | Error taxonomy | Raw `Error()` throw bypasses structured AppError middleware |
| EF-PER-009 | P2 | HIGH | `docs/product/MODULE_MAP.md` | Module registration | dental-perio absent from MODULE_MAP dependency registry |
| EF-PER-010 | P2 | HIGH | `dental-perio-coverage.test.ts:13` | Naming conventions | Stale comment "not yet wired in app.ts" — routes ARE registered |
| EF-PER-011 | P3 | MEDIUM | All handler files | Workflow annotations | 0% WF-Pxx annotation adoption; below 5% gate — advisory |

---

## Review Required (LOW Confidence)

_No LOW-confidence findings in this audit._

---

## What's Next

**P1 findings require resolution before merge.**

1. **EF-PER-001** — Replace `BusinessLogicError` with `ConflictError` (409) for duplicate chart. Use code `CHART_EXISTS`. Update test assertion from 422 to 409.

2. **EF-PER-002** — Replace `BusinessLogicError` with `ConflictError` (409) for already-complete. Use code `CHART_COMPLETED`. Update test assertion.

3. **EF-PER-003** — Replace `ValidationError` with `BusinessLogicError(message, 'INVALID_DEPTH')` and `BusinessLogicError(message, 'INVALID_TOOTH_NUMBER')` to emit 422 with spec-defined codes.

4. **EF-PER-004** — Normalize to single code `VISIT_LOCKED` in both `createPerioChart.ts` and `upsertToothReading.ts`.

5. **EF-PER-005** — Add visit status fetch + lock check to `completePerioChart`, mirroring the pattern in `upsertToothReading`.

6. **EF-PER-006** — Decision required: either add `hygienist` to MODULE_SPEC §6 with explicit scope, or remove from `assertBranchRole` calls.

**P2 fixes (note: EF-PER-007 is clinically significant):**

7. **EF-PER-007** — Change `DEEP_POCKET_THRESHOLD_MM` from 5 to 6.

8. **EF-PER-008** — Replace raw `Error` with typed AppError subclass in `perio-reading.repo.ts`.

9. **EF-PER-009** — Register `dental-perio` in `docs/product/MODULE_MAP.md`.

10. **EF-PER-010** — Remove stale comment from `dental-perio-coverage.test.ts` line 13.
