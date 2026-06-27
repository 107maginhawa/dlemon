# Dental Billing / Payment Audit — Phase-0 Plan

**Date:** 2026-06-27
**Branch (work off):** new branch off `main`
**Status:** Phase-0 plan — APPROVED 2026-06-27 (decisions resolved below; deposit path 1b still needs explicit go). Tranche 0 cleared to build.

### Build status (2026-06-27) — branch `feat/billing-coherence-pos` off `main`, 4 commits, NOT pushed
- **Tranche 0 — SHIPPED.** Items 1–5 (`b71a903f`): billable-only subtotal/footer, non-billable rows as muted context, pre-click disabled CTA + reason, per-row FSM status, `uncollectible` badge. Items 6–7 (`ba7d3c77`): devtools→bottom-left, table `overflow-x-auto`. **Item 8 SKIPPED** (by-status view already labels Charged/Estimate; by-visit Grand Total is an intentional case-total, not a pay surface). Verified: 2805 FE tests pass, typecheck+lint+pre-commit green; independent code-reviewer vetted predicate (no FSM/money/RLS/tax change).
- **Item 11 — SHIPPED** (`4f67b1c2`): non-payable Estimate surface for planned work in the payment modal (D1=1a foundation).
- **Item 10 — DEFERRED by D3=3a** (assume one invoice per visit; chooser only if reissue-after-uncollectible proves real).
- **Item 9 — DEFERRED (documented):** correct fix = server-computed "collected this month" KPI bucketed by `dental_payment.paymentDate` (clinic-local month, Asia/Manila). No existing KPI endpoint and the invoice-list shape carries no payment dates → a full TypeSpec→BE→Hurl→SDK→FE slice. Disproportionate to a single dashboard sum; greenlight separately.
- **Item 12 (deposit, D1=1b) — NEXT, needs focused design + expert review.** Open design Qs before build: how a deposit reconciles when the work is later performed (credit toward the performed-work invoice?), refund-on-cancel, the deposit-invoice FSM/status, and audit of the new payable path. Reuses existing payment-plan machinery; never loosens `createDentalInvoice`'s performed|verified filter.

### Decisions resolved (2026-06-27) — "what would Square/Stripe do, best for dentist long-term"
- **D1 = 1a now** (keep performed-only invoicing + add non-payable Estimate surface). **1b (deposit-invoice for planned work) = FLAGGED**: real & dentist-friendly, but a new payable path → needs explicit user go before building (money-semantics guardrail).
- **D2 = 2a** (explanatory copy + deep-link to treatment row; no in-checkout FSM auto-advance).
- **D3 = 3a + safety** (assume one non-voided invoice per visit, but if >1 show a chooser — never silently pick newest; item 10 kept).
- **D4 = payment date**, clinic-local month (Asia/Manila).

**Scope guardrails (non-negotiable):** Do **not** silently change what is billable, tax/BIR math (BR-054/BR-055), RLS posture, or the treatment FSM / `performed`/`verified` immutability. Keep `PER_TOOTH_PANEL.md` **P17** (in-card field edit of non-terminal treatment, EC4 relaxed) and **P18** (revert = dismiss + re-plan) intact. Every money mutation must be audited.

---

## (a) Root cause — "No billable treatments" incoherence

**The server message is CORRECT per the current rule. The bug is the FRONTEND, which advertises a payable total + an enabled "Create Invoice & Pay" button for treatments that the server will refuse to bill. This is, at its core, an UNDECIDED billable-policy product decision (see §F D1), not a billing-handler defect.**

### What the server does (source of truth — correct)
- `services/api-ts/src/handlers/dental-billing/createDentalInvoice.ts:78-83` — fetches row-locked treatments, keeps only `performed`/`verified`:
  ```ts
  const billable = treatments.filter(t => t.status === 'performed' || t.status === 'verified');
  if (billable.length === 0) {
    throw new BusinessLogicError('No billable treatments for this visit', 'NO_BILLABLE_TREATMENTS'); // 422
  }
  ```
- Subtotal summed from `billable` only (`:95`), guarded `> 0` (`:97-99`); line items created only from `billable` (`:132-142`); `isDone = t.status === 'verified'` (`:141`).
- Upstream gates: `CONSENT_REQUIRED` (`:68-71`), `TREATMENT_ALREADY_BILLED` (`:85-92`).
- Reaching a billable state requires **two** forward FSM steps `diagnosed → planned → performed` (`dental-visit/repos/treatment.schema.ts` transition table; enforced `updateDentalTreatment.ts:58-67`) **and** signed consent (`updateDentalTreatment.ts:70-77`). Single jumps are rejected.

