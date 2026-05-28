# RBAC / Permission Middleware Audit

**Module:** #17 — Permission / RBAC Middleware (P0)
**Auditor:** Senior Code Reviewer — Security & Auth Specialist
**Date:** 2026-05-26
**Scope:** Backend authorization utilities (`assertBranchAccess`, `assertBranchRole`), frontend RBAC (`rbac.ts`, `guards.ts`), `org-context.store.ts`, route guards on all `_dashboard/*` routes, and dental handler coverage gaps. Auth middleware (`auth.ts`) reviewed for role-type handling.

**Prior context (do not re-report):** AUTH-01 (CF-37), AUTH-02 (CF-38), AUTH-03 (CF-39), AUTH-05 (CF-45), Settings F1 (CF-40), Settings F2 (CF-41).

---

## Findings Summary

| ID | Severity | Gate | Finding | File |
|----|----------|------|---------|------|
| RBAC-F1 | P0 | G2 | `DentalMembershipManagement_create` (TypeSpec-generated endpoint) has no `assertBranchAccess` or `assertBranchRole` — any authenticated `user` can create a member in any org/branch by guessing UUIDs | `handlers/dental-org/DentalMembershipManagement_create.ts` |
| RBAC-F2 | P0 | G2 | `DentalMembershipManagement_deactivate` (TypeSpec-generated endpoint) has no `assertBranchAccess` — any authenticated `user` can deactivate any membership globally | `handlers/dental-org/DentalMembershipManagement_deactivate.ts` |
| RBAC-F3 | P0 | G2 | `createMember` / `deactivateMember` check only branch membership (`assertBranchAccess`) — any branch member (including `staff_scheduling`) can add new members or deactivate colleagues, bypassing the owner-only intent from PRD | `handlers/dental-org/createMember.ts`, `deactivateMember.ts` |
| RBAC-F4 | P0 | G2 | `hygienist` role exists in `VALID_MEMBER_ROLES` and is used in `assertBranchRole` calls for clinical writes, but has no entry in the frontend `ACCESS_MATRIX`. A `hygienist` member who successfully authenticates gets `null` role in the Zustand store, causing `requireRole` to always redirect them to `/dashboard` — complete UI lockout | `repos/membership.schema.ts`, `utils/rbac.ts`, `utils/guards.ts` |
| RBAC-F5 | P1 | G2 | `DentalMembershipManagement_list` has no `assertBranchAccess` — authenticated user with no branch membership can call `GET /dental/organizations/{orgId}/branches/{branchId}/members/` and receive member roster | `handlers/dental-org/DentalMembershipManagement_list.ts` |
| RBAC-F6 | P1 | G3 | `dashboard`, `patients`, `calendar`, `workspace`, and `_workspace/*` routes have no `requireRole` guard — any user who has a Better-Auth session and a `branchId` in the Zustand store can access these routes without a PIN session or dental role | `routes/_dashboard/dashboard.tsx`, `routes/_dashboard/patients.tsx`, `routes/_dashboard/calendar.tsx`, `routes/_workspace.tsx` |
| RBAC-F7 | P1 | G4 | `settings.tsx` and `reports.tsx` component bodies default `role` to `'dentist_owner'` when Zustand store returns `null`, rendering full owner-level UI to any user before the `requireRole` guard (a `beforeLoad` redirect) can fire if a race or hard-refresh occurs | `routes/_dashboard/settings.tsx:22`, `routes/_dashboard/reports.tsx:25` |
| RBAC-F8 | P1 | G2 | Treatment template mutation handlers (`createTreatmentTemplate`, `updateTreatmentTemplate`, `deleteTreatmentTemplate`, `applyTemplate`) have no `assertBranchRole` or `assertBranchAccess` — any authenticated `user` can create or delete treatment templates for any branch | `handlers/dental-visit/createTreatmentTemplate.ts`, `updateTreatmentTemplate.ts`, `deleteTreatmentTemplate.ts`, `applyTemplate.ts` |
| RBAC-F9 | P2 | G8 | No test asserts that `createMember` or `deactivateMember` (flat endpoints) require `dentist_owner` role — the existing `createMember.test.ts` and `deactivateMember.test.ts` only verify authentication and branch membership, not role elevation | `handlers/dental-org/createMember.test.ts`, `deactivateMember.test.ts` |
| RBAC-F10 | P2 | G8 | `DentalMembershipManagement_create` and `DentalMembershipManagement_deactivate` have no test file for authorization at all — the TypeSpec-generated path is entirely uncovered | `handlers/dental-org/DentalMembershipManagement_create.ts` |
| RBAC-F11 | P2 | G4 | `requireRole` guard (in `guards.ts`) checks if `role` is null and redirects, but does not check whether a PIN session is active. A user whose store has a stale role value from a previous session (page reload without PIN re-entry) passes the guard without fresh PIN authentication. This extends AUTH-05 (CF-45) | `utils/guards.ts` |
| RBAC-F12 | P3 | G2 | No centralized role-permission matrix document on the backend. Frontend has `ACCESS_MATRIX` in `rbac.ts`; backend enforces roles per-handler in `assertBranchRole` call sites. Permissible role lists are scattered with no single source of truth for the security model | `handlers/shared/assert-branch-role.ts`, `utils/rbac.ts` |

---

## Gate-by-Gate Analysis

### Gate 2 — Role and Permission Map

#### Authorization Architecture Overview

The system uses two separate authorization layers that operate independently:

**Backend layer (server-enforced):**
- `authMiddleware()` — validates Better-Auth session and system role (`user`, `admin`). Called by generated routes for nearly all dental endpoints. Enforces only that a valid JWT/session exists. Does NOT check dental membership role.
- `assertBranchAccess(db, userId, branchId)` — queries `dental_memberships` WHERE `personId = userId AND branchId = branchId AND status = 'active'`. Throws `ForbiddenError` if no match. Checks branch membership only, not role level.
- `assertBranchRole(db, userId, branchId, allowedRoles[])` — same query as above, additionally checks `membership.role IN allowedRoles`. This is the only mechanism that enforces the dental role hierarchy server-side.

**Frontend layer (client-enforced only):**
- `ACCESS_MATRIX` in `rbac.ts` — static boolean map of `DentalRole → DentalModule → boolean`.
- `canAccess(role, module)` — reads from `ACCESS_MATRIX`.
- `requireRole(module)` — `beforeLoad` guard that reads `useOrgContextStore.getState().role` (Zustand in-memory state) and redirects if `canAccess` fails. No server validation.
- `useOrgContextStore` — populated by `_dashboard.tsx` layout's `beforeLoad` from `GET /dental/org/context` API response, which returns `member.role` from the DB. Populated correctly at load time.

#### What `assertBranchAccess` Actually Checks

`assertBranchAccess` confirms only that a `dental_memberships` row exists for `personId = user.id` and `branchId` with `status = 'active'`. It does NOT distinguish between `dentist_owner`, `staff_full`, `staff_scheduling`, or any other role. Every branch member passes this check identically.

Handlers that use `assertBranchAccess` (branch membership confirmed, role not checked):
- `createMember`, `deactivateMember`, `listMembers` (flat endpoints)
- `branchSettings.ts` (GET path), `consentTemplates.ts`, `getDashboardSummary.ts`, `pinRecovery.ts`
- Clinical reads: `listMedicalHistory`, `listLabOrders`, `listConsentForms`, `listPrescriptions`, `listAttachments`, `listAmendments`
- Visit reads: `getDentalChart`, `getToothHistory`, `getDentalVisit`, `listDentalVisits`, `listDentalTreatments`, `getTreatmentPlan`, `getTreatmentPlanVersion`, `getVisitNotes`

Handlers that use `assertBranchRole` (branch membership + role enforced):
- `branchSettings.ts` (PUT path) — `['dentist_owner']`
- Clinical writes: `createAttachment`, `deleteAttachment` — `['dentist_owner', 'dentist_associate', 'hygienist']`
- `createLabOrder`, `updateLabOrder` — `['dentist_owner', 'dentist_associate']`
- `createPrescription`, `updatePrescription` — `['dentist_owner', 'dentist_associate']`
- `signConsentForm`, `createConsentForm` — `['dentist_owner', 'dentist_associate', 'hygienist']` / `['dentist_owner', 'dentist_associate']`
- `createMedicalHistoryEntry`, `updateMedicalHistoryEntry` — `['dentist_owner', 'dentist_associate', 'hygienist', 'staff_full']`
- Visit writes: `createDentalTreatment` — `['dentist_owner', 'dentist_associate']`
- `createVisitNoteAddendum` — `['dentist_owner', 'dentist_associate', 'hygienist']`
- Billing: all 15 billing handlers use `assertBranchRole` — confirmed coverage

**The role matrix as implemented in `assertBranchRole` call sites is correct for the handlers that use it.** The gaps are in handlers that use neither function (RBAC-F1, RBAC-F2, RBAC-F8) or use only `assertBranchAccess` for operations that should be owner-restricted (RBAC-F3).

#### RBAC-F1 / RBAC-F2 — TypeSpec-Generated Endpoints with No Authorization (P0)

`DentalMembershipManagement_create` (POST `/dental/organizations/{orgId}/branches/{branchId}/members/`) and `DentalMembershipManagement_deactivate` (POST `/dental/organizations/{orgId}/branches/{branchId}/members/{membershipId}/deactivate`) are generated-route handlers that implement only authentication (`if (!user?.id) throw UnauthorizedError`). Neither calls `assertBranchAccess` or `assertBranchRole`.

These endpoints are distinct from the flat `createMember`/`deactivateMember` endpoints. They are mounted via the generated `routes.ts` with `authMiddleware()` only (system-role check). Any authenticated Better-Auth `user`, regardless of dental membership, can:
- Create a new member under any org/branch they can guess the UUIDs for.
- Deactivate any membership globally by guessing the `membershipId` UUID.

The flat endpoints (`POST /dental/org/members`, `DELETE /dental/org/members/:memberId`) are partially protected by `assertBranchAccess`. The TypeSpec-generated equivalents have zero branch-level gating.

**Attack vector:** Authenticated user of Org-B calls `POST /dental/organizations/{ORG_A_ID}/branches/{BRANCH_A_ID}/members/` → creates a `dentist_owner` membership under Org A. They can then use that membership to access all Org A patient data. Complete tenant boundary bypass.

#### RBAC-F3 — `createMember`/`deactivateMember` Allow Any Branch Member, Not Just Owner (P0)

The flat `createMember` and `deactivateMember` handlers call `assertBranchAccess` but not `assertBranchRole`. Any `staff_scheduling` or `staff_full` member of a branch can create new members (including `dentist_owner` role) or deactivate any colleague. The PRD (and the existing `branchSettings.ts` pattern) clearly intends these operations to be `dentist_owner`-only.

Evidence: `branchSettings.ts` explicitly checks `if (!role || role !== 'dentist_owner') throw new ForbiddenError(...)` for its PUT path. The same constraint is absent in the member management flat endpoints.

Previously reported as Settings F1 and F2 (CF-40, CF-41) in the Auth audit for the deactivateMember/createMember absence of owner check. This finding provides the technical root cause: the flat endpoints use `assertBranchAccess` where they should use `assertBranchRole(db, user.id, branchId, ['dentist_owner'])`.

#### RBAC-F4 — `hygienist` Role Backend/Frontend Mismatch (P0)

`VALID_MEMBER_ROLES` in `membership.schema.ts`:
```
['dentist_owner', 'dentist_associate', 'staff_full', 'staff_scheduling', 'hygienist']
```

Frontend `DentalRole` type in `rbac.ts`:
```typescript
export type DentalRole = 'dentist_owner' | 'dentist_associate' | 'staff_full' | 'staff_scheduling';
```

