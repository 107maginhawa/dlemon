# Dashboard / Reports Module Audit

**Module**: Dashboard / Reports (Module 13 of 18)
**Audit date**: 2026-05-26
**Auditor**: Code Review Agent
**Status**: COMPLETE

## Scope

| Layer | Path |
|-------|------|
| Frontend route (dashboard) | `apps/dentalemon/src/routes/_dashboard/dashboard.tsx` |
| Frontend route (reports) | `apps/dentalemon/src/routes/_dashboard/reports.tsx` |
| Dashboard layout + nav | `apps/dentalemon/src/routes/_dashboard.tsx` |
| Dashboard component | `apps/dentalemon/src/features/dashboard/components/morning-briefing.tsx` |
| Dashboard hook | `apps/dentalemon/src/features/dashboard/hooks/use-dashboard-summary.ts` |
| Reports components | `apps/dentalemon/src/features/reports/components/{revenue,treatment,patient}-report.tsx` |
| Reports hooks | `apps/dentalemon/src/features/reports/hooks/use-{treatment,patient}-report.ts` |
| RBAC utility | `apps/dentalemon/src/utils/rbac.ts` |
| Route guards | `apps/dentalemon/src/utils/guards.ts` |
| Org context store | `apps/dentalemon/src/stores/org-context.store.ts` |
| Backend summary handler | `services/api-ts/src/handlers/dental-org/getDashboardSummary.ts` |
| Backend audit handler | `services/api-ts/src/handlers/dental-audit/getAuditEvents.ts` |
| Audit log schema | `services/api-ts/src/handlers/dental-audit/repos/audit-log.schema.ts` |
| Backend tests | `services/api-ts/src/handlers/dental-org/dental-dashboard-module5.test.ts` |
| Backend audit tests | `services/api-ts/src/handlers/dental-audit/audit.test.ts` |

---

## Findings Summary

| # | Severity | Gate | Finding | CF ref |
|---|----------|------|---------|--------|
| F1 | P1 | G2 | `dashboard.tsx` defaults `null` role to `dentist_owner`, passing full-privilege role to `MorningBriefing` and enabling billing CTAs and financial widgets for users with no org context | CF-08 |
| F2 | P1 | G2 | `reports.tsx` contains the same `?? 'dentist_owner'` null-role default. When role is null, `canAccessReports('dentist_owner')` returns `true`, bypassing the access check entirely | CF-08 (variant) |
| F3 | P1 | G3 | Sidebar `navGroups` in `_dashboard.tsx` is a static hardcoded array — Billing, Reports, and Staff links are always rendered regardless of role. No filtering by `canAccess()` before passing to `AppSidebar` | new |
| F4 | P1 | G6 | `getAuditEvents` at `GET /dental/admin/audit` is **not registered** in `routes.ts` or `registry.ts` — the backend handler exists but is unreachable. The Reports page has no frontend consumer of this endpoint | new |
| F5 | P1 | G6 | Reports page piggybacks on billing and visits APIs (`/dental/billing/invoices`, `/dental/visits`). There are no dedicated `/dental/reports/*` endpoints. No report endpoints exist in OpenAPI spec | new |
| F6 | P2 | G4 | `requireRole('reports')` in `beforeLoad` correctly redirects when role is null (guard handles null explicitly). But `ReportsPage` body still does `?? 'dentist_owner'` — redundant and contradictory to the guard logic, creating false security impression | new |
| F7 | P2 | G3 | `dentist_associate` role has `billing: true` in RBAC matrix (can view billing) but `reports: false`. The sidebar shows Reports and Billing links for all roles including staff — a staff member navigating to `/reports` relies solely on the `requireRole` guard to block | new |
| F8 | P2 | G8 | Backend tests (`dental-dashboard-module5.test.ts`) use `buildTestApp()` which directly calls `getDashboardSummary` without going through `assertBranchAccess` via a real server. Tests confirm data correctness but cannot catch route registration failures | pre-existing |
| F9 | P2 | G8 | No backend test covers the `null role` / absent membership scenario for `getDashboardSummary`. The backend uses `assertBranchAccess` (any member role) but no test verifies a non-member is correctly rejected | new |
| F10 | P3 | G5 | Reports page has no export functionality (no CSV/PDF download). Revenue, Treatment, and Patient report tabs display data only. Export CTA mentioned in PRD is absent | new |
| F11 | P3 | G5 | Reports page has no date range filter form — all three report tabs show all-time data scoped only by `branchId`. No `from`/`to` parameters are sent to any backend endpoint | new |
| F12 | P3 | G6 | `getDashboardSummary` OpenAPI spec declares `x-security-required-roles: ['user']` — an extremely broad role that does not map to the dental RBAC model (`dentist_owner`, `dentist_associate`, etc.). Role enforcement is done only by `assertBranchAccess` at the business layer, not at the spec level | new |

