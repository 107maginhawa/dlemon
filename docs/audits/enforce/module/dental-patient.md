# dental-patient — Module Enforcement
<!-- oli-enforce-module v1.0 | run: run-6-strict-2026-05-29 | prev: run-5-f2-service-layer-di-2026-05-28 -->

## Summary

- Findings: 22 (P0: 4, P1: 6, P2: 7, P3: 5)
- Service-Layer Pattern: **PARTIAL** — 8 subsidiary repo classes present; no `dental-patient.repo.ts` in module; core patient CRUD delegates to cross-module `../../patient/repos/patient.repo`; handlers use inline `new Repository(db)` (no injected singletons)
- Compliance Score: 37/100 (was 41/100 in run-5; 5 new findings, 0 resolved)
- New findings (run-6): EM-PAT-018 through EM-PAT-022
- Resolved: 0

---

## Findings

| ID | Sev | Status | Description | File | Line | Spec Ref |
|----|-----|--------|-------------|------|------|---------|
| EM-PAT-001 | P0 | KNOWN | All dental-patient routes use `roles: ['user']` — any authenticated user can create/archive/export patients; spec requires role-scoped guards per operation | `services/api-ts/src/app.ts` | all dental/patients routes | §6 Permissions |
| EM-PAT-002 | P0 | KNOWN | `archiveDentalPatient` uses `assertBranchAccess` not `assertBranchRole(['dentist_owner'])` — `staff_full`/`staff_scheduling`/`dentist_associate` can archive patients | `identity/archiveDentalPatient.ts` | ~30 | §6: archive = dentist_owner only |
| EM-PAT-003 | P0 | KNOWN | `archiveDentalPatient` uses `ValidatedContext<never, never, Params>` — `reason` body field never extracted, validated (min:5 max:500), or stored | `identity/archiveDentalPatient.ts` | ~14–47 | API_CONTRACTS §archive |
| EM-PAT-004 | P0 | KNOWN | `listDentalPatients` org-expands branchId via `branchRepo.listByOrg()` (L38–47) — strict branch scope replaced with all-org branches, leaking cross-branch PHI | `identity/listDentalPatients.ts` | ~38–48 | AC-PAT-004; BR: branch-scoped |
| EM-PAT-005 | P1 | KNOWN | No `dental-patient.repo.ts` in this module — core patient CRUD delegates to `../../patient/repos/patient.repo` (cross-module coupling, bypasses F2 boundary) | `repos/` dir | — | F2 DI; §7 Data Requirements |
| EM-PAT-006 | P1 | KNOWN | Repo instantiation inline in every handler (`new RecallRepository(db, logger)`) — no injected singleton, no DI pattern; repositories recreated per request | `recalls/listPatientRecalls.ts` et al. | ~23 | F2 DI Pattern |
| EM-PAT-007 | P1 | KNOWN | `listPatientConditions` and `listPatientVisits` import directly from `@/handlers/dental-visit/utils/visit.service` and `dental-visit/repos/visit-dental-patient.facade` — hard cross-module coupling | `identity/listPatientConditions.ts`, `identity/listPatientVisits.ts` | import block | F2 Layer separation |
| EM-PAT-008 | P1 | KNOWN | `createDentalPatient` accepts single `consentGiven: boolean` — API contract requires `marketing_consent` + `data_sharing_consent` as separate required boolean fields; contract broken | `identity/createDentalPatient.ts` | ~body | API_CONTRACTS §POST /dental/patients |
| EM-PAT-009 | P1 | KNOWN | BR-015b (archived = read-only 403) not enforced in write handlers — `updateDentalPatient`, `addFollowUpNote`, `createPatientContact`, `createDentalAlert`, `createRecall`, `createTreatmentPlan`, `updateTreatmentPlan`, `acceptTreatmentPlan` all skip archived status check | multiple write handlers | — | BR-015b; AC-PAT-002 |
| EM-PAT-018 | P1 | NEW | `restoreDentalPatient` uses `assertBranchAccess` (any branch member can restore an archived patient) — spec §6 symmetry and archive-scope intent require `assertBranchRole(['dentist_owner'])` | `identity/restoreDentalPatient.ts` | ~import, ~25 | §6 Permissions; §8 State Transitions |
| EM-PAT-010 | P2 | KNOWN | `bulkArchiveDentalPatients` and `exportDentalPatients` use `assertBranchAccess` not role check — spec restricts both to `dentist_owner` | `identity/bulkArchiveDentalPatients.ts`, `identity/exportDentalPatients.ts` | ~38–40 | §6: bulk ops = dentist_owner |
| EM-PAT-011 | P2 | KNOWN | `getDentalPatientStatement` accessible by any branch member — spec restricts to `staff_full` + `dentist_owner` | `identity/getDentalPatientStatement.ts` | ~35–37 | API_CONTRACTS §statement auth |
| EM-PAT-012 | P2 | KNOWN | `addFollowUpNote` (`followUpNotes.ts`) executes two sequential non-atomic `db.update()` calls (note append L44; `needsFollowUp=true` L49) — concurrent appends can silently lose clinical notes | `engagement/followUpNotes.ts` | ~44–51 | BR-015c; clinical data integrity |
| EM-PAT-013 | P2 | KNOWN | `createDentalPatient` throws `ValidationError` (→ 400) for missing consent — spec and AC-PAT-001 require 422 `CONSENT_REQUIRED` | `identity/createDentalPatient.ts` | ~37 | AC-PAT-001; §15 Error Handling |
| EM-PAT-014 | P2 | KNOWN | `getDentalPatient` profile response omits `safety_floor`, `follow_up_notes`, `consents` fields — separate `/safety-floor` endpoint exists but spec §10 requires safety floor embedded in profile GET | `identity/getDentalPatient.ts` | return object | AC-PAT-003; §10 API |
| EM-PAT-019 | P2 | NEW | `importPatients` emits zero audit logs — no `logger` calls for any imported patient despite bulk PHI creation; spec §17 requires `dental-patient.created` INFO per registered patient; HIPAA compliance gap | `identity/importPatients.ts` | entire handler | §17 Observability; BR-015 |
| EM-PAT-020 | P2 | NEW | AC-PAT-002 (archived=403 on any write) not covered by any test — 12 test files scanned, none assert 403 on write to archived patient; spec §12 explicitly requires this unit test | no test file | — | §12 Test Expectations; AC-PAT-002 |
| EM-PAT-015 | P3 | KNOWN | `exportDentalPatients` is bulk org-level export, not per-patient `GET /dental/patients/:id/export` — path and response shape diverge from API contract | `identity/exportDentalPatients.ts` | ~2 | §10 API Expectations |
| EM-PAT-016 | P3 | KNOWN | `importPatients` skips consent validation — bulk import creates patients without `marketing_consent`/`data_sharing_consent`, bypassing BR-015 consent gate | `identity/importPatients.ts` | ~22–55 | BR-015; §13 Edge Cases |
| EM-PAT-017 | P3 | KNOWN | DE-021 `PatientRegistered` domain event never emitted — `createDentalPatient` uses `logger.info` only; spec §10b requires publishing to dental-audit + notifs consumers | `identity/createDentalPatient.ts` | entire | §10b Domain Events |
| EM-PAT-021 | P3 | NEW | `dental-patient.consent.captured` INFO log (§17) never emitted — `createDentalPatient` logs `dental-patient.created` but not the required `consent.captured` structured log entry | `identity/createDentalPatient.ts` | post-consent | §17 Observability |
| EM-PAT-022 | P3 | NEW | `getDentalPatientSafetyFloor` does not emit `dental-patient.safety-floor.empty` WARN when all arrays are empty — spec §17 explicitly requires this WARN for compliance monitoring | `identity/getDentalPatientSafetyFloor.ts` | post-query | §17 Observability |

---

## Strict Checks (run-6)

### Safety Floor — Is aggregation O(1)?
**COMPLIANT.** `getDentalPatientSafetyFloor.ts` executes a single `db.select()` from `medicalHistoryEntries` filtered by `patientId + entryType + active`. No N+1. In-memory split into three arrays post-query. AC-PAT-003 satisfied on the `/safety-floor` endpoint. **Gap:** empty WARN not emitted (EM-PAT-022); safety floor not embedded in profile GET (EM-PAT-014).

### Read Audit — Does GET /dental/patients/:id emit audit READ event?
**NOT REQUIRED BY SPEC §17.** Spec only mandates four structured log events: `dental-patient.created`, `dental-patient.archived`, `dental-patient.consent.captured`, `dental-patient.safety-floor.empty`. None is a READ event. Handler emits `logger?.info({ action: 'getDentalPatient' })` — adequate for §17. The consent.captured event (EM-PAT-021) and safety-floor.empty WARN (EM-PAT-022) are the actual gaps.

### PHI Exposure — List endpoint without filtering?
**FAIL (EM-PAT-004).** `listDentalPatients` org-expands branchId to all org branches (lines 38–47). Staff from Branch A receive all patients from every branch in the org. PHI fields (displayName, dateOfBirth, status) are returned for patients outside the user's branch scope.

