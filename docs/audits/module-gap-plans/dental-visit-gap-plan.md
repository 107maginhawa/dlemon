# dental-visit — Module Gap Plan

**Module:** `dental-visit` (clinical visit workspace: visits, odontogram/chart, treatments, treatment plans, visit notes, treatment templates, tooth history)
**Audit date:** 2026-06-09
**Auditor:** Claude (live drive via `/browse`, persona Dr. Maria Reyes `dentist_owner`, patient Maria Santos)
**References:** `docs/context/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md` (§3.4/3.5/3.6/3.7, §4.1–4.4, §5.3–5.6), `specs/api/src/modules/dental-visit.tsp`, prior `runs/dental-visit/DRY-RUN-REPORT.md`
**Mode:** report-only. No fixes applied.

---

## Audit Decision: **PARTIAL PASS**

The core same-visit chairside workflow is reliable and RBAC-safe: visit lifecycle (`draft→active→completed→locked`), FDI odontogram with separated Baseline/Proposed/Completed layers, per-tooth/surface charting, treatment FSM (`diagnosed→planned→performed→verified`), SOAP notes (draft/sign/addendum), treatment-plan accept + clinical phasing, perio, imaging, PMD all work live and backend RBAC is enforced (`assertBranchRole`). The gaps are **built-but-unwired backend features** (treatment templates, carry-over, accepted-plan version view) and **FE affordance/UX coherence** — none break the core same-visit flow, but carry-over and accepted-plan traceability are real V1 trust/workflow gaps.

Severity scale: **P0** blocks core workflow / safety-security · **P1** serious functional/workflow/trust gap · **P2** important not blocking · **P3** minor/polish.

---

## Expected vs Actual

**Expected (IDEAL standard §3.4–3.7, §4.1–4.4):** Per-visit clinical encounter + odontogram with baseline/proposed/completed separation; record diagnoses → proposed work → approved plan; complete approved/same-day work; carry forward unfinished work across visits; common-procedure templates/bundles; signed clinical notes with addendum-only amendment; per-tooth history; auditable corrections.

**Actual:** All of the above are implemented end-to-end **except** that three fully-built backend capabilities have **no frontend consumer**, so the user-facing workflow is narrower than the backend:
- **Treatment templates** (5 endpoints, routed + **seeded**) — no UI at all.
- **Carry-over** (`POST /carry-over`, FR1.11) — no UI affordance; the "Carried Over" subtotal only renders from seed data.
- **Accepted treatment-plan version** (`getTreatmentPlanVersion`) — `acceptTreatmentPlan` writes an immutable signed snapshot, but nothing surfaces it.

Backend RBAC verified enforced; some FE affordances render for roles the backend then rejects (misleading, not unsafe).

---

## Critical Gaps

