# Components — dental-patient
<!-- oli: v3-dentalemon | dental-patient | ui-prototype -->

## PatientListTable
**Props:** `patients: Patient[]`, `onRowClick(patient)`, `sortBy`, `sortDir`, `onSort(col)`, `loading?: boolean`
**Behavior:** Renders rows with patient code, full name, DOB (formatted), phone, recall indicator, safety floor badge, last visit date, status. Click row navigates to `/patients/:id`. Column headers sortable. Sticky header. Zebra striping disabled (Apple HIG flat). Row height 56px (44px touch target + padding). Hover state: `#F2F2F7` background. Selected row: `#FFE97D` left border accent (3px).

## PatientSearchBar
**Props:** `value: string`, `onChange(v)`, `placeholder?: string`, `debounceMs?: number = 300`
**Behavior:** Controlled input with debounce. Search icon left, clear (X) button right when value present. Hits `/api/v1/patients?search=` on debounced change. Min query length 2. Loading spinner replaces clear button while fetching. Keyboard: Esc clears, Enter forces immediate query.

## SafetyFloorBadge
**Props:** `severity: 'low' | 'medium' | 'high'`, `conditions?: string[]`, `compact?: boolean`
**Behavior:** Color-coded pill. Low = gray, medium = amber `#FFB800`, high = red `#FF3B30`. Hover/tap shows tooltip listing conditions (e.g., "Penicillin allergy, Anticoagulant therapy"). Compact mode shows icon-only with severity dot. ARIA label: "Safety floor: {severity}. Conditions: {list}". 44px touch target on mobile (icon-only mode expands hit area).

## RecallDueBadge
**Props:** `dueAt: Date | null`, `compact?: boolean`
**Behavior:** Computed states: `overdue` (red, days overdue), `due_soon` (lemon `#FFE97D`, within 14 days), `scheduled` (gray, future), `none` (hidden). Format: "Overdue 12d" or "Due in 5d". Tooltip shows exact date. Hidden if `dueAt` is null.

## PatientHeaderCard
**Props:** `patient: Patient`, `onEdit()`, `onArchive()`, `onErasureRequest()`, `readOnly?: boolean`
**Behavior:** Card surface (white, 12px radius, subtle shadow). Top row: photo placeholder circle (initials fallback), name (SF Pro 22pt semibold), DOB + age computed. Second row: patient_code (monospace), phone, email. Right side: action menu (•••) with Edit / Archive / Request GDPR Erasure. Safety floor badge + recall badge inline. Tappable phone/email (tel:/mailto:).

## DentitionMiniChart
**Props:** `dentition: DentitionSnapshot`, `notation: 'fdi' | 'universal'`, `size?: 'sm' | 'md'`
**Behavior:** Read-only 32-tooth SVG overview. Adult dentition only (no primary). Teeth color-coded: white = healthy, gray = missing, amber dot = condition present, blue dot = treatment present. No click handlers. Used on Patient Profile header for at-a-glance status. Size sm = 200px wide, md = 320px. SVG inline for theming.

## ImportPreviewTable
**Props:** `rows: ImportRow[]`, `onConfirm()`, `onCancel()`, `errors: Record<number, string[]>`
**Behavior:** Renders parsed CSV rows with columns: row#, first_name, last_name, dob, phone, email, status. Status pill: `valid` (green), `warning` (amber, duplicate suspected), `error` (red, with hover tooltip showing field errors). Errored rows have red left border. Footer: counts (X valid, Y warnings, Z errors). Confirm disabled if any errors. Pagination at 50 rows.

## GDPRErasureDialog
**Props:** `patient: Patient`, `open: boolean`, `onClose()`, `onConfirm(reason: string)`
**Behavior:** Radix Dialog. Title: "Request GDPR Erasure". Body explains irreversible action, lists what is erased (PII) vs retained (clinical records under legal hold). Reason textarea (required, min 10 chars). Confirm button red, disabled until reason valid. Type-to-confirm pattern: must type patient name to enable Confirm. 2-step: first click shows "Are you sure?" inline.

## PatientFilterBar
**Props:** `filters: PatientFilters`, `onChange(filters)`, `onReset()`
**Behavior:** Horizontal filter chips. Filters: status (active/archived/all), recall (overdue/due-soon/none), created (last 7d / 30d / 90d / all-time). Active filters have lemon `#FFE97D` border. Count badge on each chip showing matching count. "Reset" link visible when any non-default filter active. Persists in URL query params.
