# P2-7 — CBCT / 3-D Imaging Handling — Implementation Design Plan

> Status: DESIGN ONLY (no code). Author date 2026-06-02.
> Source review: [`docs/reviews/modules/imaging-ceph-review.md`](../modules/imaging-ceph-review.md) §3 row "Per-modality handling" (P2), §5 P1 "No DICOM ingest".
> Research: [`docs/reviews/research/imaging-ceph.md`](../research/imaging-ceph.md) (modalities, DICOM/PACS, ~50 MB pano, CBCT 3-D).
> Effort: **L (large)**. Depends on **P1-9 (DICOM ingest)**.

---

## 1. Problem & current state

The modality enum already contains `cbct` (`imaging.schema.ts:32`, added under V-IMG-010 per spec WF-019/§7), but a CBCT study is handled **identically to a flat 2-D radiograph**:

- **Treated flat.** `createImagingStudy.ts` creates `imaging_study` + `imaging_study_image` with a single `fileId`, presigned single-PUT upload, optional tooth links, and a `dicomMetadata` JSONB that only ever stores `{ fileName }` (line 96). The frontend viewer (`apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx`, `canvas-overlays.tsx`) renders a single raster image on a 2-D canvas; calibration is one scalar `pixelSpacingMm`. There is no notion of a volume, slice stack, series, or 3-D geometry.
- **No DICOM ingest (ties to P1-9).** The dental-imaging MIME allowlist (`imaging.schema.ts:124` `ALLOWED_IMAGING_MIME_TYPES`) is `image/jpeg | image/png | image/tiff | image/bmp` — **`application/dicom` is excluded**, so a `.dcm` study cannot even be created through `createImagingStudy`. No DICOM tag is parsed (PixelSpacing `(0028,0030)`, SliceThickness `(0018,0050)`, Modality `(0008,0060)`, etc.). The review flags this P1; CBCT handling is **strictly downstream of P1-9** — you cannot meaningfully ingest a CBCT volume without DICOM parsing first.
- **Payload size mismatch.** Storage *does* support large/chunked uploads: `services/api-ts/src/handlers/storage/` has full S3 multipart (`initiateMultipartUpload` → `generateMultipartPartUrl` → `completeMultipartUpload` / `abortMultipartUpload`) and the storage layer already accepts `application/dicom` MIME (storage has no format allowlist; the format gate lives only in dental-imaging). **But:**
  - The hard cap is **100 MB** in both `initiateMultipartUpload.ts:36` and `uploadFile.ts:40`. Panoramic DICOM is ~50 MB (fits), but a **CBCT volume is typically 100 MB – several GB** (a full-FOV cone-beam dataset is hundreds of MB to multiple GB as a multi-frame DICOM or a DICOM series of hundreds of slices). 100 MB does not fit a real CBCT.
  - `createImagingStudy` issues a **single presigned PUT** (`storage.generateUploadUrl`, 5-min expiry), not a multipart session. CBCT must route through the multipart path.
- **One file === one image === one study assumption.** CBCT is naturally a **series** (N slice files) or a **single multi-frame object**. The current `imaging_study_image` is 1 file = 1 viewable raster. There is no series/instance hierarchy and no volume descriptor.

Net: CBCT is enum-present but is, today, a labeled-but-unhandled modality. Showing it as a flat 2-D image would **mislead clinicians** (a single axial slice masquerading as "the CBCT"), which the review explicitly warns against.

---

## 2. Target

A pragmatic, honest CBCT capability — **not** a from-scratch 3-D MPR engine in v1. Targets, in priority order:

1. **Ingest & store CBCT safely.** Accept DICOM (single multi-frame object or a multi-slice series), via the existing S3 multipart path, with a raised size ceiling, and persist enough metadata (modality, FOV, slice count, pixel/slice spacing, study UID) to describe the volume.
2. **Link CBCT to the clinical record** like any other study: patient, visit, branch, tooth numbers, findings (`imaging_finding`), audit.
3. **At minimum, a viewing path** — either a handoff to an external DICOM viewer, or an embedded web volume viewer — so a clinician can actually look at the data. **Full custom 3-D MPR rendering (axial/coronal/sagittal reformats, segmentation, airway/nerve tracing) is a major undertaking and is explicitly out of v1 scope.**
4. **Truthful UX.** Until a real volume viewer exists, the UI must not present CBCT as a flat 2-D image — it must label the modality and route to the appropriate viewer/handoff.

Non-goals (v1): 3-D MPR rendering in-app, surface/volume rendering, segmentation, nerve canal tracing, airway analysis, implant planning, CBCT-derived ceph synthesis, VTO. These are tracked as future phases.

---

## 3. Proposed design options

### Option A — Store + external DICOM viewer handoff  *(recommended for v1)*

