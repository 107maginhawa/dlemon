# Role and Permission Map Audit
**Date**: 2026-05-26  
**Auditor**: Journey Test Audit Orchestrator — Pass 02  
**Scope**: All modules (global cross-cutting baseline)  
**Mode**: Read-only. No code modified.

---

## Executive Summary

| Dimension | Finding |
|---|---|
| System roles (Better-Auth) | 5: admin, user, support, client, host |
| DentalMembership roles in DB schema | **9** (dentist_owner, dentist_associate, hygienist, staff_full, staff_scheduling, dental_assistant, front_desk, billing_staff, read_only) |
| DentalMembership roles in ROLE_MATRIX.md | 4 (dentist_owner, dentist_associate, staff_full, staff_view) |
| Roles with assertBranchRole coverage | ~4 (dentist_owner, dentist_associate, staff_full, hygienist) |
| Undocumented roles in schema | **5** (hygienist, dental_assistant, front_desk, billing_staff, read_only) |
| ROLE_MATRIX name mismatch | `staff_view` (docs) ≠ `staff_scheduling` (code) |
| Frontend route guards present | Yes — `requireRole()` + `canAccess()` double-check |
| Backend API role gate present | Yes — `assertBranchAccess` + `assertBranchRole` |
| PIN auth creates server session | **NO** — PIN verify returns success/fail only; session stays as Better-Auth user |
| Cross-org isolation tested | Yes — `cross-org-isolation.test.ts` |

---

## 1. Role Inventory

### 1A. System-Level Roles (Better-Auth `session.user.role`)

| Role | Source File | Inferred Purpose | Frontend Usage | Backend Usage | Test Coverage |
|---|---|---|---|---|---|
| `admin` | `src/utils/auth.ts`, `src/middleware/auth.ts` | Full platform access, impersonation | No frontend route guard for admin-only routes found | `authMiddleware({ roles: ['admin'] })` | `auth.test.ts` — tests admin role pass |
| `user` | `src/middleware/auth.ts` (default) | Any authenticated user | Default after login | Default session role | `auth.test.ts` |
| `support` | `src/utils/auth.ts` (accessControlStatements) | Read-only audit/support access | Not found in frontend conditionals | Not found in handler guards | [NEEDS MANUAL CONFIRMATION] |
| `client` | `src/utils/auth.ts` | Booking client context | Not found in dental app | Booking module auth | `booking.test.ts` |
| `host` | `src/utils/auth.ts` | Booking host context | Not found in dental app | Booking module auth | `booking.test.ts` |

### 1B. DentalMembership Roles (Branch-Scoped, `dental_membership.role`)

**Source**: `services/api-ts/src/handlers/dental-org/repos/membership.schema.ts`

```typescript
export const memberRoleEnum = pgEnum('member_role', [
  'dentist_owner',
  'dentist_associate',
  'hygienist',
  'staff_full',
  'staff_scheduling',
  'dental_assistant',
  'front_desk',
  'billing_staff',
  'read_only',
]);
```

| Role | In ROLE_MATRIX.md | In assertBranchRole calls | In Frontend rbac.ts | In Seed Data | Test Fixtures | Status |
|---|---|---|---|---|---|---|
| `dentist_owner` | ✅ | ✅ (OWNER_ONLY) | ✅ | ✅ | ✅ | Fully active |
| `dentist_associate` | ✅ | ✅ (CLINICAL_WRITE) | ✅ | ✅ | ⚠️ sparse | Active, thin tests |
| `hygienist` | ❌ **NOT documented** | ✅ (appears in dental-visit handlers) | [NEEDS CONFIRMATION] | [UNKNOWN] | [UNKNOWN] | **UNDOCUMENTED** |
| `staff_full` | ✅ | ✅ (BILLING_WRITE) | ✅ | ✅ | ✅ | Fully active |
| `staff_scheduling` | ❌ (listed as `staff_view` in ROLE_MATRIX) | ⚠️ limited (mostly `staff_full`) | [NEEDS CONFIRMATION] | ✅ | ✅ (sparse) | **NAME MISMATCH** |
| `dental_assistant` | ❌ **NOT documented** | ❌ Not in any assertBranchRole | [NEEDS CONFIRMATION] | [UNKNOWN] | [UNKNOWN] | **UNDOCUMENTED, UNUSED** |
| `front_desk` | ❌ **NOT documented** | ❌ Not in any assertBranchRole | [NEEDS CONFIRMATION] | [UNKNOWN] | [UNKNOWN] | **UNDOCUMENTED, UNUSED** |
| `billing_staff` | ❌ **NOT documented** | ❌ Not in any assertBranchRole | [NEEDS CONFIRMATION] | [UNKNOWN] | [UNKNOWN] | **UNDOCUMENTED, UNUSED** |
| `read_only` | ❌ **NOT documented** | ❌ Not in any assertBranchRole | [NEEDS CONFIRMATION] | [UNKNOWN] | [UNKNOWN] | **UNDOCUMENTED, UNUSED** |

