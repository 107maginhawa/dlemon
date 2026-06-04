# Periodontal Charting — Standards & Experience Review
> Review date 2026-06-02 · Depth: DEEP

## 1. What we have

A **backend-only** perio module. There is no frontend whatsoever (see §4).

**Data model** — two tables (`services/api-ts/src/handlers/dental-perio/repos/`):

- `dental_perio_chart` (`perio-chart.schema.ts`): per-visit chart (unique on `visitId`, BR-P01), `status` enum `draft|completed|locked`, `examinerMemberId`, `notes`, and three persisted summary stats computed at completion — `summaryBopPercent`, `summaryMeanDepth`, `summaryDeepPocketCount`.
- `dental_perio_tooth_reading` (`perio-reading.schema.ts`): one row per (chart, tooth). Captures, **per tooth**:
  - **6-point probing depths** ✅ — `depthBM/BC/BD` (buccal mesial/center/distal) + `depthLM/LC/LD` (lingual). Full 6-site model.
  - **BOP per-site** ✅ — six booleans `bopBM…bopLD`, one per probing site (not aggregated per-tooth).
  - **recession** — a single signed `smallint` (`-5..20`, `perio-validation.ts`). **One value per tooth, not per-site**, and it is raw recession only — there is no separate gingival-margin or CEJ field.
  - **mobility** (Miller, grade 0–3) ✅, **furcation** (grade 0–3, labelled "Hamp" in code) ✅, **plaque** (boolean, per-tooth) ⚠️, **suppuration** (boolean, per-tooth) ⚠️, `notes`.

**Handlers** (all registered in `services/api-ts/src/generated/openapi/routes.ts` ~L1391–1410, so wired server-side):
- `createPerioChart.ts` — POST `/dental/perio-charts`; one-per-visit, role-gated (`dentist_owner|dentist_associate|hygienist`), audit-logged (`perio.chart.created`).
- `upsertToothReading.ts` — PUT `…/readings/{toothNumber}`; validates FDI tooth (BR-P04), depths 0–20mm (BR-P03), mobility/furcation 0–3 (V-PER-004); draft-only (409 if completed/locked).
- `completePerioChart.ts` — POST `…/complete`; requires ≥16 readings adult / ≥8 primary (BR-P07), computes mean depth, BOP%, and deep-pocket count (depth ≥5mm), audit-logged.
- `getPerioChart.ts` / `getVisitPerioChart.ts` — reads with visit-lock cascade (`utils/perio-lock-cascade.ts`).

**CAL is not computed and cannot be** — there is no gingival-margin-to-CEJ field, so the recession-aware CAL formula has no inputs (see §3/§5). **Staging/grading is absent** — `MODULE_SPEC.md` explicitly defers it (§Glossary "Out of scope — P3"; feature flags `perio.auto_staging=false`, `perio.side_by_side_comparison=false`).

## 2. Industry-standard benchmark

Best-in-class perio (Open Dental, Dentrix Voice Perio, Curve) captures **6-point depths, per-site BOP/suppuration/plaque/calculus, signed gingival margin vs CEJ, auto-calculated read-only CAL, Miller mobility, Glickman/Hamp furcation, and MGJ/keratinized width**, then layers **2017 AAP/EFP staging (I–IV) + grading (A/B/C)**, **% BOP bucketing**, **red-line threshold visualization**, **multi-exam comparison (4–6 exams side-by-side)**, and **voice/hands-free auto-advance entry** for the solo clinician. See [../research/perio.md](../research/perio.md).

## 3. Completeness gaps

