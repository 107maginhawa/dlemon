# Module Audit — emr-consultation (telemedicine consultation notes, `/emr`)

**Date:** 2026-06-08
**Branch:** feat/module-workflow-alignment
**Auditor:** per-module deep audit + safe-gap closure (adversarial; verified against source)
**Verdict:** ✅ **READY** — the EMR module is a **substantially complete, well-tested** platform-level telemedicine **consultation-notes** system (6 endpoints, full FSM, full PHI audit logging), NOT the dental external-records-import bridge and NOT a `dental-*` domain module. The headline carry-forward sweeps all pass: **cross-tenant/cross-owner isolation = CLEAR** (a real different provider cannot read/update/finalize another provider's note → 403, and — closed this round — a provider/patient **list** excludes another owner's notes in BOTH directions), **sign/finalize immutability = CLEAR** (updating or re-finalizing a finalized note → 422 `CONSULTATION_NOT_DRAFT`; the FSM is property-tested terminal at `finalized`; there is NO amend endpoint), **authoring/finalizing role-gating = CLEAR** (create requires `body.provider === own provider` else 403; update/finalize are owner-gated; no-provider-profile → 403/422), **optional-branchId / cross-resource-aggregate leak (EM-BIL-002 class) = N/A by design** (this module has **NO branch/tenant filter anywhere** — isolation is purely provider/patient ownership resolved server-side from the session; there is no optional scope to omit), **PHI audit logging = CLEAR and fully pinned** (all 6 ops write a `dental_audit_log` row; tenant slot is a non-PHI sentinel, never the patient UUID; update records field NAMES only). No security hole found — the impl was correct; the only real gap was **list self-scoping was unpinned**. Closed **2 safe gaps**: 1 adversarial-test reinforcement (5 cross-owner list-isolation + cross-patient-scope assertions) and 1 registry drift (whole module ABSENT from br-registry → added a 5-rule `emr-consultation` block). This is the LAST of the three optional-branchId-flagged modules (billing/portal/emr) — the carry-forward class is **CLOSED** (final disposition in STEP 8). Gates green.

---

## STEP 0 — Artifacts & /module-review

The module resolves to the real handler dir `services/api-ts/src/handlers/emr/` (NOT `emr-consultation`/`consultation`/`dental-consultation`). It is the upstream Monobase telemedicine EMR, ported from `monobase-mycure`.

| Artifact | Location | Status |
|----------|----------|--------|
| Handler dir | `services/api-ts/src/handlers/emr/` | ✅ 6 handlers (`createConsultation`/`listConsultations`/`getConsultation`/`updateConsultation`/`finalizeConsultation`/`listEMRPatients`) + `emr-audit.ts` (tenant sentinel) + `repos/`. ~770 LOC production. |
| Repo + schema | `repos/emr.repo.ts` (562 LOC), `repos/emr.schema.ts` (`consultation_note` table) | ✅ `ConsultationNoteRepository`; `validateStatusTransition` (terminal FSM), `finalizeNote`, `updateWithNulls`, `getBatchConsultationStats` (no N+1). **No cross-module schema imports** (EX-005/006 — patient/provider/person reached only via facades). |
| Cross-module facades | `patient/repos/patient-emr.facade.ts`, `provider/repos/provider-emr.facade.ts` | ✅ narrow facade surface (`getProviderByPersonIdForEMR`, `getPatientForEMR`, `*WithPerson`, `listPatients*ForEMR`); EMR handlers compose expansion from facade results — never join in `emr.repo`. |
| TypeSpec | `specs/api/src/modules/emr.tsp` (`EMRModule`, 6 ops) | ✅ each op `@useAuth(bearerAuth)` + `x-security-required-roles`; the `amended` enum value is documented RESERVED/unreachable; spec banner explicitly distinguishes this live `/emr` from the future `external-records-import` bridge. |
| MODULE_SPEC + API_CONTRACTS | `docs/product/modules/emr-consultation/MODULE_SPEC.md` + `API_CONTRACTS.md` | ✅ thorough and current (FSM terminal, V-EMR-001..008, the un-wrapped envelope, the tenant-sentinel note, the naming disambiguation §0). |
| Schema/migrations | `consultation_note` table; `tenant_id` nullable (intentionally NOT the isolation mechanism — schema comment + §7). | ✅ (no migration risk; no NOT-NULL migration planned by design) |
| Routes | `generated/openapi/routes.ts:2308-2349` — all 6 ops codegen-registered with `authMiddleware({roles:[...]})`. | ✅ |
| Tests | `emr-coverage.test.ts` (46), `emr-audit.test.ts` (7), `emr.handlers.test.ts` (39), `consultation-note.fsm.property.test.ts` (7), `getConsultation.expand.test.ts` (3), `repos/emr.repo.test.ts` (5) | ✅ **107 pass / 0 fail** |
| Contract | **none** — no `emr.hurl` (no contract file references `/emr`). Coverage is the 6 backend test files. | (surfaced, lower-priority gap) |
| KG | `.understand-anything/domain-graph.json` — **no emr/consultation node** | ⚠️ KG-backlog (lossy under-model — see STEP 3) |

