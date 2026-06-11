# 06 — AHA Database / Schema Audit

Use this prompt only when database/schema issues appear repeatedly, or when the platform is data-heavy enough to require a global schema review.

Do not fix anything.

Do not re-audit individual modules deeply.

Goal: identify global database/schema risks that module-level audits may miss, especially around data integrity, ownership, permissions, lifecycle states, audit/history, schema/API/UI mismatch, migration health, and test-data alignment.

This prompt should produce a practical schema remediation audit, not a speculative data model redesign.

---

## 1. Load Required AHA Files

Load and strictly follow:

`[CODEBASE_ROOT]/docs/aha/prompts/00-aha-shared-rules.md`

Load:

`[CODEBASE_ROOT]/docs/aha/outputs/module-audit-index.md`

Load all available module/group gap plans from:

`[CODEBASE_ROOT]/docs/aha/module-gap-plans/*-gap-plan.md`

If available, load:

`[CODEBASE_ROOT]/docs/aha/outputs/cross-cutting-pattern-audit.md`

If available, load all completed module/group fix reports from:

`[CODEBASE_ROOT]/docs/aha/module-fix-plans/*-fix-report.md`

Use completed fix reports to avoid reporting already-fixed database/schema issues as unresolved.

If available, optionally load module/group fix-ready plans from:

`[CODEBASE_ROOT]/docs/aha/module-fix-plans/*-fix-ready-plan.md`

Use fix-ready plans only to understand planned but not yet completed work.

Do not confuse fix-ready plans with completed fix reports.

A `*-fix-ready-plan.md` is not proof that work was completed.

A `*-fix-report.md` is the only module-level evidence that fixes were attempted or completed.

Load if available:

`[CODEBASE_ROOT]/docs/aha/kg/knowledge-graph-status.md`

`[CODEBASE_ROOT]/docs/aha/kg/domain-knowledge-status.md`

---

## 2. Scope Rule

Audit database/schema risks across the platform.

Do not fix anything.

Do not modify source code.

Do not create tests.

Do not modify tests.

Do not generate migrations.

Do not edit schemas.

Do not update ORM models.

Do not modify seed data.

Do not rewrite the data model.

Do not run destructive database commands.

This is an audit-only prompt.

You may inspect:

* schema/model files
* migration files
* seed files
* fixture files
* database config
* ORM definitions
* query/repository files
* API handlers using database models
* validation schemas
* frontend fields that depend on persisted data
* test fixtures
* data-related tests
* module gap plans with database findings
* completed fix reports with database/schema changes
* fix-ready plans with planned database/schema work

Do not perform unrelated module audits.

Do not turn this into a broad product redesign.

---

## 3. Fix-Ready vs Fix-Report Rule

When reviewing module fix files:

* `*-fix-ready-plan.md` means a fix was planned or organized.
* `*-fix-report.md` means a fix was attempted, completed, partially completed, failed, or blocked.

Do not mark a schema/database issue as fixed based only on a fix-ready plan.

If a schema/database issue appears in a fix-ready plan but has no matching fix report, classify it as:

`Planned / Not Completed`

If a schema/database issue appears in a fix report as fixed and validated, classify it as:

`Fixed`

If a schema/database issue appears in a fix report as partially fixed, blocked, or failed, classify it as:

`Still Open`

If evidence is unclear, classify it as:

`[NEEDS CONFIRMATION]`

---

## 4. Database Areas to Review

Review schema-wide issues such as:

1. table/model ownership
2. naming consistency
3. migration health
4. migration order and drift risk
5. foreign keys and relationships
6. missing or weak constraints
7. tenant/org scoping
8. user/role scoping
9. indexes and query performance
10. uniqueness constraints
11. required vs nullable fields
12. enum consistency
13. status/lifecycle fields
14. audit/history tables
15. immutable record requirements
16. soft delete patterns
17. timestamp consistency
18. created/updated/deleted metadata
19. duplicate sources of truth
20. orphaned data risks
21. seed data and test fixtures
22. schema/API mismatch
23. schema/UI mismatch
24. schema/test mismatch
25. cross-module data ownership ambiguity
26. reporting/query risks
27. data correction and reversal workflows
28. privacy/security-sensitive fields
29. backup/export/import assumptions, if visible
30. integration identifiers and external references
31. idempotency and duplicate submission risks
32. event/history consistency
33. data retention assumptions
34. unsafe deletion or mutation risks
35. fields that are stored but not consumed
36. fields that are displayed but not persisted
37. validation rules duplicated inconsistently across layers

---

## 5. Record-Sensitive System Rules

If this platform handles clinical, financial, legal, operational, compliance, or other record-sensitive data, pay extra attention to:

* audit trail
* history preservation
* signed/finalized records
* deletion rules
* correction workflow
* reversal workflow
* role-based access
* organization/tenant boundaries
* traceability
* source of truth
* immutable event history
* data retention assumptions
* export/report consistency
* downstream reporting effects
* external reference consistency
* who can create, update, void, reverse, or delete sensitive records

Do not invent compliance requirements.

Flag risks where the schema would make reliable records difficult.

Use labels:

`[NEEDS PRODUCT DECISION]`

`[NEEDS CONFIRMATION]`

`[CROSS-MODULE RISK]`

`[BLOCKED BY MISSING SPEC]`

---

## 6. Knowledge Graph Requirement

Use the existing `/understand` or `/understand-anything` knowledge graph if available.

Do not regenerate it unnecessarily.

Only refresh or rerun the knowledge graph if:

* the graph is missing
* the graph is stale compared with recent code changes
* schema/model files are not represented
* dependency/wiring questions cannot be answered
* the graph output is clearly incomplete

Use the knowledge graph to validate:

* schema ownership
* model consumers
* API consumers of tables/models
* module dependencies on shared tables
* dead or unused models
* duplicate models serving similar purposes
* query/repository dependency paths
* cross-module blast radius
* shared schema consumers
* frontend/API/backend/data flow involving key tables
* test coverage for schema-sensitive flows

Do not produce a generic architecture essay.

Summarize only schema-related KG findings.

If KG is unavailable, continue with direct code inspection and document that KG was unavailable.

---

## 7. Domain Knowledge Requirement

Use `/understand-domain` if available and useful for understanding data lifecycle, ownership, and record meaning.

Use it to validate:

* business meaning of records
* domain lifecycle states
* who owns a record
* when a record becomes final
* when a record can be corrected, voided, reversed, or deleted
* which modules should consume or modify the record
* whether a table/model represents a true source of truth or derived data
* whether duplicate models reflect valid domain separation or accidental duplication

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

If lifecycle behavior requires product clarification, mark:

`[NEEDS PRODUCT DECISION]`

Do not use `/understand-domain` to justify speculative schema expansion.

---

## 8. Webwright / Playwright Rule

Webwright is usually not required for this prompt.

Use `/webwright` only if a visible UI workflow helps confirm a schema/UI mismatch.

Use Playwright or existing E2E tests only to inspect existing data-flow coverage.

Do not create tests.

Do not modify tests.

Do not fix broken journeys.

Use Webwright/Playwright only where it helps answer questions such as:

* does a UI field save to the expected schema field?
* does saved data reload correctly?
* does a finalized record remain editable when it should not?
* does a deleted/voided record still appear downstream?
* does role/tenant scoping affect persisted records correctly?
* do browser journeys prove schema/API/UI alignment?

If evidence is captured, save it under:

```txt
[CODEBASE_ROOT]/docs/aha/evidence/screenshots/
[CODEBASE_ROOT]/docs/aha/evidence/playwright-findings/
[CODEBASE_ROOT]/docs/aha/evidence/webwright-findings/
```

---

## 9. Product Reference Rules

Use relevant product references from:

```txt
[CODEBASE_ROOT]/docs/product/
[CODEBASE_ROOT]/docs/context/
[CODEBASE_ROOT]/docs/
```

Use product docs to understand expected records, workflows, lifecycle behavior, reporting needs, permissions, and data ownership.

If expected data lifecycle behavior is missing or unclear, mark:

`[NEEDS PRODUCT DECISION]`

If product references are missing for a critical schema area, mark:

`[BLOCKED BY MISSING SPEC]`

Do not overdesign the schema based on assumptions.

Do not propose future analytics, enterprise reporting, metadata, or workflow state expansions unless required for current V1 reliability.

---

## 10. Required Questions

Answer:

1. Which tables/models belong to which modules?
2. Which tables/models are shared across modules?
3. Which schema areas have unclear ownership?
4. Are there duplicate sources of truth?
5. Are there fields saved but not consumed or enforced?
6. Are there UI/API fields missing from schema?
7. Are there schema fields not exposed safely or consistently through APIs?
8. Are required relationships enforced?
9. Are tenant/org/user scopes consistently represented?
10. Are permission-sensitive records scoped properly?
11. Are lifecycle states represented consistently?
12. Are audit/history requirements supported?
13. Are finalized or sensitive records protected from unsafe mutation/deletion?
14. Are migrations consistent with current schema definitions?
15. Are seed/test fixtures aligned with schema and real workflows?
16. Are indexes likely missing for common platform queries?
17. Are external/integration identifiers handled consistently?
18. Which schema risks are module-local?
19. Which schema risks are platform-wide?
20. Which schema fixes require product decisions before implementation?
21. Which schema/database issues were already fixed according to completed fix reports?
22. Which schema/database issues are planned but not yet completed according to fix-ready plans?
23. Which schema/database issues should be handled by normal `04-module-or-group-fix-tdd.md` module passes?
24. Which schema/database issues likely require a future specialized schema/database fix prompt?
25. Which schema/database ideas are overbuild and should be deferred or rejected?