**Critical discrepancy**: ROLE_MATRIX says `staff_view` but schema enum is `staff_scheduling`. These are different names with potentially different semantics.

### 1C. Frontend Module-Level RBAC (`DentalModule` type)

The frontend uses `requireRole(module: DentalModule)` where module maps to a feature area:

| Module Key | Route Using It | Backend Role Tier Expected |
|---|---|---|
| `'billing'` | `_dashboard/billing.tsx` | BILLING_WRITE (`dentist_owner`, `staff_full`) |
| `'settings'` | `_dashboard/settings.tsx` | OWNER_ONLY (`dentist_owner`) |
| `'staff'` | `_dashboard/staff.tsx` | OWNER_ONLY (`dentist_owner`) |
| `'reports'` | `_dashboard/reports.tsx` | OWNER_ONLY or BILLING_WRITE [NEEDS CONFIRMATION] |

**Note**: `requireRole` implementation reads from `DentalModule` type and checks `useOrgContextStore`. Actual role-to-module mapping logic is in `apps/dentalemon/src/utils/guards.ts` — content not fully extracted. [NEEDS MANUAL CONFIRMATION of exact role → module mapping]

---

## 2. Protected Routes Map

### 2A. apps/dentalemon — Route Protection

| Route | Guard | Guard Type | Roles Allowed | Backend Enforces? | Status |
|---|---|---|---|---|---|
| `/auth/$authView` | `requireGuest` | Session | Unauthenticated only | N/A | ✅ |
| `/auth/pin-select` | No guard found | [UNCLEAR] | Any authenticated | N/A | [NEEDS CONFIRMATION] |
| `/auth/pin-entry.$memberId` | No guard found | [UNCLEAR] | Any authenticated | Requires valid memberId | [NEEDS CONFIRMATION] |
| `/onboarding` | `composeGuards(requireAuth, requireEmailVerified, requireNoPerson)` | Multi-guard | Authenticated, verified, no person | N/A | ✅ |
| `/verify-email` | `composeGuards(requireAuth, requireNotEmailVerified)` | Multi-guard | Authenticated, not yet verified | N/A | ✅ |
| `/` (index) | Implied by dashboard check | Redirect logic | Any → redirects | N/A | ✅ |
| `/_dashboard` (layout) | `requireAuth` (inferred via beforeLoad) | Session | Any authenticated | Middleware `authMiddleware` | ✅ |
| `/_dashboard/dashboard` | No `requireRole` | Auth only | All members | None specific — reads org context | [CURRENT BEHAVIOR] |
| `/_dashboard/calendar` | No `requireRole` found | Auth only | All members | None specific | [CURRENT BEHAVIOR] |
| `/_dashboard/patients` | No `requireRole` found | Auth only | All members | `assertBranchAccess` | [CURRENT BEHAVIOR] |
| `/_dashboard/patients/$patientId` | No `requireRole` found | Auth only | All members | `assertBranchAccess` | [CURRENT BEHAVIOR] |
| `/_dashboard/billing` | `requireRole('billing')` | Module guard | BILLING_WRITE roles | `assertBranchRole` | ✅ |
| `/_dashboard/reports` | `requireRole('reports')` | Module guard | [NEEDS CONFIRMATION] | [NEEDS CONFIRMATION] | [UNCLEAR] |
| `/_dashboard/settings` | `requireRole('settings')` + `canAccess(role, 'settings')` | Double guard | `dentist_owner` only | [NEEDS CONFIRMATION — branch config APIs] | ✅ (FE) / [UNCLEAR] (BE) |
| `/_dashboard/staff` | `requireRole('staff')` + component check `≠ dentist_owner` | Double guard | `dentist_owner` only | `assertBranchRole` in member create/deactivate | ✅ |
| `/_dashboard/dental-onboarding` | Redirect if branch found (beforeLoad) | Context guard | New org only | Org create requires auth | ✅ |
| `/_workspace` (layout) | `requireAuth` (inferred) | Session | All authenticated | Middleware | ✅ |
| `/_workspace/$patientId` | `requireAuth` (inferred) | Session | All members | `assertBranchAccess` per tab | ✅ (read) |
| `/_workspace/queue-board` | `requireAuth` (inferred) | Session | All members | [NO BACKEND ENTITY — stub?] | [LIKELY BUG] |
| `/imaging-ceph-report.$imageId` | No guard found | [UNCLEAR] | [UNKNOWN] | [NEEDS CONFIRMATION] | [NEEDS CONFIRMATION] |

