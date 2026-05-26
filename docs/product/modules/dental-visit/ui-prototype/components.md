# Components — dental-visit
<!-- oli: v3-dentalemon | dental-visit | ui-prototype -->

## DentalChartSVG
**Props:** `dentition: DentitionSnapshot`, `entries: ChartEntry[]`, `treatments: Treatment[]`, `carryOver?: CarryOverEntry[]`, `notation: 'fdi' | 'universal'`, `onToothClick(fdi)`, `readOnly?: boolean`, `highlightTooth?: string`
**Behavior:** Renders 32 adult teeth in arch layout (UR/UL upper arch, LL/LR lower arch). Each tooth is a ToothCell. Teeth grouped by quadrant with mid-line gap. Tooth labels per notation system. Click delegates to `onToothClick(fdi)` unless readOnly. Condition badges (colored dots) per tooth. Treatment indicators (filled surfaces). Carry-over ghost overlay (50% opacity, dashed outline) for prior planned treatments not yet performed. Missing teeth rendered with diagonal gray hatch. Responsive: scales via viewBox. Keyboard nav: arrow keys move focus, Enter triggers click. ARIA: each tooth `role="button"` with label "Tooth {fdi}, {condition summary}".

## ToothCell
**Props:** `fdi: string`, `state: 'healthy' | 'missing' | 'restored' | 'condition' | 'treatment'`, `surfaces?: SurfaceState`, `onClick()`, `focused?: boolean`, `hover?: boolean`, `ghost?: boolean`
**Behavior:** Individual tooth SVG path (anatomically distinct shapes per tooth type — incisor/canine/premolar/molar). Surface regions (M/O/D/B/L) clickable independently in detail mode. Hover: subtle lift + scale(1.05). Active focus: lemon `#FFE97D` outline. Condition state shows colored badge top-right. Treatment state fills relevant surfaces. Ghost mode (carry-over) renders at 50% with dashed stroke. Missing teeth render as outline only with diagonal hatch.

## TimelineCarousel
**Props:** `snapshots: VisitSnapshot[]`, `focalIndex: number`, `onNavigate(direction: 'prev' | 'next')`, `onJump(index)`, `loading?: boolean`
**Behavior:** Horizontally scrolling carousel with focal card centered (full size), prior/next cards peek at edges (scaled 0.85, opacity 0.7). Snap-to-focal on scroll end. Left/right arrow buttons (44px touch). Swipe gestures on touch devices. Keyboard: ←/→ to navigate. Cumulative snapshot model — each card represents the dentition state at that visit's completion. Empty state if only single visit (no nav arrows). Loading: focal card skeleton. Pagination dots below for >3 visits.

## VisitCard
**Props:** `visit: Visit`, `variant: 'focal' | 'peek' | 'list'`, `onClick?()`, `selected?: boolean`
**Behavior:** Card surface (white, 12px radius). Focal variant (~360px wide): full visit details — date prominent, dentist, status badge, treatments summary (icons + counts: 2 diagnosed, 1 planned, 3 performed), SOAP signed indicator, mini chart preview. Peek variant: scaled down 0.85, same content compressed. List variant: horizontal row layout (used in Visit List screen). Click navigates or jumps carousel. Selected state: lemon border 2px.

## TreatmentList
**Props:** `treatments: Treatment[]`, `onStatusChange(id, status)`, `onEdit(treatment)`, `groupBy?: 'tooth' | 'status'`, `readOnly?: boolean`
**Behavior:** Renders treatments below or beside chart. Default group-by-tooth: section header per FDI, treatments listed under. Each row: CDT code (monospace), description, surfaces affected, status pill, fee, actions (edit, mark performed/not-performed). Status state machine enforced: diagnosed→planned→performed (must step through). Mark Performed button only available when status=planned (disabled otherwise with tooltip "Treatment must be planned first"). Bulk select via checkboxes for mass status updates. Read-only mode hides actions, shows status as static badges.

