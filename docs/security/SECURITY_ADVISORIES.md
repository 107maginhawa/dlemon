# Security Advisories — Accepted Baseline

Last audited: 2026-05-19

This document records known advisories that have been triaged and accepted as part of the operational risk baseline. Accepted advisories are re-evaluated on each `bun audit` run in CI.

## Accepted Advisories

| ID | Package | Severity | Description | Rationale | Accepted |
|----|---------|----------|-------------|-----------|----------|
| GHSA-v2wj-7wpq-c8vv | dompurify >=3.1.3 <=3.3.1 | moderate | DOMPurify contains a Cross-site Scripting vulnerability | Transitive via @scalar/api-reference (dev/docs tool, not user-facing). No upgrade path without upstream @scalar release. | 2026-05-19 |
| GHSA-cjmm-f4jc-qw8r | dompurify >=3.1.3 <=3.3.1 | moderate | DOMPurify ADD_ATTR predicate skips URI validation | Same as above — @scalar transitive dep, dev tooling only. | 2026-05-19 |
| GHSA-cj63-jhhr-wcxv | dompurify >=3.1.3 <=3.3.1 | moderate | DOMPurify USE_PROFILES prototype pollution allows event handlers | Same as above — @scalar transitive dep, dev tooling only. | 2026-05-19 |
| GHSA-39q2-94rc-95cp | dompurify >=3.1.3 <=3.3.1 | moderate | DOMPurify's ADD_TAGS function form bypasses FORBID_TAGS | Same as above — @scalar transitive dep, dev tooling only. | 2026-05-19 |
| GHSA-h7mw-gpvr-xq4m | dompurify >=3.1.3 <=3.3.1 | moderate | DOMPurify: FORBID_TAGS bypassed by function-based ADD_TAGS predicate | Same as above — @scalar transitive dep, dev tooling only. | 2026-05-19 |
| GHSA-crv5-9vww-q3g8 | dompurify >=3.1.3 <=3.3.1 | moderate | DOMPurify has a SAFE_FOR_TEMPLATES bypass in RETURN_DOM mode | Same as above — @scalar transitive dep, dev tooling only. | 2026-05-19 |
| GHSA-v9jr-rg53-9pgp | dompurify >=3.1.3 <=3.3.1 | moderate | DOMPurify: Prototype Pollution to XSS Bypass via CUSTOM_ELEMENT_HANDLING | Same as above — @scalar transitive dep, dev tooling only. | 2026-05-19 |
| GHSA-h8r8-wccr-v5f2 | dompurify >=3.1.3 <=3.3.1 | moderate | DOMPurify is vulnerable to mutation-XSS via Re-Contextualization | Same as above — @scalar transitive dep, dev tooling only. | 2026-05-19 |
| GHSA-gpj5-g38j-94v9 | drizzle-orm <0.45.2 | high | Drizzle ORM has SQL injection via improperly escaped SQL identifiers | All queries use parameterised values; no raw identifier interpolation from user input. Upgrade to >=0.45.2 planned in next dependency pass. | 2026-05-19 |
| GHSA-jxxr-4gwj-5jf2 | brace-expansion >=5.0.0 <5.0.6 | moderate | Large numeric range defeats documented `max` DoS protection | Transitive via eslint/rimraf/openapi-typescript — build/lint toolchain only, not shipped to production. | 2026-05-19 |
| GHSA-569q-mpph-wgww | better-auth <1.4.2 | low | Better Auth affected by external request basePath modification DoS | Low severity, no active exploits. Upgrade to >=1.4.2 tracked in dependency backlog. | 2026-05-19 |
| GHSA-wmjr-v86c-m9jj | better-auth <1.4.2 | low | Better Auth's multi-session sign-out hook allows forged cookies to revoke arbitrary sessions | Low severity; multi-session sign-out not used in production flow. Upgrade tracked. | 2026-05-19 |
| GHSA-x732-6j76-qmhm | better-auth <1.4.2 | high | Better Auth's rou3 Dependency has Double-Slash Path Normalization which can Bypass disabledPaths Config | disabledPaths not used for security enforcement in this deployment. Upgrade tracked urgently. | 2026-05-19 |
| GHSA-p6v2-xcpg-h6xw | better-auth <1.4.2 | high | Better Auth: Rate limiter keys IPv6 addresses individually and is bypassable via prefix rotation | Rate limiting supplemented by infra-level controls (Cloudflare). Upgrade tracked urgently. | 2026-05-19 |
| GHSA-wxw3-q3m9-c3jr | better-auth <1.4.2 | moderate | Better Auth: OAuth callback accepts mismatched `state` when cookie-backed state storage is used without PKCE | PKCE is enabled in this deployment. Residual risk accepted; upgrade tracked. | 2026-05-19 |
| GHSA-xg6x-h9c9-2m83 | better-auth <1.4.2 | critical | Better Auth Has Two-Factor Authentication Bypass via Premature Session Caching | 2FA with session.cookieCache is not enabled in this deployment. Upgrade to >=1.4.2 is P0 — blocked pending compatible version release. | 2026-05-19 |
| GHSA-qpm2-6cq5-7pq5 | happy-dom >=19.0.0 <20.0.2 | critical | happy-dom's `--disallow-code-generation-from-strings` is insufficient for isolating untrusted JavaScript | Test-only dependency; never executes untrusted user code. Upgrade to >=20.0.2 tracked. | 2026-05-19 |
| GHSA-37j7-fg3j-429f | happy-dom >=19.0.0 <20.0.2 | critical | Happy DOM: VM Context Escape can lead to Remote Code Execution | Test-only dependency; no user-controlled input reaches happy-dom in CI context. Upgrade tracked. | 2026-05-19 |
| GHSA-w4gp-fjgq-3q4g | happy-dom >=19.0.0 <20.0.2 | high | Happy DOM's fetch credentials uses page-origin cookies instead of target-origin cookies | Test-only; no credential-bearing fetch in unit test suite. Upgrade tracked. | 2026-05-19 |
| GHSA-6q6h-j7hj-3r64 | happy-dom >=19.0.0 <20.0.2 | high | Happy DOM ECMAScriptModuleCompiler: unsanitized export names interpolated as executable code | Test-only; no user-controlled module names in test inputs. Upgrade tracked. | 2026-05-19 |
| GHSA-67mh-4wv8-2f99 | esbuild <=0.24.2 | moderate | esbuild enables any website to send requests to the development server and read the response | Dev-server only vulnerability; not present in production builds. Upgrade blocked by vite version constraint. | 2026-05-19 |
| GHSA-qp7p-654g-cw7p | hono <4.12.18 | moderate | Hono has CSS Declaration Injection via Style Object Values in JSX SSR | SSR with style objects not used in this API (JSON API, no JSX SSR). Upgrade tracked. | 2026-05-19 |
| GHSA-hm8q-7f3q-5f36 | hono <4.12.18 | low | Hono has improper validation of NumericDate claims in JWT verify() | JWT verification uses expiry checks enforced by Better-Auth layer. Upgrade tracked. | 2026-05-19 |
| GHSA-p77w-8qqv-26rm | hono <4.12.18 | moderate | Hono's Cache Middleware ignores Vary: Authorization / Vary: Cookie | Cache middleware not used on authenticated routes. Upgrade tracked. | 2026-05-19 |
| GHSA-9vqf-7f2p-gf9v | hono <4.12.18 | moderate | Hono: bodyLimit() can be bypassed for chunked / unknown-length requests | bodyLimit not relied on as a security boundary; upload limits enforced at infra level. Upgrade tracked. | 2026-05-19 |
| GHSA-69xw-7hcm-h432 | hono <4.12.18 | moderate | hono/jsx has Unvalidated JSX Tag Names that May Allow HTML Injection | hono/jsx not used; all responses are JSON. Upgrade tracked. | 2026-05-19 |
| GHSA-5wm8-gmm8-39j9 | fast-xml-builder <=1.1.6 | high | fast-xml-builder allows attribute values with unwanted quotes to bypass attributes | Transitive via @aws-sdk/client-s3. Attribute values are never user-controlled in S3 SDK usage. Upgrade when AWS SDK releases fix. | 2026-05-19 |
| GHSA-45c6-75p6-83cc | fast-xml-builder <=1.1.6 | moderate | fast-xml-builder Comment Value regex can be bypassed | Same as above — AWS SDK transitive. No comment value injection in usage. | 2026-05-19 |
| GHSA-c7w3-x93f-qmm8 | nodemailer <8.0.4 | low | Nodemailer has SMTP command injection via unsanitized `envelope.size` parameter | envelope.size is not set from user input in this codebase. Upgrade to >=8.0.4 tracked. | 2026-05-19 |
| GHSA-vvjj-xcjg-gr5g | nodemailer <8.0.4 | moderate | Nodemailer Vulnerable to SMTP Command Injection via CRLF in Transport name Option | Transport name is hardcoded config, not user input. Upgrade tracked. | 2026-05-19 |
| GHSA-pv5w-4p9q-p3v2 | kysely >=0.26.0 <0.28.17 | high | Kysely: JSON-path traversal injection via unsanitized path-leg metacharacters | Transitive via drizzle-orm and better-auth. JSON-path builder not called with user-controlled keys in this codebase. Upgrade when drizzle-orm pins fixed version. | 2026-05-19 |
| GHSA-58qx-3vcg-4xpx | ws >=8.0.0 <8.20.1 | moderate | ws: Uninitialized memory disclosure | Transitive via api-ts and happy-dom. WebSocket upgrade handler guarded; happy-dom is test-only. Upgrade tracked. | 2026-05-19 |
| GHSA-v39h-62p7-jpjc | fast-uri <=3.1.1 | high | fast-uri vulnerable to host confusion via percent-encoded authority delimiters | Transitive via @typespec/compiler and eslint — build/lint toolchain only. Not in production runtime. | 2026-05-19 |
| GHSA-q3j6-qgpj-74h6 | fast-uri <=3.1.1 | high | fast-uri vulnerable to path traversal via percent-encoded dot segments | Same as above — build toolchain transitive, not in production runtime. | 2026-05-19 |
| GHSA-hmx5-qpq5-p643 | swiper >=6.5.1 <12.1.2 | critical | Prototype pollution in swiper | swiper used in dentalemon/sample-workspace UI only (client-side). No user-controlled input reaches swiper config; prototype pollution risk is negligible in this context. Upgrade to >=12.1.2 tracked. | 2026-05-20 |

