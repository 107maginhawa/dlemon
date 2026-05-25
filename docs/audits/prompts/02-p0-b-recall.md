
---

```md
# IMPLEMENTATION PROMPT — Dentalemon P0-B Recall

Use `/oli-execution-gate`.

You are an experienced AI software engineer, QA tester, database architect, and dental workflow analyst.

## Objective

Implement the second P0 V1-readiness foundation item for Dentalemon:

`Recall`

This addresses the audit gap that Dentalemon does not yet have a formal Recall entity/handler, even though recall scheduling is V1 Required in the ideal standard.

Do not implement PatientContact, TreatmentPlan FSM, Sync Metadata, Roles, Queue, Inventory, Claims, or frontend redesign in this prompt.

This prompt is only for Recall.

## Required References

Read first:

1. `docs/audits/reference/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md`
2. `docs/audits/DENTALEMON_CURRENT_VS_IDEAL_STANDARD_AUDIT.md`
3. existing scheduling, patient, visit, treatment, billing, tests, and seed data
4. existing frontend patient workspace only if needed to avoid breakage

## OLI Process

### O — Observe

Before coding, inspect:

- scheduling schema/entity
- patient schema/entity
- visit schema/entity
- treatment schema/entity
- existing follow-up notes
- dental scheduling handlers
- patient handlers
- route registration
- existing tests
- seed data
- frontend patient workspace/appointment usage in `/apps/dentalemon`
- existing validation patterns
- existing soft-delete/archive/cancel patterns
- existing audit/logging patterns

Output before coding:

```md
## Observation Report

| Area | File / Location | Existing Pattern | Notes |
|---|---|---|---|
| Scheduling schema |  |  |  |
| Patient schema |  |  |  |
| Follow-up notes |  |  |  |
| Visit/treatment links |  |  |  |
| Handlers |  |  |  |
| Route registration |  |  |  |
| Tests |  |  |  |
| Seed data |  |  |  |
| Frontend usage |  |  |  |
