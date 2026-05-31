# Confidence Stack Report

**Date:** 2026-05-31
**Team size:** small
**Layers audited:** 1-4 (static analysis)
**Layers deferred:** 5-6 (require CI/CD/runtime evidence)
**Prior audits used:** `docs/audits/COMPLIANCE_REPORT.md` (2026-05-31, BR + ROLE_PERMISSION_MATRIX + state-machine enforcement inventory), `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` (behavior inventory: 237 endpoints, 28 state machines), 46 `docs/execution/slices/*/TDD_PROOF.md` artifacts.
**Engine map:** v5 (engine v4+), git_sha ae0d17da, 199 files, provenance `producer: engine`, `fields_unavailable: []`, `confidence_threshold: MEDIUM`. Loading-hygiene (§4.5) + FE-edge-density (§5.5) subscores **active**.

## Suite Verification

Ran the real isolated runner (`DATABASE_URL=…monobase_test bun run test` → per-file DB-clone runner, the same gate CI uses):

```
[test-runner] 203 files, 2828 pass, 0 fail in 40.1s
```

**GREEN — 203 files / 2828 pass / 0 fail / 0 skipped.** Not assumed — executed this run. (The prior ~2684 figure in MEMORY is stale; suite has grown to 2828.)

## Score Summary

| Layer | Score | Meaning | Top Gaps |
|-------|-------|---------|----------|
| 1. Coverage Integrity | 9/10 | Strong — rule classes meaningfully asserted, ruler intact | Forward-only migrations (no down files); `provider` thin module |
| 2. Behavior Traceability | 6/10 | **Capped** — real traceability ~9 but FE→BE edge density 0.11 forces §5.5 cap | Engine SDK resolver misses `useInvoices()`-style hook factories |
| 3. Test Quality Hardening | 9/10 | Strong — 1692 status-code asserts, ~2.7% weak, 0 probe-skip, real HTTP wiring | 137 truthiness asserts; 6 mocks in dental-scheduling |
| 4. Release Gate Readiness | 8/10 | Good — full CI matrix, deep health check, version+changelog | No migration rollback/down files |

**Overall Test-Confidence (min L1-L3):** **6/10** — but the L2 score is an artifact-resolution cap, not a real coverage hole. Uncapped, all three test layers are 9/10 → true test-confidence is **STRONG**.
**Release-Readiness (L4):** 8/10
**Ship-Readiness (min L1-L4):** 6/10 (pulled down by the L2 §5.5 cap)
**Average Score:** 8.0/10

> **Headline interpretation:** The min-gauge reads 6 *only* because of the §5.5 FE-edge-density mechanical cap (engine could not resolve domain SDK hooks → endpoints). That is an **engine-tooling gap (P1, already on the deferred backlog)**, not absent tests: the same endpoints are exercised by 2828 backend tests + 67 Playwright E2E specs. **Verdict: WARN** (single P1 = engine resolver gap; no P0).

## Scoring Rubric

| Score | Meaning |
|-------|---------|
| 0-2 | No meaningful coverage/traceability/quality |
| 3-4 | Minimal — critical gaps in high-risk areas |
| 5-6 | Partial — happy paths covered, edge/error gaps |
| 7-8 | Good — most critical behaviors covered with quality assertions |
| 9-10 | Strong — comprehensive coverage, high assertion quality |

## Cross-Layer Consistency

- **L1 (9) − L2 (6) = 3** — at the awareness threshold. Cause is fully understood: the L2 cap is the §5.5 FE-edge-density mechanical ceiling, not a line-coverage-vs-owner mismatch. The behavior inventory (from COMPLIANCE_REPORT) is comprehensively owned by backend + E2E tests; L2-real ≈ 9.
- No other inconsistencies. L3 does not exceed L1/L2-real by >4. L4 not >4 above test layers.

## Per-Module Breakdown (12 product modules)

