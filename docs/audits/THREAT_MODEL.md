# Threat Model — Dentalemon API

**Framework:** STRIDE
**Scope:** `services/api-ts` dental handler modules (8 domain modules + shared infrastructure)
**Date:** 2026-05-21
**Branch:** feat/v1.5-g1-foundation
**Author:** Engineering security review

---

## System Overview

Dentalemon is a multi-branch dental practice management API built on:
- **Runtime:** Bun + Hono HTTP framework
- **Auth:** Better-Auth (session cookies + Bearer tokens)
- **Database:** PostgreSQL via Drizzle ORM (parameterized queries)
- **API definition:** TypeSpec → OpenAPI → generated Zod validators
- **Logging:** Pino (structured JSON, PHI-redacting)
- **External services:** Stripe (billing), Postmark (email), OneSignal (push), S3/MinIO (storage)

The API is a JSON REST service with no server-side HTML rendering. All responses are `application/json`.

---

## Trust Boundaries

```
[Internet / Browser / Mobile]
        │
        ▼
[Infra Layer: Cloudflare / Load Balancer / TLS termination]
        │
        ▼
[Hono Middleware Stack]
  1. createRequestId      — assigns X-Request-ID per request
  2. createRequestLogger  — Pino logs (PHI-redacted)
  3. createSecurityHeaders — CSP, HSTS, X-Frame-Options, X-Content-Type-Options
  4. createCorsMiddleware  — dynamic origin validator (fail-closed)
  ── Better-Auth routes ──────────────────────────────── (CSRF exempt, managed by BA)
  5. createCsrfGuard      — Sec-Fetch-Site + Origin allowlist for mutations
  ── Protected routes ────────────────────────────────────────────────────────────
  6. authMiddleware        — Better-Auth session; resolves user.role from session
  7. assertBranchAccess   — verifies active membership in requested branch
  8. assertBranchRole     — (selective) role-level gate for sensitive operations
  9. Handler              — business logic + Drizzle ORM
        │
        ▼
[PostgreSQL — parameterized queries, row-level data scoped by branchId/orgId]
```

### Role Hierarchy (dental domain)

| Role | Privileges |
|------|-----------|
| `dentist_owner` | Full access to all branch data + settings |
| `dentist_associate` | Clinical data access; own imaging only for delete |
| `staff_full` | Scheduling, patients, billing, visit records |
| `staff_scheduling` | Scheduling and patient lookup only |
| (unauthenticated) | Zero access to dental endpoints |

### Key Trust Assertions

1. **Session integrity:** User role embedded in Better-Auth session (server-signed); not from request headers.
2. **Branch isolation:** Every dental endpoint validates that the requesting user has an active membership in the branch specified by `:branchId` URL param.
3. **Internal M2M:** `X-Internal-Service-Token` header validates internal expand requests; token is ≥32 char random string from env; disabled unless `INTERNAL_SERVICE_EXPAND_ENABLED=true`.
4. **No direct DB access from untrusted callers:** All access goes through handler layer.

---

## STRIDE Analysis by Module

### Shared Infrastructure (auth, middleware, errors)

| Threat Type | Threat | Likelihood | Impact | Mitigation | Status |
|-------------|--------|:----------:|:------:|------------|--------|
| **Spoofing** | Forged session token to impersonate another user | Medium | Critical | Better-Auth HMAC-signed sessions; `AUTH_SECRET` ≥32 chars enforced | ✅ Mitigated |
| **Spoofing** | Attacker supplies crafted `X-Internal-Service-Token` | Low | High | Token validated against server-side env value; not derivable from request | ✅ Mitigated |
| **Spoofing** | JWT replay attack after logout | Medium | High | Better-Auth invalidates session server-side on logout; token useless after revocation | ✅ Mitigated |
| **Tampering** | Attacker modifies role in request to escalate privileges | Low | Critical | Role sourced from server-side session only; any client-supplied role is ignored | ✅ Mitigated |
| **Tampering** | CSRF mutation via cross-site form post | Medium | High | `createCsrfGuard` checks `Sec-Fetch-Site` + Origin allowlist on all unsafe methods | ✅ Mitigated |
| **Repudiation** | Attacker denies performing a clinical action | Medium | High | Pino structured logs with `X-Request-ID`, user ID, branch ID, and timestamp on every request | ✅ Mitigated |
| **Information Disclosure** | Stack traces exposed in error responses | High (dev) / Low (prod) | Medium | `isProduction` check strips stack traces; client gets only `{message, code, requestId}` | ✅ Mitigated |
| **Information Disclosure** | PHI in server logs | Medium | Critical | Pino redacts: email, password, firstName, lastName, ssn, dob, phone, soap, refusalReason, auth headers; query strings stripped | ✅ Mitigated |
| **Denial of Service** | Auth endpoint brute-forced | Medium | Medium | Better-Auth DB-backed rate limit table (10 req/day per account); no HTTP-layer rate limiter | ⚠️ Partial |
| **Denial of Service** | Session endpoint flooded | Medium | Medium | No HTTP-layer rate limiting middleware; relies on infra (Cloudflare) | ⚠️ Partial |
| **Elevation of Privilege** | Attacker gains admin via weak secret | Low | Critical | `AUTH_SECRET` ≥32 chars enforced at startup; `crypto.randomUUID()` fallback only for dev | ✅ Mitigated |
| **Elevation of Privilege** | better-auth path normalization bypass (`//` prefix) | Low | High | GHSA-x732-6j76-qmhm — disabledPaths not used for auth enforcement; tracked for upgrade | ⚠️ Partial |

---

### dental-org (organizations, branches, memberships)

| Threat Type | Threat | Likelihood | Impact | Mitigation | Status |
|-------------|--------|:----------:|:------:|------------|--------|
| **Spoofing** | Attacker registers under another org's branch | Low | High | `assertBranchAccess` checks active membership for `:branchId`; membership created only by org owner | ✅ Mitigated |
| **Tampering** | Staff member escalates own role | Low | High | Role changes require `dentist_owner` role; `assertBranchRole` guards write operations | ⚠️ Partial (not all endpoints) |
| **Repudiation** | Owner denies removing a member | Low | Medium | Action logged with actor ID and timestamp | ✅ Mitigated |
| **Information Disclosure** | Cross-branch member list leak | Low | Medium | All list queries filtered by `branchId` from validated session membership | ✅ Mitigated |
| **Information Disclosure** | Enumeration of branches via 404 vs 403 | Medium | Low | `assertBranchAccess` returns 403 before existence check (no info leak) | ✅ Mitigated |
| **Denial of Service** | Unbounded organization creation | Low | Low | Auth required; no rate limit on org creation | ⚠️ Partial |
| **Elevation of Privilege** | PIN brute force to impersonate staff | Medium | High | Bcrypt PIN hash; `pinLockedUntil` / `pinFailedAttempts` lockout after `PIN_MAX_ATTEMPTS` | ✅ Mitigated |
| **Elevation of Privilege** | Weak PIN (e.g., "1234") | High | Medium | No PIN complexity enforcement beyond storage; no minimum entropy check | ❌ Open |

---

### dental-patient (patient registry)

| Threat Type | Threat | Likelihood | Impact | Mitigation | Status |
|-------------|--------|:----------:|:------:|------------|--------|
| **Spoofing** | Unauthenticated access to patient PII | High | Critical | `authMiddleware` required on all patient routes; 401 for missing session | ✅ Mitigated |
| **Tampering** | Staff modifies another branch's patient record | Low | High | Queries filter by `branchId` from verified membership; cross-branch modification impossible | ✅ Mitigated |
| **Repudiation** | Clinician denies viewing sensitive patient record | Medium | High | Request logger records user ID, patient ID, branch, and timestamp | ✅ Mitigated |
| **Information Disclosure** | Search returns patients from other branches | Low | Critical | Search queries scoped to `branchId`; Drizzle WHERE clause enforced | ✅ Mitigated |
| **Information Disclosure** | PII in server logs | Medium | High | Pino redacts PHI fields; patient names/emails not logged in plain text | ✅ Mitigated |
| **Denial of Service** | Unbounded patient search (large result sets) | Medium | Low | Pagination enforced (`parsePagination` with `maxLimit: 100`) | ✅ Mitigated |
| **Elevation of Privilege** | `staff_scheduling` accesses clinical notes | Medium | High | Role-level enforcement incomplete across dental modules (F-001 open risk) | ⚠️ Partial |

---

### dental-visit (visits, tooth history, clinical actions)

| Threat Type | Threat | Likelihood | Impact | Mitigation | Status |
|-------------|--------|:----------:|:------:|------------|--------|
| **Spoofing** | Unauthenticated visit creation | High | High | `authMiddleware` required; 401 enforced | ✅ Mitigated |
| **Tampering** | Backdating visit timestamps | Medium | Medium | `created_at` set server-side; client cannot supply timestamp for audit fields | ✅ Mitigated |
| **Tampering** | Skip treatment state machine (diagnosed → performed in one step) | Medium | High | State machine enforces `diagnosed→planned→performed` sequence; single-jump returns 422 | ✅ Mitigated |
| **Repudiation** | Clinician denies performing a tooth procedure | Medium | High | Visit and tooth history records are append-only with actor ID | ✅ Mitigated |
| **Information Disclosure** | Tooth history from another branch | Low | High | `getToothHistory` scoped to branch membership | ✅ Mitigated |
| **Denial of Service** | Tooth history query scans entire patient history | Low | Low | Indexed by patient ID and branch | ✅ Mitigated |
| **Elevation of Privilege** | `staff_scheduling` creates/modifies clinical data | Medium | High | Role differentiation not uniformly applied to visit endpoints (F-001) | ⚠️ Partial |

---

### dental-clinical (prescriptions, medical history, SOAP notes)

| Threat Type | Threat | Likelihood | Impact | Mitigation | Status |
|-------------|--------|:----------:|:------:|------------|--------|
| **Spoofing** | Unauthenticated access to prescription history | High | Critical | `authMiddleware` required; Zod-validated path params | ✅ Mitigated |
| **Tampering** | Alteration of SOAP notes after signing | Low | Critical | No explicit immutability enforcement on signed notes | ❌ Open |
| **Repudiation** | Provider denies issuing prescription | Medium | Critical | Prescription records include `createdBy` (actor ID) and timestamp | ✅ Mitigated |
| **Information Disclosure** | SOAP notes returned to unauthorized role | Medium | High | Branch membership checked; role-level check for clinical notes not fully applied | ⚠️ Partial |
| **Information Disclosure** | Diagnosis codes in error messages | Low | Medium | Error handler suppresses details in production | ✅ Mitigated |
| **Denial of Service** | Medical history list unbounded | Low | Low | Pagination enforced (limit 50) | ✅ Mitigated |
| **Elevation of Privilege** | Staff reads another clinician's draft notes | Low | Medium | No draft/finalized access segregation | ❌ Open |

---

### dental-scheduling (appointments, slots)

| Threat Type | Threat | Likelihood | Impact | Mitigation | Status |
|-------------|--------|:----------:|:------:|------------|--------|
| **Spoofing** | Unauthenticated slot reservation | Medium | Medium | `authMiddleware` required | ✅ Mitigated |
| **Tampering** | Double-booking same slot | Medium | Medium | No DB-level unique constraint on slot + time; application-level check only (P2) | ⚠️ Partial |
| **Repudiation** | Patient disputes appointment cancellation | Low | Low | Audit log records who cancelled and when | ✅ Mitigated |
| **Information Disclosure** | Staff schedule from another branch | Low | Medium | Queries scoped to `branchId` from membership | ✅ Mitigated |
| **Denial of Service** | Slot flooding (create thousands of bookings) | Medium | Medium | No booking rate limit; auth required limits surface | ⚠️ Partial |
| **Elevation of Privilege** | `staff_scheduling` cancels dentist-owned slot | Low | Low | Role check needed; currently membership-only gating | ⚠️ Partial |

---

### dental-billing (invoices, payment plans)

