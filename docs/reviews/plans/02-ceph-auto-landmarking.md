# P1-10 — AI / Auto Cephalometric Landmarking — Implementation Design Plan

> Plan only. No code. Source findings: [`../modules/imaging-ceph-review.md`](../modules/imaging-ceph-review.md) §3/§5 (P1 row "Auto / AI landmarking"), research [`../research/imaging-ceph.md`](../research/imaging-ceph.md). Backlog: `IMPROVEMENT_BACKLOG.md` P1-10 (effort **L**).
> Author date 2026-06-02. Status: DRAFT — awaiting plan-eng-review.

---

## 1. Problem & current state

Cephalometric landmark placement in dentalemon is **fully manual but well guided**. A clinician opens the ceph workspace, selects each of the 16 landmark codes (`S, N, A, B, ANS, PNS, Go, Po, Me, Or, Pog, Gn, U1T, U1A, L1T, L1A`), and clicks each point on the lateral radiograph. The flow is strong (next-unplaced `#FFE97D` ring, per-landmark anatomical hint, Tab/Enter advance, arrow-key nudge, loupe magnifier — `CephLandmarkPalette.tsx`, `ceph-keyboard.ts`, `CephLoupe.tsx`), but placing 16+ points by hand per image is the single most time-consuming step of the whole analysis. Competitors removed this step years ago.

**What already exists that this feature plugs into (the scaffolding is done):**

- **Provenance enum is in place but unused.** `cephLandmarkSourceEnum = ['manual', 'ai', 'ai_corrected']` (`repos/imaging_ceph.schema.ts:28`) and the matching TypeSpec `CephLandmarkSource` enum (`dental-imaging.tsp:326`). Today every landmark is written with the default `'manual'`. No handler ever sets `'ai'`.
- **Confidence column exists but is always null.** `imaging_ceph_landmark.confidence real` (`schema.ts:74`) + `CephLandmark.confidence: float64 | null` in the SDK type (`use-ceph-landmarks.ts:16`). Nothing populates it.
- **A batch ingest path already exists.** `batchUpsertCephLandmarks` (POST `/dental/imaging/images/{imageId}/ceph/landmarks`) accepts `source` and `confidence` per landmark and recomputes the analysis after write (`batchUpsertCephLandmarks.ts:66-85`). AI-detected points can flow through this exact handler with `source: 'ai'`.
- **The `dental_imaging_auto_landmark` flag is referenced in MODULE_SPEC §18 but is not yet wired in code** (grep finds it only in the spec/trace docs, not in `core/config.ts` or any handler). It is a planned kill-switch / tier gate that this plan must actually implement.
- **The landmark FSM enforces a human gate already.** `not_placed → placed → confirmed → locked` (one-directional, `CEPH_LANDMARK_TRANSITIONS`). AI points land at `placed`; a human must drive them to `confirmed`. Report generation is hard-gated on `A/B/Go/Po` being **confirmed** (`CEPH_REPORT_GATE_LANDMARKS`, `createCephReport`). This means AI output **cannot reach a finalized report without human confirmation today** — the safety primitive we need is structurally present.
- **Tier gate.** All ceph features are addon-tier only (`getImagingTierForBranch !== 'addon' → 403 IMAGING_TIER_REQUIRED`). Auto-detection inherits this gate.
- **Image bytes are reachable.** `listPatientImages` produces a presigned S3/MinIO `downloadUrl` per image (`listPatientImages.ts:91-115`); a detection service can fetch the radiograph the same way the canvas does.

**Net:** the data model, provenance, confidence, ingest endpoint, human-confirm FSM, and tier gate are all already in place. **The only missing piece is a detector and the orchestration around it.** This is why the gap is P1, not P0 — manual placement works — but closing it is high-leverage and low-schema-risk.

---

## 2. Target

Deliver **one-click auto-detect of cephalometric landmarks from a lateral ceph**, landing the predicted points directly in the existing landmark layer as `source='ai'` at `status='placed'`, each carrying a per-point `confidence`, so the clinician **reviews and corrects** rather than placing from scratch.

Target behavior:

1. Clinician opens the ceph workspace on a lateral-ceph image → an **"Auto-detect landmarks"** button (addon-tier, requires calibration awareness but not calibration to run — angular metrics don't need it).
2. Detection runs (async; surface progress), returns predicted `{landmarkCode, x, y, confidence}` for as many of the 16 codes as the model supports.
3. Points appear on the overlay with a **distinct AI visual state** (e.g. dashed/hollow ring + confidence-tinted), the palette shows each as AI-suggested-unconfirmed, and low-confidence points are flagged for attention.
4. Clinician nudges/drags any point → on first edit, that landmark's `source` flips `ai → ai_corrected` (provenance preserved). Confirming a point advances `placed → confirmed`.
5. Report generation remains gated on **human-confirmed** `A/B/Go/Po`. **AI never auto-confirms, never auto-finalizes.**

**Competitive baseline** (research §"Landmark-placement UX"): WebCeph, AudaxCeph, and Ceph Assistant all ship fully automatic detection + manual correction; this is **table-stakes**, not a differentiator. **Accuracy caveat we must design around:** across these tools, *angular* skeletal measures are reliable (AudaxCeph ICC > 0.90), but *linear* and especially *soft-tissue* landmark detection is weak (WebCeph/Ceph Assistant linear ICC < 0.50). **Implication:** we surface confidence per point, default to a conservative confirm-everything workflow, and never present AI linear/soft-tissue output as authoritative. Our current landmark set is hard-tissue only (no soft-tissue points), which conveniently sidesteps the weakest dimension.

---

## 3. Proposed approach — options & recommendation

The detector needs a lateral-ceph radiograph (PHI) → returns `{code, x, y, confidence}[]` in **image-space pixels** (to match `imaging_ceph_landmark.x/y`, D-C). Three sourcing options:

### Option A — Integrate a third-party AI ceph API (e.g. WebCeph / CephX / a DLC vendor API)

- **Pros:** Highest clinical accuracy out of the box (these are purpose-trained CNN/heatmap regressors on tens of thousands of cephs); zero ML maintenance; vendor owns model updates and (often) regulatory clearance.
- **Cons:** **PHI leaves our boundary** — a lateral ceph is identifiable health data; requires a BAA/DPA + likely fails the Philippines DPA / data-residency posture without a signed processor agreement. Per-image cost + rate limits. External latency + availability dependency. Coordinate-system mismatch (vendor may return its own normalized space → we must map back to our image pixels, and they may run their own analyses we'd ignore). Vendor lock-in on the most clinically sensitive feature.
- **Verdict:** Best accuracy, worst privacy/governance fit. Viable only behind a signed BAA and an explicit consent/residency review.

### Option B — Self-hosted open model (e.g. a published cephalometric landmark CNN — the ISBI/IEEE 2015 ceph-landmark architectures, MMPose/HRNet heatmap regressors, or a fine-tuned U-Net)

- **Pros:** **PHI never leaves our infrastructure** — strongest privacy/governance fit, aligns with the existing PHI-never-logged posture and S3/MinIO-internal storage. No per-image cost. Deterministic latency we control. Can run as a sidecar microservice the `api-ts` server calls over the internal network.
- **Cons:** Real ML ops burden — model weights, a Python/ONNX inference service, GPU or slow-CPU inference, accuracy validation, and ongoing drift management. Published open models are decent on skeletal landmarks but typically below commercial accuracy and need calibration to *our* radiograph characteristics. Adds a non-Bun, non-Rust runtime to the stack (a deviation worth flagging).
- **Verdict:** Best privacy + cost profile, highest build/ops cost. The right long-term home if auto-landmarking becomes core.

### Option C — Claude / vision-model assist (Anthropic vision API)

- **Pros:** No model to train/host; fast to prototype; one integration we already understand. Good at *coarse* anatomical reasoning and could produce approximate seed points + natural-language rationale ("Sella is the center of sella turcica, ~here").
- **Cons:** **General vision models are not metrology instruments** — they are not trained for sub-millimeter landmark localization and will be materially less accurate than purpose-built detectors, especially on the precise points that drive angles (the whole value). Still sends PHI to an external processor (same BAA/residency concern as A, with worse accuracy). Coordinate output is unreliable at pixel precision. Cost per call.
- **Verdict:** Acceptable only as a *seed/assist* fallback or a prototype, never as the clinical detector. Do **not** position it as "AI cephalometric landmarking."

### Recommendation: **B (self-hosted) as the production target, with a pluggable provider seam so A is a configurable alternative; C explicitly rejected for clinical use.**

Rationale:
1. **PHI governance is the deciding factor.** Radiographs are identifiable health data; the codebase's whole posture (PHI never logged, internal object store, consent-gated processing) argues against shipping radiographs to a third party as the *default*. Self-hosting keeps PHI in-boundary.
2. **Build the abstraction, not the model coupling.** Define a `CephLandmarkDetector` provider interface (`detect(imageBytes, hints) → DetectionResult`) with two implementations: `SelfHostedDetector` (default) and `VendorApiDetector` (opt-in, BAA-gated, env-flagged). This lets us ship the *plumbing + UX + provenance + safety gates* first (the L-effort work) and swap detector quality later without touching handlers, schema, or frontend.
3. **Phase the model.** A useful first detector does not need to be best-in-class — even a modest skeletal-point heatmap model that lands `S/N/A/B/Go/Po/Or/Me` within a clinician's easy-nudge radius removes most manual clicks. Confidence surfacing + mandatory human confirm absorb the accuracy shortfall.

### API surface (provider-agnostic, behind the tier gate)

New backend operation (TypeSpec → generated route → handler), addon-tier + `dental_imaging_auto_landmark` flag gated:

```
POST /dental/imaging/images/{imageId}/ceph/landmarks/detect
  → 202 Accepted { jobId, status: 'pending' }            (async; detection is slow)
GET  /dental/imaging/images/{imageId}/ceph/landmarks/detect/{jobId}
  → 200 { status: 'pending'|'succeeded'|'failed',
          predictions?: { landmarkCode, x, y, confidence }[],   // image-space px
          modelVersion?, error? }
```

(Async job pattern chosen because self-hosted CPU inference and vendor round-trips can exceed a synchronous request budget; the existing presigned-upload flow already establishes an async, two-step pattern in this module. A synchronous variant is acceptable for a fast self-hosted GPU path — decide at eng-review.)

**Detector provider contract (internal seam, not an HTTP route):**

```
interface CephLandmarkDetector {
  detect(input: { imageUrl: string; imageId: string }):
    Promise<{ modelVersion: string;
              landmarks: { code: CephLandmarkCode; x: number; y: number; confidence: number }[] }>;
}
```
- `SelfHostedDetector` POSTs the presigned `downloadUrl` (or streams bytes) to the internal inference sidecar; sidecar returns image-pixel coordinates.
- `VendorApiDetector` adapts the vendor's coordinate space back to our image pixels and is **only constructed when an explicit env flag + BAA acknowledgment is set**.

### How predictions flow into the existing landmark layer

The detect endpoint **does not write landmarks itself in the first cut** — it returns predictions; the client (or a thin server step) writes them through the **existing** `batchUpsertCephLandmarks` with `source: 'ai'`, `status: 'placed'`, `confidence: <model>`. This reuses the recompute-on-write path and the FSM with zero new write logic. (At eng-review we may choose to have the detect-result step persist directly to avoid a client round-trip; either way the write goes through the same repo `batchUpsert`.)

Then:
- AI points render in a **distinct overlay state** in `CephLandmarkLayer.tsx` (extend `fillForStatus` / add a source-aware style: dashed/hollow ring, confidence-driven tint, low-confidence badge).
- The palette (`CephLandmarkPalette.tsx`) marks each as "AI · unconfirmed" with its confidence.
- **Provenance transition `ai → ai_corrected`:** when a clinician edits an AI point's coordinates (drag/nudge → `updateCephLandmark` PATCH), the handler sets `source = 'ai_corrected'` if the prior source was `'ai'` and `x|y` changed. (Requires `updateCephLandmark` to accept/derive `source`; today it only handles `x/y/status`. Small additive change.)
- **Confirm:** advancing `placed → confirmed` keeps `source` (`ai` or `ai_corrected`) — provenance survives into the report snapshot, so a report records *which landmarks were AI-originated vs human-corrected vs hand-placed*. This is an auditability win.

### PHI / privacy / latency / cost summary

| Dimension | A (vendor) | B (self-host) ✅ | C (Claude vision) |
|---|---|---|---|
| PHI leaves boundary | Yes (needs BAA/DPA) | **No** | Yes (needs BAA) |
| Clinical accuracy | High | Medium→High | Low (not a detector) |
| Latency | External RTT | Controlled | External RTT |
| Per-image cost | Yes | Infra only | Yes |
| Ops burden | Low | High | Low |
| Regulatory fit (PH DPA / HIPAA) | Conditional | **Best** | Poor |

---

## 4. Eval & safety

- **Accuracy expectations (set them honestly, in the spec and the UI footnote):** angular skeletal measures derived from AI points are usable with review; **linear measures depend on calibration AND precise points and must be treated as drafts**; we ship no soft-tissue landmarks so we sidestep the worst case. Mirror the existing measurements-panel disclosure ("reference ranges, not a diagnosis") with an AI-specific note ("Landmarks suggested by automated detection — confirm each before generating a report").
- **Mandatory human-review gate (already structurally enforced — keep it):** AI points enter at `status='placed'`. The report gate (`createCephReport`) already requires `A/B/Go/Po` at `status='confirmed'`, a transition only a human can drive via `updateCephLandmark`. **No code path may auto-confirm an AI landmark.** Add an explicit handler-level guard + test: a `batchUpsert`/detect-write with `source='ai'` **must not** be allowed to set `status='confirmed'` or `'locked'` in the same write.
- **Never auto-finalize:** detection produces drafts only; report creation stays a deliberate human action. Add a test asserting a report cannot be generated from a fully-AI, zero-confirmed landmark set.
- **Confidence surfacing is load-bearing, not cosmetic:** persist per-point `confidence`; render it; flag points below a configurable threshold; never hide low confidence behind a green checkmark (consistent with the module's deliberate no-green-for-normal stance).
- **Provenance audit:** every detection run logs `{imageId, modelVersion, provider, by, count}` (PHI-safe — no pixel data, no coordinates beyond counts) via the existing structured logger; the report snapshot records per-landmark `source`.
- **Kill switch:** the `dental_imaging_auto_landmark` flag (per-branch/global) must hard-disable the detect endpoint (returns the same tier-style 403/“disabled” response) so the feature can be turned off without a deploy if accuracy/regulatory issues surface.

---

## 5. Vertical-TDD test plan

Per `docs/development/VERTICAL_TDD.md` — RED before GREEN, one vertical slice end-to-end.

**1. TypeSpec** — add `detectCephLandmarks` (+ job-status op), `CephLandmarkDetectionResult`, `CephLandmarkPrediction` models to `specs/api/src/modules/dental-imaging.tsp`; full `/dental/imaging/...` route prefix (the file's own warning: missing prefix = auth-bypass P0). Add `dental_imaging_auto_landmark` to config typing.
**2. Codegen** — `cd specs/api && bun run build` then `cd services/api-ts && bun run generate`; never hand-edit generated files.
**3. Backend tests (RED)** in `services/api-ts/src/handlers/dental-imaging/`:
   - detect endpoint: addon-tier required (free → 403), flag-off → disabled, non-ceph modality → 422, image-not-found → 404 (mirroring `assertBranchRole` catch → NotFound pattern).
   - detector provider seam: a `FakeDetector` returns fixed predictions; assert they persist as `source='ai'`, `status='placed'`, `confidence` set.
   - **safety:** AI write attempting `status='confirmed'/'locked'` → rejected; report cannot be generated with only AI/placed landmarks.
   - **provenance:** editing an `ai` landmark's coords → `source` becomes `ai_corrected`; confirming preserves source; report snapshot records source per landmark.
   - vendor adapter coordinate mapping (pure function) unit-tested with a fixture.
**4. Backend impl (GREEN)** — detect handler + `CephLandmarkDetector` interface + `SelfHostedDetector` (or `FakeDetector` first) + `updateCephLandmark` source-transition + flag gate.
**5. Contract tests (RED→GREEN)** — Hurl scenario in `specs/api/tests/contract/`: detect (mocked detector) → poll → batch-write predictions → confirm → report; assert provenance + gate.
**6. Frontend tests (RED)** in `apps/dentalemon/src/features/imaging/`:
   - `use-ceph-landmarks` (or new `use-ceph-detect`) hook: detect mutation, poll, write-through, optimistic AI overlay.
   - `CephLandmarkLayer` renders AI points in the distinct state; low-confidence flagged; editing an AI point fires the corrected transition.
   - `CephWorkspacePanel`: "Auto-detect" button gated (addon + flag), progress state, error surfacing (reuse `isAddonError` pattern).
**7. Frontend impl (GREEN).**
**8. E2E (Playwright)** — open a seeded lateral-ceph image → Auto-detect → AI points appear → correct one (→ ai_corrected) → confirm gate codes → generate report → report shows AI provenance. (Requires seeding a ceph image — the review notes none exists for the test patient today; **seed dependency**.)
**9. Verify gate** — `bun run test` (never `bun test <path>` — pollutes the clone template), `bun run typecheck`, `bun run lint`, **and `bun run check:boundaries`** (per project memory: backend verify gate must include boundaries). Green with no regressions before slice complete.

---

## 6. Phasing & effort

Overall effort **L** (matches backlog). Recommend phasing so value lands before the model investment:

- **Phase 0 — Seam + provenance + safety (no real model).** TypeSpec op, `CephLandmarkDetector` interface, `FakeDetector` (deterministic fixture points), `source` write-through, `ai → ai_corrected` transition, no-auto-confirm guards, flag gate, full backend+contract+frontend+E2E tests, AI overlay state, "Auto-detect" UX. **This is most of the L effort and ships the entire safety/provenance/UX skeleton with a stub detector.** Also: seed a lateral-ceph image so the flow is demoable/E2E-testable.
- **Phase 1 — Real detector.** Implement `SelfHostedDetector` (inference sidecar + model) **or** `VendorApiDetector` (BAA-gated) behind the seam. No handler/schema/frontend change — swap the provider. Accuracy validation harness against a small hand-traced ground-truth set (report mean radial error per landmark; gate on skeletal points).
- **Phase 2 (optional/deferred).** Confidence-threshold tuning, per-branch provider selection, batch detection across a study, growth-projection adjacency (explicitly out of scope here — see VTO P3 deferral in the review).

---

## 7. Dependencies

- **Seedable lateral-ceph image** for the demo patient (none exists today per review note §5; E2E + live demo blocked without it).
- **Tier infra** — `getImagingTierForBranch` (exists) + the addon gate (exists, reused).
- **Feature-flag mechanism** — `dental_imaging_auto_landmark` must be added to `core/config.ts` typing/parsing (not currently present).
- **Presigned image access** — `listPatientImages` download-URL path (exists) for the detector to fetch bytes.
- **Existing ingest + FSM + report gate** — `batchUpsertCephLandmarks`, `updateCephLandmark`, `CEPH_LANDMARK_TRANSITIONS`, `CEPH_REPORT_GATE_LANDMARKS` (all exist; reused).
- **Phase 1 only:** inference sidecar runtime (Python/ONNX) + model weights + GPU/CPU budget (self-host), **or** a signed BAA/DPA + data-residency sign-off (vendor). A ground-truth tracing set for accuracy eval.
- **Coordinate-space contract** — detector must return image-space pixels consistent with D-C; vendor adapters must map their space back.

---

## 8. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **PHI exfiltration** — radiographs are identifiable PHI; any external detector ships them off-boundary | **Highest** | Default to self-hosted (Option B); vendor path BAA/DPA-gated + residency review + explicit env flag; never log pixels/coords |
| **Accuracy below clinical bar** — esp. linear/soft-tissue (research: ICC < 0.50 on linear for some tools) | High | Mandatory human-confirm gate (already enforced); confidence surfaced + low-confidence flags; honest UI disclosure; angular-only confidence in v1; ground-truth eval gate before enabling a provider |
| **Regulatory / device classification** — "AI that produces a clinical measurement" can attract SaMD scrutiny | High | Position as *suggestion/draft requiring clinician confirmation*, never autonomous diagnosis; no auto-finalize; record provenance; legal review before enabling in regulated markets |
| **False trust / automation bias** — clinicians rubber-stamp AI points | Med-High | Force per-point confirm (no "confirm all AI"); distinct unconfirmed visual state; report records AI vs corrected provenance for audit |
| **Coordinate-space drift** — model/vendor returns wrong space → points land off-anatomy | Med | Pure-function mapping unit-tested with fixtures; sanity-bound predictions to image dimensions |
| **New non-Bun runtime (self-host sidecar)** — stack deviation, ops burden | Med | Isolate as a sidecar microservice behind the provider interface; can start with `FakeDetector` and defer the runtime decision to Phase 1 |
| **Latency/availability** of async detection | Low-Med | Async job pattern; UI progress + graceful failure; manual placement always available as fallback |

---

## Two-line confirmation

Wrote the design plan (no code) to `docs/reviews/plans/02-ceph-auto-landmarking.md` covering problem/current-state, target, three sourcing options with a recommendation (self-hosted behind a pluggable provider seam; Claude-vision rejected for clinical use), the detect API surface and how predictions flow through the existing `batchUpsert` + FSM with `ai`/`ai_corrected` provenance, eval/safety (mandatory human-confirm gate, never auto-finalize), a Vertical-TDD test plan, L-effort phasing (seam+safety first, real model second), dependencies, and risks.

**Biggest risk:** PHI exfiltration — a lateral ceph is identifiable health data, so any external detector (vendor or Claude vision) ships PHI off-boundary and demands a BAA/DPA + data-residency sign-off; this is precisely why the recommendation defaults to a self-hosted detector and gates the vendor path behind an explicit flag.
