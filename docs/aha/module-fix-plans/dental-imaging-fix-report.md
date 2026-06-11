# AHA Fix Report: Dental Imaging & Ceph — Batch A (trust-surface hardening)

**Executed:** 2026-06-11 · **Prompt:** `04-module-or-group-fix-tdd.md` · **Branch:** `chore/workflow-verification-sweep` (NOT pushed) · **Batch:** A (FIX-001 + FIX-002). Batches B/C/D/E NOT in this pass (B = separate pass; C/D/E blocked on product decisions Q1/Q2/Q3).

## FIX-001 — kill-switch flag-OFF pin (clinical integrity)

The `dental_imaging_auto_landmark` kill-switch already exists in `detectCephLandmarks.ts` (gate 2: flag OFF → 403 `FEATURE_DISABLED`, thrown *before* the detector runs or any repo is constructed). The gap was a **test hole**: the existing flag-OFF test asserted only the 403 status/code, never that **zero landmark rows were written**. A future regression that moved the gate *after* the FakeDetector ran would still 403 but leak fixture landmarks into a real chart — undetected.

- **Backend** (`ceph-auto-landmark.test.ts`): new test — flag OFF ⇒ 403 `FEATURE_DISABLED` **and** `captured.upserts`/`captured.updates` are empty (the mock DB is configured to succeed on every read/write, so a missing/late gate would visibly persist rows). **Red-green verified:** with the kill-switch removed, this test (and the existing 403 test) fail — proving the pin has teeth.
- **Frontend** (`CephWorkspacePanel.test.ts`): strengthened the existing `FEATURE_DISABLED` test to also assert **no `[data-ai-unconfirmed]` AI landmark renders** after a 403 — the FE half of "no FakeDetector output reaches the chart."

Per the plan, the affordance question (remove the Auto-detect button / OFF-by-default / amend the no-AI stance, Q1/FIX-007) was **not touched** — this pin is required under every Q1 outcome and is the safety net that makes the eventual decision trivially safe.

## FIX-002 — autoDetect no longer retries permanent 4xx gates (real bug)

**Root cause (newly diagnosed):** the production QueryClient (`@monobase/sdk-ts` provider) applies `mutations: { retry: shouldRetry }`, and `shouldRetry` skips 4xx **only when the error is an `SdkError`**. But the autoDetect `mutationFn` runs `normalizeThrown`, which collapses the `SdkError` into a **plain `Error(code)`** (stripping the status). So `shouldRetry` falls through to its `return true` branch and a *permanent* 403 (flag off / no addon tier) **retries 3× with exponential backoff** — a ~5–7s "Detecting…" spinner before the tier/flag error appears. The existing tests missed it because they use `freshClientWithMutations` (retries disabled).

- **Fix** (`use-ceph-landmarks.ts`): `retry: false` on the `autoDetect` mutation (consistent with sibling hooks `use-pmd`, `use-medical-history-review`; `use-ceph-analysis` uses a status predicate). Smallest correct fix — autoDetect's thrown errors are ~always permanent 4xx (provider failures are returned by the handler as **200 `status:'failed'`**, not thrown), so no meaningful transient-retry is lost.
- **Test** (`use-ceph-landmarks.test.ts`): new RED→GREEN test under a `prodLikeMutationClient` (mutations retry up to 3×, mirroring the production fall-through path). **RED:** 4 detect requests. **GREEN:** exactly 1. The reviewer confirmed the test genuinely fails if `retry: false` is removed.

## Adversarial review

A focused adversarial code-reviewer (bypassPermissions) verified the batch against TanStack precedence, the production `shouldRetry`, and all four files: **no P0/P1/P2 defects.** Confirmed mutation-level `retry: false` overrides the client default; `deleteLandmark` (a separate mutation) is untouched; provider failures never reach the retry path; the FIX-002 test is faithful (fails when the fix is reverted); the BE zero-rows pin is airtight (gate throws before repo construction); the FE selector is valid. Only 3 P3 comment-clarity nits — the most useful (clarify that the storm arises from `normalizeThrown` stripping the `SdkError`) was applied to the test comment.

## Verification (fresh runs)

| Layer | Result |
| --- | --- |
| BE `ceph-auto-landmark.test.ts` (via `scripts/test-with-db.ts`) | **20 pass / 0 fail** (incl. new zero-rows pin) |
| FE `use-ceph-landmarks` + `CephWorkspacePanel` | **37 pass / 0 fail** |
| FE imaging suite (regression) | **399 pass / 0 fail** |
| Typecheck (root FE + `@monobase/api-ts`) | both **exit 0** |
| Red-green teeth (FIX-001 kill-switch removed) | 2 fail — pin confirmed meaningful |

## Not implemented (later batches / blocked)

- **Batch B** (FIX-003 delete/reclassify UI, FIX-004 audit-row pins, FIX-005 seed breadth, FIX-006 finding-systems boundary doc) — separate pass.
- **Batch C/D/E** (FIX-007/008/009) — blocked on product decisions Q1 (auto-detect stance), Q2 (superimposition persist vs preview-only), Q3 (CBCT V1 scope).
- Per §10/§11: no real AI detector (binding no-AI non-goal), no `@monobase/ceph-math` edits (frozen), no detection-job async expansion, no finding-systems merge, no new scheduler.

## Decision queue (unchanged from plan)

| Item | Note |
| --- | --- |
| Q1 auto-detect affordance (remove / OFF-by-default / amend no-AI stance) | `[NEEDS PRODUCT DECISION]`; FIX-001 kill-switch pin is the safety net regardless. |
| Q2 superimposition persist vs preview-only | `[NEEDS PRODUCT DECISION]`; persist trio built+tested, 0 consumers. |
| Q3 CBCT addon chain in V1? | `[NEEDS CONFIRMATION]`; `finalizeCbctStudy` has only a harness-route E2E. |
