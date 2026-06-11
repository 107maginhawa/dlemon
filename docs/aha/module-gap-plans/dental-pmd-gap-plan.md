# AHA Module/Group Gap Plan: Dental PMD (Portable Medical Document)

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Dental PMD |
| Module slug | dental-pmd |
| Type | Business Module |
| Output file | `docs/aha/module-gap-plans/dental-pmd-gap-plan.md` |
| Primary PRD/spec used | `docs/prd/v3-dentalemon.md` §6.12 (FR12.1–FR12.6) + Appendix E (PMD format) |
| Supporting PRDs/specs used | `docs/prd/BUSINESS_RULES.md` BR-021/022; `docs/prd/ACCEPTANCE_CRITERIA.md` AC-PMD-001..004; `docs/product/modules/dental-pmd/MODULE_SPEC.md` + `API_CONTRACTS.md` (V-PMD-006/009/010/012 reconciliations); `docs/product/WORKFLOW_MAP.md` WF-021/022 |
| PRD/spec coverage quality | Strong |
| Paths inspected | `services/api-ts/src/handlers/dental-pmd/` (8 ops, repos, fhir-bundle builder, 8 test files); `apps/dentalemon/src/features/pmd/` (viewer, viewer-sheet, import); `routes/_workspace/$patientId.tsx`; `workspace-top-bar.tsx`; `handlers/dental-visit/updateDentalVisit.ts` + `visit-pmd.facade.ts` (generation-trigger check); `dental-pmd.hurl` |
| PRDs/specs inspected | All above; full FR12 + Appendix E extraction |
| KG used | Yes — `contract-spine.json`; consumer claims grep-verified; generation-trigger absence verified by orchestrator |
| KG refreshed | No |
| `/understand-domain` used | Yes (cross-check only) |
| `/understand-domain` refreshed | No |
| Webwright used | No — unreachability is statically conclusive (no rendered button, no caller of generatePMD anywhere) |
| Playwright/E2E inspected | Yes (inspected, not run): `pmd-generation.spec.ts`, `pmd-import.spec.ts`, `safety-floor.spec.ts` — all API-only/mount-direct (false-green class) |
| Existing tests inspected | 8 backend files (107 assertions), `dental-pmd.hurl` (26 req), 2 FE files, 3 E2E |
| Cross-cutting audit reviewed | Not Available |
| Database/schema audit reviewed | Not Available |
| Limitations | No tests executed |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| v3 PRD §6.12 + Appendix E | `docs/prd/v3-dentalemon.md` | PRD | Current | FR12.1 auto-generate on completion w/ safety floor + identity + coded clinical data; FR12.2 viewer <3s; FR12.3 safety-floor display incl. imported; FR12.4 facility signature; FR12.5 import w/ add-only merge; FR12.6 share/print |
| Business rules | `docs/prd/BUSINESS_RULES.md` | business rules | Current | BR-021 immutable snapshot + checksum; BR-022 imported read-only, no auto-merge |
| Acceptance criteria | `docs/prd/ACCEPTANCE_CRITERIA.md` | acceptance criteria | Current | AC-PMD-001..004 |
| Module spec + API contracts | `docs/product/modules/dental-pmd/` | module spec | Current (V-PMD-006/009/010/012 reconciled 2026-05-30) — **but spec's "module narrowed by design" framing conflicts with PRD FR12.1 content list** | endpoints, schema, deferred presigned-URL flow |
| Prior module audit + gap plan + matrix | `MODULE_dental-pmd_AUDIT_2026-06-08.md`, prior gap plan (P1-1..P1-5), matrix | prior audit (pre-AHA) | Current — all five P1 rows re-verified OPEN this round | §3 |

## 3. Expected vs Actual

