# AHA Module/Group Gap Plan: Dental Clinical

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

> **Erratum (2026-06-11, dental-org audit round):** §25 Q4 states the consent-template editor (FR8.4b) has "no backend". **Wrong** — full owner-only CRUD exists in dental-org (`services/api-ts/src/handlers/dental-org/consentTemplates.ts`, routes `GET/POST/PATCH/DELETE /dental/branches/{branchId}/consent-templates`, `consent-template.schema.ts`), with zero FE consumers; `consent-sheet.tsx` hardcodes a `CONSENT_TEMPLATES` const instead. Q4 reduces from "is this a hidden V1 build item?" to a **wiring task** — see dental-org gap plan GAP-2 (joint batch).

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Dental Clinical |
| Module slug | dental-clinical |
| Type | Business Module |
| Output file | `docs/aha/module-gap-plans/dental-clinical-gap-plan.md` |
| Primary PRD/spec used | `docs/prd/v3-dentalemon.md` §6.1 (FR1.12 Rx, FR1.13 consent, FR1.16 compliance, FR1.21 attachments, FR1.24 lab) + §6.2 (FR2.14 med-history, FR2.15 safety floor) |
| Supporting PRDs/specs used | `docs/prd/BUSINESS_RULES.md` BR-003/014/017/018/019; `docs/prd/ACCEPTANCE_CRITERIA.md` AC-MED/AC-RX/AC-PRES/AC-LAB/AC-ATTACH/AC-CLI; `docs/product/modules/dental-clinical/MODULE_SPEC.md` + `API_CONTRACTS.md`; `docs/product/WORKFLOW_MAP.md` WF-016/017/018/035/036/037/038/039/063 |
| PRD/spec coverage quality | Strong (with known spec-behind-impl areas — MODULE_SPEC §10b lists 6 shipped-but-undocumented surfaces) |
| Paths inspected | `services/api-ts/src/handlers/dental-clinical/` (33 ops across 9 sub-domains, 11 schemas, 9 facades, 32 test files); `apps/dentalemon/src/features/workspace/components/` (8 clinical sheets + top bar); `specs/api/tests/contract/dental-clinical.hurl`; `apps/dentalemon/tests/e2e/` clinical specs |
| PRDs/specs inspected | All above; 84-item requirement checklist extracted before code comparison |
| KG used | Yes — `contract-spine.json` (2026-06-10) for consumer mapping; all 16 zero-consumer claims grep-verified in `apps/dentalemon/src` |
| KG refreshed | No (per `docs/aha/kg/knowledge-graph-status.md`) |
| `/understand-domain` used | Yes (cross-check only) |
| `/understand-domain` refreshed | No |
| Webwright used | No — every gap claim is statically provable (prop never rendered, op zero-consumer); the wired sheets were live-driven in the ≤3-day-old prior audits |
| Playwright/E2E inspected | Yes (inspected, not run): `consent-signing.spec.ts`, `lab-order-tracking.spec.ts`, `clinical-billing-handoff.spec.ts`, `workspace-readonly.spec.ts` |
| Existing tests inspected | 32 backend files (~7.7K LOC), `dental-clinical.hurl`, ~60 workspace FE test files, 4 E2E specs |
| Cross-cutting audit reviewed | Not Available (prompt 05 not yet run) |
| Database/schema audit reviewed | Not Available (prompt 06 not yet run) |
| Limitations | No tests executed (audit-only); prior fixes (V-CLN-010, G10) source-verified at key lines, not re-proven via test runs |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| v3 PRD §6.1/§6.2 | `docs/prd/v3-dentalemon.md` | PRD | Current | FR1.12/13/16/21/24, FR2.14/15: Rx, consent, amendments, attachments, lab orders, med history, safety floor |
| Business rules | `docs/prd/BUSINESS_RULES.md` | business rules | Current (load-bearing) | BR-003 visit immutability, BR-014 consent immutability, BR-017 prescriber role, BR-018 lab FSM, BR-019 amendment approval (deferred 501) |
| Acceptance criteria | `docs/prd/ACCEPTANCE_CRITERIA.md` | acceptance criteria | Current (load-bearing) | AC-MED-01..05, AC-RX-01/02, AC-PRES-01..05, AC-LAB-01/02, AC-ATTACH-01/02, AC-CLI-001..006 |
| Module spec + API contracts | `docs/product/modules/dental-clinical/` | module spec | Current (reconciled 2026-06-08) but §10b lists 6 undocumented shipped surfaces | FSMs §8, permissions §6, schema §7 |
| Workflow map | `docs/product/WORKFLOW_MAP.md` | workflow spec | Current | WF-016 Rx, WF-017/036/063 lab, WF-018/035 consent, WF-037 med-history, WF-038 amendment, WF-039 attachment |
| Prior module audit | `docs/audits/modules/MODULE_dental-clinical_AUDIT_2026-06-08.md` | prior audit (pre-AHA) | Current | V-CLN-010 consent revoke-then-sign exploit found+FIXED (3-layer, TDD) |
| Prior gap plan + matrix rows | `docs/audits/module-gap-plans/dental-clinical-gap-plan.md` + `MASTER-GAP-MATRIX.md` G1..G10 | prior gap plan (pre-AHA) | Partially superseded (G10 fixed Batch 3) | Every row re-verified in source this round (§3) |
| API_CONTRACTS lab-status enum | `docs/product/modules/dental-clinical/API_CONTRACTS.md` | API contract | **Conflicting** | Lists `sent/received/completed/rejected`; MODULE_SPEC §8 + BR-018 + code use `ordered/in_fabrication/delivered/fitted/cancelled` (§25 doc fix) |

