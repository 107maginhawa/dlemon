# Compliance Report — dental-billing

---
Audit Date: 2026-05-30
Dimension: compliance (oli-check, single-module)
Module: dental-billing
Spec Version: MODULE_SPEC 1.0 (2026-05-24), API_CONTRACTS 1.0 (2026-05-24)
Mode: --module dental-billing --auto
Knowledge graph: docs/audits/codebase-map/ (generated 2026-05-30) used as structural ground truth
---

## Generated Code Exclusion

`src/generated/openapi/{routes,validators,registry,types}.ts` are EXCLUDED from violation findings
(code-generated from TypeSpec/OpenAPI). They are, however, used as ground truth for *how the public
wire contract is actually enforced* (field names, auth lists, route paths). Hand-written files in
scope: all handlers under `handlers/dental-billing/`, repos/schemas under `repos/`, and the
cross-module statement handler `dental-patient/identity/getDentalPatientStatement.ts`.

## Audit Scope

| Artifact | Available | Steps Executed |
|----------|-----------|---------------|
| MODULE_SPEC.md | YES | BR §5, AC §11, permissions §6, state §8, API §10, data §7, events §10b, errors §15 |
| API_CONTRACTS.md | YES | Step 8b request/response/auth/error compliance |
| ROLE_PERMISSION_MATRIX.md | YES (docs/product/) | Step 5; spec §6 states it is reconciled with the matrix and is authoritative for this module |
| DOMAIN_GLOSSARY / DOMAIN_MODEL / EVENT_CONTRACTS / ERROR_TAXONOMY / AUDIT_CONTRACTS / DATA_GOVERNANCE | Present in docs/product/ | Light cross-check; no terminology drift found in billing handlers |

Wiring confirmed: every billing handler is imported in `generated/openapi/registry.ts` and routed in
`generated/openapi/routes.ts` (lines 405–514: create/list/get invoice, discount, issue (PATCH),
payments, payments list, receipt, void payment, plan create/get, uncollectible, void invoice,
patient balance) plus `getDentalPatientStatement` (line 966). **No unrouted handlers** — the module
is reachable in production via the generated route table mounted in `app.ts`.

> Process note: the sandbox intermittently dropped tool output during this run. An earlier draft of
> this report asserted a non-existent "unmounted router" P0 and three non-existent "missing repo
> method" issues; those were artifacts of the output blackout and have been RETRACTED after direct
> re-reads. Every finding below was verified by reading the actual source file contents.

---

## Executive Summary

- **Overall compliance: WARN** — 0 P0, 1 P1, 4 P2, 3 P3. Business-rule and permission enforcement
  for dental-billing is strong; the residual issues are an FSM edge (payment on a `draft` invoice)
  and documentation-vs-implementation contract drift (API_CONTRACTS.md declares snake_case fields and
  `fortnightly`; the implemented wire contract uses camelCase and `biweekly`).
- Compliance rate (Step formula, excluding P3): (29 audited items − 0 P0 − 1 P1 − 4 P2) / 29 ≈ **83%**.

### Top 3 risks
1. Payment accepted on a `draft` invoice — out-of-FSM transition vs §8/BR-012 (V-BIL-105, P1).
2. API_CONTRACTS.md field/enum names diverge from the implemented (generated) contract (V-BIL-201/202, P2).
3. Void-payment status restore relies on `issuedAt` heuristic; reversing a payment on a `paid`
   invoice can leave a non-obvious status (V-BIL-203, P2).

---

## Category Summary

| Category | Items | Compliant | P0 | P1 | P2 | P3 | Spec Gaps |
|----------|-------|-----------|----|----|----|----|-----------|
| Business Rules (BR-009..015) | 7 | 7 | 0 | 0 | 0 | 0 | 0 |
| Acceptance Criteria (AC-BIL-001..005) | 5 | 5 | 0 | 0 | 0 | 0 | 0 |
| Permissions (§6, 7 actions) | 7 | 7 | 0 | 0 | 0 | 0 | 0 |
| State Transitions (§8) | 6 | 5 | 0 | 1 | 0 | 0 | 0 |
| API Contracts (doc vs impl) | 8 | 4 | 0 | 0 | 3 | 1 | 0 |
| Data Validation (§7) | 6 | 6 | 0 | 0 | 0 | 0 | 0 |
| Events / Audit (§10b, §17) | 3 | 3 | 0 | 0 | 0 | 2 | 0 |
| Data integrity (status restore) | — | — | 0 | 0 | 1 | 0 | 0 |

---

## Violations

### P0 — Fix Now
None.

### P1 — Fix Before New Work

| ID | Category | Description | File:Line | Suggested Fix | Autofix |
|----|----------|-------------|-----------|---------------|---------|
| V-BIL-105 | State machine / BR-012 | Spec §8 SM-INVOICE: payable states are `issued → partial/paid` and `partial → paid`; a `draft` invoice must be `issued` before payment. `recordDentalPayment` only blocks `voided` and `paid`, so a payment on a `draft` invoice succeeds, and `addPayment`'s CASE drives `draft → partial/paid` directly. §15 expects `INVALID_STATUS_TRANSITION` for out-of-FSM moves. (Note: void-after-paid IS intentionally allowed per §13, so that path is compliant.) | recordDentalPayment.ts:43-57 ; repos/dental-invoice.repo.ts:140-144 | Add a guard rejecting `status === 'draft'` with `INVALID_STATUS_TRANSITION` (require issued/partial/overdue). | No |

