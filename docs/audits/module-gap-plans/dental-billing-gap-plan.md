# dental-billing — Proposed Fix Plan

**Module:** dental-billing · **Date:** 2026-06-09 · **Status:** plan only (no fixes implemented)
**Method:** live-FE drive via `/webwright` (fresh Firefox, owner persona Dr. Maria Reyes / PIN 123456) + static FE↔BE wiring map (10-area lens). Live run: `outputs/dental-billing-audit/final_runs/run_1/` (4/5 CP pass; the one "FAIL" was a case-sensitive regex — the gap it probed is **confirmed by screenshot**).
**Prior audits (carry-forward):** `docs/audits/modules/MODULE_dental-billing_AUDIT_2026-06-08.md` (**READY** — backend money-integrity + FSM + cross-tenant; the headline EM-BIL-002 all-tenant report leak was found & fixed TDD that round). This audit confirms the backend verdict and scopes the **frontend seam**.
**Standards:** Vertical TDD (tests RED → impl GREEN), `docs/development/VERTICAL_TDD.md`; UI expectations from `IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md` §3.8 / §8.4. Wire-shape changes go TypeSpec → regen → handler → SDK → FE (never hand-edit generated files).

---

## 1. Audit Decision

**PARTIAL PASS.** The **money-critical path is solid and reachable**: list invoices → open a payable invoice → **Issue → Record Payment → Void → Mark Uncollectible** all work live (confirmed: INV-S0002 paid ₱1.00 cash, POST 201, balance ₱2,400 → ₱2,399, receipt rendered in the payments sub-table). Backend is unusually complete and well-tested (24 test files, FSM-guarded, audited on every money write, RBAC owner-gated, and the EM-BIL-002 cross-tenant report leak is fixed and pinned). No P0: no money-integrity, RBAC, or cross-tenant risk is reachable from the UI.

The gap is a **wide FE seam — large, fully-built, tested backends with zero reachable entry point**:
- **No way to apply a discount** (owner-only, reason-required endpoint exists; UI shows discount read-only).
- **The entire insurance/HMO revenue-cycle is dead-on-arrival from the UI** — the claims worklist renders but says *"No insurance claims yet"* and there is **no create-claim affordance anywhere**; submit/remittance/payer-AR are wired but operate only on claims that can't be created in-product.
- **No payment void/refund, no payment-plan creation, no printable receipt** from the UI.

None is a security bypass, so this is not a FAIL — but a clinic cannot discount, cannot reverse a mis-keyed payment, cannot file or even create an insurance claim, and cannot hand a patient a printed receipt. That is not yet production-ready for billing operations.

**V1 readiness:** Yellow (core present + safe; important V1 billing affordances missing at the FE).

---

## 2. Gaps by Severity

### P0 — blocks safe V1
_None._ Core issue→pay→void→write-off works live; every money write is RBAC owner/associate-gated and audited (actor = `session.userId`, not the client-supplied `recordedByMemberId`); cross-tenant report leak (EM-BIL-002) is fixed and pinned (`dental-billing.cross-tenant-reports.test.ts`). No authz/integrity bypass reachable.

### P1 — fix before production
| ID | Gap | Area | Evidence | Decision |
|----|-----|------|----------|----------|
| **BIL-G1** | **No discount-apply UI (split affordance vs. a V1-Required workflow).** `applyDentalDiscount` (POST `…/{invoiceId}/discount`, **owner-only**, reason-required, rate bound 0–100 per V-BIL-001) has **0 FE consumers**. The invoice detail shows discount **read-only** (`invoice-detail.tsx:324-328`); the action footer is exactly **Record Payment · View Payment Plan · Void · Mark Uncollectible · Close** (live screenshot `final_execution_2`). A clinic cannot grant a discount from the product at all. Violates standard §8.4 *"UI should require reason if discount/write-off is applied"* (V1 Required) and leaves BILL-BR-004 enforced but unreachable. | 1,4,5 | App-wide grep `applyDentalDiscount` → NONE; footer screenshot. | Wire the reason-required owner-only POST. |
| **BIL-G2** | **The insurance/HMO revenue-cycle is unreachable end-to-end from the UI.** The Insurance tab worklist renders fully (status filter tabs + CLAIM/STATUS/BILLED/PAYER-PAID/OUTSTANDING/ACTIONS columns + payer-AR aging) but live shows **"No insurance claims yet"** and there is **no create-claim affordance anywhere** in the app. Unwired: `createInsuranceClaim`, `addInsuranceClaimLine`, `updateInsuranceClaimLine`, `getInsuranceClaim` (no claim detail/line editor), and `estimateClaimCoverage` (hook exists, **no UI trigger**). Only `listInsuranceClaims`, `updateInsuranceClaimStatus` (submit), `recordClaimRemittance`, `getPayerArAging` are wired — i.e. you can *act on* claims that **cannot be created in-product**. A large, fully-tested backend (claims FSM 10-state, multi-line, remittance idempotency, disallowance write-off, coverage engine; `revenue-cycle-acceptance.test.ts`) has zero reachable entry point; the seed creates no claims, so the surface is empty for every user. | 1,2,3,4 | Live screenshot `final_execution_5` (empty worklist, no "New claim"); grep all four ops → NONE. | Wire create-claim (+lines, +coverage estimate, +claim detail). Confirm phase intent — see [NEEDS CONFIRMATION]. |

