# AHA Module/Group Gap Plan: Data Governance (Erasure · Legal Hold · Retention)

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Data Governance (dental-erasure + dental-legalhold + retention) |
| Module slug | data-governance |
| Type | Business Module (governance group) |
| Output file | `docs/aha/module-gap-plans/data-governance-gap-plan.md` |
| Primary PRD/spec used | `docs/prd/v3-dentalemon.md` FR2.19 (anonymization), FR2.20 (consent), FR8.14 (retention settings); `docs/product/DATA_GOVERNANCE.md` §1–7 |
| Supporting PRDs/specs used | `docs/product/modules/legal-hold/MODULE_SPEC.md` + `API_CONTRACTS.md` (v1.0); `docs/product/modules/retention/MODULE_SPEC.md` + `API_CONTRACTS.md` (v1.0); `docs/product/WORKFLOW_MAP.md` WF-088/WF-LH-001..004/WF-RET-001..003; **no dental-erasure MODULE_SPEC exists** `[BLOCKED BY MISSING SPEC]` — erasure expectations `[INFERRED]` from FR2.19 + DATA_GOVERNANCE §3 + code |
| PRD/spec coverage quality | Partial (legal-hold/retention Strong; erasure spec Missing) |
| Paths inspected | `services/api-ts/src/handlers/dental-erasure/` (5 ops + engine + targets + service), `handlers/dental-legalhold/` (3 ops + facade), `handlers/retention/` (engine, repos, jobs — no HTTP surface); `core/jobs.ts` + `app.ts:286-290` (scheduler wiring); contract `dental-erasure.hurl` (33 req) + `dental-legalhold.hurl` (21 req) |
| PRDs/specs inspected | All above |
| KG used | Yes — `contract-spine.json`; all 8 ops confirmed `consumers: []`, grep-verified |
| KG refreshed | No |
| `/understand-domain` used | Yes (cross-check only) |
| `/understand-domain` refreshed | No |
| Webwright used | No — there is no UI to drive (zero FE surface is itself the headline finding) |
| Playwright/E2E inspected | N/A — no governance E2E exists (recorded as gap) |
| Existing tests inspected | 22 backend files (77+ assertions), 2 hurl suites (54 req) |
| Cross-cutting audit reviewed | Not Available |
| Database/schema audit reviewed | Not Available |
| Limitations | No tests executed; retention cron behavior verified by source, not by observing a run |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| PRD FR2.19/2.20/8.14 | `docs/prd/v3-dentalemon.md` | PRD | Current | anonymize-not-delete, consent gate, retention settings visibility |
| DATA_GOVERNANCE.md §1–7 | `docs/product/` | compliance map | Current | per-locale retention table, Art-17/RA-10173 §34 deletion map, Art-20 export status |
| legal-hold MODULE_SPEC v1.0 | `docs/product/modules/legal-hold/` | module spec | Current (2026-06-02) | hold FSM, admin-only RBAC, AC-LH-001..005 |
| retention MODULE_SPEC v1.0 | `docs/product/modules/retention/` | module spec | Current (2026-06-02) | policy-as-data, no-HTTP-surface-by-design, safety invariants, AC-RET-001..006 |
| dental-erasure MODULE_SPEC | — | module spec | **Missing** `[BLOCKED BY MISSING SPEC]` | erasure FSM/permissions inferred from code + PRD |
| Prior audit + 3 gap plans + matrix | `MODULE_erasure-legal-hold-retention_AUDIT_2026-06-08.md`, `dental-erasure/dental-legalhold/retention-gap-plan.md`, matrix | prior audit (pre-AHA) | Partially superseded (ER-P2-1 Batch 3, retention G2 Batch 4, audit-survives pin Batch 2 — all verified landed) | row-by-row §3 |

## 3. Expected vs Actual

