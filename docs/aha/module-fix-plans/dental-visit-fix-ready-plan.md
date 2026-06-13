# AHA Fix-Ready Plan: Dental Visit & Charting

**Generated:** 2026-06-11 · **Prompt:** `docs/aha/prompts/03-organize-gap-plan-for-fixing.md` · **Branch:** `chore/workflow-verification-sweep`

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Dental Visit & Charting |
| Module slug | dental-visit |
| Source gap plan | `docs/aha/module-gap-plans/dental-visit-gap-plan.md` |
| Output file | `docs/aha/module-fix-plans/dental-visit-fix-ready-plan.md` |
| Audit decision | PARTIAL PASS |
| Superpowers used | No — organizer discipline applied via shared rules (`00-aha-shared-rules.md` §19); no Superpowers skill invoked |
| Organizer decision | READY |
| Reason | The gap surface is small and precise (6 actionable gaps + 3 cheap/polish). Four batches are decision-free and fix-ready now; one batch is cross-module-blocked (shared accepted-plan viewer, owned by case-presentation); one item is product-decision-blocked (templates Q1). All active fixes trace to grep/source-verified evidence in the gap plan §3/§5/§12. |
| Limitations | Organizer re-verified key negatives by grep this round (orphan endpoints, cron consumers, rbac helper usage) but did not run tests. Cross-referenced fix plans (`case-presentation-fix-ready-plan.md`, `dental-billing-fix-ready-plan.md`) may not exist yet — paths are the orchestrator-decided canonical locations. |

**Organizer corrections/clarifications vs raw gap plan (do not rewrite the gap plan; recorded here):**

