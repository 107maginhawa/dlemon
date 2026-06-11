# AHA Fix-Ready Plan: Data Governance (Erasure · Legal Hold · Retention)

**Generated:** 2026-06-11 · **Prompt:** `docs/aha/prompts/03-organize-gap-plan-for-fixing.md` · **Branch:** `chore/workflow-verification-sweep`

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Data Governance (dental-erasure + dental-legalhold + retention) |
| Module slug | data-governance |
| Source gap plan | `docs/aha/module-gap-plans/data-governance-gap-plan.md` |
| Output file | `docs/aha/module-fix-plans/data-governance-fix-ready-plan.md` |
| Audit decision | PARTIAL PASS |
| Superpowers used | No — organizer discipline applied via shared rules (§19 Gap Organizer Rules; no implementation, no tests, no re-audit) |
| Organizer decision | PARTIALLY READY |
| Reason | Three decision-free batches (A: erasure tenancy, B: enforced-mode proof, C: retention read API + TypeSpec role truth) are fully fix-ready and executable now. Two P1 batches are blocked: the retention Settings panel (Batch D) waits on dental-org's shared settings-shell batch `[CROSS-MODULE RISK]`, and the erasure/legal-hold admin UI (Batch E) waits on the who-may-erase product decision (Q1) `[NEEDS PRODUCT DECISION]`. |
| Limitations | Source files cited in the gap plan were re-read to confirm fix-readiness (handlers, TypeSpec, retention status/jobs); no tests were executed. Erasure subject→tenant resolution mechanics (via patient row vs membership) marked `[NEEDS CONFIRMATION]` for the executor to verify in repos before coding. The dental-org fix-ready plan (`docs/aha/module-fix-plans/dental-org-fix-ready-plan.md`) is the cross-referenced owner of the settings shell; if not yet written when Batch D is attempted, Batch D stays blocked. |

Organizer verification notes (corrections/clarifications, not gap-plan rewrites):

- Confirmed `requestErasureHandler.ts:25-30` passes `tenantId: body.tenantId` straight into `requestErasure()` and `listErasureRequestsHandler.ts:25-29` only applies a caller-supplied optional `tenantId` filter — GAP-2 evidence is accurate and fix-ready.
- Confirmed TypeSpec drift: `specs/api/src/modules/dental-erasure.tsp` (lines 101/114/129/143/159) and `specs/api/src/modules/dental-legal-hold.tsp` (lines 75/88/103) all declare `x-security-required-roles: ["user"]` while every handler enforces `user.role !== 'admin'` → 403. GAP-7 is exactly 8 one-line spec edits + regen.
- Confirmed retention has **no TypeSpec module and no HTTP surface** — GAP-4's backend half is a new (small) TypeSpec vertical, not a wiring fix.
- Confirmed `summarizeRetentionEnforcement` (`retention-status.ts`) and the daily 03:30 cron registration (`retention/jobs/index.ts:19` on `core/jobs.ts`) exist as cited. Any retention scheduling work is a registration on the **existing** scheduler — do not plan a new framework `[DO NOT OVERBUILD]`.

## 2. Fix Strategy Summary

- **Fix first:** Batch A — erasure tenancy hardening (GAP-2). Pure backend, decision-free, and it closes the platform's worst recurring bug class (EM-BIL-002 pattern: trusted/omitted tenant scoping) in its most sensitive module. It is currently contained only by platform-admin role gates with zero cross-tenant tests.
- **Then:** Batch B (enforced-mode retention integration test — must exist before anyone flips `RETENTION_ENFORCEMENT_ENABLED`), then Batch C (read-only retention HTTP surface + the 8 TypeSpec role corrections riding the same TypeSpec→regen cycle).
- **Do not fix yet:** the governance FE. The retention Settings panel (Batch D) mounts in the **dental-org-owned shared settings shell** and must wait for that batch to land (see §7). The erasure/legal-hold admin UI (Batch E) is blocked on product decision Q1 (who may erase).
- **Do not fix at all:** anything in §11 — no new job framework, no new retention actions/targets, no standalone settings shell, no portal self-service, and do not re-litigate the verified safety core (4-axis hold enforcement, anonymize/audit-survival, S3 delete, ER-P2-1 envelope, G2 observability, dry-run invariants).
- **Major risks:** (1) Batch A touches `erasure-service.ts`, which sits beside the frozen anonymize-targets and legal-hold facade — fixes must be tenancy-only, no target/facade semantic changes `[CROSS-MODULE RISK]`. (2) Batch C introduces retention's first HTTP surface against a module spec that declared "no HTTP surface by design" — the PRD (FR8.14) wins, and the spec correction should be noted in the fix report. (3) Batch B's RED test may expose real facade bugs on the never-proven `dryRun:false` path — that is the point; fix minimally if so.
- **Multiple batches, multiple `04` passes:** A and B can run in one `04` pass (both backend, independent); C should be its own pass (TypeSpec→regen cycle); D and E are blocked.
- **Shared/platform/database work:** no DB schema changes anticipated. TypeSpec/regen work (Batches A-optional, C) touches generated artifacts shared with `sdk-ts` — standard regen workflow, isolated to Batch C by design.

