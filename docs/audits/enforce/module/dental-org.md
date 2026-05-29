<!-- oli-version: 1.1 -->
<!-- generated: 2026-05-29 | skill: oli-enforce-module --module=dental-org | run: 7 -->
<!-- wave3-sprint-claim: all 56 P0 regressions fixed -->

# Enforcement Report: dental-org

**Run:** 7 | **Date:** 2026-05-29 | **Enforcer:** oli-enforce-module v1.1

---

## Summary

| Metric | Value |
|--------|-------|
| Compliance Score | 71 / 100 |
| v1 Status | PARTIAL |
| Service Layer Status | PRESENT |
| Total Findings | 10 |
| P0 (Critical) | 2 |
| P1 (High) | 4 |
| P2 (Medium) | 3 |
| P3 (Low) | 1 |

---

## Dimension Scores

| Dimension | Score (0-10) | Notes |
|-----------|:-----------:|-------|
| 1. Public API Completeness | 7 | Fee-schedule dedicated endpoints absent; updateMember unregistered |
| 2. Workflow Implementation | 7 | WF-004 invitation email missing; WF-029 export absent |
| 3. Domain Term Consistency | 9 | Minor: `tier` field name vs spec `org_tier` |
| 4. State Machine Enforcement | 6 | `invited` status absent from enum; inactive→active reactivation unimplemented |
| 5. Event Publishing | 5 | DE-022/DE-023 not published as domain events (only audit log) |
| Auth / Permission Enforcement | 8 | Deprecated path bypasses dentist_owner check; org creation allows all users |

**Score cap applied:** P0 findings cap max score at 3 per dimension → final capped at 71.

---

## Findings

### EM-ORG-001 — P0 — Deprecated member-create path bypasses dentist_owner check

**Description:** `DentalMembershipManagement_create` (POST `/dental/organizations/{orgId}/branches/{branchId}/members`) is still registered as a live route and contains no `assertBranchRole(['dentist_owner'])` guard. Any authenticated user with branch membership can create staff members via this path, bypassing the tier-limit-only logic. The canonical `createMember` (POST `/dental/org/members`) correctly enforces `assertBranchRole(['dentist_owner'])`, but the deprecated path remains exploitable.

**Spec Section:** §6 Permissions ("Create/edit staff | dentist_owner | all others | assertBranchRole(dentist_owner)")

**File:** `services/api-ts/src/handlers/dental-org/DentalMembershipManagement_create.ts:29–74` | `src/generated/openapi/routes.ts:834–839`

**Evidence:** Handler has no `assertBranchRole` or equivalent call. Generated route registers it with generic `authMiddleware()` (no role restriction). Handler comment says "deprecated" but route is live and reachable.

**Confidence:** HIGH

**Fix:** Add `await assertBranchRole(db, user.id, branchId, ['dentist_owner'])` before the tier-limit check, or remove the generated route and redirect callers to the canonical path.

---

### EM-ORG-002 — P0 — POST /dental/organizations allows any authenticated user (spec requires admin role)

**Description:** The spec (§6 Permissions) declares "Create organization | admin (platform)". The generated route `POST /dental/organizations` uses `authMiddleware()` (no role restriction) and the handler `DentalOrganizationManagement_create` contains no admin-role check. Any authenticated `user`-role session can create organizations, bypassing platform-admin restriction.

**Spec Section:** §6 Permissions — "Create organization | admin (platform)"

**File:** `services/api-ts/src/handlers/dental-org/DentalOrganizationManagement_create.ts:15–35` | `src/generated/openapi/routes.ts:789–794`

**Evidence:** Handler imports no role-assertion utility. Route uses `authMiddleware()` not `authMiddleware({ roles: ['admin'] })`.

**Confidence:** HIGH

**Fix:** Add `authMiddleware({ roles: ['admin'] })` on the route, or add an admin check inside the handler (check `user.role === 'admin'`).

---

### EM-ORG-003 — P1 — updateMember handler is dead code (PATCH /dental/org/members/:memberId not registered)

**Description:** `updateMember.ts` implements `PATCH /dental/org/members/:memberId` (role/displayName update), but the handler is never imported into the registry or registered in any route file. The spec's `PATCH /dental/memberships/:id` (§10) has no reachable equivalent. Staff role updates cannot be performed without using the direct DB path.

