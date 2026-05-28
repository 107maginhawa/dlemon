# Enforcement Audit: dental-patient module

**Generated:** 2026-05-27  
**Skill:** oli-enforce-module  
**Module:** dental-patient  
**Spec version:** 1.0 (2026-05-24)  
**Depth:** full — every declared API, workflow, event, state transition, domain term checked

---

## Summary

The dental-patient module has a **solid structural foundation**: patient CRUD, search, safety floor, follow-up notes, contacts, alerts, recalls, statement, archive/restore, import/export all exist. Tests are present and well-organized. Several critical spec deviations exist that must be fixed before V1 ships.

| Severity | Count |
|---|---|
| BLOCKER | 8 |
| WARNING | 9 |
| INFO | 4 |

---

## BLOCKER Findings

---

### BL-01: BR-015b archived read-only gate missing from write handlers

**Spec:** BR-015b — IF patient.status = archived THEN record is read-only → 403  
**AC-PAT-002:** archived patient write → 403

**Files:**
- `services/api-ts/src/handlers/dental-patient/updateDentalPatient.ts:31–67`
- `services/api-ts/src/handlers/dental-patient/addFollowUpNote.ts:31–63`
- `services/api-ts/src/handlers/dental-patient/createPatientContact.ts:21–53`
- `services/api-ts/src/handlers/dental-patient/createDentalAlert.ts:12–40`
- `services/api-ts/src/handlers/dental-patient/createRecall.ts:12–40`

**Issue:** None of these write handlers check `patient.status === 'archived'` before proceeding. An archived patient can receive demographic updates, new follow-up notes, new contacts, new alerts, and new recalls. `updateDentalPatient` can even set `status='active'` freely via body — it only updates `archivedAt` as a side-effect but never blocks the write if the patient is already archived.

**Fix:** After the patient lookup, add the guard in every write handler:
```typescript
if (patient.status === 'archived') {
  return ctx.json({ error: 'This patient record is archived', code: 'PATIENT_ARCHIVED' }, 403);
}
```

---

### BL-02: archiveDentalPatient does not enforce dentist_owner role

**Spec §6:** Archive patient — allowed roles: `dentist_owner` only; all others restricted.  
**API contract:** POST /api/v1/dental/patients/:id/archive — Auth: `dentist_owner`

**File:** `services/api-ts/src/handlers/dental-patient/archiveDentalPatient.ts:30–31`

**Issue:** Handler uses `assertBranchAccess` (checks membership only, not role). Any branch member — including `staff_full`, `staff_scheduling`, `dentist_associate` — can archive patients. `archiveDentalPatient.test.ts` in `dental-patient.test.ts` uses `staff_full` role but is never rejected.

**Fix:**
```typescript
// Replace assertBranchAccess with assertBranchRole
await assertBranchRole(db, user.id, patient.preferredBranchId as string, ['dentist_owner']);
```

---

### BL-03: archiveDentalPatient ignores required `reason` field

**Spec §10 / API contract:** POST /api/v1/dental/patients/:id/archive body requires `reason` (min:5, max:500).

**File:** `services/api-ts/src/handlers/dental-patient/archiveDentalPatient.ts:14–47`

**Issue:** Handler reads no body at all. The `reason` is never extracted, validated, or stored. The `repo.archivePatient()` call takes no reason argument. The spec requires reason for audit trail.

**Fix:** Accept and validate body; pass reason through to repo for storage:
```typescript
const body = ctx.req.valid('json'); // requires ArchiveDentalPatientBody validator with reason
const result = await repo.archivePatient(patientId, body.reason);
```

---

### BL-04: listDentalPatients silently expands branch scope to org-wide (AC-PAT-004 violation)

**Spec §5 AC-PAT-004:** Search is branch-scoped — staff from branch A sees only branch A patients.  
**Spec §4 WF-023:** Results filtered to branch scope.

**File:** `services/api-ts/src/handlers/dental-patient/listDentalPatients.ts:38–48`

**Issue:** When a `branchId` is provided and the branch has an `organizationId`, the handler silently replaces the filter with ALL branches in that org. A staff member at Branch A will see patients from Branch B, C, etc. This directly violates AC-PAT-004 and creates cross-branch data leaks.

