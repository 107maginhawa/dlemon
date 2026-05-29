# TDD_PROOF — AL-012: HIPAA Audit Trail for Imaging Study Create/Access

## TDD Cycle

### RED — Failing Tests Written First

Two tests were added to `imaging.test.ts` before any implementation:

```
(fail) AL-012 audit trail for imaging study create/access > createImagingStudy emits imaging_study.create audit event
(fail) AL-012 audit trail for imaging study create/access > getImagingStudy emits imaging_study.read audit event

63 pass / 2 fail
```

Tests verify that `logAuditEvent` fires by capturing the `logger.info` call that `logAuditEvent` always emits synchronously before its DB writes (`logger?.info({ audit: event }, ...)`).

### GREEN — Implementation Added

- `createImagingStudy.ts`: added `logAuditEvent` import + call with `action: 'imaging_study.create'`
- `getImagingStudy.ts`: added `logAuditEvent` import + call with `action: 'imaging_study.read'`

### Test Run After Fix

```
65 pass
0 fail
```

All 63 pre-existing tests continue to pass. Both new AL-012 tests pass.

## Test File

`services/api-ts/src/handlers/dental-imaging/imaging.test.ts`

Test suite: `describe('AL-012 audit trail for imaging study create/access', ...)`

### Test Strategy

`logAuditEvent` uses a static ES module import inside the handlers, so module-level monkey-patching is not viable. Instead the tests:

1. Inject a spy logger via `buildAuditApp` (which sets `c.set('logger', logger)`)
2. `logAuditEvent` calls `logger?.info({ audit: event }, ...)` — the spy captures `meta.audit`
3. Also extend `makeDb` to silently absorb audit table INSERTs (tables without imaging columns)

This approach verifies the audit call at the boundary where it matters (Pino structured log) without requiring a real database.

## Typecheck

```
bun run typecheck
```

Zero new errors introduced in `createImagingStudy.ts` or `getImagingStudy.ts`. Pre-existing unrelated errors in acceptance/rbac test files are unchanged.

## Commit

`fix(dental-imaging): AL-012 — HIPAA audit trail for imaging study create/access`