### P2 — recommended before prod
| ID | Gap | Area | Evidence |
|----|-----|------|----------|
| **BIL-G3** | **No payment void/refund UI.** `voidDentalPayment` (POST `…/payments/{paymentId}/void`, **owner-only**, reverses invoice `paid`/balance, audited `payment.void` per V-BIL-013) has **0 FE consumers**. The payments sub-table (live `final_execution_3`) renders receipt/date/method/amount with **no per-row Void/Refund control**. A mis-keyed or wrong-method payment cannot be reversed in-product. Standard §3.8 + BILL-BR-005 (voids/refunds auditable, V1 Recommended). | 2,3,4,5 | grep `voidDentalPayment` → NONE; payments-table screenshot. |
| **BIL-G4** | **No payment-plan CREATE/UPDATE UI.** `createDentalPaymentPlan` (auto-generates 2–24 installments, V-BIL-002) and `updateDentalPaymentPlan` (FSM `on_track⟷behind→completed\|defaulted`) have **0 FE consumers**; only `getDentalPaymentPlan` (view) is wired (`payment-plan-view.tsx`). The invoice footer's **"View Payment Plan"** button can only display a plan created via API/seed — installment plans are non-functional from the UI. | 2,3,4 | grep both ops → NONE; only `getDentalPaymentPlanOptions` referenced. |
| **BIL-G5** | **No printable receipt (standard says V1 Required).** `getDentalPaymentReceipt` (GET `…/payments/{paymentId}/receipt`, printable, includes voided-receipt metadata for EC5) has **0 FE consumers** — the receipt number is *recorded* but never *fetched/rendered*. Standard §8.4 *"Receipt preview"* is **V1 Required**; a clinic cannot hand a patient a receipt artifact. (Payment data is visible in the detail sub-table, so this is "no print view," not "no record" — hence P2, but it is a V1-Required line.) | 4,5 | grep `getDentalPaymentReceipt` / `receipt`/`print` button → NONE. |
| **BIL-G6** | **Duplicate balance source of truth.** Patient profile computes balance **client-side** by summing `invoice.balanceCents` (`patient-profile-page.tsx:171`); the authoritative `getPatientBalance` endpoint (sum of **non-voided** invoices + overdue count + active-plan count) has **0 FE consumers**. If the invoice list is ever filtered/paginated/excludes voided differently, the displayed balance diverges from the canonical figure. BILL-BR-006 (balance = invoices − payments/adjustments). | 7 | grep `getPatientBalance` → NONE; `patient-profile-page.tsx:171` client `reduce`. |

### P3 — polish / deferred
| ID | Gap |
|----|-----|
| **BIL-G7** | **`getCollectionsSummary` has 0 FE consumers.** Collections totals-per-window endpoint is unused; `CollectionsView` derives everything from `getArAging` instead. Harmless redundancy — either wire it into a collections KPI strip or document it as backend-only. |
| **BIL-G8** | **AR-aging seed has no aged receivables (demo-coherence).** Live Collections shows **100% in the Current bucket** for all 10 patients (oldest ~0–30d) and **₱0.00 rendered in red** in 31-60/61-90/90+ for every row, so the aging buckets and overdue styling can never be exercised/demoed. Seed needs a few invoices issued 35/65/95 days ago; also suppress the red treatment of a ₱0.00 bucket. |
| **BIL-G9** | **`estimateClaimCoverage` UI trigger missing** (folds into BIL-G2). The coverage-estimate mutation exists in `use-insurance-claims.ts:155` but nothing invokes it; moot until claims can be created. |