## 3. Active Fix Scope

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | GAP-2a: erasure trusts body-supplied `tenantId`; subject→tenant never resolved server-side | P1 | V1 REQUIRED | A | Tenancy integrity in the most sensitive module; decision-free (gap plan: "safe under either Q2 answer") | `requestErasureHandler.ts:27`, `erasure-service.ts:49-82` |
| FIX-002 | GAP-2b/ER-P2-2: list returns all tenants; approve has no wrong-tenant guard; zero cross-tenant tests | P1 | V1 REQUIRED | A | Cross-tenant list/approve surface has no pin of its own; lean default (scope + explicit platform-admin override) is executable now, revisitable if Q2 answers differently | `listErasureRequestsHandler.ts:25-29`; gap plan §10 GAP-2, §20 row 1 |
| FIX-003 | GAP-6: no end-to-end `dryRun:false` retention test through real facades | P2 | V1 REQUIRED `[TEST GAP]` | B | First production enable of `RETENTION_ENFORCEMENT_ENABLED` must not be the first real run | engine tests use injected targets only; gap plan §10 GAP-6 |
| FIX-004 | GAP-4 (backend half): no HTTP read surface for retention policies + enforcement status | P1 | V1 REQUIRED | C | FR8.14 "visible in Settings" inoperable without an API; FE (FIX-006) cannot exist without it; reuses existing `summarizeRetentionEnforcement` | no retention `.tsp` exists; `retention-status.ts:42-70` |
| FIX-005 | GAP-7: TypeSpec declares `["user"]` on all 8 erasure/legal-hold ops; handlers enforce admin | P2 | V1 RECOMMENDED | C | Low-risk, no behavior change, prevents future clients building against a misleading contract; rides Batch C's TypeSpec→regen cycle | `dental-erasure.tsp:101,114,129,143,159`; `dental-legal-hold.tsp:75,88,103` |
| FIX-006 | GAP-4 (FE half): read-only retention policy + status panel in Settings | P1 | V1 REQUIRED | D (blocked) | Completes FR8.14; owner/auditor-facing, decision-free — blocked only on the dental-org settings shell | gap plan §11 row 3 |
| FIX-007 | GAP-1: zero FE for 5 erasure + 3 legal-hold ops (compliance workflows API-only) | P1 | V1 REQUIRED `[NEEDS PRODUCT DECISION]` | E (blocked) | Legal-operability gap (RA-10173/GDPR), but UI shape depends entirely on Q1 (who may erase) | contract-spine: 8/8 ops `consumers: []`, grep-verified |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| Batch A — Erasure tenancy hardening | Resolve subject→tenant server-side; stop trusting body `tenantId`; pin cross-tenant list/approve semantics | FIX-001, FIX-002 | Medium (touches `erasure-service.ts`; must not alter anonymize-target or hold-check semantics) | **Run in current `04` pass — FIRST** |
| Batch B — Enforced-mode retention proof | RED-first integration test of `dryRun:false` through real `RETENTION_TARGETS` facades | FIX-003 | Low-Medium (test-only unless RED exposes a real facade bug; never run against shared `monobase_test` template-polluting flows — use the integration harness) | Run in current `04` pass (after A; independent) |
| Batch C — Retention read API + TypeSpec role truth | New read-only retention TypeSpec ops + handlers; fix 8 role declarations; one regen cycle | FIX-004, FIX-005 | Medium (TypeSpec→regen touches generated artifacts + sdk-ts; no behavior change for FIX-005) | Split into separate `04` pass |
| Batch D — Retention Settings panel (FE) | Mount read-only policy + status panel in the shared settings shell | FIX-006 | Low (read-only UI) | **Only after dental-org's settings-shell batch lands** (`docs/aha/module-fix-plans/dental-org-fix-ready-plan.md`) and Batch C is done |
| Batch E — Governance admin UI + E2E | Erasure queue/request/approve/reject + hold place/list/release UI; first governance E2E | FIX-007 | Medium-High (new compliance-critical UI) | **Only after product decision Q1** (and after the dental-org settings shell, since it likely mounts there too) |

