# Interaction States — dental-clinical
<!-- oli: v3-dentalemon | dental-clinical | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

Visit immutability: when `visit.status === 'completed'` (BR-003), all tabs display `ImmutabilityBanner` and disable add/edit/delete actions. Download/print/view actions remain enabled. Amendments section appears only after completion.

Prescriptions: drug Combobox states — closed / open / searching / no-results (free-text fallback hint visible). Contraindication callout appears as soon as a known allergen-conflict drug is selected; Save remains gated behind acknowledgement checkbox.

Lab orders: status transitions are user-driven (pending → sent → received). Overdue is purely visual (no separate state in storage). Upload result is per-order; replacing an existing result confirms via Radix AlertDialog.

Consent: unsigned → in-chair signing modal (touch/stylus) or sent via tokenized link (parent generates URL). Signed state is terminal in UI (re-sign creates a new versioned document).

Medical history: read-only by default. Edit gated by `activeVisitId` absence and role check; tooltip explains why disabled. Saving shows footer spinner; failure shows toast + retains form state.

Attachments: drag-over zone activates lemon border highlight. Upload progress per-file. Failed uploads show retry inline. DICOM (.dcm) references display a "View in Imaging" link that deep-links into dental-imaging viewer.

Errors: per-tab error boundary with retry; never collapses the visit workspace shell. Toast on transient save failure; inline field errors on validation.
