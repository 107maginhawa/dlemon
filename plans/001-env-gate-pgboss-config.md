# Plan 001: pg-boss uses production-safe retention/expiry outside tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6bcb3af6..HEAD -- services/api-ts/src/core/jobs.ts`
> If `jobs.ts` changed since this plan was written, compare the "Current state"
> excerpt against the live code before proceeding; on a mismatch, treat it as a
> STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6bcb3af6`, 2026-06-17

## Why this matters

The pg-boss job scheduler is constructed with **test-calibrated** values hardcoded into the production constructor, with no environment guard. `expireInMinutes: 5` means any job that runs longer than 5 minutes is killed as "expired"; `deleteAfterDays: 1` purges job history after a single day; `retryLimit: 2` and `archiveCompletedAfterSeconds: 300` are likewise tuned for a fast test loop. In production these are wrong: the application schedules long-horizon background work (e.g. appointment-slot generation runs on a 30-day horizon) that will be force-expired at 5 minutes, and operational job history needed for debugging is deleted within a day. This is the highest-impact non-security correctness gap currently open. The fix is to keep the fast values when running tests and apply sane production defaults otherwise.

## Current state

- `services/api-ts/src/core/jobs.ts` — the only job-scheduler implementation. `class PgBossScheduler` (line 93) constructs pg-boss in its constructor (lines 124–145). Factory `createJobScheduler(db, logger)` at line 619 returns `new PgBossScheduler(db, logger)`. The constructor takes **only** `(db, logger)` — there is no config object threaded in.
- The scheduler is created once in `services/api-ts/src/app.ts:84`: `const jobs = createJobScheduler(database, logger);`.
- The offending block, exactly as it exists today (`jobs.ts:124-145`):

```ts
    // Initialize pg-boss with the adapter
    this.boss = new PgBoss({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pg-boss db adapter type is not publicly exported
      db: pgBossDb as any,

      // pg-boss configuration
      schema: 'pgboss', // Isolate pg-boss tables in their own schema
      deleteAfterDays: 1, // Faster cleanup for tests
      archiveCompletedAfterSeconds: 300, // Archive after 5 minutes for tests

      // Retry configuration
      retryLimit: 2, // Fewer retries for faster tests
      retryDelay: 5, // Shorter delay for tests
      retryBackoff: true, // exponential backoff

      // Job expiration
      expireInMinutes: 5, // Shorter expiration for tests

      // Maintenance configuration (faster for tests)
      maintenanceIntervalSeconds: 10 // More frequent maintenance

      // Worker configuration - noScheduling and noSupervisor removed as they don't exist in ConstructorOptions
    });
```

- **Repo convention for environment detection**: the codebase reads `process.env['NODE_ENV']` directly (bracket notation, because `noUncheckedIndexedAccess`/strict env typing is on). Confirmed call sites in `services/api-ts/src/core/config.ts`: lines 147, 149, 150, 151, 174, 282 — e.g. `process.env['NODE_ENV'] === 'production'`. Match this style. Tests run with `NODE_ENV` set to `test` (Bun's test runner sets `NODE_ENV=test` by default; the contract/integration harness relies on the current fast values, so "test" must keep them).

## Commands you will need

| Purpose   | Command (run from `services/api-ts/`)            | Expected on success |
|-----------|--------------------------------------------------|---------------------|
| Typecheck | `bun run typecheck`                              | exit 0, no errors   |
| Lint      | `bun run lint`                                   | exit 0              |
| Unit test | `bun run scripts/test-with-db.ts src/core/jobs.test.ts` | all pass (incl. new tests) |

(Run backend tests via `scripts/test-with-db.ts` with explicit **file** arguments — never a directory. This is the repo's required wrapper; it provisions the `monobase_test` database before invoking `bun test` on the given files.)

## Scope

**In scope** (the only files you should modify):
- `services/api-ts/src/core/jobs.ts`
- `services/api-ts/src/core/jobs.test.ts` (create if absent; otherwise extend)

**Out of scope** (do NOT touch):
- `services/api-ts/src/app.ts` — the `createJobScheduler(database, logger)` call signature must NOT change. Do the environment branching **inside** `jobs.ts`; do not add a config parameter.
- The `registerInterval` sub-minute `setInterval` fallback (lines ~177–230) — unrelated.
- Any other pg-boss option name — only adjust the five values listed in Step 1.

## Git workflow

- Branch: `advisor/001-pgboss-config` (create from the current branch).
- Commit style is Conventional Commits — recent example from `git log`: `fix(kg): review radar recognizes Set-B (ceph) journeys`. Use e.g. `fix(jobs): production-safe pg-boss retention/expiry outside tests`.
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Branch pg-boss values on test vs non-test

In `jobs.ts`, inside the constructor (before the `new PgBoss({...})` call at line 124), compute an `isTest` flag and two value sets. Then use the production values unless `isTest`.

Target shape:

```ts
    // Test runs (NODE_ENV=test) need fast cleanup/expiry so the contract and
    // integration suites don't wait minutes per scenario. Production must use
    // sane long-horizon values — the slot generator schedules work on a 30-day
    // horizon and would otherwise be force-expired at 5 minutes.
    const isTest = process.env['NODE_ENV'] === 'test';
    const bossTuning = isTest
      ? {
          deleteAfterDays: 1,
          archiveCompletedAfterSeconds: 300, // 5 min
          retryLimit: 2,
          retryDelay: 5,
          expireInMinutes: 5,
          maintenanceIntervalSeconds: 10,
        }
      : {
          deleteAfterDays: 30,
          archiveCompletedAfterSeconds: 12 * 60 * 60, // 12 h
          retryLimit: 3,
          retryDelay: 30,
          expireInMinutes: 15,
          maintenanceIntervalSeconds: 120,
        };

    this.boss = new PgBoss({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pg-boss db adapter type is not publicly exported
      db: pgBossDb as any,
      schema: 'pgboss', // Isolate pg-boss tables in their own schema
      retryBackoff: true, // exponential backoff
      ...bossTuning,
    });
