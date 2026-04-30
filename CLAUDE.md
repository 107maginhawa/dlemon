# CLAUDE.md

This file provides AI-specific guidance for Claude Code when working with the Monobase Application Platform.

## Documentation Map

For detailed information, refer to:
- **[README.md](./README.md)** - Project overview, installation, commands, technology stack
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Development workflows, coding standards, testing guidelines

## Repository Overview

**Monobase Application Platform** - A comprehensive full-stack monorepo platform providing video sessions, service marketplace, and user management. Built with Bun runtime for 3x faster performance than Node.js.

**Key Technologies**: Bun, PostgreSQL, Drizzle ORM, Hono API, TypeSpec, TanStack Router, Better-Auth, OneSignal, S3/MinIO

**Monorepo Structure**:
- `apps/` - Frontend applications:
  - `account/` - Vite + TanStack Router app for self-service account management
  - `patient/` - Vite + TanStack Router app for the patient-facing experience (also ships as a Tauri desktop app via `apps/patient/src-tauri/`)
  - `provider/` - Vite + TanStack Router app for the provider/practitioner portal
  - `website/` - Next.js public marketing site
- `services/` - Backend services:
  - `api/` - HTTP API (Hono + Drizzle) with business modules
  - `cadence/` - Rust P2P sync engine (Iroh transport, SQLite/Valkey metadata backends, JWT scope auth). Embedded into the patient Tauri app for offline-first sync; can also run as a standalone hub. See `services/cadence/README.md`.
- `specs/api/` - TypeSpec API definitions (compiled to OpenAPI + TypeScript types)
- `packages/` - Shared packages:
  - `eslint-config/` - Shared ESLint flat configs (`base`, `react`, `next`)
  - `sdk/` - Type-safe API client + TanStack Query hooks
  - `typescript-config/` - Shared TypeScript configs
  - `ui/` - Shared UI component library (Radix primitives, Tailwind)
- `.claude/skills/` - 15 Claude Code skills for end-to-end development workflow (typespec, handler, frontend-module, db-migrate, dev-api, dev-app, test-api, test-e2e, typecheck, pre-commit, commit, debug, prd, develop, shadcn). Surface as `/skill-name` in Claude Code sessions.

## Business Domain Modules

The API service implements 13 handler modules. The first nine are documented as
core business modules; the latter four (`patient`, `provider`, `emr`, `ws`)
are platform-specific modules that compose them and may evolve independently.

Core modules:

1. **person** - User profile management and central PII safeguard
2. **booking** - Professional booking and scheduling system
3. **billing** - Invoice-based payments (Stripe integration)
4. **audit** - Compliance logging (Pino structured logging)
5. **notifs** - Multi-channel notifications (email, push via OneSignal)
6. **comms** - Video/chat sessions (WebRTC) and messaging
7. **storage** - File upload/download (S3/MinIO)
8. **email** - Transactional emails (SMTP/Postmark)
9. **reviews** - NPS review system

Platform-specific modules:

10. **patient** - Patient profile and patient-side workflows (extends `person`)
11. **provider** - Provider/practitioner profile and listing (extends `person`)
12. **emr** - Electronic medical records: consultation notes, vitals, prescriptions, follow-ups
13. **ws** - WebSocket transport for real-time chat and WebRTC signaling (handler-only; no TypeSpec/REST surface)

TypeSpec definitions exist for modules 1-12 (12 `.tsp` files under
`specs/api/src/modules/`). Module 13 (`ws`) is transport-level only.

**Note**: Authentication is handled by Better-Auth (integrated, not a separate module). Consent management is implemented as JSONB fields on the Person model (not a standalone module).

## Key Architectural Patterns

### Person-Centric Design
The Person module is the central PII safeguard for user data.

### Consent Management
Consent is embedded in the Person model as JSONB fields rather than a standalone module:
```typescript
{
  granted: boolean,
  granted_at: timestamp,
  ip_address: string,
  updated_at: timestamp,
  updated_by: string
}
```

Consent types on Person:
- **marketing_consent**: Marketing communications
- **data_sharing_consent**: Data sharing preferences
- **sms_consent**: SMS notifications
- **email_consent**: Email communications

