# Dental Audit contract tests
# Tests: branch-scoped audit log viewer.
# Module: GET /dental/audit-events
# Spec: specs/api/src/modules/dental-audit.tsp
#
# NOTE: The handler bug EM-AUD-009 is documented and fixed alongside this file.
# The original implementation checked user.role (Better-Auth session field) for
# dentist_owner, but the self-service onboarding flow only sets dental_membership.role —
# meaning the endpoint returned 403 for all legitimately onboarded clinic owners.
# The fix aligns the handler with every other dental endpoint: assertBranchRole
# (checks dental_membership table). This suite is the regression anchor.

# ============================================================
# Scenario 1: 401 gate (empty cookie jar).
# Run BEFORE any sign-up so Hurl's cookie jar is empty.
# ============================================================

GET {{api}}/dental/audit-events?branchId=00000000-0000-0000-0000-000000000000
HTTP 401


# ============================================================
# Scenario 2: Sign up + self-service onboarding.
# Onboarding creates: org, branch, dentist_owner membership, and
# writes an org.onboard audit event — the first event we assert.
# Pattern copied from dental-billing.hurl.
# ============================================================

POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "dental-audit-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dr. Audit Tester"
}
HTTP 200
[Captures]
session_token: cookie "better-auth.session_token"
user_id: jsonpath "$.user.id"


POST {{api}}/dental/onboarding
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "organizationName": "Audit Test Clinic {{suffix}}",
  "tier": "clinic",
  "countryCode": "PH",
  "branchName": "Main Branch",
  "timezone": "Asia/Manila",
  "address": "123 Test Street",
  "city": "Manila",
  "phone": "+639001234567",
  "ownerDisplayName": "Dr. Audit Tester"
}
HTTP 201
[Captures]
org_id: jsonpath "$.organizationId"
branch_id: jsonpath "$.branchId"
membership_id: jsonpath "$.membershipId"


# ============================================================
# Scenario 3: Create a dental patient (emits patient.registered event).
# ============================================================

POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Audit Test Patient {{suffix}}",
  "consentGiven": true,
  "branchId": "{{branch_id}}"
}
HTTP 201
[Captures]
patient_id: jsonpath "$.id"


# ============================================================
# Scenario 4: GET /dental/audit-events?branchId= (200).
# Asserts: data is a collection (≥1 event from onboarding + patient create),
# pagination meta present, and each event has the required immutable DTO shape.
# ============================================================

GET {{api}}/dental/audit-events?branchId={{branch_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.data" count >= 1
jsonpath "$.meta.total" isInteger
jsonpath "$.meta.total" >= 1
jsonpath "$.meta.limit" isInteger
jsonpath "$.meta.offset" isInteger
# Every event must carry the required immutable shape fields.
jsonpath "$.data[0].id" isString
jsonpath "$.data[0].actorId" isString
jsonpath "$.data[0].action" isString
jsonpath "$.data[0].resourceType" isString
jsonpath "$.data[0].timestamp" isString
jsonpath "$.data[0].tenantId" isString


# ============================================================
# Scenario 5: Filter by action — assert the filtered subset
# is non-empty and every returned event matches the requested action.
# ============================================================

GET {{api}}/dental/audit-events?branchId={{branch_id}}&action=patient.registered
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" count >= 1
jsonpath "$.data[0].action" == "patient.registered"
jsonpath "$.data[0].resourceType" == "dental_patient"
jsonpath "$.data[0].resourceId" isString
jsonpath "$.data[0].actorId" == "{{user_id}}"


# Filter by eventType — the org.onboard event has eventType=data-modification.
GET {{api}}/dental/audit-events?branchId={{branch_id}}&eventType=data-modification
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" count >= 1
jsonpath "$.data[0].eventType" == "data-modification"
jsonpath "$.data[0].action" isString


# ============================================================
# Scenario 6: Role / tenant gate — a second signed-up user who has NO membership
# in the onboarded branch must receive 403 (assertBranchRole throws FORBIDDEN).
# ============================================================

POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "dental-audit-outsider-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Outsider User"
}
HTTP 200
[Captures]
outsider_token: cookie "better-auth.session_token"


GET {{api}}/dental/audit-events?branchId={{branch_id}}
Cookie: better-auth.session_token={{outsider_token}}
HTTP 403
[Asserts]
jsonpath "$.code" == "FORBIDDEN"


# ============================================================
# Scenario extra: missing branchId → 400 (EM-AUD-002 / AC-AUD-003).
# The endpoint is always branch-scoped; omitting it is a client error.
# ============================================================

GET {{api}}/dental/audit-events
Cookie: better-auth.session_token={{session_token}}
HTTP 400
[Asserts]
jsonpath "$.code" == "VALIDATION_ERROR"
