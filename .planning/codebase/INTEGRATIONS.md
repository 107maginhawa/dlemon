# External Integrations

**Analysis Date:** 2026-05-06

## APIs & External Services

**Payments (Stripe Connect):**
- Stripe - Payment processing, Connect accounts, refunds, webhooks
  - SDK: `stripe` ^19.1.0
  - Implementation: `services/api-ts/src/core/billing.ts` (fully implemented `BillingService` class)
  - Auth: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - Features wired: Connect account creation, payment intents (hold & decide model), captures, cancellations, refunds, webhook verification, Checkout Sessions
  - Testing: `stripe-mock` container in `docker-compose.deps.yml` (port 12111), `STRIPE_URL` env var redirects SDK
  - API version: `2025-10-29.clover`
  - Status: **Fully implemented** — service class has real Stripe API calls, lazy-initialized

**Push Notifications (OneSignal):**
- OneSignal - Multi-channel push notifications
  - SDK: `@onesignal/node-onesignal` ^5.2.1-beta1 (backend), `react-onesignal` ^3.4.0 (frontend)
  - Implementation: `services/api-ts/src/core/notifs.ts` (wraps `NotificationRepository`)
  - Auth: `ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`
  - Architecture: Single app ID across all frontends, targets by `external_id` (person ID)
  - Frontend: `VITE_ONESIGNAL_APP_ID`, optional `VITE_ONESIGNAL_APP_TAG`
  - Status: **Implemented** — notification creation, WebSocket real-time delivery, scheduled processing

**Email (Multi-provider):**
- SMTP / Postmark / OneSignal - Transactional email
  - SDKs: `nodemailer` ^7.0.6, `postmark` ^4.0.5, `@onesignal/node-onesignal`
  - Implementation: `services/api-ts/src/core/email.ts` (provider pattern with lazy init)
  - Auth: `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` (SMTP), `POSTMARK_API_KEY` (Postmark)
  - Features: Template rendering via Handlebars, queue-based sending, provider abstraction
  - Dev: Mailpit container (SMTP on 1025, UI on 8025)
  - Status: **Fully implemented** — queue, templates, 3 providers, job processor

**File Storage (S3/MinIO):**
- AWS S3 or MinIO - File upload/download with presigned URLs
  - SDK: `@aws-sdk/client-s3` ^3.879.0, `@aws-sdk/s3-request-presigner` ^3.879.0
  - Implementation: `services/api-ts/src/core/storage.ts` (`S3StorageProvider` class)
  - Auth: `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`
  - Features: Upload/download presigned URLs, file deletion, bucket auto-creation, health checks
  - Dev: MinIO container (API on 9000, Console on 9001)
  - Status: **Fully implemented** — presigned URL generation, bucket management

**WebRTC (STUN/TURN):**
- Google STUN servers (default) / optional Coturn TURN server
  - Implementation: `services/api-ts/src/utils/webrtc.ts` (ICE server URL parsing)
  - Config: `WEBRTC_ICE_SERVERS` env var
  - Dev: Coturn container commented out in `docker-compose.deps.yml`
  - Status: **Partially implemented** — config parsing exists, comms handler references it

**P2P Sync (Cadence):**
- Iroh 0.32 - P2P transport for offline-first sync
  - Implementation: `services/cadence/` (Rust crate)
  - Features: CRDT via Loro, SQLite/Valkey metadata backends, JWT auth
  - Status: **Stub** — `cargo check` passes but runtime sync not activated. Tauri integration in `apps/account/src-tauri/src/sync.rs` has TODO stubs

## Data Storage

**Primary Database:**
- PostgreSQL 16 (Alpine)
  - Connection: `DATABASE_URL` (default: `postgres://postgres:password@localhost:5432/monobase`)
  - Client: Drizzle ORM via `pg` (node-postgres) Pool
  - Implementation: `services/api-ts/src/core/database.ts`
  - Config: `services/api-ts/drizzle.config.ts`
  - Features: Connection pooling (2-20), SSL support, schema-based test isolation, auto-migrations on startup
  - Schema files: `services/api-ts/src/handlers/*/repos/*.schema.ts`
  - Generated migrations: `services/api-ts/src/generated/migrations/`
  - Docker: `docker-compose.deps.yml` service

**Embedded Database (offline):**
- SQLite via `rusqlite` 0.32 (bundled)
  - Used by: `services/api-ts-embedded/` (QuickJS + SQLite bridge)
  - Status: **Build passes** — `drizzle-orm/sqlite-proxy` injection pattern exists but runtime not active

**Job Queue:**
- pg-boss ^10.3.2 - PostgreSQL-backed job scheduler
  - Implementation: `services/api-ts/src/core/jobs.ts`
  - Uses: Same PostgreSQL database (no additional connection pool)
  - Registered jobs: email processing, notification scheduling, audit cleanup, booking reminders
  - Status: **Fully wired** — registered in `app.ts` via `registerEmailJobs`, `registerNotifsJobs`, `registerAuditJobs`, `registerBookingJobs`

**File Storage:**
- MinIO (dev) / AWS S3 (prod) via `@aws-sdk/client-s3`
- See S3/MinIO section above

**Caching:**
- None in TypeScript API
- Valkey (Redis-compatible) used by Cadence Rust crate (`fred` 10) — not wired to main API

