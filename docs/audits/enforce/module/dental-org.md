# dental-org — Module Enforcement
<!-- oli-enforce-module v1.0 | run: run-6-strict-2026-05-29 | 2026-05-29 -->
<!-- supersedes: run-5 (2026-05-28) -->

## Summary

| Metric | run-5 | run-6 |
|--------|-------|-------|
| P0 findings | 6 | 4 |
| P1 findings | 7 | 7 |
| P2 findings | 3 | 4 |
| P3 findings | 2 | 2 |
| Score | 54 | 59 |
| v1 status | PARTIAL | PARTIAL |
| Resolved (run-5→run-6) | — | 5 |
| New findings | — | 3 |

### Dimension Scores

| Dimension | run-5 | run-6 | Delta | Notes |
|-----------|-------|-------|-------|-------|
| 1. Public API Completeness | 7/10 | 7/10 | 0 | Fee schedule still missing; dashboard route path mismatch persists |
| 2. Workflow Implementation | 6/10 | 6/10 | 0 | WF-004 invited status absent; WF-025 backend absent |
| 3. Domain Term Consistency | 8/10 | 8/10 | 0 | `revoked` undeclared in schema enum (only in API_CONTRACTS) |
| 4. State Machine Enforcement | 4/10 | 4/10 | 0 | `invited` missing from `memberStatusEnum` |
| 5. Event Publishing | 3/10 | 3/10 | 0 | OrgCreated / MembershipCreated / MembershipRevoked not emitted |
| 6. Auth / Unprotected Routes | 4/10 | 6/10 | +2 | setPin + verifyPin now have authMiddleware; recoverPin + createMember role gate + branchCreate open |

**Overall score: 59/100** (up from 54; 5 resolutions offset by 3 new findings)

---

## Findings

| ID | Sev | Status | Description | File | Line | Spec Ref |
|----|-----|--------|-------------|------|------|----------|
| EM-ORG-001 | P0 | **OPEN** | `recoverPin` route registered without `authMiddleware` — unauthenticated access | `generated/openapi/routes.ts` | ~767 | BR-016, §6 |
| EM-ORG-002 | P0 | **RESOLVED** | `DentalMembershipManagement_setPin` route now has `authMiddleware()` | — | — | §6 |
| EM-ORG-003 | P0 | **RESOLVED** | `DentalMembershipManagement_verifyPin` route now has `authMiddleware()` | — | — | §6 |
| EM-ORG-004 | P0 | **RESOLVED** | `DentalMembershipManagement_setPin` now enforces self/dentist_owner check | `setPin.ts` | 46-49 | §6 |
| EM-ORG-005 | P0 | **RESOLVED** | `listMembers` now strips `pinHash`, `securityAnswerHash`, `securityQuestion` | `listMembers.ts` | 38 | §6, §15 |
| EM-ORG-006 | P0 | **OPEN** | `DentalOrganizationManagement_get` has no ownership/membership check — IDOR on org | `DentalOrganizationManagement_get.ts` | 25 | §5 BR-ORG-001 |
| EM-ORG-007 | P1 | **PARTIAL** | `deactivateMember.ts` uses `assertBranchRole(['dentist_owner'])` ✅; `DentalMembershipManagement_deactivate.ts` uses org-owner identity check only — see EM-ORG-020 | `DentalMembershipManagement_deactivate.ts` | 42 | §6 perm matrix |
| EM-ORG-008 | P1 | **OPEN** | `createMember` calls `assertBranchAccess` but no `dentist_owner` role gate — any branch member can add staff | `createMember.ts` | 54 | §6 perm matrix |
| EM-ORG-009 | P1 | **OPEN** | `DentalBranchManagement_create` lacks org ownership check — any authenticated user can create branches under any org | `DentalBranchManagement_create.ts` | 26 | §5 BR-ORG-002 |
| EM-ORG-010 | P1 | **RESOLVED** | `DentalOrganizationManagement_update` has `ownerPersonId !== user.id` check | `DentalOrganizationManagement_update.ts` | 38 | §5 BR-ORG-001 |
| EM-ORG-011 | P1 | **OPEN** | `GET /dental/fee-schedule` + `PATCH /dental/fee-schedule/:cdt` not implemented — no table, no handlers, no routes; frontend `fee-schedule.tsx` exists with no backend | (no file) | — | API_CONTRACTS §6-7, AC-ORG-002 |
| EM-ORG-012 | P1 | **OPEN** | Membership `invited` status absent from `memberStatusEnum` (only `active`/`inactive`) — WF-004 invitation state machine broken | `repos/membership.schema.ts` | 22 | §8 state machine, WF-004 |
| EM-ORG-013 | P2 | **OPEN** | `OrgCreated`, `MembershipAssigned` (DE-022), `MembershipRevoked` (DE-023) events never emitted — no event bus / publish calls in any handler | `createMember.ts`, `deactivateMember.ts` | — | §10b domain events |
| EM-ORG-014 | P2 | **OPEN** | `getBranchesByUser`, `branchSettings.ts`, `consentTemplates.ts` call Drizzle inline — F2 fat-handler violation | `getBranchesByUser.ts:17`, `branchSettings.ts:42`, `consentTemplates.ts:38` | — | F2 service-layer |
| EM-ORG-015 | P2 | **PARTIAL** | `updateMember` strips `pinHash` but `securityAnswerHash`/`securityQuestion` not explicitly stripped — verify `repo.updateOneById` projection does not return them | `updateMember.ts` | 67 | §15 credential safety |
| EM-ORG-016 | P3 | **OPEN** | `DentalMembershipManagement_verifyPin` facade skips `trackLastLogin` (present in `verifyPin.ts`) — FR6.4 absent | `DentalMembershipManagement_verifyPin.ts` | — | FR6.4 |
| EM-ORG-017 | P3 | **OPEN** | Audit route uses `roles: ['admin']` but spec requires `dentist_owner`-level access | `app.ts` | 193 | §6, API_CONTRACTS |
| EM-ORG-018 | P1 | **NEW** | Dashboard route registered as `GET /dental/dashboard/summary` but spec §10 declares `GET /dental/dashboard` — path mismatch breaks spec-compliant clients | `generated/openapi/routes.ts` | 592 | §10 API Expectations |
| EM-ORG-019 | P2 | **NEW** | Feature flags `dental_org_ceph_tier_gate` and `dental_org_pin_auth_enabled` declared in §18 but no feature-flag infrastructure exists anywhere in the codebase — flags have no runtime effect | (no file) | — | §18 Feature Flags |
| EM-ORG-020 | P1 | **NEW** | `DentalMembershipManagement_deactivate` checks `ownerPersonId === user.id` (identity) not role — a `dentist_owner` role member who is not the org creator cannot deactivate; contradicts §6 permission matrix | `DentalMembershipManagement_deactivate.ts` | 42 | §6 perm matrix, BR-016 |

