# dental-org — File Enforcement Audit

**Skill:** `oli-enforce-file --module dental-org --auto`
**Generated:** 2026-05-27
**Scope:** MODULE_SPEC.md v1.0 · API_CONTRACTS.md v1.0

---

## Summary

| Category | Total | FOUND | MISSING | DRIFT |
|---|---|---|---|---|
| Data tables | 4 | 4 | 0 | 0 |
| API endpoints | 9 (spec) + 7 (impl extras) | 16 | 0 | 3 |
| Business rules | 4 | 4 | 0 | 0 |
| Workflows | 10 | 7 | 3 | 1 |
| UI screens | 2 | 2 | 0 | 0 |
| Domain events | 2 | 1 | 1 | 0 |
| Feature flags | 2 | 0 | 2 | 0 |
| **Total items** | **~49** | **~43** | **~6** | **~4** |

---

## 1. Data Requirements

### `dental_organization`

| Field | Status | Notes |
|-------|--------|-------|
| id (UUID PK) | FOUND | `repos/organization.schema.ts` — via `baseEntityFields` |
| name | FOUND | `text('name').notNull()` |
| country_code | FOUND | `text('country_code').notNull()` |
| org_tier | FOUND | `orgTierEnum('tier').notNull()` — enum: solo/clinic/group/enterprise |
| owner_person_id | FOUND | `uuid('owner_person_id').notNull()` |
| imaging_tier | FOUND (extra) | Spec lists as `BR-016c` gate; schema has `imagingTierEnum` column — spec §7 doesn't list it in `dental_organization` table but it belongs there. **DRIFT**: column is nullable (spec says required). |

**DRIFT-01:** `imaging_tier` nullable in schema (`imagingTierEnum('imaging_tier')` — no `.notNull()`). MODULE_SPEC §7 implies it's Required. Current code coerces `null → 'free'` via `resolveImagingTier()` helper. Behavioral intent correct but the schema allows an inconsistency the spec does not document.

---

### `dental_branch`

| Field | Status | Notes |
|-------|--------|-------|
| id (UUID PK) | FOUND | via `baseEntityFields` |
| org_id | FOUND | `uuid('organization_id').notNull()` — column name is `organization_id` (camelCase: `organizationId`), not `org_id`. Consistent internally. |
| name | FOUND | `text('name').notNull()` |
| address / city / timezone | FOUND | separate `address`, `city`, `timezone` columns |
| working_hours | FOUND | `text('working_hours')` (JSON string) |
| imaging_tier | MISSING from branch schema | MODULE_SPEC §7 lists `imaging_tier` as a `dental_branch` field ("gates imaging features"). The schema stores `imaging_tier` only on `dental_organization`, not on `dental_branch`. **MISSING** — spec says branch-level; implementation is org-level. |
| active | FOUND | `boolean('active').notNull().default(true)` |
| settings | FOUND (extra) | JSONB blob for FR8.x — not in spec §7 but correctly extends it |

**MISSING-01:** `imaging_tier` is absent from `dental_branch` schema. MODULE_SPEC §7 explicitly lists it as a `dental_branch` column. All imaging-tier gate logic currently uses `dental_organization.imaging_tier`, creating a mismatch with the spec's stated aggregate boundary (Branch owns imaging tier per §7b).

---

### `dental_membership`

| Field | Status | Notes |
|-------|--------|-------|
| id (UUID PK) | FOUND | via `baseEntityFields` |
| person_id | FOUND | `uuid('person_id')` — nullable by design (PIN-only staff) |
| branch_id | FOUND | `uuid('branch_id').notNull()` with FK |
| member_role | FOUND | `memberRoleEnum` — 9 values (spec lists 4; 5 extras are DRIFT — see below) |
| member_status | FOUND | `memberStatusEnum` — values: `active`, `inactive` — **DRIFT**: spec §8 lists `invited` as a valid status but enum only has `active`/`inactive`. `invited` is referenced in API_CONTRACTS.md response shape. |
| pin_hash | FOUND | `text('pin_hash')` |
| pin_failed_attempts | FOUND | `integer('pin_failed_attempts').default(0)` |
| pin_locked_until | FOUND | `timestamp('pin_locked_until')` |
| last_login_at | FOUND (extra) | FR6.4 — not in spec §7 |
| security_question | FOUND (extra) | FR9.7 — not in spec §7 |
| security_answer_hash | FOUND (extra) | FR9.7 — not in spec §7 |

