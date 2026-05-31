# Confidence Stack Report

**Date:** 2026-05-31
**HEAD:** f1b38d8
**Team size:** small
**Layers audited:** 1-4 (static analysis)
**Layers deferred:** 5-6 (require CI/CD/runtime evidence)
**Map provenance:** producer=engine, engine_version 0.1.0 (config v5), `fields_unavailable: []`, confidence_threshold MEDIUM. No `unverified` bucket needed — all signals below read directly from test/source files or from full-confidence engine fields.
**Focus:** V-DG-001 retention module (26 new tests). Full api-ts suite reported 2854/0; sampled, not fully re-run.

## Score Summary

| Layer | Score | Meaning | Top Gaps |
|-------|-------|---------|----------|
| 1. Coverage Integrity | 9/10 | Strong — destructive paths meaningfully asserted; loading-hygiene clean | No TDD_PROOF artifacts to grant +1 git-history bonus |
| 2. Behavior Traceability | 8/10 | Good — every retention safety invariant has a named test owner | No SLICE_SPEC/EVENT/API contract artifacts for retention to widen denominator |
| 3. Test Quality Hardening | 9/10 | Strong — specific-value assertions, real DB clones + injected fakes, no flake/skip | jobs.test.ts uses `mock.module` (appropriate — isolating cron wiring) |
| 4. Release Gate Readiness | (unchanged from prior run) | Out of scope for this targeted retention run | — |

**Overall Test-Confidence (min L1-L3):** 8/10 — strong, honest test quality on the retention module.

## V-DG-001 Retention Module — Findings

**Observed: 26 tests / 26 pass / 0 fail (re-run via test-with-db.ts, 3.2s, 5 files each in its own DB clone).**

| Test file | Tests | expect() | DB-backed? | Verdict |
|-----------|-------|----------|-----------|---------|
| retention-engine.test.ts | 10 | 40 | No — opaque db + fake targets + audit spy | Genuine: asserts engine decisions, not mocks |
| retention-targets.test.ts | 5 | 10 | Yes — real `dental_attachment` clone | Genuine: catches wrong join/column |
| retention-defaults.test.ts | 4 | 8 | Yes — real repo + clone | Genuine: defaults + idempotency |
| retention-policy.repo.test.ts | 4 | 10 | Yes — real clone | Genuine: tenant scoping, soft-delete |
| jobs/jobs.test.ts | 3 | 5 | No — `mock.module` for repo/engine | Appropriate: isolates cron registration + dry-run gating |

**Mock-only concern: REFUTED.** The engine test is "pure" by design (opaque db, fake `RetentionTarget` with call spies, injected audit writer) — but it asserts real engine *behavior*: dry-run-by-default, legal-hold exclusion, audit-protected refusal (`findEligible` never called), delete→archive downgrade, period-boundary cutoff math, no-target/disabled short-circuits. The DB-backed targets/repo/defaults tests prove the actual SQL wires to the real schema on cloned test DBs. The two layers are complementary, not mock-substitution. Engine source (`retention-engine.ts`) is a real implementation, not a stub.

**Assertion strength:** STRONG throughout. Specific values (`toBe('archive')`, `toBe(3650)`, `toEqual(['a'])`, ISO-string cutoff equality, `toHaveLength(1)` on audit events). Zero bare `toBeDefined`/`toBeTruthy`-only tests. One `.not.toBeNull()` on `deletedAt` paired with a positive eligibility re-query — acceptable.

**Probe-skip / brokenness-assertion scan:** 0 occurrences. No `.skip`/`.todo`/`xit`. `anti_coverage_items`: none.

**Safety invariants verified as test-owned:** dry-run default, live archive, legal-hold, audit-never-purged, `retain`=protected, delete-downgrade, anonymize path, period-boundary, no-target, disabled-skip, tenant/branch scoping, soft-delete exclusion, idempotency, cron registration + env-gated live mode.

## Loading-State Hygiene (engine v5, §4.5)

`CODE_COMPONENT_REGISTRY.json` v5 present. UI-typed components: 119; analyzed: 38; **violations: 0** → `loading_hygiene_coverage = 1.0`. **No Layer-1 cap.** No infinite-skeleton risk surfaced.

## FE→BE Edge Density (§5.5, awareness)

119 UI components, 15 with non-empty `api_calls`. Most UI components are presentational (props-driven), so a low absolute count is expected and not a blind-spot signal for the retention (backend-only) module. No L2 cap applied for this targeted run.

## TDD Proof Verification

No `docs/execution/slices/*/TDD_PROOF.md` artifacts found for the retention slice (or any slice). Proof verification skipped — **no score adjustment** (per §6c.1). The +1 git-history L1 bonus is therefore unavailable, holding L1 at 9 rather than 10.

## SUT-Binding (§6.5)

Retention module is backend-only (no `@testing-library` component tests) → `sut_binding_ratio: n/a` for this scope. No L3 cap.

## Cross-Layer Consistency

No inconsistencies. L1 (9) − L2 (8) = 1 (≤3, ok). L3 (9) does not exceed L1/L2 by >4.

## Prioritized Action Plan

### P0 — Fix Now
None.

### P1 — Fix Before Major New Work
None.

### P2 — Fix When Touching Module
- Consider a TDD_PROOF.md for the V-DG-001 slice to enable git-history test-first verification (would lift L1 toward 10).

### P3 — Nice to have
- A live-mode end-to-end DB test that actually flips `RETENTION_ENFORCEMENT_ENABLED=true` through the cron handler against a real clone (jobs.test.ts currently mocks the engine at that seam). Current coverage is adequate; this would close the last mock seam.

## Verdict

**PASS.** The 26 V-DG-001 retention tests genuinely verify behavior — real DB clones for persistence/scoping, injected fakes (not mock substitution) for engine decision logic, all assertions specific-value STRONG, suite 26/0 green, zero probe-skip, loading-hygiene clean (1.0, no cap). Test-Confidence 8/10.