### P2 — Fix When Touching

| ID | Category | Description | File:Line | Suggested Fix | Autofix |
|----|----------|-------------|-----------|---------------|---------|
| V-BIL-201 | API contract drift | API_CONTRACTS.md declares snake_case payment fields (`amount_cents`, `payment_method`, `payment_date`, `reference`) and create-invoice (`branch_id`/`visit_id`/`patient_id`); the implemented (generated) contract uses camelCase (`amountCents`, `method`, `paymentDate`, `receiptNumber`, `branchId`/`visitId`/`patientId`) plus required `dentistMemberId`/`recordedByMemberId` not in the doc. The handlers (createDentalInvoice, recordDentalPayment) consume the camelCase shape. The CONTRACT DOC is wrong relative to shipped code. | API_CONTRACTS.md §POST payments / POST invoices ; validators.ts:107-138 (generated, evidence only) | Regenerate/rewrite API_CONTRACTS.md from the OpenAPI source so field names + required set match, or align TypeSpec to snake_case if the doc is the intended contract. | No |
| V-BIL-202 | API contract drift | Payment-plan: doc declares `installment_count`, `first_payment_date`, optional `deposit_cents`, frequency enum incl. `fortnightly`. Implementation uses `numberOfInstallments`, `startDate`, `patientId`, no `deposit_cents`, frequency enum `weekly/biweekly/monthly`. Field-name, field-set, and enum-value mismatch (doc `fortnightly` vs code `biweekly`). | API_CONTRACTS.md §POST payment-plans ; createDentalPaymentPlan.ts:37-75 ; validators.ts:155-160 | Reconcile contract doc with implementation (names, deposit_cents support or removal, fortnightly↔biweekly). | No |
| V-BIL-203 | Data integrity / FSM | `voidDentalPayment` → `removePayment` restores status via `CASE WHEN issuedAt IS NOT NULL THEN 'issued' ELSE 'draft'` when paid drops to 0. An invoice that was fully `paid` then has its only payment voided is set back to `issued` (correct only if it was issued) — but a `paid` invoice created without an explicit issue step (paid directly from draft, see V-BIL-105) would incorrectly resolve to `draft`. Status reconstruction is heuristic, not derived from a recorded prior state. | repos/dental-invoice.repo.ts:160-179 ; voidDentalPayment.ts:53 | Once V-BIL-105 forbids draft payments, this heuristic is sound; otherwise recompute status from the canonical FSM rather than `issuedAt` presence. | No |
| V-BIL-204 | Error code taxonomy | applyDentalDiscount throws `VOIDED_INVOICE`/`ALREADY_PAID` for discount-on-terminal-invoice; createDentalPaymentPlan throws `VOIDED_INVOICE`. Spec §15 standardizes terminal-invoice rejection as `INVOICE_IMMUTABLE` (used correctly in recordDentalPayment). These two handlers use legacy codes for the same condition class. | applyDentalDiscount.ts:35,39 ; createDentalPaymentPlan.ts:49 | Standardize to `INVOICE_IMMUTABLE` for terminal-state writes (or document the discount/plan-specific codes in §15). | Yes |

### P3 — Track

| ID | Category | Description | File:Line | Notes |
|----|----------|-------------|-----------|-------|
| V-BIL-301 | API contract | API_CONTRACTS.md uses path `POST /dental/invoices/:id/payment-plans`; implemented path is `POST /dental/billing/invoices/:invoiceId/plan` (and `.../uncollectible`, balance under `/dental/billing/...`). Whole module is under a `/dental/billing` prefix not reflected in the contract doc's example paths. | generated/openapi/routes.ts:482 (evidence) vs API_CONTRACTS.md | Align contract doc base paths with the shipped `/dental/billing` prefix. |
| V-BIL-302 | Dead code | `domain-events.ts` `emitInvoicePaid` is `@deprecated` and unused (ADR-006: InvoicePaid realized as `invoice.paid` audit row, which IS written — recordDentalPayment.ts:136-146). `emitInvoiceCreated` IS wired (createDentalInvoice.ts:125). No functional gap; just retained dead helper. | domain-events.ts:70-79 | Remove or annotate; harmless. |
| V-BIL-303 | Events naming | createDentalInvoice comment labels the event `DE-020`; spec §10b labels InvoiceCreated `DE-007`. Cosmetic ID drift in comments only. | createDentalInvoice.ts:123 ; domain-events.ts:4 | Align DE-NNN comment references with spec §10b. |

---

## Compliant highlights (verified ENFORCED by direct source read)