### What the frontend does (the bug — incoherent)
- `apps/dentalemon/src/routes/_workspace/$patientId.tsx:854-861` — maps the **entire** `treatments` array (every status, from `use-treatments.ts:39-42`) into modal line items — **no billable filter**.
- `apps/dentalemon/src/features/workspace/components/workspace-payment-modal.tsx:182` — `subtotalCents = lineItems.reduce(... priceCents)` sums **all** statuses → advertises e.g. ₱6,300 over 3 diagnosed/planned rows.
- `workspace-payment-modal.tsx:331` — "Create Invoice & Pay" disabled only when `lineItems.length === 0`, **not** when nothing is billable → fully enabled over non-billable rows.
- The red "No billable treatments" appears only **after the click**, as the mutation's 422 body — `workspace-payment-modal.tsx:339-343` (`{(createInvoice.error as Error).message}`). Classic *summary-from-a-different-source-than-the-gate*.
- The footer `PaymentSummaryBar` shares the root pattern: `billableCount = treatments.length` and `totalAmount = Σ all` (`payment-summary-bar.tsx:26,30,67,72`), and its docstring (`:4-10`) explicitly assumes "billable set == every treatment in the visit" — the false invariant.

**Verdict:** No bug in the invoice path. The fix for the symptom is (1) a coherent FE that never offers a payable total/Pay for a non-billable set, and (2) a product decision on what *should* be billable / payable-in-advance (§F D1).

---

## (b) Root cause — UI overflow / polish

### B1 — TanStack Devtools badge overlaps the CTA
- Mounted at app root, **outside the router**, sibling of `<InnerApp />`: `apps/dentalemon/src/app.tsx:149-163` — `<TanStackDevtools config={{ position: 'bottom-right' }} ... />`.
- Gated only by `import.meta.env.DEV` (`:149`) → renders on **every** dev route, including the workspace.
- `position: 'bottom-right'` pins it `position: fixed` at high z-index in the bottom-right — directly over the footer CTA "Continue to Payment" (`payment-summary-bar.tsx:65-73`, `continue-to-payment-btn`), which also lives bottom-right. Dev-only artifact (absent in prod build) but obscures the CTA during local/iPad dogfooding.
- Fix: move devtools `position` to `bottom-left`, or guard behind an explicit debug flag (`app.tsx:149-151`).

### B2 — Treatment Breakdown table runs off / clips (no horizontal scroll)
- `treatment-table.tsx:353` — fixed 8-column `<table className="w-full text-sm">` (Chevron, Tooth, Surface, Condition, Treatment Plan, Done, Status, Total) with wide `px-4 py-2` padding; only two cells truncate (`max-w-[120px]`/`max-w-[200px]`).
- Outer wrapper is `overflow-hidden` (`treatment-table.tsx:289`) with **no** `overflow-x-auto` → the right-most **Total** column + Grand Total are **clipped / run off** on narrow/iPad widths rather than scrolling.
- Grand-total row is `sticky bottom-0` (`:670-682`) inside the route's single tall scroll container (`$patientId.tsx:541-543`, `flex-1 ... overflow-y-auto`, chart ~64vh) — compounds run-off on short viewports.
- Route reserves a hard **340px** right gutter when the slideout is open (`$patientId.tsx:543`, `paddingRight: ... ? 340 : 0`), further narrowing the table on iPad.
- The payment **modal** itself is bounded and scrolls (`workspace-payment-modal.tsx:226` `max-w-[520px] max-h-[calc(100dvh-80px)] overflow-hidden` + `:246` `flex-1 overflow-y-auto`); its line-item grid `1fr 72px 64px 80px` (`:75,270`) crowds below ~360px but scrolls vertically. **The uncontained overflow is the in-route `TreatmentTable`, not the modal.**
- Fix: wrap `<table>` (`treatment-table.tsx:353`) in `overflow-x-auto`, and/or collapse to a card list at narrow widths (the per-tooth panel already did this — see `tooth-overview-step.tsx:422-426` migration note); reconsider the fixed 340px gutter for iPad widths.

---

## (c) BE ↔ FE workflow map + coherence-gap table

**Throughline defect class:** displayed money/status/counts are derived from `treatments` (every status) or from a partial/stale invoice shape, while the source-of-truth (the invoice the server mints from `performed`/`verified` only, with its stored balance/status) is computed elsewhere.

### Step-by-step chain
1. **Treatment inputs → rows.** FE `useTreatments` (`use-treatments.ts:33-51`, every status, `priceAmount = priceCents/100`). BE = `dental_treatment` rows + FSM. Advance via `useMarkTreatmentDone` (`use-mark-treatment-done.ts:24-66`) → two sequential PATCHes `diagnosed→planned→performed` (`updateDentalTreatment`, `PATCH /dental/visits/{visitId}/treatments/{treatmentId}`), self-healing on partial failure.
2. **Treatment Breakdown table.** `TreatmentTable` (`treatment-table.tsx`). Grand Total `thisVisitTotal = Σ priceAmount over ALL native statuses` (`:245`, incl. dismissed/declined-priced per its own `:241-244` comment) `+ carriedOverTotal` (`:246-250`). `completedCount`/`hasPending` correctly key on `performed|verified` (`:229-237`) — coherent. By-Status grouping (`:40-53`) coherent with chart.
3. **Footer `PaymentSummaryBar`** (`payment-summary-bar.tsx:24-76`). `billableCount = treatments.length` (`:26`) drives label `(N)` + enablement; `totalAmount = Σ all` (`:30`) rendered "₱X total"; `pendingCount` (diagnosed|planned, `:27-29`) is context text only. Docstring invariant (`:4-10`) is false vs server.
4. **Payment modal** (`workspace-payment-modal.tsx:164-359`). lineItems = all treatments (`$patientId.tsx:854-861`); `subtotalCents` Σ all (`:182`, rendered `:309`). Per-row `isDone = status === 'done' || 'completed'` (`:70`) — **neither value is ever a treatment status**, so performed/verified rows always render "Pending". CTA disable `:331`. Existing-invoice banner reads the real invoice (coherent).
5. **createDentalInvoice (the gate)** — FE `useCreateInvoice` (`use-workspace-payment.ts:51-86`) POSTs `{patientId, visitId, branchId, dentistMemberId, dueDate?}`, **no line items — server re-derives**. BE filters billable (`createDentalInvoice.ts:79`), 422 `NO_BILLABLE_TREATMENTS` if empty (`:81-83`). 422 surfaced post-click (`workspace-payment-modal.tsx:339-343`).
6. **Payment capture** — `recordPaymentMutation` (`invoice-detail.tsx:201-216,319-338`) → `recordDentalPayment.ts`: atomic balance math (`:138-159`); rejects `voided`/`paid` (`INVOICE_IMMUTABLE`), `draft` (`INVALID_STATUS_TRANSITION`), over-balance (`PAYMENT_EXCEEDS_BALANCE`). Source of truth = `dental_payment` row + updated invoice balance/status.
7. **Receipt** — `getDentalPaymentReceipt.ts`: VAT split from stored `invoice.taxRate/taxCents`, includes `isVoid/voidedAt/voidReason` (BR-055 BIR). Coherent.
8. **Downstream** — `InvoiceDetail` (`invoice-detail.tsx:426-...`) reads enriched GET + invalidate-on-mutation → coherent. `BillingList` (`billing-list.tsx:117-303`): Outstanding/Overdue/row badges coherent; **`collectedThisMonth` buckets by invoice `createdAt`, not payment date** (`:88-91`). AR aging server-computed (coherent).

### COHERENCE-GAP TABLE

