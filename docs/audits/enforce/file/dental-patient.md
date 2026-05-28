# OLI Enforce — File-Level Audit: dental-patient

**Run ID:** run-6-strict-2026-05-29  
**Module:** dental-patient  
**Handler root:** `services/api-ts/src/handlers/dental-patient/`  
**Files checked:** 82 (68 implementation, 14 test)  
**Date:** 2026-05-29

---

## Summary Counts

| Severity | Count |
|----------|-------|
| P0       | 3     |
| P1       | 3     |
| P2       | 2     |
| P3       | 1     |

| Check | Count |
|-------|-------|
| auth_missing | 0 |
| branch_scope_missing | 16 |
| phi_log_risk | 0 |

---

## P0 Findings (Must fix before ship)

### EF-PAT-001 — P0: AC-PAT-002 VIOLATED — Archived patient write-block missing

**Severity:** P0 — Security + data integrity  
**Criterion:** AC-PAT-002 — Any write operation on archived patient must return 403.

**Affected handlers (all write paths that use `getPatientForDentalPatient` facade):**
- `alerts/createDentalAlert.ts`
- `alerts/updateDentalAlert.ts`
- `contacts/createPatientContact.ts`
- `contacts/updatePatientContact.ts`
- `contacts/deletePatientContact.ts`
- `engagement/createTask.ts`
- `engagement/updateTask.ts`
- `insurance/createInsuranceProfile.ts`
- `insurance/updateInsuranceProfile.ts`
- `insurance/createClaimDraft.ts`
- `insurance/updateClaimStatus.ts`
- `recalls/createRecall.ts`
- `recalls/updateRecall.ts`
- `treatment-plans/createTreatmentPlan.ts`
- `treatment-plans/updateTreatmentPlan.ts`

**Root cause:** `getPatientForDentalPatient` facade returns `{ id, preferredBranchId }` only — it does not return `status`. None of the above handlers check `patient.status === 'archived'` before proceeding with writes. The identity-layer handlers (`updateDentalPatient`, `addFollowUpNote`) also do not check archived status before writing.

**Fix:** Either (a) add `status` to `getPatientForDentalPatient` return and assert `status !== 'archived'` in each write handler, or (b) add a shared `assertPatientNotArchived(patient)` guard called after patient lookup in all write handlers.

---

### EF-PAT-002 — P0: AC-PAT-001 PARTIAL — Consent error code wrong (422 vs 400, no CONSENT_REQUIRED code)

**Severity:** P0 — Spec compliance  
**Criterion:** AC-PAT-001 — Registration without consent returns 422 with `CONSENT_REQUIRED` error code.

**File:** `identity/createDentalPatient.ts` line 37

```ts
if (!body.consentGiven) throw new ValidationError('Patient consent is required');
```

**Issues:**
1. `ValidationError` maps to HTTP 400, not 422 as required by AC-PAT-001.
2. No `CONSENT_REQUIRED` error code is emitted — plain message only.

**Fix:** Throw `BusinessLogicError('Patient consent is required', 'CONSENT_REQUIRED')` which maps to 422, or map `ValidationError` with code to 422 in the error handler.

---

### EF-PAT-003 — P0: Branch scope CONDITIONAL on `branchId` presence in `listPatientVisits` and `listPatientConditions`

**Severity:** P0 — Patient data leak across branches  
**Criterion:** AC-PAT-004 — Search/list is always branch-scoped.

**Files:**
- `identity/listPatientVisits.ts` lines 37–38
- `identity/listPatientConditions.ts` lines 33–34

```ts
const branchId = ctx.req.query('branchId');
if (branchId) await assertBranchAccess(db, user.id, branchId);
```

`branchId` is optional — when omitted, `assertBranchAccess` is skipped entirely and the query returns visits/conditions for the `patientId` across ALL branches. A user from Branch A can query a patient from Branch B with no restriction. This is a cross-branch data leak.