## 3. Expected vs Actual

**Expected (PRD §6.1/§6.2):** chairside clinical sheets reachable from the workspace top bar — Rx (with allergy cross-check), consent (templates + e-sign + revocation WF-035), lab orders (FSM ordered→in_fabrication→delivered→fitted), amendments on locked visits (additive, both visible), smart attachments, structured medical history feeding an always-visible safety floor.

**Actual:** The backend implements all of that **plus 6 undocumented surfaces** (occlusion screenings, post-op templates, inventory, consent refusals, med-history review, drug-interaction checks). 33 operations; RBAC via `assertBranchRole` (e.g. `createPrescription.ts:41` dentist-only), `VISIT_IMMUTABLE` guard on all visit-scoped writes, consent sign/revoke mutual exclusion hardened 2026-06-08 (V-CLN-010 fix verified at `signConsentForm.ts:46-48`, `consent-form.repo.ts:53`, both `hasSignedConsentForVisit` facades). The FE wires the core sheets: Rx (create/update), consent (create/sign/refusal), lab (full FSM **inside the sheet**), med-history (full incl. review), attachments (full), amendment (create), safety floor live in `workspace-top-bar.tsx`.

What's broken is concentrated in the **dead-trigger / orphan-read class** — 16 of 33 ops have grep-verified zero FE consumers:

1. **Lab sheet unreachable (G1, unchanged):** `workspace-top-bar.tsx` declares `onLab` (line 24) and destructures it (line 90) but **never renders a Lab button**; `$patientId.tsx:236` wires the prop and mounts `LabOrdersSheet` (line 450). Whole tested lab FSM is dead UI. Masked by `lab-order-tracking.spec.ts`, which drives the FSM via `page.evaluate(fetch(...))` and never opens the sheet (API-only false-green).
2. **Consent revocation (WF-035) impossible from product:** `revokeConsentForm` + `listConsentRefusals` zero consumers; `listConsentForms` consumed only as a completion gate (`pre-completion-checklist.tsx`) — no consent history view.
3. **Prescription record is write-only:** `listPrescriptions` + `updatePrescription` (dispense/cancel FSM, WF-016) zero consumers — no medication review anywhere.
4. **Amendments write-only:** `listAmendments` zero consumers — corrections invisible after creation, undermining FR1.16's "both visible" promise. `approveAmendment` is an intentional 501 stub (BR-019 deferred).
5. **Occlusion / post-op / inventory:** complete tested backends (list shapes normalized in Batch 3/G10), zero FE, **and no PRD anchor** — Possible Overbuild pending product decision.

**New this round:** PRD FR1.12/FR2.15 require a **blocking** allergy warning "requiring explicit override"; implementation is an advisory non-blocking warn (`createPrescription.ts:51` comment "warn (non-blocking)", conflicts returned in response and surfaced by `rx-sheet.tsx`). Functional but softer than spec → `[NEEDS PRODUCT DECISION]` (§25 Q3).

## 4. PRD / Spec Coverage Matrix