### Sync Module — Is it specced?
**UNSPECCED.** `sync/` contains `createSyncLog.ts`, `listSyncLogs.ts`, `updateSyncLog.ts` (AC-001/AC-002/AC-003, LF-BR-001/LF-BR-003/LF-BR-004). These are local-first Cadence sync log handlers. Not mentioned in MODULE_SPEC §10 or §19. Implementation exists with `dental-patient-sync.test.ts` (423 lines). Not a defect but spec should document these endpoints if production-bound.

---

## F2: Service-Layer/DI Assessment

### Repo Files Present

```
services/api-ts/src/handlers/dental-patient/repos/
  claim-draft.repo.ts       claim-draft.schema.ts
  dental-alert.repo.ts      dental-alert.schema.ts
  insurance-profile.repo.ts insurance-profile.schema.ts
  patient-contact.repo.ts   patient-contact.schema.ts
  recall.repo.ts             recall.schema.ts
  sync-log.repo.ts           sync-log.schema.ts
  task.repo.ts               task.schema.ts
  treatment-plan.repo.ts    treatment-plan.schema.ts
```

8 subsidiary repo classes present. **No `dental-patient.repo.ts` or `dental-patient.schema.ts`** in this module.

### Core Patient CRUD — Cross-Module Coupling (P1)

All core patient read/write operations delegate to `../../patient/repos/patient.repo`:

```typescript
// identity/archiveDentalPatient.ts
import { PatientRepository } from '../../patient/repos/patient.repo';

// identity/getDentalPatient.ts
import { PatientRepository } from '../../patient/repos/patient.repo';

// identity/listDentalPatients.ts
import { PatientRepository } from '../../patient/repos/patient.repo';

// identity/bulkArchiveDentalPatients.ts
import { PatientRepository } from '../../patient/repos/patient.repo';

// identity/exportDentalPatients.ts
import { PatientRepository } from '../../patient/repos/patient.repo';
```

This is a structural F2 violation: `dental-patient` module owns patient-domain operations but borrows the repository class from the platform `patient` module. Changes to `patient.repo` affect dental-patient behaviour with no isolation boundary.

### Direct Drizzle Cross-Module Imports in Handlers (P1)

Identity handlers bypass the repo layer and import Drizzle schemas from other modules directly:

```typescript
// identity/getDentalPatient.ts
import { dentalVisits } from '../../dental-visit/repos/visit.schema';
import { dentalInvoices } from '../../dental-billing/repos/dental-invoice.schema';
```

This embeds ad-hoc joins in handler logic rather than delegating to a facade or query method on the relevant repo.

### DI Pattern: Inline `new Repository(db)` Per Request (P1)

All handlers that own repos instantiate them inline, creating a new object every request with no injection:

```typescript
// recalls/listPatientRecalls.ts (~line 23)
const recallRepo = new RecallRepository(db, logger);

// recalls/updateRecall.ts (~line 28)
const recallRepo = new RecallRepository(db, logger);
```

Pattern used by sibling modules (dental-billing) for reference:
```typescript
// dental-billing handlers — same inline instantiation pattern
const repo = new DentalInvoiceRepository(db);
```

This is consistent with the codebase-wide pattern (no module uses injected singletons at the handler level), but it means repo instances are not testable via injection and cannot be stubbed without module-level patching.

### Handlers: Thin vs Fat Assessment

| Subdirectory | Assessment |
|---|---|
| `identity/` | **Mixed** — delegates patient CRUD to PatientRepository but embeds cross-module Drizzle joins and business-logic guards inline |
| `recalls/` | **Thin** — delegates to RecallRepository cleanly |
| `insurance/` | **Thin** — delegates to InsuranceProfileRepository |
| `contacts/` | **Thin** — delegates to PatientContactRepository |
| `alerts/` | **Thin** — delegates to DentalAlertRepository |
| `treatment-plans/` | **Thin** — delegates to TreatmentPlanRepository |
| `engagement/` | **Fat** — `addFollowUpNote` embeds two raw `db.update()` calls inline, no repo |
| `sync/` | **Thin** — delegates to SyncLogRepository |

### Service-Layer Pattern Verdict

**PARTIAL.** Subsidiary domain objects (recalls, insurance, contacts, alerts, treatment plans, tasks, claim-drafts, sync-log) follow the repository pattern correctly. Core patient entity CRUD is delegated to a cross-module repo rather than owning a local repo. Engagement handlers (`addFollowUpNote`, `followUpNotes`) bypass the layer entirely with raw Drizzle calls. No `.service.ts` file exists in the module; business logic (consent check, archived guard, branch-scope logic) lives in handler functions directly.

---

## Spec Coverage Matrix

