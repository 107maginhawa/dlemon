<!-- oli-version: 1.1 | generated: 2026-05-24 | skill: oli-module-specs --all -->

# Module Specification: dental-imaging

---
Spec Version: 1.0 | Last Updated: 2026-05-24
---

## 1. Module Overview
**Purpose:** Radiographic study management, per-image annotations, imaging findings, and cephalometric (ceph) analysis workspace (v1.4). Intentional loose coupling — no DB-level FKs to other modules; UUID references only.

**Users:** dentist_owner, dentist_associate (full), staff_full (view only [INFERRED])

**Related:** storage (S3/MinIO for image files), dental-org (assertBranchAccess, imagingTier gate), dental-visit (loose UUID ref), dental-pmd (imaging included in PMD snapshot)

---

## 2. Domain Terms

| Term | Definition |
|------|-----------|
| Imaging Study | Container for one or more radiographic images (CBCT, periapical, panoramic, ceph) |
| Imaging Image | Individual radiograph within a study |
| Imaging Annotation | Per-image drawn overlay (arrow, circle, text, measurement); stateless presentation layer with a `visible` flag only — carries **no** state machine (V-IMG-008). SM-01 belongs to Imaging Finding. |
| Imaging Finding | Clinically significant observation; state machine SM-01 |
| Ceph Analysis | Cephalometric measurement set for one lateral ceph image |
| Ceph Landmark | Anatomical point placed by dentist; state: not_placed→placed→locked (SM-02) |
| imagingTier | Subscription tier gating ceph features (BR-016c) |

---

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| WF-019 | Dentist | Upload radiographic study | P0 |
| WF-020 | Dentist | Annotate radiograph | P0 |
| WF-040 | Dentist | Record imaging finding | P0 |
| WF-067 [INFERRED] | Dentist | Add images to study | P1 |
| WF-087 [INFERRED] | Dentist | View imaging study list | P1 |
| WF-030 | Dentist | Run ceph analysis | P1 (v1.4, imagingTier required) |
| WF-031 | Dentist | Place ceph landmarks | P1 (v1.4) |

---

## 4. Workflow Details

### WF-019 — Upload Radiographic Study
1. Dentist opens patient imaging workspace → "New Study" button.
2. Study metadata dialog: study type (periapical/bitewing/panoramic/cbct), tooth/teeth (optional), date, notes.
3. `imagingTier` derived from study type: `basic` (periapical/bitewing), `panoramic` (OPG), `cbct` (3D).
4. File upload (DICOM or JPEG/PNG): drag-drop or file picker. One study may contain multiple images.
5. Study created in `pending_review` state → dentist reviews → transitions to `reviewed`.

### WF-020 — Annotate Radiograph
1. Dentist opens study image in the imaging viewer → selects annotation tool (arrow, freehand, measurement).
2. Annotation drawn on canvas overlay. Label text optional.
3. Save: annotation record persisted with coordinates (relative %, not pixel — viewport-independent).
4. Annotations are user-specific. Any dentist with branch access may view but only the creator may edit.
5. Annotations visible in PDF export alongside the radiograph.

### WF-040 — Record Imaging Finding
1. Dentist in imaging viewer → "Add Finding" panel.
2. Finding form: finding type (caries, bone loss, fracture, etc.), severity, affected tooth/surface, notes.
3. Finding linked to the imaging study and optionally to a treatment record in dental-clinical.
4. Finding appears in the patient's clinical summary and the study's finding list.
5. Findings are immutable after visit lock; amendments via WF-038 pattern.

### WF-030 — Run Ceph Analysis (v1.4, `imagingTier = cbct` required)
1. Dentist uploads a lateral cephalometric radiograph (panoramic or CBCT series).
2. Server validates `imagingTier` for the branch (BR-016c) → 403 if insufficient.
3. Auto-landmark detection runs (server-side isomorphic math engine). Results returned within 5s (P95).
4. Dentist reviews auto-placed landmarks in the ceph viewer; can drag to correct (WF-031).
5. On confirmation: ceph analysis record saved with landmark coordinates, derived angles (ANB, SNA, SNB, etc.), and skeletal classification.

