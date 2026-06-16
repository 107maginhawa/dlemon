# VERIFY-APP PLAYBOOK — building a repeatable end-to-end verification system

> A repo-agnostic recipe for replacing a slow, manual, prose-based gap audit with a
> fast, deterministic, **computed** verification system. The thesis: **don't *hunt*
> for what's untested — *compute* it** as a set-diff over the machine-readable sources
> you already have, ratchet the result, and turn your adversarial audit checklist into
> automated parallel probes. Distilled from one app's build-out; nothing here is tied to
> a particular stack, language, or domain.

---

## 0. When to reach for this

Use this playbook when **human QA keeps finding systemic bugs that CI was green for** —
cross-tenant leaks, "saved setting that nothing enforces", orphaned endpoints, summary
totals that don't match their rows, a permission that's computed but never checked. The
root failure is that your test suite proves *units pass*, not that *the wired surface
works for users* and *nobody can break it*. This builds the second thing as a button you
can re-run.

**Anti-pattern it replaces:** a sequential, prose audit (one long document, N manual
"rounds") that can't be re-run, rots the moment code changes, and stalls on product
decisions. If you have one of those, this is its computed successor.

---

## 1. Core principles (the non-negotiables)

1. **Compute gaps, don't hunt them.** Every coverage gap is a deterministic set-diff
   between a *source of truth* (what *should* exist) and a *scan of the test corpora*
   (what's *actually* exercised). Re-derivable in seconds, never stale.
2. **Cover-what-ships + compute-the-rest.** Adversarially verify everything wired/shipped.
   Everything orphaned / deferred / decision-gated is *computed and allowlisted with a
   reason* — visible, tracked, not blocking. You are not obligated to close the whole
   backlog; you are obligated to *never grow it silently*.
3. **Ratchet, never threshold.** A "fail on any gap" gate is unadoptable on a real
   codebase; a "max N gaps" threshold rots. The ratchet is the middle path: a per-gate
   allowlist of tolerated gap-ids (each with a `reason`); any gap **not** on the
   allowlist fails; allowlists **only shrink** (new entries need explicit human sign-off
   in the PR). See §4.
4. **Non-vacuity is proven, not assumed.** A green check is worthless if it can't go red.
   For each gate, prove it: revert a historical fix on a scratch branch → a matrix/probe
   goes RED; re-apply → GREEN. Bake this into the phase's done-criteria.
5. **Drift is never allowlisted.** Coverage gaps can be tolerated; a *contradiction*
   between two sources of truth (code says role X may do op, policy doc says it may not)
   is a bug or a doc error — fix one side, never allowlist the disagreement.
6. **One phase, one PR, fully merged before the next.** The discipline that keeps the
   effort from drifting. The tracker is a committed file, not memory (§7).
7. **Aggregate existing gates; don't duplicate them.** The button *invokes* your typecheck,
   lint, contract, and journey gates — it doesn't reimplement them. Its new value is the
   computed coverage layer and the single verdict.
8. **Honesty surface.** The verdict must end with an explicit "**what this does NOT
   prove**" block. A green verdict means *the wired surface works and gaps are ratcheted*
   — not *nobody can break this*. Naming the blind spots is what keeps "green" from being
   read as "audited" (§6).

---

## 2. The auditor's checklist → computed checks

Start from the questions a skeptical auditor would ask, then map **each** to a mechanical
check. This is the spec for what to build. Group them so each group becomes one matrix or
one adversarial probe.

| Dimension | The auditor's question | Becomes |
|---|---|---|
| **Completeness** | Every endpoint has a consumer or an allowlisted deferral? Every rule maps to a test? Every workflow has a test id? Every "saved" setting has an enforcing reader? One source of truth per value? | Endpoint / BR / workflow / FE-route matrices (Tier 0) |
| **Correctness** | Does a mutant flipping an operator/boundary get killed? Is each historical bug re-introducible as a *killed* mutant? Are negative/edge paths tested? | Mutation harness + historical-bug catalog (Tier 2) |
| **Isolation** | 2-tenant probe → zero cross-tenant rows even with an omitted or attacker-supplied scope id? Zero-membership → empty? Client ids resolved server-side (IDOR inert)? Row-level security fails closed? | Cross-tenant / IDOR probes (Tier 2) |
| **State-integrity** | Every status field has an FSM property test (illegal edges rejected)? Immutability guards symmetric across *all* write paths? Alternate write paths gated as strictly as the primary? | FSM matrix (Tier 0) + illegal-edge probes (Tier 2) |
| **Coherence** | Summary total == Σ rendered rows (derived from the *rendered output*, not the fixture)? Badge count == items the action operates on? | Coherence oracles, FE + a backend twin (Tier 1) |
| **Affordance** | Every documented capability has a reachable, role-correct control? Every primary action changes durable state (verified by independent read)? Controls hidden/disabled for unauthorized roles? | FE-route render-smoke (Tier 0/1) + persona walks (Tier 2) |
| **Resilience** | Malformed request → clean 4xx from the *real* validator? Client handles the *real* error shape? Forbidden writes touch zero rows and are audited? | Contract-fuzz (Tier 0) + reject probes (Tier 2) |
| **Non-vacuity** | Driven through the *real assembled stack* (no raw-handler mount, no test-only shortcut)? Goal verified by an *independent* read? Would it go RED if the feature broke? Known harness divergences covered elsewhere? Environment consistent (drift gate)? | The revert-proof + a shared "real-stack" test harness, applied across all tiers |

The last row is load-bearing: **a check that exercises a test-only mounting of your code
proves nothing about production.** Build/borrow a harness that assembles the *real*
middleware → validation → handler chain and route all new tests through it; lint-block raw
mounts so the corpus can't regress.

---

## 3. The tier model

Three independently-invokable tiers, by cost and cadence:

| Tier | When | Proves | Budget |
|---|---|---|---|
| **0 — Computed gates** | every commit (CI) | what's untested (set-diff) + ratchet | seconds |
| **1 — Functional proof** | pre-merge / on-demand | the wired surface works for users *now* | minutes |
| **2 — Adversarial sweep** | pre-release / weekly | tests are non-vacuous + nobody can break it + affordances are real | tens of minutes, parallelized |

- The button runs **Tier 0 + Tier 1** by default and *invokes your existing CI gates*; a
  `--deep` flag adds Tier 2.
- A skill/slash-command is a thin wrapper: run the button, read the verdict, summarize.
- **Per-tier budgets are part of the design** — if Tier 0 isn't seconds it won't run every
  commit; if Tier 2 isn't parallel it won't run at all.

---

## 4. The computed coverage engine (Tier 0)

The heart of the system. A small shared core plus N dimension generators.

### 4.1 Shared core (build once, reuse everywhere)
- **`sources`** — load each source of truth into a normalized in-memory shape (the API
  contract / spine, the role-permission matrix doc, the rule/BR registry, the FSM
  transition enums, the workflow map, the route tree).
- **`scan-tests`** — glob + tag-scan every test corpus (unit, contract, e2e/journey,
  fuzz) into "what op/rule/edge does each test touch". Extract this from your existing
  traceability tooling if you have any; otherwise it's a tag/heuristic scanner.
- **`ratchet`** — generator-agnostic gate. Given `current gaps` (anything with a string
  `id`) and an `allowlist` of `{id, reason}`:
  - `newGaps` = current gaps **not** on the allowlist → these **fail** the gate.
  - `resolved` = allowlist ids no longer a current gap → reported, so the allowlist can be
    tightened.
  - A **missing allowlist file → empty** (a clean generator needs none); a **malformed
    allowlist throws** (a broken allowlist must never silently widen the gate).
  This is the whole adoption story: new debt can't enter silently, old debt drains
  automatically, and loosening requires a reviewed edit.

### 4.2 The dimension matrices (one set-diff each)
Each generator emits a committed `*-matrix.{json,md}` plus a `*.allowlist.json`. Build
the ones your domain has sources for:

| Matrix | Source of truth × scan | Catches |
|---|---|---|
| **role × operation** | code's per-op allowed-roles (static scan of your authz call sites) **vs** the policy/permission doc | authz drift — a real bug class; **HARD gate, never allowlisted** |
| **endpoint** | every shipped operation in the contract **vs** {has a client/SDK consumer, has a contract test, …} | gaps + **orphans** (built, no consumer) |
| **business-rule** | the rule/BR registry (severity derived from rule type) **vs** tests, requiring a *negative-path* assertion for guard/authz/state rules | untested or positive-only rules |
| **FSM** | the status transition enums (legal edges + their illegal complement) **vs** asserting tests | illegal transitions nobody rejects |
| **workflow** | the cross-module workflow map (one-time crosswalk to journey/spec ids) **vs** referenced tests | unexercised cross-module flows |
| **FE-route** | the router tree per authorized role **vs** a render-smoke | orphan routes / white-screens an API matrix can't see |

### 4.3 Gate policy (assign one per matrix)
- **HARD** — must be 0, never allowlisted (use for *drift* / contradictions).
- **RATCHET** — allowlist may only shrink (use for *gaps*: endpoint/FSM/workflow/route).
- **REPORT-ONLY** — generate + surface, don't block yet (use for a dimension whose
  backlog is a triage effort, e.g. rule-traceability; keep a narrower legacy gate as the
  real blocker meanwhile, and write down the promotion plan).

