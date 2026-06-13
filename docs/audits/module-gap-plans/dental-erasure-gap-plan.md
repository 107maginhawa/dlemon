# Module Gap Plan — `dental-erasure`

**Module:** dental-erasure (Right-to-Erasure / GDPR Art.17 / RA 10173 §34 — V-DG-002 / WFG-006)
**Audited:** 2026-06-09
**Auditor mode:** module-scoped audit (no fixes applied)
**Reference standard:** `docs/context/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md` §3.13/§3.14, §5.11 (audit rules); `docs/product/DATA_GOVERNANCE.md` §3.

---

## Audit Decision: **PARTIAL PASS**

The backend anonymization engine is genuinely well-built and well-tested — all five safety
invariants (anonymize-not-delete, audit-never-touched, legal-hold-blocks, dry-run-by-default,
idempotent, fully-audited) hold and are covered at engine / service / route / facade / contract
levels, including physical S3 radiograph delete with fail-open. **But the module is not a usable,
aligned product workflow:** it has zero frontend surface, is callable only by a hardcoded set of
platform-superadmin emails (no clinic user can invoke it), and trusts an unvalidated `tenantId`
from the request body with no check that the subject actually belongs to it. This matches the
already-documented open item in IDEAL standard §3.14 ("Erasure / legal-hold cross-tenant admin
scope — implemented but admin-role-only with no tenancy gate — needs an explicit product decision").

Not FAIL: the destructive path is safe, reversibly-scoped (anonymize not delete), legal-hold-gated,
and audited. Not PASS: no operable workflow + an unresolved authz/tenancy design gap.

---

## RBAC semantics (the key context)

- `user.role === 'admin'` is a **platform-level global superadmin** role, granted ONLY to emails in
  `AUTH_ADMIN_EMAILS` (`admin@monobase.com`, `support@monobase.com`, `admin@contract-tests.local`)
  via the Better-Auth create hook in `services/api-ts/src/core/auth.ts:116-154`.
- It is **separate from** dental org membership roles (`dentist_owner`, `staff_full`, …) stored on
  `dental_membership.role`.
- The demo seed grants **no** account `role:'admin'` — `demo@dentalemon.com` is `dentist_owner` only
  (seed-demo.ts:537). So in the demo, **no logged-in user can perform erasure at all**.
- `admin` is **not org-scoped** — an admin endpoint that checks only `user.role === 'admin'` and
  reads `tenantId` from the body operates across all tenants with no ownership check.

---

## Gaps

### P0
_None._ The irreversible/destructive concern (cross-tenant *privilege escalation*) does not apply
because clinic owners are not `admin`; only trusted platform operators can call these endpoints.
The tenancy issue is therefore a P1 footgun, not a P0 breach.

### P1

| ID | Gap | Why it matters |
|----|-----|----------------|
| ER-P1-1 | **No tenant/ownership validation.** `requestErasure` takes `tenantId` from the request body unchecked (`requestErasureHandler.ts:24-31`); `getErasureRequest`/`approveErasure`/`rejectErasure` look the row up by `id` with no tenant scope; `anonymizePersonPii` redacts purely by `personId` with no tenant filter (`person-erasure.facade.ts:39-71`). The stated `tenantId` is decorative — an operator can anonymize a person who belongs to a *different* tenant than the one recorded, and `listErasureRequests` with no `tenantId` filter returns **all tenants' requests** (cross-tenant PII: subject ids + reasons). | Wrong-tenant erasure of PII (effectively destructive); cross-tenant disclosure on list. Even for a trusted operator this is an unguarded irreversible action. This is the §3.14 "needs a product decision" item. |
| ER-P1-2 | **No operable workflow — zero frontend.** No route, page, settings panel, component, hook, or SDK call anywhere in `apps/dentalemon`, `apps/account`, or `apps/sample-workspace`. The GDPR/RA-10173 right-to-erasure workflow cannot be initiated, reviewed, approved, or rejected by any user through the product. | The product documents GDPR/HIPAA/RA-10173 compliance (DATA_GOVERNANCE.md) but the data-subject-rights workflow is not deliverable. A compliance feature that exists only as raw API is not a fulfilled obligation. |
| ER-P1-3 | **Data controller cannot act.** Only 3 hardcoded platform emails can erase. The clinic (the actual GDPR data controller / RA-10173 PIC) has no role that can request or approve erasure of its own patients. This is the unresolved product decision: *who* should be able to erase (almost certainly `dentist_owner` scoped to their own tenant). | Blocks real-world compliance use; ties directly to ER-P1-1's fix (resolve subject→tenant, enforce that tenant's owner). |

### P2

| ID | Gap | Why it matters |
|----|-----|----------------|
| ER-P2-1 | ✅ **FIXED 2026-06-09 (Batch 3).** `listErasureRequestsHandler.ts` now returns `{ data: rows }`, conforming to the already-declared `ErasureRequestList = { data }` contract (no spec change — the impl was violating the spec). `dental-erasure.hurl`'s 5 list scenarios flipped `$`/`$[0]` → `$.data`/`$.data[0]` (RED-before); `erasure-routes.test.ts` asserts the `body.data` envelope. ER-P3-1 role-annotation drift left **out of scope** (independent P3, not required to complete ER-P2-1). ~~List-response shape contract drift.~~ | (done) |
| ER-P2-2 | **No tenant-isolation tests.** No test asserts an admin/operator cannot list/get/approve a subject outside a given tenant; the cross-tenant list-leak in ER-P1-1 is therefore untested. | The exact gap that lets ER-P1-1 ship silently. Fix must be RED-first. |

### P3

| ID | Gap | Why it matters |
|----|-----|----------------|
| ER-P3-1 | **Misleading role annotation.** TypeSpec marks all ops `x-security-required-roles: #["user"]` (`dental-erasure.tsp:101,114,129,143,159`) and the SDK JSDoc says "Requires role: 'user'", but every handler requires `role === 'admin'`. Impl is stricter than advertised (not a hole) but the generated docs/SDK mislead. | Cosmetic/contract-accuracy; fix when touching the spec for ER-P2-1. |
| ER-P3-2 | **No E2E journey.** Blocked by ER-P1-2 (no UI). Add once a UI exists. | Coverage completeness. |

---

## Broken / Misleading Journeys

- **Erasure request → review → approve/reject**: exists end-to-end in the backend but is **reachable by no user** in the product (no UI; and demo has no admin account). Effectively a dead workflow from the product's perspective.
- **"List erasure requests"**: returns a bare array while the published contract promises `{data:[…]}` — any contract-faithful consumer is silently broken (ER-P2-1).

## Unused / Unwired Implementation

- Entire HTTP surface (`requestErasure`, `listErasureRequests`, `getErasureRequest`, `approveErasure`, `rejectErasure`) — backend + SDK functions + TanStack hooks all generated, **zero consumers**.
- `subjectPatientId` / `branchId` are accepted and stored but never used for scoping or display.

## Existing tests found (strong where present)

- `erasure-service.test.ts` — request/approve/reject lifecycle, legal-hold block, audit-survives-anonymization, state guard.
- `erasure-engine.test.ts` — dry-run default, live anonymize, legal-hold block, idempotent noop, per-target counts, S3 file-id surfacing.
- `erasure-legalhold.test.ts` — real legal-hold store blocks approval; release then allows.
- `erasure-routes.test.ts` — full HTTP lifecycle, **non-admin 403**, missing-reason 400, unknown-id 404, S3 delete via ctx storage.
- `erasure-route-registration.test.ts` — all 5 routes registered (401 unauth, not 404) against the real app.
- `erasure-s3-delete.test.ts` — physical S3 + storage-row delete, **fail-open**, empty-list no-op.
- `person/patient/clinical/imaging-erasure.facade.test.ts` — per-entity anonymize-not-delete, idempotency, cross-subject isolation (consent).
- Contract: `specs/api/tests/contract/dental-erasure.hurl` — 401 gates, create, list+filters, get, reject, legal-hold block+release, 404, **non-admin 403**, double-approve guard, validation.

## Missing tests

- **Tenant isolation** (backend/integration): operator/tenant-A cannot list/get/approve/erase a tenant-B subject (ER-P2-2). Backend + contract.
- **List shape** assertion against the *contract* `{data:[…]}` once ER-P2-1 is fixed (currently asserts the wrong shape).
- **Frontend** unit tests for the (to-be-built) erasure admin UI (ER-P1-2).
- **E2E** journey: request → approve → subject anonymized → audit visible (ER-P3-2), after UI exists.

## Recommended tests to add before / during fixes

- Before ER-P1-1: RED integration test — `listErasureRequests` without `tenantId` must NOT return another tenant's rows; `approveErasure` on a request whose subject resolves to a different tenant than `request.tenantId` must 403/validate. Add the matching Hurl cross-tenant scenario.
- Before ER-P2-1: flip the Hurl list assert to `$.data[0]` (RED against current bare-array impl), then fix the handler to return `{ data: rows }`.
- During ER-P1-3/UI: FE unit tests + one E2E journey.

---

## Recommended Fix Order

1. **Product decision (ER-P1-3 / §3.14):** decide who may erase. Recommended: `dentist_owner` scoped to their own tenant (data controller), with platform `admin` as an optional override. *Blocks 2.*
2. **ER-P1-1 tenancy gate** (with ER-P2-2 tests RED-first): resolve the subject's real tenant from person/patient; enforce the actor's membership+role in that tenant (reuse `assertBranchRole`/tenant guard from `handlers/shared/`); default `listErasureRequests` to the caller's tenant; reject body `tenantId` that doesn't match the subject. Add cross-tenant backend + Hurl tests.
3. **ER-P2-1 list-shape**: flip the Hurl assert to the contract shape (RED), change handler to `{ data: rows }`, re-run contract. Then ER-P3-1: correct the TypeSpec role annotation to `#["admin"]` (or the decided role) and regen SDK.
4. **ER-P1-2 frontend**: build the admin/owner erasure UI (request list + detail + approve/reject with reason + legal-hold indicator), wired via the SDK hooks. FE unit tests.
5. **ER-P3-2 E2E**: one journey covering request → approve → anonymized → audit.

---

## Dependencies on other modules

- **person / patient / dental-clinical (consent) / dental-imaging / storage**: erasure targets call each module's `*-erasure.facade.ts`; any tenancy gate must resolve subject→tenant through person/patient. Blast radius of the anonymize path touches all of these (PII redaction is global-by-personId today).
- **dental-legalhold**: approval consults `isPersonUnderLegalHold`; same admin-only/no-tenant-gate pattern applies there (`placeLegalHoldHandler.ts`) — fix together.
- **dental-org / Better-Auth**: the role decision (ER-P1-3) depends on org membership roles and `assertBranchRole`.
- **audit (core/audit-logger)**: erasure writes `security`/`compliance` events; must remain append-only (already enforced).

## Knowledge graph / wiring findings

- Backend→facades→repos wiring is clean and boundary-compliant (engine imports only `*-erasure.facade.ts`, never foreign repos).
- **Consumer wiring: zero.** All 5 operations have generated SDK functions + TanStack hooks and **no** frontend caller — a textbook "backend endpoints with no frontend consumer" cluster.
- Anonymize blast radius spans person + patient + consent_form + imaging (+ S3) but is keyed solely on `subjectPersonId` with no tenant predicate — the structural root of ER-P1-1.

## Items needing confirmation

- `[NEEDS CONFIRMATION]` **Product decision** on who may erase (clinic `dentist_owner` per-tenant vs platform `admin` only). Drives ER-P1-1/-3 and the UI audience.
- `[NEEDS CONFIRMATION]` Whether bulk GDPR Art.20 export (DATA_GOVERNANCE §4, deferred pending WFG-006 PRD) should be co-located with this module's UI.
- `[NEEDS CONFIRMATION]` Intended `branchId`/`subjectPatientId` semantics — stored but unused; should they scope access or display?
