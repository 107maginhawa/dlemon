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


# 1. Create an appointment
POST {{api}}/dental/appointments/
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "f3000000-0000-4000-8000-000000000001",
  "dentistMemberId": "f3000000-0000-4000-8000-000000000002",
  "branchId": "f3000000-0000-4000-8000-000000000003",
  "scheduledAt": "2025-06-01T09:00:00.000Z",
  "durationMinutes": 60,
  "procedureType": "Cleaning"
}
HTTP 201
[Captures]
appointment_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "scheduled"
jsonpath "$.walkIn" == false
jsonpath "$.procedureType" == "Cleaning"
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
GET {{api}}/dental/appointments/
Cookie: better-auth.session_token={{session_token}}
HTTP 200


# 5. Check in (creates draft visit)
POST {{api}}/dental/appointments/{{appointment_id}}/check-in
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Captures]
visit_id: jsonpath "$.visitId"
[Asserts]
jsonpath "$.appointment.status" == "checkedIn"
jsonpath "$.visitId" isString


# 6. Create a second appointment and cancel it
POST {{api}}/dental/appointments/
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "f3000000-0000-4000-8000-000000000004",
  "dentistMemberId": "f3000000-0000-4000-8000-000000000002",
  "branchId": "f3000000-0000-4000-8000-000000000003",
  "scheduledAt": "2025-06-01T10:00:00.000Z",
  "durationMinutes": 30,
  "procedureType": "Extraction"
}
HTTP 201
[Captures]
appt2_id: jsonpath "$.id"

DELETE {{api}}/dental/appointments/{{appt2_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 204


# 7. Walk-in appointment
POST {{api}}/dental/appointments/
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "f3000000-0000-4000-8000-000000000005",
  "dentistMemberId": "f3000000-0000-4000-8000-000000000002",
  "branchId": "f3000000-0000-4000-8000-000000000003",
  "scheduledAt": "2025-06-01T11:00:00.000Z",
  "durationMinutes": 45,
  "procedureType": "Whitening",
  "walkIn": true
}
HTTP 201
[Asserts]
jsonpath "$.walkIn" == true


# 8. List with status filter
GET {{api}}/dental/appointments/?status=checkedIn
Cookie: better-auth.session_token={{session_token}}
HTTP 200
