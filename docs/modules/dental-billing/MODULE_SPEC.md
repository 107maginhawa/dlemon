# Dental Billing Module Specification

**Module:** `dental-billing`
**Version:** 1.0
**Status:** Implemented

## Overview

The dental-billing module manages the full financial lifecycle of a dental visit: from invoice creation (from performed treatments), through payment collection (cash/card/bank), to payment plans for installment arrangements. It provides collections analytics and per-patient balance views for front-of-house operations.

All monetary values are stored as integers in cents (e.g., `50000` = ₱500.00). Tax is always zero in Phase 1 (BR-010 stub). The `uncollectible` status from the base billing module is explicitly excluded — dental invoice status is a closed enum (BR-013).

## Schema

### Tables

| Table | Purpose |
|-------|---------|
| `dental_invoice` | Invoice container: patient, visit, branch, line items totals, lifecycle status |
| `dental_invoice_line_item` | Individual billed treatment lines: CDT code, description, price, quantity |
| `dental_payment` | Individual payment records: cash/card/bank, soft-void pattern |
| `dental_payment_plan` | Installment plan linked to an invoice: frequency, count, status |
| `dental_payment_plan_installment` | Auto-generated installment rows: due date, amount, paid amount, status |

### `dental_invoice`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid | NOT NULL | PK (from `baseEntityFields`) |
| `visit_id` | uuid | nullable | FK → `dental_visit.id`; optional (walk-in invoices) |
| `patient_id` | uuid | NOT NULL | FK → `patient.id` |
| `branch_id` | uuid | NOT NULL | FK → `dental_branch.id` |
| `dentist_member_id` | uuid | NOT NULL | FK → `dental_membership.id` (billing dentist) |
| `invoice_number` | text | NOT NULL | Unique, auto-generated |
| `status` | enum | NOT NULL | default `draft`. Closed enum — see Status enum below |
| `subtotal_cents` | integer | NOT NULL | Sum of line items before discount |
| `discount_cents` | integer | NOT NULL | default 0. Set by `applyDentalDiscount` |
| `tax_cents` | integer | NOT NULL | Always 0 — BR-010 stub |
| `tax_rate` | numeric(5,4) | NOT NULL | Always 0.0000 — BR-010 stub |
| `total_cents` | integer | NOT NULL | `subtotal_cents - discount_cents + tax_cents` |
| `paid_cents` | integer | NOT NULL | default 0. Increases with each non-voided payment |
| `balance_cents` | integer | NOT NULL | `total_cents - paid_cents` |
| `due_date` | timestamptz | nullable | Set on issue |
| `issued_at` | timestamptz | nullable | Set on `issueDentalInvoice` |
| `paid_at` | timestamptz | nullable | Set when `status = paid` |
| `voided_at` | timestamptz | nullable | Set on `voidDentalInvoice` |
| `created_at` | timestamptz | NOT NULL | from `baseEntityFields` |
| `updated_at` | timestamptz | NOT NULL | from `baseEntityFields` |

**Indexes:** `invoice_number` (unique), `patient_id`, `branch_id`, `status`

### `dental_invoice_line_item`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid | NOT NULL | PK |
| `invoice_id` | uuid | NOT NULL | FK → `dental_invoice.id` ON DELETE CASCADE |
| `treatment_id` | uuid | nullable | FK → `dental_treatment.id`; null for manual lines |
| `cdt_code` | text | nullable | e.g., `D0120` |
| `description` | text | NOT NULL | Display name for the line |
| `tooth_number` | integer | nullable | FDI/Universal tooth number |
| `unit_price_cents` | integer | NOT NULL | Per-unit price |
| `quantity` | integer | NOT NULL | default 1 |
| `amount_cents` | integer | NOT NULL | `unit_price_cents * quantity` |
| `is_done` | boolean | NOT NULL | default false; true when treatment status `performed/verified` |

**Indexes:** `invoice_id`

### `dental_payment`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid | NOT NULL | PK |
| `invoice_id` | uuid | NOT NULL | FK → `dental_invoice.id` |
| `patient_id` | uuid | NOT NULL | FK → `patient.id` |
| `branch_id` | uuid | NOT NULL | FK → `dental_branch.id` |
| `amount_cents` | integer | NOT NULL | Payment amount |
| `method` | enum | NOT NULL | `cash \| card \| bank_transfer` |
| `receipt_number` | text | NOT NULL | Unique per branch; used for idempotency |
| `recorded_by_member_id` | uuid | NOT NULL | FK → `dental_membership.id` |
| `notes` | text | nullable | Staff notes |
| `is_void` | boolean | NOT NULL | default false; soft-delete flag |
| `voided_at` | timestamptz | nullable | Set on `voidDentalPayment` |
| `void_reason` | text | nullable | Required when voiding |
| `voided_by_member_id` | uuid | nullable | FK → `dental_membership.id` |

