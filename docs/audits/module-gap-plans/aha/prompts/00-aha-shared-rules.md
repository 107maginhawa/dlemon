# 00 — AHA Shared Rules

You are operating under the AHA Platform Audit Rules.

AHA means: Audit, Harden, Align.

This audit system is for a large platform codebase.

The goal is not documentation theater.

The goal is to identify and fix real product, workflow, reliability, implementation, and test gaps that prevent the platform from working correctly.

Use these shared rules for every AHA prompt.

---

## 1. Root Paths

Use:

`[CODEBASE_ROOT]/docs/aha/`

All generated AHA files must be saved only under this folder.

Do not mix AHA outputs into older audit folders.

Expected structure:

```txt
[CODEBASE_ROOT]/docs/aha/
├── prompts/
├── outputs/
├── module-gap-plans/
├── module-fix-plans/
├── evidence/
│   ├── screenshots/
│   ├── playwright-findings/
│   └── webwright-findings/
├── kg/
└── archive/
```

If folders are missing, create them only when the active prompt requires output there.

Do not save AHA files outside:

`[CODEBASE_ROOT]/docs/aha/`

---

## 2. Prompt Sequence

Use this AHA prompt sequence:

```txt
00-aha-shared-rules.md
01-platform-discovery-audit-index.md
02-module-or-group-audit-gap-plan.md
03-organize-gap-plan-for-fixing.md
04-module-or-group-fix-tdd.md
05-cross-cutting-pattern-audit.md
06-database-schema-audit.md
07-consolidate-roadmap.md
```

Recommended operating flow:

1. Run `01-platform-discovery-audit-index.md` once to discover modules/groups and create the audit index.
2. Pick one module/group.
3. Run `02-module-or-group-audit-gap-plan.md` to audit that module/group and create the raw gap plan.
4. Run `03-organize-gap-plan-for-fixing.md` to organize the raw gap plan into a fix-ready plan.
5. Run `04-module-or-group-fix-tdd.md` to fix only the selected batch using TDD.
6. Repeat per module/group.
7. Run `05-cross-cutting-pattern-audit.md` only after repeated platform/shared issues appear.
8. Run `06-database-schema-audit.md` only when database/schema issues appear repeatedly or the platform is data-heavy.
9. Run `07-consolidate-roadmap.md` to consolidate the roadmap after several audits/fixes.

Do not skip from `02` directly to `04`.

Do not run `04` without a fix-ready plan from `03`.

---

## 3. File Naming / Module Slug Rule

When saving module/group files, convert `[MODULE_OR_GROUP_NAME]` into a filesystem-safe slug.

Use lowercase kebab-case.

Examples:

* `Patient Management` → `patient-management`
* `Auth/RBAC` → `auth-rbac`
* `Billing & Claims` → `billing-claims`
* `Lab Results / Diagnostics` → `lab-results-diagnostics`

Use the readable module/group name inside document titles and tables.

Use the slug in filenames.

Examples:

```txt
[CODEBASE_ROOT]/docs/aha/module-gap-plans/patient-management-gap-plan.md
[CODEBASE_ROOT]/docs/aha/module-fix-plans/patient-management-fix-ready-plan.md
[CODEBASE_ROOT]/docs/aha/module-fix-plans/patient-management-fix-report.md
```

Do not create filenames with spaces, slashes, ampersands, parentheses, or special characters.

Whenever a prompt path shows `[MODULE_SLUG]`, derive it from `[MODULE_OR_GROUP_NAME]` using this rule.

Do not use the readable module/group name directly in filenames.

If an older prompt path shows `[MODULE_OR_GROUP_NAME]-gap-plan.md`, interpret it as:

`[MODULE_SLUG]-gap-plan.md`

If an older prompt path shows `[MODULE_OR_GROUP_NAME]-fix-ready-plan.md`, interpret it as:

`[MODULE_SLUG]-fix-ready-plan.md`

If an older prompt path shows `[MODULE_OR_GROUP_NAME]-fix-report.md`, interpret it as:

`[MODULE_SLUG]-fix-report.md`

---

## 4. Output File Types

Keep these file types separate:

```txt
[CODEBASE_ROOT]/docs/aha/outputs/module-audit-index.md
[CODEBASE_ROOT]/docs/aha/module-gap-plans/[MODULE_SLUG]-gap-plan.md
[CODEBASE_ROOT]/docs/aha/module-fix-plans/[MODULE_SLUG]-fix-ready-plan.md
[CODEBASE_ROOT]/docs/aha/module-fix-plans/[MODULE_SLUG]-fix-report.md
[CODEBASE_ROOT]/docs/aha/outputs/cross-cutting-pattern-audit.md
[CODEBASE_ROOT]/docs/aha/outputs/database-schema-audit.md
[CODEBASE_ROOT]/docs/aha/outputs/consolidated-remediation-roadmap.md
```

