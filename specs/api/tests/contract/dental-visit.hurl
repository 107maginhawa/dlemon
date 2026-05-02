# Dental Visit & Chart contract tests
# Tests: create visit (draft), update to active, upsert chart, update tooth,
# add treatment, update treatment, add notes, lock visit, tooth history.

# 0. Sign up as a user
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "dental-visit-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dr. Visit Tester"
}
HTTP 200
[Captures]
session_token: cookie "better-auth.session_token"
user_id: jsonpath "$.user.id"


# 1. Create a dental visit (draft)
POST {{api}}/dental/visits
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "f0000000-0000-4000-8000-000000000001",
  "branchId": "f0000000-0000-4000-8000-000000000002",
  "dentistMemberId": "f0000000-0000-4000-8000-000000000003",
  "chiefComplaint": "Toothache upper left"
}
HTTP 201
[Captures]
visit_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "draft"
jsonpath "$.chiefComplaint" == "Toothache upper left"
jsonpath "$.patientId" == "f0000000-0000-4000-8000-000000000001"


# 2. List visits (filter by patient)
GET {{api}}/dental/visits?patientId=f0000000-0000-4000-8000-000000000001
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.items" count >= 1


# 3. Get visit by id
GET {{api}}/dental/visits/{{visit_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{visit_id}}"
jsonpath "$.status" == "draft"


# 4. Activate visit (draft → active)
PATCH {{api}}/dental/visits/{{visit_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "active"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "active"
jsonpath "$.activatedAt" isString


# 5. Upsert dental chart for the visit
POST {{api}}/dental/visits/{{visit_id}}/chart
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "f0000000-0000-4000-8000-000000000001",
  "teeth": [
    {"toothNumber": 11, "state": "healthy"},
    {"toothNumber": 26, "state": "caries", "surfaces": ["mesial", "occlusal"], "conditionCode": "K02.0"},
    {"toothNumber": 36, "state": "filled", "surfaces": ["occlusal"]}
  ]
}
HTTP 201
[Captures]
chart_id: jsonpath "$.id"
[Asserts]
jsonpath "$.visitId" == "{{visit_id}}"
jsonpath "$.teeth" count == 3


# 6. Get chart
GET {{api}}/dental/visits/{{visit_id}}/chart
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.visitId" == "{{visit_id}}"
jsonpath "$.teeth" count == 3


# 7. Update a single tooth
PATCH {{api}}/dental/visits/{{visit_id}}/chart/teeth/26
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "toothNumber": 26,
  "state": "filled",
  "surfaces": ["mesial"],
  "conditionCode": "K02.0"
}
HTTP 200
[Asserts]
jsonpath "$.visitId" == "{{visit_id}}"


# 8. Add a treatment
POST {{api}}/dental/visits/{{visit_id}}/treatments
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "f0000000-0000-4000-8000-000000000001",
  "cdtCode": "D2391",
  "description": "Resin composite, one surface, posterior",
  "toothNumber": 26,
  "surfaces": ["mesial"],
  "priceCents": 15000
}
HTTP 201
[Captures]
treatment_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "diagnosed"
jsonpath "$.cdtCode" == "D2391"
jsonpath "$.priceCents" == 15000


# 9. List treatments for visit
GET {{api}}/dental/visits/{{visit_id}}/treatments
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.items" count >= 1


# 10. Update treatment to performed
PATCH {{api}}/dental/visits/{{visit_id}}/treatments/{{treatment_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "performed"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "performed"


# 11. Upsert visit notes (SOAP)
POST {{api}}/dental/visits/{{visit_id}}/notes
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "subjective": "Patient reports pain on upper left molar",
  "objective": "Visible caries on #26 mesial surface",
  "assessment": "Class II caries",
  "plan": "Resin composite restoration",
  "notes": "Patient was cooperative"
}
HTTP 201
[Captures]
notes_id: jsonpath "$.id"
[Asserts]
jsonpath "$.visitId" == "{{visit_id}}"
jsonpath "$.subjective" == "Patient reports pain on upper left molar"


# 12. Get visit notes
GET {{api}}/dental/visits/{{visit_id}}/notes
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.visitId" == "{{visit_id}}"


# 13. Complete visit
PATCH {{api}}/dental/visits/{{visit_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "completed"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "completed"
jsonpath "$.completedAt" isString


# 14. Lock visit
PATCH {{api}}/dental/visits/{{visit_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "locked"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "locked"
jsonpath "$.lockedAt" isString
