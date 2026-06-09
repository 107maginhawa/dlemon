# dental-clinical — Module Gap Plan

**Module:** `dental-clinical` (per-visit clinical add-ons: prescriptions, consent forms + informed refusals, clinical amendments, clinical attachments, lab orders, medical history + ASA review, occlusion screening, post-op instruction templates, inventory/materials)
**Audit date:** 2026-06-09
**Auditor:** Claude — live drive via `/webwright` (Firefox, persona Dr. Maria Reyes `dentist_owner` PIN 123456, patient Maria Santos active visit) + full static map (TypeSpec ↔ handler ↔ SDK ↔ FE).
**Environment:** API `:7213` livez 200 (readyz=fail, MinIO/Mailpit down — storage baseline, not a regression); FE `:3003`.
**References:** `docs/context/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md` (§3.4 Clinical Encounter, §3.7 Procedure/Work, §3.9 Claims, §3.10 Imaging/Attachments, §3.11 Inventory, §3.12 Communication/Follow-up; §4.2/4.5; §5.3/5.6/5.9; §3.14 deferred list), `specs/api/src/modules/dental-clinical.tsp`, `dental-clinical-ops.tsp`.
**Mode:** report-only. **No fixes applied.**

---

## Audit Decision: **PARTIAL PASS**

The clinical surfaces that ARE reachable are reliable, RBAC-safe, and clinically sound: prescriptions (with non-blocking allergy + drug-interaction safety floor), consent forms (ADA structured fields + e-signature + immutability FSM), informed refusals, medical history + ASA review, attachments, and amendments all have correct backend RBAC (`assertBranchRole`, dentist-only mutations, hygienist denied), FSM/immutability guards (`BR-003` visit-lock, signed-consent immutability), and synchronous audit logging. The safety floor (allergy/medication badges in the workspace top bar) works live.

The gaps are **not safety regressions** in what's reachable — they are **built-but-unreachable / built-but-unwired** capabilities and **create-only surfaces** that hide clinically important read/history/lifecycle actions. The headline is **Lab Orders is fully built end-to-end (backend FSM, dashboard count, mounted sheet) but has no trigger in the UI** — a real broken core dental workflow. Three further whole contexts the IDEAL standard lists for this module (Occlusion screening, Post-op templates, Inventory) are backend-complete with **zero frontend**.

Severity scale: **P0** blocks core workflow / safety-security · **P1** serious functional/workflow/trust gap · **P2** important not blocking · **P3** minor/polish.

---

## 1. Expected vs Actual

**Expected (IDEAL §3.4/3.7/3.10/3.11/3.12, §4.2/4.5):** A visit's clinical add-ons should let a dentist prescribe (and see/manage the patient's prescription list + dispense/cancel state), capture **and revoke** consent and view past consents/refusals, record + review medical history, order lab work **and advance it through fabrication→delivery→fitting**, attach images/docs, amend finalized records via addendum, screen occlusion, hand out post-op instructions, and track materials/inventory.

**Actual:**
- **Reachable & working:** Rx (create), Consent + Informed Refusal (create+sign), Medical History + ASA review (create/edit), Attachments (UI present), Amendment (create, in tooth slideout).
- **Built backend, NO trigger in UI (dead wiring):** **Lab Orders** — `LabOrdersSheet` is mounted in `$patientId.tsx` and `onLab` is passed to `WorkspaceTopBar`, but the top bar **renders no Lab button** (and there is no other trigger; the dashboard "Lab Orders" card only shows a count). The whole lab workflow is unreachable.
- **Built backend, ZERO frontend:** **Occlusion screening** (create/list), **Post-op templates** (create/list/update), **Inventory** items + adjustments (create/list/update). No nav, no settings, no workspace surface — confirmed by live drive + `grep` returning zero FE references.
- **Create-only surfaces hiding read/lifecycle:** Rx has no **list/history** and no **dispense/cancel** (`updatePrescription` FSM unused); Consent has no **revoke** (`revokeConsentForm` unused) and no **past-consents / refusals list** (`listConsentForms`/`listConsentRefusals` unused); Amendments have no **list** and no **approve** (`listAmendments` unused; `approveAmendment` is a 501 stub, BR-019 deferred); Medical-history **review history** not surfaced (`getMedicalHistoryReview` reads latest only).
- **FE shows clinical affordances with no role gate beyond Rx/Consent/TreatmentPlan** (those three are FE-gated via `lib/rbac.ts`); Notes/Attachments are shown to all. Backend is the hard gate, so this is a misleading-affordance/UX issue, not a hole.

---

## 2. Critical Gaps

