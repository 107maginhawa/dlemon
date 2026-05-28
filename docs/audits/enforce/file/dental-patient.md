<!-- oli-enforce-file: dental-patient | generated: 2026-05-27 | skill: oli-enforce-file --auto -->

# Enforcement Audit — `dental-patient`

**Module spec:** `docs/product/modules/dental-patient/MODULE_SPEC.md`
**API contracts:** `docs/product/modules/dental-patient/API_CONTRACTS.md`
**Backend:** `services/api-ts/src/handlers/dental-patient/`
**Frontend:** `apps/dentalemon/src/features/patients/`, `apps/dentalemon/src/routes/_dashboard/patients.tsx`, `apps/dentalemon/src/routes/_dashboard/patients_/$patientId.tsx`
**Audited:** 2026-05-27

---

## Coverage Legend

| Symbol | Meaning |
|--------|---------|
| FOUND | Implemented and substantively correct |
| PARTIAL | Exists but has a gap vs spec |
| MISSING | Not implemented at all |
| DIVERGED | Implemented but contradicts spec |

---

## 1. API Endpoint Coverage

### POST /api/v1/dental/patients
**Status: PARTIAL**
- FOUND: `createDentalPatient.ts` — patient + person creation, consent validation, branch access check
- DIVERGED: Body schema uses `displayName` (split into firstName/lastName) instead of separate `first_name`/`last_name` fields required by `API_CONTRACTS.md`
- DIVERGED: Spec requires `marketing_consent` and `data_sharing_consent` as distinct boolean fields; implementation uses a single `consentGiven` flag — consent granularity is lost
- DIVERGED: `branchId` is optional in implementation (`body.branchId` guarded before assertBranchAccess); spec marks `branch_id` as required — a patient can be created without branch scope
- DIVERGED: Spec error code for missing consent is `CONSENT_REQUIRED(422)` with error code `CONSENT_REQUIRED`; implementation throws `ValidationError('Patient consent is required')` — error code is not emitted
- PARTIAL: Duplicate detection is non-blocking (warning in response body); spec expects `DUPLICATE_PATIENT(409)` to block registration
- FOUND: DE-021 `PatientRegistered` event logged (info log; no explicit event bus)

### GET /api/v1/dental/patients
**Status: PARTIAL**
- FOUND: `listDentalPatients.ts` — pagination, search, status filter, branch guard
- DIVERGED: Implementation expands `branchId` to entire org's branches (all branches in same org returned); spec states results must be filtered to the requested branch scope (AC-PAT-004: "only branch A patients returned")
- FOUND: `staff_scheduling` role can list patients; role check is via `assertBranchAccess` (branch membership check, not role-filtered) — matches spec permission table
- PARTIAL: Spec default `status=active`; implementation passes `status` as-is from query (no default applied in handler; may rely on query-layer default)

### GET /api/v1/dental/patients/:id
**Status: PARTIAL**
- FOUND: `getDentalPatient.ts` — patient profile, visit count, outstanding balance
- PARTIAL: Safety floor (`allergies` array) not included in GET /patients/:id response; spec `PatientProfile` includes `allergies: string[]`. Safety floor is a separate endpoint (`getDentalPatientSafetyFloor.ts`) but the profile response does not embed it.
- PARTIAL: `follow_up_notes` array not included in profile response; spec lists it as part of `PatientProfile`
- PARTIAL: `consents` (ConsentSummary) not returned; spec includes it
- DIVERGED: Audit log uses `patient.preferredBranchId ?? patientId` as `tenantId` — falls back to patientId when no branch assigned, which is semantically wrong (tenantId should be an org/branch UUID)

### PATCH /api/v1/dental/patients/:id
**Status: PARTIAL**
- FOUND: `updateDentalPatient.ts` — field updates, branch role check
- DIVERGED: No BR-015b guard: does not check if patient is archived before allowing writes. An archived patient should return 403 on any write; this handler proceeds to update without status check.
- FOUND: `assertBranchRole` used (not just `assertBranchAccess`), roles: `dentist_owner`, `dentist_associate`, `hygienist`, `staff_full` — `hygienist` is not in spec's allowed roles for demographics update (spec: `staff_full`, `dentist_owner`)

