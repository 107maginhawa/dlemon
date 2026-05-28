# Patient Management Module Audit

**Module:** Patient Management
**Audit Date:** 2026-05-26
**Auditor:** Senior Code Reviewer (Claude Sonnet 4.6)
**Status:** Complete

---

## Scope

Files reviewed:

- `apps/dentalemon/src/routes/_dashboard/patients.tsx`
- `apps/dentalemon/src/routes/_dashboard/patients_/$patientId.tsx`
- `apps/dentalemon/src/features/patients/components/patient-folder-card.tsx`
- `apps/dentalemon/src/features/patients/components/patient-filter-tabs.tsx`
- `apps/dentalemon/src/features/patients/components/patient-list.tsx`
- `apps/dentalemon/src/features/patients/components/patient-profile-page.tsx`
- `apps/dentalemon/src/features/patients/components/patient-registration-modal.tsx`
- `apps/dentalemon/src/features/patients/hooks/use-patients.ts`
- `apps/dentalemon/src/features/patients/hooks/use-patient-actions.ts`
- `apps/dentalemon/src/features/patients/hooks/use-patient-profile.ts`
- `apps/dentalemon/src/features/patients/hooks/use-patient-billing.ts`
- `apps/dentalemon/src/features/patients/hooks/use-follow-up-notes.ts`
- `services/api-ts/src/handlers/dental-patient/createDentalPatient.ts`
- `services/api-ts/src/handlers/dental-patient/listDentalPatients.ts`
- `services/api-ts/src/handlers/dental-patient/getDentalPatient.ts`
- `services/api-ts/src/handlers/dental-patient/archiveDentalPatient.ts`
- `services/api-ts/src/handlers/dental-patient/updateDentalPatient.ts`
- `services/api-ts/src/handlers/dental-patient/exportDentalPatients.ts`
- `services/api-ts/src/handlers/dental-patient/listPatientVisits.ts`
- `services/api-ts/src/handlers/shared/assert-branch-access.ts`
- `services/api-ts/src/handlers/shared/assert-branch-role.ts`
- `services/api-ts/src/handlers/dental-patient/dental-patient.test.ts`
- `services/api-ts/src/handlers/dental-patient/dental-patient-module10.test.ts`
- `specs/api/tests/contract/dental-patient.hurl`
- `apps/dentalemon/tests/e2e/patient-registration.spec.ts`
- `apps/dentalemon/tests/e2e/patient-profile.spec.ts`
- `apps/dentalemon/tests/e2e/patient-checkin.spec.ts`
- `apps/dentalemon/tests/e2e/returning-patient-visit.spec.ts`

**Known pre-existing cross-reference issues (not re-reported):**
- CF-01: `patient-folder-card.tsx` card click navigates to `/$patientId` (resolved — this IS the workspace route `/_workspace/$patientId`; card click is correct)
- CF-02: `patient-profile-page.tsx` profile button in workspace navigates to `/patients/$patientId` cast as `any`

---

## Findings Summary

