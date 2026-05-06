# Codebase Structure

**Analysis Date:** 2026-05-06

## Directory Layout

```
dentalemon/                          # Monorepo root (Bun workspaces)
├── apps/
│   ├── account/                     # Generic reference app (auth, profile, booking)
│   │   ├── src/
│   │   │   ├── components/          # Inlined shadcn/ui primitives (~43 files)
│   │   │   ├── constants/           # Brand, locale constants
│   │   │   ├── features/            # Feature modules (billing, booking, comms, person, dental-license)
│   │   │   ├── hooks/               # Shared hooks (detect-country, format-date, etc.)
│   │   │   ├── lib/                 # Utility functions (detect-*, format-*)
│   │   │   ├── routes/              # TanStack Router file-based routes
│   │   │   ├── services/            # Service integrations (onesignal)
│   │   │   ├── styles/              # Global CSS
│   │   │   └── utils/               # Guards, config, runtime-config
│   │   ├── src-tauri/               # Tauri 2 desktop/mobile wrapper (Rust)
│   │   └── tests/e2e/               # Playwright E2E tests
│   │
│   └── dentalemon/                  # Dental practice management app
│       ├── src/
│       │   ├── components/          # Inlined shadcn/ui primitives (~45 files)
│       │   ├── constants/           # Brand (lemon gold), locale (en-PH, PHP), countries, languages, timezones
│       │   ├── features/            # Feature modules (11 domains)
│       │   │   ├── billing/         # Invoice list, detail, payment plans
│       │   │   ├── dashboard/       # Morning briefing, metric cards
│       │   │   ├── onboarding/      # Org/branch setup wizard
│       │   │   ├── patients/        # Patient list, registration, folder cards
│       │   │   ├── person/          # Person schemas
│       │   │   ├── pmd/             # Patient Medical Document viewer
│       │   │   ├── reports/         # Reporting components
│       │   │   ├── scheduling/      # Calendar, appointments
│       │   │   ├── settings/        # Clinic settings, fee schedule, locale
│       │   │   ├── staff/           # Staff list, create modal
│       │   │   └── workspace/       # Clinical workspace (dental chart, treatments, PMD)
│       │   ├── hooks/               # Shared hooks (detect-*, format-*, mobile, onesignal)
│       │   ├── lib/                 # Utility functions
│       │   ├── routes/              # TanStack Router routes
│       │   │   ├── _dashboard/      # Sidebar-layout routes (7 pages)
│       │   │   ├── _workspace/      # Full-screen clinical workspace ($patientId)
│       │   │   └── auth/            # Auth routes
│       │   ├── services/            # OneSignal integration
│       │   ├── styles/              # Global CSS
│       │   └── utils/               # Guards, config, PIN session, RBAC
│       ├── src-tauri/               # Tauri 2 wrapper (copied from account)
│       └── tests/e2e/               # Playwright E2E tests (18 spec files)
│
├── services/
│   ├── api-ts/                      # Reference TypeScript API (Hono + Drizzle)
│   │   ├── src/
│   │   │   ├── app.ts              # App factory — DI wiring, route registration
│   │   │   ├── index.ts            # Entry point — config, boot, Bun.serve
│   │   │   ├── core/               # Infrastructure services (25 files)
│   │   │   │   ├── auth.ts         # Better-Auth setup
│   │   │   │   ├── billing.ts      # Stripe integration
│   │   │   │   ├── config.ts       # Env var parsing → typed Config
│   │   │   │   ├── database.ts     # Drizzle + pg.Pool factory
│   │   │   │   ├── database.schema.ts  # baseEntityFields
│   │   │   │   ├── email.ts        # SMTP/Postmark client
│   │   │   │   ├── errors.ts       # Typed error classes + handler
│   │   │   │   ├── jobs.ts         # pg-boss scheduler
│   │   │   │   ├── logger.ts       # Pino logger factory
│   │   │   │   ├── notifs.ts       # OneSignal notification service
│   │   │   │   ├── openapi.ts      # Scalar docs registration
│   │   │   │   ├── storage.ts      # S3/MinIO storage provider
│   │   │   │   └── ws.ts           # WebSocket service
│   │   │   ├── generated/          # ⚠ NEVER EDIT — regenerated
│   │   │   │   ├── better-auth/    # Auth schema + OpenAPI spec
│   │   │   │   ├── migrations/     # Drizzle migration SQL files
│   │   │   │   ├── openapi/        # Routes, validators, registry, types (from TypeSpec)
│   │   │   │   └── websocket/      # WebSocket registry
│   │   │   ├── handlers/           # Business logic (19 modules)
│   │   │   │   ├── audit/          # Compliance logging
│   │   │   │   ├── billing/        # Stripe invoicing (base)
│   │   │   │   ├── booking/        # Generic scheduling
│   │   │   │   ├── comms/          # Chat + video calls
│   │   │   │   ├── dental-billing/ # Dental invoices, payments, plans
│   │   │   │   ├── dental-clinical/# Attachments, consent, labs, Rx, amendments
│   │   │   │   ├── dental-org/     # Org, branch, member management
│   │   │   │   ├── dental-patient/ # Dental patient CRUD (no repos/ dir — uses patient/)
│   │   │   │   ├── dental-pmd/     # Patient Medical Document generation/import
│   │   │   │   ├── dental-scheduling/ # Appointments
│   │   │   │   ├── dental-visit/   # Visits, dental chart, treatments, templates
│   │   │   │   ├── email/          # Email templates + queue
│   │   │   │   ├── emr/            # Electronic Medical Records
│   │   │   │   ├── notifs/         # Push notifications
│   │   │   │   ├── patient/        # Base patient CRUD (used by dental-patient)
│   │   │   │   ├── person/         # Person (central PII)
│   │   │   │   ├── provider/       # Practitioner, roles, providers
│   │   │   │   ├── reviews/        # NPS reviews
│   │   │   │   └── storage/        # File upload/download
│   │   │   ├── middleware/         # Request pipeline (auth, DI, security, validation)
│   │   │   ├── types/              # TypeScript type definitions (app.ts, auth.ts, logger.ts)
│   │   │   └── utils/              # Auth utilities, helpers
│   │   └── drizzle.config.ts       # Drizzle Kit configuration
│   │
│   ├── api-ts-embedded/             # Rust crate — QuickJS bundle for offline Tauri
│   └── cadence/                     # Rust P2P sync engine (Iroh transport)
│
├── specs/
│   └── api/                         # @monobase/api-spec — TypeSpec definitions
│       ├── src/
│       │   ├── modules/             # Per-module TypeSpec files (27 files)
│       │   │   ├── person.tsp       # Base modules with full .tsp + .md
│       │   │   ├── dental-visit.tsp # Dental modules (tsp only, no .md)
│       │   │   └── ...
│       │   ├── healthcare/          # Healthcare-specific TypeSpec (10 subdirs)
│       │   ├── common/              # Shared TypeSpec types
│       │   ├── localization/        # Country-specific TypeSpec (us, uk, ca, in, ph, au)
│       │   └── utils/               # TypeSpec utilities
│       ├── dist/                    # Compiled OpenAPI + TypeScript types
│       │   └── openapi/openapi.json # Canonical API spec
│       └── tests/contract/          # Hurl contract test scenarios
│
├── packages/
│   ├── sdk-ts/                      # Generated client SDK
│   │   └── src/
│   │       ├── client.ts            # HTTP client setup
│   │       ├── transport.ts         # Transport layer
│   │       ├── generated/           # Auto-generated from OpenAPI
│   │       │   ├── types.gen.ts     # TypeScript types
│   │       │   ├── sdk.gen.ts       # API client methods
│   │       │   └── @tanstack/       # Generated TanStack Query hooks
│   │       ├── react/               # React integration (auth, hooks, provider)
│   │       ├── flows/               # Multi-step flows (billing onboarding, file upload)
│   │       └── utils/               # Client utilities
│   ├── eslint-config/               # Shared ESLint flat configs
│   └── typescript-config/           # Shared tsconfig bases
│
├── scripts/                         # Root-level scripts
│   ├── seed-demo.ts                 # Demo data seeder
│   ├── br-coverage.ts               # Branch coverage utility
│   ├── run-contract-tests.ts        # Hurl contract test runner
│   └── run-schemathesis.ts          # OpenAPI fuzz testing
│
├── docs/
│   ├── development/                 # Dev standards docs (6+ files)
│   ├── prd/                         # Product requirements
│   │   └── context/wireframes/      # 28 HTML wireframes
│   └── research/                    # Research and external references
│
├── .claude/skills/                  # 21 Claude Code skills
├── .planning/codebase/              # GSD codebase analysis (this file)
├── .github/workflows/               # CI (contract tests)
├── package.json                     # Root workspace config
├── bunfig.toml                      # Bun configuration
├── test-setup.ts                    # Global test setup
├── CLAUDE.md                        # AI development instructions
├── CONTRIBUTING.md                  # Development guidelines
├── DESIGN.md                        # Design system spec
└── README.md                        # Project overview
```