**Expected (PRD §6.12):** the product's portability headline — on visit completion a PMD is **auto-generated** (FR12.1) containing patient identity, the safety floor (allergies/meds/conditions), and coded clinical data; facility-signed (FR12.4); shareable/printable (FR12.6); importable at another clinic with preview and an **add-only safety-floor merge** so imported allergies actually protect the patient (FR12.3/12.5).

**Actual:** The backend plumbing is solid — checksum-sealed immutable snapshots with supersede semantics, read-only imported records (405 on mutation), RBAC on every write, a correct FHIR R4 bundle builder for the whole-patient care record, 107 backend assertions, 26 contract requests. But **the module is unreachable end-to-end in the shipped product**:

1. **NEW — PMDs can never be created.** `generatePMD` has zero FE consumers AND no server-side trigger: `updateDentalVisit.ts` contains no PMD call on completion, and `visit-pmd.facade.ts` only exposes visit data *to* pmd handlers (pull direction). WF-021's "auto-generate on Completed" is unimplemented. Everything downstream (list/get/export/share) is therefore dead in production regardless of its own wiring.
2. **P1-3 confirmed:** `onPmd` is a dead prop — `workspace-top-bar.tsx:25,91` declares/destructures it; the icon block (:177-199) renders Rx/Consent/Notes/Attachments/Treatment-Plan/Complete and **no PMD button** (exact same class as `onLab`, see dental-clinical GAP-1). The viewer sheet, and the Import button inside it, are mounted (`$patientId.tsx:301,565-570`) but unreachable.
3. **P1-2 confirmed:** signing is dead code — `pmd-document.repo.ts:59` `sign()` has zero callers; `signature`/`signedAt` always NULL; `generatePMD.ts:64-73` comments claim "non-repudiation … checksum-sealed", misrepresenting a SHA-256 integrity hash as a signature.
4. **P1-4 confirmed:** imports are clinically inert — `markSafetyFloorMerged()` (`imported-pmd.repo.ts:45`) has zero callers; `importPMD.ts` stores the record with `safetyFloorMerged:'false'` and no merge ever occurs. An imported penicillin allergy never reaches the safety floor.
5. **P1-1 confirmed:** the generated snapshot is `{visitId, patientId, authorMemberId, visitDate, treatments[], prescriptions[]}` (`generatePMD.ts:75-101`) — **no safety floor, no demographics, no conditions/notes**, contradicting FR12.1's content list.
6. **P1-5 confirmed:** per-visit PMD is bespoke JSON; the FHIR builder (`care-record/fhir-bundle.ts:118-277`, CDT/ICD-10/RxNorm coded) serves only `exportPatientCareRecord` — itself zero-consumer.