Important distinction:

* `*-gap-plan.md` = raw audit findings
* `*-fix-ready-plan.md` = organized plan for future fixing
* `*-fix-report.md` = completed or attempted fix execution report

Do not treat a fix-ready plan as proof that work was completed.

Only `*-fix-report.md` files count as completed or attempted fix evidence.

---

## 5. Core Principles

1. Be evidence-based.
2. Do not invent unnecessary features.
3. Do not perform broad refactors unless explicitly required.
4. Do not fix anything during audit prompts.
5. Fix only during the fix/TDD prompt.
6. Prefer module/group-by-module/group execution.
7. If a required fix touches shared/platform/database files, document why.
8. Mark uncertainty clearly.
9. Use existing code, PRDs, specs, tests, UI, routes, APIs, schemas, and knowledge graph before making assumptions.
10. The output must be useful for immediate TDD-based remediation.
11. Do not overbuild.
12. Do not mix new AHA outputs with old audit outputs.
13. Do not allow one module/group audit to become a whole-platform audit.
14. Do not allow one fix pass to become a broad rewrite.
15. Always separate raw findings from fix-ready plans and completed fix reports.

---

## 6. Product Reference Rules

Use available product references when relevant:

```txt
[CODEBASE_ROOT]/docs/product/
[CODEBASE_ROOT]/docs/context/
[CODEBASE_ROOT]/docs/
[CODEBASE_ROOT]/docs/aha/outputs/module-audit-index.md
[CODEBASE_ROOT]/docs/aha/module-gap-plans/
[CODEBASE_ROOT]/docs/aha/module-fix-plans/
```

Use product references to understand expected workflows, actors, lifecycle states, use cases, and constraints.

Use actual code to verify what is implemented.

If a PRD or spec is missing for a module, infer expected behavior only from evidence such as:

* route names
* page labels
* UI copy
* API contracts
* schema/table names
* tests
* seed data
* existing workflows
* platform conventions
* `/understand-domain` findings, if available

Mark inferred expectations as:

`[INFERRED]`

Mark uncertain product decisions as:

`[NEEDS PRODUCT DECISION]`

Mark missing product references as:

`[BLOCKED BY MISSING SPEC]`

Do not invent advanced requirements without evidence.

---

## 7. Enhancement Guardrail

Do not overdo enhancements.

Classify suggested enhancements as:

* `V1 REQUIRED` — needed for the core workflow to work reliably
* `V1 RECOMMENDED` — important for usability, trust, safety, or testability
* `V2 DEFERRED` — useful but not necessary now
* `DO NOT ADD` — would add complexity, duplicate existing behavior, or fall outside scope

Only recommend `V1 REQUIRED` or selected `V1 RECOMMENDED` items in the active fix order.

Move advanced, speculative, optional, enterprise-only, or nice-to-have ideas to:

`V2 DEFERRED`

Mark overbuilt or inappropriate ideas as:

`DO NOT ADD`

Use:

`[DO NOT OVERBUILD]`

when a proposed feature, abstraction, or refactor is premature.

---

## 8. Use Case Completeness Rules

When auditing a module/group, check whether it supports the use cases needed for its role in the platform.

For each module/group, evaluate:

1. Primary actors
2. Main workflows
3. Create/read/update/delete or lifecycle operations
4. State transitions
5. Empty states
6. Loading states
7. Error states
8. Permission/RBAC behavior
9. Data validation
10. Save/reload behavior
11. Downstream effects
12. Audit/history/logging needs
13. Reporting/export needs, if applicable
14. Cross-module dependencies
15. Integration/API requirements
16. Test coverage
17. Realistic edge cases

Do not require every possible enterprise feature.

Require only what is necessary for a reliable V1 workflow.

---

## 9. Knowledge Graph Rules

Use the existing `/understand` or `/understand-anything` knowledge graph if available.

Do not regenerate it unnecessarily.

Only refresh or rerun the knowledge graph if:

* it is missing
* it is stale compared with recent code changes
* required module files are not represented
* dependency/wiring questions cannot be answered
* the graph output is clearly incomplete

Use the knowledge graph to validate:

* module boundaries
* routes
* components
* handlers
* services
* schemas
* database tables
* tests
* frontend → API → backend → data flow
* unused endpoints
* unwired UI
* consumers of shared files
* blast radius of proposed fixes
* cross-module dependencies

Do not use the knowledge graph to produce a generic architecture essay.

Summarize only relevant KG findings for the active prompt.

If KG is unavailable, continue using direct code inspection and document that KG was unavailable.

---

## 10. Domain Knowledge Rules

Use `/understand-domain` if available and useful.