**Fix:** Make `branchId` required for these endpoints, or always enforce branch check via patient's `preferredBranchId`.

---

## P1 Findings (Fix before next release)

### EF-PAT-004 — P1: Branch scope MISSING in alerts, contacts, insurance, recalls, treatment-plans, sync, engagement handlers

**Severity:** P1 — Cross-branch data access without enforcement  
**Affected sub-modules (all write and read handlers using `getPatientForDentalPatient`):**

| Subdirectory | Handlers | Branch Check |
|---|---|---|
| `alerts/` | create, list, update | None |
| `contacts/` | create, list, update, delete | None |
| `insurance/` | create, list, update (profiles + claims) | None |
| `recalls/` | create, list, update | None |
| `treatment-plans/` | create, list, update | None |
| `engagement/` | createTask, listPatientTasks, updateTask | None |
| `sync/` | createSyncLog, listSyncLogs, updateSyncLog | None |

**Root cause:** These handlers call `getPatientForDentalPatient` to confirm patient existence, but do NOT call `assertBranchAccess` or `assertBranchRole` afterward. A user from any branch can create/modify alerts, contacts, recalls, tasks, treatment plans, insurance, or sync logs for any patient in the system.

**Fix:** After `getPatientForDentalPatient`, assert branch access using `patient.preferredBranchId` for read/write consistency. Apply the same pattern as `getDentalPatient.ts`.

---

### EF-PAT-005 — P1: Audit READ event missing for safety floor, statement, and list handlers

**Severity:** P1 — Compliance gap  
**Criterion:** MODULE_SPEC §17 Observability — GET patient profile handlers must emit AUDIT READ events.

**Files missing `logAuditEvent`:**
- `identity/getDentalPatientSafetyFloor.ts` — no audit event
- `identity/getDentalPatientStatement.ts` — no audit event
- `identity/listDentalPatients.ts` — no audit event (bulk patient list)

**Note:** `getDentalPatient.ts` correctly emits `patient.view` audit event. The other GET handlers that expose PHI do not.

**Fix:** Add `logAuditEvent` calls with `action: 'patient.safety-floor.view'`, `action: 'patient.statement.view'`, `action: 'patient.list'` respectively.

---

### EF-PAT-006 — P1: `listDentalPatients` expands branchId to whole org — breaks AC-PAT-004 intent

**Severity:** P1 — Branch isolation weakened  
**File:** `identity/listDentalPatients.ts` lines 40–48

```ts
if (q['branchId']) {
  const branch = await branchRepo.findOneById(q['branchId']);
  if (branch?.organizationId) {
    const orgBranches = await branchRepo.listByOrg(branch.organizationId);
    filters['branchIds'] = orgBranches.map(b => b.id);
  }
}
```

When a `branchId` is supplied, the filter silently expands to **all branches in the org**. This means staff from Branch A who passes `branchId=BranchA` receives patients from Branch B, C, etc. in the same org. AC-PAT-004 requires search to return only Branch A patients.

**Fix:** Remove the org-level expansion. If cross-branch org-level visibility is a product requirement, it must be gated behind an explicit `scope=org` param and a higher-privilege role check.

---

## P2 Findings (Fix within sprint)

### EF-PAT-007 — P2: `updateDentalPatient` uses `assertBranchRole` but `addFollowUpNote` uses `assertBranchAccess` — inconsistent write authorization

**Severity:** P2 — Inconsistent security posture  
**Files:**
- `identity/updateDentalPatient.ts` — uses `assertBranchRole([dentist_owner, dentist_associate, hygienist, staff_full])`
- `engagement/addFollowUpNote.ts` — uses `assertBranchAccess` (any member)
- `engagement/followUpNotes.ts` (addFollowUpNote export) — uses `assertBranchAccess`

Adding a follow-up note is a write operation but has weaker role enforcement than updating the patient record. Roles with read-only access (e.g. `staff_scheduling`) could add notes.

