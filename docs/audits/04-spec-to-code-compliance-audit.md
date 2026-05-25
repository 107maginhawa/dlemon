

---

## 04 — `docs/audits/prompts/04-spec-to-code-compliance-audit.md`

```md
# Spec-to-Code Compliance Audit

## Purpose

Audit whether implementation follows the intended specs, contracts, workflows, domain model, role matrix, and UI blueprints.

This pass answers:

Did we build what the specs say?

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

- `docs/product/MASTER_PRD.md`
- `docs/product/WORKFLOW_MAP.md`
- `docs/product/DOMAIN_MODEL.md`
- `docs/product/DOMAIN_GLOSSARY.md`
- `docs/product/ROLE_PERMISSION_MATRIX.md`
- `docs/product/API_CONVENTIONS.md`
- `docs/product/ERROR_TAXONOMY.md`
- `docs/product/EVENT_CONTRACTS.md`
- `docs/product/UI_CONVENTIONS.md`
- `docs/product/NAVIGATION_MAP.md`
- `docs/product/modules/*/MODULE_SPEC.md`
- `docs/product/modules/*/API_CONTRACTS.md`
- `docs/product/modules/*/ui-prototype/*`
- `docs/execution/slices/*/SLICE_SPEC.md`
- code files
- tests

---

## Compliance Categories

### 1. Module Spec Compliance

For each module:

- Extract business rules.
- Extract acceptance criteria.
- Extract entities.
- Extract workflows.
- Extract edge cases.
- Compare against handlers, services, repos, frontend, and tests.

Classify:

- `IMPLEMENTED`
- `PARTIAL`
- `MISSING`
- `CONTRADICTED`
- `UNVERIFIABLE`

---

### 2. API Contract Compliance

For each endpoint:

Check:

- HTTP method
- path
- request body
- path/query params
- response shape
- status codes
- validation errors
- auth/permission rules
- idempotency where applicable
- error taxonomy compliance

Flag drift.

---

### 3. Domain Model Compliance

Check:

- entity names
- aggregate boundaries
- relationships
- required fields
- status enums
- timestamps
- ownership/tenant fields
- versioning/history
- deletion/archive behavior

Flag:

- extra entity not in domain model
- missing entity
- mismatched field
- incorrect relationship
- domain logic leaking to UI/handler only
- inconsistent terminology

---

### 4. Workflow Map Compliance

For each workflow in `WORKFLOW_MAP.md`:

- identify backend routes
- identify frontend screens/components
- identify tests
- identify audit/log events if applicable
- check happy path
- check exception paths
- check permissions

Flag unimplemented or broken workflow steps.

---

### 5. Role and Permission Compliance

Check:

- role matrix exists
- permissions enforced server-side
- branch/org scope enforced
- frontend hides unauthorized actions
- backend still rejects unauthorized action
- audit logs record sensitive actions
- destructive actions require correct permissions

Server-side enforcement is required. Frontend-only enforcement is never sufficient.

---

### 6. UI Blueprint Compliance

If UI blueprint exists:

Check:

- screens exist
- components exist
- form fields match contracts
- validations match
- loading/error/empty states exist
- navigation matches
- accessibility baseline
- touch targets for iPad/tablet areas
- design tokens used

---

### 7. Event/Error Compliance

Check:

- error taxonomy used
- error messages consistent
- error codes stable
- events or audit logs emitted where expected
- no silent failures for important user actions

Silent failure of clinical, billing, treatment, payment, or record-save actions is P0/P1 depending on impact.

---

### 8. Data Integrity and Lifecycle Compliance

Check:

- clinical records
- dental chart
- visit notes
- treatment plan versions
- billing records
- payment records
- consents
- prescriptions
- PMD documents

For each, verify:

- creation
- update rules
- finalization/signing/locking
- versioning or audit trail
- deletion/archive constraints
- tenant ownership
- branch ownership

---

## Output Section

Append to:

`docs/audits/DENTAL_SYSTEM_AUDIT_REPORT.md`

with:

```md
# Spec-to-Code Compliance Audit

## Summary

## Compliance Matrix

| Area | Spec Source | Code Source | Status | Risk | Notes |
|---|---|---|---|---|---|

## API Drift Matrix

| Endpoint | Contract | Implementation | Status | Severity |
|---|---|---|---|---|

## Domain Drift Matrix

| Entity/Concept | Domain Model | Implementation | Status | Severity |
|---|---|---|---|---|

## Findings

| Gap ID | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|

## Pass Completion

Status:
Coverage:
Unaudited:
Resume instruction:
