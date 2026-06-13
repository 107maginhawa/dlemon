# AHA Module/Group Gap Plan: Dental Audit

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Dental Audit (compliance audit log) |
| Module slug | dental-audit |
| Type | Business Module (governance) |
| Output file | `docs/aha/module-gap-plans/dental-audit-gap-plan.md` |
| Primary PRD/spec used | `docs/prd/v3-dentalemon.md` §8 NFR (audit/compliance), FR1.16 full audit trail; `docs/product/modules/dental-audit/MODULE_SPEC.md` + `API_CONTRACTS.md` |
| Supporting PRDs/specs used | AC-AUD-001..004; WORKFLOW_MAP WF-028 (viewer) / WF-096 (write); ADR-005 (inline-sync write path); DATA_GOVERNANCE §2 (7-year retention); ROLE_PERMISSION_MATRIX (auditor-role rows — internally inconsistent, see GAP-2) |
| PRD/spec coverage quality | Strong (spec contains documented historical pg-boss references, superseded by ADR-005) |
| Paths inspected | `services/api-ts/src/handlers/dental-audit/` (getAuditEvents + repos + facade), `core/audit-logger.ts`, `handlers/audit/` (base module, for sink comparison), migration `0080_audit_log_append_only.sql`, `app.ts:147-154` 405 guards |
| PRDs/specs inspected | All above |
| KG used | Yes — contract-spine: `getAuditEvents` consumers = 0, grep-verified |
| KG refreshed | No |
| `/understand-domain` used | Yes (cross-check only) |
| `/understand-domain` refreshed | No |
| Webwright used | No — single-op module with no UI; absence statically proven |
| Playwright/E2E inspected | Yes (inspected): `journeys/10-void-amend-audit.journey.spec.ts` (write side-effects, not viewer) |
| Existing tests inspected | 6 module test files (33 green per prior gate) + Batch-2 RED-first additions across 5 other modules + `dental-audit.hurl` (10) + `audit.hurl`/`audit-side-effects.hurl` |
| Cross-cutting audit reviewed | Not Available |
| Database/schema audit reviewed | Not Available |
| Limitations | No tests executed |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| PRD §8 NFR + FR1.16 | `docs/prd/v3-dentalemon.md` | PRD | Current | full who/when/what/why trail; compliance constraint |
| Module spec + API contracts | `docs/product/modules/dental-audit/` | module spec | Current (with documented V-AUD-004 param reconciliation; pg-boss mentions historical per ADR-005) | viewer contract, AC-AUD-001..004, event taxonomy |
| WF-028 / WF-096 | `WORKFLOW_MAP.md:69-70` | workflow spec | Current | viewer is the V1 user journey; write path inline-sync |
| ROLE_PERMISSION_MATRIX | `docs/product/` | RBAC spec | **Internally inconsistent** (auditor-read line 100 vs owner-only line 183) + flagged NEEDS-REVIEW 2026-06-11 | GAP-2 decision input |
| Prior audit + gap plan + matrix Batch 2 log | `MODULE_dental-audit_AUDIT_2026-06-08.md`, prior plan, matrix §9 (903c763f) | prior audit (pre-AHA) | Partially superseded — P1-B/P1-C/P2-A all landed+verified | §3 |
| `ui-prototype/screens.md` | `docs/product/modules/dental-audit/ui-prototype/` | UI prototype spec | Current (unbuilt) | viewer design exists |

## 3. Expected vs Actual

**Expected:** every sensitive write across the platform produces an immutable, PHI-clean audit row (inline-sync per ADR-005, fail-closed where it matters); a `dentist_owner` can review their branch's trail via WF-028 (filterable viewer); 7-year retention; reading the trail is itself audited.

**Actual — the backend is the platform's best-verified surface.** Re-verified this round:

- **Write path:** `logAuditEvent` (`core/audit-logger.ts:135-215`) — recursive PHI sanitizer before every write (:144-152, choke-point repeat at `audit-log.repo.ts:21-49`), transient-connection retry (:49-58), **fail-closed** for security events always and financial/clinical mutations via `failClosed:true` (:154-162, rethrow :189-192; applied to 7+ handlers — Batch 2, plus invoice-void completion SL-05). 98 `logAuditEvent` callers across 15 handler modules.
- **Immutability ×3 layers:** DB trigger blocks UPDATE/DELETE (migration `0080_audit_log_append_only.sql:16-29`), HTTP 405 guards (`app.ts:147-154`), tests at both layers green.
- **Viewer endpoint:** `getAuditEvents.ts` — branchId required (:86-88), `dentist_owner`-membership-gated (:124-129, post-EM-AUD-009 membership-table check), cross-tenant denial regression-pinned with a real 2-org seed (test :207-242), snapshots omitted from DTO (latent-PHI guard), self-audit `audit_log.accessed` written fail-closed on every read (:150-177).
- **Batch 2 (903f...c763f) fully verified landed:** P1-B write coverage (role-change, plan approve, case-presentation accept, note sign/amend, claim-status — all RED-first), P1-C fail-closed opt-in, P2-A before/after snapshots + reason.

What remains:

1. **P1-A unchanged — the viewer has no frontend.** `getAuditEvents` consumers = 0; no route, no `features/audit/`, prototype spec unbuilt. Its prior gating (P1-B/P1-C trustworthiness) is now satisfied — this is the module's only V1-required build item.
2. **P2-C — who may read:** owner-only today; ROLE_PERMISSION_MATRIX contradicts itself about an auditor/read-only role.
3. **P2-B — three sinks:** authoritative `dental_audit_log` + legacy `dental_audit` (dual-written fire-and-forget) + base `audit_log_entries` (different RBAC, purgeable, holds base-module PHI-access reads invisible to the dental viewer).
4. **P3s:** TRUNCATE carve-out (documented, intentional), denied-attempt logging pattern unused (AUD-BR-003), stale pg-boss comments.

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR1.16/§8 NFR full trail | who/when/what/why on sensitive writes | ✓ (98 callers; Batch-2 coverage additions) | — | `audit-logger.ts` | `dental_audit_log` | per-handler RED-first pins | Implemented | No |
| AC-AUD-002 append-only | no UPDATE/DELETE ever | ✓ trigger + 405 + tests | — | migration 0080; app.ts:147-154 | trigger | db + http tests | Implemented | No |
| AC-AUD-004/V-AUD-101 PHI-clean | sanitized metadata + snapshots; viewer omits snapshots | ✓ | — | sanitizer + DTO omission | — | nested/array pins | Implemented | No |
| V-AUD-007/P1-C fail-closed | security always; money/clinical opt-in 5xx | ✓ | — | :154-192 + 7 handlers | — | `audit-write-reliability.test.ts` (RED-before) | Implemented | No |
| AC-AUD-003/EM-AUD-002 tenancy | branchId required; cross-org 403 | ✓ regression-pinned | — | :86-88, :129 | — | 2-org test :207-242 | Implemented | No |
| WF-028 viewer | dentist_owner reviews filterable trail | **Backend only — zero FE** | no route/feature dir; prototype unbuilt | `getAuditEvents` 0 consumers | — | endpoint fully tested | Partially Implemented | **GAP-1** |
| V-AUD-NEW-B self-audit | reads audited | ✓ | — | :150-177 | — | test | Implemented | No |
| Retention 7y (audit events) | never purged; base audit job archives legacy | ✓ dental_audit_log protected (retention engine `protected`) | — | retention targets | — | retention tests | Implemented | No |
| Auditor/read-only role | matrix ambiguous | owner-only enforced | — | :129 | — | — | Unclear | **GAP-2** `[NEEDS PRODUCT DECISION]` |
| Single source of truth | one authoritative sink | 3 sinks; base-module PHI reads invisible to dental viewer | — | dual-write :164-214; `handlers/audit/` | 3 tables | — | Partially Implemented | **GAP-3** |
| AUD-BR-003 denied-attempt logging | `access.denied` events | pattern spec'd, no callers | — | — | — | — | Not Required for V1 (recommended) | GAP-5 (P3) |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| WF-028 viewer | **GAP-1**: no FE audit viewer — owners cannot review the trail the platform so carefully writes; prior blocker (trail trustworthiness) resolved by Batch 2 | P1 | V1 REQUIRED | 0 consumers; prototype spec exists | Build viewer per `ui-prototype/screens.md` (table + actor/eventType/action/target/date filters + pagination); RED-first FE tests; settings-area route |
| Auditor role | **GAP-2**: owner-only read vs matrix's auditor-read rows — matrix internally inconsistent and flagged NEEDS-REVIEW | P2 | `[NEEDS PRODUCT DECISION]` | `getAuditEvents.ts:129`; matrix lines 100 vs 183 | Decide; if widening, add role + 2-org pins; else fix matrix doc |
| Sink fragmentation | **GAP-3**: 3 audit tables; base-module PHI-access reads invisible to dental viewer; legacy dual-write is fire-and-forget | P2 | V1 RECOMMENDED `[SHARED DEPENDENCY]` | `audit-logger.ts:196-214`; `handlers/audit/` | Plan consolidation: route base PHI-read events into dental_audit_log (or document the boundary); schedule legacy-table sunset; do NOT big-bang migrate `[DO NOT OVERBUILD]` |
| Doc drift | **GAP-4**: stale pg-boss/async comments + spec params already reconciled but comments linger | P3 | V1 RECOMMENDED | audit-logger header; MODULE_SPEC §3 | doc/comment sweep |
| Denied attempts | **GAP-5**: `access.denied` taxonomy unused | P3 | V2 DEFERRED | no callers | defer (document) |
| TRUNCATE carve-out | **GAP-6**: trigger doesn't block TRUNCATE (intentional, test-reset need; table-owner privilege required) | P3 | DO NOT ADD (documented risk acceptance) | audit-logger.ts:86-87 note | none — keep documented |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Self-audit of viewer reads | V-AUD-NEW-B | spec'd post-hoc | none | Keep |
| `audit-query.facade.ts` read facade (retention observability consumer) | facade | engineering seam | none | Keep |
| Legacy `dental_audit` dual-write | :196-214 | compat shim | divergence risk | sunset plan in GAP-3 |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| WF-096 write on sensitive mutation | system | any sensitive write | sanitize → insert (fail-closed where flagged) → dual-write legacy | Implemented | No | 98 callers |
| WF-028 owner reviews trail | dentist_owner | compliance/incident | open viewer → filter → inspect (read audited) | **Backend only** | **GAP-1** | 0 consumers |
| Auditor third-party review | auditor | external audit | scoped read access | Undecided | GAP-2 | matrix conflict |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Event write + sanitize | PHI-free row | Implemented | choke point | V1 REQUIRED | done |
| Fail-closed on money/clinical/security | 5xx on sink failure | Implemented | Batch 2 + SL-05 | V1 REQUIRED | done |
| Immutability | trigger + 405 | Implemented | 0080 + app.ts | V1 REQUIRED | done |
| Viewer list + filters | reachable UI | Missing | GAP-1 | V1 REQUIRED | only build item |
| Self-audit read | accessed event | Implemented | :150-177 | V1 REQUIRED | done |
| Retention | never purge dental log; legacy archival job | Implemented | retention `protected` | V1 REQUIRED | done |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Who voided this invoice? | owner | filter trail by target | Missing (UI) | GAP-1 | V1 REQUIRED | endpoint ready |
| Incident review after role change | owner | actor/date filter | Missing (UI) | GAP-1 | V1 REQUIRED | |
| Regulator asks for access log | owner | export/inspect trail | Missing (UI; export V2) | GAP-1 | V1 REQUIRED (view) | |
| Cross-org snooping prevented | system | 403 + exclusion | Implemented | No | V1 REQUIRED | 2-org pin |
| Trail survives erasure | compliance | rows persist | Implemented | No | V1 REQUIRED | governance pin |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| GAP-1 viewer FE | FE affordance / compliance | P1 | V1 REQUIRED | 0 consumers | A trail nobody can read fails its purpose; WF-028 is V1-required; the prior gating condition is now satisfied | Build viewer (prototype exists) |
| GAP-3 sink fragmentation | architecture | P2 | V1 RECOMMENDED | 3 tables | Base-module PHI reads invisible to the only compliance viewer; divergence risk grows | boundary doc + consolidation plan |
| GAP-2 auditor role | RBAC | P2 | `[NEEDS PRODUCT DECISION]` | matrix conflict | Wrong default could over- or under-expose PHI access history | decide + pin |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Owner investigates suspicious void | viewer filter by action | No UI; API-only | GAP-1 | P1 | FE-unit + E2E filter journey |
| Compliance review of base-module PHI reads | one trail | invisible in dental viewer | GAP-3 | P2 | post-consolidation pin |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `getAuditEvents` | API, 0 FE consumers | spine + grep | P1 gap | Wire (GAP-1) |
| `access.denied` taxonomy | unused pattern | grep | none | defer (GAP-5) |
| Legacy `dental_audit` table | dual-write target, no readers but tests | :196-214 | divergence | sunset plan (GAP-3) |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Append-only trigger (UPDATE/DELETE raise) | schema | migration 0080:16-29 | — | none (verified) |
| Snapshots stored but never exposed via viewer DTO | schema/API | V-AUD-003 | — | none (deliberate) |
| Legacy dual-write fire-and-forget | backend | :196-214 | P2 | GAP-3 |
| Param/DTO reconciliation documented (limit/offset, camelCase) | API/docs | V-AUD-004 | — | none |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Membership-based owner gate (EM-AUD-009 fix) + branchId-required + 2-org denial pin | read guards | :86-129; test :207-242 | — | none — do not re-litigate |
| Self-audit fail-closed | read accountability | :150-177 | — | none |
| Auditor-role ambiguity | RBAC scope | matrix | P2 | GAP-2 |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Trail immutable ×3 layers; survives erasure; 7y+ retention (protected target) | compliance trail | this round + governance round | — | none — exemplary |
| Before/after + reason on money/role/claim/visit mutations (P2-A) | forensic depth | Batch-2 pins | — | none |
| Residual: commit-then-5xx ordering (row without audit + visible error; no silent gap) | durability semantics | matrix-accepted | P3 | documented acceptance; revisit only if incidents |