Batch A note for the executor: prefer the backend-only shape — server resolves tenant from the subject and **validates** any body-supplied `tenantId` (mismatch → 4xx); defer *removing* the body field from the contract to Batch C's TypeSpec cycle so Batch A needs no regen.

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | Forged-tenant request RED test: create erasure request with body `tenantId` ≠ subject's real tenant → resolved server-side / rejected; correct tenant persisted on the row | backend/unit + permission/RBAC | Server, not caller, owns tenant assignment | New `services/api-ts/src/handlers/dental-erasure/erasure-tenancy.test.ts` (or extend `erasure-service.test.ts`) |
| FIX-002 | Cross-tenant pins (ER-P2-2): (a) wrong-tenant approve refused; (b) list scoping semantics explicit — scoped by default, platform-admin all-tenant view only as an explicit, tested override | backend/permission/RBAC + contract | Org-B context sees 0 of org-A's requests; approve cannot cross tenants; the chosen semantics are pinned, not accidental | Same new test file + extend `specs/api/tests/contract/dental-erasure.hurl` |
| FIX-003 | Enforced-run integration RED: seed an aged attachment past cutoff + one legal-held subject + audit rows → run engine `dryRun:false` through real `RETENTION_TARGETS` facades | integration | Eligible attachment archived (`deletedAt` set), `retention.enforced` audit event written, legal-held record untouched, audit table untouched | New `services/api-ts/src/handlers/retention/retention-enforced-run.test.ts` |
| FIX-004 | Handler RED tests for `GET` retention policies + status (admin/owner-gated per existing module conventions); then contract requests | backend/unit + contract | Policies list returns seeded rows; status returns `summarizeRetentionEnforcement` shape; role-gated 403 pin | New tests beside `retention-status.test.ts`; new `specs/api/tests/contract/retention.hurl` (or extend an existing governance suite) |
| FIX-005 | Contract pins after regen: spec roles = admin on all 8 ops; existing 403 pins stay green (proves no behavior change) | contract + regression | Spec now matches enforcement; nothing behavioral moved | Existing `dental-erasure.hurl` (33 req) + `dental-legalhold.hurl` (21 req) re-run; spec assertion in regen check |
| FIX-006 | FE component RED: panel renders policy rows + last-run mode/time from SDK hooks; loading/empty/error states; no edit affordances | frontend/component | API and UI agree; FR8.14 review surface real | New component tests under `apps/dentalemon/src/` settings feature area (final path follows dental-org shell conventions) |
| FIX-007 | FE component RED (queue renders, approve role-gated, hold badge) + one governance E2E: request → hold blocks approve → release → approve → anonymized badge | frontend/component + E2E/Playwright | First browser-level proof of the headline invariant chain | New FE tests + new Playwright spec (post-Q1; one E2E only — core journey, not per-widget) |

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `services/api-ts/src/handlers/dental-erasure/requestErasureHandler.ts`, `erasure-service.ts` (request path :49-82 only), `repos/erasure-request.repo.ts`, possibly a person/patient lookup for subject→tenant resolution `[NEEDS CONFIRMATION]` (verify resolution source in repos before coding) | module-local (reads cross-module data via existing facades/repos only) | Small — erasure request creation path; do not touch approve/anonymize path semantics |
| FIX-002 | `listErasureRequestsHandler.ts`, `approveErasureHandler.ts` (+ `rejectErasureHandler.ts` for symmetry), `utils/erasure-validators.ts`; `specs/api/tests/contract/dental-erasure.hurl` | module-local | Small — list/approve guards; platform-admin 403 pins must stay green |
| FIX-003 | New test file only (`handlers/retention/retention-enforced-run.test.ts`); `retention-targets.ts` / facades **only if RED exposes a real bug** | module-local | Test-only nominal; bounded bug-fix if RED |
| FIX-004 | New `specs/api/src/modules/retention.tsp` (or `dental-retention.tsp`); regen (`specs/api` build → `services/api-ts` generate → sdk regen); new `handlers/retention/getRetentionPolicies*.ts`, `getRetentionStatus*.ts`; route registry (generated) | shared/platform (generated artifacts + sdk-ts via standard regen) | Medium — regen cycle; additive ops only, no existing op changes |
| FIX-005 | `specs/api/src/modules/dental-erasure.tsp` (5 lines), `dental-legal-hold.tsp` (3 lines); regen artifacts | shared/platform (spec/regen) | Small — declaration-only; zero handler changes |
| FIX-006 | `apps/dentalemon/src/` settings feature area (panel component + SDK hook wiring) — exact mount point defined by dental-org settings-shell batch | cross-module (mounts in dental-org-owned shell) | Small once shell exists |
| FIX-007 | `apps/dentalemon/src/` new governance admin feature + route; Playwright spec | cross-module (shell mount) + module-local FE | Medium — new compliance UI |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-006, FIX-007 | cross-module `[CROSS-MODULE RISK]` | **dental-org owns the shared settings shell** (governance retention panel + org consent-templates + PMD cert panel all mount there) — see `docs/aha/module-fix-plans/dental-org-fix-ready-plan.md` | Pre-decided by orchestrator: do NOT build a standalone settings shell here; the retention panel is a mount in dental-org's shell | **Yes** — dental-org settings-shell batch must land first |
| FIX-007 | product decision | Q1: who may initiate/approve erasure (platform admin only vs `dentist_owner` + platform approval) | Determines RBAC, routes, and entire UI shape | **Yes** |
| FIX-002 | product decision (partial) | Q2: cross-tenant erasure visibility intent | Final list semantics; gap plan lean = scope + explicit platform override — executable now, pinned, revisitable | No (proceed with lean; flag in fix report) |
| FIX-001, FIX-002 | cross-module `[CROSS-MODULE RISK]` | Anonymize-target set (`erasure-targets.ts`) and `legal-hold.facade.ts` are **frozen** — single enforcement points consumed by erasure + retention | Tenancy fixes must not alter target or hold-check semantics | N/A — constraint, not prerequisite |
| FIX-003 | environment/tooling | Integration DB harness (`scripts/test-with-db.ts` pattern); never pollute the shared `monobase_test` template with server/contract flows | Enforced-mode test mutates data; must run in the proper harness | Yes (existing tooling — no new work) |
| FIX-004, FIX-005 | shared/platform `[SHARED DEPENDENCY]` | TypeSpec→OpenAPI→regen pipeline (`specs/api` build, `services/api-ts` generate, sdk-ts regen as separate step) | Touches generated shared artifacts; standard workflow, isolate to Batch C | No — handled inside Batch C |
| (context) | shared/platform | `core/jobs.ts` scheduler **already exists** (wired `app.ts:286-290`; retention cron at `jobs/index.ts:19`) | Any scheduled-work idea = cron registration on the existing scheduler; never a new framework `[DO NOT OVERBUILD]` | N/A |
| (context) | missing spec `[BLOCKED BY MISSING SPEC]` | No dental-erasure MODULE_SPEC (GAP-8) | Author from verified behavior after Q1; does not block Batches A–C | No |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Q1: Who may initiate/approve erasure — platform admin only, or clinic `dentist_owner` (+ platform approval)? | `[NEEDS PRODUCT DECISION]` | FIX-007 (shape), FIX-005 (final role names if Q1 lands before Batch C) | Blocks all of Batch E; determines RBAC + UI | Escalate to cross-module decision queue (Product/Legal). If undecided when Batch C runs, set TypeSpec roles to current enforcement (`admin`) — still correct under any Q1 outcome that adds roles later |
| Q2: Cross-tenant erasure visibility — platform-admin all-tenant by design, or tenant-scoped? | `[NEEDS PRODUCT DECISION]` (non-blocking) | FIX-002 | Final list semantics | Proceed now with gap plan's lean (scoped + explicit platform-admin override), pin it, and record in the fix report for ratification |
| Q3: Are clinical/visit/prescription retention targets V1-required for PH launch (10y clinical)? | `[NEEDS CONFIRMATION]` | Deferred GAP-5 | Decides whether 3 disabled, facade-less targets get wired or the 2-target V1 scope gets documented | Escalate to decision queue; until answered, GAP-5 stays deferred |
| Q4: Session TTL posture (ADR-007 open item, DATA_GOVERNANCE §7) | `[NEEDS PRODUCT DECISION]` | none in this module | Compliance sign-off blocker noted by docs, not a governance-module fix | Route to decision queue; out of scope for `04` here |
| Subject→tenant resolution source (patient row vs membership vs person link) | `[NEEDS CONFIRMATION]` | FIX-001 | Executor must verify the canonical resolution path in erasure/person repos before coding | Resolve during Batch A RED-test design (verification, not a product decision) |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| Batch D — FIX-006 retention Settings panel | `[CROSS-MODULE RISK]` | Mounts in the dental-org-owned shared settings shell; building a local shell is forbidden (orchestrator pre-decision) | dental-org settings-shell batch lands (`docs/aha/module-fix-plans/dental-org-fix-ready-plan.md`); Batch C provides the API |
| Batch E — FIX-007 erasure + legal-hold admin UI + E2E | `[NEEDS PRODUCT DECISION]` | UI shape, RBAC, and routes depend on Q1 | Q1 decided; settings shell available |
| GAP-5 — wire clinical/visit/prescription retention facades | `[NEEDS CONFIRMATION]` | Targets seeded `enabled:false`, facade-less; whether they are V1-required per locale tables is unconfirmed (Q3) | Q3 answered; if yes → its own future batch (per-facade RED tests); if no → document 2-target V1 scope |
| GAP-8 — author dental-erasure MODULE_SPEC | `[BLOCKED BY MISSING SPEC]` (it IS the missing spec) | Spec must encode the Q1 answer to avoid immediate drift | Q1 decided; author from verified behavior (docs-only, P3) |

## 10. Deferred Items

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Wire clinical/visit/prescription retention targets | GAP-5 | V1 RECOMMENDED `[NEEDS CONFIRMATION]` | Q3 unanswered; wiring enforcement facades without confirmed locale requirement risks overbuilding a safety surface |
| dental-erasure MODULE_SPEC authorship | GAP-8 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` | P3 docs work; pointless before Q1 (would encode a guess) |
| Art-20 bulk export format | gap plan §23 | V2 DEFERRED | Spec-declared deferral pending PRD decision; per-visit PMD + patient export already exist |
| Retention policy EDIT surface | gap plan §23 | V2 DEFERRED | Read-only (FIX-004/006) satisfies FR8.14's review need first |
| Patient-facing erasure self-service (portal) | gap plan §23 | V2 DEFERRED | Portal is Phase-2 |
| Column-level PHI encryption | gap plan §23 | V2 DEFERRED | DATA_GOVERNANCE §1.2 defense-in-depth item, not a governance-module V1 gap |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| New job/cron framework (pg-boss etc.) | gap plan §23 / KG scheduler finding | `core/jobs.ts` exists, is wired (`app.ts:286-290`), and 7 modules already register on it. Any scheduled work = `registerCron` on the existing scheduler `[DO NOT OVERBUILD]` |
| New retention actions or targets beyond the declared set | gap plan §23 | Retention is a safety surface; expand only with locale-table evidence (Q3) `[DO NOT OVERBUILD]` |
| Standalone settings shell inside this module | orchestrator pre-decision | dental-org owns the shared settings shell; duplicate shells would fork navigation and RBAC (`docs/aha/module-fix-plans/dental-org-fix-ready-plan.md`) |
| Re-fixes of the verified safety core | gap plan §26 "do not re-litigate" | 4-axis hold-blocks-erasure, anonymize/audit-survival pin, S3 physical delete, ER-P2-1 `{data}` envelope, retention G2 observability, dry-run invariants — all verified landed; touching them adds risk for zero value |
| Erasure UI ahead of Q1 | GAP-1/GAP-3 | Building speculative RBAC/UI before who-may-erase is decided guarantees rework on a compliance-critical surface |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | Handler trusts caller-supplied tenancy instead of deriving it from the subject — same root class as EM-BIL-002. Server-side resolution fixes the cause, not the symptom |
| FIX-002 | Root cause (semantics) + pin | List/approve were written without explicit tenancy semantics; the fix makes the chosen semantics explicit and pinned so containment no longer rests solely on the admin role gate |
| FIX-003 | Test gap (root-cause coverage) | Not a code bug (none known); closes the gap that the highest-risk mutation path has never executed against real facades |
| FIX-004 | Root cause | Retention spec's "no HTTP surface by design" conflicts with PRD FR8.14; resolving toward the PRD (read-only surface) removes the conflict — note the spec correction in the fix report |
| FIX-005 | Root cause | TypeSpec authored with a default `["user"]` placeholder; impl is stricter (safe) but the spec misleads — fix the declaration, regen, zero behavior change |
| FIX-006 / FIX-007 | Root cause | FE was simply never built (8/8 ops zero-consumer); operability gap, not rot |

## 13. Recommended First Fix Batch

**Batch A — Erasure tenancy hardening** (FIX-001, FIX-002)

- **Why first:** Decision-free, pure backend, smallest blast radius among the P1s, and it closes the platform's most dangerous recurring bug class (caller-trusted tenancy) in the module holding the most sensitive operations. The gap plan's organizer notes name it explicitly: "GAP-2 … do FIRST, pure backend."
- **Tests to write first (RED):**
  1. Forged-tenant request: body `tenantId` ≠ subject's real tenant → server resolves/rejects; persisted row carries the resolved tenant (`erasure-tenancy.test.ts`).
  2. Cross-tenant pins (ER-P2-2): wrong-tenant approve refused; org-B context sees 0 of org-A's requests under the scoped-default semantics; platform-admin override (if implemented) is explicit and pinned.
  3. Contract: extend `specs/api/tests/contract/dental-erasure.hurl` with the tenancy assertions; all 33 existing requests + the platform-admin 403 pins must stay green.
- **Explicit out-of-scope for Batch A:** any TypeSpec/regen change (defer body-field removal to Batch C); any change to `erasure-targets.ts`, `legal-hold.facade.ts`, approve/anonymize semantics, or S3 deletion; any FE; Batches B–E.

## 14. Instructions for 04 Fix Prompt

- **Module/group name:** Data Governance (Erasure · Legal Hold · Retention)
- **Module slug:** `data-governance`
- **Fix-ready plan path:** `docs/aha/module-fix-plans/data-governance-fix-ready-plan.md`
- **Raw gap plan (context only):** `docs/aha/module-gap-plans/data-governance-gap-plan.md`
- **Execute first:** **Batch A** (FIX-001 + FIX-002) — then Batch B (FIX-003) in the same or next pass; Batch C in a separate pass (TypeSpec→regen).
- **Tests to prioritize:** new `services/api-ts/src/handlers/dental-erasure/erasure-tenancy.test.ts` (forged-tenant + cross-tenant pins, RED first), then `dental-erasure.hurl` extensions. Backend tests run via the `scripts/test-with-db.ts` pattern with the inline `monobase_test` DATABASE_URL — never `bun test <path>` directly, and never run server/contract flows against `monobase_test`.
- **Files likely touched (Batch A):** `requestErasureHandler.ts`, `erasure-service.ts` (request path only), `listErasureRequestsHandler.ts`, `approveErasureHandler.ts`/`rejectErasureHandler.ts`, `utils/erasure-validators.ts`, `repos/erasure-request.repo.ts`, `specs/api/tests/contract/dental-erasure.hurl`. Verify the subject→tenant resolution source in repos before coding `[NEEDS CONFIRMATION]`.
- **Shared/database cautions:** no DB migrations expected. `erasure-targets.ts` and `legal-hold.facade.ts` are frozen — tenancy-only changes. Keep all existing 403 pins and the audit-survives-erasure pin green. Restart the API server before running contract tests (stale server masks drift).
- **Do NOT implement:** Batch D (blocked on dental-org settings shell — `docs/aha/module-fix-plans/dental-org-fix-ready-plan.md`), Batch E (blocked on Q1), GAP-5 (blocked on Q3), GAP-8 spec doc, anything in §10/§11 (no new job framework, no new retention actions/targets, no standalone settings shell, no portal self-service, no re-fixes of the verified safety core).

---

Next recommended step:
Module/group: Data Governance (Erasure · Legal Hold · Retention)
Module slug: data-governance
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/data-governance-fix-ready-plan.md
Recommended batch: Batch A — Erasure tenancy hardening (FIX-001, FIX-002)
