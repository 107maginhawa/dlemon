# ADR-005: Audit Write Path — Inline Synchronous, Not pg-boss Queued

**Status**: Accepted
**Date**: 2026-05-30
**Context**: G8-S8 (oli-magic cycle 2). The dental-audit `MODULE_SPEC`/AC-AUD-001 was authored assuming audit events would be written **asynchronously via pg-boss** (a queue consumer draining audit jobs). The implementation instead writes audit events **inline and synchronously**. `services/api-ts/src/core/jobs.ts` ships a pg-boss `JobScheduler` abstraction, but no pg-boss consumer exists for audit. The `spec-compliance-audit.md` flagged this as a gap ("Spec requires pg-boss async writes (AC-AUD-001) — no pg-boss consumer found"). This ADR resolves the ambiguity by ratifying the implemented architecture and superseding AC-AUD-001's transport requirement.

---

## Decision

**Audit events are written inline and synchronously within the same request flow that produces them.** `core/audit-logger.ts#logAuditEvent` performs `await auditLogRepo.insert(...)` (with a single transient-connection retry via `withConnectionRetry`) and **dual-writes** to the dental `dental_audit_log` table (authoritative, read by the `GET /dental/audit-events` viewer) and the platform `audit_log_entry` table.

**pg-boss is NOT used for audit writes.** It remains reserved for genuinely deferrable background work (notification fan-out, scheduled jobs) where at-least-once async delivery is acceptable.

**AC-AUD-001 (pg-boss async audit) is superseded by this ADR.** The dental-audit MODULE_SPEC should reference ADR-005 instead of requiring a queue.

---

## Rationale

| Concern | Inline synchronous (chosen) | pg-boss async (rejected) |
|---------|-----------------------------|--------------------------|
| **Durability of security events** | Audit row commits in the same logical flow as the action; a security-sensitive event (PIN set, role change, cross-tenant access) cannot be silently lost to a queue/consumer outage | A dropped/failed job means a missing audit record — unacceptable for compliance |
| **Read-after-write** | Viewer immediately reflects the event; tests assert this directly | Eventual consistency; viewer lags the action by queue latency |
| **Complexity** | One code path, no consumer process, no queue backlog to monitor | Requires a running consumer, dead-letter handling, backlog alerting |
| **Cost** | One cheap INSERT per audited action; negligible at current scale | Queue round-trip overhead for a write that is already fast |
| **Tenant scoping** | `branchId` required at call site (EM-AUD-002 guard) keeps writes scoped | Same guard needed, plus serialization into the job payload |

The audit INSERT is inexpensive and on the same Postgres instance, so the latency cost of doing it inline is small relative to the durability and consistency it buys. Compliance-grade audit logging favors **strong consistency over throughput**.

---

## Consequences

- **Positive:** No queue infrastructure to operate for audit; audit is impossible to lose to async failure; viewer is always current; simpler mental model and test surface.
- **Negative / accepted trade-offs:**
  - A failing audit INSERT propagates into the request. Mitigation: `withConnectionRetry` covers transient drops; a persistent audit-DB failure SHOULD fail the action (fail-closed) for security-sensitive writes rather than proceed unaudited.
  - Request latency includes the audit INSERT. Accepted — the write is cheap.
  - If audit volume ever dwarfs request volume (e.g. bulk imports emitting thousands of events), revisit with a **batched** inline write before reaching for a queue.
- **Spec alignment:** Update `docs/product/modules/dental-audit/MODULE_SPEC.md` and `AUDIT_CONTRACTS` to cite ADR-005; drop the pg-boss requirement from AC-AUD-001.

---

## References

- `services/api-ts/src/core/audit-logger.ts` — `logAuditEvent`, dual-write, `withConnectionRetry`
- `services/api-ts/src/core/jobs.ts` — pg-boss `JobScheduler` (reserved for non-audit background work)
- `services/api-ts/src/handlers/dental-audit/getAuditEvents.ts` — viewer reading `dental_audit_log`
- `docs/audits/mapping-audit/spec-compliance-audit.md` — original AC-AUD-001 gap finding
- Related: ADR-004 (idempotency), and the audit-convergence work (commit `55083a87`) that routed all 8 dental-org audit writes to `dental_audit_log`
