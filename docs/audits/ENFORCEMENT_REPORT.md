<!-- oli-version: 1.1 -->
<!-- based-on: docs/product/modules/*/MODULE_SPEC.md, docs/product/MODULE_MAP.md, docs/product/MODULE_BOUNDARIES.md, docs/audits/codebase-map/*, docs/audits/enforce/.baseline.json -->
<!-- generated: 2026-05-31T11:47:08Z -->

# Enforcement Report

**Generated:** 2026-05-31T11:47:08Z
**Modules Audited:** 12 (dental-audit, dental-billing, dental-clinical, dental-imaging, dental-org, dental-patient, dental-perio, dental-pmd, dental-scheduling, dental-visit, emr-consultation, external-records-import)
**Baseline Compared:** 2026-05-30 (run-id enforcement-2026-05-30, git 9d1e5c5f)
**Current HEAD:** 2900d281
**Engine Map:** docs/audits/codebase-map/ (FRESH, engine v0.1.0, git ae0d17da, 199 files, fields_unavailable=[])
**Days Since Last Run:** 1
**Coverage Completeness:** FULL (cross-module + per-module ran; trace/journeys deferred to dedicated dimensions per project convention)

---

## Audit Scope

| Artifact | Available | Used |
|----------|-----------|------|
| MODULE_MAP.md | YES | YES |
| MODULE_BOUNDARIES.md | YES | YES (authoritative boundary rule) |
| DOMAIN_MODEL.md | YES | YES |
| WORKFLOW_MAP.md | YES | deferred to /oli-check --journeys + --traceability |
| EVENT_CONTRACTS.md | YES | YES |
| ROLE_PERMISSION_MATRIX.md | YES | YES |
| AUDIT_CONTRACTS.md | YES | audit-logging deferred to --compliance dimension |
| UI_CONSISTENCY_SPEC.md | NO | ui-consistency → draft-spec infer-from-code (P3 cap) |
| Engine codebase-map | YES | YES (CODE_IMPORT_GRAPH ground truth for cycles) |
| Baseline (.baseline.json) | YES | YES |

**Sub-checks dispatched:**
- [x] coverage (Phase 0)
- [x] dependency security scan (Phase 0.5, `bun audit --json`)
- [x] module-boundary + file-org (Phase 1, per module, graph-grounded + ESLint authoritative)
- [ ] /oli-check --journeys (Phase 1.5 — owned by journeys dimension run, not duplicated here)
- [x] ui-consistency (Phase 1.6, draft-spec mode — spec absent, P3 cap)
- [x] cross-module (Phase 2)
- [ ] /oli-check --traceability (Phase 2.5 — owned by traceability dimension run)
- [ ] /oli-check --compliance audit-logging (Phase 3 — owned by compliance dimension run)

**Incomplete sub-checks:** none

**Method note:** Boundary enforcement uses the project's own authoritative checkers as ground truth:
`bun run check:boundaries` (alias `@/handlers/` imports) and ESLint `no-restricted-imports`
(relative `../module/repos/` imports). Engine `CODE_IMPORT_GRAPH.circular_deps` used for cycle detection.
Pattern scans run over `git grep` manifest (688 handler + 318 web files).

---

## Coverage Completeness

**Status:** FULL

All 12 product modules have a `MODULE_SPEC.md` (12/12 = 100%). All applicable enforcement phases for
this dimension run completed. Journeys/traceability/audit-logging are run as their own dedicated oli-check
dimensions in this project's pipeline and are intentionally not re-dispatched here (avoids double-counting).
Scores reflect full enforcement coverage for the boundary/file/cross-module/dependency/ui scope.

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Coverage Score** | 100% (12/12 modules specced) |
| **Modules Audited** | 12 |
| **Compliant Modules** | 12 (no P0/P1 code-boundary or contract violations) |
| **Non-Compliant Modules** | 0 (no module has a P0/P1) |
| **Total P0 Findings** | 0 |
| **Total P1 Findings** | 3 (all dependency CVEs — GLOBAL, not module-scoped) |
| **Total P2 Findings** | 5 |
| **Total P3 Findings** | 3 |
| **Cross-Module P0** | 0 |
| **Cross-Module P1** | 0 |
| **Import Cycles** | 0 (engine CODE_IMPORT_GRAPH.circular_deps = []) |
| **Type Cycles** | 0 (typecheck clean — prior 1 type-cycle RESOLVED) |
| **Forbidden Tech Imports** | 0 (backend + frontend) |
| **Regressions (new P0/P1)** | 0 |
| **Resolved Since Last Run** | 1 (ED-GLOBAL-happydom1 no longer surfaced) |
| **Overall Trend** | STABLE |

**Verdict: WARN** — No P0. The 3 P1s are dependency CVEs (1 direct, 2 transitive), known/tracked
since 2026-05-30, not regressions. No code-level, boundary, contract, cycle, or auth blocking issue.

---

## Coverage Findings

| Module | Coverage | Status |
|--------|----------|--------|
| all 12 modules | spec present | PASS |

No P0/P1 coverage findings. 12/12 modules carry MODULE_SPEC.md.

---

## Module Compliance

| Module | Score | Label | P0 | P1 | P2 | P3 | Trend | Status |
|--------|-------|-------|----|----|----|----|-------|--------|
| dental-audit | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE |
| dental-billing | 9.0/10 | COMPLIANT | 0 | 0 | 1 | 0 | → | COMPLETE |
| dental-clinical | 9.0/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE |
| dental-imaging | 8.0/10 | MOSTLY | 0 | 0 | 1 | 0 | → | COMPLETE |
| dental-org | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE |
| dental-patient | 8.0/10 | MOSTLY | 0 | 0 | 1 | 0 | → | COMPLETE |
| dental-perio | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE |
| dental-pmd | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE |
| dental-scheduling | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE |
| dental-visit | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE |
| emr-consultation | 9.0/10 | COMPLIANT | 0 | 0 | 0 | 1 | → | COMPLETE |
| external-records-import | N/A | SPEC-ONLY | 0 | 0 | 0 | 0 | → | no handler (future phase) |

> Note: `billing`/`notifs`/`booking`/`patient`/`provider` are Monobase **platform** modules (not in the
> 12 dental product set) but they carry the largest share of boundary warnings — folded into the
> File / Module Boundary section below rather than the dental module table.

### P0/P1 Module Findings (Action Required)

No P0/P1 module-boundary or module-contract findings. Backend & frontend forbidden-tech scans both clean.

---

## File / Module Boundary Compliance

**Authoritative checkers run this session:**

| Checker | Result |
|---------|--------|
| `bun run check:boundaries` (alias `@/handlers/` repo imports) | ✅ 0 violations |
| `tsc --noEmit` (backend typecheck) | ✅ clean — 0 type errors, **0 type cycles** |
| Engine `CODE_IMPORT_GRAPH.circular_deps` | `[]` — 0 import cycles |
| ESLint `no-restricted-imports` (relative `../module/repos/`) | ⚠ 64 warnings (8 modules) |
| ESLint total | 7 errors, 3527 warnings (mostly style/`any`; not enforcement-blocking) |

### Boundary warning breakdown (ESLint `no-restricted-imports`)

| Source module | Warnings | Classification |
|---------------|----------|----------------|
| dental-patient | 27 | P2 — handler reach-in to patient/dental-visit/dental-billing/dental-clinical repos |
| billing | 13 | P2 — handler reach-in to person/repos |
| emr | 10 | **P3** — `*-emr.facade` imports (the APPROVED bridge) flagged because eslint config exempt-list omits `.facade` |
| notifs | 5 | P2 — reach-in to person/repos |
| booking | 4 | P2 — reach-in to person/billing repos |
| patient | 2 | P2 — reach-in to person/repos |
| provider | 2 | P2 — reach-in to person/repos |
| dental-billing | 1 | P2 — getPatientBalance → patient/repos/patient.repo |

- **54 true repo reach-ins** (non-test, non-`.schema.ts`, non-facade) → tracked as **P2 boundary tech-debt**
  (matches MODULE_BOUNDARIES.md "migration in progress" status; migrate one PR at a time via facades).
- **10 emr facade flags** → **P3 lint-config drift**: facades are the documented approved bridge but the
  ESLint exempt-list does not include `repos/*.facade.ts`. Either add `.facade` to the exempt glob or
  document the warnings as accepted.
- The previously-tracked **1 type cycle is RESOLVED** (typecheck clean + engine cycles=[]).
- MODULE_BOUNDARIES.md migration-priority table (imaging 30 / dental-patient 26 / etc.) is **stale vs. live
  ESLint output** (live: dental-patient 27, billing 13, imaging 0 boundary warns) — flagged P3 doc-drift.

### File-org hygiene

| Finding | Severity | Detail |
|---------|----------|--------|
| EF-DENTAL-IMG-naming01 | **P2** | dental-imaging carries **20 dead duplicate handler files**. The `*Mgmt_`-prefixed set (CephMgmt_*, ImagingMgmt_*, ImagingFindingsMgmt_*) is route-wired in `generated/openapi/registry.ts`; the 20 short-named twins (createCephReport.ts, createImagingStudy.ts, createFinding.ts, …) have **0 importers** anywhere — confirmed dead. Delete the short-named set. (Was P3-suspected in baseline; now P2-confirmed dead.) |

---

## Cross-Module Findings

Dependency edges from MODULE_MAP analyzed: 30+ directed edges across 12 dental + platform modules.

| Severity | Count |
|----------|-------|
| P0 | 0 |
| P1 | 0 |
| P2 | (folded into boundary section — repo reach-ins) |
| P3 | 0 |

- **Auth/Permission boundary:** PASS — all cross-module clinical calls route through `shared/assertBranchAccess`
  / `assertBranchRole`; no auth-context drop detected at any boundary. No P0.
- **API contract alignment:** PASS — no signature/method mismatches found at declared edges.
- **Event schema:** EVENT_CONTRACTS present; no publisher/consumer schema incompatibility surfaced.
- **Import boundary direction:** all cross-module imports flow along declared dependency direction
  (patient/person/dental-org as upstream sinks). No undeclared-dependency imports → no P1.
- **Shared-entity handling:** `dental-imaging` uses documented UUID-only loose coupling (no DB FKs) — PASS.

No P0/P1 cross-module findings. The only cross-module concern is the P2 repo reach-in coupling already
listed in the boundary section (these are intra-codebase coupling tech-debt, not contract breaks).

---

## UI Consistency Findings

**Mode:** draft-spec / infer-from-code (UI_CONSISTENCY_SPEC.md ABSENT). Audit-only, **P3 severity cap**.

`docs/product/UI_CONVENTIONS.md` exists but is not the machine-checkable `UI_CONSISTENCY_SPEC.md` the
sub-check consumes. No enforceable EU- findings can be raised above P3 without a generated spec.

| ID | Sev | Finding |
|----|-----|---------|
| EU-GLOBAL-uispec01 | P3 | No `UI_CONSISTENCY_SPEC.md` — UI token/contract/page-shell/contrast/focus/z-index consistency cannot be machine-enforced. Run `/oli-spec-ui --infer-from-code` to draft one, then re-run for real EU- enforcement. |

---

## Dependency Security Findings

`bun audit --json` ran successfully over the Bun workspace lockfile (Node.js ecosystem). COMPLETE.

| Ecosystem | Lockfile | Vulns | P0 | P1 | P2 | P3 | Status |
|-----------|----------|-------|----|----|----|----|--------|
| Node.js/Bun | bun.lock | 12 packages | 0 | 3 | 5 | 0 | COMPLETE |

### Lockfile Integrity
All lockfiles have valid manifests (package.json present). No integrity issues.

### P1 Dependency Findings (Action Required)

| ID | Sev | CVE / GHSA | Package | Vuln range | Title | Fix |
|----|-----|-----------|---------|-----------|-------|-----|
| ED-GLOBAL-drizzle1 | P1 | GHSA-gpj5-g38j-94v9 | drizzle-orm | <0.45.2 | SQL injection via improperly escaped identifiers (CVSS 7.5, **DIRECT core ORM**) | upgrade ≥0.45.2 |
| ED-GLOBAL-fasturi1 | P1 | GHSA-v39h-62p7-jpjc + GHSA-q3j6-qgpj-74h6 | fast-uri | ≤3.1.1 | host-confusion + path-traversal via percent-encoding (CVSS 7.5, transitive) | bump transitive |
| ED-GLOBAL-uuid1 | P1 | GHSA-w5hq-g745-h8pq | uuid | <11.1.1 | missing buffer bounds check v3/v5/v6 (CVSS 7.5, transitive) | bump transitive |

### P2 Dependency Findings (track)

| ID | Package | Note |
|----|---------|------|
| ED-GLOBAL-swiper1 | swiper <12.1.2 | prototype pollution, critical/unscored, DIRECT web carousel — upgrade ≥12.1.2 |
| ED-GLOBAL-dompurify1 | dompurify <3.4.0 | XSS/prototype-pollution cluster (9 advisories), DIRECT sanitizer — upgrade ≥3.4.0 |
| ED-GLOBAL-hono1 | hono <4.12.18 | 5 moderate (cache leak, body-limit bypass, JSX injection) — bump |
| ED-GLOBAL-fastxml1 | fast-xml-builder ≤1.1.6 | attribute-quote bypass (6.1) |
| ED-GLOBAL-misc1 | qs / ws / uuid / brace-expansion / nodemailer | transitive moderate cluster — dependency-maintenance pass |

> Baseline note: prior ED-GLOBAL-happydom1 (happy-dom RCE) and ED-GLOBAL-axios1 no longer surface in
> current `bun audit` output → classified RESOLVED. drizzle/swiper/dompurify persist (KNOWN since 2026-05-30).

---

## Ratchet Summary

**Baseline date:** 2026-05-30

### Regressions — New P0/P1 (Action Required)
No regressions. No new P0/P1 introduced since 2026-05-30 baseline.

### New Findings — New P2/P3
| ID | Sev | Note |
|----|-----|------|
| ED-GLOBAL-fasturi1 | P1→tracked | fast-uri high CVEs newly surfaced in audit feed (transitive; not a code regression) |
| ED-GLOBAL-uuid1 | P1→tracked | uuid bounds-check high CVE newly surfaced (transitive) |

> These are advisory-feed additions (newly published CVEs against already-pinned transitive deps), not
> code regressions. No source change introduced them.

### Known Findings (Persistent)
| ID | Sev | Finding | Age |
|----|-----|---------|-----|
| ED-GLOBAL-drizzle1 | P1 | drizzle-orm SQL-injection (direct ORM) | 1d |
| ED-GLOBAL-swiper1 | P2 | swiper prototype pollution | 1d |
| ED-GLOBAL-dompurify1 | P2 | dompurify XSS cluster | 1d |
| EF-DENTAL-IMG-naming01 | P2 | dead duplicate imaging handlers (now confirmed dead) | 1d |

### Resolved Since Last Run
| ID | Sev | Resolution |
|----|-----|------------|
| ED-GLOBAL-happydom1 | P1 | no longer in audit feed (fixed/superseded) |
| (prior) 1 type cycle | — | resolved — typecheck clean + engine cycles=[] |

### Per-Module Score Trend
All 12 modules → (within ±0.5 of prior). Stable. No module regressed.

---

## Stabilization Plan

### Fix Now — P0 (0)
No P0 findings. No immediate blocking issues.

### Fix Before New Work — P1 (3)

**ED-GLOBAL-drizzle1** — GLOBAL — drizzle-orm SQL injection (direct core ORM)
- Action: upgrade drizzle-orm to ≥0.45.2. Highest priority (direct, CWE-89).

**ED-GLOBAL-fasturi1** — GLOBAL — fast-uri host-confusion / path-traversal (transitive)
- Action: bump the parent dep pulling fast-uri to a release pinning ≥3.1.2; or add a resolution override.

**ED-GLOBAL-uuid1** — GLOBAL — uuid buffer bounds (transitive)
- Action: bump uuid to ≥11.1.1 via resolution override.

### Fix When Touching — P2 (5)
| ID | Module | Finding |
|----|--------|---------|
| EF-DENTAL-IMG-naming01 | dental-imaging | delete 20 dead short-named handler twins |
| (boundary) | dental-patient (27) / billing (13) / notifs / booking / patient / provider | migrate 54 repo reach-ins to facades, one PR at a time |
| ED-GLOBAL-swiper1 | web | upgrade swiper ≥12.1.2 |
| ED-GLOBAL-dompurify1 | web | upgrade dompurify ≥3.4.0 |
| ED-GLOBAL-hono1 | api | upgrade hono ≥4.12.18 |

### Track — P3 (3)
| ID | Module | Finding |
|----|--------|---------|
| EU-GLOBAL-uispec01 | global | generate UI_CONSISTENCY_SPEC.md for machine-enforceable UI consistency |
| (lint-config drift) | emr | add `repos/*.facade.ts` to ESLint no-restricted-imports exempt list (10 false-positive warns) |
| (doc drift) | global | MODULE_BOUNDARIES.md migration-priority table stale vs live ESLint counts |

---

## What's Next

**P1 Findings Present — Fix Before Merging**

3 P1 dependency-CVE findings (all GLOBAL). No P0, no code/boundary/cycle/auth blockers.

1. Upgrade drizzle-orm ≥0.45.2 (direct, SQL-injection — do first).
2. Add resolution overrides for fast-uri ≥3.1.2 and uuid ≥11.1.1 (transitive highs).
3. Re-run `bun audit` to confirm; then `/oli-check --enforcement --diff` to verify baseline delta.

**No regressions** since 2026-05-30. Trend STABLE. The 54 boundary repo reach-ins and 20 dead imaging
files are P2 tech-debt with an established migration plan — non-blocking.

---

*Dimension: enforcement | Read-only audit | Generated by oli-check --enforcement (graph-grounded + project checkers as ground truth)*
