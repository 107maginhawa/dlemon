# Clinical Standards Compliance — Cephalometric & Periodontal

**Status:** Current as of 2026-06-07 · **Scope:** dentalemon clinical modules
(cephalometric imaging, periodontal charting)

This document records how dentalemon's two most standards-sensitive clinical
features comply with industry/clinical best practice, what comparable products
do, and which gaps are **intentional non-goals** versus a tracked future
backlog. It exists so the product's scope is a *documented decision* rather than
an apparent omission.

## Product stance (drives scope)

dentalemon is **local-first / offline-capable** and intentionally ships **no AI**
at this stage. Two capabilities that the broader market is moving toward —
**cephalometric AI auto-tracing** and **voice-activated periodontal charting**
(speech recognition) — are therefore **deliberate non-goals**, not committed
surfaces. Both require models/services and/or hardware that do not fit a no-AI,
offline-first product. (Perio ships an *experimental* `perio.voice_charting`
capability that is **disabled by default** pending a compliance review — see the
Periodontal § "Manual entry is the supported input"; it is not a committed
workflow.) This is a conscious trade-off; the de-facto cephalometric gold standard
(Dolphin Imaging) is itself semi-automated mouse-placement, which is exactly the
interaction model we ship.

## Verdict

The **clinically and legally load-bearing logic is implemented and unit-tested**
in both modules — AAP/EFP 2017 staging/grading for perio, and calibration-safe
measurement math for ceph. **Standards compliance is met and as-is is acceptable
to ship.** Remaining differences from market leaders are workflow breadth and
automation, not correctness defects.

---

## Cephalometric

### Standard of care / what comparable apps do
- Daily clinical analyses: **Steiner, Ricketts, Downs, Tweed, McNamara**
  (some platforms advertise 100+; practices use a handful).
- Market direction: **AI auto-tracing** (WebCeph, AudaxCeph, CephX) auto-places
  ~19–23 landmarks; **Dolphin** is the established **semi-automated** (manual
  mouse-place) reference. DICOM ingest (PixelSpacing calibration), soft-tissue
  profile analysis, and longitudinal superimposition are common.

### What dentalemon implements
- **6 analyses**: Steiner-SN, Ricketts, Downs, Tweed, McNamara, Jarabak
  (`packages/ceph-math/`). Covers the daily-workflow set of the commercial tools.
- **16 landmarks** with a `placed → confirmed → locked` status machine; report
  generation gated on A/B/Go/Po confirmed
  (`services/api-ts/src/handlers/dental-imaging/repos/imaging_ceph.schema.ts`).
- Safety rigor that meets or exceeds many commercial tools:
  - **Calibration gating** — mm-based measurements return null when the image is
    uncalibrated or has anisotropic pixel spacing (pixels-as-mm is treated as a
    P0 safety bug); angle measurements remain valid.
  - **Signed metrics** (e.g. ANB, convexity) preserve Class II vs Class III.
  - **6 population-specific norm sets** with safe fallback.
  - **Immutable, versioned reports** and **append-only superimposition** records.
  - **AI-draft-never-auto-confirms** gate (drafts enter as `placed`; only human
    review advances to `confirmed`).
  - Cross-runtime deterministic (identical under Bun / QuickJS / Tauri).

### Intentional non-goal (local-first / no-AI)
- **AI auto-tracing** — only a `FakeDetector` stub exists; real automated
  landmark detection is deliberately out of scope while the product is no-AI.

### Deferred (non-AI) backlog — not ship blockers
- Soft-tissue landmarks + profile/esthetic analysis.
- Confirm/implement **DICOM PixelSpacing ingest** (schema supports `dicom_tag`;
  upload pipeline may be JPEG-only today).
- ABO-grade **structural superimposition** (current is a simplified S–N 2-point
  similarity; maxillary/mandibular registration deferred).
- Additional landmarks (Basion/Pterygoid) to unlock further analyses.

---

## Periodontal