```

Notes:
- Keep `schema: 'pgboss'` and `retryBackoff: true` unconditional (they are not environment-sensitive).
- Do not invent new pg-boss option names. The six keys in `bossTuning` are exactly the values that were previously hardcoded.
- The production `expireInMinutes: 15` is a conservative default for the longest *single job execution*, not the schedule horizon — scheduled cron/interval jobs are re-enqueued each tick and are unaffected by this. Do not raise it further without operator input.

**Verify**: `bun run typecheck` → exit 0, no errors.

### Step 2: Add a unit test pinning the environment branch

Create or extend `services/api-ts/src/core/jobs.test.ts`. The constructor calls `(db as any).$client` and builds a `new PgBoss(...)`; to test the value selection without a live pool, extract the tuning decision into a tiny exported pure helper and test that, OR mock pg-boss. The **lower-risk** approach is to extract a pure helper:

In `jobs.ts`, add an exported function and use it in the constructor:

```ts
export function resolvePgBossTuning(nodeEnv: string | undefined) {
  const isTest = nodeEnv === 'test';
  return isTest
    ? { deleteAfterDays: 1, archiveCompletedAfterSeconds: 300, retryLimit: 2, retryDelay: 5, expireInMinutes: 5, maintenanceIntervalSeconds: 10 }
    : { deleteAfterDays: 30, archiveCompletedAfterSeconds: 12 * 60 * 60, retryLimit: 3, retryDelay: 30, expireInMinutes: 15, maintenanceIntervalSeconds: 120 };
}
```

and in the constructor: `const bossTuning = resolvePgBossTuning(process.env['NODE_ENV']);`

Then the test:

```ts
import { describe, test, expect } from 'bun:test';
import { resolvePgBossTuning } from './jobs';

describe('resolvePgBossTuning', () => {
  test('test env uses fast cleanup/expiry', () => {
    const t = resolvePgBossTuning('test');
    expect(t.expireInMinutes).toBe(5);
    expect(t.deleteAfterDays).toBe(1);
  });

  test('production uses long-horizon retention/expiry (regression: slot generator must not be expired at 5 min)', () => {
    const t = resolvePgBossTuning('production');
    expect(t.expireInMinutes).toBeGreaterThanOrEqual(15);
    expect(t.deleteAfterDays).toBeGreaterThanOrEqual(30);
  });

  test('undefined NODE_ENV is treated as non-test (production defaults)', () => {
    const t = resolvePgBossTuning(undefined);
    expect(t.deleteAfterDays).toBeGreaterThanOrEqual(30);
  });
});
```

**Verify**: `bun run scripts/test-with-db.ts src/core/jobs.test.ts` → all pass, including the 3 new tests.

### Step 3: Confirm no regressions in the gates

**Verify**:
- `bun run typecheck` → exit 0
- `bun run lint` → exit 0

## Test plan

- New file (or extension): `services/api-ts/src/core/jobs.test.ts`.
- Cases: (1) test env → fast values; (2) production env → long-horizon values (this is the regression guard for the bug); (3) undefined `NODE_ENV` → production defaults (fail-safe).
- Structural pattern to follow: a plain `bun:test` `describe/test/expect` unit file — see `services/api-ts/src/handlers/dental-visit/treatment.fsm.property.test.ts` for the import + describe style (ignore its fast-check usage; you don't need property tests here).
- Verification: `bun run scripts/test-with-db.ts src/core/jobs.test.ts` → all pass.

## Done criteria

ALL must hold:

- [ ] `bun run typecheck` (from `services/api-ts/`) exits 0
- [ ] `bun run lint` (from `services/api-ts/`) exits 0
- [ ] `bun run scripts/test-with-db.ts src/core/jobs.test.ts` passes, including the 3 new `resolvePgBossTuning` tests
- [ ] `grep -n "Faster cleanup for tests\|Shorter expiration for tests" services/api-ts/src/core/jobs.ts` returns no matches (old hardcoded test-only comments gone or moved into the test branch)
- [ ] `services/api-ts/src/app.ts` is unchanged (`git status` shows it not modified)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 001 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The `jobs.ts:124-145` code does not match the "Current state" excerpt (the file drifted since this plan).
- `(db as any).$client` access or the pg-boss option names differ from what's described, such that the constructor no longer compiles after the change.
- Backend tests that previously passed now fail because some test relied on a production-only value — report which test and which value.
- You find an existing `config`/env abstraction already threaded into `PgBossScheduler` (then prefer it over `process.env`, and report the choice).

## Maintenance notes

- If background jobs are ever added that need a single execution longer than 15 minutes, raise the production `expireInMinutes` deliberately (with operator sign-off) — don't silently bump it.
- A reviewer should confirm the **test** branch values are byte-for-byte the previous hardcoded values, so the existing contract/integration timing is unchanged.
- Deferred out of scope: making these values fully config-driven (env vars). Not needed now; `NODE_ENV` branching is sufficient and matches repo convention.
