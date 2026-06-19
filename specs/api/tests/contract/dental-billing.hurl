# Dental Billing contract tests
# Tests: create invoice from visit, issue, apply discount, record payment,
#        list payments, void payment, create payment plan, get payment plan,
#        list invoices, get invoice with line items.

# ============================================================
# Unauthenticated auth-gate checks (G2.5-S6).
# Run BEFORE any sign-up so Hurl's cookie jar is empty — libcurl auto-replays a
# persisted session cookie on every later request, so these 401 checks would
# otherwise see the signed-in session. The auth gate fires before any resource
# lookup, so fixed placeholder UUIDs are sufficient.
# ============================================================

# Auth check — collections summary
GET {{api}}/dental/billing/collections/summary?period=today
HTTP 401

# Auth check — patient balance
GET {{api}}/dental/billing/patients/00000000-0000-0000-0000-000000000000/balance
HTTP 401

# Auth check — void invoice
POST {{api}}/dental/billing/invoices/00000000-0000-0000-0000-000000000000/void
Content-Type: application/json
{}
HTTP 401


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


# 0a. Self-service onboarding — provisions org + default branch + owner membership
# in one call (replaces the old org→branch→member setup; the caller becomes the org
# owner + a dentist_owner member, so the rest of the suite runs on the user's token).
POST {{api}}/dental/onboarding
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "organizationName": "Billing Test Clinic {{suffix}}",
  "tier": "clinic",
  "countryCode": "PH",
  "branchName": "Main Branch",
  "timezone": "Asia/Manila",
  "address": "123 Test Street",
  "city": "Manila",
  "phone": "+639001234567",
  "ownerDisplayName": "Dr. Billing Tester"
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
  "displayName": "Billing Test Patient {{suffix}}",
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


# 4a. Create a consent form for the visit (required before any treatment can be
# marked 'performed' — the treatment-performed guard enforces signed consent).
POST {{api}}/dental/visits/{{visit_id}}/consents
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "{{patient_id}}",
  "templateId": "general-consent",
  "templateName": "General Treatment Consent"
}
HTTP 201
[Captures]
consent_id: jsonpath "$.id"


# 4b. Sign the consent form (signed=true unblocks treatment 'performed' transition).
POST {{api}}/dental/visits/{{visit_id}}/consents/{{consent_id}}/sign
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "signatureData": "data:image/png;base64,iVBORw0KGgo="
}
HTTP 200
[Asserts]
jsonpath "$.signed" == true


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
PATCH {{api}}/dental/billing/invoices/{{invoice_id}}/issue
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
# AHA FIX-003 §15: applyDentalDiscount returns the FULL updated invoice with
# RECALCULATED totals (not just the discount row), so the FE re-renders coherently
# from one round-trip. Pin the EXACT arithmetic against the deterministic seed
# (subtotal 23500, 20% off → discount 4700, total 18800, balance 18800): a
# stale/un-recomputed total would fail these, so the coherence the FE depends on is
# contract-bound, not merely present.
jsonpath "$.subtotalCents" == 23500
jsonpath "$.discountCents" == 4700
jsonpath "$.totalCents" == 18800
jsonpath "$.balanceCents" == 18800
jsonpath "$.status" == "issued"


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
# AHA FIX-004 §15: the void soft-delete records WHO voided the payment. The wire
# carries voided_by_member_id via .returning(); the contract now declares it.
jsonpath "$.voidedByMemberId" isString


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


# 15. List invoices filtered by status (branchId is required to scope the query)
GET {{api}}/dental/billing/invoices?branchId={{branch_id}}&status=issued
Cookie: better-auth.session_token={{session_token}}
HTTP 200