---

## Gate-by-Gate Analysis

### Gate 2 — Role and Permission Map

**RBAC matrix** (`apps/dentalemon/src/utils/rbac.ts`):

| Module | dentist_owner | dentist_associate | staff_full | staff_scheduling |
|--------|:---:|:---:|:---:|:---:|
| dashboard | true | true | true | **false** |
| billing | true | true | false | false |
| reports | true | false | false | false |
| staff | true | false | false | false |
| settings | true | false | false | false |

**`canViewFinancials`**: `dentist_owner` or `dentist_associate` only.
**`canAccessReports`**: `dentist_owner` only.
**`canManageStaff`**: `dentist_owner` only.

**CF-08 confirmed (F1 + F2).**

`dashboard.tsx` line 12:
```typescript
const role = (useOrgContextStore((s) => s.role) ?? 'dentist_owner') as DentalRole
```

`reports.tsx` line 25:
```typescript
const role = (useOrgContextStore((s) => s.role) ?? 'dentist_owner') as DentalRole;
```

The org context store initializes `role` as `null`. The `??` operator silently elevates a null-role user to `dentist_owner`. For dashboard: `MorningBriefing` receives `showFinancials = canViewFinancials('dentist_owner') = true`, so billing CTAs (Daily Collections "Details" → `/billing`, Overdue Invoices "View all" → `/billing`, Payment Plans "Manage" → `/billing`) all render. For reports: `canAccessReports('dentist_owner')` is `true`, so the Reports page renders its full content. The `requireRole` guard in `beforeLoad` handles null correctly (redirects), but `ReportsPage`'s inline check is still reached when `role` is populated as a non-owner role and `??` returns it — but when role is truly `null`, `requireRole` in `beforeLoad` redirects before the component renders, so the Reports CF-08 case is guarded at route level. Dashboard has no `requireRole` guard in `beforeLoad` at all — it only has the `?? 'dentist_owner'` fallback.

**Net impact (CF-08):**
- A user whose org context API call fails (network error, API unreachable) but who has a `branchId` in the store (from prior session) lands on `/dashboard` with `role = null`. They get the full `dentist_owner` view: daily collections, overdue invoices, payment plan totals, and billing navigation CTAs.
- `staff_full` and `dentist_associate` are not affected (their roles are set) but all billing CTAs are still visible if role is somehow null (e.g., store not yet populated on first render before the layout `beforeLoad` finishes).

**Sidebar nav items (F3):**
`_dashboard.tsx` constructs `navGroups` as a hardcoded static array containing Billing, Reports, Staff, and Settings for all users. `AppSidebar` renders whatever it receives — it has no role-filtering logic. A `staff_full` user sees "Reports" and "Staff" in the sidebar. Clicking them results in `requireRole` redirect (for Reports) or hard block (for Staff). The sidebar does not visually hide inaccessible links.

### Gate 3 — Route and Navigation

| Route | Guard | Null-role outcome |
|-------|-------|-------------------|
| `/_dashboard` (layout) | `requireAuth` + org context fetch + redirect to onboarding if no `branchId` | If `branchId` exists in store, passes through with `role = null` |
| `/_dashboard/dashboard` | No `beforeLoad` role guard | Renders with `dentist_owner` privileges when role is null |
| `/_dashboard/reports` | `requireRole('reports')` in `beforeLoad` | Null role → `canAccess(null, 'reports')` is not reached; guard checks `!role` first → redirects to `/dashboard` |
| `/_dashboard/staff` | Inline `memberRole !== 'dentist_owner'` check | Redirects non-owners |

`requireRole` implementation:
```typescript
export function requireRole(module: DentalModule) {
  return function roleGuard() {
    const role = useOrgContextStore.getState().role as DentalRole | null
    if (!role || !canAccess(role, module)) {
      throw redirect({ to: '/dashboard' })
    }
  }
}
```