`ACCESS_MATRIX` has no `hygienist` key. `canAccess('hygienist', module)` returns `false` for all modules (the `?? false` fallback). When the `_dashboard.tsx` `beforeLoad` fetches `/dental/org/context` and the member has `role: 'hygienist'`, the Zustand store is set with `role: 'hygienist'`. `requireRole` casts this to `DentalRole | null` — technically it is not null, so the null branch does not fire. But `canAccess` returns `false` for every module, so `requireRole('settings')`, `requireRole('billing')`, etc., all redirect to `/dashboard`. The `/dashboard` route itself has no `requireRole` guard, so a `hygienist` lands there and sees the morning briefing with full `dentist_owner` role fallback rendering (see RBAC-F7).

The `hygienist` role is actively used by `assertBranchRole` on the backend for clinical writes (attachments, consent forms, visit note addenda, medical history). A `hygienist` with valid credentials is completely locked out of any navigation while backend role checks correctly allow them to perform clinical work — a nonfunctional state.

#### RBAC-F5 — `DentalMembershipManagement_list` No Branch Access Check (P1)

`GET /dental/organizations/{orgId}/branches/{branchId}/members/` (TypeSpec-generated handler `DentalMembershipManagement_list`) checks `if (!user?.id) throw UnauthorizedError` only. No `assertBranchAccess`. Any authenticated user can enumerate the member roster of any branch.

This exposes display names, role assignments, avatar URLs, and member IDs for all active staff — information that could be used to target `verifyPin` attacks (AUTH-02).

#### Is There a Role Matrix Document?

No. There is no backend constant or document defining the authoritative role-permission matrix. The frontend `ACCESS_MATRIX` in `rbac.ts` is the closest approximation. Backend enforcement is scattered across `assertBranchRole` call sites, with no guarantee of consistency. Specifically, `hygienist` appears in backend allowed-roles lists but is absent from the frontend matrix — this is a direct consequence of the absence of a shared source of truth.

#### Permission Tiers (CLINICAL_WRITE, BILLING_WRITE)

No formal tier constants exist in the codebase. The permission model is implicitly:
- **Read (any branch member):** protected by `assertBranchAccess` — patient records, visit data, clinical lists
- **Clinical write:** `assertBranchRole(['dentist_owner', 'dentist_associate'])` or with `hygienist` for attachments/consent
- **Billing write:** `assertBranchRole(['dentist_owner', 'dentist_associate', 'staff_full'])` for invoices; `['dentist_owner']` for voids
- **Org administration (owner only):** `assertBranchRole(['dentist_owner'])` for branch settings PUT — but NOT enforced for member creation/deactivation (RBAC-F3)

---

### Gate 3 — Route and Navigation

#### Frontend Route Guard Coverage

| Route | `beforeLoad` Guard | Dental Role Checked? |
|-------|--------------------|----------------------|
| `/_dashboard` (layout) | `requireAuth` + org context fetch | No dental role |
| `/_dashboard/dashboard` | None (inherits `requireAuth` from layout) | No |
| `/_dashboard/patients` | None | No |
| `/_dashboard/calendar` | None | No |
| `/_dashboard/patients/$patientId` | None | No |
| `/_dashboard/settings` | `requireRole('settings')` | Yes — `dentist_owner` only |
| `/_dashboard/reports` | `requireRole('reports')` | Yes — `dentist_owner` only |
| `/_dashboard/billing` | `requireRole('billing')` | Yes — `dentist_owner` + `dentist_associate` |
| `/_dashboard/staff` | `requireRole('staff')` | Yes — `dentist_owner` only |
| `/_workspace` | `requireAuth` only | No |
| `/_workspace/$patientId` | None (inherits) | No |
| `/_workspace/queue-board` | None | No |

Dashboard, patients, calendar, and workspace routes are accessible to any authenticated user with a `branchId` in the Zustand store. The RBAC guard system was only applied to the administrative/sensitive modules (settings, reports, billing, staff). Clinical workflow routes are treated as open to any branch member. This is a conscious design choice but is undocumented and inconsistent with the role matrix.

