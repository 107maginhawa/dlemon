# Scaffolding & Infrastructure Audit

> **⚠ SUPERSEDED — 2026-05-19**
> This audit was run against the pre-fix working tree. The following items it
> flagged are RESOLVED in commit `19db952` (feat/v1.4-clinical-imaging):
> - CORS `['*']` wildcard fallback → removed (fail-closed)
> - No HSTS/CSP → added (prod NODE_ENV-gated, behavioral tests added)
> - Weak-secret prod guard missing → added; now also rejects minioadmin/default-DB-URL
> - Swiper CVE GHSA-hmx5-qpq5-p643 → already at patched 11.2.10 (false alarm)
> - PHI in logs → fixed in `19db952` (pino redact, URL query strip)
> Do not act on findings in this doc without verifying they aren't already fixed.

**Date:** 2026-05-19  
**Branch:** feat/v1.4-clinical-imaging  
**Stage:** Dev / Pre-production  
**Scope:** Full infra posture — auth, database, docker/env, secrets, CORS, tenant isolation  
**Method:** Three independent parallel audits (auth / database / docker+config) + direct source verification

---

## Reusable Infra-Audit Checklist

Run this checklist before every production release. Items marked DEFERRED are
conscious omissions for the current dev/pre-prod stage, not oversights.

| # | Category | Check | Status |
|---|----------|-------|--------|
| 1 | Config loading | Required secrets fail-fast at boot (not silently insecure) | ✅ Fixed P0.2 |
| 2 | Secret management | Auth secret, service tokens: env-sourced ≥32 chars, no hardcoded values | ✅ Fixed P0.2 + P0.4 |
| 3 | Connection-string consistency | Code default == .env.example == docker == CI == drizzle config == docs | ✅ Fixed P0.3 |
| 4 | Env drift | Every var read in code is documented in .env.example; no dead/renamed vars | ✅ Fixed P0.1 |
| 5 | Environment hardening | Dev defaults (CORS *, no TLS, debug) gated by NODE_ENV so prod differs | 🔄 P1 |
| 6 | Database | Pooling, SSL, migration path, multi-tenant/row isolation for sensitive data | ↩ Reclassified — isolation primitive is per-user SQLite + cadence scoped P2P sync, not Postgres tenant_id. Forward verification item logged (see §EMR Tenant Isolation). |
| 7 | Container reproducibility | Pinned image tags, healthchecks, no baked secrets, data persistence | ✅ Images pinned |
| 8 | Runtime path parity | Every runtime (server vs embedded) shares the same security posture | 🔄 P2 |
| 9 | Webhook signature verification | Stripe Connect: all incoming webhooks verified against STRIPE_WEBHOOK_SECRET | 🔄 Triage P1 |
| 10 | CSRF protection | State-changing routes protected (cookie sessions + credentials:true) | ✅ Custom same-origin/Bearer guard (Hono csrf() rejected — JSON no-op) |
| 11 | Structured-log PII leakage | Pino request/error serializers don't log PHI/PII bodies | 🔄 Triage P1 |
| 12 | Dependency CVE scan | `bun audit` / SCA scan clean | ✅ Swiper constraint tightened; bun audit in CI (non-blocking → blocking once backlog triaged) |
| 13 | Secret rotation procedure | AUTH_SECRET rotation strategy documented (invalidates all sessions) | ⏸ Deferred |
| 14 | Healthcheck semantics | /readyz actually checks DB connectivity (not blind 200) | ✅ Verified correct (health.ts:42 checkDatabaseConnection + 503 on failure) — prior audit mislabel |
| 15 | Backup / restore | DB backup schedule, restore procedure tested | ⏸ Deferred (no PHI yet) |

---

## Findings

### HIGH — Fix before prod

| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| 1 | `AUTH_SECRET` falls back to `'...' + Math.random()` — insecure, no fail-fast, sessions die on restart | `services/api-ts/src/core/config.ts:141` | P0.2 ✅ |
| 2 | `INTERNAL_SERVICE_TOKEN` falls back to random UUID; gates auth-bypass header path | `config.ts:110`; `middleware/auth.ts:101-119` | P0.2 + P0.4 ✅ |
| 3 | Auth-bypass path active without explicit opt-in | `middleware/auth.ts:106` | P0.4 ✅ (INTERNAL_SERVICE_EXPAND_ENABLED flag added, default false) |
| 4 | EMR schema has no tenant/org column — PHI rows not scoped by tenant at DB level | `handlers/emr/repos/emr.schema.ts` (no tenant_id) | ↩ Reclassified — see §EMR Tenant Isolation |
| 1e | Embedded runtime: hardcoded `secret: "embedded-secret-change-in-production"`, rate limit disabled | `services/api-ts-embedded/src-js/entry.ts:81,83` | P2 (desktop optional) |

### MEDIUM — Fix before prod

| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| 5 | Connection-string drift: docs used `user:password`, runtime/docker use `postgres:password` | `README.md:112`, `CONTRIBUTING.md:44`, `.claude/skills/dev-api/SKILL.md:39`, `services/api-ts/README.md:21` | P0.3 ✅ |
| 6 | Env drift: 5 vars read in code, missing from `.env.example`; dead `ONESIGNAL_EMAIL_*` vars | `.env.example` vs `config.ts` | P0.1 ✅ |
| 7 | CORS non-rejecting fallback: blocked origins get `'*'` not rejection; default `origins:['*']` + `credentials:true` | `config.ts:125-129`; `utils/cors.ts:54-98` | P1 🔄 |
| 8 | No NODE_ENV-gated hardening — same permissive posture in all envs; no HSTS/CSP | `middleware/security.ts:16-20` | P1 🔄 |
| 9 | Webhook sig: ✅ already correct (`handleStripeWebhook.ts:41-45`) | — | Verified |
| 10 | CSRF: custom same-origin/Bearer guard added | `middleware/security.ts` | ✅ |
| 11 | Log PII: fixed (`redactSensitiveHeaders` in logger serializer) | `logger.ts` | ✅ |
| 12 | CVE: swiper constraint tightened; `bun audit` in CI | `apps/*/package.json`, `contract.yml` | ✅ (non-blocking → flip when backlog triaged) |

### LOW / P2

| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| 9 | Container: `minio:latest`, `valkey:latest` unpinned; postgres 16 vs 17 across compose files | `services/api-ts/docker-compose.deps.yml`; `services/cadence/docker-compose.deps.yml` | P2 |
| 10 | Stripe/OneSignal/Google keys silently absent → feature disabled, no startup warning | `config.ts:148–217` | P2 |

---

## Verified Good (no action needed)

- **No committed secrets** — `.env` files are git-ignored and untracked across all workspaces. No real credentials in git history.
- **Core connection strings consistent** — `config.ts` default, `docker-compose.deps.yml`, `.env.example`, `.github/workflows/contract.yml`, `drizzle.config.ts`, and all seed/test scripts all use `postgres:password@localhost:5432/monobase`. Only docs drifted (fixed P0.3).
- **DB SSL enforces `rejectUnauthorized: true`** when `DB_SSL=true` (`database.ts:133`).
- **Contract CI** (`contract.yml`) uses test-only credentials; acceptable.
- **Drizzle config** reuses `config.database.url` — no separate hardcoded string.

---

## Remediation Phases

| Phase | What | Files | Done? |
|-------|------|-------|-------|
| **P0.1** | Close env drift in `.env.example` | `services/api-ts/.env.example` | ✅ |
| **P0.2** | Boot-time fail-fast guard (prod only, symmetric, names missing vars) | `services/api-ts/src/core/config.ts` | ✅ |
| **P0.3** | Fix doc connection-string drift | `README.md`, `CONTRIBUTING.md`, `.claude/skills/dev-api/SKILL.md`, `services/api-ts/README.md` | ✅ |
| **P0.4** | Auth-bypass path: add `INTERNAL_SERVICE_EXPAND_ENABLED` flag (default false); elevate bypass log to INFO | `middleware/auth.ts`, `middleware/dependency.ts`, `config.ts`, `.env.example` | ✅ |
| **P1** | CORS non-rejecting fallback + NODE_ENV-gated CORS defaults | `utils/cors.ts`, `config.ts` | 🔄 |
| **P1** | HSTS + baseline CSP in production | `middleware/security.ts` | 🔄 |
| **P1** | CSRF custom guard + SameSite cookie hardening | `middleware/security.ts`, `utils/cors.ts`, `app.ts` | ✅ |
| **P1** | Log PII redaction | `core/logger.ts` | ✅ |
| **P1** | Swiper CVE constraint + `bun audit` in CI | `apps/*/package.json`, `contract.yml` | ✅ |
| **P1.5** | EMR tenant isolation | See §EMR Tenant Isolation below | ↩ Reclassified |
| **P2** | Embedded runtime: secret from env, fix rate limit | `services/api-ts-embedded/src-js/entry.ts` | ⏸ Desktop optional |
| **P2** | Pin container image tags | `docker-compose.deps.yml` (both), `contract.yml` MinIO | ✅ |

