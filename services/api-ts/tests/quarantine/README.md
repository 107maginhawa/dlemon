# Test Quarantine

Tests here are excluded from the normal CI run (`bun run test` uses `src/**/*.test.ts`,
which does not match `tests/quarantine/`).

## Current quarantine (2 files)

| File | Reason | SUNSET |
|---|---|---|
| `email.test.ts` | Mailpit/SMTP not provisioned in CI | 2026-Q3 |
| `storage.test.ts` | MinIO/S3 not provisioned in CI | 2026-Q3 |

## Decrement procedure

When a test exits quarantine:

1. Move it back to `tests/e2e/<module>/` (or delete if superseded):
   ```bash
   git mv tests/quarantine/<file>.test.ts tests/e2e/<module>/<file>.test.ts
   ```
2. Decrement `tests/.quarantine-count` by 1 in the same commit.
3. The CI `quarantine count guardrail` step enforces the count — if it grows without
   updating `.quarantine-count`, the workflow fails.

Both the `git mv` and the count decrement must be in a single atomic commit.