| ID | Severity | Gate | Title | File(s) |
|----|----------|------|-------|---------|
| PATIENT-F1 | P1 | G3 | `patients.tsx` `onSelect` navigates to `/$patientId` — TanStack route resolves to `/_workspace/$patientId` but the route literal `/$patientId` is wrong (not `/_workspace/$patientId`) and bypasses the layout guard | `patients.tsx` |
| PATIENT-F2 | P1 | G5 | `handleRegister` in `patients.tsx` uses raw `fetch()` to POST `/dental/patients` instead of the SDK mutation — no SDK error handling, cache invalidation is manual, inconsistent with all other mutations | `patients.tsx` |
| PATIENT-F3 | P1 | G7 | `PatientProfilePage` has no "Open Workspace" link — the profile is a dead end; the only exit is "← Patients" back-link. AC-PROF-02 E2E test soft-passes by falling back to direct URL navigation | `patient-profile-page.tsx`, `patient-profile.spec.ts` |
| PATIENT-F4 | P1 | G2 | `createDentalPatient` allows `branchId` to be omitted — patient is created with `preferredBranchId = NULL`. All subsequent branch-guarded operations (`archive`, `getDentalPatient`) silently skip `assertBranchAccess` when `preferredBranchId` is null, meaning a patient with no branch has no access control | `createDentalPatient.ts`, `archiveDentalPatient.ts`, `getDentalPatient.ts` |
| PATIENT-F5 | P1 | G2 | `updateDentalPatient` uses `assertBranchRole` with `['dentist_owner', 'dentist_associate', 'hygienist', 'staff_full']` but `listDentalPatients` uses `assertBranchAccess` (any role including `staff_readonly`). Role asymmetry between read and write is undocumented; `staff_readonly` can read but the update gate list is not surfaced anywhere in the frontend | `updateDentalPatient.ts`, `listDentalPatients.ts` |
| PATIENT-F6 | P2 | G8 | Backend test `dental-patient.test.ts` only seeds `staff_full` role — no test exercises `staff_readonly` being rejected on write, `dentist_associate` being accepted, or `dentist_owner`-only paths. RBAC test coverage is single-role | `dental-patient.test.ts` |
| PATIENT-F7 | P2 | G3 | `listPatientVisits` branch guard is optional — if no `branchId` query param is supplied, `assertBranchAccess` is skipped entirely. Any authenticated user can enumerate visits for any patient if they know the `patientId` | `listPatientVisits.ts` |
| PATIENT-F8 | P2 | G8 | E2E `patient-profile.spec.ts` AC-PROF-02 test has a soft-fallback: if no workspace link/button is found, it navigates directly to `/${patientId}` and passes. This masks that `PatientProfilePage` lacks the workspace link (PATIENT-F3) | `patient-profile.spec.ts` |
| PATIENT-F9 | P2 | G5 | Patient registration modal uses `window.confirm()` for nothing — archive/restore use `window.confirm()` in `patient-list.tsx`, which is correct, but the registration error path uses `alert(message)` for API errors, which is a blocking browser dialog with no dismissible UI feedback | `patients.tsx` |
| PATIENT-F10 | P3 | G6 | `exportDentalPatients` hook (`use-patient-actions.ts`) calls the SDK's `exportDentalPatients` function but the SDK returns `data.patients` — if the backend returns a different shape (it returns `{ patients: [...] }` in JSON format, or raw CSV), the `data?.patients ?? []` fallback silently produces empty CSV | `use-patient-actions.ts`, `exportDentalPatients.ts` |
| PATIENT-F11 | P3 | G8 | Contract tests (`dental-patient.hurl`) cover all CRUD + import/export + bulk-archive but test only as `dentist_owner` role. No contract test exercises a non-member or `staff_readonly` user being rejected | `dental-patient.hurl` |

---

## Gate-by-Gate Analysis

### Gate 2 — Role and Permission Map

**Auth infrastructure:** All patient endpoints require a valid Better-Auth session (`user` injected via middleware). Branch-level authorization uses two helpers:
- `assertBranchAccess(db, userId, branchId)` — verifies active membership in branch (any role)
- `assertBranchRole(db, userId, branchId, allowedRoles[])` — verifies membership AND role in allowed list

**Role enforcement by endpoint:**

| Endpoint | Auth Check | Roles Allowed |
|----------|-----------|---------------|
| `POST /dental/patients` | `assertBranchAccess` (only if `branchId` provided) | Any branch member |
| `GET /dental/patients` | `assertBranchAccess` (branchId required) | Any branch member |
| `GET /dental/patients/:id` | `assertBranchAccess` (only if `preferredBranchId` set) | Any branch member |
| `PATCH /dental/patients/:id` | `assertBranchRole` | `dentist_owner`, `dentist_associate`, `hygienist`, `staff_full` |
| `POST /dental/patients/:id/archive` | `assertBranchAccess` (only if `preferredBranchId` set) | Any branch member |
| `POST /dental/patients/:id/restore` | `assertBranchAccess` (inferred same pattern) | Any branch member |
| `GET /dental/patients/export` | `assertBranchAccess` (branchId required) | Any branch member |
| `GET /dental/patients/:id/visits` | `assertBranchAccess` (only if `branchId` query param present) | Any branch member, or NONE if no branchId |

**PATIENT-F4 (P1):** `createDentalPatient` treats `branchId` as optional. When omitted, the patient is created with `preferredBranchId = NULL`. Downstream: `getDentalPatient` checks `if (patient.preferredBranchId) { await assertBranchAccess(...) }` — the guard is skipped for null-branch patients. Same skip in `archiveDentalPatient`. A patient with no preferred branch effectively has no access control — any authenticated user can view or archive them.

