# Dental Perio contract tests
# Tests: create chart, upsert readings (idempotent), complete chart (summary stats),
#        list for patient, get by chartId, get by visitId, immutability after completion,
#        404 on bogus id.

# ============================================================
# 1. Unauthenticated auth-gate checks (empty cookie jar).
# Run BEFORE sign-up so the cookie jar is empty. Fixed placeholder UUIDs are
# sufficient because the auth middleware fires before any resource lookup.
# ============================================================

# Auth gate — GET chart by id
GET {{api}}/dental/perio-charts/00000000-0000-4000-8000-000000000000
HTTP 401

# Auth gate — POST create chart
POST {{api}}/dental/perio-charts
Content-Type: application/json
{
  "visitId": "00000000-0000-4000-8000-000000000000",
  "patientId": "00000000-0000-4000-8000-000000000000"
}
HTTP 401


# ============================================================
# 2. Setup: sign up → onboard (org + branch + membership) → patient → visit → activate
# ============================================================

# 2a. Sign up
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "dental-perio-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dr. Perio Tester"
}
HTTP 200
[Captures]
session_token: cookie "better-auth.session_token"
user_id: jsonpath "$.user.id"


# 2b. Self-service onboarding — provisions org + branch + owner membership
POST {{api}}/dental/onboarding
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "organizationName": "Perio Test Clinic {{suffix}}",
  "tier": "clinic",
  "countryCode": "PH",
  "branchName": "Main Branch",
  "timezone": "Asia/Manila",
  "address": "456 Perio Street",
  "city": "Cebu",
  "phone": "+639009876543",
  "ownerDisplayName": "Dr. Perio Tester"
}
HTTP 201
[Captures]
org_id: jsonpath "$.organizationId"
branch_id: jsonpath "$.branchId"
member_id: jsonpath "$.membershipId"


# 2c. Create a dental patient
POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Perio Test Patient {{suffix}}",
  "consentGiven": true,
  "branchId": "{{branch_id}}"
}
HTTP 201
[Captures]
patient_id: jsonpath "$.id"


# 2d. Create a dental visit (draft)
POST {{api}}/dental/visits
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "branchId": "{{branch_id}}",
  "dentistMemberId": "{{member_id}}",
  "chiefComplaint": "Periodontal evaluation"
}
HTTP 201
[Captures]
visit_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "draft"


# 2e. Activate visit (BR-P02 requires active visit)
PATCH {{api}}/dental/visits/{{visit_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "active"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "active"


# ============================================================
# 3. POST create perio chart → 201
# BR-P01: one chart per visit. Capture chartId; assert echoed fields.
# ============================================================

POST {{api}}/dental/perio-charts
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "{{patient_id}}",
  "notes": "Full-mouth perio chart for contract test"
}
HTTP 201
[Captures]
chart_id: jsonpath "$.id"
[Asserts]
jsonpath "$.visitId" == "{{visit_id}}"
jsonpath "$.patientId" == "{{patient_id}}"
jsonpath "$.status" == "draft"
jsonpath "$.notes" == "Full-mouth perio chart for contract test"
jsonpath "$.readings" count == 0


# 3b. Duplicate creation → 409 CHART_EXISTS (BR-P01: one chart per visit)
POST {{api}}/dental/perio-charts
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "visitId": "{{visit_id}}",
  "patientId": "{{patient_id}}"
}
HTTP 409
[Asserts]
jsonpath "$.code" == "CHART_EXISTS"


# ============================================================
# 4. Upsert tooth readings (PUT /{chartId}/readings/{toothNumber})
# Upsert 16 adult teeth to satisfy BR-P07 minimum for completion.
# One tooth (tooth 16) is upserted twice to verify idempotent update.
# ============================================================

# Tooth 11
PUT {{api}}/dental/perio-charts/{{chart_id}}/readings/11
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "depthBM": 3, "depthBC": 2, "depthBD": 3,
  "depthLM": 2, "depthLC": 2, "depthLD": 2,
  "bopBM": false, "bopBC": false, "bopBD": false,
  "bopLM": false, "bopLC": false, "bopLD": false,
  "mobility": 0, "furcation": 0, "plaque": false, "suppuration": false
}
HTTP 200
[Asserts]
jsonpath "$.toothNumber" == 11
jsonpath "$.chartId" == "{{chart_id}}"
jsonpath "$.depthBM" == 3
jsonpath "$.mobility" == 0
jsonpath "$.furcation" == 0


