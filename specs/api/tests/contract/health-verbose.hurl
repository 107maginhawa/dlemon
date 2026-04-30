# Verbose health-check responses follow the RFC application/health+json
# draft format: status (pass|fail), timestamp, checks{ name: pass|fail }.
# The check map is part of the contract — orchestrators and the contract
# runner inspect it.

# 1. /livez verbose: status, timestamp, ping check.
GET {{api}}/livez?verbose=true
HTTP 200
[Asserts]
header "Content-Type" matches "application/(health\\+)?json"
jsonpath "$.status" matches "^(pass|fail)$"
jsonpath "$.timestamp" matches "^[0-9]{4}-[0-9]{2}-[0-9]{2}T"
jsonpath "$.checks.ping" matches "^(pass|fail)$"


# 2. /readyz verbose: each declared dependency reports a check.
GET {{api}}/readyz?verbose=true
HTTP *
[Asserts]
status >= 200
status < 600
header "Content-Type" matches "application/(health\\+)?json"
jsonpath "$.status" matches "^(pass|fail)$"
jsonpath "$.timestamp" exists
jsonpath "$.checks.database" matches "^(pass|fail)$"
jsonpath "$.checks.storage" matches "^(pass|fail)$"
jsonpath "$.checks.jobs" matches "^(pass|fail)$"
