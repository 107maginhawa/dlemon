<!-- oli-enforce-file v1.1 | run: wave3-verify-2026-05-29 | module: dental-org -->
<!-- wave3-claimed-fixes: EF-ORG-001/002/003/004/006/009/011/012/014 -->

# dental-org — File Enforcement Report

**Run:** wave3-verify-2026-05-29
**Module path:** `services/api-ts/src/handlers/dental-org/`
**Files inventoried:** 67 (35 handler/impl + shims, 14 repos/schemas/facades, 18 test files)
**Spec source:** `docs/product/modules/dental-org/MODULE_SPEC.md` + `API_CONTRACTS.md` + `DOMAIN_MODEL.md` + `ROLE_PERMISSION_MATRIX.md`

---

## Summary

| Severity | Count |
|----------|-------|
| P0 | 4 |
| P1 | 4 |
| P2 | 4 |
| P3 | 2 |
| **Total** | **14** |

---

## Wave3 Claimed Fix Verification

| Finding ID | Claim | Verified? | Evidence |
|-----------|-------|-----------|----------|
| EF-ORG-001 | DentalBranchManagement_create: org ownership check added | FIXED | `DentalBranchManagement_create.ts` L30-33: loads org, checks `org.ownerPersonId !== user.id` |
| EF-ORG-002 | DentalBranchManagement_list: org-scoping auth added | FIXED | `DentalBranchManagement_list.ts` L36-51: owner check OR active membership in org |
| EF-ORG-003 | createMember: dentist_owner role check added | FIXED | `createMember.ts` L56: `assertBranchRole(['dentist_owner'])` before member creation |
| EF-ORG-004 | DentalMembershipManagement_deactivate: weaker than legacy | FIXED | `DentalMembershipManagement_deactivate.ts` L43-46: org owner OR `assertBranchRole(['dentist_owner'])` |
| EF-ORG-006 | verifyPin tests: use canonical handler (not legacy) | PARTIAL | `verifyPin.test.ts` L1-9 comment confirms canonical handlers used; still uses `buildTestApp()` not real server |
| EF-ORG-009 | Legacy handler duplicates cleaned up | PARTIAL | Shims redirect (e.g., `recoverPin.ts → pinRecovery.ts`); `DentalMembershipManagement_create.ts` still exists as deprecated but not deleted |
| EF-ORG-011 | createMember tests: non-owner caller test added | FIXED | `createMember.test.ts` L182,200: 403 tests for staff_full and dentist_associate callers |
| EF-ORG-012 | DentalBranchManagement tests added | FIXED | `DentalBranchManagement_create.test.ts` and `DentalBranchManagement_list.test.ts` exist with auth coverage |
| EF-ORG-014 | getOrgContext/getBranchesByUser: document isolation | CONFIRMED ACCEPTABLE | Informational P3 — user-scoped queries; no IDOR risk; no fix needed |

---

## File Classification

