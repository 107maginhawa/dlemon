# Confidence Report — emr-consultation

---
Audit Date: 2026-05-30
Dimension: confidence (oli-check, Layers 1-4 static)
Module: emr-consultation (handler dir `services/api-ts/src/handlers/emr/`, namespace `/emr`)
Team size: small
Behavior inventory source: `docs/audits/compliance/emr-consultation.md` (2026-05-30) — canonical (Layer 2 uncapped, not shallow extraction)
Knowledge graph: docs/audits/codebase-map/ (module `emr` confirmed in CODE_MODULE_MAP; no separate "emr-consultation" node)
Evidence basis: ALL 7 test files read in full at assertion level (not sampled). Findings below cite exact lines.
---

## Score Summary

| Layer | Score | Meaning | Top Gaps |
|-------|-------|---------|----------|
| 1. Coverage Integrity | 7/10 | Good — most critical behaviors covered | PHI audit-logging path line-coverage-only (no audit-row/tenant-sentinel assertion); admin read-one & listEMRPatients-admin uncovered |
| 2. Behavior Traceability | 7/10 | Good — BRs/endpoints/states owned across integration + E2E + repo + facade; PHI-audit + admin grants untraced | 6 PHI audit-logging ops have no asserting owner; admin grants untraced |
| 3. Test Quality Hardening | 8/10 | Good — real app + real Postgres, zero mocks, no flake, mostly strong assertions; dragged by one tautological FSM file | FSM "property" test asserts a local copy of the legacy machine against itself (zero production coupling) |
| 4. Release Gate Readiness | 6/10 | Partial — CI solid; migration rollback + deep health + security scan missing | No down/rollback migrations or dry-run; shallow health; no security scan |

**Overall Test-Confidence (min L1-L3):** 7/10 — headline test-quality signal
**Release-Readiness (L4):** 6/10 — separate release-infra gauge
**Ship-Readiness (min L1-L4):** 6/10 — conservative combined gate (weakest link = L4)
**Average Score:** 7.0/10

Per-layer headline: `L1=7 L2=7 L3=8 L4=6; TestConf=7`

## Test Inventory (all 7 files read in full)

| Test file | LOC | Type | Coverage role |
|-----------|-----|------|---------------|
| `handlers/emr/emr.handlers.test.ts` | 286 | unit (mostly DB-free) | error-class statuses, "handler is a function" smoke, CONSULTATION_NOT_DRAFT message shape, type/schema contracts. NOTE: does NOT call handlers against a DB; the function-export tests use a stub that throws. Real handler behavior lives in emr-coverage + E2E. |
| `handlers/emr/emr-coverage.test.ts` | 624 | integration (real Postgres via openTestTx) | THE workhorse: all 6 handlers, auth 401/403, create 201/400/404/409-ish, get owner/patient/wrong-user, list provider/admin/patient + filters + pagination, update happy/null/finalized-422, finalize happy/422/403, FSM chain |
| `handlers/emr/consultation-note.fsm.property.test.ts` | 99 | unit (fast-check) | **tautological** — see CONF-EMRC-002 |
| `handlers/emr/getConsultation.expand.test.ts` | 111 | integration | expand=none/patient,provider/patient,provider,person — STRONG nested-value assertions |
| `handlers/emr/repos/emr.repo.test.ts` | 111 | integration (repo) | createDirect draft, dup-context reject, finalizeNote draft→finalized, findByPatient, getConsultationStats |
| `handlers/provider/repos/provider-emr.facade.test.ts` | 86 | integration | provider resolve by id / by person id / unknown→null + with-person variant |
| `tests/e2e/emr/emr.test.ts` | 435 | E2E (real server, real auth signup) | full lifecycle over HTTP: create variants, get owner/patient/cross-patient-403/404, update owner/patient-422/finalized-422, finalize 200/422/patient-422, list+filters+pagination+cross-patient-403, idempotency, full workflow |

Frontend (`apps/dentalemon/src`): no emr/consultation consumer or unit test (platform/telemedicine module not surfaced in the dental web app). The three dental web E2E specs do not cover emr. No frontend confidence to score.

Test runner: Bun test. Coverage tool: none configured → coverage assessed by behavior mapping per Layer 1 semantics, not a line-% report.

## Layer 1 — Coverage Integrity (7/10)

### "Covered" definition per rule class
| Rule Class | Items | Meaningfully Covered | Line-Only | None | Class % | Weight |
|------------|-------|----------------------|-----------|------|---------|--------|
| Auth/permissions | 8 gates | 6 | 0 | 2 (admin read-one, admin listEMRPatients) | 75% | 35% |
| Business rules | 6 (BR1-6) | 5 | 0 | 1 (BR6 = non-behavioral "no FK" invariant) | 83% | 30% |
| State transitions | ~4 edges/guards | 3 | 1 (legacy repo table only "covered" by a self-referential local copy) | 0 | 75% | 20% |
| API routes | 6 endpoints | 6 (integration + E2E, status + body shape) | 0 | 0 | 100% | 15% |

Score = 0.35·75 + 0.30·83 + 0.20·75 + 0.15·100 = 81.2 → **8 raw**, held at **7/10** by the audit-logging caveat below.

**Audit-logging rule class — line-coverage-only (the L1 drag).** All 6 PHI operations execute `logAuditEvent` as a side effect under emr-coverage + E2E, but a full grep of all 7 test files for `audit`/`logAuditEvent`/`tenant`/`EMR_AUDIT_TENANT_SENTINEL` returns ZERO matches. No test asserts (a) an audit row is written, (b) `tenant_id === EMR_AUDIT_TENANT_SENTINEL` rather than the patient UUID (the V-EMR-005 fix, rated 10/10 in compliance), or (c) update logs field NAMES only. Per Layer 1 "fix-the-ruler" semantics these are 0% covered. This is why L1 is held at 7, not 8.

TDD-proof adjustment: no `docs/execution/slices/*/TDD_PROOF.md` references emr/consultation. Step 6c skipped — no L1 bonus/penalty.

## Layer 2 — Behavior Traceability (7/10)

Denominator = 6 BR + 8 permission-gates + 4 state edges + 6 endpoints + 6 audit-ops = **30 behaviors** (compliance doc canonical → uncapped).

### Traced (≈22)
- BR1-BR5 (5) — emr-coverage.test.ts, emr.repo.test.ts, E2E.
- Permissions (6/8) — create-self (201), create-wrong-provider 403, read-deny-other-provider/patient 403 (E2E cross-patient + coverage wrong-user), finalize-deny 403, patient-owner read 200, admin-list-all 200, list cross-patient 403.
- State (3/4) — draft→finalized happy path (handler + repo + E2E), finalize-non-draft 422, dup-context guard. The 4th "edge" (finalized→amended) is exercised but as the WRONG behavior (see L3/CONF-EMRC-002).
- Endpoints (6/6) — all hit with status + body assertions; real E2E owns the lifecycle.

### Untraced (≈8) — the gaps
1. **6 PHI audit-logging operations** — no asserting owner (line-coverage-only). The module's signature compliance guarantee (V-EMR-005 PHI-id-in-tenant-slot) is verified by static reading only; a regression reintroducing the patient UUID into the tenant slot, or dropping an audit row, would pass the entire suite green. **Highest-value gap.**
2. Admin read-one (`getConsultation`) — no admin allow/deny test (V-EMR-C-003). The only admin path tested is list-consultations (emr-coverage:353).
3. Admin `listEMRPatients` — no admin test; code currently 403s admins (V-EMR-C-002), so the grant is both untraced and unimplemented.

22/30 = 73% → **7/10** (uncapped). The real E2E + repo + facade coverage lifts this above a happy-path-only suite.

