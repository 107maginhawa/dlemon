<!-- oli-version: 1.1 | generated: 2026-05-29 | skill: oli-enforce-module | run: 7 | module: dental-pmd -->

# Enforcement Report: dental-pmd

**Run:** 7 | **Date:** 2026-05-29 | **Skill:** oli-enforce-module v1.1
**Compliance Score:** 62 / 100
**V1 Status:** PARTIAL
**Service Layer Status:** PRESENT

---

## Summary

| Dimension | Score | Status |
|-----------|-------|--------|
| Public API completeness | 9/10 | PASS — all 7 handlers present and registered |
| Workflow implementation | 9/10 | PASS — WF-021, WF-022, WF-066 all have code paths |
| Domain term consistency | 9/10 | PASS — PMD, Checksum, ImportedPMD used correctly |
| State machine enforcement | 8/10 | PASS — terminal states enforced; sign/supersede guarded |
| Event publishing | 3/10 | FAIL — DE-017 PMDGenerated not published |
| Auth/permission enforcement | 3/10 | FAIL — staff_full incorrectly allowed to generate |
| Data schema compliance | 5/10 | PARTIAL — 3 schema gaps, 1 FK violation |
| Import isolation contract | 4/10 | FAIL — FK constraint on patientId; read-path joins |

---

## Route Discovery

All 7 dental-pmd routes discovered in `services/api-ts/src/generated/openapi/routes.ts`. All are protected by `authMiddleware({ roles: ["user"] })` at the router level.

| Route | Method | Auth | Handler |
|-------|--------|------|---------|
| /dental/pmd/import | POST | authMiddleware | importPMD |
| /dental/pmd/imported | GET | authMiddleware | listImportedPMDs |
| /dental/pmd/imported/:id | GET | authMiddleware | getImportedPMD |
| /dental/visits/pmd | GET | authMiddleware | listPMDs |
| /dental/visits/:visitId/pmd | POST | authMiddleware | generatePMD |
| /dental/visits/:visitId/pmd | GET | authMiddleware | getPMDForVisit |
| /dental/visits/:visitId/pmd/export | GET | authMiddleware | exportPMD |

**Note:** PATCH/PUT/DELETE on `/dental/pmd/imported/:id` return 405 via the app-level `registerHandlers` catch-all in `src/core/errors.ts:467` — AC-PMD-002 satisfied.

---

## Public API Completeness

Spec §10 declares 5 endpoints. Cross-referenced against routes.ts and handler registry.

| Declared Endpoint | Status | Implementation |
|-------------------|--------|----------------|
| POST /dental/pmd/generate | FOUND (path differs — see EM-PMD-29598c8a) | POST /dental/visits/:visitId/pmd |
| GET /dental/pmd/:patientId | FOUND (path differs) | GET /dental/visits/pmd?patientId= |
| GET /dental/pmd/:id/download | FOUND (path differs) | GET /dental/visits/:visitId/pmd/export |
| POST /dental/pmd/import | FOUND | /dental/pmd/import |
| GET /dental/pmd/imported/:id | FOUND | /dental/pmd/imported/:id |

All declared operations have corresponding implementations. Path divergences are documented (OpenAPI is ground truth).

---

## Findings

### P0 — Security / Permission Enforcement

---

#### EM-PMD-6e91e277
**Severity:** P0
**Title:** `staff_full` incorrectly permitted to generate PMD
**Description:** `generatePMD.ts` line 44 calls `assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate', 'staff_full'])`. The MODULE_SPEC §6 states "Generate PMD: dentist_owner, dentist_associate" only. The ROLE_PERMISSION_MATRIX (line 88) explicitly marks `staff_full` as not allowed for Generate PMD. Permitting `staff_full` to generate immutable compliance records violates the permission boundary and non-repudiation intent of the module.
**Spec Section:** §6 Permissions; ROLE_PERMISSION_MATRIX
**File:** `services/api-ts/src/handlers/dental-pmd/generatePMD.ts:44`
**Fix:** Change allowed roles to `['dentist_owner', 'dentist_associate']`
**Confidence:** HIGH

---

