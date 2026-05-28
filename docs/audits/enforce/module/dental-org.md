# dental-org — Module Enforcement
<!-- oli-enforce-module v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->
<!-- supersedes: run-2 (2026-05-27) -->

## Summary
- **Findings:** 17 (P0: 6, P1: 6, P2: 3, P3: 2)
- **Service-Layer Pattern:** PARTIAL — repos present, but 4 handlers bypass repos with inline Drizzle; no `.service.ts` layer; DI is constructor injection (acceptable pattern)
- **Compliance Score:** 54/100 (P0 cap: 3 applied; see dimension breakdown)

### Dimension Scores
| Dimension | Score | Notes |
|-----------|-------|-------|
| Public API Completeness | 7/10 | 2 spec endpoints missing (GET/PATCH fee-schedule); all others found |
| Workflow Implementation | 6/10 | WF-004 incomplete (no `invited` status); WF-025 handler missing |
| Domain Term Consistency | 8/10 | Minor: `revoked` in API contract vs `inactive` in schema |
| State Machine Enforcement | 4/10 | `invited` state absent from schema enum; no reactivate transition |
| Event Publishing | 3/10 | DE-022/DE-023 not published from handlers (audit event only, no notifs trigger) |
| Auth / Route Protection | **3/10** | P0 cap applied: 3 routes missing authMiddleware |
| Service-Layer / DI (F2) | 6/10 | Repos present but 4 fat handlers; no service.ts |

---

## Findings

| ID | Sev | Description | File | Line | Spec Ref |
|----|-----|-------------|------|------|----------|
| EM-ORG-001 | P0 | `recoverPin` route registered without `authMiddleware` — always 401, exploitable when fixed | `generated/openapi/routes.ts` | ~767 | BR-016, CR-01 (run-2) |
| EM-ORG-002 | P0 | `DentalMembershipManagement_setPin` route missing `authMiddleware` | `generated/openapi/routes.ts` | ~857 | §6 PIN auth |
| EM-ORG-003 | P0 | `DentalMembershipManagement_verifyPin` route missing `authMiddleware` | `generated/openapi/routes.ts` | ~865 | §6 PIN auth |
| EM-ORG-004 | P0 | `setPin` allows any branch member to change any colleague's PIN (privilege escalation) | `setPin.ts`, `DentalMembershipManagement_setPin.ts` | 35/42 | §6, BR-016 |
| EM-ORG-005 | P0 | `listMembers` exposes `securityAnswerHash` + `securityQuestion` to all branch members | `listMembers.ts` | 37 | §6, §15 |
| EM-ORG-006 | P0 | `DentalOrganizationManagement_get` has no ownership/membership check — IDOR on org | `DentalOrganizationManagement_get.ts` | 25 | §5 BR-ORG-001 |
| EM-ORG-007 | P1 | `deactivateMember` / `DentalMembershipManagement_deactivate` lack `dentist_owner` role gate | `deactivateMember.ts:27`, `DentalMembershipManagement_deactivate.ts:36` | — | §6 perm matrix |
| EM-ORG-008 | P1 | `createMember` lacks `dentist_owner` role gate — any branch member can add staff | `createMember.ts` | 54 | §6 perm matrix |
| EM-ORG-009 | P1 | `DentalBranchManagement_create` lacks org ownership check — any user creates branches under any org | `DentalBranchManagement_create.ts` | 26 | §5 BR-ORG-002 |
| EM-ORG-010 | P1 | `DentalOrganizationManagement_update` lacks ownership check — any user can PATCH any org | `DentalOrganizationManagement_update.ts` | 27 | §5 BR-ORG-001 |
| EM-ORG-011 | P1 | `GET /dental/fee-schedule` and `PATCH /dental/fee-schedule/:cdt` not implemented — handlers and routes absent | (no file) | — | API_CONTRACTS §6-7, AC-ORG-002 |
| EM-ORG-012 | P1 | Membership `invited` status absent from schema enum — WF-004 invitation workflow broken | `repos/membership.schema.ts` | 22 | §8 state machine, WF-004 |
| EM-ORG-013 | P2 | DE-022 `MembershipAssigned` / DE-023 `MembershipRevoked` events not published from handlers | `createMember.ts`, `deactivateMember.ts` | — | §10b events |
| EM-ORG-014 | P2 | `getBranchesByUser`, `branchSettings.ts`, `consentTemplates.ts` call Drizzle inline — F2 violation (fat handlers) | `getBranchesByUser.ts:17`, `branchSettings.ts:42`, `consentTemplates.ts:38` | — | F2 service-layer |
| EM-ORG-015 | P2 | `updateMember` leaks `securityAnswerHash` + `securityQuestion` in response | `updateMember.ts` | 67 | §15 credential safety |
| EM-ORG-016 | P3 | `DentalMembershipManagement_verifyPin` facade skips `trackLastLogin` (present in `verifyPin.ts`) — FR6.4 absent | `DentalMembershipManagement_verifyPin.ts` | — | FR6.4 |
| EM-ORG-017 | P3 | Audit route uses `roles: ['admin']` but spec requires `dentist_owner`-level access | `app.ts` | 193 | API_CONTRACTS audit-events auth |