(Condensed to requirement clusters; ✓BE = handler implemented+tested.)

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR1.12/BR-017/AC-RX/AC-PRES Rx create | Dentist-only Rx from top bar; prescriber validated | ✓BE + FE create/update | `rx-sheet.tsx` | `createPrescription.ts` (role guard :41) | `prescription.schema.ts` | `prescription.fsm.property.test.ts`, `em-cli-005`, hurl | Implemented | No |
| FR1.12/FR2.15 allergy check on Rx | **Blocking** warning requiring explicit override | Non-blocking advisory; conflicts surfaced in sheet | `rx-sheet.tsx` (renders `allergyConflicts`) | `createPrescription.ts:51-122` | med-history entries | `*.prescription-allergy-check` | Partially Implemented | **GAP-5** |
| WF-016 Rx lifecycle (pending→dispensed\|cancelled) + medication review | List + dispense/cancel reachable | ✓BE only — list/update zero FE consumers | grep `listPrescriptions`/`updatePrescription` FE = 0 | handlers + FSM | status enum | FSM property tests; hurl PATCH | Partially Implemented | **GAP-3** |
| FR1.13/BR-014/AC-MED-03/04 consent create+sign, immutable | Template → e-sign → immutable | ✓BE + FE | `consent-sheet.tsx` | `signConsentForm.ts` (revoked guard :46) | `consent-form.schema.ts` | `clinical-consent-lab.test.ts`, `consent-signing.spec.ts` E2E (genuine UI) | Implemented | No |
| WF-035 consent revocation + alert | Patient revokes pending consent; dentist alerted; treatment blocked | ✓BE only — zero FE consumers | grep `revokeConsentForm` FE = 0 | `revokeConsentForm.ts` + route | `revoked` flag | `consent-revoke-route.test.ts` | Partially Implemented | **GAP-2** |
| Consent refusal record + history | Informed refusal recorded and reviewable | Record ✓ FE; history list zero consumers | `consent-sheet.tsx` (record); `listConsentRefusals` 0 FE | both handlers | `consent-refusal.schema.ts` | backend tests; **no hurl** | Partially Implemented | GAP-2 |
| FR1.24/BR-018/AC-LAB lab orders + FSM | Sheet from top bar; ordered→in_fabrication→delivered→fitted; no skip/reverse | ✓BE + sheet complete; **top-bar trigger missing** | `workspace-top-bar.tsx:24,90` onLab never rendered; `lab-orders-sheet.tsx` full FSM | `updateLabOrder.ts` FSM | `lab-order.schema.ts` | hurl full FSM + invalid-skip; FE logic tests; E2E is API-only | Partially Implemented | **GAP-1** |
| FR0.8 dashboard pending lab orders | Count + delivery dates on dashboard | Not found in dashboard FE | `use-dashboard-summary` has no lab feed `[NEEDS CONFIRMATION]` | `listLabOrders` exists | — | — | Missing | GAP-1 follow-on (P3) |
| FR1.16/WF-038/J24 amendments | Add amendment to locked visit; original + amendment both visible | Create ✓ FE; **list zero consumers** → "both visible" unmet | `amendment-form.tsx` (create-only) | `listAmendments` 0 FE | `amendment.schema.ts` | `em-cli-011` role guard; create hurl | Partially Implemented | **GAP-4** |
| BR-019 amendment approval | Deferred — 501 | 501 stub as specified | — | `approveAmendment.ts` | — | route test | Not Required for V1 | No |
| FR2.14/AC-MED-01/AC-CLI-005 med history, append-only | Structured entries; immutable; corrections via amendments | ✓BE + FE full | `medical-history-sheet.tsx` | `createMedicalHistoryEntry.ts`; PATCH 405 | `medical-history.schema.ts` | backend + hurl | Implemented | No |
| FR2.15/AC-MED-02 safety floor | Always-visible allergies/meds/conditions, capped badges | ✓ | `workspace-top-bar.tsx:5,120-126` | `listMedicalHistory` | — | top-bar FE tests | Implemented | No |
| Med-history review trail | Reviews auditable over time | Latest-only read; no list endpoint | `use-medical-history.ts` | `getMedicalHistoryReview` (latest only) | review schema | backend tests | Partially Implemented | GAP-10 (P3) |
| FR1.21/AC-ATTACH attachments | Upload/tag/view/delete from sheet | ✓ | `attachments-sheet.tsx` | 3 handlers | `attachment.schema.ts` | backend + hurl + FE tests | Implemented | No |
| FR1.21 storage warn 90% / block 95% | Device-capacity guardrails | Not found in FE upload path `[NEEDS CONFIRMATION]` | — | — | — | — | Missing | GAP-12 (P3, offline/iPad concern) |
| BR-003/AC-CLI-006 visit immutability | All clinical writes 422 on completed/locked | ✓ every handler | read-only workspace state | `VISIT_IMMUTABLE` guard pattern | — | `acceptance.clinical-workflows.test.ts`, `workspace-readonly.spec.ts` | Implemented | No |
| Occlusion screenings | (no PRD anchor) | ✓BE, zero FE | 0 grep hits | 2 handlers (G10 shape fixed) | `occlusion-screening.schema.ts` | `dental-clinical-occlusion.test.ts`; no hurl | Possible Overbuild | **GAP-6** |
| Post-op templates | (no PRD anchor; FR mentions post-op instructions only) | ✓BE, zero FE | 0 grep hits | 3 handlers | `postop-template.schema.ts` | backend tests; no hurl | Possible Overbuild | **GAP-7** |
| Inventory / materials | (no PRD anchor) | ✓BE incl. append-only adjustment ledger, zero FE | 0 grep hits | 5 handlers | `inventory.schema.ts` | backend tests; no hurl | Possible Overbuild | **GAP-8** |
| FR8.4b consent template editor | Branch template CRUD with merge fields | Not found (consent sheet uses fixed templates) `[NEEDS CONFIRMATION]` | — | no template endpoints in module | — | — | Missing | §25 Q4 |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| FR1.24/WF-017 lab reachability | **GAP-1**: Lab button never rendered — `onLab` dead prop; entire tested lab FSM unreachable from product | P1 | V1 REQUIRED | `workspace-top-bar.tsx:24,90` (declared/destructured, absent from icon block); sheet mounted `$patientId.tsx:450` | Render Lab icon button (role-gated like Rx); RED-first top-bar test asserting button presence; replace/relabel false-green E2E (GAP-9) |
| WF-035/FR1.13 consent revocation | **GAP-2**: revoke + refusal/consent history have zero FE — revocation workflow impossible from UI; `[CROSS-MODULE RISK]` consent gates feed billing + case-presentation facades | P1 | V1 REQUIRED | `revokeConsentForm`, `listConsentRefusals` 0 consumers (spine + grep); `listConsentForms` only completion-gate | Consent history list (signed/pending/revoked/refusals) in consent sheet + revoke action on pending forms |
| WF-016/FR1.12 medication record | **GAP-3**: no prescription list or dispense/cancel UI — write-only Rx record; med review impossible | P1 | V1 REQUIRED | `listPrescriptions`, `updatePrescription` 0 consumers | Rx list (per visit + per patient) in rx-sheet with dispense/cancel actions |
| FR1.16/J24 "both visible" | **GAP-4**: amendments write-only — `listAmendments` zero consumers; corrected record not reviewable | P2 | V1 REQUIRED | spine + grep; `amendment-form.tsx` create-only | Amendments list on locked-visit view (read-only render of original + amendments) |
| FR1.12/FR2.15 allergy blocking | **GAP-5**: PRD requires blocking warning w/ explicit override; implemented as non-blocking advisory | P2 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` | `createPrescription.ts:51` "warn (non-blocking)"; FE renders conflicts | If ratified: FE confirm-dialog override before submit when conflicts present (backend unchanged); else update PRD |
| Occlusion FE | **GAP-6**: backend built, zero FE, no PRD anchor | P2 | `[NEEDS PRODUCT DECISION]` | 0 grep hits; MODULE_SPEC §10b undocumented | Decide wire-vs-park; do not expand backend `[DO NOT OVERBUILD]` |
| Post-op templates FE | **GAP-7**: backend built, zero FE, no PRD anchor | P2 | `[NEEDS PRODUCT DECISION]` | same class | Decide wire-vs-park |
| Inventory FE | **GAP-8**: backend built (5 ops + ledger), zero FE, no PRD anchor | P2 | `[NEEDS PRODUCT DECISION]` | same class | Decide wire-vs-park |
| Test honesty | **GAP-9**: `lab-order-tracking.spec.ts` is API-only (raw `page.evaluate(fetch)`) masquerading in e2e/ — masked GAP-1 | P2 | V1 REQUIRED `[TEST GAP]` | spec header line 8 admits API-only | With GAP-1 fix: real UI E2E (top bar → sheet → FSM advance); relabel old spec `-api` |
| Med-history review trail | **GAP-10**: latest-review-only; no list endpoint | P3 | V2 DEFERRED | `getMedicalHistoryReview` latest-only | Defer (needs new endpoint) |
| FE role-gating parity | **GAP-11**: Notes/Med-history affordances shown to all roles (backend 403 is real gate) | P3 | V1 RECOMMENDED | `workspace-top-bar.test.ts` asserts Rx/Consent/TP gated only | Hide per role matrix like Rx |
| Contract coverage | **GAP-12**: occlusion/postop/inventory/consent-revoke/refusals-list have zero hurl coverage; FR1.21 storage-cap behavior unverified | P3 | V1 RECOMMENDED `[TEST GAP]` | `dental-clinical.hurl` inventory | Add hurl cases when/if surfaces are wired |
| Doc drift | **GAP-13**: API_CONTRACTS lab enum (`sent/received/...`) contradicts MODULE_SPEC/BR-018/code | P3 | V1 RECOMMENDED | API_CONTRACTS lab section | Doc-only fix |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Inventory/materials backend (5 ops, append-only adjustment ledger) | `dental-clinical-inventory.test.ts`; `inventory.schema.ts` | No PRD/spec anchor (MODULE_SPEC §10b "undocumented") | Carrying cost; tested-but-unreachable | Keep but clarify; **do not expand** `[DO NOT OVERBUILD]` `[NEEDS PRODUCT DECISION]` |
| Occlusion screenings backend (2 ops) | `dental-clinical-occlusion.test.ts` | No PRD anchor | Same class | Keep but clarify; decide wire-vs-park |
| Post-op templates backend (3 ops) | `dental-clinical-postop.test.ts` | PRD mentions post-op instructions, not template CRUD | Same class | Keep but clarify |
| Drug-interaction checks (advisory) | `*.drug-interaction-check` tests | Not in PRD (allergy check is) | Low — useful, non-blocking | Keep |
| Medical-history review endpoints | `getMedicalHistoryReview`/`recordMedicalHistoryReview` wired in FE | Not in PRD explicitly | Low — wired and used | Keep |
| Consent refusal recording | wired in `consent-sheet.tsx` | Inferred from informed-refusal practice; not in PRD | Low | Keep; add list view with GAP-2 |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| WF-016 prescribe | dentist | clinical need | Rx sheet → allergy check → create → dispense/cancel | Create ✓; lifecycle+list FE missing; allergy check advisory | **GAP-3, GAP-5** | spine + `createPrescription.ts:51` |
| WF-017/036/063 lab order | dentist | lab work needed | open sheet → create → progress FSM → cancel | Sheet complete; **trigger missing** | **GAP-1** | `workspace-top-bar.tsx` |
| WF-018 consent sign | dentist+patient | treatment requiring consent | template → patient signs → immutable | Implemented (genuine UI E2E) | No | `consent-signing.spec.ts` |
| WF-035 consent revoke | patient | withdrawal | revoke pending → dentist alerted → treatment blocked | Backend only | **GAP-2** | 0 consumers |
| WF-037 med history | dentist/staff | intake/update | add entry → safety floor updates | Implemented | No | `medical-history-sheet.tsx` |
| WF-038/J24 amendment | dentist | correction on locked visit | add amendment → both visible | Create ✓; visibility missing | **GAP-4** | `listAmendments` 0 consumers |
| WF-039 attachment | dentist/staff | upload | upload → tag → view/delete | Implemented | No | `attachments-sheet.tsx` |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Rx create + prescriber guard | dentist-only, 422 on missing prescriber | Implemented | role guard :41; AC-PRES tests | V1 REQUIRED | done |
| Rx allergy gate | blocking w/ override | Partially Implemented (advisory) | GAP-5 | V1 RECOMMENDED | decision Q3 |
| Rx list/dispense/cancel | reviewable medication record | Missing (BE ready) | GAP-3 | V1 REQUIRED | |
| Lab sheet reachability | top-bar button | Missing | GAP-1 | V1 REQUIRED | 1-button fix |
| Lab FSM in sheet | guarded transitions | Implemented | `lab-orders-sheet.tsx:39-45` NEXT_STATUS | V1 REQUIRED | done (unreachable) |
| Consent sign + immutability | signed = immutable; revoked unsignable | Implemented (V-CLN-010 fixed) | `signConsentForm.ts:46`; facades | V1 REQUIRED | done — do not re-litigate |
| Consent revoke + history | revoke pending; history visible | Missing (BE ready) | GAP-2 | V1 REQUIRED | |
| Amendment create | locked-visit additive correction | Implemented | `amendment-form.tsx` | V1 REQUIRED | done |
| Amendment visibility | original + amendment both visible | Missing (BE ready) | GAP-4 | V1 REQUIRED | |
| Amendment approval | supervisor approval | Not Required for V1 | BR-019 501 stub | V2 DEFERRED | per spec |
| Med history + safety floor | entries → always-visible floor | Implemented | top-bar :120-126 | V1 REQUIRED | done |
| Attachment upload/view | tagged uploads, lightbox | Implemented | sheet + tests | V1 REQUIRED | storage-cap UX unverified (GAP-12) |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Write an Rx chairside | dentist | 2 taps from top bar | Implemented | No | V1 REQUIRED | rx-sheet |
| Review patient's medications | dentist | list current/past Rx + status | Missing | GAP-3 | V1 REQUIRED | 0 consumers |
| Order lab work | dentist | open lab sheet from top bar | Missing (sheet exists, no trigger) | GAP-1 | V1 REQUIRED | dead prop |
| Track lab status to fitted | dentist/staff | FSM progression in sheet | Implemented (unreachable) | GAP-1 | V1 REQUIRED | sheet tests |
| Capture signed consent | dentist+patient | e-sign, immutable | Implemented | No | V1 REQUIRED | E2E |
| Honor consent withdrawal | patient | revoke pending consent | Missing (BE ready) | GAP-2 | V1 REQUIRED | 0 consumers |
| Review consent history | dentist | signed/revoked/refused list | Missing | GAP-2 | V1 REQUIRED | 0 consumers |
| Correct a locked record | dentist | amendment, both visible | Partially Implemented | GAP-4 | V1 REQUIRED | create-only |
| Record med history / see safety floor | dentist/staff | entries + floor badges | Implemented | No | V1 REQUIRED | top-bar tests |
| Attach and review files | dentist/staff | upload/tag/lightbox | Implemented | No | V1 REQUIRED | sheet tests |
| Manage post-op templates | dentist | template CRUD | Missing (BE ready) | GAP-7 | `[NEEDS PRODUCT DECISION]` | no PRD anchor |
| Track materials/inventory | staff | item CRUD + adjustments | Missing (BE ready) | GAP-8 | `[NEEDS PRODUCT DECISION]` | no PRD anchor |
| Occlusion screening | dentist | record screening | Missing (BE ready) | GAP-6 | `[NEEDS PRODUCT DECISION]` | no PRD anchor |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| GAP-1 lab dead-trigger | FE affordance | P1 | V1 REQUIRED | `workspace-top-bar.tsx:24,90`; render block omits Lab | Entire tested lab workflow (FR1.24, BR-018) undeliverable; staff cannot track crowns/dentures — core dental need | Render role-gated Lab button + RED-first top-bar test + honest E2E |
| GAP-2 consent revoke/history | FE affordance / compliance | P1 | V1 REQUIRED | `revokeConsentForm`, `listConsentRefusals` 0 consumers | WF-035 legal/compliance workflow impossible; consent state invisible post-signing; gates feed billing/case-presentation `[CROSS-MODULE RISK]` | Consent history + revoke-pending action in consent sheet |
| GAP-3 Rx write-only | FE affordance / safety | P1 | V1 REQUIRED | `listPrescriptions`, `updatePrescription` 0 consumers | Medication record unreviewable → clinical-safety blind spot; FSM dead | Rx list + dispense/cancel in rx-sheet |
| GAP-4 amendments invisible | FE affordance / record integrity | P2 | V1 REQUIRED | `listAmendments` 0 consumers | FR1.16 "both visible" compliance promise unmet — corrections exist but can't be seen | Amendment list on locked visit |
| GAP-5 allergy advisory vs blocking | spec divergence / safety | P2 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` | `createPrescription.ts:51` | PRD safety posture (hard stop + override) softened silently | Decision then FE confirm-dialog or PRD update |
| GAP-9 false-green E2E | test honesty | P2 | V1 REQUIRED `[TEST GAP]` | `lab-order-tracking.spec.ts` | Masked GAP-1; same class previously caused imaging misses | Real UI E2E with GAP-1 |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Dentist orders crown → tracks to fitted | Lab button → sheet → FSM | No button; sheet unreachable; E2E green anyway | GAP-1/GAP-9 | P1 | UI E2E: top bar → create → advance status |
| Patient withdraws consent | Revoke on pending form | No affordance anywhere | GAP-2 | P1 | FE-unit: revoke action on pending, hidden on signed |
| Dentist reviews meds before extraction | Rx list per patient | No list; only create form | GAP-3 | P1 | FE-unit: list renders entries + status |
| Auditor reviews corrected record | Original + amendment visible | Amendment invisible after save | GAP-4 | P2 | FE-unit: locked visit shows amendments |
| Allergic patient prescribed penicillin | Blocking warning + explicit override | Advisory text only | GAP-5 | P2 | decision-dependent |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `revokeConsentForm` | API, 0 FE consumers | spine + grep | compliance workflow dead | Wire (GAP-2) |
| `listConsentRefusals` | API, 0 FE consumers | same | refusal history invisible | Wire (GAP-2) |
| `listPrescriptions` / `updatePrescription` | API, 0 FE consumers | same | med record write-only | Wire (GAP-3) |
| `listAmendments` | API, 0 FE consumers | same | corrections invisible | Wire (GAP-4) |
| `approveAmendment` | API, 501 stub | BR-019 deferred | none (intentional) | Keep stub |
| `onLab` prop | dead FE prop | `workspace-top-bar.tsx:24,90` | lab unreachable | Render button (GAP-1) |
| occlusion ops ×2, postop ops ×3, inventory ops ×5 | API, 0 FE consumers | spine + grep (0 hits for occlusion/postop/inventory in FE) | carrying cost; no PRD anchor | Park pending decision (GAP-6/7/8) `[DO NOT OVERBUILD]` |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Consent sign/revoke mutual exclusion enforced at handler + repo WHERE + 2 gate facades | backend/schema | `signConsentForm.ts:46`, `consent-form.repo.ts:53`, `clinical-visit.facade.ts:40`, `consent-billing.facade.ts:20` | — | none (verified strong; V-CLN-010 fixed) |
| List shapes normalized `{data,pagination}` for occlusion/postop/inventory (G10) | API | handlers with `buildPaginationMeta` + "G10: conform" comments | — | none (verified fixed Batch 3) |
| `VISIT_IMMUTABLE` guard uniform across visit-scoped writes | backend | handler pattern; `acceptance.clinical-workflows.test.ts` | — | none |
| Inventory adjustment ledger append-only | schema | `inventory.schema.ts` + tests | — | none (but surface unreachable) |
| FR1.21 5MB (API_CONTRACTS) vs 50MB (MODULE_SPEC) attachment cap conflict | API/docs | both docs | P3 | reconcile docs; verify actual validator cap |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Dentist-only guards on Rx/consent/amendment/lab create | write guards | `assertBranchRole` per handler; `em-cli-005`, `em-cli-011` | — | none (verified) |
| Notes/Med-history FE affordances not role-gated (backend 403 real gate) | FE UX parity | `workspace-top-bar.test.ts` | P3 | GAP-11 |
| No new cross-tenant findings (prior sweep SL-08 covered module) | tenancy | prior audit + this round's handler spot-checks | — | none |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Audit rows written (awaited) on consent sign/refusal, amendment, lab create | clinical audit trail | `signConsentForm.ts:60-68` `logAuditEvent` awaited | — | none; fail-closed semantics of `logAuditEvent` itself were hardened in Batch 2 (audit-reliability) — not re-litigated |
| Consent immutability after sign (BR-014) | consent record | repo WHERE-clause + 422 | — | none |
| Med history append-only; PATCH 405 | medical record | AC-CLI-005 tests | — | none |
| Amendments preserve original (additive) | record corrections | amendment design + tests | — | visibility gap is GAP-4 (UI, not data) |

