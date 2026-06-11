# 04 — AHA Module/Group Fix with TDD

Use this prompt after both files already exist:

1. Raw module/group gap plan from `02-module-or-group-audit-gap-plan.md`
2. Fix-ready plan from `03-organize-gap-plan-for-fixing.md`

Module/group to fix:

`[MODULE_OR_GROUP_NAME]`

Module/group slug:

`[MODULE_SLUG]`

Selected fix batch to execute:

`[SELECTED_FIX_BATCH]`

Do not redo the audit.

Do not reorganize the gap plan.

Do not expand scope beyond the fix-ready plan unless a blocking dependency is discovered.

Goal: fix the selected module/group using a test-first or test-supported approach, with minimal, evidence-based changes.

---

## 1. Load Required AHA Files

Load and strictly follow:

`[CODEBASE_ROOT]/docs/aha/prompts/00-aha-shared-rules.md`

Load:

`[CODEBASE_ROOT]/docs/aha/outputs/module-audit-index.md`

Load the selected module/group raw gap plan:

`[CODEBASE_ROOT]/docs/aha/module-gap-plans/[MODULE_SLUG]-gap-plan.md`

Load the selected module/group fix-ready plan:

`[CODEBASE_ROOT]/docs/aha/module-fix-plans/[MODULE_SLUG]-fix-ready-plan.md`

Load if available:

`[CODEBASE_ROOT]/docs/aha/kg/knowledge-graph-status.md`

`[CODEBASE_ROOT]/docs/aha/kg/domain-knowledge-status.md`

If available and directly relevant, also load:

`[CODEBASE_ROOT]/docs/aha/outputs/cross-cutting-pattern-audit.md`

`[CODEBASE_ROOT]/docs/aha/outputs/database-schema-audit.md`

Use cross-cutting and database/schema audits only as context.

Do not allow them to expand this fix run beyond the selected module/group and selected batch.

If the raw gap plan is missing, stop and run:

`[CODEBASE_ROOT]/docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

for this module/group first.

If the fix-ready plan is missing, stop and run:

`[CODEBASE_ROOT]/docs/aha/prompts/03-organize-gap-plan-for-fixing.md`

for this module/group first.

Use the fix-ready plan as the primary implementation guide.

Use the raw gap plan only as supporting context.

Do not treat old audit files outside `[CODEBASE_ROOT]/docs/aha/` as authoritative unless the current AHA files explicitly reference them.

---

## 2. Module Slug Rule

Use the module/group slug from:

`[CODEBASE_ROOT]/docs/aha/outputs/module-audit-index.md`

If the slug is missing, derive it from `[MODULE_OR_GROUP_NAME]` using the shared slug rule:

* lowercase
* kebab-case
* no spaces
* no slashes
* no ampersands
* no parentheses
* no special characters

Examples:

```txt
Patient Management → patient-management
Auth/RBAC → auth-rbac
Billing & Claims → billing-claims
Lab Results / Diagnostics → lab-results-diagnostics
```

Use the readable module/group name inside the document title.

Use `[MODULE_SLUG]` in filenames.

Do not save files using the readable module/group name.

Correct input paths:

```txt
[CODEBASE_ROOT]/docs/aha/module-gap-plans/[MODULE_SLUG]-gap-plan.md
[CODEBASE_ROOT]/docs/aha/module-fix-plans/[MODULE_SLUG]-fix-ready-plan.md
```

Correct output path:

```txt
[CODEBASE_ROOT]/docs/aha/module-fix-plans/[MODULE_SLUG]-fix-report.md
```

---

## 3. Superpowers Requirement

Before implementing fixes, invoke `/using-superpowers` or the available Superpowers agent if available.

Use it specifically to support:

1. selecting the correct test-first strategy
2. identifying the safest fix order from the fix-ready plan
3. debugging failing tests
4. avoiding overbroad implementation
5. validating that each fix addresses the real root cause
6. ensuring the implementation remains within the selected batch
7. preventing fake-green tests or weakened assertions
8. avoiding accidental implementation of deferred or do-not-build items

The Superpowers agent must follow these constraints:

* use the fix-ready plan as the primary guide
* do not expand scope
* do not implement `V2 DEFERRED` items
* do not implement `DO NOT ADD` items
* do not perform unrelated refactors
* do not skip tests unless clearly justified
* document if test-first is not practical
* do not weaken tests just to make them pass

If `/using-superpowers` is unavailable, proceed with the normal TDD process and record this in the fix report under Limitations.

---

## 4. Fix Scope

Fix only the active fix scope and selected batch defined in:

`[CODEBASE_ROOT]/docs/aha/module-fix-plans/[MODULE_SLUG]-fix-ready-plan.md`

Prioritize only:

1. `P0` gaps
2. `P1` gaps
3. selected `P2` gaps required for workflow completeness
4. `V1 REQUIRED` items
5. selected `V1 RECOMMENDED` items when they are low-risk and directly improve reliability, usability, trust, safety, or testability

Do not implement:

* `V2 DEFERRED` items
* `DO NOT ADD` items
* speculative enhancements
* unrelated refactors
* unrelated cleanup
* purely cosmetic changes
* optional enterprise features
* items excluded by the fix-ready plan
* items from later unselected batches
* items blocked by missing specs
* items blocked by unresolved product decisions
* items blocked by environment/tooling issues

If the fix-ready plan defines multiple batches, execute only:

`[SELECTED_FIX_BATCH]`

If no batch is explicitly selected, execute only the first recommended batch from the fix-ready plan.

Do not continue to later batches unless explicitly instructed.

If a fix requires touching shared/platform/database files, keep the change minimal and mark it as:

`[SHARED DEPENDENCY]`

or:

`[CROSS-MODULE RISK]`

Document why the shared change is necessary.

If a required shared/platform/database change is too broad or risky for the selected module batch, stop and document it as blocked or requiring a separate specialized fix.

---

## 5. Git / Working Tree Safety

Before modifying files:

1. Check the working tree status if git is available.
2. Record whether the working tree status was checked.
3. Do not overwrite unrelated user changes.
4. Do not revert unrelated files.
5. Do not use broad reset, checkout, clean, or destructive git commands.
6. If there are existing uncommitted changes in files you need to touch, inspect them first and preserve them.
7. If a file has unrelated existing changes, only modify the lines needed for the selected fix.
8. Do not reformat entire files unless formatting is directly required by the selected fix.
9. Document any pre-existing dirty working tree concerns in the fix report.

Forbidden commands unless explicitly approved by the user:

```bash
git reset --hard
git checkout .
git clean -fd
git restore .
rm -rf
```

If the working tree is too dirty to safely continue, stop and document:

`[BLOCKED BY ENVIRONMENT]`

Do not attempt risky edits.

---

## 6. TDD / Test Rules

Before or during each fix:

1. Add or update the most relevant failing test where practical.
2. Follow the Test-First Plan from the fix-ready plan.
3. Prefer focused tests over broad brittle tests.
4. Cover the workflow, not just the function.
5. Add regression tests for every fixed bug.
6. Use Playwright/E2E only for core journeys that need browser-level proof.
7. Do not fake success by weakening tests.
8. Do not delete failing tests unless they are obsolete and replaced with better coverage.
9. If a test cannot be added due to environment/tooling limits, document why.
10. If relevant tests already fail before changes, record the baseline failure before implementing fixes.

Test types to consider:

* backend/unit
* frontend/component
* integration
* E2E/Playwright
* permission/RBAC
* data/schema
* regression
* domain workflow

Prefer tests that prove real behavior:

* form submits
* data persists
* data reloads
* API and UI agree
* permission is enforced
* downstream effect occurs
* broken journey is fixed
* validation prevents invalid data
* useful error state appears
* regression is prevented

Do not create broad E2E suites for every issue.

Use E2E/Playwright only for core user journeys where browser-level proof is needed.

---

## 7. Implementation Rules

1. Make the smallest correct change.
2. Preserve existing working behavior.
3. Avoid broad refactors.
4. Avoid unrelated formatting churn.
5. Keep shared/platform changes minimal.
6. If touching shared files, identify likely consumers and blast radius.
7. If touching schema/migrations, add relevant data/schema tests where practical.
8. If changing permissions, add permission/RBAC tests.
9. If changing UI save behavior, prove save/reload/downstream effect.
10. If changing API behavior, prove frontend and backend remain aligned.
11. If changing state management, prove reload and refresh behavior.
12. If changing validation, prove both success and failure paths.
13. If changing error handling, prove the user sees a useful error state.
14. Do not implement deferred items even if they seem easy.
15. Do not implement do-not-build items.
16. Do not silently change public APIs without updating affected tests.
17. Do not introduce a new abstraction unless the selected fix batch explicitly requires it.
18. Do not add new dependencies unless necessary and justified.

If implementation reveals that the fix-ready plan is wrong or incomplete, do not broaden scope automatically.

Instead:

* fix only what remains safe and within the selected batch
* document the mismatch
* mark unresolved items as `[NEEDS CONFIRMATION]`, `[NEEDS PRODUCT DECISION]`, or `[BLOCKED BY ENVIRONMENT]`

---

## 8. Use Case Completeness Guardrail

Use the fix-ready plan and the raw gap plan’s use case completeness section.

Fix only use cases labeled:

* `V1 REQUIRED`
* selected `V1 RECOMMENDED`

Do not build every possible workflow.

Do not turn V1 into an enterprise wishlist.

If a missing use case seems bigger than the current module/group fix scope, document it as:

`[NEEDS PRODUCT DECISION]`

or move it to:

`V2 DEFERRED`

Do not implement it during this run.

---

## 9. Required Fix Process

For each selected fix from the fix-ready plan:

1. Identify the Fix ID from the fix-ready plan.
2. Identify the related gap from the raw gap plan.
3. Identify expected behavior.
4. Identify existing files/tests involved.
5. Invoke `/using-superpowers` guidance when available, especially before implementation or debugging.
6. Check relevant baseline tests if practical.
7. Add or update the relevant failing test where practical.
8. Run the focused test if possible and confirm it fails for the expected reason.
9. Implement the smallest correct fix.
10. Run the focused test again.
11. Run relevant module-level checks.
12. Run affected shared checks if shared/platform files were touched.
13. Record the outcome.
14. Continue only to the next selected Fix ID in the current batch.

Do not skip directly to implementation unless there is a clear reason testing first is not practical.

If test-first is not practical, use test-supported fixing and document the reason.

---

## 10. Webwright / Playwright Use

Use `/webwright` only if exploratory UI verification is needed during the fix.

Use Playwright or existing E2E tooling when browser-level proof is needed for a core journey.

Examples:

* form saves correctly
* saved data reloads correctly
* button has real downstream effect
* navigation works
* role restrictions are enforced
* API result appears correctly in UI
* regression journey is protected

Do not create broad E2E suites for non-core or low-risk items.

If Webwright or Playwright produces evidence, save it under:

```txt
[CODEBASE_ROOT]/docs/aha/evidence/screenshots/
[CODEBASE_ROOT]/docs/aha/evidence/playwright-findings/
[CODEBASE_ROOT]/docs/aha/evidence/webwright-findings/
```

---

## 11. Validation Commands

Run the most relevant available commands.

Examples:

```bash
typecheck
lint
test
unit tests
integration tests
E2E tests
module-specific tests
affected shared tests
```

Use the actual commands from the codebase.

Do not claim a command passed unless it actually ran.

If a command fails, determine whether the failure is:

* related to this fix
* pre-existing
* environment/tooling-related
* unrelated but blocking

Document clearly.

If validation cannot be run, document why.

Do not mark a fix as fully complete without either:

* passing relevant validation, or
* clearly documenting why validation was blocked and what evidence supports the fix.

---

## 12. Required Output File

Create and save:

`[CODEBASE_ROOT]/docs/aha/module-fix-plans/[MODULE_SLUG]-fix-report.md`

The file must use this structure:

```md
# AHA Module/Group Fix Report: [MODULE_OR_GROUP_NAME]

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group |  |
| Module slug |  |
| Raw gap plan used | `[CODEBASE_ROOT]/docs/aha/module-gap-plans/[MODULE_SLUG]-gap-plan.md` |
| Fix-ready plan used | `[CODEBASE_ROOT]/docs/aha/module-fix-plans/[MODULE_SLUG]-fix-ready-plan.md` |
| Output fix report | `[CODEBASE_ROOT]/docs/aha/module-fix-plans/[MODULE_SLUG]-fix-report.md` |
| Fix date |  |
| Batch executed |  |
| Superpowers used | Yes / No / Unavailable |
| Working tree status checked | Yes / No / Not Available |
| Fix scope | P0/P1/selected P2/V1 REQUIRED/selected V1 RECOMMENDED |
| Out of scope | V2 DEFERRED/DO NOT ADD/unrelated refactors/unselected batches |
| Shared files touched | Yes/No |
| Schema/migration touched | Yes/No |
| Limitations |  |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |

Status must be one of:

- Fixed
- Partially Fixed
- Not Fixed
- Blocked

## 3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |

Use this section to record pre-existing failures or baseline behavior before implementation.

If baseline checks were not run, explain why.

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |

Use labels where applicable:

- `[SHARED DEPENDENCY]`
- `[CROSS-MODULE RISK]`
- `[NEEDS CONFIRMATION]`
- `[BLOCKED BY ENVIRONMENT]`

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |

Types:

- backend/unit
- frontend/component
- integration
- E2E/Playwright
- permission/RBAC
- data/schema
- regression
- domain workflow

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |

Result must be one of:

- Passed
- Failed
- Partially Passed
- Not Run
- Blocked

Do not claim a command passed unless it actually ran.

## 7. Validation Summary

Summarize:

- what passed
- what failed
- what was not run
- what remains blocked
- whether any failures are pre-existing or unrelated

## 8. Shared / Cross-Module / Database Impact

Use this section only if shared/platform/database files were touched or affected.

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |

Use labels:

- `[SHARED DEPENDENCY]`
- `[CROSS-MODULE RISK]`
- `[NEEDS CONFIRMATION]`

## 9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |

Use this section for items that remain unresolved after this fix pass.

## 10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |

Use labels:

- `[NEEDS PRODUCT DECISION]`
- `[NEEDS CONFIRMATION]`
- `[BLOCKED BY MISSING SPEC]`
- `[BLOCKED BY ENVIRONMENT]`
- `[CROSS-MODULE RISK]`

