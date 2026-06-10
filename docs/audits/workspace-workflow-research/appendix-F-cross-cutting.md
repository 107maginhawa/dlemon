# Appendix F — Cross-cutting concerns (audit · RBAC/branch-scope/multi-tenant · offline P2P sync · retention/legal-hold)

**Chunk:** F (cross-cutting, spans all workspace chunks) · **Lens emphasis:** Security/Sync/Audit applied workspace-wide.
**Researcher scope:** systemic gaps, not per-sheet features. Read-only; no code written.
**Sources of truth consumed:** `docs/product/modules/{dental-audit,retention,legal-hold}/MODULE_SPEC.md`; `docs/audits/MASTER-GAP-MATRIX.md` (Batches 1–4 IMPLEMENTED 2026-06-09); `docs/audits/SWEEP_optional-branchid_2026-06-08.md`; `docs/audits/module-gap-plans/{dental-audit,retention,dental-legalhold}-gap-plan.md`; `docs/decisions/ADR-004-idempotency.md`, `ADR-005-audit-write-path.md`; `.understand-anything/contract-spine.json` (357 ops, 135 FE-consumer files; type-import edges stale per MASTER-GAP-MATRIX, trusted only for FE→BE wiring + consumer counts).

> **Rigor note.** Every row carries exactly one `[ASSUMPTION]` OR a `file:line`/doc-id citation. Negative claims ("0 FE consumers", "no idempotency key", "no consumer of conflictPayload") were verified by grep + contract-spine, not memory. KNOWN rows cite a MASTER-GAP-MATRIX / module-gap-plan id; NEW rows were grep-confirmed absent. Proposed rules use the `BR-####` placeholder prefix only.

---

## (2) Per-family sequencing analysis + ordering-gap list

Four cross-cutting "families" cut across every workspace chunk. For each: the ordered sequence (pre/postconditions), then where the *ordering itself* breaks.

### F-A. Audit-trail ordering & integrity

**Sequence (per audited mutation):**
```
1. handler validates input + RBAC (assertBranchRole / assertBranchAccess)         [pre: authenticated user]
2. handler performs the domain mutation via repo (db write COMMITS here)
3. handler calls logAuditEvent(db, logger, event, {failClosed?})                   [AFTER step 2, OUTSIDE any tx]
   3a. sanitize metadata + before/after (recursive PHI strip — audit-logger.ts:144-152)
   3b. INSERT into dental_audit_log (authoritative; timestamp = defaultNow())       [audit-log.schema.ts:17]
       - on failure: if (isSecurityEvent || opts.failClosed) RETHROW → 5xx;         [audit-logger.ts:161-193]
         else swallow (logger.error) — fire-and-forget
   3c. INSERT into legacy dental_audit (errors always swallowed)
4. viewer GET /dental/audit-events → orderBy desc(timestamp), offset paginated      [audit-log.repo.ts:73]
```
**Postcondition (intended):** every sensitive mutation has exactly one append-only `dental_audit_log` row; viewer renders them newest-first by occurrence order.

**Ordering gaps:**
- **OG-A1 — Audit timestamp = server-INSERT time, not event-OCCURRENCE time (offline reorder).** `dental_audit_log.timestamp` is `defaultNow()` set at insert (`audit-log.schema.ts:17`); the viewer orders `desc(timestamp)` (`audit-log.repo.ts:73`). For an **offline-first** action performed on-device and synced later (cadence), the audit row's timestamp reflects when the *server* recorded it, so a clinically-earlier action that syncs *after* a later one will sort *above* it — the compliance trail mis-orders the true sequence of clinical events. No `occurredAt`/client-clock column exists (grep: only `timestamp` on the schema). **NEW (sync-amplified).** [verified: audit-log.schema.ts:17, audit-log.repo.ts:73; no occurredAt column]
- **OG-A2 — Audit write is post-commit, not in-tx (residual after P1-C fix).** Step 2 commits, then step 3 runs. `failClosed:true` (Batch 2, MASTER-GAP-MATRIX §9) makes money/clinical audit failures surface a 5xx, but the mutation has *already committed* — so a fail-closed audit failure yields "row persists, caller sees 5xx, no audit row." MASTER-GAP-MATRIX §9 documents this as the accepted weaker guarantee vs full rollback. **KNOWN (dental-audit P1-C, FIXED-with-residual).**
- **OG-A3 — Audit fan-in is manual per-handler (no audit-on-write middleware).** ~70 handlers import `logAuditEvent` by hand (dental-audit-gap-plan.md "Writer fan-in"). Coverage = "as good as each author remembered" → newly-added mutations can ship unaudited. **KNOWN (dental-audit P1-B class, partially FIXED).**