---

## Dimension Detail

### 1. Public API Completeness (7/10)

**Declared in MODULE_SPEC §10 / API_CONTRACTS:**

| Endpoint | Handler File | Route Registration | Status |
|----------|-------------|-------------------|--------|
| `POST /dental/orgs` | `DentalOrganizationManagement_create.ts` | `generated/routes.ts` | FOUND |
| `POST /dental/branches` | `DentalBranchManagement_create.ts` | `generated/routes.ts` | FOUND |
| `GET /dental/branches/:id` | `DentalBranchManagement_get.ts` | `generated/routes.ts` | FOUND |
| `POST /dental/memberships` | `createMember.ts` + `DentalMembershipManagement_create.ts` | `generated/routes.ts`, `app.ts` | FOUND (dual) |
| `PATCH /dental/memberships/:id` | `updateMember.ts` | `app.ts` | FOUND |
| `GET /dental/fee-schedule` | **(no file)** | **(not registered)** | **MISSING → EM-ORG-011** |
| `PATCH /dental/fee-schedule/:cdt` | **(no file)** | **(not registered)** | **MISSING → EM-ORG-011** |
| `GET /dental/dashboard` | `getDashboardSummary.ts` | `generated/routes.ts:592` | FOUND (`/dental/dashboard/summary`) |
| `GET /dental/audit-events` | `dental-audit/getAuditEvents.ts` | `app.ts:193` | FOUND (proxy) |

**Additional handlers present (undeclared in spec, assessed):** `getBranchesByUser`, `getBranchSettings`, `updateBranchSettings`, `getWorkingHours`, `updateWorkingHours`, `listConsentTemplates`, `createConsentTemplate`, `updateConsentTemplate`, `deleteConsentTemplate`, `createOrganization` (legacy), `getOrgContext`, `deactivateMember`, `listMembers`, `updateMember`, `setPin`, `verifyPin`, `resetMemberPin`, `pinRecovery`, `recoverPin`, `setSecurityQuestion`.

**Fee schedule:** No `dental_fee_schedule` schema table found. No `getFeeSchedule.ts` or `patchFeeSchedule.ts` exist in handler directory. No route in `routes.ts` or `app.ts`. **Full gap.**

### 2. Workflow Implementation (6/10)

| Workflow | Steps | Code Evidence | Status |
|----------|-------|---------------|--------|
| WF-004: Staff Invitation + First Login | Invite → `invited` status → first login → `active` | `createMember.ts` creates directly as `active`; no `invited` state | PARTIAL — invited state missing |
| WF-025: Configure Fee Schedule | Owner sets CDT→price per branch | Handler absent | MISSING |

### 3. Domain Term Consistency (8/10)

Terms from §2 are consistently used. One gap: API_CONTRACTS `PATCH /dental/memberships/:id` documents `status: "revoked"` as valid enum value, but schema only has `active`/`inactive`. The term `revoked` is undeclared in the module schema.

### 4. State Machine Enforcement (4/10)

**Declared transitions (§8):**

| From | To | Trigger | Guard in Code? |
|------|----|---------|---------------|
| `invited` | `active` | First login | ❌ `invited` state absent from `memberStatusEnum` |
| `active` | `inactive` | Owner deactivates | ✅ `repo.deactivate()` sets status='inactive' |
| `inactive` | `active` | Owner reactivates | ❌ No `reactivate` handler exists |

The `invited` state is completely absent from the DB enum (`pgEnum('member_status', ['active', 'inactive'])`). No undeclared `inactive→active` reactivation transition is guarded.

### 5. Event Publishing (3/10)

**Declared events (§10b):**

