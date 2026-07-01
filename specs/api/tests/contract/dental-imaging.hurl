# Dental Imaging + Cephalometric Analysis contract tests
#
# Chain:
#   signup → org (addon tier) → branch → member → patient
#   → study (cephalometric) → image → calibrate
#   → batch upsert landmarks (N,S,A,B,Go,Po)
#   → GET analysis (not 404, empty measurements pre-calibration)
#   → PATCH landmark N (move) → lock N → locked-PATCH-fails (422)
#   → report blocked (confirm-gate 422) → confirm A,B,Go,Po
#   → POST report (201) → GET report → recompute → snapshot unchanged (D-I)
#
# Every ceph route must be /dental/imaging-prefixed (route-override regression guard).


# ============================================================
# SETUP
# ============================================================

# 0. Sign up as a user
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "dental-imaging-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dr. Imaging Tester"
}
HTTP 200
[Captures]
session_token: cookie "better-auth.session_token"
user_id: jsonpath "$.user.id"


# 0a. Self-service onboarding — provisions org + default branch + owner membership
# in one call (replaces the old org→branch→member setup; caller becomes owner +
# dentist_owner). imagingTier is still upgraded via the PATCH below.
POST {{api}}/dental/onboarding
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "organizationName": "Imaging Test Clinic {{suffix}}",
  "tier": "clinic",
  "countryCode": "PH",
  "branchName": "Main Branch",
  "timezone": "Asia/Manila",
  "address": "123 Imaging Street",
  "city": "Manila",
  "phone": "+639001234569",
  "ownerDisplayName": "Dr. Imaging Tester"
}
HTTP 201
[Captures]
org_id: jsonpath "$.organizationId"
branch_id: jsonpath "$.branchId"
dentist_member_id: jsonpath "$.membershipId"


# 0b. Upgrade org to imaging addon tier (required for ceph endpoints)
PATCH {{api}}/dental/organizations/{{org_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "imagingTier": "addon"
}
HTTP 200
[Asserts]
jsonpath "$.imagingTier" == "addon"


# 0c. Create a dental patient
POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Imaging Test Patient {{suffix}}",
  "consentGiven": true,
  "branchId": "{{branch_id}}"
}
HTTP 201
[Captures]
patient_id: jsonpath "$.id"


# ============================================================
# STUDY + IMAGE CREATION
# ============================================================

# 1. Create imaging study (modality: cephalometric) — returns presigned upload URL
POST {{api}}/dental/imaging/studies
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "branchId": "{{branch_id}}",
  "modality": "cephalometric",
  "filename": "ceph-lateral.jpg",
  "mimeType": "image/jpeg",
  "size": 512000
}
HTTP 201
[Captures]
study_id: jsonpath "$.study.id"
image_id: jsonpath "$.image.id"
[Asserts]
jsonpath "$.study.modality" == "cephalometric"
jsonpath "$.uploadUrl" isString
jsonpath "$.uploadMethod" == "PUT"


# 2. Calibrate image — required for calibrated measurements.
# G6: send the 2-point ruler (20 mm over 100 px) → server DERIVES pixelSpacingMm=0.2
# and persists a first-class versioned calibration record.
PATCH {{api}}/dental/imaging/images/{{image_id}}/calibration
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "pixelSpacingMm": 0.2,
  "pointA": { "x": 0, "y": 0 },
  "pointB": { "x": 100, "y": 0 },
  "knownDistanceMm": 20
}
HTTP 200
[Asserts]
jsonpath "$.pixelSpacingMm" == 0.2


# 2b. G5 library metadata — flag a retake + tag the image, then verify it persists.
PATCH {{api}}/dental/imaging/images/{{image_id}}/metadata
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "isDiagnostic": false,
  "qualityStatus": "retake",
  "retakeReason": "overexposed",
  "tags": ["ortho", "ortho", "  review "]
}
HTTP 200
[Asserts]
jsonpath "$.isDiagnostic" == false
jsonpath "$.qualityStatus" == "retake"
jsonpath "$.retakeReason" == "overexposed"
# tags normalized: de-duped + trimmed
jsonpath "$.tags" count == 2
jsonpath "$.tags" contains "ortho"
jsonpath "$.tags" contains "review"