## 16. Knowledge Graph Findings

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Single-op module; 0 consumers | spine | one wiring gap = whole UX gap | GAP-1 |
| 98 write-callers across 15 modules — widest fan-in in platform | grep counts | any logger change is platform-wide blast radius | freeze logger API during viewer work |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| PH clinics face PHIC/NPC audits; owner needs self-serve trail review | RA-10173 context | GAP-1 is compliance-operability | P1 |
| Trust chain: viewer was correctly deferred until trail became trustworthy (Batch 2) — now unblocked | prior plan gating | sequencing validated | build now |

## 18. Webwright / Playwright Findings

Not used — no UI exists; the journey spec inspected (`10-void-amend-audit`) verifies write side-effects only. No evidence saved.

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `audit.test.ts` (14) | backend | logger row-writes, recursive PHI sanitize, mandatory fields | High |
| `getAuditEvents.test.ts` (9 incl. 2-org :207-242) | backend/security | auth/role/branch/date/DTO/self-audit/cross-tenant | High |
| `audit-append-only.test.ts` (4) + `audit-immutability-db.test.ts` (3) | backend/db | 405s + real-Postgres trigger | High |
| `core/audit-logger.test.ts` (2) | backend | retry + fail-closed | High |
| Batch-2 RED-first additions (billing reliability, org role-change, patient plan-approve, visit notes) | backend | coverage + fail-closed proofs | High |
| `dental-audit.hurl` (10) + `audit-side-effects.hurl` (7) | contract | live flows incl. self-audit + sanitizer | High |
| FE | — | **none** | — |
| `journeys/10-void-amend-audit` | E2E | write side-effects | Medium |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Viewer FE: renders rows, filters work, owner-only visibility, pagination | frontend/component | GAP-1 RED-first | Before |
| Viewer E2E: void invoice → find event in viewer | E2E | end-user compliance proof | During |
| Auditor-role pins (if Q1 widens) | backend/permission | GAP-2 | Post-decision |
| Legacy-sink divergence canary (counts match) or sunset test | integration | GAP-3 | During consolidation |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| `logAuditEvent` consumed by 15 modules | shared/platform `[SHARED DEPENDENCY]` | 98 callers | logger contract frozen during any work | no signature changes |
| Base `handlers/audit/` module + its retention job | cross-module | sink #3 | GAP-3 boundary | consolidation plan only |
| Viewer UI lands in settings/admin area (dental-org shell) | cross-module | route placement | minor | coordinate placement |
| ROLE_PERMISSION_MATRIX needs-review status | product decision | GAP-2 | blocks role widening | decide with matrix refresh |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Audit viewer page (table/filters/pagination per prototype) | GAP-1 | P1 | V1 REQUIRED | FE RED + E2E | backend untouched |
| Sink boundary doc + base-PHI-read routing decision + legacy sunset plan | GAP-3 | P2 | V1 RECOMMENDED | divergence canary | plan first, no big-bang |
| Auditor-role decision + pins or matrix doc fix | GAP-2 | P2 | `[NEEDS PRODUCT DECISION]` | role pins | |
| Comment/doc sweep (pg-boss refs) | GAP-4 | P3 | V1 RECOMMENDED | none | quick |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Audit export (CSV) from viewer | V2 DEFERRED | view satisfies WF-028; export unanchored |
| Denied-attempt logging rollout | V2 DEFERRED | AUD-BR-003 recommended-not-required |
| TRUNCATE blocking | DO NOT ADD | documented intentional carve-out |
| Real event bus for audit events | DO NOT ADD | ADR-005/006 settled inline-sync `[DO NOT OVERBUILD]` |
| Big-bang sink migration | DO NOT ADD | GAP-3 wants a plan, not a rewrite |