- BR-009 NO_BILLABLE_TREATMENTS + double-billing guard — createDentalInvoice.ts:49-60.
- BR-010 tax=0, not caller-controllable (EM-BILL-001) — createDentalInvoice.ts:72-74; schema default '0'.
- BR-011 ACTIVE_PAYMENT_PLAN void block (on_track/behind) — voidDentalInvoice.ts:43-47.
- BR-012 invoice FSM: issue requires draft (issueDentalInvoice.ts:35; repo WHERE status='draft' :109);
  ALREADY_VOIDED guard (voidDentalInvoice.ts:33). Sole gap = V-BIL-105.
- BR-013 markUncollectible → 501 NOT_IMPLEMENTED — markUncollectible.ts:25-29.
- BR-014 CONSENT_REQUIRED before invoicing — createDentalInvoice.ts:38-41.
- BR-015 bounds: discount 0–100 (applyDentalDiscount.ts:49-59 + util), installments 2–24
  (createDentalPaymentPlan.ts:37-46 AND repo defense-in-depth :66-69), payment amount >0
  (recordDentalPayment.ts:37-39).
- V-BIL-004 PAYMENT_EXCEEDS_BALANCE / V-BIL-005 INVOICE_IMMUTABLE — recordDentalPayment.ts:43-57.
- V-BIL-009 per-invoice idempotent receipt + cross-invoice reuse → 409 — recordDentalPayment.ts:71-93.
- V-BIL-011 InvoicePaid audit marker only on full-paid transition — recordDentalPayment.ts:136-146.
- V-BIL-012 outstanding_cents exposed — getDentalInvoice.ts:66.
- Concurrency-safe money math: atomic SQL in addPayment/removePayment (repo:134-179); UUID invoice
  numbers avoid MAX() race (repo:37-41).
- **Permissions (§6) all correct:** create invoice = dentist_owner+dentist_associate, staff_full
  excluded (createDentalInvoice.ts:34); issue same (issueDentalInvoice.ts:33); create plan same
  (createDentalPaymentPlan.ts:32); record payment includes staff_full (recordDentalPayment.ts:35);
  void invoice = dentist_owner only (voidDentalInvoice.ts:31); void payment = dentist_owner only
  (voidDentalPayment.ts:32); discount = dentist_owner only (applyDentalDiscount.ts:32).
  getPatientBalance / getDentalInvoice / listDentalInvoices / statement all branch-scope via
  assertBranchAccess / assertPatientBranchAccess; listDentalInvoices requires branchId (no
  cross-branch enumeration, listDentalInvoices.ts:31).
- AC-BIL-001..005 all have corresponding tests (dental-billing.test.ts, edge-cases, invoice-lifecycle,
  acceptance.billing-payments, billing-gate-http, dental-billing-events, fsm property tests).

## getPatientBalance note (re-verified — NOT a violation)
Earlier draft flagged getPatientBalance as having no auth. FALSE: it resolves the patient's
`preferredBranchId` and calls `assertBranchAccess` (getPatientBalance.ts:24-28) before aggregating.
The aggregation across the patient's invoices is by design (FR4.4 per-patient balance) and the caller
is authorized to that patient's branch.

---

## Spec Gaps (not code violations)

| Section | Gap | Recommendation |
|---------|-----|----------------|
| API_CONTRACTS.md | Field names, enum values, and base paths drift from the shipped TypeSpec/OpenAPI (V-BIL-201/202/301) | Regenerate API_CONTRACTS.md from the OpenAPI source of truth so the doc and code cannot diverge. |
| §15 | Terminal-invoice write rejection code not standardized across discount/plan vs payment | Define one canonical code (`INVOICE_IMMUTABLE`) for all terminal-state writes. |

---

## Stabilization Plan

### Fix Before New Work (P1)
- V-BIL-105: reject payments on `draft` invoices (FSM compliance) — also closes the V-BIL-203 ambiguity.

### Fix When Touching (P2)
- V-BIL-201/202: regenerate API_CONTRACTS.md to match the shipped contract.
- V-BIL-203: recompute void-restore status from FSM (auto-resolved once V-BIL-105 lands).
- V-BIL-204: standardize terminal-state error code to INVOICE_IMMUTABLE.

### Track (P3)
- V-BIL-301 base-path drift, V-BIL-302 dead emitter, V-BIL-303 DE-NNN comment drift.

## Health Score

| Dimension | Score (0-10) | Notes |
|-----------|-------------|-------|
| Business rule enforcement | 9 | All BR-009..015 enforced; only FSM draft-payment edge. |
| Acceptance criteria coverage | 9 | All AC-BIL covered by tests. |
| Permission coverage | 10 | All §6 actions match; branch scoping consistent. |
| State transition safety | 6 | V-BIL-105 draft-payment (P1 caps at 6). |
| API contract compliance | 6 | Doc-vs-impl drift (P2 cluster). |
| Data validation coverage | 9 | Bounds defended in handler + repo. |
| Event/audit compliance | 9 | Audit-log markers written per ADR-006. |
| Data integrity | 8 | Atomic money math; one heuristic restore. |

**Overall health: 8.3/10 — WARN (1 P1, no P0).**

## What's Next
No P0s. Fix V-BIL-105 before new billing work (single guard, low blast radius), then regenerate
API_CONTRACTS.md to clear the P2 drift cluster. Re-run `/oli-check --compliance --module dental-billing`
after the P1 fix.
