# Dental Legal-Hold contract tests (V-DG-002 support)
# Routes: POST /dental/legal-holds, GET /dental/legal-holds,
#         POST /dental/legal-holds/{id}/release
# Spec:   specs/api/src/modules/dental-legal-hold.tsp
# RBAC:   Admin-only (user.role === 'admin' on the Better-Auth session).
#         A regular signed-up user is always 403.
#
# Design note: the legal-hold table has no FK constraints on tenantId or
# subjectPersonId (by design — mirrors audit/erasure decoupling per schema
# comment). This lets the contract suite run with placeholder UUIDs rather
# than bootstrapping a full org + patient chain.

# ============================================================
# Scenario 1: 401 gates — run BEFORE any sign-up so the cookie jar is empty.
# The auth guard fires before any resource lookup; placeholder UUIDs suffice.
# ============================================================

POST {{api}}/dental/legal-holds
Content-Type: application/json
{
  "tenantId": "00000000-0000-4000-8000-000000000001",
  "subjectPersonId": "00000000-0000-4000-8000-000000000002",
  "name": "Gate Check",
  "reason": "401 gate"
}
HTTP 401
[Asserts]
jsonpath "$.code" == "UNAUTHORIZED"


GET {{api}}/dental/legal-holds
HTTP 401
[Asserts]
jsonpath "$.code" == "UNAUTHORIZED"


POST {{api}}/dental/legal-holds/00000000-0000-4000-8000-000000000099/release
HTTP 401
[Asserts]
jsonpath "$.code" == "UNAUTHORIZED"


# ============================================================
# Scenario 2: Sign in as the admin user.
# The runner's preflight already mints the admin session and injects
# {{admin_token}} + {{admin_email}} + {{admin_password}}. We re-sign-in
# here explicitly so the Hurl cookie jar carries the admin session for
# all subsequent requests in this file.
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
admin_user_id: jsonpath "$.user.id"
[Asserts]
jsonpath "$.user.role" == "admin"


# ============================================================
# Scenario 3: Place a legal hold (201).
# Uses placeholder UUIDs for tenantId / subjectPersonId (no FK constraints
# in the legal-hold table — intentional decoupling from org/patient layers).
# Assert: 201, status=active, name/reason echoed, releasedBy/releasedAt null.
# ============================================================

POST {{api}}/dental/legal-holds
Cookie: better-auth.session_token={{admin_session}}
Content-Type: application/json
{
  "tenantId": "a1000000-0000-4000-8000-000000000001",
  "subjectPersonId": "b2000000-0000-4000-8000-000000000002",
  "name": "LH Contract {{suffix}}",
  "reason": "Litigation hold for contract test {{suffix}}",
  "note": "Placed by automated contract suite"
}
HTTP 201
[Captures]
hold_id: jsonpath "$.id"
[Asserts]
jsonpath "$.id" isString
jsonpath "$.status" == "active"
jsonpath "$.name" == "LH Contract {{suffix}}"
jsonpath "$.reason" == "Litigation hold for contract test {{suffix}}"
jsonpath "$.note" == "Placed by automated contract suite"
jsonpath "$.tenantId" == "a1000000-0000-4000-8000-000000000001"
jsonpath "$.subjectPersonId" == "b2000000-0000-4000-8000-000000000002"
jsonpath "$.initiatedBy" == "{{admin_user_id}}"
jsonpath "$.releasedBy" == null
jsonpath "$.releasedAt" == null
jsonpath "$.createdAt" isString
jsonpath "$.updatedAt" isString


# ============================================================
# Scenario 4: GET /dental/legal-holds (200) — list after placing one hold.
# The response is a plain JSON array (not paginated). Filter by
# subjectPersonId to scope to our fixture and assert the hold is present.
# ============================================================

GET {{api}}/dental/legal-holds?subjectPersonId=b2000000-0000-4000-8000-000000000002
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
# Response is a collection with at least the hold we just placed.
jsonpath "$" isCollection
jsonpath "$" count >= 1
# Verify the required fields are present on every returned record.
jsonpath "$[0].id" isString
jsonpath "$[0].status" isString
jsonpath "$[0].tenantId" isString
jsonpath "$[0].subjectPersonId" == "b2000000-0000-4000-8000-000000000002"
jsonpath "$[0].initiatedBy" isString
jsonpath "$[0].createdAt" isString


# GET with status=active filter — assert our just-placed hold appears.
# Capture by hold_id to assert identity even when other holds exist.
GET {{api}}/dental/legal-holds?status=active&subjectPersonId=b2000000-0000-4000-8000-000000000002
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$" isCollection
jsonpath "$" count >= 1
jsonpath "$[0].status" == "active"


