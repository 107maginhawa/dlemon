# Compliance Report — dental-pmd

---
Audit Date: 2026-05-30
Dimension: compliance (oli-check, single-module slice)
Module: dental-pmd
Spec Version: 1.0 (MODULE_SPEC.md Last Updated 2026-05-24)
Auditor: oli-check COMPLIANCE dimension
---

## Generated Code Exclusion

`services/api-ts/src/generated/**` is excluded from violation findings (OpenAPI routes/validators/types). Route wiring is via the generated registry pattern (`registry.ts` spreads `import * as dentalPmd from '@/handlers/dental-pmd'`; `routes.ts` mounts each operationId; `registerOpenAPIRoutes(app)` is called at `app.ts:515`). Hand-written handlers, repos, schema, manual 405 guards in `app.ts`, tests, and frontend consumers ARE in scope.

## Audit Scope

| Artifact | Available | Steps Executed |
|----------|-----------|----------------|
| MODULE_SPEC.md (dental-pmd) | YES | Steps 3-10 (BR, AC, permissions, API, state, data) |
| TypeSpec source `dental-pmd.tsp` | YES | Step 8 |
| Generated routes/validators | YES (read for wiring/contract, excluded from findings) | Step 8b |
| Hurl contract `dental-pmd.hurl` | YES | Step 8 / contract layer |
| DOMAIN_GLOSSARY / DOMAIN_MODEL / EVENT_CONTRACTS / AUDIT_CONTRACTS .md | NO (used MODULE_SPEC §2/§10b/§17) | Steps 6/9c/9d via spec |

Knowledge-graph alignment: `CODE_MODULE_MAP.json` lists dental-pmd `framework: hono`, entry `index.ts`, 7 public exports — all 7 reconciled against the .tsp operationIds and the generated `routes.ts` mount points (`routes.ts:1056-1333`).

> Spec paradox disclaimer: validates code against specs. Last spec-gate run: NOT RUN for this slice.

## Files Audited (exhaustive, in-scope)

Handlers: `generatePMD.ts`, `importPMD.ts`, `listPMDs.ts`, `listImportedPMDs.ts`, `getPMDForVisit.ts`, `getImportedPMD.ts`, `exportPMD.ts`, `index.ts`.
Repos/schema: `repos/pmd-document.schema.ts`, `repos/pmd-document.repo.ts`, `repos/imported-pmd.repo.ts`.
Tests: `dental-pmd.test.ts`, `dental-pmd-auth.test.ts`, `dental-pmd.data-portability.test.ts`, `repos/pmd-document.test.ts`.
Spec/contract: `specs/api/src/modules/dental-pmd.tsp`, `specs/api/tests/contract/dental-pmd.hurl`.
Wiring: `services/api-ts/src/app.ts` (manual 405 guards + `registerOpenAPIRoutes`), `generated/openapi/routes.ts`, `generated/openapi/registry.ts`, `generated/openapi/validators.ts`.
Frontend: `apps/dentalemon/src/features/workspace/hooks/use-pmd.ts`, `use-share-pmd.ts`, `apps/dentalemon/src/features/pmd/*`.

---

## Executive Summary

- **P0 violations:** 0
- **P1 violations:** 2
- **P2 violations:** 4
- **P3 violations:** 2