Note: `requireRole` correctly redirects when `role` is `null` (no dental role set). The risk is that `role` is populated from a prior session value — see RBAC-F11.

---

### Gate 4 — Frontend Interaction Integrity

#### `canAccess` Runtime Usage

`canAccess` is called in three places:
1. `requireRole` in `guards.ts` — the `beforeLoad` gate (route-level enforcement).
2. `settings.tsx` component body — secondary check inside the rendered component.
3. `staff-create-modal.tsx` — renders the permission preview checkboxes when creating a new member.

The App Shell audit note that "`canAccess` is never called at runtime" has been corrected by the current code. `canAccess` is wired into `requireRole`, which is used on `settings`, `reports`, `billing`, and `staff` routes. However, `dashboard`, `patients`, `calendar`, and workspace routes do not use `requireRole`, so `canAccess` has no effect on those routes.

#### RBAC-F7 — Dangerous `dentist_owner` Fallback in Component Bodies

`settings.tsx` line 22: `const role = (useOrgContextStore((s) => s.role) ?? 'dentist_owner') as DentalRole`
`reports.tsx` line 25: same pattern.

The `beforeLoad` guard (`requireRole`) runs before component render and should have already redirected non-`dentist_owner` users. However, if:
- A hard browser refresh occurs while the API is slow to respond,
- Or the Zustand store is cleared but the component renders before the guard re-fires (possible in development or flaky network conditions),

...then `role` is `null`, the `?? 'dentist_owner'` fallback fires, and the component renders full owner-level settings UI before the guard redirect executes. This is a defense-in-depth failure, not a bypass (the guard will ultimately redirect), but in a slow-API scenario the user sees owner-level settings content for a brief window. The safer pattern is `?? 'staff_scheduling'` (the most restrictive role) as fallback.

---

### Gate 5 — Forms, Modals, Table Actions

#### Member Creation via `staff-create-modal.tsx`

The staff creation modal uses `canAccess` only for rendering the permission preview. The `requireRole('staff')` guard protects the `/staff` route, so only `dentist_owner` can reach the modal in the normal flow. However, RBAC-F1 means the underlying API endpoint has no equivalent protection — the modal protection is purely cosmetic from a security standpoint if the API is called directly.

#### No Role-Gated Destructive Actions Beyond Route Guards

Table action buttons (archive patient, bulk archive, deactivate member) have no secondary `canAccess` checks in their click handlers. They rely entirely on the route-level `requireRole` guards and API-level `assertBranchRole`. For the routes without `requireRole` (patients), this means any branch member can trigger the archive action in the UI, and the API will honor it because `archivePatient` uses only `assertBranchAccess`.

---

### Gate 6 — Backend/API Contract Alignment

#### Generated vs Flat Endpoint Authorization Asymmetry

Two parallel endpoint sets exist for member management:

| Operation | Flat endpoint | Auth | TypeSpec endpoint | Auth |
|-----------|--------------|------|-------------------|------|
| Create member | `POST /dental/org/members` | `assertBranchAccess` | `POST /dental/organizations/{orgId}/branches/{branchId}/members/` | None (user check only) |
| Deactivate member | `DELETE /dental/org/members/:memberId` | `assertBranchAccess` | `POST /dental/organizations/{orgId}/branches/{branchId}/members/{id}/deactivate` | None |
| List members | `GET /dental/org/members` | `assertBranchAccess` | `GET /dental/organizations/{orgId}/branches/{branchId}/members/` | None |

Both sets are registered in the Hono app and both are accessible. The TypeSpec-generated endpoints are the ones exposed in the OpenAPI spec and used by the SDK. The flat endpoints are legacy routes. Any client using the SDK (including the frontend) calls the TypeSpec endpoints — the less-protected set.

#### `authMiddleware()` vs Dental Role Enforcement

All dental API routes in `generated/openapi/routes.ts` use `authMiddleware()` (no roles argument) or `authMiddleware({ roles: ['user'] })`. The roles argument here refers to the Better-Auth system role, not dental membership roles. `authMiddleware` explicitly documents: "Role changes trigger session invalidation" for system roles only. The dental role is never passed to `authMiddleware` — it is entirely the responsibility of individual handlers.

---

### Gate 7 — Role-Based Journey Map

#### Journey: `staff_scheduling` Creates a New Member (Exploit Path)

1. User authenticates via Better-Auth. Gets session cookie.
2. User enters PIN as `staff_scheduling` member of Branch A. Zustand store updated.
3. User bypasses the `/staff` route (blocked by `requireRole('staff')`).
4. User calls `POST /dental/organizations/{ORG_A_ID}/branches/{BRANCH_A_ID}/members/` directly with a `dentist_owner` role body.
5. `authMiddleware()` passes (valid session). Handler checks `user?.id` — passes. No `assertBranchAccess` or `assertBranchRole`.
6. New `dentist_owner` membership created under Branch A.
7. User is now a `dentist_owner` in Branch A and gains full access.

**This journey is currently possible with zero defense beyond the Better-Auth session check.**

#### Journey: Cross-Tenant Member Creation (RBAC-F1 Attack Path)

1. Attacker authenticates to their own org (Org B).
2. Attacker enumerates Org A's `orgId` and `branchId` (potentially via the unprotected `DentalMembershipManagement_list` endpoint — RBAC-F5).
3. Attacker calls `POST /dental/organizations/{ORG_A_ID}/branches/{BRANCH_A_ID}/members/` with `role: 'dentist_owner'`.
4. Attacker's own `personId` is stored as the `createdBy` field. The new membership's `personId` is whatever they supply in the body (optional field, can be their own `personId`).
5. Attacker now has a `dentist_owner` membership in Org A.

**This is a complete tenant boundary bypass.**

#### Journey: `hygienist` Authenticated Member (RBAC-F4)

1. `hygienist` member authenticates, enters PIN.
2. `_dashboard.tsx` fetches `/dental/org/context`. Store set with `role: 'hygienist'`.
3. `requireRole` cast to `DentalRole | null` — `'hygienist'` is not in the union, TypeScript cast succeeds but `canAccess` returns `false` for all modules.
4. `dashboard` route has no `requireRole` — user lands on dashboard. Dashboard renders with `role ?? 'dentist_owner'` fallback — hygienist sees full owner-level morning briefing.
5. All navigation links lead to routes with `requireRole` (settings/billing/staff) or no guard (patients/calendar). Clicking patients or calendar works. Clicking settings redirects back to `/dashboard`.
6. Hygienist can navigate to patients, calendar, and workspace — but the morning briefing displays owner-level financial summary they should not see.

---

### Gate 8 — Test Confidence Gap

#### Backend Authorization Test Coverage

| Handler | Access Test | Cross-Org Test | Role Test | Gap |
|---------|-------------|----------------|-----------|-----|
| `DentalMembershipManagement_create` | None | None | None | Complete gap — RBAC-F1 |
| `DentalMembershipManagement_deactivate` | None | None | None | Complete gap — RBAC-F2 |
| `DentalMembershipManagement_list` | None | None | None | Complete gap — RBAC-F5 |
| `createMember` | Auth only | No | No owner check | RBAC-F3 untested |
| `deactivateMember` | Auth + branch | Partial | No owner check | RBAC-F3 untested |
| `branchSettings` PUT | Yes | Yes | Yes (owner-only) | Well covered |
| `getDentalPatient` | Yes (cross-org test) | Yes | N/A | Covered |
| Clinical write handlers | Partial | N/A | Partial | `assertBranchRole` present but integration coverage thin |
| Treatment templates | None | None | None | RBAC-F8 untested |
| Billing handlers | Partial | N/A | Partial | `assertBranchRole` present |

#### Frontend RBAC Test Coverage

