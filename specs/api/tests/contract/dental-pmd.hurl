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


# 0a. Create a dental organization
POST {{api}}/dental/organizations
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "name": "PMD Test Clinic {{suffix}}",
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


# 0c. Create branch membership for this user (grants branch access)
POST {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}/members
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Dr. PMD Tester",
  "role": "dentist_owner",
  "personId": "{{user_id}}"
}
HTTP 201
[Captures]
dentist_member_id: jsonpath "$.id"


# 0d. Create dental patient 1 (primary)
POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "PMD Test Patient {{suffix}}",
  "consentGiven": true,
  "branchId": "{{branch_id}}"
}
HTTP 201
[Captures]
patient_id: jsonpath "$.id"


# 0e. Create dental patient 2 (for draft visit negative test)
POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "PMD Draft Patient {{suffix}}",
  "consentGiven": true,
  "branchId": "{{branch_id}}"
}
HTTP 201
[Captures]
patient_id_2: jsonpath "$.id"


# 1. Create a dental visit
POST {{api}}/dental/visits
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "branchId": "{{branch_id}}",
  "dentistMemberId": "{{dentist_member_id}}"
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
  "patientId": "{{patient_id}}",
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
  "patientId": "{{patient_id}}"
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
  "patientId": "{{patient_id_2}}",
  "branchId": "{{branch_id}}",
  "dentistMemberId": "{{dentist_member_id}}"
}
HTTP 201
[Captures]
draft_visit_id: jsonpath "$.id"

POST {{api}}/dental/visits/{{draft_visit_id}}/pmd
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{draft_visit_id}}",
  "patientId": "{{patient_id_2}}"
}
HTTP 400


# 8. List PMDs for patient
GET {{api}}/dental/visits/pmd?patientId={{patient_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" count >= 1


# ============================================================
# IMPORTED PMDs
# ============================================================

# 9. Import an external PMD
POST {{api}}/dental/pmd/import
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
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
GET {{api}}/dental/pmd/imported?patientId={{patient_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" count >= 1


# 11. Missing patientId query param for listPMDs
GET {{api}}/dental/visits/pmd
Cookie: better-auth.session_token={{session_token}}
HTTP 400
