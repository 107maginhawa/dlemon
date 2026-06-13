# 03 — Approved Docs and Root Cleanup Execution

You are executing an approved documentation and project-structure cleanup plan for a large software codebase.

This prompt must only be run after these planning prompts have already been completed and reviewed:

1. `docs/aha/project-structure/prompts/01-docs-inventory-and-prd-organization.md`
2. `docs/aha/project-structure/prompts/02-project-structure-and-root-hygiene-audit.md`

Your job is to apply the approved migration plans safely.

Do not invent a new plan.

Do not perform unapproved moves.

Do not delete useful files.

---

## 1. Required Inputs

Load and review:

`[CODEBASE_ROOT]/docs/aha/project-structure/outputs/DOCS_INVENTORY.md`

`[CODEBASE_ROOT]/docs/aha/project-structure/migration-plans/DOCS_MIGRATION_PLAN.md`

`[CODEBASE_ROOT]/docs/aha/project-structure/outputs/PRD_INDEX_DRAFT.md`

`[CODEBASE_ROOT]/docs/aha/project-structure/outputs/PROJECT_STRUCTURE_INVENTORY.md`

`[CODEBASE_ROOT]/docs/aha/project-structure/migration-plans/PROJECT_STRUCTURE_MIGRATION_PLAN.md`

If available, also load any human-approved notes or edits related to these plans.

If there is no clear approved plan, stop and produce this message:

`Execution stopped: no approved migration plan found.`

---

## 2. AHA Output Location

All execution reports from this prompt must be placed under:

`[CODEBASE_ROOT]/docs/aha/project-structure/`

Create this folder if missing:

```text
[CODEBASE_ROOT]/docs/aha/project-structure/reports/
```

Do not place execution reports directly under `/docs`.

---

## 3. Execution Scope

Execute only approved actions from the migration plans.

Allowed actions:

* create approved folders
* move approved files
* archive approved files
* rename approved files if explicitly listed
* update Markdown links affected by approved moves
* update README references affected by approved moves
* update prompt references affected by approved moves
* update audit/AHA references affected by approved moves
* update script/config references only if they refer to moved documentation/support files
* create or update documentation indexes
* create or update PRD indexes
* create or update archive indexes
* create cleanup reports

Not allowed:

* refactoring application code
* moving source files across architecture boundaries
* changing business logic
* changing database schema
* changing tests unrelated to moved file references
* changing package ownership
* changing framework conventions
* deleting files unless explicitly approved and clearly safe
* combining PRDs into one giant PRD unless explicitly approved
* reorganizing modules/packages/apps unless explicitly approved

---

## 4. Safety Rules

Follow these strictly:

1. Use `git mv` where possible to preserve history.
2. Archive instead of delete.
3. Before moving each file, confirm its proposed target from the approved migration plan.
4. After moving each file, update references to the old path.
5. Do not move files marked `[NEEDS REVIEW]`.
6. Do not move files marked `Do Not Move`.
7. Do not move high-risk files unless explicitly approved.
8. Preserve existing specialized folder structures such as `docs/aha/`.
9. Do not mix product PRDs with audit outputs.
10. Do not treat AHA audit files as product PRDs unless explicitly approved.
11. Stop if a move would clearly break CI, scripts, imports, app runtime behavior, or AI agent workflows.
12. Prefer safe partial completion over risky full completion.

---

## 5. Approved Plan Confirmation

Before executing, compare these two files:

`docs/aha/project-structure/migration-plans/DOCS_MIGRATION_PLAN.md`

`docs/aha/project-structure/migration-plans/PROJECT_STRUCTURE_MIGRATION_PLAN.md`

Confirm that there are no conflicts between:

* proposed docs moves
* proposed root/project moves
* PRD destinations
* archive destinations
* AHA output locations
* files marked keep-in-place
* files marked high-risk
* files marked do-not-move

If conflicts exist, stop and write a conflict report to:

`docs/aha/project-structure/reports/EXECUTION_CONFLICT_REPORT.md`

Use this format:

```md
# Execution Conflict Report

## Summary

## Conflicts Found

| File / Folder | Docs Plan Says | Project Plan Says | Risk | Recommendation |
|---|---|---|---|---|

## Execution Status

Execution was stopped because the approved plans conflict.
```

Do not continue execution until conflicts are resolved.

---

## 6. Folder Creation

Create approved folders first.

Common approved folders may include:

```text
docs/product/
docs/product/prd/
docs/product/prd/active/
docs/product/prd/historical/
docs/product/requirements/
docs/product/roadmap/
docs/architecture/
docs/architecture/decisions/
docs/architecture/system-overview/
docs/architecture/module-architecture/
docs/engineering/
docs/engineering/setup/
docs/engineering/testing/
docs/engineering/deployment/
docs/engineering/standards/
docs/api/
docs/integrations/
docs/runbooks/
docs/archive/
docs/archive/deprecated/
docs/archive/duplicates/
docs/archive/superseded/
docs/archive/old-ai-drafts/
scripts/
tools/
infra/
```

Only create folders that are actually needed by the approved plan.

Do not create empty folder structures unnecessarily.

---

## 7. PRD Organization Execution

For PRD-related files:

1. Move approved canonical PRDs to:

   `docs/product/prd/active/`

2. Move approved historical PRDs to:

   `docs/product/prd/historical/`

3. Move approved supporting requirement files to:

   `docs/product/requirements/`

4. Leave engineering specs outside PRD folders unless explicitly approved as product-facing.

5. Leave audit-derived requirements in audit folders unless explicitly approved for promotion.

Create or update:

`docs/product/prd/PRD_INDEX.md`

Use this format:

```md
# PRD Index

## Active PRDs

| Module / Feature | File | Status | Source | Notes |
|---|---|---|---|---|

## Historical PRDs

| Module / Feature | File | Previous Location | Reason Archived | Notes |
|---|---|---|---|---|

## Supporting Requirement Files

| Area | File | Type | Notes |
|---|---|---|---|

## Needs Review

| File | Reason | Suggested Action |
|---|---|---|
```

Important:

Do not confuse the draft planning file:

`docs/aha/project-structure/outputs/PRD_INDEX_DRAFT.md`

with the final canonical PRD index:

`docs/product/prd/PRD_INDEX.md`

---

## 8. Archive Execution

For approved archive files:

1. Move files to the approved archive path.
2. Preserve relative context where useful.
3. Do not archive files that still appear active.
4. Do not archive files referenced by active prompts/scripts unless references are updated or the file is intentionally historical.
5. Do not archive files marked `[NEEDS REVIEW]`.

Create or update:

`docs/archive/ARCHIVE_INDEX.md`

Use this format:

```md
# Archive Index

| Archived File | Original Path | Archive Reason | Date Archived | Replacement / Canonical File |
|---|---|---|---|---|
```

Use the current date for `Date Archived`.

---

## 9. Docs Index Execution

Create or update:

`docs/INDEX.md`

Use this format:

```md
# Documentation Index

## Product

- PRDs
- Requirements
- Roadmap

## Architecture

- System overview
- Module architecture
- Architecture decisions

## Engineering

- Setup
- Testing
- Deployment
- Standards

## API and Integrations

- API docs
- Integration docs

## Audit and AHA

- AHA prompts
- Audit outputs
- Gap plans
- Fix plans
- Project structure audit

## Runbooks

- Operations
- Support
- Incident response

## Archive

- Deprecated
- Superseded
- Duplicates
- Old AI drafts
```

Only include sections that actually exist.

Make sure `docs/INDEX.md` links to:

`docs/aha/project-structure/`

as the location for this project-structure audit system.

---

## 10. AHA Project Structure Index

Create or update:

`docs/aha/project-structure/README.md`

Use this format:

```md
# AHA Project Structure Audit

This folder contains the audit prompts, outputs, migration plans, and reports for documentation organization, PRD aggregation, root hygiene, and link/reference validation.

## Prompts

| Prompt | Purpose |
|---|---|
| 01 — Docs Inventory and PRD Organization | Audits `/docs`, identifies PRDs, and prepares a docs migration plan |
| 02 — Project Structure and Root Hygiene Audit | Audits root/project structure and prepares a project migration plan |
| 03 — Approved Docs and Root Cleanup Execution | Executes approved docs and root cleanup plans |
| 04 — Link and Reference Validation | Validates links and references after cleanup |

## Outputs

- `outputs/DOCS_INVENTORY.md`
- `outputs/PRD_INDEX_DRAFT.md`
- `outputs/PROJECT_STRUCTURE_INVENTORY.md`

## Migration Plans

- `migration-plans/DOCS_MIGRATION_PLAN.md`
- `migration-plans/PROJECT_STRUCTURE_MIGRATION_PLAN.md`

## Reports

- `reports/DOCS_AND_ROOT_CLEANUP_REPORT.md`
- `reports/LINK_REFERENCE_VALIDATION_REPORT.md`
```

Only list files that exist.

---

## 11. Reference Updates

After every approved move, update references in:

* Markdown files
* README files
* docs indexes
* PRD index
* archive index
* prompt files
* audit files
* root files
* package scripts, only if they reference moved docs/scripts
* CI workflows, only if they reference moved docs/scripts
* config files, only if they reference moved docs/scripts

Search for stale references using commands like:

```bash
rg "old/path/or/filename" .
rg "docs/" .
rg "\]\(" docs/
```

Use equivalent tools if `rg` is unavailable.

Do not update imports or runtime paths unless they are clearly only references to moved support files and the correct update is obvious.

---

## 12. What Not To Touch

Do not modify:

* application business logic
* source-code architecture
* domain boundaries
* database schema
* migrations
* package ownership
* framework conventions
* tests unrelated to moved file references
* lockfiles unless required by tooling and clearly intentional
* generated files unless the approved plan explicitly covers them

---

## 13. Required Final Cleanup Report

Create:

`docs/aha/project-structure/reports/DOCS_AND_ROOT_CLEANUP_REPORT.md`

Use this format:

```md
# Docs and Root Cleanup Report

## Summary

## Files Moved

| Old Path | New Path | Reason |
|---|---|---|

## Files Archived

| Old Path | Archive Path | Reason |
|---|---|---|

## Files Left Untouched

| Path | Reason |
|---|---|

## PRD Organization Summary

| PRD / Requirement Area | Canonical File | Supporting Files | Historical Files |
|---|---|---|---|

## Root Cleanup Summary

| File / Folder | Action | Reason |
|---|---|---|

## References Updated

| File | Change |
|---|---|

## Indexes Created or Updated

| File | Purpose |
|---|---|

## Validation Performed

| Check | Result |
|---|---|

## Remaining Risks

| Risk | Location | Recommendation |
|---|---|---|

## Recommended Next Actions
```

---

## 14. Stop Conditions

Stop execution and report clearly if:

* approved migration plan is missing
* migration plans conflict
* a proposed move conflicts with actual file state
* a file marked safe to move is referenced by high-risk scripts or CI
* there are multiple possible canonical PRDs and no clear approval
* moving a file would break app runtime behavior
* moving a file would break AI prompt/workflow references
* a target path already exists with different content
* the repo has uncommitted changes that make safe migration unclear

If stopped, create a report under:

`docs/aha/project-structure/reports/`

with a clear explanation of what blocked execution.

---

## 15. Final Response Required

At the end, summarize:

1. What was moved
2. What was archived
3. What PRD structure was created or updated
4. What root/project cleanup was completed
5. What references were updated
6. What was intentionally left untouched
7. Any remaining risks
8. Whether Prompt 04 should be run next for validation

Execute only the approved migration.

Do not over-clean.

Do not delete useful history.

