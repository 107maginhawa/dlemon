# Components — dental-billing
<!-- oli: v3-dentalemon | dental-billing | ui-prototype -->

All components built on Radix UI primitives in `apps/dentalemon/src/components/`. Apple HIG sizing, SF Pro, lemon `#FFE97D` accent. 44px min touch targets. Currency: USD, formatted with `Intl.NumberFormat`, two-decimal precision.

---

## InvoiceListTable
**Props:**
- `invoices: Invoice[]`
- `loading: boolean`
- `selectedTab: 'all' | 'draft' | 'issued' | 'paid' | 'overdue' | 'void'`
- `onRowClick(invoiceId)`
- `sort: { field, direction }`
- `onSortChange(sort)`

**Behavior:** Renders rows with columns: invoice #, patient name, issue date, due date, total, paid, balance, status. Outstanding rows (status=issued/overdue and balance > 0) row-highlighted lemon `#FFE97D` at 12% opacity. Sortable headers (issue_date, total, status). Row click → navigate to detail. Keyboard nav with arrow keys + Enter. Sticky header on scroll. 44px min row height.

---

## InvoiceStatusBadge
**Props:**
- `status: 'draft' | 'issued' | 'paid' | 'overdue' | 'void'`
- `size: 'sm' | 'md' | 'lg'`

**Behavior:** Pill badge, status color background at 16% opacity, matching text color. Strikethrough text for void. SF Pro Semibold, 11pt (sm) / 13pt (md) / 15pt (lg). 4×8px padding (sm), 6×12px (md+). Rounded full. `aria-label` mirrors status.

---

## InvoiceStatusTabs
**Props:**
- `value: TabValue`
- `onChange(value)`
- `counts: Record<TabValue, number>`

**Behavior:** Radix Tabs component. Tab label = status name + count chip. Active tab: lemon underline (2px). Counts auto-refresh via TanStack Query. Counts > 99 show "99+". Overdue count shown red when > 0.

---

## LineItemsTable
**Props:**
- `items: LineItem[]`
- `editable: boolean` (true only for draft invoices)
- `onItemChange(itemId, patch)`
- `onItemRemove(itemId)`

**Behavior:** Table columns: treatment code (e.g., `D2392`), description, tooth (FDI/ISO), surface(s), qty, fee. Editable mode: fee cell becomes input with "Overridden" indicator if changed from default. Read-only mode: plain text. Remove icon (trash) in editable mode only. Subtotal row at bottom right-aligned.

---

## PaymentHistoryList
**Props:**
- `payments: Payment[]`

**Behavior:** Chronological list (most recent first). Each row: date (left), amount (large, monospace), method icon + label, reference number, recorded-by avatar + name (tooltip on hover with timestamp). Total line at bottom: "Total paid: $X.XX". Empty state: "No payments yet." Method icons: cash 💵, card 💳, bank 🏦, insurance 🧾, check 📝 (icon library, not literal emoji).

---

## RecordPaymentDialog
**Props:**
- `invoiceId: string`
- `balanceDue: number`
- `open: boolean`
- `onOpenChange(open)`
- `onSuccess()`

**Behavior:** Radix Dialog. Amount input controlled; client-side validation `0 < amount ≤ balanceDue` (BR-012 hard-block on overpayment). `Pay in full` link sets amount = balanceDue. Method = required Radix Select. Date defaults to today, capped at today. POST on confirm. On success: TanStack Query cache invalidation for invoice + patient statement.

---

## PaymentPlanDialog
**Props:**
- `invoiceId: string`
- `balanceDue: number`
- `open: boolean`
- `onOpenChange(open)`
- `onSuccess()`

**Behavior:** Radix Dialog. Slider 2–24 installments (default 6). Frequency Radix Select. Start date picker (today+ only). Live schedule recomputation: `amount = floor(balance / N * 100) / 100` per installment, last installment absorbs rounding remainder. POST on confirm. On success: invoice refetch.

---

## InstallmentScheduleTable
**Props:**
- `installments: Installment[]`
- `editable: boolean` (false in preview, false in detail card)

**Behavior:** Table columns: #, due date, amount, status (Upcoming / Paid / Overdue). Status badges color-coded same as invoice. Past due unpaid rows red-tinted. Paid rows green check icon. Row click (in detail context) opens linked payment if exists.

---

## InvoiceSummaryBar
**Props:**
- `subtotal: number`
- `discount: number`
- `total: number`
- `paid: number`
- `balanceDue: number`
- `sticky: boolean`

**Behavior:** Sticky-footer bar (when sticky=true) with right-aligned label/amount pairs. Balance Due rendered in lemon-tinted card when > 0, green when = 0 ("Paid in full"). SF Pro Semibold 17pt for Balance Due, 13pt for others. Subtle 1px top border. Spacing: 12px vertical, 24px horizontal.

---

## VoidConfirmDialog
**Props:**
- `invoiceId: string`
- `open: boolean`
- `onOpenChange(open)`
- `paymentsExist: boolean`
- `onSuccess()`

**Behavior:** Radix AlertDialog, destructive theme. If `paymentsExist`, dialog cannot open (parent disables trigger button with tooltip — BR-011 enforcement). Reason textarea required, min 10 chars. POST on confirm. Audit log entry created server-side. On success: invoice flips to Void state.

---

## PatientStatementView
**Props:**
- `patientId: string`
- `dateRange: { start, end }`
- `onRangeChange(range)`
- `onPrint()`
- `onDownloadPdf()`
- `onEmail()` (only when email_consent.granted)

**Behavior:** Read-only document. Print-optimized CSS (`@media print` hides chrome, expands tables). Date range picker (Radix). Aggregates: total billed, total paid, outstanding balance (lemon highlight). Two stacked tables (invoices, payments). Optional running balance ledger toggle. Email action disabled with tooltip when patient lacks email_consent.

---

## TreatmentSelectList
**Props:**
- `patientId: string`
- `selectedIds: string[]`
- `onChange(ids)`
- `feeOverrides: Map<treatmentId, number>`
- `onFeeOverride(treatmentId, newFee)`

**Behavior:** Checkbox list of patient's `performed` treatments where `invoice_id IS NULL`. Each row: checkbox + date + code + description + tooth + fee input (override). Empty state when no available treatments → blocks invoice creation (BR-009). Filter chip: "Show invoiced treatments" toggles inclusion of already-invoiced.
