# Dental Charting — Research Guide Reconciliation & Reprioritized Roadmap

**Date:** 2026-06-10
**Status:** Authoritative. This document **supersedes the sequencing** in
[`docs/context/DENTALEMON_V1_DENTAL_CHARTING_RESEARCH_GUIDE.md`](../../context/DENTALEMON_V1_DENTAL_CHARTING_RESEARCH_GUIDE.md).
The research guide remains valuable as product/UX reference; this document corrects its
gap assumptions against the live codebase and re-orders the roadmap for long-term stability.

---

## 1. Executive Correction

The research guide is well-researched (benchmarked against Open Dental, Curve, CareStack,
Dentrix, AAP/EFP 2017, and WCAG 2.2) but was written **without reading our code**. It marks
most items "Needs verification" and **substantially underestimates what is already built.**

We verified all seven of its "P0" items against the real frontend (`apps/dentalemon/src`),
backend (`services/api-ts/src/handlers`), and TypeSpec (`specs/api/src/modules`):

- **3 of 7 P0s are already shipped** (per-surface charting, full-chart clock-gating, tooth history).
- **2 are partial** (legend/toggles shipped but selected-tooth explanation missing; condition vocabulary thin).
- **Only 2 are genuinely greenfield** (offline conflict visibility, chart export).

Acting on the guide's roadmap as-written would rebuild done work and mis-sequence the real gaps.
The reprioritized roadmap in §4 leads with the one item that is a **data-integrity hole**, not a
feature gap.

---

## 2. Verified Status Table

Legend: ✅ Present · ⚠️ Partial · ❌ Missing · 💤 Deferred

| Guide "P0" | Guide assumed | Verified reality | Evidence |
|---|---|---|---|
| Slice 1 — Per-surface condition UI | "likely UI gap" | ✅ **Present (done)** | `apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx`, `tooth-overview-step.tsx` (per-surface picker writing `surfaceConditionMap`); BE `services/api-ts/src/handlers/dental-visit/surface-condition-map.test.ts` proves PATCH-merge + upsert round-trip |
| Slice 6 — Full-chart upsert clock-gating | "known tail item" | ✅ **Present (done)** | `services/api-ts/src/handlers/dental-visit/chart/upsertDentalChart.ts:69-70` and `updateTooth.ts:66-67` both call `mergeVisitChart()`; `upsertDentalChart.conflict.test.ts` proves stale-write rejection + conflict flag on the full-chart path |
| Slice 4 — Tooth history UI | "UI unclear" | ✅ **Largely present** | `services/api-ts/src/handlers/dental-visit/chart/getToothHistory.ts` (reverse-chrono: state + treatment + surfaces + status + price) rendered in `tooth-overview-step.tsx` "Treatment Breakdown" via `use-tooth-history.ts`. Remaining nuance: it is a treatment breakdown, not a chronological event/diff timeline |
| Slice 3 — Legend + layer toggles | "under-surfaced" | ✅ Legend + toggles **present** (`apps/dentalemon/src/features/workspace/components/dental-chart.tsx:313-410`); ⚠️ "why this color" explanation + selected-tooth-filtered bottom panel **missing** | `TreatmentTable` filters by completion status only, not `toothNumber` |
| Slice 2 — Condition vocabulary | "too limited" | ⚠️ **Partial — genuine gap** | UI offers only 9 tooth *states* (`tooth-overview-step.tsx` `TOOTH_STATES`). `conditionCode` is a free `string` in BE (accepts ICD-10, e.g. `K02.1`) but there is no findings picker (abscess/calculus/recession/impacted/retained-root/sensitivity) and no finding→treatment conversion |
| Slice 5 — Offline conflict visibility | "BE persists, FE missing" | ❌ **Missing — and larger than the guide assumed** | Conflicts persist to `dental_chart.syncStatus` / `conflictPayload` via `services/api-ts/src/handlers/dental-visit/repos/dental-chart.repo.ts` `flagSyncConflict` (line 105), but **no list/resolve API exists** and **no FE surface** exists. `grep conflict` in FE returns only allergy/appointment conflicts |
| Slice 7 — Chart export/print | "likely missing" | ❌ **Missing (FE + BE)** | No `exportChart`/print/pdf op or handler. `exportPMD` (`specs/api/src/modules/dental-pmd.tsp:194`) and `exportDentalPatients` are the precedents to mirror |

### Perio subsystem

