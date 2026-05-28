# Journey Coverage Report: dental-patient

**Module:** dental-patient
**Skill:** oli-ui-journey
**Generated:** 2026-05-27
**Scope:** Patient registration, search, profile view, medical alerts, guardian/contact, patient timeline, patient context persistence in workspace
**Standards reference:** IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md §3.2 (Patient Context), §8 (UI), PAT-BR-001..005

---

## Executive Summary

The dental-patient module is **partially implemented** at a Yellow V1 readiness level. The core patient list, search, registration (with consent enforcement), profile page, follow-up notes, archive/restore, and export flows are present and covered by unit and E2E tests. The two largest gaps are:

1. **Safety floor / medical alerts are absent from the patient profile page** — they exist in the workspace top bar but are invisible in `PatientProfilePage`. PAT-BR-003 (alerts visible in clinical context) and PAT-BR-002 (guardian/contact) are unimplemented in this module entirely.
2. **No "Open Workspace" link from the patient profile page** — the E2E spec for AC-PROF-02 falls back to a manual URL workaround, and the component itself has no such navigation.

Minor bugs also exist in the client-side routing and the archived read-only UI enforcement.

---

## Journey Matrix

| Journey | WF | Status | Evidence | Gaps |
|---|---|---|---|---|
| Patient registration (consent required) | WF-005, WF-044 | Covered | `patient-registration-modal.tsx`, E2E `patient-registration.spec.ts` | No duplicate-patient detection in UI (WF-005 exception path) |
| Patient search (branch-scoped) | WF-023 | Covered | `use-patients.ts`, `patient-filter-tabs.tsx`, unit tests | Client-side filter duplicates server filter (see BUG-01) |
| Patient search — needs-follow-up filter | WF-023 | Covered | `usePatients` hook passes `needsFollowUp` param | — |
| Patient profile view (demographics + stats) | WF-055 | Covered | `patient-profile-page.tsx`, `use-patient-profile.ts`, unit + E2E | — |
| Patient profile — visit history tab | WF-055 | Covered | `OverviewTab` with `useVisits` | Capped at 6 visits with no "show all" link |
| Patient profile — payment history tab | WF-055 | Covered | `PaymentTab` with `usePatientBilling` | — |
| Patient profile — follow-up notes tab | WF-055, PAT-S4 | Covered | `FollowUpNotes`, `use-follow-up-notes.ts`, unit tests | — |
| Patient profile — open workspace from profile | WF-008 | **MISSING** | E2E fallback only; no link in `PatientProfilePage` | No "Open Workspace" button/link rendered |
| Patient context persistence in workspace | §8.1 | Partial | WorkspaceTopBar renders name + safety floor | Profile page lacks context ribbon |
| Medical alerts / safety floor in patient context | PAT-BR-003 | **MISSING in profile** | Exists in workspace `WorkspaceTopBar` only | No alert display in `PatientProfilePage` |
| Guardian / contact support (minor patients) | PAT-BR-002 | **NOT IMPLEMENTED** | No `PatientContact` entity, no guardian UI anywhere | Full gap — no data model or form fields |
| Archive patient | WF-058 | Covered | `useArchivePatient`, confirm dialog, unit + E2E | — |
| Restore archived patient | WF-058 | Covered | `useRestorePatient` | — |
| Bulk archive | WF-058 | Covered | `useBulkArchive` | — |
| Export patients (CSV) | PAT-S6 | Covered | `useExportPatients` downloads CSV | — |
| Archived patient read-only badge | BR-015b | Partial | Status badge renders "Archived"; no form lockout | Profile tabs still show Follow-up form for archived (BUG-02) |
| Duplicate patient warning on registration | WF-005 | **MISSING** | Server returns 409 but client calls `alert()` raw | No structured duplicate-check UX (BUG-03) |
| Patient timeline (chronological all events) | §3.2, §6.2 | Partial | Visit history only (6 items); no imaging/invoice/recall integration | Not a full timeline |
| Pediatric dentition / FDI 51–85 init | MODULE_SPEC §13 | **NOT VISIBLE** | Dentition is workspace-level; profile has no indicator | No age-based UI signal in registration or profile |
| GDPR erasure flow | WF-088 | Not in scope for profile UI | Documented as P2 | — |

