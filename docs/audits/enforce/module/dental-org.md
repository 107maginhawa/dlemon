<!-- oli-enforce-module: dental-org -->
<!-- reviewed: 2026-05-27 (run-2, PIN handler batch) | depth: deep | reviewer: claude-sonnet-4-6 -->

# Enforcement Audit: dental-org

**Reviewed:** 2026-05-27 (run-1) + 2026-05-27 (run-2: PIN handler batch delta)  
**Depth:** deep (cross-file, call-chain analysis)  
**Spec:** `docs/product/modules/dental-org/MODULE_SPEC.md` v1.0  
**API Contracts:** `docs/product/modules/dental-org/API_CONTRACTS.md`  
**Status:** ISSUES FOUND — 6 Critical (P0), 9 Warnings (P1), 5 Info

**Run-2 delta (PIN handler batch, 2026-05-27):**
- NEW CR-05 (P0): `DentalMembershipManagement_setPin` route registered without `authMiddleware`
- NEW CR-06 (P0): `DentalMembershipManagement_verifyPin` route registered without `authMiddleware`
- KNOWN CR-01..CR-04, WR-01..WR-09: unchanged — no fixes landed in this batch

---

## Summary

The dental-org module implements multi-tenant org/branch/membership management with PIN-based local auth. Core spec coverage is solid: `assertBranchAccess` is present on all clinical data endpoints, PIN lockout logic exists, and credential fields are stripped from most responses.

**Four categories of defect were found:**

1. **Critical security (route-level auth absent)** — Three PIN routes are registered without `authMiddleware`: `recoverPin` (line 767), `DentalMembershipManagement_setPin` (line 857), `DentalMembershipManagement_verifyPin` (line 865). All three silently 401 every caller because the handler-level user check fires on `undefined`. The fix is a security pre-condition — once `authMiddleware` is added the handler logic executes correctly.
2. **Authorization gaps** — `setPin` allows any branch member to change any other member's PIN (no ownership or role check, both `setPin.ts` and facade); `DentalOrganizationManagement_update` allows any authenticated user to update any org; `deactivateMember`/`DentalMembershipManagement_deactivate` have no `dentist_owner` role gate.
3. **Credential leak** — `listMembers.ts` (legacy flat handler, GET /dental/org/members) strips `pinHash` but exposes `securityAnswerHash` and `securityQuestion`. The canonical `DentalMembershipManagement_list` facade already strips all three fields correctly.
4. **Handler duplication** — `setPin.ts` and `DentalMembershipManagement_setPin.ts` both export the same function name. `verifyPin.ts` has `trackLastLogin`; the facade does not. Routes use facades — FR6.4 last-login tracking silently absent at the nested path.

---

## Critical Issues

### CR-01: recoverPin route registered without authMiddleware — unauthenticated PIN reset

**File:** `services/api-ts/src/generated/openapi/routes.ts:767`  
**Issue:** The route for `POST /dental/org/members/:memberId/recover-pin` has no `authMiddleware()` call:

```ts
app.post('/dental/org/members/:memberId/recover-pin',
  zValidator('param', validators.RecoverPinParams, validationErrorHandler),
  zValidator('json', validators.RecoverPinBody, validationErrorHandler),
  registry.recoverPin as unknown as Handler   // ← no authMiddleware
);
```

The handler itself checks `if (!user?.id) throw new UnauthorizedError(...)` — but without `authMiddleware`, `ctx.get('user')` is `undefined` on every request, making the check always reject. **This means the route currently 401s all callers, but the fix (adding authMiddleware) is a security pre-condition** — without it the route is either always broken or, if `authMiddleware` is conditionally skipped in some environments, unauthenticated PIN reset becomes exploitable.

The implementation comment explicitly states: *"CF-39/AUTH-03: recoverPin MUST be authenticated… An unauthenticated endpoint would allow any internet attacker to brute-force the security question."* The route registration contradicts this.

Compare: every adjacent route (`resetMemberPin`, `setSecurityQuestion`) has `authMiddleware({ roles: ["user"] })`.

**Fix:**
```ts
app.post('/dental/org/members/:memberId/recover-pin',
  authMiddleware({ roles: ["user"] }),   // ← ADD THIS
  zValidator('param', validators.RecoverPinParams, validationErrorHandler),
  zValidator('json', validators.RecoverPinBody, validationErrorHandler),
  registry.recoverPin as unknown as Handler
);
```

---

### CR-02: setPin allows any branch member to change any other member's PIN (privilege escalation)

**File:** `services/api-ts/src/handlers/dental-org/setPin.ts:42` and `DentalMembershipManagement_setPin.ts:35`  
**Issue:** Both `setPin` handler files call `assertBranchAccess(db, user.id, member.branchId)` which only verifies the caller is *a member of the same branch* — it does not verify the caller is the membership owner or a `dentist_owner`. Any `staff_full` or `staff_scheduling` member can call `POST .../members/{otherMemberId}/set-pin` to set any colleague's PIN to a value of their choice, then use it to impersonate that colleague.

Per spec §6 and BR-016: only `dentist_owner` should be able to mutate another member's PIN. The self-service flow (member sets own PIN) should require `user.id == member.personId`.

**Fix:**
```ts
// After assertBranchAccess, add:
const isSelf = member.personId === user.id;
if (!isSelf) {
  const [callerMembership] = await db
    .select({ role: dentalMemberships.role })
    .from(dentalMemberships)
    .where(and(
      eq(dentalMemberships.personId, user.id),
      eq(dentalMemberships.branchId, member.branchId),
      eq(dentalMemberships.status, 'active'),
    )).limit(1);
  if (callerMembership?.role !== 'dentist_owner') {
    throw new ForbiddenError('Only the member themselves or a dentist_owner can set a PIN');
  }
}
```
Apply the same fix to both `setPin.ts` and `DentalMembershipManagement_setPin.ts`.

---

### CR-03: listMembers exposes securityAnswerHash and securityQuestion to all branch members

**File:** `services/api-ts/src/handlers/dental-org/listMembers.ts:37`  
**Issue:** The `GET /dental/org/members` endpoint strips only `pinHash` from each member record, but returns `securityAnswerHash` and `securityQuestion` in the response body. Any authenticated branch member (including `staff_scheduling`) can enumerate the full member list and obtain every colleague's bcrypt-hashed security answer.

```ts
const safeItems = allItems.map(({ pinHash, ...rest }) => rest);
// securityAnswerHash and securityQuestion remain in `rest`
```

The canonical `DentalMembershipManagement_list` handler at line 42 correctly strips all three fields — the `listMembers` legacy handler missed the same fix applied there.

**Fix:**
```ts
const safeItems = allItems.map(
  ({ pinHash: _ph, securityAnswerHash: _sah, securityQuestion: _sq, ...rest }) => rest
);
```

---

### CR-04: DentalOrganizationManagement_update has no ownership check — any authenticated user can update any org

**File:** `services/api-ts/src/handlers/dental-org/DentalOrganizationManagement_update.ts:27`  
**Issue:** `PATCH /dental/organizations/:id` fetches the org by `id` from params (not by `user.id`) and calls `repo.updateOne(id, body)` without verifying that the authenticated user is the `ownerPersonId` of that organization. Any authenticated session can modify another tenant's org name, tier, country code, or imagingTier.

```ts
const org = await repo.updateOne(id, body as Partial<NewDentalOrganization>);
// No: org.ownerPersonId === user.id check
```

**Fix:**
```ts
const org = await repo.findOneById(id);
if (!org) throw new NotFoundError('Organization');
if (org.ownerPersonId !== user.id) throw new ForbiddenError('Not the organization owner');
const updated = await repo.updateOne(id, body as Partial<NewDentalOrganization>);
return ctx.json(updated);
```

---

## Warnings

### WR-01: Deactivate membership has no dentist_owner role gate — any branch member can deactivate any colleague

**Files:** `services/api-ts/src/handlers/dental-org/DentalMembershipManagement_deactivate.ts:36`, `deactivateMember.ts:27`  
**Issue:** Both deactivate handlers call `assertBranchAccess` (any-member check) with no subsequent role assertion that the caller is a `dentist_owner`. Per spec §6: "Create/edit staff" and by implication deactivation is restricted to `dentist_owner`. A `staff_scheduling` member can deactivate a `dentist_owner`.

