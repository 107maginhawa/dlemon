# Data Table Contracts — dental-billing
<!-- oli: v3-dentalemon | dental-billing | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

**Invoice list columns:**
- `invoice_number` (sortable, sticky-left mobile)
- `patient_name` (link to patient)
- `issue_date` (sortable, default desc)
- `due_date`
- `total_amount` (sortable, right-aligned, monospace)
- `paid_amount` (right-aligned)
- `balance_due` (right-aligned, lemon highlight if > 0)
- `status` (InvoiceStatusBadge)

**Filters:** date range, status (tab), patient (multi-search), min/max total.
**Row highlight:** lemon `#FFE97D` at 12% opacity when `status ∈ {issued, overdue}` and `balance_due > 0`.
**Row actions:** View, Record Payment (if has balance), Void (owner only, if no payments).
**Pagination:** 50 per page, server-side.
**Empty states:** per-tab (see screens.md).

**Line items table columns:** treatment_code, description, tooth, surface, quantity, fee (editable in draft).

**Payment history columns:** payment_date, amount, method, reference_number, recorded_by.

**Installment schedule columns:** installment_number, due_date, amount, status (upcoming/paid/overdue).