> **Out of scope / deferred (do NOT fix here):** electronic clearinghouse e-submission + ERA/EOB remittance (claim *drafts* + readiness are the V1 surface; e-transmit is V2 per standard §3.9/§12); GL/accounting export (V2 §3.8). The upstream Stripe `services/api-ts/src/handlers/billing/` primitive is **not consumed by the dental vertical** (zero Stripe imports; dental payments are cash/card/bank recorded manually) — it is the source of the standing `billing-lifecycle.hurl` MinIO env-failure baseline and is **not** a dental-billing gap.

---

## 3. Recommended Fix Order

Honesty-of-affordance + daily operational value first; biggest-but-market-specific surface later.

1. **BIL-G1 — wire discount apply** (owner-only, reason-required) into the invoice-detail footer as an explicit action with a mandatory reason field. Cheap, self-contained, daily workflow, satisfies a V1-Required standard line and makes BILL-BR-004 reachable. Highest value-per-effort.
2. **BIL-G5 — receipt preview/print** (`getDentalPaymentReceipt`) from each payment row / after recording. V1-Required by the standard, fully-built backend, small FE.
3. **BIL-G3 — payment void/refund** on the same payments sub-table (owner-only, reason-required), reusing the void pattern from invoice void. Closes the reversal gap.
4. **BIL-G4 — payment-plan create/update** UI: a "Create Payment Plan" action (installment count 2–24, frequency) on issued/partial invoices + status transitions on the plan view.
5. **BIL-G2 — insurance/claims create surface** (largest): create-claim-from-invoice, add/edit lines, claim detail sheet, and a coverage-estimate button (BIL-G9). Confirm phase intent first ([NEEDS CONFIRMATION]); this is the biggest build but unlocks an entire tested backend.
6. **BIL-G6 — consolidate balance** onto `getPatientBalance` (single source of truth) or add a FE test asserting the client sum equals the endpoint.
7. **BIL-G8 / BIL-G7** — seed aged receivables + ₱0.00-bucket styling; decide `getCollectionsSummary` (wire or document).

---

## 4. Dependencies on Other Modules

| Fix | Depends on / touches | Note |
|-----|----------------------|------|
| **BIL-G1** | **dental-org** (role grid: owner-only discount) + **audit** (`discount.applied`) | Backend already gates + audits; FE only needs the affordance + reason capture. |
| **BIL-G2** | **dental-patient/insurance** (`createInsuranceProfile`, `createCoverageAuthorization` already exist there) + **dental-visit** (claim anchored to invoice/visit) | A claim is invoice-anchored; the create flow needs a patient insurance profile to exist first — verify the profile-create FE path exists or is also a gap (cross-check `dental-patient-gap-plan.md`). |
| **BIL-G3** | **audit** (`payment.void`) | Reversal must stay audited (backend does this); FE is owner-only + reason. |
| **BIL-G5** | **dental-org** (clinic identity/branding on the receipt) | Receipt header pulls clinic + patient details; depends on org profile being populated. |
| **BIL-G6** | **dental-patient** (patient profile page owns the display) | Decide canonical balance source; coordinate with patient profile. |
| **BIL-G8** | **seed** (`db:reseed`) | Aged-invoice scenario is a seed-coherence change, not a handler change. |

Spec-first reminder: any fix that changes request/response shapes (none strictly required — all target endpoints already exist) must regenerate the SDK and re-gate full typecheck + contract. The 8-file MinIO/Mailpit infra baseline (incl. `billing-lifecycle.hurl`) is expected-fail and unrelated.

---

## 5. Existing Tests Found

