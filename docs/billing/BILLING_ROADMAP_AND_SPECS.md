# Billing Module — Complete Roadmap & Implementation Reference

Status: APPROVED 2026-06-18 · Source: /office-hours review (backend + frontend + specs/audits).
Decision: **do all phases** (PH-first, multi-country later). Implement per the project's
Vertical TDD protocol (one slice at a time, RED → GREEN). See
[VERTICAL_TDD.md](../development/VERTICAL_TDD.md).

---

## 1. Context

A 3-track code review found the dental-billing **backend is mature and well-tested** —
including receivables primitives (AR aging, patient balance, installment plans). The work is
therefore: (A) wire the existing backend to UI, (B) add the missing receivables/terms/automation
layer, (C) build dashboards & statements, (D) add credit balances & refunds, and (E) keep clean
seams for the deferred multi-country / online-pay tracks.

---

## 2. Current state (baseline — do not rebuild)

### Working backend workflows
Invoice lifecycle (draft→issued→partial/paid/overdue/voided/uncollectible, discount, void,
write-off) · payments (record/void cash·card·bank, receipt, per-invoice idempotency) ·
payment plans (2–24 installments, weekly/biweekly/monthly, installment + plan FSM) · PH HMO
insurance (10-state claim FSM, multi-line, remittance/EOB, disallowance, coverage estimate) ·
receivables reports (AR aging by patient & payer, collections summary, patient balance, batch
statements) · generic Stripe module (PaymentIntent, capture, refund, Connect, webhook
idempotency) **not wired to dental**.

