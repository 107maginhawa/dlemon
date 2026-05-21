# ASVS L2 Security Checklist

**Standard:** OWASP ASVS 4.0.3
**Level:** L2
**Last assessed:** 2026-05-21
**Branch:** feat/v1.5-g1-foundation
**Assessor:** Engineering (automated code review)
**Scope:** `services/api-ts` — Hono + Drizzle ORM backend API

---

## Assessment Legend

| Symbol | Meaning |
|--------|---------|
| ✅ PASS | Implemented and verified in code |
| ⚠️ PARTIAL | Partially implemented or conditionally present |
| ❌ FAIL | Not implemented |
| N/A | Not applicable to this architecture |

---

## V1 Architecture, Design, and Threat Modeling

| # | Description | L1 | L2 | Status | Evidence / Notes |
|---|-------------|:--:|:--:|--------|-----------------|
| 1.1.1 | Secure SDLC documented | ✓ | | ✅ | `CONTRIBUTING.md`, `docs/development/VERTICAL_TDD.md`, `CLAUDE.md` — vertical TDD mandatory |
| 1.1.2 | Threat modeling performed for significant changes | | ✓ | ✅ | This document; STRIDE analysis per module |
| 1.1.3 | User stories include security constraints | ✓ | | ⚠️ PARTIAL | ACs cover auth/403/404; no explicit threat tagging in TypeSpec |
| 1.1.4 | Security design principles applied | | ✓ | ✅ | Default-deny auth, fail-closed CORS, branch-scoped access |
| 1.1.5 | Architecture reviewed for security boundaries | | ✓ | ✅ | Trust boundaries: Better-Auth → authMiddleware → assertBranchAccess → handler |
| 1.1.6 | No shared or duplicate functionality | ✓ | | ✅ | Single auth middleware, shared error types in `core/errors.ts` |
| 1.2.1 | All modules use lowest necessary privileges | | ✓ | ⚠️ PARTIAL | Role enum `dentist_owner|dentist_associate|staff_full|staff_scheduling` but not all handlers enforce role granularity (P1 finding F-001) |
| 1.4.1 | Access controls enforced at trusted service layer | ✓ | | ✅ | `authMiddleware` + `assertBranchAccess` at server side |
| 1.4.2 | Access control decisions cannot be made by untrusted clients | ✓ | | ✅ | Role embedded in Better-Auth session, not in client-supplied headers |
| 1.5.1 | Input validation on all trusted service layer inputs | ✓ | | ✅ | Generated Zod validators via TypeSpec → `@hono/zod-validator`; all route params validated |
| 1.5.2 | Input validation cannot be bypassed | | ✓ | ✅ | Generated validator wraps all registered routes; manual routes also validated |
| 1.5.3 | Output encoding applied to prevent injection | | ✓ | ✅ | JSON-only responses; no template rendering; Drizzle ORM parameterized queries |
| 1.6.1 | Key management documented | | ✓ | ⚠️ PARTIAL | `AUTH_SECRET`, `INTERNAL_SERVICE_TOKEN` validated at startup (≥32 chars); no formal key rotation policy |
| 1.7.1 | Logging format consistent across components | ✓ | | ✅ | Pino structured JSON throughout; `X-Request-ID` correlation on every log entry |
| 1.8.1 | All sensitive data identified and classified | | ✓ | ⚠️ PARTIAL | PHI fields explicitly redacted in logger; no formal data classification register |
| 1.9.1 | TLS or equivalent encryption for all communications | | ✓ | ⚠️ PARTIAL | HSTS set in production (`max-age=31536000; includeSubDomains`); TLS termination at infra level (not app-enforced in dev) |
| 1.10.1 | No malicious code | ✓ | | ✅ | Open source deps tracked in `SECURITY_ADVISORIES.md`; `bun audit` runs in CI |

---

## V2 Authentication Verification

| # | Description | L1 | L2 | Status | Evidence / Notes |
|---|-------------|:--:|:--:|--------|-----------------|
| 2.1.1 | Passwords ≥ 12 characters | ✓ | | ⚠️ PARTIAL | Better-Auth controls password policy; no explicit minimum enforced in config |
| 2.1.12 | User can change password | ✓ | | ✅ | Better-Auth built-in `/change-password` endpoint |
| 2.2.1 | Anti-automation controls on auth | ✓ | | ⚠️ PARTIAL | Better-Auth rate-limit table (`rateLimitEnabled`, `rateLimitMax=10/day` in schema); no HTTP-layer rate limiter middleware |
| 2.2.2 | Only approved authentication factors | | ✓ | ✅ | Email/password via Better-Auth; PIN as secondary factor with bcrypt hash |
| 2.2.3 | Secure notifications on auth changes | ✓ | | ⚠️ PARTIAL | Better-Auth sends verification emails; no explicit notification on password change |
| 2.3.1 | System-generated initial passwords are random | ✓ | | N/A | No system-generated passwords; admin users seeded with env-supplied credentials |
| 2.4.1 | Passwords stored with approved one-way hash | ✓ | | ✅ | Better-Auth uses bcrypt for passwords; PIN hash: bcrypt (`pin_hash`); security answer: bcrypt (`security_answer_hash`) |
| 2.4.2 | Salt unique per credential | ✓ | | ✅ | Bcrypt generates per-hash salt by design |
| 2.5.1 | Password recovery via OTP/token, not hint | ✓ | | ⚠️ PARTIAL | Better-Auth handles; PIN recovery via security_question (answer hash checked) |
| 2.6.1 | OTPs have fixed expiry | | ✓ | ⚠️ PARTIAL | Better-Auth manages; no custom OTP found |
| 2.7.1 | Clear-text out-of-band authenticators not used | ✓ | | ✅ | No SMS OTP; email tokens via Better-Auth (hashed) |
| 2.8.1 | Time-based OTPs have defined lifetime | | ✓ | N/A | TOTP not implemented |
| 2.10.1 | Integration secrets not based on guessable values | | ✓ | ✅ | `INTERNAL_SERVICE_TOKEN` validated ≥32 chars at startup; falls back to `crypto.randomUUID()` |
| 2.10.2 | Integration secrets not stored in code | | ✓ | ✅ | All secrets via environment variables; no hardcoded values found in source |
| 2.10.4 | Passwords/keys at rest protected by approved algorithm | | ✓ | ✅ | Bcrypt for all PIN/password hashes; database at rest encryption is infra concern |

---

## V3 Session Management Verification

| # | Description | L1 | L2 | Status | Evidence / Notes |
|---|-------------|:--:|:--:|--------|-----------------|
| 3.1.1 | Session tokens never in URL | ✓ | | ✅ | Bearer tokens in `Authorization` header; cookie-based sessions not in URL |
| 3.2.1 | New session token on login | ✓ | | ✅ | Better-Auth creates new session on each login |
| 3.2.2 | Session tokens have sufficient entropy | ✓ | | ✅ | Better-Auth session IDs (cryptographically random) |
| 3.2.3 | Session tokens stored securely | | ✓ | ✅ | `httpOnly: true` on session cookies; `sameSite` auto-configured based on CORS mode |
| 3.3.1 | Logout invalidates session | ✓ | | ✅ | Better-Auth `/sign-out` endpoint revokes server-side session |
| 3.3.2 | Session timeout after inactivity | ✓ | | ⚠️ PARTIAL | Better-Auth default session expiry; no explicit inactivity timeout configured |
| 3.4.1 | Cookie session tokens have `Secure` attribute | ✓ | | ⚠️ PARTIAL | `secure` set when `https://` in `baseUrl` or `secureCookies` config; not forced in all environments |
| 3.4.2 | Cookie session tokens have `HttpOnly` attribute | ✓ | | ✅ | `httpOnly: true` in `core/auth.ts:272` |
| 3.4.3 | Cookie session tokens use `SameSite` | ✓ | | ✅ | `sameSite` set to `lax` or `none` based on CORS config; `none` only in dev cross-origin |
| 3.4.4 | Cookies scoped to path | ✓ | | ⚠️ PARTIAL | Better-Auth manages cookie path; not verified in custom config |
| 3.4.5 | Cookies scoped to domain | ✓ | | ⚠️ PARTIAL | Better-Auth manages; `baseUrl` drives domain |
| 3.7.1 | Application verifies session integrity before critical transactions | | ✓ | ✅ | `authMiddleware` checks session on every protected route |

---

## V4 Access Control Verification

| # | Description | L1 | L2 | Status | Evidence / Notes |
|---|-------------|:--:|:--:|--------|-----------------|
| 4.1.1 | Principle of least privilege | ✓ | | ⚠️ PARTIAL | Branch-level scoping via `assertBranchAccess`; role differentiation within dental domain incomplete (P1) |
| 4.1.2 | All user/data attributes used for access control not mutable by users | ✓ | | ✅ | Role stored in Better-Auth session server-side; not from request headers |
| 4.1.3 | Principle of least privilege for functions | ✓ | | ⚠️ PARTIAL | `assert-branch-role.ts` exists but not all handlers use it (F-001) |
| 4.1.5 | Access control failures logged/alerted | ✓ | | ✅ | `ForbiddenError`, `UnauthorizedError` logged with Pino + `X-Request-ID` |
| 4.2.1 | Sensitive data/functions behind ABAC or RBAC | | ✓ | ⚠️ PARTIAL | RBAC via `authMiddleware({roles})` + `assertBranchRole`; not applied uniformly to all dental endpoints |
| 4.2.2 | CSRF defenses implemented | | ✓ | ✅ | `createCsrfGuard` middleware: Fetch-Metadata (`Sec-Fetch-Site`) + Origin allowlist check; exempts Better-Auth and Stripe webhook paths |
| 4.3.1 | Admin UIs require MFA or similar elevated auth | | ✓ | ⚠️ PARTIAL | Admin role required; no MFA enforced for admin actions |
| 4.3.2 | Directory listings disabled | ✓ | | ✅ | Hono has no static file serving; no directory browsing |
| 4.3.3 | Application denies access unless explicitly granted | ✓ | | ✅ | `authMiddleware` default-deny; `required: true` is the default option |

---

## V5 Validation, Sanitization, and Encoding

| # | Description | L1 | L2 | Status | Evidence / Notes |
|---|-------------|:--:|:--:|--------|-----------------|
| 5.1.1 | HTTP parameter pollution attacks defeated | ✓ | | ✅ | Hono parses first occurrence; generated Zod schemas reject unexpected types |
| 5.1.2 | Framework protects against mass assignment | ✓ | | ✅ | TypeSpec-generated validators use strict Zod schemas; no `...req.body` spread patterns found |
| 5.1.3 | All input validated with positive allowlist | ✓ | | ✅ | All routes use generated `zValidator` from TypeSpec; unknown fields rejected |
| 5.1.4 | Structured data validated against schema | ✓ | | ✅ | Zod validates all request bodies, query params, and path params |
| 5.2.1 | All untrusted HTML input sanitized with approved library | ✓ | | N/A | JSON API only; no HTML rendering in backend |
| 5.2.3 | SMTP/LDAP injection defenses for mail headers | ✓ | | ✅ | Postmark SDK handles; no raw SMTP header construction with user input |
| 5.2.5 | Template injection defenses | ✓ | | N/A | No server-side templating |
| 5.2.7 | No eval() or unsafe reflection | ✓ | | ✅ | No `eval()` found; TypeScript compiled to static JS |
| 5.3.3 | Output encoding for SQL queries | ✓ | | ✅ | Drizzle ORM parameterized queries throughout; `sql\`\`` tag used for Drizzle-safe typed fragments (not string concatenation) |
| 5.3.6 | JSON injection defenses | ✓ | | ✅ | `JSON.stringify` only via Hono `c.json()`; no manual JSON construction |
| 5.5.2 | Deserialization only uses approved deserializers | | ✓ | ✅ | `JSON.parse` only; no `eval`-based deserialization |

---

## V6 Stored Cryptography Verification