### WF-031 — Place / Adjust Ceph Landmarks (v1.4)
1. Follows WF-030 auto-detection or can be triggered manually on a CBCT-tier study.
2. Ceph viewer displays the radiograph with landmark overlay (circles with IDs).
3. Dentist drags each landmark to corrected position. Angles recalculate live.
4. "Lock Analysis" commits the final landmark set — further edits require a new analysis record.
5. Locked analysis results included in PMD export and printable ceph report.

---

## 5. Business Rules

| Rule ID | Rule | Expected Behavior |
|---------|------|-------------------|
| BR-016c | imagingTier gates ceph features | 403 if `imagingTier !== 'addon'`; `addon` IS the cbct tier — DB enum `['free','basic','addon']` maps to `free` (no ceph), `basic` (2D only), `addon` (ceph/CBCT). Gate: `!== 'addon'` blocks both `free` and `basic`. |
| BR-023–035 | Annotation/finding rules (see BUSINESS_RULES.md §Imaging) | Per SM-01 |
| BR-036–047 | Ceph landmark + analysis rules (see BUSINESS_RULES.md §Ceph) | Per SM-02 |
| Loose coupling | No DB-level FKs to other modules | UUID refs only; no JOIN to other module tables |

---

## 6. Permissions

| Action | Allowed | Notes |
|--------|---------|-------|
| Upload study | dentist_owner, dentist_associate | — |
| Annotate / record finding | dentist_owner, dentist_associate | — |
| Run ceph | dentist_owner, dentist_associate | imagingTier required |
| View studies | all dental roles | Branch-scoped |

---

## 7. Data Requirements (key fields)
**`imaging_study`:** id, patient_id (UUID ref), branch_id, dentist_member_id, study_type (enum), capture_method (enum), created_at
**`imaging_study_image`:** id, study_id, storage_file_id, tooth_fdi (nullable), sequence_order
**`imaging_annotation`:** id, image_id, type (enum: line/angle/area/label/arrow/freehand/shape/tooth), geometry (JSONB), measurement_value, measurement_unit, tooth_number, visible (bool). V-IMG-008: annotations are presentation overlays with a `visible` flag — they do NOT carry the SM-01 finding state machine.
**`imaging_finding`:** id, image_id, tooth_number, type, status (SM-01: draft/confirmed/resolved)
**`ceph_analysis`:** id, study_id, analysis_type (steiner_hybrid_sn), status, calibration_method (enum), mm_per_pixel
**`ceph_landmark`:** id, analysis_id, landmark_type, x, y, status (not_placed/placed/locked), source (manual/auto)

---

## 7b. Aggregate Boundaries
ImagingStudy (aggregate root) owns ImagingImage, ImagingAnnotation, ImagingFinding.
CephAnalysis (aggregate root) owns CephLandmark.
Both reference Patient, Visit by UUID only — no DB FKs (intentional loose coupling pattern).

---

## 8. State Transitions
See DOMAIN_MODEL.md §6 SM-IMAGING-FINDING (SM-01) and SM-CEPH-LANDMARK (SM-02).
```
Finding (SM-01):  draft → confirmed → resolved   (no back-edge; resolved terminal)
Ceph Landmark:    not_placed → placed → locked
```
V-IMG-007: SM-01 applies to findings only; the create default is `draft` and reverting
`confirmed → draft` is rejected (422 INVALID_STATUS_TRANSITION, AC-IMG-002). Annotations
carry no state machine (see §7 — `visible` flag only).

---

## 9. UI/UX Requirements
**Imaging viewer:** fullscreen overlay, zoom/pan, annotation toolbar. **Finding list:** per-tooth findings panel. **Ceph workspace (v1.4):** landmark placement canvas, measurement table (Steiner hybrid SN analysis), calibration workflow. **States:** Loading, Empty (no studies), Study viewer, Annotation mode, Ceph analysis mode, imagingTier upgrade prompt.

---

## 10. API Expectations
V-IMG-009: the implemented surface is **image-centric** (ceph state hangs off an image,
not a standalone `ceph-analyses` resource). Canonical routes:
- `POST /dental/imaging/studies` (create study + presigned upload URL)
- `GET /dental/imaging/studies/:studyId`
- `GET /dental/patients/:patientId/images` (patient-scoped union of imaging + legacy)
- `POST /dental/imaging/images/:imageId/measurements`, `PATCH .../measurements/:id`
- `POST /dental/imaging/images/:imageId/findings`, `GET .../findings`, `PATCH /dental/imaging/findings/:findingId`
- `GET|POST /dental/imaging/images/:imageId/ceph/landmarks` (batch upsert), `PATCH|DELETE .../ceph/landmarks/:code`
- `GET /dental/imaging/images/:imageId/ceph/analysis`, `POST .../ceph/analysis/recompute`
- `GET|POST /dental/imaging/images/:imageId/ceph/reports`

