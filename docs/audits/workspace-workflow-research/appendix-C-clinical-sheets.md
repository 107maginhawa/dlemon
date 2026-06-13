<!-- Appendix C — Clinical sheets | researcher: workflow analyst | 2026-06-10 | branch: chore/workflow-verification-sweep | READ-ONLY research, no code -->

# Appendix C — Clinical Sheets (SOAP/notes · emr-consultation · Rx · consent · case-presentation · perio)

**Chunk:** C — Clinical sheets. **Surface:** SOAP/visit notes (sign + addendum), emr-consultation note (telemedicine), prescriptions (Rx), consent (grant + informed refusal, BR-014 immutable after sign), case-presentation / acceptance, periodontal charting.
**Backend dirs:** `services/api-ts/src/handlers/dental-visit/notes/`, `handlers/emr/`, `handlers/dental-clinical/{consent,prescriptions,amendments,lab-orders,...}`, `handlers/dental-patient/case-presentation/`, `handlers/dental-perio/`.
**FE:** `apps/dentalemon/src/features/workspace/components/{soap-notes-sheet,consent-sheet,rx-sheet,lab-orders-sheet,amendment-form,medical-history-sheet}.tsx` + `components/perio/` + `apps/dentalemon/src/features/case-presentation/` + route `routes/_workspace/$patientId.case-presentation.$presentationId.tsx`.
**Sources of truth read:** MODULE_SPECs (emr-consultation, dental-clinical, dental-perio); case-presentation gap-plan (spec surrogate — no MODULE_SPEC); `br-registry.json`; `business-rules.md`; `MASTER-GAP-MATRIX.md`; `.understand-anything/contract-spine.json` (dated 2026-06-09; 53 Chunk-C-relevant ops inspected for `frontendConsumers`).

> **Note on register status integrity.** Findings already in MASTER-GAP-MATRIX / module-gap-plans are tagged **KNOWN** with their id; nothing already catalogued is relabeled NEW. NEW rows were each verified absent from those docs and absent from the contract-spine / grep before assertion (see §4 rigor notes).

---

## (2) Baseline inventory — IMPLEMENTED workflows & business rules

Coverage cells cite a test file or `UNTESTED`. FE-wiring (`FE=n`) from contract-spine 2026-06-09.