---

## Bug Findings

### BUG-01 — Client-side search duplicates server-side filter (WARNING)

**File:** `apps/dentalemon/src/features/patients/components/patient-list.tsx:57-61`

```tsx
const filtered = searchQuery
  ? patients.filter((p) =>
      p.displayName.toLowerCase().includes(searchQuery.toLowerCase()),
    )
  : patients;
```

The `usePatients` hook already sends `q=searchQuery` to the server (server-filtered list returned). `PatientList` then re-filters that already-filtered result client-side. This is redundant and will silently break if:
- The patient's server-side name differs from `displayName` (e.g., split first/last name)
- The API paginates results — only the current page is client-re-filtered, masking patients on later pages

**Fix:** Remove the client-side `patients.filter(...)` or pass an empty `searchQuery` to `PatientList` when server-side filtering is active. The search input should only drive the `usePatients` query parameter.

---

### BUG-02 — Archived patient profile still shows editable Follow-up form (WARNING)

**File:** `apps/dentalemon/src/features/patients/components/patient-profile-page.tsx:401`

The profile page renders an "Archived" status badge but does **not** gate the Follow-up tab. An archived patient (`BR-015b`: record is read-only) still shows the `<FollowUpNotes>` textarea and "Add Note" button. The server-side 405 will reject the POST, but the UI violates the spec's stated intent (read-only).

**Fix:**
```tsx
{activeTab === 'followup' && (
  <FollowupTab patientId={patientId} readOnly={data.status === 'archived'} />
)}
```
Pass `readOnly` to `FollowUpNotes` and hide the add-note form when `readOnly === true`.

---

### BUG-03 — Duplicate patient detection uses raw `alert()` (WARNING)

**File:** `apps/dentalemon/src/routes/_dashboard/patients.tsx:76-79`

```tsx
const message = err?.message ?? `Registration failed (${res.status})`;
alert(message);
return;
```

All registration errors (including 409 DUPLICATE_PATIENT) are surfaced via `window.alert()`. This breaks on iPad (`alert()` is blocking, not styled), is not accessible, and provides no actionable path (MODULE_SPEC §15 says duplicate should prompt staff to search first).

**Fix:** Replace `alert(message)` with an inline error state displayed in the modal. For the 409 case, show a suggestion to search for the existing patient by name.

---

### BUG-04 — Navigation from patient list card goes to workspace, not profile (BUG / UX)

**File:** `apps/dentalemon/src/routes/_dashboard/patients.tsx:118-123`

```tsx
onSelect={(patient: PatientCardData) =>
  navigate({ to: '/$patientId', params: { patientId: patient.id } })
}
onProfile={(patient: PatientCardData) =>
  navigate({ to: '/patients/$patientId', params: { patientId: patient.id } } as any)
}
```

The `as any` cast on line 122 suppresses a TypeScript error. The route `/_dashboard/patients_/$patientId` expects path `/patients/:patientId` but the navigate call uses `'/patients/$patientId'` — this is a string literal, not a typed route. If the route tree does not have this exact path registered, navigation silently fails or navigates to a 404. The `as any` hides the type error.

**Fix:** Use the generated TanStack Router typed path:
```tsx
navigate({ to: '/patients/$patientId', params: { patientId: patient.id } })
```
and remove the `as any`. Verify the route tree includes `/_dashboard/patients_/$patientId` at path `/patients/$patientId`.

---

### BUG-05 — No "Open Workspace" link from patient profile page (WARNING)

**File:** `apps/dentalemon/src/features/patients/components/patient-profile-page.tsx`

The profile page renders a header with patient name and tabs, but has no navigation link or button to open the clinical workspace for this patient. The E2E spec `patient-profile.spec.ts:AC-PROF-02` explicitly tests for this and falls back to a direct URL visit when the link is absent, which means the test passes vacuously.

Per WORKFLOW_MAP §3 (WF-055 → WF-008): viewing a profile should provide a path to open the workspace.

