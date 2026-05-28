# oli-enforce-file: dental-billing

**Generated:** 2026-05-27  
**Module:** dental-billing  
**Sources reviewed:**
- `services/api-ts/src/handlers/dental-billing/` (34 files)
- `apps/dentalemon/src/features/billing/` (10 files)
- `apps/dentalemon/src/routes/_dashboard/billing.tsx`
- `docs/product/modules/dental-billing/MODULE_SPEC.md`
- `docs/product/modules/dental-billing/API_CONTRACTS.md`

---

## Compliance Summary

| Category | Total Items | FOUND | MISSING | DIVERGED |
|----------|-------------|-------|---------|----------|
| API Endpoints | 8 | 7 | 1 | 3 |
| Business Rules | 5 | 4 | 0 | 1 |
| Data Model Tables | 5 | 5 | 0 | 1 |
| Domain Events | 4 | 0 | 4 | 0 |
| Workflows | 9 | 7 | 2 | 1 |
| Acceptance Criteria | 5 | 3 | 0 | 2 |
| Permissions | 5 | 4 | 0 | 1 |
| Frontend UI | 5 states + 3 components | 3 | 0 | 2 |

---

## Section 1: API Endpoints (MODULE_SPEC §10 / API_CONTRACTS)

### POST /dental/invoices — Create invoice
**Status: FOUND / DIVERGED**

File: `createDentalInvoice.ts`

Divergences:
1. **BLOCKER** — Spec says error code `NO_BILLABLE_TREATMENTS(422)`. Implementation throws `ValidationError` (maps to 400, not 422) with message "No billable treatments" at line 44. The error constructor used is `ValidationError`, not `BusinessLogicError`. Contract specifies 422.
2. **BLOCKER** — Spec requires `BR-010`: `taxCents` must always be 0. Implementation accepts `body.taxRate` from the request (lines 62–64) and computes non-zero `taxCents = Math.round(subtotalCents * taxRate)`. A caller can supply `taxRate > 0` and get a non-zero tax invoice, violating BR-010.
3. **WARNING** — Spec §10 lists endpoint as `POST /dental/invoices`. Handler uses path `POST /dental/billing/invoices` (confirmed in test wiring). Inconsistency between MODULE_SPEC path and implementation path. API_CONTRACTS uses `/api/v1/dental/invoices` with no `/billing/` segment.
4. **WARNING** — Spec response shape includes `paid_cents: 0` initially and `outstanding_cents`. Implementation returns flat `{ ...invoice, lineItems }` — no `outstanding_cents` field, and no `data:` envelope wrap. API_CONTRACTS requires `{ data: Invoice }`.
5. **INFO** — Implementation adds `CONSENT_REQUIRED` guard (not in MODULE_SPEC §5 business rules). Consent check at line 31 is an undocumented pre-condition. The `billing-gate-http.test.ts` file explicitly documents this as a "stop condition" noting the guard exists in production but is not yet in spec.

### GET /dental/invoices — List invoices
**Status: FOUND / DIVERGED**

File: `listDentalInvoices.ts`

Divergences:
1. **BLOCKER** — Pagination is applied post-query (lines 79–82): all rows are fetched from DB without a LIMIT/OFFSET, then sliced in memory. For 1000+ invoices this violates performance intent (MODULE_SPEC §16: "Invoice list < 2s (1000 invoices/branch)"). More critically, N+1 query problem: for each invoice row, two additional DB queries are made (`getPatientWithPersonForInvoice` and `getVisitForBilling` at lines 65–76). This is a correctness/reliability issue for production volumes.
2. **WARNING** — `branchId` is optional in this implementation (no 403 if omitted). API_CONTRACTS marks `branch_id` as **required** (YES in Required column). Handler allows listing without branch scope.
3. **WARNING** — Response is `{ data: page, pagination: ... }`. API_CONTRACTS says "Standard paginated collection (Invoice summary objects)" — no explicit envelope disagreement, but the `pagination` key is implementation-specific and not in the contract.
4. **INFO** — `date_from` / `date_to` filters declared in API_CONTRACTS are not implemented. No `conditions.push` for date range filtering in the handler.

### GET /dental/invoices/:id — Get invoice detail
**Status: FOUND / DIVERGED**

File: `getDentalInvoice.ts`

