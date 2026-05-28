# App Shell / Layout / Sidebar / Navigation — Audit Report

**Date:** 2026-05-26
**Auditor:** Read-only audit (no code changes)
**Scope:** `app-sidebar.tsx`, `_dashboard.tsx`, `_workspace.tsx`, RBAC utils, guards, route files

---

## Files Examined

| File | Exists | Purpose |
|------|--------|---------|
| `apps/dentalemon/src/components/app-sidebar.tsx` | YES | Dumb renderer — takes `navGroups` as props |
| `apps/dentalemon/src/routes/_dashboard.tsx` | YES | Layout that BUILDS navGroups (hardcoded, no role filter) |
| `apps/dentalemon/src/routes/_workspace.tsx` | YES | Workspace shell — no sidebar, auth + org context only |
| `apps/dentalemon/src/utils/rbac.ts` | YES | ACCESS_MATRIX, canAccess, getDefaultRoute, canViewFinancials |
| `apps/dentalemon/src/utils/guards.ts` | YES | requireAuth, requireRole, composeGuards |
| `apps/dentalemon/src/stores/org-context.store.ts` | YES | Zustand store: orgId, branchId, memberId, role |
| Test files for sidebar/dashboard layout | NONE | Zero tests for sidebar rendering or navGroup building |

---

## Gate 2 — Role-Nav Item Matrix

### How navGroups are built (critical finding)

`DashboardLayout` in `_dashboard.tsx` builds `navGroups` as a **hardcoded constant** with NO role filtering. Every user who reaches the dashboard sees all 7 nav items regardless of role.

```typescript
// _dashboard.tsx lines 64–122 — no role read, no canAccess() call
const navGroups: NavGroup[] = [
  { label: "Clinical", items: [Dashboard, Patients, Calendar] },
  { label: "Operations", items: [Billing, Reports] },
  { label: "Admin", items: [Staff, Settings] }
]
```

The role IS stored in `useOrgContextStore` (set during `beforeLoad` from `/dental/org/context` API). It is NOT used when building navGroups.

### Nav Item × Role Matrix — What SHOULD happen (from `rbac.ts` ACCESS_MATRIX)

| Nav Item | dentist_owner | dentist_associate | staff_full | staff_scheduling |
|----------|:---:|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ | ❌ BLOCKED |
| Patients | ✅ | ✅ | ✅ | ✅ |
| Calendar | ✅ | ✅ | ✅ | ✅ |
| Billing | ✅ | ✅ | ❌ BLOCKED | ❌ BLOCKED |
| Reports | ✅ | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED |
| Staff | ✅ | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED |
| Settings | ✅ | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED |

### Nav Item × Role Matrix — What ACTUALLY happens (sidebar rendering)

| Nav Item | dentist_owner | dentist_associate | staff_full | staff_scheduling |
|----------|:---:|:---:|:---:|:---:|
| Dashboard | shown | shown | shown | shown (**BUG**) |
| Patients | shown | shown | shown | shown |
| Calendar | shown | shown | shown | shown |
| Billing | shown | shown | shown (**BUG**) | shown (**BUG**) |
| Reports | shown | shown (**BUG**) | shown (**BUG**) | shown (**BUG**) |
| Staff | shown | shown (**BUG**) | shown (**BUG**) | shown (**BUG**) |
| Settings | shown | shown (**BUG**) | shown (**BUG**) | shown (**BUG**) |

**VERDICT: CRITICAL BUG.** The sidebar shows all nav items to all roles. The RBAC infrastructure exists and is correct, but `_dashboard.tsx` never calls `canAccess()` or reads role when building navGroups.

### Mitigation at route level (partial protection)

Individual route files DO apply `requireRole()` in `beforeLoad`:
- `/billing` → `requireRole('billing')` — blocks unauthorized navigation
- `/reports` → `requireRole('reports')` — blocks unauthorized navigation
- `/staff` → `requireRole('staff')` — blocks unauthorized navigation
- `/settings` → `requireRole('settings')` — blocks unauthorized navigation

**BUT:** `/dashboard` and `/calendar` have NO `requireRole` guard. A `staff_scheduling` user can navigate to `/dashboard` from the sidebar link and it will render (the dashboard page does `?? 'dentist_owner'` role fallback, making it worse).

**NET EFFECT:** Links that shouldn't be visible are visible. Clicking protected links gets redirected (to `/dashboard`) which itself is accessible to staff_scheduling despite ACCESS_MATRIX saying `dashboard: false`.

---

## Gate 3 — Route/Link Correctness

### Link implementation
`app-sidebar.tsx` line 66: `<Link to={item.url}>` where `item.url` is a plain string from `_dashboard.tsx` (e.g. `"/dashboard"`, `"/patients"`).

**Issues found:**

1. **`as any` cast in redirect**: `_dashboard.tsx` line 57: `throw redirect({ to: '/dental-onboarding' as any })` — typed route not found in router, cast required. Signals route is not in the generated route tree.

