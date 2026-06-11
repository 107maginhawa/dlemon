# 05 — AHA Cross-Cutting Pattern Audit

Use this prompt after at least 2 to 3 module/group audits exist, or earlier if repeated platform-level issues are already obvious.

Do not fix anything.

Do not re-audit individual modules deeply.

Goal: identify repeated platform patterns that are causing multiple module/group failures, so they can be fixed once at the right layer instead of patched repeatedly per module.

This prompt should produce a practical platform/shared remediation audit, not a generic architecture essay.

---

## 1. Load Required AHA Files

Load and strictly follow:

`[CODEBASE_ROOT]/docs/aha/prompts/00-aha-shared-rules.md`

Load:

`[CODEBASE_ROOT]/docs/aha/outputs/module-audit-index.md`

Load all available module/group gap plans from:

`[CODEBASE_ROOT]/docs/aha/module-gap-plans/*-gap-plan.md`

If available, load all completed module/group fix reports from:

`[CODEBASE_ROOT]/docs/aha/module-fix-plans/*-fix-report.md`

Use completed fix reports to avoid reporting already-fixed issues as unresolved.

If available, optionally load module/group fix-ready plans from:

`[CODEBASE_ROOT]/docs/aha/module-fix-plans/*-fix-ready-plan.md`

Use fix-ready plans only to understand planned but not yet completed work.

Do not confuse fix-ready plans with completed fix reports.

A `*-fix-ready-plan.md` is not proof that work was completed.

A `*-fix-report.md` is the only module-level evidence that fixes were attempted or completed.

If fewer than 2 module/group gap plans exist, continue only if there is already strong evidence of repeated platform-level issues.

Otherwise, stop and recommend running:

`[CODEBASE_ROOT]/docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

on at least 2 modules/groups first.

---

## 2. Scope Rule

Audit cross-cutting platform patterns only.

Do not fix anything.

Do not modify source code.

Do not create tests.

Do not modify tests.

Do not perform a full database/schema audit here unless the issue is clearly cross-cutting and already appears in multiple module/group gap plans.

Do not re-score every individual module.

Do not rewrite module gap plans.

Do not rewrite fix-ready plans.

Do not rewrite fix reports.

Focus on:

* shared causes
* repeated implementation patterns
* platform-level risks
* shared components/services causing repeated module failures
* missing conventions that repeatedly create bugs
* test infrastructure gaps affecting multiple modules
* repeated workflow issues that should be fixed once at the right layer

---

## 3. Cross-Cutting Areas to Review

Review repeated problems across:

1. Auth/login/session handling
2. RBAC/permissions
3. Routing/navigation
4. Layouts/workspaces/shells
5. Shared UI components
6. Forms/modals/tables
7. API client/fetch layer
8. Validation/error handling
9. State management
10. Data loading/caching
11. Notifications/toasts
12. File upload/download
13. Settings/configuration enforcement
14. Audit logs/history
15. Search/filter/sort/pagination patterns
16. Test infrastructure
17. Seed/test data
18. Playwright/E2E setup
19. Environment/config handling
20. Developer experience issues that cause repeated bugs
21. Shared schema/model usage
22. Shared workflow/lifecycle patterns
23. Shared permission enforcement patterns
24. Shared error and empty-state patterns
25. Shared API response/request conventions

---

## 4. Knowledge Graph Requirement

Use the existing `/understand` or `/understand-anything` knowledge graph if available.

Do not regenerate it unnecessarily.

Only refresh or rerun the knowledge graph if:

* the graph is missing
* the graph is stale compared with recent code changes
* shared/platform files are not represented
* dependency/wiring questions cannot be answered
* the graph output is clearly incomplete

Use the knowledge graph to validate:

* shared files with many consumers
* repeated dependency patterns
* shared components used across modules
* API client usage
* auth/RBAC consumers
* form/table/modal consumers
* routes and layout dependencies
* test utilities and fixtures
* platform service consumers
* blast radius of possible platform-level fixes

Do not produce a generic architecture essay.

Summarize only KG findings relevant to repeated cross-cutting issues.

If KG is unavailable, continue with direct code inspection and document that KG was unavailable.

---

## 5. Domain Knowledge Requirement

Use `/understand-domain` only if repeated failures are clearly domain/workflow-pattern related.

Examples:

* multiple modules implement the same lifecycle differently
* cross-module workflow ownership is unclear
* domain state transitions are inconsistent
* product workflow appears split across modules incorrectly
* repeated business process rules are duplicated inconsistently
* shared workflow primitives are missing or misused

Do not rerun `/understand-domain` if existing domain findings are sufficient.

Do not use domain analysis to justify speculative platform abstractions.

Do not centralize domain logic unless repeated evidence shows that inconsistency is causing real V1 reliability, safety, workflow, or testability problems.

Mark uncertain domain findings as:

`[INFERRED]`

or:

`[NEEDS CONFIRMATION]`

If a domain workflow requires a product decision, mark:

`[NEEDS PRODUCT DECISION]`

---

## 6. Webwright / Playwright Rules

Use `/webwright` only if it helps confirm repeated UI/workflow issues across modules.

Use Playwright or existing E2E tooling only to inspect existing journey coverage or determine test infrastructure gaps.

Do not create or modify tests.

Do not fix broken journeys.

Do not run broad browser automation unless it produces useful evidence.

Use Webwright/Playwright only where it helps answer questions such as:

* does the same navigation pattern fail across modules?
* do shared layouts break multiple workflows?
* do shared forms/modals behave inconsistently?
* are core journeys missing E2E coverage across multiple modules?
* are role-based journeys unprotected by browser-level tests?

If evidence is captured, save it under:

```txt
[CODEBASE_ROOT]/docs/aha/evidence/screenshots/
[CODEBASE_ROOT]/docs/aha/evidence/playwright-findings/
[CODEBASE_ROOT]/docs/aha/evidence/webwright-findings/
```

---

## 7. Required Questions

Answer:

1. Which problems repeat across multiple modules/groups?
2. Which repeated problems remain unresolved according to completed `*-fix-report.md` files?
3. Which repeated problems are already planned in `*-fix-ready-plan.md` files but not yet completed?
4. Which shared files/components/services appear to cause repeated failures?
5. Which missing conventions are causing inconsistent implementation?
6. Which platform services are used inconsistently or incorrectly?
7. Which module gaps should actually be fixed once at the platform/shared layer?
8. Which fixes would reduce future module bugs?
9. Which fixes are too risky to centralize now?
10. Which issues should remain module-local?
11. Which shared fixes require regression testing across multiple modules?
12. Which platform gaps block future module audits or fixes?
13. Which repeated issues are actually database/schema issues and should be handled by `06-database-schema-audit.md`?
14. Which repeated issues need a product decision before platform-level fixing?
15. Which repeated issues are overbuild risks and should not be centralized yet?

---

## 8. Anti-Overengineering Guardrail

Do not recommend centralizing something just because it appears twice.

Recommend a platform/shared fix only if at least one of these is true:

* the same bug pattern affects multiple modules
* there is already a shared abstraction being misused
* duplicated logic is causing inconsistent behavior
* a shared fix would reduce risk more than it increases blast radius
* a shared convention is missing and causing repeated implementation gaps
* regression tests can reasonably protect the change
* module-level patching would create more risk than a shared fix

Mark premature abstractions as:

`[DO NOT OVERBUILD]`

or:

`V2 DEFERRED`

Do not recommend broad platform rewrites.

Do not create a new framework, engine, or abstraction unless repeated evidence clearly justifies it.

Do not use this audit to push speculative architecture improvements.

---

## 9. Severity and Scope Rules

Use severity levels:

* `P0` — repeated issue blocks core workflows, causes data loss, creates serious safety/security risk, or makes multiple modules unusable
* `P1` — repeated issue creates serious workflow, trust, permission, or testability gap
* `P2` — repeated issue is important but not blocking
* `P3` — repeated issue is minor polish, cleanup, or low-risk improvement

Classify recommendations as:

* `V1 REQUIRED`
* `V1 RECOMMENDED`
* `V2 DEFERRED`
* `DO NOT ADD`

Use `V1 REQUIRED` only when the platform/shared issue blocks reliable current V1 behavior.

Use `V1 RECOMMENDED` when the shared fix would materially improve reliability, usability, safety, trust, or testability without major scope expansion.

Use `V2 DEFERRED` for future platform improvements that are useful but not required now.

Use `DO NOT ADD` when the proposed shared fix would overbuild, duplicate, or expand beyond current needs.

---

## 10. Required Evidence Standard

Every cross-cutting finding should include at least one of:

* affected module gap plans
* completed module fix reports
* planned but incomplete fix-ready plans
* exact shared file/path
* exact shared component/service
* exact route/layout
* exact API client/helper
* exact auth/RBAC layer
* exact test utility/config
* exact repeated journey issue
* exact KG consumer/blast-radius evidence
* exact Webwright finding
* exact Playwright/E2E finding

If evidence is weak, mark:

`[NEEDS CONFIRMATION]`

If the issue is blocked by environment/tooling, mark:

`[BLOCKED BY ENVIRONMENT]`

Avoid vague findings like:

* improve shared components
* fix permissions
* clean up API layer
* improve tests

Each finding must point to specific repeated evidence.

---

## 11. Fix-Ready vs Fix-Report Rule

When reviewing module fix files:

* `*-fix-ready-plan.md` means a fix was planned or organized.
* `*-fix-report.md` means a fix was attempted, completed, partially completed, failed, or blocked.

Do not mark an issue as fixed based only on a fix-ready plan.

If a repeated issue appears in a fix-ready plan but has no matching fix report, classify it as:

`Planned / Not Completed`

If a repeated issue appears in a fix report as fixed and validated, classify it as:

`Fixed`

If a repeated issue appears in a fix report as partially fixed, blocked, or failed, classify it as:

`Still Open`

If evidence is unclear, classify it as:

`[NEEDS CONFIRMATION]`

---

## 12. Required Output File

Create and save:

`[CODEBASE_ROOT]/docs/aha/outputs/cross-cutting-pattern-audit.md`

The file must use this structure:

```md
# AHA Cross-Cutting Pattern Audit