| # | Gap | Area | Severity | Why It Matters | Recommended Fix |
|---|-----|------|----------|----------------|-----------------|
| G1 | **Lab Orders sheet unreachable.** `LabOrdersSheet` mounted + `onLab` passed to `WorkspaceTopBar` (`$patientId.tsx:236`), but the top bar renders **no Lab button** (`workspace-top-bar.tsx` declares/destructures `onLab` at lines 24/90 then never uses it). No other trigger; dashboard "Lab Orders" card is count-only. Backend (`createLabOrder`/`listLabOrders`/`updateLabOrder`, FSM `ordered→in_fabrication→delivered→fitted`/`cancelled`, audit) is complete + tested. | Broken core workflow (§4.2 same-day → lab; crowns/dentures/bridges/ortho appliances) | **P1** | A clinic cannot order or track lab/prosthetic work at all from the UI — yet the count surfaces on the dashboard, implying it works. Crown/denture/bridge/retainer fabrication is a routine dental workflow; this is a real journey dead-end. | Render a Lab Orders `IconButton` in `WorkspaceTopBar` wired to the existing `onLab` (one icon button — backend + sheet already done). Mirror RBAC gate (dentist) if desired. |
| G2 | **Occlusion screening has zero frontend.** `createOcclusionScreening`/`listOcclusionScreenings` (Angle class, overjet/overbite mm, crossbite/crowding/spacing, midline) built + RBAC'd. No nav/tab/sheet anywhere. | Missing surface vs §3.4 (Occlusion screening, V1 Recommended) + §3.14 | **P1** | Occlusion screening is a named V1-Recommended clinical-encounter capability and the gateway to the ortho-candidate scenario (§10.2). Backend + schema + tests exist; the workflow is invisible to users. | Add an Occlusion screening surface in the clinical workspace (a sheet alongside Rx/Consent, or a tab) wiring the two endpoints. OR formally defer in §3.14 and stop counting it as built. `[NEEDS CONFIRMATION]` |
| G3 | **Consent cannot be revoked and history is invisible.** FE consent sheet is create+sign only. `revokeConsentForm` (pending→revoked, audited), `listConsentForms`, and `listConsentRefusals` have **no FE consumer**. | Trust / clinical-legal traceability (§3.4, ENC-BR-003, AUD-BR-001) | **P1** | A pending consent captured in error can never be revoked from the UI; staff can't see what consents/refusals a patient has on file. Consent provenance is a core medico-legal record — write-only-and-forget is a real trust gap. | Add a "Consent history" view (list signed/pending/revoked + refusals) with a Revoke action on pending forms, wiring `listConsentForms`/`listConsentRefusals`/`revokeConsentForm`. Read-mostly; backend done. |
| G4 | **Prescription list + dispense/cancel not surfaced.** FE Rx is create-only. `listPrescriptions` + `updatePrescription` (FSM `pending→dispensed`/`cancelled`) unused. | Workflow / clinical record (§3.7, PROC-BR-006) | **P1** | A clinician can write an Rx but never see the patient's prescription list or mark one dispensed/cancelled — no medication record review, no way to void an erroneous Rx. | Add a prescriptions list (per patient/visit) + dispense/cancel actions wiring `listPrescriptions`/`updatePrescription`. Backend FSM + tests already exist. |
| G5 | **Amendments are write-only; no list, no approve.** `amendment-form.tsx` only calls `createAmendment`. `listAmendments` unused; `approveAmendment` is a **501 stub** (BR-019, feature-flag `dental_clinical_amendment_approval` default false). | Traceability / addendum integrity (§3.7 reversal/correction, ENC-BR-003) | **P2** | Amendments are the legal correction mechanism for finalized records, but once written they vanish from view — you cannot read prior amendments on a record. Supervisor approval is intentionally deferred (acceptable), but **not being able to list/read amendments** undercuts the addendum-not-silent-edit rule. | Surface an amendment list on the amended record (tooth slideout / record detail) wiring `listAmendments`. Leave approval deferred (BR-019) but label it. |
| G6 | **Post-op instruction templates have zero frontend.** `createPostopTemplate`/`listPostopTemplates`/`updatePostopTemplate` (branch-scoped, categorized) built + RBAC'd; no UI. | Missing surface vs §3.12 (Post-op instructions, V1 Recommended) | **P2** | Post-op instructions (extraction/RCT/surgery) are a V1-Recommended follow-up capability; built but unusable. No way to author or hand out post-op care. | Add a post-op template manager under clinic settings + an "attach post-op instructions" affordance on completed procedures, wiring the 3 endpoints. OR formally defer. `[NEEDS CONFIRMATION]` |
| G7 | **Inventory/materials has zero frontend.** `createInventoryItem`/`updateInventoryItem`/`createInventoryAdjustment`/`listInventoryItems`/`listInventoryAdjustments` (branch-scoped, `quantityOnHand`/`reorderLevel`, append-only adjustments) built + RBAC'd (`dentist_owner`/`staff_full`); no nav/settings/UI. Low-stock is a client-derived comparison with no client. | Missing surface vs §3.11 (Inventory, V1 Recommended) | **P2** | A whole V1-Recommended context the IDEAL standard explicitly says is "IMPLEMENTED — NOT missing" (§3.11) is invisible to users. Materials tracking + low-stock warnings are unusable. | Add an Inventory screen (items list + stock adjust + low-stock flag) under clinic settings/admin, wiring the 5 endpoints. OR formally defer. `[NEEDS CONFIRMATION]` |
| G8 | **Medical-history review history not surfaced.** `getMedicalHistoryReview` returns the latest review only; the append-only review trail (`recordMedicalHistoryReview` writes a new row each time) is never listed. FE derives a 6-month "review due" badge but shows no review log. | Trust / audit (§3.4, AUD-BR-004) | **P3** | Minor: clinicians see "review due" but not who reviewed when historically. Latest-review behavior is acceptable for V1. | Optional: add a review-history list (needs a `listMedicalHistoryReviews` endpoint — not currently present). Defer unless requested. |
| G9 | **FE clinical affordances not consistently role-gated.** Rx/Consent/Treatment-Plan ARE FE-gated (`canPrescribe`/`canCaptureConsent`/`canAddTreatment` in `workspace-top-bar.tsx`). Notes/Medical-History + Attachments are shown to all roles; backend correctly 403s restricted roles. | RBAC / UX coherence | **P3** | Not a security hole (backend `assertBranchRole` is the real gate). A restricted role sees controls that error on submit → looks broken. Note `createAttachment` actually allows `dental_assistant`, so that one is intentionally broad. | Gate Notes/Medical-History affordance with the existing `lib/rbac.ts` helpers to mirror the backend matrix (medical-history create = dentist + `staff_full`, hygienist denied per V-CLI-002). Pure FE. |
| G10 | ✅ **FIXED 2026-06-09 (Batch 3).** Spec-first: the 4 list ops (`listOcclusionScreenings`, `listPostopTemplates`, `listInventoryItems`, `listInventoryAdjustments`) changed in `dental-clinical-ops.tsp` from `ApiOkResponse<T[]>` → `ApiOkResponse<PaginatedResponse<T>>` (regen routes/validators/SDK); handlers now return `{data, pagination}` via `parsePagination`/`buildPaginationMeta`; occlusion/postop/inventory backend tests updated to the envelope (RED→GREEN). Zero FE consumers, so no FE change. **Now unblocks G2/G6/G7 wiring.** ~~List-response-shape divergence~~ | API consistency / contract drift | **P3** | (was) if G2/G6/G7 are wired the FE will expect the envelope. | (done) |

