# SLICE_SPEC: EM-CLI-012 — Prescription Status FSM

## Finding

**ID**: EM-CLI-012 (P0)
**Module**: dental-clinical
**Description**: `prescription` schema is missing a `status` field. MODULE_SPEC §7 requires a three-state FSM: `pending → dispensed | cancelled`.

## Scope

| File | Change |
|------|--------|
| `services/api-ts/src/handlers/dental-clinical/repos/prescription.schema.ts` | Add `prescriptionStatusEnum` pgEnum + `status` column (default `pending`) |
| `services/api-ts/src/handlers/dental-clinical/repos/prescription.repo.ts` | Add `updateStatus()` method with FSM guard |
| `services/api-ts/src/handlers/dental-clinical/prescriptions/updatePrescription.ts` | Enforce FSM on `status` field in PATCH body |

## FSM Definition

```
pending ──→ dispensed   (terminal)
pending ──→ cancelled   (terminal)
dispensed ──→ (none)    terminal
cancelled ──→ (none)    terminal
```

- New prescriptions always start at `pending`
- Only `pending → dispensed` and `pending → cancelled` are valid transitions
- Invalid transition → HTTP 422 `INVALID_PRESCRIPTION_TRANSITION`

## Implementation Steps

1. **Schema** (`prescription.schema.ts`):
   - Import `pgEnum` from `drizzle-orm/pg-core`
   - Add `export const prescriptionStatusEnum = pgEnum('prescription_status', ['pending', 'dispensed', 'cancelled'])`
   - Add `status: prescriptionStatusEnum('status').notNull().default('pending')` to `prescriptions` table
   - Export `VALID_PRESCRIPTION_STATUSES`, `PrescriptionStatus`, `PRESCRIPTION_TRANSITIONS`

2. **Repository** (`prescription.repo.ts`):
   - Import FSM exports from schema
   - Add `updateStatus(id, newStatus)` method mirroring `LabOrderRepository.updateStatus` pattern
   - Returns `{ prescription: Prescription | null; error?: string }` — error string on invalid transition

3. **Handler** (`updatePrescription.ts`):
   - Parse `status` from raw request body (generated validator doesn't include it)
   - If `status` present: call `repo.updateStatus()`, throw `BusinessLogicError` (422) on error
   - If no `status`: delegate to existing field update path unchanged

4. **Migration**:
   ```bash
   cd /Users/eladventures/Desktop/dentalemon/services/api-ts && bun run db:generate
   ```

## Tests (TDD — RED before GREEN)

New test file: `services/api-ts/src/handlers/dental-clinical/prescription.status.test.ts`

| Test | Expected |
|------|----------|
| New prescription defaults to `pending` | `status === 'pending'` in create response |
| PATCH `status: dispensed` from `pending` | 200, `status === 'dispensed'` |
| PATCH `status: cancelled` from `pending` | 200, `status === 'cancelled'` |
| PATCH `status: dispensed` from `dispensed` (terminal) | 422 |
| PATCH `status: pending` from `dispensed` (backward) | 422 |
| PATCH `status: cancelled` from `cancelled` (terminal) | 422 |

## Acceptance Criteria

- [ ] `prescription` table has `status` enum column with `pending` default
- [ ] `PrescriptionRepository.updateStatus()` guards invalid transitions
- [ ] `updatePrescription` handler returns 422 on invalid FSM transition
- [ ] All 6 FSM test cases pass
- [ ] `bun run db:generate` produces migration without errors
- [ ] `bun run typecheck` passes with zero errors
- [ ] No regressions in `clinical-prescription-history.test.ts`

## Commit Message

```
fix(dental-clinical): EM-CLI-012 — add prescription status FSM (pending/dispensed/cancelled)
```
