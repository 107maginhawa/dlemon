<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-24 -->
<!-- skill: oli-api-contracts --all -->
<!-- based-on: MODULE_SPEC dental-billing, API_CONVENTIONS.md, ERROR_TAXONOMY.md, DOMAIN_MODEL SM-INVOICE -->

# API Contracts — dental-billing

> All responses wrap in `{ data, meta }`.
> Invoice FSM: `draft` → `issued` → `partial` → `paid` | `overdue` | `voided`
> <!-- V-BIL-015: FSM uses `issued` (matches MODULE_SPEC §8 and the DentalInvoiceStatus enum / code). The legacy `sent` term has been retired. -->
> <!-- V-BIL-015: payment_method enum is `cash`, `card`, `bank_transfer` (matches PaymentMethod enum / dental_payment_method DB type). -->
> <!-- V-BIL-008: issue is `PATCH /dental/invoices/:id/issue` (state transition). -->
> <!-- V-BIL-009: payment `reference` (receipt number) is OPTIONAL; server generates one when omitted. Optional `payment_date` supported. -->
> <!-- V-BIL-005/004: payment on paid/voided invoice → 422 INVOICE_IMMUTABLE; overpayment → 422 PAYMENT_EXCEEDS_BALANCE. -->
> <!-- V-BIL-001/002/010: discount rate bounded 0–100; installment count bounded 2–24; payment amount_cents min 1. -->
> <!-- V-BIL-012: invoice responses expose `outstanding_cents` (alias of internal balanceCents). -->
> <!-- V-BIL-003: create-invoice / create-plan / issue restricted to dentist_owner + dentist_associate (own patients); staff_full NOT permitted (record-payment is). -->
> <!-- V-BIL-006: POST /dental/invoices/:id/uncollectible → owner-only write-off; outstanding (issued/partial/overdue) → uncollectible, else 422 INVALID_STATUS_TRANSITION (BR-013 implemented). -->
> <!-- V-BIL-011: DE-008 InvoicePaid fires only on transition to fully `paid`; per ADR-006 it is an audit-log marker, not a bus event. -->
> <!-- V-BIL-007: signed-consent-before-invoice gate is BR-014 (was mislabeled BR-011). -->

> Key rules: BR-009 (billable treatments required), BR-011 (void conditions), BR-012 (payment <= balance).

---

## Endpoints

### POST /api/v1/dental/invoices

Create invoice from visit's performed treatments.

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Rate limit:** Default

**Request body:**

| Field | Type | Nullable | Required | Format | Constraints | Example |
|-------|------|----------|----------|--------|-------------|---------|
| `branch_id` | string | NO | YES | uuid | — | `"01JX..."` |
| `visit_id` | string | NO | YES | uuid | — | `"01JX..."` |
| `patient_id` | string | NO | YES | uuid | — | `"01JX..."` |
| `due_date` | string | YES | NO | date (YYYY-MM-DD) | future date | `"2026-07-01"` |
| `notes` | string | YES | NO | — | max:500 | `"Health fund claim pending"` |

**Response 201:** `{ data: Invoice }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `branch_id` | string (uuid) | NO | |
| `visit_id` | string (uuid) | NO | |
| `patient_id` | string (uuid) | NO | |
| `status` | string | NO | `draft` |
| `line_items` | InvoiceLineItem[] | NO | |
| `subtotal_cents` | integer | NO | |
| `tax_cents` | integer | NO | |
| `total_cents` | integer | NO | |
| `paid_cents` | integer | NO | `0` initially |
| `outstanding_cents` | integer | NO | |
| `due_date` | string (date) | YES | |
| `created_at` | string (date-time) | NO | |

**InvoiceLineItem fields:**

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `treatment_id` | string (uuid) | NO | |
| `cdt_code` | string | NO | |
| `description` | string | NO | |
| `quantity` | integer | NO | |
| `unit_price_cents` | integer | NO | |
| `line_total_cents` | integer | NO | |

**Errors:** `NO_BILLABLE_TREATMENTS(422)`, `NOT_FOUND(404)`, `VALIDATION_ERROR(400)`, `FORBIDDEN(403)`
**Events emitted:** DE-007 InvoiceCreated

---

### GET /api/v1/dental/invoices

List invoices for branch.

**Auth:** `staff_full`, `dentist_owner`
**Query params:**

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `branch_id` | uuid | YES | Branch scope |
| `patient_id` | uuid | NO | Filter by patient |
| `status` | string | NO | `draft`, `issued`, `partial`, `paid`, `overdue`, `voided` |
| `date_from` | date | NO | Invoice created date |
| `date_to` | date | NO | |
| `page` | integer | NO | Default: 1 |
| `per_page` | integer | NO | Default: 20, max: 100 |

**Response 200:** Standard paginated collection (Invoice summary objects)

**Sort:** `created_at DESC` (default)

---

### GET /api/v1/dental/invoices/:id

Get full invoice detail.

**Auth:** `staff_full`, `dentist_owner`
**Path params:** `id` (uuid)

**Response 200:** `{ data: Invoice }` (full object with line_items and payments)

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`

