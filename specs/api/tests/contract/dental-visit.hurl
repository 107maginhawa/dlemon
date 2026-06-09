# Dental Visit & Chart contract tests
# Tests: create visit (draft), update to active, upsert chart, update tooth,
# add treatment, update treatment, add notes, lock visit, tooth history.

# G2.5-S6 — tooth history auth check.
# Run BEFORE any sign-up so Hurl's cookie jar is empty (Hurl resends the
# session cookie automatically once it has been set, so an unauthenticated
# request must precede the sign-up to truly exercise the 401 path). The
# patientId is a throwaway UUID — auth middleware rejects before the handler runs.
GET {{api}}/dental/visits/history/00000000-0000-0000-0000-000000000000/teeth/36
HTTP 401


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


# 0a. Self-service onboarding — provisions org + default branch + owner membership
# in one call (replaces the old org→branch→member setup; the caller becomes the org
# owner + a dentist_owner member, so the rest of the suite runs on the user's token).
POST {{api}}/dental/onboarding
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "organizationName": "Visit Test Clinic {{suffix}}",
  "tier": "clinic",
  "countryCode": "PH",
  "branchName": "Main Branch",
  "timezone": "Asia/Manila",
  "address": "123 Test Street",
  "city": "Manila",
  "phone": "+639001234567",
  "ownerDisplayName": "Dr. Visit Tester"
}
HTTP 201
[Captures]
org_id: jsonpath "$.organizationId"
branch_id: jsonpath "$.branchId"
dentist_member_id: jsonpath "$.membershipId"


# 0b. Create a dental patient
POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Visit Test Patient {{suffix}}",
  "consentGiven": true,
  "branchId": "{{branch_id}}"
}
HTTP 201
[Captures]
patient_id: jsonpath "$.id"


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


# 8a. Fee schedule DRIVES treatment pricing (dental-org G2 / AC-ORG-002).
# Set a per-branch override for a catalog CDT via the dedicated endpoint, then
# create a treatment with NO priceCents — the handler must default it from the
# fee schedule. D1110 is in the global procedure catalog (seeded on boot).
PATCH {{api}}/dental/fee-schedule/D1110
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "branchId": "{{branch_id}}",
  "priceCents": 33300
}
HTTP 200
[Asserts]
jsonpath "$.data.cdtCode" == "D1110"
jsonpath "$.data.priceCents" == 33300

# 8b. Create a treatment WITHOUT priceCents → defaults to the configured fee.
POST {{api}}/dental/visits/{{visit_id}}/treatments
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "{{patient_id}}",
  "cdtCode": "D1110",
  "description": "Adult prophylaxis"
}
HTTP 201
[Captures]
fee_default_treatment_id: jsonpath "$.id"
[Asserts]
jsonpath "$.cdtCode" == "D1110"
jsonpath "$.priceCents" == 33300

# 8c. Dismiss the fee-default treatment so it does not block visit completion
# below (this scenario only exists to prove fee-driven pricing).
PATCH {{api}}/dental/visits/{{visit_id}}/treatments/{{fee_default_treatment_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "dismissed",
  "dismissReason": "fee-default contract probe"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "dismissed"


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


# 9b. Create a consent form for the visit (required before performing a treatment
# and before completing the visit — P0-003 / VISIT_CONSENT_REQUIRED gate).
POST {{api}}/dental/visits/{{visit_id}}/consents
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "{{patient_id}}",
  "templateId": "tmpl-restorative",
  "templateName": "Restorative Treatment Consent",
  "procedureNature": "Resin composite restoration on tooth #26",
  "benefits": "Restores tooth structure and function",
  "risks": "Post-operative sensitivity",
  "alternatives": "No treatment, extraction",
  "risksOfNonTreatment": "Progression of caries, possible pulp involvement"
}
HTTP 201
[Captures]
consent_id: jsonpath "$.id"
[Asserts]
jsonpath "$.visitId" == "{{visit_id}}"
jsonpath "$.signed" == false


# 9c. Sign the consent form (satisfies the signed-consent gate)
POST {{api}}/dental/visits/{{visit_id}}/consents/{{consent_id}}/sign
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "signatureData": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
}
HTTP 200
[Asserts]
jsonpath "$.signed" == true


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


# ============================================================
# NEW: G2.5-S6 — visit history by tooth
# ============================================================

# NEW: G2.5-S6 — get tooth history for patient (tooth 36 as example)
GET {{api}}/dental/visits/history/{{patient_id}}/teeth/36
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.pagination" isCollection


# ============================================================
# E3 — hygienist-led HYGIENE visits (visitType scoping)
# ============================================================
# The contract suite runs as the org owner (dentist_owner); PIN-only context
# roles (hygienist) have no cloud session, so the hygienist DENY paths are
# covered by the backend unit suite (hygienist.hygiene-visit.test.ts). Here we
# pin the wire contract: a hygiene-typed visit can be created, round-trips its
# visitType, and its notes can be signed.

# E3-0 — fresh patient for the hygiene flow (the original patient already has an
# active visit; the active-visit guard would 409 a second create).
POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Hygiene Test Patient {{suffix}}",
  "consentGiven": true,
  "branchId": "{{branch_id}}"
}
HTTP 201
[Captures]
hygiene_patient_id: jsonpath "$.id"


# E3-1 — create a HYGIENE-typed visit (visitType persists)
POST {{api}}/dental/visits
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{hygiene_patient_id}}",
  "branchId": "{{branch_id}}",
  "dentistMemberId": "{{dentist_member_id}}",
  "visitType": "hygiene",
  "chiefComplaint": "6-month recall + prophy"
}
HTTP 201
[Captures]
hygiene_visit_id: jsonpath "$.id"
[Asserts]
jsonpath "$.visitType" == "hygiene"
jsonpath "$.status" == "draft"


# E3-1a — default visitType is 'general' when omitted (back-compat). Uses a fresh
# patient so the active-visit guard doesn't interfere with the assertion.
POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Default Type Patient {{suffix}}",
  "consentGiven": true,
  "branchId": "{{branch_id}}"
}
HTTP 201
[Captures]
default_type_patient_id: jsonpath "$.id"

POST {{api}}/dental/visits
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{default_type_patient_id}}",
  "branchId": "{{branch_id}}",
  "dentistMemberId": "{{dentist_member_id}}",
  "chiefComplaint": "Default visit type check"
}
HTTP 201
[Asserts]
jsonpath "$.visitType" == "general"


# E3-2 — GET round-trips the hygiene visitType
GET {{api}}/dental/visits/{{hygiene_visit_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{hygiene_visit_id}}"
jsonpath "$.visitType" == "hygiene"


# E3-3 — activate the hygiene visit (fresh patient → no active-visit conflict)
PATCH {{api}}/dental/visits/{{hygiene_visit_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "active"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "active"
jsonpath "$.visitType" == "hygiene"


# E3-4 — draft notes on the hygiene visit
POST {{api}}/dental/visits/{{hygiene_visit_id}}/notes
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{hygiene_visit_id}}",
  "subjective": "Recall — no complaints",
  "objective": "BOP 8%, light calculus lower anteriors",
  "assessment": "Localised gingivitis",
  "plan": "Prophy completed; 6-month recall",
  "notes": "OHI reinforced"
}
HTTP 201
[Asserts]
jsonpath "$.visitId" == "{{hygiene_visit_id}}"


# E3-5 — sign the hygiene visit's notes (happy path)
POST {{api}}/dental/visits/{{hygiene_visit_id}}/notes/sign
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{}
HTTP 200
[Asserts]
jsonpath "$.signed" == true
jsonpath "$.signedAt" isString
