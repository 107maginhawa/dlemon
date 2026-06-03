# P2-7 CBCT / 3-D imaging contract tests (Phase 1 / Option A1)
#
# Chain:
#   signup → org (addon tier) → branch → member → patient
#   → create CBCT study (modality=cbct, application/dicom, >5 MB)
#       → asserts MULTIPART envelope (uploadId + partUrls, NOT a single PUT)
#   → finalizeCbctStudy (server-side DICOM parse from base64 fixture)
#       → asserts is_volume=true, frameCount, spacing, UIDs, dicom_tag calibration
#   → getImagingStudy → asserts viewerKind='volume' surfaced
#   → getCbctViewerLink → asserts presigned download handoff (A1)
#   → free-tier branch blocked from CBCT create (IMAGING_TIER_REQUIRED)
#
# Every CBCT route is /dental/imaging-prefixed (route-override regression guard).


# ============================================================
# SETUP
# ============================================================

POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "dental-cbct-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dr. CBCT Tester"
}
HTTP 200
[Captures]
session_token: cookie "better-auth.session_token"
user_id: jsonpath "$.user.id"


# Self-service onboarding — org + default branch + owner membership in one call
# (replaces the old org→branch→member setup; caller becomes owner + dentist_owner).
POST {{api}}/dental/onboarding
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "organizationName": "CBCT Test Clinic {{suffix}}",
  "tier": "clinic",
  "countryCode": "PH",
  "branchName": "CBCT Main Branch",
  "timezone": "Asia/Manila",
  "address": "1 Cone Beam Ave",
  "city": "Manila",
  "phone": "+639001234570",
  "ownerDisplayName": "Dr. CBCT Tester"
}
HTTP 201
[Captures]
org_id: jsonpath "$.organizationId"
branch_id: jsonpath "$.branchId"
dentist_member_id: jsonpath "$.membershipId"


# Upgrade org to imaging addon tier (CBCT is addon-gated, same as cephalometric).
PATCH {{api}}/dental/organizations/{{org_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "imagingTier": "addon"
}
HTTP 200
[Asserts]
jsonpath "$.imagingTier" == "addon"


POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "CBCT Test Patient {{suffix}}",
  "consentGiven": true,
  "branchId": "{{branch_id}}"
}
HTTP 201
[Captures]
patient_id: jsonpath "$.id"


# ============================================================
# CBCT STUDY CREATE — MULTIPART ROUTING (NOT single PUT)
# ============================================================

# Large CBCT DICOM (50 MB) → S3 multipart envelope with uploadId + part URLs.
POST {{api}}/dental/imaging/studies
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{patient_id}}",
  "branchId": "{{branch_id}}",
  "modality": "cbct",
  "filename": "cone-beam.dcm",
  "mimeType": "application/dicom",
  "size": 52428800
}
HTTP 201
[Captures]
study_id: jsonpath "$.study.id"
image_id: jsonpath "$.image.id"
[Asserts]
jsonpath "$.study.modality" == "cbct"
jsonpath "$.uploadMethod" == "MULTIPART"
jsonpath "$.uploadId" isString
jsonpath "$.partUrls" isCollection
jsonpath "$.partCount" >= 1


# ============================================================
# FINALIZE — server-side DICOM parse populates the volume metadata
# ============================================================

# dicomBase64 is a minimal VALID synthetic multi-frame CT/CBCT DICOM
# (128-byte preamble + DICM + file-meta TransferSyntaxUID + the volume tags).
POST {{api}}/dental/imaging/studies/{{study_id}}/cbct/finalize
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "imageId": "{{image_id}}",
  "dicomBase64": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABESUNNAgAAAFVMBABQAAAAAgACAFVJGgAxLjIuODQwLjEwMDA4LjUuMS40LjEuMS4yAAIAAwBVSQoAMS4yLjMuNC43AAIAEABVSRQAMS4yLjg0MC4xMDAwOC4xLjIuMQAIAGAAQ1MCAENUCABwAExPCgBUZXN0VmVuZG9yGABQAERTBAAwLjMwIAANAFVJCgAxLjIuMy40LjUAIAAOAFVJCgAxLjIuMy40LjYAKAAIAElTBAAxMjgAKAAQAFVTAgAAAigAEQBVUwIAAAIoADAARFMKADAuMjVcMC4yNQA="
}
HTTP 200
[Asserts]
jsonpath "$.image.isVolume" == true
jsonpath "$.image.frameCount" == 128
jsonpath "$.image.sliceThicknessMm" == 0.3
jsonpath "$.image.seriesInstanceUid" == "1.2.3.4.6"
jsonpath "$.image.studyInstanceUid" == "1.2.3.4.5"
jsonpath "$.image.dicomMetadata.calibrationMethod" == "dicom_tag"