## Directory Purposes

**`apps/dentalemon/src/features/`:**
- Purpose: Domain-specific UI code organized by business capability
- Contains: Each subdirectory has `components/` and optionally `hooks/` directories
- Key pattern: Hooks do raw fetch to API, components consume hook data
- 11 feature modules: billing, dashboard, onboarding, patients, person, pmd, reports, scheduling, settings, staff, workspace

**`apps/dentalemon/src/components/`:**
- Purpose: Inlined shadcn/ui component library (NOT domain-specific)
- Contains: 45 primitive UI components (Button, Card, Dialog, etc.)
- Key files: `app-sidebar.tsx`, `empty-state.tsx`, `phone-input.tsx` (some custom)
- Pattern: Copied from shadcn/ui CLI, modified in place

**`apps/dentalemon/src/routes/`:**
- Purpose: TanStack Router file-based routing
- Contains: Layout routes (`_dashboard.tsx`, `_workspace.tsx`) and page routes
- Pattern: `_dashboard/` = sidebar layout pages, `_workspace/$patientId` = full-screen clinical view

**`services/api-ts/src/handlers/`:**
- Purpose: All API business logic, organized by domain module
- Contains: 19 module directories, each with handler files + `repos/` subdirectory
- Key distinction: Base modules (12) are wired via generated routes. Dental modules (7) are manually wired in `app.ts`.

