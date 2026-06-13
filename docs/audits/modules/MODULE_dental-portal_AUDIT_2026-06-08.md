# Module Audit — dental-portal (patient self-service portal)

**Date:** 2026-06-08
**Branch:** feat/module-workflow-alignment
**Auditor:** per-module deep audit + safe-gap closure (adversarial; verified against source)
**Verdict:** ✅ **GAPS (honest, well-documented)** — the patient-facing portal is a deliberately scoped **E4 Phase-1 read-only foundation**: three self-scoped READ endpoints (`GET /me/appointments`, `/me/invoices`, `/me/balance`) and nothing else. What IS built is **correct and IDOR-safe by construction** — every read derives the patient identity SERVER-SIDE from the session (`resolveSelfPatientIdOrThrow`, invariant `user.id === person.id → dental_patient.person_id`); **no portal route accepts a client-supplied `patientId`**, so cross-patient access is impossible by design, not just by check. The headline adversarial sweeps all pass: **IDOR = CLEAR** (patient A cannot read patient B's appointments/invoices/balance; a tampered `?patientId=B` is INERT), **self-scoping = CLEAR** (every list returns ONLY the session patient's rows, both directions, and an empty owned-scope returns `[]`/zero — never a fallback to all), **optional-filter leak = N/A/CLEAR** (the portal facades take a REQUIRED `patientId` that is always the session id — there is no optional-scope surface to omit), **guardian-over-scope = N/A** (guardian/household-dependent access is NOT built in the portal — there is no over-broad scope to leak), **write-scope = CLEAR** (the portal is strictly read-only; no `/me` write/pay/mutate route exists, so a patient cannot mutate clinic-owned data). No security hole found. Closed **2 safe gaps**: 1 adversarial-test reinforcement (IDOR-tamper-inert + empty-self-scope, 6 new assertions) and 1 registry/doc drift (whole module ABSENT from br-registry → added a 5-rule `dental-portal` block; WORKFLOW_MAP WF-078 over-described unbuilt Phase-2 features and omitted the built `/me` reads → reconciled). The **honest** finding: most patient-portal capabilities (self-booking, self-pay, secure messaging, consent management, guardian/dependent access, `/me` imaging/clinical reads) are **Phase-2 DEFERRED and SURFACED-as-absent** — not built, correctly not auto-built (a patient-write/PHI surface needs product decisions). Gates green.

---

## STEP 0 — Artifacts & /module-review

The portal resolves to a real, single handler dir — small and clean.

| Artifact | Location | Status |
|----------|----------|--------|
| Handler dir | `services/api-ts/src/handlers/dental-portal/` | ✅ `listMyAppointments.ts`, `listMyInvoices.ts`, `getMyBalance.ts` + `dental-portal.test.ts`. 160 LOC of production code — three read handlers, no repo of its own (consumes sibling-module facades). |
| **Auth boundary (IDOR-critical)** | `services/api-ts/src/handlers/shared/assert-self-patient.ts` | ✅ `resolveSelfPatientId`/`resolveSelfPatientIdOrThrow` (session→own patient id, the entry the 3 handlers call) + `assertSelfPatient` (path-param ownership gate, fully tested, kept ready for FUTURE `patientId`-bearing `/me` routes). |
| Cross-module facades | `dental-scheduling/repos/appointment-portal.facade.ts` (`getAppointmentsByPatientId`); `dental-billing/repos/billing-dental-patient.facade.ts` (`getInvoicesByPatientId`) | ✅ Portal does NOT import sibling schemas directly (Phase-10 boundary lint); both facades filter strictly `eq(patientId)`, newest-first, no optional filter. |
| TypeSpec | `specs/api/src/modules/dental-portal.tsp` (3 ops: `listMyAppointments`/`listMyInvoices`/`getMyBalance`) | ✅ Each op declares `@useAuth(bearerAuth)` + `x-security-required-roles: ["user"]`, responses `Ok | Unauthorized | Forbidden` (deliberately NO `ApiNotFoundResponse` — these reads take no path param, so 404 is unreachable). |
| MODULE_SPEC | **none** — no `docs/product/modules/dental-portal/` dir (surfaced, see gaps). The portal is spec'd by `dental-portal.tsp` + ROLE_PERMISSION_MATRIX (Phase-2 portal row) + WORKFLOW_MAP WF-078. | (spec'd by TSP + workflow doc) |
| Schema/migrations | **none of its own** — the portal owns no table; it reads `dental_appointments` / `dental_invoices` via facades and resolves identity through `patients`/`persons`. | ✅ (read-only, no migration risk) |
| Routes | `generated/openapi/routes.ts:2351-2367` — `GET /me/appointments|/me/balance|/me/invoices`, each `authMiddleware({ roles: ["user"] })`, codegen-registered. **No `/me` POST/PUT/PATCH/DELETE route exists** (verified). | ✅ |
| Tests | `dental-portal.test.ts` (27 assertions: IDOR core, two-direction isolation, 401/403, projection, voided/uncollectible exclusion, **IDOR-tamper-inert + empty-self-scope** — added this round) | ✅ |
| Contract | `specs/api/tests/contract/dental-portal.hurl` (11 req): 401-on-every-read, 403 `NOT_A_SELF_PATIENT` for an account with no linked patient, cross-user isolation (two independent signups each resolve only their own absent identity) | ✅ green vs fresh `:7213` |
| KG | `.understand-anything/domain-graph.json` — `domain:patient-portal` + `flow:patient-self-service-read` (4 steps) | ✅ **accurate** (rare — see STEP 3) |

**/module-review result:** **PASS.** No `test.skip`/`.only`/`xit`; no `Not implemented` stub; no TODO/FIXME/HACK; no non-test `as any`. All 3 TypeSpec `@operationId`s ↔ exported handler names match and are codegen-registered. The handlers take **no client input** (no query/path/body validator) — the IDOR surface is structurally absent.

---

## STEP 1–2 — Spec universe & conformance (portal-specific)

**Authorization model (CARRY-FORWARD #1 — this module is PATIENT-FACING, NOT staff).** The actor is a PATIENT: Better-Auth system role `user`, with a linked `Person` + `dental_patient` row and **NO `dental_membership`**. None of the staff dental handlers authorize "the patient viewing their OWN record" (they all assume membership) — which is exactly why `assert-self-patient.ts` exists. The boundary is **NOT `assertBranchRole`** (that's staff/branch). It is: derive the caller's own `dental_patient.id` from the session and read only that. The codebase invariant `user.id === person.id` (documented in `assert-branch-access.ts`/`getPerson.ts`) makes the own-patient record exactly `patients WHERE person_id = userId`.

| Invariant | Spec | Impl | Conformance |
|-----------|------|------|-------------|
| **IDOR-free self-scope (headline)** | dental-portal.tsp §IDOR / V-PORTAL-001 | `resolveSelfPatientIdOrThrow(db, user.id)` in all 3 handlers; **no route accepts a `patientId`**; facades `eq(patientId)`. | ✅ IDOR impossible by construction |
| **Staff-only account denied** | tsp `x-security-required-roles:["user"]` + in-handler | A user with no linked patient → `ForbiddenError NOT_A_SELF_PATIENT` (403); the `["user"]` route role is the auth gate, the patient-vs-staff distinction is in-handler. | ✅ |
| **Patient-appropriate projection** | handler docstrings / V-PORTAL-004 | appointments expose only schedule fields (no `dentistMemberId`/`notes`/`cancellationReason`); invoices only billing fields (no `dentistMemberId`/`discountReason`/`discountedBy`/line items). | ✅ |
| **Written-off / cancelled debt hidden** | getMyBalance/listMyInvoices docstrings / V-PORTAL-004 | `voided` AND `uncollectible` invoices filtered from `/me/invoices` and excluded from the `/me/balance` roll-up — a patient is never shown debt the clinic cancelled or internally wrote off. | ✅ |
| **Read-only — no patient mutation** | tsp (3 GETs only) / V-PORTAL-005 | No `/me` write route exists; a patient cannot mark a treatment performed, edit notes, or self-pay through the portal. | ✅ (absence is the guarantee) |
| **Empty self-scope ≠ fallback to all** | V-PORTAL-003 | facade `eq(patientId)` → a patient with zero rows gets `[]`/zeroed roll-up, never an unscoped all-patients result. | ✅ (**now tested**) |

**Drift both ways:** WORKFLOW_MAP WF-078 (`[INFERRED]`) over-described the portal with **Phase-2 features that are NOT built** ("View own PMD documents WF-066", "Revoke consent WF-035") and **omitted the three reads that ARE built** — reconciled (STEP 7). No impl-side feature is undeclared (the built surface is a strict subset of the spec).

---

## STEP 3 — KG mapping (query-only)

`.understand-anything/domain-graph.json` models the portal **accurately** — the first round in this series with **no KG drift**:
- `domain:patient-portal` ("Patient Self-Service Portal").
- `flow:patient-self-service-read` with `entryPoint = "GET /me/appointments | GET /me/invoices | GET /me/balance"` (the **REAL** routes — no phantom path segment) and 4 steps (`resolve-self-patient`, `list-appointments`, `list-invoices`, `get-balance`).
- The summary states the **correct headline invariant verbatim**: *"IDOR-safe: no client-supplied patientId; derived server-side from session"*, and cites the right files (`dental-portal/listMyAppointments.ts`, `getMyBalance.ts`, `listMyInvoices.ts`, `shared/assert-self-patient.ts`) and the right facade descriptions (patient-appropriate projection, no voided/uncollectible).

**KG-projection drift: NONE.** No phantom routes, no over-claim, no lossy under-model. Tag `idor-safe` is present. (Contrast every prior round, which carried a phantom route or wrong store.) No KG-backlog item this round.

---

## STEP 4/5 — Tests (ADVERSARIAL) + AUTH model

| Portal MUST-VERIFY axis | Test | Strength |
|--------------------------|------|----------|
| **(a) IDOR — patient A → patient B's resource denied** | `dental-portal.test.ts` — `assertSelfPatient(USER_A, PATIENT_B)` → `ForbiddenError 403` (no leak); `assertSelfPatient(USER_A, NONEXISTENT)` → `NotFoundError 404`. Each `/me` read with `USER_A` asserts B's appointment id / invoice number is ABSENT (`not.toContain`). **NEW:** `USER_A` appending `?patientId=PATIENT_B` to each read STILL returns ONLY A's rows (the tampered param is INERT). | VERIFIED (core + tamper-inert) |
| **(b) self-scoping — list returns ONLY session rows (B absent, both directions)** | `/me/appointments`: A → 1 row `checkup`, B's id absent; B → 1 row `treatment`, A's id absent. `/me/invoices`: A → only `INV-A-1`, `INV-B-1` absent. `/me/balance`: A → 6000, B → 20000 (each from own invoices only). **NEW:** patient C (real, owned, zero rows) → `[]`/`[]`/zeroed (empty scope is the session set, not a fallback). | VERIFIED (both directions + empty) |
| **(c) guardian — dependent access bounded** | **N/A — not built.** The portal exposes no guardian/household-dependent access; a portal patient reads only their own `dental_patient` row. The `dental_household_member.relationship` column ('dependent'…) exists in `dental-patient`, but the portal does NOT consume it, so there is no over-broad guardian scope to test or leak. SURFACED as Phase-2 deferred. | N/A by design (surfaced) |
| **(d) self-pay can't pay another patient's invoice** | **N/A — no self-pay endpoint.** Online payment is explicitly Phase-2 deferred (needs a payments vendor + PHI-scope product decision). `/me/balance`/`/me/invoices` are read-only; no money mutation exists. | N/A (deferred) |
| **(e) write-scope — patient can't mutate clinic data** | **VERIFIED by absence.** No `/me` POST/PUT/PATCH/DELETE route is registered (grep `app.(post\|put\|patch\|delete)('/me/` → none); the portal cannot reach any mutation. A patient is structurally unable to mark a treatment performed / edit notes / void an invoice through the portal. | VERIFIED (no write surface) |
| **Auth / role-gating** | Routes gate `authMiddleware({roles:["user"]})`; unauthenticated → 401 (tested per read + per contract); a `user` with no linked patient (staff-only account) → 403 `NOT_A_SELF_PATIENT` (tested per read + per contract, both directions). | VERIFIED |

**Round-9 optional-branchId / cross-resource-aggregate lens (CARRY-FORWARD #2):** the portal's two list endpoints (`/me/appointments`, `/me/invoices`) and the `/me/balance` aggregate scope on a **REQUIRED** `patientId` that is **always the session-derived id** — there is no optional `branchId`/`patientId` filter that, when omitted, widens the result. The EM-BIL-002 hazard (an optional scope omitted → unfiltered all-tenant aggregate) **does not apply**: the facades take a mandatory `eq(patientId)` and the patientId can only ever be the caller's own. Cross-tenant is doubly impossible — the patient row is org/branch-anchored AND the scope is the session id, not a caller param. **CLEAR.**

---

## STEP 6 — Traceability Matrix

| Item | Spec? | Impl? | KG | Test (file:line) | Strength | Verdict |
|------|-------|-------|----|------------------|----------|---------|
| **V-PORTAL-001** IDOR-free self-scope; tampered `?patientId` inert | ✅ | ✅ assert-self-patient.ts:63-75; listMy*.ts | flow + summary | dental-portal.test.ts (assertSelfPatient other→403; isolation both dirs; **NEW tamper-inert ×3**) | VERIFIED | 🟢 |
| **V-PORTAL-002** staff-only → 403; unauthenticated → 401 | ✅ | ✅ assert-self-patient.ts:68-73; routes `roles:["user"]` | flow | dental-portal.test.ts (staff-only → 403 ×4; 401 ×3); dental-portal.hurl (403 NOT_A_SELF_PATIENT both users; 401 ×3) | VERIFIED | 🟢 |
| **V-PORTAL-003** empty self-scope → `[]`/zero, no fallback | ✅ | ✅ facades `eq(patientId)` | flow | **dental-portal.test.ts (NEW: patient C zero rows → [] / [] / zeroed)** | VERIFIED (added) | 🟢 |
| **V-PORTAL-004** patient-appropriate projection; voided+uncollectible hidden | ✅ | ✅ listMyInvoices.ts:33-44; getMyBalance.ts:30-39; listMyAppointments.ts:35-44 | facade summary | dental-portal.test.ts (projection excludes staff fields; voided+uncollectible hidden; balance excludes both) | VERIFIED | 🟢 |
| **V-PORTAL-005** read-only; no patient write/mutate path | ✅ | ✅ routes.ts (3 GETs only) | flow | grep verified (no `/me` write route) | VERIFIED | 🟢 |
| **Route registration** 3 ops codegen-registered (not 404) | ✅ | ✅ routes.ts:2351-2367 | flow | dental-portal.hurl (200/401/403, not 404) | VERIFIED | 🟢 |
| **assertSelfPatient (future path-param gate)** self ok / other 403 / nonexistent 404 | ✅ | ✅ assert-self-patient.ts:96-119 | step:resolve-self-patient | dental-portal.test.ts:165-185 | VERIFIED | 🟢 |
| **Guardian/household-dependent portal access** | spec'd Phase-2 | ❌ NOT built | NONE | — | N/A | ⚪ deferred (surfaced) |
| **Self-booking / online self-pay / messaging / consent / `/me` imaging-clinical** | spec'd Phase-2 | ❌ NOT built | NONE | — | N/A | ⚪ deferred (surfaced) |

**Counts (BUILT items): 7 GREEN / 0 PARTIAL / 0 RED.** Plus 2 SURFACED-as-absent Phase-2 rows (deferred, correctly not built).

**Verdict: GAPS** — what is built is GREEN end-to-end; the "gaps" are the well-documented, intentionally-deferred Phase-2 portal surface (an honest GAPS outcome per the audit charter, not a defect).

---

## STEP 7 — Gaps Closed This Round

### Safe gap reinforcement (TDD, GREEN)

| # | Gap | Class | Fix |
|---|-----|-------|-----|
| 1 | **IDOR-tamper-inertness + empty-self-scope were unpinned.** The portal's headline promise — "there is NO client-supplied patientId to tamper" — was correct by source (handlers take no input) but no test asserted that *deliberately appending* `?patientId=<other>` is ignored, and no test pinned that a real owned patient with **zero rows** gets `[]`/zero (rather than an error or a fallback to all). | REAL test gap (adversarial IDOR + empty-scope pin) | Added to `dental-portal.test.ts`: a 3rd patient `USER_C`/`PATIENT_C` (no appointments/invoices); a describe block where `USER_A` appends `?patientId=PATIENT_B` to each read and STILL gets ONLY A's rows (would go RED if a refactor ever wired a query param into scope); and an empty-self-scope block (C → `/me/appointments` `[]`, `/me/invoices` `[]`, `/me/balance` zeroed). 21 → **27** assertions, GREEN. |

### Doc / registry drift reconciled (docs commit)

| # | Drift | Fix |
|---|-------|-----|
| 2 | **WHOLE portal module ABSENT from `br-registry.json`** (12 module blocks, none for `dental-portal` — the exact recurring class from dental-perio round 6 / dental-audit round 10 / governance round 11; patient-facing concerns are as likely to be registry-absent as cross-cutting ones). | Added a `dental-portal` block with 5 rules: V-PORTAL-001 (IDOR-free self-scope headline, security), V-PORTAL-002 (staff-only denied / patient-only boundary, security), V-PORTAL-003 (empty self-scope ≠ fallback, security), V-PORTAL-004 (patient-appropriate projection + voided/uncollectible hidden, privacy), V-PORTAL-005 (read-only, no write path, security) — each with real source + test citations. JSON re-validated. |
| 3 | **WORKFLOW_MAP WF-078 over-described the portal AND omitted the built reads.** WF-078 (`[INFERRED]`) listed Phase-2 features that are NOT built ("View own PMD documents WF-066", "Revoke consent WF-035") and never named the three `/me` reads that ARE built. | Rewrote WF-078 to the real E4 Phase-1 state: the 3 built reads with their handlers, the IDOR boundary (V-PORTAL-001), the 403/401 gating, and an explicit DEFERRED-Phase-2 list (PMD/consent/self-booking/self-pay/messaging/guardian/`/me` imaging-clinical) with the read-only write-scope note. Dropped the stale `[INFERRED]` tag (the flow is now BUILT, not inferred). |

---

## Ranked Remaining Gaps (surfaced, NOT closed — out of safe scope)

**ABSENT features / product decisions (surface, do NOT build — patient-write + PHI surface is high-risk):**
1. **Guardian / household-dependent portal access is NOT built (CARRY-FORWARD #3).** The data model has `dental_household_member.relationship`, but the portal exposes no path for a guardian to read a dependent's data. This is the right posture for Phase 1 (no over-broad scope can leak), but a real product gap: a parent cannot see a child's appointments. Building it safely requires a server-side guardian→dependent relationship check (a guardian sees ONLY their own dependents, verified from the household store, never trusted from the client) — a deliberate feature, not a safe gap. **Surface only.**
2. **Self-booking / reschedule / cancel from the portal — DEFERRED.** Read-only Phase 1 exposes appointments but no patient-initiated booking. (Staff-side WF-006/WF-060 booking exists; the patient-facing online-booking surface is a separate `online-booking.hurl`/`provider` path, not portal-wired.)
3. **Online self-pay — DEFERRED.** `/me/invoices`/`/me/balance` are read-only; paying an invoice needs a payments vendor + a PHI-scope product decision (noted in the tsp DEFERRED list). When built, it MUST re-derive the invoice's owner from the session and reject paying another patient's invoice (the carry-forward MUST-VERIFY (d)).
4. **`/me` imaging / clinical-summary / treatment-plan reads — DEFERRED.** The tsp names `/me/visits`, `/me/treatment-plans`, `/me/imaging` as the next milestone. `assertSelfPatient` (the path-param ownership gate) is **already built + tested** precisely so these patientId-bearing routes are IDOR-correct the moment they land. **Surface only.**
5. **Secure messaging / consent management from the portal — DEFERRED.** Consent today is staff-mediated (`dental-clinical`) + JSONB on Person; a patient-facing revoke/grant flow (WF-035) is Phase 2.
6. **No `dental-portal` MODULE_SPEC dir.** Like `dental-erasure` (round 11), the portal is spec'd by its `.tsp` + WORKFLOW_MAP + ROLE_PERMISSION_MATRIX rather than a `docs/product/modules/dental-portal/MODULE_SPEC.md`. Adding a parallel anchor would complete the symmetric doc set — **doc-creation, deferred** (the contract is fully covered by the TSP + the new br-registry block).

**REAL test gaps (impl present, lower-value, not added):**
7. **Route-level `["user"]`-role rejection for a non-`user` role** (e.g. an `admin`-only token) is covered generically by `middleware/auth.test.ts`; not re-pinned at the portal layer (belt-and-suspenders — the gate is the shared authMiddleware proven elsewhere).

**KG-backlog:** NONE — `domain:patient-portal` + `flow:patient-self-service-read` are accurate (correct routes, correct IDOR claim, correct file paths). First clean-KG round in the series.

---

## STEP 8 — Gate

| Gate | Result |
|------|--------|
| `cd services/api-ts && bunx tsc --noEmit` | ✅ 0 errors |
| Module suite (`test-with-db.ts`, `dental-portal.test.ts`) | ✅ **27 pass / 0 fail** (21 baseline + 6 new: IDOR-tamper ×3, empty-self-scope ×3) |
| `eslint` (changed test file) | ✅ 0 errors |
| `bun run check:boundaries` (api-ts) | ✅ no cross-module repo boundary violations (the portal consumes scheduling/billing only via facades — the boundary the lint protects; clean) |
| `br-registry.json` | ✅ valid JSON (`dental-portal` block added, 5 rules) |
| Contract suite (fresh `:7213`, restarted) | ✅ **`dental-portal.hurl` Success (11 req)** green. **43/46 files pass**; the 3 failures are **pre-existing environmental, outside this module**: `auth-verification` + `auth-password-reset` (mailpit:8025 down), `billing-lifecycle.hurl` (Stripe) — identical to the prior eleven rounds (`dental-billing.hurl` itself passes 40/40). |

---

## IDOR / self-scoping / guardian / optional-filter verdict

- **IDOR (patient A → patient B):** ✅ **CLEAR.** Identity is derived server-side from the session (`resolveSelfPatientIdOrThrow`, `patients.person === user.id`); no portal route accepts a `patientId`, and a deliberately-tampered `?patientId=B` is INERT (tested). `assertSelfPatient` (the future path-param gate) denies a non-owned patient (403) / nonexistent (404), no leak. Cross-patient access is impossible **by construction**, not just by a check.
- **Self-scoping (lists return ONLY session rows):** ✅ **CLEAR.** Facades `eq(patientId)`; tested both directions (A's rows absent for B and vice-versa) AND for the empty owned-scope (zero rows → `[]`/zero, never a fallback to all).
- **Guardian-over-scope:** ✅ **N/A by design** — no guardian/dependent access is built in the portal, so there is no over-broad scope. Building it (surfaced) MUST enforce the household relationship server-side.
- **Optional-filter / cross-resource-aggregate leak (EM-BIL-002 class):** ✅ **CLEAR / N/A** — the portal facades take a REQUIRED `patientId` that is always the session id; there is no optional `branchId`/`patientId` filter to omit, and the `/me/balance` aggregate sums only the caller's own invoices.

## What's actually BUILT vs SURFACED-as-absent

- **BUILT (and enforced + tested):** three self-scoped read endpoints (`/me/appointments`, `/me/invoices`, `/me/balance`); the IDOR-critical session→own-patient resolver + the (ready, tested) path-param ownership gate; patient-appropriate projections (no staff fields); voided + uncollectible (written-off) debt hidden from invoices AND balance; `["user"]`-role + staff-only-403 + unauthenticated-401 gating. **All four applicable MUST-VERIFY axes (IDOR, self-scope, write-scope, optional-filter) hold; guardian + self-pay are N/A because they're unbuilt.**
- **SURFACED-as-absent / Phase-2 deferred (NOT built — patient-write/PHI surface honored):** guardian/household-dependent access; self-booking/reschedule; online self-pay; `/me` imaging/clinical/treatment-plan reads; secure messaging + patient-facing consent management; a `dental-portal` MODULE_SPEC anchor. None were auto-built.

## Files Changed

**docs commit (`docs(audit): module dental-portal traceability + safe-gap closure`):**
- `services/api-ts/src/handlers/dental-portal/dental-portal.test.ts` — **NEW** IDOR-tamper-inert (×3) + empty-self-scope (×3) assertions (+ `USER_C`/`PATIENT_C` fixture)
- `specs/api/docs/standards/br-registry.json` — **NEW** `dental-portal` block (5 rules: V-PORTAL-001..005)
- `docs/product/WORKFLOW_MAP.md` — WF-078 reconciled (over-described Phase-2 / omitted built reads → real E4 Phase-1 state + deferred list; dropped stale `[INFERRED]`)
- `docs/audits/modules/MODULE_dental-portal_AUDIT_2026-06-08.md` — this report
- `docs/audits/MODULE_AUDIT_TRACKER.md` — row 12 verdict + carry-forward updates