# Tooth 12
PUT {{api}}/dental/perio-charts/{{chart_id}}/readings/12
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "depthBM": 2, "depthBC": 2, "depthBD": 2,
  "depthLM": 2, "depthLC": 2, "depthLD": 2,
  "bopBM": false, "bopBC": false, "bopBD": false,
  "bopLM": false, "bopLC": false, "bopLD": false,
  "mobility": 0, "furcation": 0, "plaque": false, "suppuration": false
}
HTTP 200

# Tooth 13
PUT {{api}}/dental/perio-charts/{{chart_id}}/readings/13
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "depthBM": 3, "depthBC": 2, "depthBD": 3,
  "depthLM": 2, "depthLC": 3, "depthLD": 2,
  "bopBM": false, "bopBC": false, "bopBD": false,
  "bopLM": false, "bopLC": false, "bopLD": false,
  "mobility": 0, "furcation": 0, "plaque": false, "suppuration": false
}
HTTP 200

# Tooth 14
PUT {{api}}/dental/perio-charts/{{chart_id}}/readings/14
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "depthBM": 4, "depthBC": 3, "depthBD": 4,
  "depthLM": 3, "depthLC": 3, "depthLD": 3,
  "bopBM": true, "bopBC": false, "bopBD": true,
  "bopLM": false, "bopLC": false, "bopLD": false,
  "recession": 1,
  "mobility": 0, "furcation": 1, "plaque": true, "suppuration": false
}
HTTP 200
[Asserts]
jsonpath "$.toothNumber" == 14
jsonpath "$.bopBM" == true
jsonpath "$.recession" == 1
jsonpath "$.furcation" == 1

# Tooth 15
PUT {{api}}/dental/perio-charts/{{chart_id}}/readings/15
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "depthBM": 3, "depthBC": 3, "depthBD": 3,
  "depthLM": 3, "depthLC": 3, "depthLD": 3,
  "bopBM": false, "bopBC": false, "bopBD": false,
  "bopLM": false, "bopLC": false, "bopLD": false,
  "mobility": 0, "furcation": 0, "plaque": false, "suppuration": false
}
HTTP 200

# Tooth 16 — first upsert (initial values)
PUT {{api}}/dental/perio-charts/{{chart_id}}/readings/16
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "depthBM": 4, "depthBC": 3, "depthBD": 5,
  "depthLM": 3, "depthLC": 3, "depthLD": 4,
  "bopBM": true, "bopBC": false, "bopBD": true,
  "bopLM": false, "bopLC": false, "bopLD": false,
  "recession": 1,
  "gmBM": 2, "gmBC": 0, "gmBD": 2,
  "gmLM": 1, "gmLC": 0, "gmLD": 1,
  "mobility": 0, "furcation": 1, "plaque": true, "suppuration": false,
  "notes": "Initial reading"
}
HTTP 200
[Asserts]
jsonpath "$.toothNumber" == 16
jsonpath "$.depthBD" == 5
jsonpath "$.notes" == "Initial reading"

# Tooth 17
PUT {{api}}/dental/perio-charts/{{chart_id}}/readings/17
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "depthBM": 3, "depthBC": 3, "depthBD": 3,
  "depthLM": 3, "depthLC": 3, "depthLD": 3,
  "bopBM": false, "bopBC": false, "bopBD": false,
  "bopLM": false, "bopLC": false, "bopLD": false,
  "mobility": 0, "furcation": 0, "plaque": false, "suppuration": false
}
HTTP 200

# Tooth 21
PUT {{api}}/dental/perio-charts/{{chart_id}}/readings/21
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "depthBM": 2, "depthBC": 2, "depthBD": 2,
  "depthLM": 2, "depthLC": 2, "depthLD": 2,
  "bopBM": false, "bopBC": false, "bopBD": false,
  "bopLM": false, "bopLC": false, "bopLD": false,
  "mobility": 0, "furcation": 0, "plaque": false, "suppuration": false
}
HTTP 200

