# AHA Execution Tracker (post-decision)

**Created:** 2026-06-12 · **Branch:** `chore/workflow-verification-sweep` · **Source:** [`product-decisions.md`](./product-decisions.md) §6 + [`consolidated-remediation-roadmap.md`](./consolidated-remediation-roadmap.md) §7/§8 · **Protocol:** Vertical TDD (tests-first, vertical slices) per `docs/development/VERTICAL_TDD.md`.

Check items off as completed. Tracks 1 & 2 are **decision-free and parallelizable now**. Track 3 is unblocked by the 2026-06-12 product-decision session. Track 4 routes to future specialized prompts (not 04).

---

## Track 0 — Pre-flight confirmations (before their dependent items)
- [x] **0069 populated-DB exposure = NONE** (verified 2026-06-12, high confidence). Investigated runner mechanics + write-path history + release records: the importPMD write-path was structurally callable 27 days before 0069 (rows *could* be created without `source_description`), BUT every environment is always-fresh (VERSION `0.2.0.0` pre-release, "release" workflow cuts GitHub releases only, all DBs created via `db:reset`/`seed-demo` post-migration) — no persistent DB ever carried a row across the 0069 boundary. Audit's own roadmap had this `[NEEDS CONFIRMATION]`; confirmed. **Decisive mechanic:** the migrator (`drizzle-orm/node-postgres` `migrate()` in `core/database.ts`) is single-transaction + journal-watermark-gated → a forward-only migration CANNOT rescue a DB blocked at 0069 (chain halts there); editing 0069 in place is the only real fix and is safe (never re-runs on a DB past 0069). Authored the corrective migration regardless (see Track 1 last item).
- [ ] Confirm exact **session-TTL** value for ADR-007 (~15–30 min idle) before the data-gov/org session work.