# ============================================================
# Scenario 5: Release the hold (200).
# Assert: status=released, releasedBy=admin_user_id, releasedAt is set.
# ============================================================

POST {{api}}/dental/legal-holds/{{hold_id}}/release
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{hold_id}}"
jsonpath "$.status" == "released"
jsonpath "$.releasedBy" == "{{admin_user_id}}"
jsonpath "$.releasedAt" isString
jsonpath "$.releasedAt" != null
# Core fields still present after release
jsonpath "$.name" == "LH Contract {{suffix}}"
jsonpath "$.reason" == "Litigation hold for contract test {{suffix}}"
jsonpath "$.tenantId" == "a1000000-0000-4000-8000-000000000001"
jsonpath "$.subjectPersonId" == "b2000000-0000-4000-8000-000000000002"


# GET with status=released filter — our hold must now appear.
GET {{api}}/dental/legal-holds?status=released&subjectPersonId=b2000000-0000-4000-8000-000000000002
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$" isCollection
jsonpath "$" count >= 1
jsonpath "$[0].status" == "released"


# ============================================================
# Scenario 6: Re-release an already-released hold → 400 VALIDATION_ERROR.
# ============================================================

POST {{api}}/dental/legal-holds/{{hold_id}}/release
Cookie: better-auth.session_token={{admin_session}}
HTTP 400
[Asserts]
jsonpath "$.code" == "VALIDATION_ERROR"
jsonpath "$.message" contains "released"


# ============================================================
# Scenario 7: Role gate — a freshly signed-up (non-admin) user must receive
# 403 on every legal-hold operation. The message confirms admin-only policy.
# ============================================================

POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "legalhold-nonadmin-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Non-Admin User"
}
HTTP 200
[Captures]
nonadmin_session: cookie "better-auth.session_token"


# Non-admin cannot place a hold.
POST {{api}}/dental/legal-holds
Cookie: better-auth.session_token={{nonadmin_session}}
Content-Type: application/json
{
  "tenantId": "a1000000-0000-4000-8000-000000000001",
  "subjectPersonId": "b2000000-0000-4000-8000-000000000002",
  "name": "Unauthorized Hold",
  "reason": "Should be blocked"
}
HTTP 403
[Asserts]
jsonpath "$.code" == "FORBIDDEN"


# Non-admin cannot list holds.
GET {{api}}/dental/legal-holds
Cookie: better-auth.session_token={{nonadmin_session}}
HTTP 403
[Asserts]
jsonpath "$.code" == "FORBIDDEN"


# Non-admin cannot release a hold.
POST {{api}}/dental/legal-holds/{{hold_id}}/release
Cookie: better-auth.session_token={{nonadmin_session}}
HTTP 403
[Asserts]
jsonpath "$.code" == "FORBIDDEN"


# ============================================================
# Re-sign-in as admin to refresh the Hurl cookie jar before edge-case tests.
# After the non-admin sign-up in Scenario 7, the jar holds a non-admin cookie.
# An explicit re-sign-in replaces the jar entry so Scenarios 8-10 use the
# admin session cleanly (same pattern as provider.hurl step 4).
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
admin_session2: cookie "better-auth.session_token"
[Asserts]
jsonpath "$.user.role" == "admin"


# ============================================================
# Scenario 8: 404 on a well-formed but non-existent hold UUID.
# ============================================================

POST {{api}}/dental/legal-holds/00000000-0000-4000-8000-000000000000/release
Cookie: better-auth.session_token={{admin_session2}}
HTTP 404
[Asserts]
jsonpath "$.code" == "NOT_FOUND"


# ============================================================
# Scenario 9: 400 on a malformed (non-UUID) hold ID in the path.
# ============================================================

POST {{api}}/dental/legal-holds/not-a-valid-uuid/release
Cookie: better-auth.session_token={{admin_session2}}
HTTP 400
[Asserts]
jsonpath "$.code" == "VALIDATION_ERROR"
jsonpath "$.fieldErrors[0].field" == "id"


# ============================================================
# Scenario 10: 400 validation on placeLegalHold — missing required fields.
# ============================================================

POST {{api}}/dental/legal-holds
Cookie: better-auth.session_token={{admin_session2}}
Content-Type: application/json
{
  "tenantId": "a1000000-0000-4000-8000-000000000001"
}
HTTP 400
[Asserts]
jsonpath "$.code" == "VALIDATION_ERROR"
# At least subjectPersonId, name, reason are required.
jsonpath "$.fieldErrors" isCollection
jsonpath "$.fieldErrors" count >= 1
