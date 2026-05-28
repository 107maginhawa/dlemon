# Route and Navigation Audit
**Date**: 2026-05-26  
**Auditor**: Journey Test Audit Orchestrator — Pass 03  
**Scope**: Global (both apps)  
**Mode**: Read-only. No code modified.

---

## 1. Route Registry

### 1A. apps/dentalemon — Full Route Table

| Route (URL) | File | Auth Required | Role Guard | Params | Component | Notes |
|---|---|---|---|---|---|---|
| `/` | `routes/index.tsx` | No (requireGuest) | Guest only | — | HomePage | Redirects auth'd users to `/dashboard` |
| `/auth/$authView` | `routes/auth/$authView.tsx` | No (requireGuest) | Guest only | `authView` | Auth UI | Better-Auth UI |
| `/auth/pin-select` | `routes/auth/pin-select.tsx` | **NO GUARD** | None | — | PinSelectRoute | [LIKELY BUG] No auth check |
| `/auth/pin-entry/$memberId` | `routes/auth/pin-entry.$memberId.tsx` | **NO GUARD** | None | `memberId` | PinEntryRoute | [LIKELY BUG] No auth check |
| `/onboarding` | `routes/onboarding.tsx` | Yes (compose: requireAuth + requireEmailVerified + requireNoPerson) | Must not have person | — | OnboardingWizard | ✅ |
| `/verify-email` | `routes/verify-email.tsx` | Yes (compose: requireAuth + requireNotEmailVerified) | Unverified only | — | VerifyEmail | ✅ |
| `/_dashboard` | `routes/_dashboard.tsx` | Yes (requireAuth) | Any authenticated | — | DashboardLayout | Layout shell; redirects to `/dental-onboarding` if no branch |
| `/_dashboard/dashboard` | `routes/_dashboard/dashboard.tsx` | Inherited | **NONE** | — | DashboardPage | No `requireRole` — all members can access |
| `/_dashboard/calendar` | `routes/_dashboard/calendar.tsx` | Inherited | **NONE** | — | CalendarPage | No `requireRole` — all members can access |
| `/_dashboard/patients` | `routes/_dashboard/patients.tsx` | Inherited | **NONE** | — | PatientListPage | No `requireRole` — all members |
| `/_dashboard/patients_/$patientId` | `routes/_dashboard/patients_/$patientId.tsx` | Inherited | **NONE** | `patientId` | PatientDetailPage | Route uses `patients_` (underscore) — see nav bug |
| `/_dashboard/billing` | `routes/_dashboard/billing.tsx` | Inherited | `requireRole('billing')` | — | BillingPage | ✅ guards billing module |
| `/_dashboard/reports` | `routes/_dashboard/reports.tsx` | Inherited | `requireRole('reports')` | — | ReportsPage | ✅ guards reports; only owner |
| `/_dashboard/settings` | `routes/_dashboard/settings.tsx` | Inherited | `requireRole('settings')` + in-component `canAccess` | — | SettingsPage | Double-guarded ✅ |
| `/_dashboard/staff` | `routes/_dashboard/staff.tsx` | Inherited | `requireRole('staff')` + component check | — | StaffPage | Double-guarded ✅ |
| `/_dashboard/dental-onboarding` | `routes/_dashboard/dental-onboarding.tsx` | Inherited | **NONE** | — | DentalOnboardingWizard | Any auth'd user can see |
| `/_workspace` | `routes/_workspace.tsx` | Yes (requireAuth) | Any authenticated | — | WorkspaceLayout | Seeds org context |
| `/_workspace/$patientId` | `routes/_workspace/$patientId.tsx` | Inherited | **NONE** | `patientId` | WorkspacePage | No role guard — all members |
| `/_workspace/queue-board` | `routes/_workspace/queue-board.tsx` | Inherited | **NONE** | — | QueueBoardPage | Created with `as any` cast — TS error suppressed |
| `/imaging-ceph-report/$imageId` | `routes/imaging-ceph-report.$imageId.tsx` | **NO GUARD** | **NONE** | `imageId`, `?version` | CephReportPage | No auth at all |

### 1B. apps/account — Route Table (abbreviated)

| Route | File | Auth | Role Guard | Notes |
|---|---|---|---|---|
| `/` | `routes/index.tsx` | requireGuest | — | Redirect |
| `/auth/$authView` | `routes/auth/$authView.tsx` | requireGuest | — | Better-Auth |
| `/onboarding` | `routes/onboarding.tsx` | requireAuth + compound | — | ✅ |
| `/verify-email` | `routes/verify-email.tsx` | requireAuth + compound | — | ✅ |
| `/_dashboard` | `routes/_dashboard.tsx` | requireAuth | Any | Layout |
| `/_dashboard/dashboard` | — | Inherited | None | All users |
| `/_dashboard/settings/billing` | — | Inherited | None | ⚠️ No role guard |
| `/_dashboard/settings/schedule` | — | Inherited | None | host role expected? |
| All other `/_dashboard/*` | — | Inherited | None | All users |

