# Module Audit — provider (FHIR Provider / Practitioner directory, `/providers`)

**Date:** 2026-06-08
**Branch:** feat/module-workflow-alignment
**Auditor:** per-module deep audit + safe-gap closure (adversarial; verified against source)

> **Post-audit cleanup — RESOLVED 2026-06-08 (refactor `2abaf8eb`).** The two surfaced cleanup items below are now closed: (1) the 4 orphan handlers (`getProvider`/`listProviders`/`updateProvider`/`deleteProvider`) were **deleted** (verified no route/registry/tsp/import/test; shared `ProviderRepository` untouched), and (2) the non-functional `practitioner:owner` role was **removed** from the 4 practitioner/role read+update routes in `provider.tsp` (regenerated api-ts routes + sdk-ts) — it was never granted and no handler enforced ownership behind it, so removal is behaviour-preserving for all real users while deleting the misleading latent-IDOR-by-name surface. Wiring it would have required a schema person-link + product decision (out of safe scope). Gate re-verified green: api-ts tsc 0 · provider suite 5/0 · lint 0 err · boundaries clean · `provider.hurl` green. The analysis below is preserved as the rationale.
**Verdict:** ✅ **READY** — `provider` is an **upstream Monobase platform module** (FHIR R4-aligned), NOT a `dental-*` domain module. It has three surfaces: (1) **Provider** — a pre-FHIR self-service profile a user creates for THEMSELVES (`POST /providers`, role `user`; person derived server-side; grants the `provider` role + invalidates the session; `PROVIDER_EXISTS` 409 on dup) carrying **NO confidential fields** (providerType/yearsOfExperience/biography/specialties); (2) **Practitioner** — the FHIR record carrying **CONFIDENTIAL credentials** (NPI/DEA/state-license numbers) + qualifications, CRUD admin/credentialing-managed, reads admin/clinician/support-gated; (3) **PractitionerRole** — FHIR location/availability/role assignment, same governance. **Auth model = platform Better-Auth roles** (user/admin/credentialing/clinician/support, with a `practitioner:owner` ownership role), NOT the dental membership/branch matrix — there is **no branch/tenant dimension**. The headline sweeps: **cross-owner edit = CLEAR-by-construction-but-with-surfaced-spec-drift** (the practitioner schema has NO person link and the handlers do NO ownership check; the route-level `practitioner:owner` role passes through to the handler — but `practitioner:owner` is **never granted to any user** anywhere in the codebase, so the latent IDOR is **unreachable today**; surfaced as spec drift, not an exploitable hole); **private-field projection = CLEAR / N/A** (credentials live ONLY on Practitioner, and there is **NO public or patient-facing read of a practitioner** — confidentiality is the route ROLE GATE, not a handler projection; the public-directory `Provider` model has no confidential fields, and even its read handlers are orphan/unwired); **role-gating = CLEAR** (writes admin/credentialing, deactivate admin, practitioner reads admin/clinician/support — contract-pinned 401 on every op); **status FSM = soft-delete only** (deactivate sets `active=false`+`deactivatedAt`, 204; records retained for audit/legal); **audit-logging** is structured-log only (`logger.info` with action), not a `dental_audit_log` row (this platform module does not participate in the dental audit table — consistent with its non-`dental-*` nature). No security hole reachable. Closed **2 safe gaps**: 1 adversarial-test reinforcement (credential field-visibility / privileged-projection + no-public-read pins on `getPractitioner`) and 1 registry drift (whole module ABSENT from br-registry → added a 4-rule `provider` block). Surfaced (NOT built): 4 **orphan handlers** (`getProvider`/`listProviders`/`updateProvider`/`deleteProvider` — dead code, no TypeSpec/registry/route), the latent `practitioner:owner` ownership gap, and a KG conflation (the `flow:manage-providers` node points at the wrong dental-org route). Gates green; `provider.hurl` 20/20.

---

## STEP 0 — Artifacts & /module-review

The module resolves to the real handler dir `services/api-ts/src/handlers/provider/` (NOT `practitioner`/`provider-directory`). It is the upstream Monobase FHIR-aligned provider/practitioner directory.