# 2c. Reset to a clean diagnostic state so later ceph steps are unaffected.
PATCH {{api}}/dental/imaging/images/{{image_id}}/metadata
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "isDiagnostic": true,
  "qualityStatus": "ok",
  "retakeReason": null,
  "tags": []
}
HTTP 200
[Asserts]
jsonpath "$.qualityStatus" == "ok"


# 2c-bis. Create a real treatment plan for the patient. G6.2: a link target must
# exist and belong to the same patient, so a bogus uuid now 404s — link to this plan.
POST {{api}}/dental/patients/{{patient_id}}/treatment-plans
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "providerId": "{{dentist_member_id}}"
}
HTTP 201
[Captures]
plan_id: jsonpath "$.id"

# 2d. G5b context links — link the image to that treatment plan, list, then delete.
POST {{api}}/dental/imaging/images/{{image_id}}/links
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "linkType": "treatment_plan",
  "targetId": "{{plan_id}}"
}
HTTP 201
[Captures]
link_id: jsonpath "$.id"
[Asserts]
jsonpath "$.imageId" == "{{image_id}}"
jsonpath "$.linkType" == "treatment_plan"
jsonpath "$.targetId" == "{{plan_id}}"

# 2e. Re-linking the same target is idempotent — list still has exactly one.
POST {{api}}/dental/imaging/images/{{image_id}}/links
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "linkType": "treatment_plan",
  "targetId": "{{plan_id}}"
}
HTTP 201

GET {{api}}/dental/imaging/images/{{image_id}}/links
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.items" count == 1

# 2f. Delete the link → 204, then the list is empty.
DELETE {{api}}/dental/imaging/links/{{link_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 204

GET {{api}}/dental/imaging/images/{{image_id}}/links
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.items" count == 0


# ============================================================
# CEPH LANDMARKS — BATCH UPSERT (ROUTE PREFIX CHECK)
# ============================================================

# 3. Batch upsert 6 landmarks (N,S,A,B,Go,Po) — all 'placed' initially
# Route: POST /dental/imaging/images/{imageId}/ceph/landmarks  (prefix assertion)
POST {{api}}/dental/imaging/images/{{image_id}}/ceph/landmarks
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "landmarks": [
    { "landmarkCode": "N",  "x": 300, "y": 150, "source": "manual" },
    { "landmarkCode": "S",  "x": 320, "y": 130, "source": "manual" },
    { "landmarkCode": "A",  "x": 280, "y": 300, "source": "manual" },
    { "landmarkCode": "B",  "x": 270, "y": 350, "source": "manual" },
    { "landmarkCode": "Go", "x": 200, "y": 400, "source": "manual" },
    { "landmarkCode": "Po", "x": 350, "y": 100, "source": "manual" }
  ]
}
HTTP 200
[Asserts]
jsonpath "$.items" count >= 6
jsonpath "$.analysis.imageId" == "{{image_id}}"
jsonpath "$.analysis.analysisType" == "steiner_hybrid_sn"
jsonpath "$.analysis.calibrationMethod" == "manual_ruler"
jsonpath "$.analysis.calibrationValue" == 0.2


# ============================================================
# AI / AUTO LANDMARKING (P1-10 Phase 0) — kill-switch + safety
# ============================================================

# 3a. Auto-detect is kill-switched OFF by default (dental_imaging_auto_landmark).
#     The detect endpoint must HARD-disable → 403 FEATURE_DISABLED (no deploy needed
#     to turn the feature off). Route prefix /dental/imaging asserted here too.
POST {{api}}/dental/imaging/images/{{image_id}}/ceph/landmarks/detect
Cookie: better-auth.session_token={{session_token}}
HTTP 403
[Asserts]
jsonpath "$.code" == "FEATURE_DISABLED"


# 3b. Detect requires authentication → 401 (auth gate runs before the kill-switch).
#     Hurl keeps the signed-in session in its cookie store across the whole file, so to
#     prove the unauthenticated path we send an invalid bearer; Better-Auth's bearer
#     plugin takes precedence over the stored cookie → no session → 401.
POST {{api}}/dental/imaging/images/{{image_id}}/ceph/landmarks/detect
Authorization: Bearer invalid-no-session
HTTP 401


# 3c. SAFETY: an AI-sourced write may NOT auto-confirm. source='ai' + status='confirmed'
#     is rejected (422) — AI predictions must enter at 'placed' and be human-confirmed.
POST {{api}}/dental/imaging/images/{{image_id}}/ceph/landmarks
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "landmarks": [
    { "landmarkCode": "Me", "x": 260, "y": 420, "source": "ai", "status": "confirmed" }
  ]
}
HTTP 422
[Asserts]
jsonpath "$.code" == "AI_LANDMARK_CANNOT_AUTOCONFIRM"