## Authentication & Identity

**Auth Provider:**
- Better-Auth (self-hosted, not a third-party service)
  - Implementation: `services/api-ts/src/core/auth.ts`
  - Database: Drizzle adapter with `pg` provider
  - Generated schema: `services/api-ts/src/generated/better-auth/schema.ts`
  - Base path: `/auth`
  - Plugins enabled:
    - `emailOTP` - Email one-time password
    - `admin` - Admin role management
    - `bearer` - Bearer token auth
    - `twoFactor` - 2FA support
    - `magicLink` - Magic link login
    - `passkey` - WebAuthn/FIDO2
    - `apiKey` - API key auth
    - `lastLoginMethod` - Track login method
    - `oneTimeToken` - Single-use tokens
    - `openAPI` - Auth endpoint OpenAPI docs
  - Social providers: Google OAuth (optional, via `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`)
  - Frontend SDK: `@daveyplate/better-auth-tanstack` ^1.3.6, `@daveyplate/better-auth-ui` ^3.1.5
  - Session: 7-day expiry, rate-limited (10 attempts/minute)

**Custom Auth (Dental):**
- PIN-based member authentication in `services/api-ts/src/handlers/dental-org/`
  - `setPin.ts`, `verifyPin.ts`, `pinRecovery.ts`
  - Security question recovery flow
  - This is an app-level auth mechanism layered on top of Better-Auth sessions

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, etc.)

**Logs:**
- Pino ^9.0.0 structured JSON logging (`services/api-ts/src/core/logger.ts`)
- pino-pretty for development
- Correlation IDs via request middleware (`services/api-ts/src/middleware/request.ts`)
- Audit logging module at `services/api-ts/src/handlers/audit/`

**Health Checks:**
- `/livez` - Liveness probe (lightweight)
- Database health check via `SELECT 1` (`services/api-ts/src/core/database.ts`)
- Storage health check via `HeadBucket` (`services/api-ts/src/core/storage.ts`)

## CI/CD & Deployment

**Hosting:**
- Not configured — no deployment manifests, Dockerfiles, or cloud-specific config
- API can compile to standalone binary (`bun build --compile`)
- Frontend builds to static assets

**CI Pipeline:**
- GitHub Actions (`.github/workflows/contract.yml`)
- Contract test workflow:
  1. Boots PostgreSQL 16 + MinIO as services
  2. Installs Bun 1.2.21 + Hurl 6.0.0 + Schemathesis
  3. Builds OpenAPI spec, generates codegen
  4. Boots api-ts, waits for `/livez`
  5. Runs Hurl contract scenarios (required)
  6. Runs Schemathesis fuzzing (shadow, allowed to fail)

## Environment Configuration

**Required env vars (minimum to run):**
- `DATABASE_URL` - PostgreSQL connection (has dev default)
- `AUTH_SECRET` - Auth secret key (generates random if unset — INSECURE)

**Optional env vars (features degrade gracefully):**
- `STRIPE_SECRET_KEY` - Billing features (lazy init, errors only on use)
- `ONESIGNAL_APP_ID` + `ONESIGNAL_API_KEY` - Push notifications
- `POSTMARK_API_KEY` - Production email (falls back to SMTP/Mailpit)
- `STORAGE_*` - File storage (defaults to local MinIO)
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` - Social login

**Secrets location:**
- `.env` files (gitignored)
- `.env.example` files document all vars with safe defaults
- CI uses inline env vars in workflow YAML

## Webhooks & Callbacks

**Incoming:**
- Stripe webhook endpoint - Signature verification via `BillingService.verifyWebhookSignature()` in `services/api-ts/src/core/billing.ts`
  - Secret: `STRIPE_WEBHOOK_SECRET`
  - Status: Verification implemented, handler wiring likely in `services/api-ts/src/handlers/billing/`

**Outgoing:**
- OneSignal API calls for push notifications
- Email provider API calls (Postmark, OneSignal email)
- Stripe API calls (payment intents, Connect accounts)
- No custom webhook dispatch system

## WebSocket Connections

**Implementation:** `services/api-ts/src/core/ws.ts`
- Uses Bun native WebSocket via `hono/bun` adapter
- Channel-based pub/sub: `chat-rooms/{roomId}`, `notifications/{userId}`
- User-targeted publishing for real-time notifications
- Handler registry at `services/api-ts/src/generated/websocket/registry.ts`

## Integration Wiring Status

| Integration | Config | SDK | Service Layer | Route Wiring | Tests |
|-------------|--------|-----|---------------|-------------|-------|
| PostgreSQL | Done | Done | Done | Done | Done |
| Better-Auth | Done | Done | Done | Done | Done |
| Stripe | Done | Done | Done | Partial | Contract |
| S3/MinIO | Done | Done | Done | Done | Contract |
| SMTP/Email | Done | Done | Done | Done | Partial |
| OneSignal | Done | Done | Done | Done | None |
| Postmark | Done | Done | Done | Done | None |
| pg-boss | Done | Done | Done | Done | Unit |
| WebSocket | Done | Done | Done | Done | None |
| Cadence/Iroh | Config | Done | Stub | None | None |
| WebRTC/TURN | Config | None | Stub | Partial | None |

---

*Integration audit: 2026-05-06*
