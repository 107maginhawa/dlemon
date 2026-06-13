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
3. Dentist places cephalometric landmarks **manually** on the ceph viewer (WF-031). Manual placement is the default and only committed V1 input path (no-AI — see the no-AI note below).
4. Angles recalculate live as landmarks are placed/adjusted (server-side isomorphic math engine, pure functions).
5. On "Lock Analysis": ceph analysis record saved with landmark coordinates, derived angles (ANB, SNA, SNB, etc.), and skeletal classification.

> **No-AI note (product decision #2, 2026-06-12):** automatic landmark detection is **not** part of the committed V1 workflow. An optional, addon-gated auto-detect affordance exists behind the `dental_imaging_auto_landmark` feature flag (**default OFF** — see §18; `detectCephLandmarks` returns 403 `FEATURE_DISABLED` when off). It is backed by a deterministic `FakeDetector` dev/test fixture (`repos/ceph-landmark-detector.ts`) — **not a clinical AI detector** — and every suggested point is an explicitly-disclosed draft the clinician must confirm. The platform is local-first / no-AI; manual landmark placement is the shipped path. (Aligned with `docs/clinical/STANDARDS_COMPLIANCE.md` — AI auto-tracing is an intentional non-goal.)

### WF-031 — Place / Adjust Ceph Landmarks (v1.4)
1. Triggered manually on a CBCT-tier study (the default path); the optional, flag-gated auto-detect (above) seeds draft landmarks only when enabled.
2. Ceph viewer displays the radiograph with landmark overlay (circles with IDs).
3. Dentist drags each landmark to corrected position. Angles recalculate live.
4. "Lock Analysis" commits the final landmark set — further edits require a new analysis record.
5. Locked analysis results included in PMD export and printable ceph report.

### WF-030b — Cephalometric Superimposition (P1-11, V1: preview-only) — Phase-2 persistence
1. Dentist in the ceph workspace selects two report snapshots (earlier vs later timepoint) to compare.
2. Registration reference = cranial-base S–N only in V1; maxillary/mandibular structural registration is deferred to Phase-2.
3. Backend computes a similarity transform; the viewer renders the two tracings stacked with an opacity slider + onion-skin, plus a per-landmark mm delta table.
4. **V1 is preview-only and NOT persisted** — results compute on the fly (`POST …/ceph/superimpositions/preview`, response `id: null`) and recompute on revisit. The persist trio (`POST …/ceph/superimpositions`, `GET …/{id}`, list) is built but has **no V1 production consumer** and is Phase-2-dormant (product decision #19, 2026-06-12). Honesty: this is a simplified two-point (S–N) superimposition, not ABO-grade structural superimposition.

### CBCT / 3-D volumes (P2-7) — declared OUT of V1 launch scope
The schema accepts `modality='cbct'` and stores DICOM volume metadata, and `finalizeCbctStudy` parses DICOM tags server-side, but the full CBCT ingest chain (large-volume multipart upload UI, finalize wiring, 3-D viewer handoff) is **out of V1 launch scope** (product decision #19, 2026-06-12). `finalizeCbctStudy` has **0 production consumers** (exercised only by seed/integration tests); a clinician cannot complete a CBCT upload in the V1 app. CBCT is Phase-2 / addon-dormant; the schema unique-constraint hardening is deferred with it.

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
| Capture / upload study | dentist_owner, dentist_associate, **hygienist, dental_assistant** | E2/E3 reconciliation: capture is clinical-write — hygienist + dental_assistant may capture under dentist supervision (`createImagingStudy` `assertBranchRole`). Authoritative grid: ROLE_PERMISSION_MATRIX.md §Clinical Write ("Capture imaging study"). |
| CBCT *finalize* (`finalizeCbctStudy`) | dentist_owner, dentist_associate | Stays dentist-only (DICOM parse + volume commit). |
| Image management (delete / calibration / modality / **metadata** / **links**) | dentist_owner, dentist_associate | Not hygienist/assistant — see deleteImage BR-026/027, calibration/modality/metadata/link `assertBranchRole`. |
| Annotate / record finding | dentist_owner, dentist_associate | — |
| **Ceph landmark drafting** | dentist_owner, dentist_associate, **dental_assistant** | **G4-B**: assistants may place/edit landmarks in draft; writing/transitioning to `confirmed`/`locked` → 403 `ASSISTANT_CANNOT_FINALIZE`. Only `dental_assistant` drafts (hygienist/coordinator excluded). |
| **Ceph finalize** (confirm/lock landmarks, generate report) | dentist_owner, dentist_associate | **G4-B**: clinician sign-off only; report snapshot pins `prepared_by`/`finalized_by`. |
| Run ceph | dentist_owner, dentist_associate | imagingTier=`addon` required (BR-016c) |
| View studies / images / ceph | all clinical dental roles (read) | Branch-scoped; non-ceph reads 403 on no-access, ceph reads 404-mask (info-hiding) |

---

## 7. Data Requirements (key fields)
**`imaging_study`:** id, patient_id (UUID ref), branch_id, dentist_member_id, study_type (enum), capture_method (enum), created_at
**`imaging_study_image`:** id, study_id, storage_file_id, tooth_fdi (nullable), sequence_order, **`is_diagnostic` (bool, default true), `quality_status` (enum ok|retake, default ok), `retake_reason` (nullable), `tags` (jsonb string[])** — G5a library metadata (migration 0098)
**`imaging_link`:** id, image_id (FK→image), `link_type` (enum treatment_plan|ortho_case|report), `target_id` (uuid, loose-coupled — no DB FK to target module), created_at, created_by; unique(image_id, link_type, target_id) — G5b context links (migration 0099)
**`imaging_calibration`:** id, image_id (FK→image), `version` (monotonic per image), `point_a`/`point_b` (jsonb {x,y}), `known_distance_mm`, `pixel_distance`, `pixel_spacing_mm`, `method`, created_at, created_by — G6 append-only versioned 2-point ruler record (migration 0097)
**`imaging_annotation`:** id, image_id, type (enum: line/angle/area/label/arrow/freehand/shape/tooth), geometry (JSONB), measurement_value, measurement_unit, tooth_number, visible (bool). V-IMG-008: annotations are presentation overlays with a `visible` flag — they do NOT carry the SM-01 finding state machine.
**`imaging_finding`:** id, image_id, tooth_number, type, status (SM-01: draft/confirmed/resolved)
**`ceph_analysis`:** id, study_id, analysis_type (steiner_hybrid_sn), status, calibration_method (enum), mm_per_pixel
**`ceph_landmark`:** id, analysis_id, landmark_type, x, y, status (not_placed/placed/locked), source (manual/auto), created_by/updated_by (G4-B sign-off authorship)
**`imaging_ceph_report`:** id, image_id, version, snapshot (jsonb — pins analysis_type/norm_population/norm_version/formula_version/calibration record + `prepared_by`/`finalized_by`), **`revision_of` (nullable self-ref), `revision_reason` (nullable)** — G1-B revision lineage (migration 0096); append-only/immutable

---

## 7b. Aggregate Boundaries
ImagingStudy (aggregate root) owns ImagingImage, ImagingAnnotation, ImagingFinding.
CephAnalysis (aggregate root) owns CephLandmark.
Both reference Patient, Visit by UUID only — no DB FKs (intentional loose coupling pattern).

### Two finding systems are intentional and separate — DO NOT merge
The platform has **two distinct "finding" tables that must not be unified**:

| | `imaging_finding` (this module) | `dental_finding` (dental-visit) |
| --- | --- | --- |
| Schema | `dental-imaging/repos/imaging_finding.schema.ts` | `dental-visit/repos/dental-finding.schema.ts` |
| Scope | **image-scoped** — anchored to an `imaging_study_image` | **visit-scoped** — anchored to a visit/chart |
| Purpose | radiographic reads (caries/lesion seen *on an X-ray*) | clinical charting condition vocabulary (a condition observed *in the mouth* → proposed treatment) |
| Lifecycle | SM-01 FSM `draft → confirmed → resolved` (§8) | condition→treatment derivation (charting, migration 0100) |

They model **different clinical acts at different anchors** and deliberately do not share a row, a status machine, or a foreign key. A radiograph finding may *inform* a chart condition, but the two are recorded independently. Future contributors must **not** "deduplicate" them into one table: doing so would collapse the image-evidence audit trail (SM-01 confirm/resolve on a specific X-ray) into the visit chart and break both this module's finding FSM and dental-visit's condition→treatment flow.

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
- Library admin (G5 / AHA Batch B FIX-003): `PATCH /dental/imaging/images/:imageId/metadata` (diagnostic flag / quality / tags), `PATCH /dental/imaging/images/:imageId/modality` (reclassify a mis-captured image), `DELETE /dental/imaging/images/:imageId` (soft-delete/archive → **204 No Content**, consistent with the module's other delete ops). All three are wired into the per-image editor (`ImageMetadataEditor`); modality + delete are owner/associate-gated (BR-026/BR-027) on the backend.

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
- Ceph analysis recompute with missing landmarks → returns `missing[]` list (analysis is never 404; mm metrics that depend on absent landmarks are null)
- Study upload with unsupported MIME type → 422 UNSUPPORTED_MIME_TYPE
- Study upload exceeding the per-modality byte ceiling → 422 FILE_TOO_LARGE
- Finding/measurement/image-management on a study from a branch the caller can't access → 403 (non-ceph) / 404-mask (ceph endpoints, info-hiding)
- Landmark placement does NOT require calibration — landmarks may be placed uncalibrated; `recomputeCephAnalysis` returns 422 NOT_CALIBRATED only when an mm (linear) metric is requested on an image whose pixel spacing is missing/anisotropic. Pixel-based angle metrics still compute.
- Unknown `analysisType` query param → 422 UNSUPPORTED_ANALYSIS_TYPE (never silently defaulted)
- Ceph superimposition is preview-only in V1 (no persistence): `…/ceph/superimpositions/preview` returns `id: null` and there is no V1 fetch-by-id consumer; structural multi-point registration is Phase-2 (decision #19).
- CBCT studies cannot be finalized in the V1 app (the multipart upload + finalize chain is not wired into production UI); `finalizeCbctStudy` is reachable only via seed/integration harnesses (decision #19).

---

## 14. Dependencies
**Internal:** dental-org (assertBranchAccess, imagingTier), storage (S3 file upload/download), dental-pmd (imaging included in PMD)
**External:** S3/MinIO (image file storage)

---

## 15. Error Handling

| Scenario | HTTP | Code |
|----------|------|------|
| imagingTier insufficient (not `addon`, incl. `free`/`basic`/null) | 403 | IMAGING_TIER_REQUIRED |
| Invalid finding state transition (SM-01, e.g. confirmed→draft) | 422 | INVALID_STATUS_TRANSITION |
| mm metric requested on uncalibrated/anisotropic image | 422 | NOT_CALIBRATED |
| Unsupported image MIME type | 422 | UNSUPPORTED_MIME_TYPE |
| Upload exceeds per-modality byte ceiling | 422 | FILE_TOO_LARGE |
| Unknown ceph `analysisType` | 422 | UNSUPPORTED_ANALYSIS_TYPE |
| Malformed DICOM on CBCT finalize (no half-written volume) | 422 | INVALID_DICOM |
| Locked ceph landmark mutated/deleted | 422 | LANDMARK_LOCKED |
| viewer-link on a non-volume study | 422 | NOT_A_VOLUME |
| Non-member on ceph endpoint (info-hiding) | 404 | (masked) |

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
| dental_imaging_auto_landmark | false | Optional auto-landmark detection — **default OFF**, addon-gated. No-AI: backed by a deterministic `FakeDetector` dev/test fixture, not a clinical AI detector; every point is a draft-to-confirm (decision #2). |

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