| # | Gap | Area | Severity | Why It Matters | Recommended Fix |
|---|-----|------|----------|----------------|-----------------|
| G1 | **Carry-over has no FE trigger.** `carryOverTreatments` (`POST /dental/visits/:id/carry-over`, FR1.11) is built + backend-tested, but no component calls it. `carriedOverItems = treatmentPlan.treatments.filter(t => t.carriedOver)` and `carriedOver` is set **only** by that endpoint → in live use the "Carried Over" section/subtotal is dead (populated only by seed). Live drive: zero carry/template text in the active-visit DOM. | Workflow / cross-visit completion (§4.4) | **P1** | A dentist cannot bring an unfinished planned treatment from a prior visit into today's visit to perform + bill it. The UI implies the capability (subtotal row exists) but offers no way to produce it. Either a missing workflow or a misleading affordance. | First confirm product intent (carry-over vs mark-done-in-place). If intended: add "Carry forward from previous visit" on a new/active visit wiring `POST /carry-over`. If not: remove the dead "Carried Over" UI. `[NEEDS CONFIRMATION]` |
| G2 | **Accepted treatment-plan version not viewable.** `acceptTreatmentPlan` creates an immutable `TreatmentPlanVersion` snapshot; `getTreatmentPlanVersion` exists and is routed, but no FE surfaces it. After "Accept Plan" there is no way to review what was accepted/signed. | Traceability / trust (TP-BR-007) | **P2** | Patient approval is recorded but the signed snapshot can't be reviewed later — weak legal/clinical traceability for an approved plan. | Add a read-only "View signed plan / version history" affordance in the Treatment Plan sheet wiring `getTreatmentPlanVersion` (+ a versions list). Read-only, low risk. |
| G3 | **Treatment Templates fully built + seeded but zero FE.** All 5 ops (`list/create/update/delete/applyTemplate`) are real handlers, route-registered, and seeded in `scripts/seed-demo.ts` (`treatmentTemplateIds`). No component references any of them. | Unused implementation / §3.6 V1-Recommended | **P2** | A shipped, seeded V1-Recommended feature (common procedure bundles) is invisible. Fast clinical entry benefit is lost; seeded data is orphaned. | Wire an "Apply template" action in the tooth/treatment-entry path + a template-manage screen under clinic settings. OR formally defer and remove the seed. |
| G4 | **FE affordance ≠ backend RBAC for chart-edit & treatment-create.** Backend correctly gates `upsertDentalChart`/`updateTooth` and `createDentalTreatment` via `assertBranchRole`. FE renders "Mark Done" / treatment-add / tooth-edit affordances without a role check (`tooth-slideout.tsx`, `treatment-table.tsx` have no `canEditChart`/`canAddTreatment` gate). Note-sign, Rx, Consent **are** FE-gated correctly. | RBAC / UX coherence | **P3** (not a security hole — backend is the real gate) | A `dental_assistant`/`front_desk` user sees clinical-edit affordances that 403 on click → confusing, looks broken, erodes trust. | Gate the affordances in FE with `canEditChart(role)` / `canAddTreatment(role)` from `lib/rbac.ts` (already present). Pure FE, mirrors backend. |
| G5 | **Redundant unused endpoints (covered elsewhere).** `getDentalVisit` (list + per-card chart cover it) and `updateTooth` (bulk `upsertDentalChart` covers it) have no FE caller. | Unused implementation | **P3** | Harmless redundancy / API surface drift; no user impact. | Document as intentionally-redundant; do not remove without a deprecation pass. |
| G6 | **View toggles not persisted.** Chart layer toggle (baseline/proposed/completed) and year filter are local React state; reset on reload / visit switch. | UX polish | **P3** | Minor; expected for ephemeral view state. Chairside users may re-toggle each session. | Optional: persist to branch/user settings if chairside feedback warrants. |

---

## Broken / Misleading Journeys

1. **Carry unfinished work into today's visit (G1):** the "Carried Over" subtotal section implies the capability but there is no UI to trigger `POST /carry-over`; only seed-created `carriedOver` rows ever appear. Real-use journey is absent.
2. **Review an accepted/signed treatment plan (G2):** "Accept Plan" succeeds (writes a signed version) but the user can never view the signed snapshot afterward.
3. **Misleading clinical-edit affordances for restricted roles (G4):** assistants/front-desk see Mark-Done / add-treatment / tooth-edit controls that backend rejects on click.

> No coherence bug in the visit breakdown: live totals were consistent (₱800 + ₱3,500 = ₱4,300 grand total, "2 pending"). The header "↑ 47 pending" pill is the **SyncStatusBadge** (records pending sync), not a treatment count — not a mismatch.

---

## Unused / Unwired Implementation (built, not consumed)

| Backend capability | Status | FE consumer |
|---|---|---|
| `applyTemplate`, `listTreatmentTemplates`, `createTreatmentTemplate`, `updateTreatmentTemplate`, `deleteTreatmentTemplate` | Real handlers, routed, **seeded** | **None** (G3) |
| `carryOverTreatments` (`POST /carry-over`) | Real handler, backend-tested | **None** (G1) |
| `getTreatmentPlanVersion` | Real handler, routed | **None** (G2) |
| `getDentalVisit` | Real handler, routed | None — covered by list + chart (G5) |
| `updateTooth` (single-tooth PATCH) | Real handler, routed | None — covered by `upsertDentalChart` (G5) |

---

## Recommended Fix Order (safest first)

1. **G4 (P3, FE-only, zero backend risk):** gate chart-edit / treatment-create affordances with existing `lib/rbac.ts` helpers. Removes misleading affordances; mirrors enforced backend.
2. **G2 (P2, read-only):** surface accepted-plan version viewer wiring `getTreatmentPlanVersion`. Read-only, closes traceability gap, no write paths touched.
3. **G3 (P2):** wire treatment-templates "Apply template" + manage UI (or formally defer + remove seed). High value, backend already done + tested.
4. **G1 (P1, do last — needs product decision):** confirm cross-visit completion model, then either wire `POST /carry-over` affordance or remove the dead "Carried Over" UI. Last because it changes a clinical-workflow shape and depends on a product call.
5. **G5 / G6 (P3):** document redundancy; optionally persist view toggles — defer.

