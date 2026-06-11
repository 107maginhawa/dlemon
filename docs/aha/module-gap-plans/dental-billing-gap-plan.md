# AHA Module/Group Gap Plan: Dental Billing

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Dental Billing |
| Module slug | dental-billing |
| Type | Business Module |
| Output file | `docs/aha/module-gap-plans/dental-billing-gap-plan.md` |
| Primary PRD/spec used | `docs/prd/v3-dentalemon.md` §6.4 (FR4.1–FR4.12) + §6.5 (reports) + §6.0 (dashboard cards) |
| Supporting PRDs/specs used | `docs/prd/BUSINESS_RULES.md` BR-009..015; `docs/prd/ACCEPTANCE_CRITERIA.md` AC-INV/AC-PAY/AC-BIL; `docs/product/modules/dental-billing/MODULE_SPEC.md` + `API_CONTRACTS.md`; `docs/product/WORKFLOW_MAP.md` WF-042/WF-054/WF-090/WF-097 |
| PRD/spec coverage quality | Strong |
| Paths inspected | `services/api-ts/src/handlers/dental-billing/` (27 handlers + 6 schemas + 3 facades + 25 test files); `apps/dentalemon/src/features/billing/` (7 components, 4 hooks, 16 test files); `features/workspace/` payment surfaces; `features/dashboard/`; `src/handlers/dental-patient/identity/archiveDentalPatient.ts` + `patient.repo.ts` (EC1); `specs/api/tests/contract/dental-billing.hurl` + `dental-revenue-cycle.hurl`; `apps/dentalemon/tests/e2e/` billing specs |
| PRDs/specs inspected | All listed above, fully extracted to a 77-requirement checklist before code comparison |
| KG used | Yes — `contract-spine.json` (2026-06-10) as wiring oracle; zero-consumer claims cross-checked with FE grep |
| KG refreshed | No (per `docs/aha/kg/knowledge-graph-status.md`) |
| `/understand-domain` used | Yes (cross-check only) |
| `/understand-domain` refreshed | No |
| Webwright used | No — the prior gap plan (`docs/audits/module-gap-plans/`, 2026-06-09) included a live drive ≤2 days old; every new claim here (affordance absence, dead code) is conclusively provable statically via contract-spine + source grep. Runtime re-drive adds no evidence for these gap classes. |
| Playwright/E2E inspected | Yes (inspected, not run): `billing.spec.ts`, `clinical-billing-handoff.spec.ts`, `billing-queue-morgan.spec.ts`, `insurance-claims.spec.ts`, `journeys/04-revenue-chain.journey.spec.ts` |
| Existing tests inspected | 25 backend files (~299 assertions), 16 FE files, 2 hurl suites (59 requests), 5 E2E specs |
| Cross-cutting audit reviewed | Not Available (prompt 05 not yet run) |
| Database/schema audit reviewed | Not Available (prompt 06 not yet run) |
| Limitations | Prior-audit fixes cross-checked in source at key spots (failClosed, EM-BIL-002 scoping, localId) but not line-by-line re-proven with test runs; no tests were executed (audit-only prompt) |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| v3 PRD §6.4 Billing | `docs/prd/v3-dentalemon.md` | PRD | Current | FR4.1–4.12: invoice lifecycle, payments, plans, discounts, receipts, balance, collections + EC1–EC11 edge cases |
| Business rules BR-009..015 | `docs/prd/BUSINESS_RULES.md` | business rules | Current (load-bearing) | Billable-treatment gate, tax stub, plan-blocks-void, invoice FSM, uncollectible, consent gate, discount/installment bounds |
| Acceptance criteria | `docs/prd/ACCEPTANCE_CRITERIA.md` | acceptance criteria | Current (load-bearing) | AC-INV-01/03, AC-PAY-01..05, AC-BIL-001..005 |
| Module spec | `docs/product/modules/dental-billing/MODULE_SPEC.md` | module spec | Current (reconciled 2026-06-08) | FSMs §8, permissions §6, validations §5, events §10b |
| API contracts | `docs/product/modules/dental-billing/API_CONTRACTS.md` | API contract | Current | 18+ endpoints incl. claims block (Phase-2 declared) |
| Workflow map | `docs/product/WORKFLOW_MAP.md` | workflow spec | Current | WF-042 fee lookup, WF-054 overdue job, WF-090 treatment→invoice, WF-097 clinical→billing handoff |
| Prior module audit | `docs/audits/modules/MODULE_dental-billing_AUDIT_2026-06-08.md` | prior audit (pre-AHA) | Current | 20/20 BR/AC items verified; EM-BIL-002 fixed+pinned |
| Prior gap plan + matrix rows | `docs/audits/module-gap-plans/` + `docs/audits/MASTER-GAP-MATRIX.md` BIL-G1..G9 | prior gap plan (pre-AHA) | Partially superseded | Re-verified each row against today's source (see §3) |
| PRD §6.4 overpayment-credit clause | `docs/prd/v3-dentalemon.md` FR4.2 | PRD | **Conflicting** | PRD says overpayment → credit balance; implemented+BR-tested behavior is 422 `PAYMENT_EXCEEDS_BALANCE` (see §25) |

## 3. Expected vs Actual

**Expected (PRD §6.4):** a complete chairside-to-cashier money loop — invoice auto-built from performed treatments with consent gating; payments (cash/card/bank-transfer) with receipts (print+email, VOIDED watermark on reprint); installment plans (2–24, the headline PH ₱60k-braces feature); locale discounts (PH PWD/Senior + manual w/ reason); overdue tracking driving badges and follow-ups; collections/revenue reporting for owners; claims explicitly **Phase 2**.

