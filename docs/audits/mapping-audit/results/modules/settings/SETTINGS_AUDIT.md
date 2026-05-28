# Settings / Staff / Onboarding Module Audit

**Module:** Dental Org — Settings, Staff Management, Clinic Onboarding  
**Scope:** Settings tabs (Clinic, Working Hours, Fee Schedule, Locale, Notifications), Staff management (list, add, deactivate), Dental onboarding wizard  
**Audit date:** 2026-05-26  
**Auditor:** Senior Code Reviewer (automated)

---

## Findings Summary

| ID  | Severity | Gate | Title |
|-----|----------|------|-------|
| F1  | P0 | G2/G6 | `deactivateMember` backend — any branch member can deactivate any other member (no owner-only check) |
| F2  | P0 | G6   | `createMember` (old flat endpoint) — no owner-only check; any branch member can create staff |
| F3  | P1 | G6   | Working-hours frontend uses `GET/PUT /dental/branches/{branchId}/working-hours` but no backend handler file was found; route exists in OpenAPI/generated routes but handler registration is unclear |
| F4  | P1 | G3   | `/dental-onboarding` has **no** `beforeLoad` guard of its own — relies entirely on parent `_dashboard` layout guard; a race/edge case can expose the wizard to unauthenticated navigation |
| F5  | P1 | G6   | Staff deactivation frontend calls `DELETE /dental/org/members/:memberId`; canonical OpenAPI endpoint is `POST /dental/organizations/:orgId/branches/:branchId/members/:membershipId/deactivate` — dual-endpoint split creates maintenance risk |
| F6  | P1 | G6   | Staff create frontend calls legacy `POST /dental/org/members?branchId=` — diverges from OpenAPI-canonical `POST /dental/organizations/:orgId/branches/:branchId/members/` (tier limits not enforced on legacy path) |
| F7  | P2 | G5   | Settings page uses `window.confirm()` for deactivation confirmation — not a modal dialog; fails accessibility requirements and is inconsistent with design system |
| F8  | P2 | G4   | Notification settings saved to `notificationPreferences` key inside `branch.settings` JSONB — there is no dedicated notification backend/router; saves silently but the notifications subsystem (OneSignal) is never configured from this data |
| F9  | P2 | G8   | `dental-settings-module11.test.ts` uses `buildTestApp()` pattern (bypasses real route registration) — known risk per project memory: handler unit tests with `buildTestApp()` do not catch route registration bugs |
| F10 | P2 | G8   | No backend unit test covers the `deactivateMember` owner-only gap (F1); the test suite only exercises the flat `POST /dental/org/members` path |
| F11 | P2 | G7   | Consent template data is created but there is no frontend UI wiring in the Settings page to create/edit/delete consent templates — the Settings route only shows Clinic, Hours, Fees, Locale, Notifications tabs |
| F12 | P3 | G5   | `dentist_owner` role card is shown but disabled ("Already assigned") in staff creation modal — minor UX confusion; should be hidden, not shown as a disabled option |
| F13 | P3 | G8   | Onboarding wizard unit tests (`onboarding-wizard.test.ts`) only test pure logic helpers (validators, labels) — no integration or E2E coverage for the API call sequence within the wizard itself (covered only by `dental-onboarding.spec.ts`) |

---

## Gate-by-Gate Analysis

### Gate 2 — Role and Permission Map

#### Access Matrix (per RBAC module, `apps/dentalemon/src/utils/rbac.ts`)

| Module | dentist_owner | dentist_associate | staff_full | staff_scheduling |
|--------|:---:|:---:|:---:|:---:|
| settings | YES | NO | NO | NO |
| staff | YES | NO | NO | NO |
| dashboard | YES | YES | YES | NO |

`canAccess(role, module)` is the single source of truth for both route guards and component-level visibility.

#### `/settings` route

- `beforeLoad: requireRole('settings')` — redirects to `/dashboard` for any role where `canAccess(role, 'settings') === false`
- Inside component: secondary `canAccess(role, 'settings')` check renders a plain "You do not have access" message if somehow reached
- **Backend enforcement:** `PUT /dental/branches/:branchId/settings` calls `getMemberRole` + throws `ForbiddenError` unless `role === 'dentist_owner'`. `GET` uses only `assertBranchAccess` (any branch member).
- **Gap:** Only `dentist_owner` can write settings — this is correct. Reading settings returns data to any branch member (GET). This is intentional but undocumented.

