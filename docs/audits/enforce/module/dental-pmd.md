# dental-pmd — Module Enforcement
<!-- oli-enforce-module v1.0 --strict | run: run-6-strict-2026-05-29 | 2026-05-29 -->

## Summary

- **Findings:** 15 (P0: 2, P1: 7, P2: 4, P3: 1)
- **Service-Layer Pattern:** ABSENT (no `.service.ts`; repos instantiated inline)
- **Compliance Score:** 44/100 (P0 cap applied; 4 new findings vs run-5)
- **Baseline:** run-5 (P0:2, P1:5, P2:3, P3:1, score:49)
- **New findings:** 4 | **Resolved findings:** 0

### Score Breakdown

| Dimension | run-5 | run-6 | Notes |
|-----------|-------|-------|-------|
| Public API completeness | 4/10 | 4/10 | Download missing (P0); listPMDs path mismatch (P1); importPMD 3 gaps (P1) |
| Workflow implementation | 7/10 | 7/10 | WF-021 ✅; WF-022 partial; WF-066 missing |
| Domain term consistency | 6/10 | 5/10 | `source_description` drift + membership.id absent from blob (NEW) |
| State machine enforcement | 9/10 | 9/10 | Visit guard + supersede logic present; signed-PMD miss latent |
| Event publishing | 2/10 | 2/10 | DE-017 never emitted; no observability logs (NEW) |
| Auth / permissions | 9/10 | 9/10 | All handlers auth-gated; assertBranchRole consistent |
| Test coverage (AC) | —/10 | 3/10 | AC-PMD-001 ✅; AC-PMD-002/003/004 ❌ (newly measured) |
| F2 Service-Layer/DI | 3/10 | 3/10 | No `.service.ts`; repos newed inline; no DI |

> P0 cap: two P0 findings bring overall cap to 3 per dimension where they apply. Final score floored accordingly.

---

## Strict §7.1 Data Scope Verification

`generatePMD.ts` assembles `contentSnapshot` JSON blob (lines 58–81). Exact fields vs spec:

| §7.1 Required Field | In contentSnapshot blob? | Notes |
|---------------------|--------------------------|-------|
| `visit.id` (visitId) | ✅ line 59 | |
| `visit.status` | ❌ MISSING | Used as guard (line 50) but not serialized into blob |
| `visit.activatedAt/createdAt` (visitDate) | ✅ line 61 | |
| `visit.branchId` | ❌ MISSING | Passed to DB row separately; not in checksummed blob |
| `treatment.id` | ✅ | |
| `treatment.cdtCode` | ✅ | |
| `treatment.description` | ✅ | |
| `treatment.toothNumber` | ✅ | |
| `treatment.surfaces` | ✅ | |
| `treatment.conditionCode` | ✅ | |
| `treatment.status` | ✅ | |
| `treatment.priceCents` | ✅ | |
| `prescription.id` | ✅ | |
| `prescription.rxNormCode` | ✅ | |
| `prescription.drugName` | ✅ | |
| `prescription.dosage` | ✅ | |
| `prescription.frequency` | ✅ | |
| `membership.id` (author, non-repudiation) | ❌ MISSING FROM BLOB | `authorMemberId` stored in DB row but NOT in `contentSnapshot` — checksum does not protect author identity |
| `patientId` | ✅ | |

**§7.1 STRICT VERDICT — 3 fields excluded from checksummed blob:**
1. `visit.status` — excluded (minor: guard-only field, arguably not needed in portable snapshot)
2. `visit.branchId` — excluded (moderate: branch provenance not integrity-protected)
3. `membership.id` (author) — **excluded** (HIGH: non-repudiation field is the entire rationale for querying dental-org; the SHA-256 hash does not cover the author, undermining HIPAA audit integrity)

Note: Lab orders and imaging studies are **excluded by design** per §7.1 spec footnote. Perio charts also excluded by design. These are NOT findings.

---

## Findings

| ID | Sev | Status | Description | File | Line | Spec Ref |
|----|-----|--------|-------------|------|------|----------|
| EM-PMD-0E600871 | **P0** | KNOWN | `GET /api/v1/dental/pmd/:id/download` contract endpoint missing — no presigned-URL handler registered; `exportPMD` serves `/dental/visits/:visitId/pmd/export` (JSON attachment) which is a different operation | `services/api-ts/src/generated/openapi/routes.ts` | — | API_CONTRACTS §GET `/api/v1/dental/pmd/:id/download`; MODULE_SPEC §16 |
| EM-PMD-422C74FA | **P0** | KNOWN | PATCH/DELETE on `imported_pmd` must return 405 `IMPORTED_PMD_IMMUTABLE` at the **router level** (AC-PMD-002, BR-022) — no route guard exists; framework default will 404 instead of 405 | `services/api-ts/src/generated/openapi/routes.ts` | — | MODULE_SPEC §11 AC-PMD-002; §7.2 invariant 3 |
| EM-PMD-9AB43567 | **P1** | KNOWN | `GET /api/v1/dental/pmd/:patientId` contract path diverges — router registers `listPMDs` at `/dental/visits/pmd` (query-param based), not `/dental/pmd/:patientId` (path-param) | `services/api-ts/src/generated/openapi/routes.ts` | listPMDs block | API_CONTRACTS §GET `/api/v1/dental/pmd/:patientId` |
| EM-PMD-299D050B | **P1** | KNOWN | `POST /api/v1/dental/pmd/import` missing three contract-required behaviours: (a) `multipart/form-data` file upload — handler accepts JSON body only; (b) server-side checksum verification (AC-PMD-003, §7.2 invariant 4) — no checksum validation; (c) `source_description` field (§7.2 invariant 5) — absent from schema and body | `services/api-ts/src/handlers/dental-pmd/importPMD.ts` | all | API_CONTRACTS §POST `/api/v1/dental/pmd/import`; MODULE_SPEC §7.2 inv 4–5; §11 AC-PMD-003 |
| EM-PMD-790A2979 | **P1** | KNOWN | `imported_pmd` table missing `branch_id` and `checksum` fields declared in MODULE_SPEC §7 Data Requirements and §7.2 Import Contract | `services/api-ts/src/handlers/dental-pmd/repos/pmd-document.schema.ts` | 39–50 | MODULE_SPEC §7; §7.2 invariant 4 |
| EM-PMD-55AA0F1E | **P1** | KNOWN | `imported_pmd` has no `branch_id` column — MODULE_SPEC §7.2 invariant 1 requires it stored as plain UUID (no FK); auth for `getImportedPMD`/`listImportedPMDs` falls back to `patient.preferredBranchId` which is fragile and not spec-defined | `services/api-ts/src/handlers/dental-pmd/repos/pmd-document.schema.ts` | 39–50 | MODULE_SPEC §7.2 invariant 1 |
| EM-PMD-C405D767 | **P1** | KNOWN | DE-017 `PMDGenerated` event declared in MODULE_SPEC §10b never published — `generatePMD` has no emit call; patient download-link notifications and dental-audit trail silently skipped | `services/api-ts/src/handlers/dental-pmd/generatePMD.ts` | 83–109 | MODULE_SPEC §10b "Published: DE-017 PMDGenerated (→ notifs, dental-audit)" |
| EM-PMD-B1A3C908 | **P1** | **NEW** | `membership.id` (author — non-repudiation field) excluded from `contentSnapshot` JSON blob — `authorMemberId` stored in DB row but not serialized before `sha256Hex()` call; checksum does not protect author identity; entire rationale for querying dental-org (`getActiveMembershipId`) is undermined | `services/api-ts/src/handlers/dental-pmd/generatePMD.ts` | 58–81 | MODULE_SPEC §7.1 "dental-org (membership): membership.id (author) — Non-repudiation: identifies the clinician who generated the PMD" |
| EM-PMD-D4F90A21 | **P1** | **NEW** | AC-PMD-002 (PATCH imported PMD → 405) has zero test coverage — no test in either test file exercises PATCH/PUT/DELETE on an imported PMD row; gap compounds EM-PMD-422C74FA (missing route guard) | `dental-pmd.test.ts`, `dental-pmd.data-portability.test.ts` | — | MODULE_SPEC §11 AC-PMD-002; §12 Test Expectations |
| EM-PMD-E7C02B55 | **P1** | **NEW** | AC-PMD-004 (PMD content matches snapshot at generation time; future visit edits don't change PMD) has zero test coverage — no test generates PMD, mutates a treatment, then verifies PMD content unchanged | `dental-pmd.test.ts`, `dental-pmd.data-portability.test.ts` | — | MODULE_SPEC §11 AC-PMD-004; §5 BR-021 |
| EM-PMD-C429BD8C | **P2** | KNOWN | Domain term drift: MODULE_SPEC §7 and §7.2 invariant 5 name the field `source_description`; schema uses `source_facility`/`sourceFacility` — external integrations expecting `source_description` receive wrong key | `services/api-ts/src/handlers/dental-pmd/repos/pmd-document.schema.ts` | 42 | MODULE_SPEC §7; §7.2 invariant 5 |
| EM-PMD-D62195FA | **P2** | KNOWN | `pmd_document` schema missing `storage_file_id` and `format_version` fields declared in MODULE_SPEC §7 Data Requirements | `services/api-ts/src/handlers/dental-pmd/repos/pmd-document.schema.ts` | 20–36 | MODULE_SPEC §7 |
| EM-PMD-4C1DFCE1 | **P2** | KNOWN | `safetyFloorMerged` stored as `text('safety_floor_merged')` (`'true'`/`'false'`) instead of `boolean` — manual string coercion is fragile and inconsistent with Drizzle conventions | `services/api-ts/src/handlers/dental-pmd/repos/pmd-document.schema.ts` | 46 | MODULE_SPEC §7.1 |
| EM-PMD-F9D2A170 | **P2** | **NEW** | No structured observability log emits in any handler — §17 declares `dental-pmd.generated (INFO)`, `dental-pmd.imported (INFO)`, `dental-pmd.checksum-failed (WARN)`; logger context is wired (`ctx.set('logger', ...)`) but handlers never call `logger.info('dental-pmd.generated', {pmdId, visitId})` — HIPAA audit trail missing | `generatePMD.ts`, `importPMD.ts` | all | MODULE_SPEC §17 Observability Hooks |
| EM-PMD-F873ABEE | **P3** | KNOWN | No `.service.ts` — `PMDDocumentRepository`/`ImportedPMDRepository` instantiated inline (`new …(db)`) in every handler; no DI or service facade; F2 service-layer pattern absent | `generatePMD.ts`, `importPMD.ts`, `getPMDForVisit.ts`, `exportPMD.ts`, `listPMDs.ts`, `listImportedPMDs.ts` | various | MODULE_MAP §M8; F2 run directive |

---

## Dimension Details

### 1. Public API Completeness

Declared endpoints (API_CONTRACTS): 5

| Endpoint | Status | Evidence |
|----------|--------|----------|
| `POST /api/v1/dental/pmd/generate` → `POST /dental/visits/:visitId/pmd` | ✅ FOUND | `routes.ts` generatePMD block; `generatePMD.ts` |
| `GET /api/v1/dental/pmd/:patientId` | ⚠️ PATH MISMATCH (P1) | Registered at `/dental/visits/pmd?patientId=` (query param); contract expects path param |
| `GET /api/v1/dental/pmd/:id/download` | ❌ MISSING (P0) | No presigned-URL handler; `exportPMD` is JSON attachment at different path |
| `POST /api/v1/dental/pmd/import` | ⚠️ PARTIAL (P1) | Handler exists but JSON-only body, no checksum verification, no `source_description` |
| `GET /api/v1/dental/pmd/imported/:id` | ✅ FOUND | `routes.ts` getImportedPMD block; `getImportedPMD.ts` |

Additional implemented routes (not in API_CONTRACTS):
- `GET /dental/pmd/imported` — `listImportedPMDs` (extension, acceptable)
- `GET /dental/visits/:visitId/pmd` — `getPMDForVisit` (expected by spec, not in contract doc)
- `GET /dental/visits/:visitId/pmd/export` — `exportPMD` (FR12.6 implementation)

### 2. Workflow Implementation

| Workflow | Status | Evidence |
|----------|--------|----------|
| WF-021: Generate PMD | ✅ FOUND | `generatePMD.ts` — visit status guard, snapshot, SHA-256 checksum, supersede logic |
| WF-022: Import external PMD | ⚠️ PARTIAL (P1) | `importPMD.ts` — no checksum verify, no file upload, no `source_description` |
| WF-066: Download PMD | ❌ MISSING (P0) | No presigned-URL handler; `exportPMD` is JSON attachment at a different path |

**§4 Workflow Details:** ABSENT from MODULE_SPEC.md — spec gap. File jumps from §3 to §5; no WF-xxx step sequences.

### 3. Domain Term Consistency

| Spec Term | Code Term | Status |
|-----------|-----------|--------|
| `source_description` | `sourceFacility` / `source_facility` | ❌ DRIFT (P2) |
| `membership.id` in content blob | `authorMemberId` in DB row only | ❌ MISSING FROM BLOB (P1 NEW) |
| `PMDDocument` | `PMDDocument` / `pmdDocuments` | ✅ |
| `ImportedPMD` | `ImportedPMD` / `importedPmds` | ✅ |
| `safetyFloorMerged` (boolean) | `safetyFloorMerged` (text `'true'`/`'false'`) | ⚠️ TYPE MISMATCH (P2) |
| `storage_file_id` | absent | ❌ MISSING (P2) |
| `format_version` | absent | ❌ MISSING (P2) |

### 4. State Machine Enforcement

Spec declares: `PMDDocument: generated (terminal)`. Implementation has `generated → signed → superseded`:

| Transition | Guard | Status |
|------------|-------|--------|
| Visit must be `completed` or `locked` before generation | `generatePMD.ts:50` | ✅ |
| `generated → signed` | `pmd-document.repo.ts sign()` — `.where(eq(status, 'generated'))` | ✅ |
| `generated/signed → superseded` | `supersede()` marks old, inserts new | ✅ |
| `signed PMD` visible to re-generate guard | `findByVisit()` returns only `status = 'generated'` — signed PMDs silently missed | ⚠️ LATENT BUG |
| `imported_pmd` terminal (no PATCH/DELETE) | Router-level 405 guard MISSING | ❌ P0 |

### 5. Event Publishing

| Event | Direction | Status |
|-------|-----------|--------|
| DE-017 `PMDGenerated` | Publish (→ notifs, dental-audit) | ❌ MISSING (P1) |
| DE-002 `VisitCompleted` | Consume (triggers PMD-eligible flag) | N/A — consumed by dental-visit |

### 6. Auth / Permission Enforcement

| Handler | Auth Check | Role Guard | Status |
|---------|-----------|------------|--------|
| `generatePMD` | `user?.id` | `assertBranchRole(['dentist_owner', 'dentist_associate', 'staff_full'])` | ⚠️ `staff_full` not in spec §6 for generate (spec: dentist_owner + dentist_associate only) |
| `importPMD` | `user?.id` | `assertBranchRole(['dentist_owner', 'dentist_associate', 'staff_full'])` | ✅ |
| `getPMDForVisit` | `user?.id` | `assertBranchAccess` | ✅ |
| `listPMDs` | `user?.id` | `assertBranchAccess` | ✅ |
| `listImportedPMDs` | `user?.id` | `assertBranchAccess` | ✅ |
| `getImportedPMD` | `user?.id` | `assertBranchAccess` (via `patient.preferredBranchId`) | ⚠️ fragile — no `branch_id` on imported_pmd row |
| `exportPMD` | `user?.id` | `assertBranchRole(['dentist_owner', 'dentist_associate', 'staff_full'])` | ✅ |

### 7. Test Coverage (Acceptance Criteria)

| AC | Requirement | Test Present | Location |
|----|------------|-------------|----------|
| AC-PMD-001 | Generate PMD for active (not completed) visit → 422 | ✅ | `dental-pmd.test.ts:179` — `returns 400 when visit is not completed or locked` |
| AC-PMD-002 | PATCH imported PMD → 405 | ❌ MISSING | No test anywhere for 405 on PATCH/PUT/DELETE |
| AC-PMD-003 | Checksum mismatch on verify → 422 CHECKSUM_MISMATCH | ❌ MISSING | `importPMD` has no checksum verify; test at line 338 mislabeled `[AC-PMD-03]` tests verbatim storage, not checksum rejection |
| AC-PMD-004 | PMD content matches snapshot at generation time | ❌ MISSING | No mutation-after-generate test |

Additional FR coverage present:
- FR12.1 (CDT codes in content): ✅ `dental-pmd.test.ts:488–540`
- FR12.4 (checksum non-empty + deterministic): ✅ `dental-pmd.test.ts:542–580`
- FR12.5 (import JSON content): ✅ `dental-pmd.data-portability.test.ts:149`
- FR12.6 (export JSON attachment + Content-Disposition): ✅ `dental-pmd.data-portability.test.ts:177`

### 8. UI/UX (§9)

| Component | Path | Status |
|-----------|------|--------|
| `pmd-import.tsx` | `apps/dentalemon/src/features/pmd/components/pmd-import.tsx` | ✅ |
| `pmd-viewer.tsx` | `apps/dentalemon/src/features/pmd/components/pmd-viewer.tsx` | ✅ |
| `pmd-viewer-sheet.tsx` | `apps/dentalemon/src/features/pmd/components/pmd-viewer-sheet.tsx` | ✅ |
| `use-pmd.ts` | `apps/dentalemon/src/features/workspace/hooks/use-pmd.ts` | ✅ |
| `use-share-pmd.ts` | `apps/dentalemon/src/features/workspace/hooks/use-share-pmd.ts` | ✅ |
| Component tests | `pmd-import.test.ts`, `pmd-viewer.test.ts`, `use-pmd.test.ts`, `use-share-pmd.test.ts` | ✅ |

UI section fully satisfied. No gaps vs §9.

### 9. Spec Coverage (All 22 Sections)

| Section | Status |
|---------|--------|
| §1 Overview | ✅ Patient medical dossier, import/export, data portability — all implemented |
| §2 Domain Terms | ✅ PMD, ImportedPMD code-aligned; minor drift noted in findings |
| §3 Workflows | ✅ WF-021 ✅, WF-022 partial, WF-066 missing |
| §4 Workflow Details | ❌ ABSENT from MODULE_SPEC.md — spec gap |
| §5 Business Rules | BR-021 (immutable snapshot) ✅ enforced; BR-022 (imported read-only) ❌ router guard missing |
| §6 Permissions | ⚠️ `staff_full` allowed to generate (spec says dentist only) |
| §7 Data Requirements | ⚠️ `pmd_document` missing `storage_file_id`, `format_version`; `imported_pmd` missing `branch_id`, `checksum` |
| §7.1 Data Scope | ⚠️ 3 fields absent from blob (`visit.status`, `visit.branchId`, `membership.id`) |
| §7.2 Import Contract | ❌ Invariants 1, 3, 4, 5 violated |
| §7b Aggregate Boundaries | ✅ UUID refs; facade pattern used for cross-module access |
| §8 State Transitions | ⚠️ Spec says `generated (terminal)`; impl adds `signed`/`superseded`; signed PMDs missed by re-generate guard |
| §9 UI/UX | ✅ All components and hooks present |
| §10 API | ⚠️ 2 of 5 contract endpoints broken/missing |
| §10b Domain Events | ❌ DE-017 never emitted |
| §11 Acceptance Criteria | ❌ 3 of 4 ACs untested |
| §12 Test Expectations | ⚠️ FR12.1/FR12.4/FR12.5/FR12.6 covered; AC-PMD-002/003/004 not |
| §13 Edge Cases | ❌ GDPR anonymize not implemented; checksum-mismatch path not exercised (no checksum verify); multiple PMDs per visit ✅ |
| §14 Dependencies | ✅ dental-visit, dental-clinical, dental-org facades present |
| §15 Error Handling | ⚠️ `VISIT_NOT_COMPLETED` ✅; `CHECKSUM_MISMATCH` ❌ (no checksum verify); `405 IMPORTED_PMD_IMMUTABLE` ❌ |
| §16 Performance | No timeout/streaming concern — PMD generation is synchronous DB query; acceptable for V1 |
| §17 Observability | ❌ No `dental-pmd.generated` / `dental-pmd.imported` / `dental-pmd.checksum-failed` log emits |
| §18 Feature Flags | N/A — spec declares none |
| §19 Vertical Slice Plan | PMD-S1 ✅, PMD-S2 ❌ (download), PMD-S3 partial (import checksum missing), PMD-S4 not applicable (V1) |
| §20 AI Instructions | N/A — guidance only |

---

## F2: Service-Layer/DI Assessment

**Pattern: ABSENT** (unchanged from run-5)

No `pmd.service.ts` exists. All orchestration lives in handler functions. Repos exist and encapsulate Drizzle — handlers do NOT call Drizzle directly. Handler fatness is moderate (generatePMD.ts ~110 lines contains snapshot assembly and supersede logic).

Same as run-5 baseline — score 3/10.

---

## Stabilization Plan

### Fix Now (P0) — contract-breaking

1. **EM-PMD-0E600871** — Implement `GET /dental/pmd/:id/download` returning presigned S3/MinIO URL (`download_url`, `expires_at`, `filename`, `size_bytes`). Update TypeSpec + regenerate routes.
2. **EM-PMD-422C74FA** — Add `PATCH /dental/pmd/imported/:id` and `DELETE /dental/pmd/imported/:id` routes returning 405 `IMPORTED_PMD_IMMUTABLE` in `routes.ts`.

### Fix Before New Work (P1)

3. **EM-PMD-B1A3C908** *(NEW)* — Include `membershipId` in `contentSnapshot` before `sha256Hex()` call. Mark existing DB rows with a `content_version: 'v1-legacy'` flag or note in `format_version` to distinguish pre-fix checksums.
4. **EM-PMD-9AB43567** — Align `listPMDs` route path with API_CONTRACTS.
5. **EM-PMD-299D050B** — Add `multipart/form-data` file handling to `importPMD`, server-side checksum verification (422 on mismatch), `source_description` required field.
6. **EM-PMD-790A2979 + EM-PMD-55AA0F1E** — Add `branch_id` (UUID, no FK) and `checksum` columns to `imported_pmd`; generate migration.
7. **EM-PMD-C405D767** — Emit DE-017 `PMDGenerated` after successful insert in `generatePMD.ts`.
8. **EM-PMD-D4F90A21** *(NEW)* — Add test: `PATCH /dental/pmd/imported/:id` → 405.
9. **EM-PMD-E7C02B55** *(NEW)* — Add test: generate PMD → mutate treatment → fetch PMD → verify content unchanged (BR-021 / AC-PMD-004).

### Fix When Touching (P2)

10. **EM-PMD-C429BD8C** — Rename `source_facility` → `source_description` in schema + handler (migration required).
11. **EM-PMD-D62195FA** — Add `storage_file_id` and `format_version` to `pmd_document` table.
12. **EM-PMD-4C1DFCE1** — Change `safetyFloorMerged` to `boolean()` in Drizzle schema; remove string coercion.
13. **EM-PMD-F9D2A170** *(NEW)* — Add `logger.info('dental-pmd.generated', { pmdId, visitId })` in `generatePMD.ts` and `logger.info('dental-pmd.imported', ...)` in `importPMD.ts`.

### Track (P3)

14. **EM-PMD-F873ABEE** — Extract `dental-pmd.service.ts` with injected repos; handlers become thin translators.
15. **Spec gap** — Add §4 Workflow Details to MODULE_SPEC.md with WF-021, WF-022, WF-066 step sequences.

---

## What's Next

1. P0 blockers — download endpoint and 405 guard are client-observable contract breaks.
2. Non-repudiation fix (EM-PMD-B1A3C908 NEW) — `membership.id` not in checksum defeats the entire purpose of querying dental-org; highest-impact new finding.
3. AC test gaps — AC-PMD-002 and AC-PMD-004 have zero coverage; add before any new PMD work.
4. `importPMD` contract — JSON-only body + missing checksum breaks AC-PMD-003.
5. DE-017 event — patient notification and audit trail silently broken.
6. After P0+P1 resolved: `/test-contract` to verify Hurl suite, then service-layer refactor (P3).

---

_Reviewed: 2026-05-29_
_Run: run-6-strict-2026-05-29_
_Reviewer: Claude (oli-enforce-module v1.0 --strict)_
