# Billing — Standards & Experience Review
> Review date 2026-06-02 · Depth: LIGHT (table-stakes)

## 1. What we have
Solid patient-ledger billing core. Invoice lifecycle (`createDentalInvoice`, `issueDentalInvoice`, `voidDentalInvoice`) with FSM property tests; payments (`recordDentalPayment`, `voidDentalPayment`, receipts); installment payment plans with their own FSM (`createDentalPaymentPlan`, `updateDentalPaymentPlan`); discounts/adjustments (`applyDentalDiscount`, `discount_cents`/`discountReason` columns); patient balance (`getPatientBalance`); collections summary by window (`getCollectionsSummary`, FR4.5); `markUncollectible`. Money math centralized in `utils/rounding.ts`. Frontend present at `apps/dentalemon/src/features/billing/{components,hooks}`. Insurance-claim *drafting* lives in the patient module (`dental-patient/insurance/createClaimDraft.ts`, `getClaimReadiness.ts`, `updateClaimStatus.ts`) — manual status tracking, not e-claim submission.

## 2. Table-stakes gaps
| Capability | Industry table-stakes | Our status | Evidence | Severity |
|---|---|---|---|---|
| Patient ledger w/ adjustments | Running ledger, charges, payments, credits, write-offs | ✅ | `dental-billing/repos/dental-invoice.schema.ts` (discount cols), `recordDentalPayment.ts`, `applyDentalDiscount.ts` | — |
| Payment plans | Installment agreements vs ledger | ✅ | `createDentalPaymentPlan.ts` + `payment-plan.fsm.property.test.ts` | — |
| AR aging / collections | 30/60/90+ aging buckets, follow-up | ⚠️ | `getCollectionsSummary.ts` does period totals (today/month/year), **not aged 30/60/90 buckets** | P2 |
| Fee schedules | Multiple schedules (UCR/PPO/cash) per provider/plan | ⚠️ | `dental-org/feeSchedule.ts` — single per-branch `Record<cdtCode, priceCents>`; no UCR vs PPO vs cash tiers | P2 |
| Insurance e-claims | Electronic submission via clearinghouse, batch, secondary auto-gen | ❌ | `dental-patient/insurance/` is draft/status only; no clearinghouse/EDI/837, no secondary auto-gen | P1 |
| Eligibility verification | Real-time eligibility + per-procedure benefit estimation | ❌ | No eligibility code anywhere in `dental-billing/` or `insurance/` | P1 |
| EOB / ERA posting | Post insurer payments/adjustments, reconcile | ❌ | No EOB/ERA handler; payments are patient-side only | P1 |
| PPO write-off automation | Auto contractual write-off from fee-schedule delta | ❌ | Discounts are manual (`discountReason`); no contracted-fee write-off engine | P1 |
| Statements | Patient statements, batch runs | ⚠️ | `dental-patient/identity/getDentalPatientStatement.ts` exists (per-patient); no batch statement run | P2 |
| Online payments / card-on-file | Integrated card processing, autopay | ❓ | No Stripe/processor wiring spotted in `dental-billing/`; base template has Stripe billing but not dental-wired | P2 |

## 3. Notable findings
- **[P1] No insurance revenue cycle** — claims are manual drafts (`createClaimDraft.ts`), no eligibility, no EOB/ERA posting, no PPO write-off automation. This is the single biggest gap vs Dentrix/Open Dental; insurance is most US dental practices' primary revenue path. Recommend a dedicated revenue-cycle epic (eligibility stub → claim submission → EOB posting → contractual write-off).
- **[P2] Collections is period-totals, not AR aging** — `getCollectionsSummary.ts` reports today/month/year totals; add 30/60/90+ aged buckets and a follow-up worklist.
- **[P2] Single flat fee schedule** — `feeSchedule` is one `cdtCode→price` map per branch; no UCR/PPO/cash tiers, which also blocks write-off automation.
- **[P2] Statements are per-patient only** — no batch statement run / EOB reconciliation.

## 4. Carousel relevance
Strong longitudinal angle: a per-patient billing **ledger over time** (charges → payments → balance trajectory) and collections trend are natural comparison/timeline surfaces. Payment-plan progress and aging migration across periods are inherently temporal and fit the snapshot-over-time model.