**Actual:** The **backend implements virtually all of V1 and much of Phase 2** — 27 handlers, strict FSMs (property-tested), owner-only guards, fail-closed audit on money mutations (`voidDentalInvoice.ts:66-78` confirmed), cross-tenant report scoping (EM-BIL-002 fix confirmed in `getArAging.ts:39-43`), offline `localId` idempotency on invoice create (`createDentalInvoice.ts:43-49`, unique index `dental-invoice.schema.ts:52-54`), receipt-number idempotency on payments. The **frontend wires only the core loop**: create→issue→record-payment→void-invoice→uncollectible (`invoice-detail.tsx`), invoice list, plan **view**, AR-aging, statements, claims worklist (status/remittance only).

Three findings change the prior picture:

1. **NEW — the overdue lifecycle is dead code.** `DentalInvoiceRepository.markOverdueInvoices()` (`repos/dental-invoice.repo.ts:271-277`, implements FR4.1b/WF-054) has **zero callers** — repo-wide grep finds only its definition and tests, and `services/api-ts` has **no job scheduler at all** (no `src/jobs/`, no pg-boss/cron wiring in `src/index.ts`/`src/core/`). Invoices can never reach `overdue` status in production, so the billing-list "overdue" filter, FR4.8 overdue badges, and J44 follow-ups silently never trigger from due-date passage.
2. **Claims are Phase-2 per PRD** (§2.5, MODULE_SPEC §19) — the prior matrix carried create-claim wiring as P1; against the PRD it is **deferred scope**, and the already-built half (worklist + remittance + status FE, full backend) is **Possible Overbuild** shipped early. The product question is park-vs-finish, not "fix" (§25).
3. **BIL-G6 (balance dual-source) is softer than recorded:** FE does *not* recompute money math — `use-patient-billing.ts:19-31` sums **server-computed** `invoice.balanceCents`; `getPatientBalance` endpoint is simply unconsumed. Residual risk is consistency-drift, not wrong-math.

The remaining gaps are concentrated in one class: **PRD-required cashier affordances whose backends are complete and tested but have no UI** — discount, receipt, payment-void, payment-plan create.

## 4. PRD / Spec Coverage Matrix

