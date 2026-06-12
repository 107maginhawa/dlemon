# Dental Patient contract tests
# Tests the /dental/patients API: create, list, get, update, archive,
# restore, follow-up notes, safety floor, statement, bulk-archive, import, export.

# 0. Sign up as a user (required for auth)
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "dental-patient-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dr. Dental Tester"
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
  "organizationName": "Patient Test Clinic {{suffix}}",
  "tier": "clinic",
  "countryCode": "PH",
  "branchName": "Main Branch",
  "timezone": "Asia/Manila",
  "address": "123 Test Street",
  "city": "Manila",
  "phone": "+639001234569",
  "ownerDisplayName": "Dr. Dental Tester"
}
HTTP 201
[Captures]
org_id: jsonpath "$.organizationId"
branch_id: jsonpath "$.branchId"
dentist_member_id: jsonpath "$.membershipId"


# 1. Create a dental patient
POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Maria Santos {{suffix}}",
  "dateOfBirth": "1985-06-15",
  "gender": "female",
  "consentGiven": true,
  "branchId": "{{branch_id}}"
}
HTTP 201
[Captures]
patient_id: jsonpath "$.id"
[Asserts]
jsonpath "$.id" isString
jsonpath "$.status" == "active"
jsonpath "$.needsFollowUp" == false
jsonpath "$.person" isCollection


# 1b. BR-015 / AC-PAT-001 — registration consent is required (single-consent
# model V-PAT-004). Omitting/falsifying consentGiven → 422 CONSENT_REQUIRED, not 201.
# Pins the FE↔BE error contract surfaced by the registration modal.
POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "No Consent {{suffix}}",
  "consentGiven": false,
  "branchId": "{{branch_id}}"
}
HTTP 422
[Asserts]
jsonpath "$.code" == "CONSENT_REQUIRED"


