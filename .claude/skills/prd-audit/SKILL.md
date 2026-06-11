---
name: prd-audit
description: "Audit PRD against 18-category checklist with P0-P3 severity, ambiguity gate, health score, and downstream impact routing. Produces audit report + companion artifacts."
argument-hint: "[path/to/prd.md] [--fix] [--strict]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Systematically audit any PRD (Morgoth plan.md or standalone) against an 18-category checklist. Produces companion artifacts that downstream skills consume.

**What it does:**
1. Locate and read the PRD
2. Run all 18 checklist categories against the PRD content
3. Score the Ambiguity Gate (8 blocking questions that cause the most AI execution failures)
4. Score Context Window Readiness and Scaffold Readiness
5. Generate companion artifacts: DOMAIN_GLOSSARY.md, ROLE_PERMISSION_MATRIX.md, MODULE_MAP.md
6. Produce a structured PRD_AUDIT_REPORT.md

**Flags:**
- `--fix` — suggest specific amendments to the PRD for each failed item
- `--strict` — treat Ambiguity Gate failures as blocking (exit with error)

**Output:**
- `docs/product/PRD_AUDIT_REPORT.md`
- `docs/product/DOMAIN_GLOSSARY.md`
- `docs/product/ROLE_PERMISSION_MATRIX.md`
- `docs/product/MODULE_MAP.md`
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/prd-audit.md
</execution_context>

<context>
Arguments: $ARGUMENTS

Parse $ARGUMENTS:
- First non-flag token = path to PRD file
- If no path given: auto-detect by searching for `docs/plans/*/plan.md` (Morgoth) or the canonical PRD `docs/prd/v3-dentalemon.md`
- `--fix`: enable fix suggestions mode
- `--strict`: treat Ambiguity Gate failures as blocking

PRD format auto-detection:
- Morgoth plan.md: has numbered sections (1-17), `## Functional Requirements`, epics structure
- Standalone PRD: has sections matching MASTER_PRD template (Product Overview, Scope, Goals, etc.)
- Unknown format: audit what exists, note missing sections
</context>

<process>
Execute the prd-audit workflow from the execution_context file end-to-end.
Preserve all checklist gates and produce all required output artifacts.
</process>

<success_criteria>
- PRD located and fully read
- All 18 checklist categories evaluated with pass/fail per item
- Each failure assigned P0-P3 severity with downstream impact note
- Ambiguity Gate scored (all 8 items answered or flagged)
- PRD health score computed (0-10 across 5 dimensions: clarity, completeness, testability, AI-readiness, context-window-readiness)
- Executive summary with top 3 risks and P0/P1/P2/P3 counts
- PRD_AUDIT_REPORT.md created with full report structure
- DOMAIN_GLOSSARY.md created (or updated if exists)
- ROLE_PERMISSION_MATRIX.md created (or updated if exists)
- MODULE_MAP.md created (or updated if exists)
- Companion artifacts cross-validated for internal consistency (PRD text wins conflicts)
- "What's next" routing: clear guidance on whether to proceed, fix, or re-run
- If --fix: each failed item has a concrete suggested amendment
- If --strict: workflow exits with error if Ambiguity Gate has any failures
</success_criteria>
