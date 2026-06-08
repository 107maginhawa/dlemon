<!-- oli-version: 1.1 | generated: 2026-05-24 | skill: oli-module-specs --all -->

# Module Specification: dental-audit

---
Spec Version: 1.0 | Last Updated: 2026-05-24
---

> **⚠️ Architecture correction (G8-S8 / [ADR-005](../../../decisions/ADR-005-audit-write-path.md)):** This spec was authored assuming **pg-boss async** audit writes. The implementation writes audit events **inline and synchronously** (`core/audit-logger.ts#logAuditEvent` → `await auditLogRepo.insert`, dual-writing the authoritative `dental_audit_log` table + the legacy `dental_audit` table). AC-AUD-001's pg-boss/5s-async requirement is **superseded by ADR-005**. The viewer endpoint is `GET /dental/audit-events` (G8-S4). Treat every "pg-boss"/"async" mention below (§1, §3, §6, §14, §16, §19, §20) as **historical** — the durable, read-after-write **inline synchronous** path is authoritative. Write durability is hardened (V-AUD-007 / EM-AUD-008): one transient-connection retry, explicit row id, and **fail-closed rethrow on security-class events**. PHI safety is enforced by a **recursive sanitizer at the `AuditLogRepository.insert` choke point** (V-AUD-101) — covering metadata AND before/after snapshots on every write path — and the viewer DTO omits the snapshot columns entirely (V-AUD-003).

## 1. Module Overview
**Purpose:** Dental-specific audit trail and compliance event log. Extends the base `audit` platform module with dental domain events. Append-only; no record is ever deleted. Consumed by dentist_owner via the audit log viewer (WF-028).

**Users:** dentist_owner (view); System (all modules write events via pg-boss async)

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
WF-096 [INFERRED]: Write audit event (async, all modules via pg-boss on every write operation)

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
Consumed: ALL domain events (DE-001 through DE-024) → each writes one audit event asynchronously

---

## 11. Acceptance Criteria
**AC-AUD-001:** Any write operation across any module → audit event created within 5s.
**AC-AUD-002:** Audit event cannot be modified or deleted (405 on PATCH/PUT/DELETE).
**AC-AUD-003:** Audit log viewer returns only events for the requesting user's branch — branchId is REQUIRED (omitted → 400; never an unscoped all-tenant query, EM-AUD-002) and the caller must be a dentist_owner of that branch (`assertBranchRole`); a dentist_owner of a *different* org passing this branchId is denied 403 (cross-tenant read denial, pinned in getAuditEvents.test.ts).
**AC-AUD-004:** No email or name fields appear in any audit event (G-005 compliance).

---

## 14. Dependencies
**Internal:** dental-org (assertBranchAccess for viewer endpoint), all modules (event sources via pg-boss)
**External:** pg-boss (async event queue)

---

## 16. Performance Expectations
Audit event write < 5s (async via pg-boss). Audit log viewer < 2s (paginated, 7 years retention = ~100k events/branch).

---

## 17. Observability
The audit module does not *consume* domain events to re-emit them (no recursion). It DOES, however, write exactly one self-audit `audit_log.accessed` security event when the log is viewed (V-AUD-NEW-B / WF-028) — this is a single insert and cannot recurse (`logAuditEvent` does not re-invoke the viewer). Pino carries only safe non-PHI identifiers (action/resourceType/ids/role) — never the PHI-bearing metadata/snapshots (T-001); the durable audit sink is the `dental_audit_log` table, not the Pino stream. Metrics: audit_events_written_total (counter, by event_type).

---

## 19. Vertical Slice Plan
AUD-S1: Audit event write (pg-boss consumer) | AUD-S2: Audit log viewer (paginated, filtered) | AUD-S3: G-005 PHI removal from auth logs

---

## 20. AI Instructions
1. NO PHI in any audit log field — G-005 is a P1 gap requiring Wave G1 fix.
2. Audit events written async via pg-boss — never block the main request path.
3. No PATCH/PUT/DELETE routes on audit events.
4. Paginate all audit log queries — never return unbounded sets.
5. Follow ARCHITECTURE.md, CONTRIBUTING.md, VERTICAL_TDD.md.
