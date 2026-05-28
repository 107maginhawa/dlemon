# File Enforcement Report — dental-billing
<!-- oli-enforce-file --strict | run: run-6-strict-2026-05-29 | 2026-05-29 -->

## Summary
- Files scanned: 35 (`services/api-ts/src/handlers/dental-billing/` — 15 handlers + 8 repos/utils + 12 test files)
- Findings: 9 (P0: 0, P1: 2, P2: 5, P3: 2)
- Service files present: `.service.ts` ❌ | `.repo.ts` ✅ (3: invoice, payment-plan, payment)
- Auth gaps: 0 — all 15 handlers call `assertBranchAccess` or `assertBranchRole`

---

## Findings

| ID | Sev | Description | File | Line | Spec Ref |
|----|-----|-------------|------|------|----------|
| EF-BIL-001 | P1 | Missing `dental-billing.service.ts` — all BR logic (`BR-009`, `BR-011`, `BR-012`) lives in handler functions; non-reusable, untestable outside HTTP context | entire module | — | §4 Service Pattern |
| EF-BIL-002 | P1 | All repos instantiated inline (`new Repo(db)`) in every handler — no singleton, no factory, no DI; each request creates fresh repo instances | all 15 handlers | — | §4 DI Pattern |
| EF-BIL-003 | P2 | 3 handlers use `ctx.get('user')` (BaseContext) vs `ctx.get('session')` (ValidatedContext) — inconsistent auth token extraction; both call `assertBranchAccess` but type mismatch creates maintenance risk | `getCollectionsSummary.ts`, `getDentalPaymentReceipt.ts`, `getPatientBalance.ts` | — | §5 Auth Patterns |
| EF-BIL-004 | P2 | `recordDentalPayment` accepts direct payment on invoices with active payment plan — no guard or warning; silently bypasses installment schedule | `recordDentalPayment.ts` | — | WF-014 §4, BR-012 |
| EF-BIL-005 | P2 | `recordDentalPayment` does not call `logAuditEvent` — inconsistent with `voidDentalInvoice` and `applyDentalDiscount` which both emit audit events | `recordDentalPayment.ts` | — | §17 Observability |
| EF-BIL-006 | P2 | 4 handlers have no test coverage in any test file: `getCollectionsSummary`, `getDentalPaymentReceipt`, `getPatientBalance`, `listDentalPayments` | 4 files | — | §12 Test Expectations |
| EF-BIL-007 | P2 | `issued → uncollectible` transition declared in SM-INVOICE has no handler or guard — BR-013 deferred but no tracking comment in repo | `repos/dental-invoice.repo.ts` | — | §8 SM-INVOICE, BR-013 |
| EF-BIL-008 | P3 | `markOverdueInvoices()` exists in invoice repo but no scheduler/cron registers it — overdue transition never fires in production; BIL-S6 slice incomplete | `repos/dental-invoice.repo.ts` | — | §8 SM-INVOICE, BIL-S6 |
| EF-BIL-009 | P3 | `GET /dental/patients/:id/statement` in §10 maps to `getPatientBalance` which returns a balance summary object; spec implies full financial statement (all invoices + payments); naming mismatch may mislead frontend consumers | `getPatientBalance.ts` | — | §10 API Expectations |

---

## Billing-Specific Check Results

### A. createDentalInvoice — Treatment 'performed' gate (BR-009)
**PASS.** Handler filters treatments: `t.status === 'performed' || t.status === 'verified'`. Empty billable set throws `BusinessLogicError('NO_BILLABLE_TREATMENTS')`. Double-billing guard present (existing non-voided invoice on visit → 422).

### B. voidDentalInvoice — Already-paid guard
**PASS (by design).** Voiding a paid invoice is intentional (admin correction). Code comment documents this. Guard present: `status === 'voided'` → `ALREADY_VOIDED`. BR-011 correctly guards active payment plan, not paid status. Tests confirm this is deliberate.