---

## 2. Navigation Registry

### 2A. Sidebar Navigation (DashboardLayout — apps/dentalemon)

**Source**: `routes/_dashboard.tsx` — `navGroups` hardcoded, NO role filtering applied.

| Label | URL | Icon | Role Required (canAccess) | Shown to All Roles | Risk |
|---|---|---|---|---|---|
| Dashboard | `/dashboard` | Home | all except staff_scheduling (matrix) | **YES — no filtering** | P1 — staff_scheduling sees item they cannot navigate to meaningfully |
| Patients | `/patients` | Users | all roles | **YES** | ✅ (all can see patients) |
| Calendar | `/calendar` | Calendar | all roles | **YES** | ✅ |
| Billing | `/billing` | Receipt | dentist_owner, dentist_associate | **YES — no filtering** | P1 — staff_full, staff_scheduling see Billing link; `requireRole` will redirect |
| Reports | `/reports` | BarChart3 | dentist_owner only | **YES — no filtering** | P1 — all non-owners see Reports link |
| Staff | `/staff` | UserCog | dentist_owner only | **YES — no filtering** | P1 — all non-owners see Staff link |
| Settings | `/settings` | Settings | dentist_owner only | **YES — no filtering** | P1 — all non-owners see Settings link |

**Critical finding**: Sidebar shows all 7 nav items to ALL roles regardless of access. Users who click restricted items will get silently redirected to `/dashboard`. This is not an access bypass (backend still protects), but is a confusing UX and the `requireRole` guard redirect loop for `staff_scheduling` needs investigation (staff_scheduling has `dashboard: false` in ACCESS_MATRIX but dashboard route has no requireRole guard — redirect goes to `/dashboard` which loads successfully).

### 2B. In-Component navigate() Calls

| Source Component | Target | Params | Route Exists? | Risk |
|---|---|---|---|---|
| `dashboard.tsx` (quick action) | `/calendar` | — | ✅ | — |
| `dashboard.tsx` (quick action) | `/billing` | — | ✅ | — |
| `dashboard.tsx` (quick action) | `/patients` | — | ✅ | — |
| patient folder card | `'/$patientId'` with `patientId` param | `{ patientId }` | **[LIKELY BUG]** — route is `/_workspace/$patientId` not `/$patientId` | P1 |
| patient profile | `'/patients/$patientId'` | `{ patientId }` | **[LIKELY BUG]** — file is `patients_/$patientId` (underscore); cast to `any` | P1 |
| pin-select | `/auth/pin-entry/$memberId` | `{ memberId }` | ✅ | — |
| pin-entry | `/auth/pin-select` (back) | — | ✅ | — |
| pin-entry success | `/dashboard` | — | ✅ | — |
| app-sidebar sign-out | `/auth/$authView` with `sign-in` | ✅ | — | — |
| queue-board back button | `/` | — | ⚠️ Route `/` has requireGuest → redirects to `/dashboard` for auth'd user | P2 |
| not-found component | `/` | — | Same as above | P2 |
| onboarding complete | `/dashboard` | — | ✅ | — |

### 2C. Link Components (hardcoded)

| Source | `to` Value | Route Exists? | Risk |
|---|---|---|---|
| Sidebar items | `item.url` (from navGroups string) | ✅ for all 7 | No type safety — string | P2 |
| `__root.tsx` Auth UI `Link` | `href` string pass-through from Better-Auth UI | [NEEDS CONFIRMATION] | Could produce unresolvable routes | P2 |
| Workspace TopBar | [NEEDS MANUAL CONFIRMATION] | — | — |

---

## 3. Broken Navigation Report