**`services/api-ts/src/core/`:**
- Purpose: Infrastructure plumbing — service factories, config, errors
- Contains: 25 files including tests
- Key pattern: `create*()` factory functions return typed service instances

**`services/api-ts/src/generated/`:**
- Purpose: Auto-generated code from TypeSpec and Better-Auth
- Contains: OpenAPI routes/validators/registry, auth schemas, migrations
- **CRITICAL:** Never edit. Regenerated by `bun run generate` and `bun run db:generate`

**`specs/api/src/modules/`:**
- Purpose: TypeSpec API definitions — the intended single source of truth
- Contains: 27 files (`.tsp` definitions + `.md` documentation for base modules)
- Key gap: Dental `.tsp` files exist but dental routes are still manually registered

**`packages/sdk-ts/`:**
- Purpose: Auto-generated TypeScript client SDK with TanStack Query hooks
- Contains: Generated types, client methods, React integration
- Key gap: Only covers base modules. Dentalemon app doesn't use it.

## Key File Locations

**Entry Points:**
- `services/api-ts/src/index.ts`: API server boot
- `apps/dentalemon/src/routes/__root.tsx`: Dentalemon app root
- `apps/account/src/routes/__root.tsx`: Account app root

**Configuration:**
- `services/api-ts/src/core/config.ts`: API config (env vars → typed object)
- `apps/dentalemon/src/utils/config.ts`: Frontend API URL config
- `apps/dentalemon/src/constants/brand.ts`: Brand colors, currency (PHP/₱), locale (en-PH)
- `services/api-ts/drizzle.config.ts`: Drizzle Kit migration config
- `package.json`: Root workspace + Bun version

**Core Logic:**
- `services/api-ts/src/app.ts`: App factory (DI, routes, middleware)
- `services/api-ts/src/core/database.schema.ts`: Base entity fields
- `services/api-ts/src/middleware/auth.ts`: Auth + RBAC middleware
- `services/api-ts/src/middleware/dependency.ts`: DI context injection
- `services/api-ts/src/types/app.ts`: Core type definitions (Variables, App, HandlerContext)

**Testing:**
- `apps/dentalemon/tests/e2e/*.spec.ts`: 18 Playwright E2E specs
- `services/api-ts/src/handlers/*/*.test.ts`: Backend unit tests (co-located)
- `services/api-ts/src/core/*.test.ts`: Core infrastructure tests
- `apps/dentalemon/src/**/*.test.ts`: Frontend component/hook tests (co-located)
- `specs/api/tests/contract/`: Hurl contract tests
- `test-setup.ts`: Global test setup (root level)

## Naming Conventions

**Files:**
- Handlers: `camelCase.ts` matching operation name — `createDentalPatient.ts`, `listDentalVisits.ts`
- Schemas: `kebab-case.schema.ts` — `visit.schema.ts`, `dental-invoice.schema.ts`
- Repos: `kebab-case.repo.ts` — `visit.repo.ts`, `dental-invoice.repo.ts`
- Tests: `*.test.ts` co-located with source — `createDentalPatient.test.ts`
- Frontend components: `kebab-case.tsx` — `dental-chart.tsx`, `patient-list.tsx`
- Frontend hooks: `use-kebab-case.ts` — `use-patients.ts`, `use-dental-chart.ts`
- Route files: `kebab-case.tsx` — `dashboard.tsx`, `dental-onboarding.tsx`

