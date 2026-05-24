# Screens — dental-billing
<!-- oli: v3-dentalemon | dental-billing | ui-prototype -->

Apple HIG + Lemon `#FFE97D` accent. SF Pro font. `#F2F2F7` grouped background, white card surfaces. 44px touch targets. Radix UI primitives from `apps/dentalemon/src/components/`.

Status color tokens:
- draft = `#8E8E93` (gray)
- issued = `#0A84FF` (system blue)
- paid = `#34C759` (system green)
- overdue = `#FF3B30` (system red)
- void = `#3A3A3C` (dark gray, strikethrough)

Outstanding balance highlight: lemon `#FFE97D` background at 12% opacity on table rows.

---

## Screen: Invoice List (`/billing/invoices`)
**Roles:** all roles (view); dentist_owner, dentist_associate, staff_full (create/manage)
**Layout:**
- Top bar: page title "Invoices", search input (by invoice # or patient name), date range filter, `+ New Invoice` primary CTA (lemon, top-right).
- Status tabs (Radix Tabs): `All`, `Draft`, `Issued`, `Paid`, `Overdue`, `Void`. Each tab shows count badge.
- InvoiceListTable: rows with status badge, outstanding rows row-highlighted lemon soft bg.
- Footer: pagination (50 per page), bulk-export CTA.

**Components:** InvoiceListTable, InvoiceStatusBadge, InvoiceStatusTabs
**States:**
- Loading: skeleton rows (8).
- Empty (per tab):
  - All: "No invoices yet." + `+ New Invoice` CTA.
  - Paid: "No paid invoices in this period."
  - Overdue: "No overdue invoices — great work!" with green check.
  - Void: "No voided invoices."
- Outstanding row highlight: applied to Issued + Overdue with balance_due > 0.
- Click row → navigate to Invoice Detail.

---

## Screen: Invoice Detail (`/billing/invoices/:id`)
**Roles:** all (view); dentist_owner, dentist_associate, staff_full (record payment, payment plan); dentist_owner only (void)
**Layout:**
- Header card: invoice number (large SF Pro Bold 28pt), patient name + DOB (link to patient), issue date, due date, InvoiceStatusBadge (large).
- Action bar (sticky, right): `Issue` (draft only), `Record Payment` (issued/overdue with balance), `Create Payment Plan` (issued/overdue), `Void` (owner only, no payments), `Print` / `Download PDF` icons.
- LineItemsTable: treatment code (FDI/ISO tooth), description, tooth/surface, quantity, fee (editable in draft).
- Adjustments section: discount (% or fixed), notes.
- InvoiceSummaryBar (sticky footer): subtotal, discount, total, paid, **Balance Due** (lemon highlight if > 0).
- PaymentHistoryList: chronological. Each entry: date, amount, method icon, reference, recorded-by.
- Payment Plan card (if active): installments table, paid/upcoming/overdue states.

**Components:** LineItemsTable, InvoiceStatusBadge, InvoiceSummaryBar, PaymentHistoryList, InstallmentScheduleTable
**States:**
- Draft: line items editable, no payment actions, `Issue Invoice` primary lemon CTA.
- Issued: read-only line items, payment actions active.
- Paid: green status, "Paid in full on {date}" banner, payment actions hidden, Void hidden (BR-011).
- Overdue: red status, days-overdue chip, payment actions active.
- Void: full card strikethrough, void reason banner, all actions disabled.
- Loading: skeleton header + table.

---

## Screen: Record Payment Dialog
**Roles:** dentist_owner, dentist_associate, staff_full
**Layout:** Radix Dialog, 500px wide.
- Header: "Record payment for Invoice #{number}"
- Balance due display (large lemon-tinted card): "$X.XX remaining".
- Amount input (currency formatted, large SF Pro 32pt, autofocus). `Pay in full` quick-link sets to balance.
- Method select (Radix Select): Cash, Credit Card, Debit Card, Bank Transfer, Insurance, Check.
- Date picker (default = today).
- Reference number input (optional, e.g., last 4 of card, check #).
- Partial payment toggle (auto-on if amount < balance; affects UI guidance).
- Notes textarea (optional, 200 char).
- Footer: `Cancel`, `Record Payment` (primary lemon, disabled until valid).

**Components:** RecordPaymentDialog
**States:**
- Amount > balance: inline red error "Amount exceeds remaining balance of ${balance}." Confirm disabled (BR-012 hard-block).
- Amount = balance: "Pay in full" badge appears, status preview "Will mark as Paid".
- Amount = 0 or empty: Confirm disabled.
- Submitting: spinner + form disabled.
- Success: dialog closes, toast "Payment of ${amount} recorded.", invoice refetches, status flips to Paid if balance = 0.

---

## Screen: Create Payment Plan Dialog
**Roles:** dentist_owner, dentist_associate, staff_full
**Layout:** Radix Dialog, 600px wide.
- Header: "Create payment plan for Invoice #{number}"
- Summary card: total remaining = $X.XX.
- Installment count slider (Radix Slider, range 2–24, lemon track). Default 6.
- Frequency select: Weekly, Bi-weekly, Monthly.
- Start date picker (default = today + 7 days).
- Auto-rounding note: "Last installment adjusts for rounding."
- Preview: InstallmentScheduleTable (read-only). Each row: # / due date / amount / status (all `Upcoming`).
- Footer: `Cancel`, `Create Plan` (primary lemon).

**Components:** PaymentPlanDialog, InstallmentScheduleTable
**States:**
- Slider live-update: schedule preview recomputes instantly.
- Validation: installments 2–24, start date today or future.
- Submitting: spinner.
- Success: dialog closes, toast "Payment plan created with {N} installments.", invoice detail refetches showing plan card.

---

## Screen: Patient Statement (`/patients/:id/statement`)
**Roles:** all roles (view)
**Layout:** Read-only document view, print-optimized.
- Header: clinic logo (top-left), patient name + DOB + address (top-right).
- Statement period selector (date range, default = last 6 months).
- Summary band: Total Billed, Total Paid, Outstanding Balance (lemon highlight).
- Invoices table: invoice #, date, status, total, paid, balance.
- Payments table: date, invoice #, amount, method, reference.
- Running balance ledger (optional toggle).
- Footer: `Print Statement` (primary), `Download PDF`, `Email to patient` (if email_consent.granted).

**Components:** PatientStatementView, InvoiceStatusBadge
**States:**
- Loading: skeleton bands.
- Empty: "No billing activity in selected period."
- Print mode: hides chrome, expands tables, monospaced amounts.
- Email send: dialog confirm "Send to {email}?", success toast.

---

## Screen: Create Invoice Dialog
**Roles:** dentist_owner, dentist_associate, staff_full
**Layout:** Radix Dialog, 680px wide.
- Step 1: Patient search/select (reuses scheduling patient picker).
- Step 2: TreatmentSelectList — checkbox list of patient's `performed` treatments not yet invoiced. Each row: date, code, description, tooth, fee (editable per-line override).
- Step 3: Adjustments — discount (% or $ toggle, max 100%), notes.
- Live total summary card (sticky right): subtotal, discount, total.
- Footer: `Cancel`, `Save as Draft` (secondary), `Issue Invoice` (primary lemon, disabled until ≥1 treatment selected — BR-009).

**Components:** TreatmentSelectList, InvoiceSummaryBar
**States:**
- No performed treatments available: empty state "Patient has no performed treatments to invoice. Treatments must be marked Performed before invoicing." (BR-009)
- No treatments selected: `Issue` and `Save as Draft` both disabled.
- Fee override changed: inline indicator "Overridden" with revert link.
- Discount > total: clamped to total, helper text.
- Submitting: spinner.
- Success: dialog closes, navigate to new Invoice Detail, toast "Invoice #{number} created."

---

## Screen: Void Invoice Confirmation
**Roles:** dentist_owner only
**Layout:** Radix AlertDialog, 500px wide, red destructive theme.
- Title: "Void this invoice?"
- Body: invoice summary card (#, patient, total, status).
- Warning panel (red icon): "Voiding is permanent. The invoice cannot be reissued. Patient records will retain the audit trail."
- Reason textarea (required, min 10 chars, counter).
- Footer: `Keep Invoice` (secondary), `Void Invoice` (destructive red, disabled until reason valid).

**Components:** VoidConfirmDialog
**States:**
- Payments recorded: trigger button disabled at source with tooltip "Cannot void — payments have been recorded. (BR-011)". Dialog cannot open.
- Reason too short: inline helper "At least 10 characters required."
- Submitting: spinner.
- Success: dialog closes, invoice flips to Void (strikethrough), toast "Invoice voided.", audit log entry created.