2. **Untyped string URLs in navGroups**: All 7 `url` values in navGroups are plain strings, not typed TanStack Router routes. No compile-time safety. If a route is renamed, the link silently 404s.

3. **Active state highlighting**: `AppSidebar` uses `<Link to={item.url}>` — TanStack Router `Link` applies `aria-current="page"` automatically for exact matches. No custom active matching logic. This works but won't highlight parent routes (e.g. `/patients/123` won't highlight the Patients link).

4. **No `activeOptions` or `activeProps`**: No active state styling configured on the Link. The sidebar component delegates active styling entirely to the `SidebarMenuButton` / Radix primitive. Visual active state depends on whether the shadcn sidebar primitive detects TanStack's `data-status` attribute — not verified with tests.

---

## Gate 4 — Frontend Interaction Integrity

### Sign-out flow (`app-sidebar.tsx` lines 43–47)
```typescript
async function handleSignOut() {
  useOrgContextStore.getState().clearContext()   // ✅ clears org context
  await signOut.mutateAsync()                    // ✅ Better-Auth session cleared
  navigate({ to: '/auth/$authView', params: { authView: 'sign-in' } })  // ✅ redirect
}
```
Sign-out: **CORRECT**. Clears org context before session, then navigates.

**Issue:** If `signOut.mutateAsync()` throws, the navigate is skipped but org context is already cleared. User stays on dashboard in a broken state (no org context). Should use try/catch or always-navigate pattern.

### Mobile/collapsibility
- `_dashboard.tsx` renders `<SidebarTrigger>` in the header (`line 133`) — allows toggling.
- `AppSidebar` wraps in `<Sidebar>` from the shadcn sidebar primitive which handles mobile collapsing.
- No explicit `collapsible` prop passed — defaults to shadcn sidebar's default behavior (typically `"offcanvas"` for mobile). Not audited further without running the app.

### Disabled state during sign-out
`app-sidebar.tsx` line 98: `disabled={signOut.isPending}` — correctly disables the button during the async operation. Good.

---

## Gate 5 — Form/Modal/Table Action

**N/A.** The sidebar and layout shell contain no forms, modals, or tables.

Evidence: `app-sidebar.tsx` renders only nav links and a sign-out button. `_dashboard.tsx` renders `<AppSidebar>` + `<Outlet>`. `_workspace.tsx` renders only `<Outlet>`. No form elements, dialogs, or data tables exist in any of these three files.

---

## Gate 6 — Backend API Contract

### API call in `_dashboard.tsx` beforeLoad (lines 34–51)

```typescript
const res = await fetch(`${apiUrl}/dental/org/context`, {
  credentials: 'include',
})
const ctx = await res.json() as any
// Reads: ctx.branch.id, ctx.org?.id, ctx.member?.role, ctx.member?.id
```

**Issues:**

1. **`as any` cast** — response shape not validated against OpenAPI spec. If `/dental/org/context` returns a different shape, the store is silently set to `undefined` values with no error.

2. **No error UI** — catch block silently falls through to onboarding redirect check. API errors (500, network timeout) are invisible to the user.

3. **Same fetch duplicated in `_workspace.tsx`** (lines 13–21) — identical fetch with identical `as any` cast. Two sources of truth for the same API contract.

4. **Endpoint not in OpenAPI spec check** — the path `/dental/org/context` is a custom dental endpoint. Not verified to be in `specs/api/dist/openapi/openapi.json`. Uses raw `fetch` not the generated SDK client.

5. **Role written as plain string** — `role: ctx.member?.role ?? null` stored in Zustand as `string | null`, not typed as `DentalRole`. The `requireRole` guard casts it: `useOrgContextStore.getState().role as DentalRole | null`. If the API returns an unknown role string, `canAccess()` returns `false` for all modules (safe default), but no validation error is surfaced.

### `_workspace.tsx` beforeLoad
Same `/dental/org/context` fetch, same issues. Additionally: if the fetch fails or org context is missing, workspace does NOT redirect to onboarding (unlike `_dashboard.tsx`). A workspace user with no org context silently proceeds with `null` values.

---

## Gate 7 — Role Journey Gaps

### staff_scheduling navigating to Billing
1. Sidebar shows "Billing" link (BUG — should be hidden)
2. User clicks → TanStack Router runs `_dashboard/billing.tsx` `beforeLoad: requireRole('billing')`
3. `billing: false` in ACCESS_MATRIX → `redirect({ to: '/dashboard' })`
4. `/dashboard` loads (no `requireRole` guard on dashboard route)
5. Dashboard page: `role ?? 'dentist_owner'` fallback — **uses owner role as fallback** even for scheduling staff
6. `MorningBriefing` renders with `dentist_owner` role, showing financial data to a scheduling-only staff member

**VERDICT: CRITICAL.** staff_scheduling can see financial/clinical metrics on `/dashboard` because the dashboard page has a hardcoded role fallback of `'dentist_owner'`.