(Condensed to requirement clusters; ✓BE = handler implemented+tested.)

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR4.1/BR-009/BR-014 invoice from visit, consent + billable gates | Auto-build itemized invoice; 422 on no-treatments/no-consent | ✓BE + FE (workspace modal + billing) | `workspace-payment-modal.tsx`, `use-workspace-payment.ts` | `createDentalInvoice.ts` (consent, double-billing, localId) | `dentalInvoices`+`dentalInvoiceLineItems` | `billing-gate-http.test.ts`, hurl, J04 E2E | Implemented | No |
| FR4.1b/BR-012 invoice FSM incl. overdue | draft→issued→partial→paid\|overdue\|voided\|uncollectible; overdue auto via job (WF-054) | FSM ✓; **overdue transition has no trigger** | billing-list "overdue" filter exists | `markOverdueInvoices` `dental-invoice.repo.ts:271` — **0 callers; no scheduler in api-ts** | status enum has `overdue` | `invoice.fsm.property.test.ts` covers states; **no caller test possible** | Partially Implemented | **GAP-1** |
| FR4.2 record payment (cash/card/bank) | All roles record; idempotent; balance updates | ✓BE + FE | `invoice-detail.tsx:206-225` | `recordDentalPayment.ts` (receipt-idempotency, terminal guards) | `dentalPayments` | hurl + `acceptance.billing-payments.test.ts` + E2E balance-drop | Implemented | No |
| FR4.2 payment void/reversal | Owner voids wrong payment; reversal record; both visible | ✓BE only — **no FE affordance** | grep `voidDentalPayment` in FE = 0 hits | `voidDentalPayment.ts` (owner-only, failClosed, reverses invoice) | reversal row kept | BE tested; contract-spine: 0 consumers | Partially Implemented | **GAP-5** |
| FR4.2 overpayment → credit balance | PRD: credit carried forward | **Contradicted**: 422 `PAYMENT_EXCEEDS_BALANCE` (V-BIL-004, BR-tested) | n/a | `recordDentalPayment.ts` overpayment guard | — | `dental-billing.test.ts` pins the reject | Unclear (conflicting refs) | §25 Q3 |
| FR4.3/BR-015 payment plans 2–24, frequency, status | Create/manage installment plans; Behind/Defaulted tracking | ✓BE (create/update/get, FSM) — **FE view-only** | `payment-plan-view.tsx` (read); grep `createDentalPaymentPlan` in FE = 0 hits | `createDentalPaymentPlan.ts`, `updateDentalPaymentPlan.ts` | `dentalPaymentPlans` | `dental-billing.payment-plan-fsm.test.ts` + property tests; contract-spine: create/update 0 consumers | Partially Implemented | **GAP-3** |
| FR4.3 plan "Behind" auto-status (7+ days past due) | Plan flips Behind → badge/reminder | Status enum exists; **no scheduler exists** (same engine absence as GAP-1) | — | — | plan status enum | — | Unclear `[NEEDS CONFIRMATION]` | GAP-1 (shared cause) |
| FR4.6 receipt per payment (print+email, locale format) | Official printable/emailable receipt | ✓BE only — **no FE affordance** | grep `getDentalPaymentReceipt` in FE = 0 hits | `getDentalPaymentReceipt.ts` | — | BE tested; 0 consumers | Partially Implemented | **GAP-4** |
| EC5 VOIDED watermark on reprint | Voided receipt watermarked | Blocked by GAP-4+GAP-5 (no receipt or void UI) | — | — | — | — | Missing | folds into GAP-4/5 |
| FR4.7/BR-015 manual discount w/ reason | Owner applies 0–100% + reason | ✓BE only — **no FE affordance** | grep `applyDentalDiscount` in FE = 0 hits; invoice-detail shows discount read-only | `applyDentalDiscount.ts` (owner-only, reason, bounds, failClosed) | `discountCents` | BE+hurl tested; 0 consumers | Partially Implemented | **GAP-2** |
| FR4.7/EC3 automatic PWD/Senior discounts, highest-wins | PH statutory discounts auto-applied | **Missing** — no auto-discount logic anywhere; regulatory layer FR11.2 unbuilt | — | only manual `applyDentalDiscount` | patient disability/senior fields exist on dental-patient | none | Missing | §25 Q4 / V2 path |
| FR4.4/FR4.8 patient balance + overdue badges | Per-patient owed; red badge | Balance via summed server `invoice.balanceCents` ✓; **overdue badge can never fire** (GAP-1) | `use-patient-billing.ts:19-31` | `getPatientBalance.ts` exists, 0 consumers | server-computed `balanceCents` | FE coherence tests | Partially Implemented | GAP-1, GAP-11 |
| FR4.5/FR0.4 collections summary (daily/monthly) | Dashboard daily collections | Dashboard computes from `listDentalInvoices`; `getCollectionsSummary` 0 consumers | `use-dashboard-summary.ts` | `getCollectionsSummary.ts` orphan | — | BE tested | Implemented (alt path) | GAP-8 (P3) |
| FR4.9 billing list + filters | Status/date/patient filters, summary cards | ✓ | `billing-list.tsx` + tests | `listDentalInvoices` (branchId required) | — | FE tests + E2E | Implemented | No |
| FR4.11/EC11 receipt numbering (device prefix, offline) | Per-device sequential blocks | Server generates `reference` when omitted; device-prefix offline scheme not evident | — | `recordDentalPayment` reference gen | — | — | Unclear `[NEEDS CONFIRMATION]` | GAP-13 (P3) |
| FR4.12/EC8 banker's rounding | Centavo rounding everywhere | ✓ | — | `utils/rounding.ts` | — | `utils/rounding.test.ts` (15) | Implemented | No |
| BR-010 tax stub 0% | taxCents always 0, server-controlled | ✓ | — | EM-BILL-001 guard | — | tested | Implemented | No |
| BR-011/AC-PAY-03/05 plan blocks void | 409 ACTIVE_PAYMENT_PLAN | ✓ | void UI surfaces error | `voidDentalInvoice.ts:35-50` | — | tested + hurl | Implemented | No |
| BR-013 uncollectible owner-only | Outstanding→uncollectible terminal | ✓ FE+BE | `invoice-detail.tsx:146-154` | `markUncollectible.ts` | — | FSM property tests | Implemented | No |
| EC1/FR2.7 archive blocked by active plan | Block archive w/ active plan | ✓ (cross-module) | — | `patient.repo.ts:140-145` `hasActivePaymentPlan` guard | flag on `patients` | `dental-patient.test.ts` | Implemented | No `[SHARED DEPENDENCY]` flag-sync |
| FR5.x revenue reports, owner-only | Date-range revenue, export | ✓ (separate reports feature; fixed 2026-06-05) | `features/reports/` | `billing-report.facade.ts` | — | strengthened specs | Implemented | No |
| Claims block (PRD §2.5 **Phase 2**) | HMO claims workflow — deferred | Backend 100% built+tested; FE half-built (worklist/status/remittance wired; create/lines/detail 0 consumers) | `claims-worklist.tsx` — no create affordance | `createInsuranceClaim` et al., 4 ops 0 consumers | `dentalInsuranceClaims`, `dentalPayerPayments` | `revenue-cycle-acceptance.test.ts`, `dental-revenue-cycle.hurl` GREEN | Possible Overbuild (early Phase-2) | GAP-7 / §25 Q1 |
| DE-007/008/009 events | Audit-log markers | ✓ incl. partial-payment negative pin | — | — | — | `dental-billing-events.test.ts` | Implemented | No |
| EM-BIL-002 report tenancy | Omitted branchId scopes to caller | ✓ (fix confirmed in source) | — | `getArAging.ts:39-43` + facade | — | `dental-billing.cross-tenant-reports.test.ts` (5) | Implemented | residual GAP-10 pin |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| FR4.1b/WF-054 overdue automation | **GAP-1**: `markOverdueInvoices` never invoked; no job scheduler exists in api-ts → `overdue` status unreachable in prod; FR4.8 badges + J44 follow-ups dead | P1 | V1 REQUIRED | `repos/dental-invoice.repo.ts:271-277` 0 callers (repo-wide grep); no `src/jobs/`, no scheduler wiring in `src/index.ts`/`src/core/*` | Wire a scheduled invocation (boot-interval timer or pg-boss if adopted) + RED-first caller test proving issued+past-due → overdue; decide scheduler mechanism `[SHARED DEPENDENCY]` (first consumer of a job runner — also needed by plan "Behind", WF-046 visit-lock) |
| FR4.7 manual discount | **GAP-2**: no discount UI; owner cannot apply PWD/Senior/manual discount from product (statutory PH need) | P1 | V1 REQUIRED | `applyDentalDiscount` 0 FE consumers (contract-spine + grep); backend owner-only+reason complete | Reason-required, owner-only discount action in `invoice-detail.tsx` footer (pre-issue states per FSM) |
| FR4.3 payment plans | **GAP-3**: plan create/update UI absent — headline PH installment feature unreachable end-to-end (view-only `payment-plan-view.tsx`) | P1 | V1 REQUIRED | `createDentalPaymentPlan`/`updateDentalPaymentPlan` 0 FE consumers; no alternate create path found in FE grep | "Create payment plan" (2–24, frequency, start date) on eligible invoices; reuse plan FSM errors |
| FR4.6 receipts | **GAP-4**: no receipt render/print anywhere; cash-practice trust artifact missing | P2 | V1 REQUIRED | `getDentalPaymentReceipt` 0 FE consumers | Receipt action per payment row → printable view (print stylesheet per §10.2); email delivery V1 RECOMMENDED follow-on |
| FR4.2 payment void | **GAP-5**: no payment-void UI; wrong payment uncorrectable from product (owner must use API) | P2 | V1 RECOMMENDED | `voidDentalPayment` 0 FE consumers | Owner-only void on payments sub-table + reason; show voided rows + VOIDED on reprint (with GAP-4) |
| MODULE_SPEC §6 attribution | **GAP-6**: `recordedByMemberId` client-supplied, unvalidated server-side — forgeable payment attribution | P2 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` (decision pending since 2026-06-08) | `recordDentalPayment.ts:120` uses `body.recordedByMemberId` directly | Server-derive from session membership (or validate body value ∈ caller's active memberships for the branch) |
| PRD §2.5 claims Phase-2 | **GAP-7**: claims FE half-shipped ahead of phase — create/lines/detail unreachable, worklist live | P2 | `[NEEDS PRODUCT DECISION]` (park vs finish) | `createInsuranceClaim`/`addInsuranceClaimLine`/`updateInsuranceClaimLine`/`getInsuranceClaim` 0 consumers; `claims-worklist.tsx` live | If park: label worklist as Phase-2 preview / hide create-less surface honestly. If finish: wire create+lines+detail (then E2E) |
| EM-BIL-002 residual | **GAP-10**: zero-branch-membership caller pin missing on the 5 report endpoints | P3 | V1 RECOMMENDED `[TEST GAP]` | prior audit §7; `dental-billing.cross-tenant-reports.test.ts` seeds only single-branch caller | Add membership-less caller → empty result (not 500/whole-DB) pin |
| FR4.4 balance source | **GAP-11**: `getPatientBalance` orphan while FE sums per-invoice server balances — drift-class risk only | P3 | V1 RECOMMENDED | `use-patient-billing.ts:19-31`; endpoint 0 consumers | Either consume endpoint or add equality pin (client sum == endpoint) |
| FR4.5 | **GAP-8**: `getCollectionsSummary` orphan (dashboard derives from invoice list) | P3 | V1 RECOMMENDED | contract-spine 0 consumers; `use-dashboard-summary.ts` alt path | Wire into collections KPI strip or document backend-only |
| Demo coherence | **GAP-9**: AR-aging seed has no aged receivables → aging report demos empty | P3 | V1 RECOMMENDED | prior gap plan BIL-G8; unchanged | Seed invoices issued 35/65/95 days back |
| FR4.11/EC11 | **GAP-13**: offline device-prefix receipt numbering not evident | P3 | `[NEEDS CONFIRMATION]` → likely V2 DEFERRED | server-side `reference` generation only | Confirm with offline-sync group audit; defer scheme until offline payments exist |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Full HMO claims backend (7 ops + FSM + remittance idempotency + payer-AR) | `dental-insurance-claim.test.ts`, `claim.fsm.property.test.ts`, `dental-revenue-cycle.hurl` (19 req GREEN) | PRD declares claims **Phase 2** | Carrying cost; tested-but-unreachable code | Keep (quality is high; it's the Phase-2 implementation arriving early) — **Do not expand** until claims are scheduled `[DO NOT OVERBUILD]` |
| Claims worklist FE (status transitions, remittance) without create path | `claims-worklist.tsx`, `use-insurance-claims.ts` | Phase 2 | Misleading surface: staff see a worklist that can never gain rows from the UI | Keep but clarify (label/hide per GAP-7 decision) `[NEEDS PRODUCT DECISION]` |
| `estimateClaimCoverage` mutation in hook with no UI trigger | `use-insurance-claims.ts:155-223` (dead mutation) | Phase 2 | Dead code in FE bundle | Do not expand; remove or wire with GAP-7 |
| `getPayerArAging` + payer-AR reporting | wired in `use-insurance-claims.ts` | Phase 2 (aging buckets listed Phase-2 in PRD §6.4 addendum) | Low | Keep |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Visit→invoice→payment (WF-090/097) | dentist, staff | visit completion / "Continue to Payment" | invoice from treatments → issue → record payment → balance drops | Implemented end-to-end | No | J04 revenue-chain E2E PASSING; `clinical-billing-handoff.spec.ts` |
| Discount application | dentist_owner | eligible patient / negotiation | open invoice → apply discount+reason → totals update → audit row | Backend only | **GAP-2** | 0 FE consumers |
| Installment plan lifecycle | dentist | expensive treatment | create plan (2–24) → track installments → Behind/Defaulted → completed | Backend FSM only; FE view-only; Behind automation lacks scheduler | **GAP-3, GAP-1** | 0 create consumers; no job engine |
| Receipt issuance | staff | payment recorded | fetch receipt → print/email; VOIDED watermark on reprint | Backend only | **GAP-4** | 0 FE consumers |
| Payment correction | dentist_owner | mis-keyed payment | void payment → reversal visible → reprint watermarked | Backend only | **GAP-5** | 0 FE consumers |
| Overdue follow-up (J44) | system→staff | due date passes | invoice→overdue → badge/filter → follow-up | **Dead**: transition never fires | **GAP-1** | `markOverdueInvoices` 0 callers |
| HMO claims cycle | staff | insured patient billed | create claim → lines → submit → remittance → payer-AR | Backend complete; FE create-side absent | GAP-7 (Phase-2) | `revenue-cycle-acceptance.test.ts` |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Invoice creation gates (consent, billable, double-billing) | 422s per BR-009/014 | Implemented | `createDentalInvoice.ts`; `billing-gate-http.test.ts` | V1 REQUIRED | done |
| Issue → notify patient (email on issue) | Patient notified per FR4.1 REQ | Unclear | no email send found in `issueDentalInvoice.ts` | V2 DEFERRED | PRD lists notifications under Phase-2 addendum; do not build now |
| Record payment + idempotency | replay-safe | Implemented | receipt-number idempotency tested | V1 REQUIRED | done |
| Apply discount | owner+reason | Partially Implemented (BE only) | GAP-2 | V1 REQUIRED | UI missing |
| Create plan | 2–24 installments | Partially Implemented (BE only) | GAP-3 | V1 REQUIRED | UI missing |
| Plan Behind/Defaulted automation | auto status flips | Missing (no scheduler) | GAP-1 cause | V1 RECOMMENDED | same engine as overdue |
| Overdue transition | auto by due date | Missing (dead code) | GAP-1 | V1 REQUIRED | |
| Receipt print | printable artifact | Missing (BE ready) | GAP-4 | V1 REQUIRED | |
| Receipt email | emailable artifact | Missing | GAP-4 follow-on | V1 RECOMMENDED | |
| Payment void + watermark | reversal + VOIDED reprint | Missing (BE ready) | GAP-5 | V1 RECOMMENDED | |
| Write-off (uncollectible) | owner-only terminal | Implemented | FSM property tests | V1 REQUIRED | done |
| Claims create→remit | full cycle | Partially Implemented (BE full, FE half) | GAP-7 | V2 DEFERRED | Phase-2 per PRD |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Bill a completed visit | dentist | invoice in 2 taps from workspace | Implemented | No | V1 REQUIRED | J04 E2E |
| Collect full/partial payment | staff_full | record payment, balance updates | Implemented | No | V1 REQUIRED | E2E balance-drop |
| Hand patient an official receipt | staff_full | print receipt at desk | Missing | GAP-4 | V1 REQUIRED | 0 consumers |
| Apply statutory/manual discount | dentist_owner | discount+reason pre-issue | Missing (UI) | GAP-2 | V1 REQUIRED | 0 consumers |
| Set up ₱60k braces installment plan | dentist | create 6×monthly plan | Missing (UI) | GAP-3 | V1 REQUIRED | 0 consumers |
| See who's overdue today | staff | badge/filter from due dates | Missing (automation dead) | GAP-1 | V1 REQUIRED | 0 callers |
| Reverse a mis-keyed payment | dentist_owner | void payment w/ reason | Missing (UI) | GAP-5 | V1 RECOMMENDED | 0 consumers |
| Write off bad debt | dentist_owner | uncollectible | Implemented | No | V1 REQUIRED | FSM tests |
| Month-end collections review | dentist_owner | AR aging + statements | Implemented | No | V1 REQUIRED | `collections-view.tsx` |
| File HMO claim | staff | create→submit→remit | Partially Implemented | GAP-7 | V2 DEFERRED | Phase-2 per PRD |
| Auto PWD/Senior discount detection | system | highest-eligible auto-applied | Missing | §25 Q4 | V2 DEFERRED (manual covers compliance) | no regulatory layer |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| GAP-1 overdue automation dead | lifecycle/job | P1 | V1 REQUIRED | `dental-invoice.repo.ts:271` 0 callers; no scheduler anywhere in api-ts | Staff trust an "overdue" filter/badge that can never populate → silent collections failure; misleading UX is a trust gap | Scheduled caller + RED-first test; scheduler mechanism is `[SHARED DEPENDENCY]` (visit-lock WF-046, plan-Behind share the need) |
| GAP-2 no discount UI | FE affordance | P1 | V1 REQUIRED | 0 consumers of `applyDentalDiscount` | PH statutory PWD/Senior compliance impossible from product; revenue leakage worked around off-books | Owner-only reason-required action in invoice-detail |
| GAP-3 no plan create UI | FE affordance | P1 | V1 REQUIRED | 0 consumers of create/update plan ops | Headline PH market feature (installments) unreachable; partial-payment workflow (BR-011 linkage) incomplete in product | Create-plan affordance on eligible invoices |
| GAP-4 no receipt | FE affordance | P2 | V1 REQUIRED | 0 consumers of `getDentalPaymentReceipt` | Cash-heavy PH practice needs the artifact; BIR/official-receipt expectations | Printable receipt per payment |
| GAP-5 no payment void UI | FE affordance | P2 | V1 RECOMMENDED | 0 consumers of `voidDentalPayment` | Money corrections forced out-of-product | Owner-only void on payments sub-table |
| GAP-6 forgeable recordedByMemberId | security/attribution | P2 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` | `recordDentalPayment.ts:120` | Payment attribution integrity (who-took-the-cash) | Server-derive from session |
| GAP-7 claims half-shipped | scope/phase | P2 | `[NEEDS PRODUCT DECISION]` | 4 ops 0 consumers; live worklist | Misleading surface + carrying cost | Park-or-finish decision |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Due date passes → invoice shows overdue → staff follows up | `overdue` status + red badge + filter hit | Status never transitions; filter forever empty (unless seeded) | GAP-1 | P1 | Backend: issued+past-due → job-run → status=overdue; E2E: overdue filter shows the invoice |
| Staff opens claims worklist → creates claim | Create affordance | Worklist renders; creation impossible from UI; `insurance-claims.spec.ts` limited to status assertions | `claims-worklist.tsx` | P2 (Phase-2) | Decision-dependent |
| Record payment → hand receipt | Receipt prints | No receipt anywhere post-payment | GAP-4 | P2 | FE-unit receipt renders; E2E print view |
| Owner fixes wrong payment | Void in payments table | No affordance; API-only | GAP-5 | P2 | FE-unit void→reason→reversal row |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `applyDentalDiscount` | API, 0 FE consumers | contract-spine + grep | PRD-required affordance missing | Wire (GAP-2) |
| `voidDentalPayment` | API, 0 FE consumers | same | correction path missing | Wire (GAP-5) |
| `getDentalPaymentReceipt` | API, 0 FE consumers | same | receipt missing | Wire (GAP-4) |
| `createDentalPaymentPlan` / `updateDentalPaymentPlan` | API, 0 FE consumers | same | plans unusable | Wire (GAP-3) |
| `getPatientBalance` | API, 0 FE consumers | same | dual-source drift only | Equality pin or consume (GAP-11) |
| `getCollectionsSummary` | API, 0 FE consumers | dashboard uses invoice list instead | redundancy | Wire or document backend-only (GAP-8) |
| `createInsuranceClaim`, `addInsuranceClaimLine`, `updateInsuranceClaimLine`, `getInsuranceClaim` | API, 0 FE consumers | Phase-2 | carrying cost | Park per GAP-7 decision |
| `markOverdueInvoices` | repo method, 0 callers | grep | dead lifecycle | Wire via job (GAP-1) |
| `estimateClaimCoverage` mutation | dead FE hook code | `use-insurance-claims.ts:155-223` | dead bundle code | remove or wire with GAP-7 |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Invoice offline idempotency solid: unique `(branchId, localId)` | schema | `dental-invoice.schema.ts:52-54` | — | none (good) |
| Payment idempotency by `(invoice, receiptNumber, amount)`; no localId — acceptable alternative; cross-invoice reuse → 409 | backend | `recordDentalPayment.ts:82-104` | P3 | Confirm offline payment replay uses receiptNumber deterministically `[NEEDS CONFIRMATION]` with offline-sync group |
| Plan create idempotency covered by replay test | backend | `createDentalPaymentPlan.idempotency.test.ts` | — | none |
| `overdue` reachable only via dead repo method | schema/lifecycle | GAP-1 | P1 | see GAP-1 |
| Seed lacks aged receivables | seed data | prior BIL-G8, unchanged | P3 | GAP-9 |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Role matrix correctly enforced (create/issue=dentists; payment=+staff_full; void/discount/uncollectible=owner-only) | write guards | per-handler `assertBranchRole`; `billing-gate-http.test.ts` 403 pins | — | none (verified) |
| EM-BIL-002 cross-tenant report fix present + pinned (5 endpoints) | tenancy | `getArAging.ts:39-43`; `dental-billing.cross-tenant-reports.test.ts` | — | residual GAP-10 pin |
| `recordedByMemberId` forgeable | attribution | `recordDentalPayment.ts:120` | P2 | GAP-6 (server-derive) |
| Zero-membership caller on reports unpinned | tenancy edge | prior audit §7 | P3 | GAP-10 |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Money mutations audit fail-closed with before/after+reason (payment, payment-void, invoice-void incl. E-NEW-02, discount, uncollectible) | financial audit trail | `voidDentalInvoice.ts:66-78`, `applyDentalDiscount.ts:80`, `audit-write-reliability.test.ts` | — | none (verified strong) |
| Voided payments kept as reversal records (no deletion) | payment history | `voidDentalPayment.ts:32-73` | — | none |
| DE-008 fires only on full-paid incl. partial negative pin | event integrity | `dental-billing-events.test.ts` | — | none |

