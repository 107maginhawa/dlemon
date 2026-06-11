# AHA Fix-Ready Plan: Dental Imaging & Ceph

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/03-organize-gap-plan-for-fixing.md`

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Dental Imaging & Ceph |
| Module slug | dental-imaging |
| Source gap plan | `docs/aha/module-gap-plans/dental-imaging-gap-plan.md` |
| Output file | `docs/aha/module-fix-plans/dental-imaging-fix-ready-plan.md` |
| Audit decision | PARTIAL PASS |
| Superpowers used | No — organizer discipline applied via shared rules (§19 Gap Organizer Rules); no execution agent needed for organizing |
| Organizer decision | PARTIALLY READY |
| Reason | Two decision-free hardening batches (Batch A trust/kill-switch hardening, Batch B V1 completeness + test hardening) are fully fix-ready now. However, the module's only P1 (GAP-1 FakeDetector contradiction) and both P2 wiring gaps (GAP-2 superimposition persistence, GAP-3 CBCT production chain) require product decisions Q1–Q3 before their implementation batches can run. The decision-free slice of GAP-1 (kill-switch flag-OFF test pin) IS in active scope. |
| Limitations | No tests executed during organizing (organizer-only). Source locations re-verified this session: `CephWorkspacePanel.tsx:311-338` (Auto-detect button + error copy), `use-ceph-landmarks.ts:327` (autoDetect mutation, no retry config), `handlers/dental-imaging/repos/ceph-landmark-detector.ts` (FakeDetector), grep confirms 0 app consumers for `createCephSuperimposition`/`getCephSuperimposition`/`listCephSuperimpositions` and `finalizeCbctStudy`. Seed limits runtime verification (one ceph-viewable patient) until FIX-005 lands. |

## 2. Fix Strategy Summary

This is the platform's healthiest large module — the entire 2026-06-10 reconciliation backlog (G1/G2/G4/G5a/G5b/G6) is landed and source-verified, BUG-IMG-001/002 fixes hold with contract pins, and 45/45 BR/CIMG rules are implemented and tested. The fix strategy is therefore **small, surgical hardening — not feature work**.

- **Fix first (now, decision-free):** Batch A — pin the `dental_imaging_auto_landmark` flag-OFF kill-switch (FE button path + backend rejection), and stop the autoDetect mutation from retrying permanent 4xx failures (5s+ spinner on 403 today). These directly harden the P1 trust surface without prejudging product decision Q1.
- **Then (now, decision-free):** Batch B — small V1 completeness + test hardening: delete-image/reclassify-modality library affordances (handlers already exist), imaging audit-row assertions, second seeded ceph patient + CBCT study, and documenting the intentional two-finding-systems boundary in MODULE_SPEC.
- **Do not fix yet:** GAP-1 affordance resolution (remove button vs OFF-by-default vs amend no-AI stance) is `[NEEDS PRODUCT DECISION]` Q1 — escalate before any imaging batch runs if possible; the code change is tiny either way. GAP-2 (Q2) and GAP-3 (Q3) are wire-or-declare decisions — building UI for either before the decision risks throwaway work.
- **Do not build:** anything on the reconciliation do-not-rebuild list (landmark FSM, analyses, calibration math, viewer), analysis-template abstraction (G3), a real AI detector (no-AI non-goal is binding), expansion of the FakeDetector/detection-job path.
- **Major risks:** low. All active fixes are module-local except the seed script (shared demo script, additive change only). No shared/platform or database/schema work is required for the active batches. No scheduled/cron work is needed anywhere in this plan (the existing `services/api-ts/src/core/jobs.ts` scheduler is not implicated).
- **Pass shape:** multiple small batches. Batch A and Batch B can run in one `04` pass or two; Batches C/D/E run only after their respective decisions.

## 3. Active Fix Scope

Only decision-free items are active. Blocked items (FIX-007/008/009) are defined in §9 and their conditional batches in §4, but are NOT in the active fix sequence.

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | GAP-1 (decision-free slice): `dental_imaging_auto_landmark` flag-OFF path untested — no proof the kill-switch actually suppresses fixture landmarks end-to-end | P1 | `[TEST GAP]` (test-only; does not prejudge Q1) | A | The gap plan says "Add flag-OFF test either way" — whatever Q1 decides, the OFF path must be pinned. Protects clinical integrity (fixture landmarks must not enter a real chart when flag is off) | Gap plan §5 GAP-1, §20 row 1; `CephWorkspacePanel.tsx:311-338` (button + "Automatic detection is currently disabled." copy); `detectCephLandmarks.ts`; `ceph-auto-landmark.test.ts` |
| FIX-002 | GAP-5: autoDetect mutation retries 4xx — permanent 403 (no addon tier / flag off) shows ≥5s spinner before error | P3 | V1 RECOMMENDED | A | Low-risk, directly improves trust/usability of the same P1 surface; trivial change (`retry: false` or retry-predicate on 4xx) | Gap plan §5 GAP-5, §11 row 4; `use-ceph-landmarks.ts:327` (no retry config verified) |
| FIX-003 | GAP-4: deleteImage / updateImageModality handlers ready but no UI — dentist cannot remove a bad capture or fix a mis-classified image | P3 | V1 RECOMMENDED | B | Real V1 use case (gap plan §9 row 6); handlers + BR-028 soft-delete already tested; FE-only, small | Gap plan §5 GAP-4, §12; grep: 0 FE consumers for both ops |
| FIX-004 | GAP-6: imaging `logAuditEvent` calls lack row-written test assertions | P3 | V1 RECOMMENDED `[TEST GAP]` | B | Testability hardening; audit trail is a compliance surface; extend existing test file, no production code expected | Gap plan §5 GAP-6, §15; `logAuditEvent` call sites across 8+ handlers; `dental-imaging-events.test.ts` exists |
| FIX-005 | GAP-7: seed has one ceph-viewable patient (Miguel Torres); compare/CBCT flows data-limited in demo and live verification | P3 | V1 RECOMMENDED | B | Unblocks runtime verification of comparison/CBCT and future Batch C/D/E verification; additive seed change | Gap plan §5 GAP-7, §20; `scripts/seed-demo.ts` (seedCephChain) |
| FIX-006 | Cross-module clarity: two finding systems (`imaging_finding` vs `dental_finding`) are intentional and separate, but undocumented — future contributors may merge them wrongly | P3 | V1 RECOMMENDED `[CROSS-MODULE RISK]` (doc-only) | B | One-paragraph MODULE_SPEC addition prevents a future architectural mistake; recommended by gap plan §21 | Gap plan §3 bullet 3, §21 row 3; `docs/product/modules/dental-imaging/MODULE_SPEC.md` |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| Batch A — P1 trust-surface hardening (decision-free) | Pin the auto-detect kill-switch and fix the 4xx retry UX on the same surface | FIX-001, FIX-002 | Low (test-only + one mutation option) | **Run in current `04` pass — first** |
| Batch B — V1 completeness + test/seed hardening | Library admin affordances, audit-row pins, seed breadth, boundary doc | FIX-003, FIX-004, FIX-005, FIX-006 | Low | Run in current `04` pass after Batch A, or a separate `04` pass |
| Batch C — GAP-1 affordance resolution | Implement Q1 outcome: remove button / keep flag-gated-OFF-by-default / amend no-AI stance (each is a tiny change) | FIX-007 | Low once decided | **Requires product decision first (Q1)** — do not run yet |
| Batch D — Superimposition persistence wire-or-declare | If Q2 = persist: save/list UI in comparison flow consuming the persist trio; if Q2 = preview-only: document + park handlers | FIX-008 | Medium (new FE flow) if wired; trivial if declared | **Requires product decision first (Q2)** — do not run yet |
| Batch E — CBCT production wiring | If Q3 = V1: wire `finalizeCbctStudy` + viewer link into production upload/library flow + honest production-route E2E; if post-V1: document scope explicitly | FIX-009 | Medium (new FE wiring + E2E) if wired | **Requires confirmation first (Q3)** — do not run yet |

Do not combine Batch C/D/E with A/B. Do not start C/D/E in the same `04` pass even if decisions arrive mid-pass — schedule a fresh pass.

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | (a) Backend: `detectCephLandmarks` with `dental_imaging_auto_landmark` OFF → feature-disabled rejection, zero landmark rows written. (b) Frontend: `CephWorkspacePanel` flag-OFF state → no fixture landmarks enter the chart; the existing "Automatic detection is currently disabled." path renders (pin current behavior; button visibility change belongs to Batch C/Q1) | backend/unit + frontend/component + regression | Kill-switch is real end-to-end: with the flag off, no FakeDetector output can reach a clinical chart, and the user sees an honest error | Extend `services/api-ts/src/handlers/dental-imaging/ceph-auto-landmark.test.ts`; extend `apps/dentalemon/src/features/imaging/components/CephWorkspacePanel.test.ts` |
| FIX-002 | Frontend: mock a 403 (addon/flag) response for `detectCephLandmarks`; assert the mutation fires exactly once (no retries) and the error copy appears promptly | frontend/component (regression) | Permanent 4xx fails fast — no multi-second spinner; tier-gate error is immediate | Extend `apps/dentalemon/src/features/imaging/hooks/use-ceph-landmarks.test.ts` |
| FIX-003 | Frontend: library view actions — delete image calls `deleteImage` and the image leaves the list (soft-delete refetch); reclassify calls `updateImageModality` with the new modality and the card updates | frontend/component | UI affordance is wired to the real SDK ops and the list reflects the change after mutation | Extend the patient-image-list test (note: lives in the `__tests__/` subdir of `features/imaging/`, not co-located) and/or `use-image-library.test.ts` |
| FIX-004 | Backend: after representative imaging mutations (e.g., createImagingStudy, createFinding, createCephReport), assert an audit row was actually written with correct actor/entity fields | backend/unit (regression) | `logAuditEvent` calls produce persisted audit rows — not just invoked | Extend `services/api-ts/src/handlers/dental-imaging/dental-imaging-events.test.ts` |
| FIX-005 | Seed-coherence: after `db:reseed`, assert a second patient has a viewable ceph image and a CBCT study exists (lightweight script-level or existing seed-validation pattern check) | data/seed-coherence | Demo/E2E data supports comparison + CBCT flows, not just Miguel Torres | `scripts/seed-demo.ts` (seedCephChain); verification via existing seed/demo smoke pattern — do not add a heavy E2E for this |
| FIX-006 | None (doc-only) | — | — | `docs/product/modules/dental-imaging/MODULE_SPEC.md` |

Notes: no new E2E/Playwright tests are warranted for Batches A/B (existing 4 real-API ceph journeys remain the E2E spine). E2E additions belong to Batches D/E post-decision.

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `services/api-ts/src/handlers/dental-imaging/ceph-auto-landmark.test.ts`, `apps/dentalemon/src/features/imaging/components/CephWorkspacePanel.test.ts` (tests only; possibly a tiny flag-read guard in `detectCephLandmarks.ts` if the test reveals a hole) | module-local | Minimal — test files; detector path only |
| FIX-002 | `apps/dentalemon/src/features/imaging/hooks/use-ceph-landmarks.ts` (line ~327, mutation options), `use-ceph-landmarks.test.ts` | module-local | One hook; ceph panel only |
| FIX-003 | `apps/dentalemon/src/features/imaging/components/patient-image-list.tsx` (and/or `imaging-workspace.tsx` library view), its test in `features/imaging/__tests__/`, SDK hooks for `deleteImage`/`updateImageModality` (already generated — consume, do not regenerate) | module-local | Imaging library view only |
| FIX-004 | `services/api-ts/src/handlers/dental-imaging/dental-imaging-events.test.ts` (tests only) | module-local | None (test-only) |
| FIX-005 | `scripts/seed-demo.ts` (additive: second ceph patient chain + CBCT study) | shared/platform (root demo-seed script consumed by all modules' demos/E2E) | Demo dataset only; additive — must not mutate existing seeded patients. Gotcha: omit explicit reading ids on tooth-numbered seeds (`detUuid` collision, known from perio seeding) |
| FIX-006 | `docs/product/modules/dental-imaging/MODULE_SPEC.md` | module-local (docs) | None |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-001 | module-local | Feature-flag plumbing for `dental_imaging_auto_landmark` (read path already exists in handler + panel) | Test must toggle the flag in both BE and FE test harnesses | No — existing patterns suffice |
| FIX-002 | module-local | TanStack Query mutation options | None beyond the hook | No |
| FIX-003 | module-local | Generated SDK ops `deleteImage`/`updateImageModality` (already in sdk-ts) | Consume existing generated hooks; no TypeSpec/codegen change needed | No |
| FIX-004 | cross-module (read-only) | Audit module's row schema/repo for assertions | Tests read audit rows; no audit-module code change | No |
| FIX-005 | shared/platform | `scripts/seed-demo.ts` is shared demo infrastructure; seeds through HTTP against a running API | Additive change only; never run reseed against `monobase_test` (pollutes template DB — known gotcha) | No, but coordinate: run after Batch A/B code lands |
| FIX-007 (blocked) | product decision | Q1: auto-detect stance (remove / OFF-default / amend no-AI) | Brand-level decision per gap plan §17; owned at product level | **Yes** |
| FIX-008 (blocked) | product decision | Q2: persist superimpositions in V1 vs declare preview-only | Determines wire vs document+park | **Yes** |
| FIX-009 (blocked) | product decision | Q3: is the CBCT addon chain in V1 launch scope? | Determines wire vs explicit post-V1 scoping; PH market context suggests deferral may be legitimate `[INFERRED]` | **Yes** |
| (context) | shared/platform `[SHARED DEPENDENCY]` | `@monobase/ceph-math` version constants feed report pinning | **Freeze constants semantics** — no active fix touches them; `04` must not modify this package | N/A — constraint, not work |

No database/schema dependencies exist for any active fix. No scheduled/cron work is required; nothing in this plan registers on `services/api-ts/src/core/jobs.ts`.

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Q1: Auto-detect — remove the affordance, keep flag-gated-OFF until a real detector exists, or formally amend the binding no-AI stance? | `[NEEDS PRODUCT DECISION]` | FIX-007 (Batch C) | A production "Auto-detect landmarks" button backed by a deterministic FakeDetector contradicts the platform's clinical-trust differentiator; this is brand-level, not just technical | Escalate to the cross-module decision queue with the three options + note that the code change is tiny either way. FIX-001 (kill-switch pin) proceeds regardless |
| Q2: Superimposition — persist sessions in V1 or declare preview-only? | `[NEEDS PRODUCT DECISION]` | FIX-008 (Batch D) | Persist trio (`createCephSuperimposition`/`get`/`list`) is built + tested but has 0 consumers; clinician superimposition work is lost between sessions today | Decision queue. If preview-only: a one-paragraph declaration + park note is the entire fix |
| Q3: Is the CBCT addon chain (finalize + viewer link) in V1 launch scope? | `[NEEDS CONFIRMATION]` | FIX-009 (Batch E) | `finalizeCbctStudy` has 0 production consumers; only a harness-route E2E exercises it — the addon tier currently sells a chain the product cannot complete | Decision queue. If post-V1: explicit scope note so the harness-only E2E stops masquerading as production coverage |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| FIX-007: GAP-1 affordance resolution (remove button / OFF-by-default + visibility gating / stance amendment) | `[NEEDS PRODUCT DECISION]` | Three mutually exclusive outcomes; implementing any one prejudges the product's no-AI positioning | Q1 decided; then run Batch C in a fresh `04` pass (small change + FIX-001 tests already in place as the safety net) |
| FIX-008: GAP-2 superimposition save/list wiring (or preview-only declaration) | `[NEEDS PRODUCT DECISION]` | Wire-or-declare fork; FE flow design depends on outcome | Q2 decided; if wired, write FE save/list component tests RED first, then a comparison-flow E2E |
| FIX-009: GAP-3 CBCT production wiring (finalize into upload completion + CBCT card + viewer link) | `[NEEDS CONFIRMATION]` | V1 scope unconfirmed; wiring effort is wasted if CBCT is post-V1 | Q3 confirmed; if wired, replace/augment harness-route `imaging-cbct.spec.ts` with a production-route E2E |

## 10. Deferred Items

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Analysis-template abstraction (G3) | Gap plan §23 | V2 DEFERRED | Reconciliation verdict: speculative; no current consumer need |
| Soft-tissue analysis, DICOM expansion, ABO 3-point superimposition | Gap plan §23 (STANDARDS_COMPLIANCE backlog) | V2 DEFERRED | Clinical core already meets/exceeds commercial tools; explicit post-V1 backlog |
| Real AI landmark detector | Gap plan §23 | `[NEEDS PRODUCT DECISION]` → currently DO NOT ADD | Binding no-AI non-goal; only a Q1 stance amendment could ever reopen this |
| Expanding the detection-job polling path (`getCephLandmarkDetectionJob`, 0 consumers; detector is synchronous) | Gap plan §6 | `[DO NOT OVERBUILD]` | Infrastructure for an async detector that must not be built |
| KG spine dual-operationId naming cleanup (`ImagingMgmt_*` vs unwrapped ids) | Gap plan §13/§16 | V2 DEFERRED (platform tooling backlog) | Audit-tooling hazard only (false orphans); not a product gap; belongs to a KG-refresh backlog, not this module's `04` pass |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| Anything on the reconciliation do-not-rebuild list: landmark FSM, the 6 analyses, calibration math, the viewer | Gap plan §23 / reconciliation §2 | Already shipped, verified, and protected by 360+ assertions — rebuilding is pure risk `[DO NOT OVERBUILD]` |
| Re-litigating G1/G2/G4/G5/G6 landings, BUG-IMG-001/002 fixes, tier/branch-isolation RBAC, report immutability | Gap plan §26 | All source-verified this audit round; protected by contract pins — do not touch |
| A real AI landmark detector (absent a Q1 stance reversal) | Gap plan §23 | No-AI non-goal is binding product positioning |
| Merging `imaging_finding` and `dental_finding` into one system | Gap plan §3/§21 | Intentional two-system design (image-scoped radiographic FSM vs visit-scoped condition vocabulary); FIX-006 documents this precisely so nobody "unifies" them |
| A new scheduler/cron framework for any future imaging job | Organizer constraint | A job scheduler already exists at `services/api-ts/src/core/jobs.ts`; any future scheduled work must register there. No active fix needs it `[DO NOT OVERBUILD]` |
| `recomputeCephAnalysis` consumer wiring | Gap plan §6/§12 | Benign redundancy (FE computes live via ceph-math); prior verdict: document, don't wire |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause (of the test gap) | The kill-switch was shipped without negative-path coverage; the pin closes the actual hole (unproven OFF behavior). The deeper GAP-1 affordance question is Q1/FIX-007 |
| FIX-002 | Root cause | TanStack Query default retry policy applied to a mutation whose 4xx failures are permanent (tier/flag); `retry: false` (or 4xx predicate) is the correct policy, not a UI band-aid |
| FIX-003 | Root cause | FE affordance was never built (scope ordering); handlers + BR-028 semantics are done — this completes the vertical, it doesn't patch around it |
| FIX-004 | Root cause (of the audit-proof gap) | Tests asserted handler behavior but never the audit side-effect; row assertions make the compliance surface regression-proof |
| FIX-005 | Root cause | Seed breadth was minimal by construction (one ceph chain); additive enrichment, same approach as the prior visit-seed enrichment |
| FIX-006 | Root cause (preventive) | Boundary is intentional but tribal knowledge; documentation is the fix, no code smell exists |
| FIX-007/008/009 | Unclear until decided | Each is a wire-or-declare / keep-or-remove fork — the "root cause" is an open product decision, which is exactly why they are blocked, not active |

## 13. Recommended First Fix Batch

**Batch A — P1 trust-surface hardening (decision-free).**

- **Included Fix IDs:** FIX-001, FIX-002
- **Why first:** It hardens the module's only P1 surface (the FakeDetector/auto-detect path) without waiting on Q1 — the flag-OFF pin is required under every Q1 outcome, and it becomes the safety net that makes the eventual Batch C change trivially safe. FIX-002 is on the identical surface and trivially small, so bundling avoids a second pass over the same files. Lowest risk, highest trust payoff.
- **Tests to write first (RED):**
  1. Backend: `ceph-auto-landmark.test.ts` — flag OFF ⇒ `detectCephLandmarks` rejected, zero landmark rows written.
  2. Frontend: `CephWorkspacePanel.test.ts` — flag-OFF/disabled response path renders the honest "Automatic detection is currently disabled." state; no fixture landmarks committed.
  3. Frontend: `use-ceph-landmarks.test.ts` — 403 ⇒ exactly one request, immediate error (RED until `retry: false` lands).
- **Explicit out-of-scope:** removing or hiding the Auto-detect button (Q1/FIX-007); any detector change beyond what the OFF-test demands; superimposition (Q2); CBCT (Q3); anything in §10/§11.

## 14. Instructions for 04 Fix Prompt

- **Module/group:** Dental Imaging & Ceph
- **Module slug:** `dental-imaging`
- **Fix-ready plan:** `docs/aha/module-fix-plans/dental-imaging-fix-ready-plan.md`
- **Execute first:** **Batch A** (FIX-001, FIX-002). Batch B (FIX-003..006) may follow in the same or a separate pass. Do NOT execute Batches C/D/E (FIX-007/008/009) — blocked on Q1/Q2/Q3.
- **Tests to prioritize (write RED first):** flag-OFF backend pin in `ceph-auto-landmark.test.ts`; flag-OFF/disabled FE state in `CephWorkspacePanel.test.ts`; no-retry-on-4xx pin in `use-ceph-landmarks.test.ts`.
- **Files likely to touch:** `apps/dentalemon/src/features/imaging/hooks/use-ceph-landmarks.ts` (~line 327), `apps/dentalemon/src/features/imaging/components/CephWorkspacePanel.test.ts`, `services/api-ts/src/handlers/dental-imaging/ceph-auto-landmark.test.ts`; possibly a minimal flag guard in `detectCephLandmarks.ts` only if the RED test exposes a hole. Batch B additionally: `patient-image-list.tsx` (+ its test in `features/imaging/__tests__/`), `dental-imaging-events.test.ts`, `scripts/seed-demo.ts`, `docs/product/modules/dental-imaging/MODULE_SPEC.md`.
- **Shared/database cautions:** do NOT modify `@monobase/ceph-math` (version constants feed report pinning — frozen). No schema/migration work is in scope. `scripts/seed-demo.ts` change must be additive; seed through a running API and never against `monobase_test`. Backend tests run via `scripts/test-with-db.ts` with the test DATABASE_URL inline; restart the API on :7213 before contract tests. No cron/scheduler work — if any ever appears, register on existing `core/jobs.ts`, never a new framework.
- **Do not implement:** FIX-007/008/009 (decision-blocked); a real AI detector; detection-job async expansion; `recomputeCephAnalysis` wiring; finding-systems merge; anything on the do-not-rebuild list (§11); V2 deferred items (§10).

---

Next recommended step:
Module/group: Dental Imaging & Ceph
Module slug: dental-imaging
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/dental-imaging-fix-ready-plan.md
Recommended batch: Batch A — P1 trust-surface hardening (FIX-001, FIX-002)
