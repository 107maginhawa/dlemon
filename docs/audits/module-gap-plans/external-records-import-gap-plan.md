<!-- audit skill: /webwright module audit | generated: 2026-06-09 | branch: chore/workflow-verification-sweep -->

# Module Gap Plan — external-records-import (X-RI)

**Module:** `external-records-import` — external EMR/EHR data-import bridge (Open Dental / Dentrix / Eaglesoft / HL7-FHIR → read-only patient cabinet records)
**Spec:** `docs/product/modules/external-records-import/MODULE_SPEC.md` (`implementation_status: future_phase (Phase 3+)`), `API_CONTRACTS.md`, `ui-prototype/`
**Namespace (planned):** `/dental/emr-import` · **Table (planned):** `emr_record`
**Handler:** **none** (`grep` over `services/api-ts/src/handlers/` for emr-import/external/records → none; only the unrelated `emr/` = telemedicine consultation)
**TypeSpec:** **none** (no `emr-import.tsp`) · **OpenAPI:** **0** `/dental/emr-import` paths · **SDK:** none generated · **Frontend:** **none**

**Functionally-adjacent BUILT surfaces this "bridge" is scoped across (per round-15 static audit + `br-registry` `external-records-import` block):**
- **Bulk patient import** — `POST /dental/patients/import` → `dental-patient/identity/importPatients.ts` (BUILT, 17 backend tests, **zero FE consumer**). *Physically lives in `dental-patient`.*
- **External PMD import** — `POST /dental/pmd/import` → `dental-pmd/importPMD.ts` (BUILT + has FE `pmd-import.tsx` wired into `_workspace/$patientId.tsx`). *Belongs to `dental-pmd` (module #10); cross-referenced only, audited under its own module.*

---

## Audit Decision: **PARTIAL PASS**

The **named module (the `/dental/emr-import` FHIR/CDA/PDF bridge) is correctly and honestly deferred** — MODULE_SPEC §1/§20 explicitly state "Future phase (Phase 3+). No handler directory exists … Do not implement handler files until explicitly scheduled." Nothing is built, nothing is *claimed* built, and external EMR import is an accepted deferred-backlog item in the IDEAL standard (§3.14). So this is **not drift and not a defect**, and it does **not block V1**.

It is **not a full PASS** because, viewed as the head of the *import domain*, this module owns one genuinely-built surface — **bulk patient import** — that **no user can reach** (orphan endpoint, no FE), and that surface has a real **unbounded-payload (DoS-class) gap** and a **data-corrupting CSV parser**. The module's own `ui-prototype/` also carries a stale namespace, and the MODULE_MAP/tracker "partial FE" label conflates the *working PMD import UI* (a different module) with this module's absent surface. These are real reliability / usability / alignment gaps plus one blocking product decision — enough to deny PASS, not enough to FAIL.

> Not FAIL: nothing is broken, unsafe, or misleadingly claimed-as-done; the FHIR bridge is honestly absent and external EMR import is not a V1-blocking workflow.
> Not PASS: the only reachable-in-principle import surface (bulk patient) has no UI, no payload cap, and a lossy parser; the module identity is fragmented across three artifacts.

---

## Expected vs Actual

| Expected (MODULE_SPEC / API_CONTRACTS) | Actual |
|---|---|
| `POST /dental/emr-import` (multipart, FHIR/CDA/PDF, ≤10 MB), `GET /dental/emr-import/:patientId`, `GET /dental/emr-import/:id` | **None built** — no handler, TypeSpec, route, OpenAPI path, or SDK fn. |
| `emr_record` table; read-only after import; UUID patient ref (no FK) | **No table, no migration.** |
| AC-EMR-001 PATCH/DELETE → 405; AC-EMR-002 read-only; AC-EMR-003 `source_system` required → 422 | **Unenforced (nothing exists to enforce).** |
| Import gated dentist_owner \| dentist_associate; view = all dental roles | **N/A — no endpoint.** |
| FR7.2 bulk CSV/JSON demographics import | **BUILT backend** (`importPatients.ts`, owner-only, all-or-nothing tx) — but **no FE**, **no row cap**, **naive CSV**. |
| External-PMD single-record import + read-only viewer | **BUILT full-stack** under `dental-pmd` (cross-ref; audited there). |

---

## Gaps

### P1

| ID | Gap | Area | Why it matters | Recommended fix |
|----|-----|------|----------------|-----------------|
| **G1** | **Bulk patient import is an orphan endpoint — zero FE consumer.** `POST /dental/patients/import` is fully built (owner-only, all-or-nothing tx) and a `importPatients` SDK fn + `importPatientsMutation` hook are generated, but **nothing in `apps/dentalemon/src` calls them** (grep: 0 hits). FR7.2 (CSV/JSON bulk demographics import) is unreachable by any user through the UI. `[NEEDS CONFIRMATION: is staff-facing bulk patient import in V1 product scope, or a dormant primitive?]` | UI→API→data | A built, tested, owner-gated migration capability that no one can trigger from the product — the exact "backend logic with no frontend consumer" failure. Clinics onboarding from another PMS have no in-app path. | **Decide (G1-decision below).** If keep+expose: build an owner-only "Import patients (CSV/JSON)" surface (file picker → preview/validate → confirm → result summary) wired to `importPatientsMutation`, with FE + E2E tests. If dormant: mark the endpoint dormant in MODULE_MAP and stop implying FR7.2 is delivered. |
| **G2** | **No server-side row-count cap on bulk import (DoS-class).** `importPatients.ts` parses the entire CSV/JSON payload into memory, validates every row, then commits all rows in a single transaction — **no `MAX_ROWS` guard** (verified: validate loop L110, tx loop L136). FR7.2 anticipates 500+ rows; a multi-MB / multi-100k-row payload is an unbounded memory + long-transaction concern. | Reliability / availability | An oversized (or hostile) upload can exhaust memory / hold a long write transaction. Not a tenant-boundary breach (owner-gated), but a single-tenant self-DoS / stability risk. | Add a `MAX_IMPORT_ROWS` cap → reject oversized payloads with a specific `422` (e.g. `IMPORT_TOO_LARGE`). **Product decision needed** on the limit and on partial-vs-all-or-nothing semantics for oversized files. Pin with a backend test (cap+1 rows → 422, 0 written). |

### P2

| ID | Gap | Area | Why it matters | Recommended fix |
|----|-----|------|----------------|-----------------|
| **G3** | ✅ **FIXED 2026-06-09 (Batch 3).** `parseCSV` in `importPatients.ts` replaced with an RFC-4180-aware char-scanning tokenizer (`parseCsvRows`: quoted fields, escaped `""`, embedded commas/newlines). RED-before test in `dental-patient.bulk-import.test.ts` imports `"dela Cruz, Jr."` + `"O""Brien, Sr."`; before the fix the column-shift made `branchId` an invalid UUID → 500; after, both lastNames round-trip intact (201). ~~Naive CSV parser corrupts quoted/embedded-comma fields.~~ | Data integrity | (was) imported records silently corrupted. | (done) |
| **G4** | **`ui-prototype` namespace is stale / self-inconsistent.** `ui-prototype/components.md:130` posts to **`/api/dental-emr/imports`**, which matches **neither** the module's own `API_CONTRACTS.md` (`/dental/emr-import`) **nor** anything built. The prototype predates the 2026-05-29 rename. | Alignment / spec hygiene | Whoever builds Phase 3 from the prototype will wire the wrong endpoint. Two disagreeing planned namespaces in one module's docs. | Reconcile the prototype to the canonical `/dental/emr-import` (or delete the prototype until Phase 3 is scheduled). Doc-only. |
| **G5** | **Module identity is fragmented across 3 disjoint artifacts; MODULE_MAP/tracker "partial FE" misleads.** "external-records-import" = (a) unbuilt FHIR bridge + (b) bulk-import living in `dental-patient` + (c) PMD import living in `dental-pmd`. The sweep tracker tags this module **FE = partial**, but the *only* import UI (`pmd-import.tsx`) belongs to `dental-pmd` — this module's own FE is **none**. | Alignment / trust | An auditor or engineer reading "partial FE" reasonably assumes *this* module has a (partial) UI; it does not. Inflates perceived completeness. | Document the three-artifact boundary in `MODULE_MAP.md`: FHIR bridge = future-phase (no FE); bulk import = `dental-patient`-owned (no FE, see G1); PMD import = `dental-pmd`-owned (has FE). Correct the tracker FE tag to reflect *this module's* surface = none. |
| **G6** | **No FE / E2E / contract-walker tests for bulk import; non-standard response envelope un-asserted.** Bulk import has 17 backend unit tests but no FE/E2E and no contract walker. The handler returns `{ success, imported, total, patients }` — **not** the platform `{ data, meta }` envelope — so a future FE has no test guaranteeing it can consume the shape (this is exactly the drift class that bit `dental-patient` export and `dental-org` settings in this sweep). | Test completeness | If/when G1's UI is built, the envelope mismatch is a latent FE↔BE contract-drift bug with no guard. | When building G1's UI: add FE unit + an E2E import journey + a contract walker asserting the FE consumes the `{success, patients}` shape (or normalize the envelope to `{data,meta}` first and pin that). |

### P3

| ID | Gap | Area | Why it matters | Recommended fix |
|----|-----|------|----------------|-----------------|
| **G7** | **FHIR/CDA/PDF `/dental/emr-import` bridge unbuilt (Phase-3+, by design).** No handler/TypeSpec/route/UI. Honestly deferred. | Feature (deferred) | Not a defect; surfaced so the ingestion-hardening requirements aren't lost when it's scheduled. | When scheduled, build per MODULE_SPEC: UUID patient ref (no DB FK); immutable after import (`405 EMR_IMMUTABLE`, AC-EMR-001); `source_system` required (`422`, AC-EMR-003); read-only (AC-EMR-002); gate owner\|associate; and **harden the untrusted-file parse** — MIME/size validation, **XXE-safe CDA/FHIR XML parsing**, zip-bomb/path-traversal guards — all failing with specific 4xx (`IMPORT_PARSE_ERROR`/`UNSUPPORTED_SOURCE_SYSTEM`), never 500. |
| **G8** | **No patient de-duplication / matching on bulk import (by design, PRD Phase-1).** Every imported row creates a NEW person+patient; re-importing the same roster duplicates patients. | Data model (deferred) | Acceptable for Phase-1 per spec, but a real operational footgun for repeated imports. | Document the no-dedup limitation in the import UI's empty/help state (G1). Defer matching to a later phase (ties to BR-020 patient-merge, also deferred). |
| **G9** | **KG under-models the import domain.** `domain-graph.json` has an accurate `flow:import-external-pmd` node but **no** node for bulk patient import or the future FHIR bridge. | Observability / docs | Future audits can't trace the bulk-import surface via the graph. | On next KG regeneration add `flow:bulk-import-patients` (entry `POST /dental/patients/import`, owner-only, cross-tenant-gated) and, once built, `domain:external-records-import`. Query-only; do not hand-edit. |

---

## Recommended Fix Order

**Step 0 — G1 product decision (BLOCKING for the bulk-import surface; no UI code until resolved):**
- **(A) Keep + expose** staff-facing bulk patient import → proceed to Steps 1–4.
- **(B) Keep dormant** as a backend primitive → do Steps 2–3 (the safety/integrity fixes are worth doing regardless, since the endpoint is live and owner-reachable via API) + the doc fixes (G4/G5); skip the UI.
- **(C) Remove** the bulk-import endpoint → delete `importPatients.ts` + TypeSpec op + regen + drop tests; then only G4/G5/G7 remain.

> The FHIR bridge (G7) needs **no decision now** — it is correctly deferred. Schedule it separately when `dental-visit`/`dental-clinical`/`dental-pmd` are stable (MODULE_SPEC §19).

Tests to add **before/during** each fix:

1. **G2 (do first — it's a live reliability gap regardless of A/B):** RED test — payload of `MAX_IMPORT_ROWS + 1` rows → `422 IMPORT_TOO_LARGE` + 0 rows written → add the cap → GREEN. (Backend unit, `dental-patient.bulk-import.test.ts`.)
2. **G3:** RED test — import a row with a quoted embedded comma (`"dela Cruz, Jr."`) and a comma-containing address → assert the fields round-trip intact (currently FAILS) → swap in RFC-4180 parse → GREEN.
3. **(Path A) G1 + G6:** RED FE unit tests for the import surface (file select → validation preview → confirm → result summary); RED E2E journey (owner → upload CSV → preview → confirm → patients appear in list); RED contract walker asserting the FE consumes `{success, imported, total, patients}` (or normalize to `{data,meta}` first and pin that). Implement UI against `importPatientsMutation` → GREEN.
4. **Docs (G4/G5/G8):** reconcile `ui-prototype` namespace to `/dental/emr-import`; document the 3-artifact boundary + correct the FE tag in MODULE_MAP/tracker; add the no-dedup note to the import UI help state.
5. **(When scheduled) G7:** full Vertical-TDD slice for the FHIR/CDA/PDF bridge with the ingestion-hardening test matrix (XXE, oversized, unsupported source_system, 405-immutable) up front.

---

## Dependencies on Other Modules

- **dental-patient (#3, DONE in this sweep)** — physically *owns* `importPatients.ts`; any G1 UI + G2/G3 fixes land in the `dental-patient` handler/feature trees. Bulk import writes via `person-dental-patient.facade` + `patient-dental-patient.facade` (no cross-module repo boundary violation). Blast radius of G2/G3 is contained to that one handler + its test.
- **dental-pmd (#10)** — owns the *working* external-PMD import (`importPMD.ts` + `pmd-import.tsx`). Cross-referenced for the immutability/checksum/provenance invariants (AC-EMR-001 analog); audited under its own module. **Do not conflate with this module.**
- **dental-org** — `assertBranchRole(db, user.id, branchId, ['dentist_owner'])` is the cross-tenant/role boundary for bulk import (verified present, L127–129). Any G1 UI must source `branchId` from org-context (same pattern that fixed the `dental-patient` export 400 in this sweep).
- **emr-consultation (`/emr`)** — **distinct** module (telemedicine notes); shares only the historical "emr" name. Different namespace, do not merge.
- **storage (S3/MinIO)** — the future FHIR bridge (G7) will depend on storage for the ≤10 MB file + presigned `file_url`; currently down in this env, irrelevant until Phase 3.

---

## Knowledge Graph Findings (existing `/understand` + contract-spine; not regenerated — per repo ROI policy)

- **`/dental/emr-import`:** absent from every layer — `grep` over generated routes = 0, OpenAPI `emr-import` count = **0**, no SDK fn. Confirms the bridge is unbuilt at the wiring level (no orphan handler, no phantom route — clean absence).
- **Bulk import orphan:** `importPatients` handler → `routes.ts` (`POST /dental/patients/import`, `authMiddleware({roles:['user']})`) → generated SDK fn `importPatients` + `importPatientsMutation` hook — but **frontendConsumers = NONE** (grep across `apps/dentalemon/src` = 0). Fully-generated, fully-tested, **zero-consumer** orphan (G1). Same wiring shape as the `emr-consultation` orphan.
- **PMD import (cross-ref):** `flow:import-external-pmd` (entry `POST /dental/pmd/import`) is present and **accurate**; `pmd-import.tsx` is wired into `_workspace/$patientId.tsx` (`onImportClick` → `PMDImport`) — a *working* journey, but it belongs to `dental-pmd`.
- **KG under-model (G9):** no `flow:bulk-import-patients`, no `domain:external-records-import`.

## Existing Tests Found

- `services/api-ts/src/handlers/dental-patient/dental-patient.bulk-import.test.ts` — **17 backend unit tests** (round-15 hardened): JSON-array / `{patients}` / CSV happy paths; malformed JSON → 400; non-array → 400; empty → 400/422; missing firstName/branchId → 422 per-row; tx-failure → 422; **cross-tenant** (foreign branch → 403 + 0 rows; multi-branch all-or-nothing → 0 rows); **role-gating** (same-branch associate → 403); ingestion safety (50k-char field → <500; short CSV → 422). All pass.
- `services/api-ts/src/handlers/dental-pmd/imported-pmd-immutable.test.ts` + `dental-pmd-events.test.ts` — PMD-side immutability (405) / checksum (422) / provenance / `pmd.import` audit (cross-ref; `dental-pmd` owns these).
- `apps/dentalemon/src/features/pmd/components/pmd-import.test.ts` — PMD import FE flow (belongs to `dental-pmd`).
- `specs/api/docs/standards/br-registry.json` — `external-records-import` block (V-XRI-001 cross-tenant/owner-only, V-XRI-002 ingestion safety + no-row-cap note, V-XRI-003 FHIR bridge deferred, V-XRI-004 PMD cross-ref).

## Missing Tests (to add per fix path)

- **Backend reliability (G2):** row-count cap → 422 + 0 written *(none — the no-cap gap is currently unpinned)*.
- **Backend data-integrity (G3):** RFC-4180 quoted/embedded-comma round-trip *(none — naive parser unpinned)*.
- **Frontend unit (G1, Path A):** import surface (file select → preview/validate → confirm → result) *(none — no FE exists)*.
- **E2E (G1, Path A):** owner uploads CSV → preview → confirm → patients appear in list *(none)*.
- **Contract walker (G6, Path A):** FE consumes the `{success, imported, total, patients}` envelope (or `{data,meta}` if normalized) *(none — non-standard envelope un-asserted)*.
- **Backend ingestion-hardening (G7, when scheduled):** XXE-safe XML, oversized-file 422, unsupported `source_system` 422, PATCH/DELETE 405 *(none — bridge unbuilt)*.

## [NEEDS CONFIRMATION] Items

1. **G1** — Is staff-facing **bulk patient import (FR7.2)** in V1 product scope (build a UI), or an intentionally-dormant backend primitive? Determines build-UI vs label-dormant vs remove.
2. **G2** — What is the intended **max bulk-import row count**, and on an oversized file should the import **reject wholesale (422)** or **partially commit**? Needed to set the cap.
3. **G7** — Confirm the FHIR/CDA/PDF bridge remains **Phase-3+ deferred** (MODULE_SPEC says yes); nothing to build now.
4. **G5** — Confirm the canonical owner of the *user-facing* import experience: should bulk-patient-import live in the `dental-patient` cabinet UI, and external-record (PMD/FHIR) import in the patient cabinet's "external records" area? Determines where the G1 UI lands.

---

## Audit method note (live-drive transparency)

This audit was performed primarily from **code + spec evidence**, not a live `/webwright` browser drive, because **the named module has no frontend surface to drive** (no route, no component, no SDK consumer — verified by exhaustive grep across `apps/dentalemon/src`, generated routes, and OpenAPI). The one question a live drive could answer — *"is there a misleading external-records-import affordance in the UI?"* — is answered **No** by code: the only "Import" control in the patient cabinet (`_workspace/$patientId.tsx` → `onImportClick` → `PMDImport`) is the working **PMD** import (a different module), and the strings `emr-import`/`importPatients` appear nowhere in the FE. Booting the full stack (MinIO/Mailpit are down this env per the sweep baseline) to confirm a code-proven absence was judged poor ROI and skipped deliberately.