# Tooth 22
PUT {{api}}/dental/perio-charts/{{chart_id}}/readings/22
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "depthBM": 2, "depthBC": 2, "depthBD": 2,
  "depthLM": 2, "depthLC": 2, "depthLD": 2,
  "bopBM": false, "bopBC": false, "bopBD": false,
  "bopLM": false, "bopLC": false, "bopLD": false,
  "mobility": 0, "furcation": 0, "plaque": false, "suppuration": false
}
HTTP 200

# Tooth 23
PUT {{api}}/dental/perio-charts/{{chart_id}}/readings/23
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "depthBM": 3, "depthBC": 2, "depthBD": 3,
  "depthLM": 2, "depthLC": 2, "depthLD": 2,
  "bopBM": false, "bopBC": false, "bopBD": false,
  "bopLM": false, "bopLC": false, "bopLD": false,
  "mobility": 0, "furcation": 0, "plaque": false, "suppuration": false
}
HTTP 200

# Tooth 24
PUT {{api}}/dental/perio-charts/{{chart_id}}/readings/24
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "depthBM": 2, "depthBC": 2, "depthBD": 2,
  "depthLM": 2, "depthLC": 2, "depthLD": 2,
  "bopBM": false, "bopBC": false, "bopBD": false,
  "bopLM": false, "bopLC": false, "bopLD": false,
  "mobility": 0, "furcation": 0, "plaque": false, "suppuration": false
}
HTTP 200

# Tooth 25
PUT {{api}}/dental/perio-charts/{{chart_id}}/readings/25
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "depthBM": 2, "depthBC": 2, "depthBD": 2,
  "depthLM": 2, "depthLC": 2, "depthLD": 2,
  "bopBM": false, "bopBC": false, "bopBD": false,
  "bopLM": false, "bopLC": false, "bopLD": false,
  "mobility": 0, "furcation": 0, "plaque": false, "suppuration": false
}
HTTP 200

# Tooth 26
PUT {{api}}/dental/perio-charts/{{chart_id}}/readings/26
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "depthBM": 5, "depthBC": 4, "depthBD": 6,
  "depthLM": 4, "depthLC": 4, "depthLD": 5,
  "bopBM": true, "bopBC": true, "bopBD": true,
  "bopLM": true, "bopLC": false, "bopLD": true,
  "recession": 2,
  "mobility": 1, "furcation": 2, "plaque": true, "suppuration": true
}
HTTP 200
[Asserts]
jsonpath "$.toothNumber" == 26
jsonpath "$.depthBD" == 6
jsonpath "$.mobility" == 1
jsonpath "$.furcation" == 2
jsonpath "$.suppuration" == true

# Tooth 27
PUT {{api}}/dental/perio-charts/{{chart_id}}/readings/27
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "depthBM": 3, "depthBC": 3, "depthBD": 3,
  "depthLM": 3, "depthLC": 3, "depthLD": 3,
  "bopBM": false, "bopBC": false, "bopBD": false,
  "bopLM": false, "bopLC": false, "bopLD": false,
  "mobility": 0, "furcation": 0, "plaque": false, "suppuration": false
}
HTTP 200

# Tooth 31
PUT {{api}}/dental/perio-charts/{{chart_id}}/readings/31
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "depthBM": 2, "depthBC": 2, "depthBD": 2,
  "depthLM": 2, "depthLC": 2, "depthLD": 2,
  "bopBM": false, "bopBC": false, "bopBD": false,
  "bopLM": false, "bopLC": false, "bopLD": false,
  "mobility": 0, "furcation": 0, "plaque": false, "suppuration": false
}
HTTP 200

# Tooth 32
PUT {{api}}/dental/perio-charts/{{chart_id}}/readings/32
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "depthBM": 2, "depthBC": 2, "depthBD": 2,
  "depthLM": 2, "depthLC": 2, "depthLD": 2,
  "bopBM": false, "bopBC": false, "bopBD": false,
  "bopLM": false, "bopLC": false, "bopLD": false,
  "mobility": 0, "furcation": 0, "plaque": false, "suppuration": false
}
HTTP 200

