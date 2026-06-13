# Module Audit — dental-billing

**Date:** 2026-06-08
**Branch:** feat/module-workflow-alignment
**Auditor:** per-module deep audit + safe-gap closure (adversarial; verified against source)
**Verdict:** ✅ **READY (with one real security fix landed)** — the dental-billing money module (≈40 ops across InvoiceManagement / RevenueCycle (HMO claims) / BillingExtras) is fully implemented, money-integrity-sound, FSM-guarded, and audited. **The branchId-auth-boundary carry-forward check found a REAL cross-tenant financial-data hole and it was fixed TDD this round.** Five report/list endpoints (`getArAging`, `getCollectionsSummary`, `getPayerArAging`, `listInsuranceClaims`, `generateStatementBatch`) treat `branchId` as **optional** and only `assertBranchAccess` *when supplied* — so **omitting `branchId` returned an aggregate over EVERY org's invoices/payments/claims/balances + patient names** (cross-tenant financial-data + PHI leak). This is the stronger "omitted → unscoped" variant of the V-PAT-002 / V-VIS-011 class. RED test proved the leak on all 5; fix scopes the omitted-branch case to the caller's own active branches (`getActiveBranchIdsForPerson` → `inArray`), never the whole DB. Closed 1 security hole (5 endpoints, separate `fix()` commit) + reconciled br-registry (BR-009/010/011/012 enriched, **added BR-014/BR-015/EM-BIL-002**) and 3 doc-drift items (MODULE_SPEC §8 FSM + §10 routes; API_CONTRACTS payment-plan frequency enum). Gates green.

---

## STEP 0 — Artifacts & /module-review

| Artifact | Location | Status |
|----------|----------|--------|
| Handler dir | `services/api-ts/src/handlers/dental-billing/` | ✅ ~40 impl handlers across invoice lifecycle (create/get/list/issue/void/uncollectible), payments (record/list/void/receipt), discount, payment-plan (create/get/update), reports (patient-balance/collections-summary/ar-aging/statement-batch), revenue-cycle HMO claims (create/list/get/status/lines/remittance/estimate/payer-aging); `repos/` (invoice, payment, payment-plan, insurance-claim, payer-payment + 3 facades) + `utils/` (rounding, aging, coverage-estimate) |
| TypeSpec | `specs/api/src/modules/dental-billing.tsp` | ✅ present — `InvoiceManagement`, `BillingExtras`, `RevenueCycle` interfaces under `DentalBillingModule` |
| MODULE_SPEC / API_CONTRACTS | `docs/product/modules/dental-billing/` | ✅ present (carried §8 FSM `void`/missing-uncollectible drift + §10 stale routes + API_CONTRACTS `fortnightly` frequency drift — all reconciled this round) |
| Tests | 22 `*.test.ts` (299 assertions) | ✅ present — main (`dental-billing.test.ts`, 84), invoice-lifecycle (23), edge-cases (28), payment-plan-fsm (11), invoice/claim/payment-plan FSM property tests, AR-aging+statements, events, insurance-claim, payer-payment, acceptance, billing-gate-http, repos + utils |
| Routes | `generated/openapi/{registry,routes}.ts` | ✅ all wired (incl. `listDentalPayments`, `markUncollectible`, all 9 revenue-cycle ops); confirmed by `revenue-cycle-route-registration.test.ts` |
| Contract | `dental-billing.hurl` (40 req) + `dental-revenue-cycle.hurl` (19 req) | ✅ both green against fresh `:7213` |

**Relationship to the generic `billing/` module:** `services/api-ts/src/handlers/billing/` is the **frozen upstream-template Stripe-Connect primitive** (customer/merchant/invoice with `createMerchantAccount`, `onboardMerchantAccount`, `handleStripeWebhook`, `captureInvoicePayment`, `refundInvoicePayment`). The **dental vertical does not consume it** — `dental-billing` has **zero Stripe imports**; dental payments are cash/card/bank recorded manually. The two are independent; this audit scopes to `dental-billing`. The upstream `billing/` Stripe webhook + merchant flows are out of scope (and are the source of the known `billing-lifecycle.hurl` env failure).

**/module-review result:** **PASS** — no `test.skip`/`xit`/`.only`; no `Not implemented` stub; no TODO/FIXME/HACK in handler code; no non-test `as any`. TypeSpec ops ↔ handler names match. Audit logging present on every money write (`invoice.create`, `payment.record`, `invoice.paid` DE-008, `discount.applied`, `invoice.voided`, `payment.void`, `invoice.uncollectible`, claim transitions, remittance) — and crucially logs `personId: session.userId` as the **true actor** regardless of the client-supplied `recordedByMemberId` display field.

