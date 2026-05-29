# TDD_PROOF: EM-CLI-012 — Prescription Status FSM

## Summary

Finding EM-CLI-012 (P0): prescription schema was missing a `status` field. MODULE_SPEC §7 requires three states: `pending`, `dispensed`, `cancelled` with FSM enforcement.

## RED Phase

Test file written before implementation:
`services/api-ts/src/handlers/dental-clinical/prescription.status.test.ts`

RED results (before schema/repo/handler changes):
- 6 tests defined, 6 FAIL with HTTP 500 (column `status` did not exist in DB)

## GREEN Phase

### Changes Made

**1. Schema** — `services/api-ts/src/handlers/dental-clinical/repos/prescription.schema.ts`
- Added `pgEnum('prescription_status', ['pending', 'dispensed', 'cancelled'])`
- Added `status` column: `prescriptionStatusEnum('status').notNull().default('pending')`
- Exported `VALID_PRESCRIPTION_STATUSES`, `PrescriptionStatus`, `PRESCRIPTION_TRANSITIONS`

**2. Repository** — `services/api-ts/src/handlers/dental-clinical/repos/prescription.repo.ts`
- Added `updateStatus(id, newStatus): Promise<{ prescription, error? }>` with FSM guard
- Added `status` filter to `PrescriptionFilters` and `buildWhereConditions`

**3. Handler** — `services/api-ts/src/handlers/dental-clinical/prescriptions/updatePrescription.ts`
- Reads `status` from raw JSON body via `ctx.req.json()` (Hono caches it; generated zValidator strips unknown fields)
- Validates against `VALID_PRESCRIPTION_STATUSES`
- Calls `repo.updateStatus()` → throws `BusinessLogicError` (422, code `INVALID_PRESCRIPTION_TRANSITION`) on invalid transition

**4. Migration** — `services/api-ts/src/generated/migrations/0065_wild_bloodaxe.sql`
```sql
CREATE TYPE "public"."prescription_status" AS ENUM('pending', 'dispensed', 'cancelled');
ALTER TABLE "prescription" ADD COLUMN "status" "prescription_status" DEFAULT 'pending' NOT NULL;
```

## Test Results

### New FSM tests (`prescription.status.test.ts`)

```
6 pass
0 fail
```

| Test | Result |
|------|--------|
| createPrescription returns status=pending | PASS |
| pending → dispensed returns 200 with status=dispensed | PASS |
| pending → cancelled returns 200 with status=cancelled | PASS |
| dispensed → dispensed (self-loop) returns 422 | PASS |
| dispensed → pending (backward) returns 422 | PASS |
| cancelled → cancelled (terminal self-loop) returns 422 | PASS |

### Regression check (`clinical-prescription-history.test.ts`)

```
24 pass (all prescription tests, all updateMedicalHistoryEntry 405-gate tests)
6 fail (pre-existing medical-history failures — unrelated to this change)
```

Pre-existing failures confirmed by `git stash` reverification: same 6 tests failing before this change, all in `createMedicalHistoryEntry`/`listMedicalHistory` suites.

### Combined

```
30 pass
6 fail (all pre-existing, none introduced by this change)
Ran 36 tests across 2 files.
```

## Typecheck

No new TypeScript errors introduced in `dental-clinical` module. Confirmed by:
```
bun run typecheck 2>&1 | grep "error TS" | grep "dental-clinical\|prescription"
# → (no output)
```

## FSM Transition Table

| From | To | Valid |
|------|----|-------|
| pending | dispensed | YES |
| pending | cancelled | YES |
| dispensed | (any) | NO — terminal |
| cancelled | (any) | NO — terminal |

## Acceptance Criteria

- [x] `prescription` table has `status` enum column with `pending` default
- [x] `PrescriptionRepository.updateStatus()` guards invalid transitions
- [x] `updatePrescription` handler returns 422 on invalid FSM transition
- [x] All 6 FSM test cases pass
- [x] `bun run db:generate` produced migration `0065_wild_bloodaxe.sql`
- [x] `bun run typecheck` — zero new errors in dental-clinical module
- [x] No regressions in `clinical-prescription-history.test.ts`
