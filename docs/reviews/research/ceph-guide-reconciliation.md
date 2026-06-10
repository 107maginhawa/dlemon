# Ceph / Imaging — Enhancement Guide ↔ Implementation Reconciliation

**Date:** 2026-06-10
**Branch:** `chore/workflow-verification-sweep`
**Inputs:**
- Spec source: `docs/context/DENTAL_IMAGING_AND_MANUAL_CEPH_TRACING_ENHANCEMENT_GUIDE_UPDATED.md` (the "guide")
- Standards baseline: `docs/clinical/STANDARDS_COMPLIANCE.md`
- Prior live audit: `docs/audits/module-gap-plans/dental-imaging-gap-plan.md` (2026-06-09)
- Verified directly against code (paths cited inline)

## Why this doc exists

We considered a live WebCeph walkthrough to learn workflows/business rules for optimizing the ceph module. On review, the guide above **already synthesizes the same public sources** (WebCeph public guide + the `forabi/WebCeph` and `alexcorvi/cephalometric` OSS repos + clinical references — guide §32), so a walkthrough adds little. **No live WebCeph study was run.**

The real issue: **the guide is written greenfield "V1 manual-first" and undershoots the current implementation.** Our module already has 6 analyses, superimposition, a richer landmark FSM, 6 population norm sets, calibration-safe math, and immutable versioned reports — all of which the guide treats as "to build" or defers to V2. Handed to an agent as-is, the guide would prompt **rebuilding existing features**. This doc runs the guide's own mandated **Phase 0 reconciliation (§26)** against real code and isolates the genuinely missing pieces.

> **Scope:** research + docs only. No code changes here. Real work is the backlog in the last section, executed Vertical-TDD per `docs/development/VERTICAL_TDD.md`.

---

## Status matrix (guide § → implementation)

Legend: ✅ DONE/exceeds · ◐ PARTIAL · ❌ MISSING · 🚫 N-A (intentional non-goal)

> **Backlog resolved 2026-06-10** (branch `chore/workflow-verification-sweep`, not pushed). Six commits `8975a1d2`→`bcc5dfab` closed Gaps 1/2/4/5/6; Gap 3 deferred. FE write UI for the G5 endpoints (`a378d4de`) + live E2E for calibration/metadata/links (`b0063f19`) followed. Matrix rows below flipped with commit refs.

