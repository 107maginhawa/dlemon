---
name: verify-app
description: Run the on-demand end-to-end verification system (`bun run verify:app`) and summarize the verdict. Aggregates the computed coverage gates (Tier 0) and the real-stack functional proof (Tier 1) into one VERDICT.md. Use before merging, before a release, or when asked to prove the app actually works for users.
---

# verify-app

A thin wrapper over `bun run verify:app` (orchestrator at `scripts/verify-app.ts`). It runs the tiered verification system locally/on-demand and reports a single verdict.

**verify-app aggregates the existing CI gates — it does not replace them.** It proves "works for users" by running the real-stack Tier-1 proof, not by reporting green unit/coverage numbers.

## Triggers

- Before merging a PR (pre-merge confidence in one command)
- Before a release
- When asked to "verify the app", prove the shipped surface works, or check what's untested
- After a multi-module change, to catch systemic regressions the per-skill gates miss

## What it runs

- **Tier 0 — Computed gates** (seconds): typecheck, lint, the 6 coverage matrices via `coverage:all:ci` (role-op drift **HARD**; endpoint/FSM/workflow/fe-route **ratchet**; `br` **report-only**), module-boundaries, and the legacy P0-BR traceability gate (`audit:trace:ci`, a fixed subset — see caveats below). Set-diffs over the machine-readable sources — computes what's untested and ratchets it.
- **Tier 1 — Functional proof** (3–5 min): FE unit + coherence tests, and — **when the api-ts stack is reachable on `:7213`** — the core Hurl contract suite + the journey harness. This is the real-stack proof that the wired surface works.
- **Tier 2 — Deep e2e** (`--deep`, ~tens of min): the broad Playwright sweep (chromium + iPad, ~70 specs) against the live stack. Opt-in; **requires** the stack. The *adversarial* Tier-2 (mutation / skeptic fan-out / persona walks) is still Phase 3.

It writes one verdict file: `docs/testing/coverage/VERDICT.md`.

## Workflow

### 1. (Optional) boot the real stack for Tier 1 / required for `--deep`

For the full Tier-1 proof (contract + journeys), have the API reachable on `:7213`:

```bash
cd services/api-ts && bun dev   # listens on 7213 (auto-migrates on boot)
```

If the stack is not reachable, Tier 0 still runs fully and Tier 1 runs the stack-independent steps (FE unit/coherence); the contract + journey steps are reported as **skipped** (default) or **failed** (`--require-stack` / `--deep`).

**verify-app is an aggregator — it does NOT boot infra or seed.** Bring the stack up yourself.

#### Boot the full stack for `--deep` (or `--require-stack`)

The `--deep` e2e sweep needs Postgres + MinIO + a seeded demo DB. Boot it once (per `CONTRIBUTING.md`):

```bash
cd specs/api && bun run build && cd ../..   # generate openapi.json (API imports it at runtime)
bun run infra:up                            # Postgres + MinIO via docker (the API's /readyz needs both)
cd services/api-ts && bun dev               # api-ts on :7213, auto-migrates — leave running
# in another terminal, from the repo root, once :7213 is up:
bun run db:reseed                           # seed demo data over HTTP (needs API + MinIO up)
```

Then run the proof:

```bash
bun run verify:app:strict   # --ci --require-stack: Tier 0+1, functional proof MANDATORY
bun run verify:app:deep     # --ci --deep: also the broad Playwright e2e sweep (chromium + iPad)
```

The journey-harness step reseeds the DB itself just before it runs; the broad e2e sweep then reuses that seeded stack (its Playwright `webServer` reuses the api-ts on `:7213` and boots the Vite app on `:3003`).

### 2. Run verify-app

```bash
bun run verify:app        # Tier 0 + Tier 1, report mode
bun run verify:app:ci     # same, exits non-zero on any blocking-gate failure
bun run verify:app:strict # --ci --require-stack: the functional proof is MANDATORY
```

**Default mode is skip-tolerant:** when the api-ts stack is not reachable on `:7213`, the
stack-dependent Tier-1 steps (`contract-core`, `journey-harness`) are reported **SKIP** and
the overall verdict can still be **PASS**. That is intentional for CI-without-a-stack — but
it means a green default verdict on a stackless box proves **zero** functional/e2e.

