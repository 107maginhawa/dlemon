# `@monobase/api-ts-embedded`

Embedded runtime for the `@monobase/api-ts` server, packaged for use inside
the `apps/account/src-tauri` desktop wrapper. Bundles the Hono app plus its
dependencies into a single JS file and runs it inside a QuickJS engine
embedded in Rust. The result: the same TypeScript API code runs both as a
standalone Node/Bun server (via `services/api-ts`) and inside a desktop app
without a network round-trip.

## Layout

- `src-js/` — JavaScript entry points and bundling logic. Bundled by
  `esbuild` into a single artifact (with `unenv` providing Node.js shims
  the QuickJS engine doesn't ship natively).
- `src/` — Rust glue. Hosts the QuickJS engine, exposes a synchronous
  request/response interface to the desktop frontend, and brokers calls
  between JS handlers and the Rust-side database/storage backends.
- `build.rs` — runs the JS bundle as part of `cargo build`.
- `Cargo.toml` — Rust crate metadata; consumed by
  `apps/account/src-tauri` as a workspace dependency.
- `package.json` — declares the workspace dep on `@monobase/api-ts` and
  the bundling tooling. No npm publish target.

## Usage

This crate is consumed by the Tauri wrapper at
`apps/account/src-tauri/Cargo.toml` and is not invoked directly by users.

To rebuild the JS bundle and Rust crate together (from the repo root):

```bash
cargo build --manifest-path services/api-ts-embedded/Cargo.toml
```

The Tauri build will pick up changes automatically when running:

```bash
cd apps/account && bun run tauri:dev
```

## Why this exists

`apps/account` is offline-first: when the user has no network, requests
should hit a local instance of the API rather than fail. `api-ts-embedded`
makes that possible by giving the desktop wrapper a private copy of the
server that shares the same handler code as the production API. Sync to
the network-side cluster is handled separately by `services/cadence`.
