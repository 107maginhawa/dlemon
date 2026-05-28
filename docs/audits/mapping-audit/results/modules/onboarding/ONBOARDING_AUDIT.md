# Onboarding Module Audit — Dental Clinic Onboarding Flow

**Date:** 2026-05-26
**Auditor:** Read-only automated audit
**Module Priority:** P1
**Prior global score:** ~70% (from master audit)

---

## Scope

Two distinct onboarding flows exist in this app:

| Flow | Route | Purpose |
|------|-------|---------|
| **Person Onboarding** | `/onboarding` | New user creates their Person profile (name, address) |
| **Dental Clinic Onboarding** | `/_dashboard/dental-onboarding` | Authenticated user with a Person profile creates org + branch + membership |

This audit covers **both flows**, with primary focus on the Dental Clinic Onboarding Wizard as the higher-risk surface (creates org/branch/membership records, sets PIN, stores context).

**Files audited:**
- `apps/dentalemon/src/routes/onboarding.tsx`
- `apps/dentalemon/src/routes/_dashboard/dental-onboarding.tsx`
- `apps/dentalemon/src/features/onboarding/components/onboarding-wizard.tsx`
- `apps/dentalemon/src/features/onboarding/components/onboarding-wizard.test.ts`
- `apps/dentalemon/tests/e2e/dental-onboarding.spec.ts`
- `apps/dentalemon/tests/e2e/onboarding.spec.ts`
- `apps/dentalemon/tests/e2e/first-launch.spec.ts`
- `services/api-ts/src/handlers/dental-org/DentalOrganizationManagement_create.ts`
- `services/api-ts/src/handlers/dental-org/DentalBranchManagement_create.ts`
- `services/api-ts/src/handlers/dental-org/DentalMembershipManagement_create.ts`
- `services/api-ts/src/handlers/dental-org/DentalMembershipManagement_setPin.ts`
- `services/api-ts/src/handlers/dental-org/createOrganization.ts`
- `services/api-ts/src/handlers/dental-org/createMember.ts`
- `services/api-ts/src/handlers/dental-org/dental-org-module6.test.ts`
- Test result artifacts: `test-results-fresh/first-launch-*` and `test-results-fresh/onboarding-*`

---

## Findings Summary