| # | Workflow | FE entry (`file:line`) | Backend handler / endpoint | Governing rule ids | Coverage |
|---|----------|------------------------|----------------------------|--------------------|----------|
| C-01 | Draft/save SOAP visit note (S/O/A/P + notes) | `soap-notes-sheet.tsx:111` → `use-visit-notes` | `upsertVisitNotes.ts` `POST /dental/visits/:id/notes` (FE=2) | EM-VIS-007 visit-immutable; E2 assistant-draft; E3 hygiene-draft | BE `dental-visit.visit-note-persistence.test.ts`; FE `soap-notes-sheet.test.ts` |
| C-02 | Sign & lock SOAP note → v1 snapshot, immutable | `soap-notes-sheet.tsx:128` (`sign-lock-btn`) | `signVisitNotes.ts` `POST …/notes/sign` (FE=3) | E3 sign-role-by-visit-type; visit_note.signed audit (P1-B) | BE `dental-visit.signed-notes.test.ts`, `visit-notes-audit.test.ts`; FE `soap-notes-sheet.test.ts` |
| C-03 | Add immutable addendum to signed note (reason+content, version++) | `soap-notes-sheet.tsx:155` (`add-addendum-btn`) | `createVisitNoteAddendum.ts` `POST …/notes/addendum` (FE=1) | NOTE_NOT_SIGNED guard; visit_note.amended audit | BE `visit-notes-audit.test.ts`; FE `soap-notes-sheet.test.ts` |
| C-04 | Read note + version history | `soap-notes-sheet.tsx:383` | `getVisitNotes.ts` (FE=2) / `getVisitNoteHistory.ts` (FE=1) | — | BE `dental-visit.visit-note-persistence.test.ts` |
| C-05 | Create + sign consent form (ADA structured content + e-sig) | `consent-sheet.tsx:135` (`consent` mode) | `createConsentForm.ts` (FE=2) + `signConsentForm.ts` (FE=1) `POST …/consents{,/:id/sign}` | BR-014, V-CLN-005 immutable-after-sign, V-CLN-002 audit | BE `clinical-consent-lab.test.ts`, `repos/consent-form.test.ts`; FE `consent-sheet.test.ts`; E2E `consent-signing.spec.ts` |
| C-06 | Record informed refusal (attributed, immutable) | `consent-sheet.tsx:175` (`refusal` mode) | `recordConsentRefusal.ts` `POST …/consent-refusals` (FE=1) | P1-3 informed-refusal | BE `dental-clinical.consent-content.test.ts`; FE `consent-sheet.test.ts` |
| C-07 | Revoke a pending consent (pending→revoked) | **none (FE=0)** | `revokeConsentForm.ts` `PATCH …/consents/:cid/revoke` | WF-035, V-CLN-010, EM-CLI-001, CONSENT_ALREADY_SIGNED | BE `consent-revoke-route.test.ts`; FE `UNTESTED (no consumer)` |
| C-08 | Consent gate on treatment perform | (chart treatment row) | `dental-visit` treatment FSM | BR-006/BR-014 → 422 `TREATMENT_CONSENT_REQUIRED`; `VISIT_CONSENT_REQUIRED` at visit-complete | BE `treatment-fsm-http.test.ts:221`, `dental-visit.test.ts:1039` |
| C-09 | Consent gate on invoice | (billing) | `createDentalInvoice.ts:36-41` | BR-014 → 422 `CONSENT_REQUIRED` (`hasSignedConsentForVisit`) | BE `dental-billing.test.ts`, `billing-gate-http.test.ts` |
| C-10 | Write prescription (RxNorm, dose, allergy/interaction safety-floor) | `rx-sheet.tsx` → top-bar Rx | `createPrescription.ts` `POST …/prescriptions` (FE=1) | BR-017 prescriberMemberId; EM-CLI-005 membership; allergy/drug-interaction advisory | BE `em-cli-005…test.ts`, `*.prescription-allergy-check`, `*.drug-interaction-check`, `*.prescription-legal-fields`; FE `rx-sheet.test.ts` |
| C-11 | Rx status FSM (pending→dispensed/cancelled) + field-edit lock | **none (FE=0)** | `updatePrescription.ts` `PATCH …/prescriptions/:id` | EM-CLI-012 INVALID_PRESCRIPTION_TRANSITION; BR-003 field-edit lock | BE `prescription.status.test.ts`, `prescription.fsm.property.test.ts`; FE `UNTESTED (no consumer)` |
| C-12 | Clinical amendment (additive, original immutable) | `amendment-form.tsx` (create only) | `createAmendment.ts` (FE=1) `POST …/amendments` | BR-019 (approval NOT impl); WF-038; EM-CLI-011 role-guard | BE `em-cli-011…test.ts`, `repos/amendment.test.ts`; FE `amendment-form.test.ts` |
| C-13 | Create perio chart (one-per-visit) | `perio/perio-chart-overlay.tsx` → `use-perio-chart` | `createPerioChart.ts` `POST /dental/perio-charts` (FE=1) | BR-P01 409 CHART_EXISTS; BR-P05 role | BE `dental-perio-coverage.test.ts:201`; FE `perio-chart-overlay.test.tsx` |
| C-14 | Upsert tooth reading (6-site, BOP, CAL, mobility, furcation) | `perio/perio-site-cell.tsx` | `upsertToothReading.ts` `PUT …/readings/:tooth` (FE=1) | BR-P03 depth 0–20; BR-P04 FDI; BR-P06 idempotent upsert | BE `dental-perio-coverage.test.ts:298`, `perio-validation.test.ts`; FE `perio-site-cell.test.tsx` |
| C-15 | Complete perio chart → AAP/EFP 2017 stage/grade/extent + summary | `perio/perio-chart-overlay.tsx:314` | `completePerioChart.ts` `POST …/complete` (FE=3) | BR-P07 ≥16 readings; staging engine; perio.chart.completed audit | BE `dental-perio-coverage.test.ts`, `perio-classify-chart.test.ts`, `perio-staging.test.ts` |
| C-16 | Read perio chart / multi-exam comparison | `perio/perio-comparison.tsx` → `use-perio-history` | `getVisitPerioChart.ts` (FE=1), `getPerioChart.ts` (FE=0), `listPerioChartsForPatient.ts` (FE=1) | BR-P02 visit-lock cascade; numeric-coercion (P2-1 fixed) | BE `dental-perio-history.test.ts`; FE `perio-comparison.test.tsx`; E2E `journeys/03-perio-charting.journey.spec.ts` |
| C-17 | Case-presentation: create from presented plan (aggregate ₱/phases/alternates/images) | `case-presentation/use-case-presentations.ts` | `createCasePresentation.ts` (FE=3), `getCasePresentation.ts` (FE=1), `listCasePresentations.ts` (FE=1) | P1-20; G1/G2/G3 (FIXED B1) | BE `case-presentation-real-flow.test.ts`; FE `case-presentation-view.test.tsx`; contract `dental-treatment-coordinator.hurl` |
| C-18 | Case-presentation accept (e-sig consent + plan→approved + approval record) | route `$patientId.case-presentation.$presentationId.tsx` + `case-presentation-panel.tsx` | `acceptCasePresentation.ts` `POST …/accept` (FE=1) | PRESENTATION_DECIDED terminal; PLAN_INVALID_TRANSITION; PLAN_HAS_NO_ITEMS; case_presentation.accepted audit | BE `case-presentation-real-flow.test.ts`; live browser drive (B1) |
| C-19 | Case-presentation reject (plan→rejected, reason) | `case-presentation-view.tsx` | `rejectCasePresentation.ts` (FE=1) | terminal decision | BE `case-presentation.test.ts` |
| C-20 | EMR consultation note: create/update/finalize/read/list (telemedicine) | **none (FE=0 all 6 ops)** | `createConsultation/updateConsultation/finalizeConsultation/getConsultation/listConsultations/listEMRPatients` `/emr/...` | V-EMR-OWN ownership isolation; V-EMR-001 finalize-terminal; V-EMR-AUTH; V-EMR-003/004/005/006 audit | BE `emr-coverage.test.ts`, `consultation-note.fsm.property.test.ts`, `emr-audit.test.ts`; FE/E2E `NONE (no FE)` |

