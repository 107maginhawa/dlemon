# P1-26 — Insurance / Revenue-Cycle Billing (Philippines Market)

> Design plan · no code · 2026-06-02 · Effort: **L** · Source review: [`docs/reviews/modules/billing-review.md`](../modules/billing-review.md) · Research: [`docs/reviews/research/light-pass.md`](../research/light-pass.md) (Billing §)

---

## 1. Problem & Current State

dentalemon has a **solid patient-side billing core** but **no insurance revenue cycle**. Today the third-party-payer flow stops at a manual draft.

**What exists (reuse, do not rebuild):**
- **Invoices** — `dental-billing/{createDentalInvoice,issueDentalInvoice,voidDentalInvoice}.ts`; FSM `draft→issued→partial→paid→overdue→voided`; line items derived from performed treatments; `discountCents`/`taxCents`/`paidCents`/`balanceCents` columns (`repos/dental-invoice.schema.ts`).
- **Payments** — `recordDentalPayment.ts`, `voidDentalPayment.ts`, receipts; methods `cash | card | bank_transfer` (`repos/dental-payment.schema.ts`). All payments are **patient-side**; there is no payer/HMO payment concept.
- **Payment plans** — installment FSM (`createDentalPaymentPlan.ts` + property tests).
- **Discounts / adjustments** — `applyDentalDiscount.ts` (manual `discountReason`, no contractual/coverage logic).
- **Balance & collections** — `getPatientBalance.ts`; `getCollectionsSummary.ts` (period totals today/month/year — **not aged buckets**).
- **Insurance profiles + claim drafts** — live in the **patient** module, not billing: `dental-patient/insurance/{createInsuranceProfile,updateInsuranceProfile,listPatientInsuranceProfiles,createClaimDraft,getClaimReadiness,updateClaimStatus,listPatientClaims}.ts`. Profile model = `{insurerName, policyNumber, groupNumber, subscriberName, subscriberDob, relationship, active}`. Claim draft = single `{cdtCode, icd10Code, feeAmountCents, status}` with FSM `draft→ready→submitted→accepted|rejected`. TypeSpec in `specs/api/src/modules/dental-patient-finance.tsp` (§3 profiles, §4 claim drafts).

**The gaps (this plan closes them):**
- No **coverage / authorization** capture — can't record an HMO Letter of Authorization (LOA) or approved amount before treatment.
- No **patient-portion estimation** — front desk can't tell the patient "HMO covers ₱X, you pay ₱Y" at plan time.
- No **payer-side payment / reconciliation** — when the HMO remits, there's no way to post it against the invoice and write off the non-covered or contractual gap.
- Claim is a **single-procedure draft**, not a multi-line submittable claim tied to an invoice/visit.
- No **claim-status worklist** or AR-by-payer view; collections is patient-period totals only.

---

## 2. Market Reality — PH, not US

This is the load-bearing decision of the plan. **The US PPO / EDI machinery is largely inapplicable in the Philippines.** We design for the PH revenue mix, not Dentrix/Open Dental.

