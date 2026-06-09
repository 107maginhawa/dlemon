# dental-audit — Module Gap Plan

**Module:** dental-audit (append-only compliance audit trail)
**Audited:** 2026-06-09
**Auditor:** Claude Code (code + KG analysis; live-UI audit N/A — module has no frontend)
**Reference:** `docs/context/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md` §3.13, §5.11 (AUD-BR-001..004), §7 (RBAC)
**Spec:** `docs/product/modules/dental-audit/MODULE_SPEC.md` (+ `ui-prototype/`), `API_CONTRACTS.md`, ADR-005

---

## Audit Decision: **PARTIAL PASS**

The **backend is strong and well-tested**: append-only is enforced at the Postgres layer (trigger) and HTTP layer (405), reads are owner-only + branch-scoped with a hard cross-tenant denial test, a recursive PHI sanitizer runs at the repo choke point, the viewer omits snapshot columns, and viewing the log is itself self-audited. **However**, the module is not production-complete: there is **no frontend audit-log viewer** (spec'd in WF-028 + fully prototyped, backend + SDK ready, but never built), several **sensitive actions are not written to the audit log**, and **non-security audit writes are best-effort** (errors swallowed, not transactional), creating silent compliance gaps. These are trust/compliance gaps, not active safety holes — hence PARTIAL PASS, not FAIL.

---

## Expected vs Actual

| Dimension | Expected (IDEAL std + MODULE_SPEC) | Actual |
|---|---|---|
| Append-only storage | No UPDATE/DELETE ever | ✅ DB trigger (`0080_audit_log_append_only.sql`) + HTTP 405 + real-Postgres test |
| Owner-only branch-scoped read | dentist_owner only, branchId required | ✅ `assertBranchRole(['dentist_owner'])`, branchId required (EM-AUD-002), cross-tenant 403 tested |
| PHI safety | No PHI in metadata/snapshots; viewer drops snapshots | ✅ recursive sanitizer at `AuditLogRepository.insert`; DTO omits before/after |
| Self-audit on read | log viewing writes `audit_log.accessed` | ✅ implemented + tested (fail-closed security event) |
| **Audit log viewer UI (WF-028)** | dentist_owner views/filters/paginates log in-app | ❌ **No production frontend** — no route, no feature, no `getAuditEvents` consumer in `apps/dentalemon`. SDK hooks generated + `ui-prototype/` exists, but unbuilt |
| **Complete write coverage** (AUD-BR-001/002) | all sensitive clinical+billing actions auditable | ⚠️ Strong for billing (void/discount/payment/uncollectible/remittance) + many clinical. **Gaps:** member role change, treatment-plan approval/accept, clinical-note sign/amend NOT audited |
| **Write reliability** | durable audit on every mutation | ⚠️ Non-`security` writes swallow errors + run outside the mutation transaction → mutation can commit with no audit row, silently |
| **Field completeness** (AUD-BR-004) | actor/action/target/timestamp/reason/before-after | ⚠️ first 4 present; `reason` column + `before/after` snapshots **never populated** by any handler |
| Denied-attempt logging (AUD-BR-003, Recommended) | log permission-denied where practical | ❌ not implemented |
| Single source of truth | one audit trail | ⚠️ 3 sinks: `dental_audit_log` (append-only/sanitized), legacy `dental_audit` (dual-write), base `audit_log_entries` (purgeable, different RBAC) |
| Auditor/read-only role | read-only/auditor can view log | ❌ `read_only` role cannot read; only `dentist_owner` |

---

## Gaps by Severity

### P0 — none
No active safety/security hole that blocks a core workflow. (The historical cross-tenant leak EM-AUD-002 is fixed and pinned; append-only is enforced.)

### P1 — fix before production

> **✅ BATCH 2 (2026-06-09): P1-C, P1-B, and P2-A FIXED.** Audit writes are now fail-closed on money/clinical mutations (void/discount/payment/visit-complete/role-change) via a per-call `failClosed` opt on `logAuditEvent` (no global flip); the previously-unaudited sensitive actions (member role change, plan approval/accept, note sign/amend, claim-status) now write `dental_audit_log` rows; and before/after snapshots + `reason` are populated on update/void actions. See MASTER-GAP-MATRIX §9. **P1-A (viewer) remains open** (Batch 8 / gated).

- **P1-A — No frontend audit-log viewer.** `GET /dental/audit-events` + SDK `getAuditEventsOptions` (react-query) are fully generated, and the UI is spec'd (WF-028) and prototyped (`docs/product/modules/dental-audit/ui-prototype/screens.md`), but **no production screen exists**. `apps/dentalemon/src` has no `routes/**audit**`, no `features/audit/`, and zero `getAuditEvents` callers. IDEAL std lists "View audit logs" as **V1 Required (Admin)**. Owners cannot review the compliance trail in-app.
- **P1-B — ✅ FIXED (Batch 2). Sensitive actions not audited (AUD-BR-001 gaps).** `logAuditEvent` added to `updateMember` role change (`membership.role_change`), `approveTreatmentPlan` (`treatment_plan.approved`), `acceptCasePresentation` (`case_presentation.accepted`), `signVisitNotes` (`visit_note.signed`), `createVisitNoteAddendum` (`visit_note.amended`). Per-handler audit-row tests prove each. *(Original finding, for history:)* Confirmed by grep (zero `logAuditEvent`):
  - `dental-org/updateMember.ts` — member **role change** writes no audit event (only the separate `updatePermissions.ts` is audited).
  - `treatment-plans/approveTreatmentPlan.ts`, `updateTreatmentPlan.ts`, `acceptTreatmentPlan.ts` — plan **approval/accept** writes a domain `recordStatusHistory` row but no audit event.
  - `signVisitNotes.ts`, `createVisitNoteAddendum.ts`, `upsertVisitNotes.ts` — clinical-note **sign/amend** emit only a Pino `log.info`; not in the audit sink.
  These are permission-/clinical-sensitive transitions an owner would expect to see in the audit viewer.
- **P1-C — ✅ FIXED (Batch 2). Non-security audit writes are best-effort + non-atomic.** Resolved via **fail-closed** (the matrix's accepted alternative to in-tx): a per-call `failClosed` opt on `logAuditEvent`, set on void/discount/payment/visit-complete/role-change, so an audit-sink failure surfaces a 5xx instead of a silent committed-without-audit gap. RED-proven by `audit-write-reliability.test.ts` (spyOn the insert → void 5xx). Residual: the mutation still commits before the 5xx (no *silent* gap; full rollback would need an in-tx refactor of the billing/visit repos). *(Original finding:)* `core/audit-logger.ts` catches and `logger.error`-swallows failures for all non-`security` events (only PIN-set, erasure, audit-read are fail-closed). The `logAuditEvent` call runs **after** the mutation's repo calls, **not** inside `db.transaction`. So a void / discount / payment / visit-complete can commit with **no audit row and no caller-visible error** — a financial/clinical compliance risk.

### P2 — important, not blocking
- **P2-A — ✅ FIXED (Batch 2). AUD-BR-004 partially unmet.** Sanitized before/after snapshots + the `reason` column are now populated on void (isVoid+voidReason), discount (totals+reason), role-change (before/after role), claim-status (before/after status), and visit-complete (before/after status). Asserted in the Batch-2 tests. *(Original finding:)* No handler populates `beforeSnapshot`/`afterSnapshot` (grep `before:`/`after:` in audit calls = 0), and the dedicated `reason` column is unused (reasons are stuffed into `metadata`). Before/after diffs are a core audit expectation for update/void actions.
- **P2-B — Fragmented audit sinks (duplicate source of truth).** Three sinks with divergent guarantees; events written **only** via the base `AuditRepository.logEvent` (e.g. PHI data-access reads in some clinical list handlers) are **invisible** to the dental viewer, which reads only `dental_audit_log`. The legacy `dental_audit` dual-write is acknowledged dead-weight ("kept for existing wiring tests").
- **P2-C — `read_only`/auditor role cannot read the audit log.** `ROLE_PERMISSION_MATRIX.md:100` labels `read_only` the "auditor/observer", but the binding permission row (`:183`) grants "View audit log" to `dentist_owner` only. Diverges from the IDEAL "Read-only/Auditor" role. **[NEEDS CONFIRMATION]** — may be a deliberate product decision (owner-only audit access); confirm before widening.
- **P2-D — Producer-side audit-row test gaps (G5).** Handler tests assert an audit row is written for only a few actions (e.g. `patient.archive`/`patient.export`); most producers (consent, treatment-plan approval, claim-status, voids from the void handler itself) lack a "did it write the audit row" assertion. Coverage is structural, not behavioral.

### P3 — minor / deferred
- **P3-A — `TRUNCATE` not blocked** by the append-only trigger (BEFORE-ROW triggers don't fire on TRUNCATE). Intentional (lets test/reset clear the table) but worth a documented note; requires table-owner privilege to exploit.
- **P3-B — AUD-BR-003 denied-attempt logging** not implemented. IDEAL std marks it **V1 Recommended**, so document-and-defer is acceptable.
- **P3-C — Stale spec/comments.** `MODULE_SPEC.md` still carries historical "pg-boss/async/<5s" language (superseded by ADR-005 inline-sync); a stale "pg-boss consumer" comment lingers in `audit-logger.ts`. Tidy to avoid misleading future work.

---

## Recommended Fix Order (with tests to add before/during each)

1. **P1-C first (reliability is the foundation).** Make audit writes durable for sensitive events:
   - Move the `logAuditEvent` call inside the mutation's `db.transaction` for financial/clinical writes (void, discount, payment, visit-complete/lock, role change), OR escalate those events to fail-closed (rethrow on audit-write failure) like security events.
   - **Tests (RED first):** integration test that forces an audit-insert failure and asserts the mutation is rolled back (or 5xx) for a void/payment; assert no "committed-mutation-without-audit-row" state is reachable.
2. **P1-B — close the write-coverage gaps.** Add `logAuditEvent` to `updateMember` (role change), `approveTreatmentPlan`/`acceptTreatmentPlan`, and `signVisitNotes`/`createVisitNoteAddendum`.
   - **Tests (RED first):** per-handler integration tests asserting a `dental_audit_log` row with the expected `action`/`actorId`/`targetType`/`targetId` is written (covers AUD-BR-001 + AUD-BR-002 G5 gap).
3. **P2-A — populate `before/after` + `reason`.** For update/void handlers, capture pre-state and write `beforeSnapshot`/`afterSnapshot` and the `reason` column (sanitizer already covers snapshots).
   - **Tests:** extend `audit.test.ts` to assert before/after + reason persisted and PHI-sanitized.
4. **P1-A — build the frontend audit-log viewer** (after the trail it displays is trustworthy). Implement `apps/dentalemon/src/features/audit/` + an owner-gated route consuming `getAuditEventsOptions`, per `ui-prototype/screens.md` + `data-table-contracts.md` (filters: actor, eventType, action, targetType, date range; offset pagination).
   - **Tests:** FE unit test (RED) for the viewer table + filters using the SDK hook; E2E journey (new **E2E-AUD-001**): owner opens audit viewer → filters by `invoice.voided` → sees the seeded void event; non-owner is denied/route hidden (covers IDEAL E2E-008 spirit).
5. **P2-B — consolidate sinks.** Decide one authoritative sink; either route base `AuditRepository.logEvent` PHI-access events into `dental_audit_log` (so the viewer sees them) or surface them in the viewer; retire the legacy `dental_audit` dual-write.
   - **Tests:** assert a PHI data-access read produces an event visible to `getAuditEvents`.
6. **P2-C — auditor role** (pending product confirmation): widen `assertBranchRole` to allow `read_only` on `getAuditEvents`, or document owner-only as intentional.
   - **Tests:** RBAC test for `read_only` allow/deny per the decision.
7. **P3-A/C — docs/hardening:** document the TRUNCATE carve-out; reconcile stale pg-boss language in spec + comments. (P3-B denied-attempt logging: document-and-defer.)

---

## Dependencies on Other Modules (blast radius)
- **Event producers (all modules):** P1-B/P2-A changes touch `dental-org` (member), `dental-patient/treatment-plans`, `dental-visit` (notes). Low risk — additive audit calls.
- **dental-org:** viewer endpoint uses `assertBranchAccess`/`assertBranchRole`; P2-C RBAC change is org-scoped.
- **Frontend (P1-A):** new `features/audit/` + route in `apps/dentalemon`; depends on org-context store for `branchId` (same pattern as other owner-only screens) and the generated SDK hook (already present).
- **Cross-module reliability (P1-C):** changing audit to fail-closed/transactional could surface latent DB issues in producer handlers — roll out per-handler with tests, not globally in one shot.

---

## Knowledge Graph / Wiring Findings
- **Backend endpoint, zero FE consumers:** `getAuditEvents` (operationId) → route registered (`main.tsp:499` `/dental/audit-events`; openapi path present) → SDK `getAuditEvents` + react-query `getAuditEventsOptions` generated → **0 callers in `apps/dentalemon/src`**. Classic generated-but-unwired primitive.
- **Writer fan-in:** ~70 handlers import `core/audit-logger#logAuditEvent` (manual per-handler, no audit-on-write middleware). Coverage = "as good as each author remembered." Name collision: an unrelated `logAuditEvent` in `handlers/audit/repos/audit.facade.ts` (base module) is **not** used by dental handlers.
- **Three audit sinks:** `dental_audit_log` (append-only, sanitized, owner-readable) ← dental viewer; legacy `dental_audit` (dual-written, dead-weight); base `audit_log_entries` (SHA-256 integrity hash, retention cron, **purgeable** via `purgeArchivedLogs` DELETE, `admin`/`compliance` RBAC). Divergent guarantees = real fragmentation risk.

---

## Existing Tests Found
| File | Layer | Asserts |
|---|---|---|
| `audit-immutability-db.test.ts` | real Postgres | DB trigger rejects row UPDATE/DELETE, allows INSERT (V-AUD-IMM-001) |
| `audit-append-only.test.ts` | real app | DELETE/PUT/PATCH `/dental/audit-events/:id` → 405 AUDIT_EVENT_IMMUTABLE |
| `audit-events-route-registration.test.ts` | real app | GET unauth → 401 (route codegen-registered, not 404) |
| `getAuditEvents.test.ts` | raw handler + real DB | 401 unauth; 403 non-owner; 400 branchId-omitted (EM-AUD-002); 422 from>to + 400 bad date; DTO omits snapshots / no PHI leak; self-audit `audit_log.accessed`; cross-tenant 403; eventType filter |
| `audit.test.ts` | repo + logAuditEvent | repo insert/filter/pagination; AUD-BR-004 field set + snapshots; recursive PHI-key stripping (nested/array) |

## Missing / Recommended Tests
- **Backend (P1-C):** force audit-insert failure → mutation rolled back / 5xx for void & payment (no silent gap).
- **Backend (P1-B):** audit-row-written assertions for `updateMember` role change, `approveTreatmentPlan`/`acceptTreatmentPlan`, `signVisitNotes`/addendum.
- **Backend (P2-A):** before/after snapshot + `reason` column populated + sanitized on a void/update.
- **Backend (P2-B):** PHI data-access read appears in `getAuditEvents` output (post-consolidation).
- **Backend (P2-C):** `read_only` allow/deny on `getAuditEvents` (per product decision).
- **Frontend (P1-A):** viewer table + filters unit test via `getAuditEventsOptions`; empty/loading/error states.
- **E2E (P1-A) — E2E-AUD-001:** owner opens audit viewer → filter `invoice.voided` → sees seeded void event; non-owner denied/hidden.
- **Seed:** ensure seed includes representative `dental_audit_log` rows (void, discount, visit-complete, consent) so the viewer + E2E have real data (IDEAL §10.1 "Audit logs" seed item).

---

## Items marked [NEEDS CONFIRMATION]
- **P2-C:** Is owner-only audit-read intentional, or should `read_only`/auditor view the log? (`ROLE_PERMISSION_MATRIX.md` is internally inconsistent: line 100 implies auditor read, line 183 grants owner-only.)
- **P3-A:** Is leaving `TRUNCATE` unblocked acceptable given it needs table-owner privilege? (Currently relied on for test/reset.)
- **P1-A scope:** Confirm the audit viewer targets `apps/dentalemon` (production) and follows `ui-prototype/` contracts as-is, vs. a reduced V1 (list + date/actor/action filters only).

---

## Note on Webwright / live-UI audit
A Webwright browser-driven audit was **not applicable**: the dental-audit module has **no frontend surface** to drive (confirmed: no route, no feature, no `getAuditEvents` consumer in `apps/dentalemon/src`). The audit was performed via code + knowledge-graph analysis. Once P1-A (viewer) is built, a Webwright smoke (open viewer → filter → assert seeded event renders) should be added as the live-runtime proof.
