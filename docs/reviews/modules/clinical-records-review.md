# Clinical Records — Standards & Experience Review
> Review date 2026-06-02 · Depth: DEEP · Sub-areas: Rx · Consent · Lab orders · Medical history · Amendments

## 1. What we have   (cite spec + code per sub-area)

**Prescriptions.** Visit-scoped Rx with branch + role auth (`dentist_owner`/`dentist_associate` only), prescriber-membership validation (EM-CLI-005), a `pending → dispensed|cancelled` status FSM, and audit logging (`prescription.created`). Fields: `drugName`, `rxNormCode?`, `dosage`, `frequency`, `duration?`, `quantity?`, `instructions?`, `dispenseAsWritten`. A **non-blocking drug-allergy cross-check** runs at create time against the patient's active `allergy` medical-history entries and returns `warnings.allergyConflicts` (`prescriptions/createPrescription.ts:50-61,96-98`; schema `repos/prescription.schema.ts`). UI form `rx-sheet.tsx` matches the screenshot (`05-prescription-form.png`): frequency dropdown OD/BID/TID/QID/PRN/Stat is clinically correct.

**Informed consent.** `createConsentForm` (dentist-only, V-CLN-006) → `signConsentForm` (immutable after sign, 422 `CONSENT_FORM_SIGNED`, V-CLN-005) → optional `revokeConsentForm` (DE-013). Schema (`repos/consent-form.schema.ts`): `templateId`, `templateName`, `signedAt`, `signatureData`, `signed`, `acceptedPlanVersionId?`, revocation fields. UI `consent-sheet.tsx` captures a canvas signature and 5 procedure-named templates (general/extraction/root-canal/implant/x-ray). Satisfies BR-014 (immutable once signed).

**Lab orders.** Full **5-state FSM** `ordered → in_fabrication → delivered → fitted` (+`cancelled`), forward-only, with per-stage timestamps (`orderedAt`, `expectedDeliveryDate`, `deliveredAt`, `fittedAt`, `cancelledAt`), defect/replacement linkage, and audit events (`lab_order.created`, `lab_order.completed` on `delivered`). Fields: `toothFdi?`, `labName`, `description`, `expectedDeliveryDate?` (`repos/lab-order.schema.ts`, `lab-orders/createLabOrder.ts`, `updateLabOrder.ts`). UI `lab-orders-sheet.tsx` lists orders with a one-tap "Mark as <next>" advance button. **Note:** spec MODULE_SPEC §line119 and BR-018 describe a *3-state* `ordered→in_progress→completed` machine — code is richer (5-state) and has diverged from spec text.

**Medical history.** Append-only entries (`medical_history_entry`) with `entryType` enum (condition/medication/allergy/procedure/vaccination/family_history), code system/code, `displayName`, `active` flag (`repos/medical-history.schema.ts`). No PATCH/DELETE routes — append-only at router level (MODULE_SPEC AC-CLI-005). UI `medical-history-form.tsx` offers preset checkboxes for conditions/meds/allergies plus surgical history, pregnancy, smoking, alcohol; allergies render in a red "Critical" section.

**Amendments.** Additive-only `amendment` table: `authorMemberId`, `originalRecordType`, `originalRecordId` (polymorphic), `reason`, `content` (`repos/amendment.schema.ts`). `createAmendment` validates the original in-module record resolves, asserts dentist role (EM-CLI-011), and writes a `clinical.amendment.created` audit row referencing both records. `AmendmentRepository` exposes **no update/delete** — append-only by construction. UI `amendment-form.tsx` exists (reason + ≥10-char content). `approveAmendment` is a deliberate **501 stub** (BR-019 supervisor approval deferred behind `dental_clinical_amendment_approval` flag).

## 2. Industry-standard benchmark   (see ../research/clinical-records.md)

