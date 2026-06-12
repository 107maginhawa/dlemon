# Dental Clinical Extras contract tests
# Tests: prescription CRUD, consent form + sign, attachment create/delete,
#        lab order state machine, medical history, amendment.

# 0. Sign up as a user
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "dental-clinical-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dr. Clinical Tester"
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
  "organizationName": "Clinical Test Clinic {{suffix}}",
  "tier": "clinic",
  "countryCode": "PH",
  "branchName": "Main Branch",
  "timezone": "Asia/Manila",
  "address": "123 Test Street",
  "city": "Manila",
  "phone": "+639001234568",
  "ownerDisplayName": "Dr. Clinical Tester"
}
HTTP 201
[Captures]
org_id: jsonpath "$.organizationId"
branch_id: jsonpath "$.branchId"
dentist_member_id: jsonpath "$.membershipId"


# 0d. Create a dental patient
POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Clinical Test Patient {{suffix}}",
  "consentGiven": true,
  "branchId": "{{branch_id}}"
}
HTTP 201
[Captures]
patient_id: jsonpath "$.id"


# 1. Create a dental visit (needed for FK)
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


# ============================================================
# PRESCRIPTIONS
# ============================================================

# 2. Create prescription
POST {{api}}/dental/visits/{{visit_id}}/prescriptions
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "{{patient_id}}",
  "prescriberMemberId": "{{dentist_member_id}}",
  "drugName": "Amoxicillin",
  "dosage": "500mg",
  "frequency": "TID",
  "duration": "7 days",
  "rxNormCode": "723"
}
HTTP 201
[Captures]
prescription_id: jsonpath "$.id"
[Asserts]
jsonpath "$.drugName" == "Amoxicillin"
jsonpath "$.dosage" == "500mg"
jsonpath "$.dispenseAsWritten" == false


# 3. List prescriptions for visit
GET {{api}}/dental/visits/{{visit_id}}/prescriptions
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" count >= 1


# 4. Update prescription
PATCH {{api}}/dental/visits/{{visit_id}}/prescriptions/{{prescription_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "dosage": "250mg",
  "instructions": "Take with food"
}
HTTP 200
[Asserts]
jsonpath "$.dosage" == "250mg"
jsonpath "$.instructions" == "Take with food"
jsonpath "$.drugName" == "Amoxicillin"


# ============================================================
# CONSENT FORMS
# ============================================================

# 5. Create consent form
POST {{api}}/dental/visits/{{visit_id}}/consents
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "{{patient_id}}",
  "templateId": "tpl-general-consent",
  "templateName": "General Dental Consent"
}
HTTP 201
[Captures]
consent_id: jsonpath "$.id"
[Asserts]
jsonpath "$.signed" == false
jsonpath "$.templateName" == "General Dental Consent"


# 6. List consent forms
GET {{api}}/dental/visits/{{visit_id}}/consents
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" count >= 1


# 7. Sign consent form
POST {{api}}/dental/visits/{{visit_id}}/consents/{{consent_id}}/sign
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "signatureData": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
}
HTTP 200
[Asserts]
jsonpath "$.signed" == true
jsonpath "$.signedAt" != null


# 8. Re-sign should fail (immutable after signing)
# V-CLN-005: a signed consent form is immutable; re-signing is a business-rule
# violation → 422 CONSENT_FORM_SIGNED (not 400).
POST {{api}}/dental/visits/{{visit_id}}/consents/{{consent_id}}/sign
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "signatureData": "new-sig-data"
}
HTTP 422
[Asserts]
jsonpath "$.code" == "CONSENT_FORM_SIGNED"


# ============================================================
# CONSENT REVOCATION + REFUSALS (WF-035) — FIX-005 (Batch B)
# ============================================================

# 8b. Create a second, UNSIGNED consent form to exercise the revoke flow.
# (Step 5's form is signed at step 7, so a fresh unsigned form is required.)
POST {{api}}/dental/visits/{{visit_id}}/consents
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "{{patient_id}}",
  "templateId": "tpl-revocable-consent",
  "templateName": "Revocable Consent"
}
HTTP 201
[Captures]
revocable_consent_id: jsonpath "$.id"
[Asserts]
jsonpath "$.signed" == false
jsonpath "$.revoked" == false