# 3d. SAFETY: an AI write at status='placed' WITH confidence is allowed (the real
#     ingest path for predictions). Provenance source='ai' is persisted.
POST {{api}}/dental/imaging/images/{{image_id}}/ceph/landmarks
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "landmarks": [
    { "landmarkCode": "Or", "x": 330, "y": 180, "source": "ai", "confidence": 0.83, "status": "placed" }
  ]
}
HTTP 200
[Asserts]
jsonpath "$.items[?(@.landmarkCode=='Or')].source" == "ai"
jsonpath "$.items[?(@.landmarkCode=='Or')].confidence" == 0.83


# 3e. PROVENANCE: editing the AI point's coordinates flips source 'ai' → 'ai_corrected'.
PATCH {{api}}/dental/imaging/images/{{image_id}}/ceph/landmarks/Or
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "x": 335,
  "y": 185
}
HTTP 200
[Asserts]
jsonpath "$.items[?(@.landmarkCode=='Or')].source" == "ai_corrected"


# ============================================================
# CEPH ANALYSIS — GET (EMPTY-STATE CONTRACT)
# ============================================================

# 4. GET analysis — never 404, returns items + analysis
# Route: GET /dental/imaging/images/{imageId}/ceph/analysis
GET {{api}}/dental/imaging/images/{{image_id}}/ceph/analysis
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.items" count >= 6
jsonpath "$.analysis.imageId" == "{{image_id}}"
jsonpath "$.analysis.analysisType" == "steiner_hybrid_sn"


# ============================================================
# CEPH LANDMARK — PATCH (MOVE + LOCK)
# ============================================================

# 5. Move landmark N to new coordinates
PATCH {{api}}/dental/imaging/images/{{image_id}}/ceph/landmarks/N
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "x": 305,
  "y": 155
}
HTTP 200
[Asserts]
jsonpath "$.items" count >= 6
jsonpath "$.analysis.analysisType" == "steiner_hybrid_sn"


# 6. Lock landmark N (placed → confirmed → locked requires two steps: first confirm)
PATCH {{api}}/dental/imaging/images/{{image_id}}/ceph/landmarks/N
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "confirmed"
}
HTTP 200


# 7. Lock landmark N (confirmed → locked)
PATCH {{api}}/dental/imaging/images/{{image_id}}/ceph/landmarks/N
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "locked"
}
HTTP 200


# 8. Attempt coordinate change on locked landmark N → 422 LANDMARK_LOCKED
PATCH {{api}}/dental/imaging/images/{{image_id}}/ceph/landmarks/N
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "x": 999
}
HTTP 422
[Asserts]
jsonpath "$.code" == "LANDMARK_LOCKED"


# ============================================================
# CEPH REPORT — CONFIRM-GATE (D-L)
# ============================================================

# 9. Attempt report creation while A,B,Go,Po are still 'placed' → 422
# Route: POST /dental/imaging/images/{imageId}/ceph/reports
POST {{api}}/dental/imaging/images/{{image_id}}/ceph/reports
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{}
HTTP 422
[Asserts]
jsonpath "$.code" == "REPORT_GATE_UNCONFIRMED"


# 10. Confirm landmark A (placed → confirmed)
PATCH {{api}}/dental/imaging/images/{{image_id}}/ceph/landmarks/A
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "confirmed"
}
HTTP 200


# 11. Confirm landmark B (placed → confirmed)
PATCH {{api}}/dental/imaging/images/{{image_id}}/ceph/landmarks/B
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "confirmed"
}
HTTP 200


