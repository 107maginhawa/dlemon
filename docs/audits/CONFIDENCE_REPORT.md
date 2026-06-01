# Confidence Stack Report

**Date:** 2026-06-01
**HEAD:** a3bfc9a5
**Team size:** small
**Mode:** `--auto` (sample/inspect — suite NOT re-run; last known 2905/0)
**Layers audited:** 1-4 (static analysis); focused on the recent governance/sync test additions
**Map provenance:** producer=engine, v5, FRESH (git_sha matches HEAD), `fields_unavailable: []`, confidence_threshold MEDIUM
**Engine scope:** `apps/dentalemon/src` only (frontend). The audited test additions are backend (`services/api-ts`) — read **directly from source files → HIGH confidence, not graph-anchored, never routed to `unverified`** (per §6.1–6.5 / R1 source-read exemption).

## Score Summary

| Layer | Score | Meaning | Top Gaps |
|-------|-------|---------|----------|
| 1. Coverage Integrity | 9/10 | Strong — meaningful assertions on business outcomes; loading-hygiene 1.0 (no cap) | No coverage report artifact emitted; line-% unmeasured |
| 2. Behavior Traceability | 9/10 | Strong — every audited behavior (erasure lifecycle, legal-hold block, retention exclusion, localId persistence) has a real-wiring test owner | FE→BE edge density unknown (engine scope excludes backend) |
| 3. Test Quality Hardening | 9/10 | Strong — assertions specific-valued, mocks minimal+appropriate, no skips/flake, DB clones seeded | 1 advisory `toBeTruthy` (documented row-preservation check) |
| 4. Release Gate Readiness | 8/10 | Good — CI runs test+lint+typecheck+security; migrations auto-run | No explicit migration rollback/dry-run gate |

**Overall Test-Confidence (min L1-L3):** 9/10 — headline
**Release-Readiness (L4):** 8/10
**Ship-Readiness (min L1-L4):** 8/10
**Average:** 8.75/10

## Recent Additions Assessment (the core question: genuine real-wiring, not mock-only?)

VERDICT: **GENUINE.** All sampled additions hit real DB clones (`openTestTx()`) or the real test Postgres, drive real handlers/services, and assert persisted DB-row state — not just mock return values. 27 of the related test files use `openTestTx()`.

| Test | Wiring | Evidence |
|------|--------|----------|
| `erasure/erasure-routes.test.ts` | REAL | Hono+zValidator+real handlers on `openTestTx` db; asserts `persons.firstName === ERASED_MARKER` post-approve; RBAC 403, 400, 404 paths |
| `erasure/erasure-engine.test.ts` | PURE (honest) | Labeled PURE; injects target fakes + audit spy to test destructive invariants (dry-run default, legal-hold block, anonymize-not-delete, idempotent). Correct isolation — DB-path covered by routes/service tests |
| `erasure/erasure-service.test.ts` | REAL | DB-backed service lifecycle |
| `erasure/erasure-legalhold.test.ts` | REAL (integration) | Real `placeLegalHold`/`releaseLegalHold` + `approveErasure`; asserts subject kept while held, anonymized after release |
| `legal-hold/legal-hold.test.ts` + `-routes.test.ts` | REAL | DB-backed store + route wiring |
| `person|patient|clinical|imaging erasure.facade.test.ts` | REAL (DB-backed) | Assert every PII field nulled, row preserved, idempotent, unknown-id no-op |
| `retention/retention-legalhold.test.ts` | REAL (integration) | Seeds clinical chain, places hold on owning Person, asserts attachment candidate flips `legalHold:true` |
| `dental-visit/gap-001-localid.test.ts` (+ dental-patient-sync) | REAL (DB-backed ×8) | Real handlers via Hono; asserts BOTH response body AND `db.select(...).localId` for visit/chart/treatment/invoice; covers omitted→NULL path. Catches validator-strip AND repo-persist |

One mock-using file — `retention/jobs/jobs.test.ts` — mocks repo+engine, but **appropriately**: it's a cron-registration unit test verifying scheduling wiring; the engine has its own DB-backed tests. APPROPRIATE, not OVER_MOCKED.

## Layer 3 Detail
- **Assertion strength:** STRONG-dominant. Specific values (`toBe(403)`, `toBe('anonymized')`, `toBe(ERASED_MARKER)`, `toBeNull()`, per-target count `toEqual(arrayContaining(...))`). One advisory `toBeTruthy()` (`patient-erasure.facade.test.ts:42`) is a documented row-preservation existence check alongside strong redaction asserts — acceptable.
- **Probe-skip / brokenness-assertion (§6.6):** 0 occurrences. `anti_coverage_items`: none.
- **Skipped/flaky (§6.3):** 0 `.skip/.todo/xit/xdescribe`; no sleeps/retries in audited set.
- **Mocks:** 1 appropriate (cron). No DB-mock-with-test-db-available offenders.
- **Data stability:** seeded via `openTestTx` rollback + fixtures (`seed-clinical-chain`); deterministic namespaced UUIDs.
- **SUT-binding (§6.5):** `n/a` for this set (backend handler/service tests, not `@testing-library` component tests) → no L3 cap.

## Loading-State Hygiene (§4.5 — engine v4+ present, v5)
- UI-typed components: 119 · analyzed: 38 · **violators: 0** · coverage **1.00** (≥0.95) → **no L1 cap.**
- **loading_state_hygiene violations: 0.**

## Cross-Layer Consistency
No inconsistencies. L1≈L2≈L3 (9/9/9); L4 (8) within tolerance. Test-Confidence (9) is strong; Ship-Readiness (8) gated only by the missing migration rollback/dry-run gate, not test quality.

## Unverified (R1)
**Unverified node count: 0.** No layer signal was derived from a low-confidence or non-graph-anchored `CODE_*` node — all backend signals read directly from test/source files (HIGH), and the FRESH engine map reports `fields_unavailable: []`.

## Prioritized Action Plan
### P0 — none
### P1 — none
### P2
- Add migration rollback/dry-run gate to CI to lift L4 (Ship-Readiness).
- Emit a coverage artifact (`coverage/`) so L1 line-% is measurable rather than assertion-inferred.
### P3
- `patient-erasure.facade.test.ts:42` — tighten `toBeTruthy()` to `toBe(PID)` for symmetry (cosmetic).

## What's Next
- No P0/P1 → GATE PASS for this dimension. Re-run after backend enters engine scope to populate FE→BE edge density / SUT-binding on any new frontend tests.
