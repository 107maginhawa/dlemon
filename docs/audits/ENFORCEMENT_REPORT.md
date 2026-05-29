<!-- oli-version: 1.1 -->
<!-- based-on: docs/audits/codebase-map/CODE_MODULE_MAP.json, CODE_IMPORT_GRAPH.json, CODE_API_SURFACE.json; docs/product/modules/*/MODULE_SPEC.md; docs/product/MODULE_MAP.md; docs/product/MODULE_BOUNDARIES.md; docs/audits/enforce/.baseline.json -->
<!-- generated: 2026-05-30 -->

# Enforcement Report

**Generated:** 2026-05-30
**Modules Audited:** 21 backend handler modules (graph) + apps/dentalemon web (454 dental handler files, 301 web .ts/.tsx files)
**Baseline Compared:** run-8-verify-2026-05-29 (.baseline.json v2)
**Days Since Last Run:** 1
**Coverage Completeness:** FULL (all phases ran; `bun audit` succeeded)

---

## Audit Scope

| Artifact | Available | Used |
|----------|-----------|------|
| CODE_MODULE_MAP.json (graph) | YES | YES — structural ground truth (21 modules) |
| CODE_IMPORT_GRAPH.json (graph) | YES | YES — 26 edges, circular_deps=[] |
| CODE_API_SURFACE.json (graph) | YES | YES — 240 endpoints, all auth=true except 3 public |
| MODULE_MAP.md | YES | YES |
| MODULE_BOUNDARIES.md | YES | YES (import-boundary rule source) |
| DOMAIN_MODEL.md / DOMAIN_GLOSSARY.md | YES | YES |
| WORKFLOW_MAP.md | YES | (journeys/trace owned by sibling dimensions) |
| EVENT_CONTRACTS.md | YES | YES |
| ROLE_PERMISSION_MATRIX.md | YES | YES |
| AUDIT_CONTRACTS.md | YES | YES (Phase 3 prereq met) |
| bun.lock (lockfile) | YES | YES — bun audit ran successfully |
| Baseline (.baseline.json) | YES | YES |

**Sub-checks (folded inline):**
- [x] coverage.md (Phase 0) — graph-driven breadth/depth
- [x] dependency security scan (Phase 0.5) — `bun audit --json` returned full CVE set
- [x] module.md (Phase 1) — public API / layering / naming / export discipline
- [x] file.md (Phase 1) — placement, size, forbidden patterns, stray files
- [x] cross-module.md (Phase 2) — import-edge legality, circular deps
- [ ] /oli-check --journeys (Phase 1.5) — deferred to journeys dimension
- [ ] /oli-check --traceability (Phase 2.5) — deferred to traceability dimension
- [x] /oli-check --compliance audit-logging (Phase 3) — AUDIT_CONTRACTS present; prior AL-* verified resolved

**ENVIRONMENT NOTE:** This sandbox's *recursive* grep/find silently returns empty even where
matches exist (`grep -r export <dir>` returned 0/46 inconsistently; single-file grep confirmed
content). Every pattern scan in this report was run **file-by-file over the `git ls-files`
manifest** (454 dental handler + 301 web files). Reviewers using `grep -r` will get false-clean
zeros — use per-file scans.

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Modules Audited** | 21 backend + 1 web |
| **Compliant Modules (no P0/P1 in code)** | 21 (all) |
| **Total P0 Findings** | 0 |
| **Total P1 Findings** | 3 (all dependency CVEs) |
| **Total P2 Findings** | 3 (dependency CVEs) |
| **Total P3 Findings** | 1 |
| **Cross-Module P0/P1** | 0 / 0 |
| **Circular Dependencies** | 0 (graph-confirmed) |
| **Forbidden-Tech Imports (our source)** | 0 |
| **Regressions (new P0/P1 in code)** | 0 |
| **Overall Trend** | STABLE (code) / dependency CVEs newly surfaced |

**The 3 P1s are all third-party dependency CVEs, not code-layering defects.** Code-level
enforcement (layering, naming, boundaries, forbidden tech, circular deps, file size, export
discipline) is fully clean.

---

## Module Compliance

`CODE_IMPORT_GRAPH.json` reports **`circular_deps: []`** — no cycles across 26 directed edges.
High fan-in nodes (`patient` x7, `person` x6, `dental-visit` x5, `dental-org` x5) are the intended
shared-kernel/base modules per MODULE_MAP and MODULE_BOUNDARIES. Cross-module schema imports
(dental modules importing base patient/person/dental-org/dental-visit schemas for Drizzle FK
references) are explicitly permitted by MODULE_BOUNDARIES (`repos/*.schema.ts` is excluded from
the no-cross-repo rule — "DB-layer FK coupling, not code-layer"). Approved facade bridges
(`*-billing.facade.ts`, `*-emr.facade.ts`, `visit-perio.facade.ts`, `clinical-visit.facade.ts`,
`appointment-patient.facade.ts`, etc.) are present and are the sanctioned cross-module access path.

Naming/layering compliant: handlers use camelCase verb-noun (`createDentalInvoice.ts`,
`getCephAnalysis.ts`) or the generated PascalCase-Mgmt form (`CephMgmt_*`, `ImagingMgmt_*`,
`DentalBranchManagement_*`); repos/schemas use kebab-case (`dental-invoice.schema.ts`).
**0 forbidden-tech imports** in our source — no express/fastify/axios/got/prisma/typeorm/
next-auth/passport/styled-components/@emotion (axios appears only as a transitive dependency,
never imported by our code). **0 console.*, 0 `as any`, 0 @ts-ignore/@ts-nocheck** in non-test
dental handler source. Largest non-test source file is `dental-imaging/repos/imaging.repo.ts` at
218 LOC — no file approaches the 500-line threshold. All prior code-level P0/P1 (54 historical +
EM-AUD-002) verified RESOLVED in the run-8 baseline.

### P0/P1 Module Findings (code)
No P0/P1 code-level module findings.

---

## File Compliance

| Check | Result |
|-------|--------|
| Stray/backup files (.bak, .disabled, .orig, ~) | 0 (git manifest scan) |
| Orphan/dead repos | 0 — every repo file in the graph has importers |
| Files > 500 LOC (non-test) | 0 (max 218) |
| console.* in non-test source | 0 |
| `as any` / @ts-ignore in non-test source | 0 |
| Naming convention violations | 0 |

### P0/P1 File Findings
No P0/P1 file findings.

### P3 — Advisory (Track)

| ID | Module | Finding |
|----|--------|---------|
| EF-DENTAL-IMG-naming01 | dental-imaging | dental-imaging contains BOTH the generated `*Mgmt_`-prefixed handlers (`ImagingMgmt_createImagingStudy.ts`, `CephMgmt_getCephAnalysis.ts`) AND short-named siblings (`createImagingStudy.ts`, `getCephAnalysis.ts`). Per CODE_API_SURFACE only the `*Mgmt_` set is route-wired. The short-named files appear to be superseded earlier-iteration handlers — verify they are dead and remove, or confirm intentional re-export shims. Advisory only (not confirmed dead this pass). |

---

## Cross-Module Findings

Analyzed all 26 directed edges in `CODE_IMPORT_GRAPH.json`.

| Severity | Count |
|----------|-------|
| P0 | 0 |
| P1 | 0 |
| P2 | 0 |
| P3 | 0 |

No undeclared-dependency imports: every edge is declared in MODULE_MAP. The historical
`dental-clinical -> dental-visit VisitRepository` P1 coupling risk (MODULE_MAP "Coupling Risks"
table) is now mediated by `clinical-visit.facade.ts` — the approved bridge. **0 circular deps.**

---

## Dependency Security Findings

**Status: COMPLETE** — `bun audit --json` (bun 1.2.19) returned the full advisory set.

### Lockfile Integrity
| Lockfile | Manifest | Status |
|----------|----------|--------|
| bun.lock | package.json (root + 12 workspaces) | OK — in sync |

### P0/P1 Dependency Findings (Action Required)

| ID | Sev | CVE | Package | Vulnerable | CVSS | Dependency Type | Fix |
|----|-----|-----|---------|-----------|------|-----------------|-----|
| ED-GLOBAL-drizzle1 | P1 | GHSA-gpj5-g38j-94v9 | drizzle-orm | ^0.44.2 (<0.45.2) | 7.5 | DIRECT (api-ts ORM) | Upgrade drizzle-orm to >=0.45.2 — SQL injection via improperly escaped identifiers. Highest-priority: it is the core ORM. |
| ED-GLOBAL-happydom1 | P1 | GHSA-6q6h-j7hj-3r64 | happy-dom | ^20.0.0 (<=20.8.7) | 8.8 | DIRECT (test/dev only) | Upgrade happy-dom to >=20.8.9 — RCE via VM context escape / unsanitized export names. Dev-tooling blast radius. |
| ED-GLOBAL-axios1 | P1 | GHSA-35jp-ww65-95wh | axios | <1.16.0 | 8.7 | TRANSITIVE | MITM via prototype-pollution in config.proxy. Bump the parent SDK pulling axios. Not imported by our code. |

> Also high (8.6) on axios: GHSA-pjwm-pj3p-43mv (NO_PROXY bypass) — same package, resolved by the
> same upgrade as ED-GLOBAL-axios1.

### P2 — Medium Dependency Findings

| ID | CVE | Package | Vulnerable | Note |
|----|-----|---------|-----------|------|
| ED-GLOBAL-swiper1 | GHSA-hmx5-qpq5-p643 | swiper | ^11.2.10 (<12.1.2) | "critical" prototype pollution, CVSS unscored (0). DIRECT (web carousel). Upgrade to >=12.1.2. |
| ED-GLOBAL-dompurify1 | GHSA-crv5-9vww-q3g8 (+7 more) | dompurify | <3.4.0 | Multiple moderate XSS / prototype-pollution. DIRECT (web sanitizer). Upgrade to >=3.4.0. |
| ED-GLOBAL-misc1 | (cluster) | hono, fast-uri, fast-xml-builder, uuid, ws, qs, brace-expansion, nodemailer | various | ~10 moderate/high advisories. hono (our API framework) has 5 moderate advisories <4.12.18 — upgrade recommended. Track and bump on a dependency-maintenance pass. |

> Full machine-readable advisory dump captured from `bun audit --json`.

---

## Audit Logging Findings

AUDIT_CONTRACTS.md present. Run-8 baseline records all audit-log gaps (AL-003/004/010,
patient-archive) as fixed with regression locks against the ROUTED handlers. No new
auditable-event gaps surfaced this pass.

No P0/P1 audit logging findings.

---

## Ratchet Summary

**Baseline date:** 2026-05-29 (run-8-verify)

### Regressions — New P0/P1
No **code-level** regressions (baseline 0 P0/0 P1; code remains 0/0). The 3 P1 dependency CVEs are
newly *surfaced* by this run's bun audit — the prior verification-driven baseline ran no dependency
scan, so these are new to tracking, not new code defects.

### New Findings (Track)
| ID | Sev | Finding |
|----|-----|---------|
| ED-GLOBAL-drizzle1 | P1 | drizzle-orm <0.45.2 SQL-injection CVE (direct) |
| ED-GLOBAL-happydom1 | P1 | happy-dom <=20.8.7 RCE CVE (direct, dev) |
| ED-GLOBAL-axios1 | P1 | axios <1.16.0 MITM CVE (transitive) |
| ED-GLOBAL-swiper1 | P2 | swiper <12.1.2 prototype pollution |
| ED-GLOBAL-dompurify1 | P2 | dompurify <3.4.0 XSS cluster |
| ED-GLOBAL-misc1 | P2 | hono/uuid/ws/qs/fast-uri/etc. advisory cluster |
| EF-DENTAL-IMG-naming01 | P3 | dental-imaging dual handler naming (Mgmt_ vs short) |

### Per-Module Score Trend
All code modules STABLE -> (0 P0/P1 both runs).

---

## Stabilization Plan

### Fix Now — P0 (0)
No P0 findings.

### Fix Before New Work — P1 (3, all dependency upgrades)
- **ED-GLOBAL-drizzle1** — `bun update drizzle-orm` to >=0.45.2 (SQL-injection in the core ORM is the
  highest-impact item; lockfile bump touches all api-ts query paths — run `bun test` to verify).
- **ED-GLOBAL-happydom1** — `bun update happy-dom` to >=20.8.9 (test-runner DOM; RCE, dev-only blast radius).
- **ED-GLOBAL-axios1** — bump the parent SDK pulling axios (`bun update axios` resolves both 8.7 and 8.6).

### Fix When Touching — P2 (3)
- **ED-GLOBAL-swiper1** — upgrade swiper to >=12.1.2.
- **ED-GLOBAL-dompurify1** — upgrade dompurify to >=3.4.0.
- **ED-GLOBAL-misc1** — bump hono >=4.12.18 and the transitive cluster (uuid, ws, qs, fast-uri, brace-expansion, nodemailer, fast-xml-builder).

### Track — P3 (1)
- **EF-DENTAL-IMG-naming01** — confirm whether the short-named dental-imaging handlers are dead duplicates of the `*Mgmt_` set; remove if so.

---

## Static Analysis Limitations

> **P3 Advisory:** (1) UI-journey (Phase 1.5) and traceability (Phase 2.5) are owned by their
> dedicated oli-check dimensions and were not re-run here. (2) Dependency-CVE severities use the
> bun-reported CVSS; several "critical"-labelled advisories (swiper, happy-dom VM-escape) carry an
> unscored (0) CVSS and were placed by label, not score. (3) Dynamically constructed import paths
> (runtime route assembly, DI) remain outside static reach. (4) Sandbox recursive grep returns
> false zeros — scans were run file-by-file to compensate.

---

## What's Next

**Branch 2 — P1 findings present (all dependency CVEs), no P0:**

Code-level enforcement is fully clean (0 P0/P1, 0 circular deps, 0 forbidden-tech, naming/layering
compliant). The three P1s are third-party dependency CVEs — fix before shipping:

1. `bun update drizzle-orm@^0.45.2 happy-dom@^20.8.9` and bump the axios-pulling parent; run `bun test`.
2. Sweep the P2 cluster (swiper, dompurify, hono + transitives) in the same maintenance commit.
3. Re-run `bun audit --json` to confirm the advisory set shrinks.
4. Then `/oli-check --compliance` (full) for BR/AC/permission depth, and `/oli-check --confidence`.

*Pipeline: coverage -> dep-scan -> module -> file -> cross-module -> traceability -> audit-logging ->
**YOU ARE HERE** -> /oli-check --compliance (full) -> /oli-check --confidence*
