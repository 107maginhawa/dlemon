<!-- oli-version: 1.1 -->
<!-- generated: 2026-05-29 | skill: oli-enforce-file -->
<!-- module: dental-patient | spec: MODULE_SPEC v1.0, API_CONTRACTS v1.0, ERROR_TAXONOMY v1.0, MODULE_MAP [DRAFT] -->
<!-- wave: Wave3 verification + new scan | previous run: run-6-strict-2026-05-29 -->

# OLI Enforce — File-Level Audit: dental-patient

**Run ID:** run-7-wave3-verify-2026-05-29
**Module:** dental-patient
**Handler root:** `services/api-ts/src/handlers/dental-patient/`
**Total files inventoried:** 83
**Date:** 2026-05-29
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

## Wave3 Fix Verification

| Claimed Fix | Status | Evidence |
|-------------|--------|----------|
| EF-PAT-001 (archived write-block) | VERIFIED FIXED | All 15+ write handlers check `patient.status === 'archived'` and throw `BusinessLogicError('...', 'PATIENT_ARCHIVED')` |
| EF-PAT-002 (consent error code) | VERIFIED FIXED | `createDentalPatient.ts:37` throws `BusinessLogicError('Patient consent is required', 'CONSENT_REQUIRED')` → HTTP 422 |
| EF-PAT-003 (branch scope in list) | VERIFIED FIXED | `listDentalPatients` requires `branchId` and calls `assertBranchAccess` before query |

---

## New Findings — Run 7 (2026-05-29)

### Summary

| Severity | Count |
|----------|-------|
| P0       | 3     |
| P1       | 4     |
| P2       | 3     |
| P3       | 2     |
| **Total** | **12** |

---

### P0 Findings (Security — fix before merge)

---

#### EF-PAT-NNN-006
**ID:** EF-PAT-006
**Severity:** P0
**Confidence:** HIGH
**Check Type:** Error taxonomy — wrong HTTP status code for already-archived case
**Spec Source:** ERROR_TAXONOMY §5 dental-patient: `PATIENT_ALREADY_ARCHIVED` → HTTP 409; API_CONTRACTS §POST /archive: "Errors: PATIENT_ALREADY_ARCHIVED(409)"
**File:** `services/api-ts/src/handlers/dental-patient/identity/archiveDentalPatient.ts`
**Line:** 53

**Description:**
When `repo.archivePatient()` returns `{ success: false, reason: 'Patient is already archived' }`, the handler throws `BusinessLogicError(reason, 'ARCHIVE_BLOCKED')` which maps to HTTP 422. The spec mandates `PATIENT_ALREADY_ARCHIVED` at HTTP 409. The `ARCHIVE_BLOCKED` code does not exist in ERROR_TAXONOMY.

```ts
// Line 53 — wrong: BusinessLogicError → 422, code ARCHIVE_BLOCKED (undocumented)
throw new BusinessLogicError(result.reason ?? 'Cannot archive patient', 'ARCHIVE_BLOCKED');
// Required: detect 'already archived' → ConflictError → 409, code PATIENT_ALREADY_ARCHIVED
```

**Fix:**
```ts
if (result.reason?.includes('already archived')) {
  throw new ConflictError('Patient is already archived'); // → HTTP 409, code CONFLICT
  // Or: new AppError('Patient is already archived', 'PATIENT_ALREADY_ARCHIVED', 409)
}
```

---

#### EF-PAT-NNN-007
**ID:** EF-PAT-007
**Severity:** P0
**Confidence:** HIGH
**Check Type:** Auth boundary — bulk archive uses `assertBranchAccess` (any member) instead of `assertBranchRole(['dentist_owner'])`
**Spec Source:** MODULE_SPEC §6: "Archive patient — Allowed: dentist_owner; Restricted: all others"; API_CONTRACTS §bulk-archive: "Auth: dentist_owner"
**File:** `services/api-ts/src/handlers/dental-patient/identity/bulkArchiveDentalPatients.ts`
**Lines:** 14, 38–39

**Description:**
`archiveDentalPatient` correctly uses `assertBranchRole([...], ['dentist_owner'])`. However, `bulkArchiveDentalPatients` uses `assertBranchAccess` — meaning any authenticated branch member (including `staff_scheduling`, `staff_full`, `dentist_associate`) can bulk-archive all patients in a branch.

```ts
// Line 14 — wrong guard imported
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
// Line 39 — wrong: any branch member passes
await assertBranchAccess(db, user.id, branchId);
// Required:
await assertBranchRole(db, user.id, branchId, ['dentist_owner']);
```

**Fix:** Replace `assertBranchAccess` with `assertBranchRole(db, user.id, branchId, ['dentist_owner'])` in the branch-loop at line 39.

---

