# oli-enforce-file: dental-audit
Run ID: run-6-strict-2026-05-29 | Generated: 2026-05-29

---

## Summary

| Metric | Value |
|--------|-------|
| Files checked | 5 |
| Unspecced files | 0 |
| Auth missing | 0 |
| Service layer absent | false |
| P0 findings | 0 |
| P1 findings | 3 |
| P2 findings | 1 |
| P3 findings | 0 |

---

## Files Checked

| # | File | Role |
|---|------|------|
| 1 | `repos/audit-log.schema.ts` | Drizzle schema definition |
| 2 | `repos/audit-log.repo.ts` | Repository class (service layer) |
| 3 | `getAuditEvents.ts` | HTTP handler — GET /dental/admin/audit |
| 4 | `consumers/domain-events.consumer.ts` | pg-boss consumer registration |
| 5 | `audit.test.ts` | Unit tests |

---

## Findings

### EF-AUD-001 · P1 · Schema divergence from MODULE_SPEC
**File:** `repos/audit-log.schema.ts`

MODULE_SPEC §7 specifies `audit_event` fields including `category (enum)`, `event_type (enum)`, `outcome (enum)`, `ip_address`, `retention_status (enum)`. The schema at `dental_audit_log` omits all five of these columns. Only `actorId`, `action`, `targetType`, `targetId`, `reason`, `beforeSnapshot`, `afterSnapshot`, `branchId`, `tenantId`, `timestamp` are present.

The implemented schema is narrower than the spec. Missing fields: `category`, `event_type`, `outcome`, `ip_address`, `retention_status`.

**Fix:** Add the missing columns to the Drizzle schema and generate a migration, or update MODULE_SPEC §7 to reflect the agreed-upon narrower model (requires product sign-off).

---

### EF-AUD-002 · P1 · DE-001 through DE-024 not enumerated — single generic queue, zero active publishers
**File:** `consumers/domain-events.consumer.ts`

MODULE_SPEC §10b: "Consumed: ALL domain events (DE-001 through DE-024) → each writes one audit event asynchronously."

The consumer registers a **single** generic queue (`dental.audit.domain-events`) that accepts any `DentalAuditDomainEvent`. This means producers must explicitly call `publishAuditEvent()` — there is no automatic subscription to each module's native DE-NNN queues.

No mapping of DE-001 → DE-024 event names appears anywhere in the module. `publishAuditEvent` has **zero call sites** outside the consumer file itself (grep confirmed). This means no module currently publishes to this queue — zero domain events are being audited at runtime.

**Fix:** Either (a) enumerate DE-001–DE-024 queue names and subscribe to each, or (b) document the explicit publish contract and add `publishAuditEvent()` calls in each producing handler. Currently the wiring is structurally incomplete.

---

### EF-AUD-003 · P1 · assertBranchAccess conditional — tenantId-only queries bypass branch isolation
**File:** `getAuditEvents.ts`

`assertBranchAccess` is called only when `branchId` query param is present (line 34–36). A `dentist_owner` can query the audit log with only `tenantId` (no `branchId`) and receive events from all branches of that tenant — including branches they do not belong to.

MODULE_SPEC §6: "Read: dentist_owner (branch-scoped)". AC-AUD-003: "returns only events for requesting user's branch."

**Fix:** Make `branchId` a required parameter for `dentist_owner`, or derive their branch from session and always enforce `assertBranchAccess`. Do not allow unbounded tenant-level queries.

---

### EF-AUD-004 · P2 · Route path mismatch: spec vs implementation
**File:** `getAuditEvents.ts` (wired in `app.ts`)

MODULE_SPEC §10 specifies: `GET /dental/audit-events`

The handler comment (line 3) declares `GET /dental/admin/audit`. Verify which path is live in `app.ts` and align the spec to the canonical route.

---

## Checklist per File

### `repos/audit-log.schema.ts`
- [x] Spec coverage: Partially — schema exists but missing 5 fields vs MODULE_SPEC §7 (EF-AUD-001)
- [x] Auth: N/A (schema file)
- [x] Service layer: N/A (schema file)
- [x] Drizzle ORM: Yes — `pgTable`, proper column types, 4 composite indexes
- [x] Raw SQL: None
- [x] Error handling: N/A

### `repos/audit-log.repo.ts`
- [x] Spec coverage: Yes — insert (append-only) + filtered list + pagination match spec
- [x] Auth: N/A (repository)
- [x] Service layer: IS the service layer (AuditLogRepository class)
- [x] Drizzle ORM: Yes — `db.select()`, `db.insert()`, `eq/and/gte/lte` operators
- [x] Raw SQL: None
- [x] Error handling: Typed results; no unhandled rejections; count via secondary select (not COUNT(*) — minor inefficiency, not a finding)

### `getAuditEvents.ts`
- [x] Spec coverage: Yes — WF-028 viewer endpoint
- [x] Auth: Yes — 401 (UnauthorizedError) + 403 (ForbiddenError) + conditional assertBranchAccess
- [x] Auth gap: P1 EF-AUD-003 — assertBranchAccess is optional, not mandatory
- [x] Service layer: Uses AuditLogRepository (no direct db calls)
- [x] Drizzle ORM: Via repo
- [x] Raw SQL: None
- [x] Error handling: Proper 401/403 via error classes; pagination capped at 200; no unhandled rejections

### `consumers/domain-events.consumer.ts`
- [x] Spec coverage: Partially — consumer exists but DE-001–DE-024 not enumerated (EF-AUD-002)
- [x] Auth: N/A (system-level consumer, no HTTP)
- [x] Service layer: Uses AuditLogRepository
- [x] Drizzle ORM: Via repo
- [x] Raw SQL: None
- [x] Error handling: Silently drops malformed events (early return if required fields missing) — acceptable for audit; no unhandled rejections
- [x] Registered in app.ts: YES (line 510)
- [x] Active publishers: NONE — zero callers of publishAuditEvent in codebase

### `audit.test.ts`
- [x] Spec coverage: Covers AuditLogRepository CRUD + logAuditEvent integration + AUD-BR-004 + AC-003
- [x] Isolation: openTestTx (rolled-back transactions) — correct pattern
- [x] Missing: No HTTP integration test for getAuditEvents (auth/role/branch enforcement not tested)
- [x] Missing: No test for consumer registration or event routing end-to-end

---

## Consumer Registration Assessment

`registerAuditDomainEventConsumer` IS wired in `app.ts` line 510. However:
- Single queue `dental.audit.domain-events` — not 24 separate DE-NNN queues
- `publishAuditEvent()` has zero callers in the codebase
- DE-001–DE-024 are not enumerated as constants or queue name mappings anywhere in this module

---

## Auth Pattern Assessment

`getAuditEvents.ts` implements a two-layer check:
1. User presence → 401
2. `dentist_owner` role → 403
3. `assertBranchAccess` — **conditional on branchId param** (gap: EF-AUD-003)

Pattern is partially correct. The conditionality of `assertBranchAccess` is the enforcement gap.

---

## Service Layer Assessment

**Status: PRESENT** (run-5 reported ABSENT — this was incorrect; service layer exists as AuditLogRepository)

`AuditLogRepository` class in `repos/audit-log.repo.ts` provides the full service layer. Both the handler and consumer instantiate the repo rather than calling `db` directly.

---
