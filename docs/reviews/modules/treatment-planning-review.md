# Treatment Planning — Standards & Experience Review
> Review date 2026-06-02 · Depth: DEEP

## 1. What we have   (cite spec + code; describe the plan data model + state machine)

DentaLemon has **two overlapping treatment-plan constructs** that together form the implemented surface:

**A. The plan-header model (`dental_treatment_plan`)** — `services/api-ts/src/handlers/dental-patient/repos/treatment-plan.schema.ts`. A thin per-patient header with: `patientId`, `providerId`, `status`, `totalEstimateCents`, `notes`, `presentedAt`, `approvedAt`. It has **no line items of its own** — its "items" are `dental_treatment` rows linked by a loose `treatment_plan_id` ref at approval time (`linkPendingTreatments`, treatment.schema.ts:49). Handlers: `createTreatmentPlan` (→ `draft`), `updateTreatmentPlan` (FSM-guarded), `listPatientTreatmentPlans` (audited read), `approveTreatmentPlan` (CR-05). FE: `treatment-plans-sheet.tsx` (bottom sheet listing plans with FSM transition buttons).

**Plan-header FSM** (treatment-plan.schema.ts:15): `draft → presented → approved → partially_completed → completed`, `cancelled` reachable pre-terminal. The completion states are **derived, not set** — `deriveTreatmentPlanStatus()` recomputes from linked treatment statuses (`performed`/`verified` = done; `dismissed`/`declined` excluded from denominator), per TP-BR-005 (MODULE_SPEC.md §"Treatment plans (TR-P1-08)"). Approval writes an append-only `dental_treatment_plan_approval` row (`approved_by_person_id`, `method` = signature/verbal/portal, optional `consent_form_id`, `signature_data`) — CR-05.

**B. The treatment/item model (`dental_treatment`)** — `services/api-ts/src/handlers/dental-visit/repos/treatment.schema.ts`. This is the **actual working surface clinicians see**. Each treatment carries `toothNumber`, `surfaces` (JSONB), `cdtCode` (NOT NULL), `description`, `conditionCode`, `priceCents` (locked at recording — EC4), `carriedOver`, `clinicalNotes`, and a **6-state item FSM**: `diagnosed → planned → performed → verified` (+ `dismissed`/`declined` terminal). Per project memory, the path is two-step (`diagnosed→planned→performed`); a single jump to `performed` is 422, and invoices require `performed`.

**C. Plan versioning (`treatment_plan_version`)** — `services/api-ts/src/handlers/dental-visit/repos/treatment-plan-version.schema.ts` + `acceptTreatmentPlan.ts`. On accept, the live pending-treatment set (diagnosed+planned) is **snapshotted into an append-only version row** keyed `(patientId, version)`, optionally linked to a consent form via `accepted_plan_version_id`. Prior versions are never mutated. This is the medico-legal record of "what the patient accepted."

**Frontend surfaces:** `treatment-plan-tab.tsx` (groups pending treatments by Diagnosed/Planned/Declined, shows ₱ total + single "Accept Plan" CTA → version snapshot), `treatment-table.tsx` (the "Treatment Breakdown" table in the workspace carousel — Tooth/Surface/Condition/Treatment Plan/Done/Status/Total, inline price edit, Mark Done / Dismiss / Decline popovers, dual subtotals + grand total), and `cdt-code-browser.tsx` (search + 8 specialty tabs + favorites/recents over a **106-entry** local `cdt-codes.json`, each with `defaultPriceCents`).

## 2. Industry-standard benchmark   (3-5 lines; market context PH vs US)

See `../research/treatment-planning.md`. US-PMS norms (Dentrix, Open Dental, Curve, CareStack): explicit **5-phase clinical sequencing** (systemic/urgent → disease control → re-eval → definitive → maintenance) with a **priority field driving schedule order**; CDT-coded procedures; **fee + primary/secondary insurance estimation with LEAT/alternate-benefit downgrades and payer bundling**; **alternate cases** (implant vs bridge) with a recommended case that auto-rejects siblings on acceptance; a patient-facing **case-presentation surface** with annotated radiographs + financial breakdown and **e-signature** accept/reject; and **active/inactive/saved** plan versioning with a **status-history audit trail** at case and procedure level. **Market context:** DentaLemon is ₱ (Philippines) — the US-centric insurance machinery (LEAT, alternate-benefit downgrade, secondary-claim coordination, annual-max/frequency timing) is largely **out-of-market** for a PHIC/self-pay/HMO-rider economy. Those gaps are real vs the US benchmark but should be scored pragmatically, not as P0 product defects.