| Item | Verified reality | Evidence |
|---|---|---|
| Auto-advance data entry | ✅ Present | `apps/dentalemon/src/features/workspace/components/perio/perio-site-cell.tsx:77-81`, sequence in `perio-chart-grid.tsx` |
| Completion gate | ✅ Present (≥16 teeth; no per-site gate) | `perio-chart-overlay.tsx:47,148` (`MIN_ADULT_READINGS`) |
| Prior-exam comparison | ⚠️ Substantially built (trend table BOP%/mean depth/deep pockets + per-tooth max-PD grid; read-only, separate tab) | `perio-comparison.tsx`, `perio-comparison.logic.ts` |
| Triplet entry | ❌ Missing (one input per site) | `perio-site-cell.tsx` single-value input |
| Calculus capture | ❌ Missing entirely | not in UI or SDK types |
| Per-site plaque | ⚠️ Per-tooth only (plaque + suppuration booleans) | `perio-tooth-column.tsx:184-211` |
| Perio export/print | ❌ Missing | no export affordance in `/perio` |

**Net:** Of the guide's 7 P0s — 3 done, 2 partial, 2 greenfield.

---

## 3. Already Shipped — Do NOT Rebuild

A future agent must not redo these (the guide's roadmap implies they're open):

- **Per-surface condition charting** (FE picker + `surfaceConditionMap` BE persistence/merge) — *guide Slice 1.*
- **Full-chart upsert clock-gating** (stale-write rejection + durable conflict flag on both upsert and PATCH paths) — *guide Slice 6.*
- **Tooth history retrieval + UI** (`getToothHistory` rendered in slideout) — *guide Slice 4* (only a chronological-timeline enhancement remains, P1 at most).
- **Chart legend + layer toggles** (baseline/proposed/completed/declined) — *guide Slice 3 (legend portion).*
- **Perio auto-advance, completion gate, and prior-exam comparison** — *guide Slices 10/11 (comparison + auto-advance portions).*

---

## 4. Reprioritized Roadmap (sequenced for long-term stability)

### P0-A (lead) — Offline conflict visibility & resolution

**Why first:** This is the only item that is a **data-integrity hole**, not a feature gap.
The backend already rejects stale offline writes and persists them to
`dental_chart.conflictPayload` (`syncStatus='conflict'`), but **nothing can read or resolve
them.** In an offline-first product (Tauri + cadence P2P sync), that means dropped clinical
edits accumulate **invisibly and permanently** — the highest long-term-stability risk on the
list, and directly aligned with the offline-first architecture.

**Scope (spans BE + FE):**
- New TypeSpec ops over the existing `conflictPayload`: list open conflicts (per patient/visit) and resolve a conflict.
- FE: global conflict banner, per-tooth conflict marker, conflict detail/resolution panel.

**Integrity rule (guide §6.7):** resolving a conflict must create a **new** change with a
**new** clock — never mutate historical facts. "Dismiss" should require a reason or be limited
to non-clinical duplicates.

**Build-on / net-new:**
- *Exists:* `dental-chart.repo.ts` `flagSyncConflict`, `dental-chart-baseline.repo.ts` `mergeVisitChart` (returns conflicts), `core/database.schema.ts` (`syncStatus`/`conflictPayload`).
- *Net-new:* read + resolve TypeSpec ops/handlers; all FE surfaces.

### P0-B — Structured chart export

**Why:** Genuinely missing; clear records / referral / legal value; low architectural risk;
a clean precedent already exists.

**Scope:** Structured (not screenshot) export — patient/date/provider, odontogram + legend,
tooth/surface table, treatment-plan summary, proposed/completed/declined distinctions,
generated timestamp. Start HTML/print-ready if PDF generation isn't yet available.

**Build-on / net-new:**
- *Exists (precedent):* `specs/api/src/modules/dental-pmd.tsp` `exportPMD`, `dental-patient.tsp` `exportDentalPatients`.
- *Net-new:* chart export op/handler (or FE print route) + FE export entry point.

### P0-C — Condition-vocabulary enrichment + finding→treatment

**Why:** Genuine clinical-credibility gap. Keep `state` as the high-level visual layer; add a
curated `conditionCode` findings vocabulary so common diagnoses don't collapse into generic
notes, and let a finding convert to / link to a treatment.

