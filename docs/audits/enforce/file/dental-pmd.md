<!-- oli-version: 1.1 | generated: 2026-05-29 | skill: oli-enforce-file --module=dental-pmd -->

# dental-pmd — File Enforcement

## Run-7 Spec-Routing Audit (2026-05-29)

**Module:** dental-pmd | **Files Inspected:** 14 | **Finding ID Format:** EF-PMD-{hash8}  
**Specs Loaded:** MODULE_SPEC.md, API_CONTRACTS.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md, ROLE_PERMISSION_MATRIX.md, MODULE_MAP.md, ERROR_TAXONOMY.md

### File Inventory & Classification (Run-7)

| File | Type | Specs Loaded |
|------|------|-------------|
| `generatePMD.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| `importPMD.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| `listPMDs.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| `getPMDForVisit.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| `getImportedPMD.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| `exportPMD.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| `listImportedPMDs.ts` | Handler | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| `index.ts` | Barrel | MODULE_SPEC |
| `repos/pmd-document.schema.ts` | Schema | DOMAIN_MODEL + MODULE_SPEC |
| `repos/pmd-document.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| `repos/imported-pmd.repo.ts` | Repository | MODULE_SPEC + DOMAIN_MODEL |
| `dental-pmd.test.ts` | Test | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| `dental-pmd.data-portability.test.ts` | Test | MODULE_SPEC + API_CONTRACTS + WORKFLOW_MAP |
| `repos/pmd-document.test.ts` | Test (repo) | MODULE_SPEC + DOMAIN_MODEL |

### Summary (Run-7)

| Severity | Count |
|----------|-------|
| P0 | 0 |
| P1 | 4 |
| P2 | 3 |
| P3 | 1 |
| **Total** | **8** |

Module traceability: 12/14 files clean (85.7%). EF-PMD-008 (barrel export) confirmed fixed.

### P0 — Security (Run-7)

_No P0 security violations. No middleware/guard files in this module._

### P1 — Spec-Declared Method / Error / Schema Gaps (Run-7)

#### EF-PMD-25AD9EA1 — `generatePMD.ts` line 51: Wrong error class for non-completed visit
**Check:** error_taxonomy | **Confidence:** HIGH  
**Spec:** ERROR_TAXONOMY.md §5 → dental-pmd: `VISIT_NOT_COMPLETED` (HTTP 422); API_CONTRACTS.md → generatePMD Errors  
`ValidationError` (HTTP 400, code `VALIDATION_ERROR`) is thrown when visit is not completed. The ERROR_TAXONOMY defines `VISIT_NOT_COMPLETED` as HTTP 422 for this exact trigger (BR-021). The test at line 187 also asserts `toBe(400)` — both handler and test are wrong.  
**Fix:** Replace with `throw new BusinessLogicError('Visit must be completed to generate a PMD', 'VISIT_NOT_COMPLETED')` and update test to `toBe(422)`.

#### EF-PMD-D6A6DB0D — `pmd-document.schema.ts` line 23: DB-level FK to dental_visit violates loose coupling spec
**Check:** import_boundaries | **Confidence:** HIGH  
**Spec:** MODULE_SPEC.md §20 AI Instructions point 2  
`visitId: uuid('visit_id').notNull().references(() => dentalVisits.id)` creates a hard DB FK to `dental_visit`. MODULE_SPEC AI Instructions §20 point 2 explicitly states "No DB-level FKs to dental-visit (loose coupling) — use UUID ref only."  
**Fix:** Remove `.references(() => dentalVisits.id)`. Remove `dentalVisits` import. Generate migration.

#### EF-PMD-76E6000C — `pmd-document.schema.ts` lines 39–50: importedPmds missing branch_id and imported_by_member_id
**Check:** data_shapes | **Confidence:** HIGH  
**Spec:** MODULE_SPEC.md §7, §7.2 invariant 1  
MODULE_SPEC §7 declares `imported_pmd` requires `branch_id`. MODULE_SPEC §7.2 invariant 1 requires `imported_by_member_id` as a plain UUID. Neither column is present in the schema. `checksum` column is also absent (§7 data requirements).  
**Fix:** Add `branchId: uuid('branch_id').notNull()`, `importedByMemberId: uuid('imported_by_member_id').notNull()`, `checksum: text('checksum')`. Generate migration.

#### EF-PMD-3707DF48 — `pmd-document.schema.ts` line 41: importedPmds.patientId has FK constraint (forbidden by spec)
**Check:** data_shapes | **Confidence:** HIGH  
**Spec:** MODULE_SPEC.md §7.2 invariant 1  
`patientId: uuid('patient_id').notNull().references(() => patients.id)` — MODULE_SPEC §7.2 invariant 1 explicitly forbids DB FK constraints to `dental_patient`, `dental_branch`, or `dental_membership` tables for imported PMD rows. Must be a plain UUID column.  
**Fix:** Remove `.references(() => patients.id)`. Remove `patients` import from schema file. Generate migration.

### P2 — Domain Drift / Data Shape / Role (Run-7)

#### EF-PMD-4470666B — `generatePMD.ts` line 44: staff_full incorrectly granted PMD generation
**Check:** import_boundaries (role check) | **Confidence:** HIGH  
**Spec:** ROLE_PERMISSION_MATRIX.md §Administrative Operations, MODULE_SPEC.md §6  
`assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate', 'staff_full'])` — ROLE_PERMISSION_MATRIX lists Generate PMD as `dentist_owner ✅`, `dentist_associate ✅` only. `staff_full` is not permitted.  
**Fix:** Change to `['dentist_owner', 'dentist_associate']`.