1. **Scheduler erratum confirmed in source.** `services/api-ts/src/core/jobs.ts` exposes `registerCron(name, pattern, handler)` (jobs.ts:38/152, `createJobScheduler` :619) and is wired in `services/api-ts/src/app.ts:286-292` with 7 per-module `register*Jobs` calls following a `handlers/<module>/jobs/index.ts` convention (booking, retention, notifs, audit, dental-patient, email, dental-scheduling). GAP-4 therefore shrinks to **registering one module-local cron** — no shared/platform batch needed, and the gap plan's §21 "Build once in billing batch" sequencing is OBSOLETE: the visit-lock cron does NOT need to wait for dental-billing. `[DO NOT OVERBUILD]` — no new scheduler framework.
2. **GAP-3 ownership clarified (orchestrator decision).** The shared accepted-plan viewer is OWNED by case-presentation (its GAP-1 = this module's GAP-3, same component). `getTreatmentPlanVersion` handlers exist in both `services/api-ts/src/handlers/dental-visit/treatment-plans/getTreatmentPlanVersion.ts` and `services/api-ts/src/handlers/dental-patient/treatment-plans/getTreatmentPlanVersion.ts`. This plan only carries the small visit-side wiring follow-on; the viewer build itself lives in `docs/aha/module-fix-plans/case-presentation-fix-ready-plan.md`.
3. **GAP-6 regen window is ideal right now.** Organizer grep confirms the three drifted ops (`carryOverTreatments`, `applyTemplate`, `getTreatmentPlan*`) have ZERO FE consumers — reconciling TypeSpec + regenerating the SDK breaks nothing today, and becomes hazardous the moment GAP-1 wiring starts. This hardens the gap plan's "Batch A first" recommendation into a strict ordering.
4. **FE rbac helpers located:** `apps/dentalemon/src/lib/rbac.ts` (+ test), currently consumed only by `workspace-top-bar.tsx` — confirms GAP-7 is wiring-only.

## 2. Fix Strategy Summary

- **Fix first:** GAP-6 TypeSpec reconcile + SDK regen + contract pins (FIX-001). It is the platform's known worst bug class (silent contract drift), the regen window is provably safe today (zero FE consumers of the drifted ops), and GAP-1's FE wiring must consume the corrected SDK types — wiring before reconciling would code against lying types or force a raw fetch (forbidden by the no-raw-fetch ESLint rule).
- **Then:** GAP-1 carry-over FE trigger (the module's only P1; decision already made 2026-06-10 — POST /carry-over canonical), then the cheap hardening pair (GAP-7 rbac wiring + GAP-8 docs), then the GAP-4 visit-lock cron (module-local registration on the existing scheduler).
- **Do not fix here:** the shared accepted-plan viewer (case-presentation owns it), templates FE (blocked on product decision Q1), the offline-conflict browser E2E (routed to the prompt-05 offline journey group), anything in gap plan §23 (no job framework, no carry-over policy reopen, no new chart layers).
- **Major risks:** (a) FIX-001 touches the shared regen pipeline — must be its own batch with contract pins before/after; (b) treatment FSM semantics are frozen (6 facades export visit state to billing/patient/org/perio/pmd/plan) — no FSM edits during any FE wiring; (c) do not re-litigate shipped work (charting slices A–D, SL offline chain, 2026-06-08 security fixes) — `CHARTING_RESEARCH_RECONCILIATION.md` status claims are superseded.
- **Batching:** multiple small batches (A→B→C→D now; E after cross-module dependency lands). Not one pass: A touches the shared spec pipeline, B–D are module-local, and mixing them would violate the shared-change isolation rule.
- **Shared/platform/database work:** FIX-001 only (TypeSpec/regen pipeline). No database/schema changes anywhere in this plan (`locked` status and all tables already exist).
- **Product decisions / blockers:** GAP-2 templates wire-vs-park (Q1) blocks one item; Q2 (affordance placement) and Q4 (lock review period) are non-blocking confirmations with recommended defaults below.

## 3. Active Fix Scope

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | GAP-6: TypeSpec↔handler shape drift (`TreatmentPlanResponse`, `ApplyTemplateResponse`, `CarryOverTreatmentsResponse`, `TreatmentTemplate.items`; `CarryOverTreatmentsRequest` missing `restoreDismissedIds`) | P2 | V1 REQUIRED | A | Standing SDK-regen hazard; must precede FIX-002 which consumes these SDK types; regen window provably safe now (0 FE consumers) | `docs/product/modules/dental-visit/API_CONTRACTS.md` "Contract Drift" table (§~352-365); `specs/api/src/modules/dental-visit.tsp` contains all drifted models (grep-verified) |
| FIX-002 | GAP-1: `carryOverTreatments` has zero FE consumers — carry-over action unreachable (returning-patient core loop) | P1 | V1 REQUIRED | B | Module's only P1; product decision already made (2026-06-10: POST /carry-over canonical, source-status guard + content idempotency shipped); pure FE wiring | grep FE = 0 (re-verified by organizer); handler `services/api-ts/src/handlers/dental-visit/treatments/carryOverTreatments.ts:64-90`; gap plan §5/§10/§11 |
| FIX-003 | GAP-3: accepted plan versions unviewable — **visit-side wiring only** (open shared viewer from plans sheet) | P2 | V1 REQUIRED `[CROSS-MODULE RISK]` | E | E-signed legal artifact must be readable; viewer component itself is OWNED by case-presentation (its GAP-1 = same component) | grep `getTreatmentPlanVersion` FE = 0; handlers in both `dental-visit/treatment-plans/` and `dental-patient/treatment-plans/`; orchestrator bundle decision |
| FIX-004 | GAP-4: WF-046 visit-lock job missing — completed visits never reach `locked` | P2 | V1 RECOMMENDED | D | Record-finality promise; shrinks to one module-local cron registration on EXISTING `core/jobs.ts` (erratum confirmed in source); risk bounded by BR-003 (completed already immutable) | `core/jobs.ts:38/152/619`; `app.ts:286-292` (7 existing `register*Jobs`); `locked` status exists in schema; gap plan erratum + §5 |
| FIX-005 | GAP-7: FE affordances not role-gated (`canEditChart`/`canAddTreatment` helpers exist, unused in chart/treatment surfaces) | P3 | V1 RECOMMENDED | C | Cheap, low-risk UX-parity wiring of existing helpers; backend remains the real gate | `apps/dentalemon/src/lib/rbac.ts` helpers consumed only by `workspace-top-bar.tsx` (organizer grep); `tooth-slideout.tsx`/`treatment-table.tsx` have no rbac imports |
| FIX-006 | GAP-8: redundant/orphan ops (`getDentalVisit`, `listPatientVisits`, `updateDentalFinding`) undocumented | P3 | V1 RECOMMENDED | C | Docs-only; prevents future audits re-flagging known-intentional orphans | contract-spine + grep = 0 consumers; gap plan §12 |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| Batch A — Contract safety (shared pipeline, isolated) | Reconcile TypeSpec to real handler shapes → regen routes/validators + SDK → add contract pins | FIX-001 | Medium (touches shared spec/regen pipeline; mitigated: 0 FE consumers of drifted ops, handler shapes already test-locked) | **Run in current `04` pass, FIRST.** Do not combine with B–D. No other TypeSpec work in this module before this lands. |
| Batch B — P1 core loop | Carry-over FE affordance + E2E (returning-patient continuity) | FIX-002 | Low-Medium (FE-only; backend untouched; FSM frozen) | Run in current `04` pass, after Batch A. |
| Batch C — Cheap hardening + docs | Wire existing FE rbac helpers; document intentional orphan ops | FIX-005, FIX-006 | Low | Run in current `04` pass (may ride immediately after Batch B; keep commits separate). |
| Batch D — Lifecycle cron (module-local) | Register visit-lock sweep cron on existing `core/jobs.ts` | FIX-004 | Low (additive `jobs/index.ts` + one `app.ts` line; follows 7-consumer convention) | Run in current `04` pass or a separate small pass. **Does NOT wait for dental-billing** (gap plan §21 sequencing obsolete per erratum). Q4 default is config-driven, non-blocking. |
| Batch E — Cross-module viewer wiring | Open the shared accepted-plan viewer from the visit plans sheet | FIX-003 | Low once dependency lands | **Requires shared cross-module fix first:** execute only after case-presentation's shared viewer component lands (see `docs/aha/module-fix-plans/case-presentation-fix-ready-plan.md`, its GAP-1 batch). |

Cross-module scheduler note: dental-billing plans a sibling overdue-invoice cron (its GAP-1; see `docs/aha/module-fix-plans/dental-billing-fix-ready-plan.md`). **Neither plan creates new scheduler infrastructure** — both register on the existing `services/api-ts/src/core/jobs.ts` (`registerCron`), independently, in either order. `[DO NOT OVERBUILD]`

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | Contract pins for the three reconciled response shapes (+ `restoreDismissedIds` accepted in request) — add BEFORE regen so pins fail if regen drifts | regression (contract/Hurl) | `GET /treatment-plan` returns `{patientId, version, totalEstimateCents, treatmentCount, toothCount, byTooth, treatments[]}`; apply-template returns `{applied: Treatment[], count}`; carry-over returns `{carriedOver[], restoredDismissed[], message}` and accepts `restoreDismissedIds` | extend `specs/api/tests/contract/dental-visit.hurl` (35 existing requests) |
| FIX-001 | Post-regen FE/SDK typecheck gate (not a new test: run `bunx tsc` in api-ts + root typecheck as the RED/GREEN signal) | regression | regenerated SDK types compile against all consumers; no silent breakage | quality gates (typecheck), per CLAUDE.md gotcha (root typecheck = FE only; run api-ts tsc too) |
| FIX-002 | FE component RED: when prior visit has unperformed treatments, a "Carry over from previous visit" affordance renders; clicking it invokes the SDK `carryOverTreatments` fn; carried rows (carriedOver=true) appear in the table | frontend/component | affordance exists, calls the decided-canonical endpoint via SDK (not raw fetch), and UI reflects carried rows | new test beside `apps/dentalemon/src/features/workspace/components/treatment-table.tooth-filter.test.ts` (e.g. `treatment-table.carry-over.test.tsx`) or workspace-level test if affordance lands in new-visit flow |
| FIX-002 | E2E: returning patient → trigger carry-over → carried treatments visible with carried-over indicator | E2E/Playwright | full journey works against real API (core-journey-worthy: returning-patient continuity loop) | extend existing `returning-patient-visit` spec |
| FIX-003 | FE component RED: plans sheet exposes "View signed version" for an accepted plan; opens the shared viewer with the immutable snapshot rendered | frontend/component | snapshot read-back reaches the user from the visit workspace | new test beside `apps/dentalemon/src/features/workspace/components/treatment-plans-sheet.tsx` (write only after the shared viewer component exists) |
| FIX-004 | Backend RED: lock-sweep job — completed visit older than review period → `locked`; recent completed, active, draft visits untouched; idempotent on re-run; emits audit/log | backend/unit | the cron handler performs the WF-046 transition safely and only on eligible rows | new `services/api-ts/src/handlers/dental-visit/jobs/lockSweep.test.ts` (pattern: `dental-patient/jobs/recallDispatch.test.ts`); run via `scripts/test-with-db.ts` |
| FIX-005 | FE component RED: role without chart-edit/treatment-add permission → affordances hidden/disabled in `tooth-slideout` and `treatment-table`; permitted role unchanged | permission/RBAC (frontend/component) | FE parity with backend gate via existing `canEditChart`/`canAddTreatment` helpers | extend existing tests beside `tooth-slideout.tsx` / `treatment-table.tsx`; helper unit coverage already in `apps/dentalemon/src/lib/rbac.test.ts` |
| FIX-006 | None (docs-only) | — | — | — |

No new E2E beyond the single carry-over journey — GAP-5's offline-conflict browser E2E is deliberately routed to the prompt-05 offline group (§10), and FIX-003/004/005 are adequately proven at component/unit level.

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `specs/api/src/modules/dental-visit.tsp` (3 response models + 1 request field + `TreatmentTemplate.items`); regen artifacts (`specs/api/dist/openapi/openapi.json`, `services/api-ts/src/generated/` routes/validators, `packages/sdk-ts` regen); `specs/api/tests/contract/dental-visit.hurl`; update drift table in `docs/product/modules/dental-visit/API_CONTRACTS.md` | shared/platform (spec/regen pipeline) | Low TODAY (0 FE consumers of drifted ops, handler shapes unchanged — spec moves to match reality); regen also re-emits other modules' generated files — verify diff is scoped + full typecheck both workspaces |
| FIX-002 | `apps/dentalemon/src/features/workspace/components/treatment-table.tsx` (header affordance, recommended default) or new-visit flow component; new/extended hook (e.g. in `apps/dentalemon/src/features/workspace/hooks/`, beside `use-treatment-plans.ts`); new FE test; `returning-patient-visit` E2E spec | module-local (FE) | Low — backend untouched; treatment FSM frozen |
| FIX-003 | `apps/dentalemon/src/features/workspace/components/treatment-plans-sheet.tsx` + `apps/dentalemon/src/features/workspace/hooks/use-treatment-plans.ts` (wire `getTreatmentPlanVersion`); imports the shared viewer component from case-presentation's feature area | cross-module | Low once shared viewer exists; read-only wiring |
| FIX-004 | NEW `services/api-ts/src/handlers/dental-visit/jobs/index.ts` + `lockSweep.ts` + test; `services/api-ts/src/app.ts` (+1 `registerDentalVisitJobs(jobs)` line at :286-292 block); review-period config (env-driven, pattern from existing job configs in `core/config.ts`) | module-local + one-line shared touch (`app.ts`) | Low — additive, mirrors 7 existing registrations; NO schema change (`locked` exists) |
| FIX-005 | `apps/dentalemon/src/features/workspace/components/tooth-slideout.tsx`, `treatment-table.tsx`; consume existing `apps/dentalemon/src/lib/rbac.ts` (no helper changes) | module-local (FE) | Low |
| FIX-006 | `docs/product/modules/dental-visit/API_CONTRACTS.md` and/or `MODULE_SPEC.md` (mark `getDentalVisit`/`listPatientVisits`/`updateDentalFinding` as intentional/list-covered/pending-iteration) | module-local (docs) | None |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-001 | shared/platform | TypeSpec → OpenAPI → generated routes/validators → SDK regen pipeline | Regen re-emits shared generated artifacts; any other in-flight TypeSpec work in this module must wait behind Batch A | No (FIX-001 IS the shared work; isolate in its own batch/commits) |
| FIX-002 | shared/platform (soft) | Corrected SDK types from FIX-001 (`CarryOverTreatmentsResponse` real shape) | Wiring against the current `{carried: int32}` placeholder type would be wrong or force raw fetch (lint-forbidden) | **Yes — Batch A first** |
| FIX-002 | cross-module (freeze) | Treatment FSM feeds billing line items via `visit-billing` facade (6 facades export visit state) | Status semantics must stay frozen during FE wiring | N/A (constraint, not work) |
| FIX-003 | cross-module | Shared accepted-plan viewer OWNED by case-presentation (its GAP-1; `docs/aha/module-fix-plans/case-presentation-fix-ready-plan.md`); plan/version handlers also exist under `dental-patient/treatment-plans/` | Do NOT build a duplicate viewer here; visit-side wiring is a follow-on | **Yes — shared component must land first** |
| FIX-004 | shared/platform (existing, additive-only) | EXISTING `services/api-ts/src/core/jobs.ts` scheduler + `app.ts` registration block | One mechanism, many consumers — registration only, no framework. Sibling: dental-billing overdue-invoice cron (`dental-billing-fix-ready-plan.md`); neither plan creates scheduler infra; no ordering between them | No (scheduler already exists) |
| FIX-004 | product decision (non-blocking) | Q4 review-period default (24h vs 48h in different docs) | Affects config default only — make it env-config-driven with a documented default | No (flag for confirmation; do not block) |

No database/schema dependencies in any active fix (`locked` status, `dental_finding`, partial unique indexes all already migrated).

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Q1: Treatment templates — wire FE now or park (and unseed)? | `[NEEDS PRODUCT DECISION]` | (blocked item GAP-2, no Fix ID) | Determines whether GAP-2 becomes an FE-wiring batch or an unseed+document task; demo currently shows seeded data the UI cannot create/apply | Route to cross-module decision queue; until decided, GAP-2 stays in §9 Blocked |
| Q2: Carry-over affordance placement — treatment-table header vs new-visit prompt | `[NEEDS CONFIRMATION]` (non-blocking) | FIX-002 | UX shape only; the endpoint/behavior decision is already made (2026-06-10) | Default to treatment-table header action (always discoverable mid-visit); confirm with design async; do not block Batch B |
| Q3: Hygiene visit type PRD anchor (hygienist-led visits) | `[NEEDS CONFIRMATION]` | none (no active fix) | Role-matrix coherence; implementation + tests exist (`createDentalVisit.ts:32-36`) | PRD doc confirmation only; no code change planned |
| Q4: Visit-lock review period default (24h vs 48h across docs) | `[NEEDS CONFIRMATION]` (non-blocking) | FIX-004 | Config default for the lock-sweep cron | Implement env-config-driven period; pick one documented default (recommend 24h per WF-046's stricter reading) and flag for product confirmation |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| GAP-2: templates FE (wire "Apply template" + management, or park) | `[NEEDS PRODUCT DECISION]` | Wire-vs-park was explicitly left open (Q1); both directions are valid and mutually exclusive | Product answers Q1. If WIRE: new FE batch (slideout/treatment-table affordance + FE RED tests + reuse `templates/` ops). If PARK: unseed demo data + document dormant surface (cheap docs/seed task). |
| FIX-003 / Batch E: visit-side wiring of accepted-plan viewer | `[CROSS-MODULE RISK]` | Shared viewer component is owned and built by case-presentation (orchestrator bundle decision); duplicating it here is forbidden | Case-presentation fix batch lands the shared viewer (`docs/aha/module-fix-plans/case-presentation-fix-ready-plan.md`) |
| GAP-5: offline-conflict full browser E2E | `[TEST GAP]` (cross-module journey) | Spans offline-sync + visit + chart; the gap plan routes it to the prompt-05 offline journey group, not a module-local `04` pass | Prompt 05 cross-cutting/offline-journey batch (after 2–3 module audits, per shared rules §21) |

## 10. Deferred Items

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Chart layer toggles + year filter persistence across reload | GAP-9 | V2 DEFERRED | Polish; local React state acceptable for V1 |
| Divider resize functionality | gap plan §23 | V2 DEFERRED | ADR-005 documented no-op; spec-acknowledged deferral |
| BR-005 auto-discard enablement (+ flag-ON test path) | gap plan §4/§23 | V2 DEFERRED | ADR-010; flag OFF by default; test only if ever enabled |
| Patient merge cascade onto visits | gap plan §23 | V2 DEFERRED | BR-020 — patient-module scope, not visit |
| Offline-conflict browser E2E | GAP-5 | `[TEST GAP]` → prompt-05 group | Cross-module journey; see §9 |
| Templates FE wire-or-park | GAP-2 | `[NEEDS PRODUCT DECISION]` | Blocked on Q1; see §9 |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| New scheduler/job-queue framework for FIX-004 | GAP-4 / gap plan §23 | `[DO NOT OVERBUILD]` — `core/jobs.ts` `registerCron` already exists with 7 module consumers; registration only. Same rule binds dental-billing's sibling cron. |
| Duplicate accepted-plan viewer in dental-visit | GAP-3 | Case-presentation owns the shared component (orchestrator decision); building a second viewer duplicates behavior |
| Re-opening carry-over branch-scope policy | gap plan §21/§23 | Decided 2026-06-08/10; reopen only on explicit product request |
| New chart layers / notation systems beyond FDI+Universal | gap plan §23 | No PRD anchor |
| Treatment FSM changes during any wiring | gap plan §16/§21 | 6 facades export visit state to billing/patient/org/perio/pmd/plan — semantics frozen |
| Re-litigating shipped work: charting P0 slices A–D, SL-01/02/03/09/12 offline chain, 2026-06-08 security fixes, visit FSM | gap plan §26 | Source-verified shipped; `CHARTING_RESEARCH_RECONCILIATION.md` status claims are superseded by the gap plan |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | Drift originated from stringly-typed placeholder TypeSpec models never reconciled after handlers matured; fixing the spec (to match test-locked handler reality) eliminates the regen hazard class for these ops |
| FIX-002 | Root cause | Backend shipped ahead of FE; the missing affordance IS the gap — wiring completes the decided design, no workaround involved |
| FIX-003 | Root cause | Same backend-ahead-of-FE pattern; root fix is the shared viewer (case-presentation) + this wiring |
| FIX-004 | Root cause | Lock transition was never registered as a job; registering the cron is the complete fix (BR-003 immutability already bounds interim risk) |
| FIX-005 | Symptom-level by design | Backend RBAC is the real gate (root enforcement exists); FE gating is deliberate UX parity, not a security fix — acceptable and cheap |
| FIX-006 | Root cause (documentation debt) | Orphan ops are intentional/spec-listed; documenting intent stops repeat audit findings |

## 13. Recommended First Fix Batch

**Batch A — Contract safety (FIX-001).**

- **Included Fix IDs:** FIX-001
- **Why first:** It is the only shared-pipeline change, it unblocks FIX-002 (whose FE wiring must consume the corrected `CarryOverTreatmentsResponse`/SDK types), and the regen window is provably safe right now — the three drifted ops have zero FE consumers, so reconciling spec→reality breaks nothing. Every later batch in this module (and any future TypeSpec edit) gets safer once the pins exist. The gap plan's own instruction: "do NOT regen before reconciling; sequence FIRST if any TypeSpec work is planned in this module."
- **Tests to write first:** Hurl contract pins in `specs/api/tests/contract/dental-visit.hurl` asserting the REAL handler shapes for treatment-plan read, apply-template, and carry-over (incl. `restoreDismissedIds` request acceptance) — written and run RED-able before touching `dental-visit.tsp`, then spec reconcile → regen → pins GREEN; finish with api-ts `bunx tsc` + root typecheck + full backend/FE suites.
- **Explicit out-of-scope for Batch A:** no FE changes; no handler changes (handlers are ground truth — only the spec moves); no other TypeSpec models beyond the five cited; no SDK hand-edits beyond regen; nothing from §9/§10/§11.
- **Operational cautions for 04:** restart the API server before running contract tests (stale server masks drift); never run server/contract against `monobase_test`; `db:generate` only from `services/api-ts` cwd (no migration expected here — flag if regen tries to create one); SDK regen is a separate step from spec build.

## 14. Instructions for 04 Fix Prompt

- **Module/group name:** Dental Visit & Charting
- **Module slug:** `dental-visit`
- **Fix-ready plan path:** `docs/aha/module-fix-plans/dental-visit-fix-ready-plan.md`
- **Raw gap plan (context only):** `docs/aha/module-gap-plans/dental-visit-gap-plan.md`
- **Execute first:** Batch A (FIX-001) only. Then, in later passes/batches as instructed: Batch B (FIX-002), Batch C (FIX-005 + FIX-006), Batch D (FIX-004). Batch E (FIX-003) only after case-presentation's shared viewer lands.
- **Tests to prioritize:** contract pins (FIX-001) → carry-over FE component RED + returning-patient E2E (FIX-002) → rbac-gating component tests (FIX-005) → lock-sweep backend RED (FIX-004, pattern `dental-patient/jobs/recallDispatch.test.ts`).
- **Files likely to touch:** see §6 per fix. Batch A: `specs/api/src/modules/dental-visit.tsp`, regen artifacts, `dental-visit.hurl`, API_CONTRACTS drift table.
- **Shared/database cautions:** FIX-001 is the only shared-pipeline change — keep it isolated, verify regen diff scope, run BOTH typechecks (api-ts `bunx tsc` is not covered by root typecheck). FIX-004 touches `app.ts` with exactly one registration line on the EXISTING scheduler. There are NO database/schema changes in this plan; if any fix appears to need a migration, stop and re-check.
- **Do not implement:** anything in §9 (GAP-2 templates pending Q1; FIX-003 before the shared viewer lands; GAP-5 E2E — prompt-05), §10 (V2 deferred), or §11 (no new scheduler framework, no duplicate viewer, no FSM edits, no carry-over policy reopen, no re-litigation of shipped slices/security fixes).
- **Backend test invocation gotcha:** run via `scripts/test-with-db.ts` with inline `DATABASE_URL=...monobase_test` — never `bun test <path>` directly; never point a live server at `monobase_test`.

---

Next recommended step:
Module/group: Dental Visit & Charting
Module slug: dental-visit
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/dental-visit-fix-ready-plan.md
Recommended batch: Batch A — Contract safety (FIX-001: TypeSpec reconcile → regen → contract pins)