### Standard of care / what comparable apps do
- **AAP/EFP 2017 World Workshop** classification is the standard of care:
  **Stage I–IV** (interdental CAL + bone loss + complexity), **Grade A–C**
  (progression rate ± smoking/diabetes), and **extent** (localized / generalized
  / molar-incisor). Establishing stage needs full-mouth radiographs, a periodontal
  chart, and tooth-loss history.
- A full chart captures **6-point** probing depth, **per-site** bleeding on
  probing (BOP), recession/gingival margin, clinical attachment level (CAL),
  mobility, furcation, suppuration, plaque, **calculus**, and
  **MGJ / keratinized tissue width**.
- **Florida Probe VoiceWorks** (voice/hands-free) is the de-facto chairside
  standard; **Open Dental** and **Dentrix** offer **multi-exam comparison**.

### What dentalemon implements
- **6-site probing depth**, **per-site BOP**, **per-site gingival margin**, and
  **auto-computed per-site CAL** (PD + GM, clamped ≥ 0)
  (`services/api-ts/src/handlers/dental-perio/`).
- **Full AAP/EFP 2017 staging + grading + extent**, including risk modifiers
  (age, %bone-loss/age ratio, 5-year progression override, smoking, HbA1c /
  diabetes) — all unit-tested (`utils/perio-staging.ts`,
  `utils/perio-classify-chart.ts`, and tests).
- **Staging uses interdental sites only** (mesial/distal; excludes mid-buccal so
  non-interdental recession does not inflate stage) — a clinically correct detail.
- Mobility (0–3), furcation (0–3) with single-rooted soft-gate, 5 mm deep-pocket
  threshold + red-line visualization, 192-step keyboard auto-advance entry,
  `draft → complete → lock` lifecycle.
- **Multi-exam comparison / longitudinal trend UI** — **shipped** (2026-06-07):
  `GET /dental/perio-charts?patientId=` + the "Current exam ↔ History" overlay
  (BOP%/mean-depth/deep-pocket trend rows + per-tooth max-PD grid + a per-exam
  staging chip, `apps/dentalemon/.../components/perio/perio-comparison.tsx`).
- **Per-exam AAP/EFP staging/grading/extent persisted** on the chart row
  (frozen-at-completion, 2026-06-11) so the diagnosis of record survives reads
  and drives the comparison staging trajectory.
- **Source of truth for recession / gingival-margin (CEJ):** the perio chart is
  the authoritative record for per-site recession and gingival-margin
  measurements (decision C-3); other modules reference, never re-derive, these.

### Manual entry is the supported input (no-AI)
- **Manual keyboard auto-advance is the default and only supported V1 input
  method** for perio charting (192-step grid). The product is local-first and
  bundles **no AI/ML model**: AAP/EFP staging is a deterministic rule engine, not
  a learned classifier.
- **Voice charting is not a committed V1 surface.** A `perio.voice_charting`
  capability exists in the codebase but ships **disabled by default**
  (`apps/dentalemon/src/lib/feature-flags.ts` — default OFF, behind an
  off-device-audio / PHI compliance review + browser speech-capability
  detection). It relies on the browser Web Speech API, which is generally
  cloud-backed and therefore **outside the offline-first guarantee** — so it is
  treated as an experimental, opt-in enhancement, not a shipped clinical
  workflow. **Binding non-goals:** AI auto-staging and AI/cloud transcription as
  default behaviour.

### Deferred (non-AI) backlog — not ship blockers
- Per-site **suppuration** and **plaque** (currently per-tooth); add **calculus**
  and **MGJ / keratinized tissue**; per-furcation-site furcation grades.
- **PDF export** of the chart for referrals / records.

---

## Sources
- AAP, *Staging and Grading Periodontitis* (perio.org); EFP *clinical decision
  tree for staging and grading*; Tonetti, Greenwell, Kornman (2018),
  *J Periodontol* 89(S1):S159.
- *Cephalometric Software Comparison* (BCeph); *AudaxCeph vs Dolphin vs manual*
  accuracy study (PMC11966017; 23 landmarks); *Comparison of three AI-driven
  cephalometric tools* (MDPI, *J Clin Med* 2024;13:3733).
- Florida Probe VoiceWorks (floridaprobe.com); Open Dental / Dentrix periodontal
  charting integration documentation.
