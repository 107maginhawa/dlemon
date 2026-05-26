# Screens — dental-visit
<!-- oli: v3-dentalemon | dental-visit | ui-prototype -->

## Screen: Visit Workspace (`/patients/:id/visits/:vid`)
**Roles:** dentist_owner, dentist_associate (full edit); staff_full (read-only)
**Layout:** Three-region workspace on `#F2F2F7` grouped background.
- **Header** (sticky, white card, 72px): patient name (SF Pro 17pt semibold) + DOB/age, visit date + dentist name, VisitStatusBadge, right-side CTAs ("Save Draft", "Complete Visit"). Breadcrumb: Patients › {name} › Visits › {date}.
- **Left panel** (~55% width on desktop, stacked on iPad portrait): DentalChartSVG (32-tooth FDI grid, ~640px wide). Below chart: TreatmentList grouped by tooth. Carry-over ghosts overlaid on teeth with prior planned treatments.
- **Right panel** (~45% width): TimelineCarousel — focal VisitCard center showing current snapshot, prior visit cards as peek previews left, next/future to right. Navigation arrows + swipe.
- **Bottom panel** (collapsible, full width, 40vh when expanded): SOAPNotesEditor with S/O/A/P tabs or stacked sections.

**Components:** DentalChartSVG, TreatmentList, TimelineCarousel, VisitCard, SOAPNotesEditor, VisitStatusBadge, CarryOverIndicator, CompleteVisitDialog (modal), ChartEntryDialog (modal triggered from chart).
**States:**
- **loading** — skeleton chart (gray tooth grid) + skeleton carousel + skeleton SOAP
- **draft** — fully editable, auto-save indicator in header ("Saved 2s ago")
- **active** — same as draft, "Active visit" status pill
- **completed** — read-only, all inputs disabled; addendum-only on SOAP (no Reopen action — state machine is forward-only)
- **locked** — full-width amber banner top: "This visit is locked and cannot be modified." All inputs disabled.
- **error** — toast on save failure with retry
- **offline** — banner: "Working offline. Changes will sync when connection returns."

---

## Screen: Visit List (`/patients/:id/visits`)
**Roles:** dentist_owner, dentist_associate, staff_full
**Layout:** Card list under patient header. Reverse chronological. Each row 80px height (44px+ touch).
- Row: date (left, bold), dentist name (subtitle), VisitStatusBadge, chief complaint preview (1 line, truncated), treatments count badge ("3 treatments"), chevron right.
- Sticky filter bar: status filter (all/draft/active/completed/locked), dentist filter, date range.
- FAB bottom-right "New Visit" (lemon `#FFE97D` background, primary accent). Visible to dentist_* and staff_full.

**Components:** VisitCard (list variant), VisitStatusBadge, PatientHeaderCard (from dental-patient).
**States:** loading (skeleton 5 rows), empty ("No visits yet — start a new visit"), filtered-empty, error.

---

## Screen: Chart Entry Dialog
**Roles:** dentist_owner, dentist_associate
**Layout:** Radix Dialog, 560px wide, white card, 16px radius. Triggered by clicking a tooth in DentalChartSVG.
- **Header**: "Tooth {fdi}" (e.g., "Tooth 36"), close X. Tooth diagram inset showing surfaces.
- **Tabs**: Conditions | Treatments. Lemon underline on active tab.
- **Conditions tab**: severity selector (radio: mild/moderate/severe), surface checkboxes (M/O/D/B/L grid), condition_type select (caries/fracture/mobility/etc.), notes textarea (max 500).
- **Treatments tab**: CDTCodePicker (searchable), surfaces checkboxes, status select (diagnosed/planned/performed — see treatment state machine), fee override (currency input, optional, defaults to template fee).
- **Footer**: Cancel | Save Entry (primary).

**Components:** ChartEntryDialog, CDTCodePicker, ToothCell (inset reference).
**States:** loading templates, idle, validating (Save disabled), saving (spinner on button), error (inline field), success (dialog closes, chart updates optimistically).

---

## Screen: SOAP Notes Panel (embedded in Workspace bottom)
**Roles:** dentist_owner, dentist_associate (write + sign); staff_full (read-only)
**Layout:** Full-width panel at workspace bottom. Collapsed: 56px header bar showing "SOAP Notes — Unsigned" or "Signed by Dr. X · {date}". Expanded: 40vh with S/O/A/P sections stacked.
- Each section: label (S/Subjective, O/Objective, A/Assessment, P/Plan), rich-text editor (basic formatting: bold/italic/list), character count.
- Footer: "Sign Notes" button (dentist only, disabled until all 4 sections have content). After sign: button replaced by "Add Addendum" + signature info.
- Version history expander showing prior versions (timestamped, diff view link).

**Components:** SOAPNotesEditor.
**States:** loading, unsigned-editable, unsigned-with-warnings (e.g., empty sections), signed (read-only with addendum option), addendum-mode (append-only editor), signing (button spinner), signed-success (toast + state transition).

---

## Screen: Dentition Init Dialog
**Roles:** dentist_owner, dentist_associate
**Layout:** Radix Dialog, 640px wide. Triggered first time a patient's chart is opened.
- **Header**: "Initialize Dentition for {patient_name}".
- **Body**:
  - Notation system selector (segmented: FDI / Universal) — affects label display.
  - Dentition stage select (adult / mixed / primary).
  - Missing teeth multi-select — mini 32-tooth grid, tap to toggle missing (gray overlay).
  - Existing restorations quick-entry — table of common restorations (Composite, Crown, Bridge, Implant) with tooth picker.
- **Footer**: Skip (defers init) | Save Dentition (primary, lemon).

**Components:** DentitionInitDialog, DentalChartSVG (init mode, no condition click).
**States:** idle, validating, saving, success (closes dialog + chart loads), error.

---

## Screen: Complete Visit Dialog
**Roles:** dentist_owner, dentist_associate
**Layout:** Radix Dialog, 480px wide. Triggered by "Complete Visit" CTA.
- **Header**: "Complete this visit?"
- **Body**: Summary block — treatments performed count, SOAP signed status (green check or amber warning), unsigned-SOAP warning text if applicable.
- "Generate invoice from performed treatments" checkbox (default checked if any performed).
- **Footer**: Cancel | Complete Visit (primary, disabled if unsigned-SOAP + dentist hasn't acknowledged warning).

**Components:** CompleteVisitDialog.
**States:** idle, warning (unsigned SOAP), confirming (button spinner), success (dialog closes, status → completed, toast + invoice link if generated), error.

---

## Screen: Treatment Templates (`/settings/treatment-templates`)
**Roles:** dentist_owner only
**Layout:** Settings page. Header "Treatment Templates" + "New Template" CTA. List of template cards.
- Each card: template name (bold), default CDT codes (comma chips), fee preset (currency), edit/delete actions.
- Create/Edit form (inline expand or side sheet): name input, CDT code multi-select via CDTCodePicker, default fee currency input, default surfaces (M/O/D/B/L checkboxes).

**Components:** CDTCodePicker.
**States:** loading (skeleton cards), empty ("No templates yet"), list, editing, saving, error.
