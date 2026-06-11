# AHA Module/Group Gap Plan: Case Presentation

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Case Presentation (present plan → patient e-sign → accept/reject) |
| Module slug | case-presentation |
| Type | Cross-Module Journey |
| Output file | `docs/aha/module-gap-plans/case-presentation-gap-plan.md` |
| Primary PRD/spec used | `docs/prd/v3-dentalemon.md` FR1.22 (treatment-plan presentation/acceptance) |
| Supporting PRDs/specs used | `docs/context/DENTALEMON-DENTAL-WORKSPACE-REFERENCE-SPEC.md` §13-15; BR-008, TP-BR-005, CR-05 (canonical approval); AC-TXPLAN-01/02; `docs/product/modules/dental-patient/MODULE_SPEC.md` §10 (approval vs accept verbs, P2-9 reconciliation); WORKFLOW_MAP cross-module flows. **No dedicated spec dir** — boundary `[INFERRED]` (known limitation, index §17) |
| PRD/spec coverage quality | Partial |
| Paths inspected | FE `apps/dentalemon/src/features/case-presentation/` (5 files) + route `_workspace/$patientId.case-presentation.$presentationId.tsx`; backend `handlers/dental-patient/case-presentation/` (5 handlers) + `repos/case-presentation.{schema,repo}.ts` + `dental-clinical/repos/case-presentation-consent.facade.ts` |
| PRDs/specs inspected | All above |
| KG used | Yes — spine: all 5 ops have FE consumers (verified) |
| KG refreshed | No |
| `/understand-domain` used | Yes (cross-check only) |
| `/understand-domain` refreshed | No |
| Webwright used | No — flow was live-verified 2026-06-09 (present→₱95K renders→e-sign→accept 200) and all claims this round are statically conclusive |
| Playwright/E2E inspected | Yes (inspected): J08 informed-refusal journey (treatment-item-level decline; distinct from whole-plan reject) — no dedicated case-presentation journey spec exists |
| Existing tests inspected | `case-presentation.test.ts` (8), `case-presentation-real-flow.test.ts` (3 RED-before), `dental-treatment-coordinator.hurl` §7-8b, `case-presentation-view.test.tsx` (8) |
| Cross-cutting audit reviewed | Not Available |
| Database/schema audit reviewed | Not Available |
| Limitations | No tests executed |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| PRD FR1.22 | `docs/prd/v3-dentalemon.md:351` | PRD | Current | aggregate plan, present, track Presented/Accepted/Declined, print/email estimate |
| Workspace ref spec §13-15 | `docs/context/` | workflow spec | Current | status ladder, carry-over seam |
| MODULE_SPEC (dental-patient) §10 + P2-9 | `docs/product/modules/dental-patient/MODULE_SPEC.md:99-141,231-232` | module spec | Current | `approval` (canonical, FSM-driving, CR-05) vs `accept` (sidecar snapshot) reconciliation; header-FSM-canonical decision 2026-06-10 |
| Prior gap plan + matrix Batch 1 | `docs/audits/module-gap-plans/case-presentation-gap-plan.md`, matrix §8 (711b4598) | prior audit (pre-AHA) | Superseded — G1(P0)/G2/G3 + FE-1 all verified fixed this round | §3 |
| AC-TXPLAN-01/02, BR-008, TP-BR-005 | prd docs | AC/BR | Current | plan view, carry-over display, completion derivation |

## 3. Expected vs Actual

**Expected (FR1.22 + CR-05):** dentist presents an aggregated, phased, costed plan on the operatory iPad; patient reviews options (P1-19 alternates with recommended badge), e-signs to accept (or rejects with reason); acceptance records who/how/against-which-snapshot, links pending treatments as plan items, and drives the plan header `presented → approved`.

**Actual: the journey works end-to-end and every prior gap that made this the platform's only FAIL is verified fixed in source:**

