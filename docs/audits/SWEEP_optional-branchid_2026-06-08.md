# Cross-module sweep — optional-branchId-omission variant (EM-BIL-002 class)

**Date:** 2026-06-08
**Branch:** `feat/module-workflow-alignment`
**Trigger:** Round 9 (dental-billing) found **EM-BIL-002** — five report/list endpoints
treated `branchId` as an OPTIONAL query-param filter and only authorized **when it was
supplied**. Omitting the param applied **no** branch scoping → an aggregate over every
org's data (cross-tenant financial + PHI leak). Fixed in commit `825bffbb` by scoping the
omitted-branch path to the caller's own active branches via `getActiveBranchIdsForPerson(...)`
+ `inArray(...)` (empty membership → `sql\`false\`` → zero rows, never the whole DB).

## The variant under hunt

Distinct from the already-fixed holes in **dental-patient (V-PAT-002)** and
**dental-visit (V-VIS-011)**, which were *"trusts a caller-supplied `branchId`/`patientId`
to scope reads"*. Here the param is **OPTIONAL** and **omission removes scoping entirely**,
widening the query to **all tenants**. Earlier per-module rounds checked cross-branch
DENIAL generally but did NOT specifically lens for *"optional filter omitted → unscoped →
all tenants."*

## Scope

The eight already-audited modules (billing excluded — already done):
dental-org, dental-patient, dental-scheduling, dental-visit, dental-clinical,
dental-perio, dental-imaging, dental-pmd.

## Result

**ZERO holes found.** The optional-branchId-omission leak exists only in dental-billing
(already fixed). Every list/report/aggregate/search/export endpoint across the 8 modules
falls into one of three SAFE patterns:

1. **branchId REQUIRED** — handler throws `ValidationError` / returns 400 when omitted,
   then `assertBranchAccess`/`assertBranchRole`, then the repo hard-filters
   `eq(branchId)`. Omission cannot reach the DB.
2. **branch DERIVED from a path/resource** (patient / visit / study / image / household /
   chart / template), then `assertBranchAccess`/`assertPatientBranchAccess`/`assertBranchRole`.
   The query `branchId`, where present, is only a *further-narrowing* filter inside the
   caller's already-authorized resource — never the auth boundary (this is the V-PAT-002 /
   V-VIS-011 fixed posture). Empty/foreign resource → assert fails (403) or empty list.
3. **scoped to the caller's OWN memberships** (`getBranchesByUser`, `getPermissionGrid`
   org-resolution) — the canonical safe default itself.

Crucially, **no endpoint in these 8 modules has an `if (branchId) { ...filter... }` path
whose `else` branch leaves the query unfiltered across tenants.** The two list-style repos
with a conditional `if (filters.branchId)` filter (`visit.repo`, `perio-chart.repo`
`buildWhereConditions`) are only ever reached from callers that either *require* branchId
or derive+assert the branch from the patient resource first.

## Per-endpoint coverage table

