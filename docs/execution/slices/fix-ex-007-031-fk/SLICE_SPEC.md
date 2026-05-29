# SLICE_SPEC: fix-ex-007-031-fk

## Findings
- **EX-007** (P0): `imaging_finding.schema.ts` imports `patients` from `../../patient/repos/patient.schema` and uses `.references()` — hard DB FK to cross-module table.
- **EX-031** (P0): `imaging_finding.schema.ts` imports `dentalVisits` and `dentalBranches` from sibling modules and uses `.references()` — two additional hard DB FKs to cross-module tables.

## Problem
`dental-imaging` module had 3 cross-module DB-level foreign keys in `imaging_finding.schema.ts`:
- `patientId` → `patients.id` (patient module)
- `visitId` → `dentalVisits.id` (dental-visit module)
- `branchId` → `dentalBranches.id` (dental-org module)

This contradicts the loose-coupling rule established in `imaging.schema.ts` where all cross-module UUIDs are bare columns with no `.references()`.

## Fix Applied

### File: `services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.schema.ts`

1. Removed 3 cross-module imports:
   - `import { dentalVisits } from '../../dental-visit/repos/visit.schema'`
   - `import { patients } from '../../patient/repos/patient.schema'`
   - `import { dentalBranches } from '../../dental-org/repos/branch.schema'`

2. Changed 3 FK columns to bare `uuid()` with loose-coupling comment:
   - `visitId`: removed `.references(() => dentalVisits.id)`, added comment
   - `patientId`: removed `.references(() => patients.id)`, added comment
   - `branchId`: removed `.references(() => dentalBranches.id)`, added comment

3. `treatmentId` was already a bare UUID (no change needed).

4. Intra-module `.references()` (to `imagingStudyImages.id` and `imagingAnnotations.id`) are unchanged and correct.

### File: `services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.repo.ts`

No changes required. The repo already used UUID-matching queries with no cross-module joins.

### Migration: `src/generated/migrations/0066_lying_mantis.sql`

Generated migration drops the 3 cross-module FK constraints:
```sql
ALTER TABLE "imaging_finding" DROP CONSTRAINT "imaging_finding_visit_id_dental_visit_id_fk";
ALTER TABLE "imaging_finding" DROP CONSTRAINT "imaging_finding_patient_id_patient_id_fk";
ALTER TABLE "imaging_finding" DROP CONSTRAINT "imaging_finding_branch_id_dental_branch_id_fk";
```

## Reference Pattern
`imaging.schema.ts` loose-coupling comments used as canonical pattern:
```typescript
// loose-coupling: cross-module UUID ref, no DB-level FK to avoid coupling dental-imaging to patient module
patientId: uuid('patient_id').notNull(),
```
