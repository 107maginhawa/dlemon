# Dentalemon v1 — Dental Charting Thoroughness & UI/UX Research Guide

**Date:** 2026-06-10  
**Intended use:** Share this Markdown file with the AI agent working inside the existing Dentalemon v1 repo.  
**Scope:** Research-backed product, UX, domain-model, and Vertical TDD guidance for improving the Dentalemon dental charting module.  
**Status:** Research/spec guidance only. Do not treat this as an implementation patch.

---

## 0. How to Use This File With the AI Agent

Use this as a **product-and-implementation reference** before asking the AI agent to change code.

Recommended agent instruction:

```md
Read this file first as the authoritative research reference for Dentalemon v1 dental charting improvements.

Do not implement everything at once.

First, inventory the existing code/UI against the checklist and mark each item as:
- Present
- Partial
- Missing
- Needs verification
- Deferred

Then propose the smallest safe vertical TDD slice from the P0 roadmap.

Respect all Dentalemon repo rules:
- Bun, not Node.
- TypeSpec/OpenAPI is the API source of truth.
- Never hand-edit generated files.
- Use Vertical TDD: TypeSpec → codegen → backend tests → backend implementation → contract tests → frontend tests → frontend implementation → E2E → verification gate.
- Preserve FDI canonical numbering.
- Preserve living-document chart semantics.
- Preserve baseline immutability.
- Preserve chart layer precedence: completed > proposed > declined.
- Preserve local-first/offline clock and conflict semantics.
```

---

## 1. Executive Summary

Dentalemon already has a strong charting foundation: FDI canonical tooth numbering, permanent/primary dentition handling, surfaces, a living-document odontogram with baseline/proposed/completed/declined/carried-over layers, treatment-plan linkage, perio charting, history endpoints, and offline/local-first constraints.

The biggest opportunity is not merely “adding more dental features.” The real opportunity is to make the chart feel **clinically complete, fast chairside, visibly trustworthy, and implementation-safe**.

Public documentation from mature dental systems shows recurring best-practice patterns:

1. The odontogram should be a **visual clinical record**, not just a tooth-state board.
2. Treatment status, existing work, planned work, referred work, completed work, and conditions should remain visually distinct.
3. Dentists need fast **single-tooth, multi-tooth, surface-level, quadrant, and arch workflows**.
4. Perio charting should optimize repetitive data entry with auto-advance, comparison to prior exams, summary metrics, and visible inflammation markers.
5. A selected tooth should filter the lower panel/progress-note area so the dentist can immediately explain “why this tooth looks this way.”
6. History and auditability are critical because the chart is part of the clinical/legal record.
7. Color alone is not enough; use color plus shape, hatching, labels, icons, and accessible contrast.

### Must-have for clinically credible v1

These should be prioritized before advanced features:

| Priority | Recommendation | Why it matters |
|---|---|---|
| P0 | Verify and improve **per-surface condition UI** | Data model already supports surfaceConditionMap; dentists expect surface-level caries/restoration detail. |
| P0 | Add a practical **condition vocabulary** | “Caries/watch/fracture/missing” is not enough for credible daily charting. |
| P0 | Make chart layers obvious with **legend, toggles, and selected-tooth explanation** | Clinicians must understand baseline vs proposed vs completed vs declined at a glance. |
| P0 | Surface **tooth history/timeline** in the UI | Backend history exists; it must be visible to users for trust and audit. |
| P0 | Add **offline conflict visibility** | Backend conflict persistence is not enough if the clinician cannot see or resolve it. |
| P0 | Add **full-chart print/export** | Clinical records often need printable/exportable output. |
| P0 | Strengthen **perio comparison and data-entry speed** | Perio is repetitive; workflow speed matters as much as correctness. |

### Strongly recommended for better UX

| Priority | Recommendation | Why it matters |
|---|---|---|
| P1 | Multi-select and batch actions | Mature systems support selecting multiple teeth or ranges for the same condition/procedure. |
| P1 | Surface labels on hover/tap/long-press | Helps dentists chart quickly and reduces surface-selection errors. |
| P1 | Quick action palette in tooth slideout | Common actions should be one or two taps away. |
| P1 | Visual symbols for endo/implant/prostho/restorative detail | Crowns, bridges, pontics, implants, root canals, sealants, and surface restorations are common chart expectations. |
| P1 | Selected-tooth bottom panel filter | Makes the chart explain itself and reduces context switching. |
| P1 | Chart view presets | Dentists may want all layers, active plan only, completed history only, perio overlay, etc. |

### Advanced / later

| Priority | Recommendation | Reason to defer |
|---|---|---|
| P2 | Detailed prosthesis grouping and bridge connector editor | Valuable but more complex than P0 condition/surface work. |
| P2 | Detailed implant metadata | Useful for specialists; not always needed for small-clinic v1. |
| P2 | Advanced perio staging wizard | Dentalemon already implements AAP/EFP staging/grading; improve UI after data-entry fundamentals. |
| Later | Voice-first charting | Product direction says no AI/voice dependency; can remain optional affordance. |
| Later | AI diagnosis/tracing | Explicit non-goal. Do not build as core charting dependency. |
| Later | Freehand drawing as primary charting model | Can help annotations but should not replace structured data. |

---

## 2. Current Dentalemon Baseline

Based on the provided Dentalemon context file, Dentalemon already appears to support the following. Items marked **Needs verification** should be checked against the live app and code before implementation.

### 2.1 Architecture baseline

- Monorepo on Bun.
- PostgreSQL + Drizzle ORM.
- Hono API.
- TypeSpec → OpenAPI codegen.
- React 19 + TanStack Router/Query.
- Better-Auth.
- Zustand.
- shadcn/ui + Tailwind.
- Generated SDK consumed by frontend.
- Frontend product work primarily in `apps/dentalemon/`.
- API work in `services/api-ts/`.
- TypeSpec source in `specs/api/src/modules/*.tsp`.

### 2.2 Dental chart domain baseline

Dentalemon’s chart is modeled as a **living document**:

- A patient-level baseline carries forward across visits.
- FDI is canonical everywhere in API/data.
- Universal and Palmer are display-only.
- Permanent and primary dentition are recognized.
- Mixed dentition is considered for children around ages 6–11.
- Tooth states include:
  - healthy
  - caries
  - fractured
  - filled
  - crown
  - missing
  - implant
  - extracted
  - watchlist
- Surfaces include:
  - mesial
  - distal
  - buccal
  - lingual
  - occlusal
  - incisal
  - cervical
- Per-surface state is supported by `surfaceConditionMap`.
- Chart layers:
  - baseline
  - proposed
  - completed
  - declined
  - carried-over
- Clinical precedence:
  - completed > proposed > declined
- Entry classification:
  - existing
  - existing_other
  - treatment_plan
  - condition

### 2.3 Perio baseline

Dentalemon’s perio chart appears more advanced than a basic v1:

- One perio chart per visit.
- Status flow: draft → completed → locked.
- Auto-lock on visit lock.
- Six sites per tooth:
  - buccal mesial / center / distal
  - lingual mesial / center / distal
- Per-site:
  - probing depth
  - bleeding on probing
  - gingival margin
- Per-tooth:
  - recession
  - mobility
  - furcation
  - plaque
  - suppuration
- Derived:
  - CAL = probing depth + gingival margin
- Summary:
  - BOP%
  - mean depth
  - deep-pocket count
- AAP/EFP 2017 staging/grading implemented and tested.

### 2.4 Offline/local-first baseline

Dentalemon has important offline constraints:

- Local-first/offline-capable.
- Tooth carries optional Lamport-style `clock`.
- Higher clock wins in baseline merge.
- Lower incoming clock is a stale offline write and should be rejected.
- Rejected stale writes are persisted as sync conflicts.
- Chart/treatment creates can accept optional client `localId`.

### 2.5 Known charting gaps to verify

These are not yet confirmed as current missing items. The coding agent must verify before implementing:

- Whether tooth edit UI fully exposes `surfaceConditionMap`.
- Whether richer condition vocabulary exists in code/UI.
- Whether odontogram visualizes mobility/furcation or keeps them only in perio.
- Whether chart history/timeline is surfaced meaningfully.
- Whether full-chart PDF/print export exists.
- Whether multi-exam perio comparison is complete enough.
- Whether full-chart `upsertDentalChart` has the same clock-gating as per-tooth PATCH.
- Whether frontend conflict-resolution UI exists.

---

## 3. Research Source Summary

The following public sources were used to extract patterns. Do not copy proprietary UI; use them only to infer workflow expectations and best practices.

| Source | What it contributed | URL |
|---|---|---|
| Open Dental — Graphical Tooth Chart | Tooth selection, multi-select via drag, planned/performed/referred visual chart, historical slider | https://www.opendental.com/manual/graphicaltoothchart.html |
| Open Dental — Enter Treatment | Treatment statuses, diagnosis as procedure-attached or separate condition, multi-tooth/range/quadrant/arch workflow | https://opendental.com/manual/entertreatment.html |
| Open Dental — Show Chart Views | View filters, selected-teeth filtering, audit mode, treatment-plan view inside chart | https://www.opendental.com/manual/showtabchart.html |
| Open Dental — Perio Chart | Perio data rows, prior exam comparison, plaque/calculus/BOP/suppuration markers, CAL, MGJ, auto-advance, triplets | https://www.opendental.com/manual/perio.html |
| Dentrix Ascend — Charting Symbols | Condition/procedure symbol vocabulary and status-based coloring | https://hsps.pro/DentrixAscend/Help/Charting_symbols.htm |
| Dentrix Ascend Academy — Charting Pages Overview | Chairside suite pattern: chart, progress notes, perio, treatment planner, imaging | https://learn.dentrixascend.com/courses/clinical-essentials-for-teams/lessons/charting/topic/charting-pages-overview/ |
| Curve Dental — Charting Module Overview | Odontogram with treatment plan, status colors, surface labels, tooth labels, condition drawing, tooth-image attachment, printing | https://curvedental.zendesk.com/hc/en-us/articles/50456380721555-Charting-Module-Overview |
| CareStack — Odontogram Guide | Configurable statuses/colors/transparency, multiple treatment/condition layers on one tooth, active/inactive conditions, treatment-plan actions | https://carestack-aus.zendesk.com/hc/en-au/articles/22988791794194-A-Guide-to-the-Odontogram-Charting |
| CareStack — Periodontal Charting | Perio monitoring over time, pocket depth/recession/bleeding and patient explanation | https://carestack.com/dental-software/features/periodontal-charting |
| AAP — 2017 Classification | Multidimensional staging/grading framework for periodontitis and peri-implant conditions | https://www.perio.org/research-science/2017-classification-of-periodontal-and-peri-implant-diseases-and-conditions/ |
| NCBI Bookshelf — Periodontal Disease | Clinical significance of probing depths and periodontal evaluation | https://www.ncbi.nlm.nih.gov/books/NBK554590/ |
| W3C WCAG 2.2 Target Size | Minimum pointer target size and spacing guidance | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html |
| W3C WCAG Non-text Contrast | Non-text UI/graphic contrast and color-use guidance | https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html |
| Apple HIG Buttons | iPad/iOS hit region guidance for touch targets | https://developer.apple.com/design/human-interface-guidelines/buttons |
| Material Design Touch Targets | 7–10 mm recommended touch target size | https://m3.material.io/foundations/designing/structure |

---

## 4. Dental Charting Best-Practice Checklist

Legend:

- **Present** — likely already supported from Dentalemon context.
- **Partial** — supported in model or backend but unclear/incomplete in UI.
- **Missing** — likely absent or not described.
- **Needs verification** — must inspect code/live UI.
- **P0** — needed for credible v1.
- **P1** — strongly recommended.
- **P2** — advanced but valuable.
- **Later** — defer.

### 4.1 Odontogram and tooth chart

| Item | Why it matters clinically | Expected user behavior | Dentalemon status | Complexity | Priority |
|---|---|---|---|---|---|
| FDI canonical numbering | Reduces ambiguity internationally and aligns with current data model | Store FDI; display FDI/Universal/Palmer as preference | Present | Low | P0 keep |
| Universal/Palmer display modes | Dentists may be trained on different systems | Toggle display without changing API payload | Present/Needs verification | Low | P1 |
| Permanent/primary/mixed dentition | Pediatric/transitional care needs both primary and erupting permanent teeth | Show correct tooth set from age/DOB and allow clinician override | Partial | Medium | P1 |
| Visual tooth states | Immediate clinical recognition | Tooth color/icon/shape reflects state | Present | Medium | P0 keep |
| Layered chart rendering | Separates baseline, planned, completed, declined | Toggle layers and see precedence | Partial | Medium | P0 |
| Carried-over proposed marker | Prevents old treatment plans from looking newly diagnosed | Tooth marker/badge for prior-visit proposed treatment | Present/Needs UI verification | Medium | P0 |
| Selected-tooth explanation | Clinician must understand why a tooth is colored | Tap tooth → side panel/bottom rows explain visible state | Partial | Medium | P0 |
| Multi-tooth selection | Common for perio/restorative/treatment-plan speed | Tap multiple teeth or drag/lasso; batch-apply action | Needs verification | Medium | P1 |
| Tooth-range/quadrant/arch actions | Some procedures apply beyond a single tooth | Select tooth/range/quadrant/arch and assign procedure | Missing/Needs verification | Medium | P1 |
| Tooth history from chart | Builds trust and auditability | Tap tooth → timeline/diff/history | Backend present, UI needs verification | Medium | P0 |
| Chart timeline/history slider | Mature systems show chart over time | Slider/date selector changes chart state | Missing/Needs verification | High | P2 |
| Print/export chart | Clinical/legal record, referrals, patient communication | Export full chart and selected tooth/treatment plan | Missing/Needs verification | Medium | P0 |

### 4.2 Surface-level charting

| Item | Why it matters clinically | Expected user behavior | Dentalemon status | Complexity | Priority |
|---|---|---|---|---|---|
| Surface selection | Many findings/procedures are surface-specific | Tap/select surfaces from tooth diagram | Partial | Medium | P0 |
| Per-surface condition map | One tooth may have different conditions per surface | Assign condition per surface without overwriting whole tooth | Model present, UI uncertain | Medium | P0 |
| Surface labels | Reduces errors on touch devices | Hover/long-press/tap shows M/D/B/L/O/I/C labels | Needs verification | Low | P1 |
| Surface-specific summary | Clinician needs to review exact surfaces | Side panel lists surfaces and condition/procedure per surface | Missing/Needs verification | Medium | P0 |
| Surface rendering precedence | Completed restoration should not look pending | Helper resolves per-surface visual state by layer/status | Partial | Medium | P0 |
| Surface bulk apply | Fast charting for multi-surface restorations | Select MOD, MO, DO, etc. as preset | Missing/Needs verification | Medium | P1 |

### 4.3 Findings and diagnosis vocabulary

| Item | Why it matters clinically | Expected user behavior | Dentalemon status | Complexity | Priority |
|---|---|---|---|---|---|
| Caries | Core dental finding | Mark tooth/surface caries with severity/status | Present/basic | Medium | P0 |
| Watch/monitor | Avoids over-treatment; supports follow-up | Mark watch with reason and review date | Present/basic | Medium | P0 |
| Fracture/crack | Common urgent/restorative issue | Chart tooth or cusp/surface fracture | Present/basic | Medium | P0 |
| Abscess | Important diagnosis/referral indicator | Add condition and link plan/procedure | Missing | Medium | P1 |
| Calculus | Common hygiene/perio finding | Mark tooth/region/calculus indicator | Perio partial, odontogram missing | Medium | P1 |
| Gingival recession | Common periodontal finding | Chart as perio/condition and optionally surface marker | Perio partial | Medium | P1 |
| Impacted/unerupted | Pediatric/ortho/oral surgery relevance | Mark unerupted/impacted tooth | Missing | Medium | P1 |
| Retained root | Extraction/prostho planning | Mark retained root symbol/condition | Missing | Medium | P1 |
| Open contact | Restorative/food trap issue | Mark contact-related condition | Missing | Low | P2 |
| Sensitive dentin | Conservative/monitoring treatment | Mark condition and plan fluoride/desensitizer | Missing | Low | P2 |
| ICD-10 link | Diagnosis coding and structured record | Optional diagnosis field per finding/treatment | Partial/Needs verification | Medium | P1 |
| CDT linkage | Converts finding to planned procedure | Finding can create or link treatment code | Partial | Medium | P0 |

### 4.4 Treatment planning

| Item | Why it matters clinically | Expected user behavior | Dentalemon status | Complexity | Priority |
|---|---|---|---|---|---|
| Finding → treatment-plan conversion | Dentist records diagnosis then proposes treatment | From condition, click “Create treatment” | Partial | Medium | P0 |
| Treatment phases | Supports sequencing | Phase: systemic → disease_control → re_evaluation → definitive → maintenance | Present | Medium | P0 keep |
| Treatment priority | Supports urgency | Assign priority and sort plan | Present | Low | P0 keep |
| Accepted/declined alternatives | Informed consent and planning | Mark option accepted/declined; preserve declined record | Partial | Medium | P1 |
| Alternative option groups | Compare treatment options | Link mutually exclusive options | Present/Needs UI verification | Medium | P1 |
| Referred treatment | Common for specialty referral | Mark referred/referred completed | Missing/Needs verification | Medium | P1 |
| Appointment linkage | Treatment plan should connect to scheduling | Link procedure to appointment | Missing/Needs verification | High | P2 |
| Fee estimate visibility | Patient plan communication | Optional show/hide fees in plan context | Partial | Medium | P1 |

### 4.5 Restorative, prosthodontic, endodontic, implant detail

