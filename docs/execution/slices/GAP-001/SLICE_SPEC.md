---
slice: GAP-001
phase: audit-full-remediation
agent_skills: [oli-execution-gate]
tdd_mode: schema-only-skip
---

# GAP-001 — Sync Fields on 4 Clinical/Billing Schemas

## Standard Ref
IDEAL §3.13 (offline-readiness), §5.10 (LF-BR-001..004), §6.8 (entity contracts)

## Problem
`dentalVisits`, `dentalCharts`, `dentalTreatments`, `dentalInvoices` have no per-entity
`localId / syncStatus / lastSyncAt / conflictPayload` columns. Offline-readiness is
side-table only (`dental_sync_log`). Standard requires per-row sync state.

## Scope

### Files Modified
- `services/api-ts/src/core/database.schema.ts` — add `syncableEntityFields` export
- `services/api-ts/src/handlers/dental-visit/repos/visit.schema.ts`
- `services/api-ts/src/handlers/dental-visit/repos/dental-chart.schema.ts`
- `services/api-ts/src/handlers/dental-visit/repos/treatment.schema.ts`
- `services/api-ts/src/handlers/dental-billing/repos/dental-invoice.schema.ts`
- `services/api-ts/src/generated/migrations/0056_*.sql` (generated)

## Acceptance Criteria

| ID | Description |
|----|-------------|
| AC-001 | `syncableEntityFields` exported from database.schema.ts |
| AC-002 | All 4 tables include `local_id`, `sync_status`, `last_sync_at`, `conflict_payload` columns |
| AC-003 | `sync_status` defaults to `'synced'` |
| AC-004 | Migration 0056_* generated and valid SQL |
| AC-005 | `bun run typecheck` passes with zero errors |

## TDD Decision
Schema-only migration + column additions with no runtime branching logic.
Skipped per oli-execution-gate §"When TDD Does NOT Apply": "Schema-only migrations — DDL changes".
Verification: typecheck green + migration file present.
