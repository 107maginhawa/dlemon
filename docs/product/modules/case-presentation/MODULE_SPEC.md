<!-- authored: 2026-06-12 | case-presentation FIX-004 (Batch C) — documents SHIPPED behavior, verified against handlers (§15) -->

# Module Specification: case-presentation

---
Spec Version: 1.0 | Last Updated: 2026-06-12
---

> Authored **after** the flow shipped, so it documents real behavior verified
> against the handlers (`services/api-ts/src/handlers/dental-patient/case-presentation/`),
> not aspiration. Case-presentation grew as a cross-module journey (it lives inside
> the dental-patient handler tree and reuses the dental-clinical consent facade) and
> never had a spec anchor — this thin spec closes that `[INFERRED]` boundary. It does
> **not** re-litigate the G1/G2/G3/FE-1 fixes (all source-verified with regression pins).

## 1. Module Overview
**Purpose:** Present a treatment plan to the patient and capture a binding decision. Staff "present" a `presented` plan; the patient reviews the phased ₱ breakdown on the operatory device and **accepts** (e-signature) or **declines** (with an optional reason). Acceptance is the platform's revenue-conversion step: it approves the plan and records an immutable consent e-signature.

**Users:** Staff present (clinicians + treatment coordinator); the **patient** decides on the staff's authenticated session (P1-20 Phase 1 — operatory iPad, no public link). The signed-acceptance record is later read back by staff.

**Related:** dental-patient (owns the `dental_case_presentation` table + treatment-plan repo); dental-clinical (consent e-sig facade — frozen, read-only reuse, `case-presentation-consent.facade.ts`); dental-visit (consumes the same signed-acceptance viewer — GAP-3); dental-billing / workspace treatment-options (consume option-group acceptance); dental-audit (`case_presentation.accepted` row).

---