| # | Severity | Gate | Finding | File |
|---|----------|------|---------|------|
| ONBOARD-F1 | P1 | G6 | `DentalBranchManagement_create` does not verify that `orgId` belongs to the authenticated user — any authenticated user can create a branch under any org | `handlers/dental-org/DentalBranchManagement_create.ts` |
| ONBOARD-F2 | P1 | G6 | Tier is hardcoded to `'solo'` in the wizard — multi-tier onboarding is impossible without a code change; no upgrade path | `features/onboarding/components/onboarding-wizard.tsx:149` |
| ONBOARD-F3 | P1 | G6 | Patient creation in `handleFinish` sends `POST /dental/patients` without `branchId` — backend may reject or associate patient to wrong branch | `features/onboarding/components/onboarding-wizard.tsx:215-226` |
| ONBOARD-F4 | P1 | G6 | `set-pin` endpoint called with `org.id/branch.id/member.id` path but `DentalMembershipManagement_setPin` has no ownership check — any authenticated user can set any member's PIN | `handlers/dental-org/DentalMembershipManagement_setPin.ts` |
| ONBOARD-F5 | P1 | G3 | `/_dashboard/dental-onboarding` has no `beforeLoad` guard of its own — a user who already has a branchId in localStorage (stale after re-seed or org deletion) bypasses the wizard redirect and can access it with stale context that will create a second org | `routes/_dashboard/dental-onboarding.tsx` |
| ONBOARD-F6 | P1 | G8 | Both known E2E failures in `test-results-fresh/`: `first-launch` (create dentist + first patient) and `onboarding` (back navigation) are recorded as FAILED — no green baseline exists for the most critical new-user journey | `test-results-fresh/` artifacts |
| ONBOARD-F7 | P1 | G6 | `DentalOrganizationManagement_create` has no duplicate org check — a user can create multiple organizations (e.g. retry after partial failure), producing orphan orgs with no owned branch | `handlers/dental-org/DentalOrganizationManagement_create.ts` |
| ONBOARD-F8 | P2 | G6 | Wizard uses raw `fetch()` for all 5 API calls (org, branch, member, set-pin, patient) instead of the SDK — no type safety, no interceptor coverage, inconsistent with all other modules | `features/onboarding/components/onboarding-wizard.tsx` |
| ONBOARD-F9 | P2 | G5 | Branch timezone is hardcoded to `'Asia/Manila'` — no UI field, no detection. International users always get a wrong timezone on their first branch | `features/onboarding/components/onboarding-wizard.tsx:165` |
| ONBOARD-F10 | P2 | G4 | `patientPhone` field is collected in the UI (state + input) but never sent to the API in `handleFinish` — silent data loss | `features/onboarding/components/onboarding-wizard.tsx:88,220-225` |
| ONBOARD-F11 | P2 | G8 | `onboarding-wizard.test.ts` tests only pure validation helper functions extracted inline — does NOT test the actual `OnboardingWizard` React component or any of its async flows | `features/onboarding/components/onboarding-wizard.test.ts` |
| ONBOARD-F12 | P2 | G5 | Fee schedule collected during onboarding is never sent to the API — all fee data is silently dropped at `handleFinish`. No endpoint is called to persist fees | `features/onboarding/components/onboarding-wizard.tsx:140-237` |
| ONBOARD-F13 | P2 | G3 | Country selector in wizard offers only 3 countries (PH, AU, US) but `countryCode` is sent to the org backend which accepts any ISO code — no validation alignment | `features/onboarding/components/onboarding-wizard.tsx:298-302` |
| ONBOARD-F14 | P2 | G7 | `onComplete()` navigates to `/dashboard` without clearing Zustand org context first — if wizard is re-run after a partial failure the store may contain a stale `memberId` from the previous attempt alongside a new `branchId` | `features/onboarding/components/onboarding-wizard.tsx:207-231` |
| ONBOARD-F15 | P3 | G8 | `first-launch.spec.ts` creates the patient with `branchId` included (correct) but the wizard does NOT send `branchId` when creating the same patient — E2E and wizard behavior diverge | `tests/e2e/first-launch.spec.ts` vs `onboarding-wizard.tsx:215` |
| ONBOARD-F16 | P3 | G2 | Person Onboarding (`/onboarding`) branding shows "Welcome to Monobase" — not "Dentalemon" or the clinic product name. Template text leaked to production UI | `routes/onboarding.tsx:225` |

---

## Gate-by-Gate Analysis

### Gate 2 — Role and Permission Map

**Person Onboarding (`/onboarding`)**

Guards: `composeGuards(requireAuth, requireEmailVerified, requireNoPerson)` — correct layering. Requires authenticated, email-verified, no-existing-Person user. No role-based restriction needed (first-time only).

**Dental Clinic Onboarding (`/_dashboard/dental-onboarding`)**

The route lives under `_dashboard` layout which enforces `requireAuth` in `beforeLoad`. The dashboard layout additionally checks for a branchId and redirects to `/dental-onboarding` if absent. There is no further role restriction on the dental onboarding route itself — any authenticated user with a Person profile and no existing org can reach it.

**Backend handler roles:**

| Endpoint | Auth Check | Role Check | Ownership Check |
|----------|-----------|------------|----------------|
| `POST /dental/organizations` | `user.id` required | None (any authenticated) | None — no per-user org limit |
| `POST /dental/organizations/:orgId/branches` | `user.id` required | None | **NONE — F1** |
| `POST /dental/organizations/:orgId/branches/:branchId/members` | `assertBranchAccess` (via middleware) | Tier limit enforced | Partial |
| `POST .../members/:memberId/set-pin` | `user.id` required (assumed) | **None — F4** | **NONE — F4** |

Finding **ONBOARD-F1**: `DentalBranchManagement_create` only checks `user.id` is present but does not verify `orgId` belongs to the requesting user. Any authenticated user knowing an `orgId` can append branches to another user's organization. Impact: data integrity / unauthorized resource creation.

Finding **ONBOARD-F4** (from prior Settings audit, confirmed here): `set-pin` on the canonical nested path also lacks ownership checks. Surfaced in the onboarding flow because the wizard calls it immediately after member creation — if the `member.id` returned is tampered or replayed, PIN assignment is unauthenticated from an ownership standpoint.

**Verdict:** PARTIAL — person onboarding guards are correct; dental onboarding backend is missing org-ownership enforcement on branch creation and PIN assignment.

