# Billing — Execution Sequence & Status (Phases 1–4)

Living tracker for the billing roadmap. **Full specs live in
[BILLING_ROADMAP_AND_SPECS.md](./BILLING_ROADMAP_AND_SPECS.md)** — this file is
the *recommended order + current status*, not a re-spec. Update the Status
column as slices land. Branch: `chore/kg-refresh-br-p0-coverage` (Vertical TDD,
one slice per commit).

Last updated: 2026-06-19.

---

## Status at a glance

| Phase | Slice | Status | Commit / note |
|------|------|--------|----------------|
| 1 | 1.1 payment plans · 1.2 discount · 1.3 void · 1.4 receipt | ✅ done | pre-existing + verified |
| 1 | 1.6 authoritative patient balance | ✅ done | `77e43533` |
| 1b | A file claim · B detail+lines · C line editor · D coverage estimate | ✅ done | `17476d1c` `fc8fd2d1` `cb69f6c9` `36d5eae7` (+ polish `a77e867d`) |
| 2.1 | a backend (terms→dueDate, BR-048) · b clinic-default settings FE | ✅ done | `c05b74a5` `5468dda0` |
| 2.2 | auto-overdue sweep + audit (BR-049) | ✅ done | `13f2e0d5` |
| 2.1 | FE back-fill: per-service catalog terms · per-invoice override at create | ⬜ deferred | backend already supports both |
| 2.3 | a dunning reminder engine (job + reminder_log, BR-050) | ✅ done | `6e78fa26` |
| 2.3 | b manual statement/send endpoint + cadence config panel + send button FE | ✅ done | `pending-commit` |
| 2.4 | a backend: worklist GET + collection-note POST (audited, BR-051) | ✅ done | `(prev commit)` |
| 2.4 | b FE: collections worklist tab + log-call action | ✅ done | `pending-commit` |
| 3.1 | AR KPI dashboard | ⬜ pending | |
| 3.2 | patient statement / ledger | ⬜ pending | |
| 4.1 | patient credit ledger | ⬜ pending | |
| 4.2 | dental refunds | ⬜ pending | |
| 7.x | Stripe online pay · tax activation · multi-currency/EDI | ⏸ trigger-only | build on demand, not scheduled |

---

## Recommended sequence (remaining work)

Ordered by leverage × dependency. Each is a full Vertical-TDD slice (TypeSpec →
backend tests → backend → contract → FE tests → FE → E2E → gate). `bun test` +
`bun run typecheck` + contract suite green, BR cited in `br-registry.json`.

### 1. Phase 2.3 — Dunning / reminders  ·  **BR-050**
- **Why first:** highest leverage in Phase 2 — automated reminders recover money
  with zero staff effort, and it builds directly on 2.2's overdue flag.
- **Depends on:** 2.2 ✅ (overdue invoices) · notifs module.
- **New persistence:** `dental_billing_reminder_log` (id, invoiceId, branchId,
  offsetDay, channel, sentAt, status); **unique `(invoiceId, offsetDay)`** = idempotency.
- **Channel:** **SMS deferred → email + push** (decision 2026-06-19). The notifs
  `'sms'` enum exists but delivery is a no-op ("no provider configured"); wire a
  provider (Semaphore PH-local recommended) only when a clinic asks.
- **Job:** runs after the auto-overdue sweep; for overdue invoices emit a reminder
  via notifs at configured offsets; log to reminder_log; skip if already logged;
  never on voided/paid/uncollectible.
- **Manual:** `POST /dental/billing/patients/:id/statement/send`; "send statement"
  button drops into the existing `collections-view.tsx`.
- **UI:** reminder-cadence config panel in clinic billing settings (mirror the
  Payment Terms panel idiom).
- **Verify:** clock-aware idempotency unit test (same invoice+offset → one row) +
  contract (statement/send) + E2E on a seeded past-due fixture.

### 2. Phase 2.4 — Collections worklist
- **Why next:** turns the now-flagged overdue invoices into an actionable human
  surface; reuses the aging facade; enriches the same `collections-view.tsx`
  where 2.3's manual actions live.
- **Depends on:** 2.2 ✅; pairs with 2.3.
- **New persistence:** `dental_collection_note` (id, invoiceId/patientId, branchId,
  note, contactedAt, contactChannel, createdByMemberId) — **audited**.