### POST /api/v1/dental/patients/:id/archive
**Status: PARTIAL**
- FOUND: `archiveDentalPatient.ts` — archive with reason, branch check
- DIVERGED: Uses `assertBranchAccess` (any branch member) instead of `assertBranchRole(['dentist_owner'])`; spec restricts archive to `dentist_owner` only
- PARTIAL: Body field `reason` not validated in handler (no schema on `ValidatedContext<never, ...>`); spec requires `reason` min:5, max:500
- FOUND: `PATIENT_ALREADY_ARCHIVED` — repo returns `{ success: false, reason: 'Patient is already archived' }`; handler throws `BusinessLogicError`; error code propagated as `ARCHIVE_BLOCKED` not `PATIENT_ALREADY_ARCHIVED(409)` as specified

### GET /api/v1/dental/patients/:id/statement
**Status: FOUND**
- FOUND: `getDentalPatientStatement.ts` — invoices, payments, line items, totals
- PARTIAL: Statement response does not include `generated_at` at root level; it is buried as `generatedAt` inside response object — matches semantically but field name differs from spec
- FOUND: Branch access guarded

### POST /api/v1/dental/patients/:id/follow-up
**Status: PARTIAL**
- FOUND: `addFollowUpNote.ts` + `followUpNotes.ts` — dual implementation (see quality issues below)
- FOUND: Append-only semantics (no PATCH/DELETE route for notes)
- MISSING: No 405 `FOLLOW_UP_IMMUTABLE` handler registered for PATCH/DELETE on the follow-up notes path; spec requires `PATCH/DELETE: Returns 405 FOLLOW_UP_IMMUTABLE`
- PARTIAL: Response shape is `{ note, total }` not `{ data: FollowUpNote }` as specified

### POST /api/v1/dental/patients/bulk-archive
**Status: PARTIAL**
- FOUND: `bulkArchiveDentalPatients.ts` — per-patient archive with results
- DIVERGED: Uses `assertBranchAccess` (any branch member) instead of restricting to `dentist_owner` as spec requires
- DIVERGED: Spec input field is `ids: string[]` (max:50); implementation reads `patientIds` from body — field name mismatch
- DIVERGED: Validator (`validators.ts:1628`) has no `.max(50)` constraint; spec cap of 50 items not enforced

### POST /api/v1/dental/patients/import
**Status: DIVERGED**
- FOUND: `importPatients.ts` — CSV + JSON import, all-or-nothing transaction
- DIVERGED: Spec response is `202 { data: { job_id, status: "queued" } }` (async); implementation returns synchronous `201 { success, imported, total, patients }` — async job contract not implemented
- DIVERGED: Spec requires `multipart/form-data` with `file` field; implementation reads `text/csv` or JSON body directly (no multipart form parsing)
- DIVERGED: Spec role restriction: `dentist_owner` only; implementation allows `dentist_owner`, `dentist_associate`, `staff_full`
- MISSING: No 10 MB file size limit enforced
- MISSING: No 1000-row import limit enforced

### GET /api/v1/dental/patients/:id/export
**Status: MISSING**
- MISSING: No per-patient export handler. `exportDentalPatients.ts` is a bulk export (`GET /dental/patients/export?branchId=...`), not the per-patient export (`GET /dental/patients/:id/export`) specified in API_CONTRACTS.md

---

## 2. Business Rule Coverage

### BR-015: Marketing consent required at registration
**Status: PARTIAL**
- FOUND: `consentGiven` boolean must be `true` or ValidationError thrown
- DIVERGED: Single `consentGiven` field collapses `marketing_consent` + `data_sharing_consent`; granular consent fields not captured or stored

### BR-015b: Archived patient is read-only (403 on any write)
**Status: MISSING**
- MISSING: `updateDentalPatient.ts` — no check for `patient.status === 'archived'` before applying updates
- MISSING: `addFollowUpNote.ts` — no check for archived status before appending note

### BR-015c: Follow-up notes are append-only (405 on PATCH/DELETE)
**Status: PARTIAL**
- FOUND: No PATCH/DELETE handler exists (implicit 404)
- MISSING: No explicit 405 `FOLLOW_UP_IMMUTABLE` route registered; spec requires a 405 response not 404

### BR-020: Patient merge returns 501
**Status: MISSING**
- MISSING: No merge endpoint stub returning 501 NOT IMPLEMENTED

---

## 3. Permission Coverage

