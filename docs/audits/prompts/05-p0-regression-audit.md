
---

```md
# AUDIT PROMPT — Dentalemon P0 Regression Audit

Use `/oli-execution-gate`.

You are an experienced AI software engineer, QA tester, system architect, and dental workflow auditor.

## Objective

Run a focused P0 regression audit after completing the P0 implementation prompts:

- P0-A PatientContact / Guardian
- P0-B Recall
- P0-C TreatmentPlan Entity + Plan-Level FSM
- P0-D Local-First Sync Metadata Foundation

This is not a full codebase audit from scratch.

This audit verifies whether the original P0 V1-readiness blockers have been resolved, tested, seeded, and documented.

## Required References

Read first:

1. `docs/audits/reference/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md`
2. `docs/audits/DENTALEMON_CURRENT_VS_IDEAL_STANDARD_AUDIT.md`
3. `docs/audits/DENTALEMON_P0_A_PATIENT_CONTACT_IMPLEMENTATION_NOTES.md`
4. `docs/audits/DENTALEMON_P0_B_RECALL_IMPLEMENTATION_NOTES.md`
5. `docs/audits/DENTALEMON_P0_C_TREATMENT_PLAN_FSM_IMPLEMENTATION_NOTES.md`
6. `docs/audits/DENTALEMON_P0_D_LOCAL_FIRST_SYNC_METADATA_IMPLEMENTATION_NOTES.md`
7. actual code, tests, migrations, and seed data

## Scope

Verify only P0 completion.

Do not implement fixes unless explicitly asked.

## Required Verification Areas

### P0-A PatientContact / Guardian

Check:

- schema/entity exists
- handlers/routes exist
- guardian support exists
- emergency contact support exists
- child patient seed scenario exists
- tests exist and pass
- existing patient flows still pass

### P0-B Recall

Check:

- Recall entity exists
- create/list/update/complete/cancel handlers exist
- due/overdue queries exist
- recall can link to patient
- recall can optionally link to visit/treatment if implemented
- due/overdue/completed seed scenarios exist
- tests exist and pass

### P0-C TreatmentPlan FSM

Check:

- top-level TreatmentPlan entity exists
- status FSM exists
- allowed/invalid transitions are tested
- plan approval is tracked
- partially completed behavior works
- all-items-completed behavior works
- treatment item FSM remains compatible
- billing linkage remains intact
- seed states exist

### P0-D Sync Metadata

Check:

- localId support exists
- syncStatus enum exists
- lastSyncAt support exists
- SyncLog or SyncState exists
- metadata exists on intended critical entities
- tests exist
- seed samples exist
- full offline engine was not overbuilt

## Required Output

Create or update:

```txt
docs/audits/DENTALEMON_P0_REGRESSION_AUDIT.md