**Expected:** legally-required governance — patient erasure requests handled via an audited two-step (request → admin approve/reject) that anonymizes PII while preserving clinical record + audit trail, **blocked by active legal holds**; legal holds placeable/releasable by authorized operators; retention policies per locale reviewable in Settings and enforced safely (dry-run default, never purge audit, never hard-delete, hold-exempt).

**Actual — the safety core is genuinely strong and verified again this round:**

- **Legal-hold-blocks-erasure enforced on 4 independent axes** (engine short-circuit `erasure-engine.ts:117-122`; service real-store check `erasure-service.ts:107` via `legal-hold.facade.ts:15-21`; route test; retention exclusion `retention-targets.ts:40,59`) — each tested.
- **Anonymize-not-delete** with explicit targets (`erasure-targets.ts`: person→pseudonym :27-33, patient identifiers :36-41, consent signer redaction :44-49, imaging + **physical S3 delete** :58-65); audit trail is never a target; **audit-survives-erasure pinned** (Batch 2 test: `[ERASED]` subject + surviving `erasure.anonymized` audit row).
- **Retention engine is NOT dead code:** contrary to the billing-round assumption, api-ts **has a real job scheduler** (`core/jobs.ts` `registerCron`, wired `app.ts:286-290`); retention registers a daily 03:30 cron (`handlers/retention/jobs/index.ts:19`), dry-run unless `RETENTION_ENFORCEMENT_ENABLED="true"`, with all four safety invariants engine-enforced. (Cross-module correction: billing/visit "no scheduler exists" claims → the scheduler exists; those modules simply never registered jobs.)
- ER-P2-1 wire shape fixed (Batch 3, `listErasureRequestsHandler.ts:26` `{data: rows}` + hurl/test flips); retention G2 observability landed (Batch 4, `retention-status.ts:42-70` + 5-assertion test).

**What's broken is operability and tenancy hygiene:**

1. **Zero FE for all 8 ops** (5 erasure + 3 legal-hold; grep-verified) — the right-to-erasure and litigation-hold workflows are undeliverable by any operator from the product.
2. **ER-P1-1 still open:** erasure handlers accept `tenantId` from the request body unvalidated (`requestErasureHandler.ts:27`), never resolve subject→tenant, and `listErasureRequests` returns **all tenants' requests** (`listErasureRequestsHandler.ts:27`). Bounded today by platform-admin-only role guards (every handler: `user.role !== 'admin'` → 403), but the cross-tenant list/approve surface has no guard of its own and no cross-tenant test (ER-P2-2).
3. **Who-may-erase undecided (ER-P1-3):** only hardcoded platform-admin emails can act; clinic `dentist_owner` has no path — RA-10173 operability for an SMB clinic product is a product decision away.
4. **Retention has no review surface (G1):** policies are DB rows edited via raw SQL; FR8.14 "visible in Settings" unmet. **G3:** 3 of 5 declared targets (clinical/visit/prescription) have no facades and are seeded `enabled:false` — the governance contract advertises more than it enforces. **G4:** no end-to-end `dryRun:false` test through real facades — the highest-risk mutation path is unproven.
5. **RBAC contract drift:** TypeSpec declares `x-security-required-roles: ["user"]` on all 8 erasure/legal-hold ops while handlers enforce platform admin — impl stricter (safe) but spec misleads future clients.

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR2.19/WF-088 two-step erasure | request → approve/reject, audited | ✓BE (FSM `requested→approved→anonymized\|rejected`) — zero FE | none | `erasure-service.ts:49-151` | `erasure-request.schema.ts:24-29` | 7 erasure test files + 33-req hurl | Partially Implemented | **GAP-1** |
| Anonymize-not-delete + audit survives | PII→`[ERASED]`; clinical + audit retained | ✓ | — | `erasure-targets.ts` | — | Batch-2 pin + engine tests | Implemented | No |
| Legal hold blocks erasure (V-DG-002) | refuse erasure under active hold | ✓ ×4 axes | — | `erasure-service.ts:107`, engine :117-122 | hold status enum | `erasure-legalhold.test.ts` et al. | Implemented | No |
| S3 radiograph physical delete | files removed on approval | ✓ | — | `physicalDeleteErasedFiles()` | — | tested | Implemented | No |
| Erasure tenancy | subject→tenant resolved; list scoped | **Unvalidated body tenantId; list cross-tenant** | — | `requestErasureHandler.ts:27`; list :27 | tenantId col | **no cross-tenant test (ER-P2-2)** | Partially Implemented | **GAP-2** |
| Who may erase | clinic-operable per RA-10173 | platform-admin only (hardcoded emails) | — | role guards :18/:22 | — | RBAC 403 pins | Unclear | **GAP-3** `[NEEDS PRODUCT DECISION]` |
| Legal hold place/list/release (AC-LH-001..005) | admin ops + audit + terminal release | ✓BE — zero FE | none | 3 handlers | `legal-hold.schema.ts` | 3 test files + 21-req hurl | Partially Implemented | **GAP-1** |
| FR8.14 retention visible/configurable | Settings surface | **DB-rows-only; no HTTP/UI** (spec declares data-only by design — conflicts with PRD "visible in Settings") | none | no endpoints | `retention-policy.schema.ts` | — | Partially Implemented | **GAP-4** |
| Retention enforcement (AC-RET-001..006) | dry-run default, archive-not-delete, audit protected, hold-exempt, idempotent seed, 1y appointments | ✓ cron-wired + env-gated | — | `jobs/index.ts:13-21`, engine invariants :7-20 | policy rows | 8 retention test files | Implemented | G4 proof gap |
| Retention target coverage | declared targets enforceable | 2 of 5 wired (attachment, appointment); clinical/visit/prescription facade-less, disabled | — | `RETENTION_TARGETS` | seeds `enabled:false` | `retention-defaults.test.ts` | Partially Implemented | **GAP-5** |
| Enforcement observability (G2) | operator can see last run/mode | ✓ (Batch 4) | — | `retention-status.ts:42-70` | audit events | 5-assertion test | Implemented | No |
| Art-20 bulk export | patient data export | per-visit PMD + patient export exist; bulk format deferred pending PRD | — | — | — | — | Not Required for V1 (declared deferral) | No |
| TypeSpec role declarations | spec == enforcement | declares `user`, enforces admin (8 ops) | — | tsp vs handlers | — | — | Unclear | GAP-7 (P2 docs) |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| FR2.19 operability | **GAP-1**: zero FE for erasure (5 ops) + legal hold (3 ops) — compliance workflows API-only | P1 | V1 REQUIRED (scope of UI depends on GAP-3 decision) | spine `consumers: []` + grep | Minimal admin surface: erasure request/queue/approve+reject, hold place/list/release (likely settings-area page) |
| Erasure tenancy | **GAP-2**: body-supplied tenantId unvalidated; subject→tenant unresolved; list returns all tenants; zero cross-tenant tests | P1 | V1 REQUIRED | `requestErasureHandler.ts:27`, `listErasureRequestsHandler.ts:27` | Resolve tenant from subject person; scope list to resolved/authorized tenant (or make platform-wide explicitly by-design + test); add ER-P2-2 cross-tenant pins |
| Who may erase | **GAP-3**: only hardcoded platform-admin emails; clinic owner has no erasure path | P1 | `[NEEDS PRODUCT DECISION]` | role guards | Decide platform-admin-only vs dentist_owner-initiated (+platform approve); shapes GAP-1 UI |
| FR8.14 retention review | **GAP-4**: no policy view/edit surface (raw SQL only) — "review per jurisdiction" inoperable; PRD-vs-spec conflict (visible-in-Settings vs data-only) | P1 | V1 REQUIRED (read at minimum) | no endpoints | Read-only policy list + status (reuse `summarizeRetentionEnforcement`) in Settings; edit can defer |
| Retention coverage honesty | **GAP-5**: clinical/visit/prescription targets declared but unenforceable (no facades, disabled) | P2 | V1 RECOMMENDED `[NEEDS CONFIRMATION]` (are they V1-required per locale tables?) | `RETENTION_TARGETS` vs `DEFAULT_RETENTION_POLICIES` | Either wire facades per domain or document 2-target V1 scope explicitly |
| Live enforcement proof | **GAP-6**: no `dryRun:false` end-to-end test through real facades | P2 | V1 REQUIRED `[TEST GAP]` | engine tests use injected targets | RED-first integration: enforced run → attachment archived (`deletedAt` set), audit `retention.enforced` |
| Spec/impl drift | **GAP-7**: TypeSpec roles `user` vs enforced admin (8 ops) | P2 | V1 RECOMMENDED | tsp files | Fix TypeSpec roles → regen (no behavior change) |
| Missing spec | **GAP-8**: no dental-erasure MODULE_SPEC | P3 | V1 RECOMMENDED `[BLOCKED BY MISSING SPEC]` | docs tree | Author spec from verified behavior (after GAP-3 decision) |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Retention observability summarizer | `retention-status.ts` | engineering addition (Batch 4) | none | Keep; surface via GAP-4 |
| Dry-run-first enforcement design | engine | spec-sanctioned | none | Keep |
| Erasure dry-run + fileIdsPendingS3Delete return | service | inferred good practice | none | Keep |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Erasure request→approve→anonymize (WF-088) | patient→admin | RA-10173/GDPR request | request → review → approve (hold-checked) → anonymize + S3 delete → audit survives | Backend complete; **no operator surface** | **GAP-1/2/3** | service + targets |
| Legal hold lifecycle | admin/compliance | litigation | place → blocks erasure+retention → release | Backend complete; no UI | **GAP-1** | facade + pins |
| Retention sweep (WF-RET-002) | system | daily 03:30 cron | evaluate enabled policies → dry-run/enforce → audit events | Implemented (env-gated) | GAP-5/6 | jobs/index.ts |
| Retention policy review | owner/compliance | jurisdiction audit | view policies + last-run status | **Missing surface** | **GAP-4** | no endpoints |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Request erasure | audited `requested` row | Implemented (BE) | service :49-82 | V1 REQUIRED | UI missing |
| Hold check on approve | refuse under active hold | Implemented ×4 axes | :107 etc. | V1 REQUIRED | done — do not re-litigate |
| Anonymize engine | targets redacted; audit untouched | Implemented | targets file | V1 REQUIRED | done |
| S3 physical delete | files removed | Implemented | storage util | V1 REQUIRED | done |
| Tenant resolution | subject→tenant validated | Missing | GAP-2 | V1 REQUIRED | |
| Operator UI (erasure+hold) | reachable workflow | Missing | GAP-1 | V1 REQUIRED | after GAP-3 |
| Retention dry-run default | no mutation unless env-gated | Implemented | jobs :13-21 | V1 REQUIRED | done |
| Hold-exempt retention | legal-held excluded | Implemented | facade batch check | V1 REQUIRED | done |
| Policy review surface | visible in Settings | Missing | GAP-4 | V1 REQUIRED | read-only first |
| Enforced-mode proof | real archive verified | Missing test | GAP-6 | V1 REQUIRED | TEST |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Patient exercises right-to-erasure | patient→operator | request logged + processed | Backend only | GAP-1/3 | V1 REQUIRED | 0 consumers |
| Compliance officer reviews erasure queue | admin | list + approve/reject | Backend only (cross-tenant list) | GAP-1/2 | V1 REQUIRED | |
| Place litigation hold before erasure | admin | hold blocks erasure | Backend verified; no UI | GAP-1 | V1 REQUIRED | 4-axis pins |
| Owner reviews retention posture | dentist_owner | see policies + last run | Missing | GAP-4 | V1 REQUIRED | |
| Aged appointments auto-archived | system | 1y cutoff enforced | Implemented (env-gated) | GAP-6 proof | V1 REQUIRED | tests |
| Clinical-record retention per locale | system | 10y PH etc. enforced | Declared, unenforceable | GAP-5 | V1 RECOMMENDED `[NC]` | disabled seeds |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| GAP-1 zero governance UI | FE affordance / compliance | P1 | V1 REQUIRED | 8 ops, 0 consumers | Legal obligations (erasure, litigation hold) cannot be executed by any operator in-product | Minimal admin surface post-GAP-3 |
| GAP-2 erasure tenancy | security/tenancy | P1 | V1 REQUIRED | body tenantId unchecked; cross-tenant list | The platform's worst prior bug class (EM-BIL-002) recurring in its most sensitive module; only platform-admin gating contains it | subject→tenant resolution + scoped list + pins |
| GAP-3 who-may-erase | product decision | P1 | `[NEEDS PRODUCT DECISION]` | hardcoded emails | Blocks GAP-1 design; SMB clinics can't depend on platform staff forever | decide |
| GAP-4 retention review surface | operability | P1 | V1 REQUIRED | raw-SQL-only | Compliance feature that auditors/owners cannot see violates FR8.14 | read-only Settings panel |
| GAP-6 enforced-mode unproven | test integrity | P2 | V1 REQUIRED `[TEST GAP]` | injected-target tests only | First production enable of `RETENTION_ENFORCEMENT_ENABLED` would be the first real run | integration RED |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Patient requests erasure at clinic | staff records request | No surface; platform email required | GAP-1/3 | P1 | post-decision FE tests |
| Compliance lists pending erasures | own-tenant queue | all-tenant rows | GAP-2 | P1 | cross-tenant pin (B sees 0 of A) |
| Owner shows auditor retention policy | Settings page | raw SQL | GAP-4 | P1 | FE read panel test |
| Ops enables enforcement | proven behavior | unproven path | GAP-6 | P2 | enforced-run integration |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| 5 erasure ops + 3 legal-hold ops | API, 0 FE consumers | spine + grep | compliance undeliverable | Wire per GAP-1 |
| `summarizeRetentionEnforcement` | backend util, no surface | retention-status.ts | none | Surface in GAP-4 |
| clinical/visit/prescription retention policies | seeded disabled, facade-less | defaults | advertised-but-inert | GAP-5 |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Erasure FSM + terminal states sound | schema | erasure-request.schema :24-29 | — | none |
| `delete` action engine-downgraded to archive; audit protected | backend invariant | engine :7-20, :48-51 | — | none (strong) |
| Scheduler exists platform-wide (`core/jobs.ts`; 7 modules register) — corrects billing/visit-plan "no scheduler" mechanism claims | platform | `app.ts:286-290` | — | billing overdue + visit lock fixes = register crons on existing scheduler (much smaller than previously planned) `[SHARED DEPENDENCY]` |
| ER-P2-1 `{data}` envelope conformance | API | handler :26 + hurl | — | fixed (Batch 3) — do not re-fix |
| tenantId trusted from body | API | GAP-2 | P1 | resolve server-side |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| All 8 ops platform-admin-gated (403 pins) | role guards | handlers :18/:22 | — | none (but see GAP-3) |
| Cross-tenant list/approve surface unguarded beneath admin gate | tenancy | GAP-2 | P1 | fix + pin |
| TypeSpec declares `user` roles vs enforced admin | spec drift | tsp ×8 | P2 | GAP-7 |
| SL-08 sync-leak fix (adjacent class) verified separately | tenancy | Batch 1 | — | none |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Audit trail never erased; erasure events persist post-anonymization | compliance trail | Batch-2 pin | — | none (verified) |
| Clinical/billing records preserved de-identified | clinical/financial record | targets design | — | none |
| Erasure/hold rows retained indefinitely | governance trail | schemas | — | none |
| Retention never hard-deletes; protected targets refused | record survival | engine invariants | — | none |

