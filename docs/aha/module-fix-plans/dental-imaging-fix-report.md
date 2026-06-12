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

---

# Batch B (V1 completeness + test/seed hardening) — `eda43dde`

**Executed:** 2026-06-12 · Branch `chore/workflow-verification-sweep` (NOT pushed) · FIX-003/004/005/006. Vertical TDD + §15 wire-shape verification first + 3-lens adversarial review.

## FIX-003 — delete/reclassify library UI (§15 caught a real production bug)

The plan scoped this as "FE-only, consume existing generated hooks." §15 wire-shape verification (mandatory after this module's BUG-IMG-001/002 history) found the SDK was **deficient, not just unconsumed**: `deleteImage` returned `200 {success:true}`, but the generated `imagingMgmtDeleteImageResponseTransformer` treats the 200 success branch as `ErrorResponse` and runs `data.error.timestamp = new Date(...)` — it **crashes** on the real success body. The original FE delete test caught it instantly (`TypeError: undefined is not an object (evaluating 'data.error.timestamp')`). Any real FE consumer of deleteImage would have thrown.

- **Root cause:** `deleteImage` was the lone delete handler in the module returning a 200 JSON body. Every sibling (`deleteImageLink`, `deleteFinding`, `deleteCephLandmark`) returns **204 No Content**, which makes the (identical) generated transformer no-op on the empty body via its `if (data)` guard. The TypeSpec is `deleteImage(@path imageId): void | ErrorResponse` — it already supports 204.
- **Fix (no regen):** handler → `204 No Content`. Updated the 3 backend test files (`imaging.test.ts`, `imaging-coverage.test.ts`, `imaging-integration.test.ts`) that pinned 200/`body.success`, and the hurl pin (`dental-imaging.hurl` #30 → `HTTP 204`). The `status='archived'` soft-delete side-effect is still asserted (imaging.test.ts + the integration GET-returns-`images:[]` check).
- **FE wiring:** new `updateModality` + `deleteImage` mutations in `use-image-library.ts` (consume `imagingMgmtUpdateImageModality` / `imagingMgmtDeleteImage`, invalidate the patient image list); reclassify-modality `<select>` (excludes `cbct` — volumes edited via their own card) + delete-with-inline-confirm in `ImageMetadataEditor`. **No FE role-gate** (consistent with the sibling `updateMetadata` in the same editor; backend enforces owner/associate via BR-026/BR-027). **No `normalizeThrown`** on these mutations → the production `shouldRetry` sees the real `SdkError` and skips 4xx retry (unlike the FIX-002 autoDetect storm).
- **3-lens BLOCKER fixed:** added `key={editingItem.id}` on the editor mount (`patient-image-list.tsx`) so the `useState`-seeded modality/confirm/error state can never leak across images if the editor is ever reused without unmount. Pinned with a key-remount regression test (mutation-tested: same key → stale `bitewing` → RED).

## FIX-004 — imaging audit-row pins (§15 corrected a plan premise)

Extended `dental-imaging-events.test.ts` with an `imaging_finding.create` row-written pin (the file only covered the `.confirmed` transition via `updateFinding`) — asserts the persisted row's `targetType`/`actorId`/`branchId` + a negative (no row on 404). **§15 note:** `createCephReport` — the other representative the plan named — does **not** call `logAuditEvent` (it emits a Pino `info` marker only; it is absent from the call-site set), so there is no row to assert for it. Mutation-tested non-vacuous (action → `.MUTANT` ⇒ RED).

## FIX-005 — seed breadth (second ceph patient)

Added a second ceph-viewable patient — **Angela Reyes (P19)**, long promised in the `patientDefs` comment but never given the chain. `seedCephChain` parameterised by filename; the call is additive and touches no existing patient. A **CBCT study already exists** (P4 Carlos Mendoza, `seed-demo.ts`), so that half of the plan was already satisfied. Seed parses/bundles clean. **Runtime seed-coherence verification is MinIO-dependent** (study-create 500s on `ECONNREFUSED` bucket check when MinIO is down) → **environment-deferred** this session.

## FIX-006 — finding-systems boundary doc

`MODULE_SPEC.md` §7b now documents that `imaging_finding` (image-scoped radiographic FSM, dental-imaging) and `dental_finding` (visit-scoped condition vocabulary, dental-visit) are **intentionally separate** systems that must not be merged, with a comparison table and the rationale (merging would collapse the per-X-ray finding FSM into the visit chart). §10 reflects the now-wired library-admin routes + 204 delete semantics.

## Verification

| Layer | Result |
| --- | --- |
| BE imaging suite (17 files, isolated per-file via `test-with-db.ts`) | **404 pass / 0 fail** |
| BE `dental-imaging-events.test.ts` (incl. new create pin) | **8 pass / 0 fail** (mutation-tested) |
| FE imaging suite | **404 pass / 0 fail** |
| Typecheck (FE + api-ts + sdk-ts) | all **exit 0** |
| Lint (FE + api-ts) | **0 errors** |
| 3-lens adversarial review | BLOCKER (key-leak) fixed + pinned; rest SHIP |
| Contract imaging hurl + image E2E | **environment-deferred** (MinIO down → study-create `ECONNREFUSED`; 204 pinned at BE-integration + unit instead) |
| Regen | **none** (TypeSpec already supported 204; no SDK/contract change) |

## Not implemented (later batches / blocked)

- **Batch C/D/E** (FIX-007/008/009) — blocked on product decisions. Q1 (auto-detect stance), Q2 (superimposition), Q3 (CBCT V1) are now **resolved in `docs/aha/outputs/product-decisions.md`**: #2 = hold no-AI (FakeDetector stays a dev fixture; auto-detect declared out); #19 = superimposition preview-only-not-persisted + CBCT finalize chain OUT of V1 (both Phase-2/addon-dormant; schema unique-constraint deferred). The corresponding wire-or-declare batches remain unscheduled.
- Per §10/§11: no real AI detector (binding no-AI non-goal), no `@monobase/ceph-math` edits (frozen), no detection-job async expansion, no finding-systems merge, no new scheduler.

## ROADMAP flags (this batch)

- `deleteImage` 200-branch in the generated SDK union (`ImagingMgmtDeleteImageResponse = ErrorResponse | void`) is a stale TypeSpec artifact — harmless now (FE returns `Promise<void>`), but a future TypeSpec cleanup could make `deleteImage` return only `void`.
- Contract `dental-imaging.hurl` + the 4 real-API ceph journeys + `imaging-cbct.spec` need MinIO; this session ran without Docker. Re-run the imaging contract suite once storage is up to confirm the 204 + reclassify wire end-to-end.

## Module status

dental-imaging Batch A + B are **complete**. Batches C/D/E are decision-resolved (declared out of V1) and unscheduled.
- Per §10/§11: no real AI detector (binding no-AI non-goal), no `@monobase/ceph-math` edits (frozen), no detection-job async expansion, no finding-systems merge, no new scheduler.

## Decision queue (unchanged from plan)

| Item | Note |
| --- | --- |
| Q1 auto-detect affordance (remove / OFF-by-default / amend no-AI stance) | `[NEEDS PRODUCT DECISION]`; FIX-001 kill-switch pin is the safety net regardless. |
| Q2 superimposition persist vs preview-only | `[NEEDS PRODUCT DECISION]`; persist trio built+tested, 0 consumers. |
| Q3 CBCT addon chain in V1? | `[NEEDS CONFIRMATION]`; `finalizeCbctStudy` has only a harness-route E2E. |