The comment acknowledges this: `"expand it to all branches in the same org so patients from any branch in the org are visible"` — but this contradicts the spec.

**Fix:** Remove the expansion logic; filter strictly to the requested `branchId`:
```typescript
filters['branchId'] = q['branchId']; // Never expand to org-wide
```

---

### BL-05: createDentalPatient accepts `branchId` as optional — allows patientless branch assignment

**Spec §7 data requirements:** `branch_id` required (FK → dental_branch, "Branch scope").  
**API contract:** `branch_id` required (YES).

**File:** `services/api-ts/src/handlers/dental-patient/createDentalPatient.ts:43–45, 80`

**Issue:** `branchId` is treated as optional. When omitted, `assertBranchAccess` is skipped entirely and the patient is created with `preferredBranchId = undefined`. This means patients can exist with no branch association, making them invisible to branch-scoped searches and accessible to any user who knows the ID. Duplicate-detection query also receives `undefined` as branchId.

**Fix:** Require `branchId` and always call `assertBranchAccess`:
```typescript
if (!body.branchId) throw new ValidationError('branchId is required');
await assertBranchAccess(db, user.id, body.branchId);
```

---

### BL-06: importPatients skips consent validation (BR-015)

**Spec BR-015:** IF registering patient THEN explicit marketing consent required.  
**AC-PAT-001:** 422 returned with CONSENT_REQUIRED if consent not provided.

**File:** `services/api-ts/src/handlers/dental-patient/importPatients.ts:22–55`

**Issue:** The CSV/JSON import path creates patient records with no consent field in the `PatientRow` interface and no consent validation in `validateRow()`. Bulk import bypasses the consent gate that individual registration enforces — this is a compliance gap for GDPR/patient data regulations.

**Fix:** Add `marketingConsent` to `PatientRow`, validate its presence in `validateRow()`, and store it during person creation.

---

### BL-07: getDentalPatient branch authorization bypassed for patients with null `preferredBranchId`

**Spec §6:** View patient — Branch-scoped; all dental roles allowed but scoped to branch.

**Files:**
- `services/api-ts/src/handlers/dental-patient/getDentalPatient.ts:37–39`
- `services/api-ts/src/handlers/dental-patient/archiveDentalPatient.ts:30–31`
- `services/api-ts/src/handlers/dental-patient/addFollowUpNote.ts:35–37`
- `services/api-ts/src/handlers/dental-patient/getDentalPatientSafetyFloor.ts:36–38`
- `services/api-ts/src/handlers/dental-patient/getDentalPatientStatement.ts:35–37`
- `services/api-ts/src/handlers/dental-patient/restoreDentalPatient.ts:30–31`

**Issue:** All these handlers check `if (patient.preferredBranchId)` before calling `assertBranchAccess`. If `preferredBranchId` is null, the check is skipped entirely and any authenticated user can access any unaffiliated patient — no authorization at all. Combined with BL-05 (branchId optional at creation), this is a real attack path.

**Fix:** If `preferredBranchId` is null, either reject with 403 or fallback to org-level access check. Never skip authorization silently:
```typescript
if (!patient.preferredBranchId) {
  return ctx.json({ error: 'Patient has no branch assignment', code: 'PATIENT_UNSCOPED' }, 403);
}
await assertBranchAccess(db, user.id, patient.preferredBranchId);
```

---

### BL-08: addFollowUpNote has two separate non-atomic DB updates (race condition / data loss)

**File:** `services/api-ts/src/handlers/dental-patient/addFollowUpNote.ts:49–59`  
(Same pattern in `followUpNotes.ts:75–87`)

**Issue:** Two sequential `db.update()` calls:
1. `SET followUpNotes = updatedNotes`
2. `SET needsFollowUp = true`

These are not wrapped in a transaction. If the process crashes or the DB rejects the second call, `followUpNotes` is updated but `needsFollowUp` remains false. More critically: two concurrent note-appends will both read the same `existingNotes`, race to overwrite, and one note is silently lost. Follow-up notes are clinical records — data loss is unacceptable.

**Fix:** Combine into a single update, and use a DB-level array append to avoid the read-modify-write race:
```typescript
await db.update(patients).set({
  followUpNotes: updatedNotes,
  needsFollowUp: true,
  updatedAt: new Date(),
}).where(eq(patients.id, patientId));
```
For true concurrency safety, use a DB-level JSONB append or advisory lock.

