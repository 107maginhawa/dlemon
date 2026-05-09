# Booking lifecycle alternative paths: reject, no-show, double-booking
# conflict. Complements booking-flow.hurl which covers confirm/cancel.

# 0. Host setup.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "edge-host-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Edge Host"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Edge",
  "lastName": "Host",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


POST {{api}}/booking/events
Content-Type: application/json
{
  "title": "Edge cases {{suffix}}",
  "timezone": "America/New_York",
  "locationTypes": ["video"],
  "maxBookingDays": 60,
  "minBookingMinutes": 60,
  "status": "active",
  "effectiveFrom": "2026-01-01T00:00:00Z",
  "dailyConfigs": {
    "mon": { "enabled": true, "timeBlocks": [{ "startTime": "09:00", "endTime": "17:00", "slotDuration": 30 }] },
    "tue": { "enabled": true, "timeBlocks": [{ "startTime": "09:00", "endTime": "17:00", "slotDuration": 30 }] }
  }
}
HTTP 201
[Captures]
event_id: jsonpath "$.id"


GET {{api}}/booking/events/{{event_id}}/slots?status=available
HTTP 200
[Captures]
slot_id: jsonpath "$[0].id"
slot_id_2: jsonpath "$[1].id"


# 1. Client A books and the host rejects.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "edge-client-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Edge Client"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Edge",
  "lastName": "Client",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


POST {{api}}/booking/bookings
Content-Type: application/json
{
  "slot": "{{slot_id}}",
  "locationType": "video",
  "reason": "Will be rejected"
}
HTTP 201
[Captures]
booking_a_id: jsonpath "$.id"


# 2. Booking the same slot a second time conflicts.
POST {{api}}/booking/bookings
Content-Type: application/json
{
  "slot": "{{slot_id}}",
  "locationType": "video",
  "reason": "Double booking"
}
HTTP 409


# 3. Invalid / non-existent slot UUID is a 4xx (impl picks 400 for
# malformed shape, 404 for not-found UUID).
POST {{api}}/booking/bookings
Content-Type: application/json
{
  "slot": "not-a-uuid",
  "locationType": "video",
  "reason": "Bad slot"
}
HTTP 400


POST {{api}}/booking/bookings
Content-Type: application/json
{
  "slot": "00000000-0000-4000-8000-000000000000",
  "locationType": "video",
  "reason": "Missing slot"
}
HTTP 404


# 4. Switch to host and reject the first booking.
POST {{api}}/auth/sign-in/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "edge-host-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest"
}
HTTP 200


POST {{api}}/booking/bookings/{{booking_a_id}}/reject
Content-Type: application/json
{ "reason": "Schedule conflict on host side" }
HTTP 200
[Asserts]
jsonpath "$.status" == "rejected"


# 5. Client books the second slot, host confirms, then host marks
# no-show.
POST {{api}}/auth/sign-in/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "edge-client-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest"
}
HTTP 200


POST {{api}}/booking/bookings
Content-Type: application/json
{
  "slot": "{{slot_id_2}}",
  "locationType": "video",
  "reason": "Will be no-show"
}
HTTP 201
[Captures]
booking_b_id: jsonpath "$.id"


POST {{api}}/auth/sign-in/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "edge-host-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest"
}
HTTP 200


POST {{api}}/booking/bookings/{{booking_b_id}}/confirm
Content-Type: application/json
{ "reason": "Confirmed" }
HTTP 200


# No-show enforces timing rules (the host must wait until the
# scheduled time has actually passed). The booking is in the future,
# so the impl rejects with 422 — that's the boundary we're asserting.
POST {{api}}/booking/bookings/{{booking_b_id}}/no-show
Content-Type: application/json
{ "reason": "Client didn't show up" }
HTTP 422
