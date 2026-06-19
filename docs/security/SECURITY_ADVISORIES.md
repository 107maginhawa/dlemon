# Security Advisories — Accepted Baseline

Last audited: 2026-06-19

This document records known advisories that have been triaged and accepted as part of the operational risk baseline. Accepted advisories are re-evaluated on each `bun audit` run in CI.

> **2026-06-16 re-audit.** `bun audit` surfaced **6 newly-published advisories**
> since the 2026-06-13 baseline (the lockfile is unchanged — these are new
> upstream advisory publications, so they began failing the `Security Audit`
> gate on every branch + `main`). All 6 are **dev/build-tooling, none in the
> `api-ts` production runtime path** (the API ships on Bun/Hono, not vite/esbuild/
> babel): vite dev-server (`fs.deny` bypass + launch-editor UNC, Windows-only),
> `@babel/core` build-time source-map read, `js-yaml` config-parse DoS, `tar`
> install-time extraction, and `form-data` (transitive; the API uses native
> `fetch`/Hono and never builds outbound multipart from attacker-controlled
> field names). Triaged + accepted below; package upgrades are a tracked
> follow-up (a `bun update` of vite/tar/form-data clears most, deferred to a
> dedicated dependency PR to avoid lockfile churn in unrelated work).

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

> **2026-06-19 re-audit.** Two newly-published advisories since 2026-06-16 (lockfile
> unchanged): `dompurify` `GHSA-cmwh-pvxp-8882` (moderate, transitive via `@scalar`
> docs UI — same surface as the existing dompurify rows) and `nodemailer`
> `GHSA-p6gq-j5cr-w38f` (high). The dompurify advisory is triaged + accepted below.
> **nodemailer is RESOLVED** (not accepted): a direct production-path dep, so it was
> upgraded rather than triaged — `nodemailer` **8.0.10 → 9.0.1** (`@types/nodemailer`
> 7→8). The `sendMail` call only ever used `{from,to,subject,html,text,replyTo}`, but
> the upgrade removes the vulnerable surface entirely. Covered by the 42 email-handler
> tests + the contract auth-email round-trip (Mailpit) scenarios.

## Accepted Advisories

| ID | Package | Severity | Description | Rationale | Accepted |
|----|---------|----------|-------------|-----------|----------|
| GHSA-w7jw-789q-3m8p | shell-quote >=1.1.0 <=1.8.3 | critical | `quote()` does not escape newlines in object `.op` values | Transitive via `@scalar/api-reference` (the `/docs` API-reference UI — dev/docs tooling). `@scalar` does not build shell commands from untrusted input; not in the production data path. Upgrade when `@scalar` releases a fix. | 2026-06-13 |
| GHSA-qx2v-qp2m-jg93 | postcss <8.5.10 | moderate | XSS via unescaped `</style>` in CSS Stringify output | Build-time CSS tool (transitive via the frontend build stacks — `next`/`vite`/`tailwindcss`/`autoprefixer`). PostCSS runs at build, never serves attacker-controlled CSS at runtime. Upgrade when the build deps pin postcss >=8.5.10. | 2026-06-13 |
| GHSA-gv7w-rqvm-qjhr | esbuild >=0.17.0 <0.28.1 | high | Missing binary integrity verification in esbuild's **Deno** module enables RCE via `NPM_CONFIG_REGISTRY` | Build toolchain only (transitive via `drizzle-kit`/`vite`/`esbuild`). This repo runs on Bun, not Deno; the Deno install path is never used. Upgrade tracked (blocked by toolchain version constraints). | 2026-06-13 |
| GHSA-g7r4-m6w7-qqqr | esbuild >=0.17.0 <0.28.1 | low | esbuild allows arbitrary file read when running the dev server on Windows | Dev-server-only vulnerability; not present in production builds. Upgrade tracked with the high advisory above. | 2026-06-13 |
| GHSA-fx2h-pf6j-xcff | vite >=7.0.0 <=7.3.4 | high | `server.fs.deny` bypass via Windows alternate data-stream / absolute paths | Vite is the **frontend dev server** — never shipped to production. The bypass requires the dev server reachable on Windows. Not in the `api-ts` runtime path. Upgrade vite ≥7.3.5 (tracked dep PR). | 2026-06-16 |
| GHSA-v6wh-96g9-6wx3 | vite (launch-editor) >=7.0.0 <=7.3.4 | moderate | `launch-editor` NTLMv2 hash disclosure via UNC path on Windows | Dev-only "open in editor" feature of the vite dev server; absent from production builds. Windows-only. Upgrade with the vite advisory above. | 2026-06-16 |
| GHSA-hmw2-7cc7-3qxx | form-data <2.5.6 \|\| >=4.0.0 <4.0.6 | high | CRLF injection via unescaped multipart field names | Transitive (test/build tooling). The API uses native `fetch` + Hono and does not construct outbound multipart bodies from attacker-controlled field **names**; inbound uploads go through Hono/MinIO presigned URLs. Upgrade form-data ≥4.0.6 (tracked dep PR). | 2026-06-16 |
| GHSA-h67p-54hq-rp68 | js-yaml <=4.1.1 | moderate | Quadratic-complexity DoS in YAML merge-key (`<<`) handling via repeated aliases | Build/config-time YAML parsing (transitive dev tooling); the API does not parse attacker-controlled YAML at runtime. Upgrade tracked. | 2026-06-16 |
| GHSA-4x5r-pxfx-6jf8 | @babel/core <=7.29.0 | low | Arbitrary file read via `sourceMappingURL` comment | Build-time transpiler (transitive via the FE build stacks); resolves source maps at build, never on attacker-controlled input at runtime. Upgrade tracked. | 2026-06-16 |
| GHSA-vmf3-w455-68vh | tar <=7.5.15 | moderate | node-tar applies PAX size override to intermediary GNU long-name/long-link headers | Install/build-time archive extraction (transitive); not used to extract attacker-controlled tarballs at runtime. Upgrade tar ≥7.5.16 (tracked dep PR). | 2026-06-16 |
| GHSA-vxr8-fq34-vvx9 | dompurify <3.4.9 | low | Trusted Types policy survives `clearConfig()` and can poison later sanitization | Transitive via `@scalar/api-reference` (the `/docs` UI — dev/docs tooling). Low severity, niche config interaction; the app does not call `clearConfig()` in a way that crosses trust boundaries. Upgrade dompurify ≥3.4.9 with the `@scalar` bump (tracked). | 2026-06-16 |
| GHSA-gvmj-g25r-r7wr | dompurify >=3.0.0 <=3.4.7 | low | `SAFE_FOR_TEMPLATES` bypass — template expressions survive sanitization | Transitive via `@scalar/api-reference`. Low severity; only affects callers using `SAFE_FOR_TEMPLATES` mode, which this app does not. Upgrade dompurify ≥3.4.8 with the `@scalar` bump (tracked). | 2026-06-16 |
| GHSA-cmwh-pvxp-8882 | dompurify <=3.4.10 | moderate | Permanent `ALLOWED_ATTR` pollution via `setConfig()` bypassing the hook clone-guard | Transitive via `@scalar/api-reference` (the `/docs` UI — dev/docs tooling), same surface as the two dompurify rows above. The API does not sanitize attacker-controlled HTML through this dompurify instance at runtime. Upgrade dompurify ≥3.4.11 with the `@scalar` bump (tracked dep PR). | 2026-06-19 |
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
