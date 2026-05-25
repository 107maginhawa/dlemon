
# Dental System Audit Orchestrator

## Purpose

Run a strict-but-practical audit of the Dentalemon dental management system.

This audit is for a greenfield-intended, AI-built codebase that was supposed to follow the OLI pipeline, but OLI itself evolved during implementation. Therefore, do not assume the current codebase perfectly followed the latest OLI process. Audit for real production risk, product completeness, workflow correctness, implementation quality, test confidence, and traceability.

The audit must produce actionable findings, stable gap IDs, remediation tasks, implementation prompts, and verification criteria.

---

## Governing Context

Use these files as primary context if present:

- `docs/audits/prompts/01-audit-enforcement-guardrails.md`
- `docs/audits/prompts/02-oli-pipeline-artifact-audit.md`
- `docs/audits/prompts/03-dental-product-workflow-audit.md`
- `docs/audits/prompts/04-spec-to-code-compliance-audit.md`
- `docs/audits/prompts/05-tdd-confidence-audit.md`
- `docs/audits/prompts/06-ui-ux-ipad-carousel-audit.md`
- `docs/audits/prompts/07-remediation-task-generator.md`

Also use these repo artifacts if present:

- `MODULES.md`
- `oli.md`
- `oli-execution-gate.md`
- `CAROUSEL-CONCEPT.md`
- `ARCHITECTURE.md`
- `docs/product/MASTER_PRD.md`
- `docs/product/PRD_AUDIT_REPORT.md`
- `docs/product/MODULE_MAP.md`
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
- `docs/execution/VERTICAL_SLICE_PLAN.md`
- `docs/execution/slices/*/SLICE_SPEC.md`
- `docs/execution/slices/*/TDD_PROOF.md`
- `.planning/config.json`
- `.planning/phases/*/CONTEXT.md`
- `.planning/phases/*/PLAN.md`

If any of these are missing, do not fail automatically. Mark them as missing and classify the impact by risk.

---

## Required Output Files

Create or update:

- `docs/audits/AUDIT_COVERAGE_MANIFEST.md`
- `docs/audits/DENTAL_AUDIT_RUN_LOG.md`
- `docs/audits/DENTAL_GAP_REGISTRY.md`
- `docs/audits/DENTAL_SYSTEM_AUDIT_REPORT.md`
- `docs/audits/DENTAL_REMEDIATION_TASKS.md`
- `docs/audits/DENTAL_IMPLEMENTATION_PROMPTS.md`
- `docs/audits/DENTAL_SPEC_BACKFILL_TASKS.md`

Do not issue a final audit conclusion unless `AUDIT_COVERAGE_MANIFEST.md` has been created or updated.

---

## Audit Philosophy

Be strict where risk is real. Be practical where the issue is historical process debt.

The codebase does not need to prove it followed the perfect OLI sequence from day one. But before release, it must prove that the final product, specs, workflows, implementation, tests, and user experience are aligned enough for production use.

Do not overblock because an artifact is missing. Block only if the missing artifact prevents verification of critical behavior, or if the code itself has clinical, billing, data integrity, security, tenancy, or workflow risk.

---

## Severity Model

Use the following severity levels:

### P0 — Critical Blocker

Must stop release or execution.

Examples:

- Patient/dental data can leak across orgs or branches.
- Clinical records can be edited after signing/locking without audit trail or amendment.
- Treatment history, chart history, prescriptions, consent, or billing data can be lost or corrupted.
- Billing or balances can become materially incorrect.
- Appointment/visit/treatment state machines permit invalid dangerous states.
- No meaningful tests exist for critical clinical, billing, security, or tenancy behavior.

### P1 — Major Release Blocker

Must be fixed before production, but not necessarily catastrophic.

Examples:

- Core workflow exists in backend but cannot be completed in frontend.
- Acceptance criteria or business rules exist but are untested.
- API contract and handler behavior drift materially.
- RBAC/tenancy enforcement is inconsistent.
- Core module behavior is superficial or incomplete.
- TDD proof missing for critical slices.
- Key user journey lacks integration or E2E coverage.

