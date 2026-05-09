# Technology Stack

**Analysis Date:** 2026-05-06

## Languages

**Primary:**
- TypeScript ^5.7+ - All backend, frontend, SDK, and spec code
- Rust (2021 edition) - Cadence P2P sync engine (`services/cadence/`) and embedded API runtime (`services/api-ts-embedded/`)

**Secondary:**
- TypeSpec ^1.3.0 - API-first schema definitions (`specs/api/src/modules/*.tsp`)
- SQL (PostgreSQL 16) - Generated migrations (`services/api-ts/src/generated/migrations/`)

## Runtime

**Environment:**
- Bun 1.2.21 (pinned in root `package.json` `packageManager` field)
- Node.js >=18 listed in engines but Bun is the actual runtime

**Package Manager:**
- Bun (workspace monorepo)
- Lockfile: `bun.lock` present at root
- Cargo (for Rust crates in `services/cadence/` and `services/api-ts-embedded/`)

## Frameworks

**Core:**
- Hono ^4.0.0 - HTTP server framework (`services/api-ts/src/app.ts`)
- React ^19.1.1 - Frontend UI (`apps/account/`, `apps/dentalemon/`)
- Vite ^7.1.4 - Frontend build/dev server (`apps/dentalemon/vite.config.ts`, port 3003)
- TanStack Router ^1.131.31 - File-based routing (`apps/dentalemon/src/routes/`)
- Better-Auth ~1.3.27 (api-ts) / ^1.3.7 (frontend) - Authentication

**API Design:**
- TypeSpec ^1.3.0 - API-first schema definitions compiled to OpenAPI (`specs/api/`)
- @hono/zod-openapi ^0.18.0 - OpenAPI route validation
- Zod ^4.1.12 - Runtime schema validation (consistent across all workspaces)

**Testing:**
- Bun test - Backend unit tests (`services/api-ts/src/**/*.test.ts`)
- Playwright ^1.55+ - E2E tests (`apps/dentalemon/`, `apps/account/`)
- Happy-DOM ^19-20 - JSDOM alternative for component tests
- @testing-library/react ^16.3.0 - React component testing
- MSW ^2.14.2 - API mocking in tests
- Hurl 6.0.0 - Contract test scenarios (`specs/api/tests/contract/`)
- Schemathesis - OpenAPI schema fuzzing (CI shadow check)

**Build/Dev:**
- @vitejs/plugin-react ^5.0.2 - Vite React plugin
- @tanstack/router-plugin ^1.132.0 - Route tree code generation
- vite-tsconfig-paths ^5.1.4 - Path alias resolution
- esbuild ^0.25.0 - Server compilation (`bun build --compile`)
- drizzle-kit ^0.31.0 - Migration generation
- @hey-api/openapi-ts ^0.97.0 - SDK generation from OpenAPI

## Key Dependencies

**Critical:**
- drizzle-orm ^0.44.6 - Database ORM, type-safe queries (`services/api-ts/src/core/database.ts`)
- pg ^8.16.3 - PostgreSQL driver (node-postgres Pool)
- better-auth ~1.3.27 - Auth with plugins: emailOTP, admin, bearer, twoFactor, magicLink, passkey, apiKey (`services/api-ts/src/core/auth.ts`)
- stripe ^19.1.0 - Billing/payments via Connect (`services/api-ts/src/core/billing.ts`)
- @tanstack/react-query ^5.85.9 - Server state management
- @monobase/sdk-ts (workspace) - Generated TanStack Query hooks + client (`packages/sdk-ts/`)
- @monobase/api-spec (workspace) - OpenAPI spec + generated TypeScript types (`specs/api/`)

**Infrastructure:**
- pg-boss ^10.3.2 - PostgreSQL-backed job queue (`services/api-ts/src/core/jobs.ts`)
- pino ^9.0.0 + pino-pretty ^13.0.0 - Structured logging (`services/api-ts/src/core/logger.ts`)
- @aws-sdk/client-s3 ^3.879.0 - S3/MinIO file storage (`services/api-ts/src/core/storage.ts`)
- nodemailer ^7.0.6 - SMTP email sending
- postmark ^4.0.5 - Postmark email provider
- @onesignal/node-onesignal ^5.2.1-beta1 - Push notifications + email
- handlebars ^4.7.8 - Email template rendering
- ws ^8.18.3 - WebSocket support (dev dependency, Bun native WS used at runtime)