| Module | Endpoint | Handler:line | Repo:line | Scoping mechanism | Verdict |
|---|---|---|---|---|---|
| dental-org | `GET /dental/organizations/{orgId}/branches/` | `DentalBranchManagement_list.ts:38` | `branch.repo listByOrg` | orgId from path; owner-or-active-member check on that org | SAFE |
| dental-org | `GET /dental/organizations/{orgId}/branches/{branchId}/members/` | `DentalMembershipManagement_list.ts:35` | `membership.repo listByBranch` | branchId from path + `assertBranchAccess` | SAFE |
| dental-org | `GET /dental/org/members?branchId=` | `listMembers.ts:20` | `membership.repo listByBranchPaginated` | branchId **required** (400) + `assertBranchAccess` | SAFE |
| dental-org | `GET /dental/branches/{branchId}/consent-templates` | `consentTemplates.ts:62` | inline `eq(branchId)` | branchId from path + `assertBranchAccess` + hard branch filter | SAFE |
| dental-org | `GET /dental/dashboard/summary?branchId=` | `getDashboardSummary.ts:22` | billing/clinical dashboard facades (per-branch) | branchId **required** (400) + `assertBranchRole(dentist_owner)` | SAFE |
| dental-org | `GET /dental/branches` | `getBranchesByUser.ts:18` | inline | scoped to caller's own active memberships (the canonical safe default) | SAFE |
| dental-org | `GET /dental/org/permissions?organizationId=` | `getPermissionGrid.ts` (`resolveOrgForCaller`) | org repo | optional orgId resolves to caller's owned org; else owner-or-active-member of that org | SAFE |
| dental-org | `GET /dental/org/context` | `getOrgContext.ts:18` | org/branch/member repos | fully caller-scoped (own ownership/membership) | SAFE |
| dental-org | `GET /dental/fee-schedule?branchId=` | `feeSchedule.ts:57` | branch row + `listActiveProcedureCodes` | branchId **required** (400) + `assertBranchRole` + branch-scoped | SAFE |
| dental-patient | `GET /dental/patients?branchId=` | `listDentalPatients.ts:31` | `patient-dental-patient.facade` (filters.branchId) | branchId **required** (400) + `assertBranchRole` + `filters.branchId` set | SAFE |
| dental-patient | `GET /dental/patients/export?branchId=` | `exportDentalPatients.ts:60` | `listDentalPatientsWithPerson` (filters.branchId) | branchId **required** (400) + `assertBranchRole(dentist_owner)` + filter set | SAFE |
| dental-patient | `GET /dental/recalls/due?branchId=` | `listDueRecalls.ts:42` | `recall.repo findDueByBranch` | branchId **required** (validator) + `assertBranchAccess` + `findDueByBranch(branchId)` | SAFE |
| dental-patient | `GET /dental/patients/{patientId}/visits?branchId=` | `listPatientVisits.ts:46` | `findVisits` | branch DERIVED from patient + `assertPatientBranchAccess`; branchId = further-narrowing only (V-PAT-002) | SAFE |
| dental-patient | `GET /dental/patients/{patientId}/treatments?branchId=` | `listPatientConditions.ts:48` | `findVisits` + visit facades | branch DERIVED from patient + `assertPatientBranchAccess`; branchId = further-narrowing only (V-PAT-002) | SAFE |
| dental-patient | `GET /dental/households/{householdId}` | `getHousehold.ts` | `household.repo` | branch DERIVED from household + `assertBranchAccess` | SAFE |
| dental-scheduling | `GET /dental/appointments` | `listAppointments.ts:38` | `appointment-patient.facade` | branchId **required** (throws) + `assertBranchAccess` + hard `eq(branchId)`; providerId/patientId = further-narrowing | SAFE |
| dental-scheduling | `GET /dental/branches/{branchId}/queue-board` | `listQueueBoard.ts` | `queue-item.repo findActiveByBranch` | branchId from path + `assertBranchAccess` | SAFE |
| dental-scheduling | `GET /dental/branches/{branchId}/waitlist` | `listWaitlist.ts` | `waitlist-entry.repo listForBranch` | branchId from path + `assertBranchAccess` | SAFE |
| dental-scheduling | `GET /dental/public/branches/{branchId}/availability` | `getPublicAvailability.ts` | availability service | branchId from path; intentionally public + rate-limited; returns slot availability only (no PHI) | SAFE (out-of-variant) |
| dental-visit | `GET /dental/visits?branchId=` | `listDentalVisits.ts:28` | `visit.repo findMany` (filters.branchId) | branchId **required** (throws) + `assertBranchAccess` + `filters.branchId` set | SAFE |
| dental-visit | `GET /dental/visits/{visitId}/treatments` | `listDentalTreatments.ts` | `treatment.repo findByVisit` | visitId from path → branch DERIVED from visit + `assertBranchAccess` | SAFE |
| dental-visit | `GET /dental/visits/history/{patientId}/teeth/{toothNumber}` | `getToothHistory.ts:43` | `visit.repo findMany` | branch DERIVED from patient's visits + `assertBranchAccess`; empty → empty list | SAFE |
| dental-visit | `GET /dental/patients/{patientId}/treatment-plan?branchId=` | `getTreatmentPlan.ts:35` | inline (visitIds for patient) | branchId **required** but auth via patient's branch (V-VIS-011); branchId not the boundary | SAFE |
| dental-visit | `GET /dental/patients/{patientId}/treatment-plan/versions/{versionId}?branchId=` | `getTreatmentPlanVersion.ts:35` | inline (`eq(id)+eq(patientId)`) | branchId **required** but auth via patient's branch (V-VIS-011) + version↔patient match | SAFE |
| dental-visit | `GET /dental/treatment-templates?branchId=` | `treatmentTemplates.ts:50` (`listTreatmentTemplates`) | inline `eq(branchId)` | branchId **required** (throws) + `assertBranchAccess` + hard branch filter | SAFE |
| dental-clinical | `GET /dental/visits/{visitId}/prescriptions` | `listPrescriptions.ts` | `prescription.repo findMany({visitId})` | visit-derived branch + `assertBranchAccess` | SAFE |
| dental-clinical | `GET /dental/visits/{visitId}/lab-orders` | `listLabOrders.ts` | `lab-order.repo findMany({visitId})` | visit-derived branch + `assertBranchAccess` | SAFE |
| dental-clinical | `GET /dental/visits/{visitId}/consents` | `listConsentForms.ts` | `consent-form.repo findMany({visitId})` | visit-derived branch + `assertBranchAccess` | SAFE |
| dental-clinical | `GET /dental/visits/{visitId}/consent-refusals` | `listConsentRefusals.ts` | `consent-refusal.repo findMany({visitId})` | visit-derived branch + `assertBranchRole` | SAFE |
| dental-clinical | `GET /dental/visits/{visitId}/amendments` | `listAmendments.ts` | `amendment.repo findMany({visitId})` | visit-derived branch + `assertBranchAccess` | SAFE |
| dental-clinical | `GET /dental/visits/{visitId}/attachments` | `listAttachments.ts` | `attachment.repo findMany({visitId})` | visit-derived branch + `assertBranchAccess` | SAFE |
| dental-clinical | `GET /dental/branches/{branchId}/inventory` | `listInventoryItems.ts` | `inventory.repo findByBranchId` | branchId from path + `assertBranchRole` + branch exists | SAFE |
| dental-clinical | `GET /dental/branches/{branchId}/inventory/{itemId}/adjustments` | `listInventoryAdjustments.ts` | `inventory.repo findAdjustmentsByItemId` | branchId from path + `assertBranchRole` + item scoped to branch | SAFE |
| dental-clinical | `GET /dental/branches/{branchId}/postop-templates` | `listPostopTemplates.ts` | `postop-template.repo findByBranchId` | branchId from path + `assertBranchRole` | SAFE |
| dental-clinical | `GET /dental/clinical/medical-history?patientId=` | `listMedicalHistory.ts:23` | `medical-history.repo findMany({patientId})` | patientId **required** + branch DERIVED from patient + `assertBranchAccess` | SAFE |
| dental-clinical | `GET /dental/clinical/medical-history-review?patientId=` | `getMedicalHistoryReview.ts:23` | `medical-history-review.repo findLatestByPatient` | patientId **required** + branch DERIVED from patient + `assertBranchAccess` | SAFE |
| dental-perio | `GET /dental/perio-charts?patientId=` | `listPerioChartsForPatient.ts:48` | `perio-chart.repo findFinalizedByPatient:46` | patientId from query; branch DERIVED from returned `charts[0].branchId` + `assertBranchRole`; empty → empty list (foreign patient → 403 on assert) | SAFE |
| dental-imaging | `GET /dental/patients/{patientId}/images?branchId=` | `listPatientImages.ts:91` | `imaging.repo listImagingImagesForPatient(patientId, branchId)` | branchId **required** (400) + `assertBranchAccess` + repo filters by branch | SAFE |
| dental-imaging | `GET /dental/imaging/studies/{studyId}` | `getImagingStudy.ts` | `imaging.repo` | branch DERIVED from study + `assertBranchAccess` | SAFE |
| dental-imaging | `GET /dental/imaging/images/{imageId}/findings` | `listFindings.ts` | `imaging_finding.repo listByImage(imageId, branchId)` | image→study branch + `assertBranchAccess`; repo also scoped by study branch | SAFE |
| dental-imaging | `GET /dental/imaging/images/{imageId}/measurements` | `listMeasurements.ts` | `imaging.repo listMeasurementAnnotations` | image→study branch + `assertBranchAccess` | SAFE |
| dental-imaging | `GET /dental/imaging/images/{imageId}/ceph/landmarks` | `listCephLandmarks.ts` | `imaging_ceph.repo listByImage` | image→study branch + `assertBranchAccess` + tier gate | SAFE |
| dental-imaging | `GET /dental/patients/{patientId}/ceph/superimpositions` | `cephSuperimposition.ts:366` (`listCephSuperimpositions`) | `imaging_ceph.repo listSuperimpositionsByPatient` | patientId from path; **per-row** filter by report→study branch via `assertBranchRole` (skip on fail); empty → empty list | SAFE |
| dental-pmd | `GET /dental/pmd?patientId=` | `listPMDs.ts:20` | `pmd-document.repo findMany({patientId})` | patientId **required** + patient-self OR branch DERIVED from `patient.preferredBranchId` + `assertBranchAccess` | SAFE |
| dental-pmd | `GET /dental/pmd/imported?patientId=` | `listImportedPMDs.ts:20` | `imported-pmd.repo findMany({patientId})` | patientId **required** + patient-self OR patient-branch + `assertBranchAccess` | SAFE |
| dental-pmd | `GET /dental/visits/{visitId}/pmd/export` | `exportPMD.ts` | `pmd-document.repo findMany({visitId})` | visit-derived branch + patient-self OR `assertBranchRole` | SAFE |
| dental-pmd | `GET /dental/pmd/patient/{patientId}/care-record` | `exportPatientCareRecord.ts` | `pmd-document.repo findMany({patientId})` | patientId from path + patient-self OR patient-branch + `assertBranchAccess` | SAFE |