---

## 10b. Domain Events
**Published:** DE-018 ImagingStudyUploaded, DE-019 ImagingFindingConfirmed, DE-020 CephAnalysisComputed
**Consumed:** (none — loose coupling)

Per ADR-006 (domain-events-descope), domain events here are audit-log-only semantic markers — there is NO event bus. Producers satisfy them by writing the corresponding dental_audit_log row synchronously via logAuditEvent(); reactive consumers (e.g. notifs) are deferred to a future phase. No publisher/emit scaffolding is required.

---

## 11. Acceptance Criteria
**AC-IMG-001:** Upload study without imagingTier for ceph → 403 (BR-016c).
**AC-IMG-002:** Finding status reversal (confirmed → draft) → 422 (SM-01). _(SM-01 is carried by `imaging_finding`, not annotations — see §7 V-IMG-008 + §8 V-IMG-007. Enforced in `updateFinding.ts` via `FINDING_TRANSITIONS`; tested by `imaging-finding.fsm.property.test.ts` + `imaging.test.ts`.)_
**AC-IMG-003:** Ceph landmark: placed → not_placed → 422 (SM-02).
**AC-IMG-004:** Study images stored in S3 — URL returned in response, not raw data.
**AC-IMG-005:** Study list returns only studies for requesting user's branch.

---

## 12. Test Expectations
Unit: SM-01 annotation states, SM-02 landmark states, BR-016c tier gate.
Integration: study upload → image stored in S3 → URL accessible.
Coverage: see BUSINESS_RULES.md §Imaging coverage summary (imaging.test.ts, ceph.test.ts).

---

## 13. Edge Cases
- Ceph analysis recompute with missing landmarks → error with list of missing landmarks
- Study upload with unsupported MIME type → 422
- Finding on study from different branch → 403 (assertBranchAccess)
- Calibration not set before landmark placement → 422 NOT_CALIBRATED

---

## 14. Dependencies
**Internal:** dental-org (assertBranchAccess, imagingTier), storage (S3 file upload/download), dental-pmd (imaging included in PMD)
**External:** S3/MinIO (image file storage)

---

## 15. Error Handling

| Scenario | HTTP | Code |
|----------|------|------|
| imagingTier insufficient | 403 | IMAGING_TIER_REQUIRED |
| Invalid annotation state | 422 | INVALID_STATUS_TRANSITION |
| Not calibrated | 422 | NOT_CALIBRATED |
| Unsupported image type | 422 | UNSUPPORTED_MIME_TYPE |

---

## 16. Performance Expectations
Study upload < 10s (DICOM/10MB). Image viewer load < 2s. Ceph analysis recompute < 3s. Annotation save < 500ms.

---

## 17. Observability Hooks
dental-imaging.study-uploaded (INFO, studyId, branchId), dental-imaging.ceph-computed (INFO), dental-imaging.tier-blocked (WARN, tier, feature). No PHI in logs.

---

## 18. Feature Flags
| Flag | Default | Description |
|------|---------|-------------|
| dental_imaging_ceph_enabled | false | Gate ceph workspace by imagingTier |
| dental_imaging_auto_landmark | false | AI-assisted landmark placement |

---

## 19. Vertical Slice Plan
IMG-S1: Study upload + image store | IMG-S2: Annotation (SM-01) | IMG-S3: Findings | IMG-S4: Ceph analysis + landmarks (SM-02) | IMG-S5: Ceph report generation | IMG-S6: imagingTier gate

---

## 20. AI Instructions
1. NO DB-level foreign keys to other modules — UUID references only (loose coupling pattern).
2. imagingTier check via dental-org before ANY ceph endpoint.
3. S3 operations via storage module — never implement S3 directly.
4. Ceph math engine is isomorphic (runs in browser and server) — keep pure functions.
5. Follow ARCHITECTURE.md, CONTRIBUTING.md, VERTICAL_TDD.md.
