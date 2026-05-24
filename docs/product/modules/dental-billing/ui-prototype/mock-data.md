# Mock Data — dental-billing
<!-- oli: v3-dentalemon | dental-billing | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

**Sample invoices:**
1. `INV-2026-0184` — Priya Patel — Issued 2026-04-12 — Crown #16 (D2740 $1,100) + Exam (D0150 $50 - $50 insurance discount) — Total $1,100 — Paid $1,100 (one card payment 2026-04-12) — `paid` (no longer voidable per BR-011).
2. `INV-2026-0207` — Marco Silva — Issued 2026-04-22 — Bridge #14-15-16 ($2,400) — Total $2,400 — Paid $1,200 (payment plan: 3/6 monthly installments paid, 3 upcoming, plan started 2026-05-01) — `issued` (outstanding, lemon-highlighted row).
3. `INV-2026-0211` — Aisha Khan — Issued 2026-03-15, Due 2026-04-15 — Composite #21 mesial ($150) — Total $150 — Paid $0 — `overdue` (39 days overdue, red chip).
4. `INV-DRAFT-0042` — Tom Becker — Draft (created today) — Filling #36 occlusal ($200) — Total $200 — Paid $0 — `draft` (editable, awaiting `Issue Invoice`).
5. `INV-2026-0098` — Hannah Owens — Issued 2026-02-01 — Cleaning ($120) — Voided 2026-02-03 — Reason: "Wrong patient — entered Jordan Reyes by mistake; corrected invoice issued under INV-2026-0099." — `void`.

**Sample payment plan (INV-2026-0207):**
- #1 — Due 2026-05-01 — $400.00 — Paid ✓ (2026-05-01, bank transfer, ref: WT-8821)
- #2 — Due 2026-06-01 — $400.00 — Paid ✓ (2026-06-01, card, ref: ****4421)
- #3 — Due 2026-07-01 — $400.00 — Paid ✓ (2026-07-02, card, ref: ****4421)
- #4 — Due 2026-08-01 — $400.00 — Upcoming
- #5 — Due 2026-09-01 — $400.00 — Upcoming
- #6 — Due 2026-10-01 — $400.00 — Upcoming

**Sample patient statement (Marco Silva, 6 months):**
- Period: 2025-11-24 to 2026-05-24
- Total Billed: $2,750.00
- Total Paid: $1,550.00
- Outstanding: $1,200.00 (lemon highlight)
- Invoices: INV-2026-0207 ($2,400), INV-2025-0312 ($350, paid)
- Payments: 4 entries (2 plan, 1 lump, 1 cash for old invoice)

**BR-011 demo scenario:** attempt to void INV-2026-0184 (paid) — trigger button disabled, tooltip explains rule.

**BR-012 demo scenario:** attempt to record $1,500 payment on INV-2026-0211 (balance $150) — inline error, Confirm disabled.

**BR-009 demo scenario:** open Create Invoice for patient with only `planned` treatments — empty state blocks creation.