#### EF-PMD-2731F09D — `generatePMD.ts` line 112: Response missing download_url and expires_at
**Check:** data_shapes | **Confidence:** HIGH  
**Spec:** API_CONTRACTS.md → POST /dental/pmd/generate Response 201  
Raw repo row returned without `download_url` (presigned URL, 24h TTL) or `expires_at`. API_CONTRACTS Response 201 requires both fields.  
**Fix:** After creating PMD, generate presigned URL via storage module and include `download_url` + `expires_at` in response (or stub with TODO if deferred).

#### EF-PMD-C049B96C — `pmd-document.schema.ts` line 26: branchId is nullable
**Check:** data_shapes | **Confidence:** HIGH  
**Spec:** MODULE_SPEC.md §7  
`branchId: uuid('branch_id').references(() => dentalBranches.id)` has no `.notNull()`. MODULE_SPEC §7 lists `branch_id` as required for `pmd_document`.  
**Fix:** Add `.notNull()` constraint. Generate migration.

### P3 — Advisory (Run-7)

#### EF-PMD-8F3E8A38 — No WF-ID annotations in any handler file
**Check:** workflow_annotations | **Confidence:** MEDIUM  
**Spec:** WORKFLOW_MAP.md WF-021, WF-022  
Zero `// WF-021` or `// WF-022` annotations across all 7 handler files. 0% adoption, below 5% activation gate. Advisory only.  
**Fix:** Add `// WF-021` to `generatePMD.ts` and `// WF-022` to `importPMD.ts`.

### EF-PMD-008 Fix Verification (Run-7)

CONFIRMED FIXED. `index.ts` barrel re-exports all 7 handlers (`exportPMD`, `generatePMD`, `getImportedPMD`, `getPMDForVisit`, `importPMD`, `listImportedPMDs`, `listPMDs`).

### What's Next (Run-7)

P1 findings present. **Resolve spec-declared method gaps before merge.**

Priority: EF-PMD-D6A6DB0D → EF-PMD-3707DF48 → EF-PMD-76E6000C → EF-PMD-25AD9EA1 → EF-PMD-4470666B → EF-PMD-2731F09D → EF-PMD-C049B96C → EF-PMD-8F3E8A38 (advisory)

---

## Run-6 Strict Audit (2026-05-29)

### Summary

