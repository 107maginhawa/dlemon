
---

## 02 — `docs/audits/prompts/02-oli-pipeline-artifact-audit.md`

```md
# OLI Pipeline Artifact Audit

## Purpose

Audit whether the project followed the intended OLI pipeline enough to trust the build.

This is not a purity test. Missing or incomplete OLI artifacts should be classified by the risk they create.

---

## Required Guardrail

Before running this pass, load:

`docs/audits/prompts/01-audit-enforcement-guardrails.md`

Update:

- `docs/audits/AUDIT_COVERAGE_MANIFEST.md`
- `docs/audits/DENTAL_AUDIT_RUN_LOG.md`
- `docs/audits/DENTAL_GAP_REGISTRY.md`

---

## Inputs

Inspect if present:

- `oli.md`
- `.planning/config.json`
- `ARCHITECTURE.md`
- `docs/product/MASTER_PRD.md`
- `docs/product/PRD_AUDIT_REPORT.md`
- `docs/product/DOMAIN_GLOSSARY.md`
- `docs/product/ROLE_PERMISSION_MATRIX.md`
- `docs/product/MODULE_MAP.md`
- `docs/product/WORKFLOW_MAP.md`
- `docs/product/DOMAIN_MODEL.md`
- `docs/product/DATA_GOVERNANCE.md`
- `docs/product/SYNC_ARCHITECTURE.md`
- `docs/product/modules/*/MODULE_SPEC.md`
- `docs/product/modules/*/API_CONTRACTS.md`
- `docs/product/modules/*/ui-prototype/*`
- `docs/product/API_CONVENTIONS.md`
- `docs/product/ERROR_TAXONOMY.md`
- `docs/product/EVENT_CONTRACTS.md`
- `docs/product/SHARED_COMPONENTS.md`
- `docs/product/NAVIGATION_MAP.md`
- `docs/product/UI_CONVENTIONS.md`
- `docs/product/CONSISTENCY_REPORT.md`
- `docs/product/SPEC_REVIEW.md`
- `docs/execution/VERTICAL_SLICE_PLAN.md`
- `docs/execution/slices/*/SLICE_SPEC.md`
- `docs/execution/slices/*/TDD_PROOF.md`
- `.planning/phases/*/CONTEXT.md`
- `.planning/phases/*/PLAN.md`
- `docs/audits/COMPLIANCE_REPORT.md`
- `docs/audits/CONFIDENCE_REPORT.md`
- `docs/trace/TRACE_REPORT.md`

---

## Audit Questions

### 1. Project Classification

Determine whether the repo is:

- Greenfield fresh
- Greenfield mid-pipeline
- Greenfield with boilerplate
- Brownfield
- Greenfield-intended but pipeline-incomplete

For this audit, assume likely classification:

`Greenfield-intended but pipeline-incomplete`

Confirm using evidence.

---

### 2. Phase A Artifact Check

Check:

- PRD audit exists
- domain glossary exists
- role-permission matrix exists
- module map exists
- workflow map exists
- domain model exists
- data governance exists if applicable
- sync architecture exists if local-first/offline was in scope

Classify missing items by risk.

---

### 3. Phase B Artifact Check

For each module, check:

- `MODULE_SPEC.md`
- `API_CONTRACTS.md`
- UI blueprint
- form contracts if applicable
- microcopy if applicable

Also check shared artifacts:

- API conventions
- error taxonomy
- event contracts
- shared components
- navigation map
- UI conventions

---

### 4. Phase B Gate Check

Check:

- `CONSISTENCY_REPORT.md`
- `SPEC_REVIEW.md`

Look for:

- unresolved HIGH conflicts
- pending sign-offs
- rejected sign-offs
- stale reports

If missing, classify as P2 unless it prevents verification of critical behavior.

---

### 5. Phase C Execution Readiness Check

Check:

- vertical slice plan exists
- slice specs exist
- slice specs map to modules/workflows
- slice gaps exist or not
- `.planning/config.json` enables TDD mode
- `oli-execution-gate` is configured for executor agents

If execution happened without slice specs or TDD gate, classify based on risk.

---

### 6. TDD Proof Existence Check

Check whether each executed slice has:

- `SLICE_SPEC.md`
- `TDD_PROOF.md`
- AC/BR mapping
- RED/GREEN evidence
- verification commands
- coverage summary

Missing TDD proof for critical clinical/billing/security/tenancy slices is P1 unless tests and evidence are otherwise strong.

---

### 7. Post-Execution Audit Check

Check whether these exist and are current:

- compliance report
- confidence report
- trace report
- QA report if applicable

If missing, classify based on release stage.

---

### 8. Staleness Check

Flag artifacts that appear stale because upstream artifacts changed.

Use these relationships:

- PRD changes invalidate PRD audit, module map, workflow map, domain glossary, role matrix, module specs.
- Domain model changes invalidate API contracts and data governance.
- Module spec changes invalidate API contracts, UI blueprints, slice specs, tests.
- Code changes invalidate compliance/confidence/trace reports.

If exact timestamps are unavailable, mark as `REQUIRES_MANUAL_REVIEW`.

---

## Output Section

Append to:

`docs/audits/DENTAL_SYSTEM_AUDIT_REPORT.md`

with:

```md
# OLI Pipeline Artifact Audit

## Summary

## Artifact Matrix

| Artifact | Exists | Current | Audited | Risk | Notes |
|---|---:|---:|---:|---|---|

## Findings

| Gap ID | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|

## Pass Completion

Status:
Coverage:
Unaudited:
Resume instruction:
