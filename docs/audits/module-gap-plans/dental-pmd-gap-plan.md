# dental-pmd — Module Gap Plan

**Module:** dental-pmd (Portable Medical Document — generate / import / export)
**Audit date:** 2026-06-09
**Auditor:** Claude (live `/webwright` drive + code/spec gap analysis)
**References:** `docs/context/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md` · `docs/product/modules/dental-pmd/MODULE_SPEC.md` · **canonical PMD spec** `/Users/eladventures/Desktop/pmd/spec/` (PMD-SPEC.md producer, reader/PMD-READER-SPEC.md, schema/pmd-bundle.schema.json)
**Live evidence:** `outputs/dental-pmd-audit/final_runs/run_1/` (plan.md + screenshots + log)

---

## Audit Decision: **PARTIAL PASS**

The backend plumbing for **generate / import / export / FHIR care-record** is implemented, route-wired, and well-tested (8 test files, ~107 assertions; prior module audit `docs/audits/modules/MODULE_dental-pmd_AUDIT_2026-06-08.md` rated it READY against its own narrowed `MODULE_SPEC`).

It is a **PARTIAL PASS** — not a PASS — because, measured against the **canonical PMD standard the module explicitly brands itself to** (`MODULE_SPEC` §2 V-PMD-009: "PMD — Portable Medical Document — open signed document for portable health records"), the produced artifact is **not a conformant or clinically-safe Portable Medical Document**, and **half the module's UI is unreachable**:

1. The generated "PMD" **omits the mandatory Safety Floor** (allergies + active conditions) **and patient demographics** — it contains only treatments + prescriptions.
2. It is **never digitally signed** (status is stuck at `generated`; the SHA-256 checksum is co-located with the content and provides no real tamper-resistance or non-repudiation, despite code comments claiming both).
3. It is **not a FHIR R4 Bundle** (bespoke JSON; only the *unused* care-record export is FHIR).
4. The **PMD Viewer and Import flows have no trigger button** in the live UI (dead `onPmd` prop) → unreachable.
5. **Imported PMDs have zero clinical effect** — the Safety-Floor merge is stubbed (`markSafetyFloorMerged` never called), so an imported allergy never surfaces to a clinician.

None of these is a today-blast-radius P0 *only because* the artifact currently has no real external consumer or transport (it is "shared" as a `navigator.share` text string containing the checksum). The moment a real PMD exchange is attempted, items 1–3 become patient-safety and trust failures.

---

## Gaps (P0–P3)

> Severity is rated against the canonical PMD standard + the IDEAL dental standard. "Conforms to own narrowed MODULE_SPEC" is noted where relevant.

### P1 — serious functional / safety / trust / conformance gaps