---

## 3. Broken / Misleading Journeys

1. **Order & track lab work (G1):** dentist completes a crown prep and wants to send to the lab → there is **no Lab button** in the workspace; the sheet exists but is unreachable. The dashboard "Lab Orders" count implies the feature is live → misleading.
2. **Revoke a mistaken consent / review consent history (G3):** a consent captured in error stays forever; no UI lists prior consents or recorded refusals.
3. **Review / void a prescription (G4):** an Rx written by mistake cannot be cancelled, and the patient's medication list is never shown after creation.
4. **Read prior amendments on a record (G5):** corrections are write-only — once submitted they cannot be read back in the UI.
5. **Screen occlusion / hand out post-op instructions / track materials (G2/G6/G7):** three whole capabilities the standard lists for this module have no entry point anywhere.
6. **Misleading clinical affordances for restricted roles (G9):** Notes/Medical-History controls render for roles the backend rejects on submit.

---

## 4. Unused / Unwired Implementation (built, not consumed)

| Backend capability | Status | FE consumer |
|---|---|---|
| `createLabOrder`, `listLabOrders`, `updateLabOrder` (+ `LabOrdersSheet`) | Real handlers + FSM + tests; sheet mounted; `onLab` passed to top bar | **None reachable** — top bar renders no Lab button (G1) |
| `createOcclusionScreening`, `listOcclusionScreenings` | Real handlers + RBAC + schema | **None** (G2) |
| `createPostopTemplate`, `listPostopTemplates`, `updatePostopTemplate` | Real handlers + RBAC | **None** (G6) |
| `createInventoryItem`, `updateInventoryItem`, `createInventoryAdjustment`, `listInventoryItems`, `listInventoryAdjustments` | Real handlers + RBAC + append-only ledger | **None** (G7) |
| `revokeConsentForm` | Real handler (pending→revoked, audited, idempotent) + route test | **None** (G3) |
| `listConsentForms` | Real handler (`{data,pagination}`) | **1 consumer** — `pre-completion-checklist.tsx` reads it as a visit-completion *gate* (read-only). No history/revoke surface (G3). *Adjusted 2026-06-09: prior "None" was incorrect.* |
| `listConsentRefusals` | Real handler (`{data,pagination}`) | **None** (G3) |
| `listPrescriptions`, `updatePrescription` (dispense/cancel FSM) | Real handlers + status tests | **None** (G4) |
| `listAmendments` | Real handler | **None** (G5) |
| `approveAmendment` | **501 stub** — BR-019 deferred (feature-flag default false) | None — intentionally deferred (G5) |

