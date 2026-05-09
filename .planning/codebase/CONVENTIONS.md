# Coding Conventions

**Analysis Date:** 2026-05-06

## Naming Patterns

**Files (Backend Handlers — TWO conflicting conventions):**
- **Convention A (hand-written):** `camelCase.ts` — e.g., `createOrganization.ts`, `listMembers.ts`, `verifyPin.ts`
- **Convention B (generated from OpenAPI):** `PascalCase_action.ts` — e.g., `DentalMembershipManagement_create.ts`, `DentalBranchManagement_list.ts`
- Both conventions coexist in the same directory (`services/api-ts/src/handlers/dental-org/`). Convention B matches TypeSpec `operationId`.
- **Use Convention B** for any handler backed by a generated route; use Convention A only for non-OpenAPI utility handlers.

**Files (Backend Repos/Schemas):**
- `kebab-case.repo.ts` and `kebab-case.schema.ts` — e.g., `organization.repo.ts`, `dental-invoice.schema.ts`
- Tests co-located: `organization.test.ts`

**Files (Frontend Components):**
- `kebab-case.tsx` — e.g., `patient-list.tsx`, `dental-chart.tsx`, `phone-input.tsx`
- Tests co-located: `patient-list.test.ts`

**Files (Frontend Hooks):**
- `use-kebab-case.ts` — e.g., `use-patients.ts`, `use-format-date.ts`, `use-mobile.ts`
- Tests co-located: `use-patients.test.ts`

**Files (Frontend Lib/Utils):**
- `kebab-case.ts` — e.g., `detect-timezone.ts`, `format-currency.ts`

**Functions:**
- `camelCase` everywhere — `createOrganization`, `buildTestApp`, `toPatientCard`
- Generated OpenAPI handlers use `PascalCase_action` matching their operationId

**Variables:**
- `camelCase` — `invoiceNumber`, `subtotalCents`, `branchId`
- Constants: `SCREAMING_SNAKE_CASE` — `VALID_ORG_TIERS`, `TIER_MEMBER_LIMITS`, `TOOTH_NUMBERS`

**Types/Interfaces:**
- `PascalCase` — `DentalOrganization`, `NewDentalOrganization`, `OrgTier`, `PatientCardData`
- Generated validator types: `PascalCase` with underscores — `DentalMembershipManagement_createBody`

**Database Tables:**
- `snake_case` — `dental_organization`, `dental_membership`, `dental_branch`

**Database Columns:**
- `snake_case` via Drizzle column mapping — `owner_person_id`, `created_at`

**React Components:**
- `PascalCase` exports — `PatientList`, `PhoneInput`, `DentalChart`

## Code Style

**Formatting:**
- No Prettier config detected at project root
- ESLint flat config only (`packages/eslint-config/base.js`)
- No auto-formatter enforced — formatting is inconsistent (some files omit semicolons, others use them)

**Linting:**
- `@monobase/eslint-config` shared package at `packages/eslint-config/`
- Base config: `packages/eslint-config/base.js`
- Key rules:
  - `@typescript-eslint/no-unused-vars`: warn (underscore-prefixed ignored)
  - `@typescript-eslint/no-explicit-any`: warn (widely violated — `as any` used throughout)
  - `@typescript-eslint/consistent-type-imports`: warn (prefer `type` imports)
  - `no-console`: warn (allow `warn`, `error`, `info`)
- Run: `bun run lint` from `services/api-ts/` or `apps/dentalemon/`

## Import Organization

**Order (observed, not enforced):**
1. Node built-ins (rare — Bun runtime)
2. Third-party packages (`hono`, `drizzle-orm`, `zod`, `@tanstack/*`)
3. Workspace packages (`@monobase/api-spec`, `@monobase/sdk-ts`)
4. Internal aliases (`@/core/*`, `@/handlers/*`, `@/generated/*`)
5. Relative imports (`./repos/organization.repo`)

**Path Aliases:**
- Backend (`services/api-ts/`): `@/*` → `src/*`, with sub-aliases `@/core/*`, `@/handlers/*`, `@/middleware/*`, `@/utils/*`, `@/generated/*`, `@/types/*`
- Frontend (`apps/dentalemon/`): `@/*` → `src/*` (via vite-tsconfig-paths)

**Type imports:**
- ESLint warns to use `import type { ... }` for type-only imports
- Inconsistently followed — many files use regular `import` for types

## Error Handling

