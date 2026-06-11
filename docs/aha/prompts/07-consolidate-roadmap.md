# 07 — AHA Consolidated Remediation Roadmap

Use this prompt after several module/group audits, fix-ready plans, and/or fix reports exist.

Do not fix anything.

Do not rewrite existing gap plans.

Do not rewrite existing fix-ready plans.

Do not rewrite existing fix reports.

Goal: consolidate completed AHA findings into one practical remediation roadmap, so fixes happen in the right order without creating a giant wishlist.

This prompt should help decide:

* what to fix next
* what has already been fixed
* what is planned but not completed
* what to defer
* what needs product decision
* what should not be built
* which AHA prompt should run next

---

## 1. Load Required AHA Files

Load and strictly follow:

`[CODEBASE_ROOT]/docs/aha/prompts/00-aha-shared-rules.md`

Load:

`[CODEBASE_ROOT]/docs/aha/outputs/module-audit-index.md`

Load all available module/group raw gap plans from:

`[CODEBASE_ROOT]/docs/aha/module-gap-plans/*-gap-plan.md`

Load all available module/group fix-ready plans from:

`[CODEBASE_ROOT]/docs/aha/module-fix-plans/*-fix-ready-plan.md`

Use fix-ready plans only as evidence of planned or ready-to-execute fix scope.

Load all available completed module/group fix reports from:

`[CODEBASE_ROOT]/docs/aha/module-fix-plans/*-fix-report.md`

Use fix reports only as evidence of attempted, completed, partially completed, failed, or blocked fix execution.

Do not treat a `*-fix-ready-plan.md` as proof that work was completed.

A `*-fix-report.md` is the only module-level evidence that fixes were attempted or completed.

If available, also load:

`[CODEBASE_ROOT]/docs/aha/outputs/cross-cutting-pattern-audit.md`

`[CODEBASE_ROOT]/docs/aha/outputs/database-schema-audit.md`

Load if available:

`[CODEBASE_ROOT]/docs/aha/kg/knowledge-graph-status.md`

`[CODEBASE_ROOT]/docs/aha/kg/domain-knowledge-status.md`

---

## 2. Scope Rule

Do not fix anything.

Do not modify source code.

Do not create tests.

Do not modify tests.

Do not rewrite existing gap plans.

Do not rewrite existing fix-ready plans.

Do not rewrite existing fix reports.

Do not create new module audits.

Do not create a new database/schema audit.

Do not create a new cross-cutting audit.

This is a consolidation and prioritization prompt only.

---

## 3. Roadmap Goal

Create a practical roadmap that answers:

1. What has already been audited?
2. What has a raw gap plan?
3. What has a fix-ready plan?
4. What has an actual completed or attempted fix report?
5. What has already been fixed?
6. What is planned but not yet completed?
7. What remains broken?
8. Which P0/P1 issues should be fixed first?
9. Which issues are module-local?
10. Which issues are cross-cutting?
11. Which issues need database/schema work?
12. Which items should be deferred?
13. Which items should not be built?
14. Which product decisions are blocking progress?
15. Which environment/tooling blockers are stopping progress?
16. Which prompt should be run next?

---

## 4. Fix-Ready vs Fix-Report Rule

Interpret files this way:

```txt
*-gap-plan.md        = raw audit findings
*-fix-ready-plan.md = planned or organized fix scope
*-fix-report.md     = attempted, completed, partially completed, failed, or blocked fix execution
```

Do not mark a module/group as fixed because a fix-ready plan exists.

If a module/group has a gap plan but no fix-ready plan, classify it as:

`Audited Only`

If a module/group has a fix-ready plan but no fix report, classify it as:

`Fix Ready / Not Completed`

If a module/group has a fix report, classify based on the report’s completion decision:

* `Fixed`
* `Partially Fixed`
* `Blocked`
* `Failed`
* `Unknown`

If a fix report says a selected batch was completed but later batches remain, classify the module/group as:

`Partially Fixed`

If evidence is unclear, mark:

`[NEEDS CONFIRMATION]`

---

## 5. Prioritization Rules

Prioritize work in this order:

1. P0 blockers that break core workflows or create serious safety/security/data risks
2. P1 issues affecting core journeys, trust, permissions, or testability
3. Blocked fixes that can be unblocked quickly by product/spec/environment decisions
4. Cross-cutting fixes that remove repeated bugs across multiple modules
5. Database/schema fixes required for safe module behavior
6. Selected P2 issues that complete important V1 workflows
7. Low-risk V1 recommended usability/testability improvements
8. Everything else deferred

Do not prioritize:

* `V2 DEFERRED` items
* `DO NOT ADD` items
* speculative enhancements
* broad refactors without direct evidence
* platform abstractions that are not justified by repeated module findings
* future enterprise features not required for reliable V1
* cosmetic improvements that do not affect reliability, usability, trust, safety, or testability

---

## 6. Enhancement Guardrail

Do not turn this roadmap into a product wishlist.

Classify all roadmap items as:

* `V1 REQUIRED`
* `V1 RECOMMENDED`
* `V2 DEFERRED`
* `DO NOT ADD`

Only `V1 REQUIRED` and selected `V1 RECOMMENDED` items should appear in the active remediation sequence.

Use `V2 DEFERRED` for useful future items that should not be fixed now.

Use `DO NOT ADD` for overbuilt, duplicate, or out-of-scope items.

Use:

`[DO NOT OVERBUILD]`

when a proposed fix or abstraction is premature.

---

## 7. Evidence Requirement

Every roadmap item should trace back to at least one of:

* module/group gap plan
* module/group fix-ready plan
* module/group fix report
* cross-cutting pattern audit
* database/schema audit
* module audit index
* exact file/path
* exact route/page
* exact API/handler/service
* exact schema/table/model
* exact test gap
* exact user journey
* exact KG finding
* exact domain workflow finding
* exact Webwright finding
* exact Playwright/E2E finding

If evidence is weak, mark:

`[NEEDS CONFIRMATION]`

If implementation is blocked by environment/tooling, mark:

`[BLOCKED BY ENVIRONMENT]`

If implementation is blocked by missing product/spec clarity, mark:

`[NEEDS PRODUCT DECISION]`

or:

`[BLOCKED BY MISSING SPEC]`

---

## 8. Required Analysis

Analyze:

1. Audit coverage by module/group
2. Fix-ready coverage by module/group
3. Completed fix coverage by module/group
4. Remaining P0/P1 gaps
5. Gaps that are planned but not completed
6. Gaps marked fixed but lacking validation evidence
7. Repeated patterns across modules
8. Shared/platform fixes that should happen before more module fixes
9. Database/schema fixes that block safe progress
10. Test infrastructure gaps
11. Product decisions needed
12. Environment/tooling blockers
13. Deferred items
14. Do-not-build items
15. Suggested next module/group to audit
16. Suggested next module/group batch to fix
17. Whether to run `05-cross-cutting-pattern-audit.md`
18. Whether to run `06-database-schema-audit.md`
19. Whether a future specialized platform/schema fix prompt is needed

---

## 9. Status Rules

Use these statuses consistently:

* `Not Audited`
* `Audited Only`
* `Fix Ready / Not Completed`
* `Fix In Progress`
* `Fixed`
* `Partially Fixed`
* `Blocked`
* `Failed`
* `Deferred`
* `Do Not Build`
* `Unknown`

Definitions:

`Not Audited` = listed in index but no gap plan exists.

`Audited Only` = gap plan exists, but no fix-ready plan or fix report exists.

`Fix Ready / Not Completed` = fix-ready plan exists, but no fix report exists.

`Fix In Progress` = fix report or notes suggest work started but completion is unclear.

`Fixed` = completed fix report confirms selected scope was fixed and validated.

`Partially Fixed` = fix report confirms some fixes completed but some selected or known relevant fixes remain.

`Blocked` = product/spec/environment/shared/database blocker prevents progress.

`Failed` = attempted fix did not work or introduced unresolved failures.

`Deferred` = intentionally not active now.

`Do Not Build` = explicitly rejected as overbuild, duplicate, or out of scope.

