# ADR-002: Concurrent Edit Policy

**Status**: Accepted  
**Date**: 2026-05-08  
**Context**: V2 Audit Gate #4 — `version` column exists in all tables but no handler uses it. Concurrent edit behavior was undocumented.

---

## Decision

**Last-write-wins** is the current concurrency policy. The `version` column is preserved in the schema for future use but is explicitly unused. Ad-hoc SQL-level atomicity protects the highest-risk operations.

---

## Current State

### Version Column (Dead Code)

`services/api-ts/src/core/database.schema.ts:21` defines:

```typescript
version: integer('version').default(1).notNull(), // Optimistic locking
```

This column is spread into every table via `baseEntityFields`. However:

- `updateOneById()` in `services/api-ts/src/core/database.repo.ts:120` does **NOT** check or increment `version`
- No handler anywhere uses `WHERE version = ?` or increments version after a write
- The "Optimistic locking" comment is aspirational, not implemented

The `version` column is dead code as of 2026-05-08.

### Existing Ad-Hoc Protections

These patterns provide real concurrency safety for the highest-risk operations:

| Pattern | Location | Protection |
|---------|----------|-----------|
| Atomic SQL increment | `dental-invoice.repo.ts:147-167` | `SET paidCents = paidCents + $amount` — prevents race on payment recording |
| Atomic SQL decrement | `dental-invoice.repo.ts:173-189` | `SET paidCents = paidCents - $amount` — prevents race on payment reversal |
| Conditional status update | `patient.repo.ts:303` | `WHERE status = 'active'` — prevents double-archive |
| Conditional status update | `dental-appointment.repo.ts:94-96` | `WHERE status IN ('scheduled','checkedIn')` — prevents cancel of wrong state |

### Frontend Staleness Mitigation

TanStack Query is configured with `refetchOnWindowFocus: true` in `packages/sdk-ts/src/react/provider.tsx`. This re-fetches stale data when the user returns to a tab, reducing the likelihood of acting on stale state.

---

## Consequences

- **Concurrent edits to the same record may silently overwrite each other** — the last write wins
- **No conflict detection**: users are not informed that their edit overwrote another user's change
- **Acceptable for current scale**: Dental clinics typically have 1–5 concurrent users per branch, reducing collision frequency
- **At-risk operations**: Treatment plan editing, appointment slot changes — these could benefit from optimistic locking in the future

---

## Future: Optimistic Locking

When concurrent edit conflicts become a real user-facing problem, implement optimistic locking:

1. Add `WHERE version = $inputVersion` to `updateOneById()` in `database.repo.ts`
2. Increment version on every write: `SET version = version + 1`
3. Return `409 Conflict` when the WHERE clause matches 0 rows (version mismatch)
4. Frontend sends `version` in PATCH/PUT body; displays conflict modal on 409

High-contention candidates for first implementation: `DentalTreatment`, `DentalAppointment`, treatment plan items.

---

## Notes

- The `version` column comment "Optimistic locking" in `database.schema.ts:21` should be updated to "Reserved for optimistic locking — currently unused" to prevent confusion
