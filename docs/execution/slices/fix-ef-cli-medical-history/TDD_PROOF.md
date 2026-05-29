# TDD PROOF: EF-CLI-001 / EM-CLI-002

## RED → GREEN sequence

### RED (before fix)
Tests `returns 200 with updated entry fields` and `returns 200 when marking entry as inactive`
passed against the live PATCH implementation — proving the vulnerability was reachable.

### GREEN (after fix)
All four new tests assert 405 + `code === 'MEDICAL_HISTORY_IMMUTABLE'`.
Handler throws unconditionally; no DB access occurs.

## Typecheck
```
bun run typecheck 2>&1 | grep -E "(medical-history|updateMedicalHistory|MethodNotAllowed|MEDICAL_HISTORY)"
# (no output — zero errors in changed files)
```
Pre-existing unrelated errors in `acceptance.registration-and-visit.test.ts`,
`cross-org-isolation.test.ts`, `rbac-http.test.ts` are not introduced by this change.

## Test file
`services/api-ts/src/handlers/dental-clinical/clinical-prescription-history.test.ts`
describe block: `updateMedicalHistoryEntry handler — immutability gate`

## Assertion matrix
| Test | Auth | Entry exists | Expected status | Expected code |
|---|---|---|---|---|
| unauthenticated | no | no | 405 | MEDICAL_HISTORY_IMMUTABLE |
| authenticated, no entry | yes | no | 405 | MEDICAL_HISTORY_IMMUTABLE |
| authenticated, entry exists | yes | yes | 405 | MEDICAL_HISTORY_IMMUTABLE |
| authenticated, mark inactive | yes | yes | 405 | MEDICAL_HISTORY_IMMUTABLE |

## Repo guard
`MedicalHistoryRepository.update()` now throws at runtime with message:
`MEDICAL_HISTORY_IMMUTABLE: medical history entries are append-only PHI and must not be updated.`
Marked `@deprecated` in JSDoc to surface in IDE tooling.