Divergences:
1. **WARNING** — Response includes extra field `priceCents` (renamed from `amountCents` at line 51–54) alongside the original `amountCents`. API_CONTRACTS `InvoiceLineItem` specifies `line_total_cents`, not `priceCents`. Field naming mismatch with contract.
2. **WARNING** — No `{ data: Invoice }` envelope. Returns flat object directly. API_CONTRACTS specifies `{ data: Invoice }` response shape.

### PATCH /dental/invoices/:id/issue — Issue invoice
**Status: FOUND / DIVERGED**

File: `issueDentalInvoice.ts`

Divergences:
1. **BLOCKER** — HTTP method mismatch. API_CONTRACTS specifies `PATCH /api/v1/dental/invoices/:id/issue`. Test wiring (dental-billing.test.ts line 143) registers this as `POST /dental/billing/invoices/:invoiceId/issue`. Implementation uses POST not PATCH.
2. **BLOCKER** — `staff_full` role is excluded. API_CONTRACTS `Auth:` field lists `staff_full, dentist_associate, dentist_owner`. Handler at line 28 allows only `['dentist_owner', 'dentist_associate']`. `staff_full` gets 403. Test at line 1213 confirms this: "staff_full → 403". MODULE_SPEC §6 also lists `dentist_owner, dentist_associate, staff_full` as authorized.
3. **WARNING** — Error code on non-draft invoice: implementation throws `INVALID_STATUS` (line 32). API_CONTRACTS specifies error code `INVALID_STATUS_TRANSITION`.

### POST /dental/invoices/:id/payments — Record payment
**Status: FOUND / DIVERGED**

File: `recordDentalPayment.ts`

Divergences:
1. **WARNING** — API_CONTRACTS `payment_method` enum: `cash, card, transfer, health_fund, plan`. Schema `paymentMethodEnum` in `dental-payment.schema.ts` only defines `cash, card, bank_transfer`. The values `transfer`, `health_fund`, and `plan` are absent. Frontend `invoice-detail.tsx` hardcodes `PAYMENT_METHODS = ['cash', 'card', 'bank_transfer']` — uses `bank_transfer` not `transfer`.
2. **WARNING** — Response shape does not match contract. API_CONTRACTS `Payment` response requires `payment_method`, `payment_date`, `recorded_at`. Implementation returns raw DB row with fields `method`, `receiptNumber`, `createdAt` etc.
3. **WARNING** — `staff_full` is allowed (line 32 includes `staff_full`). Spec §6 says only `staff_full, dentist_owner` may record payment — this is correct. But `dentist_associate` is also included in the handler's role check (`dentist_owner, dentist_associate, staff_full`) which is broader than the spec.
4. **INFO** — Error code `OVERPAYMENT` (line 49) — API_CONTRACTS specifies `PAYMENT_EXCEEDS_BALANCE`. Different code names.
5. **INFO** — Contract specifies `INVOICE_IMMUTABLE(422)` for paying voided/paid invoices. Implementation returns `VOIDED_INVOICE` and `ALREADY_PAID` as separate codes.

### POST /dental/invoices/:id/void — Void invoice
**Status: FOUND / DIVERGED**

File: `voidDentalInvoice.ts`

Divergences:
1. **BLOCKER** — Spec requires `reason` field (min:5, max:500) in request body per API_CONTRACTS. Implementation never reads a `reason` field from the body — there is no `ctx.req.valid('json')` call; validator is not registered for this route in any test wiring. Void reason is never persisted.
2. **WARNING** — API_CONTRACTS response is `{ data: { ok: true } }`. Handler returns the full voided invoice object from `repo.voidInvoice()`.
3. **WARNING** — MODULE_SPEC §8 state machine says `issued → void (BR-011)`. The handler comment (line 38) states "Voiding from any status (including 'paid') is intentional." This directly contradicts the spec state machine which shows void only from `draft`, `issued`, or `partial`. Voiding a `paid` invoice should be disallowed per spec.

### POST /dental/invoices/:id/payment-plans — Create payment plan
**Status: FOUND / DIVERGED**

File: `createDentalPaymentPlan.ts`

Divergences:
1. **WARNING** — API_CONTRACTS field names: `installment_count` (min:2, max:24), `first_payment_date`, `deposit_cents`. Implementation reads `body.numberOfInstallments`, `body.startDate` — no `first_payment_date` field, no `deposit_cents` field. Contract says `installment_count` min:2; no min validation exists in handler.
2. **WARNING** — API_CONTRACTS response `PaymentPlan` has `installment_amount_cents`, `next_payment_date`. Implementation returns `{ ...plan, installments }` with `amountPerInstallmentCents` and no `next_payment_date`.
3. **INFO** — Spec edge case (§13): "Payment plan with 0 installments → 422". No guard for `numberOfInstallments < 1` exists in handler. The contract min:2 check would catch this at validation layer only if validator enforces it.

