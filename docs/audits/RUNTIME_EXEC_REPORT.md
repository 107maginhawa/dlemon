<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-30 by /oli-check --runtime --live (executor.md) -->

# Runtime Execution Report — Dentalemon

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