## Track 1 — Decision-free P1 slice (START HERE, parallel)
- [x] **dental-scheduling** — `listAppointments` + `appointment-patient.facade` add `isNull(deletedAt)` filter (soft-archived calendar leak). RED: archive appointment → absent from GET list/detail. (schema fix #3) — DONE 2026-06-12: both facade reads filter `isNull(deletedAt)`; 2 RED→GREEN tests; 219 scheduling + 75 retention pass; both typechecks clean. Backend-only (no HTTP archive trigger → no Hurl; FE trusts backend → no FE/E2E; wire shape + SDK unchanged).
- [x] **dental-pmd Batch B** — extend snapshot to safety-floor + demographics (narrowed set per decision #6); attestor = visit's **treating dentist** (decision #5). RED: snapshot includes floor+demographics; checksum stable. — DONE 2026-06-12: snapshot now carries `safetyFloor` (active allergies/meds/conditions, ordered for determinism) + narrowed `demographics` (name/DOB/sex); `authorMemberId` bound to `visit.dentistMemberId`; new `getSafetyFloorForPMD` facade; 4 RED→GREEN tests; 504 pmd+visit pass; both typechecks clean; MODULE_SPEC §7.1 reconciled to narrowed V1 truth. Wire shape (content:string) + SDK unchanged.
- [~] **dental-pmd Batch C** — partial `unique(visit_id) WHERE generated` + upsert/FOR UPDATE (race); add-only safety-floor merge; **finish mig-0063** (add Drizzle model `imported_pmd_safety_floor_events` + switch merge to append-only INSERT events, decision #20). RED: concurrent double-completion → exactly one generated PMD. (schema fix #4)
  - [x] **C1** DONE 2026-06-12: partial unique index `pmd_document_visit_generated_unique` on `(visit_id,status) WHERE status='generated'` (mig 0102) + `generatePmdForVisit` catches the 23505 race and resolves idempotently (returns the winner). RED concurrent-double-completion 2→1; 2 new tests; full suite 3766 pass / 0 regress (1 pre-existing unmergePatients). Reverted transactional supersede — incompatible with openTestTx (nested db.transaction COMMITs the outer test tx); index + handler catch suffice.
  - [~] **C2** — split 2026-06-12. (a) **orphan-table reconcile DONE** with the 0069 migration-safety slice (commit `72954e12`): added the Drizzle model `imported_pmd_safety_floor_events` (exact 0063 shape, explicit FK name) + idempotent reconcile migration `0103_fat_miek.sql` (`CREATE TABLE IF NOT EXISTS` / FK `DO`-guard / `CREATE UNIQUE INDEX IF NOT EXISTS` — no-op on every DB that ran 0063). Snapshot now tracks the table; db:generate is consistent; 0103 idempotency pinned in `imported-pmd-0069-migration-safety.test.ts`. (b) **append-only MERGE MECHANISM + FIX-003 consumer still DEFERRED** (decision #20): mechanism-only leaves `markSafetyFloorMerged` at 0 callers, so do the append-only INSERT-event merge **with** its FIX-003 clinical consumer as one slice.
- [x] **data-governance Batch C** — retention read API (FR8.14) + erasure/legal-hold TypeSpec role fix `["user"]→["admin"]` (own TypeSpec→regen). Contract pins: GET retention status 200 admin / 403 non-admin. (schema fix #5, cross-cutting fix #4) — DONE 2026-06-12.
  - [x] **retention read API (FR8.14)** DONE 2026-06-12: new `dental-retention.tsp` (`getRetentionStatus` GET `/dental/retention-status`, admin, tag `Retention`→`handlers/retention/`) wrapping existing `summarizeRetentionEnforcement`; handler + 4 RED→GREEN tests (401/403/200 never-run/200 enforced); SDK regen; **contract 6/6** (admin 200 / non-admin 403 verified end-to-end through generated `authMiddleware({roles:["admin"]})`); api-ts+root typecheck 0. Commit `a1fc138c`.
  - [x] **erasure/legal-hold role fix** DONE 2026-06-12: flipped 8 ops `#["user"]→#["admin"]` (5 erasure + 3 legal-hold; module docstrings already said "Admin-only"). All handlers already enforce admin → contract-correctness + middleware defense-in-depth, no behavior change. Regen: 8 routes now `roles:["admin"]`. Backend 49/0; **contracts erasure 33/33 + legal-hold 21/21** (admin gate now at middleware, zero regression); typecheck 0.
- [x] **0069 corrective migration + migration-safety test** — DONE 2026-06-12 (commit `72954e12`). Per the Track-0 mechanic, edited 0069 **in place** to the safe 3-step (add nullable → backfill `'Imported before provenance tracking'` → `SET NOT NULL`); end-state + snapshot unchanged. Added `imported-pmd-0069-migration-safety.test.ts` (applies the real 0069 SQL to a populated pre-0069 fixture in a throwaway schema: RED on the old single-statement form → GREEN on the rewrite; + NOT NULL invariant pin). Added the missing `ADD COLUMN ... NOT NULL` (no DEFAULT) rule to `scripts/lint-migrations.ts` (the exact gap that let 0069 ship; only-match before fix, satisfied after; already gated in `quality.yml`). **Gate:** migration-safety 3/3 + dental-pmd 122/0; full chain `0000→0103` rebuilds clean; real server boot applied 0103 on dev `monobase` 0102→0103; `lint:migrations` 104/0; api-ts + root typecheck clean; eslint clean. **Closes Track 1.**

## Track 2 — Decision-free module Batch B/C passes (parallel; roadmap §8 orders 8–18)
- [ ] **dental-visit Batch B** — carry-over FE affordance + returning-patient E2E. (canonical endpoint decided 2026-06-10)
- [ ] **dental-clinical B/C/D/E/F** — consent revoke+history (P1); Rx list+dispense/cancel (P1); amendments-visibility FR1.16 (P2); consent-template picker FIX-009 (consume dental-org, do NOT rebuild backend); lab-status enum + attachment-size doc reconcile.
- [ ] **dental-billing B/C** — discount + void affordances; payment-plan create dialog + flag-sync pin. *(payment session-derived `recordedByMemberId` per #8 is a SEPARATE handler-trust fix — do NOT slip into Batch B.)*
- [ ] **dental-patient Batch C** — comms-consent error surface, safety-floor equality pin, unmerge 500→501, plan-total validation. + FIX-004 alert equality pin (decision-neutral).
- [ ] **dental-audit** — finish Batch A **FIX-002** (journey-10 void→viewer E2E) + Batch B/C docs + divergence canary.
- [ ] **notifications** — backfill Batch-A inbox E2E + Batch B push opt-in + Batch C pins/hygiene.
- [ ] **case-presentation Batch A** — journey-19 present→sign→accept pin (+ reject leg) + Batch C MODULE_SPEC.
- [ ] **dental-imaging Batch B** — delete/reclassify UI; audit-row pins; seed breadth; boundary doc.
- [ ] **dental-perio Batch B/C** — traceability/doc alignment + iPad spec re-enable in CI matrix (P3 only).
- [ ] **data-governance Batch B** — enforced-mode retention proof (dryRun:false through real RETENTION_TARGETS facades).

## Track 3 — Newly-unblocked decision-gated batches (this session)
- [ ] **data-governance Batch E** (#1, C-4) — governance admin UI + E2E. Erasure = clinic `dentist_owner` initiates → platform-admin approves; list/get/approve tenant-scoped via FIX-001 facade; **patients-only** subjects (reject person-only).
- [ ] **dental-clinical attachment erasure** (#7) — erasure facade + target: null filename/note + S3 delete. RED: erase patient w/ attachment → note nulled + S3 object deleted. (schema fix #2)
- [ ] **dental-pmd Batch E** (#4) — strip non-repudiation/checksum-sealed language; leave signature absent; document signing Phase-2.
- [ ] **dental-org Batch C** (#9) + **provisional-org PHI gate** (C-1) — owner-reset-only PIN recovery; restrict `status=provisional` orgs from PHI writes until activated.
- [ ] **dental-visit GAP-2 build** (#13, ⚠ scope expansion) — treatment-template create/apply UI; **keep** the seed.
- [ ] **dental-patient contact-edit build** (#14, ⚠ scope expansion) — expose `contactInfo` on getDentalPatient, editable + **audited**. **MUST** add contactInfo to the JSONB-recursive logger redaction (Track 4) — load-bearing.
- [ ] **dental-clinical GAP-5** (#11) — allergy blocking-with-override FE confirm-dialog (backend unchanged).
- [ ] **dental-audit auditor-role + sink** (#17/#18) — resolve ROLE_PERMISSION_MATRIX to owner-only; add append-only trigger + land FIX-004 divergence-canary baseline; surface base-module PHI-reads in the dental viewer (single pane). Defer 3→1 sink merge to V2.
- [ ] **Doc-alignment / park passes** — #2 perio+imaging no-AI doc reconcile (MODULE_SPEC↔STANDARDS_COMPLIANCE; FakeDetector=manual fixture only); #6 PMD PRD/spec reconcile (narrowed snapshot = V1 truth); #3 claims Phase-2 label + disable FE create-path; #10 multi-branch Phase-2 doc; #12 occlusion/post-op/inventory park+document [DO NOT OVERBUILD]; #16 households park-writes doc; #19 superimposition preview-only + CBCT out-of-V1 doc; C-2 member_status doc-reserve 'revoked'; C-3 ADR-007 session-TTL.

## Track 4 — Platform fixes (future specialized prompts, NOT 04)
- [ ] **buildTestApp** validator-mounting harness + raw-handler lint guard — RED a known drift (BUG-IMG-001 / consent-template) under the new helper first, then migrate incrementally (Hurl stays backstop).
- [ ] **core/logger.ts** JSONB-recursive redaction + lint guard — 3-deep regression tests; **now load-bearing for #14 contactInfo**.
- [ ] Flip **contract.yml** Hurl + Schemathesis to blocking — after clearing the 8 env-dep failures (MinIO/Mailpit/Stripe).

## Standing gotchas (carry into every batch)
- **§15 caveat:** verify SDK type vs handler shape (and contract vs handler) **BEFORE** wiring; treat any fix-ready "backend ready" as unverified.
- **Vertical TDD mandatory:** RED → GREEN → refactor; one module fully end-to-end before the next; gate = backend unit + contract + FE unit + E2E all pass.
- dev DB password = `password`. Backend per-file tests: `cd services/api-ts && DATABASE_URL=postgres://postgres:postgres@localhost:5432/monobase_test bun scripts/test-with-db.ts <file>`.
- Root `bun run typecheck` covers both workspaces; also run api-ts `bunx tsc` directly.
- **Never** run server/contract/E2E against `monobase_test` (pollutes the template); `db:generate` only from `services/api-ts` cwd.
- TypeSpec change → regen routes/validators → SDK regen is a **separate** step.
- Restart the :7213 server before `test:contract` (stale server masks drift).