### GET /dental/patients/:id/statement — Financial statement
**Status: MISSING**

No handler file exists for `GET /dental/patients/:id/statement`. MODULE_SPEC §10 lists this endpoint. `getPatientBalance.ts` provides per-patient balance data, but does not match the `/statement` path and returns a summary, not a full financial statement. The spec workflow WF-015 mentions patient financial statement as P0.

---

## Section 2: Business Rules (MODULE_SPEC §5)

### BR-009: Invoice requires ≥1 performed/verified treatment → 422 NO_BILLABLE_TREATMENTS
**Status: FOUND / DIVERGED**

File: `createDentalInvoice.ts:44`

- **BLOCKER** — Implementation throws `ValidationError` which maps to HTTP 400, not 422. Spec and API_CONTRACTS both require 422. The error code in the thrown exception is the default (no explicit code set), so the response body will not contain `NO_BILLABLE_TREATMENTS` as the error code.

### BR-010: Tax = 0 (stub, ADR-008)
**Status: FOUND / DIVERGED**

File: `createDentalInvoice.ts:62-64`

- **BLOCKER** — Implementation computes `taxCents = Math.round(subtotalCents * taxRate)` where `taxRate` comes from the request body (`body.taxRate ?? 0`). A client can submit `taxRate: 0.12` and get a non-zero tax invoice. BR-010 requires `taxCents` always be 0.
- Note: `applyDentalDiscount.ts` also calls `applyTaxRate()` using the stored `invoice.taxRate`, which can be non-zero if BR-010 was violated on creation.

### BR-011: Active payment plan blocks void → 409 ACTIVE_PAYMENT_PLAN
**Status: FOUND / DIVERGED**

File: `voidDentalInvoice.ts:44-46`

- **WARNING** — Spec says HTTP 409. Implementation uses `BusinessLogicError` with code `ACTIVE_PAYMENT_PLAN`. BusinessLogicError maps to HTTP 422 in this codebase (confirmed by AC-PAY-05 test at line 357: `expect(res.status).toBe(422)`). Spec requires 409.
- Implementation correctly checks `plan.status === 'on_track' || plan.status === 'behind'` which matches "active" semantics. Logic is correct; HTTP status code is wrong.

### BR-012: Invoice state machine (422 on invalid transition)
**Status: FOUND**

Files: `dental-invoice.repo.ts`, `invoice.fsm.property.test.ts`

- FSM logic is implemented. Property tests cover state transitions.
- Minor: `voidInvoice()` repo method does not guard against voiding an already-voided invoice at the DB layer — this is handled in the handler layer only.

### BR-013: markUncollectible → 501 NOT_IMPLEMENTED
**Status: MISSING**

No `markUncollectible` handler file exists. MODULE_SPEC §5 requires the endpoint to exist and return 501. There is no route registered that matches this case. If the client hits a non-existent endpoint, it gets 404 not 501.

---

## Section 3: Data Model (MODULE_SPEC §7)

### dental_invoice
**Status: FOUND / DIVERGED**

File: `repos/dental-invoice.schema.ts`

- `id, patient_id, visit_id, branch_id, status, total_cents, tax_cents, discount_cents, discount_reason, notes, due_date, voided_at, issued_at` — all present.
- **WARNING** — `notes` field is listed in MODULE_SPEC §7 but absent from `dentalInvoices` schema definition. The schema has `discountReason` and `discountedBy` but no `notes` column.
- `paid_cents` and `outstanding_cents` (computed) — `paid_cents` is stored; `outstanding_cents` is computed as `balanceCents` in storage (naming mismatch with spec).

### dental_invoice_line_item
**Status: FOUND**

File: `repos/dental-invoice.schema.ts:49-62`

- All spec fields present: `id, invoice_id, treatment_id, cdt_code, description, quantity, unit_price_cents`.
- Extra fields: `tooth_number`, `is_done`, `amount_cents`. These are implementation extensions, not violations.

### dental_payment
**Status: FOUND / DIVERGED**

File: `repos/dental-payment.schema.ts`

