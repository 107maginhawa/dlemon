# Seed Coherence Report

---
oli-version: seed-coherence-v1
report_date: 2026-06-01
based_on:
  - docs/product/SEED_MANIFEST.md
  - docs/audits/codebase-map/CODE_API_SURFACE.json (v5)
  - docs/product/ROLE_PERMISSION_MATRIX.md
last_modified: 2026-06-01
last_modified_by: oli-check
head: a3bfc9a5
---

## 2026-06-01 re-run (--auto, HEAD a3bfc9a5) — VERDICT: SKIP

`SC-API-UNREACHABLE` (informational, NOT P0) — API still not listening (`GET /health`
http=000 on :7213/:3001/:3002; no api-ts/bun process). Persona-replay could not run;
explicit SKIP per stop_conditions, never a false PASS. Manifest non-empty (20
quantitative claims). No server booted; none left behind. Recommend
`cd services/api-ts && bun dev` (+ `bun run db:reseed`) then re-run
`/oli-check --seed-coherence`. **Counts:** P0 0 · P1 0 · P2 0 · SC-API-UNREACHABLE 1.

## 2026-05-31 re-run (this dimension run) — VERDICT: SKIP

`SC-API-UNREACHABLE` (informational, NOT P0) — the api-ts API is not listening on
`http://localhost:7213` (`GET /health` http=000; no api-ts/bun process). The
persona-replay step requires a runnable API to log in and issue GETs; it could not
run this time. Per the dimension stop_conditions this is an explicit SKIP — never a
false PASS. The manifest is non-empty (3 quantitative claims) so there is something
to verify; recommend `cd services/api-ts && bun dev` (+ `bun run db:reseed` if the
demo DB is not seeded) and re-run `/oli-check --seed-coherence`. (The check must NOT
boot a long-running server itself; this run leaves no server behind.)

**Counts this run:** SC-EMPTY-DESPITE-SEED (P0) 0 · SC-FILTER-MISMATCH (P1) 0 ·
SC-ROLE-GATE (P2) 0 · SC-API-UNREACHABLE (info) 1. Replay did not execute.

The fully-replayed PASS record below is from the earlier 2026-05-31 run (API up);
it is retained as corroborating history but does NOT substitute for a live replay
at HEAD f1b38d86.

---
## Earlier 2026-05-31 run (API up) — VERDICT: PASS — retained for history

## Run Context
- API booted: `services/api-ts` on `http://localhost:7213` (boot-smoke PASS).
- DB: `monobase` @ `::1:5432` (seeded — 84 tables, 643 persons, 20 patients).
- Primary persona: `demo@dentalemon.com` / `DemoClinic1!` (role `admin`, "Dr. Maria Reyes"),
  authenticated via `POST /auth/sign-in/email` (200, session cookie minted).
- Branch scope used for filtered list endpoints: `09f48304-4d8d-4ea4-ac96-b0abf2637fe6`
  (sole `dental_branch` row; all seed data is single-branch).

## Summary
| Metric | Count |
|---|---|
| Entities verified | 3 (+ patients corroboration) |
| PASS | 3 |
| SC-EMPTY-DESPITE-SEED (P0) | 0 |
| SC-FILTER-MISMATCH (P1) | 0 |
| SC-ROLE-GATE (P2) | 0 |
| SC-ENTITY-INTERNAL / SC-PERSONA-UNRESOLVED (P3) | 0 |

**Verdict: PASS** — every claimed entity is reachable by its primary persona.

## Replay Results (DB count vs authenticated GET)
| Entity | Manifest claim | DB count | Endpoint (with required filters) | GET status | GET count | Result |
|---|---|---|---|---|---|---|
| dental_invoice | 10 | 10 | `GET /dental/billing/invoices?branchId=<B>` | 200 | 10 | PASS |
| dental_invoice_line_item | 17 | 17 | (no user-facing list; embedded in invoice detail) | — | — | PASS (DB confirms; SC-ENTITY-INTERNAL-style — line items surface via invoice GET) |
| dental_appointment | 14 | 14 | `GET /dental/appointments?branchId=<B>&date_from=2026-05-11&date_to=2026-06-03&per_page=100` | 200 | 14 | PASS |
| patient (legacy-seed corroboration) | 20 | 20 | `GET /dental/patients?branchId=<B>` | 200 | 20 | PASS |

## Notes on endpoint filter shapes (not defects)
- `GET /dental/billing/invoices` and `GET /dental/patients` require `branchId` (400 "branchId is required" without it).
- `GET /dental/appointments` requires `branchId` + `date_from` + `date_to` (`YYYY-MM-DD`),
  with a 31-day max calendar window (V-SCH-004). Seed appointment dates span 2026-05-11..2026-06-03
  (24 days, within cap). A naive wide range (e.g. 2020..2030) is correctly rejected by the cap —
  this is intended validation, not a coherence defect. The exact-window replay returns all 14.

## What's Next
- All PASS — no remediation required. Seed coherence verified: each manifest-claimed entity
  lands in the DB and is reachable by the primary persona through its real list endpoint.
- Manifest scope is narrow by design (the supplement covers only billing + scheduling, which the
  legacy API seed left empty post-compliance-hardening). Other legacy-seed entities
  (visits, treatments, imaging, consents, Rx, reviews) are owned by `seed-demo.ts` and are
  outside this manifest's quantitative claims.
- Multi-persona replay (Ana Santos `staff_full`, etc.) is not exercised here because all manifest
  entities are admin-reachable and single-branch; role-gate divergence is therefore N/A for the
  current claims.
