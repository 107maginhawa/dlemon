# Form Contracts — dental-billing
<!-- oli: v3-dentalemon | dental-billing | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

**Create Invoice:**
- `patient_id` (required, uuid)
- `treatment_ids` (required, array, min 1, must all be status=performed and uninvoiced — BR-009)
- `line_item_fee_overrides` (optional, map<treatment_id, number ≥ 0>)
- `discount_type` ('percent' | 'fixed', optional)
- `discount_value` (≥ 0; if percent then 0–100; if fixed then ≤ subtotal)
- `notes` (optional, max 1000 chars)
- `save_as_draft` (boolean; if false, status=issued immediately)

**Issue Draft Invoice:**
- `invoice_id` (required, uuid)
- Server requires `status = draft` and ≥1 line item.

**Record Payment:**
- `invoice_id` (required, uuid)
- `amount` (required, > 0, ≤ balance_due — BR-012 hard-block)
- `method` (required, enum: cash | credit_card | debit_card | bank_transfer | insurance | check)
- `payment_date` (required, ISO date, ≤ today)
- `reference_number` (optional, max 50 chars)
- `notes` (optional, max 200 chars)

**Create Payment Plan:**
- `invoice_id` (required, uuid)
- `installment_count` (required, integer 2–24)
- `frequency` (required, enum: weekly | biweekly | monthly)
- `start_date` (required, ISO date, ≥ today)

**Void Invoice:**
- `invoice_id` (required, uuid)
- `reason` (required, min 10 chars, max 500)
- Server-validated: invoice must have zero payments (BR-011). Owner role required.

**Patient Statement (filter):**
- `patient_id` (required, uuid)
- `start_date`, `end_date` (required, ISO dates, end ≥ start)
- `include_running_balance` (boolean, default false)
