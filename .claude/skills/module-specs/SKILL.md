---
name: module-specs
description: "Decompose a PRD into per-module specifications (18 sections each). Each module spec is self-contained for AI consumption. Run after prd-audit."
argument-hint: "[path/to/prd.md] [--modules auth,billing] [--all] [--auto]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Break a PRD into detailed per-module specification documents. Each module spec is a self-contained document with 18 standardized sections that an AI agent can consume independently — no need to load the full PRD during execution.

**What it does:**
1. Load PRD + companion artifacts (glossary, role matrix, module map)
2. Identify modules from MODULE_MAP.md or extract from PRD
3. For each module: generate a full 18-section MODULE_SPEC.md
4. Cross-reference: verify every PRD requirement maps to at least one module spec
5. Produce coverage matrix

**Flags:**
- `--modules auth,billing` — only generate specified modules (comma-separated)
- `--all` — generate all modules without prompting
- `--auto` — skip confirmation prompts, generate with defaults

**Output:** One `MODULE_SPEC.md` per module in `docs/product/modules/{name}/`
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/module-specs.md
</execution_context>

<context>
Arguments: $ARGUMENTS

Parse $ARGUMENTS:
- First non-flag token = path to PRD file
- If no path: auto-detect `docs/product/MASTER_PRD.md` or `docs/plans/*/plan.md`
- `--modules X,Y`: only generate listed modules
- `--all`: generate all modules in MODULE_MAP without asking
- `--auto`: non-interactive mode

Required companion artifacts (check separate files first, then fall back to sections within MASTER_PRD.md):
- DOMAIN_GLOSSARY.md — `docs/product/DOMAIN_GLOSSARY.md` or Domain Glossary section in PRD
- ROLE_PERMISSION_MATRIX.md — `docs/product/ROLE_PERMISSION_MATRIX.md` or Role/Permission section in PRD
- MODULE_MAP.md — `docs/product/MODULE_MAP.md` or Module Map section in PRD

If companion artifacts don't exist in either location, suggest running `/prd-audit` first.
</context>

<process>
Execute the module-specs workflow from the execution_context file end-to-end.
Process one module at a time to manage context window.
</process>

<success_criteria>
- All target modules have a MODULE_SPEC.md in `docs/product/modules/{name}/`
- Each spec has all 18 sections — scored as COMPLETE/PARTIAL/EMPTY
- Uncertain content tagged with `[INFERRED]` or `[VERIFY]`
- Domain terms match DOMAIN_GLOSSARY.md exactly
- Permissions match ROLE_PERMISSION_MATRIX.md exactly
- No PRD requirements are orphaned (coverage matrix validates)
- Cross-module consistency verified: no conflicting rules, no overlapping entities, no terminology drift
- Cross-module dependencies documented and symmetrical
- Each spec includes a recommended vertical slice list
- Downstream impact flagged for EMPTY critical sections (rules, criteria, permissions)
- "What's next" routing: suggest ui-prototype-pack or vertical-slice-plan based on project type
- Module specs under 2,000 words each (warn if over)
</success_criteria>
