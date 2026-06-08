<!-- oli-version: 1.1 | generated: 2026-05-24 | skill: oli-module-specs --all -->

# Module Specification: dental-billing

---
Spec Version: 1.0 | Last Updated: 2026-05-24
---

## 1. Module Overview
**Purpose:** Invoice-based billing for dental services. Manages invoice lifecycle (draft→issued→paid/partial/overdue/voided), payment recording, payment plans (installments), and fee schedule lookup. Integrates with treatments as source of line items.

**Users:** staff_full (payment recording), dentist_owner (void, reports), dentist_associate (create invoice for own patients)

**Related:** dental-org (fee schedule), dental-visit (treatments → line items), dental-patient (financial statement), dental-audit (all billing events)

---

## 2. Domain Terms

| Term | Definition |
|------|-----------|
| Invoice | Financial record for services rendered; states: draft→issued→paid/partial/overdue/voided |
| Line Item | One CDT procedure charge on an invoice |
| Payment Plan | Installment agreement; presence blocks invoice voiding (BR-011) |
| Installment | Auto-generated payment row with due date and amount |
| Fee Schedule | Pre-configured CDT→price list per branch (owned by dental-org) |
| VAT/GST | Stubbed at 0% (BR-010, ADR-008) |

---

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| WF-013 | Dentist, Staff Full | Create invoice from visit | P0 |
| WF-014 | Staff Full | Record payment | P0 |
| WF-051 [INFERRED] | Staff Full, Dentist | View invoice | P0 |
| WF-052 [INFERRED] | Staff/Dentist | Issue invoice (draft→issued) | P0 |
| WF-015 | Staff Full | Create payment plan | P1 |
| WF-041 | dentist_owner | Void invoice (BR-011) | P1 |
| WF-042 | All dental | Fee schedule lookup | P1 |
| WF-053 [INFERRED] | System | Mark partial (payment plan) | P2 |
| WF-054 [INFERRED] | pg-boss | Mark overdue (cron) | P2 |

---

## 4. Workflow Details

### WF-013 — Create Invoice from Visit
1. Dentist or Staff Full opens completed visit → "Billing" tab → "Generate Invoice".
2. Server fetches all `performed` or `verified` treatments for the visit (BR-009: ≥1 required).
3. Line items pre-populated from fee schedule; dentist/staff may adjust unit price and quantity.
4. Invoice created in `draft` state. Actor reviews totals (subtotal, tax=0, total).
5. Click "Issue Invoice" → state transitions `draft → issued`. Patient notified via email (notifs module).

### WF-014 — Record Payment
1. Staff Full opens issued invoice → "Record Payment" action.
2. Payment dialog: amount, method (cash/card/bank/other), reference number (optional), date.
3. Payment recorded. If `amount_paid >= total_cents`: invoice → `paid`.
4. If partial (payment plan active): invoice → `partial`. Subsequent payments reduce balance.
5. Audit event: `billing.payment.recorded` with actor, amount, method.

### WF-015 — Create Payment Plan
1. Staff Full opens draft/issued invoice → "Add Payment Plan".
2. Dialog: installment count, frequency (weekly/monthly), start date.
3. Plan record created; installments calculated and displayed.
4. BR-011: while plan is active, invoice cannot be voided.
5. System (pg-boss cron) marks invoice `overdue` when past-due installment found (WF-054).

### WF-041 — Void Invoice
1. `dentist_owner` opens invoice in `draft` or `issued` state → "Void Invoice".
2. Confirmation dialog (destructive action): requires reason text.
3. BR-011 enforced: if active payment plan exists → 409 ACTIVE_PAYMENT_PLAN, void blocked.
4. On confirm: invoice → `voided`. All line items de-linked. Audit event emitted.
5. Voided invoices are read-only; balance resets to 0 in UI but record is preserved.

### WF-052 — Issue Invoice (Draft → Issued)
1. Triggered by "Issue Invoice" button (WF-013 step 5) or standalone from invoice detail.
2. Roles: `dentist_owner`, `dentist_associate` (own patients). staff_full NOT permitted (V-BIL-003).
3. Server validates BR-009 (billable treatments present) before transition.
4. Email sent to patient with invoice PDF link via `email` module.
5. Invoice becomes visible in patient billing history.

---

## 5. Business Rules

| Rule ID | Rule | Expected Behavior |
|---------|------|-------------------|
| BR-009 | Invoice requires ≥1 performed/verified treatment | 422 NO_BILLABLE_TREATMENTS |
| BR-010 | Tax = 0 (stub, ADR-008) | taxCents always 0 |
| BR-011 | Active payment plan blocks void | 409 ACTIVE_PAYMENT_PLAN |
| BR-012 | Invoice state machine (see §8) | 422 on invalid transition |
| BR-013 | markUncollectible: outstanding (issued/partial/overdue) → uncollectible; reject otherwise | 422 on invalid transition |
| BR-014 | Signed consent form required before invoicing (V-BIL-007 — previously mislabeled BR-011 in code) | 422 CONSENT_REQUIRED |
| BR-015 | Discount rate must be 0–100; installment count 2–24; payment amount ≥ 1 cent (V-BIL-001/002/010) | 422 INVALID_DISCOUNT_RATE / INVALID_INSTALLMENT_COUNT / VALIDATION_ERROR |

