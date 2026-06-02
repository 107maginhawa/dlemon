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


# 0a. Create a dental organization
POST {{api}}/dental/organizations
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "name": "Scheduling Test Clinic {{suffix}}",
  "tier": "clinic",
  "countryCode": "PH"
}
HTTP 201
[Captures]
org_id: jsonpath "$.id"


# 0b. Create a branch
POST {{api}}/dental/organizations/{{org_id}}/branches
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "name": "Main Branch",
  "timezone": "Asia/Manila",
  "address": "123 Test Street",
  "city": "Manila",
  "phone": "+639001234567"
}
HTTP 201
[Captures]
branch_id: jsonpath "$.id"


# 0c. Create a dental patient
POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Scheduling Test Patient {{suffix}}",
  "consentGiven": true
}
HTTP 201
[Captures]
patient_id: jsonpath "$.id"


# 0d. Create branch membership for this user (grants branch access)
POST {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}/members
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Dr. Scheduling Tester",
  "role": "dentist_owner",
  "personId": "{{user_id}}"
}
HTTP 201
[Captures]
dentist_member_id: jsonpath "$.id"


# 1. Create an appointment
POST {{api}}/dental/appointments
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "dentistMemberId": "{{dentist_member_id}}",
  "branchId": "{{branch_id}}",
  "scheduledAt": "2025-06-01T09:00:00.000Z",
  "durationMinutes": 60,
  "serviceType": "Cleaning"
}
HTTP 201
[Captures]
appointment_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "scheduled"
jsonpath "$.walkIn" == false
jsonpath "$.serviceType" == "Cleaning"
jsonpath "$.durationMinutes" == 60


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


# 4. List appointments (no filter)
GET {{api}}/dental/appointments
Cookie: better-auth.session_token={{session_token}}
HTTP 200


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
  "dentistMemberId": "{{dentist_member_id}}",
  "branchId": "{{branch_id}}",
  "scheduledAt": "2025-06-01T10:00:00.000Z",
  "durationMinutes": 30,
  "serviceType": "Extraction"
}
HTTP 201
[Captures]
appt2_id: jsonpath "$.id"

DELETE {{api}}/dental/appointments/{{appt2_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 204


# 7. Walk-in appointment
POST {{api}}/dental/appointments
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "dentistMemberId": "{{dentist_member_id}}",
  "branchId": "{{branch_id}}",
  "scheduledAt": "2025-06-01T11:00:00.000Z",
  "durationMinutes": 45,
  "serviceType": "Whitening",
  "walkIn": true
}
HTTP 201
[Asserts]
jsonpath "$.walkIn" == true


# 8. List with status filter
GET {{api}}/dental/appointments?status=checked_in
Cookie: better-auth.session_token={{session_token}}
HTTP 200


# NEW: G2-S4 — appointment double-booking returns 201 with DOUBLE_BOOKING warning
# Creating another appointment for the same dentist at the same time should succeed
# but include a DOUBLE_BOOKING warning (soft conflict, not a hard 409).
POST {{api}}/dental/appointments
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "dentistMemberId": "{{dentist_member_id}}",
  "branchId": "{{branch_id}}",
  "scheduledAt": "2025-06-01T09:00:00.000Z",
  "durationMinutes": 30,
  "serviceType": "Consultation"
}
HTTP 201
[Captures]
conflict_appt_id: jsonpath "$.id"
[Asserts]
jsonpath "$.warnings" includes "DOUBLE_BOOKING"


# NEW: G2-S4 — list appointments filtered by a specific date
GET {{api}}/dental/appointments?date=2025-06-01&branchId={{branch_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$" isCollection


# ── P1-24: confirmation lifecycle ────────────────────────────────────────────
# C1. Create an appointment to confirm
POST {{api}}/dental/appointments
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "dentistMemberId": "{{dentist_member_id}}",
  "branchId": "{{branch_id}}",
  "scheduledAt": "2025-07-01T09:00:00.000Z",
  "durationMinutes": 30,
  "serviceType": "Cleaning"
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


# C3. Illegal transition: confirmed → completed via PATCH is rejected (4xx)
PATCH {{api}}/dental/appointments/{{confirm_appt_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "completed"
}
HTTP 422


# C4. confirmed → checked_in is allowed (creates a visit)
POST {{api}}/dental/appointments/{{confirm_appt_id}}/check-in
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.appointment.status" == "checked_in"


# C5. Public token-confirm with an unknown token → 404 (route wired, public)
POST {{api}}/dental/public/appointments/{{confirm_appt_id}}/confirm/a3000000-0000-4000-8000-0000000000a2
HTTP 404