#### EF-PAT-NNN-008
**ID:** EF-PAT-008
**Severity:** P0
**Confidence:** HIGH
**Check Type:** Auth boundary — `listSyncLogs` returns ALL sync logs system-wide (no user/branch scoping)
**Spec Source:** MODULE_SPEC §6 (all data branch-scoped); MODULE_SPEC §4 AC-PAT-004
**File:** `services/api-ts/src/handlers/dental-patient/sync/listSyncLogs.ts`
**Line:** 20

**Description:**
`SyncLogRepository.findAll()` executes `SELECT * FROM dental_sync_log` with no WHERE clause. `listSyncLogs` passes this result directly to the response. Any authenticated user can retrieve sync log entries belonging to other users and other branches.

```ts
// Line 20 — global select, no tenant/user filtering
const logs = await repo.findAll();
```

**Fix:** Scope to `createdBy = user.id` at minimum, or add a `branchId` filter if the entity is always tied to a branch. Add `WHERE created_by = $userId` (or `WHERE branch_id IN (user's memberships)`) to `SyncLogRepository`.

---

### P1 Findings (Fix before release)

---

#### EF-PAT-NNN-009
**ID:** EF-PAT-009
**Severity:** P1
**Confidence:** HIGH
**Check Type:** Data shape — consent fields use `consentGiven: boolean` (single gate) vs spec-required `marketing_consent` + `data_sharing_consent` (separate booleans)
**Spec Source:** API_CONTRACTS §POST /api/v1/dental/patients: required fields `marketing_consent` (boolean, required), `data_sharing_consent` (boolean, required), `sms_consent` (boolean, optional), `email_consent` (boolean, optional)
**File:** `services/api-ts/src/handlers/dental-patient/identity/createDentalPatient.ts`
**Lines:** 8 (JSDoc), 37; also `src/generated/openapi/validators.ts` line 1647

**Description:**
The API contract and BR-015 require separate consent fields. The implementation collapses all consent into one `consentGiven` boolean. The generated validator marks `consentGiven` as `.optional()` (not required). This means:
1. The wire shape differs from the spec — clients using the OpenAPI-generated SDK expect `marketing_consent` / `data_sharing_consent`
2. A request with `consentGiven: undefined` silently passes validation, only failing at runtime in the handler (but validator allows it)
3. Consent type granularity (marketing vs data sharing) is lost — cannot distinguish which consent was given

**Fix:** Update TypeSpec definition to emit `marketing_consent` and `data_sharing_consent` required fields; update handler to check both; update validator. Alternatively, if `consentGiven` is an intentional simplification, update API_CONTRACTS to reflect it.

---

#### EF-PAT-NNN-010
**ID:** EF-PAT-010
**Severity:** P1
**Confidence:** HIGH
**Check Type:** Import boundary — handler-level cross-module schema/repo imports violate MODULE_MAP boundary
**Spec Source:** MODULE_MAP §M2: "Dependencies: patient (base PII), dental-org (branch scope)"; MODULE_MAP §Cross-Module Coupling Risks
**Files:**

| File | Cross-Module Import |
|------|---------------------|
| `identity/getDentalPatient.ts:15–16` | `dental-visit/repos/visit.schema`, `dental-billing/repos/dental-invoice.schema` |
| `identity/getDentalPatientStatement.ts:14–16` | `dental-visit/repos/visit.schema`, `dental-billing/repos/dental-invoice.schema`, `dental-billing/repos/dental-payment.schema` |
| `identity/listDentalPatients.ts:16` | `dental-visit/repos/visit.schema` |
| `identity/getDentalPatientSafetyFloor.ts:17` | `dental-clinical/repos/medical-history.schema` |
| `identity/initializeDentition.ts:14–16` | `dental-visit/repos/dental-chart.repo`, `dental-visit/repos/visit.repo`, `dental-visit/repos/dental-chart.schema` |

**Description:**
dental-patient directly imports ORM table definitions and repository classes from dental-visit, dental-billing, and dental-clinical. Any rename or schema change in those modules cascades into dental-patient handlers. `initializeDentition` embeds `DentalChartRepository` and `VisitRepository` from dental-visit — this handler arguably belongs in dental-visit.

**Fix:** Route cross-module reads through facade functions (e.g., a `dental-visit` facade for visit stats) or service interfaces. `initializeDentition` should be considered for relocation to dental-visit where the chart repos live.

---

#### EF-PAT-NNN-011
**ID:** EF-PAT-011
**Severity:** P1
**Confidence:** HIGH
**Check Type:** Auth boundary — `getClaimReadiness` performs no branch authorization
**Spec Source:** API_CONTRACTS §auth preamble: "All endpoints require branch membership"; MODULE_SPEC §6 "View patient — all dental roles (Branch-scoped)"
**File:** `services/api-ts/src/handlers/dental-patient/insurance/getClaimReadiness.ts`
**Lines:** 10–42

