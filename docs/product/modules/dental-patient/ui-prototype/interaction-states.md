# Interaction States — dental-patient
<!-- oli: v3-dentalemon | dental-patient | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

## Patient List
- **loading** — skeleton rows (8 placeholder rows, shimmer animation)
- **empty** — illustration + "No patients found" + "Add Patient" CTA
- **filtered-empty** — "No patients match your filters" + "Reset filters" link
- **error** — inline alert with retry button; preserves filters

## New Patient Form
- **idle** → **submitting** (button spinner, fields disabled) → **success** (toast + redirect) / **error** (field-level + form-level)

## Patient Import
- **idle** (file dropzone) → **uploading** (progress bar) → **parsing** (spinner) → **preview** (ImportPreviewTable) → **confirming** (spinner) → **success** (summary + "Done") / **partial-error** (download error CSV)

## GDPR Erasure
- **confirming** (type-to-confirm) → **processing** (locked dialog) → **success** (toast, patient archived) / **error** (retry option)