| Severity | Count |
|----------|-------|
| P0 | 3 |
| P1 | 3 |
| P2 | 1 |
| P3 | 1 |

---

### P0 Findings (Blocking)

#### EF-PMD-001 — `importPMD.ts`: No server-side checksum verification
**File:** `services/api-ts/src/handlers/dental-pmd/importPMD.ts`
**Spec ref:** §7.2 Import Contract, invariant 4

The handler accepts a `checksum` field (present in `ImportPMDBody` validator) but **never reads `body.checksum`** and **never verifies it against the uploaded content**. The repo `createOne` call does not receive or store a checksum argument.

§7.2 mandates: "server verifies it against the uploaded content before creating the row. Missing or mismatched checksum → 422 CHECKSUM_MISMATCH."

Current code passes `patientId`, `sourceFacility`, `sourceReference`, `content` to repo — `body.checksum` is ignored entirely.

**Required fix:** Compute `sha256(body.content)`, compare to `body.checksum`; throw `ValidationError('CHECKSUM_MISMATCH')` with 422 on mismatch or absence.

---

#### EF-PMD-002 — Router: No 405 enforcement on imported_pmd routes
**Spec ref:** §7.2 Import Contract, invariant 3

§7.2: "Router must reject PATCH/PUT/DELETE at the route level (405 Method Not Allowed, not a 403)."

Grep across all non-test handler files for `405`, `METHOD_NOT_ALLOWED`, `PATCH`, `DELETE` returned **no output**. No 405 enforcement exists for `imported_pmd` routes.

**Required fix:** Register `.on(['PATCH','PUT','DELETE'], '/dental/pmd/import*', ...)` returning 405 in the router.

---

#### EF-PMD-003 — `imported-pmd.repo.ts`: `markSafetyFloorMerged` violates read-only invariant
**File:** `services/api-ts/src/handlers/dental-pmd/repos/imported-pmd.repo.ts`
**Spec ref:** §7.2 Import Contract, invariant 3

§7.2: "no UPDATE or DELETE operations on imported_pmd rows after creation." The repo exposes `markSafetyFloorMerged()` which issues `UPDATE imported_pmd SET safety_floor_merged = 'true'`. This is a post-creation mutation and directly violates the invariant.

**Note:** If this mutation is intentionally scoped as a separate compliance step, §7.2 must be updated to carve out this exception. As written, it is a P0 contract violation.

---

### P1 Findings (High Priority)

#### EF-PMD-004 — `generatePMD.ts`: `authorMemberId` not included in checksummed content
**File:** `services/api-ts/src/handlers/dental-pmd/generatePMD.ts`
**Spec ref:** §7.1 Data Scope — `dental-org (membership)`: "membership.id (author) — Non-repudiation: identifies the clinician who generated the PMD"

`authorMemberId` is stored in the DB column but is **not included in the `contentSnapshot` JSON** that is fed to `sha256Hex()`. The non-repudiation identity of the clinician is therefore not covered by the cryptographic seal, undermining the compliance guarantee.

**Required fix:** Include `authorMemberId: membership.id` in `contentSnapshot` before checksum computation.

---

#### EF-PMD-005 — `importPMD.ts`: `source_description` field absent
**File:** `services/api-ts/src/handlers/dental-pmd/importPMD.ts`
**Spec ref:** §7.2 Import Contract, invariant 5; §7 Data Requirements

§7 specifies `source_description` in the `imported_pmd` schema. §7.2 invariant 5: "the originating system must be identified (e.g., 'Open Dental v21.1', 'Dentrix G7')."

The OpenAPI validator uses `sourceFacility` (facility name) and `sourceReference`. Neither captures the system version identifier required for data provenance audit trail. `source_description` is absent from the body schema.

**Required fix:** Add `sourceDescription` (required, maps to `source_description`) to `ImportPMDBody`, validate non-empty, store it.

---

#### EF-PMD-006 — Test suite: No checksum mismatch coverage; import tests will break after EF-PMD-001 fix
**Files:** `dental-pmd.test.ts`, `dental-pmd.data-portability.test.ts`
**Spec ref:** §12 Test Expectations; MEMORY: feedback_test_verification.md