| ID | Issue | Source File | Target | Affected Role | Severity | Evidence |
|---|---|---|---|---|---|---|
| BN-01 | **`navigate({ to: '/$patientId' })` targets non-existent route** | `features/patients/components/patient-folder-card.tsx` | `/$patientId` | All | P1 | Route file is `_workspace/$patientId.tsx`, URL is `/_workspace/[id]` not `/$patientId`. Will 404 in prod. |
| BN-02 | **`navigate({ to: '/patients/$patientId' } as any)` path may not match file** | `features/patients/components/patient-profile-page.tsx` | `/patients/$patientId` | All | P1 | Route file is `_dashboard/patients_/$patientId.tsx` (trailing underscore). TanStack Router may resolve differently. Cast to `any` hides TS error. |
| BN-03 | **Sidebar shows ALL nav items to ALL roles — no role filtering** | `routes/_dashboard.tsx` (navGroups) | `/billing`, `/reports`, `/staff`, `/settings` | non-owners | P1 | `navGroups` hardcoded; no `canAccess()` filter applied before rendering. Non-owners see restricted nav items. |
| BN-04 | **`/auth/pin-select` has no auth guard** | `routes/auth/pin-select.tsx` | — | Unauthenticated | P1 | No `requireAuth` or `requireGuest`. Unauthenticated user lands on empty "No staff members" screen instead of being redirected to login. |
| BN-05 | **`/auth/pin-entry.$memberId` has no auth guard** | `routes/auth/pin-entry.$memberId.tsx` | — | Unauthenticated | P1 | Same — no guard. Unauthenticated user can render PIN entry screen for any known member ID. |
| BN-06 | **`/imaging-ceph-report/$imageId` has no auth guard** | `routes/imaging-ceph-report.$imageId.tsx` | — | Unauthenticated | P1 | No `requireAuth`. API call will 401, but no redirect to login page. User sees broken/loading state. |
| BN-07 | **Queue board back button → `/` (requireGuest) → redirects to `/dashboard`** | `routes/_workspace/queue-board.tsx` | `/` | Authenticated | P2 | Intent is "go back to workspace or dashboard". Route `/` has `requireGuest` which redirects authenticated users to `/dashboard`. Works but is indirect. |
| BN-08 | **`_dashboard.tsx` redirects to `/dental-onboarding` (not `/_dashboard/dental-onboarding`)** | `routes/_dashboard.tsx` beforeLoad | `/dental-onboarding` | New org users | P1 | Redirect uses `to: '/dental-onboarding' as any` — this URL does not match the file route `/_dashboard/dental-onboarding`. May cause 404 or incorrect layout. Cast to `any` hides TS error. |
| BN-09 | **Queue board route uses `as any` type cast** | `routes/_workspace/queue-board.tsx` | — | All | P2 | `createFileRoute('/_workspace/queue-board' as any)` — suggests route path type inference failed. May not be registered correctly. |
| BN-10 | **`staff_scheduling` cannot navigate meaningfully to `/dashboard`** | `utils/rbac.ts` ACCESS_MATRIX | `/dashboard` | staff_scheduling | P2 | ACCESS_MATRIX says `dashboard: false` for staff_scheduling. `getDefaultRoute('staff_scheduling')` returns `/patients`. But index redirect sends to `/dashboard` for all authenticated users. Staff-scheduling lands on a page their own matrix says they shouldn't see. |
| BN-11 | **No global `notFoundComponent` in root route** | `routes/__root.tsx` | — | All | P2 | `not-found.tsx` component exists but `__root.tsx` doesn't show a `notFoundComponent` prop. Unknown routes may render blank. [NEEDS MANUAL CONFIRMATION] |

---

## 4. Route-Level State Coverage

| Route | Loading State | Empty State | Error State | Unauthorized State | Not Found | Evidence |
|---|---|---|---|---|---|---|
| `/_dashboard/dashboard` | [NEEDS CONFIRMATION] | [NEEDS CONFIRMATION] | [NEEDS CONFIRMATION] | None (no guard) | — | — |
| `/_dashboard/calendar` | [NEEDS CONFIRMATION] | [NEEDS CONFIRMATION] | [NEEDS CONFIRMATION] | Redirect to dashboard | — | — |
| `/_dashboard/patients` | [NEEDS CONFIRMATION] | [NEEDS CONFIRMATION] | [NEEDS CONFIRMATION] | Redirect to dashboard | — | — |
| `/_dashboard/billing` | [NEEDS CONFIRMATION] | [NEEDS CONFIRMATION] | [NEEDS CONFIRMATION] | `requireRole` redirects | — | — |
| `/_dashboard/settings` | — | — | — | Double-guarded redirect | — | ✅ |
| `/_dashboard/staff` | — | — | — | Double-guarded + StaffAccessDenied | — | ✅ |
| `/_workspace/$patientId` | Uses TanStack Query | `workspace-empty-states.spec.ts` exists | [NEEDS CONFIRMATION] | None (no guard) | [NEEDS CONFIRMATION] | Partial |
| `/_workspace/queue-board` | [NEEDS CONFIRMATION] | Shows "No branch selected" | [NEEDS CONFIRMATION] | None | — | Partial |
| `/auth/pin-select` | Empty "No staff" message | ✅ | [NEEDS CONFIRMATION] | None (no guard) | — | Partial |
| `/imaging-ceph-report/$imageId` | isLoading query | isError state | isError state | None (no guard) | [NEEDS CONFIRMATION] | Partial |

