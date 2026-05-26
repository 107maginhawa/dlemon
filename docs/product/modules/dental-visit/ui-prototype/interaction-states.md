# Interaction States — dental-visit
<!-- oli: v3-dentalemon | dental-visit | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

## Visit Workspace
- **loading** — skeleton chart (gray tooth grid), skeleton carousel cards, skeleton SOAP
- **empty-chart** — chart renders but no entries yet, helper text "Tap a tooth to start charting"
- **draft / active** — fully editable, auto-save indicator ("Saved 2s ago" / "Saving…")
- **completed** — read-only chart + treatments, SOAP addendum-only
- **locked** — full-width amber banner top: "This visit is locked and cannot be modified."
- **offline** — banner "Working offline. Changes will sync when connection returns."
- **save-error** — toast with retry

## SOAP Notes
- **unsigned-editable** — all sections editable, "Sign Notes" disabled until min length met
- **unsigned-warning** — on Complete Visit attempt: dialog warning "SOAP notes are unsigned"
- **signing** — button spinner, fields locked
- **signed** — read-only, signature metadata shown, "Add Addendum" button visible
- **addendum-mode** — append-only editor, original preserved above

## Carousel
- **single-visit** — focal card only, no nav arrows
- **multi-visit** — arrows + dots active
- **at-start / at-end** — disabled arrow on respective side

## Chart Entry Dialog
- **idle** → **validating** (Save disabled) → **saving** (button spinner) → **success** (closes + optimistic chart update) / **error** (inline field + form-level)
- **dirty-discard** — ESC/outside-click triggers confirm dialog

## Treatment Status Transition
- **diagnosed → planned** — single click "Plan"
- **planned → performed** — single click "Mark Performed"
- **diagnosed → performed (blocked)** — button disabled with tooltip "Treatment must be planned first"

## Complete Visit Dialog
- **idle** → **warning** (unsigned SOAP) → **confirming** (button spinner) → **success** (toast + status→completed) / **error**
