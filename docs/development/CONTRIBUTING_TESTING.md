# Test Organization & Testing Requirements

This document covers test file organization, naming conventions, Playwright patterns, and testing requirements.

## Test File Organization and Naming

### Naming Conventions

**Two test types, two conventions:**
- **Unit Tests**: `.test.ts` (Bun test runner)
- **E2E Tests**: `.spec.ts` (Playwright)

#### Unit Tests - `.test.ts`

All unit tests use `.test.ts` suffix:

- ✅ `billing.test.ts` - Correct
- ❌ `billing.spec.ts` - Wrong

#### E2E Tests - `.spec.ts`

All Playwright E2E tests use `.spec.ts` suffix:

- ✅ `booking.spec.ts` - Correct
- ❌ `booking.test.ts` - Wrong

### Test Organization Patterns

#### Cross-Cutting Backend Tests

Cross-cutting backend tests live in `services/api-ts/src/tests/`; handler-specific tests are co-located with their handler.

#### Unit Tests - Colocated with Source

**Unit tests are placed next to the files they test:**

```
src/api/billing.ts          # Source file
src/api/billing.test.ts     # Unit test (colocated)

src/hooks/use-billing.ts    # Source file
src/hooks/use-billing.test.ts  # Unit test (colocated)

src/utils/formatters.ts     # Source file
src/utils/formatters.test.ts   # Unit test (colocated)
```

**Benefits of colocation:**
- Easier to find tests when editing source files
- Simpler to move/rename files (test moves with source)
- Clear what does and doesn't have tests
- Modern build tools automatically exclude test files

#### E2E Tests - Dedicated Directory (Playwright)

**E2E tests use Playwright's recommended structure:**

```
tests/e2e/
├── *.spec.ts                # E2E test files
├── pages/                   # Page Object Model classes
│   ├── login.page.ts
│   └── billing.page.ts
├── fixtures/                # Test data & custom fixtures
│   └── test-data.ts
└── helpers/                 # Utility functions
    └── auth-helpers.ts
```

**Playwright structure requirements:**
- **Page Objects** (`pages/`): Encapsulate page interactions
- **Fixtures** (`fixtures/`): Test data factories and custom fixtures
- **Helpers** (`helpers/`): Shared utilities (auth, data creation)

**Benefits of separation:**
- E2E tests require supporting files (page objects, fixtures)
- Clear distinction from unit tests
- Easier to run E2E tests independently
- Better organization for complex test scenarios

### Examples

**✅ Good:**
```
# Unit test - colocated
src/api/billing.ts
src/api/billing.test.ts

# E2E test - dedicated directory
tests/e2e/billing.spec.ts
tests/e2e/pages/billing.page.ts
tests/e2e/fixtures/billing-data.ts
tests/e2e/helpers/billing-helpers.ts
```

**❌ Bad:**
```
# Don't use .spec.ts for unit tests
src/api/billing.spec.ts

# Don't use .test.ts for E2E tests
tests/e2e/billing.test.ts

# Don't nest unit tests in __tests__
src/api/__tests__/billing.test.ts

# Don't colocate E2E tests with source
src/routes/billing.e2e.spec.ts
```

### Test Runner Configuration

Frontend apps use **two separate test runners**:

#### Frontend Apps (Using Both Bun + Playwright)

Frontend apps (e.g. account) use:
- **Bun test runner** for unit tests (colocated in `src/`)
- **Playwright** for E2E tests (in `tests/e2e/`)

**1. Update `package.json` scripts:**
```json
{
  "scripts": {
    "test": "bun test src/",           // Unit tests only
    "test:watch": "bun test src/ --watch",
    "test:e2e": "playwright test",     // E2E tests only
    "test:e2e:ui": "playwright test --ui"
  }
}
```

**2. Configure `playwright.config.ts`:**
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',  // Only .spec.ts files
  // ... other config
});
```

**3. Running tests:**
```bash
# Unit tests (src/**/*.test.ts)
bun test
bun test --watch