---

### Gate 3 — Route and Navigation

**Person Onboarding routes:**
```
/onboarding → guards: requireAuth + requireEmailVerified + requireNoPerson
  Step 1: Personal Information (PersonalInfoForm, formId="step-1-form")
  Step 2: Address (Optional) (AddressForm, skip allowed)
  On complete → navigate to /dashboard
  /dashboard beforeLoad → no branchId → redirect to /dental-onboarding
```

**Dental Onboarding routes:**
```
/_dashboard/dental-onboarding → no beforeLoad on route itself
  Renders <OnboardingWizard onComplete={() => navigate('/dashboard')} />
  4 steps: clinic → dentist → fees → patient
  On complete → navigate to /dashboard
```

**Guard gaps:**

Finding **ONBOARD-F5**: `/_dashboard/dental-onboarding.tsx` has no `beforeLoad`. The parent `_dashboard` layout redirects to `/dental-onboarding` only when no `branchId` is found. However, if a user has a stale `branchId` in their Zustand store (e.g., from a previous seed run, or after org deletion), the layout's check passes, the user lands on `/dashboard`, but the dental data context is invalid. Additionally, a user who navigates directly to `/_dashboard/dental-onboarding` after already completing onboarding can trigger a **second org creation** — there is no guard or backend constraint preventing this (see ONBOARD-F7).

**Back navigation:** `handleBack` in the wizard is pure state (`setStep(prev)`) — works correctly for steps 1-3. On step 4 (patient), back goes to fees (step 3). No issues in logic, but the E2E test for back navigation is recorded as FAILED (ONBOARD-F6).

**Verdict:** PARTIAL — navigation logic is structurally sound but missing a guard against duplicate onboarding and stale-context re-entry.

---

### Gate 4 — Frontend Interaction Integrity

**OnboardingWizard component (`onboarding-wizard.tsx`)**

- Step progression managed by `stepIndex` over a fixed `STEPS` array — deterministic, no async risk in navigation
- Validation is synchronous and runs on every "Next" click before advancing
- `saving` boolean disables the Next/Skip/Get Started buttons during the `handleFinish` async sequence — prevents double-submit
- `localStorage` saves all fields except PIN on every state change (useEffect) — correct security behavior for PIN
- `localStorage.removeItem(STORAGE_KEY)` called on successful completion — good cleanup

**Finding ONBOARD-F10**: `patientPhone` state is managed (`const [patientPhone, setPatientPhone] = useState('')`) and rendered in the UI as an input field. However, the `handleFinish` body for patient creation is:
```js
body: JSON.stringify({
  displayName: patientName.trim(),
  dateOfBirth: birthDate,
  gender,
})
```
`patientPhone` is collected but never included in the POST body. Silent data loss.

**Finding ONBOARD-F12**: The fees step collects 6 CDT procedure prices. After the wizard completes, `handleFinish` creates org, branch, member, pin, and optionally a patient — but never calls any fee schedule endpoint. The entire fee step is a no-op from a data perspective. No fee creation API call exists in `handleFinish`.

**Finding ONBOARD-F14**: After `handleFinish` resolves (line 207-211), `useOrgContextStore.getState().setContext()` is called with `{ orgId, branchId, memberId }`. If the wizard was previously partially run (failed mid-way), the store may have been partially populated. The new call overwrites `orgId`/`branchId`/`memberId` correctly in the success case, but if `handleFinish` throws after the member is created but before `setContext`, the store holds a stale partial state from the prior successful attempt.

**Person Onboarding (`/onboarding`)**: The "Next" button for step 1 uses `document.querySelectorAll('form')[0].requestSubmit()` — a DOM query rather than a React ref. If the DOM has more than one `<form>` (e.g. header search), the wrong form could be submitted. Low risk given the layout, but fragile.

**Verdict:** PARTIAL — core flow solid but two silent data-loss bugs (phone, fees) and one partial state risk.

---

### Gate 5 — Forms, Modals, and Table Actions

**Wizard form structure:**

The wizard does not use `<form>` elements. All steps are plain `<div>` containers with `<input>` and `<select>` elements. Validation is handled manually in `validate()`, not via HTML5 constraint validation or a form library (TanStack Form). This is inconsistent with the rest of the codebase which uses TanStack Form.

