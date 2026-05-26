# Test Standards

Patterns established during the v1.5-g1 test-hardening sprint. Follow these for all new tests in `services/api-ts`.

---

## 1. Real DB, not mocks

Handler and repository tests must connect to a real Postgres instance. The mocked `{}` DB pattern was retired because it does not catch route-registration bugs, query errors, or FK constraint violations.

```ts
import { createDatabase } from '@/core/database';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });
```

Use `bun test` locally with the dev Postgres running. CI boots the real DB before running the suite.

---

## 2. afterEach TRUNCATE TABLE … CASCADE

Each test file owns the tables it writes to. After every test, truncate to prevent state bleed.

```ts
import { afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE <root_table> CASCADE`);
});
```

**Scope rules:**
- Truncate the root table of the domain being tested; `CASCADE` handles children.
- Do **not** truncate FK parent tables that are seeded once in `beforeAll` — they should survive across tests.
- Choose the tightest root that covers all rows written by the test file (e.g. `booking_event CASCADE` for booking tests, `dental_attachment CASCADE` for attachment tests).

---

## 3. Exact assertions — no loose matchers

Every assertion must pin the exact value. Loose matchers (`toBeGreaterThanOrEqual`, `toBeDefined`, `toBeTruthy`) were replaced sprint-wide because they allow wrong status codes and missing fields to silently pass.

| Banned | Use instead |
|--------|-------------|
| `expect(res.status).toBeGreaterThanOrEqual(400)` | `expect(res.status).toBe(403)` |
| `expect(body.code).toBeDefined()` | `expect(body.code).toBe('FORBIDDEN')` |
| `expect(row).toBeTruthy()` | `expect(row).not.toBeNull()` then `expect(row.id).toBe(...)` |
| `expect(rows.length).toBeGreaterThan(0)` | `expect(rows.length).toBe(1)` |

---

## 4. Valid UUID format for not-found probes

PostgreSQL rejects non-UUID strings with a cast error (`invalid input syntax for type uuid`) **before** evaluating the WHERE clause. This causes the test to throw rather than returning a 404/null, masking the real assertion.

Always use a well-formed UUID for not-found probes:

```ts
// ✅ valid UUID — PostgreSQL evaluates the WHERE clause, returns 404/null
const result = await repo.findOneById('f0000000-0000-4000-8000-000000000099');

// ❌ non-UUID string — PostgreSQL throws a cast error
const result = await repo.findOneById('nonexistent-id');
```

Pick a UUID that is obviously synthetic (all zeros except a counter digit) and document the file's UUID prefix to avoid collisions across test files.

---

## 5. Per-file UUID prefixes

Each test file reserves a unique hex prefix to avoid PK/UK collisions when tests run in parallel or in sequence without full DB resets.

| Prefix | File |
|--------|------|
| `ca`, `cb` | `cross-org-isolation.test.ts` |
| `5d` | `soft-delete-semantics.test.ts` |
| `ad` | `fixtures/audit-workspace-fixtures.ts` |
| `c1` | `fixtures/seed-clinical-chain.ts` |

Register your prefix here when adding a new test file.

---

## 6. AppError handlers vs manual try/catch handlers

Two error-handling patterns exist in this codebase. The pattern determines what the response body looks like and whether a `.code` field is present.

### AppError pattern (most handlers)
Handlers throw `AppError` subclasses; the global error middleware formats the response.

```ts
// Handler throws:
throw new NotFoundError('patient not found');

// Wire response:
{ code: 'NOT_FOUND', message: 'patient not found', statusCode: 404, ... }
```

Assert `.code` directly:

```ts
expect(body.code).toBe('NOT_FOUND');
```

### Manual try/catch pattern (some handlers)
Handlers catch errors internally and return plain JSON without a `.code` field.

```ts
// Handler returns:
return c.json({ error: 'Internal server error' }, 500);

// Wire response — no .code:
{ error: 'Internal server error' }
```

Assert the field that is actually present:

```ts
expect(body.error).toBe('Internal server error');
// Do NOT assert body.code — it will be undefined
```

To determine which pattern a handler uses, look for `try { … } catch` inside the handler function itself. If absent, the handler relies on the global error middleware and will produce a `.code` field.

---

## 7. req.valid() patch for ValidatedContext handlers

Handlers that accept a `ValidatedContext` (from `@hono/zod-validator`) call `c.req.valid('json')`, `c.req.valid('param')`, or `c.req.valid('query')` to retrieve parsed input. Without the middleware chain, this method is not present on the request context.

Inject it via middleware before mounting the handler:

```ts
app.use('*', async (c, next) => {
  const validatedData: Record<string, unknown> = {};
  (c.req as any).valid = (target: string) => validatedData[target] ?? opts.validJson ?? opts.validParam ?? opts.validQuery ?? {};
  await next();
});
```

Or pass the validated data via `opts` in a `buildApp` helper so each test controls the input independently.

---

## 8. beforeAll for FK parents, afterEach for owned rows

When a test file tests a leaf entity (one with FK parents), seed the parents once:

```ts
beforeAll(async () => {
  await seedClinicalChain(db, { visits: 1 });
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE dental_attachment CASCADE`);
});
```

`seedClinicalChain` (and other fixture helpers) use `onConflictDoNothing`, making them safe to call from multiple test files in the same suite run.

---

## Reference test files

| Test file | Pattern demonstrated |
|-----------|---------------------|
| `src/tests/soft-delete-semantics.test.ts` | Repo-level real DB, beforeAll + afterEach TRUNCATE |
| `src/handlers/cross-org-isolation.test.ts` | HTTP layer, cross-tenant 403 enforcement |
| `src/handlers/booking/booking-coverage.test.ts` | Handler coverage, ValidatedContext patch, exact status + code |
| `src/tests/error-envelope.conformance.test.ts` | Error middleware wire format, envelope shape |
| `src/tests/fixtures/seed-clinical-chain.ts` | FK-parent seeding fixture (idempotent) |