**Backend (24 files — strong):** `dental-billing.test.ts`, `.invoice-lifecycle.test.ts`, `.ar-aging-statements.test.ts`, `.edge-cases.test.ts`, `.cross-tenant-reports.test.ts` (EM-BIL-002 ×5), `acceptance.billing-payments.test.ts` (AC-PAY-01..05), `dental-insurance-claim.test.ts`, `dental-payer-payment.test.ts`, `revenue-cycle-acceptance.test.ts` (full PH HMO journey), `revenue-cycle-route-registration.test.ts`, `invoice.fsm.property.test.ts`, `claim.fsm.property.test.ts`, `payment-plan.fsm.property.test.ts`, `dental-billing.payment-plan-fsm.test.ts`, `billing-gate-http.test.ts` (BR-009/014 consent gate), `dental-billing-events.test.ts` (DE-007/008/009 audit), repo tests (invoice/payment/plan), util tests (`aging`, `coverage-estimate`, `rounding`).

**Frontend unit:** `billing-list.test.ts` (+`.error`), `invoice-detail.test.ts` / `.mutations` / `.void` / `.uncollectible` / `.coherence`, `payment-plan-view.test.ts`, `claims-worklist.test.tsx`, `insurance.helpers.test.ts`, hooks (`use-invoices`, `use-invoice-detail`, `use-collections`, `use-insurance-claims`), `workspace-payment-modal.test.ts` + `use-workspace-payment.test.ts` (QA-004/008 branchId), `use-patient-billing.test.ts`, `my-invoices-view.test.tsx`, `revenue-report.test.ts`, `use-dashboard-summary.test.ts`.

**E2E:** `billing.spec.ts`, `invoice-detail.spec.ts`, `payment-plan.spec.ts`, `insurance-claims.spec.ts`, `billing-queue-morgan.spec.ts`, `clinical-billing-handoff.spec.ts`, `journeys/04-revenue-chain.journey.spec.ts`.

**Coverage shape:** the backend is over-covered; the FE E2E suite exercises the *wired* path (create-from-workspace → pay → collections) but cannot cover discount/void-payment/plan-create/claim-create because **those UIs don't exist** — i.e. the test gaps below are gated on the fixes, not on missing assertions for existing UI.

## 5b. Missing / Recommended Tests (write RED before each fix)

| Gap | Required tests (failing first) |
|-----|--------------------------------|
| **BIL-G1** | (a) FE unit: discount action visible **only** for owner + writable status; entering a reason calls `applyDentalDiscount`; submitting **without** a reason is blocked client-side (mirrors backend reason-required). (b) E2E: owner applies 10% discount → invoice total drops, discount line shows, balance recomputed. (c) FE-unit negative: non-owner profile does not see the discount affordance. |
| **BIL-G2** | (a) E2E (the headline): from an invoice/patient with an insurance profile → **Create Claim** → add line(s) → claim appears in worklist (no longer "No insurance claims yet") → **Submit** → **Record Remittance** (payer-paid + disallowance) → claim reconciles and payer-AR updates. (b) FE unit: create-claim form requires ≥1 line (mirrors NO_CLAIM_LINES). (c) FE unit: coverage-estimate button renders covered/patient split. |
| **BIL-G3** | FE unit + E2E: a recorded (non-voided) payment exposes a **Void/Refund** action (owner-only) → reason required → `voidDentalPayment` called → invoice `paid` reverses, balance rises, voided receipt still viewable (EC5). |
| **BIL-G4** | FE unit + E2E: issued/partial invoice → **Create Payment Plan** (count 2–24, frequency) → `createDentalPaymentPlan` → installments render; reject count <2 / >24 client-side. Plan view exposes status transitions. |
| **BIL-G5** | FE unit + E2E: after recording a payment, a **Receipt** action fetches `getDentalPaymentReceipt` and renders a printable view with clinic + patient + amount + receipt#. |
| **BIL-G6** | FE unit: patient-profile displayed balance **equals** `getPatientBalance` for a patient with a voided invoice + an active plan (proves client-sum and canonical endpoint agree, or migrate to the endpoint). |
| **BIL-G8** | Seed-coherence test: demo branch has ≥1 invoice in each of 31-60 / 61-90 / 90+ buckets so aging is demonstrable. |

---

## 6. Knowledge Graph / Wiring Findings