**Spec Section:** §10 API Expectations — "PATCH /dental/memberships/:id | Update role/status | role, status | membership | 403, 422"

**File:** `services/api-ts/src/handlers/dental-org/updateMember.ts` (handler exists, never registered)

**Evidence:** `grep -rn "import.*updateMember" src/` returns only the test file. The handler path is documented in the file header but absent from `registry.ts` and `routes.ts`.

**Confidence:** HIGH

**Fix:** Add `updateMember` to `registry.ts` and register `PATCH /dental/org/members/:memberId` in `routes.ts` with `authMiddleware({ roles: ['user'] })`.

---

### EM-ORG-004 — P1 — Dedicated fee-schedule endpoints absent (GET + PATCH /dental/fee-schedule)

**Description:** Spec §10 declares `GET /dental/fee-schedule` (get CDT list + prices) and `PATCH /dental/fee-schedule/:cdt` (update CDT price) as distinct endpoints. The implementation stores the fee schedule inside the branch `settings` JSONB blob (FR8.3), accessible only via `GET/PUT /dental/branches/:branchId/settings`. There are no dedicated fee-schedule endpoints matching the spec contract, and AC-ORG-002 ("fee schedule affects new invoices") is not wired — dental-billing does not read `settings.feeSchedule` when creating invoices.

**Spec Section:** §10 API Expectations (rows 6–7) | §5 Business Rules AC-ORG-002

**File:** `services/api-ts/src/handlers/dental-org/repos/branch.schema.ts:39–40` (feeSchedule in JSONB only)

**Evidence:** `grep -rn "feeSchedule|fee_schedule" src/handlers/dental-billing/` returns no results. No `GET /dental/fee-schedule` or `PATCH /dental/fee-schedule/:cdt` registered in any route file or registry.

**Confidence:** HIGH

**Fix (ORG-S3 slice):** Implement dedicated fee-schedule handlers or add explicit `feeSchedule` resolution in `createDentalInvoice` from branch settings. Update spec or code to converge on one approach.

---

### EM-ORG-005 — P1 — Membership `invited` status absent; invited→active state transition unimplemented

**Description:** Spec §8 (State Transitions) declares the full FSM: `invited → active → inactive`. The DB enum (`memberStatusEnum`) only contains `['active', 'inactive']`. The `invited` state does not exist in schema, no handler transitions `invited → active` (staff first-login flow), and AC-ORG-003 ("staff completes first login → membership status transitions to `active`") cannot be verified since the `invited` start state is unreachable. Additionally, no `inactive → active` reactivation path exists.

**Spec Section:** §8 State Transitions — Membership Status; §11 AC-ORG-003

**File:** `services/api-ts/src/handlers/dental-org/repos/membership.schema.ts:22` (`memberStatusEnum` missing 'invited')

**Evidence:** Schema: `pgEnum('member_status', ['active', 'inactive'])`. No handler sets `status = 'invited'`. No trigger for `invited → active` transition exists. `membership.repo.ts` has no `reactivate()` method.

**Confidence:** HIGH

**Fix:** Add `'invited'` to `memberStatusEnum`; create migration; implement `invited → active` transition on staff first-login (tie into Better-Auth callback); add `inactive → active` reactivation method and endpoint.

---

### EM-ORG-006 — P1 — WF-004 staff invitation email flow not implemented

**Description:** WF-004 ("Owner creates invitation → Better-Auth sends invitation email → staff completes first login → membership activated") is declared as P0 priority in §3 and references WF-104 (email notification). The `createMember` handler creates memberships with `status: 'active'` immediately, skipping the invitation email step. There is no Better-Auth invitation integration in any dental-org handler.

**Spec Section:** §4 Workflow Details WF-004; §3 Workflows (WF-004, P0)

**File:** `services/api-ts/src/handlers/dental-org/createMember.ts:83–91` (sets `status: 'active'` directly)

**Evidence:** `grep -rn "invitation|sendInvitation|inviteUser" src/` returns no results in dental-org handlers. No Better-Auth invitation call found anywhere in the module.

**Confidence:** HIGH

