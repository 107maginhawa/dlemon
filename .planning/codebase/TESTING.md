# Testing Patterns

**Analysis Date:** 2026-05-06

## Test Framework

**Runner:**
- Bun test (`bun:test`) for unit + integration tests
- Playwright for E2E tests
- No Jest or Vitest

**Assertion Library:**
- Bun's built-in `expect` (Jest-compatible API)
- Playwright's `expect` for E2E

**Run Commands:**
```bash
# Backend unit/integration tests (requires running Postgres)
cd services/api-ts && bun test              # All handler + core tests
cd services/api-ts && bun test src/**/*.test.ts  # Same, explicit glob

# Frontend unit tests
cd apps/dentalemon && bun test              # All src/**/*.test.ts
cd apps/dentalemon && bun test src/          # Same

# E2E tests (requires running API + app)
cd apps/dentalemon && bun run test:e2e       # Playwright full suite
cd apps/dentalemon && bun run test:e2e:ui    # Playwright with UI
cd apps/dentalemon && bun run test:ai        # Quiet mode, stop on first fail

# Contract tests (Hurl-based)
bun run test:contract                       # From repo root
```

## Test File Organization

**Location:** Co-located with source files

**Naming:**
- Unit/integration: `*.test.ts` or `*.test.tsx`
- E2E: `*.spec.ts` (in dedicated `tests/e2e/` directory)
- `bunfig.toml` excludes `*.spec.ts` from Bun runner so Playwright and Bun don't collide

**Structure:**
```
services/api-ts/
  ├── src/
  │   ├── core/
  │   │   ├── errors.ts
  │   │   └── errors.test.ts          # Co-located unit test
  │   ├── handlers/{module}/
  │   │   ├── createThing.ts
  │   │   ├── createThing.test.ts     # Handler integration test
  │   │   ├── {module}.test.ts        # Multi-handler integration test
  │   │   ├── {module}-moduleN.test.ts # FR-specific integration tests
  │   │   └── repos/
  │   │       ├── thing.repo.ts
  │   │       └── thing.test.ts       # Repository integration test
  │   └── tests/e2e/                  # API-level E2E (hits real server)
  │       └── {module}/{module}.test.ts

apps/dentalemon/
  ├── src/
  │   ├── components/
  │   │   ├── phone-input.tsx
  │   │   └── phone-input.test.tsx    # Component unit test
  │   ├── features/{feature}/
  │   │   ├── components/
  │   │   │   ├── patient-list.tsx
  │   │   │   └── patient-list.test.ts
  │   │   └── hooks/
  │   │       ├── use-patients.ts
  │   │       └── use-patients.test.ts
  │   ├── hooks/
  │   │   ├── use-mobile.ts
  │   │   └── use-mobile.test.ts
  │   └── lib/
  │       ├── format-date.ts
  │       └── format-date.test.ts
  └── tests/e2e/                      # Playwright E2E tests
      ├── first-launch.spec.ts
      ├── billing.spec.ts
      └── ...
```

## Test Structure

