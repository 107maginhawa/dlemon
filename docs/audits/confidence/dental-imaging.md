# Confidence Report — dental-imaging

---
Audit Date: 2026-05-30
Dimension: confidence (single-module slice)
Module Audited: dental-imaging
Team size: small
Layers audited: 1-4 (static analysis) + TDD-proof verification
Layers deferred: 5-6 (require live CI/CD/runtime evidence)
Auditor: oli-check confidence dimension
Aligned-to: docs/audits/codebase-map/ (CODE_MODULE_MAP, CODE_API_SURFACE, CODE_DATA_MODEL, CODE_SPEC_TRACE, CODE_STATE_MACHINES, CODE_ROUTE_MAP)
Behavior inventory source: docs/audits/compliance/dental-imaging.md (2026-05-30) — canonical inventory per Step 5.1
---

## Score Summary

| Layer | Score | Meaning | Top Gaps |
|-------|-------|---------|----------|
| 1. Coverage Integrity | 9/10 | Strong — all ACs/BRs/state-machines covered with outcome-asserting tests; +1 not applied (squashed git history → test-first UNVERIFIED, no penalty) | V-IMG-003 cascade-hide untested; image_count untested |
| 2. Behavior Traceability | 9/10 | Strong — every critical behavior maps to a named test owner with STRONG assertions; BR ids embedded as `@BR-` / describe tags; 5 TDD_PROOFs exist | FE error-surfacing (V-IMG-004) untraced at unit level |
| 3. Test Quality Hardening | 9/10 | Strong — 484 expect() across 7 files, ZERO weak assertions, ZERO skips, ZERO sleep/retry, 2 FSM property tests, real-DB integration suite | minor: a few `not.toBeNull()` existence checks alongside the value asserts |
| 4. Release Gate Readiness | 8/10 | Good — 10-job quality pipeline incl. real-postgres journey gate, security audit, migration-safety, traceability; contract+drift+release present | no VERSION file; security audit is `continue-on-error` in contract.yml (blocking in quality.yml); perf-ratchet disabled |

**Overall Test-Confidence (min L1-L3):** 9/10 — headline test-quality signal
**Release-Readiness (L4):** 8/10 — separate release-infra gauge
**Ship-Readiness (min L1-L4):** 8/10 — conservative combined gate
**Average Score:** 8.75/10
**Test-Confidence (composite):** 9/10

## Layer 1 — Coverage Integrity (9/10)

Rule-class coverage from the compliance inventory + verified test bodies (weights: auth 35% / BR 30% / state 20% / API 15%):

| Rule Class | Items | Meaningful Coverage | Evidence |
|-----------|-------|---------------------|----------|
| Auth/permissions | study/measurement/finding/ceph writes + reads | FULL — deny+allow pairs everywhere | imaging.test.ts (401/403 hygienist+front_desk+outsider), ceph.test.ts EF-IMG-001..005 (404-not-403 branch isolation), imaging-integration.test.ts (real-DB 401/403/404) |
| Business rules | BR-016c tier gate, BR-023..047 | FULL — tier gate tested on study-create + every ceph endpoint; BR-036..047 each has a dedicated describe with @BR tag | ceph-business-rules.test.ts (BR-036..047), imaging.test.ts (BR-023..035) |
| State transitions | SM-01 finding, SM-02 landmark | FULL — property-based + handler-level | imaging-finding.fsm.property.test.ts, ceph-landmark.fsm.property.test.ts, ceph.test.ts CIMG-009/CIMG-14, imaging-integration.test.ts (confirmed→draft 422) |
| API routes | 20 imaging + 1 patient-images | FULL status+shape; real-DB body-field assertions in integration suite | imaging-coverage.test.ts (all wrappers), imaging-integration.test.ts |

Coverage asserts business outcomes (403/422/404, specific error codes UNSUPPORTED_MIME_TYPE / INVALID_STATUS_TRANSITION / LANDMARK_LOCKED / REPORT_GATE_UNCONFIRMED / INSUFFICIENT_LANDMARKS / NOT_CALIBRATED), not line hits. Deductions: V-IMG-003 cascade-hide of child rows on archived image has no test; image_count response field untested. Score 9 (not 10): the +1 TDD-first bonus is NOT applied because git history is squashed (test+impl in one commit — see TDD section); no penalty, just no bonus.

## Layer 2 — Behavior Traceability (9/10)

Every critical behavior in the canonical inventory has a named test owner with STRONG assertions:

| Behavior | Test Owner | Quality |
|----------|-----------|---------|
| AC-IMG-001 ceph-without-tier → 403 | imaging.test.ts:287; ceph.test.ts:382/398/412/422 (null-tier too) | STRONG |
| AC-IMG-002 finding confirmed→draft → 422 | imaging-finding.fsm.property.test.ts; imaging-integration.test.ts:578 | STRONG |
| AC-IMG-003 landmark placed→not_placed → 422 | ceph-landmark.fsm.property.test.ts; ceph.test.ts CIMG-009 | STRONG |
| AC-IMG-004 images in S3 (URL not bytes) | imaging.test.ts presigned-URL; imaging-integration.test.ts uploadUrl/uploadMethod | STRONG |
| AC-IMG-005 list scoped to branch | imaging.test.ts branch-filter; ceph.test.ts:441; imaging-integration.test.ts 403 outsider | STRONG |
| BR-016c tier gate (all ceph endpoints) | ceph.test.ts + ceph-business-rules.test.ts BR-041 loop (8 endpoints) | STRONG |
| BR-026/027 delete role + own-image | imaging.test.ts + imaging-integration.test.ts (real-DB acquiredBy) | STRONG |
| BR-034 MIME allowlist | imaging.test.ts + imaging-integration.test.ts 422 | STRONG |
| BR-036..047 ceph rules | ceph-business-rules.test.ts (one describe per BR, @BR tags) | STRONG |
| SM-01/SM-02 | two FSM property tests | STRONG |

Traceability tags (`@BR-NNN`, `@CIMG-NNN`, `EF-IMG-NNN`) are embedded so the BR-traceability CI gate (quality.yml `audit:trace:ci`) can map rule→test. 5 TDD_PROOFs reference imaging/ceph (fix-wave1/wave2-dental-imaging, fix-ef-img-ceph-auth, fix-al-imaging-audit, fix-ex-007-031-fk). Layer 2 NOT shallow-capped (comprehensive compliance inventory supplied denominator). Partially-traced: V-IMG-004 FE error-surfacing is covered by FE unit tests existing (use-imaging-findings.test.ts, use-ceph-landmarks.test.ts) but the compliance slice flags the error UI itself as missing — so the *behavior* of surfacing errors is not fully traced. Score 9.

## Layer 3 — Test Quality Hardening (9/10)

Verified metrics (grep over the 7 backend test files):

| File | lines | expect() | cases | weak (toBeDefined/Truthy) | skip | sleep/retry |
|------|------:|---------:|------:|--------------------------:|-----:|------------:|
| imaging.test.ts | 1881 | 100 | 68 | 0 | 0 | 0 |
| ceph.test.ts | 1372 | 121 | 58 | 0 | 0 | 0 |
| ceph-business-rules.test.ts | 796 | 61 | 22 | 0 | 0 | 0 |
| imaging-coverage.test.ts | 1590 | 60 | 55 | 0 | 0 | 0 |
| imaging-integration.test.ts | 945 | 119 | 55 | 0 | 0 | 0 |
| imaging-finding.fsm.property.test.ts | 89 | 11 | 8 | 0 | 0 | 0 |
| ceph-landmark.fsm.property.test.ts | 80 | 12 | 7 | 0 | 0 | 0 |
| **TOTAL** | **6753** | **484** | **273** | **0** | **0** | **0** |

Strength signals: assertions pin specific status codes (201/204/400/401/403/404/422) AND specific error codes AND specific computed values (e.g. `measurements.sna` is a number, `calibration:{value:0.1,method:'manual_ruler'}`, version monotonicity 1→2→3). Two property-based FSM tests (fast-check, 100-200 runs) exercise the full transition space. Mock audit: the mock-DB suites use duck-typed Drizzle fakes (appropriate for handler-unit isolation) BUT are backstopped by `imaging-integration.test.ts` which runs the same handlers against a REAL Postgres clone with real repos/auth/tier gates/audit writes — directly addressing the project's "tests must verify real wiring" lesson. Data stability: integration suite uses stable UUIDs + beforeEach truncation + seedStudyWithImage factories (SEEDED, not brittle). Score 9 (a handful of `not.toBeNull()` existence checks sit alongside value asserts, the only thing short of a perfect 10).

## Layer 4 — Release Gate Readiness (8/10)