### P2 — Important Remediation / Process Debt

Should be fixed before serious rollout unless accepted.

Examples:

- OLI artifact missing but behavior can be reconstructed from code.
- Module spec incomplete but current behavior seems reasonable.
- Test exists but is shallow.
- UI blueprint missing for non-critical area.
- Naming/terminology drift.
- Traceability is incomplete.
- Useful but non-critical UX improvements.

### P3 — Advisory / Polish / Future Phase

Good to improve, not a blocker.

Examples:

- Minor UI polish.
- Dashboard refinement.
- Microcopy.
- Empty states.
- Non-critical performance tuning.
- Future local-first migration reminders.

---

## Required Audit Sequence

Run the audit in this order:

1. Load `01-audit-enforcement-guardrails.md`.
2. Create/update `AUDIT_COVERAGE_MANIFEST.md`.
3. Run `02-oli-pipeline-artifact-audit.md`.
4. Run `03-dental-product-workflow-audit.md`.
5. Run `04-spec-to-code-compliance-audit.md`.
6. Run `05-tdd-confidence-audit.md`.
7. Run `06-ui-ux-ipad-carousel-audit.md`.
8. Run `07-remediation-task-generator.md`.
9. Produce final executive summary in `DENTAL_SYSTEM_AUDIT_REPORT.md`.

Each pass must update:

- `AUDIT_COVERAGE_MANIFEST.md`
- `DENTAL_AUDIT_RUN_LOG.md`
- `DENTAL_GAP_REGISTRY.md`

---

## Large Codebase Rule

Do not attempt to audit the entire codebase from memory or sampling.

First inventory:

- backend handler modules
- route files
- services
- repositories
- schemas/models
- frontend routes
- frontend feature folders
- components
- hooks
- tests
- slice specs
- TDD proof files
- module specs
- API contracts
- UI blueprints

If context becomes too large, stop after completing the current module or pass, update `DENTAL_AUDIT_RUN_LOG.md`, and provide a resume instruction.

---

## Gap ID Rules

Every finding must have a stable ID:

- `GAP-DENTAL-001`
- `GAP-DENTAL-002`
- `GAP-DENTAL-003`

Do not create duplicate gap IDs for the same issue on later audits. Reuse the same ID and update status.

Statuses:

- `OPEN`
- `IN_PROGRESS`
- `FIXED_PENDING_VERIFICATION`
- `VERIFIED_FIXED`
- `WONT_FIX_ACCEPTED`
- `SUPERSEDED`
- `DUPLICATE`
- `NOT_REPRODUCIBLE`

Every gap must include:

- Gap ID
- Title
- Severity
- Area/module
- Type
- Evidence
- Impact
- Recommended fix
- Verification method
- Current status

---

## Evidence Rules

No evidence, no finding.

Each finding must reference at least one of:

- file path
- function/component/route/test name
- spec item
- workflow item
- API contract item
- UI blueprint item
- role/permission rule
- test file
- TDD proof file
- command output

If line numbers are available, include them. If not, cite the exact function/component/route/file.

---

## Final Output Requirements

At the end, produce:

1. Executive summary
2. Release readiness status
3. P0/P1 blocker list
4. P2 remediation list
5. P3 polish/future list
6. Audit coverage score
7. Per-module status matrix
8. Cross-module workflow status matrix
9. Test confidence summary
10. UI/UX readiness summary
11. Spec-backfill needs
12. Implementation task list
13. AI-ready implementation prompts
14. Re-audit instructions

Final release status must be one of:

- `NOT READY — P0 blockers exist`
- `NOT READY — P1 blockers exist`
- `CONDITIONALLY READY — only P2/P3 remain`
- `READY FOR CONTROLLED PILOT`
- `READY FOR PRODUCTION`
