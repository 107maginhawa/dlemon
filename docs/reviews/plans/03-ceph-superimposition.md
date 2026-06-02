# P1-11 — Cephalometric Superimposition / Comparison Over Time

> Design plan (no code). 2026-06-02. Module: imaging-ceph.
> Source review: [`modules/imaging-ceph-review.md`](../modules/imaging-ceph-review.md) §5 (P1: "Superimposition is side-by-side only"), §6 (carousel implications).
> Research: [`research/imaging-ceph.md`](../research/imaging-ceph.md) ("DICOM & comparison/superimposition over time", ABO standard).
> Product pattern: [`CAROUSEL_RECOMMENDATIONS.md`](../CAROUSEL_RECOMMENDATIONS.md) §E — this is the imaging instance of the product-wide "compare any clinical dimension over time."

---

## 1. Problem & current state

The "Compare ▶" affordance in the imaging workspace renders **two independent `ImagingWorkspace` panes side-by-side** (`apps/dentalemon/src/features/imaging/components/comparison-view.tsx`). The two viewers are:

- **Unsynchronized** — zoom, pan, rotate, flip, brightness are per-pane; the clinician cannot scrub both images together.
- **Unregistered** — there is no alignment of the two images on any anatomical structure; you see two pictures, not a superimposition.
- **No overlay / onion-skin** — images sit in separate boxes, never stacked with opacity, so growth or treatment change cannot be *seen* as displacement.

This is below the clinical standard. Per the ABO clinical exam (`research/imaging-ceph.md`), serial cephalometric superimposition — comparing tracings of the same patient at two timepoints to measure skeletal/dental change — is the defined way to read growth and treatment effect. The review (§5, §6) flags this P1 and notes the term "Compare" oversells what is really a static side-by-side.

**What already exists and is reusable (this is mostly a frontend + thin-API build, not a from-scratch one):**

- **Per-image landmarks in image-space pixels** — `imaging_ceph_landmark` (`x/y` real, D-C image-space), 16 codes (`LANDMARK_CODES` in `packages/ceph-math/src/index.ts`: S, N, A, B, ANS, PNS, Go, Po, Me, Or, Pog, Gn, U1T, U1A, L1T, L1A). FSM `not_placed→placed→confirmed→locked`.
- **Immutable, versioned report snapshots** — `imaging_ceph_report` (D-I, append-only, calibration-stamped). The review (§6.1) states plainly: *report versions are already snapshots* — the timepoints we superimpose already exist as durable rows.
- **An isomorphic coordinate-transform engine** — `packages/ceph-math/src/coords.ts` (`imageToScreen`/`screenToImage`, exact inverses, unit-tested) and `apps/dentalemon/src/features/imaging/lib/ceph-geometry.ts` (declarative lines + angle arcs). The superimposition math (rigid registration from landmark correspondences) belongs in this same pure, testable layer.
- **Calibration provenance** — `imaging_ceph_analysis` stores `calibrationValue` + `calibrationMethod` (D-J), so a registered overlay can correctly scale mm displacements.

**Explicitly deferred at this layer (D-O, `CephReportView.tsx`):** full serial superimposition with the three ABO structural registrations was deferred to v1.5/v2. This plan defines that deferred work and phases it so v1 ships immediate clinical value (synced overlay) without blocking on the hard part (multi-region structural registration).

---

## 2. Clinical target (what "done" means)

Superimposition measures **change between two timepoints** — how much the skeleton grew and how much treatment moved teeth, in mm and direction. The clinical standard is **not** a single global image align (scaling/rotating one whole X-ray onto another). Per ABO (research doc):

