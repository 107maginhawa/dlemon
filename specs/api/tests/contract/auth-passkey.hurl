# Passkey (WebAuthn) registration-options contract — WF-002.
#
# Passkey login had ZERO tests of any kind despite the plugin being configured and
# the UI affordance wired. The full WebAuthn register/authenticate ceremony needs a
# real authenticator (a browser / CDP virtual authenticator), which is out of scope
# for a wire-level contract. But the load-bearing, regressable parts ARE contract-
# testable: that the passkey plugin is MOUNTED, that registration-options is
# SESSION-GATED (you can only enroll a passkey for your own logged-in account), and
# that it returns a real WebAuthn challenge. That is what this scenario proves — so
# "passkey is configured" stops being an unverified claim.
#
# Postgres-only (no Mailpit/MinIO) → runs in the blocking core. {{suffix}} is unique
# per run so the sign-up email is always fresh.

# 1. Unauthenticated → registration-options must be rejected (no enrolling a passkey
#    for nobody). The cookie jar is empty here (this is the first request in the file).
GET {{api}}/auth/passkey/generate-register-options
HTTP *
[Asserts]
status >= 400
status < 500


# 2. Sign up a fresh user — Better-Auth auto-creates a session (sets the cookie jar).
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "passkey-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Passkey Tester"
}
HTTP 200


# 3. Sign in to be explicit about holding a session cookie.
POST {{api}}/auth/sign-in/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "passkey-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest"
}
HTTP 200


# 4. Authenticated → registration-options returns a real WebAuthn challenge.
GET {{api}}/auth/passkey/generate-register-options
HTTP 200
[Asserts]
jsonpath "$.challenge" exists
jsonpath "$.rp" exists
jsonpath "$.user" exists