### 2B. apps/account — Route Protection

| Route | Guard | Roles | Status |
|---|---|---|---|
| `/auth/$authView` | `requireGuest` | Unauthenticated | ✅ |
| `/onboarding` | `composeGuards(requireAuth, ...)` | Authenticated | ✅ |
| `/_dashboard/*` | Auth required | Authenticated | ✅ |
| `/_dashboard/settings/schedule` | No role guard | host role expected | [NEEDS CONFIRMATION] |
| `/_dashboard/settings/billing` | No role guard | Any authenticated | [CURRENT BEHAVIOR] |

---

## 3. Protected Actions Map

### 3A. Backend RBAC Enforcement Summary by Operation Type

| Operation | Handler Pattern | Role Tier | Enforcement Function |
|---|---|---|---|
| **Read patient data** | All read handlers | ANY_MEMBER | `assertBranchAccess` |
| **Read appointments** | dental-scheduling reads | ANY_MEMBER | `assertBranchAccess` |
| **Read imaging** | dental-imaging reads | ANY_MEMBER | `assertBranchAccess` |
| **Create appointment** | createAppointment | ANY_MEMBER [NEEDS CONFIRMATION] | `assertBranchAccess` |
| **Cancel/edit appointment** | updateAppointment | ANY_MEMBER [NEEDS CONFIRMATION] | `assertBranchAccess` or role? |
| **Create medical history** | createMedicalHistoryEntry | BILLING_WRITE | `assertBranchRole(['dentist_owner', 'dentist_associate', 'staff_full'])` |
| **Create consent form** | createConsentForm | CLINICAL_WRITE | `assertBranchRole` |
| **Sign consent form** | signConsentForm | CLINICAL_WRITE | `assertBranchRole` |
| **Create prescription** | createPrescription | CLINICAL_WRITE | `assertBranchRole` |
| **Create lab order** | createLabOrder | CLINICAL_WRITE | `assertBranchRole` |
| **Create attachment** | createAttachment | CLINICAL_WRITE | `assertBranchRole` |
| **Delete attachment** | deleteAttachment | CLINICAL_WRITE | `assertBranchRole` |
| **Create imaging study** | createImagingStudy | CLINICAL_WRITE | `assertBranchRole` |
| **Delete image** | deleteImage | CLINICAL_WRITE | `assertBranchRole` |
| **Create invoice** | createInvoice | BILLING_WRITE | `assertBranchRole` |
| **Issue invoice** | issueInvoice | BILLING_WRITE | `assertBranchRole` |
| **Record payment** | createPayment | BILLING_WRITE | `assertBranchRole` |
| **Void invoice** | voidInvoice | OWNER_ONLY | `assertBranchRole(['dentist_owner'])` |
| **Add discount** | addDiscount | OWNER_ONLY | `assertBranchRole(['dentist_owner'])` |
| **Void payment** | voidPayment | OWNER_ONLY | `assertBranchRole(['dentist_owner'])` |
| **Create member** | createMember | OWNER_ONLY | `assertBranchRole(['dentist_owner'])` |
| **Deactivate member** | deactivateMember | OWNER_ONLY | `assertBranchRole(['dentist_owner'])` |
| **Branch settings** | branchSettings (PUT) | OWNER_ONLY | `assertBranchRole(['dentist_owner'])` |
| **Working hours** | updateWorkingHours | OWNER_ONLY | `assertBranchRole(['dentist_owner'])` |
| **Create PMD** | createPMD | BILLING_WRITE (or CLINICAL_WRITE) | `assertBranchRole` |
| **Dental visit (clinical)** | getDentalVisit (write) | CLINICAL_WRITE + `hygienist` | `assertBranchRole(['dentist_owner', 'dentist_associate', 'hygienist'])` |