### PH payer landscape (what we build for)
1. **Fee-for-service (cash) — the majority.** Most PH dental is paid out-of-pocket at point of care. Already covered by the existing patient ledger; insurance flow must never get in the way of cash patients.
2. **HMO (the real "insurance")** — Maxicare, Intellicare, Medicard, ValuCare, PhilCare, Cocolife, etc. The dominant PH model:
   - Patient presents an **HMO card**; clinic is (or isn't) an **accredited provider** for that HMO.
   - Coverage is gated by an **LOA / approval code** (Letter of Authorization) — often per-visit, sometimes with an approved amount or covered-procedure list, frequently **annual-limit** and **procedure-category** constrained (e.g. "oral prophylaxis + 1 filling/year, extractions covered, prosthetics excluded").
   - Clinic submits a **claim/billing statement** to the HMO (portal upload, email, or fax — **no clearinghouse, no EDI**) and waits **30–90+ days** for remittance, often with **disallowances**.
   - The patient pays the **excess / non-covered portion** at the chair (co-pay, over-limit, excluded procedures).
3. **PhilHealth** — national insurance. **Dental is only marginally relevant**: PhilHealth covers very limited oral-health items (mostly hospital-based oral surgery / packages, and some primary-care benefit items), **not routine clinic dentistry**. We model it minimally as a *payer type* so the rare covered case is recordable, but we do **not** build PhilHealth eClaims/RUV infrastructure in this epic.

### Explicitly OUT of scope (US-centric — intentionally not built)
| US table-stakes item | Why excluded for PH |
|---|---|
| **EDI 837 claim submission / 835 ERA** | No PH clearinghouse ecosystem; HMOs use portals/email/fax. Submission is "mark submitted + attach reference," not EDI. |
| **Real-time eligibility (270/271)** | No real-time eligibility rails. Replaced by **manual LOA / approval-code capture**. |
| **PPO fee-schedule + LEAT downgrade + automated contractual write-off** | PH HMOs reimburse by approved-amount / capped benefit, not a contracted PPO fee schedule per CDT. Replaced by **approved-amount vs billed-amount delta** write-off. |
| **Automated secondary-claim generation (COB)** | Dual HMO coordination-of-benefits is rare in PH dental; we allow a 2nd profile but do **not** auto-generate secondary claims. |
| **Clearinghouse batch claims / payer bundling rules** | No clearinghouse. Batch = a local "submit selected claims" UX action only. |
| **CDT-keyed UCR/PPO/cash fee tiers** | Single per-branch fee map stays (`dental-org/feeSchedule.ts`); covered by separate P2, not this epic. |

> Net: we keep CDT codes as a coding vocabulary (already in line items/claim drafts) but treat **coverage as approval-driven, not fee-schedule-driven**.

---

## 3. Proposed Design

Theme: promote the existing draft into an **invoice-anchored, multi-line HMO claim** with **coverage/LOA capture**, **estimation**, and **payer reconciliation** — minimal, PH-shaped, reusing what's there.

### 3.1 Domain model deltas (new/extended tables)

All in `services/api-ts/src/handlers/dental-billing/repos/` (revenue cycle lives in billing; profile stays in patient and is referenced). Standard `baseEntityFields` + tenant/branch scoping + RLS, same as siblings.

1. **Extend `dental_insurance_profile`** (patient module) with PH payer fields (additive, nullable):
   - `payerType` enum: `hmo | philhealth | corporate | self_pay_assist | other` (default `hmo`).
   - `accredited` boolean — is this clinic/branch an accredited provider for the payer.
   - `annualLimitCents`, `annualLimitUsedCents` (nullable) — running benefit cap.
   - Keep `insurerName/policyNumber/groupNumber` (group# doubles as HMO company/account).

2. **`dental_coverage_authorization` (NEW)** — the LOA / approval record (the PH analogue of eligibility+preauth):
   - `id, patientId, insuranceProfileId, branchId, visitId?(nullable), treatmentPlanId?(nullable)`
   - `loaNumber` text (approval code), `approvedAt date`, `validUntil date?`
   - `status` enum: `requested | approved | partial | denied | expired` (FSM below)
   - `approvedAmountCents int?` (covered cap for this authorization)
   - `coveredProcedures jsonb?` — list of `{cdtCode, approvedAmountCents?, note?}` when itemized
   - `notes`, attachment ref (link to `storage` file id for scanned LOA).

3. **Promote claim to invoice-anchored multi-line. `dental_insurance_claim` (NEW)** (supersedes single-row draft as the *submittable* unit; keep `dental_claim_draft` for backward-compat OR migrate — see §6):
   - `id, patientId, insuranceProfileId, branchId, invoiceId?(nullable), visitId?(nullable), authorizationId?(nullable)`
   - `claimNumber` text (clinic-generated), `payerReference text?` (HMO's tracking #)
   - `status` enum (FSM below)
   - `billedAmountCents`, `approvedAmountCents?`, `paidByPayerCents` default 0, `disallowedCents?` (denial/contractual gap), `patientPortionCents` (computed)
   - `submittedAt, decisionAt, paidAt` timestamps; `denialReason text?`
   - `submissionChannel` enum: `portal | email | fax | in_person | other` (no EDI).
4. **`dental_insurance_claim_line` (NEW)** — per-procedure line on a claim:
   - `claimId, treatmentId?, invoiceLineItemId?, cdtCode, description, billedAmountCents, approvedAmountCents?, paidAmountCents default 0, status (covered|partial|disallowed|pending)`.
5. **`dental_payer_payment` (NEW)** — the PH "EOB posting" analogue (rename concept to **Remittance Posting**):
   - `id, claimId, insuranceProfileId, branchId, invoiceId?`
   - `amountCents, remittanceReference text?, remittedAt date, method (bank_transfer|check|portal)`
   - `disallowanceCents?`, `disallowanceReason?` — drives the **write-off** record.
   - On post: increments invoice `paidCents` via the **existing money pipeline** and creates a write-off adjustment for the disallowed delta (reuse `applyDentalDiscount` mechanics with `discountReason='hmo_disallowance'`).

### 3.2 Claim FSM (PH HMO workflow)
```
draft → ready → submitted → under_review → approved → partially_paid → paid
                              ↘ denied (→ appealed → submitted | → written_off)
                              ↘ approved → denied (post-review disallowance)
```
- Extends today's `draft→ready→submitted→accepted|rejected`. `accepted` → `approved`, `rejected` → `denied`, plus `under_review`, `partially_paid`, `paid`, `appealed`, `written_off`. Implemented as a `Record<Status, Status[]>` map exactly like `CLAIM_DRAFT_FSM`, with property tests (mirror `invoice.fsm.property.test.ts`).

### 3.3 Authorization FSM
`requested → approved | denied`; `approved → partial | expired`; terminal: `denied`, `expired`. Drives whether a claim can move `ready→submitted` (warn-not-block if no LOA, since some HMOs reconcile post-hoc).

### 3.4 Estimation (covered vs patient portion)
A pure, isomorphic calculator in `dental-billing/utils/coverage-estimate.ts` (same spirit as `utils/rounding.ts`, fully unit-testable, no DB):
- Inputs: planned line items (cdt + fee), active insurance profile, optional authorization (`approvedAmountCents` / `coveredProcedures`), `annualLimit` remaining.
- Output: `{ estimatedCoveredCents, estimatedPatientPortionCents, perLine[], cappedByAnnualLimit: bool, uncoveredProcedures[] }`.
- Rules (PH-shaped, deterministic, no payer API): covered = min(billed, approvedAmount for line, remaining annual limit); excluded/over-limit → patient portion. **No LEAT, no UCR downgrade.** Surfaced at treatment-plan time and on the invoice ("HMO est. ₱X · You pay ₱Y").
- All money via existing `utils/rounding.ts` (₱, integer centavos, banker's rounding already centralized).

### 3.5 Reconciliation & AR
- **Remittance posting** (`dental_payer_payment`) reconciles claim ↔ invoice: payer payment + patient payment + disallowance write-off must close the invoice balance. Reuse the invoice balance recompute already in `recordDentalPayment.ts`.
- **AR-by-payer aging worklist** — extend/add alongside `getCollectionsSummary.ts`: outstanding claims aged by `submittedAt` into 0–30 / 31–60 / 61–90 / 90+ buckets, grouped by payer. (This also satisfies the P2 "AR aging" finding for the insurance side.)

### 3.6 Frontend (apps/dentalemon)
Reuse `src/features/billing/{components,hooks}` patterns + SDK hooks (TanStack Query). New surfaces:
- **Coverage panel** on patient/treatment-plan: capture HMO profile + LOA, show live estimate.
- **Claims worklist** route: list/filter by status & payer, submit (mark submitted + attach reference), record remittance, see aging.
- **Invoice insurance block**: "HMO covers / patient pays" split; remittance & write-off shown in the ledger/carousel timeline (fits the snapshot-over-time model noted in the review §4).
All ₱ / `en-PH` formatting via existing locale utilities.

---

## 4. API + Data-Model Delta Summary

### TypeSpec (source of truth — edit `.tsp`, never generated files)
Add to `specs/api/src/modules/dental-billing.tsp` (new revenue-cycle interface) and extend `dental-patient-finance.tsp` profile model:
- `POST   /dental/billing/claims` — create invoice-anchored claim (from invoice/visit + profile).
- `GET    /dental/billing/claims` — worklist (filter status, payer, branch, aging).
- `GET    /dental/billing/claims/:claimId`
- `PATCH  /dental/billing/claims/:claimId/status` — FSM transition (validated).
- `POST   /dental/billing/claims/:claimId/lines` / `PATCH .../lines/:lineId`
- `POST   /dental/billing/claims/:claimId/remittance` — post payer payment + auto write-off disallowance.
- `POST   /dental/patients/:patientId/authorizations` (LOA) · `GET` list · `PATCH /:id/status`.
- `POST   /dental/billing/estimate` — coverage estimate for a set of planned lines (read-only, no persistence).
- Profile model gains `payerType, accredited, annualLimitCents, annualLimitUsedCents`.

Then: `cd specs/api && bun run build` → `cd services/api-ts && bun run generate` (regen routes/validators; never hand-edit generated).

### Data model
- **Extend:** `dental_insurance_profile` (+4 cols).
- **New tables:** `dental_coverage_authorization`, `dental_insurance_claim`, `dental_insurance_claim_line`, `dental_payer_payment`.
- Migration via `bun run db:generate`; review SQL in `src/generated/migrations/`. All tables: tenant/branch scoping, RLS, audit (`createdBy/updatedBy`), syncable fields where they participate in offline sync (claims/auth likely yes — mirror invoice's `syncableEntityFields`).

---

## 5. Vertical-TDD Test Plan

Per [`VERTICAL_TDD.md`](../../development/VERTICAL_TDD.md) — RED→GREEN per slice, one module fully E2E before the next. Sequence per slice: TypeSpec → codegen → backend tests (RED) → backend → contract (RED) → contract → frontend tests (RED) → frontend → E2E → verify gate.

**Backend unit (RED first), mirroring existing test files:**
- `coverage-estimate.test.ts` — pure calculator: covered/patient split, annual-limit capping, excluded procedures, zero-coverage cash patient, banker's-rounding edge centavos. (Model after `utils/rounding.test.ts`.)
- `claim.fsm.property.test.ts` — full FSM reachability/no-illegal-transition (model after `invoice.fsm.property.test.ts`).
- `authorization.fsm.property.test.ts`.
- `dental-insurance-claim.test.ts` — create from invoice, multi-line, branch-access (`assertPatientBranchAccess`), archived-patient block (mirror `createClaimDraft.ts` guards), tenant isolation, cross-tenant 404.
- `dental-payer-payment.test.ts` — remittance posting recomputes invoice balance; disallowance creates write-off; over-post rejected; idempotent on remittance reference.
- `revenue-cycle-acceptance.test.ts` — full PH journey (model after `acceptance.billing-payments.test.ts`): HMO patient → LOA captured → estimate shown → invoice issued → claim submitted → partial remittance + disallowance → patient pays excess → invoice paid & reconciled.
- **HTTP wiring test** (model after `billing-gate-http.test.ts` / `claims-route-registration.test.ts`) — hit the **real server**, not just `buildTestApp`, per the route-registration learning in MEMORY.
- Negative/PH-specific: cash patient never forced through insurance; PhilHealth profile recordable but no eClaims path; no-LOA submit warns not blocks.

**Contract (Hurl, `specs/api/tests/contract/`):** new scenarios for each endpoint incl. FSM-violation 422, cross-tenant 404, estimate read-only 200.

**Frontend unit:** estimate display, claims worklist filters, remittance form validation, ₱/en-PH formatting.

**E2E (Playwright):** front-desk HMO flow end-to-end (prefer Playwright over human checkpoints, per MEMORY). Run via `bun run test` (never `bun test <path>` — clone-template pollution learning).

**Gate:** backend unit + contract + FE unit + E2E green; `bun run test` + `bun run typecheck` + **`bun run check:boundaries`** clean (boundaries is part of the verify gate per MEMORY); no regressions in the 2900+ suite.

---

## 6. Phasing & Effort — **L**

| Phase | Slice (vertical) | Notes |
|---|---|---|
| **P0** | Profile PH extension + **coverage authorization (LOA)** | Additive cols, new table, FSM, capture UI. Lowest risk, unblocks estimate. |
| **P1** | **Coverage estimate** engine + treatment-plan/invoice surfacing | Pure calc + read-only `POST /estimate`; high demo value. |
| **P2** | **Invoice-anchored multi-line claim** (promote draft) + worklist | Reuse `createClaimDraft` guards/repo patterns; decide draft migration (recommend: keep `dental_claim_draft` as legacy single-proc, route new flow through `dental_insurance_claim`; backfill optional). |
| **P3** | **Remittance posting + write-off reconciliation** + AR-by-payer aging | Closes the loop; reuses payment balance pipeline + `applyDentalDiscount`. |

Effort **L**: 4 new tables, 1 extension, ~10 handlers, FSMs, estimator, ~6 test files, FE worklist + estimate UI, contract + E2E. No external integrations (deliberately), which keeps it L not XL.

---

## 7. Dependencies
- **Invoices/payments core** (`dental-billing`) — reused for balance recompute & write-offs. ✅ present.
- **Insurance profiles + claim drafts** (`dental-patient/insurance`) — extended/promoted. ✅ present.
- **`storage` module** — for scanned LOA / claim-form attachments. ✅ present.
- **`dental-org/feeSchedule.ts`** — billed amounts source; single flat schedule is *sufficient* here (no PPO tiers needed). The fee-tier P2 is **not** a blocker.
- **`utils/rounding.ts`** — all ₱ money math.
- **TypeSpec→codegen pipeline** and **db:generate** migrations.
- **No external payer/clearinghouse dependency** (by design).

## 8. Risks
- **R1 (biggest) — Payer-model fragmentation.** PH HMOs have no standard LOA/claim format; each (Maxicare/Intellicare/…) differs in approval semantics, limits, and submission channel. Over-modeling a rigid schema will fit no one. *Mitigation:* keep coverage/approval **generic + jsonb-extensible** (`coveredProcedures` jsonb, free-text `loaNumber/payerReference`, channel enum incl. `other`); validate the model against 2–3 real HMO LOAs/forms before locking TypeSpec.
- **R2 — Scope creep toward US EDI.** Reviewers may push for clearinghouse/837/eligibility. *Mitigation:* §2 OUT-of-scope table is explicit and load-bearing; treat any EDI ask as a separate non-PH epic.
- **R3 — Cash-patient friction.** Insurance UI must not slow the FFS majority. *Mitigation:* insurance is opt-in per patient; estimate/claim surfaces hidden unless an active profile exists; tests assert cash path untouched.
- **R4 — Reconciliation correctness.** payer payment + patient payment + disallowance must exactly close balance; rounding/partial-remittance bugs corrupt the ledger. *Mitigation:* route all money through existing tested pipeline; property + acceptance tests on closure invariants.
- **R5 — Draft→claim migration ambiguity.** Two claim concepts could confuse. *Mitigation:* P2 decision — keep legacy draft read-only, new flow on `dental_insurance_claim`; document in module spec.

---

*Plan only. No code written. Implement via Vertical TDD when scheduled.*