| id | location (file:line) | displayed value source | source-of-truth | how they disagree | severity |
|----|----------------------|------------------------|-----------------|-------------------|----------|
| **G1** | `payment-summary-bar.tsx:30,56-59` | `totalAmount` = Σ priceAmount over **all** treatments | invoice `subtotalCents` from `performed\|verified` only (`createDentalInvoice.ts:79,95`) | Footer "₱X total" includes diagnosed/planned/dismissed/declined rows that will never be billed | **High** |
| **G2** | `payment-summary-bar.tsx:26,67,72` | `billableCount = treatments.length` → CTA count + enablement | server billable predicate (`createDentalInvoice.ts:79`) | "Continue to Payment (3)" + enabled CTA over 0 performed → guaranteed 422 | **High** |
| **G3** | `workspace-payment-modal.tsx:182,309` ← `$patientId.tsx:854-861` | `subtotalCents` = Σ priceCents over **all** mapped treatments | invoice `subtotalCents` (billable-only, `:95`) | Confident "Subtotal ₱X" over non-billable rows; contradicted only post-click | **High** |
| **G4** | `workspace-payment-modal.tsx:331` | CTA disabled only when `lineItems.length === 0` | server `NO_BILLABLE_TREATMENTS` gate (`:81-83`) | Button enabled with only non-billable rows; real gate fires as 422 at `:339-343` after click | **High** |
| **G5** | `workspace-payment-modal.tsx:70` (`LineItemRow.isDone`) | `status === 'done' \|\| 'completed'` | real statuses are `performed`/`verified` (route passes `t.status` verbatim, `$patientId.tsx:860`) | No treatment is ever `'done'`/`'completed'`, so even a **billable** line renders "Pending" + Clock | **Medium** |
| **G6** | `treatment-table.tsx:245-250` (Grand Total) | Σ priceAmount over **all** native statuses (incl. dismissed/declined) | billable subtotal the visit will invoice (`:95`) | Grand Total overstates what is payable (per its own `:241-244` comment) | **Medium** |
| **G7** | `payment-summary-bar.tsx:4-10` (docstring) / `:26` | "billable set == every treatment in the visit" | server bills `performed\|verified` only | False invariant — root assumption behind G1/G2 | **Medium (root)** |
| **G8** | `workspace-payment-modal.tsx:96-98` ("Done"/"Pending" label) | same `isDone` as G5 | treatment FSM status | Billable rows mislabeled "Pending" in the pay modal | **Low** |
| **G9** | `billing-list.tsx:88-91` (`collectedThisMonth`) | sums `inv.paidCents` where invoice **`createdAt`** is this month | actual payment dates (`dental_payment.createdAt`/`paymentDate`, `recordDentalPayment.ts:111,131`) | Payment this month on a prior-month invoice is missed; same-month invoice paid later is over-counted | **Medium** |
| **G10** | `workspace-payment-modal.tsx:53-63` (`statusConfig`) | maps `draft\|issued\|partial\|paid\|overdue\|voided` | enum also has **`uncollectible`** (`dental-invoice.schema.ts:17-19`) | `uncollectible` falls to default branch → raw string, neutral styling | **Low** |
| **G11** | `workspace-payment-modal.tsx:191-193` (`visitInvoice`) | first non-voided invoice matching `visitId`, newest | multiple non-voided invoices per visit not excluded | If a visit has >1 non-voided invoice, banner silently shows only the newest | **Low** |
| **G12** | timing: `workspace-payment-modal.tsx:299-312` vs `:339-343` | Subtotal/CTA rendered immediately; error only after mutation settles | server gate | Affirmative money/CTA precede the contradicting gate result in time | **High (UX)** |

**Coherent (verified, no gap):** `InvoiceDetail` totals/payments/status (`invoice-detail.tsx:426-505`, invalidate+refetch after every money mutation); `InvoiceBanner` (`:113-157,252-262`); `BillingList` Outstanding/Overdue + row Amount/Balance/Status (`:82-87,264-272`); `recordDentalPayment` balance math, receipt VAT split, AR aging (all server-computed).

---

## (d) Target workflow + UI/UX (Square POS + Stripe invoicing standard)

### Platform standard (grounded)
- **Estimate/Quote vs Invoice are distinct objects with distinct status machines.** Stripe: Quote `draft → open → accepted`; acceptance mints an invoice in **`draft`** (editable), then finalize → `open`. Square: Estimates (Dashboard-only) → `CreateInvoice` against an OPEN order → `DRAFT` → `PublishInvoice`. **A dental treatment plan ≈ Quote/Estimate; an actual bill ≈ Invoice.**
- **Nothing is payable until it is a finalized/published invoice** (Stripe `open` / Square `UNPAID` + `public_url`). Draft estimates/quotes **never expose a Pay action.** Neither platform has a clinical "completed" gate — that is an app-layer concept.
- **Deposits / future work:** Square `DEPOSIT` request_type and first-installment requests are purpose-built to bill *future* work legitimately, as a finalized invoice — never as a payable total on a draft estimate.
- **Schedules/installments:** Square ≤12 installments; percentages sum to 100% (of total minus deposit) / fixed amounts sum to total; client-side validated before Send. Stripe payment plans: installments must sum exactly to invoice total or finalize fails.
- **Post-finalize corrections are credit notes / refunds, never silent line edits** (tax-retention compliance).
- **Money hierarchy:** Subtotal → Discounts → Tax (→ service charge/tip) → **Total** → Amount Paid → **Amount Due** (the single most-prominent, actionable number).