## 16. Knowledge Graph Findings

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Whole group is backend-only: 8/8 ops zero-consumer | spine + grep | operability gap, not rot | GAP-1 |
| `isPersonUnderLegalHold`/`personsUnderLegalHold` facade consumed by erasure + retention — single enforcement point | facade | clean blast-radius | keep facade frozen during UI work |
| **Scheduler discovery:** `core/jobs.ts` consumed by email/notifs/audit/booking/retention/scheduling/patient — billing + visit conspicuously absent | app.ts | rewrites two prior plans' shared-dependency framing | propagate correction (done in those plans' errata) |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| RA-10173 erasure is a real PH-market obligation with deadlines | DATA_GOVERNANCE | GAP-1/3 are legal-operability, not polish | P1 |
| Litigation holds must be placeable same-day by practice counsel request | legal-hold spec intent | GAP-1 | P1 |
| Retention defaults differ per locale (10y PH clinical) | §2 tables | GAP-5 confirmation matters for PH launch | confirm scope |

## 18. Webwright / Playwright Findings

Not used — no UI exists to drive; absence is the finding. No evidence files saved.

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `erasure-engine/service/routes/legalhold/targets` tests (7 files) | backend | FSM, hold-block, anonymize markers, audit-survives pin | High |
| `legal-hold-*` (3 files) | backend | place/list/release, AC-LH pins | High |
| `retention-*` (8 files incl. defaults, appointment, legalhold, status) | backend | invariants, seeds, cutoffs, observability | High |
| `dental-erasure.hurl` (33) + `dental-legalhold.hurl` (21) | contract | live-server flows incl. `$.data` envelope | High |
| FE/E2E | — | **none** | — |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Cross-tenant erasure pins: org-B admin sees 0 of org-A; wrong-tenant approve refused (ER-P2-2) | backend/permission | GAP-2 RED-first | Before |
| Enforced-mode retention integration (`dryRun:false` → real archive + audit) | integration | GAP-6 | Before enabling env flag |
| Erasure/hold FE tests (queue renders, approve role-gated, hold badge) | frontend/component | GAP-1 RED-first | Before (post-GAP-3) |
| Governance E2E (request→hold-block→release→approve→anonymized badge) | E2E | first browser-level proof of headline invariant | During |
| TypeSpec role regen contract pins | contract | GAP-7 | During |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| `core/jobs.ts` scheduler | shared/platform `[SHARED DEPENDENCY]` | app.ts | billing overdue + visit lock should register here (NOT build new mechanism) | correction propagated to those plans |
| Anonymize engine touches person/patient/consent/imaging + S3 | cross-module `[CROSS-MODULE RISK]` | targets | UI work must not alter target semantics | UI-only wiring |
| Legal-hold facade consumed by erasure + retention | module-local→shared | facade | single enforcement point | freeze during fixes |
| Who-may-erase decision | product decision | GAP-3 | blocks GAP-1 | escalate |
| Erasure spec authorship | product/docs | GAP-8 | prevents future drift | after GAP-3 |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Subject→tenant resolution + scoped list + cross-tenant pins | GAP-2 | P1 | V1 REQUIRED | backend RED ×2 | independent of decisions; do first |
| Read-only retention policy + status panel in Settings | GAP-4 | P1 | V1 REQUIRED | FE RED | reuse summarizer |
| Enforced-mode integration test | GAP-6 | P2 | V1 REQUIRED | integration RED | before any env enable |
| Erasure+hold admin UI | GAP-1 | P1 | V1 REQUIRED (post-Q1) | FE RED + E2E | after GAP-3 |
| TypeSpec role corrections ×8 + regen | GAP-7 | P2 | V1 RECOMMENDED | contract | no behavior change |
| Author dental-erasure MODULE_SPEC | GAP-8 | P3 | V1 RECOMMENDED | none | post-Q1 |
| Wire clinical/visit/prescription retention facades | GAP-5 | P2 | `[NEEDS CONFIRMATION]` | per-facade tests | only if V1-required |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Art-20 bulk export format | V2 DEFERRED | spec-declared pending PRD decision |
| Retention policy EDIT surface | V2 DEFERRED | read-only satisfies FR8.14 review need first |
| Patient-facing erasure self-service (portal) | V2 DEFERRED | portal Phase-2 |
| Column-level PHI encryption | V2 DEFERRED | DATA_GOVERNANCE §1.2 defense-in-depth |
| New retention actions/targets beyond declared set | DO NOT ADD `[DO NOT OVERBUILD]` | safety surface; expand only with locale evidence |
| pg-boss / new job framework | DO NOT ADD | `core/jobs.ts` exists and suffices |