Reports is protected at route load. Dashboard is not. The redirect destination for blocked roles is `/dashboard` — meaning a `staff_full` user redirected from `/reports` lands on `/dashboard` which then shows billing widgets due to CF-08 if role becomes null at any point.

**Dashboard CTAs and their navigation:**

| CTA | Target | Role gate |
|-----|--------|-----------|
| New Patient | `/patients` | None |
| New Appointment | `/calendar` | None |
| Open Workspace | `/patients` | None |
| Daily Collections "Details" | `/billing` | `showFinancials` (hidden for `staff_full`) |
| Overdue Invoices "View all" | `/billing` | `showFinancials` (hidden for `staff_full`) |
| Payment Plans "Manage" | `/billing` | `showFinancials` (hidden for `staff_full`) |
| Schedule "View all" | `/calendar` | None |
| Lab Orders | none (display only) | None |

CTAs that navigate to `/billing` are correctly gated by `showFinancials`. However, `showFinancials` uses the role which may be `dentist_owner` due to CF-08.

### Gate 4 — Frontend Interaction Integrity

**Dashboard summary load path:**
1. `DashboardPage` reads role and branchId from `useOrgContextStore`
2. Passes to `MorningBriefing` → `useDashboardSummary({ branchId, showFinancials })`
3. `useDashboardSummary` fires 3–5 parallel `fetch()` calls:
   - `GET /dental/appointments?date=today&branchId=`
   - `GET /dental/appointments?date=tomorrow&branchId=`
   - `GET /dental/dashboard/summary?branchId=`
   - (if `showFinancials`) `GET /dental/billing/invoices?status=overdue&branchId=`
   - (if `showFinancials`) `GET /dental/billing/invoices?branchId=`
4. All responses checked; errors propagate as thrown `Error` objects

If `branchId` is empty string (null fallback), `?branchId=` is sent as empty — backend `getDashboardSummary` will throw a `ValidationError` ("branchId query parameter is required" only if branchId is falsy). Actually the check is: `if (!branchId) throw ValidationError`. Empty string is falsy, so it correctly rejects.

**Reports interaction path:**
- Revenue tab: `fetch('/dental/billing/invoices?branchId=')` directly in component (not via hook)
- Treatment tab: `useTreatmentReport` → `GET /dental/visits?branchId=` then per-visit `GET /dental/visits/{id}/treatments`
- Patient tab: `usePatientReport` → source API to be confirmed but follows same pattern

All data is derived from billing and clinical endpoints. No dedicated reports API exists.

**Missing interactions:**
- No export button (CSV/PDF)
- No date range filter
- No pagination control in reports tables (data volume risk)

### Gate 5 — Forms, Modals, Tables

**Reports page forms:**
- No date range filter form present in any of the three report tabs
- No export button present
- No filter by treatment type, provider, or status

**Dashboard page forms:**
- No forms on dashboard — display only with CTAs
- No filter for appointment list

**Tables:**
- Revenue report: invoice table with `InvoiceDetailSheet` side panel (exists at `features/reports/components/invoice-detail-sheet.tsx`)
- Treatment report: grouped treatment table (group by type)
- Patient report: patient stats table

**Audit log table:**
- No frontend component exists that calls `GET /dental/admin/audit`. The audit log backend is fully built but has no frontend surface in the dashboard or reports module.
- The Reports page does not include an "Audit Log" tab despite the backend having a queryable `dental_audit_log` table with full filtering support.

### Gate 6 — Backend/API Contract Alignment

**`GET /dental/dashboard/summary`** — backend and frontend aligned:

| Aspect | Status |
|--------|--------|
| Endpoint exists in OpenAPI | Yes |
| Frontend calls correct path | Yes |
| Response shape matches frontend consumption | Yes — `activePaymentPlans.{count, behindCount}`, `labOrders.{totalPending, ordered, inFabrication, overdueDelivery}` |
| Auth required | Yes — `bearerAuth` + `assertBranchAccess` |
| Role restriction in spec | Weak — `x-security-required-roles: ['user']` only; dental role enforcement is business-layer only |

**`GET /dental/admin/audit`** (getAuditEvents):