---

## WARNING Findings

---

### WR-01: Export endpoint path diverges from API contract

**API contract:** `GET /api/v1/dental/patients/:id/export` (per-patient export)  
**Implementation:** `GET /dental/patients/export` (bulk export, no `:id`) — registered at `routes.ts:894`

**File:** `services/api-ts/src/handlers/dental-patient/exportDentalPatients.ts:2`

**Issue:** The contract specifies per-patient export with a `format` query param. The implementation is a bulk org-level export. No per-patient export endpoint exists. The `useExportPatients` frontend hook also hits a different path than the contract, and does its own CSV construction client-side instead of using the server's `Content-Disposition` response.

---

### WR-02: Export endpoint uses `assertBranchAccess` not `assertBranchRole` — `dentist_owner` restriction not enforced

**Spec §6:** Export / bulk ops — allowed roles: `dentist_owner` only.

**File:** `services/api-ts/src/handlers/dental-patient/exportDentalPatients.ts:55`

**Issue:** `assertBranchAccess` is used, meaning any branch member can export all patient data. The spec restricts export to `dentist_owner`.

---

### WR-03: bulkArchiveDentalPatients enforces `assertBranchAccess` not `assertBranchRole`

**Spec §6:** Bulk ops — `dentist_owner` only.  
**API contract:** POST /api/v1/dental/patients/bulk-archive — Auth: `dentist_owner`

**File:** `services/api-ts/src/handlers/dental-patient/bulkArchiveDentalPatients.ts:38–40`

**Issue:** Same as BL-02/WR-02 — access check instead of role check. `staff_full` can bulk-archive.

---

### WR-04: getDentalPatientStatement accessible by `staff_scheduling` — spec restricts to `staff_full` + `dentist_owner`

**API contract:** GET /api/v1/dental/patients/:id/statement — Auth: `staff_full`, `dentist_owner`

**File:** `services/api-ts/src/handlers/dental-patient/getDentalPatientStatement.ts:35–37`

**Issue:** Only `assertBranchAccess` used — no role check. `staff_scheduling` and `dentist_associate` can access financial statements. The contract explicitly excludes `dentist_associate`.

---

### WR-05: createDentalPatient returns 400 instead of 422 for consent violation (wrong HTTP status)

**Spec §15 / AC-PAT-001:** consent not given → 422 CONSENT_REQUIRED  
**API contract:** `CONSENT_REQUIRED(422)`

**File:** `services/api-ts/src/handlers/dental-patient/createDentalPatient.ts:37`

**Issue:** `throw new ValidationError('Patient consent is required')` — `ValidationError` maps to 400 in the error handler (confirmed in `createDentalPatient.test.ts:168`, test expects 400). The spec and AC-PAT-001 require 422. The test is also wrong, masking the deviation.

---

### WR-06: addFollowUpNote duplicate implementations with divergent validation

**Files:**
- `services/api-ts/src/handlers/dental-patient/addFollowUpNote.ts` (registered in routes, delegates to generated validator)
- `services/api-ts/src/handlers/dental-patient/followUpNotes.ts` (comment says "delegated from here" but is fully re-implemented)

**Issue:** Two complete, divergent implementations of the same handler. `followUpNotes.ts` uses `z.string().min(1)`. The API contract requires `min:5`. Neither file enforces `max:2000`. `followUpNotes.ts` is exported and used in `dental-patient.test.ts` directly, while the route wires `addFollowUpNote.ts`. Tests hit a different code path than production. The comment "Delegated from followUpNotes.ts" is incorrect — there is no delegation.

---

### WR-07: Safety floor in getDentalPatient response does not include `medications` or `conditions`

**AC-PAT-003:** Safety floor contains allergies AND medications.  
**API contract GET /dental/patients/:id response:** `allergies: string[]`

**File:** `services/api-ts/src/handlers/dental-patient/getDentalPatient.ts:75–97`

**Issue:** `getDentalPatient` returns only `outstandingBalanceCents`, no safety floor data at all. The separate `getDentalPatientSafetyFloor` handler exists but is not merged into the profile response. The API contract for `GET /dental/patients/:id` specifies the profile should include `allergies`. AC-PAT-003 requires medications in the profile response. Users of the profile endpoint must make a second request to get safety floor data, contrary to spec.