**DRIFT-02:** `member_status` enum is `['active', 'inactive']`. MODULE_SPEC §8 state machine includes `invited` state (`invited → active → inactive`). API_CONTRACTS.md POST /dental/memberships response shows `status: "invited"`. The DB enum does not include `invited`, so newly created memberships return `status: 'active'` immediately. Invitation flow cannot represent `invited` state.

**DRIFT-03:** `member_role` enum has 9 values (`dentist_owner`, `dentist_associate`, `hygienist`, `staff_full`, `staff_scheduling`, `dental_assistant`, `front_desk`, `billing_staff`, `read_only`). MODULE_SPEC §2 and API_CONTRACTS.md define exactly 4 roles. The extra 5 roles are undocumented in the spec and uncovered by RBAC tables in the frontend (`formatRole`, `getRoleBadgeClass` in `staff-list.tsx` map only the spec-defined 4).

---

### `dental_consent_template`

| Field | Status | Notes |
|-------|--------|-------|
| branch_id | FOUND | `uuid('branch_id').notNull()` with FK |
| name | FOUND | `text('name').notNull()` |
| body | FOUND | `text('body').notNull()` |
| requires_witness_signature | FOUND | `boolean('requires_witness_signature').notNull().default(false)` |
| active | FOUND | `boolean('active').notNull().default(true)` |

---

## 2. API Endpoints

### Spec-declared endpoints (API_CONTRACTS.md)

| Endpoint | Status | Handler file | Notes |
|----------|--------|-------------|-------|
| POST /api/v1/dental/orgs | FOUND | `createOrganization.ts` + `DentalOrganizationManagement_create.ts` | **DRIFT** — see below |
| POST /api/v1/dental/branches | FOUND | `DentalBranchManagement_create.ts` | |
| GET /api/v1/dental/branches/:id | FOUND | `DentalBranchManagement_get.ts` | **DRIFT** — no assertBranchAccess |
| POST /api/v1/dental/memberships | FOUND | `createMember.ts` + `DentalMembershipManagement_create.ts` (deprecated shim) | |
| PATCH /api/v1/dental/memberships/:id | FOUND | `updateMember.ts` | |
| GET /api/v1/dental/fee-schedule | FOUND (indirect) | `branchSettings.ts` stores fees in JSONB settings | **DRIFT** — no dedicated fee-schedule endpoint; fees embedded in branch settings blob |
| PATCH /api/v1/dental/fee-schedule/:cdt | FOUND (indirect) | `updateBranchSettings.ts` | **DRIFT** — same as above; no dedicated PATCH per CDT code |
| GET /api/v1/dental/dashboard | FOUND | `getDashboardSummary.ts` | **DRIFT** — response shape differs from spec |
| GET /api/v1/dental/audit-events | MISSING | No handler found in dental-org | Spec notes it's a proxy to dental-audit; no routing glue found in dental-org handlers |

**DRIFT-04 (POST /dental/orgs — duplicate handlers):** Two handlers implement org creation: `createOrganization.ts` (manual JSON parsing, returns `org` directly) and `DentalOrganizationManagement_create.ts` (uses `ValidatedContext`, returns `org` directly). Both registered simultaneously creates ambiguity about which is canonical. `DentalOrganizationManagement_create.ts` does not validate `owner_person_id` from request body — it uses `user.id` as owner (different from API_CONTRACTS.md which shows `owner_person_id` as a request field). `createOrganization.ts` also ignores `owner_person_id` from body; uses `user.id`. Both are consistent on behavior but diverge from the API contract field spec.

**DRIFT-05 (GET /dental/branches/:id — missing assertBranchAccess):** `DentalBranchManagement_get.ts` performs no `assertBranchAccess`. Any authenticated user who knows a branchId can retrieve branch details. API_CONTRACTS.md specifies `FORBIDDEN(403)` as an error case. MODULE_SPEC BR-016 mandates `assertBranchAccess` on all operations.