- **Wiring complete:** all 5 ops (create/list/get/accept/reject) have FE consumers; route mounts under workspace with the FE-1 `<Outlet/>` fix in place (`$patientId.tsx:253-254`).
- **G1 (P0) fixed:** treatments link at the `presented` transition (`updateTreatmentPlan.ts:73-78`) and idempotently again on accept (`acceptCasePresentation.ts:87`); aggregate non-empty pinned by RED-before test (`case-presentation-real-flow.test.ts:177-192`) + contract `phases>0` assert.
- **G3 (P1) fixed — approval convergence:** accept now writes the canonical `TreatmentPlanApproval` (`method='signature'`, consent id, planVersionId) and drives `presented → approved` with status-history row (`acceptCasePresentation.ts:106-132`); immutable already-signed consent form written via clinical facade; decision set with race-guarded immutability (`isNull(decision)` WHERE).
- **Audit:** `case_presentation.accepted` event with before/after snapshots (`:148-162`, Batch 2 family) — pinned.
- **G2 fixed:** seed has 4 plans across the FSM; "Present to patient" renders live.
- **Reject path wired:** reason popover → `presented → rejected` (terminal) + persisted reason.

Remaining items are small:

1. **Signature/snapshot read-back absent:** `signatureData` is stored in 3 places (presentation, consent form, approval) and `planVersionId` captured — but nothing renders a signed acceptance back (no viewer). This is the same artifact gap as dental-visit GAP-3 (plan-version viewer) — one viewer should satisfy both `[CROSS-MODULE RISK]`.
2. **No dedicated E2E journey spec** — the accept flow was live-verified manually and is multi-layer tested, but no Playwright journey pins it against regressions (J08 covers treatment-item decline, a different affordance).
3. **G4 (P3, deferred):** annotated-image refs render but aren't clickable (no overlay/presigned download).
4. **Print/email cost estimate (FR1.22)** not found — `[NEEDS CONFIRMATION]` whether the workspace plan sheet covers it; likely shares the print-pattern with billing receipt/patient statement.
5. **Doc debt:** no spec anchor; `getCasePresentation` writes telemetry on GET (documented-intentional); option-acceptance ownership (P1-19) ambiguity.

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR1.22 aggregate + present | phased costed plan, patient-facing | ✓ | `case-presentation-view.tsx:62-152` (phases, ₱, options, images) | aggregate handler | presentation schema | view tests (8) + hurl phases>0 | Implemented | No |
| FR1.22 status tracking | Presented/Accepted/Declined | ✓ FSM + decision terminal | view states | accept/reject handlers | decision col + plan FSM | real-flow tests | Implemented | No |
| CR-05 canonical approval | who/how/snapshot + FSM drive | ✓ (G3 convergence) | signature pad | `acceptCasePresentation.ts:106-132` | approval table | real-flow :212-231 | Implemented | No |
| E-sign capture | canvas → stored immutably | ✓ (stored ×3) | `signature-pad.tsx:75` | consent facade | signatureData cols | tests | Implemented | read-back **GAP-1** |
| Reject w/ reason | terminal + persisted | ✓ | popover :167-205 | reject handler :73 | rejectionReason | AC tests | Implemented | No |
| Option groups (P1-19) | alternates + recommended badge; accept-one | Display ✓; acceptance via `acceptTreatmentOption` (dental-patient, wired in workspace) | view options | option handlers | option tables | option-group tests | Implemented | ownership doc note (P3) |
| FR1.22 print/email estimate | cost-estimate artifact | Not found in feature | — | — | — | — | Unclear `[NEEDS CONFIRMATION]` | **GAP-3** |
| Accepted → carry-over feed (BR-008) | approved items later carried | Linkage ✓; carry-over trigger is dental-visit GAP-1 | — | linked treatmentPlanId | — | BR-008 tests | Implemented (boundary) | cross-ref |
| Audit on accept | sensitive-action event | ✓ | — | :148-162 | audit row | pin :235-253 | Implemented | No |
| Journey regression pin | browser-level proof | live-verified only | — | — | — | **no journey spec** | Implemented but Untested (browser layer) | **GAP-2** |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| Signed-acceptance read-back | **GAP-1**: signature + plan-version snapshot stored, never renderable — legal artifact invisible after the moment of signing | P2 | V1 REQUIRED `[CROSS-MODULE RISK]` (same viewer as dental-visit GAP-3) | no viewer; `planVersionId` write-only | One read-only "accepted plan" viewer (version snapshot + signature + signer + timestamp) reachable from plans sheet / presentation history |
| Journey protection | **GAP-2**: no Playwright journey for present→sign→accept (the platform's once-only-FAIL flow is unpinned at browser level) | P2 | V1 REQUIRED `[TEST GAP]` | live-verify only | Journey spec: present → patient view renders ₱ → sign → accept → plan approved badge |
| FR1.22 print/email estimate | **GAP-3**: cost-estimate artifact not found | P2 | V1 RECOMMENDED `[NEEDS CONFIRMATION]` | feature grep | Confirm whether plans-sheet covers it; if not, printable estimate (shares print pattern w/ billing receipt + patient statement batches) |
| Image refs | **GAP-4**: annotated-image refs not clickable (no overlay) | P3 | V2 DEFERRED (prior plan) | view :100-105 | defer |
| Spec anchor | **GAP-5**: no case-presentation MODULE_SPEC; approval/accept verb pair + option ownership only documented inside dental-patient spec | P3 | V1 RECOMMENDED `[BLOCKED BY MISSING SPEC]` | docs tree | author thin spec (boundary, FSM slice, verbs) |
| GET-write telemetry | **GAP-6**: `getCasePresentation` mutates viewed-status on GET (documented-intentional) | P3 | DO NOT ADD (keep; document in spec) | handler | note in GAP-5 spec |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| View-telemetry (firstViewedAt/lastViewedAt, draft→viewed) | get handler | inferred UX analytics | none | Keep but document |
| Dual-write of signatureData (presentation + consent + approval) | schema ×3 | redundancy for audit | none | Keep |
| Phased ₱ breakdown w/ PHASE_LABELS | view | PRD-consistent | none | Keep |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Present → review → e-sign accept | dentist+patient | plan ready | present (links items) → patient view → sign → accept (approval+consent+FSM+audit) | Implemented end-to-end | GAP-2 (pin) | real-flow tests + live verify |
| Present → reject | patient | declines | reason → rejected terminal | Implemented | No | AC tests |
| Show patient what they signed (later) | dentist/patient | dispute/follow-up | open accepted snapshot + signature | Missing | **GAP-1** | write-only artifacts |
| Hand estimate to patient (paper) | staff | consultation | print/email estimate | Unclear | **GAP-3** | not found |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Present transition links items | non-empty aggregate | Implemented | `updateTreatmentPlan.ts:73-78` | V1 REQUIRED | done (G1) |
| Patient full-screen view | phases/options/images | Implemented | route + view | V1 REQUIRED | done |
| E-sign + accept side-effects | approval+consent+FSM+audit, race-guarded | Implemented | accept handler walk | V1 REQUIRED | done (G3) |
| Reject terminal + reason | persisted | Implemented | reject handler | V1 REQUIRED | done |
| Read-back of signed artifact | viewer | Missing | GAP-1 | V1 REQUIRED | |
| Browser journey pin | E2E | Missing | GAP-2 | V1 REQUIRED | test |
| Print/email estimate | artifact | Unclear | GAP-3 | V1 RECOMMENDED | confirm |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Present ₱95K plan chairside | dentist | 2-tap present → patient view | Implemented | No | V1 REQUIRED | live verify |
| Patient accepts w/ signature | patient | sign → approved | Implemented | No | V1 REQUIRED | tests |
| Patient declines whole plan | patient | reason → rejected | Implemented | No | V1 REQUIRED | tests |
| Compare alternates (implant vs bridge) | patient | options + recommended | Implemented | No | V1 REQUIRED | view tests |
| Review signed acceptance next month | dentist | open snapshot+signature | Missing | GAP-1 | V1 REQUIRED | |
| Take estimate home | patient | print/email | Unclear | GAP-3 | V1 RECOMMENDED | |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| GAP-1 signed-artifact read-back | legal/trust | P2 | V1 REQUIRED | write-only signature/version | E-sign's whole value is later proof; today the proof is DB-only | shared viewer w/ dental-visit GAP-3 |
| GAP-2 journey pin | test protection | P2 | V1 REQUIRED `[TEST GAP]` | no spec | The historically-broken flow deserves a browser pin | journey spec |
| GAP-3 estimate artifact | FE affordance | P2 | V1 RECOMMENDED `[NC]` | not found | PH consult ritual (take-home estimate) | confirm then print view |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| "Show me what I signed" | viewer | nothing renders artifacts | GAP-1 | P2 | viewer FE-unit |
| Regression of present→accept | pinned | only unit/contract/live layers | GAP-2 | P2 | journey |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `planVersionId` / `signatureData` stored, never read | write-only data | schema + grep | GAP-1 | wire viewer |
| (none else — all 5 ops consumed) | — | spine | — | — |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Decision immutability race-guarded (`isNull(decision)` WHERE) | backend | repo decide() | — | none (good) |
| Loose planVersionId ref (no FK) — append-only audit datum | schema | schema :50 | — | none (documented design) |
| Idempotent re-linking on accept (convergence with approval path) | backend | :87 | — | none |
| GET-write telemetry | API | get handler | P3 | document (GAP-6) |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Role-gating pinned (dentist/coordinator/FD accept-reject; scheduler 403) | write guards | AC tests (E1) | — | none |
| Archived-patient block on create | guards | AC tests | — | none |
| Staff-session model (no public token; staff hands device) — P1-20 Phase-1 declared | auth model | panel :4-40 | — | none (Phase-2 public link deferred) |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Acceptance = immutable consent + approval + status-history + audit event | informed-consent chain | accept walk | — | none — strong |
| Rejection reason persisted, terminal | refusal record | reject handler | — | none |
| Artifacts unviewable post-hoc | proof availability | GAP-1 | P2 | viewer |

## 16. Knowledge Graph Findings

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| 5/5 ops consumed — only fully-wired audited module so far | spine | journey healthy | none |
| Handlers live inside dental-patient; consent facade in dental-clinical — 3-module seam | paths | GAP-1 viewer must pick one home | coordinate (plans sheet) |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Case acceptance is the conversion moment of the PH practice (₱60k+ plans) | PRD personas | flow health = revenue | keep pinned (GAP-2) |
| Take-home estimate is normal consult etiquette | personas | GAP-3 worth confirming | confirm |

## 18. Webwright / Playwright Findings

Not used — flow live-verified 2026-06-09 (recorded in prior audit artifacts); nothing new to drive. No evidence saved.

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `case-presentation.test.ts` (8: AC1-8) | backend | CRUD, telemetry, FSM guards, roles, archived block | High |
| `case-presentation-real-flow.test.ts` (3, RED-before) | backend/integration | G1 linking, G3 approval convergence, audit pin | High |
| `dental-treatment-coordinator.hurl` §7-8b | contract | present→aggregate(phases>0)→accept 200 | High |
| `case-presentation-view.test.tsx` (8) | frontend | phases/₱/alternates/images/USD-leak regression | High |
| J08 journey | E2E | treatment-item decline (adjacent affordance) | Medium |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Present→sign→accept browser journey | E2E/Playwright | GAP-2 — pin the once-FAIL flow | Anytime (independent) |
| Signed-artifact viewer renders version+signature | frontend/component | GAP-1 RED-first | Before |
| Empty-aggregate presentation state (0-item guard UX) | frontend/component | edge polish | Anytime (P3) |
| Reject-path journey leg | E2E | completeness | With GAP-2 |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| Viewer shared with dental-visit GAP-3 (plan versions) | cross-module `[CROSS-MODULE RISK]` | both write-only today | one viewer, two audit items closed | single batch across plans-sheet |
| Consent facade (dental-clinical) frozen | cross-module | facade | gate semantics hardened (V-CLN-010) | read-only reuse |
| Print pattern shared (billing receipt, patient statement, estimate) | shared/platform | 3 plans now reference it | build print stylesheet/util once | sequence with billing GAP-4 batch |
| Carry-over of approved items | cross-module | dental-visit GAP-1 | journey continuation | owned there |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Accepted-plan viewer (version snapshot + signature + signer/timestamp) | GAP-1 (+ visit GAP-3) | P2 | V1 REQUIRED | FE RED | one viewer, two modules satisfied |
| Case-presentation journey spec | GAP-2 | P2 | V1 REQUIRED | E2E | independent |
| Printable estimate (post-confirmation) | GAP-3 | P2 | V1 RECOMMENDED | FE | shared print util |
| Thin MODULE_SPEC authoring | GAP-5 | P3 | V1 RECOMMENDED | none | includes GAP-6 note + option ownership |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Public patient link / portal presentation (P1-20 Phase 2) | V2 DEFERRED | staff-session model declared for Phase 1 |
| Clickable annotated-image overlay (G4) | V2 DEFERRED | prior plan deferral stands |
| Removing GET-write telemetry | DO NOT ADD | documented-intentional |
| New presentation FSM states | DO NOT ADD `[DO NOT OVERBUILD]` | terminal accept/reject suffices |

## 24. Audit Decision

**PASS.**

The journey that was the platform's only FAIL is now its cleanest module: every operation is wired end-to-end, the P0 linking bug and the approval-path divergence are fixed with RED-before regression pins, acceptance produces the full legal chain (immutable consent + canonical approval + status history + audit event) race-guarded, rejection persists reasons, seeds are coherent, and the flow was live-verified. No material V1 workflow gap remains **within the module's own boundary** — the two P2 items (signed-artifact read-back, which is the shared plan-version viewer owned jointly with dental-visit, and the missing browser journey pin) are tracked here for the organizer but don't break the deliverable workflow.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Q1: Does the plans sheet already provide a print/email estimate (FR1.22), or is GAP-3 real? | `[NEEDS CONFIRMATION]` | GAP-3 | Eng |
| Q2: Where should the accepted-plan viewer live (plans sheet vs presentation history)? | `[NEEDS CONFIRMATION]` | GAP-1 shape | Product/Design |
| Q3: Option-group acceptance ownership (case-presentation vs workspace treatment-options) — document which | `[NEEDS CONFIRMATION]` | spec clarity (GAP-5) | Eng |

## 26. Notes for Gap Plan Organizer

- **Truly V1:** GAP-1 (viewer — merge with dental-visit GAP-3 into ONE batch), GAP-2 (journey spec — independent, cheap, high-value).
- **Likely batch shape:** Batch A = journey spec; Batch B = shared accepted-plan viewer (cross-listed with dental-visit plan); GAP-3 after Q1; GAP-5 spec doc anytime.
- **Blocked until confirmed:** GAP-3 (Q1).
- **Must NOT implement:** public link, image overlay, new FSM states.
- **Cross-module:** viewer = dental-visit GAP-3; print util shared with billing GAP-4 + patient GAP-2; consent facade frozen.
- **Do not re-litigate:** G1/G2/G3/FE-1 fixes (all source-verified with pins), accept side-effect chain, role gates.

---

Next recommended step:
Module/group: Case Presentation
Module slug: case-presentation
Primary PRD/spec: PRD FR1.22 + dental-patient MODULE_SPEC §10 (P2-9)
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/case-presentation-gap-plan.md
