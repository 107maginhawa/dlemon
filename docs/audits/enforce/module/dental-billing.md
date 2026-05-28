# dental-billing — Module Enforcement
<!-- oli-enforce-module --strict | run: run-6-strict-2026-05-29 | baseline: run-5-f2-service-layer-di-2026-05-28 -->

## Summary

| Field | Value |
|-------|-------|
| Module | dental-billing |
| Run ID | run-6-strict-2026-05-29 |
| Handler path | `services/api-ts/src/handlers/dental-billing/` |
| Handler count | 15 handlers, 3 repos, 12 test files |
| Score | **55 / 100** (run-5 baseline: 61) |
| V1 Status | **PARTIAL** |
| P0 findings | 1 (unchanged) |
| P1 findings | 6 (+1 new vs run-5) |
| P2 findings | 5 (+3 new vs run-5) |
| P3 findings | 1 (unchanged) |
| New findings | 4 (EM-BIL-010..013) |
| Resolved findings | 0 |

**Score dropped 6 points** from run-5 (61→55): 4 new findings surfaced, 0 run-5 findings resolved.

### Score breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| 1. Public API Completeness | 8/10 | 7/7 spec endpoints; WF-042 fee schedule missing |
| 2. Workflow Implementation | 7/10 | WF-042 absent; WF-054 overdue cron unwired |
| 3. Domain Term Consistency | 8/10 | `sent` (DOMAIN_MODEL) vs `issued` (code) divergence |
| 4. State Machine Enforcement | 7/10 | paid→void unspecced; uncollectible absent |
| 5. Event Publishing | 0/10 | DE-007/008/009 never published; no event bus found |
| 6. Auth / Permission Enforcement | 3/10 | P0 cap: EM-BIL-001 auth bypass still open |
| 7. Service Layer / DI (F2) | 2/10 | No .service.ts; repos instantiated inline |
| 8. Test Coverage | 8/10 | 12 test files, strong FSM property tests; AC-BIL-005 uncovered |
| **Overall** | **55/100** | |

---

## Findings

| ID | Sev | Run | Section | Description | File | Line |
|----|-----|-----|---------|-------------|------|------|
| EM-BIL-001 | **P0** | KNOWN | §6 | `listDentalInvoices` no auth when `branchId` omitted — any authenticated user enumerates all-branch invoices | `listDentalInvoices.ts` | 14–17 |
| EM-BIL-002 | P1 | KNOWN | §6 | `issueDentalInvoice` missing `staff_full` from allowed roles; spec declares staff_full, associate, owner | `issueDentalInvoice.ts` | 28 |
| EM-BIL-003 | P1 | KNOWN | §20/F2 | No `.service.ts`; all BR guards and orchestration live in handler functions; repos instantiated with `new Repo(db)` inline in every handler body | all 15 handlers | — |
| EM-BIL-004 | P1 | KNOWN | §10b | DE-007 `InvoiceCreated`, DE-008 `InvoicePaid`, DE-009 `InvoiceVoided` declared in MODULE_SPEC §10b — **never published**; zero emission calls across entire module; no event bus infrastructure found | `createDentalInvoice.ts`, `recordDentalPayment.ts`, `voidDentalInvoice.ts` | — |
| EM-BIL-005 | P1 | KNOWN | §5/BR-009 | BR-009 throws `ValidationError` (→ HTTP 400) not spec-declared `422 NO_BILLABLE_TREATMENTS`; test at `dental-billing.test.ts:321` asserts 400, confirming wrong status propagates | `createDentalInvoice.ts` | 43 |
| EM-BIL-006 | P1 | KNOWN | §3/WF-042 | WF-042 fee schedule lookup — no handler, no endpoint, no TypeSpec definition | — | — |
| EM-BIL-010 | P1 | **NEW** | §11/AC-BIL-002 | MODULE_SPEC §11 AC-BIL-002 declares BR-011 void-with-active-plan → **409 Conflict**; code throws `BusinessLogicError` (422); both test files assert `expect(res.status).toBe(422)` — HTTP status contract violated | `voidDentalInvoice.ts` L48; `dental-billing.edge-cases.test.ts` L339; `acceptance.billing-payments.test.ts` L359 | — |
| EM-BIL-007 | P2 | KNOWN | §8 | DOMAIN_MODEL §6 SM-INVOICE uses `sent`; implementation uses `issued` throughout schema/code — canonical state name divergence | `repos/dental-invoice.schema.ts` | 17 |
| EM-BIL-008 | P2 | KNOWN | §3/WF-054 | `markOverdueInvoices()` repo method complete but no pg-boss job wires it; `issued/partial → overdue` transition is orphaned | `repos/dental-invoice.repo.ts` | 239 |
| EM-BIL-011 | P2 | **NEW** | §8 | `voidDentalInvoice` allows voiding a `paid` invoice ("admin correction" comment L37); MODULE_SPEC §8 FSM only shows `draft/issued → void`; `paid` is terminal per spec — undocumented FSM extension | `voidDentalInvoice.ts` | 34–37 |
| EM-BIL-012 | P2 | **NEW** | §5/BR-010 | `dental-billing.invoice-lifecycle.test.ts:440` seeds invoice with `taxCents: 1200` and asserts it persists (L449); BR-010 mandates `taxCents` always 0 — test contradicts the invariant (either test seeds DB directly bypassing handler, or invariant is leaking) | `dental-billing.invoice-lifecycle.test.ts` | 440, 449 |
| EM-BIL-013 | P2 | **NEW** | §11/AC-BIL-005 | AC-BIL-005 (`markUncollectible → 501 NOT_IMPLEMENTED`) — no handler, no route, no test; zero grep hits for `markUncollectible` or `NOT_IMPLEMENTED` across billing module | — | — |
| EM-BIL-009 | P3 | KNOWN | §5/BR-013 | `sent → uncollectible` transition (BR-013, explicitly deferred) entirely absent — no handler, no guard | — | — |

