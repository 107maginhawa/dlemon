# 17 — QA / UAT Workflow Guide

You are working inside a large platform codebase that has already been audited using the AHA system.

AHA = Audit, Harden, Align.

This prompt generates a **human QA / UAT handover pack** from existing AHA outputs, PRDs/specs, routes, modules, workflows, and known findings.

This prompt is **read-only**.

Do not modify source code.
Do not modify tests.
Do not fix defects.
Do not create new product requirements.
Do not promote V2/deferred ideas into V1.
Do not duplicate AHA audit findings as if they are newly discovered QA findings.

Your job is to convert existing product, audit, and implementation knowledge into a clear QA guide that a human QA tester can follow even if they have zero prior knowledge of the app.

---

## 1. Load Required AHA Files

Load and strictly follow:

`[CODEBASE_ROOT]/docs/aha/prompts/00-aha-shared-rules.md`

Load if available:

`[CODEBASE_ROOT]/docs/aha/outputs/module-audit-index.md`

Load all available module/group gap plans from:

`[CODEBASE_ROOT]/docs/aha/module-gap-plans/`

Load all available module/group fix-ready plans from:

`[CODEBASE_ROOT]/docs/aha/module-fix-plans/`

Load all available module/group fix reports from:

`[CODEBASE_ROOT]/docs/aha/module-fix-plans/`

Load if available:

`[CODEBASE_ROOT]/docs/aha/outputs/cross-cutting-pattern-audit.md`

`[CODEBASE_ROOT]/docs/aha/outputs/database-schema-audit.md`

`[CODEBASE_ROOT]/docs/aha/outputs/consolidated-remediation-roadmap.md`

Load PRDs/specs/product references discovered by AHA.

If available, also inspect:

* app routes/pages
* navigation structure
* user roles/RBAC definitions
* seed/test users
* test fixtures
* Playwright/E2E specs
* screenshots/evidence under `docs/aha/evidence/`

---

## 2. Output Location

Create or update only files under:

`[CODEBASE_ROOT]/docs/aha/qa/`

Use this structure:

```txt
docs/aha/qa/
├── qa-source/
│   ├── module-uat-scripts/
│   │   ├── [module-slug]-uat.md
│   │   └── ...
│   ├── cross-module-journeys.md
│   ├── regression-checklist.md
│   ├── qa-signoff-checklist.md
│   └── defect-reporting-guide.md
│
└── qa-handover/
    ├── qa-handover-guide.md
    └── qa-test-execution-tracker.md
```

If spreadsheet generation is supported, also create:

```txt
docs/aha/qa/qa-handover/qa-test-execution-tracker.csv
```

or:

```txt
docs/aha/qa/qa-handover/qa-test-execution-tracker.xlsx
```

Do not place QA files in old audit folders.

Do not overwrite unrelated files.

---

## 3. Purpose

Generate a practical QA/UAT pack that answers:

1. What is this app?
2. Who uses it?
3. What are the main modules?
4. What are the critical workflows?
5. What should QA test first?
6. What roles/accounts should QA use?
7. What are the expected results?
8. What known issues/blockers should QA be aware of?
9. What should be treated as release-blocking?
10. How should QA report defects?

The output should be understandable by a QA tester who has never seen the app before.

---

## 4. Scope Rules

This is a QA/UAT documentation generation prompt.

Allowed:

* Read existing code, docs, PRDs, tests, routes, and AHA outputs.
* Summarize app purpose and module behavior.
* Generate human-executable QA workflows.
* Generate module-level UAT scripts.
* Generate cross-module journey scripts.
* Generate regression checklist.
* Generate QA signoff checklist.
* Generate defect reporting guide.
* Generate QA execution tracker.

Not allowed:

* Do not modify source code.
* Do not modify tests.
* Do not fix issues.
* Do not add migrations.
* Do not create new features.
* Do not invent business rules silently.
* Do not treat inferred workflows as confirmed.
* Do not mark known unresolved defects as passed.
* Do not hide blockers.

---

## 5. Labeling Rules

Use these labels consistently:

```txt
[CONFIRMED FROM PRD]
[CONFIRMED FROM CODE]
[CONFIRMED FROM TEST]
[CONFIRMED FROM AHA AUDIT]
[INFERRED]
[NEEDS CONFIRMATION]
[NEEDS PRODUCT DECISION]
[BLOCKED BY MISSING SPEC]
[BLOCKED BY ENVIRONMENT]
[KNOWN ISSUE]
[REGRESSION RISK]
[DO NOT TEST AS V1]
```

Rules:

* Use `[INFERRED]` when the workflow is implied by code/routes but not clearly documented.
* Use `[NEEDS PRODUCT DECISION]` when expected behavior is unclear.
* Use `[BLOCKED BY MISSING SPEC]` when QA cannot fairly judge pass/fail.
* Use `[KNOWN ISSUE]` when AHA already identified the gap and it remains unresolved.
* Use `[DO NOT TEST AS V1]` for V2 deferred or explicitly out-of-scope items.

---

## 6. Severity Rules for QA

Use the same severity model as AHA:

```txt
P0 = blocks core workflow, data loss, serious safety/security risk, or unusable module
P1 = serious workflow, trust, permission, or testability gap
P2 = important but not blocking
P3 = minor polish / cleanup
```

Add QA-specific release impact:

```txt
BLOCKER = should block QA signoff/release
MAJOR = should be fixed before release unless accepted by product owner
MINOR = can be released with known issue if accepted
COSMETIC = polish only
```

---

## 7. Generate `qa-source/module-uat-scripts/[module-slug]-uat.md`

For each discovered module/group, create one module UAT script file.

Each file must include:

```md
# [Module Name] — UAT Script

## 1. Module Summary

- Module slug:
- Purpose:
- Primary users/roles:
- Related modules:
- Main screens/routes:
- Primary records/entities:
- Important statuses/lifecycle states:
- Source confidence:
  - PRD:
  - Code:
  - Tests:
  - AHA findings:

## 2. Scope

### In Scope for QA

### Out of Scope / Do Not Test as V1

### Known Issues / Blockers

## 3. Test Accounts / Roles Needed

| Role | Account | Purpose | Notes |
|---|---|---|---|

Use placeholders if real accounts are unavailable.

## 4. Test Data Needed

| Data | Required For | Example | Notes |
|---|---|---|---|

## 5. Happy Path Test Cases

Use this format:

| Test Case ID | Priority | Role | Workflow | Steps | Expected Result | Source | Notes |
|---|---|---|---|---|---|---|---|

## 6. Negative / Validation Test Cases

Include required field validation, invalid input, duplicate records, empty states, missing data, failed saves, and permission-denied cases where relevant.

| Test Case ID | Priority | Role | Scenario | Steps | Expected Result | Source | Notes |
|---|---|---|---|---|---|---|---|

## 7. Permission / RBAC Test Cases

| Test Case ID | Priority | Role | Action | Expected Access | Expected Result | Source | Notes |
|---|---|---|---|---|---|---|---|

## 8. Data Lifecycle Test Cases

Test create, read, update, status changes, cancellation/deletion rules, audit/history behavior, and record safety where relevant.

| Test Case ID | Priority | Role | Lifecycle Stage | Steps | Expected Result | Source | Notes |
|---|---|---|---|---|---|---|---|

## 9. UI / Usability Checks

Include navigation, labels, empty states, loading states, errors, success messages, responsiveness, and obvious accessibility checks.

## 10. Regression Checks

List the minimum checks that should be repeated after fixes touching this module.

## 11. Open Questions for Product/Dev

List only questions that block fair QA judgment.

## 12. QA Notes

Leave this section for human QA notes.
```

Do not overload each module with excessive low-value cases.

Prioritize real workflows and release-blocking behavior.

---

## 8. Generate `qa-source/cross-module-journeys.md`

Create a file containing end-to-end journeys that cross module boundaries.

Include:

```md
# Cross-Module QA Journeys

## Purpose

These journeys verify that separately working modules connect correctly in real user workflows.

## Journey Summary Table

| Journey ID | Journey Name | Modules Involved | Primary Role(s) | Priority | Release Impact |
|---|---|---|---|---|---|

## Detailed Journeys

For each journey:

### [Journey ID] — [Journey Name]

- Purpose:
- Roles:
- Modules involved:
- Preconditions:
- Test data:
- Steps:
- Expected result:
- Known issues:
- Regression risks:
- Evidence required:
```

Examples of journey types:

* Login → dashboard → core module action → saved record → verify record appears elsewhere.
* Admin creates user → assigns role → user logs in → permission behavior verified.
* Create primary entity → schedule/assign/link secondary entity → update status → verify downstream module.
* Submit transaction/order/request → approve/process → view result/report/history.
* Start workflow → cancel/void/reverse → verify status, audit trail, and downstream effects.

Use generic business language based on the actual app.

Do not invent unsupported workflows.

---

## 9. Generate `qa-source/regression-checklist.md`

Create a focused regression checklist.

Include:

```md
# Regression Checklist

## When To Use This

Use after any code fix, module update, schema change, permission change, routing change, or deployment.

## Smoke Regression

| Check ID | Area | Steps | Expected Result | Priority |
|---|---|---|---|---|

## Role / Permission Regression

| Check ID | Role | Action | Expected Result | Priority |
|---|---|---|---|---|

## Cross-Module Regression

| Check ID | Journey | Modules | Expected Result | Priority |
|---|---|---|---|---|

## Data Safety Regression

| Check ID | Scenario | Expected Result | Priority |
|---|---|---|---|

## UI / Navigation Regression

| Check ID | Scenario | Expected Result | Priority |
|---|---|---|---|
```

Keep this practical.

Regression checklist should be shorter than full UAT.

---

## 10. Generate `qa-source/qa-signoff-checklist.md`

Create a QA signoff checklist.

Include:

```md
# QA Signoff Checklist

## Release Candidate

- App/version/build:
- Environment:
- QA tester:
- Date:
- Browser/device:
- Test data set:

## Entry Criteria

| Criteria | Status | Notes |
|---|---|---|

## Exit Criteria

| Criteria | Status | Notes |
|---|---|---|

## Blocker Review

| Defect ID | Severity | Module | Status | Release Decision |
|---|---|---|---|---|

## Known Issues Accepted for Release

| Issue | Severity | Accepted By | Reason | Follow-up |
|---|---|---|---|---|

## Final QA Recommendation

Choose one:

- Approved for release
- Approved with known issues
- Not approved
- Blocked

## QA Signoff

- QA:
- Product owner:
- Engineering lead:
- Date:
```

---

## 11. Generate `qa-source/defect-reporting-guide.md`

Create a simple defect reporting guide.

Include:

```md
# Defect Reporting Guide

## Required Defect Fields

- Defect title
- Module
- Environment
- User role/account
- Browser/device
- Preconditions
- Steps to reproduce
- Expected result
- Actual result
- Severity
- Release impact
- Screenshot/video/logs
- Related test case ID
- Notes

## Severity Guide

Use P0/P1/P2/P3 and BLOCKER/MAJOR/MINOR/COSMETIC.

## Good Defect Example

## Poor Defect Example

## Evidence Requirements
```

---

## 12. Generate `qa-handover/qa-handover-guide.md`

This is the main file to hand over to QA.

It must be concise and readable.

It should consolidate the most important content from `qa-source/`.

Use this structure:

```md
# QA Handover Guide

## 1. App Overview

- App name:
- Purpose:
- Target users:
- Main business goal:
- Current QA scope:
- What QA should focus on first:

## 2. How To Use This QA Pack

Explain:

- Start with this guide.
- Use the test execution tracker while testing.
- Refer to module scripts only when more detail is needed.
- Report defects using the defect guide.
- Do not test V2/out-of-scope items as release blockers.

## 3. Test Environment

- Environment URL:
- Build/version:
- Browser/device requirements:
- Test accounts:
- Test data:
- Known environment blockers:

Use placeholders where details are unavailable.

## 4. User Roles

| Role | Purpose | Main Permissions | Should Not Be Able To |
|---|---|---|---|

## 5. Module Map

| Module | Purpose | Main Role(s) | Priority | UAT Source File |
|---|---|---|---|---|

## 6. Critical QA Workflows

List the most important workflows QA should execute first.

| Priority | Workflow | Modules | Role | Why It Matters |
|---|---|---|---|---|

## 7. Recommended QA Execution Order

Example:

1. Login/authentication smoke test
2. Admin/user/role setup
3. Core module happy paths
4. Cross-module journeys
5. Negative/validation tests
6. Permission/RBAC tests
7. Regression checklist
8. Signoff checklist

Adjust based on the actual app.

## 8. Known Issues and Blockers

Summarize unresolved P0/P1 items from AHA/fix reports.

| Issue | Module | Severity | Status | QA Instruction |
|---|---|---|---|---|

## 9. What Is Out of Scope

List V2 deferred, do-not-add, and product-decision items that QA should not treat as release blockers.

## 10. Pass / Fail Rules

Define when QA should mark:

- Pass
- Fail
- Blocked
- Not testable
- Needs product decision

## 11. Defect Reporting Rules

Summarize the minimum required fields.

## 12. Final QA Signoff Guidance

Explain what QA must complete before recommending release.
```

This handover guide should be the only Markdown file QA needs to read first.

---

## 13. Generate `qa-handover/qa-test-execution-tracker.md`

Create a QA execution tracker that QA can use directly.

Use this structure:

```md
# QA Test Execution Tracker

| Test Case ID | Priority | Module | Workflow | Role | Preconditions | Steps | Expected Result | Actual Result | Status | Severity | Evidence | Defect ID | QA Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
```

Rules:

* Include the highest-value test cases from module UAT scripts and cross-module journeys.
* Do not include every tiny checklist item.
* Prioritize P0/P1, happy paths, cross-module journeys, permissions, and data safety.
* Keep the tracker usable by humans.
* Use stable test case IDs.

Recommended ID format:

```txt
QA-[MODULE_SLUG]-001
QA-[MODULE_SLUG]-002
QA-JOURNEY-001
QA-REGRESSION-001
```

If CSV/XLSX output is supported, also create a spreadsheet-friendly version with the same columns.

---

## 14. Traceability Requirements

Every important QA test case should trace back to at least one source where possible:

* PRD/spec
* module audit index
* module gap plan
* fix-ready plan
* fix report
* route/page
* test file
* code behavior
* inferred workflow

Use a `Source` or `Source Notes` field.

Do not overdo citations, but make it clear where the expected behavior came from.

If no reliable source exists, mark the test case as:

`[INFERRED]` or `[NEEDS PRODUCT DECISION]`

---

## 15. Prioritization Rules

Prioritize QA coverage in this order:

1. Login/auth/session workflows
2. Role/RBAC/security-sensitive behavior
3. Core business workflows
4. Cross-module journeys
5. Data creation/update/status lifecycle
6. Error handling and validation
7. Regression areas from AHA fix reports
8. Known P0/P1 audit findings
9. Reporting/export/print workflows if applicable
10. UI polish/accessibility only after core flows

Do not bury QA in low-value cosmetic checks before core workflows are covered.

---

## 16. Quality Bar

The generated QA pack must be:

* understandable to a new QA tester
* practical to execute manually
* traceable to product/code/AHA sources
* generic enough for any project type
* specific enough for the current app
* focused on V1/release-relevant workflows
* clear about known blockers and unknowns
* free from speculative features
* not bloated

---

## 17. Final Response

After generating the files, provide a short summary:

```txt
Generated QA/UAT handover pack under docs/aha/qa/.

Main QA handover files:
- docs/aha/qa/qa-handover/qa-handover-guide.md
- docs/aha/qa/qa-handover/qa-test-execution-tracker.md

Detailed source files are under:
- docs/aha/qa/qa-source/

Recommended next step:
Give only the qa-handover files to the QA person/team. Keep qa-source internal unless they need more detail.
```