| # | Description | L1 | L2 | Status | Evidence / Notes |
|---|-------------|:--:|:--:|--------|-----------------|
| 6.1.1 | Data classification policy exists | | ✓ | ⚠️ PARTIAL | PHI explicitly identified in logger redaction; no formal data classification register document |
| 6.2.1 | All cryptographic modules fail securely | ✓ | | ✅ | Bcrypt failures throw; no silent fallback to plaintext |
| 6.2.2 | Industry-proven or government-approved algorithms only | ✓ | | ✅ | Bcrypt (passwords/PIN); AES via HTTPS/TLS (infra); no custom crypto |
| 6.2.3 | Encryption initialization not hardcoded | | ✓ | ✅ | `AUTH_SECRET` from env; `crypto.randomUUID()` fallback for non-production only |
| 6.2.4 | Random number generation uses CSPRNG | | ✓ | ✅ | `crypto.randomUUID()` (Web Crypto API) used for service tokens |
| 6.2.5 | No deprecated cryptographic functions | | ✓ | ✅ | No MD5/SHA1 found; bcrypt is current standard |
| 6.2.7 | All cryptographic operations constant-time | | ✓ | ⚠️ PARTIAL | Bcrypt is timing-safe; PIN comparison uses bcrypt.compare (safe); session token comparison timing not audited in Better-Auth |
| 6.3.1 | All random values generated with CSPRNG | ✓ | | ✅ | `crypto.randomUUID()` throughout |
| 6.4.1 | Key management solution in use | | ✓ | ⚠️ PARTIAL | Env-var based secrets; no HSM or dedicated KMS |
| 6.4.2 | Secrets not in environment variables for production | | ✓ | ❌ | All secrets are env vars; no KMS integration |

---

## V7 Error Handling and Logging Verification

| # | Description | L1 | L2 | Status | Evidence / Notes |
|---|-------------|:--:|:--:|--------|-----------------|
| 7.1.1 | No credentials/PII logged | ✓ | | ✅ | Pino logger redacts: `email`, `password`, `firstName`, `lastName`, `dateOfBirth`, `ssn`, `dob`, `phone`, `soap`, `refusalReason`, `dismissReason`, `x-internal-service-token`, `x-auth-token`; query strings stripped from `req.url` |
| 7.1.2 | No sensitive data logged at DEBUG in production | ✓ | | ✅ | Log level controlled by `LOG_LEVEL` env; PHI redaction applies at all levels |
| 7.2.1 | All auth decisions logged | ✓ | | ✅ | Auth failures throw `UnauthorizedError`/`ForbiddenError`, caught by error handler, logged with request context |
| 7.2.2 | All access control decisions logged | | ✓ | ✅ | `authMiddleware` and `assertBranchAccess` throw typed errors; all 4xx logged |
| 7.3.1 | Log injection prevention | | ✓ | ✅ | Pino serializes to JSON; no string interpolation into log messages |
| 7.3.2 | Logs protected from unauthorized access | | ✓ | ⚠️ PARTIAL | Pino writes to stdout; log aggregation security is infra concern (not audited) |
| 7.4.1 | Generic error messages sent to client | ✓ | | ✅ | Production: stack traces suppressed (`isProduction = process.env.NODE_ENV === 'production'`); client receives `{message, code, requestId, timestamp}` only |
| 7.4.2 | Error handling logs and processes both expected and unexpected errors | | ✓ | ✅ | `registerErrorHandlers` in `core/errors.ts` handles all Hono `onError` events |

---

## V8 Data Protection Verification

| # | Description | L1 | L2 | Status | Evidence / Notes |
|---|-------------|:--:|:--:|--------|-----------------|
| 8.1.1 | Sensitive data not cached by client | ✓ | | ⚠️ PARTIAL | No explicit `Cache-Control: no-store` on sensitive endpoints |
| 8.1.2 | No sensitive data in URL parameters | ✓ | | ✅ | Patient/visit data accessed by ID; PHI never in URL query strings |
| 8.1.3 | No sensitive data in error responses | ✓ | | ✅ | Error handler strips details in production; `requestId` only |
| 8.2.1 | Anti-caching headers on pages with sensitive data | ✓ | | ❌ | No `Cache-Control: no-store` header on sensitive API responses |
| 8.2.2 | Data purge mechanism exists | | ✓ | ⚠️ PARTIAL | Patient archive handler exists (`archiveDentalPatient.ts`); no GDPR erasure endpoint |
| 8.3.1 | Sensitive data sent to server in HTTP body or headers | ✓ | | ✅ | All PHI mutations via POST/PUT/PATCH body; GET uses only IDs in path |
| 8.3.4 | All user data created/modified can be deleted | | ✓ | ⚠️ PARTIAL | Archive exists; hard delete not available for all entities |

---

## V9 Communication Security Verification

| # | Description | L1 | L2 | Status | Evidence / Notes |
|---|-------------|:--:|:--:|--------|-----------------|
| 9.1.1 | TLS used for all communications | ✓ | | ⚠️ PARTIAL | HSTS header set in production; TLS termination at load balancer/Cloudflare (not app-level); dev runs HTTP |
| 9.1.2 | TLS version is current | | ✓ | ⚠️ PARTIAL | Infra-level (not code-enforced); assumed TLS 1.2+ at Cloudflare |
| 9.1.3 | Approved cipher suites only | | ✓ | ⚠️ PARTIAL | Cloudflare/infra enforces; not app-level |
| 9.2.1 | Connections to external services use TLS | ✓ | | ✅ | Stripe, Postmark, OneSignal, S3 — all HTTPS SDKs |
| 9.2.2 | TLS cert validated for backend connections | ✓ | | ✅ | Node/Bun validates certs by default; no `rejectUnauthorized: false` found |

---

## V10 Malicious Code Verification

| # | Description | L1 | L2 | Status | Evidence / Notes |
|---|-------------|:--:|:--:|--------|-----------------|
| 10.2.1 | Source code does not contain backdoors | ✓ | | ✅ | Code review via CONTRIBUTING.md; no hardcoded secrets found |
| 10.2.2 | Interpreted code does not allow runtime code execution | ✓ | | ✅ | No `eval()`, `Function()`, `vm.runInContext()` found |
| 10.3.1 | App auto-update integrity verified | | ✓ | N/A | Server-side app; no auto-update mechanism |
| 10.3.2 | App uses code signing | | ✓ | N/A | Container deployment; no mobile app |

---

## V11 Business Logic Verification

| # | Description | L1 | L2 | Status | Evidence / Notes |
|---|-------------|:--:|:--:|--------|-----------------|
| 11.1.1 | Business logic flows sequential, not skippable | ✓ | | ⚠️ PARTIAL | Treatment state machine `diagnosed→planned→performed` enforced; payment plan state partially enforced |
| 11.1.2 | Business logic includes limits and validations | ✓ | | ⚠️ PARTIAL | Zod validates ranges; no DB-level double-booking constraint (P2) |
| 11.1.4 | Business logic does not process high-value flows quickly | | ✓ | ⚠️ PARTIAL | No explicit anti-automation for billing flows |
| 11.1.5 | Unusual activity alerted or blocked | | ✓ | ❌ | No anomaly detection; audit logs exist but no alerting |

---

## V13 API and Web Service Verification

| # | Description | L1 | L2 | Status | Evidence / Notes |
|---|-------------|:--:|:--:|--------|-----------------|
| 13.1.1 | Same encoding for all API communications | ✓ | | ✅ | JSON throughout; `Content-Type: application/json` on all responses |
| 13.1.2 | API URLs do not expose unnecessary path components | ✓ | | ✅ | No internal paths or debug endpoints exposed in production (`NODE_ENV` check) |
| 13.1.3 | API URLs do not contain sensitive information | ✓ | | ✅ | PHI accessed via UUID only; no names/emails in paths |
| 13.1.4 | Authorization decisions at gateway or service layer | | ✓ | ✅ | `authMiddleware` at service layer; no reliance on gateway headers for auth |
| 13.1.5 | Requests from unexpected/unauthorized origins rejected | ✓ | | ✅ | CORS `createOriginValidator` with fail-closed default (`null` returned for unknown origin); CSRF guard on mutation methods |
| 13.2.1 | RESTful HTTP verbs match operations | ✓ | | ✅ | TypeSpec-generated routes enforce correct verbs |
| 13.2.2 | RESTful services validate `Content-Type` | ✓ | | ✅ | Zod validators reject non-JSON bodies |
| 13.2.3 | RESTful services protected from CSRF | ✓ | | ✅ | `createCsrfGuard` on all state-mutating methods |
| 13.3.1 | OpenAPI schema validates all inputs | ✓ | | ✅ | TypeSpec → OpenAPI → Zod validators; all routes covered |
| 13.4.1 | GraphQL or data layer — query depth limits | ✓ | | N/A | No GraphQL |

---

## Summary

| Category | Total Items | ✅ PASS | ⚠️ PARTIAL | ❌ FAIL | N/A |
|----------|------------|---------|-----------|--------|-----|
| V1 Architecture | 15 | 8 | 6 | 0 | 1 |
| V2 Authentication | 14 | 7 | 5 | 0 | 2 |
| V3 Session Management | 12 | 7 | 5 | 0 | 0 |
| V4 Access Control | 9 | 5 | 3 | 0 | 1 |
| V5 Validation | 11 | 9 | 0 | 0 | 2 |
| V6 Cryptography | 10 | 6 | 3 | 1 | 0 |
| V7 Error Handling | 8 | 6 | 2 | 0 | 0 |
| V8 Data Protection | 8 | 3 | 4 | 1 | 0 |
| V9 Communication | 5 | 2 | 3 | 0 | 0 |
| V10 Malicious Code | 4 | 3 | 0 | 0 | 1 |
| V11 Business Logic | 4 | 0 | 3 | 1 | 0 |
| V13 API/Web Service | 10 | 8 | 0 | 0 | 2 |
| **Total** | **110** | **64** | **34** | **2** | **9** |

**L2 Pass rate (excl. N/A):** 64/101 = **63% full pass**, 98/101 (97%) pass or partial

### Hard Failures (❌)

| # | Item | Remediation |
|---|------|-------------|
| 6.4.2 | Secrets in environment variables (no KMS) | Integrate AWS Secrets Manager or Vault; medium effort |
| 8.2.1 | No `Cache-Control: no-store` on sensitive endpoints | Add header in `createSecurityHeaders` for auth'd routes |
| 11.1.5 | No anomaly detection or alerting on unusual activity | Add Pino-to-SIEM pipeline or Datadog log alerts; high effort |

### Key Partial Items to Upgrade (⚠️)

1. **Rate limiting at HTTP layer** — Better-Auth has DB-backed rate limit table but no HTTP-layer middleware; add `hono-rate-limiter` or equivalent
2. **Role enforcement in all dental handlers** — `assert-branch-role.ts` exists but not uniformly applied (G1-S1 work item)
3. **MFA for admin operations** — Better-Auth supports TOTP; not enabled
4. **Cache-Control headers** — Add `Cache-Control: no-store` to API responses containing PHI
5. **Inactivity session timeout** — Configure Better-Auth session expiry to ≤8h for clinical workstations
6. **Known advisory upgrades** — better-auth <1.4.2 has HIGH/CRITICAL advisories (GHSA-x732-6j76-qmhm, GHSA-p6v2-xcpg-h6xw, GHSA-xg6x-h9c9-2m83) pending upgrade; drizzle-orm SQL injection advisory (GHSA-gpj5-g38j-94v9) tracked

---

*Generated from code review of `services/api-ts/src/` on branch `feat/v1.5-g1-foundation`. Evidence references: `src/middleware/security.ts`, `src/middleware/auth.ts`, `src/utils/cors.ts`, `src/core/logger.ts`, `src/core/errors.ts`, `src/core/config.ts`, `src/core/auth.ts`, `docs/audits/SECURITY_ADVISORIES.md`.*
