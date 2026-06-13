# 03 — AHA Organize Gap Plan for Fixing

Use this prompt after a module/group gap plan already exists.

Module/group to organize:

`[MODULE_OR_GROUP_NAME]`

Module/group slug:

`[MODULE_SLUG]`

Do not audit again.

Do not implement fixes.

Goal: convert the raw module/group gap plan into a clean, prioritized, fix-ready plan that:

`[CODEBASE_ROOT]/docs/aha/prompts/04-module-or-group-fix-tdd.md`

can execute safely.

This prompt exists to reduce noise, avoid overbuilding, and prevent the fix prompt from trying to fix too many things at once.

---

## 1. Load Required AHA Files

Load and strictly follow:

`[CODEBASE_ROOT]/docs/aha/prompts/00-aha-shared-rules.md`

Load:

`[CODEBASE_ROOT]/docs/aha/outputs/module-audit-index.md`

Load the raw module/group gap plan:

`[CODEBASE_ROOT]/docs/aha/module-gap-plans/[MODULE_SLUG]-gap-plan.md`

Load if available:

`[CODEBASE_ROOT]/docs/aha/kg/knowledge-graph-status.md`

`[CODEBASE_ROOT]/docs/aha/kg/domain-knowledge-status.md`

If available and directly relevant, also load:

`[CODEBASE_ROOT]/docs/aha/outputs/cross-cutting-pattern-audit.md`

`[CODEBASE_ROOT]/docs/aha/outputs/database-schema-audit.md`

Use cross-cutting and database/schema audits only as context.

Do not allow them to expand the fix-ready plan beyond the selected module/group.

If the gap plan is missing, stop and run:

`[CODEBASE_ROOT]/docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

for this module/group first.

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

Use `[MODULE_SLUG]` in the filename.

Do not save files using the readable module/group name.

Correct output path:

`[CODEBASE_ROOT]/docs/aha/module-fix-plans/[MODULE_SLUG]-fix-ready-plan.md`

---

## 3. Superpowers Use

Use `/using-superpowers` or the available Superpowers agent if available and useful for organizing the fix strategy.

Use it to support:

1. safe fix sequencing
2. TDD strategy planning
3. splitting large fixes into safe batches
4. identifying root-cause fixes vs symptom fixes
5. avoiding overbroad refactors
6. avoiding speculative enhancements
7. preventing weak or fake-green test plans
8. deciding which fixes should be done now vs deferred

Do not use Superpowers to expand the scope beyond the raw gap plan.

Do not use Superpowers to promote V2 items into V1 unless there is strong evidence that the item is required for reliable V1 behavior.

If `/using-superpowers` is unavailable, continue normally and record this in the fix-ready plan.

---

## 4. Scope Rule

Organize the existing gap plan only.

Do not:

* redo the audit
* perform new platform discovery
* inspect unrelated modules unless needed to clarify dependencies
* implement fixes
* modify source code
* create tests
* modify tests
* add new product scope
* convert V2 ideas into V1 without strong evidence
* turn unclear product ideas into implementation tasks

You may inspect files referenced in the gap plan only to clarify:

* severity
* dependencies
* likely files touched
* test ordering
* blocker status
* whether a finding is actually fix-ready
* whether a finding is module-local or shared/platform/database-related

If new information contradicts the raw gap plan, do not rewrite the raw gap plan.

Instead, document the correction or clarification in the fix-ready plan.

---

## 5. Main Task

Transform the raw gap plan into a fix-ready plan.

The fix-ready plan must answer:

1. What should be fixed now?
2. What should be deferred?
3. What should not be built?
4. What tests should be written first?
5. What should be fixed in one batch vs split into multiple batches?
6. What shared/platform/database dependencies exist?
7. What product decisions block implementation?
8. What environment/tooling blockers exist?
9. What should the `04` fix prompt do first?
10. What should the `04` fix prompt explicitly avoid?

---

## 6. Triage Rules

Only include these in the active fix sequence:

* `P0`
* `P1`
* selected `P2` required for workflow completeness
* `V1 REQUIRED`
* selected `V1 RECOMMENDED` if low-risk and directly improves reliability, usability, trust, safety, or testability

Do not include these in the active fix sequence:

* `V2 DEFERRED`
* `DO NOT ADD`
* speculative enhancements
* broad refactors
* purely cosmetic changes
* optional enterprise features
* unclear product decisions
* items blocked by missing specs
* items blocked by environment/tooling
* items without enough evidence to safely fix

If a gap is valid but too large for one safe fix pass, split it into smaller fix batches.

If a gap lacks enough evidence, mark:

`[NEEDS CONFIRMATION]`

If implementation requires a product choice, mark:

`[NEEDS PRODUCT DECISION]`

If implementation is blocked by missing specs, mark:

`[BLOCKED BY MISSING SPEC]`

If implementation is blocked by environment/tooling, mark:

`[BLOCKED BY ENVIRONMENT]`

---

## 7. Fix Batch Rules

Organize fixes into one or more batches.

Each batch should be small enough to be safely fixed and tested.

Recommended batch types:

* Batch A — P0 core workflow blockers
* Batch B — P1 reliability / trust / permission gaps
* Batch C — selected P2 V1 completeness gaps
* Batch D — test hardening / regression coverage
* Batch E — shared/platform dependency fix
* Batch F — database/schema dependency fix

Do not combine unrelated risky fixes into one batch.

Do not combine broad shared/platform changes with normal module-local fixes unless absolutely necessary.

If shared/platform/database files must be touched, isolate those changes into a clearly labeled batch.

Each batch must clearly state whether it should be executed:

* now
* later
* only after product decision
* only after environment is fixed
* only after shared/platform dependency is resolved
* only after database/schema dependency is resolved

---

## 8. Test-First Planning Rules

For each active fix, identify the test that should be added or updated first.

Test types:

* backend/unit
* frontend/component
* integration
* E2E/Playwright
* permission/RBAC
* data/schema
* regression
* domain workflow

Prefer tests that prove real workflow behavior:

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

Do not recommend excessive E2E tests for every minor issue.

Use Playwright/E2E for core journeys only.

If the raw gap plan identified existing tests that should be extended, prefer extending them when appropriate.

If there are no suitable tests, propose the most focused new test location.

Do not create or modify tests during this prompt.

---

## 9. Enhancement Guardrail

For use case or enhancement gaps, classify clearly:

* `V1 REQUIRED`
* `V1 RECOMMENDED`
* `V2 DEFERRED`
* `DO NOT ADD`

Only `V1 REQUIRED` and selected `V1 RECOMMENDED` items may enter the active fix sequence.

If an enhancement is useful but not necessary for reliable V1 operation, move it to:

`V2 DEFERRED`

If an enhancement would duplicate existing behavior, add complexity, or expand beyond the module’s role, mark it:

`DO NOT ADD`

Use:

`[DO NOT OVERBUILD]`

when needed.

Do not allow the fix-ready plan to become a wishlist.

Do not promote speculative future capabilities into the active fix scope.

---

## 10. Dependency Rules

For each active fix, identify whether it is:

* module-local
* shared/platform dependency
* database/schema dependency
* cross-module dependency
* product decision dependency
* missing spec dependency
* environment/tooling dependency

If a fix requires a shared/platform/database change, document:

* why the change is necessary
* expected consumers/blast radius
* regression tests needed
* whether it should happen before or during the module fix
* whether it should be handled by the normal `04` fix prompt or a specialized future prompt

Do not bury shared/platform/database changes inside normal module-local batches.

If a dependency is too risky to fix during the module pass, mark it as a blocker or separate future batch.

---

## 11. Root-Cause vs Symptom Rule

Prefer fixing root causes over patching symptoms.

For each active fix, decide whether the proposed fix addresses:

* root cause
* symptom
* temporary workaround
* unclear cause

If root cause is unclear, mark:

`[NEEDS CONFIRMATION]`

If the fix would only patch a symptom and risk hiding a larger issue, do not include it in the active fix sequence unless it is necessary to unblock a P0 workflow.

---

## 12. Evidence Standard

Every active fix must trace back to at least one of:

* exact gap from the raw gap plan
* exact file/path
* exact route/page
* exact API/handler/service
* exact schema/table/model
* exact test file
* exact missing test
* exact user journey
* exact product/spec mismatch
* exact KG dependency/wiring finding
* exact domain workflow/use-case finding
* exact Webwright observation
* exact Playwright/E2E finding

If evidence is weak, do not include the item in the active fix sequence.

Instead, place it under:

* Product Decisions / Confirmations Needed
* Blocked Items
* Deferred Items

---

## 13. Required Output File

Create and save:

`[CODEBASE_ROOT]/docs/aha/module-fix-plans/[MODULE_SLUG]-fix-ready-plan.md`

The file must use this structure:

```md
# AHA Fix-Ready Plan: [MODULE_OR_GROUP_NAME]

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group |  |
| Module slug |  |
| Source gap plan | `[CODEBASE_ROOT]/docs/aha/module-gap-plans/[MODULE_SLUG]-gap-plan.md` |
| Output file | `[CODEBASE_ROOT]/docs/aha/module-fix-plans/[MODULE_SLUG]-fix-ready-plan.md` |
| Audit decision | PASS / PARTIAL PASS / FAIL |
| Superpowers used | Yes / No / Unavailable |
| Organizer decision | READY / PARTIALLY READY / NOT READY |
| Reason |  |
| Limitations |  |

