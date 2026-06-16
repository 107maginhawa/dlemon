# verify-app — bootstrap prompt (paste into a fresh agent session in ANY repo)

Copy everything in the fenced block below and paste it as your first message to a coding
agent (Claude Code, etc.) opened **at the root of the target repo**. It is self-contained:
the agent discovers the repo's own truth-sources and builds its own verify-app — nothing is
assumed about stack, language, or domain.

> Tip: run it with an agent that can browse the repo, run shell commands, and open PRs.
> It works even if the repo has no API spec (it falls back to the adversarial sweep).

---

```
You are setting up "verify-app" in THIS repo: a repeatable end-to-end verification system
whose thesis is COMPUTE what's untested as a deterministic set-diff over the repo's own
machine-readable sources, ratchet it, and automate an adversarial bug-hunt as a parallel
fan-out — instead of hunting gaps by hand. The goal is to catch the "CI is green but the app
is broken / exploitable" class: cross-tenant leaks, IDOR, a permission that's computed but
never enforced, an orphaned endpoint, a summary total that doesn't match its rows.

Work in small, reviewed steps. TDD always (write a failing test, watch it fail, then fix).
One coherent change per PR/commit. Be honest about what you cannot verify.

=== PHASE 0 — DISCOVER (read-only; do this first, change nothing) ===
Inspect the repo and produce a short "applicability report" answering:
1. Stack & test runner: language(s), how tests are run, how to run typecheck/lint/build.
2. API surface: is there a MACHINE-READABLE spec (OpenAPI/Swagger, GraphQL SDL, protobuf,
   or a generated route table)? If not, is there a discoverable route registry in code?
3. Authorization model: is there a consistent convention you can STATICALLY extract — a
   middleware, a guard decorator, or an `assert<Role>(...)`/`requireRole(...)`-style call at
   each protected handler? Is there a written role↔permission policy (a doc/table/config)?
4. Multi-tenancy / isolation: how is data scoped per tenant/org/user (a column, row-level
   security, a query filter, a handler-level ownership check)? Where is it enforced?
5. Test corpora: globs for unit / integration / contract / e2e tests; are tests tagged or
   greppable by the operation/rule they exercise?
6. Logging: where is the logger, and what field names does it redact (the PII/secret set)?
7. CI: what runs the checks (GitHub Actions, etc.) and how are required checks configured?

Then map each verify-app dimension to FEASIBLE / NEEDS-INPUT / NOT-APPLICABLE for this repo,
and propose an order. Skip cleanly anything whose precondition is absent — do not emit noise.
STOP and show me this report before building anything.

=== PHASE 1 — TIER-0 COMPUTED GATES (build the feasible ones, highest ROI first) ===
Build each as: a generator that produces a COMMITTED matrix (json + md) by set-diffing one
source of truth against the test-corpus scan, plus a ratcheted allowlist and a CI gate.

Shared core (build once, no coupling):
- A `ratchet(currentGaps, allowlist)`: gaps are anything with a string `id`; an allowlist is
  `[{id, reason}]`. `newGaps` = current gaps NOT on the allowlist → these FAIL. Report
  allowlisted ids no longer present so the allowlist can shrink. Allowlists ONLY shrink; new
  entries require an explicit reason + human sign-off in the PR.
- A deterministic string comparator (compare by code unit, NOT a locale-aware compare) and
  NO Date/random in any committed output — generation MUST be byte-identical across machines/
  CI runners, or the freshness gate (below) will flake and get bypassed into uselessness.

Dimensions, in ROI order — build the ones the report marked FEASIBLE:
1. SECRETS/PII-IN-LOGS (almost always feasible; needs only the logger): a static scanner that
   FAILS on (a) a secret-bearing value/expression passed to a log call under a key your logger
   does NOT redact, (b) a committed high-confidence secret literal (e.g. provider key formats,
   private-key PEM, cloud access-key ids), (c) PII (email/phone/name/ssn/dob) interpolated into
   a log MESSAGE string (the redactor only sees object fields, not message text). Read the
   redact set from the logger source so it stays in sync.
2. ROLE×OPERATION DRIFT (highest ROI when feasible; needs the authz convention + a policy
   source): statically extract CODE-truth (which roles each protected operation actually
   admits) and diff it against POLICY-truth (the role↔permission doc/config). A DRIFT is a real
   bug or a doc error — fix one side; NEVER allowlist a drift.
3. ENDPOINT/OPERATION COVERAGE (needs the machine-readable spec): for every spec operation,
   join handler ⨯ client-SDK/consumer ⨯ {contract,integration,e2e} test corpora. An operation
   the frontend/clients CONSUME but NO test layer exercises is a "gap" (the broken-while-green
   class) → ratchet. An operation that's shipped but nothing consumes is an "orphan" → track in
   a disposition doc, NOT in the test ratchet — EXCEPT a MUTATING orphan touching
   sensitive/PII/financial data, which must carry a cross-tenant/ownership negative test or be
   allowlisted with a reason (an IDOR-able write can never be a "no-obligation orphan").
4. (If declared) STATE-MACHINE EDGES: for each status field with declared transitions, expand
   the full edge space; a missing rejection test for an ILLEGAL transition is the high-value gap.
5. (If present) CROSS-MODULE WORKFLOWS and UI-ROUTE coverage, same pattern.

For EACH dimension: emit the committed matrix, seed + commit its `*.allowlist.json` baseline so
the gate starts green, and add a `--check` mode that exits non-zero on any non-allowlisted gap.
Prove NON-VACUITY before trusting a gate: a freshly-introduced unallowlisted gap must make it
go RED (or revert a real historical fix on a scratch branch and watch a matrix go RED). A gate
that compiles and runs but enforces nothing is the worst outcome — test that it can fail.

CI wiring for each gate:
- A job that regenerates the matrices from sources and runs the `--check` gates.
- A FRESHNESS step: after regenerating, `git diff --exit-code` the committed matrices — fails
  if they drifted from a fresh regen (this needs the determinism above).
- Promote the gate to a REQUIRED status check once it's green across a couple of runs.

=== PHASE 2 — TIER-2 ADVERSARIAL SWEEP (works even with NO spec) ===
This is what actually finds the launch-blockers. For the most sensitive modules (auth, billing/
payments, anything touching tenant-scoped PII, destructive lifecycle ops), audit each — in
parallel where you can — against this bug-class battery:
- CROSS-TENANT (2-actor): can actor A in tenant/org X read or mutate actor B's (tenant Y) data
  by supplying B's id, or by OMITTING a scope filter? Does a zero-membership caller get empty
  results, not everything?
- OBJECT IDOR: is a client-supplied object id (contactId, invoiceId, memberId, fileId) mutated
  by id ALONE, without re-checking it belongs to the authorized parent/tenant?
- COMPUTED-BUT-UNENFORCED AUTHZ: is an `isOwner`/`canEdit` computed and then only logged, while
  the mutation runs unconditionally?
- ILLEGAL STATE TRANSITION accepted (no guard) on any write path, including alternate paths.
- VALIDATOR DRIFT: does the real validator reject malformed input, and does the client handle
  the REAL error shape (not a test-only mock shape)?
- SECRETS/PII reaching logs or external sinks.
For EVERY candidate finding: RE-VERIFY it in source first (cite file:line + a concrete 2-actor
exploit path) — do not trust the hypothesis. Then for each CONFIRMED bug: write a RED test that
reproduces it, fix it, and prove the test goes RED if you revert the fix. Refuted candidates get
a one-line "refuted because…". Drive tests through the REAL assembled middleware→validation→
handler stack, never a raw handler mounted in isolation (that proves nothing about production).

=== DISCIPLINES (apply throughout) ===
- TDD: no production change without a failing test first; prove non-vacuity.
- Ratchet allowlists ONLY shrink and every entry has a reason; drift is never allowlisted.
- Expect TEST-SEED CASCADES: adding an authz/ownership assert will turn existing happy-path
  tests RED whose fixtures never modeled a tenant/branch — fix the SEED to reflect the real
  invariant (give the fixture a proper tenant + membership), don't weaken the assert.
- Beware HEURISTIC FALSE-POSITIVES: keyword/proximity scanners can be tripped by a bare token
  in a TEST COMMENT (an operation name, or a marker like "cross-tenant") — keep comments clean.
- Every verdict ENDS with a "what this does NOT prove" note: a green run means the wired surface
  works and gaps are ratcheted — NOT that nobody can break it. Name the blind spots.
- If a required type/build/lint check is flaky or an env-dependent check is red for reasons
  unrelated to your change, don't spiral — confirm your change is clean and merge past it.

=== DELIVERABLE ===
A single re-runnable entry point (script + optional skill/command) that runs the Tier-0 gates
plus the available functional tests and writes ONE verdict file; the new CI gates wired and (once
green) promoted to required; and the adversarial sweep's confirmed bugs fixed with committed
RED→GREEN regression tests. Give me a final report: every gate added + every bug found/fixed +
what you deliberately skipped (precondition absent) and why.
```

---

### Notes for the human running this

- **Fastest value:** if the repo has no machine-readable spec, tell the agent to **skip Phase 1
  and go straight to Phase 2** — the adversarial sweep needs no infrastructure and is what found
  the real launch-blockers here.
- **Highest-ROI gate to insist on first:** role×operation drift (Phase 1 #2) — it's a pure
  static diff, costs zero test-writing, and tends to surface a real authz bug immediately.
- This prompt is the portable distillation of `VERIFY_APP_PLAYBOOK.md` (the full methodology)
  and `VERIFY_APP_PLAN.md` (this repo's tracker + field-notes).