#### `/staff` route

- `beforeLoad: requireRole('staff')` — redirects non-owners before render
- Second check in `StaffPage`: reads `memberRole` from store, renders `<StaffAccessDenied>` if not `dentist_owner`
- Double guard is defense-in-depth and correct
- **Backend enforcement — critical gap (F1/F2):** see Gate 6

#### Consent templates

- Backend: write ops enforce `getMemberRole === 'dentist_owner'` explicitly (correct)
- Frontend: no settings tab for consent templates exists (F11)

#### Working hours

- Frontend: `WorkingHours` component is in the Settings page tab bar
- Backend: no working-hours handler file was located in `services/api-ts/src/handlers/dental-org/` — only the OpenAPI-generated route registration at `routes.ts` references it
- Role enforcement on the working-hours endpoint is unknown (F3)

---

### Gate 3 — Route and Navigation

| Route | Guard | Access |
|-------|-------|--------|
| `/_dashboard/settings` | `requireRole('settings')` | dentist_owner only |
| `/_dashboard/staff` | `requireRole('staff')` | dentist_owner only |
| `/_dashboard/dental-onboarding` | **None** (F4) | Any authenticated user with no org |
| `/onboarding` | `requireNoPerson` (separate) | No person profile |

**Sub-routes:** Settings is a single-route tab-panel component (no sub-routes). Tabs: Clinic, Working Hours, Fee Schedule, Locale, Notifications.

**`dental-onboarding` guard gap (F4):**  
The route file `apps/dentalemon/src/routes/_dashboard/dental-onboarding.tsx` has no `beforeLoad`. It relies on the parent `_dashboard` layout's `beforeLoad`, which redirects to `/dental-onboarding` when there is no org — but does NOT block unauthenticated navigation to `/dental-onboarding` directly if the org context store already has a stale `branchId` from localStorage. Under normal flow this is safe; under edge cases (e.g. cached store after logout) the wizard is accessible without fresh auth.

**Settings route direct navigation (unauthorized):**  
`requireRole` reads from `useOrgContextStore` (Zustand, in-memory + no persistence) — if the store has no role, `role` is null and `canAccess(null, 'settings')` returns false, redirecting to `/dashboard`. Correct.

---

### Gate 4 — Frontend Interaction Integrity

#### Clinic Settings tab

- Form fields: Clinic Name (required), Address (required), Phone (optional regex), Email (optional regex), Logo URL, License Number
- Submit: `handleSave()` → validates locally → `update(...)` → `PUT /dental/branches/:branchId/settings`
- Loading state: `isPending` disables button, shows "Saving..."
- Success: `isSuccess` shows green banner
- Error: `saveError.message` shown in red banner
- No branch selected: guard shows validation error "No branch selected"
- **Assessment:** WORKING

#### Working Hours tab

- Form: 7 days, open/closed toggle, open time / close time selects
- On save: calls `PUT /dental/branches/:branchId/working-hours` (not the settings endpoint — it has its own endpoint)
- **Risk (F3):** Backend working-hours handler cannot be confirmed to exist or enforce owner-only access

#### Fee Schedule tab

- Fee entries as key-value map, saved to `feeSchedule` key inside `branch.settings` JSONB
- Uses same `PUT /dental/branches/:branchId/settings` endpoint
- **Assessment:** WORKING (piggybacks on settings endpoint)

#### Locale Settings tab

- Fields: locale, currency, tooth notation
- Saves to `locale`, `currency`, `toothNotation` keys in settings JSONB
- **Assessment:** WORKING

#### Notification Settings tab

- Toggles for 7 notification flags
- Saves to `notificationPreferences` key in settings JSONB
- **Assessment:** Saves successfully, but data is never consumed by any notification system (F8)

#### Add Staff modal

- Fields: displayName (required), role (card selection, dentist_owner disabled), PIN (6-digit, required), Confirm PIN (required)
- Validation: `validateStaffForm()` — checks empty name, empty role, PIN regex `/^\d{6}$/`, PIN match
- Submit: `POST /dental/org/members?branchId=` → then `POST /dental/org/members/:id/reset-pin`
- Success: modal closes, query invalidates, member appears in list
- Error: shown inline
- **Critical gap (F2):** Backend `createMember` handler only calls `assertBranchAccess`, not an owner-only check. Any active branch member can call this endpoint directly.

#### Staff Deactivate

- Button only shown when `canDeactivate(member.role, currentUserRole)` returns true (requires `currentUserRole === 'dentist_owner'` and member is not owner)
- On click: `window.confirm(...)` (F7) → calls `DELETE /dental/org/members/:memberId`
- **Critical gap (F1):** Backend handler calls only `assertBranchAccess`, not owner-only check

---

### Gate 5 — Forms, Modals, Tables

#### Org/Clinic Settings Form

| Field | Required | Validation | Backend enforced |
|-------|----------|------------|-----------------|
| Clinic Name | Yes | Non-empty | No (JSONB free-form) |
| Address | Yes | Non-empty | No |
| Phone | No | Regex `/[\d+\-() ]{7,}/` | No |
| Email | No | Basic email regex | No |
| Logo URL | No | None | No |
| License Number | No | None | No |

Frontend validation is client-side only; the backend accepts any JSONB values without schema enforcement.

#### Add Staff Modal

| Field | Required | Validation |
|-------|----------|------------|
| displayName | Yes | Non-empty |
| role | Yes | Must select from enum |
| PIN | Yes | `/^\d{6}$/` |
| Confirm PIN | Yes | Must match PIN |

`dentist_owner` role shown as disabled card with "(Already assigned)" note — should be hidden (F12).

#### Staff Table

- Columns: Name, Role badge, Status dot, Actions
- Deactivate button: visible only if `canDeactivate` returns true (owner viewing non-owner active member)
- No role change action — roles are immutable post-creation (intentional, but undocumented)
- No pagination — full list rendered; acceptable at current scale

#### Deactivation Confirmation

Uses `window.confirm()` (F7). Should be a modal dialog consistent with the design system and accessible to screen readers.

---

### Gate 6 — Backend/API Contract Alignment

#### Endpoint inventory (settings-related)

| Endpoint | Handler | Auth | Role check |
|----------|---------|------|-----------|
| `GET /dental/branches/:branchId/settings` | `getBranchSettings` | Required | `assertBranchAccess` (any member) |
| `PUT /dental/branches/:branchId/settings` | `updateBranchSettings` | Required | `assertBranchAccess` + `getMemberRole === dentist_owner` |
| `GET /dental/branches/:branchId/working-hours` | Unknown | Unknown | Unknown (F3) |
| `PUT /dental/branches/:branchId/working-hours` | Unknown | Unknown | Unknown (F3) |
| `GET /dental/branches/:branchId/consent-templates` | `listConsentTemplates` | Required | `assertBranchAccess` (any member) |
| `POST /dental/branches/:branchId/consent-templates` | `createConsentTemplate` | Required | `getMemberRole === dentist_owner` |
| `PATCH /dental/branches/:branchId/consent-templates/:id` | `updateConsentTemplate` | Required | `getMemberRole === dentist_owner` |
| `DELETE /dental/branches/:branchId/consent-templates/:id` | `deleteConsentTemplate` | Required | `getMemberRole === dentist_owner` |

#### Staff endpoint inventory

| Endpoint | Handler | Auth | Role check | Used by frontend |
|----------|---------|------|-----------|-----------------|
| `GET /dental/org/members?branchId=` | `listMembers` | Required | `assertBranchAccess` | Yes |
| `POST /dental/org/members?branchId=` | `createMember` | Required | `assertBranchAccess` only — **NO OWNER CHECK (F2)** | Yes |
| `DELETE /dental/org/members/:memberId` | `deactivateMember` | Required | `assertBranchAccess` only — **NO OWNER CHECK (F1)** | Yes |
| `POST /dental/org/members/:memberId/reset-pin` | `resetPin` | Required | Unknown | Yes (PIN setup) |
| `POST /dental/organizations/:orgId/branches/:branchId/members/` | `DentalMembershipManagement_create` | Required | `assertBranchAccess` (enforces tier limits) | No (onboarding only) |
| `POST /dental/organizations/:orgId/branches/:branchId/members/:membershipId/deactivate` | `DentalMembershipManagement_deactivate` | Required | Unknown | No |