**Scope:** curated v1 findings (e.g. abscess, calculus, recession, impacted/unerupted,
retained root, sensitivity, wear) grouped in a picker; `other` requires a note; finding can be
tooth- or surface-level; convert/link to treatment; inactive/resolved findings don't render as
active. **Needs a product decision on the curated list** before implementation.

**Build-on / net-new:**
- *Exists:* `tooth-overview-step.tsx` `TOOTH_STATES`; `dental-visit.tsp` `conditionCode` (free string) + `ChartEntryClassification` (`condition` value).
- *Net-new:* constrained `ConditionCode` vocabulary, picker UI, finding→treatment linkage (no standalone finding table exists today — decide whether to extend `entryClassification:'condition'` chart entries or add a table).

### P0-D — Selected-tooth-aware bottom panel + "why visible" explanation

**Why:** Lowest-risk UX polish on top of the already-shipped legend/toggles. Also guards
against our known **"summary computed from a different source than the rendered body"** bug
class — every visible badge/count must be explained by rendered rows.

**Scope:** selecting a tooth filters the bottom panel to that tooth's conditions/treatments/
history/conflicts; the slideout explains *why* the tooth shows its color/layer; counts match
rendered rows.

**Build-on / net-new:**
- *Exists:* `apps/dentalemon/src/routes/_workspace/$patientId.tsx`, `treatment-table.tsx` (currently filters by completion status only).
- *Net-new:* `toothNumber` filtering + a visible-state explanation component.

### P1 / P2 (fold from the guide at original priority, minus done work)

- **P1:** multi-select + batch actions; surface presets (O/MO/DO/MOD/B/L/cervical); perio triplet entry; per-site/calculus capture; perio export; chart view presets; simple RCT/sealant/implant detail markers; tooth-image attachment indicator (if imaging module ready); chronological tooth-history timeline (enhancement over the existing breakdown).
- **P2:** bridge/pontic/connector editor; prosthesis grouping; implant metadata; MGJ/attached gingiva; perio trend heatmap; chart timeline slider; referral packet export; audit mode (deleted/changed records).
- **💤 Later (explicit non-goals):** AI auto-diagnosis/auto-charting, AI ceph/imaging tracing as core dependency, voice-first charting as a required workflow, replacing FDI canonical storage, freehand drawing as the primary clinical record.

---

## 5. Invariants & Guardrails (non-negotiable for every slice)

- **FDI is canonical** in API/data; Universal/Palmer are display-only.
- **Baseline immutability** — CHART-BR-002: `existing`/`existing_other` teeth are locked against non-baseline overwrites.
- **Layer precedence** — completed > proposed > declined; a treated tooth never shows pending.
- **Offline semantics** — preserve per-tooth Lamport `clock`, `localId` idempotency, and conflict persistence; **never silently drop a stale write**.
- **Conflict resolution** creates a new change with a new clock; never mutates history.
- **Never hand-edit generated files** (OpenAPI/SDK/validators). TypeSpec → codegen → implement.
- **Contract tests go through real HTTP** — do not mount raw handlers and skip the generated validator (this has hidden FE↔BE drift before).
- **Perio per-site writes must merge, never full-row replace** (prior data-loss bug).
- **Drizzle numeric columns return strings** — coerce to `Number` (perio summary math).
- **Vertical TDD** — one slice end-to-end: TypeSpec → codegen → backend tests (RED) → backend (GREEN) → contract → frontend tests (RED) → frontend (GREEN) → E2E → verify gate.

---

## 6. References

- Research guide: [`docs/context/DENTALEMON_V1_DENTAL_CHARTING_RESEARCH_GUIDE.md`](../../context/DENTALEMON_V1_DENTAL_CHARTING_RESEARCH_GUIDE.md)
- Conflict persistence (P0-A): `services/api-ts/src/handlers/dental-visit/repos/dental-chart.repo.ts`, `dental-chart-baseline.repo.ts`, `services/api-ts/src/core/database.schema.ts`
- Export precedent (P0-B): `specs/api/src/modules/dental-pmd.tsp`, `specs/api/src/modules/dental-patient.tsp`
- Vocabulary (P0-C): `apps/dentalemon/src/features/workspace/components/tooth-overview-step.tsx`, `specs/api/src/modules/dental-visit.tsp`
- Bottom panel (P0-D): `apps/dentalemon/src/routes/_workspace/$patientId.tsx`, `apps/dentalemon/src/features/workspace/components/treatment-table.tsx`
