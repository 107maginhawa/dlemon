# Confidence Dimension — dental-billing

---
oli-version: "1.0"
dimension: confidence
scope: dental-billing
team-size: small
mode: --module dental-billing --auto
date: 2026-05-30
based-on:
  - docs/audits/compliance/dental-billing.md (behavior inventory)
  - docs/audits/codebase-map/CODE_MODULE_MAP.json (structural ground truth: 25 source files, generic framework)
  - docs/audits/CONFIDENCE_REPORT.md (suite-wide L3/L4 signals + CI inventory)
  - 14 test files under services/api-ts/src/handlers/dental-billing/ (read in full)
layers-audited: 1-4 (static analysis)
layers-deferred: 5-6 (CI/CD/runtime evidence)
---

# Confidence Stack Report — dental-billing

## Score Summary

| Layer | Score | Meaning | Top Gaps |
|-------|-------|---------|----------|
| 1. Coverage Integrity | **8/10** | Good — every BR/AC/permission/FSM has meaningful (value-asserting) coverage; only the V-BIL-105 draft-payment FSM edge is untested | draft-payment FSM edge untested; a few `toBeTruthy()` shape checks |
| 2. Behavior Traceability | **8/10** | Good — ~96% of billing behaviors have a STRONG test owner (behavior inventory present → no shallow cap) | DE-017..023 N/A to billing; V-BIL-105 edge has no owning test |
| 3. Test Quality Hardening | **9/10** | Strong — value-specific assertions, real test DB (no over-mock), seeded fixtures, FSM property tests, real-server `app.request` wiring | a handful of existence-only assertions; wall-clock date offsets in overdue tests |
| 4. Release Gate Readiness | **8.75/10** | Strong — full CI (test/lint/type/build/security), deep health, release infra (suite-wide) | no migration down-files (Drizzle convention) |

**Overall Test-Confidence (min L1-L3):** **8/10** — headline test-quality signal
**Release-Readiness (L4):** **8.75/10** — separate release-infra gauge
**Ship-Readiness (min L1-L4):** **8/10** — conservative combined gate (weakest link = L1 coverage)
**Average:** 8.4/10
**Test-Confidence headline (TestConf):** **8**

## Counts (gaps by severity)
- P0: 0
- P1: 1 (untested out-of-FSM draft-payment path — corroborates compliance V-BIL-105)
- P2: 2 (existence-only assertions cluster; wall-clock-dependent overdue tests)
- P3: 0

## Process note
Tool output was intermittently suppressed during this run (empty returns for `echo`/`Read`).
All scoring below is grounded in file contents that WERE successfully read in full earlier in the
session: the 14 dental-billing test files, the compliance behavior inventory, and the aggregate
CONFIDENCE_REPORT.md (which independently confirms the 5/5 CI pipeline and deep health endpoint).
No score was fabricated; layers rest on observed test bodies.

