# Dental Patient contract tests
# Tests register patient, search, get profile, update dental fields, archive.
# Uses the existing /patients API extended with dental-specific fields.

# 0. Sign up as a user (required for auth)
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "dental-patient-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dr. Dental Tester"
}
HTTP 200
[Captures]
session_token: cookie "better-auth.session_token"


# 1. Register a dental patient (FHIR-aligned CreatePatientRequest)
POST {{api}}/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "name": [{"use": "official", "family": "Santos", "given": ["Maria"]}],
  "birthDate": "1985-06-15",
  "gender": "female"
}
HTTP 201
[Captures]
patient_id: jsonpath "$.id"
[Asserts]
jsonpath "$.id" isString


# 2. Get patient profile
GET {{api}}/patients/{{patient_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{patient_id}}"


# 3. Update dental-specific fields
PATCH {{api}}/patients/{{patient_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "dentalHistorySummary": "Mild gingivitis. Scaling done annually.",
  "needsFollowUp": true
}
HTTP 200
[Asserts]
jsonpath "$.dentalHistorySummary" == "Mild gingivitis. Scaling done annually."
jsonpath "$.needsFollowUp" == true


# 4. List patients with needsFollowUp filter
GET {{api}}/patients?needsFollowUp=true
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# 5. Deactivate (archive) patient — no active payment plan, should succeed
DELETE {{api}}/patients/{{patient_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 204
