# Form Contracts — dental-scheduling
<!-- oli: v3-dentalemon | dental-scheduling | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

**Book Appointment:**
- `patient_id` (required, uuid)
- `dentist_id` (required, uuid)
- `appointment_date` (required, ISO date, today or future)
- `start_time` (required, HH:mm, within working hours)
- `duration_minutes` (required, 15–240, multiples of 15)
- `appointment_type` (required, enum: exam | cleaning | filling | crown_prep | extraction | consult | other)
- `room_id` (optional, uuid)
- `notes` (optional, max 500 chars)

**Reschedule Appointment:**
- `appointment_id` (required, uuid)
- `new_dentist_id` (required, uuid)
- `new_start_time` (required, ISO datetime, future)
- `new_duration_minutes` (required, 15–240)
- `reason` (optional, max 500 chars)
- Hard-block: reject if original appointment is today (BR-same-day).

**Cancel Appointment:**
- `appointment_id` (required, uuid)
- `reason` (required, min 10 chars, max 500)

**Check In:**
- `appointment_id` (required, uuid)
- Server-validated: appointment date must equal today (BR-004).

**Working Hours (per dentist, per day):**
- `day_of_week` (required, 0–6)
- `active` (required, boolean)
- `start_time` (required if active, HH:mm)
- `end_time` (required if active, HH:mm, > start_time)
- `breaks` (array, each { start_time, end_time within day range })