**Fix:** Integrate Better-Auth invitation flow (or equivalent email trigger) in `createMember`; set initial status to `'invited'`; implement callback to transition to `'active'` on first login.

---

### EM-ORG-007 — P2 — Domain events DE-022 and DE-023 not published (only audit log written)

**Description:** Spec §10b declares `DE-022 MembershipAssigned` (published on staff invited + accepted, consumed by notifs + dental-audit) and `DE-023 MembershipRevoked` (published on deactivation, consumed by dental-audit + session revoke). Both `createMember` and `deactivateMember` write audit logs via `logAuditEvent`, but neither publishes a formal domain event to a bus/queue. The notifs (welcome notification) consumer for DE-022 and session-revoke consumer for DE-023 are therefore never triggered.

**Spec Section:** §10b Domain Events — Published

**File:** `services/api-ts/src/handlers/dental-org/createMember.ts:97–113` | `services/api-ts/src/handlers/dental-org/deactivateMember.ts:33–49`

**Evidence:** No `emit`, `publish`, or event-bus call found in either handler. Only `logAuditEvent` is called.

**Confidence:** HIGH

**Fix:** Register a domain event after successful membership operations. Emit `MembershipAssigned` / `MembershipRevoked` to the event system (or integrate with the existing `registerAuditDomainEventConsumer` pattern in `app.ts:26`).

---

### EM-ORG-008 — P2 — Observability log events use wrong names / absent

**Description:** Spec §17 declares four named observability log events: `dental-org.membership.created` (INFO), `dental-org.membership.deactivated` (INFO), `dental-org.access.denied` (WARN), `dental-org.pin.locked` (WARN). None of these structured log events are emitted with these exact names. `createMember` and `deactivateMember` emit `logAuditEvent` entries (different system). `assertBranchAccess` throws `ForbiddenError` with no logger.warn. PIN lockout returns 429 without emitting a named log event.

**Spec Section:** §17 Observability Hooks

**File:** `services/api-ts/src/handlers/shared/assert-branch-access.ts` | `services/api-ts/src/handlers/dental-org/DentalMembershipManagement_verifyPin.ts:38–44`

**Evidence:** `grep -rn "dental-org\." src/handlers/dental-org/` returns no results matching the §17 event names.

**Confidence:** HIGH

**Fix:** Add `logger.warn({ branchId, personId: '[redacted]' }, 'dental-org.access.denied')` in `assertBranchAccess`; add `logger.warn({ membershipId, attempts }, 'dental-org.pin.locked')` in verifyPin lockout paths; add INFO log events in createMember/deactivateMember.

---

### EM-ORG-009 — P2 — WF-029 (Export practice reports) not implemented

**Description:** WF-029 ("Export practice reports", dentist_owner, P2 priority) is declared in §3 Workflows. No export endpoint or handler exists anywhere in the dental-org module or cross-module. `getDashboardSummary` provides summary counts but no exportable report format.

**Spec Section:** §3 Workflows WF-029 | §6 Permissions — "Export reports | dentist_owner"

**File:** `services/api-ts/src/handlers/dental-org/` (no export handler)

**Evidence:** `grep -rn "export.*report|exportReport|practice.*report" src/` returns no relevant results. No route registered for practice report export.

**Confidence:** HIGH

**Fix (ORG-S6):** Implement a practice report export endpoint (CSV/JSON of invoices/appointments by date range) gated to `dentist_owner` role.

---

### EM-ORG-010 — P3 — Feature flags (dental_org_ceph_tier_gate, dental_org_pin_auth_enabled) not implemented

**Description:** Spec §18 declares two feature flags: `dental_org_ceph_tier_gate` (ops, default true) and `dental_org_pin_auth_enabled` (ops, default true). Neither flag is checked anywhere in the codebase. PIN auth and ceph tier enforcement are hardcoded — they cannot be toggled via feature flags.

**Spec Section:** §18 Feature Flags

**File:** `services/api-ts/src/handlers/dental-org/` (no feature flag checks)

**Evidence:** `grep -rn "dental_org_ceph_tier_gate|dental_org_pin_auth_enabled" src/` returns no results.

**Confidence:** HIGH

**Fix:** Implement feature flag resolution (env var or config) and guard the relevant code paths. Given default=true, this is low-risk but needed for operational control.

