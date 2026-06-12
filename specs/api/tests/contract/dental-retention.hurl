# Dental Retention status contract tests (FR8.14)
# Route: GET /dental/retention-status
# Spec:  specs/api/src/modules/dental-retention.tsp
# RBAC:  Admin-only (user.role === 'admin' on the Better-Auth session). A regular
#        signed-up user is always 403. This pins the GENERATED route's admin gate
#        (authMiddleware roles:["admin"]) end-to-end, which the handler unit test
#        — mounted without the generated middleware — cannot exercise.

# ============================================================
# Scenario 1: 401 gate — run BEFORE any sign-in so the cookie jar is empty.
# ============================================================

GET {{api}}/dental/retention-status
HTTP 401
[Asserts]
jsonpath "$.code" == "UNAUTHORIZED"


# ============================================================
# Scenario 2: Sign up a non-admin user (role: user) for the role gate.
# ============================================================

POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "retention-nonadmin-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Retention NonAdmin"
}
HTTP 200
[Captures]
nonadmin_session: cookie "better-auth.session_token"
[Asserts]
jsonpath "$.user.role" == "user"


# ============================================================
# Scenario 3: Non-admin → 403 (the generated admin gate fires).
# ============================================================

GET {{api}}/dental/retention-status
Cookie: better-auth.session_token={{nonadmin_session}}
HTTP 403
[Asserts]
jsonpath "$.code" == "FORBIDDEN"


# ============================================================
# Scenario 4: Sign in as the admin user (runner injects admin creds).
# ============================================================

POST {{api}}/auth/sign-in/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "{{admin_email}}",
  "password": "{{admin_password}}"
}
HTTP 200
[Captures]
admin_session: cookie "better-auth.session_token"
[Asserts]
jsonpath "$.user.role" == "admin"


# ============================================================
# Scenario 5: Admin → 200 with the retention status wire shape.
# Counts depend on the persistent contract DB's retention history, so assert
# field presence/types (not exact values).
# ============================================================

GET {{api}}/dental/retention-status
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$.enforcementEnabled" isBoolean
jsonpath "$.runsObserved" isInteger
jsonpath "$.lastActionedCount" isInteger
jsonpath "$.lastEligibleCount" isInteger


# ============================================================
# Scenario 6: Admin → 200 with an explicit tenantId filter (well-formed UUID).
# ============================================================

GET {{api}}/dental/retention-status?tenantId=a1000000-0000-4000-8000-000000000001
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$.enforcementEnabled" isBoolean
jsonpath "$.runsObserved" isInteger