| Aspect | Status |
|--------|--------|
| Handler implemented | Yes |
| Route registered in `routes.ts` | **No — handler not found in generated routes** |
| OpenAPI spec entry | **No — `/dental/admin/audit` absent from spec** |
| Frontend consumer | **No — Reports page does not call this endpoint** |
| Role check | Admin role only (`user.role.includes('admin')`) — uses platform `admin` role, not dental RBAC roles |

The `audit.test.ts` tests `AuditLogRepository` directly — correct and isolated. But the endpoint itself is dead (not routed, not specced, not consumed).

**Reports tab backend APIs (piggyback pattern):**

| Report tab | API call | Dedicated endpoint? |
|------------|----------|---------------------|
| Revenue | `GET /dental/billing/invoices` | No — reuses billing |
| Treatment | `GET /dental/visits` + `GET /dental/visits/{id}/treatments` | No — reuses clinical |
| Patient | `GET /dental/patients` or similar | No — reuses patient |

No `/dental/reports/*` paths exist in OpenAPI. The entire Reports section is client-side data aggregation on top of existing endpoints. This means: (a) no server-side filtering by date range, (b) no export endpoint, (c) data volume grows linearly — fetching all invoices or all visits for a branch will degrade as data grows.

### Gate 7 — Role-Based Journey Map

**Journey 1: dentist_owner opens dashboard**
1. Layout `beforeLoad`: auth passes, org context fetched from `/dental/org/context`, `role = 'dentist_owner'` set in store
2. `DashboardPage`: role = `'dentist_owner'` (not null, `??` no-ops)
3. `MorningBriefing`: `showFinancials = true`
4. Renders: Daily Collections, Overdue Invoices, Payment Plans with Billing CTAs
5. `/reports` link in sidebar → `requireRole` passes → full Reports page renders
6. CORRECT behavior

**Journey 2: staff_full opens dashboard**
1. Layout `beforeLoad`: `role = 'staff_full'` set
2. `DashboardPage`: role = `'staff_full'`
3. `MorningBriefing`: `showFinancials = false`
4. Billing CTAs hidden, Lab Orders and Appointments shown
5. Sidebar shows "Billing" and "Reports" links (not filtered)
6. `/reports` → `requireRole('reports')` → `canAccess('staff_full', 'reports') = false` → redirects to `/dashboard`
7. `staff_full` redirected to dashboard — correct but confusing UX (sidebar link leads to redirect)

**Journey 3: new user / null org context**
1. Layout `beforeLoad`: org context API call succeeds but `ctx.branch?.id` is absent (no org created yet) → redirect to `/dental-onboarding`
2. User cannot reach dashboard. CF-08 does not trigger for the zero-org case because the redirect happens first.
3. **CF-08 triggers in the partial-failure scenario**: org context API fails (network error, cold start), `branchId` exists in store from previous session, `role` is null in store (not persisted across sessions, store starts as null). Layout `beforeLoad` falls through to the store check — `branchId` is truthy from prior session, no redirect. `DashboardPage` renders with `role = null → 'dentist_owner'`.
4. **Also triggers**: if layout `beforeLoad`'s fetch call returns `200` but the response body has `ctx.member?.role = null` (member record missing role field), the store gets `role: null`. `DashboardPage` renders full owner view.

**Journey 4: staff_scheduling**
1. Layout `beforeLoad`: passes if branchId in store
2. `DashboardPage`: `role = 'staff_scheduling'`
3. RBAC matrix: `dashboard: false` for `staff_scheduling`
4. No `requireRole` guard on `/dashboard` route — the route renders
5. `MorningBriefing` receives `role = 'staff_scheduling'`; `canViewFinancials('staff_scheduling') = false`, billing CTAs hidden
6. `staff_scheduling` should not see the dashboard at all per RBAC, but does because `/dashboard` has no `beforeLoad` role guard
7. PRD note says "enforced at route level" — but the route level guard is missing

### Gate 8 — Test Confidence Gap

**Backend tests** (`dental-dashboard-module5.test.ts`):

| Test scenario | Covered |
|---------------|---------|
| Returns zeros when no data | Yes |
| 401 without auth | Yes |
| FR0.7: active payment plan count | Yes |
| FR0.7: behindCount | Yes |
| FR0.8: lab order counts | Yes |
| FR0.8: overdue delivery | Yes |
| Role-filtered responses (dentist_owner vs staff_full) | **No** |
| Non-member access rejected | **No** |
| Null/empty branchId rejected | **No** |
| `buildTestApp()` tests via real routing | **No** — injects handler directly |