The module is **well-implemented and largely spec-compliant.** All 7 spec §10 endpoints are correctly registered (generated routes mounted at `app.ts:515`); BR-021 (immutable SHA-256-sealed snapshot), BR-022 (router-level 405 read-only guard for imported PMD), AC-PMD-001..003, the supersede state machine, the synchronous DE-017 audit row, no-DB-FK loose coupling, and patient-self download scoping are all present and tested with real HTTP-level assertions against seeded DBs. No P0 violations. The remaining findings are functional gaps (AC-PMD-004 long-term-immutability not directly asserted; Hurl contract uses 400 instead of spec's 422) and schema/contract drift against §7 field lists.

> CORRECTION: an interim draft of this report (overwritten) asserted P0s for "module not registered" and "missing 405 guard." Both were FALSE — disproved by `routes.ts:1056-1333` (all endpoints registered via the generated registry, which this repo uses instead of per-module `register.ts` files) and `app.ts:224-236` (explicit 405 `IMPORTED_PMD_IMMUTABLE` guards). The corrected findings below stand.

---

## V-PMD-201 (P1) — Hurl contract asserts 400 for non-completed-visit generate; spec requires 422

**Step 8 (contract mismatch) / AC-PMD-001 + §15.**

MODULE_SPEC AC-PMD-001 and §15 require generating a PMD from a non-completed visit → **422 VISIT_NOT_COMPLETED**. The handler is correct (`generatePMD.ts:53-58` throws `BusinessLogicError('...','VISIT_NOT_COMPLETED')` → 422) and the unit test asserts 422 (`dental-pmd.test.ts:137-148`). But the **wire-contract** test asserts the wrong status: `dental-pmd.hurl` step 7 (`POST .../{draft_visit_id}/pmd`) expects `HTTP 400`. The authoritative contract therefore disagrees with the spec error code and would mask a regression if the handler reverted to a 400 validation error. Same drift in `dental-pmd.test.ts:183` where listPMDs missing-param asserts 400 (acceptable — that is a true validation error), but the generate-on-draft assertion is the spec-violating one.

**Location:** `specs/api/tests/contract/dental-pmd.hurl` (step 7, "Cannot generate PMD from a draft visit" → `HTTP 400`)
**Fix:** Change the Hurl assertion to `HTTP 422` and add `jsonpath "$.code" == "VISIT_NOT_COMPLETED"`.
**Autofixable:** Yes (single-line contract edit).

## V-PMD-202 (P1) — AC-PMD-004 (PMD immutable against future visit edits) not directly tested

**Step 4 (AC UNTESTED, core workflow) / BR-021.**

AC-PMD-004 ("PMD content matches visit snapshot at generation time; future visit edits don't change PMD") is the central BR-021 immutability guarantee. The snapshot is built from a point-in-time `JSON.stringify(...)` and stored in `content` with a SHA-256 checksum (`generatePMD.ts:80-104`), and the repo never updates `content` after creation, so the behavior almost certainly holds. However **no test mutates the source visit/treatments after generation and re-reads the PMD to prove the content/checksum are unchanged.** `dental-pmd.test.ts` and `pmd-document.test.ts` assert checksum presence and supersede transitions but not post-edit invariance. Per Step 4, an untested core-workflow criterion = P1.

**Location:** tests (no AC-PMD-004 coverage) — behavior in `generatePMD.ts:80-130`, `pmd-document.repo.ts`
**Fix:** Add a test: generate PMD, capture content+checksum, then add/modify a treatment on the same visit, re-fetch the PMD, assert content and checksum are byte-identical.
**Autofixable:** No (new test).

## V-PMD-203 (P2) — `imported_pmd` schema omits §7 fields: branch_id, checksum, storage_file_id, imported_by_member_id

**Step 10 (data validation) / §7 + §7.2.1.**

MODULE_SPEC §7 lists `imported_pmd` fields `id, patient_id, branch_id, imported_at, storage_file_id, source_description, checksum`; §7.2.1 adds `imported_by_member_id`. The actual table (`pmd-document.schema.ts:44-63`) has `patientId, sourceFacility(notNull), sourceReference, sourceDescription(notNull), content(text), importedAt, safetyFloorMerged` + base fields. **Missing:** `branch_id`, `checksum`, `storage_file_id`, `imported_by_member_id`. `importPMD.ts` resolves a `patient.preferredBranchId` for the audit row but does not persist branch or importer identity on the imported record, weakening §7.2.5 provenance and §7.2.1 author binding. Content is stored inline (`content: text`) instead of via `storage_file_id`. (No FK is present — that part of §7.2.1 is correctly honored.)

**Location:** `repos/pmd-document.schema.ts:44-63`; `importPMD.ts:70-76`
**Fix:** Add `branchId`, `checksum`, `importedByMemberId` (plain UUID/text, no FK per §7.2.1), and `storageFileId` if storage-backed; populate them in `createOne(...)`; generate migration. Or update §7 to document the inline-content / source_facility model.
**Autofixable:** No (schema + migration).

## V-PMD-204 (P2) — `sourceDescription` required/optional contradiction across .tsp, validator, schema, and handler

**Step 8b (request schema) / §7.2.5.**

§7.2.5 makes `source_description` required. The TypeSpec models it required (no `?`, `@maxLength(200)`) and the generated validator enforces `sourceDescription: z.string()` (required) — good. BUT: (a) the handler guards it as if optional — `importPMD.ts:41` `if (body.sourceDescription !== undefined && length>200)` — and never rejects an absent value; (b) tests import **without** `sourceDescription` and expect 201 (`dental-pmd.data-portability.test.ts:101`, `dental-pmd.test.ts:207`), which only passes because those tests use a permissive local `ve` validator stub rather than the real required validator; (c) the .hurl contract (steps 9, "Import an external PMD") also omits `sourceDescription`. So the real wired endpoint requires it, but three test/contract layers assume it is optional — an internal inconsistency that means the "required source_description → 422 if missing" guarantee is unverified and the contract test would fail against the real validator.

**Location:** `importPMD.ts:41`; `dental-pmd.data-portability.test.ts:101`; `dental-pmd.hurl` step 9; vs `validators.ts:92` / `dental-pmd.tsp` ImportPMDRequest
**Fix:** Pick one source of truth. Since §7.2.5 says required: keep validator required, add `sourceDescription` to the Hurl import and to the unit-test bodies (they currently rely on the stub), and drop the `!== undefined` guard (length check only). Add a negative test: import without sourceDescription → 422/400.
**Autofixable:** No (multi-file reconciliation).

## V-PMD-205 (P2) — `pmd_document` schema omits §7 fields: format_version, storage_file_id

**Step 10 / §7.**

§7 `pmd_document` fields include `generated_at, storage_file_id, format_version`. The table (`pmd-document.schema.ts:22-38`) maps `generated_at`→`createdAt` (acceptable) but **omits `format_version` and `storage_file_id`**, storing the snapshot inline as `content: text`. `format_version` is meaningful for PMD portability/interop (§1 "portable health records"). Low runtime impact at current volume (§16 ~5/day/branch).

**Location:** `repos/pmd-document.schema.ts:22-38`
**Fix:** Add `formatVersion` (text/int, default '1'); add `storageFileId` if S3 download is intended (§16). Otherwise update §7 to reflect inline storage.
**Autofixable:** No.

## V-PMD-206 (P2) — Export uses inline JSON download, not §16 signed-URL/S3 path

**Step 8 (response architecture) / §9 + §16.**

§16 specifies "Download < 2s (signed URL from S3)"; `exportPMD.ts:77-83` instead streams the full JSON inline as an `attachment`. Functionally correct and tested (`dental-pmd.data-portability.test.ts:128-145` asserts 200 + content-disposition), and frontend `use-share-pmd.ts` consumes it as a blob — but diverges from the declared download architecture and the missing `storage_file_id` column (V-PMD-203/205). Acceptable for V1 volume; flag for the spec to either adopt inline as the V1 strategy or implement signed URLs.

**Location:** `exportPMD.ts:77-83`; `apps/dentalemon/src/features/workspace/hooks/use-share-pmd.ts`
**Fix:** Annotate §16 that inline export is V1, or persist to storage on generate and return a signed URL.
**Autofixable:** No.

## V-PMD-207 (P3) — Legacy checksums acknowledged as non-cryptographic

**Step 3 (BR-021 observation).**

`generatePMD.ts:24-32` documents that pre-existing rows retain a 16-char charcode-sum "checksum" while new rows use real SHA-256 (`sha256-<64hex>`). BR-021 is satisfied for all new documents; old rows are non-cryptographic but bounded and documented.

**Location:** `generatePMD.ts:24`
**Fix:** Optional one-off backfill to recompute or flag legacy checksums.
**Autofixable:** No.

## V-PMD-208 (P3) — `safety_floor_merged` stored as text 'true'/'false' instead of boolean

**Step 6.5 / Step 10 (type representation).**

`pmd-document.schema.ts:62` stores `safety_floor_merged` as `text` default `'false'`; the .tsp + API responses model it as `boolean`, so handlers coerce at the boundary (`imported-pmd.repo.ts:27`, `importPMD.ts:92`, `getImportedPMD.ts:66`). Works correctly; representation drift only.

**Location:** `repos/pmd-document.schema.ts:62`
**Fix:** Migrate column to `boolean`; drop string coercions.
**Autofixable:** No (migration).

---

## Compliant / Positive Findings (no violation)

- **All 7 §10 endpoints registered & reachable** — generated `routes.ts:1056-1333` mounts every operationId with zValidator middleware; `registry.ts:56-57` spreads the dental-pmd barrel; `registerOpenAPIRoutes(app)` at `app.ts:515`. (Repo uses the generated-registry pattern, not per-module register.ts.)
- **BR-022 / AC-PMD-002 — router-level 405 read-only guard** — `app.ts:224-236` registers explicit PATCH/PUT/DELETE handlers on `/dental/pmd/imported/:id` returning **405 `IMPORTED_PMD_IMMUTABLE`** (not 403), shadowing generated GET. Exactly per §7.2.3 / §20.3.
- **BR-021 immutability & checksum** — snapshot built from `visit.patientId` (not client body) and sealed with real SHA-256 including `authorMemberId` for non-repudiation (`generatePMD.ts:60-104`). N-PMD-02 identity binding tested (`dental-pmd-auth.test.ts:199-231`).
- **AC-PMD-001** — non-completed/non-locked visit → 422 VISIT_NOT_COMPLETED (`generatePMD.ts:51-58`), tested (`dental-pmd.test.ts:137-148`).
- **AC-PMD-003** — checksum mismatch → 422 CHECKSUM_MISMATCH (`importPMD.ts:49-57`), tested (`dental-pmd.data-portability.test.ts:148-159`).
- **§8 supersede state machine** — re-generation transitions prior row `generated → superseded` without altering content/checksum (`pmd-document.repo.ts:67-79`), tested (`repos/pmd-document.test.ts:35`).
- **§6 RBAC** — generate restricted to `['dentist_owner','dentist_associate']`; import adds `staff_full`; reads require branch membership; **with real deny-403 + allow-201 tests** (`dental-pmd-auth.test.ts:126-193`). Disproves any "auth untested" concern.
- **§6 patient-self download** — `isPatientSelf` branch in `listPMDs.ts:30-34`, `listImportedPMDs.ts:30-34`, `getPMDForVisit.ts:33-37`, `exportPMD.ts:43-48`.
- **§10b DE-017** — synchronous `pmd.generated` audit row written per ADR-006 (no event bus) (`generatePMD.ts:148-156`).
- **§7.2.1 / §20.2 loose coupling** — cross-module refs are plain UUID, NO DB FK; only intra-aggregate `supersedes_id` keeps an FK (`pmd-document.schema.ts:17-44`).
- **§17 no-PHI logging** — audit metadata carries IDs/source labels, not clinical PHI.

---

## Stabilization Plan

### Fix Now (P0)
- None.

### Fix Before New Work (P1)
- V-PMD-201 — Correct Hurl contract: generate-on-draft → 422 VISIT_NOT_COMPLETED.
- V-PMD-202 — Add AC-PMD-004 immutability-after-edit test.

### Fix When Touching Module (P2)
- V-PMD-203 — Add missing imported_pmd columns (branch_id, checksum, storage_file_id, imported_by_member_id).
- V-PMD-204 — Reconcile sourceDescription required/optional across handler/tests/Hurl/validator.
- V-PMD-205 — Add format_version (+ storage_file_id) to pmd_document, or update §7.
- V-PMD-206 — Decide inline-vs-signed-URL download; document in §16.

### Track (P3)
- V-PMD-207 (legacy checksums), V-PMD-208 (boolean column type).

---

## Compliance Rate & Verdict

Auditable items (2 BR + 4 AC + 7 endpoints + permission matrix + 2 entities ≈ 16 weighted): 0 P0, 2 P1, 4 P2. No P0 → no hard block on safety/data-integrity. Dimension verdict **WARN** — the module is functionally sound and well-tested; the two P1s are a contract-vs-spec status-code drift and a missing long-term-immutability test, both quick to close. P2s are schema/§7 field-list reconciliation.