| Capability | Industry benchmark | Our status | Evidence (file) | Severity |
| --- | --- | --- | --- | --- |
| 6-point probing depths | 6 sites/tooth | ✅ full 6-point | `perio-reading.schema.ts` L16–21 | — |
| BOP per-site | per-site, incl ≤3mm | ✅ 6 booleans | `perio-reading.schema.ts` L22–27 | — |
| Mobility (Miller 0–3) | N/1/2/3 | ✅ grade 0–3 | `perio-validation.ts` `assertValidGrades` | — |
| Furcation (Glickman/Hamp) | I–IV / 1–3 | ⚠️ grade 0–3, no per-furcation-site, no multi-root gate | `perio-reading.schema.ts` L30; `perio-validation.ts` | P2 |
| Gingival margin / CEJ offset | signed value vs CEJ | ❌ only raw `recession`, no GM/CEJ | `perio-reading.schema.ts` L28 | P1 |
| **CAL (auto-calc, read-only)** | computed per-site from PD+GM | ❌ not stored, not computed, no inputs | no field in schema/handlers | **P1** |
| Suppuration per-site | per-site marker | ⚠️ one boolean per tooth | `perio-reading.schema.ts` L32 | P2 |
| Plaque per-site + whole-mouth % | per-site + % | ⚠️ one boolean per tooth, no % | `perio-reading.schema.ts` L31 | P2 |
| Calculus marker | per-site | ❌ absent | not in schema | P2 |
| MGJ / keratinized width | recorded | ❌ absent | not in schema | P2 |
| % BOP bucketed (health/local/gen) | <10/10–30/>30% | ⚠️ raw % stored, no bucketing | `completePerioChart.ts` L109 | P2 |
| 2017 AAP/EFP Stage I–IV | computed/assisted | ❌ explicitly deferred (P3) | `MODULE_SPEC.md` §Glossary, flag `perio.auto_staging` | **P1** |
| 2017 AAP/EFP Grade A/B/C | computed/assisted | ❌ absent | not in code | P1 |
| Extent descriptor (local/gen/MI) | applied per stage | ❌ absent | not in code | P2 |
| Color-coded red-line threshold | configurable | ❌ no UI | no frontend | P1 |
| **Multi-exam comparison** | 4–6 exams side-by-side | ❌ no UI; flag off | `MODULE_SPEC.md` flag `perio.side_by_side_comparison=false` | **P1** |
| **Voice / hands-free entry** | table-stakes solo workflow | ❌ explicitly out of scope | `MODULE_SPEC.md` §Out of scope | P2 |
| Auto-advance keyboard entry | maxillary/facial-first | ❌ no UI | no frontend | P1 |
| Export perio exam as PDF | referral/patient | ❌ absent (`dental-pmd` export is separate) | no handler | P2 |
| **Perio chart UI exists at all** | core data-entry surface | ❌ **none** | no `features/perio`, no route, no SDK hook | **P0** |

## 4. UX/UI assessment

**There is no perio UI.** Confirmed by: no `apps/dentalemon/src/features/perio` directory (feature dirs are billing, dashboard, imaging, notifications, onboarding, patients, person, pmd, reports, scheduling, settings, staff, workspace); no file matching `*perio*` under `apps/dentalemon/src`; no route in `src/routes/` references perio; no generated SDK hook or type for `PerioChart` in `packages/sdk-ts/src/generated/`; no wireframe in `docs/context/wireframes/`. The only "perio" hits in the app are a CDT-code specialty filter label and an RBAC comment — unrelated. This corroborates the live-walkthrough finding: **there is no perio entry point in the clinical workspace toolbar or tabs.**

So a fully role-gated, audit-logged, tested backend (`dental-perio-coverage.test.ts` is 28KB) is **completely unreachable by any user** — capability stranded.

On the data-entry burden the missing UI would have to solve: a full-mouth adult exam is 32 teeth × (6 depths + 6 BOP + recession + mobility + furcation + plaque + suppuration) ≈ **500+ discrete inputs**. Industry treats **voice/hands-free auto-advance entry as table stakes** precisely because manual keyboard entry of this volume chairside is impractical for a solo clinician. A naive form would fail WCAG-adjacent efficiency expectations and Nielsen's "efficiency of use" heuristic on day one. Whatever UI ships must lead with auto-advance sequencing and a red-line threshold view, not a 500-field grid.

## 5. Findings (P0–P3)