---

## 5. Recommended Fix Order (safest first)

1. **G1 (P1, ~1 icon button, zero backend risk):** render the Lab Orders trigger in `WorkspaceTopBar` wired to the already-passed `onLab`. Highest value-to-effort: unlocks a complete, tested backend workflow. Do first.
2. **G9 (P3, FE-only):** gate Notes/Medical-History affordance with existing `lib/rbac.ts`. Trivial, removes misleading affordances, mirrors backend.
3. **G10 (P3, backend shape):** normalize occlusion/postop/inventory list shapes to `{data,pagination}` **before** wiring their UIs (prevents a drift bug in G2/G6/G7).
4. **G3 (P1, read-mostly):** consent history view + revoke action (`listConsentForms`/`listConsentRefusals`/`revokeConsentForm`). Read paths + one guarded write; backend done.
5. **G4 (P1, read + guarded lifecycle):** prescription list + dispense/cancel (`listPrescriptions`/`updatePrescription`).
6. **G5 (P2, read-only):** amendment list on the record (`listAmendments`); keep approval deferred (BR-019).
7. **G2 / G6 / G7 (P1/P2, new surfaces — need product call):** occlusion screening surface, post-op template manager, inventory screen. Larger; gated on the `[NEEDS CONFIRMATION]` items below and on G10 first.
8. **G8 (P3):** defer (needs a new list endpoint).

---

## 6. Dependencies on Other Modules

- **G1 / G9** → `org-context` role store + `lib/rbac.ts` (both present); no backend change.
- **G3 / G4 / G5** → self-contained in `dental-clinical`; backend handlers + FSM already exist. Consent revoke writes a `dental_audit_log` row (audit module) — already implemented.
- **G2 / G6 / G7** → new FE surfaces. Post-op manager + Inventory likely belong under **clinic settings/admin** (`dental-org` settings area) and reuse the branch-scope/role guards from `handlers/shared/`. Inventory create/adjust is `dentist_owner`/`staff_full` (matches the org/admin surface).
- **G6 attach-post-op** → links to completed procedures in `dental-visit`; **G2 occlusion** is patient/visit-scoped (workspace).
- **G10** → coordinate with the IDEAL §3.14 "list-response-shape" sweep (also touches other modules).
- **No schema/migration changes required** — all tables + endpoints exist. G8 alone would need a new `listMedicalHistoryReviews` endpoint.

---

## 7. Tests Required Before This Module Can Be Considered Fixed

- **G1:** FE unit — `WorkspaceTopBar` renders a Lab button that fires `onLab` (RED first: assert absent today → present after). E2E: open Lab Orders sheet → create order → advance `ordered→in_fabrication→delivered→fitted` → status reflects. (Backend FSM already tested.)
- **G2:** FE unit + E2E — occlusion screening create → appears in list; backend create/list already have RBAC tests, add if missing.
- **G3:** FE unit — consent history lists signed/pending/revoked + refusals; Revoke action on a *pending* form calls `revokeConsentForm` and a *signed* form offers no revoke (mirror backend 422). E2E: capture → revoke pending → state = revoked.
- **G4:** FE unit — prescription list renders from `listPrescriptions`; dispense/cancel calls `updatePrescription`; invalid transition surfaces error (backend `INVALID_PRESCRIPTION_TRANSITION` already 422-tested).
- **G5:** FE unit — amendment list renders prior amendments on a record from `listAmendments` (create→appears). Approval remains gated off (BR-019) — assert the approve affordance is hidden when flag is false.
- **G9:** FE unit — Notes/Medical-History affordance hidden for `hygienist`/`front_desk` per the V-CLI-002 matrix, shown for `dentist_owner`/`staff_full`.
- **G10:** contract/unit — occlusion/postop/inventory list endpoints return `{data,pagination}` (or document bare-array as intended).
- **G6/G7:** FE unit + E2E for the new manager screens once product-confirmed.
- **Regression gate:** `bun test` (api-ts + apps/dentalemon) + `bun run typecheck` green, no regressions; api-ts backend tests via `scripts/test-with-db.ts` (not `bun test <path>`); restart the dev server before `test:contract` to avoid stale-handler drift.

---

## 8. `[NEEDS CONFIRMATION]`

1. **G1 Lab Orders:** Is the missing top-bar button an oversight (wire it) or was Lab Orders intentionally hidden for this release? The mounted sheet + dashboard count + passed `onLab` strongly imply oversight. → wire vs. formally hide.
2. **G2 Occlusion screening:** Wire now (built + V1-Recommended, §3.4) or formally defer in §3.14? If defer, stop listing it as implemented.
3. **G6 Post-op templates:** Wire now (built + V1-Recommended, §3.12) or formally defer? If wired, where — clinic settings + completed-procedure attach?
4. **G7 Inventory:** Wire now (built + V1-Recommended, §3.11 says "NOT missing") or formally defer? §3.11's "IMPLEMENTED" claim is **backend-only** — the FE is absent; the standard should be corrected either way.
5. **G3/G4 lifecycle writes:** Are consent-revoke and Rx-cancel V1-required or V1-recommended? They are clinical-legal corrections (lean required); confirm priority.
6. **G10 list shapes:** Confirm `{data,pagination}` is the intended contract for occlusion/postop/inventory before wiring.

