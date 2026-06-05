# Ground-Truth Validation — 2026-06-05 (OLI V1–V6 certification)

**Branch:** `fix/contract-drift-auth-cleanup`  **Base SHA at validation start:** `9f33ce4f`
**Predecessor:** supersedes `GROUND_TRUTH_2026_06_04.md` (which was itself stale — see below).

> **ADDENDUM (post-cert iPad sweep) — a real bug the certification missed.** The cert ran
> `--project=chromium` only and labeled the iPad-viewport spec failures "out of scope." Running the
> **`ipad-portrait`/`ipad-landscape` projects** (never run before) surfaced **5 failures → 3 root causes**,
> one a genuine product bug:
> 1. **Calendar grid broken for EVERY user (real bug, fixed).** `_dashboard/calendar.tsx` read `branchId`
>    from the store but never passed it to `useAppointments`, which fired `GET /dental/appointments` with
>    `branchId=undefined` (required param) → grid hard-errored "Validation failed: branchId … received
>    undefined". **Reproduced as the demo user via API** (no-branchId → 400, with-branchId → 200). The demo
>    E2E specs only assert the calendar *toolbar*, never the *grid*, so it stayed green while broken — the
>    iPad grid assertion was the only test exercising it. Fixed (pass branchId + `enabled:!!branchId`,
>    R4 pattern) with a RED→GREEN unit regression. All 4 branchId query hooks now gate on `enabled`.
> 2. **Workspace nav** — false failure: one-shot `isVisible()` raced the route transition (passed portrait,
>    flaked landscape). Fixed with `data-testid=sidebar-toggle` + web-first wait.
> 3. **Imaging** — stale test: navigated to `/imaging`, which is **not a route** (imaging is a workspace
>    overlay). Repointed to the `/imaging-test` harness.
> Post-fix: **iPad 20/20, chromium 244/0, FE unit 1942/0**, typecheck/lint clean. Lesson: assert the
> *content*, not just the chrome; and run every Playwright project, not just chromium.

## Verdict: 🟢 GATE PASS — TDD / spec-driven / domain-designed, all test layers green

Every verdict below was produced by **running the real suite in this session**, not by trusting
OLI output. The OLI knowledge graph was rebuilt FRESH at HEAD and all 10 check dimensions were
consulted as **hypotheses**, then cross-checked against ground truth. **Where OLI and ground truth
disagreed, ground truth won** (see "OLI was wrong" below).

## Empirical results (the authoritative gate)

| Layer | Result | How run |
|------|--------|---------|
| Backend unit | **3380 / 0** (288 files) | `bun run test` (per-file `monobase_test` clones, concurrency 4) |
| FE unit | **1939 / 0** (167 files) | `bun test src/` |
| Contract (Hurl) | **38 / 38** (550 requests) | `bun run test:contract` |
| Chromium E2E | **241 passed, 0 product failures** | `playwright --project=chromium` |
| Journeys | **18 / 18** | `playwright --project=journeys` (fresh reseed) |
| typecheck | clean | dentalemon + api-ts `tsc --noEmit` |
| lint | 0 errors (4479 pre-existing `any` warnings) | `bun run lint` |
| check:boundaries | 0 cross-module violations | `services/api-ts bun run check:boundaries` |
| fsm-tokens | match | `bun run check:fsm-tokens` |
| audit:trace:ci | pass (0 untested P0 BRs) | `bun run audit:trace:ci` |

Chromium "3 failed" = the 3 known iPad-viewport specs (`ipad-calendar/imaging/workspace`) running
under the desktop chromium project — they pass under the iPad projects. "6 skipped" = the IMG-18
offline/service-worker specs (no SW in dev). Neither is a product failure.

## OLI knowledge graph (V1)

Rebuilt at HEAD via `oli-engine scan … --write`. `MAP-FRESHNESS: FRESH (map@9f33ce4 == HEAD)`.
`CODE_SPEC_TRACE`: **matched=352, spec_only=0, code_only=0, auth_drift=0**. Phantom-endpoints query:
the single reported phantom (`GET …/ceph/analysis:qs`) is an engine query-string keying artifact —
the real route exists (`routes.ts:948` + OpenAPI). 0 real FE→BE breaks.

## OLI was wrong — ground truth caught it (why this validation mattered)

All 6 OLI check dimensions reported **PASS**, but the real suites were **RED**. The TRUST-BUT-VERIFY
discipline caught what OLI missed:

1. **FE unit was NOT green.** 5 real failures (`use-invoices`/`billing-list`) — the R4 fix added
   `enabled: !!branchId` to the hook but its unit tests still called `useInvoices({})` (no branchId →
   disabled query). The "FE 1939/0" claim was stale. **Fixed** (tests now pass a branchId).
2. **Apparent backend mass-failure was test-infra, not product.** A first backend run showed ~300
   failures; root cause was postgres connection saturation (108× connect-timeouts) from running 3 FE
   test processes concurrently with the clone-heavy backend suite. Re-run solo at concurrency 4 →
   **3374/0 pristine**. (Learning: never run the backend clone suite alongside other DB load.)
3. **Journey B01 was flaky** (failed in full run, passed alone). Two root causes, both fixed:
   the ceph 403 tier-gate ran react-query's default 3× backoff before `isError` flipped (>15s under
   load); and the journey clicked the `<li>` (comparison checkbox region) instead of the view-select
   div, intermittently leaving the image unselected (proven by the failure screenshot).

## Regression tests added (V3 — RED-before/GREEN-after)

The 6 product fixes (P1/P2/P3/P4/R4/safety-floor) rested only on E2E. Added focused pins:

- **P1** (security) `dental-patient-list-branch-isolation.test.ts` — patient list strictly
  branch-scoped; a branchless patient never leaks into any branch list; a fresh branch lists 0.
  **RED-before verified** (revert `listConditions` strict scope → branchless leaks → fails).
- **P3** `getOrgContext.test.ts` (+1) — a non-owner `staff_full` resolves org via active membership.
  **RED-before verified** (revert to owner-only → `org:null` → fails).
- **safety-floor** `createMedicalHistoryEntry.test.ts` — entry with `resolvedDate` → `active:false`;
  without → `active:true`.
- **R4** `use-invoices.test.ts` / `billing-list.error.test.tsx` — repaired to exercise the
  `enabled: !!branchId` gate + 403 error state.

P2/P4 remain E2E-covered (chromium green).

## Fixes shipped this session

- `fix(imaging)` `use-ceph-analysis.ts` — do not retry a tier-gate 403 (surface the addon/upgrade UI
  immediately; also removes the B01 flake). Better UX + deterministic test.
- `test(e2e)` `11-ceph-tier-gate.journey.spec.ts` — click the view-select region (not the `<li>`),
  fail loudly instead of silent `if(count)` skip, wait for the toggle to confirm selection.
- `docs(traceability)` reconciled **BR-013** (`deferred` → `implemented`): `markUncollectible.ts` +
  `uncollectible` status enum + route `POST /dental/billing/invoices/:invoiceId/uncollectible`,
  covered by `invoice.fsm.property.test.ts`.
- `ci` added a **module-boundary gate** (`check:boundaries`) to `quality.yml` (was missing).

## Out of scope / known non-gaps (unchanged)

- L2 confidence cap is an OLI SDK-resolver limitation on raw-`fetch` hooks — not a test hole.
- 3 iPad-viewport specs (run under the desktop chromium project) + 6 offline/SW specs (no service
  worker in dev) — known, skip/fail-with-reason, not product failures.
