# Dental Organization contract tests
# Tests the full org -> branch -> membership lifecycle.
# Relies on Hurl cookie jar for session; signs up a new owner first.

# 0. Sign up as practice owner
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "dental-owner-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dr. Practice Owner"
}
HTTP 200
[Captures]
session_token: cookie "better-auth.session_token"
user_id: jsonpath "$.user.id"


# 1. Create a dental organization
POST {{api}}/dental/organizations
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "name": "Bright Smiles Dental {{suffix}}",
  "tier": "clinic",
  "countryCode": "PH"
}
HTTP 201
[Captures]
org_id: jsonpath "$.id"
[Asserts]
jsonpath "$.name" contains "Bright Smiles Dental"
jsonpath "$.tier" == "clinic"
jsonpath "$.countryCode" == "PH"
jsonpath "$.active" == true
jsonpath "$.id" isString


# 2. Get the created organization
GET {{api}}/dental/organizations/{{org_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{org_id}}"
jsonpath "$.name" contains "Bright Smiles Dental"


# 3. Update the organization name
PATCH {{api}}/dental/organizations/{{org_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "name": "Bright Smiles Dental Group {{suffix}}"
}
HTTP 200
[Asserts]
jsonpath "$.name" contains "Bright Smiles Dental Group"
jsonpath "$.tier" == "clinic"


# 4. Create a branch under the organization
POST {{api}}/dental/organizations/{{org_id}}/branches
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "name": "Main Clinic",
  "timezone": "Asia/Manila",
  "address": "123 Rizal Avenue",
  "city": "Manila",
  "phone": "+639171234567"
}
HTTP 201
[Captures]
branch_id: jsonpath "$.id"
[Asserts]
jsonpath "$.organizationId" == "{{org_id}}"
jsonpath "$.name" == "Main Clinic"
jsonpath "$.timezone" == "Asia/Manila"
jsonpath "$.active" == true


# 5. List branches for the organization
GET {{api}}/dental/organizations/{{org_id}}/branches
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.items" isCollection
jsonpath "$.items[0].id" == "{{branch_id}}"


# 6. Create a staff membership (PIN-only staff, no cloud account)
POST {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}/members
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Staff Ana Cruz",
  "role": "staff_full"
}
HTTP 201
[Captures]
membership_id: jsonpath "$.id"
[Asserts]
jsonpath "$.branchId" == "{{branch_id}}"
jsonpath "$.displayName" == "Staff Ana Cruz"
jsonpath "$.role" == "staff_full"
jsonpath "$.status" == "active"


# 7. List members for the branch
GET {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}/members
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.data[0].id" == "{{membership_id}}"


# 8. Deactivate the member
POST {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}/members/{{membership_id}}/deactivate
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "reason": "Staff left the clinic"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "inactive"


# 9. Confirm member is no longer in active list
GET {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}/members
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.pagination.totalCount" == 0


# NEW: G2-S4 — create a second staff member for PIN flow
POST {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}/members
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Staff Ben Reyes",
  "role": "staff_full"
}
HTTP 201
[Captures]
pin_member_id: jsonpath "$.id"
[Asserts]
jsonpath "$.role" == "staff_full"
jsonpath "$.status" == "active"


# NEW: G2-S4 — membership role update via set-pin (PIN assignment for staff member)
POST {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}/members/{{pin_member_id}}/set-pin
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "pin": "4321"
}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{pin_member_id}}"
jsonpath "$.status" == "active"


# NEW: G2-S4 — verify PIN for the staff member
POST {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}/members/{{pin_member_id}}/verify-pin
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "pin": "4321"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
