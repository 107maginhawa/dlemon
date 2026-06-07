# Dental Legal-Hold contract tests (V-DG-002 support)
# Routes: POST /dental/legal-holds, GET /dental/legal-holds,
#         POST /dental/legal-holds/{id}/release
# Spec:   specs/api/src/modules/dental-legal-hold.tsp
# RBAC:   Admin-only (user.role === 'admin' on the Better-Auth session).
#         A regular signed-up user is always 403.
#
# Design note: the legal-hold table has no FK constraints on tenantId or
# subjectPersonId (by design — mirrors audit/erasure decoupling per schema
# comment). To keep list assertions deterministic across re-runs (the contract
# DB persists between runs — only stale dental VISITS are swept, not holds),
# we use a RUN-UNIQUE subjectPersonId: a throwaway user signed up with a
# {{suffix}}-scoped email, whose server-issued user.id is a real, fresh UUID.
# Scoping every list query to that subjectPersonId means the result is exactly
# the hold(s) this run created — so `count == 1` proves identity, not coincidence.

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
# Scenario 2a: Sign up the legal-hold SUBJECT (a non-admin user).
# Its server-issued user.id is a fresh UUID, unique to this run — we use it as
# the subjectPersonId so list filters scope to exactly this run's hold. This
# same non-admin user is re-used (via sign-in) for the role-gate in Scenario 7.
# ============================================================

POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "legalhold-subject-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Legal Hold Subject"
}
HTTP 200
[Captures]
subject_person_id: jsonpath "$.user.id"
[Asserts]
jsonpath "$.user.id" isString
jsonpath "$.user.role" == "user"


# ============================================================
# Scenario 2b: Sign in as the admin user.
# The runner's preflight already mints the admin session and injects
# {{admin_email}} + {{admin_password}}. Signing in here puts the admin session
# in the Hurl cookie jar (replacing the subject's) for the admin-only flow.
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
# Scenario 3: Place a legal hold (201) on the run-unique subject.
# Assert: 201, status=active, name/reason/note echoed, initiatedBy=admin,
# releasedBy/releasedAt null.
# ============================================================

POST {{api}}/dental/legal-holds
Cookie: better-auth.session_token={{admin_session}}
Content-Type: application/json
{
  "tenantId": "a1000000-0000-4000-8000-000000000001",
  "subjectPersonId": "{{subject_person_id}}",
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
jsonpath "$.subjectPersonId" == "{{subject_person_id}}"
jsonpath "$.initiatedBy" == "{{admin_user_id}}"
jsonpath "$.releasedBy" == null
jsonpath "$.releasedAt" == null
jsonpath "$.createdAt" isString
jsonpath "$.updatedAt" isString


# ============================================================
# Scenario 4: GET /dental/legal-holds (200) — list after placing one hold.
# Response is a plain JSON array (not paginated). Scoped to the run-unique
# subjectPersonId, the list must be EXACTLY the one hold we just placed —
# count == 1 and the [0] record's id matches our captured hold_id.
# ============================================================

GET {{api}}/dental/legal-holds?subjectPersonId={{subject_person_id}}
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$" isCollection
jsonpath "$" count == 1
jsonpath "$[0].id" == "{{hold_id}}"
jsonpath "$[0].status" == "active"
jsonpath "$[0].tenantId" == "a1000000-0000-4000-8000-000000000001"
jsonpath "$[0].subjectPersonId" == "{{subject_person_id}}"
jsonpath "$[0].initiatedBy" == "{{admin_user_id}}"
jsonpath "$[0].createdAt" isString


# GET with status=active filter — same hold, proving the status filter is a
# (non-vacuous) subset that still contains exactly our hold.
GET {{api}}/dental/legal-holds?status=active&subjectPersonId={{subject_person_id}}
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$" isCollection
jsonpath "$" count == 1
jsonpath "$[0].id" == "{{hold_id}}"
jsonpath "$[0].status" == "active"


# status=released filter — must be EMPTY before release (proves the filter
# actually discriminates, not just echoes the whole table).
GET {{api}}/dental/legal-holds?status=released&subjectPersonId={{subject_person_id}}
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$" isCollection
jsonpath "$" count == 0


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
jsonpath "$.subjectPersonId" == "{{subject_person_id}}"


# After release: status=released now contains exactly our hold; status=active
# is now empty. Both directions verify the filter tracks the lifecycle change.
GET {{api}}/dental/legal-holds?status=released&subjectPersonId={{subject_person_id}}
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$" isCollection
jsonpath "$" count == 1
jsonpath "$[0].id" == "{{hold_id}}"
jsonpath "$[0].status" == "released"


GET {{api}}/dental/legal-holds?status=active&subjectPersonId={{subject_person_id}}
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$" isCollection
jsonpath "$" count == 0


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
# Scenario 7: Role gate — the non-admin subject user (signed up in 2a) must
# receive 403 on every legal-hold operation. The message confirms admin-only.
#
# Sign in as the non-admin first so the Hurl cookie jar carries THEIR session
# (the jar currently holds the admin session from the flow above; an explicit
# Cookie header alone does not reliably override the jar's session cookie).
# ============================================================

POST {{api}}/auth/sign-in/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "legalhold-subject-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest"
}
HTTP 200
[Captures]
nonadmin_session2: cookie "better-auth.session_token"
[Asserts]
jsonpath "$.user.role" == "user"


# Non-admin cannot place a hold.
POST {{api}}/dental/legal-holds
Cookie: better-auth.session_token={{nonadmin_session2}}
Content-Type: application/json
{
  "tenantId": "a1000000-0000-4000-8000-000000000001",
  "subjectPersonId": "{{subject_person_id}}",
  "name": "Unauthorized Hold",
  "reason": "Should be blocked"
}
HTTP 403
[Asserts]
jsonpath "$.code" == "FORBIDDEN"


# Non-admin cannot list holds.
GET {{api}}/dental/legal-holds
Cookie: better-auth.session_token={{nonadmin_session2}}
HTTP 403
[Asserts]
jsonpath "$.code" == "FORBIDDEN"


# Non-admin cannot release a hold.
POST {{api}}/dental/legal-holds/{{hold_id}}/release
Cookie: better-auth.session_token={{nonadmin_session2}}
HTTP 403
[Asserts]
jsonpath "$.code" == "FORBIDDEN"


# ============================================================
# Re-sign-in as admin to refresh the Hurl cookie jar before edge-case tests.
# The role-gate requests above left the non-admin cookie in the jar; an explicit
# re-sign-in replaces it so Scenarios 8-10 run as admin (cf. provider.hurl).
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
# PlaceLegalHoldBody requires subjectPersonId, name, reason — sending only
# tenantId must surface all three as missing, so expect >= 3 field errors and
# verify each required field is among the errored fields.
jsonpath "$.fieldErrors" isCollection
jsonpath "$.fieldErrors" count >= 3
jsonpath "$.fieldErrors[*].field" contains "subjectPersonId"
jsonpath "$.fieldErrors[*].field" contains "name"
jsonpath "$.fieldErrors[*].field" contains "reason"