**Fix:** Add the same dentist_owner role gate used in `updateMember.ts:44-56` after `assertBranchAccess`.

---

### WR-02: recordFailedPinAttempt is a non-atomic read-modify-write — lockout bypassable under concurrent requests

**File:** `services/api-ts/src/handlers/dental-org/repos/membership.repo.ts:95-113`  
**Issue:** `recordFailedPinAttempt` does:
1. `SELECT` the current attempt count
2. Compute `attempts = current + 1`
3. `UPDATE SET pinFailedAttempts = attempts`

Two concurrent wrong-PIN requests will both read the same value, both compute `current + 1`, and both write the same incremented value — effectively counting one attempt as two, or more critically, both attempts could be below the lockout threshold when they should have triggered it.

**Fix:** Use a SQL atomic increment:
```ts
const [updated] = await this.db
  .update(dentalMemberships)
  .set({
    pinFailedAttempts: sql`${dentalMemberships.pinFailedAttempts} + 1`,
    updatedAt: new Date(),
  })
  .where(eq(dentalMemberships.id, id))
  .returning();
// Then apply lockout based on updated.pinFailedAttempts
```

---

### WR-03: createMember has no dentist_owner role gate — any branch member can add new staff

**File:** `services/api-ts/src/handlers/dental-org/createMember.ts:54`  
**Issue:** `POST /dental/org/members` calls `assertBranchAccess` (branch-member check) but has no check that the caller is a `dentist_owner`. Per spec §6: "Create/edit staff" is restricted to `dentist_owner`. A `staff_scheduling` member can add new `dentist_owner` memberships to the branch.

**Fix:** After `assertBranchAccess`, add a role check:
```ts
const [callerMembership] = await db
  .select({ role: dentalMemberships.role }).from(dentalMemberships)
  .where(and(eq(dentalMemberships.personId, user.id), eq(dentalMemberships.branchId, resolvedBranchId), eq(dentalMemberships.status, 'active')))
  .limit(1);
if (callerMembership?.role !== 'dentist_owner') {
  throw new ForbiddenError('Only dentist_owner can add staff members');
}
```

---

### WR-04: DentalBranchManagement_create has no ownership check — any authenticated user can create branches under any org

**File:** `services/api-ts/src/handlers/dental-org/DentalBranchManagement_create.ts:26`  
**Issue:** `POST /dental/organizations/:orgId/branches` creates a branch under `orgId` without verifying that `user.id` is the `ownerPersonId` of that org. Any authenticated user can add branches to a competitor's organization.

**Fix:** Fetch the org and assert `org.ownerPersonId === user.id` before calling `repo.createOne`.

---

### WR-05: DentalOrganizationManagement_get has no ownership/membership check — any authenticated user can read any org

**File:** `services/api-ts/src/handlers/dental-org/DentalOrganizationManagement_get.ts:25`  
**Issue:** `GET /dental/organizations/:id` returns the full org record (including `ownerPersonId`, `tier`, `imagingTier`) to any authenticated session without verifying the caller is the owner or a member of a branch in that org. This is an IDOR on the organization resource.

**Fix:** Assert `org.ownerPersonId === user.id` or verify an active membership in any branch of this org.

---

### WR-06: updateMember response leaks securityAnswerHash

**File:** `services/api-ts/src/handlers/dental-org/updateMember.ts:67`  
**Issue:** `PATCH /dental/org/members/:memberId` strips `pinHash` from the response but not `securityAnswerHash` or `securityQuestion`:

```ts
const { pinHash, ...safeResponse } = updated;
return ctx.json(safeResponse);
```

`securityAnswerHash` (bcrypt hash of the security answer) and `securityQuestion` remain in the response.

**Fix:**
```ts
const { pinHash: _ph, securityAnswerHash: _sah, securityQuestion: _sq, ...safeResponse } = updated;
```

---

### WR-07: Membership status enum mismatch between spec and schema

**Files:** `services/api-ts/src/handlers/dental-org/repos/membership.schema.ts:22`, `docs/product/modules/dental-org/API_CONTRACTS.md:117`  
**Issue:** The spec (MODULE_SPEC.md §8) and API contract define three member statuses: `invited`, `active`, `inactive`. The schema defines only `active` and `inactive` (the `invited` state is absent from the pgEnum). The WF-004 (staff invitation) workflow requires `invited` as a stable state during the invitation → acceptance transition. Without it, invitations cannot be distinguished from active members.

