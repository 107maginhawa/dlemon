# IMPLEMENTATION PROMPT — Dentalemon P0-A PatientContact / Guardian

Use `/oli-execution-gate`.

You are an experienced AI software engineer, QA tester, database architect, and dental workflow analyst.

## Objective

Implement the first P0 V1-readiness foundation item for Dentalemon:

`PatientContact / Guardian`

This addresses the audit gap that minor patient guardian support is missing or unclear, and that there is no dedicated `PatientContact` / guardian entity.

Do not implement Recall, TreatmentPlan FSM, Sync Metadata, Roles, Queue, Inventory, Claims, or frontend redesign in this prompt.

This prompt is only for PatientContact / Guardian.

## Required References

Read first:

1. `docs/audits/reference/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md`
2. `docs/audits/DENTALEMON_CURRENT_VS_IDEAL_STANDARD_AUDIT.md`
3. existing patient schemas, handlers, routes, tests, and seed data
4. existing frontend patient profile/workspace only if needed to avoid breakage

## OLI Process

### O — Observe

Before coding, inspect:

- patient schema/entity
- dental patient handlers
- patient route registration
- patient tests
- seed data
- patient frontend usage in `/apps/dentalemon`
- existing validation patterns
- existing soft-delete/archive patterns
- existing audit/logging patterns

Output before coding:

```md
## Observation Report

| Area | File / Location | Existing Pattern | Notes |
|---|---|---|---|
| Patient schema |  |  |  |
| Patient handlers |  |  |  |
| Route registration |  |  |  |
| Tests |  |  |  |
| Seed data |  |  |  |
| Frontend usage |  |  |  |