## Findings summary

- **Endpoints inspected:** 45 (across all 8 modules).
- **SAFE:** 45
- **HOLE-FIXED:** 0
- **SUSPECT-RESOLVED:** 0

No code changes were required in any of the 8 modules. The repos with a conditional
`if (filters.branchId)` branch (`visit.repo:35`, `perio-chart.repo:27`,
`dental-appointment.repo:37`, `waitlist-entry.repo:34`, `queue-item.repo:25`,
`membership.repo:62`) were each traced to their handler callers — none expose an
unscoped/all-tenant path: every caller either requires branchId upstream or derives
and asserts the branch from a path resource before calling the repo.

## Why this is a clean negative (not a coverage gap)

The dental-billing hole was structurally specific: its report endpoints aggregate
**across patients** (AR aging, collections, payer aging, claim worklist, statement
batch), so there is no single path-resource to derive the branch from — the only scope
was the optional `branchId`, and omitting it left the SUM/COUNT over the whole table.
Every list/report endpoint in the other 8 modules is **resource-anchored** (visit /
patient / study / branch-in-path) or **branchId-required**, so there is no "aggregate
with an optional-only scope" surface to leak. The billing pattern is the exception, not
the rule, for these modules.

## Carry-forward

The optional-filter-omission variant remains a live hazard for any **cross-resource
aggregate/report** endpoint. The remaining unaudited modules — **dental-portal** and
**emr-consultation** (plus provider / external-records-import) — should be lensed for the
same pattern when they are audited: any list/report whose tenant/branch filter is OPTIONAL
must default an omitted scope to the caller's accessible set (`getActiveBranchIdsForPerson`
→ `inArray`, empty → zero rows), never to "unfiltered = all tenants."

