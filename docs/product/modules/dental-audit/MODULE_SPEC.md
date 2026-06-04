<!-- oli-version: 1.1 | generated: 2026-05-24 | skill: oli-module-specs --all -->

# Module Specification: dental-audit

---
Spec Version: 1.0 | Last Updated: 2026-05-24
---

> **⚠️ Architecture correction (G8-S8 / [ADR-005](../../../decisions/ADR-005-audit-write-path.md)):** This spec was authored assuming **pg-boss async** audit writes. The implementation writes audit events **inline and synchronously** (`core/audit-logger.ts#logAuditEvent` → `await auditLogRepo.insert`, dual-writing `dental_audit_log` + `audit_log_entry`). AC-AUD-001's pg-boss/5s-async requirement is **superseded by ADR-005**. The viewer endpoint is `GET /dental/audit-events` (G8-S4). Treat every "pg-boss"/"async" mention below as historical; the durable, read-after-write inline path is authoritative.

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
Write: System only (async, pg-boss) | Read: dentist_owner (branch-scoped) | Delete: NEVER

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
**AC-AUD-003:** Audit log viewer returns only events for requesting user's branch.
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
Audit module itself does NOT write audit events (avoid recursion). Metrics: audit_events_written_total (counter, by event_type).

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
