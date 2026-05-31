---
oli-version: "1.0"
based-on:
  - docs/audits/coverage/*.md (12 per-module test-coverage audits)
  - docs/audits/COMPLIANCE_REPORT.md
  - docs/audits/CONSISTENCY_GATE_REPORT.md
  - docs/audits/CROSS_MODULE_REPORT.md
  - docs/audits/RUNTIME_READINESS_REPORT.md
  - docs/audits/codebase-map/ (engine v5, regenerated at HEAD)
last-modified: 2026-05-31T01:29:58Z
last-modified-by: oli-check
---

# OLI Check — Roll-up Summary

## 0. TRUST STATUS

| Field | Value |
|-------|-------|
| Map producer | **engine** (oli-engine v5, ts-morph) — not regex-fallback |
| MAP-FRESHNESS | **FRESH** — `map@d8745b97` == `HEAD@d8745b97`, all artifacts unchanged on re-scan |
| Confidence threshold | MEDIUM (`.oli/config.json`) |
| Map scope | `apps/dentalemon/src/**` (frontend). Backend (`services/api-ts`) audited directly from source + specs, not from the graph. |
| fields_unavailable | none (CODE_SPEC_TRACE came back empty — see note) |
| unverified nodes (below-threshold) | 0 |

> The map was STALE at the start of this run (`map@2e07553` vs `HEAD@d8745b97`, 5 commits + uncommitted ceph/imaging/reports/settings/workspace changes overlapped mapped files). Per the user's "start fresh" instruction it was **regenerated at HEAD** before any code dimension ran.
>
> **THESIS IN FORCE** for this run — code-dimension verdicts are graph-anchored for the frontend slice and source-anchored for the backend.
>
> Caveat: `CODE_SPEC_TRACE.json` is empty because dental routes are split across `generated/openapi/routes.ts` **and** hand-registered in `app.ts`; the spec-trace pass only parses the generated file. This is a tooling blind spot (recorded as a compliance P2), not a coverage gap — the per-module auditors compensated by reading `app.ts` directly.

## 1. Run Context

- **Detected state:** specs (12 modules) + source (apps/packages/services) + tests + runnable app + PERFORMANCE.md → all code & spec dimensions applicable.
- **Mode:** no dimension flags → full auto-select. User directive: *exhaustive, per-module, no skipping, all use cases tested on both backend and frontend.*
- **Dimensions run:** Discovery (map regen), Traceability + Confidence + Enforcement-coverage (fused into 12 per-module auditors), Compliance, Consistency, Cross-module enforcement, Runtime (boot-smoke + release gates).
- **Skipped:** Journeys standalone (`UI_BLUEPRINT.md` absent — journey coverage folded into per-module FE audits, which read the `tests/e2e/journeys/` suite). UI-consistency (`UI_CONSISTENCY_SPEC.md` absent — would require `/oli-spec-ui --infer-from-code`). Runtime `--live` interaction loop (not requested).
- **Method:** 16 isolated subagents (12 module + 4 cross-cutting), each wrote its own report and returned a verdict; this file aggregates.

## 2. Dimension Results

| Dimension | Verdict | Report | P0 | P1 | P2 |
|-----------|---------|--------|----|----|----|
| Discovery (map) | ✅ PASS (FRESH) | `codebase-map/.map-meta.json` | 0 | 0 | 0 |
| Per-module test coverage (Traceability+Confidence+Coverage) | ⛔ **BLOCK** | `coverage/*.md` (12) | **2** | **41** | 35 |
| Compliance (spec↔code) | ✅ PASS | `COMPLIANCE_REPORT.md` | 0 | 0 | 5 |
| Consistency (spec gate) | ✅ PASS | `CONSISTENCY_GATE_REPORT.md` | 0 (HIGH) | 0 | 5 (MED) |
| Cross-module enforcement | ⚠️ WARN | `CROSS_MODULE_REPORT.md` | 0 | 4 | 2 |
| Runtime (boot-smoke + gates) | ✅ PASS | `RUNTIME_READINESS_REPORT.md` | 0 | 1 | 2 |

## 3. Overall

**Worst verdict: ⛔ BLOCK** (driven entirely by **dental-visit frontend** — completion-gate / informed-refusal UI is untested at both unit and E2E layers).

- **Backend health: STRONG.** Compliance 0 P0 / 0 P1 (health 9.5/10): billing role matrix exact, treatment FSM byte-exact to spec, imaging tier gate enforced, scheduling role exclusions enforced, 405-immutability guards present. Typecheck clean both sides. CI gates 15/15.
- **Frontend test coverage: the systemic gap.** Across nearly every module, backend has real deny+allow / FSM assertions, but the **frontend interaction layer is thin** and the **E2E journeys are demoability probes that `expectJourneyBroken()` / probe-skip rather than assert the gates work.** Many features have component files but no submit/render test; several "FE tests" assert inline-duplicated logic instead of the shipped component.

### Per-module scoreboard (backend / frontend)

| Module | BE | FE | use-cases | BE cov | FE cov | P0 | P1 |
|--------|----|----|-----------|--------|--------|----|----|
| dental-visit | WARN | ⛔ BLOCK | 37 | 35 | 15 | 2 | 4 |
| dental-pmd | WARN | WARN | 34 | 22 | 2 | 0 | 6 |
| dental-billing | WARN | WARN | 24 | 22 | 9 | 0 | 5 |
| dental-clinical | WARN | WARN | 29 | 27 | 6 | 0 | 5 |
| dental-imaging | PASS | WARN | 30 | 24 | 22 | 0 | 5 |
| dental-perio | WARN | PASS* | 26 | 20 | 0* | 0 | 4 |
| dental-scheduling | WARN | WARN | 51 | 43 | 15 | 0 | 3 |
| dental-org | PASS | WARN | 42 | 30 | 6 | 0 | 3 |
| dental-audit | PASS | PASS* | 25 | 23 | 1* | 0 | 3 |
| emr-consultation | WARN | PASS* | 33 | 30 | 0* | 0 | 2 |
| dental-patient | PASS | WARN | 26 | 24 | 17 | 0 | 1 |
| external-records-import | PASS† | PASS† | 16 | 0† | 0† | 0 | 0 |

\* FE=PASS *vacuously* — no UI surface exists by design (perio UI deferred §9; audit-viewer WF-028 unimplemented; emr-consultation has no native FE). Absence is a documented product deferral, not faked coverage.
† `external-records-import` is **future_phase by design** (MODULE_SPEC §7/§20 — "do not implement until scheduled"). Zero impl/tests is spec-compliant.

## 3b. Re-verification — 2026-05-31 (post-fix, independently audited)

> The per-module `coverage/*.md` reports below predate the gap-fix work and are now **STALE** for the items listed here. This section records the closures, each independently re-verified by a read-only auditor against the current tests (confirming they exercise the **shipped** handler/component, not re-declared logic). Branch `feat/ceph-demoable-and-manual-ux`. Backend suite: **202 files, 2807 pass / 0 fail**; api-ts + dentalemon typecheck clean.

**P0 (both CLOSED earlier this session):** dental-visit completion-gate UI (`pre-completion-checklist.test.ts`) + informed-refusal/decline UI (`treatment-decline.test.ts`); E2E J01/J08 converted from probes to hard assertions (J05 left as an honest probe — status-collapse question, not a test-only fix).

**Theme C — backend deny-gates (CLOSED):**
- dental-billing: `markUncollectible` 501 pinned (mutation-verified); **voidDentalInvoice now enforces the contract `reason` (min 5)** — spec-first `@body` + regen, handler records reason in audit metadata; empty/short body → 400.
- dental-scheduling: check-in excludes `staff_scheduling`; cancel excludes `staff_scheduling` + `dentist_associate` (deny+allow pairs on the real `assertBranchRole`).
- dental-visit: concurrent-active 409 `ACTIVE_VISIT_EXISTS` via HTTP (create + activate paths).
- dental-pmd: imported-PMD-immutable 405 guard tested on the **real app** (`createApp(parseConfig())`).
- dental-perio: BR-P02 VISIT_LOCKED (HTTP), BR-P03 INVALID_DEPTH (unit — zod shadows it at HTTP), BR-P04 INVALID_TOOTH_NUMBER (unit + HTTP tooth 19), getPerioChart 404. *(perio P1-1..P1-4 were the only P1s — all closed.)*

**Theme A — FE interaction tests on shipped components (CLOSED):** RecallsSheet, AmendmentForm, OnboardingWizard 5-call chain, invoice issue + record-payment. Two real bugs fixed: RecallsSheet transition-button mislabel (indexed by target not current status); AmendmentForm silent-failure (SDK client defaults `throwOnError=false` → resolves `{error}`; dead catch → failed saves silently closed the form; now inspects the error).

**Theme B — test-quality (CLOSED):** pmd-import + pmd-viewer rewritten to render shipped components (rx-sheet/consent-sheet done pre-clear; onboarding rewritten under Theme A).

**Still open (NOT targeted — for a later pass):** billing P1-2/P1-3/P1-4 role gates (create-invoice / create-plan / discount + void-payment deny tests); per-module E2E journeys for scheduling/org; pmd P1-BE-2/3/4 (audit-write asserts, patient-self paths, list/read RBAC deny); clinical P1-1/P1-2 (consent revoke route + 422), P1-4 medical-history-sheet FE, P1-5 rx/consent FE assert non-imported validators; **Theme D (architecture/import cycles)** and **Theme E (migration rollback)** untouched.

## 4. What's Next

### ⛔ Fix Now — P0 (2)
Both in **dental-visit frontend** — state-integrity gates with no test on either layer:
1. **Completion-gate UI untested** — `apps/dentalemon/src/features/workspace/components/pre-completion-checklist.tsx` (`checkConsentSigned` / `checkNoUnstartedTreatments`) has no unit test; E2E 01/05 probe-skip. The 422-on-open-treatments + unsigned-consent hard gate is enforced in the backend but the UI that surfaces/overrides it is unverified.
2. **Informed-refusal / decline UI untested anywhere** — grep `declin|refus` in FE `*.test.ts` = 0; only `08-informed-refusal.journey.spec.ts:49` probe-skips. Backend `updateDentalTreatment.ts:101` (422 REFUSAL_REASON_REQUIRED) is strong but unasserted via the UI or HTTP-from-UI.

→ Add component tests for `pre-completion-checklist.tsx` + the decline flow, and convert journeys 01/05/08 from `expectJourneyBroken` probes to real gate assertions.

### Fix Before New Work — P1 (46 total)
**Theme A — Frontend interaction tests missing (largest cluster).** Representative:
- `recalls-sheet.tsx` + `use-recalls.ts` no test (dental-patient); `amendment-form.tsx` write-path no test (dental-clinical/visit); onboarding 5-call submit chain untested (dental-org `onboarding-wizard.tsx:125-160`); billing issue/record-payment/void mutations interaction-untested.
- **Latent bug found:** `invoice-detail.tsx:85` `handleVoid` POSTs with no `reason` body → 400 vs `API_CONTRACTS:175` (dental-billing).

**Theme B — Tests that don't exercise shipped code (test-quality P1).** `rx-sheet.test.ts:25`, `consent-sheet.test.ts:25`, `pmd-import.test.ts`, `pmd-viewer.test.ts` redeclare/duplicate validation logic the component doesn't export — they assert a copy, not the real component.

**Theme C — Backend deny-gate / guard gaps (real but lower-risk).** scheduling check-in/cancel role-exclusion 403s untested (`checkInAppointment.ts:39`, `cancelAppointment.ts:35`); billing `markUncollectible` 501 has zero tests; perio BR-P02/P03/P04 validation guards untested; pmd imported-PMD-immutable 405 guard untested; visit concurrent-active 409 untested via HTTP.

**Theme D — Architecture (cross-module, 4× P1).** FE `patients`↔`workspace` circular dep; FE `lib/ceph-export.ts`→`features` layer inversion; BE handler-to-handler re-export shims (`dental-patient`→`dental-visit`, `dental-org`→`dental-scheduling`) bypassing service facades. Note: official `bun run check:boundaries` is green (facade-mediated) — these are import-hygiene cycles, not alias violations.

**Theme E — Runtime.** No migration rollback story (forward-only drizzle) — notable for a PHI product.

### Track — P2 (selected)
- Spec/doc lag for the two newest modules: 9 perio glossary terms + PerioChart entity + perio/emr error codes missing from `DOMAIN_GLOSSARY`/`DOMAIN_MODEL`/`ERROR_TAXONOMY`; `WORKFLOW_MAP` still says "10 modules" (perio = 11th).
- API path drift: pmd `/dental/pmd/generate` (spec) vs visit-scoped impl; patient `follow-up`→`follow-up-notes`.
- `recover-pin` route registered without `authMiddleware` in `routes.ts:777` — safe only via `app.ts` auth-shadow ordering (brittle).
- Split `routes.ts`/`app.ts` registration defeats the spec-trace engine pass (empty `CODE_SPEC_TRACE`).
- 3 orphan migration SQL files not in `_journal.json` (inert).

## Remediation routing
- Re-run a single dimension after fixes: re-dispatch the relevant `coverage/<module>.md` audit, or `/oli-check --confidence` / `--compliance`.
- The 2 P0s + Theme A/B are the highest-leverage work and directly answer the user's mandate ("every use case tested on both backend and frontend"). Backend is largely there; **the frontend interaction + real-E2E layer is what's missing.**
- Coverage is **NOT 100%** — the knowledge-graph + per-module sweep covered all 12 modules with no module skipped, surfacing 2 P0 + 46 P1 + 35 P2 gaps. That is the "room for improvement" the mapping was meant to expose.