**Fix:** Add a workspace link in the profile header top bar:
```tsx
<Link to="/$patientId" params={{ patientId }} className="...">
  Open Workspace
</Link>
```

---

## Coverage Gaps (Not Bugs — Missing Features)

### GAP-01 — Medical alerts / safety floor absent from patient profile (P1)

**Standard reference:** PAT-BR-003 (V1 Required) — medical alerts must be visible in clinical encounter **and charting contexts**. The profile page is the primary clinical context outside the workspace.

**Current state:** Safety floor exists in `WorkspaceTopBar` (workspace only, driven by `useMedicalHistory`). The `PatientProfilePage` has no allergy/medication/condition display.

**Impact:** Clinical staff reviewing a patient's profile before opening a visit see no alerts. Per MODULE_SPEC §9 (Safety Floor), the patient profile cabinet should include the safety floor banner.

**Recommendation:** Add a `<SafetyFloorBanner patientId={patientId} />` component to the Overview tab or the profile header card, reusing the `useMedicalHistory` hook already present in the workspace.

---

### GAP-02 — Guardian / contact support entirely absent (P1)

**Standard reference:** PAT-BR-002 (V1 Required) — minor patients must support guardian/contact linkage. §6.2 defines `PatientContact` entity as V1 Required.

**Current state:** No `PatientContact` data model, no guardian fields in `PatientRegistrationModal`, no display in `PatientProfilePage`. The `RawPatientDetail` interface has no `contacts` field.

**Impact:** Any patient under 18 cannot have a guardian recorded. A "Child patient" seed scenario (§10.2) cannot be tested.

**Recommendation (PAT-S2 → PAT-S7 new slice):** Add `guardianName`, `guardianPhone`, `guardianRelationship` optional fields to the registration form, exposed only when patient age < 18 (computed from DOB). Backend endpoint must accept and store these via a `patient_contacts` table or JSONB extension.

---

### GAP-03 — Patient timeline is visit-only, not a full chronological timeline (P2)

**Standard reference:** §3.2 — "Patient timeline: Chronological view of visits, procedures, notes, attachments, invoices, recalls" (V1 Required).

**Current state:** The Overview tab shows recent visits (capped at 6, no pagination). Invoices are in a separate tab. There is no unified timeline mixing visits + billing events + recalls + attachments.

**Impact:** The MODULE_SPEC requirement for a full cabinet is not met. The 6-visit cap with no "show all" control means patients with long histories have no way to see older visits from the profile.

**Recommendation:** Add "Show all visits" link in the OverviewTab, and consider a unified Timeline tab that merges visit, invoice, and recall events sorted by date.

---

### GAP-04 — Pediatric dentition indicator absent from registration and profile (P2)

**Standard reference:** MODULE_SPEC §13 edge case — pediatric patient (age < 18) → FDI notation 51–85.

**Current state:** The registration form collects DOB but does not set a `dentitionType` field. The profile page shows age but gives no indication of pediatric dentition. Dentition initialization happens implicitly in the workspace.

**Recommendation:** Add `dentitionType: 'adult' | 'pediatric'` field to registration (auto-suggest based on DOB, allow override). Display in profile header demographics strip.

---

### GAP-05 — Duplicate patient warning path not implemented in UI (P1)

**Standard reference:** WF-005 exception path — "Duplicate person (same name+DOB+phone) → prompt staff to search first."

**Current state:** Server returns 409. Client shows `alert()` with the raw error message. No structured "did you mean this patient?" UI exists.

**Recommendation:** On 409 response, show an inline duplicate warning inside the modal with a "Search for existing patient" CTA that closes the modal and populates the search query.

---

## Business Rule Coverage Matrix

