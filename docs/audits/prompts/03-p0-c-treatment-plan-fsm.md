
---

```md
# IMPLEMENTATION PROMPT — Dentalemon P0-C TreatmentPlan Entity + Plan-Level FSM

Use `/oli-execution-gate`.

You are an experienced AI software engineer, QA tester, database architect, product architect, and dental workflow analyst.

## Objective

Implement the third P0 V1-readiness foundation item for Dentalemon:

`TreatmentPlan Entity + Plan-Level FSM`

This addresses the audit gap that Dentalemon currently appears to infer plan state from treatment item statuses and/or treatment plan versions, but does not have a clear top-level live `TreatmentPlan` entity with explicit plan-level status.

Do not implement PatientContact, Recall, Sync Metadata, Roles, Queue, Inventory, Claims, or frontend redesign in this prompt.

This prompt is only for TreatmentPlan entity and plan-level status FSM.

## Required References

Read first:

1. `docs/audits/reference/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md`
2. `docs/audits/DENTALEMON_CURRENT_VS_IDEAL_STANDARD_AUDIT.md`
3. existing dental treatment schema
4. existing treatment plan version schema
5. existing visit/treatment handlers
6. existing billing integration
7. existing tests and seed data
8. existing frontend treatment plan/workspace UI only if needed to avoid breakage

## OLI Process

### O — Observe

Before coding, inspect:

- `dental_treatment` schema/entity
- `treatment_plan_version` schema/entity
- treatment FSM tests
- treatment handlers
- accept/present treatment plan handlers if present
- invoice creation from treatments
- patient treatment plan view
- frontend treatment table/workspace usage in `/apps/dentalemon`
- seed data for treatment plans
- existing audit/logging patterns

Output before coding:

```md
## Observation Report

| Area | File / Location | Existing Pattern | Notes |
|---|---|---|---|
| Treatment schema |  |  |  |
| Treatment plan version schema |  |  |  |
| Treatment handlers |  |  |  |
| Plan approval handlers |  |  |  |
| Billing linkage |  |  |  |
| Tests |  |  |  |
| Seed data |  |  |  |
| Frontend usage |  |  |  |
