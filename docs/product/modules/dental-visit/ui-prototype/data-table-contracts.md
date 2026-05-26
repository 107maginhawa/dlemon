# Data Table Contracts — dental-visit
<!-- oli: v3-dentalemon | dental-visit | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

## Visit List
Columns (in order):
- `visit_date` — formatted `dd MMM yyyy`, sortable, default sort desc
- `dentist_name` — subtitle text, sortable
- `status` — VisitStatusBadge, sortable
- `chief_complaint` — truncated to 60 chars, ellipsis + tooltip for full
- `treatments_count` — pill badge ("3 treatments"), sortable
- `soap_signed` — green check / amber warning icon, sortable (unsigned first)

Row action: click → navigate to `/patients/:id/visits/:vid`.
Pagination: 25/page, infinite scroll on mobile.

## TreatmentList (inside workspace)
Columns (in tooth-grouped view):
- `cdt_code` — monospace
- `description` — truncated
- `surfaces` — pill chips (M/O/D/B/L)
- `status` — pill (diagnosed/planned/performed)
- `fee` — currency, right-aligned
- `actions` — edit, status transition button
