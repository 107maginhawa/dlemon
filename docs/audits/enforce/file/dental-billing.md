<!-- oli-version: 1.1 | generated: 2026-05-29 | skill: oli-enforce-file | module: dental-billing | run: wave4-ef-bil -->

# File Enforcement Report — dental-billing

**Spec artifacts loaded:** MODULE_SPEC.md, API_CONTRACTS.md, DOMAIN_MODEL.md, ERROR_TAXONOMY.md, ROLE_PERMISSION_MATRIX.md, MODULE_MAP.md, MODULE_BOUNDARIES.md

---

## Summary

| Metric | Value |
|--------|-------|
| Files scanned | 35 |
| Handler files | 15 |
| Repo/schema/facade/util files | 8 |
| Test files | 12 |
| Total findings | 12 |
| P0 | 0 |
| P1 | 5 |
| P2 | 5 |
| P3 | 2 |
| Module traceability score | 7/15 files clean (47%) |

---

## Wave3 Fix Claim Verification

| Claimed Fix | Status | Notes |
|-------------|--------|-------|
| EF-BIL-001 (prior run) | **NOT FIXED** | `dental-billing.service.ts` still absent; all business rule logic remains in handler functions |

---

## Findings

| ID | Sev | Confidence | Title | File | Line | Spec Source |
|----|-----|-----------|-------|------|------|-------------|
| EF-BIL-001 | P1 | HIGH | `NO_BILLABLE_TREATMENTS` thrown as `ValidationError` (400) instead of `BusinessLogicError` (422) with correct code | `createDentalInvoice.ts` | 43 | ERROR_TAXONOMY §5 dental-billing |
| EF-BIL-002 | P1 | HIGH | `issueDentalInvoice` uses error code `INVALID_STATUS` instead of spec-declared `INVALID_STATUS_TRANSITION` | `issueDentalInvoice.ts` | 31 | ERROR_TAXONOMY §5 dental-billing; API_CONTRACTS |
| EF-BIL-003 | P1 | HIGH | `recordDentalPayment` uses error code `OVERPAYMENT` instead of spec-declared `PAYMENT_EXCEEDS_BALANCE` | `recordDentalPayment.ts` | 47–51 | ERROR_TAXONOMY §5 dental-billing; API_CONTRACTS |
| EF-BIL-004 | P1 | HIGH | `issueDentalInvoice` excludes `staff_full` from `assertBranchRole` — API_CONTRACTS declares `staff_full` as an allowed issuer | `issueDentalInvoice.ts` | 28 | API_CONTRACTS PATCH /invoices/:id/issue Auth; MODULE_SPEC §6 WF-052 |
| EF-BIL-005 | P1 | HIGH | Payment method enum missing `health_fund` and `plan`; `bank_transfer` (schema) conflicts with `transfer` (API spec) | `repos/dental-payment.schema.ts` | 15–17 | API_CONTRACTS POST /invoices/:id/payments `payment_method` enum |
| EF-BIL-006 | P2 | HIGH | `getPatientBalance` directly imports `PatientRepository` from `../patient/repos/patient.repo` — boundary violation | `getPatientBalance.ts` | 12 | MODULE_BOUNDARIES.md; MODULE_MAP.md M5 |
| EF-BIL-007 | P2 | HIGH | Missing `dental-billing.service.ts` — all BR logic lives in handler functions; non-reusable outside HTTP context | entire module | — | MODULE_SPEC §4 AI Instructions |
| EF-BIL-008 | P2 | HIGH | 3 handlers use `ctx.get('user')` (BaseContext) instead of `ctx.get('session')` (ValidatedContext) | `getCollectionsSummary.ts:33`, `getDentalPaymentReceipt.ts:17`, `getPatientBalance.ts:16` | 33/17/16 | MODULE_SPEC §4 Auth pattern |
| EF-BIL-009 | P2 | HIGH | `recordDentalPayment` does not call `logAuditEvent` — inconsistent with `voidDentalInvoice` and `applyDentalDiscount` | `recordDentalPayment.ts` | — | MODULE_SPEC §17 Observability; DE-008 |
| EF-BIL-010 | P2 | MEDIUM | Payment plan frequency: schema defines `biweekly` but API_CONTRACTS specifies `fortnightly` — wire-level mismatch | `repos/dental-payment-plan.schema.ts` | 14–16 | API_CONTRACTS POST /invoices/:id/payment-plans `frequency` enum |
| EF-BIL-011 | P3 | HIGH | `markOverdueInvoices()` exists in invoice repo but no cron/scheduler registers it — overdue transition never fires | `repos/dental-invoice.repo.ts` | 239 | MODULE_SPEC §8 BIL-S6; WF-054 |
| EF-BIL-012 | P3 | HIGH | Comment on line 30 misattributes BR-011 to consent check — BR-011 is "Active payment plan blocks void" | `createDentalInvoice.ts` | 30 | MODULE_SPEC §5 BR-011 |