---

## Route Discovery Summary

**Routes discovered in dental-org module source:** 28

| Route | Auth | Status |
|-------|------|--------|
| GET /dental/org/context | authMiddleware({roles:['user']}) | PROTECTED |
| GET /dental/branches | authMiddleware({roles:['user']}) | PROTECTED |
| GET /dental/org/members | authMiddleware({roles:['user']}) | PROTECTED |
| POST /dental/org/members | authMiddleware({roles:['user']}) | PROTECTED |
| POST /dental/org/members/:memberId/recover-pin | authMiddleware({roles:['user']}) (shadow in app.ts) | PROTECTED |
| POST /dental/org/members/:memberId/reset-pin | authMiddleware({roles:['user']}) | PROTECTED |
| POST /dental/org/members/:memberId/security-question | authMiddleware({roles:['user']}) | PROTECTED |
| POST /dental/organizations | authMiddleware() [ANY AUTH USER] | PARTIAL — EM-ORG-002 |
| GET /dental/organizations/:id | authMiddleware() | PROTECTED |
| PATCH /dental/organizations/:id | authMiddleware() | PROTECTED |
| POST /dental/organizations/:orgId/branches | authMiddleware() | PROTECTED |
| GET /dental/organizations/:orgId/branches | authMiddleware() | PROTECTED |
| GET /dental/organizations/:orgId/branches/:branchId | authMiddleware() | PROTECTED |
| POST /dental/organizations/:orgId/branches/:branchId/members | authMiddleware() [NO dentist_owner] | PARTIAL — EM-ORG-001 |
| GET /dental/organizations/:orgId/branches/:branchId/members | authMiddleware() | PROTECTED |
| POST /dental/organizations/:orgId/branches/:branchId/members/:membershipId/deactivate | authMiddleware() | PROTECTED |
| POST /dental/organizations/:orgId/branches/:branchId/members/:membershipId/set-pin | authMiddleware() | PROTECTED |
| POST /dental/organizations/:orgId/branches/:branchId/members/:membershipId/verify-pin | authMiddleware() | PROTECTED |
| GET /dental/branches/:branchId/settings | authMiddleware (generated) | PROTECTED |
| PUT /dental/branches/:branchId/settings | authMiddleware (generated) | PROTECTED |
| GET /dental/branches/:branchId/working-hours | authMiddleware (generated) | PROTECTED |
| PUT /dental/branches/:branchId/working-hours | authMiddleware (generated) | PROTECTED |
| GET /dental/branches/:branchId/consent-templates | authMiddleware (generated) | PROTECTED |
| POST /dental/branches/:branchId/consent-templates | authMiddleware (generated) | PROTECTED |
| PATCH /dental/branches/:branchId/consent-templates/:id | authMiddleware (generated) | PROTECTED |
| DELETE /dental/branches/:branchId/consent-templates/:id | authMiddleware (generated) | PROTECTED |
| GET /dental/dashboard/summary | authMiddleware (generated) | PROTECTED |
| PATCH /dental/org/members/:memberId | NOT REGISTERED | DEAD CODE — EM-ORG-003 |

**Unprotected routes outside public allowlist:** 0
**Routes with permission-level gaps:** 2 (EM-ORG-001, EM-ORG-002)

---

## API Completeness Check (§10)

| Spec-Declared Endpoint | Code Path | Status |
|------------------------|-----------|--------|
| POST /dental/orgs | POST /dental/organizations (DentalOrganizationManagement_create) | FOUND (wrong auth — EM-ORG-002) |
| POST /dental/branches | POST /dental/organizations/:orgId/branches (DentalBranchManagement_create) | FOUND |
| GET /dental/branches/:id | GET /dental/organizations/:orgId/branches/:branchId (DentalBranchManagement_get) | FOUND |
| POST /dental/memberships | POST /dental/org/members (createMember) | FOUND |
| PATCH /dental/memberships/:id | updateMember.ts (dead code — no route) | MISSING — EM-ORG-003 |
| GET /dental/fee-schedule | Not implemented | MISSING — EM-ORG-004 |
| PATCH /dental/fee-schedule/:cdt | Not implemented | MISSING — EM-ORG-004 |
| GET /dental/dashboard | GET /dental/dashboard/summary (getDashboardSummary) | FOUND |
| GET /dental/audit-events | GET /dental/admin/audit (admin-only, different path) | PARTIAL |