---

## 9. Evidence

- Live drive (logged in `dentist_owner`, patient Maria Santos, active visit `ca42740d-…`): `outputs/dental-clinical-audit/final_runs/run_1/` — `final_script.py`, `final_script_log.txt`, screenshots: `final_execution_3_affordance_bar.png` (top-bar affordances; **no Lab**), `..._4_rx_create_only.png`, `..._5_consent_no_revoke_no_list.png`, `..._6_medical_history.png`, `..._7_attachments.png`. Plus `outputs/dental-clinical-audit/shots/14_ws_full` aria enumeration.
- **G1 source confirmation:** `apps/dentalemon/src/features/workspace/components/workspace-top-bar.tsx` — `onLab` declared (line 24) + destructured (line 90) but **never rendered**; only Rx/Consent/Notes/Attachments/Treatment-Plan/Complete/Fullscreen buttons exist. `$patientId.tsx:236` passes `onLab`; `:450` mounts `LabOrdersSheet`. No other `setLabOrdersSheetOpen` trigger exists.
- **Zero-FE confirmation (G2/G6/G7):** `grep -riE 'occlusion|postop|post-op|inventory' apps/dentalemon/src` → no matches.
- **Create-only/unwired confirmation (G3/G4/G5):** SDK fns `revokeConsentForm`, `listConsentRefusals`, `listPrescriptions`, `updatePrescription`, `listAmendments`, `approveAmendment`, `createMedicalHistoryReview` → 0 FE consumer files. **Exception (adjusted 2026-06-09):** `listConsentForms` → **1** consumer (`pre-completion-checklist.tsx`, used as a read-only completion gate, *not* a history/revoke surface — the gap stands). `getMedicalHistoryReview` → **1** consumer (`use-medical-history-review.ts`, reads latest only — consistent with G8).
- **Backend correctness (not a regression):** `assertBranchRole` enforced on every mutation (prescriptions/consents/amendments/labs/attachments/occlusion/postop/inventory); FSMs + immutability (`BR-003`, signed-consent) + audit logging present and unit/contract tested (e.g. `em-cli-005`, `em-cli-011`, `v-cli-002`, `prescription.status.test.ts`, `consent-revoke-route.test.ts`). Allergy + drug-interaction safety floor returned non-blocking on Rx create.

---

## 10. Knowledge-Graph & Test-Coverage Validation Pass (added 2026-06-09)

> Second pass per the test-coverage / KG-validation protocol. **No new audit; validates §1–§9 against the knowledge graph + ground-truth code, then specifies the missing TDD coverage and per-gap regression proofs.** Mode unchanged: **report-only, no fixes.**

### 10.1 Existing Audit Validation (confirmed / adjusted / corrected)

| Finding | Verdict | Evidence |
|---|---|---|
| **G1** Lab sheet unreachable (no top-bar button) | **CONFIRMED + STRENGTHENED** | `workspace-top-bar.tsx` renders only Rx/Consent/Notes/Attachments/Treatment-Plan/Complete/Fullscreen (lines 177–198); `onLab` declared L24, destructured L90, **never used in JSX**. **New:** the gap is *masked by a false-green E2E* (`lab-order-tracking.spec.ts` drives the whole lifecycle via raw `fetch()` in `page.evaluate()` — never opens `LabOrdersSheet`; its own header says "tests the API integration portion"). This is why CI is green while the UI dead-ends. |
| **G3** Consent revoke/history invisible | **ADJUSTED** | `revokeConsentForm` + `listConsentRefusals` = **0** FE consumers (confirmed). **Correction:** `listConsentForms` = **1** consumer (`pre-completion-checklist.tsx`, read-only completion gate). The user-facing gap (no history view, no revoke, no refusals list) **still stands**; only the "0 consumer" evidence was wrong. |
| **G4** Rx list + dispense/cancel unsurfaced | **CONFIRMED** | `listPrescriptions`, `updatePrescription` = 0 FE consumers. |
| **G5** Amendments write-only | **CONFIRMED** | `listAmendments`, `approveAmendment` = 0 FE consumers; `amendment-form.test.ts` covers create only (3 tests: disabled-until-valid, submit, error). |
| **G2 / G6 / G7** occlusion / postop / inventory zero-FE | **CONFIRMED** | 0 FE consumers each; backend handlers + bun tests exist. |
| **G8** medical-history review-history unsurfaced | **CONFIRMED** | `getMedicalHistoryReview` = 1 consumer (`use-medical-history-review.ts`) reading *latest only* — matches the finding. |
| **G10** bare-array list shapes | **CONFIRMED (exact)** | `listOcclusionScreenings`→`ctx.json(screenings)`, `listPostopTemplates`→`ctx.json(templates)`, `listInventoryItems`/`listInventoryAdjustments`→`ctx.json(items, 200)` vs `listPrescriptions`/`listConsentForms`→`{data, pagination}`. |
| **G9** FE affordance role-gating | CONFIRMED | `workspace-top-bar.test.ts` proves Rx/Consent/Treatment-Plan are gated and Notes/Attachments are shown-to-all; no test for medical-history role parity. |

