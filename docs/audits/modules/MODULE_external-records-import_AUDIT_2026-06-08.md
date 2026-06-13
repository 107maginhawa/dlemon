# Module Audit — external-records-import (data-import bridge: bulk patient import + external-PMD ingestion + future FHIR/CDA bridge)

**Date:** 2026-06-08
**Branch:** feat/module-workflow-alignment
**Auditor:** per-module deep audit + safe-gap closure (adversarial; verified against source)
**Round:** 15 of 15 — **FINAL** (series rollup appended to `docs/audits/MODULE_AUDIT_TRACKER.md`)
**Verdict:** ✅ **READY** — `external-records-import` is **NOT a single handler dir**; it is the **data-import bridge resolved across three artifacts**: (1) a **FUTURE-PHASE** FHIR/CDA/PDF EMR-import bridge specced at `docs/product/modules/external-records-import/` (namespace `/dental/emr-import`, table `emr_record`) that is **NOT BUILT** (MODULE_SPEC §1/§20 explicitly: "Future phase (Phase 3+). No handler directory exists"); (2) the **BUILT single external-PMD ingestion** `dental-pmd/importPMD.ts` (`POST /dental/pmd/import`) — **round 8** already covered its immutability/checksum/provenance/identity-binding/audit (cross-referenced, not re-audited); and (3) the **BUILT bulk patient-demographics ingestion** `dental-patient/identity/importPatients.ts` (`POST /dental/patients/import`, FR7.2 — CSV/JSON, demographics ONLY per the PRD Phase-1 limitation). **Relationship to dental-pmd:** importPMD is the *single-record* import side already audited in round 8; this round audits the **DISTINCT** un-covered surface — the **FR7.2 bulk patient import** — and surfaces the unbuilt FHIR bridge. The headline sweeps on the bulk-import surface: **cross-tenant isolation = CLEAR (guard present, now pinned)** — `importPatients` calls `assertBranchRole(user, row.branchId, ['dentist_owner'])` for EVERY unique `branchId` **before** the all-or-nothing transaction, so an import naming another org's branch → **403 + zero rows written** (the V-PAT-002 lens applied to ingestion: an import into org A cannot attach a patient into org B's branch); **role-gating = CLEAR (now pinned)** — bulk import is **dentist_owner-only**; a same-branch `dentist_associate` → 403; **ingestion safety = CLEAR (now pinned)** — untrusted CSV/JSON fails closed with a **specific 4xx, never a 500** (malformed JSON → 400, non-array → 400, empty → 400/422, missing firstName/branchId → 422 per-row, tx failure → 422; oversized field values tolerated; short CSV rows → 422); **identity-binding = N/A by construction** — bulk import creates **NEW** person+patient rows (no patient-match/dedup), so there is **no mis-attribution-to-existing-patient surface** (unlike importPMD, which binds to an existing `patientId` and IS audited in round 8); **immutability = N/A for bulk import** (it creates ordinary *editable* patient records — immutability is the PMD-side invariant, round 8). **No security hole found — every guard already existed; this round only PINNED them** (the prior tests were all happy-path, matching-branch owner). Closed **2 safe gaps**: 7 adversarial tests (cross-tenant ×2, role-gating ×1, ingestion-safety ×4) + 1 registry drift (whole module ABSENT from br-registry → added a 4-rule `external-records-import` block). Surfaced (NOT built): the **unbuilt FHIR/CDA/PDF `/dental/emr-import` bridge** (Phase-3+ by design), a **missing server-side row-COUNT cap** on bulk import (DoS-class, needs a product decision on the limit), and a **KG-backlog** note (bulk patient-import + the future FHIR bridge are unmodeled; the PMD-import flow node IS accurate). Gates green.

---

## STEP 0 — Artifacts & /module-review

`external-records-import` does **not** resolve to a dedicated handler dir (`grep` for `external-records-import`/`records-import`/`external-records`/`import` over `services/api-ts/src/handlers/` returns NONE). It is a **cross-cutting bridge** distributed across the artifacts below.