**/module-review result:** **PASS.** All 6 TypeSpec `@operationId`s ↔ exported handler names match and are codegen-registered. No `test.skip`/`.only`/`xit`; no `Not implemented` stub; no TODO/FIXME/HACK; no non-test `as any`. Audit logging present on every data-modification AND read handler.

---

## STEP 1–2 — Spec universe & conformance (EMR-specific)

**Authorization model (CRITICAL — this module is PLATFORM-role-governed, NOT branch/membership-governed).** The actor is a Better-Auth `provider`/`patient`/`admin` (with the `provider:owner`/`patient:owner` ownership refinement), NOT a `dental_membership` holder. ROLE_PERMISSION_MATRIX documents this explicitly (line 50). Two structural facts shape every check:
1. **The route-level `:owner` role is non-gating by design.** `authMiddleware` (auth.ts:183-191) lets any authenticated user past an ownership role and **delegates the actual ownership check to the handler** (so a missing resource returns 404 not 403). **The handler-level ownership checks are therefore the entire security boundary.**
2. **There is NO branch/tenant isolation.** `consultation_note.tenant_id` is nullable and intentionally NOT the isolation mechanism (clinical PHI lives in per-user embedded SQLite; cadence P2P scope claims handle cross-device isolation). Isolation is **purely provider/patient ownership** resolved server-side from the session.

| Invariant | Spec | Impl | Conformance |
|-----------|------|------|-------------|
| **Ownership self-scope (headline isolation)** | MODULE_SPEC §5/§6, V-EMR-OWN | getConsultation grants admin ∨ owning-provider ∨ owning-patient else 403; update/finalize provider:owner else 403; list FORCES provider/patient scope from session. | ✅ isolation by ownership, server-forced |
| **Finalize terminal (sign-immutability)** | tsp §ConsultationStatus, §8, V-EMR-001 | `validateStatusTransition` draft→finalized only; finalize/update reject non-draft → `CONSULTATION_NOT_DRAFT` (422); no amend endpoint; `amended` reserved/unreachable. | ✅ |
| **Authoring/finalizing role-gated** | §6, V-EMR-AUTH | create: `body.provider===own` else 403 (+ PROVIDER_NOT_FOUND 422); update/finalize owner-gated. | ✅ |
| **Context idempotency unique** | §5, V-EMR-CTX | unique index `consultation_notes_context_unique` + handler `CONSULTATION_EXISTS`. | ✅ |
| **Patient-appropriate / facade expansion** | §20, AC-EMRC-004 | expansion composed in handler from `*ForEMR` facades; `emr.repo` has zero cross-module schema imports. | ✅ |
| **PHI audit on every op + non-PHI tenant slot** | §12b, V-EMR-002/003/004/005/006 | all 6 ops `logAuditEvent`; null tenant → `EMR_AUDIT_TENANT_SENTINEL` (never patient UUID); update logs field NAMES only. | ✅ |

**Drift both ways:** none. The built surface is exactly the 6 declared ops; WORKFLOW_MAP §2b (WF-EMRC-001..006) is current — WF-EMRC-004 (amend-after-finalize) is already correctly marked **STRUCK (V-EMR-001)**. No impl feature is undeclared; no declared feature (except the struck amend) is unbuilt.

---