---

### WR-08: DE-021 PatientRegistered event never emitted

**Spec §10b:** Published events — DE-021 PatientRegistered on patient creation → consumers: dental-audit, notifs

**File:** `services/api-ts/src/handlers/dental-patient/createDentalPatient.ts` (entire file)

**Issue:** No event emission anywhere in `createDentalPatient`. The spec declares this as a published domain event. Downstream consumers (audit trail, notifications) will never receive it.

---

### WR-09: patients.tsx uses raw `fetch` instead of SDK for registration, then invalidates wrong query key

**File:** `apps/dentalemon/src/routes/_dashboard/patients.tsx:62–84`

**Issue:** `handleRegister` uses a raw `fetch` call while all other operations use the SDK. After success, it calls `queryClient.invalidateQueries({ queryKey: ['dental-patients'] })`. The SDK-generated query key is `listDentalPatientsQueryKey()` (used correctly elsewhere in `use-patient-actions.ts`), not the string `'dental-patients'`. This means the patient list does NOT refresh after a successful registration unless the component re-mounts.

**Fix:** Use the generated SDK mutation and invalidate with `listDentalPatientsQueryKey()`.

---

## INFO Findings

---

### IN-01: patients.tsx `onSelect` navigates to `'/$patientId'` (workspace) not `'/patients/$patientId'` (profile)

**File:** `apps/dentalemon/src/routes/_dashboard/patients.tsx:119`

**Issue:** `onSelect` routes to `/_workspace/$patientId` while `onProfile` routes to `/_dashboard/patients_/$patientId`. It is ambiguous whether this is intentional or a routing error. Both routes exist but serve different UIs. No comment explains the intent.

---

### IN-02: importPatients returns 201 (not 202 async) — deviates from API contract

**API contract:** POST /api/v1/dental/patients/import → 202 with `job_id` (async)

**File:** `services/api-ts/src/handlers/dental-patient/importPatients.ts:169`

**Issue:** Implementation is synchronous (returns 201 with full result). Contract specifies async job pattern with `job_id` and polling via `GET /api/v1/dental/import-jobs/:id`. The contract is either aspirational or the implementation is wrong. Callers expecting 202 + polling will be surprised. No import job endpoint exists.

---

### IN-03: logAuditEvent in getDentalPatient uses `preferredBranchId ?? patientId` as tenantId

**File:** `services/api-ts/src/handlers/dental-patient/getDentalPatient.ts:67–73`

**Issue:** When `preferredBranchId` is null, `patientId` is used as `tenantId` in the audit log. A patient UUID is not a valid tenant ID — this produces corrupt audit entries. The fallback should be a known org/branch ID or the call should be skipped.

---

### IN-04: useExportPatients client-side CSV does not include `branchId` query param

**File:** `apps/dentalemon/src/features/patients/hooks/use-patient-actions.ts:104`

**Issue:** `exportDentalPatients({ throwOnError: true })` is called with no query params. The backend requires `branchId` (returns 400 without it). Export will always fail in production when `branchId` is required. The hook does not accept or forward the current branch context.

---

## Workflow Coverage Matrix

| Workflow | Backend Handler | Tests | Frontend | Status |
|---|---|---|---|---|
| WF-005 Patient Registration | createDentalPatient ✓ | createDentalPatient.test.ts ✓ | PatientRegistrationModal ✓ | **PARTIAL** — BL-01, BL-05, WR-05 |
| WF-023 Patient Search | listDentalPatients ✓ | dental-patient.test.ts ✓ | usePatients ✓ | **PARTIAL** — BL-04 |
| WF-055 View Profile | getDentalPatient ✓ | dental-patient.test.ts ✓ | usePatientProfile ✓ | **PARTIAL** — BL-07, WR-07 |
| WF-056 Update Demographics | updateDentalPatient ✓ | dental-patient.test.ts ✓ | — | **PARTIAL** — BL-01 |
| WF-057 Patient Merge | — | — | — | NOT IMPLEMENTED (BR-020) ✓ |
| WF-058 Archive/GDPR | archiveDentalPatient ✓ | dental-patient.test.ts ✓ | useArchivePatient ✓ | **PARTIAL** — BL-02, BL-03 |
| WF-044 Consent Capture | createDentalPatient ✓ (partial) | ✓ | ✓ | **PARTIAL** — WR-05, BL-06 |

