# P1-25 — Online / self-service booking contract tests
#
# Verifies the public booking surface: branch config drives the form, availability
# is computed live (PII-free), a hold reserves a slot, a booking creates a real
# scheduled appointment with a confirmation code, double-booking is hard-blocked
# (409), public routes are reachable unauthenticated, and staff routes still 401.

# 0. Sign up the owner (staff who configures the branch)
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "online-booking-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dr. Booking Owner"
}
HTTP 200
[Captures]
session_token: cookie "better-auth.session_token"
user_id: jsonpath "$.user.id"


# 0a. Organization
POST {{api}}/dental/organizations
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "name": "Online Booking Clinic {{suffix}}",
  "tier": "clinic",
  "countryCode": "PH"
}
HTTP 201
[Captures]
org_id: jsonpath "$.id"


# 0b. Branch (UTC so the contract slots are timezone-stable)
POST {{api}}/dental/organizations/{{org_id}}/branches
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "name": "Booking Branch",
  "timezone": "UTC",
  "address": "1 Booking Ave",
  "city": "Manila",
  "phone": "+639001234567"
}
HTTP 201
[Captures]
branch_id: jsonpath "$.id"


# 0c. Provider membership (owner is a bookable provider)
POST {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}/members
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Dr. Booking Owner",
  "role": "dentist_owner",
  "personId": "{{user_id}}"
}
HTTP 201
[Captures]
provider_id: jsonpath "$.id"


# 0d. Working hours: open every day 00:00–23:59 so contract slots are always inside.
PUT {{api}}/dental/branches/{{branch_id}}/working-hours
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "workingHours": {
    "monday":    { "enabled": true, "open": "00:00", "close": "23:59" },
    "tuesday":   { "enabled": true, "open": "00:00", "close": "23:59" },
    "wednesday": { "enabled": true, "open": "00:00", "close": "23:59" },
    "thursday":  { "enabled": true, "open": "00:00", "close": "23:59" },
    "friday":    { "enabled": true, "open": "00:00", "close": "23:59" },
    "saturday":  { "enabled": true, "open": "00:00", "close": "23:59" },
    "sunday":    { "enabled": true, "open": "00:00", "close": "23:59" }
  }
}
HTTP 200


# 0e. Enable online booking via the branch settings blob (zero lead-time so the
#     contract can book a near-future slot; checkup is bookable).
PUT {{api}}/dental/branches/{{branch_id}}/settings
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "onlineBooking": {
    "enabled": true,
    "bookableVisitTypes": ["checkup", "recall"],
    "leadTimeMinutes": 0,
    "horizonDays": 365,
    "slotStepMinutes": 30,
    "requirePatientAuth": false
  }
}
HTTP 200


# 1. Public booking-config is reachable UNAUTHENTICATED and reflects policy.
GET {{api}}/dental/public/branches/{{branch_id}}/booking-config
HTTP 200
[Asserts]
jsonpath "$.enabled" == true
jsonpath "$.bookableVisitTypes" includes "checkup"
jsonpath "$.providers" count > 0


# 2. Public availability is reachable unauthenticated and PII-free.
GET {{api}}/dental/public/branches/{{branch_id}}/availability?visitType=checkup&date_from=2099-01-05&date_to=2099-01-05&providerId={{provider_id}}
HTTP 200
[Asserts]
jsonpath "$.branchId" == "{{branch_id}}"
jsonpath "$.visitType" == "checkup"
jsonpath "$.slots" count > 0
body not contains "patientId"


# 3. Hold a slot — returns a session token + expiry.
POST {{api}}/dental/public/branches/{{branch_id}}/holds
Content-Type: application/json
{
  "providerId": "{{provider_id}}",
  "startAt": "2099-01-05T09:00:00Z",
  "visitType": "checkup"
}
HTTP 201
[Captures]
session_token_hold: jsonpath "$.sessionToken"
[Asserts]
jsonpath "$.providerId" == "{{provider_id}}"
jsonpath "$.expiresAt" exists


# 4. Commit the booking — real scheduled appointment + confirmation code.
POST {{api}}/dental/public/branches/{{branch_id}}/bookings
Content-Type: application/json
{
  "providerId": "{{provider_id}}",
  "startAt": "2099-01-05T09:00:00Z",
  "visitType": "checkup",
  "sessionToken": "{{session_token_hold}}",
  "firstName": "Jordan",
  "lastName": "Rivera",
  "email": "jordan-{{suffix}}@example.org",
  "phone": "+15551234567"
}
HTTP 201
[Captures]
confirmation_code: jsonpath "$.confirmationCode"
[Asserts]
jsonpath "$.status" == "scheduled"
jsonpath "$.confirmationCode" exists


# 5. Double-book the exact same slot → hard 409 (unlike staff soft-warn).
POST {{api}}/dental/public/branches/{{branch_id}}/bookings
Content-Type: application/json
{
  "providerId": "{{provider_id}}",
  "startAt": "2099-01-05T09:00:00Z",
  "visitType": "checkup",
  "firstName": "Second",
  "lastName": "Booker"
}
HTTP 409


# 6. Emergency is never bookable online → 422.
POST {{api}}/dental/public/branches/{{branch_id}}/bookings
Content-Type: application/json
{
  "providerId": "{{provider_id}}",
  "startAt": "2099-01-05T11:00:00Z",
  "visitType": "emergency",
  "firstName": "Urgent"
}
HTTP 422


# 7. Confirmation lookup by code (PII-minimal).
GET {{api}}/dental/public/bookings/{{confirmation_code}}
HTTP 200
[Asserts]
jsonpath "$.branchId" == "{{branch_id}}"
jsonpath "$.status" == "scheduled"
jsonpath "$.confirmationState" == "pending"


# 8. The online appointment is visible to staff and can be checked in
#    (flows through the existing lifecycle). First list to find it.
GET {{api}}/dental/appointments?branchId={{branch_id}}&date_from=2099-01-05&date_to=2099-01-05
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$" count > 0
jsonpath "$[0].status" == "scheduled"


# 9. Staff routes still require auth — listing without a session is 401.
GET {{api}}/dental/appointments?branchId={{branch_id}}&date_from=2099-01-05&date_to=2099-01-05
HTTP 401
