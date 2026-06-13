# Per-module verification brief (executed by each module subagent)

> The orchestrator dispatches you with: **`M = <module>`** plus a short module-notes block.
> Execute THIS file end-to-end for that M. Repo root: `/Users/eladventures/Desktop/dentalemon`.
> Return the `result` block (very bottom) as your FINAL message — this is REQUIRED.

You verify module **{M}** against its specs by DRIVING THE LIVE FRONTEND WITH WEBWRIGHT, and fix
ONLY confirmed contract/behavior bugs via TDD. Work ONLY on {M}.

## ⛔ Execution order (LEAN single-activation flow — do NOT reorder)
Invoking `webwright:craft` **ends your turn** (its protocol tells you to "report back"), so the
drive must be the **LAST** thing you do, and your result must be **on disk before** it. Run in this
exact order:

1. STEP 0 → 1 → **3a** (static diff — highest-yield) → 4 → 5 (TDD-fix Type-A) → 5b (backfill
   backend/contract/FE-unit tests for the workflows you'll drive).
2. STEP 6 GATE — run every command **except the smoke** (typecheck, backend, `CONTRACT_ONLY={M}`
   contract, lint, boundaries, FE-unit). All green.
3. STEP 7a — COMMIT your fixes + backfill tests atomically. Write
   `docs/audits/workflow-verification/runs/{M}/REPORT.md` containing the fenced `result` block (with
   `smoke: pending-orchestrator`) + the analysis narrative.
4. STEP 7b — **LAST**: invoke `webwright:craft` to drive the live app + author the smoke. When it
   ends your turn, you are DONE — the orchestrator copies the crafted smoke to its canonical path,
   runs it, fills in the smoke result, and commits it. You do **not** package the smoke yourself.

A module with an uncommitted fix, or no `REPORT.md` with a `result` block on disk, is a FAILED run.
If you have NO FE surface (STEP 0 test), skip 7b entirely — just commit + write REPORT.md.

## Operational context (stack already running — do NOT boot it)
- Branch `chore/workflow-verification-sweep` is checked out. **Commit here. Never push / PR / switch
  branches.** Stage ONLY files you changed (`git add <path>`); NEVER `git add -A` / `commit -am`
  (the orchestrator holds an uncommitted TRACKER.md). Never `git add` `.venv/` or `.craft-*/`.
- API http://localhost:7213 (`bun src/index.ts`, **NO watch** → a STATIC snapshot). After ANY
  backend/regen change, and before any contract check or drive that hits it, RESTART:
  ```
  kill $(lsof -ti tcp:7213) 2>/dev/null; sleep 2
  (cd /Users/eladventures/Desktop/dentalemon/services/api-ts && nohup bun src/index.ts > /tmp/api-sweep.log 2>&1 &)
  for i in $(seq 1 40); do [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:7213/livez)" = "200" ] && echo up && break; sleep 1; done
  ```
- App (Vite) http://localhost:3003 — the base URL. Already running.
- **Docker is DOWN** → MinIO + Mailpit down → `/readyz`=503 storage=fail. FINE for every module
  except dental-imaging. The contract suite has a standing **8-file infra-fail baseline** (storage*,
  dental-imaging*, dental-assistant, billing-lifecycle, auth-verification, auth-password-reset) — do
  NOT treat those as your regression. You are contract-green iff **{M}'s own `.hurl` Succeeds** and
  you add no NEW failures beyond that set.
- Logins (email login → then PIN-select a profile):
  - `demo@dentalemon.com` / `DemoClinic1!` → PIN `123456` = Dr. Maria Reyes (dentist_owner) [owner]
  - same email → PIN `654321` = Ana Santos (staff_full) [front-desk; RBAC NEGATIVES]
  - `free@dentalemon.com` / `FreeClinic1!` → PIN `111111` = free-tier [tier-gate negatives]
- DB freshly reseeded before the sweep. Reseed if you mutate destructively: `bun run db:reseed`
  (needs API up; ~30s).

## STEP 0 — Resolve {M}'s spec artifacts
**FIRST read the cached global digest** `docs/audits/workflow-verification/runs/_global-spec-digest.md`
— it already distills the 5 global docs (IDEAL standard §3/§4/§7/§11/§12, personas + access matrix,
ROLE_PERMISSION_MATRIX, DOMAIN_MODEL §6 SM-*, br-registry buckets). Find {M}'s row there for the
owning persona, RBAC-negatives to drive, §4 seams, state machines, and DO-NOT-FIX items. Do NOT
re-read those 5 global docs in full — only drill into a cited section if the digest is insufficient.
Then read these **module-specific** artifacts directly (no Explore subagent needed):
- `docs/product/modules/{M}/MODULE_SPEC.md` (workflows/BRs/perms/state-transitions/ACs/error-table). If absent → IDEAL §3 + `specs/api/src/modules/{M}.tsp` (spec-light → reduced confidence; lean on the .tsp + handler code).
- `specs/api/src/modules/{M}.tsp` (operations) + the {M} bucket in `specs/api/docs/standards/br-registry.json`.
- `.understand-anything/contract-spine.json` → filter {M}'s operationIds → handler → sdkHooks → consumers under `apps/dentalemon/src/`.
- `docs/audits/modules/MODULE_{M}_AUDIT_*.md` "Ranked Remaining Gaps" (DO-NOT-FIX / report-only).
- {M}'s FE route in `docs/product/NAVIGATION_MAP.md`; {M} error codes in `docs/product/ERROR_TAXONOMY.md`; {M} WF-IDs in `docs/product/WORKFLOW_MAP.md`.
**FE-SURFACE TEST**: {M} "has FE surface" iff a NAVIGATION_MAP route AND ≥1 contract-spine consumer file under `apps/dentalemon/src/`. If NOT → skip the browser drive, do STEP 3a only, and STILL backfill/gate/commit any 3a fix + return the result block.

## STEP 1 — Verification matrix (two layers)
- Intra-module: each WF-xxx (actor/preconditions/steps/postconditions) → FE route; each entity state machine + cross-workflow transitions (who sets each state, who must honor it).
- Cross-module: for each IDEAL §4 journey {M} touches, note the HAND-OFF state at the seam (verify {M}'s side; full §4 chains run in a later phase).

## STEP 3a — STATIC CONTRACT DIFF (highest yield — do even with no FE surface)
For each {M} operationId compare the shape across layers: `.tsp` ↔ generated validator (`services/api-ts/src/generated/openapi/validators.ts`) ↔ handler return ↔ SDK type (`packages/sdk-ts/src/generated/types.gen.ts`) ↔ FE consumer usage (contract-spine paths). ANY mismatch (extra/dropped field, `{data,pagination}` vs `{items}`, optional/required skew, wrong status) = CONFIRMED Type-A bug even if the UI renders fine. (This is how dental-org's 3 drifts were found.)

## STEP 3b — DRIVE THE LIVE FRONTEND WITH WEBWRIGHT  ⟵ do this LAST (after 7a), it ends your turn
This is your FINAL action — only run it once your fixes are committed and `runs/{M}/REPORT.md` (with
the `result` block) is on disk. Invoke the **`webwright:craft`** skill (Skill tool) to drive the live
app at http://localhost:3003 code-as-action AND to author `apps/dentalemon/tests/smoke/{M}_smoke.py`.
Leave the crafted script in webwright's `.craft-{M}/` output — the **orchestrator** copies it to the
canonical path, runs it, and commits it. Do NOT copy/commit the smoke yourself. Read
`apps/dentalemon/tests/smoke/patient_registration_smoke.py` FIRST as the required template (headless
Firefox, viewport 1280x1800, argparse `--base-url` default http://localhost:3003 + `--email/--password/
--owner-pin/--owner-profile/--staff-pin/--staff-profile/--out`, run-unique timestamped data, prints
`CP{n} PASS/FAIL`, `step 0 params:` line, exits 0 iff all CPs pass, screenshots+log to `--out`). Drive
AS THE OWNING PERSONA. Cover, to max depth:
- happy path end-to-end as the correct persona;
- main error/guard path surfaced in the UI (write-to-locked → blocked message, etc.);
- **RBAC NEGATIVES** from the persona matrix — DRIVE them (staff Ana 654321 denied an owner-only action; free-tier 111111 tier gate if any). Read-only/locked states honored;
- **COHERENCE ORACLE**: every summary total == sum of rendered rows — derive expected from the rendered DOM, not a fixture;
- **AFFORDANCE ORACLE**: every spec'd action (workflow + permission) has a reachable UI control;
- **CROSS-WORKFLOW / HISTORICAL STATE**: a state set in one workflow shows correctly downstream.
If webwright cannot complete a drive for an unforeseen reason, REPORT it — do NOT silently substitute
hand-written Playwright, and do NOT block DONE solely on a drive that failed for env reasons.

## STEP 4 — CLASSIFY each gap (DEFAULT-DENY)
- **Type A (FIXABLE)** ONLY IF it cites a concrete authority: a specific BR-xxx / AC-xxx in {M}'s OWN MODULE_SPEC or br-registry.json, OR a static shape mismatch from 3a, OR a broken happy-path / failed coherence-oracle on a workflow the spec marks BUILT. No citation ⇒ NOT Type A.
- **Type B (DOC DRIFT)**: code correct, doc stale → fix the DOC, not code.
- **Type C (REPORT ONLY — default)**: DO-NOT-FIX set, default-false flag, half-wired/partial, or any gap that can't cite a BR/AC. NEVER "fix" deferred/Phase-2 (patient-portal Phase-2 reads, patient-merge BR-020, AI ceph auto-tracing, clearinghouse e-submission, conflict-resolution UI, etc.).
- GREP to confirm before any "no test/route exists" claim — subagents under-count coverage.

## STEP 5 — AUTOFIX each Type-A gap via TDD
- **RED**: failing test FIRST pinning the correct contract (backend `services/api-ts/src/handlers/{M}/*.test.ts`, contract `specs/api/tests/contract/{M}.hurl`, FE unit, or smoke CP) — confirm it FAILS.
- **GREEN**: fix at the TRUE SOURCE. Contract drift → TypeSpec (`specs/api/src/modules/{M}.tsp`) → regen (`cd specs/api && bun run build` then `cd services/api-ts && bun run generate`) → validator/handler/SDK/FE. RESTART the API after regen. If you regen, report `ran_regen: true` + `regen_operationIds` (orchestrator re-gates the blast radius).
- **Circuit breakers**: max 5 fixes/module → else stop, report rest, status NEEDS-REVIEW. A gap still red after 2 attempts → stop it, NEEDS-REVIEW/BLOCKED.

## STEP 5b — TEST BACKFILL (per verified workflow, even when no bug found)
For EACH workflow you drove, ensure a test exists at the right layer. **GREP FIRST** (don't duplicate). If none, CREATE a PASSING green pin (the workflow already works; you're locking it). Layers: backend rule/state-guard → `handlers/{M}/*.test.ts`; FE↔BE shape → `contract/{M}.hurl`; UI affordance/coherence → FE unit in `apps/dentalemon/src/features/{M}/**` (reuse DOM-oracle helpers from `apps/dentalemon/src/test-utils.ts`: `parseMoney`/`assertTotalExplainedByRows`/`assertCountMatchesItems`); whole journey → the smoke CPs. Backfilled tests MUST pass. Record in `tests_added`.

## STEP 6 — GATE (run EVERY command; all green before each commit)
- Typecheck (FE+api-ts): `cd /Users/eladventures/Desktop/dentalemon && bun run typecheck`
- **Backend (NOTE the DB override — `.env` sets `monobase`, which the runner REFUSES):**
  `cd /Users/eladventures/Desktop/dentalemon/services/api-ts && DATABASE_URL=postgres://postgres:password@localhost:5432/monobase_test bun run scripts/test-with-db.ts src/handlers/{M}`
- Contract — run ONLY {M}'s file (RESTART API first if you changed backend/regen): `cd /Users/eladventures/Desktop/dentalemon && CONTRACT_ONLY={M} bun run test:contract` (the `CONTRACT_ONLY` filter runs just `{M}.hurl` in ~1s instead of the 60s full suite — the orchestrator runs the full suite on regen + at the end). Pass iff `{M}.hurl` Succeeds.
- Lint: `cd /Users/eladventures/Desktop/dentalemon && bun run lint` (gate = 0 ERRORS; warnings OK).
- Boundaries: `cd /Users/eladventures/Desktop/dentalemon/services/api-ts && bun run check:boundaries:{M}` if that script exists, else `bun run check:boundaries`.
- **FE unit (uses `bun:test`, NOT vitest):** `cd /Users/eladventures/Desktop/dentalemon/apps/dentalemon && bun test <path-to-{M}-tests>`
- (Smoke is run by the ORCHESTRATOR after your STEP 3b drive — do NOT run it here. The venv lives at `apps/dentalemon/tests/smoke/.venv/bin/python` for reference.)
Pre-existing failure unrelated to {M} that you didn't introduce: note it; it doesn't block you. Anything YOU changed must be green.

## STEP 7a — COMMIT + REPORT (do this BEFORE the STEP 3b drive)
1. Commit your Type-A fixes + backfill tests atomically on the sweep branch (one `fix:`/`test:` commit per logical change). Do NOT push. Stage ONLY your files; never `git add -A`; never stage TRACKER.md.
2. Write `docs/audits/workflow-verification/runs/{M}/REPORT.md` = the fenced `result` block below (set `smoke: pending-orchestrator`, `commits: [...]` with your real shas) followed by a concise narrative (personas, CP plan, gaps-fixed-with-citations, deferred-reported, gate results). `mkdir -p` the runs/{M}/ dir.
3. THEN do STEP 3b (the webwright drive) as your LAST action. The orchestrator reads your REPORT.md, copies the crafted `.craft-{M}/.../final_script.py` → `apps/dentalemon/tests/smoke/{M}_smoke.py`, runs it, fills in the `smoke:` field, and commits the smoke + screenshots/log. You do NOT package or commit the smoke.

If you have NO FE surface (STEP 0 test fails): skip STEP 3b; your REPORT.md `smoke: n/a (no FE surface)` and you are done after committing.

The `result` block (embed it at the top of REPORT.md, fenced):

```result
module: {M}
status: DONE | NEEDS-REVIEW | BLOCKED
rating: GREEN | YELLOW | ORANGE | RED
personas_driven: [...]
workflows_verified: { happy: n, error: n, rbac_neg: n, coherence: n, affordance: n, cross: n }
ideal_s4_seams_checked: [...]
gaps_fixed: [ { id, priority, fix, commit } ]
tests_added: [ { workflow, layer, file, commit } ]
doc_fixes: [ ... ]
deferred_reported: [ { gap, reason, source } ]
ran_regen: true|false
regen_operationIds: [...]
circuit_breaker_tripped: none | max-fixes | repeated-gate-fail
evidence_path: docs/audits/workflow-verification/runs/{M}/
gate: { typecheck, backend, contract, fe_unit, lint_boundaries, smoke }
commits: [<sha> ...]
```

GLOBAL RULES: TDD always (RED before fix). Default-deny (no fix without BR/AC citation; report deferred/partial). RBAC negatives driven, not skipped. Drive via webwright — never silently substitute hand-Playwright. Grep to verify negative claims. Never push / PR / switch branches. Prioritize STEP 3a (static drift) + happy-path + RBAC-negative drives. **Finish all 7 steps and return the result block.**