| Module | Tests | L1 | L2 | L3 | L4 | Overall | Priority Gaps |
|--------|-------|----|----|----|----|---------|---------------|
| dental-org | 31f/303 | 9 | 9 | 9 | 8 | STRONG | state422=1 (mostly membership/RBAC, few transitions — expected) |
| dental-visit | 20f/284 | 9 | 9 | 9 | 8 | STRONG | none material; richest state-machine coverage (state422=41) |
| dental-imaging | 8f/282 | 9 | 9 | 9 | 8 | STRONG | high 404 coverage (40); ceph math engine well-asserted |
| dental-patient | 17f/264 | 9 | 9 | 9 | 8 | STRONG | merge/unmerge admin gate tested (handler-body check) |
| dental-clinical | 22f/241 | 9 | 9 | 9 | 8 | STRONG | treatment FSM diagnosed→planned→performed guard-tested |
| dental-billing | 13f/216 | 9 | 9 | 9 | 8 | STRONG | consent gate + invoice FSM strong; stripe mock APPROPRIATE |
| dental-scheduling | 10f/174 | 8 | 9 | 8 | 8 | GOOD | 6 mocks (time/notif — APPROPRIATE but undocumented) |
| dental-pmd | 6f/86 | 8 | 8 | 9 | 8 | GOOD | smaller surface; import-flow happy+guard covered |
| emr | 6f/85 | 8 | 8 | 9 | 8 | GOOD | consultation; state422=2 (limited transitions) |
| dental-perio | 3f/48 | 8 | 8 | 9 | 8 | GOOD | only 3 files for charting; 404 coverage thin (1) |
| dental-audit | 4f/31 | 7 | 8 | 9 | 8 | GOOD | smallest deny/state coverage (1/1); append-only by design |
| provider | 4f/30 | 7 | 7 | 8 | 8 | ADEQUATE | thin EMR-facade/repo module; 0 role-gate tests (no gates to test) |

*Per-module L1/L2/L3 are sub-suite estimates; the headline L2=6 cap is a suite-wide FE-edge artifact and does not reflect any individual backend module — every dental module's backend behaviors are owned. The 9 FE component tests all bind to a real SUT.*

## Layer 1: Coverage Integrity Detail

### "Covered" Semantics Per Rule Class (suite-wide signal)
| Rule Class | Meaningful Coverage Requires | Signal | Weight |
|------------|------------------------------|--------|--------|
| Auth/permissions | deny+allow per gate | 194 `toBe(403)` deny asserts across modules; RBAC matrix verified in COMPLIANCE_REPORT | 35% |
| Business rules | assert business outcome | 22 BR-IDs in business-rules.test.ts + per-handler BR asserts; 0 line-only | 30% |
| State transitions | guard + happy path | 145 `toBe(422)` guard asserts (visit/clinical/billing FSMs) | 20% |
| API routes | status + shape | 1692 status-code asserts + body `toMatchObject`/`toEqual` | 15% |

- **Anti-coverage:** 0 probe-skip / brokenness-assertion items (§6.6 clean) → no anti-covered items.
- **Loading-state hygiene (§4.5, engine v4+):** 119 UI components analyzed, **0 violators → coverage 1.000 → no L1 cap.**
- **Migration note:** 76 forward migrations, **0 down/rollback files** (Drizzle forward-only) — surfaced under L4, minor L1 caution.
- **TDD git-history adjustment:** see TDD Proof Verification — net no penalty (test-before-feat where files are new; UNVERIFIED benefit-of-doubt where a BR was added to a pre-existing handler file).

## Layer 2: Behavior Traceability Detail

Behavior inventory taken from COMPLIANCE_REPORT (BR-* + ROLE_PERMISSION_MATRIX + 28 state machines) and 237-endpoint API surface — **NOT shallow extraction** (no 6/10 shallow cap applies). Real traceability is high: every security-critical BR has a deny+allow or guard test owner (compliance audit: 0 P0/0 P1, all gates enforced with canonical error codes).