### C. recordDentalPayment — Partial payments
**PASS.** Overpayment blocked (`amountCents > balanceCents` → `OVERPAYMENT`). Partial flows to `invoiceRepo.addPayment()` which sets invoice → `partial`. Guards for `INVALID_AMOUNT`, `ALREADY_PAID`, `VOIDED_INVOICE` all present. Idempotency via `receiptNumber` dedup.

### D. recordDentalPayment — Payment plan active guard
**FAIL → EF-BIL-004.** No check for active payment plan before accepting direct payment. WF-014 §4 states direct payments with an active plan should set `partial` (plan installments still outstanding); the guard or disambiguation logic is missing entirely.

### E. issueDentalInvoice — State machine guard
**PASS.** `status !== 'draft'` → 422 before issuing.

### F. updateDentalPaymentPlan — Terminal state guard
**PASS.** Terminal states (`completed`, `defaulted`) reject all transitions with 422.

---

## Auth Coverage (all 15 handlers)

All 15 handlers: ✅ session/user null check + assertBranchAccess or assertBranchRole present.
No P0 auth gaps found.

Pattern inconsistency (P2 EF-BIL-003): 3 handlers use `ctx.get('user')` (BaseContext) instead of `ctx.get('session')` — `getCollectionsSummary`, `getDentalPaymentReceipt`, `getPatientBalance`.

---

## State Machine Coverage

| Transition | Guard | Status |
|------------|-------|--------|
| draft → issued | `issueDentalInvoice.ts` status check | FOUND |
| issued → paid | `recordDentalPayment.ts` + repo `addPayment` | FOUND |
| issued → partial | `recordDentalPayment.ts` + repo `addPayment` | FOUND |
| partial → paid | repo `addPayment` CASE | FOUND |
| issued/partial → overdue | `markOverdueInvoices()` in repo | FOUND (no scheduler — EF-BIL-008) |
| draft/issued → void | `voidDentalInvoice.ts` + BR-011 plan check | FOUND |
| issued → uncollectible | No handler or guard | MISSING — EF-BIL-007 |

Score: **8/10**

---

## Test Coverage

**Scenario-based (no per-handler named test files):**

| Test File | Primary Coverage |
|-----------|-----------------|
| `dental-billing.test.ts` | createDentalInvoice, listDentalInvoices, getDentalInvoice, issueDentalInvoice |
| `billing-gate-http.test.ts` | createDentalInvoice (BR-009), issueDentalInvoice |
| `dental-billing.invoice-lifecycle.test.ts` | createDentalInvoice, issueDentalInvoice, recordDentalPayment, voidDentalInvoice |
| `acceptance.billing-payments.test.ts` | recordDentalPayment, voidDentalPayment, voidDentalInvoice, applyDentalDiscount |
| `dental-billing.payment-plan-fsm.test.ts` | createDentalPaymentPlan, updateDentalPaymentPlan, getDentalPaymentPlan |
| `dental-billing.edge-cases.test.ts` | edge cases across multiple handlers |
| `invoice.fsm.property.test.ts` | FSM property (issueDentalInvoice, voidDentalInvoice, recordDentalPayment) |
| `payment-plan.fsm.property.test.ts` | FSM property (createDentalPaymentPlan, updateDentalPaymentPlan) |
| `repos/dental-invoice.test.ts` | Repo unit tests |
| `repos/dental-payment-plan.test.ts` | Repo unit tests |
| `repos/dental-payment.test.ts` | Repo unit tests |
| `utils/rounding.test.ts` | Util unit tests |

**Untested handlers (no coverage in any file):**
- `getCollectionsSummary.ts`
- `getDentalPaymentReceipt.ts`
- `getPatientBalance.ts`
- `listDentalPayments.ts`

Handler test coverage: **11/15 (73%)** → EF-BIL-006

---

## File Inventory

### Handler files (15)