### API-First Development
Always follow this workflow:
1. Define APIs in TypeSpec (`specs/api/src/modules/`)
2. Generate OpenAPI + TypeScript types (`cd specs/api && bun run build`)
3. Generate routes/validators/handlers (`cd services/api && bun run generate`)
4. Implement handler business logic (`services/api/src/handlers/`)
5. Use generated types from `@monobase/api-spec` in frontends

**Why**: Type safety across frontend/backend, single source of truth, auto-generated docs

**⚠️ CRITICAL - Never Edit Generated Files**:
- `services/api/src/generated/openapi/*` - Routes, validators, registry (regenerated every time)
- `services/api/src/generated/better-auth/*` - Auth schema and specs
- `services/api/src/generated/migrations/*` - Database migrations

**✅ Only Edit**:
- TypeSpec files (`specs/api/src/modules/*.tsp`)
- Handler implementations (`services/api/src/handlers/{module}/*.ts`)
- Database schemas (`services/api/src/db/schema/*.ts`)

See [CONTRIBUTING.md#code-generation](./CONTRIBUTING.md#code-generation---do-not-edit) for complete details.

### Configuration Approach
Environment variables are parsed into typed configuration objects (see `services/api/src/core/config.ts`). Not file-based configuration.

### OneSignal Multi-App Architecture
OneSignal follows an **app-agnostic pattern** like other services (Storage, Email, Billing):

**Single App ID Approach**:
- Use the **same** `ONESIGNAL_APP_ID` across all frontends (client, service provider, website)
- Frontend apps: Set `VITE_ONESIGNAL_APP_ID` to the same value
- Backend API: Uses same app ID to send notifications

**Optional App Tagging**:
- Set `VITE_ONESIGNAL_APP_TAG=client` or `service_provider` in frontend .env (optional)
- Apps auto-tag themselves on initialization
- Most notifications ignore tags (app-agnostic)
- Use `targetApp` parameter only for app-specific announcements

**Why This Works**:
- OneSignal uses `external_id` (person ID) to target users across devices/apps
- Users with both client/service provider roles receive notifications in whichever app they're using
- Production deployment should use subdomains: `user.example.com`, `admin.example.com`

**API Pattern**:
```typescript
// Send to user (app-agnostic - default)
notificationRepo.createNotificationForModule({
  recipient: personId,
  type: 'booking-reminder',
  channel: 'push',
  // No targetApp - reaches user in any app
});

// Send only to specific app (rare)
notificationRepo.createNotificationForModule({
  recipient: personId,
  type: 'system',
  channel: 'push',
  targetApp: 'client', // Only if VITE_ONESIGNAL_APP_TAG is configured
});
```

### Module Structure Pattern
Backend handlers follow: **Router → Validators → Service → Handlers**

Each handler directory contains:
- Handler files (CRUD operations)
- `repos/` - Database repositories
- `jobs/` - Background job definitions
- `utils/` - Module-specific utilities

## Enterprise Compliance Requirements

When working with sensitive data:

### Data Privacy Compliance
- **Audit Trails**: All user data access must be logged with Pino
- **Consent Validation**: Check JSONB consent fields before processing
- **Role-Based Access**: Verify user roles via Better-Auth
- **Correlation IDs**: Include in all log entries for traceability

### Data Security
- Use Drizzle ORM for type-safe, SQL-injection-proof queries
- Validate all inputs with Zod schemas
- Never log sensitive personal information (PII) in plain text
- Follow secure patterns in existing handlers

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
- Reference existing patterns in `services/api/src/handlers/*/repos/`

### Migration Workflow
1. Modify schema in `services/api/src/db/schema/`
2. Generate migration: `cd services/api && bun run db:generate`
3. Review generated SQL in `src/generated/migrations/`
4. Migrations run automatically on server start

**Details**: See [CONTRIBUTING.md#database-workflow](./CONTRIBUTING.md#database-workflow)

## Frontend Development

The repo has four frontend apps. The Vite-based ones share the same stack
(TanStack Router file-based routing, TanStack Query, Better-Auth, Radix UI
primitives via shadcn/ui patterns); the website is Next.js.

| App | Framework | Port | Purpose |
|-----|-----------|------|---------|
| `apps/account` | Vite + TanStack Router | 3002 | Self-service account management |
| `apps/patient` | Vite + TanStack Router | 3003 | Patient-facing experience |
| `apps/provider` | Vite + TanStack Router | 3004 | Provider/practitioner portal |
| `apps/website` | Next.js | 3000 | Public marketing site |

**Standards**: See [CONTRIBUTING.md#coding-standards](./CONTRIBUTING.md#coding-standards)

## Testing Approach

- **API**: Bun test framework (`cd services/api && bun test`)
- **Frontend**: Playwright E2E tests (`cd apps/account && bun run test:e2e`)
- **Type Safety**: TypeScript checking across all workspaces

**Details**: See [CONTRIBUTING.md#testing-requirements](./CONTRIBUTING.md#testing-requirements)

## Common Commands Quick Reference

**Full command reference**: See [README.md#available-commands](./README.md#available-commands)

Essential commands:
```bash
# Install dependencies
bun install

# API-first workflow
cd specs/api && bun run build              # Generate OpenAPI + types
cd ../../services/api && bun run generate  # Generate routes/validators

# Start development
cd services/api && bun dev        # API on port 7213
cd apps/account && bun dev        # Account app on port 3002

# Database
cd services/api && bun run db:generate  # Generate migration
cd services/api && bun run db:studio    # Open Drizzle Studio

# Testing
cd services/api && bun test             # API tests
cd apps/account && bun run test:e2e     # E2E tests
```

## Important Notes

### What Exists
- ✅ **apps/account, apps/patient, apps/provider** - Vite + TanStack Router apps
- ✅ **apps/website** - Next.js marketing site
- ✅ **apps/patient/src-tauri/** - Tauri 2 desktop wrapper with embedded Boa runtime + SQLite + cadence P2P sync
- ✅ **services/api/** - Hono + Drizzle API with 13 handler modules
- ✅ **services/cadence/** - Rust P2P sync engine (compiles standalone; consumed by patient Tauri)
- ✅ **packages/ui/** - Shared UI component library
- ✅ **packages/sdk/** - Type-safe API client + TanStack Query hooks
- ✅ **packages/eslint-config/** - Shared ESLint flat configs
- ✅ **.claude/skills/** - 15 Claude Code skills for development workflow
- ✅ **Authentication** via Better-Auth (integrated, not a separate module)
- ✅ **Consent** as JSONB fields on Person model (not a separate module)
- ✅ **13 API handler modules**: 9 core (person, booking, billing, audit, notifs, comms, storage, email, reviews) plus 4 platform-specific (patient, provider, emr, ws)

### Known In-Progress Areas
- The `patient` and `provider` apps have routes that consume API surfaces
  still being aligned with the SDK; expect typecheck drift in those apps
  (lint and build are clean).
- Billing module schema fields (line items, platform fees, line-level audit)
  are stubbed in handlers — see in-file `TODO` comments.
- `apps/patient/src-tauri/src/sync.rs` wires the cadence imports but the
  `SyncEngine`/`SqliteBackend` integration in `init`/`start` is still a
  stub (see `TODO` comments in that file). `cargo check` is green; runtime
  sync is not yet activated end-to-end.

### Working with Cadence (Rust)
- Cadence lives at `services/cadence/` and is a Cargo crate independent of
  the Bun workspaces. Build with `cd services/cadence && cargo check
  --all-targets`. Full test suite (`cargo test`) needs Postgres + Valkey via
  the bundled `docker-compose.deps.yml`.
- The patient Tauri wrapper consumes cadence via a `path = "../../../services/cadence"`
  dependency in `apps/patient/src-tauri/Cargo.toml`. Run
  `cd apps/patient/src-tauri && cargo check` after touching either crate.
- Tauri icons live in `apps/patient/src-tauri/icons/` and are generated
  from `apps/patient/public/favicon.svg` via
  `bunx tauri icon apps/patient/public/favicon.svg --output apps/patient/src-tauri/icons`.

## When in Doubt

1. Check [README.md](./README.md) for commands and setup
2. Check [CONTRIBUTING.md](./CONTRIBUTING.md) for development patterns
3. Reference existing handlers in `services/api/src/handlers/` for implementation patterns
4. Check OpenAPI spec at `specs/api/dist/openapi/openapi.json` for API contracts