## 11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |

Use labels:

- `V2 DEFERRED`
- `DO NOT ADD`
- `[DO NOT OVERBUILD]`

## 12. Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |

## 13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |

Evidence may include screenshots, Webwright findings, Playwright findings, test output notes, or manual verification notes saved under:

- `[CODEBASE_ROOT]/docs/aha/evidence/screenshots/`
- `[CODEBASE_ROOT]/docs/aha/evidence/playwright-findings/`
- `[CODEBASE_ROOT]/docs/aha/evidence/webwright-findings/`

## 14. Completion Decision

State one:

- `COMPLETE`
- `PARTIALLY COMPLETE`
- `BLOCKED`
- `FAILED`

Use:

- `COMPLETE` only if the selected batch was fixed and relevant validation passed.
- `PARTIALLY COMPLETE` if some selected fixes were completed but others remain.
- `BLOCKED` if environment, product, schema, or shared dependency issues prevented safe completion.
- `FAILED` if the attempted fix did not work or introduced unresolved failures.

Briefly explain the decision.

## 15. Recommended Next Step

State what should happen next.

Use one of:

- run another `04-module-or-group-fix-tdd.md` pass for the next batch
- rerun focused tests after environment issue is fixed
- run `05-cross-cutting-pattern-audit.md`
- run `06-database-schema-audit.md`
- request product decision
- return to `03-organize-gap-plan-for-fixing.md` if the fix-ready plan needs reorganization
- proceed to another module/group audit

Include exact prompt and file path where applicable.
```

---

## 13. Stop Condition

Stop after saving:

`[CODEBASE_ROOT]/docs/aha/module-fix-plans/[MODULE_SLUG]-fix-report.md`

Do not continue to another batch unless explicitly instructed.

Do not continue to another module/group.

Do not run cross-cutting or database/schema audit automatically.

After saving the fix report, recommend the next step.

Example:

```txt
Completed:
Module/group: [MODULE_OR_GROUP_NAME]
Module slug: [MODULE_SLUG]
Fix report: docs/aha/module-fix-plans/[MODULE_SLUG]-fix-report.md

Recommended next step:
[State the next prompt or action based on the completion decision.]
```

