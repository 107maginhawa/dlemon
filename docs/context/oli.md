---
skill: oli
archetype: Orchestrator
safety: "Reads project state and routes to next skill. Writes boilerplate flag to .planning/config.json. Does not produce domain artifacts."
prerequisites:
  required: []
  optional:
    - path: .planning/config.json
    - path: ARCHITECTURE.md
    - path: docs/product/MASTER_PRD.md
output:
  artifacts: []
  downstream_consumers: []
  versioning: false
stop_conditions:
  - condition: ".planning/config.json exists but is corrupt (invalid JSON)"
    action: "STOP — config file corrupt. Back up and run `/oli-init` to regenerate."
  - condition: ".planning/ directory missing and not in init flow"
    action: "STOP — run `/oli-init` first to scaffold project structure."
cwm: required
severity_output: none
quality_gate: null
---

# Pipeline Orchestrator Workflow

## Overview

Reads project state and routes to next skill. Writes boilerplate flag to `.planning/config.json`. Does not produce domain artifacts.

Greenfield app orchestrator — reads project state, guides user step by step, and runs skills on confirmation. Default mode is interactive guided execution. Use `--status` for diagnostic-only (legacy behavior).

## Step 0: Project Detection

Before any diagnostics, classify the project:

1. Check for source code directories: `src/`, `app/`, `lib/`, or project root has `.ts`/`.py`/`.go`/`.rs` files
2. Check for PRD: `docs/product/MASTER_PRD.md`
3. Check for specs: `docs/product/modules/*/MODULE_SPEC.md`
4. Check for boilerplate flag: `.planning/config.json` → `"boilerplate": true`
5. Check for existing audits: `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md`
6. Check for brownfield graduation: `.planning/config.json` → `brownfield.execution_state` = `"graduated"`

### Classification Table

| Has Source Code | Has PRD/Specs | Has Boilerplate Flag | Classification | Action |
|:-:|:-:|:-:|---|---|
| No | No | — | Greenfield (fresh) | Proceed to Step 1. In guided mode, suggest `/office-hours` first. |
| No | Yes | — | Greenfield (mid-pipeline) | Proceed to Step 1. Resume from artifact state. |
| Yes | — | Yes | Greenfield (boilerplate) | Proceed to Step 1. Skip brownfield detection. |
| Yes | — | — | **Graduated** (if `brownfield.execution_state = "graduated"` in `.planning/config.json`) | "Project graduated from brownfield pipeline. All stages complete. Run `/oli-magic --status` to view dashboard, or `/oli-magic` to re-assess." STOP. |
| Yes | No | No | **Ambiguous** | AskUserQuestion: "Found existing code. Is this a boilerplate/starter (greenfield) or an existing app (brownfield)?" If greenfield → write `"boilerplate": true` to `.planning/config.json` (create file if needed), proceed. If brownfield → say "Run `/oli-magic` instead." STOP. |
| Yes | Yes | No | Brownfield | "Existing codebase with specs detected. Run `/oli-magic` instead." STOP. |

### Boilerplate Config Write

When user confirms greenfield on ambiguous project, ensure `.planning/config.json` exists and set:
```json
{ "boilerplate": true }
```
Merge into existing config if file already exists. Do not overwrite other keys.

## Step 1: Check Prerequisites

| Check | Path | Status |
|-------|------|--------|
| ARCHITECTURE.md | `./ARCHITECTURE.md` | ✓ exists / ✗ missing |
| PRD | `docs/product/MASTER_PRD.md` OR `docs/plans/*/plan.md` | ✓ / ✗ |

If ARCHITECTURE.md missing → **"Run `/oli-init` first to scaffold project and generate ARCHITECTURE.md template."**
If PRD missing → **"Place PRD at `docs/product/MASTER_PRD.md` or specify path."**
If both missing → show both, stop.

## Step 2: Check Phase A Artifacts