---

## STEP 3 — KG mapping (query-only)

`.understand-anything/domain-graph.json` (regenerated 2026-06-08) models `domain:billing-payments`
(entities Invoice/InvoiceLine/Payment/InsuranceClaim/ClaimLine/RemittanceRecord/ARStatement) plus
`flow:invoice-and-collect`, `flow:claims-remittance`, `flow:ar-collections`. The domain node is broadly
ACCURATE (it correctly captures "invoices require performed treatments", "voided/uncollectible excluded
from patient balance", "AR aging buckets current/30/60/90+", and even the prior-memory
`PaymentSummaryBar derives total from billable treatments, not pending count` FE invariant).

**KG-projection drift (query-only, flag for next regeneration — do NOT hand-edit):**
1. **Phantom route.** `flow:ar-collections` cites entryPoint **`GET /dental/billing/ar/aging`** — the real
   route is **`GET /dental/billing/collections/aging`** (TypeSpec `/collections/aging`).
2. **KG-backlog (lossy → NONE).** The graph does NOT model the **EM-BIL-002 omitted-branchId scoping**
   invariant, the invoice FSM `uncollectible` write-off edge, the receipt-number / remittance-reference
   idempotency keys, or the `staff_full record-payments-only` permission split as distinct nodes. The new
   cross-tenant fix is not represented. Note on next regeneration.

---

## STEP 6 — Traceability Matrix

