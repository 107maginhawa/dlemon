# Dental Patient Portal contract tests (E4 — Phase 1, read-only foundation)
#
# This is an EXTERNAL trust boundary. These scenarios pin the wire-level
# CONTRACT of the self-scoped /me reads, with IDOR safety as the headline:
#
#   * Identity is derived SERVER-SIDE from the session — there is NO
#     client-supplied patientId on any /me route, so cross-patient access is
#     impossible by construction.
#   * Unauthenticated → 401.
#   * An authenticated user with NO linked patient record (e.g. a staff/owner
#     account) → 403 (NOT_A_SELF_PATIENT) — never another patient's data and
#     never an empty 200 masquerading as success.
#   * Two independent users each resolve only their OWN identity (isolation):
#     because there is no patientId param, neither user can even ADDRESS the
#     other's data. Both un-linked users get the same 403; neither can
#     enumerate the other.
#
# NOTE on Hurl's cookie jar: Hurl auto-replays the most-recent Set-Cookie, so
# we run user A's assertions right after A signs up (jar holds A), then sign up
# user B and run B's assertions (jar holds B). Unauthenticated checks force a
# Bearer header to defeat the auto-replayed cookie (mirrors sibling suites).
#
# The 200-own-data path (a patient reading their own appointments/invoices/
# balance) requires an account whose person owns a dental_patient row. There
# is no self-registration API in Phase 1 that links a signup to a patient
# record, so that path is exhaustively covered by the backend unit suite
# (services/api-ts/src/handlers/dental-portal/dental-portal.test.ts) against a
# real Postgres with two patients, proving 200-own + isolation both directions
# + voided-hidden + projection. This suite covers everything the wire contract
# can prove without a DB seed: the 401/403 boundary and cross-user isolation.

# ==========================================================================
# 401 — unauthenticated requests are rejected on every /me read
# (Bearer override defeats Hurl's auto-replayed session cookie → true 401)
# ==========================================================================

GET {{api}}/me/appointments
Authorization: Bearer invalid-no-session
HTTP 401

GET {{api}}/me/invoices
Authorization: Bearer invalid-no-session
HTTP 401

GET {{api}}/me/balance
Authorization: Bearer invalid-no-session
HTTP 401


# ── User A: sign up (jar now holds A's session) ───────────────────────────
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "portal-a-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Portal User A"
}
HTTP 200
[Captures]
user_a_id: jsonpath "$.user.id"
[Asserts]
jsonpath "$.user.id" exists


# ── 403 — user A has no linked patient → NOT_A_SELF_PATIENT on every read ──
GET {{api}}/me/appointments
HTTP 403
[Asserts]
jsonpath "$.code" == "NOT_A_SELF_PATIENT"

GET {{api}}/me/invoices
HTTP 403
[Asserts]
jsonpath "$.code" == "NOT_A_SELF_PATIENT"

GET {{api}}/me/balance
HTTP 403
[Asserts]
jsonpath "$.code" == "NOT_A_SELF_PATIENT"


# ── User B: sign up (jar now holds B's session) ───────────────────────────
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "portal-b-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Portal User B"
}
HTTP 200
[Captures]
user_b_id: jsonpath "$.user.id"
[Asserts]
jsonpath "$.user.id" exists
# Isolation precondition: A and B are genuinely distinct accounts.
jsonpath "$.user.id" != "{{user_a_id}}"


# ── 403 — the SECOND, independent user gets the same 403. Neither user can
#    reach the other's data: with no patientId param there is nothing to
#    tamper, so each request resolves strictly to the caller's own (absent)
#    patient identity. ───────────────────────────────────────────────────────
GET {{api}}/me/appointments
HTTP 403
[Asserts]
jsonpath "$.code" == "NOT_A_SELF_PATIENT"

GET {{api}}/me/invoices
HTTP 403
[Asserts]
jsonpath "$.code" == "NOT_A_SELF_PATIENT"

GET {{api}}/me/balance
HTTP 403
[Asserts]
jsonpath "$.code" == "NOT_A_SELF_PATIENT"