**PATIENT-F5 (P1):** `updateDentalPatient` uses `assertBranchRole` with `['dentist_owner', 'dentist_associate', 'hygienist', 'staff_full']` — explicitly excludes `staff_scheduling` and `staff_readonly`. However `listDentalPatients` (read) uses `assertBranchAccess` (any role). This asymmetry is correct policy but is undocumented and untested. No frontend role guard prevents `staff_readonly` from seeing the edit UI elements (the profile page has no edit controls at all currently, which is a separate gap).

**Frontend role guards:** `PatientFilterTabs` and `PatientList` have no role-based conditional rendering. Any authenticated user in the dashboard sees all filter tabs and the "Register Patient" button regardless of their role. The registration button fires `setShowRegistration(true)` without checking if the current member has permission to create patients.

---

### Gate 3 — Route and Navigation

**Route map:**

| Route | File | Purpose |
|-------|------|---------|
| `/_dashboard/patients` | `patients.tsx` | Patient list |
| `/_dashboard/patients_/$patientId` | `patients_/$patientId.tsx` | Patient profile |
| `/_workspace/$patientId` | `$patientId.tsx` (workspace layout) | Clinical workspace |

**PATIENT-F1 (P1):** `patients.tsx` line 119 navigates `onSelect` to `{ to: '/$patientId', params: { patientId: patient.id } }`. The TanStack Router resolves this to the `/_workspace/$patientId` route (the workspace layout wraps `/$patientId`). However the route literal `/$patientId` is not a named route in the dashboard layout — it requires TanStack Router's route tree to match it via the `_workspace` layout. The `as any` cast on the profile navigation (`line 122`) confirms both navigations have typing issues. This is an existing cross-reference issue (partial overlap with CF-01/CF-02 context): the card-click workspace navigation works at runtime but is not type-safe. The profile navigation is additionally cast `as any`.

**Profile back-links:** `PatientProfilePage` has two `<Link to="/patients">` back-links (error state and top bar). These are correct.

**Missing workspace link from profile (PATIENT-F3):** `PatientProfilePage` has no `<Link>` or button to navigate to `/_workspace/$patientId`. The AC-PROF-02 requirement ("Open workspace from profile") is not implemented in the component. The E2E test soft-passes by checking for the workspace link and skipping if absent.

---

### Gate 4 — Frontend Interaction Integrity

**Patient list:**
- SDK-based query via `listDentalPatientsOptions` — correct.
- Search is client-side filter on the already-fetched list (not a new query per keystroke). At large patient counts this will be slow.
- `usePatients` passes `status: undefined` when filter is `'all'` — correct.
- `branchId` sourced from `useOrgContextStore` — if store is not set (unauthenticated path), `branchId` is `undefined`, causing a 400 from `listDentalPatients`. Error is caught and displayed as "Failed to load patients."

**Patient registration:**
- `handleRegister` in `patients.tsx` uses raw `fetch()` (PATIENT-F2). The SDK exports `createDentalPatientMutation` (used nowhere in this route). Cache invalidation is done via `queryClient.invalidateQueries({ queryKey: listDentalPatientsQueryKey() })` manually after the raw fetch — this is fragile.
- Error path uses `alert(message)` (PATIENT-F9) — blocking browser dialog.
- Consent validation is enforced both client-side (modal validates `consentGiven`) and server-side (`createDentalPatient` throws `ValidationError` if `!consentGiven`). Server-side enforcement confirmed.

**Archive / restore / bulk-archive:**
- All use SDK mutations (`archiveDentalPatientMutation`, `restoreDentalPatientMutation`, `bulkArchiveDentalPatientsMutation`). Correct pattern.
- `window.confirm()` dialogs for archive/restore — consistent with other areas of the app.

**Export:**
- `exportDentalPatients` from SDK is called directly (not a mutation hook). Returns `data.patients` — see PATIENT-F10.

---

### Gate 5 — Forms, Modals, Tables