Ingest and store the DICOM data; provide a "Open in viewer" handoff rather than rendering in-app. Two sub-flavors of handoff:

- **A1 — Download / native-app handoff.** Presigned download of the DICOM object(s) (or a zipped series); the clinician opens it in their existing DICOM viewer (RadiAnt, Horos/OsiriX, the CBCT vendor's own viewer, etc.).
- **A2 — Hosted-viewer deep link.** Generate a launch URL into a self-hosted or third-party web DICOM viewer (e.g., an OHIF instance pointed at a DICOMweb/WADO endpoint) by study UID.

**Trade-offs.** Lowest build cost and lowest browser-perf/cost risk; the heavy 3-D lifting is delegated to mature, regulatory-familiar tooling clinicians already trust. A1 needs zero new infra. A2 needs a DICOMweb endpoint (a PACS or a thin WADO shim over S3) — meaningfully more infra. Downside: leaves the app, no in-context findings overlay, weaker timeline/carousel integration.

### Option B — Embed an open-source web DICOM/volume viewer

Embed Cornerstone3D (the actively-maintained successor to cornerstone-core, used by OHIF) or a packaged OHIF viewer inside the dentalemon imaging workspace. Cornerstone3D does GPU (WebGL/WebGPU) volume loading, MPR, and stack scrolling in-browser.

**Trade-offs.** Best in-context UX (slice scroll + MPR + findings overlay without leaving the app) and the strongest path to feeding the timeline/carousel. But: (a) large bundle + WebGL/WebGPU dependency (browser-perf and device-capability risk — iPad/Tauri must be validated); (b) needs DICOM tiling/streaming or full-volume download to the client (memory pressure on hundreds of MB); (c) typically wants a DICOMweb data source for progressive loading, which is the same infra cost as A2; (d) ongoing maintenance of a heavy third-party dependency. Higher build + risk than A, lower than C.

### Option C — Full custom 3-D MPR / volume rendering

Build our own volume loader, reslicer, and WebGL/WebGPU renderer with MPR planes, windowing, and measurement in 3-D.

**Trade-offs.** Maximum control and product differentiation, but a multi-quarter effort with serious correctness, performance, and clinical-safety risk (a wrong reslice or wrong spacing is a patient-safety defect). Not justified for v1; revisit only if CBCT becomes a core differentiator.

### Recommendation — pragmatic phased path

> **Phase 1 = Option A1** (ingest, store, link, download-handoff) → **Phase 2 = Option A2** (hosted-viewer deep link via DICOMweb shim) → **Phase 3 = Option B** (embed Cornerstone3D for in-context MPR), gated on real demand and an iPad/Tauri perf spike. **Option C deferred indefinitely.**

This sequences value: Phase 1 makes CBCT a first-class, safely-stored, clinically-linked study with an honest viewing path at L-but-bounded cost, fully reusing the existing multipart storage. B/C are additive on the same data model, so Phase 1 does not paint us into a corner.

### Storage strategy

- **Reuse the existing S3 multipart path** (`storage/initiateMultipartUpload` → `generateMultipartPartUrl` → `completeMultipartUpload`). CBCT studies MUST route through multipart, not the single-PUT in `createImagingStudy`.
- **Raise the size ceiling for the DICOM/CBCT class.** The blanket 100 MB cap (`initiateMultipartUpload.ts:36`, `uploadFile.ts:40`) is too small. Introduce a **per-MIME / per-modality ceiling** (e.g., images stay at 100 MB; `application/dicom` / CBCT gets a configurable higher cap, env-driven, default e.g. 2 GB) rather than globally raising the limit. Keep an absolute hard cap to bound cost/abuse.
- **Series handling.** A CBCT arriving as N slice files is stored as **N storage objects under one study**, or zipped client-side into one multi-frame object before upload. Decision D-CBCT-1 (below): prefer **single multi-frame DICOM object per study** when the source provides it; fall back to a per-instance series with an explicit instance table when it does not.
- **Lifecycle / cost.** CBCT objects are large and rarely re-read; tag for an S3 lifecycle/storage-class transition (e.g., infrequent-access after N days) — note only, not built in Phase 1. Presigned GET for download/handoff (mirrors the existing ceph `downloadUrl` presign pattern).

### Metadata & linkage

- Parse DICOM tags **on ingest** (this is the P1-9 deliverable): Modality `(0008,0060)`, PixelSpacing `(0028,0030)`, SliceThickness `(0018,0050)`, Rows/Columns, NumberOfFrames `(0028,0008)`, StudyInstanceUID `(0020,000D)`, SeriesInstanceUID `(0020,000E)`. Store into a typed `dicomMetadata` shape (replacing the `{ fileName }`-only stub) and auto-populate `pixelSpacingMm` with `calibration_method='dicom_tag'` (enum value already exists per the ceph review).
- **Linkage** is unchanged from the existing model: study → patient/visit/branch/acquiredBy; image/volume → tooth numbers via `imaging_study_tooth`; findings via `imaging_finding` (`toothNumber` + `surfaces[]` + `annotationId`/`treatmentId`/`visitId`). CBCT findings reference the **slice/frame index** they were made on (new optional field), so a finding is reproducible.
- **No DB-level cross-module FKs** (follow the existing loose-coupling convention in `imaging.schema.ts`).

---

## 4. API + data model

### Data model (additive, non-breaking)

Extend, don't rewrite. The `cbct` enum value already exists.

- **`imaging_study_image` → add columns** (all nullable, additive migration):
  - `is_volume boolean default false` — marks a CBCT/3-D object vs a flat raster.
  - `slice_thickness_mm real` — DICOM `(0018,0050)`.
  - `frame_count integer` — `(0028,0008)` for multi-frame, or count of series instances.
  - `series_instance_uid text`, `study_instance_uid text` — DICOM identity for dedupe + viewer deep-link.
  - Typed `dicomMetadata` JSONB shape (modality, FOV, spacing[x,y,z], rows/cols/frames, UIDs, manufacturer) — keep the column, formalize the contents.
- **(Conditional) `imaging_study_image_instance`** — new table only if we support series-of-files ingest (Option per-instance fallback): `id, imageId (FK), fileId, instanceNumber, sopInstanceUid`. Skip if we standardize on single multi-frame objects (preferred).
- **`imaging_finding` → add `frame_index integer` nullable** — the slice a CBCT finding was placed on.
- **Size config**: per-MIME ceiling map in storage config (env-driven), not a schema change.

### API (TypeSpec-first → OpenAPI → generate → handlers; never edit generated files)

- **`createImagingStudy` (modify)**: when `modality='cbct'` (or `mimeType='application/dicom'`), branch to the multipart flow — return a multipart `uploadId` + per-part URL plan instead of a single PUT. Add `application/dicom` to `ALLOWED_IMAGING_MIME_TYPES` (P1-9). Apply the higher size ceiling for this class.
- **`finalizeCbctStudy` (new)**: called after multipart `completeMultipartUpload`; triggers server-side DICOM parse, populates the volume metadata columns, sets `is_volume=true`, writes the `imaging_study.create`-style audit row (reusing the `logAuditEvent` pattern as the domain-event marker per ADR-006). This is the natural seam for the P1-9 parser.
- **`getCbctViewerLink` (new, Phase 1=A1 / Phase 2=A2)**: returns a presigned download URL (A1) or a hosted-viewer deep link keyed by study/series UID (A2). Reuses the existing presign pattern.
- **`getImagingStudy` / `listPatientImages` (modify)**: surface `is_volume`, `frameCount`, and a `viewerKind` discriminator so the frontend renders the right affordance (volume card + "Open in viewer", not a flat `<img>`).
- **Tier gating**: decide whether CBCT is addon-tier (mirror the cephalometric gate in `createImagingStudy.ts:59`) — likely yes, given cost. Apply the same `getImagingTierForBranch` check + `IMAGING_TIER_REQUIRED` code.
- **Frontend** (`apps/dentalemon/src/features/imaging/`): a `CbctStudyCard` / volume affordance in `patient-image-list.tsx` and the workspace; replace any flat-image fallback for `modality='cbct'` with a volume-aware view (Phase 1: metadata + "Open in viewer" handoff; Phase 3: embedded Cornerstone3D). **Never** render a CBCT as a single flat raster without a clear "single slice of N" label.

---

## 5. Vertical-TDD test plan

Per `docs/development/VERTICAL_TDD.md` — RED before GREEN, full vertical slice, module-complete gate. Test locations mirror the existing imaging tests (`services/api-ts/src/handlers/dental-imaging/*.test.ts`, `apps/dentalemon/src/features/imaging/__tests__/`).

**Backend unit (RED first):**
- `application/dicom` is accepted by `createImagingStudy` for `cbct`; still rejected for non-imaging modalities if we choose to scope it.
- CBCT routes to multipart (returns `uploadId` + parts), not single PUT.
- Size ceiling: DICOM/CBCT > 100 MB and ≤ new cap succeeds; > absolute hard cap → 422/validation; non-DICOM image > 100 MB still rejected.
- `finalizeCbctStudy` parses tags and populates `is_volume`, spacing, `frameCount`, UIDs, `calibration_method='dicom_tag'`; malformed/non-DICOM payload → clean error, no half-written row.
- Tier gate (if CBCT is addon): free/basic branch → `IMAGING_TIER_REQUIRED`.
- Linkage: tooth links, findings with `frame_index`, audit row emitted.
- Cross-tenant isolation + role gate (reuse the `assertBranchRole` pattern) — must not regress the existing imaging isolation tests.

**Contract (Hurl, `specs/api/tests/contract/`):** wire-level CBCT create → multipart parts → complete → finalize → get (asserts `is_volume`, `viewerKind`) → viewer-link presign. Add to the contract suite.

**Frontend unit:** `patient-image-list` renders a CBCT volume card (not `<img>`); workspace shows the "Open in viewer" handoff for `is_volume`; truthful labeling assertion (no flat-slice masquerade).

**E2E (Playwright, per memory: prefer Playwright over human checkpoints):** upload a (small synthetic) DICOM CBCT → study appears as volume → viewer handoff opens. Seed a CBCT study so the route is actually exercised (the ceph review noted the ceph report route was untested because nothing was seeded — avoid repeating that).

**Verify gate:** `bun run test` (never `bun test <path>` — pollutes the clone template), `bun run typecheck`, **and `bun run check:boundaries`** (memory: backend verify gate must include boundaries), all green with no regressions on the existing 2900+ suite.

---

## 6. Phasing & effort

**Overall: L (large)**, dominated by DICOM parsing (P1-9) and the storage-ceiling/series work; the viewer is deliberately minimized in v1.

- **Phase 0 — P1-9 prerequisite (separate plan):** `application/dicom` ingest + tag parsing. CBCT cannot start until this lands.
- **Phase 1 — Ingest + store + link + download handoff (Option A1).** *Effort: M–L.* Schema additions, multipart routing in `createImagingStudy`, `finalizeCbctStudy`, size-ceiling config, volume-aware list/get, A1 viewer link, truthful UI card, full TDD slice. This is the shippable MVP.
- **Phase 2 — Hosted-viewer deep link (Option A2).** *Effort: M.* Stand up/integrate a DICOMweb (WADO) endpoint or shim over S3; `getCbctViewerLink` returns a deep link. Infra-heavy.
- **Phase 3 — Embedded Cornerstone3D MPR (Option B).** *Effort: L, gated.* Only after an iPad/Tauri WebGL/WebGPU perf spike passes and demand is real. Feeds the superimposition/carousel timeline.
- **Deferred — Option C** (custom 3-D), segmentation, nerve/airway, implant planning, VTO.

---

## 7. Dependencies

- **P1-9 — DICOM ingest (hard blocker).** Accepting `application/dicom` + parsing PixelSpacing/SliceThickness/Modality/UIDs. CBCT is a downstream consumer of this; do not start Phase 1 before P1-9.
- **Storage multipart** — already present (`storage/initiateMultipartUpload` etc.); only the size ceiling needs changing.
- **Tier facade** — `getImagingTierForBranch` (`dental-org/repos/org-imaging.facade`) if CBCT is addon-gated.
- **Audit** — `logAuditEvent` (ADR-006 audit-as-event marker).
- **Phase 2/3 only:** a DICOMweb/WADO endpoint (PACS or shim) and, for Phase 3, the Cornerstone3D/OHIF dependency + a confirmed iPad/Tauri GPU capability.

---

## 8. Risks

- **Payload size & cost (highest).** Real CBCT volumes are 100 MB – multiple GB. Raising the cap raises S3 storage cost, egress on download/handoff, and multipart-failure surface. Mitigate: per-class configurable ceiling with an absolute hard cap, lifecycle storage-class transition, presigned-GET (no proxying through the API), and resumable/abortable multipart (already present).
- **Browser / device performance.** Any in-app volume rendering (Phase 3) is memory- and GPU-heavy; hundreds of slices can OOM a tablet. The iPad/Tauri target especially is unproven for WebGL/WebGPU volume loading. Mitigate: keep Phase 1/2 render-free (handoff only); gate Phase 3 behind a perf spike.
- **Clinical-safety / honesty.** Showing a single axial slice as "the CBCT", or a wrong spacing/reslice, is a patient-safety defect. Mitigate: truthful labeling in v1 ("single slice of N — open full volume in viewer"), DICOM-tag-sourced spacing only (never guessed), and defer reslicing/measurement-in-3-D to a properly tested phase.
- **Series vs multi-frame ambiguity.** Sources differ (N files vs one multi-frame object). Mitigate: prefer multi-frame, support per-instance fallback behind an explicit instance table, normalize on ingest.
- **Scope creep into Option C.** "While we're in here, let's add MPR/segmentation" is the trap that makes this slip a quarter. Hold the line at A1 for v1.
- **DICOM correctness (inherited from P1-9).** Malformed/vendor-quirky DICOM, missing tags, non-square pixels. Mitigate: defensive parse, clean-fail with no half-written study row, contract tests on malformed payloads.