### Business rules already enforced
BR-009 (≥1 billable treatment, no double-billing) · BR-010 (tax=0, server-controlled, ADR-011) ·
BR-011 (active plan blocks void/uncollectible) · BR-012 (invoice FSM + payment validity +
overpayment block) · BR-013 (uncollectible terminal, owner-only) · BR-014 (consent before
invoice) · BR-015 (money bounds: discount 0–100, installments 2–24, payment ≥1¢) ·
EM-BIL-002 (report endpoints scope to caller's branches).

### Key files
- Backend: `services/api-ts/src/handlers/dental-billing/` (`*.ts` handlers, `repos/*.schema.ts`, `repos/*.repo.ts`, `repos/billing-report.facade.ts`)
- Generic Stripe: `services/api-ts/src/handlers/billing/`
- Frontend: `apps/dentalemon/src/features/billing/`, `routes/_dashboard/billing.tsx`, `routes/_dashboard/reports.tsx`, `routes/_portal/portal.bills.tsx`
- Spec: `specs/api/src/modules/dental-billing.tsp` · Rules: `specs/api/docs/standards/br-registry.json` · ADR: `docs/decisions/ADR-011-invoice-tax-out-of-scope-v1.md`

### Locked decisions
- **Manual entry for v1**, online card pay = future track (§7.1, revisit when a clinic asks). Adopt Stripe *practices* now (cents, idempotency, webhook ledger — already present).
- **PH-first**; tax stays 0 (ADR-011 seam clean), HMO claims only, no EDI / multi-currency until non-PH entry.

---

## 3. Phase 1 — Wire the frontend to the tested backend

No backend changes; backend unit + contract tests already cover these endpoints. Each slice =
FE unit test (RED→GREEN) + E2E Playwright path. Money formatting via existing `formatCents`
(en-PH, ₱). Error handling via existing toast + `(ref:…)` requestId pattern.

| # | Feature | Endpoint(s) (existing) | UI location | RBAC |
|---|---------|------------------------|-------------|------|
| 1.1 | Payment-plan create/manage | `POST /dental/billing/invoices/:id/plan`, `PATCH …/plan`, `GET …/plan` | finish `payment-plan-create.tsx`, add manage to `invoice-detail.tsx` | canWrite |
| 1.2 | Apply discount | `POST /dental/billing/invoices/:id/discount` | `invoice-detail.tsx` form (rate 0–100, reason) | owner only |
| 1.3 | Void / reverse payment | `POST /dental/billing/payments/:id/void` | per-payment row in `invoice-detail.tsx` (reason ≥5) | owner only |
| 1.4 | Printable receipt | `GET /dental/billing/invoices/:id/payments/:pid/receipt` | wire `payment-receipt.tsx` (80mm) | canWrite |
| 1.6 | Authoritative patient balance | `GET /dental/billing/patients/:id/balance` | replace client-side sum in patient profile / `use-patient-billing.ts` | read |

**Phase 1b — Insurance claims (full HMO cycle).** Split out because it's the largest single
item; do not gate the quick wins above behind it. Endpoints: `POST /claims`, `GET /claims/:id`,
`POST /claims/:id/lines`, `PATCH …/lines/:lid`, `PATCH …/status`, `POST …/remittance`,
`POST /estimate`. Build create-claim + line editor + remittance posting + coverage estimate
into `claims-worklist.tsx`. RBAC: dentist roles.

**Phase 1 verification:** per-slice FE test + E2E (create plan, apply discount, void payment,
print receipt, file+remit claim, balance matches endpoint). Confirm live on `:7213` / app `:3003`.

---

## 4. Phase 2 — Receivables: terms + automation + collections (net-new)

### 4.1 Payment terms (incl. per-service terms — the literal ask)
- **Schema:** add `defaultPaymentTermsDays INT` to clinic/branch billing settings; optional `paymentTermsDays INT` override on `dental_invoice`; **per-service term templates** via `paymentTermsDays` on the service/procedure catalog entry (the "payment terms for certain services" case — e.g. orthodontics gets Net-60, cleanings due on receipt).
- **Resolution order at `issueDentalInvoice`:** invoice override → max of line-item service terms → clinic default. If no `dueDate` supplied, `dueDate = issuedAt + resolvedTermsDays`. Net-0 = due on receipt.
- **New rule BR-016:** dueDate derives from terms (service/invoice/clinic precedence) at issue; terms bounded 0–365 days.
- **API:** extend org-settings + service-catalog endpoints for terms; optional `paymentTermsDays` on create/issue body (TypeSpec `dental-billing.tsp` + regen).
- **UI:** terms selector (Due on receipt / Net 15 / 30 / 60 / custom) in clinic billing settings, per-service in catalog, per-invoice override at create.

### 4.2 Auto-overdue job
- **New handler/job `markOverdueInvoices`** (pg-boss, already in stack; see notifs/queued-notifications pattern). Daily run: flip `issued|partial → overdue` where `dueDate < now AND balanceCents > 0`. Audited (`invoice.overdue`, actor = system).
- **New rule BR-017:** invoice auto-transitions to overdue past dueDate with balance>0; idempotent (no-op if already overdue/terminal).
- **Tests:** clock-aware unit test (inject now), contract n/a (internal job), E2E via seeded past-due fixture.

### 4.3 Dunning / reminders
- **New table `dental_billing_reminder_log`**: id, invoiceId, branchId, offsetDay (e.g. 0/+7/+14/+30), channel (sms/email/push), sentAt, status. Unique (invoiceId, offsetDay) = idempotency.
- **New job** runs after auto-overdue: for overdue invoices, emit reminder via **notifs module** at configured offsets; log to reminder_log; skip if already logged.
- **Channel: SMS-first for PH.** Dental patients here respond to SMS more than email; confirm the notifs module has an SMS channel/provider (add one if missing — current notifs covers email + push via OneSignal). Email/push as fallback.
- **Statement email action** (manual): `POST /dental/billing/patients/:id/statement/send`.
- **New rule BR-018:** reminders idempotent per (invoice, offset); never sent on voided/paid/uncollectible.
- **UI:** reminder cadence config in clinic billing settings; "send statement" button in collections.

### 4.4 Collections worklist
- **New endpoint `GET /dental/billing/collections/worklist`** (branch-scoped per EM-BIL-002): overdue invoices joined with patient name, daysOverdue, balance, lastContactedAt, planStatus. Reuses `billing-report.facade.ts` aging query.
- **New table `dental_collection_note`**: id, invoiceId/patientId, branchId, note, contactedAt, contactChannel, createdByMemberId. Audited.
- **New endpoint `POST /dental/billing/collections/notes`** to log a contact.
- **UI:** new "Collections" worklist tab (extends `collections-view.tsx`): sortable by daysOverdue/balance, log-call action, links to invoice + payment-plan create.

---

## 5. Phase 3 — Dashboards & statements

### 5.1 AR KPI dashboard
- **New endpoint `GET /dental/billing/collections/kpis`** (branch-scoped): DSO (days sales outstanding), collection rate (collected/billed for period), write-off total (period), outstanding AR, AR aging trend series (by month). All read-side from existing invoice/payment tables; no new persistence.
- **UI:** KPI cards + trend chart on billing dashboard / `reports.tsx`; reuse existing aging table beneath.

### 5.2 Patient statement / ledger view
- **New endpoint `GET /dental/billing/patients/:id/statement`** (single; batch already exists): statementNumber, asOf, charges, payments, discounts, balance, oldest-unpaid days, line-level history.
- **UI:** patient statement view (print + email) in patient profile billing tab; render `PatientStatement` model.

---

## 6. Phase 4 — Credit balances & refunds

### 6.1 Patient credit ledger
- **New table `dental_patient_credit`**: id, patientId, branchId, amountCents (+/-), source (overpayment | refund_reversal | manual_adjustment | applied_to_invoice), invoiceId (nullable), note, createdByMemberId, createdAt. Balance = sum(amountCents).
- **New endpoints:** `POST /dental/billing/patients/:id/credits` (add manual credit, owner-only, audited), `GET /dental/billing/patients/:id/credits` (ledger + balance), `POST /dental/billing/invoices/:id/apply-credit` (apply available credit to invoice balance).
- **New rule BR-020:** credit applied to an invoice ≤ invoice balance AND ≤ available patient credit; atomic (withTenantTx).

### 6.2 Dental refunds (distinct from same-day payment-void)
- **New endpoint `POST /dental/billing/payments/:id/refund`**: refund a succeeded (non-void) payment, amount ≤ paid; creates a refund record + adjusts invoice balance; optionally books a patient credit instead of cash-out. Owner-only, reason-required, audited.
- **New rule BR-019:** refund only on non-void payment, amount 1¢–paidAmount; invoice must not be voided; emits `payment.refunded` audit.
- **UI:** refund action distinct from void in `invoice-detail.tsx`; credit ledger view in patient profile.

---

## 7. Future tracks (specs included; build on trigger)

### 7.1 Stripe online payments (trigger: a clinic wants online card pay)
- Wire dental to existing Stripe Connect in `handlers/billing/`. Cards-on-file via Stripe **Customer + SetupIntent**; **autopay** flag on payment plan installments; **payment links** for statements; Stripe **customer portal** for self-serve.
- New: `POST /dental/billing/invoices/:id/payment-link`, `POST /dental/billing/patients/:id/payment-methods` (SetupIntent), `autopay` on `dental_payment_plan`. Webhook → reuse `recordDentalPayment` path with `method='card'` + idempotency on PaymentIntent id (extend existing `ProcessedWebhookEventRepository`).
- **Best practice:** cards-on-file autopay for installment plans is the single biggest leverage point; prefer hosted payment links over custom checkout.

### 7.2 Tax activation (trigger: VAT market / multi-tenant cloud — ADR-011 migration path)
- Add `taxRate` to `CreateDentalInvoiceRequest`/clinic settings in `dental-billing.tsp` → regen OpenAPI+types → replace hardcoded 0 in `createDentalInvoice.ts` with `taxCents = round(netAfterDiscount * taxRate)` (recompute already wired) → update handler tests + br-registry BR-010.

### 7.3 Multi-currency + US insurance (trigger: non-PH market)
- Per-branch currency + FX; PPO fee schedules; EDI 837/835 or clearinghouse adapter behind the existing claim FSM. Large; do not pre-build.

---

## 8. New business rules to register (br-registry.json)

| ID | Rule | Phase |
|----|------|-------|
| BR-016 | Invoice dueDate derives from payment terms at issue; terms 0–365 days. | 2 |
| BR-017 | Invoice auto-transitions issued/partial → overdue past dueDate with balance>0; idempotent. | 2 |
| BR-018 | Dunning reminders idempotent per (invoice, offset); never on voided/paid/uncollectible. | 2 |
| BR-019 | Refund only on non-void payment, 1¢–paidAmount, invoice not voided; audited. | 4 |
| BR-020 | Credit applied ≤ invoice balance AND ≤ available patient credit; atomic. | 4 |

---

## 9. Cross-cutting requirements (every new slice)
- **Multi-tenancy:** all new report/list endpoints branch-scope to caller's active branches when branchId omitted (EM-BIL-002 pattern via `getActiveBranchIdsForPerson`); writes route through `withTenantTx`.
- **Audit:** every money write logs true actor (`session.userId`), before/after where relevant.
- **Money integrity:** integer cents only; bounds-checked; multi-table writes atomic.
- **Spec-first:** new endpoints/models added to `dental-billing.tsp` → `bun run build` (OpenAPI+types) → `bun run generate` (routes/validators) → implement handler → SDK regen.

---

## 10. Verification (per phase)
- **Phase 1:** FE unit + E2E only (backends tested). Walk each screen live (app `:3003`, API `:7213`).
- **Phase 2:** backend unit (clock-aware overdue job, terms-at-issue, reminder idempotency) + contract (worklist, notes, statement-send) + E2E on seeded past-due fixture.
- **Phase 3:** backend unit (KPI math, single statement) + contract + FE render + E2E.
- **Phase 4:** backend unit (credit ledger math, refund bounds, apply-credit atomicity) + contract + FE + E2E.
- **Gate (all):** `bun test` + `bun run typecheck` green, contract suite green, no regressions; new BRs cited in br-registry with source + test refs.

---

## 11. Suggested execution order
1.1 → 1.4 → 1.2 → 1.3 → 1.6 (quick wins) → Phase 1b claims (largest) → 2.1 → 2.2 → 2.3 → 2.4 → 3.1 → 3.2 → 4.1 → 4.2. Future tracks (7.x) on trigger only.
