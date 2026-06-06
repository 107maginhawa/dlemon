# `retention/` — internal data-governance library (no HTTP API)

This module is **not an API module**. It intentionally exposes **no routes** and has
**no TypeSpec** — so it correctly does not appear in `src/generated/` route registry.
Don't mistake the absence of routes for an unwired gap (see Invariant 3 in
[ARCHITECTURE.md](../../../../../docs/architecture/ARCHITECTURE.md#architecture-invariants)).

It is a library + background-jobs module consumed internally:

- **`registerRetentionJobs(scheduler)`** (`jobs/index.ts`) — registers the scheduled
  retention/erasure jobs. Wired from `src/app.ts` at startup.
- **`seedDefaultRetentionPolicies(db, orgId, …)`** (`retention-defaults.ts`) — seeds a
  new organization's default data-retention policy registry. Called from
  `dental-org/createOnboarding.ts` during org provisioning (best-effort).
- **`retention-engine.ts` / `retention-targets.ts`** — the policy-evaluation engine
  and target resolution used by the jobs.
- **`repos/retention-policy.{schema,repo}.ts`** — the `retention_policy` table + repo.

If you need to expose any of this over HTTP, add a TypeSpec operation in the
appropriate `dental-*` module and call into this library from that handler — do not
add routes here.
