# Case Presentation — Module Gap Plan

**Module:** `case-presentation` (P1-20) — patient-facing treatment-plan acceptance (TypeSpec namespace `DentalPatientFinanceModule.CasePresentationManagement`)
**Audited:** 2026-06-09 (branch `chore/workflow-verification-sweep`)
**Method:** code/wiring map (Explore + `/understand`-class trace) + **live API end-to-end drive** against the running impl (API 7213, vite 3003, demo seed) + partial Webwright browser drive (auth/PIN/profile/patient confirmed; deep route is PIN-gated and bounces on direct load).
**Evidence workspace:** `outputs/case-presentation-audit/` (plan.md + run*/screenshots + logs)

---

> **✅ BATCH 1 IMPLEMENTED (2026-06-09).** G1 (P0), G3 (P1), G2 (P1) fixed and proven (backend unit + contract against live server + live browser drive). A latent FE blocker (**FE-1**: workspace route had no `<Outlet/>`, so the nested case-presentation route never rendered) was discovered during live verification and fixed — it was the real reason the module was FAIL E2E. **Full present → e-sign → accept now works end-to-end in the UI.** `[NEEDS CONFIRMATION]` #1 resolved (link at `presented`), #3 resolved (button reachability confirmed live). Remaining: G4 (P3 clickable images), G5 (P3 telemetry note). See MASTER-GAP-MATRIX §8.

## Audit Decision: **FAIL** → **RESOLVED for V1 (Batch 1)**

