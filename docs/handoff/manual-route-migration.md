# Handoff: migrate dental modules from manual routes → TypeSpec codegen (clears TR-DG-002)

> Paste the prompt below into a fresh session to continue. Saved 2026-06-01 so it survives a `/clear`.
> Starting point: branch `feat/ceph-demoable-and-manual-ux` (PR #1, head ~`0bc3a9cb`), suite 2905/0,
> data-governance backlog fully cleared + pushed.

---

Migrate the dentalemon dental modules from MANUAL route registration to the TypeSpec→codegen
pipeline so dental endpoints emit to the compiled OpenAPI and flow through generated routes.
(cwd /Users/eladventures/Desktop/dentalemon, branch feat/ceph-demoable-and-manual-ux — PR #1,
head ~0bc3a9cb, suite 2905/0.)

WHY: A full /oli-check flagged TR-DG-002 (P1) — dental HTTP paths are hand-mounted in
services/api-ts/src/app.ts via `(app as any).post/get(...)` + hand-written Zod validators, so
they NEVER reach the compiled specs/api/dist/openapi/openapi.json (only their component schemas
emit). This affects EVERY dental module (dental-audit's /dental/audit-events, the new
/dental/erasure-requests + /dental/legal-holds, patient contacts/recalls, fee-schedule, etc. —
the "~28 manual routes" from the Workspace Reconciliation plan). The SDK/frontend types can't see
these endpoints, and the spec↔code contract is broken. Goal: dental routes become codegen-driven
like the core modules (person/billing/etc.), the manual app.ts block shrinks/disappears, and
TR-DG-002 clears on the next /oli-check.

Out of scope: TR-INFRA-001 (empty engine spec-trace) lives in the oli-engine repo, NOT here.

═══════════════════════════════════════════════════════════
PHASE 0 — DIAGNOSE FIRST (do not assume the fix; this is the crux)
═══════════════════════════════════════════════════════════
Determine WHY dental .tsp operations don't emit paths to openapi.json, even though the modules
ARE imported in specs/api/src/main.tsp and DO have @route/@get/@post/@operationId (see
specs/api/src/modules/dental-audit.tsp as the canonical example). Investigate:
1. main.tsp namespace structure: is there a `@service`/`@versioned(Versions)` top-level namespace,
   and are the dental `namespace DentalXModule` blocks INSIDE it or siblings/standalone? In
   TypeSpec, operations only emit as paths when reachable from the service namespace; models emit
   globally regardless. Compare a CORE module that DOES emit (e.g. person.tsp → /persons appears in
   openapi.json) vs a dental module that does NOT (audit-events absent). Diff their namespace
   nesting / decorators.
2. `cd specs/api && bun run build` — check tsp compile diagnostics/warnings for "unreferenced
   namespace" or operations being dropped.
3. services/api-ts/scripts/generate.ts — does it FILTER /dental paths, or only generate routes for
   operationIds whose handler file exists? (Note: registry grep for getAuditEvents returns nothing
   today.) Read filterNonAuthPaths + generateRoutes + generateRegistry + the module-dir derivation.
4. How core modules get wired: registerOpenAPIRoutes (from src/generated/openapi/routes.ts) is
   called in app.ts BEFORE the manual block; the manual block comment says it "shadows" generated
   routes (Hono matches first-registered) — confirm the actual precedence.

Write a short findings note (root cause + the exact mechanism). The fix depends entirely on this.

═══════════════════════════════════════════════════════════
PHASE 1 — SPIKE on ONE module (lowest-risk proof) before rolling out
═══════════════════════════════════════════════════════════
Pick the smallest/newest dental module — the **erasure** module is ideal (5 endpoints, isolated,
already has dental-erasure.tsp + hand-written validators + handlers + 6 route tests). Make ITS
paths emit to openapi.json and flow through the generated route/registry pipeline:
- Apply the Phase-0 fix (e.g. nest the namespace under the service namespace, or adjust generate.ts
  so dental operationIds map to the existing handler files).
- The handlers already exist (requestErasureHandler etc.) — wire them so codegen routes them
  (operationId→handler in registry.ts), then REMOVE the manual `(app as any)` erasure routes from
  app.ts. Keep the hand-written validators only if the generated zValidators don't cover them
  (TypeSpec generates z.number().int() for int path params — the documented reason some routes were
  manual; preserve those overrides where needed).
- Verify: erasure paths now in openapi.json; erasure-routes.test.ts still green (adapt if the test
  asserted the manual wiring); boot-smoke shows the routes 401 (not 404); check:boundaries 0.
If the spike reveals the migration is riskier/larger than expected (e.g. the int-param shadowing
issue is pervasive), STOP and report with options rather than forcing it.

═══════════════════════════════════════════════════════════
PHASE 2 — ROLL OUT module by module (only after the spike proves the pattern)
═══════════════════════════════════════════════════════════
Migrate the remaining dental modules ONE AT A TIME (own commit each): legal-hold, dental-audit,
dental-patient (contacts/recalls/alerts/occlusion/tasks), dental-org (branches/fee-schedule),
dental-visit, dental-billing, dental-imaging, dental-clinical, dental-pmd, dental-scheduling,
dental-perio. For each: ensure the .tsp operations emit, handlers map via registry, remove the
corresponding manual app.ts registrations (keep only genuine int-param overrides with a comment),
keep that module's tests + boot-smoke green. Use parallel agents/worktrees per module where the
work is independent — but each must run its own full verify before you integrate.

PROCESS: Vertical TDD discipline; small reversible commits; re-run codegen fully (`cd specs/api &&
bun run build && cd services/api-ts && bun run generate`) — do NOT hand-edit generated files.
Watch for the consent-revoke-style codegen risk (run a review before large regens).

VERIFY GATE (each module + at the end): `cd services/api-ts && DATABASE_URL='postgresql://postgres:
password@localhost:5432/monobase_test' bun run test` stays green (currently 2905/0) + `bun run
typecheck` + `bun run check:boundaries` (0) + boot-smoke the migrated routes (401 not 404) +
confirm each migrated path now appears in specs/api/dist/openapi/openapi.json. FINALLY: refresh the
map (`node $OLI_ENGINE_HOME/dist/cli.js scan . --write`) and run `/oli-check --traceability` —
confirm **TR-DG-002 is cleared** (dental paths now in OpenAPI). Commit per module on
feat/ceph-demoable-and-manual-ux; push when the user asks.

CONTEXT/GROUNDING TO READ: services/api-ts/src/app.ts (manual route block ~lines 175-330),
specs/api/src/main.tsp, specs/api/src/modules/dental-*.tsp (esp. dental-audit.tsp + dental-erasure.tsp),
services/api-ts/scripts/generate.ts, src/generated/openapi/{routes,registry,validators}.ts,
docs/audits/CHECK_SUMMARY.md (TR-DG-002), and the memory notes project_workspace_reconciliation +
project_deferred_p1_backlog + feedback_verify_gate_boundaries. NOTE: dental modules use
ValidatedContext<Body,Query,Param> handlers + `ctx.req.valid('json'|'query'|'param')`; RBAC is
in-handler (user.role checks / assertBranchRole), not middleware.
