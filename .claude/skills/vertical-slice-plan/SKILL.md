---
name: vertical-slice-plan
description: "Create cross-module vertical slice plan with dependency graph, parallel groups, and per-slice scope breakdown. Output feeds into GSD ROADMAP.md as phases."
argument-hint: "[--from-modules path/to/modules/] [--max-slices N] [--auto] [--to-gsd]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Create a vertical slice implementation plan that sequences work across modules. Defines slice boundaries, dependency graphs, parallel execution groups, and per-slice scope.

**What it does:**
1. Load all module specs (headers first for overview, full content per-module as needed)
2. Identify all sliceable units — each touches backend + frontend + tests + data for ONE user-visible behavior
3. Apply slicing principles: auth first, CRUD before cross-module, pattern-establishing before pattern-following
4. Build dependency graph and identify parallel execution groups
5. Define per-slice scope: backend, frontend, test, data/schema, permission/audit
6. Run VERTICAL_SLICE_CHECKLIST against each slice
7. Optionally bridge output into GSD ROADMAP.md as phases

**Flags:**
- `--from-modules path/` — custom module specs directory
- `--max-slices N` — cap total slices (default: no cap)
- `--auto` — skip confirmation prompts
- `--to-gsd` — write slices as phases into `.planning/ROADMAP.md`

**Output:** `docs/execution/VERTICAL_SLICE_PLAN.md`
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/vertical-slice-plan.md
</execution_context>

<context>
Arguments: $ARGUMENTS

Parse $ARGUMENTS:
- `--from-modules path/`: override default module specs directory
- `--max-slices N`: cap number of slices
- `--auto`: non-interactive mode
- `--to-gsd`: after generating plan, write slices as GSD phases

Default module specs directory: `docs/product/modules/`

Required inputs:
- All MODULE_SPEC.md files from modules directory
- MODULE_MAP.md: `docs/product/MODULE_MAP.md`

Optional inputs:
- UI prototype packs: `docs/product/modules/{name}/ui-prototype/`
- MASTER_PRD.md (reference for cross-module workflows)
- ARCHITECTURE.md (technical constraints)
</context>

<process>
Execute the vertical-slice-plan workflow from the execution_context file end-to-end.
Preserve all slicing principles and checklist validation.
</process>

<success_criteria>
- VERTICAL_SLICE_PLAN.md exists at `docs/execution/VERTICAL_SLICE_PLAN.md`
- All workflows from all module specs are represented as slices
- Slices are in correct dependency order
- Each slice has risk level (P0-P3), type (new/stabilize/refactor), and complexity (small/medium/large)
- First slice is safest/simplest (no or minimal dependencies)
- Foundational and pattern-establishing slices explicitly marked
- Parallel execution groups identified with coordination rules
- Per-slice scope defined (backend, frontend, test, data, permission)
- VERTICAL_SLICE_CHECKLIST passes for each slice
- PRD gaps or ambiguities documented
- "What's next" routing based on project type and risk profile
- If --to-gsd: slices written as phases in .planning/ROADMAP.md using exact GSD phase format
</success_criteria>
