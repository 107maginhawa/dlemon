# Dental Billing contract tests
# Tests: create invoice from visit, issue, apply discount, record payment,
#        list payments, void payment, create payment plan, get payment plan,
#        list invoices, get invoice with line items.

# 0. Sign up
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "dental-billing-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dr. Billing Tester"
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
  "name": "Billing Test Clinic {{suffix}}",
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
  "phone": "+639001234567"
}
HTTP 201
[Captures]
branch_id: jsonpath "$.id"


# 0c. Create a dental patient
POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Billing Test Patient {{suffix}}",
  "consentGiven": true
}
HTTP 201
[Captures]
patient_id: jsonpath "$.id"


# 0d. Create branch membership for this user (grants branch access)
POST {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}/members
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Dr. Billing Tester",
  "role": "dentist_owner",
  "personId": "{{user_id}}"
}
HTTP 201
[Captures]
dentist_member_id: jsonpath "$.id"


# 1. Create a dental visit (draft)
POST {{api}}/dental/visits
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "branchId": "{{branch_id}}",
  "dentistMemberId": "{{dentist_member_id}}",
  "chiefComplaint": "Billing test visit"
}
HTTP 201
[Captures]
visit_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "draft"


# 2. Activate visit
PATCH {{api}}/dental/visits/{{visit_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "active"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "active"


# 3. Add treatment 1
POST {{api}}/dental/visits/{{visit_id}}/treatments
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "{{patient_id}}",
  "cdtCode": "D2391",
  "description": "Resin composite, one surface",
  "toothNumber": 26,
  "surfaces": ["mesial"],
  "priceCents": 15000
}
HTTP 201
[Captures]
treatment_id_1: jsonpath "$.id"


# 4. Add treatment 2
POST {{api}}/dental/visits/{{visit_id}}/treatments
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "{{patient_id}}",
  "cdtCode": "D0150",
  "description": "Comprehensive oral evaluation",
  "priceCents": 8500
}
HTTP 201
[Captures]
treatment_id_2: jsonpath "$.id"


# 5a. Plan treatment 1 (diagnosed → planned)
PATCH {{api}}/dental/visits/{{visit_id}}/treatments/{{treatment_id_1}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "planned"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "planned"


# 5b. Plan treatment 2 (diagnosed → planned)
PATCH {{api}}/dental/visits/{{visit_id}}/treatments/{{treatment_id_2}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "planned"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "planned"


# 5. Mark treatment 1 as performed (planned → performed)
PATCH {{api}}/dental/visits/{{visit_id}}/treatments/{{treatment_id_1}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "performed"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "performed"


# 6. Mark treatment 2 as performed (planned → performed)
PATCH {{api}}/dental/visits/{{visit_id}}/treatments/{{treatment_id_2}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "performed"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "performed"


# 7. Create invoice from visit
POST {{api}}/dental/billing/invoices
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "{{patient_id}}",
  "branchId": "{{branch_id}}",
  "dentistMemberId": "{{dentist_member_id}}"
}
HTTP 201
[Captures]
invoice_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "draft"
jsonpath "$.subtotalCents" == 23500
jsonpath "$.balanceCents" >= 0


# 8. Issue invoice
POST {{api}}/dental/billing/invoices/{{invoice_id}}/issue
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "issued"
jsonpath "$.issuedAt" isString


# 9. Apply discount (20%)
POST {{api}}/dental/billing/invoices/{{invoice_id}}/discount
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "reason": "Senior Discount",
  "percentageRate": 20
}
HTTP 200
[Asserts]
jsonpath "$.discountCents" > 0


# 10. Record payment (partial)
POST {{api}}/dental/billing/invoices/{{invoice_id}}/payments
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "amountCents": 5000,
  "method": "cash",
  "receiptNumber": "A-{{suffix}}",
  "recordedByMemberId": "{{dentist_member_id}}"
}
HTTP 201
[Captures]
payment_id: jsonpath "$.id"
[Asserts]
jsonpath "$.isVoid" == false
jsonpath "$.amountCents" == 5000
jsonpath "$.method" == "cash"


# 11. List payments
GET {{api}}/dental/billing/invoices/{{invoice_id}}/payments
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" count >= 1


# 12. Void payment
POST {{api}}/dental/billing/invoices/{{invoice_id}}/payments/{{payment_id}}/void
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "voidReason": "Entry error"
}
HTTP 200
[Asserts]
jsonpath "$.isVoid" == true
jsonpath "$.voidReason" == "Entry error"


# 13. Create payment plan
POST {{api}}/dental/billing/invoices/{{invoice_id}}/plan
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "numberOfInstallments": 3,
  "frequency": "monthly",
  "startDate": "2026-07-01T00:00:00.000Z"
}
HTTP 201
[Asserts]
jsonpath "$.status" == "on_track"
jsonpath "$.numberOfInstallments" == 3
jsonpath "$.frequency" == "monthly"


# 14. Get payment plan
GET {{api}}/dental/billing/invoices/{{invoice_id}}/plan
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "on_track"
jsonpath "$.installments" count == 3


# 15. List invoices filtered by status
GET {{api}}/dental/billing/invoices?status=issued
Cookie: better-auth.session_token={{session_token}}
HTTP 200


# 16. Get invoice with line items
GET {{api}}/dental/billing/invoices/{{invoice_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{invoice_id}}"
jsonpath "$.lineItems" count == 2


# NEW: G2-S4 — payment plan installment structure verification
# Re-fetch the payment plan and assert each installment has required fields.
GET {{api}}/dental/billing/invoices/{{invoice_id}}/plan
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "on_track"
jsonpath "$.installments" count == 3
jsonpath "$.installments[0].amountCents" isInteger
jsonpath "$.installments[0].dueDate" isString
jsonpath "$.installments[0].status" isString
jsonpath "$.installments[1].amountCents" isInteger
jsonpath "$.installments[2].amountCents" isInteger
