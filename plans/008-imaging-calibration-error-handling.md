# Plan 008: Surface calibration-save failures in the imaging workspace (toast + keep dialog open)

> **Executor instructions**: Follow step by step; run every verification command
> and confirm before moving on. STOP conditions are real — honor them. When
> done, update the 008 status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c3d93891..HEAD -- apps/dentalemon/src/features/imaging`
> If `imaging-workspace.tsx` changed since this plan was written, re-read the
> "Current state" excerpt before editing.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (frontend)
- **Planned at**: commit `c3d93891`, 2026-06-18

## Why this matters

In the cephalometric/imaging workspace, saving a calibration silently swallows
failures. `handleCalibrationConfirm` awaits the SDK call with
`throwOnError: true` and **no try/catch**, and it is invoked as
`void handleCalibrationConfirm(mm)` — so on a 4xx/5xx/network failure the promise
rejects unhandled: no toast, and the code that resets state never runs, leaving
the dialog/tool in a confusing state with no feedback. Every *other* mutation in
this same file already routes errors to `toastError(...)`. This brings
calibration to parity. (Note: the ceph **landmark** commits in this file are
*not* a bug — `useCephLandmarks` already rolls back optimistically on error and
exposes `mutationError`; do not change those.)

## Current state

`apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx`:

- `toastError` is already imported (line 24):
  `import { toastError } from '@/lib/error-toast'`
- The sibling measurement mutations already handle errors (lines 284, 319):
  `onError: (err) => toastError(err, 'Could not save measurement.')`
- The gap — `handleCalibrationConfirm` (lines 334-357):

```ts
const handleCalibrationConfirm = useCallback(
  async (actualMm: number) => {
    const req = buildCalibrationRequest({ points: drawPoints, actualMm });
    if (!req) return;
    await imagingMgmtUpdateImageCalibration({
      path: { imageId },
      body: {
        pixelSpacingMm: req.pixelSpacingMm,
        pointA: req.pointA,
        pointB: req.pointB,
        knownDistanceMm: req.knownDistanceMm,
      },
      throwOnError: true,
    });
    setInternalPixelSpacingMm(req.pixelSpacingMm);
    onCalibrationSaved?.(req.pixelSpacingMm);
    setCalibrationOpen(false);
    setDrawPoints([]);
    setToolMode('none');
  },
  [drawPoints, imageId, onCalibrationSaved],
);
```

- It is invoked at line ~557: `onConfirm={(mm) => void handleCalibrationConfirm(mm)}`.

**Conventions**: user-facing errors go through `toastError(err, fallbackMsg)`
from `@/lib/error-toast` (see the measurement `onError` calls in this file). FE
unit tests mock the generated SDK module `@monobase/sdk-ts/generated` (see
`apps/dentalemon/src/features/imaging/hooks/use-ceph-landmarks.test.ts`).

## Commands you will need

| Purpose          | Command                                                                                          | Expected            |
|------------------|--------------------------------------------------------------------------------------------------|---------------------|
| FE typecheck     | `bun run --filter dentalemon typecheck`                                                          | exit 0              |
| FE lint          | `bun run --filter dentalemon lint`                                                               | exit 0              |
| FE test (file)   | `cd apps/dentalemon && bun run test src/features/imaging/components/<your-test-file>`            | all pass            |

## Suggested executor toolkit

- `superpowers:test-driven-development` — write the failing "shows a toast when
  calibration save fails" test first (Step 1), then make it pass (Step 2).
- `superpowers:verification-before-completion` — run the gates before claiming done.

## Scope

**In scope**:
- `apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx` — only
  the `handleCalibrationConfirm` callback.
- One FE test file covering the failure path (create or extend an existing
  imaging-workspace test).

**Out of scope** (do NOT touch):
- The ceph landmark commit sites (`void commitLandmark.mutateAsync(...)`) and
  `useCephLandmarks` — already handle errors via optimistic rollback +
  `mutationError`.
- The measurement mutation handlers (already correct).
- The success-path behavior of calibration (state resets must stay identical on
  success).

## Git workflow

- Branch: `advisor/008-calibration-error-handling`
- One commit: `fix(imaging): surface calibration-save failures with a toast`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Write the failing test (RED)

Add a test (model the SDK mock on `use-ceph-landmarks.test.ts`) that:
- mocks `imagingMgmtUpdateImageCalibration` from `@monobase/sdk-ts/generated`
  to **reject**,
- mocks/【spies】`toastError` from `@/lib/error-toast`,
- drives the calibration confirm (render the workspace, open calibration, draw
  two points, confirm) — or, if full-component setup is too heavy, extract the
  intent into the smallest test that exercises `handleCalibrationConfirm`'s
  failure branch,
- asserts `toastError` was called and that the dialog did **not** close
  (`setCalibrationOpen(false)` not reached) on failure.

**Verify**: the test fails against current code (no toast on failure). This is
the expected RED.

### Step 2: Wrap the await in try/catch (GREEN)

Change the callback so a failure surfaces a toast and preserves the dialog so
the user can retry; success behavior is unchanged:

```ts
const handleCalibrationConfirm = useCallback(
  async (actualMm: number) => {
    const req = buildCalibrationRequest({ points: drawPoints, actualMm });
    if (!req) return;
    try {
      await imagingMgmtUpdateImageCalibration({
        path: { imageId },
        body: {
          pixelSpacingMm: req.pixelSpacingMm,
          pointA: req.pointA,
          pointB: req.pointB,
          knownDistanceMm: req.knownDistanceMm,
        },
        throwOnError: true,
      });
    } catch (err) {
      toastError(err, 'Could not save calibration.');
      return; // keep the dialog + draw points so the user can retry
    }
    setInternalPixelSpacingMm(req.pixelSpacingMm);
    onCalibrationSaved?.(req.pixelSpacingMm);
    setCalibrationOpen(false);
    setDrawPoints([]);
    setToolMode('none');
  },
  [drawPoints, imageId, onCalibrationSaved],
);
```

(The `useCallback` dependency array is unchanged — `toastError` is a stable
module import, not a prop/state.)

**Verify**: the Step 1 test now passes (GREEN). A success-path test, if present,
still passes (state resets unchanged).

### Step 3: Gates

**Verify**:
- `bun run --filter dentalemon typecheck` → exit 0
- `bun run --filter dentalemon lint` → exit 0
- `cd apps/dentalemon && bun run test src/features/imaging/components/<your-test-file>` → pass

## Test plan

- New/extended FE test: "calibration save failure shows a toast and keeps the
  dialog open." Mock the SDK call to reject; assert `toastError` called and
  dialog not closed.
- If an existing success-path calibration test exists, ensure it still passes
  (no regression to the happy path).
- Structural pattern for SDK mocking: `use-ceph-landmarks.test.ts`.

## Done criteria

ALL must hold:

- [ ] `handleCalibrationConfirm` wraps the SDK await in try/catch and calls
      `toastError(err, 'Could not save calibration.')` on failure
- [ ] On failure the dialog stays open (early `return` before the reset calls)
- [ ] New FE test for the failure path passes
- [ ] `bun run --filter dentalemon typecheck` exits 0
- [ ] `bun run --filter dentalemon lint` exits 0
- [ ] Only `imaging-workspace.tsx` + one test file changed (`git status`)
- [ ] `plans/README.md` status row for 008 updated

## STOP conditions

Stop and report if:
- Rendering the full workspace for the test proves impractical (heavy provider
  setup) AND there is no lighter seam to exercise the callback — report so the
  approach can be reconsidered (e.g. extracting the handler).
- The success-path state resets cannot be preserved exactly (something about the
  control flow forces a behavior change on success).

## Maintenance notes

- This mirrors the measurement-mutation error pattern in the same file; if a
  shared "mutation error toast" helper is later introduced, fold all three
  (measurement ×2, calibration) into it.
- A reviewer should confirm the landmark commit sites were NOT touched (they're
  correct as-is) and that the success path is byte-for-byte unchanged.