### F-B. RBAC / branch-scope / multi-tenant invariants

**Sequence (per read/write):**
```
1. resolve branch: either branchId REQUIRED (400 if absent) OR DERIVED from a path resource
   (patient.preferredBranchId / visit.branchId / study→branch)                     [SWEEP §"three SAFE patterns"]
2. assert: assertBranchAccess (membership) OR assertBranchRole (membership+role)    [shared/assert-branch-*.ts]
   - assertPatientBranchAccess: branchless patient → 403 (never free-for-all, V-PAT-002)  [assert-branch-access.ts:48-57]
3. repo hard-filters eq(branchId) / inArray(callerBranches); empty scope → 0 rows, never all-tenant
```
**Invariant:** a caller never reads/writes outside their active membership's branch(es); an *optional* branch filter, when omitted, defaults to the caller's accessible set — never "unfiltered = all tenants" (the EM-BIL-002 lesson).

**Ordering / scope gaps:**
- **OG-B1 — Optional-branch-omission leak class is CLOSED for the 8 clinical modules + billing, but UN-swept for the governance/cross-resource modules.** `SWEEP_optional-branchid_2026-06-08.md` proved 45/45 endpoints SAFE across the 8 clinical modules; billing's 5 report endpoints were the lone hole (EM-BIL-002, fixed `825bffbb`). The sweep's own carry-forward (§"Carry-forward") flags **dental-portal, emr-consultation, provider, external-records-import** as still-unswept for the same "cross-resource aggregate with optional-only scope" pattern. **KNOWN-PARTIAL (SWEEP carry-forward).**
- **OG-B2 — Governance modules are intentionally cross-tenant (legal-hold/erasure/retention) — admin is a platform superuser.** `dental-legalhold` MODULE_SPEC §6 + gap-plan §3 confirm `admin` places/lists/releases holds across tenants by design (DPO model, IDEAL §342). `dental-erasure` ER-P1-1 (MASTER-GAP-MATRIX) is the *un-intended* variant: `tenantId` taken from request body unchecked, `listErasureRequests` returns all tenants' PII. **KNOWN (legal-hold by-design `[NC]` #18; erasure ER-P1-1 P1 `[NC]` #17).**

### F-C. Offline-first / P2P sync (cadence + localId/GAP-001 + chart LWW merge)

**Sequence (offline create → reconnect → server merge):**
```
1. device generates stable localId offline; entity born syncStatus='pending'        [database.schema.ts:35-39]
2. on reconnect, client POSTs the create with localId
3. server create persists + echoes localId; row born syncStatus='synced'            [GAP-001: visit/chart/treatment/invoice]
4. chart writes: upsertDentalChart → repo.upsert (keyed on VISIT, full-teeth replace,
   baseline-protect CHART-BR-002) → baselineRepo.mergeVisitChart (LWW per tooth)     [upsertDentalChart.ts:43-55]
5. sync-log FSM tracks per-record status; updateSyncLog does optimistic-lock 409
   on version mismatch, returning conflictPayload in the RESPONSE                     [updateSyncLog.ts:36-42]
6. cadence (Rust, Tauri-embedded) merges field-changes Lamport-LWW, peer_id tiebreak [cadence/src/merge/lww.rs]
```

