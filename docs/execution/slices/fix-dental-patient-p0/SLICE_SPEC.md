# SLICE_SPEC — fix-dental-patient-p0

**Commit target:** `fix(dental-patient): EM-PAT-001-004 EF-PAT-001-003 — roles/archive/PHI/consent P0 fixes`

---

## Problem statements

| ID | Finding | Severity |
|----|---------|----------|
| EM-PAT-001 | All dental-patient routes registered with `roles:['user']` — any authenticated user can access clinical PHI | P0 |
| EM-PAT-002 | `archiveDentalPatient` uses `assertBranchAccess` (membership-only) instead of `assertBranchRole(['dentist_owner'])` — non-owners can archive | P0 |
| EM-PAT-003 | `archiveDentalPatient` never reads/stores the request body `reason` — audit trail incomplete | P0 |
| EM-PAT-004 | `listDentalPatients` expands a `branchId` query param to all branches in the org — leaks cross-branch data | P0 |
| EF-PAT-001 | 15 write handlers allow mutations on archived patients — data integrity violation | P0 |
| EF-PAT-002 | `createDentalPatient` throws `ValidationError` (400) for missing consent, not `BusinessLogicError` (422) with code `CONSENT_REQUIRED` | P0 |
| EF-PAT-003 | Same as EM-PAT-004 — `listDentalPatients` org-expansion is the root cause | P0 |

---

## Acceptance criteria

### AC-EM-PAT-001 — Role enforcement on dental-patient routes
- `GET /dental/patients` with `roles:['user']` authentication passes only for dental role holders
- A user with role `'user'` but **no** dental membership gets 403 from the handler's `assertBranchAccess` check
- Shadow routes in `app.ts` are **not** needed for role fix — the generated routes use `roles:['user']` which lets any session through to the handler; the real fix is adding `assertBranchRole` inside write handlers and `assertBranchAccess` inside read handlers (which is already there). The generated routes file is auto-generated and must not be edited.
- **Actual fix scope**: The generated `routes.ts` cannot be hand-edited. Role checks happen inside handler logic via `assertBranchRole` / `assertBranchAccess`. The fix ensures every write handler calls `assertBranchRole` with correct dental roles and every read handler calls `assertBranchAccess`.

### AC-EM-PAT-002 — archiveDentalPatient uses assertBranchRole
- `POST /dental/patients/:id/archive` by a non-owner (e.g. `hygienist`) returns 403
- `POST /dental/patients/:id/archive` by a `dentist_owner` succeeds with 200

### AC-EM-PAT-003 — archiveDentalPatient parses and stores reason
- Body `{ reason: "string" }` is parsed from the request
- `archiveNote` is stored on the patient record (new column via schema + migration)
- Response includes the updated patient with `archiveNote` populated
- Empty/absent reason is allowed (optional field)

### AC-EM-PAT-004 / AC-EF-PAT-003 — listDentalPatients strict branchId scope
- `GET /dental/patients?branchId=<branch-A>` returns **only** patients whose `preferredBranchId = branch-A`
- Patients registered at branch-B in the same org are **not** returned
- `branchId` param still required; 400 returned when absent

### AC-EF-PAT-001 — Archived patient write-block
- POST/PATCH/DELETE on any write endpoint for an archived patient returns 422 with code `PATIENT_ARCHIVED`
- The 15 affected write handlers are:
  1. `updateDentalPatient`
  2. `createPatientContact`
  3. `updatePatientContact`
  4. `deletePatientContact`
  5. `createRecall`
  6. `updateRecall`
  7. `createDentalAlert`
  8. `updateDentalAlert`
  9. `createTask`
  10. `updateTask`
  11. `createTreatmentPlan`
  12. `updateTreatmentPlan`
  13. `createInsuranceProfile`
  14. `updateInsuranceProfile`
  15. `createClaimDraft` / `updateClaimStatus`
  16. `addFollowUpNote`

### AC-EF-PAT-002 — Consent check returns 422 CONSENT_REQUIRED
- `POST /dental/patients` with `consentGiven: false` returns 422 with `code: 'CONSENT_REQUIRED'`
- `POST /dental/patients` with `consentGiven: true` returns 201 (happy path unchanged)

---

## Implementation plan

### Step 1 — Write failing tests (RED)
Add new `describe` blocks to `dental-patient.test.ts` for:
- `EM-PAT-002`: archive by non-owner role → 403
- `EM-PAT-003`: archive with reason body → stores archiveNote
- `EM-PAT-004/EF-PAT-003`: list strict to branchId, not org-wide
- `EF-PAT-001`: write on archived patient → 422 PATIENT_ARCHIVED (test updateDentalPatient + createRecall as representative)
- `EF-PAT-002`: create without consent → 422 CONSENT_REQUIRED

### Step 2 — Schema migration (archiveNote)
- Add `archiveNote: text('archive_note')` to `patient.schema.ts`
- Generate migration: `cd services/api-ts && bun run db:generate`