Tests are green because FE/E2E tests mount components directly and drive endpoints via API (`pmd-generation.spec.ts` etc.) — the false-green wiring class.

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR12.1/BR-021/WF-021 auto-generate on completion | PMD created when visit completes | **Missing trigger** — endpoint exists, 0 FE consumers, no call in visit completion path | — | `updateDentalVisit.ts` (no pmd call); `generatePMD.ts` orphan | `pmd_document` | backend tests (direct-call only) | Partially Implemented | **GAP-1** |
| FR12.1 snapshot content (identity, safety floor, coded dx/px/rx, notes) | Full content list | Treatments + prescriptions only | — | `generatePMD.ts:75-101` | content jsonb | no content-completeness assertions | Partially Implemented | **GAP-3** |
| BR-021 immutability + checksum + supersede | sealed snapshot; re-gen supersedes | ✓ | — | sha256 (:30-31, :104); supersede logic | checksum col, supersedes_id | AC-PMD-001/003/004 pins | Implemented | No |
| FR12.4 facility digital signature | signed PMDs; offline cert | **Dead code** — `sign()` unused; signature always NULL; checksum mislabeled non-repudiation | — | `pmd-document.repo.ts:59` 0 callers | signature/signed_at cols | none | Missing | **GAP-4** |
| FR12.2/12.6 viewer + share/export/print | reachable viewer; export; print | Viewer+sheet built; **unreachable (dead onPmd)**; export 0 consumers; print absent | `workspace-top-bar.tsx:25,91` vs :177-199 | `exportPMD` 0 consumers | — | FE tests mount-direct | Partially Implemented | **GAP-2** |
| FR12.5/BR-022 import (read-only, checksum-validated) | import + preview + confirm | ✓ handler + UI component (CHECKSUM_MISMATCH 422; 405 immutable) — UI behind dead button | `pmd-import.tsx:9,49` | `importPMD.ts:27-56` | imported_pmd | AC-PMD-002/003 pins + hurl | Implemented (unreachable) | GAP-2 |
| FR12.3/V-PMD-012 add-only safety-floor merge | imported allergies/meds reach floor | **Never merges** — flag infra only | — | `markSafetyFloorMerged` 0 callers; `importPMD.ts:92` false | safety_floor_merged col | none | Missing | **GAP-5** |
| Appendix E format (FHIR-aligned) | interoperable document | Bespoke JSON per-visit; FHIR only in unreachable care-record export | — | `fhir-bundle.ts:118-277` | — | `fhir-bundle.test.ts` (7) | Partially Implemented | **GAP-6** `[NEEDS PRODUCT DECISION]` |
| Care-record export (P2-18, FHIR R4 Bundle) | whole-patient continuity export | ✓BE, 0 consumers (spec-declared P2) | — | `exportPatientCareRecord.ts` | — | tests | Not Required for V1 (early) | GAP-7 (P3) |
| FR12.6 QR/NFC/SMART links, print/mail | Phase-2 sharing | Absent as declared | — | — | — | — | Not Required for V1 | No |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| FR12.1/WF-021 generation trigger | **GAP-1**: no path creates a PMD — no auto-generate on completion, no FE trigger; module dead from the first step | P1 | V1 REQUIRED | orchestrator-verified: `generatePMD` 0 consumers + no completion-path call | Decide trigger (auto-on-complete per PRD vs explicit button) then wire; RED-first test: complete visit → PMD exists |
| FR12.2 reachability | **GAP-2**: dead `onPmd` — viewer/import/export UI unreachable (same class as clinical Lab button) | P1 | V1 REQUIRED | `workspace-top-bar.tsx:25,91` vs icon block :177-199 | Render PMD icon button; RED-first top-bar test; honest E2E |
| FR12.1 content | **GAP-3**: snapshot omits safety floor + demographics + conditions/notes | P1 | V1 REQUIRED (content list is PRD-explicit) `[NEEDS PRODUCT DECISION]` only on exact field set | `generatePMD.ts:75-101` | Extend snapshot via existing patient safety-floor + med-history facades; content-completeness test |
| FR12.4 signing | **GAP-4**: signature dead code + misleading non-repudiation comments | P1 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` (self-signed pilot scheme vs defer signing honestly) | `sign()` 0 callers; comments :64-73 | Either wire pilot signing on generate, or strip signature claims from comments/UI and defer FR12.4 explicitly |
| FR12.3/12.5 import effect | **GAP-5**: imported safety data never merges — imported allergy cannot protect patient | P1 | V1 REQUIRED | `markSafetyFloorMerged` 0 callers | Add-only merge step (review+confirm UI per BR-022) calling existing repo method + med-history insert; RED-first |
| Appendix E format | **GAP-6**: bespoke JSON vs FHIR; FHIR builder exists unused for per-visit | P2 | `[NEEDS PRODUCT DECISION]` (interop target for V1?) | builders side-by-side | If interop deferred: document bespoke as canonical V1; else reuse fhir-bundle for per-visit |
| Test honesty | **GAP-8**: FE/E2E mount components directly + API-only E2E — masked GAP-1/2 entirely | P2 | V1 REQUIRED `[TEST GAP]` | 3 E2E specs API-only | Real journeys after GAP-1/2: complete visit → PMD button → viewer → export; import via UI |
| Care-record export | **GAP-7**: FHIR care-record orphan (early P2) | P3 | V2 DEFERRED | 0 consumers | Park |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| FHIR R4 care-record export (P2-18) | `exportPatientCareRecord.ts` + 7 tests | Spec-declared Phase-2, arrived early | Carrying cost | Keep; do not expand `[DO NOT OVERBUILD]` |
| Supersede chain (re-generation) | repo + tests | BR-021-adjacent | none | Keep |
| `getImportedPMD` parsed-content endpoint | wired to nothing | spec'd | none | wires with GAP-2 |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| WF-021 generate on completion | system | visit completed | snapshot → checksum → (sign) | **Dead — no trigger** | **GAP-1, GAP-4** | no completion call |
| View/share PMD (FR12.2/12.6) | dentist/patient | completed visit | open viewer → export/print | Built, unreachable | **GAP-2** | dead onPmd |
| WF-022 import at new clinic | dentist/staff | patient brings PMD | import → checksum validate → preview → store read-only | Implemented (UI behind dead button) | GAP-2 | `pmd-import.tsx` |
| Imported data protects patient (FR12.3) | system | import confirmed | add-only merge → safety floor shows imported allergies | **Missing** | **GAP-5** | 0 merge callers |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Generate trigger | auto on completion | Missing | GAP-1 | V1 REQUIRED | |
| Snapshot content | identity+floor+coded data | Partially Implemented | GAP-3 | V1 REQUIRED | |
| Checksum seal + immutability | sha256 + 405s | Implemented | AC pins | V1 REQUIRED | done |
| Facility signature | signed at generate | Missing (dead code) | GAP-4 | V1 RECOMMENDED | decision |
| Viewer reachability | top-bar button | Missing | GAP-2 | V1 REQUIRED | |
| Export download | JSON attachment | Implemented (unreachable) | exportPMD | V1 REQUIRED | rides GAP-2 |
| Import validation | checksum reject 422 | Implemented | importPMD :49-56 | V1 REQUIRED | done |
| Imported read-only | 405 | Implemented | BR-022 pins | V1 REQUIRED | done |
| Safety-floor merge | add-only w/ confirm | Missing | GAP-5 | V1 REQUIRED | |
| Print/QR/NFC | Phase-2 | Not Required for V1 | spec | V2 DEFERRED | |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Patient leaves with their record | dentist | PMD auto-created + exportable | Missing | GAP-1/2 | V1 REQUIRED | dead chain |
| New clinic reads incoming PMD | dentist | import + preview | Implemented (unreachable) | GAP-2 | V1 REQUIRED | |
| Imported allergy protects patient | system | floor shows imported data | Missing | GAP-5 | V1 REQUIRED | |
| Verify document integrity | recipient | checksum validation | Implemented | No | V1 REQUIRED | tests |
| Prove document origin | recipient | facility signature | Missing | GAP-4 | V1 RECOMMENDED | dead code |
| Whole-patient FHIR export | system/EMR | care-record bundle | Built (early P2) | GAP-7 | V2 DEFERRED | 0 consumers |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| GAP-1 no generation trigger | lifecycle | P1 | V1 REQUIRED | 0 consumers + no auto path | The portability promise produces zero documents in production | Wire WF-021 (likely auto-on-complete; or explicit action) |
| GAP-2 dead onPmd | FE affordance | P1 | V1 REQUIRED | top-bar JSX | Viewer/import/export all unreachable | Render button (1-line class) + honest E2E |
| GAP-5 inert imports | clinical safety | P1 | V1 REQUIRED | 0 merge callers | Imported allergies don't protect patients — safety-feature fiction | Add-only merge with confirm step |
| GAP-3 thin snapshot | content/compliance | P1 | V1 REQUIRED | snapshot shape | Document omits exactly the safety data FR12.1 exists for | Extend via existing facades |
| GAP-4 signature theater | integrity claims | P1→P2 | V1 RECOMMENDED (decision) | dead `sign()`; misleading comments | Misrepresented non-repudiation is a trust/legal hazard | Sign-or-strip decision |
| GAP-8 false-green tests | test honesty | P2 | V1 REQUIRED `[TEST GAP]` | API-only E2E | Same masking class as lab-order; hid the whole dead chain | Real journeys with fixes |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Complete visit → PMD exists | auto-generated | Nothing happens | GAP-1 | P1 | backend: complete → PMD row |
| Open PMD from workspace | top-bar button → viewer | No button | GAP-2 | P1 | FE-unit button + E2E |
| Import allergy-bearing PMD → floor warns | merged add-only | flag stays false; floor unchanged | GAP-5 | P1 | integration: import+confirm → floor includes imported allergy |
| Recipient trusts "signed" document | signature verifies | signature always NULL; comments claim sealing | GAP-4 | P2 | decision-dependent |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `generatePMD`, `getPMDForVisit`, `listPMDs`, `exportPMD`, `listImportedPMDs`, `getImportedPMD` | API ×6, 0 FE consumers | spine + grep | whole chain dead | Wire via GAP-1/2 |
| `exportPatientCareRecord` | API, 0 consumers | same | early P2 | Park (GAP-7) |
| `pmd-document.repo.sign()` | dead backend method | 0 callers | misleading claims | GAP-4 |
| `imported-pmd.repo.markSafetyFloorMerged()` | dead backend method | 0 callers | inert imports | GAP-5 |
| `onPmd` prop | dead FE prop | top-bar | unreachable UI | GAP-2 |
| `PMDViewerSheet`/`pmd-viewer`/`pmd-import` components | built FE, unreachable | mounted `$patientId.tsx:565-570` | none once button lands | rides GAP-2 |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Checksum binds content+author pre-signature; validated on import (EF-PMD-001) | backend | generate :104 / import :27-56 | — | none (good) |
| Loose coupling by design: no DB FKs on visit/patient ids; no branch_id on imported_pmd (patient-derived access) | schema | schema files + V-PMD-006 | — | none (documented) |
| signature/signed_at columns permanently NULL | schema | GAP-4 | P2 | sign-or-strip |
| safety_floor_merged flag permanently 'false' (text-typed boolean) | schema | GAP-5 | P1 | merge step; consider boolean type during fix |
| Presigned-URL/multipart flow deferred (V-PMD-006) | API | reconciled docs | — | none |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Generate dentist-only; import dentist+staff_full; reads branch-role or patient-self | write/read guards | handlers + prior audit (107 assertions incl. cross-branch isolation) | — | none (verified) |
| Misleading non-repudiation comments | integrity claims | `generatePMD.ts:64-73` | P2 | GAP-4 |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Snapshot immutability + supersede chain | document history | BR-021 pins | — | none |
| Imported docs immutable (405) | external records | BR-022 pins | — | none |
| Imported clinical data never reaches the chart — silent safety gap | patient safety | GAP-5 | P1 | merge with explicit confirm (BR-022-compliant: original stays read-only; merge adds med-history entries) |

## 16. Knowledge Graph Findings

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| 7/8 ops zero-consumer; the 1 wired op (importPMD) sits behind unreachable UI | spine + grep | Module is a complete backend with no product surface | GAP-1/2 are the unlock |
| PMD pulls from visit via facade (correct direction); nothing pushes on completion | `visit-pmd.facade.ts` | confirms GAP-1 root cause | wire at completion path or explicit trigger |
| `WorkspaceTopBar` dead-prop class now ×2 (onLab clinical, onPmd here) | top-bar source | systemic pattern for prompt 05 | flag cross-cutting |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| PMD is the product's patient-ownership differentiator (PRD vision: record follows patient between PH clinics) | PRD §2/§6.12 | Entire differentiator currently undeliverable | top fix priority after money/clinical P1s |
| Paper-record culture: print summary matters in PH | FR12.6 | print deferred Phase-2 — acceptable | keep deferred |
| Cross-clinic trust needs signature story eventually | FR12.4 | pilot self-signed acceptable if honest | GAP-4 decision |

## 18. Webwright / Playwright Findings

Not used this round — unreachability proven statically. Inspection finding recorded:

| Finding | Tool | Evidence Location | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| All 3 PMD E2E specs drive APIs or mount components directly; none drives the top bar | Playwright (inspected) | `pmd-generation.spec.ts`, `pmd-import.spec.ts`, `safety-floor.spec.ts` | masked the dead chain | replace with real journeys post-fix |

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| 8 backend files (107 assertions) | backend | generate guards (422 non-completed), checksum, supersede, import immutability 405, RBAC, cross-branch isolation, events | High |
| `fhir-bundle.test.ts` (7) | backend | FHIR builder correctness | High |
| `dental-pmd.hurl` (26 req) | contract | generate + import happy paths | Medium (no signature/floor-content coverage) |
| FE `pmd-import.test.ts`, `pmd-viewer.test.ts` | frontend | components mounted directly (bypass dead button) | Low (wiring-blind) |
| E2E ×3 | E2E | API-only false-green | Low |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Visit completion → PMD row exists (trigger pin) | backend/integration | GAP-1 RED-first | Before |
| Top-bar renders PMD button | frontend/component | GAP-2 RED-first | Before |
| Snapshot contains safety floor + demographics + conditions | backend | GAP-3 content pin | Before |
| Import+confirm → med-history gains add-only entries → floor renders them; never deletes/overwrites | integration | GAP-5 RED-first (BR-022 boundary) | Before |
| Signature present+verifiable on generate (if Q2 = sign) | backend | GAP-4 | Post-decision |
| Real E2E: complete → button → viewer → export; UI import journey | E2E | GAP-8 replaces false-greens | During |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| Generation trigger sits in dental-visit completion path | cross-module `[CROSS-MODULE RISK]` | `updateDentalVisit.ts` | GAP-1 fix edits visit module | small, guarded insertion; coordinate with dental-visit owner |
| Snapshot content needs dental-patient safety-floor + dental-clinical med-history facades | cross-module `[SHARED DEPENDENCY]` | existing facades | GAP-3 reuses, not rebuilds | read-only facade consumption |
| Safety-floor merge writes med-history entries (clinical module) | cross-module | GAP-5 | merge must respect med-history append-only model | insert-only; confirm UI |
| `WorkspaceTopBar` shared shell (dead-prop class ×2) | shared/platform `[SHARED DEPENDENCY]` | onLab+onPmd | fix pattern once | bundle with clinical GAP-1 batch or prompt 05 |
| Signing cert/custodian identity (dental-org settings FR8.15) | cross-module + product decision | GAP-4 | pilot cert storage | decision first |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Auto-generate PMD in visit-completion path (guarded, idempotent per visit) | GAP-1 | P1 | V1 REQUIRED | backend RED | PRD-faithful default; confirm Q1 |
| Render PMD top-bar button | GAP-2 | P1 | V1 REQUIRED | FE RED + E2E | bundle with clinical Lab button (same component) |
| Extend snapshot content via facades | GAP-3 | P1 | V1 REQUIRED | content pin | |
| Add-only safety-floor merge w/ confirm UI | GAP-5 | P1 | V1 REQUIRED | integration RED | BR-022-compliant |
| Sign-or-strip signature decision + implementation | GAP-4 | P2 | V1 RECOMMENDED (decision) | backend | honest comments either way |
| Replace false-green E2Es with real journeys | GAP-8 | P2 | V1 REQUIRED | E2E | with GAP-1/2 |
| Per-visit FHIR adoption | GAP-6 | P2 | `[NEEDS PRODUCT DECISION]` | — | only if interop is V1 |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| QR/NFC/SMART Health Links sharing | V2 DEFERRED | PRD Phase-2 |
| Presigned-URL/multipart file flow | V2 DEFERRED | V-PMD-006 reconciled |
| Print/mail templates | V2 DEFERRED | FR12.6 Phase-2 |
| Production CA trust framework | V2 DEFERRED | pilot self-signed per spec |
| Multi-PMD longitudinal timeline | V2 DEFERRED | PRD Phase-2 |
| Care-record export expansion | DO NOT ADD `[DO NOT OVERBUILD]` | already early-P2; park |
| Conflict-resolution UI for merge duplicates | V2 DEFERRED | add-only merge suffices for V1 |

## 24. Audit Decision

**FAIL.**

Not for code quality — the backend is checksum-sealed, immutability-guarded, RBAC'd, and well-tested (107 assertions, 26 contract requests), and the FE viewer/import components exist. It fails because the module's core workflow is **entirely unreachable in the shipped product**: no code path ever creates a PMD (no auto-generate on completion, no FE trigger), the workspace button that would open the viewer/import/export surfaces was never rendered (dead `onPmd`), generated snapshots omit the safety data the document exists to carry, and imported documents never affect the safety floor — so the patient-protection and portability promises (FR12.1–12.5) are all undelivered. False-green API-only E2Es masked the whole chain. The fixes are mostly wiring onto tested backends plus two product decisions (signature scheme, FHIR target).

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Q1: Generation trigger — auto-on-complete (PRD-faithful) or explicit "Generate PMD" action? | `[NEEDS CONFIRMATION]` (PRD says auto; confirm perf/UX) | GAP-1 shape | Product |
| Q2: Signing — wire pilot self-signed now, or defer FR12.4 honestly (strip claims)? | `[NEEDS PRODUCT DECISION]` | GAP-4 | Product/Eng |
| Q3: Is canonical-PMD content (safety floor + demographics) confirmed for V1, vs MODULE_SPEC's narrowed snapshot framing? | `[NEEDS PRODUCT DECISION]` (PRD vs spec conflict) | GAP-3 scope | Product |
| Q4: FHIR per-visit for V1 or bespoke JSON canonical? | `[NEEDS PRODUCT DECISION]` | GAP-6 | Product |
| Q5: Safety-floor merge UX — confirm-per-entry or confirm-all? | `[NEEDS CONFIRMATION]` | GAP-5 shape | Product/Design |

## 26. Notes for Gap Plan Organizer

- **Truly V1 (mostly decision-free):** GAP-1 (trigger — confirm Q1 first, default auto), GAP-2 (button — bundle with dental-clinical Lab-button batch, same component), GAP-3 (content — Q3 bounds exact fields but floor+demographics are PRD-explicit), GAP-5 (merge), GAP-8 (honest E2E).
- **Likely batch shape:** Batch A = GAP-2 button + GAP-8 journey (with clinical top-bar batch); Batch B = GAP-1 trigger + completion pin; Batch C = GAP-3 content; Batch D = GAP-5 merge (+confirm UI); GAP-4 after Q2.
- **Blocked until decided:** GAP-4 (Q2), GAP-6 (Q4).
- **Must NOT implement:** §23 — no QR/NFC, no presigned flow, no CA framework, no care-record expansion.
- **Tests first:** completion→PMD pin; top-bar button pin; content-completeness pin; import-merge integration RED.
- **Cross-module:** completion-path edit (dental-visit), facades (patient/clinical), top-bar shared shell (dead-prop class ×2 — prompt 05 candidate), med-history append-only respected by merge.
- **Do not re-litigate:** checksum/immutability/supersede/RBAC/isolation — verified strong.

---

Next recommended step:
Module/group: Dental PMD
Module slug: dental-pmd
Primary PRD/spec: docs/prd/v3-dentalemon.md §6.12 + Appendix E + docs/product/modules/dental-pmd/
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/dental-pmd-gap-plan.md