**Critical contract divergence (F5, F6):**

The frontend staff module uses the legacy flat endpoints (`/dental/org/members`). The OpenAPI spec defines a different canonical path (`/dental/organizations/:orgId/branches/:branchId/members/`). Both paths exist in the backend, served by different handlers with different logic:

- The canonical path (`DentalMembershipManagement_create`) enforces **tier-based member limits** (solo: 2, clinic: 5, etc.)
- The legacy path (`createMember`) does **not** enforce tier limits

The frontend bypasses tier enforcement by using the legacy endpoint. This is a data integrity and business logic gap.

#### Onboarding endpoint usage (correct)

The onboarding wizard correctly uses the canonical endpoints:
- `POST /dental/organizations`
- `POST /dental/organizations/:orgId/branches`
- `POST /dental/organizations/:orgId/branches/:branchId/members/`
- `POST /dental/org/members/:memberId/reset-pin` (for PIN setup)

Verified by `dental-onboarding.spec.ts` which asserts the correct URLs are called.

---

### Gate 7 — Role-Based Journey Map

#### Journey 1: dentist_owner sets up clinic (onboarding)

1. New user signs up → Better-Auth creates user record
2. `_dashboard` layout `beforeLoad` detects no org → redirects to `/dental-onboarding`
3. Wizard step 1 (Clinic): POST `/dental/organizations`, POST `.../branches`
4. Wizard step 2 (Dentist): POST `.../members/` (creates dentist_owner member), POST `.../reset-pin`
5. Wizard step 3 (Fees): optional, writes to settings
6. Wizard step 4 (First Patient): optional, POST `/dental/patients`
7. On complete: navigates to `/dashboard`
8. Org context is loaded from `/dental/org/context` on every `_dashboard` mount

**Assessment:** WORKING end-to-end. E2E spec confirms correct API paths.

#### Journey 2: dentist_owner configures clinic settings

1. Navigate to `/settings` — `requireRole('settings')` passes
2. Edit clinic name, address → Save → `PUT /dental/branches/:branchId/settings`
3. Backend enforces owner-only via `getMemberRole` check
4. Success banner displayed

**Assessment:** WORKING. Both frontend and backend correctly enforce ownership.

#### Journey 3: dentist_owner adds staff member

1. Navigate to `/staff` — `requireRole('staff')` passes, owner check passes
2. Click "+ Add Staff" → modal opens
3. Fill displayName, select role, enter 6-digit PIN
4. Submit → `POST /dental/org/members?branchId=` → `POST .../reset-pin`
5. Modal closes, member appears in list

**Critical gap:** Step 4 uses legacy endpoint that bypasses tier limits. A `staff_full` member who somehow knows the endpoint URL can also create staff (F2).

#### Journey 4: non-owner staff tries to access settings

1. Navigate to `/settings` → `requireRole('settings')` checks `canAccess(role, 'settings')` → false for all non-owner roles → redirected to `/dashboard`
2. Navigate to `/staff` → same redirect
3. Backend: `PUT /dental/branches/:branchId/settings` returns 403 (double protection correct)

**Assessment:** WORKING for UI path. Backend-only path has gaps (F1, F2).

#### Journey 5: dentist_owner creates consent template

1. Backend endpoints exist and are properly owner-gated
2. **No frontend UI exists for this** (F11) — consent templates can only be managed via direct API calls or the onboarding wizard (if it surfaces this step; wizard does not include a consent template step)
3. Consent templates are consumed by `ConsentSheet` component in the clinical workspace (separate module)

**Assessment:** BACKEND COMPLETE, FRONTEND NOT WIRED.

---

### Gate 8 — Test Confidence Gap

#### `dental-settings-module11.test.ts`