### How Dentalemon already matches (do NOT rebuild — see BE §4)
The dental-billing module already ships: invoice draft→issued FSM, discount, tax (BR-054 VAT carve-out from branch tax mode), record/void/refund payment, mark-uncollectible, **payment plans (installments)**, **insurance claims (HMO split)**, **`estimateClaimCoverage` (LOA/HMO split, read-only)**, patient credits + apply-credit, statement batch + manual dunning, BIR receipt (BR-055), AR/collections. The gap is **not** missing capabilities — it is **(1) FE coherence** and **(2) the absence of an Estimate/Quote object distinct from the invoice**, which is exactly the Square/Stripe split the symptom is begging for.

### Target workflow (recommended end state)
1. **Treatment plan = Estimate/Quote.** Surface the plan's `totalEstimateCents` (already summed over all plan-linked treatments, `treatment-plan.repo.ts:105-115`) and `estimateClaimCoverage` results **labelled as an Estimate** — explicitly **not payable**, no Pay action, distinct status badge. This is where non-billable money belongs.
2. **Invoice = bill of performed work.** "Create Invoice & Pay" only ever offers the **billable** (`performed`/`verified`) subtotal — the modal mirrors the server predicate so the advertised total === what the server will mint.
3. **Empty/disabled states with reasons.** When 0 billable: no payable Subtotal, CTA disabled with copy ("Mark a treatment as performed to bill it" / "Needs signed consent"), and the Estimate total shown separately. Never a post-click 422 contradiction.
4. **(Decision-gated) Deposit on planned work.** If the clinic needs to take money for not-yet-performed work, model it as Square does — an explicit **deposit / first-installment invoice**, finalized and payable, **not** by loosening the billable filter (§F D1).

### UI/UX standards to apply
- **Never show a payable total the system will reject** (collapses G1–G4, G12). Pay affordance appears only for `open`/`unpaid`/`partially_paid` with `amount_due > 0`; estimates show no Pay.
- **Money hierarchy** on the modal and invoice detail: Subtotal → Discount → Tax → Total → Paid → **Amount Due** (most prominent, right-aligned, never truncated).
- **One unambiguous status badge per state** incl. `uncollectible` (fixes G10); don't overload "open" with derived flags.
- **Explicit empty/disabled states:** empty line-item table prompts the next action; disabled Pay/Send carry a reason.
- **Correct per-row status** ("Performed"/"Verified" vs "Planned"), fixing G5/G8.
- **Receipt/confirmation** for every payment (already present via BR-055) — keep; show running paid-to-date + next due for plans.
- **Irreversible actions guarded:** confirm dialogs for finalize/void/refund/mark-uncollectible (copy states "cannot be undone").
- **Touch targets ≥ 44px** for all pay/send/status actions (iPad chairside).
- **Responsive:** line-item table → stacked cards on narrow widths, per-line amount preserved; status badge + Total always visible (fixes §b B2).

### RECOMMENDATION
Adopt the **two-object split (Estimate/Quote vs Invoice)** as the north star, but reach it incrementally: ship the **FE coherence + overflow fixes first** (they need NO policy decision and immediately kill the contradiction), then add the **Estimate surface** for non-billable money, and only add a **deposit-invoice** path if D1 selects it. Keep the server billable filter, FSM, immutability, tax/BIR math, and RLS exactly as-is.

---

## (e) Vertical-slice build plan

Each item is tagged `[presentation]` (FE-only render/disable/copy), `[logic]` (derivation/computation), or `[vertical-slice]` (TypeSpec→BE→contract→FE→E2E). **Policy-independent coherence + overflow fixes come FIRST; policy-dependent slices LATER (after §F approval).**