### 10.2 Knowledge Graph Findings (wiring / dependency / blast radius)

- **Graph staleness — did NOT regenerate (per instructions).** `.understand-anything/meta.json` snapshot = commit `1196799b` (2026-06-06); HEAD = `e49e411d` (2026-06-08). Two clinical-touching commits landed since: `27bfb0ee` (BR-003 Rx field-edit guard) and `088332f1` (docs). The drift is one known guard change already reflected in §1 (BR-003 visit-lock) — not worth a full ~2,681-file re-analysis. **All wiring claims below were re-validated against ground-truth code (`grep`/`Read`) and the freshly-regenerated `.understand-anything/contract-spine.json` (operationId→handler→SDK→FE, mtime 2026-06-09), not the stale node graph.** `[NEEDS CONFIRMATION]` only if a future structural question can't be answered from code — then refresh.
- **G1 wiring chain (verified in code):** `$patientId.tsx:236` passes `onLab` → `WorkspaceTopBar` (consumes nothing) ✗ break here ✗ → `LabOrdersSheet` mounted `$patientId.tsx:450` → SDK `createLabOrder/listLabOrders/updateLabOrder` → handlers + FSM. The single missing edge is **top-bar button → `onLab`**; everything downstream is wired and tested.
- **Consumer-detection blast radius:** the only cross-surface consumer of a "clinical" list endpoint is `pre-completion-checklist.tsx`→`listConsentForms`. Wiring G3's revoke must **not** alter the completion-gate read (shared endpoint, different intent) — add a history surface, don't repurpose the checklist call.
- **Cross-module edges (from code):** clinical repos expose facades consumed by other modules — `org-clinical.facade.ts`, `clinical-visit.facade.ts`, `clinical-imaging.facade.ts`, `clinical-billing`/`consent-billing.facade.ts`, `clinical-pmd.facade.ts`, `clinical-erasure.facade.ts`, `case-presentation-consent.facade.ts`. **Blast radius for G3 (consent):** `consent-billing.facade.ts` + `case-presentation-consent.facade.ts` read consent state — a revoke transition must be checked against case-presentation/billing consumers (a revoked consent should not silently invalidate an accepted case-presentation). Flag as regression surface for G3.
- **No schema/migration drift** between snapshot and HEAD for clinical tables — all `*.schema.ts` (lab-order, occlusion, postop, inventory, amendment, prescription, consent, medical-history) present at HEAD.

### 10.3 Existing Test Coverage Found

**Backend (32 test files in `handlers/dental-clinical/`) — STRONG; the "unwired" endpoints mostly already have unit coverage:**
- Prescriptions: `prescription.status.test.ts`, `prescription.fsm.property.test.ts`, `clinical-prescription-history.test.ts`, `*.prescription-allergy-check`, `*.drug-interaction-check`, `*.prescription-legal-fields`, `em-cli-005.prescriber-membership-validation`.
- Consent/refusal/lab: `consent-revoke-route.test.ts`, `*.consent-content`, `clinical-consent-lab.test.ts`, `repos/lab-order.test.ts`.
- Occlusion / postop / inventory: `dental-clinical-occlusion.test.ts`, `dental-clinical-postop.test.ts`, `dental-clinical-inventory.test.ts`.
- Amendments / med-history / attachments / events / acceptance: `em-cli-011.amendment-role-guard`, `clinical-attachment-amendment`, `repos/amendment.test.ts`, `*.medical-history-review`, `v-cli-002.medical-history-role-guard`, `repos/medical-history.test.ts`, `repos/attachment.test.ts`, `dental-clinical-events.test.ts`, `acceptance.clinical-workflows.test.ts`.

