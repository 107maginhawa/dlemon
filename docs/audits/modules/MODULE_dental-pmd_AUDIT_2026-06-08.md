# Module Audit — dental-pmd

**Date:** 2026-06-08
**Branch:** feat/module-workflow-alignment
**Auditor:** per-module deep audit + safe-gap closure (adversarial; verified against source)
**Verdict:** ✅ **READY** — no behavioral bug found. The PMD module (9 ops across 2 interfaces, absorbing the care-record/ FHIR continuity export, PMD generate/import/export, data-portability, and imported-PMD immutability) is fully implemented, branch-isolated, checksum-sealed, and audited. **The branchId-auth-boundary carry-forward check found NO hole**: dental-pmd trusts *no* caller-supplied `branchId` query param anywhere — every PHI read/write derives its branch from the resource (visit-scoped from `visit.branchId`, patient-scoped from `patient.preferredBranchId`), the SAFE pattern (same as dental-imaging). Closed 1 REAL adversarial test gap (cross-branch PHI isolation — a full-role member of *another* branch denied, beyond the existing no-membership OUTSIDER case; 5 new cases) + 4 doc/registry drift reconciliations (MODULE_SPEC §7 data-requirements / §7.2 import-contract phantom columns, §10 wrong list route, §15 error table; br-registry enriched from 2 → 7 rules with the implemented+tested V/EF/N codes). Gates green.

---

## STEP 0 — Artifacts & /module-review

| Artifact | Location | Status |
|----------|----------|--------|
| Handler dir | `services/api-ts/src/handlers/dental-pmd/` | ✅ 9 impl handlers (generatePMD, getPMDForVisit, listPMDs, exportPMD, importPMD, listImportedPMDs, getImportedPMD, exportPatientCareRecord) + `care-record/fhir-bundle.ts` (FHIR R4 Bundle builder); `repos/` (pmd-document repo+schema, imported-pmd repo) |
| TypeSpec | `specs/api/src/modules/dental-pmd.tsp` | ✅ present — 9 ops across `PMDDocumentManagement` (generate/getForVisit/list/export) + `ImportedPMDManagement` (import/listImported/getImported/exportPatientCareRecord) |
| MODULE_SPEC / API_CONTRACTS | `docs/product/modules/dental-pmd/` | ✅ present (API_CONTRACTS already reconciled to inline-JSON reality via V-PMD-006; MODULE_SPEC carried §7/§7.2/§10/§15 drift — all reconciled this round) |
| Tests | 8 `*.test.ts` (107 assertions) | ✅ present — main (`dental-pmd.test.ts`, 39), RBAC/identity (`dental-pmd-auth.test.ts`), domain-event audit-rows (`dental-pmd-events.test.ts`), data-portability (`dental-pmd.data-portability.test.ts`), FHIR care-record (`exportPatientCareRecord.test.ts` + `care-record/fhir-bundle.test.ts`), imported-PMD 405 immutability (`imported-pmd-immutable.test.ts`), repo (`repos/pmd-document.test.ts`) |
| Routes | `generated/openapi/{registry,routes}.ts` | ✅ all 9 wired; immutable 405 guard (`PATCH/PUT/DELETE /dental/pmd/imported/:id`) lives in `app.ts` |
| Contract | `dental-pmd.hurl` (26 req) | ✅ present |

**/module-review result:** **PASS** — no `test.skip`/`xit`/`.only`; no `Not implemented` stub; no TODO/FIXME/HACK in handler code; no non-test `as any`. TypeSpec ops ↔ handler names match (operationId == handler fn). Audit logging present on every PHI write/movement (generate → `pmd.generate` + `pmd.generated` DE-017; import → `pmd.import`; export → `pmd.export`; care-record → `pmd.export`; getImportedPMD → `data-access` read).

---

## STEP 3 — KG mapping (query-only)

`.understand-anything/domain-graph.json` maps `domain:clinical-documents-pmd`,
`flow:generate-pmd` (+ steps), and `flow:import-external-pmd`. The nodes EXIST and broadly
match, but the **summaries OVER-CLAIM / mis-state** in three ways (all KG-projection drift —
query-only, not regenerated):