# 12. Confirm landmark Go (placed → confirmed)
PATCH {{api}}/dental/imaging/images/{{image_id}}/ceph/landmarks/Go
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "confirmed"
}
HTTP 200


# 13. Confirm landmark Po (placed → confirmed)
PATCH {{api}}/dental/imaging/images/{{image_id}}/ceph/landmarks/Po
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "confirmed"
}
HTTP 200


# ============================================================
# CEPH REPORT — CREATE + VERIFY (D-I IMMUTABILITY)
# ============================================================

# 14. Create ceph report — A,B,Go,Po now confirmed → should succeed (201)
# Body omits analysisType/normPopulation → defaults to steiner_hybrid_sn / default.
POST {{api}}/dental/imaging/images/{{image_id}}/ceph/reports
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{}
HTTP 201
[Captures]
report_id: jsonpath "$.id"
report_version: jsonpath "$.version"
snapshot_analysis_label: jsonpath "$.snapshot.analysis_label"
snapshot_branch_name: jsonpath "$.snapshot.branch_name"
[Asserts]
jsonpath "$.version" == 1
jsonpath "$.imageId" == "{{image_id}}"
jsonpath "$.snapshot.analysis_label" == "steiner_hybrid_sn"
jsonpath "$.snapshot.branch_name" == "Main Branch"
jsonpath "$.snapshot.calibration.method" == "manual_ruler"
jsonpath "$.snapshot.software_version" isString
jsonpath "$.snapshot.landmarks" count >= 6
# G2: reproducibility version-pinning — snapshot records the analysis actually
# used + the norm/formula/calibration versions it can be reproduced against.
jsonpath "$.snapshot.analysis_type" == "steiner_hybrid_sn"
jsonpath "$.snapshot.norm_population" == "default"
jsonpath "$.snapshot.norm_version" isString
jsonpath "$.snapshot.formula_version" isString
jsonpath "$.snapshot.calibration.version" isInteger
# G6: the report pins the EXACT versioned calibration record it was traced against
# (the 2 ruler points + known distance + monotonic record version).
jsonpath "$.snapshot.calibration.record_version" == 1
jsonpath "$.snapshot.calibration.known_distance_mm" == 20
jsonpath "$.snapshot.calibration.point_a.x" == 0
jsonpath "$.snapshot.calibration.point_b.x" == 100
# G1-B: v1 has no prior version → revision lineage is null.
jsonpath "$.revisionOf" == null
jsonpath "$.revisionReason" == null


# 15. GET report (latest version) — snapshot must match what was returned on create
GET {{api}}/dental/imaging/images/{{image_id}}/ceph/reports
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.version" == 1
jsonpath "$.id" == "{{report_id}}"
jsonpath "$.snapshot.analysis_label" == "steiner_hybrid_sn"
jsonpath "$.revisionOf" == null


# ============================================================
# RECOMPUTE — D-I: must NOT mutate snapshot
# ============================================================

# 16. Recompute ceph analysis (idempotent, does NOT touch existing reports)
POST {{api}}/dental/imaging/images/{{image_id}}/ceph/analysis/recompute
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.imageId" == "{{image_id}}"
jsonpath "$.analysisType" == "steiner_hybrid_sn"


# 17. GET report again — snapshot must be unchanged after recompute (D-I)
GET {{api}}/dental/imaging/images/{{image_id}}/ceph/reports
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.version" == 1
jsonpath "$.id" == "{{report_id}}"
jsonpath "$.snapshot.analysis_label" == "{{snapshot_analysis_label}}"
jsonpath "$.snapshot.branch_name" == "{{snapshot_branch_name}}"


# ============================================================
# CEPH REPORT — G1-B REVISION LINEAGE (re-finalize → v2)
# ============================================================

# 17b. Re-finalize → v2 with a revision reason. revisionOf links to v1's id;
# the linear version chain is now explicit + reasoned (no trace-session FSM).
POST {{api}}/dental/imaging/images/{{image_id}}/ceph/reports
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "revisionReason": "Re-traced Gonion after calibration review"
}
HTTP 201
[Asserts]
jsonpath "$.version" == 2
jsonpath "$.revisionOf" == "{{report_id}}"
jsonpath "$.revisionReason" == "Re-traced Gonion after calibration review"

