# dental-patient — Module Enforcement
<!-- oli-enforce-module v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->

## Summary

- Findings: 17 (P0: 4, P1: 5, P2: 5, P3: 3)
- Service-Layer Pattern: **PARTIAL** — 8 subsidiary repo classes present; no `dental-patient.repo.ts` in module; core patient CRUD delegates to cross-module `../patient/repos/patient.repo`; handlers use inline `new Repository(db)` (no injected singletons)
- Compliance Score: 41/100

---

## Findings

| ID | Sev | Description | File | Line | Spec Ref |
|----|-----|-------------|------|------|---------|
| EM-PAT-001 | P0 | All dental-patient routes use `roles: ['user']` — any authenticated user can create/archive/export patients; spec requires role-scoped guards per operation | `services/api-ts/src/app.ts` | all dental/patients routes | §6 Permissions |
| EM-PAT-002 | P0 | `archiveDentalPatient` uses `assertBranchAccess` not role check — `staff_full`/`staff_scheduling`/`dentist_associate` can archive patients | `identity/archiveDentalPatient.ts` | ~30 | §6: archive = dentist_owner only |
| EM-PAT-003 | P0 | `archiveDentalPatient` reads no body — `reason` (required min:5 max:500) never extracted, validated, or stored | `identity/archiveDentalPatient.ts` | ~14–47 | API_CONTRACTS §archive |
| EM-PAT-004 | P0 | `listDentalPatients` org-expands branch scope — branchId filter replaced with all-org branches, leaking cross-branch PHI | `identity/listDentalPatients.ts` | ~38–48 | AC-PAT-004; BR: branch-scoped |
| EM-PAT-005 | P1 | No `dental-patient.repo.ts` in this module — core patient CRUD delegates to `../patient/repos/patient.repo` (cross-module coupling, bypasses F2 boundary) | `repos/` dir | — | F2 DI; §7 Data Requirements |
| EM-PAT-006 | P1 | Repo instantiation inline in every handler (`new RecallRepository(db, logger)`) — no injected singleton, no DI pattern; repositories recreated per request | `recalls/listPatientRecalls.ts` et al. | ~23 | F2 DI Pattern |
| EM-PAT-007 | P1 | Identity handlers directly import Drizzle schemas from sibling modules (`dentalVisits`, `dentalInvoices`) without going through a facade or repo — hard cross-module coupling | `identity/getDentalPatient.ts` | ~15–16 | F2 Layer separation |
| EM-PAT-008 | P1 | `createDentalPatient` accepts single `consentGiven: boolean` — API contract requires `marketing_consent` + `data_sharing_consent` as separate required boolean fields; field mismatch breaks contract | `identity/createDentalPatient.ts` | ~body | API_CONTRACTS §POST /dental/patients |
| EM-PAT-009 | P1 | BR-015b (archived = read-only 403) not enforced in write handlers — `updateDentalPatient`, `addFollowUpNote`, `createPatientContact`, `createDentalAlert`, `createRecall` all skip archived check | multiple write handlers | — | BR-015b; AC-PAT-002 |
| EM-PAT-010 | P2 | `bulkArchiveDentalPatients` and `exportDentalPatients` use `assertBranchAccess` not role check — spec restricts both to `dentist_owner` | `identity/bulkArchiveDentalPatients.ts`, `identity/exportDentalPatients.ts` | ~38–40 | §6: bulk ops = dentist_owner |
| EM-PAT-011 | P2 | `getDentalPatientStatement` accessible by any branch member — spec restricts to `staff_full` + `dentist_owner` | `identity/getDentalPatientStatement.ts` | ~35–37 | API_CONTRACTS §statement auth |
| EM-PAT-012 | P2 | `addFollowUpNote` has two separate non-atomic `db.update()` calls — concurrent appends race and can silently lose clinical notes | `engagement/addFollowUpNote.ts` | ~49–59 | BR-015c; clinical data integrity |
| EM-PAT-013 | P2 | `createDentalPatient` throws `ValidationError` (→ 400) for missing consent — spec and AC-PAT-001 require 422 `CONSENT_REQUIRED` | `identity/createDentalPatient.ts` | ~37 | AC-PAT-001; API_CONTRACTS §422 |
| EM-PAT-014 | P2 | `getDentalPatient` profile response omits safety floor (allergies/medications/conditions) — separate `/safety-floor` endpoint exists but spec requires it in the profile response | `identity/getDentalPatient.ts` | entire | AC-PAT-003; API_CONTRACTS §GET /:id |
| EM-PAT-015 | P3 | `exportDentalPatients` is bulk org-level export, not per-patient `GET /dental/patients/:id/export` — path and response shape diverge from API contract | `identity/exportDentalPatients.ts` | ~2 | API_CONTRACTS §export |
| EM-PAT-016 | P3 | `importPatients` skips consent validation — bulk import bypasses BR-015 consent gate, GDPR compliance gap | `identity/importPatients.ts` | ~22–55 | BR-015; AC-PAT-001 |
| EM-PAT-017 | P3 | DE-021 `PatientRegistered` domain event never emitted after patient creation — downstream dental-audit and notifs consumers receive nothing | `identity/createDentalPatient.ts` | entire | §10b Domain Events Published |

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
| GET /dental/patients/:id/statement | PARTIAL | EM-PAT-011 |
| POST /dental/patients/:id/follow-up | PARTIAL | EM-PAT-012 |
| POST /dental/patients/bulk-archive | PARTIAL | EM-PAT-010 |
| POST /dental/patients/import | PARTIAL | EM-PAT-016 |
| GET /dental/patients/:id/export | FAIL | EM-PAT-015 |
| Dentition init (FDI adult + pediatric 51–85) | PASS | `initializeDentition.ts` implements deciduous/permanent/mixed |
| Safety floor aggregation (AC-PAT-003) | PARTIAL | EM-PAT-014 |
| BR-015 consent required at registration | PARTIAL | EM-PAT-008, EM-PAT-016 |
| BR-015b archived = read-only | FAIL | EM-PAT-009 |
| BR-015c follow-up append-only | PARTIAL | EM-PAT-012 |
| BR-020 merge returns 501 | PASS | no merge endpoint present |
| Auth: role-scoped per operation | FAIL | EM-PAT-001 |
| Domain event DE-021 PatientRegistered | FAIL | EM-PAT-017 |

---

## Priority Fix Order

1. **EM-PAT-001** — Replace all `roles: ['user']` with operation-specific role arrays in app.ts dental-patient routes
2. **EM-PAT-002 + EM-PAT-003** — Fix archive: add `assertBranchRole(['dentist_owner'])` and read + store `reason`
3. **EM-PAT-004** — Remove org-expansion from `listDentalPatients`; enforce strict branch scope
4. **EM-PAT-009** — Add archived guard to all write handlers
5. **EM-PAT-008** — Align `createDentalPatient` body to API contract (`first_name`, `last_name`, `marketing_consent`, `data_sharing_consent`)
6. **EM-PAT-005** — Create `dental-patient.repo.ts` inside this module; stop borrowing from `../patient`
7. **EM-PAT-007** — Remove direct Drizzle schema imports from identity handlers; use facades
8. **EM-PAT-012** — Merge two-update pattern into single atomic `db.update()` in `addFollowUpNote`
9. **EM-PAT-013** — Change consent error to 422 `CONSENT_REQUIRED`
10. **EM-PAT-017** — Emit DE-021 after patient creation