## Test inventory (14 files, all read)
Handler/HTTP suites: `dental-billing.test.ts` (module1, ~60 tests — every handler, 401/400/404/422,
role gates staff_full/dentist_associate/staff_scheduling → 403, dentist_owner not-403),
`dental-billing.edge-cases.test.ts` (module3 — INVALID_AMOUNT, INVOICE_IMMUTABLE,
PAYMENT_EXCEEDS_BALANCE, cross-invoice receipt N-BIL-01 409, NO_BALANCE, installment rounding/bounds,
discount rate bounds, getPatientBalance overdue/active-plan/branch-deny, collections period branches),
`dental-billing.invoice-lifecycle.test.ts` (module2 — FR4.1b overdue sweep incl. idempotency,
FR4.3 plan tracking, FR4.4 balance, FR4.5 collections, FR4.6+EC5 receipts, FR4.10 tax),
`dental-billing.payment-plan-fsm.test.ts` (module4 — full PaymentPlan FSM guard matrix),
`billing-gate-http.test.ts` (BR-009 + BR-011 consent gate, real handler),
`acceptance.billing-payments.test.ts` (AC-PAY-01..05),
`dental-billing-events.test.ts` (DE-007/008/009 audit-row publisher assertions, ADR-006).
Property tests: `invoice.fsm.property.test.ts`, `payment-plan.fsm.property.test.ts` (fast-check).
Repo/unit: `repos/dental-invoice.test.ts`, `repos/dental-payment.test.ts`,
`repos/dental-payment-plan.test.ts` (openTestTx + seedClinicalChain — transactional rollback),
`utils/rounding.test.ts` (banker's rounding, discount/tax math).

## Layer 1 — Coverage Integrity (8/10)
| Rule Class | Items | Meaningfully Covered | Line-only | None | Weight |
|------------|-------|----------------------|-----------|------|--------|
| Auth/permissions | 7 actions + branch scope | 7 (issue/void/discount/plan/payment role gates + branch deny tests) | 0 | 0 | 35% |
| Business rules (BR-009..015) | 7 | 7 (all asserted with specific codes) | 0 | 0 | 30% |
| State transitions | invoice FSM + plan FSM | ~10/11 (plan FSM full matrix; invoice issue/void/pay) — draft-payment edge untested | 0 | 1 | 20% |
| API routes | ~14 endpoints | ~14 (status + body assertions) | few status-only | 0 | 15% |
Auth 100%, BR 100%, FSM ~91% (V-BIL-105 edge), routes ~95%. Raw ≈ 9.0; held at 8 because the
out-of-FSM draft→paid path (compliance V-BIL-105) has no negative test and a few assertions are
existence-only (`toBeTruthy`). No billing TDD_PROOF.md found → no +1 test-first bonus applied here.

## Layer 2 — Behavior Traceability (8/10)
Behavior inventory present (docs/audits/compliance/dental-billing.md) → NOT shallow-capped.
Every BR-009..015, AC-BIL-001..005 / AC-PAY-01..05, all 7 permission gates (deny+allow pairs),
both FSMs, and the DE-007/008/009 audit-row events have a named STRONG test owner. Idempotency
(N-BIL-01) and cross-invoice receipt-reuse have dedicated owners. Sole untraced behavior: the
draft-payment rejection (doesn't exist in code yet → cannot be owned). ~96% owned → band → 8 (held
under 9 by the missing edge owner + absence of a billing-specific proof artifact).

## Layer 3 — Test Quality Hardening (9/10)
- Assertion strength: STRONG-dominant — specific status codes (`toBe(422)`), specific error codes
  (`code).toBe('PAYMENT_EXCEEDS_BALANCE')`), specific money values, FSM property invariants.
  Minor existence-only checks (`expect(body.id).toBeTruthy()`, `Array.isArray(...).toBe(true)`).
- Mocks: APPROPRIATE — handlers/repos run against the real `monobase_test` DB; no DB mocking.
  Logger is a no-op stub (acceptable). Repo tests use `openTestTx` transactional rollback.
- Flake/stability: STABLE — no `.skip`/`.only`, no retries, no `setTimeout`. Note: overdue/plan
  tests use wall-clock `Date.now()` offsets (commented as required for DB date comparison) —
  defensible but time-relative (P2).
- Data: SEEDED — suite-unique branch/member IDs (a02/a04/a07/ab1/be) avoid cross-suite unique-index
  collisions; `onConflictDoNothing` + per-test truncate/rollback. Some hardcoded deterministic UUIDs
  (namespaced, intentional).

## Layer 4 — Release Gate Readiness (8.75/10, suite-wide)
Per CONFIDENCE_REPORT.md (independently verified suite-wide): CI = 5/5 (test/lint/typecheck/build/
security across quality + contract + postgres-services + openapi-drift + release workflows);
deep health (`/livez` + `/readyz` checking DB/storage/jobs); VERSION + CHANGELOG + tag-triggered
release.yml. Migration rollback down-files absent (Drizzle convention) — the only L4 gap.

## TDD Proof Verification
No `docs/execution/slices/*/TDD_PROOF.md` referencing dental-billing was located (execution dir
unconfirmed this run). Per skill rule, proof verification skipped — no L1/L2 adjustment. (If a
billing slice spec exists without a proof, L2 would cap at 5 for that slice; none confirmed.)

## Cross-Layer Consistency
L1(8) ≈ L2(8); L3(9) within 1 of L1/L2; L4(8.75) within 1. No inconsistency flagged.

## Prioritized Action Plan
### P1 — Fix Before Major New Work
- Add a negative test: recording a payment on a `draft` invoice must be rejected
  (`INVALID_STATUS_TRANSITION`). Tracks compliance V-BIL-105; currently the FSM edge is untested
  AND unenforced. File: dental-billing.edge-cases.test.ts (new case) + handler guard.
### P2 — Fix When Touching
- Upgrade existence-only assertions (`toBeTruthy()`, `Array.isArray(...)`) to value/shape assertions
  in createDentalInvoice/createDentalPaymentPlan success paths.
- Replace wall-clock `Date.now()` offsets in overdue/plan-behind tests with injected/fixed clock for
  determinism (invoice-lifecycle.test.ts, edge-cases.test.ts).

## What's Next
Re-run after the V-BIL-105 guard + test land: `/oli-check --confidence --module dental-billing --layer 1`.
Consumed by `/oli-check --traceability` and the graduation check.