---

### PATCH /api/v1/dental/invoices/:id/issue

Issue (send) a draft invoice.

**Auth:** `staff_full`, `dentist_associate`, `dentist_owner`
**Path params:** `id` (uuid)

**Request body:** (empty `{}` accepted)

**Response 200:** `{ data: Invoice }` (status → `issued`)

**Errors:** `NOT_FOUND(404)`, `INVALID_STATUS_TRANSITION(422)`, `FORBIDDEN(403)`

---

### POST /api/v1/dental/invoices/:id/payments

Record a payment against invoice.

**Auth:** `staff_full`, `dentist_owner`
**Path params:** `id` (uuid)

**Request body:**

| Field | Type | Nullable | Required | Format | Constraints | Example |
|-------|------|----------|----------|--------|-------------|---------|
| `amount_cents` | integer | NO | YES | — | min:1, ≤ outstanding balance | `15000` |
| `payment_method` | string | NO | YES | — | enum: `cash`, `card`, `bank_transfer` | `"card"` |
| `payment_date` | string | NO | YES | date (YYYY-MM-DD) | — | `"2026-06-01"` |
| `reference` | string | YES | NO | — | max:100 | `"TXN-12345"` |
| `notes` | string | YES | NO | — | max:500 | |

**Response 201:** `{ data: Payment }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `invoice_id` | string (uuid) | NO | |
| `amount_cents` | integer | NO | |
| `payment_method` | string | NO | |
| `payment_date` | string (date) | NO | |
| `recorded_at` | string (date-time) | NO | |

**Errors:** `NOT_FOUND(404)`, `PAYMENT_EXCEEDS_BALANCE(422)`, `INVOICE_IMMUTABLE(422)`, `FORBIDDEN(403)`
**Events emitted:** DE-008 InvoicePaid (when invoice fully paid)

---

### POST /api/v1/dental/invoices/:id/void

Void an invoice.

**Auth:** `dentist_owner`
**Path params:** `id` (uuid)

**Request body:**

| Field | Type | Nullable | Required | Constraints | Example |
|-------|------|----------|----------|-------------|---------|
| `reason` | string | NO | YES | min:5, max:500 | `"Duplicate invoice"` |

**Response 200:** `{ data: { ok: true } }`

**Errors:** `NOT_FOUND(404)`, `ACTIVE_PAYMENT_PLAN(409)`, `ALREADY_VOIDED(422)`, `INVALID_STATUS_TRANSITION(422)`, `FORBIDDEN(403)`
**Events emitted:** DE-009 InvoiceVoided

---

### POST /api/v1/dental/invoices/:id/payment-plans

Create a payment plan for an invoice.

**Auth:** `staff_full`, `dentist_owner`
**Path params:** `id` (uuid)

**Request body:**

| Field | Type | Nullable | Required | Constraints | Example |
|-------|------|----------|----------|-------------|---------|
| `installment_count` | integer | NO | YES | min:2, max:24 | `6` |
| `frequency` | string | NO | YES | enum: `weekly`, `fortnightly`, `monthly` | `"monthly"` |
| `first_payment_date` | string | NO | YES | date, future | `"2026-07-01"` |
| `deposit_cents` | integer | YES | NO | min:0 | `5000` |

**Response 201:** `{ data: PaymentPlan }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `invoice_id` | string (uuid) | NO | |
| `status` | string | NO | `active` |
| `installment_count` | integer | NO | |
| `installment_amount_cents` | integer | NO | |
| `frequency` | string | NO | |
| `next_payment_date` | string (date) | NO | |

**Errors:** `NOT_FOUND(404)`, `INVOICE_IMMUTABLE(422)`, `FORBIDDEN(403)`