**PatientRegistrationModal:**
- Fields: `displayName` (required), `dateOfBirth` (required), `gender` (optional select), `consentGiven` (required checkbox)
- Validation: client-side — name required, DOB required, consent required. Gender is not validated.
- Notable: `dateOfBirth` is required in client-side validation (`!dateOfBirth` → error) but is marked optional (`dateOfBirth?`) in `createDentalPatient` body. Mismatch — backend accepts omitted DOB, frontend requires it.
- No phone/email fields in registration — only added via `updateDentalPatient` later. Consistent with minimal registration design.
- Submits via raw `fetch()` (PATIENT-F2) — not SDK.

**PatientList actions:**
- Archive: confirmation dialog → `onArchive(patientId)` → `archiveDentalPatient` mutation. EC1 guard (active payment plan blocks archive) handled server-side; client shows `BusinessLogicError` message.
- Restore: confirmation dialog → `onRestore(patientId)` → `restoreDentalPatient` mutation.
- Bulk archive: checkbox selection + confirmation → `onBulkArchive(patientIds[])`.
- Export: direct function call → CSV download.
- No edit/update patient form exists in the patient list or profile — `updateDentalPatient` endpoint exists but is not wired to any UI.

**PatientFilterTabs:**
- Four tabs: All / Active / Needs Follow-Up / Archived.
- Pure display component — no role guard. Any authenticated user sees all tabs.
- `counts` prop is optional and not passed from `patients.tsx` — tab counts are never shown (counts are `undefined`).

---

### Gate 6 — Backend/API Contract Alignment

**Endpoint inventory:**

| Handler | OpenAPI Path | SDK Hook Used in Frontend |
|---------|-------------|--------------------------|
| `listDentalPatients` | `GET /dental/patients` | `listDentalPatientsOptions` (SDK) |
| `createDentalPatient` | `POST /dental/patients` | Raw `fetch()` — NOT SDK |
| `getDentalPatient` | `GET /dental/patients/:id` | `getDentalPatientOptions` (SDK) |
| `updateDentalPatient` | `PATCH /dental/patients/:id` | Not called from UI |
| `archiveDentalPatient` | `POST /dental/patients/:id/archive` | `archiveDentalPatientMutation` (SDK) |
| `restoreDentalPatient` | `POST /dental/patients/:id/restore` | `restoreDentalPatientMutation` (SDK) |
| `bulkArchiveDentalPatients` | `POST /dental/patients/bulk-archive` | `bulkArchiveDentalPatientsMutation` (SDK) |
| `exportDentalPatients` | `GET /dental/patients/export` | `exportDentalPatients` (SDK direct call) |
| `listPatientVisits` | `GET /dental/patients/:patientId/visits` | `useVisits` (via workspace hook) |
| `listFollowUpNotes` | `GET /dental/patients/:id/follow-up-notes` | `use-follow-up-notes` hook |
| `addFollowUpNote` | `POST /dental/patients/:id/follow-up-notes` | `use-follow-up-notes` hook |

**Schema alignment:**
- `createDentalPatient` body: `displayName` (required), `dateOfBirth?`, `gender?`, `consentGiven?`, `branchId?`. Frontend always sends `consentGiven: true` (validated before submit). Backend enforces `consentGiven: true` via `ValidationError`. Aligned.
- `listDentalPatients` query: `branchId` is required by backend (returns 400 if missing) but the OpenAPI spec marks it as optional in the SDK type `ListDentalPatientsQuery`. Frontend correctly passes `branchId` from store but if store is unset the 400 is surfaced as a generic error.
- `updateDentalPatient` has no frontend form — endpoint exists but is dead from the UI. This is a workflow gap (patient edit not implemented).

**DOB required mismatch (P3):** Frontend `PatientRegistrationModal` requires `dateOfBirth` (`!dateOfBirth → error`). Backend accepts `dateOfBirth` as optional. A patient created via API without DOB cannot be registered via the UI even if DOB is legitimately unavailable.

---

### Gate 7 — Role-Based Journey Map

**Journey J1: New Patient Walk-In**
- `dentist_owner` / `staff_full` → /patients → Register Patient modal → POST /dental/patients → card appears.
- `staff_readonly` → /patients → sees "Register Patient" button (no frontend guard) → submits → backend accepts (any `assertBranchAccess` member can create if branchId provided) → patient created. `staff_readonly` should not be able to create patients.
- Missing: no role check on "Register Patient" button visibility.

