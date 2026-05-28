# dental-org — File Enforcement
<!-- oli-enforce-file --strict v1.0 | run: run-6-strict-2026-05-29 | 2026-05-29 -->

## Summary
- Files scanned: 67 (35 handler/impl + shims, 14 repos/schemas/facades, 18 test files)
- P0 findings: 5
- P1 findings: 4
- P2 findings: 3
- P3 findings: 2

---

## A. assertBranchAccess / assertBranchRole coverage

### Handlers WITH assertBranchAccess (pass)
| Handler | Guard |
|---------|-------|
| `updateMember.ts` | assertBranchAccess |
| `verifyPin.ts` | assertBranchAccess |
| `DentalMembershipManagement_verifyPin.ts` | assertBranchAccess |
| `DentalMembershipManagement_setPin.ts` | assertBranchAccess |
| `setPin.ts` | assertBranchAccess |
| `DentalMembershipManagement_deactivate.ts` | assertBranchAccess (conditional — org owner bypasses) |
| `DentalMembershipManagement_list.ts` | assertBranchAccess |
| `DentalBranchManagement_get.ts` | assertBranchAccess |
| `listMembers.ts` | assertBranchAccess |
| `createMember.ts` | assertBranchAccess |
| `getDashboardSummary.ts` | assertBranchAccess |
| `branchSettings.ts` (get + update) | assertBranchAccess |
| `consentTemplates.ts` (all 4 ops) | assertBranchAccess |
| `pinRecovery.ts` (setSecurityQuestion + recoverPin) | assertBranchAccess |
| `resetMemberPin.ts` | assertBranchAccess |
| `deactivateMember.ts` | assertBranchRole(['dentist_owner']) |

### Handlers MISSING auth guard (findings below)

---

## Findings

### EF-ORG-001 — P0 | DentalBranchManagement_create: no org-ownership check
**File:** `services/api-ts/src/handlers/dental-org/DentalBranchManagement_create.ts`
**Issue:** Any authenticated user can POST to `/dental/organizations/{orgId}/branches/` and create a branch under any org they don't own. No `ownerPersonId === user.id` verification, no `assertBranchAccess`, no `assertBranchRole`. MODULE_SPEC WF-070 requires dentist_owner or admin only.
**Risk:** IDOR — attacker adds branches to another practice's org, poisoning their structure.
**Fix:** Load org, verify `org.ownerPersonId === user.id` (or platform-admin role), throw ForbiddenError otherwise.

---

### EF-ORG-002 — P0 | DentalBranchManagement_list: no org-scoping auth
**File:** `services/api-ts/src/handlers/dental-org/DentalBranchManagement_list.ts`
**Issue:** `GET /dental/organizations/{orgId}/branches/` returns all branches for any orgId with only authentication check — no ownership verification and no assertBranchAccess. Any authenticated user can enumerate another org's branch list.
**Risk:** IDOR information disclosure — exposes branch names, addresses, and IDs of competitor practices.
**Fix:** Verify `org.ownerPersonId === user.id` OR that caller has an active membership in at least one branch of the org.

---

### EF-ORG-003 — P0 | createMember / DentalMembershipManagement_create: missing dentist_owner role check
**Files:**
- `services/api-ts/src/handlers/dental-org/createMember.ts`
- `services/api-ts/src/handlers/dental-org/DentalMembershipManagement_create.ts`

**Issue:** Both handlers call `assertBranchAccess` (branch membership check) but never verify the caller has `dentist_owner` role. MODULE_SPEC permission table: "Create/edit staff → dentist_owner only". Any active branch member (dentist_associate, hygienist, receptionist) can invite new staff, assign roles, and promote themselves by creating a new higher-role member.
**Risk:** Privilege escalation — non-owner staff can self-invite colleagues or modify the org roster.
**Fix:** After assertBranchAccess, query caller's role and assertBranchRole(['dentist_owner']) or throw ForbiddenError.

---

### EF-ORG-004 — P0 | DentalMembershipManagement_deactivate: deactivate-own-membership race / no dentist_owner guard
**File:** `services/api-ts/src/handlers/dental-org/DentalMembershipManagement_deactivate.ts`
**Issue:** The guard is: if `org.ownerPersonId !== user.id` → assertBranchAccess. This means any active branch member can deactivate any other member (including the owner) as long as they are themselves a branch member — no dentist_owner role check. The legacy `deactivateMember.ts` correctly uses `assertBranchRole(['dentist_owner'])`. The canonical handler is weaker.
**Contrast:** `deactivateMember.ts` uses `assertBranchRole` (correct). `DentalMembershipManagement_deactivate.ts` uses only assertBranchAccess (insufficient).
**Risk:** Any staff member can deactivate the practice owner account, locking the owner out.
**Fix:** After assertBranchAccess, check caller's role is dentist_owner (or caller is org owner via ownerPersonId check).

---

