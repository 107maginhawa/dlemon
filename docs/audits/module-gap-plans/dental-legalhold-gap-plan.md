# Module Gap Plan — `dental-legalhold`

**Audited:** 2026-06-09
**Auditor:** workflow-verification sweep (module-scoped)
**Audit decision:** **PARTIAL PASS**
**Method note:** `/webwright` live-drive was **not applicable** — this module has **zero frontend surface** (verified via code grep, SDK consumer scan, and the `/understand` knowledge graph). There is no page or form to drive in a browser. The audit is therefore code-/contract-/workflow-level. The backend was independently audited **READY** on 2026-06-08 (`docs/audits/modules/MODULE_erasure-legal-hold-retention_AUDIT_2026-06-08.md`); this plan does not re-litigate items that audit already dispositioned (cross-tenant admin scope, RBAC-403, the legal-hold-blocks-erasure invariant).

---

## 1. What this module is

`dental-legalhold` is **governance infrastructure**, not a clinical feature surface. A legal hold is a durable record that suspends data-governance actions (retention auto-archive + GDPR/RA-10173 erasure) for a subject `person` while litigation/investigation is pending. The erasure engine and retention engine **both consult** the `legal-hold.facade` (`isPersonUnderLegalHold` / `personsUnderLegalHold`): a subject with an ACTIVE hold is never anonymized and never auto-archived. Releasing the hold resumes normal schedules. Admin-only.

- TypeSpec: `specs/api/src/modules/dental-legal-hold.tsp` (3 ops → `DentalLegalHoldMgmt`)
- Handlers: `services/api-ts/src/handlers/dental-legalhold/` (place / list / release + service + facade + repo + schema)
- Table: `dental_legal_hold` (decoupled — no FK to person/patient, mirrors audit/erasure)
- Routes (codegen-registered): `POST /dental/legal-holds`, `GET /dental/legal-holds`, `POST /dental/legal-holds/{id}/release`
- SDK ops generated: `placeLegalHold`, `listLegalHolds`, `releaseLegalHold`
- Contract test: `specs/api/tests/contract/dental-legalhold.hurl` (21 req, green)

---

## 2. Expected vs Actual

| Dimension | Expected (PRD / DATA_GOVERNANCE.md §3 / MODULE_SPEC) | Actual | Status |
|-----------|------|--------|--------|
| Durable hold record | place → `active`, release → `released` (terminal) | Implemented + FSM-guarded (`already released` rejected) | ✅ |
| Blocks erasure | held subject never anonymized | `erasure-service.ts:107` consults real store → request `rejected`, `legalHoldBlocked=true` | ✅ tested ×4 axes |
| Excludes from retention | held subject's records skipped | `retention-targets.ts` flags via `personsUnderLegalHold`; engine excludes | ✅ tested |
| Audited | every transition writes `compliance` audit event | `legal_hold.placed` / `legal_hold.released` | ✅ |
| Admin-only RBAC | non-admin → 403 | handler-layer `user.role !== 'admin'` on all 3 ops | ✅ tested |
| **Operable by a human** | a compliance officer can place / view / release a hold | **No UI — only raw API.** Zero app consumers of the 3 SDK ops | ❌ **gap** |
| Contract advertises correct role | OpenAPI required-roles = `admin` | TypeSpec declares `x-security-required-roles: #["user"]` (runtime enforces `admin`) | ⚠️ **drift** |

**Bottom line:** the safety-critical compliance machinery is correct, wired, and well-tested. The module is **not operable by an end user** and its **published contract under-states the required role**.

---

## 3. Gaps

| Gap | Area | Severity | Why it matters | Recommended fix |
|-----|------|----------|----------------|-----------------|
| **No operator UI surface** — admin/DPO cannot place, list, or release a hold except by hand-crafting API calls. 3 SDK ops exist with 0 consumers. | Workflow / usability | **P1** `[NEEDS CONFIRMATION]` | A litigation hold is a legal obligation a clinic admin must act on in time. With no screen, the feature is effectively unreachable in product. NOT P0: the erasure-block invariant is enforced server-side regardless of UI. | Confirm whether an admin Legal-Holds UI is in MVP scope. If yes, build Settings → Compliance → Legal Holds (list + place + release) on the existing SDK ops. |
| **RBAC contract drift** — TypeSpec `x-security-required-roles: #["user"]` but handler enforces `admin`. Same drift across the whole governance layer (`dental-erasure.tsp` lines 101/114/129/143/159 also say `user`). | Contract / security-doc | **P2** | Runtime is stricter (safe today), but the OpenAPI/SDK advertises that any `user` may call it. A client building from the spec adds an affordance that 403s; a future middleware that trusts the spec would *under-gate*. Misleading source of truth. | Set `x-security-required-roles` to `#["admin"]` on all 3 legal-hold ops (and the 5 erasure ops) → `cd specs/api && bun run build` → regen. Add a spec-trace/contract guard asserting required-roles === enforced role. |
| **`listLegalHolds` is unbounded + un-paginated + un-enveloped**, and no test asserts that its `status` / `subjectPersonId` / `tenantId` filters actually narrow results. | API / data | **P2** | Holds accrue indefinitely (no delete path by design). An admin list with no pagination grows without bound. Filter behavior is unverified, so a filter regression would ship silently. | Add `limit`/`offset` (or document unbounded-by-design in MODULE_SPEC §10). Add HTTP tests asserting each filter narrows the result set. |
| **`branchId` is accepted on place but never consumed** — not a list filter, ignored by the facade, not round-trip tested. | Data / dead-field | **P3** | A field that saves but has no downstream effect is a latent "saved-but-not-enforced" trap and a reader-confusion source. | Either use it (branch-scoped list filter) or document it as audit-only metadata in MODULE_SPEC §7. Add a place-with-`branchId` round-trip test. |
| **Cross-tenant admin scope** — `tenantId`/`subjectPersonId` come from request body/query; `admin` is a platform superuser, so an admin can place/list holds across tenants. | Security / multi-tenancy | **P3 (tracked product decision — surface only)** `[NEEDS CONFIRMATION]` | Already dispositioned in the 2026-06-08 audit and `IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md` §342 as the deliberate DPO/data-controller model (no per-branch boundary to leak past; distinct from the EM-BIL-002 branch-omission class). | Re-affirm the decision. If the product later wants per-org compliance officers, that needs an org-scoped role + resource-anchored tenancy — a deliberate behavioral change, not a bug fix. Add a documentation test pinning the by-design cross-tenant list behavior. |

No **P0** findings. The clinically/legally critical invariant (an active hold blocks erasure) is enforced at the engine choke point and verified on four axes.

---

## 4. Broken / misleading journeys

- **There is no journey to break in the UI** — the module has no screens. The "journey" today is: an operator must call `POST /dental/legal-holds` with a hand-assembled body (including a raw `tenantId` and `subjectPersonId` UUID). That is an engineering action, not a product workflow. → drives the **P1** UI gap.
- **Misleading contract:** a developer reading the OpenAPI spec would believe a plain `user` can manage legal holds (role drift). → **P2**.

---

## 5. Unused / unwired implementation

- `placeLegalHold`, `listLegalHolds`, `releaseLegalHold` SDK functions: generated, **0 frontend consumers** (`grep` over `apps/**` = 0 non-generated hits). They ARE exercised by the Hurl contract suite and backend route tests, so they are not dead at the API layer — they are **UI-pending**.
- `branchId` column + request field: persisted, **not consumed** by any read path or the facade. Borderline dead-field (P3).
- Engine consumers are correctly wired (NOT unused): `dental-erasure/erasure-service.ts` and `retention/retention-targets.ts` both import and call the facade.

---

## 6. Test gaps

Existing (strong) coverage — do not duplicate:
- `legal-hold.test.ts` — store place/release + `isPersonUnderLegalHold` predicate + AC-LH-004 illegal FSM (release-already-released, release-nonexistent).
- `legal-hold-routes.test.ts` — real route+validator+handler wiring; place→list→release lifecycle; non-admin 403; missing-name 400.
- `legal-hold-route-registration.test.ts` — all 3 routes resolve on the real app (401 not 404).
- `erasure-legalhold.test.ts` / `retention-legalhold.test.ts` — cross-module: real-store hold blocks erasure / excludes from retention.

Missing:
| Test | Layer | Priority | Proves |
|------|-------|----------|--------|
| `listLegalHolds` filter assertions (`status`, `subjectPersonId`, `tenantId` each narrow the set) | Backend HTTP | P2 | filter regressions can't ship silently |
| RBAC spec-vs-handler role-drift guard (required-roles in OpenAPI === enforced role) | Contract / spec-trace | P2 | catches the `user` vs `admin` drift and prevents recurrence |
| `branchId` round-trip on place + (if used) branch-filtered list | Backend | P3 | the field has a real effect or is documented metadata |
| By-design cross-tenant list behavior pin (omitting `tenantId` returns cross-tenant; documents intent) | Backend | P3 | guards against an accidental tenant-leak regression in the *opposite* direction; documents the product decision |
| FE component tests (list/place/release) + E2E (place → erasure blocked → release → erasure proceeds) | Frontend / E2E | **P1 — only if admin UI is built** | the operator workflow actually works end-to-end |

---

## 7. Knowledge graph findings

From the existing `/understand` graph (`.understand-anything/domain-graph.json`, per the 2026-06-08 audit — still valid; no code change since):
- `domain:data-governance` correctly models the `LegalHold` entity, `flow:legal-hold`, and the headline businessRule *"Legal hold prevents erasure; must be released before erasure can proceed."* — the invariant is captured.
- **KG drift (stale, not a code bug):** `flow:legal-hold` `entryPoint` cites a **phantom route** `POST /dental/data-governance/legal-holds`; the real route is `POST /dental/legal-holds` (no `/data-governance/` segment).
- **KG under-modeling:** the retention→legal-hold exclusion edge has no flow node; retention enforcement is only a tag on the domain.
- **Blast radius:** consumers of the facade are exactly `dental-erasure` and `retention`. Changing the facade signature or the "active = held" predicate impacts both engines and their 5 cross-module tests. The boundary is clean (engines import only the facade, never the repo/schema — Phase-10 boundary lint enforced).

---

## 8. Recommended fix order

1. **P2 — RBAC contract drift (fast, high-trust).** Edit `dental-legal-hold.tsp` (+ `dental-erasure.tsp`) `x-security-required-roles` → `#["admin"]`; rebuild spec; regen. **Test first:** add a spec-trace/contract guard asserting OpenAPI required-roles matches the handler-enforced role (RED), then fix the tsp (GREEN). The existing non-admin-403 route tests already lock runtime behavior.
2. **P1 — Resolve UI scope `[NEEDS CONFIRMATION]`.** Decide: is an admin Legal-Holds screen in MVP? If **no**, document "API-only, operated by DPO tooling" in MODULE_SPEC and downgrade to accepted. If **yes**: **Test first** — FE component tests for list/place/release (RED), then build Settings → Compliance → Legal Holds on the 3 SDK ops (GREEN), then an E2E: place hold → attempt erasure (blocked) → release → erasure proceeds.
3. **P2 — `listLegalHolds` pagination + filter tests.** Add filter-assertion HTTP tests (RED), then add `limit`/`offset` (or document unbounded) and make filters provably narrow (GREEN).
4. **P3 — `branchId` decision.** Add a round-trip test; then either wire a branch-scoped list filter or document it as audit metadata.
5. **P3 — Re-affirm cross-tenant scope** in `IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md` §342; add the by-design cross-tenant documentation test.

Run after each: `bun run typecheck`, the governance test dirs via `scripts/test-with-db.ts`, `bun run check:boundaries`, and the `dental-legalhold.hurl` contract (restart the dev server first to avoid stale-route masking).

---

## 9. Dependencies on other modules

- **Consumed by** `dental-erasure` (erasure approval block) and `retention` (auto-archive exclusion) — via `legal-hold.facade` only. Any facade change must be validated against both engines + their 5 cross-module tests.
- **Writes to** `dental-audit` (every place/release → `compliance` audit event).
- **Operates on** the generic `person` subject (platform-level), not a `dental-*` clinical entity — by design.
- The **RBAC contract-drift fix touches `dental-erasure.tsp`** too (shared governance pattern) — coordinate the regen.

---

## 10. `[NEEDS CONFIRMATION]` items

1. **Is an admin/DPO Legal-Holds UI in MVP scope?** (decides whether the P1 UI gap is a build task or an accepted API-only posture). The MODULE_SPEC says "no patient-facing UI" — silent on an admin surface.
2. **Cross-tenant admin scope** — confirm the platform-superuser/DPO model is still the intended posture (vs. per-org compliance officers). Tracked decision in IDEAL standard §342; reaffirm, don't silently change.
3. **`branchId` intent** — audit metadata only, or should it scope reads? Currently saved-but-unused.

---

## Existing tests found (inventory)

- `services/api-ts/src/handlers/dental-legalhold/legal-hold.test.ts`
- `services/api-ts/src/handlers/dental-legalhold/legal-hold-routes.test.ts`
- `services/api-ts/src/handlers/dental-legalhold/legal-hold-route-registration.test.ts`
- `services/api-ts/src/handlers/dental-erasure/erasure-legalhold.test.ts`
- `services/api-ts/src/handlers/retention/retention-legalhold.test.ts`
- `specs/api/tests/contract/dental-legalhold.hurl`
</content>
