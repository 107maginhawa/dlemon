# AUDIT_CURRENT_CODEBASE_AGAINST_IDEAL_DENTAL_STANDARD_PROMPT.md

**Purpose:** Follow-up audit prompt for comparing the current Dentalemon codebase against the ideal production-grade Dentalemon module/workflow/business-rule standard.

**Reference standard path:**

```txt
docs/audits/reference/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md
```

---

# Master Audit Prompt

You are an experienced AI software engineer, QA tester, product architect, dental workflow analyst, and system auditor.

Important correction:

The Dentalemon frontend app is located at:

`/apps/dentalemon`

Do not assume the dental frontend is in `/apps/account`. If a previous audit referenced `/apps/account` as the main dental frontend, treat that as stale or incorrect unless verified by current codebase evidence.

When auditing frontend routes, UI, carousel navigation, charting, billing, and patient workspace, inspect `/apps/dentalemon` first.

Your task is to audit the current Dentalemon codebase against the reference standard located at:

```txt
docs/audits/reference/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md
```

This is not a generic code review. This is a production-readiness and standards-compliance audit for a practical small-to-mid-sized dental clinic management system that is:

- iPad-first
- local-first-ready
- not overengineered
- based on realistic dental workflows
- aligned with OLI process
- suitable for TDD/spec-driven development
- designed around modules, workflows, business rules, entities, permissions, UI/UX expectations, tests, and seed data

Use the OLI process:

- **Observe:** Inspect the actual codebase before making claims.
- **Link:** Map every finding to the ideal standard using section names, modules, workflow IDs, rule IDs, entities, permissions, UI expectations, test expectations, or seed-data expectations.
- **Implement / Improve:** Do not implement yet unless explicitly asked. First produce a clear audit report and remediation roadmap.

Use `/oli-execution-gate` before any implementation recommendation is converted into code changes.

---

## Audit Scope

Inspect the current codebase for the following areas:

1. Repository structure
2. App/module boundaries
3. Backend/domain/service structure
4. Database schema/entities/models/migrations
5. API routes and handlers
6. Frontend routes/screens/components
7. Dental charting implementation
8. Patient workflows
9. Appointment/queue workflows
10. Clinical encounter workflows
11. Treatment plan workflows
12. Completed procedure/work-done workflows
13. Billing/payment workflows
14. Claims/coding support
15. Imaging/attachments support
16. Inventory/materials support
17. Communication/recall/task support
18. Audit logging
19. Local-first/offline/sync readiness
20. Role-based permissions
21. UI/UX iPad readiness
22. Carousel/module navigation patterns
23. Tests: unit, integration, E2E, permission, audit, local-first
24. Seed data and demo/test scenario coverage
25. Documentation and implementation notes

---

## Required Method

### Step 1 — Read the Reference Standard

Open and study:

```txt
docs/audits/reference/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md
```

Create an internal checklist based on:

- Bounded contexts/modules
- Workflows
- Business rules
- Entities
- Permissions
- UI/UX expectations
- Test expectations
- Seed-data expectations
- V1 Required / V1 Recommended / V2 Deferred priority tags

Do not rely only on file names. Verify implementation through actual code where possible.

---

### Step 2 — Discover Current Implementation

Inspect the codebase and identify:

- Existing modules/apps/packages
- Frontend routes and screens
- Backend routes/services/controllers/handlers
- Domain models/entities/types/schemas
- Database migrations/schema definitions
- Permission/auth/membership logic
- UI components and layout systems
- Dental charting components
- Tests and test helpers
- Seed files/factories/fixtures
- Local-first/offline/sync-related code
- Audit logging code
- Documentation relevant to Dentalemon modules/workflows

Produce a concise current-state map before evaluating gaps.

---

### Step 3 — Compare Against the Ideal Standard

Create the following matrices.

#### A. Bounded Context / Module Gap Matrix

| Ideal Context | Current Implementation Found | Status | Priority | Evidence | Gap | Recommendation |
|---|---|---|---|---|---|---|

Status values:

- `Implemented`
- `Partially Implemented`
- `Not Implemented`
- `Unclear / Needs Manual Review`
- `Deferred / Correctly Not Implemented`

#### B. Workflow Gap Matrix

| Workflow | Current Coverage | Status | Priority | Evidence | Missing Steps | Recommendation |
|---|---|---|---|---|---|---|

Include at minimum:

- New patient → first visit → baseline chart → treatment plan
- Existing patient → same-day treatment → billing → recall
- Emergency walk-in toothache
- Treatment plan approval → partial completion
- Imaging attachment workflow
- Offline-ready clinical workflow

#### C. Business Rule Coverage Matrix

For every business rule in the reference standard:

| Rule ID | Rule Summary | Implemented? | Tested? | Test File(s) | Evidence | Gap | Recommendation |
|---|---|---:|---:|---|---|---|---|

Status values:

- `Covered`
- `Partially Covered`
- `Not Covered`
- `Not Implemented`
- `Unclear / Needs Manual Review`

#### D. Entity / Schema Gap Matrix

| Ideal Entity | Current Entity/Table/Type | Status | Priority | Evidence | Gap | Recommendation |
|---|---|---|---|---|---|---|

Check whether the current schema supports the ideal workflows, not just whether similarly named tables exist.

#### E. Permission Gap Matrix

| Permission Area | Expected Roles | Current Behavior | Status | Evidence | Risk | Recommendation |
|---|---|---|---|---|---|---|

Specifically check:

- Front desk vs clinical chart editing
- Dentist vs assistant capabilities
- Billing discount/write-off permissions
- Admin-only settings and user management
- Audit log access
- Data export/deletion/reversal permissions

#### F. UI/UX Gap Matrix

| UI/UX Expectation | Current Implementation | Status | Priority | Evidence | Gap | Recommendation |
|---|---|---|---|---|---|---|

Specifically check:

- iPad-first usability
- touch targets
- no hover dependency
- carousel/module navigation
- patient context persistence
- dental chart centrality
- baseline/proposed/completed visual separation
- fast tooth/surface selection
- minimal modal stacking
- offline/sync indicators
- role-aware dashboard

#### G. Test Coverage Gap Matrix

| Test Area | Existing Tests | Status | Priority | Evidence | Gap | Recommendation |
|---|---|---|---|---|---|---|

Check:

- Unit tests for business rules
- Integration tests for service/API flows
- E2E tests for critical dental journeys
- Permission tests
- Audit log tests
- Local-first/sync tests
- Seed scenario tests
- UI/iPad layout tests where applicable

#### H. Seed Data Gap Matrix

| Seed Requirement | Current Seed Coverage | Status | Priority | Evidence | Gap | Recommendation |
|---|---|---|---|---|---|---|

Check whether seed data supports realistic E2E and demo scenarios, not just raw records.

---

## Priority Classification

Classify each finding using:

| Priority | Meaning |
|---|---|
| P0 | Blocks safe V1 clinical/billing workflow. |
| P1 | Important V1 gap; should be fixed before production. |
| P2 | V1 recommended improvement. |
| P3 | V2/deferred; document but do not block V1. |

Also preserve the standard’s original priority:

- `V1 Required`
- `V1 Recommended`
- `V2 / Deferred`

Do not treat V2/deferred items as V1 blockers unless the current implementation incorrectly depends on them.

---

## Required Audit Report Format

Generate the audit report as a Markdown file with this structure:

```md
# Dentalemon Current Codebase vs Ideal Standard Audit

## 1. Executive Summary

## 2. V1 Readiness Rating
- Rating: Green / Yellow / Orange / Red
- Rationale:

## 3. Current Implementation Map

## 4. Bounded Context / Module Gap Matrix

## 5. Workflow Gap Matrix

## 6. Business Rule Coverage Matrix

## 7. Entity / Schema Gap Matrix

## 8. Permission Gap Matrix

## 9. UI/UX Gap Matrix

## 10. Test Coverage Gap Matrix

## 11. Seed Data Gap Matrix

## 12. Highest-Risk Gaps

## 13. What Is Already Strong

## 14. What Should Not Be Overbuilt Yet

## 15. Prioritized Remediation Roadmap

### P0 — Production Blockers

### P1 — Required Before V1 Production

### P2 — Recommended V1 Improvements

### P3 — V2 / Deferred

## 16. Recommended Next Prompts

## 17. Final Recommendation
```

---

## Evidence Rules

For every major claim, cite actual codebase evidence such as:

- File path
- Function/component/type/class name
- Route name
- Test file
- Migration/schema file
- Seed file
- Relevant code snippet summary

Do not claim that something is implemented unless you found direct evidence.

If evidence is incomplete, mark it as:

```txt
Unclear / Needs Manual Review
```

---

## Special Audit Instructions

### Do Not Over-Penalize Current Implementation for V2 Items

If a feature is tagged `V2 / Deferred`, document whether the current codebase supports it, but do not mark it as a blocker.

### Treat Tests as First-Class Requirements

If a workflow or business rule exists but has no test coverage, mark it as:

```txt
Implemented but Untested
```

This is still a gap.

### Separate UI Existence from UI Quality

A screen existing does not mean the workflow is usable. Check whether the UI supports realistic iPad-first dental operations.

### Separate Data Model from Workflow Completion

A table or type existing does not mean the workflow is complete. Validate whether actual user flow, service logic, permissions, and tests exist.

### Local-First Readiness

Do not require full sync engine in V1, but check if the architecture supports:

- local IDs
- sync metadata
- offline-safe record creation
- conflict preservation
- non-destructive updates

### Dental Charting Is Central

Pay special attention to whether the chart supports:

- baseline
- proposed work
- completed work
- tooth-level entries
- surface-level entries
- tooth history
- visual distinction between chart layers

This is a core Dentalemon capability, not a generic EMR feature.

---

## Final Output Requirement

Save the audit report to:

```txt
docs/audits/DENTALEMON_CURRENT_VS_IDEAL_STANDARD_AUDIT.md
```

Also provide a short summary in the terminal/chat with:

1. V1 readiness rating
2. Top 5 P0/P1 gaps
3. Top 5 test gaps
4. Top 5 seed-data gaps
5. Recommended next implementation prompt

Do not implement fixes yet unless explicitly instructed.

