# Dental Erasure-Request contract tests (V-DG-002 / WFG-006 / RA-10173)
# Routes: POST /dental/erasure-requests
#         GET  /dental/erasure-requests
#         GET  /dental/erasure-requests/{id}
#         POST /dental/erasure-requests/{id}/approve
#         POST /dental/erasure-requests/{id}/reject
# Spec:   specs/api/src/modules/dental-erasure.tsp
# RBAC:   Admin-only (user.role === 'admin' — identical gate to dental-legalhold).
#
# KEY CROSS-MODULE EDGE (V-DG-002 + B1):
#   When the subject is under an ACTIVE legal hold, POST …/{id}/approve returns
#   200 with status="rejected" + legalHoldBlocked=true + a fixed rejection reason.
#   The hold is queried via isPersonUnderLegalHold (legal-hold.facade → live store).
#   After releasing the hold a FRESH request (the rejected one cannot be re-approved)
#   can be approved → status="anonymized".
#
# Run-unique isolation: the contract DB is NOT reseeded between runs. We use the
# server-issued user.id of a fresh sign-up as the subjectPersonId — a real UUID
# unique to this run. Every list query is scoped to that subjectPersonId so count
# assertions are deterministic regardless of prior state.

# ============================================================
# Scenario 1: 401 gates — run BEFORE any sign-in so the cookie jar is empty.
# The auth guard fires before any resource lookup; placeholder UUIDs suffice.
# ============================================================

POST {{api}}/dental/erasure-requests
Content-Type: application/json
{
  "subjectPersonId": "00000000-0000-4000-8000-000000000001",
  "tenantId":        "00000000-0000-4000-8000-000000000002",
  "reason":          "401 gate check"
}
HTTP 401
[Asserts]
jsonpath "$.code" == "UNAUTHORIZED"


GET {{api}}/dental/erasure-requests
HTTP 401
[Asserts]
jsonpath "$.code" == "UNAUTHORIZED"


GET {{api}}/dental/erasure-requests/00000000-0000-4000-8000-000000000099
HTTP 401
[Asserts]
jsonpath "$.code" == "UNAUTHORIZED"


POST {{api}}/dental/erasure-requests/00000000-0000-4000-8000-000000000099/approve
HTTP 401
[Asserts]
jsonpath "$.code" == "UNAUTHORIZED"


POST {{api}}/dental/erasure-requests/00000000-0000-4000-8000-000000000099/reject
Content-Type: application/json
{
  "rejectionReason": "401 gate check"
}
HTTP 401
[Asserts]
jsonpath "$.code" == "UNAUTHORIZED"


# ============================================================
# Scenario 2a: Sign up the erasure SUBJECT.
# Its server-issued user.id is a fresh UUID — used as subjectPersonId so list
# queries are scoped to exactly this run's erasure requests. The same non-admin
# user is re-used for the role-gate check in Scenario 8.
# ============================================================

POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "erasure-subject-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Erasure Subject"
}
HTTP 200
[Captures]
subject_person_id: jsonpath "$.user.id"
[Asserts]
jsonpath "$.user.id" isString
jsonpath "$.user.role" == "user"


# ============================================================
# Scenario 2b: Sign in as the admin user.
# The runner's preflight ensures the admin exists + sets AUTH_ADMIN_EMAILS.
# Signing in here puts the admin session into the Hurl cookie jar for the
# admin-only flow below.
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
# Scenario 3: Create an erasure request (201).
# Assert: 201, status=requested, subject/tenantId/reason echoed,
# requestedBy=admin_user_id, reviewedBy/reviewedAt/processedAt null.
# ============================================================

POST {{api}}/dental/erasure-requests
Cookie: better-auth.session_token={{admin_session}}
Content-Type: application/json
{
  "subjectPersonId": "{{subject_person_id}}",
  "tenantId":        "a1000000-0000-4000-8000-000000000001",
  "reason":          "Art.17 GDPR erasure request - contract test {{suffix}}"
}
HTTP 201
[Captures]
erasure_id: jsonpath "$.id"
[Asserts]
jsonpath "$.id" isString
jsonpath "$.status" == "requested"
jsonpath "$.subjectPersonId" == "{{subject_person_id}}"
jsonpath "$.tenantId" == "a1000000-0000-4000-8000-000000000001"
jsonpath "$.reason" == "Art.17 GDPR erasure request - contract test {{suffix}}"
jsonpath "$.requestedBy" == "{{admin_user_id}}"
jsonpath "$.legalHoldBlocked" == false
jsonpath "$.reviewedBy" == null
jsonpath "$.reviewedAt" == null
jsonpath "$.processedAt" == null
jsonpath "$.rejectionReason" == null
jsonpath "$.createdAt" isString
jsonpath "$.updatedAt" isString


# ============================================================
# Scenario 4a: GET /dental/erasure-requests (200) — list after creating one.
# Scoped to the run-unique subjectPersonId: must be EXACTLY the one request
# we just created so count == 1 and [0].id matches.
# ============================================================

GET {{api}}/dental/erasure-requests?subjectPersonId={{subject_person_id}}
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.data" count == 1
jsonpath "$.data[0].id" == "{{erasure_id}}"
jsonpath "$.data[0].status" == "requested"
jsonpath "$.data[0].subjectPersonId" == "{{subject_person_id}}"
jsonpath "$.data[0].tenantId" == "a1000000-0000-4000-8000-000000000001"
jsonpath "$.data[0].requestedBy" == "{{admin_user_id}}"
jsonpath "$.data[0].legalHoldBlocked" == false


# status=requested filter — proves filter discriminates (our request is included).
GET {{api}}/dental/erasure-requests?status=requested&subjectPersonId={{subject_person_id}}
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.data" count == 1
jsonpath "$.data[0].id" == "{{erasure_id}}"
jsonpath "$.data[0].status" == "requested"


# status=anonymized filter — must be EMPTY (nothing approved yet for this subject).
GET {{api}}/dental/erasure-requests?status=anonymized&subjectPersonId={{subject_person_id}}
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.data" count == 0


# ============================================================
# Scenario 4b: GET /dental/erasure-requests/{id} (200) — fetch the single request.
# ============================================================

GET {{api}}/dental/erasure-requests/{{erasure_id}}
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{erasure_id}}"
jsonpath "$.status" == "requested"
jsonpath "$.subjectPersonId" == "{{subject_person_id}}"
jsonpath "$.tenantId" == "a1000000-0000-4000-8000-000000000001"
jsonpath "$.reason" == "Art.17 GDPR erasure request - contract test {{suffix}}"
jsonpath "$.requestedBy" == "{{admin_user_id}}"
jsonpath "$.legalHoldBlocked" == false
jsonpath "$.reviewedBy" == null


# ============================================================
# Scenario 5: Reject path — create a second request then reject it.
# Assert: POST …/{id}/reject → 200, status=rejected, rejectionReason echoed.
# The list should now contain both requests for this subject.
# ============================================================

POST {{api}}/dental/erasure-requests
Cookie: better-auth.session_token={{admin_session}}
Content-Type: application/json
{
  "subjectPersonId": "{{subject_person_id}}",
  "tenantId":        "a1000000-0000-4000-8000-000000000001",
  "reason":          "Second erasure request for reject-path test {{suffix}}"
}
HTTP 201
[Captures]
erasure_id_reject: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "requested"


POST {{api}}/dental/erasure-requests/{{erasure_id_reject}}/reject
Cookie: better-auth.session_token={{admin_session}}
Content-Type: application/json
{
  "rejectionReason": "Insufficient documentation provided — contract test {{suffix}}"
}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{erasure_id_reject}}"
jsonpath "$.status" == "rejected"
jsonpath "$.rejectionReason" == "Insufficient documentation provided — contract test {{suffix}}"
jsonpath "$.reviewedBy" == "{{admin_user_id}}"
jsonpath "$.reviewedAt" isString
jsonpath "$.reviewedAt" != null
jsonpath "$.legalHoldBlocked" == false
jsonpath "$.processedAt" == null
# Subject PII not touched — subjectPersonId still present
jsonpath "$.subjectPersonId" == "{{subject_person_id}}"


# Two requests now exist for this subject: one 'requested', one 'rejected'.
GET {{api}}/dental/erasure-requests?subjectPersonId={{subject_person_id}}
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.data" count == 2


# status=rejected filter: only the rejected one shows.
GET {{api}}/dental/erasure-requests?status=rejected&subjectPersonId={{subject_person_id}}
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.data" count == 1
jsonpath "$.data[0].id" == "{{erasure_id_reject}}"
jsonpath "$.data[0].status" == "rejected"
jsonpath "$.data[0].legalHoldBlocked" == false


# ============================================================
# Scenario 6 — KEY CROSS-MODULE EDGE: legal-hold blocks erasure approval.
#
# REAL BEHAVIOR (verified in erasure-service.ts + erasure-legalhold.test.ts):
#   - The service calls isPersonUnderLegalHold(db, subjectPersonId) from the
#     legal-hold facade (live store query — not a caller flag).
#   - When blocked: anonymizeSubject returns blockedByLegalHold=true; the
#     service writes status='rejected', legalHoldBlocked=true, and
#     rejectionReason='Subject under an active legal hold — erasure refused'.
#   - The HANDLER returns ctx.json(request, 200) — this is NOT a 409/422 error.
#     It is a 200 response whose body encodes the block via status+legalHoldBlocked.
#   - The original erasure_id request (from Scenario 3) is still 'requested' and
#     is used here.
#
# Step 1: Place a legal hold on the subject (POST /dental/legal-holds, admin-only).
# Step 2: Approve the still-pending erasure_id → expect 200, status='rejected',
#         legalHoldBlocked=true, rejectionReason contains "legal hold".
# Step 3: Release the hold (POST /dental/legal-holds/{hold_id}/release).
# Step 4: Create a FRESH erasure request (rejected cannot be re-approved; service
#         enforces req.status === 'requested').
# Step 5: Approve fresh request → expect 200, status='anonymized' — erasure succeeds.
# ============================================================

# 6-a: Place a legal hold on the subject (admin-only).
POST {{api}}/dental/legal-holds
Cookie: better-auth.session_token={{admin_session}}
Content-Type: application/json
{
  "tenantId":        "a1000000-0000-4000-8000-000000000001",
  "subjectPersonId": "{{subject_person_id}}",
  "name":            "LH Erasure Block {{suffix}}",
  "reason":          "Ongoing litigation — erasure blocked for contract test",
  "note":            "Placed by dental-erasure contract suite"
}
HTTP 201
[Captures]
hold_id: jsonpath "$.id"
[Asserts]
jsonpath "$.id" isString
jsonpath "$.status" == "active"
jsonpath "$.subjectPersonId" == "{{subject_person_id}}"


# 6-b: Approve the still-pending erasure request while the hold is active.
# EXPECTED: 200 (not 409/422) with status='rejected' and legalHoldBlocked=true.
POST {{api}}/dental/erasure-requests/{{erasure_id}}/approve
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{erasure_id}}"
jsonpath "$.status" == "rejected"
jsonpath "$.legalHoldBlocked" == true
jsonpath "$.rejectionReason" == "Subject under an active legal hold — erasure refused"
jsonpath "$.reviewedBy" == "{{admin_user_id}}"
jsonpath "$.reviewedAt" isString
jsonpath "$.reviewedAt" != null
# Subject PII must NOT be anonymized — the request was blocked
jsonpath "$.subjectPersonId" == "{{subject_person_id}}"


# 6-c: Release the legal hold.
POST {{api}}/dental/legal-holds/{{hold_id}}/release
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{hold_id}}"
jsonpath "$.status" == "released"
jsonpath "$.releasedBy" == "{{admin_user_id}}"
jsonpath "$.releasedAt" isString


# 6-d: Create a FRESH erasure request after the hold is released.
# (The blocked one is now 'rejected' and cannot be re-approved — the service
# enforces status === 'requested' as a precondition for approval.)
POST {{api}}/dental/erasure-requests
Cookie: better-auth.session_token={{admin_session}}
Content-Type: application/json
{
  "subjectPersonId": "{{subject_person_id}}",
  "tenantId":        "a1000000-0000-4000-8000-000000000001",
  "reason":          "Art.17 re-request after hold released — contract test {{suffix}}"
}
HTTP 201
[Captures]
erasure_id_fresh: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "requested"
jsonpath "$.legalHoldBlocked" == false


# 6-e: Approve the fresh request — no hold active, so erasure must succeed.
# EXPECTED: 200 with status='anonymized'.
POST {{api}}/dental/erasure-requests/{{erasure_id_fresh}}/approve
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{erasure_id_fresh}}"
jsonpath "$.status" == "anonymized"
jsonpath "$.legalHoldBlocked" == false
jsonpath "$.reviewedBy" == "{{admin_user_id}}"
jsonpath "$.reviewedAt" isString
jsonpath "$.reviewedAt" != null
jsonpath "$.processedAt" isString
jsonpath "$.processedAt" != null


# ============================================================
# Scenario 7: 404 on a well-formed but non-existent erasure request UUID.
# ============================================================

GET {{api}}/dental/erasure-requests/00000000-0000-4000-8000-000000000000
Cookie: better-auth.session_token={{admin_session}}
HTTP 404
[Asserts]
jsonpath "$.code" == "NOT_FOUND"


POST {{api}}/dental/erasure-requests/00000000-0000-4000-8000-000000000000/approve
Cookie: better-auth.session_token={{admin_session}}
HTTP 404
[Asserts]
jsonpath "$.code" == "NOT_FOUND"


POST {{api}}/dental/erasure-requests/00000000-0000-4000-8000-000000000000/reject
Cookie: better-auth.session_token={{admin_session}}
Content-Type: application/json
{
  "rejectionReason": "Does not exist"
}
HTTP 404
[Asserts]
jsonpath "$.code" == "NOT_FOUND"


# ============================================================
# Scenario 8: Role gate — a non-admin user must receive 403 on every operation.
# Sign in as the non-admin subject signed up in Scenario 2a.
# ============================================================

POST {{api}}/auth/sign-in/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "erasure-subject-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest"
}
HTTP 200
[Captures]
nonadmin_session: cookie "better-auth.session_token"
[Asserts]
jsonpath "$.user.role" == "user"


POST {{api}}/dental/erasure-requests
Cookie: better-auth.session_token={{nonadmin_session}}
Content-Type: application/json
{
  "subjectPersonId": "{{subject_person_id}}",
  "tenantId":        "a1000000-0000-4000-8000-000000000001",
  "reason":          "Should be forbidden"
}
HTTP 403
[Asserts]
jsonpath "$.code" == "FORBIDDEN"


GET {{api}}/dental/erasure-requests
Cookie: better-auth.session_token={{nonadmin_session}}
HTTP 403
[Asserts]
jsonpath "$.code" == "FORBIDDEN"


GET {{api}}/dental/erasure-requests/{{erasure_id}}
Cookie: better-auth.session_token={{nonadmin_session}}
HTTP 403
[Asserts]
jsonpath "$.code" == "FORBIDDEN"


POST {{api}}/dental/erasure-requests/{{erasure_id}}/approve
Cookie: better-auth.session_token={{nonadmin_session}}
HTTP 403
[Asserts]
jsonpath "$.code" == "FORBIDDEN"


POST {{api}}/dental/erasure-requests/{{erasure_id}}/reject
Cookie: better-auth.session_token={{nonadmin_session}}
Content-Type: application/json
{
  "rejectionReason": "Should be forbidden"
}
HTTP 403
[Asserts]
jsonpath "$.code" == "FORBIDDEN"


# ============================================================
# Scenario 9: Double-approve (status-guard) — re-approve the 'rejected' request
# (blocked by hold in 6-b). Service requires status='requested'; any other
# status must yield 400 VALIDATION_ERROR.
# Re-sign-in as admin first to restore the admin cookie jar.
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


POST {{api}}/dental/erasure-requests/{{erasure_id}}/approve
Cookie: better-auth.session_token={{admin_session2}}
HTTP 400
[Asserts]
jsonpath "$.code" == "VALIDATION_ERROR"
jsonpath "$.message" contains "rejected"


# ============================================================
# Scenario 10: Validation — missing required fields on create.
# ============================================================

POST {{api}}/dental/erasure-requests
Cookie: better-auth.session_token={{admin_session2}}
Content-Type: application/json
{
  "tenantId": "a1000000-0000-4000-8000-000000000001"
}
HTTP 400
[Asserts]
jsonpath "$.code" == "VALIDATION_ERROR"
jsonpath "$.fieldErrors" isCollection
jsonpath "$.fieldErrors[*].field" contains "subjectPersonId"
jsonpath "$.fieldErrors[*].field" contains "reason"