# Tooth 41 (16th reading — satisfies MIN_READINGS_ADULT = 16)
PUT {{api}}/dental/perio-charts/{{chart_id}}/readings/41
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "depthBM": 2, "depthBC": 2, "depthBD": 2,
  "depthLM": 2, "depthLC": 2, "depthLD": 2,
  "bopBM": false, "bopBC": false, "bopBD": false,
  "bopLM": false, "bopLC": false, "bopLD": false,
  "mobility": 0, "furcation": 0, "plaque": false, "suppuration": false
}
HTTP 200


# 4b. Upsert tooth 16 AGAIN with updated depths → verify the row UPDATES (not duplicated).
# The handler uses ON CONFLICT DO UPDATE, so this should return 200 with new values.
PUT {{api}}/dental/perio-charts/{{chart_id}}/readings/16
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "depthBM": 6, "depthBC": 5, "depthBD": 7,
  "notes": "Updated reading — deeper pockets charted"
}
HTTP 200
[Asserts]
jsonpath "$.toothNumber" == 16
jsonpath "$.chartId" == "{{chart_id}}"
jsonpath "$.depthBM" == 6
jsonpath "$.depthBC" == 5
jsonpath "$.depthBD" == 7
jsonpath "$.notes" == "Updated reading — deeper pockets charted"
# Unchanged fields from the first upsert must survive (partial update semantics)
jsonpath "$.depthLM" == 3
jsonpath "$.bopBM" == true


# ============================================================
# 5a. GET the chart by chartId → 200 (includes readings)
# We upserted 17 unique teeth (11-17, 21-27, 31-32, 41); tooth 16 was upserted
# twice but the upsert is idempotent on (chartId, toothNumber), so count = 17.
# ============================================================

GET {{api}}/dental/perio-charts/{{chart_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{chart_id}}"
jsonpath "$.visitId" == "{{visit_id}}"
jsonpath "$.patientId" == "{{patient_id}}"
jsonpath "$.status" == "draft"
jsonpath "$.readings" count == 17


# 5b. GET the chart by visitId → 200 (visit perio chart)
GET {{api}}/dental/visits/{{visit_id}}/perio-chart
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{chart_id}}"
jsonpath "$.visitId" == "{{visit_id}}"
jsonpath "$.status" == "draft"
jsonpath "$.readings" count == 17


# 5c. List for patient before completion — draft chart is NOT in history list
#     (listPerioChartsForPatient only returns completed/locked charts)
GET {{api}}/dental/perio-charts?patientId={{patient_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" count == 0


# ============================================================
# 6. Complete the chart → 200 with computed summary stats.
# BR-P07: 17 readings (>= 16) satisfied above.
#
# The charted data is deterministic, so every computed value below is pinned to
# its exact expected output — a broken staging/grading engine MUST fail here.
#
# Risk factors feed the 2017 AAP/EFP classification:
#   - ageYears=45, bonelossPercent=25.0 → indirect ratio 25/45 = 0.556
#     → 0.25 < 0.556 <= 1.0 → grade B (hasDiabetes=false adds no modifier).
#   - remainingTeeth=28 (full dentition; only 17 teeth were charted) keeps the
#     case OUT of Stage IV. Without it, remainingTeeth defaults to the charted
#     count (17 < 20), which would bump the stage to IV on the "<20 teeth"
#     complexity factor — not what this otherwise-Stage-III case represents.
# ============================================================

POST {{api}}/dental/perio-charts/{{chart_id}}/complete
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "ageYears": 45,
  "bonelossPercent": 25.0,
  "hasDiabetes": false,
  "remainingTeeth": 28
}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{chart_id}}"
jsonpath "$.status" == "completed"
jsonpath "$.completedAt" isString
jsonpath "$.summaryBopPercent" isFloat
jsonpath "$.summaryMeanDepth" isFloat
jsonpath "$.summaryDeepPocketCount" isInteger
# BOP%: 9 BOP-true sites (tooth 14:2, tooth 16:2, tooth 26:5) of 102 total
# BOP sites (17 teeth × 6 sites) = 8.82%. Bound it tight but non-fragile.
jsonpath "$.summaryBopPercent" > 5.0
# Mean depth ≈ 2.64mm across 102 sites. Bound it above the all-healthy floor.
jsonpath "$.summaryMeanDepth" > 2.0
# Deep-pocket count: only teeth 16 (depthBM=6, depthBC=5, depthBD=7) and 26
# (depthBM=5, depthBD=6, depthLD=5) have sites >= 5mm → exactly 6.
# (tooth 14's max depth is 4mm, below the 5mm threshold — not a deep pocket.)
jsonpath "$.summaryDeepPocketCount" == 6
# 2017 AAP/EFP classification — pinned to the deterministic engine output:
#   stage III: worst interdental CAL 9mm (tooth 16 calBD = PD 7 + GM 2) + max PD
#              7mm + furcation grade 2 (tooth 26) → Stage III.
#   grade B  : bone-loss/age ratio 0.556 (see header).
#   extent localized: 3 involved teeth (14, 16, 26) of 17 = 17.6% < 30%.
jsonpath "$.stage" == "III"
jsonpath "$.grade" == "B"
jsonpath "$.extent" == "localized"


