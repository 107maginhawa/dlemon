You are now operating under the Journey Test Audit Orchestrator.

The prompt files are saved in:

`/doc/audits/mapping-audit/prompts/`

Load and strictly follow:

`/doc/audits/mapping-audit/prompts/ORCHESTRATOR-journey-test-audit.md`

Then load and apply:

`/doc/audits/mapping-audit/prompts/00-master-audit-rules.md`

---

# Automation Mode — Strict Module-by-Module Audit

Run the audit sequence automatically, but with strict gate enforcement.

The correct flow is:

1. Run `01-brownfield-baseline-audit.md` globally.
2. From the baseline audit, identify the full Module Audit Queue.
3. Run audits `02` through `08` separately for each module/area in the queue.
4. Do not move to the next audit unless the current gate passes.
5. Do not move to the next module until the current module passes Gates 2–8.
6. After each module passes Gates 2–8, create a `MODULE_AUDIT_SUMMARY.md`.
7. After all modules/areas pass, run `09-prioritized-stabilization-plan.md` globally.
8. Do NOT run `10-tdd-execution-gate-prompt.md` unless explicitly instructed later.

---

# Prompt Files to Use

## Global Baseline

Run first:

`/doc/audits/mapping-audit/prompts/01-brownfield-baseline-audit.md`

## Per-Module Audit Prompts

Run these for each module/area identified in the Module Audit Queue:

1. `/doc/audits/mapping-audit/prompts/02-role-permission-map-audit.md`
2. `/doc/audits/mapping-audit/prompts/03-route-navigation-audit.md`
3. `/doc/audits/mapping-audit/prompts/04-frontend-interaction-integrity-audit.md`
4. `/doc/audits/mapping-audit/prompts/05-form-modal-table-action-audit.md`
5. `/doc/audits/mapping-audit/prompts/06-backend-api-contract-alignment-audit.md`
6. `/doc/audits/mapping-audit/prompts/07-role-based-journey-map-audit.md`
7. `/doc/audits/mapping-audit/prompts/08-test-confidence-gap-audit.md`

## Global Consolidation

Run only after all module/area audits pass:

`/doc/audits/mapping-audit/prompts/09-prioritized-stabilization-plan.md`

## Do Not Run Yet

Do not run:

`/doc/audits/mapping-audit/prompts/10-tdd-execution-gate-prompt.md`

---

# Module Audit Queue Requirement

After completing `01-brownfield-baseline-audit.md`, create a Module Audit Queue before running audits `02` through `08`.

The queue must include both business modules and shared/global areas.

Include actual detected areas such as:

- Auth / Login / Session
- App Shell / Layout
- Sidebar / Navigation
- Dashboard
- User / Member / Patient / Customer module
- Admin module
- Settings module
- Reports module
- Billing / Payments module if present
- Shared Components
- API Client / SDK / Data Fetching Layer
- Backend API / Server Routes
- Permission Middleware
- CI / Test Setup
- E2E / Playwright Infrastructure
- Cross-Module Workflows

Use actual detected modules from the codebase. Do not invent modules.

Create this table:

| Order | Module/Area | Type | Source Paths | Frontend Routes | Backend APIs | Roles Involved | Tests Found | E2E Tests Found | Priority |
|---|---|---|---|---|---|---|---|---|---|

Module/Area Type must be one of:

- Business Module
- Shared Frontend
- Shared Backend
- Auth/Permission
- App Shell
- Infrastructure/Test
- E2E Infrastructure
- Cross-Module Workflow

Do not proceed to audits `02` through `08` until this queue exists and Gate 1B passes.

---

# Per-Module Execution Rule

For each module/area in the Module Audit Queue, run audits `02` through `08` in sequence.

For each module:

1. Run `02-role-permission-map-audit.md` scoped only to the current module/area.
2. Evaluate Gate 2.
3. If Gate 2 passes, run `03-route-navigation-audit.md`.
4. Evaluate Gate 3.
5. Continue until Gate 8 passes.
6. Create `MODULE_AUDIT_SUMMARY.md`.
7. Only then proceed to the next module/area.

Do not move to the next module/area until Gates 2–8 all pass for the current module/area.

If a module has no applicable frontend, backend, form, modal, API, or E2E surface, do not skip silently.

Mark that section as:

`NOT APPLICABLE — with evidence`

Example:

`NOT APPLICABLE — no frontend routes or components found under [path]. Backend-only module.`

---

# Required Module-Level Artifacts

For each module/area, produce module-scoped outputs.

Use this folder structure if possible:

```txt
/doc/audits/mapping-audit/results/modules/[module-slug]/
