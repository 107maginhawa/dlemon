# understand-anything / Knowledge-Graph Upgrade — living plan

> **Status:** OPEN · **Owner:** eng · **Created:** 2026-06-17
> **Parent:** Phase 7 of [`VERIFICATION_HARDENING.md`](./VERIFICATION_HARDENING.md).
> **Run separately** from doc1 (this track needs plugin/tooling interaction — not safe for
> a blind autonomous phase-runner). **⚠ HUMAN** steps are marked.

---

## Why this exists

The understand-anything (UA) knowledge graph was supposed to be the "cross-reference" that
catches gaps, but in the New Visit incident it contributed nothing:

- **Stale** — `.understand-anything/knowledge-graph.json` was built `2026-06-06` at commit
  `1196799b`; the repo is ~10 days and many commits ahead. The session hook flags it stale.
- **Monolithic** — one whole-repo graph that even self-warns "over 100 source files;
  consider scoping to a subdirectory." Not per-module.
- **Uncommitted & out of the loop** — not in git, not in any CI gate, so the audit never
  actually cross-referenced anything current.
- **Structural-only** — it modeled the visit flow as `flow: Conduct Visit → step: Create
  Visit → services/api-ts/.../createDentalVisit.ts`: the **backend handler**, single step.
  It has no concept of the FE two-step (`POST draft → PATCH active`) and cannot observe
  runtime behavior. Same blind spot as every other map.