| Artifact | Path | Status | Version |
|----------|------|--------|---------|
| PRD_AUDIT_REPORT.md | `docs/product/PRD_AUDIT_REPORT.md` | ✓ / ✗ | |
| DOMAIN_GLOSSARY.md | `docs/product/DOMAIN_GLOSSARY.md` | ✓ / ✗ | |
| ROLE_PERMISSION_MATRIX.md | `docs/product/ROLE_PERMISSION_MATRIX.md` | ✓ / ✗ | |
| MODULE_MAP.md | `docs/product/MODULE_MAP.md` | ✓ / ✗ | [DRAFT]? |
| WORKFLOW_MAP.md | `docs/product/WORKFLOW_MAP.md` | ✓ / ✗ | |
| DOMAIN_MODEL.md | `docs/product/DOMAIN_MODEL.md` | ✓ / ✗ | Lean/Full? |
| DATA_GOVERNANCE_DRAFT.md | `docs/product/DATA_GOVERNANCE_DRAFT.md` | ✓ / ✗ / N/A | Phase A draft |
| DATA_GOVERNANCE.md | `docs/product/DATA_GOVERNANCE.md` | ✓ / ✗ / N/A | Phase B final (from /oli-domain-model) |
| SYNC_ARCHITECTURE.md | `docs/product/SYNC_ARCHITECTURE.md` | ✓ / ✗ / N/A | Conditional: offline/local-first projects only |

First missing artifact determines next action:
- PRD_AUDIT_REPORT.md missing → **"Run `/oli-prd-audit`"**
- WORKFLOW_MAP.md missing → **"Run `/oli-workflow-map`"**
- DOMAIN_MODEL.md missing → **"Run `/oli-domain-model`"**
- SYNC_ARCHITECTURE.md missing AND PRD_AUDIT_REPORT flags "Offline/local-first: YES" → **"Run `/oli-sync-architecture`"**

### State-Aware Artifact Validation

If artifacts exist, check their internal state:

**PRD_AUDIT_REPORT.md** — parse for blocking conditions:
- Look for "Ambiguity Gate: PASS" or "Ambiguity Gate: BLOCKED"
- Count P0 findings
- If Ambiguity Gate = BLOCKED OR P0 count > 0 → report as **"EXISTS BUT BLOCKED — re-run `/oli-prd-audit`"**

**SPEC_REVIEW.md** — parse sign-off statuses:
- Scan the Sign-off Matrix for PENDING or REJECTED statuses
- If any required sign-off is PENDING or REJECTED → report as **"EXISTS BUT INCOMPLETE — complete sign-offs or re-run `/oli-spec-review-gate`"**

**CONSISTENCY_REPORT.md** — parse for unresolved conflicts:
- Scan for HIGH severity conflicts
- If HIGH conflicts > 0 → report as **"EXISTS BUT HAS UNRESOLVED CONFLICTS — resolve conflicts, then re-run `/oli-spec-consistency`"**

## Step 3: Check Phase B Artifacts

1. Read MODULE_MAP.md to get module list
2. For each module, check:

| Module | MODULE_SPEC | API_CONTRACTS | UI Blueprint | Form Contracts | Microcopy |
|--------|------------|--------------|-------------|---------------|-----------|
| [name] | ✓ / ✗ | ✓ / ✗ | ✓ / ✗ | ✓ / ✗ | ✓ / ✗ |

3. Check shared artifacts:

| Artifact | Path | Status |
|----------|------|--------|
| API_CONVENTIONS.md | `docs/product/API_CONVENTIONS.md` | ✓ / ✗ |
| ERROR_TAXONOMY.md | `docs/product/ERROR_TAXONOMY.md` | ✓ / ✗ |
| EVENT_CONTRACTS.md | `docs/product/EVENT_CONTRACTS.md` | ✓ / ✗ |
| SHARED_COMPONENTS.md | `docs/product/SHARED_COMPONENTS.md` | ✓ / ✗ |
| NAVIGATION_MAP.md | `docs/product/NAVIGATION_MAP.md` | ✓ / ✗ |
| UI_CONVENTIONS.md | `docs/product/UI_CONVENTIONS.md` | ✓ / ✗ |

