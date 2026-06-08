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


# 1. Self-service onboarding — provisions the org (caller = owner) + a default
# branch + the owner's membership in one call. The granular branch/member CRUD
# below still exercises DentalBranchManagement / DentalMembershipManagement as the
# owner. (POST /dental/organizations stays admin-only — EM-ORG-002 — so onboarding
# is the path a real owner uses.)
POST {{api}}/dental/onboarding
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "organizationName": "Bright Smiles Dental {{suffix}}",
  "tier": "clinic",
  "countryCode": "PH"
}
HTTP 201
[Captures]
org_id: jsonpath "$.organizationId"
default_branch_id: jsonpath "$.branchId"
[Asserts]
jsonpath "$.organizationId" isString
jsonpath "$.branchId" isString
jsonpath "$.membershipId" isString


# 2. Get the created organization (asserts the org fields the onboarding response omits)
GET {{api}}/dental/organizations/{{org_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{org_id}}"
jsonpath "$.name" contains "Bright Smiles Dental"
jsonpath "$.tier" == "clinic"
jsonpath "$.countryCode" == "PH"
jsonpath "$.active" == true


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


# 5. List branches for the organization (onboarding's default branch + Main Clinic,
# so assert the created branch is present rather than first)
GET {{api}}/dental/organizations/{{org_id}}/branches
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.items" isCollection
jsonpath "$.items[*].id" includes "{{branch_id}}"


# 6pre. Owner bootstraps their OWN membership in the freshly-created Main Clinic.
# The owner was onboarded into the DEFAULT branch, not this one — and the FIRST
# membership an owner creates in a branch they don't belong to becomes the OWNER's
# own membership (bootstrap → personId=owner). So we explicitly bootstrap the owner
# as dentist_owner here; otherwise a 'staff_full' first member would silently demote
# the owner to staff in this branch and break every owner-only op below.
POST {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}/members
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Dr. Practice Owner",
  "role": "dentist_owner"
}
HTTP 201
[Captures]
owner_membership_id: jsonpath "$.id"
[Asserts]
jsonpath "$.branchId" == "{{branch_id}}"
jsonpath "$.role" == "dentist_owner"
jsonpath "$.status" == "active"


# 6. Create a staff membership (PIN-only staff, no cloud account). The owner now
# holds a dentist_owner membership here, so this is a normal (non-bootstrap) create:
# personId stays null → a genuine PIN-only staff member.
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


# 7. List members for the branch (now contains the owner + Ana Cruz, order not
# guaranteed → assert the staff member is present rather than first).
GET {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}/members
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.data[*].id" includes "{{membership_id}}"
jsonpath "$.pagination.totalCount" == 2


# 8. Deactivate the staff member
POST {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}/members/{{membership_id}}/deactivate
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "reason": "Staff left the clinic"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "inactive"


# 9. Confirm the staff member is no longer in the active list — only the owner's own
# dentist_owner membership remains active in this branch.
GET {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}/members
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.pagination.totalCount" == 1
jsonpath "$.data[0].id" == "{{owner_membership_id}}"


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
jsonpath "$.settings.appointmentDurationMinutes" == 30
jsonpath "$.settings.currency" == "PHP"


# ============================================================
# WORKING HOURS
# ============================================================

# NEW: G2.5-S6 — get working hours (empty/defaults)
GET {{api}}/dental/branches/{{branch_id}}/working-hours
Cookie: better-auth.session_token={{session_token}}
HTTP 200


# NEW: G2.5-S6 — set working hours. Body is wrapped in a `workingHours` object and
# each day uses the `enabled` flag (not `isOpen`); the response echoes the same
# wrapped shape ({ branchId, workingHours }).
PUT {{api}}/dental/branches/{{branch_id}}/working-hours
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "workingHours": {
    "monday": {"open": "08:00", "close": "17:00", "enabled": true},
    "tuesday": {"open": "08:00", "close": "17:00", "enabled": true},
    "wednesday": {"open": "08:00", "close": "17:00", "enabled": true},
    "thursday": {"open": "08:00", "close": "17:00", "enabled": true},
    "friday": {"open": "08:00", "close": "17:00", "enabled": true},
    "saturday": {"open": "09:00", "close": "13:00", "enabled": true},
    "sunday": {"open": "00:00", "close": "00:00", "enabled": false}
  }
}
HTTP 200
[Asserts]
jsonpath "$.workingHours.monday.enabled" == true
jsonpath "$.workingHours.sunday.enabled" == false


# ============================================================
# CONSENT TEMPLATES
# ============================================================

# NEW: G2.5-S6 — create consent template. The generated wire validator requires
# `title`/`content`, while the handler persists from `name`/`body`; we send BOTH so
# both layers are satisfied. The created template is returned wrapped under `template`
# with the handler's `name`/`body` fields.
POST {{api}}/dental/branches/{{branch_id}}/consent-templates
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "title": "General Treatment Consent",
  "content": "I consent to general dental treatment as determined by my dentist.",
  "name": "General Treatment Consent",
  "body": "I consent to general dental treatment as determined by my dentist."
}
HTTP 201
[Captures]
consent_template_id: jsonpath "$.template.id"
[Asserts]
jsonpath "$.template.name" == "General Treatment Consent"


