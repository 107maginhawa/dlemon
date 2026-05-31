<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-30 by /oli-check --runtime --live (executor.md) -->
<!-- updated: 2026-05-31 by /oli-check --runtime (NO --live) @ HEAD f1b38d86 -->

# Runtime Execution Report — Dentalemon

---
## 2026-05-31 run (RUNTIME dimension, NO --live) — VERDICT: SKIP (live) · tiers 1-2 PASS

`RUNTIME-LIVE: skipped (app not running)`. The api-ts server is not listening on
port 7213 (`GET /health` http=000; no api-ts/bun process). Per executor
stop_conditions the live interaction loop SKIPs — never a false PASS. Falls back to
tier-1 (plan) + tier-2 (static boot-smoke). No `ER-` produced this run (loop not
run); no app source modified (read-only). The detailed live-run record below is the
prior 2026-05-30 run, retained for history.

**Counts this run:** ER- P0 0 · P1 0 · P2 0 · P3 0 (loop not executed).

### Tier-1 — Runtime test PLAN (reference-only)
`docs/execution/RUNTIME_TEST_PLAN.md` PRESENT & CURRENT (oli-runtime-plan,
last-modified 2026-05-31, maps v5). All 8 sections present (Coverage, Load+k6,
Per-Module Budgets, DAST, Auth Matrix, Accessibility, Cross-Layer Walker, Next).
PERFORMANCE.md (required input) present. pg-boss background-job throughput is a
planned load dimension. No regeneration needed; no edits made (TEMPLATES-only artifact).

### Tier-2 — Static boot-smoke (no long-running server left behind) — PASS
- **V-DG-001 cron wiring (static):** `registerRetentionJobs(jobs)` in `initializeApp`
  (`services/api-ts/src/app.ts:574`, import :26); job `retention.enforcement` at cron
  `30 3 * * *`, DRY-RUN default (`handlers/retention/jobs/index.ts:19`).
- **Retention job unit suite GREEN** vs `monobase_test` (db-guard correctly refused the
  demo DB): `3 pass / 0 fail` — confirms 03:30-daily registration + clean dry-run handler.
- **Prior manual boot-smoke (in RUNTIME_TEST_PLAN.md, 2026-05-31):** api-ts bound
  `0.0.0.0:7213`, scheduler started (9 jobs), no console-error/fatal/unhandled-rejection
  at startup; `/livez` 200, sign-in 200, unauth `/dental/branches` → 401. `/readyz` 503 =
  degraded optional-dep (MinIO/Valkey), NOT a boot crash.
- **Caller corroboration:** V-DG-001 manually boot-smoked — registers with pg-boss,
  scheduler healthy, clean shutdown, end-to-end dry-run actioned 0 records. Consistent.

No boot crash / startup console-error in any tier-2 signal → boot-smoke PASS.

### What's Next (live)
Start api-ts (`bun dev`, :7213) + the app, then re-run `/oli-check --runtime --live`
to execute the committed Playwright loop over the v5 route map (the only path that can
surface `ER-` dead-nav / 401-false-empty / infinite-skeleton / `/undefined` / UUID-cell).

---
## 2026-05-30 run (live) — retained for history below

**VERDICT: PASS (after fix)** — the loop originally **BLOCKed** on 2 × P1 `ER-` findings (recalls + plans 401), the bug was fixed, and a re-run is now **green** (36 pass, 0 P0/P1, 1 benign P3 skip). Full caught → fix → green cycle.

## Caught → fix → green

| Run | Verdict | Findings |
|-----|---------|----------|
| Pre-fix | **BLOCK** | P1 Recalls 401 `…/recalls`; P1 Plans 401 `…/treatment-plans` (+ bonus `/sync-logs` 401) |
| Post-fix | **PASS** | 36 pass · 0 P0/P1 · 1 P3 (unresolved `$imageId` param — benign) |

**Fix:** added `credentials: 'include'` to the recalls/treatment-plans/sync-logs fetches (`features/workspace/hooks/use-recalls.ts`, `use-treatment-plans.ts`, `use-sync-status.ts`) so the cross-origin (:3003→:7213) session cookie rides along, and added an `isError` branch to `recalls-sheet.tsx` / `treatment-plans-sheet.tsx` so a future failure shows an error state instead of a false "No recalls yet."

---

## Original finding (pre-fix, for the record)

**The runtime loop drove a real browser over the knowledge-graph matrix and caught the recalls/plans bug that every static dimension (engine v4, journeys, enforcement, boot-smoke) missed.**

## Run

| | |
|---|---|
| Runner | `apps/dentalemon/tests/e2e/oli-runtime-loop.spec.ts` (data-driven, committed) |
| Maps | `docs/audits/codebase-map/` (contract v5) |
| Targets | 37 (17 page-load, 17 nav-links, 2 data-surface, 1 skipped) |
| Result | 34 pass · 3 fail (2 × P1, 1 × P3 benign) · wall ~16s |
| Auth | demo org sign-in (existing patient "Juan dela Cruz") via the auth adapter |

## Findings (`ER-`)

| Severity | Kind | Route | Detail |
|---|---|---|---|
| **P1** | data-surface | `/_workspace/$patientId` | **Recalls**: surface request failed — `401 …/dental/patients/<id>/recalls` (and `401 …/dental/sync-logs`) |
| **P1** | data-surface | `/_workspace/$patientId` | **Plans**: surface request failed — `401 …/dental/patients/<id>/treatment-plans` (and `401 …/dental/sync-logs`) |
| P3 | skip | `/imaging-ceph-report/$imageId` | unresolved param (no fixture) — benign |

**Root cause:** the recalls/plans (and sync-logs) hooks call raw `fetch` with no `credentials:'include'`, bypassing the SDK (`packages/sdk-ts/src/client.ts:75`). Cross-origin (:3003→:7213) → cookie not sent → **401** → hook throws → React Query `isError` → the sheets key only off `isLoading`, never `isError` → user sees a false "No recalls yet." empty state. Verified at the API: `GET …/recalls` returns 200 with cookie, **401 without**.

**Responsible files:** `apps/dentalemon/src/features/workspace/hooks/use-recalls.ts:47`, `use-treatment-plans.ts:55`, `recalls-sheet.tsx`, `treatment-plans-sheet.tsx`.

## Why static missed it (the leak this closes)

- engine v4 `loading_state_hygiene`: `violation:false` — matched `<Skeleton>` tags only, missed `<p>Loading…</p>` text. (**Fixed in v5** — now `violation:true`.)
- `api_calls` 0/151: fetch lives in the hook; never traced statically → cross-layer "declared call fires" walker has nothing.
- sheet has no `isError` branch → on 401: no console JS error, no pageerror, no infinite spinner → boot-smoke + journeys (static) all PASS.
- **Only a live click + 4xx-inclusive network capture catches it** — which is this loop.

## Cover-all status

Now caught at two layers: **static** (engine v5 loading-hygiene violation, cheap, no run) + **runtime** (this loop, confirms the actual 401). The sidebar showed no runtime defect in this build (all nav links resolved, no throw) — reported honestly, no false positive.

## Next
Fix: add `credentials: 'include'` to the recalls/plans/sync-logs fetches (or route them through `@monobase/sdk-ts`) + add an `isError` branch to the sheets. Re-run `/oli-check --runtime --live` → expect `ER-` clear → PASS.