| Guide § | Requirement | Status | Evidence / note |
|---|---|---|---|
| §4 Imaging library | Patient-owned images, modality, status | ✅ | `imaging.schema.ts` `imaging_study`/`imaging_study_image`, `modalityEnum` (8), `imagingStatusEnum` active/archived |
| §4 | Context links (visit, tooth, **treatment, ortho case, report**) | ✅ | **G5b** (`bcc5dfab`): new `imaging_link` join (link_type treatment_plan/ortho_case/report, loose-coupled `target_id`); POST/GET/DELETE link endpoints + FE link badges/filter (`a378d4de`) |
| §4 | Quality status, retake reason, tags, isDiagnostic, sourceDevice | ✅ | **G5a** (`ca018f79`): `is_diagnostic`/`quality_status`/`retake_reason`/`tags` on image + PATCH `/images/{id}/metadata` + library filters + FE editor (`a378d4de`). (`sourceDevice` still not modeled — no demand.) |
| §4 | Archive vs hard-delete; original preserved | ✅ | `status='archived'` soft-delete; `deleteImage` archives. (UI affordance gap → see gap-plan IMG-P3-1) |
| §5 Viewer | zoom/pan/fit/reset/rotate/brightness/contrast/invert/loupe | ✅ | `imaging-workspace.tsx`, `CephLoupe.tsx`; live-verified in gap-plan |
| §5 | Image-space coordinate persistence | ✅ | landmarks stored image-space px (`imaging_ceph.schema.ts:70`, D-C) |
| §6 Calibration | 2-point ruler → mm/px, calibrated status, recompute | ✅ | `calibration-dialog.tsx`, `updateImageCalibration.ts`; mm null when uncalibrated |
| §6 | **Versioned calibration record** (pointA/B + knownDistanceMm persisted) | ✅ | **G6** (`4f2037a3`): append-only `imaging_calibration` (monotonic `version`, `point_a`/`point_b`/`known_distance_mm`/`pixel_distance`/`pixel_spacing_mm`/`method`); server derives mm/px from the ruler; report snapshot pins the calibration record version. Live E2E `b0063f19` |
| §7 Annotations | point/line/arrow/rect/ellipse/text/freehand/distance/angle | ✅ | `imagingAnnotationTypeEnum` line/angle/area/label/arrow/freehand/shape/tooth (covers set; `shape`≈rect/ellipse, `label`≈text) |
| §8 Trace lifecycle | `draft→ready_for_review→finalized→revised→archived` session FSM | ✅* | **G1-B** (`9f16b0a0`): resolved via **light revision lineage** (`revision_of`/`revision_reason` on the report), not a session entity — decision was the immutable-report-version model + lineage is sufficient (no separate session object). See Gap 1 |
| §9 Landmark placement | guided placement, next-landmark, nudge, status | ✅ | `CephLandmarkPalette.tsx` (next-unplaced ring, arrow-key nudge via `ceph-keyboard.ts`) |
| §9 | Landmark FSM | ✅ exceeds | `not_placed→placed→confirmed→locked`, terminal-locked, 422 back-edge guard (`imaging_ceph.schema.ts:192`). Guide only proposed placed/missing/skipped |
| §10 Landmarks | skeletal + dental set, configurable defs | ✅ | 16 codes incl. U1/L1 tip+apex; soft-tissue **deferred** (standards doc) |
| §11 Analysis templates | configurable template entity, versioned, referenced by report | ❌ | analyses are a fixed enum (`steiner_hybrid_sn`/`ricketts`), not template rows; math engine computes 6, FE switches 6, but no template abstraction/versioning. See Gap 3 |
| §12 Measurement engine | pure, UI-separated, dependency-aware, status codes | ✅ | `packages/ceph-math` pure/isomorphic; `missing`/`uncalibrated` surfaced |
| §13 Measurements | SNA/SNB/ANB minimum | ✅ exceeds | 6 analyses: Steiner, Ricketts, Downs, Tweed, McNamara, Jarabak (`ceph-math/norms.ts`, `analyses.ts`) |
| §14 Norm sets | configurable, **versioned**, population-aware, report-pinned | ✅ | **G2** (`8975a1d2`): `NORMS_VERSION`/`FORMULA_VERSION` constants in `ceph-math`; report snapshot pins `norm_population`/`norm_version`/`formula_version`. (Norms remain code constants — versioned, not per-clinic configurable.) |
| §15 Finalization | confirm-gate, immutability | ✅ | `createCephReport.ts` gates on A/B/Go/Po `confirmed`; report append-only immutable |
| §16 Report | snapshot, reproducible, draft/final marking, export | ✅ | **G2** (`8975a1d2`) + **G1-B** (`9f16b0a0`) + **G4-B** (`075843ab`): snapshot now pins `analysis_type`/`norm_population`/`norm_version`/`formula_version`/`calibration.{record_version,point_a,point_b,known_distance_mm}` + `prepared_by`/`finalized_by` + `revision_of`/`revision_reason` |
| §17 Revision | revise finalized → new version, preserve history | ✅ | **G1-B** (`9f16b0a0`): explicit `revision_of` self-ref + `revision_reason` (migration 0096); `createCephReport` derives `revision_of` from the prior latest report; FE renders "Revises v{n-1} · Reason" |
| §18 Comparison/superimposition | side-by-side + overlay + deltas | ◐ | built (`SuperimpositionPanel.tsx`, `cephSuperimposition.ts`) but **persist/list not mounted in production overlay** (gap-plan IMG-P2-1); ABO 3-point deferred |
| §3 Permissions | **assistant prepares / clinician finalizes** split | ✅ | **G4-B** (`075843ab`): `dental_assistant` may draft/place landmarks; writing/transitioning to `confirmed`/`locked` + report-create gated to clinicians (403 `ASSISTANT_CANNOT_FINALIZE`); snapshot pins `prepared_by`/`finalized_by`. (Industry: only assistants draft — hygienists/coordinators excluded.) |
| §31.5 Landmark instruction library | per-landmark anatomical guidance | ✅ | `D_P_TOOLTIPS` in `CephLandmarkPalette.tsx:13` (inline + hover) |
| §1/§8 No-AI stance | manual-first, no AI auto-tracing | 🚫 + ⚠️ | non-goal honored in math; **but** a FakeDetector "Auto-detect" affordance ships (contradiction — gap-plan IMG-P1-1) |
| §31.7 Storage/security | private storage, signed URLs, RBAC, audit | ✅ | S3/MinIO presigned; `assertBranchRole` on mutations; Pino audit |
| §31.8 Seed/fixtures | demo patient w/ ceph chain | ✅ | `torres-miguel` (`scripts/seed-demo.ts` `seedCephChain`) |

---

## Already done — DO NOT rebuild

These guide sections describe building things that already exist and exceed the spec. An implementing agent must **not** re-create them:

- Landmark FSM + report confirm-gate + immutable versioned reports (§8/§9/§15/§16 core).
- 6 analyses + 6 population norm sets + calibration-safe (null-on-uncalibrated) math (§12/§13/§14 core).
- Viewer, calibration dialog, annotations, loupe, guided placement, landmark instruction library (§5/§6/§7/§9/§31.5).
- Image-space coordinate persistence, soft-delete/archive, presigned storage + RBAC + audit (§5/§31.7).