## 24. Audit Decision

**PARTIAL PASS.**

The safety core passes convincingly: legal-hold-blocks-erasure is enforced and tested on four independent axes, anonymization preserves the clinical record and the audit trail (pinned), S3 media is physically destroyed, and retention runs on a real scheduler with dry-run-default and four engine-enforced invariants. Batch 2/3/4 fixes are all verified landed.

It is not a PASS because the group is **inoperable and tenancy-rough**: every one of its 8 operations has zero FE (legal workflows are API-only), the erasure endpoints trust body-supplied tenantId and list across tenants (contained only by platform-admin gating, untested), who-may-erase is undecided, retention policies can only be reviewed via SQL, and enforced-mode has never been proven end-to-end. Nothing found violates the safety invariants — hence not a FAIL.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Q1: Who may initiate/approve erasure — platform admin only, or clinic dentist_owner (+platform approval)? | `[NEEDS PRODUCT DECISION]` | GAP-1/3 UI + RBAC shape | Product/Legal |
| Q2: Is cross-tenant erasure visibility intended for platform-admin (by-design) or must it scope? | `[NEEDS PRODUCT DECISION]` (lean: scope + explicit platform override) | GAP-2 fix shape | Product/Eng |
| Q3: Are clinical/visit/prescription retention targets V1-required for PH launch? | `[NEEDS CONFIRMATION]` | GAP-5 | Product/Legal |
| Q4: Session TTL posture (ADR-007 open item flagged in DATA_GOVERNANCE §7) | `[NEEDS PRODUCT DECISION]` | compliance sign-off blocker noted by docs | Product/Eng |