## STEP 3 — KG mapping (query-only)

`.understand-anything/domain-graph.json` contains **NO emr/consultation node** — a grep for `emr`/`consultation` in the graph returns nothing. The module (a 6-endpoint, PHI-bearing clinical surface) is entirely **unmodeled** in the KG.

**KG-projection drift: LOSSY UNDER-MODEL (KG-backlog).** Unlike the over-claim/phantom-route pattern from earlier rounds, here the KG simply omits the module. Flag for next KG regeneration: add an `emr-consultation` domain + a `consultation-note-lifecycle` flow (entry `POST /emr/consultations`, terminal `finalize`, isolation `by provider/patient ownership — no branch/tenant`). **Query-only — not hand-edited.**

---

## STEP 4/5 — Tests (ADVERSARIAL) + AUTH model

| EMR MUST-VERIFY axis | Test | Strength |
|----------------------|------|----------|
| **(a) cross-tenant/cross-owner — a full-role OTHER provider cannot read/edit another's note** | `emr-coverage.test.ts`: getConsultation with a REAL different provider (`OTHER_PERSON_ID`→`OTHER_PROVIDER_ID`, role=provider) → **403**; update wrong-provider → 403; finalize wrong-provider → 403. **NEW:** listConsultations — provider A's list EXCLUDES provider B's note AND every returned row is provider A's; the OTHER provider sees ONLY their own (both directions); patient A's list excludes patient B's note. | VERIFIED (read/update/finalize + **list both directions, added**) |
| **(b) sign/finalize immutability — editing a finalized note rejected** | `emr-coverage.test.ts`: update finalized → ≥400 `CONSULTATION_NOT_DRAFT`; finalize already-finalized → ≥400; FSM repo rejects finalized→amended. `consultation-note.fsm.property.test.ts`: fast-check proves ONLY (draft,finalized) valid, finalized/amended terminal, struck finalized↔amended rejected. **Amendments are NOT allowed (no addendum path) — finalize is terminal, by design (V-EMR-001).** | VERIFIED (strong — property-tested) |
| **(c) authoring/signing role-gated to provider** | `emr-coverage.test.ts`: create wrong-provider-in-body → 403; caller with no provider profile → ≥400; update/finalize no-profile → 403. | VERIFIED |
| **(d) optional-branchId lens on list endpoints** | **N/A by design — no branch/tenant filter exists.** listConsultations filters on `patient`/`provider`/`status` only; the provider/patient scope is FORCED server-side from the session (admin sees all by role). There is no optional `branchId`/scope param whose omission widens results. **NEW pin:** a patient passing another patient's id in `?patient=` → 403 (scope cannot be widened by a client param); own id → 200, own rows only. | N/A / CLEAR (cross-patient-scope pinned) |
| **(e) audit-logging of create/sign/amend writes a row** | `emr-audit.test.ts`: all 6 ops write a `dental_audit_log` row with the right `actorId`/`action`/`targetType`/`targetId`; `tenantId === EMR_AUDIT_TENANT_SENTINEL` and **NOT** the patient UUID (V-EMR-005); update records `updatedFields` NAMES only and the serialized row does NOT contain the PHI value (V-EMR-003); empty-roster path also audits. | VERIFIED (fully pinned at-source for this module) |
| **Auth / role-gating** | Routes gate `authMiddleware({roles})`; unauthenticated → 401/≥400 (tested per op); no-provider-profile → 403; admin read-all + patient read-own + provider read-own all asserted. | VERIFIED |

**Round-9 optional-branchId / cross-resource-aggregate lens (CARRY-FORWARD — emr is the LAST flagged module):** EMR has **no branch/tenant dimension at all**, so neither the EM-BIL-002 variant ("optional branchId omitted → unscoped all-tenant aggregate") nor the caller-supplied-branchId variant (V-PAT-002) can apply. The two list endpoints (`/emr/consultations`, `/emr/patients`) and the `listEMRPatients` aggregate scope on a provider/patient identity **forced from the session** (or `admin` by role, intentionally global). The only client-supplied scope param is `?patient=` on listConsultations, and for a patient caller it is validated to equal their own id (403 otherwise) — it cannot widen scope. **CLEAR / N/A.**

---