# 17c. GET latest → v2 carries the lineage on read
GET {{api}}/dental/imaging/images/{{image_id}}/ceph/reports
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.version" == 2
jsonpath "$.revisionOf" == "{{report_id}}"
jsonpath "$.revisionReason" == "Re-traced Gonion after calibration review"


# ============================================================
# CEPH SUPERIMPOSITION (P1-11, v1 cranial-base S–N only)
# ============================================================
# Self-pair (from == to) → identity registration, all deltas ~0. Exercises the
# full path + v1 honesty label + the v1 reference gate without a 2nd timepoint.

# 17a. Non-cranial_base reference rejected in v1 → 422
POST {{api}}/dental/imaging/ceph/superimpositions/preview
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "reportFromId": "{{report_id}}",
  "reportToId": "{{report_id}}",
  "reference": "maxillary"
}
HTTP 422
[Asserts]
jsonpath "$.code" == "SUPERIMPOSITION_NOT_IMPLEMENTED"


# 17b. Preview (compute-on-the-fly) → 200, id null, v1 label, identity transform
POST {{api}}/dental/imaging/ceph/superimpositions/preview
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "reportFromId": "{{report_id}}",
  "reportToId": "{{report_id}}",
  "reference": "cranial_base"
}
HTTP 200
[Asserts]
jsonpath "$.id" == null
jsonpath "$.reference" == "cranial_base"
jsonpath "$.transform.basis" count == 2
jsonpath "$.label" contains "simplified superimposition"
jsonpath "$.label" contains "not a diagnosis"


# 17c. Create (persist) → 201 with id + createdAt
POST {{api}}/dental/imaging/ceph/superimpositions
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "reportFromId": "{{report_id}}",
  "reportToId": "{{report_id}}",
  "reference": "cranial_base"
}
HTTP 201
[Captures]
superimposition_id: jsonpath "$.id"
[Asserts]
jsonpath "$.id" isString
jsonpath "$.patientId" == "{{patient_id}}"
jsonpath "$.reference" == "cranial_base"
jsonpath "$.createdAt" isString


# 17d. Get persisted superimposition by id → 200
GET {{api}}/dental/imaging/ceph/superimpositions/{{superimposition_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{superimposition_id}}"
jsonpath "$.reference" == "cranial_base"
jsonpath "$.label" contains "simplified superimposition"


# 17e. List patient superimpositions → 200, includes the created one
GET {{api}}/dental/imaging/patients/{{patient_id}}/ceph/superimpositions
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.items" count >= 1


# 17f. Superimposition auth check → 401 (invalid bearer overrides hurl's stored cookie)
GET {{api}}/dental/imaging/patients/{{patient_id}}/ceph/superimpositions
Authorization: Bearer invalid-no-session
HTTP 401


# ============================================================
# IMAGING STUDY — GET BY ID
# ============================================================

# 18. Get imaging study by ID
GET {{api}}/dental/imaging/studies/{{study_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{study_id}}"
jsonpath "$.images" isCollection


# 19. Get study auth check → 401 (invalid bearer overrides hurl's stored cookie)
GET {{api}}/dental/imaging/studies/{{study_id}}
Authorization: Bearer invalid-no-session
HTTP 401


# ============================================================
# IMAGING FINDINGS
# ============================================================

# 20a. Create a visit (required FK for findings)
POST {{api}}/dental/visits
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "branchId": "{{branch_id}}",
  "dentistMemberId": "{{dentist_member_id}}"
}
HTTP 201
[Captures]
imaging_visit_id: jsonpath "$.id"


# 20. Create imaging finding
POST {{api}}/dental/imaging/images/{{image_id}}/findings
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "type": "caries",
  "status": "draft",
  "toothNumber": 36,
  "visitId": "{{imaging_visit_id}}",
  "patientId": "{{patient_id}}",
  "branchId": "{{branch_id}}",
  "note": "Mesial caries suspected"
}
HTTP 201
[Captures]
finding_id: jsonpath "$.id"
[Asserts]
jsonpath "$.type" == "caries"
jsonpath "$.toothNumber" == 36
jsonpath "$.status" == "draft"


