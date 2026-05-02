# Auth email verification round-trip. The contract exercise:
#
#   1. Sign up a fresh user -> Better-Auth queues a verification email.
#   2. Mailpit (the local SMTP catcher) receives it; we poll its HTTP API
#      until the message lands.
#   3. Extract the verification URL from the message body and follow it.
#
# The runner injects {{mailpit_api}} (defaults to http://localhost:8025).
# The impl needs sendOnSignUp to be enabled and SMTP wired to Mailpit.

# 1. Sign up.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "verify-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Verify Tester"
}
HTTP 200


# 2. Poll Mailpit for the queued message.
GET {{mailpit_api}}/api/v1/search?query=to:verify-{{suffix}}@example.org&limit=1
[Options]
retry: 60
retry-interval: 1000ms
HTTP 200
[Captures]
message_id: jsonpath "$.messages[0].ID"
[Asserts]
jsonpath "$.count" >= 1
jsonpath "$.messages[0].Subject" matches "(?i)verify"


# 3. Fetch the message body and extract the verification link from the
# plain-text part. The link looks like:
#   http://localhost:7213/auth/verify-email?token=<JWT>&callbackURL=/
GET {{mailpit_api}}/api/v1/message/{{message_id}}
HTTP 200
[Captures]
verify_link: jsonpath "$.Text" regex "(http://[^\\s]*?/auth/verify-email\\?[^\\s]+)"


# 4. Follow the verification URL.
GET {{verify_link}}
HTTP *
[Asserts]
status >= 200
status < 400
