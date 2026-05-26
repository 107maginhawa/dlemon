
---

```md
# IMPLEMENTATION PROMPT — Dentalemon P0-D Local-First Sync Metadata Foundation

Use `/oli-execution-gate`.

You are an experienced AI software engineer, QA tester, database architect, local-first systems architect, and dental workflow analyst.

## Objective

Implement the fourth P0 V1-readiness foundation item for Dentalemon:

`Local-First Sync Metadata Foundation`

This addresses the audit gap that Dentalemon has no `localId`, `syncStatus`, `lastSyncAt`, `SyncLog`, or `SyncState` support for offline/local-first readiness.

Do not implement PatientContact, Recall, TreatmentPlan FSM, Roles, Queue, Inventory, Claims, full offline engine, CRDT, P2P sync, or conflict resolution UI in this prompt.

This prompt is only for structural local-first readiness metadata.

## Required References

Read first:

1. `docs/audits/reference/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md`
2. `docs/audits/DENTALEMON_CURRENT_VS_IDEAL_STANDARD_AUDIT.md`
3. existing schemas/entities/migrations
4. existing local-first or sync-related code if any
5. existing patient, visit, chart, treatment, billing, recall, and treatment plan schemas
6. existing tests and seed data
7. frontend workspace only if needed to avoid breakage

## OLI Process

### O — Observe

Before coding, inspect:

- existing schema conventions
- migration conventions
- patient schema
- visit schema
- chart schema
- treatment schema
- invoice/payment schema
- recall schema if P0-B exists
- treatment plan schema if P0-C exists
- any existing sync/cadence/local-first code
- existing tests
- seed data
- frontend usage of entity IDs

Output before coding:

```md
## Observation Report

| Area | File / Location | Existing Pattern | Notes |
|---|---|---|---|
| Schema conventions |  |  |  |
| Migration conventions |  |  |  |
| Patient schema |  |  |  |
| Visit schema |  |  |  |
| Chart schema |  |  |  |
| Treatment schema |  |  |  |
| Billing schema |  |  |  |
| Recall schema |  |  |  |
| TreatmentPlan schema |  |  |  |
| Existing sync/local code |  |  |  |
| Tests |  |  |  |
| Seed data |  |  |  |