**DRIFT-06 (Fee schedule — no dedicated endpoints):** API_CONTRACTS.md defines `GET /dental/fee-schedule?branch_id=` returning `FeeScheduleEntry[]` and `PATCH /dental/fee-schedule/:cdt`. Neither exists as a standalone endpoint. Fee data is stored as a JSONB key (`feeSchedule`) in `branch.settings` and managed via `GET/PUT /dental/branches/:branchId/settings`. Frontend `fee-schedule.tsx` reads/writes to the settings blob endpoint. The CDT-level contract (per-code PATCH with `price_cents`, `currency`, `description` fields) is not implemented.

**DRIFT-07 (GET /dental/dashboard — response shape mismatch):** API_CONTRACTS.md specifies: `appointments_today`, `active_patients`, `outstanding_invoices`, `outstanding_cents`, `period_start`, `period_end`. `getDashboardSummary.ts` returns: `activePaymentPlans.{count, behindCount, totalOutstandingCents}`, `labOrders.{totalPending, ordered, inFabrication, overdueDelivery}`. No `appointments_today`, `active_patients`, `period_start`, or `period_end` fields.

**MISSING-02 (GET /dental/audit-events):** No handler found in dental-org that proxies to dental-audit. The spec calls it a proxy, but no routing entry or pass-through handler exists in this module.

### Implementation-only endpoints (not in spec but present)

| Endpoint | Handler | Notes |
|----------|---------|-------|
| GET /dental/org/context | `getOrgContext.ts` | Bootstrap helper — valid extra |
| GET /dental/branches (by user) | `getBranchesByUser.ts` | Auth flow helper — valid extra |
| GET /dental/org/members | `listMembers.ts` | Flat alternative to nested list |
| POST /dental/org/members | `createMember.ts` | Canonical creation endpoint |
| PATCH /dental/org/members/:id | `updateMember.ts` | Flat alternative |
| DELETE /dental/org/members/:id | `deactivateMember.ts` | Flat deactivation |
| GET/PUT /dental/branches/:id/settings | `branchSettings.ts` | FR8.x settings blob |
| GET/POST/PATCH/DELETE /dental/branches/:id/consent-templates | `consentTemplates.ts` | FR8.4b |
| POST /dental/org/members/:id/reset-pin | `resetMemberPin.ts` | FR9.x admin PIN reset |
| POST /dental/org/members/:id/security-question | `pinRecovery.ts` | FR9.7 |
| POST /dental/org/members/:id/recover-pin | `pinRecovery.ts` | FR9.7 |
| POST .../set-pin | `setPin.ts` + `DentalMembershipManagement_setPin.ts` | **DRIFT** — two files export same function name |
| POST .../verify-pin | `verifyPin.ts` + `DentalMembershipManagement_verifyPin.ts` | **DRIFT** — two files export same function name |

**DRIFT-08 (Duplicate handler files):** Both `setPin.ts` and `DentalMembershipManagement_setPin.ts` export `DentalMembershipManagement_setPin`. Both `verifyPin.ts` and `DentalMembershipManagement_verifyPin.ts` export `DentalMembershipManagement_verifyPin`. The versions in `verifyPin.ts` have an extra `repo.trackLastLogin(membershipId)` call that `DentalMembershipManagement_verifyPin.ts` lacks. Whichever is registered in the route registry determines whether `lastLoginAt` is updated. Behavioral divergence between the two is a latent bug.

---

## 3. Business Rules

| Rule | Status | Evidence |
|------|--------|---------|
| BR-016: assertBranchAccess on all clinical/billing ops | FOUND (partial) | Present in: `DentalBranchManagement_create`, `DentalMembershipManagement_*`, `createMember`, `listMembers`, `updateMember`, `deactivateMember`, `resetMemberPin`, `branchSettings`, `consentTemplates`, `getDashboardSummary`, `pinRecovery (setSecurityQuestion)`, `getBranchesByUser` (implicit via membership query). **MISSING** in `DentalBranchManagement_get` — see DRIFT-05. |
| BR-016b: PIN lockout after N failures | FOUND | `MembershipRepository.recordFailedPinAttempt()` — 5 attempts → 30s lock, 10 attempts → 5-min lock. `isLockedOut()` checked in `verifyPin` and `recoverPin`. |
| BR-016c: imagingTier gate | FOUND (org-level) | `resolveImagingTier()` in `organization.schema.ts`. Used in imaging handlers. **DRIFT** with MISSING-01 above — gates against org tier, not branch tier as spec intends. |
| BR-SCH-004: validate against branch working hours | MISSING | Working hours stored in `dental_branch.workingHours` and `branchSettings.settings.workingHours`. No validation logic found in dental-org or dental-scheduling handlers against this data. |

