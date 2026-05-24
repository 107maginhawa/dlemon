# Data Table Contracts — dental-patient
<!-- oli: v3-dentalemon | dental-patient | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

## PatientListTable
Columns (in order):
- `patient_code` — monospace, 8ch width, sortable
- `full_name` — bold, sortable, default sort asc
- `dob` — formatted `dd MMM yyyy`, age in parens, sortable
- `phone` — tel: link, monospace
- `recall_due_at` — RecallDueBadge, sortable (overdue first)
- `safety_floor_severity` — SafetyFloorBadge, sortable (high first)
- `last_visit_at` — relative time ("3d ago"), sortable
- `status` — pill (active/archived)

Row actions: click → navigate; right-click context menu (Edit, Archive, Request Erasure).
Pagination: 50/page, infinite scroll on mobile, paginated on desktop.