**Ordering / idempotency / conflict gaps:**
- **OG-C1 — localId is persisted + echoed but NOT an idempotency key (retried offline create → duplicate row).** `syncableEntityFields.localId` (`database.schema.ts:38`) has **no unique constraint** (grep: only a non-unique index on the sync-LOG table, `sync-log.schema.ts:27`). `GAP-001` tests assert "stores localId" but never "POST twice with same localId → one row" (`gap-001-localid.test.ts` — no idempotency assertion). So a client that retries a create after a dropped ACK creates a duplicate visit/chart/treatment/invoice. Compounds ADR-004 Tier-2 (payments have no duplicate guard). **NEW.** [verified: no unique(localId); test has no dedup case]
- **OG-C2 — Per-tooth chart merge is "incoming-wins" with NO clock — concurrent two-device edits silently clobber.** `DentalChartBaselineRepository.mergeTeeth` (`dental-chart-baseline.repo.ts:57-71`) and `DentalChartRepository.upsert` (`dental-chart.repo.ts:59-69`) resolve per-tooth conflicts by *last writer in array order wins* (no Lamport/timestamp/vector-clock), except baseline `existing`/`existing_other` are protected (CHART-BR-002). Two devices each editing different teeth in the same visit, syncing full-teeth arrays, will have the second sync's array replace teeth the first added (the upsert merges by toothNumber but a stale full-array from device B drops device A's just-added tooth not present in B's snapshot). The server-side merge does NOT use the cadence Lamport LWW (`cadence/src/merge/lww.rs` is a *separate* Rust transport-layer merge, not invoked by the TS handler). **NEW.** [verified: mergeTeeth has no clock field; upsertDentalChart calls TS repo, not cadence]
- **OG-C3 — conflictPayload JSONB column on syncable entities is write-nothing/read-nothing.** `syncableEntityFields.conflictPayload` (`database.schema.ts:41`) is referenced only by `updateSyncLog.ts` (which builds a `conflictPayload` *in the 409 response body*, NOT persisting it to the column) and its test. Grep confirms **no handler/FE ever writes or reads the entity-level `conflict_payload` column** → there is no durable conflict record or conflict-resolution UI for a real data conflict. **NEW.** [verified: grep conflictPayload non-generated = updateSyncLog.ts + its test only; column never written]
- **OG-C4 — The entire offline sync-log write path has no FE/product driver.** Contract-spine: `createSyncLog` 0 FE consumers, `updateSyncLog` 0, `carryOverTreatments` 0; only `listSyncLogs` has 1 (`use-sync-status.ts`). cadence's `SyncEngine`/`SqliteBackend` init/start is a documented stub (CLAUDE.md "Known In-Progress Areas"; `apps/account/src-tauri/src/sync.rs`). So the offline-first machinery is built + tested backend-side but **not actually exercised end-to-end** — meaning OG-C1/C2/C3 are latent today but become live the moment cadence is activated. **KNOWN-CONTEXT (CLAUDE.md stub note) + NEW (sync-log write path unwired).**

### F-D. Retention + legal-hold interactions with workspace data

**Sequence (nightly cron):**
```
1. registerRetentionJobs schedules retention.enforcement @ 03:30 daily              [retention MODULE_SPEC §3 WF-RET-002]
2. for each enabled policy: skip disabled / refuse retain+protected (audit) / skip no-target
3. compute cutoff = now − retentionPeriodDays
4. exclude legally-held subjects: personsUnderLegalHold filters status='active' ONLY [legal-hold.facade.ts:19,30]
5. dry-run (default) OR soft-archive (delete→archive downgrade, never hard-delete)  [retention MODULE_SPEC §5]
6. write a compliance audit event (retention.dry_run / .enforced / .protected_skip)
```
**Invariant:** an ACTIVE legal hold always excludes a subject; `delete` is always downgraded to `archive`; the audit trail is `protected` (never purged); enforcement is OFF (dry-run) unless `RETENTION_ENFORCEMENT_ENABLED=true`.

**Ordering / coverage gaps:**
- **OG-D1 — Legal-hold placed AFTER a retention run that already archived the subject's data is not reversed.** The hold excludes future runs (correct), but there is no compensating "un-archive on late hold" — if data was archived on night N and a hold is placed on night N+1, the archived rows stay archived. Soft-archive (not hard-delete) means data is recoverable, but no workflow surfaces or reverses it. **NEW (ordering).** [ASSUMPTION: no un-archive path — grep found no reverse-archive handler; soft-archive recoverability is per retention MODULE_SPEC §5.3]
- **OG-D2 — clinical / visit / prescription retention targets are declared but unenforceable (no facade target).** `SUPPORTED_RETENTION_ENTITY_TYPES` wires only `attachment`, `appointment`, `audit`(protected); `clinical`/`visit`/`prescription` are seeded `enabled:false` (retention MODULE_SPEC §7; retention-gap-plan G3). So the workspace's core clinical records are advertised-retained but never archived. **KNOWN (retention G3, P2 `[NC]` #19).**
- **OG-D3 — No live (enforcement-ON) end-to-end test of cron→engine→real-facade→DB archive + held-row-untouched.** retention-gap-plan G4 (P2): engine tested with injected targets; the real `dryRun:false` registry path is unproven as one chain. **KNOWN (retention G4, P2).**

---

## (3) Cross-cutting gap & candidate register