`rbac.test.ts` tests `canAccess`, `getDefaultRoute`, `canViewFinancials`, `canManageStaff`, `canAccessReports` — all correctly cover the four known roles. No test covers `hygienist` role behavior (which would expose RBAC-F4). No test covers `requireRole` guard behavior when `role` is `null` or an unknown role value.

#### Confidence Scores

| Layer | Score | Rationale |
|-------|-------|-----------|
| Backend dental role enforcement (write paths) | 6/10 | `assertBranchRole` correctly implemented and used for clinical/billing writes. Major gaps: TypeSpec-generated member management endpoints, treatment templates |
| Backend dental role enforcement (read paths) | 4/10 | Reads use `assertBranchAccess` only — correct for most reads, but member roster listing unprotected (RBAC-F5) |
| Frontend route guards | 5/10 | Four modules guarded; four unguarded (dashboard, patients, calendar, workspace). Zustand store source-of-truth is API-backed at load time — sound, but stale on refresh |
| Frontend RBAC matrix correctness | 6/10 | Correct for four documented roles; missing `hygienist` |
| Cross-tenant isolation | 5/10 | `cross-org-isolation.test.ts` covers patient + visit reads. Zero coverage for member management cross-org attack vector |
| Test coverage (auth/RBAC) | 3/10 | TypeSpec-generated endpoint authorization entirely untested; treatment templates untested; `hygienist` role untested |

---

## Critical Issues Detail

### RBAC-F1 / RBAC-F2 — TypeSpec-Generated Endpoints Without Branch Authorization (P0)

**Files:**
- `/Users/eladventures/Desktop/dentalemon/services/api-ts/src/handlers/dental-org/DentalMembershipManagement_create.ts`
- `/Users/eladventures/Desktop/dentalemon/services/api-ts/src/handlers/dental-org/DentalMembershipManagement_deactivate.ts`
- `/Users/eladventures/Desktop/dentalemon/services/api-ts/src/generated/openapi/routes.ts` (line 833, 848)

**Current state:** Both handlers check `if (!user?.id) throw UnauthorizedError`. No branch access or role check follows.

**Required fix:** `DentalMembershipManagement_create` needs `assertBranchRole(db, user.id, branchId, ['dentist_owner'])`. `DentalMembershipManagement_deactivate` needs to fetch the membership first, then call `assertBranchRole(db, user.id, membership.branchId, ['dentist_owner'])`.

### RBAC-F3 — Any Branch Member Can Create/Deactivate Members (P0)

**Files:**
- `/Users/eladventures/Desktop/dentalemon/services/api-ts/src/handlers/dental-org/createMember.ts` (line 44)
- `/Users/eladventures/Desktop/dentalemon/services/api-ts/src/handlers/dental-org/deactivateMember.ts` (line 27)

**Current state:** `await assertBranchAccess(db, user.id, resolvedBranchId)` — grants access to any active branch member.

**Required fix:** Replace with `await assertBranchRole(db, user.id, resolvedBranchId, ['dentist_owner'])`.

### RBAC-F4 — `hygienist` Role Missing from Frontend Matrix (P0)

**Files:**
- `/Users/eladventures/Desktop/dentalemon/apps/dentalemon/src/utils/rbac.ts`
- `/Users/eladventures/Desktop/dentalemon/services/api-ts/src/handlers/dental-org/repos/membership.schema.ts`

**Current state:** `VALID_MEMBER_ROLES` includes `hygienist`. `DentalRole` type and `ACCESS_MATRIX` do not.

**Required fix:** Add `hygienist` to `DentalRole` union and `ACCESS_MATRIX`. Define appropriate module access for `hygienist` (likely: `workspace: true`, `patients: true`, `calendar: true`; `billing: false`, `reports: false`, `staff: false`, `settings: false`).

### RBAC-F8 — Treatment Template Handlers Have No Authorization (P1)