**Directories:**
- Handler modules: `kebab-case` — `dental-patient/`, `dental-visit/`
- Feature modules: `kebab-case` — `workspace/`, `scheduling/`
- Always have `components/` and optionally `hooks/` subdirectories

**Exports:**
- Handlers export named async functions: `export async function createDentalPatient(ctx: Context)`
- Schemas export table + types: `export const dentalVisits = pgTable(...)`, `export type DentalVisit = ...`
- Repos export classes: `export class PatientRepository { ... }`
- Hooks export named functions: `export function usePatients({ ... })`

## Where to Add New Code

**New Dental API Handler:**
1. Create handler file: `services/api-ts/src/handlers/dental-{module}/{operationName}.ts`
2. Create repo + schema if new entity: `services/api-ts/src/handlers/dental-{module}/repos/{entity}.schema.ts` and `{entity}.repo.ts`
3. Register route in `services/api-ts/src/app.ts` (manual dental route block, lines 143-225)
4. Add test: `services/api-ts/src/handlers/dental-{module}/{operationName}.test.ts`
5. Generate migration: `cd services/api-ts && bun run db:generate`

**New Dental Frontend Feature:**
1. Create feature directory: `apps/dentalemon/src/features/{feature-name}/`
2. Add components: `apps/dentalemon/src/features/{feature-name}/components/{component-name}.tsx`
3. Add hooks: `apps/dentalemon/src/features/{feature-name}/hooks/use-{feature-name}.ts`
4. Add route page: `apps/dentalemon/src/routes/_dashboard/{feature-name}.tsx`
5. Add to sidebar nav: `apps/dentalemon/src/routes/_dashboard.tsx` (navGroups array)
6. Add tests: Co-locate `*.test.ts` / `*.test.tsx` next to source files

**New Base Module (TypeSpec-first):**
1. Define API in TypeSpec: `specs/api/src/modules/{module}.tsp`
2. Build spec: `cd specs/api && bun run build`
3. Generate routes: `cd services/api-ts && bun run generate`
4. Implement handler: `services/api-ts/src/handlers/{module}/{operationName}.ts`
5. Create repo: `services/api-ts/src/handlers/{module}/repos/{entity}.repo.ts` + `.schema.ts`
6. Register in registry: Auto-handled by codegen

**New shadcn/ui Component:**
1. Use shadcn CLI or manually add to BOTH apps:
   - `apps/dentalemon/src/components/{component-name}.tsx`
   - `apps/account/src/components/{component-name}.tsx`
2. Until a shared `packages/ui/` exists, maintain in both places

**New E2E Test:**
- Location: `apps/dentalemon/tests/e2e/{test-name}.spec.ts`
- Fixtures: `apps/dentalemon/tests/e2e/fixtures.ts`
- Run: `cd apps/dentalemon && bun run test:e2e`

**New Utility/Hook:**
- Shared hooks: `apps/dentalemon/src/hooks/use-{name}.ts`
- Shared lib: `apps/dentalemon/src/lib/{name}.ts`
- Feature-specific: `apps/dentalemon/src/features/{feature}/hooks/use-{name}.ts`

## Special Directories

**`services/api-ts/src/generated/`:**
- Purpose: All auto-generated code (OpenAPI routes, auth schema, migrations)
- Generated: Yes — by `bun run generate` and `bun run db:generate`
- Committed: Yes
- **NEVER EDIT** — changes will be overwritten

**`specs/api/dist/`:**
- Purpose: Compiled OpenAPI spec + TypeScript types from TypeSpec
- Generated: Yes — by `cd specs/api && bun run build`
- Committed: Yes
- Key file: `dist/openapi/openapi.json` (canonical API spec)

**`apps/dentalemon/src-tauri/`:**
- Purpose: Tauri 2 desktop/mobile wrapper (Rust)
- Generated: Partially (icons are generated)
- Committed: Yes
- Status: Copied from account app, stub integration

**`.claude/skills/`:**
- Purpose: 21 Claude Code skills for development workflow
- Generated: No — hand-authored
- Committed: Yes
- Usage: Invoked as `/skill-name` in Claude Code sessions

**`docs/prd/context/wireframes/`:**
- Purpose: 28 HTML wireframe files for all PRD modules
- Generated: No — designed manually
- Committed: Yes
- Reference: Used by frontend developers for layout/UX guidance

**`apps/dentalemon/test-results/` and `test-results-fresh/`:**
- Purpose: Playwright test artifacts (screenshots, traces)
- Generated: Yes — by E2E test runs
- Committed: Should NOT be committed (check .gitignore)

---

*Structure analysis: 2026-05-06*
