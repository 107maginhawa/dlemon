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


# ============================================================
# BRANCH SETTINGS
# ============================================================

# NEW: G2.5-S6 — get branch settings (empty/defaults)
GET {{api}}/dental/branches/{{branch_id}}/settings
Cookie: better-auth.session_token={{session_token}}
HTTP 200


# NEW: G2.5-S6 — update branch settings
PUT {{api}}/dental/branches/{{branch_id}}/settings
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "appointmentDurationMinutes": 30,
  "currency": "PHP",
  "taxRate": 0.12,
  "appointmentReminderEnabled": true
}
HTTP 200
[Asserts]
jsonpath "$.appointmentDurationMinutes" == 30
jsonpath "$.currency" == "PHP"


# ============================================================
# WORKING HOURS
# ============================================================

# NEW: G2.5-S6 — get working hours (empty/defaults)
GET {{api}}/dental/branches/{{branch_id}}/working-hours
Cookie: better-auth.session_token={{session_token}}
HTTP 200


# NEW: G2.5-S6 — set working hours
PUT {{api}}/dental/branches/{{branch_id}}/working-hours
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "monday": {"open": "08:00", "close": "17:00", "isOpen": true},
  "tuesday": {"open": "08:00", "close": "17:00", "isOpen": true},
  "wednesday": {"open": "08:00", "close": "17:00", "isOpen": true},
  "thursday": {"open": "08:00", "close": "17:00", "isOpen": true},
  "friday": {"open": "08:00", "close": "17:00", "isOpen": true},
  "saturday": {"open": "09:00", "close": "13:00", "isOpen": true},
  "sunday": {"open": "00:00", "close": "00:00", "isOpen": false}
}
HTTP 200
[Asserts]
jsonpath "$.monday.isOpen" == true
jsonpath "$.sunday.isOpen" == false


# ============================================================
# CONSENT TEMPLATES
# ============================================================

# NEW: G2.5-S6 — create consent template
POST {{api}}/dental/branches/{{branch_id}}/consent-templates
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "title": "General Treatment Consent",
  "content": "I consent to general dental treatment as determined by my dentist."
}
HTTP 201
[Captures]
consent_template_id: jsonpath "$.id"
[Asserts]
jsonpath "$.title" == "General Treatment Consent"


# NEW: G2.5-S6 — list consent templates
GET {{api}}/dental/branches/{{branch_id}}/consent-templates
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# NEW: G2.5-S6 — update consent template
PATCH {{api}}/dental/branches/{{branch_id}}/consent-templates/{{consent_template_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "title": "General Treatment Consent v2",
  "isActive": true
}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{consent_template_id}}"


# NEW: G2.5-S6 — delete consent template
DELETE {{api}}/dental/branches/{{branch_id}}/consent-templates/{{consent_template_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200


# ============================================================
# ORG MEMBERS (flat — context-resolved)
# ============================================================

# NEW: G2.5-S6 — create flat member (org/branch from auth context)
POST {{api}}/dental/org/members
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Staff Maya Cruz",
  "role": "staff_scheduling"
}
HTTP 201
[Captures]
flat_member_id: jsonpath "$.id"
[Asserts]
jsonpath "$.role" == "staff_scheduling"
jsonpath "$.status" == "active"


# NEW: G2.5-S6 — list org members
GET {{api}}/dental/org/members
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.pagination" isCollection


# NEW: G2.5-S6 — set security question for flat member (prerequisite for recover-pin)
POST {{api}}/dental/org/members/{{flat_member_id}}/security-question
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "question": "What is your mother's maiden name?",
  "answer": "Reyes"
}
HTTP 200


# NEW: G2.5-S6 — recover PIN using security question
POST {{api}}/dental/org/members/{{flat_member_id}}/recover-pin
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "securityQuestion": "What is your mother's maiden name?",
  "answer": "Reyes"
}
HTTP 200


# NEW: G2.5-S6 — reset PIN (owner-level action)
POST {{api}}/dental/org/members/{{flat_member_id}}/reset-pin
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "newPin": "9876"
}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{flat_member_id}}"


# ============================================================
# ORG CONTEXT + BRANCH LOOKUP
# ============================================================

# NEW: G2.5-S6 — get org context for authenticated user
GET {{api}}/dental/org/context
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.organizationId" == "{{org_id}}"
jsonpath "$.branchId" isString
jsonpath "$.role" isString


# NEW: G2.5-S6 — get specific branch by orgId + branchId
GET {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{branch_id}}"
jsonpath "$.organizationId" == "{{org_id}}"


# NEW: G2.5-S6 — org context auth check
GET {{api}}/dental/org/context
HTTP 401