---

## 6. Permissions

> V-BIL-003: this table is reconciled with `ROLE_PERMISSION_MATRIX.md` (authoritative). `staff_full` may **record payments only** — it may NOT create invoices, issue invoices, or create payment plans. dentist_associate is scoped to its own patients.

| Action | Allowed | Notes |
|--------|---------|-------|
| Create invoice | dentist_owner, dentist_associate (own patients) | staff_full NOT permitted (V-BIL-003) |
| Issue invoice | dentist_owner, dentist_associate (own patients) | staff_full NOT permitted (V-BIL-003) |
| Record payment | dentist_owner, dentist_associate, staff_full | — |
| Void invoice | dentist_owner | owner-only |
| Create payment plan | dentist_owner, dentist_associate (own patients) | staff_full NOT permitted (V-BIL-003) |
| Mark uncollectible | dentist_owner | owner-only (BR-013 write-off) |
| View invoices | all dental roles | — |

---

## 7. Data Requirements (key fields)
**`dental_invoice`:** id, patient_id, visit_id, branch_id, status (enum), total_cents, tax_cents(=0), discount_cents, discount_reason, notes, due_date, voided_at, issued_at; **computed response fields:** subtotal_cents (sum of line items before discount), paid_cents (sum of recorded payments), outstanding_cents (total_cents − paid_cents)
**`dental_invoice_line_item`:** id, invoice_id, treatment_id, cdt_code, description, quantity, unit_price_cents
**`dental_payment`:** id, invoice_id, amount_cents, method (cash/card/bank_transfer), receipt_number, voided_at
**`dental_payment_plan`:** id, invoice_id, frequency, installment_count, status
**`dental_payment_plan_installment`:** id, plan_id, due_date, amount_cents, paid_amount_cents, status

---

## 7b. Aggregate Boundaries
Invoice owns LineItem, Payment, PaymentPlan, Installments. References Treatment by treatment_id (UUID — dental-visit owns Treatment).

---

## 8. State Transitions
See DOMAIN_MODEL.md §6 SM-INVOICE (source of truth). Terminal state value is `voided` (the `DentalInvoiceStatus` enum); the legacy `sent` term was retired in favor of `issued` (V-BIL-015).
```
draft → issued → paid / partial / overdue / voided
partial → paid (plan complete)
issued → voided (BR-011: no active plan, owner only)
issued / partial / overdue → uncollectible (BR-013 write-off, owner-only, terminal)
```
> Payments are valid only on `issued`/`partial`/`overdue`. A payment on `draft` → 422 INVALID_STATUS_TRANSITION; on `paid`/`voided` → 422 INVOICE_IMMUTABLE.
> **Deferred/Future:** A "Reopen" action (unvoiding an invoice) appears in screens.md but is **not implemented** in the current state machine. Voided invoices are terminal. Reopen is deferred to a future wave.

---

## 9. UI/UX Requirements
**Invoice list:** filterable by status/date; outstanding invoices highlighted. **Invoice detail:** line items, payment history, payment plan installments. **Payment modal:** amount entry, method select, partial payment toggle. **States:** Loading, Empty, Invoice detail, Payment success, Void confirm dialog.

---

## 10. API Expectations

> Canonical routes (per dental-billing.tsp / generated routes — all under the `/dental/billing` prefix). Reconciled 2026-06-08: prior list cited `/payment-plans` and a non-existent `GET /dental/patients/:id/statement`.