---

## Dependencies on Other Modules

- **G3 template-manage UI** → clinic settings surface (`dental-org` settings area).
- **G4 affordance gating** → `org-context` role store + `lib/rbac.ts` (both already present). No backend change.
- **G2 / G1 / template-apply** → self-contained within `dental-visit`; treatment-plan accept already wired. `acceptTreatmentPlan`'s optional `consentFormId` links to the consent surface (`dental-patient`/person) — optional, not required for the version viewer.
- No schema/migration changes required (all backend endpoints + tables exist).

---

## Tests Required Before "Fixed"

- **G4:** FE unit — affordances hidden for `dental_assistant` / `front_desk` / `billing_staff`, shown for `dentist_owner` / `dentist_associate` (RED→GREEN). E2E: restricted role cannot reach Mark-Done / add-treatment.
- **G2:** FE unit — version viewer renders snapshot from `getTreatmentPlanVersion`; "Accept Plan" then a version appears in history.
- **G3:** FE unit + E2E — list templates → apply to active visit → treatments created and appear in the breakdown. (Backend template handlers already tested.)
- **G1:** FE unit + E2E — carry-over affordance calls `POST /carry-over`; "Carried Over" subtotal then populates from real (non-seed) data. If removed instead: assert no dead "Carried Over" UI renders when no `carriedOver` items exist.
- **Regression gate:** `bun test` (api-ts + apps/dentalemon) + `bun run typecheck` green, no regressions. Backend needs no change for G2/G4/G5.

---

## `[NEEDS CONFIRMATION]`

1. **Cross-visit completion model (G1):** Is carry-over (`POST /carry-over`) the intended way to perform a prior-visit planned treatment today, or is mark-done-in-place on the original visit the design (making the carry-over endpoint + "Carried Over" UI redundant)? Decides wire-vs-remove for G1.
2. **Treatment templates (G3):** V1-surface now (it is built + seeded) or formally defer? If defer, remove the seed to avoid orphaned data.
3. **Accepted-plan version viewer (G2):** Is post-acceptance review required for V1? TP-BR-007 requires approval be *recorded* (satisfied); *viewing* the signed snapshot may be V1-Recommended rather than required.

---

## Evidence

- Live drive (logged in, dentist_owner, patient Maria Santos): `outputs/dental-visit-audit/screenshots/01-workspace.png` (odontogram + layers + breakdown ₱4,300), `02-treatment-plan.png` (Accept Plan + phase-assign + Decline; no version/history affordance).
- Active-visit DOM affordance set: Rx, Consent, Notes/Medical-History, Attachments, Treatment Plan, Complete visit, year filter, Imaging/Perio/Recalls/Plans tabs, Compare, Lock Visit, layer toggles, +New Visit, per-treatment Mark-Done/Dismiss/Decline/price-edit, Continue to Payment. **No** Apply-Template, **no** Carry-Over (text grep = empty).
- Backend RBAC confirmed: `createDentalTreatment.ts:36`, `upsertDentalChart.ts:34`, `updateTooth.ts:38` all `assertBranchRole(...)`.

---

# Addendum — Knowledge-Graph & Test-Coverage Validation (2026-06-09)

**Method:** Validated the saved findings against the current knowledge graph (`.understand-anything/knowledge-graph.json` + `contract-spine.json`, both rebuilt 2026-06-09 12:24; no `dental-visit` source files changed since, so the graph is fresh for this module — KG **not** regenerated). Cross-checked the operationId→handler→SDK→FE-consumer spine, `lib/rbac.ts`, the FE workspace components/tests, the backend handler tests, the Hurl contract suite, and the Playwright E2E/journey specs. No fixes applied.

## 1. Existing Audit Validation

All six findings are **CONFIRMED** against the contract-spine wiring. Adjustments/corrections:

- **G1 (carry-over) — CONFIRMED.** `carryOverTreatments` (`POST /dental/visits/{visitId}/carry-over`) → consumers `[]`. No FE caller. Backend **is** tested (`dental-treatment.test.ts` BR-008 + EM-VIS-002 explicit `sourceVisitId`) and **contract**-tested (`dental-clinical.hurl` #34–35). So the gap is purely FE/E2E.
- **G2 (accepted-plan version viewer) — CONFIRMED, with a module correction.** `getTreatmentPlanVersion` → consumers `[]`. **Correction:** the handler is `dental-patient/treatment-plans/getTreatmentPlanVersion.ts` and `acceptTreatmentPlan` is `dental-patient/treatment-plans/acceptTreatmentPlan.ts` — both live in **`dental-patient`**, not `dental-visit`. The accept path **is** wired (`use-treatment-plan.ts` → `acceptTreatmentPlan`) and E2E-covered by `journeys/09-plan-versioning.journey.spec.ts` (drives Accept through the UI, confirms a new immutable version froze via an independent API read). What is missing is the **read-back viewer** for `getTreatmentPlanVersion`. ⇒ The G2 fix is **cross-module** (touches `dental-patient`), correcting the plan's "self-contained within dental-visit" note. `[NEEDS CONFIRMATION]` whether the viewer belongs in the visit workspace or the patient treatment-plan surface.
- **G3 (treatment templates) — CONFIRMED.** All 5 ops (`list/create/update/delete/applyTemplate`, `dental-visit/templates/*`) → consumers `[]`. Backend tested (`dental-visit.treatment-templates.test.ts`, 59 assertions) and **contract**-tested (`dental-clinical.hurl` #31–33 incl. `apply-template`). Gap is FE/E2E only.
- **G4 (FE affordance ≠ backend RBAC) — CONFIRMED.** `lib/rbac.ts` exports `canEditChart` (L279) and `canAddTreatment` (L365), but **neither** `tooth-slideout.tsx` nor `treatment-table.tsx` imports `lib/rbac` (only `treatment-plans-sheet.tsx`, `soap-notes-sheet.tsx`, `workspace-top-bar.tsx` do). The contract-spine listing `lib/rbac.ts` as a "consumer" of `createDentalTreatment`/`upsertDentalChart`/`updateTooth` reflects the *helper definitions*, not actual component gating. Severity **P3** holds (backend `assertBranchRole` is the real gate).
- **G5 (redundant endpoints) — CONFIRMED.** `getDentalVisit` → consumers `[]`; `updateTooth` → consumers `["lib/rbac.ts"]` only (a helper map, not a real caller) — effectively unwired, covered by `upsertDentalChart`.
- **G6 (view toggles not persisted) — CONFIRMED** (no graph signal needed; local React state).

## 2. Knowledge Graph Findings (wiring / dependency / blast-radius)

- **Confirmed-unwired (consumers `[]`):** `applyTemplate`, `createTreatmentTemplate`, `updateTreatmentTemplate`, `deleteTreatmentTemplate`, `listTreatmentTemplates`, `carryOverTreatments`, `getTreatmentPlanVersion`, `getDentalVisit`. These are the entire FE backlog for this module.
- **Cross-module blast radius:** the treatment-plan accept/version family is owned by **`dental-patient`** (`treatment-plans/`), consumed via `use-treatment-plan.ts`/`use-treatment-plans.ts`. G2's fix therefore spans `dental-patient` + the visit workspace UI. G1 (carry-over) and G3 (templates) are genuinely **`dental-visit`**-owned.
- **Heavily-wired core (regression-sensitive):** `listDentalTreatments` (6 consumers incl. reports), `getDentalChart` (5), `listDentalVisits` (5), `updateDentalTreatment` (3) — any G1/G3 change that mutates treatments must not regress these read paths or `use-treatment-report.ts` (reports module depends on `listDentalTreatments`/`listDentalVisits`).
- **RBAC seam:** `lib/rbac.ts` is the shared gate consumed by `soap-notes-sheet`, `workspace-top-bar`, `treatment-plans-sheet`, `consent-sheet`. G4 just extends this existing pattern to two more components — low blast radius, established precedent.

## 3. Existing Test Coverage Found

| Layer | Coverage |
|---|---|
| **Backend unit** (`handlers/dental-visit/`) | Strong: `dental-visit.treatment-templates.test.ts` (59), `dental-visit.treatment-plan-versioning.test.ts` (8), `dental-treatment.test.ts` (carry-over BR-008 + EM-VIS-002), FSM property tests (`treatment.fsm.property`, `visit.fsm.property`), `treatment-fsm-http`, `dental-visit.signed-notes`, `dental-visit.cross-tenant-rbac`, `dental-visit.revenue-path-regression`, `dental-visit.treatment-status-transitions`, `visit-note-persistence`, `surface-condition-map`, `dental-assistant.clinical-assist`, `hygienist.hygiene-visit`. |
| **Contract** (Hurl) | `dental-visit.hurl` (visit/chart/tooth/treatments/consent/notes/history); `dental-clinical.hurl` (templates CRUD + `apply-template` + `carry-over`); `dental-patient.hurl` (`treatment-plan/versions/{id}` GET). |
| **FE unit** | `tooth-slideout.test.ts` (10), `treatment-table.test.ts` (15), `treatment-decline.test.ts`, `treatment-plan-tab.test.ts`, `dental-chart.test.ts` + helpers, `soap-notes-sheet.test.ts` (**role-gated** Sign&Lock — pattern to copy for G4), `workspace-top-bar.test.ts` (role-gated), `payment-summary-bar.test.tsx`, `timeline-carousel.test.ts`, hooks (`use-save-treatment`, `use-mark-treatment-done`, `use-save-chart`, `use-treatment-plan`, `use-visits`, `use-create-visit`, …). |
| **E2E / journeys** | `returning-patient-visit.spec.ts` (chart 32 teeth, slideout, per-surface condition, Continue-to-Payment, new-visit), `workspace-readonly.spec.ts` (read-only after checkout), `ipad-workspace.spec.ts`, `journeys/09-plan-versioning` (accept→version froze, verified via API read). |

**Net:** Backend + contract layers for **all** gap features are already GREEN. The deficits are entirely **FE-unit** and **E2E** (because the features have no FE consumer yet), plus **G4 role-gating** FE tests.

## 4. Missing Test Coverage

| Gap / Risk | Missing Test | Test Type | Priority | Why It Matters |
|---|---|---|---|---|
| **G4** chart-edit affordance ungated | `tooth-slideout.test.ts`: condition/Mark-Done/save affordance hidden (or disabled) for `dental_assistant`/`front_desk`/`billing_staff`, shown for `dentist_owner`/`dentist_associate` via `canEditChart` | FE unit | **P0** (write before fix — RED first) | The fix is a behavior change to a clinical-edit affordance; a RED→GREEN gate proves it and prevents silent regression. Pattern exists in `soap-notes-sheet.test.ts`. |
| **G4** treatment-add affordance ungated | `treatment-table.test.ts`: add-treatment control gated by `canAddTreatment(role)` | FE unit | **P0** | Same as above for the treatment-entry path. |
| **G4** restricted role hits gated UI end-to-end | E2E: log in as `dental_assistant`, open workspace → no Mark-Done / add-treatment / tooth-edit controls (no 403 round-trip) | E2E | **P1** | Confirms FE gate matches backend `assertBranchRole`; no current E2E asserts hidden clinical-edit affordances by role. |
| **G2** version viewer renders snapshot | FE unit: viewer component renders the frozen snapshot from `getTreatmentPlanVersion` (mock SDK), shows version list | FE unit | **P1** (during fix) | Feature has zero FE coverage; viewer is the missing piece. |
| **G2** accept→view round-trip | Extend `journeys/09-plan-versioning` (or new spec): after Accept, the signed snapshot is **viewable** in the UI (not just confirmed via API read) | E2E | **P2** | Closes the traceability journey end-to-end through the DOM, not a side-channel API read. |
| **G3** apply-template creates treatments | FE unit: "Apply template" action → `applyTemplate` called → treatments appear in breakdown (mock SDK) | FE unit | **P1** (during fix) | Seeded V1 feature is invisible; no FE test exists. |
| **G3** template-manage CRUD UI | FE unit: list/create/update/delete template screen wiring the 4 CRUD ops | FE unit | **P2** | If templates are surfaced under clinic settings, the management surface needs coverage. |
| **G3** apply-template user journey | E2E: open active visit → apply template → treatments created + visible | E2E | **P2** | No E2E exercises templates through the FE. |
| **G1** carry-over affordance calls endpoint | FE unit: "Carry forward from previous visit" → `carryOverTreatments` called → "Carried Over" subtotal populates from response | FE unit | **P1** (during fix, pending product decision) | The "Carried Over" subtotal currently only renders from seed; no FE produces it. |
| **G1** carry-over user journey **OR** dead-UI removal | E2E: carry forward an unfinished prior-visit treatment into today → perform + bill. **If removed instead:** assert no "Carried Over" UI renders when there are zero `carriedOver` items. | E2E | **P1** | Either prove the workflow exists or prove the misleading affordance is gone. Depends on the G1 product decision. |
| **G1/G3** read-path regression | Assert `listDentalTreatments`/`listDentalVisits`/treatment-report read paths unchanged after carry-over/template writes | FE unit / E2E | **P2** | These ops have 5–6 consumers incl. the reports module; protect against breakage. |
| **G5** redundancy intentional | Doc-only note (no test) that `getDentalVisit`/`updateTooth` are intentionally redundant | — | **P3** | Prevents a future "unwired ⇒ delete" mistake without a deprecation pass. |
| **G6** toggle persistence | If persisted: FE unit that layer/year toggle survives reload/visit-switch | FE unit | **P3** | Only if chairside feedback warrants persistence. |

## 5. Fix Plan Adjustments

- **No backend or contract RED is needed for any gap** — those layers are already GREEN for templates, carry-over, and version-read. All TDD here is **FE-unit-first → component → E2E**. This simplifies every fix.
- **G2 is cross-module** (`dental-patient` owns the version handler/hooks), not self-contained in `dental-visit` as the original plan stated. Scope the viewer fix to touch `dental-patient/treatment-plans` consumers + the chosen UI surface. `[NEEDS CONFIRMATION]` on which surface (visit workspace vs patient treatment-plan sheet).
- **G4 has a copy-paste precedent** (`soap-notes-sheet.test.ts` + `workspace-top-bar.test.ts` role gates) — cheapest, lowest-risk, keep it first.
- **G1/G3 must include a read-path regression assertion** because `listDentalTreatments`/`listDentalVisits` feed the reports module (6/5 consumers).

## 6. Updated Test-First Fix Sequence (safest first)

1. **G4 (FE-only, precedent exists):**
   1. RED — add `tooth-slideout.test.ts` + `treatment-table.test.ts` cases asserting affordances hidden for `dental_assistant`/`front_desk`/`billing_staff`, shown for dentists (copy `soap-notes-sheet.test.ts` `useOrgContextStore.setState({ role })` pattern).
   2. Fix — import `canEditChart`/`canAddTreatment` from `lib/rbac.ts`; gate the controls.
   3. GREEN — unit pass + add the restricted-role E2E (no Mark-Done/add-treatment visible).
2. **G2 (read-only, cross-module):**
   1. RED — FE unit: version-viewer renders snapshot from a mocked `getTreatmentPlanVersion`.
   2. Fix — add viewer + versions list wiring the handler (in the confirmed surface).
   3. GREEN — unit pass; extend `journeys/09-plan-versioning` to assert the snapshot is **viewable** post-accept.
3. **G3 (templates):**
   1. RED — FE unit: apply-template action calls `applyTemplate` → treatments appear; (optional) manage-CRUD unit.
   2. Fix — wire "Apply template" in the tooth/treatment-entry path (+ manage screen under clinic settings) **or** formally defer and remove the seed.
   3. GREEN — unit pass + apply-template E2E + read-path regression assertion.
4. **G1 (carry-over, do last — product decision):**
   1. RED — FE unit: carry-over affordance calls `carryOverTreatments` and "Carried Over" subtotal populates **from the response** (not seed). *If the decision is "remove":* RED asserts no "Carried Over" UI when zero `carriedOver` items.
   2. Fix — wire `POST /carry-over` affordance **or** delete the dead subtotal UI.
   3. GREEN — unit + carry-over E2E (or dead-UI-absent assertion) + read-path regression.
5. **G5/G6 (P3):** doc the intentional redundancy; persist toggles only if warranted.

**Regression gate (unchanged):** `bun test` (api-ts + apps/dentalemon) + `bun run typecheck` green, no regressions. Backend untouched for G2/G4/G5; G1/G3 backend already tested — only FE/E2E added.

## Cross-Module Dependencies / Blast Radius (updated)

- **G2 → `dental-patient`** (`treatment-plans/getTreatmentPlanVersion.ts`, `acceptTreatmentPlan.ts`) + `use-treatment-plan.ts`. **Correction** to the original "self-contained within dental-visit."
- **G3 template-manage UI → `dental-org`** clinic-settings surface (unchanged).
- **G4 → `lib/rbac.ts` + `org-context` role store** (both present; established pattern). No backend change.
- **G1/G3 writes → reports module** via `listDentalTreatments`/`listDentalVisits` (6/5 consumers) — protect these read paths.
- No schema/migration changes required.
- Template handlers real + seeded: `utils/treatmentTemplates.ts`, `generated/openapi/registry.ts`, `scripts/seed-demo.ts:605`.
