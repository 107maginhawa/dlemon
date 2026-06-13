# E2 — dental_assistant clinical-assist workflow contract tests
#
# Proves the dental_assistant member_role round-trips through OpenAPI → validators
# → the member endpoints, and exercises the assistant-allowed clinical-write
# surfaces (capture imaging, chart-condition write, draft notes, attachment upload)
# end-to-end. The onboarding owner (dentist_owner) is also an allowed role for
# every one of these, so the owner-driven path proves the endpoints accept the
# expanded role set without contract drift.
#
# Note: the negative (assistant-DENIED) paths — sign notes / add treatment /
# finalize CBCT → 403 — are covered by the backend unit suite
# (dental-assistant.clinical-assist.test.ts), since a PIN-only assistant member
# has no cloud session to drive a denied request through the contract harness
# (same constraint documented in dental-treatment-coordinator.hurl).

# 0. Sign up as practice owner
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "asst-owner-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dr. Assistant Owner"
}
HTTP 200
[Captures]
session_token: cookie "better-auth.session_token"
user_id: jsonpath "$.user.id"


# 1. Self-service onboarding — caller becomes the org owner + dentist_owner member.
POST {{api}}/dental/onboarding
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "organizationName": "Assistant Test Clinic {{suffix}}",
  "tier": "clinic",
  "countryCode": "PH"
}
HTTP 201
[Captures]
org_id: jsonpath "$.organizationId"
branch_id: jsonpath "$.branchId"
dentist_member_id: jsonpath "$.membershipId"


# 2. Create a dental_assistant member — proves the enum value is accepted by the
# generated request validator and persisted by the DB enum.
POST {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}/members
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Assistant Aida",
  "role": "dental_assistant"
}
HTTP 201
[Captures]
assistant_member_id: jsonpath "$.id"
[Asserts]
jsonpath "$.role" == "dental_assistant"
jsonpath "$.status" == "active"


# 3. The dental_assistant role round-trips through list members.
GET {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}/members
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data[*].role" includes "dental_assistant"


# 4. Create a dental patient (branch-scoped).
POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Assistant Test Patient {{suffix}}",
  "consentGiven": true,
  "branchId": "{{branch_id}}"
}
HTTP 201
[Captures]
patient_id: jsonpath "$.id"


# 5. Capture imaging (createImagingStudy) — assistant-allowed surface; owner is
# also allowed → 201 with presigned upload URL. Proves the expanded role gate
# does not break the imaging-create contract.
POST {{api}}/dental/imaging/studies
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "branchId": "{{branch_id}}",
  "modality": "periapical",
  "filename": "pa-26.jpg",
  "mimeType": "image/jpeg",
  "size": 204800
}
HTTP 201
[Asserts]
jsonpath "$.study.id" isString
jsonpath "$.image.id" isString
jsonpath "$.uploadUrl" isString


# 6. Create + activate a visit (owner) to host the chart / notes / attachment writes.
POST {{api}}/dental/visits
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "branchId": "{{branch_id}}",
  "dentistMemberId": "{{dentist_member_id}}",
  "chiefComplaint": "Routine check"
}
HTTP 201
[Captures]
visit_id: jsonpath "$.id"

PATCH {{api}}/dental/visits/{{visit_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "active"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "active"


# 7. Chart-condition write (upsertDentalChart) — assistant-allowed surface.
POST {{api}}/dental/visits/{{visit_id}}/chart
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "{{patient_id}}",
  "teeth": [
    {"toothNumber": 26, "state": "caries", "surfaces": ["occlusal"], "conditionCode": "K02.0"}
  ]
}
HTTP 201
[Asserts]
jsonpath "$.visitId" == "{{visit_id}}"


# 8. DRAFT visit notes (upsertVisitNotes) — assistant-allowed surface. Signing
# stays dentist-only (deny path is unit-covered).
POST {{api}}/dental/visits/{{visit_id}}/notes
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "subjective": "Reports mild sensitivity",
  "objective": "Caries on #26 occlusal"
}
HTTP 201
[Asserts]
jsonpath "$.visitId" == "{{visit_id}}"


# 9. Upload attachment (createAttachment) — assistant-allowed surface.
POST {{api}}/dental/visits/{{visit_id}}/attachments
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "{{patient_id}}",
  "imageType": "photo",
  "fileName": "intraoral-26.jpg",
  "filePath": "/uploads/intraoral-26.jpg",
  "fileSizeBytes": 102400,
  "mimeType": "image/jpeg",
  "note": "Pre-op intraoral"
}
HTTP 201
[Asserts]
jsonpath "$.imageType" == "photo"