---

## Dimension Detail

### 1. Public API Completeness (7/10)

**Declared in MODULE_SPEC §10:**

| Endpoint | Handler File | Route Registration | Status |
|----------|-------------|-------------------|--------|
| `POST /dental/orgs` | `DentalOrganizationManagement_create.ts` | `generated/routes.ts` | FOUND |
| `POST /dental/branches` | `DentalBranchManagement_create.ts` | `generated/routes.ts` | FOUND |
| `GET /dental/branches/:id` | `DentalBranchManagement_get.ts` | `generated/routes.ts` | FOUND |
| `POST /dental/memberships` | `createMember.ts` + deprecated shim | `routes.ts`, `app.ts` | FOUND |
| `PATCH /dental/memberships/:id` | `updateMember.ts` | `app.ts` | FOUND |
| `GET /dental/fee-schedule` | **(no file)** | **(not registered)** | **MISSING → EM-ORG-011** |
| `PATCH /dental/fee-schedule/:cdt` | **(no file)** | **(not registered)** | **MISSING → EM-ORG-011** |
| `GET /dental/dashboard` | `getDashboardSummary.ts` | `routes.ts:592` as `/dental/dashboard/summary` | **PATH MISMATCH → EM-ORG-018** |
| `GET /dental/audit-events` | `dental-audit/getAuditEvents.ts` | `app.ts:193` | FOUND (correct proxy) |

### 2. Workflow Implementation (6/10)

**WF-004 (Staff Invitation + First Login):**
- No `sendInvitation` / `inviteUser` calls found in any dental-org handler
- `invited` status absent from schema enum — membership cannot be created in `invited` state
- No `invited → active` first-login hook wired anywhere
- WF-004 is **effectively unimplemented at backend level**

**WF-025 (Configure Fee Schedule):**
- No `dental_fee_schedule` table
- No `getFeeSchedule.ts` or `patchFeeSchedule.ts` handlers
- Frontend `fee-schedule.tsx` renders UI but has no backend calls
- WF-025 is **fully unimplemented**

### 3. Domain Term Consistency (8/10)

Terms from §2 used consistently. One gap: API_CONTRACTS documents `status: "revoked"` as valid enum value for `PATCH /dental/memberships/:id`, but `memberStatusEnum` only has `['active', 'inactive']`. Term `revoked` is undeclared in schema.

### 4. State Machine Enforcement (4/10)

**Spec §8 declares:** `invited → active → inactive`