First missing category determines next action:
- MODULE_SPECs incomplete → **"Run `/oli-module-specs --all`"**
- API_CONTRACTS missing → **"Run `/oli-api-contracts --all`"**
- UI Blueprint missing → **"Run `/oli-ui-blueprint --blueprint --all`"**

## Step 4: Check Phase B Gates

| Gate | Path | Status |
|------|------|--------|
| CONSISTENCY_REPORT.md | `docs/product/CONSISTENCY_REPORT.md` | ✓ / ✗ |
| SPEC_REVIEW.md | `docs/product/SPEC_REVIEW.md` | ✓ / ✗ |

- CONSISTENCY_REPORT missing → **"Run `/oli-spec-consistency`"**
- CONSISTENCY_REPORT has HIGH conflicts → **"Resolve conflicts, then re-run `/oli-spec-consistency`"**
- SPEC_REVIEW missing → **"Run `/oli-spec-review-gate`"**
- SPEC_REVIEW has PENDING sign-offs → **"Complete sign-offs in SPEC_REVIEW.md"**

## Step 5: Check Phase C Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| VERTICAL_SLICE_PLAN.md | `docs/execution/VERTICAL_SLICE_PLAN.md` | ✓ / ✗ |
| Slice specs | `docs/execution/slices/*/SLICE_SPEC.md` | [N] of [total] |
| SLICE_SPEC_GAPS.md | `docs/execution/SLICE_SPEC_GAPS.md` | ✓ / ✗ (gaps?) |

- Plan missing → **"Run `/oli-vertical-slice-plan --with-specs`"**
- Plan exists but no slice specs → **"Run `/oli-vertical-slice-plan --with-specs`"**
- Gaps exist → **"Resolve gaps in SLICE_SPEC_GAPS.md before execution"**
- All ready → **"Execution ready. Ensure `.planning/config.json` has TDD config (`workflow.tdd_mode: true` + `agent_skills.gsd-executor: [\"skills/oli-execution-gate\"]`), then run `/gsd-plan-phase <phase>` and `/gsd-execute-phase <phase>`. No custom executor or symlinks needed."**

## Step 6: Check Staleness

For artifacts with version headers (`Based On: MASTER_PRD.md v[X]`):
1. Compare referenced version against actual file modification date
2. Flag stale artifacts (referenced version older than source file)

```
⚠ STALE: WORKFLOW_MAP.md references MASTER_PRD.md v1.0 but PRD was modified after WORKFLOW_MAP was generated.
  → Re-run `/oli-workflow-map` to pick up PRD changes.
```

## Step 7: Output Dashboard

### Summary View (default)

```
╔══════════════════════════════════════════════════════╗
║                 OLI PIPELINE STATUS                  ║
╠══════════════════════════════════════════════════════╣
║ Prerequisites     [✓] ARCHITECTURE.md  [✓] PRD      ║
║ Phase A           [✓] Audit  [✓] Workflows  [✓] DDD ║
║ Phase B           [✓] Specs  [✓] API  [◐] UI (3/5)  ║
║ Phase B Gates     [✓] Consistency  [✗] Review        ║
║ Phase C           [✗] Slice Plan  [—] Slice Specs    ║
║ Staleness         [!] 1 stale artifact               ║
╠══════════════════════════════════════════════════════╣
║ NEXT → Run `/oli-spec-review-gate`                   ║
╚══════════════════════════════════════════════════════╝
```

### Detailed View (--full)

Show per-module breakdown for Phase B artifacts.

### JSON View (--json)

```json
{
  "prerequisites": { "architecture": true, "prd": true },
  "phaseA": { "audit": true, "workflows": true, "domain": true },
  "phaseB": { "specs": { "total": 5, "complete": 5 }, "api": { "total": 5, "complete": 5 }, "ui": { "total": 5, "complete": 3 } },
  "gates": { "consistency": true, "review": false },
  "phaseC": { "plan": false, "sliceSpecs": { "total": 0, "complete": 0 } },
  "stale": ["WORKFLOW_MAP.md"],
  "nextAction": "/oli-spec-review-gate"
}
```