Mature PM systems (Open Dental, CareStack) gate prescribing on de-duplicated problem/medication/**allergy** lists with point-of-care alerts and certified eRx (drug-drug/drug-allergy + EPCS); the patient header allergy must surface *at prescribe time*. ADA requires **per-procedure informed consent** capturing nature/benefits/**risks/alternatives/risks of non-treatment**, recording either consent **or informed refusal**, with an **immutable, attributed e-signature**. Lab case management runs a sent→in-production→received→seated lifecycle capturing **shade, material, tooth, due date, lab, cost** with due-date dashboards and appointment-linked readiness alerts. Medical history captures conditions/meds/allergies + **ASA Physical Status** and is **periodically re-confirmed** (every 3–6 months). HIPAA §164.526 + CMS require **append-only** records with addenda/late-entries, current (non-backdated) timestamps, author attribution, and tamper-proof audit trails. (../research/clinical-records.md §1–5)

## 3. Completeness gaps

| Sub-area | Capability | Industry/legal benchmark | Our status | Evidence (file) | Severity |
|---|---|---|---|---|---|
| Rx | Drug-allergy check **visible to prescriber** | Alert fires at prescribe time | ⚠️ Backend computes `warnings.allergyConflicts` but UI **discards it** | `rx-sheet.tsx:59-76` (no read of response), `createPrescription.ts:96-98` | P1 |
| Rx | Drug-drug interaction check | Against active med list | ❌ None — only allergy substring match | `createPrescription.ts:50-61` | P1 |
| Rx | Allergy match quality | Coded (RxNorm/SNOMED) ingredient match | ⚠️ Naive case-insensitive substring on free-text `displayName` | `createPrescription.ts:60` | P2 |
| Rx | Required legal fields (patient address, prescriber DEA/NPI/license) | 21 CFR 1306 | ❌ None captured | `prescription.schema.ts` | P2 |
| Rx | Controlled-substance schedule / EPCS | DEA, ~35 states + Medicare | ❌ No schedule field, no eRx | `prescription.schema.ts` | P2 |
| Consent | Risks / alternatives / non-treatment captured | ADA | ❌ Only template name + signature; no clinical content | `consent-form.schema.ts`, grep=0 hits | P1 |
| Consent | **Informed refusal** capture | ADA / medico-legal | ❌ No refusal path — only grant-or-nothing | `signConsentForm.ts`, `consent-sheet.tsx` | P1 |
| Consent | Per-procedure forms | ADA | ✅ 5 procedure templates | `consent-sheet.tsx:13-19` | — |
| Consent | Immutable attributed e-sig | FDA/HHS | ✅ Immutable after sign + audit | `signConsentForm.ts:39-61` | — |
| Lab | Full lifecycle FSM + timestamps | sent→production→received→seated | ✅ 5-state, forward-only, dated | `lab-order.schema.ts:47-53` | — |
| Lab | Shade / material fields | Industry order fields | ❌ Not captured (only tooth, lab, description) | `lab-order.schema.ts`, `lab-orders-sheet.tsx` | P2 |
| Lab | Due-date alerts / overdue dashboard | Best practice | ❌ `expectedDeliveryDate` stored but no alerting/filter UI | `lab-orders-sheet.tsx` (no due-date surfacing) | P2 |
| Lab | Spec/code FSM agreement | — | ⚠️ Code 5-state vs BR-018/spec 3-state text | `lab-order.schema.ts` vs `BUSINESS_RULES.md:62` | P2 |
| Med Hx | Structured conditions/meds/allergies | Drives alerts | ✅ Typed entries + active flag | `medical-history.schema.ts` | — |
| Med Hx | **ASA Physical Status** classification | Risk/sedation | ❌ No ASA field | grep=0 hits | P1 |
| Med Hx | **Periodic re-confirmation** prompt + timestamp | Every 3–6 mo | ❌ No `reviewedAt`/re-attestation | grep=0 hits | P1 |
| Med Hx | Allergy surfaced at point of care (Rx/tx) | Open Dental | ⚠️ Header badge only; not wired into Rx UI | `05-prescription-form.png` (badge present, form silent) | P1 |
| Amend | Append-only original preserved | HIPAA §164.526 | ✅ No update/delete; polymorphic link + reason | `amendment.repo.ts` (no mutators), `amendment.schema.ts` | — |
| Amend | Tamper-proof audit (who/when/what) | CMS | ✅ `clinical.amendment.created` audit row | `createAmendment.ts:93-109` | — |
| Amend | Addendum vs late-entry typing; current non-backdated ts | CMS | ⚠️ Reasons are correction/finding/clarification; created_at server-set (good) but no addendum/late-entry distinction | `amendment-form.tsx:11-15` | P3 |
| Amend | §164.526 accept/deny + recipient notification | HIPAA | ❌ Deferred (501 stub) | `approveAmendment.ts:26-31` | P2 |

## 4. UX/UI assessment   (Nielsen + WCAG; safety-critical)

**The headline safety defect is allergy invisibility at prescribe time.** The patient header shows a red **"Penicillin allergy"** badge (`05-prescription-form.png`), and the backend *does* return `warnings.allergyConflicts` from `createPrescription` — but `rx-sheet.tsx` ignores the response (`await createPrescription(...)` with no destructure of `data`/`warnings`, then `onSaved()` and close, lines 59-76). A clinician can prescribe Penicillin to a Penicillin-allergic patient and see **zero warning, zero confirmation, no post-save toast**. This violates Nielsen #5 (error prevention) and #1 (visibility of system status) on a patient-safety-critical action. The check exists; it is simply not surfaced. **P1.** Recommendation: read the response, show a blocking confirm dialog ("⚠ Patient is allergic to Penicillin — prescribe anyway?") before commit, and persist the override acknowledgement.

**Consent.** Signature canvas is touch-friendly (`touch-none`, pointer events) and immutability is well-signalled ("✓ Consent form signed and saved"). But the form shows **no template body text** to the patient and captures **no risks/alternatives/refusal** — so the signature attests to a title, not an informed discussion (Nielsen #2 match-to-real-world; medico-legal gap). Canvas has an `aria-label` but no keyboard alternative (WCAG 2.1.1) — acceptable for a wet-signature surface but should offer a typed-name fallback.

**Lab orders.** Clean status pills with semantic colors and a single "Mark as <next>" CTA — good progressive disclosure. Gaps: no due-date display on cards despite storing `expectedDeliveryDate`, no overdue highlighting, no shade/material inputs. Cancel uses a hard-coded reason ("Cancelled by user") — no prompt (minor).

**Medical history.** Allergies correctly elevated into a red "Critical" section with severity notes (good safety hierarchy). Checkbox rows have `role="checkbox"` + `aria-checked` + `tabIndex` (WCAG-aware), though `onKeyDown` only handles Space, not Enter. No ASA selector and no "last reviewed / re-confirm" affordance.

**Amendments.** Solid: explicit reason taxonomy, ≥10-char minimum, and (notably) it correctly inspects the `{ error }` result instead of silently closing on failure — better error handling than `rx-sheet`/`consent-sheet`, which both close on success without checking the response. **DESIGN.md fidelity:** all sheets use the #FFE97D lemon accent + rounded-2xl Apple-HIG sheet pattern consistently.

## 5. Findings (P0–P3)

- **[P1] Drug-allergy warning is computed but never shown** — `createPrescription.ts:96-98` returns `warnings.allergyConflicts`; `rx-sheet.tsx:59-76` discards the response and closes silently. With a visible "Penicillin allergy" header badge, the prescriber gets no alert. → Read the response, gate save behind a confirm-with-override dialog, persist the override.
- **[P1] No drug-drug interaction checking** — only a substring allergy match exists (`createPrescription.ts:50-61`); active-medication interactions are unchecked. → Add an interaction check against `entryType='medication'` entries (or integrate a coded interaction source); tier severity.
- **[P1] Consent captures no risks/alternatives/non-treatment and no informed refusal** — `consent-form.schema.ts` stores only template id/name + signature; grep finds zero risk/alternatives/refusal fields. → Add structured consent content (risks, alternatives, non-treatment) and a refusal record path with its own attributed signature/timestamp.
- **[P1] No ASA Physical Status classification** — absent from `medical-history.schema.ts` and UI. → Add an `asa_class` field (I–VI + E) at patient/visit level for risk stratification.
- **[P1] No periodic medical-history re-confirmation** — no `reviewedAt`/re-attestation field or prompt. → Add last-reviewed timestamp + a 3–6-month re-confirm prompt surfaced in the workspace.
- **[P2] Lab orders lack shade/material fields and due-date alerting** — `lab-order.schema.ts` has tooth/lab/description/date only; `lab-orders-sheet.tsx` never surfaces the due date or overdue state. → Add `shade`/`material`; show due date + overdue badge on cards.
- **[P2] Lab-order FSM diverged from spec text** — code is 5-state (`ordered→in_fabrication→delivered→fitted`), BR-018/MODULE_SPEC §119 say 3-state (`ordered→in_progress→completed`). → Reconcile spec to code (code is the better model).
- **[P2] Rx omits legally-required fields** (patient address, prescriber DEA/NPI/license) and **controlled-substance schedule / EPCS**. → Add fields if controlled-substance prescribing is in scope; otherwise document the out-of-scope decision.
- **[P2] HIPAA §164.526 amendment workflow deferred** — `approveAmendment.ts` is a 501 stub (accept/deny + recipient notification not built). Acceptable as a documented deferral; revisit before any regulated launch.
- **[P3] Amendments don't distinguish addendum vs late-entry** per CMS; reasons are correction/finding/clarification only. Server-set timestamps are correct (non-backdated). → Optional: add CMS-aligned entry typing.
- **[P3] rx-sheet / consent-sheet don't check API error result** — both close on success without inspecting `{ error }` (unlike `amendment-form.tsx`). → Mirror the amendment-form error-handling pattern.

## 6. Carousel implications

Consent, Rx, and lab orders are all **visit-scoped, immutable artifacts** — exactly the cumulative-snapshot model the carousel expects. Each signed consent (`acceptedPlanVersionId` links it to the plan version), each prescription, and each lab-order milestone should appear as a dated chip on the visit's snapshot timeline; because consent is immutable post-sign and lab orders carry per-stage timestamps (`orderedAt`/`deliveredAt`/`fittedAt`), they render naturally as frozen timeline events without extra versioning work. Amendments should appear *alongside* (not replacing) their original record in the snapshot, preserving the append-only HIPAA story visually.

The biggest carousel/workspace opportunity is **medical-alert surfacing**: the "Penicillin allergy" badge already lives in the patient header, but it is inert at the point of prescribing. The workspace should treat active `allergy` (and high-significance condition/medication) entries as a persistent safety banner that (a) is always visible across all sheets, and (b) actively gates the Rx flow — closing the loop between the medical-history snapshot and the prescribe action. ASA class, once added, belongs in the same always-on header strip as a sedation/risk indicator.