`Unknown` = evidence is insufficient.

---

## 10. Recommended Prompt Rules

Use these prompt recommendations:

* `02-module-or-group-audit-gap-plan.md` for module/group audits
* `03-organize-gap-plan-for-fixing.md` when a raw gap plan exists but no fix-ready plan exists
* `04-module-or-group-fix-tdd.md` when a fix-ready plan exists and a selected batch should be executed
* `05-cross-cutting-pattern-audit.md` when repeated shared/platform issues appear
* `06-database-schema-audit.md` when repeated database/schema issues appear or data risk is high
* future specialized platform/shared fix prompt only if the issue is too broad or risky for normal `04`
* future specialized schema/database fix prompt only if schema work is too broad or risky for normal `04`
* product decision / spec clarification when implementation is blocked by unclear expected behavior
* environment/tooling fix when validation or execution is blocked

Do not recommend `04-module-or-group-fix-tdd.md` unless a valid `*-fix-ready-plan.md` exists.

Do not recommend fixing from a raw gap plan directly.

---

## 11. Required Output File

Create and save:

`[CODEBASE_ROOT]/docs/aha/outputs/consolidated-remediation-roadmap.md`

The file must use this structure:

````md
# AHA Consolidated Remediation Roadmap

## 1. Executive Summary

Briefly summarize:

- audit coverage so far
- fix-ready coverage so far
- completed fix coverage so far
- highest risks
- biggest blockers
- recommended next action

Keep this practical and short.

## 2. Inputs Reviewed

| Input | Details |
| --- | --- |
| Module audit index |  |
| Gap plans reviewed |  |
| Fix-ready plans reviewed |  |
| Completed fix reports reviewed |  |
| Cross-cutting audit reviewed | Yes/No/Not Available |
| Database/schema audit reviewed | Yes/No/Not Available |
| KG status reviewed | Yes/No/Not Available |
| Domain status reviewed | Yes/No/Not Available |
| Limitations |  |

## 3. Current Audit Coverage

| Module/Group | Module Slug | Type | Audit Decision | Gap Plan Exists? | Current Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |

Current Status should be one of:

- Not Audited
- Audited Only
- Fix Ready / Not Completed
- Fix In Progress
- Fixed
- Partially Fixed
- Blocked
- Failed
- Deferred
- Unknown

## 4. Current Fix-Ready Coverage

| Module/Group | Module Slug | Fix-Ready Plan | Recommended First Batch | Active Fix Count | Blocked Fix Count | Deferred Count | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

Use this section only for modules/groups with existing `*-fix-ready-plan.md` files.

This section means work is planned, not completed.

## 5. Current Completed Fix Coverage

| Module/Group | Module Slug | Fix Report | Batch Executed | Gaps Fixed | Remaining Gaps | Tests Added/Updated | Completion Decision | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Use this section only for modules/groups with existing `*-fix-report.md` files.

Completion Decision must be one of:

- COMPLETE
- PARTIALLY COMPLETE
- BLOCKED
- FAILED
- UNKNOWN

## 6. Fix-Ready But Not Yet Completed

| Module/Group | Module Slug | Fix-Ready Plan | Recommended Batch | Why Not Completed Yet | Recommended Next Prompt |
| --- | --- | --- | --- | --- | --- |

Use this section for modules/groups that have `*-fix-ready-plan.md` but no matching `*-fix-report.md`.

Recommended Next Prompt should usually be:

`04-module-or-group-fix-tdd.md`

unless blocked.

## 7. Top P0/P1 Risks

| Priority | Gap | Module/Group | Module Slug | Severity | Scope Label | Evidence Source | Why It Matters | Recommended Next Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Only include real P0/P1 issues with evidence.

Do not include V2 or DO NOT ADD items.

## 8. Recommended Fix Sequence

| Order | Module/Group | Module Slug | Fix Scope | Why Now | Tests Required | Dependencies | Recommended Prompt |
| --- | --- | --- | --- | --- | --- | --- | --- |

Use:

- `04-module-or-group-fix-tdd.md` for module/group fixes with existing fix-ready plans
- `03-organize-gap-plan-for-fixing.md` if only a raw gap plan exists
- future specialized prompt only if the issue cannot be safely handled by the normal fix prompt

## 9. Recommended Next Audits

| Order | Module/Group | Module Slug | Type | Why Audit Next | Recommended Prompt |
| --- | --- | --- | --- | --- | --- |

Use:

- `02-module-or-group-audit-gap-plan.md`
- `05-cross-cutting-pattern-audit.md`
- `06-database-schema-audit.md`

## 10. Cross-Cutting Fixes

| Fix | Modules Helped | Evidence | Risk | Recommended Timing | Recommended Prompt |
| --- | --- | --- | --- | --- | --- |

Include only cross-cutting fixes with repeated evidence.

Do not recommend centralizing speculative patterns.

## 11. Database / Schema Fixes

| Fix | Affected Modules | Evidence | Risk | Recommended Timing | Recommended Prompt |
| --- | --- | --- | --- | --- | --- |

Include only if database/schema findings exist.

## 12. Test Infrastructure Priorities

| Test Gap | Affected Modules | Why It Matters | Recommended Fix | Priority |
| --- | --- | --- | --- | --- |

Include only test infrastructure gaps that affect multiple modules or block reliable fixing.

## 13. Product Decisions Needed

| Decision | Affected Modules/Groups | Label | Why Needed | Suggested Owner / Next Step |
| --- | --- | --- | --- | --- |

Use labels:

- `[NEEDS PRODUCT DECISION]`
- `[NEEDS CONFIRMATION]`
- `[BLOCKED BY MISSING SPEC]`

## 14. Environment / Tooling Blockers

| Blocker | Label | Affected Modules/Groups | Impact | Recommended Next Step |
| --- | --- | --- | --- | --- |

Use labels:

- `[BLOCKED BY ENVIRONMENT]`
- `[NEEDS CONFIRMATION]`
- `[CROSS-MODULE RISK]`

## 15. Shared / Cross-Module Risks

| Risk | Affected Modules/Groups | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |

Use labels where appropriate:

- `[SHARED DEPENDENCY]`
- `[CROSS-MODULE RISK]`
- `[NEEDS CONFIRMATION]`

## 16. V2 Deferred Items

| Item | Source | Why Deferred |
| --- | --- | --- |

Do not include these in the active fix sequence.

## 17. Do Not Build / Avoid Overengineering

| Item | Source | Reason |
| --- | --- | --- |

Use this section for:

- overbuilt features
- duplicate functionality
- speculative abstractions
- future enterprise features not needed for V1
- items marked `DO NOT ADD`
- items marked `[DO NOT OVERBUILD]`

## 18. Roadmap Decision

State one:

- `READY FOR NEXT FIX`
- `NEEDS MORE AUDITS`
- `NEEDS GAP PLAN ORGANIZATION`
- `NEEDS CROSS-CUTTING AUDIT`
- `NEEDS DATABASE / SCHEMA AUDIT`
- `BLOCKED BY PRODUCT DECISION`
- `BLOCKED BY ENVIRONMENT`
- `INSUFFICIENT EVIDENCE`

Briefly explain the decision.

## 19. Recommended Immediate Next Step

State exactly what should happen next.

Include:

- prompt to run
- module/group name, if applicable
- module slug, if applicable
- input file path, if applicable
- selected batch, if applicable
- reason this is the next best action

Example:

```txt
Recommended next step:
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Module/group: Patient Management
Module slug: patient-management
Input fix-ready plan: docs/aha/module-fix-plans/patient-management-fix-ready-plan.md
Selected batch: Batch A — P0 core workflow blockers
Reason: Highest unresolved P0 workflow risk with fix-ready plan already prepared.
````

```

---

## 12. Stop Condition

Stop after saving:

`[CODEBASE_ROOT]/docs/aha/outputs/consolidated-remediation-roadmap.md`

Do not fix anything.

Do not create tests.

Do not modify source code.

Do not modify module gap plans.

Do not modify fix-ready plans.

Do not modify fix reports.

After saving the roadmap, recommend exactly one next prompt/action.
```

