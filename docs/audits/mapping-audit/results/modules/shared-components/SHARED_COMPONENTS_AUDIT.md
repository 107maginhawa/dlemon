# Shared Frontend Components / UI — Module Audit

**Module:** Shared Frontend Components / UI
**Priority:** P2 (wide blast radius — shared components affect all feature modules)
**Scope:**
- `apps/dentalemon/src/components/` — 42 component files
- `apps/account/src/components/` — ~42 component files (near-mirror)
- Test files: `datetime-filter.test.tsx`, `phone-input.test.tsx`, `empty-state.test.ts`, `image-cropper-dialog.test.tsx`
**Audit Date:** 2026-05-26

---

## Findings Summary

| ID | Severity | Gate | Title | File |
|----|----------|------|-------|------|
| SC-01 | P1 | Gate 4 | `DateTimeFilter` custom date value missing `SelectItem` — Radix Select controlled value mismatch | `components/datetime-filter.tsx` |
| SC-02 | P1 | Gate 8 | `empty-state.test.ts` does not import or render the actual `EmptyState` component — tests a phantom inline copy | `components/empty-state.test.ts` |
| SC-03 | P2 | Gate 2 | `_dashboard.tsx` builds `navGroups` with all 8 routes for all roles — no RBAC filtering applied; `staff_scheduling` can see Billing/Reports/Staff links in the sidebar | `routes/_dashboard.tsx` |
| SC-04 | P2 | Gate 3 | `AppSidebar` (dentalemon) contains a hardcoded sign-out redirect to `'/auth/$authView'` with `params: { authView: 'sign-in' }` — route string embedded in a shared component | `components/app-sidebar.tsx:43` |
| SC-05 | P2 | Gate 4 | `PhoneInput` tests cover only render/initial-value; no `onChange` fire, no validation of E.164 output, no country-switch interaction tested | `components/phone-input.test.tsx` |
| SC-06 | P2 | Gate 4 | `ImageCropperDialog` uses `CropperLib as any` cast to work around a TypeScript type mismatch with `react-easy-crop` — type safety hole in a security-adjacent component (avatar upload) | `components/image-cropper-dialog.tsx:3-4` |
| SC-07 | P2 | Gate 8 | 38 of 42 dentalemon shared components have zero tests (all Radix/shadcn primitives: `Button`, `Dialog`, `Select`, `Form`, `Combobox`, `Calendar`, `Pagination`, `Sidebar`, etc.) | `apps/dentalemon/src/components/` |
| SC-08 | P2 | Gate 8 | 38 of 42 account app shared components have zero tests — exact same gap as dentalemon, despite being a separate codebase | `apps/account/src/components/` |
| SC-09 | P3 | Gate 4 | `ImageCropperDialog` (dentalemon) imports Cropper via `import CropperLib … as any`; account version imports `Cropper` directly with no cast — two codebases have diverged on this type workaround | `components/image-cropper-dialog.tsx` vs `apps/account/src/components/image-cropper-dialog.tsx` |
| SC-10 | P3 | Gate 6 | `AppSidebar` (dentalemon) calls `useSession` and `useSignOut` from `@monobase/sdk-ts` — two SDK hooks embedded directly in a layout component; not an API call but couples shared component to auth infrastructure | `components/app-sidebar.tsx:18,40-41` |
| SC-11 | P3 | Gate 3 | `Pagination` component uses raw `<a>` tags for `PaginationLink` — no TanStack Router `Link` wrapping; links will cause full-page reloads instead of client-side navigation | `components/pagination.tsx` |
| SC-12 | P3 | Gate 5 | `Combobox` badge clear button (`<button>` with `X` icon) has no `aria-label` — screen reader sees an unlabeled interactive element for each selected badge | `components/combobox.tsx` |

---

## Gate-by-Gate Analysis

### Gate 2 — Role and Permission Map

**Is RBAC logic embedded in shared components?**

No shared component in `apps/dentalemon/src/components/` contains embedded RBAC logic. The `AppSidebar` is passed `navGroups` as a prop and renders them unconditionally — RBAC is correctly the consumer's responsibility.

**However, the consumer (`_dashboard.tsx`) does not apply RBAC filtering (SC-03):**

`_dashboard.tsx` (`DashboardLayout`) builds a static `navGroups` array containing all 8 navigation items (Dashboard, Patients, Calendar, Billing, Reports, Staff, Settings) regardless of the authenticated user's role. The `rbac.ts` utility (`utils/rbac.ts`) correctly defines the `ACCESS_MATRIX` — `staff_scheduling` should not see Billing, Reports, Staff, or Settings — but `DashboardLayout` never calls `canAccess()`.

The `rbac.ts` utility exports `canAccess(role, module)`, `getDefaultRoute(role)`, `canViewFinancials(role)`, `canManageStaff(role)`, and `canAccessReports(role)` but none are used in `_dashboard.tsx`.

**Verdict:** RBAC logic is correctly isolated to `utils/rbac.ts`, not embedded in shared components (good pattern). The consumer `_dashboard.tsx` is the failure point — it has the utility but does not use it.

---

### Gate 3 — Route and Navigation

**Hardcoded routes in shared components:**

`AppSidebar` (dentalemon, line 43) contains:
```typescript
navigate({ to: '/auth/$authView', params: { authView: 'sign-in' } })
```
This is a hardcoded route string inside a shared component. If the auth route structure changes, this component breaks silently (no TypeScript error for the string literal).

`AppSidebar` (account app) does not contain this sign-out navigation — it has no footer/sign-out at all. The two `AppSidebar` implementations have diverged in responsibility scope.

**`Pagination` component (SC-11):**
`PaginationLink` renders as `<a href="...">`. Consumers must pass `href` manually. No TanStack Router integration — any pagination click that uses the default `<a>` tag will trigger a full-page reload. This affects every paginated list view in the app.

**`NavItem.url` is prop-driven** — `AppSidebar` itself does not hardcode navigation URLs beyond the sign-out redirect. Navigation items are injected by `_dashboard.tsx`, which uses string literals (`"/dashboard"`, `"/patients"`, etc.) not typed TanStack Router routes.

---

### Gate 4 — Frontend Interaction Integrity

#### DateTimeFilter (SC-01)

`DateTimeFilter` supports a `{ date: string }` custom value variant. When `value` is an object, `getDisplayValue()` returns the string `'custom'`. The Radix `Select` component is controlled with `value={getDisplayValue()}`. The `SelectContent` renders four `SelectItem` elements with values `"any"`, `"today"`, `"tomorrow"`, `"this-weekend"` — there is no `SelectItem value="custom"`.

**Consequence:** When `value` is `{ date: '2023-10-05' }`, the controlled Radix Select has `value="custom"` but no matching `SelectItem`. Radix Select will show no selected item in the trigger (or show the raw `SelectValue` child text). The custom date display label is rendered via the `<SelectValue>` child, so the label appears — but the underlying Select is in a mismatched controlled state. If the user opens the dropdown and selects any standard option, the `onValueChange` fires with the string `"any"/"today"/"tomorrow"/"this-weekend"` cast as `DateTimeFilterValue` via `as any`, which discards the custom date permanently with no way to recover it.

The tests (`datetime-filter.test.tsx`) render the component with a custom date value and check that the formatted date label appears — this passes because the `SelectValue` child is rendered. The tests do not verify the Radix controlled value mismatch, nor do they simulate opening the dropdown and selecting a different option.

**The `custom` type is effectively broken for round-trip usage.**

#### PhoneInput (SC-05)

Tests cover:
- Renders without crashing
- Renders with `defaultCountry="CA"`
- Renders with a pre-filled value (checks formatted display)
- Renders the country selector button

Tests do not cover:
- Firing `onChange` and asserting the E.164 value callback
- Country flag display
- Country switcher interaction (open popover, select different country, verify callback)
- Empty value coercion (`undefined` → `""`)
- Invalid number entry behavior

