# AHA Project Structure Audit

This folder contains the audit prompts, outputs, migration plans, and reports
for documentation organization, PRD aggregation, root hygiene, and
link/reference validation.

## Prompts

| Prompt | Purpose |
|---|---|
| [01 — Docs Inventory and PRD Organization](./prompts/01-docs-inventory-and-prd-organization.md) | Audits `/docs`, identifies PRDs, prepares a docs migration plan |
| [02 — Project Structure and Root Hygiene Audit](./prompts/02-project-structure-and-root-hygiene-audit.md) | Audits root/project structure, prepares a project migration plan |
| [03 — Approved Docs and Root Cleanup Execution](./prompts/03-approved-docs-and-root-cleanup-execution.md) | Executes approved docs and root cleanup plans |
| [04 — Link and Reference Validation](./prompts/04-link-reference-validation.md) | Validates links and references after cleanup |

> Some prompt files may live under a different filename; check `./prompts/`.

## Outputs

- [`outputs/DOCS_INVENTORY.md`](./outputs/DOCS_INVENTORY.md) — prompt 01
- [`outputs/PRD_INDEX_DRAFT.md`](./outputs/PRD_INDEX_DRAFT.md) — prompt 01
- [`outputs/PROJECT_STRUCTURE_INVENTORY.md`](./outputs/PROJECT_STRUCTURE_INVENTORY.md) — prompt 02
- [`outputs/old/`](./outputs/old/) — historical pre-AHA workflow artifacts (2026-06-10 cleanup)

## Migration Plans

- [`migration-plans/DOCS_MIGRATION_PLAN.md`](./migration-plans/DOCS_MIGRATION_PLAN.md) — prompt 01
- [`migration-plans/PROJECT_STRUCTURE_MIGRATION_PLAN.md`](./migration-plans/PROJECT_STRUCTURE_MIGRATION_PLAN.md) — prompt 02
- [`migration-plans/old/`](./migration-plans/old/) — historical pre-AHA migration plans

## Reports

- [`reports/DOCS_AND_ROOT_CLEANUP_REPORT.md`](./reports/DOCS_AND_ROOT_CLEANUP_REPORT.md) — prompt 03 execution log