Schema: `| id | finding | chunk | IMPLEMENTED/KNOWN/NEW | lenses{S,R,O,C} | KG-node | MODULE/WF-id | BR-id | spine-op/handler | severity | blast-radius |`
Lenses: **S**=sequencing, **R**=RBAC/multi-tenant, **O**=offline P2P sync, **C**=clinical-correctness.

| id | finding | chunk | status | lenses | KG-node | MODULE / WF | BR-id | spine-op / handler | sev | blast-radius |
|---|---|---|---|---|---|---|---|---|---|---|
| F-IMP-01 | Append-only audit enforced (DB trigger + HTTP 405) | F | IMPLEMENTED | R,S | domain:audit | dental-audit / WF-028 | AC-AUD-002 | getAuditEvents / `0080_audit_log_append_only.sql` | — | cross-tenant |
| F-IMP-02 | Audit viewer owner-only + branchId-required + cross-tenant 403 | F | IMPLEMENTED | R | domain:audit | dental-audit / WF-028 | AC-AUD-003 / EM-AUD-002 | getAuditEvents.ts | — | PHI-leak |
| F-IMP-03 | Recursive PHI sanitizer at insert choke point (metadata + before/after) | F | IMPLEMENTED | C,R | domain:audit | dental-audit | V-AUD-101 / AC-AUD-004 | AuditLogRepository.insert | — | PHI-leak |
| F-IMP-04 | Fail-closed audit on money/clinical mutations (per-call opt) | F | IMPLEMENTED | S,R | domain:audit | dental-audit | dental-audit P1-C | audit-logger.ts:161-193 | — | money |
| F-IMP-05 | assertBranchAccess / assertBranchRole / assertPatientBranchAccess (branchless→403) | F | IMPLEMENTED | R | domain:dental-org | dental-org | V-PAT-002 | shared/assert-branch-*.ts | — | cross-tenant |
| F-IMP-06 | Optional-branch-omission leak swept clean for 8 clinical modules (45/45 SAFE) | F | IMPLEMENTED | R | domain:dental-org | (sweep) | EM-BIL-002 | SWEEP doc | — | cross-tenant |
| F-IMP-07 | localId persisted + echoed on create (visit/chart/treatment/invoice) | F | IMPLEMENTED | O | domain:dental-visit | dental-visit / GAP-001 | GAP-001 | upsertDentalChart / createDentalVisit | — | data-loss |
| F-IMP-08 | Chart baseline LWW merge with CHART-BR-002 baseline protection | F | IMPLEMENTED | O,C | domain:dental-visit | dental-visit | CHART-BR-002 | upsertDentalChart.ts:55 | — | data-loss |
| F-IMP-09 | sync-log optimistic-lock 409 + FSM (synced terminal) | F | IMPLEMENTED | O,S | domain:dental-patient | dental-patient | LF-BR-004 | updateSyncLog.ts:36 | — | data-loss |
| F-IMP-10 | Retention engine: dry-run default, delete→archive, protected-skip, fully audited | F | IMPLEMENTED | S,C | domain:data-governance | retention / WF-RET-003 | AC-RET-001/002/003 | retention-engine.ts | — | data-loss |
| F-IMP-11 | Legal-hold (status='active') excludes subject from retention + blocks erasure | F | IMPLEMENTED | R,C | domain:data-governance | legal-hold / WF-LH-004 | AC-LH-005 | legal-hold.facade.ts:19,30 | — | data-loss |
| F-IMP-12 | sync-log cross-tenant isolation (P0) FIXED — branchId required + scoped findAll | F | IMPLEMENTED | R,O | domain:dental-patient | dental-patient / G1 | (G1) | listSyncLogs / sync-log.repo.ts | — | cross-tenant |
| **F-G01** | **Audit timestamp = server-insert time, not occurrence time → offline-synced events mis-order the compliance trail** | F | **NEW** | S,O | domain:audit | dental-audit / WF-028 | proposed **BR-####** (audit rows MUST carry a client `occurredAt`; viewer orders by it) | getAuditEvents / audit-log.schema.ts:17 | **P2** | cosmetic→correctness |
| **F-G02** | **localId is not an idempotency key — retried offline create → duplicate row (no unique constraint, no dedup test)** | F | **NEW** | O,S | domain:dental-visit | dental-visit / GAP-001 | proposed **BR-####** (a create with a previously-seen localId MUST return the existing row, not a duplicate) | createDentalVisit/Treatment/Invoice/upsertDentalChart | **P1** | data-loss |
| **F-G03** | **Per-tooth chart merge is incoming-wins with no clock → concurrent two-device edits clobber (TS handler does NOT use cadence Lamport LWW)** | F | **NEW** | O,C | domain:dental-visit | dental-visit | proposed **BR-####** (per-tooth merge MUST be last-write-wins by a monotonic clock, not array order) | upsertDentalChart / dental-chart-baseline.repo.ts:57 | **P1** | data-loss |
| **F-G04** | **conflictPayload entity column is never written or read — no durable conflict record / no conflict-resolution UI** | F | **NEW** | O | domain:dental-patient | dental-patient | proposed **BR-####** (a detected sync conflict MUST persist conflictPayload for operator review) | (none — column orphan) | P2 | data-loss |
| **F-G05** | **Offline sync-log write path unwired (createSyncLog/updateSyncLog 0 FE consumers; cadence init stubbed) → C1–C3 latent until activation** | F | **NEW** | O | domain:dental-patient | dental-patient | — | createSyncLog/updateSyncLog (0 consumers) | P2 | data-loss |
| F-G06 | Optional-branch-omission variant un-swept for portal / emr / provider / external-import (cross-resource aggregates) | F | KNOWN | R | domain:dental-org | (sweep carry-forward) | EM-BIL-002 | (per-module) | P1 | cross-tenant |
| F-G07 | Erasure: tenantId from body unchecked; listErasureRequests returns all tenants' PII | F | KNOWN | R | domain:data-governance | dental-erasure / ER-P1-1 | ER-P1-1 | listErasureRequests | P1 `[NC]` | PHI-leak |
| F-G08 | Audit fan-in manual per-handler (no audit-on-write middleware) → new mutations can ship unaudited | F | KNOWN | S | domain:audit | dental-audit / P1-B | AUD-BR-001 | logAuditEvent (~70 callers) | P2 | cross-tenant |
| F-G09 | Audit write post-commit (residual after fail-closed) — mutation commits then 5xx, no row | F | KNOWN | S | domain:audit | dental-audit / P1-C | dental-audit P1-C | audit-logger.ts | P2 (accepted) | money |
| F-G10 | 3 audit sinks (dental_audit_log / legacy dental_audit / base audit_log_entries) — base PHI-access reads invisible to viewer | F | KNOWN | R,S | domain:audit | dental-audit / P2-B | — | (3 repos) | P2 | PHI-leak |
| F-G11 | retention clinical/visit/prescription targets declared but unenforceable (no facade) | F | KNOWN | C | domain:data-governance | retention / G3 | — | retention-targets.ts | P2 `[NC]` | data-loss |
| F-G12 | No live enforcement-ON E2E (cron→engine→real-facade→DB archive + held-row untouched) | F | KNOWN | S,C | domain:data-governance | retention / G4 | AC-RET-002/004 | retention-engine.ts | P2 | data-loss |
| **F-G13** | **Legal hold placed AFTER a retention run that archived the subject is not reversed (no un-archive path)** | F | **NEW** | S,C | domain:data-governance | legal-hold / WF-LH-004 | proposed **BR-####** (placing a hold MUST surface/restore any rows archived within the hold's lookback) | (none) | P3 | data-loss |
| F-G14 | Legal-hold + erasure + retention governance UIs are raw-API-only (0 FE consumers) | F | KNOWN | R | domain:data-governance | legal-hold/retention/erasure | — | placeLegalHold/listLegalHolds (0) | P1 `[NC]` | cosmetic |
| F-G15 | Governance RBAC contract drift: TypeSpec `x-security-required-roles:#["user"]` vs handler-enforced `admin` | F | KNOWN | R | domain:data-governance | dental-legalhold | — | dental-legal-hold.tsp / dental-erasure.tsp | P2 | cosmetic |
| F-G16 | ADR-004 Tier-2 payment/discount/payment-plan endpoints have no idempotency guard (double-payment on retry) | F | KNOWN | O,S | domain:dental-billing | dental-billing | ADR-004 | recordDentalPayment / applyDentalDiscount | P1 | money |

