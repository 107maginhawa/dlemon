# Data Table Contracts — dental-scheduling
<!-- oli: v3-dentalemon | dental-scheduling | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

Scheduling is calendar-first (no primary data table). Fallback appointment list view used in mobile-narrow and search-results contexts.

**Appointment list columns:**
- `patient_name` (sortable, sticky-left mobile)
- `appointment_date` (sortable, default desc)
- `start_time` (display HH:mm)
- `dentist_name`
- `appointment_type`
- `status` (AppointmentStatusBadge)
- `room_name`

**Filters:** date range, dentist (multi), status (multi), room.
**Row actions:** View detail (opens AppointmentDetailPopover), Check In (today only), Reschedule, Cancel.
**Empty state:** "No appointments match your filters."
