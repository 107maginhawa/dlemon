# SLICE_SPEC — Wave 2 dental-org P1 Structural Fixes

<!-- Wave: Wave 2 | Module: dental-org | Date: 2026-05-29 -->

## Scope

Fixable P1 structural findings for the `dental-org` module, executed in Wave 2
of the structural remediation plan.

---

## Findings

### EF-ORG-006 — verifyPin tests: canonical handler imports (FIXED)

**Status:** FIXED  
**Commit:** `f81f9c0c`

**Problem:** `verifyPin.test.ts` imported from legacy `verifyPin.ts` and
`setPin.ts` aliases, not from the canonical handlers wired in the generated
registry (`DentalMembershipManagement_verifyPin.ts` /
`DentalMembershipManagement_setPin.ts`). Tests therefore exercised code that was
NOT in the production route stack, missing any divergence that could occur between
the two files.

**Fix:** Updated both imports in `verifyPin.test.ts`:

```ts
// Before (legacy aliases — not in registry)
import { DentalMembershipManagement_verifyPin } from '@/handlers/dental-org/verifyPin';
import { DentalMembershipManagement_setPin } from '@/handlers/dental-org/setPin';

// After (canonical — wired via generated/openapi/registry.ts)
import { DentalMembershipManagement_verifyPin } from '@/handlers/dental-org/DentalMembershipManagement_verifyPin';
import { DentalMembershipManagement_setPin } from '@/handlers/dental-org/DentalMembershipManagement_setPin';
```

**Files changed:**
- `services/api-ts/src/handlers/dental-org/verifyPin.test.ts`

---

### EF-ORG-007 — org membership guard on DentalOrganizationManagement_get (ALREADY RESOLVED)

**Status:** ALREADY RESOLVED (pre-existing; confirmed and documented)

**Analysis:** `DentalOrganizationManagement_get.ts` already contains the
ownership/membership guard per EM-ORG-006 requirements:

```ts
// EM-ORG-006: Caller must be the org owner or an active member of any branch in this org
if (org.ownerPersonId !== user.id) {
  const [membership] = await db
    .select({ id: dentalMemberships.id })
    .from(dentalMemberships)
    .innerJoin(dentalBranches, eq(dentalMemberships.branchId, dentalBranches.id))
    .where(and(
      eq(dentalBranches.organizationId, id),
      eq(dentalMemberships.personId, user.id),
      eq(dentalMemberships.status, 'active'),
    ))
    .limit(1);

  if (!membership) {
    throw new ForbiddenError('You do not have access to this organization');
  }
}
```

Tests covering this guard exist in
`services/api-ts/src/handlers/dental-org/dental-org-auth-p0.test.ts` under
`describe('EM-ORG-006 DentalOrganizationManagement_get — ownership/membership check')`:
- non-member reads foreign org → 403
- org owner reads own org → 200
- org member reads own org → 200
- unauthenticated → 401

No code changes were required. This finding is fully resolved.

---

### EF-ORG-008 — F2 service-layer sprint (BLOCKED)

**Status:** BLOCKED — do NOT fix in this wave

**Reason:** EF-ORG-008 is a service-layer / DI extraction sprint (EM-ORG-014:
`getBranchesByUser.ts`, `branchSettings.ts`, `consentTemplates.ts` contain inline
Drizzle outside the repository pattern). This is a Phase 2 (F2) architectural
concern requiring its own sprint and migration risk assessment.

**Resolution path:** Address in the dedicated F2 service-layer sprint after MVP
milestone ships. Do not touch until that sprint is scoped.

---

### EF-ORG-009 — remove legacy handler duplicates (FIXED)

**Status:** FIXED  
**Commit:** `f81f9c0c` (same commit as EF-ORG-006)

**Problem:** Two legacy handler files existed alongside the canonical
`DentalMembership*` handlers with identical implementations:

| Legacy file | Canonical file | Registry uses |
|------------|---------------|--------------|
| `verifyPin.ts` | `DentalMembershipManagement_verifyPin.ts` | canonical |
| `setPin.ts` | `DentalMembershipManagement_setPin.ts` | canonical |

The legacy files were full duplicates — same exports, same logic — except
`DentalMembershipManagement_setPin.ts` additionally calls `logAuditEvent` for
EM-AUD-005, making the legacy `setPin.ts` slightly behind. Only consumer of the
legacy files was `verifyPin.test.ts` (fixed in EF-ORG-006).

**Safety check:**
- `generated/openapi/registry.ts` imports exclusively from canonical files
- `grep` confirmed zero other imports of `verifyPin.ts` / `setPin.ts`
- 211 dental-org tests pass after deletion

**Files deleted:**
- `services/api-ts/src/handlers/dental-org/verifyPin.ts`
- `services/api-ts/src/handlers/dental-org/setPin.ts`

---

## Quality Gates

| Gate | Result |
|------|--------|
| `verifyPin.test.ts` (12 tests) | 12 pass, 0 fail |
| `dental-org/` full suite (211 tests) | 211 pass, 0 fail |
| Zero new imports of deleted files | confirmed |
| typecheck pre-existing errors unchanged | confirmed (0 new errors introduced) |
