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
- **`retention-status.ts`** (G2 observability) — `summarizeRetentionEnforcement(db, tenantId?)`
  derives an operator-visible enforcement status from the `retention.*` compliance
  audit events the engine writes: `lastRunAt`, `lastRunMode` (`enforced` | `dry-run` |
  `null` = never run), `runsObserved`, and the last run's `eligible`/`actioned` counts,
  plus `enforcementEnabled` (the live `RETENTION_ENFORCEMENT_ENABLED` posture). This is
  the trust/observability primitive — a clinic can confirm whether archival is actually
  running and in which mode without DB/env access. Surfacing it in an admin panel is
  **G1 (deferred)**; the data is ready here.

### Go-live posture (enforcement attestation)

Enforcement is **dry-run by default** (`RETENTION_ENFORCEMENT_ENABLED` unset). This is
the correct safety stance: records are never archived until an operator has reviewed the
seeded per-jurisdiction defaults and explicitly opted in. To go live for a deployment:
1. Review the policy registry (`dental_retention_policy`) against your jurisdiction.
2. Confirm dry-run output via the status summary (`lastRunMode: 'dry-run'`, expected
   `eligible` counts) — proving the cron is acting on the intended records.
3. Set `RETENTION_ENFORCEMENT_ENABLED=true`; re-confirm via the status summary
   (`lastRunMode: 'enforced'`, `actionedCount > 0` once eligible records exist).

If you need to expose any of this over HTTP, add a TypeSpec operation in the
appropriate `dental-*` module and call into this library from that handler — do not
add routes here.