---

## 5. Role-Aware Navigation Test Gaps

| Scenario | Existing Test | Missing Test | Type | Priority |
|---|---|---|---|---|
| staff_scheduling cannot reach `/billing` via nav | None | `requireRole('billing')` blocks staff_scheduling → redirect | Unit | P1 |
| staff_scheduling cannot reach `/dashboard` per ACCESS_MATRIX | None | `requireRole('dashboard')` or `getDefaultRoute` test | Unit | P2 |
| Sidebar hides restricted items for non-owners | None | Render sidebar as staff_scheduling → Billing/Reports/Staff/Settings not visible | Component | P1 |
| Unauthenticated user hitting `/auth/pin-select` redirects to login | None | Visit pin-select without session → redirected to sign-in | E2E | P1 |
| Unauthenticated user hitting `/imaging-ceph-report/...` redirects to login | None | Visit route without session → redirected | E2E | P1 |
| `/$patientId` navigate call works | None | Click patient card → lands on workspace | E2E | P1 |
| Back button from queue board goes to `/dashboard` | None | Click back → confirm destination | E2E | P2 |
| `/dental-onboarding` redirect from dashboard layout | `dental-onboarding.spec.ts` | Confirm redirect resolves to correct route + layout | E2E | P1 |
| NotFound route renders not-found.tsx | None | Visit unknown route → see NotFound UI | E2E | P2 |
| Auth'd user on `/` redirects to correct role default route | None | staff_scheduling → `/patients`; owner → `/dashboard` | E2E | P2 |

---

## 6. Route Test Gap Matrix

| Route | Existing Tests | Missing Tests | Type | Priority |
|---|---|---|---|---|
| `/_dashboard/dashboard` | Dashboard E2E exists | Role-specific redirect test | E2E | P1 |
| `/_dashboard/calendar` | `calendar.spec.ts`, `ipad-calendar.spec.ts` | Role gate test | E2E | P2 |
| `/_dashboard/patients` | `patient-registration.spec.ts` | No nav-from-sidebar test | E2E | P2 |
| `/_dashboard/patients_/$patientId` | `patient-registration.spec.ts` | Fix `as any` route param nav | Unit | P1 |
| `/_dashboard/billing` | `billing.spec.ts`, `invoice-detail.spec.ts` | staff_full blocked; role redirect | E2E | P1 |
| `/_dashboard/reports` | None found | All roles: owner ✅; associate ❌ | E2E | P1 |
| `/_dashboard/settings` | None found | owner ✅; staff_full ❌ | E2E | P1 |
| `/_dashboard/staff` | `add-staff.spec.ts` | Non-owner blocked | E2E | P1 |
| `/_dashboard/dental-onboarding` | `dental-onboarding.spec.ts` | Redirect from `_dashboard` correct route | E2E | P1 |
| `/_workspace/$patientId` | `ipad-workspace.spec.ts`, `workspace-*.spec.ts`, `$patientId.test.ts` | Role-based read-only test | E2E | P2 |
| `/_workspace/queue-board` | None | Page loads data; back button | E2E | P1 |
| `/auth/pin-select` | `pin-select.test.ts` | Unauthenticated guard | E2E | P1 |
| `/auth/pin-entry.$memberId` | `pin-entry.test.ts`, `auth-pin.spec.ts` | Unauthenticated guard | E2E | P1 |
| `/imaging-ceph-report/$imageId` | `imaging-ceph.spec.ts`, `imaging-ceph-export.spec.ts` | Auth guard, unauthenticated | E2E | P1 |
| `/` index redirect | None | Auth'd user → correct role default route | E2E | P2 |
| Unknown routes (404) | None | NotFound renders | E2E | P2 |

---

## 7. Gate 3 Verdict

**GATE 3: PASS (with critical P1 broken navigation findings)**

Route map is complete. Critical broken navigation bugs documented (BN-01 to BN-11). Proceed to Gate 4 (Frontend Interaction Integrity Audit). The following must appear in the stabilization plan as P1 fixes:

- BN-01: `/$patientId` navigate targets wrong route
- BN-02: `/patients/$patientId` path mismatch with `patients_` file 
- BN-04/05: PIN auth routes have no auth guard
- BN-06: Ceph report has no auth guard
- BN-08: Dental-onboarding redirect uses wrong path with `as any`
- BN-03: Sidebar not role-filtered