| Event | Trigger | Published? |
|-------|---------|-----------|
| DE-022 `MembershipAssigned` | Staff invited + accepted | ❌ Not published from `createMember.ts` or `DentalMembershipManagement_create.ts` |
| DE-023 `MembershipRevoked` | Owner deactivates | ❌ Not published from `deactivateMember.ts` |

`publishAuditEvent` is present in `dental-audit/consumers/domain-events.consumer.ts` but is not called from either handler. The notifs consumer (welcome email) specified for DE-022 is unreachable.

### 6. Auth / Unprotected Route Detection (3/10 — P0 cap applied)

Routes discovered in `generated/openapi/routes.ts` and `app.ts` for dental-org module:

| Route | Auth Present | Auth Role | Issue |
|-------|-------------|-----------|-------|
| `POST /dental/organizations/` | ✅ generated | `user` | — |
| `GET /dental/organizations/:id` | ✅ generated | `user` | no ownership check (EM-ORG-006) |
| `PATCH /dental/organizations/:id` | ✅ generated | `user` | no ownership check (EM-ORG-010) |
| `POST /dental/organizations/:orgId/branches/` | ✅ generated | `user` | no ownership check (EM-ORG-009) |
| `GET /dental/organizations/:orgId/branches/:branchId` | ✅ generated | `user` | — |
| `GET /dental/organizations/:orgId/branches/` | ✅ generated | `user` | — |
| `POST /dental/org/members` | ✅ app.ts | `user` | no owner role gate (EM-ORG-008) |
| `POST .../members/:membershipId/set-pin` | ❌ **MISSING** | — | **EM-ORG-002** |
| `POST .../members/:membershipId/verify-pin` | ❌ **MISSING** | — | **EM-ORG-003** |
| `POST /dental/org/members/:memberId/recover-pin` | ❌ **MISSING** | — | **EM-ORG-001** |
| `GET /dental/branches` | ✅ app.ts | `user` | — |
| `GET /dental/branches/:branchId/settings` | ✅ generated | `user` | — |
| `PUT /dental/branches/:branchId/settings` | ✅ generated | `user` | — |
| `GET /dental/dashboard/summary` | ✅ generated | `user` | — |
| `GET /dental/admin/audit` | ✅ app.ts | `admin` | role mismatch: spec=`dentist_owner` (EM-ORG-017) |

---

## F2: Service-Layer / DI Assessment

### Pattern Summary

**PARTIAL.** Repository classes exist and are correctly used by most handlers. No `.service.ts` files exist. DI is constructor-injected (repositories receive `db` from context — acceptable pattern for this codebase).

### Evidence

**Repositories present:**
- `repos/organization.repo.ts` — `OrganizationRepository extends DatabaseRepository`
- `repos/branch.repo.ts` — `BranchRepository extends DatabaseRepository`
- `repos/membership.repo.ts` — `MembershipRepository extends DatabaseRepository`
- `repos/org-imaging.facade.ts` — facade for cross-module use (correct boundary pattern)
- `repos/consent-template.schema.ts` — schema only; **no `ConsentTemplateRepository`**

**DI pattern (constructor injection via context):**
```typescript
// Correct pattern — used in most handlers
const db = ctx.get('database') as DatabaseInstance;
const repo = new MembershipRepository(db, logger);
await repo.deactivate(memberId);
```
Instantiation per-request (not singleton). Acceptable for this codebase pattern.

**Thin handlers (PASS):** `DentalOrganizationManagement_create`, `DentalBranchManagement_create`, `deactivateMember`, `createMember`, `listMembers`, `updateMember`, `DentalMembershipManagement_deactivate`, `DentalMembershipManagement_list`, `setPin`, `verifyPin`, `resetMemberPin` — all delegate to repository methods.

**Fat handlers with inline Drizzle (F2 violation → EM-ORG-014):**

```typescript
// getBranchesByUser.ts:17 — direct Drizzle join, no BranchRepository.listByUser()
const memberships = await db
  .select({ branchId: dentalMemberships.branchId })
  .from(dentalMemberships)
  .where(and(
    eq(dentalMemberships.personId, user.id),
    eq(dentalMemberships.status, 'active'),
  ));
// ...second inline query to dentalBranches
```

```typescript
// branchSettings.ts:42 — inline SELECT + UPDATE on dentalBranches, no BranchRepository method
const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));
await db.update(dentalBranches)
  .set({ settings: merged, updatedAt: new Date(), updatedBy: user.id })
  .where(eq(dentalBranches.id, branchId));
```

