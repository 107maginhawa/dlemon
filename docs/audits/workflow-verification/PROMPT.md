# Workflow Verification Sweep — Pasteable Orchestrator Prompt

> **How to use:** paste everything between the `=== PROMPT START ===` and `=== PROMPT END ===`
> markers into a fresh Claude Code session at the repo root. It runs one autonomous loop over
> every FE-bearing module in [`TRACKER.md`](./TRACKER.md), driving the live frontend to verify
> each module's workflows against its specs and auto-fixing confirmed contract/behavior bugs.
>
> **Single-module dry run (do this first — it's a hard gate):** before the full loop is allowed,
> run the prompt with the loop bound to **only `dental-visit`** and **autofix disabled** (report
> only). Confirm it boots the stack, drives the workspace §23 journey green, and produces a clean
> gap report. Only after that passes do you run the full sweep.

---

```
=== PROMPT START ===

ROLE
You are the orchestrator for a live-frontend workflow verification sweep of the dentalemon
dental app. Your job: walk docs/audits/workflow-verification/TRACKER.md top-to-bottom and, for
each module whose Status ≠ DONE, dispatch ONE fresh subagent (Agent tool, subagent_type
general-purpose, mode bypassPermissions) that verifies that module's user workflows against its
specs in a real browser and auto-fixes ONLY confirmed contract/behavior bugs. You hold only the
tracker + cross-cutting state; the heavy per-module work happens in the subagents so context
survives all 18 modules.

GOAL
Ensure every user workflow in the frontend works according to the module's specs — across
workflow states and the cross-module hand-offs — and fix the gaps that are real bugs, while
leaving intentional deferred features untouched and merely reported.

=========================== HARD PRECONDITIONS (do these first) ===========================
0a. CLEAN TREE. Run `git status --porcelain`. If anything is uncommitted, STOP and tell the user
    to commit or stash first. Do not proceed with a dirty tree (per-fix commits must not
    commingle unrelated WIP).
0b. BRANCH ISOLATION. Create and checkout a dedicated branch off current HEAD:
    `git checkout -b chore/workflow-verification-sweep`. All fix commits land here. Do NOT push.
0c. BOOT THE STACK ONCE (leave running for the whole sweep):
    - `bun run infra:up`   (Postgres + MinIO via docker; MinIO is required for /readyz + imaging)
      DOCKER-DOWN FALLBACK: if docker is unavailable, detect a usable local Postgres on :5432
      (`DATABASE_URL=postgres://postgres:password@localhost:5432/monobase`) and use it directly.
      Without MinIO, `/readyz` returns 503 on STORAGE only (`/livez`=200, database+jobs=pass) —
      that is FINE for every module except dental-imaging (which needs MinIO for upload/storage).
      Only hard-require MinIO when processing dental-imaging.
    - `cd services/api-ts && bun dev`   (API on http://localhost:7213 — boot this FIRST)
    - `cd apps/dentalemon && bun dev`   (Vite app on http://localhost:3003)
    App base URL is http://localhost:3003 (NOT 3001). Logins (from scripts/seed-demo.ts):
    email demo@dentalemon.com / password DemoClinic1!, then pick a PIN profile:
      · Dr. Maria Reyes (dentist_owner)  → PIN 123456   [drive owner/dentist workflows as Alex]
      · Ana Santos      (staff_full)     → PIN 654321   [drive front-desk Sam + RBAC NEGATIVES]
      · free-tier clinic (free@dentalemon.com / FreeClinic1!) → PIN 111111  [tier-gate negatives]
    PIN-only roles have no email of their own — reach them via the pin-select screen after the
    demo email login, then their PIN above. So RBAC negatives (e.g. front-desk denied chart edit)
    ARE drivable — not best-effort-skipped.
0d. WEBWRIGHT ENV. Ensure the python venv + Firefox for webwright exist (the committed smokes in
    apps/dentalemon/tests/smoke/ use `python -m venv` + `playwright install firefox`). Reuse it.
0e. MANDATORY DRY RUN. If this is the first run, process ONLY module #5 dental-visit with autofix
    DISABLED (report-only). Verify it boots, drives the workspace §23 journey green as Alex, and
    produces a clean gap report. If the dry run is not green, HALT and report. Only after the
    user confirms do you enable autofix and run the full loop.

=========================== THE LOOP ===========================
Read TRACKER.md. For each module M (top-to-bottom) with Status ≠ DONE:
  1. Set M's Status → IN-PROGRESS in TRACKER.md.
  2. Dispatch ONE subagent with the PER-MODULE BRIEF below (substitute {M}). Wait for it.
  3. Apply the subagent's structured result to TRACKER.md (Status, Rating, Gaps fixed, Deferred,
     Evidence, Commits) and append its detail block to the per-module log.
  4. REGEN BLAST-RADIUS RE-GATE: if the subagent ran any TypeSpec/codegen regen (it reports this),
     run the FULL gate yourself (see GATE) and re-run the committed smokes for any other module
     that shares the regenerated operationIds. Mark any previously-DONE module that now fails as
     REOPENED and queue it for reprocessing. Do NOT move past a regression you caused.
  5. Continue to the next module.
When every module row is DONE / NEEDS-REVIEW / REOPENED-resolved / BLOCKED, run the
**CROSS-MODULE E2E PHASE** (defined below) BEFORE finishing. Only after that phase completes,
write the Rollup at the top of TRACKER.md (module counts + cross-module journey results +
human-follow-up list + aggregated deferred-reported gaps) and stop. Summarize to the user.
Do not push; do not open a PR.

CIRCUIT BREAKERS (a subagent enforces these and reports the trip; you record it):
  - Max 5 confirmed fixes per module. More ⇒ stop fixing, report the rest, Status NEEDS-REVIEW.
  - If a gap's gate is still red after 2 fix attempts ⇒ stop that gap, Status NEEDS-REVIEW/BLOCKED.
  - A gap with no spec citation (see CLASSIFY) is NEVER fixed — report only.

=========================== PER-MODULE BRIEF (give this to each subagent) ===========================
You are verifying module {M} of the dentalemon app against its specs by DRIVING THE LIVE
FRONTEND, and fixing only confirmed contract/behavior bugs via TDD. The stack is already running
(API :7213, app :3003, login above). Work only on {M}. Return a structured result (schema at end).

STEP 0 — Resolve {M}'s spec artifacts (spawn an Explore subagent for this read-only gather):
  - Normative baseline: docs/context/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md — {M}'s §3 context
    row + status; the §4 cross-module journeys {M} participates in; §5 BR registry; §7 perms; §8 UI.
  - Per-module spec: docs/product/modules/{M}/MODULE_SPEC.md (workflows, BRs, permissions, state
    transitions, ACs, error table). If absent, fall back to IDEAL §3 context + the .tsp.
  - Drivable UX (if {M} has one — these seed the webwright steps, superseding the generic spec):
      · dental-visit/workspace → docs/context/DENTALEMON-DENTAL-WORKSPACE-REFERENCE-SPEC.md (§23 E2E, §26 ACs)
      · dental-imaging/ceph    → docs/context/CEPH_TRACING_MODULE_PRD_AND_IMPLEMENTATION_SPEC.md (§29.5 E2E, §30 ACs)
  - Personas + RBAC: docs/context/personas.md — which persona owns each workflow (Alex owner,
    Jordan associate, Sam front-desk, Riley scheduling, Morgan billing, Taylor patient, Pat ext.);
    each persona's module-access matrix → the RBAC NEGATIVE checks (who must be denied).
  - State machines (source of truth): docs/product/DOMAIN_MODEL.md (§6 SM-*).
  - BRs (machine-readable): specs/api/docs/standards/br-registry.json ({M} bucket).
  - RBAC grid: docs/product/ROLE_PERMISSION_MATRIX.md. FE routes: docs/product/NAVIGATION_MAP.md.
    Error codes: docs/product/ERROR_TAXONOMY.md. Operations: specs/api/src/modules/{M}.tsp.
    WF-IDs: docs/product/WORKFLOW_MAP.md.
  - Spec→FE wiring: .understand-anything/contract-spine.json (filter {M}'s operationIds →
    handler → sdkHooks → consumers). If a workflow isn't traced here, you may rebuild the spine
    via its generator; do NOT run a full /understand (too expensive, lossy).
  - DO-NOT-FIX set: IDEAL §3.14 + §12 non-goals AND docs/audits/modules/MODULE_{M}_AUDIT_*.md
    "Ranked Remaining Gaps". Anything here is report-only.
  FE-SURFACE TEST: {M} "has FE surface" iff it has a NAVIGATION_MAP route AND ≥1 contract-spine
  consumer under apps/dentalemon/src/. If not, skip the browser drive; do STEP 3a only.

STEP 1 — Build the verification matrix (two layers):
  - Intra-module: each WF-xxx (actor/preconditions/steps/postconditions) → its FE route; each
    entity state machine with its cross-workflow transitions (who sets each state, who must honor
    it — e.g. visit completed → chart/treatment/notes read-only, billing unlocks).
  - Cross-module ("across workflow states"): for each IDEAL §4 journey {M} touches, verify the
    HAND-OFF state at the seam (e.g. performed treatment → invoice item; approved plan item →
    completed procedure; completed visit → billing unlocked). These seams hide the real bugs.

STEP 2 — Clean baseline: run `bun run db:reseed` (resets + reseeds the demo DB) so the coherence
  oracle starts from a known state and isn't poisoned by an earlier module's mutations. Restart
  the API before any contract check (a stale server masks contract drift).

STEP 3a — STATIC CONTRACT DIFF (catches drift the browser silently tolerates): for each of {M}'s
  operationIds, compare the shape across layers — .tsp ↔ generated validator ↔ handler return ↔
  SDK type ↔ FE consumer usage (paths from contract-spine.json). Any mismatch (extra/dropped
  field, {data,pagination} vs {items}, optional/required skew) is a CONFIRMED Type-A bug even if
  the UI renders fine.

STEP 3b — DRIVE THE LIVE FRONTEND with /webwright:craft. Author/extend a committable
  apps/dentalemon/tests/smoke/{M}_smoke.py (match the existing {name}_smoke.py pattern: headless
  Firefox, viewport 1280x1800, argparse with --base-url default http://localhost:3003, self-
  cleaning run-unique data, exit 0 iff all critical points pass, screenshots + log into --out).
  Drive AS THE OWNING PERSONA. Seed critical points from the drivable-UX spec if {M} has one
  (workspace §23 / ceph §29.5), else from MODULE_SPEC ACs. Cover (max depth):
    · happy path completes end-to-end as the correct persona
    · main error/guard path is surfaced in the UI (e.g. write-to-completed → 422/blocked message)
    · RBAC negatives from the persona matrix (e.g. front-desk Sam denied clinical-chart edit;
      patient Taylor sees only own records) + read-only states honored (completed/locked)
    · COHERENCE ORACLE: every summary total == sum of the rows actually rendered. Reuse the
      DOM-oracle helpers in the FE test-utils (parseMoney / assertTotalExplainedByRows /
      assertCountMatchesItems) — derive "expected" from the rendered DOM, not the fixture.
    · AFFORDANCE ORACLE: every spec'd action (workflow + permission) has a reachable UI control.
    · CROSS-WORKFLOW / HISTORICAL STATE: a state set in one workflow shows correctly downstream
      (workspace §23: switching to a prior visit shows THAT visit's historical snapshot, not the
      current edits; ceph: landmarks stay image-native across zoom/pan; no fake arcs when a
      landmark is missing).
  Save screenshots + log under docs/audits/workflow-verification/runs/{M}/. NOTE: if you drive via
  the `/browse` daemon, it scopes screenshot output to `/tmp` or its start-cwd — capture to
  `/tmp/...png` then COPY into `runs/{M}/` (a naive relative path silently fails). webwright writes
  to its own `--out` dir, no scoping issue.
  RBAC negatives ARE drivable now (staff PIN 654321, free-tier 111111 — see 0c). Drive at least
  the persona-matrix denial for {M} (e.g. front-desk Sam denied clinical-chart edit; patient
  Taylor sees only own records). Only if a drive fails for an unforeseen reason, REPORT it rather
  than block DONE.

STEP 4 — CLASSIFY each gap (DEFAULT-DENY — this is the guardrail against inventing scope). A real
  missing affordance and an intentional deferred feature look identical on screen, so:
    · Type A (FIXABLE) ONLY IF the gap cites a concrete authority: a specific BR-xxx / AC-xxx in
      {M}'s OWN MODULE_SPEC or br-registry.json, OR a static shape mismatch from STEP 3a, OR a
      broken happy-path / failed coherence-oracle on a workflow the spec marks BUILT. No citation
      ⇒ it is NOT Type A.
    · Type B (DOC DRIFT): code is correct, the doc is stale → fix the DOC (MODULE_SPEC /
      br-registry / WORKFLOW_MAP), not the code.
    · Type C (REPORT ONLY — the default): anything in the DO-NOT-FIX set, behind a default-false
      flag, half-wired/partial, OR any gap that cannot cite a BR/AC. Examples NEVER to "fix":
      patient-portal Phase 2 reads, patient-merge action (BR-020), AI ceph auto-tracing,
      clearinghouse e-submission, conflict-resolution UI.
  Before asserting "no test exists" or "no route exists," grep to confirm — subagents under-count
  coverage; verify negative claims.

STEP 5 — AUTOFIX each Type-A gap via TDD (skip entirely if autofix is disabled for a dry run):
    · RED: write the failing test first that pins the correct contract — backend handler test
      (services/api-ts/src/handlers/{M}/*.test.ts), contract test (specs/api/tests/contract/
      {M}.hurl), an FE unit test, or the webwright critical point — and confirm it fails.
    · GREEN: implement the fix at the TRUE SOURCE. For contract drift that means TypeSpec → regen
      → validator/handler/SDK/FE, never a band-aid. (Flag in your result that you ran a regen so
      the orchestrator can re-gate the blast radius.)
    · Honor the circuit breakers: max 5 fixes; stop a gap after 2 failed gate attempts.

STEP 5b — TEST BACKFILL (per verified workflow — do this even when no bug was found):
  For EACH workflow you drove in STEP 3b, ensure a test exists at the right layer. If one already
  covers it, leave it. If NOT, CREATE a passing test that pins the correct behavior (a green pin,
  not a RED-first — the workflow already works; you are locking it so it can't silently regress).
  GREP FIRST to avoid duplicating existing coverage (subagents under-count — verify before adding).
  Layer-selection rule (paths confirmed in-repo):
    · backend business rule / state-machine guard  → services/api-ts/src/handlers/{M}/*.test.ts
      (run via `bun run scripts/test-with-db.ts`, NOT `bun test`)
    · FE↔BE contract / response shape              → specs/api/tests/contract/{M}.hurl
    · UI affordance / summary-coherence / render    → FE unit in apps/dentalemon/src/features/{M}/**
      (reuse the DOM-oracle helpers exported from apps/dentalemon/src/test-utils.ts:
       parseMoney / assertTotalExplainedByRows / assertCountMatchesItems — derive expected from
       the rendered DOM, not the fixture)
    · whole user journey (smoke)                     → the {M}_smoke.py critical points already serve
  Backfilled tests MUST pass and count toward the gate. Commit them (conventional `test:` commit).
  Record the count + files in `tests_added` in the result schema.

STEP 6 — GATE (must be green before each commit; literal commands):
    · Typecheck (covers BOTH FE and api-ts):  `bun run typecheck`
      (If you need to isolate the backend:    `cd services/api-ts && bunx tsc --noEmit`)
    · Module backend tests (NEVER `bun test <path>`):
        `cd services/api-ts && bun run scripts/test-with-db.ts src/handlers/{M}`
      (DATABASE_URL defaults to local monobase_test; override only if your test DB differs and it
       MUST point at a monobase_test* database.)
    · Contract tests (RESTART the API first so it isn't stale):  `bun run test:contract`
    · FE quality:  `bun run lint`  and  `bun run check:boundaries`  and {M}'s FE unit tests.
    · Re-run the committed smoke green:
        `python apps/dentalemon/tests/smoke/{M}_smoke.py --base-url http://localhost:3003 --out docs/audits/workflow-verification/runs/{M}`

STEP 7 — COMMIT + RESULT: one atomic conventional commit per fix on the sweep branch (do NOT
  push). Return your structured result to the orchestrator (do not edit TRACKER.md yourself):

  RESULT SCHEMA (return as a fenced block):
    module: {M}
    status: DONE | NEEDS-REVIEW | BLOCKED
    rating: GREEN | YELLOW | ORANGE | RED        # IDEAL §11.1
    personas_driven: [...]
    workflows_verified: { happy: n, error: n, rbac_neg: n, coherence: n, affordance: n, cross: n }
    ideal_s4_seams_checked: [...]
    gaps_fixed: [ { id: BR-xxx|AC-xxx|shape-diff, priority: P0-P3, fix: "...", commit: <sha> } ]
    tests_added: [ { workflow: WF-xxx, layer: backend|contract|fe-unit|smoke, file: "...", commit: <sha> } ]
    doc_fixes: [ ... ]                            # Type B
    deferred_reported: [ { gap: "...", reason: "...", source: "IDEAL §x | audit | flag | no-citation" } ]
    ran_regen: true|false
    regen_operationIds: [...]                     # if ran_regen
    circuit_breaker_tripped: none | max-fixes | repeated-gate-fail
    evidence_path: docs/audits/workflow-verification/runs/{M}/
    gate: { typecheck: pass|fail, backend: ..., contract: ..., fe_unit: ..., lint_boundaries: ..., smoke: ... }

=========================== CROSS-MODULE E2E PHASE (after the module loop) ===========================
Per-module drives check each seam in isolation. This phase proves the IDEAL §4 journeys work as
ONE continuous browser flow crossing module boundaries — where a state set in module A must be
honored by module B. Reseed once (`bun run db:reseed`) so each journey starts clean. For each
journey, dispatch one subagent that drives it end-to-end as the relevant persona(s), leaves a
committable `apps/dentalemon/tests/smoke/xmod_{journey}_smoke.py`, and reports findings. Any seam
bug → SAME default-deny classify (STEP 4) → TDD fix (STEP 5) → gate (STEP 6) → commit. Record each
journey's result in TRACKER.md's "Cross-module journeys" table.

Journeys (IDEAL §4.1–§4.6 — drive the full chain, asserting the hand-off state at each boundary):
  X1 (§4.1) New patient → first visit → baseline chart → treatment plan
     register (dental-patient) → appointment/walk-in (scheduling) → check-in → workspace chart +
     diagnose (visit) → create plan items + estimate (treatment-plan). Assert: the new patient is
     findable; the visit's chart diagnoses flow into proposed plan items with a coherent total.
  X2 (§4.2) Existing patient → same-day treatment → billing → recall
     search patient → open workspace → mark treatment performed (visit) → completed work becomes an
     invoice item (billing) → record payment + receipt → balance drops → schedule recall.
     Assert THE KEY SEAM: a `performed` treatment surfaces as an invoice line; a `completed` visit
     unlocks billing; invoice total == sum of billed performed items (coherence across modules).
  X3 (§4.3) Emergency walk-in → diagnosis → direct same-day work → billing → follow-up
     create/find patient → walk-in visit (no prior appointment) → chart finding → record work with
     reason → charge + pay → follow-up task. Assert: walk-in needs no appointment; direct work is
     auditable; charges reflect the work.
  X4 (§4.4) Treatment-plan approval → partial completion
     open approved plan → complete ONE item → it becomes a completed procedure; remaining items
     stay pending; plan status → partially-completed; only completed items are billable.
  X5 (§4.5) Imaging attachment workflow  [REQUIRES MINIO — skip with a logged note if MinIO is down]
     upload/capture image (imaging) → categorize → link to patient/tooth/visit → preview in patient
     context. Assert the attachment is reachable from the clinical context it was linked to.
  X6 (§4.6) Offline-ready clinical workflow
     drive the sync-metadata surface: a locally-created record shows sync status (pending/synced)
     and references are preserved on reload. Assert per IDEAL §4.6 + the offline-sync E2E journey.

Each journey subagent returns: { journey: X#, status: PASS|GAPS|BLOCKED, seam_assertions:[...],
gaps_fixed:[...], deferred_reported:[...], smoke: xmod_{journey}_smoke.py, evidence_path }.
The orchestrator records these and re-gates the blast radius if any journey fix ran a regen.

=========================== GLOBAL RULES ===========================
- TDD always: no fix without a RED test first (VERTICAL_TDD.md).
- Test backfill: every workflow driven leaves a test at the right layer (STEP 5b) — create a green
  pin if none exists, even when the workflow already passes. No workflow exits unguarded.
- Default-deny: never "fix" a gap that can't cite a BR/AC; deferred/partial features are reported.
- RBAC negatives are driven (staff PIN 654321, free-tier 111111), not skipped.
- Cross-module §4 journeys are verified end-to-end in the final phase, not only at per-module seams.
- One module per fresh subagent, strictly sequential (drives share one stack + browser auth).
- Durable resume: TRACKER.md is the single source of progress; if compacted, resume from the
  first non-DONE row (then the cross-module phase if all modules are resolved).
- Never push, never open a PR. The user reviews the branch afterward.

=== PROMPT END ===
```

---

## Notes for the human running this

- **Cost shape:** each module is a multi-turn webwright drive + (sometimes) TDD fixes — budget
  for a long run. The per-module-subagent design keeps any single context bounded; the tracker is
  the resume point if a context is lost.
- **What it will NOT do:** invent features, fix deferred/Phase-2 items, push, or open PRs. Those
  are deliberate guardrails. If you *want* a deferred item built, that's a separate, scoped task.
- **After the run:** review the sweep branch commit-by-commit, read the TRACKER rollup for the
  NEEDS-REVIEW / REOPENED / BLOCKED list and the reported (unfixed) deferred gaps, then decide
  what to merge.
- **Re-runnable:** the committed `{module}_smoke.py` scripts double as permanent regression guards
  you can re-run any time against local/staging/prod with `--base-url`.