**Fix:** Use `assertBranchRole` consistently for all write operations. Align follow-up note creation to at least `staff_full` or higher.

---

### EF-PAT-008 — P2: Duplicate handler implementations — `addFollowUpNote` and `listFollowUpNotes` exist in both `followUpNotes.ts` and standalone files

**Severity:** P2 — Maintenance drift risk  
**Files:**
- `engagement/followUpNotes.ts` — exports both `listFollowUpNotes` and `addFollowUpNote`
- `engagement/addFollowUpNote.ts` — standalone re-implementation of addFollowUpNote (different import, same logic)
- `engagement/listFollowUpNotes.ts` — standalone re-implementation of listFollowUpNotes

The test file imports from `followUpNotes.ts` while the OpenAPI router codegen may use the standalone files. These can diverge. The standalone `addFollowUpNote.ts` runs two separate `db.update` calls instead of one (follows different pattern from `followUpNotes.ts`'s single update).

**Fix:** Delete the standalone files or make them thin re-exports of the canonical implementations in `followUpNotes.ts`.

---

## P3 Findings (Track / low priority)

### EF-PAT-009 — P3: `updateDentalPatient` allows direct `status: 'archived'` write bypassing archive endpoint EC1 guard

**Severity:** P3 — Guard bypass (low severity, already mitigated by archive endpoint)  
**File:** `identity/updateDentalPatient.ts` lines 46–49

The PATCH endpoint accepts `status: 'archived'` in the body and applies it directly, bypassing the `archiveDentalPatient` handler which checks `hasActivePaymentPlan` (EC1 guard). A caller can archive a patient with an active payment plan via PATCH without triggering EC1.

**Fix:** Either reject `status: 'archived'` in PATCH body (redirect callers to dedicated archive endpoint), or replicate the EC1 check in `updateDentalPatient`.

---

## Per-Subdirectory Assessment

### `identity/` (18 files)

| File | assertBranchAccess | Branch-scoped | PHI Logs | Audit READ | Test |
|------|-------------------|---------------|----------|------------|------|
| createDentalPatient.ts | ✅ (line 44) | ✅ branchId required | ✅ clean | N/A write | ✅ |
| listDentalPatients.ts | ✅ (line 34) | ⚠️ P1 expands to org | ✅ clean | ❌ missing | ✅ |
| getDentalPatient.ts | ✅ (line 38) | ✅ | ✅ clean | ✅ patient.view | ✅ |
| updateDentalPatient.ts | ✅ assertBranchRole | ✅ | ✅ clean | N/A write | ✅ |
| archiveDentalPatient.ts | ✅ (line 31) | ✅ | ✅ clean | N/A write | ✅ |
| bulkArchiveDentalPatients.ts | ✅ (line 39) | ✅ | ✅ clean | N/A write | ✅ |
| restoreDentalPatient.ts | ✅ (line 31) | ✅ | ✅ clean | N/A write | ✅ |
| getDentalPatientSafetyFloor.ts | ✅ (line 37) | ✅ | ✅ clean | ❌ missing | ✅ |
| getDentalPatientStatement.ts | ✅ (line 36) | ✅ | ✅ clean | ❌ missing | ✅ |
| exportDentalPatients.ts | ✅ (line 55) | ✅ branchId required | ✅ clean | N/A | ✅ |
| importPatients.ts | ✅ assertBranchRole | ✅ branchId required | ✅ clean | N/A write | ✅ |
| initializeDentition.ts | ✅ assertBranchRole (visit) | ✅ via visit | ✅ clean | N/A write | — |
| listPatientVisits.ts | ⚠️ conditional | ❌ P0 optional branchId | ✅ clean | N/A | ✅ |
| listPatientConditions.ts | ⚠️ conditional | ❌ P0 optional branchId | ✅ clean | N/A | ✅ |

### `alerts/` (3 files)

| File | assertBranchAccess | Archived check | Test |
|------|-------------------|----------------|------|
| createDentalAlert.ts | ❌ none | ❌ none | ✅ |
| listDentalAlerts.ts | ❌ none | N/A read | ✅ |
| updateDentalAlert.ts | ❌ none | ❌ none | ✅ |

### `contacts/` (4 files)

| File | assertBranchAccess | Archived check | Test |
|------|-------------------|----------------|------|
| createPatientContact.ts | ❌ none | ❌ none | ✅ |
| listPatientContacts.ts | ❌ none | N/A read | ✅ |
| updatePatientContact.ts | ❌ none | ❌ none | ✅ |
| deletePatientContact.ts | ❌ none | ❌ none | ✅ |

### `insurance/` (7 files)

| File | assertBranchAccess | Archived check | Test |
|------|-------------------|----------------|------|
| createInsuranceProfile.ts | ❌ none | ❌ none | ✅ |
| listPatientInsuranceProfiles.ts | ❌ none | N/A read | ✅ |
| updateInsuranceProfile.ts | ❌ none (pattern-inferred) | ❌ none | ✅ |
| createClaimDraft.ts | ❌ none (pattern-inferred) | ❌ none | ✅ |
| listPatientClaims.ts | ❌ none (pattern-inferred) | N/A read | ✅ |
| updateClaimStatus.ts | ❌ none (pattern-inferred) | ❌ none | ✅ |
| getClaimReadiness.ts | ❌ none (pattern-inferred) | N/A read | ✅ |

### `recalls/` (3 files)

| File | assertBranchAccess | Archived check | Test |
|------|-------------------|----------------|------|
| createRecall.ts | ❌ none | ❌ none | ✅ |
| listPatientRecalls.ts | ❌ none | N/A read | ✅ |
| updateRecall.ts | ❌ none | ❌ none | ✅ |

### `engagement/` (6 files)

| File | assertBranchAccess | Archived check | Test |
|------|-------------------|----------------|------|
| addFollowUpNote.ts | ✅ assertBranchAccess | ❌ none | ✅ |
| followUpNotes.ts | ✅ assertBranchAccess | ❌ none | ✅ |
| listFollowUpNotes.ts | ✅ assertBranchAccess | N/A read | ✅ |
| createTask.ts | ❌ none | ❌ none | ✅ |
| listPatientTasks.ts | ❌ none | N/A read | ✅ |
| updateTask.ts | ❌ none | ❌ none | ✅ |

### `sync/` (3 files)

| File | assertBranchAccess | Notes |
|------|-------------------|-------|
| createSyncLog.ts | ❌ none | branchId is optional field, no access check |
| listSyncLogs.ts | ❌ none | Returns ALL sync logs for any authenticated user |
| updateSyncLog.ts | ❌ none | No patient or branch check |

### `treatment-plans/` (6 files)

| File | assertBranchAccess | Archived check | Test |
|------|-------------------|----------------|------|
| createTreatmentPlan.ts | ❌ none | ❌ none | ✅ |
| listPatientTreatmentPlans.ts | ❌ none | N/A read | ✅ |
| updateTreatmentPlan.ts | ❌ none | ❌ none | ✅ |
| acceptTreatmentPlan.ts | re-export to dental-visit | — | ✅ |
| getTreatmentPlan.ts | re-export to dental-visit | — | — |
| getTreatmentPlanVersion.ts | re-export to dental-visit | — | — |

### `repos/` (12 files)

Schema and repository files — no handler logic. No branch checks needed at this layer.

---

## Critical Acceptance Criteria Assessment

| AC | Criterion | Status | Finding |
|----|-----------|--------|---------|
| AC-PAT-001 | Registration requires consent | ❌ PARTIAL | EF-PAT-002: throws 400 not 422, no CONSENT_REQUIRED code |
| AC-PAT-002 | Archived patient is read-only | ❌ FAIL | EF-PAT-001: No archived write-block in 15+ write handlers |
| AC-PAT-003 | Safety floor in-memory aggregation | ✅ PASS | Single DB query, in-memory filter/split |
| AC-PAT-004 | Search is branch-scoped | ❌ PARTIAL | EF-PAT-003 (optional branchId on visits/conditions), EF-PAT-006 (org-expansion on list) |

---

## Safety Floor Assessment (AC-PAT-003)

`getDentalPatientSafetyFloor.ts` correctly implements in-memory aggregation:
- One DB query: `medicalHistoryEntries` where `patientId = ?` AND `active = true`
- In-memory `.filter()` splits into `allergies`, `medications`, `conditions`
- No extra per-field DB queries
- **AC-PAT-003: PASS**

---

## PHI Protection Assessment

No PHI in log statements found across the module. All log calls use structural IDs only:
- `patientId`, `personId`, `actorId`, `alertId`, `contactId`, etc.
- No `firstName`, `lastName`, `dateOfBirth`, `email`, `phone` logged
- **PHI log risk: 0**

---

## Service Layer Assessment

The module does not use a formal service layer. Handlers directly instantiate repositories (`new PatientRepository(db, logger)`) or call facade functions. This is consistent with the module's existing pattern (PARTIAL service layer noted in prior audit baseline). No new regressions vs. run-5 baseline.

---

## Test Coverage Assessment

All major handler families have test files:
- `dental-patient.test.ts` — FR2.1, FR2.2, FR2.4, FR2.5, FR2.7, FR2.8, FR2.9, FR2.10, FR2.12, FR2.13, FR2.15, FR2.16, FR2.17, FR2.18, FR2.21
- `dental-patient-alerts.test.ts` — alerts CRUD
- `dental-patient-contacts.test.ts` — contacts CRUD
- `dental-patient-insurance.test.ts` — insurance profiles
- `dental-patient-coverage.test.ts` — coverage/claims
- `dental-patient-recall.test.ts` — recalls
- `dental-patient-records.test.ts` — listPatientVisits, listPatientConditions
- `dental-patient-sync.test.ts` — sync logs
- `dental-patient-tasks.test.ts` — tasks
- `dental-patient-treatment-plan.test.ts` — treatment plans
- `dental-patient.bulk-import.test.ts` — importPatients
- `consent.fsm.property.test.ts` — consent FSM property tests
- `identity/createDentalPatient.test.ts` — dedicated create handler tests

**Missing test coverage:**
- `initializeDentition.ts` — no dedicated test file found
- Branch-scope isolation tests (cross-branch query returns empty) absent for all sub-handlers
- Archived patient write-block not tested anywhere (AC-PAT-002 has zero test coverage)

---

## Recommended Fix Order

1. **EF-PAT-001** (P0) — Add `assertPatientNotArchived` guard. One shared function, call in ~15 write handlers.
2. **EF-PAT-002** (P0) — Change consent error to `BusinessLogicError('...', 'CONSENT_REQUIRED')` → 422.
3. **EF-PAT-003** (P0) — Make `branchId` required in `listPatientVisits` and `listPatientConditions`.
4. **EF-PAT-004** (P1) — Add `assertBranchAccess` after `getPatientForDentalPatient` in all sub-handlers.
5. **EF-PAT-005** (P1) — Add `logAuditEvent` to `getDentalPatientSafetyFloor`, `getDentalPatientStatement`, `listDentalPatients`.
6. **EF-PAT-006** (P1) — Remove org-level branchId expansion from `listDentalPatients`.
7. **EF-PAT-007** (P2) — Align `addFollowUpNote` to use `assertBranchRole` not `assertBranchAccess`.
8. **EF-PAT-008** (P2) — Deduplicate follow-up note handlers.
9. **EF-PAT-009** (P3) — Block or guard `status: 'archived'` in PATCH body.