| Artifact | Location | Status |
|----------|----------|--------|
| Handler dir | `services/api-ts/src/handlers/provider/` | ✅ **11 live** handlers (`createProvider` + 5 practitioner + 5 practitioner-role) + **4 ORPHAN** (`getProvider`/`listProviders`/`updateProvider`/`deleteProvider` — exist but unwired) + `repos/`. ~2400 LOC. |
| Repos + schema | `repos/provider.repo.ts` + `provider.schema.ts` (`providers` table), `repos/practitioner.repo.ts` + `practitioner.schema.ts` (`practitioners`, `practitioner_roles`), `repos/practitioner-role.repo.ts` | ✅ `ProviderRepository`/`PractitionerRepository`/`PractitionerRoleRepository`; soft-delete (`deactivateById`). `practitioners` links to `providers` via `providerId` (the practice/org) — **NO person link** (relevant to the ownership-gap finding). |
| Cross-module facades | `repos/provider-emr.facade.ts`, `repos/provider-person.facade.ts` | ✅ narrow facade surface (`getProviderByPersonIdForEMR`, `getProviderForEMR`, `*WithPersonForEMR`) consumed by `emr/` — clean boundary (round 13). |
| TypeSpec | `specs/api/src/modules/provider.tsp` (`ProviderModule`, **11 ops**) | ✅ each op `@useAuth(bearerAuth)` + `x-security-required-roles`; the FHIR `Practitioner`/`PractitionerRole` models + a pre-FHIR `Provider` model kept "for SDK compatibility" (documented banner). |
| MODULE_SPEC + API_CONTRACTS | `docs/product/modules/provider/` | ❌ **ABSENT** (upstream platform module — no product MODULE_SPEC/API_CONTRACTS, same as emr round 13). The TypeSpec doc-comments + this report are the spec of record. |
| Schema/migrations | `providers`, `practitioners`, `practitioner_roles`; soft-delete columns; no migration risk this round | ✅ |
| Routes | `generated/openapi/routes.ts:2476-2553` — **11 ops** codegen-registered with `authMiddleware({roles:[...]})`. The 4 orphan handlers are **NOT** registered. | ✅ (live surface) |
| Tests | `getPractitioner.test.ts` (now 5), `repos/practitioner.repo.test.ts` (12), `repos/practitioner-role.repo.test.ts` (9), `repos/provider-emr.facade.test.ts` (6) | ✅ **32 pass / 0 fail** |
| Contract | `specs/api/tests/contract/provider.hurl` (20 requests: auth-gate 401 ×4 + full Provider create + admin practitioner/role CRUD lifecycle + 404s + soft-delete 204s) | ✅ **20/20 pass** |
| KG | `.understand-anything/domain-graph.json` — `flow:manage-providers` exists but **points at the WRONG route** (`POST /dental/providers`, the dental-org staff flow) | ⚠️ KG-conflation (see STEP 3) |

**/module-review result:** **PASS (live surface).** All **11** TypeSpec `@operationId`s ↔ exported handler names match and are codegen-registered. No `test.skip`/`.only`/`xit`; no `Not implemented` stub; no TODO/FIXME/HACK; no non-test `as any`. Audit logging (structured `logger.info` with `action`) present on every create/update/delete. **Consistency caveat:** there are **4 extra handler files** (`getProvider`/`listProviders`/`updateProvider`/`deleteProvider`) with no matching TypeSpec op, no registry import, and no route — **orphan/dead code** (surfaced, STEP 7).

---

## STEP 1–2 — Spec universe & conformance (provider-specific)

**Authorization model (CRITICAL — PLATFORM-role-governed, NOT branch/membership-governed).** Roles are a comma-string on the Better-Auth user record (`utils/auth.ts:userHasRole`); `admin` is a superuser. Two structural facts shape every check:
1. **The route-level `practitioner:owner` role is non-gating by design.** `authMiddleware` (auth.ts:183-191) lets any authenticated user past an ownership role and **delegates the ownership check to the handler** (404-not-403 semantics). **But the practitioner handlers perform NO handler-level ownership check** (they enforce only a session floor), AND the `practitioners` schema has **no person link** to compute ownership against. So `practitioner:owner` is currently a **non-functional/aspirational role** — see V-PROV-003.
2. **There is NO branch/tenant isolation.** No `branchId` param on any endpoint; `tenant_id` defaults to `'default'`. Governance is purely the role list.

