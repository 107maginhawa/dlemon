<!-- audit skill: /webwright module audit | generated: 2026-06-09 | branch: chore/workflow-verification-sweep -->

# Module Gap Plan — emr-consultation (P-EMR)

**Module:** `emr-consultation` (telemedicine consultation notes; platform-level, namespace `/emr`, table `consultation_note`)
**Handler:** `services/api-ts/src/handlers/emr/` (6 handlers)
**TypeSpec:** `specs/api/src/modules/emr.tsp` (`EMRModule`)
**SDK:** `packages/sdk-ts/src/generated/*` (6 client fns + TanStack hooks generated)
**Frontend:** none

## Audit Decision: **PARTIAL PASS**

The **backend is production-grade and clinically sound** (RBAC, FSM, audit, facade-isolation enforced and tested; 107 tests pass). The module **fails the "usable" and "aligned with product" dimensions**: it has **zero frontend surface**, so all six documented workflows (WF-EMRC-001..006) are unreachable by any user, and its clinical role overlaps the already-shipped `dental-visit`/`dental-clinical` encounter context. Whether that is a defect or an intentionally-dormant upstream primitive is a **product decision that must be made before any code is touched** (see Gap G1).

> Not FAIL: nothing is broken or unsafe in what exists. Not PASS: a module with no way to use it cannot be called complete, and the docs label it `implementation_status: implemented` with live workflows, which overstates reality.

---

## Gaps

### P1

| ID | Gap | Area | Why it matters | Recommended fix |
|----|-----|------|----------------|-----------------|
| **G1** | **Entire frontend is absent.** No route (`apps/dentalemon/src/routes`), no nav entry, no component consumes any of the 6 generated SDK hooks. WF-EMRC-001..006 (create / update / finalize / read / list / list-patients) are unreachable by provider, patient, or admin. `[NEEDS CONFIRMATION: is telemedicine consultation in dentalemon's product scope at all?]` | UI→API→data | A backend that no user can reach is not a usable module; docs claim it is `implemented` with active workflows. This is the dominant gap. | **Decide first (G1-decision below).** If keep+expose: build the provider consultation surface (list → note editor → finalize) + patient read view, wired to the SDK hooks. If dormant: re-label spec/MODULE_MAP `implementation_status: backend-only (dormant platform primitive)` and remove the "active workflow" framing. If remove: delete handlers + TypeSpec + regen + drop migration. |
| **G2** | **Product redundancy / dual source of clinical-note truth.** `consultation_note` (chief complaint / assessment / plan / vitals / finalize) duplicates the encounter/clinical-note capability already shipped full-stack in `dental-visit` + `dental-clinical` (Standard §3.4 = IMPLEMENTED there). Two finalize-able clinical records for the same patient with no linkage. | Alignment / data model | If both are ever exposed, clinicians get two competing "official" note systems → split history, audit ambiguity, training confusion. | Product decision: designate `dental-visit` as the canonical dental encounter and scope `emr-consultation` to a distinct telemedicine/minor-ailment use case (or retire it). Document the boundary in MODULE_MAP. |
| **G3** | **Admin sees ALL consultation notes with no tenant/clinic scoping.** Isolation is by `provider == caller` / `patient == caller`; the `admin` branch applies no provider filter and `tenant_id` is explicitly *not* the isolation mechanism (V-EMR-005). In dentalemon's multi-clinic model a platform `admin` would read every clinic's consultation PHI. `[NEEDS CONFIRMATION: does dentalemon have a global admin, or only clinic-scoped admins? Is /emr ever exposed?]` | RBAC / cross-tenant PHI | Upstream `monobase-mycure` single-tenant assumption collides with multi-clinic dentalemon → potential cross-clinic PHI exposure the moment this module is exposed. | If exposed: scope `admin` reads to the caller's clinic/org (add org filter to `listConsultations`/`listEMRPatients`/`getConsultation` admin paths) + add a cross-tenant-isolation test. If dormant: record the constraint so it's fixed before any exposure. |

### P2

| ID | Gap | Area | Why it matters | Recommended fix |
|----|-----|------|----------------|-----------------|
| **G4** | **`getConsultation` adversarial RBAC not directly tested.** The single-record PHI read is the tightest boundary, but the 403 test uses a person with no provider profile (different code path); an explicit *cross-provider read* and *patient-reads-another-patient's-note* are not asserted. | Test completeness / PHI | The one endpoint that returns a full PHI note lacks adversarial coverage for the exact attack (authenticated provider/patient fetching a note they don't own by id). | Add two `getConsultation` tests: (a) provider B GETs provider A's note → 403; (b) patient B GETs patient A's note by id → 403. |
| **G5** | **Carrying cost of unreachable code.** 107 tests + SDK hooks + `emr-audit` infra + a migration are maintained for code no user can reach; docs imply it is usable. | Maintainability / trust | Dead-but-tested surface area inflates maintenance and misleads the next engineer/auditor into thinking it ships. | Tied to G1: either give it a UI (cost justified) or mark dormant/remove (stop paying). |

### P3

| ID | Gap | Area | Why it matters | Recommended fix |
|----|-----|------|----------------|-----------------|
| **G6** | **Duplicate-`context` create uses a soft assertion** (`status >= 400`) instead of asserting exact `409` / `CONSULTATION_EXISTS`. | Test precision | A regression that changed the conflict code (e.g. to 400/500) would pass silently. | Tighten the assertion to exact 409 + error code. |
| **G7** | **`amended` status is a reserved/unreachable enum value** with no producer (V-EMR-001, documented). | Data model clarity | Dead enum invites future confusion / accidental use. | Acceptable as-is (documented); if amend-after-finalize is ever built, do it via a dedicated `POST /emr/consultations/{id}/amend` + lineage column, not by reviving the enum silently. |

