# E1 — treatment_coordinator role + case-presentation surface contract tests
#
# Proves the new member_role enum value round-trips through OpenAPI → validators →
# the member endpoints, and exercises the treatment-presentation surface as an
# allowed presenter (the onboarding owner = dentist_owner, a presenter role).
#
# Note: the negative (denied-role) path is covered by the backend unit suite
# (case-presentation.test.ts → staff_scheduling 403), since PIN-only staff have
# no cloud session to drive a denied request through the contract harness.

# 0. Sign up as practice owner
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "tc-owner-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dr. Coordinator Owner"
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
  "organizationName": "Coordinator Test Clinic {{suffix}}",
  "tier": "clinic",
  "countryCode": "PH"
}
HTTP 201
[Captures]
org_id: jsonpath "$.organizationId"
branch_id: jsonpath "$.branchId"
dentist_member_id: jsonpath "$.membershipId"


# 2. Create a treatment_coordinator member — proves the new enum value is accepted
# by the generated request validator and persisted by the DB enum (migration 0090).
POST {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}/members
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Coordinator Carla",
  "role": "treatment_coordinator"
}
HTTP 201
[Captures]
coordinator_member_id: jsonpath "$.id"
[Asserts]
jsonpath "$.role" == "treatment_coordinator"
jsonpath "$.status" == "active"


# 3. The coordinator role round-trips through list members.
GET {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}/members
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data[*].role" includes "treatment_coordinator"


# 4. Create a patient (branch-scoped).
POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Coordinator Test Patient {{suffix}}",
  "consentGiven": true,
  "branchId": "{{branch_id}}"
}
HTTP 201
[Captures]
patient_id: jsonpath "$.id"


# 5. Create a plan-header treatment plan (draft).
POST {{api}}/dental/patients/{{patient_id}}/treatment-plans
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "providerId": "{{user_id}}",
  "totalEstimateCents": 50000
}
HTTP 201
[Captures]
plan_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "draft"


# 6. Present the plan (draft → presented). E1: the presented transition is gated to
# clinicians + treatment_coordinator; the owner is a presenter → 200.
PATCH {{api}}/dental/patients/{{patient_id}}/treatment-plans/{{plan_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "presented"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "presented"


# 7. Mint a patient-facing case presentation from the presented plan (allowed
# presenter → 201). Exercises the createCasePresentation role gate end-to-end.
POST {{api}}/dental/patients/{{patient_id}}/case-presentations
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "treatmentPlanId": "{{plan_id}}"
}
HTTP 201
[Captures]
presentation_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "draft"
jsonpath "$.treatmentPlanId" == "{{plan_id}}"


# 8. List case presentations (broad read set; owner allowed → 200).
GET {{api}}/dental/patients/{{patient_id}}/case-presentations
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$" isCollection
jsonpath "$[0].id" == "{{presentation_id}}"


# 9. Case-presentation create requires auth (Bearer override beats the cookie → 401).
POST {{api}}/dental/patients/{{patient_id}}/case-presentations
Authorization: Bearer invalid-no-session
Content-Type: application/json
{
  "treatmentPlanId": "{{plan_id}}"
}
HTTP 401