**Journey J2: Open Patient Workspace**
- Card click → `navigate({ to: '/$patientId' })` → workspace loads. Works at runtime, type-unsafe (no `as any` here, but route literal is not the canonical `/_workspace/$patientId`).
- "View Profile" button → `navigate({ to: '/patients/$patientId' } as any)` → profile loads. Already captured as CF-02.

**Journey J3: View Patient Profile**
- `/patients/$patientId` → `PatientProfilePage` → overview/payment/follow-up tabs.
- No "Open Workspace" button — cannot navigate from profile to workspace (PATIENT-F3).
- Back-link "← Patients" works.

**Journey J4: Archive Patient**
- `staff_full` / any role member → archive button → `window.confirm()` → `archiveDentalPatient` → `assertBranchAccess` (any role). `staff_readonly` can archive. No role restriction on archive operation.
- EC1 guard: active payment plan blocks archive with `BusinessLogicError`. Client shows error message from API.

**Journey J5: Export Patients**
- Export → `exportDentalPatients` SDK call → CSV download. `branchId` is required by backend but frontend passes it from store. If store unset → 400.

---

### Gate 8 — Test Confidence Gap

**Backend unit tests (`dental-patient.test.ts`):**
- Covers: FR2.1 (list), FR2.2 (search), FR2.4 (profile), FR2.5 (duplicate detection), FR2.7 (archive/EC1), FR2.8 (export), FR2.9 (status), FR2.10 (follow-up filter), FR2.12 (follow-up notes CRUD), FR2.13 (bulk archive/EC1), FR2.15 (safety floor), FR2.16 (emergency contact), FR2.17 (communication prefs), FR2.18 (recall), FR2.21 (statement).
- All tests seed only `staff_full` role. No test verifies `staff_readonly` is blocked on writes, `dentist_associate` is allowed on update, or a non-member is rejected (PATIENT-F6).
- 401 tests present for all endpoints.
- No 403 tests (wrong role or wrong org).

**Backend unit tests (`dental-patient-module10.test.ts`):**
- Covers FR7.2 (CSV/JSON import), FR7.5 (first-time detection).
- Tests `dentist_owner` role only.

**Contract tests (`dental-patient.hurl`):**
- All 16 CRUD scenarios covered: create, list, search, get, update, follow-up notes, safety floor, statement, export, import, archive, restore, bulk-archive.
- Extended G2.5-S6 scenarios: visits, treatments, images, treatment plan, dentition — all 401 auth checks present.
- Only one role tested: `dentist_owner`. No rejection scenarios for wrong-role users (PATIENT-F11).

**E2E tests:**
- `patient-registration.spec.ts`: FR2.1 (empty state), FR2.3 (modal, form validation, cancel, API POST), FR2.20 (consent enforcement UI + server-side bypass test). Good coverage.
- `patient-profile.spec.ts`: AC-PROF-01 (loads without 500), AC-PROF-02 (workspace link — soft-pass, PATIENT-F8).
- `patient-checkin.spec.ts`: Check-in → draft visit creation. Works via API only, no UI assertion.
- `returning-patient-visit.spec.ts`: Workspace loads, new visit button, dental chart 32 teeth, tooth slideout, surface selector, payment footer, new-visit read/write mode. Solid workspace coverage.

**Frontend unit tests:**
- Hook tests exist for all patient hooks (`use-patients.test.ts`, `use-patient-actions.test.ts`, `use-patient-profile.test.ts`, `use-patient-billing.test.ts`, `use-follow-up-notes.test.ts`). These test hook wiring, not backend contract.
- Component tests in `z_pages/` for profile page. Component tests in `components/` for folder-card, filter-tabs, list, profile-page, registration-modal.
- No test exercises the `navigate({ to: '/$patientId' })` route path (the type-unsafe workspace navigation).

---

## Critical Issues Detail

### PATIENT-F4 — Null-Branch Patient Has No Access Control (P1)

**Files:** `createDentalPatient.ts`, `archiveDentalPatient.ts`, `getDentalPatient.ts`

`createDentalPatient` accepts `branchId` as optional. When `branchId` is omitted, the patient is created with `preferredBranchId = NULL`. Downstream handlers guard with:

```ts
if (patient.preferredBranchId) {
  await assertBranchAccess(db, user.id, patient.preferredBranchId as string);
}
```

