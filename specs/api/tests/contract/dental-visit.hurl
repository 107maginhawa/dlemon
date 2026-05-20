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


# 0a. Create a dental organization
POST {{api}}/dental/organizations
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "name": "Visit Test Clinic {{suffix}}",
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
  "displayName": "Visit Test Patient {{suffix}}",
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
  "displayName": "Dr. Visit Tester",
  "role": "dentist_owner",
  "personId": "{{user_id}}"
}
HTTP 201
[Captures]
dentist_member_id: jsonpath "$.id"


# 1. Create a dental visit (draft)
POST {{api}}/dental/visits
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "branchId": "{{branch_id}}",
  "dentistMemberId": "{{dentist_member_id}}",
  "chiefComplaint": "Toothache upper left"
}
HTTP 201
[Captures]
visit_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "draft"
jsonpath "$.chiefComplaint" == "Toothache upper left"
jsonpath "$.patientId" == "{{patient_id}}"


# 2. List visits (filter by patient)
GET {{api}}/dental/visits?branchId={{branch_id}}&patientId={{patient_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" count >= 1


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
  "patientId": "{{patient_id}}",
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
  "patientId": "{{patient_id}}",
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
jsonpath "$.data" count >= 1


# 9a. Plan treatment (diagnosed → planned)
PATCH {{api}}/dental/visits/{{visit_id}}/treatments/{{treatment_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "planned"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "planned"


# 10. Update treatment to performed (planned → performed)
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


# NEW: G2-S4 — create a second visit to test notes amendment (upsert idempotency)
POST {{api}}/dental/visits
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "branchId": "{{branch_id}}",
  "dentistMemberId": "{{dentist_member_id}}",
  "chiefComplaint": "Follow-up check"
}
HTTP 201
[Captures]
visit2_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "draft"


# NEW: G2-S4 — activate the second visit
PATCH {{api}}/dental/visits/{{visit2_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "active"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "active"


# NEW: G2-S4 — upsert notes (first time) on second visit
POST {{api}}/dental/visits/{{visit2_id}}/notes
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit2_id}}",
  "subjective": "Patient reports mild sensitivity",
  "objective": "Slight gingival inflammation",
  "assessment": "Gingivitis",
  "plan": "Improved oral hygiene instructions",
  "notes": "Advised daily flossing"
}
HTTP 201
[Asserts]
jsonpath "$.visitId" == "{{visit2_id}}"
jsonpath "$.subjective" == "Patient reports mild sensitivity"


# NEW: G2-S4 — visit notes amendment (upsert a second time with updated SOAP content)
# The notes endpoint is idempotent per visit; a second POST should update the content.
POST {{api}}/dental/visits/{{visit2_id}}/notes
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit2_id}}",
  "subjective": "Patient reports sensitivity resolved",
  "objective": "No visible inflammation",
  "assessment": "Resolved gingivitis",
  "plan": "Follow up in 3 months",
  "notes": "Patient responded well to hygiene instructions"
}
HTTP 201
[Asserts]
jsonpath "$.visitId" == "{{visit2_id}}"
jsonpath "$.subjective" == "Patient reports sensitivity resolved"


# NEW: G2-S4 — GET notes after amendment reflects updated content
GET {{api}}/dental/visits/{{visit2_id}}/notes
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.visitId" == "{{visit2_id}}"
jsonpath "$.subjective" == "Patient reports sensitivity resolved"