---

## 11. Anti-Overengineering Guardrail

Do not recommend schema expansion just because it might be useful someday.

Classify recommendations as:

* `V1 REQUIRED`
* `V1 RECOMMENDED`
* `V2 DEFERRED`
* `DO NOT ADD`

Use `V1 REQUIRED` only when the schema issue blocks reliable core workflows, creates serious data integrity risk, or prevents safe record handling.

Use `V1 RECOMMENDED` when the schema fix materially improves reliability, trust, safety, testability, or maintainability without major scope expansion.

Use `V2 DEFERRED` for advanced reporting, analytics, optional metadata, future enterprise capabilities, or future workflow states unless they are required by current workflows.

Use `DO NOT ADD` when the proposed schema addition would duplicate existing behavior, create unnecessary complexity, or fall outside the module/platform’s current role.

Use:

`[DO NOT OVERBUILD]`

when a proposed abstraction or schema generalization is premature.

Do not recommend a generalized schema pattern unless repeated evidence supports it.

---

## 12. Severity and Scope Rules

Use severity levels:

* `P0` — schema issue blocks core workflows, causes data loss, creates serious safety/security risk, or makes key records unusable
* `P1` — schema issue creates serious workflow, trust, permission, record integrity, or testability gap
* `P2` — schema issue is important but not blocking
* `P3` — schema issue is minor cleanup, naming consistency, or low-risk improvement

Scope Label must be one of:

* `V1 REQUIRED`
* `V1 RECOMMENDED`
* `V2 DEFERRED`
* `DO NOT ADD`

Do not exaggerate severity.

Do not classify future reporting convenience as `P0` or `V1 REQUIRED` unless it directly blocks current V1 workflows or record safety.

---

## 13. Required Evidence Standard

Every critical finding should include at least one of:

* exact schema/model file
* exact migration file
* exact table/model name
* exact field/column name
* exact API/handler using the model
* exact UI field relying on the data
* exact query/repository file
* exact validation schema
* exact seed/fixture file
* exact test/fixture file
* exact gap plan reference
* exact fix report reference
* exact fix-ready plan reference
* exact KG consumer/blast-radius evidence
* exact domain lifecycle/use-case finding
* exact Webwright observation
* exact Playwright/E2E finding

If evidence is incomplete, mark:

`[NEEDS CONFIRMATION]`

If verification is blocked by environment/tooling, mark:

`[BLOCKED BY ENVIRONMENT]`

Avoid vague findings like:

* improve schema
* add indexes
* fix relationships
* add audit logs
* improve seed data

Each finding must point to specific tables, fields, files, APIs, workflows, or tests.

---

## 14. Required Output File

Create and save:

`[CODEBASE_ROOT]/docs/aha/outputs/database-schema-audit.md`

The file must use this structure:

```md
# AHA Database / Schema Audit

## 1. Inputs Reviewed

| Input | Details |
| --- | --- |
| Module audit index |  |
| Gap plans reviewed |  |
| Fix-ready plans reviewed |  |
| Completed fix reports reviewed |  |
| Cross-cutting audit reviewed |  |
| Schema/model files inspected |  |
| Migration files inspected |  |
| Seed/fixture files inspected |  |
| Repository/query files inspected |  |
| API/handler files inspected |  |
| Validation schemas inspected |  |
| Tests inspected |  |
| KG used | Yes/No |
| KG refreshed | Yes/No |
| `/understand-domain` used | Yes/No |
| `/understand-domain` refreshed | Yes/No |
| Webwright used | Yes/No |
| Playwright/E2E inspected | Yes/No |
| Limitations |  |

## 2. Fix Status Interpretation

| Module/Group | Gap Plan Exists? | Fix-Ready Plan Exists? | Fix Report Exists? | Schema/Data Status | Notes |
| --- | --- | --- | --- | --- | --- |

Schema/Data Status must be one of:

- Audited Only
- Fix Ready / Not Completed
- Fixed
- Partially Fixed
- Blocked
- Failed
- No Schema/Data Issue Found
- Unknown

## 3. Schema Ownership Map

| Table/Model | Owning Module/Group | Owning Module Slug | Shared? | Main Consumers | Evidence | Notes |
| --- | --- | --- | --- | --- | --- | --- |

## 4. Database / Schema Groups

| Schema Area | Tables/Models | Related Modules | Risk | Notes |
| --- | --- | --- | --- | --- |

## 5. Critical Schema Risks

| Risk | Area | Severity | Scope Label | Affected Modules | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- | --- |

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

## 6. Data Integrity Findings

Include constraints, nullability, uniqueness, FK, lifecycle, duplicate-source, and orphaned-data issues.

| Finding | Table/Model | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |

## 7. Tenant / Org / User / Permission Scoping Findings

| Finding | Table/Model/API | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |

## 8. Audit / History / Record Safety Findings

Include deletion, correction, finalization, traceability, immutable-history, and reversal risks.

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |

## 9. Lifecycle / Status Model Findings

| Finding | Table/Model | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |

## 10. API / UI / Schema Mismatches

| Mismatch | UI/API/Schema Area | Affected Modules | Evidence | Severity | Recommended Fix |
| --- | --- | --- | --- | --- | --- |

## 11. Migration Health Findings

| Finding | Migration/Schema Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |

## 12. Seed Data / Fixture / Test Data Findings

| Finding | File/Area | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- |

## 13. Index / Query Performance Risks

Only include risks with evidence from common queries, repository patterns, or obvious high-volume paths.

| Risk | Query/Table Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |

## 14. External / Integration Identifier Findings

Use this section only if the platform has integrations, external systems, imports, exports, payments, devices, claims, labs, imaging, or similar external references.

| Finding | Identifier / Integration Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |

## 15. Knowledge Graph Findings

Summarize schema-related KG findings.

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |

## 16. Domain / Data Lifecycle Findings

Summarize relevant `/understand-domain` or inferred domain lifecycle findings.

| Domain Finding | Related Table/Model | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- |

## 17. Webwright / Playwright Findings

Use this section only if Webwright or Playwright/E2E was used or inspected.

| Finding | Tool | Evidence Location | Affected Data Area | Recommendation |
| --- | --- | --- | --- | --- |

## 18. Module-Local Schema Fix Candidates

| Fix | Module/Group | Evidence | Severity | Recommended Prompt |
| --- | --- | --- | --- | --- |

Use this for schema issues that can likely be fixed safely during a normal module/group `04-module-or-group-fix-tdd.md` pass.

## 19. Platform-Wide / Shared Schema Fix Candidates

| Fix | Why Platform-Wide | Affected Modules | Evidence | Risk | Recommended Prompt |
| --- | --- | --- | --- | --- | --- |

Use this only for repeated or shared schema issues that should not be patched module-by-module.

Recommended Prompt should usually be one of:

- `04-module-or-group-fix-tdd.md` if safe within a selected module batch
- future specialized schema/database fix prompt if too broad for normal module fixing
- `07-consolidate-roadmap.md` if the issue should be prioritized later

## 20. Product Decisions Needed

| Decision | Label | Affected Tables/Modules | Why Needed | Suggested Owner / Next Step |
| --- | --- | --- | --- | --- |

Use labels:

- `[NEEDS PRODUCT DECISION]`
- `[NEEDS CONFIRMATION]`
- `[BLOCKED BY MISSING SPEC]`

## 21. Blockers

| Blocker | Label | Affected Tables/Modules | Impact | Recommended Next Step |
| --- | --- | --- | --- | --- |

Use labels:

- `[BLOCKED BY ENVIRONMENT]`
- `[BLOCKED BY MISSING SPEC]`
- `[NEEDS CONFIRMATION]`
- `[CROSS-MODULE RISK]`

## 22. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |

Use labels:

- `V2 DEFERRED`
- `DO NOT ADD`
- `[DO NOT OVERBUILD]`
- `[NEEDS PRODUCT DECISION]`

## 23. Recommended Schema Fix Order

| Order | Fix | Scope | Why Now | Tests Needed First | Risk | Recommended Prompt |
| --- | --- | --- | --- | --- | --- | --- |

Scope must be one of:

- module-local
- shared/platform
- database/schema
- cross-module
- product decision
- environment/tooling

## 24. Recommended Next Step

State the recommended next step.

Use one of:

- run `04-module-or-group-fix-tdd.md` for a specific module/group batch
- run a future specialized schema/database fix prompt
- run `05-cross-cutting-pattern-audit.md`
- continue module/group audits with `02-module-or-group-audit-gap-plan.md`
- request product decision
- resolve environment/tooling blocker
- proceed to `07-consolidate-roadmap.md` if enough audits/fixes exist

Include exact module/group name, module slug, and file paths where applicable.
```

---

## 15. Stop Condition

Stop after saving:

`[CODEBASE_ROOT]/docs/aha/outputs/database-schema-audit.md`

Do not fix anything.

Do not create migrations.

Do not edit schemas.

Do not create tests.

Do not modify source code.

Do not modify seed data.

Do not modify module gap plans.

Do not modify fix-ready plans.

Do not modify fix reports.

After saving the audit, recommend the next prompt/action based on the findings.