| Threat Type | Threat | Likelihood | Impact | Mitigation | Status |
|-------------|--------|:----------:|:------:|------------|--------|
| **Spoofing** | Attacker creates invoice for another branch's patient | Low | High | Branch membership + patient ownership checked | ✅ Mitigated |
| **Tampering** | Modify invoice amount after creation | Low | High | Invoices require `performed` treatment status to generate; amount from treatment records | ✅ Mitigated |
| **Tampering** | Stripe webhook replay | Medium | High | `STRIPE_WEBHOOK_SECRET` validates webhook signature via Stripe SDK | ✅ Mitigated |
| **Repudiation** | Clinic denies processing payment | Low | High | Stripe transaction ID stored; invoice status updated from webhook | ✅ Mitigated |
| **Information Disclosure** | Payment details exposed to unauthorized staff | Medium | High | Role differentiation incomplete; billing endpoints not role-gated beyond membership | ⚠️ Partial |
| **Denial of Service** | Stripe webhook endpoint spammed | Medium | Medium | Webhook path exempt from CSRF guard (STRIPE_WEBHOOK path); signature check is the control | ✅ Mitigated |
| **Elevation of Privilege** | `staff_scheduling` issues refunds | Low | High | No role check on refund endpoints | ⚠️ Partial |

---

### dental-imaging (X-rays, CBCT, ceph studies)

| Threat Type | Threat | Likelihood | Impact | Mitigation | Status |
|-------------|--------|:----------:|:------:|------------|--------|
| **Spoofing** | Unauthenticated image download | High | Critical | `authMiddleware` required; presigned URL approach limits exposure window | ✅ Mitigated |
| **Tampering** | Associate deletes another clinician's images | Low | High | `deleteImage.ts` role-gated: `dentist_owner` or `dentist_associate` (own images only via `acquiredBy === user.id`) | ✅ Mitigated |
| **Repudiation** | Radiograph deletion not attributed | Low | High | Delete action logged with actor ID, study ID, branch, timestamp | ✅ Mitigated |
| **Information Disclosure** | Imaging data from other branches via DICOM reference ID | Low | High | Study queries filtered by `branchId` from membership | ✅ Mitigated |
| **Information Disclosure** | Presigned URL lifetime too long | Medium | Medium | URL expiry managed by S3/MinIO TTL; not audited in this review | ⚠️ Partial |
| **Denial of Service** | Large image upload exhausts storage | Low | Medium | Upload size limit enforced at infra level; `bodyLimit` not security boundary per GHSA-9vqf | ⚠️ Partial |
| **Elevation of Privilege** | `hygienist`/`front_desk` deletes images | Low | High | Default-deny: `deleteImage.ts` throws `ForbiddenError` for roles not in allowed list | ✅ Mitigated |

---

### dental-pmd (patient medical data / PMD documents)

| Threat Type | Threat | Likelihood | Impact | Mitigation | Status |
|-------------|--------|:----------:|:------:|------------|--------|
| **Spoofing** | Unauthenticated PMD export | High | Critical | `authMiddleware` required | ✅ Mitigated |
| **Tampering** | Import foreign PMD to pollute patient record | Medium | High | Import validates PMD schema via Zod before insertion | ✅ Mitigated |
| **Repudiation** | PMD export not attributed | Low | Medium | Export operation logged with actor ID | ✅ Mitigated |
| **Information Disclosure** | PMD contains cross-patient data bleed | Low | Critical | PMD scoped by `patientId` and `branchId` in queries | ✅ Mitigated |
| **Denial of Service** | Generate PMD for all patients simultaneously | Low | Low | Pagination; single-patient generation per request | ✅ Mitigated |
| **Elevation of Privilege** | `staff_scheduling` exports full medical history | Medium | High | PMD export role check not fully implemented | ⚠️ Partial |

---

### dental-org / EMR module (multi-tenant EMR)

| Threat Type | Threat | Likelihood | Impact | Mitigation | Status |
|-------------|--------|:----------:|:------:|------------|--------|
| **Spoofing** | Cross-tenant data access via tenant_id manipulation | Medium | Critical | `tenantId` from session/config; not from request body | ⚠️ Partial (tenantId nullable in schema) |
| **Tampering** | Inject EMR consultation note for another tenant | Low | High | `tenantId` validated in queries; Drizzle WHERE scoping | ⚠️ Partial |
| **Information Disclosure** | EMR search returns records from other tenants | Medium | Critical | Search filters by `tenantId`; nullable field is latent risk | ⚠️ Partial |
| **Denial of Service** | Full-text search on large EMR corpus | Medium | Low | ILIKE search with pagination | ✅ Mitigated |
| **Elevation of Privilege** | EMR tenant bypass via `EMR_TENANT_ENABLED=false` | Low | Medium | Feature flag controls tenant isolation; default true | ⚠️ Partial |