All import tests submit payloads **without a `checksum` field** and expect 201. Once EF-PMD-001 is fixed, these will fail with 422. Additionally, zero tests assert the 422 CHECKSUM_MISMATCH scenario (missing checksum, wrong checksum).

**Required fix:** (a) Add `checksum` to all valid import test payloads; (b) add test cases asserting 422 on missing/mismatched checksum.

---

### P2 Findings

#### EF-PMD-007 — `exportPMD.ts`: Patient role excluded from download
**File:** `services/api-ts/src/handlers/dental-pmd/exportPMD.ts`
**Spec ref:** §1 Module Overview, §6 Permissions

§1: "patient (download)". `exportPMD` uses `assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate', 'staff_full'])` — patient role is absent.

**Note:** `exportPMD` vs `generatePMD` are correctly distinct (POST creates, GET downloads). No redundancy issue.

---

### P3 Findings

#### EF-PMD-008 — No `index.ts` in handler directory
`dental-pmd` is the only handler module without an `index.ts` re-exporting its handlers. Inconsistent with module conventions; router imports individual files directly.

---

### File Checklist

| File | assertBranch* | Auth | Notes |
|------|--------------|------|-------|
| `generatePMD.ts` | `assertBranchRole` ✅ | ✅ | authorMemberId not in checksummed JSON (P1) |
| `importPMD.ts` | `assertBranchRole` ✅ | ✅ | No checksum verify (P0); source_description missing (P1) |
| `exportPMD.ts` | `assertBranchRole` ✅ | ✅ | Patient role excluded (P2) |
| `getPMDForVisit.ts` | `assertBranchAccess` ✅ | ✅ | OK |
| `getImportedPMD.ts` | `assertBranchAccess` ✅ | ✅ | OK |
| `listPMDs.ts` | `assertBranchAccess` ✅ | ✅ | OK |
| `listImportedPMDs.ts` | `assertBranchAccess` ✅ | ✅ | OK |
| `repos/pmd-document.repo.ts` | n/a | n/a | OK |
| `repos/imported-pmd.repo.ts` | n/a | n/a | markSafetyFloorMerged UPDATE violates read-only (P0) |
| `repos/pmd-document.schema.ts` | n/a | n/a | OK |
| `dental-pmd.test.ts` | n/a | n/a | No checksum mismatch tests (P1) |
| `dental-pmd.data-portability.test.ts` | n/a | n/a | No checksum mismatch tests (P1) |
| `repos/pmd-document.test.ts` | n/a | n/a | OK |

---

### §7.1 Scope Completeness

| Domain | Spec | impl | Gap |
|--------|------|------|-----|
| visit identity (id, status, dates, branchId) | ✅ | ✅ | none |
| treatments (CDT, tooth, surfaces, status, price) | ✅ | ✅ | none |
| prescriptions (rxNorm, drug, dosage, frequency) | ✅ | ✅ | none |
| membership.id author (non-repudiation) | ✅ in DB | ❌ not in checksummed JSON | P1 |
| patientId binding | ✅ | ✅ | none |
| lab orders | excluded by design | absent | OK |
| imaging studies | excluded by design | absent | OK |
| dental_chart tooth state | excluded by design | absent | OK |
| demographics / perio / history | not in §7.1 | absent | OK (out of scope) |

---

### §7.2 Import Contract Compliance

| Invariant | Status | Finding |
|-----------|--------|---------|
| 1. UUID refs only (no FK constraints) | ✅ PASS | No FK constraints on imported_pmd |
| 2. No FK joins in read paths | ✅ PASS | Repo selects from importedPmds only |
| 3. Read-only after import + 405 at router | ❌ FAIL | No 405 routes (EF-PMD-002); markSafetyFloorMerged UPDATE (EF-PMD-003) |
| 4. Checksum required + server verification | ❌ FAIL | body.checksum never read or verified (EF-PMD-001) |
| 5. source_description required | ❌ FAIL | Field absent; sourceFacility is not equivalent (EF-PMD-005) |

