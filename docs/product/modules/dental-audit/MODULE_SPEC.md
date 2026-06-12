<!-- oli-version: 1.1 | generated: 2026-05-24 | skill: oli-module-specs --all -->

# Module Specification: dental-audit

---
Spec Version: 1.0 | Last Updated: 2026-05-24
---

> **⚠️ Architecture correction (G8-S8 / [ADR-005](../../../decisions/ADR-005-audit-write-path.md)):** This spec was authored assuming **pg-boss async** audit writes. The implementation writes audit events **inline and synchronously** (`core/audit-logger.ts#logAuditEvent` → `await auditLogRepo.insert`, dual-writing the authoritative `dental_audit_log` table + the legacy `dental_audit` table). AC-AUD-001's pg-boss/5s-async requirement is **superseded by ADR-005**. The viewer endpoint is `GET /dental/audit-events` (G8-S4). The spec body below has been **reconciled to the inline-synchronous reality** (dental-audit FIX-003); AC-AUD-001's original ≤5s async budget is retained only as historical traceability. The durable, read-after-write **inline synchronous** path is authoritative. Write durability is hardened (V-AUD-007 / EM-AUD-008): one transient-connection retry, explicit row id, and **fail-closed rethrow on security-class events**. PHI safety is enforced by a **recursive sanitizer at the `AuditLogRepository.insert` choke point** (V-AUD-101) — covering metadata AND before/after snapshots on every write path — and the viewer DTO omits the snapshot columns entirely (V-AUD-003).

## 1. Module Overview
**Purpose:** Dental-specific audit trail and compliance event log. Extends the base `audit` platform module with dental domain events. Append-only; no record is ever deleted. Consumed by dentist_owner via the audit log viewer (WF-028).

**Users:** dentist_owner (view); System (all modules write events inline/synchronously via `logAuditEvent`, per ADR-005)

**Related:** All modules (event producers via DE-001–DE-024), dental-org (audit log viewer endpoint, assertBranchAccess)

---

## 2. Domain Terms
| Term | Definition |
|------|-----------|
| Audit Event | Immutable record of a system action: actor, action, resource, timestamp, outcome |
| Retention | 7 years minimum (HIPAA); append-only, never deleted (DATA_GOVERNANCE.md §2) |

---

## 3. Workflows
WF-028: View audit log (dentist_owner, branch-scoped, filterable by actor/event/date)
WF-096 [INFERRED]: Write audit event (inline/synchronous via `logAuditEvent`, all modules, on every write operation — ADR-005)

---

## 5. Business Rules
Audit events are append-only — no UPDATE or DELETE ever. Retention: 7 years (HIPAA minimum). No PHI in log body — actor_id and resource_id are UUIDs only (G-005 gap: PHI currently logged in auth handlers — must fix in Wave G1).

---

## 6. Permissions
Write: System (every module writes via `logAuditEvent`, inline/synchronous per ADR-005) — PLUS the viewer itself writes one self-audit `audit_log.accessed` event on every read (V-AUD-NEW-B). | Read: dentist_owner only, branch-scoped (`assertBranchRole` against `dental_membership`; an owner of another org passing this branchId → 403). | Update/Delete: NEVER (405 at HTTP + DB-trigger reject; AC-AUD-002).

---

## 7. Data Requirements
**`audit_event`** (base platform module extended): id, branch_id, actor_id (UUID), action (enum), category (enum), event_type (enum), resource_id (UUID), resource_type, outcome (enum), ip_address, timestamp, retention_status (enum)

---

## 7b. Aggregate Boundaries
AuditEvent is append-only. No aggregate — each event is independent and immutable.

---

## 8. State Transitions
None — append-only, no state machine.

---

## 10. API Expectations
GET /dental/audit-events (branchId [required], actorId?, eventType?, targetType?, targetId?, action?, from?/to?, limit/offset) → paginated events list. Query params are **camelCase** and pagination is **offset-based** (`limit`/`offset`, not `page`/`per_page`) — this matches `getAuditEvents.ts` and is intentional (EM-AUD-013 / V-AUD-004); the handler is authoritative. See API_CONTRACTS.md for the full param table.

---

## 10b. Domain Events
Consumed: ALL domain events (DE-001 through DE-024) → each writes one audit event inline/synchronously (ADR-005)

---

## 10c. Sink boundary (three audit sinks) — FIX-004

