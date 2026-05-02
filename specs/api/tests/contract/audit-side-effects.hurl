# Audit side effects: create + update operations on resources must emit
# audit log entries that an admin can read back via /audit/logs. The
# original e2e suite asserted this behavior; the contract guarantee is
# that *some* entry exists for each resource-modifying operation.

# 1. Sign up a regular user (target whose actions we want to audit).
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "audit-target-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Audit Target"
}
HTTP 200
[Captures]
target_id: jsonpath "$.user.id"


# 2. Create a person profile - this should emit a 'create' audit entry.
POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Audit",
  "lastName": "Target",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 3. Update the person - this should emit an 'update' audit entry.
PATCH {{api}}/persons/{{person_id}}
Content-Type: application/json
{
  "lastName": "Target Updated"
}
HTTP 200


# 4. Switch to admin and query the audit log for entries about this person.
POST {{api}}/auth/sign-in/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "{{admin_email}}",
  "password": "{{admin_password}}"
}
HTTP 200


GET {{api}}/audit/logs?resource={{person_id}}&resourceType=person
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.pagination.totalCount" >= 2


# 5. Filter to just the create action.
GET {{api}}/audit/logs?resource={{person_id}}&action=create
HTTP 200
[Asserts]
jsonpath "$.pagination.totalCount" >= 1
jsonpath "$.data[0].action" == "create"
jsonpath "$.data[0].resource" == "{{person_id}}"


# 6. Filter to just the update action.
GET {{api}}/audit/logs?resource={{person_id}}&action=update
HTTP 200
[Asserts]
jsonpath "$.pagination.totalCount" >= 1
jsonpath "$.data[0].action" == "update"