**Validation coverage by step:**

| Step | Required validation | Optional fields | Notes |
|------|---------------------|-----------------|-------|
| clinic | `clinicName`, `countryCode` | address, phone | PIN not on this step |
| dentist | `dentistName`, `pin` (6 digits) | licenseNumber, specialization | Regex: `/^\d{6}$/` |
| fees | None (fee step is fully optional) | All CDT prices | No validation |
| patient | `patientName`, `birthDate` | gender, phone | Only validated if not skipped |

**Finding ONBOARD-F9**: Branch timezone is hardcoded at line 165:
```js
body: JSON.stringify({
  name: 'Main Branch',
  timezone: 'Asia/Manila',
  ...
})
```
No timezone field exists in the wizard UI. No browser timezone detection is used (unlike the `/onboarding` Person flow which calls `detectTimezone()`). A clinic in Australia or the US will have a permanently wrong branch timezone unless they fix it manually in Settings.

**Finding ONBOARD-F13**: The country `<select>` offers exactly 3 options: `PH`, `AU`, `US`. The backend `countryCode` field accepts any ISO 3166-1 alpha-2 code. There is no alignment between the 3-country UI restriction and the backend's unrestricted acceptance. A Philippine clinic setting `countryCode: 'PH'` is fine today, but the restriction will block legitimate international expansion without a code change.

**Person Onboarding form**: Uses `PersonalInfoForm` and `AddressForm` components which are proper TanStack Form components — consistent with the rest of the codebase.

**Verdict:** PARTIAL — dental wizard bypasses form library; two silent field gaps (timezone, fee persistence); country selector artificially restricted.

---

### Gate 6 — Backend/API Contract Alignment

**Endpoint inventory for dental onboarding wizard:**

| Step | Endpoint called | Handler | Auth | Ownership check |
|------|----------------|---------|------|----------------|
| Finish | `POST /dental/organizations` | `DentalOrganizationManagement_create` | `user.id` | None — **F7** |
| Finish | `POST /dental/organizations/{orgId}/branches` | `DentalBranchManagement_create` | `user.id` | **None — F1** |
| Finish | `POST /dental/organizations/{orgId}/branches/{branchId}/members` | `DentalMembershipManagement_create` | `assertBranchAccess` | Tier limit only |
| Finish | `POST .../members/{memberId}/set-pin` | `DentalMembershipManagement_setPin` | `user.id` | **None — F4** |
| Finish | `POST /dental/patients` | dental patients handler | N/A | No `branchId` sent — **F3** |

**Finding ONBOARD-F1 (detail):** `DentalBranchManagement_create`:
```ts
const user = ctx.get('user') as User | undefined;
if (!user?.id) throw new UnauthorizedError('Authentication required');
// No check: does orgId belong to user?
const { orgId } = ctx.req.valid('param');
const repo = new BranchRepository(db, logger);
const branch = await repo.createOne({ organizationId: orgId, ... });
```
No `OrganizationRepository.findByOwner(orgId, userId)` call. Any authenticated user can `POST /dental/organizations/FOREIGN_ORG_ID/branches/`.