## 3. Completeness gaps

| Capability | Industry benchmark | Our status | Evidence (file) | Severity |
|---|---|---|---|---|
| CDT coding on every procedure | ADA CDT, annually versioned | ✅ `cdtCode` NOT NULL on every treatment; browser w/ search+favorites | treatment.schema.ts:29, cdt-code-browser.tsx | — |
| CDT catalog depth + version tracking | full CDT (~800 codes), version-stamped | ⚠️ only **106** codes, static JSON, no CDT-year field | cdt-codes.json (106 entries) | P2 |
| Fee estimation / locked pricing | per-procedure fee | ✅ `priceCents` locked at recording, editable inline, ₱ subtotals+grand total | treatment.schema.ts:36, treatment-table.tsx:123-130 | — |
| Insurance estimate (coverage / patient OOP) | primary+secondary est, patient portion | ❌ plan total is gross fee only; no coverage math on plan/items | treatment-plan-tab.tsx:230, treatment-plans-sheet.tsx:91 | P2 (PH-mitigated) |
| LEAT / alternate-benefit downgrade + bundling | composite→amalgam, payer bundling | ❌ none (grep: no LEAT/downgrade logic) | — | P3 (out-of-market PH) |
| "Estimates as of" / annual max / frequency timing | benefit-year aware | ❌ none | — | P3 (out-of-market PH) |
| Explicit clinical **phasing** (systemic→…→maintenance) | 5-phase sequencing | ❌ only Diagnosed/Planned grouping by status; no phase/priority field | treatment-plan-tab.tsx:221, treatment.schema.ts | P1 |
| **Priority** ordering that drives scheduling | priority labels sequence the plan | ❌ no priority field; order is insertion/status only | treatment.schema.ts | P1 |
| Re-evaluation gate (control→definitive hold) | explicit holding step | ❌ none | — | P2 |
| **Alternate cases** (implant vs bridge) + recommended + auto-reject siblings | Dentrix alternate cases | ❌ no alternate/option grouping; flat item list | treatment-plan.schema.ts | P1 |
| Status lifecycle (case-level) | proposed→presented→accepted/rejected→scheduled→completed | ⚠️ partial: `draft→presented→approved→partially_completed→completed`; no explicit `rejected`/`scheduled` | treatment-plan.schema.ts:15 | P2 |
| Status-history **audit trail** | per-status history log | ⚠️ approval is append-only + reads audited, but no per-transition history table | listPatientTreatmentPlans.ts:32, approveTreatmentPlan.ts | P2 |
| Plan **versioning** (active/inactive/saved snapshots) | multiple coexisting versions | ✅ append-only `treatment_plan_version` snapshot on accept; immutable | treatment-plan-version.schema.ts, acceptTreatmentPlan.ts | — |
| **E-signature** accept/reject | portal sign-or-reject | ⚠️ accept-only: `signature_data` + method=signature/portal in schema, consent-form linkage; **no reject path**, no patient-portal surface | treatment-plan.schema.ts:74, acceptTreatmentPlan.ts | P2 |
| Case-presentation view (annotated imaging + financial) | photo/radiograph-driven | ❌ no presentation surface; accept is a clinician-side button, not a patient-facing case | treatment-plan-tab.tsx | P1 |
| Charting linkage (bidirectional) | TP procedures ↔ odontogram | ✅ treatments originate in chart/visit, render in carousel chart, completion updates both | 03-workspace-carousel.png, treatment-table.tsx | — |
| Scheduling linkage (planned→appointment) | per-procedure scheduled/planned/unscheduled flag | ❌ no item↔appointment link or scheduled-state column | treatment.schema.ts, treatment-table.tsx | P1 |
| Multi-visit grouping (carry-over) | group procedures into sessions | ✅ `carriedOver`/`sourceVisitId`; carousel renders carried-over rows | treatment.schema.ts:37, treatment-table.tsx:380 | — |
| Informed refusal (decline) | record refusal | ✅ `declined` state + `refusalReason`; "Decline (Record informed refusal)" UI | treatment.schema.ts:20, treatment-table.tsx:278 | — |
| AI-suggested plan items from imaging | Overjet/Pearl annotated detections | ❌ not surfaced into plan items | — | P3 (differentiator) |

## 4. UX/UI assessment   (Nielsen + WCAG; case-presentation/acceptance flow, financial clarity, DESIGN.md fidelity)

**Strengths.** The **Treatment Breakdown** table (03-workspace-carousel.png) is the strongest surface: clear column model, dual "This Visit / Carried Over" subtotals + grand total (good *visibility of system status* and financial clarity), inline price edit, and a legible status-badge vocabulary. Mark-Done failure produces an **actionable inline message** ("Consent required — ask patient to sign before completing") rather than a raw 422 — good *error recovery*. Decline-with-reason and dismiss-with-reason use Radix popovers; the CDT browser has `role="listbox"/option`, `aria-selected`, labeled search, and tab roles — solid WCAG semantics. Brand fidelity is consistent (#FFE97D lemon accent, ₱/`en-PH` locale via `CURRENCY_SYMBOL`/`APP_LOCALE`).

**Issues.**
- **N1 Consistency (currency leak).** `treatment-plans-sheet.tsx:93` formats the plan estimate as **`currency: 'USD'`** while the entire app is ₱/`en-PH`. A US dollar sign on a Philippine plan total is a visible defect. **P1.**
- **N2 Match to clinical mental model.** The plan-tab groups by *status* ("Diagnosed/Planned"), not by *clinical phase* or *priority*. A clinician planning a complex case can't see/communicate "stabilize first, then definitive" — the tool flattens sequencing. **P1 (completeness, surfaces in UX).**
- **N3 Case presentation / acceptance.** "Accept Plan" is a single clinician-side button on the treatment-plan-tab; there is **no patient-facing presentation** (annotated radiographs, before/after, itemized financial breakdown) and **no reject affordance** — acceptance is binary and provider-driven. The schema supports `method=portal` and `signature_data`, but no UI captures a signature or a rejection. **P1.**
- **N4 Two parallel plan models is a conceptual hazard.** The `treatment-plans-sheet` (header FSM with Present/Approve/Cancel buttons) and the `treatment-plan-tab` (status-grouped pending list with Accept → version snapshot) are **two different "plans" with two different acceptance verbs** ("Approve" vs "Accept") that aren't visibly reconciled for the user. Risk of *consistency/standards* confusion about which is canonical. **P2.**
- **N5 Recognition.** CDT browser favorites/recents are keyed to `memberId` in localStorage — good, but the 106-code catalog will frequently miss real procedures, forcing manual entry the UI doesn't obviously support. **P2.**

## 5. Findings (P0–P3)

- **[P1] No clinical phasing or priority sequencing** — plan is a flat status-grouped list (`treatment-plan-tab.tsx:221`; no phase/priority column in `treatment.schema.ts`). Industry norm sequences systemic/urgent → control → re-eval → definitive → maintenance and uses priority to drive schedule order. *Recommend:* add an optional `phase` enum + `priority` int on `dental_treatment` (or plan-item join), group the plan-tab by phase, and sort by priority. Low-risk additive schema change; biggest clinical-credibility lever.
- **[P1] No alternate cases (implant vs bridge)** — `treatment-plan.schema.ts` has no option/alternate grouping; can't present "Option A / Option B," mark a recommended case, or auto-reject siblings on acceptance. *Recommend:* an `option_group_id` + `recommended` flag on items, with accept-one-rejects-linked logic mirroring the existing decline path.
- **[P1] No patient-facing case-presentation + no reject path** — acceptance is a clinician button (`treatment-plan-tab.tsx:293`); `acceptTreatmentPlan.ts` snapshots+signs but there's no presentation surface (annotated imaging/financials) and no decline-of-plan. Research flags financial+communication clarity as the top acceptance levers. *Recommend:* a read-only presentation view (chart + radiograph annotations + itemized ₱ breakdown) with sign **or** reject, persisting reject as a first-class status.
- **[P1] No plan→appointment scheduling linkage** — no item↔appointment ref or scheduled/planned/unscheduled column (`treatment.schema.ts`, `treatment-table.tsx`). The plan can't drive the calendar. *Recommend:* loose `appointment_id` ref on treatment + a scheduled-state column, mirroring the existing `billedInvoiceId`/`treatmentPlanId` loose-ref pattern.
- **[P1] Currency leak — USD in plans sheet** — `treatment-plans-sheet.tsx:93` hard-codes `currency: 'USD'` in a ₱/`en-PH` app. *Recommend:* swap to `CURRENCY_SYMBOL` + `APP_LOCALE` like every sibling component. One-line fix; visibly wrong today.
- **[P2] Lifecycle missing explicit `rejected`/`scheduled` states + no per-transition history** — header FSM (`treatment-plan.schema.ts:15`) lacks `rejected`/`scheduled`; only approval (CR-05) and reads are audited, no status-history table. *Recommend:* add `rejected` (and optionally `scheduled`) to the FSM; emit an audit row per transition for a case-status history trail.
- **[P2] Two parallel plan constructs unreconciled** — header-plan (Approve) vs pending-treatment-plan (Accept→version). *Recommend:* pick one canonical "plan" abstraction for the UI and treat the other as its backing store; document the relationship in MODULE_SPEC.
- **[P2] No insurance estimation (coverage/patient OOP)** — plan totals are gross fees only. PH-mitigated, but PHIC/HMO riders exist. *Recommend:* a simple PH-appropriate coverage model (fixed PHIC case-rate / HMO copay) rather than the full US LEAT engine.
- **[P2] CDT catalog shallow (106 codes) + no CDT-year stamp** — `cdt-codes.json`. *Recommend:* expand catalog and add a version field to support annual updates; allow ad-hoc code entry.
- **[P3] No re-evaluation gate** — acceptable for Phase-1 GP workflows.
- **[P3] US insurance machinery (LEAT/alternate-benefit/bundling, benefit-year timing)** — genuinely out-of-market for PH; defer unless a US/PPO market is targeted.
- **[P3] No AI-suggested plan items from imaging** — differentiator, not a gap vs baseline norms.

## 6. Carousel implications   (planned vs completed across visits)

The workspace carousel (03-workspace-carousel.png) renders the treatment story as **three snapshot layers — Baseline · Proposed · Completed** — over the odontogram, with an **"Active" badge and snapshot date** (May 31, 2026) per the approved cumulative-snapshot model (project memory: "Carousel design approved — cumulative snapshot, snapshot-first"). This is a genuine strength and the right substrate for telling treatment progress:

- **Proposed layer ↔ pending items.** The `diagnosed`/`planned` treatments (the plan-tab's working set, and what `acceptTreatmentPlan` snapshots into `treatment_plan_version`) are exactly the "Proposed" overlay. The carousel can color teeth that have proposed-but-not-done work — turning the flat Treatment Breakdown into a spatial what's-left view.
- **Completed layer ↔ derived completion.** As items move to `performed`/`verified`, `deriveTreatmentPlanStatus` advances the plan header (`approved → partially_completed → completed`); the carousel's "Completed" layer is the visual twin of that derivation. The blue tooth #36 in the screenshot reads as completed work against an otherwise proposed/baseline arch.
- **Versioning = the time axis.** Because each accept writes an immutable `treatment_plan_version` snapshot, the carousel can scrub **plan-as-accepted vs plan-as-delivered** across visits — the medico-legal "what we agreed vs what we did" narrative. The carried-over mechanism (`carriedOver`/`sourceVisitId`) already threads incomplete proposed work forward between visit cards.
- **Gaps that weaken the story.** Without **phasing/priority** the Proposed layer can't express *sequence* ("stabilize before crown"), and without **scheduling linkage** the carousel can't show "proposed → booked → done" — it jumps proposed→completed with no scheduled middle state. Adding a `scheduled` item state and a phase grouping would let the carousel narrate the full proposed → scheduled → completed progression that the three-layer design clearly anticipates.

---

### Digest
- TP is implemented as **two layers**: a thin `dental_treatment_plan` header (FSM draft→presented→approved→partially_completed→completed, derived completion, CR-05 approval record) backed by `dental_treatment` line items (CDT-coded, ₱-priced, 6-state diagnosed→planned→performed→verified item FSM).
- Strong on **CDT coding, locked fee + ₱ subtotals, append-only version snapshots on accept, charting linkage, carry-over, and informed refusal** — these match or beat baseline norms.
- **P1 gaps:** no clinical phasing/priority sequencing; no alternate cases (implant vs bridge + recommended/auto-reject); no patient-facing case-presentation or plan-reject path; no plan→appointment scheduling linkage; and a **USD currency leak** in `treatment-plans-sheet.tsx` (one-line fix, visibly wrong in a ₱ app).
- **P2:** lifecycle lacks `rejected`/`scheduled` + per-transition history; two parallel plan constructs (Approve vs Accept) unreconciled; no insurance coverage/OOP estimate; shallow 106-code CDT catalog with no version stamp.
- **PH market caveat:** US insurance machinery (LEAT/alternate-benefit downgrades, payer bundling, benefit-year timing) is largely out-of-market — scored **P3/defer**, not as product defects.
- **Carousel:** the Baseline/Proposed/Completed three-layer snapshot model is the right substrate; phasing + a `scheduled` item state would let it narrate the full proposed→scheduled→completed progression it already gestures at.