**Interim / deferred markers in scope:** ADR-006 (domain-events audit-log-only — DE-012..016 consent/lab/Rx are audit rows, no bus); BR-019 amendment supervisor-approval = 501 stub behind flag `dental_clinical_amendment_approval` (default off); V-EMR-001 `amended` enum reserved/unreachable; perio `auto_staging`/`side_by_side_comparison` flags exist but staging shipped regardless.

---

## (3) Per-family sequencing analysis + ordering-gap list

### Family C-α — SOAP note: draft → sign → addendum

```
[no note] --upsert (assistant/dentist/hygiene-typed)--> [draft, editable]
[draft] --upsert (repeat, edits allowed)--> [draft]
[draft] --sign (dentist; hygienist only on hygiene visit)--> [signed, v1 frozen, immutable]
[signed] --upsert--> 422 NOTE_SIGNED        (no edit after sign)
[signed] --addendum(reason,content)--> [signed + version N]   (append-only)
[any]   --visit completed/locked--> upsert 422 VISIT_IMMUTABLE
```
Pre/post: sign requires an existing note (`NOT_FOUND` else); addendum requires `signed` (`NOTE_NOT_SIGNED` else). **Ordering observations:** robust — sign is idempotency-guarded (`NOTE_ALREADY_SIGNED`), addendum gated on signed, both audited. FE "Sign & Lock" is a **two-write sequence** (`save` then `sign` in `onSuccess`, `soap-notes-sheet.tsx:128-147`) — see ordering-gap **OG-C1**.

### Family C-β — Consent: create → sign | revoke (+ informed refusal)

```
[create] --> [pending]
[pending] --sign(signatureData)--> [signed]   (immutable; V-CLN-005)
[pending] --revoke--> [revoked]
[signed]  --revoke--> 422 CONSENT_ALREADY_SIGNED
[revoked] --sign--> 422 CONSENT_FORM_REVOKED  (V-CLN-010, race-safe WHERE revoked=false)
gate: treatment planned→performed & invoice require signed=true AND revoked=false
```
**Cross-workflow invariant:** `visit → (consent signed) → treatment performed → visit complete → invoice`. Consent is enforced at BOTH the treatment `performed` transition (`TREATMENT_CONSENT_REQUIRED`) and at invoice (`CONSENT_REQUIRED`) — a correct double gate. **Ordering gaps OG-C2, OG-C3** below.

### Family C-γ — Prescription: write → dispense/cancel

```
[create (BR-017 dentist + prescriberMemberId)] --> [pending]
[pending] --updateStatus--> [dispensed] | [cancelled]   (terminal)
[dispensed]/[cancelled] --updateStatus--> 422 INVALID_PRESCRIPTION_TRANSITION
field-edit: blocked once visit locked/completed (BR-003); status progression EXEMPT (pharmacy-external)
```
Backend FSM complete + property-tested. **No FE for the lifecycle (FE=0)** — KNOWN dental-clinical G4.