| Item | Why it matters clinically | Expected user behavior | Dentalemon status | Complexity | Priority |
|---|---|---|---|---|---|
| Filled/surface restoration | Common existing/completed work | Mark surfaces restored | Present/basic | Medium | P0 |
| Crown | Common tooth-level restoration | Mark full crown, status by layer | Present/basic | Low | P0 |
| Sealant | Common preventive/restorative charting | Mark occlusal sealant | Missing | Low | P1 |
| Root canal | Major endodontic status | Mark RCT symbol/condition/procedure | Missing/Needs verification | Medium | P1 |
| Implant | Tooth replacement and maintenance relevance | Mark implant and details | Present/basic | Medium | P1 |
| Bridge connector | Prosthodontic clarity | Mark bridge spans, abutments, pontics | Missing | High | P2 |
| Pontic | Prosthodontic record | Mark missing tooth replaced by pontic | Missing | High | P2 |
| Denture/partial | Treatment planning and patient record | Mark prosthesis at arch/tooth range level | Missing | High | P2 |
| Apicoectomy/post/pins | Specialist/endodontic detail | Chart as procedure symbols | Missing | Medium | P2 |

### 4.6 Perio charting

| Item | Why it matters clinically | Expected user behavior | Dentalemon status | Complexity | Priority |
|---|---|---|---|---|---|
| Six-site probing | Standard perio data capture | Enter MB/B/DB and ML/L/DL | Present | Medium | P0 keep |
| Bleeding on probing | Disease activity indicator | Toggle per site | Present | Medium | P0 keep |
| Gingival margin | Needed for CAL | Enter mm value; support positive/negative | Present | Medium | P0 keep |
| CAL auto-calculation | Saves time, reduces error | Read-only derived value | Present | Low | P0 keep |
| Plaque | Hygiene tracking | Toggle per tooth/site | Present per-tooth; per-site deferred | Medium | P1 |
| Calculus | Hygiene/scaling relevance | Toggle per tooth/site | Missing/deferred | Medium | P1 |
| Suppuration | Disease marker | Toggle per tooth/site | Present per-tooth | Medium | P1 |
| Furcation | Periodontal severity | Enter 0–3 | Present | Low | P0 keep |
| Mobility | Periodontal/prostho prognosis | Enter 0–3 | Present | Low | P0 keep |
| MGJ/attached gingiva | Mucogingival assessment | Enter MGJ/attached gingiva where needed | Missing/deferred | Medium | P2 |
| Perio exam comparison | Monitor progression | Compare current against prior exams | Partial/Needs verification | Medium | P0/P1 |
| Auto-advance data entry | Perio speed | After value entry, move to next site | Missing/Needs verification | Medium | P1 |
| Triplet entry | Common fast entry pattern | Enter 3 site values at once | Missing | Medium | P1 |
| Perio print/export | Clinical record/referral | Export full perio chart | Missing/Needs verification | Medium | P1 |

### 4.7 History, audit, and offline

| Item | Why it matters clinically | Expected user behavior | Dentalemon status | Complexity | Priority |
|---|---|---|---|---|---|
| Tooth history timeline | Trust and audit | View all entries for selected tooth | Backend present; UI uncertain | Medium | P0 |
| Cross-visit chart diff | Understand changes | Compare current visit with previous/baseline | Missing/Needs verification | High | P1 |
| Deleted/changed audit mode | Legal and safety | Authorized users see changed/deleted records | Missing/Needs verification | High | P2 |
| Offline conflict marker | Prevent silent chart inconsistency | Tooth/bottom banner shows conflict | Backend partial; FE missing | Medium | P0 |
| Conflict resolution UI | Restore/accept/retry clinician intent | Side panel shows local vs server value | Missing | High | P1 |
| Idempotent offline replay | Prevent duplicate records | Use localId safely | Present/partial | Medium | P0 keep |
| Clock-gated full upsert | Prevent stale full-chart overwrite | Reject stale tooth writes consistently | Known tail item | Medium | P0 |

---

## 5. UI/UX Pattern Analysis From Mature Systems

### Pattern 1 — Odontogram + treatment/progress grid in one workspace

**Observed pattern:** Open Dental, Curve, CareStack, and Dentrix-like systems keep the tooth chart, treatment/progress/history, and related clinical actions close together.

**Why it works:** The dentist can answer three questions without leaving the screen:

1. What is visible on the tooth?
2. Why is it visible?
3. What action should happen next?

**Risk if implemented poorly:** If the chart color is computed from one data source and the bottom rows from another, the screen becomes untrustworthy. Dentalemon already has a known class of bugs where summaries were computed from different data than the rendered body.

**Dentalemon adaptation:**

- Keep current chart canvas + right slideout + bottom panel model.
- Make the bottom panel selected-tooth aware.
- When tooth 16 is selected, bottom panel should show:
  - active conditions
  - proposed treatments
  - completed treatments
  - declined treatments
  - baseline/existing entries
  - carried-over records
  - conflicts
  - notes/history
- Add test assertions that every visible badge/count can be explained by the rendered row data.

---

### Pattern 2 — Multi-select and batch entry

**Observed pattern:** Open Dental supports selecting teeth by clicking/tooth number and dragging to select multiple teeth. It also supports procedure assignment to tooth, tooth range, quadrant, and arch.

**Why it works:** Dental charting is repetitive. Multi-select prevents a slow one-tooth-at-a-time workflow.

**Risk if implemented poorly:** Batch actions can accidentally overwrite specific per-surface entries or apply tooth-level states where surface-level details are needed.

**Dentalemon adaptation:**

- Add explicit selection mode:
  - single tap selects tooth
  - multi-select toggle or long-press starts batch mode
  - drag/lasso optional later
- Batch action must preview affected teeth before save.
- Batch action must never overwrite `surfaceConditionMap` unless user explicitly chooses “replace surface entries.”
- Must respect FDI canonical tooth numbers in payloads.

---

### Pattern 3 — Status/layer color with visual redundancy

**Observed pattern:** Mature systems use status colors: planned, completed, existing/external, referred, conditions. CareStack also exposes configurable colors/transparency and allows multiple layers on one tooth.

**Why it works:** Clinicians can quickly distinguish existing work, planned work, completed work, and conditions.

**Risk if implemented poorly:** Color-only distinctions are inaccessible and can be clinically dangerous. Too many colors without legend also increases cognitive load.

**Dentalemon adaptation:**

Use color plus redundant visual encodings:

| Dentalemon layer/status | Suggested visual treatment |
|---|---|
| baseline / existing | solid neutral or blue-tinted existing marker |
| existing_other | same as baseline with small external-source badge |
| proposed | warm outline or planned badge |
| completed | solid filled treatment marker |
| declined | hatch/desaturated overlay |
| carried-over | small clock/arrow badge |
| conflict | warning outline/badge independent of clinical status |
| inactive/resolved condition | hidden from main chart by default but visible in history/timeline |

Add a persistent legend near the chart and a “Why am I seeing this?” explanation in the tooth slideout.

---

### Pattern 4 — Surface labels and surface-specific visual states

**Observed pattern:** Curve exposes tooth surface labels on hover and allows showing/hiding labels. CareStack notes additional surfaces for molars/premolars for surface-level treatments.

**Why it works:** Surface labels help prevent wrong-surface entry, especially on tablets.

**Risk if implemented poorly:** Always-on labels can clutter the tooth chart; tiny surface targets can be hard to tap.

**Dentalemon adaptation:**

- Desktop: surface labels on hover/focus.
- iPad/touch: surface labels on tap/long-press or when tooth is active in slideout.
- Tooth slideout should include a larger “surface selector” control with 44 pt+ hit regions.
- Chart canvas itself can remain visually compact; precision entry should happen in the enlarged slideout control.

---

### Pattern 5 — Perio chart optimized for repetitive entry

**Observed pattern:** Open Dental supports prior exam comparison, copy/default exams, auto-advance sequence, triplet entry, and rows for probing, plaque, calculus, bleeding, suppuration, mobility, furcation, CAL, gingival margin, and MGJ.

**Why it works:** Perio charting can require hundreds of values. Data entry speed, keyboard/touch flow, and comparison matter.

**Risk if implemented poorly:** Per-site updates can accidentally null other sites. Dentalemon already had a past bug where per-site perio upsert replaced the full row.

**Dentalemon adaptation:**

- Keep per-site merge semantics.
- Add/verify auto-advance.
- Add/verify triplet entry.
- Add current vs previous exam row/overlay.
- Add warning if a chart is incomplete before completion.
- Preserve current summary: BOP%, mean depth, deep-pocket count.
- Keep AAP/EFP staging/grading read-only/derived unless user overrides with reason.

---

### Pattern 6 — Tooth-level history and inactive/resolved conditions

**Observed pattern:** CareStack displays active and inactive conditions and keeps inactive condition history. Open Dental exposes chart view filters, selected-tooth filtering, audit mode, and historical chart changes.