# NEW: G2.5-S6 — list consent templates (returned under `templates`)
GET {{api}}/dental/branches/{{branch_id}}/consent-templates
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.templates" isCollection


# NEW: G2.5-S6 — update consent template (name/body fields; response wrapped under `template`)
PATCH {{api}}/dental/branches/{{branch_id}}/consent-templates/{{consent_template_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "name": "General Treatment Consent v2",
  "requiresWitnessSignature": true
}
HTTP 200
[Asserts]
jsonpath "$.template.id" == "{{consent_template_id}}"
jsonpath "$.template.name" == "General Treatment Consent v2"


# NEW: G2.5-S6 — delete consent template (soft-delete → { deleted: true })
DELETE {{api}}/dental/branches/{{branch_id}}/consent-templates/{{consent_template_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.deleted" == true


# ============================================================
# ORG MEMBERS (flat — context-resolved)
# ============================================================

# NEW: G2.5-S6 — create flat member. The flat endpoint still requires an explicit
# branchId (query or body); it does NOT infer from auth context. Scope to Main Clinic,
# where the owner holds the dentist_owner role required to invite staff.
POST {{api}}/dental/org/members
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Staff Maya Cruz",
  "role": "staff_scheduling",
  "branchId": "{{branch_id}}"
}
HTTP 201
[Captures]
flat_member_id: jsonpath "$.id"
[Asserts]
jsonpath "$.role" == "staff_scheduling"
jsonpath "$.status" == "active"


# NEW: G2.5-S6 — list org members (branchId required, same as create)
GET {{api}}/dental/org/members?branchId={{branch_id}}
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


# NEW: G2.5-S6 — recover PIN using security question. The wire validator requires
# `securityQuestion`+`answer`; the handler verifies the `answer` and atomically sets a
# new PIN, so `newPin` (4-6 digits) is also required. Response is { success: true }.
POST {{api}}/dental/org/members/{{flat_member_id}}/recover-pin
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "securityQuestion": "What is your mother's maiden name?",
  "answer": "Reyes",
  "newPin": "5678"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true


# NEW: G2.5-S6 — reset PIN (owner-level action). newPin must be exactly 6 digits;
# response is { success: true }.
POST {{api}}/dental/org/members/{{flat_member_id}}/reset-pin
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "newPin": "987654"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true


# ============================================================
# DASHBOARD SUMMARY
# ============================================================

# Drift pin (workflow-verification): GET /dental/dashboard/summary returns the
# { activePaymentPlans, labOrders } shape the handler + FE (use-dashboard-summary.ts)
# actually use (FR0.7 payment plans, FR0.8 lab orders) — NOT the flat
# { todayVisits, pendingInvoices, ... } the stale TypeSpec model used to declare.
# Owner has a dentist_owner membership on {{branch_id}} (bootstrapped above), so the
# owner-only dashboard guard passes.
GET {{api}}/dental/dashboard/summary?branchId={{branch_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.activePaymentPlans" exists
jsonpath "$.activePaymentPlans.count" isInteger
jsonpath "$.activePaymentPlans.behindCount" isInteger
jsonpath "$.activePaymentPlans.totalOutstandingCents" isInteger
jsonpath "$.labOrders" exists
jsonpath "$.labOrders.totalPending" isInteger
jsonpath "$.labOrders.overdueDelivery" isInteger


# ============================================================
# ORG CONTEXT + BRANCH LOOKUP
# ============================================================

# NEW: G2.5-S6 — get org context for authenticated user. Response is nested under
# org/branch/member (the resolved org, the caller's active branch, and their membership).
# Drift pin (workflow-verification): OrgContextResponse is the NESTED { org, branch,
# member } shape the handler + FE (load-org-context.ts) actually use — NOT the flat
# { organizationId, branchId, ... } the stale TypeSpec model used to declare.
GET {{api}}/dental/org/context
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.org.id" == "{{org_id}}"
jsonpath "$.org.name" isString
jsonpath "$.branch.id" isString
jsonpath "$.branch.timezone" isString
jsonpath "$.member.role" isString
jsonpath "$.member.id" isString


# NEW: G2.5-S6 — get specific branch by orgId + branchId
GET {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{branch_id}}"
jsonpath "$.organizationId" == "{{org_id}}"


# NEW: G2.5-S6 — org context auth check → 401. Hurl replays the signed-in session
# cookie across the whole file, so send an invalid bearer; Better-Auth's bearer plugin
# takes precedence over the stored cookie → no session → 401.
GET {{api}}/dental/org/context
Authorization: Bearer invalid-no-session
HTTP 401
