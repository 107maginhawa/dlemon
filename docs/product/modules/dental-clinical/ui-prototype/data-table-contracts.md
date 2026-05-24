# Data Table Contracts — dental-clinical
<!-- oli: v3-dentalemon | dental-clinical | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

Prescription list columns: `drug_name`, `dosage_description` (computed `${dosage} ${frequency} × ${duration}`), `prescribed_by`, `date`, `printed_at` (nullable). Sort: `date` desc. No pagination (visit-scoped, typically <10 rows).

Lab order list columns: `lab_name`, `order_type`, `tooth_region` (FDI), `due_date`, `status` (`LabOrderStatusBadge`), `result_file` (download link or upload slot). Sort: `due_date` asc, then `created_at` desc. Overdue derived client-side.

Consent document list columns: `title`, `version`, `status` (unsigned / sent / signed / uploaded), `signed_by`, `signed_at`. Sort: `created_at` desc.

Attachments grid (not a table): `filename`, `type_icon`, `size`, `uploaded_by`, `uploaded_at`. Sort: `uploaded_at` desc.

Amendments log: `created_at`, `author`, `text`. Sort: `created_at` desc. Append-only.
