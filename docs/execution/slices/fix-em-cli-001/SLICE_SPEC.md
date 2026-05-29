# SLICE_SPEC — EM-CLI-001: revokeConsentForm Handler

## Finding
**EM-CLI-001 (P0)** — `revokeConsentForm` handler is entirely absent (WF-035).  
The endpoint `PATCH /dental/visits/:visitId/consents/:cid/revoke` is expected by
consumers but returns 404 because no route is registered and no handler exists.

## Scope
| Layer | File | Change |
|-------|------|--------|
| Schema | `services/api-ts/src/handlers/dental-clinical/repos/consent-form.schema.ts` | Add `revokedAt`, `revokedBy` columns |
| Repo | `services/api-ts/src/handlers/dental-clinical/repos/consent-form.repo.ts` | Add `revoke()` method |
| Domain events | `services/api-ts/src/handlers/dental-clinical/domain-events.ts` | New file — DE-013 ConsentRevoked |
| Handler | `services/api-ts/src/handlers/dental-clinical/consent/revokeConsentForm.ts` | New handler |
| Router | `services/api-ts/src/app.ts` | Register PATCH …/revoke route |
| Migration | `services/api-ts/src/generated/migrations/` | Auto-generated via `bun run db:generate` |
| Tests | `services/api-ts/src/handlers/dental-clinical/clinical-consent-lab.test.ts` | Add revokeConsentForm describe block |

## Behaviour Contract
- **Route**: `PATCH /dental/visits/:visitId/consents/:cid/revoke`
- **Auth**: `authMiddleware({ roles: ['user'] })` + branch role `dentist_owner | dentist_associate`
- **200**: consent form with `revokedAt` set, `revoked: true`
- **404**: consent form not found
- **409 Conflict**: consent form is already revoked
- **400**: attempting to revoke an unsigned form is permitted (no constraint), but
  signed forms may be revoked post-signing for compliance purposes
- **Event**: DE-013 `ConsentRevoked` enqueued best-effort (non-blocking)

## Test Cases (TDD RED → GREEN)
1. `returns 401 when user is not authenticated`
2. `returns 404 when consent form does not exist`
3. `returns 200 with revoked consent form`
4. `returns 409 when consent form is already revoked`