## 2. Fix Strategy Summary

Briefly summarize the recommended fixing strategy.

Include:

- what to fix first
- what not to fix
- major risks
- whether the module should be fixed in one pass or multiple batches
- whether shared/platform/database work is required
- whether product decisions or environment blockers exist

## 3. Active Fix Scope

Only include P0/P1/selected P2 and V1 REQUIRED/selected V1 RECOMMENDED items.

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |

Fix ID format:

- `FIX-001`
- `FIX-002`
- `FIX-003`

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |

Recommended execution examples:

- run in current `04` pass
- split into separate `04` pass
- requires product decision first
- requires shared/platform fix first
- requires database/schema fix first
- blocked by environment
- do not run yet

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |

Types:

- backend/unit
- frontend/component
- integration
- E2E/Playwright
- permission/RBAC
- data/schema
- regression
- domain workflow

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |

Module-Local or Shared must be one of:

- module-local
- shared/platform
- database/schema
- cross-module
- unknown

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |

Dependency Type:

- module-local
- shared/platform
- database/schema
- cross-module
- product decision
- missing spec
- environment/tooling

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |

Use labels:

- `[NEEDS PRODUCT DECISION]`
- `[NEEDS CONFIRMATION]`
- `[BLOCKED BY MISSING SPEC]`
- `[BLOCKED BY ENVIRONMENT]`

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |

Use this for valid issues that should not be fixed yet because they need product, spec, environment, shared-platform, or database/schema prerequisites.

## 10. Deferred Items

Items not included in the active fix sequence.

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |

Use scope labels:

- `V2 DEFERRED`
- `DO NOT ADD`
- `[DO NOT OVERBUILD]`
- `[NEEDS PRODUCT DECISION]`

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |

Use this section for ideas that would overbuild, duplicate existing behavior, or expand beyond the module/group’s role.

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |

## 13. Recommended First Fix Batch

State the first batch that `04-module-or-group-fix-tdd.md` should execute.

Include:

- batch name
- included Fix IDs
- why this batch comes first
- tests to write first
- explicit out-of-scope items

## 14. Instructions for 04 Fix Prompt

Give concise instructions for the next prompt.

Include:

- exact module/group name
- exact module slug
- exact fix-ready plan path
- exact batch to execute first
- tests to prioritize
- files likely to touch
- shared/database cautions
- items not to implement
```

---

## 14. Stop Condition

Stop after saving:

`[CODEBASE_ROOT]/docs/aha/module-fix-plans/[MODULE_SLUG]-fix-ready-plan.md`

Do not implement fixes.

Do not create tests.

Do not modify source code.

Do not continue to the TDD fix prompt automatically.

After saving the fix-ready plan, recommend the next command/prompt to run.

Example:

```txt
Next recommended step:
Module/group: [MODULE_OR_GROUP_NAME]
Module slug: [MODULE_SLUG]
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/[MODULE_SLUG]-fix-ready-plan.md
Recommended batch: [BATCH NAME]
```