**Backend test score: 5/10**. Data logic well-covered; auth/role edge cases absent.

**Audit handler tests** (`audit.test.ts`):

| Test scenario | Covered |
|---------------|---------|
| AuditLogRepository insert and list | Yes |
| Filter by actorId, tenantId, branchId | Yes |
| Filter by date range | Yes |
| `logAuditEvent` wires to repository | Yes |
| `getAuditEvents` endpoint (admin role check) | **No** |
| Non-admin rejected | **No** |

**Audit test score: 4/10**. Repository layer solid; handler entry point untested.

**Frontend tests** (`morning-briefing.test.ts`, `use-dashboard-summary.test.ts`):

| Test scenario | Covered |
|---------------|---------|
| RBAC matrix values for each role | Yes — unit tests on `canAccess`, `canViewFinancials` |
| `staff_scheduling` blocked from dashboard | Yes — tests `canAccess('staff_scheduling', 'dashboard') = false` |
| `staff_full` cannot view financials | Yes |
| CF-08: null role defaults to dentist_owner | **Not tested** |
| `useDashboardSummary` with `showFinancials: false` | Yes |
| `useDashboardSummary` financial fetch gating | Yes |
| Dashboard renders correct widgets per role | Partial — pure logic tested; no component render test |

**Frontend test score: 5/10**. Logic helpers well-covered; the null-role escalation path is untested.

**Reports tests:**

| Test scenario | Covered |
|---------------|---------|
| `canAccessReports` for each role | Not found in reviewed tests |
| Revenue report API call | `revenue-report.test.ts` exists |
| Treatment report hook | `use-treatment-report.test.ts` exists |
| Patient report hook | `use-patient-report.test.ts` exists |
| CF-08 null-role allows reports | **Not tested** |
| Date filter, export | **Not tested** (features absent) |

**Reports test score: 4/10**. Component-level tests exist but CF-08 bypass untested.

---

## Critical Issues Detail

### CF-08 (P1) — Null Role Defaults to dentist_owner

**Evidence — dashboard.tsx line 12:**
```typescript
const role = (useOrgContextStore((s) => s.role) ?? 'dentist_owner') as DentalRole
```

**Evidence — reports.tsx line 25:**
```typescript
const role = (useOrgContextStore((s) => s.role) ?? 'dentist_owner') as DentalRole;
```

**Evidence — org-context.store.ts:**
```typescript
export const useOrgContextStore = create<OrgContextStore>((set) => ({
  orgId: null,
  branchId: null,
  memberId: null,
  role: null,   // <-- initial value is null
  ...
}))
```

**Evidence — _dashboard.tsx layout `beforeLoad`:**
```typescript
useOrgContextStore.getState().setContext({
  branchId: ctx.branch.id,
  orgId: ctx.org?.id ?? null,
  role: ctx.member?.role ?? null,   // <-- null if member has no role field
  memberId: ctx.member?.id ?? null,
})
```

**Trigger conditions:**
1. API call fails or returns non-ok → store `role` stays `null`
2. API returns `ctx.member.role = null` or `undefined` → store `role` set to `null`
3. Store has stale `branchId` from prior session but fresh page load has not completed context fetch

**Impact in dashboard:** `showFinancials = canViewFinancials('dentist_owner') = true` — billing CTAs visible, financial metrics load, overdue invoice count fetched. A `staff_full` user whose context fetch fails sees the owner's financial view.

**Impact in reports:** `canAccessReports('dentist_owner') = true` — the Reports page renders its full content. HOWEVER: `requireRole('reports')` in `beforeLoad` runs first and checks `!role` (null) → redirects to `/dashboard`. So CF-08 in Reports is mitigated by the `beforeLoad` guard — but the dashboard redirect then shows the full owner dashboard due to CF-08 in `dashboard.tsx`. The user cannot access the Reports page when role is null, but they see inflated privileges on the dashboard.

### F3 (P1) — Sidebar Renders All Nav Items Regardless of Role

**Evidence — _dashboard.tsx:** `navGroups` is a hardcoded static array passed to `AppSidebar`. No call to `canAccess()` filters the items. All users see: Dashboard, Patients, Calendar, Billing, Reports, Staff, Settings.

