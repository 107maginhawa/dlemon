# AHA Module/Group Fix Report: Dental Billing

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Dental Billing |
| Module slug | dental-billing |
| Raw gap plan used | `docs/aha/module-gap-plans/dental-billing-gap-plan.md` |
| Fix-ready plan used | `docs/aha/module-fix-plans/dental-billing-fix-ready-plan.md` |
| Output fix report | `docs/aha/module-fix-plans/dental-billing-fix-report.md` |
| Fix date | 2026-06-11 |
| Batch executed | Batch A — overdue/plan status sweep cron (FIX-001 + FIX-002) |
| Superpowers used | Yes (TDD + verification-before-completion) |
| Working tree status checked | Yes — clean before Batch A (prior dental-org commits landed) |
| Fix scope | P1 (FIX-001) + V1 RECOMMENDED severable (FIX-002) |
| Out of scope | Batches B/C/D/E; claims; recordedByMemberId; receipt email; auto-discounts; any new scheduler |
| Shared files touched | Yes — one additive registration line in `services/api-ts/src/app.ts` |
| Schema/migration touched | No (`overdue` + plan-status enums already exist) |
| Code commit | `b45a3616` |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope | Reason | Status |
| --- | --- | --- | --- | --- | --- |
| FIX-001 | GAP-1: `markOverdueInvoices` has 0 production callers — "overdue" filter/badges never fire | P1 | V1 REQUIRED | The only P1; product silently lies (a filter that can never populate); smallest backend-isolated TDD slice | Fixed |
| FIX-002 | GAP-1 shared cause: plan-"Behind" auto-status (7+ days past due) never flips (FR4.3) | P2 | V1 RECOMMENDED (severable) | Included — semantics were already confirmed by the tested per-plan `updatePlanStatus`; only a thin sweep wrapper was missing (no balloon) | Fixed |

## 3. Baseline Before Changes

| Check/Test | Result Before | Related Fix | Notes |
| --- | --- | --- | --- |
| `markOverdueInvoices` callers | 0 (repo grep) | FIX-001 | Repo logic + idempotency already tested in `dental-billing.invoice-lifecycle.test.ts`; no caller existed |
| Plan-"Behind" sweep | none | FIX-002 | Per-plan `updatePlanStatus` tested (7d→behind), but nothing enumerated active plans |
| New `jobs/jobs.test.ts` | RED (module not found) | both | Confirmed failing for the expected reason before implementation |

## 4. Changes Made

| Fix ID | Implemented | Files |
| --- | --- | --- |
| FIX-001 | New `registerDentalBillingJobs` registering a daily `dental-billing.status-sweep` cron on the existing `core/jobs.ts` scheduler; handler calls the existing `markOverdueInvoices` | NEW `services/api-ts/src/handlers/dental-billing/jobs/index.ts`; `services/api-ts/src/app.ts` (import + one registration line) |
| FIX-002 | New `reevaluateActivePlanStatuses()` repo sweep (enumerates on_track/behind plans, calls the tested `updatePlanStatus` per plan, returns changed count); invoked by the same cron handler | `services/api-ts/src/handlers/dental-billing/repos/dental-payment-plan.repo.ts` (+`inArray` import) |

## 5. Tests Added / Updated

| Test File | Type | What It Proves |
| --- | --- | --- |
| `services/api-ts/src/handlers/dental-billing/jobs/jobs.test.ts` (new) | backend/unit + integration | (1) the cron is registered (`dental-billing.status-sweep`, valid 5-field pattern); (2) the registered handler transitions a past-due issued invoice to `overdue`; (3) idempotent second run; (4) flips an active plan with a 7+-day overdue installment to `behind`; (5) leaves a current (not-yet-overdue) plan `on_track` |