**Indexes:** `invoice_id`, `patient_id`, `receipt_number` (unique)

### `dental_payment_plan`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid | NOT NULL | PK |
| `invoice_id` | uuid | NOT NULL | FK → `dental_invoice.id`; one plan per invoice max |
| `patient_id` | uuid | NOT NULL | FK → `patient.id` |
| `total_cents` | integer | NOT NULL | `invoice.balance_cents` at plan creation time |
| `number_of_installments` | integer | NOT NULL | 2–24 (validated in handler) |
| `frequency` | enum | NOT NULL | `weekly \| biweekly \| monthly` |
| `start_date` | timestamptz | NOT NULL | First installment due date |
| `amount_per_installment_cents` | integer | NOT NULL | `Math.floor(total / count)` |
| `status` | enum | NOT NULL | default `on_track`. `on_track \| behind \| completed \| defaulted` |

**Indexes:** `invoice_id`, `patient_id`

### `dental_payment_plan_installment`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid | NOT NULL | PK |
| `plan_id` | uuid | NOT NULL | FK → `dental_payment_plan.id` ON DELETE CASCADE |
| `installment_number` | integer | NOT NULL | 1-based sequence |
| `due_date` | timestamptz | NOT NULL | Computed from `start_date + (n-1) * frequency` |
| `amount_cents` | integer | NOT NULL | Per-installment amount |
| `paid_cents` | integer | NOT NULL | default 0; updated by `recordDentalPayment` |
| `status` | enum | NOT NULL | `pending \| paid \| overdue \| waived` |
| `payment_id` | uuid | nullable | FK → `dental_payment.id`; set when installment paid |

### Status Enums

**Invoice status:** `draft | issued | partial | paid | overdue | voided`

**Plan status:** `on_track | behind | completed | defaulted`

**Installment status:** `pending | paid | overdue | waived`

**Payment method:** `cash | card | bank_transfer`

**Plan frequency:** `weekly | biweekly | monthly`

---

## State Machine

### SM-01: Invoice Lifecycle

```
                    ┌─────────────────────────────────────┐
                    │                                     │
     createInvoice  │        issueDentalInvoice           │
  ┌──────────────►  draft  ──────────────────────►  issued │
  │                 │                                  │   │
  │                 │ voidDentalInvoice (owner only)   │   │
  │                 └──────────────┐                   │   │
  │                                ▼                   │   │
  │                             voided ◄───────────────┘   │
  │                                 ▲     (any status)     │
  │                                 │                      │
  │                             recordPayment (full)       │
  │                                 │                      │
  │                            ┌────┴─────┐                │
  │                            │          │                │
  │                   partial ◄┘    paid  │                │
  │               (payment plan         │                │
  │                required)     recordPayment (full)    │
  │                    │                  │                │
  │                    └──────► paid ◄────┘                │
  │                                                        │
  │            overdue (cron: due_date elapsed)           │
  │             ▲ from issued or partial                  │
  └─────────────────────────────────────────────────────┘
```

**Key transitions:**

| From | To | Trigger | Rule |
|------|----|---------|------|
| `draft` | `issued` | `issueDentalInvoice` | BR-009 (must have ≥1 line item) |
| `draft` / `issued` / `partial` / `paid` / `overdue` | `voided` | `voidDentalInvoice` | BR-011 (blocks if active plan), owner-only |
| `issued` | `partial` | `recordDentalPayment` (partial) | BR-012 |
| `issued` / `partial` | `paid` | `recordDentalPayment` (full balance) | BR-012 |
| `issued` / `partial` | `overdue` | cron / background job (due_date elapsed) | BR-012 |

> **Note:** Voiding a paid invoice is permitted — allows admin correction for duplicate or erroneous invoices. BR-011 is the only guard.

### SM-02: Payment Plan Lifecycle

`on_track` → `behind` | `completed` | `defaulted`

Plan status is updated by the cron/background job as installments come due. Completing all installments → `completed`. Missed installments → `behind` → `defaulted` after threshold.

---

## Business Rules

### BR-009: Invoice requires at least one line item

**Rule:** An invoice must contain at least one treatment line item. Attempting to create an invoice for a visit with zero `performed` or `verified` treatments is rejected.

**HTTP:** `422` with error code `NO_BILLABLE_TREATMENTS`

**Implementation:** `createDentalInvoice.ts` — fetches treatments via `TreatmentRepository.findByVisit()`, filters to `status IN ('performed', 'verified')`, and throws `BusinessLogicError` if `billable.length === 0`.

---

### BR-010: Tax is always zero (stub)

**Rule:** `tax_cents` is always 0. `tax_rate` is always `0.0000`. Fee schedule prices are pre-tax inclusive. Tax calculation is deferred to Phase 2.

**HTTP:** N/A — enforced at schema default, not a runtime rejection.

**Implementation:** `dental_invoice.tax_cents` and `tax_rate` default to 0 in schema. `createDentalInvoice.ts` never writes a non-zero tax value. Confirmed by test: `business-rules.test.ts` asserts `taxCents === 0`.

**Known gap:** Phase 2 will introduce configurable tax rates per branch/jurisdiction. Schema columns exist to receive them without migration.

---

### BR-011: Active payment plan blocks invoice void

**Rule:** An invoice with an active payment plan (`status IN ('on_track', 'behind')`) cannot be voided. Staff must cancel or complete the payment plan first.

**HTTP:** `400` with error code `ACTIVE_PAYMENT_PLAN`

**Implementation:** `voidDentalInvoice.ts` — after role check, calls `DentalPaymentPlanRepository.findByInvoice(invoiceId)` and throws `BusinessLogicError('ACTIVE_PAYMENT_PLAN')` if a plan exists with status `on_track` or `behind`.

---

### BR-012: Invoice lifecycle — partial requires a payment plan

**Rule:** The `partial` status indicates a payment has been recorded but the full balance is not yet settled. A `partial` invoice must have an associated payment plan record.

**Lifecycle:** `draft → issued → paid | partial | overdue | voided`

- `partial` status requires a `dental_payment_plan` record to exist for the invoice.
- Full payment transitions the invoice to `paid`.
- Overpayment is rejected (`400 OVERPAYMENT`).
- Duplicate `receipt_number` returns `200` with the existing payment (idempotency).
- Recording payment on a voided invoice returns `422 VOIDED_INVOICE`.

**Implementation:** `recordDentalPayment.ts` — after recording the payment, compares `paid_cents` to `total_cents`. If equal: sets status `paid`. If less: sets status `partial`. `createDentalPaymentPlan.ts` is the entry point for creating the linked plan.

---

### BR-013: DEFERRED — `uncollectible` status is not supported

**Rule:** Dental invoices do NOT support an `uncollectible` status. The base billing module's `markInvoiceUncollectible` operation does not apply to `dental_invoice`.

**Invoice status enum is closed:** `draft | issued | partial | paid | overdue | voided`

**Rationale:** Dental practices in target market (PH) use write-offs via manual void + adjustment notes. Formal uncollectible accounting treatment is deferred to Phase 3 (collections module). Any attempt to add `uncollectible` requires a schema migration and new handler — it is not a status transition from the current enum.

---

## Permission Matrix

| Operation | dentist_owner | dentist_associate | Other branch members |
|-----------|:---:|:---:|:---:|
| `createDentalInvoice` | Yes | Yes | No (403) |
| `getDentalInvoice` | Yes | Yes | Yes |
| `listDentalInvoices` | Yes | Yes | Yes |
| `issueDentalInvoice` | Yes | Yes | No (403) |
| `voidDentalInvoice` | **Yes (owner only)** | No (403) | No (403) |
| `applyDentalDiscount` | Yes | Yes | No (403) |
| `recordDentalPayment` | Yes | Yes | No (403) |
| `listDentalPayments` | Yes | Yes | Yes |
| `getDentalPaymentReceipt` | Yes | Yes | Yes |
| `voidDentalPayment` | Yes | Yes | No (403) |
| `createDentalPaymentPlan` | Yes | Yes | No (403) |
| `getDentalPaymentPlan` | Yes | Yes | Yes |
| `getPatientBalance` | Yes | Yes | Yes |
| `getCollectionsSummary` | Yes | Yes | Yes |

**Why void is owner-only:** Voiding is a destructive financial write that affects auditable records and can reverse collected revenue. Restricted to `dentist_owner` to prevent accidental or unauthorized financial corrections.

**Implementation:** `voidDentalInvoice.ts` calls `assertBranchRole(db, userId, branchId, ['dentist_owner'])`. All other write operations call `assertBranchRole(db, userId, branchId, ['dentist_owner', 'dentist_associate'])`. Read operations use `assertBranchAccess` (any branch member).

---

## API Endpoints

