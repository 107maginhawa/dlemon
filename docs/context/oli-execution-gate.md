---
skill: oli-execution-gate
archetype: Gate
safety: "Reads specs and produces TDD_PROOF.md with gate decision. Does not modify spec artifacts. Modifies only test files and implementation code as part of TDD cycle."
prerequisites:
  required:
    - path: docs/execution/slices/{slice-name}/SLICE_SPEC.md
      if_missing: "BLOCK — no slice spec found. Cannot enforce TDD without spec items."
    - path: .planning/phases/{NN-slug}/CONTEXT.md
      if_missing: "BLOCK — no phase context. Cannot verify file manifest."
  optional:
    - path: docs/product/modules/{name}/MODULE_SPEC.md
    - path: docs/product/modules/{name}/API_CONTRACTS.md
    - path: docs/product/DOMAIN_MODEL.md
    - path: docs/product/DOMAIN_GLOSSARY.md
    - path: docs/product/modules/{name}/ui-prototype/UI_BLUEPRINT.md
output:
  artifacts:
    - path: docs/execution/slices/{slice-name}/TDD_PROOF.md
  downstream_consumers:
    - oli-confidence-stack
    - oli-audit-compliance
  versioning: true
stop_conditions:
  - condition: "SLICE_SPEC.md missing"
    action: "BLOCK — cannot execute without spec items to cover."
  - condition: "CONTEXT.md missing"
    action: "BLOCK — cannot verify file manifest."
  - condition: "P0/P1 spec compliance violations found"
    action: "BLOCK slice completion until resolved."
  - condition: "P1 split-runtime violation in @dual-runtime handler"
    action: "BLOCK slice completion. Blocked API usage in handler that must run in both runtimes."
  - condition: "Spec is wrong during execution"
    action: "TERMINATE — create SPEC_AMENDMENT.md, mark slice BLOCKED."
quality_gate:
  metric: "spec item coverage + compliance check"
  threshold: "all AC-NNN and BR-NNN items have at least one test"
  block_on: "any spec item with zero tests OR any P0/P1 compliance violation"
cwm: required
severity_output: P0-P3
---

# Execution Gate Workflow

## Overview

Reads specs and produces TDD_PROOF.md with gate decision. Does not modify spec artifacts. Modifies only test files and implementation code as part of TDD cycle.

Execution quality gate injected into executor agents at runtime. Enforces TDD with proof artifacts, context verification, coverage tracking, spec compliance checks (UI, environment safety), and drift detection. Do not invoke directly — loaded by executor agents when `agent_skills: [oli-execution-gate]` appears in config.

## Injection Points

This workflow activates when `agent_skills: [oli-execution-gate]` appears in:
- SLICE_SPEC.md frontmatter
- PLAN.md agent configuration
- `.planning/config.json` (set by `/oli-init`)

## Phase 0: Context Verification

### 0a. Config Self-Check

Verify TDD enforcement config exists. If this skill loaded but config is missing/incomplete, the injection was ad-hoc and downstream audit (oli-confidence-stack) won't know to verify proof artifacts.

**Check `.planning/config.json`:**
- `workflow.tdd_mode` is `"strict"` or `true` — if missing: WARN and log to TDD_PROOF.md: "WARNING: tdd_mode not set in config.json. Run `/oli-init` to configure. Proceeding with TDD enforcement but downstream audit may not trigger."
- `agent_skills.gsd-executor` includes `"oli-execution-gate"` — if missing: same WARN.