| Invariant | Spec | Impl | Conformance |
|-----------|------|------|-------------|
| **Provider profile is self-service (own person only)** | tsp `createProvider` (role `user`, person derived) | createProvider derives person from session `ensurePersonForUser(user)`; PROVIDER_EXISTS 409; grants `provider` role + revokes session. | ✅ |
| **Credential confidentiality (no public/patient read)** | tsp practitioner reads gated admin/clinician/support[/owner] | NO public/patient route returns a practitioner; handler returns full record (no redaction) — confidentiality = route role gate. | ✅ (by route gate) |
| **Practitioner/role writes admin/credentialing-gated** | tsp create/update admin\|credentialing; delete admin | route `authMiddleware({roles})`; handler session-floor. | ✅ |
| **Deactivate = soft-delete, records retained** | tsp delete → 204 "retained for audit/legal" | `deactivateById` sets `active=false`+`deactivatedAt`; 204; 404 if missing. | ✅ |
| **Practitioner ownership self-edit (practitioner:owner)** | tsp lists `practitioner:owner` on get/update | **NO handler ownership check + no person link** → role is non-functional; never granted. | ⚠️ spec drift (surfaced) |

**Drift both ways:** (a) **4 orphan handlers** are built but undeclared/unwired — the live Provider surface is create-only (reads go via person-expansion + the EMR facade). (b) `practitioner:owner` is declared in TypeSpec/routes as if ownership were enforced, but no handler check and no person link exist — **aspirational spec drift**, not exploitable (role unassignable). No other declared op is unbuilt; no other built op is undeclared.

---

## STEP 3 — KG mapping (query-only)

`.understand-anything/domain-graph.json` contains a `flow:manage-providers` node, but its `domainMeta.entryPoint` is **`POST /dental/providers`** (the **dental-org staff-management** route) and its summary mentions `treatment_coordinator`/`dental_assistant` roles — i.e. it models the **dental-org** staff flow, NOT this platform `/providers` + `/providers/practitioners` FHIR surface. There is **no KG node** for the FHIR Practitioner/PractitionerRole directory.

**KG-projection drift: CONFLATION + UNDER-MODEL (KG-backlog).** The graph conflates two distinct "provider" concepts (dental-org staff at `/dental/providers` vs the platform FHIR `/providers`) and omits the latter entirely. Flag for next KG regeneration: add a `provider-directory` domain + a `practitioner-credentialing` flow (entry `POST /providers/practitioners`, isolation = platform role gate, no branch/tenant), and disambiguate `flow:manage-providers` as the dental-org route. **Query-only — not hand-edited.**

---

## STEP 4/5 — Tests (ADVERSARIAL) + AUTH model

| Provider MUST-VERIFY axis | Test | Strength |
|---------------------------|------|----------|
| **(a) cross-owner edit — a provider can only edit THEIR OWN profile** | The **Provider** surface (`updateProvider`/`deleteProvider`) DOES enforce `isOwner = provider.person === user.id` else 403 — but those handlers are **ORPHAN/unwired** (no route), so the check is dead. The **live** Practitioner surface has **NO ownership concept** (no person link) and is admin/credentialing-gated; `practitioner:owner` pass-through is unreachable (role never granted). **No reachable cross-owner edit path exists.** | CLEAR-by-construction (surfaced: orphan-owner-check + latent owner role) |
| **(b) field-visibility — private fields excluded from public/patient read** | **NEW:** `getPractitioner.test.ts` pins that an authorized session receives the FULL `credential` (NPI/DEA numbers + state) + qualification license identifier verbatim (privileged projection), AND that an unauthenticated request → 401 even when the practitioner exists (no public read of credentials). The structural property: credentials live ONLY on Practitioner; **there is no public/patient route returning a practitioner** (the public directory `Provider` model has no confidential fields, and its read handlers are orphan). So confidentiality = route role gate; no leak surface. | VERIFIED (privileged-projection + no-public-read pinned) |
| **(c) role-gating — who may create/write** | `provider.hurl`: POST/GET `/providers/practitioners[-roles]` unauthenticated → **401** (×4 auth-gate, run before any sign-up); full admin CRUD lifecycle 201/200/204; Provider create as a fresh `user` → 201 (role-appropriate). Writes are admin/credentialing; deactivate admin (route `authMiddleware`). | VERIFIED (contract) |
| **(d) status FSM — illegal transition rejected** | Deactivate is a one-way soft-delete (no multi-state FSM): `deactivateById` → `active=false`+`deactivatedAt`; `practitioner.repo.test.ts` pins it; 404 on missing id (contract). No pending→verified→suspended credential-status FSM is enforced server-side (credential `status` is a free JSONB field, not a guarded transition — surfaced as a non-goal). | VERIFIED (soft-delete) / N/A (no FSM) |
| **(e) audit-logging on profile writes** | Writes log a structured `logger.info({action})` line (create/update/delete) — this platform module does **NOT** write a `dental_audit_log` row (it is not a `dental-*` module; the dental audit table is the dental vertical's, round 10). Consistent with the module's platform nature. | N/A (structured-log only, by design) |
| **Auth / role floor** | Every practitioner handler throws `UnauthorizedError` without a session; `getPractitioner.test.ts` pins 401-no-session. | VERIFIED |

**Round-9 optional-branchId / cross-resource-aggregate lens:** provider has **no branch/tenant dimension at all** — no `branchId` param on any endpoint, governance is purely the platform role list. Neither the caller-supplied-branchId variant (V-PAT-002) nor the optional-branchId-omitted variant (EM-BIL-002) can apply. `listPractitioners`/`listPractitionerRoles` filter on `active`/`specialty`/`provider`/`organization`/`location` only and are admin/clinician/support-gated; there is no optional scope whose omission widens a tenant boundary (there is no tenant boundary). **CLEAR / N/A.** (The optional-branchId carry-forward class was already CLOSED in round 13; provider confirms a fourth N/A-by-design module.)

---

## STEP 6 — Traceability Matrix

| Item | Spec? | Impl? | KG | Test (file:line) | Strength | Verdict |
|------|-------|-------|----|------------------|----------|---------|
| **V-PROV-001** Provider self-service create (own person; PROVIDER_EXISTS; role+session) | ✅ tsp | ✅ createProvider.ts:22-115 | ⚠️ conflated | provider.hurl (POST /providers → 201 derived person; role contains 'provider') | VERIFIED | 🟢 |
| **V-PROV-002** Practitioner credentials privileged-read-only; no public/patient projection | ✅ tsp roles | ✅ routes.ts:2529-2538; getPractitioner.ts:19-41 | NONE | getPractitioner.test.ts (**NEW** full credential+qualification to authorized session; unauth → 401) | VERIFIED | 🟢 |
| **V-PROV-003** Practitioner/role writes admin/credentialing-gated | ✅ tsp | ✅ routes.ts:2484-2551 (admin\|credentialing; DELETE admin) | NONE | provider.hurl (auth-gate 401 ×4; admin CRUD 201/200/204) | VERIFIED | 🟢 |
| **V-PROV-004** Deactivate = soft-delete, records retained | ✅ tsp | ✅ deactivatePractitioner.ts:30-43; practitioner.repo.ts:54-59 | NONE | practitioner.repo.test.ts (active=false + deactivatedAt); provider.hurl (204) | VERIFIED | 🟢 |
| **Route registration** 11 live ops codegen-registered | ✅ | ✅ routes.ts:2476-2553 | NONE | provider.hurl (200/201/204/401/404 per op) | VERIFIED | 🟢 |
| **Practitioner ownership self-edit (`practitioner:owner`)** | ⚠️ tsp declares | ❌ no handler check + no person link; role never granted | NONE | — (unreachable; surfaced) | NONE | ⚠️ spec drift |
| **Provider reads/updates/deletes (`getProvider`/`listProviders`/`updateProvider`/`deleteProvider`)** | ❌ no tsp | ⚠️ handler files exist but ORPHAN (no route/registry) | ⚠️ conflated | — (dead code) | NONE | ⚪ surfaced (orphan) |

**Counts (LIVE / declared items): 5 GREEN / 0 PARTIAL / 0 RED.** Plus 1 ⚠️ spec-drift row (`practitioner:owner`) + 1 ⚪ surfaced-orphan row + 1 KG-conflation.

**Verdict: READY** — the live surface (11 ops) is GREEN end-to-end and contract-pinned; the only gaps are non-load-bearing drift (orphan handlers, an aspirational unassignable owner role) that pose no reachable security risk, plus a KG conflation (backlog) and the absence of a product MODULE_SPEC (expected for a platform module).

---

## STEP 7 — Gaps Closed This Round

### Safe gap reinforcement (TDD, GREEN)

| # | Gap | Class | Fix |
|---|-----|-------|-----|
| 1 | **Credential field-visibility was unpinned.** `getPractitioner.test.ts` only asserted 200/401/404 happy-path — it did NOT prove the response carries the confidential `credential` (NPI/DEA/state-license) verbatim for an authorized session, nor that an unauthenticated request is refused even when the practitioner exists. Because credentials live only on the Practitioner and there is NO public/patient read path, the credential confidentiality rests entirely on the route role gate + the auth floor — so it must be pinned that (a) the privileged read DOES return the full credential (no accidental future redaction breaks clinical/credentialing use) and (b) there is no unauthenticated read. (The impl was correct; only the test was missing.) | REAL test gap (privileged field-visibility / no-public-read) | Added two tests to `getPractitioner.test.ts`: (a) an authorized session receives both `credential` entries (numbers + `state`) and the qualification license `identifier.value` verbatim (privileged projection, no redaction); (b) an unauthenticated request → **401** even when the practitioner exists. 3 → **5** tests, GREEN. |

### Doc / registry drift reconciled (docs commit)

| # | Drift | Fix |
|---|-------|-----|
| 2 | **WHOLE provider module ABSENT from `br-registry.json`** (13 module blocks — dental-visit … emr-consultation — none for `provider`). The exact recurring class from perio round 6 / audit round 10 / governance round 11 / portal round 12 / emr round 13; a platform-level (non-`dental-*`) module is as likely to be registry-absent as a cross-cutting one. | Added a `provider` block with 4 rules: **V-PROV-001** (Provider self-service create, security), **V-PROV-002** (credentials privileged-read-only / no public projection, privacy), **V-PROV-003** (practitioner/role writes admin/credentialing-gated + the `practitioner:owner` non-functional-role note, security), **V-PROV-004** (deactivate = soft-delete retained, state-guard) — each with real source + test citations. The block description records that the module is platform-role-governed with NO branch/tenant boundary, the three surfaces (Provider/Practitioner/PractitionerRole), AND the orphan-handler note. JSON re-validated. |

---

## Ranked Remaining Gaps (surfaced, NOT closed — out of safe scope)

**SPEC / CODE DRIFT (surface, do NOT build):**
1. **4 orphan handlers — `getProvider`/`listProviders`/`updateProvider`/`deleteProvider`.** These files exist (and typecheck), with a correct owner-check inside `updateProvider`/`deleteProvider`, but are NOT imported by the registry, NOT in any route table, and NOT declared in TypeSpec. The live Provider surface is create-only. **They are dead code** — a future cleanup should either wire them (declare in TypeSpec → regen) or delete them. `getProvider.ts` also carries a commented-out `status`-field block referencing a non-existent column. **Surface only** (deleting handlers + their commented code is a code change with a small risk of removing intended-but-unfinished work; needs a product decision on whether a public provider-read directory is wanted).
2. **`practitioner:owner` is a non-functional/aspirational role.** TypeSpec + routes list `practitioner:owner` on `getPractitioner`/`updatePractitioner` (and the role-equivalents), which makes `authMiddleware` pass through to the handler — but the handlers do **NO** ownership check and the `practitioners` schema has **NO person link** to compute ownership against, and the role is **never granted to any user**. So the latent IDOR (a bare `practitioner:owner` token reading/updating any practitioner) is **unreachable today**. If a practitioner-self-service surface is ever built, it MUST (a) add a `personId` link on `practitioners`, (b) add a handler-level `practitioner.personId === user.id` check, and (c) actually grant the role — the EMR round-13 pattern (owner role delegates to handler; handler is the boundary). **Surface only** (no safe in-place fix without the person link + a grant path, both schema/product decisions).

**ABSENT / lower-priority:**
3. **No product `MODULE_SPEC.md`/`API_CONTRACTS.md`** under `docs/product/modules/provider/` — expected for an upstream platform module (same as emr round 13). The TypeSpec doc-comments + this report are the spec of record. **Surface only.**
4. **KG conflates `flow:manage-providers` with the dental-org route + under-models the FHIR directory (KG-backlog).** Add a `provider-directory` domain on next regeneration (query-only).
5. **Credential `status` (active/expired/suspended/revoked/pending) is a free JSONB field, not a guarded FSM.** There is no server-side credential-verification state machine (pending→verified→active). This is an upstream non-goal, not a defect. **Surface only.**

---

## STEP 8 — Gate

| Gate | Result |
|------|--------|
| `cd services/api-ts && bunx tsc --noEmit` | ✅ 0 errors (orphan handlers typecheck fine — valid-but-dead) |
| Module suite (`test-with-db.ts`, all 4 provider test files) | ✅ **32 pass / 0 fail** (30 baseline + 2 new credential-visibility) |
| `eslint` (changed test file) | ✅ 0 errors, 0 warnings |
| `bun run check:boundaries` (api-ts) | ✅ no cross-module repo boundary violations (provider consumes person/EMR only via facades) |
| `br-registry.json` | ✅ valid JSON (`provider` block added, 4 rules) |
| Contract suite (fresh `:7213`, restarted with `AUTH_ADMIN_EMAILS`) | ✅ **`provider.hurl` 20/20 pass**. The 3 suite failures are **pre-existing environmental, outside this module**: `auth-verification` + `auth-password-reset` (mailpit:8025 down) and `billing-lifecycle` (Stripe) — identical to the prior thirteen rounds. No TypeSpec/route change this round, so no codegen impact. |

---

## IDOR / cross-owner / field-visibility / role-gating / optional-branchId verdict

- **Cross-owner edit (provider A → provider B's practitioner):** ✅ **CLEAR (no reachable path).** The live Practitioner surface is admin/credentialing-gated with no ownership concept (no person link); the `practitioner:owner` pass-through is unreachable (role never granted). The Provider surface's owner-check (`provider.person === user.id`) is correct but lives in **orphan/unwired** handlers. Surfaced: the latent `practitioner:owner` gap (unreachable today; fix requires a person link + grant path before any practitioner self-service).
- **Private-field projection (credential leak):** ✅ **CLEAR / N/A.** Credentials (NPI/DEA/state-license) live ONLY on the Practitioner, whose reads are role-gated to admin/clinician/support[/owner] — there is **NO public or patient-facing route** returning a practitioner. The public-directory `Provider` model carries no confidential fields (and its read handlers are orphan). Confidentiality is the route role gate, not a handler projection; pinned this round (privileged read returns full credential; unauth → 401).
- **Role-gating (create/write):** ✅ **CLEAR.** Provider create = `user` (self); practitioner/role create/update = admin\|credentialing; deactivate = admin; practitioner reads = admin\|clinician\|support. Contract pins 401 on every op pre-auth + the admin CRUD lifecycle.
- **Status FSM:** ✅ **CLEAR.** Deactivate is a one-way soft-delete (active=false+deactivatedAt, 204, records retained; 404 on missing). No multi-state credential FSM is enforced (credential `status` is a free field — surfaced non-goal).
- **Optional-filter / cross-resource-aggregate leak (EM-BIL-002 class):** ✅ **N/A by design** — the module has NO branch/tenant dimension at all; list endpoints scope on platform role only. (Fourth N/A-by-design module after audit-read-required, portal, emr; the carry-forward class was CLOSED in round 13.)
- **Audit logging:** structured `logger.info({action})` only — this platform module does not write a `dental_audit_log` row (not a `dental-*` module). By design, not a gap.

## What's actually BUILT vs SURFACED-as-absent

- **BUILT (and enforced + tested):** 11 endpoints — Provider self-service create (own person, role grant + session invalidation, PROVIDER_EXISTS); Practitioner CRUD (admin/credentialing) carrying confidential credentials with reads role-gated to clinical/credentialing staff (no public/patient read); PractitionerRole CRUD; soft-delete (active=false, records retained); credential field-visibility pinned as a privileged-only projection.
- **SURFACED-as-absent / drift (NOT built):** 4 orphan Provider read/update/delete handlers (dead code; no public directory wired); the `practitioner:owner` ownership path (non-functional — no person link, no handler check, never granted); a product MODULE_SPEC/API_CONTRACTS; a credential-verification FSM (upstream non-goal); a `provider` KG node (conflated with dental-org). None were auto-built.

## Files Changed

**docs commit (`docs(audit): module provider traceability + safe-gap closure`):**
- `services/api-ts/src/handlers/provider/getPractitioner.test.ts` — **NEW** credential field-visibility block (2 tests: privileged read returns full credential + qualification identifier verbatim; unauthenticated read → 401 even when practitioner exists)
- `specs/api/docs/standards/br-registry.json` — **NEW** `provider` block (4 rules: V-PROV-001 self-service create, V-PROV-002 credentials privileged-read-only, V-PROV-003 write role-gating + practitioner:owner note, V-PROV-004 soft-delete retained)
- `docs/audits/modules/MODULE_provider_AUDIT_2026-06-08.md` — this report
- `docs/audits/MODULE_AUDIT_TRACKER.md` — row 14 verdict + carry-forward note