| Action | Spec Role | Implementation | Status |
|--------|-----------|----------------|--------|
| Create patient | staff_full, dentist_associate, dentist_owner | assertBranchAccess (any member) | DIVERGED — staff_scheduling can create |
| List patients | all dental roles | assertBranchAccess | FOUND |
| View patient | staff_full, dentist_associate, dentist_owner | assertBranchAccess | PARTIAL — staff_scheduling not blocked |
| Update demographics | staff_full, dentist_owner | assertBranchRole(['dentist_owner','dentist_associate','hygienist','staff_full']) | DIVERGED — hygienist added, staff_scheduling excluded per impl but spec allows it |
| Archive patient | dentist_owner | assertBranchAccess (any member) | DIVERGED — any member can archive |
| Bulk archive | dentist_owner | assertBranchAccess (any member) | DIVERGED |
| Import | dentist_owner | dentist_owner + dentist_associate + staff_full | DIVERGED |
| Export (bulk) | dentist_owner | assertBranchAccess | DIVERGED — any member can export |
| Statement | staff_full, dentist_owner | assertBranchAccess | DIVERGED — staff_scheduling + others not blocked |
| Add follow-up note | staff_full, dentist_associate, dentist_owner | assertBranchAccess | PARTIAL — staff_scheduling not blocked |

---

## 4. Data Model Coverage

### `patient` table fields
| Spec Field | Status | Notes |
|-----------|--------|-------|
| id (UUID PK) | FOUND | |
| person_id | FOUND | stored as `person` column |
| branch_id | PARTIAL | stored as `preferredBranchId`; nullable when not provided at creation |
| date_of_birth | FOUND | on `persons` table via person record |
| gender | FOUND | on `persons` table |
| has_active_payment_plan | FOUND | |
| archived_at | FOUND | |
| follow_up_notes (JSONB) | FOUND | |
| recall_due_at | FOUND | as `recallDate` |

### Safety Floor aggregation (in-memory)
| Spec Source | Status | Notes |
|------------|--------|-------|
| allergies from medical history | FOUND | `getDentalPatientSafetyFloor.ts` |
| medications from prescriptions | FOUND | via `medicalHistoryEntries` entryType=medication |
| conditions | FOUND | via `medicalHistoryEntries` entryType=condition |

---

## 5. Acceptance Criteria Coverage

| AC ID | Description | Status |
|-------|-------------|--------|
| AC-PAT-001 | Registration requires consent → 422 CONSENT_REQUIRED | PARTIAL — error thrown but code is generic ValidationError |
| AC-PAT-002 | Archived patient → 403 on any write | MISSING — write handlers do not check archived status |
| AC-PAT-003 | Safety floor aggregation includes allergies + medications | FOUND — separate endpoint |
| AC-PAT-004 | Search is branch-scoped | DIVERGED — expanded to org-wide |

---

## 6. Frontend Coverage

### Patient List (`patients.tsx`)
| Spec Need | Status | Notes |
|-----------|--------|-------|
| Patient registration modal | FOUND | `PatientRegistrationModal` |
| Search (name/DOB/phone) | FOUND | via `usePatients` hook |
| Consent required (frontend guard) | FOUND | `validate()` checks `consentGiven` |
| Archive / restore actions | FOUND | `useArchivePatient`, `useRestorePatient` |
| Bulk archive | FOUND | `useBulkArchive` |
| Export | FOUND | `useExportPatients` |
| Status filter tabs | FOUND | `PatientFilterTabs` |

### Navigation bug
| Item | Status | Notes |
|------|--------|-------|
| `onSelect` navigation | DIVERGED | Line 119: navigates to `'/$patientId'` which resolves to `_workspace/$patientId.tsx`, not `_dashboard/patients_/$patientId.tsx` — inconsistent intent |
| `onProfile` navigation | FOUND | Line 122: navigates to `/patients/$patientId` with `as any` type cast (unsafe) |

### Patient Registration Modal
| Spec Field | Status | Notes |
|-----------|--------|-------|
| first_name / last_name | DIVERGED | Single `displayName` field; spec requires separate name fields |
| marketing_consent checkbox | DIVERGED | Single "patient has provided consent" checkbox; spec requires `marketing_consent` + `data_sharing_consent` as separate fields |
| sms_consent / email_consent | MISSING | Not shown in modal |
| email field | MISSING | Not in registration form |
| phone field | MISSING | Not in registration form |

### Patient Profile
| Spec Need | Status |
|-----------|--------|
| Safety floor banner | FOUND (`getDentalPatientSafetyFloor` endpoint exists; FE uses it via separate hooks) |
| Follow-up notes | FOUND (`FollowUpNotes` component) |
| Recall section | PARTIAL (recallDate field shown; no dedicated recall management UI from spec) |
| Treatment plan summary | FOUND (handler exists: `listPatientTreatmentPlans.ts`) |
| Statement summary | FOUND (`use-patient-billing.ts` hook) |
| Archived notice (read-only badge) | PARTIAL (status field returned; no evidence read-only UI enforcement exists in `patient-profile-page.tsx`) |

---

## 7. Quality Defects (Non-Spec Gaps)

### BLOCKER: Duplicate `addFollowUpNote` export
`followUpNotes.ts:46` and `addFollowUpNote.ts:18` both export a function named `addFollowUpNote`. They have different signatures (`BaseContext` vs `ValidatedContext`). The route registry resolves one; the other is dead code and creates confusion about which is authoritative. The `sql` import in `followUpNotes.ts:15` is unused.

### BLOCKER: Two separate `needsFollowUp = true` DB writes in addFollowUpNote
`addFollowUpNote.ts:50-59` and `followUpNotes.ts:79-87` both issue two sequential `UPDATE` statements (one for the notes array, one for `needsFollowUp`). These should be a single `UPDATE` statement. Between the two updates there is a window where notes are written but `needsFollowUp` is still false.

### WARNING: `tenantId` fallback to `patientId` in audit log
`getDentalPatient.ts:69`: `tenantId: patient.preferredBranchId ?? patientId` — if the patient has no branch, `patientId` (a patient UUID) is used as a `tenantId`. This corrupts audit log semantics.

### WARNING: Export status filter applied in-memory after fetching 10k rows
`exportDentalPatients.ts:63-68`: fetches up to 10,000 patients, then filters by status in JavaScript. The `status` should be passed as a filter to `repo.findManyWithPerson()` to avoid fetching rows that are discarded.

### WARNING: `as any` type cast in navigation
`patients.tsx:122`: `navigate({ to: '/patients/$patientId', params: { patientId: patient.id } } as any)` — bypasses TanStack Router type safety.

### WARNING: Missing `patients_/$patientId` route path in `onSelect`
`patients.tsx:119` navigates to `'/$patientId'` which matches `_workspace/$patientId.tsx` (workspace route), not the profile page. `onProfile` (line 122) correctly targets `/patients/$patientId`. The two callbacks appear to intend different routes but `onSelect` may be wrong.

### WARNING: CSV parsing does not handle quoted fields
`importPatients.ts:61`: `line.split(',')` does not handle RFC 4180 quoted fields. A name like `"Smith, Jr."` will be split incorrectly, producing wrong column mapping silently.

### WARNING: `branchId` optional in `createDentalPatient` creates unscoped patients
`createDentalPatient.ts:43-44`: branch access is only asserted when `body.branchId` is truthy. A patient can be created without a branch, leaving `preferredBranchId` null. Subsequent `assertBranchAccess` calls on those patients are skipped (guarded by `if (patient.preferredBranchId)`), meaning an unscoped patient is accessible to anyone authenticated.

---

## 8. Missing Handler Inventory

| Spec Endpoint | Handler File | Status |
|---------------|-------------|--------|
| GET /dental/patients/:id/export | — | MISSING |
| PATCH /dental/patients/:id/follow-up/:noteId → 405 | — | MISSING |
| DELETE /dental/patients/:id/follow-up/:noteId → 405 | — | MISSING |
| POST /dental/patients/merge → 501 | — | MISSING |
| GET /dental/import-jobs/:id (async poll) | — | MISSING |

---

## Summary

| Category | FOUND | PARTIAL | DIVERGED | MISSING |
|----------|-------|---------|----------|---------|
| API Endpoints (10) | 1 | 5 | 3 | 1 |
| Business Rules (4) | 0 | 2 | 0 | 2 |
| Permissions (10 actions) | 2 | 2 | 6 | 0 |
| AC Criteria (4) | 1 | 1 | 1 | 1 |
| Frontend Screens | 3 | 2 | — | — |

**Critical divergences requiring action before spec compliance:**
1. `branchId` optional in create → unscoped patients bypass all branch auth
2. Archive/bulk-archive use `assertBranchAccess` not `assertBranchRole(['dentist_owner'])` — any branch member can archive
3. BR-015b not enforced — archived patients accept writes
4. Import endpoint is synchronous+JSON/CSV body, not async multipart per spec
5. Per-patient export (`GET /dental/patients/:id/export`) not implemented
6. Duplicate `addFollowUpNote` — route binding ambiguity
