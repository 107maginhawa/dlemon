# Module Audit — erasure / legal-hold / retention (data-governance layer)

**Date:** 2026-06-08
**Branch:** feat/module-workflow-alignment
**Auditor:** per-module deep audit + safe-gap closure (adversarial; verified against source)
**Verdict:** ✅ **READY** — the cross-cutting data-governance layer (WFG-006 / GDPR Art.17 / RA 10173 §34) is **substantially and correctly built** — far more complete than the prior memory ("retention/erasure is a deferred P1") suggested. It spans **three cooperating handler dirs** (`dental-erasure`, `dental-legalhold`, `retention`) with two TypeSpec modules, two MODULE_SPECs, the authoritative `DATA_GOVERNANCE.md` contract, 8 codegen-registered HTTP ops, an env-gated retention cron, and **77 passing tests**. **The headline invariant — LEGAL-HOLD-BLOCKS-ERASURE — is ENFORCED at the engine choke point AND consults the real `dental_legal_hold` store, and is TESTED on FOUR axes** (engine pure, erasure service real-store, HTTP route, retention real-store). All four governance MUST-VERIFY axes hold: legal-hold-blocks-erasure ✅, erasure-actually-redacts ✅ (asserts `firstName==='[ERASED]'`/contact nulled, not just 200), erasure-audited-and-audit-survives ✅ (**newly pinned this round**), retention-acts-only-on-expired-not-held ✅. No security/compliance hole found. Closed **2 REAL adversarial test gaps** (audit-survives-erasure; AC-LH-004 release-already-released illegal-FSM + release-nonexistent) and **5 doc/registry-drift items** (whole-module ABSENT from br-registry → added 6 rules; 2 stale "no legal-hold store exists yet" source comments contradicted by the code below them; WORKFLOW_MAP "Gap WFG-006 / PHI purge / no implementation" stale → resolved). Gates green.

---

## STEP 0 — Artifacts & /module-review

This is **NOT** a single neat `handlers/<module>` dir — it is a cross-cutting concern. The module universe (erasure ∪ legal-hold ∪ retention) resolves to:

| Artifact | Location | Status |
|----------|----------|--------|
| **Erasure** handlers | `services/api-ts/src/handlers/dental-erasure/` | ✅ `requestErasure`/`approveErasure`/`rejectErasure`/`getErasureRequest`/`listErasureRequests` (+ `*Handler.ts` HTTP wrappers); `erasure-service.ts` (request→approve/reject orchestration); `erasure-engine.ts` (anonymize choke point, hard invariants); `erasure-targets.ts` (Person/Patient/ConsentForm/Imaging via facades); `erasure-storage.ts` (physical S3 + file-row delete, fail-open); `repos/erasure-request.{schema,repo}.ts` |
| **Legal-hold** handlers | `services/api-ts/src/handlers/dental-legalhold/` | ✅ `placeLegalHold`/`listLegalHolds`/`releaseLegalHold` (+ `*Handler.ts`); `legal-hold-service.ts`; **`legal-hold.facade.ts`** (`isPersonUnderLegalHold` / `personsUnderLegalHold` — the predicate the engines consult); `repos/legal-hold.{schema,repo}.ts` |
| **Retention** (no HTTP — internal lib + cron) | `services/api-ts/src/handlers/retention/` | ✅ `retention-engine.ts` (policy-as-data evaluator, hard invariants); `retention-targets.ts` (attachment/appointment/audit-protected + legal-hold exclusion); `retention-defaults.ts` (org-seeding); `jobs/index.ts` (env-gated daily cron); `repos/retention-policy.{schema,repo}.ts`; **`README.md`** (the internal-lib README the prompt flagged) |
| TypeSpec | `specs/api/src/modules/dental-erasure.tsp` (5 ops), `dental-legal-hold.tsp` (3 ops). Retention has **no TypeSpec by design** (engine+cron, no HTTP). | ✅ |
| MODULE_SPEC | `docs/product/modules/retention/MODULE_SPEC.md`, `docs/product/modules/legal-hold/MODULE_SPEC.md` (both lightweight anchors TR-RET-001/TR-LH-001). **No `dental-erasure` MODULE_SPEC dir** — erasure is specified by `dental-erasure.tsp` + `DATA_GOVERNANCE.md §3` instead (surfaced, see gaps). | ✅ (erasure spec'd by DATA_GOVERNANCE + TSP) |
| Governance contract doc | `docs/product/DATA_GOVERNANCE.md` (§1 classification, §2 retention, §3 right-to-deletion, §4 portability, §5 consent) — **the authoritative spec, sole-owned by `/oli-domain-model`** | ✅ accurate to impl |
| Schema/migrations | `dental_erasure_request`, `dental_legal_hold`, `dental_retention_policy` (all decoupled — no FK to person/patient, mirroring audit) | ✅ |
| Jobs | `retention.enforcement` daily cron @ 03:30 (offset from audit retention 03:00), DRY-RUN unless `RETENTION_ENFORCEMENT_ENABLED=true`; wired `registerRetentionJobs(jobs)` from `app.ts:283` | ✅ |
| Tests | 14 `*.test.ts` (77 assertions) — engine (pure), service (DB), routes (real-wiring), legal-hold-store, s3-delete, retention defaults/targets/engine/appointment/legalhold/org-seeding/jobs, route-registration | ✅ |
| Routes | erasure + legal-hold codegen-registered (TR-DG-002); retention = none-by-design | ✅ |
| Contract | `dental-erasure.hurl` (33 req), `dental-legalhold.hurl` (21 req) | ✅ green vs fresh `:7213` |

**/module-review result:** **PASS** (run across all three dirs). No `test.skip`/`xit`/`.only`; no `Not implemented` stub; no TODO/FIXME/HACK; no non-test `as any`. All 8 TypeSpec `@operationId`s ↔ handler names match and are codegen-registered. All data-modification handlers audit (request/approve/reject/place/release/s3-delete each write a `compliance`- or `security`-class event). The `as any` and `eslint-disable no-explicit-any` survivors are confined to the `logger: any` boundary param (the established Logger-boundary convention).

---

## STEP 1–2 — Spec universe & conformance (governance-specific)

| Invariant | Spec | Impl | Conformance |
|-----------|------|------|-------------|
| **LEGAL-HOLD blocks erasure (headline)** | DATA_GOVERNANCE §3 / legal-hold §5 / V-DG-002 | `erasure-engine.ts:117-122` short-circuits a held subject (audited `erasure.blocked_legal_hold`, no target touched); `erasure-service.ts:106-137` consults the REAL store `isPersonUnderLegalHold` (a reviewer flag is an additional, not the only, trigger) → marks request `rejected` + `legalHoldBlocked=true`. | ✅ enforced at engine choke point AND service-store consult |
| **Erasure ANONYMIZES, never hard-deletes** | DATA_GOVERNANCE §3 ("Hard Delete? No — Anonymize") | `erasure-engine.ts` DRY-RUN by default; targets redact PII in place (Person→`[ERASED]`, contact/identifiers nulled) and KEEP the row. The lone hard delete is the physical S3 radiograph object + its storage `file` row (DATA_GOVERNANCE §3 mandate), fail-open at handler scope after commit. | ✅ |
| **Audit trail NEVER touched + SURVIVES erasure** | DATA_GOVERNANCE §3 ("Audit Trail Preserved? Yes") | engine only APPENDS audit (no purge/modify path); `dental_audit_log` has no FK to person; erasure anonymizes (not deletes) → the erasure's own audit rows outlive the erased identity. | ✅ (**now pinned**, was correct-by-source but untested) |
| **Two-step audited workflow + FSM** | erasure schema lifecycle | `requested → anonymized` (approve) / `requested → rejected` (reject or legal-hold). Approve/reject of a non-`requested` row → `ValidationError`. | ✅ |
| **Retention: act only on expired, not-held, soft-archive** | retention §5 / V-DG-001 / V-DG-003 | `retention-engine.ts` DRY-RUN default; `delete`→`archive` downgrade (no hard-delete path); `audit` target `protected` (never read); held records excluded via `personsUnderLegalHold`; appointment cutoff on `scheduledAt` (1yr). `legalHoldExempt` policy flag is NEVER a bypass. | ✅ |
| **RBAC: admin-only place/erase** | legal-hold §6 / erasure tsp | every erasure + legal-hold handler gates `user.role==='admin'` → 403 otherwise. | ✅ (platform-admin scope, see note) |
| **Legal-hold FSM: active→released terminal** | legal-hold §8 / AC-LH-004 | `legal-hold-service.ts:72` rejects releasing a non-`active` hold (`ValidationError 'already released'`). | ✅ (**now tested**) |

**RBAC scope note (not a hole — a tracked product decision):** erasure/legal-hold gate on the **platform `admin` role** (Better-Auth admin plugin, `adminEmails` allow-list at user creation — a true superuser, NOT org-scoped), and `tenantId`/`subjectPersonId` come from the request **body**, not a per-branch `dental_membership`. This is the **deliberate data-governance/DPO model** (the data controller's compliance officer acts cross-tenant) and matches the `dental-org` create endpoint's `admin`-gate. It is explicitly recorded as a product decision in `IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md` ("Erasure / legal-hold cross-tenant admin scope — Implemented but admin-role-only with no tenancy gate — needs an explicit product decision"). The `EM-BIL-002` optional-branchId-omission class **does not apply** — there is no per-branch scope to omit; the admin scope is intentionally global. **Surfaced, not changed** (tightening to per-org would be a deliberate product change, not a safe gap).

**Drift both ways:** the SPEC/source over-described the past ("no legal-hold store exists yet" in `erasure-validators.ts` and `retention-targets.ts`; WORKFLOW_MAP "Gap WFG-006 / no implementation / PHI purge") — all contradicted by the present implementation. Reconciled (STEP 7). No impl-side feature is undeclared.

---

## STEP 3 — KG mapping (query-only)

`.understand-anything/domain-graph.json` models `domain:data-governance` (entities `ErasureRequest`/`LegalHold`/`AuditEvent`/`RetentionPolicy`; tags incl. `retention`, `legal-hold`, `gdpr`, `phi`), `flow:erasure-request` (with steps request/get/approve/reject), and `flow:legal-hold`. It **correctly captures the headline invariant**: businessRules include *"Erasure blocked if active legal hold exists on patient"* and *"Legal hold prevents erasure; must be released before erasure can proceed."*

**KG-projection drift (query-only — flag for next regeneration, do NOT hand-edit):**
1. **Phantom routes.** `flow:erasure-request` `entryPoint` = **`POST /dental/data-governance/erasure-requests`** and `flow:legal-hold` = **`POST /dental/data-governance/legal-holds`** — the real routes are **`/dental/erasure-requests`** and **`/dental/legal-holds`** (no `/data-governance/` path segment).
2. **Retention enforcement under-modeled (lossy → NONE).** Retention appears only as a tag/entity on `domain:data-governance`; the actual enforcement engine + env-gated cron + targets + legal-hold-exclusion has **no flow node**. The retention→legal-hold exclusion edge and the anonymize-vs-archive/protected-skip outcomes are unmodeled. KG-backlog.
3. **Over-claim — wrong audit store.** `domain:data-governance` businessRules names *"Audit events … logged via Pino structured logging"* as the store — the durable sink is the `dental_audit_log` table (Pino carries only safe identifiers). Same Pino-not-the-store over-claim flagged in round 10.

---

## STEP 4/5 — Tests (ADVERSARIAL) + RBAC

| Governance MUST-VERIFY axis | Test | Strength |
|------------------------------|------|----------|
| **(a) LEGAL-HOLD blocks erasure** | `erasure-legalhold.test.ts` (REAL store: place hold → approve blocked, subject kept as `Jane`; release → fresh approve anonymizes to `[ERASED]`); `erasure-engine.test.ts` (`legalHold:true` → no target called, `erasure.blocked_legal_hold` audited); `erasure-service.test.ts` (rejected + `legalHoldBlocked=true`, subject NOT anonymized); `erasure-routes.test.ts` (HTTP `{legalHold:true}` → 200 rejected, subject kept). **And for retention:** `retention-legalhold.test.ts` (REAL store: a held person's old attachment is flagged `legalHold:true` → engine excludes it). | VERIFIED ×5 (engine + service + route + retention, all real-store) |
| **(b) erasure ACTUALLY redacts the PHI** | `erasure-service.test.ts` asserts post-approve `persons.firstName === ERASED_MARKER` AND `contactInfo === null` AND `patients.emergencyContact === null` — not just a 200. `erasure-routes.test.ts` asserts the same end-to-end through the HTTP route. `erasure-s3-delete.test.ts` asserts the radiograph S3 object is deleted AND the `stored_files` row is gone. | VERIFIED |
| **(c) erasure audited AND the audit row SURVIVES** | **NEW** `erasure-service.test.ts`: with the REAL audit sink (no spy), after `approveErasure` anonymizes the subject (`firstName==='[ERASED]'`), the `dental_audit_log` row `action='erasure.anonymized', targetId=PID, actorId=reviewer, eventType='security'` STILL EXISTS, and the `erasure.requested` row also persists — proving the erasure's own trail outlives the erased identity (DATA_GOVERNANCE §3 "Audit Trail Preserved? Yes"). `erasure-engine.test.ts` separately pins that EVERY run (dry-run/anonymize/block/noop) appends exactly one audit event and the engine has no purge path. | VERIFIED (added this round) |
| **(d) retention acts only on expired + not-held** | `retention-engine.test.ts` (dry-run default touches nothing; `delete`→`archive`; protected/`retain` skipped; legal-held excluded from `actionedCount`); `retention-appointment.test.ts` (`scheduledAt` 1-yr cutoff, V-DG-003); `retention-defaults.test.ts` (audit seeded `retain`/never-purge; targetless types disabled). | VERIFIED |
| **(e) cross-tenant / role-gating** | Erasure + legal-hold are **platform-admin-scoped by design** (no per-org boundary to cross — see RBAC note). The tested RBAC invariant is **non-admin → 403**: `erasure-routes.test.ts` (`role:'user'` → 403), `legal-hold-routes.test.ts` (non-admin → 403). No 2-org `OTHER_BRANCH_DENTIST` test applies (the endpoint is intentionally cross-tenant for the admin/DPO). | VERIFIED (role-gating); cross-tenant N/A by design |
| **FSM illegal transitions** | erasure: `erasure-service.test.ts` (approve/reject a non-`requested` request → throws). legal-hold: **NEW** `legal-hold.test.ts` (AC-LH-004 release-already-released → `/already released/i`, subject stays not-held; release-nonexistent → `/not found/i`). | VERIFIED (erasure pre-existing; legal-hold added this round) |
| **Fail-open S3 delete** | `erasure-s3-delete.test.ts` (a `deleteFile` throw does NOT fail the erasure — file left pending, storage row kept, idempotent retry; still audited `erasure.s3_deleted` with `pending:1`). | VERIFIED |

**Round-9 optional-branchId lens:** the erasure/legal-hold list endpoints (`listErasureRequests`, `listLegalHolds`) take an OPTIONAL `tenantId`/`subjectPersonId`/`status` filter and, when omitted, return rows across tenants — but this is the **admin/DPO list by design** (the whole module is platform-admin-scoped, RBAC-gated to `admin`), NOT the EM-BIL-002 hole (which was a *branch-scoped* report leaking past a *branch* boundary). There is no per-branch boundary here to leak past. Retention has no HTTP list. **Not a hole; consistent with the documented admin scope.**

---

## STEP 6 — Traceability Matrix

| Item | Spec? | Impl? | KG | Test (file:line) | Strength | Verdict |
|------|-------|-------|----|------------------|----------|---------|
| **V-DG-002-LH** legal-hold blocks erasure (engine short-circuit + real-store consult) | ✅ | ✅ erasure-engine.ts:117-122; erasure-service.ts:106-137 | flow + businessRule | erasure-legalhold.test.ts; erasure-engine.test.ts:77-93; erasure-service.test.ts:76-85; erasure-routes.test.ts:103-114 | VERIFIED | 🟢 |
| **V-DG-001-LH** retention excludes legally-held records | ✅ | ✅ retention-engine.ts:181-184; retention-targets.ts:40,59 | NONE (lossy) | retention-legalhold.test.ts; retention-engine.test.ts | VERIFIED | 🟢 |
| **V-DG-002-AN** erasure anonymizes (not hard-deletes); dry-run default; idempotent | ✅ | ✅ erasure-engine.ts:95-157; erasure-targets.ts | flow | erasure-service.test.ts:61-74; erasure-engine.test.ts (dry-run/noop) | VERIFIED | 🟢 |
| **V-DG-002-S3** physical radiograph S3 + storage-row delete, fail-open | ✅ DATA_GOVERNANCE §3 | ✅ erasure-storage.ts; approveErasureHandler.ts:39-60 | NONE | erasure-s3-delete.test.ts (4); erasure-routes.test.ts:144-174 | VERIFIED | 🟢 |
| **V-DG-002-AU** erasure audited AND audit row survives the erasure | ✅ §3 | ✅ erasure-engine.ts:159-188 (append-only); audit-log.schema.ts (no FK) | NONE | **erasure-service.test.ts (NEW: erasure.anonymized + erasure.requested rows persist after subject=[ERASED])**; erasure-engine.test.ts | VERIFIED (added) | 🟢 |
| **AC-RET-001/002/003** dry-run default; delete→archive; audit protected/retain skip | ✅ | ✅ retention-engine.ts:103-171 | NONE | retention-engine.test.ts; retention-defaults.test.ts | VERIFIED | 🟢 |
| **AC-RET-006 / V-DG-003** appointment retention on scheduledAt, 1-yr | ✅ | ✅ retention-targets.ts:55-65 | NONE | retention-appointment.test.ts | VERIFIED | 🟢 |
| **AC-LH-001/002/003** place/list/release lifecycle + audit | ✅ | ✅ legal-hold-service.ts; *Handler.ts | flow | legal-hold-routes.test.ts; legal-hold.test.ts | VERIFIED | 🟢 |
| **AC-LH-004** release already-released → ValidationError (terminal FSM) | ✅ | ✅ legal-hold-service.ts:72 | NONE | **legal-hold.test.ts (NEW: release-already-released → /already released/; release-nonexistent → /not found/)** | VERIFIED (added) | 🟢 |
| **EM-DG-RBAC** erasure + legal-hold admin-only; non-admin → 403 | ✅ | ✅ all handlers `role!=='admin'` → 403 | NONE | erasure-routes.test.ts:126-130; legal-hold-routes.test.ts:70-74 | VERIFIED | 🟢 |
| **Erasure FSM** approve/reject only from `requested` | ✅ | ✅ erasure-service.ts:101,165 | NONE | erasure-service.test.ts:100-108 | VERIFIED | 🟢 |
| **Route registration** 8 ops codegen-registered (not 404) | ✅ | ✅ generated routes | flow | erasure-route-registration.test.ts; legal-hold-route-registration.test.ts | VERIFIED | 🟢 |
| **Org seeding** default retention policies idempotent, targetless disabled | ✅ | ✅ retention-defaults.ts | NONE | retention-defaults.test.ts; retention-org-seeding.test.ts | VERIFIED | 🟢 |

**Counts: 13 GREEN / 0 PARTIAL / 0 RED.**

**Verdict: READY.**

---

## STEP 7 — Gaps Closed This Round

### REAL test gaps closed (TDD, GREEN)

| # | Gap | Class | Fix |
|---|-----|-------|-----|
| 1 | **Audit-survives-erasure was unpinned.** The headline compliance promise ("erasing a patient must NOT delete the audit trail of the erasure" — DATA_GOVERNANCE §3 "Audit Trail Preserved? Yes") was correct-by-source (no FK to person + anonymize-not-delete) but no test proved the `dental_audit_log` rows written DURING the erasure persist AFTER the subject is anonymized. | REAL test gap (compliance pin) | Added to `erasure-service.test.ts`: with the REAL audit sink, asserts the `erasure.anonymized` (actor=reviewer, eventType=security, targetId=subject) AND `erasure.requested` rows both still exist after the subject's `firstName==='[ERASED]'`. GREEN. |
| 2 | **AC-LH-004 (legal-hold terminal FSM) was declared but untested.** The legal-hold MODULE_SPEC declares AC-LH-004 (releasing an already-released hold is rejected) and the code enforces it (`legal-hold-service.ts:72`), but no test asserted the illegal transition — and release-of-nonexistent was also unpinned. | REAL test gap (FSM illegal-transition pin) | Added to `legal-hold.test.ts`: release-already-released → `/already released/i` (and subject stays not-held, proving no state corruption); release-nonexistent → `/not found/i`. GREEN. |

### Doc / registry drift reconciled (docs commit)

| # | Drift | Fix |
|---|-------|-----|
| 3 | **WHOLE governance layer ABSENT from `br-registry.json`** (11 module blocks present, none for erasure/legal-hold/retention — the exact recurring class from dental-perio round 6 & dental-audit round 10). | Added an `erasure-legal-hold-retention` block with 6 rules (V-DG-002-LH legal-hold-blocks-erasure, V-DG-002-AN anonymize-not-delete, V-DG-002-AU audited-and-audit-survives, AC-RET-001..006 retention safety, AC-LH-001..004 legal-hold FSM+RBAC, EM-DG-RBAC admin-only) with real source + test citations. JSON re-validated. |
| 4 | **Two STALE source comments contradicting the code directly below them.** `erasure-validators.ts:21-23` said *"(No LegalHold store exists yet — caller-supplied predicate.)"* and `retention-targets.ts:12-16` said *"no legal-hold store exists in the codebase yet, so the hold predicate currently reports `false`"* — but `dental_legal_hold` exists, `approveErasure` consults `isPersonUnderLegalHold`, and the retention targets call `personsUnderLegalHold` (lines 28/40/59). | Rewrote both comments to describe the present reality (approval also consults the real store; targets query `personsUnderLegalHold` and the engine excludes flagged candidates; `legalHoldExempt` is never a bypass). |
| 5 | **WORKFLOW_MAP.md three stale "WFG-006 is a Gap" spots.** Line ~522 lifecycle table said *"PHI purge — Gap WFG-006 / 0 after erasure"* (wrong verb — anonymize, not purge — and labels a resolved item a gap); the WF-088 block said *"Gap: No implementation in any module"*; line ~605 said *"Remaining: … real LegalHold store"* (the store now exists). | Updated all three: anonymize (not purge), WFG-006 RESOLVED (V-DG-002), the real `dental_legal_hold` store exists, and the only remaining items are the deferred (not-gap) extra-targets + Art.20 bulk portability (PRD format decision). |

---

## Ranked Remaining Gaps (surfaced, NOT closed — out of safe scope)

**ABSENT features / product decisions (surface, do NOT build — erasure/deletion code is high-risk):**
1. **`dental-erasure` MODULE_SPEC dir is absent.** legal-hold and retention each have a lightweight `docs/product/modules/<m>/MODULE_SPEC.md` anchor; erasure (the centerpiece) is spec'd only by `dental-erasure.tsp` + `DATA_GOVERNANCE.md §3`. Adding a parallel `docs/product/modules/erasure/MODULE_SPEC.md` (TR-ER-001) would complete the symmetric anchor set. **Doc-creation, deferred — not added this round to avoid scope creep beyond the established F9 pattern; the contract is fully covered by the TSP + DATA_GOVERNANCE.**
2. **Cross-tenant admin scope for erasure/legal-hold is a tracked PRODUCT DECISION** (IDEAL standard §342). Today an `admin` is a platform superuser operating cross-tenant via body `tenantId`. If the product wants per-org compliance officers, this needs an org-scoped role + resource-anchored tenancy — a deliberate behavioral change, NOT a safe gap. **Surface only.**
3. **Retention real-enforcement is env-gated OFF (`RETENTION_ENFORCEMENT_ENABLED`).** In production the cron runs DRY-RUN until an operator opts in. This is the documented safety posture (a bad policy can't auto-delete), not a gap — flagged so the operator-attestation step is remembered at go-live.
4. **Additional erasure/retention targets** (e.g. more clinical entity types) are seeded `enabled:false` until a facade lands — declared in retention §7 as deferred-by-design.
5. **Art. 20 bulk portability export** remains DEFERRED pending a PRD format decision (DATA_GOVERNANCE §4 / V-IMG-EXP-001) — covered in dental-pmd round 8; cross-referenced, not re-audited.

**REAL test gaps (impl present, lower-value, not added):**
6. **Fail-closed-on-security-event for the erasure audit.** `erasure.anonymized`/`erasure.s3_deleted` are `eventType:'security'`, so a failed audit write should rethrow (ADR-005, the audit module's V-AUD-007). Correct by source (it flows through the same `logAuditEvent` path proven in round 10) but not re-pinned at the erasure layer — belt-and-suspenders per the round-10 carry-forward (the write mechanism is proven correct at-source).

**KG-backlog:** `flow:erasure-request`/`flow:legal-hold` cite phantom `/dental/data-governance/*` routes (real: `/dental/erasure-requests`, `/dental/legal-holds`); retention enforcement is unmodeled (no flow node); businessRules names Pino (not `dental_audit_log`) as the audit store. Fix on next KG regeneration.

---

## STEP 8 — Gate

| Gate | Result |
|------|--------|
| `cd services/api-ts && bunx tsc --noEmit` | ✅ 0 errors |
| Module suite (`test-with-db.ts`, 3 dirs / 14 files) | ✅ **77 pass / 0 fail** (74 baseline + 3 new: legal-hold +2, erasure +1) |
| `eslint` (changed files) | ✅ 0 errors |
| `bun run check:boundaries` (api-ts) | ✅ no cross-module repo boundary violations (the verify-gate the prompt specifically requires for governance work — a prior retention boundary regression was caught only by it; clean now) |
| `br-registry.json` | ✅ valid JSON (governance block added) |
| Contract suite (fresh `:7213`, restarted) | ✅ **`dental-erasure.hurl` Success (33 req)** + **`dental-legalhold.hurl` Success (21 req)** green. **43/46 files pass**; the 3 failures are **pre-existing environmental, outside this module**: `billing-lifecycle.hurl` (Stripe), `auth-verification` + `auth-password-reset` (mailpit:8025 down) — identical to the prior ten rounds. |

---

## Legal-hold-blocks-erasure verdict

- **Enforced?** ✅ YES — at the engine choke point (`erasure-engine.ts` short-circuits a held subject before ANY target runs, audited `erasure.blocked_legal_hold`) AND in the service, which consults the REAL `dental_legal_hold` store (`isPersonUnderLegalHold`), not just a caller flag. Retention applies the same exclusion via `personsUnderLegalHold` so a held subject's records are never auto-archived. **`legalHoldExempt` on a policy row is never a bypass.**
- **Tested?** ✅ YES — on FOUR axes: engine (pure, `legalHold:true` → no target touched), erasure service (real store: hold blocks, release allows), HTTP route (real wiring), and retention (real store: held attachment flagged + excluded). Verified live this round; place→block→release→anonymize end-to-end.

## What's actually BUILT vs SURFACED-as-absent

- **BUILT (and enforced + tested):** the full request→approve/reject anonymize workflow; Person/Patient/ConsentForm/Imaging anonymization + physical radiograph S3 delete (fail-open); the real legal-hold store + place/list/release lifecycle; the policy-as-data retention engine + env-gated daily cron + attachment/appointment targets + audit-protected target; all four governance MUST-VERIFY invariants; admin RBAC. **The prior memory's "deferred P1" framing is stale — this is a substantially complete, well-architected, well-tested layer.**
- **SURFACED-as-absent / product-decision (NOT built — high-risk delete-path policy honored):** a `dental-erasure` MODULE_SPEC anchor; per-org (vs platform-admin) erasure scope; production enforcement opt-in; extra entity targets; Art.20 bulk portability. None were auto-built.

## Files Changed

**docs commit (`docs(audit): module erasure-legal-hold-retention traceability + safe-gap closure`):**
- `services/api-ts/src/handlers/dental-erasure/erasure-service.test.ts` — **NEW** audit-survives-erasure pin
- `services/api-ts/src/handlers/dental-legalhold/legal-hold.test.ts` — **NEW** AC-LH-004 release-already-released + release-nonexistent pins
- `services/api-ts/src/handlers/dental-erasure/utils/erasure-validators.ts` — stale "no LegalHold store exists yet" comment → present reality
- `services/api-ts/src/handlers/retention/retention-targets.ts` — stale "no legal-hold store exists yet" comment → present reality
- `specs/api/docs/standards/br-registry.json` — **NEW** `erasure-legal-hold-retention` block (6 rules)
- `docs/product/WORKFLOW_MAP.md` — WFG-006 three stale "Gap / no implementation / PHI purge / real LegalHold store remaining" spots → RESOLVED/anonymize/store-exists
- `docs/audits/modules/MODULE_erasure-legal-hold-retention_AUDIT_2026-06-08.md` — this report
- `docs/audits/MODULE_AUDIT_TRACKER.md` — row 11 verdict + carry-forward notes