### P1 — Missing / Incomplete Implementation

---

#### EM-PMD-f6e9a8ca
**Severity:** P1
**Title:** `imported_pmd.patientId` has FK constraint to `patients` table — spec forbids it
**Description:** `pmd-document.schema.ts` line 41: `patientId: uuid('patient_id').notNull().references(() => patients.id)`. MODULE_SPEC §7.2 item 1 explicitly states: "imported PMD rows store `patient_id`, `branch_id`, `imported_by_member_id` as plain UUIDs. No DB FK constraints to `dental_patient`, `dental_branch`, or `dental_membership` tables." The FK constraint couples the imported-pmd aggregate to the live patient table, breaking the import isolation contract. If a patient record is deleted, cascade behavior could destroy compliance records.
**Spec Section:** §7.2 Import Contract item 1
**File:** `services/api-ts/src/handlers/dental-pmd/repos/pmd-document.schema.ts:41`
**Fix:** Remove `.references(() => patients.id)` from `importedPmds.patientId`; keep as plain `uuid('patient_id').notNull()`
**Confidence:** HIGH

---

#### EM-PMD-3796429f
**Severity:** P1
**Title:** `imported_pmd` missing `branch_id` and `imported_by_member_id` columns
**Description:** MODULE_SPEC §7.2 item 1 requires `imported_pmd` to store `branch_id` and `imported_by_member_id` as plain UUIDs (no FK). The `importedPmds` schema (lines 39-51) contains neither column. Without `branch_id`, branch-level authorization for import operations falls back to a live join against the patient's `preferredBranchId` (which itself is a coupling violation). Without `imported_by_member_id`, the non-repudiation audit trail for who performed the import is absent.
**Spec Section:** §7.2 Import Contract item 1; §7 Data Requirements
**File:** `services/api-ts/src/handlers/dental-pmd/repos/pmd-document.schema.ts:39-51`
**Fix:** Add `branchId: uuid('branch_id').notNull()` and `importedByMemberId: uuid('imported_by_member_id').notNull()` to `importedPmds` table as plain UUID fields (no references)
**Confidence:** HIGH

---

#### EM-PMD-21c502f3
**Severity:** P1
**Title:** `pmd_document` missing `storage_file_id` and `format_version` fields
**Description:** MODULE_SPEC §7 Data Requirements specifies `pmd_document` must include: `id, visit_id, patient_id, branch_id, generated_at, checksum (SHA-256), storage_file_id, format_version`. The schema at lines 21-37 is missing `storage_file_id` (required for storage module integration per §14) and `format_version` (required for PMD portability versioning). Without `storage_file_id`, the S3/MinIO download path declared in §16 (Download < 2s via signed URL) cannot be implemented.
**Spec Section:** §7 Data Requirements; §16 Performance
**File:** `services/api-ts/src/handlers/dental-pmd/repos/pmd-document.schema.ts:21-37`
**Fix:** Add `storageFileId: uuid('storage_file_id')` and `formatVersion: text('format_version').notNull().default('1.0')` to `pmdDocuments` table
**Confidence:** HIGH

---

#### EM-PMD-ecb305a7
**Severity:** P1
**Title:** Import checksum is optional — spec requires it; missing checksum must return 422
**Description:** `importPMD.ts` line 38: `if (body.checksum !== undefined)` — checksum is treated as optional. MODULE_SPEC §7.2 item 4 states: "import must provide a checksum field; server verifies it against the uploaded content before creating the row. Missing or mismatched checksum → 422 CHECKSUM_MISMATCH." AC-PMD-003 covers the mismatch case but not the missing-checksum case. The test at line 444 of `dental-pmd.test.ts` explicitly asserts that omitting checksum returns 201 — this test reflects wrong behavior per spec.
**Spec Section:** §7.2 Import Contract item 4; AC-PMD-003; §15 Error Handling
**File:** `services/api-ts/src/handlers/dental-pmd/importPMD.ts:38`
**Confidence:** HIGH

---

### P2 — Domain/Contract/Event Issues

---

#### EM-PMD-de1d7d6a
**Severity:** P2
**Title:** `getImportedPMD` and `listImportedPMDs` JOIN against live `patients` table in read paths
**Description:** Both `getImportedPMD.ts:36` and `listImportedPMDs.ts:26` call `getPatientForPMD(db, stub.patientId)` which queries the live `patients` table to resolve `preferredBranchId` for authorization. MODULE_SPEC §7.2 item 2 states: "the import pipeline must not JOIN imported_pmd rows against any live dental table in read paths." This coupling means that if a patient's `preferredBranchId` changes, the authorization context for previously imported PMDs changes retroactively — violating the read-only, isolated nature of imported records.
**Spec Section:** §7.2 Import Contract item 2
**Files:** `services/api-ts/src/handlers/dental-pmd/getImportedPMD.ts:36`, `services/api-ts/src/handlers/dental-pmd/listImportedPMDs.ts:26`
**Fix:** Store `branch_id` directly on `imported_pmd` at creation time (see EM-PMD-3796429f); use it for auth without joining live tables
**Confidence:** HIGH

---

#### EM-PMD-738820ab
**Severity:** P2
**Title:** DE-017 PMDGenerated event not published
**Description:** MODULE_SPEC §10b declares: "Published: DE-017 PMDGenerated (→ notifs: patient download link, dental-audit)". No event emission code exists anywhere in the `dental-pmd` module or in `generatePMD.ts`. The DOMAIN_MODEL also confirms DE-017 targets `notifs` (patient) and `dental-audit`. Without this event, patients do not receive their download notification, and the audit trail is incomplete.
**Spec Section:** §10b Domain Events
**File:** `services/api-ts/src/handlers/dental-pmd/generatePMD.ts`
**Confidence:** HIGH

---

#### EM-PMD-29598c8a
**Severity:** P2
**Title:** MODULE_SPEC §10 documents stale route paths not matching OpenAPI or implementation
**Description:** MODULE_SPEC §10 lists: `POST /dental/pmd/generate`, `GET /dental/pmd/:patientId`, `GET /dental/pmd/:id/download`. Actual OpenAPI paths are: `POST /dental/visits/:visitId/pmd`, `GET /dental/visits/pmd` (query param), `GET /dental/visits/:visitId/pmd/export`. The spec document is the input for future engineers — stale paths cause confusion and incorrect implementation. OpenAPI (`specs/api/dist/openapi/openapi.json`) is the canonical contract.
**Spec Section:** §10 API Expectations
**File:** `docs/product/modules/dental-pmd/MODULE_SPEC.md:95`
**Fix:** Update MODULE_SPEC §10 to reflect actual OpenAPI paths
**Confidence:** HIGH

---

### P3 — Optional / Deferred

---

#### EM-PMD-6d674faf
**Severity:** P3
**Title:** Observability hooks §17 not emitted
**Description:** MODULE_SPEC §17 declares three observability events: `dental-pmd.generated` (INFO), `dental-pmd.imported` (INFO), `dental-pmd.checksum-failed` (WARN). None of these are emitted in any handler. The logger is injected via `ctx.get('logger')` but never called with these structured event keys. Without these, operations teams cannot monitor PMD generation volume or detect checksum failures without query-level DB inspection.
**Spec Section:** §17 Observability Hooks
**Files:** `generatePMD.ts`, `importPMD.ts`
**Confidence:** HIGH

---

#### EM-PMD-6554ecd6
**Severity:** P3
**Title:** Feature flag `dental_pmd_async_generation` not implemented
**Description:** MODULE_SPEC §18 declares feature flag `dental_pmd_async_generation: false`. No gating code exists in `generatePMD.ts` or elsewhere. The flag is expected to gate async PMD generation via pg-boss. While V1 default is synchronous (false), the flag infrastructure should exist so that enabling it does not require a code change.
**Spec Section:** §18 Feature Flags
**File:** `services/api-ts/src/handlers/dental-pmd/generatePMD.ts`
**Confidence:** MEDIUM

---

## Compliance Score Computation

