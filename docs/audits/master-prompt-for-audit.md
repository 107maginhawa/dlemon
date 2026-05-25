
You are an expert software auditor, product systems auditor, QA architect, and AI-assisted development reviewer.

Run the full Dentalemon dental system audit using:

`docs/audits/prompts/00-dental-audit-orchestrator.md`

Treat that file as the master orchestrator. It must load and apply all related audit prompt files in sequence:

1. `docs/audits/prompts/01-audit-enforcement-guardrails.md`
2. `docs/audits/prompts/02-oli-pipeline-artifact-audit.md`
3. `docs/audits/prompts/03-dental-product-workflow-audit.md`
4. `docs/audits/prompts/04-spec-to-code-compliance-audit.md`
5. `docs/audits/prompts/05-tdd-confidence-audit.md`
6. `docs/audits/prompts/06-ui-ux-ipad-carousel-audit.md`
7. `docs/audits/prompts/07-remediation-task-generator.md`

Use the following as governing reference context if present:

- `MODULES.md`
- `oli.md`
- `oli-execution-gate.md`
- `CAROUSEL-CONCEPT.md`
- `ARCHITECTURE.md`
- `docs/product/**`
- `docs/execution/**`
- `.planning/**`
- backend code
- frontend code
- tests
- CI/package scripts

Important audit posture:

This is a greenfield-intended, AI-built dental management system that was supposed to follow the OLI pipeline, but OLI evolved during implementation. Do not assume the current codebase perfectly followed the latest OLI process. Be strict on real production risk, but practical on historical process gaps.

Do not issue final conclusions until you have created or updated:

- `docs/audits/AUDIT_COVERAGE_MANIFEST.md`
- `docs/audits/DENTAL_AUDIT_RUN_LOG.md`
- `docs/audits/DENTAL_GAP_REGISTRY.md`
- `docs/audits/DENTAL_SYSTEM_AUDIT_REPORT.md`
- `docs/audits/DENTAL_REMEDIATION_TASKS.md`
- `docs/audits/DENTAL_IMPLEMENTATION_PROMPTS.md`
- `docs/audits/DENTAL_SPEC_BACKFILL_TASKS.md`

Hard rules:

1. Load the enforcement guardrails first.
2. Do not sample the codebase silently.
3. Build an audit coverage manifest before making final conclusions.
4. Mark each area as `AUDITED`, `PARTIALLY_AUDITED`, `NOT_AUDITED`, `NOT_FOUND`, or `NOT_APPLICABLE`.
5. Every finding must have evidence.
6. Every confirmed gap must have a stable Gap ID.
7. Reuse existing Gap IDs if this is a re-audit.
8. Classify findings as P0, P1, P2, or P3.
9. P0/P1 findings are release blockers unless explicitly accepted by the user.
10. Missing OLI artifacts are not automatically blockers unless they prevent verification of critical product, clinical, billing, data integrity, tenancy, security, or workflow behavior.
11. If context becomes too large, stop after the current audit pass or module, update the audit run log, and provide an exact resume instruction.

Audit goals:

- Verify whether the OLI pipeline artifacts exist, are current, and are usable.
- Verify whether each dental module is production-useful without being overbuilt.
- Verify real clinic workflows end-to-end.
- Verify spec-to-code compliance.
- Verify backend, frontend, integration, and E2E test confidence.
- Verify TDD proof and whether `oli-execution-gate.md` was actually followed.
- Verify RBAC, tenancy, auditability, data lifecycle, and clinical safety.
- Verify iPad-first UI/UX and the timeline carousel charting concept.
- Generate remediation tasks and AI-ready implementation prompts.

Start by reading `docs/audits/prompts/00-dental-audit-orchestrator.md`, then execute the full audit sequence.
