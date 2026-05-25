
---

## 05 — `docs/audits/prompts/05-tdd-confidence-audit.md`

```md
# TDD and Test Confidence Audit

## Purpose

Audit whether the codebase has trustworthy tests and whether execution followed TDD/spec-driven standards.

This pass answers:

Can we trust the implementation?

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

- `oli-execution-gate.md`
- `.planning/config.json`
- `.planning/phases/*/CONTEXT.md`
- `.planning/phases/*/PLAN.md`
- `docs/execution/slices/*/SLICE_SPEC.md`
- `docs/execution/slices/*/TDD_PROOF.md`
- test files
- CI config
- package scripts
- backend code
- frontend code
- E2E tests

---

## Audit Areas

### 1. Execution Gate Configuration

Check:

- `.planning/config.json` has TDD mode enabled.
- executor agent config includes `oli-execution-gate`.
- slice specs reference or load execution gate.
- execution proof exists.

If gate exists only as a document but was not invoked/configured, classify based on risk.

---

### 2. Slice Spec Coverage

For each `SLICE_SPEC.md`, extract:

- `AC-NNN`
- `BR-NNN`
- `TEST-NNN`

Then check whether each has at least one test.

Status per item:

- `COVERED`
- `PARTIAL`
- `UNCOVERED`
- `NOT_TESTABLE`
- `SPEC_AMBIGUOUS`

Uncovered AC/BR in critical clinical, billing, security, or tenancy workflows is P1 or P0.

---

### 3. TDD Proof Audit

For each `TDD_PROOF.md`, check:

- context loaded
- spec items listed
- test file references
- RED output captured
- GREEN output captured
- refactor/regression commands
- coverage summary
- verification commands
- P0/P1 findings resolved or blocked

Classify proof quality:

- `STRONG`
- `ADEQUATE`
- `WEAK`
- `MISSING`
- `UNVERIFIABLE`

---

### 4. Test Quality Audit

Search for weak patterns:

- `assert(true)`
- tests with no meaningful assertions
- only `expect(fn).not.toThrow()`
- excessive snapshots without behavior checks
- tests that mock the subject under test
- tests that pass regardless of input
- skipped tests
- todo tests
- commented-out tests
- tests not wired to CI

Flag weak tests.

---

### 5. Backend Test Coverage

Check per module:

- unit tests
- integration tests
- repository tests if applicable
- handler/API tests
- validation tests
- permission tests
- state transition tests
- data lifecycle tests
- error handling tests

Critical areas:

- dental-visit
- dental-patient
- dental-scheduling
- dental-billing
- dental-clinical
- dental-perio
- dental-imaging
- dental-org
- dental-pmd
- shared RBAC/tenancy

---

### 6. Frontend and E2E Coverage

Check:

- route-level tests
- component tests
- hook tests
- form tests
- Playwright/Cypress E2E if present
- happy paths
- failure paths
- loading/error/empty states
- iPad/touch critical flows
- charting carousel flows

Critical E2E journeys:

- register patient
- create appointment
- check in
- create visit
- chart tooth
- create treatment
- sign note/consent
- generate invoice/payment
- export/generate PMD
- verify branch access isolation

---

### 7. CI Confidence

Check:

- lint/typecheck
- unit tests
- integration tests
- E2E tests
- migration tests if applicable
- test commands documented
- CI fails on test failure
- coverage thresholds if used

---

## Confidence Score

Produce scores:

```md
## Test Confidence Score

| Layer | Score | Notes |
|---|---:|---|
| Spec item coverage | /100 | |
| Backend unit/integration | /100 | |
| Frontend/component | /100 | |
| E2E workflow | /100 | |
| Permission/security tests | /100 | |
| Data lifecycle tests | /100 | |
| TDD proof quality | /100 | |
| CI reliability | /100 | |

Overall:
