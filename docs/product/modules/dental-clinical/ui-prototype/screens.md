# Screens — dental-clinical
<!-- oli: v3-dentalemon | dental-clinical | ui-prototype -->

Clinical records workspace within a visit. All records are visit-scoped and immutable after visit completion per BR-003. Records include prescriptions, lab orders, consent forms, medical history (patient-level), file attachments, and post-lock amendments. Tabbed panel embedded into the visit workspace; medical history has a patient-level view as well.

Design system: Apple HIG with `#FFE97D` lemon accent. SF Pro. `#F2F2F7` grouped background, white card surfaces. 44px touch targets. Radix UI primitives from `apps/dentalemon/src/components/`.

---

## Screen: Clinical Records Panel (`/patients/:id/visits/:vid/clinical`)
**Roles:** dentist_owner, dentist_associate (write); staff_full (read consent/history); patient (consent signature only via signed link)
**Layout:** Right-rail panel inside visit workspace (sibling of Chart, Treatment, Notes panels). Top: `ClinicalTabsNav` with five tabs (Prescriptions | Lab Orders | Consent | Attachments | History) using Radix Tabs. Below tabs: optional `ImmutabilityBanner` (yellow `#FFE97D` tinted) shown sticky when `visit.status === 'completed'` or visit is locked. Tab content area scrolls independently. Tabs lazy-load content on first activation; switching tabs preserves scroll per tab.
**Components:** ClinicalTabsNav, ImmutabilityBanner, plus per-tab content (PrescriptionList, LabOrderList, ConsentDocumentList, FileAttachmentUploader, MedicalHistoryForm read-only embed)
**States:**
- Loading (skeleton rows per tab on first activation)
- Empty per tab (e.g., "No prescriptions for this visit")
- Editable (visit open, role can write)
- Read-only (visit completed or role lacks write) — all add/edit/delete CTAs hidden or disabled with tooltip "Visit completed — records are read-only"
- Error (tab-scoped retry inline; does not collapse panel)

---

## Screen: Prescriptions Tab (panel content)
**Roles:** dentist_owner, dentist_associate (create/edit/print); others read-only
**Layout:** Stacked card list. Header row: count chip + `Add Prescription` button (right-aligned, lemon-accent primary). Each prescription row is a card with: drug name (semibold), dosage + frequency + duration (secondary text), instructions (collapsible, truncated to 2 lines with "Show more"), footer with prescribed-by avatar + name + ISO date + `Print` icon button. Rows are not reorderable. Sorted newest first.
**Components:** PrescriptionList, AddPrescriptionDialog (modal trigger), print action invokes browser print of a generated PDF/HTML voucher.
**States:**
- Empty: "No prescriptions issued at this visit." + `Add Prescription` CTA (if editable)
- Loading: 3 skeleton cards
- Add success: toast "Prescription added" + row appears at top
- Read-only: `Add Prescription` hidden; per-row print still available; edit/delete hidden
- Validation error in dialog: inline field errors, dialog stays open

---

## Screen: Add Prescription Dialog (modal)
**Roles:** dentist_owner, dentist_associate
**Layout:** Radix Dialog, 480px width. Title "Add Prescription". Fields stacked: Drug name (Combobox with searchable common dental drugs list — amoxicillin, ibuprofen, paracetamol, chlorhexidine, metronidazole, clindamycin; free-text fallback when no match), Dosage (e.g. "500 mg"), Frequency (segmented: q4h / q6h / q8h / q12h / PRN / custom), Duration (number + days/weeks unit toggle), Special instructions (textarea). Footer: contraindication callout block (only shown when PMH allergy/medication conflict detected — red `#FF453A` tint, lists conflicting allergy + drug). Actions: Cancel (ghost) | Save (lemon primary).
**Components:** AddPrescriptionDialog, drug Combobox, contraindication warning callout (uses `AllergyTag` styling)
**States:**
- Default (empty form, drug field focused)
- Searching drug (combobox listbox open)
- No drug match (free-text accept hint)
- Contraindication detected (warning banner inside dialog; Save remains enabled with confirmation copy "Override allergy warning — I acknowledge")
- Submitting (Save button spinner, fields disabled)
- Validation error (per-field message, focus first invalid)
- Success (dialog closes, parent list updates)

---

## Screen: Lab Orders Tab (panel content)
**Roles:** dentist_owner, dentist_associate (create/edit/upload result); others read-only
**Layout:** List of lab order cards. Each row: lab name (semibold), order type chip (crown / bridge / splint / nightguard / other), tooth/region (FDI badge), due date (with overdue red tint when past), `LabOrderStatusBadge` (pending / sent / received / overdue), result attachment slot (`Upload Result` button or attached file pill with download). Header: `Order Lab Work` button (right). Sorted by due date asc, then created date desc.
**Components:** LabOrderList, LabOrderStatusBadge, FileAttachmentUploader (scoped to single result file per order)
**States:**
- Empty: "No lab orders for this visit." + CTA (if editable)
- Pending (created, not sent)
- Sent (transmitted to lab; manual status toggle)
- Received (result uploaded; badge green)
- Overdue (due_date past + status !== received → red badge + amber row tint)
- Read-only: status badges + result download still functional; create/edit/upload hidden

---

## Screen: Consent Forms Tab (panel content)
**Roles:** dentist_owner, dentist_associate (request/upload); patient (sign via in-chair modal or signed link); staff_full (read)
**Layout:** List of consent document rows. Each row: document title, version, status (unsigned / signed), signed-by name + timestamp (when signed), CTAs: `Sign in chair` (opens `ConsentSignModal`), `Send for signature` (generates patient-facing signed link), `Upload signed PDF`, `View PDF`. Header: `Request Consent` button (opens template picker → creates unsigned document row).
**Components:** ConsentDocumentList, ConsentSignModal, document template picker (lightweight Combobox)
**States:**
- Unsigned (CTAs visible)
- Sent (link generated; shows "Awaiting patient signature" + copy-link icon)
- Signed (timestamp + signer name + lemon check; CTAs replaced by `View PDF` only)
- Uploaded (pre-signed PDF) — flagged "Uploaded" rather than "E-signed"
- Read-only: only `View PDF` remains

---

## Screen: Medical History View (`/patients/:id/clinical/history`)
**Roles:** dentist_owner, dentist_associate (edit when no active visit); staff_full, patient (read)
**Layout:** Standalone patient-level page (also embedded read-only into Clinical Records `History` tab). Three sections (Radix Accordion or stacked cards on grouped `#F2F2F7` bg):
1. **Allergies** — chip group of `AllergyTag` components, severity color-coded; `Add Allergy` action.
2. **Medications** — list of current medications: name, dose, frequency, since-date.
3. **Systemic conditions** — checklist (diabetes, hypertension, cardiac, bleeding disorder, pregnancy, immunocompromised, other free-text), plus ASA classification selector (I / II / III / IV / V) and free-text notes.
Header right: `SafetyFloorComputedBadge` (auto-derived from PMH severity, displays low / medium / high). Edit toggle disabled with tooltip "Editing locked during active visit" when an in-progress visit exists for this patient.
**Components:** MedicalHistoryForm, AllergyTag, SafetyFloorComputedBadge, ASA selector (Radix Select)
**States:**
- Read-only (default; pencil button reveals edit mode if eligible)
- Edit mode (form fields enabled; sticky footer: Cancel | Save)
- Active visit lock (edit disabled with tooltip)
- Saving (footer spinner)
- Validation error (per-section inline error)
- Empty PMH (helper copy "No medical history recorded. Add allergies, medications, and conditions to compute the safety floor.")

---

## Screen: File Attachments Tab (panel content)
**Roles:** dentist_owner, dentist_associate (upload/delete pre-completion); others read/download
**Layout:** Top: `FileAttachmentUploader` drag-drop zone (dashed lemon border on hover, 96px tall, "Drop files or click to browse"). Below: file list grid (2 columns on iPad, 1 on phone). Each tile: type icon (PDF / image / DICOM ref / generic), filename truncated, size, uploaded-by + timestamp, actions (Download, Delete pre-completion only). Accepted types: PDF, PNG, JPG, HEIC, DICOM reference (.dcm pointer, not full DICOM viewer — that's dental-imaging).
**Components:** FileAttachmentUploader, file tile (renders inline)
**States:**
- Empty (large dropzone only)
- Uploading (per-file progress bar inside its tile)
- Upload error (red tile with retry)
- Read-only (post-completion): dropzone hidden; tiles show Download only

---

## Screen: Clinical Amendments (panel section, History tab footer)
**Roles:** dentist_owner, dentist_associate (append amendments after lock)
**Layout:** Appears only when visit is completed. Section header "Amendments". Append-only log: each entry timestamp, author, amendment text. Footer textarea + `Add Amendment` button. Original records remain immutable; amendments are additive and timestamped.
**Components:** ClinicalAmendmentLog
**States:**
- Hidden (visit not yet completed)
- Empty post-completion ("No amendments")
- Submitting (button spinner)
- Success (new entry prepended)