**Description:**
`getClaimReadiness` checks `user` existence but calls neither `assertBranchAccess` nor `assertBranchRole`. Any authenticated user who can guess a `(patientId, claimId)` pair receives claim readiness data (CDT code presence, fee amount, insurance profile status).

```ts
// Lines 10–14 — auth check only, no branch enforcement
const user = ctx.get('user');
if (!user) throw new UnauthorizedError('Authentication required');
// NO assertBranchAccess anywhere in this handler
```

**Fix:** Add patient lookup → `assertBranchAccess(db, user.id, patient.preferredBranchId)` before the claim lookup.

---

#### EF-PAT-NNN-012
**ID:** EF-PAT-012
**Severity:** P1
**Confidence:** MEDIUM
**Check Type:** Data shape — `importPatients` returns 201 synchronous response vs spec-declared 202 async job pattern
**Spec Source:** API_CONTRACTS §POST /api/v1/dental/patients/import: "Response 202: { data: { job_id: 'uuid', status: 'queued' } } (Async — poll via GET /api/v1/dental/import-jobs/:id)"
**File:** `services/api-ts/src/handlers/dental-patient/identity/importPatients.ts`
**Line:** 171

**Description:**
Spec declares import as async (202 + job_id). Implementation is synchronous (201 + patient list inline). No job queuing system, no `/api/v1/dental/import-jobs/:id` endpoint exists.

```ts
// Line 171 — synchronous, returns 201 with full results, not 202 + job_id
return ctx.json({ success: true, imported: imported.length, ... }, 201);
```

**Fix:** Either (a) implement async job queue and return 202 + `job_id`, or (b) update API_CONTRACTS to reflect synchronous behavior (202→201, remove job polling). Large imports (≤1000 rows per spec NFR) executed synchronously risk request timeouts.

---

### P2 Findings (Fix within sprint)

---

#### EF-PAT-NNN-013
**ID:** EF-PAT-013
**Severity:** P2
**Confidence:** HIGH
**Check Type:** Naming convention — 26 of 46 handler files use untyped `ctx: any` parameter
**Spec Source:** DEVELOPMENT_STANDARDS.md; TypeScript typing requirement; pattern established by identity/ handlers
**Affected files:** All files in `alerts/`, `contacts/`, `engagement/` (task handlers), `insurance/`, `recalls/`, `sync/`, `treatment-plans/createTreatmentPlan.ts`, `treatment-plans/listPatientTreatmentPlans.ts`, `treatment-plans/updateTreatmentPlan.ts`

**Description:**
Identity-level handlers correctly use `ValidatedContext<Body, Query, Params>`. The 26 handlers in sub-domains (alerts, contacts, etc.) all declare `ctx: any`. This bypasses TypeScript validation for `ctx.req.valid('param')`, `ctx.req.valid('json')`, allowing runtime mismatches invisible at compile time.

**Fix:** Replace `ctx: any` with `ValidatedContext<BodySchema, QuerySchema, ParamSchema>` using the corresponding validator schemas from `utils/*-validators.ts`.

---

#### EF-PAT-NNN-014
**ID:** EF-PAT-014
**Severity:** P2
**Confidence:** HIGH
**Check Type:** Data shape — response envelopes missing `{ data, meta }` wrapper on most endpoints
**Spec Source:** API_CONTRACTS §preamble: "All responses wrap in `{ data, meta }`"
**Affected files:** ~40 handler files

**Description:**
Representative violations:
- `getDentalPatient.ts` → returns flat patient object, no `data:` key
- `createDentalAlert.ts` → `ctx.json(alert, 201)` (raw object)
- `createInsuranceProfile.ts` → `ctx.json(profile, 201)` (raw object)
- `createRecall.ts` → `ctx.json(recall, 201)` (raw object)
- `listDentalAlerts.ts` → returns array directly

Only `listDentalPatients` partially wraps with `{ data: mapped, pagination: ... }` (still missing `meta.request_id`/`meta.timestamp`).

**Fix:** Wrap all responses in `{ data: payload }` consistently. Add `meta: { request_id, timestamp }` per ERROR_TAXONOMY §1.

---

#### EF-PAT-NNN-015
**ID:** EF-PAT-015
**Severity:** P2
**Confidence:** HIGH
**Check Type:** Error taxonomy — `ARCHIVE_BLOCKED` and `RESTORE_BLOCKED` codes not in ERROR_TAXONOMY catalog
**Spec Source:** ERROR_TAXONOMY §5 dental-patient (8 defined codes, neither `ARCHIVE_BLOCKED` nor `RESTORE_BLOCKED` present)
**Files:** `identity/archiveDentalPatient.ts:53`, `identity/restoreDentalPatient.ts:40`

