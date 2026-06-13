# AHA Fix-Ready Plan: Dental Patient

**Generated:** 2026-06-11 · **Prompt:** `docs/aha/prompts/03-organize-gap-plan-for-fixing.md`

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Dental Patient |
| Module slug | dental-patient |
| Source gap plan | `docs/aha/module-gap-plans/dental-patient-gap-plan.md` |
| Output file | `docs/aha/module-fix-plans/dental-patient-fix-ready-plan.md` |
| Audit decision | PARTIAL PASS |
| Superpowers used | No — organizer discipline applied via shared rules (§19 Gap Organizer Rules); no execution agent needed for plan organization |
| Organizer decision | READY |
| Reason | Six decision-free items (gap plan §26 "Truly V1") with strong evidence, tested backends, and clear test-first paths. Batches A and C are executable immediately; Batch B has one cross-module sequencing dependency (billing-owned print utility). Five gaps are decision/confirmation-gated and are cleanly separated into Blocked/Deferred. |
| Limitations | Organizer pass only — no tests run, no code modified. Cross-module ownership (claims decision, print utility) encoded per orchestrator pre-decision; `docs/aha/module-fix-plans/dental-billing-fix-ready-plan.md` may not exist yet at write time — references are forward-looking. |

**Clarifications found while organizing (gap plan stands; these sharpen fix-readiness):**

1. SDK client functions for `updateDentalPatient` and `getDentalPatientStatement` **already exist** in `packages/sdk-ts/src/generated/sdk.gen.ts` (+ TanStack hooks in `@tanstack/react-query.gen.ts`). GAP-1 and GAP-2 need **no TypeSpec, codegen, backend, or SDK-regen work** — pure FE wiring against tested handlers.
2. The GAP-4 silent catch is the post-registration communication-consent PATCH in `apps/dentalemon/src/routes/_dashboard/patients.tsx` (verified: raw `fetch(...).catch(() => { /* non-blocking */ })`). It also uses raw fetch despite the repo's no-raw-fetch convention; the minimal fix should use the existing SDK call while surfacing the error — do not expand into a route-wide fetch migration.
3. FE feature directory confirmed: `apps/dentalemon/src/features/patients/components/` has `patient-profile-page.tsx` and a colocated `*.test.ts` convention — new edit/statement components and tests belong there.

## 2. Fix Strategy Summary

- **Fix first:** GAP-1 (no patient-edit UI) — the module's top gap; data quality decays permanently without it, and it degrades every downstream module (recalls, billing contact, PMD identity). It is FE-only against a tested, guarded handler, so risk is low and value is highest.
- **Then:** Batch C — three small trust/pin/test items (GAP-4 silent consent save, GAP-8 safety-floor equality pin, GAP-10 stale unmerge assertion, GAP-12 plan-total validation). Small, independent, low-risk.
- **Sequenced after billing:** GAP-2 statement UI depends on the shared print/PDF utility that **dental-billing owns** (receipt first) — run Batch B only after that shared batch lands; do not build a second print utility.
- **Do not fix:** archived-write guards (G4 — verified CLOSED, stale matrix row), SL-01/02/09/12 sync fixes, branch isolation, plan FSM/approval — all source-verified this round. Do not wire insurance/household/alerts/contacts orphans without their decisions.
- **One pass or batches:** multiple small batches (A → C → B). Batch B is gated externally; A and C are independent and could run in either order, but A first maximizes product value.
- **Shared/platform/database work:** none required for Batches A/C. Batch B consumes (not builds) a shared print utility. No schema or migration work in any active batch.
- **Product decisions / blockers:** GAP-3 (claims vertical — decision owned by dental-billing), GAP-5 (Q4 emergency-contact storage), GAP-6 (Q3 alert source of truth), GAP-7 (Q5 households), GAP-9 (Q2 offline registration scope). All excluded from active scope.

## 3. Active Fix Scope

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | GAP-1: no patient-edit UI; `updateDentalPatient` 0 FE consumers, no alternate path — registration typos permanent | P1 | V1 REQUIRED | A | FR2.4 core workflow blocked; basic EHR table-stakes; backend handler tested + archived-guarded, SDK fn already generated | Gap plan §5/§10; grep `updateDentalPatient`/`updatePatient`/`updatePerson` in patients FE = 0; contract-spine 2026-06-10 |
| FIX-002 | GAP-2: FR2.21 itemized statement unreachable; `getDentalPatientStatement` 0 FE consumers | P1 | V1 REQUIRED | B | Bill-dispute workflow (PH cash-practice trust ritual) undeliverable; backend + hurl coverage already exist | Gap plan §5/§10; spine + grep = 0 consumers; `handlers/dental-patient/identity/getDentalPatientStatement.ts` exists |
| FIX-003 | GAP-4: comms-consent PATCH swallows failures — staff believe prefs saved when they aren't | P2 | V1 REQUIRED | C | Trust/compliance defect; Phase-2 reminders will act on wrong consent; one-file fix | `routes/_dashboard/patients.tsx` raw fetch with `.catch(() => {` (verified this pass) |
| FIX-004 | GAP-8: `getDentalPatientSafetyFloor` orphan while FE floor derives from `listMedicalHistory` — drift class | P3 | V1 RECOMMENDED | C | Cheap pin prevents the two alert sources from silently diverging; informs (does not pre-empt) the GAP-6 decision | Gap plan §5; grep = 0 consumers; floor uses med-history (clinical round) |
| FIX-005 | GAP-10: stale base test asserts `unmergePatients` 500; handler correctly returns 501 (EM-PAT-007) | P3 | V1 RECOMMENDED `[TEST GAP]` | C | Clears a known-red test; trivial; restores suite trustworthiness | `patient/patient.test.ts` vs `unmergePatients.ts:30-36` |
| FIX-006 | GAP-12: TP-BR-005/006 plan total ≠ Σ items unvalidated (default-0/non-negative only) | P3 | V1 RECOMMENDED | C | Data-integrity validation on the plan→billing handoff; small backend validation + unit test | Gap plan §5 (prior G12, unchanged); no unit test exists |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| A | P1 core workflow blocker: patient demographics edit (profile edit form wired to existing handler) | FIX-001 | Low (FE-only; backend + SDK already exist and are tested) | **Run in current `04` pass — first** |
| B | P1 workflow blocker: FR2.21 itemized statement view + print action from profile | FIX-002 | Low-Medium (FE-only, but print output must be coordinated with the shared utility) | Split into separate `04` pass — **requires shared/platform fix first** (billing-owned print utility; see §7). Run after `docs/aha/module-fix-plans/dental-billing-fix-ready-plan.md` print batch lands |
| C | Small trust / pin / test-hardening items | FIX-003, FIX-004, FIX-005, FIX-006 | Low (one-file FE fix + test-only pins + small backend validation) | Run in current `04` pass — second (after Batch A; may run before B regardless of billing timing) |

Notes:
- Do not merge Batch B into A or C — its external dependency would stall otherwise-ready work.
- FIX-006 alternative per gap plan §26: it may instead "ride" any future plan-touching batch; including it in Batch C is acceptable because it is isolated validation + unit test.

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | RED: edit form renders prefilled demographics/contact fields; submit calls `updateDentalPatient`; updated values render after save; archived patient → edit disabled (BR-015b) | frontend/component | Edit saves, persists, reloads; archived read-only respected in UI | New: `apps/dentalemon/src/features/patients/components/patient-edit-form.test.ts` (follow colocated convention, e.g. `patient-registration-modal.test.ts`) |
| FIX-001 | E2E: open profile → edit phone → save → reload → new phone shown | E2E/Playwright | Real wiring end-to-end (core journey; per §26 "edit-save-reload") | New spec alongside existing patient-registration E2E (`apps/dentalemon` E2E suite) |
| FIX-002 | RED: statement view renders visits/procedures/payments/balance from `getDentalPatientStatement` response; print action invokes shared print utility | frontend/component | Statement affordance exists, renders itemized data, API and UI agree | New: `apps/dentalemon/src/features/patients/components/patient-statement.test.ts` |
| FIX-003 | RED: failed communication-consent PATCH → visible error (toast/alert) + retry affordance; success path unchanged | frontend/component | Silent failure becomes surfaced failure; staff cannot falsely believe prefs saved | New/extend test for `routes/_dashboard/patients.tsx` registration flow (mock failed PATCH; use `makeSdkError`-style factory per established convention) |
| FIX-004 | Equality pin: safety-floor endpoint aggregate == med-history-derived floor for the same seeded patient | integration (backend) | The two alert sources cannot silently diverge | New block in `services/api-ts/src/handlers/dental-patient/dental-patient.test.ts` (or alerts test file) comparing `getDentalPatientSafetyFloor` vs `listMedicalHistory` derivation |
| FIX-005 | Update stale assertion 500 → 501 | backend/regression | Known-red test goes green against the by-design 501 stub | Existing: base `patient/patient.test.ts` (services/api-ts) — assertion update only |
| FIX-006 | RED: creating/updating a plan where total ≠ Σ item costs is rejected (or total derived) per TP-BR-006 | backend/unit | Plan-total integrity enforced before billing handoff | Existing: `services/api-ts/src/handlers/dental-patient/dental-patient-treatment-plan.test.ts` (extend) |

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | New `features/patients/components/patient-edit-form.tsx` (+ test); `patient-profile-page.tsx` (edit affordance); possibly `hooks/use-patient-actions.ts` or a new `use-update-patient` hook; SDK hook already generated (no regen) | module-local | Low — additive FE; backend untouched |
| FIX-002 | New `features/patients/components/patient-statement.tsx` (+ test); `patient-profile-page.tsx` (Statement action); **consumes** shared print utility from billing batch | module-local + cross-module consumer | Low-Medium — depends on shared print utility API shape |
| FIX-003 | `apps/dentalemon/src/routes/_dashboard/patients.tsx` (replace silent `.catch(() => {})`; prefer existing SDK call over raw fetch per repo no-raw-fetch convention) | module-local | Low — one call site |
| FIX-004 | Test-only: `services/api-ts/src/handlers/dental-patient/` test file | module-local (test) | None (no source change) |
| FIX-005 | Test-only: base `patient/patient.test.ts` assertion | module-local (test) | None |
| FIX-006 | `handlers/dental-patient/treatment-plans/` create/update handler or repo validation + `dental-patient-treatment-plan.test.ts` | module-local | Low — validate-then-reject; check existing seeds/tests don't rely on mismatched totals |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-002 | shared/platform `[SHARED DEPENDENCY]` | Shared print/PDF utility — **owned by dental-billing** (receipt first), per `docs/aha/module-fix-plans/dental-billing-fix-ready-plan.md` | One print pattern platform-wide; building a second utility here is forbidden `[DO NOT OVERBUILD]` | **Yes** — billing print batch must land first |
| FIX-001 | module-local | None beyond existing tested handler `identity/updateDentalPatient` (archived-guard + branch scoping already enforced server-side) | FE must respect 403/archived responses, not re-implement guards | No |
| FIX-003 | module-local | Existing `updatePatientCommunicationConsent` endpoint + `communication-consent.test.ts` backend coverage | Backend is correct; only FE error handling changes | No |
| FIX-006 | cross-module (downstream) | Plan totals feed billing/case-presentation surfaces | Validation must not break existing plan fixtures/seeds; run plan + case-presentation tests after | No (verify after) |
| (blocked) GAP-3 | product decision `[CROSS-MODULE RISK]` | Claims-vertical decision — **owned by dental-billing** (one decision covering billing GAP-7 + patient GAP-3) | Two half-built halves of one revenue-cycle feature; must not be wired one side alone | Yes — decision first (see §9) |
| (blocked) GAP-9 | shared/platform `[SHARED DEPENDENCY]` | Offline localId idempotency pattern owned by offline-sync group (SL-01 precedent; mirror `dental-invoice.schema.ts:52-54`) + scope confirmation Q2 | Must reuse the established pattern, not reinvent; would add a DB unique index (database/schema batch if approved) | Yes — confirmation first |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Q1: Claims vertical — park or finish? (patient insurance sub-domain ~10 ops + billing claims) | `[NEEDS PRODUCT DECISION]` | none active (GAP-3, blocked) | ~14 orphan ops across 2 modules; single decision pre-assigned to **dental-billing** | Decide once in the cross-module decision queue; this plan defers to `docs/aha/module-fix-plans/dental-billing-fix-ready-plan.md` |
| Q2: Is offline patient registration in V1 scope? | `[NEEDS CONFIRMATION]` | none active (GAP-9, blocked) | Drives localId + unique-index work; duplicate-patient risk on replay if in scope | Confirm with offline-sync group; if yes, schedule a small backend+schema batch mirroring SL-01 |
| Q3: Alert source of truth — `dental-alerts` entity vs med-history-derived floor? | `[NEEDS PRODUCT DECISION]` | none active (GAP-6, blocked); FIX-004 pin is decision-neutral | Wiring both naively creates two disagreeing alert sources | Park `dental-alerts` (likely) or define a distinct purpose; decide before any alert wiring |
| Q4: Where is FR2.16 emergency contact stored — person fields or the orphan contacts sub-domain? | `[NEEDS CONFIRMATION]` | none active (GAP-5, blocked) | Determines wire-contacts-CRUD vs park; cannot pick a fix shape without it | Eng confirmation: inspect registration payload/person schema; then wire-or-park |
| Q5: Households — park writes until Phase 2? | `[NEEDS PRODUCT DECISION]` | none active (GAP-7, deferred) | PRD §2.5 declares Phase 2; reads already shipped harmlessly | Default: park writes; document dormant |
| Q6: Patient photo capture (FR2.3) — implemented? | `[NEEDS CONFIRMATION]` | none | Unverified this round (P3) | Quick eng check during any patients-FE session; no fix planned |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| GAP-3 insurance vertical FE (park vs finish, ~10 orphan ops) | `[NEEDS PRODUCT DECISION]` `[CROSS-MODULE RISK]` | Decision is **owned by dental-billing** (one claims-vertical decision covering billing GAP-7 + this GAP-3); duplicating or deciding here would split the vertical | Claims decision recorded in `docs/aha/module-fix-plans/dental-billing-fix-ready-plan.md`; if "finish", wire patient insurance in the joint claims batch — never alone |
| FIX-002 / Batch B (statement print) | `[SHARED DEPENDENCY]` | Print/PDF utility owned by dental-billing (receipt first); a second print utility is forbidden | Billing print-utility batch lands; then run Batch B consuming it |
| GAP-9 offline registration localId + unique index | `[NEEDS CONFIRMATION]` `[SHARED DEPENDENCY]` | Scope question Q2 open; pattern owned by offline-sync group; includes a schema change (unique index) | Q2 confirmed in-scope → small backend + database/schema batch mirroring `dental-invoice.schema.ts:52-54` |
| GAP-5 contacts sub-domain wire-or-park (4 ops) | `[NEEDS CONFIRMATION]` | Fix shape unknown until Q4 answers where emergency contact lives today | Q4 eng confirmation |
| GAP-6 dental-alerts park-or-repurpose (3 ops) | `[NEEDS PRODUCT DECISION]` | Two candidate alert sources; wiring either before Q3 risks dual sources of truth | Q3 decision; FIX-004 equality pin can land first (decision-neutral) |