- Spec fields: `id, invoice_id, amount_cents, method (cash/card/bank_transfer), receipt_number, voided_at` — all present.
- **WARNING** — Schema `paymentMethodEnum` is `['cash', 'card', 'bank_transfer']`. API_CONTRACTS payment_method enum includes `transfer, health_fund, plan`. These values are unrepresentable in the DB schema.
- `receipt_number` is `NOT NULL` in schema. API_CONTRACTS marks `reference` (equivalent) as nullable/optional. This creates a constraint mismatch — clients must always supply a receipt number or the DB insert will fail.

### dental_payment_plan
**Status: FOUND / DIVERGED**

File: `repos/dental-payment-plan.schema.ts`

- Spec fields: `id, invoice_id, frequency, installment_count, status` — present (as `numberOfInstallments`).
- **WARNING** — Plan `frequency` enum in schema is `['weekly', 'biweekly', 'monthly']`. API_CONTRACTS specifies `weekly, fortnightly, monthly`. The value `biweekly` vs `fortnightly` is a naming mismatch — these represent the same concept but different string values.

### dental_payment_plan_installment
**Status: FOUND**

File: `repos/dental-payment-plan.schema.ts:41-53`

- All spec fields present: `id, plan_id, due_date, amount_cents, paid_amount_cents (as paidCents), status`.

---

## Section 4: Domain Events (MODULE_SPEC §10b)

### DE-007 InvoiceCreated
**Status: MISSING**

No event emission code in `createDentalInvoice.ts`. No event bus import or publish call. API_CONTRACTS states "Events emitted: DE-007 InvoiceCreated".

### DE-008 InvoicePaid
**Status: MISSING**

No event emission in `recordDentalPayment.ts`. API_CONTRACTS states "Events emitted: DE-008 InvoicePaid (when invoice fully paid)".

### DE-009 InvoiceVoided
**Status: MISSING**

No event emission in `voidDentalInvoice.ts`. Audit log is written via `logAuditEvent` but this is not a domain event publication. API_CONTRACTS states "Events emitted: DE-009 InvoiceVoided".

### DE-005 TreatmentPerformed (consumed)
**Status: MISSING**

No consumer handler or subscription for DE-005. MODULE_SPEC §10b says this event "triggers eligible-for-invoice flag on visit". No such flag logic exists in the billing module.

---

## Section 5: Workflows

### WF-013 — Create invoice from visit (P0)
**Status: FOUND** — `createDentalInvoice.ts`

### WF-014 — Record payment (P0)
**Status: FOUND** — `recordDentalPayment.ts`

### WF-051 — View invoice (P0)
**Status: FOUND** — `getDentalInvoice.ts`

### WF-052 — Issue invoice draft→issued (P0)
**Status: FOUND / DIVERGED** — `issueDentalInvoice.ts`

- `staff_full` excluded from role gate (see API Endpoint finding above).

### WF-015 — Create payment plan (P1)
**Status: FOUND** — `createDentalPaymentPlan.ts`

### WF-041 — Void invoice (P1)
**Status: FOUND / DIVERGED** — `voidDentalInvoice.ts`

- Missing `reason` field. HTTP 409 returned as 422. State machine allows voiding `paid` invoices.

### WF-042 — Fee schedule lookup (P1)
**Status: MISSING**

No fee schedule lookup handler in the billing module. MODULE_SPEC §14 marks `dental-org (fee schedule)` as a dependency. `createDentalInvoice.ts` does not call any fee schedule lookup — it uses treatment `priceCents` directly. The pre-population of line items from a CDT fee schedule (WF-013 step 3) is absent.

### WF-053 — Mark partial (payment plan) (P2)
**Status: FOUND** — handled implicitly via `addPayment()` SQL CASE logic in repo.

### WF-054 — Mark overdue cron (P2)
**Status: FOUND** — `DentalInvoiceRepository.markOverdueInvoices()` exists. No pg-boss wiring visible in the billing module directory (may be in a separate cron registration file not within scope).

---

## Section 6: Acceptance Criteria (MODULE_SPEC §11)

### AC-BIL-001: Create invoice with 0 performed treatments → 422 NO_BILLABLE_TREATMENTS
**Status: DIVERGED**

- **BLOCKER** — Code returns HTTP 400 (ValidationError), not 422. Error code is not set to `NO_BILLABLE_TREATMENTS`. Tests in `dental-billing.test.ts:321` confirm 400 is returned and check for `/billable/i` message, not the specific error code.

### AC-BIL-002: Void invoice with active payment plan → 409
**Status: DIVERGED**

- **BLOCKER** — Code returns 422 not 409 (confirmed by test `ac-billing.test.ts:357`). Spec requires 409.

### AC-BIL-003: Record partial payment → invoice transitions to partial + requires PaymentPlan
**Status: DIVERGED**

- Partial status transition is correct (confirmed by tests).
- **WARNING** — "Requires PaymentPlan" — the spec implies a partial payment without a payment plan should fail or prompt for one. Implementation allows partial payment without any payment plan. No enforcement of plan requirement for partial status.

### AC-BIL-004: taxCents always 0 in all invoice responses (BR-010)
**Status: DIVERGED**

- **BLOCKER** — `taxCents` is not always 0. Client can pass `taxRate > 0` and produce non-zero tax (see BR-010 finding).

### AC-BIL-005: markUncollectible → 501 (BR-013)
**Status: MISSING**

- No endpoint exists. Would return 404 not 501.

---

## Section 7: Permissions (MODULE_SPEC §6)

### Create invoice: dentist_owner, dentist_associate, staff_full
**Status: FOUND** — `createDentalInvoice.ts:28` allows all three roles. Correct.

### Record payment: staff_full, dentist_owner
**Status: DIVERGED**

- **WARNING** — Handler at line 32 allows `['dentist_owner', 'dentist_associate', 'staff_full']`. Spec says only `staff_full, dentist_owner`. `dentist_associate` should get 403.

### Void invoice: dentist_owner only
**Status: FOUND** — Correctly restricted to `['dentist_owner']` in handler.

### Create payment plan: staff_full, dentist_owner
**Status: DIVERGED**

- **WARNING** — Handler at line 30 allows `['dentist_owner', 'dentist_associate', 'staff_full']`. Spec says only `staff_full, dentist_owner`. `dentist_associate` should not be able to create payment plans.

### View invoices: all dental roles
**Status: FOUND** — `listDentalInvoices.ts` uses `assertBranchAccess` (not role-restricted). `getDentalInvoice.ts` uses `assertBranchAccess`. Consistent with "all dental roles" permission.

---

## Section 8: Frontend UI (MODULE_SPEC §9)

### Invoice list: filterable by status/date; outstanding invoices highlighted
**Status: FOUND / DIVERGED**

File: `features/billing/components/billing-list.tsx`

- Status filter tabs: FOUND.
- Date filter: **MISSING** — no date range filter UI. Spec says "filterable by status/date".
- Outstanding highlighted: FOUND (red text for balanceCents > 0).
- `draft` status missing from filter tabs `FILTER_TABS` at line 114 — tabs are `['all', 'paid', 'partial', 'issued', 'overdue', 'voided']`. Draft invoices cannot be filtered to directly.

### Invoice detail: line items, payment history, payment plan installments
**Status: FOUND / DIVERGED**

File: `features/billing/components/invoice-detail.tsx`

