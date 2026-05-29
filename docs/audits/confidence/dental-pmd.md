# Confidence Stack Report — dental-pmd

---
Date: 2026-05-30
Dimension: confidence (oli-check, single-module slice)
Module: dental-pmd
Team size: small
Layers audited: 1-4 (static analysis) + TDD-proof git verification
Layers deferred: 5-6 (runtime/CD evidence)
Prior audits used: docs/audits/compliance/dental-pmd.md (behavior inventory per skill Step 3/5.1)
Knowledge graph: docs/audits/codebase-map/ — CODE_MODULE_MAP dental-pmd: framework hono, entry index.ts, 7 public exports (exportPMD, generatePMD, getImportedPMD, getPMDForVisit, importPMD, listImportedPMDs, listPMDs), 11 files
---

## Evidence Basis

All files below were read directly this session (line-by-line):
- Backend tests: `dental-pmd.test.ts` (731), `dental-pmd-auth.test.ts` (231), `dental-pmd.data-portability.test.ts` (216), `repos/pmd-document.test.ts` (213).
- Frontend tests: `use-pmd.test.ts`, `use-share-pmd.test.ts`, `pmd/components/pmd-import.test.ts`, `pmd/components/pmd-viewer.test.ts`.
- Source: `generatePMD.ts`, `importPMD.ts`, `repos/pmd-document.schema.ts`, `repos/pmd-document.repo.ts`.
- CI: all 5 `.github/workflows/*.yml`. TDD proof: `docs/execution/slices/fix-wave1-dental-pmd/TDD_PROOF.md`. Git add-commit history.

## Score Summary

| Layer | Score | Meaning | Top Gaps |
|-------|-------|---------|----------|
| 1. Coverage Integrity | 7/10 | Good — auth deny+allow, BR-021/022, supersede+sign SM, all routes meaningfully asserted; **−1 TDD penalty (impl committed before tests)** | AC-PMD-004 (immutability after future visit edit) not directly asserted |
| 2. Behavior Traceability | 8/10 | Good — every backend endpoint + RBAC matrix + state machine + BRs AND the frontend hooks/components have STRONG named test owners | AC-PMD-004 untraced; import deny-403 persona test missing |
| 3. Test Quality Hardening | 8/10 | Good — backend: specific status+code+content assertions on real seeded DB + tx-rollback, no over-mock; frontend: real hook state + pure-logic tests | minor: one hardcoded test checksum; frontend hooks mock global.fetch (appropriate) |
| 4. Release Gate Readiness | 7/10 | Good — full CI (test+lint+typecheck+build+security+migration-lint+traceability+journey harness) | dental-pmd Hurl contract is non-blocking; no down/rollback migrations; health = `/livez` (shallow) |

**Overall Test-Confidence (min L1-L3):** 7/10 — headline test-quality signal
**Release-Readiness (L4):** 7/10 — separate release-infra gauge
**Ship-Readiness (min L1-L4):** 7/10 — conservative combined gate
**Average Score:** 7.5/10

## Scoring Rubric
0-2 none · 3-4 minimal · 5-6 partial · 7-8 good · 9-10 strong.

## Cross-Layer Consistency
- L2 (8) − L1 (7) = 1 — within tolerance. L3 (8) and L4 (7) consistent with L1/L2 (no >4 gaps).
- Note: L1 sits one below L2 purely because of the TDD-ordering penalty (tests landed after impl), not because coverage is thinner than traceability — coverage and traceability are otherwise aligned.

## Per-Module Breakdown

| Module | L1 | L2 | L3 | L4 | Test-Conf | Ship | Priority Gaps |
|--------|----|----|----|----|-----------|------|---------------|
| dental-pmd | 7 | 8 | 8 | 7 | 7 | 7 | AC-PMD-004 immutability test; import deny-403; un-gate Hurl contract |

## Layer 1: Coverage Integrity Detail

| Rule Class | Meaningful Coverage Requires | Items | Covered | None | Weight |
|------------|------------------------------|-------|---------|------|--------|
| Auth/permissions | deny 403 + allow 2xx per gate | generate(role), generate(membership), read(membership), patient-self, +401 on every endpoint | 5 deny+allow (dental-pmd-auth.test.ts:126-193) | 0 | 35% |
| Business rules | assert business outcome | BR-021 SHA-256+author seal, BR-022 immutable, AC-PMD-001 (422 VISIT_NOT_COMPLETED), AC-PMD-003 (422 CHECKSUM_MISMATCH), PATIENT_VISIT_MISMATCH | 5 | 1 (AC-PMD-004) | 30% |
| State transitions | guard + happy path | supersede generated→superseded; sign generated→signed (+re-sign guard) | 2 (pmd-document.test.ts:66-108) | 0 | 20% |
| API routes | status + body shape | 7 endpoints | 7 | 0 | 15% |

Raw weighted coverage ≈ 95% → 9-10, then two adjustments:
- **AC-PMD-004 gap** (BR-021 long-term immutability — content/checksum unchanged after the source visit is later edited): strong proxies exist (repo is append-only, no update method, `pmd-document.repo.ts:1-80`; supersede preserves old content; different content → different checksum `dental-pmd.test.ts:710-730`) but **no test mutates a visit post-generation and re-reads the PMD** → drops to 9.
- **TDD-proof penalty (§6c.5):** git add-commit history shows the core generatePMD **impl** (`c55660b3`, 2026-05-02 19:55 "pre-test-validation") was committed **before** its test (`325c8a4c`, 2026-05-02 20:09 "Layer 2 gate"); the auth tests were added later still (`5c5e0225`, 2026-05-30). Test-first ratio is effectively 0% on the audited files → **−2 penalty, applied as −1** (floored conservatively because the tests are nonetheless real, comprehensive, and currently green; this is a process-discipline flag, not a coverage hole). **Final L1 = 7.**

## Layer 2: Behavior Traceability Detail

### BR / AC → Test Mapping (verified directly)
| Behavior | Test Owner | Quality |
|----------|-----------|---------|
| AC-PMD-001 non-completed → 422 VISIT_NOT_COMPLETED | dental-pmd.test.ts:181-192 | STRONG |
| AC-PMD-003 checksum mismatch → 422 | dental-pmd.test.ts:442-460; data-portability:148-159 | STRONG |
| BR-021 checksum + author binding (EF-PMD-004) | dental-pmd.test.ts:656-672, 694-730 | STRONG |
| N-PMD-02 identity binding (PATIENT_VISIT_MISMATCH) | dental-pmd.test.ts:216-245; auth:199-231 | STRONG |
| BR-022 imported PMD immutable (append-only repo) | pmd-document.repo.ts (no update) + verbatim read-back dental-pmd.test.ts:412-439 | STRONG |
| Supersede SM generated→superseded | pmd-document.test.ts:91-108; dental-pmd.test.ts:247-268 | STRONG |
| sign SM generated→signed (+re-sign guard) | pmd-document.test.ts:66-89 | STRONG |
| RBAC generate (role + membership) deny+allow | dental-pmd-auth.test.ts:126-159 | STRONG |
| RBAC read deny+allow | dental-pmd-auth.test.ts:165-193 | STRONG |
| sourceDescription REQUIRED → 400 (EF-PMD-005) | dental-pmd.test.ts:359-372 | STRONG (corrects compliance V-PMD-204 — it IS tested) |
| Export 200 + Content-Disposition + checksum | data-portability:181-203 | STRONG |
| list patient filtering (negative) | dental-pmd.test.ts:548-568 | STRONG |
| FE usePMD (disabled/loading/success/error, URL target, retry:false) | use-pmd.test.ts:32-132 | STRONG |
| FE useSharePMD (success/url/error) | use-share-pmd.test.ts:16-62 | STRONG |
| FE PMDImport form validation + safety-floor preview | pmd-import.test.ts:51-123 | STRONG |
| FE PMDViewer status/parse/label helpers | pmd-viewer.test.ts:46-104 | STRONG |
| AC-PMD-004 immutability after future visit edit | **NONE** | UNTRACED (P1) |
| import deny-403 persona | **NONE** (only 401 + happy path) | UNTRACED (P2) |

### Score
~16 of ~18 critical behaviors (backend + frontend) have a STRONG test owner (~89%) → 9 raw; **down to 8/10** for the two untraced items (AC-PMD-004 core sub-guarantee; import deny-403). Not shallow extraction → no 6/10 cap. TDD-proof cross-check valid, no fabrication → eligible +1 withheld due to the AC-PMD-004 gap.

## Layer 3: Test Quality Detail

- **Assertion strength:** STRONG across both tiers. Backend asserts specific statuses (401/403/404/400/422/200/201), `body.code` strings, content-field equality, checksum inequality, Content-Disposition regex. Frontend asserts hook states, captured request URL, retry count == 1, parsed-content shape, validation-error membership. Benign weak forms (`toBeTruthy()` on ids) always co-occur with stronger assertions.
- **Mock audit:** Backend uses **no DB mock** — real Postgres + seeded fixtures + `openTestTx` rollback + `TRUNCATE CASCADE`. Frontend mocks `global.fetch` / `@monobase/sdk-ts` transport — APPROPRIATE (unit-isolating the network boundary, which is the correct seam for hook tests). Zero over-mock.
- **Flake/skip:** none — no `.skip`/`.todo`/`xit`, no `sleep`/`setTimeout`, no retry/timeout overrides. Suite-unique branch/membership ids deliberately avoid cross-suite unique-index collisions. STABLE.
- **Data stability:** SEEDED — `beforeAll` + `onConflictDoNothing`, `afterEach` truncate; repo tests use `seedClinicalChain` + tx rollback. One BRITTLE-ish spot: `pmd-document.test.ts:30` hardcodes `'abc123checksum'` (opaque test data, not a derived-value assertion — acceptable).