# E2E tests (tests/e2e/**/*.spec.ts)
bun run test:e2e
bun run test:e2e:ui
```

**Why this works:**
- `bun test src/` explicitly targets only the src directory
- Playwright config (`testDir: './tests/e2e'`, `testMatch: '**/*.spec.ts'`) targets only E2E tests
- Using `.spec.ts` for E2E and `.test.ts` for unit tests provides visual separation
- Test runners stay separate, no conflicts

#### Backend Services (Using Only Bun)

Backend services (API) use only Bun test runner:

```bash
# All tests run with Bun
bun test                    # Runs all *.test.ts files
```

No special configuration needed since there's only one test runner.

### Playwright Patterns

#### Page Object Model

Encapsulate page interactions in classes:

```typescript
// tests/e2e/pages/login.page.ts
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.loginButton = page.getByRole('button', { name: 'Login' });
  }

  async goto() {
    await this.page.goto('/auth/sign-in');
  }

  async signIn(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}
```

#### Test Data Fixtures

Create reusable test data factories:

```typescript
// tests/e2e/fixtures/test-data.ts
import { faker } from '@faker-js/faker';

export function makeTestUser() {
  return {
    email: faker.internet.email(),
    password: 'TestPassword123!',
    name: faker.person.fullName(),
  };
}

export function makeTestServiceProvider(overrides = {}) {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    specialization: 'Business Consulting',
    ...overrides,
  };
}
```

#### Helper Functions

Create shared utilities for common operations:

```typescript
// tests/e2e/helpers/auth-helpers.ts
import { Page } from '@playwright/test';

export async function createTestUser(page: Page, userData: any) {
  const response = await page.request.post('/api/auth/signup', {
    data: userData,
  });
  return response.json();
}

export async function signInAsUser(page: Page, email: string, password: string) {
  await page.goto('/auth/sign-in');
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
}
```

### Migration Notes

**Current state:**
- API service uses `.test.ts` ✅
- Website app E2E uses `.spec.ts` ✅
- Account app E2E uses `.spec.ts` ✅

**For new code:**
- Unit tests: Use `.test.ts`, colocate with source files
- E2E tests: Use `.spec.ts`, place in `tests/e2e/` directory
- Page objects: Place in `tests/e2e/pages/`
- Fixtures: Place in `tests/e2e/fixtures/`
- Helpers: Place in `tests/e2e/helpers/`

## Testing Requirements

Follow the Vertical TDD protocol: write tests first (RED), implement until they pass (GREEN), then move to the next module. See `.claude/skills/develop/SKILL.md` for the full workflow.

### Data Bootstrap Order

When seeding test data, always follow this order:
1. Sign up (creates user)
2. Create person record
3. Assign roles/membership

### Unit Tests (API Service)

```bash
cd services/api-ts
bun test
```

Write tests for:
- Service layer business logic
- Validation schemas
- Utility functions
- Middleware

**Example Test**:
```typescript
// services/api-ts/src/handlers/client/__tests__/service.test.ts
import { describe, test, expect } from 'bun:test';
import { ClientService } from '../service';

describe('ClientService', () => {
  test('creates client with valid data', async () => {
    const service = new ClientService();
    const client = await service.createClient({
      person_id: '123e4567-e89b-12d3-a456-426614174000',
      service_history: 'New client',
    });
    
    expect(client.id).toBeDefined();
    expect(client.person_id).toBe('123e4567-e89b-12d3-a456-426614174000');
  });
});
```

### E2E Tests (Frontend Apps)

```bash
cd apps/account
bun run test:e2e
```

Write E2E tests for:
- Critical user flows
- Authentication
- Form submissions
- API integrations
- Error handling

**Example E2E Test (Playwright)**:
```typescript
// apps/account/e2e/booking.spec.ts
import { test, expect } from '@playwright/test';

test('client can book appointment', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'client@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');
  
  await page.goto('/hosts');
  await page.click('text=John Smith Consulting');
  await page.click('text=Book Appointment');
  await page.click('[data-testid="time-slot-9am"]');
  await page.click('button:has-text("Confirm Booking")');
  
  await expect(page.locator('text=Appointment confirmed')).toBeVisible();
});
```

### Type Checking

Always run type checking before committing:

```bash
# Check API service
cd services/api-ts && bun run typecheck

# Check account app
cd apps/account && bun run typecheck
```

### Test Coverage Requirements

- **Critical Paths**: 100% coverage for payment, booking, authentication
- **Business Logic**: 80%+ coverage for service layer
- **Handlers**: Test happy path and error cases
- **E2E**: Cover primary user workflows