**Backend Error Classes:**
- Hierarchy rooted at `AppError` in `services/api-ts/src/core/errors.ts`
- Subclasses: `UnauthorizedError` (401), `ForbiddenError` (403), `ValidationError` (400), `NotFoundError` (404), `BusinessLogicError` (422), `ConflictError` (409), `RateLimitError` (429), `AuthenticationError` (401), `AuthorizationError` (403), `HipaaComplianceError` (400), `TimeoutError` (408), `ExternalServiceError` (503)
- **Use these error classes** — never throw raw `Error` with status codes
- Error handler registered via `registerHandlers(app, config)` in `services/api-ts/src/core/errors.ts`

**Handler Auth Pattern:**
```typescript
// HandlerContext (manual JSON parsing — DEPRECATED pattern)
const user = ctx.get('user') as User | undefined;
if (!user?.id) throw new UnauthorizedError('Authentication required');
const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;

// ValidatedContext (preferred — uses zValidator middleware)
const session = ctx.get('session');
if (!session) throw new UnauthorizedError();
const body = ctx.req.valid('json');
```

**CRITICAL INCONSISTENCY:** ~39 handlers use manual `ctx.req.json()` parsing with hand-rolled validation. ~119+ handlers use `ctx.req.valid()` with zValidator middleware. **Always use `ValidatedContext` with `ctx.req.valid()`** for new code.

**Frontend Error Handling:**
- No global error boundary detected
- API errors handled per-component via TanStack Query `error` states
- `fetch()` calls use `credentials: 'include'` for auth cookies

## Logging

**Framework:** Pino (`pino` v9 + `pino-pretty`)

**Pattern:**
- Logger injected via Hono context: `ctx.get('logger')`
- Structured JSON logging with child loggers per-request
- Tests stub logger: `{ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }`

## Comments

**When to Comment:**
- Every handler file has a JSDoc header block with description and HTTP method/path
- Test files have module-level comment blocks listing covered FRs (functional requirements)
- Inline comments for business rules (e.g., tier limits, tax calculations)

**JSDoc:**
- Used on repository methods and error classes
- Not consistently used on all handler functions
- Generated code has no JSDoc

## Function Design

**Handler Size:**
- Handlers are small (30-80 lines) — single responsibility
- Each handler is a standalone exported async function, one per file

**Parameters:**
- Backend: Single `ctx` parameter (Hono context with injected dependencies)
- Frontend hooks: Options object pattern — `useFormatDate({ format: 'short', locale: 'en-US' })`

**Return Values:**
- Handlers return `ctx.json(data, statusCode)` or `Promise<Response>`
- Repository methods return entity or `null` for not-found

## Module Design

**Backend Handler Module Structure:**
```
services/api-ts/src/handlers/{module}/
  ├── repos/              # Repository + schema files
  │   ├── {entity}.repo.ts
  │   ├── {entity}.schema.ts
  │   └── {entity}.test.ts
  ├── jobs/               # Background jobs (optional)
  ├── utils/              # Module-specific utilities (optional)
  ├── {handlerName}.ts    # Individual handler files
  └── {handlerName}.test.ts
```

**Frontend Feature Module Structure:**
```
apps/dentalemon/src/features/{feature}/
  ├── components/
  │   ├── {component-name}.tsx
  │   └── {component-name}.test.ts
  └── hooks/
      ├── use-{hook-name}.ts
      └── use-{hook-name}.test.ts
```

**Exports:**
- Handlers: Named export of async function matching filename
- Repositories: Class export (instantiated per-request in handlers, NOT singletons)
- Components: Named export of React function component
- Schemas: Named exports of Drizzle table + inferred types

**Barrel Files:** Not used. Direct imports everywhere.

## Repository Pattern

**Base Class:** `DatabaseRepository<TEntity, TNewEntity, TFilters>` at `services/api-ts/src/core/database.repo.ts`
- Provides `createOne()`, `findOneById()`, `findMany()` with pagination
- Subclasses implement `buildWhereConditions(filters)` for entity-specific filtering
- Instantiated per-request: `new OrganizationRepository(db, logger)`

**Schema Pattern:**
```typescript
// services/api-ts/src/handlers/{module}/repos/{entity}.schema.ts
import { baseEntityFields } from '@/core/database.schema';

export const myTable = pgTable('my_table', {
  ...baseEntityFields,  // id, createdAt, updatedAt, version, createdBy, updatedBy
  // entity-specific columns
});

export type MyEntity = typeof myTable.$inferSelect;
export type NewMyEntity = typeof myTable.$inferInsert;
```

**Base Entity Fields** (`services/api-ts/src/core/database.schema.ts`):
- `id`: UUID primary key (auto-generated)
- `createdAt`, `updatedAt`: timestamps
- `version`: integer for optimistic locking
- `createdBy`, `updatedBy`: optional UUID audit fields

---

*Convention analysis: 2026-05-06*