### Step 3 — Fix EF-PAT-002 (consent error code)
- In `createDentalPatient.ts`: change `throw new ValidationError(...)` to `throw new BusinessLogicError('Patient consent is required', 'CONSENT_REQUIRED')`

### Step 4 — Fix EM-PAT-002 + EM-PAT-003 (archiveDentalPatient)
- In `archiveDentalPatient.ts`:
  - Replace `assertBranchAccess` with `assertBranchRole(db, user.id, branchId, ['dentist_owner'])`
  - Parse request body: `const body = await ctx.req.json().catch(() => ({}))`
  - Pass `reason` to `repo.archivePatient` and store as `archiveNote`

### Step 5 — Fix EM-PAT-004/EF-PAT-003 (listDentalPatients strict branchId)
- Remove the org-expansion block in `listDentalPatients.ts` (lines 40-49)
- Pass `branchId` directly as a single-branch filter

### Step 6 — Fix EF-PAT-001 (archived write-block)
- Update `patient-dental-patient.facade.ts` to return `status` field
- Add guard check in each of the 16 write handlers: if `patient.status === 'archived'`, throw `new BusinessLogicError('Cannot modify an archived patient', 'PATIENT_ARCHIVED')`
- For handlers that do NOT call `getPatientForDentalPatient` (e.g. `updateDentalPatient`, `addFollowUpNote`), add the same guard after `repo.findOneById`

### Step 7 — Run tests GREEN, typecheck, commit

---

## Files to change

| File | Change |
|------|--------|
| `services/api-ts/src/handlers/patient/repos/patient.schema.ts` | Add `archiveNote` column |
| `services/api-ts/src/handlers/patient/repos/patient.repo.ts` | Accept optional `reason` in `archivePatient`, store as `archiveNote` |
| `services/api-ts/src/handlers/patient/repos/patient-dental-patient.facade.ts` | Return `status` in `getPatientForDentalPatient` |
| `services/api-ts/src/handlers/dental-patient/identity/archiveDentalPatient.ts` | Use `assertBranchRole(['dentist_owner'])`, parse reason |
| `services/api-ts/src/handlers/dental-patient/identity/listDentalPatients.ts` | Remove org-expansion block |
| `services/api-ts/src/handlers/dental-patient/identity/createDentalPatient.ts` | Change consent error to 422 CONSENT_REQUIRED |
| `services/api-ts/src/handlers/dental-patient/identity/updateDentalPatient.ts` | Add archived write-block |
| `services/api-ts/src/handlers/dental-patient/contacts/createPatientContact.ts` | Add archived write-block |
| `services/api-ts/src/handlers/dental-patient/contacts/updatePatientContact.ts` | Add archived write-block |
| `services/api-ts/src/handlers/dental-patient/contacts/deletePatientContact.ts` | Add archived write-block |
| `services/api-ts/src/handlers/dental-patient/recalls/createRecall.ts` | Add archived write-block |
| `services/api-ts/src/handlers/dental-patient/recalls/updateRecall.ts` | Add archived write-block |
| `services/api-ts/src/handlers/dental-patient/alerts/createDentalAlert.ts` | Add archived write-block |
| `services/api-ts/src/handlers/dental-patient/alerts/updateDentalAlert.ts` | Add archived write-block (needs patient lookup) |
| `services/api-ts/src/handlers/dental-patient/engagement/createTask.ts` | Add archived write-block |
| `services/api-ts/src/handlers/dental-patient/engagement/updateTask.ts` | Add archived write-block |
| `services/api-ts/src/handlers/dental-patient/engagement/followUpNotes.ts` | Add archived write-block in addFollowUpNote |
| `services/api-ts/src/handlers/dental-patient/treatment-plans/createTreatmentPlan.ts` | Add archived write-block |
| `services/api-ts/src/handlers/dental-patient/treatment-plans/updateTreatmentPlan.ts` | Add archived write-block |
| `services/api-ts/src/handlers/dental-patient/insurance/createInsuranceProfile.ts` | Add archived write-block |
| `services/api-ts/src/handlers/dental-patient/insurance/updateInsuranceProfile.ts` | Add archived write-block (needs patient lookup) |
| `services/api-ts/src/handlers/dental-patient/insurance/createClaimDraft.ts` | Add archived write-block |
| `services/api-ts/src/handlers/dental-patient/insurance/updateClaimStatus.ts` | Add archived write-block (needs patient lookup) |
| `services/api-ts/src/handlers/dental-patient/dental-patient.test.ts` | Add failing tests for all 7 findings |

---

## Error contract

```typescript
// EF-PAT-001
{ status: 422, code: 'PATIENT_ARCHIVED', message: 'Cannot modify an archived patient' }

// EF-PAT-002
{ status: 422, code: 'CONSENT_REQUIRED', message: 'Patient consent is required' }

// EM-PAT-002
{ status: 403, code: 'FORBIDDEN' }  // non-owner archive attempt
```