**Invoice lifecycle:** `POST /dental/billing/invoices` (BR-009/BR-014), `GET /dental/billing/invoices` (branchId required → 400 otherwise, EM-BIL-001), `GET /dental/billing/invoices/:invoiceId`, `PATCH /dental/billing/invoices/:invoiceId/issue`, `POST /dental/billing/invoices/:invoiceId/void` (BR-011), `POST /dental/billing/invoices/:invoiceId/uncollectible` (BR-013, owner-only).
**Payments:** `POST /dental/billing/invoices/:invoiceId/payments` (BR-012), `GET …/payments`, `POST …/payments/:paymentId/void`, `GET …/payments/:paymentId/receipt`.
**Discount / plan:** `POST /dental/billing/invoices/:invoiceId/discount` (BR-015), `POST /dental/billing/invoices/:invoiceId/plan`, `GET …/plan`.
**Reports (branchId OPTIONAL — scoped to caller's branches when omitted, EM-BIL-002):** `GET /dental/billing/patients/:patientId/balance`, `GET /dental/billing/collections/summary`, `GET /dental/billing/collections/aging`, `POST /dental/billing/statements/batch`.
**Revenue cycle (HMO claims):** `POST /dental/billing/claims`, `GET /dental/billing/claims` (worklist), `GET /dental/billing/claims/aging`, `GET /dental/billing/claims/:claimId`, `PATCH …/status`, `POST …/lines`, `PATCH …/lines/:lineId`, `POST …/remittance`, `POST /dental/billing/estimate`.

---

## 10b. Domain Events
**Published:** DE-007 InvoiceCreated, DE-008 InvoicePaid, DE-009 InvoiceVoided
**Consumed:** DE-005 TreatmentPerformed (triggers eligible-for-invoice flag on visit)

Per ADR-006 (domain-events-descope), domain events here are audit-log-only semantic markers — there is NO event bus. Producers satisfy them by writing the corresponding dental_audit_log row synchronously via logAuditEvent(); reactive consumers (e.g. notifs) are deferred to a future phase. No publisher/emit scaffolding is required.

> V-BIL-011: DE-008 InvoicePaid fires **only** on the transition to fully `paid` (not on partial payments), realized as a synchronous `invoice.paid` audit-log row in `recordDentalPayment`.

---

## 11. Acceptance Criteria
**AC-BIL-001:** Create invoice with 0 performed treatments → 422 NO_BILLABLE_TREATMENTS.
**AC-BIL-002:** Void invoice with active payment plan → 409.
**AC-BIL-003:** Record partial payment → invoice transitions to partial + requires PaymentPlan.
**AC-BIL-004:** taxCents always 0 in all invoice responses (BR-010).
**AC-BIL-005:** markUncollectible → outstanding invoice (issued/partial/overdue) transitions to `uncollectible`; draft/paid/voided rejected with 422 (BR-013).

---

## 12. Test Expectations
Unit: BR-009 guard, BR-011 void guard, BR-012 state machine, BR-010 tax stub.
Integration: treatment performed → invoice creation → payment recording → paid state.

---

## 13. Edge Cases
- Void after payment (allowed per SM — admin correction for erroneous invoices, owner only)
- Payment plan with 0 installments → 422
- Invoice for visit with no dentist assigned [VERIFY]
- Overdue cron fires on already-paid invoice → idempotent (no-op)
- markUncollectible: owner-only write-off. An outstanding invoice (issued/partial/overdue) transitions to the terminal `uncollectible` state; draft/paid/voided (and a repeat write-off) are rejected with 422. (BR-013 implemented 2026-06-04; the `uncollectible` value is live in the invoice status enum.)

---

## 14. Dependencies
**Internal:** dental-org (fee schedule), dental-visit (treatments), dental-patient (patient link, statement), dental-audit
**External:** pg-boss (overdue cron job)

---

## 15. Error Handling

| Scenario | HTTP | Code |
|----------|------|------|
| No billable treatments | 422 | NO_BILLABLE_TREATMENTS |
| Active payment plan blocks void | 409 | ACTIVE_PAYMENT_PLAN |
| Invalid status transition | 422 | INVALID_STATUS_TRANSITION |
| Void already-voided | 422 | ALREADY_VOIDED |
| Payment on paid/voided invoice | 422 | INVOICE_IMMUTABLE (V-BIL-005) |
| Payment exceeds remaining balance | 422 | PAYMENT_EXCEEDS_BALANCE (V-BIL-004) |
| Signed consent missing before invoicing | 422 | CONSENT_REQUIRED (BR-014, V-BIL-007) |
| Discount rate outside 0–100 | 422 | INVALID_DISCOUNT_RATE (V-BIL-001) |
| Installment count outside 2–24 | 422 | INVALID_INSTALLMENT_COUNT (V-BIL-002) |
| Mark uncollectible (non-outstanding invoice) | 422 | INVALID_STATUS_TRANSITION |

---

## 16. Performance Expectations
Invoice list < 2s (1000 invoices/branch). Payment recording < 1s. Volume: ~20 invoices/day/branch.

---

## 17. Observability Hooks
dental-billing.invoice-created (INFO), dental-billing.payment-recorded (INFO), dental-billing.invoice-voided (INFO), dental-billing.overdue-cron (INFO). No patient PII in log fields.

---

## 18. Feature Flags
| Flag | Default | Description |
|------|---------|-------------|
| dental_billing_tax_enabled | false | Phase 2 tax calculation (ADR-008) |
| dental_billing_uncollectible | true | markUncollectible (BR-013) — lifted 2026-06-04; flag is documentation-only (no runtime gate), write-off is always available |

---

## 19. Vertical Slice Plan
BIL-S1: Create invoice (BR-009) | BIL-S2: Issue + pay (state machine) | BIL-S3: Payment plans | BIL-S4: Void (BR-011) | BIL-S5: Financial statement | BIL-S6: Overdue cron

---

## 20. AI Instructions
1. taxCents must always be 0 (BR-010) — do not compute tax.
2. markUncollectible: owner-only; only an outstanding (issued/partial/overdue) invoice may be written off to `uncollectible` (BR-013); reject others with 422.
3. Void permission check: dentist_owner role required, assertBranchRole.
4. Invoice state machine in BR-012 is strict — throw 422 on any invalid transition.
5. Follow ARCHITECTURE.md, CONTRIBUTING.md, VERTICAL_TDD.md.