## 16. Knowledge Graph Findings

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| 17/33 clinical ops have FE consumers; 16 orphans are exactly the §12 list | contract-spine.json 2026-06-10, grep-verified | Gap class is FE-affordance + unanchored backend, not backend quality | Drives GAP-1..4, 6..8 |
| 9 facades export clinical state to visit/billing/pmd/imaging/case-presentation/erasure/patient/retention | `repos/*.facade.ts` | Consent-state changes have wide blast radius | Treat GAP-2 fix as read-mostly; do not alter gate semantics `[CROSS-MODULE RISK]` |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Lab work (crowns/dentures/aligners) is a daily dental-practice loop; PH practices track lab turnaround manually today | PRD §6.1 FR1.24; domain-graph clinical domain | GAP-1 blocks a core differentiator despite complete implementation | Highest-leverage 1-line-class fix in the platform |
| Consent revocation is a legal requirement (informed-consent withdrawal), not a nice-to-have | WF-035; PH dental practice norms `[INFERRED]` | GAP-2 is compliance-grade | P1 |
| Medication review before procedures is a safety ritual | FR2.15 safety floor intent | GAP-3 leaves the floor without a drill-down | P1 |

## 18. Webwright / Playwright Findings

Not used this round — all gap claims are statically conclusive (dead prop, zero-consumer ops, grep-verified absences); wired sheets were live-driven during the 2026-06-08 audit series and the golden-path/consent E2Es are genuine UI drives. One E2E honesty finding recorded from inspection:

| Finding | Tool | Evidence Location | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| `lab-order-tracking.spec.ts` drives FSM via `page.evaluate(fetch)`; never opens UI | Playwright (inspected) | `apps/dentalemon/tests/e2e/lab-order-tracking.spec.ts` (header line 8) | False-green masked GAP-1 | Relabel `-api` + add genuine UI E2E with GAP-1 fix |

## 19. Existing Tests Found

(Condensed — 32 backend files ≈7.7K LOC, hurl suite, ~60 FE files, 4 E2E.)

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `prescription.fsm.property.test.ts` + allergy/drug-interaction/legal-fields/prescriber tests | backend | Rx FSM, guards, advisory checks | High |
| `clinical-consent-lab.test.ts`, `consent-revoke-route.test.ts`, `repos/consent-form.test.ts`, `repos/clinical-visit.facade.test.ts` | backend | consent FSM incl. V-CLN-010 regression pins, gate facades | High |
| `dental-clinical-occlusion/postop/inventory.test.ts` | backend | unreachable surfaces incl. G10 shapes | High (backend-only reach) |
| `repos/amendment.test.ts`, `em-cli-011`, `repos/medical-history.test.ts`, `repos/attachment.test.ts`, `acceptance.clinical-workflows.test.ts`, `dental-clinical-events.test.ts` | backend | amendments, med-history immutability, attachments, BR-003, events | High |
| `dental-clinical.hurl` | contract | Rx/consent/attachments/lab FSM/med-history/amendments/notes | High |
| FE: `consent-sheet.test.ts` (create+refusal), `lab-orders-sheet.test.ts` (logic-only), `rx-sheet.test.ts`, `medical-history-form`, `attachments-sheet`, `amendment-form.test.ts` (create-only), `workspace-top-bar.test.ts` (RBAC, **no Lab assertion**) | frontend | wired surfaces | Medium |
| E2E: `consent-signing.spec.ts` | E2E | genuine UI consent journey | High |
| E2E: `lab-order-tracking.spec.ts` | E2E | **API-only false-green** | Low |
| E2E: `clinical-billing-handoff.spec.ts`, `workspace-readonly.spec.ts` | E2E | handoff, immutability UX | High |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Top-bar renders Lab button (role-gated) | frontend/component | GAP-1 RED-first; pins the dead-prop class | Before |
| Genuine UI lab E2E (button → sheet → status advance) | E2E/Playwright | replaces false-green; end-user proof | During |
| Consent history renders signed/pending/revoked/refusals; revoke only on pending | frontend/component | GAP-2 RED-first | Before |
| Revoked-consent treatment-block surfaced in UI (gate already backend-tested) | frontend/component | GAP-2 downstream visibility | During |
| Rx list renders entries + status; dispense/cancel actions guard FSM | frontend/component | GAP-3 RED-first | Before |
| Locked visit shows amendments alongside original | frontend/component | GAP-4 RED-first | Before |
| Allergy-conflict override dialog (if Q3 ratified) | frontend/component | GAP-5 | Before (after decision) |
| Hurl: consent revoke + refusals list | contract | only backend-unit covered today | During GAP-2 |
| Attachment size-cap behavior (5MB vs 50MB doc conflict) | backend/contract | pin actual validator | Anytime |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| Consent gates consumed by billing (`consent-billing.facade`) + case-presentation + visit completion | cross-module `[CROSS-MODULE RISK]` | 9 facades in `repos/` | GAP-2 UI work must not touch gate semantics (already hardened) | UI-only wiring; keep facades untouched |
| `WorkspaceTopBar` is shared workspace shell | shared/platform `[SHARED DEPENDENCY]` | GAP-1 edit point | Same component carries dental-pmd's dead `onPmd` (that module's audit) | Fix Lab here; note pattern for cross-cutting prompt 05 (dead-trigger class) |
| Safety floor ← med-history entries ← PMD import merge (FR12.3) | cross-module | top-bar floor + pmd facade | Floor must reflect imported data — verify in dental-pmd audit | note for dental-pmd round |
| Occlusion/postop/inventory wire-vs-park | product decision | GAP-6/7/8 | blocks those batches | escalate; do not build |
| Attachment storage (S3/MinIO base module) | shared/platform | `storage` handlers | upload path dependency | none — working |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Render Lab icon button in `WorkspaceTopBar` (role-gated dentist+staff per matrix) | GAP-1 | P1 | V1 REQUIRED | FE-unit RED + UI E2E | smallest fix in plan; backend untouched |
| Consent history list + revoke-pending action in consent sheet | GAP-2 | P1 | V1 REQUIRED | FE-unit RED + hurl revoke | read-mostly; gates untouched |
| Rx list + dispense/cancel actions in rx-sheet | GAP-3 | P1 | V1 REQUIRED | FE-unit RED | backend untouched |
| Amendments read-only list on locked visit | GAP-4 | P2 | V1 REQUIRED | FE-unit RED | backend untouched |
| Relabel `lab-order-tracking.spec.ts` → `-api` + new UI E2E | GAP-9 | P2 | V1 REQUIRED | E2E | with GAP-1 |
| Allergy override dialog | GAP-5 | P2 | V1 RECOMMENDED (post-decision) | FE-unit | decision Q3 first |
| FE role-gate Notes/MH affordances | GAP-11 | P3 | V1 RECOMMENDED | FE-unit | quick |
| Reconcile lab-enum + attachment-cap docs | GAP-13 | P3 | V1 RECOMMENDED | none (docs) | quick |
| Wire occlusion/postop/inventory UIs | GAP-6/7/8 | P2 | `[NEEDS PRODUCT DECISION]` | per-surface | do not start unprompted |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Amendment supervisor approval (BR-019) | V2 DEFERRED | Spec-declared 501 stub; feature-flagged off |
| Med-history review history endpoint + UI (GAP-10) | V2 DEFERRED | Needs new endpoint; latest-review suffices for V1 |
| Consent template editor (FR8.4b) | `[NEEDS PRODUCT DECISION]` | PRD lists it but no backend exists; sizable build — confirm V1 necessity before adding |
| RxNorm/ICD-10/SNOMED coded lookups | V2 DEFERRED | PRD mentions vocabularies; free-text works; coding layer is a large dependency |
| Inventory/occlusion/postop backend expansion | DO NOT ADD `[DO NOT OVERBUILD]` | Already built beyond PRD; no expansion until product anchors exist |
| Drug-interaction engine expansion (beyond advisory) | DO NOT ADD | No PRD anchor; advisory check suffices |
| Storage-capacity device telemetry (FR1.21 90/95%) | V2 DEFERRED `[NEEDS CONFIRMATION]` | Device-capacity sensing belongs with offline/iPad work; revisit with offline-sync group |