- Line items: FOUND.
- Payment history: FOUND.
- Payment plan installments: **MISSING from InvoiceDetail** — the component does not show payment plan installments inline. A separate `PaymentPlanView` modal must be opened via "View Payment Plan" button. Spec says detail should include "payment plan installments".
- **BLOCKER** — `handleVoid()` at line 212 does not send a `reason` in the request body (line 217: empty POST body). API endpoint requires `reason` (min:5) per API_CONTRACTS. The void will succeed in backend (since backend also doesn't validate the body — see BR-011 finding) but this is a double gap: both sides ignore the required field.

### Payment modal: amount entry, method select, partial payment toggle
**Status: FOUND / DIVERGED**

File: `features/billing/components/invoice-detail.tsx:443-526`

- Amount entry: FOUND.
- Method select: FOUND.
- Partial payment toggle: **MISSING** — no toggle. Any amount less than balance is treated as partial automatically.
- `recordedByMemberId` is hardcoded to empty string `''` at line 248. Payment will be created with empty membership reference.

### State: Loading
**Status: FOUND**

### State: Empty
**Status: FOUND**

### State: Invoice detail
**Status: FOUND**

### State: Payment success
**Status: MISSING** — No success state shown after payment recorded. The form closes and invoice reloads, but no distinct success state/message is displayed. Not a blocker but spec calls it out.

### State: Void confirm dialog
**Status: MISSING**

- **BLOCKER** — `handleVoid()` calls the API directly with no confirmation dialog. MODULE_SPEC WF-041 step 2: "Confirmation dialog (destructive action): requires reason text." Neither the dialog nor the reason field exist in the frontend.

---

## Section 9: Test Coverage (MODULE_SPEC §12)

### Unit: BR-009 guard
**Status: FOUND** — `dental-billing.test.ts:321`, `billing-gate-http.test.ts`

### Unit: BR-011 void guard
**Status: FOUND** — `dental-billing.test.ts:590`, `ac-billing.test.ts:333`

### Unit: BR-012 state machine
**Status: FOUND** — `invoice.fsm.property.test.ts`, `payment-plan.fsm.property.test.ts`

### Unit: BR-010 tax stub
**Status: MISSING** — No test verifying that `taxCents === 0` in all invoice responses. The AC-BIL-004 test does not exist.

### Integration: treatment performed → invoice creation → payment recording → paid state
**Status: FOUND** — `ac-billing.test.ts:220-247` covers full payment path.

---

## Blocker Findings Summary

| ID | Location | Description |
|----|----------|-------------|
| F-01 | `createDentalInvoice.ts:44` | BR-009 error uses 400 not 422, no `NO_BILLABLE_TREATMENTS` code |
| F-02 | `createDentalInvoice.ts:62-64` | BR-010 violated: `taxCents` computed from client-supplied `taxRate`, can be non-zero |
| F-03 | `issueDentalInvoice.ts:28` | `staff_full` excluded from issue-invoice role gate (spec allows it) |
| F-04 | `issueDentalInvoice.ts` (test wiring) | Issue endpoint is POST not PATCH per API_CONTRACTS |
| F-05 | `voidDentalInvoice.ts` | Missing `reason` body field — spec requires min:5 reason text, never read/validated |
| F-06 | `voidDentalInvoice.ts:44` | BR-011 returns 422 not 409 |
| F-07 | `voidDentalInvoice.ts:38-40` | Comment explicitly allows voiding `paid` invoices; spec FSM prohibits this |
| F-08 | `invoice-detail.tsx:212-228` | Void action has no confirmation dialog and sends no reason — spec requires both |
| F-09 | No file | AC-BIL-005 / BR-013: no `markUncollectible` endpoint (returns 404 not 501) |
| F-10 | No file | `GET /dental/patients/:id/statement` endpoint missing entirely |

---

## Warning Findings Summary

| ID | Location | Description |
|----|----------|-------------|
| W-01 | `listDentalInvoices.ts:65-76` | N+1 queries per invoice row (patient + visit per row); pagination post-query |
| W-02 | `listDentalInvoices.ts:30-31` | `branch_id` optional in impl, required in API_CONTRACTS |
| W-03 | `listDentalInvoices.ts` | `date_from`/`date_to` filter params declared in contract, not implemented |
| W-04 | `recordDentalPayment.ts:32` | `dentist_associate` allowed to record payment; spec restricts to `staff_full + dentist_owner` |
| W-05 | `createDentalPaymentPlan.ts:30` | `dentist_associate` allowed to create payment plans; spec restricts to `staff_full + dentist_owner` |
| W-06 | `dental-payment.schema.ts:15-17` | Payment method enum missing `transfer`, `health_fund`, `plan` values from API_CONTRACTS |
| W-07 | `dental-payment.schema.ts:26` | `receipt_number NOT NULL` but API_CONTRACTS marks `reference` as optional/nullable |
| W-08 | `dental-payment-plan.schema.ts:14-16` | Frequency `biweekly` vs API_CONTRACTS `fortnightly` — string value mismatch |
| W-09 | `getDentalInvoice.ts:51-54` | Line item field renamed to `priceCents`; contract specifies `line_total_cents` |
| W-10 | Multiple handlers | No `{ data: ... }` response envelope; API_CONTRACTS requires `{ data: Invoice }` |
| W-11 | `recordDentalPayment.ts:49` | Error code `OVERPAYMENT` vs contract's `PAYMENT_EXCEEDS_BALANCE` |
| W-12 | `issueDentalInvoice.ts:32` | Error code `INVALID_STATUS` vs contract's `INVALID_STATUS_TRANSITION` |
| W-13 | `billing-list.tsx:114` | `draft` status missing from filter tabs |
| W-14 | `invoice-detail.tsx:248` | `recordedByMemberId` hardcoded to empty string |
| W-15 | `invoice-detail.tsx` | No payment success state shown after recording |
| W-16 | No file | Domain events DE-007, DE-008, DE-009, DE-005 not implemented anywhere |
| W-17 | `payment-plan-view.tsx:92-98` | `formatPlanStatus` uses camelCase keys (`onTrack`) but DB/API values are snake_case (`on_track`) — status labels will always be blank/fallthrough |

---

_oli-enforce-file v1.1 | dental-billing | 2026-05-27_