### Family C-δ — Perio: create → readings → complete (→ locked)

```
[create (one-per-visit, BR-P01)] --> [draft]
[draft] --upsert tooth reading (idempotent, BR-P06)--> [draft]
[draft] --complete (≥16 readings BR-P07)--> [completed, stage/grade/extent computed]
[completed] --any write--> 409 CHART_COMPLETED / 422
[visit locked] --next read/write--> lazy [locked] + perio.chart.locked audit (BR-P02 cascade)
```
**Ordering note:** classification computed at the `complete` step but (was) not persisted (KNOWN P1-1) — completed→read loses the diagnosis. P2-1 (numeric coercion) FIXED.

### Family C-ε — Case-presentation: present → accept | reject

```
plan[draft] --update(presented) [links pending treatments, G1 fix]--> plan[presented] + CP[draft]
CP[draft] --get--> CP[viewed]  (GET-with-write telemetry, G5)
CP[viewed/presented] --accept(e-sig)--> link treatments → consent e-sig → plan[approved] + approval record → CP decision=accepted (terminal)
CP[viewed] --reject(reason)--> plan[rejected] + CP decision=rejected (terminal)
CP[decided] --accept/reject--> 422 PRESENTATION_DECIDED
accept on plan not 'presented' --> 422 PLAN_INVALID_TRANSITION
```
Accept is an **ordered multi-write** (link → consent → approval-record → plan update → status-history → decide → audit) with a race guard at the final `decide` (`PRESENTATION_DECIDED`). **Ordering gaps OG-C4, OG-C5.**

### Family C-ζ — EMR consultation note

```
[create (provider self only)] --> [draft]
[draft] --update(clinical fields)--> [draft]
[draft] --finalize--> [finalized]  (terminal; no amend; V-EMR-001)
[finalized] --update/finalize--> 422 CONSULTATION_NOT_DRAFT
```
Self-consistent FSM; isolation by provider/patient ownership only (no branch/tenant boundary). **Entire family has zero FE** — KNOWN G1.

### Ordering-gap list

| id | Ordering gap | Family | Severity | Note |
|----|--------------|--------|----------|------|
| **OG-C1** | "Sign & Lock" = client-sequenced save→sign (two POSTs, no transaction/idempotency key). A crash/retry between the two leaves a *saved-but-unsigned* note, or a double-save. Not the FIX-01 two-step resumable pattern. | C-α | P2 | NEW. Offline replay (cadence) could reorder/duplicate. See SL-C03. |
| **OG-C2** | Revoke-after-perform/invoice: a *pending* consent can be revoked, but once a treatment is `performed`/invoiced against a **signed** consent, revoke is correctly blocked (signed→revoke = 422). However the dental-clinical §10.2 blast-radius note flags that an **accept-path acceptance consent** (`writeAcceptanceConsent`) is a *different* consent record than the per-treatment consent — revoking one does not re-evaluate the other. | C-β / C-ε | P2 | KNOWN (dental-clinical G3 blast-radius). |
| **OG-C3** | Consent template snapshot timing: FE consent templates are a hardcoded const (`consent-sheet.tsx:20`), not `listConsentTemplates`; structured ADA content is free-text per form. No snapshot-at-create binding to a managed template (edge case in dental-clinical §13 "deactivated template"). | C-β | P3 | KNOWN (dental-org G6). |
| **OG-C4** | Accept does NOT auto-book; scheduling is a separate staff action (P1-21, by design). But accept→approved unlocks treatments for perform/invoice with **no re-check** that the per-treatment consent was independently signed — accept's e-sig is a plan-level acceptance, not the per-treatment BR-014 consent. Two consent concepts can diverge. | C-ε | P2 | NEW (interaction not catalogued). |
| **OG-C5** | `getCasePresentation` performs a write-on-GET (draft→viewed telemetry). Under FE refetch or offline replay this double-counts / can surprise caching. | C-ε | P3 | KNOWN (case-presentation G5). |
| **OG-C6** | Perio `complete` computes stage/grade from in-request risk factors then discards both the inputs and (was) outputs → diagnosis not durable; recompute-on-read cannot reproduce Grade. | C-δ | P1 | KNOWN (perio P1-1 + P2-2). |

---

## (4) Gap & candidate register

