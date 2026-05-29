# TDD_PROOF — EM-CLI-001: revokeConsentForm Handler

## RED phase
Tests were written first in `clinical-consent-lab.test.ts` before the handler
and schema changes existed. Running the suite before `db:migrate` produced:

- `revokeConsentForm handler > returns 401 when user is not authenticated` — FAIL (404, route not registered)
- `revokeConsentForm handler > returns 404 when consent form does not exist` — FAIL (404)
- `revokeConsentForm handler > returns 200 with revoked consent form` — FAIL (500)
- `revokeConsentForm handler > returns 409 when consent form is already revoked` — FAIL (500)

## GREEN phase
After implementing schema columns, repo method, domain-events file, handler,
route registration, and running `db:migrate` on the test database:

```
31 pass
 0 fail
```

All 31 tests in `clinical-consent-lab.test.ts` pass including the 4 new
revoke tests.

## Artifacts
| File | Role |
|------|------|
| `services/api-ts/src/handlers/dental-clinical/consent/revokeConsentForm.ts` | Handler |
| `services/api-ts/src/handlers/dental-clinical/domain-events.ts` | DE-013 emitter |
| `services/api-ts/src/handlers/dental-clinical/repos/consent-form.schema.ts` | +revoked/revokedAt/revokedBy columns |
| `services/api-ts/src/handlers/dental-clinical/repos/consent-form.repo.ts` | +revoke() method |
| `services/api-ts/src/app.ts` | Route registration |
| `services/api-ts/src/generated/migrations/0064_common_doctor_strange.sql` | DB migration |
| `services/api-ts/src/handlers/dental-clinical/clinical-consent-lab.test.ts` | Tests |

## Commit
`d60d1c8d` — fix(dental-clinical): EM-CLI-001 — implement revokeConsentForm handler + DE-013 emission