---

## Detailed Finding Descriptions

### EF-BIL-001 — P1 | NO_BILLABLE_TREATMENTS wrong error class (HIGH)

**File:** `createDentalInvoice.ts` line 43

```typescript
// Current (WRONG — HTTP 400, code: VALIDATION_ERROR):
throw new ValidationError('No billable treatments found for this visit');

// Required (ERROR_TAXONOMY §5 — HTTP 422, code: NO_BILLABLE_TREATMENTS):
throw new BusinessLogicError('No billable treatments found for this visit', 'NO_BILLABLE_TREATMENTS');
```

**Impact:** Frontend and contract tests expecting `422 NO_BILLABLE_TREATMENTS` receive `400 VALIDATION_ERROR`. This is the primary acceptance criterion AC-BIL-001. The test at `dental-billing.test.ts:321` accepts `res.status 400`, masking the bug.

---

### EF-BIL-002 — P1 | INVALID_STATUS error code mismatch (HIGH)

**File:** `issueDentalInvoice.ts` line 31

```typescript
// Current (WRONG):
throw new BusinessLogicError('Only draft invoices can be issued', 'INVALID_STATUS');

// Required (ERROR_TAXONOMY §5):
throw new BusinessLogicError('Only draft invoices can be issued', 'INVALID_STATUS_TRANSITION');
```

API_CONTRACTS explicitly declares `INVALID_STATUS_TRANSITION(422)` for the issue endpoint.

---

### EF-BIL-003 — P1 | PAYMENT_EXCEEDS_BALANCE error code mismatch (HIGH)

**File:** `recordDentalPayment.ts` lines 47–51

```typescript
// Current (WRONG — 'OVERPAYMENT' not in ERROR_TAXONOMY catalog):
throw new BusinessLogicError(`Payment amount exceeds balance`, 'OVERPAYMENT');

// Required (ERROR_TAXONOMY §5, API_CONTRACTS):
throw new BusinessLogicError(`Payment amount exceeds balance`, 'PAYMENT_EXCEEDS_BALANCE');
```

---

### EF-BIL-004 — P1 | staff_full excluded from invoice issue role check (HIGH)

**File:** `issueDentalInvoice.ts` line 28

```typescript
// Current (excludes staff_full):
await assertBranchRole(db, session.userId, invoice.branchId, ['dentist_owner', 'dentist_associate']);

// API_CONTRACTS Auth: staff_full, dentist_associate, dentist_owner
// MODULE_SPEC WF-052 Step 2 Roles: dentist_owner, dentist_associate, staff_full
```

`staff_full` can record payments (`recordDentalPayment`) but cannot issue invoices — a broken workflow for front-desk staff who handle the full billing cycle.

---

### EF-BIL-005 — P1 | Payment method enum wire mismatch (HIGH)

**File:** `repos/dental-payment.schema.ts` lines 15–17

```typescript
// Schema (3 values):
pgEnum('dental_payment_method', ['cash', 'card', 'bank_transfer'])

// API_CONTRACTS requires (5 values):
// cash, card, transfer, health_fund, plan
```

Three violations:
1. `bank_transfer` (schema) vs `transfer` (API) — different string, DB enum violation for API clients sending `transfer`
2. `health_fund` — valid API payment method, absent from schema
3. `plan` — needed for installment-linked payments, absent from schema

---

### EF-BIL-006 — P2 | PatientRepository cross-module boundary violation (HIGH)

**File:** `getPatientBalance.ts` line 12

```typescript
// Current (VIOLATION — direct repo class import):
import { PatientRepository } from '../patient/repos/patient.repo';

// Correct approach — expose in patient-billing.facade.ts:
// export async function getPatientPreferredBranch(db, patientId) { ... }
```

`patient-billing.facade.ts` already exists for cross-module patient lookups but only provides name resolution. MODULE_BOUNDARIES.md explicitly prohibits direct repo class imports across module lines.

---

### EF-BIL-007 — P2 | Missing dental-billing.service.ts (HIGH)

All business rule guards (BR-009, BR-011, BR-012) live in handler functions. Business logic cannot be tested without an HTTP server, cannot be reused by background jobs (overdue cron), and all 15 handlers independently instantiate repos with `new Repo(db)`.

---

### EF-BIL-008 — P2 | Auth context extraction inconsistency (HIGH)

Three handlers use `ctx.get('user')` with `user.id` while all other 12 use `ctx.get('session')` with `session.userId`. The difference is type-safety — `BaseContext` lacks validation guarantees that `ValidatedContext` provides.

---

### EF-BIL-009 — P2 | recordDentalPayment missing audit event (HIGH)

