# Seed Data Manifest

---
oli-version: "1.0"
based-on:
  - services/api-ts/src/handlers/dental-billing/repos/*.schema.ts
  - services/api-ts/src/handlers/dental-scheduling/repos/*.schema.ts
  - scripts/seed-demo.ts (clinical base data)
generated: 2026-05-30
mode: demo
format: drizzle (DB-direct)
seed-file: services/api-ts/scripts/seed-supplement.ts
---

## Stack Detection
- ORM: Drizzle · DB: PostgreSQL · Framework: Hono (api-ts) · Seed format: TypeScript

## Why a supplemental seed
The comprehensive legacy seed (`scripts/seed-demo.ts`) builds data via the **API**. After the
compliance hardening, its **invoice** and **appointment** calls fail validation/authz (e.g.
invoices require performed treatments; appointment payload validation) — so billing + calendar
came up empty. `seed-supplement.ts` fills those two gaps **DB-direct** (Drizzle inserts that
bypass the API), referencing the patients/visits/branch/membership the legacy seed already created.

## Layering
1. `reset-db.ts` — clear patient data.
2. `seed-demo.ts` (API) — auth account (demo@dentalemon.com, admin) + org + branch + memberships
   (Dr. Reyes dentist_owner PIN 123456, Ana Santos staff_full PIN 654321) + 20 patients, 10 visits,
   18 treatments, 9 imaging studies, reviews.
3. `seed-supplement.ts` (DB-direct) — invoices + appointments (this manifest).

Wired into `bun run db:reseed` (runs all three in order).

## Entity Inventory (supplement)

| Entity | Records | Statuses | Source | Confidence |
|--------|---------|----------|--------|------------|
| dental_invoice | 10 | paid ×3, partial ×2, overdue ×2, issued ×2, draft ×1 | schema (`dental_invoice_status`) | spec |
| dental_invoice_line_item | 17 | — (1–3 per invoice, `amountCents ≥ 1` per V-BIL-010) | schema | spec |
| dental_appointment | 14 | scheduled ×7 (incl. today + walk-in), checked_in ×1, completed ×3, cancelled ×1, no_show ×2 | schema (`appointment_status`) | spec |

## Data rules honored
- FK-faithful: every invoice/appointment references a real existing patient + branch (+ visit, + provider membership) queried at runtime.
- Idempotent: deterministic invoiceNumber (`INV-S00xx`) + deterministic UUIDs + `.onConflictDoNothing()` — safe to re-run.
- Dates relative to now (today/±offsets), never hardcoded.
- Money in centavos with coherent paid/balance per status.

## Coverage / gaps
- Covered: billing-status spread + appointment-status spread for calendar/billing demo.
- Not covered here (legacy seed owns them): patients, visits, treatments, imaging, consents, Rx, reviews, lab orders.
- Future: a full `/oli-plan-seed` regeneration could replace the legacy API seed with one coherent DB-direct seed; deferred (legacy clinical scenarios are rich and working).

## Imaging seed boundary (by design)

The legacy seed creates **imaging study HEADERS only** — `dental_imaging_study`
(~9–10 rows). It does **NOT** seed the per-image rows
(`imaging_study_image` / `dental_attachment`). This is intentional: the demo needs
study metadata to exist (so the imaging study list and study-header references are
populated) without shipping or generating binary X-ray/photo assets.

Consequence — **expected, not a bug**: the patient image gallery and
`GET /dental/patients/{id}/images` return an **empty list** for seeded patients,
because there are no per-image rows. The study headers exist; the images under them
do not.

This documents the recurring seed-coherence finding **SC-IMAGE-LIST-EMPTY** (P2) as a
**known, intended expectation** rather than a defect. If a future demo needs visible
gallery thumbnails, seed `imaging_study_image` rows pointing at sample assets
(MinIO/S3) under the existing study headers — but that is out of scope for the
current asset-free demo seed.

## What's next
- `bun run db:reseed` reproduces the full demo (clinical + billing + calendar).
- Run `/oli-check --confidence` if validating test confidence against seed scenarios.