---

## Recommended Fix Order

**Step 0 — G1 product decision (BLOCKING, no code until resolved).** Choose one:
- **(A) Keep + expose** telemedicine consultation as a real dentalemon feature → proceed to Step 1.
- **(B) Keep dormant** as a platform primitive → do Step 2 (docs) + Step 3 (G3 constraint note) only; defer UI.
- **(C) Remove** → delete handlers + `emr.tsp` + regen SDK/routes + drop migration; close out.

Tests to add **before/during** each path:

1. **(Path A only) Build frontend.** Tests first (RED): frontend unit tests for the consultation list, the draft note editor (create→update→finalize state machine in the UI), and the patient read view; then an E2E journey `provider logs in → creates draft → fills SOAP fields → finalizes → list shows finalized`. Implement UI against existing SDK hooks (GREEN). Add a contract walker confirming the FE shapes match the un-wrapped single-resource envelope (note: `/emr` returns the object un-wrapped, lists return `{data,pagination}` — differs from dental `{data,meta}`).
2. **(All paths) Fix G3 cross-tenant scoping** *if* Path A/B. Add a **cross-tenant isolation test** (admin in clinic A must NOT see clinic B's notes) RED → add org/clinic scoping to admin branches of `listConsultations`, `listEMRPatients`, `getConsultation` → GREEN.
3. **(All paths) Close G4** adversarial `getConsultation` RBAC tests (cross-provider read 403, patient cross-read 403) — RED → confirm existing guards already pass (they should) → keep as regression pins.
4. **G6** tighten duplicate-context assertion to exact 409.
5. **Docs (G2/G5/G7):** update `MODULE_MAP.md` + `MODULE_SPEC.md` to state the canonical-encounter boundary vs `dental-visit`, the true `implementation_status` (per chosen path), and keep the `amended` reservation note.

---

## Dependencies on Other Modules

- **patient / provider / person** — consumed **facade-only** (`patient-emr.facade`, `provider-emr.facade`, `*WithPerson` variants); no DB FKs, no direct repo imports (verified). Blast radius of changes here is contained to `handlers/emr/` + the two facades.
- **audit** — writes `dental_audit_log` rows via `logAuditEvent` with `emr.<resource>.<verb>` actions and an `EMR_AUDIT_TENANT_SENTINEL` (platform convention, not dental verb drift — documented V-EMR-006).
- **dental-visit / dental-clinical** — *conceptual* overlap (G2), not a code dependency. Any product decision must be made jointly with these (they own the canonical dental encounter).
- **external-records-import (M9)** — distinct module, different namespace (`/dental/emr-import`), future phase; do **not** conflate.

## Knowledge Graph Findings (existing `/understand` + contract-spine)

- `contract-spine.json`: all 6 operations map handler → SDK client fn → generated TanStack hooks, but **`frontendConsumers: NONE` for all six** — confirms the orphan at the wiring level (backend complete, SDK generated, zero FE binding).
- Graph not regenerated (per repo policy / prior ROI decision); drift is type-edge only and does not affect these wiring conclusions. The contract-spine (dated 2026-06-09) is current for this module.
- Route registration confirmed live in `services/api-ts/src/generated/openapi/routes.ts:2309-2345` (all 6 endpoints mounted).

## Existing Tests Found (all passing — 107/0)

- `emr-coverage.test.ts` — functional + adversarial: cross-provider list isolation, patient scope-widening 403, FSM finalize/update guards.
- `emr-audit.test.ts` — durable audit rows, sentinel tenant (V-EMR-005), field-names-only update (V-EMR-003), counts-only bulk reads (V-EMR-004).
- `consultation-note.fsm.property.test.ts` — property-based FSM: only `draft→finalized` valid; `finalized`/`amended` terminal.
- `getConsultation.expand.test.ts` — expand=patient/provider/person nesting.
- `emr.handlers.test.ts` — handler export/async/error-status sanity.
- `repos/emr.repo.test.ts` — draft create, duplicate-context block, finalize, findByPatient, stats.

## Missing Tests (to add per fix path)

- **Frontend unit** (Path A): consultation list, note editor draft→finalize state, patient read view. *(none exist — no FE)*
- **E2E** (Path A): provider create→fill→finalize→list journey. *(none exist)*
- **Integration / contract** (Path A): FE↔BE contract walker for the un-wrapped envelope + `{data,pagination}` list shape.
- **Backend security**: cross-tenant admin isolation (G3); adversarial `getConsultation` cross-provider + patient cross-read (G4).
- **Backend precision**: exact-409 duplicate-context assertion (G6).

## [NEEDS CONFIRMATION] Items

1. **G1** — Is telemedicine consultation in dentalemon's product scope, or is `emr-consultation` an intentionally-dormant upstream platform primitive? Determines keep-and-build vs label-dormant vs remove.
2. **G3** — Does dentalemon have a global platform `admin` role, or only clinic-scoped admins? Determines whether the unscoped admin read is an active cross-clinic PHI leak or a latent one.
3. **G2** — Intended boundary between `consultation_note` (this module) and the `dental-visit`/`dental-clinical` encounter record — same patient, two finalize-able note systems.
