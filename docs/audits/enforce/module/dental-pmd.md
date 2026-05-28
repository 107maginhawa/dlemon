# dental-pmd — Module Enforcement
<!-- oli-enforce-module v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->

## Summary

- **Findings:** 11 (P0: 2, P1: 5, P2: 3, P3: 1)
- **Service-Layer Pattern:** ABSENT (no `.service.ts`; repos instantiated inline)
- **Compliance Score:** 49/100 (P0 cap applied: API+contract breaks in 5 dimensions)

### Score Breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Public API completeness | 4/10 | 3 endpoints broken or path-mismatched; download missing |
| Workflow implementation | 7/10 | WF-021 + WF-022 core logic present; WF-066 download unimplemented |
| Domain term consistency | 6/10 | `source_description` → `source_facility` drift; `safetyFloorMerged` bool-as-text |
| State machine enforcement | 9/10 | Visit status guard present; `sign` transition guarded; supersede logic correct |
| Event publishing | 2/10 | DE-017 PMDGenerated never emitted |
| Auth/permissions | 9/10 | All handlers require auth; `assertBranchRole`/`assertBranchAccess` consistently applied |
| F2 Service-Layer/DI | 3/10 | No `.service.ts`; repos newed inline; no DI |

> P0 cap: two P0 findings bring overall cap to 3 per dimension where they apply. Final score floored accordingly.

---

---

## Findings

| ID | Sev | Description | File | Line | Spec Ref |
|----|-----|-------------|------|------|----------|
| EM-PMD-0E600871 | **P0** | `GET /api/v1/dental/pmd/:id/download` contract endpoint missing — no presigned-URL handler registered; `exportPMD` serves `/dental/visits/:visitId/pmd/export` (JSON attachment) which is a different operation | `services/api-ts/src/generated/openapi/routes.ts` | — | API_CONTRACTS §GET `/api/v1/dental/pmd/:id/download`; MODULE_SPEC §16 |
| EM-PMD-422C74FA | **P0** | PATCH/DELETE on `imported_pmd` must return 405 `IMPORTED_PMD_IMMUTABLE` at the **router level** (AC-PMD-002, BR-022) — no route guard exists; framework default will 404 instead of 405 | `services/api-ts/src/generated/openapi/routes.ts` | — | MODULE_SPEC §11 AC-PMD-002; §7.2 invariant 3 |
| EM-PMD-9AB43567 | **P1** | `GET /api/v1/dental/pmd/:patientId` contract path diverges — router registers `listPMDs` at `/dental/visits/pmd` (query-param based), not `/dental/pmd/:patientId` (path-param) | `services/api-ts/src/generated/openapi/routes.ts` | listPMDs block | API_CONTRACTS §GET `/api/v1/dental/pmd/:patientId` |
| EM-PMD-299D050B | **P1** | `POST /api/v1/dental/pmd/import` missing three contract-required behaviours: (a) `multipart/form-data` file upload — handler accepts JSON body only; (b) server-side checksum verification (AC-PMD-003, §7.2 invariant 4) — no checksum validation; (c) `source_description` field (§7.2 invariant 5) — absent from schema and body | `services/api-ts/src/handlers/dental-pmd/importPMD.ts` | all | API_CONTRACTS §POST `/api/v1/dental/pmd/import`; MODULE_SPEC §7.2 inv 4–5; §11 AC-PMD-003 |
| EM-PMD-790A2979 | **P1** | `imported_pmd` table missing `branch_id` and `checksum` fields declared in MODULE_SPEC §7 Data Requirements and §7.2 Import Contract | `services/api-ts/src/handlers/dental-pmd/repos/pmd-document.schema.ts` | 39–50 | MODULE_SPEC §7; §7.2 invariant 4 |
| EM-PMD-55AA0F1E | **P1** | `imported_pmd` has no `branch_id` column — MODULE_SPEC §7.2 invariant 1 requires it stored as a plain UUID (no FK); auth for `getImportedPMD` / `listImportedPMDs` falls back to `patient.preferredBranchId` which is fragile and not spec-defined | `services/api-ts/src/handlers/dental-pmd/repos/pmd-document.schema.ts` | 39–50 | MODULE_SPEC §7.2 invariant 1 |
| EM-PMD-C405D767 | **P1** | DE-017 `PMDGenerated` event declared in MODULE_SPEC §10b never published — `generatePMD` has no emit call; patient download-link notifications and dental-audit trail silently skipped | `services/api-ts/src/handlers/dental-pmd/generatePMD.ts` | 83–109 | MODULE_SPEC §10b "Published: DE-017 PMDGenerated (→ notifs, dental-audit)" |
| EM-PMD-C429BD8C | **P2** | Domain term drift: MODULE_SPEC §7 and §7.2 invariant 5 name the field `source_description`; schema uses `source_facility` / `sourceFacility` — external integrations expecting `source_description` receive wrong key | `services/api-ts/src/handlers/dental-pmd/repos/pmd-document.schema.ts` | 42 | MODULE_SPEC §7; §7.2 invariant 5 |
| EM-PMD-D62195FA | **P2** | `pmd_document` schema missing `storage_file_id` and `format_version` fields declared in MODULE_SPEC §7 Data Requirements | `services/api-ts/src/handlers/dental-pmd/repos/pmd-document.schema.ts` | 20–36 | MODULE_SPEC §7 "`pmd_document`: … storage_file_id, format_version" |
| EM-PMD-4C1DFCE1 | **P2** | `safetyFloorMerged` stored as `text('safety_floor_merged')` (`'true'`/`'false'`) instead of `boolean` — manual string coercion in handler and repo is fragile and inconsistent with Drizzle conventions | `services/api-ts/src/handlers/dental-pmd/repos/pmd-document.schema.ts` | 46 | MODULE_SPEC §7.1 |
| EM-PMD-F873ABEE | **P3** | No `.service.ts` — `PMDDocumentRepository` / `ImportedPMDRepository` instantiated inline (`new …(db)`) in every handler; no DI or service facade; F2 service-layer pattern absent | `generatePMD.ts`, `importPMD.ts`, `getPMDForVisit.ts`, `exportPMD.ts`, `listPMDs.ts`, `listImportedPMDs.ts` | various | MODULE_MAP §M8; F2 run directive |

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