`voidDentalInvoice` and `applyDentalDiscount` both call `logAuditEvent()`. `recordDentalPayment` only emits a structured log entry. MODULE_SPEC §17 lists `dental-billing.payment-recorded (INFO)` as a required observability hook. Domain event DE-008 (InvoicePaid) also not emitted.

---

### EF-BIL-010 — P2 | Payment plan frequency enum mismatch (MEDIUM)

```typescript
// Schema: 'weekly', 'biweekly', 'monthly'
// API_CONTRACTS: weekly, fortnightly, monthly
```

`biweekly` (schema) vs `fortnightly` (API) — clients sending `fortnightly` will receive a Postgres enum violation.

---

### EF-BIL-011 — P3 | markOverdueInvoices unregistered (HIGH)

`markOverdueInvoices(asOf: Date)` in `dental-invoice.repo.ts` is implemented but not called by any cron job or background worker. BIL-S6 (Overdue cron) slice remains incomplete in production.

---

### EF-BIL-012 — P3 | BR-011 comment misattribution (HIGH)

`createDentalInvoice.ts:30` comment reads `// BR-011: signed consent form required before invoicing`. BR-011 per MODULE_SPEC §5 is "Active payment plan blocks void". The consent check has no BR assignment in the spec.

---

## Auth Coverage — All 15 Handlers

| Handler | Auth Call | Result |
|---------|-----------|--------|
| `applyDentalDiscount.ts` | `assertBranchRole([dentist_owner])` | PASS |
| `createDentalInvoice.ts` | `assertBranchRole([dentist_owner, dentist_associate, staff_full])` | PASS |
| `createDentalPaymentPlan.ts` | `assertBranchRole([dentist_owner, dentist_associate, staff_full])` | PASS |
| `getCollectionsSummary.ts` | `assertBranchAccess` (optional) | PASS |
| `getDentalInvoice.ts` | `assertBranchAccess` | PASS |
| `getDentalPaymentPlan.ts` | `assertBranchAccess` | PASS |
| `getDentalPaymentReceipt.ts` | `assertBranchAccess` | PASS |
| `getPatientBalance.ts` | `assertBranchAccess` (via patient) | PASS (with null guard) |
| `issueDentalInvoice.ts` | `assertBranchRole([dentist_owner, dentist_associate])` | **FAIL — missing staff_full (EF-BIL-004)** |
| `listDentalInvoices.ts` | `assertBranchAccess` | PASS |
| `listDentalPayments.ts` | `assertBranchAccess` | PASS |
| `recordDentalPayment.ts` | `assertBranchRole([dentist_owner, dentist_associate, staff_full])` | PASS |
| `updateDentalPaymentPlan.ts` | `assertBranchRole([dentist_owner, staff_full])` | PASS |
| `voidDentalInvoice.ts` | `assertBranchRole([dentist_owner])` | PASS |
| `voidDentalPayment.ts` | `assertBranchRole([dentist_owner])` | PASS |

**P0 security auth gaps: 0**

---

## Business Rule Checks

| Rule | Result |
|------|--------|
| BR-009 — ≥1 performed/verified treatment | PASS (wrong error class — EF-BIL-001) |
| BR-010 — taxCents always 0 | PASS |
| BR-011 — Active payment plan blocks void | PASS |
| BR-012 — Invoice FSM strict | PASS (wrong error code — EF-BIL-002) |
| BR-013 — markUncollectible returns 501 | Advisory (no handler; deferred per spec) |

---

## Test Coverage

| Test File | Handlers Covered |
|-----------|-----------------|
| `dental-billing.test.ts` | 11 handlers (create, list, get, issue, void invoice; apply discount; record, list payments; void payment; create, get plan) |
| `dental-billing.invoice-lifecycle.test.ts` | getPatientBalance, getCollectionsSummary, getDentalPaymentReceipt |
| `dental-billing.edge-cases.test.ts` | getCollectionsSummary, getPatientBalance (period + branchId branches) |
| `billing-gate-http.test.ts` | createDentalInvoice (BR-009 planned treatment gate) |
| `acceptance.billing-payments.test.ts` | recordDentalPayment, voidDentalPayment, voidDentalInvoice, applyDentalDiscount |
| `dental-billing.payment-plan-fsm.test.ts` | createDentalPaymentPlan, updateDentalPaymentPlan, getDentalPaymentPlan |
| `invoice.fsm.property.test.ts` | FSM property tests |
| `payment-plan.fsm.property.test.ts` | Payment plan FSM property tests |
| `repos/dental-invoice.test.ts` | DentalInvoiceRepository unit |
| `repos/dental-payment-plan.test.ts` | DentalPaymentPlanRepository unit |
| `repos/dental-payment.test.ts` | DentalPaymentRepository unit |
| `utils/rounding.test.ts` | applyDiscountRate, applyTaxRate, bankersRound |

