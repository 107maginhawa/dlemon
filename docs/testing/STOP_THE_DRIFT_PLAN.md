# Stop the Drift — make the real assembled stack the source of truth

> **Status tracker (committed on purpose).** This file is the durable, openable status of
> the multi-PR effort to stop "app broken for users while CI is green." Update the checkboxes
> as plans land. Pause → resume from the first unchecked box. Recorded 2026-06-14.
>
> **✅ COMPLETE (2026-06-15).** All plans shipped: Phase 0 → E → B (slices 1+2) → stability
> budget **banked 20/20** → C (armed lock) → D (drift gate, now a required check) → F (de-mask).
> The target class is now a loud, blocking failure. Re-dispatch *Journey Stability Budget*
> (`gh workflow run journey-stability.yml -f runs=20`) to re-prove stability after large
> journey changes.

**Goal:** Convert "the app is broken for users while CI is green" from an undetectable class
into a loud, blocking failure — by measuring reality, fixing what's red, then making a small,
ruthlessly-stable real-stack smoke the gate every change must pass.

## Why (the honest framing)
The base is good (4,373 green backend tests, clean spec-first architecture, working RLS
isolation, a real-stack journey harness that already exists and is blocking). The failure is in
the **seams and process**, not the foundation. The truth-telling layer (real-stack journeys) has
been muzzled: the broad E2E job is `continue-on-error`; the blocking journeys click critical
buttons only `if (enabled)` and **silently skip** when broken; green unit checks were trusted
instead. Two structural drift sources: **code-ahead-of-DB is now fatal** (RLS runs writes as
`app_rls`; a DB missing migration 0104's grants → `permission denied` on ~35 handlers), and
**no local consistency check** lets dev boxes rot.

**Honest limit:** this catches "fundamentally broken for users" + "code/DB drift." NOT every
edge case, perf, security, or data-correctness bug. Coverage converges; it is never complete.

## Governance (anti-drift)
1. **The plan secures itself** — the blocking real-stack smoke (Plan C) IS the anti-drift lock.
   Reach it fast; after it, no critical-flow regression can ship green again.
2. **One plan, one PR, one merge — never parallel.** Each plan lands fully (green CI, merged)
   before the next starts.
3. **Committed tracker, not memory** — this file.
4. **Every plan ships working software.** Stopping at any boundary leaves things better.

## Progress

### Phase 0 — DISCOVERY GATE: measure reality on `main` (blocks everything else) ✅ DONE
- [x] Rebuild a consistent stack from zero (wiped `monobase`, migrated 0000→0107, reseeded
      clean — seed exit 0, ZERO RLS errors; api-ts + FE + MinIO all healthy).
- [x] Drove the critical flows through the real browser. **Verdict: `main` is HEALTHY** —
      New Visit `POST /dental/visits → 201`; login/PIN/patients/workspace/chart/billing/calendar
      all work. The live "can't add New Visit" was **environmental drift** (stale API process +
      DB behind), not a code bug.
- [x] Wrote `docs/audits/REAL_STACK_AUDIT.md`.
- [x] Triaged the must-never-break set with the user → the curated money/clinical core: New Visit,
      record finding, create invoice, record payment, create appointment, check-in (hard-asserted
      across the journey harness). **No P0s — `main` was healthy; the live breakage was
      environmental drift.** Effort shifted to Plan B/C/D/E/F.

### Plan A — Fix what Phase 0 found red (gated on the audit) — TDD per defect ✅ N/A
- [x] **Nothing red to fix.** Phase 0 found no broken critical flow (the incident was environment
      drift, not a code defect), so Plan A had no defects to author — by design, not omission.

### Plan B — Harden + de-flake the critical-path journeys (the heart)
- [x] **Slice 1 — New Visit (the literal incident).** Killed J01's `if (count && isEnabled)`
      silent-skip → hard invariant assert (New Visit renders + is correctly gated DISABLED while
      Juan has an open visit). Added **J21** (`21-new-visit-create.journey.spec.ts`): registers a
      throwaway patient (deterministic, seed-independent — the demo seed gives every patient an
      open visit, and Diego's draft carries a non-discardable signed consent), then hard-asserts
      New Visit **ENABLED → click → `POST /dental/visits` 201 → button flips DISABLED →
      independent-read exactly 1 open visit**. Wired into the harness roster. Verified live: full
      harness 20/21 PASS (J21 green; the 1 ERROR was a pre-existing ceph flake B02, green on
      retry). This runs in the already-required **Journey Harness** check.
- [x] **Slice 2 — sweep the remaining probe-and-skip guards across J02–J20.** Audited all 19.
      Finding (evidence, not assumption): the suite was already in far better shape than feared —
      J02–J20 overwhelmingly **throw on failure** (→ ERROR → harness exit 1) and terminate in a hard
      `if (goalState) recordPass else throw`; the J01-class *silent-skip-and-still-pass* was essentially
      unique to J01 (fixed in slice 1). The legitimately-optional guards (close a slideout, click New
      Visit only when an open visit isn't already present, sign a note only if still editable) were left
      intact — killing them would add flakiness, not catch bugs. **One genuine silent-skip-of-core
      survived and is now closed: J03 (perio).** It started the perio exam only `if (startBtn.count())`;
      proved live that a leftover chart on a non-reseeded DB hides the "Start perio exam" button → the
      start flow (@AC-PERIO-01) was silently skipped while the journey passed on the stale chart.
      Hardened to: **hard-assert "Start perio exam" renders → click → assert `POST /dental/perio-charts`
      → 2xx**. Verified non-vacuous (it now fails loudly on a dirty DB; the old gate passed silently).
- [x] **Flakiness root-cause fix — de-flake the ceph journeys (B02 + B03 image-selection).** Both
      clicked the `<li>` centre (the `onSelectImage` handler is on an inner div, not the `<li>`, so the
      click could miss → viewer empty → ceph panel never mounts) and then used a one-shot
      `cephToggle.count()` that raced the mount — the green-on-retry flake. Fixed to mirror B01's already-
      landed pattern: **click the modality text + `expect(cephToggle).toBeVisible()` (auto-retrying), so
      the selection is proven to have registered.** Verified: B02+B03 ran **10/10** under `--repeat-each=5`,
      and the full harness is now **21/21 with 0 flaky** (was 20/21, B02 flaking). `networkidle` waits left
      as-is where present — they were not the flake source here, and churning them risks new races.
      **NOTE:** `playwright.config.ts:96` `reuseExistingServer: true` for the API is INTENTIONAL — the
      journey CI job pre-boots+seeds api-ts, so Playwright must reuse it (changing to `!CI` → second
      api-ts → port collision). Determinism comes from the from-zero reseed in the job, not that flag.
      Leave it.
- [x] **Stability-budget banking mechanism shipped.** Rather than waiting ~20 organic
      merges to accumulate the signal, a manual `workflow_dispatch` job
      (`.github/workflows/journey-stability.yml` → `Journey Stability Budget`) boots the
      real stack once and loops the full harness N× (default 20), each against a freshly
      reseeded DB. Pure aggregation (`apps/dentalemon/scripts/journey-stability-budget.ts`,
      unit-tested, 7 cases) turns the per-run verdicts into a pass-rate + a per-journey
      flake map; the orchestrator (`run-stability-budget.ts`) exits 0 **iff every run is
      clean**, so a green job IS the banked proof. One serial job amortizes setup → cheap on
      CI minutes (~40 min for 20). Verified locally **2/2 clean (21/21 each)** against the
      reseeded dev stack.
- [x] **Bank earned — 20/20.** Dispatched `Journey Stability Budget` (runs=20) on `main`
      (run 27502176220, 47m): **`Runs: 20/20 clean | pass-rate 100.0% | ✅ BUDGET BANKED`**,
      zero flaky journeys. The curated real-stack smoke is proven stable → Plan C cleared to arm.
- [x] Curated set = money/clinical core only (New Visit ✅, record finding, create invoice,
      record payment, create appointment, check-in). New Visit landed first.

### Plan C — Arm the gate (gated on B's 20/20 + A green) — THE LOCK ✅ DONE
The full 21-journey **Journey Harness** IS the lock (not a carved subset) — already a
required, blocking check, with **no `continue-on-error`**, running against a **from-zero-
migrated DB** (empty postgres service → auto-migrate on api-ts boot → seed). This plan
armed the last gap in it:
- [x] **Zero silent-skip tolerance for core flows.** The gate previously tolerated `SKIPPED`
      for *any* journey — so a core money/clinical flow whose precondition vanished could SKIP
      and still pass green (the exact class this effort kills). Now `SKIPPED` is tolerated
      **only** for the explicitly skip-allowed ceph journeys (B01–B04, MinIO-gated); a SKIP on
      any core journey is a regression that fails the gate (`computeExitCode` + the harness drift
      report + the stability-budget offender map all enforce it). Proven by unit tests
      (AC-005) and a real-stack run (21/21, exit 0, no regression).
- [x] Confirmed required + blocking + zero `continue-on-error` + from-zero-migrated DB (the
      broad ~70-spec E2E sweep stays intentionally non-blocking/advisory; the harness is the lock).

### Plan D — Code↔DB drift gate + visible drift ✅ DONE
- [x] **CI drift gate** (`Code-DB Drift Gate` in quality.yml): `migrate-to-n-minus-1.ts` puts the
      DB one migration behind (withholds the last via a temp journal), boots current api-ts →
      asserts it **auto-migrates on boot**, `/readyz` reports the schema **healed**, and a full
      **`db:reseed` through the activated handlers succeeds** (proves `withTenantTx` writes serve
      on the healed, RLS-granted DB — the exact flow the incident broke). Locally validated the
      N-1 → 108 self-heal on a scratch DB (app_rls grants 104).
- [x] **`/readyz` reports drift.** Verbose readiness now includes a `schema` check
      (`evaluateSchemaDrift`: applied-vs-journal + app_rls grant presence). A definitive
      `behind`/`rls-ungranted` verdict fails readiness (503) and surfaces `schemaDrift` detail;
      an unknown (embedded SQLite / transient) never self-inflicts an outage. Reuses dev-doctor's
      count queries.
- [x] **Design decision — `withTenantTx` fails loud, error-path only.** Chosen over a per-tx
      pre-check (zero happy-path cost): on a bare `permission denied for table …` (SQLSTATE 42501,
      the missing-grant/behind-DB signature) it rethrows with a "DB likely behind on migrations —
      run migrations" hint. A legitimate RLS **policy** violation ("new row violates row-level
      security policy", also 42501) is left UNTOUCHED — `describeRlsPermissionError` matches only the
      grant-drift message. Pure rules unit-tested (`schema-drift.test.ts`, 9 cases); RLS isolation
      suite unaffected.
- [x] **Promoted to a required check.** `Code-DB Drift Gate` added to branch protection
      (16 required, `strict` preserved) — it now BLOCKS merge, not just runs advisory.

### Plan E — Local dev doctor + hot-reload ✅ DONE (PR #25, merged)
- [x] `bun run dev:doctor` (DB migration count == file count, app_rls grants, API up+ready,
      FE up → loud, specific warning + the ONE fix command; exit 1 on drift). Pure diagnosis
      rules in `services/api-ts/src/core/dev-doctor.ts` (unit-tested, 10 cases); I/O orchestrator
      in `services/api-ts/scripts/dev-doctor.ts`. Verified live: catches the exact incident — a
      DB behind on migrations flags both migration drift AND `app_rls` permission-denied.
- [x] `services/api-ts` `dev` → `bun --watch src/index.ts`. **Design check passed:** `migrate()`
      is idempotent — re-running it against an already-current DB applies nothing (count stays
      108/108; the only output is the benign `CREATE TABLE IF NOT EXISTS` notice on the meta
      table), so a watch restart's `runMigrations` is non-destructive.

### Plan F — De-mask errors (small) ✅ DONE
- [x] **Confirmed the real gap** (not a rewrite): every backend error envelope already carries a
      unique `requestId` (500s also `trackingId`) and the server logs the SAME value
      (`middleware/request.ts`) — but the toast dropped it, so two different opaque failures read
      identically ("Please try again") and couldn't be told apart or correlated to a log line. And a
      generic 500 surfaced its opaque `"Internal server error"` message, worse than a contextual line.
- [x] **Fix (`error-toast.ts`):** `extractErrorRef` pulls the ref; `getErrorMessage` now treats
      GENERIC server codes/messages (`INTERNAL_SERVER_ERROR`, "Internal server error") as
      non-actionable → routes to the contextual fallback, and appends `(ref: <8-char>)` whenever it
      lands on the fallback AND a server ref exists. Actionable backend messages + mapped codes are
      shown clean (no ref noise); network errors (no ref) stay a clean fallback. `use-create-visit.ts`
      needs no change — its `toastError(..., 'Failed to create visit. Please try again.')` now
      auto-carries the ref. TDD: error-toast suite 22/22 (6 new); tsc + create-visit hook green.

## Discipline change
Verify "works for users" by running the real-stack smoke and citing its result — not by
reporting green unit/contract checks as proof of function.