## Rust (`cargo audit`) — Tracked Remediation (not yet accepted)

Audited: 2026-06-07. The `rust-security` job (`quality.yml:rust-security`) runs `cargo audit`
against `services/cadence` and `services/api-ts-embedded`. **`api-ts-embedded` is clean.**
`services/cadence` currently reports **12 advisories**. These are *not* accepted — they are a
tracked remediation task. Cadence is the Rust P2P sync engine, built only for the optional
Tauri desktop/mobile packaging (not the web app or the `api-ts` HTTP path).

A plain `cargo update` clears ~half; the rest are transitive via `iroh` (transport) and need
coordinated major bumps of `rustls` / `rustls-webpki` / `aws-lc-sys` / `hickory-proto`, which
risk breaking changes and require a `cargo check` + `cargo test` (Postgres + Valkey) pass.
This belongs in a dedicated Rust dependency PR, not folded into unrelated work.

| ID / Crate | Type | Solution | Notes |
|------------|------|----------|-------|
| RUSTSEC aws-lc-sys (name-constraint bypass; CRL scope logic) | vuln ×2 | upgrade aws-lc-sys ≥0.39.0 | transitive via rustls stack |
| RUSTSEC rustls-webpki (CRL parse panic; URI/wildcard name constraints; DP matching) | vuln ×4 | upgrade rustls-webpki ≥0.103.13 | transitive via rustls/iroh |
| RUSTSEC hickory-proto (O(n²) name compression CPU exhaustion) | vuln | upgrade ≥0.26.1 | transitive via iroh DNS |
| RUSTSEC hickory-proto (NSEC3 unbounded loop) | vuln | **no fix available** | will require an `ignore` w/ justification until upstream fix |
| RUSTSEC lru (`IterMut` Stacked-Borrows UB) | vuln | upgrade | transitive |
| RUSTSEC-2026-0097 rand (unsound w/ custom logger + `rand::rng()`) | unsound | none | cadence does not use that pattern |
| atomic-polyfill, backoff, instant, paste | unmaintained ×4 | n/a | informational warnings |

**Owner action:** open a `chore(cadence): rust security dependency upgrade` PR that bumps the
`iroh`/`rustls` stack, runs `cargo check` + `cargo test` against the dep containers, and adds a
`services/cadence/.cargo/audit.toml` `ignore` list (with justification) for any residual
no-fix-available advisory. Until then this job stays red and is a known, scoped exception.

## Process

When CI reports a new advisory not in this table, the team must either:
1. Update the dependency to a non-vulnerable version, OR
2. Add it to this table with rationale before merging

The security CI job (`quality.yml:security`) will block merges on unacknowledged new advisories.