### Permission gate deny/allow pairs
| Gate | Deny test | Allow test | Owner |
|------|-----------|-----------|-------|
| read-one (provider) | YES (403 other provider, coverage:288) | YES (owner, coverage:296 / E2E:189) | emr-coverage / E2E |
| read-one (patient) | YES (403 cross-patient, E2E:206) | YES (owning patient, coverage:305 / E2E:198) | emr-coverage / E2E |
| read-one (admin) | NO | NO | — |
| finalize | YES (403 non-owner, coverage:540) | YES (owner, coverage:550 / E2E:287) | emr-coverage / E2E |
| update | YES (403 wrong provider, coverage:454 + 422 finalized) | YES (coverage:478 / E2E:230) | emr-coverage / E2E |
| list (admin) | n/a | YES (coverage:353) | emr-coverage |
| listEMRPatients (provider) | YES (403 no-profile, coverage:401) | YES (coverage:416) | emr-coverage |
| listEMRPatients (admin) | NO | NO (code 403s admins — V-EMR-C-002) | — |

## Layer 3 — Test Quality Hardening (8/10)

- **Assertion strength (40%) ≈ 80% → 8.0.** Predominantly STRONG: specific statuses (`toBe(201/400/403/404/422)`), specific values (`toBe('draft')`, `toBe('finalized')`, `body.patient.id` equality, `body.provider.providerType === 'dentist'`, `code === 'CONSULTATION_NOT_DRAFT'`), nested expand values, null-clear semantics. WEAK / problematic instances:
  - **`consultation-note.fsm.property.test.ts` (whole file)** — see CONF-EMRC-002. Tautological; counts as ~0 real assertions toward strength despite 99 LOC.
  - A cluster of `expect(res.status).toBeGreaterThanOrEqual(400)` smoke checks in emr-coverage (e.g. :178, :266, :475, :514, :572, :604) — acceptable as coverage probes but weaker than exact-status; the precise status is asserted elsewhere (E2E), so net OK.
  - `Array.isArray(body.data)).toBe(true)` / `length >= 1` list-existence checks — existence-leaning but paired with `.every(c => c.status === 'draft')` content checks, so net STRONG.
- **Mock appropriateness (20%) → 10.** Zero mocks across all 7 files; integration + repo + E2E all use the real Hono app/server and real Postgres via openTestTx (auto-rollback) and real signup. Ideal for a PHI module.
- **Flake (20%) → ~9.5.** No `.skip/.todo`, no sleeps/retries. Two `30000`ms `beforeAll/beforeEach` timeouts in the E2E (signup/profile setup) — justified for real-auth E2E, not flake markers. STABLE.
- **Data stability (20%) → ~9.5.** Per-test `openTestTx` rollback + seed factories; hardcoded UUIDs are deliberate fixed test fixtures in rolled-back txns (acceptable). E2E uses faker + fresh signups. SEEDED.

Score = 0.40·8.0 + 0.20·10 + 0.20·9.5 + 0.20·9.5 = 9.0 → held at **8/10**: the 99-LOC tautological FSM file is not a quality-neutral omission, it is an actively misleading test that would pass while the production machine is correct OR broken — it provides false confidence and documents the wrong spec. That warrants a one-point quality deduction.

## Layer 4 — Release Gate Readiness (6/10)

### CI Pipeline (35%) — 4/5 present → 8.0
| Check | Status | Workflow |
|-------|--------|----------|
| CI config | YES | `.github/workflows/` (contract, openapi-drift, postgres-services, quality, release) |
| Test step | PRESENT | postgres-services.yml (`bun test`) + contract.yml (Hurl + Schemathesis) |
| Lint step | PRESENT | quality.yml |
| Type check | PRESENT | quality.yml (tsc + TypeSpec compile) |
| Build step | PRESENT (proxy) | TypeSpec compile + typecheck (no separate app build) |
| Security scan | ABSENT | no Snyk/Trivy/CodeQL/`bun audit` step |

### Migration safety (25%) — 0/2 → 0.0
Forward `.sql` migrations exist (Drizzle, forward-only); no down/rollback files and no migration dry-run in CI.

### Version management (20%) — 3/3 → 10.0
VERSION ✓, CHANGELOG.md ✓, release.yml ✓.

### Health check (20%) — SHALLOW → 5.0
A health handler exists under `services/api-ts/src/handlers/shared/` but does not probe DB/cache/dependencies. Shallow.

Score = 0.35·8.0 + 0.25·0.0 + 0.20·10.0 + 0.20·5.0 = 5.8 → **6/10**.

## TDD Proof Verification

