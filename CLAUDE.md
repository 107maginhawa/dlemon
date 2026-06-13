# CLAUDE.md

This file provides AI-specific guidance for Claude Code when working with the Monobase Healthcare Platform (a healthcare-focused fork of `mono-js-lf`).

## Documentation Map

For detailed information, refer to:
- **[README.md](./README.md)** - Project overview, installation, commands, technology stack
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Development workflows, coding standards, testing guidelines
- **[specs/api/CONTRACT.md](./specs/api/CONTRACT.md)** - Wire-level API contract every implementation must satisfy
- **[specs/api/IMPLEMENTING.md](./specs/api/IMPLEMENTING.md)** - Playbook for adding a new server impl or client SDK in any language

## Repository Overview

**Monobase Application Platform** — a vertical-neutral monorepo template for SaaS products. Provides identity, billing, scheduling, communications, storage, and notifications as composable primitives. Built on Bun for ~3× faster execution than Node.js.

**Key Technologies**: Bun, PostgreSQL, Drizzle ORM, Hono API, TypeSpec, TanStack Router, Better-Auth, OneSignal, S3/MinIO

**Spec-first, polyglot-ready monorepo.** The OpenAPI document at
`specs/api/dist/openapi/openapi.json` is the single source of truth.
Every server implementation and every client SDK is generated from it,
and any language can have its own (`-ts`, `-rs`, `-go`, …) sibling
workspace.

**Monorepo Structure**:
- `apps/` - Frontend applications:
  - `account/` - Frozen upstream-template reference (auth, profile, settings patterns). Do not add product features.
  - `account/src-tauri/` - Tauri 2 desktop/mobile wrapper (Rust). Embeds api-ts (via the `api-ts-embedded` crate / QuickJS runtime) + the cadence P2P sync engine for offline-first operation. Optional — only built when packaging desktop/mobile.
- `services/` - Backend services:
  - `api-ts/` - Reference TypeScript API impl (Hono + Drizzle). Sibling impls (`api-rs`, `api-go`, …) are documented in `specs/api/IMPLEMENTING.md` but not yet present.
  - `api-ts-embedded/` - Rust crate that bundles `api-ts` into a QuickJS runtime (via `rquickjs` + esbuild) for offline-first Tauri embedding. Exposes `ApiTsEmbedded::new(db_path).request(method, path, body, headers) -> ApiTsResponse` to the host. JS bundle (`dist/bundle.js.gz`) is built by `cargo build` via `build.rs`.
  - `cadence/` - P2P sync engine (Rust + Iroh transport, SQLite/Valkey metadata backends, JWT scope auth). Embedded into `apps/account/src-tauri` for offline-first sync; can also run as a standalone hub. See `services/cadence/README.md`.
- `specs/api/` - TypeSpec API definitions; compiled to OpenAPI + TypeScript types. Also home of the contract docs and Hurl contract tests under `tests/contract/`.
- `packages/` - Shared packages:
  - `eslint-config/` - Shared ESLint flat configs (`base`, `react`, `next`)
  - `sdk-ts/` - Reference TypeScript client SDK (generated from OpenAPI via `@hey-api/openapi-ts`). Hand-written extras: client/transport, flows, utils/patch, react/use-optimistic-mutation.
  - `typescript-config/` - Shared TypeScript configs

  Note: `@monobase/api-spec` (consumed by SDK + apps for generated OpenAPI types) lives at `specs/api/`, not under `packages/`.
- `scripts/run-contract-tests.ts` - Runs the Hurl contract suite against `$API_URL`
- `.github/workflows/contract.yml` - CI: boots the impl, runs Hurl + Schemathesis
- `.claude/skills/` - Claude Code skills for the end-to-end development workflow (handler, typespec, test-api, test-contract, test-e2e, db-migrate, module-review, commit, pre-commit, …). Surface as `/skill-name` in Claude Code sessions; see the directory for the full set.

## Business Domain Modules

The API service ships nine vertical-neutral handler modules. Build your product
on top of these — add a `patient`, `tenant`, `student`, `merchant`, etc. module
under `services/api-ts/src/handlers/` for each domain you need.

1. **person** - User profile management and central PII safeguard
2. **booking** - Generic time-based scheduling (hosts, slots, bookings, events)
3. **billing** - Invoice-based payments via Stripe Connect
4. **audit** - Compliance logging (Pino structured logging)
5. **notifs** - Multi-channel notifications (email, push via OneSignal)
6. **comms** - Real-time chat rooms with embedded video calls (WebRTC)
7. **storage** - File upload/download (S3/MinIO)
8. **email** - Transactional emails (SMTP/Postmark)
9. **reviews** - NPS review system