---

## Open Risks (Unmitigated or Partial)

| Risk ID | Module | Threat | STRIDE | Severity | Notes |
|---------|--------|--------|--------|----------|-------|
| R-01 | All dental | Role enforcement not uniform across all endpoints | EoP | High | G1-S1 work item (F-001): `assertBranchRole` not applied to all handlers |
| R-02 | dental-org | No PIN complexity enforcement | Spoofing | Medium | Any 4-digit PIN accepted; brute force mitigated by lockout, not complexity |
| R-03 | dental-clinical | Signed SOAP notes can be altered | Tampering | High | No immutability flag or append-only enforcement on finalized notes |
| R-04 | dental-clinical | Draft note access by all branch members | EoP | Medium | No draft/finalized segregation by role |
| R-05 | Shared infra | No HTTP-layer rate limiting | DoS | Medium | Better-Auth DB rate limit only; HTTP flood not throttled at middleware |
| R-06 | dental-billing | Billing/refund endpoints not role-gated | EoP | Medium | `staff_scheduling` can potentially access billing ops |
| R-07 | dental-scheduling | No DB-level double-booking constraint | Tampering | Medium | Race condition possible; application check only |
| R-08 | dental-imaging | Presigned URL TTL not audited | Info Disclosure | Medium | Expired share links may persist longer than intended |
| R-09 | EMR | `tenant_id` nullable in schema | Info Disclosure | High | Cross-tenant bleed possible if tenant not set in queries |
| R-10 | All | No `Cache-Control: no-store` on sensitive responses | Info Disclosure | Low | PHI responses may be cached by intermediaries |
| R-11 | Shared infra | better-auth <1.4.2 known vulnerabilities | Multiple | High | GHSA-x732-6j76-qmhm (path bypass), GHSA-p6v2-xcpg-h6xw (rate limit bypass), GHSA-xg6x-h9c9-2m83 (2FA bypass — 2FA not in use) |
| R-12 | Shared infra | drizzle-orm SQL injection via identifier interpolation | Injection | High | GHSA-gpj5-g38j-94v9 — no user-controlled identifiers found; upgrade to ≥0.45.2 tracked |

---

## Remediation Backlog (Prioritized)

| Priority | Risk | Effort | Owner |
|----------|------|--------|-------|
| P0 | R-11: Upgrade better-auth to ≥1.4.2 | Small | Platform |
| P0 | R-12: Upgrade drizzle-orm to ≥0.45.2 | Small | Platform |
| P1 | R-01: Apply `assertBranchRole` uniformly to all dental endpoints | Medium | G1-S1 (in progress) |
| P1 | R-09: Make `tenant_id` NOT NULL in EMR schema | Small | Backend |
| P1 | R-03: Add immutability for finalized clinical notes | Medium | dental-clinical |
| P2 | R-05: Add HTTP-layer rate limiting middleware (`hono-rate-limiter`) | Small | Platform |
| P2 | R-06: Role-gate billing/refund endpoints | Medium | dental-billing |
| P2 | R-07: Add DB unique constraint on slot reservations | Small | dental-scheduling |
| P2 | R-04: Segregate draft/finalized note access by role | Medium | dental-clinical |
| P3 | R-02: Enforce PIN complexity (min entropy, no sequential) | Small | dental-org |
| P3 | R-10: Add `Cache-Control: no-store` to sensitive response middleware | Small | Platform |
| P3 | R-08: Audit presigned URL TTL policy | Small | dental-imaging |

---

*STRIDE analysis based on code review of `services/api-ts/src/` on branch `feat/v1.5-g1-foundation`. Cross-references: `ASVS_L2.md`, `EXISTING_CODEBASE_ADOPTION_AUDIT.md` (OWASP Top 10 section), `SECURITY_ADVISORIES.md`, `docs/development/VERTICAL_TDD.md`.*