No `docs/execution/slices/*/TDD_PROOF.md` references emr/consultation — proof verification skipped. No L1/L2 adjustments. Module has no SLICE_SPEC.md, so the "no-proof-for-spec'd-slice" L2 cap does not apply.

## Cross-Layer Consistency

- L1 (7) = L2 (7) — consistent; the audit-logging line-coverage-vs-no-owner pattern drives both.
- L3 (8) within 1 of L1/L2 — no flag; quality and breadth are aligned.
- L4 (6) does not exceed L1-L3 → no release-ahead-of-tests flag.

## Unauditable Items
| Item | Reason | Manual check |
|------|--------|--------------|
| Live pass/fail of suite | static audit | `cd services/api-ts && bun test src/handlers/emr` and `bun test tests/e2e/emr` |
| Whether audit rows truly use the sentinel at runtime | no test asserts it | implement CONF-EMRC-001 |

## Prioritized Action Plan

### P0 — Fix Now (PHI / data-integrity test gap)
- **CONF-EMRC-001**: Add audit-row assertions for all 6 EMR PHI operations. After each create/read/update/finalize/list, query the audit table and assert (a) a row with the expected `action` exists, (b) `tenant_id === EMR_AUDIT_TENANT_SENTINEL` (NOT the patient UUID — locks the V-EMR-005 fix), (c) update logs field NAMES only. New `emr-audit.test.ts`; subjects `createConsultation.ts:110`, `getConsultation.ts:90`, `updateConsultation.ts:99`, `finalizeConsultation.ts:93`, `listConsultations.ts:131`, `listEMRPatients.ts:99`. Confirmed by full-suite grep: ZERO audit assertions exist today. Module's top compliance guarantee with zero asserting coverage.

### P1 — Fix Before Major New Work
- **CONF-EMRC-002**: `consultation-note.fsm.property.test.ts` is a 99-LOC TAUTOLOGY with zero production coupling. It defines a *local copy* of the legacy transition map (`finalized: ['amended']`, `amended: ['finalized']`, lines 25-29) and asserts that local copy against itself (`declared === computed`, line 42-43; and lines 68-87 hard-assert the legacy edges). It never imports or calls the production `validateStatusTransition` in `emr.repo.ts:183-198`. Worse, lines 83-87 assert "finalized↔amended cycle is valid" — actively documenting compliance bug V-EMR-C-001 as correct. Rewrite to (a) import the REAL `validateStatusTransition`/`ConsultationNoteRepository` and (b) assert the SPEC-terminal machine: `finalized` and `amended` have NO outgoing transitions. Until then this file gives false confidence and would block the V-EMR-C-001 fix.
- **CONF-EMRC-003**: `emr-coverage.test.ts:580-605` ("FSM state machine chain") drives `finalized→amended` via `repo.updateOneById` and treats it as a valid step, asserting only that the *handler* rejects re-finalize. This affirms the legacy machine at the repo layer. Once the spec-terminal machine is enforced, this test must be updated to assert `finalized→amended` is itself rejected (the repo should not permit the transition).
- **CONF-EMRC-004**: Add admin permission tests — admin read-one (`getConsultation`) and admin `listEMRPatients`. The latter is RED-by-design until the handler gains an admin branch (V-EMR-C-002) — the desired TDD signal. Today admin coverage exists only for list-consultations.

### P2 — Fix When Touching Module
- **CONF-EMRC-005**: Add a `patient-emr.facade` test (patient side) mirroring the existing `provider-emr.facade.test.ts`; the patient-side emr boundary facade has no test owner.

### P3
- **CONF-EMRC-006** (release infra): add migration dry-run, a deep health check (DB ping) in `handlers/shared/health`, and a CI security-scan step (`bun audit`/Trivy). Raises L4.

## What's Next
- Land CONF-EMRC-001 first → re-run `/oli-check --confidence --module emr-consultation --layer 2`.
- CONF-EMRC-002/003 are paired: the FSM unit test and the repo-chain integration test both currently enshrine the legacy machine; fix together with compliance V-EMR-C-001.
- Non-owning-patient read/list deny is already covered (E2E:206, :371) — no finding needed there.
