# Form contracts — dental-pmd
<!-- oli: v3-dentalemon | dental-pmd | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

Import PMD form:
- `file` — required, `.json` or `.pdf`, max 25 MB
- `source_system` — required, string, 1-120 chars
- `received_date` — required, date <= today

Generate PMD form: no inputs — confirmation-only dialog.

PMDs are immutable: no edit forms exist for either generated or imported PMDs.