**Frontend UI:**
- Radix UI primitives (14+ packages) - Accessible UI components (shadcn/ui pattern)
- lucide-react ^0.451.0 - Icon library
- class-variance-authority ^0.7.1 - Variant-based styling
- tailwind-merge ^3.3.1 - Tailwind class merging
- tailwindcss ^3 + tailwindcss-animate ^1.0.7 - Styling
- framer-motion ^12.23.12 - Animations
- sonner ^2.0.7 - Toast notifications
- cmdk ^1.1.1 - Command palette
- react-hook-form ^7.63.0 + @hookform/resolvers ^5.2.2 - Form handling
- react-day-picker ^9.11.0 - Date picker
- react-easy-crop ^5.5.3 - Image cropping
- react-phone-number-input ^3.4.12 - Phone input
- swiper ^11.2.6 - Carousel (dentalemon only)
- next-themes ^0.4.6 - Theme switching
- date-fns ^4.1.0 - Date utilities

**Rust (Cadence):**
- tokio 1 (full) - Async runtime
- iroh 0.32 - P2P transport
- loro 1.4 - CRDT
- rusqlite 0.32 (bundled) - SQLite
- tokio-postgres 0.7 - PostgreSQL
- fred 10 - Redis/Valkey client

**Rust (api-ts-embedded):**
- rquickjs 0.11 - QuickJS JS engine for offline-first Tauri
- rusqlite 0.32 - SQLite bridge
- bcrypt/hmac - Crypto bindings

## Configuration

**Environment:**
- Environment variables parsed into typed `Config` object at `services/api-ts/src/core/config.ts`
- `.env` files present at `services/api-ts/.env` and `apps/dentalemon/.env` (not committed)
- `.env.example` files document all variables
- Frontend uses `VITE_` prefixed vars (build-time) with runtime `/config.json` fallback

**Key env vars:**
- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_SECRET` - Better-Auth secret key
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` - Billing
- `ONESIGNAL_APP_ID` / `ONESIGNAL_API_KEY` - Push notifications
- `STORAGE_PROVIDER` / `STORAGE_ENDPOINT` - S3/MinIO
- `EMAIL_PROVIDER` - smtp/postmark/onesignal
- `VITE_API_BASE_URL` - Frontend API endpoint

**Build:**
- `services/api-ts/drizzle.config.ts` - Drizzle migration config (PostgreSQL dialect, schema glob `./src/**/*schema.ts`)
- `apps/dentalemon/vite.config.ts` - Vite config (port 3003, TanStack Router plugin)
- `packages/typescript-config/` - Shared tsconfig bases (`api.json`, `app.json`)
- `packages/eslint-config/` - Shared ESLint flat configs (`base`, `react`)

## Platform Requirements

**Development:**
- Bun >=1.2.21
- Docker (for PostgreSQL 16, MinIO, Mailpit, stripe-mock via `services/api-ts/docker-compose.deps.yml`)
- Rust toolchain (only if working on cadence or api-ts-embedded)

**Production:**
- API compiles to standalone binary via `bun build --compile` → `dist/server`
- Frontend builds to static assets via `vite build` → `dist/`
- PostgreSQL 16+ required
- S3-compatible object storage (MinIO or AWS S3)
- Optional: Stripe, OneSignal, Postmark accounts

## Version Mismatches & Notes

**better-auth version drift:**
- `services/api-ts/package.json`: `~1.3.27` (tilde = patch-only)
- `apps/account/package.json`: `^1.3.7` (caret = minor-compatible)
- `apps/dentalemon/package.json`: `^1.3.7`
- `packages/sdk-ts/package.json`: `^1.3.7`
- Risk: tilde vs caret pinning could cause version mismatch after `bun install`

**Consistent versions (good):**
- Zod ^4.1.12 across all workspaces
- React ^19.1.1 consistent
- TanStack Query ^5.85.9 consistent

**dentalemon app is a copy of account app:**
- Nearly identical `package.json` dependencies
- Only differences: `swiper` added, port changed to 3003
- Both depend on `@monobase/sdk-ts` and `@monobase/api-spec` workspace packages

**Dental routes bypass TypeSpec:**
- All `/dental/*` routes in `services/api-ts/src/app.ts` are hand-registered Hono routes
- They do NOT go through the TypeSpec → OpenAPI → codegen pipeline
- No generated validators — manual Zod validation in handlers
- TypeSpec files exist (`specs/api/src/modules/dental-*.tsp`) but the generated routes are not used for dental endpoints

---

*Stack analysis: 2026-05-06*
