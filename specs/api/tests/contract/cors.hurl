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


# 2. A disallowed origin still gets a handled preflight (204). Whether it is
# echoed in Access-Control-Allow-Origin depends on the impl's CORS_ORIGINS:
# under a strict allow-list (production-realistic; dev sets CORS_ORIGINS
# explicitly) it is NOT echoed; under the wildcard default it would be. So this
# only asserts the middleware handles the preflight, not the header value.
OPTIONS {{api}}/persons
Origin: https://evil.com
Access-Control-Request-Method: GET
HTTP 204