# 20b. Create imaging finding the way the imaging-workspace UI does — body carries ONLY
# {type,status,note}, NO visitId/patientId/branchId. The handler derives those from the
# parent study (createFinding.ts), so this MUST succeed (201). Regression pin for
# BUG-IMG-001: CreateFindingBody used to require those three fields, so the generated
# validator rejected the real UI request with 400 before the handler ran (WF-040 broken
# from the UI). The raw-handler integration test could not catch it (it skips the
# generated validator); this request goes through the real validator.
POST {{api}}/dental/imaging/images/{{image_id}}/findings
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "type": "bone_loss",
  "status": "draft",
  "note": "UI-shaped body — visit/patient/branch derived from study"
}
HTTP 201
[Asserts]
jsonpath "$.type" == "bone_loss"
jsonpath "$.status" == "draft"
jsonpath "$.patientId" == "{{patient_id}}"
jsonpath "$.branchId" == "{{branch_id}}"


# 21. List findings for image — response is { items } per ImagingFindingListResponse
# (BUG-IMG-002: handler used to return { data, pagination }, which the FE hook
# could not read → "Failed to load findings").
GET {{api}}/dental/imaging/images/{{image_id}}/findings
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.items" isCollection
jsonpath "$.items" count >= 2


# 22. Update imaging finding
PATCH {{api}}/dental/imaging/findings/{{finding_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "status": "confirmed",
  "note": "Confirmed caries on mesial surface"
}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{finding_id}}"
jsonpath "$.status" == "confirmed"


# 23. Delete imaging finding
DELETE {{api}}/dental/imaging/findings/{{finding_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 204


# ============================================================
# IMAGING MEASUREMENTS
# ============================================================

# 24. Create measurement
POST {{api}}/dental/imaging/images/{{image_id}}/measurements
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "type": "distance",
  "geometry": {"type": "distance", "points": [{"x": 100, "y": 200}, {"x": 150, "y": 250}]}
}
HTTP 201
[Captures]
measurement_id: jsonpath "$.id"
[Asserts]
# API maps the input measurement type 'distance' onto the stored annotation enum 'line'.
jsonpath "$.type" == "line"
jsonpath "$.geometry.type" == "distance"


# 25. List measurements for image
GET {{api}}/dental/imaging/images/{{image_id}}/measurements
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.items" isCollection


# 25b. Update measurement (move) — PATCH new geometry + value; type stays immutable.
PATCH {{api}}/dental/imaging/measurements/{{measurement_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "geometry": {"type": "distance", "points": [{"x": 110, "y": 210}, {"x": 170, "y": 280}]},
  "measurementValue": 12.5,
  "measurementUnit": "mm"
}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{measurement_id}}"
# type is immutable — a moved 'distance' overlay stays stored as 'line'.
jsonpath "$.type" == "line"
jsonpath "$.geometry.points[1].x" == 170
jsonpath "$.measurementValue" == 12.5


# 26. Delete measurement
DELETE {{api}}/dental/imaging/measurements/{{measurement_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 204


# ============================================================
# IMAGING IMAGE — MODALITY + DELETE
# ============================================================

# 27. Get ceph landmarks for image
GET {{api}}/dental/imaging/images/{{image_id}}/ceph/landmarks
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.items" isCollection


# 28. Delete a landmark by code — use S (still 'placed'); N is locked and would 422.
DELETE {{api}}/dental/imaging/images/{{image_id}}/ceph/landmarks/S
Cookie: better-auth.session_token={{session_token}}
HTTP 204


# 29. Update image modality
PATCH {{api}}/dental/imaging/images/{{image_id}}/modality
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "modality": "panoramic"
}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{image_id}}"
jsonpath "$.modality" == "panoramic"


# 30. Delete imaging image
DELETE {{api}}/dental/imaging/images/{{image_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 204


# 31. Findings auth check → 401 (invalid bearer overrides hurl's stored cookie)
GET {{api}}/dental/imaging/images/{{image_id}}/findings
Authorization: Bearer invalid-no-session
HTTP 401