**checksum_validated: false | scope_complete: false**

---

## Previous Run (run-5-f2-service-layer-di | 2026-05-28)

## Summary
- Files scanned: 13 (source: 10, tests: 3)
- Findings: 5 (P0: 0, P1: 2, P2: 2, P3: 1)
- Service files present: `.service.ts` ❌, `.repo.ts` ✅ (2 repos: `pmd-document.repo.ts`, `imported-pmd.repo.ts`)

## Findings

| ID | Sev | Description | File | Line |
|----|-----|-------------|------|------|
| EF-PMD-001 | P1 | No `.service.ts` — orchestration logic (patient lookup, branch auth, merge/checksum) spread across individual handler files. `generatePMD.ts` (110 lines) contains document assembly logic; `exportPMD.ts` (63 lines) and `getImportedPMD.ts` (70 lines) each perform multi-step lookups. Service layer needed to centralize PMD business logic. | `generatePMD.ts`, `exportPMD.ts`, `getImportedPMD.ts` | — |
| EF-PMD-002 | P1 | File naming violates camelCase convention: 7 handler files use uppercase `PMD` acronym mid-token (`exportPMD.ts`, `generatePMD.ts`, `getImportedPMD.ts`, `getPMDForVisit.ts`, `importPMD.ts`, `listImportedPMDs.ts`, `listPMDs.ts`). Convention: kebab-case for multi-word handlers (`export-pmd.ts`) or pure camelCase without acronym caps (`exportPmd.ts`). | all 7 listed | — |
| EF-PMD-003 | P2 | Cross-module facade import in handler: `importPMD.ts` directly imports `@/handlers/patient/repos/patient-pmd.facade`. Handler should call a service abstraction, not reach into another module's repo layer. | `importPMD.ts` | 12 |
| EF-PMD-004 | P2 | Cross-module facade import in handler: `listPMDs.ts` directly imports `@/handlers/patient/repos/patient-pmd.facade`. Same boundary concern as EF-PMD-003. | `listPMDs.ts` | 11 |
| EF-PMD-005 | P3 | No `.test.ts` for `imported-pmd.repo.ts`. `repos/pmd-document.test.ts` covers `PMDDocumentRepository` but `ImportedPMDRepository` has no isolated repo-unit test. | `repos/imported-pmd.repo.ts` | — |

## Notes

- No direct `db.insert/select/update/delete` in handler files — all DB ops route through repo classes. ✅
- No cross-module schema (`*.schema`) imports. ✅
- No files exceed 500 lines. ✅
- Largest handler is `generatePMD.ts` at 110 lines; no handler exceeds 300 lines. ✅
- No directory-structure violations (only `repos/` subdirectory, correctly used). ✅
- F2 gap: two solid repos exist as foundation. Adding `dental-pmd.service.ts` wrapping both would close EF-PMD-001 and resolve EF-PMD-003/004 naturally.

## File Inventory

| File | Lines | Role |
|------|-------|------|
| `dental-pmd.test.ts` | 579 | Integration test |
| `dental-pmd.data-portability.test.ts` | 213 | Integration test |
| `repos/pmd-document.test.ts` | 205 | Repo unit test |
| `generatePMD.ts` | 110 | Handler (orchestration-heavy, P1) |
| `repos/pmd-document.repo.ts` | 80 | Repository ✅ |
| `getImportedPMD.ts` | 70 | Handler |
| `exportPMD.ts` | 63 | Handler |
| `repos/pmd-document.schema.ts` | 55 | Schema |
| `repos/imported-pmd.repo.ts` | 52 | Repository ✅ (no test — P3) |
| `importPMD.ts` | 43 | Handler (cross-module import — P2) |
| `listPMDs.ts` | 39 | Handler (cross-module import — P2) |
| `listImportedPMDs.ts` | 39 | Handler |
| `getPMDForVisit.ts` | 32 | Handler |