> The ABO standard requires **three structural superimpositions**, each registered on stable anatomical structures (Björk/Melsen/Enlow):
> 1. **Cranial-base** registration — registers on the anterior cranial base (SN plane / sella, the stable reference). Shows total facial change. This is our existing primary reference frame (`CEPH_LINES` `sn`).
> 2. **Maxillary** registration — registers on stable maxillary structures (anterior surface of zygomatic process / palatal plane ANS-PNS / superimposition on the maxilla). Isolates maxillary tooth movement from skeletal change.
> 3. **Mandibular** registration — registers on stable mandibular structures (internal symphysis outline, mandibular canal, Björk's structures). Isolates mandibular tooth movement and growth rotation.

Each registration uses **stable structures, not one global point** — landmarks/structures that do not remodel are the registration basis; everything else is read as the change. The deliverable is therefore: pick a registration reference → align the two tracings on that reference's stable landmarks → render the overlay → read per-landmark displacement (Δ in mm and angle, growth + treatment effect).

**Honesty constraint (carries the existing module's posture):** the review repeatedly notes this module refuses to fabricate (signed ANB, no green "normal", "Informational — not a diagnosis"). Superimposition output must be labeled as a *registration-based measurement of change, not a diagnosis*, and must disclose which structures were used as the registration basis and the ~7–13% ceph magnification caveat already footnoted elsewhere.

---

## 3. Proposed design

### 3.1 Registration UX

A **Superimpose** mode (distinct affordance from today's "Compare", which can keep meaning side-by-side, or be renamed/retired):

1. **Pick two timepoints.** Source the two from the patient's ceph **report-version snapshots** (`imaging_ceph_report`), not raw images — per §6.3 comparison "should consume two report-version snapshots." Default selection: most-recent vs immediately-prior. The picker shows vN, date, calibration provenance (matches the timeline/carousel scrub model, §6.1).
2. **Pick a registration reference.** A segmented control: **Cranial base (S-N)** | **Maxillary (ANS-PNS)** | **Mandibular (symphysis/Go-Me)**. v1 ships **Cranial base (S-N)** only (the existing reference frame); the other two are visible-but-disabled with a "v2" affordance so the clinical model is legible from day one. Each option declares which landmark set is its registration basis (reuse `CEPH_LINES`/`CEPH_ANGLE_ARCS` vocabulary).
3. **Align tracings.** Given the chosen reference's landmark correspondences across the two snapshots, compute a **rigid (similarity) transform** (rotation + translation + uniform scale to reconcile magnification/calibration) that maps timepoint-B image-space onto timepoint-A image-space so the registration landmarks coincide. This is a pure function in `ceph-math` (least-squares / Procrustes over the 2-point or n-point reference set). No free-hand dragging in v1 — alignment is deterministic from confirmed landmarks (auditable, reproducible). A manual nudge fallback can be a v2 add.

### 3.2 Overlay rendering

- **Stacked canvases, not side-by-side.** Timepoint-A renders as the base; timepoint-B renders transformed by the registration matrix on top. Reuse the existing 6-step canvas matrix + `coords.ts` so the overlay composes with the workspace's own zoom/pan/rotate (the *view* transform) on top of the *registration* transform.
- **Synced zoom/pan.** One shared view transform drives both layers (this is the v1 minimum even before structural registration — it directly fixes the "unsynchronized" defect).
- **Opacity slider + onion-skin.** A 0–100% opacity control on the B layer; optionally an animated A↔B crossfade ("onion-skin scrub") that honors `prefers-reduced-motion` (offer a static slider as the equal path, per CAROUSEL §G).
- **Color per timepoint.** Tracings (lines/arcs) drawn per timepoint in distinct, accessible hues — e.g. earlier timepoint in a neutral/zinc tone, later timepoint in the lemon accent `#FFE97D` (DESIGN.md), never relying on color alone: each tracing carries a visible date/vN label. Out-of-the-box this reuses `activeLinesForLandmarks` / `activeArcsForLandmarks` per snapshot.

### 3.3 Measurement deltas between timepoints

- For each landmark present (and confirmed) in **both** snapshots, after registration compute **Δx, Δy displacement in mm** (using the registered/calibrated frame) and total magnitude + direction. Present a deltas table: landmark → displacement mm + vector, grouped by what the registration isolates (e.g. on cranial-base registration, A-point/B-point displacement = total facial change).
- **Metric deltas:** diff the two snapshots' stored `measurements` JSONB (ANB, convexity, IMPA, …) → signed Δ per metric (e.g. "ANB 4.1° → 2.3°, Δ −1.8°"). This is a client-side set/numeric comparison of two snapshot payloads — cheap, and it mirrors CAROUSEL §B's odontogram diff ("client-side set comparison of states between two snapshots").
- Deltas are **gated on calibration of both timepoints** (mm) — if either is uncalibrated, show angular/px deltas only with the existing "uncalibrated" disclosure, never silently emit mm.

### 3.4 Ties to the timeline / carousel & landmark reuse

- This is **one instance of the shared "compare over time" component** (CAROUSEL §E, "treat as instances of one shared component, not three bespoke builds"). The two-snapshot picker, the opacity/onion-skin scrub, and the deltas table are the imaging-flavored skin of the same interaction the odontogram (§B) and perio (§D) use.
- Timepoints are **report snapshots** surfaced on the timeline as discrete scrubbable points (vN, date, calibration) — §6.1. The superimposition view is the "diff" between two timeline points — §6.3.
- **No new landmark capture is needed.** Superimposition consumes already-confirmed `imaging_ceph_landmark` rows captured for the existing analysis flow. The registration math reuses image-space pixel coords + calibration that the module already stores.

---

## 4. Data & API

**Principle: snapshots and landmarks already persist the inputs; we add only the registration result as a derived, reproducible artifact.**

### 4.1 What must be stored

A **registration transform per (timepoint-pair, reference)** — so a superimposition is reproducible and auditable without re-deriving (and so it survives if a landmark is later edited on a non-locked image). Proposed new table `imaging_ceph_superimposition`:

| field | type | notes |
|---|---|---|
| `id`, base entity fields | | tenant/audit per platform convention |
| `patientId` | uuid | for timeline queries |
| `reportFromId` | uuid → `imaging_ceph_report` | earlier timepoint snapshot |
| `reportToId` | uuid → `imaging_ceph_report` | later timepoint snapshot |
| `referenceType` | enum `cranial_base` \| `maxillary` \| `mandibular` | v1 stores only `cranial_base` |
| `transform` | jsonb | similarity transform {scale, rotationRad, tx, ty} mapping B→A image-space, + the registration landmark codes used |
| `deltas` | jsonb | computed per-landmark mm/angle displacement + per-metric Δ (denormalized snapshot of the math output for audit/report inclusion) |
| `calibrationBasis` | jsonb | the two calibration provenances used (so mm validity is traceable, D-J posture) |

Immutability: a superimposition references two **immutable** report snapshots, so it is itself effectively immutable per (pair, reference); recompute mints a new row (mirror the report append-only posture, D-I) rather than mutating. Tier: **addon-gated**, same as the rest of ceph (`recomputeCephAnalysis` precedent).

> Alternative considered: compute-on-the-fly, store nothing (transform is cheap and deterministic from landmarks). Rejected for v2 (structural) because the registration basis can change as landmarks are added, and the report/audit story wants a frozen artifact. **v1 may compute-on-the-fly and skip the table** if we want to ship the synced-overlay UX without backend work (see phasing) — the table lands with v2 when the artifact must be durable for ABO-style reports.

### 4.2 API (TypeSpec-first, per repo protocol)

Follow `services/api-ts/src/handlers/dental-imaging/` patterns and TypeSpec → OpenAPI → generate → implement:

- `POST /patients/{patientId}/ceph-superimpositions` — body `{reportFromId, reportToId, referenceType}` → computes transform + deltas, persists, returns the artifact. 422 on: missing registration-basis landmarks for the chosen reference (mirror `INSUFFICIENT_LANDMARKS`), mismatched/zero-area landmark config, or attempting a non-`cranial_base` reference in v1 (`NOT_IMPLEMENTED`/feature-flag).
- `GET /patients/{patientId}/ceph-superimpositions/{id}` — fetch one.
- `GET /patients/{patientId}/ceph-superimpositions?reportFrom=&reportTo=` — list/find for the timeline.
- (v1-only-on-the-fly variant: a single `POST .../preview` that returns transform+deltas without persisting.)

SDK: regenerate `@monobase/sdk-ts` hooks (`use-ceph-superimposition`) alongside existing `use-ceph-analysis` / `use-ceph-landmarks`.

---

## 5. Phasing & effort

**Overall effort: L** (large — pure-math registration engine + new canvas overlay compositor + timeline integration + a thin API/table; the math and the multi-region structural registration are the cost centers).

### v1 — Synced-zoom + opacity overlay (cranial-base only). Effort: M.
- Replace side-by-side with stacked, **synced** zoom/pan; opacity slider + onion-skin (reduced-motion-safe).
- Single registration reference: **Cranial base (S-N)** rigid/similarity transform from the two snapshots' S,N landmarks.
- Per-metric Δ table (diff of two `measurements` JSONB) + per-landmark mm displacement (cranial-base frame), calibration-gated.
- Consume report snapshots; surface picker on the timeline. Other two reference options visible-but-disabled.
- May ship compute-on-the-fly (preview endpoint) to avoid the persistence table initially.
- **Directly clears the §5 P1 defect** (overlay + registration exist; "Compare" no longer oversells).

### v2 — Structural multi-registration (ABO-complete). Effort: L.
- Add **maxillary** (ANS-PNS / palatal-plane) and **mandibular** (symphysis/Go-Me structural) registrations — three independent registered overlays per ABO.
- Persist `imaging_ceph_superimposition` artifacts (durable, auditable, includable in `imaging_ceph_report`-style output).
- Per-registration deltas isolating skeletal vs dental change; growth/treatment-effect read-out (labeled informational, not diagnostic).
- Optional manual nudge fallback for the registration when stable landmarks are sparse.
- (Out of scope still: VTO/growth *projection* — D-O, P3.)

---

## 6. Vertical-TDD test plan

Follows `docs/development/VERTICAL_TDD.md` (RED → GREEN per layer; module not done until all layers pass + `bun test`/`bun run typecheck` green; backend verify gate includes `bun run check:boundaries` per project memory).

**The registration engine is isomorphic and the highest-value test target** (like `coords.ts` / `ricketts.ts` already are). Engine tests need no DB or DOM:

1. **Math engine (`packages/ceph-math`, unit) — RED first.**
   - `registerSimilarity(fromPts, toPts)` recovers a known synthetic transform: feed B = T·S·R·A for known scale/θ/translation, assert recovered transform within ε.
   - **Identity:** same landmarks in/out → identity transform (scale 1, θ 0, t 0).
   - **Round-trip / isomorphism:** applying transform then its inverse returns original within ε (parallels existing `imageToScreen`/`screenToImage` inverse tests).
   - **Δ computation:** known displaced landmark → correct mm magnitude + direction given calibration; uncalibrated → null mm (never px-as-mm), angular Δ still emitted.
   - **Degenerate input:** coincident/collinear registration points → defined error, not NaN.
   - **Metric-diff:** two `measurements` objects → correct signed per-metric Δ, missing-key handling (null in one snapshot → no fabricated Δ).
2. **Backend handler (`services/api-ts/.../dental-imaging`, unit/contract) — RED first.**
   - Create-superimposition happy path persists transform + deltas; reads back immutable.
   - 422 `INSUFFICIENT_LANDMARKS` when the chosen reference's basis landmarks aren't confirmed on both snapshots.
   - 422/`NOT_IMPLEMENTED` for non-cranial-base reference in v1.
   - Tier gate: addon-only (mirror `recomputeCephAnalysis` tier test).
   - Tenant isolation + audit emission.
   - Contract test (Hurl) for the new endpoints against the live impl (per "tests must hit real server" memory).
3. **Frontend (`apps/dentalemon/.../imaging`, unit) — RED first.**
   - Overlay compositor applies registration transform under the view transform correctly (assert composed coords via `coords.ts`).
   - Opacity slider drives B-layer alpha; onion-skin disabled under `prefers-reduced-motion`.
   - Deltas table renders signed Δ, no green, mm gated on calibration, date/vN labels on each tracing.
4. **E2E (Playwright, per "Playwright over human checkpoints" memory).**
   - Seed ≥2 ceph report snapshots for one patient (extends the CAROUSEL §A multi-visit seed need; **dependency** — current demo seeds one timepoint).
   - Open Superimpose, pick two timepoints, choose cranial-base, verify overlay renders, opacity slider moves, deltas table shows ANB change.

---

## 7. Dependencies

- **Multi-timepoint seed data** (CAROUSEL §A, blocker #1). The demo currently seeds ~1 ceph timepoint/patient; superimposition is invisible without ≥2 report snapshots per patient. This is the cheapest, highest-leverage prerequisite and gates E2E.
- **Report-snapshot timeline surface** (§6.1) — superimposition picks timepoints from report versions; a timeline/scrub surface is the natural host. Can ship behind the imaging workspace initially if the timeline isn't ready.
- **Confirmed landmark coverage** — registration needs the reference's basis landmarks `confirmed` on both timepoints (S,N already in the report gate's neighborhood; A/B/Go/Po are the existing `CEPH_REPORT_GATE_LANDMARKS`). Maxillary/mandibular references (v2) need ANS/PNS + symphysis structures, which are currently optional landmarks.
- **Calibration on both timepoints** for valid mm deltas (D-J); already enforced for ceph mm-metrics.
- Shared "compare over time" component direction (CAROUSEL §E/Phase 3) — coordinate so imaging, odontogram, perio reuse one interaction rather than three.

---

## 8. Risks

- **(Biggest) Registration correctness is a patient-safety claim, not a UI nicety.** A wrong transform makes growth/treatment change *look* real when it isn't — exactly the fabrication the module otherwise refuses. Two-point (S-N) similarity registration is mathematically simple but clinically a *simplification* of true structural superimposition (which registers on remodeling-stable *outlines*, not two points). Mitigation: (1) keep the engine isomorphic + property-tested to ε; (2) label v1 explicitly as "cranial-base, S-N point registration — a simplified superimposition; structural registration in v2"; (3) gate mm deltas on calibration; (4) never present output as diagnosis. Over-trusting a 2-point v1 align as if it were ABO-grade is the failure mode to design against.
- **Magnification / calibration mismatch between timepoints** — two films at different magnification mis-scale displacement. The similarity transform's uniform-scale term partly absorbs this, but mm deltas require both calibrations; surface the basis (`calibrationBasis`) and warn on mismatch.
- **Sparse/edited landmarks** — if a basis landmark is missing or was edited on a non-locked image, the stored transform can drift from current landmarks. Mitigation: register from the immutable report snapshot's landmark set, recompute = new artifact.
- **Canvas compositing complexity** — stacking registration transform under the existing 6-step view matrix risks coordinate drift; mitigated by routing everything through the already-tested `coords.ts` and adding compositor unit tests.
- **Scope creep into VTO/growth projection** — stay deferred (D-O, P3); superimposition measures observed change only.

---

## 9. Out of scope

- AI/auto-landmarking (separate P1).
- DICOM ingest / pixel-spacing parsing (separate P1).
- VTO / growth *projection* / simulation (P3, D-O — stays deferred).
- Additional ceph analyses (McNamara/Tweed/Downs/Jarabak/Wits — separate P1).