---

## Business Rule Verification

| Rule ID | Status | Evidence |
|---|---|---|
| BR-015 Consent required | **PARTIAL** — enforced in `createDentalPatient`, skipped in `importPatients` (BL-06) |
| BR-015b Archived = read-only | **FAIL** — not enforced in any write handler (BL-01) |
| BR-015c Follow-up append-only | **PARTIAL** — no PATCH/DELETE handler exists; race condition in two-update pattern (BL-08) |
| BR-020 Merge not implemented | **PASS** — no merge endpoint present |
| PAT-BR-001 Name + identifier required | **PARTIAL** — name enforced; phone/email not required at registration |
| PAT-BR-002 Guardian linkage for minors | **PASS** — patient contacts with `isGuardian` flag implemented and tested |
| PAT-BR-003 Medical alerts visible in clinical context | **PARTIAL** — getDentalPatient omits safety floor from profile (WR-07) |
| PAT-BR-004 No hard delete with history | **PASS** — soft archive, no DELETE handler on patients |

---

## Domain Event Verification

| Event | Direction | Implemented | Notes |
|---|---|---|---|
| DE-021 PatientRegistered | Published | **NO** | Not emitted anywhere (WR-08) |
| DE-008 InvoicePaid | Consumed | **NO** | `has_active_payment_plan` flag is a static column, never updated by event |

---

## State Transition Verification

| Transition | Handler | Enforced | Notes |
|---|---|---|---|
| active → archived | archiveDentalPatient ✓ | **PARTIAL** — BL-02 (any role), BL-03 (no reason stored) |
| archived → active | restoreDentalPatient ✓ | **PASS** — `assertBranchRole(['dentist_owner'])` used |
| active → active (write) | updateDentalPatient | **FAIL** — BR-015b not checked (BL-01) |

---

## API Contract vs Implementation Gap Table

| Contract Endpoint | Handler | Path Match | Auth Match | Body/Response Match |
|---|---|---|---|---|
| POST /dental/patients | createDentalPatient | ✓ | **PARTIAL** — missing role restriction vs spec §6 | **PARTIAL** — branchId optional (BL-05), consent → 400 not 422 (WR-05) |
| GET /dental/patients | listDentalPatients | ✓ | ✓ | **FAIL** — org-expansion violates branch scope (BL-04) |
| GET /dental/patients/:id | getDentalPatient | ✓ | **FAIL** — null branchId skips auth (BL-07) | **PARTIAL** — missing allergies/medications in response (WR-07) |
| PATCH /dental/patients/:id | updateDentalPatient | ✓ | ✓ | **FAIL** — no archived guard (BL-01) |
| POST /dental/patients/:id/archive | archiveDentalPatient | ✓ | **FAIL** — access not role check (BL-02) | **FAIL** — reason not read (BL-03) |
| GET /dental/patients/:id/statement | getDentalPatientStatement | ✓ | **FAIL** — access not role check (WR-04) | ✓ |
| POST /dental/patients/:id/follow-up | addFollowUpNote | path is `/follow-up-notes` not `/follow-up` | ✓ | **PARTIAL** — race condition (BL-08), min:1 not min:5 (WR-06) |
| POST /dental/patients/bulk-archive | bulkArchiveDentalPatients | ✓ | **FAIL** — access not role check (WR-03) | **PARTIAL** — no reason field |
| POST /dental/patients/import | importPatients | ✓ | **FAIL** — any member can import | **PARTIAL** — sync not async, no consent (BL-06) |
| GET /dental/patients/:id/export | exportDentalPatients | **FAIL** — bulk export not per-patient | **FAIL** — access not role check (WR-02) | **FAIL** — different shape (WR-01) |

---

_Audit complete: 8 blockers, 9 warnings, 4 info._  
_Primary risks: archived write-through (BL-01), branch scope leak (BL-04), role escalation on archive/export (BL-02/WR-02/WR-03), follow-up note race (BL-08)._
