# ADR-006: Domain Events Are Audit-Log-Only Semantic Markers — No Event Bus

**Status**: Accepted
**Date**: 2026-05-30
**Context**: Compliance-fix pass (oli-magic cycle 2). `EVENT_CONTRACTS.md` describes a
catalog of domain events (DE-001 – DE-024) "delivered via **pg-boss** async queue" with
at-least-once delivery, a DLQ table (`dental_event_dlq`), per-aggregate ordering, and
consumer subscriptions (dental-billing, dental-pmd, dental-audit, notifs, dental-clinical).
In practice the system runs as a **single TypeScript runtime** (Hono + Drizzle on Bun) and is
also embedded **offline-first** inside the Tauri/QuickJS host (`api-ts-embedded`). There is no
event bus: no producer emits `DomainEvent` envelopes, there is no `dental_event_dlq` table, and
the only "consumer" wired in `app.ts` (`registerAuditDomainEventConsumer`) is a no-op-style
shim. ADR-005 already ratified that **audit writes are inline and synchronous, not pg-boss
queued**. This ADR extends that decision to the broader domain-event catalog.

---

## Decision

**Domain events are audit-log-only semantic markers. There is no event bus, no queue, no DLQ,
and no publisher/subscriber scaffolding.**

1. **Producers satisfy their event obligations by calling `logAuditEvent` synchronously** at the
   point the corresponding state change commits. The "event" is the audit row — a durable,
   append-only record of the fact that the thing happened — not a message handed to a broker.

2. **The `dental-audit` consumer ("subscribes to ALL") is satisfied by this same inline write.**
   Because every producer already writes to `dental_audit_log` in-flow (ADR-005), the audit
   module observes every event without any subscription machinery.

3. **Reactive (notifs) consumers are deferred to a future phase.** Events whose only non-audit
   consumer is `notifs` (confirmation emails, receipts, welcome messages, PMD download links,
   lab-completion alerts) do not fire any side effect today. When reactive notifications are
   built, they will be triggered directly from the originating handler (or a future, explicitly
   designed mechanism) — not retrofitted onto a speculative bus.

4. **No emit/publisher scaffolding is required or should be added.** Do not introduce a
   `DomainEvent` envelope type, an `emit()`/`publish()` API, a `dental_event_dlq` table, or a
   pg-boss audit/event consumer. pg-boss remains reserved for genuinely deferrable background
   work (scheduled jobs), per ADR-005.

5. **The `EVENT_CONTRACTS.md` catalog stays intact** as the canonical semantic vocabulary: it
   documents *which* facts must be recorded and *what* identifiers each carries. It is a
   contract over audit-log content and future reactive triggers, not over a wire transport.

---

## Affected Events

The events below are reclassified as audit-log-only markers. Each is recorded via a synchronous
`logAuditEvent` call by its producer; the `dental-audit` consumer is satisfied inline. Where a
`notifs` consumer is listed in `EVENT_CONTRACTS.md`, that reactive behaviour is **deferred**.

| Cluster | Events | Producer module | Audit | Reactive (notifs) |
|---------|--------|-----------------|:-----:|:-----------------:|
| Visit lifecycle | DE-001 `VisitCheckedIn`, DE-002 `VisitCompleted`, DE-003 `VisitLocked`, DE-004 `TreatmentDiagnosed`, DE-005 `TreatmentPerformed`, DE-006 `TreatmentDismissed` | dental-visit | ✅ inline | — |
| Scheduling | DE-001 `VisitCheckedIn` (check-in trigger) | dental-scheduling | ✅ inline | — |
| Billing | DE-008 `InvoicePaid`, DE-011 `AppointmentCancelled` | dental-billing / dental-scheduling | ✅ inline | deferred |
| Clinical | DE-012 `ConsentSigned`, DE-013 `ConsentRevoked`, DE-014 `LabOrderCreated`, DE-015 `LabOrderCompleted`, DE-016 `PrescriptionWritten` | dental-clinical | ✅ inline | deferred (DE-015) |
| PMD | DE-017 `PMDGenerated` | dental-pmd | ✅ inline | deferred |
| Imaging | DE-018 `ImagingStudyUploaded`, DE-019 `ImagingFindingConfirmed`, DE-020 `CephAnalysisComputed` | dental-imaging | ✅ inline | — |
| Patient | DE-021 `PatientRegistered` | dental-patient | ✅ inline | deferred |
| Perio | `perio.chart.*` (chart created / readings recorded / completed) | dental-perio | ✅ inline | — |

> Notes:
> - DE-001 `VisitCheckedIn` is produced at the scheduling check-in boundary and observed by the
>   clinical/visit context; it appears under both Scheduling and Visit lifecycle above.
> - DE-019 `ImagingFindingConfirmed` is consumed by dental-clinical (safety-floor reference) in
>   `EVENT_CONTRACTS.md`; that cross-module read is satisfied by querying confirmed findings
>   directly, not via a bus subscription.
> - DE-007/009/010/022/023 and the DE-024 stub are unaffected by this fix pass beyond the same
>   audit-log-only principle; they follow the identical rule when their producers land.

---

## Rationale

| Concern | Audit-log-only markers (chosen) | pg-boss event bus (rejected) |
|---------|---------------------------------|------------------------------|
| **Runtime model** | Single TS runtime + offline-embedded QuickJS host — no second process to run a consumer | A bus needs a long-lived consumer process the embedded host cannot host |
| **Durability** | Every fact already commits as an append-only audit row in-flow (ADR-005) | A dropped job loses the only record of the fact |
| **Complexity** | Zero new infrastructure; one code path | Envelope type, emit API, DLQ table, retry/backoff, backlog alerting |
| **Offline-first** | Works identically embedded and server-side | A broker is not available offline on-device |
| **Honesty** | Docs describe what the code does | Catalog promised a transport that was never built |

The catalog's value is its **vocabulary and identifier contracts**, which we keep. The promised
**transport** was aspirational and unbuilt; ratifying the implemented reality removes a standing
compliance gap (docs-vs-code drift) without deleting useful semantic documentation.

---

## Consequences

- **Positive:** No phantom infrastructure to build or audit; docs match code; offline-embedded
  host stays viable; one durable write per fact.
- **Negative / accepted trade-offs:**
  - Reactive notifications (emails/push) are not delivered until a future phase wires them
    directly from handlers. Accepted — none are in MVP scope.
  - Cross-module reactions (e.g. billing reacting to `TreatmentPerformed`) are implemented as
    direct in-flow calls or queries rather than decoupled subscriptions. If true decoupling is
    ever needed at scale, revisit with a deliberate transport decision (and supersede this ADR).
- **Spec alignment:** `EVENT_CONTRACTS.md` carries a top-of-file note citing this ADR; the
  catalog is retained. Any `MODULE_SPEC` that asserts pg-boss/DLQ event delivery should cite
  ADR-006 (and ADR-005 for audit).

---

## References

- ADR-005 — Audit Write Path (inline synchronous, not pg-boss queued)
- `docs/product/EVENT_CONTRACTS.md` — domain-event catalog (retained as semantic vocabulary)
- `services/api-ts/src/core/audit-logger.ts` — `logAuditEvent` (the inline write that records events)
- `services/api-ts/src/app.ts` — `registerAuditDomainEventConsumer` (shim; no bus)
- `services/api-ts-embedded/` — offline-first QuickJS embedding that precludes a broker process
