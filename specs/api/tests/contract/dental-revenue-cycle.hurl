# P1-26 — Insurance / Revenue-Cycle (PH HMO) contract tests
#
# Covers: PH insurance profile, coverage authorization (LOA) create + FSM
# approval, read-only coverage estimate (200), invoice-anchored claim create,
# claim FSM transition + FSM-violation (422), remittance posting, AR-by-payer
# aging, and cross-tenant 404 isolation on a claim read.

# 0. Sign up (tenant A)
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "dental-revenue-cycle-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dr. Revenue Cycle"
}
HTTP 200
[Captures]
session_token: cookie "better-auth.session_token"
user_id: jsonpath "$.user.id"


# 0a. Self-service onboarding — org + default branch + owner membership in one call
# (replaces the old org→branch→member setup; caller becomes owner + dentist_owner).
POST {{api}}/dental/onboarding
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{ "organizationName": "RC Clinic {{suffix}}", "tier": "clinic", "countryCode": "PH", "branchName": "Main Branch", "timezone": "Asia/Manila", "city": "Manila", "ownerDisplayName": "Dr. Revenue Cycle" }
HTTP 201
[Captures]
org_id: jsonpath "$.organizationId"
branch_id: jsonpath "$.branchId"
dentist_member_id: jsonpath "$.membershipId"


# 0d. Patient (branchId sets preferredBranchId → drives branch-access checks)
POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{ "displayName": "RC Patient {{suffix}}", "branchId": "{{branch_id}}", "dateOfBirth": "1990-01-01", "consentGiven": true }
HTTP 201
[Captures]
patient_id: jsonpath "$.id"


# 1. Create a PH HMO insurance profile (payerType + annualLimit additive cols)
POST {{api}}/dental/patients/{{patient_id}}/insurance-profiles
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "insurerName": "Maxicare",
  "policyNumber": "MX-{{suffix}}",
  "subscriberName": "RC Patient",
  "payerType": "hmo",
  "annualLimitCents": 500000
}
HTTP 201
[Captures]
profile_id: jsonpath "$.id"
[Asserts]
jsonpath "$.payerType" == "hmo"
jsonpath "$.annualLimitCents" == 500000


# 2. Capture a coverage authorization (LOA) — created in 'requested'
POST {{api}}/dental/patients/{{patient_id}}/authorizations
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{ "insuranceProfileId": "{{profile_id}}", "loaNumber": "LOA-{{suffix}}" }
HTTP 201
[Captures]
auth_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "requested"


# 2a. Approve the LOA (FSM: requested → approved) with a covered procedure
PATCH {{api}}/dental/patients/{{patient_id}}/authorizations/{{auth_id}}/status
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{ "status": "approved", "approvedAmountCents": 200000 }
HTTP 200
[Asserts]
jsonpath "$.status" == "approved"


# 2a-list. The per-patient LOA list returns the authorization we just created.
GET {{api}}/dental/patients/{{patient_id}}/authorizations
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$" count == 1
jsonpath "$[0].id" == "{{auth_id}}"
jsonpath "$[0].status" == "approved"
jsonpath "$[0].loaNumber" == "LOA-{{suffix}}"


# 2b. FSM violation: requested → expired is illegal (already approved) → 422
PATCH {{api}}/dental/patients/{{patient_id}}/authorizations/{{auth_id}}/status
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{ "status": "requested" }
HTTP 422


# 3. Read-only coverage estimate (no persistence) → 200
POST {{api}}/dental/billing/estimate
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "insuranceProfileId": "{{profile_id}}",
  "authorizationId": "{{auth_id}}",
  "lines": [
    { "cdtCode": "D1110", "billedAmountCents": 100000 },
    { "cdtCode": "D2740", "billedAmountCents": 800000 }
  ]
}
HTTP 200
[Asserts]
jsonpath "$.estimatedCoveredCents" >= 0
jsonpath "$.estimatedPatientPortionCents" >= 0
jsonpath "$.estimatedBilledCents" == 900000


# 4. Create an invoice-anchored multi-line claim (inline lines)
POST {{api}}/dental/billing/claims
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "insuranceProfileId": "{{profile_id}}",
  "authorizationId": "{{auth_id}}",
  "lines": [
    { "cdtCode": "D1110", "description": "Prophylaxis", "billedAmountCents": 100000 },
    { "cdtCode": "D2740", "description": "Crown", "billedAmountCents": 800000 }
  ]
}
HTTP 201
[Captures]
claim_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "draft"
jsonpath "$.billedAmountCents" == 900000


# 5. List the claim worklist (branch-scoped)
GET {{api}}/dental/billing/claims?branchId={{branch_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.total" >= 1


# 6. Get the claim with lines
GET {{api}}/dental/billing/claims/{{claim_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Captures]
line_id: jsonpath "$.lines[0].id"
[Asserts]
jsonpath "$.lines" count == 2
jsonpath "$.lines[0].id" isString


# 7. FSM violation: draft → paid is illegal → 422
PATCH {{api}}/dental/billing/claims/{{claim_id}}/status
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{ "status": "paid" }
HTTP 422


# 8. Valid FSM: draft → ready
PATCH {{api}}/dental/billing/claims/{{claim_id}}/status
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{ "status": "ready" }
HTTP 200
[Asserts]
jsonpath "$.status" == "ready"


# 9. Submit (mark submitted + attach payer reference)
PATCH {{api}}/dental/billing/claims/{{claim_id}}/status
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{ "status": "submitted", "submissionChannel": "portal", "payerReference": "MX-REF-{{suffix}}" }
HTTP 200
[Asserts]
jsonpath "$.status" == "submitted"


# 9a. Plan 015 S4b — CLAIM_IMMUTABLE deny (plan 014 S1 guard). The claim is now
# `submitted`, so the clinic-controlled billed fields (billedAmountCents/description)
# are frozen on every line. updateInsuranceClaimLine rejects a billed-field edit
# with 422 CLAIM_IMMUTABLE (payer-decision fields like status stay editable). Runs
# BEFORE the tenant-B signup below — that signup repopulates libcurl's cookie jar,
# so any later {{session_token}} request would be hijacked to tenant B.
PATCH {{api}}/dental/billing/claims/{{claim_id}}/lines/{{line_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{ "billedAmountCents": 999999 }
HTTP 422
[Asserts]
jsonpath "$.code" == "CLAIM_IMMUTABLE"


# 10. Post an HMO remittance (payer pays part, no over-post)
POST {{api}}/dental/billing/claims/{{claim_id}}/remittance
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{ "amountCents": 200000, "remittanceReference": "RA-{{suffix}}", "method": "bank_transfer" }
HTTP 201
[Asserts]
jsonpath "$.payerPayment.amountCents" == 200000


# 11. Over-post is rejected → 422
POST {{api}}/dental/billing/claims/{{claim_id}}/remittance
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{ "amountCents": 9000000, "remittanceReference": "RA-OVER-{{suffix}}" }
HTTP 422


# 12. AR-by-payer aging (branch-scoped) → 200
GET {{api}}/dental/billing/claims/aging?branchId={{branch_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.summary.payerCount" >= 0


# ---------------------------------------------------------------------------
# Cross-tenant isolation: tenant B cannot read tenant A's claim → 404
# ---------------------------------------------------------------------------
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "rc-other-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dr. Other Tenant"
}
HTTP 200
[Captures]
other_token: cookie "better-auth.session_token"


# Tenant B reads tenant A's claim → 404 (never reveals existence)
GET {{api}}/dental/billing/claims/{{claim_id}}
Cookie: better-auth.session_token={{other_token}}
HTTP 404


# Plan 015 S4b (cross-tenant): tenant B edits tenant A's claim LINE → 404.
# updateInsuranceClaimLine catches assertBranchAccess's ForbiddenError and rethrows
# NotFound, so the line's existence is never revealed. The FE claim-line editor
# consumes updateInsuranceClaimLine; this is the FE-reachable IDOR deny pin.
PATCH {{api}}/dental/billing/claims/{{claim_id}}/lines/{{line_id}}
Cookie: better-auth.session_token={{other_token}}
Content-Type: application/json
{ "status": "covered" }
HTTP 404
