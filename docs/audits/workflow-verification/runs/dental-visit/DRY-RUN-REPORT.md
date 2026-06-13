# Dry-Run Report — dental-visit (mandatory pre-loop gate)

**Mode:** report-only (autofix disabled), single module, manual drive via `/browse` (Chromium).
**Date:** 2026-06-08 · **Persona:** Alex / Dr. Maria Reyes (`dentist_owner`).
**Purpose:** validate the PROMPT.md harness end-to-end on one module before authorizing the full
18-module sweep. This is NOT a fix run.

## Environment (how the stack was brought up)

Docker was DOWN, so `bun run infra:up` was not used. Instead:
- Native Postgres already running on `:5432` with the `monobase` DB migrated + seeded (9 memberships) — used directly (`DATABASE_URL=postgres://postgres:password@localhost:5432/monobase`).
- API booted: `cd services/api-ts && bun src/index.ts` → `http://localhost:7213`. `/livez` = 200; `/readyz` = 503 on **storage only** (MinIO down) — `database` + `jobs` pass, so visit/chart/treatment flows are unaffected.
- App booted: `cd apps/dentalemon && bun dev` → `http://localhost:3003`.
- Login: demo@dentalemon.com / DemoClinic1! / PIN 123456 / profile "Dr. Maria Reyes".

> Note for the automated sweep: when Docker is unavailable, the orchestrator must detect a usable
> local Postgres and tolerate `/readyz` storage=fail for non-imaging modules (imaging needs MinIO).

## Journey driven (workspace §23 E2E, patient: Maria Santos)

| # | Step / assertion | Result | Evidence |
|---|---|---|---|
| 1 | Workspace opens; latest visit auto-selected (focal, centered) | ✅ PASS | 01-workspace-active-visit.png |
| 2 | Full FDI odontogram renders; Baseline/Proposed/Completed layers; tooth #24 highlighted matching its 2 treatments | ✅ PASS | 01 |
| 3 | Click tooth #24 → right panel opens with **1 Overview → 2 Treatment → 3 Review** stepper + surface selector (M/D/B/L/O) + condition picker + entry classification (Existing vs New finding) | ✅ PASS | 02-tooth-panel-overview.png |
| 4 | **Affordance oracle:** Rx, Consent, Notes/Medical-History, Attachments, Treatment Plan, Complete visit, Compare, +New Visit, year filter, Imaging/Perio/Recalls/Plans tabs, Baseline/Proposed/Completed toggles — all reachable | ✅ PASS | 01 |
| 5 | **Coherence oracle:** breakdown ₱800 + ₱3,500 = **₱4,300 Grand Total**; "2 pending"; "Continue to Payment (2)" — all consistent with the 2 rendered rows | ✅ PASS | 01 |
| 6 | **Cross-workflow / historical state:** switch to prior visit → shows THAT visit's snapshot (tooth 24 "Desensitizing treatment K03.1 **Performed**" + "Periapical X-ray **Performed**"), NOT the active visit's diagnosed Amalgam/₱4,300. Completed-visit-only "Share PMD" affordance appears. | ✅ PASS | 03-prior-visit-historical.png |
| 7 | RBAC negative (staff read-only chart) | ⚠️ NOT DRIVEN | see below |

## Findings

**No real bugs found.** dental-visit behaves per the workspace reference spec (§23 journey, §26 ACs).
This re-confirms the prior static audit verdict (dental-visit READY) and, more importantly,
validates that the PROMPT harness drives the live FE and evaluates the coherence/affordance/
cross-workflow oracles correctly.

**Observations (not bugs):**
- Clicking a tooth on an *inactive* (peeking) carousel card correctly does nothing — the tooth
  panel only opens on the active card (matches MODULE_SPEC §12). Visit switching works via the
  Swiper (swipe / `slidePrev` / keyboard), which is the documented primary interaction (§11).
- The `[RuntimeConfig] Failed to fetch runtime config` warning and the OneSignal `AppID doesn't
  match` error are benign/expected in local dev (no prod OneSignal app) — confirmed against prior
  notes; neither blocks any workflow.

**RBAC negative not driven (best-effort, per plan):** the staff profile (Ana Santos, `staff_full`)
requires its own PIN to drive, which is not in the demo seed knowledge (only the owner PIN 123456
is known). Per the "PIN-kiosk RBAC drives are best-effort" guardrail, this is **reported, not a
blocker**. The automated sweep should source staff PINs from the seed script
(`scripts/seed-demo.ts`) so RBAC negatives can be driven.

## Gate verdict

🟢 **DRY-RUN GREEN.** The harness resolves artifacts, boots the stack, drives the §23 journey, and
evaluates the coherence + affordance + historical-snapshot oracles — all without auto-committing.
The full 18-module sweep is authorized (subject to the env note above re: Docker/MinIO and the
staff-PIN note re: RBAC negatives).

## Harness improvements surfaced by this dry run (feed back into PROMPT.md)

1. **Docker-down fallback:** detect a usable local Postgres and tolerate `/readyz` storage=fail for
   non-imaging modules; only hard-require MinIO for dental-imaging.
2. **Evidence path scoping:** the `/browse` daemon scopes screenshots to `/tmp` or its start-cwd —
   capture to `/tmp` then copy into `runs/{M}/` (a naive relative path silently fails).
3. **Staff PINs for RBAC negatives:** read non-owner PINs from `scripts/seed-demo.ts` up front.
