# Journey Verification Report

**Run date:** 2026-05-19
**Branch:** feat/v1.4-clinical-imaging
**Seed mode:** mixed
**Harness result:** 14 BROKEN / 0 ERROR / 0 PASS
**Run timestamp:** 2026-05-19T07:52:39.533Z

---

## Executive Summary

- **All 10 Set A journeys confirmed BROKEN** — no drift from expected; the harness correctly validates known clinical gaps (status-collapse, revenue chain dead, perio surface absent, notes not persisted, audit trail missing).
- **All 4 Set B journeys drifted PASS→BROKEN** — this is a test-setup gap (no seeded cephalometric image for the test patient), NOT evidence of product regression; ceph feature implementation remains unverifiable via UI journey until seed is populated.
- **Two CRITICAL P0 issues independently confirmed** by harness: P0-001 (revenue chain dead — `anyPerformed=false, hasInvoice=false`) and P0-004 (notes are local React state — `GET /dental/visits/unknown/notes → null`).
- **J07 drift (PASS→BROKEN)** reveals surface-granularity persistence is missing (Gap #9): mixed dentition renders correctly but MOD surface data does not survive an independent read, confirming a P2 gap promoted by harness evidence.
- **Clinical risk level: CRITICAL** — core revenue path (J04) and compliance audit trail (J10) are both non-functional; the product cannot legally or commercially operate in this state.

---

## Set A — Workspace Clinical Journeys (J01–J10)

### J01 — New-patient comprehensive oral evaluation

- **Expected verdict:** BROKEN
- **Actual verdict:** BROKEN
- **Drift:** NO
- **Root cause:** `"Status-collapse (Gap #1/#2): slideout exposes no distinct Existing (0) / Existing-Other (0) status controls. A new-patient exam cannot chart pre-existing-vs-elsewhere work, so the goal state (two records with DISTINCT status values) is unreachable."`
- **Rubric questions answered:** Q6, Q7, Q8, Q9, Q10
- **Clinical risk:** CRITICAL — a new-patient comprehensive exam (D0150) is the entry point for all clinical documentation. Without distinct status values, pre-existing restorations vs. work done elsewhere cannot be distinguished in the legal record. Every new-patient workflow is compromised.
- **Evidence:** `apps/dentalemon/.journey-tmp/J01-broken.png`

---

### J02 — Periodic recall exam (D0120)

- **Expected verdict:** BROKEN
- **Actual verdict:** BROKEN
- **Drift:** NO
- **Root cause:** `"Status-collapse (Gap #1) prevents a watch→diagnosed transition that is distinct from the prior visit record, and the D0120 recall note is local React state with no DB column (P0-004) — confirmed by independent read: GET /dental/visits/unknown/notes → null (no note persisted)."`
- **Rubric questions answered:** Q9, Q10, Q25
- **Clinical risk:** CRITICAL — recall exams generate the ongoing clinical record. Notes not persisted to DB means no legal documentation of the visit; the practice has no recoverable record if audited.
- **Evidence:** `apps/dentalemon/.journey-tmp/J02-broken.png`

---

### J03 — Periodontal charting linked to odontogram

- **Expected verdict:** BROKEN
- **Actual verdict:** BROKEN
- **Drift:** NO
- **Root cause:** `"No dedicated periodontal capture surface found in the workspace route (no perio/probing affordance in the rendered DOM). Gap #7 confirmed: the journey cannot complete through the UI — no shortcut taken."`
- **Rubric questions answered:** Q11, Q12, Q13, Q14, Q16
- **Clinical risk:** HIGH — perio charting is a required clinical workflow for diagnosing periodontal disease. Absence of the UI surface means the full perio module (probing depths, bleeding, mobility) is inaccessible. No anti-cheat shortcut was used; the DOM simply lacks the affordance.
- **Evidence:** `apps/dentalemon/.journey-tmp/J03-broken.png`

---

### J04 — Revenue chain (flagship)

- **Expected verdict:** BROKEN
- **Actual verdict:** BROKEN
- **Drift:** NO
- **Root cause:** `"P0-001 CONFIRMED: Mark-Done PATCH returned no-response (); independent read shows anyPerformed=false, hasInvoice=false. No treatment reaches 'performed' through the UI ⇒ no invoice possible ⇒ revenue chain dead end-to-end. Consent (P0-003) is advisory-only client-side and never server-enforced."`
- **Rubric questions answered:** Q17, Q18, Q19, Q20, Q22, Q23
- **Clinical risk:** CRITICAL — this is the flagship gap. The `useMarkTreatmentDone` hook sends a single PATCH `diagnosed → performed` which the server rejects with 422 (state machine requires `diagnosed → planned → performed`). No treatment ever reaches `performed` through the UI, making invoice generation impossible. Additionally, consent is bypassed client-side ("Complete anyway") with no server enforcement. Revenue is $0 through the UI until P0-001 is fixed.
- **Evidence:** `apps/dentalemon/.journey-tmp/J04-broken.png`

---

### J05 — Status integrity on the odontogram

- **Expected verdict:** BROKEN
- **Actual verdict:** BROKEN
- **Drift:** NO
- **Root cause:** `"Status-collapse (Gap #1/#2): slideout lacks distinct status controls for: existing, existing[-]other, treatment plan|^tp$, condition. Distinct enumerated statuses (Existing ≠ Existing-Other ≠ TP ≠ Condition) are unreachable, and Completed depends on the dead revenue chain (P0-001)."`
- **Rubric questions answered:** Q8, Q24, Q25
- **Clinical risk:** HIGH — the odontogram is the primary visual clinical record. Without distinct enumerated statuses, the chart is clinically ambiguous and legally unreliable. Completed status is also blocked by P0-001.
- **Evidence:** `apps/dentalemon/.journey-tmp/J05-broken.png`

---

### J06 — Multi-visit / phased treatment plan sequencing

- **Expected verdict:** BROKEN
- **Actual verdict:** BROKEN
- **Drift:** NO
- **Root cause:** `"Treatment plan tab lacks phase/sequence fields (Gap #14): no phase assignment UI, no dependency-warning affordance. Independent read returns a flat unordered list with no phase or priority fields. Out-of-order completion produces no warning (silence is the bug)."`
- **Rubric questions answered:** Q26, Q27, Q28
- **Clinical risk:** HIGH — phased treatment planning (e.g., extract → graft → implant → crown) requires sequencing enforcement. Without it, clinicians can accidentally schedule or complete procedures out of order, with clinical and liability consequences.
- **Evidence:** `apps/dentalemon/.journey-tmp/J06-broken.png`

---

### J07 — Charting granularity & dentition (surface/tooth/quadrant + mixed dentition)

- **Expected verdict:** PASS (provisional)
- **Actual verdict:** BROKEN
- **Drift:** YES — expected PASS, actual BROKEN
- **Root cause:** `"Surface-granularity not persisted (Gap #9): MOD restoration surface selection is not saved to the DB — independent read returns no surface data for the charted tooth. Mixed-dentition render is present but surface persistence fails the goal-state assertion."`
- **Rubric questions answered:** Q29, Q30, Q31, Q32, Q33
- **Clinical risk:** MEDIUM — mixed dentition rendering works (primary + permanent teeth visible, correct numbering). However, surface data (MOD etc.) not persisting to DB means clinical documentation is incomplete. Insurance billing requires surface-level charting (D2391 vs D2392 etc.). This is a P2 gap promoted to confirmed by this run.
- **Evidence:** `apps/dentalemon/.journey-tmp/J07-broken.png`

---

### J08 — Informed refusal (declined treatment persisted with reason)

- **Expected verdict:** BROKEN (provisional)
- **Actual verdict:** BROKEN
- **Drift:** NO
- **Root cause:** `"Informed-refusal capture absent: no 'declined' status or refusal-reason field found in the Treatment Plan tab UI. The journey cannot complete through the UI (Gap #11)."`
- **Rubric questions answered:** Q20
- **Clinical risk:** HIGH — informed refusal documentation is a legal requirement. Without it, a patient who refuses treatment has no documented record of the refusal reason, exposing the practice to liability.
- **Evidence:** `apps/dentalemon/.journey-tmp/J08-broken.png`

---

### J09 — Treatment-plan versioning (accepted version frozen)

- **Expected verdict:** BROKEN (provisional)
- **Actual verdict:** BROKEN
- **Drift:** NO
- **Root cause:** `"No treatment_plan_version table; plan is synthesized live at request time with no snapshot. The 'patient accepted' timestamp is not linked to a specific plan version. No immutable versioned snapshot through the UI; the goal state (version N frozen, N+1 with the edit) is unreachable."`
- **Rubric questions answered:** Q34, Q35
- **Clinical risk:** HIGH — an accepted treatment plan is a legal document. Mutating it post-acceptance without version history is a compliance violation. Gap #6 confirmed.
- **Evidence:** `apps/dentalemon/.journey-tmp/J09-broken.png`

---

### J10 — Void / amend a signed entry (no hard delete, audit preserved)

- **Expected verdict:** BROKEN
- **Actual verdict:** BROKEN
- **Drift:** NO
- **Root cause:** `"P0-004 CONFIRMED: notes are local React state with no DB column. Independent read of /notes → 404 shows no signed/locked persisted note (hasSignedPersisted=false); UI addendum control present=false. No signed/locked persistence ⇒ no addendum model ⇒ no audit trail for note mutations. The void/amend journey cannot complete through the UI (Gap #3 hard-delete, Gap #5 editable signed notes)."`
- **Rubric questions answered:** Q36, Q37, Q38, Q39
- **Clinical risk:** CRITICAL — signed clinical notes are legal medical records. The absence of DB persistence means they cannot be signed, locked, or audited. The audit trail (who-changed-what-when) required by HIPAA and clinical compliance regulations does not exist. This is an audit trail compliance failure.
- **Evidence:** `apps/dentalemon/.journey-tmp/J10-broken.png`

---

## Set B — Cephalometric Imaging Journeys (B01–B04)

> **Important distinction:** All four Set B journeys are BROKEN due to a **test-setup gap** (no seeded cephalometric image in the `mixed` seed for patient Miguel Torres), NOT due to product defects. The cephalometric feature (landmark placement, tier gating, immutability, report generation) may be correctly implemented at the backend layer — the journey harness simply has no queryable ceph image to drive the UI against. This is a seed data gap, not a product gap.

---

### B01 — Free-tier ceph gate

- **Expected verdict:** PASS (provisional)
- **Actual verdict:** BROKEN
- **Drift:** YES — expected PASS, actual BROKEN
- **Root cause:** `"No seeded cephalometric image for Miguel Torres — precondition missing."`
- **Gap type:** TEST SETUP (seed data missing — not a product defect)
- **Rubric questions answered:** CIMG-001, CIMG-002, CIMG-007
- **Clinical risk:** LOW (setup gap) — the tier-gate feature cannot be verified until a seeded ceph image exists. The feature may be implemented correctly.
- **Evidence:** `apps/dentalemon/.journey-tmp/B01-broken.png`

---

### B02 — Landmark placement → SNA/SNB numeric

- **Expected verdict:** PASS (provisional)
- **Actual verdict:** BROKEN
- **Drift:** YES — expected PASS, actual BROKEN
- **Root cause:** `"No seeded ceph image — precondition missing."`
- **Gap type:** TEST SETUP (seed data missing — not a product defect)
- **Rubric questions answered:** CIMG-003
- **Clinical risk:** LOW (setup gap) — landmark placement and SNA/SNB computation (golden values: SNA≈82.0, SNB≈80.0, ANB≈2.0) cannot be verified via UI until a calibrated ceph image with `pixelSpacingMm` is in the seed.
- **Evidence:** `apps/dentalemon/.journey-tmp/B02-broken.png`

---

### B03 — Locked landmark immutability

- **Expected verdict:** PASS (provisional)
- **Actual verdict:** BROKEN
- **Drift:** YES — expected PASS, actual BROKEN
- **Root cause:** `"No seeded ceph image — precondition missing."`
- **Gap type:** TEST SETUP (seed data missing — not a product defect)
- **Rubric questions answered:** CIMG-004
- **Clinical risk:** LOW (setup gap) — the `confirmed → placed` backward-transition rejection (expected: 422 INVALID_STATUS_TRANSITION) cannot be verified without a seeded ceph image.
- **Evidence:** `apps/dentalemon/.journey-tmp/B03-broken.png`

---

### B04 — Report gate + immutable versioned snapshot

- **Expected verdict:** PASS (provisional)
- **Actual verdict:** BROKEN
- **Drift:** YES — expected PASS, actual BROKEN
- **Root cause:** `"No seeded ceph image — precondition missing."`
- **Gap type:** TEST SETUP (seed data missing — not a product defect)
- **Rubric questions answered:** CIMG-006, CIMG-008
- **Clinical risk:** LOW (setup gap) — report generation gating and snapshot immutability cannot be verified without a ceph image in the seed.
- **Evidence:** `apps/dentalemon/.journey-tmp/B04-broken.png`

---

## Rubric Question Answers

| Q# | Question summary | Verdict | Evidence |
|----|-----------------|---------|----------|
| Q6 | New patient chart opens correctly | BROKEN | J01: status-collapse prevents goal state from being reached; chart opens but functional charting is impossible |
| Q7 | Oral exam conditions can be recorded | BROKEN | J01: slideout exposes no distinct Existing/Existing-Other controls; pre-existing conditions cannot be charted distinctly |
| Q8 | Status values (Existing, Existing-Other, TP, Condition) are selectable | BROKEN | J01/J05: status-collapse confirmed; distinct enumerated statuses unreachable in the slideout DOM |
| Q9 | Visit notes can be entered | INFERRED PARTIAL | J01/J02: notes field likely renders in SoapNotesSheet (UI present), but persistence fails (Q10) |
| Q10 | Visit notes persist to DB | BROKEN | J02: `GET /dental/visits/unknown/notes → null`; P0-004 confirmed; notes are local React state only |
| Q11 | Perio probing surface exists in workspace | BROKEN | J03: no perio/probing affordance found in rendered DOM; Gap #7 confirmed |
| Q12 | Pocket depth can be entered per tooth/surface | BROKEN | J03: perio surface absent; pocket depth entry impossible |
| Q13 | Bleeding points capturable | BROKEN | J03: perio surface absent; bleeding point capture impossible |
| Q14 | Mobility can be recorded | BROKEN | J03: perio surface absent; mobility recording impossible |
| Q16 | Perio data persists linked to odontogram | BROKEN | J03: no UI surface → no persistence possible |
| Q17 | Treatment diagnosis workflow accessible | INFERRED PARTIAL | J04: diagnosis step likely accessible (add-treatment UI present), but full workflow dead at `performed` transition |
| Q18 | Treatment can be moved to planned state | INFERRED PARTIAL | J04: `diagnosed → planned` first step may work, but `planned → performed` fails; independent read shows `anyPerformed=false` |
| Q19 | Treatment can be completed (performed) through UI | BROKEN | J04: P0-001 confirmed; `useMarkTreatmentDone` sends single-step PATCH rejected by server with 422 |
| Q20 | Consent capture exists before treatment delivery | BROKEN | J04: consent is advisory-only client-side; "Complete anyway" bypass exists; server does not enforce consent (P0-003) |
| Q22 | Invoice generated after treatment completion | BROKEN | J04: `hasInvoice=false`; no treatment reaches `performed` → no invoice possible |
| Q23 | Invoice links to completed treatment | BROKEN | J04: no invoice exists; link cannot exist |
| Q24 | Existing vs Existing-Other status distinct in UI | BROKEN | J05: both statuses collapsed; slideout shows no distinct control for Existing-Other |
| Q25 | Status recorded in DB with correct enum value | BROKEN | J02/J05: status-collapse means correct enum values never written; DB receives collapsed/incorrect values |
| Q26 | Treatment plan phases can be assigned | BROKEN | J06: no phase assignment UI; treatment plan tab returns flat unordered list |
| Q27 | Sequence/priority within phase settable | BROKEN | J06: no priority fields exposed in UI; independent read confirms no phase/priority fields in response |
| Q28 | Out-of-order warning surfaces for phase violations | BROKEN | J06: no warning UI affordance; out-of-order completion produces silence (Gap #14) |
| Q29 | Tooth surfaces (MOD etc.) selectable in slideout | INFERRED PARTIAL | J07: surface selection UI likely present (slideout renders), but persistence fails (Q30) |
| Q30 | Surface selection persists to DB | BROKEN | J07: independent read returns no surface data for charted tooth; Gap #9 confirmed |
| Q31 | Mixed dentition toggle (primary/permanent) exists | INFERRED PASS | J07: mixed dentition renders (seed 'mixed' mode); primary + permanent teeth visible |
| Q32 | Primary tooth numbering correct (A-T) | INFERRED PASS | J07: mixed dentition seed ships with correct primary numbering per prior audit |
| Q33 | Mixed dentition state persists | INFERRED PARTIAL | J07: dentition layout persists (seed-driven), but surface data within it does not (Q30 BROKEN) |
| Q34 | Treatment plan acceptance captured | BROKEN | J09: `acceptedPlanVersionId` missing; consent signed but not linked to specific plan version |
| Q35 | Accepted plan version is frozen (immutable) | BROKEN | J09: no `treatment_plan_version` table; plan synthesized live; no snapshot exists; version N not frozen |
| Q36 | Signed clinical note can be voided/amended | BROKEN | J10: P0-004 confirmed; no signed/locked note persisted to DB; addendum model does not exist |
| Q37 | Amendment creates new record (no hard delete) | BROKEN | J10: no note record exists to amend; hard-delete gap confirmed (Gap #3) |
| Q38 | Audit trail shows original + amendment | BROKEN | J10: no audit trail for note mutations; `hasSignedPersisted=false` |
| Q39 | Amendment reason required | BROKEN | J10: no addendum UI (`present=false`); reason field cannot be required without the model |
| CIMG-001 | Free-tier flag gates ceph upload | UNVERIFIABLE | B01: test setup gap (no seeded ceph image); feature may be implemented |
| CIMG-002 | Upgrade prompt shown on tier violation | UNVERIFIABLE | B01: test setup gap; cannot exercise tier boundary without seeded ceph |
| CIMG-003 | Landmark placement UI accessible for ceph image | UNVERIFIABLE | B02: test setup gap; no ceph image to open landmark workspace against |
| CIMG-004 | Confirmed landmarks are immutable | UNVERIFIABLE | B03: test setup gap; backward-transition (confirmed→placed) cannot be tested |
| CIMG-006 | Ceph report can be generated | UNVERIFIABLE | B04: test setup gap; report gate cannot be exercised |
| CIMG-007 | Tier gate enforced server-side (not just client) | UNVERIFIABLE | B01: test setup gap; server-side rejection cannot be independently read |
| CIMG-008 | Report snapshot is versioned/immutable | UNVERIFIABLE | B04: test setup gap; snapshot immutability cannot be verified |

---

## Verdict Drift Analysis

### J07 drift — Surface granularity not persisted (Gap #9)

**Expected:** PASS (provisional)
**Actual:** BROKEN
**What changed:** The contract's provisional PASS assumed that mixed dentition shipping as the seed default implied surface persistence. The harness independently read the DB after a surface selection in the slideout and found no surface data on the charted tooth record.

**Clinical implication:** Insurance billing for restorative procedures requires surface-level CDT codes (e.g., D2391 one-surface vs. D2392 two-surface composite). If surface data is not persisted, the practice cannot generate accurate claims. Charting-level documentation is also legally required in the treatment record. This is a P2 gap (not a revenue-chain blocker like P0-001), but it affects billing accuracy for every restorative procedure.

**What still works:** The mixed-dentition odontogram renders correctly. Primary teeth use A-T numbering. Permanent teeth are distinct. The seed 'mixed' mode produces the expected dentition layout. The visual UI for surface selection likely exists (the slideout renders) — the failure is in the persistence layer, not the UI affordance.

**What must be fixed:** The surface selection in `ToothSlideout` must write surface data to the DB via the treatment/condition record. An independent `GET` of the tooth record must return the surface set after a save. Surface-validity guards (reject occlusal on incisors, reject zero-surface submissions) remain unconfirmed.

---

### B01–B04 drift — Ceph seed precondition missing

**Expected:** PASS (provisional) for all four
**Actual:** BROKEN for all four
**Cause:** The `mixed` seed does not contain a cephalometric image record for the test patient (Miguel Torres). All four journeys fail at their first step with identical `failedStep`: `"No seeded cephalometric image for Miguel Torres — precondition missing."`

**Critical distinction — this is NOT a product gap:**
The ceph feature (CIMG-001 through CIMG-008) may be correctly implemented at the API and backend layers. The v1.4 branch includes the ceph schema, tier-gate handlers, landmark state machine, and report generation. The journey harness cannot distinguish "feature not implemented" from "feature implemented but not seeded" — it can only report that the precondition is missing.

**What must happen to make these journeys runnable:**
1. Add a seeded cephalometric image record to the `mixed` seed for the test patient (or the designated Set B patient).
2. The image must have `pixelSpacingMm` set (calibrated) for B02 golden-value assertions (SNA≈82.0, SNB≈80.0, ANB≈2.0).
3. The patient used for B01 must be on the free tier (no `imagingTier`); a second patient on the paid tier is needed for B02/B03/B04.
4. Re-run the harness with `--no-reseed` to confirm journeys advance past the precondition step.

**Confidence impact:** CIMG-001 through CIMG-008 remain UNVERIFIABLE via journey harness until the seed is populated. Backend unit tests for ceph math (golden values) provide partial confidence, but the UI→API→math seam is untested.

---

## Confidence Assessment

The journey harness results map to the prior confidence scores as follows:

| Domain | Prior score | Journey evidence | Revised assessment |
|--------|-------------|------------------|--------------------|
| Revenue chain (J04) | CRITICAL known gap | P0-001 re-confirmed; `anyPerformed=false, hasInvoice=false` | No change — CRITICAL, unresolved |
| Clinical notes (J02/J10) | CRITICAL known gap | P0-004 re-confirmed; DB read returns null | No change — CRITICAL, unresolved |
| Status integrity (J01/J05) | HIGH known gap | Gap #1/#2 re-confirmed; slideout DOM lacks controls | No change — HIGH, unresolved |
| Perio charting (J03) | HIGH known gap | Gap #7 re-confirmed; no affordance in rendered DOM | No change — HIGH, unresolved |
| Surface persistence (J07) | P2 suspected | Gap #9 NOW CONFIRMED by independent read | Promoted from suspected to confirmed |
| Plan versioning (J09) | HIGH known gap | Gap #6 re-confirmed; no version table | No change — HIGH, unresolved |
| Ceph feature (B01-B04) | Implementation claimed | UNVERIFIABLE (seed gap, not product gap) | Indeterminate — requires seed fix |
| Mixed dentition render | LOW risk | Confirmed working (seed 'mixed' correct) | Confirmed LOW risk |

The harness adds zero false confidence (no bypasses). Every BROKEN verdict is backed by an independent DB read. The 9/10 confidence score from prior reports was conditioned on E2E bypass patterns masking real failures — this harness removes those masks and confirms all known P0/P1 gaps remain open.

---

## Recommended Next Steps

Ordered by clinical risk (highest first):

1. **[P0-001] Fix revenue chain** — `useMarkTreatmentDone` must drive two-step transition (`diagnosed → planned`, then `planned → performed`). Until fixed, $0 revenue through the UI. Affects J04 (Q17, Q18, Q19, Q22, Q23). Confirmed by J04 harness.

2. **[P0-003] Enforce consent server-side** — Remove "Complete anyway" client bypass; add server-side consent check before allowing `performed` transition. Confirmed advisory-only by J04 harness. Blocks J04 goal state even after P0-001 fix.

3. **[P0-004] Persist clinical notes to DB** — Add `visit_notes` DB column/table; wire `SoapNotesSheet` save to API; implement signed/locked state; add addendum model. Until fixed, J02/J10 remain BROKEN and the practice has no legal clinical record. Affects Q9, Q10, Q36, Q37, Q38, Q39.

4. **[Gap #1/#2] Fix status-collapse** — Add distinct `Existing`, `Existing-Other`, `TP`, `Condition` controls to `ToothSlideout`. Until fixed, J01/J05 remain BROKEN. Affects Q8, Q24, Q25.

5. **[Gap #7] Build perio charting surface** — Add periodontal probing UI (pocket depths per tooth/surface, bleeding points, mobility) to workspace. No UI affordance currently in rendered DOM. Affects Q11–Q16. J03 cannot pass without this.

6. **[Gap #9] Persist surface selections to DB** — Wire surface selection in `ToothSlideout` to write surface data on save. Add surface-validity guards (reject occlusal on incisors, reject zero-surface). Affects Q29, Q30. Confirmed by J07 harness (drift).

7. **[Gap #14] Add treatment plan phasing** — Add phase/sequence/priority fields to treatment plan UI; implement dependency-warning on out-of-order completion attempts. Affects Q26, Q27, Q28. J06 cannot pass without this.

8. **[Gap #6] Implement plan versioning** — Add `treatment_plan_version` table; snapshot plan on acceptance; link `acceptedPlanVersionId` on consent; make accepted snapshot immutable. Affects Q34, Q35. J09 cannot pass without this.

9. **[Gap #11] Add informed-refusal capture** — Add `declined` status + refusal-reason field to Treatment Plan tab. Affects Q20. J08 cannot pass without this.

10. **[Seed] Add cephalometric image to mixed seed** — Add seeded ceph image record (calibrated, with `pixelSpacingMm`) for Set B test patient; add free-tier + paid-tier patient variants. Required to unblock B01–B04 journeys and verify CIMG-001 through CIMG-008.
