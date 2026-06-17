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

### U1 — Refresh + commit the graph
- **Goal:** A current KG that reflects HEAD.
- **Steps:** run `/understand` (and `/understand-domain`) on the main checkout (not a
  worktree); confirm `project.gitCommitHash` ≈ HEAD; decide whether to commit
  `.understand-anything/` (or document a refresh cadence so it never silently rots).
- **Done when:** `knowledge-graph.json` `analyzedAt`/`gitCommitHash` match a recent commit,
  and the staleness story is decided (committed or scheduled-refresh).

### U2 — Fix staleness / worktree rot (#133)
- **Goal:** The KG stops silently going stale.
- **Steps:** ensure the auto-update hook redirects worktree runs to the main repo root
  (per the `understand-domain` skill's worktree-redirect logic); add a lightweight freshness
  check (warn when `gitCommitHash` drifts > N commits from HEAD).
- **Done when:** a refresh run from a worktree writes to the main repo; a stale graph emits
  a visible warning.

### U3 — Wire `understand-diff` into review as an advisory radar
- **Goal:** At PR/review time, surface "this diff changed a **mapped flow** that has no
  green journey."
- **Steps:** add `understand-diff` to the review step (e.g. the `/review` flow) so changed
  files are mapped to their `flow`/`step` nodes and cross-checked against the journey roster
  in `apps/dentalemon/scripts/run-journey-harness.ts`. Output is **advisory** (a comment),
  not a blocking check.
- **Done when:** a PR touching a mapped flow with no covering journey produces a visible
  advisory note.

### U4 — (optional) Per-module scoping
- **Goal:** Smaller, faster, more accurate graphs.
- **Steps:** evaluate scoping UA per top-level module (`services/api-ts/src/handlers/*`,
  `apps/dentalemon/src/features/*`) instead of one whole-repo graph.
- **Done when:** a decision is recorded (adopt per-module, or keep monolithic with reason).

### U5 — Decision gate: graphify as a replacement?
- **Goal:** Revisit the tool choice only if warranted.
- **Trigger:** UA staleness/impact still causes misses after U1–U3.
- **Steps:** trial graphify (`/graphify .`) as a **replacement** for UA (not an add-on);
  compare freshness (`--watch`), change-impact (`affected`/`prs`), polyglot coverage
  (Rust/SQL), and MCP query against UA's business-flow layer. Pick **one**.
- **Done when:** a recorded keep-UA / switch-to-graphify decision with rationale.

---

## Changelog
- 2026-06-17 — doc created (UA/KG track split out of Phase 7; graphify assessed, not adopted).