## Step 8: Check Phase E Artifacts (Audits)

| Artifact | Path | Status | Stale? |
|----------|------|--------|--------|
| EXISTING_CODEBASE_ADOPTION_AUDIT.md | `docs/audits/` | ✓ / ✗ / N/A | |
| COMPLIANCE_REPORT.md | `docs/audits/` | ✓ / ✗ | |
| CONFIDENCE_REPORT.md | `docs/audits/` | ✓ / ✗ | |

### When to Run Audits

| Audit Skill | Run When | Re-run When |
|---|---|---|
| `/oli-audit-codebase` | Onboarding existing project without specs | After major refactor or new module added |
| `/oli-audit-compliance` | After each slice completion | After spec amendments, before release |
| `/oli-confidence-stack` | After test additions | Before release, after major test refactor |

### Audit Staleness Rules

- COMPLIANCE_REPORT older than most recent code commit in `src/` → stale
- CONFIDENCE_REPORT older than most recent test file change → stale
- Flag stale audits in dashboard

## Step 9: Backward Feedback Loop (Audit → Spec Amendment)

When audits find spec gaps or codebase behaviors not in specs, route findings back:

### Feedback Routing

| Finding Type | Source | Route To | Action |
|---|---|---|---|
| Spec gap (empty BR/AC section) | `oli-audit-compliance` | `oli-module-specs --modules <name>` | Fill missing spec sections |
| Current behavior not in spec | `oli-audit-codebase` [CURRENT BEHAVIOR] | `oli-module-specs --modules <name>` | Add behavior to spec (user confirms: intended or bug?) |
| Untraced behavior (no test owner) | `oli-confidence-stack` Layer 2 | `oli-module-specs` §12 | Add test mapping |
| Spec-code contradiction | `oli-audit-compliance` CONTRADICTED | User decision required | Spec wrong or code wrong? |

### Amendment Protocol

1. Read audit report findings
2. For each finding that requires spec change:
   a. Identify target spec file
   b. Propose targeted patch (add/modify specific section only, NOT regenerate entire spec)
   c. Tag amendment: `[AMENDED: from COMPLIANCE_REPORT YYYY-MM-DD, V-{MODULE}-{NNN}]`
3. After all patches: run `oli-spec-consistency --quick` (validate only amended items, not full re-check)
4. If consistency passes: amendments committed
5. If consistency fails: flag conflict, route to human

### Spec Amendment Cascade

When an upstream artifact changes, downstream artifacts may be stale:

```
MASTER_PRD.md changed
  → invalidates: PRD_AUDIT_REPORT, MODULE_MAP, DOMAIN_GLOSSARY, ROLE_PERMISSION_MATRIX,
                  THREAT_MODEL, DATA_GOVERNANCE_DRAFT, PERFORMANCE
    → invalidates: MODULE_SPECs, WORKFLOW_MAP, DOMAIN_MODEL
      → DOMAIN_MODEL invalidates: DATA_GOVERNANCE
      → invalidates: API_CONTRACTS, UI_BLUEPRINT, EVENT_CONTRACTS, SYNC_ARCHITECTURE
        → invalidates: CONSISTENCY_REPORT, SPEC_REVIEW
          → invalidates: VERTICAL_SLICE_PLAN, SLICE_SPECs
```

The pipeline tracks this DAG. When Step 6 detects staleness:
- Show cascade: "DOMAIN_MODEL changed → MODULE_SPECs for [auth, billing] may be stale → API_CONTRACTS may be stale"
- Recommend re-run order (upstream first)
- Do NOT auto-rerun — user confirms which artifacts to refresh

## Step 10: Forward Feedback Protocol (Execution-Time)