**Verify gates (per memory + CLAUDE.md):**
- **FE gate:** `bun run typecheck` + `bun run lint` + `bun run test` (FE `src/`) + Playwright E2E for the touched flow.
- **BE gate:** `bun run typecheck` + `bun run lint` + `DATABASE_URL=…/monobase_test bun run test` (never `bun test <path>` — pollutes the clone template) + `bun run check:boundaries` + Hurl contract suite against a real booted server.
- **Coherence gate (always):** rerun `services/api-ts/scripts/check-timeline-coherence.ts` → **0 violations** (reseed dev DB first; the contract suite pollutes it).

### Tranche 0 — Policy-INDEPENDENT coherence + polish (ship first, no decision needed)

1. **`[presentation]` Modal: never show a payable total / Pay over a non-billable set.** In `workspace-payment-modal.tsx`, when the billable-derived subtotal is 0, hide the Subtotal money + disable "Create Invoice & Pay" with an explicit reason ("Mark a treatment as performed to bill it"), instead of an enabled CTA that 422s. Render the "needs a performed treatment" explanation **pre-click** (kills G4/G12). *Verify: FE gate.*

2. **`[logic]` Mirror the server billable predicate at FE derivation boundaries.** Add `isBillable = t.status === 'performed' || t.status === 'verified'` once (shared util), and derive modal `lineItems`/`subtotalCents` from it at the route boundary (`$patientId.tsx:854-861`) and the footer count/total (`payment-summary-bar.tsx:26,30`). Collapses **G1, G2, G3, G6** (footer) to coherent. Show non-billable rows as **context** (greyed, "Planned — not yet billable"), not as payable. *Verify: FE gate + coherence gate.*

3. **`[presentation]` Fix per-row status indicator (G5/G8).** In `LineItemRow` (`workspace-payment-modal.tsx:70,96-98`), test `'performed'|'verified'` for the done state and label "Performed"/"Verified" vs "Planned". *Verify: FE gate.*

4. **`[presentation]` Correct the footer invariant + copy (G7).** Update `PaymentSummaryBar` docstring (`:4-10`) and labels so "Continue to Payment (N)" counts **billable** rows; surface `pendingCount` as "N planned, not yet billable". *Verify: FE gate.*

5. **`[presentation]` Render `uncollectible` status badge (G10).** Add the missing case to `statusConfig` (`workspace-payment-modal.tsx:53-63`) and any shared status map; one unambiguous badge per enum value. *Verify: FE gate.*

6. **`[presentation]` Devtools no longer overlaps the CTA (§b B1).** In `app.tsx:149-163`, move `position` to `bottom-left` (or guard behind an explicit `VITE_DEVTOOLS` flag). *Verify: FE gate + Playwright screenshot of workspace footer.*

7. **`[presentation]` Treatment Breakdown table overflow (§b B2).** Wrap the `<table>` (`treatment-table.tsx:353`) in `overflow-x-auto` (parent `:289` is `overflow-hidden`) and/or collapse to a card list at narrow widths (reuse the per-tooth `tooth-overview-step.tsx:422-426` pattern); apply money-hierarchy right-alignment + no-truncate to the Total column. Revisit the 340px gutter (`$patientId.tsx:543`) for iPad. *Verify: FE gate + Playwright responsive (iPad + desktop) screenshots.*

8. **`[presentation]` Grand Total money hierarchy + billable clarity (G6 render).** In `TreatmentTable` show the **billable** total as the prominent payable figure and the all-status sum as a clearly-labelled "case total / estimate" — do not change the computation, only the labelling/hierarchy. *Verify: FE gate + coherence gate.*

### Tranche 1 — Coherence fixes needing a small BE/logic decision

9. **`[logic]` `collectedThisMonth` by payment date, not invoice createdAt (G9).** Re-bucket on `dental_payment.paymentDate`/`createdAt`. If the data is not already on the FE list shape, this becomes `[vertical-slice]` (extend the invoices/payments read to carry payment dates). *Verify: FE gate (+ BE gate + Hurl if the read changes).* **Flag:** confirm "this month" = clinic local month (BR/PH timezone) with the user.

10. **`[presentation]` Multi-invoice-per-visit banner (G11).** When >1 non-voided invoice matches a visit, show a disambiguating chooser instead of silently picking the newest (`workspace-payment-modal.tsx:191-193`). *Verify: FE gate.* **Flag:** depends on D3.

### Tranche 2 — Policy-DEPENDENT (BUILD ONLY AFTER §F approval)