| Item | Spec? | Impl? | KG | Test (file) | Strength | Verdict |
|------|-------|-------|----|-------------|----------|---------|
| **BR-009 / AC-BIL-001** invoice requires ≥1 performed/verified treatment; 0 → 422 NO_BILLABLE_TREATMENTS; already-billed → 422 TREATMENT_ALREADY_BILLED | ✅ | ✅ createDentalInvoice:46-60 | flow | billing-gate-http.test.ts; dental-billing.test.ts | VERIFIED | 🟢 |
| **BR-010 / AC-BIL-004** taxCents always 0; taxRate server-controlled (EM-BILL-001, not caller-supplied) | ✅ | ✅ createDentalInvoice:69-74 | partial | dental-billing.test.ts (taxCents==0) | VERIFIED | 🟢 |
| **BR-014 / V-BIL-007** signed consent required before invoicing → 422 CONSENT_REQUIRED | ✅ | ✅ createDentalInvoice:36-41 | NONE | billing-gate-http.test.ts; dental-billing.test.ts | VERIFIED | 🟢 |
| **Money math** subtotal = Σ line items; discount = round(subtotal×rate); discount-on-discount uses original subtotal not stacked | ✅ | ✅ createDentalInvoice:63; applyDiscountRate | NONE | dental-billing.test.ts:1334-1339 (20% not 30%); utils/rounding.test.ts (15) | VERIFIED | 🟢 |
| **BR-015 / V-BIL-001** discount rate 0–100 → else 422 INVALID_DISCOUNT_RATE (negative-total guard) | ✅ | ✅ applyDentalDiscount:50-60 | NONE | dental-billing.test.ts (bounds) | VERIFIED | 🟢 |
| **BR-015 / V-BIL-002** installment count 2–24 → else 422 INVALID_INSTALLMENT_COUNT (÷0 guard) | ✅ | ✅ createDentalPaymentPlan | NONE | dental-billing.payment-plan-fsm.test.ts | VERIFIED | 🟢 |
| **BR-015 / V-BIL-010** payment amountCents ≥ 1 → else 422 INVALID_AMOUNT | ✅ | ✅ recordDentalPayment:38-40 | NONE | dental-billing.test.ts | VERIFIED | 🟢 |
| **BR-012 / V-BIL-004** overpayment → 422 PAYMENT_EXCEEDS_BALANCE | ✅ | ✅ recordDentalPayment:63-68 | partial | dental-billing.test.ts; dental-billing.edge-cases.test.ts | VERIFIED | 🟢 |
| **BR-012 / V-BIL-005** payment on paid/voided → 422 INVOICE_IMMUTABLE; on draft → 422 INVALID_STATUS_TRANSITION | ✅ | ✅ recordDentalPayment:44-60 | partial | dental-billing.test.ts; invoice.fsm.property.test.ts | VERIFIED | 🟢 |
| **DE-008 InvoicePaid (V-BIL-011)** fires ONLY on transition to fully `paid`, not partials (audit-log marker) | ✅ | ✅ recordDentalPayment:147-157 | NONE | dental-billing-events.test.ts | VERIFIED | 🟢 |
| **Payment idempotency (N-BIL-01)** receiptNumber scoped per-invoice: same invoice+receipt+amount → 200 replay; diff amount → 409; cross-invoice reuse → 409 (no echo of another invoice's payment) | ✅ | ✅ recordDentalPayment:82-104 | NONE | dental-billing.test.ts | VERIFIED | 🟢 |
| **BR-011 / AC-BIL-002** active payment plan blocks void → 409 ACTIVE_PAYMENT_PLAN | ✅ | ✅ voidDentalInvoice:49-50 | NONE | dental-billing.test.ts; invoice-lifecycle.test.ts | VERIFIED | 🟢 |
| **Void FSM** already-voided → 422 ALREADY_VOIDED; void allowed from any non-voided incl. paid (admin correction) | ✅ | ✅ voidDentalInvoice:37-50 | partial | invoice.fsm.property.test.ts (7) | VERIFIED | 🟢 |
| **BR-013 / AC-BIL-005** markUncollectible: issued/partial/overdue → uncollectible (terminal); draft/paid/voided → 422; owner-only | ✅ | ✅ markUncollectible | NONE | invoice.fsm.property.test.ts; dental-billing.test.ts | VERIFIED | 🟢 |
| **RBAC V-BIL-003** create-invoice/issue/plan = dentist_owner+associate (staff_full DENIED); record-payment = +staff_full; void/discount/uncollectible = owner-only | ✅ | ✅ assertBranchRole in each | NONE | dental-billing.test.ts; billing-gate-http.test.ts (403 staff_full create) | VERIFIED | 🟢 |
| **Claim FSM (P1-26)** invoice-anchored HMO claim status transitions FSM-validated; illegal → 4xx | ✅ | ✅ updateInsuranceClaimStatus | flow | claim.fsm.property.test.ts (10); dental-insurance-claim.test.ts (13) | VERIFIED | 🟢 |
| **Remittance idempotency** post on (claim, remittanceReference): replay → 200; diff amount → 409 | ✅ | ✅ recordClaimRemittance:70-78 | NONE | dental-payer-payment.test.ts | VERIFIED | 🟢 |
| **Cross-branch RBAC (with branchId)** report with branchId the caller doesn't belong to → 403 | ✅ | ✅ assertBranchAccess | — | dental-billing.ar-aging-statements.test.ts:125,157 (403) | VERIFIED | 🟢 |
| **EM-BIL-002 cross-tenant report scoping (omitted branchId)** the 5 optional-branch reports must scope to caller's own branches when branchId omitted, NOT the whole multi-tenant DB | implied | ✅ **FIXED** getActiveBranchIdsForPerson → inArray on all 5 | NONE | **dental-billing.cross-tenant-reports.test.ts (NEW: ORG_A caller omitting branchId excludes ORG_B claims/invoices/payments/balances on all 5 endpoints)** | VERIFIED (after fix) | 🟢 |
| **List shape** invoices/payments `{ data, pagination }`; listDentalInvoices requires branchId → 400 (EM-BIL-001) | ✅ | ✅ listDentalInvoices:32-34 | NONE | dental-billing.test.ts | VERIFIED | 🟢 |

---

## STEP 5 — branchId-auth-boundary check (carry-forward) — **HOLE FOUND + FIXED**

**Result: REAL cross-tenant financial-data + PHI hole, fixed TDD this round.**

The **mutating** handlers are all SAFE: `createDentalInvoice`, `recordDentalPayment`, `applyDentalDiscount`,
`voidDentalInvoice`, `voidDentalPayment`, `markUncollectible`, and the claim writers all derive branch from
the **resource** (`invoice.branchId` / `claim.branchId`, fetched first) and then `assertBranchRole`/`assertBranchAccess`.
`getPatientBalance` derives from `patient.preferredBranchId`. `listDentalInvoices` **requires** `branchId` (400
otherwise) and asserts membership. None of these trust a caller-supplied branch untied to the resource.

**But five REPORT/LIST endpoints take `branchId` as an OPTIONAL filter and only authorize WHEN it is supplied:**
`getArAging`, `getCollectionsSummary`, `getPayerArAging`, `listInsuranceClaims`, `generateStatementBatch`.
When `branchId` was **omitted**, the underlying query/facade/repo applied **no branch condition at all** →
it scanned the entire `dental_invoices` / `dental_payments` / `dental_insurance_claims` table **across every
organization in the database**. A `dentist_owner` of clinic A, by simply calling
`GET /dental/billing/collections/aging` (no query string), received clinic B's outstanding balances, patient
names, collected totals, and submitted insurance claims. This is **financial-data + PHI cross-tenant exposure**
— the stronger "omitted → unscoped" variant of the V-PAT-002 / V-VIS-011 caller-supplied-branchId class.

**Fix (TDD; separate `fix()` commit):**
1. RED — `dental-billing.cross-tenant-reports.test.ts` seeds two independent orgs (ORG_A with the caller as a
   member, ORG_B foreign). All 5 endpoints called WITHOUT `branchId` returned ORG_B's data → 5 failing pins.
2. GREEN — added `getActiveBranchIdsForPerson(db, personId)` to `org-billing.facade.ts` (the existing
   billing→org bridge); each of the 5 handlers now, when `branchId` is omitted, scopes results to the caller's
   own active branch ids via `inArray(...)` (empty set → `sql\`false\`` → zero rows, never the whole DB). When
   `branchId` IS supplied the existing `assertBranchAccess` path is unchanged. Threaded `allowedBranchIds`
   through `billing-report.facade` (aging + statements) and `DentalInsuranceClaimRepository.findMany`; the two
   inline-query handlers (`getArAging` via facade, `getCollectionsSummary` inline) push an `inArray` branch
   condition. All 5 RED pins now GREEN; the prior single-org tests (omitted-branch now scopes to that one branch)
   still pass (299/0).

---

## STEP 7 — Gaps Closed This Round

### REAL security hole closed (TDD; separate `fix()` commit)

| # | Gap | Class | Fix |
|---|-----|-------|-----|
| 1 | **Cross-tenant financial-data + PHI leak via omitted `branchId` on 5 report endpoints** (AR aging, collections summary, payer aging, claim worklist, statement batch). Omitting the optional `branchId` returned an aggregate over EVERY org's invoices/payments/claims/balances + patient names. | REAL security (cross-tenant money+PHI) | `getActiveBranchIdsForPerson` facade + `allowedBranchIds` scoping in all 5 handlers/facades/repo; `inArray` to caller's branches when branchId omitted (empty → zero rows). RED→GREEN in `dental-billing.cross-tenant-reports.test.ts` (5 cases). |

### Doc / registry drift reconciled (docs commit)

| # | Drift | Fix |
|---|-------|-----|
| 2 | **br-registry dental-billing block thin / stale.** BR-010 source cited a "TODO comment" that no longer exists (tax is hardcoded with the EM-BILL-001 server-control guard); BR-012 prose used the retired `sent` state (canonical `issued`, V-BIL-015); BR-009/011/012 lacked test citations; **BR-014 (consent gate) and BR-015 (discount/installment/amount bounds) were entirely absent** despite being in MODULE_SPEC §5 and implemented+tested. | Enriched BR-009/010/011/012 (real source + test citations; `sent`→`issued`); **added BR-014, BR-015, and EM-BIL-002** (the cross-tenant fix) with source/test citations. JSON re-validated. |
| 3 | **MODULE_SPEC §8 FSM diagram used `void` (enum value is `voided`) and omitted the BR-013 `uncollectible` write-off transitions + the payment-validity-per-state note.** | Rewrote §8 with canonical `voided`, the `issued/partial/overdue → uncollectible` edge, and the draft/paid/voided payment-rejection note. |
| 4 | **MODULE_SPEC §10 listed stale/non-existent routes** (`/payment-plans`, a non-existent `GET /dental/patients/:id/statement`) and omitted the `/dental/billing` prefix, the uncollectible/receipt/discount/plan/claims routes, and the EM-BIL-002 optional-branch note. | Replaced §10 with the canonical route set (all under `/dental/billing`), grouped by lifecycle/payments/discount-plan/reports/revenue-cycle, with the EM-BIL-002 scoping note. |
| 5 | **API_CONTRACTS payment-plan body drift.** Listed `frequency` enum `weekly/fortnightly/monthly` (real enum is `weekly/biweekly/monthly`) and phantom `installment_count`/`first_payment_date`/`deposit_cents` fields vs the real `CreateDentalPaymentPlanRequest` (`numberOfInstallments`/`frequency`/`startDate`) at the wrong route (`/payment-plans` vs `/plan`). | Corrected to the real body + `biweekly` enum + canonical `/plan` route (V-BIL-016 note). |

---

## Ranked Remaining Gaps (surfaced, NOT closed — out of safe scope)

**Product decisions (not unilaterally changed):**
1. **`recordedByMemberId` is client-supplied, not server-derived, and only FK-constrained.** The dental
   payment body accepts an arbitrary `recordedByMemberId` validated only by the FK to `dental_memberships.id`
   — it is NOT checked to belong to the caller or the invoice's branch. This is **not** a cross-tenant data
   leak (the payment still lands on the correct invoice/branch, and `assertBranchRole` already gates the
   *caller*), and the **true actor is captured truthfully** in the audit log (`personId: session.userId`).
   But the *display attribution* is forgeable (front-desk could attribute a payment to a dentist, or to a
   member of another branch). The accepted contract semantics deliberately allow recording on behalf of
   another member, so this is a **product decision** — surface only. If tightening is desired: validate
   `recordedByMemberId` is an active member of `invoice.branchId` (TDD). (This is the server-side residue of
   the prior `recordedByMemberId:''` FE bug, which was fixed FE-side.)
2. **`getCollectionsSummary` / `getArAging` accept free-form `from`/`to`/`asOf` date strings** with no upper
   bound on range — a very wide window scans large invoice sets. Performance-only (MODULE_SPEC §16 targets);
   no correctness issue. Surface.

**REAL test gaps (impl present, assertion not added this round):**
3. **Empty-membership caller pin.** The EM-BIL-002 fix returns zero rows for a caller with NO active branch
   membership (the `sql\`false\`` path), but the new test only seeds a single-branch caller. A pin for a
   membership-less authenticated user (→ empty report, not 500) would harden the edge.
4. **DE-008 partial-vs-full pin breadth.** `dental-billing-events.test.ts` covers the fully-paid `invoice.paid`
   row; a negative pin asserting NO `invoice.paid` row on a *partial* payment would tighten V-BIL-011.

**KG-backlog:** EM-BIL-002 omitted-branchId scoping, the invoice `uncollectible` edge, the receipt/remittance
idempotency keys, and the `staff_full record-payments-only` split are not modeled as distinct nodes; the
`flow:ar-collections` entryPoint cites the phantom `GET /dental/billing/ar/aging` (real: `/collections/aging`).
Fix on next KG regeneration.

---

## STEP 8 — Gate

| Gate | Result |
|------|--------|
| `cd services/api-ts && bunx tsc --noEmit` | ✅ 0 errors |
| dental-billing module suite (`test-with-db.ts`, 22 files) | ✅ **299 pass / 0 fail** (294 baseline + 5 new cross-tenant cases) |
| `eslint` (changed handlers/facades/repo/test) | ✅ 0 errors (removed a pre-existing unused-import warning in `getCollectionsSummary`) |
| `check:boundaries:dental-billing` | ✅ no cross-module repo violations (billing→org-billing.facade is the allowed bridge) |
| br-registry.json | ✅ valid JSON |
| Contract suite (fresh `:7213`, restarted) | ✅ **`dental-billing.hurl` Success (40 req)** + **`dental-revenue-cycle.hurl` Success (19 req)**. The 3 failures are **pre-existing environmental, outside this module**: `billing-lifecycle.hurl` (the upstream **Stripe** merchant-accounts flow — dental-billing uses NO Stripe), `auth-verification` + `auth-password-reset` (mailpit down) — identical to the prior eight rounds. |

---

## Files Changed

**`fix()` commit (behavioral security fix):**
- `services/api-ts/src/handlers/dental-org/repos/org-billing.facade.ts` — **NEW** `getActiveBranchIdsForPerson`
- `services/api-ts/src/handlers/dental-billing/repos/billing-report.facade.ts` — `allowedBranchIds` scoping on `getOutstandingInvoicesForAging` + `getStatementInvoices`
- `services/api-ts/src/handlers/dental-billing/repos/dental-insurance-claim.repo.ts` — `allowedBranchIds` on `ClaimFilters` + `findMany`
- `services/api-ts/src/handlers/dental-billing/{getArAging,getCollectionsSummary,getPayerArAging,listInsuranceClaims,generateStatementBatch}.ts` — omitted-branchId now scopes to caller's active branches
- `services/api-ts/src/handlers/dental-billing/dental-billing.cross-tenant-reports.test.ts` — **NEW** 5 RED→GREEN cross-tenant pins

**docs commit:**
- `specs/api/docs/standards/br-registry.json` — dental-billing block enriched + BR-014/BR-015/EM-BIL-002 added
- `docs/product/modules/dental-billing/MODULE_SPEC.md` — §8 FSM (voided/uncollectible) + §10 canonical routes
- `docs/product/modules/dental-billing/API_CONTRACTS.md` — payment-plan body + `biweekly` enum + `/plan` route
- `docs/audits/modules/MODULE_dental-billing_AUDIT_2026-06-08.md` — this report
- `docs/audits/MODULE_AUDIT_TRACKER.md` — row 9 verdict + branchId carry-forward update (HOLE found+fixed)