## 10. Deferred Items

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Household write UIs (create/add/remove) | GAP-7 | V2 DEFERRED `[NEEDS PRODUCT DECISION]` (Q5) | PRD §2.5 Phase 2; read-only card already serves V1 honestly |
| Insurance/claims FE completion | GAP-3 | V2 DEFERRED unless claims decision says finish | PRD §2.5 Phase 2; decision owned by dental-billing |
| Patient merge (BR-020) + merge-cascade design (WFG-007) | §23 | V2 DEFERRED | Spec-declared 501 by design; cascade semantics undefined |
| Automated recall reminders | §23 | V2 DEFERRED | PRD Phase 2; producer side noted in notifications round |
| Age-16 consent-transition prompt (EC9) | §23 | V2 DEFERRED `[NEEDS CONFIRMATION]` | Edge automation; manual consent update suffices for V1 |
| Bulk import FE (`importDentalPatients` wiring) | §4 row "Bulk import" | `[NEEDS PRODUCT DECISION]` | Owned by external-records-import round (its G1); not this module's call |
| Wiring `getDentalPatientSafetyFloor` as the FE source | GAP-8 (alt fix) | `[NEEDS PRODUCT DECISION]` (Q3) | Equality pin (FIX-004) chosen instead; switching sources pre-empts the GAP-6 decision |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| Second print/PDF utility in dental-patient | GAP-2 | Shared utility owned by dental-billing; duplicating it is the exact overbuild the bundle ownership prevents `[DO NOT OVERBUILD]` |
| FTS index / search optimization | §23 | Search meets <1s today; optimize only on evidence `[DO NOT OVERBUILD]` |
| New alert entity expansion (or wiring both alert sources) | GAP-6 | Dual-source-of-truth must be resolved first; wiring both creates disagreeing alerts |
| Re-fixing archived-write guards (G4) | §3 erratum | Verified CLOSED across all sub-domains (6 guards spot-checked); stale matrix row — any inherited G4 backlog rows must be dropped |
| Re-fixing SL-01/02/09/12 sync items, branch isolation, plan FSM/approval | §26 | Source-verified fixed this round; do not re-litigate |
| New scheduler/cron framework (if any follow-up needs scheduled work) | platform erratum | Scheduler already exists at `services/api-ts/src/core/jobs.ts`; register jobs there `[DO NOT OVERBUILD]` |
| Reminder automation inside this module | §23 | Notifications round owns; Phase 2 |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | The gap *is* the missing FE affordance; backend is complete and guarded. Wiring the form fixes the actual hole, not a symptom |
| FIX-002 | Root cause | Same class: missing affordance over a finished handler. Sequencing behind the shared print utility avoids the symptom-fix of a one-off window.print hack |
| FIX-003 | Root cause | Deliberate-but-wrong "non-blocking" catch; replacing it with surfaced error + retry fixes the trust defect at its source. Do not "fix" by retry-loop hiding |
| FIX-004 | Workaround (deliberate, decision-neutral) | The pin guards against drift without choosing an alert source of truth; the root fix is the Q3 decision (GAP-6) |
| FIX-005 | Root cause (test-side) | Handler is correct (501 by design, EM-PAT-007); the test encoded a stale expectation |
| FIX-006 | Root cause | Missing validation at the write boundary; enforcing TP-BR-006 where plans are created/updated prevents bad totals from ever reaching billing |