The coercion `onChange?.(value || ("" as RPNInput.Value))` (line 161) is a key behavior preventing `undefined` from propagating — it is untested.

#### ImageCropperDialog (SC-06, SC-09)

The `getCroppedImg` function uses `canvas.toBlob()` which is async and browser-only. The function rejects if `canvas.toBlob` returns `null` (possible in memory-constrained environments or certain browser contexts). Error handling in `handleCrop` (`try/catch` with `console.error`) silently swallows crop failures — the user sees no error state and the dialog remains open in a broken state (no toast, no error message rendered).

The dentalemon version uses:
```typescript
import CropperLib, { Area } from 'react-easy-crop'
const Cropper = CropperLib as any
```
The account version uses the direct import:
```typescript
import Cropper, { Area } from 'react-easy-crop'
```
The `as any` cast in dentalemon was introduced to work around a TypeScript type conflict. This means type errors in Cropper prop usage in dentalemon are silently ignored.

#### EmptyState (SC-02) — CRITICAL TEST GAP

`empty-state.test.ts` does not import the `EmptyState` component at all. It defines an inline `EmptyStateConfig` interface and `EMPTY_STATES` array that duplicate the component's expected behavior but test nothing about the real component. The actual `EmptyState` React component (`empty-state.tsx`) with its `role="status"`, action button, focus ring styling, and `aria-hidden` icon rendering is never tested.

Specifically untested in the real component:
- The action button renders and fires `action.onClick`
- `icon` prop renders with `aria-hidden="true"`
- `role="status"` is present on the container
- Lemon focus ring class is actually applied to the button
- Component renders without `action` prop (optional)

The test suite passes with 100% green output while the real component could have a regression in any of these areas.

#### Combobox

Well-structured: supports `multiSelect`, `clearable`, `testId`, `aria-labelledby`, `aria-describedby`, `aria-invalid`. Fuzzy search with keyword matching. No tests exist (SC-07), but the implementation is solid.

The badge clear buttons for multi-select have no `aria-label` (SC-12):
```tsx
<button onClick={() => handleSelect(val)}>
  <X className="h-3 w-3" />
</button>
```
Screen readers announce this as an unlabeled button. Should be `aria-label={`Remove ${label}`}`.

---

### Gate 5 — Forms, Modals, Tables

| Component | Type | Notes |
|-----------|------|-------|
| `PhoneInput` | Form input | E.164 output, country select via Popover+Command. Tests: render-only. |
| `DateTimeFilter` | Form control | Custom date value broken (SC-01). |
| `Combobox` | Form control | Multi-select, fuzzy search, grouping. Missing badge clear aria-label (SC-12). No tests. |
| `ImageCropperDialog` | Modal | Canvas crop, zoom slider. Silent error on crop failure (SC-06). Tests: render + button click only. |
| `Calendar` | Date picker primitive | Radix/shadcn wrapper. No tests. |
| `Form` | Form primitive | React Hook Form integration via shadcn. No tests. |
| `Pagination` | Navigation | Raw `<a>` tags — full page reload risk (SC-11). No tests. |
| `Dialog`, `Sheet`, `AlertDialog` | Modal primitives | Pure Radix wrappers. No tests. |
| `Table` | Display | Radix/shadcn primitive. No tests. |

---

### Gate 6 — Backend/API Contract Alignment

**Direct API calls in shared components:** None found. `grep` for `fetch`, `useQuery`, `useMutation`, `trpc`, `api.` across `apps/dentalemon/src/components/` returned no output.

**SDK hooks in shared components (SC-10):**
`AppSidebar` (dentalemon) imports `useSession` and `useSignOut` from `@monobase/sdk-ts/react/hooks/use-auth`. This is not a direct API call, but it couples a shared layout component to the SDK auth layer. The account `AppSidebar` has no such coupling — it renders purely from props. This divergence means the dentalemon `AppSidebar` cannot be used in a context without an active Better-Auth session provider.

