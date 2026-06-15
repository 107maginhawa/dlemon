# verify-app — repeatable end-to-end verification system

> **Status tracker (committed on purpose).** Durable, openable status of the multi-PR effort
> to build one re-runnable verification system so human QA stops finding systemic bugs.
> Update the checkboxes as phases land. Pause → resume from the first unchecked box.
> Recorded 2026-06-15. Plan: `~/.claude/plans/if-you-are-an-soft-planet.md`.

**Goal:** One command (`bun run verify:app` + `/verify-app` skill) that proves the wired/shipped
surface works end-to-end and **computes + ratchets** every gap. Replaces the prior AHA pipeline's
slow, manual, prose audit with a fast, deterministic, parallel system.

**The reframe:** AHA *discovered* gaps by hand (15 sequential rounds, prose `MASTER-GAP-MATRIX.md`
that can't be re-run, stalled on 24 product decisions). This *computes* them as a set-diff over the
machine-readable sources we already have (`contract-spine.json`, `br-registry.json`, `*_TRANSITIONS`
enums, `ROLE_PERMISSION_MATRIX.md`, `WORKFLOW_MAP.md`), and turns AHA's adversarial battery into
automated parallel probes.

**Coverage bar:** *cover-what-ships + compute-the-rest.* Everything wired/shipped is covered +
adversarially verified; orphan / deferred / decision-gated gaps are computed and **allowlisted with a
reason** (visible, not blocking). NOT chasing the 109 leftover AHA gaps — those are product work.

**Honest ceiling:** drives the *escape rate* (bugs QA finds ÷ total) toward near-zero for the **known**
bug classes; every escaped bug ratchets a new oracle. Not literal zero bugs.

**Out of scope:** Tauri/`api-ts-embedded`, `cadence` offline-sync, `apps/website`. Targets the web
product (`apps/dentalemon` + `services/api-ts`).

## Tiers (each independently invokable)

| Tier | When | Proves | Budget |
|------|------|--------|--------|
| **0 — Computed gates** | every commit (CI) | what's untested (set-diff) + ratchet | seconds |
| **1 — Functional proof** | pre-merge / on-demand | the wired surface works for users now | 3–5 min |
| **2 — Adversarial sweep** | pre-release / weekly | tests non-vacuous + nobody can break it + affordances real | 15–30 min (parallel) |
| *3 — (deferred)* | — | auto-completeness-critic, QA-exit gate, escape-rate loop, J22+ journeys | — |

`bun run verify:app` = Tier 0 + 1 (+ invokes the existing 16 CI gates); `--deep` adds Tier 2.

## Governance (anti-drift)
1. **One phase, one PR, fully merged before the next** (the Stop-the-Drift discipline).
2. **Committed tracker, not memory** — this file.
3. **Allowlists can only shrink** — every `*.allowlist.json` entry carries a `reason`; new entries need
   explicit human sign-off in the PR. Role↔spec **drift is never allowlisted**.
4. **Non-vacuity is proven, not assumed** — reverting a historical fix must turn a matrix/probe RED.

## Progress

### Phase 1 — Highest-ROI bug discovery + computed engine
- [x] **1a — Role×operation drift detector. ✅ DONE** (`scripts/coverage/role-op-matrix.ts`, 21 unit
      tests; `bun run coverage:roles[:ci]`, `--check` hard-fails on any drift — drift is never
      allowlisted). Scanned **110 role-gated ops**, found **3 drifts → triaged to 0**:
      - **Real authz bug FIXED** (`fix(authz)` `65df7636`): the wired `initializeDentition` blocked
        `dental_assistant` (spec + sibling `updateTooth` grant it); a **dead duplicate handler** held the
        correct roles. Fixed the wired handler, deleted the duplicate. **Also exposed a vacuously-green
        test** (`dental-assistant.clinical-assist.test.ts` asserted assistant→201 against the DEAD
        handler) — retargeted to the canonical path (the "false-green test wiring" class, caught by a
        *computed* check).
      - **2 detector false-positives** (`dc00767b`): the spec's summary *tables* can't express
        `treatment_coordinator` (case-presentation) or the hygienist E3 check-in, but the *prose* grants
        them and code matches → modeled as cited `PROSE_DOCUMENTED_GRANTS` (spec-completion, not
        allowlisting). Drift = 0.
      - **Visibility for later:** 82 of 110 gated ops are not in the spec matrix tables (the matrix
        documents 28). Not drift; "compute-the-rest" backlog for spec coverage.
      - **Blocking CI gate** for role drift lands with the unified `coverage-ratchet` job in 1c (it needs
        `contract-spine.json` regenerated in CI; `.understand-anything/` is gitignored).
- [x] **1b — Schemathesis shadow→blocking. ✅ DONE** (PR#36). Blocking profile
      (`--checks not_a_server_error,status_code_conformance --suppress-health-check=filter_too_much
      --max-examples 15`) over all ~372 ops, wired as a new BLOCKING `contract.yml` step
      (`test:contract:fuzz:blocking`; runner env-parameterized); the full-check shadow run stays
      advisory. Triage of the local run: **0 `not_a_server_error` (5xx)** — no impl bug of that class.
      All 34 `status_code_conformance` failures were a single **spec↔impl drift** (computed, not hunted):
      the entire `dental-imaging` module (33 ops) returned `401` but declared only success codes — it
      used a status-less `| ErrorResponse` that collapsed into the **200 body** — and `recoverPin`
      returned `401` while the spec marked it **public**, despite the handler *requiring* auth
      (CF-39/AUTH-03, an anti-brute-force guard on the security-question reset). Fixed in TypeSpec:
      appended `| ApiUnauthorizedResponse` to the imaging ops (kept the 200 body intact → zero
      SDK/FE success-type change), and added `@useAuth(bearerAuth)` + 401 to `recoverPin` (it now
      carries the same route-level `authMiddleware({roles:["user"]})` its siblings always had —
      a real security-doc fix). Regenerated routes/SDK + one behavior-preserving FE widening
      (`use-ceph-superimposition.ts`: the SDK now types the 401 error concretely). Proof: 23.5k fuzz
      cases pass / 0 failures; typecheck + lint green; 45 dental-org auth tests + 404 FE imaging tests green.
      The 3 schemathesis "errors" were its OWN data-generation health checks (tight input regex on 3 ops),
      suppressed via `filter_too_much` so they can't fail the gate on a non-impl issue.
- [x] **1c — Computed coverage engine + 6 matrices. ✅ DONE** (built via a 5-way parallel agent
      fan-out on the `scan-tests`+`ratchet` foundation; 172 engine unit tests). Each matrix = a
      deterministic set-diff over a machine-readable source → committed artifact + seeded
      `*.allowlist.json` (ratchet; allowlists only shrink). `coverage:all[:ci]` (`run-all.ts`) is the
      single entry; new **`Coverage Ratchet` CI job** regenerates the contract spine offline then
      enforces the gates. Findings (the "compute-the-rest" inventory):
      - **endpoint**: 369 ops → 134 tested / 23 gap / **212 orphan** (built, no FE consumer →
        `orphan-disposition.md` wire/remove backlog, NOT test-ratcheted). Env-gated `COVERAGE_RECORD`
        recorder in `test-app.ts` + journey client (strict no-op when unset; fixed a journey-sink off-by-one).
      - **br**: 122 BRs, severity from `type` (P0 48/P1 36/P2 38) → 82 fully / 4 positive-only / 36 untested.
        **REPORT-ONLY**: 26 P0s are *traceability* gaps (tested but BR code untagged) needing triage — hard
        P0 gate deferred; `audit:trace:ci` stays the P0 gate meanwhile.
      - **fsm**: 8 FSMs, 136 edges → 30 uncovered (Visit + Ceph weakest). **workflow**: 84 (16 cross-module)
        → 27 gap, 0 dangling. **fe-route**: 23 routes → 3 gaps (patient portal).
      - Gate policy: role-op drift HARD (0); endpoint/fsm/workflow/fe-route RATCHET; br report-only.
      - **`Coverage Ratchet` CI gate is NOT-yet-required** — admin adds to branch protection (like the
        RLS Posture / Code-DB Drift gates). Follow-ups: triage the 26 P0 BRs; render-smoke for fe-route;
        populate endpoint integration/journey columns by running suites under `COVERAGE_RECORD=1`.
- **Verification gate:** 6 matrices generate + commit; `coverage-ratchet` green; 0 un-triaged
      `drift:true`; Schemathesis-blocking green; **non-vacuity proof** (revert a historical fix on a
      scratch branch → a matrix/probe goes RED; re-apply → GREEN).

### Phase 2 — The repeatable button (Tiers 0–1) ✅ DONE (PR#37)
- [x] `coverage:*` scripts already existed (Phase 1c); added `verify:app` + `verify:app:ci`. **BE twin
      `assertEndpointTotalEqualsRepoSum`** (`services/api-ts/src/tests/helpers/coherence.ts`, the
      server-side mirror of FE `assertTotalExplainedByRows`) + 5 pure unit tests, wired into the
      **EM-BIL-002 `getArAging`** report test (summary total == Σ returned rows; mutation-proven RED).
- [x] **`scripts/verify-app.ts`** — orchestrator. Tier 0 (typecheck, lint, coverage-engine tests,
      `coverage:all:ci` regen+ratchet, module-boundaries, BR traceability) + Tier 1 (FE unit/coherence
      always; core Hurl contract + journey harness when api-ts is reachable on :7213) → one
      `docs/testing/coverage/VERDICT.md` (gitignored, per-run). `--ci` (non-zero on blocking fail),
      `--tier0`/`--tier1`, `--deep` (reserved → Tier 2/Phase 3). Aggregates the gates; does not duplicate them.
- [x] **`.claude/skills/verify-app/SKILL.md`** — thin wrapper: runs `verify:app`, summarizes VERDICT.md
      + points at the committed `*-matrix.md` gap reports.
- **Verification gate ✅:** full `bun run verify:app` against the **reseeded real stack** = 9/9 steps PASS
      (Tier-1 journey harness 17 passed/4 ceph-skipAllowed; core Hurl green; coherence oracles green;
      typecheck+lint+coverage-ratchet green). Skill returns a readable summary.

### Phase 3 — Adversarial deep sweep (Tier 2) — re-plan in detail at phase start
- [ ] Mutation spike + harness (4 critical module-classes; seed the 8 historical bugs; **0 surviving
      historical-bug mutants** is a hard gate) → `mutation-score.json`.
- [ ] 26-module **parallel** skeptic fan-out (AHA battery: cross-tenant 2-org, illegal-FSM, IDOR,
      role-reject+zero-rows-on-403, audit-row, validator-drift) → committed RED→GREEN pins; verdicts
      become `READY (refuted-and-survived)`.
- [ ] 4 per-role persona walks (Webwright/`/browse`) with adversarial briefs → pinned findings.
- [ ] Refresh `/understand-anything` knowledge graph; wire `understand-diff` into `/review`.
- **Verification gate:** mutation kills all seeded historical-bug mutants; skeptic fan-out across 26
      modules all `refuted-and-survived`; ≥1 clean persona walk per role (or filed pinned findings).

## Discipline
Verify "works for users" by running the real-stack proof (Tier 1) and the deep sweep (Tier 2) and
citing their artifacts — not by reporting green unit/coverage numbers as proof of function.

## Continuation & autonomy mandate (read this to resume)
**Status:** Phase 1a ✅ (PR#33) + Phase 1c ✅ (PR#34) + Task 1b ✅ (PR#36) + Phase 2 ✅ (PR#37) merged. **Phases 1–2 COMPLETE. Remaining: Phase 3.**

**Authority (when the user invokes this section): execute to the end autonomously — do NOT ask;
decide-and-proceed on every design call, document each decision in the PR + this tracker, and only
stop for a genuinely destructive or unrecoverably-ambiguous situation.** Fix clear bugs via TDD;
allowlist/report product-decision-gated findings rather than stalling (that is what sank the old AHA
pipeline). Give one consolidated report at the end (every bug found + every gate added).

**Order — one PR fully merged (all 16 required checks green) before the next; branch off latest main after each merge:**
1. **Task 1b** — Schemathesis shadow→blocking in `contract.yml` (`--checks not_a_server_error,status_code_conformance` over all 369 ops; spec-precision findings stay advisory). Triage 5xx: real → TDD fix; spec nit → allowlist.
2. **Phase 2** — `scripts/verify-app.ts` (Tier 0 `coverage:all:ci` + Tier 1 journey harness + coherence oracles + invoke the existing 16 gates → one `VERDICT.md`) + `.claude/skills/verify-app/` + generalize the `test-utils.ts` coherence oracles + a BE twin. Verify against the reseeded real stack.
3. **Phase 3** — adversarial deep sweep (re-plan bite-sized at phase start): mutation on the 4 critical module-classes (seed the 8 historical bugs; 0-survivors hard gate); the 26-module **parallel** skeptic fan-out (AHA battery → committed RED→GREEN pins, "refuted-and-survived"); 4 per-role persona walks; refresh the knowledge graph.

**How:** subagent-driven-development; parallelize independent work (disjoint-files+no-commit+integrate, OR worktree isolation); TDD; atomic commits; Co-Author `Claude Opus 4.8 <noreply@anthropic.com>`; explicit `git add`. Coverage-gate policy: **role-op drift HARD (never allowlisted), br report-only.** New api-ts tests use the shared `buildTestApp` (lint:test-harness blocks raw mounts). Backend tests: `DATABASE_URL=…monobase_test bun run scripts/test-with-db.ts <FILE>`; root coverage tests: `bun test ./scripts/coverage/`. **`TypeScript` required check is FLAKY** (transient TS2769) → cancel run + `gh run rerun <id> --failed`. LEAVE-ALONE: `bun.lock`, `.agents/`, `apps/website/`, `skills-lock.json`, `.claude/skills/design-taste-frontend`, `docs/aha/`.

**Already-decided (don't re-litigate):** cover-what-ships + compute-the-rest; Tier 3 deferred; br P0 hard-gate deferred (the 26 traceability gaps are a triage backlog); `Coverage Ratchet` not-yet-required (admin adds to branch protection). **Opportunistic follow-ups:** triage the 26 P0 BR gaps; fe-route render-smoke; populate endpoint integration/journey columns via `COVERAGE_RECORD=1`.

**Full context/gotchas:** memory `project_verify_app_2026_06_15.md`; detailed phased tasks: `~/.claude/plans/if-you-are-an-soft-planet.md`.
