# GO — launch the workflow-verification sweep

Paste the block below into a fresh Claude Code session at the repo root. Everything it needs
lives in `PROMPT.md` (the procedure) and `TRACKER.md` (the worklist); this is just the trigger.

```
Execute the dentalemon workflow-verification sweep.

1. Read docs/audits/workflow-verification/PROMPT.md and follow it exactly (preconditions →
   per-module STEP 0–8 → CROSS-MODULE E2E phase → final rollup).
2. Work through docs/audits/workflow-verification/TRACKER.md top-to-bottom, ONE module at a time:
   for each module, fix every real bug AND backfill the per-workflow tests AND get the gate green
   AND commit — before moving to the next module. Then run the CROSS-MODULE E2E phase.
3. Keep the default-deny guardrail: fix confirmed bugs only; REPORT deferred/Phase-2 items, never
   build them.
4. Do not push and do not open a PR. Update TRACKER.md as you go; write the final rollup when done.

Start now.
```

That's it. If you want a single module instead of the full sweep, add: "Process only module
`<name>` from TRACKER.md, then stop." For a no-fix audit, add: "Autofix DISABLED — report only."