- **Endpoints:** `GET /dental/billing/collections/worklist` (branch-scoped per
  EM-BIL-002, `getActiveBranchIdsForPerson`) · `POST /dental/billing/collections/notes`.
- **UI:** "Collections" worklist tab extending `collections-view.tsx` — sortable
  by daysOverdue/balance, log-call action, links to invoice + payment-plan create.

### 3. Phase 3.1 — AR KPI dashboard
- **Why:** read-only analytics, low risk, no new tables; immediate management value.
- **Endpoint:** `GET /dental/billing/collections/kpis` (branch-scoped): DSO,
  collection rate, write-off total, outstanding AR, aging-trend series.
- **UI:** KPI cards + trend chart on the billing dashboard / `reports.tsx`.

### 4. Phase 3.2 — Patient statement / ledger
- **Why:** read-only, patient-facing; the single-statement counterpart to the
  existing batch endpoint.
- **Endpoint:** `GET /dental/billing/patients/:id/statement`.
- **UI:** statement view (print + email) in the patient profile billing tab.

### 5. Phase 4.1 — Patient credit ledger  ·  **BR-051**
- **Why before 4.2:** refunds can be *booked as a credit*, so the ledger is a
  prerequisite for the refund-to-credit path.
- **New persistence:** `dental_patient_credit` (amountCents ±, source, invoiceId?,
  note, …); balance = sum(amountCents).
- **Endpoints:** `POST/GET /patients/:id/credits` · `POST /invoices/:id/apply-credit`.
- **BR-051:** applied credit ≤ invoice balance **AND** ≤ available patient credit;
  atomic (`withTenantTx`).

### 6. Phase 4.2 — Dental refunds  ·  **BR-052**
- **Depends on:** 4.1 (refund may book a credit instead of cash-out).
- **Endpoint:** `POST /dental/billing/payments/:id/refund` (distinct from same-day
  void); creates a refund record + adjusts invoice balance; owner-only,
  reason-required, audited.
- **BR-052:** refund only on a non-void payment, amount 1¢–paidAmount, invoice not
  voided; emits `payment.refunded`.

### Optional, any time — Phase 2.1 FE back-fill
Small, independent, completes the payment-terms UI (backend already supports both):
per-service `paymentTermsDays` editor in the fee-schedule/catalog UI, and a
per-invoice override picker at invoice create. Slot in as a quick win between
larger slices.

---

## Corrections vs the roadmap (read before allocating IDs)

- **BR numbering drift.** Roadmap §8 proposes BR-016/017/018/019/020, but
  **BR-016/017/018 are already taken** (branch access, prescriber, lab orders) and
  the registry ceiling is **BR-049**. Allocate forward: terms = **BR-048** (done),
  overdue = **BR-049** (done), dunning = **BR-050**, credit = **BR-051**, refund =
  **BR-052**. Check the ceiling again before each new rule.
- **SMS is deferred** (2026-06-19 decision): ship dunning on email + push; leave the
  notifs `'sms'` no-op; add a provider (Semaphore PH-local) on a clinic request.
- **`collections-view.tsx` already exists** — both 2.3 (send-statement button) and
  2.4 (worklist) extend it, not greenfield.
- **pg-boss is already in the stack** (`^10.3.2`); Phase 2 jobs reuse the existing
  `JobScheduler` (`core/jobs.ts`) — no new dependency.

---

## Per-slice gate (every item)
1. `cd services/api-ts && bunx tsc --noEmit` → 0  ·  `bun run --filter dentalemon typecheck` → 0
2. Backend tests **via the cloning runner** (per-file isolation):
   `DATABASE_URL=postgresql://postgres:password@localhost:5432/monobase_test bun run scripts/test-with-db.ts <FILE> <FILE> …`
   (never inline `bun test`, never a directory arg — both pollute the shared template).
3. `bunx bun test <file>` for FE specs (apps/dentalemon).
4. Contract suite green (restart `:7213` first if a stale server masks drift).
5. `bun run check:font-size` (baseline) + dentalemon lint ≤ 200 warnings.
6. New BR in `br-registry.json` with `source` + `test` refs.
