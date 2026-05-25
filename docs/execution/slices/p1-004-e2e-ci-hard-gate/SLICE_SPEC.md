---
slice: p1-004-e2e-ci-hard-gate
phase: audit-fix-sprint
modules: [ci]
gap_ref: GAP-DENTAL-004
agent_skills: [skills/oli-execution-gate]
---

## Goal

Make the journey-verification CI job a true hard-fail gate: any journey that is expected PASS
and regresses to BROKEN (or ERROR) must cause CI to fail with a non-zero exit code.

## Acceptance Criteria

AC-001: The journey harness exits non-zero when any PASS-expected journey returns BROKEN or ERROR
AC-002: The journey harness continues to exit non-zero when any spec crashes before emitting a verdict (ERROR count > 0)
AC-003: The journey harness exits zero when all PASS-expected journeys return PASS (even if BROKEN-expected journeys return BROKEN)
AC-004: The quality.yml journey-verification job workflow comment accurately describes the exit-code semantics
AC-005: The quality.yml e2e job comment documents that journey-verification is the authoritative hard-fail E2E gate

## Business Rules

BR-001: IF a journey's expectedVerdict is PASS AND actualVerdict is not PASS THEN harness must exit 1
BR-002: IF all PASS-expected journeys return PASS AND error count is 0 THEN harness must exit 0

## Notes

TDD applies to the harness script (logic change). Config/YAML changes are TDD-skipped per
oli-execution-gate "Configuration files" exemption, but must be verified by code inspection.
Full verification: deliberate regression test (comment out a workspace route, observe CI fail)
is documented as a required manual step — cannot be automated in-repo.
