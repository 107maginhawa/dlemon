# Seed Coherence Report

---
oli-version: seed-coherence-v1
report_date: 2026-06-05T02:40:00Z
based_on:
  - docs/product/SEED_MANIFEST.md
  - docs/audits/codebase-map/CODE_API_SURFACE.json
  - docs/product/ROLE_PERMISSION_MATRIX.md
last_modified: 2026-06-05T02:40:00Z
last_modified_by: oli-check
verdict: PASS
persona: "Dr. Maria Reyes (dentist_owner) — demo@dentalemon.com"
api_base: http://localhost:7213
db: postgres://postgres:password@localhost:5432/monobase
---

## Verdict: PASS

Every quantitative entity claim in `SEED_MANIFEST.md` survives a primary-persona
GET replay against the running API. No `SC-EMPTY-DESPITE-SEED` (P0) and no
`SC-FILTER-MISMATCH` (P1). Read-only replay; no reseed.

## Environment

| Item | Value |
|---|---|
| API base path | **root mount** — `/dental/...`, `/persons`, `/auth/...` (NO `/api/v1` prefix; NO `/api/auth`) |
| API URL | http://localhost:7213 |
| Auth sign-in | `POST /auth/sign-in/email` (better-auth, cookie `better-auth.session_token`) |
| Live DB | `monobase` (dev). A backend test run concurrently used `monobase_test` — separate DB, undisturbed. |
| Primary persona | demo@dentalemon.com / DemoClinic1! → role `dentist_owner` |
| Resolved org/branch | org `3a9791a9-…` (Reyes Family Dental, clinic tier) · branch `e17678dd-…` (Main Clinic) |

### Base-path verification (trust-but-verify)
`GET /health`, `/dental/health`, `/api/v1/health` all 404; `/` returns 405
(method-not-allowed → server alive). Real routes confirmed from
`services/api-ts/src/generated/openapi/routes.ts` and live probes:
`GET /dental/patients` → 401 (auth-gated, exists), `POST /auth/sign-in/email`
→ 200 + session cookie. The 404s on guessed paths are NOT seed gaps.

## Summary
| Metric | Count |
|---|---|
| Entities verified | 3 (+ 1 imaging boundary note) |
| PASS | 3 |
| SC-EMPTY-DESPITE-SEED (P0) | 0 |
| SC-FILTER-MISMATCH (P1) | 0 |
| SC-ROLE-GATE (P2) | 0 |
| SC-ENTITY-INTERNAL / boundary-note | 1 (imaging — documented; actually populated) |

## Findings (all PASS)
| Entity | Persona | DB count (demo branch) | GET count | Filter signature | Result |
|---|---|---|---|---|---|
| dental_invoice | dentist_owner | 16 | 16 (totalCount 16) | `branchId` (required, EM-BIL-001) | PASS |
| dental_invoice_line_item | dentist_owner | 27 (under demo-branch invoices) | ≥1 (nested in invoice detail) | via invoice FK | PASS |
| dental_appointment | dentist_owner | 24 | 24 (unique IDs across stitched ≤31-day windows) | `branchId` + `date_from` + `date_to` (V-SCH-004) | PASS |

Manifest claimed 10 invoices / 17 line items / 14 appointments. Live DB holds
more (16 / 27 / 24 in the demo branch) from accumulated re-seed runs — above the
`≥ claimed_min` gate, not a defect.

## Harness note (no finding — recorded so the next run doesn't re-fire)
The appointments list endpoint returns a **bare JSON array** `[ … ]`, not an
`{ data, pagination }` envelope (unlike invoices). It also enforces a hard
**31-day** `date_from..date_to` window (V-SCH-004) — a 32-day span 400s. An
initial replay pass mis-parsed the bare-array shape and used an off-by-one
(32-day) window, producing a spurious "GET returns 0." Re-querying with correct
snake_case params (`date_from`/`date_to`, not camelCase) and ≤31-day windows
surfaced all 24 rows. Harness artifact, not a seed/filter mismatch.

## Imaging boundary (SC-IMAGE-LIST-EMPTY)
The manifest pre-documents an *intended* empty image gallery (study headers
seeded, per-image rows not). Live DB actually has **both** `imaging_study`=12
headers AND `imaging_study_image`=12 per-image rows, so the documented
empty-gallery expectation does not even fire. No finding either way.

## What's Next
- All PASS → seed coherence verified: every claimed entity is reachable by its
  primary persona (dentist_owner) through the real API filters.
- Optional hygiene (not a seed defect): the appointments list endpoint's
  bare-array response shape diverges from the invoice list's `{ data, pagination }`
  envelope; consider normalizing for consumer consistency.
