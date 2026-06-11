# 02 — AHA Module/Group Audit Gap Plan

Use this prompt one module/group at a time.

Module/group to audit:

`[MODULE_OR_GROUP_NAME]`

Module/group slug:

`[MODULE_SLUG]`

Primary PRD/spec reference, if known:

`[PRIMARY_PRD_OR_SPEC_PATH]`

Do not audit unrelated modules as separate scopes.

Do not redo platform/module discovery.

Do not implement fixes.

Goal: deeply audit one selected module/group and create an evidence-based raw gap plan.

This includes checking whether the module/group implementation is complete and aligned against relevant PRDs, specs, workflows, business rules, acceptance criteria, and domain expectations.

This is not yet the fix-ready plan.

The output of this prompt will later be organized by:

`[CODEBASE_ROOT]/docs/aha/prompts/03-organize-gap-plan-for-fixing.md`

---

## 1. Load Required AHA Files

Load and strictly follow:

`[CODEBASE_ROOT]/docs/aha/prompts/00-aha-shared-rules.md`

Load:

`[CODEBASE_ROOT]/docs/aha/outputs/module-audit-index.md`

Load if available:

`[CODEBASE_ROOT]/docs/aha/kg/knowledge-graph-status.md`

`[CODEBASE_ROOT]/docs/aha/kg/domain-knowledge-status.md`

If available and directly relevant to this module/group, also load:

`[CODEBASE_ROOT]/docs/aha/outputs/cross-cutting-pattern-audit.md`

`[CODEBASE_ROOT]/docs/aha/outputs/database-schema-audit.md`

Use cross-cutting and database/schema audits only as context.

Do not allow them to expand this module/group audit into a platform-wide audit.

If the audit index is missing, stop and run:

`[CODEBASE_ROOT]/docs/aha/prompts/01-platform-discovery-audit-index.md`

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

`[CODEBASE_ROOT]/docs/aha/module-gap-plans/[MODULE_SLUG]-gap-plan.md`

---

## 3. Scope Rule

Audit only:

`[MODULE_OR_GROUP_NAME]`

Use slug:

`[MODULE_SLUG]`

You may inspect related shared/platform/database files only when necessary to understand:

* wiring
* dependencies
* permissions
* data flow
* downstream effects
* test coverage
* blast radius
* domain workflow completeness
* schema/API/UI alignment
* PRD/spec requirement implementation

Do not score or audit unrelated modules as standalone modules.

Do not create separate gap plans for related modules.

If a gap requires changes outside this module/group, mark it as:

`[SHARED DEPENDENCY]`

or:

`[CROSS-MODULE RISK]`

If the issue appears to be platform-wide, document it as a possible cross-cutting finding, but do not fully audit the platform here.

If the issue appears to require global schema review, document it as a possible database/schema finding, but do not perform a full database/schema audit here.

---

## 4. Product References / PRD Sources

Use relevant product references only.

Start with the PRD/spec references mapped to this module/group in:

`[CODEBASE_ROOT]/docs/aha/outputs/module-audit-index.md`

Also check for applicable references in:

```txt
[CODEBASE_ROOT]/docs/product/
[CODEBASE_ROOT]/docs/context/
[CODEBASE_ROOT]/docs/
```

Relevant references may include:

* PRDs
* module specs
* workflow specs
* business rules
* ideal-standard documents
* feature specs
* implementation plans
* enhancement specs
* user journey documents
* domain model documents
* API contracts
* data model notes
* test plans
* acceptance criteria

If this module/group has a specific PRD, workflow spec, enhancement spec, ideal-standard document, or implementation note, use it.

Do not force unrelated specs onto this module/group.

If multiple product references exist, identify which are:

* primary/current
* secondary/supporting
* stale or superseded
* conflicting
* unclear

If no direct PRD/spec exists, infer expected behavior from:

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

Mark unclear expected behavior as:

`[NEEDS PRODUCT DECISION]`

Mark missing product references as:

`[BLOCKED BY MISSING SPEC]`

Do not invent advanced workflows simply because they would be useful later.

---

## 5. PRD / Spec Completeness Requirement

This audit must explicitly check PRD/spec requirements against actual implementation.

For each relevant PRD/spec requirement, evaluate whether it is represented in:

* UI/page/component
* route/navigation
* form/modal/table/workspace
* API/backend handler
* service/repository logic
* schema/model/table
* validation rules
* permission/RBAC rules
* state/lifecycle behavior
* seed/test data
* automated tests
* E2E/Playwright journey, where relevant
* downstream/reporting/integration behavior, where relevant

Classify each PRD/spec requirement as:

* Implemented
* Partially Implemented
* Missing
* Implemented but Untested
* Unclear
* Not Required for V1
* Possible Overbuild

If the code implements behavior that is not supported by a PRD/spec or clear product reference, flag it as:

`Possible Overbuild`

or:

`[NEEDS CONFIRMATION]`

If a PRD/spec requirement appears V2 or future-facing, classify it as:

`V2 DEFERRED`

Do not convert every PRD idea into a V1 fix.

Use the enhancement guardrail:

* `V1 REQUIRED`
* `V1 RECOMMENDED`
* `V2 DEFERRED`
* `DO NOT ADD`

---

## 6. Knowledge Graph Requirement

Use the existing `/understand` or `/understand-anything` knowledge graph if available.

Do not regenerate it unnecessarily.

Only refresh or rerun the knowledge graph if:

* the graph is missing
* the graph is stale compared with recent code changes
* required module files are not represented
* dependency/wiring questions cannot be answered
* the graph output is clearly incomplete

Use the knowledge graph to validate:

* module boundaries
* routes/pages
* components
* handlers/controllers
* services/repositories
* schemas/models/tables
* migrations
* tests
* frontend → API → backend → data flow
* unused endpoints
* unwired UI components
* consumers of shared files
* cross-module dependencies
* blast radius
* PRD/spec requirement implementation paths

Do not use the knowledge graph to produce generic architecture commentary.

Summarize only the KG findings relevant to this module/group.

If KG is unavailable, continue with direct code inspection and mark KG status as unavailable.

---

## 7. Domain Knowledge Requirement

Use `/understand-domain` if available and useful for this module/group.

Do not rerun it unnecessarily.

Only refresh or rerun `/understand-domain` if:

* domain analysis is missing
* domain output is stale
* this module/group is not represented
* workflow/use-case questions cannot be answered
* the domain output is clearly incomplete

Use `/understand-domain` to validate:

* actors/users
* business purpose of the module/group
* domain concepts
* workflow steps
* lifecycle states
* required use cases
* cross-module process dependencies
* missing or incomplete workflows
* mismatch between code structure and business flow
* whether a proposed enhancement is truly V1 or should be deferred
* whether PRD/spec requirements match real domain workflows

Do not treat `/understand-domain` output as automatically correct.

Validate domain findings against:

* PRDs
* specs
* UI/routes
* APIs
* schemas
* tests
* seed data
* actual implementation

Mark uncertain domain findings as:

`[INFERRED]`

or:

`[NEEDS CONFIRMATION]`

If a workflow needs product clarification, mark:

`[NEEDS PRODUCT DECISION]`

Do not use `/understand-domain` to justify speculative features or overbuilding.

---

## 8. Webwright / Playwright Rules

Use `/webwright` if useful for exploratory workflow/UI audit.

Use Playwright or existing E2E tooling only for deterministic verification and test-gap identification.

During this audit:

* do not create tests
* do not modify tests
* do not modify source code
* do not fix broken journeys
* you may inspect existing tests
* you may identify tests that should be added later
* you may record observed broken journeys
* you may save evidence under `[CODEBASE_ROOT]/docs/aha/evidence/`

Use Webwright/Playwright only where it gives useful evidence.

If not used, briefly explain why:

* code/KG/domain/static review was sufficient, or
* the environment prevented it, or
* the module/group has no meaningful UI/browser journey.