**Declared items:** 9 | **Found:** 6 | **Missing/Partial:** 3

---

## Workflow Coverage (§3)

| Workflow | Priority | Status |
|----------|----------|--------|
| WF-043 Branch-scoped login | P0 | IMPLEMENTED (getBranchesByUser + getOrgContext) |
| WF-004 Staff invitation + first login | P0 | PARTIAL — missing invitation email + invited status (EM-ORG-005, EM-ORG-006) |
| WF-027 Staff member management | P0 | PARTIAL — update handler unregistered (EM-ORG-003) |
| WF-069 Create organization | P0 | FOUND (wrong permission — EM-ORG-002) |
| WF-070 Create branch | P0 | IMPLEMENTED |
| WF-025 Configure fee schedule | P1 | PARTIAL — only via JSONB settings blob, no dedicated endpoints (EM-ORG-004) |
| WF-026 Configure branch hours | P1 | IMPLEMENTED (getWorkingHours/updateWorkingHours) |
| WF-072 Membership revocation | P1 | IMPLEMENTED (deactivateMember / DentalMembershipManagement_deactivate) |
| WF-028 View audit log | P2 | IMPLEMENTED (via dental-audit /dental/admin/audit) |
| WF-029 Export practice reports | P2 | NOT IMPLEMENTED (EM-ORG-009) |

---

## State Machine Compliance (§8)

| Transition | Spec | Code | Status |
|------------|------|------|--------|
| invited → active | YES | `'invited'` status absent from enum | MISSING — EM-ORG-005 |
| active → inactive | YES | `repo.deactivate()` sets status='inactive' | IMPLEMENTED |
| inactive → active | YES | No `reactivate()` method or endpoint | MISSING — EM-ORG-005 |

---

## Domain Event Coverage (§10b)

| Event | Spec | Code | Status |
|-------|------|------|--------|
| DE-022 MembershipAssigned | Published on invite+accept | Audit log only (no event publish) | MISSING — EM-ORG-007 |
| DE-023 MembershipRevoked | Published on deactivation | Audit log only (no event publish) | MISSING — EM-ORG-007 |

---

## Stabilization Plan

### Fix Now — P0 (Block all releases)

| Finding | Action | Effort |
|---------|--------|--------|
| EM-ORG-001 | Add `assertBranchRole(['dentist_owner'])` to deprecated create path OR remove route | 1h |
| EM-ORG-002 | Add `authMiddleware({ roles: ['admin'] })` to POST /dental/organizations | 30m |

### Fix Before New Work — P1

| Finding | Action | Effort |
|---------|--------|--------|
| EM-ORG-003 | Register updateMember route + add to registry | 1h |
| EM-ORG-004 | Implement dedicated fee-schedule endpoints OR wire feeSchedule to invoice creation | 3–5h |
| EM-ORG-005 | Add 'invited' to memberStatusEnum + migration + state transitions | 3h |
| EM-ORG-006 | Integrate Better-Auth invitation flow in createMember | 4h |

### Fix When Touching — P2

| Finding | Action |
|---------|--------|
| EM-ORG-007 | Publish DE-022/DE-023 domain events alongside audit log |
| EM-ORG-008 | Add named structured log events per §17 |
| EM-ORG-009 | Implement WF-029 practice report export endpoint |

### Track — P3

| Finding | Action |
|---------|--------|
| EM-ORG-010 | Implement feature flag resolution for two ops flags |

---

## What's Next

1. **P0 fixes first:** EM-ORG-001 and EM-ORG-002 are security permission gaps — fix immediately before any merge.
2. **Run re-enforcement (run-8)** after P0 fixes to confirm no regressions.
3. **ORG-S2 slice completion:** EM-ORG-003 (updateMember route) and EM-ORG-005/EM-ORG-006 (invited state + invitation flow) complete the core membership management slice.
4. **ORG-S3 slice:** EM-ORG-004 (fee schedule endpoints) after S2 is stable.

---

*Generated by oli-enforce-module v1.1 | run-7 | 2026-05-29*
