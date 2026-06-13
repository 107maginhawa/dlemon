# 04 — Link and Reference Validation

You are validating documentation links, file references, and repo path references after documentation and root/project cleanup.

This prompt should be run after:

1. `docs/aha/project-structure/prompts/01-docs-inventory-and-prd-organization.md`
2. `docs/aha/project-structure/prompts/02-project-structure-and-root-hygiene-audit.md`
3. `docs/aha/project-structure/prompts/03-approved-docs-and-root-cleanup-execution.md`

Your goal is to verify that the cleanup did not break documentation links, codebase references, prompts, scripts, CI, tests, or developer workflows.

Do not perform broad restructuring.

Only fix broken references when the correct fix is clear and low-risk.

---

## 1. Required Inputs

Load and review these files if available:

`[CODEBASE_ROOT]/docs/aha/project-structure/outputs/DOCS_INVENTORY.md`

`[CODEBASE_ROOT]/docs/aha/project-structure/migration-plans/DOCS_MIGRATION_PLAN.md`

`[CODEBASE_ROOT]/docs/aha/project-structure/outputs/PRD_INDEX_DRAFT.md`

`[CODEBASE_ROOT]/docs/aha/project-structure/outputs/PROJECT_STRUCTURE_INVENTORY.md`

`[CODEBASE_ROOT]/docs/aha/project-structure/migration-plans/PROJECT_STRUCTURE_MIGRATION_PLAN.md`

`[CODEBASE_ROOT]/docs/aha/project-structure/reports/DOCS_AND_ROOT_CLEANUP_REPORT.md`

Also review these canonical files if they exist:

`[CODEBASE_ROOT]/docs/INDEX.md`

`[CODEBASE_ROOT]/docs/product/prd/PRD_INDEX.md`

`[CODEBASE_ROOT]/docs/archive/ARCHIVE_INDEX.md`

`[CODEBASE_ROOT]/docs/aha/project-structure/README.md`

If any required files are missing, proceed with best-effort validation and clearly state what was missing.

---

## 2. AHA Output Location

All validation reports from this prompt must be placed under:

`[CODEBASE_ROOT]/docs/aha/project-structure/reports/`

Create this folder if missing.

Do not place validation reports directly under `/docs`.

---

## 3. Validation Scope

Validate references across the entire codebase.

Check:

* Markdown links
* relative links
* absolute `/docs/...` references
* root README links
* package/module README links
* docs index links
* PRD index links
* archive index links
* AHA prompt references
* audit output references
* image links
* Mermaid/image references
* package.json script references
* tsconfig path references
* CI workflow references
* Docker/deployment references
* test setup references
* scripts that read docs
* code comments that point to docs
* AI agent instruction files such as `AGENTS.md`, `CLAUDE.md`, `.cursor/`, or `.windsurf/`

---

## 4. Validation Commands

Use available tooling.

Suggested commands:

```bash
rg "docs/" .
rg "aha/project-structure" .
rg "PRD_INDEX" .
rg "ARCHIVE_INDEX" .
rg "\]\(" docs/
find docs -name "*.md"
```

If the migration report lists old paths, search each old path and filename:

```bash
rg "old/path/or/filename" .
rg "old-filename.md" .
```

If a Markdown link checker is available, run it.

Examples:

```bash
npx markdown-link-check "docs/**/*.md"
```

or:

```bash
lychee "docs/**/*.md"
```

If no link checker is available, perform a best-effort static validation.

Clearly state the limitation.

---

## 5. Broken Link Detection

For every Markdown file, check:

* relative file links
* relative folder links
* root-relative docs links
* image links
* anchor links where practical
* links to moved files
* links to archived files
* links to old PRD locations
* links to old root files
* links inside AHA/project-structure prompts and reports

Classify each issue as:

* **Confirmed broken** — target does not exist
* **Likely broken** — target path appears stale but cannot fully verify
* **External link not checked** — internet/external validation unavailable
* **Anchor uncertain** — file exists but anchor may be wrong
* **Valid** — target exists

---

## 6. Stale Reference Validation

Search for stale references to old paths from:

`docs/aha/project-structure/reports/DOCS_AND_ROOT_CLEANUP_REPORT.md`

For each moved or archived file, search for:

* exact old path
* filename only
* old folder name
* old relative path patterns
* old PRD paths
* old root file paths
* old AHA output paths, if any

Check references in:

* docs
* root files
* scripts
* configs
* package files
* CI files
* prompt files
* audit files
* tests
* code comments where relevant

---

## 7. Fix Rules

You may fix broken references only if:

1. The correct new target is clear.
2. The change is only a link/path reference update.
3. The change does not alter source behavior.
4. The target file exists.
5. The fix is low-risk.
6. The fix is consistent with the approved migration report.

Do not guess.

If uncertain, do not fix automatically. Add the item to the validation report under `[NEEDS REVIEW]`.

Do not move files in this prompt unless it is required to correct an obvious failed move from the approved plan.

Do not refactor code.

Do not change runtime behavior.

---

## 8. What Not To Touch

Do not modify:

* application business logic
* source-code architecture
* domain boundaries
* database schema
* migrations
* package ownership
* framework conventions
* tests unrelated to moved file references
* lockfiles
* generated files
* PRD content
* audit report content except for broken path references
* archived content except for archive index/reference fixes

---

## 9. PRD Index Validation

Validate:

`docs/product/prd/PRD_INDEX.md`

Check that:

* every listed PRD file exists
* active PRDs point to `docs/product/prd/active/` or another approved canonical path
* historical PRDs point to `docs/product/prd/historical/` or another approved archive/historical path
* supporting requirement files point to existing files
* files marked `[NEEDS REVIEW]` are not incorrectly treated as canonical
* engineering specs are not incorrectly listed as canonical PRDs unless explicitly approved

---

## 10. Archive Index Validation

Validate:

`docs/archive/ARCHIVE_INDEX.md`

Check that:

* every archived file exists
* original path is recorded
* archive reason is recorded
* replacement/canonical file is listed when applicable
* archived files are not still referenced as active docs unless intentionally historical
* no active PRD was accidentally archived

---

## 11. AHA Project Structure Validation

Validate:

`docs/aha/project-structure/`

Check that the folder contains the expected structure:

```text
docs/aha/project-structure/
├── prompts/
├── outputs/
├── migration-plans/
├── reports/
└── README.md
```

Check that these prompt files exist:

```text
docs/aha/project-structure/prompts/01-docs-inventory-and-prd-organization.md
docs/aha/project-structure/prompts/02-project-structure-and-root-hygiene-audit.md
docs/aha/project-structure/prompts/03-approved-docs-and-root-cleanup-execution.md
docs/aha/project-structure/prompts/04-link-reference-validation.md
```

Check that the README links only to files that exist.

Do not require output/report files that were not generated because a prior prompt was intentionally skipped or stopped.

---

## 12. Required Validation Report

Create:

`docs/aha/project-structure/reports/LINK_REFERENCE_VALIDATION_REPORT.md`

Use this format:

```md
# Link and Reference Validation Report

## Summary

- Markdown files checked:
- Root files checked:
- Config files checked:
- Scripts checked:
- CI files checked:
- Broken links found:
- Broken links fixed:
- Stale references found:
- Stale references fixed:
- Items needing review:

## Validation Method

Describe:
- commands used
- tools used
- limitations
- whether external links were checked

## Missing Expected Files

| Expected File | Required? | Status | Notes |
|---|---|---|---|

## Broken Links

| File | Broken Reference | Issue | Suggested Fix | Status |
|---|---|---|---|---|

## Stale References to Old Paths

| File | Old Reference | New Reference | Status |
|---|---|---|---|

## PRD Index Validation

| PRD Index Entry | Target Exists? | Issue | Status |
|---|---|---|---|

## Archive Index Validation

| Archive Entry | Target Exists? | Original Path Recorded? | Status |
|---|---|---|---|

## AHA Project Structure Validation

| File / Folder | Expected? | Exists? | Issue | Status |
|---|---|---|---|---|

## Root Reference Validation

| File | Reference | Issue | Status |
|---|---|---|---|

## Prompt / AHA Reference Validation

| File | Reference | Issue | Status |
|---|---|---|---|

## Script / Config / CI Reference Validation

| File | Reference | Issue | Status |
|---|---|---|---|

## Fixed References

| File | Change |
|---|---|

## Needs Review

| File | Reference | Reason |
|---|---|---|

## Final Assessment

State whether repository documentation and root references are now:

- Safe
- Mostly safe
- Risky
- Blocked

Explain why.
```

---

## 13. Final Response Required

At the end, summarize:

1. Validation result
2. Number of broken references found
3. Number of broken references fixed
4. Number of stale references found
5. Number of stale references fixed
6. Remaining risks
7. Whether any manual review is needed
8. Recommended next action

Do not overbuild.

Do not rewrite documentation content except for path/link fixes.

Do not perform architectural changes.

Do not modify application code except for clearly safe path-reference corrections caused by the approved cleanup.

