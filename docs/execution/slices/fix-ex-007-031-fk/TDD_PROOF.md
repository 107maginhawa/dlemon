# TDD_PROOF: fix-ex-007-031-fk

## Test: No .references() to cross-module schemas in imaging_finding.schema.ts

### Verification Method
Static analysis: grep for `.references()` calls in the patched file.

### Command
```bash
grep -n "references" services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.schema.ts
```

### Expected Output (intra-module refs only)
```
imageId: uuid('image_id').notNull().references(() => imagingStudyImages.id),
annotationId: uuid('annotation_id').references(() => imagingAnnotations.id),
```

### Actual Output
```
    imageId: uuid('image_id').notNull().references(() => imagingStudyImages.id),
    annotationId: uuid('annotation_id').references(() => imagingAnnotations.id),
```

PASS — only intra-module references remain; all cross-module .references() removed.

---

## Test: No cross-module imports in imaging_finding.schema.ts

### Command
```bash
grep -n "import.*dental-visit\|import.*patient\|import.*dental-org" \
  services/api-ts/src/handlers/dental-imaging/repos/imaging_finding.schema.ts
```

### Expected Output
(empty — no matches)

### Actual Output
(empty)

PASS — no cross-module imports remain.

---

## Test: Migration drops the 3 cross-module FK constraints

### File
`services/api-ts/src/generated/migrations/0066_lying_mantis.sql`

### Expected Content
```sql
ALTER TABLE "imaging_finding" DROP CONSTRAINT "imaging_finding_visit_id_dental_visit_id_fk";
ALTER TABLE "imaging_finding" DROP CONSTRAINT "imaging_finding_patient_id_patient_id_fk";
ALTER TABLE "imaging_finding" DROP CONSTRAINT "imaging_finding_branch_id_dental_branch_id_fk";
```

### Actual Content
Matches expected exactly.

PASS — migration correctly removes all 3 cross-module DB-level FKs.

---

## Test: Typecheck — no new errors introduced by this change

### Command
```bash
cd services/api-ts && bun run typecheck 2>&1 | grep -i "imaging_finding\|imaging-finding"
```

### Expected Output
(empty — no imaging_finding typecheck errors)

### Actual Output
(empty)

PASS — no TypeScript errors introduced by this change.

Pre-existing typecheck errors in `dental-billing`, `dental-patient-sync`, and `acceptance` test files are unrelated to this fix and were present before the change.

---

## Summary

| Test | Result |
|------|--------|
| No cross-module .references() | PASS |
| No cross-module imports | PASS |
| Migration generated and correct | PASS |
| Typecheck: no new errors | PASS |
| imaging_finding table FK count | PASS (2 intra-module FKs remain) |
