<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-24 -->
<!-- skill: oli-api-contracts --all -->
<!-- based-on: MODULE_SPEC dental-scheduling, API_CONVENTIONS.md, ERROR_TAXONOMY.md -->

# API Contracts — dental-scheduling

> All responses wrap in `{ data, meta }`.
> Key rules: FR3.7 (double-booking prevention), BR-004 (check-in triggers visit creation).
> Appointment FSM: `scheduled` → `checked_in` | `cancelled`

---

## Endpoints

### POST /api/v1/dental/appointments

Book an appointment.

**Auth:** `staff_scheduling`, `staff_full`, `dentist_associate`, `dentist_owner`
**Rate limit:** Default

**Request body:**

| Field | Type | Nullable | Required | Format | Constraints | Example |
|-------|------|----------|----------|--------|-------------|---------|
| `branch_id` | string | NO | YES | uuid | — | `"01JX..."` |
| `patient_id` | string | NO | YES | uuid | — | `"01JX..."` |
| `provider_id` | string | NO | YES | uuid (membership) | — | `"01JX..."` |
| `start_at` | string | NO | YES | date-time (ISO 8601) | future datetime | `"2026-06-01T09:00:00Z"` |
| `end_at` | string | NO | YES | date-time (ISO 8601) | after start_at | `"2026-06-01T10:00:00Z"` |
| `visit_type` | string | NO | YES | — | enum: `checkup`, `treatment`, `emergency`, `recall` | `"checkup"` |
| `notes` | string | YES | NO | — | max:500 | `"Nervous patient, allow extra time"` |

**Response 201:** `{ data: Appointment }`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `branch_id` | string (uuid) | NO | |
| `patient_id` | string (uuid) | NO | |
| `provider_id` | string (uuid) | NO | |
| `start_at` | string (date-time) | NO | |
| `end_at` | string (date-time) | NO | |
| `status` | string | NO | `scheduled` |
| `visit_type` | string | NO | |
| `created_at` | string (date-time) | NO | |

**Errors:** `DOUBLE_BOOKING(409)`, `OUTSIDE_WORKING_HOURS(422)`, `NOT_FOUND(404)`, `VALIDATION_ERROR(400)`
**Events emitted:** DE-010 AppointmentBooked

---

### GET /api/v1/dental/appointments

List/query appointments (calendar view).

**Auth:** `staff_scheduling`, `staff_full`, `dentist_associate`, `dentist_owner`
**Query params:**

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `branch_id` | uuid | YES | Branch scope |
| `provider_id` | uuid | NO | Filter by provider |
| `patient_id` | uuid | NO | Filter by patient |
| `date_from` | date | YES | Calendar window start |
| `date_to` | date | YES | Calendar window end (max 31 days from date_from) |
| `status` | string | NO | `scheduled`, `checked_in`, `cancelled` |
| `page` | integer | NO | Default: 1 |
| `per_page` | integer | NO | Default: 50, max: 200 |

**Response 200:** Standard paginated collection

**Sort:** `start_at ASC` (default, not configurable)

**Errors:** `VALIDATION_ERROR(400)`, `FORBIDDEN(403)`

---

### PATCH /api/v1/dental/appointments/:id

Reschedule appointment (hard-block on double-booking).

**Auth:** `staff_scheduling`, `staff_full`, `dentist_owner`
**Path params:** `id` (uuid)

**Request body:**

| Field | Type | Nullable | Required | Format | Constraints | Example |
|-------|------|----------|----------|--------|-------------|---------|
| `start_at` | string | NO | YES | date-time (ISO 8601) | future datetime | `"2026-06-02T10:00:00Z"` |
| `end_at` | string | NO | YES | date-time (ISO 8601) | after start_at | `"2026-06-02T11:00:00Z"` |
| `provider_id` | string | YES | NO | uuid | — | `"01JX..."` |
| `notes` | string | YES | NO | — | max:500 | |

**Response 200:** `{ data: Appointment }`

**Errors:** `NOT_FOUND(404)`, `RESCHEDULE_CONFLICT(409)`, `DOUBLE_BOOKING(409)`, `OUTSIDE_WORKING_HOURS(422)`, `FORBIDDEN(403)`

---

### POST /api/v1/dental/appointments/:id/check-in

Check patient in — creates an active visit (BR-004).

**Auth:** `staff_scheduling`, `staff_full`, `dentist_associate`, `dentist_owner`
**Path params:** `id` (uuid)

**Response 200:** `{ data: { appointment_id: "uuid", visit_id: "uuid" } }`

**Errors:** `NOT_FOUND(404)`, `CHECKIN_ACTIVE_VISIT(409)`, `FORBIDDEN(403)`
**Events emitted:** DE-001 VisitCheckedIn

---

### DELETE /api/v1/dental/appointments/:id

Cancel appointment (soft-cancel — record preserved).

**Auth:** `staff_scheduling`, `staff_full`, `dentist_owner`
**Path params:** `id` (uuid)
**Query params:** `reason` (string, required, min:5, max:500)

**Response 200:** `{ data: { ok: true } }`

**Errors:** `NOT_FOUND(404)`, `REASON_REQUIRED(422)`, `FORBIDDEN(403)`
**Events emitted:** DE-011 AppointmentCancelled