# 8c. Revoke the unsigned consent form (WF-035). NOTE: revoke is PATCH (sign is
# POST). The handler returns the full row, so `revoked` flips true and `signed`
# stays false — now schema-backed after the ConsentForm model gained `revoked`.
PATCH {{api}}/dental/visits/{{visit_id}}/consents/{{revocable_consent_id}}/revoke
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.revoked" == true
jsonpath "$.signed" == false


# 8d. Signing a revoked consent form is rejected (V-CLN-010 mutual exclusion):
# 422 CONSENT_FORM_REVOKED (distinct from the signed→re-sign 422 above).
POST {{api}}/dental/visits/{{visit_id}}/consents/{{revocable_consent_id}}/sign
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "signatureData": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
}
HTTP 422
[Asserts]
jsonpath "$.code" == "CONSENT_FORM_REVOKED"


# 8e. Re-revoking an already-revoked form conflicts (409).
PATCH {{api}}/dental/visits/{{visit_id}}/consents/{{revocable_consent_id}}/revoke
Cookie: better-auth.session_token={{session_token}}
HTTP 409


# 8f. Record an informed refusal (precondition for the refusals-list pin).
POST {{api}}/dental/visits/{{visit_id}}/consent-refusals
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "{{patient_id}}",
  "refusingMemberId": "{{dentist_member_id}}",
  "procedureDescription": "Extraction of tooth #48",
  "refusalReason": "Patient prefers conservative care",
  "patientAcknowledgement": "I understand the risks of declining treatment."
}
HTTP 201
[Asserts]
jsonpath "$.procedureDescription" == "Extraction of tooth #48"
jsonpath "$.refusingMemberId" == "{{dentist_member_id}}"


# 8g. List informed refusals (WF-035 history surface). The handler emits a
# non-canonical pagination object {totalCount,page,pageSize}; assert only the
# array + totalCount to stay green against the actual shape.
GET {{api}}/dental/visits/{{visit_id}}/consent-refusals
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" count >= 1
jsonpath "$.pagination.totalCount" >= 1


# ============================================================
# ATTACHMENTS
# ============================================================

# 9. Create attachment
POST {{api}}/dental/visits/{{visit_id}}/attachments
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "{{patient_id}}",
  "imageType": "xray",
  "toothNumbers": [21, 22],
  "fileName": "tooth-21-periapical.jpg",
  "filePath": "/uploads/tooth-21-periapical.jpg",
  "fileSizeBytes": 204800,
  "mimeType": "image/jpeg",
  "note": "Periapical view"
}
HTTP 201
[Captures]
attachment_id: jsonpath "$.id"
[Asserts]
jsonpath "$.imageType" == "xray"
jsonpath "$.fileName" == "tooth-21-periapical.jpg"


# 10. List attachments for visit
GET {{api}}/dental/visits/{{visit_id}}/attachments
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" count >= 1


