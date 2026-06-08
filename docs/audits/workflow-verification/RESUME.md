# RESUME — paste this into a fresh session after /clear

Paste everything in the fenced block below. It resumes the in-progress workflow-verification sweep
from the first non-DONE module (currently #4 dental-scheduling) using the lean single-activation flow.
Nothing is lost on /clear — all progress is in git on `chore/workflow-verification-sweep` + memory.

```
Resume the live-frontend workflow-verification sweep of the dentalemon dental app. You are the
orchestrator. The branch `chore/workflow-verification-sweep` is already checked out with modules 1–3
DONE; do NOT re-run preconditions 0a/0b/0e and do NOT re-create the branch.

READ FIRST (in this order):
- docs/audits/workflow-verification/TRACKER.md  — the ledger + resume point. Resume from the FIRST
  row whose Status ≠ DONE (currently #4 dental-scheduling). Also read its "Environment baseline"
  (Docker-down 8-file contract infra baseline + the RBAC-PIN backend-identity caveat).
- docs/audits/workflow-verification/_PER_MODULE_BRIEF.md  — the lean per-module flow you hand each
  subagent (it already encodes: webwright:craft ends a subagent turn → drive LAST + write
  runs/{M}/REPORT.md before it → orchestrator packages the smoke; CONTRACT_ONLY={M} per-module gate;
  monobase_test backend-DB override; bun test FE runner).
- docs/audits/workflow-verification/runs/_global-spec-digest.md  — cached global specs (per-module
  owner/RBAC-negatives/§4-seams/state-machines/DO-NOT-FIX). Subagents read this, not the 5 raw docs.
- docs/audits/workflow-verification/PROMPT.md  — the canonical orchestrator spec + CROSS-MODULE E2E
  phase (X1–X6) + final rollup.

STACK (likely still running from the prior session — verify, don't re-boot blindly):
- curl -s -o /dev/null -w '%{http_code}' http://localhost:7213/livez   (expect 200)
- curl -s -o /dev/null -w '%{http_code}' http://localhost:3003          (expect 200)
- If API is down: kill $(lsof -ti tcp:7213) 2>/dev/null; (cd services/api-ts && nohup bun src/index.ts > /tmp/api-sweep.log 2>&1 &); wait for livez=200.
- DB = local Postgres `monobase` on :5432 (Docker down → no MinIO/Mailpit; /readyz storage=fail is FINE
  except for #8 dental-imaging, which hard-requires MinIO). Reseed only if a module mutated it badly:
  `bun run db:reseed`.

THE LOOP — for each TRACKER row top-to-bottom with Status ≠ DONE, STRICTLY ONE AT A TIME:
1. Set the row → IN-PROGRESS in TRACKER.md.
2. Dispatch ONE subagent (Agent tool, subagent_type general-purpose, mode bypassPermissions, a unique
   name) whose prompt = "Read docs/audits/workflow-verification/_PER_MODULE_BRIEF.md IN FULL and
   execute it for M=<module>" + a short module-notes block (handler dir, tsp, contract file, smoke
   target, personas + RBAC-negatives from the digest, DO-NOT-FIX items, the exact backend-test
   command with DATABASE_URL=postgres://postgres:password@localhost:5432/monobase_test, and
   check:boundaries:<module> if it exists). WAIT for it — never run two module subagents concurrently
   (they share one stack + browser and WILL collide).
3. The subagent commits its fixes + writes runs/{M}/REPORT.md (result block, smoke: pending-orchestrator),
   then does the webwright drive LAST (which ends its turn). YOU then: copy
   .craft-{M}/.../final_script.py → apps/dentalemon/tests/smoke/{M}_smoke.py, run it via
   apps/dentalemon/tests/smoke/.venv/bin/python ... --out runs/{M}, commit the smoke + screenshots +
   REPORT.md, and fill in the smoke result. If the smoke fails on a script/selector issue (not a
   product bug), note it as a P3 and don't block DONE.
4. REGEN BLAST-RADIUS RE-GATE: if the subagent reports ran_regen, YOU run the FULL gate (bun run
   typecheck) + the FULL contract suite (bun run test:contract) and re-run committed smokes for any
   other module sharing the regenerated operationIds; mark any broken prior module REOPENED.
5. Update the TRACKER row → DONE (rating, gaps fixed, tests added, deferred-reported, evidence,
   commit shas) + append the per-module detail block, and COMMIT TRACKER.md separately
   (docs(workflow-verification): ...). Then next module.

AFTER all module rows are DONE/NEEDS-REVIEW/BLOCKED → run the CROSS-MODULE E2E PHASE (X1–X6 from
PROMPT.md: reseed once, one subagent per journey driving the full chain end-to-end, assert the
hand-off seam at each boundary, TDD-fix seam bugs, commit a xmod_{journey}_smoke.py). Then write the
Rollup at the top of TRACKER.md (module counts + journey results + human-follow-up list + aggregated
deferred-reported gaps).

GUARDRAILS: default-deny — fix ONLY bugs that cite a BR/AC or a STEP-3a static shape mismatch; REPORT
deferred/Phase-2 items, never build them. TDD always (RED before fix). RBAC-negatives: drive FE
route-guard/hidden-control denials via the demo PINs, but pin BACKEND-403 negatives at the
unit/contract layer (the demo PIN does NOT re-scope the backend identity). Commit per fix on
chore/workflow-verification-sweep; stage only your files; never git add -A; never stage another
agent's WIP. DO NOT push and DO NOT open a PR.

Optional cleanup carried over: module 3's dental-patient_smoke.py CP2+ has a register-btn
selector-hardening TODO (P3) — harden if convenient, otherwise leave it noted.

Start by reading TRACKER.md, confirming the stack is up, then dispatch module #4 dental-scheduling.
```