## 26. Notes for Gap Plan Organizer

- **Truly V1 (decision-free):** GAP-2 (tenancy resolution + pins — do FIRST, pure backend), GAP-4 (read-only retention panel), GAP-6 (enforced-mode test), GAP-7 (TypeSpec roles).
- **Likely batch shape:** Batch A = GAP-2 backend + pins; Batch B = GAP-6 integration test; Batch C = GAP-4 read-only panel; Batch D (post-Q1) = GAP-1 admin UI + E2E; GAP-7 rides any TypeSpec touch; GAP-8 spec doc after Q1.
- **Blocked until decided:** GAP-1 full UI (Q1), GAP-2 final scoping semantics (Q2 — but subject→tenant resolution is safe under either answer), GAP-5 (Q3).
- **Must NOT implement:** §23 — no new job framework, no retention-action expansion, no portal self-service.
- **Tests first:** cross-tenant pins; enforced-mode integration; FE queue RED post-Q1.
- **Cross-module:** scheduler correction propagated to dental-billing/dental-visit plans (their scheduler-shaped fixes shrink to cron registrations); anonymize targets frozen; legal-hold facade frozen.
- **Do not re-litigate:** 4-axis hold enforcement, anonymize/audit-survival, S3 delete, ER-P2-1 envelope, retention G2 observability, dry-run invariants.

---

Next recommended step:
Module/group: Data Governance
Module slug: data-governance
Primary PRD/spec: docs/prd/v3-dentalemon.md FR2.19/FR8.14 + docs/product/modules/legal-hold/ + retention/ + DATA_GOVERNANCE.md
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/data-governance-gap-plan.md