| Workflow | Jobs / Gates | Status |
|----------|--------------|--------|
| quality.yml | typecheck, lint, unit-test(+coverage 75/75/60), build, **security(blocking)**, migration-safety, duplicate-op-check, **BR-traceability**, e2e(soft), **journey-verification(real postgres+seed+api-ts, HARD gate)** | PRESENT |
| postgres-services.yml | real-DB api-ts unit/repo tests (per-file DB clones), typecheck, db:migrate | PRESENT |
| contract.yml | Hurl contract suite + Schemathesis (both soft), schema-drift `git diff --exit-code`, security audit(soft) | PRESENT |
| openapi-drift.yml | TypeSpec→OpenAPI drift `git diff --exit-code` | PRESENT |
| release.yml | tag-triggered build + GH release with `generate_release_notes` | PRESENT |

Migrations auto-run on server start and the contract/journey gates boot api-ts (so migrations are exercised in CI); schema-drift is hard-gated. Health endpoint = `/livez` (CI polls it). CHANGELOG.md present. Deductions: no VERSION file (release relies on git tags + auto notes); `security` is `continue-on-error` in contract.yml (though blocking in quality.yml via check-audit.sh); perf-ratchet job is `if:false` (disabled pending staging). Score 8.

## Cross-Layer Consistency
No inconsistencies. L1(9)/L2(9)/L3(9) are mutually corroborating — Layer-1 coverage is backed by real test owners (Layer 2) whose assertions are high-quality (Layer 3), and the real-DB integration suite proves the mock-suite coverage reflects real wiring. L4(8) trails by 1, expected and healthy.

## TDD Proof Verification
5 TDD_PROOF.md artifacts reference imaging/ceph. Spot-verified fix-wave1-dental-imaging: it attests tests written RED-before-GREEN for EM-IMG-002 + AL-IMG-001, lists test/impl file paths that ALL exist on disk with real assertions (no fabrication detected). Git-history ordering: imaging.test.ts and createImagingStudy.ts were both first-added in the SAME commit 8d7ee216 (2026-05-10); ceph.test.ts + batchUpsertCephLandmarks.ts both in fee2bef9 (2026-05-18). Test and impl landing in one (squashed) commit means strict test-before-impl timestamp ordering is UNVERIFIABLE from git (Step 6c.4 → UNVERIFIED, benefit of the doubt, NO penalty). No FABRICATION found (all claimed test files exist and contain assertions). Net score impact: no L1/L2 adjustment (git neither ≥80% nor <50% verifiable).

## Frontend & E2E Coverage (supplementary)
26 FE unit test files under apps/dentalemon/src/features/imaging (hooks: use-imaging-findings, use-ceph-landmarks, use-imaging-upload, use-measurements, use-ceph-analysis, use-imaging-studies, use-imaging-br, use-offline-cache; components: Ceph* layers/panels/overlays, calibration-dialog, annotation/measurement toolbars, FindingsSidebar, image-upload, patient-image-list, comparison-view; lib: geometry, ceph-geometry). 11 E2E specs (imaging-ceph, imaging-ceph-export, imaging-findings, imaging-annotation, imaging-measurement, imaging-comparison, ipad-imaging) + 4 ceph journey specs (11-ceph-tier-gate, 12-ceph-landmarks-numeric, 13-ceph-locked-landmark, 14-ceph-report-snapshot) — the journeys run in the HARD-gating journey-verification CI job.

## Unverifiable Items (flagged, not penalized)
| Item | Reason | Manual Check |
|------|--------|--------------|
| Test-before-impl strict ordering | Squashed commits (test+impl same SHA) | Trust TDD_PROOF attestation; or inspect PR history |
| FE unit assertion strength per file | Not deep-read this pass (backend was the scoped focus) | grep weak patterns in features/imaging/**/*.test.ts |

## Prioritized Action Plan
### P1 — Fix Before Major New Work
- Add a FE test + error UI asserting ceph batchUpsert/analysis-query and findings-mutation errors are surfaced (compliance V-IMG-004) — currently console.error only; behavior untraced.
### P2 — Fix When Touching Module
- Add test for V-IMG-003: child annotations/findings/ceph rows hidden when parent image archived.
- Add response-shape test for `image_count` once implemented (V-IMG-002).
- Decide+test WF-020 creator-only edit (or ratify branch-dentist edit in spec).
### P3 — Track
- Add a VERSION file or document the git-tag release contract; make contract.yml security audit blocking once the dev-tool advisory backlog clears.

## What's Next
- Run `/oli-check --traceability --module dental-imaging` for the full intent→spec→code→test chain.
- This module is a graduation-grade reference for test confidence; no critical gaps.