**Coverage:**
- GET settings: empty state, 403 for unknown branch, 401
- PUT settings: FR8.1 (clinic config), FR8.2 (dentist profile), FR8.3 (fee schedule), FR8.7 (visit notes format), FR8.8 (locale)
- PUT settings: merge behavior (does not overwrite existing keys)
- FR8.13 access control: owner → 200, non-owner → 403, no membership → 403
- FR8.4b consent templates: create, list, update, delete, non-owner blocked, missing name → 400, 401

**Gaps:**
- Uses `buildTestApp()` pattern (F9) — does not test actual route registration; handler wiring to real Hono router is untested
- Working-hours endpoint not tested in this file
- No test for the legacy `POST /dental/org/members` endpoint owner-check gap (F1, F2)
- `FR8.4` treatment templates: documented as a stub test (`expect(true).toBe(true)`) deferring to `dental-visit-module3.test.ts`

#### `dental-org-module6.test.ts`

- Tests membership CRUD via backend handlers directly
- Does not test the owner-only restriction on `createMember` or `deactivateMember`

#### `add-staff.spec.ts` (E2E)

**Coverage:**
- dentist_owner can see staff page and "+ Add Staff" button (FR6.1)
- Modal opens with correct fields
- PIN validation (6 digits required)
- Creating a staff member adds to list
- FR8.13: `staff_full` role is redirected away from `/staff` at route level

**Gaps:**
- No E2E test for deactivation flow
- No E2E test for role change (intentionally absent — roles are immutable)
- No E2E test verifying backend 403 when a non-owner POSTs directly to create/deactivate endpoint

#### `dental-onboarding.spec.ts` (E2E)

**Coverage:**
- FR7.5/FR9.8: no org → redirect to `/dental-onboarding`
- FR7.1: 4 wizard steps
- FR7.1: First Patient step skippable
- FR7.4: localStorage persistence
- FR7.1: wizard calls correct API endpoints (not legacy paths)
- FR9.1: 6-digit PIN validated (not hardcoded)

**Gaps:**
- No test for unauthorized user accessing `/dental-onboarding` directly with a stale branchId in localStorage
- No test for org creation failure mid-wizard (partial state recovery)

#### `onboarding-wizard.test.ts` (unit)

- Tests pure logic functions only (validators, labels, step numbers)
- No component rendering or API call tests

#### Confidence scores by layer

| Layer | Score | Notes |
|-------|-------|-------|
| Backend settings handlers | 7/10 | Good coverage but `buildTestApp()` pattern, no working-hours test |
| Backend consent templates | 8/10 | CRUD + auth paths all tested |
| Backend staff create/deactivate | 3/10 | Owner-check gap not tested; critical security hole untested |
| Frontend settings components | 6/10 | Unit tests exist for helpers; no hook integration tests |
| Frontend staff components | 6/10 | Unit tests for pure helpers; no API integration tests |
| E2E settings | 2/10 | No E2E tests for settings page itself |
| E2E staff | 7/10 | Core flows covered; deactivation not tested |
| E2E onboarding | 8/10 | Good coverage; edge cases for auth/stale-store missing |

---

## Critical Issues Detail

### F1 — `deactivateMember` missing owner-only check

**File:** `services/api-ts/src/handlers/dental-org/deactivateMember.ts`  
**Path:** `DELETE /dental/org/members/:memberId`

The handler calls `assertBranchAccess(db, user.id, member.branchId)` which passes for **any** branch member. Any `dentist_associate`, `staff_full`, or `staff_scheduling` who knows a `memberId` can call this endpoint directly and deactivate another member, including the `dentist_owner`.

**Required fix:** Add an `assertBranchRole` check for `dentist_owner` before the deactivation, matching the pattern used in `updateBranchSettings`:

```
const role = await getMemberRole(db, user.id, member.branchId);
if (role !== 'dentist_owner') throw new ForbiddenError('Only the practice owner can deactivate members');
```

---

### F2 — `createMember` (legacy flat endpoint) missing owner-only check

**File:** `services/api-ts/src/handlers/dental-org/createMember.ts`  
**Path:** `POST /dental/org/members?branchId=`

Same pattern as F1. `assertBranchAccess` is the only gate. Any branch member can create a new membership record. Additionally, this endpoint bypasses the tier-limit enforcement that exists in the canonical `DentalMembershipManagement_create` handler.