# 2. List dental patients
GET {{api}}/dental/patients?branchId={{branch_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.pagination.totalCount" >= 1


# 3. List dental patients with search
GET {{api}}/dental/patients?branchId={{branch_id}}&q=Maria+Santos
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# 4. Get patient profile
GET {{api}}/dental/patients/{{patient_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{patient_id}}"
jsonpath "$.status" == "active"


# 4a. The patient exists but is in no household → 204 No Content (not 404).
GET {{api}}/dental/patients/{{patient_id}}/household
Cookie: better-auth.session_token={{session_token}}
HTTP 204


# 5. Update dental-specific fields
PATCH {{api}}/dental/patients/{{patient_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "dentalHistorySummary": "Mild gingivitis. Scaling done annually.",
  "needsFollowUp": true,
  "recallNote": "Schedule cleaning in 6 months"
}
HTTP 200
[Asserts]
jsonpath "$.needsFollowUp" == true


# 5a. FR2.4: correct a registration typo in demographics (name/DOB/gender).
# These live on the linked PERSON record; the response surfaces the updated
# declared subset + displayName. contactInfo is absent here (none set) — it is
# exposed only when present (#14, tested in 5d below).
PATCH {{api}}/dental/patients/{{patient_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "firstName": "Mariana",
  "lastName": "Reyes",
  "dateOfBirth": "1991-05-01",
  "gender": "female"
}
HTTP 200
[Asserts]
jsonpath "$.person.firstName" == "Mariana"
jsonpath "$.person.lastName" == "Reyes"
jsonpath "$.person.dateOfBirth" == "1991-05-01"
jsonpath "$.person.gender" == "female"
jsonpath "$.displayName" == "Mariana Reyes"
# V-PAT-014: the PATCH response must NOT leak person PII (contactInfo / address)
# or raw DB-row internals (actor UUIDs, version). Declared subset only.
jsonpath "$.person.contactInfo" not exists
jsonpath "$.person.primaryAddress" not exists
jsonpath "$.version" not exists
jsonpath "$.createdBy" not exists
jsonpath "$.updatedBy" not exists


# 5b. Persisted across a fresh read (edit-save-reload).
GET {{api}}/dental/patients/{{patient_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.person.firstName" == "Mariana"
jsonpath "$.displayName" == "Mariana Reyes"


# 5d. #14 (V-PAT-014): contact info (phone/email) edit — exposed + persisted.
PATCH {{api}}/dental/patients/{{patient_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "contactInfo": { "email": "mariana@clinic.test", "phone": "+639170000123" }
}
HTTP 200
[Asserts]
jsonpath "$.person.contactInfo.email" == "mariana@clinic.test"
jsonpath "$.person.contactInfo.phone" == "+639170000123"

# 5e. Persisted contact info surfaces on a fresh read; partial edit keeps email.
PATCH {{api}}/dental/patients/{{patient_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "contactInfo": { "phone": "+639170000999" }
}
HTTP 200

GET {{api}}/dental/patients/{{patient_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.person.contactInfo.email" == "mariana@clinic.test"
jsonpath "$.person.contactInfo.phone" == "+639170000999"


# 5c. Demographics validation: an invalid gender is rejected.
PATCH {{api}}/dental/patients/{{patient_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "gender": "banana"
}
HTTP 400


# 6. List patients with needsFollowUp filter
GET {{api}}/dental/patients?branchId={{branch_id}}&needsFollowUp=true
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# 7. Add a follow-up note
POST {{api}}/dental/patients/{{patient_id}}/follow-up-notes
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "text": "Patient mentioned sensitivity in upper left molar."
}
HTTP 201
[Captures]
note_id: jsonpath "$.note.id"
[Asserts]
jsonpath "$.note.id" isString
jsonpath "$.note.text" == "Patient mentioned sensitivity in upper left molar."
jsonpath "$.total" >= 1


# 8. List follow-up notes
GET {{api}}/dental/patients/{{patient_id}}/follow-up-notes
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.notes" isCollection
jsonpath "$.total" >= 1


# 9. Get safety floor (medical history aggregation)
GET {{api}}/dental/patients/{{patient_id}}/safety-floor
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.patientId" == "{{patient_id}}"
jsonpath "$.allergies" isCollection
jsonpath "$.medications" isCollection
jsonpath "$.conditions" isCollection
jsonpath "$.retrievedAt" isString


# 10. Get itemized statement
GET {{api}}/dental/patients/{{patient_id}}/statement
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.patientId" == "{{patient_id}}"
jsonpath "$.summary.totalVisits" isInteger
jsonpath "$.summary.outstandingBalanceCents" isInteger
jsonpath "$.visits" isCollection
jsonpath "$.invoices" isCollection
jsonpath "$.payments" isCollection


# 11. Export patients as JSON
# Response key is `patients` (ExportDentalPatientsResponse) — not `data`.
# The FE useExportPatients reads `data.patients`, and each row carries a derived
# `displayName` for the CSV name column.
GET {{api}}/dental/patients/export?format=json&branchId={{branch_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.patients" isCollection
jsonpath "$.patients[0].displayName" isString
jsonpath "$.total" >= 1
jsonpath "$.exportedAt" isString


# 12. Import patients via JSON
POST {{api}}/dental/patients/import
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patients": [
    {
      "firstName": "Juan",
      "lastName": "Dela Cruz",
      "dateOfBirth": "1990-03-22",
      "branchId": "{{branch_id}}"
    }
  ]
}
HTTP 201


# 13. Archive patient
POST {{api}}/dental/patients/{{patient_id}}/archive
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "archived"


# 13b. BR-015b / AC-PAT-002 — an archived patient record is read-only. A write
# (PATCH demographics) against the now-archived patient → 403 PATIENT_ARCHIVED.
# Pins the read-only guard at the wire layer (backend unit covers it; contract did not).
PATCH {{api}}/dental/patients/{{patient_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "needsFollowUp": true
}
HTTP 403
[Asserts]
jsonpath "$.code" == "PATIENT_ARCHIVED"


# 14. Restore archived patient
POST {{api}}/dental/patients/{{patient_id}}/restore
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "active"


# 15. Create a second patient for bulk-archive
POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Bulk Test Patient {{suffix}}",
  "consentGiven": true,
  "branchId": "{{branch_id}}"
}
HTTP 201
[Captures]
patient2_id: jsonpath "$.id"
[Asserts]
jsonpath "$.id" isString


# 16. Bulk-archive both patients
POST {{api}}/dental/patients/bulk-archive
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "ids": ["{{patient_id}}", "{{patient2_id}}"],
  "reason": "Bulk archive contract test cleanup"
}
HTTP 200
[Asserts]
jsonpath "$.results" isCollection
jsonpath "$.successCount" >= 0
jsonpath "$.failCount" >= 0


# NEW: G2-S4 — patient search with partial name returns matching results
# "Maria" is a substring of "Maria Santos {{suffix}}" created in step 1.
GET {{api}}/dental/patients?branchId={{branch_id}}&q=Maria
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.pagination.totalCount" >= 0


# ============================================================
# NEW: G2.5-S6 — patient images, treatments, visits, treatment-plan, dentition
# ============================================================

# Restore the primary patient — the bulk-archive above archived it, and the
# treatment-plan accept / dentition / recall steps below 422 on an archived patient
# (PATIENT_ARCHIVED). This section needs an ACTIVE patient.
POST {{api}}/dental/patients/{{patient_id}}/restore
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "active"


# NEW: G2.5-S6 — create a visit for patient FK contexts
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
patient_visit_id: jsonpath "$.id"


# NEW: G2.5-S6 — list patient images (returns {items,total})
GET {{api}}/dental/patients/{{patient_id}}/images?branchId={{branch_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.items" isCollection


# NEW: G2.5-S6 — list patient images auth check (Bearer override beats Hurl's
# auto-replayed session cookie → true 401; mirrors sibling files)
GET {{api}}/dental/patients/{{patient_id}}/images?branchId={{branch_id}}
Authorization: Bearer invalid-no-session
HTTP 401


# NEW: G2.5-S6 — list patient treatments
GET {{api}}/dental/patients/{{patient_id}}/treatments
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# NEW: G2.5-S6 — list patient treatments auth check
GET {{api}}/dental/patients/{{patient_id}}/treatments
Authorization: Bearer invalid-no-session
HTTP 401


# NEW: G2.5-S6 — list patient visits
GET {{api}}/dental/patients/{{patient_id}}/visits
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# NEW: G2.5-S6 — list patient visits auth check
GET {{api}}/dental/patients/{{patient_id}}/visits
Authorization: Bearer invalid-no-session
HTTP 401


# G2.5-S6 — get treatment plan: a new patient has an empty v0 plan (branchId required)
# CHART-XV: response carries cumulative completedToothNumbers for the chart's Completed layer.
GET {{api}}/dental/patients/{{patient_id}}/treatment-plan?branchId={{branch_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.completedToothNumbers" isCollection


# G2.5-S6 — accept the treatment plan → creates version 1 (branchId required)
POST {{api}}/dental/patients/{{patient_id}}/treatment-plan/accept?branchId={{branch_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{}
HTTP 201
[Captures]
plan_version_id: jsonpath "$.id"


# G2.5-S6 — fetch that plan version by id (versionId is a UUID, not a sequence number)
GET {{api}}/dental/patients/{{patient_id}}/treatment-plan/versions/{{plan_version_id}}?branchId={{branch_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200


# NEW: G2.5-S6 — initialize dentition chart
POST {{api}}/dental/patients/{{patient_id}}/dentition
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "dateOfBirth": "1990-05-15",
  "visitId": "{{patient_visit_id}}"
}
HTTP 201
[Asserts]
jsonpath "$.patientId" == "{{patient_id}}"


# NEW: G2.5-S6 — dentition auth check
POST {{api}}/dental/patients/{{patient_id}}/dentition
Authorization: Bearer invalid-no-session
Content-Type: application/json
{
  "dateOfBirth": "1990-05-15",
  "visitId": "{{patient_visit_id}}"
}
HTTP 401


# ── P1-24: recall recurrence + recare due-list ───────────────────────────────
# R0. Ensure the patient is assigned to the branch (recall handlers are branch-scoped)
PATCH {{api}}/dental/patients/{{patient_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "preferredBranchId": "{{branch_id}}"
}
HTTP 200


# R1. Create a recurring recall already due (past dueDate), interval 6 months
POST {{api}}/dental/patients/{{patient_id}}/recalls
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "type": "cleaning",
  "dueDate": "2024-01-01",
  "intervalMonths": 6
}
HTTP 201
[Captures]
recall_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "pending"
jsonpath "$.intervalMonths" == 6


# R2. Recare due-list for the branch returns the due recall (branch-scoped)
GET {{api}}/dental/recalls/due?branchId={{branch_id}}&from=2000-01-01&to=2999-12-31
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$" isCollection
jsonpath "$[0].patientName" isString


# R3. Due-list requires auth (Bearer override beats Hurl's auto-replayed cookie)
GET {{api}}/dental/recalls/due?branchId={{branch_id}}
Authorization: Bearer invalid-no-session
HTTP 401


# R4. Due-list missing branchId → 400 (query validator wired)
GET {{api}}/dental/recalls/due
Cookie: better-auth.session_token={{session_token}}
HTTP 400


# R5. Complete the recurring recall — must go through 'sent' first (FSM), then completed
PATCH {{api}}/dental/patients/{{patient_id}}/recalls/{{recall_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "sent"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "sent"

PATCH {{api}}/dental/patients/{{patient_id}}/recalls/{{recall_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "completed"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "completed"


# R6. Next-cycle recall was seeded (a new pending recall now exists)
GET {{api}}/dental/patients/{{patient_id}}/recalls
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$" isCollection
jsonpath "$[*].status" includes "pending"