When an AI agent hits ambiguity DURING code execution (not post-audit):

### Escalation Flow

```
AI agent coding slice → hits ambiguity
  → writes ESCALATIONS.md in slice directory
  → pauses implementation at ambiguous point
  → routes to resolution:
    - Spec ambiguity → amend MODULE_SPEC specific section
    - Missing info → update SLICE_SPEC scope
    - Conflict → re-run oli-spec-consistency on affected items
    - Scope creep → expand slice in VERTICAL_SLICE_PLAN
  → after resolution: regenerate any GSD bridge artifacts derived from the slice (`ROADMAP.md`, `REQUIREMENTS.md`, phase `CONTEXT.md`) and resume from the updated slice contract
```

### Escalation Severity

| Type | Auto-Resolvable? | Action |
|---|---|---|
| Minor ambiguity (naming, style) | Yes — use simpler interpretation | Log choice, continue |
| Missing default value | Yes — use zero/empty/null | Log choice, continue |
| Business logic ambiguity | No — multiple valid behaviors | STOP, flag for human |
| Security-relevant ambiguity | No — wrong choice = vulnerability | STOP, flag for human |
| Scope expansion needed | No — changes slice contract | STOP, flag for human |

### Tracking

All escalations tracked in `docs/execution/ESCALATION_LOG.md`:

| Slice | Type | Description | Resolution | Resolved By | Date |
|---|---|---|---|---|---|

### Recovery Authority

For slice execution, Oli is the recovery authority:

- `ESCALATIONS.md` + spec amendments are the source of truth for blockers
- Do NOT route slice blockers into GSD `VERIFICATION.md`, `/gsd-plan-phase --gaps`, or resume-from-incomplete-plan flows
- Use GSD again only after the slice contract has been amended and the phase-scoped bridge artifacts have been regenerated

## Step 11: Human Escalation Policy

### Risk-Based --auto Rules

All skills with `--auto` flag MUST respect this policy:

| Severity | --auto Behavior | Rationale |
|---|---|---|
| P0 (Critical) | STOP — require human decision | Security, data integrity, broken business logic |
| P1 (Major) | STOP — require human decision | Functional gaps, missing enforcement |
| P2 (Minor) | PROCEED — use deterministic default | Consistency issues, low-impact drift |
| P3 (Info) | PROCEED — log only | Observations, no risk |

When `--auto` encounters a P0/P1 item: emit warning to stdout, write to `docs/audits/ESCALATION_LOG.md`, and halt at that item. Resume with `--resume-from <item-id>` after human resolution.

### Artifact Garbage Collection

When MODULE_MAP.md changes (module added/removed/renamed):
1. Scan `docs/product/modules/` for directories not in MODULE_MAP
2. Scan `docs/execution/slices/` for slices referencing removed modules
3. Report orphaned artifacts — do NOT auto-delete
4. User confirms cleanup

## Context Window Management

- Diagnostic steps: only check file existence and scan headers
- Do not load full file content — just check presence and read first 10 lines for version headers
- Diagnostic phase should complete in under 30 seconds

## Step 12: Guided Execution (default mode only)

**Skip this step if `--status`, `--full`, or `--json` flags are set.** Those modes are diagnostic-only.

After outputting the dashboard (Step 7), enter the guided execution loop:

### Loop

1. **Identify next action** from diagnostic results (`nextAction` from Step 7 dashboard)

2. **Present context** for the next step:
   - What it does (1 sentence)
   - What it reads (upstream artifacts it depends on)
   - What it produces (output artifacts)
   - Estimated scope (e.g., "3 modules × 22 sections each", "1 PRD audit pass")
   - Any conditions (e.g., "conditional — only needed for multi-module projects")

3. **AskUserQuestion** with options:
   - A) Run it
   - B) Skip this step
   - C) Show full status dashboard
   - D) Exit /oli

