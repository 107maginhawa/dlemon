# Confidence Audit — external-records-import

---
Audit Date: 2026-05-30
Dimension: confidence (oli-check) — test/coverage/release-gate confidence (Layers 1-4)
Scope: external-records-import (single module)
Spec Version: 1.2 (Last Updated 2026-05-29)
Team size: small
Verdict: SKIP — module is unimplemented by design (future_phase, Phase 3+); no tests/code to score
---

## Verdict Summary

**SKIP.** The CONFIDENCE dimension scores four statically-auditable layers
(L1 Coverage Integrity, L2 Behavior Traceability, L3 Test Quality Hardening,
L4 Release Gate Readiness) over a module's **test suite and handler source**.
external-records-import has neither.

The module is **future_phase (Phase 3+)** by design. MODULE_SPEC Section 20
(AI Instruction #3) states: *"This is a FUTURE PHASE module. Do not implement
handler files until explicitly scheduled."* The absence of code and tests is
therefore spec-compliant and intentional.

Per the confidence skill stop condition — *"No source code found at
detected/specified path → STOP — no source code to audit"* — and *"No test
runner detected and no test files found → STOP — cannot score test confidence
without tests"* — no layers can be scored. Reported as SKIP (not 0/10 across
the board) because there is no implementation to exercise; a 0-score would
mis-signal test debt where the correct state is "not yet built."

This verdict is consistent with the sibling compliance slice
(`docs/audits/compliance/external-records-import.md`, also SKIP).

## Evidence

| Artifact | Present | Used for confidence scoring |
|----------|---------|------------------------------|
| MODULE_SPEC.md | ✓ `docs/product/modules/external-records-import/` | Behavior inventory source (no tests to map to) |
| API_CONTRACTS.md (module-local) | ✓ | 3 endpoints declared; zero have test owners |
| ui-prototype/ | ✓ (dir present) | Not scored (no backend binding) |
| Handler source | ✗ `services/api-ts/src/handlers/external-records-import/` absent | Steps 4-6b SKIPPED |
| Test files | ✗ none match `external-records-import` / `/dental/emr-import` / `emr_record` | L1-L3 unscoreable |
| TDD_PROOF.md | ✗ no slice references this module | Step 6c skipped |
| Compliance behavior inventory | ✓ `docs/audits/compliance/external-records-import.md` (SKIP) | Cross-referenced |

### Knowledge-graph ground truth (docs/audits/codebase-map/)

- **CODE_MODULE_MAP.json** (version 3) enumerates 23 modules; none is
  `external-records-import`, `emr-import`, or namespace `/dental/emr-import`.
- The `emr` handler present in the map and on disk
  (`services/api-ts/src/handlers/emr/`) is the **disclaimed** telemedicine
  consultation-notes module on namespace `/emr` (see emr-consultation), explicitly
  NOT this module per the spec's Section 0 Naming Note. Its test files
  (`emr.handlers.test.ts`, `emr.repo.test.ts`, `emr-coverage.test.ts`,
  `consultation-note.fsm.property.test.ts`, `getConsultation.expand.test.ts`)
  exercise consultation notes — they do **not** cover external-records-import and
  must not be counted toward its confidence.
- No source references to `/dental/emr-import`, `emr_record`, or `emrRecord`
  outside `src/generated/` in `services/api-ts/src` or `apps/dentalemon/src`.

## Layer Scores

Not scorable — no handler source and no test files.

| Layer | Score | Rationale |
|-------|-------|-----------|
| L1 Coverage Integrity | N/A (skip) | No source/test files; nothing to measure the ruler against |
| L2 Behavior Traceability | N/A (skip) | Spec inventory exists (3 BRs, 3 ACs, 3 endpoints, 1 terminal state) but 0 test owners; would be 0/10 but no code exists to demand traceability |
| L3 Test Quality Hardening | N/A (skip) | No tests to assess for assertion strength / mocks / flake / data stability |
| L4 Release Gate Readiness | N/A (skip) | Repo-level CI exists (.github/workflows: contract, openapi-drift, postgres-services, quality, release) but there is no module-specific code in the pipeline to gate |

**Overall Test-Confidence (min L1-L3):** N/A
**Release-Readiness (L4):** N/A (module not in pipeline)
**Ship-Readiness:** N/A
**TestConf:** N/A

## Behavior Inventory (for the FUTURE audit, when implemented)

When EMR-S1 (Import + read-only store) and EMR-S2 (View + patient link) are
built, the confidence audit must verify test owners for:

- **Business rules:** read-only after import; no auto-merge into editable dental
  records (BR-022 analog); `source_system` required for audit trail; patient
  referenced by UUID with no DB FK to `dental_patient`.
- **Permissions (deny+allow pairs required):** Import = dentist_owner /
  dentist_associate; View = all dental roles incl. staff_full; Delete =
  dentist_owner only. Plus `assertBranchAccess` (dental-org) on all three routes.
- **State machine:** `imported` is terminal — guard test that PATCH/DELETE → 405
  `EMR_IMMUTABLE` (AC-EMR-001).
- **API contracts (3 endpoints, currently 0 test owners):**
  `POST /dental/emr-import` (incl. 422 `UNSUPPORTED_SOURCE_SYSTEM`,
  422 `IMPORT_PARSE_ERROR`, AC-EMR-003 missing `source_system` → 422),
  `GET /dental/emr-import/:patientId` (paginated, branch_id required),
  `GET /dental/emr-import/:id` (presigned file_url, 24h TTL).
- **Acceptance criteria:** AC-EMR-001 (405 on mutate), AC-EMR-002 (import
  creates read-only record; editable records unchanged), AC-EMR-003 (422 on
  missing source_system).

## Findings

No findings. There is no implementation, so there is no coverage gap, weak
assertion, flaky test, or missing release gate attributable to this module.
Counting absent tests as defects here would be a false positive against an
intentionally-deferred module.

## Recommendation

No action required now. Re-run `/oli-check --confidence --module
external-records-import` once the module is scheduled and a handler directory
plus its test layers exist (Vertical TDD: backend unit + contract + frontend
unit + E2E). At that point also register the module in the knowledge graph
(CODE_MODULE_MAP.json) so confidence scoring has structural ground truth.
Priority test targets for that future run: AC-EMR-001 405 guard, AC-EMR-003 422
on missing source_system, dentist_owner-only delete guard, and the
`assertBranchAccess` deny+allow pair on all three routes.
