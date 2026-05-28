# dental-billing — File Enforcement
<!-- oli-enforce-file v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->

## Summary
- Files scanned: 30 (`services/api-ts/src/handlers/dental-billing/` — 15 handlers + 10 repos/utils + 5 test files at root + repo-level tests)
- Findings: 5 (P0: 0, P1: 1, P2: 4, P3: 0)
- Service files present: `.service.ts` ❌  |  `.repo.ts` ✅ (3: invoice, payment-plan, payment)

## Findings

| ID | Sev | Description | File | Line |
|----|-----|-------------|------|------|
| EF-BIL-001 | P1 | Missing `.service.ts` — module has complex business logic (invoice FSM, double-billing prevention, tax/discount calculation, consent gate, overdue mark) spread across 15 handler files; `createDentalInvoice.ts` (106 lines) alone contains BR-011 consent guard + double-billing detection + subtotal calculation + `markTreatmentsAsBilled` side-effect inline in the handler | `createDentalInvoice.ts` | — |
| EF-BIL-002 | P2 | No per-handler `.test.ts` files — 15 handler files have zero individual test counterparts; test coverage exists only via integration-style test files (`dental-billing.test.ts`, `dental-billing.invoice-lifecycle.test.ts`, `dental-billing.edge-cases.test.ts`, `dental-billing.payment-plan-fsm.test.ts`, `acceptance.billing-payments.test.ts`, `billing-gate-http.test.ts`) which test HTTP paths but not handler unit contracts | All 15 handler files | — |
| EF-BIL-003 | P2 | `getCollectionsSummary.ts` is 115 lines — largest handler file; contains query construction, data aggregation, and response shaping inline; no repo method backing the aggregation (no `.repo.ts` method for collections summary — handled via `billing-dashboard.facade.ts` but the aggregation logic is in the handler) | `getCollectionsSummary.ts` | — |
| EF-BIL-004 | P2 | `billing-dashboard.facade.ts` placed inside `repos/` but is a facade/aggregator, not a repo — naming convention puts it in `repos/billing-dashboard.facade.ts` which is correct per module convention, but the file role is a read-model aggregation layer that would belong in a service if one existed | `repos/billing-dashboard.facade.ts` | — |
| EF-BIL-005 | P2 | `createDentalInvoice.ts` imports from two cross-module facades (`dental-visit/repos/visit-billing.facade` and `dental-clinical/repos/consent-billing.facade`) — these are facade-pattern cross-module imports (not direct schema imports) which is acceptable per the allowed pattern, but should be documented as sanctioned cross-module dependencies in the MODULE_SPEC §14 | `createDentalInvoice.ts` | 6–7 |

## File Inventory

### Handler files (15)

| File | Lines | Notes |
|------|-------|-------|
| `applyDentalDiscount.ts` | 61 | Clean |
| `createDentalInvoice.ts` | 106 | Complex business logic inline (EF-BIL-001) |
| `createDentalPaymentPlan.ts` | 62 | Clean |
| `getCollectionsSummary.ts` | 115 | Aggregation inline, no service (EF-BIL-003) |
| `getDentalInvoice.ts` | 68 | Clean |
| `getDentalPaymentPlan.ts` | 37 | Clean |
| `getDentalPaymentReceipt.ts` | 75 | Clean |
| `getPatientBalance.ts` | 59 | Clean |
| `issueDentalInvoice.ts` | 42 | Clean |
| `listDentalInvoices.ts` | 83 | Clean |
| `listDentalPayments.ts` | 39 | Clean |
| `recordDentalPayment.ts` | 82 | Clean |
| `updateDentalPaymentPlan.ts` | 46 | Clean |
| `voidDentalInvoice.ts` | 67 | Clean |
| `voidDentalPayment.ts` | 55 | Clean |
| **Handlers total** | **997** | |

### Repo / schema / facade files (10)

| File | Lines | Notes |
|------|-------|-------|
| `repos/dental-invoice.repo.ts` | 267 | Clean — under 300 |
| `repos/dental-invoice.schema.ts` | 67 | Clean |
| `repos/dental-payment-plan.repo.ts` | 213 | Clean |
| `repos/dental-payment-plan.schema.ts` | 58 | Clean |
| `repos/dental-payment.repo.ts` | 83 | Clean |
| `repos/dental-payment.schema.ts` | 40 | Clean |
| `repos/billing-dashboard.facade.ts` | 54 | Role mismatch: facade in repos/ (EF-BIL-004) |
| `utils/rounding.ts` | 49 | Clean |

### Test files (12)

| File | Lines | Notes |
|------|-------|-------|
| `dental-billing.test.ts` | (integration) | |
| `dental-billing.invoice-lifecycle.test.ts` | (integration) | |
| `dental-billing.edge-cases.test.ts` | (integration) | |
| `dental-billing.payment-plan-fsm.test.ts` | (integration) | |
| `acceptance.billing-payments.test.ts` | (integration) | |
| `billing-gate-http.test.ts` | (integration) | |
| `invoice.fsm.property.test.ts` | (property) | |
| `payment-plan.fsm.property.test.ts` | (property) | |
| `repos/dental-invoice.test.ts` | 276 | Repo unit tests |
| `repos/dental-payment-plan.test.ts` | 255 | Repo unit tests |
| `repos/dental-payment.test.ts` | 133 | Repo unit tests |
| `utils/rounding.test.ts` | 80 | Util unit tests |

## Checks: PASS

- **File naming**: All handler and repo files camelCase `.ts`. No PascalCase violations. ✅
- **File size**: No file exceeds 300 lines (handler or repo). `dental-invoice.repo.ts` at 267 lines is the largest — under threshold. ✅
- **Direct db ops in handlers**: Zero raw `db.insert/select/update/delete` calls found in any of the 15 handler files — all delegate to repo classes. ✅
- **Cross-module imports**: Only facade-pattern cross-module imports (`dental-visit/repos/visit-billing.facade`, `dental-clinical/repos/consent-billing.facade`) — no direct schema imports from other modules. ✅
- **`.repo.ts` files present**: 3 repo files cover all 3 data entities (invoice, payment-plan, payment). ✅
- **Directory structure**: `handlers/` (root), `repos/`, `utils/` — consistent and well-organized. ✅

## F2 Assessment: Service Layer

Module has the highest handler count in the codebase (15 handlers, 997 lines). Missing `.service.ts` is rated P1 because:

1. `createDentalInvoice.ts` (106 lines) contains multi-step business orchestration: consent check → treatment fetch → billability filter → double-billing guard → subtotal compute → invoice create → `markTreatmentsAsBilled` side-effect. This is service-layer logic, not handler-layer logic.
2. `getCollectionsSummary.ts` (115 lines) builds aggregation queries inline — a `BillingService.getCollectionsSummary()` method would make this testable in isolation.
3. The FSM state transitions (`issue`, `void`, `markOverdue`) in the repo have no service facade — callers must know to call repo + handle side-effects in handlers.

Recommended extraction: `dental-billing.service.ts` exposing `createInvoiceFromVisit()`, `issueInvoice()`, `voidInvoice()`, `recordPayment()`, `getCollectionsSummary()`. Each handler becomes a thin auth + validate + delegate layer.
