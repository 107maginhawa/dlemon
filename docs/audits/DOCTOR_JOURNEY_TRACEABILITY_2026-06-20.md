# Doctor Workspace Visit Journey — Honest Traceability Matrix

**Date:** 2026-06-20
**Auditor:** Lead auditor (computed from LIVE_RUN + CANONICAL_WORKFLOWS + CLAIMED_COVERAGE + PER_JOURNEY_RIGOR + direct spec inspection)
**Scope:** The WF-074 "Dentist-Owner patient visit" chain — the day-in-the-life doctor journey: start visit → workspace → chart/diagnose → SOAP notes → consent → Rx/lab → mark performed → complete → invoice → PMD.

---

## 1. Bottom line

The doctor-visit chain is **partially proven, not end-to-end proven.** The harness **did execute live just now** (`bun scripts/run-journey-harness.ts`, exit 0, 22/22 passed in ~75s — this is real, not a stale claim). The **structural skeleton of a visit is genuinely proven through the UI with persistence reads**: starting a visit (J21 asserts `status==='active'` via independent GET), completing a visit (J22 drives the real Complete button, gets a 2xx PATCH, then independently reads `status==='completed'` and polls that no active visit remains), perio charting (J03 reads back a persisted chart), and the revenue chain mark-performed→invoice (J04 confirms `"status":"performed"` and an invoice via independent reads).

**Direct answer — "does a doctor's in-visit work (chart, SOAP notes, treatments, complete) save, and is that PROVEN by a UI+persistence test?"** **Mixed, and the gaps are in the clinically load-bearing middle:**
- **Complete visit (WF-012): YES, proven** (J22 — UI drive + independent persistence read).
- **Mark treatment performed (WF-010): YES, proven** (J04 — UI-driven PATCH + independent read, with a loose-regex caveat).
- **Chart entry / diagnose (WF-009): NO, shallow only.** Its mapped journey J01 is `covered-shallow` — it asserts only `toBeVisible`/`toBeDisabled` on chart controls and **never saves a restoration or reads anything back** (the spec itself concedes the save path "is not automated" and delegates create+persist to J21, which only proves a *visit* exists, not a *chart entry*).
- **SOAP notes (WF-011): NO — UNMAPPED and not authored-through-UI anywhere.** WF-011 has **zero entries** in `workflow-test-map.json` (confirmed). No journey drives the primary act of *typing a fresh SOAP note in the workspace and reading it back persisted*. J22 *seeds* notes via `apiReader` (API, not UI). J10 *does* drive the notes sheet but only for the **addendum/amend** path (WF-028) on a **pre-seeded** note. The first-class "doctor writes today's SOAP note and it saves" is unproven by any UI+persistence test.

**Where the real risk is:** the clinical *authoring* core — chart-entry persistence (WF-009) and original SOAP-note authoring (WF-011) — is the least-proven part of the chain, despite being what a dentist does on every visit. The green dashboard overstates this: several WFs marked "covered" are covered-shallow, and two core WFs (WF-011, WF-032) are unmapped entirely.

---

## 2. Traceability matrix — doctor-visit WFs

Legend for **TRUE STATUS**: `proven` = mapped journey executed live AND asserts persistence/goal-state via independent read of a UI-driven action · `shallow-only` = executed but asserts only DOM presence/gate-state, no persistence of the driven action · `unmapped` = no entry in workflow-test-map.json · `broken` = mapped to a designed-broken / inverted-proof journey · `not-run` = mapped only to a non-journey e2e spec that did **not** execute in this journey harness run.

> Note on "Executes live?": LIVE_RUN executed only the **22 journey specs** (J01–J22 / B01–B04). The many `.spec.ts` e2e files referenced in CLAIMED_COVERAGE (`workspace-readonly.spec.ts`, `prescribe-medication.spec.ts`, `lab-order-ui.spec.ts`, `pmd-generation.spec.ts`, etc.) are **NOT** part of this harness and did **not** run. Those rows are `not-run` for the purposes of this proof.

| WF-ID | Name | Mapped journey / spec | Executes live? | Asserts persistence? | TRUE STATUS | Risk |
|-------|------|----------------------|----------------|----------------------|-------------|------|
| **WF-045** | Start new visit from workspace ("New Visit +") | J21 `21-new-visit-create` | ✅ J21 PASS | ✅ independent GET `status==='active'` | **proven** | Low. Step-2-failure stranded-draft (WFG-015) not covered, but happy path is solid. |
| **WF-007** | Appointment check-in → visit creation | `patient-checkin.spec.ts` (e2e) | ❌ not in harness | n/a (non-journey) | **not-run** | Medium. Claimed "covered" but the proving spec didn't execute live. BR-001 (no 2nd active visit) unproven by a live journey. |
| **WF-008** | Workspace open (patient record) | `workspace-readonly.spec.ts` (e2e) | ❌ not in harness | n/a | **not-run** | Low-Med. Read-only entry; exercised incidentally by J01/J03/J04/J22 opening the workspace, but no dedicated live assertion of BR-016 (403 on branch violation). |
| **WF-009** | Dental chart entry (condition/treatment, diagnose) | J01 `01-new-patient-exam` | ✅ J01 PASS | ❌ DOM-presence only; never saves/reads back | **shallow-only** | **HIGH. The core charting act is not proven to persist.** J01 asserts only that Existing/Existing-Other buttons render; concedes save "is not automated." No independent read of a created chart entry/finding. |
| **WF-010** | Treatment mark as performed | J04 `04-revenue-chain` | ✅ J04 PASS | ✅ independent GET `"status":"performed"` | **proven** (with caveat) | Low-Med. Caveat: performed-check is a loose `JSON.stringify` regex over ALL patient treatments — a pre-existing performed row could satisfy it; anchored by 200-gated PATCH#1/#2. |
| **WF-011** | **Clinical notes (SOAP) authoring** | **— (none)** | ❌ unmapped | ❌ no UI authoring anywhere | **unmapped** | **HIGH. No journey types a fresh SOAP note in the UI and reads it back.** J22 seeds notes via `apiReader` (API). J10 only drives the *addendum* on a *pre-seeded* note. Primary authoring (WF-011) is invisible to the proof suite. |
| **WF-012** | Complete visit | J22 `22-complete-visit` | ✅ J22 PASS | ✅ UI Complete btn → 2xx PATCH → independent GET `status==='completed'` + poll active==0 | **proven** | Low. Strongest journey in the chain. Note its preconditions (consent, notes) are API-seeded, so it proves *completion* but not *authoring*. |
| **WF-016** | Write prescription | `prescribe-medication.spec.ts` (e2e) | ❌ not in harness | n/a | **not-run** | Medium. BR-017 (prescriberMemberId) unproven live. No journey covers Rx. |
| **WF-017** | Create lab order | `lab-order-ui.spec.ts` (e2e) | ❌ not in harness | n/a | **not-run** | Medium. Lab Order FSM (BR-018) unproven by a live journey. |
| **WF-018** | Obtain consent signature | J19 `19-case-presentation-accept` | ✅ J19 PASS | ⚠️ J19 proves present→e-sign→accept (case-presentation); consent-gate BR-014 on treatment not directly asserted | **proven (adjacent)** | Med. J19 covers the case-presentation e-sign, not the in-visit "consent required before WF-010/WF-012" gate. Partial. |
| **WF-013** | Create invoice from visit | J04 `04-revenue-chain` | ✅ J04 PASS | ✅ independent invoice list read | **proven** (with caveat) | Low-Med. Caveat documented in J04: invoice is created via `apiReader.post` (no invoice-creation UI exists) — API-only by necessity, confirmed by independent read. So billing *persistence* is proven but billing *UI* is not. |
| **WF-021** | Generate PMD (per-visit snapshot) | `pmd-generation.spec.ts` (e2e) | ❌ not in harness | n/a | **not-run** | Medium. BR-021 immutable snapshot/checksum unproven by a live journey. (J20 covers PMD *import*, not *generation*.) |
| **WF-032** | Initialize dentition | **— (none)** | ❌ unmapped | ❌ | **unmapped** | Medium. Bootstrap that must precede WF-009 for a new patient; no test guards it. (J07 granularity/dentition exists but WF-032 is not mapped to it.) |
| **WF-033** | Carry-over treatment display | `returning-patient-carryover-ui.spec.ts` (e2e) | ❌ not in harness | n/a | **not-run** | Low. Display-only (BR-008); low blast radius, but "covered" overstates it. |
| **WF-074** | **Dentist-Owner patient visit (whole chain)** | **— (no single journey)** | ❌ no end-to-end spec | ❌ | **unmapped (composite)** | **HIGH. There is no one continuous journey that walks check-in→chart→notes→consent→Rx/lab→performed→complete→invoice→PMD with a persistence assert per step.** Coverage is stitched from fragments (J21+J01+J03+J04+J22+J19), several of which are shallow or API-seeded. The composite is asserted by assumption, not by test. |

### Reconciliation: where "covered" is lying

- **WF-009 marked "covered" (J01)** → reality `covered-shallow`. PER_JOURNEY_RIGOR: J01 `assertsPersistenceOrGoalState=false`, `independentRead=false` for the outcome; "spec NEVER saves a restoration and reads nothing back."
- **WF-011 "core, unmapped"** → confirmed `grep -c "WF-011" workflow-test-map.json` = **0**. Not covered at all. No UI authoring journey exists.
- **WF-032 core, unmapped** → confirmed = **0**.
- **WF-007 / WF-008 / WF-016 / WF-017 / WF-021 / WF-033 "covered"** → all map to plain `.spec.ts` e2e files that did **not** execute in this journey harness run. "Covered" is true only if those e2e specs run in a *separate* gate; in the live-run we just did, they produced **zero evidence**.
- **WF-013 / WF-018** → "covered" but the *UI* path is partial: J04 creates the invoice via API (no invoice UI), and J19 proves case-presentation e-sign rather than the in-visit consent gate.

---

## 3. Live-run reality

**The harness DID run** — this is the most important honest fact, and it ran clean:
- Command: `bun scripts/run-journey-harness.ts`, **exit code 0**, ~75.4s (incl. `db:reseed`), single Bash call, no blockers.
- **22 total — 22 PASS, 0 BROKEN, 0 ERROR, 0 SKIPPED.** Raw Playwright: `expected=22, skipped=0, unexpected=0, flaky=0`.
- Set A: 17 PASS / 0 BROKEN. Set B: 5 PASS / 0 BROKEN.
- Historically-flaky J10 (void/amend) and J17 (booking) both **passed** this run.

**Caveat on what "22 PASS" means:** several journeys pass by design even when they prove a *limitation*. PER_JOURNEY_RIGOR flags **J02** as `broken-or-skip` (inverted proof: the D0120 note "has no DB column (P0-004), so it cannot survive" — its live path is `recordJourneyError` on an expected throw) and **J05** as a status-collapse probe that throws on today's app. So "22 passed" includes journeys whose passing condition is "the workflow is confirmed broken." A green count of 22/22 is **not** the same as "22 workflows proven working." For the doctor chain specifically, J01 passing = controls render, **not** chart-entry persists.

**Critically: these journeys are not confirmed to be a required CI gate.** Per project memory the "journey-verification" job exists but branch-protection enforcement is an open human action. So the green can pass even if these never run in CI.

---

## 4. Prioritized gap list (doctor journey)