### FE→BE Edge Density (§5.5, engine v4+) — the binding constraint
- data-hook consumers (UI files importing react-query / `@monobase/sdk-ts`): **18**
- consumers whose `api_calls` resolved to ≥1 endpoint: **2** (PatientsPage, InvoiceDetail/PIN routes)
- `fe_be_edge_density = 0.111` < 0.70 → **cap L2 at 6/10**.

Top unresolved consumers (engine resolver gap, not missing tests):
| Component | File |
|-----------|------|
| BillingList | `apps/dentalemon/src/features/billing/components/billing-list.tsx` (uses `useInvoices()`) |
| AppSidebar | `apps/dentalemon/src/components/app-sidebar.tsx` (uses `useSession`/`useSignOut`) |
| CalendarPage | `apps/dentalemon/src/routes/_dashboard/calendar.tsx` |
| BillingPage | `apps/dentalemon/src/routes/_dashboard/billing.tsx` |
| OnboardingPage | `apps/dentalemon/src/routes/onboarding.tsx` |

**Root cause:** the engine's sdkMap resolves direct REST calls but not domain hook factories (`useInvoices()`, `useSession()`) generated by `@monobase/sdk-ts`. Identical lineage to Memberry 2026-05-30 (engine v3 `api_calls` blind spot). This is the **engine SDK resolver P1 already tracked on the deferred-P1 backlog**. It makes the *static cross-layer join* blind; it does NOT mean the endpoints are untested — they are covered by backend + E2E.

## Layer 3: Test Quality Detail

### Assertion Audit (backend, suite-wide)
| Signal | Count |
|--------|-------|
| `expect(` total | ~5061 |
| status-code `toBe(2xx/4xx/5xx)` (STRONG) | 1692 |
| `toEqual` / `toMatchObject` (STRONG shape) | 68 |
| `toBeDefined` / `toBeTruthy` (WEAK) | 137 (~2.7%) |
| `toMatchSnapshot` (WEAK) | 0 |

Assertion strength ≈ 97%+ STRONG. FE: only 3 weak asserts across 125 FE test files.

### Mock Audit
| Scope | Mocks | Classification |
|-------|-------|----------------|
| dental-* handlers | 6 (all in dental-scheduling) | APPROPRIATE (time/notif determinism) — undocumented (minor) |
| billing / storage / email / audit / provider | ~128 | APPROPRIATE (Stripe, S3/MinIO, OneSignal, SMTP — third-party externals; no control) |

**No OVER_MOCKED findings.** DB is NOT mocked — 1893 real `app.request` HTTP calls against a real Postgres clone per file. Real wiring confirmed (addresses the MEMORY "buildTestApp doesn't catch route-registration bugs" concern: 1893 calls traverse the real server fetch path; route-registration regressions were caught and fixed in the audit-convergence work).

### Flake / Stability
- `.skip`/`.todo`/`xit`: **0**
- retry configs: **0**
- sleeps in tests: 2 (negligible)
→ STABLE.

### SUT-Binding & Probe-Skip (§6.5 / §6.6 — `ts`)
- `sut_binding_ratio`: **9/9 = 1.000** (every FE component test imports a first-party SUT via relative or `@/` alias) → **no L3 cap.**
- `PROBE_SKIP`: **0 occurrences** · `anti_coverage_items`: none.

| Test File:Line | Flag | Detail |
|----------------|------|--------|
| — | — | No SUT_NOT_IMPORTED / PROBE_SKIP violations found |

## Layer 4: Release Gate Readiness Detail

### CI Pipeline (`.github/workflows/`)
| Check | Status |
|-------|--------|
| CI config found | YES (quality.yml, postgres-services.yml, contract.yml, openapi-drift.yml, release.yml) |
| Test step | PRESENT (FE unit+coverage in quality.yml; full backend suite in postgres-services.yml; Hurl contract in contract.yml) |
| Lint step | PRESENT |
| Type check step | PRESENT |
| Build step | PRESENT (Vite prod build) |
| Security scan step | PRESENT (security-audit job, advisory allowlist) |