**Finding ONBOARD-F2 (detail):** Tier is hardcoded:
```js
body: JSON.stringify({ name: clinicName.trim(), tier: 'solo', countryCode })
```
The `DentalOrganizationManagement_create` handler accepts `body.tier` from the request. The hardcoding is a frontend-only constraint — but it means the onboarding path can only ever create `solo` tier orgs. Upgrading to `clinic` tier requires direct API call or Settings UI (which doesn't exist for tier upgrades).

**Finding ONBOARD-F3 (detail):** Patient creation body:
```js
body: JSON.stringify({
  displayName: patientName.trim(),
  dateOfBirth: birthDate,
  gender,
})
```
No `branchId` field. The `first-launch.spec.ts` E2E test explicitly includes `branchId` when creating a patient via the API in the same scenario:
```js
body: JSON.stringify({
  displayName: 'Maria Reyes',
  dateOfBirth: '1985-03-15',
  gender: 'female',
  branchId,          // ← present in E2E test, absent in wizard
  consentGiven: true,
})
```
This is a direct discrepancy between the E2E test's expectation and the wizard's actual behavior. Patient creation without `branchId` may succeed (if the backend infers it from session context) or produce an unassociated patient record.

**Finding ONBOARD-F7 (detail):** `DentalOrganizationManagement_create`:
```ts
const org = await repo.createOne({
  name: body.name,
  tier: body.tier as OrgTier,
  countryCode: body.countryCode,
  ownerPersonId: user.id,
  active: true,
});
```
No uniqueness check on `ownerPersonId` — a user can create multiple organizations. If onboarding fails after org creation but before branch/member creation (e.g., network error), retrying the wizard will create a second orphan org. The wizard's error handling on `handleFinish` does not clean up partial state — it catches the error, shows it to the user, and leaves the orphan org in the database.

**Finding ONBOARD-F8 (detail):** All 5 API calls use raw `fetch()`:
```js
const orgRes = await fetch(`${API}/dental/organizations`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ ... }),
});
```
No SDK usage, no type checking against the OpenAPI spec, no interceptor coverage. Every other module in the app uses `@monobase/sdk-ts` generated hooks. This is the only production path where raw fetch is used for multi-step entity creation.

**Verdict:** FAILING — 5 contract-level findings: missing ownership check on branch creation, hardcoded tier, missing branchId on patient, no duplicate org prevention, and raw fetch bypassing SDK.

---

### Gate 7 — Role-Based Journey Map

**Journey: New Dentist → First Login → Org Setup → Dashboard**

```
1. User signs up (email + password) → /auth/sign-up
2. Email verification → /verify-email (requireEmailVerified guard)
3. Person profile creation → /onboarding (requireNoPerson guard)
   Step 1: Personal info (name, DOB, gender)
   Step 2: Address (optional, skippable)
   → POST /person (SDK mutation)
   → navigate to /dashboard
4. Dashboard beforeLoad → no branchId → redirect to /dental-onboarding
5. Dental clinic wizard (/_dashboard/dental-onboarding)
   Step 1: Clinic Setup (name, country, address, phone)
   Step 2: Dentist Profile (name, license, PIN)
   Step 3: Fee Schedule (6 default CDT codes, optional)
   Step 4: First Patient (optional, skippable)
   → POST /dental/organizations
   → POST /dental/organizations/{orgId}/branches
   → POST .../branches/{branchId}/members (role: dentist_owner)
   → POST .../members/{memberId}/set-pin
   → POST /dental/patients (if not skipped, but branchId missing — F3)
   → setContext(orgId, branchId, memberId) in Zustand
   → navigate to /dashboard
6. Dashboard loads with branchId in store → full app available
```

**Journey gaps:**

- **No rollback on partial failure (J-GAP-1):** If step 5c (member creation) fails after org + branch are already created, the wizard shows an error but the orphan org+branch remain. The user cannot retry cleanly without hitting the "org already exists" issue if the backend ever adds a uniqueness constraint, or will create a second orphan org if no such constraint is added.

- **No post-onboarding PIN-select redirect (J-GAP-2):** After onboarding completes, the user lands on `/dashboard` directly. The PIN flow (`/auth/pin-select`) is separate and not automatically triggered. A new owner created via onboarding has a PIN set but the auth guard flow that enforces PIN-login on return visits needs to be triggered manually. The AUTH audit found that PIN redirect from dashboard guard is not automatic.

- **Fee schedule never persisted (J-GAP-3 = ONBOARD-F12):** Step 3 of the wizard collects fee data but it is thrown away. The fee schedule in Settings only becomes available post-onboarding via a separate Settings > Fee Schedule tab.

**Verdict:** PARTIAL — core journey exists and is functional under happy path; partial-failure recovery, fee persistence, and PIN-redirect sequencing are gaps.

---

### Gate 8 — Test Confidence Gap

**Unit tests — `onboarding-wizard.test.ts`:**

The test file imports no React component. It tests only standalone validation functions that were extracted inline in the test file itself:
```ts
function validateClinicStep(data: ClinicData): string[]
function validateDentistStep(data: DentistData): string[]
function validateFeeScheduleStep(_data: FeeEntry[]): string[]
function validatePatientStep(data: PatientData): string[]
```
These are NOT the actual `validate()` function from `onboarding-wizard.tsx`. They are re-implementations in the test file. The real component's `validate()` closure (which reads React state) is never tested.

This means: **zero unit test coverage of the actual `OnboardingWizard` component**, its `handleFinish` async flow, its `localStorage` persistence, or its error handling.

**E2E tests — `dental-onboarding.spec.ts`:**

Coverage documented in spec comments:
- FR7.5/FR9.8: No org → redirect to `/dental-onboarding`
- FR7.1: 4 wizard steps flow
- FR7.1: First Patient step skippable
- FR7.4: localStorage persistence
- FR7.1: Wizard calls correct API endpoints (not legacy paths)
- FR9.1: 6-digit PIN validated

**Finding ONBOARD-F6:** Two E2E test runs are recorded as FAILED in `test-results-fresh/`:
1. `first-launch-First-Launch--3809a-c-dentist-and-first-patient-chromium` — FAILED
2. `onboarding-Onboarding-Flow-09739-vigating-back-between-steps-chromium` — FAILED (back navigation)

Both failures have recorded artifacts (screenshots, video, trace, error-context.md). The back-navigation failure is particularly notable: it means the `handleBack` function either doesn't work in the E2E environment, or the test assertion about what the back button does was wrong at the time the test was run.

**E2E tests — `onboarding.spec.ts`:** Tests the Person Onboarding flow (`/onboarding`) — 2-step person profile. Separate from the dental wizard.

**E2E tests — `first-launch.spec.ts`:** Tests the first-launch happy path end-to-end. FAILED (recorded artifact).

**Backend tests — `dental-org-module6.test.ts`:**
- Tests membership CRUD
- Does NOT test the canonical onboarding create-org → create-branch → create-member → set-pin sequence as an atomic flow
- Does NOT test org ownership enforcement on branch creation

**Coverage gaps summary:**

| Scenario | Unit | E2E |
|----------|------|-----|
| Wizard renders correct steps | None | Partial |
| Clinic step validation | Re-impl only | Yes |
| Dentist step + PIN validation | Re-impl only | Yes |
| Fee step (no-op) | None | Not tested |
| Patient step skip | None | Yes |
| handleFinish API call sequence | None | Yes (but FAILED) |
| Partial failure / orphan cleanup | None | None |
| Back navigation | None | FAILED |
| localStorage persistence + resume | None | Yes |
| Duplicate org prevention | None | None |
| Branch ownership check | None | None |
| Fee schedule not persisted | None | None |
| Patient branchId missing | None | None |
| Timezone hardcoded | None | None |

**Verdict:** FAILING — unit tests are shadow re-implementations; two E2E tests FAILED; no coverage of partial-failure paths, orphan prevention, or the multiple data-loss bugs.

---

## Critical Issues Detail

### ONBOARD-F1 — Branch creation has no org ownership check (P1)

**File:** `services/api-ts/src/handlers/dental-org/DentalBranchManagement_create.ts`
**Path:** `POST /dental/organizations/{orgId}/branches/`

The handler verifies the user is authenticated (`user.id` present) but performs no check that `orgId` belongs to that user. The `OrganizationRepository` has an `ownerPersonId` field that could be used for this check. Impact: any authenticated user knowing an org UUID can create branches under another clinic's organization.

**Required fix:** Add `const org = await orgRepo.findById(orgId); if (org.ownerPersonId !== user.id) throw new ForbiddenError(...)` before the branch creation.

---

### ONBOARD-F3 — Patient creation missing branchId (P1)

**File:** `apps/dentalemon/src/features/onboarding/components/onboarding-wizard.tsx:215-226`

The wizard's first patient creation call omits `branchId` from the request body. The `first-launch.spec.ts` E2E test for the same scenario explicitly includes `branchId`. The dental patient model requires branch association. Depending on backend behavior, this either silently creates an unassociated patient (data integrity issue) or returns a non-201 status that the wizard silently ignores (line 226: "Patient creation failure is non-fatal").

**Required fix:** Include `branchId: branch.id` in the patient POST body. This value is available in `handleFinish` scope at line 173.

---

### ONBOARD-F6 — Two E2E tests failing in test-results-fresh (P1)

**Files:**
- `apps/dentalemon/test-results-fresh/first-launch-First-Launch--3809a-c-dentist-and-first-patient-chromium/`
- `apps/dentalemon/test-results-fresh/onboarding-Onboarding-Flow-09739-vigating-back-between-steps-chromium/`

The back-navigation failure (second artifact) represents a regression in the most fundamental wizard interaction. The first-launch failure means the new-user critical path (signup → onboarding → first patient) has no passing E2E baseline. These failures must be triaged and fixed before any onboarding changes ship.

---

### ONBOARD-F7 — No duplicate org prevention (P1)

**File:** `services/api-ts/src/handlers/dental-org/DentalOrganizationManagement_create.ts`

A user who retries onboarding after a partial failure will create a second organization. The `OrganizationRepository.createOne` has no uniqueness constraint on `ownerPersonId`. With an active user base this will produce orphaned orgs that are invisible in the UI and waste database rows, but more critically they expose the org UUID in the creation response that could be used for subsequent ONBOARD-F1 exploitation.

**Required fix:** Either add a DB unique constraint on `owner_person_id` in `dental_organization` and return a 409 on retry, or add a pre-check `repo.findByOwner(user.id)` and redirect to the existing org if one exists.

---

### ONBOARD-F12 — Fee schedule step is a UI no-op (P2)

**File:** `apps/dentalemon/src/features/onboarding/components/onboarding-wizard.tsx:140-237`

The fee step allows the dentist to set prices for 6 CDT codes during onboarding. The data is stored in React state and persisted to localStorage. However, `handleFinish` never calls any fee schedule endpoint. There is no `POST /dental/fee-schedule` or similar call. All entered prices are cleared when `localStorage.removeItem(STORAGE_KEY)` runs at line 229. Users who fill in prices during onboarding will find them gone when they reach the app.

This is a UX deception — the step appears functional but produces no output.

---

## Recommended Fix Priority

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| Fix immediately | ONBOARD-F1 — branch ownership check | Low (1 repo call) | Security / data integrity |
| Fix immediately | ONBOARD-F6 — failing E2E tests | Medium (triage + fix) | CI confidence / release gate |
| Fix before MVP | ONBOARD-F3 — patient missing branchId | Trivial (add field) | Data integrity |
| Fix before MVP | ONBOARD-F7 — duplicate org on retry | Low (pre-check or DB constraint) | Data integrity |
| Fix before MVP | ONBOARD-F4 — set-pin no ownership check | Low (member ownership check) | Security |
| Fix before MVP | ONBOARD-F12 — fee step is no-op | Medium (add fee endpoint call or remove step) | UX trust |
| Fix before MVP | ONBOARD-F11 — unit tests shadow re-implementations | Medium (rewrite to test actual component) | Test confidence |
| Post-MVP | ONBOARD-F2 — hardcoded solo tier | Medium (add tier selector) | Business logic |
| Post-MVP | ONBOARD-F9 — hardcoded Asia/Manila timezone | Low (use detectTimezone()) | UX |
| Post-MVP | ONBOARD-F10 — patientPhone not sent | Trivial | Data completeness |
| Post-MVP | ONBOARD-F8 — raw fetch instead of SDK | Medium (migrate to SDK) | Maintainability |
| Post-MVP | ONBOARD-F5 — no guard on already-onboarded re-entry | Low (add beforeLoad check) | Edge case protection |
| Post-MVP | ONBOARD-F14 — stale Zustand context on partial failure | Low (clear store on entry) | Edge case |
| Post-MVP | ONBOARD-F13 — 3-country selector | Low | UX |
| Cleanup | ONBOARD-F15 — E2E vs wizard patient body divergence | Trivial (after F3 fix) | Test alignment |
| Cleanup | ONBOARD-F16 — "Monobase" branding in Person Onboarding | Trivial | Branding |

---

## Overall Confidence Score: 3/10

**Rationale:**

The onboarding module has a structurally complete wizard UI and the happy-path flow is logically sequenced. However:

- **Two known E2E test failures** — the critical-path new-user journey has no passing automated baseline
- **Security gap** on branch creation (any user can attach branches to any org)
- **Silent data loss** on two collected fields (patient phone, fee schedule)
- **Missing branchId** on patient creation — discrepancy confirmed by E2E test expectation vs. actual code
- **No duplicate org protection** — retry produces orphan orgs
- **Unit tests test nothing real** — they re-implement validation logic separately from the component

The 3/10 reflects that the wizard is present and loads, basic validation exists, localStorage persistence works, and the API endpoints being called are the correct canonical paths (not the legacy flat routes). But confidence in correctness of the data written during onboarding is low, and the test suite provides no assurance.
