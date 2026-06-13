# AHA Fix-Ready Plan: Dental PMD (Portable Medical Document)

**Generated:** 2026-06-11 · **Prompt:** `docs/aha/prompts/03-organize-gap-plan-for-fixing.md` · **Branch:** `chore/workflow-verification-sweep`

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Dental PMD (Portable Medical Document) |
| Module slug | dental-pmd |
| Source gap plan | `docs/aha/module-gap-plans/dental-pmd-gap-plan.md` |
| Output file | `docs/aha/module-fix-plans/dental-pmd-fix-ready-plan.md` |
| Audit decision | FAIL (module unreachable end-to-end: no generation trigger, dead `onPmd`, thin snapshot, inert imports; backend itself well-tested) |
| Superpowers used | No — organizer discipline applied via shared rules (§19); no execution-agent assistance needed for sequencing |
| Organizer decision | PARTIALLY READY |
| Reason | Three of the five P1 gaps (GAP-1 trigger, GAP-3 content minimum, GAP-5 merge) are decision-free and fix-ready now with strong evidence. GAP-2 (button) is fix-ready but **owned by the dental-clinical batch** (orchestrator-assigned, WorkspaceTopBar dead-prop class fixed once for `onLab`+`onPmd`); GAP-8 honest E2E is partially blocked behind that cross-module batch. GAP-4 (sign-or-strip) and GAP-6 (FHIR target) are decision-blocked (Q2/Q4). |
| Limitations | No tests executed during organization. Source paths re-verified 2026-06-11 (see path correction in §12 notes: completion handler is `dental-visit/visits/updateDentalVisit.ts`, with `visits/` subdir — gap plan cited it without the subdir). Cross-referenced fix plans (`dental-clinical-fix-ready-plan.md`, `dental-org-fix-ready-plan.md`) may not exist yet; ownership is orchestrator-pre-decided regardless. |

## 2. Fix Strategy Summary

The module FAILed because it is a complete, well-tested backend with **no product surface and no creation path**. Strategy: P0-first wiring onto already-verified backends — do not touch checksum/immutability/supersede/RBAC internals (verified strong, "do not re-litigate" per gap plan §26).