Audit history is fragmented across **three** physical sinks. This is a documented
boundary, not a bug to silently work around. **Q2 is now RESOLVED (decision #18,
2026-06-13): the dental viewer surfaces base-module PHI-access reads in a single
pane (read-time union, actor-scoped — see below); the physical 3→1 sink merge stays
deferred to V2.** The append-only DB trigger (sink #1, migration 0080) and the
sink #1↔#2 divergence canary are in place as the safety baseline for that future
merge.

| # | Table | Written by | Read by | What it holds | In the dental viewer (getAuditEvents)? |
|---|-------|-----------|---------|---------------|----------------------------------------|
| 1 | `dental_audit_log` (**authoritative**) | `core/audit-logger.ts#logAuditEvent` → `AuditLogRepository.insert` (FIRST; fail-closed for security / opt-in financial/clinical) | **WF-028 dental viewer** `GET /dental/audit-events` (FIX-001) | All dental domain audit events (visit/invoice/consent/Rx/role/PIN/…) + the viewer's own `audit_log.accessed` self-audit | **YES** — this is the only table the viewer reads |
| 2 | `dental_audit` (**legacy**) | `logAuditEvent` → `DentalAuditRepository.log` (SECOND; fire-and-forget, swallowed on failure) | Legacy wiring tests only — **no viewer** | A duplicate of every event in sink #1 (dual-write) | **NO** — not surfaced anywhere; retained for back-compat |
| 3 | `audit_log_entry` (**base platform**) | base `handlers/audit/repos/audit.repo.ts#AuditRepository.logEvent` (dental PHI-read handlers — listMedicalHistory, listPrescriptions, getDentalInvoice, getImportedPMD, … — record their `data-access` reads here) | base `GET` `listAuditLogs`; retention job `audit.retention` (purges > 7y / 2555d); **+ the dental viewer (read-only union, `data-access` PHI reads only, scoped to the branch's own active members)** | Base-module / platform events incl. base PHI-access reads | **PARTIAL (V1)** — `data-access` PHI reads attributable to the viewed branch's members are surfaced read-only; all other base events stay base-only |

**Viewer visibility — what the dental owner CAN and CANNOT see (single pane, decision #18):**
- **CAN see (sink #1):** every event the dental modules write via `logAuditEvent` — who voided an invoice, who amended a signed note, who changed a role, who accessed the audit log, etc.
- **CAN see (sink #3, NEW):** base-platform **PHI-access reads** (`eventType='data-access'`) attributable to the **viewed branch's own active members** — e.g. a clinician who listed a patient's medical history or opened an invoice. The viewer unions these at READ time (`getAuditEvents` + `repos/base-phi-reads.facade.ts`); they are marked `metadata.source='base'` and the FE tags them "platform". The base `details` JSONB is **dropped** (latent-PHI guard, same posture as the snapshot columns) — only ids/actor/resourceType/timestamp surface.
- **Scoping & its bound:** base rows carry no branch/tenant column, so the union scopes by **actor ∈ active branch members** (`dental_membership`) — leak-safe for V1's single-org product (only the caller's own members' reads appear, ids only). **ROADMAP:** if cross-org membership ever becomes possible, harden to resource-scoping (patient/visit ∈ branch) once the patient branch anchor is non-nullable.
- **STILL CANNOT see:** non-`data-access` base events (auth/login, base person/storage writes) and reads by non-members. These remain base-only by design; full consolidation is the deferred V2 3→1 merge.

**Divergence guard (sinks #1 ↔ #2):** because sink #2 is fire-and-forget, it can silently drop while sink #1 succeeds. `legacy-sink-divergence.test.ts` is the canary: after N mixed `logAuditEvent` calls it asserts `count(dental_audit) == count(dental_audit_log)` (and per-action parity). It fails loudly if the legacy write ever starts diverging — giving the eventual legacy-sunset decision (Q3) a measured baseline. The canary does **not** cover sink #3 (a different module's table, not dual-written).

---

## 11. Acceptance Criteria
**AC-AUD-001:** Any write operation across any module → audit event created **synchronously within the same request** (read-after-write; the original ≤5s async budget is superseded by ADR-005).
**AC-AUD-002:** Audit event cannot be modified or deleted (405 on PATCH/PUT/DELETE).
**AC-AUD-003:** Audit log viewer returns only events for the requesting user's branch — branchId is REQUIRED (omitted → 400; never an unscoped all-tenant query, EM-AUD-002) and the caller must be a dentist_owner of that branch (`assertBranchRole`); a dentist_owner of a *different* org passing this branchId is denied 403 (cross-tenant read denial, pinned in getAuditEvents.test.ts).
**AC-AUD-004:** No email or name fields appear in any audit event (G-005 compliance).

---

## 14. Dependencies
**Internal:** dental-org (assertBranchAccess for viewer endpoint), all modules (event sources via `logAuditEvent`, inline/synchronous)
**External:** None (audit writes are inline/synchronous per ADR-005 — no async queue)

---

## 16. Performance Expectations
Audit event write: inline/synchronous, sub-request latency (ADR-005; the original <5s async budget is superseded). Audit log viewer < 2s (paginated, 7 years retention = ~100k events/branch).

---

## 17. Observability
The audit module does not *consume* domain events to re-emit them (no recursion). It DOES, however, write exactly one self-audit `audit_log.accessed` security event when the log is viewed (V-AUD-NEW-B / WF-028) — this is a single insert and cannot recurse (`logAuditEvent` does not re-invoke the viewer). Pino carries only safe non-PHI identifiers (action/resourceType/ids/role) — never the PHI-bearing metadata/snapshots (T-001); the durable audit sink is the `dental_audit_log` table, not the Pino stream. Metrics: audit_events_written_total (counter, by event_type).

---

## 19. Vertical Slice Plan
AUD-S1: Audit event write (inline/synchronous via `logAuditEvent`) | AUD-S2: Audit log viewer (paginated, filtered) | AUD-S3: G-005 PHI removal from auth logs

---

## 20. AI Instructions
1. NO PHI in any audit log field — G-005 is a P1 gap requiring Wave G1 fix.
2. Audit events written inline/synchronously via `logAuditEvent` (ADR-005): non-security writes are fire-and-forget (best-effort, never break the request); security-class + opt-in financial/clinical writes are fail-closed (rethrow on authoritative-write failure).
3. No PATCH/PUT/DELETE routes on audit events.
4. Paginate all audit log queries — never return unbounded sets.
5. Follow ARCHITECTURE.md, CONTRIBUTING.md, VERTICAL_TDD.md.
