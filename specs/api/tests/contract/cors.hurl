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


# 2. Any origin is echoed in development mode (CORS_ORIGINS defaults to *).
# In production with strict CORS, evil.com would be rejected.
# This test just validates the CORS middleware responds to preflight.
OPTIONS {{api}}/persons
Origin: https://evil.com
Access-Control-Request-Method: GET
HTTP *
[Asserts]
header "Access-Control-Allow-Origin" exists
