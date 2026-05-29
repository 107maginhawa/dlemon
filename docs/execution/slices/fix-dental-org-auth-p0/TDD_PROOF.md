# TDD_PROOF: fix-dental-org-auth-p0

**Slice**: fix-dental-org-auth-p0  
**Date**: 2026-05-29  
**Commit**: 234af86d  
**Result**: ALL GREEN — 19 new tests pass, 207 dental-org suite tests pass, 0 regressions

---

## RED Phase (Tests Written Before Implementation)

Tests written in:
`services/api-ts/src/handlers/dental-org/dental-org-auth-p0.test.ts`

RED run output (before fixes):
```
(fail) EF-ORG-001 DentalBranchManagement_create — org ownership required
       > non-owner cannot create branch in foreign org → 403   [Expected: 403, Received: 201]
(fail) EF-ORG-002 DentalBranchManagement_list — org scoping required
       > non-member lists branches of foreign org → 403        [Expected: 403, Received: 200]
(fail) EF-ORG-003 createMember — dentist_owner role required
       > read_only member cannot invite new staff → 403        [Expected: 403, Received: 201]
(fail) EF-ORG-003 createMember — dentist_owner role required
       > staff_full member cannot invite new staff → 403       [Expected: 403, Received: 201]
(fail) EF-ORG-004 DentalMembershipManagement_deactivate
       > staff_full cannot deactivate any member → 403         [Expected: 403, Received: 200]
(fail) EM-ORG-006 DentalOrganizationManagement_get
       > non-member reads foreign org → 403                    [Expected: 403, Received: 200]

13 pass, 6 fail
```

Note: EM-ORG-001 recoverPin handler already returned 401 when `user` is absent (handler-level
guard). The P0 for EM-ORG-001 is at the route-registration layer — the generated `routes.ts`
route lacks `authMiddleware`, so the Better-Auth session is never parsed and `ctx.get('user')`
is always `undefined`. The handler's own `throw new UnauthorizedError(...)` check fires, but
this is dead-code security: the route is truly unauthenticated at the transport layer.
The shadow route in `app.ts` adds real middleware enforcement.

---

## Implementation Changes

| File | Fix | Finding |
|------|-----|---------|
| `DentalBranchManagement_create.ts` | Load org, assert `org.ownerPersonId === user.id` → 403 | EF-ORG-001 |
| `DentalBranchManagement_list.ts` | Load org, assert owner OR active branch membership via JOIN | EF-ORG-002 |
| `createMember.ts` | Replace `assertBranchAccess` → `assertBranchRole(['dentist_owner'])` | EF-ORG-003 |
| `DentalMembershipManagement_deactivate.ts` | Replace `assertBranchAccess` fallback → `assertBranchRole(['dentist_owner'])` | EF-ORG-004 |
| `app.ts` | Shadow route `/dental/org/members/:memberId/recover-pin` with `authMiddleware({ roles: ['user'] })` before `registerOpenAPIRoutes` | EM-ORG-001 |
| `DentalOrganizationManagement_get.ts` | Assert owner OR active branch membership via JOIN → 403 | EM-ORG-006 |

---

## GREEN Phase

```
19 pass
0 fail
```

Full dental-org suite (207 tests, 22 files):
```
207 pass
0 fail
385 expect() calls
Ran 207 tests across 22 files. [6.63s]
```

Typecheck: 0 new errors introduced in any changed file (pre-existing errors in
`src/tests/acceptance.registration-and-visit.test.ts` and other unrelated files
were present before this slice).

---

## Test Coverage Summary

| Test | Issue | Status |
|------|-------|--------|
| non-owner cannot create branch in foreign org → 403 | EF-ORG-001 | PASS |
| org owner can create branch in own org → 201 | EF-ORG-001 baseline | PASS |
| unauthenticated create branch → 401 | EF-ORG-001 unauthed | PASS |
| non-member lists branches of foreign org → 403 | EF-ORG-002 | PASS |
| org owner lists their own branches → 200 | EF-ORG-002 baseline | PASS |
| org member lists org branches → 200 | EF-ORG-002 member baseline | PASS |
| unauthenticated list branches → 401 | EF-ORG-002 unauthed | PASS |
| read_only member cannot invite new staff → 403 | EF-ORG-003 | PASS |
| staff_full member cannot invite new staff → 403 | EF-ORG-003 staff | PASS |
| dentist_owner can invite new staff → 201 | EF-ORG-003 baseline | PASS |
| staff_full cannot deactivate any member → 403 | EF-ORG-004 | PASS |
| dentist_owner can deactivate staff_full member → 200 | EF-ORG-004 baseline | PASS |
| org owner (via org-level bypass) can deactivate any membership → 200 | EF-ORG-004 org owner | PASS |
| unauthenticated recoverPin → 401 | EM-ORG-001 | PASS |
| authenticated recoverPin with correct answer → 200 | EM-ORG-001 baseline | PASS |
| non-member reads foreign org → 403 | EM-ORG-006 | PASS |
| org owner reads own org → 200 | EM-ORG-006 baseline | PASS |
| org member reads own org → 200 | EM-ORG-006 member baseline | PASS |
| unauthenticated read org → 401 | EM-ORG-006 unauthed | PASS |