**Fix:** Add `invited` to `memberStatusEnum`:
```ts
export const memberStatusEnum = pgEnum('member_status', ['active', 'inactive', 'invited']);
```

---

### WR-08: Duplicate handler files for setPin and verifyPin — divergence risk

**Files:** `services/api-ts/src/handlers/dental-org/setPin.ts` vs `DentalMembershipManagement_setPin.ts`; `verifyPin.ts` vs `DentalMembershipManagement_verifyPin.ts`  
**Issue:** Two functionally-identical handler files exist for each operation. The generated routes use `DentalMembershipManagement_*` variants. The plain `setPin.ts`/`verifyPin.ts` files are used by tests (`verifyPin.test.ts` imports from `verifyPin.ts`). The `DentalMembershipManagement_verifyPin.ts` variant does not call `repo.trackLastLogin` (present in `verifyPin.ts:64`) — so the deployed route silently skips FR6.4 last-login tracking.

**Fix:** Remove `setPin.ts` and `verifyPin.ts`; tests should import from `DentalMembershipManagement_setPin.ts` / `DentalMembershipManagement_verifyPin.ts`. Add `trackLastLogin` to the `DentalMembershipManagement_verifyPin` handler.

---

### WR-09: recoverPin lockout check uses stale pre-request member state

**File:** `services/api-ts/src/handlers/dental-org/pinRecovery.ts:83`  
**Issue:** `recoverPin` reads `member` before processing the answer, then checks `repo.isLockedOut(member)` on that snapshot. If the lockout was set by a concurrent request in the same millisecond, the check passes on stale data. While narrow, this is the same issue as WR-02 and more serious here because the handler then resets attempts on success — a concurrent lockout event would be cleared.

---

### CR-05: DentalMembershipManagement_setPin route registered without authMiddleware — unauthenticated PIN set

**File:** `services/api-ts/src/generated/openapi/routes.ts:857`  
**Status:** NEW (run-2, 2026-05-27)  
**Issue:** The route for `POST /dental/organizations/:orgId/branches/:branchId/members/:membershipId/set-pin` has no `authMiddleware()`:

```ts
app.post('/dental/organizations/:orgId/branches/:branchId/members/:membershipId/set-pin',
  zValidator('param', validators.DentalMembershipManagement_setPinParams, validationErrorHandler),
  zValidator('json', validators.DentalMembershipManagement_setPinBody, validationErrorHandler),
  registry.DentalMembershipManagement_setPin as unknown as Handler  // ← no authMiddleware
);
```

The handler checks `if (!user?.id) throw new UnauthorizedError(...)` but without `authMiddleware`, `ctx.get('user')` is always `undefined`, so the check always rejects. The endpoint currently 401s every caller. Once authMiddleware is added (the correct fix), the privilege escalation in CR-02 is exposed — both fixes must be applied together.

**Fix:**
```ts
app.post('/dental/organizations/:orgId/branches/:branchId/members/:membershipId/set-pin',
  authMiddleware({ roles: ["user"] }),   // ← ADD THIS
  zValidator('param', validators.DentalMembershipManagement_setPinParams, validationErrorHandler),
  zValidator('json', validators.DentalMembershipManagement_setPinBody, validationErrorHandler),
  registry.DentalMembershipManagement_setPin as unknown as Handler
);
```
Apply CR-02 ownership fix simultaneously.

---

### CR-06: DentalMembershipManagement_verifyPin route registered without authMiddleware — unauthenticated PIN verification

**File:** `services/api-ts/src/generated/openapi/routes.ts:865`  
**Status:** NEW (run-2, 2026-05-27)  
**Issue:** The route for `POST /dental/organizations/:orgId/branches/:branchId/members/:membershipId/verify-pin` has no `authMiddleware()`:

```ts
app.post('/dental/organizations/:orgId/branches/:branchId/members/:membershipId/verify-pin',
  zValidator('param', validators.DentalMembershipManagement_verifyPinParams, validationErrorHandler),
  zValidator('json', validators.DentalMembershipManagement_verifyPinBody, validationErrorHandler),
  registry.DentalMembershipManagement_verifyPin as unknown as Handler  // ← no authMiddleware
);
```