| Requirement | Status | Finding |
|---|---|---|
| POST /dental/patients (create with consent) | PARTIAL | EM-PAT-008, EM-PAT-013 |
| GET /dental/patients (branch-scoped search) | FAIL | EM-PAT-004 |
| GET /dental/patients/:id (profile + safety floor) | PARTIAL | EM-PAT-014 |
| PATCH /dental/patients/:id (demographics update) | PARTIAL | EM-PAT-009 |
| POST /dental/patients/:id/archive | FAIL | EM-PAT-002, EM-PAT-003 |
| POST /dental/patients/:id/restore | PARTIAL | EM-PAT-018 |
| GET /dental/patients/:id/safety-floor | PARTIAL | EM-PAT-022 |
| GET /dental/patients/:id/statement | PARTIAL | EM-PAT-011 |
| POST /dental/patients/:id/follow-up | PARTIAL | EM-PAT-012 |
| POST /dental/patients/bulk-archive | PARTIAL | EM-PAT-010 |
| POST /dental/patients/import | PARTIAL | EM-PAT-016, EM-PAT-019 |
| GET /dental/patients/:id/export | FAIL | EM-PAT-015 |
| Contacts / Alerts / Recalls / Insurance / Claims | FOUND | all endpoints present; no archived guard (EM-PAT-009) |
| Dentition init (FDI adult + pediatric 51–85) | PASS | `initializeDentition.ts` implements deciduous/permanent/mixed |
| Safety floor aggregation O(1) (AC-PAT-003) | PARTIAL | EM-PAT-014, EM-PAT-022 |
| BR-015 consent required at registration | PARTIAL | EM-PAT-008, EM-PAT-013, EM-PAT-016 |
| BR-015b archived = read-only | FAIL | EM-PAT-009, EM-PAT-020 |
| BR-015c follow-up append-only | PARTIAL | EM-PAT-012 |
| BR-020 merge returns 501 | PASS | no merge endpoint; expected |
| Auth: role-scoped per operation | FAIL | EM-PAT-001 |
| §17 Observability events (4 required) | PARTIAL | EM-PAT-019, EM-PAT-021, EM-PAT-022 |
| Domain event DE-021 PatientRegistered | FAIL | EM-PAT-017 |
| §12 Test coverage AC-PAT-002 | FAIL | EM-PAT-020 |
| §18 Feature flags runtime checks | NOT IMPLEMENTED | flags defined in spec; no runtime gating in handlers |

---

## Priority Fix Order

1. **EM-PAT-001** — Replace `roles: ['user']` with operation-specific role arrays in app.ts dental-patient routes
2. **EM-PAT-002 + EM-PAT-018** — Fix archive + restore: use `assertBranchRole(['dentist_owner'])` in both handlers
3. **EM-PAT-003** — Parse and validate `reason` body in `archiveDentalPatient`; use `ValidatedContext<ArchiveBody, ...>`
4. **EM-PAT-004** — Remove org-expansion from `listDentalPatients`; enforce strict `branchId` filter
5. **EM-PAT-009** — Add archived status guard to ALL write handlers (updateDentalPatient, addFollowUpNote, createPatientContact, createDentalAlert, createRecall, createTreatmentPlan, updateTreatmentPlan, acceptTreatmentPlan)
6. **EM-PAT-020** — Add unit test: POST to any write endpoint with archived patient → 403 (covers AC-PAT-002)
7. **EM-PAT-008** — Align `createDentalPatient` body to API contract: `first_name`, `last_name`, `marketing_consent`, `data_sharing_consent`
8. **EM-PAT-013** — Change consent error to 422 `CONSENT_REQUIRED`
9. **EM-PAT-019** — Add `logger.info(dental-patient.created)` per imported patient in `importPatients`
10. **EM-PAT-012** — Merge two `db.update()` calls in `followUpNotes.ts` into single atomic update (append note + set `needsFollowUp` in one SET clause)
11. **EM-PAT-014** — Embed safety floor in `getDentalPatient` profile response (or document that separate endpoint satisfies spec)
12. **EM-PAT-005** — Create `repos/patient-identity.repo.ts`; migrate identity handlers off `../../patient/repos/patient.repo`
13. **EM-PAT-010 + EM-PAT-011** — Fix bulk-archive, export, statement role checks
14. **EM-PAT-021 + EM-PAT-022** — Emit `dental-patient.consent.captured` in createDentalPatient; emit `dental-patient.safety-floor.empty` WARN in getDentalPatientSafetyFloor when all arrays empty
15. **EM-PAT-017** — Emit DE-021 PatientRegistered (or document logger.info as acceptable given no event bus infra)