## SOAPNotesEditor
**Props:** `notes: SOAPNotes`, `onChange(section, value)`, `onSign()`, `onAddAddendum(text)`, `signed: boolean`, `signedBy?: User`, `signedAt?: Date`, `versions?: SOAPVersion[]`, `readOnly?: boolean`
**Behavior:** Four sections (S/O/A/P), each with rich-text editor (basic: bold/italic/bullet/numbered list). Character count per section. Sign button only enabled when all sections have ≥10 chars + user is dentist. Sign action freezes content, captures signature metadata (user, timestamp, device). After sign: editor becomes read-only, "Add Addendum" button appears (appends timestamped block, never modifies original). Version history collapsible footer showing prior versions with diff link. Auto-save debounced 1s during draft. Unsigned warning indicator (amber dot) when visit-complete attempted.

## ChartEntryDialog
**Props:** `tooth: string`, `existingConditions: ChartEntry[]`, `existingTreatments: Treatment[]`, `open: boolean`, `onClose()`, `onSave(entry)`, `templates: TreatmentTemplate[]`
**Behavior:** Radix Dialog. Tabs: Conditions | Treatments. Conditions tab form: severity radio, condition_type select, surface checkboxes (M/O/D/B/L), notes. Treatments tab form: CDTCodePicker + surfaces + status select + fee override. Pre-populates from templates when CDT code selected. Validates required fields before enabling Save. ESC + outside-click confirm-discard if dirty. Optimistic UI: chart updates immediately on save, rolls back on server error.

## CDTCodePicker
**Props:** `value: string | null`, `onChange(code)`, `placeholder?: string`, `categoryFilter?: string`
**Behavior:** Searchable combobox (Radix Popover + Command). Lists CDT codes with descriptions ("D2391 — Resin-based composite, one surface, posterior"). Search by code or description (fuzzy). Categories: Diagnostic, Preventive, Restorative, Endodontic, Periodontic, Prosthodontic, Oral Surgery, Orthodontic. Recent codes pinned at top. Keyboard nav. Selected code shows in trigger with description tooltip.

## VisitStatusBadge
**Props:** `status: 'draft' | 'active' | 'completed' | 'locked'`, `compact?: boolean`
**Behavior:** Pill badge with color + label. draft = gray `#8E8E93`, active = lemon `#FFE97D` with dark text, completed = green `#34C759`, locked = red `#FF3B30` with lock icon. Compact mode = icon-only with tooltip. ARIA label "Visit status: {status}".

## CarryOverIndicator
**Props:** `tooth: string`, `priorTreatments: Treatment[]`, `onAccept()`, `onDismiss()`
**Behavior:** Renders inside ToothCell as ghost overlay (50% opacity, dashed outline). Tooltip on hover lists prior planned treatments with visit date: "Carry-over from {date}: D2740 Crown, planned". Click opens action sheet: "Accept (mark performed today)" | "Carry forward" | "Dismiss". Visual distinct from same-visit entries (dashed not solid).

## CompleteVisitDialog
**Props:** `visit: Visit`, `open: boolean`, `onClose()`, `onConfirm(opts: { generateInvoice: boolean })`, `summary: VisitSummary`
**Behavior:** Radix Dialog. Shows: performed treatments count, SOAP signed status (check icon green / warning icon amber). If SOAP unsigned: warning text + "I acknowledge signing is required separately" checkbox (must check to enable Confirm). "Generate invoice from performed treatments" checkbox (default checked when any performed). Confirm triggers status transition + optional invoice creation in single transaction. Success closes with toast linking to invoice if generated.

## DentitionInitDialog
**Props:** `patient: Patient`, `open: boolean`, `onClose()`, `onSave(snapshot: DentitionSnapshot)`
**Behavior:** Radix Dialog. Notation system segmented control (FDI/Universal). Dentition stage select (adult/mixed/primary). Missing teeth picker: mini interactive chart, tap to toggle (gray overlay = missing). Existing restorations table: rows of common types (Composite, Crown, Bridge, Implant, Inlay, Onlay) with tooth multi-select per row. Save creates initial DentitionSnapshot. Skip option (defers, opens empty chart).