## 1. Inputs Reviewed

| Input | Details |
| --- | --- |
| Module audit index |  |
| Gap plans reviewed |  |
| Fix-ready plans reviewed |  |
| Completed fix reports reviewed |  |
| KG used | Yes/No |
| KG refreshed | Yes/No |
| `/understand-domain` used | Yes/No |
| `/understand-domain` refreshed | Yes/No |
| Webwright used | Yes/No |
| Playwright/E2E inspected | Yes/No |
| Shared/platform files inspected |  |
| Limitations |  |

## 2. Fix Status Interpretation

| Module/Group | Gap Plan Exists? | Fix-Ready Plan Exists? | Fix Report Exists? | Interpreted Status | Notes |
| --- | --- | --- | --- | --- | --- |

Interpreted Status must be one of:

- Audited Only
- Fix Ready / Not Completed
- Fixed
- Partially Fixed
- Blocked
- Failed
- Unknown

## 3. Recurring Patterns

| Pattern | Affected Modules/Groups | Severity | Scope Label | Evidence | Root Cause | Recommended Platform Fix |
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

## 4. Shared Files / Services With High Blast Radius

| File/Service/Component | Main Consumers | Risk | Evidence | Recommendation |
| --- | --- | --- | --- | --- |

## 5. Platform-Level Fix Candidates

| Fix | Why Platform-Level | Modules Helped | Severity Addressed | Test Requirements | Risk |
| --- | --- | --- | --- | --- | --- |

Only include fixes that are justified by repeated evidence.

## 6. Issues That Should Stay Module-Local

| Issue | Module/Group | Why Not Platform-Level | Recommendation |
| --- | --- | --- | --- |

## 7. Do Not Centralize Yet

| Candidate | Label | Why Deferred or Rejected |
| --- | --- | --- |

Use labels:

- `V2 DEFERRED`
- `DO NOT ADD`
- `[DO NOT OVERBUILD]`
- `[NEEDS PRODUCT DECISION]`

## 8. Test Infrastructure Findings

| Finding | Evidence | Affected Modules | Recommended Fix | Priority |
| --- | --- | --- | --- | --- |

Include only test infrastructure issues that affect multiple modules/groups or block reliable fixing.

Priority must be one of:

- P0
- P1
- P2
- P3

## 9. Domain / Workflow Pattern Findings

Use this section only if repeated domain/workflow issues were found.

| Finding | Affected Modules/Groups | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |

## 10. Webwright / Playwright Findings

Use this section only if Webwright or Playwright/E2E was used or inspected.

| Finding | Tool | Evidence Location | Affected Modules/Groups | Recommendation |
| --- | --- | --- | --- | --- |

## 11. Database / Schema-Related Cross-Cutting Findings

Use this section only for repeated data/schema issues discovered while reviewing cross-cutting patterns.

Do not perform a full schema audit here.

| Finding | Affected Modules/Groups | Evidence | Should Go To `06-database-schema-audit.md`? | Recommendation |
| --- | --- | --- | --- | --- |

## 12. Recommended Platform Fix Order

| Order | Fix | Why Now | Modules Helped | Tests Needed First | Risk | Recommended Prompt |
| --- | --- | --- | --- | --- | --- | --- |

Recommended Prompt should usually be one of:

- `04-module-or-group-fix-tdd.md` if the fix can be handled safely as part of a selected module/group batch
- future specialized platform fix prompt if the issue is too broad for normal module fixing
- `06-database-schema-audit.md` if schema/database review is needed first

## 13. Dependencies / Blockers

| Blocker | Label | Why It Matters | Suggested Next Step |
| --- | --- | --- | --- |

Use labels:

- `[NEEDS PRODUCT DECISION]`
- `[NEEDS CONFIRMATION]`
- `[BLOCKED BY MISSING SPEC]`
- `[BLOCKED BY ENVIRONMENT]`
- `[CROSS-MODULE RISK]`

## 14. Deferred / Do Not Build

| Item | Label | Why Not Active |
| --- | --- | --- |

Use labels:

- `V2 DEFERRED`
- `DO NOT ADD`
- `[DO NOT OVERBUILD]`

## 15. Recommended Next Step

State the recommended next step.

Use one of:

- run `04-module-or-group-fix-tdd.md` for a specific module/group batch
- run a future specialized platform/shared fix prompt
- run `06-database-schema-audit.md`
- continue module/group audits with `02-module-or-group-audit-gap-plan.md`
- request product decision
- resolve environment/tooling blocker
- proceed to `07-consolidate-roadmap.md` if enough audits/fixes exist

Include exact module/group name, module slug, and file paths where applicable.
```

---

## 13. Stop Condition

Stop after saving:

`[CODEBASE_ROOT]/docs/aha/outputs/cross-cutting-pattern-audit.md`

Do not fix anything.

Do not create tests.

Do not modify source code.

Do not modify module gap plans.

Do not modify fix-ready plans.

Do not modify fix reports.

After saving the audit, recommend the next prompt/action based on the findings.

