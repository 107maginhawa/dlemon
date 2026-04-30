# CORS smoke: prove the impl honours an allow-list. Each impl is free
# to ship its own deeper CORS unit tests; the contract guarantee is
# only that allowed origins get echoed in Access-Control-Allow-Origin
# and rejected origins do not.

# 1. Allowed origin (localhost:3000 is in the default CORS_ORIGINS).
OPTIONS {{api}}/persons
Origin: http://localhost:3000
Access-Control-Request-Method: GET
HTTP 204
[Asserts]
header "Access-Control-Allow-Origin" == "http://localhost:3000"
header "Access-Control-Allow-Credentials" == "true"
header "Access-Control-Allow-Methods" matches "GET"


# 2. Rejected origin: the response's ACAO must NOT echo the requesting
# origin (the impl falls back to its configured default or omits the
# header — either way, evil.com is not echoed).
OPTIONS {{api}}/persons
Origin: https://evil.com
Access-Control-Request-Method: GET
HTTP *
[Asserts]
header "Access-Control-Allow-Origin" not matches "evil\\.com"