Any authenticated user (in any org) can call `GET /dental/patients/:id` or `POST /dental/patients/:id/archive` on a null-branch patient and the guard is silently skipped. This is an effective authorization bypass for patients without a branch assignment.

The E2E `patient-checkin.spec.ts` creates a patient via API without `branchId` (`body: JSON.stringify({ displayName: 'Maria Santos', dateOfBirth: '1985-03-15', gender: 'female' })` — no `branchId`). This patient will be created with null branch and will have no access control.

**Fix:** Either enforce `branchId` as required in `createDentalPatient`, or add a fallback check using the authenticated user's org context when `preferredBranchId` is null.

### PATIENT-F1 — Route Literal Type-Unsafe Workspace Navigation (P1)

**File:** `apps/dentalemon/src/routes/_dashboard/patients.tsx` line 119

```ts
navigate({ to: '/$patientId', params: { patientId: patient.id } })
```

TanStack Router resolves `/$patientId` to the `_workspace` layout's `$patientId` segment at runtime. However the route literal is not typed as the canonical `/_workspace/$patientId`. The `onProfile` navigation on line 122 is cast `as any`, confirming the router type system does not recognize these routes from the dashboard context. If route tree is refactored, this silent failure will break navigation without a TypeScript error.

### PATIENT-F3 — Patient Profile Has No Workspace Link (P1)

**File:** `apps/dentalemon/src/features/patients/components/patient-profile-page.tsx`

`PatientProfilePage` has three tabs (Overview, Payment History, Follow-up Log) and two back-links to `/patients`, but no link/button to open the clinical workspace (`/_workspace/$patientId`). AC-PROF-02 requires "Open workspace from profile." The E2E test `patient-profile.spec.ts` checks for a workspace link and silently skips if not found, masking this gap.

---

## Recommended Fix Priority

### P1 — Fix Before Next Release

1. **PATIENT-F4**: Enforce `branchId` required in `createDentalPatient`, or add null-branch guard in `getDentalPatient` and `archiveDentalPatient`.
2. **PATIENT-F3**: Add `<Link to="/$patientId" params={{ patientId }}>Open Workspace</Link>` to `PatientProfilePage` header area. Fix the AC-PROF-02 E2E test to remove the soft-skip fallback.
3. **PATIENT-F1**: Use the typed route `{ to: '/_workspace/$patientId' }` (or the correct TanStack path) in `patients.tsx`. Remove both `as any` casts.
4. **PATIENT-F2**: Replace `handleRegister` raw `fetch()` with `createDentalPatientMutation` SDK hook. Move cache invalidation into `onSuccess`.

### P2 — Fix in Next Sprint

5. **PATIENT-F7**: Make `branchId` required in `listPatientVisits` (match `listDentalPatients` pattern) or add explicit 400 when omitted.
6. **PATIENT-F6**: Add multi-role backend tests: `staff_readonly` rejected on PATCH, `dentist_associate` accepted on PATCH, non-member rejected with 403.
7. **PATIENT-F8**: Fix AC-PROF-02 E2E test to assert workspace link exists, not soft-skip.
8. **PATIENT-F5**: Document and test role asymmetry. Add frontend role guard on "Register Patient" button (hide/disable for `staff_readonly`).
9. **PATIENT-F9**: Replace `alert(message)` in `handleRegister` error path with an inline form error or toast notification.

### P3 — Cleanup / Backlog

10. **PATIENT-F10**: Verify `exportDentalPatients` SDK return shape matches `data.patients` key. Add a test covering the export CSV content.
11. **PATIENT-F11**: Add at least one contract test scenario for non-member 403 rejection.
12. **DOB mismatch**: Align `dateOfBirth` validation — either make it optional in the modal (with a note) or mark it required in the backend OpenAPI spec.
13. **Tab counts**: Pass `counts` prop to `PatientFilterTabs` from `patients.tsx` so tab pills show patient counts.
14. **`updateDentalPatient` dead UI**: Either implement patient edit form or add a `TODO` comment and remove `updateDentalPatient` from public surface until UI is ready.

---

## Overall Confidence Score