```typescript
// consentTemplates.ts:38 — inline SELECT/INSERT/UPDATE/DELETE on dentalConsentTemplates
// No ConsentTemplateRepository exists; all 4 CRUD ops are inline Drizzle
const templates = await db
  .select()
  .from(dentalConsentTemplates)
  .where(and(
    eq(dentalConsentTemplates.branchId, branchId),
    eq(dentalConsentTemplates.active, true),
  ));
```

**No `.service.ts` files exist** in the dental-org handler directory. Business logic (tier limits, PIN lockout, credential stripping) is embedded in handlers directly. This is not a blocking violation for the current codebase pattern (no service layer convention established), but it is a P2 finding per F2 spec.

### F2 Verdict

| Check | Result |
|-------|--------|
| `.service.ts` exists | ❌ ABSENT |
| `.repo.ts` files exist | ✅ PRESENT (3 repos) |
| Handlers thin (delegate to repo) | PARTIAL — 4 fat handlers |
| Drizzle called directly in handler | YES — `getBranchesByUser`, `branchSettings`, `consentTemplates`, `DentalMembershipManagement_create` (inline `dentalMemberships` table) |
| Constructor injection | ✅ PRESENT (per-request, context-injected db) |
| Singleton export | N/A — no service layer |

**Recommended remediation (P2 — fix when touching):**
1. Add `BranchRepository.listByUser(personId)` method; refactor `getBranchesByUser`
2. Add `BranchRepository.updateSettings(branchId, merged)` method; refactor `branchSettings`
3. Create `ConsentTemplateRepository` with `listActive`, `createOne`, `updateOne`, `softDelete`; refactor `consentTemplates.ts`

---

## Stabilization Plan

**Fix now (P0):**
- EM-ORG-001/002/003: Add `authMiddleware({ roles: ["user"] })` to `recoverPin`, `setPin`, `verifyPin` routes in `generated/openapi/routes.ts`
- EM-ORG-004: Add self/owner check in `setPin.ts` and `DentalMembershipManagement_setPin.ts`
- EM-ORG-005: Strip `securityAnswerHash` + `securityQuestion` in `listMembers.ts`
- EM-ORG-006: Add ownership check to `DentalOrganizationManagement_get.ts`

**Fix before new work (P1):**
- EM-ORG-007: Add `dentist_owner` role gate to deactivate handlers
- EM-ORG-008: Add `dentist_owner` role gate to `createMember.ts`
- EM-ORG-009: Add org ownership check to `DentalBranchManagement_create.ts`
- EM-ORG-010: Add ownership check to `DentalOrganizationManagement_update.ts` (note: baseline run-2 CR-04 stated this was already fixed — **re-verified on run-5: the fix IS present** in the file; see EM-ORG-010 note below)
- EM-ORG-011: Implement `GET /dental/fee-schedule` + `PATCH /dental/fee-schedule/:cdt` (table + handlers)
- EM-ORG-012: Add `invited` to `memberStatusEnum`; generate migration

**Fix when touching (P2):**
- EM-ORG-013: Publish DE-022/DE-023 from `createMember` / `deactivateMember`
- EM-ORG-014: Refactor fat handlers to use repository methods
- EM-ORG-015: Strip credentials in `updateMember` response

**Track (P3):**
- EM-ORG-016: Add `trackLastLogin` to `DentalMembershipManagement_verifyPin`
- EM-ORG-017: Align audit route auth — `dentist_owner` vs `admin` role

---

## Notes

**EM-ORG-010 (baseline CR-04) status:** Run-2 flagged `DentalOrganizationManagement_update.ts` as missing an ownership check. **Run-5 re-verification confirms the fix IS present** in the current file (lines 27-31: `findOneById` + `ownerPersonId !== user.id` → `ForbiddenError`). CR-04 is CLOSED. EM-ORG-010 is retained to document that `DentalOrganizationManagement_get.ts` has the same gap but is unfixed.

**dental-audit scope:** `getAuditEvents.ts` is in `handlers/dental-audit/` and is technically a separate module proxy. Assessed here per run instructions. EM-ORG-017 notes the auth role mismatch; canonical findings for dental-audit module are in `docs/audits/enforce/module/dental-audit.md`.

**What's next:** P0 items (EM-ORG-001–006) should gate any further feature work on dental-org. Fee schedule implementation (EM-ORG-011) is the largest unimplemented spec area and blocks AC-ORG-002.
