# AHA Fix-Ready Plan: Case Presentation

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/03-organize-gap-plan-for-fixing.md`

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Case Presentation (present plan → patient e-sign → accept/reject) — Cross-Module Journey |
| Module slug | case-presentation |
| Source gap plan | `docs/aha/module-gap-plans/case-presentation-gap-plan.md` |
| Output file | `docs/aha/module-fix-plans/case-presentation-fix-ready-plan.md` |
| Audit decision | PASS |
| Superpowers used | No — organizer discipline applied via shared rules (`/using-superpowers` available but not needed for a plan this small) |
| Organizer decision | READY |
| Reason | Audit decision was PASS: the core journey works end-to-end with multi-layer pins. Remaining work is deliberately small — one E2E regression pin (GAP-2), one shared read-back viewer this module owns for the platform (GAP-1, cross-listed with dental-visit GAP-3), one doc-only spec anchor (GAP-5). One item (GAP-3 printable estimate) is blocked on a confirmation plus the billing-owned shared print utility. No P0/P1 items exist. Plan intentionally kept small — do not inflate. |
| Limitations | No tests executed during organization. The dental-visit and dental-billing fix-ready plans referenced below are not yet generated (module-fix-plans/ was empty at organize time); cross-references are forward-looking and binding per orchestrator bundle-ownership decisions. |

## 2. Fix Strategy Summary

- **What to fix first:** Batch A — the Playwright journey pin for present → sign → accept (+ reject leg). It is independent, cheap, decision-free, and protects the historically-broken flow before any further FE work touches it.
- **Then:** Batch B — the shared accepted-plan viewer. **Case-presentation OWNS this build** (orchestrator decision): one read-only viewer rendering the immutable plan-version snapshot + signature + signer + timestamp closes this module's GAP-1 **and** dental-visit's GAP-3. Dental-visit only does consumption wiring afterward (lives in `docs/aha/module-fix-plans/dental-visit-fix-ready-plan.md`, dependent on Batch B landing first).
- **Anytime (low priority):** Batch C — thin MODULE_SPEC authoring (doc-only; also resolves Q3 and documents GAP-6 GET-write telemetry as intentional).
- **What not to fix:** anything in §11 (public patient link, image overlay, new FSM states, removing GET-write telemetry). Do not re-litigate G1/G2/G3/FE-1 — all source-verified fixed with regression pins.
- **Major risks:** low overall. Batch B touches the workspace plans sheet (high-traffic surface) and reuses the frozen dental-clinical consent facade read-only; keep the viewer strictly read-only.
- **One pass or multiple:** two small `04` passes (A then B) or one combined pass if Batch A is green first; Batch C can ride along with either.
- **Shared/platform/database work:** none required for active batches. No backend or schema changes — `getTreatmentPlanVersion` and `getCasePresentation` already exist in the generated SDK (`packages/sdk-ts/src/generated/sdk.gen.ts`); the viewer is FE-only wiring of write-only data.
- **Blockers:** GAP-3 (printable estimate) is blocked by Q1 `[NEEDS CONFIRMATION]` and by the dental-billing-owned shared print utility batch. Do not build a second print utility here.

## 3. Active Fix Scope

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | GAP-2: no Playwright journey for present → sign → accept; the platform's once-only-FAIL flow is unpinned at browser level (J08 covers a different affordance: treatment-item decline) | P2 | V1 REQUIRED `[TEST GAP]` | Batch A | Cheap, independent, high-value regression protection for the revenue-conversion flow | Gap plan §5/§10/§20; live-verified-only at browser layer; `tests/e2e/journeys/` has 18 journeys, none for this flow |
| FIX-002 | GAP-1: signed-acceptance read-back absent — `signatureData` (stored ×3) and `planVersionId` are write-only; the legal artifact is invisible after the moment of signing | P2 | V1 REQUIRED `[CROSS-MODULE RISK]` | Batch B | E-sign's whole value is later proof; closes dental-visit GAP-3 with the same component (orchestrator: case-presentation owns the build) | Gap plan §5/§12/§15; `getTreatmentPlanVersion` FE consumers = 0 (visit gap plan §12); schema `planVersionId` write-only |
| FIX-003 | GAP-3: FR1.22 print/email cost estimate not found in the feature | P2 | V1 RECOMMENDED `[NEEDS CONFIRMATION]` | Blocked (see §9) | Listed for traceability only — NOT executable now: needs Q1 confirmation + billing-owned shared print utility | Gap plan §5/§10; PRD FR1.22 (`docs/prd/v3-dentalemon.md:351`) |
| FIX-004 | GAP-5: no case-presentation MODULE_SPEC; approval/accept verb pair, option-acceptance ownership (Q3), and GAP-6 telemetry only documented inside dental-patient spec | P3 | V1 RECOMMENDED `[BLOCKED BY MISSING SPEC]` (the fix IS authoring the spec) | Batch C | Doc-only, zero code risk; removes the `[INFERRED]` boundary noted in the audit index | Gap plan §5; audit index §17 ("No spec dir for: … case-presentation") |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| Batch A | Test hardening — browser journey pin for present→sign→accept + reject leg | FIX-001 | Low (test-only; no source changes) | Run in current `04` pass — FIRST |
| Batch B | Shared accepted-plan viewer (read-only: version snapshot + signature + signer + timestamp), entry from plans sheet / presentation history | FIX-002 | Low-Medium (touches workspace plans sheet; FE-only; read-only) | Run in current or next `04` pass, after Batch A. Cross-module note: dental-visit consumes this — its wiring batch must wait for Batch B (cross-ref `docs/aha/module-fix-plans/dental-visit-fix-ready-plan.md`) |
| Batch C | Doc-only thin MODULE_SPEC (boundary, FSM slice, approval/accept verbs, option ownership per Q3, GAP-6 telemetry note) | FIX-004 | None (docs) | Anytime; may ride along with A or B |
| Blocked | Printable estimate | FIX-003 | — | Do not run yet: requires Q1 confirmation first AND the dental-billing shared print utility batch landing first (cross-ref `docs/aha/module-fix-plans/dental-billing-fix-ready-plan.md`) |

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | The journey spec itself (the fix IS the test): present plan → patient view renders ₱ phases → sign → accept → plan shows approved badge; second leg: reject with reason → rejected terminal | E2E/Playwright | Browser-level regression pin of the once-FAIL flow against real API + seed (seed already has 4 plans across the FSM — reuse, don't reseed) | New: `apps/dentalemon/tests/e2e/journeys/19-case-presentation-accept.journey.spec.ts` (follow numbering/fixture pattern of `08-informed-refusal.journey.spec.ts`) |
| FIX-002 | RED-first component test: viewer renders immutable version snapshot (items/phases/totals), signature image, signer identity, acceptance timestamp; loading + error states | frontend/component | Write-only `planVersionId`/`signatureData` become renderable; data from `getTreatmentPlanVersion` + presentation/approval fields agree with what's shown | New: `apps/dentalemon/src/features/case-presentation/accepted-plan-viewer.test.tsx` (sibling to `case-presentation-view.test.tsx`, reuse its mock conventions) |
| FIX-002 (secondary) | Entry-point test: accepted plan in plans sheet exposes a "View signed acceptance" affordance that opens the viewer | frontend/component | The viewer is reachable from the real workflow, not orphaned | Extend existing plans-sheet tests near `apps/dentalemon/src/features/workspace/components/treatment-plans-sheet.tsx` |
| FIX-004 | None (doc-only) | — | — | — |

Notes: no backend tests needed — no backend changes. Do not add E2E for FIX-002 beyond optionally extending the FIX-001 journey with a final "open signed acceptance" step once both land (one journey, not two).

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | New `apps/dentalemon/tests/e2e/journeys/19-case-presentation-accept.journey.spec.ts`; possibly shared journey fixtures/helpers (read-only reuse) | module-local (test-only) | None to product code |
| FIX-002 | New `apps/dentalemon/src/features/case-presentation/accepted-plan-viewer.tsx` (+ test); wiring edits in `apps/dentalemon/src/features/workspace/components/treatment-plans-sheet.tsx` and/or `case-presentation-panel.tsx`; consumes existing SDK ops (`getTreatmentPlanVersion`, `getCasePresentation`) from `packages/sdk-ts/src/generated/sdk.gen.ts` — no SDK regen, no TypeSpec, no backend, no schema changes | cross-module (component owned here; dental-visit consumes; plans sheet is shared workspace surface) | Plans sheet UI + presentation panel; zero backend |
| FIX-004 | New `docs/product/modules/case-presentation/MODULE_SPEC.md` (thin) | module-local (docs) | None |
| FIX-003 (blocked) | (When unblocked) estimate print view reusing the billing-owned print utility; do NOT create a print utility here | cross-module | Deferred until prerequisites |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-002 | cross-module | dental-visit GAP-3 = same viewer. **Ownership decided: case-presentation builds it (this plan, Batch B); dental-visit only wires consumption afterward** (`docs/aha/module-fix-plans/dental-visit-fix-ready-plan.md`) | One viewer closes two audit items; prevents duplicate builds | No — this plan IS the prerequisite for the visit-side item |
| FIX-002 | cross-module | dental-clinical consent facade (`case-presentation-consent.facade.ts`) is frozen (V-CLN-010 hardened) | Viewer may read consent-form signature data; must be read-only reuse, no facade changes | No (constraint, not blocker) |
| FIX-002 | module-local | GAP-6: `getCasePresentation` writes viewed-telemetry on GET (documented-intentional) | Opening the viewer via this op bumps `lastViewedAt` — acceptable; do not "fix" it | No (awareness note) |
| FIX-003 | product decision | Q1: does the plans sheet already provide print/email estimate? | Determines whether GAP-3 is real | Yes |
| FIX-003 | cross-module | dental-billing owns the shared print/PDF utility (receipt first) — `docs/aha/module-fix-plans/dental-billing-fix-ready-plan.md` | Print pattern shared across receipt / patient statement / estimate; build once | Yes — billing batch must land first |
| FIX-001, FIX-004 | module-local | None | — | — |

No database/schema dependencies for any active fix.

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Q1: Does the plans sheet already cover print/email estimate (FR1.22)? | `[NEEDS CONFIRMATION]` | FIX-003 | Determines if GAP-3 is a real gap or already satisfied | Eng: 15-min grep/UI check during any `04` pass; if real, queue behind billing print-utility batch |
| Q2: Where should the accepted-plan viewer live (plans sheet vs presentation history)? | `[NEEDS CONFIRMATION]` (low-stakes; default provided) | FIX-002 | Entry-point placement | **Default per gap plan §16 KG finding: plans sheet entry, also reachable from presentation panel history.** Proceed with default unless product objects — do NOT block Batch B on this |
| Q3: Option-group acceptance ownership (case-presentation vs workspace treatment-options) | `[NEEDS CONFIRMATION]` | FIX-004 | Spec clarity only — code behavior already works | Resolve by documenting current behavior in the FIX-004 spec; no code change |

No `[NEEDS PRODUCT DECISION]` items — Q1–Q3 are eng/doc confirmations, not product choices requiring the cross-module decision queue.

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| FIX-003 printable estimate (GAP-3) | `[NEEDS CONFIRMATION]` + cross-module dependency | (1) Q1 unconfirmed — feature may already exist in plans sheet; (2) shared print/PDF utility is owned by dental-billing (receipt first) — building a second print path here is `[DO NOT OVERBUILD]` | Q1 answered; dental-billing print-utility batch (`docs/aha/module-fix-plans/dental-billing-fix-ready-plan.md`) landed |

## 10. Deferred Items

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Clickable annotated-image refs (overlay/presigned download) | GAP-4 | V2 DEFERRED | Prior-plan deferral stands; P3 polish, not workflow-blocking |
| Public patient link / portal presentation (P1-20 Phase 2) | §23 | V2 DEFERRED | Staff-session model explicitly declared for Phase 1 |
| Empty-aggregate presentation-state component test | §20 | V2 DEFERRED (P3 edge polish) | Edge polish; aggregate non-emptiness already pinned at backend+contract layers |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| Removing or "fixing" GET-write telemetry on `getCasePresentation` | GAP-6 | DO NOT ADD — documented-intentional; document in FIX-004 spec instead |
| New presentation FSM states | §23 | DO NOT ADD `[DO NOT OVERBUILD]` — terminal accept/reject suffices |
| A second print utility / print stylesheet in this module | GAP-3 | Duplicates the billing-owned shared print utility |
| Re-doing G1/G2/G3/FE-1 fixes or the accept side-effect chain | §3 | All source-verified fixed with RED-before regression pins — do not re-litigate |
| New backend endpoints/schema for the viewer | GAP-1 | Backend is already complete (`getTreatmentPlanVersion`, stored signature/approval data); this is FE wiring only |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | The flow was fixed and live-verified but never pinned at the browser layer; the missing journey IS the gap |
| FIX-002 | Root cause | Artifacts were built write-first for legal durability; the read path was simply never built (0 FE consumers of `getTreatmentPlanVersion`). Viewer is the genuine completion, not a patch |
| FIX-003 | Unclear `[NEEDS CONFIRMATION]` | May not be a gap at all (Q1) |
| FIX-004 | Root cause | Module grew as a cross-module journey without a spec anchor; thin spec closes the `[INFERRED]` boundary |

## 13. Recommended First Fix Batch

- **Batch name:** Batch A — journey pin
- **Included Fix IDs:** FIX-001
- **Why first:** zero product-code risk, no decisions, no dependencies; pins the historically-broken revenue-conversion flow at the browser layer before Batch B touches the plans sheet. Per gap plan §26 this is the intended first batch.
- **Tests to write first:** `apps/dentalemon/tests/e2e/journeys/19-case-presentation-accept.journey.spec.ts` — present → patient view renders ₱ phases → sign → accept → approved badge; plus reject-with-reason leg. The test is the entire deliverable.
- **Explicit out-of-scope:** the viewer (Batch B), estimate print (blocked), spec doc (Batch C), anything in §10/§11, any backend/seed changes (seed already has 4 plans across the FSM — reuse).

## 14. Instructions for 04 Fix Prompt

- **Module/group name:** Case Presentation
- **Module slug:** case-presentation
- **Fix-ready plan path:** `docs/aha/module-fix-plans/case-presentation-fix-ready-plan.md`
- **Execute first:** Batch A (FIX-001) — new journey spec `tests/e2e/journeys/19-case-presentation-accept.journey.spec.ts`, modeled on journey 08's fixture pattern. Then Batch B (FIX-002) in the same or a separate pass.
- **Tests to prioritize:** FIX-001 journey (is the fix); FIX-002 RED-first component test `accepted-plan-viewer.test.tsx` before implementing the viewer.
- **Files likely to touch:** Batch A — test files only. Batch B — new `apps/dentalemon/src/features/case-presentation/accepted-plan-viewer.tsx`, wiring in `apps/dentalemon/src/features/workspace/components/treatment-plans-sheet.tsx` and `case-presentation-panel.tsx`; SDK ops already generated.
- **Shared/database cautions:** no backend, TypeSpec, SDK-regen, or schema changes are needed or permitted for the active batches. Consent facade is frozen — read-only reuse. Viewer must be strictly read-only. Plans sheet is a shared workspace surface — keep edits additive. Dental-visit's GAP-3 wiring depends on Batch B landing; note it in the fix report so the visit `04` pass can proceed.
- **Do not implement:** FIX-003 (blocked on Q1 + billing print utility), any §10 deferred or §11 do-not-build item, any change to the accept/reject handlers, FSM, telemetry, or already-fixed G1/G2/G3/FE-1 areas.

---

Next recommended step:
Module/group: Case Presentation
Module slug: case-presentation
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/case-presentation-fix-ready-plan.md
Recommended batch: Batch A — journey pin (FIX-001)