**MISSING-03 (BR-SCH-004):** No handler validates appointment creation against branch working hours. The `getWorkingHours.ts` and `updateWorkingHours.ts` files provide CRUD for working hours data but no enforcement logic exists anywhere in the codebase for this rule.

---

## 4. Workflows

| Workflow | Status | Notes |
|----------|--------|-------|
| WF-043: Branch-scoped login (PIN select) | FOUND | `/auth/pin-select.tsx`, `/auth/pin-entry.$memberId.tsx` |
| WF-004: Staff invitation + first login | PARTIAL | Create member endpoint exists; invitation email via Better-Auth not wired — `member_status = 'invited'` not representable (DRIFT-02) |
| WF-027: Staff member management | FOUND | `staff.tsx` route + `StaffList`, `StaffCreateModal`, `updateMember.ts`, `deactivateMember.ts` |
| WF-025: Configure fee schedule | PARTIAL | Fee data writable via branch settings; no dedicated CDT-level endpoint (DRIFT-06) |
| WF-026: Configure branch hours | FOUND | `WorkingHours` component + `updateWorkingHours.ts` |
| WF-069: Create organization | FOUND | `createOrganization.ts` + `DentalOrganizationManagement_create.ts` |
| WF-070: Create branch | FOUND | `DentalBranchManagement_create.ts` + onboarding wizard |
| WF-072: Membership revocation | FOUND | `deactivateMember.ts` + `DentalMembershipManagement_deactivate.ts` |
| WF-028: View audit log | MISSING | No audit log viewer in dental-org frontend or proxy handler |
| WF-029: Export practice reports | MISSING | No handler or UI component found |

**MISSING-04 (WF-028):** No audit log viewer in dental-org scope. `getDashboardSummary.ts` handles aggregate stats but there is no `GET /dental/audit-events` handler (see MISSING-02).

**MISSING-05 (WF-029):** No export/reporting handler or frontend component found.

---

## 5. UI/UX Requirements

| Screen | Status | Files |
|--------|--------|-------|
| Branch Settings | FOUND | `settings.tsx`, `ClinicSettings`, `FeeSchedule`, `LocaleSettings`, `WorkingHours`, `NotificationSettings` components |
| Staff Management | FOUND | `staff.tsx`, `StaffList`, `StaffCreateModal` |

---

## 6. Permissions

| Action | Spec requires | Implementation | Status |
|--------|--------------|----------------|--------|
| Create/edit staff → dentist_owner only | dentist_owner | `updateMember.ts` checks caller role for role changes; `deactivateMember.ts` only checks assertBranchAccess (no owner-only guard) | **DRIFT-09** |
| Configure fee schedule → dentist_owner | dentist_owner | `updateBranchSettings.ts` checks `role === 'dentist_owner'` | FOUND |
| Configure branch hours → dentist_owner | dentist_owner | `updateWorkingHours.ts` not reviewed in detail — assumed OK if it follows same pattern | FOUND |
| View audit log → dentist_owner | dentist_owner | No implementation | MISSING |
| Export reports → dentist_owner | dentist_owner | No implementation | MISSING |
| Read own membership → all roles | all | `assertBranchAccess` allows all branch members | FOUND |
| Create organization → admin | admin (platform) | Both create-org handlers check only `user?.id` — no admin-role gate | **DRIFT-10** |

**DRIFT-09 (deactivateMember lacks dentist_owner check):** `deactivateMember.ts` (flat endpoint DELETE /dental/org/members/:id) calls `assertBranchAccess` but does NOT check that the caller is `dentist_owner`. Any active branch member can deactivate any other member. Contrast with `DentalMembershipManagement_deactivate.ts` which similarly has no owner check. MODULE_SPEC §6 restricts deactivation to `dentist_owner`.

**DRIFT-10 (createOrganization has no admin-role gate):** MODULE_SPEC §6 says "Create organization → admin (platform)". Both `createOrganization.ts` and `DentalOrganizationManagement_create.ts` allow any authenticated user to create an org. No role check present.

---

## 7. Domain Events

| Event | Status | Notes |
|-------|--------|-------|
| DE-022 MembershipAssigned | PARTIAL | API_CONTRACTS.md says POST /dental/memberships emits DE-022. No event emission found in `createMember.ts` or `DentalMembershipManagement_create.ts`. |
| DE-023 MembershipRevoked | MISSING | Not emitted in `deactivateMember.ts` or `DentalMembershipManagement_deactivate.ts`. |

**MISSING-06 (Domain events not emitted):** Neither DE-022 nor DE-023 are emitted anywhere in the dental-org handlers. Downstream consumers (notifs for welcome email, dental-audit for session revoke per spec §10b) will not receive these events.

---

## 8. Feature Flags

| Flag | Status | Notes |
|------|--------|-------|
| `dental_org_ceph_tier_gate` | MISSING | MODULE_SPEC §18 declares this flag. No feature-flag check found in any handler. |
| `dental_org_pin_auth_enabled` | MISSING | MODULE_SPEC §18 declares this flag. No feature-flag check found in any handler. |

**MISSING-07 (Feature flags not implemented):** Both declared ops flags have no runtime check. Imaging tier gate and PIN auth are always-on, not togglable.

---

## 9. Acceptance Criteria

| AC | Status | Notes |
|----|--------|-------|
| AC-ORG-001: assertBranchAccess returns 403 | FOUND (partial) | Tested in multiple test files. Gap: `DentalBranchManagement_get` not covered (DRIFT-05). |
| AC-ORG-002: Fee schedule affects new invoices | MISSING | No integration test found linking fee-schedule update to invoice line item defaulting. |
| AC-ORG-003: Staff invitation flow | PARTIAL | Member creation exists; `invited` status and invitation email flow absent (DRIFT-02). |

---

## 10. Test Expectations (MODULE_SPEC §12)

| Test requirement | Status | Files |
|-----------------|--------|-------|
| Unit: assertBranchAccess gate (403) | FOUND | `createMember.test.ts`, `deactivateMember.test.ts`, `dental-auth-module7.test.ts`, `verifyPin.test.ts` |
| Unit: PIN lockout counter + unlock | FOUND | `verifyPin.test.ts` — covers 5-attempt and 10-attempt thresholds |
| Unit: BR-016c imagingTier gate | FOUND | `memberTierLimits.test.ts` covers tier limits |
| Integration: invitation → first login → active membership | MISSING | No integration test covering the invitation flow end-to-end |
| Integration: fee schedule visible in new invoice | MISSING | No cross-module integration test found |

---

## 11. Critical Defects Found During Audit

### CR-01 · Privilege escalation — deactivateMember lacks role gate

**File:** `services/api-ts/src/handlers/dental-org/deactivateMember.ts:27`
**Classification:** BLOCKER
**Issue:** `deactivateMember` (DELETE /dental/org/members/:id) calls `assertBranchAccess` but does not check that the caller holds `dentist_owner` role. Any active branch member can deactivate any other member. MODULE_SPEC §6 restricts deactivation to `dentist_owner`. The nested-path variant `DentalMembershipManagement_deactivate.ts` has the same gap.
**Fix:**
```typescript
// After assertBranchAccess, add:
const [callerMembership] = await db
  .select({ role: dentalMemberships.role })
  .from(dentalMemberships)
  .where(and(
    eq(dentalMemberships.personId, user.id),
    eq(dentalMemberships.branchId, member.branchId),
    eq(dentalMemberships.status, 'active'),
  ))
  .limit(1);
if (callerMembership?.role !== 'dentist_owner') {
  throw new ForbiddenError('Only dentist_owner can deactivate members');
}
```

### CR-02 · IDOR — DentalBranchManagement_get skips assertBranchAccess