## 16. Knowledge Graph Findings

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| 16/26 billing ops have FE consumers; the 10 orphans are exactly the §12 list | contract-spine.json (2026-06-10), grep-verified | Confirms gap class is FE-affordance, not backend | Drives GAP-2..5,7,8,11 |
| Prior-KG phantom `/dental/billing/ar/aging` route note no longer relevant (real route `collections/aging` wired) | spine + `use-collections.ts` | KG-backlog item closable | note for KG refresh backlog |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Billing domain = PH cash-first practice: receipts, statutory discounts, installments are the trust trio | PRD personas + §6.4; domain-graph billing domain | The three P1/P2 affordance gaps (GAP-2/3/4) hit exactly the PH-market core | Prioritize in fix batch 1 |
| Overdue-driven follow-up (J44) is a staff daily ritual | PRD §5.4 needs-follow-up filter | GAP-1 silently breaks the ritual | P1 |

## 18. Webwright / Playwright Findings

Not used this round — static evidence (contract-spine + grep + source) conclusively proves affordance absence and dead code; the prior live drive (≤2 days old, in `docs/audits/module-gap-plans/`) already captured runtime behavior of the wired surfaces. No new evidence files saved under `docs/aha/evidence/`.

## 19. Existing Tests Found

(Condensed — 25 backend files ≈299 assertions, 16 FE files, 2 hurl suites, 5 E2E specs.)

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `dental-billing.test.ts` | backend | invoice lifecycle, payments, discount bounds, RBAC | High |
| `dental-billing.cross-tenant-reports.test.ts` | backend/security | EM-BIL-002 2-org scoping ×5 endpoints | High |
| `invoice.fsm.property.test.ts` / `claim.fsm.property.test.ts` / `payment-plan.fsm.property.test.ts` | property | FSM illegal-transition rejection | High |
| `audit-write-reliability.test.ts` | backend | fail-closed audit on void paths (RED-before proven) | High |
| `dental-billing-events.test.ts` | backend | DE-007/8/9 incl. partial negative | High |
| `acceptance.billing-payments.test.ts` + `billing-gate-http.test.ts` | acceptance/auth | AC-PAY-01..05, BR-009/014 gates, 403s | High |
| `revenue-cycle-acceptance.test.ts` + `dental-revenue-cycle.hurl` | backend+contract | full claims cycle | High (backend-only reach) |
| `dental-billing.hurl` (40 req) | contract | live-server lifecycle incl. discount, plan, uncollectible | High |
| FE: `invoice-detail.*.test.ts` (5 files), `billing-list.*`, `collections-view`, `payment-plan-view`, `claims-worklist`, hooks | frontend | wired surfaces incl. coherence oracle | Medium-High |
| E2E: `billing.spec.ts`, `clinical-billing-handoff`, `billing-queue-morgan`, `journeys/04-revenue-chain` | E2E | golden billing chain | High |
| E2E: `insurance-claims.spec.ts` | E2E | worklist only (create unreachable) | Low |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Overdue job: issued+past-due → run → `overdue`; paid invoice no-op | backend/unit + integration | Proves GAP-1 fix; pins idempotency | Before (RED) |
| E2E: overdue filter populates after job | E2E/Playwright | End-user trust proof | During |
| Discount UI: owner sees action, reason required, non-owner hidden; totals update | frontend/component | GAP-2 RED-first | Before |
| Plan create UI: 2–24 bounds surfaced, installments render after create | frontend/component (+E2E) | GAP-3 RED-first | Before |
| Receipt: renders payment/invoice/branch fields; print view | frontend/component | GAP-4 RED-first | Before |
| Payment void UI: owner-only, reason, reversal row visible | frontend/component | GAP-5 RED-first | Before |
| `recordedByMemberId` server-derivation: forged foreign memberId → 403/ignored | backend/permission | GAP-6 RED-first | Before |
| Zero-membership caller → empty report (×5 endpoints) | backend/permission | GAP-10 | Anytime (independent) |
| Balance equality: Σ`invoice.balanceCents` == `getPatientBalance` | integration | GAP-11 drift pin | Anytime |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| Job/scheduler mechanism (none exists in api-ts) | shared/platform `[SHARED DEPENDENCY]` | GAP-1 grep | Overdue (billing), plan-Behind (billing), visit-lock WF-046 (dental-visit), retention cron (governance, env-gated) all need one | Smallest viable: boot-time interval runner in api-ts core; document; do NOT build a job framework `[DO NOT OVERBUILD]` |
| `patients.hasActivePaymentPlan` flag sync | cross-module `[CROSS-MODULE RISK]` | `patient.repo.ts:140` guard relies on billing keeping flag true/false | EC1 archive-guard correctness | Verify flag set/cleared on plan create/complete/default in fix round (1 integration pin) |
| Org-context memberId (FE) for GAP-6 | cross-module | `invoice-detail.tsx:70` sources from org store | server-derivation changes FE contract slightly | Coordinate TypeSpec change (optional→server-derived) |
| Discount/receipt/plan UIs touch only billing FE + existing SDK | module-local | §12 | low blast radius | proceed per batch |
| Claims decision | product decision `[NEEDS PRODUCT DECISION]` | GAP-7 | blocks claims-related items | escalate; do not fix until decided |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Boot-interval overdue runner calling `markOverdueInvoices` (+ optional plan-Behind sweep) | GAP-1 | P1 | V1 REQUIRED | backend RED caller test + E2E filter | `[SHARED DEPENDENCY]` smallest mechanism wins |
| Discount action (owner-only, reason dialog) in invoice-detail footer | GAP-2 | P1 | V1 REQUIRED | FE-unit + E2E 10% discount | backend untouched |
| Create-payment-plan dialog on issued/partial invoices | GAP-3 | P1 | V1 REQUIRED | FE-unit bounds + E2E | backend untouched |
| Receipt printable view per payment row | GAP-4 | P2 | V1 REQUIRED | FE-unit render + print stylesheet check | |
| Payment void (owner-only) in payments sub-table | GAP-5 | P2 | V1 RECOMMENDED | FE-unit + reversal-row assertion | |
| Server-derive `recordedByMemberId` from session membership | GAP-6 | P2 | V1 RECOMMENDED | backend forged-id test | TypeSpec field optional→ignored/derived; needs decision ratification |
| Zero-membership report pin ×5 | GAP-10 | P3 | V1 RECOMMENDED | backend | quick |
| Balance equality pin | GAP-11 | P3 | V1 RECOMMENDED | integration | quick |
| Seed aged receivables | GAP-9 | P3 | V1 RECOMMENDED | seed-coherence assert | demo value |
| Wire or document `getCollectionsSummary` | GAP-8 | P3 | V1 RECOMMENDED | FE-unit if wired | low |
| Claims park-or-finish + honest worklist labeling | GAP-7 | P2 | `[NEEDS PRODUCT DECISION]` | decision-dependent | do not start unprompted |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Automatic PWD/Senior discount engine + regulatory layer (FR11.2) | V2 DEFERRED `[NEEDS PRODUCT DECISION]` | Manual discount (GAP-2) satisfies compliance need now; auto-detection needs the unbuilt locale regulatory layer |
| Claims create/lines/detail FE completion | V2 DEFERRED (unless GAP-7 decision says finish) | PRD §2.5 places claims in Phase 2 |
| Per-country tax calculation | V2 DEFERRED | BR-010/ADR-008 explicitly stub tax at 0% behind flag |
| Invoice-issued / overdue patient notifications (email/push) | V2 DEFERRED | PRD Phase-2 addendum lists billing notifications |
| Payment-plan interest, automated plan reminders, multi-visit statements, aging-bucket expansion | V2 DEFERRED | PRD §6.4 addendum Phase-2 list |
| Device-prefix offline receipt numbering | V2 DEFERRED `[NEEDS CONFIRMATION]` | No offline payment recording exists yet; revisit with offline-sync group |
| Stripe Connect path for dental flows | DO NOT ADD | Base `billing` module superseded by dental-billing for dental flows (MODULE_MAP) |
| A general-purpose job-queue framework for GAP-1 | DO NOT ADD `[DO NOT OVERBUILD]` | One interval runner suffices for current needs |