### dentist_associate accessing Staff
1. Sidebar shows "Staff" link (BUG — should be hidden)
2. User clicks → `requireRole('staff')` fires → `staff: false` → redirect to `/dashboard`
3. Correctly blocked at route level. But sidebar item still visible, degrading UX.

### staff_scheduling accessing Dashboard directly
1. `staff_scheduling` has `dashboard: false` in ACCESS_MATRIX
2. No `requireRole('dashboard')` guard on `/_dashboard/dashboard.tsx`
3. `_dashboard.tsx` `beforeLoad` doesn't check role for dashboard access
4. User navigates to `/dashboard` → loads successfully
5. `MorningBriefing` called with `role ?? 'dentist_owner'` — sees owner-level data
6. **VERDICT: UNBLOCKED. staff_scheduling can access /dashboard with owner-level data display.**

### Role journey summary

| Journey | Sidebar link visible? | Route blocked? | Verdict |
|---------|:---:|:---:|---------|
| staff_scheduling → /billing | YES (bug) | YES (requireRole) | Partially mitigated |
| staff_scheduling → /dashboard | YES (bug) | NO (no guard) | **UNBLOCKED + wrong role fallback** |
| staff_scheduling → /reports | YES (bug) | YES (requireRole) | Partially mitigated |
| staff_scheduling → /staff | YES (bug) | YES (requireRole) | Partially mitigated |
| dentist_associate → /reports | YES (bug) | YES (requireRole) | Partially mitigated |
| dentist_associate → /staff | YES (bug) | YES (requireRole) | Partially mitigated |
| staff_full → /billing | YES (bug) | YES (requireRole) | Partially mitigated |

---

## Gate 8 — Test Coverage Gap

### What exists
- `utils/rbac.test.ts` — **good coverage** of `canAccess`, `getDefaultRoute`, `canViewFinancials`, `canManageStaff`, `canAccessReports`. Tests 12 role×module combinations.
- One test comment inconsistency: `getDefaultRoute("staff_scheduling")` expected `/calendar` in comment but test actually asserts `/patients` (matches implementation). Minor documentation debt.

### What is MISSING (zero tests)

| Missing Test | Risk |
|--------------|------|
| `_dashboard.tsx` builds role-filtered navGroups | The core bug (hardcoded navGroups) would be caught immediately if this test existed |
| `AppSidebar` renders correct items for each role | No rendering test at all |
| `handleSignOut` clears context before navigating | Sign-out error path untested |
| `requireRole` redirects unauthorized roles | Guards only unit-tested via rbac.test; no integration with route |
| `/dashboard` route reachable by staff_scheduling | Unauthorized access to dashboard undetected |
| Active state on sidebar items | No test verifies link highlighting |
| `_workspace.tsx` proceeds with null org context | Silent failure path untested |
| API `/dental/org/context` response shape validation | `as any` cast means shape bugs are invisible |

**Coverage estimate for app shell module: 2/10**
- RBAC utility: well tested (saves score from 0)
- Layout/sidebar/route guards: zero test coverage

---

## Overall Coverage

| Gate | Score | Notes |
|------|-------|-------|
| Gate 2 — Role-Nav Item Matrix | 2/10 | RBAC matrix exists but _dashboard.tsx never applies it to navGroups |
| Gate 3 — Route/Link Correctness | 5/10 | Links work; untyped strings, `as any` cast on redirect, no active state tests |
| Gate 4 — Interaction Integrity | 6/10 | Sign-out correct flow; error path not handled; mobile unverified |
| Gate 5 — Forms/Modals | N/A | No forms in scope |
| Gate 6 — API Contract | 3/10 | Fetch exists; `as any`, duplicated, unvalidated, no error UI |
| Gate 7 — Role Journey | 2/10 | staff_scheduling reaches /dashboard unblocked with owner-level data |
| Gate 8 — Test Confidence | 1/10 | Zero tests for sidebar/layout; only rbac utils tested |

**Total (excl. Gate 5): 19/60 = ~32%**

**Verdict: FAILING**

---

## Priority Fixes

1. **[P0] Filter navGroups by role in `_dashboard.tsx`** — read role from `useOrgContextStore`, filter each group's items with `canAccess(role, module)`.
2. **[P0] Add `requireRole('dashboard')` guard to `/_dashboard/dashboard.tsx`** — staff_scheduling must not reach it.
3. **[P0] Remove `?? 'dentist_owner'` role fallback in `dashboard.tsx`** — if role is null, render nothing or redirect; never assume owner.
4. **[P1] Validate `/dental/org/context` response shape** — replace `as any` with typed Zod parse or generated SDK type.
5. **[P1] Add try/catch to `handleSignOut`** — always navigate even if signOut throws.
6. **[P2] Deduplicate `beforeLoad` fetch** — extract shared `loadOrgContext()` utility used by both `_dashboard.tsx` and `_workspace.tsx`.
7. **[P2] Add workspace null-org guard** — redirect to onboarding if org context missing, same as dashboard.
8. **[P2] Write sidebar rendering tests** — one test per role verifying correct navGroup items shown/hidden.