| Artifact | Location | Status |
|----------|----------|--------|
| **Future FHIR/CDA bridge spec** | `docs/product/modules/external-records-import/MODULE_SPEC.md` + `API_CONTRACTS.md` + `ui-prototype/` | ✅ present but **FUTURE-PHASE** — §1/§20 declare "Phase 3+, No handler directory exists". Namespace `/dental/emr-import`, table `emr_record`, sources `hl7_fhir`/`cda`/`pdf`/`csv`, multipart max 10 MB. **NO handler / NO TypeSpec module / NO routes.** |
| **Built bulk patient import (FR7.2)** | `services/api-ts/src/handlers/dental-patient/identity/importPatients.ts` (~175 LOC) | ✅ `POST /dental/patients/import` — CSV/JSON demographics, up-front validation, all-or-nothing tx, per-branch `assertBranchRole(dentist_owner)`. **This is the distinct, un-audited live surface.** |
| **Built single external-PMD import** | `services/api-ts/src/handlers/dental-pmd/importPMD.ts` | ✅ `POST /dental/pmd/import` — **round 8** (immutability 405 / checksum 422 / provenance / identity-binding to existing patient / `pmd.import` audit row). **Cross-referenced, not re-audited.** |
| TypeSpec | `specs/api/src/modules/dental-patient.tsp:464-473` (`importPatients`, op declared) | ✅ `@operationId("importPatients")`, `@route("/import")`, `x-security-required-roles #["user"]`, `@useAuth(BearerAuth)`. No `emr-import` TypeSpec module (unbuilt). |
| Routes | `generated/openapi/routes.ts:1323-1328` — `app.post('/dental/patients/import', authMiddleware({roles:["user"]}), zValidator('json', ImportPatientsBody), registry.importPatients)` | ✅ codegen-registered. |
| Schema/migrations | bulk import writes via `createPersonForDentalPatient` + `insertPatientForImport` facades into `person`/`patient` (existing tables) — **no new schema, no migration risk** | ✅ |
| Tests | `dental-patient/dental-patient.bulk-import.test.ts` (now **17**), cross-ref `dental-pmd/imported-pmd-immutable.test.ts` + `dental-pmd-events.test.ts` (round 8) | ✅ **17 pass / 0 fail** |
| Contract | `dental-patient.hurl` (covers patient surface incl. import-adjacent) + `dental-pmd.hurl` (PMD import) | ✅ unaffected this round (test+registry only) |
| br-registry | `specs/api/docs/standards/br-registry.json` — **NO `external-records-import` block** (14 module blocks, none for import) | ⚠️ registry drift (closed — STEP 7) |
| KG | `.understand-anything/domain-graph.json` — `flow:import-external-pmd` (entry `POST /dental/pmd/import`, **accurate**); bulk patient-import + FHIR bridge **unmodeled** | ⚠️ KG-backlog (see STEP 3) |

**/module-review result:** **PASS (live surface).** The `importPatients` TypeSpec `@operationId` ↔ exported handler name match and is codegen-registered. No `test.skip`/`.only`/`xit`; no `Not implemented`/TODO/FIXME/HACK in `importPatients.ts` or `importPMD.ts`; no non-test `as any`. Validation fails closed (specific 4xx). The unbuilt FHIR bridge is correctly NOT registered (no orphan handler — unlike provider round 14).

---

## STEP 1–2 — Spec universe & conformance (import-specific)

**Resolution of the relationship to dental-pmd (round 8).** Three import paths exist; only the bulk-patient path is newly in scope:

| Import path | Binds to | Immutable original? | Identity-match | Audit row | Audited in |
|-------------|----------|---------------------|----------------|-----------|------------|
| **importPMD** (single external PMD) | EXISTING `patientId` (body) | ✅ 405 IMPORTED_PMD_IMMUTABLE | server-validated branch via `patient.preferredBranchId` | ✅ `pmd.import` | **round 8** (cross-ref) |
| **importPatients** (bulk demographics) | creates NEW person+patient | N/A (editable records) | **N/A — no match/dedup; every row is fresh** | (no per-import audit row; ordinary patient create) | **THIS ROUND** |
| **/dental/emr-import** (FHIR/CDA/PDF) | EXISTING patient by UUID (planned) | ✅ planned (AC-EMR-001 405) | planned | planned | **UNBUILT** (surfaced) |

**Enumerated items (bulk-import surface):**