- `memberStatusEnum` = `['active', 'inactive']` — `invited` missing (EM-ORG-012)
- `assertBranchAccess` correctly requires `status = 'active'`
- No state transition guard in `updateMember` — can jump to any status without checking current state
- No `invited → active` first-login hook

### 5. Event Publishing (3/10)

**Spec §10b declares:** `OrgCreated`, `MembershipCreated` (DE-022), `MembershipRevoked` (DE-023)

Zero `emit` / `publish` / `eventBus` calls in any dental-org handler. Audit logging via `logAuditEvent` (structured logging to audit table) is present only in verifyPin handlers — this partially satisfies §17 Observability but does NOT satisfy §10b domain events.

**Observability hooks (§17) wired vs. required:**

| Hook | Required | Status |
|------|---------|--------|
| `dental-org.membership.created` | INFO on staff activated | ❌ not wired |
| `dental-org.membership.deactivated` | INFO on staff deactivated | ❌ not wired |
| `dental-org.access.denied` | WARN on assertBranchAccess fail | ❌ not wired |
| `dental-org.pin.locked` | WARN on PIN lockout | ❌ not wired (lockout logic runs; no log) |
| PIN verification audit log | CF-46/AUTH-07 | ✅ `logAuditEvent` in verifyPin |

### 6. Auth / Unprotected Route Detection (6/10 — up from 4/10)

| Route | authMiddleware | Role Gate | Issues |
|-------|---------------|-----------|--------|
| `POST /dental/org/members/:memberId/recover-pin` | ❌ MISSING | — | EM-ORG-001 |
| `POST .../set-pin` | ✅ | self/owner in handler | RESOLVED |
| `POST .../verify-pin` | ✅ | additive PIN check | RESOLVED |
| `POST .../deactivate` (generated) | ✅ | identity not role | EM-ORG-020 |
| `GET /dental/organizations/:id` | ✅ | no ownership check | EM-ORG-006 IDOR |
| `POST /dental/organizations/:orgId/branches` | ✅ | no ownership check | EM-ORG-009 |
| `POST /dental/org/members` | ✅ | no dentist_owner gate | EM-ORG-008 |

---

## Strict Additions Assessment

### PIN Auth Lockout Mechanism (BR-016b)
**IMPLEMENTED.** `verifyPin.ts` and `DentalMembershipManagement_verifyPin.ts`:
- Check `repo.isLockedOut(member)` before verifying — returns 429 with `lockedUntil`
- Call `repo.recordFailedPinAttempt(membershipId)` on wrong PIN
- Re-check lockout after failed attempt
- Schema: `pin_failed_attempts` (default 0), `pin_locked_until` (nullable timestamp)
- `resetMemberPin.ts` provides owner-triggered lockout clearing (§13 edge case covered)

### verifyPin Session Integration (§20)
**CORRECTLY IMPLEMENTED.** PIN auth is additive, not replacement:
- Requires prior session auth via `authMiddleware()` (resolved EM-ORG-003)
- Checks `user.id` from session before processing
- Writes audit log on success (CF-46/AUTH-07)
- Returns `{ success: bool, failedAttempts: N }` — does NOT issue tokens

### Dashboard Scope and Stats (§10, §16)
**PARTIALLY IMPLEMENTED.** `getDashboardSummary.ts`:
- Requires `branchId` query param ✅
- Calls `assertBranchAccess` ✅
- Aggregates `activePaymentPlans` (count, behindCount, totalOutstandingCents) + `labOrders`
- **MISSING vs spec "practice summary stats":** no patient count, today's appointments, upcoming appointments, revenue KPIs
- Route at `/dental/dashboard/summary` — path mismatch (EM-ORG-018)

### Audit Events Handler Location (§10 `GET /dental/audit-events`)
**CORRECT ARCHITECTURE.** `GET /dental/audit-events` proxied to `dental-audit/getAuditEvents.ts` via `app.ts:193`. The dental-audit module owns storage/retrieval per §14 dependencies. This is the correct split.

---

## F2: Service-Layer / DI Assessment

### Pattern Summary (PARTIAL — unchanged from run-5)

- `MembershipRepository`, `BranchRepository`, `OrganizationRepository` used correctly in most handlers
- `assertBranchAccess` and `assertBranchRole` abstracted as shared utilities
- **Fat handlers still present:** `getBranchesByUser.ts`, `branchSettings.ts`, `consentTemplates.ts` contain inline Drizzle outside repository pattern
- No `.service.ts` files — business logic embedded in handlers

### F2 Verdict
PARTIAL. Core CRUD uses repositories correctly. Three fat handlers remain. No service orchestration layer. EM-ORG-014 unchanged.

---

## Resolved Findings (run-5 → run-6)