- **Worktree rot (#133)** — graphs written inside ephemeral `.claude/worktrees/` are
  destroyed at session end, silently losing freshness.

**Decision (graphify):** [graphify](https://github.com/safishamsi/graphify) was reviewed as
an alternative — same category (tree-sitter + LLM **structural** code graph; edge vocab is
`calls/imports/contains/inherits/…`; **no** runtime/test awareness; **no** business
flow/step layer). It does not fix the runtime-verification gap, so it is **not adopted now**
and **never run alongside UA** (two stale structural graphs = redundant maintenance). It is
parked as a possible *replacement* for UA — its `--watch`/incremental cache, `affected.py`
change-impact, polyglot (Rust/SCIP) + Postgres introspection, and MCP server would directly
cure UA's staleness/impact weaknesses — to revisit only if UA staleness keeps biting (see
the decision gate below). UA's one edge over graphify is its **business flow/step layer**,
which is what aligns with `WORKFLOW_MAP.md`.

**Scope guardrail:** UA is an **advisory change-impact radar**, never a blocking gate. It
cannot observe runtime behavior; the real firewall is doc1's non-skippable goal-state
journeys. Do not over-invest here.

---

## Phases

### U1 — Refresh + commit the graph — ✅ DONE (FE 2026-06-17; BE arm + full merge 2026-06-17)
- **Goal:** A current KG that reflects HEAD.
- **Steps:** run `/understand` (and `/understand-domain`) on the main checkout (not a
  worktree); confirm `project.gitCommitHash` ≈ HEAD; decide whether to commit
  `.understand-anything/` (or document a refresh cadence so it never silently rots).
- **Done when:** `knowledge-graph.json` `analyzedAt`/`gitCommitHash` match a recent commit,
  and the staleness story is decided (committed or scheduled-refresh).
- **Outcome (both tranches done):**
  - FE: `frontend-knowledge-graph.json` (806 nodes), domain flow graph refreshed (Start-Visit
    two-step). See D1 + the U1-FE changelog entry.
  - **BE arm (done):** `backend-knowledge-graph.json` — fresh structural graph of
    `services/api-ts` (1634 nodes / 5519 edges / 10 layers / 15-step tour over 801 files;
    34 file-analyzer batches; 0 validation issues; repo-relative IDs).
  - **Full arm (done):** merged FE+BE → fresh root `knowledge-graph.json` (2440 nodes / 7026
    edges / 17 layers / 30 tour steps, 0 dangling) + `meta.json` at HEAD + 1088-file
    fingerprints baseline. This **arms the per-commit incremental auto-updater** (the baseline
    is now HEAD, so future commits incrementally update instead of bouncing to FULL_UPDATE)
    and **silences the SessionStart stale-hook**. `check:kg-freshness` is green on all 4 graphs.
  - Committed: root `knowledge-graph.json` + `meta.json` + `frontend-`/`backend-knowledge-graph.json`
    + `domain-graph.json`. Derived `fingerprints.json` stays git-ignored (regenerates).

### U2 — Fix staleness / worktree rot (#133) — ✅ DONE (2026-06-17)
- **Goal:** The KG stops silently going stale.
- **Steps:** ensure the auto-update hook redirects worktree runs to the main repo root
  (per the `understand-domain` skill's worktree-redirect logic); add a lightweight freshness
  check (warn when `gitCommitHash` drifts > N commits from HEAD).
- **Done when:** a refresh run from a worktree writes to the main repo; a stale graph emits
  a visible warning.
- **Outcome:**
  - **Worktree redirect — already present at the refresh entry points.** Verified in plugin
    2.7.6: both `/understand` and `/understand-domain` Phase 0 detect a worktree
    (`git rev-parse --git-dir` ≠ `--git-common-dir`) and redirect output to the main repo
    root. So a *refresh* run from a worktree writes to the main repo. ✅
  - **Known residual gap (documented, not in-repo-fixable):** the plugin's *incremental*
    `hooks/auto-update-prompt.md` (PostToolUse-on-commit) has NO worktree redirect — it sets
    `PROJECT_ROOT = cwd`. A per-commit auto-update fired from an ephemeral worktree writes
    there and is lost. The plugin cache is external/ephemeral (overwritten on upgrade), so it
    can't be durably patched from the repo. **Mitigation:** run refreshes from the main
    checkout; the freshness radar below is the backstop that makes any resulting staleness
    loud regardless of where auto-update ran.
  - **Freshness radar (the durable, plugin-independent teeth):** `scripts/check-kg-freshness.ts`
    (+ `.test.ts`, 8 cases, TDD RED→GREEN). Reads every committed graph's
    `project.gitCommitHash`, measures `git rev-list --count <hash>..HEAD`, and emits a VISIBLE
    warning when a graph is stale past `--max-drift` (default 50), has no recorded commit, or
    records a commit not in history. Wired as `bun run check:kg-freshness`. **Advisory by
    design** (exits 0 on drift — never a blocking gate, per the scope guardrail); `--strict`
    exits 1 only on a config error (missing/corrupt hash), never on drift. Live run correctly
    flags the stale legacy monolith (`knowledge-graph: 421 behind`) while the fresh FE + domain
    graphs read healthy.
  - Belt-and-suspenders with the plugin's SessionStart stale-hook (fires when
    `meta.gitCommitHash` ≠ HEAD), which already triggered this session.

### U3 — Wire `understand-diff` into review as an advisory radar — ✅ DONE (2026-06-17)
- **Goal:** At PR/review time, surface "this diff changed a **mapped flow** that has no
  green journey."
- **Steps:** add `understand-diff` to the review step (e.g. the `/review` flow) so changed
  files are mapped to their `flow`/`step` nodes and cross-checked against the journey roster
  in `apps/dentalemon/scripts/run-journey-harness.ts`. Output is **advisory** (a comment),
  not a blocking check.
- **Done when:** a PR touching a mapped flow with no covering journey produces a visible
  advisory note.
- **Outcome:**
  - **`scripts/kg-review-radar.ts`** (+ `.test.ts`, 8 cases, TDD RED→GREEN). Maps each
    changed file → its `domain-graph` **step** (by `filePath`) → its **flow** (via
    `flow_step` edges), then cross-checks each affected flow against the journey roster
    parsed from `run-journey-harness.ts`, using the explicit **`scripts/kg-flow-journey-map.json`**
    coverage map. A touched flow with no covering journey (or a map entry pointing only at a
    journey that no longer exists) is flagged. `bun run check:kg-review` (or `--base=`,
    `--files=`, `--json`). All 79 domain steps carry filePaths (43 BE / 36 FE), so the radar
    covers FE *and* BE diffs.
  - **Wired into CI as a non-blocking advisory job** (`kg-review-radar` in
    `.github/workflows/journey-verification.yml`): pull_request-only, no stack/deps, writes
    the radar output to the PR check **summary**. Exits 0 + `continue-on-error` → never blocks
    (scope guardrail: advisory radar, not a gate). Also runnable inside `/review`.
  - **Demonstrated (Done-when):** a simulated New-Visit-style diff touching
    `apps/dentalemon/src/routes/_workspace/$patientId.tsx` + an imaging handler prints
    *"Start Clinical Visit — covered by J21"* and *"Capture & Upload Imaging — ⚠ NO covering
    journey."* The uncovered set (imaging, ceph, check-in, online-booking, portal,
    pin-auth, staff-perms, complete-visit, duplicate-resolution) is itself a real coverage map.
  - The coverage map is intentionally **conservative** (specific pairs only); unmapped flows
    surface as gaps rather than being hidden under a broad journey. `understand-diff` remains
    available for deeper interactive diff analysis against the structural graphs.