**Required fix:** Add owner-only check. Consider deprecating this endpoint in favor of the canonical path which already enforces tier limits.

---

### F3 — Working-hours backend handler unconfirmed

**Frontend:** `apps/dentalemon/src/features/settings/components/working-hours.tsx` calls `PUT /dental/branches/:branchId/working-hours`  
**OpenAPI:** Path defined; generated route registered at `routes.ts`  
**Handler file:** Not found in `services/api-ts/src/handlers/dental-org/`

The working-hours handler may exist in a subdirectory or under a different name, or it may be unimplemented. If unimplemented, the frontend's Save Working Hours action fails silently or returns a 404/500. Role enforcement (owner-only vs any member) is also unconfirmed.

**Required action:** Confirm or create `workingHours.ts` handler; add owner-only role gate to `PUT`.

---

### F6 — Staff creation bypasses tier limits

**Frontend:** `use-staff-members.ts` → `POST /dental/org/members?branchId=`  
**Backend:** `createMember.ts` — no tier limit check  
**Canonical backend:** `DentalMembershipManagement_create.ts` — enforces `TIER_MEMBER_LIMITS` (solo: 2, clinic: 5, group: 20)

A `solo` tier clinic can accumulate more than 2 active members through the frontend because it uses the legacy endpoint. This violates the business rule documented in FR6.3.

**Required fix:** Migrate `use-staff-members.ts` to use `POST /dental/organizations/:orgId/branches/:branchId/members/`, which requires passing `orgId` from the org context store.

---

### F11 — Consent templates: backend complete, no frontend UI

**Backend:** Full CRUD at `/dental/branches/:branchId/consent-templates` — tested, owner-gated  
**Frontend settings route:** Only 5 tabs — Clinic, Working Hours, Fee Schedule, Locale, Notifications  
**Clinical workspace:** `consent-sheet.tsx` consumes templates, but cannot create/edit them

This is a complete feature gap. The consent template CRUD flows from FR8.4b are accessible only via direct API calls.

---

## Recommended Fix Priority

| Priority | Finding | Action |
|----------|---------|--------|
| P0 — Fix before next release | F1 | Add owner-only check to `deactivateMember` handler |
| P0 — Fix before next release | F2 | Add owner-only check to `createMember` legacy handler |
| P1 — Fix in current sprint | F3 | Locate or implement `workingHours.ts` handler with owner gate; add test |
| P1 — Fix in current sprint | F6 | Migrate staff creation to canonical endpoint to enforce tier limits |
| P1 — Fix in current sprint | F5 | Migrate staff deactivation to canonical `POST .../deactivate` endpoint |
| P1 — Next sprint | F11 | Add Consent Templates tab to Settings page with CRUD UI |
| P1 — Next sprint | F4 | Add `requireAuth` to `dental-onboarding` route `beforeLoad` |
| P2 — Backlog | F7 | Replace `window.confirm()` with modal dialog component |
| P2 — Backlog | F8 | Wire notification preferences to OneSignal or document as deferred |
| P2 — Backlog | F9 | Migrate `dental-settings-module11.test.ts` to real server test pattern |
| P2 — Backlog | F10 | Add backend tests for owner-only gate on staff create/deactivate |
| P3 — Nice to have | F12 | Hide (not disable) `dentist_owner` role card in staff creation modal |
| P3 — Nice to have | F13 | Add integration-level tests to onboarding wizard component |

---

## Overall Confidence Score

| Area | Score | Rationale |
|------|-------|-----------|
| Settings backend | 7/10 | Core CRUD tested; working-hours unconfirmed; `buildTestApp()` pattern |
| Settings frontend | 5/10 | Component helpers tested; no integration tests; notification sink unverified |
| Staff backend | 3/10 | Owner-only gate missing on both create and deactivate |
| Staff frontend | 7/10 | E2E covers happy path and role gate; deactivation not E2E tested |
| Onboarding | 8/10 | Best-covered area; correct API paths verified by E2E |
| Consent templates | 6/10 | Backend solid; no frontend UI |
| **Overall** | **6/10** | Two P0 security gaps prevent confident production deployment |