---

## EMR Tenant Isolation — Reclassified (not silently resolved)

The prior P1.5 item (Postgres `tenant_id NOT NULL` migration) was based on the
assumption that clinical PHI lives in a shared multi-tenant Postgres. **That premise
is wrong for this architecture.**

**Actual architecture (verified from `services/cadence/README.md` and
`apps/account/src-tauri/Cargo.toml`):**
- `apps/dentalemon` runs **local-first, per-user SQLite** (bundled `rusqlite`, WAL)
  with `api-ts` embedded via QuickJS (`services/api-ts-embedded`).
- Cross-device/cross-branch data movement is **P2P via cadence (Iroh/QUIC)**, not
  client → shared central Postgres.
- Cadence enforces **row-level access control during sync** via a generic
  dimension-based scope system (`org_id`/`workspace_id`/`user_id`/`facility`,
  JWT-claim driven, `filter_changes(changes, claims)`).
- **The isolation primitive is: per-user local SQLite + cadence dimension-scoped
  P2P sync.** The Postgres `tenant_id` column is not the isolation control.
- The cloud Postgres `api-ts` backs `apps/account` (identity/profile/settings),
  not clinical PHI.
- Per CLAUDE.md: cadence runtime sync (`sync.rs` `init/start`) is currently a stub —
  clinical data does not leave the device today.

**Why `tenant_id NOT NULL` would be wrong:** nothing in the EMR handlers sets the
value; forcing NOT NULL would break `createConsultationNote`. The column is retained
nullable as a potential future cadence scope mapping field.

**No Migration B. No `0031`/`0032` SQL. No schema NOT NULL change.**

### Forward Verification Item (highest-priority pre-cross-device-PHI gate)

When `apps/account/src-tauri/src/sync.rs` `init/start` is wired (currently a stub),
verify that cadence scope dimensions cover EMR + dental clinical collections so
`filter_changes` cannot leak PHI cross-user/branch before any real sync occurs.
This — not a Postgres `tenant_id` column — is the isolation control gate.

---

## Triage — Healthcare Table-Stakes Items (P1)

These were not in the original scaffolding scope but are required before production for a healthcare platform. Assessed at audit time:

| Item | Question | Finding | Action |
|------|----------|---------|--------|
| 9. Webhook sig | Stripe webhook signatures verified? | ✅ `handleStripeWebhook.ts:41-45` calls `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET` | None — already correct |
| 10. CSRF | State-changing routes protected? | ⚠️ Better-Auth handles CSRF for its own endpoints. Custom Hono routes use Bearer token auth which is not cookie-only, reducing browser-CSRF risk. No explicit CSRF middleware. | Assess custom routes that accept cookie auth without Bearer before prod |
| 11. Log PII | Pino serializers redact PHI/auth headers? | ❌ `logger.ts:28` logged all request headers raw — `Authorization`, `Cookie`, `X-API-Key` would appear in logs | **Fixed** — `redactSensitiveHeaders()` added to logger serializer |
| 12. CVE scan | `bun audit` clean? | ❌ 35 vulnerabilities: **critical** `swiper` prototype pollution in `apps/dentalemon` + `sample-workspace`; **high** `fast-uri` in `@typespec/compiler` + `eslint` (dev tools) | Run `bun update swiper` for the critical (frontend). `fast-uri` is in dev/build tools — update when convenient |

**Swiper CVE detail:** `GHSA-hmx5-qpq5-p643` (Prototype pollution, critical). Affects `apps/dentalemon` and `sample-workspace` — frontend only, not the API server. Run `bun update swiper` to remediate. Schedule before prod.