| ID | Gap | Why it matters | Evidence |
|----|-----|----------------|----------|
| **PMD-P1-1** | **Generated PMD omits the Safety Floor (allergies + active conditions) and patient demographics.** Snapshot = `{visitId, patientId, authorMemberId, visitDate, treatments[], prescriptions[]}` only. | Canonical PMD §2 Layer 1 (patient identity) + Layer 2 (allergies/meds/conditions) are **MANDATORY** in every PMD; "the minimum a doctor needs to not harm you." A clinician reading a dentalemon "PMD" at another facility would not see the patient's penicillin/anaphylaxis allergy. Conforms to the module's *own* `MODULE_SPEC §7.1` ("excluded by design"), but that contradicts the PMD branding the module claims (V-PMD-009). | `generatePMD.ts:75-101`; `MODULE_SPEC §7.1` |
| **PMD-P1-2** | **PMD is never digitally signed; checksum is misrepresented as non-repudiation.** `repo.sign()` exists but no handler calls it → `status` stays `generated`, `signature`/`signedAt` always NULL. The SHA-256 checksum lives in the same DB row as the content. | Canonical §2 Layer 4 + §9 step 4 + Producer error-handling: signature is **mandatory** ("Signing failure → do not emit the PMD"). A co-located hash gives tamper-*evidence against accidental corruption* only — **no** protection against a malicious producer/DB edit and **no** non-repudiation, yet `generatePMD.ts` comments claim "non-repudiation" and "checksum-sealed." Misleading security posture. | `generatePMD.ts:64-73` (comments) ; `repos/pmd-document.*` (`sign()` unused) |
| **PMD-P1-3** | **PMD Viewer + Import UI unreachable (dead `onPmd` prop).** `WorkspaceTopBar` receives `onPmd` but renders no button that calls it; `setPmdViewerOpen(true)` is therefore never invoked. PMD Import opens only from inside the (unreachable) viewer's "Import External PMD" button. | Read + Import — half the module — have **no live entry point**. Same dead-prop class as `onLab`. Live-confirmed: workspace top-bar aria-labels contain no "PMD"/"Lab". | `workspace-top-bar.tsx:25,91` (prop only, no JSX) ; `$patientId.tsx:237,460-474` ; live run_1 step 3 |
| **PMD-P1-4** | **Imported PMDs have no clinical effect (Safety-Floor merge stubbed).** `ImportedPMDRepository.markSafetyFloorMerged()` is never called; `safety_floor_merged` is always `false`. No code surfaces an imported PMD's allergies/conditions into the patient Safety Floor. | Canonical Brief R3/R5 + `MODULE_SPEC §2` (V-PMD-012, add-only merge): the whole point of importing an external PMD is to surface its safety-critical items. Today import = write-only dead storage. | `importPMD.ts:31-93` (no merge call) ; repo method unused |
| **PMD-P1-5** | **Per-visit PMD is not a FHIR R4 Bundle.** Content is bespoke JSON, not `Bundle(type=document)` → Composition + Patient + AllergyIntolerance/MedicationRequest/Condition + Signature. (A correct FHIR builder, `buildCareRecordBundle`, exists but is used only by the unused care-record export.) | Canonical §3 requires the PMD *be* a FHIR Bundle for "works everywhere" interop. A non-FHIR blob cannot be read by any other PMD-compatible system. | `generatePMD.ts:75-101` vs `care-record/fhir-bundle.ts:118-277` |

### P2 — important, not blocking

| ID | Gap | Why it matters | Evidence |
|----|-----|----------------|----------|
| **PMD-P2-6** | **`exportPatientCareRecord` (FHIR R4 continuity-of-care, P2-18) has no frontend trigger.** Backend + tests complete; zero consumers; no SDK convenience fn confirmed. | HIPAA right-of-access / continuity-of-care export is unreachable by users. | `exportPatientCareRecord.ts` ; FE grep = 0 hits |
| **PMD-P2-7** | **`listImportedPmds` / `getImportedPmd` have no frontend consumer** — no imported-PMD history/list/detail view. | Imported documents can be stored but never browsed or read in-app. | FE grep = 0 hits |
| **PMD-P2-8** | **"Share PMD" delivers only a checksum text string.** Uses `navigator.share({text: "…Checksum: …"})`; no file/download/QR/SMART-Health-Link. On desktop (no `navigator.share`) it silently sets `✓ PMD shared` with **no artifact delivered**. | Canonical §6/§8 transport (file / SHL). Today the patient receives nothing actionable; the success state is misleading. | `$patientId.tsx:177-200,306-316` |
| **PMD-P2-9** | **No multi-PMD reader: dedup / conflict detection / trust-tier / supersession display.** None of `reader/PMD-READER-SPEC.md` §4–§5 is implemented. | Canonical R5/R12 "Should Have"; explicitly deferred in `MODULE_SPEC §16`. Needed before any real multi-source PMD use. | no reader module exists |

### P3 — minor / deferred (document, do not block V1)

| ID | Gap | Notes |
|----|-----|-------|
| **PMD-P3-10** | Async generation (`dental_pmd_async_generation`), presigned-URL download, multipart upload, notifs "PMD ready" link | Deferred per `MODULE_SPEC §16/§18/§10b`. |
| **PMD-P3-11** | Safety-Floor Extract, correction advisory, SMART-Health-Link transport, registry-verified trust tier | Canonical "Nice to Have" / future. |
| **PMD-P3-12** | No seed PMD library | PMDs are generated on demand from completed visits — acceptable. |