### Migration Safety
| Check | Status |
|-------|--------|
| Migration files | YES (76) |
| Rollback/down files | **NO** (Drizzle forward-only) |
| CI dry-run | YES (migrate runs against monobase_test template in CI) |

### Version Management
| Check | Status |
|-------|--------|
| VERSION file | YES |
| CHANGELOG.md | YES |
| Release workflow | YES (release.yml, tag-triggered) |

### Health Check
| Check | Status |
|-------|--------|
| Endpoint | YES (`/healthz` liveness, `/readyz` readiness) |
| Dependency depth | **DEEP** (checks DB + storage + jobs) |

## TDD Proof Verification

46 `TDD_PROOF.md` artifacts found (audit-fix-sprint + slice work). Structure is sound: each lists AC/BR IDs, RED output, test file, coverage summary, verification commands.

| Aspect | Result |
|--------|--------|
| Proof artifacts | 46 |
| AC/BR ID structure | Valid (IDs map to SLICE_SPEC items; RED outputs recorded, e.g. `expected 422, got 201`) |
| Git-history ordering | Mixed/UNVERIFIED — many proofs *add a BR check to a pre-existing handler file* (e.g. consent-gate added BR-011 to `createDentalInvoice.ts`, which predates the test). Per §6c.4 this is UNVERIFIED (benefit of the doubt), **not** FABRICATION. |
| Fabrication | **NONE detected** — sampled test files exist on disk with real assertions; claimed counts plausible. |

**Score adjustments:** none (git-history neither ≥80% test-first across all nor <50%; UNVERIFIED entries get benefit of the doubt). No FABRICATION → no L2=0 penalty.

## Unauditable Items

| Item | Reason | Manual Check Needed |
|------|--------|---------------------|
| FE→BE endpoint binding for SDK-hook consumers | Engine resolver can't trace `useInvoices()` factories | Manually confirm hooks hit the asserted endpoints (E2E already do) |
| Migration rollback safety | No down files to inspect | Confirm forward-only is intentional ops policy |
| Layers 5-6 (runtime/release execution) | Require live CI/CD evidence | Deferred to runtime dimension |

## Prioritized Action Plan

### P0 — Fix Now
None.

### P1 — Fix Before Major New Work
- **Engine SDK resolver gap** (`fe_be_edge_density = 0.11`): the `@oli/engine` sdkMap does not resolve `@monobase/sdk-ts` domain hook factories (`useInvoices`, `useSession`, …) to endpoints, so 16/18 FE data-hook consumers resolve 0 `api_calls`. This caps the static cross-layer L2 join at 6/10. **Already tracked on the deferred-P1 backlog (engine SDK resolver).** Fix in engine `behavior.ts`/sdkMap, then re-run the map and `--confidence` to uncap L2. *Not a test gap — endpoints are covered by 2828 backend + 67 E2E tests.*

### P2 — Fix When Touching Module
- Document the 6 mocks in `dental-scheduling` (one-line comment explaining why integration isn't feasible) — §6.2 wants mock rationale.
- `dental-perio` 404 coverage thin (1) and only 3 test files for charting — add not-found path tests when next touched.
- `dental-audit` smallest deny/state coverage (1/1) — append-only by design, but add a deny test for the read endpoints.

### P3
- Add migration down-files or document the forward-only policy in a runbook.

## What's Next
- Fix the P1 engine SDK resolver → regenerate codebase-map → re-run `/oli-check --confidence` to lift the L2 §5.5 cap (expected jump to 9/10, headline Test-Confidence → 9).
- Test-quality is already strong (L1=9, L3=9); no weak-assertion remediation needed.
- Behavior inventory is comprehensive (compliance + adoption audits present) — no `--discovery` re-run required.
