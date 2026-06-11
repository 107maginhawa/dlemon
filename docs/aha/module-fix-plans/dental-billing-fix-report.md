# AHA Module/Group Fix Report: Dental Billing

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Dental Billing |
| Module slug | dental-billing |
| Raw gap plan used | `docs/aha/module-gap-plans/dental-billing-gap-plan.md` |
| Fix-ready plan used | `docs/aha/module-fix-plans/dental-billing-fix-ready-plan.md` |
| Output fix report | `docs/aha/module-fix-plans/dental-billing-fix-report.md` |
| Fix date | 2026-06-11 |
| Batch executed | Batch A — overdue/plan status sweep cron (FIX-001 + FIX-002) |
| Superpowers used | Yes (TDD + verification-before-completion) |
| Working tree status checked | Yes — clean before Batch A (prior dental-org commits landed) |
| Fix scope | P1 (FIX-001) + V1 RECOMMENDED severable (FIX-002) |
| Out of scope | Batches B/C/D/E; claims; recordedByMemberId; receipt email; auto-discounts; any new scheduler |
| Shared files touched | Yes — one additive registration line in `services/api-ts/src/app.ts` |
| Schema/migration touched | No (`overdue` + plan-status enums already exist) |
| Code commit | `b45a3616` |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope | Reason | Status |
| --- | --- | --- | --- | --- | --- |
| FIX-001 | GAP-1: `markOverdueInvoices` has 0 production callers — "overdue" filter/badges never fire | P1 | V1 REQUIRED | The only P1; product silently lies (a filter that can never populate); smallest backend-isolated TDD slice | Fixed |
| FIX-002 | GAP-1 shared cause: plan-"Behind" auto-status (7+ days past due) never flips (FR4.3) | P2 | V1 RECOMMENDED (severable) | Included — semantics were already confirmed by the tested per-plan `updatePlanStatus`; only a thin sweep wrapper was missing (no balloon) | Fixed |

## 3. Baseline Before Changes

| Check/Test | Result Before | Related Fix | Notes |
| --- | --- | --- | --- |
| `markOverdueInvoices` callers | 0 (repo grep) | FIX-001 | Repo logic + idempotency already tested in `dental-billing.invoice-lifecycle.test.ts`; no caller existed |
| Plan-"Behind" sweep | none | FIX-002 | Per-plan `updatePlanStatus` tested (7d→behind), but nothing enumerated active plans |
| New `jobs/jobs.test.ts` | RED (module not found) | both | Confirmed failing for the expected reason before implementation |

## 4. Changes Made

| Fix ID | Implemented | Files |
| --- | --- | --- |
| FIX-001 | New `registerDentalBillingJobs` registering a daily `dental-billing.status-sweep` cron on the existing `core/jobs.ts` scheduler; handler calls the existing `markOverdueInvoices` | NEW `services/api-ts/src/handlers/dental-billing/jobs/index.ts`; `services/api-ts/src/app.ts` (import + one registration line) |
| FIX-002 | New `reevaluateActivePlanStatuses()` repo sweep (enumerates on_track/behind plans, calls the tested `updatePlanStatus` per plan, returns changed count); invoked by the same cron handler | `services/api-ts/src/handlers/dental-billing/repos/dental-payment-plan.repo.ts` (+`inArray` import) |

## 5. Tests Added / Updated

| Test File | Type | What It Proves |
| --- | --- | --- |
| `services/api-ts/src/handlers/dental-billing/jobs/jobs.test.ts` (new) | backend/unit + integration | (1) the cron is registered (`dental-billing.status-sweep`, valid 5-field pattern); (2) the registered handler transitions a past-due issued invoice to `overdue`; (3) idempotent second run; (4) flips an active plan with a 7+-day overdue installment to `behind`; (5) leaves a current (not-yet-overdue) plan `on_track` |

No new FE work in this batch (the plan's "overdue filter populates" E2E is deferred — it depends on the FIX-011 aged-receivable seed in Batch D and a cron-trigger hook; see §9).

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `scripts/test-with-db.ts .../jobs/jobs.test.ts` | Passed | 5/0 |
| `scripts/test-with-db.ts .../dental-billing.invoice-lifecycle.test.ts` | Passed | 23/0 (in isolation) |
| `scripts/test-with-db.ts .../repos/dental-payment-plan.test.ts` | Passed | 9/0 (in isolation) |
| `bunx tsc --noEmit` (api-ts) | Passed | clean |
| `bun run check:boundaries:dental-billing` | Passed | no violations |
| Server boot (`bun dev` :7213) | Passed | log: `Scheduled cron job: dental-billing.status-sweep with pattern: 0 2 * * *`; no boot errors |

**Note on the directory run:** `scripts/test-with-db.ts src/handlers/dental-billing/` (whole-dir, one shared clone) reported mass `dental_invoice` insert failures — this is the known postgres-connection-saturation / shared-clone artifact (every affected file passes in its own clone), not a regression. Per-file runs are the trustworthy signal.

## 7. Validation Summary

Batch A validation passed: RED→GREEN integration tests proving the transitions fire from the registered handler (not just the repo in isolation), api-ts typecheck, module boundaries, and a live boot confirming the cron schedules. No FE, contract, or schema surface was touched.

## 8. Shared / Cross-Module / Database Impact

| Area | Files | Blast Radius | Coverage |
| --- | --- | --- | --- |
| Scheduler registration `[SHARED DEPENDENCY]` | `app.ts` (one additive line) | Additive only — scheduler already runs 8 module job sets; job name namespaced `dental-billing.*` | Boot log confirms registration; registration unit test |

No database/schema changes. Job name does not collide with `dental-visit.*` (its sibling lock-cron, when built).

## 9. Remaining Gaps

| Gap | Reason Not Completed | Next Step |
| --- | --- | --- |
| Overdue-filter E2E (FIX-001 "during") | Needs the Batch D FIX-011 aged-receivable seed + a cron-trigger hook; keeping Batch A backend-isolated per plan | Add during Batch D once aged seed exists |
| Batches B (discount/void UI), C (payment-plan create), D (pins+seed), E (shared print utility + receipt) | Not in this pass | Per the execution order, Batch E (shared print utility) runs next for this module |

## 10. Blocked / Deferred / Do-Not-Build (unchanged from plan)

Claims vertical, `recordedByMemberId` derivation, receipt email, auto PWD/Senior discount engine, tax engine, any new scheduler/queue framework — all remain blocked/deferred/do-not-build per §8–§11 of the fix-ready plan. None entered this batch.

## 11. Files Changed

| File | Change | Fix |
| --- | --- | --- |
| `services/api-ts/src/handlers/dental-billing/jobs/index.ts` | New — `registerDentalBillingJobs` daily status-sweep cron | FIX-001/002 |
| `services/api-ts/src/handlers/dental-billing/jobs/jobs.test.ts` | New — registration + handler integration tests | FIX-001/002 |
| `services/api-ts/src/handlers/dental-billing/repos/dental-payment-plan.repo.ts` | New `reevaluateActivePlanStatuses()` + `inArray` import | FIX-002 |
| `services/api-ts/src/app.ts` | Import + `registerDentalBillingJobs(jobs)` registration line | FIX-001 |

## 12. Completion Decision

`COMPLETE` (Batch A) — FIX-001 + FIX-002 fixed RED-first, integration-proven against a real DB, server boot confirmed, all gates green. FIX-002 was included (not deferred) because its semantics were already settled by the tested `updatePlanStatus` and only a thin sweep wrapper was needed.

## 13. Recommended Next Step

Run a `04` pass for **Batch E — shared print/PDF utility + receipt** (`docs/aha/module-fix-plans/dental-billing-fix-ready-plan.md`), the platform batch that must land before dental-patient (statement) and case-presentation (estimate) consume the shared print primitive. Batches B/C/D remain for subsequent passes.
