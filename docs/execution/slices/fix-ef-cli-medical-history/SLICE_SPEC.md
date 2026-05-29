# SLICE SPEC: EF-CLI-001 / EM-CLI-002 — Medical History Immutability

## Problem
`updateMedicalHistoryEntry` implemented a live PATCH on append-only PHI. Any authenticated
caller with the right role could silently mutate medical history entries — violating both
EF-CLI-001 (enforcement finding) and EM-CLI-002 (enforcement enforcement).

## Root Cause
Single root cause: the handler performed a live DB update on `medical_history_entry` rows
that are intended to be append-only PHI records.

## Fix Applied

### Handler: `updateMedicalHistoryEntry.ts`
- Replaced entire handler body with `throw new MethodNotAllowedError(..., 'MEDICAL_HISTORY_IMMUTABLE')`
- Removed all imports that were only needed for the now-deleted implementation
- Handler now unconditionally returns 405 before touching auth, DB, or any business logic

### Repo: `medical-history.repo.ts`
- Guarded `update()` method with a runtime `throw` and `@deprecated` JSDoc
- Prevents any future accidental call from production code paths
- Method signature preserved to avoid breaking callers that may reference the type

### Error: `errors.ts`
- Added `MethodNotAllowedError extends AppError` (405, `METHOD_NOT_ALLOWED` by default)
- Accepts optional `code` param so callers can pass domain-specific codes like `MEDICAL_HISTORY_IMMUTABLE`

## Test Changes: `clinical-prescription-history.test.ts`
- Removed 4 old tests (1× 401, 1× 404, 2× 200)
- Added 4 new tests all asserting 405 + `code === 'MEDICAL_HISTORY_IMMUTABLE'`:
  1. Unauthenticated caller → 405
  2. Authenticated, nonexistent entry → 405
  3. Authenticated, real entry exists → 405
  4. Authenticated, attempt to mark inactive → 405
- `createMedicalHistoryEntry` test still verifies 201 (create path unaffected)

## Files Changed
- `services/api-ts/src/core/errors.ts` — added `MethodNotAllowedError`
- `services/api-ts/src/handlers/dental-clinical/medical-history/updateMedicalHistoryEntry.ts` — replaced with 405
- `services/api-ts/src/handlers/dental-clinical/repos/medical-history.repo.ts` — guarded `update()`
- `services/api-ts/src/handlers/dental-clinical/clinical-prescription-history.test.ts` — updated tests