**Important**: The `hygienist` role appears in `assertBranchRole` for dental-visit handlers but is NOT in ROLE_MATRIX.md and NOT tested in RBAC test fixtures.

### 3B. Actions with Frontend-Only Guards (No Confirmed Backend Block)

| Action | Frontend Guard | Backend Guard Confirmed? | Risk |
|---|---|---|---|
| View settings page | `requireRole('settings')` + `canAccess(role, 'settings')` | [NEEDS CONFIRMATION for all settings endpoints] | P1 |
| View reports | `requireRole('reports')` + `canAccessReports(role)` | [NEEDS CONFIRMATION] | P1 |
| View billing page | `requireRole('billing')` | `assertBranchRole` on write ops | ✅ writes; ⚠️ reads [NEEDS CONFIRMATION] |
| Staff management page | `requireRole('staff')` + component check | `assertBranchRole` on create/deactivate | ✅ writes |
| Queue board | auth only (no `requireRole`) | No backend entity found | P1 |
| Ceph report page | No guard found | [NEEDS CONFIRMATION] | P1 |

---

## 4. Role Access Matrix

| Role | Route/Action | Expected Access | Frontend Enforcement | Backend Enforcement | Status | Severity |
|---|---|---|---|---|---|---|
| `unauthenticated` | Any `/_dashboard/*` | DENY | `requireAuth` (inferred) | `authMiddleware({ required: true })` | ✅ | — |
| `unauthenticated` | `/auth/$authView` | ALLOW | `requireGuest` | Public | ✅ | — |
| `dentist_owner` | All routes | ALLOW | — | All tiers include owner | ✅ | — |
| `dentist_associate` | `/_dashboard/settings` | DENY | `requireRole('settings')` → canAccess | [NEEDS CONFIRMATION — branch settings endpoint?] | ⚠️ FE only | P1 |
| `dentist_associate` | `/_dashboard/staff` | DENY | `requireRole('staff')` + component check | `assertBranchRole(['dentist_owner'])` on write | ✅ | — |
| `dentist_associate` | `/_dashboard/billing` | DENY (UI) | `requireRole('billing')` | ⚠️ Read endpoints may not block | P1 — reads unconfirmed | P1 |
| `dentist_associate` | Void invoice | DENY | Not visible in UI (expected) | `assertBranchRole(['dentist_owner'])` | ✅ | — |
| `staff_full` | `/_dashboard/settings` | DENY | `requireRole('settings')` → canAccess | [NEEDS CONFIRMATION] | ⚠️ FE only | P1 |
| `staff_full` | Create/void invoice | ALLOW create, DENY void | `requireRole('billing')` | `assertBranchRole` — void is OWNER_ONLY | ✅ (write); void ✅ | — |
| `staff_full` | Clinical write (prescriptions) | DENY | [NEEDS CONFIRMATION in UI] | `assertBranchRole(['dentist_owner', 'dentist_associate'])` — excludes staff_full | ✅ (BE) | — |
| `staff_scheduling` | `/_dashboard/billing` | DENY | `requireRole('billing')` → [role mapping unknown] | `assertBranchRole` on writes | ⚠️ FE mapping unknown | P1 |
| `staff_scheduling` | `/_dashboard/settings` | DENY | `requireRole('settings')` | [NEEDS CONFIRMATION] | ⚠️ | P1 |
| `hygienist` | Clinical write (dental-visit) | ALLOW | [NEEDS CONFIRMATION in UI] | `assertBranchRole(['dentist_owner', 'dentist_associate', 'hygienist'])` | ✅ (BE); ⚠️ FE unknown | P1 |
| `hygienist` | Billing write | DENY | [NEEDS CONFIRMATION] | Excluded from `['dentist_owner', 'dentist_associate', 'staff_full']` | ✅ (BE) | — |
| `dental_assistant` | Any write | DENY | [NEEDS CONFIRMATION] | Not in any assertBranchRole list | [UNCLEAR — may be denied by default] | P1 |
| `front_desk` | Any write | DENY | [NEEDS CONFIRMATION] | Not in any assertBranchRole list | [UNCLEAR] | P1 |
| `billing_staff` | Any write | DENY | [NEEDS CONFIRMATION] | Not in any assertBranchRole list | [UNCLEAR] | P1 |
| `read_only` | All writes | DENY | [NEEDS CONFIRMATION] | Not in any assertBranchRole list | [UNCLEAR] | P1 |
| `any member` | Ceph report page `/imaging-ceph-report.$imageId` | [NEEDS PRODUCT DECISION] | No guard | [NEEDS CONFIRMATION] | [UNCLEAR] | P1 |
| `any member` | Queue board | [NEEDS PRODUCT DECISION] | Auth only | No backend entity | [LIKELY BUG] | P1 |