### 4.4 Two failure modes the matrices have, and the fixes
- **A "tested" disposition that rests on one weak column.** If a matrix marks an op
  "tested" because *any* column is set, and one column reads a sink that's empty in a
  normal run, "tested" can be a lie. Either populate that column (env-gated recorder, §5)
  or down-weight it and say so in the honesty block.
- **Generation that isn't reproducible.** Sort with a **byte/codepoint** comparator, not a
  locale-dependent one; add a **freshness gate** (`generate → assert no diff`) so a stale
  committed matrix fails CI. Without these the "committed artifact" drifts from reality and
  the ratchet silently lies.

---

## 5. The functional proof (Tier 1) and instrumentation

- **Real-stack proof, not unit numbers.** Run the contract suite and the
  journey/persona harness **against a booted instance of the real backend**. If the
  backend isn't reachable, run the stack-independent steps (FE unit + coherence) and
  **report the rest as skipped** — never as passed.
- **Coherence oracles** — derive the *expected* value from the **rendered output** (parse
  the DOM / the response body), not from the fixture, then assert
  `summary == Σ rows` and `badge == count(items acted on)`. Ship a **backend twin** of the
  same invariant (`Σ returned rows == reported total`) and wire it into a high-value
  money/PHI report test. This is the cheapest catch for the "summary computed from a
  different source than the body" bug class.
- **Honest instrumentation is env-gated.** Any per-test coverage recorder must be a strict
  no-op unless an env flag is set, so it has **zero impact** on a normal test run. Document
  that the column it feeds is empty by default (and therefore weak — §4.4).

---

## 6. The honesty block (ship this, verbatim-shaped)

The verdict file and the skill **both** end with an explicit list of what a green run does
**not** prove. Populate it from your own blind spots; the *shape* is the deliverable:

- **Object-level IDOR, cross-tenant LIST leaks, secrets-in-logs, and "inert" authz** (a
  permission computed but never enforced) are **not** detected by Tier 0/1 — they are
  Tier-2 work. (In the source build, a real cross-tenant PHI IDOR passed every Tier-0/1
  gate; only the adversarial sweep caught its class.)
- **Coverage breadth is partial where a column is unpopulated** (the env-gated sink) — a
  "tested" disposition may rest on the contract column alone.
- **"0 drift" is true-but-narrow** — only the subset of operations expressible in the
  policy doc is joinable; "0 drift" means *no contradiction among the joinable subset*,
  not *all operations verified*.
- **Orphans are tracked, not exercised** — built-but-unconsumed endpoints (often including
  sensitive ones) live in a disposition doc; sensitive *mutating* orphans should be
  escalated to a tracked obligation, not left as "no-obligation orphans".

---

## 7. Governance & the committed tracker

1. **One phase, one PR, fully merged** before the next. Branch off latest mainline after
   each merge.
2. **A committed tracker file**, not memory: goal, coverage bar, the tier table, a
   checkbox list of phases with a per-phase *verification gate*, and a "resume from the
   first unchecked box" instruction.
3. **Allowlists can only shrink.** Every entry carries a `reason`; new entries need
   explicit human sign-off in the PR. Drift is never allowlisted.
4. **Each new gate lands NOT-required, then is promoted.** Add the CI job; let it run
   green for a cycle; have the admin add it to branch protection as a required check.
   Record which gates are "not-yet-required" in the tracker so promotion isn't forgotten.

---