**`getCroppedImg` in `ImageCropperDialog`:** Uses `canvas.toBlob()` — a browser API, not a backend API. No network calls.

---

### Gate 7 — Role-Based Journey Map

No shared component has role-dependent rendering logic embedded in it. All role-aware behavior is expected to be handled by consumers.

The one component that comes closest is `AppSidebar`, which renders `session?.user?.name` and `session?.user?.email` in the footer — these come from the session, not from a dental role. The RBAC gap is upstream in `_dashboard.tsx` (SC-03).

**`patient-folder-card.tsx`** (in `features/patients/components/`, not `components/`) is technically a feature component, not a shared component. It uses callback props (`onClick`, `onProfile`) and has no embedded role checks — correct pattern.

---

### Gate 8 — Test Confidence Gap

#### Test Inventory — dentalemon `components/`

| Component | Test File | Test Quality |
|-----------|-----------|--------------|
| `datetime-filter.tsx` | `datetime-filter.test.tsx` | Partial — render + display label. Missing: custom SelectItem mismatch, onChange simulation, dropdown interaction. |
| `phone-input.tsx` | `phone-input.test.tsx` | Partial — render + initial value. Missing: onChange fire, E.164 validation, country switch. |
| `empty-state.tsx` | `empty-state.test.ts` | Phantom — tests an inline copy, not the real component. Zero coverage of actual component. |
| `image-cropper-dialog.tsx` | `image-cropper-dialog.test.tsx` | Partial — render, open/close, buttons. Missing: handleCrop execution, error state, canvas failure. |
| All other 38 components | None | Zero tests. |

#### Components with Zero Tests (38 of 42 in dentalemon)

`alert`, `alert-dialog`, `app-sidebar`, `avatar`, `badge`, `button`, `calendar`, `card`, `checkbox`, `combobox`, `command`, `dialog`, `dropdown-menu`, `form`, `input`, `label`, `loading`, `logo`, `not-found`, `pagination`, `popover`, `progress`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `toggle`, `toggle-group`, `tooltip`

Most of these are Radix/shadcn primitives where testing the primitive itself is low value. However the following have custom logic that warrants tests: `app-sidebar` (session display, sign-out), `combobox` (multi-select, fuzzy search, grouping), `pagination` (page calculation), `loading`, `not-found`, `logo`.

#### Account App Test Gap

Identical gap: 38 of 42 components untested. The account app has `datetime-filter.test.tsx`, `image-cropper-dialog.test.tsx`, and `phone-input.test.tsx` — but no `empty-state` at all (the account app does not have an `empty-state.tsx`).

#### Overall Test Confidence Score

| Area | Score | Rationale |
|------|-------|-----------|
| `DateTimeFilter` | 4/10 | Tests pass but miss the core controlled-value bug |
| `PhoneInput` | 3/10 | Render-only, key behavior (onChange, E.164) untested |
| `EmptyState` | 1/10 | Tests are phantom — real component untested |
| `ImageCropperDialog` | 5/10 | Dialog lifecycle tested; crop execution path untested |
| All other shared components | 0/10 | No tests |
| **Overall shared component suite** | **2/10** | Four tested components, all with gaps; 38 completely untested |

---

## Critical Issues Detail

### SC-01 — DateTimeFilter Custom Value Mismatch (P1)

**File:** `apps/dentalemon/src/components/datetime-filter.tsx`

When a `{ date: string }` value is passed, `getDisplayValue()` returns `'custom'` as the Radix Select `value` prop. There is no `<SelectItem value="custom">` in `SelectContent`. This puts the Radix Select into an uncontrolled mismatched state. Opening the dropdown and selecting any standard option fires `onValueChange` with a raw string cast `as any` to `DateTimeFilterValue`, destroying the custom date object.

The component is used anywhere a date filter with a specific date is needed. Any consumer that passes `{ date: someDate }` and allows the user to subsequently interact with the dropdown will silently lose the custom date.

**Fix:** Add a hidden `<SelectItem value="custom">` or restructure to use a separate DatePicker for the custom case, keeping `DateTimeFilter` only for the predefined string options.