| ID | What changed |
|----|-------------|
| EM-ORG-002 | `DentalMembershipManagement_setPin` route now has `authMiddleware()` in `generated/openapi/routes.ts` |
| EM-ORG-003 | `DentalMembershipManagement_verifyPin` route now has `authMiddleware()` in `generated/openapi/routes.ts` |
| EM-ORG-004 | `DentalMembershipManagement_setPin` enforces self/owner gate via `callerMembership.role !== 'dentist_owner'` |
| EM-ORG-005 | `listMembers.ts:38` strips `pinHash`, `securityAnswerHash`, `securityQuestion` from all returned objects |
| EM-ORG-010 | `DentalOrganizationManagement_update.ts:38` checks `existing.ownerPersonId !== user.id` before mutation |

---

## Stabilization Plan

### Fix immediately (P0):
- **EM-ORG-001**: Add `authMiddleware({ roles: ["user"] })` to `recoverPin` route at `generated/openapi/routes.ts:767`
- **EM-ORG-006**: Add ownership/membership check to `DentalOrganizationManagement_get.ts` — verify `org.ownerPersonId === user.id` OR caller has active membership in any branch of this org

### Fix before new feature work (P1):
- **EM-ORG-008**: Add `assertBranchRole(db, user.id, branchId, ['dentist_owner'])` to `createMember.ts` after `assertBranchAccess`
- **EM-ORG-009**: Add org-ownership check to `DentalBranchManagement_create.ts` — fetch org, verify `org.ownerPersonId === user.id`
- **EM-ORG-011**: Implement fee schedule — `dental_fee_schedule` schema table, migration, `getFeeSchedule.ts` + `patchFeeSchedule.ts` handlers, routes
- **EM-ORG-012**: Add `invited` to `memberStatusEnum`; generate migration; wire `invited → active` transition on first login
- **EM-ORG-018**: Fix route — register at `GET /dental/dashboard` (per spec) or update TypeSpec + CONTRACT.md to declare `/dental/dashboard/summary`
- **EM-ORG-020**: Replace `ownerPersonId === user.id` identity check in `DentalMembershipManagement_deactivate.ts` with `assertBranchRole(db, user.id, branchId, ['dentist_owner'])` to match `deactivateMember.ts` pattern

### Fix when touching (P2):
- **EM-ORG-013**: Publish `OrgCreated`, `MembershipAssigned`, `MembershipRevoked` events from respective handlers
- **EM-ORG-014**: Extract inline Drizzle calls in `getBranchesByUser.ts`, `branchSettings.ts`, `consentTemplates.ts` into repositories
- **EM-ORG-015**: Verify `MembershipRepository.updateOneById` projection — if `securityAnswerHash`/`securityQuestion` can be returned, add destructure-strip (matching `listMembers.ts:38`)
- **EM-ORG-019**: Either implement feature-flag infrastructure (env-var or LaunchDarkly) or remove §18 declarations and use direct config checks

### Track (P3):
- **EM-ORG-016**: Add `trackLastLogin` to `DentalMembershipManagement_verifyPin.ts`
- **EM-ORG-017**: Change audit route auth from `roles: ['admin']` to `dentist_owner` role check

---

## Notes

**PIN lockout confirmed complete (BR-016b):** Full brute-force protection in place. `pin_locked_until` + `pin_failed_attempts` in schema. `resetMemberPin.ts` enables owner-triggered lockout clearing per §13 edge case.

**assertBranchRole exists and is underused:** `services/api-ts/src/handlers/shared/assert-branch-role.ts` implemented, used in `deactivateMember.ts`. Should replace manual inline role checks in `updateMember.ts` and be added to `createMember.ts` and `DentalMembershipManagement_deactivate.ts`.

**Fee schedule frontend ahead of backend:** `apps/dentalemon/src/features/settings/components/fee-schedule.tsx` exists but will fail at runtime. EM-ORG-011 is blocking for ORG-S3 (P1 slice).

**Dashboard content narrower than spec:** Returns payment plan + lab order data only. Spec §10 says "practice summary stats". Patient count, appointment counts, revenue KPIs absent. Spec tightening or handler expansion needed.

**Test coverage solid for existing features:** `updateMember.test.ts`, `verifyPin.test.ts`, `createMember.test.ts`, `deactivateMember.test.ts`, `resetMemberPin.test.ts`, `listMembers.test.ts` exist. Tests use `buildTestApp()` (unit-level). Per project memory [Tests must verify real wiring], supplement with real-server integration tests for route registration gaps.

**AC-ORG coverage:**
- AC-ORG-001 (branch access enforced): `assertBranchAccess` wired in most handlers ✅
- AC-ORG-002 (fee schedule affects new invoices): untestable — backend not implemented ❌
- AC-ORG-003 (staff invitation flow): `invited` status missing — flow broken ❌
