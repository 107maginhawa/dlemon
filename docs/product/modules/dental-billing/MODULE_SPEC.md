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
| WF-052 [INFERRED] | Staff/Dentist | Issue invoice (draft→sent) | P0 |
| WF-015 | Staff Full | Create payment plan | P1 |
| WF-041 | dentist_owner | Void invoice (BR-011) | P1 |
| WF-042 | All dental | Fee schedule lookup | P1 |
| WF-053 [INFERRED] | System | Mark partial (payment plan) | P2 |
| WF-054 [INFERRED] | pg-boss | Mark overdue (cron) | P2 |

---

## 5. Business Rules

| Rule ID | Rule | Expected Behavior |
|---------|------|-------------------|
| BR-009 | Invoice requires ≥1 performed/verified treatment | 422 NO_BILLABLE_TREATMENTS |
| BR-010 | Tax = 0 (stub, ADR-008) | taxCents always 0 |
| BR-011 | Active payment plan blocks void | 409 ACTIVE_PAYMENT_PLAN |
| BR-012 | Invoice state machine (see §8) | 422 on invalid transition |
| BR-013 | markUncollectible not implemented | 501 NOT_IMPLEMENTED |

---

## 6. Permissions

| Action | Allowed | Notes |
|--------|---------|-------|
| Create invoice | dentist_owner, dentist_associate, staff_full | — |
| Record payment | staff_full, dentist_owner | — |
| Void invoice | dentist_owner | owner-only |
| Create payment plan | staff_full, dentist_owner | — |
| View invoices | all dental roles | — |

---

## 7. Data Requirements (key fields)
**`dental_invoice`:** id, patient_id, visit_id, branch_id, status (enum), total_cents, tax_cents(=0), due_date, voided_at, issued_at
**`dental_invoice_line_item`:** id, invoice_id, treatment_id, cdt_code, description, quantity, unit_price_cents
**`dental_payment`:** id, invoice_id, amount_cents, method (cash/card/bank_transfer), receipt_number, voided_at
**`dental_payment_plan`:** id, invoice_id, frequency, installment_count, status
**`dental_payment_plan_installment`:** id, plan_id, due_date, amount_cents, paid_amount_cents, status

---

## 7b. Aggregate Boundaries
Invoice owns LineItem, Payment, PaymentPlan, Installments. References Treatment by treatment_id (UUID — dental-visit owns Treatment).

---

## 8. State Transitions
See DOMAIN_MODEL.md §6 SM-INVOICE (source of truth).
```
draft → issued → paid / partial / overdue / void
partial → paid (plan complete)
issued → void (BR-011: no active plan, owner only)
```

---

## 9. UI/UX Requirements
**Invoice list:** filterable by status/date; outstanding invoices highlighted. **Invoice detail:** line items, payment history, payment plan installments. **Payment modal:** amount entry, method select, partial payment toggle. **States:** Loading, Empty, Invoice detail, Payment success, Void confirm dialog.

---

## 10. API Expectations
POST /dental/invoices (BR-009), GET /dental/invoices, GET /dental/invoices/:id, PATCH /dental/invoices/:id/issue, POST /dental/invoices/:id/payments (BR-012), POST /dental/invoices/:id/void (BR-011), POST /dental/invoices/:id/payment-plans, GET /dental/patients/:id/statement

---

## 10b. Domain Events
**Published:** DE-007 InvoiceCreated, DE-008 InvoicePaid, DE-009 InvoiceVoided
**Consumed:** DE-005 TreatmentPerformed (triggers eligible-for-invoice flag on visit)

---

## 11. Acceptance Criteria
**AC-BIL-001:** Create invoice with 0 performed treatments → 422 NO_BILLABLE_TREATMENTS.
**AC-BIL-002:** Void invoice with active payment plan → 409.
**AC-BIL-003:** Record partial payment → invoice transitions to partial + requires PaymentPlan.
**AC-BIL-004:** taxCents always 0 in all invoice responses (BR-010).
**AC-BIL-005:** markUncollectible → 501 (BR-013).

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
- markUncollectible: returns 501 — do not attempt to implement (BR-013 deferred)

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
| Mark uncollectible | 501 | NOT_IMPLEMENTED |

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
| dental_billing_uncollectible | false | Enable markUncollectible (BR-013) |

---

## 19. Vertical Slice Plan
BIL-S1: Create invoice (BR-009) | BIL-S2: Issue + pay (state machine) | BIL-S3: Payment plans | BIL-S4: Void (BR-011) | BIL-S5: Financial statement | BIL-S6: Overdue cron

---

## 20. AI Instructions
1. taxCents must always be 0 (BR-010) — do not compute tax.
2. markUncollectible must return 501 — do not implement (BR-013 deferred).
3. Void permission check: dentist_owner role required, assertBranchRole.
4. Invoice state machine in BR-012 is strict — throw 422 on any invalid transition.
5. Follow ARCHITECTURE.md, CONTRIBUTING.md, VERTICAL_TDD.md.