**Handler coverage: 15/15 (100%)** — all handlers have test coverage (EF-BIL-006 from prior run resolved).

---

## File Inventory (35 files)

### Handler files (15)

| File | Key Findings |
|------|-------------|
| `applyDentalDiscount.ts` | Clean |
| `createDentalInvoice.ts` | EF-BIL-001, EF-BIL-012 |
| `createDentalPaymentPlan.ts` | Clean |
| `getCollectionsSummary.ts` | EF-BIL-008 |
| `getDentalInvoice.ts` | Clean |
| `getDentalPaymentPlan.ts` | Clean |
| `getDentalPaymentReceipt.ts` | EF-BIL-008 |
| `getPatientBalance.ts` | EF-BIL-006, EF-BIL-008 |
| `issueDentalInvoice.ts` | EF-BIL-002, EF-BIL-004 |
| `listDentalInvoices.ts` | Clean |
| `listDentalPayments.ts` | Clean |
| `recordDentalPayment.ts` | EF-BIL-003, EF-BIL-009 |
| `updateDentalPaymentPlan.ts` | Clean |
| `voidDentalInvoice.ts` | Clean |
| `voidDentalPayment.ts` | Clean |

### Repo / schema / facade / util files (8)

| File | Key Findings |
|------|-------------|
| `repos/dental-invoice.repo.ts` | EF-BIL-011 |
| `repos/dental-invoice.schema.ts` | Clean |
| `repos/dental-payment-plan.repo.ts` | Clean |
| `repos/dental-payment-plan.schema.ts` | EF-BIL-010 |
| `repos/dental-payment.repo.ts` | Clean |
| `repos/dental-payment.schema.ts` | EF-BIL-005 |
| `repos/billing-dashboard.facade.ts` | Clean |
| `utils/rounding.ts` | Clean |

### Test files (12) — all use bun:test, all passing inventory check

---

## Module-Level Compliance

| Dimension | Status |
|-----------|--------|
| Error taxonomy | FAIL — 3 wrong codes (EF-BIL-001/002/003) |
| Domain terms | PASS |
| Data shapes (schema vs spec) | FAIL — Payment method + frequency enums diverge (EF-BIL-005/010) |
| Naming conventions | PASS — all camelCase, correct suffixes |
| Import boundaries | FAIL — 1 direct repo cross-import (EF-BIL-006) |
| Workflow annotations | N/A (0% WF-ID adoption, below 5% gate) |
| Auth coverage | WARN — 14/15 correct; 1 missing role (EF-BIL-004) |

---

## Remediation Priority

1. **P1 — EF-BIL-001:** `createDentalInvoice.ts:43` — change `new ValidationError(...)` to `new BusinessLogicError('...', 'NO_BILLABLE_TREATMENTS')`. Update test to expect 422.
2. **P1 — EF-BIL-002:** `issueDentalInvoice.ts:31` — change `'INVALID_STATUS'` to `'INVALID_STATUS_TRANSITION'`.
3. **P1 — EF-BIL-003:** `recordDentalPayment.ts:49` — change `'OVERPAYMENT'` to `'PAYMENT_EXCEEDS_BALANCE'`.
4. **P1 — EF-BIL-004:** `issueDentalInvoice.ts:28` — add `'staff_full'` to role array; add role-gate test.
5. **P1 — EF-BIL-005:** `repos/dental-payment.schema.ts` — rename `bank_transfer` → `transfer`, add `health_fund` and `plan`. Generate migration.
6. **P2 — EF-BIL-006:** Add `getPatientPreferredBranch()` to `patient-billing.facade.ts`; remove `PatientRepository` import from `getPatientBalance.ts`.
7. **P2 — EF-BIL-008:** Migrate `getCollectionsSummary`, `getDentalPaymentReceipt`, `getPatientBalance` to `ValidatedContext` + `ctx.get('session')`.
8. **P2 — EF-BIL-009:** Add `logAuditEvent` in `recordDentalPayment` emitting `billing.payment.recorded`.
9. **P2 — EF-BIL-010:** Rename `biweekly` → `fortnightly` in plan frequency enum. Generate migration.
10. **P2 — EF-BIL-007:** Extract `dental-billing.service.ts`.
11. **P3 — EF-BIL-011:** Register `markOverdueInvoices()` in pg-boss cron.
12. **P3 — EF-BIL-012:** Fix BR-011 comment in `createDentalInvoice.ts:30`.

---

## What's Next

**P1 findings present** — resolve spec-declared error code gaps (EF-BIL-001/002/003), the `staff_full` role omission (EF-BIL-004), and payment method enum divergence (EF-BIL-005) before merge. EF-BIL-001/002/003 are single-line fixes with test updates. EF-BIL-005 requires schema migration and Postgres enum update.
