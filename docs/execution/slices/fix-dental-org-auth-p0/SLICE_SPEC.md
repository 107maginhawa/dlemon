# SLICE_SPEC: fix-dental-org-auth-p0

**Slice ID**: fix-dental-org-auth-p0  
**Date**: 2026-05-29  
**Status**: IN PROGRESS  
**Priority**: P0 — All findings are critical authorization/IDOR vulnerabilities

---

## Problem Statement

Six P0 authentication and IDOR vulnerabilities in the `dental-org` handler module allow
unauthenticated or cross-tenant access to protected resources.

---

## Findings

### EF-ORG-001 — DentalBranchManagement_create: No org ownership check
- **File**: `services/api-ts/src/handlers/dental-org/DentalBranchManagement_create.ts`
- **Route**: `POST /dental/organizations/{orgId}/branches/`
- **Bug**: Caller is authenticated but not verified as owner of `orgId`. Any authenticated
  user can add branches to any organization.
- **Fix**: Load org by `orgId`, verify `org.ownerPersonId === user.id`, throw 403 otherwise.

### EF-ORG-002 — DentalBranchManagement_list: No org-scoping check
- **File**: `services/api-ts/src/handlers/dental-org/DentalBranchManagement_list.ts`
- **Route**: `GET /dental/organizations/{orgId}/branches/`
- **Bug**: Any authenticated user can list branches of any organization.
- **Fix**: Verify caller is either org owner OR has an active membership in any branch of that
  org before returning the list.

### EF-ORG-003 — createMember: Missing dentist_owner role check
- **File**: `services/api-ts/src/handlers/dental-org/createMember.ts`
- **Route**: `POST /dental/org/members?branchId=...`
- **Bug**: `assertBranchAccess` only checks that the caller is an active branch member.
  Any role (even `read_only`) can invite new staff, which should be restricted to
  `dentist_owner` only.
- **Fix**: After `assertBranchAccess`, call `assertBranchRole(db, user.id, resolvedBranchId, ['dentist_owner'])`.

### EF-ORG-004 — DentalMembershipManagement_deactivate: Any member can deactivate owner
- **File**: `services/api-ts/src/handlers/dental-org/DentalMembershipManagement_deactivate.ts`
- **Route**: `POST /dental/organizations/{orgId}/branches/{branchId}/members/{membershipId}/deactivate`
- **Bug**: The current guard allows any branch member to deactivate any other member,
  including the `dentist_owner`. The org owner check (`org.ownerPersonId === user.id`)
  correctly bypasses the branch check for owners, but does not prevent a non-owner from
  deactivating the owner membership. Only `dentist_owner` role members should be allowed
  to deactivate other members, and nobody should deactivate the sole `dentist_owner`.
- **Fix**: Replace the fallback `assertBranchAccess` with `assertBranchRole(..., ['dentist_owner'])`.
  Additionally, prevent deactivating a `dentist_owner` membership unless the caller IS the
  org owner (org-level owner supersedes branch check).

### EM-ORG-001 — recoverPin route: Missing authMiddleware
- **File**: `services/api-ts/src/generated/openapi/routes.ts`
- **Route**: `POST /dental/org/members/:memberId/recover-pin`
- **Bug**: Route is registered without `authMiddleware` at line 767. The handler itself
  correctly calls `throw new UnauthorizedError(...)` when `user` is absent, but the
  middleware layer (session parsing) is never invoked, so `ctx.get('user')` will always
  be `undefined` — making the 401 check a tautology rather than true auth enforcement.
  An attacker bypasses the middleware token validation entirely.
- **Fix**: The route is generated (do not edit routes.ts). Override the route in `app.ts`
  with `authMiddleware({ roles: ['user'] })` before calling `registerOpenAPIRoutes`, so
  the manual registration shadows the generated one.

### EM-ORG-006 — DentalOrganizationManagement_get: IDOR on GET /dental/organizations/:id
- **File**: `services/api-ts/src/handlers/dental-org/DentalOrganizationManagement_get.ts`
- **Route**: `GET /dental/organizations/:id`
- **Bug**: Any authenticated user can read any organization's data by supplying its ID.
  No ownership or membership verification is performed.
- **Fix**: After loading the org, verify caller is the org owner OR has an active membership
  in any branch belonging to that org. Throw 403 otherwise.

---

## Test Plan (RED → GREEN)

Tests written in: `services/api-ts/src/handlers/dental-org/dental-org-auth-p0.test.ts`

| Test | Issue | Expected |
|------|-------|----------|
| Non-owner adds branch to foreign org | EF-ORG-001 | 403 |
| Org owner adds branch to own org | EF-ORG-001 | 201 |
| Non-member lists branches of foreign org | EF-ORG-002 | 403 |
| Org owner lists their own branches | EF-ORG-002 | 200 |
| read_only member invites new staff | EF-ORG-003 | 403 |
| dentist_owner invites new staff | EF-ORG-003 | 201 |
| Non-owner deactivates dentist_owner | EF-ORG-004 | 403 |
| dentist_owner deactivates staff_full | EF-ORG-004 | 200 |
| Unauthenticated recoverPin | EM-ORG-001 | 401 |
| Authenticated recoverPin (baseline) | EM-ORG-001 | 200 (or 401 if no security Q) |
| Non-member reads foreign org | EM-ORG-006 | 403 |
| Org member reads own org | EM-ORG-006 | 200 |

---

## Files Changed

| File | Change |
|------|--------|
| `services/api-ts/src/handlers/dental-org/DentalBranchManagement_create.ts` | Add org ownership check |
| `services/api-ts/src/handlers/dental-org/DentalBranchManagement_list.ts` | Add org membership/ownership check |
| `services/api-ts/src/handlers/dental-org/createMember.ts` | Replace assertBranchAccess with assertBranchRole(['dentist_owner']) |
| `services/api-ts/src/handlers/dental-org/DentalMembershipManagement_deactivate.ts` | Require dentist_owner to deactivate; guard against deactivating the only owner |
| `services/api-ts/src/app.ts` | Shadow recoverPin route with authMiddleware |
| `services/api-ts/src/handlers/dental-org/DentalOrganizationManagement_get.ts` | Add ownership/membership check |
| `services/api-ts/src/handlers/dental-org/dental-org-auth-p0.test.ts` | NEW — failing tests for all 6 issues |
