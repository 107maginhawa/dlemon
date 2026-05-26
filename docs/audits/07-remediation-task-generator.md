

---

## 07 — `docs/audits/prompts/07-remediation-task-generator.md`

```md
# Remediation Task and Implementation Prompt Generator

## Purpose

Convert audit findings into actionable remediation tasks, implementation prompts, spec-backfill tasks, and verification steps.

This pass does not re-audit. It reads the gap registry and audit reports, groups issues, and produces an execution-ready plan.

---

## Required Guardrail

Before running this pass, load:

`docs/audits/prompts/01-audit-enforcement-guardrails.md`

Read:

- `docs/audits/DENTAL_GAP_REGISTRY.md`
- `docs/audits/DENTAL_SYSTEM_AUDIT_REPORT.md`
- `docs/audits/AUDIT_COVERAGE_MANIFEST.md`
- `docs/audits/DENTAL_AUDIT_RUN_LOG.md`

Update:

- `docs/audits/DENTAL_REMEDIATION_TASKS.md`
- `docs/audits/DENTAL_IMPLEMENTATION_PROMPTS.md`
- `docs/audits/DENTAL_SPEC_BACKFILL_TASKS.md`

---

## Seed Coverage Tasks

For every P0/P1/P2 finding, determine whether seed data is needed to reproduce, test, demo, or verify the issue.

Create seed tasks when a gap needs data for:
- full workflow execution
- business rule pass/violate cases
- role/permission checks
- state transition coverage
- edge cases
- cross-module handoffs
- UI/E2E scenarios

Each seed task must reference:
- Gap ID
- WF-NNN if applicable
- BR-NNN if applicable
- state/status value if applicable
- role if applicable
- entities required
- expected seed scenario name
- whether mode should be `dev`, `demo`, or `qa`

---

## Task Generation Principles

Generate tasks that are:

- specific
- evidence-based
- scoped
- testable
- ordered by risk
- aligned to OLI and TDD standards
- not over-engineered

Do not generate vague tasks like “improve tests” or “fix billing.”

Generate tasks like:

```md
TASK-DENTAL-P1-004
Add integration test for treatment transition planned → performed requiring signed consent.