# 16. Get invoice with line items
GET {{api}}/dental/billing/invoices/{{invoice_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{invoice_id}}"
jsonpath "$.lineItems" count == 2
# Read-side enrichment (modeled on DentalInvoice 2026-06-13): the detail response
# joins the patient display name. Asserting it guards the enrichment join against a
# silent regression (the field is optional in the spec, so a broken join would 200).
jsonpath "$.patientName" isString


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


# ============================================================
# NEW: G2.5-S6 — collections summary, patient balance, receipt, void
# ============================================================

# NEW: G2.5-S6 — collections summary
GET {{api}}/dental/billing/collections/summary?period=today
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.totalCollectedCents" isInteger
jsonpath "$.period.from" isString
jsonpath "$.period.to" isString
jsonpath "$.invoiceCount" isInteger


# NEW: G2.5-S6 — patient balance
GET {{api}}/dental/billing/patients/{{patient_id}}/balance
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.patientId" == "{{patient_id}}"
jsonpath "$.outstandingBalanceCents" isInteger
jsonpath "$.overdueInvoiceCount" isInteger


# NEW: G2.5-S6 — payment receipt
# Drift pin (AHA dental-billing FIX-007): the receipt is the rich NESTED document
# the handler returns and the reconciled TypeSpec now declares — receiptNumber +
# isVoid + nested payment/invoice/patient + generatedAt — not the old flat
# { amountCents, method, paidAt } projection. The FE PaymentReceipt depends on
# this shape (patient name, invoice number, void watermark).
GET {{api}}/dental/billing/invoices/{{invoice_id}}/payments/{{payment_id}}/receipt
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.receiptNumber" isString
jsonpath "$.isVoid" isBoolean
jsonpath "$.payment.amountCents" isInteger
jsonpath "$.payment.method" isString
jsonpath "$.invoice.invoiceNumber" isString
jsonpath "$.patient.name" isString
jsonpath "$.generatedAt" isString


# NEW: G2.5-S6 — void invoice.
# Complete the first (still-active) visit first — a patient may only have ONE active
# visit at a time, so we must close it before opening the void test visit. All its
# treatments are 'performed' and consent is signed, so completion guards pass.
PATCH {{api}}/dental/visits/{{visit_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "completed"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "completed"


# The first visit's treatments are already billed, so build a fresh billable visit
# (visit → activate → treatment → signed consent → planned → performed → invoice)
# to get a standalone invoice we can void without disturbing the main flow above.
POST {{api}}/dental/visits
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "branchId": "{{branch_id}}",
  "dentistMemberId": "{{dentist_member_id}}",
  "chiefComplaint": "Void test visit"
}
HTTP 201
[Captures]
void_visit_id: jsonpath "$.id"


PATCH {{api}}/dental/visits/{{void_visit_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "active"
}
HTTP 200


POST {{api}}/dental/visits/{{void_visit_id}}/treatments
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{void_visit_id}}",
  "patientId": "{{patient_id}}",
  "cdtCode": "D2391",
  "description": "Resin composite, one surface",
  "toothNumber": 36,
  "surfaces": ["mesial"],
  "priceCents": 15000
}
HTTP 201
[Captures]
void_treatment_id: jsonpath "$.id"


POST {{api}}/dental/visits/{{void_visit_id}}/consents
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{void_visit_id}}",
  "patientId": "{{patient_id}}",
  "templateId": "general-consent",
  "templateName": "General Treatment Consent"
}
HTTP 201
[Captures]
void_consent_id: jsonpath "$.id"


POST {{api}}/dental/visits/{{void_visit_id}}/consents/{{void_consent_id}}/sign
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "signatureData": "data:image/png;base64,iVBORw0KGgo="
}
HTTP 200


PATCH {{api}}/dental/visits/{{void_visit_id}}/treatments/{{void_treatment_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "planned"
}
HTTP 200


PATCH {{api}}/dental/visits/{{void_visit_id}}/treatments/{{void_treatment_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "performed"
}
HTTP 200


POST {{api}}/dental/billing/invoices
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "branchId": "{{branch_id}}",
  "visitId": "{{void_visit_id}}",
  "dentistMemberId": "{{dentist_member_id}}"
}
HTTP 201
[Captures]
void_invoice_id: jsonpath "$.id"


POST {{api}}/dental/billing/invoices/{{void_invoice_id}}/void
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "reason": "Duplicate invoice created in error"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "voided"
jsonpath "$.voidedAt" != null


# BR-050: manual statement send — returns the patient's outstanding balance and
# whether a billing notification was enqueued (email + push).
POST {{api}}/dental/billing/patients/{{patient_id}}/statement/send
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{}
HTTP 200
[Asserts]
jsonpath "$.patientId" == "{{patient_id}}"
jsonpath "$.sent" isBoolean
jsonpath "$.outstandingBalanceCents" isInteger
jsonpath "$.channels" isCollection


# Phase 2.4 (BR-051): log a collections outreach note, then read the worklist.
POST {{api}}/dental/billing/collections/notes
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "note": "Called patient re: outstanding balance, left voicemail",
  "contactChannel": "phone"
}
HTTP 201
[Asserts]
jsonpath "$.id" exists
jsonpath "$.patientId" == "{{patient_id}}"
jsonpath "$.contactChannel" == "phone"


GET {{api}}/dental/billing/collections/worklist?branchId={{branch_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.rows" isCollection
jsonpath "$.asOf" exists


# Phase 3.1: AR KPI dashboard — DSO, collection rate, write-off, AR + aging.
GET {{api}}/dental/billing/collections/kpis?branchId={{branch_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.outstandingArCents" isInteger
jsonpath "$.billedTotalCents" isInteger
jsonpath "$.collectionRate" exists
jsonpath "$.dsoDays" isInteger
jsonpath "$.agingSeries" count == 4


# Phase 4.1 (BR-052): patient credit ledger. Add a credit, then read the balance.
# (apply-credit happy + BR-052 caps are integration-tested in
#  dental-billing.patient-credits.test.ts — 7 cases incl. atomic rollback.)
POST {{api}}/dental/billing/patients/{{patient_id}}/credits
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "amountCents": 5000,
  "source": "manual",
  "note": "Goodwill credit"
}
HTTP 201
[Asserts]
jsonpath "$.id" exists
jsonpath "$.amountCents" == 5000
jsonpath "$.source" == "manual"


GET {{api}}/dental/billing/patients/{{patient_id}}/credits
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.balanceCents" == 5000
jsonpath "$.credits" isCollection