---

## 5. Permission Gap Report

| ID | Gap | Role(s) | Route/API/Component | Evidence | Risk | Severity | Recommended Test Type |
|---|---|---|---|---|---|---|---|
| PG-01 | **9 DB roles vs 4 documented** — schema has `hygienist`, `dental_assistant`, `front_desk`, `billing_staff`, `read_only` with no ROLE_MATRIX entry | All 5 undocumented | `membership.schema.ts` memberRoleEnum | Schema file line ~12 | Any of these 5 roles assigned to a member may pass/fail auth silently — no defined tier behavior | P0 | Integration: test each role against OWNER_ONLY, CLINICAL_WRITE, BILLING_WRITE endpoints |
| PG-02 | **`staff_view` vs `staff_scheduling` name mismatch** — ROLE_MATRIX calls it `staff_view`, schema/code uses `staff_scheduling` | staff_scheduling | `docs/architecture/ROLE_MATRIX.md` vs `membership.schema.ts` | ROLE_MATRIX "staff_view" not in schema enum | If UI or future code uses `staff_view` string, access will silently fail | P0 | Unit: verify enum values match docs |
| PG-03 | **`hygienist` in assertBranchRole but not in ROLE_MATRIX** | hygienist | `handlers/dental-visit/` handlers | `assertBranchRole(['dentist_owner', 'dentist_associate', 'hygienist'])` grep | Undocumented access escalation — hygienist can write dental visits but documentation says otherwise | P0 | Integration: hygienist can POST dental visit; cannot POST invoice |
| PG-04 | **PIN auth does not create a server session** | All PIN users | `/dental/members/{id}/verify-pin`, `auth/pin-entry.$memberId.tsx` | verifyPin returns `{success, failedAttempts}` — no token issued | PIN "login" is frontend-local only. Any authenticated Better-Auth user can call dental APIs using their JWT — PIN selection is cosmetic for backend | P0 | Integration: Better-Auth user A sets PIN; user B (different Better-Auth session) calls dental API — should still be blocked by assertBranchAccess |
| PG-05 | **Settings page: backend endpoints not confirmed blocked for non-owners** | dentist_associate, staff_full, staff_scheduling | `_dashboard/settings`, `/dental/branches/{id}/settings` (PUT), `/dental/branches/{id}/working-hours` (PUT) | Frontend `canAccess(role, 'settings')` in render only; backend not confirmed | Non-owner could call PUT `/dental/branches/{id}/settings` directly | P1 | API integration: associate calls branch settings PUT → must get 403 |
| PG-06 | **Reports page: backend enforcement unknown** | Non-owners | `_dashboard/reports`, `/audit/logs` or similar | `requireRole('reports')` + `canAccessReports(role)` — backend not checked | reportPage calls audit/collection APIs without confirmed role gate | P1 | API integration: staff_full calls reports API → confirm 403 or 200 per product decision |
| PG-07 | **Billing read endpoints: role not confirmed blocked for non-BILLING_WRITE roles** | dentist_associate, staff_scheduling | `/dental/billing/invoices`, `/dental/billing/patients/{id}/balance` | ROLE_MATRIX says associate can read billing; scheduler cannot — backend enforcement not checked for reads | staff_scheduling could GET invoice list | P1 | API integration: staff_scheduling GET /dental/billing/invoices → should 403? |
| PG-08 | **Queue board route has no backend entity** | All members | `_workspace/queue-board.tsx`, no `/dental/queue/*` endpoint | Route exists, no handler found | Queue board may be a stub with no real data or may call wrong API | P1 | E2E: visit queue board, confirm meaningful data loads |
| PG-09 | **Ceph report page has no access guard** | All | `imaging-ceph-report.$imageId.tsx` | No `requireRole` in route definition | Any authenticated user can view ceph reports for any image ID if they know the URL | P1 | E2E + API: non-owner can access ceph report → confirm branch isolation |
| PG-10 | **`requireRole` module mapping not confirmed** | All non-owner | `apps/dentalemon/src/utils/guards.ts` | `requireRole(DentalModule)` — guards.ts content not fully extracted | Unknown which dental membership roles are allowed for each DentalModule | P1 | Unit: test requireRole('billing') blocks staff_scheduling |
| PG-11 | **`dental_assistant`, `front_desk`, `billing_staff`, `read_only` behavior in assertBranchRole** | These 4 roles | All dental handlers | Not in any assertBranchRole list | If a member has role=dental_assistant and calls a BILLING_WRITE endpoint, behavior is undefined — likely 403 by default (not in allow list), but untested | P1 | Integration: dental_assistant calls createInvoice → must 403 |
| PG-12 | **`dentist_associate` test coverage sparse** | dentist_associate | All test fixtures | Only `dentist_owner` and `staff_full` commonly in tests | Associate may be missing deny tests for billing writes and owner-only ops | P1 | Integration: all OWNER_ONLY endpoints deny dentist_associate |
| PG-13 | **PIN lockout: locked member account** | All PIN users | `DentalMembershipManagement_verifyPin` | lockout returns 429; but subsequent API calls with the same Better-Auth session are NOT blocked | A locked-out PIN user retains full API access via their Better-Auth JWT — PIN lockout is UI-only | P1 | Integration: lock out PIN → call dental API directly → confirm still blocked (or confirm this is intentional) |
| PG-14 | **`support` system role: no handler uses it** | support | All handlers | Grep shows no `assertBranchRole` or middleware check for 'support' role | support users may get access denied to all dental APIs (not even read) — or may get full access as `user`-level | P2 | Integration: support role user calls /dental/patients → confirm 200 or documented deny |
| PG-15 | **Frontend role check uses orgContextStore, not session** | All | `useOrgContextStore((s) => s.role)` | Settings, staff, billing, reports pages read role from store | If orgContextStore is out of sync with actual membership, wrong role could be used for UI decisions | P2 | Component: test orgContextStore role mismatch → UI renders wrong access level |