# 6b. Completing an already-completed chart → 409 CHART_COMPLETED (V-PER-001)
POST {{api}}/dental/perio-charts/{{chart_id}}/complete
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{}
HTTP 409
[Asserts]
jsonpath "$.code" == "CHART_COMPLETED"


# ============================================================
# 7. Immutability: upsert a reading on a completed chart → 409 CHART_COMPLETED
# (N-PER-01 / V-PER-002: completed chart is immutable; handler throws ConflictError)
# ============================================================

PUT {{api}}/dental/perio-charts/{{chart_id}}/readings/11
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "depthBM": 10, "depthBC": 10, "depthBD": 10,
  "depthLM": 10, "depthLC": 10, "depthLD": 10,
  "mobility": 0, "furcation": 0, "plaque": false, "suppuration": false
}
HTTP 409
[Asserts]
jsonpath "$.code" == "CHART_COMPLETED"


# ============================================================
# 7b. P2-1: single-GET-after-complete must return the numeric summary as JSON
# floats (Drizzle returns `numeric` as strings; getPerioChart / getVisitPerioChart
# must coerce to match the declared float64 contract — mirrors the list path).
# ============================================================

GET {{api}}/dental/perio-charts/{{chart_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "completed"
jsonpath "$.summaryBopPercent" isFloat
jsonpath "$.summaryMeanDepth" isFloat

GET {{api}}/dental/visits/{{visit_id}}/perio-chart
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "completed"
jsonpath "$.summaryBopPercent" isFloat
jsonpath "$.summaryMeanDepth" isFloat


# ============================================================
# 8. List for patient AFTER completion → completed chart appears
# ============================================================

GET {{api}}/dental/perio-charts?patientId={{patient_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" count == 1
jsonpath "$.data[0].id" == "{{chart_id}}"
jsonpath "$.data[0].status" == "completed"
jsonpath "$.data[0].summaryBopPercent" isFloat
jsonpath "$.data[0].summaryMeanDepth" isFloat
jsonpath "$.data[0].readings" count == 17


# ============================================================
# 9. GET bogus chart id → 404
# Use a valid v4 UUID (version nibble = 4, variant nibble = 8..b) that will
# never exist in this test run.
# ============================================================

GET {{api}}/dental/perio-charts/00000000-0000-4000-8000-000000000099
Cookie: better-auth.session_token={{session_token}}
HTTP 404


# ============================================================
# 10. GET perio-chart for a visit with no chart → 204
# Create a second patient so we can test the 204 path without needing to
# complete the original visit (which has no consent/notes and would 422).
# The 204 path only requires that the visit exists and has no chart.
# ============================================================

POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Perio No-Chart Patient {{suffix}}",
  "consentGiven": true,
  "branchId": "{{branch_id}}"
}
HTTP 201
[Captures]
empty_patient_id: jsonpath "$.id"


POST {{api}}/dental/visits
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{empty_patient_id}}",
  "branchId": "{{branch_id}}",
  "dentistMemberId": "{{member_id}}",
  "chiefComplaint": "New patient exam (no perio chart)"
}
HTTP 201
[Captures]
empty_visit_id: jsonpath "$.id"


PATCH {{api}}/dental/visits/{{empty_visit_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "active"
}
HTTP 200


GET {{api}}/dental/visits/{{empty_visit_id}}/perio-chart
Cookie: better-auth.session_token={{session_token}}
HTTP 204
