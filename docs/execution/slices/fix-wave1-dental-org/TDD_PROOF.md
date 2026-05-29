# TDD_PROOF — Wave 1 dental-org P2/P3 Mechanical Fixes

## Summary

4 fixes executed: EF-ORG-011, EF-ORG-012, EF-ORG-013 (tests added), EF-ORG-014 (review only — no code change needed).

---

## EF-ORG-011: dentist_owner enforcement tests for createMember

**File:** `services/api-ts/src/handlers/dental-org/createMember.test.ts`

**Change:** Added 2 tests verifying that non-`dentist_owner` callers receive 403.

Tests added:
- `returns 403 when caller is not dentist_owner (staff_full role)`
- `returns 403 when caller is dentist_associate (not owner)`

**Result:** 8/8 pass (6 pre-existing + 2 new)

**Commit:** `66097a79`

---

## EF-ORG-012: Tests for DentalBranchManagement_create/list

**Files created:**
- `services/api-ts/src/handlers/dental-org/DentalBranchManagement_create.test.ts`
- `services/api-ts/src/handlers/dental-org/DentalBranchManagement_list.test.ts`

**DentalBranchManagement_create tests (7):**
- 401 unauthenticated
- 403 non-owner caller
- 404 org not found
- 400 name missing
- 400 timezone missing
- 201 success with full response validation
- Branch org isolation (listByOrg returns only this org's branches)

**DentalBranchManagement_list tests (7):**
- 401 unauthenticated
- 404 org not found
- 403 caller has no membership and is not owner
- 403 caller has only inactive membership
- 200 for org owner
- 200 for active branch member (EF-ORG-002 coverage)
- Cross-org isolation (only requested org's branches returned)

**Result:** 7/7 pass each file

**Commits:** `7b0e1c59`, `57cef953` (UUID fix)

---

## EF-ORG-013: Non-owner deactivate tests

**File:** `services/api-ts/src/handlers/dental-org/deactivateMember.test.ts`

**Change:** Added 2 tests verifying non-owners receive 403.

Tests added:
- `returns 403 when caller is not dentist_owner (staff_full role)`
- `returns 403 when caller has no membership in the branch`

**Result:** 6/6 pass (4 pre-existing + 2 new)

**Commit:** `f02a70dc`

---

## EF-ORG-014: Branch isolation review — getOrgContext / getBranchesByUser

**No code change required.** Both handlers have adequate isolation:

**`getOrgContext`:**
- `orgRepo.findMany({ ownerPersonId: user.id })` — scoped to caller
- `branchRepo.listByOrg(org.id)` — scoped to caller's own org
- Member search: `members.find(m => m.personId === user.id)` — correctly filters to caller only
- Finding: ADEQUATE. No cross-user data leak possible.

**`getBranchesByUser`:**
- First query: `personId = user.id AND status = 'active'` — scoped to caller's active memberships only
- Second query: `inArray(dentalBranches.id, branchIds)` — bounded to branch IDs from first query
- Finding: ADEQUATE. Isolation chain is sound; no cross-user leak possible.

**Existing test coverage:** `getBranchesByUser.test.ts` covers 401, empty list for no-membership user, active branch return, and inactive membership exclusion — all isolation cases verified.

---

## Test Run Summary

| Fix | Tests Added | Pass | Fail |
|-----|-------------|------|------|
| EF-ORG-011 | 2 | 8 total | 0 |
| EF-ORG-012 create | 7 | 7 | 0 |
| EF-ORG-012 list | 7 | 7 | 0 |
| EF-ORG-013 | 2 | 6 total | 0 |
| EF-ORG-014 | 0 (review) | — | — |
