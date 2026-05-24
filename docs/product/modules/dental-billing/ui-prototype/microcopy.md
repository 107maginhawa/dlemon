# Microcopy — dental-billing
<!-- oli: v3-dentalemon | dental-billing | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

**CTAs:** "New Invoice", "Issue Invoice", "Save as Draft", "Record Payment", "Pay in full", "Create Payment Plan", "Void Invoice", "Keep Invoice", "Print Statement", "Download PDF", "Email Statement".

**Labels:** "Invoice #", "Patient", "Issue date", "Due date", "Subtotal", "Discount", "Total", "Paid", "Balance Due", "Amount", "Method", "Reference", "Reason for void", "Installments", "Frequency", "Start date".

**Status:** "Draft", "Issued", "Paid", "Overdue", "Void", "Paid in full", "Upcoming", "Overdue".

**Empty / placeholder:**
- Invoice list (All): "No invoices yet."
- Paid tab: "No paid invoices in this period."
- Overdue tab: "No overdue invoices — great work!"
- Void tab: "No voided invoices."
- Create invoice: "Patient has no performed treatments to invoice. Treatments must be marked Performed before invoicing." (BR-009)
- Payment history: "No payments yet."
- Statement: "No billing activity in selected period."

**Errors / blocks:**
- Overpayment: "Amount exceeds remaining balance of ${balance}."
- Void with payments: "Cannot void — payments have been recorded."
- Void reason short: "At least 10 characters required."
- Discount over subtotal: "Discount capped at subtotal."
- No treatments selected: "Select at least one performed treatment."
- Email without consent: "Patient has not granted email consent."

**Success toasts:**
- "Invoice #{number} created."
- "Invoice issued."
- "Payment of ${amount} recorded."
- "Payment plan created with {N} installments."
- "Invoice voided."
- "Statement emailed to {email}."

**Banners:**
- Paid: "Paid in full on {date}."
- Void: "Voided on {date} — Reason: {reason}"
- Overdue: "{N} days overdue"
