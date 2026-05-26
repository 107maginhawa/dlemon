# Data table contracts — dental-emr
<!-- oli: v3-dentalemon | dental-emr | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

EMR list columns: `source_system`, `record_date` (sortable default desc), `record_type`, `imported_at`, `imported_by`. Page size 25. Filter strip on `record_type` (all/hospital/gp/specialist/lab).

Lab results table columns: `test_name`, `value`, `unit`, `reference_range_low`, `reference_range_high`, `date` (sortable default desc), `abnormal_flag`.

Diagnoses and medications render as stacked lists, not tables.