**Why it works:** Dentists need to know whether a visible finding is new, existing, treated, declined, or no longer active.

**Risk if implemented poorly:** Old conditions can clutter current chart, while hiding them completely creates audit and trust problems.

**Dentalemon adaptation:**

- Main chart shows active/current clinical state.
- Tooth slideout shows history:
  - Active
  - Planned
  - Completed
  - Declined
  - Inactive/resolved
  - Conflicted
- Add “Show inactive conditions” toggle in history, not main chart by default.
- Use backend `getToothHistory` endpoint or extend it if it lacks diff/event metadata.

---

### Pattern 7 — Print/export as clinical record, not screenshot

**Observed pattern:** Curve’s public docs mention printing the odontogram via screenshot; mature clinical systems often print charts/progress notes/treatment plans. Open Dental supports printing progress notes from filtered date views.

**Why it works:** Dentists need chart output for referrals, patient communication, audits, insurance support, and legal records.

**Risk if implemented poorly:** A screenshot export is not a structured clinical record and may omit details like surfaces, status, dates, provider, or notes.

**Dentalemon adaptation:**

Prioritize a structured clinical export:

- patient identifiers
- date/time
- dentist/provider
- selected numbering display mode
- odontogram image
- layer legend
- tooth/surface table
- treatment plan summary
- completed/declined/proposed status
- perio summary if included
- audit footer / generated-by metadata

---

## 6. Recommended Dentalemon v1 Chart UX Model

This section describes the target UX in practical terms.

### 6.1 Overall layout

Recommended chart workspace layout:

```txt
┌──────────────────────────────────────────────────────────────────────────┐
│ Patient header: Name, age, DOB, allergies/alerts, active visit, status   │
├──────────────────────────────────────────────────────────────────────────┤
│ Chart toolbar: Numbering | Dentition | Layers | Legend | Export | Sync   │
├───────────────────────────────────────────────┬──────────────────────────┤
│                                               │ Right tooth slideout     │
│ Odontogram canvas                             │                          │
│ - upper/lower arches                          │ Selected tooth/teeth     │
│ - layer/status visual states                  │ Conditions               │
│ - conflict markers                            │ Surfaces                 │
│ - carried-over badges                         │ Treatments               │
│ - optional perio overlay markers              │ History                  │
│                                               │ Conflicts                │
├───────────────────────────────────────────────┴──────────────────────────┤
│ Bottom panel: Selected tooth details / treatment plan / progress/history │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Chart toolbar

Toolbar controls:

1. **Numbering**
   - FDI
   - Universal
   - Palmer
   - Display-only. API remains FDI.

2. **Dentition**
   - Auto by DOB
   - Permanent
   - Primary
   - Mixed
   - Override requires reason if patient age conflicts.

3. **Layers**
   - Baseline
   - Proposed
   - Completed
   - Declined
   - Carried-over
   - Conflicts
   - Perio indicators

4. **Legend**
   - Persistent or one-tap popover.
   - Must show color + symbol/hatch meaning.

5. **Mode**
   - Chart
   - Treatment Plan
   - Perio
   - History
   - Export

6. **Sync/Offline**
   - Online/offline status.
   - Pending local writes.
   - Conflicts count.

### 6.3 Chart canvas behavior

Default behavior:

- Tap/click tooth:
  - selects tooth
  - opens/updates slideout
  - filters bottom panel
- Tap selected tooth again:
  - either deselects or keeps active depending on user preference; make behavior explicit
- Long-press:
  - opens quick actions
- Shift/cmd click or multi-select toggle:
  - select multiple teeth
- Drag/lasso:
  - optional P1/P2 enhancement
- Surface hover:
  - show surface label on desktop
- Surface tap:
  - opens enlarged surface selector in slideout

### 6.4 Right tooth slideout

The slideout should become the primary structured editing surface.

Suggested tabs:

1. **Summary**
   - Tooth number in selected display mode + FDI canonical
   - Current visible state
   - Why it is visible:
     - baseline
     - proposed
     - completed
     - declined
     - carried-over
     - conflict
   - quick actions:
     - Add condition
     - Add treatment
     - Mark existing
     - View history
     - Resolve conflict

2. **Surfaces**
   - Enlarged surface selector.
   - Surface list:
     - M, D, B, L, O/I, C
   - Each surface can show:
     - condition
     - treatment
     - status/layer
     - notes
   - Presets:
     - O
     - MO
     - DO
     - MOD
     - B/F
     - L
     - cervical/class V

3. **Conditions**
   - Active conditions
   - Watchlist
   - Inactive/resolved conditions
   - Add condition form:
     - condition type
     - tooth/surfaces
     - severity optional
     - note
     - diagnosis code optional
     - convert/link to treatment

4. **Treatments**
   - Proposed/planned
   - Completed/verified
   - Declined
   - Referred
   - Alternatives
   - phase/priority
   - CDT code
   - price estimate if allowed

5. **History**
   - cross-visit timeline
   - baseline changes
   - proposed/completed transitions
   - previous values
   - provider/date
   - show inactive/resolved

6. **Conflicts**
   - visible only if conflicts exist
   - server value
   - local attempted value
   - timestamps/clocks
   - actions:
     - keep server
     - reapply local as new change
     - manually edit
     - dismiss only if resolved

### 6.5 Bottom panel

The bottom panel should avoid being a passive dump. It should explain the active context.

Recommended tabs:

- **Selected tooth**
- **Treatment plan**
- **Progress/history**
- **Perio**
- **Conflicts**
- **Notes/documents**

For selected tooth:

| Column | Purpose |
|---|---|
| Date | When entry happened |
| Type | condition/treatment/baseline/conflict |
| Tooth/surface | FDI and display label |
| Status/layer | proposed/completed/declined/etc. |
| Description | readable clinical description |
| Code | CDT/diagnosis if available |
| Provider | who entered/updated |
| Source visit | useful for carried-over |
| Actions | edit/convert/resolve/view |

### 6.6 Perio workspace

Keep perio as a separate subsystem but tightly accessible.

Recommended UX:

- Chart → Perio tab should not destroy odontogram context.
- Allow split view:
  - left: perio grid
  - right/bottom: summary and classification
- Current exam row should be visually distinct.
- Prior exam values should be visible but grayed or shown in comparison mode.
- Auto-advance settings:
  - maxillary first
  - facials first
  - custom
- Entry modes:
  - single value
  - triplet
  - drag-fill for same value
  - keyboard keypad
  - optional voice later
- Completion gate:
  - warn if required sites missing
  - show BOP%, mean depth, deep-pocket count
  - show stage/grade if enough data exists
  - allow draft save without forcing completion

### 6.7 Offline conflict UX

Offline conflicts must not be hidden in logs.

Minimum P0 UI:

- Global banner: “2 chart conflicts need review.”
- Tooth marker: warning badge on affected tooth.
- Bottom panel conflict tab.
- Slideout conflict detail.

Conflict row should show:

```txt
Tooth 16 / surface occlusal
Server value: completed filling, clock 11
Local attempted value: caries watch, clock 8
Reason: stale offline write
Action: Keep server | Reapply as new change | Edit manually
```

Important rule: resolving a conflict should create a new valid change with a new clock, not mutate historical facts silently.

### 6.8 Export/print entry point

Toolbar should have Export/Print.

P0 export options:

- Full odontogram clinical chart
- Selected tooth history
- Treatment plan summary
- Perio chart summary

P1/P2:

- Full perio chart
- Referral packet
- Patient-facing simplified plan
- Audit log export for authorized user

---

## 7. Clinical Data Model Gap Analysis

This section suggests possible data changes. The agent must verify existing TypeSpec/schema before adding fields.

### 7.1 Tooth states vs condition vocabulary

Current states appear too broad for clinically thorough charting. Keep `state` as high-level visual state, but introduce or verify a richer `conditionCode` vocabulary.

Recommended approach:

```ts
type ToothState =
  | "healthy"
  | "caries"
  | "fractured"
  | "filled"
  | "crown"
  | "missing"
  | "implant"
  | "extracted"
  | "watchlist";

type ConditionCode =
  | "caries"
  | "watch"
  | "fracture"
  | "abscess"
  | "calculus"
  | "gingival_recession"
  | "impacted"
  | "unerupted"
  | "retained_root"
  | "open_contact"
  | "sensitive_dentin"
  | "wear_attrition_abrasion_erosion"
  | "developmental_anomaly"
  | "other";
