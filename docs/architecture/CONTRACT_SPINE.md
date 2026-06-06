# The Contract Spine — cross-layer wiring map for AI/agents

A feature in this codebase is a **vertical slice**:

```
TypeSpec operation (@operationId)
        │  bun run generate  (codegen)
        ▼
generated route  ──►  backend handler (services/api-ts/src/handlers/…)
        │
        ▼
OpenAPI operation  ──►  generated SDK hook (@monobase/sdk-ts: <op>Options / <op>Mutation)
        │
        ▼
frontend consumer (apps/dentalemon/src/features/…)
```

The import-only knowledge graph (`/understand`) **cannot see most of this spine**:
handlers are bound to routes by the generated registry keyed on `@operationId`, not
by a source import. So in a raw graph, 350+ wired handlers look like orphans and there
is no edge tying a screen to the endpoint it calls.

`scripts/build-contract-spine.ts` reconstructs the spine deterministically from the
generated artifacts and (a) writes a machine-readable `contract-spine.json`, and
(b) injects it into the knowledge graph.

## Regenerate

```bash
# 1. (optional) rebuild the LLM knowledge graph — only when structure changed a lot
/understand                       # or: bunx understand-anything ...  (hours; LLM pass)

# 2. derive + inject the contract spine — fast, deterministic post-step
bun run scripts/build-contract-spine.ts
```

Step 2 is idempotent (it prunes prior `operation` nodes/edges first) and safe to run
any time after a codegen (`cd specs/api && bun run build` → `cd services/api-ts &&
bun run generate`) or SDK regen. It does **not** require step 1.

## Outputs

**`.understand-anything/contract-spine.json`** (git-ignored, regenerable) — one entry
per operation:

```json
{
  "operationId": "getCasePresentation",
  "method": "GET",
  "path": "/dental/patients/{patientId}/case-presentations/{presentationId}",
  "handler": "services/api-ts/src/handlers/dental-patient/case-presentation/getCasePresentation.ts",
  "sdkHooks": ["getCasePresentationOptions", "getCasePresentationQueryKey"],
  "consumers": ["apps/dentalemon/src/features/case-presentation/use-case-presentation.ts"]
}
```

**Knowledge-graph injection** — adds `operation` nodes plus:
- `handler ──implements_operation──► operation` (every wired handler now has this edge,
  so the "orphan handler" false-positive disappears),
- `operation ──operation_consumed_by──► feature file` (the FE↔BE contract edge).

Latest run: **352 operations**, all 352 bound to a handler, 344 with generated SDK
hooks, 76 with frontend consumers. (The 8 without a detected SDK hook are PMD/EMR
operations whose acronym casing — `importPMD` vs the SDK's `importPmd` — defeats the
camelCase join; they are still served and consumed, just not auto-linked here.)

## How an agent adds a new module/feature with this

1. Look up (or plan) the `@operationId` and its slice in `contract-spine.json`.
2. Follow the per-module 10-step Vertical TDD sequence in
   [VERTICAL_TDD.md](../development/VERTICAL_TDD.md): TypeSpec → generate → backend
   test → handler → contract test → SDK regen → frontend test → consume the generated
   hook → E2E.
3. Honor the [architecture invariants](./ARCHITECTURE.md#architecture-invariants):
   SDK-only data access on the client, codegen wiring on the server.
4. Re-run `bun run scripts/build-contract-spine.ts` to refresh the spine.
