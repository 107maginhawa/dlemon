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


# 0a. Create a dental organization
POST {{api}}/dental/organizations
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "name": "Clinical Test Clinic {{suffix}}",
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
  "phone": "+639001234568"
}
HTTP 201
[Captures]
branch_id: jsonpath "$.id"


# 0c. Create branch membership for this user (grants branch access)
POST {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}/members
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Dr. Clinical Tester",
  "role": "dentist_owner",
  "personId": "{{user_id}}"
}
HTTP 201
[Captures]
dentist_member_id: jsonpath "$.id"


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
POST {{api}}/dental/treatment-templates
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "name": "Composite Restoration Protocol {{suffix}}",
  "description": "Standard composite filling workflow",
  "treatments": "[{\"code\":\"D2391\",\"description\":\"Composite resin, one surface, primary\"}]"
}
HTTP 201
[Captures]
template_id: jsonpath "$.id"
[Asserts]
jsonpath "$.name" == "Composite Restoration Protocol {{suffix}}"
jsonpath "$.treatments" isString


# 25. List treatment templates
GET {{api}}/dental/treatment-templates
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$" isCollection


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
POST {{api}}/dental/visits/{{visit_id}}/notes/addendum
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "reason": "Additional finding",
  "content": "Post-procedure: patient tolerated treatment well."
}
HTTP 200
[Asserts]
jsonpath "$.visitId" == "{{visit_id}}"


# 31. Get visit notes history
GET {{api}}/dental/visits/{{visit_id}}/notes/history
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# 32. Create a second treatment template for apply-template test
POST {{api}}/dental/treatment-templates
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "name": "Root Canal Protocol {{suffix}}",
  "treatments": "[{\"code\":\"D3330\",\"description\":\"Endodontic therapy, molar tooth\"}]"
}
HTTP 201
[Captures]
apply_template_id: jsonpath "$.id"


# 33. Apply template to visit
POST {{api}}/dental/visits/{{visit_id}}/apply-template/{{apply_template_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200


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
GET {{api}}/dental/dashboard/summary
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.todayVisits" isInteger
jsonpath "$.pendingInvoices" isInteger
jsonpath "$.totalPatients" isInteger
jsonpath "$.revenueThisMonthCents" isInteger


# 38. Dashboard summary auth check
GET {{api}}/dental/dashboard/summary
HTTP 401