Schema: `| id | finding | chunk | IMPLEMENTED/KNOWN/NEW | lenses{S,R,O,C} | KG-node | MODULE/WF-id | BR-id | spine-op/handler | severity | blast-radius |`

| id | finding | chunk | class | lenses | KG-node | MODULE/WF | BR-id | spine-op/handler | sev | blast-radius |
|----|---------|-------|-------|--------|---------|-----------|-------|------------------|-----|--------------|
| GC-01 | EMR consultation: entire FE absent; 6 ops `frontendConsumers=0`; docs claim `implemented` | C | KNOWN (matrix emr G1) | R,C | consultation_note | emr-consultation/WF-EMRC-001..006 | — | createConsultation… (FE=0) | P1 | cosmetic→data (dormant) |
| GC-02 | EMR admin reads ALL notes, no tenant/clinic scope (cross-clinic PHI if exposed) | C | KNOWN (matrix emr G3) | R | consultation_note | emr-consultation §5 | BR-#### (proposed: *admin EMR reads scoped to caller org*) | getConsultation/listConsultations (FE=0) | P1 | cross-tenant / PHI-leak |
| GC-03 | EMR vs dental-visit/clinical = two finalize-able clinical-note systems, no linkage | C | KNOWN (matrix emr G2) | C | consultation_note ↔ dental_visit_note | emr-consultation vs dental-clinical | — | — | P1 | data-integrity |
| GC-04 | `getConsultation` adversarial RBAC (cross-provider/cross-patient read) not directly tested | C | KNOWN (matrix emr G4) | R | consultation_note | emr-consultation AC | V-EMR-OWN | getConsultation (FE=0) | P2 | PHI-leak (test) |
| GC-05 | Perio diagnosis (Stage/Grade/Extent) computed but not persisted → vanishes on reopen | C | KNOWN (matrix perio P1-1) | C | dental_perio_chart | dental-perio/WF-P03 | strengthens BR-P (staging) | completePerioChart / getPerioChart | P1 | data-loss (clinical record) |
| GC-06 | Perio risk-factor inputs (smoking/diabetes/HbA1c) discarded → Grade not explainable/correctable | C | KNOWN (matrix perio P2-2) | C | dental_perio_chart | dental-perio/WF-P03 | strengthens grade-derivation | completePerioChart | P2 | correctness |
| GC-07 | Hygienist may finalize the perio diagnosis with no dentist sign-off; docstring says dentist-only (drift) | C | KNOWN (matrix perio P3-1) | R,C | dental_perio_chart | dental-perio/BR-P05 | BR-P05 (reconcile) | completePerioChart:75 | P3 | correctness |
| GC-08 | Stage silently null on depth-only charting (no gingival-margin) — no UI nudge | C | KNOWN (matrix perio P3-2) | C | dental_perio_tooth_reading | dental-perio | — | upsertToothReading | P3 | cosmetic |
| GC-09 | Consent revoke + history + refusals-list have no FE (FE=0 for revoke/listRefusals; listForms is gate-only) | C | KNOWN (matrix dental-clinical G3) | R,C | consent_form | dental-clinical/WF-035 | BR-014/V-CLN-010 | revokeConsentForm/listConsentRefusals (FE=0) | P1 | trust / legal-record |
| GC-10 | Rx list + dispense/cancel FSM unsurfaced (FE=0) | C | KNOWN (matrix dental-clinical G4) | S | prescription | dental-clinical/WF-064/065 | BR-017/EM-CLI-012 | listPrescriptions/updatePrescription (FE=0) | P1 | workflow |
| GC-11 | Amendments write-only — no list/read of prior amendments (FE=0); approve is 501 stub | C | KNOWN (matrix dental-clinical G5) | C | clinical_amendment | dental-clinical/WF-038 | BR-019 | listAmendments/approveAmendment (FE=0) | P2 | trust / addendum-integrity |
| GC-12 | Consent-template management no UI; consent-sheet uses hardcoded templates not `listConsentTemplates` | C | KNOWN (matrix dental-org G6) | C | consent_template | dental-org/dental-clinical | BR-014 (snapshot edge §13) | listConsentTemplates (FE=0) | P3 | cosmetic |
| GC-13 | Case-presentation accept e-sig (plan-level) and per-treatment BR-014 consent are distinct records that can diverge; revoking one does not re-evaluate the other | C | NEW | S,R,C | consent_form ↔ case_presentation ↔ treatment | case-presentation G3 (extends) + dental-clinical | BR-#### (proposed: *accepted plan's treatments still require their own signed BR-014 consent before perform; revoking a per-treatment consent must not be overridden by an accept e-sig*) | acceptCasePresentation / signConsentForm | P2 | data-integrity / legal-record |
| GC-14 | "Sign & Lock" SOAP is a client-sequenced save→sign (two writes, no idempotency key/txn); crash/retry/offline-replay can leave saved-unsigned or double-write | C | NEW | S,O | dental_visit_note | dental-visit/notes | BR-#### (proposed: *sign accepts an optional body snapshot so save+sign is one idempotent server write*) | upsertVisitNotes+signVisitNotes | P2 | data-loss (note version) |
| GC-15 | Visit note signing is NOT idempotency-keyed (no localId) — offline cadence replay of a sign could double-snapshot or race with addendum | C | NEW | O,S | dental_visit_note_version | dental-visit/notes | strengthens GAP-001 idempotency | signVisitNotes/createVisitNoteAddendum | P2 | data-loss |
| GC-16 | Consent e-signature capture (`signatureData`) has no per-tooth/offline localId and is created+signed in two FE calls (`consent-sheet.tsx:143,161`); offline replay could create an orphan unsigned consent | C | NEW | O,S | consent_form | dental-clinical/WF-018 | strengthens GAP-001 | createConsentForm+signConsentForm | P2 | data-loss |
| GC-17 | No "amend / re-stage" path for a completed perio chart with a mistyped risk factor (chart immutable; correction = new chart on new visit) — undocumented intent | C | NEW | C | dental_perio_chart | dental-perio | BR-#### (proposed: *guarded re-classification preserving immutability, or documented "new chart" correction path*) | completePerioChart | P3 | correctness |
| GC-18 | Informed-refusal does not block the corresponding treatment's perform path the way a signed consent gates it — refusal is recorded but advisory only | C | NEW | S,C | consent_refusal ↔ treatment | dental-clinical/WF-018 refusal | BR-#### (proposed: *a recorded informed-refusal for a procedure flags/blocks that procedure's perform until overridden with reason*) | recordConsentRefusal | P2 | clinical-correctness |
| GC-19 | No prescription duplicate / poly-pharmacy or controlled-substance cumulative check across visits (allergy + single-Rx interaction exist; cross-Rx/longitudinal does not) | C | NEW | C | prescription | dental-clinical | BR-#### (proposed: *advisory duplicate-active-Rx + controlled-substance frequency warning on create*) | createPrescription | P3 | clinical-correctness |
| GC-20 | EMR `amended` enum is dead/reserved; duplicate-`context` create uses soft `>=400` assertion | C | KNOWN (matrix emr G6/G7) | C | consultation_note | emr-consultation §8 | V-EMR-001 | createConsultation (FE=0) | P3 | cosmetic |