---

## Broken / Misleading Journeys (live)

- **Generate → "share" a PMD:** On a completed visit, "Share PMD" calls `generatePmd` then `navigator.share` of a *checksum string*. No file leaves the app; on desktop the button just flips to "✓ PMD shared" with nothing delivered. **Misleading.**
- **View a generated PMD:** No entry point exists (dead `onPmd`). A dentist cannot open the PMD they just generated.
- **Import an external PMD:** No entry point exists (only via the unreachable viewer). Even if reached, the import has no clinical effect (merge stubbed).
- **Export full care record (FHIR):** Backend-complete, no button.

---

## Unused / Unwired Implementation

| Backend capability | State |
|---|---|
| `getPmdForVisit` / `PMDViewerSheet` | Built; **unreachable** (dead `onPmd`). |
| `importPMD` / `PMDImport` | Built; **unreachable** (only via dead viewer). |
| `listPmds` | Built + SDK; **no FE consumer.** |
| `listImportedPmds`, `getImportedPmd` | Built + SDK; **no FE consumer.** |
| `exportPatientCareRecord` (FHIR R4) | Built + tested; **no FE consumer / no SDK fn confirmed.** |
| `getDentalPatientSafetyFloor` (dental-patient) | Built + tested; **no FE consumer** (top bar uses `useMedicalHistory` instead). |
| `PMDDocumentRepository.sign()` | Built + unit-tested; **never called** by any handler. |
| `ImportedPMDRepository.markSafetyFloorMerged()` | Built; **never called.** |

---

## Knowledge-Graph / Dependency Findings

- **Cross-module data exists to populate a real PMD** (allergies/meds/conditions with codes live in `medical_history` via `dental-clinical`; demographics in `dental-patient`/`persons`; CDT treatments in `dental-visit`; RxNorm prescriptions in `dental-clinical`). The data is available; the generator simply doesn't pull the safety/demographic slices.
- **Loose coupling honored:** PMD references visit/patient by UUID only (no FK), per `MODULE_SPEC §7.2`. Good for offline/erasure.
- **Blast radius of fixing PMD-P1-1/P1-5 (content shape):** changes the checksum and the stored snapshot shape → any existing PMDs would differ on regen (handled by supersession). Reuse `buildCareRecordBundle` to avoid a second FHIR codepath.
- **Blast radius of signing (PMD-P1-2):** introduces facility key/cert management (custodian identity from `dental-org`); decide self-signed pilot vs trust framework (canonical §12).
- **Consumers:** `dental-visit` (DE-002 VisitCompleted → PMD-eligible) and `notifs` (DE-017, deferred) are audit-log-only markers (ADR-006) — no event bus to wire.

---

## Existing Tests Found

- Backend: `dental-pmd.test.ts`, `dental-pmd-auth.test.ts`, `dental-pmd-events.test.ts`, `dental-pmd.data-portability.test.ts`, `exportPatientCareRecord.test.ts`, `imported-pmd-immutable.test.ts`, `care-record/fhir-bundle.test.ts`, `repos/pmd-document.test.ts`.
- Contract: `specs/api/tests/contract/dental-pmd.hurl` (generate + import happy path).
- FE: `pmd-import.test.ts`, `pmd-viewer.test.ts` (mount components directly).
- E2E: `pmd-generation.spec.ts`, `pmd-import.spec.ts`, `safety-floor.spec.ts`.

**Why the suite missed these gaps:** FE/E2E tests mount `PMDViewer`/`PMDImport` (and call endpoints) **directly**, bypassing the missing trigger button — so the unreachable-UI gap is invisible. No test asserts the PMD *content* contains the Safety Floor; no test drives signing through a handler; no reader/dedup tests exist. This is the same "tests mount components/handlers directly, hiding wiring gaps" class recorded in prior findings (`feedback_test_verification`, imaging/clinical drives).

---