---

## 6. Test Coverage Recommendations

| Permission Rule | Existing Test | Missing Test | Recommended Test Type |
|---|---|---|---|
| Unauthenticated → 401 on all dental endpoints | `auth.test.ts` middleware tests | None known missing | ✅ Covered |
| `dentist_owner` can do all ops | Fixtures in dental-org tests | Complete coverage check | Integration |
| `dentist_associate` cannot void invoice | [NEEDS CONFIRMATION] | `dentist_associate` calls `POST /dental/billing/invoices/{id}/void` → 403 | API integration |
| `staff_full` cannot prescribe | [NEEDS CONFIRMATION] | `staff_full` calls `POST /dental/clinical/prescriptions` → 403 | API integration |
| `staff_scheduling` cannot access billing | [NEEDS CONFIRMATION] | `staff_scheduling` calls `GET /dental/billing/invoices` → 403 | API integration |
| `hygienist` can write dental visit | Sparse | `hygienist` calls dental-visit POST → 200 | API integration |
| `hygienist` cannot write invoice | None | `hygienist` calls invoice create → 403 | API integration |
| `dental_assistant` denied all write | None | `dental_assistant` calls any write endpoint → 403 | API integration |
| `front_desk` denied all write | None | `front_desk` calls any write endpoint → 403 | API integration |
| PIN lockout does not disable API | None | Lock out PIN → call API with JWT → confirm behavior | API integration |
| `requireRole('billing')` blocks staff_scheduling | None | Frontend route guard test | Unit / component |
| `requireRole('settings')` blocks non-owner | None | Frontend route guard test | Unit / component |
| `requireRole('reports')` role mapping | None | Confirm which roles pass | Unit |
| Cross-org isolation | `cross-org-isolation.test.ts` | Branch-B member accessing Branch-A data → 403 | ✅ covered |
| Ceph report page auth | None | GET `/imaging-ceph-report/$imageId` as non-member → 401/403 | E2E |
| Queue board loads real data | None | Visit queue board → confirm data source | E2E |

---

## 7. Gate 2 Verdict

**GATE 2: PASS (with open P0 findings requiring remediation)**

The role permission map is now documented. The audit can proceed to Gate 3 (Route Navigation Audit). However, the following P0 gaps MUST appear in the final stabilization plan:

- PG-01: 5 undocumented DB roles
- PG-02: `staff_view` vs `staff_scheduling` name mismatch
- PG-03: `hygienist` undocumented in ROLE_MATRIX but active in backend
- PG-04: PIN auth is frontend-local — no server session issued

These do not block proceeding to audit 03, but will require test implementation before the stabilization plan is closed.