## 24. Audit Decision

**PARTIAL PASS.**

The money core is genuinely strong: the invoice→payment chain is implemented, FSM-guarded, owner-gated, fail-closed-audited, idempotent, cross-tenant-scoped, and proven by ~299 backend assertions + 59 GREEN contract requests + a passing end-to-end revenue-chain journey. No security hole found this round.

It is not a PASS because four PRD-required V1 capabilities are not deliverable from the product: overdue tracking can never trigger (dead automation, GAP-1), and discounts (GAP-2), installment plans (GAP-3), and receipts (GAP-4) have complete tested backends but no UI. These block reliable V1 use for the PH-market core, hence P1/P2 — but nothing is data-unsafe, so not a FAIL.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Q1: Claims (GAP-7) — park the half-built FE behind an honest Phase-2 label, or finish create/lines/detail now? | `[NEEDS PRODUCT DECISION]` | Determines whether 4 orphan ops + worklist get wired or relabeled | Product |
| Q2: Ratify server-derivation of `recordedByMemberId` (pending since 2026-06-08 audit)? | `[NEEDS PRODUCT DECISION]` | GAP-6 fix shape (derive vs validate) | Product/Eng |
| Q3: Overpayment — PRD FR4.2 says credit balance; implementation + BR tests say 422 reject. Which is canonical? | `[NEEDS PRODUCT DECISION]` | PRD↔BR conflict; current reject is safer; PRD likely stale here | Product (then doc fix) |
| Q4: Are automatic PWD/Senior discounts required for PH launch, or is manual discount sufficient for V1? | `[NEEDS PRODUCT DECISION]` | Bounds GAP-2 scope; auto needs regulatory layer | Product |
| Q5: Scheduler mechanism for GAP-1 — in-process interval vs adopting pg-boss (audit-logger comment implies a pg-boss consumer exists somewhere)? | `[NEEDS CONFIRMATION]` | Shared-dependency choice affects visit-lock + retention too | Eng |
| Q6: Receipt email delivery in V1 or print-only first? | `[NEEDS PRODUCT DECISION]` | GAP-4 scope | Product |