## Missing Tests (add before/with each fix)

- **Before PMD-P1-3:** an E2E that opens the PMD viewer **via the real top-bar button** (RED until the button exists), then reaches Import from it.
- **Before PMD-P1-1/P1-5:** a backend test asserting the generated PMD Bundle contains the required Safety-Floor sections (allergies/meds/conditions, with `nilknown` when empty) + patient demographics, and validates against `pmd-bundle.schema.json`.
- **Before PMD-P1-2:** sign→verify round-trip test; tampered-content → signature-verification fails; status transitions `generated → signed`.
- **Before PMD-P1-4:** import an external PMD with an allergy → assert it surfaces in the patient Safety Floor and `safety_floor_merged` flips true (add-only; no overwrite).
- **Before PMD-P2-6/7:** FE tests that the care-record export button and imported-PMD list call their endpoints.
- Pin the prior-audit items: imported-PMD read audit-row; care-record superseded-exclusion.

---

## Recommended Fix Order

1. **PMD-P1-3 — Wire the PMD Viewer + Import entry point** (smallest, highest leverage). Add a PMD `IconButton`→`onPmd` in `WorkspaceTopBar`; confirm Import reachable. *Test first:* real-button E2E. (Also fixes the dead `onLab` if desired.)
2. **PMD-P1-1 + P1-5 — Make the per-visit PMD a conformant FHIR Bundle that includes the Safety Floor + demographics**, by routing `generatePMD` through `buildCareRecordBundle` extended with allergies/meds/conditions (from `dental-clinical` medical-history facade) and patient demographics. *Tests:* schema + required-section assertions.
3. **PMD-P1-2 — Implement JWS signing** (jose, ES256, facility key as self-signed pilot per canonical §12), transition `generated → signed`, verify signatures on import, and **remove the misleading "non-repudiation via checksum" comments**. Surface a trust-tier badge in the viewer. *Tests:* sign/verify/tamper.
4. **PMD-P1-4 — Run the add-only Safety-Floor merge on import** and surface imported safety items in the top-bar Safety Floor; set `safety_floor_merged`. *Test:* import→allergy-visible.
5. **PMD-P2-6 / P2-7 — Wire care-record export button + imported-PMD list/detail view.**
6. **PMD-P2-8 — Replace checksum-text "share" with a real file/SHL export** (and an honest no-op state on unsupported platforms).
7. **PMD-P2-9 — Multi-PMD reader (dedup / conflict / trust-tier / supersession display)** — larger; stage after the above.

---

## Dependencies on Other Modules

- **dental-clinical** — medical-history facade for allergies/meds/conditions (PMD-P1-1, P1-4).
- **dental-patient** — `getDentalPatientSafetyFloor` + demographics (PMD-P1-1, P1-4).
- **dental-org** — facility custodian identity + signing cert/key management (PMD-P1-2).
- **storage (S3/MinIO)** — only if/when real file export / presigned URLs are added (PMD-P2-8, P3-10).
- **dental-visit / notifs** — DE-002 / DE-017 are audit-log-only markers (ADR-006); no bus wiring needed.

---

## Items marked [NEEDS CONFIRMATION]

- **[NEEDS CONFIRMATION]** Product intent: is the per-visit PMD meant to be a **true canonical (FHIR + signed + Safety-Floor) Portable Medical Document**, or an intentionally-narrowed internal "visit snapshot compliance record"? The `MODULE_SPEC` narrows it (excludes safety floor "by design") while simultaneously adopting the canonical PMD name/expansion (V-PMD-009). This single decision sets whether PMD-P1-1/P1-2/P1-5 are P1 conformance bugs or accepted scope. **Recommend: confirm with product before implementing fixes 2–3.**
- **[NEEDS CONFIRMATION]** Whether an SDK `exportPatientCareRecord` client fn is generated (FE wiring for PMD-P2-6 may need it added).
- **[NEEDS CONFIRMATION]** Signing trust model for pilot: self-signed facility cert (canonical §12 "bilateral/unverified") acceptable for V1?
