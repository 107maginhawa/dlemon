# Architecture

**Analysis Date:** 2026-05-06

## System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend Apps (Vite + React 19)            │
├──────────────────────┬──────────────────────────────────────────┤
│   account (generic)  │       dentalemon (dental vertical)       │
│ `apps/account/`      │       `apps/dentalemon/`                 │
└──────────┬───────────┴──────────────┬───────────────────────────┘
           │                          │
           ▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SDK-TS (client + generated hooks)             │
│                   `packages/sdk-ts/`                            │
│   ⚠ dentalemon bypasses SDK — uses raw fetch to /dental/*      │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Service (Hono + Bun)                     │
│                    `services/api-ts/`                           │
│  ┌──────────────────┐  ┌────────────────────────────────────┐  │
│  │ Generated Routes │  │ Manual /dental/* Routes (app.ts)   │  │
│  │ (158 endpoints)  │  │ (41 endpoints, no TypeSpec)        │  │
│  │ via TypeSpec→OAI │  │ Zod validation inline per handler  │  │
│  └────────┬─────────┘  └─────────────┬──────────────────────┘  │
│           │                          │                          │
│           ▼                          ▼                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          Handler Modules (19 total)                       │  │
│  │  Base: audit, billing, booking, comms, email, emr,       │  │
│  │        notifs, patient, person, provider, reviews,       │  │
│  │        storage                                           │  │
│  │  Dental: dental-billing, dental-clinical, dental-org,    │  │
│  │          dental-patient, dental-pmd, dental-scheduling,  │  │
│  │          dental-visit                                    │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                     │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │        Repository Layer (Drizzle ORM + PostgreSQL)        │  │
│  │        `handlers/*/repos/*.repo.ts`                       │  │
│  │        `handlers/*/repos/*.schema.ts`                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│  PostgreSQL + External Services                                 │
│  (Stripe, S3/MinIO, OneSignal, SMTP/Postmark, pg-boss jobs)    │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| API Entry | Parse config, boot Bun.serve | `services/api-ts/src/index.ts` |
| App Factory | Wire DI, register routes, attach middleware | `services/api-ts/src/app.ts` |
| DI Middleware | Inject all services into Hono context | `services/api-ts/src/middleware/dependency.ts` |
| Auth Middleware | Session validation, RBAC | `services/api-ts/src/middleware/auth.ts` |
| Generated Routes | TypeSpec-sourced endpoints with Zod validators | `services/api-ts/src/generated/openapi/routes.ts` |
| Handler Registry | Maps operationId to handler function | `services/api-ts/src/generated/openapi/registry.ts` |
| Base Entity Schema | Shared id/timestamps/version/audit fields | `services/api-ts/src/core/database.schema.ts` |
| Config | Env var parsing into typed Config object | `services/api-ts/src/core/config.ts` |
| Error Handling | Typed errors, global error handler | `services/api-ts/src/core/errors.ts` |
| SDK Client | Generated TanStack Query hooks for base modules | `packages/sdk-ts/src/generated/` |
| Account App | Generic reference app (auth, profile, booking) | `apps/account/` |
| Dentalemon App | Dental practice management UI | `apps/dentalemon/` |

## Pattern Overview

**Overall:** Spec-first monorepo with a factory-pattern API service

**Key Characteristics:**
- TypeSpec defines the API contract, generates OpenAPI, which generates routes/validators/types
- Dental-specific endpoints bypass TypeSpec entirely — registered manually in `app.ts`
- Frontend apps use raw fetch against `/dental/*` endpoints (no SDK layer)
- DI is per-request via Hono context variables (no IoC container)
- Repos use constructor-injected `DatabaseInstance` (Drizzle ORM wrapper)

## Layers

**TypeSpec Definitions:**
- Purpose: Single source of truth for base API contract
- Location: `specs/api/src/modules/*.tsp`
- Contains: API models, endpoints, validation rules
- Depends on: Nothing
- Used by: Code generation pipeline

**Generated OpenAPI Layer:**
- Purpose: Route registration, Zod validators, type definitions
- Location: `services/api-ts/src/generated/openapi/`
- Contains: `routes.ts` (158 endpoints), `validators.ts`, `registry.ts`, `types.ts`
- Depends on: TypeSpec compilation output
- Used by: `app.ts` via `registerRoutes()`
- **NEVER EDIT** — regenerated by `bun run generate`

**Manual Dental Routes (Bypass Layer):**
- Purpose: Dental-specific endpoints not in TypeSpec
- Location: `services/api-ts/src/app.ts` (lines 143-225)
- Contains: 41 manually registered routes for `/dental/*`
- Depends on: `authMiddleware`, individual handler imports
- Used by: Dentalemon frontend app
- **Problem:** No TypeSpec definitions, no generated validators, inline Zod in handlers

**Handler Layer:**
- Purpose: Business logic for each API endpoint
- Location: `services/api-ts/src/handlers/{module}/`
- Contains: One file per operation (e.g., `createDentalPatient.ts`)
- Depends on: Repos, core services via `ctx.get()`
- Used by: Generated routes or manual app.ts registration

**Repository Layer:**
- Purpose: Database access, query building, schema definitions
- Location: `services/api-ts/src/handlers/{module}/repos/`
- Contains: `*.schema.ts` (Drizzle tables), `*.repo.ts` (query classes)
- Depends on: `DatabaseInstance`, `drizzle-orm`
- Used by: Handlers

**Core Services Layer:**
- Purpose: Cross-cutting infrastructure (auth, storage, email, billing, etc.)
- Location: `services/api-ts/src/core/`
- Contains: Factory functions (`createAuth`, `createStorageProvider`, etc.)
- Depends on: Config, external SDKs (Stripe, AWS, OneSignal)
- Used by: `app.ts` factory, handlers via DI context

**Middleware Layer:**
- Purpose: Request pipeline (auth, logging, DI, CORS, security)
- Location: `services/api-ts/src/middleware/`
- Contains: `auth.ts`, `dependency.ts`, `request.ts`, `security.ts`, `validation.ts`, `expand.ts`
- Depends on: Core services
- Used by: `app.ts` global middleware chain

**Frontend Feature Layer:**
- Purpose: UI components organized by domain
- Location: `apps/dentalemon/src/features/{module}/`
- Contains: `components/`, `hooks/` per feature
- Depends on: Raw fetch to API, shadcn/ui components
- Used by: TanStack Router route files

## Data Flow

### Primary Request Path (Generated / Base Modules)

1. HTTP request → Bun.serve → `app.fetch` (`services/api-ts/src/index.ts:56`)
2. Middleware chain: requestId → DI injection → logger → security → CORS (`services/api-ts/src/app.ts:119-131`)
3. Generated route match → auth middleware → Zod validator → handler (`services/api-ts/src/generated/openapi/routes.ts`)
4. Handler reads deps from `ctx.get('database')` etc., calls repo (`services/api-ts/src/handlers/*/`)
5. Repo executes Drizzle query → PostgreSQL (`services/api-ts/src/handlers/*/repos/*.repo.ts`)
6. Handler returns `ctx.json(result)` → response

### Dental-Specific Request Path (Manual Routes)

1. HTTP request → same middleware chain
2. Manual route match in `app.ts` → `dentalAuth` middleware → handler directly (`services/api-ts/src/app.ts:143-225`)
3. Handler does inline body parsing (`ctx.req.json()`) and manual validation (`services/api-ts/src/handlers/dental-patient/createDentalPatient.ts:31-34`)
4. Handler instantiates repo directly: `new PatientRepository(db, logger)` (`services/api-ts/src/handlers/dental-patient/createDentalPatient.ts:50`)
5. Repo → Drizzle → PostgreSQL
6. Handler returns `ctx.json(result)`

### Frontend Data Flow (Dentalemon App)

1. Route loads via TanStack Router file-based routing (`apps/dentalemon/src/routes/`)
2. `beforeLoad` guard checks auth + org context via fetch (`apps/dentalemon/src/routes/_dashboard.tsx:31-48`)
3. Feature hooks use `useQuery` with raw fetch to `/dental/*` endpoints (`apps/dentalemon/src/features/patients/hooks/use-patients.ts`)
4. Components render with shadcn/ui primitives from inlined component library (`apps/dentalemon/src/components/`)

**State Management:**
- Server state: TanStack Query via custom hooks (raw fetch, NOT SDK-generated hooks)
- Local state: React useState in route components and features
- Org context: `localStorage` for `currentBranchId`, `currentOrgId`, `currentMemberRole`, `currentMemberId` — refreshed from API on dashboard load
- PIN session: Custom `pin-session.ts` utility (`apps/dentalemon/src/utils/pin-session.ts`)

## Key Abstractions

**DatabaseInstance:**
- Purpose: Drizzle ORM wrapper over pg.Pool (PostgreSQL) or SQLite (embedded)
- Examples: `services/api-ts/src/core/database.ts`
- Pattern: Created by `createDatabase(config)`, injected via DI middleware

**BaseEntity / baseEntityFields:**
- Purpose: Standard fields for all tables (id, timestamps, version, audit)
- Examples: `services/api-ts/src/core/database.schema.ts`
- Pattern: Spread into every pgTable definition: `{ ...baseEntityFields, ... }`

**App Type:**
- Purpose: Hono instance augmented with all service dependencies
- Examples: `services/api-ts/src/types/app.ts:109-120`
- Pattern: `Hono<{ Variables }> & { logger, database, auth, ... }`

**HandlerContext / ValidatedContext:**
- Purpose: Typed Hono context with `ctx.get()` access to DI services
- Examples: `services/api-ts/src/types/app.ts:54-103`
- Pattern: Base handlers use `HandlerContext`, validated handlers use `ValidatedContext<TJson, TQuery, TParam>`

**Repository Pattern:**
- Purpose: Encapsulate Drizzle queries per entity
- Examples: `services/api-ts/src/handlers/patient/repos/patient.repo.ts`, `services/api-ts/src/handlers/dental-visit/repos/visit.repo.ts`
- Pattern: Class with constructor `(db: DatabaseInstance, logger: Logger)`, methods for CRUD

## Entry Points

**API Server:**
- Location: `services/api-ts/src/index.ts`
- Triggers: `bun src/index.ts` or `bun dev`
- Responsibilities: Parse config, create app, initialize (migrations, jobs), start Bun.serve on port 7213

**Dentalemon Frontend:**
- Location: `apps/dentalemon/src/routes/__root.tsx`
- Triggers: `vite dev` on port (configured in vite.config.ts)
- Responsibilities: Auth provider, router outlet, toast notifications

**Account Frontend:**
- Location: `apps/account/src/routes/__root.tsx`
- Triggers: `vite dev` on port 3002
- Responsibilities: Generic reference app for auth/profile/booking

**Seed Script:**
- Location: `scripts/seed-demo.ts`
- Triggers: `bun run seed`
- Responsibilities: Populate demo data for development

## Architectural Constraints

- **Runtime:** Bun single-threaded event loop. No Node.js. `Bun.serve` for HTTP.
- **Global state:** None in API service — all state flows through DI middleware per request. Frontend uses localStorage for org context (fragile).
- **Circular imports:** Not detected, but `dental-patient` handler imports from `patient/repos/` and `person/repos/` — cross-module coupling.
- **No tenant isolation:** `baseEntityFields` has no `tenant_id`. The CLAUDE.md mandates it, but the actual schema omits it. Org/branch scoping is done ad-hoc in handlers via `branchId` params.
- **Generated code boundary:** `services/api-ts/src/generated/` is fully regenerated. Never edit. Dental modules are NOT in the generated layer.

## Anti-Patterns

### Dual Route Registration System

**What happens:** Base modules use TypeSpec → generated routes with Zod validators. Dental modules are manually registered in `app.ts` with inline validation in handlers.
**Why it's wrong:** 41 dental routes bypass the spec-first workflow. No OpenAPI docs for dental endpoints. No generated Zod validators. Validation logic is scattered across handler files. Two different patterns for the same thing in one codebase.
**Do this instead:** Define dental endpoints in TypeSpec (`specs/api/src/modules/dental-*.tsp`), run codegen, implement handlers. Some `.tsp` files exist but routes are still manual.

### Frontend Bypasses SDK

**What happens:** `apps/dentalemon/` uses raw `fetch()` in custom hooks instead of `@monobase/sdk-ts` generated hooks.
**Why it's wrong:** The SDK exists with generated TanStack Query hooks for base modules. Dental features duplicate this pattern manually, losing type safety, error handling, and cache invalidation consistency.
**Do this instead:** Either extend the SDK with dental-specific generated hooks (once dental TypeSpec is complete), or create a dedicated dental client module in the SDK.

### localStorage for Auth Context

**What happens:** Org context (branchId, orgId, memberRole, memberId) stored in localStorage, refreshed on dashboard load (`apps/dentalemon/src/routes/_dashboard.tsx:37-41`).
**Why it's wrong:** localStorage is not reactive. Stale after re-seeding or branch changes. Race conditions if multiple tabs. Not cleared on logout.
**Do this instead:** Use TanStack Query or Zustand for org context with proper cache invalidation.

### No Shared UI Package

**What happens:** Both `apps/account/` and `apps/dentalemon/` have ~43-45 inlined shadcn/ui component files each (`src/components/`). Most are identical copies.
**Why it's wrong:** Bug fixes and style changes must be applied in two places. Component drift is inevitable.
**Do this instead:** Extract shared UI into `packages/ui/` or use shadcn/ui's monorepo pattern.

## Error Handling

**Strategy:** Typed error classes with global error handler

**Patterns:**
- Custom errors: `UnauthorizedError`, `ForbiddenError`, `ValidationError`, `NotFoundError` (`services/api-ts/src/core/errors.ts`)
- Handlers throw typed errors; global handler in `registerErrorHandlers()` catches and formats responses
- Frontend: No consistent error handling pattern — some hooks have try/catch, others rely on TanStack Query's `error` state

## Cross-Cutting Concerns

**Logging:** Pino structured logging (`services/api-ts/src/core/logger.ts`). Request ID correlation via middleware. Frontend uses console.
**Validation:** Generated Zod validators for base modules (`services/api-ts/src/generated/openapi/validators.ts`). Manual inline validation for dental modules.
**Authentication:** Better-Auth with session cookies. Auth middleware validates session and injects `user`/`session` into context. Dental-specific PIN-based staff auth layered on top.
**Background Jobs:** pg-boss for async work (email, notifications, audit, booking reminders) (`services/api-ts/src/core/jobs.ts`).

---

*Architecture analysis: 2026-05-06*