| Rule ID | Standard | Status | Evidence | Gap |
|---|---|---|---|---|
| BR-015 | Marketing consent required at registration | Covered | Frontend validation + E2E AC-REG-02 tests server 422 | — |
| BR-015b | Archived = read-only | Partial | Badge shows; Follow-up form not locked | BUG-02 |
| BR-015c | Follow-up notes append-only | Covered (server-enforced) | No edit/delete button in `FollowUpNotes` | — |
| BR-020 | Merge not implemented | Covered | No merge UI; 501 behavior expected server-side | — |
| PAT-BR-001 | Name + identifier required | Covered | Form validates name + DOB required | — |
| PAT-BR-002 | Guardian/contact for minors | NOT COVERED | No guardian fields anywhere | GAP-02 |
| PAT-BR-003 | Medical alerts visible in clinical context | Partial — workspace only | WorkspaceTopBar has safety floor; profile does not | GAP-01 |
| PAT-BR-004 | No hard delete when history exists | Covered (server-enforced) | Archive flow used; no delete UI | — |
| PAT-BR-005 | Merge with audit trail | V2/Deferred | — | — |

---

## Test Coverage Summary

| Layer | Coverage | Notes |
|---|---|---|
| Unit — registration form validation | Good | BR-015 consent, name required, cancel, submit all tested |
| Unit — patient list hook + transform | Good | `toPatientCard`, API params, error state all tested |
| Unit — patient profile hook + transform | Good | `toPatientProfile`, demographics, error state tested |
| Unit — follow-up notes | Good | Render, empty state, loading, submit, ordering tested |
| Unit — patient actions | Good | Archive, restore, bulk, export with URL/body assertions |
| Unit — profile page integration | Partial | Visits, payment tab, error state tested. No test for archived read-only state (BUG-02) |
| E2E — registration flow | Good | 7 scenarios including server-side BR-015 enforcement |
| E2E — profile page | Weak | AC-PROF-01 (page loads) and AC-PROF-02 (workspace link) both pass vacuously — PROF-01 only checks `content.length > 50`; PROF-02 falls back to direct URL when link absent |
| E2E — patient check-in, returning visit | Present | `patient-checkin.spec.ts`, `returning-patient-visit.spec.ts` exist |
| E2E — medical alerts visible before treatment | NOT PRESENT | PAT-BR-003 has no E2E coverage |
| E2E — guardian/contact | NOT PRESENT | GAP-02 has no test coverage |
| E2E — duplicate patient warning | NOT PRESENT | GAP-05 has no test coverage |
| E2E — archived patient read-only | NOT PRESENT | BUG-02 has no test coverage |

---

## V1 Readiness Rating

**Overall: Yellow**

Core registration, search, and profile read-flows are functional and reasonably tested. However:
- Medical alerts absent from profile (PAT-BR-003, V1 Required) — P1
- Guardian/contact absent (PAT-BR-002, V1 Required) — P1
- No workspace link from profile page — P1
- Archived read-only not enforced in UI — P1
- Client-side search double-filter bug — Warning

The module is not blocking a demo, but is not production-safe for a clinic handling minors or requiring clinical-alert visibility outside the workspace.

---

## Prioritized Remediation Roadmap

| Priority | Item | Rule | Effort |
|---|---|---|---|
| P0 | Fix `as any` navigation cast (BUG-04) — silent routing failure risk | — | XS |
| P1 | Add "Open Workspace" link to profile page (BUG-05, AC-PROF-02) | §8.1 context persistence | XS |
| P1 | Add safety floor banner to profile page (GAP-01) | PAT-BR-003 | S |
| P1 | Enforce archived read-only on Follow-up form (BUG-02) | BR-015b | XS |
| P1 | Replace `alert()` with inline modal error for 409 (BUG-03) | WF-005 exception | S |
| P1 | Add guardian/contact fields to registration for minors (GAP-02) | PAT-BR-002 | M |
| P2 | Remove client-side search double-filter (BUG-01) | — | XS |
| P2 | Add "Show all visits" link + pagination in Overview tab (GAP-03) | §3.2 patient timeline | S |
| P2 | Add E2E tests for archived read-only, medical alerts, PROF-01/PROF-02 assertions | §9.2 E2E-001 | M |
| P3 | Pediatric dentition indicator in registration + profile (GAP-04) | MODULE_SPEC §13 | M |

---

_Reviewer: Claude (oli-ui-journey skill) | 2026-05-27_
