# Screens — dental-emr
<!-- oli: v3-dentalemon | dental-emr | ui-prototype -->

Import and view external EMR (Electronic Medical Record) records for a patient. Read-only after import — same pattern as imported PMDs. No auto-merge into dental records.

**Roles in this module:**
- `dentist_owner`, `dentist_associate` — import and view
- `staff_full` — view only

Apple HIG + lemon `#FFE97D` accent visual language. SF Pro font. White cards on `#F2F2F7` grouped background. 44px touch targets.

---

## Screen: EMR Records List (`/patients/:id/emr`)

**Roles:** dentist_owner, dentist_associate, staff_full
**Layout:** Patient sub-route. Page title "External Medical Records". Primary action `Import EMR Record` top-right. Below: a Radix Table of imported records, grouped by `record_type` via a tab strip (All / Hospital / GP / Specialist / Lab). Each tab is a filter pill, not a separate route.
**Components:**
- `EMRRecordList` (table)
- `EMRSourceBadge` (per row)
- `EMRRecordTypeBadge` (per row)
- Filter tab strip (record type)
- `ImportEMRDialog` trigger button
- `EmptyStatePanel`

**States:**
- Loading: 5-row skeleton
- Empty: "No external medical records imported. Import records from previous providers."
- Populated: rows sorted by `record_date` desc
- Filtered: filter tab applied; empty-within-filter message variant
- Error: inline banner with retry
- Patient row click → navigates to EMR Record Viewer

---

## Screen: EMR Record Viewer (`/patients/:id/emr/:id`)

**Roles:** dentist_owner, dentist_associate, staff_full
**Layout:** Full-page read-only viewer. Top: `ImportedReadOnlyBanner` (gray banner with source system + import date). Below banner, structured sections in a single scroll column on white card surface: Source Header → Demographics → Diagnoses → Medications → Lab Results → Clinical Notes. Toolbar: back link, `Print`. Watermark "Imported — read only" applied to printed output.
**Components:**
- `EMRRecordViewer` (root)
- `ImportedReadOnlyBanner`
- Source header card (source_system, record_date, record_type, imported_at, imported_by)
- Demographics block (read-only patient info as captured in the external record)
- `DiagnosesList`
- `MedicationsList`
- `LabResultsTable`
- Clinical Notes section (markdown-rendered text, no edit affordance)

**States:**
- Loading: skeleton section outlines
- Loaded (structured): all sections rendered
- Loaded (PDF only): falls back to PDF preview iframe with download link instead of structured sections
- Loaded (partial structured): missing-data placeholders ("No diagnoses recorded in this record")
- Error: full-page error with retry
- 404: "Record not found or you do not have access"

---

## Screen: Import EMR Dialog

**Roles:** dentist_owner, dentist_associate
**Layout:** Radix Dialog (modal, 600px wide). Stepper: (1) Upload → (2) Parse → (3) Preview → (4) Confirm. Footer with `Cancel` and primary action (`Next` / `Import`).
**Components:**
- `ImportEMRDialog` (root)
- File dropzone (accepts `.json` HL7 FHIR Bundle, `.pdf`, `.txt`; max 25 MB)
- `Input` `source_system` (required)
- `DatePicker` `record_date` (required, <= today)
- `Select` `record_type` (required; options: hospital, gp, specialist, lab)
- `EMRImportPreview` (parse result preview for structured uploads)
- For PDF: thumbnail + filename preview only
- Informational callout: "Imported records are stored read-only and never merged into the patient's dental chart."

**States:**
- Idle: dropzone visible, required fields empty
- Uploading: progress
- Parsing (FHIR JSON): spinner + "Parsing FHIR bundle…"
- Parse success: preview rendered with extracted counts (e.g., "3 diagnoses, 5 medications, 2 lab observations detected")
- Parse failed (unknown format): warning "Format not recognized. The file will be imported as an opaque attachment." with continue option
- Submitting: primary button spinner
- Success: dialog closes, toast "EMR record imported", list refetch
- Error: inline error inside dialog