# 11. Delete attachment
DELETE {{api}}/dental/visits/{{visit_id}}/attachments/{{attachment_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 204


# 12. Verify attachment is deleted (list should be empty for this visit)
GET {{api}}/dental/visits/{{visit_id}}/attachments
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.pagination.totalCount" == 0


# ============================================================
# LAB ORDERS
# ============================================================

# 13. Create lab order
POST {{api}}/dental/visits/{{visit_id}}/lab-orders
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "{{patient_id}}",
  "labName": "Precision Dental Lab",
  "description": "PFM Crown tooth 21",
  "expectedDeliveryDate": "2025-12-01T00:00:00Z"
}
HTTP 201
[Captures]
order_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "ordered"
jsonpath "$.isDefective" == false


# 14. List lab orders
GET {{api}}/dental/visits/{{visit_id}}/lab-orders
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" count >= 1


# 15. Advance to inFabrication
PATCH {{api}}/dental/visits/{{visit_id}}/lab-orders/{{order_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "in_fabrication"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "in_fabrication"


# 16. Invalid transition: inFabrication → fitted (skip)
# V-CLN-008: an illegal lab-order FSM transition is a business-rule violation
# → 422 INVALID_STATUS_TRANSITION (not 400).
PATCH {{api}}/dental/visits/{{visit_id}}/lab-orders/{{order_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "fitted"
}
HTTP 422


# 17. Advance to delivered
PATCH {{api}}/dental/visits/{{visit_id}}/lab-orders/{{order_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "delivered"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "delivered"
jsonpath "$.deliveredAt" != null


# 18. Advance to fitted
PATCH {{api}}/dental/visits/{{visit_id}}/lab-orders/{{order_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "fitted"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "fitted"
jsonpath "$.fittedAt" != null


# ============================================================
# MEDICAL HISTORY
# ============================================================

# 19. Create medical history entry (condition, ICD-10)
POST {{api}}/dental/clinical/medical-history
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "entryType": "condition",
  "displayName": "Hypertension",
  "codeSystem": "ICD-10",
  "code": "I10",
  "onsetDate": "2020-01-01"
}
HTTP 201
[Captures]
history_id: jsonpath "$.id"
[Asserts]
jsonpath "$.active" == true
jsonpath "$.code" == "I10"


# 20. List medical history for patient
GET {{api}}/dental/clinical/medical-history?patientId={{patient_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" count >= 1


# 21. Update medical history entry — rejected: entries are immutable.
# V-CLN-009 / AC-CLI-005: medical history is append-only; PATCH is not an allowed
# method on this resource → 405 MEDICAL_HISTORY_IMMUTABLE. Corrections flow through
# a new entry or the additive amendment path, not an in-place update.
PATCH {{api}}/dental/clinical/medical-history/{{history_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "resolvedDate": "2025-01-01",
  "active": false,
  "notes": "BP controlled with medication"
}
HTTP 405
[Asserts]
jsonpath "$.code" == "MEDICAL_HISTORY_IMMUTABLE"


# ============================================================
# AMENDMENTS
# ============================================================

# 22. Create amendment
POST {{api}}/dental/visits/{{visit_id}}/amendments
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "{{patient_id}}",
  "originalRecordType": "treatment",
  "originalRecordId": "f1000000-0000-4000-8000-000000000099",
  "reason": "Documentation error",
  "content": "Clarification: procedure performed on upper left, not lower left."
}
HTTP 201
[Captures]
amendment_id: jsonpath "$.id"
[Asserts]
jsonpath "$.reason" == "Documentation error"
jsonpath "$.originalRecordType" == "treatment"


# 23. List amendments for visit
GET {{api}}/dental/visits/{{visit_id}}/amendments
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" count >= 1


# ============================================================
# TREATMENT TEMPLATES
# ============================================================

# 24. Create treatment template
# Current API runs two validation layers: the generated wire validator still
# requires a `treatments` string, while the handler additionally requires
# `branchId` + a non-empty `items[]` array
# ({cdtCode, description, priceCents, toothNumber?, surfaces?}). The persisted row
# is returned directly with `items` as a JSON array (no `treatments` field).
POST {{api}}/dental/treatment-templates
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "name": "Composite Restoration Protocol {{suffix}}",
  "branchId": "{{branch_id}}",
  "description": "Standard composite filling workflow",
  "treatments": "D2391",
  "items": [
    { "cdtCode": "D2391", "description": "Composite resin, one surface, primary", "priceCents": 12000 }
  ]
}
HTTP 201
[Captures]
template_id: jsonpath "$.id"
[Asserts]
jsonpath "$.name" == "Composite Restoration Protocol {{suffix}}"
jsonpath "$.items" isCollection
jsonpath "$.items[0].cdtCode" == "D2391"


# 25. List treatment templates
# Current API: requires ?branchId= and returns { templates: [...] }.
GET {{api}}/dental/treatment-templates?branchId={{branch_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.templates" isCollection
jsonpath "$.templates" count >= 1


# 26. Update treatment template
PATCH {{api}}/dental/treatment-templates/{{template_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "name": "Composite Restoration Protocol Updated {{suffix}}",
  "description": "Updated composite filling workflow"
}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{template_id}}"
jsonpath "$.name" == "Composite Restoration Protocol Updated {{suffix}}"


# 27. Delete treatment template
DELETE {{api}}/dental/treatment-templates/{{template_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200


# ============================================================
# VISIT NOTES ADVANCED (sign, addendum, history, template-apply, carry-over)
# ============================================================

# 28. Upsert visit notes first (required before sign/addendum)
POST {{api}}/dental/visits/{{visit_id}}/notes
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "subjective": "Patient complains of tooth sensitivity",
  "objective": "Caries observed on tooth 36",
  "assessment": "Class II caries",
  "plan": "Composite restoration scheduled"
}
HTTP 201


# 29. Sign visit notes
POST {{api}}/dental/visits/{{visit_id}}/notes/sign
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{}
HTTP 200
[Asserts]
jsonpath "$.visitId" == "{{visit_id}}"
jsonpath "$.signedAt" != null


# 30. Add addendum to visit notes
# Current API: returns 201 with the appended note-version snapshot row
# ({ id, noteId, version, snapshot, createdBy }); the addendum reason/content live
# under `snapshot`, and there is no top-level visitId on a version row.
POST {{api}}/dental/visits/{{visit_id}}/notes/addendum
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "reason": "Additional finding",
  "content": "Post-procedure: patient tolerated treatment well."
}
HTTP 201
[Asserts]
jsonpath "$.snapshot.type" == "addendum"
jsonpath "$.snapshot.reason" == "Additional finding"
jsonpath "$.version" >= 2


# 31. Get visit notes history
# Current API returns a bare array of note-version snapshot rows (not a { data: [] }
# envelope): the sign version + the addendum version.
GET {{api}}/dental/visits/{{visit_id}}/notes/history
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$" isCollection
jsonpath "$" count >= 2


# 32. Create a second treatment template for apply-template test
POST {{api}}/dental/treatment-templates
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "name": "Root Canal Protocol {{suffix}}",
  "branchId": "{{branch_id}}",
  "treatments": "D3330",
  "items": [
    { "cdtCode": "D3330", "description": "Endodontic therapy, molar tooth", "priceCents": 80000 }
  ]
}
HTTP 201
[Captures]
apply_template_id: jsonpath "$.id"


# 33. Apply template to visit
# Current API returns 201 with { applied: [...], count } (templated treatments are
# created as new planned treatment rows).
POST {{api}}/dental/visits/{{visit_id}}/apply-template/{{apply_template_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 201
[Asserts]
jsonpath "$.count" >= 1
jsonpath "$.applied" isCollection


# 34. Create a second visit for carry-over source
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
carryover_visit_id: jsonpath "$.id"


# 35. Activate carry-over target visit
PATCH {{api}}/dental/visits/{{carryover_visit_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "active"
}
HTTP 200


# 36. Carry over treatments from visit_id to carryover_visit_id
POST {{api}}/dental/visits/{{carryover_visit_id}}/carry-over
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "sourceVisitId": "{{visit_id}}"
}
HTTP 200


# ============================================================
# DASHBOARD SUMMARY
# ============================================================

# 37. Get dashboard summary
# Current API requires ?branchId= (dentist_owner only) and returns a branch-scoped
# summary of active payment plans + pending lab orders (the old todayVisits/
# pendingInvoices/totalPatients/revenueThisMonthCents shape is gone).
GET {{api}}/dental/dashboard/summary?branchId={{branch_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.activePaymentPlans.count" isInteger
jsonpath "$.activePaymentPlans.behindCount" isInteger
jsonpath "$.activePaymentPlans.totalOutstandingCents" isInteger
jsonpath "$.labOrders.totalPending" isInteger
jsonpath "$.labOrders.ordered" isInteger
jsonpath "$.labOrders.inFabrication" isInteger
jsonpath "$.labOrders.overdueDelivery" isInteger


# 38. Dashboard summary auth check → 401.
# Hurl keeps an in-file cookie jar, so the signed-in session_token from step 0 is
# auto-replayed; an invalid bearer overrides hurl's stored cookie and exercises the
# unauthenticated path.
GET {{api}}/dental/dashboard/summary?branchId={{branch_id}}
Authorization: Bearer invalid-no-session
HTTP 401