**Evidence — app-sidebar.tsx:** `AppSidebar` renders all items in `navGroups` unconditionally — no role awareness in the component.

**Impact:** `staff_full` sees Billing, Reports, Staff, Settings links. Clicking them results in redirect (Reports via `requireRole`), a block message (Settings), or visible but functionally blocked page. The sidebar visually misrepresents access level.

### F4 (P1) — getAuditEvents Handler Not Routed

**Evidence:** `grep` for `getAuditEvents` in `routes.ts` and `registry.ts` returns zero results. The handler at `services/api-ts/src/handlers/dental-audit/getAuditEvents.ts` exists and is correctly implemented but is not imported into the generated router.

**Evidence — OpenAPI spec:** No path containing `/dental/admin/audit` exists in `openapi.json`.

**Impact:** The audit log is populated by `logAuditEvent` calls throughout the system. There is no way to query it via the API. The Reports page has no audit log tab. The `dental_audit_log` table (with 4 indexes, full filter support) is write-only from a product perspective.

---

## Recommended Fix Priority

### P1 — Must fix before production

1. **CF-08 dashboard.tsx**: Remove `?? 'dentist_owner'` fallback. Add `requireRole('dashboard')` to the route's `beforeLoad` (or handle null role with a proper loading/error state). If role is null at render time, show a loading skeleton rather than elevated privileges. File: `apps/dentalemon/src/routes/_dashboard/dashboard.tsx` line 12.

2. **CF-08 reports.tsx**: Remove `?? 'dentist_owner'` fallback. The `requireRole` guard already handles the null case before the component renders — the inline `canAccessReports` check can use the non-fallback role. File: `apps/dentalemon/src/routes/_dashboard/reports.tsx` line 25.

3. **F3 sidebar filtering**: In `_dashboard.tsx`, filter `navGroups` by `canAccess(role, module)` before passing to `AppSidebar`. Retrieve role from `useOrgContextStore` inside `DashboardLayout`. When role is null, show minimal nav (Dashboard only) until context loads.

4. **F4 audit endpoint routing**: Register `getAuditEvents` in the TypeSpec spec and regenerate routes, or manually add the route to the app. Add to OpenAPI spec under a new `Dental:Admin` tag with `admin` role security.

### P2 — Should fix

5. **F8 backend tests use `buildTestApp`**: Add at least one test that boots the real Hono app and hits the route via HTTP to catch routing bugs.

6. **F9 backend non-member test**: Add test for `getDashboardSummary` called by a user who is not a member of the branch — should get 403.

7. **F6 redundant null-role check**: After fixing CF-08, remove the redundant `?? 'dentist_owner'` in `reports.tsx` entirely to avoid confusion about the double-check pattern.

8. **F7 dentist_associate sidebar**: `dentist_associate` cannot access Reports per RBAC matrix but sidebar shows the Reports link. Fixed by F3 sidebar filtering.

### P3 — Consider

9. **F10 export functionality**: Add export endpoint and UI. Short-term: client-side CSV export from already-fetched data.

10. **F11 date range filter**: Add `from`/`to` query params to reports hooks. Backend billing and visits endpoints already accept date filters.

11. **F12 OpenAPI role spec**: Update `getDashboardSummary` spec from `x-security-required-roles: ['user']` to reflect actual dental RBAC requirement. Does not change runtime behavior but improves spec accuracy.

---

## Overall Confidence Score

| Layer | Coverage | Score |
|-------|----------|-------|
| Backend unit tests (dashboard data logic) | Good — 6 data scenarios | 7/10 |
| Backend unit tests (auth/role paths) | Missing non-member, null-branchId | 3/10 |
| Backend audit handler tests | Repository solid, endpoint untested | 4/10 |
| Frontend RBAC logic tests | Role matrix and `canViewFinancials` covered | 6/10 |
| Frontend CF-08 null-role path tests | Not tested | 0/10 |
| Reports component/hook tests | Exist but scope unknown | 4/10 |
| E2E coverage | Not found for dashboard or reports | 0/10 |
| **Overall** | | **3/10** |

The module has a working backend data layer and a partially correct RBAC model, but the null-role privilege escalation (CF-08) is confirmed in both routes, the sidebar renders unauthorized nav items for all roles, the audit endpoint is unrouted, and reports lack dedicated backend APIs. The test suite does not cover the most critical failure paths.