| File | Type | Specs Loaded |
|------|------|-------------|
| `repos/organization.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| `repos/branch.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| `repos/membership.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| `repos/consent-template.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| `repos/organization.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| `repos/branch.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| `repos/membership.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| `repos/org-billing.facade.ts` | Repository-facade | MODULE_SPEC + DOMAIN_MODEL |
| `repos/org-imaging.facade.ts` | Repository-facade | MODULE_SPEC + DOMAIN_MODEL |
| `repos/org-scheduling.facade.ts` | Repository-facade | MODULE_SPEC + DOMAIN_MODEL |
| `DentalOrganizationManagement_create.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| `DentalOrganizationManagement_get.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| `DentalOrganizationManagement_update.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| `DentalBranchManagement_create.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| `DentalBranchManagement_get.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| `DentalBranchManagement_list.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| `DentalMembershipManagement_create.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| `DentalMembershipManagement_deactivate.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| `DentalMembershipManagement_list.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| `DentalMembershipManagement_setPin.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| `DentalMembershipManagement_verifyPin.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| `createOrganization.ts` | Handler (legacy) | MODULE_SPEC + API_CONTRACTS |
| `createMember.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| `listMembers.ts` | Handler | MODULE_SPEC + API_CONTRACTS |
| `updateMember.ts` | Handler | MODULE_SPEC + API_CONTRACTS |
| `deactivateMember.ts` | Handler | MODULE_SPEC + API_CONTRACTS |
| `getOrgContext.ts` | Handler | MODULE_SPEC |
| `getBranchesByUser.ts` | Handler | MODULE_SPEC |
| `getDashboardSummary.ts` | Handler | MODULE_SPEC + API_CONTRACTS |
| `branchSettings.ts` | Handler | MODULE_SPEC + API_CONTRACTS + ROLE_PERMISSION_MATRIX |
| `getBranchSettings.ts` | Handler (shim) | MODULE_SPEC |
| `updateBranchSettings.ts` | Handler (shim) | MODULE_SPEC |
| `consentTemplates.ts` | Handler | MODULE_SPEC + API_CONTRACTS |
| `listConsentTemplates.ts` | Handler (shim) | MODULE_SPEC |
| `createConsentTemplate.ts` | Handler (shim) | MODULE_SPEC |
| `updateConsentTemplate.ts` | Handler (shim) | MODULE_SPEC |
| `deleteConsentTemplate.ts` | Handler (shim) | MODULE_SPEC |
| `pinRecovery.ts` | Handler | MODULE_SPEC + ROLE_PERMISSION_MATRIX |
| `setSecurityQuestion.ts` | Handler (shim) | MODULE_SPEC |
| `recoverPin.ts` | Handler (shim) | MODULE_SPEC |
| `resetMemberPin.ts` | Handler | MODULE_SPEC + ROLE_PERMISSION_MATRIX |
| `getWorkingHours.ts` | Handler (shim → dental-scheduling) | MODULE_SPEC |
| `updateWorkingHours.ts` | Handler (shim → dental-scheduling) | MODULE_SPEC |
| `utils/locale.ts` | Util | MODULE_SPEC |
| `repos/branch.test.ts` | Test | Mirror handler spec set |
| `repos/membership.test.ts` | Test | Mirror handler spec set |
| `repos/organization.test.ts` | Test | Mirror handler spec set |
| `repos/dental-staff.test.ts` | Test | Mirror handler spec set |
| `verifyPin.test.ts` | Test | Mirror handler spec set |
| `createMember.test.ts` | Test | Mirror handler spec set |
| `createOrganization.test.ts` | Test | Mirror handler spec set |
| `deactivateMember.test.ts` | Test | Mirror handler spec set |
| `DentalBranchManagement_create.test.ts` | Test | Mirror handler spec set |
| `DentalBranchManagement_list.test.ts` | Test | Mirror handler spec set |
| `updateMember.test.ts` | Test | Mirror handler spec set |
| `listMembers.test.ts` | Test | Mirror handler spec set |
| `resetMemberPin.test.ts` | Test | Mirror handler spec set |
| `memberTierLimits.test.ts` | Test | Mirror handler spec set |
| `getBranchesByUser.test.ts` | Test | Mirror handler spec set |
| `getOrgContext.test.ts` | Test | Mirror handler spec set |
| `auth-security-hardening.test.ts` | Test | Mirror handler spec set |
| `dental-org-auth-p0.test.ts` | Test | Mirror handler spec set |
| `dental-org.clinic-settings.test.ts` | Test | Mirror handler spec set |
| `dental-org.dashboard-summary-extended.test.ts` | Test | Mirror handler spec set |
| `dental-org.pin-recovery.test.ts` | Test | Mirror handler spec set |
| `dental-org.staff-activity-visibility.test.ts` | Test | Mirror handler spec set |
| `em-org-ownership.test.ts` | Test | Mirror handler spec set |

---

## Findings

### EF-ORG-P015 — P0 | SECURITY | recoverPin: no assertBranchAccess — cross-branch PIN reset possible

**File:** `services/api-ts/src/handlers/dental-org/pinRecovery.ts` (line 64–114)
**Severity:** P0
**Confidence:** HIGH
**Spec Source:** MODULE_SPEC §6 (Permissions), ROLE_PERMISSION_MATRIX (branch-level isolation), BR-016

**Description:**
`recoverPin()` authenticates the caller (`user.id` check at L71) but never calls `assertBranchAccess`. After fetching the target `member` by `membershipId` (L79-80), it proceeds to verify the security answer and reset the PIN without verifying the authenticated user has any membership in `member.branchId`. An authenticated user in Branch A can target any `membershipId` in Branch B, guess the security answer, and reset that member's PIN.

Contrast: `setSecurityQuestion()` in the same file (L28–62) correctly calls `assertBranchAccess(db, user.id, member.branchId)` at L42. The `recoverPin()` function omits this call entirely.

**Line context:**
```typescript
// pinRecovery.ts L64-80
export async function recoverPin(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');
  // ...
  const member = await repo.findOneById(memberId);
  if (!member) throw new NotFoundError('Membership');
  // NO assertBranchAccess call here — branch isolation MISSING
  if (repo.isLockedOut(member)) { ... }
```

**Fix:** Add `await assertBranchAccess(db, user.id, member.branchId);` after L80 (after the `if (!member)` guard), matching the pattern in `setSecurityQuestion`.

---

### EF-ORG-P016 — P0 | SECURITY | Fee schedule and audit log handlers not implemented

**File:** No `getFeeSchedule.ts`, `updateFeeSchedule.ts`, or `getAuditEvents.ts` exist in the module directory
**Severity:** P0
**Confidence:** HIGH
**Spec Source:** MODULE_SPEC §3 WF-025/WF-028, API_CONTRACTS.md `GET /api/v1/dental/fee-schedule`, `PATCH /api/v1/dental/fee-schedule/:cdt`, `GET /api/v1/dental/audit-events`

**Description:**
Three spec-declared endpoints have no implementation at all:
- `GET /api/v1/dental/fee-schedule` — CDT fee schedule read (WF-025, P1)
- `PATCH /api/v1/dental/fee-schedule/:cdt` — CDT price update (WF-025, P1, dentist_owner only)
- `GET /api/v1/dental/audit-events` — audit log viewer (WF-028, P2, dentist_owner only)

The `branch.schema.ts` has `feeSchedule?: Record<string, number>` in the `BranchSettings` JSONB blob but this is the branch-settings embedded field, not a dedicated fee schedule endpoint. No standalone fee schedule handler exists. These are not edge-case features — WF-025 is P1 priority and required for billing (AC-ORG-002: fee schedule price visible in new invoice).

**Fix:** Implement per Vertical TDD protocol. `updateFeeSchedule` must: (a) require dentist_owner, (b) only affect future invoices, (c) use error code `INVALID_CDT_CODE(422)` per ERROR_TAXONOMY.

---

### EF-ORG-P017 — P0 | DATA SHAPE | membership.schema.ts: missing 'invited' and 'revoked' member_status values

**File:** `services/api-ts/src/handlers/dental-org/repos/membership.schema.ts` (line 22)
**Severity:** P0
**Confidence:** HIGH
**Spec Source:** MODULE_SPEC §7 `member_status: active / inactive / invited`, API_CONTRACTS.md §POST /memberships response `status: active, invited, revoked`

**Description:**
The Drizzle `memberStatusEnum` definition is:
```typescript
export const memberStatusEnum = pgEnum('member_status', ['active', 'inactive']);
```
Both `'invited'` (WF-004 Staff Invitation flow: membership starts as `invited`) and `'revoked'` (API_CONTRACTS.md membership response shape) are missing from the enum. The MODULE_SPEC state machine explicitly shows `invited → active` as the first transition. The API_CONTRACTS.md membership response declares `status: active | invited | revoked`.

**Impact:** Handlers that should set `status: 'invited'` on creation fall back to `'active'`, meaning the invitation workflow state machine (WF-004) is broken at the DB level. The `deactivateMember` endpoint should set `revoked` status per API_CONTRACTS but the schema only allows `inactive`.

**Fix:** Alter the enum: `['active', 'inactive', 'invited', 'revoked']`. Generate migration. Update `createMember.ts` (set `status: 'invited'` for email-invited staff) and `deactivateMember.ts` (set `status: 'revoked'`).

---

### EF-ORG-P018 — P0 | ERROR TAXONOMY | TIER_LIMIT_REACHED error code not in ERROR_TAXONOMY catalog

**Files:** `services/api-ts/src/handlers/dental-org/createMember.ts` (line 73), `services/api-ts/src/handlers/dental-org/DentalMembershipManagement_create.ts` (line 53)
**Severity:** P0
**Confidence:** HIGH
**Spec Source:** ERROR_TAXONOMY.md §5 dental-org catalog, API_CONTRACTS.md §POST /memberships errors

**Description:**
Both handlers throw `AppError('...', 'TIER_LIMIT_REACHED', 409)` when the org tier member limit is reached. The `TIER_LIMIT_REACHED` code does not appear in the ERROR_TAXONOMY catalog. The spec declares `MEMBERSHIP_CONFLICT(409)` for conflict scenarios in the dental-org module. The taxonomy is the single source of truth for error codes. Clients cannot reliably distinguish tier-limit errors from duplicate-membership errors using spec-compliant code.

**Line context:**
```typescript
// createMember.ts L70-76
if (activeCount >= limit) {
  throw new AppError(
    `Tier limit reached: ${org.tier} plan allows a maximum of ${limit} active staff members`,
    'TIER_LIMIT_REACHED',  // NOT in ERROR_TAXONOMY
    409,
  );
}
```

**Fix:** Add `TIER_LIMIT_REACHED(409)` to ERROR_TAXONOMY §5 dental-org section, OR change the code to `MEMBERSHIP_CONFLICT` with a descriptive message, ensuring alignment with the spec catalog.

---

### EF-ORG-P019 — P1 | NAMING | organization.schema.ts: column 'tier' deviates from spec field name 'org_tier'

**File:** `services/api-ts/src/handlers/dental-org/repos/organization.schema.ts` (line 14)
**Severity:** P1
**Confidence:** MEDIUM
**Spec Source:** MODULE_SPEC §7 `dental_organization` table: field `org_tier`, DOMAIN_MODEL `Organization` aggregate

**Description:**
MODULE_SPEC §7 declares the field as `org_tier` in the `dental_organization` table. The Drizzle schema uses:
```typescript
tier: orgTierEnum('tier').notNull(),
```
The Drizzle column name is `tier` (DB column) and the JavaScript property is also `tier`. MODULE_SPEC names it `org_tier`. This drift means generated OpenAPI types and client code would reference `tier` while docs reference `org_tier`, creating documentation drift and confusion for SDK consumers.

**Fix:** Rename column to `org_tier` in the DB schema (`orgTierEnum('org_tier')`) and update all references. Generate migration. This is a breaking schema change — coordinate with a migration.

---

### EF-ORG-P020 — P1 | SECURITY | getMemberRole helper in branchSettings.ts and consentTemplates.ts: no status='active' filter

**Files:**
- `services/api-ts/src/handlers/dental-org/branchSettings.ts` (line 26-32)
- `services/api-ts/src/handlers/dental-org/consentTemplates.ts` (line 33-39)

**Severity:** P1
**Confidence:** HIGH
**Spec Source:** MODULE_SPEC §5 BR-016, ROLE_PERMISSION_MATRIX

**Description:**
Both files define an identical `getMemberRole` helper:
```typescript
async function getMemberRole(db, userId, branchId) {
  const [member] = await db
    .select({ role: dentalMemberships.role })
    .from(dentalMemberships)
    .where(and(eq(dentalMemberships.personId, userId), eq(dentalMemberships.branchId, branchId)));
  return member?.role ?? null;
}
```
This query does NOT filter by `status = 'active'`. A deactivated `dentist_owner` retains their membership row with `status: 'inactive'` but `role: 'dentist_owner'`. This helper would still return `'dentist_owner'` for a deactivated member, allowing them to mutate branch settings and consent templates after their access should have been revoked.

**Fix:** Add `eq(dentalMemberships.status, 'active')` to the WHERE clause in both instances. Also consider centralizing this helper into `membership.repo.ts` to avoid re-divergence.

---

### EF-ORG-P021 — P1 | RESPONSE SHAPE | Handlers do not wrap responses in `{ data, meta }` envelope

**Files:** Multiple handlers — `DentalOrganizationManagement_create.ts` (L34), `DentalOrganizationManagement_get.ts` (L52), `DentalBranchManagement_create.ts` (L48), `createOrganization.ts` (L51), `DentalMembershipManagement_list.ts` (L45)
**Severity:** P1
**Confidence:** HIGH
**Spec Source:** API_CONVENTIONS.md §2 — all success responses must wrap in `{ data: ..., meta: { request_id, timestamp } }`

**Description:**
`API_CONVENTIONS.md §2.1` specifies all single-resource success responses must be `{ data: {...}, meta: { request_id, timestamp } }`. Handlers return raw objects:
```typescript
// DentalOrganizationManagement_create.ts L34
return ctx.json(org, 201);  // Should be ctx.json({ data: org, meta: {...} }, 201)

// DentalBranchManagement_list.ts L57
return ctx.json({ items, total: items.length });  // Should use { data: items, pagination, meta }
```
Collection responses are additionally missing the `pagination` envelope shape from §2.2 (some use `items`/`total`, others use `data`/`pagination` — inconsistent).

**Fix:** Wrap all handler responses in the `{ data, meta }` envelope using a shared `wrapResponse()` helper (aligned with how other modules implement the convention). Ensure collection responses use the `{ data: [], pagination: {...}, meta: {...} }` shape.

---

### EF-ORG-P022 — P1 | MISSING SPEC FEATURE | assertBranchAccess not called before org-level reads that expose branch data

**File:** `services/api-ts/src/handlers/dental-org/getOrgContext.ts`
**Severity:** P1
**Confidence:** MEDIUM
**Spec Source:** MODULE_SPEC §5 BR-016, AC-ORG-001

**Description:**
`getOrgContext.ts` queries `orgRepo.findMany({ ownerPersonId: user.id })` (user-scoped, safe for orgs) then fetches all branches for that org and the user's membership. This is safe for single-owner scenarios. However, the handler returns `branch.id`, `branch.name`, and `member.role` — which includes branch PII — without verifying the user is still an active member of the returned branch. If a user was deactivated from a branch but still owns the org, they would receive branch details for that branch.

**Fix:** After fetching `branch`, verify the user has an active membership in `branch.id` before returning the `member` field. Or restrict the `getOrgContext` response to orgs where the user has an active membership.

---

### EF-ORG-P023 — P2 | ERROR TAXONOMY | pinRecovery.ts: unused imports (ValidationError, BusinessLogicError)

**File:** `services/api-ts/src/handlers/dental-org/pinRecovery.ts` (line 11)
**Severity:** P2
**Confidence:** HIGH
**Spec Source:** MODULE_SPEC §15 Error Handling

**Description:**
```typescript
import { UnauthorizedError, NotFoundError, ValidationError, BusinessLogicError, ForbiddenError } from '@/core/errors';
```
`ValidationError` and `BusinessLogicError` are imported but never used in the file. All validation errors are thrown via Zod `.parse()` (ZodError), not `ValidationError`. `BusinessLogicError` is never thrown. Unused imports are dead code that increase maintenance surface and suggest incomplete refactoring.

**Fix:** Remove `ValidationError` and `BusinessLogicError` from the import statement.

---

### EF-ORG-P024 — P2 | NAMING | DentalMembershipManagement_create: deprecated handler still active without sunset enforcement

**File:** `services/api-ts/src/handlers/dental-org/DentalMembershipManagement_create.ts`
**Severity:** P2
**Confidence:** HIGH
**Spec Source:** MODULE_SPEC §20 AI Instructions, MODULE_MAP.md M1

**Description:**
This handler sets `Deprecation: true` and `Sunset: Tue, 01 Sep 2026 00:00:00 GMT` headers (RFC 8594) but remains fully functional and router-registered. The deprecation notice at L1-11 states it is "retained only because registry.ts imports it by name" and "remove after regenerating routes from a spec that drops this operationId." There is no automated enforcement of the sunset, no tracking in issues/PRD, and the handler still executes the full membership creation logic including TIER_LIMIT_REACHED errors. Until the TypeSpec drops the operationId, this handler is a maintenance burden with diverged auth logic vs `createMember.ts`.

**Fix:** Either (a) regen TypeSpec without the operationId and delete this file, or (b) convert the handler body to a 410 Gone response with a `Link` header pointing to the successor endpoint, preventing continued use.

---

### EF-ORG-P025 — P2 | DOMAIN TERMS | getMemberRole: duplicated across two files

**Files:** `branchSettings.ts` (L26-32), `consentTemplates.ts` (L33-39)
**Severity:** P2
**Confidence:** HIGH
**Spec Source:** MODULE_SPEC §20 AI Instructions (avoid duplication)

**Description:**
Identical `getMemberRole` helper function defined twice — once in `branchSettings.ts` and once in `consentTemplates.ts`. This is DRY violation. Both implementations have the same bug (no `status='active'` filter — EF-ORG-P020). The duplication means any future fix needs to be applied in two places.

**Fix:** Move the corrected `getMemberRole` into `membership.repo.ts` (or a new `membership.service.ts`) and import it in both files.

---

### EF-ORG-P026 — P3 | WORKFLOW ANNOTATION | No WF-ID annotations in handler files

**Files:** All handler files (no `// WF-NNN` annotations found)
**Severity:** P3
**Confidence:** HIGH
**Spec Source:** WORKFLOW_MAP.md — WF-025, WF-026, WF-027, WF-043, WF-004, WF-069, WF-070, WF-072 all map to dental-org handlers

**Description:**
Zero handler files contain `// WF-NNN` workflow annotations. Per the enforcement skill's traceability check: this is an advisory finding since the 5% adoption gate is not met (0 annotated functions / 67 files = 0%). No invalid WF-IDs are present (none exist at all).

**Fix (advisory):** Add `// WF-027` annotations to staff management handlers (createMember, updateMember, deactivateMember), `// WF-025` to fee schedule handlers, `// WF-043` to branch login flow (DentalMembershipManagement_verifyPin), and `// WF-070` to DentalBranchManagement_create.

---

### EF-ORG-P027 — P3 | INFORMATIONAL | getOrgContext / getBranchesByUser: user-scoped queries — no IDOR risk

**Files:** `getOrgContext.ts`, `getBranchesByUser.ts`
**Severity:** P3
**Confidence:** HIGH
**Spec Source:** MODULE_SPEC §6

**Description:**
Both endpoints query data scoped to the authenticated user's own records:
- `getOrgContext`: `findMany({ ownerPersonId: user.id })` — returns only orgs this user owns
- `getBranchesByUser`: filters `dentalMemberships.personId === user.id` — returns only branches the user is a member of

No assertBranchAccess is required because the queries themselves act as the isolation filter. This is acceptable by design. Documented as informational to confirm the earlier P3 review in Wave3 (EF-ORG-014) was correctly assessed.

**Status:** ACCEPTABLE — no fix required.

---

## assertBranchAccess Coverage Matrix

| Handler | Guard | Status |
|---------|-------|--------|
| `DentalBranchManagement_create.ts` | org ownerPersonId check | PASS |
| `DentalBranchManagement_get.ts` | assertBranchAccess | PASS |
| `DentalBranchManagement_list.ts` | org ownerPersonId OR active membership | PASS |
| `DentalMembershipManagement_create.ts` (deprecated) | org ownerPersonId check | PASS (deprecated) |
| `DentalMembershipManagement_deactivate.ts` | org owner OR assertBranchRole(['dentist_owner']) | PASS |
| `DentalMembershipManagement_list.ts` | assertBranchAccess | PASS |
| `DentalMembershipManagement_setPin.ts` | assertBranchAccess | PASS |
| `DentalMembershipManagement_verifyPin.ts` | assertBranchAccess | PASS |
| `DentalOrganizationManagement_create.ts` | authenticated only | PASS (org creation — no branch yet) |
| `DentalOrganizationManagement_get.ts` | org ownerPersonId OR active membership | PASS |
| `DentalOrganizationManagement_update.ts` | org ownerPersonId check | PASS |
| `createMember.ts` | assertBranchRole(['dentist_owner']) | PASS |
| `createOrganization.ts` (legacy) | authenticated only | PASS (org creation) |
| `deactivateMember.ts` | assertBranchRole(['dentist_owner']) | PASS |
| `getBranchSettings.ts` → `branchSettings.ts` | assertBranchAccess | PASS |
| `updateBranchSettings.ts` → `branchSettings.ts` | assertBranchAccess + role check | PASS |
| `getDashboardSummary.ts` | assertBranchAccess | PASS |
| `listMembers.ts` | assertBranchAccess | PASS |
| `updateMember.ts` | assertBranchAccess | PASS |
| `consentTemplates.ts` (all 4) | assertBranchAccess | PASS |
| `pinRecovery.ts` → setSecurityQuestion | assertBranchAccess | PASS |
| `pinRecovery.ts` → recoverPin | **NONE** | **FAIL — EF-ORG-P015** |
| `resetMemberPin.ts` | assertBranchAccess + role check | PASS |
| `getOrgContext.ts` | user-scoped query (no branch access needed) | ACCEPTABLE |
| `getBranchesByUser.ts` | user-scoped query (no branch access needed) | ACCEPTABLE |

---

## dentist_owner Privilege Gates Matrix

| Operation | Spec Requirement | Actual Guard | Status |
|-----------|-----------------|--------------|--------|
| Create org | authenticated | authenticated ✓ | PASS |
| Get org | any member | ownerPersonId OR membership ✓ | PASS |
| Update org | owner only | ownerPersonId check ✓ | PASS |
| Create branch | dentist_owner/admin | ownerPersonId check ✓ | PASS |
| List branches | org member | ownerPersonId OR membership ✓ | PASS |
| Create member | dentist_owner | assertBranchRole(['dentist_owner']) ✓ | PASS |
| Deactivate member | dentist_owner | org owner OR assertBranchRole ✓ | PASS |
| Update member role | dentist_owner | callerMembership.role check ✓ | PASS |
| Set member PIN (own) | self | callerMembership.id check ✓ | PASS |
| Set member PIN (other) | dentist_owner | callerMembership.role check ✓ | PASS |
| Reset member PIN | dentist_owner | role check ✓ | PASS |
| Set security question | self or dentist_owner | personId check OR role check ✓ | PASS |
| Recover PIN | authenticated | NO branch isolation | **FAIL — EF-ORG-P015** |
| Update branch settings | dentist_owner | getMemberRole check ✓ (but bug: no active filter) | PARTIAL — EF-ORG-P020 |
| Manage consent templates | dentist_owner | getMemberRole check ✓ (but bug: no active filter) | PARTIAL — EF-ORG-P020 |
| Get fee schedule | dentist_owner/associate | **NOT IMPLEMENTED** | FAIL — EF-ORG-P016 |
| Update fee schedule | dentist_owner | **NOT IMPLEMENTED** | FAIL — EF-ORG-P016 |
| View audit events | dentist_owner | **NOT IMPLEMENTED** | FAIL — EF-ORG-P016 |

---

## File Compliance Scores

| File | Checks Applied | Passed | Score |
|------|---------------|--------|-------|
| `repos/organization.schema.ts` | 4 | 3 | 75% (naming drift: tier vs org_tier) |
| `repos/branch.schema.ts` | 4 | 4 | 100% |
| `repos/membership.schema.ts` | 4 | 3 | 75% (missing invited/revoked enum values) |
| `repos/consent-template.schema.ts` | 4 | 4 | 100% |
| `repos/organization.repo.ts` | 6 | 5 | 83% (generic Error() throws) |
| `repos/branch.repo.ts` | 6 | 5 | 83% (generic Error() throws) |
| `repos/membership.repo.ts` | 6 | 6 | 100% |
| `repos/org-billing.facade.ts` | 4 | 4 | 100% |
| `repos/org-imaging.facade.ts` | 4 | 4 | 100% |
| `repos/org-scheduling.facade.ts` | 4 | 4 | 100% |
| `DentalOrganizationManagement_create.ts` | 6 | 4 | 67% (no data envelope, missing meta) |
| `DentalOrganizationManagement_get.ts` | 6 | 5 | 83% (no data envelope) |
| `DentalOrganizationManagement_update.ts` | 6 | 5 | 83% (no data envelope) |
| `DentalBranchManagement_create.ts` | 6 | 4 | 67% (no data envelope, address shape partial) |
| `DentalBranchManagement_get.ts` | 6 | 5 | 83% (no data envelope) |
| `DentalBranchManagement_list.ts` | 6 | 4 | 67% (no data envelope, items vs data shape) |
| `DentalMembershipManagement_create.ts` | 6 | 4 | 67% (deprecated, TIER_LIMIT_REACHED not in taxonomy) |
| `DentalMembershipManagement_deactivate.ts` | 6 | 5 | 83% |
| `DentalMembershipManagement_list.ts` | 6 | 5 | 83% |
| `DentalMembershipManagement_setPin.ts` | 6 | 6 | 100% |
| `DentalMembershipManagement_verifyPin.ts` | 6 | 6 | 100% |
| `createMember.ts` | 6 | 4 | 67% (TIER_LIMIT_REACHED not in taxonomy, no envelope) |
| `listMembers.ts` | 6 | 5 | 83% |
| `updateMember.ts` | 6 | 5 | 83% |
| `deactivateMember.ts` | 6 | 6 | 100% |
| `branchSettings.ts` | 6 | 4 | 67% (getMemberRole no active filter) |
| `consentTemplates.ts` | 6 | 4 | 67% (getMemberRole no active filter) |
| `pinRecovery.ts` | 6 | 3 | 50% (recoverPin missing assertBranchAccess, unused imports) |
| `resetMemberPin.ts` | 6 | 6 | 100% |
| `getOrgContext.ts` | 6 | 5 | 83% |
| `getBranchesByUser.ts` | 6 | 6 | 100% |
| `getDashboardSummary.ts` | 6 | 5 | 83% |
| `utils/locale.ts` | 3 | 3 | 100% |

---

## Module Traceability Score

- Files with 0 P0/P1 findings: 45/67 = **67%**
- P0 security violations: 4 (EF-ORG-P015, EF-ORG-P016, EF-ORG-P017, EF-ORG-P018)
- P1 gaps: 4 (EF-ORG-P019, EF-ORG-P020, EF-ORG-P021, EF-ORG-P022)

---

## Review Required (LOW Confidence Findings)

*None — all findings above are HIGH or MEDIUM confidence based on direct code inspection.*

---

## Findings Summary Table

| ID | Severity | Confidence | File | Check Type | Issue |
|----|----------|-----------|------|------------|-------|
| EF-ORG-P015 | P0 | HIGH | `pinRecovery.ts` | Auth boundary | recoverPin missing assertBranchAccess — cross-branch PIN reset |
| EF-ORG-P016 | P0 | HIGH | (none — missing files) | Missing spec feature | Fee schedule + audit log handlers not implemented |
| EF-ORG-P017 | P0 | HIGH | `repos/membership.schema.ts` | Data shape | memberStatusEnum missing 'invited' and 'revoked' values |
| EF-ORG-P018 | P0 | HIGH | `createMember.ts`, `DentalMembershipManagement_create.ts` | Error taxonomy | TIER_LIMIT_REACHED not in ERROR_TAXONOMY catalog |
| EF-ORG-P019 | P1 | MEDIUM | `repos/organization.schema.ts` | Naming convention | Column 'tier' vs spec field 'org_tier' drift |
| EF-ORG-P020 | P1 | HIGH | `branchSettings.ts`, `consentTemplates.ts` | Auth boundary | getMemberRole no status='active' filter — deactivated owner passes role check |
| EF-ORG-P021 | P1 | HIGH | Multiple handlers | Data shape | Responses missing `{ data, meta }` API_CONVENTIONS envelope |
| EF-ORG-P022 | P1 | MEDIUM | `getOrgContext.ts` | Auth boundary | Returns branch details without verifying active membership in that branch |
| EF-ORG-P023 | P2 | HIGH | `pinRecovery.ts` | Import boundary | Unused imports ValidationError + BusinessLogicError |
| EF-ORG-P024 | P2 | HIGH | `DentalMembershipManagement_create.ts` | Naming convention | Deprecated handler active without sunset enforcement |
| EF-ORG-P025 | P2 | HIGH | `branchSettings.ts`, `consentTemplates.ts` | Domain terms | getMemberRole helper duplicated across two files |
| EF-ORG-P026 | P3 | HIGH | All handlers | Workflow annotation | No WF-ID annotations (0% adoption, advisory only) |
| EF-ORG-P027 | P3 | HIGH | `getOrgContext.ts`, `getBranchesByUser.ts` | Auth boundary | User-scoped queries — acceptable, no IDOR risk (informational) |

---

## What's Next

**P0 security violations found — fix immediately before proceeding:**

1. **EF-ORG-P015** (CRITICAL): Add `assertBranchAccess` to `recoverPin()` in `pinRecovery.ts` — cross-branch PIN reset is currently possible for any authenticated user.
2. **EF-ORG-P017** (CRITICAL): Add `'invited'` and `'revoked'` to `memberStatusEnum` in `membership.schema.ts` + generate migration — staff invitation workflow (WF-004) is broken at the DB level.
3. **EF-ORG-P016**: Implement fee schedule and audit log handlers per Vertical TDD.
4. **EF-ORG-P018**: Register `TIER_LIMIT_REACHED` in `ERROR_TAXONOMY.md` or align to `MEMBERSHIP_CONFLICT`.

After P0 resolution, run `/oli-enforce-all` for cross-module view.

---

*Generated by oli-enforce-file v1.1 | Run: wave3-verify-2026-05-29 | Module: dental-org*