**Candidate workflows a real practice needs (NEW, research-grounded):**

| id | candidate | chunk | class | lenses | KG-node | MODULE/WF | BR-id | spine-op | sev | blast-radius |
|----|-----------|-------|-------|--------|---------|-----------|-------|----------|-----|--------------|
| GC-21 | Consent expiry / re-consent prompt (consent valid for a procedure within a time window; long-deferred treatment should re-consent) | C | NEW | C,S | consent_form | dental-clinical/WF-018 | BR-#### (proposed: *signed consent older than N days for an un-performed treatment is flagged stale; perform prompts re-consent*) | signConsentForm | P3 | clinical-correctness |
| GC-22 | Perio diagnosis → recall-interval recommendation (Stage III/IV ⇒ 3-month perio maintenance) feeding Chunk-E recalls | C | NEW (cross-chunk, defer to synth) | S,C | dental_perio_chart ↔ recall | dental-perio → dental-scheduling | BR-#### (proposed: *completed perio Stage drives default recall interval*) | completePerioChart | P3 | workflow |
| GC-23 | SOAP note templating / quick-fill per procedure type (reduce free-text variance; not AI) | C | NEW | C | dental_visit_note | dental-visit/notes | — | upsertVisitNotes | P3 | cosmetic |

---

## (5) TDD-ready slice specs

