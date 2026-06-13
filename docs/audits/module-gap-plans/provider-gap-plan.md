# Provider Module — Gap Plan

**Module:** `provider` (FHIR R4 Practitioner / PractitionerRole + pre-FHIR `Provider`)
**Audited:** 2026-06-09 · **Branch:** `chore/workflow-verification-sweep` @ `e49e411d`
**Method:** Wiring/traceability audit via knowledge graph + contract-spine + code read. No live `/webwright` drive — **the module has zero UI in any frontend workspace** (`apps/dentalemon`, `apps/account`, `apps/sample-workspace` all grep-clean for `practitioner`/`providerType`/`createProvider`), so there is no product surface to drive. Absence-of-UI is itself a finding, not a skipped step.

## Audit Decision: **PARTIAL PASS**

The module is internally coherent and tested in isolation (repo unit tests + a passing `provider.hurl` contract suite), and it does **not** break any dental workflow — because **no dental workflow uses it**. It fails the *usable* and *aligned-with-product* bars: it is a backend-only base-template module that duplicates the product's real "provider/dentist" concept (`dentalMemberships`) and ships a session-revoking self-service endpoint that conflicts with the product's org-membership + PIN auth model. No P0 (nothing in the live product depends on it), but two P1 alignment/trust gaps.

---

## The Central Finding — three competing representations of "a person who provides care"

| Representation | Table / source | Used by the dental product? | Tests |
|---|---|---|---|
| **`dentalMemberships`** (dental-org) | `dental_membership` | ✅ **YES — canonical.** Scheduling `dental_appointment.dentist_member_id` → memberships; waitlist `preferred_provider_id` → memberships; holds `provider_id` → memberships. Staff UI (`features/staff/`, `_dashboard/staff.tsx`) is membership-based via `GET /dental/org/members`. | yes |
| **`Provider`** (pre-FHIR, this module) | `provider` table | ⚠️ Backend-only. Consumed by **EMR** module (`provider-emr.facade` → authz for consultation notes). No FE, no seed rows. | facade test only; `createProvider` handler **untested** |
| **`Practitioner` / `PractitionerRole`** (FHIR R4, this module) | `practitioner`, `practitioner_role` | ❌ **No consumers at all** — not FE, not EMR, not seed. Pure dead scaffolding (11 endpoints). | repo tests + contract only; handlers (create/update/deactivate) untested |

The dental product's source of truth for "dentist/provider" is **`dentalMemberships`**. The `provider` module is base-template residue carrying two *additional* parallel models.

---

## Gaps

| # | Gap | Area | Severity | Why it matters | Recommended fix |
|---|---|---|---|---|---|
| G1 | **Duplicate / competing source of truth.** `provider.Provider` + `Practitioner` model the same concept as `dentalMemberships`, which the product actually uses. | Data / product alignment | **P1** | A future dev wiring "treating provider" to the wrong table gets a silently empty/divergent result; credentialing data could be entered where nothing reads it. Erodes trust in the data model. | Make the product decision (see NEEDS CONFIRMATION). Document the canonical provider concept in `MODULE_BOUNDARIES.md` / an ADR. Quarantine or remove the unused models. |
| G2 | **`createProvider` conflicts with the product auth model.** `POST /providers` (role `user`, i.e. any authenticated user) grants the Better-Auth **global** `provider` role and **revokes the caller's session** (forces re-login). | Auth / trust | **P1** | The dental product authorizes via org membership + PIN, not Better-Auth global roles. A real clinic user who hits this endpoint gets logged out and tagged with a role the product never reads — a surprising, untested, reachable footgun. Inert at best, confusing at worst. | If credentialing is not a V1 need: remove the endpoint (or gate to `admin` and drop the session-revoke). Add a handler test pinning the chosen behavior. |
| G3 | **No frontend — module is unusable.** Credentialing workflows the TypeSpec promises (license/DEA expiry tracking via `PractitionerCredential.expiryDate`+`status`, specialty/NPI directory search) have no UI in any workspace. | Usability | **P2** | If "practitioner credentialing / provider directory" is a product capability, it is 0% reachable by users. If it is not, ~11 endpoints + 2 tables are dead weight. Either way it is a gap against the standard's "usable" bar. | Driven by the product decision: build FE + wire into dental roles, or formally deprecate. |
| G4 | **Phantom RBAC roles.** Practitioner routes gate on `credentialing`, `clinician`, `support` (`authMiddleware({roles:[...]})`, enforced at runtime). These are **not** part of the dental role model — only `admin` (present in every role set) can reach them. | RBAC | **P2** | The realistic credentialing user (a non-admin office manager) cannot use the credentialing endpoints. Gating is effectively admin-only and the extra role names are dead. | Reconcile required roles with the actual dental role set, or document admin-only intent and drop the phantom role names. |
| G5 | **Empty in seed.** `db:reseed` creates no `provider`/`practitioner` rows. | Seed coherence | **P2** | EMR's provider-authz path (`getProviderByPersonIdForEMR`) is exercised only by tests, never demo data; any future provider UI would open to an empty list with no way to populate it via the demo. | If retained: seed providers linked to the existing dentist memberships' persons. |
| G6 | **Handler-level test gaps.** Only `getPractitioner` has a handler test. `createProvider`, `createPractitioner`, `update*`, `deactivate*` have **no unit tests** (repos + `provider.hurl` contract cover the data + wire layers, but not handler business logic — e.g. the createProvider session-revoke/role-grant branch). | Tests | **P2** | The riskiest behavior in the module (G2) is the least tested. | Add handler unit tests for the chosen end-state (most likely: a test pinning createProvider's removed/gated behavior). |
| G7 | **Terminology drift.** Three names — `Provider`, `Practitioner`, membership/`dentist` — for one concept. | Maintainability | **P3** | Onboarding/maintenance friction; raises the odds of G1 recurring. | Pick one term in docs; alias the others as explicitly "legacy/base-template." |

---

## Broken / Misleading Journeys

- **No user-facing journeys exist** for this module (no UI). Nothing is *broken* in the live product because nothing routes here.
- **Misleading at the API/contract layer:** `provider.hurl` and the OpenAPI spec advertise a full credentialing + practitioner-directory API that no client consumes and no UI exposes — a reader of the spec would reasonably assume the capability is live.
- **Latent footgun (G2):** `POST /providers` is reachable by any authenticated user and silently logs them out — a "journey" a curious user could stumble into with a surprising result.

## Unused / Unwired Implementation

- **Fully unwired (no consumer anywhere):** all `Practitioner` + `PractitionerRole` endpoints (create/list/get/update/deactivate × 2 = 10 ops) and their repos/schema.
- **Backend-only (1 consumer, no FE):** `Provider` model — read by EMR via `provider-emr.facade` only; written only by the orphan `createProvider` endpoint.
- **SDK hooks generated but unused:** `createPractitionerMutation`, `listPractitionersInfiniteOptions`, `getPractitionerOptions`, … all present in `packages/sdk-ts` with zero importers in `apps/`.

## Test Gaps (recommended additions, by the chosen end-state)

- **If DEPRECATING:** (1) a regression test asserting `POST /providers` returns 404/410 or is admin-gated without session-revoke; (2) migrate + test EMR authz onto `dentalMemberships`, then a test proving EMR no longer imports the provider facade.
- **If RETAINING + building FE:** backend handler unit tests for `createProvider` (role-grant + session-revoke branch, conflict path), `createPractitioner`/`updatePractitioner` (credential validation, expiry status transitions); contract tests for credential-expiry filtering; FE component + E2E tests for the credentialing/directory screens; seed providers so the FE/E2E have data.
- **Either way:** add a unit test for the G4 RBAC decision (who can reach practitioner endpoints).

## Knowledge-graph / blast-radius findings

- Graph (`.understand-anything/`) baseline is commit `1196799b` (4 commits behind HEAD `e49e411d`); drift since is dental-scheduling/dental-patient only — **not provider** — so it answers the wiring questions reliably; **not regenerated** (poor ROI per prior measurement).
- **Contract-spine** (`.understand-anything/contract-spine.json`, regenerated today) confirms every provider operationId maps handler → SDK fn → generated TanStack hook, but **no `apps/` file imports any of those hooks** → consumer count 0 for the dental product.
- **Reverse dependency (blast radius):** only the **EMR** module imports `handlers/provider/` (`provider-emr.facade` used by `getConsultation`, `emr-audit`, `emr-coverage`, `emr.repo`). ⇒ `Practitioner`/`PractitionerRole` can be removed/deferred with **no blast radius**; the `Provider` table cannot be deleted until EMR's provider-authz is repointed at `dentalMemberships`.
- Scheduling/clinical/billing have **zero** edges into `provider` — they all edge into `dental-org` memberships.

## Dependencies on other modules

- **EMR** (consultation notes) → `Provider` via `provider-emr.facade` (authz). Must be addressed before any `Provider`-table removal.
- **dental-org** (`dentalMemberships`) is the de-facto canonical provider concept; any reconciliation converges here.
- **person** — `Provider.person_id` FK → persons (cascade); `createProvider` calls `ensurePersonForUser`.

## Existing tests found

- `getPractitioner.test.ts` (5) · `repos/practitioner.repo.test.ts` (12) · `repos/practitioner-role.repo.test.ts` (9) · `repos/provider-emr.facade.test.ts` (6) · `specs/api/tests/contract/provider.hurl` (full CRUD + auth-gate, passing in baseline).

## [NEEDS CONFIRMATION]

1. **Product decision (gates everything):** Is "practitioner credentialing / provider directory" (license/DEA expiry tracking, specialty search) a **V1/V2 dental product capability**, or is `dentalMemberships` the canonical and only provider concept? → If the former, build FE + reconcile roles/seed; if the latter, deprecate the provider module's Practitioner/Provider surface.
2. Whether any non-`admin` dental user can ever hold the `credentialing`/`clinician`/`support` Better-Auth roles (G4) — appears NO from the auth utils, but confirm against the role-bootstrap path.
3. Whether `POST /providers`' session-revoke + global-role-grant (G2) is intentional base-template behavior to keep, or a footgun to remove for the dental product.

---

## Recommended Fix Order

> **Step 0 — resolve NEEDS-CONFIRMATION #1 first.** It branches the entire plan. Default recommendation absent a product owner: **deprecate** (dental-org membership is already the canonical, wired, tested provider concept).

**Path A — Deprecate (recommended default):**
1. **(test first)** Add EMR authz test against `dentalMemberships`; migrate `provider-emr.facade` consumers to a membership-based facade (GREEN). *Removes the only blast-radius blocker.*
2. **(test first)** Pin `POST /providers` new behavior (404/410 or admin-only, no session-revoke) → implement (G2).
3. Remove unused `Practitioner`/`PractitionerRole` endpoints + repos + SDK regen; drop tables via migration once no code references them (G1).
4. Document the canonical provider concept (ADR + `MODULE_BOUNDARIES.md`); mark provider module legacy/removed (G7).

**Path B — Retain + productize (only if credentialing is a real V1/V2 need):**
1. **(test first)** Reconcile RBAC roles with the dental role model (G4) → implement.
2. **(test first)** Decide single source of truth: either link `Provider`/`Practitioner` 1:1 to `dentalMemberships` or fold credential fields into membership; implement to kill the duplicate (G1).
3. Seed providers/credentials tied to existing dentist memberships (G5).
4. **(test first, RED)** Build credentialing + directory FE (expiry dashboard, specialty/NPI search) → implement (G3) → E2E.
5. Backfill handler unit tests for create/update/deactivate (G6).