| Area | Score | Justification |
|------|-------|---------------|
| Patient list + search | 7/10 | SDK-wired, tested E2E and backend unit; branchId missing = empty list (not error) is expected behavior |
| Patient registration | 5/10 | Raw fetch instead of SDK; DOB required mismatch; no SDK cache-safety; consent enforced server-side which is good |
| Patient profile | 4/10 | No workspace link (AC-PROF-02 unimplemented); E2E test soft-fails; profile page read-only with no edit capability |
| Auth / RBAC enforcement | 4/10 | Null-branch bypass is serious; `listPatientVisits` optional branchId guard; `staff_readonly` can register and archive patients |
| Archive / restore / bulk | 7/10 | SDK-wired, EC1 guard tested, confirmation dialogs present; role restriction missing |
| Export | 6/10 | SDK-wired; CSV generation logic is inline; export shape fragile |
| Backend unit tests | 6/10 | High FR coverage; zero multi-role coverage; no 403 tests |
| Contract tests | 7/10 | All endpoints covered; single-role only |
| E2E tests | 6/10 | Registration flow solid; profile AC-PROF-02 soft-skip; null-branch patient created in checkin test |
| **Overall** | **5/10** | Core list/create/archive flow works; navigation is type-unsafe; null-branch auth gap is exploitable; profile is a dead end; RBAC is single-role tested |

---

## New CF Entries

These findings are new to this audit and should be assigned CF IDs by the orchestrator.

| Local ID | Severity | Gate | Finding | File |
|----------|----------|------|---------|------|
| PATIENT-F1 | P1 | G3 | `patients.tsx` `onSelect` navigates to `/$patientId` (type-unsafe literal); `onProfile` cast `as any`; neither uses typed `/_workspace/$patientId` route | `apps/dentalemon/src/routes/_dashboard/patients.tsx` |
| PATIENT-F2 | P1 | G5 | `handleRegister` uses raw `fetch()` to POST `/dental/patients` instead of SDK `createDentalPatientMutation`; error path uses `alert()` | `apps/dentalemon/src/routes/_dashboard/patients.tsx` |
| PATIENT-F3 | P1 | G7 | `PatientProfilePage` has no link/button to open clinical workspace; AC-PROF-02 is not implemented in component | `apps/dentalemon/src/features/patients/components/patient-profile-page.tsx` |
| PATIENT-F4 | P1 | G2 | `createDentalPatient` allows null `branchId`; downstream `getDentalPatient` and `archiveDentalPatient` skip `assertBranchAccess` when `preferredBranchId` is null — auth bypass for null-branch patients | `services/api-ts/src/handlers/dental-patient/createDentalPatient.ts`, `getDentalPatient.ts`, `archiveDentalPatient.ts` |
| PATIENT-F5 | P1 | G2 | `staff_readonly` (any role member) can call `POST /dental/patients` (register) and `POST /dental/patients/:id/archive` — no role restriction beyond branch membership | `createDentalPatient.ts`, `archiveDentalPatient.ts` |
| PATIENT-F6 | P2 | G8 | Backend tests seed only `staff_full` — no multi-role RBAC coverage; no 403 tests | `services/api-ts/src/handlers/dental-patient/dental-patient.test.ts` |
| PATIENT-F7 | P2 | G3 | `listPatientVisits` skips `assertBranchAccess` when no `branchId` query param — any authenticated user can enumerate patient visits by ID | `services/api-ts/src/handlers/dental-patient/listPatientVisits.ts` |
| PATIENT-F8 | P2 | G8 | `patient-profile.spec.ts` AC-PROF-02 test soft-skips if workspace link absent, masking PATIENT-F3 | `apps/dentalemon/tests/e2e/patient-profile.spec.ts` |
| PATIENT-F9 | P2 | G5 | Registration error path uses `alert(message)` — blocking browser dialog, no in-form feedback | `apps/dentalemon/src/routes/_dashboard/patients.tsx` |
| PATIENT-F10 | P3 | G6 | `exportDentalPatients` SDK return shape assumed to be `{ patients: [] }` — fragile; no test covers CSV content | `apps/dentalemon/src/features/patients/hooks/use-patient-actions.ts` |
| PATIENT-F11 | P3 | G8 | Contract tests only test `dentist_owner` role — no non-member or `staff_readonly` rejection scenarios | `specs/api/tests/contract/dental-patient.hurl` |
