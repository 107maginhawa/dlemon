---
name: audit-codebase
description: "Reverse-engineer specs from existing code, compare against target standards, produce adoption roadmap with stabilization plan and first 3 slices. The archaeologist."
argument-hint: "[--src <path>] [--depth shallow|deep] [--generate-specs] [--auto]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Analyze an existing codebase that was NOT built with this workflow. Reverse-engineer what the specs SHOULD be, compare against target AI development standards, and produce an adoption roadmap.

**No specs required.** This skill creates them from code.

**This is both a reverse-engineering audit and an adoption roadmap.**

**What it does:**
1. **Discover modules** — identify logical modules from directory structure, routes, models
2. **Extract domain terms** — find entity names, status values, role names from models/schema/types
3. **Map permissions** — find auth middleware, role checks, guards, and build a permission matrix
4. **Extract business rules** — find validation logic, classify by type (explicit/technical/UI-only/inferred/uncertain)
5. **Map API surface** — find all endpoints, their inputs/outputs/errors
6. **Trace state machines** — find status fields, transition logic
7. **Audit UI/screens** — identify screens, components, mock data, prototype contamination
8. **Audit test coverage** — map coverage of rules, permissions, APIs, state transitions, UI components, interaction states, accessibility
9. **Identify inconsistencies** — where the code contradicts itself
10. **Audit repo guardrails** — check ARCHITECTURE.md, CONTRIBUTING.md, CLAUDE.md existence and accuracy
11. **Audit spec coverage** — check if PRD/module specs/slice specs exist and match code
12. **Compare against standards** — standards gap matrix with priority levels (P0-P3)
13. **Stabilization plan** — what to fix immediately vs before new work vs when touching module
14. **Adoption plan** — 5-phase roadmap (guardrails → document → stabilize → adopt → migrate)
15. **First 3 slices** — recommend first vertical slices to bring under the new standard
16. **Generate specs** — optionally write full spec artifacts for the project

**Flags:**
- `--src <path>` — source code directory (default: auto-detect `src/`, `app/`, `lib/`)
- `--depth shallow|deep` — shallow = structure + routes only; deep = reads logic and extracts rules (default: deep)
- `--generate-specs` — write full spec artifacts (module specs, glossary, role matrix, module map)
- `--auto` — skip confirmation prompts

**Output:**
- `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` — always (21-section report)
- If `--generate-specs`: full spec artifacts in `docs/product/`
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/audit-codebase.md
</execution_context>

<context>
Arguments: $ARGUMENTS

Parse $ARGUMENTS:
- `--src <path>`: override source directory
- `--depth shallow|deep`: analysis depth
- `--generate-specs`: write spec artifacts after analysis
- `--auto`: non-interactive mode

Source detection priority:
1. `--src` flag value
2. `src/` directory
3. `app/` directory
4. `lib/` directory
5. Project root (if small enough)

Existing specs check:
- If `docs/product/modules/` already has MODULE_SPEC files, warn:
  "Specs already exist. Did you mean `/audit-compliance` instead?"
- If user confirms, proceed (useful for re-baselining specs from code)
</context>

<process>
Execute the audit-codebase workflow from the execution_context file end-to-end.
Process one discovered module at a time to manage context window.
</process>

<success_criteria>
- Source code directory located and scanned
- Logical modules identified from project structure
- Domain terms extracted from models/schema/types
- Permission patterns identified and mapped to roles
- Business rules extracted and classified by type (explicit/technical/UI-only/inferred/uncertain)
- API endpoints catalogued with inputs/outputs/errors
- State machines traced from status fields
- UI screens audited, mock data contamination flagged
- Test coverage mapped against extracted artifacts
- Internal inconsistencies flagged with evidence and severity
- Repository guardrails audited (ARCHITECTURE.md, CONTRIBUTING.md, CLAUDE.md)
- Existing spec coverage audited
- Standards gap matrix produced with P0-P3 priorities
- Stabilization plan created (fix now / fix before new work / fix when touching)
- Standards adoption plan created (5-phase roadmap)
- First 3 vertical slices recommended with rationale
- EXISTING_CODEBASE_ADOPTION_AUDIT.md generated (21-section report)
- Health score computed across 10 dimensions
- If --generate-specs: all spec artifacts written with [CURRENT BEHAVIOR], [INFERRED], [VERIFY] tags
- "What's next" routing: suggest `/audit-compliance` for ongoing checks or `/vertical-slice-plan` for implementation sequencing
- For monorepos: use `--src` to target one app at a time
- For large codebases (200+ source files): start with `--depth shallow`, then deep-audit high-priority modules
</success_criteria>
