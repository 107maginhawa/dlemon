# Dental PMD contract tests
# Tests: generate PMD from completed visit, get PMD, list PMDs,
#        import external PMD, list imported PMDs.

# 0. Sign up
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "dental-pmd-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dr. PMD Tester"
}
HTTP 200
[Captures]
session_token: cookie "better-auth.session_token"
user_id: jsonpath "$.user.id"


# 1. Create a dental visit
POST {{api}}/dental/visits
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "f2000000-0000-4000-8000-000000000001",
  "branchId": "f2000000-0000-4000-8000-000000000002",
  "dentistMemberId": "f2000000-0000-4000-8000-000000000003"
}
HTTP 201
[Captures]
visit_id: jsonpath "$.id"


# 2. Activate the visit
PATCH {{api}}/dental/visits/{{visit_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "active"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "active"


# 3. Add a treatment (so PMD has content)
POST {{api}}/dental/visits/{{visit_id}}/treatments
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "f2000000-0000-4000-8000-000000000001",
  "cdtCode": "D2391",
  "description": "Resin composite",
  "toothNumber": 21,
  "priceCents": 15000
}
HTTP 201


# 4. Complete the visit
PATCH {{api}}/dental/visits/{{visit_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "completed"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "completed"


# 5. Generate PMD from completed visit
POST {{api}}/dental/visits/{{visit_id}}/pmd
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "f2000000-0000-4000-8000-000000000001"
}
HTTP 201
[Captures]
pmd_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "generated"
jsonpath "$.visitId" == "{{visit_id}}"
jsonpath "$.checksum" != ""
jsonpath "$.content" != ""


# 6. Get PMD for visit
GET {{api}}/dental/visits/{{visit_id}}/pmd
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{pmd_id}}"
jsonpath "$.status" == "generated"


# 7. Cannot generate PMD from a draft visit
POST {{api}}/dental/visits
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "f2000000-0000-4000-8000-000000000004",
  "branchId": "f2000000-0000-4000-8000-000000000002",
  "dentistMemberId": "f2000000-0000-4000-8000-000000000003"
}
HTTP 201
[Captures]
draft_visit_id: jsonpath "$.id"

POST {{api}}/dental/visits/{{draft_visit_id}}/pmd
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{draft_visit_id}}",
  "patientId": "f2000000-0000-4000-8000-000000000004"
}
HTTP 400


# 8. List PMDs for patient
GET {{api}}/dental/visits/pmd?patientId=f2000000-0000-4000-8000-000000000001
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.items" count >= 1


# ============================================================
# IMPORTED PMDs
# ============================================================

# 9. Import an external PMD
POST {{api}}/dental/pmd/import
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "f2000000-0000-4000-8000-000000000001",
  "sourceFacility": "City Dental Clinic",
  "sourceReference": "REF-2025-001",
  "content": "{\"conditions\":[\"I10\"],\"medications\":[\"Amoxicillin\"]}"
}
HTTP 201
[Captures]
imported_id: jsonpath "$.id"
[Asserts]
jsonpath "$.sourceFacility" == "City Dental Clinic"
jsonpath "$.safetyFloorMerged" == false
jsonpath "$.importedAt" != null


# 10. List imported PMDs for patient
GET {{api}}/dental/pmd/imported?patientId=f2000000-0000-4000-8000-000000000001
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.items" count >= 1


# 11. Missing patientId query param for listPMDs
GET {{api}}/dental/visits/pmd
Cookie: better-auth.session_token={{session_token}}
HTTP 400