### SC-02 — EmptyState Test Phantom (P1)

**File:** `apps/dentalemon/src/components/empty-state.test.ts`

The test file defines its own inline `EmptyStateConfig` interface and `EMPTY_STATES` array. It has zero `import` statements for the real component. The real `EmptyState` (`empty-state.tsx`) is never instantiated in any test. The test suite gives a false signal of coverage.

The actual component has an action button with lemon accent styling, `role="status"` on the container, and `aria-hidden="true"` on the icon — none verified.

**Fix:** Rewrite `empty-state.test.ts` to import and render `EmptyState` from `./empty-state`. Test: renders with required props, renders action button when provided, fires `action.onClick`, does not render action when omitted, `role="status"` present, icon has `aria-hidden`.

### SC-03 — Sidebar Shows All Routes Regardless of Role (P2)

**File:** `apps/dentalemon/src/routes/_dashboard.tsx`, function `DashboardLayout`

The `navGroups` array is static — it includes Billing, Reports, Staff, and Settings links for all authenticated users. A `staff_scheduling` role user sees all 8 sidebar links despite `ACCESS_MATRIX` restricting them to only `patients` and `calendar`.

The `rbac.ts` utility at `utils/rbac.ts` is available and correct but unused here. `useOrgContextStore` stores the `role` from the session.

**Fix:** In `DashboardLayout`, read `role` from `useOrgContextStore`, filter nav items using `canAccess(role, module)` before building `navGroups`.

---

## Recommended Fix Priority

| Priority | ID | Action |
|----------|----|--------|
| P1 — fix before next release | SC-01 | Add `<SelectItem value="custom">` (hidden/disabled) or split custom date into separate DatePicker path |
| P1 — fix before next release | SC-02 | Rewrite `empty-state.test.ts` to test the real component |
| P2 — fix in current sprint | SC-03 | Filter `navGroups` in `_dashboard.tsx` using `canAccess(role, module)` from `utils/rbac.ts` |
| P2 — fix in current sprint | SC-05 | Add `onChange` fire + E.164 output tests to `phone-input.test.tsx` |
| P2 — fix in current sprint | SC-06 | Remove `CropperLib as any` cast; add user-visible error state in `handleCrop` catch block |
| P2 — consider | SC-04 | Move sign-out route string to a route constant; or move sign-out logic out of `AppSidebar` into a consumer |
| P2 — consider | SC-11 | Replace `PaginationLink` raw `<a>` with TanStack Router `Link` for client-side navigation |
| P3 — backlog | SC-07/SC-08 | Add tests for `Combobox`, `AppSidebar`, `Pagination`, `Loading`, `NotFound` — the 6 components with custom logic |
| P3 — backlog | SC-09 | Align dentalemon `image-cropper-dialog.tsx` import with account app (remove `as any`) after resolving the type conflict |
| P3 — backlog | SC-10 | Extract session display and sign-out from `AppSidebar` into a slot/prop so the component is not coupled to the SDK auth layer |
| P3 — backlog | SC-12 | Add `aria-label={`Remove ${label}`}` to Combobox badge clear buttons |

---

## Overall Confidence Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| Functional correctness | 6/10 | Most UI primitives are correct Radix wrappers; SC-01 (DateTimeFilter) is a real functional bug |
| RBAC / access control | 5/10 | Pattern is correct (no RBAC in components); consumer `_dashboard.tsx` fails to apply it |
| Test coverage | 2/10 | 4 tested, all with gaps; SC-02 is a phantom test; 38 untested |
| Accessibility | 6/10 | Most components carry Radix a11y; SC-12 (Combobox badge), SC-11 (Pagination `<a>`) are gaps |
| Codebase consistency | 7/10 | Dentalemon/account are near-mirrors with two known divergences (SC-09, SC-04/SC-10) |
| **Overall** | **5/10** | Solid primitive layer; two P1 bugs (SC-01, SC-02) and one latent RBAC gap (SC-03) are the headline risks |