**Files:**
- `/Users/eladventures/Desktop/dentalemon/services/api-ts/src/handlers/dental-visit/createTreatmentTemplate.ts`
- `/Users/eladventures/Desktop/dentalemon/services/api-ts/src/handlers/dental-visit/updateTreatmentTemplate.ts`
- `/Users/eladventures/Desktop/dentalemon/services/api-ts/src/handlers/dental-visit/deleteTreatmentTemplate.ts`
- `/Users/eladventures/Desktop/dentalemon/services/api-ts/src/handlers/dental-visit/applyTemplate.ts`

Treatment templates (`listTreatmentTemplates`, `treatmentTemplates.ts`) use `assertBranchAccess` for reads. The mutation handlers (create/update/delete/apply) have no `assertBranchAccess` or `assertBranchRole` — any authenticated user can create, modify, or delete treatment templates for any branch.

---

## Recommended Fix Priority

### P0 — Fix Before Next Release

1. **RBAC-F1/F2:** Add `assertBranchRole(['dentist_owner'])` to `DentalMembershipManagement_create` and `DentalMembershipManagement_deactivate`. Add `assertBranchAccess` minimum to `DentalMembershipManagement_list` (RBAC-F5).
2. **RBAC-F3:** Replace `assertBranchAccess` with `assertBranchRole(['dentist_owner'])` in `createMember.ts` and `deactivateMember.ts`.
3. **RBAC-F4:** Add `hygienist` to `DentalRole` and `ACCESS_MATRIX` in `rbac.ts`. Define module access matrix. Add `hygienist` tests to `rbac.test.ts`.
4. Add cross-tenant tests for TypeSpec-generated member management endpoints (mirrors `cross-org-isolation.test.ts` pattern).

### P1 — Fix in Next Sprint

5. **RBAC-F5:** Add `assertBranchAccess` to `DentalMembershipManagement_list`.
6. **RBAC-F6:** Decide and document whether `dashboard`, `patients`, `calendar`, and `workspace` routes intentionally have no dental role guard. If intentional, add a comment; if not, add `requireRole` guards.
7. **RBAC-F8:** Add `assertBranchRole(['dentist_owner', 'dentist_associate'])` to treatment template mutation handlers.
8. **RBAC-F11:** Add PIN session freshness check to `requireRole` guard, or document explicitly that role guards do not verify PIN session validity.

### P2 — Address in Backlog

9. **RBAC-F7:** Change `?? 'dentist_owner'` fallback in `settings.tsx` and `reports.tsx` to `?? 'staff_scheduling'` (most restrictive).
10. **RBAC-F9/F10:** Add role-level tests to `createMember.test.ts`, `deactivateMember.test.ts`, and new files for TypeSpec-generated endpoints.

### P3 — Cleanup

11. **RBAC-F12:** Create a centralized backend role matrix constant (mirroring the frontend `ACCESS_MATRIX`) so all `assertBranchRole` call sites can reference `ROLE_PERMISSIONS.CLINICAL_WRITE` etc. instead of inline arrays.

---

## Overall Confidence Score

**3/10**

The two authorization utilities (`assertBranchAccess`, `assertBranchRole`) are correctly implemented and the pattern is sound — `branchSettings.ts`, billing handlers, and clinical write handlers demonstrate the right approach. However, the TypeSpec-generated endpoint set (which is the production-facing, SDK-consumed API surface) has essentially no dental RBAC enforcement beyond session validation. An authenticated user can exploit `DentalMembershipManagement_create` to gain `dentist_owner` membership in any org without any further credential, making the entire role hierarchy irrelevant for a motivated attacker. The `hygienist` role mismatch means the system is in a partially broken state for any clinic using that role. Test coverage of the authorization layer is near-zero for the generated endpoints. The frontend guards are functionally sound for the four modules they cover, but they protect UI surfaces that can be bypassed entirely via the API.

Score raised from 2 to 3 only because the billing and clinical handler coverage is genuinely correct and `cross-org-isolation.test.ts` demonstrates that the team understands the threat model for read endpoints.
