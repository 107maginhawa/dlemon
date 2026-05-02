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


# 1. Create a dental visit (needed for FK)
POST {{api}}/dental/visits
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "f1000000-0000-4000-8000-000000000001",
  "branchId": "f1000000-0000-4000-8000-000000000002",
  "dentistMemberId": "f1000000-0000-4000-8000-000000000003"
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
  "patientId": "f1000000-0000-4000-8000-000000000001",
  "prescriberMemberId": "f1000000-0000-4000-8000-000000000010",
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
jsonpath "$.items" count >= 1


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
  "patientId": "f1000000-0000-4000-8000-000000000001",
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
jsonpath "$.items" count >= 1


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
POST {{api}}/dental/visits/{{visit_id}}/consents/{{consent_id}}/sign
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "signatureData": "new-sig-data"
}
HTTP 400


# ============================================================
# ATTACHMENTS
# ============================================================

# 9. Create attachment
POST {{api}}/dental/visits/{{visit_id}}/attachments
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "f1000000-0000-4000-8000-000000000001",
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
jsonpath "$.items" count >= 1


# 11. Delete attachment
DELETE {{api}}/dental/visits/{{visit_id}}/attachments/{{attachment_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 204


# 12. Verify attachment is deleted (list should be empty for this visit)
GET {{api}}/dental/visits/{{visit_id}}/attachments
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.total" == 0


# ============================================================
# LAB ORDERS
# ============================================================

# 13. Create lab order
POST {{api}}/dental/visits/{{visit_id}}/lab-orders
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "f1000000-0000-4000-8000-000000000001",
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
jsonpath "$.items" count >= 1


# 15. Advance to inFabrication
PATCH {{api}}/dental/visits/{{visit_id}}/lab-orders/{{order_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "inFabrication"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "inFabrication"


# 16. Invalid transition: inFabrication → fitted (skip)
PATCH {{api}}/dental/visits/{{visit_id}}/lab-orders/{{order_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "fitted"
}
HTTP 400


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
  "patientId": "f1000000-0000-4000-8000-000000000001",
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
GET {{api}}/dental/clinical/medical-history?patientId=f1000000-0000-4000-8000-000000000001
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.items" count >= 1


# 21. Update medical history entry (mark resolved)
PATCH {{api}}/dental/clinical/medical-history/{{history_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "resolvedDate": "2025-01-01",
  "active": false,
  "notes": "BP controlled with medication"
}
HTTP 200
[Asserts]
jsonpath "$.active" == false
jsonpath "$.resolvedDate" == "2025-01-01"


# ============================================================
# AMENDMENTS
# ============================================================

# 22. Create amendment
POST {{api}}/dental/visits/{{visit_id}}/amendments
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "f1000000-0000-4000-8000-000000000001",
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
jsonpath "$.items" count >= 1