## STEP 6 — Traceability Matrix

| Item | Spec? | Impl? | KG | Test (file:line) | Strength | Verdict |
|------|-------|-------|----|------------------|----------|---------|
| **V-EMR-OWN** ownership self-scope; OTHER provider/patient denied; list excludes foreign owner | ✅ | ✅ getConsultation.ts:70-96; listConsultations.ts:62-93; update/finalize:60-67 | NONE | emr-coverage.test.ts (OTHER provider →403; **NEW** cross-owner list ×3 + cross-patient-scope 403) | VERIFIED | 🟢 |
| **V-EMR-001** finalize terminal; finalized note immutable; no amend | ✅ | ✅ emr.repo.ts:194-209; finalizeConsultation.ts:66-71; updateConsultation.ts:70-75 | NONE | consultation-note.fsm.property.test.ts (fast-check); emr-coverage.test.ts (update/re-finalize finalized → 422) | VERIFIED | 🟢 |
| **V-EMR-AUTH** authoring/finalizing provider-owner-gated | ✅ | ✅ createConsultation.ts:54-61; update/finalize | NONE | emr-coverage.test.ts (wrong-provider →403; no-profile →≥400) | VERIFIED | 🟢 |
| **V-EMR-CTX** context idempotency unique | ✅ | ✅ emr.schema.ts:143; createConsultation.ts:74-79 | NONE | emr.repo.test.ts (dup context throws); emr-coverage.test.ts (dup →≥400) | VERIFIED | 🟢 |
| **V-EMR-005** audit tenant slot = sentinel, never patient UUID; field-names-only | ✅ | ✅ emr-audit.ts:11; all 6 handlers | NONE | emr-audit.test.ts (all 6 ops sentinel; update names-only, no PHI value) | VERIFIED | 🟢 |
| **AC-EMRC-004** expand=patient,provider,person via facades (no direct schema access) | ✅ | ✅ getConsultation.ts:128-150 | NONE | getConsultation.expand.test.ts (nested objects + nested person) | VERIFIED | 🟢 |
| **Route registration** 6 ops codegen-registered | ✅ | ✅ routes.ts:2308-2349 | NONE | emr-coverage.test.ts (200/401/403/404 per op) | VERIFIED | 🟢 |
| **listEMRPatients provider-scope / admin-all + stats** | ✅ | ✅ listEMRPatients.ts | NONE | emr-coverage.test.ts (provider own; admin all; empty roster) | VERIFIED | 🟢 |
| **Contract (`emr.hurl`) wire-level coverage** | n/a | ❌ absent | NONE | — | NONE | ⚪ surfaced (lower-priority) |

**Counts (BUILT items): 8 GREEN / 0 PARTIAL / 0 RED.** Plus 1 SURFACED-as-absent row (contract file) + 1 KG-backlog.

**Verdict: READY** — the built surface is GREEN end-to-end; the only gaps are a missing contract file (lower-priority; backend coverage is comprehensive) and a KG under-model (backlog). The single struck feature (amend-after-finalize) is an explicit, documented non-goal, not a defect.

---

## STEP 7 — Gaps Closed This Round

### Safe gap reinforcement (TDD, GREEN)

| # | Gap | Class | Fix |
|---|-----|-------|-----|
| 1 | **List self-scoping was unpinned (cross-owner IDOR-via-list).** The `listConsultations` provider/patient tests only asserted `Array.isArray(data)` — they did NOT prove a provider's list EXCLUDES another provider's notes, nor that a patient cannot see another patient's notes via the list, nor that a patient cannot widen scope via `?patient=<other>`. Because the EMR module has **no branch/tenant boundary**, the list-scoping IS the entire cross-tenant isolation surface for bulk reads — so it must be pinned that foreign-owner rows never appear. (The impl was correct; only the test was missing.) | REAL test gap (adversarial cross-owner self-scope) | Added a `listConsultations — cross-owner self-scoping (adversarial)` block to `emr-coverage.test.ts`: seeds a second patient + a note authored by a DIFFERENT provider, then asserts (a) provider A's list contains its own note and EXCLUDES provider B's (every row `provider===A`), (b) the OTHER provider sees ONLY their own (both directions), (c) patient A's list excludes patient B's note (every row `patient===A`), (d) patient passing another patient's id in `?patient=` → **403**, (e) patient passing own id → 200 own rows only. 41 → **46** assertions, GREEN. |

