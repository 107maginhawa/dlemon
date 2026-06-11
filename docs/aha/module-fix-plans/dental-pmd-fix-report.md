# AHA Module/Group Fix Report: Dental PMD (Portable Medical Document)

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Dental PMD (Portable Medical Document) |
| Module slug | dental-pmd |
| Raw gap plan used | `docs/aha/module-gap-plans/dental-pmd-gap-plan.md` |
| Fix-ready plan used | `docs/aha/module-fix-plans/dental-pmd-fix-ready-plan.md` |
| Output fix report | `docs/aha/module-fix-plans/dental-pmd-fix-report.md` |
| Fix date | 2026-06-11 |
| Batch executed | Batch A — generation trigger (FIX-001) |
| Superpowers used | Yes (TDD + verification-before-completion) + a focused adversarial code review of the hot-path edit |
| Working tree status checked | Yes — clean before Batch A |
| Fix scope | FIX-001 (FAIL root, P0-equivalent) |
| Out of scope | Batch B (snapshot content — deferred to next pass), C (merge), D (E2E — blocked on dental-clinical top-bar), E (sign-or-strip — Q2); the `onPmd` button (dental-clinical owns it) |
| Shared files touched | Yes — `dental-visit/visits/updateDentalVisit.ts` (cross-module completion hot path, small guarded insertion) |
| Schema/migration touched | No |
| Code commit | `a2c3618e` |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Reason | Status |
| --- | --- | --- | --- | --- |
| FIX-001 | GAP-1: no generation trigger — `generatePMD` had 0 callers on the completion path; zero PMDs creatable | FAIL root (P0-equiv) | The portability promise produced zero documents; everything downstream was dead. Decision-free (PRD FR12.1 mandates auto-generate on completion; Q1 confirmation-only) | Fixed |

## 3. Baseline Before Changes

| Check/Test | Result Before | Notes |
| --- | --- | --- |
| `generatePMD` callers on completion path | 0 (verified) | `updateDentalVisit` completed-branch had no PMD call |
| New `pmd-generation-trigger.test.ts` | RED (no PMD created on completion) | Confirmed failing for the expected reason |

## 4. Changes Made

| Fix ID | Implemented | Files |
| --- | --- | --- |
| FIX-001 | Extracted reusable in-process core `generatePmdForVisit()` from the `generatePMD` HTTP handler (no HTTP self-call); the handler keeps RBAC + visit-status + body.patientId checks and delegates. Wired a failure-isolated, idempotent auto-generation trigger into `updateDentalVisit`'s completed branch (after the fail-closed completion audit). Dynamic import avoids the dental-visit ↔ dental-pmd static cycle. | `generatePMD.ts`, `updateDentalVisit.ts` |
| Contract | `dental-pmd.hurl`: completion alone (no manual POST) now pins GET `/{visitId}/pmd` 200 | `specs/api/tests/contract/dental-pmd.hurl` |

## 5. Tests Added / Updated

| Test File | Type | What It Proves |
| --- | --- | --- |
| `pmd-generation-trigger.test.ts` (new) | backend/integration | Completing a visit through the real handler produces a PMD for that visit; re-completion supersedes (one current `generated` row, never duplicates) |
| `pmd-generation-trigger.failure-isolation.test.ts` (new) | backend/integration | When PMD generation throws (mock.module), the visit still completes (200, `completed`) and no PMD row is produced — the hot path is safe |
| `dental-pmd.hurl` (extended) | integration/contract | Auto-generation on completion pinned at the contract layer (step 4b) |

## 6. Tests Run

| Command | Result |
| --- | --- |
| `pmd-generation-trigger.test.ts` | 2/0 |
| `pmd-generation-trigger.failure-isolation.test.ts` | 1/0 |
| `dental-pmd.test.ts` (HTTP handler, post-refactor) | 39/0 |
| `dental-visit.test.ts` | 68/0 |
| `business-rules.test.ts` (completion path) | 6/0 |
| `bunx tsc --noEmit` (api-ts) | clean |
| `CONTRACT_ONLY=dental-pmd` (fresh :7213) | 27 reqs, 100% |
| Server boot | clean |

## 7. Adversarial Review (pre-commit)

A focused `code-reviewer` agent reviewed the cross-module hot-path edit + refactor across 6 dimensions:
- **Clean:** checksum byte-identical to pre-refactor (same JSON key order/fields/audit); transaction isolation genuine (completion auto-commits before the try block — a PMD throw cannot roll it back); `updated` is a strict superset of the core's `VisitForPmd`; dynamic import breaks the cycle safely.
- **Folded in:** the failure-isolation catch now surfaces an `AppError` code in the log so on-call can distinguish a config failure (e.g. deactivated membership → FORBIDDEN) from transient I/O — behavior unchanged (still swallowed; completion still succeeds; re-verified 3/0).
- **Documented (pre-existing, out of no-touch scope — see §9):** (1) `authorMemberId` is the completing actor, not necessarily the visit's assigned dentist — pre-exists in the HTTP handler; the refactor is faithful; (2) the `findByVisit`→create/supersede path has no unique-index guard, so concurrent double-completion of the same visit could race to two `generated` rows — pre-exists in the manual generate path too; the plan forbids touching supersede/checksum/schema.

## 8. Shared / Cross-Module Impact

| Area | Files | Blast Radius | Mitigation |
| --- | --- | --- | --- |
| Visit completion hot path `[CROSS-MODULE RISK]` | `updateDentalVisit.ts` (small guarded insertion) | Every visit completion now synchronously generates a PMD | Failure-isolated (try/catch, separate auto-commits) + idempotent (supersede); integration + failure-isolation tests; all existing visit tests green |

Note: PMD generation is now **synchronous in the completion request** (the plan's chosen shape). Latency is modest (a few reads + one insert + two audit rows). If async is ever preferred, register a job on the existing `core/jobs.ts` scheduler — do not build new infrastructure.

## 9. Remaining Gaps / Blocked / Deferred

| Item | Status | Note |
| --- | --- | --- |
| Batch B (FIX-002 snapshot content: safety floor + demographics) | Not run this pass | Recommended next dental-pmd pass; the plan preferred same-pass but it is severable. Until then, auto-generated PMDs carry the existing snapshot (treatments + prescriptions) |
| Batch C (FIX-003 safety-floor merge) | Deferred | Needs a TypeSpec op + SDK regen + insert-only med-history writes |
| Batch D (FIX-004 honest E2E) | Blocked | Needs dental-clinical's WorkspaceTopBar batch (the `onPmd` button) + this Batch A |
| Batch E (FIX-005 sign-or-strip) | Blocked | Q2 product decision |
| `authorMemberId` = actor vs assigned dentist | `[NEEDS PRODUCT DECISION]` (noted) | Pre-existing; decide whether the PMD author should be the visit's dentist of record; do not change checksum/identity without sign-off |
| PMD create/supersede concurrency (no unique index on `pmd_document.visit_id`) | `[NEEDS CONFIRMATION]` for prompt-06 schema audit | Pre-existing race in the supersede path; rare; failure-isolated so completion is never affected |

## 10. Do Not Build (unchanged from plan)

The `onPmd`/WorkspaceTopBar button (dental-clinical owns it), any settings shell (dental-org owns it), FIX-005 signing (Q2), GAP-6 FHIR per-visit (Q4), any new scheduler, and any rework of checksum/immutability/supersede/RBAC — none entered this batch.

## 11. Files Changed

| File | Change | Fix |
| --- | --- | --- |
| `services/api-ts/src/handlers/dental-pmd/generatePMD.ts` | Extract reusable `generatePmdForVisit` core; handler delegates | FIX-001 |
| `services/api-ts/src/handlers/dental-visit/visits/updateDentalVisit.ts` | Failure-isolated, idempotent auto-generation trigger in the completed branch | FIX-001 |
| `services/api-ts/src/handlers/dental-pmd/pmd-generation-trigger.test.ts` | New integration tests | FIX-001 |
| `services/api-ts/src/handlers/dental-pmd/pmd-generation-trigger.failure-isolation.test.ts` | New failure-isolation test | FIX-001 |
| `specs/api/tests/contract/dental-pmd.hurl` | Auto-generation contract pin | FIX-001 |

## 12. Completion Decision

`COMPLETE` (Batch A) — FIX-001 fixed RED-first, integration-proven (completion→PMD, idempotent, failure-isolated), contract-pinned, adversarially reviewed, all existing tests green. The module's FAIL root (no creation path) is resolved: visit completion now produces a PMD.

## 13. Recommended Next Step

Per the execution order, proceed to **dental-clinical Batch A** (WorkspaceTopBar `onLab` + `onPmd` wiring + remove false-green E2E) — which also unblocks this module's Batch D (honest E2E). A future dental-pmd pass should run Batch B (snapshot content: safety floor + demographics) so auto-generated PMDs carry the full FR12.1 content.
