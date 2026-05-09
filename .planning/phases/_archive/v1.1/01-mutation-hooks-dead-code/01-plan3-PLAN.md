---
plan: "01-plan3"
phase: "1"
wave: 2
depends_on: ["01-plan1"]
requirements_addressed: [MUT-02]
files_modified:
  - apps/dentalemon/src/features/workspace/hooks/use-visit.ts
  - apps/dentalemon/src/features/workspace/hooks/use-dental-chart.ts
  - apps/dentalemon/src/features/workspace/hooks/use-visit.test.ts
  - apps/dentalemon/src/features/workspace/hooks/use-dental-chart.test.ts
autonomous: true
must_haves:
  goal: "Dead stub files and their tests are deleted from the codebase. No import anywhere references the deleted files."
  truths:
    - "use-visit.ts does not exist"
    - "use-dental-chart.ts does not exist"
    - "use-visit.test.ts does not exist"
    - "use-dental-chart.test.ts does not exist"
    - "No file in the codebase imports from './use-visit' or './use-dental-chart' (the stubs)"
    - "bun run typecheck passes with no broken import errors"
    - "bun test passes with no test referencing the deleted stubs"
---

<objective>
Delete the two dead stub hook files and their associated test files. Verify no imports of the deleted stubs remain.

Purpose: Remove misleading code that was never used by the app and that conflicts with the real hook implementations (use-visits.ts, use-dental-chart-query.ts).
Output: Four files deleted, codebase has zero references to the stubs.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md

<!-- Read before deleting to confirm nothing imports these -->
@apps/dentalemon/src/features/workspace/hooks/use-visit.ts
@apps/dentalemon/src/features/workspace/hooks/use-dental-chart.ts
@apps/dentalemon/src/features/workspace/hooks/use-visit.test.ts
@apps/dentalemon/src/features/workspace/hooks/use-dental-chart.test.ts

<interfaces>
<!-- These are the REAL hooks that replaced the stubs — do NOT delete these -->
apps/dentalemon/src/features/workspace/hooks/use-visits.ts         ← KEEP (plural, TanStack Query)
apps/dentalemon/src/features/workspace/hooks/use-dental-chart-query.ts  ← KEEP (real hook)

<!-- These are the stubs to delete -->
apps/dentalemon/src/features/workspace/hooks/use-visit.ts          ← DELETE (plain function, not React hook)
apps/dentalemon/src/features/workspace/hooks/use-dental-chart.ts   ← DELETE (closure state, not React state)
apps/dentalemon/src/features/workspace/hooks/use-visit.test.ts     ← DELETE (tests the deleted stub)
apps/dentalemon/src/features/workspace/hooks/use-dental-chart.test.ts  ← DELETE (tests the deleted stub)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Confirm no live imports then delete four dead files</name>
  <files>
    apps/dentalemon/src/features/workspace/hooks/use-visit.ts
    apps/dentalemon/src/features/workspace/hooks/use-dental-chart.ts
    apps/dentalemon/src/features/workspace/hooks/use-visit.test.ts
    apps/dentalemon/src/features/workspace/hooks/use-dental-chart.test.ts
  </files>

  <read_first>
    - apps/dentalemon/src/features/workspace/hooks/use-visit.ts — confirm it is still a plain function stub, not a real hook
    - apps/dentalemon/src/features/workspace/hooks/use-dental-chart.ts — confirm it is the closure-state stub
  </read_first>

  <action>
Step 1 — Verify no production code imports the stubs.

Run this check before deleting:
```bash
grep -r "from.*use-visit'" apps/dentalemon/src --include="*.ts" --include="*.tsx" | grep -v "use-visit.test" | grep -v "use-visits"
grep -r "from.*use-dental-chart'" apps/dentalemon/src --include="*.ts" --include="*.tsx" | grep -v "use-dental-chart.test" | grep -v "use-dental-chart-query"
```

Expected: both commands return empty output (no production imports).

If either command returns output showing an import in a non-test file, STOP and report the file path. Do not delete until the import is removed.

Step 2 — Delete the four files using Bash:
```bash
rm apps/dentalemon/src/features/workspace/hooks/use-visit.ts
rm apps/dentalemon/src/features/workspace/hooks/use-dental-chart.ts
rm apps/dentalemon/src/features/workspace/hooks/use-visit.test.ts
rm apps/dentalemon/src/features/workspace/hooks/use-dental-chart.test.ts
```

Step 3 — Verify deletion:
```bash
ls apps/dentalemon/src/features/workspace/hooks/
```

Expected output should NOT include use-visit.ts, use-dental-chart.ts, use-visit.test.ts, use-dental-chart.test.ts.

Step 4 — Run typecheck to confirm no broken imports:
```bash
cd /Users/eladventures/Desktop/dentalemon && bun run typecheck
```

Step 5 — Run tests to confirm no test regressions:
```bash
cd /Users/eladventures/Desktop/dentalemon && bun test
```
  </action>

  <acceptance_criteria>
    - ls apps/dentalemon/src/features/workspace/hooks/use-visit.ts returns "No such file" error
    - ls apps/dentalemon/src/features/workspace/hooks/use-dental-chart.ts returns "No such file" error
    - ls apps/dentalemon/src/features/workspace/hooks/use-visit.test.ts returns "No such file" error
    - ls apps/dentalemon/src/features/workspace/hooks/use-dental-chart.test.ts returns "No such file" error
    - grep -r "from.*use-visit'" apps/dentalemon/src --include="*.ts" --include="*.tsx" | grep -v "use-visits" returns empty
    - bun run typecheck passes
    - bun test passes (all tests, no regressions from deleted test files)
  </acceptance_criteria>

  <verify>
    <automated>cd /Users/eladventures/Desktop/dentalemon && bun run typecheck 2>&1 | tail -5 && bun test 2>&1 | tail -10</automated>
  </verify>

  <done>Four stub files deleted, zero broken imports, bun run typecheck and bun test both pass.</done>
</task>

</tasks>

<verification>
```bash
cd /Users/eladventures/Desktop/dentalemon
# Files gone
test ! -f apps/dentalemon/src/features/workspace/hooks/use-visit.ts && echo "GONE" || echo "STILL EXISTS"
test ! -f apps/dentalemon/src/features/workspace/hooks/use-dental-chart.ts && echo "GONE" || echo "STILL EXISTS"
# No stray imports
grep -r "from.*use-visit'" apps/dentalemon/src --include="*.ts" --include="*.tsx" | grep -v "use-visits"
grep -r "from.*use-dental-chart'" apps/dentalemon/src --include="*.ts" --include="*.tsx" | grep -v "use-dental-chart-query"
# Quality gates
bun run typecheck
bun test
```
</verification>

<success_criteria>
- use-visit.ts, use-dental-chart.ts, use-visit.test.ts, use-dental-chart.test.ts — all deleted
- Zero imports of the deleted stubs in non-test files
- bun run typecheck clean
- bun test passes
</success_criteria>

<output>
After completion, create .planning/phases/01-mutation-hooks-dead-code/01-plan3-SUMMARY.md
</output>
