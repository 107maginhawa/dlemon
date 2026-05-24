# Screens — dental-pmd
<!-- oli: v3-dentalemon | dental-pmd | ui-prototype -->

Portable Medical Documents — per-visit signed snapshots (immutable, checksum-verified) and imports of external PMDs. One completed visit = one PMD. PMDs are compliance records.

**Roles in this module:**
- `dentist_owner`, `dentist_associate` — generate and import PMDs
- `staff_full` — view PMDs and download
- `patient` — download own PMDs

---

## Screen: PMD List (`/patients/:id/pmds`)

**Roles:** dentist_owner, dentist_associate, staff_full, patient (own only)
**Layout:** Patient sub-route shell. Header with patient name + "Portable Medical Documents" title. Primary action `Import PMD` (top-right). Two stacked sections: "Generated PMDs" (system-created from visits) and "Imported PMDs" (external uploads). Each section is a Radix Table with grouped background (`#F2F2F7`) and white card surface.
**Components:**
- `PMDListTable` (generated section: visit_date, generated_at, generated_by, checksum_status, download)
- `PMDListTable` (imported section: source_system, record_date, imported_at, imported_by, checksum_status, download)
- `ChecksumBadge` (per row: verified/unverified/failed)
- `ImportedPMDBadge` (source system chip, only on imported rows)
- `PMDDownloadButton` (PDF download, fires `pmd.downloaded` event)
- `EmptyStatePanel` (when no PMDs and no imports)
- Primary CTA: `Import PMD` (opens `ImportPMDDialog`)

**States:**
- Loading: skeleton table (5 rows shimmer)
- Empty: "No PMDs generated yet. PMDs are created automatically when a visit is completed and SOAP is signed."
- Populated: rows sorted by visit_date descending
- Error: inline error banner with retry
- Download in-flight: button shows spinner; toast on success/failure
- Patient role: hides `Import PMD` and `Generate` actions; only `Download` visible

---

## Screen: PMD Detail / Preview (`/patients/:id/pmds/:id`)

**Roles:** dentist_owner, dentist_associate, staff_full, patient (own only)
**Layout:** Full-page read-only document view, Apple HIG document styling. Top toolbar: back link to PMD list, `Download PDF`, `Print`, `Verify` actions. Document body uses serif-ish hierarchy on white card. Footer fixed band shows checksum and verification status. No edit controls anywhere.
**Components:**
- `PMDPreviewDocument` (root: patient header, visit summary, treatments table, SOAP sections, attachments list, medications, checksum footer)
- `ImportedReadOnlyBanner` (only when `is_imported = true`)
- `PMDDownloadButton` (in toolbar)
- `PMDVerificationPanel` (collapsible footer card: checksum hash, generated-at, generated-by, last-verified-at, `Re-verify` button)
- `ChecksumBadge` (in footer band)
- Print stylesheet target (CSS print media)

**States:**
- Loading: skeleton document outline
- Loaded verified: green check footer, all sections expanded
- Loaded unverified: orange warning banner above document body
- Loaded failed checksum: red banner ("Checksum mismatch — content may have been altered")
- Re-verifying: spinner on `Re-verify` button; result toast
- 404: "PMD not found or you do not have access"
- Patient role: hides generated_by name; shows only generated_at and checksum status

---

## Screen: Import PMD Dialog

**Roles:** dentist_owner, dentist_associate
**Layout:** Radix Dialog (modal, 560px wide). Stepped flow inside the dialog: (1) Upload, (2) Verify, (3) Preview, (4) Confirm. Footer with `Cancel` and primary action (`Next` / `Import` / `Import as Unverified`).
**Components:**
- `ImportPMDDialog` (root with stepper)
- File dropzone (accepts `.json`, `.pdf`; max 25 MB)
- `Input` for `source_system` (required, free text)
- `DatePicker` for `received_date` (required, default today)
- Checksum verification panel: hash extracted, status badge
- `EMRImportPreview`-style parsed JSON preview (when JSON)
- PDF preview iframe (when PDF)
- Inline warning when checksum mismatch: "This PMD's checksum does not match. You may import it but it will be flagged as Unverified."

**States:**
- Idle: dropzone visible
- Uploading: progress bar
- Verifying: spinner + "Verifying checksum…"
- Verified valid: green badge + parsed preview
- Verified mismatch: orange warning + secondary `Import as Unverified` CTA
- Parsing failed: error state ("Could not parse file. Supported formats: JSON, PDF.")
- Submitting: primary button spinner
- Success: dialog closes, toast "PMD imported", list refetch
- Error: inline error inside dialog

---

## Screen: Generate PMD Dialog

**Roles:** dentist_owner, dentist_associate
**Layout:** Radix Dialog (480px). Triggered from a completed visit detail screen. Single confirmation step. Headline: "Generate PMD for visit on {date}". Body summarizes the visit. Irreversibility callout.
**Components:**
- `GeneratePMDDialog` (root)
- Visit summary block (visit date, treatments performed count, SOAP signed indicator)
- Irreversibility callout (Apple HIG-style notice with lemon `#FFE97D` accent border)
- Primary action `Generate PMD` (destructive-styling not used; uses lemon accent emphasis)
- Cancel action

**States:**
- Eligible: summary shown, primary CTA enabled
- Not eligible: SOAP unsigned → CTA disabled with reason "SOAP must be signed before generating a PMD"
- Generating: spinner overlay + "Generating PMD…"
- Success: success state inside dialog with `Download Now` and `View PMD` actions
- Error: inline error
- Already exists: "A PMD already exists for this visit" with link to existing PMD

---

## Screen: PMD Verification Detail

**Roles:** dentist_owner, dentist_associate, staff_full
**Layout:** Either embedded section on PMD Detail or a focused route `/patients/:id/pmds/:id/verify`. Compact card listing the cryptographic facts. White surface on `#F2F2F7` background.
**Components:**
- `PMDVerificationPanel`
- Hash display (monospace, copy-to-clipboard button)
- `generated_at` timestamp
- `generated_by` actor (hidden for patient role)
- `last_verified_at` timestamp
- `Re-verify` button (primary)
- `ChecksumBadge` summary

**States:**
- Idle: last result displayed
- Re-verifying: spinner
- Result verified: green badge + updated `last_verified_at`
- Result mismatch: red badge + "Checksum mismatch detected. Contact your administrator."
- Error: retry control