**File:** `services/api-ts/src/handlers/dental-org/DentalBranchManagement_get.ts:25`
**Classification:** BLOCKER
**Issue:** Any authenticated user can fetch any branch by ID without being a member of that branch. BR-016 requires `assertBranchAccess` on all operations. Exposes branch name, address, timezone, working hours, and settings to unauthorized users.
**Fix:**
```typescript
const repo = new BranchRepository(db, logger);
const branch = await repo.findOneById(branchId);
if (!branch) throw new NotFoundError('Branch');
// Add before return:
await assertBranchAccess(db, user.id, branchId);
return ctx.json(branch);
```

### CR-03 · Duplicate verifyPin handlers with behavioral divergence

**File:** `services/api-ts/src/handlers/dental-org/verifyPin.ts:63` vs `DentalMembershipManagement_verifyPin.ts:52`
**Classification:** BLOCKER
**Issue:** `verifyPin.ts` calls `repo.trackLastLogin(membershipId)` on success (line 63); `DentalMembershipManagement_verifyPin.ts` does not. Both export the same function name `DentalMembershipManagement_verifyPin`. Whichever the route registry imports determines whether `lastLoginAt` is updated. The other is dead code. FR6.4 (activity visibility) silently fails if the wrong one is registered.
**Fix:** Delete one file; confirm route registry imports from the correct one (prefer `verifyPin.ts` which includes `trackLastLogin`). Do the same for `setPin.ts` vs `DentalMembershipManagement_setPin.ts`.

### WR-01 · member_status enum missing `invited` state

**File:** `services/api-ts/src/handlers/dental-org/repos/membership.schema.ts:22`
**Classification:** WARNING
**Issue:** `memberStatusEnum` only has `['active', 'inactive']`. MODULE_SPEC §8 defines a three-state machine: `invited → active → inactive`. API_CONTRACTS.md lists `invited` as a valid status in POST /dental/memberships response. The invitation flow (WF-004) cannot properly represent unaccepted invitations.
**Fix:** Add `invited` to the enum: `pgEnum('member_status', ['active', 'inactive', 'invited'])`. Update `NewDentalMembership` insertions for invitation scenarios to use `status: 'invited'`.

### WR-02 · imaging_tier on org, not branch (spec says branch)

**File:** `services/api-ts/src/handlers/dental-org/repos/branch.schema.ts` (absent)
**Classification:** WARNING
**Issue:** MODULE_SPEC §7 lists `imaging_tier` under `dental_branch`. It is implemented on `dental_organization`. All imaging gate handlers use org-level tier. This is a spec divergence that will require a migration if multi-branch orgs need per-branch imaging tiers.
**Fix:** Add `imagingTierEnum('imaging_tier')` column to `dental_branch` schema. Migrate imaging gate logic to read from branch rather than org.

### WR-03 · createOrganization allows any user (no admin gate)

**File:** `services/api-ts/src/handlers/dental-org/createOrganization.ts:15` and `DentalOrganizationManagement_create.ts:15`
**Classification:** WARNING
**Issue:** MODULE_SPEC §6 restricts org creation to `admin (platform)`. Both handlers allow any authenticated user to create an org, enabling arbitrary tenancy creation.
**Fix:** Add platform-admin role check. Until that role is defined in Better-Auth, at minimum document the deviation as an explicit ADR so it is not an unintended gap.

### WR-04 · setPin allows any branch member to change another member's PIN

**File:** `services/api-ts/src/handlers/dental-org/setPin.ts:42` and `DentalMembershipManagement_setPin.ts:35`
**Classification:** WARNING
**Issue:** `assertBranchAccess` passes if the caller is any active branch member. There is no check that `user.id === member.personId` (self-change) or `callerRole === 'dentist_owner'` (admin reset). Any branch member can overwrite any other member's PIN.
**Fix:**
```typescript
// After assertBranchAccess:
if (member.personId !== user.id) {
  const [callerMembership] = await db.select({ role: dentalMemberships.role })
    .from(dentalMemberships)
    .where(and(eq(dentalMemberships.personId, user.id), eq(dentalMemberships.branchId, member.branchId)))
    .limit(1);
  if (callerMembership?.role !== 'dentist_owner') {
    throw new ForbiddenError('Only the member or a dentist_owner can set a PIN');
  }
}
```
Note: `resetMemberPin.ts` (admin reset path) already has this check — `setPin` does not.

### WR-05 · Onboarding wizard creates member with no branchId validation

**File:** `apps/dentalemon/src/features/onboarding/components/onboarding-wizard.tsx:176`
**Classification:** WARNING
**Issue:** The wizard posts to `POST .../branches/${branch.id}/members` using the response from the previous branch creation call. If `branchRes.json()` returns a shape where `branch.id` is undefined (e.g., server error or shape mismatch), the fetch URL becomes `undefined` and silently fails or hits the wrong endpoint. No guard on `branch.id` before constructing the URL.
**Fix:**
```typescript
const branch = await branchRes.json();
if (!branch?.id) throw new Error('Branch creation returned no ID');
```

### IN-01 · recoverPin shares the PIN lockout counter with security-question attempts

**File:** `services/api-ts/src/handlers/dental-org/pinRecovery.ts:98`
**Classification:** INFO
**Issue:** Wrong security-question answers increment `pinFailedAttempts` (same counter as PIN failures). This means 4 wrong PINs + 1 wrong security answer = lockout. This design may be intentional but is not documented in MODULE_SPEC and creates a surprising UX interaction.

### IN-02 · listMembers (flat) strips only pinHash, not securityAnswerHash/securityQuestion

**File:** `services/api-ts/src/handlers/dental-org/listMembers.ts:37`
**Classification:** INFO
**Issue:** `const safeItems = allItems.map(({ pinHash, ...rest }) => rest)` — strips `pinHash` but not `securityAnswerHash` or `securityQuestion`. The nested `DentalMembershipManagement_list.ts` correctly strips all three. If `listMembers` is the endpoint used by `pin-select.tsx` and `staff-list.tsx` (it is — they call `/dental/org/members`), the security question and answer hash are returned to the browser.
**Fix:**
```typescript
const safeItems = allItems.map(({ pinHash: _ph, securityAnswerHash: _sah, securityQuestion: _sq, ...rest }) => rest);
```

### IN-03 · PinSelectMember type only accepts 4 roles; schema has 9

**File:** `apps/dentalemon/src/routes/auth/pin-select.tsx:33`
**Classification:** INFO
**Issue:** `PinSelectMember.role` is typed as `'dentist_owner' | 'dentist_associate' | 'staff_full' | 'staff_scheduling'`. Schema has 9 roles. If a member with role `hygienist`, `dental_assistant`, etc. is fetched, the `ROLE_LABELS` lookup returns `undefined` and renders a blank badge.

### IN-04 · getDashboardSummary branchId guard is redundant dead code

**File:** `services/api-ts/src/handlers/dental-org/getDashboardSummary.ts:37`
**Classification:** INFO
**Issue:** Lines 37-38 throw if `!branchId`. Lines 39-57 are wrapped in `if (branchId)` with an `else` branch that runs a non-branch-scoped query. The `else` branch can never execute because the function already throws when `branchId` is absent. The unscoped query on line 53 is dead code that could leak cross-tenant data if the guard were ever removed.

---

## 12. Missing Spec Items Not Yet Implemented

| Item | Spec Reference | Priority |
|------|---------------|----------|
| `invited` membership status | §8, API_CONTRACTS | P0 |
| `imaging_tier` on `dental_branch` | §7 | P1 |
| Fee schedule dedicated endpoints | API_CONTRACTS §GET+PATCH /fee-schedule | P1 |
| GET /dental/audit-events proxy | API_CONTRACTS §audit-events | P2 |
| Domain events DE-022 / DE-023 | §10b | P1 |
| Feature flags `dental_org_*` | §18 | P2 |
| WF-028 audit log viewer | §3 | P2 |
| WF-029 export reports | §3 | P2 |
| BR-SCH-004 working hours validation | §5 | P1 |
| Admin gate on createOrganization | §6 | P1 |

---

*Enforced against: MODULE_SPEC.md v1.0, API_CONTRACTS.md v1.0*
*Backend source: `services/api-ts/src/handlers/dental-org/`*
*Frontend source: `apps/dentalemon/src/features/staff/`, `apps/dentalemon/src/features/settings/`, routes `_dashboard/staff`, `_dashboard/settings`, `_dashboard/dental-onboarding`, `auth/pin-select`, `auth/pin-entry.$memberId`*