The purpose of `/understand-domain` is to identify business/domain understanding, not just code structure.

Use it to help identify:

* business domains
* actors/users
* domain concepts
* major workflows
* workflow steps
* lifecycle states
* cross-module journeys
* product capabilities
* missing or incomplete use cases
* mismatch between code structure and business workflow

Use `/understand-domain` especially when:

* module boundaries are unclear
* folder structure does not reflect product workflows
* PRDs/specs are incomplete
* workflows span multiple modules
* the platform has complex business logic
* use case completeness is important

Do not rerun `/understand-domain` if a recent domain graph already exists and is sufficient.

Do not treat `/understand-domain` output as automatically correct.

Validate it against:

* PRDs
* specs
* UI/routes
* APIs
* schemas
* tests
* seed data
* actual code implementation

Mark uncertain domain findings as:

* `[INFERRED]`
* `[NEEDS CONFIRMATION]`
* `[NEEDS PRODUCT DECISION]`

Do not use `/understand-domain` to justify speculative features, broad abstractions, or overbuilding.

---

## 11. Webwright and Playwright Rules

Use `/webwright` when useful for exploratory workflow/UI audit.

Use Playwright or existing E2E tooling when useful for deterministic verification or test-gap identification.

During audit prompts:

* do not create tests
* do not modify tests
* do not modify source code
* do not fix broken journeys
* you may inspect existing tests
* you may identify tests that should be added later
* you may record observed broken journeys
* you may save evidence under `[CODEBASE_ROOT]/docs/aha/evidence/`

During fix/TDD prompts:

* write or update failing tests first when practical
* then implement minimal fixes
* then run relevant tests
* use Playwright/E2E only for core journeys where browser-level proof is needed

Use Webwright/Playwright only where it gives useful evidence.

Do not use it just to satisfy the prompt.

Save evidence, when applicable, under:

```txt
[CODEBASE_ROOT]/docs/aha/evidence/screenshots/
[CODEBASE_ROOT]/docs/aha/evidence/playwright-findings/
[CODEBASE_ROOT]/docs/aha/evidence/webwright-findings/
```

---

## 12. Superpowers / Execution Agent Rule

Use `/using-superpowers` or the available Superpowers agent when it improves disciplined execution, especially for:

* TDD planning
* test-first implementation
* debugging failing tests
* root-cause analysis
* avoiding broad refactors
* sequencing fixes safely
* validating whether a fix is truly complete
* preventing fake-green or shallow test coverage

During audit prompts, use Superpowers only if it helps reason about audit quality, test strategy, or gap classification.

During gap-plan organization, use Superpowers if it helps convert noisy audit findings into a safe fix-ready sequence.

During fix/TDD prompts, invoke `/using-superpowers` before implementation when available.

Use it to guide the fix process, but do not let it expand scope beyond the active fix-ready plan.

If `/using-superpowers` or the Superpowers agent is unavailable, continue without it and document that it was unavailable.

Do not use Superpowers to justify:

* speculative enhancements
* broad rewrites
* unrelated refactors
* V2 items
* weakening tests
* fake-green test coverage

---

## 13. Severity Rules

Use:

`P0` — blocks core workflow, causes data loss, creates serious safety/security risk, or prevents the module/group from being usable

`P1` — serious functional, workflow, trust, permission, or testability gap

`P2` — important but not blocking

`P3` — minor polish, cleanup, or low-risk improvement

Do not exaggerate severity.

A gap should be `P0` only when it blocks the core workflow or creates serious safety/security/data risk.

A test gap may be `P1` if it makes safe fixing impossible or leaves a critical workflow unprotected.

---

## 14. Audit Decision Rules

Use one:

`PASS` — module/group is reliable enough for its expected V1 scope

`PARTIAL PASS` — usable but has important gaps

`FAIL` — core workflow is broken, unsafe, misleading, or untestable

Use `PASS` only if there are no material V1 gaps.

Use `PARTIAL PASS` if the module/group can function but still has meaningful gaps.

Use `FAIL` if P0/P1 gaps block reliable V1 use.

---

## 15. Required Labels

Use these labels where appropriate:

```txt
[INFERRED]
[NEEDS CONFIRMATION]
[NEEDS PRODUCT DECISION]
[BLOCKED BY MISSING SPEC]
[BLOCKED BY ENVIRONMENT]
[SHARED DEPENDENCY]
[CROSS-MODULE RISK]
[TEST GAP]
[DO NOT OVERBUILD]
```

Use labels consistently.

Do not hide uncertainty.

---

## 16. Evidence Standard

Every important finding should include at least one of:

* exact file/path
* exact route/page
* exact UI component
* exact button/form/table/modal
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

If evidence is weak, mark:

`[NEEDS CONFIRMATION]`

If the environment prevents verification, mark:

`[BLOCKED BY ENVIRONMENT]`

Avoid vague findings like:

* improve validation
* add tests
* clean up UI
* fix API
* improve permissions

Every critical finding should point to a specific workflow, file, API, route, schema, or missing test.

---

## 17. Anti-Waste Rule

Avoid long reports that do not lead to action.

Every finding should help answer at least one of:

1. What is broken?
2. Why does it matter?
3. Where is the evidence?
4. What should be fixed?
5. What should be tested?
6. What should be deferred?
7. What should not be built?

Do not produce generic architecture commentary.

Do not create a product wishlist.

Do not create broad refactor plans without direct evidence.

---

## 18. Audit Prompt Rules

During audit prompts:

* do not modify source code
* do not create tests
* do not modify tests
* do not fix broken journeys
* inspect only what is needed for the prompt scope
* save the required audit output
* stop after saving the required output
* do not continue to another module/group

Audit prompts include:

```txt
01-platform-discovery-audit-index.md
02-module-or-group-audit-gap-plan.md
05-cross-cutting-pattern-audit.md
06-database-schema-audit.md
07-consolidate-roadmap.md
```

---

## 19. Gap Organizer Rules

During the gap organizer prompt:

* do not redo the audit
* do not implement fixes
* do not create tests
* do not modify source code
* organize the raw gap plan into safe fix batches
* separate active fixes from deferred items
* separate blocked items from fix-ready items
* identify tests to write first
* stop after saving the fix-ready plan

Gap organizer prompt:

```txt
03-organize-gap-plan-for-fixing.md
```

---

## 20. Fix / TDD Prompt Rules

During the fix/TDD prompt:

* load the raw gap plan
* load the fix-ready plan
* use the fix-ready plan as the primary guide
* use the raw gap plan only as context
* execute only the selected batch
* check git/working tree status when available
* do not overwrite unrelated user changes
* write or update failing tests first when practical
* implement the smallest correct fix
* run relevant validation
* save a completed fix report
* stop after saving the fix report

Fix prompt:

```txt
04-module-or-group-fix-tdd.md
```

Do not implement:

* `V2 DEFERRED` items
* `DO NOT ADD` items
* speculative enhancements
* unrelated refactors
* unrelated cleanup
* unselected batches
* items blocked by product decisions
* items blocked by missing specs
* items blocked by environment/tooling

---

## 21. Cross-Cutting and Database Audit Rules

Run `05-cross-cutting-pattern-audit.md` only after:

* at least 2 to 3 module/group audits exist, or
* repeated platform/shared issues are already obvious.

Run `06-database-schema-audit.md` only when:

* database/schema issues appear repeatedly, or
* the platform is data-heavy enough to require global schema review.

These prompts are audit-only.

Do not fix anything in `05` or `06`.

Both prompts should load completed `*-fix-report.md` files when available, so already-fixed issues are not repeatedly reported as unresolved.

Do not confuse `*-fix-ready-plan.md` with `*-fix-report.md`.

---

## 22. Roadmap Rules

Run `07-consolidate-roadmap.md` after several audits/fixes exist.

The roadmap must distinguish:

* raw gap plans: `*-gap-plan.md`
* planned fixes: `*-fix-ready-plan.md`
* completed or attempted fixes: `*-fix-report.md`

Do not treat a fix-ready plan as completed work.

Only completed `*-fix-report.md` files can prove that fixes were attempted or completed.

The roadmap should prioritize:

1. P0 blockers
2. P1 workflow/trust/permission/testability gaps
3. repeated cross-cutting issues
4. database/schema fixes required for safe module behavior
5. selected P2 V1 workflow completeness gaps
6. low-risk V1 recommended improvements

Do not prioritize:

* `V2 DEFERRED`
* `DO NOT ADD`
* speculative enhancements
* broad refactors without direct evidence
* premature platform abstractions

---

## 23. Stop Conditions

During audit prompts:

* stop after saving the required audit output
* do not fix anything
* do not continue to another module/group

During `03-organize-gap-plan-for-fixing.md`:

* stop after saving the fix-ready plan
* do not implement fixes
* do not create tests

During `04-module-or-group-fix-tdd.md`:

* stop after fixing the selected batch
* save the fix report
* do not continue to another batch unless explicitly instructed
* do not continue to another module/group

During roadmap consolidation:

* stop after saving the roadmap
* do not modify gap plans
* do not modify fix-ready plans
* do not modify fix reports

---

## 24. Final Reminder

Be practical.

Be evidence-based.

Do not overbuild.

Do not mix output folders.

Do not confuse planned fixes with completed fixes.

Do not fix during audits.

Do not audit during fixes.

Use TDD or test-supported fixing during `04`.

Always leave the next recommended prompt/action clearly stated.

