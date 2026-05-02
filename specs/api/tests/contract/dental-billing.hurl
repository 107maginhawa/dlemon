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


# 1. Create a dental visit (draft)
POST {{api}}/dental/visits
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "f4000000-0000-4000-8000-000000000001",
  "branchId": "f4000000-0000-4000-8000-000000000002",
  "dentistMemberId": "f4000000-0000-4000-8000-000000000003",
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
  "patientId": "f4000000-0000-4000-8000-000000000001",
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
  "patientId": "f4000000-0000-4000-8000-000000000001",
  "cdtCode": "D0150",
  "description": "Comprehensive oral evaluation",
  "priceCents": 8500
}
HTTP 201
[Captures]
treatment_id_2: jsonpath "$.id"


# 5. Mark treatment 1 as performed
PATCH {{api}}/dental/visits/{{visit_id}}/treatments/{{treatment_id_1}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "performed"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "performed"


# 6. Mark treatment 2 as performed
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
  "patientId": "f4000000-0000-4000-8000-000000000001",
  "branchId": "f4000000-0000-4000-8000-000000000002",
  "dentistMemberId": "f4000000-0000-4000-8000-000000000003"
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
  "receiptNumber": "A-0001",
  "recordedByMemberId": "f4000000-0000-4000-8000-000000000003"
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
jsonpath "$" count >= 1


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
  "patientId": "f4000000-0000-4000-8000-000000000001",
  "numberOfInstallments": 3,
  "frequency": "monthly",
  "startDate": "2026-07-01T00:00:00.000Z"
}
HTTP 201
[Asserts]
jsonpath "$.status" == "onTrack"
jsonpath "$.numberOfInstallments" == 3
jsonpath "$.frequency" == "monthly"


# 14. Get payment plan
GET {{api}}/dental/billing/invoices/{{invoice_id}}/plan
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "onTrack"
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
