# 01 — AHA Platform Discovery & Audit Index

Use this prompt once at the beginning of the AHA audit.

Do not fix anything.

Do not audit individual modules deeply yet.

Goal: identify the platform’s real audit batches/modules/groups so future audits can run one module/group at a time using filesystem-safe slugs and clean AHA output paths.

This prompt should also identify available PRDs/specs and map them to modules/groups so later audits can evaluate whether the codebase is complete against product intent.

This prompt should create a practical audit queue, not a long architecture essay.

---

## 1. Load Shared Rules

Load and strictly follow:

`[CODEBASE_ROOT]/docs/aha/prompts/00-aha-shared-rules.md`

If the shared rules file is missing, stop and ask for it to be created first.

---

## 2. Create AHA Folder Structure

Create these folders if missing:

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

Do not save AHA outputs outside:

`[CODEBASE_ROOT]/docs/aha/`

Do not mix these outputs with older audit folders.

---

## 3. Discovery Scope

Identify audit batches across the whole platform, including:

1. Business modules
2. Platform capabilities
3. Shared UI/system components
4. Database/schema groups
5. API/backend groups
6. Integration groups
7. Frontend route/page groups
8. Workflow engines/shared services
9. Auth/RBAC/security layer
10. Test infrastructure
11. Cross-module journeys
12. Domain/business workflow areas
13. PRD/spec-defined product areas
14. Product requirements that appear to span multiple modules

Do not treat everything as a business module.

Some audit targets may be platform groups, shared services, database groups, test groups, cross-module journeys, domain workflow groups, or PRD-defined product areas.

The goal is to create a clean audit queue that future prompts can execute one module/group at a time.

---

## 4. Filesystem-Safe Module Slug Rule

For every discovered module/group, create a filesystem-safe `Module Slug`.

Use lowercase kebab-case.

Examples:

```txt
Patient Management → patient-management
Auth/RBAC → auth-rbac
Billing & Claims → billing-claims
Lab Results / Diagnostics → lab-results-diagnostics
```

Do not use spaces, slashes, ampersands, parentheses, or special characters in file names.

Use the readable module/group name in tables and document titles.

Use the slug for all downstream filenames.

Examples:

```txt
[CODEBASE_ROOT]/docs/aha/module-gap-plans/patient-management-gap-plan.md
[CODEBASE_ROOT]/docs/aha/module-fix-plans/patient-management-fix-ready-plan.md
[CODEBASE_ROOT]/docs/aha/module-fix-plans/patient-management-fix-report.md
```

Every row in the audit index that may be used by later prompts must include both:

* readable module/group name
* module/group slug

---

## 5. Product Reference / PRD Discovery

Use available product references where relevant:

```txt
[CODEBASE_ROOT]/docs/product/
[CODEBASE_ROOT]/docs/context/
[CODEBASE_ROOT]/docs/
```

Look specifically for:

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

Map each relevant product reference to one or more modules/groups.

For each product reference, determine:

1. Which module/group it belongs to
2. Which workflow or capability it describes
3. Whether it appears current or stale
4. Whether it defines V1 required behavior
5. Whether it describes future/V2 behavior
6. Whether the related code area exists
7. Whether later module audits should use it as a primary reference

Do not assume every document is current.

If a product reference appears stale, incomplete, duplicated, or contradicted by newer code/docs, mark:

`[NEEDS CONFIRMATION]`

If a module/group has no clear PRD/spec but appears important, mark:

`[BLOCKED BY MISSING SPEC]`

If expected behavior must be inferred from implementation, mark:

`[INFERRED]`

If a requirement needs a product owner decision, mark:

`[NEEDS PRODUCT DECISION]`

---

## 6. Codebase References to Inspect

Inspect the actual codebase structure:

* app routes/pages
* frontend components
* backend routes/handlers/controllers
* services
* repositories
* schemas/models
* database migrations
* API clients
* state management
* tests
* seed data
* configuration
* package/workspace layout

Use PRDs and specs to understand expected product areas, but use the actual codebase to determine what truly exists.

Do not invent modules that are only aspirational unless product docs clearly show they are part of the current intended V1 platform.

If something appears aspirational or unclear, mark it:

`[INFERRED]`

or:

`[NEEDS CONFIRMATION]`

---

## 7. PRD / Spec to Code Completeness Discovery

This prompt should not deeply audit each module yet.