## 8. The adversarial sweep (Tier 2)

Convert your audit battery into automated parallel probes. Two engines:

### 8.1 Mutation + historical-bug catalog
- Spike the mutation tooling on your runtime first; if full mutation is impractical, fall
  back to a **narrow operator/boundary-flip harness on pure-logic files** plus a
  **hand-seeded mutant catalog of your historical bugs**.
- **Hard gate: 0 surviving historical-bug mutants.** Every bug you've already fixed must be
  re-introducible as a *killed* mutant — this is non-vacuity at scale.

### 8.2 Skeptic fan-out (parallel subagents / reviewers)
- Run the audit battery per module **in parallel**: cross-tenant 2-tenant probe, IDOR,
  illegal-FSM-edge, role-reject + zero-rows-on-403, audit-row-present, validator-drift.
- **Every finding is re-verified in source, then fixed via TDD with a committed RED→GREEN
  pin** (the test fails if the fix is reverted). A module's verdict becomes
  *"refuted-and-survived"* only after the battery runs clean against it.
- **Decide-and-proceed, don't stall.** Fix clear bugs; *allowlist or report*
  product-decision-gated findings with a reason rather than blocking on a decision — that
  stalling is exactly what kills prose audits. Persona/UI walks (one adversarial brief per
  role) feed the same RED→GREEN pin loop.

---

## 9. Sequencing (suggested phase plan)

0. **Tracker first** — the committed plan/todolist file.
1. **Highest-ROI first, then the engine.** Start with the **role×operation drift
   detector** — it finds real authz bugs with *zero test-writing*, just a static scan vs a
   doc. Then promote your contract-fuzzer's *server-error + status-conformance* checks to
   **blocking** (it computes spec↔impl drift across your whole surface). Then build the
   shared core + the remaining matrices (parallelizable once the core exists).
2. **The button + skill** (Tiers 0–1) — the orchestrator that aggregates the gates into one
   verdict, plus the thin skill wrapper. Verify against a *reseeded real stack*.
3. **Harden the engine** — self-audit for inert gates: arm any ratchet that's a no-op, add
   the freshness + env-independence gates, write the honesty block, and reclassify
   sensitive mutating orphans into a tracked obligation.
4. **The adversarial sweep** (Tier 2) — re-plan in bite-sized detail at phase start;
   mutation + skeptic fan-out + persona walks.

**Per-phase done-criteria** always include the **non-vacuity revert-proof**: the phase
isn't done until reverting a historical fix turns a gate RED.

---

## 10. Reuse map (don't rebuild)

Before writing anything, inventory what you can extract:
- Existing **traceability / tag-scan** tooling → the `scan-tests` core.
- The **contract/spine builder** (the handler↔client↔consumer join) → the endpoint matrix.
- Your **FSM/transition-enum parser** → the FSM matrix.
- Any **parameterized cross-tenant test table** → `assertNoCrossTenantRows`.
- Your **FE coherence/test utils** → the coherence oracles (+ a backend twin).
- Your **journey/e2e harness + stability-banking workflow** → the Tier-1 functional run.
- Your prior **audit checklist/battery** → keep as *content* for the Tier-2 probes.

The build is mostly *wiring existing machinery into a computed set-diff*, not green-field.

---

## 11. Gotchas (stack-independent ones worth carrying)

- **Contract-fuzzers' own data-generation health-checks can fail the gate on a non-bug**
  (tight input regex on a few ops). Suppress/tolerate *health-check-only* exits; don't let
  them block on an issue that isn't an impl defect.
- **A status-less error union can collapse into the success body**, so a whole module
  *declares* only success codes while *returning* 4xx at runtime — the status-conformance
  check is what surfaces it. Fix in the spec, preserving the success body so clients don't
  churn.
- **Locale-dependent sort** in a committed generator → nondeterministic artifacts across
  machines/CI. Use a codepoint comparator. Pair with a freshness gate.
- **A ratchet seeded against the wrong baseline is a no-op** that *looks* armed. Verify each
  ratchet actually fails on a synthetic new gap before trusting it.
- **"Tested" can be a lie if it ORs across columns** and one column is empty by default.
  Be explicit about which column carries the weight.
- **A flaky required type/build check** will block merges; have a "cancel + rerun-failed"
  escape hatch documented so the discipline survives infra flakiness.
