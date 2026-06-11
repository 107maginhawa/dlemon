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

## Outputs, Migration Plans, Reports

Generated fresh against **this** repository by running the prompts above:

- `outputs/` — prompt 01 + 02 inventories (created when the prompts run)
- `migration-plans/` — prompt 01 + 02 migration plans
- `reports/` — prompt 03 execution log + prompt 04 validation report

## Examples

[`examples/`](./examples/README.md) holds sample artifacts **imported from a
different repository** together with the prompt pack. They show the expected
output format only — they are **not** approved plans for this repo and must
never be used as prompt 03 input.