Do not run broad E2E suites just to satisfy the prompt.

---

## 9. Audit Focus

Audit the module/group against:

1. Expected workflow vs actual implementation
2. PRD/spec requirement coverage
3. PRD/spec requirement → UI/API/schema/test traceability
4. PRD/spec requirements that are missing, partially implemented, or untested
5. Implemented features that are not supported by PRD/spec and may be overbuild
6. Use case completeness
7. Domain workflow completeness
8. Broken, missing, or misleading journeys
9. UI → API → backend → data → downstream effect
10. Backend endpoints with no frontend consumers
11. UI components/forms/settings with no downstream enforcement
12. Permission/RBAC/security behavior
13. Data/API/state mismatches
14. Duplicate sources of truth
15. Clinical, financial, legal, operational, or record-history risks, if applicable
16. Empty states
17. Loading states
18. Error states
19. Validation behavior
20. Save/reload behavior
21. Realistic edge cases needed for reliable V1
22. Existing tests
23. Missing backend/frontend/integration/E2E tests
24. Tests needed before/during fixes
25. Enhancement opportunities needed for V1 reliability
26. V2 items that should not be built yet
27. DO NOT ADD items that would overbuild the module
28. Shared/platform dependencies
29. Database/schema dependencies

---

## 10. Use Case Completeness Review

Create a practical use case inventory for this module/group.

For each use case, classify scope as one of:

* `V1 REQUIRED`
* `V1 RECOMMENDED`
* `V2 DEFERRED`
* `DO NOT ADD`

Guidance:

`V1 REQUIRED` means the module cannot reliably fulfill its core purpose without it.

`V1 RECOMMENDED` means it improves usability, safety, trust, testability, or completeness without major scope expansion.

`V2 DEFERRED` means useful later, but not required now.

`DO NOT ADD` means it would create unnecessary complexity, duplicate an existing feature, or fall outside the module’s role.

Use `/understand-domain` findings, PRDs, specs, and actual code to decide whether a use case is truly required.

Do not overbuild.

Do not classify a feature as `V1 REQUIRED` unless it is needed for a reliable current core workflow.

---

## 11. Domain Workflow Completeness Review

If `/understand-domain` is available or domain workflows can be inferred, include a domain workflow review.

Evaluate:

* primary actors
* trigger/start of workflow
* main steps
* required states
* expected outputs
* downstream modules affected
* audit/history needs
* current implementation status
* missing steps
* misleading or incomplete UX
* required tests

Classify each workflow step as:

* Implemented
* Partially Implemented
* Missing
* Unclear
* Not Required for V1

Do not mark every missing domain idea as a gap.

Only mark a missing workflow step as a V1 gap if it is needed for the module/group’s reliable current purpose.

---

## 12. Severity Rules

Use these severity levels:

`P0` — blocks core workflow, causes data loss, serious safety/security risk, or prevents module from being usable

`P1` — serious functional, workflow, trust, permission, or testability gap

`P2` — important but not blocking

`P3` — minor polish, cleanup, or low-risk improvement

Do not exaggerate severity.

A gap should be `P0` only when it blocks the core workflow or creates serious safety/security/data risk.

A test gap may be `P1` if it makes safe fixing impossible or leaves a critical workflow unprotected.

---

## 13. Enhancement Guardrail

Classify suggested enhancements as:

* `V1 REQUIRED`
* `V1 RECOMMENDED`
* `V2 DEFERRED`
* `DO NOT ADD`

Use:

`[DO NOT OVERBUILD]`

when a suggestion is too broad, speculative, or premature.

Do not turn the raw gap plan into a product wishlist.

Do not recommend broad abstractions unless the evidence shows they are necessary.

Do not recommend platform/shared fixes unless they are clearly justified by:

* repeated usage
* actual shared dependency
* real blast-radius concern
* cross-module risk
* existing broken pattern

---

## 14. Evidence Standard

Every critical finding should include at least one of:

* exact PRD/spec section or requirement
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

If evidence is incomplete, mark:

`[NEEDS CONFIRMATION]`

or:

`[BLOCKED BY ENVIRONMENT]`

Avoid vague findings like:

* improve validation
* add tests
* clean up UI
* fix API
* improve permissions

Each finding must point to specific workflows, files, APIs, routes, schemas, PRD/spec requirements, or missing tests.

---

## 15. Required Output File

Create and save:

`[CODEBASE_ROOT]/docs/aha/module-gap-plans/[MODULE_SLUG]-gap-plan.md`

The file must use this structure:

```md
# AHA Module/Group Gap Plan: [MODULE_OR_GROUP_NAME]

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group |  |
| Module slug |  |
| Type | Business Module / Platform Capability / Shared UI/System Group / Database/Schema Group / API/Integration Group / Frontend Route Group / Auth/RBAC/Security Group / Test Infrastructure Group / Cross-Module Journey / Domain Workflow Group / PRD / Spec Product Area / Unknown |
| Output file | `[CODEBASE_ROOT]/docs/aha/module-gap-plans/[MODULE_SLUG]-gap-plan.md` |
| Primary PRD/spec used |  |
| Supporting PRDs/specs used |  |
| PRD/spec coverage quality | Strong / Partial / Weak / Missing / Stale / Unknown |
| Paths inspected |  |
| PRDs/specs inspected |  |
| KG used | Yes/No |
| KG refreshed | Yes/No |
| `/understand-domain` used | Yes/No |
| `/understand-domain` refreshed | Yes/No |
| Webwright used | Yes/No |
| Playwright/E2E inspected | Yes/No |
| Existing tests inspected |  |
| Cross-cutting audit reviewed | Yes/No/Not Available |
| Database/schema audit reviewed | Yes/No/Not Available |
| Limitations |  |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |

## 3. Expected vs Actual

Summarize expected behavior and actual implementation.

Use `[INFERRED]`, `[NEEDS CONFIRMATION]`, `[NEEDS PRODUCT DECISION]`, or `[BLOCKED BY MISSING SPEC]` where needed.

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Status must be one of:

- Implemented
- Partially Implemented
- Missing
- Implemented but Untested
- Unclear
- Not Required for V1
- Possible Overbuild

Use `[INFERRED]`, `[NEEDS CONFIRMATION]`, `[NEEDS PRODUCT DECISION]`, or `[BLOCKED BY MISSING SPEC]` where appropriate.

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |

Scope Label must be one of:

- `V1 REQUIRED`
- `V1 RECOMMENDED`
- `V2 DEFERRED`
- `DO NOT ADD`

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |

Use this section for features/code paths that appear implemented but are not supported by PRD/spec, domain workflow, or clear product reference.

Recommendations should be one of:

- Keep
- Keep but clarify
- Move to V2
- Do not expand
- Consider removal later
- `[NEEDS CONFIRMATION]`
- `[DO NOT OVERBUILD]`

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |

Current Status must be one of:

- Implemented
- Partially Implemented
- Missing
- Unclear
- Not Required for V1

Scope Label must be one of:

- `V1 REQUIRED`
- `V1 RECOMMENDED`
- `V2 DEFERRED`
- `DO NOT ADD`

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |

Current Status must be one of:

- Implemented
- Partially Implemented
- Missing
- Unclear
- Not Required for V1

Scope Label must be one of:

- `V1 REQUIRED`
- `V1 RECOMMENDED`
- `V2 DEFERRED`
- `DO NOT ADD`

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |

Severity must be one of:

- `P0`
- `P1`
- `P2`
- `P3`

Scope Label must be one of:

- `V1 REQUIRED`
- `V1 RECOMMENDED`
- `V2 DEFERRED`
- `DO NOT ADD`

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |

Include exact routes/pages/buttons/forms/API calls where possible.

## 12. Unused / Unwired Implementation

Include:

- UI with no backend effect
- APIs with no frontend consumers
- services not called
- fields saved but not enforced
- duplicate state sources
- dead tests
- dead routes/components

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |

## 13. Data, API, State, and Schema Findings

Include module-owned database/schema risks.

Do not perform a full global database audit here.

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |

Layer examples:

- UI
- API
- backend/service
- state management
- schema/model
- migration
- seed data
- test fixture

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |

## 15. Record Safety / Audit History Findings

Use this section only if the module/group handles clinical, financial, legal, operational, compliance, or other record-sensitive data.

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |

## 16. Knowledge Graph Findings

Summarize important wiring, dependency, consumer, and blast-radius findings from `/understand` or `/understand-anything`.

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |

## 17. Domain Knowledge Findings

Summarize important domain/workflow/use-case findings from `/understand-domain`.

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |

## 18. Webwright / Playwright Findings

Use this section only if Webwright or Playwright/E2E was used or inspected.

| Finding | Tool | Evidence Location | Impact | Recommendation |
| --- | --- | --- | --- | --- |

Evidence should be saved under one of:

- `[CODEBASE_ROOT]/docs/aha/evidence/screenshots/`
- `[CODEBASE_ROOT]/docs/aha/evidence/playwright-findings/`
- `[CODEBASE_ROOT]/docs/aha/evidence/webwright-findings/`

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |

Confidence:

- High
- Medium
- Low
- Unknown

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
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

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |

Type must be one of:

- module-local
- shared/platform
- database/schema
- cross-module
- product decision
- environment/tooling

Use labels where needed:

- `[SHARED DEPENDENCY]`
- `[CROSS-MODULE RISK]`
- `[NEEDS PRODUCT DECISION]`
- `[BLOCKED BY ENVIRONMENT]`

## 22. Raw Recommended Fix Ideas

This section is not the final fix order.

Include all reasonable fix ideas found during the audit, but classify them carefully.

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |

Use labels:

- `V2 DEFERRED`
- `DO NOT ADD`
- `[DO NOT OVERBUILD]`
- `[NEEDS PRODUCT DECISION]`

## 24. Audit Decision

State one:

- `PASS`
- `PARTIAL PASS`
- `FAIL`

Briefly explain why.

Use:

- `PASS` only if the module/group appears reliable enough and has no material V1 gaps.
- `PARTIAL PASS` if the module/group is usable but has important gaps.
- `FAIL` if the module/group has P0/P1 gaps that block reliable V1 use.

## 25. Open Questions

Use labels:

- `[NEEDS CONFIRMATION]`
- `[NEEDS PRODUCT DECISION]`
- `[BLOCKED BY MISSING SPEC]`
- `[BLOCKED BY ENVIRONMENT]`

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |

## 26. Notes for Gap Plan Organizer

Briefly summarize what the next prompt, `03-organize-gap-plan-for-fixing.md`, should pay attention to.

Include:

- PRD/spec gaps that are truly V1
- likely P0/P1 fixes
- selected P2 fixes that may be required for V1 completeness
- implemented-but-not-in-PRD items that should not be expanded
- domain workflow gaps that are truly V1
- risky shared dependencies
- database/schema dependencies
- tests that should probably be written first
- product decisions that may block fixing
- items that must not be implemented yet
```

---

## 16. Stop Condition

Stop after saving:

`[CODEBASE_ROOT]/docs/aha/module-gap-plans/[MODULE_SLUG]-gap-plan.md`

Do not fix anything.

Do not continue to another module/group.

Do not create a fix-ready plan.

The fix-ready plan must be created only by:

`[CODEBASE_ROOT]/docs/aha/prompts/03-organize-gap-plan-for-fixing.md`

After saving the raw gap plan, recommend the next command/prompt to run.

Example:

```txt
Next recommended step:
Module/group: [MODULE_OR_GROUP_NAME]
Module slug: [MODULE_SLUG]
Primary PRD/spec: [PRIMARY_PRD_OR_SPEC_PATH]
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/[MODULE_SLUG]-gap-plan.md
```