**This is a WARN, not a BLOCK.** The skill is already loaded (we're running), so TDD proceeds regardless. The warning ensures the human knows downstream verification may be incomplete.

### 0b. Spec Verification

Before writing ANY code, verify required specs are loaded.

**BLOCK if missing:**
- `SLICE_SPEC.md` -- primary spec (check `docs/execution/slices/{slice-name}/`)
- `CONTEXT.md` -- phase context with file manifest (check `.planning/phases/{NN-slug}/`)

**WARN if missing (continue with reduced coverage):**
- `MODULE_SPEC.md` -- module spec (check `docs/product/modules/{module-slug}/`)

**Load if available:**
- `API_CONTRACTS.md` -- API surfaces (headers + touched endpoints only)
- `DOMAIN_MODEL.md` -- entity definitions (referenced entities only)
- `DOMAIN_GLOSSARY.md` -- canonical terminology (entity names + status values only, for Step 5c)
- `UI_BLUEPRINT.md` -- component contracts + form-contracts + accessibility baseline (from `docs/product/modules/{module-slug}/ui-prototype/`). Max 150 lines.

### Context Budget

| Document | Load Strategy | Reason |
|----------|--------------|--------|
| SLICE_SPEC.md | FULL | Primary spec, every section matters |
| CONTEXT.md | FULL | File manifest, verification commands |
| MODULE_SPEC.md | Sections 5 + 11 only | Business rules + acceptance criteria |
| API_CONTRACTS.md | Touched endpoints only | Interfaces this slice implements |
| DOMAIN_MODEL.md | Referenced entities only | Shapes this slice creates/modifies |
| DOMAIN_GLOSSARY.md | Entity Names + Status Values tables only | Terminology index for Step 5c (>50 terms: entity names only) |
| UI_BLUEPRINT.md | Component contracts + form-contracts for this slice's components only. Max 150 lines. | Contracts this slice's frontend files must satisfy |

## Phase 1: Spec Loading

Extract testable items from SLICE_SPEC.md into coverage checklist:
- All `AC-NNN` (Acceptance Criteria) with descriptions
- All `BR-NNN` (Business Rules) with IF/THEN conditions
- All `TEST-NNN` items if present

Output to TDD_PROOF.md:
```
## Spec Items
| ID | Description | Test File | RED Output | Status |
|----|-------------|-----------|------------|--------|
| AC-001 | [from spec] | -- | -- | PENDING |
| BR-001 | [from spec] | -- | -- | PENDING |
```

## Phase 1b: Split-Runtime Safety (Conditional)

**Skip if:** ARCHITECTURE.md does not declare split-runtime constraints or blocked APIs.

**Triggers when:** ARCHITECTURE.md contains keywords: `split-runtime`, `dual-runtime`, `blocked-api`, `QuickJS`, `embedded`, `@dual-runtime`, `@cloud-only`.

### Detection
1. Search ARCHITECTURE.md for runtime constraint declarations
2. If not found: skip entirely, log "Phase 1b: skipped — no split-runtime constraints declared"
3. If found: extract blocked API list and handler paths from ARCHITECTURE.md

### Audit
4. Grep handler files (created/modified by this slice) for blocked API usage:
   - Imports: `import fs`, `import { readFileSync }`, `require('fs')`, `require('net')`
   - Usage: `fs.readFileSync`, `Buffer.from`, `Buffer.allocUnsafe`, `child_process.exec`
   - Process: `process.cwd()`, `process.argv` (NOT `process.env` — typically allowed)
5. Check handler annotations: `@cloud-only` = blocked APIs OK (shimmed). `@dual-runtime` or no annotation = blocked APIs are violations.

### Severity
| Finding | Severity |
|---------|----------|
| Blocked API in `@dual-runtime` handler | P1 — BLOCKS |
| Blocked API in `@cloud-only` handler | OK |
| Missing annotation on handler with blocked API | P2 — WARN |

### Escape Hatch
`gate_force_allowed_in_branches` in `.planning/config.json`: on matching branches (e.g., `spike/*`), P1 split-runtime violations downgrade to P2 warnings.

### Output
```
## Environment Coverage
- Split-runtime declared: yes/no
- Blocked APIs found: [list or "none"]
- Handler annotations: [list]
- Violations: [list or "none"]
```

---

## Phase 2: RED-GREEN-REFACTOR Cycle

For each spec item:

### 0. PREFLIGHT
- Run full test suite, record baseline pass/fail counts
- Note pre-existing failures (don't confuse with new RED tests)

### 1. RED -- Write Failing Test
- ONE test for ONE spec item
- Label with spec ID (`// AC-001`, `describe("BR-003: ...")`)
- Run test -- must FAIL
- Confirm failure is for the RIGHT reason (not syntax/import error)
- Capture RED output in TDD_PROOF.md
- **Commit failing test before writing implementation**

### 2. GREEN -- Minimal Implementation
- Minimum code to pass the failing test
- Run test -- must PASS
- No extra logic, no "while I'm here" additions
- Update TDD_PROOF.md: record test file + line, mark COVERED

### 3. REFACTOR -- Clean Up
- Tests passing = safe to refactor
- Run full suite after refactoring -- must still pass
- No behavior changes

### 4. REGRESSION -- Verify No Breakage
- Run full test suite
- Compare against PREFLIGHT baseline -- no new failures
- Fix regressions before proceeding

### Commit Convention
- **RED:** `test(scope): add failing test for AC-NNN`
- **GREEN:** `feat(scope): implement AC-NNN [description]`
- **REFACTOR:** `refactor(scope): [description]`

## Phase 3: Coverage Verification

1. Cross-reference tests against Phase 1 checklist
2. Report in TDD_PROOF.md: covered items (with test file:line), uncovered items (with reason)
3. Verify test labels reference real spec items
4. Any spec item with zero tests = UNCOVERED (don't mark slice complete)

## Phase 5: Spec Compliance Checks

Verify code created/modified by this slice against loaded spec artifacts. **Scope: only files in CONTEXT.md file manifest.** P0/P1 = BLOCK. P2/P3 = WARN.

### 5a. UI Blueprint Compliance (if slice touches frontend files AND UI_BLUEPRINT.md loaded)

**Auto-detect component library:** Find nearest `package.json` to slice source files. Check for: `@radix-ui/*`, `@chakra-ui/*`, `@mui/material`, `@mantine/*`, `@monobase/ui`, `antd`, `@headlessui/*`, `@nextui-org/*`, shadcn (`components.json`). Monorepo: check workspace + package-level deps. Fallback: scan import patterns. No library found = skip primitive checks, log P3 advisory.

| Check | P0 | P1 | P2 | P3 |
|-------|----|----|----|----|
| Component primitives | — | Raw HTML where library primitive exists | — | Raw HTML in Server Components (may be intentional) |
| ARIA attributes | Interactive element with no accessible name | Missing keyboard handler on custom interactive | — | — |
| Form contracts (if form-contracts.md exists) | — | Required field from contract missing | Validation rule mismatch | — |
| Design tokens | — | Hardcoded color in shared component | Hardcoded color in page-specific component | — |
| Interaction states | — | — | Missing loading/error state on data-fetching component | — |

### 5b. Environment Safety (all slice files)

| Check | P0 | P1 |
|-------|----|----|
| Hardcoded secrets (API key patterns, `password=`, `token=`, `secret=`, base64 >40 chars) | Likely secret in source file | — |
| Env var docs (new `process.env.X` / `os.environ['X']` without `.env.example` entry) | — | Undocumented env var |

### 5c. Terminology Compliance (slice files only)

**Prerequisite:** DOMAIN_GLOSSARY.md must be loaded in Phase 1. If Phase 1 does not currently include DOMAIN_GLOSSARY.md, load it conditionally (skip if not present in `docs/product/`).

If DOMAIN_GLOSSARY.md loaded:

1. Build a lightweight terminology index: canonical entity names + status values only. Skip abbreviations and full glossary detail to limit context budget.
2. For each new/modified identifier (class, type, function, variable names) in slice files:
   - Compare against terminology index using case normalization (strip camelCase/snake_case/kebab-case boundaries, lowercase — do NOT singularize)
   - New code using non-canonical term → **P2** (WARN)
3. If `terminology.enforcement` is `"block"` in `.planning/config.json`:
   - Promote terminology P2 to **P1** (BLOCK)

**Scope limitation:** This check verifies individual identifiers against the canonical term list only. Cross-module consistency (Step 6.2 in `/oli-audit-compliance`) and event/error cross-references (Steps 6.3/6.4) cannot be checked at slice time — they require codebase-wide scanning. These violations are caught at full audit time only.

**Context budget:** If glossary contains >50 terms, degrade to checking entity names only (skip status values) to avoid excessive context consumption during slice execution.

### Output

```
## Spec Compliance Checks
| Check | File:Line | Severity | Status | Detail |
|-------|-----------|----------|--------|--------|
| ... | ... | ... | PASS/FAIL/WARN | ... |

P0/P1 findings: N → BLOCKS slice completion
P2/P3 findings: N → Advisory
```

**Config override:** `{ "compliance": { "block_on_p2": true } }` in `.planning/config.json` promotes P2 to BLOCK.

## Phase 6: Drift Detection

Lightweight check -- full analysis at step 14 via `/oli-audit-compliance`.

**API drift:** Compare implemented signatures against API_CONTRACTS.md (HTTP methods, response codes, fields)

**Domain drift:** Compare implemented entities against DOMAIN_MODEL.md (fields, types, relationships)

**Sync architecture adaptation:** If sync architecture detected (SYNC_ARCHITECTURE.md exists, or ARCHITECTURE.md mentions Cadence/CRDT/local-first/P2P, or sync engine in dependencies), skip traditional EVENT_CONTRACTS pub/sub validation. Check SYNC_ARCHITECTURE.md for collection definitions and conflict resolution instead. Application-level domain events still validated normally.

Output:
```
## Drift Check
- API_CONTRACTS: [no drift | DRIFT -- description]
- DOMAIN_MODEL: [no drift | DRIFT -- description]
- EVENT_CONTRACTS: [validated | adapted for sync architecture | skipped]
```

Drift = WARNING, not BLOCK. Flag for review.

## Phase 7: Upstream Spec Anchor

Log traceability from tests to upstream contracts:

```
## Spec Anchors
| Test | Spec Item | Upstream Source |
|------|-----------|---------------|
| tests/x.test.ts:15 | AC-001 | POST /api/x (API_CONTRACTS Section 3) |
```

## Banned Test Patterns

| Pattern | Why Wrong | Do Instead |
|---------|----------|------------|
| `assert(true)` | Proves nothing | Assert specific expected values |
| Mocking the thing under test | Tests the mock | Mock dependencies, test the subject |
| Tests that pass with ANY input | Tautological | Specific inputs, specific expected outputs |
| `expect(fn).not.toThrow()` only | Only proves no crash | Assert return value or side effects |

## TDD Does NOT Apply To

- Schema-only migrations (DDL, no logic)
- Configuration files (env vars, feature flags)
- Static assets (images, fonts, CSS-only)
- Type definitions only (interfaces, no runtime behavior)
- Documentation
- Pure re-exports (barrel files, zero branching)

Note in TDD_PROOF.md: `TDD skipped for [file]: [reason]`

## Output Artifact

**File:** `docs/execution/slices/{slice-name}/TDD_PROOF.md`

Sections: Context Loaded, Spec Items, Spec Compliance Checks, Drift Check, Spec Anchors, Coverage Summary, Verification Commands.

Downstream consumers: `/oli-confidence-stack`, `/oli-audit-compliance` independently verify this proof at step 14.

## Spec Amendment Protocol

If spec is wrong during execution:
1. Create `SPEC_AMENDMENT.md` in phase directory
2. Mark affected slice as BLOCKED
3. TERMINATE execution (agents are stateless)
4. Human reviews via `/oli-spec-review-gate --amendment`

## Post-Completion

After slice execution completes with all checks passing:

1. **TDD_PROOF.md** committed to `docs/execution/slices/{slice-name}/`
2. Executor proceeds to next slice in the phase
3. After all slices in phase complete, run post-phase audit sequence:
   - `/oli-audit-compliance` — verify spec-vs-code compliance
   - `/oli-confidence-stack` — score test confidence across 4 layers
   - `/oli-trace` — verify intent-to-implementation traceability chain
4. For pipeline orchestration: `/oli` (greenfield) or `/oli-magic --update` (brownfield) manages the full sequence