11. **`[vertical-slice]` Estimate/Quote surface for non-billable money (D1 = recommended).** Present `treatment-plan.totalEstimateCents` (`treatment-plan.repo.ts:105-115`) + `estimateClaimCoverage` as a **labelled, non-payable Estimate** distinct from the invoice — no Pay action. TypeSpec (read shape if needed) → BE (likely read-only, reuse existing) → contract → FE → E2E. *Verify: full BE + FE + coherence gate.* Does **not** touch the billable filter.

12. **`[vertical-slice]` (only if D1 = "allow deposit on planned work") Deposit / first-installment invoice.** Model future-work payment the Square way — an explicit finalized deposit invoice — **without** loosening `createDentalInvoice`'s `performed|verified` filter. Reuse the existing payment-plan installment machinery. Every money mutation audited. *Verify: full BE + FE + Hurl + coherence gate.* **Do NOT pursue if D1 = "keep performed-only".**

13. **`[vertical-slice]` (only if D2 selects it) Adjust the visible "advance" affordance.** If D2 = surface a one-click "mark performed (+ consent)" from the pay flow, build it as a guarded slice respecting the two-step FSM + consent gate (`updateDentalTreatment.ts:58-77`), keeping P17/P18 + immutability intact. *Verify: full BE + FE + coherence gate.*

**Ordering rationale:** Items 1–8 remove the user-facing contradiction and the overflow with zero policy risk and zero server change. 9–10 are small. 11–13 are gated on §F and only then implement the target two-object workflow / deposit path.

---

## (f) Open product decisions (APPROVAL CHECKPOINT)

**D1 — Billable policy fork (the core decision).** Today only `performed`/`verified` treatments are billable (`createDentalInvoice.ts:79`); planned work shows a payable total that 422s. Pick one:
- **(1a) Keep performed-only billing; add a non-payable Estimate surface for planned work.** *(RECOMMENDED.)* Matches Square/Stripe (estimates aren't payable; invoices bill done work), preserves the FSM/immutability/tax integrity, and the FE coherence fixes (Tranche 0) already make this honest. Lowest risk.
- **(1b) Keep performed-only billing, but add an explicit deposit-invoice path** for clinics that take money up front on planned work (Square `DEPOSIT` model) — a *finalized invoice*, not a loosened filter. Adds Tranche-2 item 12.
- **(1c) Make `planned` (or `diagnosed`) billable.** **NOT recommended** — silently changes what is billable, breaks the FSM/immutability invariant and BR-013/BR-052/BR-054 assumptions, and contradicts the platform standard. Would require explicit sign-off and re-audit.
> **My recommendation: 1a now, 1b only if the clinic confirms a real deposit workflow.**

**D2 — How should the user reach "billable" from the pay flow?** Today they must leave the modal and advance treatments `diagnosed→planned→performed` (two PATCHes) + sign consent. Options: (2a) explanatory copy + a deep-link to the treatment row *(recommended, presentation-only)*; (2b) a guarded one-click "mark performed" inside the pay flow (Tranche-2 item 13, respects FSM + consent). **Recommendation: 2a first; 2b only if dogfooding shows the round-trip is painful.**

**D3 — One invoice per visit, or many?** `visitInvoice` (`workspace-payment-modal.tsx:191-193`) silently picks the newest non-voided. (3a) Enforce/assume one non-voided invoice per visit *(simplest, recommended)*; (3b) support multiple + a chooser (item 10). **Recommendation: 3a unless reissue-after-uncollectible is a real workflow.**

**D4 — "Collected This Month" definition (G9).** Bucket by **payment date** (recommended, matches accounting reality) in clinic-local month? Confirm timezone (PH). **Recommendation: payment date, clinic-local month.**

**D5 — Estimate object scope (only if D1=1a/1b).** Reuse the existing `treatment-plan.totalEstimateCents` + `estimateClaimCoverage` read-only as the Estimate surface (recommended, no new table), or introduce a first-class Quote object with its own status machine (larger). **Recommendation: reuse existing reads now; first-class Quote only if the product needs accept/expire lifecycle.**

**Guardrails reaffirmed:** no silent change to billable set / tax-BIR math (BR-054/055) / RLS / treatment FSM / `performed`-`verified` immutability; P17 + P18 preserved; every money mutation audited.
