# Security Advisories — Accepted Baseline

Last audited: 2026-06-13

This document records known advisories that have been triaged and accepted as part of the operational risk baseline. Accepted advisories are re-evaluated on each `bun audit` run in CI.

> **2026-06-13 re-audit.** Dependency upgrades since the 2026-05-19 baseline
> cleared most of the previously-accepted advisories — most notably
> `better-auth` 1.4.2 → **1.6.11** (resolves all six `better-auth <1.4.2`
> advisories, including the "critical 2FA bypass via premature session
> caching"), plus `hono`, `drizzle-orm`, `happy-dom`, `dompurify` (via
> `@scalar`), `nodemailer`, `ws`, `kysely`, `fast-uri`, `fast-xml-builder`,
> `brace-expansion`, and `swiper`. A fresh `bun audit` now reports only the
> four advisories below — all dev/build-tooling, none in the production
> runtime path. `bun audit` is the live source of truth; this table is the
> accepted subset.

## Accepted Advisories

| ID | Package | Severity | Description | Rationale | Accepted |
|----|---------|----------|-------------|-----------|----------|
| GHSA-w7jw-789q-3m8p | shell-quote >=1.1.0 <=1.8.3 | critical | `quote()` does not escape newlines in object `.op` values | Transitive via `@scalar/api-reference` (the `/docs` API-reference UI — dev/docs tooling). `@scalar` does not build shell commands from untrusted input; not in the production data path. Upgrade when `@scalar` releases a fix. | 2026-06-13 |
| GHSA-qx2v-qp2m-jg93 | postcss <8.5.10 | moderate | XSS via unescaped `</style>` in CSS Stringify output | Build-time CSS tool (transitive via the frontend build stacks — `next`/`vite`/`tailwindcss`/`autoprefixer`). PostCSS runs at build, never serves attacker-controlled CSS at runtime. Upgrade when the build deps pin postcss >=8.5.10. | 2026-06-13 |
| GHSA-gv7w-rqvm-qjhr | esbuild >=0.17.0 <0.28.1 | high | Missing binary integrity verification in esbuild's **Deno** module enables RCE via `NPM_CONFIG_REGISTRY` | Build toolchain only (transitive via `drizzle-kit`/`vite`/`esbuild`). This repo runs on Bun, not Deno; the Deno install path is never used. Upgrade tracked (blocked by toolchain version constraints). | 2026-06-13 |
| GHSA-g7r4-m6w7-qqqr | esbuild >=0.17.0 <0.28.1 | low | esbuild allows arbitrary file read when running the dev server on Windows | Dev-server-only vulnerability; not present in production builds. Upgrade tracked with the high advisory above. | 2026-06-13 |

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
