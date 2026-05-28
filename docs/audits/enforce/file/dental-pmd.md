# Enforcement Report: dental-pmd

**Generated:** 2026-05-27  
**Skill:** oli-enforce-file  
**Module:** dental-pmd  
**Spec:** docs/product/modules/dental-pmd/MODULE_SPEC.md  
**Contracts:** docs/product/modules/dental-pmd/API_CONTRACTS.md  

---

## Legend

| Symbol | Meaning |
|--------|---------|
| FOUND | Declared spec item implemented and present |
| MISSING | Declared spec item absent or not implemented |
| DEVIATED | Item present but diverges from spec in a breaking/material way |

---

## 1. Declared Endpoints (API_CONTRACTS.md § Endpoints)

| # | Spec Endpoint | Status | Handler File | Notes |
|---|---------------|--------|--------------|-------|
| E-01 | POST /api/v1/dental/pmd/generate | DEVIATED | `generatePMD.ts` | Route mounted as `POST /dental/visits/:visitId/pmd` — path shape diverges from spec (`/pmd/generate` vs `/visits/:visitId/pmd`). The spec body requires `visit_id`, but handler takes `visitId` from path param and omits it from body (test strips it with `.omit({ visitId: true })`). Functionally equivalent but breaks any client generated from spec. |
| E-02 | GET /api/v1/dental/pmd/:patientId | DEVIATED | `listPMDs.ts` | Mounted as `GET /dental/pmd?patientId=...` (query param), not path param. Spec defines `:patientId` as a path parameter. |
| E-03 | GET /api/v1/dental/pmd/:id/download | MISSING | — | No `download` handler file exists. `exportPMD.ts` serves `GET /dental/visits/:visitId/pmd/export` but that is the FR12.6 export, not the presigned-URL download endpoint defined in the contract. Fields `download_url`, `expires_at`, `filename`, `size_bytes` are never returned. |
| E-04 | POST /api/v1/dental/pmd/import | DEVIATED | `importPMD.ts` | Path matches. However, the spec defines the content type as `multipart/form-data` with a `file` field (PDF, XML, max 10 MB). The handler accepts `application/json` with a `content` text field. No file upload, no MIME-type validation, no 10 MB guard. The `source_description` field in spec is mapped to `sourceFacility` + `sourceReference` in implementation — field-name mismatch. |
| E-05 | GET /api/v1/dental/pmd/imported/:id | FOUND | `getImportedPMD.ts` | Path matches. Response shape differs (returns `sourceFacility`/`sourceReference` rather than spec's `source_description`; no `file_url` field). |

---

## 2. Required Request / Response Fields

### POST /dental/pmd/generate — response fields

| Spec Field | Status | Notes |
|------------|--------|-------|
| `id` | FOUND | Returned from `pmdRepo.createOne` |
| `visit_id` | FOUND | Stored as `visitId` (camelCase divergence — API_CONTRACTS uses snake_case) |
| `patient_id` | FOUND | |
| `branch_id` | FOUND | |
| `status` | FOUND | Default `generated` |
| `generated_at` | MISSING | Handler returns raw DB row; `generated_at` is not a column — `createdAt` is. No mapping to `generated_at`. |
| `download_url` | MISSING | Handler returns raw DB row with no presigned URL generation. |
| `expires_at` | MISSING | Never computed or returned. |

### POST /dental/pmd/import — request fields

| Spec Field | Status | Notes |
|------------|--------|-------|
| `file` (multipart) | MISSING | Accepts JSON body, no file upload. |
| `patient_id` | FOUND | |
| `branch_id` | MISSING | Field not accepted or stored in `importedPmds` schema — no `branch_id` column. |
| `source_description` | MISSING | Split into `sourceFacility` + `sourceReference`; field name mismatch. |
| `checksum` | MISSING | Not a field in `ImportPMDBody` validator; `§7.2 Import Contract #4` requires checksum verification — not implemented. |

### POST /dental/pmd/import — response fields (ImportedPMD)

| Spec Field | Status | Notes |
|------------|--------|-------|
| `id` | FOUND | |
| `patient_id` | FOUND | |
| `branch_id` | MISSING | Not in schema or response. |
| `status` | MISSING | Handler returns raw DB row; no `status: "imported"` field exists in `importedPmds` schema. |
| `source_description` | MISSING | Returns `sourceFacility` + `sourceReference` instead. |
| `imported_at` | FOUND | |
| `file_url` | MISSING | No presigned URL generated or returned. |

### GET /dental/pmd/imported/:id — response

| Spec Field | Status | Notes |
|------------|--------|-------|
| `id` | FOUND | |
| `patient_id` | FOUND | |
| `branch_id` | MISSING | Not in schema. |
| `status` | MISSING | No `status` field on imported PMDs. |
| `source_description` | MISSING | Returns `sourceFacility`/`sourceReference`. |
| `imported_at` | FOUND | |
| `file_url` | MISSING | Not returned. |

---

## 3. §7.2 Import Contract — Mandatory Enforcement Points

The MODULE_SPEC §7.2 defines five invariants for the import pipeline. Each is checked here.

| Invariant | Status | Evidence |
|-----------|--------|----------|
| **§7.2 #1 — UUID refs only; no DB FK to `dental_patient`, `dental_branch`, or `dental_membership`** | DEVIATED | `pmd-document.schema.ts:41` — `importedPmds.patientId` is declared with `.references(() => patients.id)`. This is a live DB foreign key to `dental_patient`, directly violating the invariant. `branch_id` is absent from the schema (FK gap covered by missing field). No `imported_by_member_id` stored at all. |
| **§7.2 #2 — No FK joins in read paths** | DEVIATED | `getImportedPMD.ts:31–34` joins `importedPmd.patientId` → `PatientRepository.findOneById` for branch-access check. This is a live JOIN through `dental_patient`. The read path re-joins the live table on every retrieval. |
| **§7.2 #3 — Read-only after import; router must reject PATCH/PUT/DELETE with 405** | MISSING | No route-level 405 rejection exists anywhere in the implementation. `ImportedPMDRepository.markSafetyFloorMerged` performs an `UPDATE` on imported rows (line 45–50 of `imported-pmd.repo.ts`), violating the "no UPDATE" constraint. The spec says 405, not 403. |
| **§7.2 #4 — Checksum required; server verifies against uploaded content; missing/mismatch → 422 CHECKSUM_MISMATCH** | MISSING | `importPMD.ts` accepts no `checksum` field. No verification logic anywhere. AC-PMD-003 ("Checksum mismatch on verify → reject with CHECKSUM_MISMATCH") is untested and unimplemented. |
| **§7.2 #5 — `source_description` required; must identify originating system** | DEVIATED | The spec says `source_description` is required. The implementation uses `sourceFacility` (required) + `sourceReference` (optional). Different field names; `source_description` is missing entirely from schema and validators. The spec's `checksum` field in `POST /dental/pmd/import` is marked `NO` (not required) in API_CONTRACTS but §7.2 says it is required when provided — the implementation provides neither validation path. |

---

## 4. Business Rules

| Rule | Status | Notes |
|------|--------|-------|
| **BR-021 — PMD is a visit snapshot; immutable; checksum verified** | DEVIATED | Snapshot generation is implemented (`generatePMD.ts`). Checksum is computed but uses a **non-cryptographic stub** (`generatePMD.ts:22–27`): sums char codes, pads to hex. NOT SHA-256. Spec §7 explicitly requires SHA-256. The function comment says "In production use node:crypto" — this is a production file, not a demo. |
| **BR-022 — Imported PMD stored read-only; 405 on PUT/PATCH/DELETE** | MISSING | No 405 route-level rejection. `markSafetyFloorMerged` writes to imported rows. |
| **AC-PMD-001 — Generate PMD for active (not completed) visit → 422** | DEVIATED | Handler throws `ValidationError` which maps to 422 (correct), but test `dental-pmd.test.ts:179` asserts `400`. The visit status guard is also ordered **after** the visit fetch and branch-role check but **before** the ValidationError throw at line 53 — this is correct sequencing, but the test expects 400 not 422. |
| **AC-PMD-002 — PATCH imported PMD → 405** | MISSING | Not implemented. |
| **AC-PMD-003 — Checksum mismatch → CHECKSUM_MISMATCH** | MISSING | Not implemented. |
| **AC-PMD-004 — PMD content matches visit snapshot at generation time** | FOUND | Snapshot is serialized and checksummed at creation; content field is immutable. |

---

## 5. Permissions

| Operation | Spec Roles | Status | Notes |
|-----------|-----------|--------|-------|
| Generate PMD | dentist_owner, dentist_associate | DEVIATED | `generatePMD.ts:40` calls `assertBranchRole` with `['dentist_owner', 'dentist_associate', 'staff_full']` — includes `staff_full`, which is not in spec for generation. |
| Import PMD | dentist_owner, dentist_associate, staff_full | FOUND | `importPMD.ts:32` uses same three roles. |
| Download | dentist_owner, dentist_associate, patient (own PMDs) | MISSING | No download endpoint. Patient role never checked anywhere. |
| List PMDs | dentist_owner, dentist_associate | DEVIATED | `listPMDs.ts:30` uses `assertBranchAccess` (not `assertBranchRole`) — no role restriction, any branch member can list. |

---

## 6. Data Schema vs. Spec §7 Requirements

| Spec Field (`pmd_document`) | Status | Notes |
|-----------------------------|--------|-------|
| `id` | FOUND | |
| `visit_id` | FOUND | FK to `dentalVisits` (loose coupling spec says no FK — applies to `imported_pmd`; `pmd_document` FK is acceptable per §7b) |
| `patient_id` | FOUND | FK to `patients` |
| `branch_id` | FOUND | FK to `dentalBranches` (nullable in schema) |
| `generated_at` | MISSING | Spec requires this column; schema has `createdAt` from `baseEntityFields` instead. No alias. |
| `checksum` (SHA-256) | DEVIATED | Column exists; value is not SHA-256 (see BR-021) |
| `storage_file_id` | MISSING | Spec requires this for S3 storage reference. Not in schema. |
| `format_version` | MISSING | Spec requires this. Not in schema. |

| Spec Field (`imported_pmd`) | Status | Notes |
|-----------------------------|--------|-------|
| `id` | FOUND | |
| `patient_id` | DEVIATED | Present but has FK constraint (violates §7.2 #1) |
| `branch_id` | MISSING | Not in schema |
| `imported_at` | FOUND | |
| `storage_file_id` | MISSING | Not in schema |
| `source_description` | MISSING | Split into `sourceFacility`/`sourceReference` |
| `checksum` | MISSING | Not in schema |
| `imported_by_member_id` | MISSING | Not in schema (required by §7.2 non-repudiation) |

---

## 7. Domain Events

| Event | Status | Notes |
|-------|--------|-------|
| DE-017 PMDGenerated | MISSING | MODULE_SPEC §10b declares this event must be published on generation. No event emission exists in `generatePMD.ts`. |
| DE-002 VisitCompleted (consumed) | MISSING | No event subscription or listener registered. |

---

## 8. Additional Bugs Detected

| ID | Severity | Location | Description |
|----|----------|----------|-------------|
| B-01 | BLOCKER | `generatePMD.ts:99` | `membership!.id` uses non-null assertion. If `membership` is `undefined` (user has no active membership for this branch), this throws a runtime `TypeError` instead of returning 403. The auth check at line 40 only verifies branch access, not membership existence. |
| B-02 | BLOCKER | `generatePMD.ts:22–27` | `sha256Hex` is a charcode-sum stub, not SHA-256. Two documents with the same total charcode sum but different content will produce **identical checksums**. Checksum collisions undermine the compliance record. |
| B-03 | BLOCKER | `importPMD.ts:43` | `{ ...imported, safetyFloorMerged: imported.safetyFloorMerged === 'true' }` — coerces the `safetyFloorMerged` text column to boolean in the response, but the DB schema stores it as `text('safety_floor_merged')` not a boolean. If the column returns `'true'` this works; any other truthy string (e.g. `'1'`, `'yes'`) silently returns `false`. This is fragile by design; the column should be `boolean`. |
| B-04 | BLOCKER | `pmd-document.schema.ts:41` | `importedPmds.patientId` has `.references(() => patients.id)` — live FK to `dental_patient`. §7.2 #1 explicitly forbids this. Importing a PMD for a patient that was later deleted (GDPR erasure) will cascade-delete or FK-error the import, destroying compliance records. |
| B-05 | WARNING | `listPMDs.ts:35–37` | Pagination-after-fetch: all rows are fetched from DB then sliced in memory. For patients with many PMDs this fetches unbounded rows. Combine with the missing branch_id filter from the spec query param — any user with branch access can list PMDs without scoping to a branch. |
| B-06 | WARNING | `listImportedPMDs.ts:34–37` | Same pagination-after-fetch pattern as B-05. |
| B-07 | WARNING | `generatePMD.ts:53` | Visit status check (`visit.status !== 'completed' && visit.status !== 'locked'`) occurs **after** the membership lookup (lines 43–51). If a draft visit is submitted, the DB roundtrip to resolve membership runs unnecessarily. More critically: a user with no active membership will hit `membership!.id` crash (B-01) before the status check fires for draft visits. |
| B-08 | WARNING | `exportPMD.ts:53` | `JSON.parse(pmd.content)` is called without a try/catch. If `pmd.content` is not valid JSON (e.g. corrupted row), this throws an unhandled exception returning 500. All other handlers defensively wrap this parse. |
| B-09 | WARNING | `dental-pmd.test.ts:179–188` | Test "returns 400 when visit is not completed or locked" asserts HTTP 400. The handler throws `ValidationError` which in the app maps to 422 (see `AC-PMD-001`). The test is asserting the wrong status code, masking a real spec deviation. |
| B-10 | WARNING | `pmd-document.schema.ts:8` | Schema imports FK references to `dentalVisits`, `patients`, `dentalBranches`, `dentalMemberships`. MODULE_SPEC §20 instruction 2 says "No DB-level FKs to dental-visit (loose coupling)". The `visitId` FK to `dentalVisits` violates this. |

---

## 9. Test Coverage Against Spec Acceptance Criteria

| AC | Description | Test Present | Status |
|----|-------------|--------------|--------|
| AC-PMD-001 | Generate for active visit → 422 | `dental-pmd.test.ts:179` | DEVIATED (asserts 400 not 422) |
| AC-PMD-002 | PATCH imported PMD → 405 | None | MISSING |
| AC-PMD-003 | Checksum mismatch → CHECKSUM_MISMATCH | None | MISSING |
| AC-PMD-004 | PMD content immutable after generation | `dental-pmd.test.ts:208` (supersede test) | PARTIAL (supersede tested, future-edit immutability not tested) |

---

## 10. §7.2 Import Contract — Summary Verdict

**3 of 5 invariants are violated in production code.** The FK constraint on `imported_pmd.patient_id` (§7.2 #1), the live patient JOIN on read paths (§7.2 #2), and the absent checksum verification (§7.2 #4) are all active violations. The missing 405 route-level rejection (§7.2 #3) and field naming mismatch for `source_description` (§7.2 #5) are also non-conformant.

---

## Summary

| Category | FOUND | DEVIATED | MISSING |
|----------|-------|----------|---------|
| Endpoints | 1 | 3 | 1 |
| Request fields | 4 | 0 | 7 |
| Response fields | 8 | 2 | 9 |
| §7.2 Import Contract invariants | 0 | 2 | 3 |
| Business rules | 1 | 2 | 3 |
| Schema fields | 10 | 2 | 7 |
| Domain events | 0 | 0 | 2 |
| **BLOCKER bugs** | | | **4** |
| **WARNING bugs** | | | **6** |

**Overall verdict: DOES NOT CONFORM.** The implementation covers the happy-path generation and list flows at a functional level but diverges materially from the declared API contract (field names, multipart vs JSON, missing presigned URLs), violates three of five §7.2 Import Contract invariants, and contains a non-cryptographic checksum stub that breaks the core integrity guarantee of the module.
