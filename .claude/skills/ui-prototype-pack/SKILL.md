---
name: ui-prototype-pack
description: "Generate per-module UI prototype packs: screen layouts, component contracts, 9 interaction states, mock data. Complements gsd-ui-phase design tokens."
argument-hint: "<module-name> [--all] [--code-prototype]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Generate per-module UI prototype packs that define screen layouts, component contracts, interaction states (9 states), and mock data. This is design direction — not production code, not product truth.

**What it does:**
1. Load module spec for target module
2. Load UI-SPEC.md (design tokens from /gsd-ui-phase) if exists
3. Load DESIGN.md (from /design-consultation) if exists
4. For each screen in the module spec: define layout, components, states, mock data
5. Run alignment check against module spec

**Authority hierarchy (never override upward):**
```
1. Master PRD / Module Spec / Slice Spec
2. ARCHITECTURE.md
3. Existing code patterns
4. UI-SPEC.md (design tokens)
5. UI Prototype Pack (this output)
```

**Flags:**
- `--all` — generate packs for all modules
- `--code-prototype` — also generate throwaway HTML/CSS prototypes

**Output per module:**
```
docs/product/modules/{name}/ui-prototype/
  screens.md
  components.md
  interaction-states.md
  mock-data.md
```
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/ui-prototype-pack.md
</execution_context>

<context>
Arguments: $ARGUMENTS

Parse $ARGUMENTS:
- First non-flag token = module name (slug format, e.g., "patient-management")
- `--all`: generate for every module in MODULE_MAP.md
- `--code-prototype`: generate throwaway HTML/CSS prototypes under `docs/product/modules/{name}/code-prototypes/`

Required inputs:
- Module spec: `docs/product/modules/{name}/MODULE_SPEC.md`
- PRD: `docs/product/MASTER_PRD.md` (reference only)
- Domain glossary: `docs/product/DOMAIN_GLOSSARY.md`
- Role permission matrix: `docs/product/ROLE_PERMISSION_MATRIX.md`

Optional inputs (consult if exist):
- UI-SPEC.md (from /gsd-ui-phase) — design tokens, typography, color
- DESIGN.md (from /design-consultation) — design system decisions
- ARCHITECTURE.md — existing UI component patterns
</context>

<process>
Execute the ui-prototype-pack workflow from the execution_context file end-to-end.
Process one module at a time to manage context window.
</process>

<success_criteria>
- Design folder exists at `docs/product/modules/{name}/ui-prototype/`
- screens.md defines all major screens with fields, actions, states, and permissions
- components.md defines reusable UI components with props, events, and states
- interaction-states.md defines all 9 states with per-screen completeness scoring
- mock-data.md provides demonstration data clearly marked as non-authoritative
- All screen names align with module spec workflows
- All field names align with domain glossary
- All roles align with role permission matrix
- Prototype does not invent unapproved business rules
- Mock data isolation verified: no production code imports from prototype directories
- Prototype fields not treated as schema truth, mock API shapes not treated as contracts
- If DESIGN.md or UI-SPEC.md exists: prototype respects design tokens
- "What's next" routing: suggest next module or vertical-slice-plan
</success_criteria>
