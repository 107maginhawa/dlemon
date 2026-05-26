# Form contracts — dental-emr
<!-- oli: v3-dentalemon | dental-emr | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

Import EMR form:
- `file` — required, `.json` / `.pdf` / `.txt`, max 25 MB
- `source_system` — required, string 1-120 chars
- `record_date` — required, date <= today
- `record_type` — required, enum: `hospital | gp | specialist | lab`

No edit forms — imported EMR records are read-only by contract.