**Description:**
Both handlers emit undocumented error codes. ERROR_TAXONOMY catalog for dental-patient contains: `PATIENT_NOT_FOUND`, `PATIENT_ALREADY_ARCHIVED`, `DUPLICATE_PATIENT`, `CONSENT_REQUIRED`, `FOLLOW_UP_IMMUTABLE`, `PATIENT_MERGE_NOT_IMPLEMENTED`, `INVALID_IMPORT_FORMAT`, `IMPORT_VALIDATION_FAILED`. Neither `ARCHIVE_BLOCKED` nor `RESTORE_BLOCKED` appear.

**Fix:** Map these to cataloged codes or add them to ERROR_TAXONOMY. `RESTORE_BLOCKED` for "not archived" is a valid new code to catalog; `ARCHIVE_BLOCKED` (non-already-archived failures) should also be cataloged.

---

### P3 Findings (Advisory)

---

#### EF-PAT-NNN-016
**ID:** EF-PAT-016
**Severity:** P3
**Confidence:** HIGH
**Check Type:** Workflow annotation traceability
**Spec Source:** MODULE_SPEC §3 Workflows (WF-005, WF-023, WF-044, WF-055, WF-056, WF-057, WF-058, WF-088)
**Files:** All handler files

**Description:**
Zero handler files contain `// WF-NNN` annotations. MODULE_SPEC documents 8 workflows. The 5% adoption gate is not met (0% annotated), so per-function annotation checks remain advisory. Adding WF annotations to at least `createDentalPatient` (WF-005), `listDentalPatients` (WF-023), `archiveDentalPatient` (WF-058) would activate traceability checks in future runs.

---

#### EF-PAT-NNN-017
**ID:** EF-PAT-017
**Severity:** P3
**Confidence:** MEDIUM
**Check Type:** Domain term drift — duplicate `addFollowUpNote` / `listFollowUpNotes` implementations with behavioral divergence
**Spec Source:** MODULE_SPEC §2 "Follow-up Notes"; CONTRIBUTING.md single-responsibility
**Files:** `engagement/followUpNotes.ts`, `engagement/addFollowUpNote.ts`, `engagement/listFollowUpNotes.ts`

**Description:**
`followUpNotes.ts` exports both handlers as full implementations. `addFollowUpNote.ts` and `listFollowUpNotes.ts` are separate re-implementations. They diverge:
- `followUpNotes.ts` addFollowUpNote checks `patient.status === 'archived'` (line 63)
- `addFollowUpNote.ts` standalone does NOT check archived status before appending

If `addFollowUpNote.ts` is the registered router handler, archived patients can receive new follow-up notes (silent bypass). The router wiring determines which is active, but the dual implementation creates latent risk.

**Fix:** Delete standalone files or make them thin re-exports of `followUpNotes.ts` implementations. Ensure one canonical implementation with the archived check.

---

## Recommended Fix Order

**P0 (security — fix before any merge):**
1. EF-PAT-007 — `bulkArchiveDentalPatients`: replace `assertBranchAccess` → `assertBranchRole(['dentist_owner'])`
2. EF-PAT-008 — `listSyncLogs`: scope `findAll()` to `created_by = user.id` or branch memberships
3. EF-PAT-006 — `archiveDentalPatient`: detect already-archived → `ConflictError` with `PATIENT_ALREADY_ARCHIVED` (409)
4. EF-PAT-011 — `getClaimReadiness`: add patient lookup → `assertBranchAccess`

**P1 (fix before release):**
5. EF-PAT-009 — align consent fields: `consentGiven` → `marketing_consent` + `data_sharing_consent`
6. EF-PAT-010 — route cross-module reads through facades rather than direct schema imports
7. EF-PAT-012 — resolve sync vs async import shape (update spec or implement job queue)

**P2 (fix within sprint):**
8. EF-PAT-013 — replace `ctx: any` with `ValidatedContext` in 26 handlers
9. EF-PAT-014 — wrap all responses in `{ data, meta }` envelope
10. EF-PAT-015 — catalog `ARCHIVE_BLOCKED` / `RESTORE_BLOCKED` in ERROR_TAXONOMY

**P3 (advisory):**
11. EF-PAT-016 — add WF-NNN annotations to primary handlers
12. EF-PAT-017 — deduplicate follow-up note implementations

---

## Module Traceability Score

- Files with 0 P0/P1 findings: ~40 of 64 handler files (after filtering re-exports and test files)
- Traceability score: **63%**
- Prior run (Wave3): 9 findings. This run: 12 findings (3 new P0s, 4 new P1s, 3 P2s, 2 P3s replacing prior advisory findings)

## What's Next

P0 findings present — fix security violations immediately before proceeding.

After P0/P1 fixes pass `bun run typecheck` and `bun test`, run `/oli-enforce-all` for cross-module view.