| Category | Weight | Score | Notes |
|----------|--------|-------|-------|
| Public API completeness | 20% | 18/20 | All handlers present; paths differ from spec doc (not from OpenAPI) |
| Workflow implementation | 15% | 13/15 | WF-021/022/066 all traced to code paths |
| Domain term consistency | 10% | 9/10 | Correct bounded context usage |
| State machine enforcement | 10% | 8/10 | Terminal states correct; sign/supersede guarded |
| Auth/permission enforcement | 20% | 6/20 | P0: staff_full incorrectly allowed to generate |
| Data schema compliance | 15% | 5/15 | 3 missing fields, 1 FK violation |
| Event publishing | 10% | 3/10 | DE-017 not published |
| **TOTAL** | 100% | **62/100** | P0 penalty applied |

**P0 cap applied:** Score cannot exceed 62 while P0 findings remain open.

---

## Finding Inventory

| ID | Severity | Title | Confidence |
|----|----------|-------|------------|
| EM-PMD-6e91e277 | P0 | staff_full incorrectly permitted to generate PMD | HIGH |
| EM-PMD-f6e9a8ca | P1 | imported_pmd.patientId has FK constraint — spec forbids it | HIGH |
| EM-PMD-3796429f | P1 | imported_pmd missing branch_id and imported_by_member_id | HIGH |
| EM-PMD-21c502f3 | P1 | pmd_document missing storage_file_id and format_version | HIGH |
| EM-PMD-ecb305a7 | P1 | Import checksum optional — spec requires it with 422 on missing | HIGH |
| EM-PMD-de1d7d6a | P2 | getImportedPMD/listImportedPMDs JOIN live patients in read paths | HIGH |
| EM-PMD-738820ab | P2 | DE-017 PMDGenerated event not published | HIGH |
| EM-PMD-29598c8a | P2 | MODULE_SPEC §10 has stale route paths (cosmetic — OpenAPI is correct) | HIGH |
| EM-PMD-6d674faf | P3 | Observability hooks §17 not emitted | HIGH |
| EM-PMD-6554ecd6 | P3 | Feature flag dental_pmd_async_generation not gated | MEDIUM |

**Total:** 10 findings — P0=1, P1=4, P2=3, P3=2

---

## Stabilization Plan

### Fix Now (P0 — blocks V1 readiness)
- **EM-PMD-6e91e277:** Remove `staff_full` from `generatePMD` allowed roles. 1-line fix in `generatePMD.ts:44`.

### Fix Before New Work (P1)
- **EM-PMD-f6e9a8ca:** Remove FK on `imported_pmd.patientId` — migration required
- **EM-PMD-3796429f:** Add `branch_id` and `imported_by_member_id` to `imported_pmd` — migration + handler update
- **EM-PMD-21c502f3:** Add `storage_file_id` and `format_version` to `pmd_document` — migration
- **EM-PMD-ecb305a7:** Make checksum required in `importPMD`; update validator + tests

### Fix When Touching (P2)
- **EM-PMD-de1d7d6a:** After EM-PMD-3796429f is fixed (branch_id on imported_pmd), use stored branch_id for auth instead of joining live patients table
- **EM-PMD-738820ab:** Emit DE-017 after successful PMD generation
- **EM-PMD-29598c8a:** Update MODULE_SPEC §10 to reflect actual OpenAPI paths

### Track (P3)
- **EM-PMD-6d674faf:** Add structured logger calls to generatePMD and importPMD
- **EM-PMD-6554ecd6:** Add feature flag gate in generatePMD

---

## What's Next

1. **Immediate:** Fix EM-PMD-6e91e277 (P0 permission) — 1-line change in `generatePMD.ts:44`
2. **Migration sprint:** Address P1 schema gaps together in a single DB migration (EM-PMD-f6e9a8ca + EM-PMD-3796429f + EM-PMD-21c502f3)
3. **Logic sprint:** Fix import checksum requirement (EM-PMD-ecb305a7) + event publishing (EM-PMD-738820ab)
4. **Re-run:** `oli-enforce-module --module=dental-pmd` after P0+P1 fixes to verify score >= 80

**Route to READY:** Fix P0 + 4x P1. Expected score after fixes: ~84/100.