However, it must identify whether later audits can perform PRD-to-code completeness checks.

For each module/group, determine whether there is enough product reference material to later evaluate:

* expected workflows
* required actors/roles
* lifecycle states
* UI/pages
* API/backend behavior
* schema/data requirements
* permissions/RBAC
* validations
* edge cases
* reports/exports, if applicable
* integrations, if applicable
* acceptance criteria
* test expectations

Do not produce a full PRD-to-code traceability matrix here.

That belongs in:

`02-module-or-group-audit-gap-plan.md`

But do identify which PRDs/specs should be loaded by `02` for each module/group.

If a PRD/spec requirement appears to have no corresponding code area at all, list it as an immediate concern but do not deep-audit it yet.

If code appears to implement a major feature not covered by PRD/spec, mark it as:

`Possible Overbuild`

or:

`[NEEDS CONFIRMATION]`

---

## 8. Knowledge Graph Requirement

Use the existing `/understand` or `/understand-anything` knowledge graph if available.

Do not regenerate it unnecessarily.

Only refresh or rerun the knowledge graph if:

* the graph is missing
* the graph is stale compared with recent code changes
* required module files are not represented
* dependency/wiring questions cannot be answered
* the graph output is clearly incomplete

Use the knowledge graph to help identify:

* module boundaries
* files and folders
* frontend routes/pages
* backend routes/handlers/services
* database tables/models
* tests
* consumers of shared files
* orphaned endpoints
* unwired UI
* cross-module dependencies
* blast radius
* code areas that correspond to PRD/spec-defined features

Do not turn the knowledge graph output into a generic architecture essay.

If KG is used, summarize its status in the output.

If useful, save or update a short KG status note at:

`[CODEBASE_ROOT]/docs/aha/kg/knowledge-graph-status.md`

---

## 9. Domain Knowledge Requirement

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
* PRD/spec workflows that do not map cleanly to code structure

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

`[INFERRED]`

or:

`[NEEDS CONFIRMATION]`

If a domain workflow requires a product decision, mark:

`[NEEDS PRODUCT DECISION]`

Do not use `/understand-domain` to justify speculative features or overbuilding.

If useful, save or update a short domain status note at:

`[CODEBASE_ROOT]/docs/aha/kg/domain-knowledge-status.md`

---

## 10. Webwright / Playwright Rule

For this discovery prompt, Webwright and Playwright are optional.

Use `/webwright` only if it helps identify major visible areas, workflows, broken route groups, or user journeys.

Use Playwright only if existing E2E config/tests help identify journey coverage.

Do not create tests.

Do not modify tests.

Do not fix broken journeys.

Do not modify source code.

If Webwright or Playwright is not used, briefly explain why it was unnecessary or unavailable.

---

## 11. Discovery Questions

Answer these questions:

1. What are the actual modules/groups in this codebase?
2. What filesystem-safe slug should each module/group use?
3. Which are business modules?
4. Which are platform/shared groups?
5. Which are database/schema groups?
6. Which are frontend route/page groups?
7. Which are API/backend groups?
8. Which are integration groups?
9. Which are auth/RBAC/security groups?
10. Which are test infrastructure groups?
11. Which are cross-cutting groups that should not be audited like normal business modules?
12. Which PRDs/specs/product references exist?
13. Which PRDs/specs map to which modules/groups?
14. Which modules/groups have strong PRD/spec coverage?
15. Which modules/groups have weak, stale, or missing PRD/spec coverage?
16. Which PRD/spec-defined requirements appear to have no obvious code area?
17. Which implemented code areas appear to lack PRD/spec support?
18. Which business/domain workflows exist according to `/understand-domain`, PRDs, specs, and code?
19. Which modules/groups map cleanly to business workflows?
20. Which workflows span multiple modules/groups?
21. Which modules/groups already have tests?
22. Which modules/groups appear high-risk?
23. Which modules/groups are central to the platform workflow?
24. Which cross-module journeys need special attention?
25. Which modules/groups should be audited first?
26. Which modules/groups should be delayed because dependencies or product references are unclear?

---

## 12. Risk Classification

For each module/group, classify risk as:

* High
* Medium
* Low
* Unknown

Use `High` when there are signs of:

* core workflow dependency
* missing tests
* unclear ownership
* many cross-module dependencies
* sensitive data
* billing/financial impact
* clinical/legal/record impact
* permission/RBAC exposure
* major UI/API/schema mismatch
* stale or missing specs
* unclear domain workflow ownership
* PRD/spec-defined V1 requirements with unclear implementation
* important implemented features with no product reference

Use `Unknown` when evidence is insufficient.

Do not exaggerate risk without evidence.

---

## 13. PRD / Spec Coverage Classification

For each module/group, classify PRD/spec coverage as:

* Strong
* Partial
* Weak
* Missing
* Stale / Needs Confirmation
* Unknown

Use `Strong` when there is a clear current PRD/spec or equivalent product reference with enough detail to audit implementation completeness.

Use `Partial` when there is some product reference, but important workflows, roles, states, or acceptance criteria are missing.

Use `Weak` when product expectations must mostly be inferred from code, routes, UI, schema, or tests.

Use `Missing` when no meaningful product reference is found.

Use `Stale / Needs Confirmation` when references appear outdated, contradictory, or superseded.

Use `Unknown` when there is insufficient evidence.

---

## 14. Audit Batch Types

Classify each audit batch as one of:

* Business Module
* Platform Capability
* Shared UI/System Group
* Database/Schema Group
* API/Integration Group
* Frontend Route Group
* Auth/RBAC/Security Group
* Test Infrastructure Group
* Cross-Module Journey
* Domain Workflow Group
* PRD / Spec Product Area
* Unknown / Needs Review

Use the type that best reflects how the area should be audited later.

Do not force shared services, schema groups, test infrastructure, cross-module workflows, or PRD-defined product areas into the Business Module category.

---

## 15. Required Output File

Create and save:

`[CODEBASE_ROOT]/docs/aha/outputs/module-audit-index.md`

The file must use this structure:

```md
# AHA Module & Audit Batch Index

## 1. Discovery Summary

Briefly explain what was inspected.

Include:

- code areas inspected
- docs/specs inspected
- PRDs/product references inspected
- tests inspected
- KG used or not used
- `/understand-domain` used or not used
- Webwright/Playwright used or not used
- limitations

## 2. Knowledge Graph Status

| Item | Status | Notes |
| --- | --- | --- |
| Existing KG found | Yes/No |  |
| KG tool/source |  |  |
| KG appears fresh | Yes/No/Unknown |  |
| KG refreshed or regenerated | Yes/No |  |
| Regeneration needed | Yes/No |  |
| Missing areas |  |  |
| KG status file saved | Yes/No | `[CODEBASE_ROOT]/docs/aha/kg/knowledge-graph-status.md` |

## 3. Domain Knowledge Status

| Item | Status | Notes |
| --- | --- | --- |
| `/understand-domain` available | Yes/No/Unknown |  |
| Domain graph/output used | Yes/No |  |
| Domain output appears sufficient | Yes/No/Unknown |  |
| Domain output refreshed or regenerated | Yes/No |  |
| Missing or unclear domain areas |  |  |
| Domain status file saved | Yes/No | `[CODEBASE_ROOT]/docs/aha/kg/domain-knowledge-status.md` |

## 4. PRD / Spec Inventory

| Product Reference | Path | Type | Related Module/Group | Related Module Slug | Appears Current? | Notes |
| --- | --- | --- | --- | --- | --- | --- |

Type examples:

- PRD
- workflow spec
- business rules
- ideal-standard document
- implementation plan
- enhancement spec
- API contract
- data model note
- test plan
- acceptance criteria
- unknown

Appears Current? must be one of:

- Yes
- No
- Unknown
- Stale / Needs Confirmation

## 5. PRD / Spec Coverage by Module

| Module/Group | Module Slug | PRD/Spec Coverage | Primary Product References | Missing Product Detail | Risk | Label |
| --- | --- | --- | --- | --- | --- | --- |

PRD/Spec Coverage must be one of:

- Strong
- Partial
- Weak
- Missing
- Stale / Needs Confirmation
- Unknown

Use labels:

- `[BLOCKED BY MISSING SPEC]`
- `[NEEDS PRODUCT DECISION]`
- `[NEEDS CONFIRMATION]`
- `[INFERRED]`

## 6. PRD / Spec to Code Discovery Notes

This is not the full traceability matrix.

That belongs in `02-module-or-group-audit-gap-plan.md`.

Use this section only for obvious discovery-level mismatches.

| PRD / Spec Area | Related Module/Group | Module Slug | Code Area Found? | Evidence | Concern | Recommended Handling |
| --- | --- | --- | --- | --- | --- | --- |

Code Area Found? must be one of:

- Yes
- Partial
- No
- Unknown

Concern examples:

- PRD requirement has no obvious code area
- Code exists but product reference unclear
- Product reference appears stale
- Requirement spans multiple modules
- Possible overbuild
- Needs deeper module audit

## 7. Business / Domain Workflows

| Workflow | Actors | Main Steps | Modules/Groups Involved | Module Slugs Involved | Product Reference | Evidence | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## 8. Business Modules

| Module | Module Slug | Purpose | Main Paths | Routes/Pages | APIs/Handlers | DB/Schema | Tests Found | PRD/Spec Coverage | Primary PRD/Spec | Domain Workflow Mapping | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## 9. Platform / Shared Groups

| Group | Group Slug | Purpose | Main Paths | Main Consumers | Tests Found | PRD/Spec Coverage | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## 10. Database / Schema Groups

| Schema Area | Schema Slug | Tables/Models | Owning Module(s) | Owning Module Slug(s) | Migrations Found | Tests Found | Product Reference | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## 11. API / Integration Groups

| API Group | API Group Slug | Purpose | Main Paths | Consumers | Tests Found | Product Reference | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## 12. Frontend Route / Page Groups

| Route/Page Group | Route/Page Slug | Purpose | Main Paths | Related Module(s) | Related Module Slug(s) | Tests Found | Product Reference | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## 13. Auth / RBAC / Security Groups

| Group | Group Slug | Purpose | Main Paths | Consumers | Tests Found | Product Reference | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## 14. Test Infrastructure Groups

| Test Group | Test Group Slug | Purpose | Main Paths | Related Modules/Groups | Current Coverage | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

## 15. Cross-Module Journeys

| Journey | Journey Slug | Modules/Groups Involved | Module Slugs Involved | Product Reference | Current Evidence | Risk | Suggested Audit Timing |
| --- | --- | --- | --- | --- | --- | --- | --- |

Examples to look for:

- login → dashboard → module action
- customer/patient/member → encounter/order/transaction/billing
- settings → enforced behavior
- role change → permission effect
- order/request → fulfillment/result/report
- data creation → downstream visibility

## 16. Suggested Audit Order

| Order | Module/Group | Module Slug | Type | Risk | PRD/Spec Coverage | Why This Order | Recommended Prompt |
| --- | --- | --- | --- | --- | --- | --- | --- |

Use:

- `02-module-or-group-audit-gap-plan.md` for most modules/groups
- `05-cross-cutting-pattern-audit.md` only after repeated platform/shared issues appear
- `06-database-schema-audit.md` only when database/schema issues appear repeatedly or the platform is data-heavy

## 17. Missing or Weak Product References

| Module/Group | Module Slug | Missing Reference | Why It Matters | Label |
| --- | --- | --- | --- | --- |

Use labels:

- `[BLOCKED BY MISSING SPEC]`
- `[NEEDS PRODUCT DECISION]`
- `[NEEDS CONFIRMATION]`
- `[INFERRED]`

## 18. Immediate Concerns

List only obvious high-risk issues discovered during indexing.

Do not deep-audit them yet.

| Concern | Module/Group | Module Slug | Evidence | Risk | Recommended Next Step |
| --- | --- | --- | --- | --- | --- |

## 19. Recommended First Module/Group To Audit

State the best first module/group to audit next.

Include:

- readable module/group name
- module slug
- reason for choosing it first
- PRD/spec coverage status
- primary PRD/spec to use, if available
- recommended prompt

## 20. Do Not Audit Yet / Delay

| Module/Group | Module Slug | Reason To Delay | Label | Recommended Prerequisite |
| --- | --- | --- | --- | --- |

Use this for modules/groups that depend on unclear product decisions, missing specs, broken environment setup, or unresolved shared dependencies.
```

---

## 16. Final Instruction

After saving the index, stop.

Do not proceed to module-level audit automatically.

Recommend the next command/prompt to run, using the exact readable module/group name and module slug.

Example:

```txt
Next recommended audit:
Module/group: Patient Management
Module slug: patient-management
PRD/spec coverage: Partial
Primary PRD/spec: docs/product/patient-management-prd.md
Prompt: docs/aha/prompts/02-module-or-group-audit-gap-plan.md
```