4. **On A (Run it):**
   - Invoke the skill via the Skill tool (e.g., `Skill("oli-prd-audit")`)
   - **Post-invocation validation:** verify expected output before re-running diagnostics (see table below)
   - If validation fails: offer options: A) Retry skill, B) Skip, C) Exit
   - If validation passes: re-run diagnostics (Steps 1-7) to get updated state
   - Return to Loop step 1 with fresh state

### Post-Invocation Validation

After each skill completes, validate expected output before proceeding:

| Step | Skill | Expected Output | Validation |
|------|-------|----------------|------------|
| 1b | `/oli-init` | Directory structure + config | `docs/product/`, `.planning/` exist + `.planning/config.json` valid JSON |
| 3 | `/oli-prd-audit` | PRD_AUDIT_REPORT + companions | `DOMAIN_GLOSSARY.md` + `ROLE_PERMISSION_MATRIX.md` + `MODULE_MAP.md` exist |
| 4 | `/oli-workflow-map` | WORKFLOW_MAP.md | Exists + has `## Workflow Inventory` or WF-NNN entries |
| 5 | `/oli-domain-model` | DOMAIN_MODEL.md | Exists + has `## Bounded Contexts` or entity classification |
| 5b | `/oli-sync-architecture` | SYNC_ARCHITECTURE.md | Exists + has architecture decisions |
| 6 | `/oli-module-specs` | MODULE_SPEC.md per module | Count > 0, ideally matches MODULE_MAP module count |
| 7 | `/oli-api-contracts` | API_CONTRACTS.md per module | Count matches modules with API layer |
| 8 | `/oli-ui-blueprint` | ui-prototype/ per module | `screens.md` + `components.md` exist per module |
| 9 | `/oli-spec-consistency` | CONSISTENCY_REPORT.md | Exists + no HIGH severity findings |
| 10 | `/oli-spec-review-gate` | SPEC_REVIEW.md | Exists + sign-off matrix present |
| 11 | `/oli-vertical-slice-plan` | VERTICAL_SLICE_PLAN.md + slice specs | Plan exists + at least 1 SLICE_SPEC |
| 14a | `/oli-audit-compliance` | COMPLIANCE_REPORT.md | Exists + has `## Executive Summary` |
| 14b | `/oli-confidence-stack` | CONFIDENCE_REPORT.md | Exists + has `## Score Summary` |
| 14c | `/oli-trace` | TRACE_REPORT.md | Exists + has coverage matrix |

If validation fails: "Expected output not found or incomplete. Options: A) Retry, B) Skip, C) Exit"

5. **On B (Skip):**
   - Log: "Step N: manually skipped by user"
   - Advance to next step in DAG order
   - Return to Loop step 1

6. **On C (Show status):**
   - Output full dashboard (same as `--full`)
   - Return to Loop step 3 (same question)

7. **On D (Exit):**
   - Show final status summary (compact)
   - Print: "Resume anytime with `/oli`"
   - STOP

### Greenfield Fresh Start

If Step 0 classified as "Greenfield (fresh)" — no PRD, no code:
- First suggested step: `/office-hours` (sharpen the idea)
- After office-hours: `/oli-init` (scaffold project)
- After oli-init: guide user to write PRD at `docs/product/MASTER_PRD.md`
- Then resume normal DAG from `/oli-prd-audit`

### Pipeline Complete

When all DAG steps are complete (all artifacts present, none stale, all gates passed):
- Show: "Pipeline complete. All artifacts current. No pending actions."
- If audit scores available, show health summary
- STOP

### Step Reference (for context display)

