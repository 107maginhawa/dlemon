# Components — dental-emr
<!-- oli: v3-dentalemon | dental-emr | ui-prototype -->

All components live in `apps/dentalemon/src/components/emr/` and compose Radix primitives from `apps/dentalemon/src/components/ui/`. Visual system: SF Pro, white card surfaces on `#F2F2F7`, lemon `#FFE97D` for accent emphasis only. 44px minimum touch targets.

---

## EMRRecordList

**Props:**
- `records: EMRRecord[]`
- `filter: 'all' | 'hospital' | 'gp' | 'specialist' | 'lab'`
- `onFilterChange(next): void`
- `onRowClick(recordId: string): void`
- `loading?: boolean`

**Behavior:**
- Radix Table with columns `source_system`, `record_date`, `record_type`, `imported_at`, `imported_by`
- Filter tab strip at top calls `onFilterChange` (client-side filter; server pagination optional)
- Rows are full-row click targets (keyboard accessible: `Enter` activates `onRowClick`)
- Composes `EMRSourceBadge` and `EMRRecordTypeBadge` inline
- Skeleton 5 rows when `loading`; empty-state when filtered or unfiltered list is empty

---

## EMRSourceBadge

**Props:**
- `sourceSystem: string`
- `icon?: 'hospital' | 'gp' | 'specialist' | 'lab' | 'generic'`

**Behavior:**
- Pill chip with leading Radix icon and `sourceSystem` text
- Neutral gray surface
- Tooltip exposes the full source name if truncated

---

## EMRRecordTypeBadge

**Props:**
- `type: 'hospital' | 'gp' | 'specialist' | 'lab'`

**Behavior:**
- Color-coded chip: hospital = blue tint, gp = green tint, specialist = purple tint, lab = orange tint (all low-saturation Apple HIG palette)
- Labels: "Hospital", "GP", "Specialist", "Lab Result"
- Read-only visual

---

## EMRRecordViewer

**Props:**
- `record: EMRRecordFull`
- `mode: 'screen' | 'print'`

**Behavior:**
- Renders sections in order: Source Header, Demographics, Diagnoses, Medications, Lab Results, Clinical Notes
- Sections that have no data render a small italic placeholder ("No diagnoses recorded in this record") instead of being hidden
- `mode='print'` applies print stylesheet (banner becomes watermark, toolbar hidden)
- Never offers edit affordances — read-only by contract

---

## ImportedReadOnlyBanner

**Props:**
- `sourceSystem: string`
- `importedAt: string`

**Behavior:**
- Slim banner across top of viewer: gray surface, leading info icon
- Copy: "Imported from {sourceSystem} on {importedAt} — read only"
- Non-dismissible
- Becomes a corner watermark in print mode

---

## DiagnosesList

**Props:**
- `diagnoses: Array<{ icd10_code?: string; description: string; onset_date?: string; resolved_date?: string; status?: 'active' | 'resolved' }>`

**Behavior:**
- Stacked list (not a table) — readable on narrow screens
- Each item shows ICD-10 code (monospace) + description + date range
- Active diagnoses get a small green status dot; resolved get gray
- Empty: placeholder text

---

## MedicationsList

**Props:**
- `medications: Array<{ drug: string; dosage?: string; route?: string; prescriber?: string; start_date?: string; end_date?: string; active: boolean }>`

**Behavior:**
- Stacked list with drug name as heading, then dose/route line, then prescriber and date range
- Active medications first (sorted by `start_date` desc); inactive in a collapsed "Past medications" section
- Empty: placeholder text

---

## LabResultsTable

**Props:**
- `results: Array<{ test_name: string; value: string; unit?: string; reference_low?: string; reference_high?: string; date: string; abnormal_flag?: 'low' | 'high' | 'critical_low' | 'critical_high' }>`

**Behavior:**
- Radix Table with columns: `test_name`, `value`, `unit`, `reference_range`, `date`, `flag`
- `abnormal_flag` rendered as colored badge (low/high = orange, critical = red)
- Sortable by `date` (default desc) and `test_name`
- Read-only — no inline edit

---

## ImportEMRDialog

**Props:**
- `patientId: string`
- `open: boolean`
- `onOpenChange(open: boolean): void`
- `onImported(recordId: string): void`

**Behavior:**
- Stepper: Upload → Parse → Preview → Confirm
- Validates file extension and size (max 25 MB); inline error on failure
- For JSON: attempts FHIR Bundle parse; on success extracts counts and populates preview
- For PDF/TXT: treats as opaque attachment with no structured preview
- POST `/api/dental-emr/imports` on confirm; on success closes dialog, calls `onImported`, toast result
- Cancel discards in-memory state

---

## EMRImportPreview

**Props:**
- `parsed: { diagnoses: number; medications: number; observations: number; notes: number } | null`
- `rawSample?: string`

**Behavior:**
- Shows summary card with parsed counts when `parsed` is set
- Shows a monospace excerpt (first ~20 lines) of the raw payload for operator confidence
- When `parsed` is null, renders a neutral "Preview unavailable — record will be imported as an attachment" state