---

## Carry-forward CLOSED — SL-08 / F-G06 (2026-06-10)

The four carry-forward surfaces were swept for the same optional-branch-omission
("aggregate with optional-only scope → all-tenant when omitted") pattern. Result:
**none exhibits the EM-BIL-002 leak class.** Each is scoped by *ownership*, not an
optional branch filter — so there is no "omit the filter → all tenants" surface.

| Module | List/report/import endpoints | Scoping model | Verdict | Regression pin |
|---|---|---|---|---|
| **dental-portal** | `GET /me/invoices`, `/me/balance`, `/me/appointments` | patientId DERIVED from session (`resolveSelfPatientIdOrThrow`); **no client/optional branch param** — IDOR-free by construction | SAFE | `dental-portal.test.ts` (both-direction isolation, tampered `?patientId` inert, empty-self-scope) |
| **emr** | `GET /emr/consultations`, `/emr/patients` | role-scoped: provider→own `provider.id`, patient→own `patient.id`, **no branch param**. (admin-global is the *separate* GC-02 question, decision #14 — NOT the optional-branch class) | SAFE (non-admin) | `emr/emr-coverage.test.ts §449/463` (provider list excludes another provider's notes, both directions) |
| **external-records-import / importPatients** | `POST /dental/patients/import` | `assertBranchRole(user, row.branchId, ['dentist_owner'])` for **every** unique branchId in the payload | SAFE | `dental-patient.bulk-import.test.ts` (cross-tenant isolation: import naming a foreign branch → 403) |
| **external-records-import / importPMD** | `POST /dental/pmd/import` | branch DERIVED from `patient.preferredBranchId` + `assertBranchRole` (clinical roles) | SAFE | **NEW** `dental-pmd/importPMD.cross-branch-isolation.test.ts` (foreign-org caller → 403, no row written; owner → 201; unauth → 401) |

### provider — dormant base-template primitive (out of the dental cross-tenant class)

`provider/listPractitioners` + `listPractitionerRoles` have **no branch/org filter at
all** and do not scope by `tenantId`. On inspection this is a **frozen upstream
base-template FHIR primitive, not wired into the dental product**:
- **0 FE consumers** and **0 references from any `dental-*` handler** (grep-verified).
- `createPractitioner` never sets `tenantId` — every row uses the schema default
  `'default'` (`practitioner.schema.ts:85`). There is no caller→org mapping, so there is
  no "caller's accessible set" to scope to.

So the EM-BIL-002 optional-branch-omission pattern **does not apply** (no branch param to
omit; single-`'default'`-tenant data; no dental tenancy integration). Forcing a dental-org
branch guard onto this frozen, unused module would be a mis-integration, not a fix.
**Forward guard:** if the provider module is ever wired to dental tenancy (per-org
`tenantId` populated + dental consumers), `listPractitioners`/`listPractitionerRoles` MUST
default an omitted scope to the caller's tenant set before that data goes live.

### Net
- Endpoints inspected (this pass): portal 3, emr 2, importPatients 1, importPMD 1, provider 2 = **9**.
- **SAFE: 9.** HOLE-FIXED: 0. New regression pin added: 1 (`importPMD`). Documented dormant: 2 (provider).
- The optional-branch-omission leak class is now **swept clean for all carry-forward
  surfaces**; `dental-billing` remains the lone historical instance of the pattern (fixed `825bffbb`).
