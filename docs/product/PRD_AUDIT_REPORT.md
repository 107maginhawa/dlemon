<!--
oli: oli-prd-audit v1.0 | generated: 2026-05-24 | source: docs/prd/v3-dentalemon.md
-->

# PRD Audit Report — Dentalemon v3

**PRD**: `docs/prd/v3-dentalemon.md`
**Audit Date**: 2026-05-24
**PRD Health Score**: **7.0 / 10**
**Architecture Gate**: ⚠️ WARN — no root `ARCHITECTURE.md` (proceeding with --skip-arch-gate equivalent)

---

## Project Characteristic Flags

| Flag | Value |
|------|-------|
| real-time | YES (WebSocket sync, CRDT replication) |
| offline-local-first | YES (device = source of truth, cloud = sync relay) |
| multi-tenancy | YES (Organization → Branch hierarchy) |
| regulated-compliance | YES (HIPAA, GDPR, RA 10173, PDPA, APPs) |
| third-party-integrations | YES (Stripe, OneSignal, S3/MinIO, Postmark, Apple Pencil) |
| background-jobs | YES (pg-boss: email, notifs, audit, booking) |
| file-media | YES (imaging studies, attachments, PMD files) |
| search | YES (patient search, < 1s SLA) |
| i18n-multi-locale | YES (PH, US, EU, SG, AU — 5 locales) |
| legacy-migration | YES (CSV patient import for Software Switchers) |
| accessibility-target | AA (WCAG 2.1 AA) |

---

## Executive Summary

**Top 3 Risks:**
1. **CRDT sync underspecified** — Conflict resolution semantics not documented (what wins on concurrent edit?). Blocks offline architecture decisions.
2. **Observability absent from PRD** — No logging strategy, alerting thresholds, or metrics. PHI-logging gap identified in codebase audit (G-005) has no PRD mandate to fix it.
3. **Testing strategy absent** — PRD has no test requirements. Vertical TDD protocol is documented separately but not linked from PRD.

**Finding Counts:**

| Priority | Count |
|----------|-------|
| P0 (blocks architecture) | 1 |
| P1 (blocks specs) | 3 |
| P2 (blocks execution) | 4 |
| P3 (quality gap) | 3 |

---

## 24-Category Checklist

| # | Category | Status | Priority | Finding |
|---|----------|--------|----------|---------|
| 1 | Product Vision | ✅ PASS | — | Clear vision: iPad-first dental PMS with offline-first + PMD compliance |
| 2 | Problem Statement | ✅ PASS | — | Well-articulated pain points per persona |
| 3 | Target Users/Personas | ✅ PASS | — | 4 in PRD + 7 in ROLE_MATRIX doc |
| 4 | Scope / Out-of-Scope | ✅ PASS | — | Phase roadmap defines 3 phases with clear scope |
| 5 | Functional Requirements | ✅ PASS | — | FR1–FR12 with IDs, priority tiers (P0/P1/P2) |
| 6 | Non-Functional Requirements | ✅ PASS | — | Performance, security, privacy, capacity, accessibility |
| 7 | Data Model | ✅ PASS | — | Section 11 conceptual model; implementation in DOMAIN_MODEL.md |
| 8 | API Design | ⚠️ PARTIAL | P3 | TypeSpec-first API exists but not referenced in PRD |
| 9 | Business Rules | ✅ PASS | — | BR-001–BR-022 in separate BUSINESS_RULES.md |
| 10 | State Machines | ⚠️ PARTIAL | P2 | Visit/treatment FSMs in code, not documented in PRD |
| 11 | Error Handling | ❌ FAIL | P2 | UI interaction states covered; no API error codes or error taxonomy |
| 12 | Security Requirements | ✅ PASS | — | Encryption at rest/transit, PIN auth, audit logging, PMD signing |
| 13 | Privacy/Compliance | ✅ PASS | — | HIPAA, GDPR, RA 10173; consent, right to erasure, retention |
| 14 | Observability | ❌ FAIL | P1 | No logging strategy, alerting, metrics, or tracing in PRD |
| 15 | Disaster Recovery | ⚠️ PARTIAL | P2 | Offline-first = local resilience; no explicit cloud DR/backup SLA |
| 16 | Feature Flags | ❌ FAIL | P2 | Phased rollout described but no feature flag strategy |
| 17 | Performance SLAs | ✅ PASS | — | Workspace < 2s, search < 1s, 60fps carousel, capacity: 10k patients/branch |
| 18 | Accessibility | ✅ PASS | — | WCAG 2.1 AA, 44px touch targets, screen reader, reduced motion |
| 19 | Internationalization | ✅ PASS | — | Appendix B: 5 locales, FDI notation, per-country tax/privacy/license |
| 20 | Data Migration | ⚠️ PARTIAL | P3 | CSV import for demographics; no migration strategy for clinical history |
| 21 | Testing Strategy | ❌ FAIL | P1 | No test requirements in PRD (VERTICAL_TDD.md exists separately) |
| 22 | Deployment Model | ✅ PASS | — | Local-first + cloud sync, Tauri desktop/mobile wrapper described |
| 23 | Risks | ✅ PASS | — | Section 13 risk register |
| 24 | Glossary | ✅ PASS | — | Section 15: 14 dental terms |

---

## Ambiguity Gate (10 Blocking Questions)

| # | Question | Status | Impact |
|---|----------|--------|--------|
| AG-1 | What wins when two devices conflict on the same record? | ⚠️ PARTIAL — CRDT mentioned, semantics not specified | **P0** — blocks offline architecture |
| AG-2 | Data retention period for audit logs? | ❌ FAIL — not specified | P1 |
| AG-3 | How are prescription/lab order PDFs generated? | ❌ FAIL — not specified | P1 |
| AG-4 | Data access on branch membership removal? | ❌ FAIL — not specified | P1 |
| AG-5 | Pediatric consent transition at age threshold? | ⚠️ PARTIAL — EC9 mentioned, flow not specified | P2 |
| AG-6 | PMD offline signing flow? | ⚠️ PARTIAL — pre-loaded certs mentioned | P2 |
| AG-7 | Patient record merge (BR-020) flow? | ❌ FAIL — not specified, not implemented | P2 |
| AG-8 | Session timeout duration? | ❌ FAIL — ADR-007 says undefined | P2 |
| AG-9 | PIN + JWT interaction model? | ❌ FAIL — not specified | P2 |
| AG-10 | Treatment delete vs dismiss vs archive semantics? | ⚠️ PARTIAL — ADR-009 notes mixed semantics | P2 |

**Ambiguity Gate Score**: 3/10 PASS | 4/10 PARTIAL | 3/10 FAIL
**P0 count**: 1 (AG-1: CRDT conflict resolution)

---

## PRD Health Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| Clarity | 8/10 | Excellent vision, personas, design innovations |
| Completeness | 7/10 | All major sections; missing observability/testing/feature flags |
| Testability | 7/10 | ACCEPTANCE_CRITERIA.md exists, FR IDs traceable |
| AI-readiness | 7/10 | Good domain context; CRDT/sync underspecified |
| Context-window-readiness | 6/10 | PRD is large (~145KB); chunking needed |
| **Overall** | **7.0** | |

---

## What's Next

```
/oli-workflow-map        → Step 3: discover workflows from 9 heuristics
/oli-domain-model        → Step 4: normalize entity naming + bounded contexts
/oli-module-specs --all  → Step 5: 22-section specs from code
/oli-api-contracts --all → Step 6: API contracts per module
/oli-ui-blueprint --all  → Step 7: UI specs
/oli-spec-consistency    → Step 8: GATE
```
