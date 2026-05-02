# Person creation validation. Asserts that the wire-level field-error
# envelope is consistent: 400 status, top-level `code`, `message`, plus
# `fieldErrors[]` carrying per-field details. These shapes are part of
# the contract — every impl must enforce the same constraints.

POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "person-val-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Person Val"
}
HTTP 200


# 1. Missing required fields → 400 with VALIDATION_ERROR.
POST {{api}}/persons
Content-Type: application/json
{}
HTTP 400
[Asserts]
jsonpath "$.code" == "VALIDATION_ERROR"
jsonpath "$.statusCode" == 400
jsonpath "$.message" exists
jsonpath "$.fieldErrors" isCollection
jsonpath "$.requestId" exists
jsonpath "$.timestamp" exists
jsonpath "$.path" exists
jsonpath "$.method" == "POST"


# 2. Empty firstName violates minLength(1).
POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "",
  "lastName": "Doe",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 400
[Asserts]
jsonpath "$.code" == "VALIDATION_ERROR"


# 3. Empty lastName when provided.
POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Jane",
  "lastName": "",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 400


# 4. Invalid timezone (not IANA Region/City).
POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "languagesSpoken": ["en"],
  "timezone": "NotARealZone"
}
HTTP 400


# 5. Pre-1900 date of birth.
POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "dateOfBirth": "1815-12-10",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 400


# 6. Invalid gender enum value.
POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "gender": "alien",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 400


# 7. Invalid language code.
POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "languagesSpoken": ["xx"],
  "timezone": "America/New_York"
}
HTTP 400


# 8. Successfully create with international fields & special chars.
POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Anaïs",
  "lastName": "O'Connor-Müller",
  "middleName": "García",
  "languagesSpoken": ["en", "es", "fr"],
  "timezone": "Europe/London"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 9. /persons/me returns the authenticated user's person.
GET {{api}}/persons/me
HTTP 200
[Asserts]
jsonpath "$.id" == "{{person_id}}"


# 10. 404 for non-existent UUID.
GET {{api}}/persons/00000000-0000-4000-8000-000000000000
HTTP 404
[Asserts]
jsonpath "$.code" == "NOT_FOUND"


# 11. 400 for malformed UUID path param.
GET {{api}}/persons/not-a-uuid
HTTP 400