Same pattern as CR-01 and CR-05. The handler requires `user.id` from context but `authMiddleware` never runs so it always throws `UnauthorizedError`. The route is currently broken (always 401). Compare: the legacy flat `verify-pin` at the old path is not present in routes.ts — this nested path is the canonical route and is entirely non-functional.

**Fix:**
```ts
app.post('/dental/organizations/:orgId/branches/:branchId/members/:membershipId/verify-pin',
  authMiddleware({ roles: ["user"] }),   // ← ADD THIS
  zValidator('param', validators.DentalMembershipManagement_verifyPinParams, validationErrorHandler),
  zValidator('json', validators.DentalMembershipManagement_verifyPinBody, validationErrorHandler),
  registry.DentalMembershipManagement_verifyPin as unknown as Handler
);
```
Also apply WR-08 fix (add `trackLastLogin`) to the facade handler.

---

## Info

### IN-01: ROLE_LABELS in pin-select.tsx only maps four roles; schema has nine

**File:** `apps/dentalemon/src/routes/auth/pin-select.tsx:43`  
**Issue:** `ROLE_LABELS` maps only `dentist_owner`, `dentist_associate`, `staff_full`, `staff_scheduling`. The membership schema defines nine roles (`hygienist`, `dental_assistant`, `front_desk`, `billing_staff`, `read_only`). Members with those roles will display `undefined` as their role label in the profile selection screen.

**Fix:** Add fallback: `ROLE_LABELS[member.role] ?? member.role.replace(/_/g, ' ')`.

---

### IN-02: DentalMembershipManagement_create is marked deprecated but still registered as a live route

**File:** `services/api-ts/src/handlers/dental-org/DentalMembershipManagement_create.ts:1-11`  
**Issue:** The handler is annotated `@deprecated` with a sunset date of 2026-09-01, but the route `POST /dental/organizations/:orgId/branches/:branchId/members` is still registered in `routes.ts:834` with no `Deprecation` warning at the route layer. Clients have no signal to migrate. The deprecation headers added inside the handler (lines 68-73) are correct; the route-level registration should also log a deprecation warning.

---

### IN-03: API contract specifies `org_tier` field in POST /dental/orgs body, implementation uses `tier`

**File:** `services/api-ts/src/handlers/dental-org/createOrganization.ts:26` vs `docs/product/modules/dental-org/API_CONTRACTS.md:28`  
**Issue:** The API contract documents `country_code` and `owner_person_id` as snake_case request fields. The legacy `createOrganization.ts` handler reads `body['countryCode']` and `body['tier']` (camelCase). The canonical `DentalOrganizationManagement_create.ts` uses the generated validator so this is correct, but the legacy handler at `/dental/organizations` (old path) silently accepts different field names.

---

### IN-04: Magic numbers for lockout thresholds should be named constants

**File:** `services/api-ts/src/handlers/dental-org/repos/membership.repo.ts:102-105`  
**Issue:** Lockout thresholds (5 attempts = 30s, 10 attempts = 5min) are magic numbers inline. The MODULE_SPEC BR-016b says "≥N times" (N is unspecified). Named constants would make policy changes auditable.

---

### IN-05: listMembers pagination builds total BEFORE slicing but buildPaginationMeta receives sliced page length

**File:** `services/api-ts/src/handlers/dental-org/listMembers.ts:38-41`  
**Issue:**
```ts
const safeItems = allItems.map(...);
const total = safeItems.length;   // total = all items
const page = safeItems.slice(offset, offset + limit);
return ctx.json({ data: page, pagination: buildPaginationMeta(page, total, limit, offset) });
```
`buildPaginationMeta` receives `page` (the sliced items) as first arg. If its signature is `(items, total, limit, offset)` this is fine, but if it uses `items.length` for anything it will compute wrong. Verify `buildPaginationMeta` ignores `items.length` and uses `total` for page-count calculation. `DentalMembershipManagement_list` (line 44) has the same pattern — consistent, but worth verifying.

---

_Reviewed: 2026-05-27_  
_Reviewer: Claude (gsd-code-reviewer / oli-enforce-module)_  
_Depth: deep_
