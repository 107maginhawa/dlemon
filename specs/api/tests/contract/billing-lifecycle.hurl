# Billing lifecycle against stripe-mock: a merchant creates an account,
# drafts and finalizes an invoice, voids it. Pay/capture/refund are
# tested at the boundary (provider-not-onboarded → 422) because
# stripe-mock doesn't simulate the Connect onboarding webhook flow,
# so the merchant account stays in `pending` status without external
# state injection.

# 0. Merchant signup + person + merchant account.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "merch-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Merchant"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Merchant",
  "lastName": "Person",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
merchant_person_id: jsonpath "$.id"


POST {{api}}/billing/merchant-accounts
Content-Type: application/json
{
  "refreshUrl": "https://example.com/refresh",
  "returnUrl": "https://example.com/return"
}
HTTP 201
[Captures]
merchant_account_id: jsonpath "$.id"
[Asserts]
jsonpath "$.active" == true
jsonpath "$.metadata.stripeAccountId" exists
jsonpath "$.metadata.onboardingComplete" == false


# 1. Get merchant account back; status is 'pending' until Stripe webhook.
GET {{api}}/billing/merchant-accounts/{{merchant_account_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{merchant_account_id}}"
jsonpath "$.metadata.stripeAccountStatus" == "pending"


# 2. Re-onboarding link generation works.
POST {{api}}/billing/merchant-accounts/{{merchant_account_id}}/onboard
Content-Type: application/json
{
  "refreshUrl": "https://example.com/refresh",
  "returnUrl": "https://example.com/return"
}
HTTP 200
[Asserts]
jsonpath "$.onboardingUrl" exists


# 3. Customer signup + person (cookie jar now holds customer session).
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "cust-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Customer"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Customer",
  "lastName": "Person",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
customer_person_id: jsonpath "$.id"


# 4. Sign back in as merchant to create the invoice.
POST {{api}}/auth/sign-in/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "merch-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest"
}
HTTP 200


POST {{api}}/billing/invoices
Content-Type: application/json
{
  "customer": "{{customer_person_id}}",
  "merchant": "{{merchant_person_id}}",
  "currency": "USD",
  "lineItems": [
    { "description": "Contract test consult", "quantity": 1, "unitPrice": 2500 }
  ]
}
HTTP 201
[Captures]
invoice_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "draft"
jsonpath "$.total" == 2500
jsonpath "$.currency" == "USD"


# 5. Finalize the invoice → status 'open'.
POST {{api}}/billing/invoices/{{invoice_id}}/finalize
Content-Type: application/json
{}
HTTP 200
[Asserts]
jsonpath "$.status" == "open"


# 6. Customer attempts to pay → 422 because the merchant's Stripe Connect
# onboarding hasn't completed (stripe-mock doesn't simulate webhooks).
# Asserts the impl enforces the readiness boundary.
POST {{api}}/auth/sign-in/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "cust-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest"
}
HTTP 200


POST {{api}}/billing/invoices/{{invoice_id}}/pay
Content-Type: application/json
{}
HTTP 422
[Asserts]
jsonpath "$.code" == "PROVIDER_BILLING_INCOMPLETE"


# 7. Merchant marks the unpaid invoice as uncollectible → status 'uncollectible'.
# (void is only valid for authorized-but-uncaptured payments; an open
# invoice without an associated PaymentIntent uses uncollectible to close.)
POST {{api}}/auth/sign-in/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "merch-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest"
}
HTTP 200


POST {{api}}/billing/invoices/{{invoice_id}}/mark-uncollectible
Content-Type: application/json
{}
HTTP 200
[Asserts]
jsonpath "$.status" == "uncollectible"


# 8. List invoices includes the closed one.
GET {{api}}/billing/invoices
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.pagination.totalCount" >= 1