**`--require-stack` (strict mode) closes that false-green:** a would-be SKIP becomes a
**blocking FAIL**, so a skipped functional proof is never green. Use `verify:app:strict`
(or `--require-stack`) when you want the verdict to be the real *"works end-to-end"* claim —
boot the stack first (step 1), or it will (correctly) go red.

`--deep` (or `bun run verify:app:deep`) folds in the **broad Playwright e2e sweep**
(chromium + iPad, ~70 specs) against the live stack — the full pre-release proof. It is
**not** in the default button because it is slow (`workers:1`) and ceph/MinIO-fragile; the
stabilized journey harness is the default proxy. `--deep` **IMPLIES `--require-stack`**: it
probes and REQUIRES the stack on `:7213` and goes red (clear FAIL) if it is down — so you
must boot the full stack first (see *Boot the full stack for --deep* below).

verify-app is an **aggregator, not a provisioner** — it does **not** boot Postgres/MinIO/seed
for you. The Tier-2 *adversarial* sweep (mutation, skeptic fan-out, persona walks) is still
**Phase 3** (not yet wired).

### 3. Read and summarize the verdict

After the run, READ `docs/testing/coverage/VERDICT.md` and report:

- The **per-step PASS/FAIL table** (each Tier 0 / Tier 1 step and whether it passed, failed, or was skipped).
- The **overall verdict**.
- **What to do next** for any failing or skipped step (e.g. boot `:7213` for skipped contract/journey steps; triage a RED matrix).

Then point the user at the committed coverage artifacts under `docs/testing/coverage/` for the gap detail:

- `role-op-matrix.md` — role×operation drift (HARD gate; drift is never allowlisted)
- `endpoint-matrix.md` + `orphan-disposition.md` — tested / gap / orphan endpoints
- `br-matrix.md` — business-rule traceability (report-only)
- `fsm-matrix.md` — state-machine edge coverage
- `workflow-matrix.md` — cross-module workflow coverage
- `fe-route-matrix.md` — frontend route coverage

## Gate policy

- **role-op drift** — HARD (must be 0; never allowlisted)
- **endpoint / fsm / workflow / fe-route** — RATCHET (allowlists can only shrink; new entries need a `reason` + sign-off)
- **br** — REPORT-ONLY (the 26 P0 traceability gaps are a triage backlog; `audit:trace:ci` remains the P0 gate)

## What this does NOT prove

A green verdict means the **wired/shipped** surface works and the computed gaps are ratcheted. It is **not** an adversarial audit (that is Tier 2 / Phase 3). When you report the verdict, carry these caveats — do not let "green" read as "nobody can break this":

- **Object-level IDOR · cross-tenant LIST leaks · secrets-in-logs · "inert" authz** (a permission computed but never enforced) are **not** detected here. The P0 cross-tenant patient-contact IDOR (fixed in #38) passed every Tier-0/1 gate.
- **Not all P0 BRs are traced.** `br-traceability` runs the legacy fixed-subset gate (`audit:trace:ci`), not the 48 computed P0 BRs — **26 of 48 are untraced** (IDOR / erasure / legal-hold among them; see `br-matrix.md`).
- **role-op "0 drift" is true-but-narrow** — only ~28 of ~110 role-gated ops are expressible in the spec matrix tables; "0 drift" means no contradiction among the joinable subset, not "all 110 verified".
- **Per-endpoint test breadth is partial** — the endpoint matrix's *integration*/*journey* columns read a gitignored `COVERAGE_RECORD` sink not populated in a normal pass, so a "tested" disposition can rest on the *contract* column alone.
- **~180 orphan endpoints** (built, no FE consumer — incl. payments / erasure / legal-hold) are tracked in `orphan-disposition.md`, not exercised.

(The VERDICT.md it generates ends with this same "What this verdict does NOT prove" block.)

## When NOT to use this skill

- For a single layer in isolation → use the focused skill (`/typecheck`, `/test-api`, `/test-contract`, `/test-e2e`).
- To regenerate one matrix → `bun run coverage:<name>` (e.g. `coverage:roles`, `coverage:endpoints`).

## Reference

- Orchestrator: `scripts/verify-app.ts` (`bun run verify:app` / `verify:app:ci`)
- Verdict: `docs/testing/coverage/VERDICT.md`
- Coverage artifacts: `docs/testing/coverage/*-matrix.md` + `*.allowlist.json`
- Coverage engine: `scripts/coverage/run-all.ts` (`bun run coverage:all[:ci]`)
- Program intent + tiers: `docs/testing/VERIFY_APP_PLAN.md`
