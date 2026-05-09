---
name: handler
description: Implement API handler business logic and database repository for a module. Use after /typespec has generated handler stubs. Follows the exact pattern from services/api-ts/src/handlers/person/createPerson.ts.
---

# handler

Implement API handler business logic and repository layer using TDD.

## Triggers

- After `/typespec` generates handler stubs that need implementation
- When implementing a new API endpoint
- When modifying existing handler logic

## Workflow

### 1. Check Generated Stub

Open the stub at `services/api-ts/src/handlers/{module}/{operationId}.ts`. It will have a `throw new Error('Not implemented')` placeholder.

### 2. Write Tests FIRST (RED)

> **WHY tests first**: Tests written after implementation only confirm your assumptions. TDD catches design mistakes early — you think about error paths, edge cases, and API contracts before writing a line of production code.

Create colocated test at `services/api-ts/src/handlers/{module}/{operationId}.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';

describe('{operationId}', () => {
  // REQUIRED for ALL handlers:

  test('happy path — returns correct status and body', () => {
    // Arrange: set up valid input
    // Act: call the handler
    // Assert: correct status code + response shape
  });

  test('validation error — returns 400 for invalid input', () => {
    // Arrange: set up invalid/missing fields
    // Act: call the handler
    // Assert: 400 status + error details
  });

  // REQUIRED IF handler has these paths (derive from TypeSpec definition):

  // If endpoint requires auth:
  test('auth error — returns 401/403 without valid credentials', () => {
    // ...
  });

  // If endpoint looks up a resource by ID:
  test('not found — returns 404 for nonexistent resource', () => {
    // ...
  });

  // If endpoint has domain-specific constraints:
  test('business rule — returns 409/422 when constraint violated', () => {
    // ...
  });
});
```

> **WHY contract-derived categories**: Universal checklists produce meaningless tests for handlers that don't have those paths. A public webhook has no user auth. A create endpoint has no 404. Derive what to test from the TypeSpec definition — if the endpoint declares `@error(404)`, test it. If not, skip it.

**Run the tests and confirm they FAIL (red phase)**:

```bash
cd services/api-ts && bun test src/handlers/{module}/{operationId}.test.ts
```

### 3. Implement Handler (GREEN)

Now make the tests pass. Follow the pattern from `services/api-ts/src/handlers/person/createPerson.ts`:

```typescript
import type { ValidatedContext } from '@/types/app';
import type { CreateMyEntityBody } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessLogicError,
  ConflictError
} from '@/core/errors';
import { MyEntityRepository } from './repos/my-entity.repo';

export async function createMyEntity(
  ctx: ValidatedContext<CreateMyEntityBody>
): Promise<Response> {
  const user = ctx.get('user') as User;
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new MyEntityRepository(db, logger);

  // Business logic here
  const entity = await repo.createOne({ ...body, createdBy: user.id });

  // Audit logging
  const audit = ctx.get('audit');
  if (audit) {
    try {
      await audit.logEvent({
        eventType: 'data-modification',
        category: 'privacy',
        action: 'create',
        outcome: 'success',
        user: user.id,
        userType: (user.role === 'user' ? 'client' : user.role || 'client') as 'client' | 'host' | 'admin' | 'system',
        resourceType: 'my-entity',
        resource: entity.id,
        description: 'Entity created',
      });
    } catch (error) {
      logger?.error({ error, entityId: entity.id }, 'Failed to log audit event');
    }
  }

  return ctx.json(entity, 201);
}
```

Key patterns:
- Type handler with `ValidatedContext<BodyType>` from `@/generated/openapi/validators`
- Get user: `ctx.get('user') as User`
- Get validated body: `ctx.req.valid('json')`
- Get deps from context: `database`, `logger`, `audit`
- Instantiate repo with `db` and `logger`
- Always add audit logging for data modifications
- Never log PII — only IDs

### 4. Create Repository

Create `services/api-ts/src/handlers/{module}/repos/{module}.repo.ts`:

```typescript
import type { DatabaseInstance } from '@/core/database';
import { myEntities } from '@/core/database.schema';
import { eq } from 'drizzle-orm';
import type { Logger } from '@/types/logger';

export class MyEntityRepository {
  constructor(
    private db: DatabaseInstance,
    private logger: Logger
  ) {}

  async createOne(data: CreateData) {
    const [entity] = await this.db
      .insert(myEntities)
      .values(data)
      .returning();
    return entity;
  }

  async findOneById(id: string) {
    const [entity] = await this.db
      .select()
      .from(myEntities)
      .where(eq(myEntities.id, id))
      .limit(1);
    return entity || null;
  }

  async findMany(filters?: Filters) {
    return await this.db
      .select()
      .from(myEntities);
  }

  async updateOne(id: string, data: UpdateData) {
    const [entity] = await this.db
      .update(myEntities)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(myEntities.id, id))
      .returning();
    return entity;
  }

  async deleteOne(id: string) {
    await this.db
      .delete(myEntities)
      .where(eq(myEntities.id, id));
  }
}
```

Reference: `services/api-ts/src/handlers/person/repos/person.repo.ts`

### 5. Refactor

With green tests, refactor for clarity. Re-run tests after each change to ensure they stay green.

### 6. Verify

```bash
cd services/api-ts && bun test
```

## Error Handling Rules

Use the correct error class for each situation. Never throw generic `Error`.

| Situation | Error Class | Status |
|---|---|---|
| Missing/invalid input fields | `ValidationError` | 400 |
| No auth token or invalid token | `UnauthorizedError` | 401 |
| Valid token, insufficient role/ownership | `ForbiddenError` | 403 |
| Resource ID doesn't exist | `NotFoundError` | 404 |
| Duplicate/conflict (e.g., already exists) | `ConflictError` | 409 |
| Domain rule violated (valid input, bad state) | `BusinessLogicError` | 422 |
| Rate limit exceeded | `RateLimitError` | 429 |
| External service failure | `ExternalServiceError` | 503 |

## Critical Rules

- NEVER edit files in `src/generated/`
- Always use Drizzle ORM — no raw SQL
- Always add audit logging for data modifications
- Never log PII (names, emails, etc.) — only IDs
- Check consent fields before accessing sensitive data
- Use transactions for multi-table operations: `db.transaction(async (tx) => {...})`
- Validate external URLs before `window.open()` — check http/https scheme, add `noopener`. WHY: XSS via `javascript:` URLs.
- Use `window.location.href` after auth state changes, not `navigate()`. WHY: TanStack Router cache shows stale pre-auth UI.
- Document error responses in TypeSpec per-endpoint. WHY: Without it, handler and frontend guess differently about error states.
- Detect `as any` casts — usually signals type misalignment that hides bugs until runtime.