---

## Dimension Details

### 1. Public API Completeness (8/10)

**Declared in API_CONTRACTS — 7 endpoints:**

| Endpoint | Handler | Status |
|----------|---------|--------|
| POST `/api/v1/dental/invoices` | `createDentalInvoice.ts` | FOUND |
| GET `/api/v1/dental/invoices` | `listDentalInvoices.ts` | FOUND (auth gap — EM-BIL-001) |
| GET `/api/v1/dental/invoices/:id` | `getDentalInvoice.ts` | FOUND |
| PATCH `/api/v1/dental/invoices/:id/issue` | `issueDentalInvoice.ts` | FOUND (role gap — EM-BIL-002) |
| POST `/api/v1/dental/invoices/:id/payments` | `recordDentalPayment.ts` | FOUND |
| POST `/api/v1/dental/invoices/:id/void` | `voidDentalInvoice.ts` | FOUND |
| POST `/api/v1/dental/invoices/:id/payment-plans` | `createDentalPaymentPlan.ts` | FOUND |

**Extra handlers (beyond spec minimum, no finding):** `applyDentalDiscount`, `getCollectionsSummary`, `getDentalPaymentPlan`, `getDentalPaymentReceipt`, `getPatientBalance`, `listDentalPayments`, `updateDentalPaymentPlan`, `voidDentalPayment`.

**Missing:** WF-042 fee schedule lookup → EM-BIL-006 (P1).

---

### 2. Workflow Implementation (7/10)

| Workflow | Priority | Code Path | Status |
|----------|----------|-----------|--------|
| WF-013 Create invoice from visit | P0 | `createDentalInvoice.ts` | FOUND |
| WF-014 Record payment | P0 | `recordDentalPayment.ts` | FOUND |
| WF-051 View invoice | P0 | `getDentalInvoice.ts` | FOUND |
| WF-052 Issue invoice | P0 | `issueDentalInvoice.ts` | FOUND (role gap — EM-BIL-002) |
| WF-015 Create payment plan | P1 | `createDentalPaymentPlan.ts` | FOUND |
| WF-041 Void invoice | P1 | `voidDentalInvoice.ts` | FOUND (paid-void unspecced — EM-BIL-011) |
| WF-042 Fee schedule lookup | P1 | — | **MISSING → EM-BIL-006** |
| WF-053 Mark partial (system) | P2 | `repos/dental-invoice.repo.ts` addPayment SQL CASE | FOUND |
| WF-054 Mark overdue (cron) | P2 | `markOverdueInvoices()` in repo | PARTIAL → EM-BIL-008 (no scheduler) |

---

### 3. Domain Term Consistency (8/10)

All five domain terms (Invoice, LineItem, Payment, PaymentPlan, Installment) correctly reflected in code. One known divergence: DOMAIN_MODEL §6 SM-INVOICE uses `sent`; implementation schema/enum uses `issued` throughout. MODULE_SPEC §8 itself uses `issued`, so implementation is self-consistent — divergence is DOMAIN_MODEL vs module-spec (EM-BIL-007, P2).

---

### 4. State Machine Enforcement (7/10)

| Transition | Guard in code | Notes |
|------------|--------------|-------|
| draft → issued | `issueDentalInvoice.ts` L32: `status !== 'draft'` → 422 | FOUND |
| issued → paid | repo `addPayment` CASE | FOUND |
| issued → partial | repo `addPayment` CASE | FOUND |
| partial → paid | repo `addPayment` CASE | FOUND |
| issued/partial → overdue | `markOverdueInvoices()` in repo | FOUND (no scheduler — EM-BIL-008) |
| draft/issued → void | `voidDentalInvoice.ts` + BR-011 check | FOUND |
| paid → void | `voidDentalInvoice.ts` L37 (comment: "admin correction") | **UNSPECCED → EM-BIL-011** |
| issued → uncollectible | No handler or guard | MISSING → EM-BIL-009 (P3, deferred) |

---

### 5. Event Publishing (0/10)

**Declared in MODULE_SPEC §10b:**
- DE-007 `InvoiceCreated` — on `createDentalInvoice`
- DE-008 `InvoicePaid` — on `recordDentalPayment` (paid path)
- DE-009 `InvoiceVoided` — on `voidDentalInvoice`

**Result:** Zero emission calls (`publishEvent`, `eventBus`, `InvoiceCreated`, `InvoicePaid`, `InvoiceVoided`) anywhere in the module. No event bus infrastructure detected in `services/api-ts/src/core/`. Handlers call `logAuditEvent` (structured log) — not domain event publishing.

→ EM-BIL-004 (P1): All three declared domain events unimplemented.

---

### 6. Auth / Permission Enforcement (3/10 — P0 cap)

| Operation | Spec Allowed | Impl Guard | Match |
|-----------|-------------|-----------|-------|
| Create invoice | owner, associate, staff_full | `assertBranchRole(['dentist_owner','dentist_associate','staff_full'])` | MATCH |
| Record payment | staff_full, dentist_owner | `assertBranchRole(['dentist_owner','dentist_associate','staff_full'])` | PARTIAL — associate extra (low risk) |
| Void invoice | dentist_owner only | `assertBranchRole(['dentist_owner'])` | MATCH |
| Create payment plan | staff_full, dentist_owner | `assertBranchRole(['dentist_owner','dentist_associate','staff_full'])` | PARTIAL — associate extra (low risk) |
| View invoices (list) | all dental roles (branch-scoped) | `assertBranchAccess` only when `branchId` provided; **no check** when omitted | **GAP → EM-BIL-001 (P0)** |
| Issue invoice | staff_full, associate, owner | `assertBranchRole(['dentist_owner','dentist_associate'])` | **MISSING staff_full → EM-BIL-002 (P1)** |

---

### 7. Service Layer / DI Assessment (2/10)

**Pattern: ABSENT (unchanged from run-5)**

3 repo files present (`dental-invoice.repo.ts`, `dental-payment.repo.ts`, `dental-payment-plan.repo.ts`) with constructor-injected `DatabaseInstance` — correct at repo layer.

No `dental-billing.service.ts` exists. All orchestration (BR-009, BR-011, BR-012 guards, state checks, audit logging, cross-repo side-effects) lives in handler functions. Repos instantiated inline with `new Dental*Repository(db)` in every handler body — no DI, no singleton, no factory.

`createDentalInvoice.ts` (106 lines) most egregious: consent check → treatment fetch → billability filter → double-billing guard → subtotal compute → invoice create → `markTreatmentsAsBilled` side-effect — all service-layer logic in a handler.

**Recommended:** Extract `dental-billing.service.ts` with `createInvoiceFromVisit()`, `issueInvoice()`, `voidInvoice()`, `recordPayment()`. Each handler becomes thin auth + validate + delegate.

---

### 8. Test Coverage (8/10)

12 test files:
- `dental-billing.test.ts` — happy-path CRUD
- `dental-billing.invoice-lifecycle.test.ts` — FSM transitions
- `dental-billing.edge-cases.test.ts` — error branches (BR-009, BR-011, BR-012)
- `dental-billing.payment-plan-fsm.test.ts` — payment plan state machine
- `invoice.fsm.property.test.ts` — property-based FSM invariants
- `payment-plan.fsm.property.test.ts` — property-based plan invariants
- `acceptance.billing-payments.test.ts` — AC-PAY-01..05
- `billing-gate-http.test.ts` — HTTP-layer BR-009 enforcement
- `repos/dental-invoice.test.ts`, `dental-payment.test.ts`, `dental-payment-plan.test.ts` — repo unit tests
- `utils/rounding.test.ts` — rounding utilities

**Gaps:**
- AC-BIL-001 test exists but asserts 400 (wrong status per spec) — misaligned with spec 422 requirement
- AC-BIL-005 (`markUncollectible → 501`) — no test anywhere (EM-BIL-013)
- BR-010 invariant: `invoice-lifecycle.test.ts:440` seeds `taxCents:1200` — contradicts always-0 rule unless test bypasses handler (EM-BIL-012)

---

## F2: Service-Layer / DI Assessment

### Pattern: ABSENT

**Repos present:**
```
repos/dental-invoice.repo.ts          — DentalInvoiceRepository (constructor DI)
repos/dental-payment.repo.ts          — DentalPaymentRepository (constructor DI)
repos/dental-payment-plan.repo.ts     — DentalPaymentPlanRepository (constructor DI)
```

**Service layer: ABSENT.** No `dental-billing.service.ts`. All orchestration in handlers.

**Handler fatness (inline `new` in handler body):**
```typescript
// issueDentalInvoice.ts:22
const repo = new DentalInvoiceRepository(db);
// recordDentalPayment.ts:25-26
const invoiceRepo = new DentalInvoiceRepository(db);
const paymentRepo = new DentalPaymentRepository(db);
// voidDentalInvoice.ts:25,43
const repo = new DentalInvoiceRepository(db);
const paymentPlanRepo = new DentalPaymentPlanRepository(db);
// createDentalInvoice.ts:36
const invoiceRepo = new DentalInvoiceRepository(db);
```

Identical pattern across all 15 handlers. Drizzle never called directly in handler (repo layer correctly interposed) — positive signal. DI pattern absent.

---

## Stabilization Plan

### Fix now (P0)
- **EM-BIL-001** — `listDentalInvoices`: require `branchId` query param OR call `assertBranchAccess` unconditionally. Unauthenticated cross-branch invoice enumeration is a data-isolation breach. Options: (a) require `branchId` (return 400 if absent), or (b) derive branches from session membership and scope query automatically.

### Fix before new work (P1)
- **EM-BIL-002** — Add `'staff_full'` to `assertBranchRole` in `issueDentalInvoice.ts:28`. One-line fix.
- **EM-BIL-005** — `createDentalInvoice.ts:43`: `throw new ValidationError(...)` → `throw new BusinessLogicError('No billable treatments found for this visit', 'NO_BILLABLE_TREATMENTS')`. Update `dental-billing.test.ts:321` and `billing-gate-http.test.ts:178` to assert `422`.
- **EM-BIL-010** — `voidDentalInvoice.ts:48`: change `BusinessLogicError` (422) → `ConflictError` (409) for `ACTIVE_PAYMENT_PLAN`. Update both test assertions to `toBe(409)`.
- **EM-BIL-003** — Extract `DentalBillingService`; move BR guards and orchestration out of handlers. Medium effort across 7 write handlers.
- **EM-BIL-004** — Implement domain event publishing for DE-007/008/009 in `createDentalInvoice`, `recordDentalPayment` (paid path), `voidDentalInvoice` using platform event bus.
- **EM-BIL-006** — Implement WF-042 fee schedule lookup handler. Requires TypeSpec + handler + repo query against dental-org fee schedule.

### Fix when touching (P2)
- **EM-BIL-007** — Reconcile DOMAIN_MODEL `sent` vs code `issued`. Preferred: update DOMAIN_MODEL to `issued` (simpler, avoids DB migration).
- **EM-BIL-008** — Register `markOverdueInvoices()` with pg-boss scheduler. Repo method complete; only job registration missing.
- **EM-BIL-011** — Decide: if `paid → void` is intentional admin correction, add `paid` to MODULE_SPEC §8 FSM table with a note. If not, add guard `throw BusinessLogicError('Cannot void a paid invoice', 'INVALID_STATUS')`.
- **EM-BIL-012** — Audit `invoice-lifecycle.test.ts:440`: if seeding DB directly (bypasses handler), add comment clarifying. If via handler, remove `taxCents: 1200` — handler hard-codes 0 per BR-010.
- **EM-BIL-013** — Add stub `PATCH /dental/billing/invoices/:id/uncollectible` returning 501 `NOT_IMPLEMENTED`. Add test for AC-BIL-005.

### Track (P3)
- **EM-BIL-009** — `markUncollectible` transition (BR-013, explicitly deferred per spec). No action until future wave.

---

## What's Next

1. **Immediate (1–3 line fixes):** EM-BIL-001 (P0), EM-BIL-002, EM-BIL-005, EM-BIL-010.
2. **This sprint:** EM-BIL-008 (pg-boss registration), EM-BIL-013 (501 stub + test).
3. **Before v2 feature work:** EM-BIL-003 (service layer) + EM-BIL-004 (domain events) — best done together when platform event bus is established.
4. **Backlog:** EM-BIL-006 (WF-042 fee schedule, requires dental-org coordination), EM-BIL-007 (terminology sync).

> Next: `/oli-enforce-fix --module dental-billing` to generate patches for P0/P1 findings.