## 24. Audit Decision

**PARTIAL PASS.**

The clinical core is sound: consent signing (with the 2026-06-08 revoke-sign exploit fixed and triple-pinned), medical history + safety floor, attachments, amendments-create, and Rx-create are implemented end-to-end with strong backend coverage (32 test files, property-tested FSMs, uniform `VISIT_IMMUTABLE` and role guards) and a genuine consent UI E2E.

It is not a PASS because three P1 workflows are undeliverable from the product despite complete tested backends: the lab-order workflow has no entry point (dead `onLab` prop — masked by an API-only false-green E2E), consent revocation/history (WF-035, a compliance workflow) has zero UI, and the prescription record is write-only. Amendment visibility (FR1.16 "both visible") is also unmet. Nothing found is data-unsafe — so not a FAIL.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Q1: Occlusion / post-op templates / inventory — wire FE, or park as dormant backend (and document as such)? | `[NEEDS PRODUCT DECISION]` | 10 orphan ops; decides GAP-6/7/8 | Product |
| Q2: Consent history/revoke UI placement — inside consent sheet vs patient profile? | `[NEEDS CONFIRMATION]` | GAP-2 fix shape | Product/Design |
| Q3: Allergy conflict — ratify advisory (current) or restore PRD blocking-with-override? | `[NEEDS PRODUCT DECISION]` | Safety posture; GAP-5 | Product |
| Q4: Is the consent template editor (FR8.4b) V1? No backend exists for it | `[NEEDS PRODUCT DECISION]` | Could be a hidden V1 build item or a PRD overreach | Product |
| Q5: Attachment max size — 5MB (API_CONTRACTS) or 50MB (MODULE_SPEC)? Which does the validator enforce? | `[NEEDS CONFIRMATION]` | doc/code reconcile | Eng |