**Contract (`specs/api/tests/contract/dental-clinical.hurl`):** covers prescriptions (POST/GET/**PATCH dispense-cancel**), consents (POST/GET/**sign** + immutable re-sign), attachments (POST/GET/DELETE), **lab-orders full FSM** (POST/GET/PATCH advance ×3 + cancel + invalid-skip→4xx), medical-history (POST/GET/PATCH), **amendments (POST/GET)**, treatment-templates, notes/addendum/history. → The list+lifecycle endpoints behind G4/G5 and the lab FSM behind G1 **already have contract proof** at the API layer.

**Frontend (~60 workspace test files):**
- `lab-orders-sheet.test.ts` — `validateLabOrderForm`, `STATUS_LABELS` (5), `NEXT_STATUS` chain, `labOrderDueState`. **Sheet logic well-covered; reachability NOT covered.**
- `workspace-top-bar.test.ts` — dentist-only gate (Rx/Consent/Treatment-Plan shown vs hidden; Notes/Attachments shown-to-all). **No Lab assertion; no med-history role parity.**
- `consent-sheet.test.ts` (5) — create + informed-refusal POST. No revoke/list.
- `rx-sheet.test.ts` — allergy/interaction banner. No list/dispense/cancel.
- `amendment-form.test.ts` (3) — create only. No list/approve.
- `pre-completion-checklist.test.ts`, `medical-history-form.test.ts`, `attachments-sheet.test.ts`, `soap-notes-sheet.test.ts`, etc.

**E2E (`apps/dentalemon/tests/e2e/`):**
- `consent-signing.spec.ts` — **genuinely UI-driven** (clicks `Consent` button, opens `consent-sheet`, signs canvas, saves; + immutable re-sign). Good model.
- `lab-order-tracking.spec.ts` — **API-only false-green** (raw `fetch` lifecycle; never opens the sheet). **Mislabeled as a UI journey; must be hardened or relabeled — see G1.**
- `clinical-billing-handoff.spec.ts`, `workspace-readonly.spec.ts`, `ipad-workspace.spec.ts`, `workspace-empty-states.spec.ts`.

**Contract coverage GAPS (zero hurl coverage):** occlusion, postop, inventory, **consent revoke**, **consent-refusals list**.

### 10.4 Missing Test Coverage

| Gap / Risk | Missing Test | Test Type | Priority | Why It Matters |
|---|---|---|---|---|
| **G1** Lab button absent | `workspace-top-bar` renders a `Lab` button wired to `onLab` (RED: absent today → GREEN after) | FE unit | **P0** | The single regression that pins the fix; nothing currently asserts the button exists. |
| **G1** false-green E2E | Real UI-driven journey: open workspace → click Lab → `LabOrdersSheet` opens → create → advance FSM via UI controls | E2E | **P0** | `lab-order-tracking.spec.ts` passes without touching the UI; a true journey is the only thing that would have caught the dead-end. |
| **G1** E2E mislabel | Rename/annotate `lab-order-tracking.spec.ts` as `*-api.spec.ts` (API-integration) so it stops masquerading as a UI journey | E2E hygiene | **P1** | Prevents the same false-green from re-hiding a future UI regression. |
| **G3** consent revoke | `revokeConsentForm` on a **pending** form → state `revoked`; a **signed** form offers **no** revoke (mirror backend 422) | FE unit | **P1** | Pending consents captured in error are unrecoverable from the UI today. |
| **G3** consent history | history view lists signed/pending/revoked + refusals from `listConsentForms`/`listConsentRefusals` | FE unit | **P1** | No provenance view exists. |
| **G3** revoke contract | hurl: capture → revoke pending → `revoked`; revoke signed → 422; refusals list → `{data,pagination}` | Contract/integration | **P1** | `revokeConsentForm`/`listConsentRefusals` have **zero** contract coverage (backend-unit only). |
| **G3** revoke blast radius | revoking a consent does **not** invalidate an already-accepted case-presentation / billed treatment (`consent-billing` + `case-presentation-consent` facades) | Integration | **P1** | Cross-module facades read consent state; silent invalidation = data-integrity bug. |
| **G4** Rx list | prescription list renders from `listPrescriptions` (per patient/visit) | FE unit | **P1** | No medication-record review exists. |
| **G4** Rx dispense/cancel | dispense/cancel calls `updatePrescription`; invalid transition surfaces the 422 (`INVALID_PRESCRIPTION_TRANSITION`) | FE unit | **P1** | No way to void an erroneous Rx from the UI. |
| **G4** Rx lifecycle E2E | UI: write Rx → see it in list → cancel → state reflects | E2E | **P2** | End-to-end medication-record proof (backend FSM + hurl PATCH already exist). |
| **G5** amendment list | prior amendments render on the record from `listAmendments` (create → appears); approve affordance **hidden** while `dental_clinical_amendment_approval` is false | FE unit | **P2** | Corrections are write-only in the UI; addendum-not-silent-edit rule needs a read-back. |
| **G9** med-history role parity | Notes/Medical-History affordance hidden for `hygienist`/`front_desk`, shown for `dentist_owner`/`staff_full` (V-CLI-002 matrix) | FE unit | **P2** | Restricted roles see controls that 403 on submit (looks broken). |
| **G2** occlusion | create → appears in list; list returns the agreed shape (see G10) | FE unit + contract | **P1** (after product call) | V1-Recommended capability with zero FE + zero contract coverage. |
| **G6** postop | template author/list/update surface; list shape (G10) | FE unit + contract | **P2** | Zero FE + zero contract. |
| **G7** inventory | items list + stock adjust + low-stock flag; append-only ledger; list shape (G10) | FE unit + contract | **P2** | Zero FE + zero contract. |
| **G10** list-shape | occlusion/postop/inventory list endpoints return `{data,pagination}` (or document bare-array as intended) | Contract/unit | **P1** *(blocks G2/G6/G7 wiring)* | Wiring a UI to a bare array that later becomes an envelope = guaranteed drift bug. |
| **G8** med-history review trail | (only if pursued) `listMedicalHistoryReviews` endpoint + list — needs new endpoint | Backend + FE | **P3** | Deferred; minor audit-trail nicety. |

### 10.5 Fix-Plan Adjustments

1. **G1 jumps to P0 for test purposes** (the *fix* is still a 1-button change, but it must land **with** a top-bar unit test AND a real UI E2E — because the existing E2E is a false-green that will otherwise keep the gap "green"). Treat the false-green E2E as a finding in its own right: harden/relabel it.
2. **G10 must precede G2/G6/G7 AND add contract coverage in the same step.** Occlusion/postop/inventory currently have **zero** contract tests; normalize the shape and pin it with hurl before any FE wiring, so the FE is built against a contract-locked envelope.
3. **G3 grows a contract + a cross-module regression.** Add hurl coverage for revoke + refusals-list (currently backend-unit only) and an integration check that revoke doesn't invalidate accepted case-presentations/billing (facade blast radius from §10.2).
4. **No fix-order *reordering* otherwise** — the safest-first sequence in §5 holds. The change is *depth of proof per step*, not order.

### 10.6 Updated Test-First Fix Sequence (TDD: RED → smallest fix → GREEN/regression)

1. **G1** — RED: add `workspace-top-bar.test.ts` case asserting a `Lab` button exists and fires `onLab` (fails today). → Fix: render one `IconButton label="Lab orders"` wired to `onLab`. → GREEN: unit passes **+** add a real UI E2E (`lab-orders-ui.spec.ts`) that opens the sheet from the top bar and advances the FSM through UI controls; relabel `lab-order-tracking.spec.ts`→`*-api.spec.ts`.
2. **G9** — RED: top-bar test asserting Notes/Medical-History hidden for `hygienist`/`front_desk`. → Fix: gate with `lib/rbac.ts`. → GREEN: role-matrix unit passes.
3. **G10** — RED: contract/unit asserting occlusion/postop/inventory list = `{data,pagination}` (fails — bare array today). → Fix: wrap the three handlers in the envelope + `buildPaginationMeta`. → GREEN: contract passes (do this **before** G2/G6/G7).
4. **G3** — RED: FE unit (revoke pending → revoked; signed → no revoke) + hurl (revoke + refusals-list) + integration (revoke ⇏ invalidate accepted case-presentation). → Fix: consent-history view + revoke action. → GREEN: all three layers pass; pre-completion-checklist gate unchanged.
5. **G4** — RED: FE unit (list renders; dispense/cancel; invalid→422). → Fix: Rx list + lifecycle actions. → GREEN: unit + (optional) E2E.
6. **G5** — RED: FE unit (amendment list renders prior amendments; approve hidden while flag false). → Fix: amendment list on the record. → GREEN.
7. **G2 / G6 / G7** — (after product `[NEEDS CONFIRMATION]` + G10) RED: FE unit + contract per surface. → Fix: build the surface. → GREEN.
8. **G8** — deferred (needs new endpoint).

**Regression gate (unchanged):** api-ts backend tests via `scripts/test-with-db.ts` (NOT `bun test <path>`); **restart the dev server before `test:contract`** to avoid stale-handler drift; `bun test` (api-ts + apps/dentalemon) + `bun run typecheck` green with no regressions.

### 10.7 Cross-Module Dependencies / Blast Radius (test-relevant)

- **G1/G9** → `org-context` role store + `lib/rbac.ts` (present); FE-only, no backend/contract change.
- **G3 consent** → **`consent-billing.facade.ts`** + **`case-presentation-consent.facade.ts`** read consent state → revoke needs an integration regression that it doesn't invalidate accepted case-presentations or billed work; writes a `dental_audit_log` row (audit module — already implemented).
- **G3/G4/G5** otherwise self-contained in `dental-clinical` (backend + FSM exist).
- **G2 occlusion** patient/visit-scoped (workspace); **G6 post-op attach** links to completed procedures in **`dental-visit`**; **G6/G7 managers** likely live under **`dental-org`** settings/admin and reuse `handlers/shared/` branch-scope guards.
- **G10** coordinates with the IDEAL §3.14 list-response-shape sweep (touches other modules) — keep the envelope shape identical across modules.
- **No schema/migration changes** for G1–G7/G9/G10; **G8** alone needs a new `listMedicalHistoryReviews` endpoint.
