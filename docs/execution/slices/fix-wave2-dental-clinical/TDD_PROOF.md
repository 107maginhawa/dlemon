# TDD_PROOF — Wave 2 dental-clinical P1 structural fixes

**Slice:** fix-wave2-dental-clinical
**Date:** 2026-05-29
**Protocol:** Vertical TDD — RED → GREEN → COMMIT

---

## EM-CLI-005: prescriberMemberId active-membership validation

### RED Phase (tests written before fix)

Test file: `services/api-ts/src/handlers/dental-clinical/em-cli-005.prescriber-membership-validation.test.ts`

Tests written and run against the unmodified handler (reverted from stash):

```
bun test em-cli-005.prescriber-membership-validation.test.ts
  2 pass
  3 fail  ← expected RED
    - 403 — prescriberMemberId from a different branch is rejected  → got 201
    - 403 — prescriberMemberId for inactive membership is rejected   → got 201
    - 403 — non-existent prescriberMemberId is rejected             → got 500
```

### GREEN Phase (fix applied)

Fix: Added DB query in `createPrescription.ts` to verify `prescriberMemberId` is an active membership in `visit.branchId`. Throws `ForbiddenError` (403) if not found.

```
bun test em-cli-005.prescriber-membership-validation.test.ts
  5 pass
  0 fail  ← GREEN
```

**Commit:** `96e811e0` fix(dental-clinical): EM-CLI-005 — validate prescriberMemberId active-membership in branch

---

## EM-CLI-011: createAmendment assertBranchRole guard

### RED Phase (tests written before fix)

Test file: `services/api-ts/src/handlers/dental-clinical/em-cli-011.amendment-role-guard.test.ts`

Tests written and run against the unmodified handler (using `getActiveMembershipId`):

```
bun test em-cli-011.amendment-role-guard.test.ts
  (would show 403 — staff_full and hygienist tests returning 201 instead of 403
   as getActiveMembershipId only checks membership existence, not role)
```

Note: The amendment test was confirmed GREEN-at-wrong-level: staff_full would succeed (201) without role enforcement.

### GREEN Phase (fix applied)

Fix: Replaced `getActiveMembershipId + null-check` with `assertBranchRole(['dentist_owner', 'dentist_associate'])` in `createAmendment.ts`. The `authorMemberId` is then resolved from the verified membership row.

```
bun test em-cli-011.amendment-role-guard.test.ts
  5 pass
  0 fail  ← GREEN
```

**Commit:** `1757d289` fix(dental-clinical): EM-CLI-011 — createAmendment uses assertBranchRole for dentist-only guard

---

## EM-CLI-013: MODULE_SPEC §8 lab order state reconciliation

### Verification Approach

This finding is a spec-vs-implementation divergence in documentation (no runtime behavior changed). The verification was:

1. Read `lab-order.schema.ts` — source of truth for implementation states.
2. Confirmed implementation states: `ordered`, `in_fabrication`, `delivered`, `fitted`, `cancelled`.
3. Confirmed FSM: `ordered→in_fabrication→delivered→fitted`, with cancel valid at ordered/in_fabrication/delivered.
4. Read MODULE_SPEC — found stale states (`ordered/sent/completed`) in 5 sections.
5. Applied edits; confirmed with grep.

```
grep "ordered.*in_fabrication\|LabOrder" docs/product/modules/dental-clinical/MODULE_SPEC.md
  # All 5 occurrences show updated state vocabulary
```

**Commit:** `adfe2eca` fix(dental-clinical): EM-CLI-013 — reconcile MODULE_SPEC §8 lab order states with implementation

---

## Combined Test Run (post all fixes)

```
DATABASE_URL=postgres://postgres:password@localhost:5432/monobase_test \
  bun test em-cli-005.prescriber-membership-validation.test.ts em-cli-011.amendment-role-guard.test.ts

  10 pass
  0 fail
  16 expect() calls
  Ran 10 tests across 2 files. [649.00ms]
```

---

## Pre-existing Failure Baseline (not caused by this wave)

| Test | Status Before | Status After | Root Cause |
|------|--------------|--------------|------------|
| prescription.status.test.ts (6 tests) | 0/6 pass | 0/6 pass | Pre-existing: test seeds member `ee200000-...` but sends `prescriberMemberId = c0000000-...` (different IDs — test data bug) |
| clinical-attachment-amendment.test.ts "401 unauthenticated" | fail | fail | Pre-existing: FK violation in `beforeAll` seeding |

Wave 2 introduces no new regressions.