```

Guidance:

- Do **not** explode P0 into hundreds of codes.
- Start with a curated v1 vocabulary.
- Allow `other` with required note.
- Allow code-system mapping later:
  - CDT for procedures
  - ICD-10 for diagnosis if used
  - SNOMED later if interoperability requires

### 7.2 Per-surface condition map

Current model supports `surfaceConditionMap`. The key missing item is likely UI and validation depth.

Recommended shape if not already expressive enough:

```ts
surfaceConditionMap: {
  [surface in DentalSurface]?: {
    state?: ToothState;
    conditionCode?: ConditionCode;
    severity?: "mild" | "moderate" | "severe";
    status?: "active" | "inactive" | "resolved" | "watch";
    note?: string;
    clock?: number;
    localId?: string;
  }
}
```

P0 rule:

- Whole-tooth state and surface state must not overwrite each other accidentally.
- The renderer must support mixed states on the same tooth.
- Summary counts must be computed from the same resolved data rendered on screen.

### 7.3 Treatment-plan linkage from findings

A finding should be able to become or link to treatment.

Recommended relationship:

```ts
conditionFinding {
  id
  patientId
  visitId
  toothNumber
  surfaces[]
  conditionCode
  status: active | inactive | resolved | watch
  linkedTreatmentIds[]
  diagnosisCode?
  note?
  localId?
  clock?
}
```

If adding a new table is too large for v1, use existing treatment records with `entryClassification: "condition"` and add missing fields carefully.

P0 behavior:

- Add finding.
- From finding, create proposed treatment.
- When treatment is completed/verified, optionally mark finding resolved/inactive.
- Declined treatment should not erase the diagnosis/finding.

### 7.4 Prosthodontic annotations

Bridge/pontic/connector details are important but should be P2 unless the target users need prostho-heavy charting immediately.

Recommended future shape:

```ts
prosthesisGroup {
  id
  type: "bridge" | "partial_denture" | "full_denture" | "implant_bridge"
  toothNumbers: number[]
  abutmentToothNumbers?: number[]
  ponticToothNumbers?: number[]
  status: "existing" | "planned" | "completed" | "declined"
  source: "this_practice" | "other_practice" | "patient_reported"
}
```

### 7.5 Endodontic details

For P1, a simple root-canal marker may be enough.

Recommended future shape:

```ts
endoDetail {
  toothNumber
  status: "planned" | "completed" | "retreatment_needed" | "failed" | "unknown"
  canalsTreated?: number
  postCore?: boolean
  note?: string
}
```

### 7.6 Implant details

Current `implant` state may be enough for P0. P1/P2 can add metadata.

```ts
implantDetail {
  toothNumber
  status: "planned" | "placed" | "restored" | "failed" | "removed"
  implantSystem?: string
  abutment?: string
  crownStatus?: string
  maintenanceNotes?: string
}
```

### 7.7 Perio extensions

Dentalemon already has strong perio basics. Potential extensions:

| Extension | Priority | Notes |
|---|---|---|
| Calculus per site/tooth | P1 | Common in mature perio charts |
| Per-site plaque | P1/P2 | More detailed than current per-tooth plaque |
| MGJ | P2 | Open Dental supports MGJ; useful but not always v1 |
| Attached gingiva derived field | P2 | Derived from recession/MGJ depending model |
| Prior exam comparison | P0/P1 | More important than adding obscure fields |
| Export full perio chart | P1 | Valuable for referrals and records |

### 7.8 Conflict schema and UI

If conflicts are already persisted durably, the frontend needs a read surface.

Minimum API shape if missing:

```ts
chartConflict {
  id
  patientId
  visitId?
  toothNumber
  surfaces?
  fieldPath
  serverValue
  attemptedValue
  serverClock
  attemptedClock
  reason: "stale_clock" | "duplicate_local_id" | "merge_conflict"
  status: "open" | "resolved" | "dismissed"
  createdAt
  resolvedAt?
  resolvedBy?
}
```

P0 UI rule:

- Open conflicts must be visible from the chart.
- A conflict must have a clinician-safe resolution path.
- Dismiss should require a reason or be limited to non-clinical duplicates.

### 7.9 Export model

Avoid pure screenshot export.

Recommended export request model:

```ts
chartExportRequest {
  patientId
  visitId?
  format: "pdf" | "html" | "json"
  sections: [
    "odontogram",
    "selected_tooth_history",
    "treatment_plan",
    "perio_summary",
    "perio_full_chart",
    "audit_footer"
  ]
  numberingDisplay: "FDI" | "Universal" | "Palmer"
}
```

---

## 8. Gap Matrix

| Area | Current Dentalemon capability | Best-practice expectation | Gap | Recommendation | Priority | Suggested vertical slice |
|---|---|---|---|---|---|---|
| Per-surface charting | Model supports `surfaceConditionMap`; UI unclear | Surface-specific caries/restoration/condition entry and rendering | Likely UI gap | Build enlarged surface selector in tooth slideout | P0 | Slice 1 |
| Condition vocabulary | Basic tooth states and conditionCode | Broader practical findings list | Too limited for credible charting | Add curated v1 condition vocabulary | P0 | Slice 2 |
| Layer explanation | Layer model exists | User can see why a tooth is colored | Likely under-surfaced | Add legend + selected tooth explanation | P0 | Slice 3 |
| Tooth history | `getToothHistory` backend exists | Cross-visit visible timeline/diff | UI unclear | Add tooth history tab in slideout | P0 | Slice 4 |
| Offline conflicts | Backend conflict persistence exists | Clinician sees and resolves conflicts | FE missing | Add chart conflict marker/banner/detail | P0 | Slice 5 |
| Full upsert clock gate | Per-tooth PATCH clock-gated | All chart write paths reject stale clocks | Known tail item | Add stale guard to full-chart upsert | P0 | Slice 6 |
| Chart export | Unknown | Full chart PDF/print clinical record | Likely missing | Add structured export endpoint/UI | P0 | Slice 7 |
| Selected-tooth bottom panel | Bottom panel exists | Selected tooth filters rows/details | Unclear | Make bottom panel selected-tooth aware | P0/P1 | Slice 8 |
| Multi-select | Unknown | Apply same condition/treatment to multiple teeth | Likely missing/partial | Add explicit multi-select mode | P1 | Slice 9 |
| Perio comparison | Some trend view exists | Current vs historical values easy to compare | Verify coverage | Improve comparison UI before new fields | P0/P1 | Slice 10 |
| Perio speed | Perio grid exists | Auto-advance/triplets/keyboard/touch optimized | Likely gap | Add auto-advance and triplet entry | P1 | Slice 11 |
| Prostho symbols | crown/implant basic | Bridge, pontic, denture, connector symbols | Missing | Defer until core chart complete | P2 | Later |
| Endo detail | unknown/basic | Root canal/post/apicoectomy symbols | Missing | Add simple RCT marker after P0 | P1/P2 | Later |
| Imaging linkage | Route mentions imaging module elsewhere | Tooth-level image access in chart | Missing/unclear | Add tooth-image indicator only if imaging module ready | P2 | Later |

---

## 9. Implementation Roadmap

### P0 — Clinical credibility and charting correctness

#### P0.1 Verify and expose per-surface condition charting

**User value:** Dentists can chart accurate findings and restorations at surface level.

**Implementation scope:**

- Verify TypeSpec support for `surfaceConditionMap`.
- Verify backend persistence and merge behavior.
- Add/enhance tooth slideout surface selector.
- Update odontogram rendering for surface-level state.
- Ensure layer precedence still works per surface.

**Likely affected files:**

- `specs/api/src/modules/dental-visit.tsp`
- `services/api-ts/src/handlers/dental-visit/chart/updateTooth.ts`
- `services/api-ts/src/handlers/dental-visit/chart/upsertDentalChart.ts`
- `services/api-ts/src/handlers/dental-visit/repos/dental-chart.repo.ts`
- `apps/dentalemon/src/features/workspace/components/dental-chart.helpers.ts`
- `apps/dentalemon/src/features/workspace/lib/chart-layers.ts`
- `apps/dentalemon/src/features/workspace/components/dental/universal-tooth.tsx`
- `apps/dentalemon/src/features/workspace/components/tooth-slideout*`
- related hook tests and E2E tests

**Tests required:**

- helper tests for per-surface visual resolution
- backend tests for persistence and merge
- stale write tests with clocks
- contract tests through real HTTP
- frontend interaction tests
- E2E save/reload/render test

---

#### P0.2 Add curated v1 condition vocabulary

**User value:** The chart supports common clinical findings without becoming bloated.

**Implementation scope:**

- Add/verify `conditionCode` enum.
- Add UI condition picker grouped by:
  - common
  - restorative
  - perio/soft tissue
  - eruption/development
  - other
- Require note for `other`.
- Allow condition → treatment conversion.

**Tests required:**

- enum validation
- condition picker tests
- condition persistence tests
- conversion to treatment tests

---

#### P0.3 Add chart legend, layer toggles, and selected-tooth explanation

**User value:** Clinician can understand chart state instantly.

**Implementation scope:**

- Add legend component.
- Add layer toggle toolbar.
- Add “why visible” summary in slideout.
- Add selected-tooth bottom panel filter if missing.

**Tests required:**

- helper test: visible state explanation matches resolved layer
- frontend test: toggle layer hides/shows expected items
- E2E: completed tooth does not show as pending

---

#### P0.4 Surface tooth history/timeline

**User value:** Dentists can trust chart changes and audit decisions.

**Implementation scope:**

- Use existing `getToothHistory`.
- Add History tab in tooth slideout.
- Show baseline, proposed, completed, declined, inactive/resolved, carried-over entries.
- Include provider/date/source visit if available.

**Tests required:**

- backend history ordering test if absent
- frontend history tab test
- E2E: previous visit proposed treatment appears as carried-over/history in new visit

---

#### P0.5 Add offline conflict visibility

**User value:** Offline stale writes do not disappear silently.

**Implementation scope:**

- Expose conflict query if not present.
- Add global conflict banner.
- Add tooth conflict marker.
- Add conflict tab/details.
- Add conflict resolution action or at least review action.

**Tests required:**

- backend conflict list test
- frontend conflict marker test
- E2E offline/stale simulation if feasible
- unit test: conflicted tooth marker independent of clinical layer

---

#### P0.6 Apply clock-gating to full-chart upsert

**User value:** Full-chart save cannot overwrite newer tooth updates.

**Implementation scope:**

- Add same stale-write guard from per-tooth PATCH to full-chart upsert.
- Persist conflicts for stale tooth entries.
- Return safe response indicating rejected entries.

**Tests required:**

- backend stale full upsert test
- conflict persistence test
- contract test through real HTTP
- frontend save error/conflict surface test

---

#### P0.7 Add structured chart export

**User value:** Clinicians can produce a complete chart for records/referrals.

**Implementation scope:**

- Start with HTML/PDF-ready view if PDF generation is not yet available.
- Include odontogram, legend, tooth/surface rows, treatment plan summary.
- Include generated timestamp and provider if available.

**Tests required:**

- export DTO validation
- export content unit test
- frontend export button test
- E2E: export route/action returns expected content

---

### P1 — Usability and chairside speed

- Multi-select mode and batch actions.
- Surface presets: O, MO, DO, MOD, B/F, L, cervical.
- Perio auto-advance.
- Perio triplet entry.
- Chart view presets:
  - all
  - active plan
  - completed only
  - conditions only
  - selected tooth
  - conflicts
- Inactive/resolved conditions in history.
- Simple RCT/sealant/implant detail markers.
- Optional tooth image attachment indicator if imaging module is ready.

### P2 — Advanced clinical depth

- Bridge/pontic/connector editor.
- Prosthesis grouping.
- Implant metadata.
- MGJ/attached gingiva.
- Advanced perio history trend heatmap.
- Chart timeline slider.
- Referral packet export.
- Audit mode with deleted/changed record view.

### Later

- Voice-first workflows.
- AI-assisted diagnosis.
- AI auto-charting.
- AI ceph/imaging tracing as core dependency.
- Complex configurable symbol designer.
- Overly detailed specialist workflows before small-clinic v1 is stable.

---

## 10. Vertical TDD Slices

The agent should not implement all slices at once. Pick one P0 slice, finish it end-to-end, pass gates, then continue.

---

### Slice 1: Per-surface condition charting in tooth slideout

**User story:**  
As a dentist, I can mark specific surfaces of a tooth with different conditions so the odontogram reflects clinically accurate findings.

**Acceptance criteria:**

- Dentist can select one or more surfaces from an enlarged tooth surface selector.
- Dentist can assign a condition to selected surfaces.
- Whole-tooth and per-surface state do not overwrite each other incorrectly.
- The odontogram renders the affected surfaces.
- Layer precedence still works per surface.
- Offline `clock` and `localId` behavior is preserved.
- Summary counts match rendered surfaces.

**TypeSpec changes:**

- Verify or add `surfaceConditionMap`.
- Verify condition enum allows selected condition.
- Verify PATCH/upsert payload supports partial surface map updates.

**Backend tests:**

- Persist per-surface condition.
- Merge new surface update without deleting other surfaces.
- Reject stale surface update with lower clock.
- Preserve baseline immutability.

**Contract tests:**

- Real HTTP PATCH tooth with surface map.
- GET chart returns same surface map.
- Contract must not bypass generated validator.

**Frontend tests:**

- Surface selector renders surfaces.
- Selecting M/O/D and condition saves expected payload.
- Existing surface state remains when another surface is added.
- Visual helper resolves mixed surfaces correctly.

**E2E test:**

1. Open patient workspace.
2. Select tooth 16.
3. Open surface selector.
4. Mark occlusal caries and mesial watch.
5. Save.
6. Reload.
7. Verify tooth 16 renders both surface states.
8. Verify bottom panel explains the two surface entries.

**Verification commands:**

```bash
bun test
bun run typecheck
cd services/api-ts && bunx tsc --noEmit
# plus repo-specific contract and e2e commands
```

---

### Slice 2: Curated v1 condition vocabulary

**User story:**  
As a dentist, I can record common findings such as abscess, calculus, recession, impacted, retained root, and sensitivity without forcing everything into generic notes.

**Acceptance criteria:**

- Condition picker groups common findings.
- Existing states remain backward-compatible.
- `other` requires a note.
- Condition can be tooth-level or surface-level.
- Condition can be linked to or converted into treatment.
- Inactive/resolved conditions do not show as active chart findings.

**TypeSpec changes:**

- Add/verify `ConditionCode`.
- Add/verify status: active/inactive/resolved/watch.
- Add optional diagnosis code and note.

**Backend tests:**

- Reject invalid condition code.
- Persist `other` only with note.
- Link condition to treatment.
- Preserve inactive condition history.

**Frontend tests:**

- Picker grouping.
- Required note for `other`.
- Convert condition to treatment.
- Active vs inactive rendering.

**E2E test:**

- Add abscess condition to tooth.
- Convert to treatment.
- Mark condition inactive after treatment completion.
- Verify history retains condition.

---

### Slice 3: Chart legend, layer toggles, and visible-state explanation

**User story:**  
As a dentist, I can understand why a tooth appears with a particular color/symbol and control which layers are visible.

**Acceptance criteria:**

- Legend explains baseline, proposed, completed, declined, carried-over, existing-other, conflict.
- Layer toggles affect chart and bottom rows consistently.
- Tooth slideout shows “visible because…”
- Completed has precedence over proposed.
- Declined is desaturated/hatched and not mistaken for active proposed work.
- Color is not the only indicator.

**Backend changes:**

- Usually none unless resolved-state metadata is missing.

**Frontend tests:**

- `resolveToothVisualState()` returns explanation object.
- Legend renders all active layer styles.
- Toggle proposed hides proposed visual and rows.
- Completed > proposed precedence is enforced.

**E2E test:**

- Create proposed treatment.
- Mark completed.
- Verify tooth no longer appears pending.
- Toggle completed off and on.
- Verify explanation matches current visible state.

---

### Slice 4: Tooth history timeline in slideout

**User story:**  
As a dentist, I can view the full cross-visit history of a selected tooth from the chart.

**Acceptance criteria:**

- History tab exists in tooth slideout.
- Shows entries in reverse chronological order.
- Shows source visit/date/provider/status.
- Shows baseline changes and treatment transitions.
- Shows inactive/resolved conditions.
- Can filter: all / conditions / treatments / conflicts.
- Works for carried-over proposed treatment.

**Backend tests:**

- `getToothHistory` returns ordered entries.
- Includes source visit and status transitions.
- Does not omit declined/inactive entries.

**Frontend tests:**

- History tab loads and renders states.
- Empty state is clear.
- Error state does not break chart.

**E2E test:**

- Visit 1: add proposed treatment.
- Visit 2: open same tooth.
- Verify carried-over marker and history entry.

---

### Slice 5: Offline conflict visibility

**User story:**  
As a clinician, I can see when an offline chart edit was rejected because it was stale and decide what to do next.

**Acceptance criteria:**

- Global chart banner shows open conflict count.
- Affected tooth has conflict marker.
- Conflict details show server value, attempted value, reason, clocks.
- User can keep server value or reapply local as new change.
- Resolved conflict no longer shows active marker.
- Conflict resolution is audited.

**TypeSpec changes:**

- Add conflict list/resolve endpoints if missing.

**Backend tests:**

- List open conflicts for patient/visit.
- Resolve conflict.
- Reapply as new change increments/supplies new clock.
- Dismiss requires reason or is limited by role.

**Frontend tests:**

- Conflict banner.
- Tooth marker.
- Conflict detail view.
- Resolution action.

**E2E test:**

- Seed conflict.
- Open chart.
- Verify marker and details.
- Resolve.
- Verify marker disappears.

---

### Slice 6: Full-chart upsert clock-gating

**User story:**  
As a clinician working offline, my stale full-chart replay cannot overwrite newer chart data.

**Acceptance criteria:**

- Full-chart upsert checks per-tooth clocks.
- Lower incoming clock is rejected for that tooth.
- Valid higher-clock tooth entries still apply.
- Rejected entries become durable conflicts.
- Response tells frontend conflicts exist.

**Backend tests:**

- Mixed valid/stale full upsert.
- Stale entry persisted as conflict.
- Valid entry applied.
- Baseline LWW semantics preserved.

**Frontend tests:**

- Save response with conflicts surfaces banner.
- UI does not pretend all changes saved.

**E2E test:**

- Simulate stale full upsert via API or seeded state.
- Open frontend and verify conflict indicator.

---

### Slice 7: Structured clinical chart export

**User story:**  
As a dentist, I can export/print the patient’s dental chart for clinical record, referral, or patient discussion.

**Acceptance criteria:**

- Export includes patient/date/provider.
- Export includes odontogram with legend.
- Export includes tooth/surface table.
- Export includes treatment-plan summary.
- Export includes completed/proposed/declined distinctions.
- Export includes generated timestamp.
- Export does not rely only on screenshot.

**TypeSpec changes:**

- Add export request/response endpoint if backend-generated.
- Or add frontend print route if simpler for v1.

**Tests:**

- Unit test export content.
- Frontend print/export route test.
- E2E click export and verify content loads.

---

### Slice 8: Selected-tooth bottom panel

**User story:**  
As a dentist, when I select a tooth, the bottom panel shows only relevant conditions, treatments, notes, and history for that tooth.

**Acceptance criteria:**

- Selecting a tooth filters bottom panel.
- Selecting multiple teeth filters by all selected teeth.
- Clearing selection returns to broader context.
- Counts/badges match visible rows.
- Related quadrant/arch treatments are shown if relevant.

**Tests:**

- Filtering helper tests.
- Bottom panel component tests.
- E2E selected-tooth row count vs badges.

---

### Slice 9: Multi-select and batch action mode

**User story:**  
As a dentist, I can select multiple teeth and apply a common condition or treatment without repeating the same action tooth-by-tooth.

**Acceptance criteria:**

- Explicit multi-select mode.
- Batch preview before save.
- Batch action supports condition/treatment.
- Batch action does not overwrite existing surface maps silently.
- Batch save uses idempotent local IDs where needed.

**Priority:** P1 after core per-surface charting is safe.

---

### Slice 10: Perio comparison and completion confidence

**User story:**  
As a dentist/hygienist, I can compare the current perio exam against prior exams and complete the chart with confidence.

**Acceptance criteria:**

- Current exam values are distinct.
- Prior values are visible or toggleable.
- BOP%, mean depth, deep-pocket count update from rendered data.
- Completion warns on missing required values.
- No per-site update nulls other sites.

**Priority:** P0/P1 depending current coverage.

---

### Slice 11: Perio auto-advance and triplet entry

**User story:**  
As a hygienist, I can enter perio measurements quickly without manually tapping every cell.

**Acceptance criteria:**

- Auto-advance sequence is configurable.
- Triplet mode fills three sites.
- Keyboard and touch input both work.
- Merge semantics preserve neighboring sites.
- Numeric strings from Drizzle are coerced safely.

**Priority:** P1.

---

## 11. Concrete UI Components to Add or Verify

These names can be adjusted to match existing conventions.

### 11.1 New or enhanced frontend components

| Component | Purpose |
|---|---|
| `ChartLegend` | Explains layer/status styles. |
| `ChartLayerToggles` | Toggle baseline/proposed/completed/declined/carried-over/conflicts. |
| `ToothSurfaceSelector` | Enlarged iPad-friendly surface picker. |
| `ToothVisibleStateSummary` | “Why this tooth looks like this.” |
| `ToothHistoryTimeline` | Cross-visit history. |
| `ChartConflictBanner` | Global conflict count and entry point. |
| `ToothConflictMarker` | Marker on affected tooth. |
| `ToothConflictPanel` | Conflict details and resolution actions. |
| `SelectedToothBottomPanel` | Filtered condition/treatment/history rows. |
| `ChartExportButton` / `ChartExportView` | Structured print/export. |
| `PerioAutoAdvanceControls` | Data-entry sequence controls. |
| `PerioComparisonToggle` | Current vs previous exam comparison. |

### 11.2 Existing helpers to strengthen

| File | What to strengthen |
|---|---|
| `dental-chart.helpers.ts` | FDI/display mapping, dentition selection, visual state, surface state, accessibility labels. |
| `chart-layers.ts` | Layer precedence, carried-over logic, declined/completed/proposed interaction. |
| `universal-tooth.tsx` / `universal-tooth-fdi.tsx` | Surface rendering, markers, hit areas, aria labels. |
| `use-save-tooth-flow.ts` | localId/clock/idempotency, conflict response handling. |
| `use-tooth-history.ts` | history timeline data loading/error/empty states. |
| `use-perio-chart.ts` | summary consistency and merge-safe per-site updates. |

---

## 12. Testing Strategy

Dentalemon’s charting tests should guard against clinical and UX regressions, not only schema correctness.

### 12.1 Backend unit/integration tests

Required themes:

- FDI validation.
- Surface validation.
- `surfaceConditionMap` persistence.
- Partial surface merge.
- Whole-tooth vs surface interaction.
- Baseline immutability.
- Layer precedence derivation.
- Treatment status transitions.
- Declined treatment preservation.
- Carried-over treatment behavior.
- Clock-gated stale write rejection.
- Conflict persistence.
- Conflict resolution.
- Perio per-site merge.
- Drizzle numeric string coercion.
- Perio summary calculation.

### 12.2 Contract tests

Must go through real HTTP path.

Avoid tests that mount raw handlers and skip generated validators.

Contract scenarios:

- PATCH tooth with surface map.
- GET chart returns expected shape.
- Upsert full chart with mixed clocks.
- Create condition and treatment link.
- Get tooth history.
- List conflicts.
- Resolve conflict.
- Export chart.

### 12.3 Frontend unit tests

Focus on pure helpers and critical interactions.

Required helper tests:

- FDI ↔ display mapping.
- Dentition mode from DOB.
- Mixed dentition fallback.
- Layer precedence.
- Surface visual state resolution.
- Explanation text for visible state.
- Selected-tooth row filtering.
- Badge/count consistency.
- Conflict marker state.

Required component tests:

- Surface selector.
- Tooth slideout.
- Legend/toggles.
- History timeline.
- Conflict panel.
- Export entry.
- Perio grid merge/update behavior.

### 12.4 E2E journeys

Minimum charting E2E suite:

1. **Surface condition save/reload**
2. **Finding → treatment plan**
3. **Proposed → completed precedence**
4. **Declined treatment stays visible as declined/history**
5. **Carried-over proposed treatment across visits**
6. **Selected tooth filters bottom panel**
7. **Tooth history timeline**
8. **Offline conflict marker and review**
9. **Perio data entry and summary**
10. **Perio per-site update does not null neighboring sites**
11. **Chart export opens/prints expected sections**
12. **iPad viewport charting journey**

### 12.5 Accessibility tests

Minimum:

- Tooth SVG elements have accessible names:
  - “Tooth 16, upper right first molar, proposed occlusal caries”
- Interactive controls meet target size requirements.
- Color is not the only information carrier.
- Keyboard navigation works for chart actions where practical.
- Focus states visible.
- Legend available to screen readers.
- Conflict states announced.

---

## 13. iPad/Touch UX Requirements

Dentalemon is iPad-first. Do not design only for desktop hover.

### 13.1 Touch target rules

- Primary buttons and interactive controls should aim for at least 44 pt on iPad.
- WCAG 2.2 minimum pointer targets are 24 × 24 CSS px, but this is a floor, not ideal for clinical touch workflows.
- Dense tooth SVG surfaces may be visually small, so provide equivalent larger controls in the slideout.

### 13.2 Touch-first charting rules

- Use enlarged surface selector in slideout for precision.
- Avoid requiring hover.
- Use long-press for secondary actions only; primary actions must be visible.
- Do not hide critical actions behind right-click.
- Batch mode should be explicit and visually obvious.
- Avoid accidental destructive actions:
  - confirmation for batch overwrite
  - undo/toast for safe reversible actions
  - audit for clinical changes

### 13.3 Accessibility and color

- Use color + icon/hatch/label.
- Check contrast for text, badges, outlines, and non-text visual markers.
- Do not use red/green alone for planned/completed.
- Conflict marker should be shape/icon-based, not just color.
- Declined should use hatching/desaturation plus label.
- Completed should be visually stronger than proposed, consistent with clinical precedence.

---

## 14. Risks and Non-Goals

### 14.1 Risks

| Risk | Mitigation |
|---|---|
| Overloading v1 with specialist features | Prioritize P0 surface/condition/history/conflict/export before prostho-heavy tools. |
| Making charting slower | Add quick actions, presets, multi-select, and avoid excessive required fields. |
| Color-only meaning | Use symbol, hatch, label, shape, and legend. |
| Breaking layer precedence | Add helper tests and E2E for completed > proposed > declined. |
| Breaking offline semantics | Every write path must preserve clock/localId/conflict rules. |
| Inconsistent summaries | Compute badges/counts from the same rendered data source. |
| Perio data loss | Per-site writes must merge, never full-row replace. |
| Generated file drift | Never hand-edit generated SDK/OpenAPI files. |
| API/UI mismatch | Contract tests through real HTTP path. |
| Vague AI implementation | Work only in small vertical TDD slices. |

### 14.2 Non-goals

Do not prioritize:

- AI auto-diagnosis.
- AI auto-charting.
- AI ceph/imaging tracing as core chart dependency.
- Voice-first charting as required workflow.
- Replacing FDI canonical storage.
- Freehand drawing as primary clinical record.
- Building all advanced prostho/perio/implant fields before P0 credibility is complete.
- Implementing broad UI redesign without tests.

---

## 15. Recommended First Execution Prompt for the AI Agent

Use this after placing this file in the repo.

```md
You are improving Dentalemon v1 dental charting.

Read:
1. This research guide.
2. The current TypeSpec files for dental-visit and dental-perio.
3. Current backend chart/perio handlers and repos.
4. Current frontend chart, tooth, slideout, chart-layer, treatment-plan, and perio components.
5. Existing backend, frontend, contract, and E2E tests.

Do not implement yet.

First produce an inventory report at:
docs/audits/dental-charting/current-charting-inventory.md

The report must include:

1. Current implemented capabilities
2. Present / Partial / Missing / Needs Verification / Deferred checklist
3. UI screenshots or route notes if available
4. API/model gaps
5. Test coverage gaps
6. Risks to layer precedence, baseline immutability, and offline clock semantics
7. Recommended first P0 vertical slice

Rules:
- Do not assume a gap exists if code already supports it.
- Do not change code during inventory.
- Do not hand-edit generated files.
- Use Bun commands only.
- Respect Vertical TDD.
- Call out anything that requires product decision.
```

---

## 16. Recommended Second Execution Prompt After Inventory

Use this only after inventory is complete.

```md
Proceed with the first approved P0 vertical slice from the Dentalemon charting research guide and current inventory.

Implement exactly one vertical slice end-to-end using Vertical TDD:

TypeSpec → codegen → backend tests RED → backend implementation GREEN → contract tests → frontend tests RED → frontend implementation GREEN → E2E → verification gate.

Constraints:
- FDI remains canonical.
- Universal/Palmer remain display-only.
- Preserve living-document chart model.
- Preserve baseline immutability.
- Preserve precedence: completed > proposed > declined.
- Preserve local-first/offline localId and clock behavior.
- Persist conflicts, never silently drop stale writes.
- Never hand-edit generated files.
- Run all required tests and typechecks.
- If a gate fails, stop and report the failure with the smallest safe fix plan.
```

---

## 17. Final Prioritized Recommendation

The best first implementation target is usually:

> **Slice 1: Per-surface condition charting in tooth slideout**

Why:

- Dentalemon’s model already appears to support `surfaceConditionMap`.
- It gives immediate clinical credibility.
- It improves UI/UX without requiring a huge new subsystem.
- It exercises the most important invariants:
  - FDI canonical tooth numbers
  - surface validation
  - layer precedence
  - offline clock/localId
  - summary/render consistency
  - frontend + backend + E2E alignment

If inventory reveals per-surface UI is already complete, the next best first slice is:

> **Slice 3: Chart legend, layer toggles, and selected-tooth visible-state explanation**

Why:

- It makes the existing chart understandable.
- It reduces dentist confusion.
- It is lower risk than adding new clinical data.
- It creates the foundation for history, conflicts, export, and multi-select.

---

## 18. References

1. Open Dental, “Graphical Tooth Chart.” https://www.opendental.com/manual/graphicaltoothchart.html  
   Used for: visual tooth chart, selection, multi-select, historical slider.

2. Open Dental, “Enter Treatment.” https://opendental.com/manual/entertreatment.html  
   Used for: treatment statuses, conditions/diagnoses, multi-tooth/range/quadrant/arch procedure entry.

3. Open Dental, “Show Chart Views.” https://www.opendental.com/manual/showtabchart.html  
   Used for: selected-tooth filtering, chart view configuration, audit mode, treatment-plan view inside chart.

4. Open Dental, “Perio Chart.” https://www.opendental.com/manual/perio.html  
   Used for: prior exam comparison, probing, plaque, calculus, BOP, suppuration, mobility, furcation, CAL, gingival margin, MGJ, auto-advance, triplets.

5. Dentrix Ascend, “Charting symbols.” https://hsps.pro/DentrixAscend/Help/Charting_symbols.htm  
   Used for: condition and procedure symbol vocabulary, status colors.

6. Dentrix Ascend Academy, “Charting Pages Overview.” https://learn.dentrixascend.com/courses/clinical-essentials-for-teams/lessons/charting/topic/charting-pages-overview/  
   Used for: chart/progress notes/perio/treatment planner/imaging as chairside suite.

7. Dentrix Ascend Academy, “Charting Conditions.” https://learn.dentrixascend.com/courses/clinical-essentials-for-teams/lessons/charting/topic/charting-conditions/  
   Used for: common workflow concept of quick condition charting.

8. Curve Dental, “Charting Module Overview.” https://curvedental.zendesk.com/hc/en-us/articles/50456380721555-Charting-Module-Overview  
   Used for: odontogram + treatment plan, status colors, surface labels, labels, condition drawings, image attachment indicator, print entry.

9. Curve Dental, “Streamlined Dental Charting Software.” https://www.curvedental.com/dental-charting-software  
   Used for: high-level emphasis on intuitive, color-coded, fast charting.

10. CareStack, “A Guide to the Odontogram (Charting).” https://carestack-aus.zendesk.com/hc/en-au/articles/22988791794194-A-Guide-to-the-Odontogram-Charting  
    Used for: configurable status colors/transparency, multiple layers on a tooth, active/inactive conditions, treatment actions, supernumerary teeth.

11. CareStack, “Dental Charting Software.” https://carestack.com/dental-software/features/charting  
    Used for: integrated charting, procedures, conditions, notes, treatment plans, imaging access.

12. CareStack, “Dental Periodontal Charting.” https://carestack.com/dental-software/features/periodontal-charting  
    Used for: perio monitoring over time, pocket depth/recession/bleeding, patient explanation.

13. tab32, “A Holistic Guide to Dental Charting.” https://tab32.com/a-holistic-guide-to-dental-charting/  
    Used for: basic definition of dental charting, charting over time, numbering systems, perio pocket depth context.

14. AAP, “2017 Classification of Periodontal and Peri-implant Diseases and Conditions.” https://www.perio.org/research-science/2017-classification-of-periodontal-and-peri-implant-diseases-and-conditions/  
    Used for: staging/grading framework and peri-implant disease classification context.

15. Tonetti, Greenwell, Kornman, “Staging and grading of periodontitis: Framework and proposal of a new classification and case definition.” PubMed. https://pubmed.ncbi.nlm.nih.gov/29926952/  
    Used for: grade A–C progression concept and staging/grading reference.

16. NCBI Bookshelf, “Periodontal Disease.” https://www.ncbi.nlm.nih.gov/books/NBK554590/  
    Used for: probing depth significance and periodontal evaluation context.

17. W3C WAI, “Understanding Success Criterion 2.5.8: Target Size (Minimum).” https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html  
    Used for: pointer target size and spacing minimum.

18. W3C WAI, “Understanding Success Criterion 1.4.11: Non-text Contrast.” https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html  
    Used for: non-text UI/graphic contrast and avoiding color-only meaning.

19. Apple Human Interface Guidelines, “Buttons.” https://developer.apple.com/design/human-interface-guidelines/buttons  
    Used for: 44 × 44 pt hit region guidance.

20. Material Design, “Touch Targets.” https://m3.material.io/foundations/designing/structure  
    Used for: 7–10 mm touch target recommendation.

---

## 19. Appendix — Quick P0 Checklist for Coding Agent

Before marking charting v1 “clinically credible,” verify:

- [ ] Surface-level condition UI exists and is tested.
- [ ] Surface-level rendering works on the odontogram.
- [ ] Surface updates merge, not replace.
- [ ] Condition vocabulary covers common v1 findings.
- [ ] Finding can link to treatment plan.
- [ ] Legend explains chart layers/statuses.
- [ ] Selected tooth explains visible state.
- [ ] Bottom panel filters by selected tooth.
- [ ] Tooth history timeline is visible.
- [ ] Offline conflicts are visible to clinician.
- [ ] Full-chart upsert is clock-gated.
- [ ] Chart export/print exists.
- [ ] Perio summaries derive from rendered/saved data.
- [ ] Perio per-site update does not null other sites.
- [ ] iPad/touch targets are usable.
- [ ] Color is not the only visual cue.
- [ ] Backend, contract, frontend, and E2E tests pass.
- [ ] `bun test`, frontend typecheck, and `services/api-ts` typecheck pass.