## 26. Notes for Gap Plan Organizer

- **Truly V1 (active fix candidates, decision-free):** GAP-1 (overdue runner — note `[SHARED DEPENDENCY]` on scheduler choice Q5, but a minimal in-module interval is defensible), GAP-2 (discount UI), GAP-3 (plan create UI), GAP-4 (receipt), GAP-5 (payment void UI), GAP-10/GAP-11 (cheap pins), GAP-9 (seed).
- **Likely batch shape:** Batch A = GAP-1 + its tests (backend, isolated); Batch B = invoice-detail affordances GAP-2+GAP-5 (same component+pattern); Batch C = GAP-3 plan create; Batch D = GAP-4 receipt; Batch E = pins/seed (GAP-9/10/11, anytime). Tests first in every batch; all FE work is wiring to already-tested backends — backend changes should be ~zero outside GAP-1 and GAP-6.
- **Blocked until decided:** GAP-7 (claims, Q1), GAP-6 (Q2), auto-discounts (Q4), overpayment doc reconcile (Q3), receipt email (Q6).
- **Must NOT implement:** §23 list — especially no job framework, no claims expansion, no tax engine.
- **Tests to write first:** overdue-job RED caller test; FE-unit RED per affordance (action visible/role-gated/reason-required); forged-memberId 403 (if Q2 ratified); zero-membership report pin.
- **Cross-module touchpoints to watch:** `patients.hasActivePaymentPlan` flag sync pin (1 integration test); org-context memberId if GAP-6 lands; scheduler shared with dental-visit lock + governance retention.
- **Do not re-litigate:** EM-BIL-002, fail-closed audit, FSMs, RBAC matrix, idempotency — all verified GREEN this round with source+test evidence.

---

Next recommended step:
Module/group: Dental Billing
Module slug: dental-billing
Primary PRD/spec: docs/prd/v3-dentalemon.md §6.4 + docs/product/modules/dental-billing/
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/dental-billing-gap-plan.md