No new FE work in this batch (the plan's "overdue filter populates" E2E is deferred — it depends on the FIX-011 aged-receivable seed in Batch D and a cron-trigger hook; see §9).

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `scripts/test-with-db.ts .../jobs/jobs.test.ts` | Passed | 5/0 |
| `scripts/test-with-db.ts .../dental-billing.invoice-lifecycle.test.ts` | Passed | 23/0 (in isolation) |
| `scripts/test-with-db.ts .../repos/dental-payment-plan.test.ts` | Passed | 9/0 (in isolation) |
| `bunx tsc --noEmit` (api-ts) | Passed | clean |
| `bun run check:boundaries:dental-billing` | Passed | no violations |
| Server boot (`bun dev` :7213) | Passed | log: `Scheduled cron job: dental-billing.status-sweep with pattern: 0 2 * * *`; no boot errors |

**Note on the directory run:** `scripts/test-with-db.ts src/handlers/dental-billing/` (whole-dir, one shared clone) reported mass `dental_invoice` insert failures — this is the known postgres-connection-saturation / shared-clone artifact (every affected file passes in its own clone), not a regression. Per-file runs are the trustworthy signal.

## 7. Validation Summary

Batch A validation passed: RED→GREEN integration tests proving the transitions fire from the registered handler (not just the repo in isolation), api-ts typecheck, module boundaries, and a live boot confirming the cron schedules. No FE, contract, or schema surface was touched.

## 8. Shared / Cross-Module / Database Impact

| Area | Files | Blast Radius | Coverage |
| --- | --- | --- | --- |
| Scheduler registration `[SHARED DEPENDENCY]` | `app.ts` (one additive line) | Additive only — scheduler already runs 8 module job sets; job name namespaced `dental-billing.*` | Boot log confirms registration; registration unit test |

No database/schema changes. Job name does not collide with `dental-visit.*` (its sibling lock-cron, when built).

## 9. Remaining Gaps

| Gap | Reason Not Completed | Next Step |
| --- | --- | --- |
| Overdue-filter E2E (FIX-001 "during") | Needs the Batch D FIX-011 aged-receivable seed + a cron-trigger hook; keeping Batch A backend-isolated per plan | Add during Batch D once aged seed exists |
| Batches B (discount/void UI), C (payment-plan create), D (pins+seed), E (shared print utility + receipt) | Not in this pass | Per the execution order, Batch E (shared print utility) runs next for this module |

## 10. Blocked / Deferred / Do-Not-Build (unchanged from plan)

Claims vertical, `recordedByMemberId` derivation, receipt email, auto PWD/Senior discount engine, tax engine, any new scheduler/queue framework — all remain blocked/deferred/do-not-build per §8–§11 of the fix-ready plan. None entered this batch.

## 11. Files Changed

| File | Change | Fix |
| --- | --- | --- |
| `services/api-ts/src/handlers/dental-billing/jobs/index.ts` | New — `registerDentalBillingJobs` daily status-sweep cron | FIX-001/002 |
| `services/api-ts/src/handlers/dental-billing/jobs/jobs.test.ts` | New — registration + handler integration tests | FIX-001/002 |
| `services/api-ts/src/handlers/dental-billing/repos/dental-payment-plan.repo.ts` | New `reevaluateActivePlanStatuses()` + `inArray` import | FIX-002 |
| `services/api-ts/src/app.ts` | Import + `registerDentalBillingJobs(jobs)` registration line | FIX-001 |

## 12. Completion Decision

`COMPLETE` (Batch A) — FIX-001 + FIX-002 fixed RED-first, integration-proven against a real DB, server boot confirmed, all gates green. FIX-002 was included (not deferred) because its semantics were already settled by the tested `updatePlanStatus` and only a thin sweep wrapper was needed.

## 13. Recommended Next Step

Run a `04` pass for **Batch E — shared print/PDF utility + receipt** (`docs/aha/module-fix-plans/dental-billing-fix-ready-plan.md`), the platform batch that must land before dental-patient (statement) and case-presentation (estimate) consume the shared print primitive. Batches B/C/D remain for subsequent passes.

---

# Batch E — Shared Print Primitive + Payment Receipt (appended 2026-06-11)

## E1. Fix Scope

| Item | Details |
| --- | --- |
| Batch executed | Batch E — shared print primitive (FIX-008) + payment receipt (FIX-007) |
| Superpowers used | Yes (TDD + verification-before-completion) + a 4-lens adversarial verification workflow before commit |
| Working tree status checked | Yes — clean before Batch E |
| Fix scope | P2 (FIX-007/008) + a discovered receipt-contract drift fix |
| Shared files touched | Yes — NEW shared print component `src/components/print/`; global print stylesheet rule in `src/styles/globals.css`; TypeSpec `dental-billing.tsp` + regenerated SDK/validators |
| Schema/migration touched | No |
| Code commit | `b5b9e07a` |

## E2. Fixes Selected

| Fix ID | Gap | Severity | Reason | Status |
| --- | --- | --- | --- | --- |
| FIX-008 | No shared print/PDF primitive — three modules would diverge | P2 V1 REQUIRED `[SHARED DEPENDENCY]` | One contract for billing receipt (now) + dental-patient statement + case-presentation estimate (later) | Fixed |
| FIX-007 | `getDentalPaymentReceipt` had 0 FE consumers; no printable receipt (EC5 VOIDED watermark) | P2 V1 REQUIRED | Cash-practice trust artifact; canonical first consumer of the print primitive | Fixed |

## E3. Discovered Drift (fix-ready plan said "backend ready")

The receipt TypeSpec `DentalPaymentReceiptResponse` was a stale FLAT projection `{receiptNumber, amountCents, method, paidAt, invoiceId, patientId}`, but the handler returns — and the FR4.6/EC5 backend tests assert — a rich NESTED shape `{receiptNumber, isVoid, voidedAt, voidReason, payment:{…}, invoice:{…}, patient:{name}, generatedAt}`. The flat contract omits exactly the fields the EC5 VOIDED watermark + an honest receipt need. **Resolution (spec-first-correct, same as the dental-org consent reconcile):** reconciled the TypeSpec to the handler reality, regenerated OpenAPI→validators→SDK, and strengthened the receipt hurl from HTTP-200-only to the nested shape. No non-generated consumer of the old flat type existed (verified) — near-zero blast radius.

## E4. Changes Made

| Fix ID | Implemented | Files |
| --- | --- | --- |
| FIX-008 | `PrintableDocument` (title/layout receipt|a4/onPrint seam/children) over the existing `.no-print`/`.print-receipt`/`.print-a4` conventions; a `:has(.print-document)`-scoped region-isolation print rule | NEW `src/components/print/printable-document.tsx` (+test); `src/styles/globals.css` |
| FIX-007 | `PaymentReceipt` (nested fields + EC5 VOIDED watermark/reason) + `usePaymentReceipt` hook; per-payment-row Receipt action + overlay in invoice-detail | NEW `features/billing/components/payment-receipt.tsx` (+test); NEW `hooks/use-payment-receipt.ts`; `invoice-detail.tsx` |
| Reconcile | TypeSpec receipt nested models + regen; hurl nested-shape pin | `specs/api/src/modules/dental-billing.tsp`; generated `validators.ts` + SDK; `specs/api/tests/contract/dental-billing.hurl` |

## E5. Adversarial Verification (pre-commit)

4-lens workflow over the uncommitted diff:
- **Contract-integrity:** clean — reconcile consistent across handler/TypeSpec/OpenAPI/SDK/transformer/FE/hurl; date handling (string|Date) safe; no leftover flat-shape consumer.
- **Shared-primitive:** **P1 print-isolation defect** found (hide-list vs region-isolate → parent modal backdrop + invoice body bleed onto the receipt page) — **folded in** via the shared-layer `:has(.print-document)` isolation rule (also closes the modal-card-chrome nit). P3 `@page` margin for A4 noted for the future A4 consumer.
- **Fake-green:** **P2 invoice-detail Receipt wiring untested** (the dental-org Batch B lesson) — **folded in** (`invoice-detail.receipt.test.ts` pins clicked-row → right paymentId). P3 method-label/date/URL pins — **folded in**.
- **Scope-discipline:** clean — no PDF lib/dependency, no email, no statement/estimate built, no verified-green area touched; reconcile confirmed justified.

## E6. Tests Run

| Command | Result |
| --- | --- |
| `bun test src/components/print/` | 6/0 |
| `bun test .../payment-receipt.test.tsx` | 6/0 |
| `bun test .../invoice-detail.receipt.test.ts` | 1/0 |
| `bun test src/features/billing/ + print` | 133/0 |
| `bun test src/` (full FE) | 2272/0 |
| FE + api-ts + SDK typecheck | clean |
| `CONTRACT_ONLY=dental-billing` (fresh :7213) | 40 reqs, 100% (receipt nested shape pinned) |

## E7. Shared / Cross-Module Impact

| Area | Blast Radius | Mitigation |
| --- | --- | --- |
| `PrintableDocument` `[SHARED DEPENDENCY]` | dental-patient statement + case-presentation estimate will consume it (layout="a4") | Contract pinned by tests; verified minimal/stable for A4 consumers; `@page` margin noted for the first A4 consumer |
| globals.css print rule | All print output | Scoped via `:has(.print-document)` — only affects PrintableDocument-rendered content; existing prints (prescription/consent/invoice) untouched; degrades safely |
| Receipt TypeSpec reconcile | repo-wide SDK | No non-generated consumer of the old type; both typechecks clean |

## E8. Completion Decision

`COMPLETE` (Batch E) — FIX-007 + FIX-008 fixed RED-first, a real receipt-contract drift reconciled, the P1 print-isolation defect + P2 wiring gap from adversarial review folded in before commit, all gates green.

## E9. Recommended Next Step

Per the execution order, proceed to **dental-pmd Batch A** (P0 generation trigger). dental-billing Batches B (discount/void UI), C (payment-plan create), D (pins+seed) remain for later passes. The shared `PrintableDocument` primitive is now available for dental-patient (statement) and case-presentation (estimate) to consume.

---

# Batch B — Invoice-detail money affordances: discount + payment-void (FIX-003 + FIX-004) · 2026-06-12 · commit `36727bf3`

## B1. Fix Scope

| Item | Details |
| --- | --- |
| Batch executed | Batch B — apply-discount UI (FIX-003) + per-payment void UI (FIX-004) in `invoice-detail.tsx` |
| Superpowers used | Yes (Vertical TDD + verification-before-completion); §15 handler-vs-SDK-vs-contract check run FIRST via a parallel workflow; 3-lens adversarial review before commit |
| Working tree status checked | Yes — clean before Batch B (HEAD `ddf8c6e8`) |
| Fix scope | P1 (FIX-003) + V1 RECOMMENDED (FIX-004) + a §15 contract drift fix |
| Shared files touched | TypeSpec `dental-billing.tsp` (+ regenerated `validators.ts`/SDK `types.gen.ts`, additive optional); `rbac.ts` (additions only) |
| Schema/migration touched | No (`voided_by_member_id` column already existed; the reconcile only added it to the contract) |
| Code commit | `36727bf3` |

## B2. §15 verification — ONE drift (FIX-004), FE_ONLY for the rest (FIX-003)

A 5-front parallel §15 sweep (applyDentalDiscount · voidDentalPayment · payment-plan · flag-sync · FE harness) ran BEFORE any wiring. Findings for Batch B:

- **FIX-003 applyDentalDiscount = FE_ONLY (no drift).** Request `{reason, percentageRate}` and the **full updated `DentalInvoice`** response are already declared end-to-end. The wire takes a **0–100 PERCENTAGE** (`applyDiscountRate(subtotalCents, rate)`), NOT cents and NOT a 0–1 fraction — the lead unit trap, handled by sending the raw value. The response carries the recalculated totals, so the FE re-renders coherently from one round-trip (via invalidate+refetch of the enriched GET — the discount response lacks the lineItems/payments enrichments the sheet renders, so `setQueryData` would break the render; invalidate is both consistent with siblings AND necessary).
- **FIX-004 voidDentalPayment = CONTRACT_FIX (clinical-B-precedent drift).** The repo `voidPayment` uses `.returning()` → the row carries `voided_by_member_id` (`dental-payment.schema.ts:32`, set to the resolved `membership.id`), but the TypeSpec `DentalPayment` model **omitted `voidedByMemberId`** → the SDK type omitted it. Same class as the clinical-B consent `revokedBy` reconcile. **Fixed the CONTRACT** (added `voidedByMemberId?: UUID` to `DentalPayment` + regen; additive optional across `validators.ts`/`types.gen.ts`), not an FE cast. The void response carries ONLY the payment row (no restored balance — the handler computes it via `removePayment` but discards the return), so the FE invalidate+refetches the invoice for the corrected balance/status (the established pattern).

## B3. Owner-only gating

Both affordances are backend `assertBranchRole(db, userId, branchId, ['dentist_owner'])` — STRICTER than the existing `canWrite` prop (owner||associate). NEW `canApplyDiscount(role)` + `canVoidPayment(role)` (both `=== 'dentist_owner'`) in `rbac.ts`; the component sources `role` from the same `useOrgContextStore` the billing route already reads, so the affordances **hide** for non-owners while the backend 403 stays the hard gate. The strict `=== 'dentist_owner'` is fail-safe against the store's `string | null` role.

## B4. Changes Made

| Fix ID | Implemented | Files |
| --- | --- | --- |
| FIX-003 | Footer "Apply Discount" (owner + issued/partial/overdue) → inline form (rate 0–100 + required reason) → `applyDentalDiscountMutation` → invalidate+refetch coherent totals | `invoice-detail.tsx`; `invoice-detail.helpers.ts` (`showDiscountButton`, `validateDiscountForm`); `rbac.ts` (`canApplyDiscount`) |
| FIX-004 | Per-payment-row "Void" action (owner, non-voided rows) → reason form → `voidDentalPaymentMutation` → invalidate+refetch restored balance; voided rows persist flagged "Voided" | `invoice-detail.tsx`; `invoice-detail.helpers.ts` (Payment `isVoid?/voidedAt?/voidReason?`, `canVoidPaymentRow`); `rbac.ts` (`canVoidPayment`) |
| §15 reconcile | `voidedByMemberId?: UUID` on `DentalPayment` + regen | `dental-billing.tsp`; generated `validators.ts`, SDK `types.gen.ts` |

## B5. Tests Added / Updated

| Test File | Type | What It Proves |
| --- | --- | --- |
| `invoice-detail.discount.test.tsx` (new) | FE component | Owner sees / associate does not; reason-required + rate-range block submit; 10% applies → POST `{reason, percentageRate: 10}` (RAW percentage) + coherent re-render (`-₱250.00` / `₱2250.00` from server truth) |
| `invoice-detail.payment-void.test.tsx` (new) | FE component | Owner sees / associate does not; void collects reason → POST `/payments/{id}/void {voidReason}`, restored balance scoped to the Balance row; voided row persists flagged "Voided"; empty-reason blocks; already-voided shows no action |
| `dental-billing.hurl` (updated) | contract | Discount returns the FULL invoice with EXACT recalculated arithmetic (`discountCents==4700`, `totalCents==18800`, `balanceCents==18800` vs the deterministic 23500 seed); void carries `voidedByMemberId` |
| `billing.spec.ts` (updated) | E2E | Owner applies 10% end-to-end (₱50.00 − 10% → `-₱5.00` / Total `₱45.00`) — proof the wire works through the real app + `seedIssuedInvoice` helper |

All FE affordance tests written **RED first** (8 fail / 2 pass — exactly the affordance-dependent tests failing); GREEN after wiring.

## B6. Adversarial Verification (pre-commit)

3-lens workflow (contract/§15 · FE-coherence/affordance · blast-radius/test-honesty) returned **SHIP / SHIP_WITH_NITS / SHIP — no blockers**. The test-honesty lens ran **7 independent source mutations**; every new test goes RED when its bound logic breaks (`vacuousTestRisk: NONE`) — including the percentage-vs-fraction hazard (sending the rate `/100` fails the happy path). **Majors folded in before commit:** (1) a **flaky** discount test (`userEvent.type` char-by-char raced the controlled number input → transient `0.1`) fixed with atomic `fireEvent.change` (stable ×3); (2) the claimed voidReason roadmap flag was **not actually written** — made real (TypeSpec comment + this report's §B7); (3) the hurl discount pins were `isInteger` (presence, not coherence) → tightened to **exact arithmetic** binding the recalculation invariant. **Nit folded in:** per-row Void trigger now `disabled={saving}`. The owner-gate non-vacuousness was also confirmed by a manual mutation (over-expose `canApplyDiscount` → associate-gate test fails).

## B7. ROADMAP FLAGS (deliberate deferrals, documented not silent)

- **`voidReason` lenient validation (audit-integrity gap).** `VoidDentalPaymentRequest.voidReason` has NO `@minLength` (unlike the sibling `VoidDentalInvoiceRequest` `@minLength(5)/@maxLength(500)`), and `voidDentalPayment.ts:50` does not trim/empty-guard it — so a **direct API caller can void a payment (a financial reversal) with an empty reason** and write an empty-reason `payment.void` audit row. The FE wired here imposes a 5-char floor, so contract+FE now diverge. **Deferred deliberately** (a server-validation/behavior change warrants its own RED-first 422 slice, out of scope for an FE-wiring batch). Flagged in `dental-billing.tsp` (comment on `VoidDentalPaymentRequest`). **V2:** add `@minLength(5)/@maxLength(500)` + a handler trim/empty guard mirroring the invoice void.
- **`ApplyDentalDiscountRequest.percentageRate`** is `float32` with no `@minValue(0)/@maxValue(100)` at the contract layer (handler-only `422 INVALID_DISCOUNT_RATE`) — same lenient-contract pattern; fold into the voidReason V2 slice. (Pre-existing, not introduced here.)

## B8. Tests Run

| Command | Result |
| --- | --- |
| `bun test invoice-detail.discount + payment-void` ×3 | 10/0 (stable, no flake) |
| `bun test src/features/billing/ + rbac` | 374/0 |
| `bun test src/` (full FE) | 2372/0 |
| `scripts/test-with-db.ts acceptance.billing-payments.test.ts` | 5/0 (no regen regression) |
| `CONTRACT_ONLY=dental-billing` (fresh :7213) | 40 reqs, 100% |
| `billing.spec.ts --project=chromium` | 5/0 (+discount money journey) |
| typecheck FE + api-ts + sdk-ts | clean |
| `check:boundaries:dental-billing` | clean |
| eslint (changed files) | 0 errors (test `any` warnings consistent with siblings) |

## B9. Completion Decision

`COMPLETE` (Batch B) — FIX-003 + FIX-004 landed RED-first across component + contract + E2E, with one §15 contract drift (`voidedByMemberId`) reconciled spec-first. 3-lens majors folded in pre-commit; the voidReason validation gap is documented as a tracked deferral, not papered over. **Remaining:** C (payment-plan create + FIX-006 flag-sync — §15 already found a REAL cross-module bug there), D (pins + aged-receivable seed + overdue-filter E2E).