The module was fully built, route-registered, SDK-wired, and unit-tested — but its **core workflow was non-functional end-to-end**. In the documented Phase-1 flow (draft → presented → present → accept), the patient-facing aggregate is **always empty (₱0, 0 line items)** and **accept is blocked** with `PLAN_HAS_NO_ITEMS`. The defect is invisible to the existing tests because the unit-test fixture pre-links treatments to the plan, and because the demo seed contains **zero plan-level treatment plans**, so no one can reach the flow through the UI. Reject works; accept (the module's primary purpose) does not.

---

## Expected vs Actual

| Expected (IDEAL std §3.6 + P1-20 spec) | Actual |
|---|---|
| Clinician presents a plan; patient sees the phased ₱ breakdown with line items, alternates, images, and a grand total | Aggregate returns `grandTotalCents=0`, `phases=[]`, `optionGroups=[]`, `images=[]` for the real flow — patient sees an **empty ₱0 plan** |
| Patient accepts → immutable consent e-sig written, plan → approved, presentation decision=accepted | Accept throws **422 `PLAN_HAS_NO_ITEMS`** ("Plan has no linked treatment items to consent to") — cannot complete |
| Patient declines → plan → rejected, reason persisted | **Works** (live: 200, plan→rejected) |
| Demo/seed supports the full journey for E2E + manual review | **Zero** `dental_treatment_plans` across all 20 seeded patients → "Present to patient" button never renders → module UI-unreachable |

---

## Critical Gaps

| # | Gap | Area | Severity | Why it matters | Recommended fix |
|---|-----|------|----------|----------------|-----------------|
| G1 | Pending treatments are **never linked to the plan** before presentation. The only writer of `dentalTreatments.treatmentPlanId` is `linkPendingTreatmentsToPlan`, invoked **only** by `approveTreatmentPlan.ts` (downstream of presentation). The aggregate (`getTreatmentsByPlanForPatient` = `WHERE treatmentPlanId = planId`) is therefore structurally empty, and `acceptCasePresentation` throws `PLAN_HAS_NO_ITEMS` (its `findPlanVisitId` returns null). | Backend / data wiring | **P0** | Blocks the entire accept workflow + the patient sees a ₱0 plan. The module's core purpose cannot be completed in the real flow. | Link pending treatments to the plan at the **`presented` transition** (`updateTreatmentPlan` when `to==='presented'`) and/or in `createCasePresentation`, mirroring what `approveTreatmentPlan` already does. Then the aggregate is populated and accept's visit/consent anchor resolves. |
| G2 | Demo seed creates **no plan-level treatment plans** (only visit-level treatment line items). Across 20 patients: 0 plans. So `plan.status==='presented'` never occurs → "Present to patient" button never renders → module is unreachable through the UI and through any demo-seed E2E. | Seed / testability | **P1** | The P0 above went undetected precisely because the flow is unreachable. No demo, no manual QA, no E2E can exercise it. | Seed at least 2–3 plans across the FSM (`draft`, `presented`, `accepted/approved`, `rejected`) with linked treatments, plus ≥1 alternate `optionGroup` and ≥1 annotated image, so the aggregate is non-empty. |
| G3 | **Two divergent approval paths** with different side effects. `approveTreatmentPlan.ts` links pending treatments + records a `TreatmentPlanApproval` entity; `acceptCasePresentation.ts` transitions presented→approved + writes a consent e-sig but does **not** link treatments and does **not** record a `TreatmentPlanApproval`. Same business event, two code paths, divergent persisted truth. | Backend / consistency | **P1** | Source-of-truth drift: an accepted case-presentation yields an approved plan with no linked items and no approval record; the other path yields the opposite. Reporting/AR/treatment-completion that reads either will disagree. | Converge: have `acceptCasePresentation` reuse the same link + approval-record logic (call the shared repo method), or refactor both onto one `approvePlan(planId, {consent})` service. |
| G4 | Annotated imaging refs are surfaced in the aggregate (`images[]`) and rendered as chips, but are **not openable** in the patient view (no click → no overlay/presigned download). The TypeSpec comment promises "the FE reuses the imaging overlay + presigned-download pattern." | Frontend | **P3** | Patient cannot actually see the x-ray/photo being discussed — Phase-2 polish, not a blocker. | Wire the image chip to the existing imaging overlay/presigned-download (Phase 2). |
| G5 | `getCasePresentation` performs a **write on GET** (engagement telemetry: `firstViewedAt`/`lastViewedAt`/status draft→viewed). Intentional + documented, idempotent. | Backend | **P3 (note only)** | Acceptable, but a GET with side effects can surprise caching/retries and double-counts on FE refetch. | Leave as-is; document. Optionally move to an explicit `POST .../view` if telemetry accuracy matters. |

---

## Broken / Misleading Journeys

1. **Present → patient reviews → accept (P0, BROKEN end-to-end).** Live-proven: presentation created from a `presented` plan shows ₱0 / 0 items; tapping Accept returns 422 `PLAN_HAS_NO_ITEMS`. The patient-facing surface is misleading (greets the patient, shows a signature pad and "Estimated total") for a plan that has no content and cannot be accepted.
2. **Reach the module at all (P1).** With no seeded `presented` plan, the "Present to patient" button (`present-to-patient-btn`, gated on `plan.status==='presented' && canPresentCase(role)`) never appears. The only way to exercise the module today is hand-crafted API calls.
3. **Reject (WORKS).** Decline → reason popover → confirm → plan rejected. Live-verified 200.

---

## Unused / Unwired Implementation

- **Backend complete, FE-reachability zero.** All 5 endpoints (create/list/get/accept/reject) are registered and SDK-wired, and the FE route + hooks + components exist — but the upstream data (a `presented` plan with linked items) is never produced by seed or by the normal create→present path, so the wired chain has no live input.
- **`shareToken` / `shareTokenExpiresAt` columns** on `dental_case_presentations` are reserved for Phase-2 public links — nullable, no handler reads/writes them. Correct (deferred), noted for completeness.
- **`planVersionId`** is accepted on create and passed to the consent record but is never surfaced or used by the FE. Loose ref by design.

---

## Test Gaps

| Layer | Existing | Gap |
|---|---|---|
| Backend unit | `case-presentation.test.ts` (AC1–AC8, E1 roles), `case-presentation-route-registration.test.ts` | **Masks G1**: fixture inserts treatments with `treatmentPlanId` pre-set (lines 157–178), so accept "works" in the test while the real flow has no link step. No test drives **create-plan → present → create-presentation → accept** with treatments created the *normal* way (unlinked). |
| Contract (hurl) | `dental-treatment-coordinator.hurl` (role create/list) | No contract assertion that a presented plan's aggregate is **non-empty**, or that accept succeeds from the real flow. Status-code-only coverage hides G1. |
| Frontend unit | `case-presentation-view.test.tsx` (phases, ₱, alternates, recommended badge, decided banner, USD-leak, signature gating) | Props-driven only; never exercises the empty-aggregate state (which is the real-world state). No test asserting the view should warn/disable accept when the plan has no items. |
| Integration | none across modules | No test for the **two-approval-path divergence** (G3) or for treatments being linked at `presented`. |
| E2E | none reachable | No journey covers present→accept (can't — G2). |

---

## Recommended Fix Order (tests before/with each fix)

1. **G1 (P0) — link treatments before presentation.**
   - *RED first:* backend test that creates a plan, creates treatments the **normal** way (no manual `treatmentPlanId`), transitions to `presented`, creates a presentation, and asserts the aggregate `grandTotalCents > 0` and `accept` returns 200 with a consent id. This fails today.
   - *GREEN:* link pending treatments at the `presented` transition (and/or in `createCasePresentation`).
   - Add a contract assertion: GET aggregate after present → `phases.length > 0`.
2. **G3 (P1) — converge the two approval paths.**
   - *RED:* test asserting that after `acceptCasePresentation`, the plan has linked items **and** a `TreatmentPlanApproval` record (or an explicit decision: only one path should exist).
   - *GREEN:* refactor accept to reuse the approve link/record logic, or route both through one service.
3. **G2 (P1) — seed coverage.**
   - Add presented/accepted/rejected plans with linked items + an alternate option group + an annotated image to `seed-demo.ts`/`seed-supplement.ts`.
   - *Then* add an **E2E journey**: clinician presents → "Present to patient" visible → navigate → patient sees non-empty ₱ plan → accept (e-sign) → decision banner; and a sibling decline journey.
4. **G4 (P3) — clickable images** (Phase 2): wire image chip → imaging overlay/presigned download; FE test for the open interaction.
5. **G5 (P3 note):** document the GET side effect or move telemetry to an explicit endpoint.

---

## Dependencies on Other Modules (blast radius)

- **dental-visit** (`visit-treatment-plan.facade.ts`): owns `linkPendingTreatmentsToPlan` + `getTreatmentsByPlanForPatient` — **the fix for G1 lives here / at its callsites.** Also owns `TREATMENT_PHASE_ORDER`.
- **dental-patient/treatment-plans** (`updateTreatmentPlan.ts`, `approveTreatmentPlan.ts`, `treatment-plan.repo.ts`): the `presented`/`approved` transitions and the divergent approval path (G3).
- **dental-clinical** (`case-presentation-consent.facade.ts`): immutable acceptance consent e-sig written on accept.
- **dental-imaging** (`case-presentation-imaging.facade.ts`): annotated image refs (G4).
- **patient** (`patient-dental-patient.facade.ts`): patient resolution + branch/role gating.
- Changing the link timing (G1) affects anything that reads `treatmentPlanId`-scoped treatments (plan completion %, billing-from-plan). Verify treatment-completion and invoice-from-plan flows after the fix.

---

## Knowledge-Graph / Wiring Findings

- **TypeSpec → handler → route → SDK → FE: fully wired** for all 5 operations (create/list/get/accept/reject). No orphan ops, no unregistered handlers, no missing SDK fns.
- **FE contract:** `use-case-presentation.ts` correctly maps the SDK aggregate and coerces `decision ?? null` (SDK enum omits the null variant) — defensive, fine.
- **The break is not in the wiring graph — it is a missing *data-linking edge*** between `dentalTreatments` and `dentalTreatmentPlans` in the present-time path. The graph shows the consumer (`getTreatmentsByPlanForPatient`) but the producer (`linkPendingTreatmentsToPlan`) is only reachable from `approveTreatmentPlan`, never from the present path.
- **Sole writer of `treatmentPlanId`:** `visit-treatment-plan.facade.ts:24` (`.set({ treatmentPlanId: planId })`). Confirmed by exhaustive grep.

---

## Existing Tests Found

- `services/api-ts/src/handlers/dental-patient/case-presentation.test.ts`
- `services/api-ts/src/handlers/dental-patient/case-presentation/case-presentation-route-registration.test.ts`
- `apps/dentalemon/src/features/case-presentation/case-presentation-view.test.tsx`
- `specs/api/tests/contract/dental-treatment-coordinator.hurl`

## Missing Tests (add before/with fixes)

- **Backend (P0):** present→create-presentation→accept with **normally-created** (unlinked) treatments → aggregate non-empty + accept 200. *(currently impossible — this is the regression pin for G1.)*
- **Backend (P1):** accept links items + records approval (G3 convergence).
- **Backend:** `presented` transition links pending treatments (unit on `updateTreatmentPlan`).
- **Contract:** GET aggregate after present → `phases.length > 0` + accept 200.
- **Frontend:** view renders an explicit empty/disabled-accept state when `phases.length===0` (so the UI never invites signing an empty plan).
- **E2E:** present→accept (e-sign) and present→decline journeys, once seed (G2) provides a presented plan.

---

## [NEEDS CONFIRMATION]

1. **Intended link timing** — is the product intent that a plan's items attach at **create**, at **presented**, or only at **approve/accept**? The fix (G1) depends on this. Current code attaches only at the standalone `approveTreatmentPlan`, which is incompatible with the case-presentation accept path. *(Recommended: attach at `presented`.)*
2. **Two approval paths (G3)** — is `acceptCasePresentation` meant to be the *only* patient-acceptance path, with `approveTreatmentPlan` reserved for staff/manual approval? If so, they must be reconciled to persist the same truth.
3. **"Present to patient" button appears for an API-seeded presented plan** — not visually confirmed in-browser (the deep route is PIN-gated and every `goto` drops the in-memory PIN-unlock, bouncing to the profile picker). Auth/PIN/dashboard/patients/profile were all confirmed live; the carousel "Present" button + empty-plan render should be confirmed via pure in-SPA click navigation (no full reload) once G2 seeds a presented plan.
4. **GET-with-write telemetry (G5)** — confirm this is acceptable for offline/local-first replay and FE refetch double-counting.

---

### Live evidence (this audit)

```
POST /dental/patients/{p}/treatment-plans            -> 201 status=draft
PATCH .../treatment-plans/{plan} {status:presented}  -> 200 status=presented
POST .../case-presentations {treatmentPlanId}        -> 201 (draft)
GET  .../case-presentations/{cp}                      -> 200 grandTotalCents=0 phases=0 items=0 images=0   <-- EMPTY
POST .../case-presentations/{cp}/accept              -> 422 "Plan has no linked treatment items to consent to"  <-- BLOCKED
POST .../case-presentations/{cp}/reject              -> 200 plan.status=rejected decision=rejected           <-- OK
treatment-plans across 20 seeded patients            -> 0
```
