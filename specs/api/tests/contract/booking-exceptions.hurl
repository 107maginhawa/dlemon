# Schedule exceptions on a booking event: single block, weekly recurring,
# list/get/delete. Exceptions express "this event is unavailable during
# windows X" and propagate into the slot generator.

POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "exc-host-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Exception Host"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Exception",
  "lastName": "Host",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


POST {{api}}/booking/events
Content-Type: application/json
{
  "title": "Event with exceptions {{suffix}}",
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


# 1. Single one-off block.
POST {{api}}/booking/events/{{event_id}}/exceptions
Content-Type: application/json
{
  "startDatetime": "2026-06-01T13:00:00Z",
  "endDatetime": "2026-06-01T15:00:00Z",
  "reason": "Conference",
  "recurring": false
}
HTTP 201
[Captures]
single_exception_id: jsonpath "$.id"
[Asserts]
jsonpath "$.recurring" == false


# 2. Weekly recurring block (every Monday 12:00-13:00 ET).
POST {{api}}/booking/events/{{event_id}}/exceptions
Content-Type: application/json
{
  "startDatetime": "2026-06-01T16:00:00Z",
  "endDatetime": "2026-06-01T17:00:00Z",
  "reason": "Weekly standup",
  "recurring": true,
  "recurrencePattern": {
    "type": "weekly",
    "interval": 1,
    "daysOfWeek": [1]
  }
}
HTTP 201
[Captures]
weekly_exception_id: jsonpath "$.id"
[Asserts]
jsonpath "$.recurring" == true
jsonpath "$.recurrencePattern.type" == "weekly"


# 3. Monthly recurring block on the 15th of each month.
POST {{api}}/booking/events/{{event_id}}/exceptions
Content-Type: application/json
{
  "startDatetime": "2026-06-15T15:00:00Z",
  "endDatetime": "2026-06-15T16:00:00Z",
  "reason": "Monthly review",
  "recurring": true,
  "recurrencePattern": {
    "type": "monthly",
    "interval": 1,
    "dayOfMonth": 15
  }
}
HTTP 201


# 4. List exceptions; should include all three.
GET {{api}}/booking/events/{{event_id}}/exceptions
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.pagination.totalCount" >= 3


# 5. Get single exception by id.
GET {{api}}/booking/events/{{event_id}}/exceptions/{{single_exception_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{single_exception_id}}"
jsonpath "$.reason" == "Conference"


# 6. Delete the weekly exception.
DELETE {{api}}/booking/events/{{event_id}}/exceptions/{{weekly_exception_id}}
HTTP 204


# 7. After deletion, total drops by one.
GET {{api}}/booking/events/{{event_id}}/exceptions
HTTP 200
[Asserts]
jsonpath "$.pagination.totalCount" >= 2