**Backend Handler Tests (buildTestApp pattern):**
```typescript
import { describe, test, expect, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

function buildTestApp(user?: { id: string; email: string }) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: String(err.message) }, 500);
  });

  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', db);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    if (user) {
      ctx.set('user', user);
      ctx.set('session', { id: 'test-session' });
    }
    await next();
  });

  app.post('/dental/things', createThing);
  return app;
}

describe('createThing handler', () => {
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_thing CASCADE`);
  });

  test('returns 201 on valid input', async () => {
    const app = buildTestApp({ id: 'uuid', email: 'test@test.com' });
    const res = await app.request('/dental/things', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    expect(res.status).toBe(201);
  });
});
```

**CRITICAL WARNING — buildTestApp Tests Don't Catch Route Registration Bugs:**
The `buildTestApp()` pattern registers handlers directly on a fresh Hono app, bypassing the actual route registration in `services/api-ts/src/generated/openapi/routes.ts`. A handler can pass all buildTestApp tests but fail in production because the route is not wired up, or the zValidator middleware is missing. The `tests/e2e/` directory has real-server tests that catch these gaps, but many modules lack E2E coverage.

**Repository Tests:**
```typescript
describe('OrganizationRepository', () => {
  let repo: OrganizationRepository;

  beforeEach(() => {
    repo = new OrganizationRepository(db);
  });

  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_organization CASCADE`);
  });

  test('creates an organization with required fields', async () => {
    const org = await repo.createOne({ name: 'Test', tier: 'solo', ... });
    expect(org.id).toBeTruthy();
    expect(org.name).toBe('Test');
  });
});
```

**Frontend Component Tests:**
```typescript
import { describe, test, expect, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';

afterEach(cleanup);

describe('PatientList', () => {
  test('renders a card for each patient', () => {
    render(React.createElement(PatientList, { patients, onSelect: () => {}, searchQuery: '' }));
    expect(screen.getByText('SANTOS')).toBeTruthy();
  });
});
```

**Frontend Hook Tests:**
```typescript
import { renderHook } from '@testing-library/react';

test('returns date formatting functions', () => {
  const { result } = renderHook(() => useFormatDate());
  expect(result.current.formatDate).toBeDefined();
});
```

## Mocking

**Framework:** Bun's built-in `mock` function + manual stubs

**Patterns:**

Logger stub (used in every handler test):
```typescript
ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
```

Database: **Not mocked** — tests use a real Postgres connection with `TRUNCATE` cleanup. This makes all "unit" tests into integration tests.

Global fetch mock (frontend hooks):
```typescript
import { mock } from 'bun:test';

const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(JSON.stringify(data), { status: 200 }))
  ) as any;
});
afterEach(() => { globalThis.fetch = originalFetch; });
```

Window/DOM mocking (frontend):
```typescript
beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true, configurable: true, value: 375,
  });
  window.matchMedia = (query) => ({ matches: window.innerWidth < 768, ... });
});
```

**What to Mock:**
- Logger (always stubbed)
- `globalThis.fetch` for frontend hook tests
- `window` properties for responsive behavior tests

**What NOT to Mock:**
- Database — tests hit real Postgres (integration-style)
- Repositories — tested directly against DB
- Hono routing — `app.request()` used for handler tests

## Test Setup

**Frontend DOM setup (`apps/dentalemon/src/test-setup.ts`):**
```typescript
import { GlobalRegistrator } from '@happy-dom/global-registrator';
if (!GlobalRegistrator.isRegistered) {
  GlobalRegistrator.register({ url: 'http://localhost/' });
}
```
Preloaded via `bunfig.toml` so `document`, `window`, etc. exist in test env.

**Backend:** No preload — Bun test runs directly. Requires Postgres at `localhost:5432/monobase`.

## Fixtures and Factories

**Test Data:** Inline constants — no shared fixture files or factory library.
```typescript
const TEST_USER = { id: '00000000-0000-0000-0000-000000000001', email: 'test@clinic.com' };
const PATIENT_ID = 'a0000000-0000-1000-8000-000000000001';
const BRANCH_ID = 'b0000000-0000-1000-8000-000000000002';
```

**Seed helpers:** Some tests use repository methods directly:
```typescript
async function seedVisit(overrides?: Partial<{ patientId: string; status: string }>) {
  const repo = new VisitRepository(db);
  return repo.createOne({ patientId: overrides?.patientId ?? PATIENT_ID, ... });
}
```

**Location:** No shared `__fixtures__` or `__factories__` directory. Every test file defines its own data inline. This leads to significant duplication of `buildTestApp()` helpers and test constants.

## Coverage

**Requirements:** None enforced. No coverage thresholds configured.

**View Coverage:**
```bash
# Not configured — no coverage reporter set up
```

## Test Types

**Unit Tests (frontend only — truly isolated):**
- Hook tests with mocked fetch and `renderHook()`
- Component tests with `@testing-library/react` + happy-dom
- Pure function tests (e.g., `toPatientCard()`, `canAccess()`, `getToothColorClass()`)
- Location: `apps/dentalemon/src/**/*.test.ts`

**Integration Tests (backend — labeled as "unit" but hit real DB):**
- Handler tests via `buildTestApp()` + `app.request()` + real Postgres
- Repository tests that insert/query/truncate against real database
- Location: `services/api-ts/src/**/*.test.ts`
- **Every backend test requires a running Postgres instance** — there are zero truly isolated backend unit tests

**API E2E Tests (backend):**
- Full server boot, real HTTP requests
- Location: `services/api-ts/tests/e2e/{module}/{module}.test.ts`
- 22 test files covering core modules (auth, booking, billing, person, patient, etc.)

**Browser E2E Tests (Playwright):**
- Full app + API running
- Location: `apps/dentalemon/tests/e2e/*.spec.ts`
- 16 spec files covering user journeys (onboarding, billing, scheduling, etc.)
- Config: `apps/dentalemon/playwright.config.ts`
- Single worker, sequential, Chromium only

## Playwright E2E Config

```typescript
// apps/dentalemon/playwright.config.ts
{
  testDir: './tests/e2e',
  timeout: 30000,           // 30s per test
  expect: { timeout: 10000 },
  workers: 1,               // Sequential execution
  use: {
    baseURL: 'http://localhost:3003',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3003',
  },
}
```

## Honesty Assessment — Test Quality Issues

### Tests That Don't Test What They Claim

**`empty-state.test.ts` at `apps/dentalemon/src/components/empty-state.test.ts`:**
- Defines its OWN inline `EMPTY_STATES` array and tests that — never imports or renders the actual `empty-state.tsx` component
- Tests prove the test data is correct, not that the component works
- The "Accessibility — focus ring" test just checks a hardcoded string contains expected substrings

**Duplicated test infrastructure between `apps/account/` and `apps/dentalemon/`:**
- Identical test files exist in both apps: `format-date.test.ts`, `detect-timezone.test.ts`, `phone-input.test.tsx`, etc.
- These are copy-pasted, not shared — changes in one don't propagate

### Coverage Gaps

**Backend handlers with NO tests (72 test files vs 284 handler files = ~25% coverage):**
- Most base-platform modules (`booking`, `billing`, `person`, `patient`) have tests
- Many dental-domain handlers have no dedicated test file
- Generated `DentalOrganizationManagement_*` handlers have NO tests despite being the actual production routes

**Frontend features with limited tests:**
- `features/billing/`, `features/dashboard/`, `features/onboarding/`, `features/pmd/`, `features/reports/` — have tests for some components but not all
- Route-level components (`_dashboard/calendar.tsx` at 258 lines) have zero tests

**No tests for:**
- Middleware (only `security.test.ts` and `auth.test.ts` for core middleware)
- Route registration (the generated `routes.ts` that wires handlers to paths)
- Error handler (`createErrorHandler` in `services/api-ts/src/core/errors.ts`)

### Structural Issues

**`buildTestApp()` duplicated in every test file:**
- ~50+ test files each define their own `buildTestApp()` with nearly identical boilerplate
- No shared test helper module
- Each copy has slight variations (some include `zValidator`, some don't)

**Hard-coded database URL in every test:**
```typescript
const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });
```
- Repeated in every backend test file
- Not configurable via env var in tests
- Tests cannot run against a different database without editing source

**No test isolation between suites:**
- `afterEach` uses `TRUNCATE CASCADE` which affects shared tables
- Tests can interfere if run in parallel (Bun test is parallel by default)
- No transaction-based isolation

## Common Patterns

**Async Testing:**
```typescript
test('creates entity', async () => {
  const res = await app.request('/path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ... }),
  });
  expect(res.status).toBe(201);
  const body = await res.json() as any;
  expect(body.id).toBeTruthy();
});
```

**Error Testing:**
```typescript
test('returns 401 when not authenticated', async () => {
  const app = buildTestApp(undefined); // no user
  const res = await app.request('/path', { method: 'POST', ... });
  expect(res.status).toBe(401);
});

test('returns 400 on invalid input', async () => {
  const app = buildTestApp(authedUser);
  const res = await app.request('/path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ /* missing required fields */ }),
  });
  expect(res.status).toBe(400);
});
```

**E2E API-via-browser Pattern (Playwright):**
```typescript
const result = await page.evaluate(async (api) => {
  const res = await fetch(`${api}/dental/endpoint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ... }),
  });
  return { status: res.status, body: await res.json() };
}, API);
expect(result.status).toBe(201);
```

---

*Testing analysis: 2026-05-06*
