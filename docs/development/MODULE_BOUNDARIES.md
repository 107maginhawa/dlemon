# Module Boundary Rules — Backend Handler Modules

## The Rule

A handler file in `handlers/{A}/` must not import from `handlers/{B}/repos/` unless `B = "shared"`.

The `shared/` module is the only legitimate cross-cutting hub — it provides auth utilities (`assertBranchAccess`, `assertBranchRole`) that need to query dental-org data directly.

## Rationale

Without this rule, all handler modules become one tangled ball of schema. The consequence is:
- A bug in `patient.schema` breaks `dental-billing`, `dental-patient`, `dental-scheduling`, `dental-clinical`, and more — silently.
- Refactoring any schema requires auditing every module.
- Fan-in on `dental-patient/repos/patient.schema` is 65 — any change is high-risk.

## Enforcement

Run the boundary checker:
```bash
cd services/api-ts
bun run check:boundaries          # warn mode (current: 99 violations in migration)
bun run check:boundaries:error    # error mode (add to CI after migration completes)
```

## Migration Pattern: Expose a Facade

Instead of module A reaching into module B's repo, module B exposes a purpose-built query:

**Before (violation):**
```typescript
// dental-billing/getDentalInvoice.ts
import { patients } from '@/handlers/patient/repos/patient.schema';

const patient = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
```

**After (correct):**
```typescript
// dental-patient/repos/patient.facade.ts  ← new file in module B
export async function getPatientNameForInvoice(db: DatabaseInstance, patientId: string) {
  return db.select({ name: patients.name, dob: patients.dateOfBirth })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
}

// dental-billing/getDentalInvoice.ts
import { getPatientNameForInvoice } from '@/handlers/dental-patient/repos/patient.facade';
```

The facade:
- Returns only what the caller needs (narrow type, no schema leak).
- Lives in the owning module's `repos/` dir — it is that module's public API surface.
- Is unit-testable in isolation.

## Migration Priority (by violation count)

| Module | Violations | Priority |
|--------|-----------|---------|
| `dental-imaging` | 30 | 1 (most violations) |
| `dental-patient` | 26 | 2 |
| `dental-billing` | 11 | 3 |
| `dental-org` | 6 | 4 |
| `dental-visit` | 6 | 4 |
| `dental-scheduling` | 6 | 4 |
| `dental-clinical` | 6 | 4 |
| `dental-pmd` | 7 | 5 |
| `dental-perio` | 1 | 6 |

Once a module reaches 0 violations, flip `check:boundaries:error` on for that module by adding a module-specific CI check.

## Current Status

Baseline captured: **99 violations** (2026-05-27, after Phase 5 merger).
Target: **0 violations** — each module migrated one PR at a time.

## Exempt Modules

- `shared/` — cross-cutting hub, may import from any module's repos. It provides the auth assertion utilities that all handlers depend on.