| File | Notes |
|------|-------|
| `applyDentalDiscount.ts` | Clean — assertBranchRole(dentist_owner) |
| `createDentalInvoice.ts` | BR-009 gate PASS; fat handler (EF-BIL-001) |
| `createDentalPaymentPlan.ts` | Clean |
| `getCollectionsSummary.ts` | BaseContext pattern (EF-BIL-003); untested (EF-BIL-006) |
| `getDentalInvoice.ts` | Clean |
| `getDentalPaymentPlan.ts` | Clean |
| `getDentalPaymentReceipt.ts` | BaseContext pattern (EF-BIL-003); untested (EF-BIL-006) |
| `getPatientBalance.ts` | BaseContext pattern (EF-BIL-003); untested (EF-BIL-006); naming (EF-BIL-009) |
| `issueDentalInvoice.ts` | State guard PASS |
| `listDentalInvoices.ts` | Clean |
| `listDentalPayments.ts` | Untested (EF-BIL-006) |
| `recordDentalPayment.ts` | Partial PASS; plan guard FAIL (EF-BIL-004); no audit log (EF-BIL-005) |
| `updateDentalPaymentPlan.ts` | Terminal state guard PASS |
| `voidDentalInvoice.ts` | BR-011 PASS; ALREADY_VOIDED PASS; paid-void by design |
| `voidDentalPayment.ts` | Clean |

### Repo / schema / facade files (8)
- `repos/dental-invoice.repo.ts` — 267 lines, clean; `markOverdueInvoices()` unscheduled (EF-BIL-008)
- `repos/dental-invoice.schema.ts` — clean
- `repos/dental-payment-plan.repo.ts` — clean
- `repos/dental-payment-plan.schema.ts` — clean
- `repos/dental-payment.repo.ts` — clean
- `repos/dental-payment.schema.ts` — clean
- `repos/billing-dashboard.facade.ts` — facade in repos/ (acceptable per module convention)
- `utils/rounding.ts` — clean

---

## Checks: PASS

- **File naming**: All handler/repo files camelCase `.ts`. ✅
- **File size**: No handler exceeds 300 lines (largest: `getCollectionsSummary.ts` ~115 lines). ✅
- **Direct db ops in handlers**: Zero raw `db.insert/select/update/delete` in any handler — all delegate to repos. ✅
- **Cross-module imports**: Only facade-pattern cross-module imports (no direct schema imports). ✅
- **Auth present**: All 15 handlers call assertBranchAccess or assertBranchRole. ✅
- **`.repo.ts` files**: 3 repos cover all 3 data entities. ✅

---

## Remediation Priority

1. **P1 — EF-BIL-001/002:** Extract `dental-billing.service.ts` with `createInvoiceFromVisit()`, `issueInvoice()`, `voidInvoice()`, `recordPayment()`, `getCollectionsSummary()`. Handlers become thin auth+validate+delegate.
2. **P2 — EF-BIL-004:** Add active plan guard in `recordDentalPayment` — `planRepo.findByInvoice(invoiceId)` → throw `PLAN_ACTIVE` if `status in ['on_track', 'behind']` (or accept with explicit `overridePlan` flag per product decision).
3. **P2 — EF-BIL-005:** Add `logAuditEvent` call in `recordDentalPayment` emitting `billing.payment.recorded`.
4. **P2 — EF-BIL-006:** Add HTTP integration tests for `getCollectionsSummary`, `getDentalPaymentReceipt`, `getPatientBalance`, `listDentalPayments`.
5. **P2 — EF-BIL-003:** Standardize all handlers to `ctx.get('session')` + `ValidatedContext`.
6. **P2 — EF-BIL-007:** Implement `uncollectible` transition handler or document BR-013 deferral in MODULE_SPEC.
7. **P3 — EF-BIL-008:** Register `markOverdueInvoices()` in a cron job or startup scheduler.
8. **P3 — EF-BIL-009:** Clarify `getPatientBalance` route naming vs spec's `statement` intent; expand response or rename.