---

## (4) KG + module + BR mapping notes

- **KG nodes used:** `domain:audit`, `domain:dental-org` (RBAC helpers), `domain:dental-visit` (chart/sync entities), `domain:dental-patient` (sync-log), `domain:data-governance` (retention/legal-hold/erasure). The `domain-graph.json` **under-models** the offline-sync edges (localId idempotency, chart LWW, conflictPayload) and the retention→legal-hold exclusion edge (retention-gap-plan G6, dental-legalhold-gap-plan §7). Treat sync + governance enforcement as KG-thin; the code (cited above) is authoritative.
- **Proposed BR-#### (one-line guard statements, business-rules.md style):**
  - F-G01: *"Every audit event MUST record a client-supplied `occurredAt`; the viewer orders by `occurredAt` (occurrence order), never by server-insert `timestamp`."*
  - F-G02: *"A create carrying a `localId` previously accepted for the same (tenant, entityType) MUST return the existing row (idempotent), not insert a duplicate."*
  - F-G03: *"Per-tooth chart merge MUST resolve concurrent edits by a monotonic clock (last-write-wins by timestamp/Lamport), not by incoming-array order; baseline `existing*` entries remain protected (CHART-BR-002)."*
  - F-G04: *"A detected sync conflict MUST persist `conflictPayload` on the affected row for operator review; conflicts MUST NOT be silently dropped."*
  - F-G13: *"Placing a legal hold MUST surface (and offer restore of) any of the subject's rows soft-archived within the hold's lookback window."*