## 2. Domain Terms
| Term | Definition |
|------|-----------|
| Case presentation | A patient-readable artifact minted from a `presented` treatment plan: `{ patientId, treatmentPlanId, planVersionId?, status, decision }` |
| Decision | Terminal patient choice: `accepted` \| `rejected` \| `null` (undecided). Once set it cannot change (`PRESENTATION_DECIDED`). |
| Present (verb) | The staff FSM transition that moves a plan **draft → presented** (links the patient's pending treatments to the plan header) |
| Present to patient | Minting a `case_presentation` row from a `presented` plan and opening the patient-facing surface |
| Approve vs Accept | **Approve** = the staff path (`approveTreatmentPlan`). **Accept** = the patient e-sign path (`acceptCasePresentation`). Both converge on the SAME persisted truth: linked items + a `signature` `TreatmentPlanApproval` + plan→`approved`. |
| Signed acceptance | The legal read-back artifact: signer name + decision timestamp + the immutable itemized plan (FIX-002 viewer) |

---

## 3. Workflows
- **WF (present → e-sign → accept):** staff opens the Plans sheet → "Present to patient" on a `presented` plan → patient reviews the phased ₱ plan + alternates → signs (typed name + signature stroke) → **accept**. Accept links pending treatments, re-derives the plan total, writes the consent e-sig, records the approval, flips the plan `presented → approved`, marks the presentation `accepted` (terminal), and writes a `case_presentation.accepted` audit row. **Pinned by E2E journey J19** (`tests/e2e/journeys/19-case-presentation-accept.journey.spec.ts`).
- **WF (decline):** same entry; the patient declines with an optional reason → plan `presented → rejected`, presentation `rejected` (terminal). Staff may present a NEW version later (a new presentation row). Pinned by J19's reject leg.
- **WF (read-back, FIX-002):** opening a **decided** presentation renders the read-only signed-acceptance record (who/when/itemized plan) instead of the interactive sign controls. Closes GAP-1 and dental-visit GAP-3 with one viewer (case-presentation owns the build).

---

## 4. State / FSM
- **Plan (`TREATMENT_PLAN_FSM`):** `draft → presented → approved | rejected | cancelled`. Accept requires `presented → approved`; reject requires `presented → rejected`.
- **Presentation `decision`:** `null → accepted | rejected` (terminal; re-deciding → 422 `PRESENTATION_DECIDED`).
- **Accept precondition:** the plan must carry **linked treatment items** — accept resolves the consent anchor from the plan's visit and 422s `PLAN_HAS_NO_ITEMS` if none. Items are linked when the plan is presented (or claimed late at accept).

---

## 5. Business Rules
- **Single-presentation ownership (Q3):** option-group acceptance and case acceptance are **owned by case-presentation** (single owner). dental-visit and dental-billing consume; they do not write the decision.
- **Terminal immutability:** a decided presentation cannot be re-decided (mirrors the V-CLN-005 consent e-sig contract). Accept/reject both re-check inside `repo.decide(...)` and 422 on a lost race.
- **Approve/Accept parity (G3):** the patient accept path performs the SAME persistence as staff approval — `linkPendingTreatments` + `createApproval(method: 'signature')` + plan→approved + status-history — so the two approval paths never diverge.
- **Total re-derivation (TP-BR-006):** accept is a third `linkPendingTreatments` caller and re-derives the denormalized plan header total from the just-claimed item prices, so the plans-sheet estimate never drifts from the case `grandTotalCents`.
- **Print/email estimate (Q1, FIX-003):** **not a separate build.** A printable cost estimate is already covered by the existing invoice / treatment-plan flows (billing owns the shared print primitive); case-presentation does not add a second print path.
- **GET-write telemetry (GAP-6):** `getCasePresentation` bumps view telemetry on read (documented-intentional). This is **by design** — do not "fix" it.

---

## 6. Permissions
- **Present (mint a presentation):** `dentist_owner` \| `dentist_associate` \| `treatment_coordinator` (`canPresentCase`; mirrors the `createCasePresentation` backend gate — plans + money to patients).
- **Accept / reject (chairside capture on the staff session):** the broader chairside set — the three present roles **plus** `staff_full` \| `front_desk` \| `dental_assistant`.
- **Read-back:** any member with patient branch access (the signed-acceptance viewer is read-only).
- Archived patient → `PATIENT_ARCHIVED`; branchless patient → forbidden.

---

## 7. Data Requirements
**`dental_case_presentation`**: id, patientId, treatmentPlanId, planVersionId?, status, **decision** (`accepted`/`rejected`/null), decisionAt?, **signerName**? (typed e-sign name), **signatureData**? (base64 PNG, accepted only), **rejectionReason**?, consentFormId?, + BaseEntity audit columns.

The drawn-signature **image bytes** live on `TreatmentPlanApproval.signatureData` (and on the presentation row); the case-presentation aggregate surfaces the legally-operative signature (typed signer name + intent + timestamp, UETA/ESIGN), not the drawn image — surfacing the image needs a backend read path (deferred).

---

## 10. API Expectations
- `GET  /dental/patients/:patientId/case-presentations` — list (staff).
- `POST /dental/patients/:patientId/case-presentations` — mint from a `presented` plan (`PLAN_NOT_PRESENTED` otherwise).
- `GET  /dental/patients/:patientId/case-presentations/:presentationId` — patient-readable aggregate (phases + ₱ totals + alternates + image refs + the presentation/plan records). Bumps view telemetry (GAP-6).
- `POST /…/:presentationId/accept` — body `{ signerName, signatureData }` → 200 `{ presentation, plan, consentFormId }`.
- `POST /…/:presentationId/reject` — body `{ rejectionReason? }` → 200 `{ presentation, plan }`.

No backend / TypeSpec / SDK changes were made for this spec or for FIX-002 (the viewer is FE-only wiring of already-generated SDK ops).

---

## 11. Out of Scope / Do Not Build
- **Public patient link / portal presentation** (P1-20 Phase 2) — Phase 1 is the staff-session model only; no tokenized unauthenticated access.
- **A second print utility / print stylesheet** here — duplicates the dental-billing-owned shared print primitive (FIX-003).
- **New presentation FSM states** — terminal accept/reject suffices.
- **Removing GET-write view telemetry** — documented-intentional (§5).
- **Clickable annotated-image overlay / presigned download** (GAP-4) — V2 polish.
- Re-doing the G1/G2/G3/FE-1 fixes or the accept side-effect chain — all source-verified with regression pins.
