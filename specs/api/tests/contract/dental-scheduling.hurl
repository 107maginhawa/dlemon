# Dental Scheduling contract tests
# Tests: create appointment, get, update, list, check-in (creates draft visit),
#        cancel, walk-in flag, list with filters.

# 0. Sign up
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "dental-scheduling-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dr. Scheduling Tester"
}
HTTP 200
[Captures]
session_token: cookie "better-auth.session_token"
user_id: jsonpath "$.user.id"


# 0a. Self-service onboarding — provisions org + default branch + owner membership
# in one call (replaces the old org→branch→member setup; the caller becomes the org
# owner + a dentist_owner member, so the rest of the suite runs on the user's token).
POST {{api}}/dental/onboarding
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "organizationName": "Scheduling Test Clinic {{suffix}}",
  "tier": "clinic",
  "countryCode": "PH",
  "branchName": "Main Branch",
  "timezone": "Asia/Manila",
  "address": "123 Test Street",
  "city": "Manila",
  "phone": "+639001234567",
  "ownerDisplayName": "Dr. Scheduling Tester"
}
HTTP 201
[Captures]
org_id: jsonpath "$.organizationId"
branch_id: jsonpath "$.branchId"
dentist_member_id: jsonpath "$.membershipId"


# 0b. Create a dental patient
POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Scheduling Test Patient {{suffix}}",
  "consentGiven": true,
  "branchId": "{{branch_id}}"
}
HTTP 201
[Captures]
patient_id: jsonpath "$.id"


# 1. Create an appointment
POST {{api}}/dental/appointments
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "providerId": "{{dentist_member_id}}",
  "branchId": "{{branch_id}}",
  "startAt": "2025-06-01T09:00:00.000Z",
  "endAt": "2025-06-01T10:00:00.000Z",
  "visitType": "checkup"
}
HTTP 201
[Captures]
appointment_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "scheduled"
jsonpath "$.walkIn" == false
jsonpath "$.visitType" == "checkup"
jsonpath "$.startAt" exists
jsonpath "$.endAt" exists


# 2. Get appointment
GET {{api}}/dental/appointments/{{appointment_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{appointment_id}}"
jsonpath "$.status" == "scheduled"


# 3. Update appointment
PATCH {{api}}/dental/appointments/{{appointment_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "notes": "Updated notes"
}
HTTP 200
[Asserts]
jsonpath "$.notes" == "Updated notes"


# 4. List appointments (branch + required calendar window)
GET {{api}}/dental/appointments?branchId={{branch_id}}&date_from=2025-06-01&date_to=2025-06-01
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$" isCollection


# 5. Check in (creates draft visit)
POST {{api}}/dental/appointments/{{appointment_id}}/check-in
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Captures]
visit_id: jsonpath "$.visitId"
[Asserts]
jsonpath "$.appointment.status" == "checked_in"
jsonpath "$.visitId" isString


# 6. Create a second appointment and cancel it
POST {{api}}/dental/appointments
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "providerId": "{{dentist_member_id}}",
  "branchId": "{{branch_id}}",
  "startAt": "2025-06-01T13:00:00.000Z",
  "endAt": "2025-06-01T13:30:00.000Z",
  "visitType": "treatment"
}
HTTP 201
[Captures]
appt2_id: jsonpath "$.id"

DELETE {{api}}/dental/appointments/{{appt2_id}}?reason=Patient%20requested%20cancellation
Cookie: better-auth.session_token={{session_token}}
HTTP 204


# 7. Walk-in appointment
POST {{api}}/dental/appointments
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "providerId": "{{dentist_member_id}}",
  "branchId": "{{branch_id}}",
  "startAt": "2025-06-01T15:00:00.000Z",
  "endAt": "2025-06-01T15:45:00.000Z",
  "visitType": "emergency",
  "walkIn": true
}
HTTP 201
[Asserts]
jsonpath "$.walkIn" == true


# 8. List with status filter
GET {{api}}/dental/appointments?status=checked_in&branchId={{branch_id}}&date_from=2025-06-01&date_to=2025-06-01
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$" isCollection


# NEW: G2-S4 — appointment double-booking returns 201 with DOUBLE_BOOKING warning
# Creating another appointment for the same dentist at the same time should succeed
# but include a DOUBLE_BOOKING warning (soft conflict, not a hard 409).
POST {{api}}/dental/appointments
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "providerId": "{{dentist_member_id}}",
  "branchId": "{{branch_id}}",
  "startAt": "2025-06-01T09:00:00.000Z",
  "endAt": "2025-06-01T09:30:00.000Z",
  "visitType": "checkup"
}
HTTP 201
[Captures]
conflict_appt_id: jsonpath "$.id"
[Asserts]
jsonpath "$.warnings" contains "DOUBLE_BOOKING"


# NEW: G2-S4 — list appointments filtered by a specific date (calendar window)
GET {{api}}/dental/appointments?date_from=2025-06-01&date_to=2025-06-01&branchId={{branch_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$" isCollection


# ── P1-24: confirmation lifecycle ────────────────────────────────────────────
# C0. A fresh patient for the confirmation flow. Patient 1 already has an active
# (draft) visit from the step-5 check-in, and check-in hard-blocks (409
# CHECKIN_ACTIVE_VISIT) while a patient has an in-progress visit. C4 below
# check-ins this appointment, so it must belong to a patient with no open visit.
POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Scheduling Confirm Patient {{suffix}}",
  "consentGiven": true,
  "branchId": "{{branch_id}}"
}
HTTP 201
[Captures]
confirm_patient_id: jsonpath "$.id"


# C1. Create an appointment to confirm
POST {{api}}/dental/appointments
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{confirm_patient_id}}",
  "providerId": "{{dentist_member_id}}",
  "branchId": "{{branch_id}}",
  "startAt": "2025-07-01T09:00:00.000Z",
  "endAt": "2025-07-01T09:30:00.000Z",
  "visitType": "checkup"
}
HTTP 201
[Captures]
confirm_appt_id: jsonpath "$.id"


# C2. Staff confirm: scheduled → confirmed (sets confirmedAt)
POST {{api}}/dental/appointments/{{confirm_appt_id}}/confirm
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "confirmed"
jsonpath "$.confirmedAt" isString


# C3. Illegal transition: confirmed → completed via PATCH is rejected.
# The FSM has no confirmed→completed edge, so updateAppointment throws a
# ValidationError (VALIDATION_ERROR → 400) before any state change.
PATCH {{api}}/dental/appointments/{{confirm_appt_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "completed"
}
HTTP 400


# C4. confirmed → checked_in is allowed (creates a visit)
POST {{api}}/dental/appointments/{{confirm_appt_id}}/check-in
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.appointment.status" == "checked_in"


# C5. Public token-confirm with an unknown token → 404 (route wired, public)
POST {{api}}/dental/public/appointments/{{confirm_appt_id}}/confirm/a3000000-0000-4000-8000-0000000000a2
HTTP 404