- **Wiring artifacts used:** `.understand-anything/contract-spine.json` + `domain-graph.json` (present, consulted) plus a fresh full FE↔BE grep map. The contract-spine "operationId → handler → SDK → FE" lens is exactly the consumer-detection used here.
- **Endpoint consumer census (the core deliverable):** of ~27 dental-billing operations, **WIRED (12):** createDentalInvoice, issueDentalInvoice, voidDentalInvoice, getDentalInvoice, listDentalInvoices, recordDentalPayment, markUncollectible, getDentalPaymentPlan, getArAging, generateStatementBatch, getPayerArAging, listInsuranceClaims, updateInsuranceClaimStatus, recordClaimRemittance, estimateClaimCoverage(hook-only). **ZERO FE CONSUMER (11):** `applyDentalDiscount`, `voidDentalPayment`, `listDentalPayments`(embedded), `getDentalPaymentReceipt`, `getPatientBalance`, `createDentalPaymentPlan`, `updateDentalPaymentPlan`, `getCollectionsSummary`, `createInsuranceClaim`, `addInsuranceClaimLine`, `updateInsuranceClaimLine`, `getInsuranceClaim`.
- **Blast radius:** all gaps are **additive FE wiring** — they call endpoints that already exist, are RBAC-gated, audited, and tested. No backend, TypeSpec, or SDK shape change is required (so no contract regen risk). The one cross-module touch is BIL-G2 needing an insurance-profile create path (cross-check `dental-patient-gap-plan.md`).
- **Two billing modules, do not confuse:** `handlers/billing/` is the frozen upstream **Stripe** primitive (merchant/webhook/refundInvoicePayment) and is **unused by the dental vertical**; `handlers/dental-billing/` is the in-product cash/card/bank money module. Refund exists in the Stripe primitive but **not** as a dental payment-void FE path (that's BIL-G3).

---

## 7. Broken / Misleading Journeys (live)

- **Insurance tab → "No insurance claims yet" with no escape hatch** (`final_execution_5`): a user who opens Insurance sees a fully-built worklist + filters + payer-AR scaffolding and **nothing they can do** — no create, and the seed populates none. Misleading: implies a feature that is unreachable.
- **"View Payment Plan" on an invoice with no plan** (BIL-G4): the affordance exists but creation does not, so the button is a dead-end for any non-seeded invoice. `[NEEDS CONFIRMATION]` — verify it shows a graceful empty state vs. an error.
- **Discount shown but not editable** (`final_execution_2`): the totals block renders a "Discount" line, implying discounts are a thing, but there is no way to add one — a half-built affordance.

Everything on the **money happy path is honest and works** (list → payable invoice → record payment → balance drops → receipt row appears → invoice persists; collections aging renders with real ₱203,749 AR across 10 patients).

---

## 8. [NEEDS CONFIRMATION]

- **Insurance/claims FE — deferred phase or genuine gap?** The backend is a complete PH-HMO revenue cycle but has no create entry point. Confirm whether claims-FE is a planned later phase (then BIL-G2 is "scheduled," not "missing") or an oversight.
- **Where does the displayed discount on INV-S0002 come from?** Discount renders read-only but `applyDentalDiscount` is unwired — confirm it originates from seed / treatment-level pricing, not a hidden FE path (i.e. that BIL-G1 is truly "no apply UI").
- **"View Payment Plan" empty-state behavior** when no plan exists (graceful vs. error).
- **Receipt artifact (BIL-G5) severity** — is the in-detail payments sub-table considered sufficient for V1, or is a printable receipt a launch requirement? (Standard tags receipt preview V1 Required.)

---

## 9. Live Evidence

`outputs/dental-billing-audit/final_runs/run_1/` — `plan.md` + `final_script.py` + `final_script_log.txt` (FINAL DATUM 4/5 CP pass; CP5 confirmed via screenshot) + screenshots:
- `final_execution_1_billing_list.png` — 15 invoices, cards ₱203,750 / ₱71,450 / ₱15,200.
- `final_execution_2_invoice_detail_actions.png` — footer = Record Payment · View Payment Plan · Void · Mark Uncollectible · Close (**no Apply Discount**).
- `final_execution_3_payments_subtable.png` — payment R-AUD-… ₱1.00 Cash recorded, balance ₱2,400 → ₱2,399 (**no per-payment void, no receipt print**).
- `final_execution_4_collections.png` — AR aging table, Total AR ₱203,749 / 10 patients, Generate-statements (**all in Current bucket — BIL-G8**).
- `final_execution_5_insurance.png` — claims worklist + filters render but **"No insurance claims yet"** with **no create-claim affordance** (BIL-G2).