| Method | Path | Handler | Notes / BRs |
|--------|------|---------|-------------|
| `POST` | `/dental/billing/invoices` | `createDentalInvoice` | BR-009 |
| `GET` | `/dental/billing/invoices` | `listDentalInvoices` | Query: `patientId?`, `branchId?`, `status?` |
| `GET` | `/dental/billing/invoices/:invoiceId` | `getDentalInvoice` | |
| `POST` | `/dental/billing/invoices/:invoiceId/issue` | `issueDentalInvoice` | BR-009, INVALID_STATUS guard |
| `POST` | `/dental/billing/invoices/:invoiceId/void` | `voidDentalInvoice` | BR-011, owner-only |
| `POST` | `/dental/billing/invoices/:invoiceId/discount` | `applyDentalDiscount` | Body: `{ percentageRate, reason }` |
| `POST` | `/dental/billing/invoices/:invoiceId/payments` | `recordDentalPayment` | Body: `{ amountCents, method, receiptNumber, recordedByMemberId, notes? }` |
| `GET` | `/dental/billing/invoices/:invoiceId/payments` | `listDentalPayments` | Non-void payments only |
| `GET` | `/dental/billing/invoices/:invoiceId/payments/:paymentId/receipt` | `getDentalPaymentReceipt` | Returns receipt + invoice snapshot |
| `POST` | `/dental/billing/invoices/:invoiceId/payments/:paymentId/void` | `voidDentalPayment` | Body: `{ voidReason }` |
| `POST` | `/dental/billing/invoices/:invoiceId/plan` | `createDentalPaymentPlan` | Body: `{ patientId, numberOfInstallments, frequency, startDate }`; max 1 plan per invoice |
| `GET` | `/dental/billing/invoices/:invoiceId/plan` | `getDentalPaymentPlan` | Returns plan + installments |
| `GET` | `/dental/billing/patients/:patientId/balance` | `getPatientBalance` | Returns `totalBilledCents`, `totalPaidCents`, `outstandingBalanceCents`, `overdueAmountCents`, `overdueInvoiceCount`, `activePaymentPlanCount` |
| `GET` | `/dental/billing/collections/summary` | `getCollectionsSummary` | Query: `branchId?`, `period?` (`today\|month\|year\|custom`), `from?`, `to?`. Returns collected total, outstanding total, overdue count, breakdown by payment method |

---

## Error Codes Reference

| Code | HTTP | Trigger |
|------|------|---------|
| `NO_BILLABLE_TREATMENTS` | 422 | createDentalInvoice — no performed/verified treatments |
| `INVALID_STATUS` | 400 | issueDentalInvoice — invoice not in `draft` |
| `ALREADY_VOIDED` | 400 | voidDentalInvoice — already voided |
| `ACTIVE_PAYMENT_PLAN` | 400 | voidDentalInvoice — active plan exists (BR-011) |
| `ALREADY_PAID` | 422 | applyDentalDiscount / recordDentalPayment — invoice fully paid |
| `VOIDED_INVOICE` | 422 | recordDentalPayment / createDentalPaymentPlan — invoice is voided |
| `OVERPAYMENT` | 400 | recordDentalPayment — amount exceeds remaining balance |
| `NO_BALANCE` | 400 | createDentalPaymentPlan — balance_cents ≤ 0 |
| `PLAN_EXISTS` | 400 | createDentalPaymentPlan — invoice already has a plan |
| `PAYMENT_MISMATCH` | 400 | voidDentalPayment — paymentId does not belong to invoiceId |

---

## Known Gaps

| ID | Gap | Deferred To |
|----|-----|-------------|
| BR-010 | Tax calculation (configurable rate per branch/jurisdiction) | Phase 2 |
| BR-013 | `uncollectible` invoice status (write-off workflow) | Phase 3 (collections module) |
| — | Payment plan status auto-update (overdue detection, `behind`/`defaulted` transitions) | Phase 2 cron job |
| — | Installment-to-payment linkage (`payment_id` on installment row) populated by `recordDentalPayment` but cross-validation not yet enforced | Phase 2 |
| — | `voidDentalInvoice` and `voidDentalPayment` not covered by E2E tests | tracked in traceability matrix |

---

## TypeSpec Source

`specs/api/src/modules/dental-billing.tsp`

## Dependencies

- `dental_visit` / `dental_treatment` — line items sourced from performed/verified treatments
- `patient` — `patient_id` FK on invoice and payment
- `dental_branch` — `branch_id` FK; all endpoints assert branch membership
- `dental_membership` — `dentist_member_id` FK; role check via `assertBranchRole`
- `@/handlers/shared/assert-branch-access` — read-path branch isolation
- `@/handlers/shared/assert-branch-role` — write-path role gates
- `./utils/rounding` — `applyDiscountRate()` used by `applyDentalDiscount`

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-05-19 | 1.0 | Initial spec (BR-009–013, 5 tables, 14 endpoints, permission matrix, state machines) |