1. **Wrong canonical expansion.** Both `domain:clinical-documents-pmd` and `flow:generate-pmd`
   expand PMD as **"Patient medical data"** — contradicting the canonical V-PMD-009 expansion
   **"Portable Medical Document"** (codified in MODULE_SPEC §2 + API_CONTRACTS header).
2. **Phantom route.** A step under the generate flow cites **`POST /dental/pmd/generate`**, which
   does not exist — the real generate route is **`POST /dental/visits/:visitId/pmd`** (visit-scoped).
3. **Out-of-scope claim.** `domain:clinical-documents-pmd` says it "Covers … and **recall
   management**" — recall is not part of dental-pmd at all.

**KG-backlog (lossy, not a blocker):** the graph does not model the PMD status FSM
(`generated → signed`/`superseded`), the imported-PMD immutability (405) edge, the
patient-self (V-PMD-008) access branch, or the P2-18 care-record FHIR export flow as distinct
nodes. Fix on next KG regeneration.

---

## STEP 6 — Traceability Matrix

| Item | Spec? | Impl? | KG | Test (file) | Strength | Verdict |
|------|-------|-------|----|-------------|----------|---------|
| **WF-021 / BR-021 / AC-PMD-001** generate PMD only from completed/locked visit; else 422 VISIT_NOT_COMPLETED | ✅ | ✅ generatePMD:53 | ✅ flow | dental-pmd.test.ts:181; dental-pmd-events.test.ts:125 (no audit row on fail) | VERIFIED | 🟢 |
| **AC-PMD-004 / BR-021** PMD content + checksum immutable against later visit edits; SHA-256 (`sha256-<hex>`) | ✅ | ✅ generatePMD sha256Hex:30; supersede | partial | dental-pmd.test.ts:252 (edit visit → checksum unchanged), :751-767 (checksum present + distinct) | VERIFIED | 🟢 |
| **N-PMD-02** patientId bound to the VISIT, not body; mismatch → 422 PATIENT_VISIT_MISMATCH; sealed content carries visit.patientId | ✅ | ✅ generatePMD:66 | NONE | dental-pmd-auth.test.ts:211,225; dental-pmd.test.ts:216,230 | VERIFIED | 🟢 |
| **V-PMD-011** re-generate supersedes prior (`generated→superseded`); superseded content never altered | ✅ | ✅ pmdRepo.supersede | NONE | dental-pmd.test.ts:295; repos/pmd-document.test.ts | VERIFIED | 🟢 |
| **getPMDForVisit / 204** absent PMD → 204 (not 404), matching perio precedent; visit 404s if absent | ✅ | ✅ getPMDForVisit:31 | NONE | dental-pmd.test.ts:330,340,346 | VERIFIED | 🟢 |
| **RBAC generate** dentist_owner/dentist_associate only (assertBranchRole); staff_full → 403; non-member → 403 | ✅ | ✅ generatePMD:45 | NONE | dental-pmd-auth.test.ts:138,149,160 (DENY staff_full / DENY outsider / ALLOW owner) | VERIFIED | 🟢 |
| **WF-022 / BR-022 / AC-PMD-002** imported PMD read-only; PATCH/PUT/DELETE → 405 IMPORTED_PMD_IMMUTABLE (route-level, real app) | ✅ | ✅ app.ts:161-168 | partial | imported-pmd-immutable.test.ts:26,37,48,55 (real `createApp` wiring) | VERIFIED | 🟢 |
| **AC-PMD-003 / FR12.5** imported content stored verbatim & retrievable as-is | ✅ | ✅ importPMD:70; getImportedPMD parse | NONE | dental-pmd.test.ts:469; dental-pmd.data-portability.test.ts:98,117 | VERIFIED | 🟢 |
| **EF-PMD-001 / AC-PMD-003** import checksum verify (sha256 of content); mismatch → 422 CHECKSUM_MISMATCH; optional | ✅ | ✅ importPMD:49 | NONE | dental-pmd.test.ts:499,519,540 | VERIFIED | 🟢 |
| **EF-PMD-005 / V-PMD-010** sourceDescription required + persisted; max 200 → 422 | ✅ | ✅ importPMD:41,74 | NONE | dental-pmd.test.ts:416,452 | VERIFIED | 🟢 |
| **RBAC import** dentist_owner/associate/staff_full on patient's preferred branch (assertBranchRole) | ✅ | ✅ importPMD:65 | NONE | dental-pmd.test.ts (import 201/400) | VERIFIED | 🟢 |
| **V-PMD-007** PHI movement audit rows: pmd.generate + pmd.generated (DE-017) / pmd.import / pmd.export; no row on failure | ✅ | ✅ all write handlers logAuditEvent | NONE | dental-pmd-events.test.ts:104,148,184 (rows + negatives) | VERIFIED | 🟢 |
| **V-PMD-008 / EF-PMD-007** patient-self may read/list/export OWN PMDs without branch membership; others need branch access | ✅ | ✅ isPatientSelf branch in getPMDForVisit/listPMDs/listImportedPMDs/exportPMD/exportPatientCareRecord | NONE | dental-pmd-auth.test.ts:251-292 (self-allow + outsider-deny) | VERIFIED | 🟢 |
| **Cross-branch PHI isolation** a FULL-ROLE member of *another* branch (same org) denied the patient's PMDs/care-record | implied | ✅ branch-from-resource (assertBranchAccess) | — | **dental-pmd-auth.test.ts (NEW: getForVisit/export/list/listImported → 403); exportPatientCareRecord.test.ts (NEW: care-record → 403)** | VERIFIED (after new tests) | 🟢 |
| **P2-18 care-record** whole-patient FHIR R4 Bundle export (Composition + Patient + per-visit Encounter/Procedure/Condition/Medication); excludes superseded; self-download; 404 unknown patient; 401 | ✅ | ✅ exportPatientCareRecord + buildCareRecordBundle | NONE | exportPatientCareRecord.test.ts:88-157; care-record/fhir-bundle.test.ts (builder) | VERIFIED | 🟢 |
| **List shape** `{ data, pagination }`; `patientId` query required → 400; empty → `[]` (not 204) | ✅ | ✅ listPMDs/listImportedPMDs | NONE | dental-pmd.test.ts:561-674 | VERIFIED | 🟢 |
| **V-PMD-002** cross-module refs (visit/patient/author/branch) plain UUID, no DB FK; supersedes_id self-FK only | ✅ | ✅ pmd-document.schema | NONE | (schema-by-source) | VERIFIED (by source) | 🟢 |
| **DE-017 PMDGenerated** = synchronous audit-log marker (ADR-006, no bus) | ✅ | ✅ generatePMD:148 (`pmd.generated`, metadata.event DE-017) | partial | dental-pmd-events.test.ts:104 | VERIFIED | 🟢 |