All nine have matching TypeSpec definitions under `specs/api/src/modules/`.

**Note**: Authentication is handled by Better-Auth (integrated, not a separate module). Consent management is implemented as JSONB fields on the Person model (not a standalone module).

## Key Architectural Patterns

> Full details extracted to **[docs/architecture/ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md)**

Key patterns at a glance:
- **Person-Centric Design**: Person module is the central PII safeguard
- **Consent Management**: JSONB fields on Person model (marketing, data_sharing, sms, email)
- **API-First**: TypeSpec → OpenAPI → generate routes → implement handlers; never edit generated files
- **Configuration**: Env vars parsed to typed config objects (`services/api-ts/src/core/config.ts`)
- **OneSignal**: App-agnostic single `ONESIGNAL_APP_ID`; use `external_id` for user targeting
- **Module Structure**: Router → Validators → Handlers → Repositories

## Compliance Considerations

> See **[docs/architecture/ARCHITECTURE.md#compliance-considerations](./docs/architecture/ARCHITECTURE.md#compliance-considerations)**

- Audit trails via Pino structured logging with correlation IDs
- Consent validation against JSONB fields before processing
- Role-based access via Better-Auth; PII never logged in plain text

## OpenAPI Specification

The canonical API reference is at: `specs/api/dist/openapi/openapi.json`

**Before implementing frontend features**:
1. Check the OpenAPI spec for endpoint definitions
2. Import TypeScript types from `@monobase/api-spec/types`
3. Validate your implementation matches the schema

**Helpful commands**: See [README.md#api-schema-reference](./README.md#api-schema-reference)

## Database Patterns

### Drizzle ORM Usage
- Use prepared statements for performance
- Leverage type inference from schema definitions
- Use transactions for multi-table operations
- Reference existing patterns in `services/api-ts/src/handlers/*/repos/`

### Migration Workflow
1. Modify schema in `services/api-ts/src/handlers/{module}/repos/*.schema.ts`
2. Generate migration: `cd services/api-ts && bun run db:generate`
3. Review generated SQL in `src/generated/migrations/`
4. Migrations run automatically on server start

**Details**: See [CONTRIBUTING.md#database-workflow](./CONTRIBUTING.md#database-workflow)

## Frontend Development

Four frontend workspaces exist; their roles are distinct:

### `apps/dentalemon/` — Primary application (work here)
- **Port**: 3003
- **Routing**: TanStack Router, file-based in `src/routes/`
- **Auth**: Better-Auth with TanStack integration
- **Data Fetching**: TanStack Query via `@monobase/sdk-ts` hooks
- **UI Components**: shadcn/ui primitives in `src/components/ui/` (Radix-based)
- **State**: Zustand stores in `src/stores/`
- All product features live here. This is the app agents build, test, and ship.

### `apps/account/` — Upstream-template reference (do not feature-develop)
- **Port**: 3002
- Frozen reference implementation from `mono-js-lf` upstream
- Use only to pull upstream auth/account patterns; do not add product features here
- May be deleted or archived in Phase 8 of the structural remediation plan

### `apps/sample-workspace/` — Prototype sandbox (do not ship from)
- UI prototypes and design explorations only
- Code here is not production-ready; migrate proven patterns to `apps/dentalemon/`

### `apps/website/` — Marketing site (separate from the product)
- **Port**: 3004
- Standalone **Next.js** site for marketing/landing pages — not part of the
  Vite/TanStack product apps and shares no code with them except (optionally)
  brand assets. Linked into the workspace separately.

**Standards**: See [docs/development/CONTRIBUTING_FRONTEND.md](./docs/development/CONTRIBUTING_FRONTEND.md)

## Testing Approach

- **API**: Bun test framework (`cd services/api-ts && bun test`)
- **Frontend**: Playwright E2E tests (`cd apps/account && bun run test:e2e`)
- **Type Safety**: TypeScript checking across all workspaces

**Details**: See [CONTRIBUTING.md#testing-requirements](./CONTRIBUTING.md#testing-requirements)

## Development Protocol: Vertical TDD (MANDATORY)

> **Read [docs/development/VERTICAL_TDD.md](./docs/development/VERTICAL_TDD.md) before writing any code. This overrides default agent behavior.**

**Two non-negotiable rules:**

1. **Tests before code, always.** Write failing tests first (RED), then implement (GREEN), then refactor. No exceptions — not for "simple" changes, not for "I'll add them later."

2. **Vertical slices, never horizontal layers.** Each module goes fully end-to-end (TypeSpec → backend tests → backend → contract tests → frontend tests → frontend → E2E → verify) before starting the next module. Never batch "all backends first."

**Per-module 10-step sequence:**
```
1. TypeSpec → 2. Codegen → 3. Backend Tests (RED) → 4. Backend Impl (GREEN)
→ 5. Contract Tests (RED) → 6. Contract Impl (GREEN) → 7. Frontend Tests (RED)
→ 8. Frontend Impl (GREEN) → 9. E2E Test → 10. Verify Gate
```

**Gate:** A module is not complete until all test layers pass (backend unit + contract + frontend unit + E2E) and `bun test` + `bun run typecheck` are green with no regressions.

**Full protocol with examples, test locations, and rationalization rejection table:** [docs/development/VERTICAL_TDD.md](./docs/development/VERTICAL_TDD.md)

## Common Commands Quick Reference

**Full command reference**: See [README.md#available-commands](./README.md#available-commands)

Essential commands:
```bash
# Install dependencies
bun install

# API-first workflow
cd specs/api && bun run build              # Generate OpenAPI + types
cd ../../services/api-ts && bun run generate  # Generate routes/validators

# Start development
cd services/api-ts && bun dev        # API on port 7213
cd apps/account && bun dev        # Account app on port 3002

# Database
cd services/api-ts && bun run db:generate  # Generate migration
cd services/api-ts && bun run db:studio    # Open Drizzle Studio

# Testing
cd services/api-ts && bun test             # API tests
cd apps/account && bun run test:e2e     # E2E tests
```

## Important Notes

### What Exists
- ✅ **apps/account** - Reference Vite + TanStack Router app
- ✅ **apps/account/src/components/** - Inlined shadcn/ui primitives
- ✅ **apps/account/src-tauri/** - Tauri 2 desktop/mobile wrapper (Rust + QuickJS via api-ts-embedded + cadence)
- ✅ **services/api-ts/** - Reference Hono + Drizzle API
- ✅ **services/api-ts-embedded/** - Rust crate that bundles api-ts into QuickJS for offline Tauri (consumed by account/src-tauri)
- ✅ **services/cadence/** - Rust P2P sync engine (compiles standalone; embedded by account Tauri)
- ✅ **specs/api/** (`@monobase/api-spec`) - TypeSpec sources + generated OpenAPI + TS types
- ✅ **packages/sdk-ts/** - Auto-generated TanStack Query hooks + hand-written client/flows/utils
- ✅ **packages/eslint-config/** - Shared ESLint flat configs
- ✅ **specs/api/tests/contract/** - Hurl contract suite (22 scenarios, ~5s)
- ✅ **.claude/skills/** - Claude Code dev-workflow skills (see the directory for the full set)
- ✅ **Authentication** via Better-Auth (integrated, not a separate module)
- ✅ **Consent** as JSONB fields on Person model (not a separate module)
- ✅ **9 API handler modules** (person, booking, billing, audit, notifs, comms, storage, email, reviews)

### What's Intentionally Absent
- This template ships **no domain-vertical apps or modules**. Add your own
  (e.g., `apps/admin`, `services/api-ts/src/handlers/tenant/`) on top of the base.

### Known In-Progress Areas
- Offline P2P sync (cadence) is wired into the account Tauri wrapper at
  `apps/account/src-tauri/src/cadence_embed.rs` — `init`/`start` construct the
  `SqliteBackend` metadata store and the `SyncEngine` (the earlier `sync.rs`
  stub is gone). `cargo check` is green; treat end-to-end runtime sync as not
  yet fully exercised until validated against a live peer.

### Working with Cadence (Rust)
- Cadence lives at `services/cadence/` and is a Cargo crate independent of
  the Bun workspaces. Build with `cd services/cadence && cargo check
  --all-targets`. Full test suite (`cargo test`) needs Postgres + Valkey via
  `services/cadence/docker-compose.deps.yml`.
- The account Tauri wrapper consumes cadence via a `path = "../../../services/cadence"`
  dependency in `apps/account/src-tauri/Cargo.toml`. Run
  `cd apps/account/src-tauri && cargo check` after touching either crate.
- Tauri icons live in `apps/account/src-tauri/icons/` and are committed.
  Regenerate from the SVG via:
  `bunx tauri icon apps/account/public/favicon.svg --output apps/account/src-tauri/icons`

## When in Doubt

1. Check [README.md](./README.md) for commands and setup
2. Check [CONTRIBUTING.md](./CONTRIBUTING.md) for development patterns
3. Reference existing handlers in `services/api-ts/src/handlers/` for implementation patterns
4. Check OpenAPI spec at `specs/api/dist/openapi/openapi.json` for API contracts