- **Reuse-before-propose:** the cadence `lww_merge_field` (Lamport + peer_id tiebreak, `cadence/src/merge/lww.rs`) is the existing clock-aware merge primitive — F-G03's fix should mirror its semantics in the TS chart merge (or route chart writes through cadence) rather than invent a new scheme. The `withConnectionRetry` + `failClosed` pattern (audit-logger.ts) is the existing durability primitive for F-G01's viewer change. `getActiveBranchIdsForPerson` → `inArray` (the EM-BIL-002 fix) is the existing safe-default for F-G06.

---

## (5) TDD-ready slice specs (cross-cutting, value-ordered)

> Per `VERTICAL_TDD.md`. Backend tests run **from `services/api-ts/`** via `bun run scripts/test-with-db.ts <file>` with `DATABASE_URL=postgresql://postgres:password@localhost:5432/monobase_test` (per-file; never `bun test <path>`, never directory-arg). Contract `.hurl` via `scripts/run-contract-tests.ts` against `$API_URL` — **restart the API server first**. FE unit: DentalChart is globally stubbed (`apps/dentalemon/src/test-setup.ts`) → assert pure fns (`deriveChartLayerSets`/`resolveToothLayer`), never rendered-chart DOM; live chart assertions only in E2E. Gate each slice: api-ts `bunx tsc` (root `bun run typecheck` = FE only) + `bun run check:boundaries` + backend + contract + FE tsc/unit + E2E.

### SL-F01 — localId idempotency key for offline creates (F-G02) · **P1** · depends: none
**Why first:** highest data-loss risk; latent today, live the moment cadence activates; unblocks safe retry semantics for SL-F03/SL-F05.
**Skip rules:** backend-only (sync transport; FE just retries) → skip FE-unit; keep E2E (offline-replay sim).
**RED tests first:**
- backend `services/api-ts/src/handlers/dental-visit/gap-001-idempotency.test.ts` (new): POST create with `localId=X` → 201 row A; POST identical create with `localId=X` → 200/201 **same row id** (not a 2nd row). Cover visit, chart, treatment, invoice. RED today (current code inserts a duplicate). Binds **GAP-001**, proposed **BR-####** (F-G02).
- contract `specs/api/tests/contract/dental-visit.hurl` §new: create-with-localId twice → assert single resource (echo same `id`).
- E2E `apps/dentalemon/tests/e2e/offline-replay.spec.ts` (new, self-seeded via `tests/e2e/helpers/e2e-seed.ts`): simulate dropped-ACK replay → patient has one visit, not two.
**FSM/transition:** none. **Schema:** add `unique(tenant_id, local_id)` partial index (where `local_id is not null`) on syncable tables OR an upsert-on-localId in each create repo — spec-first if any TypeSpec body changes (none expected). **AC/BR:** GAP-001, BR-#### (F-G02).
**Gate:** backend idempotency 0-fail; contract green; E2E green; tsc/boundaries clean.