---

## Genuine gaps — the backlog

These are the items the guide surfaces that are **not** in the code. Several are **product decisions**, not just engineering. Each notes a Vertical-TDD entry point. Wiring/affordance gaps (superimposition mount, CBCT, auto-detect, delete/reclassify UI) are **already tracked** in `dental-imaging-gap-plan.md` — not duplicated here.

### Gap 1 — Trace-session lifecycle FSM `[RESOLVED 2026-06-10 — G1-B light lineage, commit 9f16b0a0]`
**Decision taken:** the immutable-report-version model is sufficient; instead of a session entity, we added **explicit revision lineage** — nullable `revision_of` (self-ref) + `revision_reason` on `imaging_ceph_report` (migration 0096, additive). `createCephReport` derives `revision_of` from the prior latest report; FE renders "Revises v{n-1} · Reason". No `imaging_ceph_trace_session` table was built (industry: a separate session object adds ceremony without workflow value here).

**Original framing (for context):** No session entity with `draft → ready_for_review → finalized → revised → archived` (guide §8). Today state is landmark-level + report-level only.
**Why it may matter:** No first-class "this trace is in progress / under review / finalized" object; no revision-of chain or revision reason; reports are the only "finalized" artifact.
**Decision:** Is the immutable-report-version model sufficient, or do we want an explicit session + revision lineage? If yes → new `imaging_ceph_trace_session` table referencing image + report versions; tie report creation to a session finalize.
**Entry point:** TypeSpec `dental-imaging.tsp` (new session ops) → schema `imaging_ceph.schema.ts` → handlers → FE `CephWorkspacePanel.tsx`.

### Gap 2 — Report reproducibility version-pinning `[RESOLVED 2026-06-10 — G2, commit 8975a1d2]`
**Done:** the report snapshot now pins `analysis_type` (free string clamped to all 6 `ANALYSIS_TYPES`), `norm_population`, `norm_version`, `formula_version`, and `calibration.{pixels_per_mm, version}` + `missing`/`uncalibrated`. `ceph-math` exports `NORMS_VERSION`/`FORMULA_VERSION`; the handler computes via `computeAnalysis(analysisType,…)`; FE `CephWorkspacePanel` sends the selected analysis+population and `CephReportView` renders the pinned provenance. (Calibration *record* version added by G6.)

**Original framing (for context):** The report snapshot (`createCephReport.ts:81`) hardcoded `analysis_label: 'steiner_hybrid_sn'` + `software_version`, and did **not** record: selected analysis/template version, norm-set + **population**, formula version, or a calibration *version* (guide §11/§14/§16/§31.6).
**Why it matters:** A finalized report can't be fully reproduced/explained — norm comparison shown in the UI uses *live* code constants, and the report always self-labels Steiner even when another analysis was used. This is the strongest clinical-traceability gap.
**Fix:** Extend the snapshot to pin `{ analysisType, normPopulation, normVersion, formulaVersion, calibration: {pointA,pointB,knownDistanceMm,pixelsPerMm,version} }`; add a `version` constant to `ceph-math/norms.ts`.
**Entry point:** `ceph-math/norms.ts` (version const) → `createCephReport.ts` snapshot → `CephReportView.tsx` (render pinned provenance) → contract hurl pinning snapshot keys.

### Gap 3 — Analysis-template abstraction `[DEFERRED 2026-06-10]`
**Status:** Deferred — not building now. The "minimum non-decision fix" below (record the analysis actually used) was **already delivered by G2**: the immutable report snapshot pins `analysis_type` as a free string clamped to all 6 `ANALYSIS_TYPES` (independent of the 2-value DB enum). Widening `cephAnalysisTypeEnum` to 6 changes nothing on its own — `upsertAnalysis` hardcodes `steiner_hybrid_sn` and `batchUpsertCephLandmarks` always runs `computeCephAnalysis` (Steiner); the working `imaging_ceph_analysis` row is a Steiner-only cache, the other 5 protocols are computed live and pinned into the report at finalize. Full per-clinic template abstraction is speculative (no demand) and against the product's ship-as-is ceph stance. **Latent wart (not urgent):** the working analysis cache is mislabeled Steiner when a clinician traces in another protocol — cosmetic today (report is correct); revisit only if "saved analyses" surface in the UI, which would need enum-widen + selection-threading through `batchUpsert` + `computeAnalysis(type,…)`.