| Invariant | Spec | Impl | Conformance |
|-----------|------|------|-------------|
| **WF / FR7.2 — bulk CSV/JSON demographics import** | PRD FR7.2 (CSV/JSON, validation per-row, batch-commit w/ rollback, demographics only) | `importPatients.ts` — CSV + JSON-array + `{patients:[…]}`, up-front `validateRow`, all-or-nothing `db.transaction` | ✅ |
| **Cross-tenant — import only into a branch the caller owns** | API_CONTRACTS / ROLE_PERMISSION (bulk import = dentist_owner) | `assertBranchRole(user, branchId, ['dentist_owner'])` per unique branchId, **before** tx; foreign branch → 403, zero rows | ✅ (now pinned) |
| **Role-gating — owner-only** | dentist_owner only | same `assertBranchRole` owner gate; route `authMiddleware({roles:['user']})` floor | ✅ (now pinned) |
| **Ingestion safety — untrusted input → specific 4xx, never 500** | implied (untrusted external file) | malformed JSON → 400; non-array → 400; empty → 400/422; missing required → 422 per-row; tx fail → 422; oversized field tolerated | ✅ (now pinned) |
| **Identity-binding — no mis-attribution** | demographics-only, no clinical merge (PRD Phase-1 limit) | creates NEW person+patient per row — **no match to existing patient**, so no confusion surface | ✅ N/A-by-construction |
| **FHIR/CDA EMR-import bridge** | MODULE_SPEC `/dental/emr-import`, `emr_record` | **NOT BUILT** (Phase-3+) | ⚪ absent-by-design (surfaced) |

**Drift both ways:** (a) the FR7.2 bulk import is fully built and conformant; (b) the FHIR `/dental/emr-import` bridge is declared in a product MODULE_SPEC but is explicitly Phase-3+ (no handler/TypeSpec/route) — **honest deferred**, not silent drift. No built op is undeclared (no orphan handler).

---

## STEP 3 — KG mapping (query-only)

`.understand-anything/domain-graph.json` contains `flow:import-external-pmd` (`domainMeta.entryPoint = POST /dental/pmd/import`) — **ACCURATE** (matches `routes.ts:1798`; the PMD-import flow is correctly modeled, unlike the provider/PMD KG over-claims of prior rounds). The parent `domain:clinical-documents-pmd` is also present.

**KG-projection drift: UNDER-MODEL only (KG-backlog).** Two import surfaces are **unmodeled**: (1) the FR7.2 **bulk patient import** (`POST /dental/patients/import`) has no KG node; (2) the future **FHIR/CDA `/dental/emr-import` bridge** is unmodeled (expected — unbuilt). Flag for next regeneration: add a `flow:bulk-import-patients` node (entry `POST /dental/patients/import`, owner-only, cross-tenant-gated) and, once built, a `domain:external-records-import` for the FHIR bridge. **Query-only — not hand-edited.** No over-claim this round (the one present import node is correct).

---

## STEP 4/5 — Tests (ADVERSARIAL) + AUTH model

**Auth model (bulk import):** route floor `authMiddleware({roles:['user']})` (any authenticated dental user) + **handler-level `assertBranchRole(user, branchId, ['dentist_owner'])` per unique branchId** = the real boundary. The route role is intentionally broad (`user`); the handler narrows it to owner-of-the-named-branch — so the security check lives in the handler and was previously **unpinned** (all tests used a matching-branch owner).

| Import MUST-VERIFY axis | Test | Strength |
|-------------------------|------|----------|
| **(a) cross-tenant — import can't attach to another org's patient/branch** | **NEW:** import naming `OTHER_BRANCH_ID` (caller has NO membership) → **403** + `count(patient WHERE preferred_branch_id=OTHER_BRANCH)==0`; AND a multi-branch batch mixing own+foreign → **403** + NEITHER own nor foreign rows committed (guard runs before the all-or-nothing tx). | VERIFIED (2-org fixture; zero-rows-written pinned) |
| **(b) immutability — imported original can't be edited** | N/A for bulk import (it creates ordinary *editable* patients). The immutability invariant is the PMD-side `imported-pmd-immutable.test.ts` (PATCH/PUT/DELETE → 405 IMPORTED_PMD_IMMUTABLE), **round 8** — cross-referenced. | VERIFIED (round 8) / N/A (bulk) |
| **(c) identity-binding — patient-match server-validated, no forged ref** | N/A for bulk import — it creates NEW person+patient per row (no match/dedup), so a forged patient ref is impossible (none is accepted). The PMD-side binds to an existing `patientId` and validates branch via `patient.preferredBranchId` (round 8). | VERIFIED (round 8) / N/A (bulk) |
| **(d) ingestion safety — malformed/oversized → specific 4xx not 500** | **NEW:** malformed JSON → **400**; empty array → **400**; 50k-char field value → **<500** (201/422, never crash); short CSV row (missing branchId) → **422**. (Existing: missing firstName/branchId → 422; non-array → 400.) | VERIFIED (4 new + 5 existing) |
| **(e) role-gating — only authorized staff can import → 403 wrong-role** | **NEW:** a same-branch `dentist_associate` (active member, non-owner) → **403** + zero rows. (Existing: 401 without auth.) | VERIFIED |
| **(f) audit-logging on import** | Bulk patient import does NOT write a per-import `dental_audit_log` row — each row is an ordinary patient create (the create itself is audited at-source per round 10's `logAuditEvent` mechanism; there is no distinct "bulk-import" action). The PMD-side `pmd.import` row IS written + tested (round 8). | N/A (bulk = ordinary creates) / VERIFIED (PMD round 8) |

**Round-9 optional-branchId / cross-resource-aggregate lens:** bulk import is a WRITE keyed on a REQUIRED per-row `branchId` that must be owner-authorized — there is no optional-filter-omitted variant (omitting branchId → 422, never "all tenants"). The caller-supplied-branchId variant (V-PAT-002) is **the exact axis pinned here** and it is CLEAR: the branchId is not just access-checked, the write only proceeds for branches the caller is a `dentist_owner` of. **CLEAR.**

---

## STEP 6 — Traceability Matrix

| Item | Spec? | Impl? | KG | Test (file:line) | Strength | Verdict |
|------|-------|-------|----|------------------|----------|---------|
| **V-XRI-001** Bulk import cross-tenant isolated (owner-of-named-branch only; 403 + zero rows) | ✅ FR7.2/API_CONTRACTS | ✅ importPatients.ts:123-129 | ⚠️ unmodeled | bulk-import.test.ts (foreign branch → 403 + 0 rows; multi-branch → all-or-nothing 0 rows) | VERIFIED | 🟢 |
| **V-XRI-001b** Role-gating — dentist_owner only (associate → 403) | ✅ | ✅ importPatients.ts:128 | ⚠️ unmodeled | bulk-import.test.ts (dentist_associate → 403 + 0 rows) | VERIFIED | 🟢 |
| **V-XRI-002** Ingestion safety — untrusted input → specific 4xx, never 500 | ✅ implied | ✅ importPatients.ts:78-121,164-172 | NONE | bulk-import.test.ts (malformed JSON 400; empty 400; 50k field <500; short CSV 422) | VERIFIED | 🟢 |
| **FR7.2 happy path** — CSV + JSON-array + `{patients:[…]}` import, batch-commit | ✅ | ✅ importPatients.ts | ⚠️ unmodeled | bulk-import.test.ts (JSON 201 ×2; CSV 201; rollback) | VERIFIED | 🟢 |
| **V-XRI-004** Imported-PMD immutability/checksum/provenance/identity/audit (single import) | ✅ | ✅ importPMD.ts | ✅ flow:import-external-pmd (accurate) | imported-pmd-immutable.test.ts + dental-pmd-events.test.ts (round 8) | VERIFIED | 🟢 (round 8) |
| **V-XRI-003** FHIR/CDA/PDF `/dental/emr-import` bridge | ⚠️ MODULE_SPEC (Phase-3+) | ❌ NOT BUILT (no handler/tsp/route) | ⚠️ unmodeled | — | NONE | ⚪ surfaced (absent-by-design) |

**Counts (LIVE / declared items): 5 GREEN / 0 PARTIAL / 0 RED.** Plus 1 ⚪ surfaced-absent row (FHIR bridge) + 1 KG-backlog (bulk import + bridge unmodeled).

**Verdict: READY** — every BUILT import surface is GREEN and now adversarially pinned (cross-tenant, role-gating, ingestion-safety on bulk; immutability/checksum/provenance on PMD via round 8). The only gaps are an honestly-deferred future FHIR bridge, a surfaced row-count-cap product decision, and a KG under-model (backlog).

---

## STEP 7 — Gaps Closed This Round

### Safe gap reinforcement (TDD, GREEN)

| # | Gap | Class | Fix |
|---|-----|-------|-----|
| 1 | **The bulk-import security guards were UNPINNED.** `importPatients` enforced cross-tenant isolation (`assertBranchRole` owner-only, per branchId, before the tx) and ingestion safety (specific 4xx on malformed input), but EVERY existing test used `TEST_USER` (a matching-branch `dentist_owner`) — so NO test proved (a) an import naming a foreign branch is 403'd with zero rows written, (b) a same-branch non-owner is 403'd, or (c) malformed/oversized untrusted input fails closed with a 4xx rather than a 500. (The impl was correct; only the adversarial tests were missing — the round-8/round-9 carry-forward lens applied to a never-tested ingestion path.) | REAL test gap (cross-tenant + role-gating + ingestion-safety) | Added a 2-org/2-role fixture (`OTHER_ORG`/`OTHER_BRANCH` the caller doesn't belong to; an `ASSOCIATE_USER` non-owner of the own branch) + **7 tests**: foreign-branch import → 403 + 0 rows; multi-branch batch (own+foreign) → 403 + all-or-nothing 0 rows; same-branch associate → 403 + 0 rows; malformed JSON → 400; empty array → 400; 50k-char field → <500; short CSV row → 422. 10 → **17** tests, GREEN. |

### Doc / registry drift reconciled (docs commit)

| # | Drift | Fix |
|---|-------|-----|
| 2 | **WHOLE import bridge ABSENT from `br-registry.json`** (14 module blocks — dental-visit … provider — none for the import surface). The recurring class confirmed at perio round 6 / audit round 10 / governance round 11 / portal round 12 / emr round 13 / provider round 14 — a cross-cutting bridge that doesn't map 1:1 to a `dental-<x>` dir is the MOST likely to be registry-absent. | Added an `external-records-import` block with 4 rules: **V-XRI-001** (bulk import cross-tenant isolated, owner-only, all-or-nothing — security), **V-XRI-002** (ingestion safety: specific 4xx not 500 + the surfaced no-row-cap limitation — validation), **V-XRI-003** (FHIR/CDA bridge Phase-3+, aspirational invariants — documentation/deferred), **V-XRI-004** (cross-ref to the dental-pmd imported-PMD immutability/checksum/provenance/audit invariants — security). The block description resolves the three-artifact structure and the relationship to dental-pmd. JSON re-validated. |

---

## Ranked Remaining Gaps (surfaced, NOT closed — out of safe scope)

**ABSENT / deferred features (surface, do NOT build):**
1. **FHIR/CDA/PDF `/dental/emr-import` bridge is UNBUILT (Phase-3+).** The product MODULE_SPEC defines the boundary (namespace, `emr_record` table, multipart 10 MB, sources hl7_fhir/cda/pdf, AC-EMR-001..003) but there is NO handler/TypeSpec/route. When built it MUST: bind to patient by UUID with no DB FK (loose coupling); be immutable after import (405 EMR_IMMUTABLE, the ImportedPMD pattern); require `source_system` (422 if absent); gate import to dentist_owner|dentist_associate; and **harden the untrusted-file parse** — file-type/MIME + size validation, **XXE-safe CDA/FHIR XML parsing**, zip-bomb/path-traversal guards if archives are ever accepted, all rejecting with a specific 4xx (`IMPORT_PARSE_ERROR(422)`/`UNSUPPORTED_SOURCE_SYSTEM(422)`), never a 500. **Surface only** (a whole new parser/transform module — high-risk, needs scheduling + ingestion-hardening review).
2. **No server-side row-COUNT cap on bulk import.** `importPatients` parses the entire CSV/JSON array into memory and commits it in a single transaction with no max-rows guard (PRD FR7.2 mentions 500+). A very large payload is a memory/DoS-class concern (not a tenant-boundary breach). **Surface only** — adding a cap is a behavior change requiring a product decision on the limit (and on partial-vs-all-or-nothing semantics for oversized files).
3. **CSV parser is naive `split(',')`** — no RFC-4180 quoted-field / embedded-comma handling. A name like `"dela Cruz, Jr."` would mis-split. Not a security issue (no crash, no boundary breach); a data-fidelity limitation. **Surface only.**

**KG-backlog (query-only):**
4. **Bulk patient-import + the future FHIR bridge are unmodeled in the KG** (the PMD-import flow node IS accurate). Add `flow:bulk-import-patients` + (once built) `domain:external-records-import` on next regeneration.

---

## STEP 8 — Gate

| Gate | Result |
|------|--------|
| `cd services/api-ts && bunx tsc --noEmit` | ✅ 0 errors |
| Module suite (`test-with-db.ts`, `dental-patient.bulk-import.test.ts`) | ✅ **17 pass / 0 fail** (10 baseline + 7 new adversarial) |
| `eslint` (changed test file) | ✅ 0 errors, 0 warnings |
| `bun run check:boundaries` (api-ts) | ✅ no cross-module repo boundary violations |
| `br-registry.json` | ✅ valid JSON (`external-records-import` block added, 4 rules) |
| Contract suite | ✅ unaffected — **no TypeSpec/route change this round** (test + registry only); `dental-patient.hurl` / `dental-pmd.hurl` unchanged. The 3 known suite failures (mailpit `auth-verification`/`auth-password-reset`, Stripe `billing-lifecycle`) are pre-existing environmental, outside scope — identical to the prior fourteen rounds. |

---

## IDOR / cross-tenant / immutability / identity-binding / ingestion-safety verdict

- **Cross-tenant (import into another org's branch):** ✅ **CLEAR (guard present, now pinned).** `importPatients` authorizes every unique row `branchId` via `assertBranchRole(user, branchId, ['dentist_owner'])` BEFORE the all-or-nothing transaction; a foreign branch → 403 + zero rows; a multi-branch batch with one foreign branch fails wholesale. The V-PAT-002 lens applied to ingestion: the branchId is not merely access-checked, the write only proceeds for branches the caller owns.
- **Immutability (imported original can't be edited):** ✅ **CLEAR / N/A for bulk.** Bulk import creates ordinary *editable* patients (by design — they are the clinic's own records going forward). The immutable-original invariant belongs to the PMD-side (`imported-pmd-immutable.test.ts`, 405 IMPORTED_PMD_IMMUTABLE, round 8) and the future FHIR bridge (planned AC-EMR-001).
- **Identity-binding (no mis-attribution / forged patient ref):** ✅ **CLEAR / N/A for bulk.** Bulk import creates NEW person+patient per row (no patient-match/dedup), so there is no existing-patient to mis-attribute to and no client-supplied patient ref to forge. The PMD-side server-validates the patient's branch (round 8).
- **Ingestion safety (malformed/oversized → specific 4xx not 500):** ✅ **CLEAR (now pinned).** Untrusted CSV/JSON fails closed: malformed JSON → 400, non-array → 400, empty → 400/422, missing required → 422 per-row, tx failure → 422; oversized field values tolerated without crash; short CSV rows → 422. Surfaced (not a defect): no row-count cap (DoS-class, product decision) + naive CSV split.
- **Role-gating:** ✅ **CLEAR (now pinned).** Bulk import = dentist_owner-only; a same-branch dentist_associate → 403; unauthenticated → 401.
- **Optional-branchId (EM-BIL-002 class):** ✅ **N/A** — bulk import requires a per-row branchId (omit → 422), there is no optional-filter-omitted aggregate path.

## What's actually BUILT vs SURFACED-as-absent

- **BUILT (and enforced + now adversarially pinned):** FR7.2 bulk patient-demographics import (CSV + JSON-array + `{patients}`), up-front per-row validation, all-or-nothing transaction, owner-only per-branch authorization (cross-tenant safe), specific-4xx ingestion hardening. Cross-referenced as BUILT (round 8): single external-PMD import with verbatim/read-only storage (405), checksum verification (422), required provenance, server-validated identity binding, and a `pmd.import` audit row.
- **SURFACED-as-absent / deferred (NOT built):** the FHIR/CDA/PDF `/dental/emr-import` bridge (Phase-3+ by design — no handler/tsp/route); a server-side row-count cap on bulk import; RFC-4180 CSV parsing; a `flow:bulk-import-patients` / `domain:external-records-import` KG node. None were auto-built.

## Files Changed

**docs commit (`docs(audit): module external-records-import traceability + safe-gap closure + series rollup`):**
- `services/api-ts/src/handlers/dental-patient/dental-patient.bulk-import.test.ts` — **NEW** 2-org/2-role fixture + 7 adversarial tests (cross-tenant ×2, role-gating ×1, ingestion-safety ×4)
- `specs/api/docs/standards/br-registry.json` — **NEW** `external-records-import` block (4 rules: V-XRI-001 bulk cross-tenant/owner-only, V-XRI-002 ingestion safety, V-XRI-003 FHIR bridge deferred, V-XRI-004 PMD-import cross-ref)
- `docs/audits/modules/MODULE_external-records-import_AUDIT_2026-06-08.md` — this report
- `docs/audits/MODULE_AUDIT_TRACKER.md` — row 15 verdict + **SERIES ROLLUP** (the final hand-off artifact)
