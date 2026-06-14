# Stop the Drift — make the real assembled stack the source of truth

> **Status tracker (committed on purpose).** This file is the durable, openable status of
> the multi-PR effort to stop "app broken for users while CI is green." Update the checkboxes
> as plans land. Pause → resume from the first unchecked box. Recorded 2026-06-14.

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
- [ ] Triage with user: confirm must-never-break set + P0s. **(Plan A is ~empty — no broken
      critical flows. Effort shifts to Plan B/C/E.)**

### Plan A — Fix what Phase 0 found red (gated on the audit) — TDD per defect
- [ ] (steps authored after Phase 0; no placeholders)

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
- [ ] Slice 2 — sweep the remaining probe-and-skip guards across J02–J20 (revenue chain, perio,
      charting, etc.) → hard asserts (present+enabled → act → assert user-visible result AND API 2xx).
- [ ] Flakiness root-cause fixes (THE task): kill `networkidle` races → explicit waits;
      de-flake the ceph journeys (B02 image-selection). **NOTE:** `playwright.config.ts:96`
      `reuseExistingServer: true` for the API is INTENTIONAL — the journey CI job pre-boots+seeds
      api-ts, so Playwright must reuse it (changing to `!CI` → second api-ts → port collision).
      Determinism comes from the from-zero reseed in the job, not that flag. Leave it.
- [ ] Stability budget: curated smoke passes **20/20 consecutive CI runs** before arming (Plan C).
- [x] Curated set = money/clinical core only (New Visit ✅, record finding, create invoice,
      record payment, create appointment, check-in). New Visit landed first.

### Plan C — Arm the gate (gated on B's 20/20 + A green) — THE LOCK
- [ ] Make the curated smoke a required check; run against a from-zero-migrated DB. Zero
      `continue-on-error`, zero skips.

### Plan D — Code↔DB drift gate + visible drift
- [ ] CI step: migrate a DB to N-1, boot, assert auto-migrate + a `withTenantTx` write succeeds.
- [ ] `/readyz` reports migration drift (applied vs journal) + app_rls-grant presence.
- [ ] Design check: should `withTenantTx` fail-loud "DB behind on migrations" vs raw permission-denied?

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

### Plan F — De-mask errors (small)
- [ ] Confirm the real gap (likely "always emit a parseable `code`" not a rewrite), then fix
      `apps/dentalemon/src/lib/error-toast.ts`, `use-create-visit.ts`.

## Discipline change
Verify "works for users" by running the real-stack smoke and citing its result — not by
reporting green unit/contract checks as proof of function.