## 24. Audit Decision

**PARTIAL PASS.**

The audit trail itself is the platform's most rigorously verified subsystem: append-only at trigger+HTTP layers, PHI-sanitized at a single choke point, fail-closed on security/financial/clinical writes (RED-first proven), cross-tenant denial regression-pinned with a real two-org seed, self-auditing reads, and Batch-2 coverage of every previously-unaudited sensitive action — all re-verified in source this round.

It is not a PASS because the V1-required consumption side (WF-028 viewer) has zero frontend — owners cannot read the trail — and the now-satisfied gating condition means there is no remaining reason to defer it. Sink fragmentation (P2) and the auditor-role ambiguity (decision) round out the list.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Q1: Should a read-only/auditor role read the trail (matrix says both yes and no)? | `[NEEDS PRODUCT DECISION]` | GAP-2; matrix is flagged NEEDS-REVIEW anyway | Product |
| Q2: Are base-module PHI-access reads required in the dental viewer (single pane), or is the boundary acceptable? | `[NEEDS PRODUCT DECISION]` | GAP-3 scope | Product/Eng |
| Q3: Legacy `dental_audit` sunset timing | `[NEEDS CONFIRMATION]` | GAP-3 | Eng |

## 26. Notes for Gap Plan Organizer

- **Truly V1 (decision-free):** GAP-1 (viewer — the module's single build item; prototype spec exists; backend frozen), GAP-4 (doc sweep).
- **Likely batch shape:** Batch A = viewer FE + E2E (self-contained); Batch B = GAP-3 boundary doc + divergence canary; GAP-2 rides the ROLE_PERMISSION_MATRIX refresh.
- **Blocked until decided:** GAP-2 (Q1), GAP-3 routing scope (Q2).
- **Must NOT implement:** export, event bus, big-bang sink migration, TRUNCATE blocking.
- **Tests first:** viewer FE RED; E2E void→viewer.
- **Cross-module:** logger API frozen (98 callers); viewer placement in settings shell.
- **Do not re-litigate:** EM-AUD-002, append-only ×2 layers, PHI sanitizer, fail-closed chain, Batch-2 coverage — all source-verified with regression pins.

---

Next recommended step:
Module/group: Dental Audit
Module slug: dental-audit
Primary PRD/spec: docs/product/modules/dental-audit/ + PRD §8 NFR
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/dental-audit-gap-plan.md