| # | Gap | Severity | Concrete fix |
|---|-----|----------|--------------|
| 1 | **WF-011 SOAP notes — no UI authoring proof.** | **P0 / HIGH** | Add `tests/e2e/journeys/23-soap-note-authoring.journey.spec.ts`: open workspace on an active visit, drive the real notes sheet (`soap-notes-sheet`), **type** chief-complaint/SOAP fields, click Save, assert the save POST is 2xx, then **independent `apiReader.get('/dental/visits/:id/notes')` and assert the typed content persisted.** This closes the single biggest hole. (J02's inverted "note can't persist" proof should be re-validated/retired if the column now exists.) |
| 2 | **WF-009 chart entry — shallow only (J01 never persists).** | **P0 / HIGH** | Re-grade J01 to `covered-shallow` in the map, and add a real charting persistence journey: drive a tooth restoration save through the UI (or accept the SVG-coordinate limitation and instead drive the condition slideout's save control), then independent-read `/dental/patients/:id/treatments` (or the `dental_finding` row) and assert the **specific** entry this run created persisted — not just that buttons render. |
| 3 | **WF-074 — no single end-to-end visit journey.** | **P1 / HIGH** | Build one continuous `24-dentist-visit-day-in-the-life.journey.spec.ts` that walks check-in → New Visit → chart entry → SOAP note → consent gate → mark-performed → complete → invoice → PMD, **with a persistence assert (independent read) at each step.** This is the only thing that proves the *chain*, not just the links. |
| 4 | **WF-016 / WF-017 / WF-021 — "covered" but not run live.** | **P1 / MEDIUM** | Promote Rx (BR-017), lab order (BR-018), and PMD generation (BR-021) into the journey harness (or add a CI gate that runs the named e2e specs and records pass/fail). Today they contribute zero live evidence to the doctor chain. |
| 5 | **Journeys not a required CI gate / green can lie.** | **P1 / MEDIUM** | Make `journey-verification` a **required** branch-protection check, and add an assertion in the harness that fails the run if any *core* doctor-visit WF (045/007/009/011/012/010/018/013/021) has no `proven`-grade journey. Also: a 22/22 green that includes designed-broken J02/J05 should surface a distinct "PROVEN-WORKING vs PROVEN-BROKEN" tally so the dashboard stops reading inverted proofs as feature health. |
| 6 | **WF-007 check-in BR-001 / WF-008 BR-016 unproven live.** | **P2 / MEDIUM** | Add live coverage for the 409-on-second-active-visit (BR-001) and 403-on-branch-violation (BR-016) — currently only in non-journey e2e specs that didn't execute. |
| 7 | **WF-013 invoice has no creation UI; WF-018 in-visit consent gate not asserted.** | **P2 / MEDIUM** | Track the missing invoice-creation UI as a product gap (J04 documents the workaround). Add an assertion that WF-010/WF-012 are blocked without signed consent (BR-014). |

---

## 5. Map honesty fixes (`docs/testing/coverage/workflow-test-map.json`)

To stop the green from lying, correct the following:

1. **WF-009:** change `status: "covered"` → `status: "covered-shallow"` (or `partial`), anchor note: "J01 asserts chart-control presence only; does NOT save or read back a chart entry — persistence delegated to J21 (visit, not chart). Needs a charting-persistence journey."
2. **WF-011:** **add the missing entry** (currently absent) as `status: "uncovered"` with note "SOAP authoring not driven through the UI by any journey; J22 seeds notes via API, J10 only covers addendum/amend (WF-028)." Do not let it remain silently absent.
3. **WF-032:** add as `status: "uncovered"` (currently absent) — "dentition bootstrap, no test guards it."
4. **WF-074:** add a composite row `status: "uncovered-composite"` — "no single end-to-end visit journey; coverage stitched from J21+J01+J03+J04+J22, several shallow/API-seeded."
5. **WF-007 / WF-008 / WF-016 / WF-017 / WF-021 / WF-033:** retain `covered` only if the named `.spec.ts` files run in a *required* gate; otherwise downgrade to `covered-not-in-journey-harness` so it's clear they produced no evidence in the journey run. Add a `gate` field distinguishing `journey-harness` vs `e2e-spec`.
6. **WF-013:** annotate "invoice persistence proven (J04) but via API; no invoice-creation UI — UI path uncovered."
7. **WF-018:** annotate "J19 proves case-presentation e-sign, not the in-visit BR-014 consent gate on WF-010/WF-012."
8. Add a top-level `provenWorking` vs `provenBroken` split so designed-broken journeys (J02, J05) are not counted as feature coverage in the totals.

---

*Evidence base: LIVE_RUN (exit 0, 22/22), PER_JOURNEY_RIGOR (J01 shallow, J02/J05 inverted, J03/J04/J06 persistence), and direct inspection of `21/22/10-*.journey.spec.ts` + `grep` of `workflow-test-map.json` confirming WF-011=0, WF-032=0, WF-045=1 mappings.*