### SL-F02 — Clock-aware per-tooth chart merge (F-G03) · **P1** · depends: SL-F01 (idempotent writes first)
**Why:** concurrent multi-device chart edits silently clobber clinical data; reuse cadence LWW semantics.
**Skip rules:** chart logic is tested as **pure fns** (DentalChart stubbed) → FE-unit asserts `mergeTeeth` pure helper, NOT DOM; live chart only in E2E.
**RED tests first:**
- backend `services/api-ts/src/handlers/dental-visit/repos/dental-chart-merge-lww.test.ts` (new): device-A adds tooth 11 @ clock=1; device-B (stale full-array, clock=2, omits 11) syncs → 11 **survives** (B's later clock does not delete a tooth it never saw). Two edits to the SAME tooth → higher clock wins; equal clock → deterministic tiebreak (mirror `lww_merge_field` peer_id). RED today (`mergeTeeth` is incoming-wins by array order). Binds **CHART-BR-002**, proposed **BR-####** (F-G03).
- FE-unit `apps/dentalemon/src/features/workspace/lib/chart-merge.test.ts`: pure `mergeTeeth(local, incoming, clock)` cases (no rendered chart).
- E2E `apps/dentalemon/tests/e2e/chart-concurrent-edit.spec.ts` (new): two sessions edit different teeth → both persist after sync (live chart assertion allowed here).
**FSM/transition:** none. **Schema:** add a per-tooth `updatedAtClock`/`lamport` to `ToothChartState` (`dental-chart.schema.ts`) — spec-first (TypeSpec `UpsertDentalChartBody.teeth[]` gains an optional clock field) → regen validators/SDK → handler. **AC/BR:** CHART-BR-002 (preserved), BR-#### (F-G03). Property test à la `treatment.fsm.property.test.ts`: merge is commutative+idempotent under clock ordering.
**Gate:** backend merge 0-fail; FE pure-fn unit; E2E concurrent-edit; tsc/boundaries clean; contract (chart body shape) green.

### SL-F03 — Audit occurrence-time ordering (F-G01) · **P2** · depends: none (parallelizable with SL-F01)
**Why:** compliance trail mis-orders offline-synced events; cheap, high-trust.
**Skip rules:** backend + contract; FE audit viewer not yet built (P1-A) → no FE-unit/E2E in this slice (fold into the future viewer slice).
**RED tests first:**
- backend `services/api-ts/src/handlers/dental-audit/audit-occurrence-order.test.ts` (new): write event A with `occurredAt=T1` AFTER event B with `occurredAt=T2>T1` (B inserted first, late-arriving A) → viewer returns A before B (orders by `occurredAt`, not insert `timestamp`). RED today (orders by `desc(timestamp)`). Binds **AC-AUD-003**, proposed **BR-####** (F-G01).
- contract `specs/api/tests/contract/dental-audit.hurl` §new: GET ordered by occurredAt desc.
**FSM:** none. **Schema:** add nullable `occurred_at` to `dental_audit_log` (default = `timestamp` for legacy rows); `AuditEvent` gains optional `occurredAt`; viewer `orderBy(desc(occurred_at))` (`audit-log.repo.ts:73`). Spec-first if `getAuditEvents` response/order documented in TypeSpec. **AC/BR:** AC-AUD-003, BR-#### (F-G01).
**Gate:** backend order 0-fail; contract green; tsc/boundaries clean; append-only trigger unaffected.

### SL-F04 — Sweep optional-branch-omission for governance/cross-resource modules (F-G06) · **P1** · depends: none
**Why:** the EM-BIL-002 leak class is closed for clinical modules but un-swept for portal/emr/provider/external-import (the sweep's own carry-forward).
**Skip rules:** backend + contract only (security invariants); no FE.
**RED tests first:**
- backend `services/api-ts/src/handlers/{dental-portal,emr,provider,external-records-import}/branch-omission-isolation.test.ts` (one per module, new): for each list/report whose tenant/branch filter is OPTIONAL, omitting it must default to the caller's accessible set (empty membership → 0 rows), NOT all-tenant. Two-org fixture: org B caller sees 0 of org A. RED if any leaks. Binds **EM-BIL-002** guard.
- contract: per-module cross-tenant `.hurl` scenario (caller from org B, omit branch → no org-A rows).
**Fix pattern:** reuse `getActiveBranchIdsForPerson` → `inArray` (the EM-BIL-002 fix), empty → `sql\`false\``. **AC/BR:** EM-BIL-002.
**Gate:** backend isolation 0-fail across 4 modules; contract green; boundaries clean.

### SL-F05 — Persist + surface sync conflicts (F-G04) · **P2** · depends: SL-F01, SL-F02
**Why:** today a real data conflict is dropped (409 response body discarded if client ignores it); no durable record or operator review.
**Skip rules:** backend + FE (conflict badge already partially modeled via syncStatus); E2E for the surface.
**RED tests first:**
- backend `services/api-ts/src/handlers/dental-patient/sync/conflict-persist.test.ts` (new): a version-mismatch update PERSISTS `conflictPayload` on the row + sets `syncStatus='conflict'` (current code only returns it in the 409 body). RED today (column never written). Binds **LF-BR-004**, proposed **BR-####** (F-G04).
- FE-unit `apps/dentalemon/src/features/workspace/hooks/use-sync-status.test.ts` (+case): a `conflict` row renders the conflict affordance.
- E2E `apps/dentalemon/tests/e2e/sync-conflict.spec.ts` (new): forced version mismatch → conflict surfaced, operator resolves.
**FSM:** extend `SYNC_FSM` (`sync-log.schema.ts`) with a `conflict` state + resolution transition; property test for terminal/`synced` reachability. **Schema:** write `conflict_payload` (existing column, `database.schema.ts:41`). **AC/BR:** LF-BR-004, BR-#### (F-G04).
**Gate:** backend conflict 0-fail; FE unit; E2E; tsc/boundaries; contract (sync-log shape) green.

### SL-F06 — Idempotency guard for ADR-004 Tier-2 financial endpoints (F-G16) · **P1** · depends: SL-F01 (shared localId pattern)
**Why:** ADR-004 explicitly flags `POST .../payments` as HIGH-risk double-payment on retry — directly amplified by offline replay.
**Skip rules:** backend + contract; FE disables double-submit already (ADR-004 §Consequences) but server guard is the real fix.
**RED tests first:**
- backend `services/api-ts/src/handlers/dental-billing/payment-idempotency.test.ts` (new): two identical `recordDentalPayment` with the same `localId`/`Idempotency-Key` → one payment row, balance counted once. RED today (no guard). Binds **ADR-004** rule ("any new financial endpoint creating a monetary record MUST have an idempotency guard").
- contract `specs/api/tests/contract/dental-billing.hurl` §new: double-POST payment → single payment, balance unchanged on 2nd.
**Fix pattern:** reuse the SL-F01 localId-as-idempotency-key mechanism (or the `context`-unique-constraint pattern ADR-004 Tier-1 recommends). **AC/BR:** ADR-004.
**Gate:** backend idempotency 0-fail; contract green; boundaries clean; existing billing suites green (no double-count regression).

**Slice dependency order:** SL-F01 → (SL-F02, SL-F06) ; SL-F03, SL-F04 independent (parallel) ; SL-F05 after SL-F01+SL-F02.

---

## (6) Open questions / `[ASSUMPTION]` list (resolve before execution)

1. **`[ASSUMPTION]` (OG-D1/F-G13):** no un-archive/restore path exists for late-placed legal holds — grep found no reverse-archive handler; soft-archive recoverability is per retention MODULE_SPEC §5.3. Confirm whether a late hold must restore already-archived rows or whether "recoverable but not auto-restored" is the accepted posture.
2. **Cadence activation scope (F-G05):** OG-C1–C3 are latent because the offline sync write path (createSyncLog/updateSyncLog) has 0 FE consumers and cadence init is stubbed (CLAUDE.md). Are F-G02/F-G03/F-G04 (SL-F01/02/05) V1 hardening (do now, before activation) or deferred until cadence is wired? They are cheap to fix *now* and dangerous to fix *after* duplicate/clobbered data exists.
3. **Audit occurrence-time (F-G01, SL-F03):** does the product want `occurredAt` ordering now (forward-compatible for offline), or is server-insert order acceptable while sync is stubbed? The fix is cheap and additive (nullable column defaulting to `timestamp`).
4. **Governance RBAC drift (F-G15):** confirm the TypeSpec `x-security-required-roles` should be tightened to `#["admin"]` across legal-hold + erasure ops (handler already enforces `admin`) — pure spec-conformance, no runtime change. Already `[NC]` #18.
5. **Erasure tenancy (F-G07):** ER-P1-1 `[NC]` #17 — who may erase (per-tenant `dentist_owner` vs platform `admin`) gates the tenancy fix; SL-F04 covers the *list-leak* half but the *anonymize-keyed-only-on-personId* half needs the decision.
6. **Cross-tenant governance by-design (OG-B2):** re-affirm the platform-superuser DPO model for legal-hold/retention/erasure (IDEAL §342) — distinct from the EM-BIL-002 branch-omission class; SL-F04 must NOT accidentally re-scope these intentionally-cross-tenant modules.