Additional implemented routes (not in API_CONTRACTS; present in routes.ts):
- `GET /dental/pmd/imported` — `listImportedPMDs` (extension, acceptable)
- `GET /dental/visits/:visitId/pmd` — `getPMDForVisit` (expected by spec, not in contract doc)
- `GET /dental/visits/:visitId/pmd/export` — `exportPMD` (FR12.6 implementation)

### 2. Workflow Implementation

| Workflow | Status | Evidence |
|----------|--------|----------|
| WF-021: Generate PMD | ✅ FOUND | `generatePMD.ts` — visit status guard, snapshot, SHA-256 checksum, supersede logic |
| WF-022: Import external PMD | ⚠️ PARTIAL (P1) | `importPMD.ts` — no checksum verify, no file upload, no `source_description` |
| WF-066: Download PMD | ❌ MISSING (P0) | No presigned-URL handler; export is JSON not S3 signed URL |

### 3. Domain Term Consistency

| Spec Term | Code Term | Status |
|-----------|-----------|--------|
| `source_description` | `sourceFacility` / `source_facility` | ❌ DRIFT (P2) |
| `PMDDocument` | `PMDDocument` | ✅ |
| `ImportedPMD` | `ImportedPMD` | ✅ |
| `safetyFloorMerged` (boolean) | `safetyFloorMerged` (text `'true'`/`'false'`) | ⚠️ TYPE MISMATCH (P2) |
| `storage_file_id` | absent | ❌ MISSING (P2) |
| `format_version` | absent | ❌ MISSING (P2) |

### 4. State Machine Enforcement

Spec declares: `PMDDocument: generated (terminal)`. Implementation has `generated → signed → superseded`:

| Transition | Guard | Status |
|------------|-------|--------|
| Visit must be `completed` or `locked` before generation | `generatePMD.ts:50` | ✅ |
| `generated → signed` | `pmd-document.repo.ts sign()` — `.where(eq(status, 'generated'))` | ✅ |
| `generated/signed → superseded` | `supersede()` marks old as superseded, inserts new | ✅ |
| `signed → superseded` blocked | `findByVisit()` only returns `status = 'generated'` — signed PMDs silently missed by re-generate | ⚠️ LATENT BUG |
| `imported_pmd` terminal (read-only, no PATCH/DELETE) | Router-level 405 guard MISSING | ❌ P0 |

### 5. Event Publishing

| Event | Direction | Status |
|-------|-----------|--------|
| DE-017 `PMDGenerated` | Publish (→ notifs, dental-audit) | ❌ MISSING (P1) |
| DE-002 `VisitCompleted` | Consume (triggers PMD-eligible flag) | N/A — consumed by dental-visit |

### 6. Auth / Permission Enforcement

All 7 handlers verified against ROLE_PERMISSION_MATRIX and MODULE_SPEC §6:

| Handler | Auth Check | Role Guard | Status |
|---------|-----------|------------|--------|
| `generatePMD` | `user?.id` | `assertBranchRole(['dentist_owner', 'dentist_associate', 'staff_full'])` | ⚠️ `staff_full` not in spec for generate |
| `importPMD` | `user?.id` | `assertBranchRole(['dentist_owner', 'dentist_associate', 'staff_full'])` | ✅ |
| `getPMDForVisit` | `user?.id` | `assertBranchAccess` | ✅ |
| `listPMDs` | `user?.id` | `assertBranchAccess` | ✅ |
| `listImportedPMDs` | `user?.id` | `assertBranchAccess` | ✅ |
| `getImportedPMD` | `user?.id` | `assertBranchAccess` | ✅ |
| `exportPMD` | `user?.id` | `assertBranchRole(['dentist_owner', 'dentist_associate', 'staff_full'])` | ✅ |

All routes protected by `authMiddleware({ roles: ["user"] })` at generated-routes level.

---

## F2: Service-Layer/DI Assessment

**Pattern: ABSENT**

### Evidence

No `.service.ts` file exists in `services/api-ts/src/handlers/dental-pmd/`. Directory:

```
dental-pmd/
├── dental-pmd.data-portability.test.ts
├── dental-pmd.test.ts
├── exportPMD.ts
├── generatePMD.ts
├── getImportedPMD.ts
├── getPMDForVisit.ts
├── importPMD.ts
├── listImportedPMDs.ts
├── listPMDs.ts
└── repos/
    ├── imported-pmd.repo.ts       ✅ repo exists
    ├── pmd-document.repo.ts       ✅ repo exists
    └── pmd-document.schema.ts
```

### Handler Fatness

Handlers are **moderately fat** — business logic embedded inline:

```typescript
// generatePMD.ts:83 — repo instantiated ad-hoc, not injected
const pmdRepo = new PMDDocumentRepository(db);

// generatePMD.ts:86–107 — supersede-or-create business logic in handler body
const existing = await pmdRepo.findByVisit(visitId);
let pmd;
if (existing) {
  pmd = await pmdRepo.supersede(existing.id, { ... });
} else {
  pmd = await pmdRepo.createOne({ ... });
}
```

Same pattern (`new PMDDocumentRepository(db)` or `new ImportedPMDRepository(db)`) in all 7 handlers.

### Direct Drizzle vs Repository

Repos exist and encapsulate Drizzle. Handlers do NOT call Drizzle directly — except one: `getImportedPMD.ts:27` runs a probe `db.select()` before delegating to the repo (lightweight stub optimization). Acceptable but inconsistent.

### DI Pattern

None. No container, factory, or constructor injection. Handlers extract `db` from context and construct repos themselves.

### Recommendation

Introduce `dental-pmd.service.ts` exposing named methods (`generatePMD`, `importPMD`, `getByVisit`, …). Handlers become thin request/response translators. Enables unit testing with injected mock repos without full HTTP stack.

---

## Stabilization Plan

### Fix Now (P0) — contract-breaking

1. **EM-PMD-0E600871** — Implement `GET /dental/pmd/:id/download` returning presigned S3/MinIO URL (`download_url`, `expires_at`, `filename`, `size_bytes`). Update TypeSpec + regenerate routes.
2. **EM-PMD-422C74FA** — Add `PATCH /dental/pmd/imported/:id` and `DELETE /dental/pmd/imported/:id` routes returning 405 `IMPORTED_PMD_IMMUTABLE` in `routes.ts`.

### Fix Before New Work (P1)

3. **EM-PMD-9AB43567** — Align `listPMDs` route path with contract, or update API_CONTRACTS to match `/dental/pmd?patientId=`.
4. **EM-PMD-299D050B** — Add `multipart/form-data` file handling to `importPMD`, server-side checksum verification (422 on mismatch), `source_description` required field.
5. **EM-PMD-790A2979 + EM-PMD-55AA0F1E** — Add `branch_id` (UUID, no FK) and `checksum` columns to `imported_pmd`; generate migration.
6. **EM-PMD-C405D767** — Emit DE-017 `PMDGenerated` after successful insert in `generatePMD.ts`.

### Fix When Touching (P2)

7. **EM-PMD-C429BD8C** — Rename `source_facility` → `source_description` in schema + handler (migration required).
8. **EM-PMD-D62195FA** — Add `storage_file_id` and `format_version` to `pmd_document` table.
9. **EM-PMD-4C1DFCE1** — Change `safetyFloorMerged` to `boolean()` in Drizzle schema; remove string coercion.

### Track (P3)

10. **EM-PMD-F873ABEE** — Extract `dental-pmd.service.ts` with injected repos.

---

## What's Next

1. P0 blockers first — download endpoint and 405 guards are client-observable contract breaks.
2. `importPMD` contract — JSON-only body + missing checksum verification breaks AC-PMD-003.
3. DE-017 event — patient notification path silently broken until emitted.
4. After P0+P1 resolved: `/test-contract` to verify Hurl suite, then service-layer refactor (P3).

---

_Reviewed: 2026-05-28_
_Run: run-5-f2-service-layer-di_
_Reviewer: Claude (oli-enforce-module v1.0)_
