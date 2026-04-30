# Email module: auth gate for non-admins, then full happy-path admin
# coverage on templates + queue. The runner-injected {{admin_email}} +
# {{admin_password}} let scenarios sign in as admin without juggling
# cookie headers.

# 1. Anonymous → 401.
GET {{api}}/email/templates
HTTP 401


# 2. Regular signed-up user → 403 (lacks admin role). Cookie jar holds
# the new user's session after sign-up.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "email-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Email Tester"
}
HTTP 200


GET {{api}}/email/templates
HTTP 403


# 3. Sign in as the seeded admin so the cookie jar holds the admin's
# session for the rest of the scenario.
POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "{{admin_email}}",
  "password": "{{admin_password}}"
}
HTTP 200


# 4. Admin lists templates - the impl auto-initializes system templates
# at startup (auth.email-verify, auth.password-reset, etc.).
GET {{api}}/email/templates
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.pagination.totalCount" >= 1


# 5. Admin creates a custom template.
POST {{api}}/email/templates
Content-Type: application/json
{
  "name": "Contract suite custom template {{suffix}}",
  "description": "Created by the contract suite",
  "subject": "Hello from contract-suite-{{suffix}}",
  "bodyHtml": "<p>Hello, this is a contract test.</p>",
  "bodyText": "Hello, this is a contract test.",
  "status": "active"
}
HTTP 201
[Captures]
template_id: jsonpath "$.id"
[Asserts]
jsonpath "$.name" matches "{{suffix}}"


# 6. Admin reads the template back.
GET {{api}}/email/templates/{{template_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{template_id}}"


# 7. Admin updates description.
PATCH {{api}}/email/templates/{{template_id}}
Content-Type: application/json
{
  "description": "Updated by contract suite"
}
HTTP 200
[Asserts]
jsonpath "$.description" == "Updated by contract suite"


# 8. Admin lists email queue (just verify shape).
GET {{api}}/email/queue
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.pagination.totalCount" exists


# 9. Filter queue by status.
GET {{api}}/email/queue?status=sent
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