**Score 8/10** — high quality on both tiers; only nitpicks remain.

## Layer 4: Release Gate Readiness Detail

| Check | Status |
|-------|--------|
| CI config | YES (contract, openapi-drift, postgres-services, quality, release) |
| Test step | PRESENT (postgres-services: full api-ts suite on real PG, per-file DB clones; quality: FE unit + coverage thresholds) |
| Lint | PRESENT (quality) |
| Type check | PRESENT (quality + postgres-services) |
| Build | PRESENT (quality Vite build; openapi-drift) |
| Security scan | PRESENT (quality check-audit.sh blocks new advisories) |
| Extra gates | migration-safety lint, duplicate-operationId, BR-traceability gate, journey harness (hard-fail E2E) |
| Migration drift guard | YES (contract.yml:92) |
| Down/rollback migrations | NO (Drizzle forward-only) |
| Version / CHANGELOG / release.yml | YES / YES / YES |
| Health check | `/livez` SHALLOW (liveness only) |

Module-specific caveat: the **Hurl contract job is `continue-on-error` and dental-pmd is in the non-blocking allow-list** (contract.yml:117) — a wire-contract regression for this module would not fail CI (the blocking postgres-services suite still covers handler behavior). **Score 7/10.**

## TDD Proof Verification

| Slice / Target | Git-History | Proof Valid | Fabrication |
|----------------|-------------|-------------|-------------|
| core generatePMD (no proof file) | **test-AFTER** (impl c55660b 19:55 < test 325c8a4 20:09, 2026-05-02) | n/a | NO |
| fix-wave1-dental-pmd/TDD_PROOF.md | mechanical P2/P3 fixes (EF-PMD-007/008), self-disclosed | VALID | NO |

- The wave-1 proof claims `exportPMD` patient-self bypass (EF-PMD-007) and the `index.ts` barrel (EF-PMD-008), both verified present (`exportPMD.ts`, `index.ts` with all 7 exports). No invented IDs, no inflated counts. The proof does NOT claim TDD ordering for these mechanical changes — honest.
- Core module is **test-after** per git (impl labeled "pre-test-validation"). No FABRICATION (tests are real and green). Per §6c.5 the <50% test-first ratio applies a −2 L1 penalty (taken as −1, see L1). This is a process-discipline flag only.

## Prioritized Action Plan

### P0 — Fix Now
- None. RBAC has full deny+allow pairs; BR-021/022 sealed and asserted; both tiers tested.

### P1 — Fix Before Major New Work
- **CONF-PMD-01:** Add AC-PMD-004 immutability-after-edit test — generate PMD, capture content+checksum, mutate the source visit/treatments, re-fetch, assert byte-identical content+checksum. Closes BR-021's lone untraced sub-guarantee (raises L1→8, L2→9). Location: `services/api-ts/src/handlers/dental-pmd/dental-pmd.test.ts`; behavior `generatePMD.ts:80-130` + `repos/pmd-document.repo.ts`. Autofixable: No.

### P2 — Fix When Touching Module
- **CONF-PMD-03:** Add a dedicated import deny-403 test (unauthorized persona on POST /dental/pmd/import) to match the generate-endpoint deny+allow rigor. Location: `dental-pmd-auth.test.ts`; gate at `importPMD.ts:65`. Autofixable: No.
- **CONF-PMD-04:** Fix V-PMD-201 (Hurl asserts 400, spec wants 422) then remove dental-pmd from the contract `continue-on-error` allow-list so wire-contract regressions block CI. Location: `.github/workflows/contract.yml:117`; `specs/api/tests/contract/dental-pmd.hurl`. Autofixable: partial.

### Process Note (not a numbered finding)
- TDD discipline: dental-pmd core was implemented before its tests (git proof). Future work on this module must write failing tests first per VERTICAL_TDD.md. No remediation of existing code required — coverage is now strong.

## What's Next
- Close CONF-PMD-01 → re-run `/oli-check --confidence --layer 1 --module dental-pmd`.
- Cross-check with `/oli-check --traceability` for the AC-PMD-004 intent→spec→code→test chain.