## 26. Notes for Gap Plan Organizer

- **Truly V1 (active fix candidates, decision-free):** GAP-1 (Lab button — smallest highest-leverage fix), GAP-2 (consent revoke/history UI), GAP-3 (Rx list + lifecycle), GAP-4 (amendments list), GAP-9 (honest lab E2E, bundled with GAP-1), GAP-11/13 (cheap).
- **Likely batch shape:** Batch A = GAP-1+GAP-9 (one component + one E2E); Batch B = GAP-2 (consent sheet additions + hurl revoke); Batch C = GAP-3 (rx-sheet additions); Batch D = GAP-4 + GAP-11; docs batch = GAP-13 + attachment-cap reconcile. All FE wiring to already-tested backends; backend changes ≈ zero.
- **Blocked until decided:** GAP-6/7/8 (Q1), GAP-5 (Q3), consent-template editor (Q4).
- **Must NOT implement:** §23 — no backend expansion for unanchored surfaces, no coding-vocabulary layer, no approval workflow.
- **Tests to write first:** top-bar Lab-button RED; consent-history/revoke FE RED; Rx-list FE RED; amendments-list FE RED.
- **Cross-module touchpoints:** consent gate facades (billing/case-presentation) must stay untouched; `WorkspaceTopBar` shared with dental-pmd's dead `onPmd` (same class — flag for prompt 05); safety-floor↔PMD merge checked in dental-pmd round.
- **Do not re-litigate:** V-CLN-010 consent exploit (fixed+pinned), G10 list shapes (fixed Batch 3), visit immutability, RBAC guards — all source-verified GREEN this round.

---

Next recommended step:
Module/group: Dental Clinical
Module slug: dental-clinical
Primary PRD/spec: docs/prd/v3-dentalemon.md §6.1/§6.2 + docs/product/modules/dental-clinical/
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/dental-clinical-gap-plan.md