| Step | Skill | What it does | Reads | Produces |
|------|-------|-------------|-------|----------|
| 1 | `/office-hours` | Sharpen idea, kill bad ones | User input | Design doc in `~/.gstack/projects/` |
| 1b | `/oli-init` | Scaffold project dirs, config, templates | — | `.planning/config.json`, `ARCHITECTURE.md`, `CLAUDE.md` TDD |
| 2 | (manual) | Write PRD from office-hours output | Office-hours design doc | `docs/product/MASTER_PRD.md` |
| 3 | `/oli-prd-audit` | Audit PRD against 24 categories + Ambiguity Gate | `MASTER_PRD.md`, `ARCHITECTURE.md` | `PRD_AUDIT_REPORT.md`, `DOMAIN_GLOSSARY.md`, `MODULE_MAP.md`, `ROLE_PERMISSION_MATRIX.md` |
| 4 | `/oli-workflow-map` | Discover all workflows via 9 heuristics | PRD, `DOMAIN_GLOSSARY.md`, `ROLE_PERMISSION_MATRIX.md`, `MODULE_MAP.md` | `WORKFLOW_MAP.md` |
| 5 | `/oli-domain-model` | Map entities, aggregates, bounded contexts | PRD, `WORKFLOW_MAP.md`, `DOMAIN_GLOSSARY.md`, `MODULE_MAP.md` | `DOMAIN_MODEL.md` |
| 5b | `/oli-sync-architecture` | Design offline/sync architecture (conditional: offline/local-first) | `ARCHITECTURE.md`, `DOMAIN_MODEL.md`, `PRD_AUDIT_REPORT.md` | `SYNC_ARCHITECTURE.md` |
| 6 | `/oli-module-specs` | Decompose PRD into per-module specs (22 sections) | PRD, `WORKFLOW_MAP.md`, `DOMAIN_MODEL.md`, `MODULE_MAP.md` | `docs/product/modules/*/MODULE_SPEC.md` |
| 7 | `/oli-api-contracts` | Define API surfaces, error taxonomy, events (conditional: API layer) | MODULE_SPECs, `DOMAIN_MODEL.md`, `WORKFLOW_MAP.md`, `ARCHITECTURE.md` | `API_CONTRACTS.md`, `ERROR_TAXONOMY.md`, `EVENT_CONTRACTS.md` |
| 8 | `/oli-ui-blueprint` | Screen layouts, components, interaction states (conditional: frontend) | MODULE_SPECs, `DOMAIN_GLOSSARY.md`, `ROLE_PERMISSION_MATRIX.md` | UI blueprint per module |
| 9 | `/oli-spec-consistency` | Cross-module consistency check (GATE — blocks on HIGH) | All Phase B artifacts | `CONSISTENCY_REPORT.md` |
| 10 | `/oli-spec-review-gate` | Human review of [INFERRED] items, sign-off (GATE) | All MODULE_SPECs, `CONSISTENCY_REPORT.md` | `SPEC_REVIEW.md` |
| 11 | `/oli-vertical-slice-plan --to-gsd` | Create SLICE_SPECs + ROADMAP.md | All specs + consistency report | `VERTICAL_SLICE_PLAN.md`, slice specs, GSD bridge files |
| 11b | `/oli-seed` | Generate seed data from specs (optional) | MODULE_SPECs, `WORKFLOW_MAP.md`, `DOMAIN_MODEL.md` | Seed script + `SEED_MANIFEST.md` |
| 12 | `/gsd-plan-phase` | Convert SLICE_SPEC → PLAN.md (per phase) | SLICE_SPEC | `.planning/phases/*/PLAN.md` |
| 13 | `/gsd-execute-phase` | Execute phase (waves, worktrees, TDD) | PLAN.md | Implementation code + tests |
| 14a | `/oli-audit-compliance` | Spec compliance (15 categories incl. UI, events, infra, data path, error boundary, contracts) | Code, MODULE_SPECs, UI_BLUEPRINT, EVENT_CONTRACTS | `docs/audits/COMPLIANCE_REPORT.md` |
| 14b | `/oli-confidence-stack` | Test quality score + TDD verification | Test files, `TDD_PROOF.md` | `docs/audits/CONFIDENCE_REPORT.md` |
| 14c | `/oli-trace` | Intent traceability graph (5 gap algorithms, enforcement gates) | All artifacts | `docs/trace/TRACE_REPORT.md` |
| 14d | `/qa` | Functional verification | Running app | QA report |
