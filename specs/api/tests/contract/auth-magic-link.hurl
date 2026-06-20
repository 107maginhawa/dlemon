# Magic-link sign-in round-trip — the SOLE patient login path (WF-003).
#
# Before this contract existed there was NO test of any kind for magic-link, and
# the flow was in fact BROKEN: Better-Auth queued the email with the
# `auth.magic-link` template tag, but no such template existed in the initializer,
# so the queue processor threw "No active template found" and the link was never
# delivered — patients were silently locked out. Adding the template fixed it; this
# contract guards the whole round-trip so the regression can never return undetected.
#
# The exercise (mirrors auth-verification / auth-password-reset):
#   1. Request a magic link for a fresh email (Better-Auth auto-creates the user).
#   2. Poll Mailpit (the local SMTP catcher) until the email lands.
#   3. Extract the /auth/magic-link/verify?token=... URL from the plain-text body.
#   4. Follow it → consumes the token and establishes a session.
#   5. Independent read: GET /auth/get-session proves the session is real (the
#      durable goal state), tied to the same email.
#
# The runner injects {{api}}, {{suffix}} (per-run unique), {{mailpit_api}}.
# Mailpit-gated (infra), like the sibling auth-email scenarios.

# 1. Request the magic link.
POST {{api}}/auth/sign-in/magic-link
Content-Type: application/json
Origin: {{api}}
{
  "email": "magic-{{suffix}}@example.org",
  "callbackURL": "/"
}
HTTP 200


# 2. Poll Mailpit for the magic-link email.
GET {{mailpit_api}}/api/v1/search?query=to:magic-{{suffix}}@example.org&limit=1
[Options]
retry: 60
retry-interval: 1000ms
HTTP 200
[Captures]
message_id: jsonpath "$.messages[0].ID"
[Asserts]
jsonpath "$.count" >= 1
jsonpath "$.messages[0].Subject" matches "(?i)sign.?in"


# 3. Extract the magic-link verify URL from the plain-text body. It looks like:
#   http://localhost:7213/auth/magic-link/verify?token=<TOKEN>&callbackURL=/
GET {{mailpit_api}}/api/v1/message/{{message_id}}
HTTP 200
[Captures]
magic_link: jsonpath "$.Text" regex "(http://[^\\s]*?/auth/magic-link/verify\\?[^\\s]+)"


# 4. Consume the magic link → establishes a session (302 to callbackURL, or 200).
GET {{magic_link}}
HTTP *
[Asserts]
status >= 200
status < 400


# 5. Independent read: the session is durable and tied to this email.
GET {{api}}/auth/get-session
HTTP 200
[Asserts]
jsonpath "$.user.email" == "magic-{{suffix}}@example.org"