### Doc / registry drift reconciled (docs commit)

| # | Drift | Fix |
|---|-------|-----|
| 2 | **WHOLE emr module ABSENT from `br-registry.json`** (12 module blocks — dental-visit … dental-portal — none for `emr-consultation`). The exact recurring class from dental-perio round 6 / dental-audit round 10 / governance round 11 / dental-portal round 12; a platform-level (non-`dental-*`) module is as likely to be registry-absent as a cross-cutting one. | Added an `emr-consultation` block with 5 rules: **V-EMR-OWN** (ownership self-scope headline, security), **V-EMR-001** (finalize terminal / sign-immutability, state-guard), **V-EMR-AUTH** (authoring/finalizing owner-gated, security), **V-EMR-CTX** (context idempotency unique, conflict-prevention), **V-EMR-005** (audit tenant slot = non-PHI sentinel + field-names-only, privacy) — each with real source + test citations. The block description records that the module is platform-role-governed with NO branch/tenant boundary (isolation by provider/patient ownership). JSON re-validated. |

---

## Ranked Remaining Gaps (surfaced, NOT closed — out of safe scope)

**ABSENT / lower-priority (surface, do NOT build):**
1. **No `emr.hurl` contract file.** The 6 EMR ops have no wire-level Hurl coverage (unlike most dental modules). Backend coverage is comprehensive (107 assertions incl. ownership 403s, FSM, audit rows), so this is lower-priority, but a contract file pinning 401/403/404/201 at the HTTP boundary would complete the symmetric test set. **Surface only** (test-creation against a live server, not a safe in-place edit).
2. **KG under-models the module entirely (KG-backlog).** `domain-graph.json` has no emr/consultation node. Add on next regeneration (query-only).
3. **Amend-after-finalize is a documented non-goal (V-EMR-001), NOT a gap.** If a clinical-amendment requirement ever lands, it MUST be a dedicated `POST /emr/consultations/{id}/amend` with an `amendedBy`/lineage column (an addendum, never an in-place edit of a finalized note) — re-introduce deliberately, not by relaxing the terminal FSM. **Surface only.**
4. **`listConsultations` admin-sees-all is intentional and global** (platform-admin function), matching the round-11 disposition: a platform-admin operating globally is by design, not the optional-branchId hole. No per-tenant boundary exists to leak past.

**REAL test gaps (impl present, lower-value, not added):**
5. **Route-level role rejection for a non-`provider`/`patient`/`admin` token** is covered generically by the shared `middleware/auth.test.ts`; not re-pinned at the EMR layer (belt-and-suspenders).

**KG-backlog:** add `emr-consultation` domain + `consultation-note-lifecycle` flow (isolation by ownership, terminal finalize) on next regeneration.

---

## STEP 8 — Gate

| Gate | Result |
|------|--------|
| `cd services/api-ts && bunx tsc --noEmit` | ✅ 0 errors |
| Module suite (`test-with-db.ts`, all 6 emr files) | ✅ **107 pass / 0 fail** (102 baseline + 5 new cross-owner list-isolation) |
| `eslint` (changed test file) | ✅ 0 errors, 0 warnings |
| `bun run check:boundaries` (api-ts) | ✅ no cross-module repo boundary violations (EMR consumes patient/provider only via facades — the boundary the lint protects; clean) |
| `br-registry.json` | ✅ valid JSON (`emr-consultation` block added, 5 rules) |
| Contract suite (fresh `:7213`, restarted) | ✅ **43/46 files pass**. EMR has no own `.hurl`; `provider.hurl` (the facade EMR depends on) passes 20/20. The 3 failures are **pre-existing environmental, outside this module**: `auth-verification` + `auth-password-reset` (mailpit:8025 down) and `billing-lifecycle` (Stripe) — identical to the prior twelve rounds. No TypeSpec/route change this round, so no codegen impact. |

---

## IDOR / cross-tenant / sign-immutability / optional-branchId verdict

- **Cross-tenant / cross-owner (provider A → provider B; patient A → patient B):** ✅ **CLEAR.** Isolation is by provider/patient ownership resolved server-side from the session — there is no branch/tenant dimension. A real different provider is denied read/update/finalize (403); the list excludes foreign-owner rows in both directions (pinned this round); a patient cannot widen scope via `?patient=<other>` (403).
- **Sign / finalize immutability:** ✅ **CLEAR.** `draft → finalized` is terminal (property-tested); updating or re-finalizing a finalized note → 422 `CONSULTATION_NOT_DRAFT`. **No amendment path exists** — amend-after-finalize was struck (V-EMR-001); if added later it MUST be an addendum endpoint, never an in-place edit.
- **Authoring / finalizing role-gating:** ✅ **CLEAR.** Create requires `body.provider === own provider` (403 otherwise; 422 if no provider profile); update/finalize owner-gated.
- **Optional-filter / cross-resource-aggregate leak (EM-BIL-002 class):** ✅ **N/A by design** — the module has NO branch/tenant filter to omit; list scope is forced from the session (or admin-global by role); the lone client scope param (`?patient=`) is validated to the caller's own id.
- **PHI audit logging:** ✅ **CLEAR.** All 6 ops persist a `dental_audit_log` row; the tenant slot is a non-PHI sentinel (never the patient UUID); update logs field NAMES only.

## FINAL disposition of the optional-branchId-class carry-forward (all modules)

emr is the **last** of the three flagged modules (billing, portal, emr). Final class disposition across all 15 audited contexts:
- **Caller-supplied-branchId variant (V-PAT-002):** HOLES found + fixed in **dental-patient** and **dental-visit** (a `branchId` query param access-checked but untied to the path resource). CLEAR everywhere else.
- **Optional-branchId-omitted variant (EM-BIL-002 — omit → unscoped all-tenant aggregate):** HOLE found + fixed in **dental-billing** (5 report endpoints). The targeted cross-module sweep (`SWEEP_optional-branchid_2026-06-08.md`) confirmed it is **unique to billing** — every other module's list/report is branchId-required, resource-anchored, or own-membership-scoped.
- **dental-portal:** N/A by design (patient-facing, no branch param; IDOR by self-scope).
- **emr-consultation:** N/A by design (platform-level, no branch/tenant dimension at all; isolation by provider/patient ownership). The only client scope param (`?patient=`) is session-validated.

**CLASS CLOSED.** The optional-filter-omission hazard remains live ONLY for *cross-resource aggregate/report endpoints with an optional-only scope* — a shape that exists only in billing (now fixed). Neither remaining module had such a surface. No further chase targets remain in this audit series.

## What's actually BUILT vs SURFACED-as-absent

- **BUILT (and enforced + tested):** 6 consultation-note endpoints (create/list/get/update/finalize/listEMRPatients); ownership-based isolation (provider-own / patient-own / admin-all) enforced in-handler and pinned in both directions for reads AND lists; terminal draft→finalized FSM with finalized-note immutability (property-tested); context idempotency uniqueness; facade-composed patient/provider/person expansion (no cross-module schema access); full PHI audit logging on all 6 ops with a non-PHI tenant sentinel and field-names-only update logging.
- **SURFACED-as-absent / non-goals (NOT built):** amend-after-finalize (struck, V-EMR-001 — would require a dedicated addendum endpoint); an `emr.hurl` contract file; an `emr-consultation` KG node. None were auto-built.

## Files Changed

**docs commit (`docs(audit): module emr-consultation traceability + safe-gap closure`):**
- `services/api-ts/src/handlers/emr/emr-coverage.test.ts` — **NEW** `listConsultations — cross-owner self-scoping (adversarial)` block (5 assertions: provider/patient list excludes foreign owner both directions + cross-patient `?patient=` 403 + own-id allowed)
- `specs/api/docs/standards/br-registry.json` — **NEW** `emr-consultation` block (5 rules: V-EMR-OWN, V-EMR-001, V-EMR-AUTH, V-EMR-CTX, V-EMR-005)
- `docs/audits/modules/MODULE_emr-consultation_AUDIT_2026-06-08.md` — this report
- `docs/audits/MODULE_AUDIT_TRACKER.md` — row 13 verdict + optional-branchId carry-forward CLOSE-OUT