## 13. Recommended First Fix Batch

**Batch A — FIX-001 (GAP-1: patient demographics edit).**

- **Included Fix IDs:** FIX-001 only.
- **Why first:** It is the module's only P1 that is fully unblocked (Batch B waits on billing's print utility). "Fix a typo in a patient record" is table-stakes; every day without it permanently degrades the platform's central entity, and it is the lowest-risk P1 available (FE-only, tested handler, SDK already generated).
- **Tests to write first (RED before any implementation):**
  1. `apps/dentalemon/src/features/patients/components/patient-edit-form.test.ts` — renders prefilled, submits via `updateDentalPatient`, updated values render after save, archived patient → edit disabled.
  2. E2E edit-save-reload spec (open profile → change phone → save → reload → persisted).
- **Explicit out-of-scope for Batch A:** statement UI (Batch B), comms-consent error surfacing and pins (Batch C), anything touching insurance/household/alerts/contacts orphans, photo capture, merge, backend/TypeSpec changes of any kind, SDK regeneration.

## 14. Instructions for 04 Fix Prompt

- **Module/group name:** Dental Patient
- **Module slug:** `dental-patient`
- **Fix-ready plan path:** `docs/aha/module-fix-plans/dental-patient-fix-ready-plan.md`
- **Batch to execute first:** **Batch A (FIX-001)**. Then Batch C (FIX-003/004/005/006) in a follow-up pass. Batch B (FIX-002) only after the dental-billing print-utility batch has landed (check `docs/aha/module-fix-plans/dental-billing-fix-report.md` exists and covers the print utility before starting).
- **Tests to prioritize:** RED-first FE component test `patient-edit-form.test.ts` + E2E edit-save-reload (Batch A). For Batch C: failed-PATCH error-surface FE test; safety-floor equality backend pin; unmerge 500→501 assertion update; TP-BR-006 plan-total unit test.
- **Files likely to touch:** `apps/dentalemon/src/features/patients/components/` (new `patient-edit-form.tsx`, edits to `patient-profile-page.tsx`), `apps/dentalemon/src/routes/_dashboard/patients.tsx` (Batch C), `services/api-ts/src/handlers/dental-patient/treatment-plans/` + its test file (FIX-006 only). **No TypeSpec, no migrations, no SDK regen needed** — SDK fns for `updateDentalPatient`/`getDentalPatientStatement` already exist in `packages/sdk-ts/src/generated/`.
- **Shared/database cautions:** none for Batches A/C (no schema changes, no shared-file edits). Batch B must consume the billing-owned shared print utility — never create a parallel one. If FIX-006 validation breaks existing plan fixtures, fix the fixtures' totals, not the rule. Test runs: backend via `scripts/test-with-db.ts` with inline `DATABASE_URL=...monobase_test`; never run the live server/contract/E2E against `monobase_test`.
- **Items NOT to implement:** GAP-3 insurance wiring (claims decision owned by dental-billing), GAP-5 contacts wiring (Q4 open), GAP-6 alerts wiring (Q3 open), GAP-7 household writes (Q5/Phase-2), GAP-9 localId (Q2 open), patient merge/cascade, reminder automation, FTS optimization, alert-entity expansion, any re-fix of G4 archived guards or SL-series sync items (verified done), any second print utility, any new scheduler.

---

Next recommended step:
Module/group: Dental Patient
Module slug: dental-patient
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/dental-patient-fix-ready-plan.md
Recommended batch: Batch A (FIX-001 — patient demographics edit)