---

## STEP 5 — branchId-auth-boundary check (carry-forward)

**Result: NO HOLE.** Verified by source + grep: **no `branchId` query param is read or trusted in
any dental-pmd handler** (`grep "query('branchId')" / valid('query')` → none). The endpoints are
scoped by `visitId` (path), `patientId` (query), or imported-PMD `id` (path), and branch is always
derived from the resource:

- **Visit-scoped** (`generatePMD`, `getPMDForVisit`, `exportPMD`): branch = `visit.branchId` (via
  `getVisitOrThrow`), then `assertBranchRole`/`assertBranchAccess`.
- **Patient-scoped** (`listPMDs`, `listImportedPMDs`, `getImportedPMD`, `importPMD`,
  `exportPatientCareRecord`): branch = `patient.preferredBranchId` (the patient *resource*'s own
  branch), then `assertBranchAccess`/`assertBranchRole`. The patient is org-scoped, so
  `preferredBranchId` can never cross an org boundary.

This is the **SAFE** pattern (identical posture to dental-imaging). The only gap was a *missing
test*: every deny case used `OUTSIDER`/`OTHER_USER` (no membership *anywhere*), which denies for a
different reason than the invariant under test. Pinned this round with a full-role member of
`OTHER_BRANCH` (see STEP 7 #1). Illegal-state transition (mutating an imported/immutable PMD) is
rejected at the route level (405) and tested.

---

## STEP 7 — Gaps Closed This Round

### REAL test gap closed (adversarial; GREEN — guard already present, now pinned)

| # | Gap | Class | Fix |
|---|-----|-------|-----|
| 1 | **Cross-branch PHI isolation was untested for a *member of another branch*.** All existing deny cases used `OUTSIDER` / `OTHER_USER` (no membership anywhere) — which deny on "no membership" rather than proving the resource-scoped-branch invariant. A full-role `dentist_owner` of a *different* branch in the same org (who passes any role-only check) was never proven denied a `BRANCH_ID` patient's PMDs/care-record. By source the handlers derive branch from `visit.branchId` / `patient.preferredBranchId` and call `assertBranchAccess`, so they ARE safe — but the invariant had no pin (exactly the dental-imaging V-IMG-002 class). | REAL test gap (PHI) | Seeded `OTHER_BRANCH` + `OTHER_BRANCH_DENTIST` (dentist_owner, membership only in `OTHER_BRANCH`). Added 4 cases to `dental-pmd-auth.test.ts` (getPMDForVisit / exportPMD / listPMDs / listImportedPMDs → **403**) + 1 case to `exportPatientCareRecord.test.ts` (care-record → **403**). All GREEN. |

### Doc / registry / comment drift reconciled

| # | Drift | Fix |
|---|-------|-----|
| 2 | **MODULE_SPEC §7 data-requirements listed phantom columns.** Claimed `pmd_document.storage_file_id`/`format_version` and `imported_pmd.branch_id`/`storage_file_id` — none exist (content is stored **inline as JSON**; there is no object-store file flow — API_CONTRACTS V-PMD-006). | Rewrote §7 against `pmd-document.schema.ts` with the real column set for both tables + a reconciliation note; called out "no `branch_id`, no `storage_file_id`" on `imported_pmd`. |
| 3 | **MODULE_SPEC §7.2 import-contract item 1 referenced non-existent `branch_id` / `imported_by_member_id` columns** on `imported_pmd`. | Corrected to "`patient_id` plain UUID only"; noted access is derived from the patient's preferred branch and the importer is audited via the audit log, not a stored column. |
| 4 | **MODULE_SPEC §10 listed the wrong list route + multipart import.** Said `GET /dental/pmd?patientId=` (canonical is `/dental/visits/pmd`, per TypeSpec/routes/SDK — V-PMD-006) and "POST /dental/pmd/import (file upload)" (transport is inline JSON, not multipart). §15 error table omitted IMPORTED_PMD_IMMUTABLE (405), PATIENT_VISIT_MISMATCH, VALIDATION_ERROR, the 204-empty note, and the 403 code. §3 omitted the P2-18 care-record export and the patient-self download branch. | §10 corrected (canonical `/dental/visits/pmd`, inline JSON import, +care-record route, 204 note); §15 replaced with a full code/status table; §3 added the patient-self + P2-18 workflows. |
| 5 | **br-registry dental-pmd block had only BR-021/BR-022 with thin prose** — omitting the implemented+tested enforcement detail and the V/EF/N codes (same class as the dental-perio "whole module thin" / dental-imaging "rule understates the gate" carry-forwards). | Enriched BR-021 (completed/locked-only, sha256, supersede) + BR-022 (route-level 405 IMPORTED_PMD_IMMUTABLE, verbatim store) and ADDED N-PMD-02 (identity binding), EF-PMD-001 (checksum verify), EF-PMD-005 (sourceDescription/200-cap), V-PMD-007 (PHI audit rows), V-PMD-008 (patient-self + cross-branch isolation) — each with `source` + `tests` citations. JSON re-validated. |

---

## Ranked Remaining Gaps (surfaced, NOT closed — out of safe scope)

**Doc / product decisions (not unilaterally changed):**
1. **`getImportedPMD` has no patient-self branch.** `listImportedPMDs` lets a patient list their own
   imported PMDs (V-PMD-008), but `getImportedPMD` requires branch access — so a patient who can see
   the *list* gets 403 reading an item by id. This is an inconsistency, but plausibly intentional
   (the parsed-content detail view is a clinician affordance). Surfaced as a product decision, not
   changed. If patient-self detail read is desired, add the same `isPatientSelf` branch to
   `getImportedPMD` (TDD).
2. **§16/§18 deferred features.** Async PMD generation (`dental_pmd_async_generation`, pg-boss),
   presigned-URL download, multipart file-upload import, and the "PMD ready" patient notification
   (WFG-011) are all unbuilt/deferred. The API_CONTRACTS V-PMD-006 note already documents the
   inline-JSON reality. Surface only — do not build (schema/infra risk).

**REAL test gaps (impl present, assertion not added this round):**
3. **Imported-PMD detail read audit-row pin.** `getImportedPMD` writes a `data-access` audit event,
   but no test asserts the row is persisted (the write/generate/export rows ARE pinned in
   `dental-pmd-events.test.ts`). Low value — mirrors the imaging audit-row gap.
4. **Care-record `superseded`-exclusion pin.** `exportPatientCareRecord` filters out superseded
   PMDs, but no test seeds a re-generated (superseded) PMD and asserts the older snapshot is absent
   from the Bundle. The aggregate-multiple-visits test covers the positive path only.

**KG-backlog:** PMD status FSM, imported-PMD 405 immutability edge, the V-PMD-008 patient-self
branch, and the P2-18 FHIR care-record flow are not modeled as distinct nodes; the existing node
summaries also carry the "Patient medical data" mis-expansion + phantom `/dental/pmd/generate`
route + out-of-scope "recall management" claim (STEP 3). Fix on next KG regeneration.

---

## STEP 8 — Gate

| Gate | Result |
|------|--------|
| `cd services/api-ts && bunx tsc --noEmit` | ✅ 0 errors |
| dental-pmd module suite (`test-with-db.ts`, 8 files) | ✅ **107 pass / 0 fail** (102 baseline + 5 new cross-branch cases) |
| `eslint` (changed test files) | ✅ 0 errors (1 pre-existing unused-var warning on `NONEXISTENT_ID`, untouched by this round) |
| `check:boundaries:dental-pmd` | ✅ no cross-module repo violations |
| br-registry.json | ✅ valid JSON |
| Contract suite (fresh `:7213`, restarted) | ✅ **`dental-pmd.hurl` Success (26 req)**. The 3 failures are **pre-existing environmental, outside this module** (auth-verification + auth-password-reset: mailpit down; billing-lifecycle: Stripe) — identical to the prior seven rounds. |

---

## Files Changed

- `services/api-ts/src/handlers/dental-pmd/dental-pmd-auth.test.ts` — **NEW** `OTHER_BRANCH` + `OTHER_BRANCH_DENTIST` (dentist_owner) member + 4 cross-branch PHI-isolation tests (getPMDForVisit / exportPMD / listPMDs / listImportedPMDs → 403)
- `services/api-ts/src/handlers/dental-pmd/exportPatientCareRecord.test.ts` — **NEW** full-role `OTHER_BRANCH_DENTIST` member + cross-branch care-record 403 test
- `docs/product/modules/dental-pmd/MODULE_SPEC.md` — §3 workflows (+patient-self, +P2-18), §7 data-requirements (real schema, phantom cols removed), §7.2 import-contract (phantom cols removed), §10 canonical list route + inline-JSON + care-record, §15 full error table
- `specs/api/docs/standards/br-registry.json` — dental-pmd block enriched 2 → 7 rules (BR-021/BR-022 detail + N-PMD-02, EF-PMD-001, EF-PMD-005, V-PMD-007, V-PMD-008) with source/test citations
- `docs/audits/modules/MODULE_dental-pmd_AUDIT_2026-06-08.md` — this report
- `docs/audits/MODULE_AUDIT_TRACKER.md` — row 8 verdict + branchId carry-forward result + new cross-module learning