**What:** Analyses are a fixed 2-value persisted enum (`cephAnalysisTypeEnum`) though 6 are computed/shown. No configurable template (required/optional landmarks, measurement set, norm options, report sections) per guide §11.
**Why it may matter:** Clinics can't define custom analyses/report layouts; the persisted analysis row can't represent the 4 non-Steiner/Ricketts protocols.
**Decision:** Is per-clinic custom analysis in scope, or is the fixed set fine? Minimum non-decision fix: widen `cephAnalysisTypeEnum` to all 6 so the report records the analysis actually used (couples with Gap 2).
**Entry point:** `imaging_ceph.schema.ts` enum → `dental-imaging.tsp` → `createCephReport.ts`.

### Gap 4 — Assistant-prepares / clinician-finalizes sign-off split `[RESOLVED 2026-06-10 — G4-B, commit 075843ab]`
**Done:** `CEPH_DRAFT_ROLES = [owner, associate, dental_assistant]` + `CEPH_SIGNOFF_ROLES = [owner, associate]`. `batchUpsert`/`updateCephLandmark` allow draft roles to place/edit, but writing or transitioning to `confirmed`/`locked` by a non-signoff role → 403 `ASSISTANT_CANNOT_FINALIZE`; `createCephReport` stays clinician-only (assistant → explicit 403). The snapshot gains `prepared_by` (distinct landmark authors) + `finalized_by`. FE hides Generate-Report/Lock-all for non-dentists. Decision: only `dental_assistant` drafts (hygienists/treatment-coordinators excluded — not their scope).

**Original framing (for context):** Both landmark upsert and report creation required `dentist_owner`/`dentist_associate`; assistants were fully locked out of tracing (guide §3/§15/§31.9).
**Decision:** Do we want assistant-prepared drafts? If yes → allow an assistant role to place/edit landmarks (draft), restrict `confirmed`/`locked` + report-create to clinicians, and add `ready_for_review` (couples with Gap 1) + a distinct `finalizedBy` on the report.
**Entry point:** `assert-branch-role` usage in the two handlers → report `finalizedBy` field → FE role-gated controls.

### Gap 5 — Imaging-library metadata & context breadth (§4) `[RESOLVED 2026-06-10 — G5a ca018f79 + G5b bcc5dfab + FE a378d4de]`
**Done (two slices):**
- **G5a metadata** (`ca018f79`, migration 0098): `is_diagnostic`/`quality_status`(ok|retake)/`retake_reason`/`tags`(jsonb) on `imaging_study_image`; PATCH `/images/{id}/metadata` (partial update + tag normalize trim/dedupe/clamp50/cap30, role-gated); `listPatientImages` surfaces + filters `isDiagnostic`/`qualityStatus`/`tag` via pure `applyImageLibraryFilters`.
- **G5b context links** (`bcc5dfab`, migration 0099): `imaging_link` join (`link_type` treatment_plan|ortho_case|report, loose-coupled `target_id`, unique(image,type,target)); POST/GET `/images/{id}/links` + DELETE `/links/{linkId}`; `listPatientImages` batch-loads links (no N+1) + filters `linkType`/`linkTargetId`.
- **FE write UI** (`a378d4de`): per-row Edit → metadata/links editor (`ImageMetadataEditor`) wiring all four endpoints via TanStack mutations + badges/filters; live E2E `b0063f19`.

(`sourceDevice` still not modeled — no demand.)

### Gap 6 — Versioned calibration record (§6) `[RESOLVED 2026-06-10 — G6, commit 4f2037a3]`
**Done:** append-only `imaging_calibration` table (migration 0097): monotonic `version` per image, `point_a`/`point_b` (jsonb), `known_distance_mm`, `pixel_distance`, `pixel_spacing_mm`, `method`, FK→image. `updateImageCalibration` is ruler-all-or-nothing (partial/coincident/≤0 → 400) and derives `pixelSpacingMm` **server-side** = `knownDistanceMm / hypot(A,B)` (client value ignored), persisting the record + mirroring the scalar onto the image. The report snapshot's `calibration` gains `point_a`/`point_b`/`known_distance_mm`/`record_version`/`calibrated_by`/`calibrated_at`. Live E2E `b0063f19` drives the 2-point ruler end-to-end.

---

## Recommended order

1. **Gap 2 (report version-pinning)** — highest clinical-traceability value, mostly non-decision; pairs with widening the analysis enum (Gap 3 minimum).
2. **Decisions first for Gap 1 + Gap 4** — both are product-gated and interlock (session FSM + sign-off). Resolve together before building.
3. **Gap 6 (versioned calibration)** — small, supports Gap 2.
4. **Gap 3 (full template abstraction)** — only if custom analyses are wanted.
5. **Gap 5 (library breadth)** — lowest priority.

The wiring gaps in `dental-imaging-gap-plan.md` (superimposition mount, CBCT, auto-detect contradiction) remain valid and are sequenced there; resolve **IMG-P1-1 (AI auto-detect vs no-AI)** alongside the §1 non-goal stance.