### U4 — (optional) Per-module scoping — ✅ DONE (decided in D1, proven in U1)
- **Goal:** Smaller, faster, more accurate graphs.
- **Steps:** evaluate scoping UA per top-level module (`services/api-ts/src/handlers/*`,
  `apps/dentalemon/src/features/*`) instead of one whole-repo graph.
- **Done when:** a decision is recorded (adopt per-module, or keep monolithic with reason).
- **Decision (see D1): ADOPT per-domain, NOT per-handler-module and NOT monolithic.**
  Rationale, now validated empirically by the U1 FE build:
  - **Monolithic rejected** — the whole-repo graph self-warns >100 files (we had 2,681),
    went shallow, was expensive to refresh, and flattened "Create Visit" to one backend
    handler (the incident blind spot).
  - **Per-handler-module (40+ tiny graphs) rejected** — unmanageable freshness/merge
    overhead for an *advisory* tool (over-investment).
  - **Per-domain chosen** — two structural graphs (`frontend-knowledge-graph.json`,
    `backend-knowledge-graph.json`) + the `domain-graph.json` flow layer, merged into the
    root graph via the plugin's native subdomain-merge. The FE/BE split keeps their
    divergence visible (the exact failure mode). U1 proved it: the FE graph built cleanly
    in 17 batches → 806 nodes / 7 coherent layers / 0 validation issues, far more tractable
    and accurate than a 2,681-file monolith would be. Scope each build with a per-build
    `.understandignore` (exclude tests/generated) and relocate to a repo-relative
    `*-knowledge-graph.json` at the root (see U1 method).

### U5 — Decision gate: graphify as a replacement? — ✅ DONE (gate NOT triggered → keep UA)
- **Goal:** Revisit the tool choice only if warranted.
- **Trigger:** UA staleness/impact still causes misses after U1–U3.
- **Steps:** trial graphify (`/graphify .`) as a **replacement** for UA (not an add-on);
  compare freshness (`--watch`), change-impact (`affected`/`prs`), polyglot coverage
  (Rust/SQL), and MCP query against UA's business-flow layer. Pick **one**.
- **Done when:** a recorded keep-UA / switch-to-graphify decision with rationale.
- **Decision (2026-06-17): KEEP UA. Gate NOT triggered; graphify NOT trialled now.**
  Rationale:
  - The trigger is forward-looking — "UA staleness/impact *still* causes misses *after*
    U1–U3." U1–U3 *just shipped* (fresh per-domain graphs + the freshness radar U2 + the
    review radar U3). There is no post-investment miss to evaluate yet, so the gate has not
    fired. Trialling graphify now would be premature.
  - Graphify is the **same category** (tree-sitter + LLM structural graph; `calls/imports/
    contains/…`; no runtime/test awareness; **no business flow/step layer**). UA's one edge
    — the `domain-graph.json` flow layer that maps to `WORKFLOW_MAP.md` and now models the
    Start-Visit FE two-step — is exactly what closed the incident blind spot. Replacing UA
    would lose it. Running both is explicitly disallowed (two stale structural graphs).
  - The plan's scope guardrail ("advisory radar, do not over-invest") argues against a
    speculative tool migration with no demonstrated need.
  - **Reopen trigger (revisit graphify then, not before):** if, after this investment, the
    KG *still* goes stale in practice (the freshness radar repeatedly fires on main) OR a
    real change-impact miss recurs that a fresh UA graph should have caught. At that point
    trial graphify's `--watch`/incremental + `affected.py` change-impact + polyglot (Rust/SQL)
    + MCP against UA's flow layer, and pick **one**.

---

## Decisions (recorded during execution)

### D1 — KG shape & commit policy (settles U1 commit-question + U4) — 2026-06-17
Decided while executing U1, with the long-term goal stated explicitly by the owner:
*"full, thorough understanding of OUR codebase by the AI."* Reasoning: the New-Visit
miss proves the failure mode is **staleness + structural-only + monolithic + unqueried**,
not "no graph." A 4.4 MB blob is never read whole by an agent — its only value is a
**fresh, flow-aware, queryable** index. Therefore:

- **Per-domain scoping (adopt — closes U4).** Not one whole-repo monolith (self-warns
  >100 files; flattened "Create Visit" to one backend handler), and not 40 tiny
  per-handler graphs (unmanageable). Two domain-scoped structural graphs plus the flow
  layer:
  - `backend-knowledge-graph.json` ← `services/api-ts` (handlers/business logic)
  - `frontend-knowledge-graph.json` ← `apps/dentalemon`
  - `domain-graph.json` ← business flows/steps (`understand-domain`; the layer that
    maps to `WORKFLOW_MAP.md` and is what was *missing*)
  - root `knowledge-graph.json` ← the merged product (the `/understand` skill natively
    merges `*-knowledge-graph.json` subdomain files).
  The FE/BE split is deliberate: the original blind spot was the **divergence** between
  them (FE two-step `POST draft → PATCH active` vs BE one-step handler). Two graphs keep
  that divergence visible instead of flattening it.
- **Commit the graphs (decide U1 staleness story = committed).** Un-ignore the graph
  JSONs so the index travels with the repo and freshness is PR-auditable. Keep the
  derived `fingerprints.json` cache + `intermediate/`/`tmp/` git-ignored (they regenerate;
  committing them makes every refresh an unreadable multi-MB diff). See `.gitignore`.
- **Freshness is the deliverable, not the snapshot.** Highest-leverage long-term
  investment = the auto-refresh machinery (U2) + the review radar (U3), so the graphs
  self-maintain per-commit and a stale graph is loud. A one-time refresh is not
  "over-investing" (the guardrail warns against treating UA as a *gate*, which we don't).
- **Refresh cadence:** plugin `PostToolUse` hook runs the incremental updater on every
  `git commit`; `SessionStart` hook warns when `meta.gitCommitHash` drifts from HEAD.
  Large drift (this rebaseline = 948 changed source files) bounces the incremental path
  to `FULL_UPDATE`, so a periodic `/understand --full` re-baseline (per domain) is the
  backstop when drift is large.

## Changelog
- 2026-06-17 — doc created (UA/KG track split out of Phase 7; graphify assessed, not adopted).
- 2026-06-17 — U1 started: recorded D1 (per-domain shape + commit policy, closes U4 &
  the U1 commit-question); un-ignored graph JSONs in `.gitignore` (kept fingerprints/
  intermediate ignored).
- 2026-06-17 — U1 (FE) done: committed fresh `frontend-knowledge-graph.json`
  (806 nodes) + refreshed `domain-graph.json` (FE↔BE flows; Start Visit two-step). BE
  structural rebuild + whole-repo arm deferred ("FE now, BE scheduled").
- 2026-06-17 — U2 done: `scripts/check-kg-freshness.ts` advisory radar (+ TDD test,
  `check:kg-freshness` npm script); verified worktree-redirect present in the refresh
  entry points; documented the incremental-hook redirect gap + mitigation.
- 2026-06-17 — U3 done: `scripts/kg-review-radar.ts` (+ TDD test, `kg-flow-journey-map.json`,
  `check:kg-review` npm script) maps diff→flow→journey-coverage; wired as a non-blocking
  advisory `kg-review-radar` job in journey-verification.yml (PR check summary).
- 2026-06-17 — U4 done: recorded the per-domain decision (= D1), now validated by the U1
  FE build (806 nodes / 7 layers / 0 issues). Monolithic + per-handler-module both rejected.
- 2026-06-17 — U5 done: graphify gate NOT triggered (trigger is post-U1–U3 misses, which
  just shipped) → keep UA (its flow layer is the differentiator); reopen trigger documented.
- 2026-06-17 — U1 BE arm + full merge done: `backend-knowledge-graph.json` (1634 nodes, 34
  batches) + merged root `knowledge-graph.json` (2440 nodes) + `meta.json`@HEAD + 1088-file
  fingerprints → per-commit incremental auto-updater ARMED, stale-hook silenced. All UA/KG
  phases (U1–U5) now complete.
- 2026-06-17 — radar triage payoff: surveyed the 9 uncovered flows; the standout gap was
  `complete-visit` (J21 covered *starting* a visit, nothing covered *finishing* it — the half
  that gates billing). Closed it with **J22** (`22-complete-visit.journey.spec.ts`, 4-clause
  DoD, WF-012) + roster + coverage-map entry. Full harness 22/22 PASS. Found+documented the
  real backend gate it exercises: completing a non-empty visit requires a signed consent
  (`VISIT_CONSENT_REQUIRED`). Decision stands: write journeys for genuine gaps, don't mass-map.