### EF-ORG-005 — P0 | getFeeSchedule / updateFeeSchedule / getAuditEvents: not implemented
**Files:** No `getFeeSchedule.ts`, `updateFeeSchedule.ts`, or `getAuditEvents.ts` exist in the handler directory (confirmed: `cat` returns "No such file or directory"). MODULE_SPEC lists fee schedule (WF-025, P1) and audit log viewer (WF-028, P2) as in-scope. The `branch.schema.ts` has a `feeSchedule` JSONB field stub but no handlers.
**Risk:** Spec-committed features (fee schedule, audit log) are completely unimplemented — no route, no auth, no business logic.
**Fix:** Implement per vertical-TDD protocol. updateFeeSchedule must be dentist_owner only (MODULE_SPEC WF-025) and must NOT retroactively reprice existing invoices (price snapshotted at invoice creation).

---

### EF-ORG-006 — P1 | verifyPin.ts: tests use buildTestApp() — may miss route registration bugs
**File:** `services/api-ts/src/handlers/dental-org/verifyPin.test.ts`
**Issue:** Tests call `buildTestApp(authedUser)` which constructs a mini Hono app for the handler in isolation. Per project memory (`feedback_test_verification.md`): handler unit tests with `buildTestApp()` don't catch route registration bugs; must hit real server. No integration-level test confirms the route is wired into the main router.
**Risk:** PIN lockout and auth tests pass in isolation but a routing misconfiguration could leave the endpoint unauthenticated in production.
**Fix:** Add one contract-level test (`tests/contract/`) or real-server test that hits `POST /dental/organizations/{orgId}/branches/{branchId}/members/{membershipId}/verify-pin` against the live server.

---

### EF-ORG-007 — P1 | DentalOrganizationManagement_get: no org-ownership guard
**File:** `services/api-ts/src/handlers/dental-org/DentalOrganizationManagement_get.ts`
**Issue:** `GET /dental/organizations/{id}` returns org data with only `user.id` authentication check. No ownership verification. Any authenticated user can fetch any org's details (name, tier, countryCode, ownerPersonId) by guessing UUIDs.
**Risk:** Information disclosure — exposes org name, subscription tier, and owner identity.
**Fix:** Verify `org.ownerPersonId === user.id` OR that caller has at least one active membership in a branch of the org.

---

### EF-ORG-008 — P1 | No service layer — direct repo instantiation across all handlers
**Issue:** Zero service-class files exist (`find ... -name '*.service.ts'` returned empty). All 35+ handlers instantiate `MembershipRepository`, `BranchRepository`, `OrganizationRepository` directly with `new Repo(db, logger)`. No dependency injection interface.
**Impact:** Cannot mock repositories in unit tests without monkey-patching; duplicated error handling; no transaction boundary abstraction. Run-5 baseline audit noted this as PARTIAL; run-6 confirms NO progress.
**Fix:** Introduce service layer per F2 plan (already tracked in audit baseline).

---

### EF-ORG-009 — P1 | Legacy handler duplicates not cleaned up
**Files:** `createOrganization.ts` / `DentalOrganizationManagement_create.ts`, `deactivateMember.ts` / `DentalMembershipManagement_deactivate.ts`, `verifyPin.ts` / `DentalMembershipManagement_verifyPin.ts`, `setPin.ts` / `DentalMembershipManagement_setPin.ts`
**Issue:** Two parallel implementations per operation exist — a legacy camelCase handler and a PascalCase canonical one. They have diverged auth logic (EF-ORG-004: deactivate canonical is weaker than legacy). Which is wired to the router is ambiguous without reading router config; both co-existing causes confusion and maintenance divergence.
**Fix:** Delete legacy duplicates once canonical handlers are verified as router-registered, or explicitly shim legacy to canonical (like `recoverPin.ts → pinRecovery.ts`).

---

## B. Owner-Level (dentist_owner) Protection Review

| Operation | Spec Requirement | Actual Guard | Status |
|-----------|-----------------|--------------|--------|
| Update org settings | owner only | ownerPersonId check ✓ | PASS |
| Create branch | dentist_owner/admin | NONE | **FAIL (EF-ORG-001)** |
| Create member/staff | dentist_owner | assertBranchAccess only | **FAIL (EF-ORG-003)** |
| Deactivate member | dentist_owner | assertBranchAccess only (canonical) | **FAIL (EF-ORG-004)** |
| Reset member PIN | dentist_owner | assertBranchAccess + role check ✓ | PASS |
| Set PIN (own vs other) | self or dentist_owner | assertBranchAccess + callerMembership check ✓ | PASS |
| Update branch settings | dentist_owner | assertBranchAccess + getMemberRole ✓ | PASS |
| Update consent templates | dentist_owner | assertBranchAccess + getMemberRole ✓ | PASS |
| Configure fee schedule | dentist_owner | NOT IMPLEMENTED | **FAIL (EF-ORG-005)** |
| View audit log | dentist_owner | NOT IMPLEMENTED | **FAIL (EF-ORG-005)** |
| Update role | dentist_owner | assertBranchAccess + callerMembership check ✓ | PASS |

---

## C. PIN Security Assessment

