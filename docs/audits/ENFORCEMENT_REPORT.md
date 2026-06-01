<!-- oli-version: 1.1 -->
<!-- based-on: docs/product/modules/*/MODULE_SPEC.md, docs/product/MODULE_BOUNDARIES.md, docs/audits/enforce/.baseline.json -->
<!-- generated: 2026-06-01T12:00:00Z -->

# Enforcement Report

**Generated:** 2026-06-01
**Modules Audited:** 12 (dental-audit, dental-billing, dental-clinical, dental-imaging, dental-org, dental-patient, dental-perio, dental-pmd, dental-scheduling, dental-visit, emr-consultation, external-records-import) + governance code modules: dental-erasure, dental-legalhold
**Baseline Compared:** enforcement-2026-06-01 (git a3bfc9a5)
**Current HEAD:** ece7f89c
**Days Since Last Run:** 0 (same-day re-verification after route-migration work)
**Coverage Completeness:** FULL

---

## Audit Scope

Graph-grounded enforcement using project checkers as ground truth (per baseline method). All gates run at HEAD ece7f89c.

| Artifact | Available | Used |
|----------|-----------|------|
| MODULE_MAP.md | YES | YES |
| DOMAIN_MODEL.md | YES | YES |
| WORKFLOW_MAP.md | YES | YES |
| EVENT_CONTRACTS.md | YES | YES |
| ROLE_PERMISSION_MATRIX.md | YES | YES |
| AUDIT_CONTRACTS.md | YES | YES |
| UI_CONSISTENCY_SPEC.md | YES (DRAFT, infer-from-code) | YES (P3 cap) |
| DATA_GOVERNANCE.md | YES | YES |
| Baseline (.baseline.json) | YES | YES |

**Ground-truth gate results @ ece7f89c:**

| Gate | Result |
|------|--------|
| `check:boundaries` (alias) | PASS — 0 cross-module repo boundary violations |
| `bun audit` | PASS — 0 vulnerabilities |
| `typecheck` (tsc --noEmit) | PASS — 0 errors, 0 type cycles |
| ESLint no-restricted-imports | 64 warnings (54 true reach-ins P2 + 10 emr-facade P3) — unchanged from baseline |
| New modules (erasure/legalhold) lint | 0 errors (only `no-explicit-any` warnings in test files — P3) |

**Sub-skills dispatched (executed sequentially in orchestrator context — nested dispatch unavailable):**
- [x] coverage.md (Phase 0) — spec coverage verified, all 12 modules have MODULE_SPEC
- [x] dependency security scan (Phase 0.5) — `bun audit` clean
- [x] module.md (Phase 1, per module) — graph-grounded; project checkers authoritative
- [x] file.md (Phase 1, per module) — graph-grounded
- [x] /oli-check --journeys (Phase 1.5) — 125 frontend .tsx files; known UI-journey gaps unchanged this cycle
- [x] ui-consistency.md (Phase 1.6) — UI_CONSISTENCY_SPEC.md present in DRAFT (P3 cap)
- [x] cross-module.md (Phase 2) — check:boundaries authoritative = 0 violations
- [x] /oli-check --traceability (Phase 2.5) — docs/audits/enforce/trace.md; TR-DG-002 CLEARED
- [x] /oli-check --compliance audit-logging-only (Phase 3) — erasure/legal-hold/audit-events audit emission verified

**Incomplete sub-skills:** none. All 12 modules COMPLETE.

---

## Coverage Completeness

**Status:** FULL

All mandatory phases completed. Phase 2.5 (traceability) ran (WORKFLOW_MAP present, not --module mode). Phase 1.5 (journeys) ran (frontend present). Scores reflect full enforcement coverage.

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Coverage Score** | 95% |
| **Modules Audited** | 12 |
| **Compliant Modules** | 11 (score ≥ 9.0) |
| **Non-Compliant Modules** | 0 (no P0/P1 code-level findings) |
| **Total P0 Findings** | 0 |
| **Total P1 Findings** | 0 (TR-IMG-ANNOT-SM cleared 2026-06-01 — false positive / spec doc-drift; SM-01 + AC-IMG-002 are implemented + tested on `imaging_finding`) |
| **Total P2 Findings** | 1 (EB-BOUNDARY-reachins01 — 54 reach-ins) |
| **Total P3 Findings** | 2 (EU-GLOBAL-uispec01, EB-EMR-facade-lintdrift01) |
| **Cross-Module P0/P1** | 0 / 0 |
| **Regressions (new P0/P1)** | 0 |
| **Resolved Since Last Run** | 1 (EF-DENTAL-IMG-naming01 — misclassification corrected) |
| **Overall Trend** | IMPROVING |

**Overall trend:** IMPROVING — resolved (1) > regressions (0), no new P0, and TR-DG-002 spec→code traceability gap cleared by the route-migration work this cycle.

**Overall verdict: PASS (WARN on 1 P2 tech-debt cluster).** No blocking issues. 8 commits of route-migration work (a3bfc9a5..ece7f89c) introduced zero new findings at any severity.

---

## Coverage Findings

All 12 modules have a MODULE_SPEC and resolvable handler source path. Coverage 95% (dental-patient sub-modules and dashboard FRs remain partially specced — tracked in traceability inventory, not new this cycle).

**Coverage P0 Findings:** No P0 coverage findings.
**Coverage P1 Findings:** No P1 coverage findings.

---

## Module Compliance

| Module | Score | Label | P0 | P1 | P2 | P3 | Trend | Status |
|--------|-------|-------|----|----|----|----|-------|--------|
| dental-audit | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE |
| dental-billing | 9.0/10 | COMPLIANT | 0 | 0 | 1 (14 reach-ins) | 0 | → | COMPLETE |
| dental-clinical | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE |
| dental-imaging | 9.0/10 | COMPLIANT | 0 | 0 | 0 | 0 | ↑ | COMPLETE |
| dental-org | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE |
| dental-patient | 8.5/10 | MOSTLY | 0 | 0 | 1 (27 reach-ins) | 0 | → | COMPLETE |
| dental-perio | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE |
| dental-pmd | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE |
| dental-scheduling | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE |
| dental-visit | 9.5/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE |
| emr-consultation | 9.0/10 | COMPLIANT | 0 | 0 | 0 | 1 (facade lint) | → | COMPLETE |
| external-records-import | 9.0/10 | COMPLIANT | 0 | 0 | 0 | 0 | → | COMPLETE (future-phase spec; no handler — expected) |

Reach-in counts (billing/notifs/booking/patient/provider) roll into the GLOBAL EB-BOUNDARY-reachins01 P2 cluster. dental-imaging trends ↑ because the prior "20 dead handlers" P2 finding is corrected (see Ratchet).

### P0/P1 Module Findings (Action Required)

No P0/P1 module findings.

---

## File Compliance

| Module | Files Checked | P0 | P1 | P2 | P3 | Status |
|--------|---------------|----|----|----|----|--------|
| (all 12 + erasure/legalhold) | full handler tree | 0 | 0 | 1 (cluster) | 2 | COMPLETE |

### P0/P1 File Findings (Action Required)

No P0/P1 file findings.

> The previously-tracked EF-DENTAL-IMG-naming01 ("20 dead duplicate handler files") is **RESOLVED — misclassification corrected** (see Ratchet Summary). Every short-named imaging handler has exactly one production importer (its `*Mgmt_` route-bound shim) — they are the business-logic layer of a deliberate wrapper/delegate pattern, not dead code. Verified: `CephMgmt_createCephReport.ts:3` imports and delegates to `./createCephReport`.

---

## Cross-Module Findings

| Severity | Count |
|----------|-------|
| P0 | 0 |
| P1 | 0 |
| P2 | 0 (alias-level) |
| P3 | 0 |

`check:boundaries` (the authoritative alias-level cross-module gate) reports **0 violations**. The 54 ESLint relative-import reach-ins are intra-codebase import-style debt (tracked as the GLOBAL EB-BOUNDARY-reachins01 P2), not true cross-module-contract violations. No P0/P1 cross-module findings.

---

## UI Journey Findings

Frontend present (125 .tsx files in apps/dentalemon/src). Known UI-journey gaps (payment-plan creation UI TR-035, PMD generate/import UI TR-036/037, patient-portal routes) are **KNOWN/pre-existing** and unchanged by this cycle's backend route-migration work. No new UI-journey findings this cycle. (Detailed gaps catalogued in traceability inventory.)

No P0/P1 UI journey findings introduced this cycle.

---

## UI Consistency Findings

UI_CONSISTENCY_SPEC.md is present but in DRAFT (infer-from-code, `audit_status: DRAFT (P3 cap)`). Per the spec's own P3 cap, machine-enforceable EU- findings are not yet emitted. Single P3 advisory carried (EU-GLOBAL-uispec01: curate the draft spec via oli-spec-gate to unblock enforceable consistency checks).

No P0/P1 UI consistency findings.

---

## Traceability Findings

| Metric | Value |
|--------|-------|
| TR-DG-002 (manual routes off-spec) | **CLEARED this cycle** (140 dental paths now codegen-traced) |
| P0 Gaps | 0 |
| P1 Gaps | 0 (TR-IMG-ANNOT-SM cleared — false positive / spec doc-drift) |
| P2/P3 Gaps | KNOWN inventory (dashboard chain, event emission, unspecced dental-patient sub-modules) — deferred to standalone --traceability dimension |

### P0/P1 Traceability Findings (Action Required)

| ID | Sev | Gap Type | Node | Module | Status |
|----|-----|----------|------|--------|--------|
| ~~TR-IMG-ANNOT-SM~~ | ~~P1~~ | dead-spec + schema-absent | SM-01 / AC-IMG-002 | dental-imaging | ✅ **CLEARED 2026-06-01 — FALSE POSITIVE (spec doc-drift).** The "dead-spec" basis was a mislabel: MODULE_SPEC §7 V-IMG-008 intentionally makes `imaging_annotation` a stateless `visible`-only overlay; SM-01 + AC-IMG-002 belong to **`imaging_finding`**, which has the `status` enum + transition guard (`FINDING_TRANSITIONS`, `updateFinding.ts`) and tests (`imaging-finding.fsm.property.test.ts:71`, `imaging.test.ts:1704`). Corrected the two drifted spec lines (glossary §2 + AC-IMG-002 §11) so SM-01/AC-IMG-002 trace to the finding FSM. No annotation FSM is intended. |

> Full gap inventory and coverage matrix: see [→ trace details](enforce/trace.md). No remaining KNOWN P1 chain gaps after the TR-IMG-ANNOT-SM doc-drift correction; P2/P3 items unchanged this cycle.

---

## Dependency Security Findings

| Ecosystem | Lockfile | Vulnerabilities | P0 | P1 | P2 | P3 | Status |
|-----------|----------|----------------|----|----|----|----|--------|
| Bun/Node.js | bun.lock | 0 | 0 | 0 | 0 | 0 | COMPLETE |

### Lockfile Integrity Issues

All lockfiles have valid manifests (bun.lock → package.json present).

### P0/P1 Dependency Findings (Action Required)

No P0/P1 dependency findings. `bun audit` = 0 vulnerabilities. All 8 prior ED-GLOBAL dep CVEs (drizzle-orm, fast-uri, uuid, swiper, dompurify, hono, fast-xml, qs/ws/brace-expansion/nodemailer) remain resolved via pinned versions / overrides.

---

## Audit Logging Findings

AUDIT_CONTRACTS.md present. Phase 3 verified audit emission on this cycle's migrated governance routes:

| Module | Events Checked | P0 | P1 | P2 | Status |
|--------|----------------|----|----|----|--------|
| dental-erasure | request/approve/reject (3 transitions) | 0 | 0 | 0 | audit-logged via `logAuditEvent` (erasure-service.ts:59,160) |
| dental-legalhold | place/release (2 transitions) | 0 | 0 | 0 | audit-logged via `logAuditEvent` (legal-hold-service.ts:47,81) |

### P0/P1 Audit Logging Findings (Action Required)

No P0/P1 audit logging findings. Migrated governance services emit `logAuditEvent` on every state transition; RBAC enforced at handler layer (admin-only gate on approveErasureHandler.ts). Append-only audit constraint (405 on PATCH/DELETE) per AUDIT_CONTRACTS verified previously (AC-AUD-002, committed a9895673).

---

## Ratchet Summary

**Baseline date:** 2026-06-01 (git a3bfc9a5)

### Regressions — New P0/P1 (Action Required)

No regressions. The 8 route-migration commits introduced zero new P0/P1 findings.

### New Findings — New P2/P3 (Track)

No new non-blocking findings this cycle.

### Known Findings (Persistent)

| ID | Sev | Module | Finding | Age |
|----|-----|--------|---------|-----|
| EB-BOUNDARY-reachins01 | P2 | GLOBAL | 54 ESLint relative repo reach-ins across 8 modules (dental-patient 27, billing 13, notifs 5, booking 4, patient 2, provider 2, dental-billing 1). Alias check:boundaries = 0. | 1d |
| EU-GLOBAL-uispec01 | P3 | GLOBAL | UI_CONSISTENCY_SPEC.md is DRAFT (infer-from-code); curate via oli-spec-gate to enable enforceable EU- findings. | 1d |
| EB-EMR-facade-lintdrift01 | P3 | emr-consultation | 10 no-restricted-imports warnings flag *-emr.facade imports (the APPROVED bridge); add .facade to ESLint exempt glob. | 1d |

### Resolved Since Last Run

| ID | Sev | Module | Resolution |
|----|-----|--------|------------|
| EF-DENTAL-IMG-naming01 | P2 | dental-imaging | **misclassification corrected** — short-named handlers are NOT dead; each has exactly 1 production importer (its `*Mgmt_` route-bound shim) in a deliberate wrapper/delegate pattern. Verified at HEAD. |
| TR-IMG-ANNOT-SM | P1 | dental-imaging | **false positive (spec doc-drift) corrected** — SM-01 + AC-IMG-002 are implemented + tested on `imaging_finding` (`updateFinding.ts` + `imaging-finding.fsm.property.test.ts`); MODULE_SPEC §7 V-IMG-008 intentionally makes annotations stateless. Fixed the two drifted spec lines (glossary §2 + AC-IMG-002 §11); no annotation FSM is intended. |

### Per-Module Score Trend

| Module | Previous Score | Current Score | Trend | New P0/P1 |
|--------|---------------|---------------|-------|-----------|
| dental-imaging | 8.5/10 | 9.0/10 | ↑ | — |
| all others | (stable) | (stable) | → | — |

---

## Stabilization Plan

### Fix Now — P0 Findings (0)

No P0 findings. No immediate blocking issues.

### Fix Before New Work — P1 Findings (0 code-level)

No P1 findings. TR-IMG-ANNOT-SM (the prior carried traceability-dimension P1) was cleared 2026-06-01 as a false positive: SM-01 + AC-IMG-002 are implemented + tested on `imaging_finding`, and per MODULE_SPEC §7 V-IMG-008 annotations are intentionally stateless — no annotation FSM is to be built. The two drifted spec lines were corrected so the criteria trace to the finding FSM.

### Fix When Touching — P2 Findings (1 cluster)

| ID | Module | Finding | Action |
|----|--------|---------|--------|
| EB-BOUNDARY-reachins01 | GLOBAL (8 modules) | 54 relative repo reach-ins | Migrate handlers to facade imports one PR per module per MODULE_BOUNDARIES.md. Highest concentration: dental-patient (27), billing (13). |

### Track — P3 Findings (2)

| ID | Module | Finding |
|----|--------|---------|
| EU-GLOBAL-uispec01 | GLOBAL | Curate DRAFT UI_CONSISTENCY_SPEC.md via oli-spec-gate to enable enforceable EU- findings. |
| EB-EMR-facade-lintdrift01 | emr-consultation | Add `.facade` to ESLint no-restricted-imports exempt glob (10 false-positive warnings on the approved bridge). |

---

## What's Next

**Branch 5 — All P0/P1 clear, no regressions, coverage ≥ 70%:**

Enforcement Suite Passed — No Blocking Issues.

All 12 modules cleared P0 and P1 code-level enforcement checks. Coverage 95%. The route-migration work (TR-DG-002) cleared a standing spec→code traceability gap with zero new findings — a net IMPROVING cycle.

Included in this run: dependency scan (clean), audit-logging compliance (governance routes verified), traceability (TR-DG-002 cleared), UI consistency (DRAFT spec).

Recommended next steps (in order):
1. `/oli-check --compliance` (full) — BRs, ACs, permissions, data governance beyond audit logging.
2. `/oli-check --confidence` — score test coverage against spec obligations.
3. Curate UI_CONSISTENCY_SPEC.md (oli-spec-gate) to lift the P3 cap and enable enforceable EU- findings.
4. Begin the EB-BOUNDARY-reachins01 facade-migration (start with dental-patient — 27 reach-ins).

To monitor drift: `/oli-check --enforcement --diff`. Re-run full enforcement before each release.

---

*Pipeline: `/oli-spec-modules` → `/oli-check --enforcement` (coverage) → dependency scan → module/file → journeys → ui-consistency → cross-module → traceability → audit-logging → **YOU ARE HERE** → `/oli-check --compliance` (full, optional) → `/oli-check --confidence`*