- **Fix first:** Batch A — GAP-1 generation trigger (the FAIL root: zero PMDs can ever exist). PRD FR12.1 is explicit that generation is automatic on visit completion, so the trigger shape is treated as PRD-default (Q1 is a non-blocking confirmation). Then Batch B — GAP-3 snapshot content minimum (safety floor + demographics are PRD-explicit). Run A and B in the same `04` pass if possible so production never accumulates floor-less documents.
- **Then:** Batch C — GAP-5 add-only safety-floor merge (backend + confirm endpoint + confirm UI). Requires a small TypeSpec addition (no merge/confirm op exists today — verified `specs/api/src/modules/dental-pmd.tsp` has no merge route).
- **Then (after cross-module dependency):** Batch D — GAP-8 honest E2E journeys, which need both GAP-1 (this plan) and the PMD top-bar button (dental-clinical's batch).
- **Do not fix here:** GAP-2 (`onPmd` button) — **dental-clinical owns the single WorkspaceTopBar dead-prop batch** (`onLab` + `onPmd` together); see `docs/aha/module-fix-plans/dental-clinical-fix-ready-plan.md`. Duplicating it here would cause a merge collision on the same JSX block.
- **Blocked:** GAP-4 sign-or-strip (Q2 product decision; if "sign", the cert-settings UI also depends on dental-org's shared settings-shell batch — see `docs/aha/module-fix-plans/dental-org-fix-ready-plan.md`). GAP-6 FHIR-per-visit (Q4).
- **Major risks:** (1) Batch A edits the dental-visit completion path (cross-module, money/clinical-adjacent handler) — keep the insertion small, guarded, and idempotent; (2) Batch C writes med-history entries in dental-clinical — must be strictly insert-only (append-only model, BR-022); (3) Batch C changes the API contract (TypeSpec → codegen → SDK regen sequence required).
- **Shared/platform/database work:** no schema migrations strictly required (`safety_floor_merged` flag and `signature` columns already exist). Optional text→boolean type cleanup for `safety_floor_merged` is allowed during Batch C but not required. No new scheduler: generation is synchronous in the completion request path; if async generation is ever preferred, register a job on the **existing** scheduler at `services/api-ts/src/core/jobs.ts` — do not build scheduler infrastructure `[DO NOT OVERBUILD]`.
- **Pass shape:** multiple small batches (A → B → C now; D after cross-module; E after decision), not one pass.

## 3. Active Fix Scope

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | GAP-1: no generation trigger — nothing ever creates a PMD; auto-generate on visit completion (WF-021/FR12.1) unimplemented | P1 (FAIL root, P0-equivalent for this module) | V1 REQUIRED | Batch A | The portability promise produces zero documents in production; everything downstream is dead regardless of its own wiring | Gap plan §3.1/§5; orchestrator-verified: `generatePMD` 0 consumers + no PMD call in `services/api-ts/src/handlers/dental-visit/visits/updateDentalVisit.ts` (re-verified: `status === 'completed'` branch at :104 has no PMD call) |
| FIX-002 | GAP-3: snapshot omits safety floor + demographics + conditions/notes — contradicts FR12.1's explicit content list | P1 | V1 REQUIRED (PRD-explicit minimum: floor + demographics; exact extra fields bounded by Q3) | Batch B | Document omits exactly the safety data FR12.1 exists to carry; clinical-trust failure once PMDs become visible | `generatePMD.ts:75-101` (re-verified: snapshot = visitId/patientId/authorMemberId/visitDate/treatments/prescriptions only) |
| FIX-003 | GAP-5: imported safety data never merges — `markSafetyFloorMerged()` 0 callers, flag permanently `'false'`; imported penicillin allergy never protects the patient | P1 | V1 REQUIRED | Batch C | Safety-feature fiction; the clinical reason the import flow exists | `imported-pmd.repo.ts:45` 0 callers; `importPMD.ts` stores `safetyFloorMerged:'false'`; no merge op in `dental-pmd.tsp` (verified) |
| FIX-004 | GAP-8: false-green tests — all 3 PMD E2E specs are API-only/mount-direct; masked the entire dead chain | P2 | V1 REQUIRED `[TEST GAP]` | Batch D | Without honest journeys the same masking class will hide regressions of FIX-001/GAP-2 | `apps/dentalemon/tests/e2e/pmd-generation.spec.ts`, `pmd-import.spec.ts`, `safety-floor.spec.ts` (gap plan §18) |
| FIX-005 | GAP-4: signature dead code + misleading non-repudiation comments (`sign()` 0 callers; signature always NULL) | P1→P2 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` (Q2 sign-or-strip) | Batch E (blocked) | Misrepresented non-repudiation is a trust/legal hazard; but the fix shape (wire pilot signing vs strip claims) is a product choice | `pmd-document.repo.ts:59` 0 callers; misleading comments `generatePMD.ts:64-73` |

Not in active scope but encoded as cross-module dependency (no local Fix ID — do not duplicate):

| Ref | Gap | Owner | Cross-Reference |
| --- | --- | --- | --- |
| XMOD-TOPBAR | GAP-2: dead `onPmd` prop — viewer/import/export UI unreachable (`workspace-top-bar.tsx:25,91` declares; icon block renders no PMD button; handler already passed at `routes/_workspace/$patientId.tsx:301`) | **dental-clinical** owns the single WorkspaceTopBar dead-prop batch (`onLab` + `onPmd` fixed together) | `docs/aha/module-fix-plans/dental-clinical-fix-ready-plan.md` |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| Batch A — generation trigger | Wire idempotent auto-generate on visit completion (PRD default); backend completion→PMD pin first | FIX-001 | Medium — edits dental-visit completion handler (cross-module); must be guarded so PMD failure does not break visit completion, and idempotent (re-complete / supersede semantics) | **Run first in current `04` pass** (Q1 is a confirmation, not a blocker — PRD says auto) |
| Batch B — snapshot content | Extend `generatePMD` snapshot with safety floor + demographics (+ conditions/notes minimum) via existing read-only facades | FIX-002 | Low — module-local; checksum logic unchanged (content string grows, sha256 still seals it) | Run in current `04` pass, immediately after Batch A (same pass preferred so no floor-less PMDs accumulate) |
| Batch C — safety-floor merge | Add-only merge of imported PMD safety data into med-history with explicit confirm step (BR-022-compliant: original stays read-only) | FIX-003 | Medium — new TypeSpec op + codegen + SDK regen; insert-only writes into dental-clinical med-history; confirm UI in `pmd-import.tsx` (UI reachable only after XMOD-TOPBAR lands, but backend + component tests do not wait) | Split into separate `04` pass after A+B |
| Batch D — honest E2E / test hardening | Replace API-only false-green E2Es with real journeys (complete visit → PMD button → viewer → export; UI import + merge) | FIX-004 | Low — test-only | **Requires shared/cross-module fix first**: run only after Batch A here AND dental-clinical's WorkspaceTopBar batch have landed |
| Batch E — sign-or-strip | Either wire pilot self-signed signing on generate, or strip signature/non-repudiation claims from comments and defer FR12.4 honestly | FIX-005 | Low–Medium (depends on direction) | **Requires product decision first (Q2)**; if "sign", cert-settings UI additionally depends on dental-org settings-shell batch (`dental-org-fix-ready-plan.md`) — do not run yet |

Do not combine Batch C's TypeSpec/contract change with Batch A's cross-module completion-path edit — separate risky changes.

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | Completion-trigger pin (RED first): PATCH visit → `completed` ⇒ `pmd_document` row exists for the visit; re-completing/re-triggering does not duplicate (idempotent or supersede per BR-021); PMD generation failure does not roll back/507 the visit completion | backend/integration | Visit completion actually produces a PMD; trigger is safe and idempotent | New: `services/api-ts/src/handlers/dental-pmd/pmd-generation-trigger.test.ts` (run via `scripts/test-with-db.ts`); plus 1 contract step in `specs/api/tests/contract/dental-pmd.hurl` (complete visit → GET `/{visitId}/pmd` 200) |
| FIX-002 | Content-completeness pin (RED first): generated snapshot JSON contains safety floor (allergies/meds/conditions) + patient demographics; checksum recomputes/validates over the extended content; import of an extended PMD still passes checksum validation | backend/unit + regression | Snapshot carries the FR12.1 content list; sealing semantics unbroken | Extend `services/api-ts/src/handlers/dental-pmd/dental-pmd.test.ts` |
| FIX-003 | Merge pin (RED first): import allergy-bearing PMD + confirm ⇒ med-history gains add-only entries; existing entries never deleted/overwritten; `safety_floor_merged` flips true; safety-floor read endpoint includes the imported allergy; second confirm is a no-op/409 | integration + permission (dentist/staff_full only) | Imported safety data actually protects the patient; BR-022 boundary (add-only, original read-only) held | New: `services/api-ts/src/handlers/dental-pmd/importPMD.safety-floor-merge.test.ts`; FE confirm-step component test extends `apps/dentalemon/src/features/pmd/components/pmd-import.test.ts` |
| FIX-004 | Real journey E2E replacing API-only specs: complete visit in UI → PMD button appears in top bar → viewer opens → export downloads; UI import journey → preview → confirm merge → floor shows imported allergy | E2E/Playwright | The wired product surface works end-to-end through the real top bar (kills the false-green class) | Rewrite `apps/dentalemon/tests/e2e/pmd-generation.spec.ts` + `pmd-import.spec.ts` (and the PMD assertions in `safety-floor.spec.ts`) to drive the rendered UI |
| FIX-005 | Post-decision: if "sign" — signature present + verifiable on generate, exposed in viewer; if "strip" — regression pin that no signature/non-repudiation claim remains in API responses/UI copy | backend/unit (+ FE copy check) | Integrity claims are honest either way | Decide Q2 first; location TBD with decision |

TDD sequencing rule for `04`: every batch starts with its RED pin above before any implementation.

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `services/api-ts/src/handlers/dental-visit/visits/updateDentalVisit.ts` (small guarded insertion in the `status → completed` branch ~:104); extract/reuse generation core from `services/api-ts/src/handlers/dental-pmd/generatePMD.ts` (callable function, not HTTP self-call); possibly a thin `visit→pmd` push seam alongside existing `visit-pmd.facade.ts` | cross-module | Medium — visit completion is a hot clinical path; PMD call must be failure-isolated. No TypeSpec change (existing POST stays for manual regen) |
| FIX-002 | `services/api-ts/src/handlers/dental-pmd/generatePMD.ts` (:75-101 snapshot builder); read-only consumption of existing facades `services/api-ts/src/handlers/patient/repos/patient-pmd.facade.ts` + `services/api-ts/src/handlers/dental-clinical/repos/clinical-pmd.facade.ts` (extend if a needed read is missing); viewer rendering of new fields in `apps/dentalemon/src/features/pmd/components/pmd-viewer.tsx` | module-local (facade reads cross-module but read-only) | Low — content jsonb column already schemaless; checksum logic untouched |
| FIX-003 | `specs/api/src/modules/dental-pmd.tsp` (new confirm-merge op, e.g. POST `/pmd/imported/{id}/merge`) → codegen (`specs/api` build, `services/api-ts` generate, SDK regen — separate step); new handler `services/api-ts/src/handlers/dental-pmd/mergeImportedPMDSafetyFloor.ts` (name per operationId); `imported-pmd.repo.ts` (`markSafetyFloorMerged` finally called); insert-only med-history writes via `clinical-pmd.facade.ts` (or a new same-module facade method); confirm UI in `apps/dentalemon/src/features/pmd/components/pmd-import.tsx` | cross-module + shared (API contract) | Medium — contract change touches spec/SDK; med-history writes must be append-only |
| FIX-004 | `apps/dentalemon/tests/e2e/pmd-generation.spec.ts`, `pmd-import.spec.ts`, `safety-floor.spec.ts`; possibly seed helpers for a completed-visit fixture | module-local (tests) | Low |
| FIX-005 | Decision-dependent: `pmd-document.repo.ts` (`sign()`), `generatePMD.ts` comments :64-73, viewer copy; if "sign" — cert storage panel mounts in dental-org settings shell (NOT built here) | module-local + cross-module (org settings shell) | Low–Medium |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-001 | cross-module `[CROSS-MODULE RISK]` | dental-visit completion path (`visits/updateDentalVisit.ts`) | Trigger lives in another module's handler; must be a small, guarded, failure-isolated insertion coordinated with dental-visit ownership | No — performed during the fix, but keep diff minimal |
| FIX-002 | cross-module `[SHARED DEPENDENCY]` | `patient-pmd.facade.ts` + `clinical-pmd.facade.ts` (safety floor, demographics, med-history reads) | Reuse, don't rebuild — facade pattern is the sanctioned cross-module read seam | No — facades already exist; extend read-only if needed |
| FIX-003 | shared/platform (API contract) | TypeSpec change + codegen + SDK regen (`@monobase/api-spec`, `packages/sdk-ts`) | New confirm-merge endpoint changes the wire contract; SDK regen is a separate step (known gotcha) | Yes — TypeSpec first within the batch (step 1 of the 10-step sequence) |
| FIX-003 | cross-module | dental-clinical med-history append-only model | Merge writes MUST be insert-only; never update/delete existing entries (BR-022) | No — constraint to honor during fix |
| FIX-004 | cross-module | **dental-clinical's WorkspaceTopBar batch** (XMOD-TOPBAR: `onLab` + `onPmd` rendered together) — `docs/aha/module-fix-plans/dental-clinical-fix-ready-plan.md` | Real journeys cannot drive a button that doesn't render; dental-clinical owns the one fix for the dead-prop class | **Yes** — Batch D waits for it (and for Batch A) |
| FIX-005 | product decision + cross-module | Q2 sign-or-strip; if "sign": cert custodian storage UI mounts in **dental-org's shared settings shell** — `docs/aha/module-fix-plans/dental-org-fix-ready-plan.md` | Decision gates direction; settings shell is owned elsewhere — do not build a standalone settings surface here | **Yes** — decision first; shell batch first if "sign" |
| (none) | database/schema | No migration required; `signature`/`signed_at`/`safety_floor_merged` columns exist. Optional: `safety_floor_merged` text→boolean cleanup during Batch C (gap plan §13) — allowed, not required | Avoids schema churn | No |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Q1: Trigger shape — auto-on-complete vs explicit "Generate PMD" action | `[NEEDS CONFIRMATION]` (non-blocking) | FIX-001 | PRD FR12.1/WF-021 explicitly says auto-generate on completion; only perf/UX confirmation outstanding | Proceed with PRD default (auto, idempotent, failure-isolated); flag in fix report for product sign-off |
| Q2: Signing — wire pilot self-signed now vs strip claims and defer FR12.4 honestly | `[NEEDS PRODUCT DECISION]` | FIX-005 | Determines whether Batch E implements signing or removes the misleading claims | Add to cross-module decision queue; either outcome is small — decide before Batch E |
| Q3: Exact V1 snapshot field set beyond the PRD-explicit minimum (floor + demographics) — PRD FR12.1 vs MODULE_SPEC's "narrowed snapshot" framing | `[NEEDS PRODUCT DECISION]` (bounds scope only) | FIX-002 | PRD/spec conflict on full content list; the floor+demographics minimum is decision-free | Implement PRD-explicit minimum now; record chosen field set in fix report; escalate the PRD-vs-spec conflict for reconciliation |
| Q4: FHIR per-visit for V1 vs bespoke JSON canonical (GAP-6) | `[NEEDS PRODUCT DECISION]` | (deferred — no Fix ID) | Interop target decision; FHIR builder exists but unused per-visit | Add to decision queue; if interop deferred, document bespoke JSON as canonical V1 |
| Q5: Merge UX — confirm-per-entry vs confirm-all | `[NEEDS CONFIRMATION]` (non-blocking) | FIX-003 | Shapes the confirm UI only; merge semantics (add-only, explicit confirm) are fixed by BR-022 | Default to single confirm with itemized preview list (simplest BR-022-compliant V1); per-entry granularity is V2 |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| GAP-2 PMD top-bar button (XMOD-TOPBAR) | `[SHARED DEPENDENCY]` cross-module ownership | Orchestrator assigned the WorkspaceTopBar dead-prop fix (onLab + onPmd) to dental-clinical's batch — duplicating here would collide on the same component | dental-clinical executes its WorkspaceTopBar batch (`docs/aha/module-fix-plans/dental-clinical-fix-ready-plan.md`); this plan's Batch D then becomes unblocked |
| FIX-004 Batch D (honest E2E) | `[TEST GAP]` + cross-module | Real journeys need the rendered button (above) and a generation trigger (Batch A) | Batch A complete + dental-clinical top-bar batch landed |
| FIX-005 Batch E (sign-or-strip) | `[NEEDS PRODUCT DECISION]` | Q2 unresolved; "sign" direction additionally needs cert storage UI in the shared settings shell | Q2 decided; if "sign": dental-org settings-shell batch (`docs/aha/module-fix-plans/dental-org-fix-ready-plan.md`) landed first |
| GAP-6 per-visit FHIR adoption | `[NEEDS PRODUCT DECISION]` | Q4 unresolved (interop target for V1?) | Q4 decided; if deferred, only a documentation note is needed (no code) |

## 10. Deferred Items

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| GAP-7 care-record FHIR export wiring | Gap plan §5 (P3) | V2 DEFERRED | Spec-declared Phase-2 arrived early; 0 consumers; park as-is |
| QR/NFC/SMART Health Links sharing | Gap plan §23 | V2 DEFERRED | PRD Phase-2 |
| Presigned-URL/multipart file flow | Gap plan §23 | V2 DEFERRED | V-PMD-006 reconciled deferral |
| Print/mail templates | Gap plan §23 | V2 DEFERRED | FR12.6 Phase-2 |
| Production CA trust framework | Gap plan §23 | V2 DEFERRED | Pilot self-signed acceptable per spec (pending Q2) |
| Multi-PMD longitudinal timeline | Gap plan §23 | V2 DEFERRED | PRD Phase-2 |
| Conflict-resolution UI for merge duplicates | Gap plan §23 | V2 DEFERRED | Add-only merge suffices for V1 |
| Per-entry merge confirmation granularity | Q5 | V2 DEFERRED | Confirm-all with itemized preview is the V1 default |
| `safety_floor_merged` text→boolean type migration | Gap plan §13 | `[DO NOT OVERBUILD]` unless trivially folded into Batch C | Cosmetic schema cleanup; only do it if Batch C already touches the column write path and the migration is zero-risk |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| Care-record export expansion | Gap plan §6/§23 | `[DO NOT OVERBUILD]` — already early-P2 with 0 consumers; expanding it adds carrying cost |
| New scheduler/cron framework for async PMD generation | (organizer guard) | A job scheduler already exists at `services/api-ts/src/core/jobs.ts`; trigger is synchronous in-path anyway. If async is ever chosen, register on the existing scheduler `[DO NOT OVERBUILD]` |
| Standalone PMD settings surface (cert panel, defaults) | FIX-005 adjunct | dental-org owns the shared settings shell; PMD cert panel mounts there only — never a parallel shell |
| Duplicate `onPmd` button fix in this module's pass | GAP-2 | Owned by dental-clinical's WorkspaceTopBar batch; duplicating risks conflicting edits to the same icon block |
| Re-work of checksum/immutability/supersede/RBAC/cross-branch isolation | Gap plan §26 | Verified strong (107 assertions, AC pins) — do not re-litigate |
| HTTP self-call from visit handler to the PMD endpoint | FIX-001 shape | Reuse the generation core as an in-process function; an internal HTTP hop adds failure modes for nothing |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | The module was built pull-direction only (`visit-pmd.facade.ts` exposes visit data *to* PMD); nothing was ever wired push-direction at completion. Wiring the trigger fixes the actual missing link, not a symptom. **Path correction vs gap plan:** completion handler is `services/api-ts/src/handlers/dental-visit/visits/updateDentalVisit.ts` (gap plan cited it without the `visits/` subdir); absence of any PMD call re-verified there 2026-06-11 |
| FIX-002 | Root cause | Snapshot builder simply never queried floor/demographics; facades to do so already exist (`patient-pmd.facade.ts`, `clinical-pmd.facade.ts` — verified present) |
| FIX-003 | Root cause | Merge infrastructure (flag + repo method) was built but the merge operation itself (endpoint + writes + confirm) was never implemented; verified no merge op exists in `dental-pmd.tsp` |
| FIX-004 | Root cause (of the masking, not the gaps) | API-only/mount-direct test style is the platform's known false-green wiring class (same as lab-order); honest journeys are the structural cure |
| FIX-005 | Symptom-vs-root depends on Q2 | "Strip" fixes the honesty symptom and defers the capability; "sign" fixes the capability. Either is acceptable post-decision; what is NOT acceptable is leaving the misleading non-repudiation comments as-is |
| XMOD-TOPBAR | Root cause (owned elsewhere) | Dead-prop class at the shared WorkspaceTopBar seam (×2: onLab, onPmd) — single root fixed once in dental-clinical's batch; prompt-05 cross-cutting candidate already flagged |

## 13. Recommended First Fix Batch

**Batch A — generation trigger (FIX-001).**

- **Included Fix IDs:** FIX-001 (recommend executing Batch B / FIX-002 in the same `04` pass immediately after, so auto-generated PMDs are never floor-less in production).
- **Why first:** It is the FAIL root — with zero PMDs creatable, every other fix (content, merge visibility, E2E) has nothing to operate on. It is decision-free (PRD FR12.1 explicitly mandates auto-generate on completion; Q1 is confirmation-only). It also unblocks half of Batch D.
- **Tests to write first (RED):**
  1. Backend integration pin: complete a visit (PATCH → `completed`) ⇒ `pmd_document` row exists for that visit (new `pmd-generation-trigger.test.ts`, run via `scripts/test-with-db.ts` with the `monobase_test` DATABASE_URL inline).
  2. Idempotency pin: re-trigger/re-complete does not duplicate (supersede semantics per BR-021 honored).
  3. Failure-isolation pin: PMD generation throwing does not fail the visit-completion response.
  4. Contract pin: 1 added Hurl step in `dental-pmd.hurl` (complete → GET `/{visitId}/pmd` → 200).
- **Explicit out-of-scope for Batch A:** the top-bar button (dental-clinical's batch), snapshot content extension (Batch B unless same pass), merge (Batch C), signing (Batch E), any TypeSpec change, any new scheduler, E2E rewrites (Batch D).

## 14. Instructions for 04 Fix Prompt

- **Module/group name:** Dental PMD (Portable Medical Document)
- **Module slug:** `dental-pmd`
- **Fix-ready plan path:** `docs/aha/module-fix-plans/dental-pmd-fix-ready-plan.md`
- **Batch to execute first:** Batch A (FIX-001 generation trigger); Batch B (FIX-002 content) may run in the same pass immediately after if gates stay green.
- **Tests to prioritize:** the RED pins in §13 (completion→PMD row, idempotency, failure isolation, Hurl step); then §5 FIX-002 content-completeness pin if Batch B is included.
- **Files likely to touch:** `services/api-ts/src/handlers/dental-visit/visits/updateDentalVisit.ts` (small guarded insertion only), `services/api-ts/src/handlers/dental-pmd/generatePMD.ts` (extract reusable generation core; Batch B: snapshot builder :75-101), facades `patient-pmd.facade.ts` / `clinical-pmd.facade.ts` (read-only), `specs/api/tests/contract/dental-pmd.hurl`.
- **Shared/database cautions:** keep the dental-visit diff minimal, guarded, and failure-isolated (cross-module hot path); no schema migration needed for A/B; Batch C (later) requires TypeSpec → codegen → SDK regen sequence and strictly insert-only med-history writes; never run server/contract/E2E against `monobase_test`; restart the API on :7213 before contract tests; `db:generate` only from `services/api-ts` cwd.
- **Do NOT implement:** the `onPmd`/WorkspaceTopBar button (dental-clinical owns it — `docs/aha/module-fix-plans/dental-clinical-fix-ready-plan.md`); any settings shell (dental-org owns it — `docs/aha/module-fix-plans/dental-org-fix-ready-plan.md`); FIX-005 signing (Q2 undecided); GAP-6 FHIR per-visit (Q4 undecided); anything in §10/§11 (QR/NFC, presigned flow, print, CA framework, timeline, care-record expansion, new scheduler); no re-work of checksum/immutability/supersede/RBAC.

---

Next recommended step:
Module/group: Dental PMD (Portable Medical Document)
Module slug: dental-pmd
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/dental-pmd-fix-ready-plan.md
Recommended batch: Batch A — generation trigger (FIX-001), with Batch B (FIX-002 snapshot content) in the same pass if gates stay green