Run conventions (from VERTICAL_TDD.md + repo memory): backend tests **from `services/api-ts/`** via `bun run scripts/test-with-db.ts <file>` per-file with `DATABASE_URL=postgresql://postgres:password@localhost:5432/monobase_test` (never `bun test <path>`, never dir-arg). Contract via `scripts/run-contract-tests.ts` against `$API_URL` — **restart API server first**. FE unit: DentalChart globally stubbed (`apps/dentalemon/src/test-setup.ts`) — perio chart DOM asserted only in E2E; chart logic tested as pure fns. Gate: api-ts `bunx tsc` (root `bun run typecheck` = FE only) + `bun run check:boundaries` + backend + contract + FE tsc/unit + E2E.

Value/risk order: SL-C01 (perio diagnosis persistence — clinical data-loss) → SL-C02 (consent revoke/history — legal trust) → SL-C03 (sign idempotency — data-loss) → SL-C04 (Rx lifecycle FE) → SL-C05 (refusal-gates-perform) → SL-C06 (EMR scope decision) → SL-C07 (accept↔per-treatment consent invariant).

### SL-C01 — Persist perio diagnosis (Stage/Grade/Extent + risk-factor snapshot) — GC-05/GC-06
Depends: none. Steps 1–6,9,10 (backend-heavy; FE step 7–8 minimal reopen render). **RED first:**
- BE `dental-perio-coverage.test.ts` (extend): complete chart with definite Stage/Grade/Extent → `GET /dental/perio-charts/:id` AND `GET /dental/visits/:vid/perio-chart` → assert `stage/grade/extent` returned == completion response; risk-factor snapshot round-trips. (fails today — columns absent.)
- Contract `dental-perio.hurl` (extend §7b): after `POST …/complete`, single-GET asserts `stage="III"`/grade/extent present.
- FE `perio-chart-overlay.test.tsx`: render reopened completed chart (no in-session `completion`) → chips read from `chart.stage ?? completion?.stage`.
FSM/schema: migration adds nullable `stage`/`grade`/`extent` + `risk_factors` JSONB to `dental_perio_chart`; add 3 optional fields to `model PerioChart` in `dental-perio.tsp` (reuse existing `PerioStage`/`PerioGrade`/`PerioExtent` enums) → regen routes/validators/SDK (additive). `complete()` writes them; `{...chart}` spread auto-returns. AC: AC-P (new round-trip). Binds BR-P staging. Gate: api-ts tsc + SDK regen + backend + contract + FE.

### SL-C02 — Consent revoke + history + refusals view — GC-09
Depends: none. Backend exists (revoke handler + lists); slice is mostly FE + contract + 1 integration. **RED first:**
- FE `consent-sheet.test.ts` (or new `consent-history.test.ts`): history lists signed/pending/revoked + refusals; Revoke on a *pending* form calls `revokeConsentForm`; a *signed* form offers no Revoke (mirror 422).
- Contract `dental-clinical.hurl` (extend): capture→revoke pending→`revoked`; revoke signed→422 `CONSENT_ALREADY_SIGNED`; refusals list→`{data,pagination}`.
- BE integration: revoking a consent does NOT invalidate an already-accepted case-presentation / billed treatment (`consent-billing.facade` + `case-presentation-consent.facade`).
Binds BR-014, V-CLN-010, WF-035. No schema change. Gate: FE + contract + backend integration.

### SL-C03 — Idempotent server-side Sign-with-snapshot — GC-14/GC-15
Depends: none. **RED first:**
- BE `dental-visit.signed-notes.test.ts` (extend): `signVisitNotes` accepts optional body `{subjective,objective,assessment,plan,notes, localId?}`; a single sign call both persists the snapshot and signs (one transaction); a second sign with same `localId` is a no-op returning the same version (idempotent), not `NOTE_ALREADY_SIGNED` duplicate work.
- Contract `dental-clinical.hurl`/visit notes: double-sign same localId → one v1.
- FE `soap-notes-sheet.test.ts`: "Sign & Lock" issues ONE call (replace `save`→`sign` chain).
FSM: no state change; add `localId` idempotency key (strengthens GAP-001). TypeSpec: extend `SignVisitNotesBody` (additive optional). Gate: api-ts tsc + regen + backend + contract + FE. (Offline/cadence lens: O.)

### SL-C04 — Prescription list + dispense/cancel FE — GC-10
Depends: none (backend FSM tested). FE-only + contract. **RED first:**
- FE `rx-sheet.test.ts` (extend) or `rx-list.test.ts`: list renders from `listPrescriptions`; dispense/cancel call `updatePrescription`; invalid transition surfaces 422 `INVALID_PRESCRIPTION_TRANSITION`.
- Contract: already has PATCH dispense/cancel (`dental-clinical.hurl`) — add GET list assertion.
Binds BR-017, EM-CLI-012. No backend change. Gate: FE + contract.