# ============================================================
# GET STUDY — surfaces viewerKind discriminator
# ============================================================

GET {{api}}/dental/imaging/studies/{{study_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{study_id}}"
jsonpath "$.images[0].isVolume" == true
jsonpath "$.images[0].viewerKind" == "volume"
jsonpath "$.images[0].frameCount" == 128


# ============================================================
# VIEWER LINK — A1 presigned download handoff
# ============================================================

GET {{api}}/dental/imaging/studies/{{study_id}}/cbct/viewer-link
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.viewerKind" == "download"
jsonpath "$.downloadUrl" isString
jsonpath "$.isVolume" == true
jsonpath "$.frameCount" == 128


# Viewer link auth check → 401. Hurl's cookie jar auto-replays the signed-in
# session cookie on every request, so a bare GET is still authenticated; a Bearer
# token the auth layer can't resolve overrides the cookie and yields a true 401
# (mirrors the pattern in the sibling dental contract files).
GET {{api}}/dental/imaging/studies/{{study_id}}/cbct/viewer-link
Authorization: Bearer invalid-no-session
HTTP 401


# Finalize with malformed DICOM → 422 INVALID_DICOM
POST {{api}}/dental/imaging/studies/{{study_id}}/cbct/finalize
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "imageId": "{{image_id}}",
  "dicomBase64": "AQIDBAUGBwg="
}
HTTP 422
[Asserts]
jsonpath "$.code" == "INVALID_DICOM"


# ============================================================
# TIER GATE — free-tier branch blocked from CBCT create
# ============================================================

# A second org left on the default (free) imaging tier. The one-active-org
# invariant forbids the primary user owning two active solo/clinic orgs, so a
# SEPARATE owner provisions the free org via onboarding and then grants the
# primary user branch access — preserving the tier-gate intent (the primary user
# has branch ACCESS, but the org's imaging tier is free).
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "dental-cbct-free-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dr. CBCT Free Owner"
}
HTTP 200
[Captures]
free_owner_token: cookie "better-auth.session_token"


POST {{api}}/dental/onboarding
Cookie: better-auth.session_token={{free_owner_token}}
Content-Type: application/json
{
  "organizationName": "CBCT Free Clinic {{suffix}}",
  "tier": "solo",
  "countryCode": "PH",
  "branchName": "CBCT Free Branch",
  "timezone": "Asia/Manila",
  "address": "2 Free Ave",
  "city": "Manila",
  "phone": "+639001234571",
  "ownerDisplayName": "Dr. CBCT Free Owner"
}
HTTP 201
[Captures]
free_org_id: jsonpath "$.organizationId"
free_branch_id: jsonpath "$.branchId"


# Free-org owner grants the primary user branch access (so the CBCT attempt below
# fails on the IMAGING TIER gate, not the branch-access gate).
POST {{api}}/dental/organizations/{{free_org_id}}/branches/{{free_branch_id}}/members
Cookie: better-auth.session_token={{free_owner_token}}
Content-Type: application/json
{
  "displayName": "Dr. CBCT Tester",
  "role": "dentist_owner",
  "personId": "{{user_id}}"
}
HTTP 201


POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "CBCT Free Patient {{suffix}}",
  "consentGiven": true,
  "branchId": "{{free_branch_id}}"
}
HTTP 201
[Captures]
free_patient_id: jsonpath "$.id"


# CBCT create on a free-tier branch → 403 IMAGING_TIER_REQUIRED
POST {{api}}/dental/imaging/studies
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientId": "{{free_patient_id}}",
  "branchId": "{{free_branch_id}}",
  "modality": "cbct",
  "filename": "cone-beam.dcm",
  "mimeType": "application/dicom",
  "size": 52428800
}
HTTP 403
[Asserts]
jsonpath "$.code" == "IMAGING_TIER_REQUIRED"