- **[P0] No perio frontend — backend capability fully stranded.** Evidence: routes wired (`generated/openapi/routes.ts` L1391+) and handlers/tests complete, but zero UI/route/SDK-hook/wireframe (`apps/dentalemon/src/features/*`, `routes/`, `packages/sdk-ts/src/generated/`). Recommendation: build the perio charting feature (chart open from workspace/visit, 6-point grid with auto-advance, completion flow) and generate the SDK hooks; this is the single highest-leverage gap — everything else is invisible until it exists.
- **[P1] CAL not captured or computed.** Evidence: schema has only a single per-tooth signed `recession` (`perio-reading.schema.ts` L28); no gingival-margin/CEJ field, no CAL column, no computation in `completePerioChart.ts`. CAL is the truest attachment-loss measure and the primary 2017-staging input. Recommendation: add per-site gingival-margin (signed vs CEJ), derive read-only CAL = PD + GM with the three-case formula (at-CEJ / recession / coronal), store or compute on read.
- **[P1] No 2017 AAP/EFP staging or grading.** Evidence: `MODULE_SPEC.md` defers both (Glistary "Out of scope — P3"; flags `perio.auto_staging=false`). For a perio-serious product this is a credibility gap modern PMS increasingly close. Recommendation: at minimum compute an assisted Stage from worst-site CAL + max PD + furcation/mobility once CAL exists; sources for smoking/HbA1c grade modifiers from medical history.
- **[P1] No multi-exam comparison.** Evidence: `perio.side_by_side_comparison=false`; no UI. This is a first-class industry feature (Open Dental 6-exam grid, Dentrix 4-exam compare) and the clinical anchor for dentalemon's snapshot/carousel value prop (see §6). Recommendation: model perio exams as comparable snapshots from the start.
- **[P1] No voice / auto-advance entry, against a ~500-input burden.** Evidence: voice explicitly out of scope (`MODULE_SPEC.md`); no UI to even type into. Recommendation: prioritize keyboard auto-advance sequencing in the first UI; treat voice as fast-follow.
- **[P2] Furcation/suppuration/plaque are per-tooth, not per-site; calculus and MGJ absent; furcation has no multi-root gate.** Evidence: single booleans in `perio-reading.schema.ts` L30–32; no calculus/MGJ columns. Recommendation: move suppuration/plaque to per-site, add calculus + MGJ, restrict furcation entry to multi-rooted teeth.
- **[P2] % BOP stored raw, not bucketed.** Evidence: `completePerioChart.ts` L109 computes the percentage but does not classify health <10 / localized 10–30 / generalized >30. Recommendation: surface the bucket in the summary.

## 6. Carousel implications

Multi-exam perio comparison is the textbook proof-point for the snapshot/carousel concept — Open Dental shows the 6 most-recent exams in one grid (current dark, prior grayed) and Dentrix has an explicit Exam Comparison mode. The good news: the data model is **already snapshot-shaped** — each `dental_perio_chart` is immutable once completed (`status` locks, `completedAt` set, summary stats frozen), one chart per visit, with per-tooth readings hanging off it. That is exactly a cumulative snapshot per the approved carousel model.

To extend the carousel to perio: (1) treat each completed chart as a carousel frame keyed by `completedAt`; (2) diff per-site depths/BOP/CAL across adjacent frames to drive trend arrows and the red-line (out-of-threshold) emphasis; (3) reuse the persisted `summaryBopPercent / summaryMeanDepth / summaryDeepPocketCount` as the per-frame headline metrics so the carousel can show progression without recomputing. The two blockers are upstream: there is no UI to render frames into (P0), and **CAL — the metric clinicians most want to trend — is not captured** (P1), so a perio carousel today could only trend raw depth and BOP, not attachment loss.

---

DIGEST (top findings):
1. P0 — Perio has a complete, wired, tested backend but ZERO frontend (no feature dir/route/SDK hook/wireframe); capability fully stranded and unreachable.
2. P1 — CAL is neither stored nor computed: schema has only a single per-tooth signed `recession`, no gingival-margin/CEJ field, so the recession-aware CAL formula has no inputs.
3. P1 — No 2017 AAP/EFP staging or grading; MODULE_SPEC explicitly defers both (flag `perio.auto_staging=false`) — a credibility gap for a perio-serious product.
4. P1 — No multi-exam comparison (flag off, no UI), despite it being the clinical anchor for the snapshot/carousel value prop.
5. P1/P2 — No voice/auto-advance entry against a ~500-input full-mouth burden; furcation/suppuration/plaque are per-tooth not per-site; calculus + MGJ absent.
6. Carousel: data model is already snapshot-shaped (immutable per-visit charts + frozen summary stats), but a perio carousel is blocked by the missing UI (P0) and missing CAL (P1) — today it could only trend depth/BOP, not attachment loss.