### SL-C05 — Informed refusal flags/blocks the procedure's perform — GC-18
Depends: SL-C02 (refusals visible). **RED first:**
- BE `treatment-fsm-http.test.ts` (extend): a recorded informed-refusal for procedure X → `planned→performed` on X surfaces a warning/block (`TREATMENT_REFUSED` advisory or 422 unless overridden with reason). Decide block-vs-warn at `[NEEDS CONFIRMATION]`.
- Contract: refusal recorded → perform refused-procedure → expected code.
FSM: add refusal check into treatment perform guard (proposed BR-####). TypeSpec: optional `refusalOverrideReason` on perform body. Gate: backend + contract (+ FE banner if block). **Open question — block or advise?**

### SL-C06 — EMR scope decision gate (no code until product decides) — GC-01/GC-02/GC-03/GC-04
Depends: product decision (A keep+build / B dormant-relabel / C remove). This slice is the **decision + the security regression**, independent of A/B/C:
- BE `emr-coverage.test.ts` (extend, all paths): admin in clinic A must NOT see clinic B's notes (cross-tenant isolation) — RED today (admin unscoped); provider B GET provider A's note→403; patient B GET patient A's note→403 (GC-04 pins). 
- If A: FE consultation list → editor (draft→update→finalize) → patient read view + E2E; contract walker for un-wrapped single-resource + `{data,pagination}` list envelope.
- If B/C: doc-only (relabel `implementation_status` / delete handlers+tsp+regen+drop migration).
Binds V-EMR-OWN, proposed BR-#### (admin-org-scope). Gate path-dependent. **Blocking `[NEEDS CONFIRMATION]`: is /emr in dentalemon scope?**

### SL-C07 — Accept-plan e-sig ⇏ bypass per-treatment BR-014 consent — GC-13/GC-04
Depends: none. **RED first:**
- BE `case-presentation-real-flow.test.ts` (extend): after `acceptCasePresentation` (plan→approved), a linked treatment with NO per-treatment signed consent still cannot move `planned→performed` (`TREATMENT_CONSENT_REQUIRED`); accept's plan-level e-sig is recorded but does not satisfy the per-treatment BR-014 gate. And: revoking a per-treatment consent after accept does not silently re-enable perform.
- Contract: present→accept→attempt perform without per-treatment consent → 422.
Binds BR-014, proposed BR-#### (accept-vs-perform consent separation). No schema change (asserts an existing-but-untested invariant; if it currently *does* bypass, that's a P1 find). Gate: backend + contract.

---

## (6) Open questions / `[ASSUMPTION]`

1. **[NEEDS CONFIRMATION] EMR scope (blocks SL-C06):** is telemedicine `consultation_note` an in-scope dentalemon feature, an intentionally-dormant upstream primitive, or removable? Determines build/relabel/delete. (matrix emr G1.)
2. **[NEEDS CONFIRMATION] EMR admin:** does dentalemon have a global platform admin or only clinic-scoped admins? Determines if GC-02 admin-sees-all is an active or latent cross-clinic PHI leak. (matrix emr G3.)
3. **[NEEDS CONFIRMATION] Perio finalize authority (GC-07):** may a hygienist finalize the Stage/Grade diagnosis, or does it require dentist sign-off? Code allows hygienist; docstring says dentist-only. (matrix perio P3-1.)
4. **[NEEDS CONFIRMATION] Perio correction path (GC-17):** for a mistyped risk factor on a completed (immutable) chart — guarded re-classification, or new chart on new visit?
5. **[NEEDS CONFIRMATION] Informed refusal enforcement (SL-C05 / GC-18):** should a recorded refusal *block* the procedure's perform (override-with-reason) or stay advisory-only?
6. **[ASSUMPTION] GC-13/GC-14/GC-16 offline-replay risk** is reasoned from the cadence last-write-wins / no-localId pattern in `upsertDentalChart.ts` and the two-call FE sequences; not yet reproduced live against the cadence engine. Verify before sizing the idempotency work.
7. **[NEEDS CONFIRMATION] Consent expiry (GC-21):** does the practice want a re-consent prompt for long-deferred treatments, or is a once-signed consent valid indefinitely?
8. **[NEEDS CONFIRMATION] Consent template management (GC-12 / OG-C3):** wire `listConsentTemplates` + snapshot-at-create, or keep hardcoded FE templates? (matrix dental-org G6.)