### EF-ORG-010 — P2 | verifyPin lockout: IMPLEMENTED and tested
**Status: PASS**
`MembershipRepository.recordFailedPinAttempt()` implements two-tier lockout:
- 5 failures → 30-second lockout
- 10 failures → 5-minute lockout
`isLockedOut()` checked before hash comparison. `resetPinAttempts()` called on success. Tests in `verifyPin.test.ts` cover both thresholds and reset behavior.

**Minor gap:** No HTTP-level rate limiting (e.g., express-rate-limit or Hono middleware) for the verify-pin endpoint. Lockout is per-membership DB state only. A distributed attacker could hammer multiple membershipIds in parallel.
**Severity:** P2 — lockout per-membership is the primary defense; HTTP rate limit is defense-in-depth.

---

## D. getDashboardSummary Performance Review

**Status: PASS — no N+1**
`getDashboardSummary.ts` uses `Promise.all([getActivePaymentPlanSummaryForBranch, getPendingLabOrderSummaryForBranch])` — two parallel aggregate queries delegated to facade functions in `dental-billing` and `dental-clinical`. Requires `branchId` query param (validated + assertBranchAccess). No per-row loops observed.

---

## E. updateFeeSchedule Retroactivity Check

**Status: NOT IMPLEMENTED (EF-ORG-005)**
MODULE_SPEC WF-025 rule: "Existing invoices unaffected (price snapshot at invoice creation time)." Handler does not exist. When implemented, fee schedule changes must only affect `createdAt > now()` invoices. Existing invoices store their own price snapshot — this is a billing module responsibility but the fee schedule handler must not trigger retroactive repricing.

---

## F. Branch-Scope (branch_id WHERE) Review

All implemented DB queries that are branch-scoped correctly filter by `branchId`:
- `MembershipRepository.listByBranch(branchId, ...)` — correct
- `ConsentTemplates` queries: `eq(dentalConsentTemplates.branchId, branchId)` — correct
- `DashboardSummary` delegates to billing/clinical facades with explicit `branchId` arg — correct
- `BranchRepository.listByOrg(orgId)` — scoped to org, appropriate for that operation

No raw cross-branch data leaks found in implemented handlers.

---

## G. Test Coverage

### EF-ORG-011 — P2 | createMember missing dentist_owner coverage
**File:** `services/api-ts/src/handlers/dental-org/createMember.test.ts`
**Issue:** Tests cover 401, tier limit, 201 success — but no test for the case where a non-owner tries to create a member. Since EF-ORG-003 identifies missing role guard in the handler, there is also no test catching the gap.

### EF-ORG-012 — P2 | DentalBranchManagement_create/list have no tests
**Files:** No test files for `DentalBranchManagement_create.ts` or `DentalBranchManagement_list.ts` found.

### EF-ORG-013 — P3 | DentalMembershipManagement_deactivate has no test for non-owner caller
**Issue:** The canonical deactivate handler is weaker than the legacy (EF-ORG-004), and no test covers a non-owner member deactivating another member.

### EF-ORG-014 — P3 | getOrgContext / getBranchesByUser: no assertBranchAccess, relies on user-scoped query
**Files:** `getOrgContext.ts`, `getBranchesByUser.ts`
**Status:** Acceptable — both filter by `ownerPersonId: user.id` / user's own memberships respectively. No IDOR risk since data is inherently user-scoped. Not a bug but worth documenting.

---

## Severity Summary

| ID | Severity | Handler | Issue |
|----|----------|---------|-------|
| EF-ORG-001 | P0 | DentalBranchManagement_create | No org ownership check — IDOR |
| EF-ORG-002 | P0 | DentalBranchManagement_list | No org access check — info disclosure |
| EF-ORG-003 | P0 | createMember + DentalMembershipManagement_create | Missing dentist_owner role check |
| EF-ORG-004 | P0 | DentalMembershipManagement_deactivate | Canonical handler weaker than legacy — any member can deactivate owner |
| EF-ORG-005 | P0 | getFeeSchedule / updateFeeSchedule / getAuditEvents | Handlers not implemented |
| EF-ORG-006 | P1 | verifyPin tests | buildTestApp() misses route registration bugs |
| EF-ORG-007 | P1 | DentalOrganizationManagement_get | No ownership guard — org data exposed to any user |
| EF-ORG-008 | P1 | All handlers | No service layer / DI — direct repo instantiation |
| EF-ORG-009 | P1 | Multiple | Legacy handler duplicates with diverged auth |
| EF-ORG-010 | P2 | verifyPin | No HTTP-level rate limit (per-membership lockout present) |
| EF-ORG-011 | P2 | createMember tests | Missing non-owner caller test |
| EF-ORG-012 | P2 | DentalBranchManagement | No tests for create/list handlers |
| EF-ORG-013 | P3 | DentalMembershipManagement_deactivate | No test for non-owner deactivation |
| EF-ORG-014 | P3 | getOrgContext / getBranchesByUser | User-scoped queries (no IDOR risk — informational) |

---

*Generated by oli-enforce-file --strict | Run ID: run-6-strict-2026-05-29*
