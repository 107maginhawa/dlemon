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


# 0a. Create a dental organization
POST {{api}}/dental/organizations
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "name": "Imaging Test Clinic {{suffix}}",
  "tier": "clinic",
  "countryCode": "PH"
}
HTTP 201
[Captures]
org_id: jsonpath "$.id"


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


# 0c. Create a branch
POST {{api}}/dental/organizations/{{org_id}}/branches
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "name": "Main Branch",
  "timezone": "Asia/Manila",
  "address": "123 Imaging Street",
  "city": "Manila",
  "phone": "+639001234569"
}
HTTP 201
[Captures]
branch_id: jsonpath "$.id"


# 0d. Create branch membership (grants branch + upload access)
POST {{api}}/dental/organizations/{{org_id}}/branches/{{branch_id}}/members
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Dr. Imaging Tester",
  "role": "dentist_owner",
  "personId": "{{user_id}}"
}
HTTP 201
[Captures]
dentist_member_id: jsonpath "$.id"


# 0e. Create a dental patient
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


# 2. Calibrate image (pixelSpacingMm=0.2) — required for calibrated measurements
PATCH {{api}}/dental/imaging/images/{{image_id}}/calibration
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "pixelSpacingMm": 0.2
}
HTTP 200
[Asserts]
jsonpath "$.pixelSpacingMm" == 0.2


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


# 3b. Detect requires authentication → 401
POST {{api}}/dental/imaging/images/{{image_id}}/ceph/landmarks/detect
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
jsonpath "$.items[?(@.landmarkCode=='Or')].source" nth 0 == "ai"
jsonpath "$.items[?(@.landmarkCode=='Or')].confidence" nth 0 == 0.83


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
jsonpath "$.items[?(@.landmarkCode=='Or')].source" nth 0 == "ai_corrected"


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
POST {{api}}/dental/imaging/images/{{image_id}}/ceph/reports
Cookie: better-auth.session_token={{session_token}}
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


# 15. GET report (latest version) — snapshot must match what was returned on create
GET {{api}}/dental/imaging/images/{{image_id}}/ceph/reports
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.version" == 1
jsonpath "$.id" == "{{report_id}}"
jsonpath "$.snapshot.analysis_label" == "steiner_hybrid_sn"


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


# 17f. Superimposition auth check (no cookie) → 401
GET {{api}}/dental/imaging/patients/{{patient_id}}/ceph/superimpositions
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


# 19. Get study auth check
GET {{api}}/dental/imaging/studies/{{study_id}}
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
  "status": "suspected",
  "toothNumber": 36,
  "visitId": "{{imaging_visit_id}}",
  "patientId": "{{patient_id}}",
  "branchId": "{{branch_id}}",
  "note": "Mesial caries suspected"
}
HTTP 200
[Captures]
finding_id: jsonpath "$.id"
[Asserts]
jsonpath "$.type" == "caries"
jsonpath "$.toothNumber" == 36


# 21. List findings for image
GET {{api}}/dental/imaging/images/{{image_id}}/findings
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


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
HTTP 200


# ============================================================
# IMAGING MEASUREMENTS
# ============================================================

# 24. Create measurement
POST {{api}}/dental/imaging/images/{{image_id}}/measurements
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "type": "distance",
  "geometry": {"points": [{"x": 100, "y": 200}, {"x": 150, "y": 250}]}
}
HTTP 200
[Captures]
measurement_id: jsonpath "$.id"
[Asserts]
jsonpath "$.type" == "distance"


# 25. List measurements for image
GET {{api}}/dental/imaging/images/{{image_id}}/measurements
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# 26. Delete measurement
DELETE {{api}}/dental/imaging/measurements/{{measurement_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200


# ============================================================
# IMAGING IMAGE — MODALITY + DELETE
# ============================================================

# 27. Get ceph landmarks for image
GET {{api}}/dental/imaging/images/{{image_id}}/ceph/landmarks
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.items" isCollection


# 28. Delete a landmark by code
DELETE {{api}}/dental/imaging/images/{{image_id}}/ceph/landmarks/N
Cookie: better-auth.session_token={{session_token}}
HTTP 200


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
HTTP 200


# 31. Findings auth check
GET {{api}}/dental/imaging/images/{{image_id}}/findings
HTTP 401
