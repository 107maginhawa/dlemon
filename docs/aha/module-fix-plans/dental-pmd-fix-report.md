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

---

# Addendum — Batch B + Batch C1 pass (2026-06-12, post product-decision session)

**Prompt:** `04-module-or-group-fix-tdd.md` (consolidated via `outputs/EXECUTION-TODO.md` Track 1) · **Branch:** `chore/workflow-verification-sweep` (NOT pushed) · **Superpowers:** Yes (TDD). Driven by the 2026-06-12 product-decision session (`outputs/product-decisions.md` #4/#5/#6/#20).

## Batch executed
- **Batch B** — FIX-002 snapshot content (decisions #5 attestor + #6 narrowed field set). Commit `8cee0d48`.
- **Batch C1** — single-live-PMD invariant + race-safe generation (schema-fix #4; the concurrency gap this report's §9 flagged for prompt-06). Commit `7da38ca6`.
- **Batch C2 (mig-0063 finish / FIX-003 merge)** — **DEFERRED** (decision recorded `2727…`): mechanism-only leaves `markSafetyFloorMerged` at 0 callers; do it with its FIX-003 consumer + bundle the orphan-table reconciliation with migration-safety. Batch D (honest E2E) and Batch E (sign-or-strip, decision #4 = strip) remain.

## Fixes
| Fix | Decision | Status | What shipped |
| --- | --- | --- | --- |
| FIX-002 Batch B | #6 narrowed (floor + name/DOB/sex) | Fixed | `generatePMD.ts` snapshot now carries `safetyFloor` (active allergies/meds/conditions via new `getSafetyFloorForPMD` facade, deterministically ordered so the sha256 seal is reproducible) + narrowed `demographics`. MODULE_SPEC §7.1 reconciled to the V1-narrowed truth. |
| PMD attestor | #5 treating dentist | Fixed | `authorMemberId` (snapshot + DB column) now binds `visit.dentistMemberId` (the clinician who delivered care), not the completing actor — **closes the §9 `[NEEDS PRODUCT DECISION]` author-vs-actor gap**. |
| Concurrency (schema-fix #4) | — | Fixed | Partial unique index `pmd_document_visit_generated_unique` on `(visit_id,status) WHERE status='generated'` (mig 0102); `generatePmdForVisit` catches the 23505 race and resolves idempotently to the winner — **closes the §9 `[NEEDS CONFIRMATION]` no-unique-index concurrency gap**. |

## Tests run (fresh)
| Command | Result |
| --- | --- |
| `dental-pmd.test.ts` (RED→GREEN: +4 Batch B, +2 Batch C1) | 45 / 0 |
| All pmd + dental-visit files (auto-gen path) | 50 files, 506 / 0 |
| **Full backend suite** | 331 files, **3766 / 0** (1 pre-existing `unmergePatients`, unrelated) |
| `bunx tsc` (api-ts) + root typecheck | both exit 0 |

Wire shape unchanged (`content` stays an opaque JSON string; PMDDocument TypeSpec untouched) → no SDK regen. supersede kept two-statement (not `db.transaction`) for `openTestTx` isolation compatibility — index + handler catch deliver the invariant.

## Completion decision
`PARTIALLY COMPLETE` — Batch B + C1 `COMPLETE` and gate-green; C2/D/E remain (C2 deferred with rationale; E = strip path per decision #4; D needs dental-clinical top-bar).

---

# Addendum — Migration-safety pass: 0069 corrective + lint guard + mig-0063 orphan reconcile (2026-06-12)

**Prompt:** `04-module-or-group-fix-tdd.md` (consolidated via `outputs/EXECUTION-TODO.md` Track 1, last item — closes Track 1) · **Branch:** `chore/workflow-verification-sweep` (NOT pushed) · **Superpowers:** Yes (TDD + verification-before-completion). Commit `72954e12`.

## Track-0 finding (recorded in EXECUTION-TODO Track 0)
**0069 populated-DB exposure = NONE** (high confidence). Migration 0069 added `imported_pmd.source_description` as `NOT NULL` with no DEFAULT to a table created 63 migrations earlier (0006) — Postgres rejects that on a *populated* table (23502 on ATRewriteTable), so a populated DB fails to boot; fresh installs apply it to an empty table (CI green). The import write-path was structurally callable 27 days before 0069 (rows *could* lack the column), but every environment is always-fresh (pre-release `0.2.0.0`; no deploy; `db:reset`/`seed-demo` post-migration), so no persistent DB carried a row across the boundary. **Decisive mechanic:** the migrator (`drizzle-orm/node-postgres` `migrate()`) is single-transaction + journal-watermark-gated → a *forward-only* migration cannot rescue a DB blocked at 0069 (the chain halts there). Editing 0069 in place is the only form that closes the hazard, and is safe (watermark-gated → never re-runs on a DB past 0069). **Product confirmation 2026-06-12:** edit 0069 in place + add the lint guard; reconcile the orphan table now.

## Fixes
| Fix | Status | What shipped |
| --- | --- | --- |
| 0069 populated-DB-safe | Fixed | 0069 rewritten to the safe 3-step (`ADD COLUMN IF NOT EXISTS` nullable → `UPDATE` backfill `'Imported before provenance tracking'` → `ALTER COLUMN … SET NOT NULL`). End-state (`source_description NOT NULL`) + Drizzle snapshot unchanged. |
| `lint-migrations.ts` guard | Fixed | Added the missing `ADD COLUMN … NOT NULL` (no DEFAULT) rule — the existing rule only caught `SET NOT NULL`, which is exactly why 0069 slipped through. It was the *sole* match across all migrations before the fix and is satisfied after. Already gated in CI (`quality.yml:110`). |
| mig-0063 orphan-table reconcile (decision #20, part a) | Fixed | `imported_pmd_safety_floor_events` (raw-SQL orphan from 0063, no Drizzle model, absent from the snapshot) now has a Drizzle model (exact 0063 shape: no `baseEntityFields`; explicit FK name `imported_pmd_safety_floor_events_imported_pmd_id_fk`) + idempotent reconcile migration `0103_fat_miek.sql` (`CREATE TABLE IF NOT EXISTS` / FK `DO`-guard / `CREATE UNIQUE INDEX IF NOT EXISTS` — no-op on every DB that ran 0063). Snapshot now tracks the table → db:generate consistent. |
| Append-only merge mechanism + FIX-003 consumer (decision #20, part b) | **Still deferred** | Mechanism-only leaves `markSafetyFloorMerged` at 0 callers; do the append-only INSERT-event merge **with** its FIX-003 clinical consumer as one slice. |

## Tests added / run (fresh)
| Test / command | Result |
| --- | --- |
| `imported-pmd-0069-migration-safety.test.ts` (new): real 0069 SQL applied to a populated pre-0069 fixture in a throwaway schema — RED on the old single-statement form → GREEN on the rewrite; + NOT NULL invariant pin; + 0103 idempotency (re-apply = no-op) | 3 / 0 (RED→GREEN proven) |
| Full dental-pmd suite (12 files) | 122 / 0 |
| Fresh template rebuild (`dropdb monobase_test && db:setup:test`) — full chain `0000→0103` | applies cleanly (0103 no-ops over 0063 objects with the expected "already exists, skipping" notice) |
| Real server boot — runtime migrator on dev `monobase` `0102→0103` | clean ("🚀 Server running") |
| `lint:migrations` | 104 files, 0 unsafe |
| `bunx tsc` (api-ts) + root typecheck (FE + api-ts) | all exit 0 |
| eslint (changed src) | clean |

Backend-only slice (no TypeSpec/wire/SDK/FE change → no contract/FE/E2E, mirroring the scheduling `deletedAt` precedent). Files: `0069_kind_triton.sql`, `0103_fat_miek.sql`, `meta/_journal.json`, `meta/0103_snapshot.json`, `scripts/lint-migrations.ts`, `repos/pmd-document.schema.ts`, `imported-pmd-0069-migration-safety.test.ts`.

## Completion decision
`COMPLETE` (migration-safety pass) — **closes Track 1** of the AHA prompt-04 worklist. Remaining pmd work: Batch D (honest E2E, needs dental-clinical top-bar), Batch E (sign-or-strip → strip per decision #4), and decision-#20 part (b) (append-only merge mechanism + FIX-003 consumer).

---

# Addendum — Batch E: sign-or-strip → STRIP (2026-06-12, post product-decision session)

**Prompt:** `04-module-or-group-fix-tdd.md` (consolidated via `outputs/EXECUTION-TODO.md` Track 3, line 48) · **Branch:** `chore/workflow-verification-sweep` (NOT pushed) · **Superpowers:** Yes (verification-before-completion). Driven by `outputs/product-decisions.md` **#4** (strip + defer honestly). Code/contract/docs commit `49e1197c`.

## Decision executed
**#4 — strip, not wire.** `sign()` has 0 production callers and `signature`/`signed_at` are always NULL; shipping a digital-signature / non-repudiation claim we do not enforce is a compliance liability. Strip the misleading language, **leave signing absent**, document FR12.4 as honestly deferred to Phase-2.

## §15 — code-truth verification BEFORE editing (the fix-ready "strip" premise was unverified)
1. **`sign()` path exists, 0 production callers — but NOT pure dead code:** it has 5 dedicated repo unit tests (`pmd-document.test.ts`: generated→signed transition, re-sign prevention, signature preservation, `findMany({status:'signed'})`), DB columns (`signature`/`signed_at`), an enum value (`signed`), a TypeSpec field + status, and a FE viewer banner. So this is a **tested Phase-2 stub**, not removable dead code.
2. **The signature FIELD is in the contract** (`PMDDocument.signature?`/`signedAt?` + `PMDDocumentStatus.signed`), and the TypeSpec `@example` was a **fake "Signed PMD"** (`status: signed`, `signature: "MEYCIQDsX3..."`, `signedAt`) — the single most **actively-misleading client-facing artifact** in the canonical `openapi.json`.
3. **Layered one-sided drift** (as the prompt predicted, same class as clinical-F): MODULE_SPEC §-deferred (L73) was already reconciled, but §1/§2/§8/§13 + all of API_CONTRACTS + TypeSpec + code comments + a UI-prototype doc still claimed "signed / non-repudiable".

## Fork: REMOVE vs LEAVE-AND-DOCUMENT `sign()` → resolved by decision + risk (no AskUserQuestion)
Decision #4 says **"leave the signature field absent"** = keep the Phase-2-reserved stub, strip only the claims. Removing would be the **higher-risk** path: a destructive column drop (migration) + enum migration + deleting 5 passing tests + a contract change + breaking the FE signed-banner test — all for no compliance benefit over an honestly-labeled absent field. **Kept-and-relabeled** the field/columns/enum/`sign()`/FE-banner as documented Phase-2 stubs. The genuine remove-vs-keep fork was therefore **not** non-obvious after tracing → picked the lower-risk option per the default lean; no user question needed.

## What shipped (strip across 5 layers — no behavior/wire change)
| Layer | File | Change |
| --- | --- | --- |
| Contract | `specs/api/src/modules/dental-pmd.tsp` | module docstring reworded; `@example` "Signed PMD"→unsigned `generated` PMD (fake signature removed); `signature?`/`signedAt?` field comments + `signed` enum → Phase-2 (FR12.4) reserved. Wire types byte-identical. |
| Backend | `generatePMD.ts` | strip "non-repudiation" from the patient-bind comment (kept accurate checksum-sealed integrity); core docstring notes V1 is UNSIGNED. |
| Backend | `repos/pmd-document.repo.ts` | header + `sign()` relabeled as a Phase-2/FR12.4 stub (0 prod callers; tests-only). |
| Schema | `repos/pmd-document.schema.ts` | header docstring + `signature`/`signed_at` column comments + `signed` enum → Phase-2 reserved (NO migration). |
| FE | `pmd-viewer.tsx` | signed-banner (gated on the unreachable `signed` state) marked Phase-2-reserved stub. |
| Docs | `MODULE_SPEC.md` | §1/§2/§8/§13 reconciled + **NEW §8b "Signing posture (FR12.4 — Phase-2 deferred)"** resolving the dangling "see §-signing note" reference. |
| Docs | `API_CONTRACTS.md` | header note; response field table + export envelope annotate signature/signedAt/`signed` as Phase-2 reserved (always null in V1). |
| Docs | `ui-prototype/screens.md` | "per-visit signed snapshots"→"checksum-sealed". |

**Honest-deferral pin** (added to `dental-pmd.test.ts` generate path, non-vacuous regression guard): a generated PMD asserts `status != 'signed'` + `signature`/`signedAt` null — catches any future accidental wiring of signing.

## Tests / gate (no behavior change → self-review, not 3-lens; clinical-F precedent)
| Command | Result |
| --- | --- |
| `dental-pmd.test.ts` (incl. honest-deferral pin) | 45 / 0 |
| `repos/pmd-document.test.ts` (`sign()` stub still works) | 18 / 0 |
| `pmd-generation-trigger.test.ts` | 2 / 0 |
| FE `pmd-viewer.test.ts` (Phase-2 signed-banner test) | 5 / 0 |
| `specs/api` build → `api-ts generate` → `sdk-ts generate` | clean; **SDK drift = description-only** (no wire-type change); `openapi.json` fake signature removed |
| root typecheck (FE + api-ts) | 0 |
| eslint (changed src) | 0 errors (2 pre-existing unused-import warnings) |
| **pmd hurl contract** (fresh :7213) | **27 / 27** |

## Completion decision
`COMPLETE` (Batch E). Signing claims stripped honestly; FR12.4 documented as Phase-2 with the stub retained. Remaining pmd work: **Batch C2-b** (append-only safety-floor merge mechanism + FIX-003 clinical consumer, decision #20 part b) and **Batch D** (honest E2E — dental-clinical top-bar has since landed, so it is now runnable).

---

# Addendum — Batch C2-b (append-only merge + FIX-003 consumer) + Batch D (honest E2E) — 2026-06-13

**Prompt:** `04-module-or-group-fix-tdd.md` (via `outputs/EXECUTION-TODO.md` Track 1 line 16-18 + Batch D) · **Branch:** `chore/workflow-verification-sweep` (NOT pushed) · **Superpowers:** Yes (test-driven-development, verification-before-completion). Driven by `outputs/product-decisions.md` **#20**. Commits: C2-b `0f871ef3`, Batch D `e4b86e59`, docs-close (this commit). **CLOSES the dental-pmd module.**

## Decision executed
**#20 part (b) — switch the safety-floor merge to append-only INSERT events + realize the FIX-003 clinical consumer, as ONE vertical slice.** `markSafetyFloorMerged` had 0 callers, so the imported safety data was clinically inert — an imported penicillin allergy never reached the clinical Safety Floor. Mechanism-only was forbidden; the merge mechanism ships WITH the consumer that surfaces the data.

## §15 — code-truth verification BEFORE coding (the fix-ready premise was partly stale)
1. **Two sides of the gap traced.** Merge side: `markSafetyFloorMerged` is a destructive boolean UPDATE on the `imported_pmd` row, 0 production callers; the append-only `imported_pmd_safety_floor_events` table existed (model landed C2-a `72954e12`) but had NO write path. Consumer side: the clinical Safety Floor (`getDentalPatientSafetyFloor` patient handler + `getSafetyFloorForPMD` clinical facade + the workspace top bar's `useMedicalHistory`) all read `medical_history_entry` rows — and NO handler ever inserted imported-PMD items there. Confirmed inert.
2. **Content shape — the decisive §15 finding.** Imported PMD `content` is a caller-supplied freeform string. The FE import preview (`pmd-import.tsx` extractPreview) ALREADY reads **top-level `{conditions,medications,allergies}` string arrays** (and the textarea placeholder documents exactly that), and the existing data-portability test fixtures use the same loose shape — NOT generatePMD's `.safetyFloor` entry-object shape. So the V1 canonical import shape is top-level string arrays; the backend extractor mirrors the FE preview EXACTLY so the previewed set == the merged set (avoids the summary-vs-body coherence bug class). `.safetyFloor` entry-object round-trip (our-export shape) is a documented roadmap deferral.
3. **BR-022 reconciled, not violated.** Documented BR-022 = "imported PMD row read-only, never merged." The merge never mutates the imported PMD; it copies its safety items **forward** into med-history as NEW append-only rows. Reconciled the one stale doc line (`DOMAIN_MODEL.md` "never merged") to this truth.
4. **No existing merge op** in `dental-pmd.tsp` → new op + full regen chain (confirmed before coding).

## What shipped — C2-b (`0f871ef3`)
| Layer | Change |
| --- | --- |
| TypeSpec | new `mergeImportedPMDSafetyFloor` op (POST `/dental/pmd/imported/{id}/merge-safety-floor`) + `MergeImportedPMDSafetyFloorResult` model; full regen (routes/validators/SDK). |
| Backend handler | `mergeImportedPMDSafetyFloor.ts`: branch-role gated (mirrors importPMD: dentist_owner/associate/staff_full); idempotent via the `safetyFloorMerged` flag (fast 409) + the `imported_pmd_safety_floor_events` unique index as the durable race backstop (23505 → 409 `SAFETY_FLOOR_ALREADY_MERGED`); PHI-audited (`pmd.safety_floor.merged`). Med-history inserted FIRST (data always lands; a rare dup under a concurrent merge beats a lost allergy). Content extraction mirrors the FE preview exactly. |
| Facade | `clinical-pmd.facade.ts` `insertImportedSafetyFloorEntries` — append-only med-history insert (BR-022 boundary; the cross-module write seam dental-pmd→dental-clinical). |
| Repo | `imported-pmd.repo.ts` `recordSafetyFloorMergeEvent` — append-only event insert. |
| FE | `pmd-import.tsx` confirm now imports AND merges, then invalidates the medical-history query key (same key the top bar reads) so the "Safety Floor updated" claim is live + true; honest partial-failure copy if merge fails. |

## What shipped — Batch D (`e4b86e59`)
**J20** (`tests/e2e/journeys/20-pmd-import-merge.journey.spec.ts`) — the honest replacement for the API-only `pmd-import.spec.ts` false-green. Drives the REAL rendered workspace UI (top-bar PMD button → viewer sheet → import form → preview → confirm) on Maria Santos (P1, active visit so the PMD UI mounts), then proves via an INDEPENDENT safety-floor read that a unique imported allergen surfaced. Mutation-proven non-vacuous: skipping the merge call → J20 RED. **Scoping decision:** the complete-visit→auto-generate→viewer UI journey was NOT added — the generation trigger is already backend-pinned (Batch A `pmd-generation-trigger.test.ts` 2/0) and the top-bar+viewer open path is covered by J20; a UI generation journey would require a destructive seed mutation (completing a load-bearing active visit, gated by completion rules) for marginal coverage → deliberately deferred. The old API-only `pmd-import.spec.ts`/`pmd-generation.spec.ts` remain as contract-shape coverage (still green).

## 3-lens adversarial (product code → mutation-tested, not self-review)
- **Lens 1 (correctness/security):** authz mirrors importPMD; dual-guard idempotency; XSS-safe (Drizzle params + React escaping). No blockers/majors.
- **Lens 2 (coherence/cross-module):** previewed set == merged set (identical extraction logic); boundary-legal facade write; "done" claim now honest + live (cache invalidation).
- **Lens 3 (test honesty):** 2 backend mutations caught (facade insert no-op → 3 RED; flag-flip removed → no-double-insert RED) + 1 E2E mutation caught (skip merge → J20 RED). Non-vacuous.

## Gate
| Command | Result |
| --- | --- |
| backend `importPMD.safety-floor-merge.test.ts` | 6 / 0 (+ 2 mutations RED) |
| backend `medical-history` 12/0 + `pmd-document` 18/0 + `dental-pmd.test` 45/0 + trigger 2/0 (each own clone, no regress) | green |
| **pmd hurl contract** (fresh :7213) | **31 / 31** (+4 merge scenarios: merge 200 / floor-surfaces / re-merge 409 / auth 401) |
| FE `pmd-import.test.ts` | 6 / 0 (+ merge-on-confirm) |
| **E2E J20** (`--project=journeys`, live) | PASS 8.6s (+ mutation RED) |
| root typecheck (FE + api-ts) | 0 |
| eslint (changed src) | 0 errors |

## Completion decision
`COMPLETE` (Batch C2-b + Batch D). **dental-pmd module fully closed** (A trigger / B snapshot / C1 unique-index / C2-a orphan-reconcile / C2-b merge+consumer / D honest E2E / E sign-strip). **Roadmap:** `.safetyFloor` entry-object round-trip extraction (import-our-own-export); content length cap; transactional atomicity for the merge (deferred — openTestTx incompatibility, med-history-first ordering chosen so data always lands); the complete-visit→generate UI journey (low marginal value over the backend pin).
