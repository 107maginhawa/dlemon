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


# 0a. Self-service onboarding — provisions org + default branch + owner membership
# in one call (replaces the old org→branch→member setup; the caller becomes the org
# owner + a dentist_owner member, so the rest of the suite runs on the user's token).
POST {{api}}/dental/onboarding
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "organizationName": "PMD Test Clinic {{suffix}}",
  "tier": "clinic",
  "countryCode": "PH",
  "branchName": "Main Branch",
  "timezone": "Asia/Manila",
  "address": "123 Test Street",
  "city": "Manila",
  "phone": "+639001234567",
  "ownerDisplayName": "Dr. PMD Tester"
}
HTTP 201
[Captures]
org_id: jsonpath "$.organizationId"
branch_id: jsonpath "$.branchId"
dentist_member_id: jsonpath "$.membershipId"


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
[Captures]
treatment_id: jsonpath "$.id"


# 3a. Create a consent form for the visit (required to mark a treatment performed
#     and to complete the visit — hard completion gates).
POST {{api}}/dental/visits/{{visit_id}}/consents
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "{{patient_id}}",
  "templateId": "tmpl-restorative",
  "templateName": "Restorative Consent"
}
HTTP 201
[Captures]
consent_id: jsonpath "$.id"


# 3b. Sign the consent form
POST {{api}}/dental/visits/{{visit_id}}/consents/{{consent_id}}/sign
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "signatureData": "data:image/png;base64,iVBORw0KGgo="
}
HTTP 200
[Asserts]
jsonpath "$.signed" == true


# 3c. Advance treatment diagnosed → planned (two-step state machine)
PATCH {{api}}/dental/visits/{{visit_id}}/treatments/{{treatment_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "planned"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "planned"


# 3d. Advance treatment planned → performed (requires signed consent)
PATCH {{api}}/dental/visits/{{visit_id}}/treatments/{{treatment_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "performed"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "performed"


# 4. Complete the visit (no open treatments, signed consent present)
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
HTTP 422
[Asserts]
jsonpath "$.code" == "VISIT_NOT_COMPLETED"


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
  "sourceDescription": "Open Dental v21.1",
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


# ============================================================
# NEW: G2.5-S6 — imported PMD get by ID, visit PMD export
# ============================================================

# NEW: G2.5-S6 — get imported PMD by ID
GET {{api}}/dental/pmd/imported/{{imported_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{imported_id}}"
jsonpath "$.sourceFacility" isString


# NEW: G2.5-S6 — export PMD from visit (download as file)
GET {{api}}/dental/visits/{{visit_id}}/pmd/export
Cookie: better-auth.session_token={{session_token}}
HTTP 200


# ------------------------------------------------------------
# AUTH CHECKS (run last). Sign out first so hurl's cookie store
# is cleared (Set-Cookie Max-Age=0); the requests below carry no
# session and must be rejected with 401.
# ------------------------------------------------------------
POST {{api}}/auth/sign-out
Cookie: better-auth.session_token={{session_token}}
Origin: {{api}}
Content-Type: application/json
{}
HTTP 200


# NEW: G2.5-S6 — imported PMD auth check
GET {{api}}/dental/pmd/imported/{{imported_id}}
HTTP 401


# NEW: G2.5-S6 — visit PMD export auth check
GET {{api}}/dental/visits/{{visit_id}}/pmd/export
HTTP 401
