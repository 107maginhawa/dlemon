# Interaction States — dental-billing
<!-- oli: v3-dentalemon | dental-billing | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

**Invoice list:**
- Loading: 8 skeleton rows.
- Empty (per tab): tab-specific microcopy + optional CTA.
- Outstanding row: lemon `#FFE97D` 12% opacity background, persists on hover (deepens to 18%).
- Hover row: cursor pointer, subtle gray underlay.
- Overdue tab: count badge red when > 0.

**Invoice detail:**
- Draft: editable line items, dashed-outline editable cells, "Issue Invoice" lemon CTA.
- Issued: read-only, payment actions visible.
- Paid: green banner top "Paid in full on {date}", actions hidden.
- Overdue: red days-overdue chip in header, urgency styling.
- Void: card 60% opacity + strikethrough text, all actions disabled, reason banner.

**Record payment:**
- Amount > balance: red inline error, Confirm disabled (BR-012).
- Amount = balance: green "Pay in full" badge + status-flip preview.
- Method unselected: Confirm disabled.
- Submitting: button spinner, all inputs disabled.

**Payment plan:**
- Slider drag: schedule preview live-recomputes (debounced 50ms).
- Invalid date: red helper.
- Submitting: spinner.

**Create invoice:**
- No performed treatments available: empty state blocks creation (BR-009).
- No treatments selected: both `Issue` and `Save as Draft` disabled.
- Fee overridden: "Overridden" pill inline + revert link.
- Discount > subtotal: clamped, helper text "Discount capped at subtotal."

**Void:**
- Trigger button disabled when payments exist: tooltip "Cannot void — payments recorded (BR-011)."
- Reason < 10 chars: Confirm disabled, inline helper.

**Statement print:** `@media print` strips chrome, expands tables, uses 12pt monospace amounts.

**Toasts:** top-center, 3s, lemon for success, red for errors, neutral gray for info.
