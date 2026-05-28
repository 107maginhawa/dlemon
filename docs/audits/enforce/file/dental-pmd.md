# dental-pmd — File Enforcement
<!-- oli-enforce-file v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->

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
