# Module Audit — dental-imaging

**Date:** 2026-06-08
**Branch:** feat/module-workflow-alignment
**Auditor:** per-module deep audit + safe-gap closure (adversarial; verified against source)
**Verdict:** ✅ **READY** — no behavioral bug found. The imaging module (29 ops across 4 interfaces incl. the v1.4 ceph sub-feature) is fully implemented, branch-isolated, tier-gated, and audited; every PHI read/write derives its branch from the resource, never the caller. Closed 1 REAL adversarial test gap (cross-branch radiograph PHI isolation — a same-org member of a *different* branch is denied, beyond the existing no-membership OUTSIDER case) + 5 doc/registry drift reconciliations (MODULE_SPEC permissions/edge-cases/errors, DOMAIN_MODEL SM-01 mislabel, br-registry CIMG-001/002/010 stale tier+analysis claims). Gates green.

---

## STEP 0 — Artifacts & /module-review

| Artifact | Location | Status |
|----------|----------|--------|
| Handler dir | `services/api-ts/src/handlers/dental-imaging/` | ✅ ~25 impl handlers (ImagingMgmt + ImagingFindings + PatientImageListing + CephManagement) each with a thin `*Mgmt_*` generated wrapper; `repos/` (imaging, finding, ceph, dicom-parse, ceph-landmark-detector, erasure facade) |
| TypeSpec | `specs/api/src/modules/dental-imaging.tsp` | ✅ present — 29 ops; full absolute paths on ImagingFindings/CephManagement ops to defeat the documented interface-`@route`-drop codegen bug (a real P0-prevention note) |
| MODULE_SPEC / API_CONTRACTS | `docs/product/modules/dental-imaging/` | ✅ present (carried drift: §6 permissions stale on hygienist/assistant capture; §13 NOT_CALIBRATED-before-landmark wrong; §15 error table incomplete — all reconciled) |
| Tests | 11 `*.test.ts` (~685 assertions) | ✅ present — real-DB integration (`imaging-integration.test.ts`), mock-DB unit (`imaging.test.ts`, `ceph.test.ts`, `ceph-business-rules.test.ts`, `imaging-coverage.test.ts`), 2 FSM property tests, dicom-parse, events, ceph-auto-landmark, cephSuperimposition |
| Routes | `generated/openapi/{registry,routes}.ts` | ✅ wired (28 imaging/ceph route refs) |
| Contract | `dental-imaging.hurl` (47 req) + `dental-imaging-cbct.hurl` (15 req) | ✅ present |
| Ceph math | `packages/ceph-math/` (isomorphic engine) | ✅ 6 analyses (steiner_hybrid_sn, ricketts, downs, tweed, mcnamara, jarabak) + superimposition; own pinned-value test suite (`analyses`/`ricketts`/`superimposition`/`norms`/`pattern` tests) |
| Frontend | imaging workspace + ceph workspace (loupe/keyboard/Ricketts switcher, superimposition) | ✅ full-stack SHIPPED (per IDEAL §3.5/§3.10) |

**/module-review result:** **PASS** — no `test.skip`/`xit`/`.only`; no `Not implemented` stub; no TODO/FIXME/HACK in handler code; no non-test `as any`. TypeSpec ops ↔ handler names match. Audit logging present on every create/update/delete + on PHI reads (study read, patient-image list, ceph-analysis read, CBCT viewer-link).

---

## STEP 3 — KG mapping (query-only)

`.understand-anything/domain-graph.json` maps `domain:diagnostic-imaging`,
`flow:capture-imaging-study` (+ steps create-study / calibrate / measure / finding /
finalize-cbct) and `flow:cephalometric-analysis`. Summaries are **honest and current** —
"6 analyses, landmark detection, superimposition, **calibration-safe measurements**",
"FMX/BW/PA/CBCT", "**dental_assistant may perform all capture steps**". **No over-claims.**

**KG-backlog (lossy, not a blocker):** the graph does not model the finding FSM (SM-01
draft→confirmed→resolved) nor the ceph-landmark FSM (placed→confirmed→locked) as distinct
nodes, and does not surface the addon-tier gate or the soft-delete/legacy-attachment union
as steps. Fix on next KG regeneration (not regenerated this round).

---

## STEP 6 — Traceability Matrix

| Item | Spec? | Impl? | KG | Test (file) | Strength | Verdict |
|------|-------|-------|----|-------------|----------|---------|
| **WF-019** upload study → presigned PUT, or S3 multipart envelope for large DICOM/CBCT | ✅ | ✅ createImagingStudy | ✅ flow | imaging-integration.test.ts:294 (+ multipart routing :1004) | VERIFIED | 🟢 |
| **BR-034** MIME allowlist → 422 UNSUPPORTED_MIME_TYPE | ✅ | ✅ createImagingStudy:58 | ✅ | imaging-integration.test.ts:332; imaging.test.ts | VERIFIED | 🟢 |
| **BR-033 / FILE_TOO_LARGE** per-modality byte ceiling → 422 | ✅ | ✅ createImagingStudy:116 | NONE | imaging.test.ts (size) | VERIFIED | 🟢 |
| **BR-016c / CIMG-001/002 / AC-IMG-001** ceph+CBCT require `addon`; `!== 'addon'` blocks free/basic/null → 403 IMAGING_TIER_REQUIRED (gated at study create AND every ceph op) | ✅ | ✅ createImagingStudy:90; getCephAnalysis:54; all CephMgmt_* | ✅ | imaging-integration.test.ts:365,1021; ceph.test.ts:382,422; imaging-coverage.test.ts:1230 (basic→403) | VERIFIED | 🟢 |
| **AC-IMG-004** study image stored in S3; presigned URL returned, not bytes | ✅ | ✅ createImagingStudy (uploadUrl); listPatientImages downloadUrl; getCbctViewerLink | ✅ | imaging-integration.test.ts:313,1109,1156 | VERIFIED | 🟢 |
| **WF-040 / SM-01 / AC-IMG-002** finding create default `draft`; confirmed→draft rejected 422 INVALID_STATUS_TRANSITION; resolved terminal | ✅ | ✅ createFinding; updateFinding (FINDING_TRANSITIONS) | partial | imaging-integration.test.ts:481,601; imaging-finding.fsm.property.test.ts | VERIFIED | 🟢 |
| **V-IMG-008** annotations carry NO state machine (`visible` flag only); SM-01 belongs to *finding* | ✅ | ✅ imaging.schema (no annotation FSM) | NONE | imaging-integration.test.ts (measurements list/delete) | VERIFIED (by source) | 🟢 |
| **BR-026/027** delete default-deny; only dentist/associate; associate own-acquired only → 403 | ✅ | ✅ deleteImage (ROLES_ALLOWED_TO_DELETE + acquiredBy) | NONE | imaging-integration.test.ts:839,847,856; imaging.test.ts:846,938 | VERIFIED | 🟢 |
| **BR-028** soft-delete only (status='archived') | ✅ | ✅ imaging.repo.archiveImage | NONE | imaging-integration.test.ts:824 (archived disappears from list) | VERIFIED | 🟢 |
| **BR-029 / branch isolation** every handler derives branch from resource + assertBranchAccess/Role; non-ceph no-access → 403, ceph → 404-mask | ✅ | ✅ all handlers (study/image→study) | ✅ | imaging-integration.test.ts:418,462,778; ceph.test.ts:441 (404-not-403) | VERIFIED | 🟢 |
| **V-IMG-002 cross-branch PHI** same-org member of a *different* branch denied a radiograph | implied | ✅ branch-from-resource | — | **imaging-integration.test.ts (NEW: getImagingStudy 403 + listPatientImages 403 + no-leak)** | VERIFIED (after new test) | 🟢 |
| **BR-030** legacy `dental_attachment` union adapter (xray/photo/scan; doc/deleted excluded) | ✅ | ✅ listPatientImages + clinical-imaging.facade | partial | imaging-coverage.test.ts (mapLegacyAttachment) | VERIFIED | 🟢 |
| **Measurements** calibration-safe; mm metric on uncalibrated/anisotropic → 422 NOT_CALIBRATED (recompute only; landmark placement does NOT require calibration) | impl-only | ✅ recomputeCephAnalysis:97 | NONE | ceph-business-rules.test.ts:527 (calibrationMethod not_calibrated + mm null) | VERIFIED | 🟢 |
| **CIMG-003/004/005/014** ceph landmark FSM placed→confirmed→locked; locked immutable (PATCH/DELETE → 422 LANDMARK_LOCKED) | ✅ | ✅ updateCephLandmark/deleteCephLandmark | partial | ceph-business-rules.test.ts:406,426; ceph-landmark.fsm.property.test.ts; ceph.test.ts | VERIFIED | 🟢 |
| **CIMG-006** report gate: A/B/Go/Po all `confirmed` else error | ✅ | ✅ CEPH_REPORT_GATE_LANDMARKS + createCephReport | NONE | ceph.test.ts; ceph-business-rules.test.ts | VERIFIED | 🟢 |
| **CIMG-008/012/042** ceph report immutable, monotonic version per image (unique idx) | ✅ | ✅ imaging_ceph.schema | NONE | ceph.test.ts (version monotonicity) | VERIFIED | 🟢 |
| **CIMG-010** analysisType selected by `?analysisType=`, defaults steiner; **6 analyses ship**; unknown → 422 UNSUPPORTED_ANALYSIS_TYPE | impl-only (was registry-stale) | ✅ getCephAnalysis:30; ANALYSIS_TYPES | ✅ | ceph-business-rules.test.ts:462 | VERIFIED | 🟢 |
| **P2-7 CBCT** multipart create + finalize DICOM parse (is_volume/spacing/frame/UIDs) + malformed → 422 INVALID_DICOM w/ no half-write + viewer-link presigned (404-safe, NOT_A_VOLUME guard) | impl-only | ✅ finalizeCbctStudy / getCbctViewerLink / dicom-parse | partial | imaging-integration.test.ts:1037,1056,1108,1125 | VERIFIED | 🟢 |
| **P1-10 auto-landmark detect** (FakeDetector SEAM, drafts-only, addon+kill-switch gated; AI output never auto-confirms) | impl-only | ✅ detectCephLandmarks | NONE | ceph-auto-landmark.test.ts | VERIFIED | 🟢 |
| **P1-11 superimposition** v1 cranial-base S–N only; non-cranial_base → 422 SUPERIMPOSITION_NOT_IMPLEMENTED; mm gated on both-timepoint calibration | impl-only | ✅ cephSuperimposition + ceph-math | partial | cephSuperimposition.test.ts; ceph-math superimposition.test.ts | VERIFIED | 🟢 |
| **DE-018/019/020** domain events = audit-log markers (ADR-006, no bus) | ✅ | ✅ logAuditEvent on create/finding/recompute | NONE | dental-imaging-events.test.ts | VERIFIED | 🟢 |

---

## STEP 7 — Gaps Closed This Round

### REAL test gap closed (adversarial; GREEN — guard already present, now pinned)

| # | Gap | Class | Fix |
|---|-----|-------|-----|
| 1 | **Cross-branch radiograph PHI isolation was untested for a *member of another branch*.** The only branch-isolation negatives used `OUTSIDER` (no membership anywhere). A member of `OTHER_BRANCH` (same org, full `dentist_owner` role) was never proven to be denied a radiograph in `BRANCH_ID` — exactly the carry-forward class (caller-supplied/own-branch context must not unlock a resource in a branch the caller doesn't belong to; V-PAT-002 → V-VIS-011). By source the handlers derive branch from `study.branchId` and call `assertBranchAccess`, so they ARE safe — but the invariant had no pin. | REAL test gap (PHI) | Seeded `OTHER_BRANCH_DENTIST` (membership only in `OTHER_BRANCH`, full role). Added 3 cases to `imaging-integration.test.ts`: (a) `getImagingStudy` of a `BRANCH_ID` study → **403**; (b) `listPatientImages?branchId=BRANCH_ID` → **403** (caller not a member of that branch); (c) `listPatientImages?branchId=OTHER_BRANCH_ID` → **200 but zero imaging items** (no cross-branch leak). |

### Doc / registry / comment drift reconciled

| # | Drift | Fix |
|---|-------|-----|
| 2 | **DOMAIN_MODEL §5 entity table mislabeled SM-01.** Line 83 attributed SM-01 to `ImagingAnnotation`; line 84 omitted it from `ImagingFinding`. SM-01 (`draft→confirmed→resolved`) is the **finding** FSM; annotations carry **no** state machine (V-IMG-008) — exactly backwards. | Corrected: annotation row = "presentation overlays; `visible` flag only — no state machine (V-IMG-008)"; finding row = "carries SM-01 (draft→confirmed→resolved)". |
| 3 | **MODULE_SPEC §6 permissions stale.** Listed only dentist_owner/associate for upload; the handler (`createImagingStudy` `assertBranchRole`) and the authoritative ROLE_PERMISSION_MATRIX both allow **hygienist + dental_assistant** to *capture* (E2/E3, under supervision), while delete/calibration/modality and CBCT finalize stay dentist-only. | Rewrote §6 with: capture (4 roles), CBCT finalize (dentist-only), image-management (dentist-only), ceph (addon-gated), view (all clinical, with the 403/404-mask split). |
| 4 | **MODULE_SPEC §13 edge case wrong + §15 error table incomplete.** §13 claimed "Calibration not set before landmark placement → 422 NOT_CALIBRATED" — false; landmarks place uncalibrated and `NOT_CALIBRATED` fires only on a *mm-metric recompute*. §15 omitted FILE_TOO_LARGE / UNSUPPORTED_ANALYSIS_TYPE / INVALID_DICOM / LANDMARK_LOCKED / NOT_A_VOLUME / ceph-404-mask. | §13 corrected (landmark placement needs no calibration; analysisType-unknown → 422); §15 error table expanded to the real code set with the tier note (free/basic/null all blocked). |
| 5 | **br-registry CIMG-001/002 understated the tier gate.** Said "free or null → 403", omitting that **`basic` is also blocked** (`!== 'addon'`, proved by `imaging-coverage.test.ts` EF-IMG-009 basic→403). Also failed to note the create-time gate. | Rewrote CIMG-001 (strict `!== 'addon'`; free AND basic blocked; gated at create too) + CIMG-002 (null = no-access). |
| 6 | **br-registry CIMG-010 stale.** Claimed "analysisType is always 'steiner_hybrid_sn'. No other analysis type exists in v1.4." Six analyses now ship and `getCephAnalysis` takes an `?analysisType=` param (unknown → 422). | Rewrote CIMG-010: param-selected, default steiner, 6 protocols, unknown → 422 UNSUPPORTED_ANALYSIS_TYPE, response echoes requested type; cited `@monobase/ceph-math` ANALYSIS_TYPES. |

---

## Ranked Remaining Gaps (surfaced, NOT closed — out of safe scope)

**Intentional non-goals (do NOT build — per IDEAL §12 / clinical-standards record):**
1. **Cephalometric AI auto-tracing** is an intentional non-goal (local-first / no-AI product stance). The shipped `detectCephLandmarks` is a *FakeDetector seam* that produces source='ai', status='placed' **drafts only** behind the addon tier + `dental_imaging_auto_landmark` kill-switch — it never auto-confirms/auto-finalizes (the human report-gate is the review boundary). Not a non-goal violation; do not propose enabling a real model.
2. **Full DICOM viewer / soft-tissue ceph / structural (ABO-grade) superimposition** are deferred V2 (superimposition v1 is honestly labeled a two-point S–N similarity registration; non-cranial_base → 422). Surface only.

**REAL test gaps (impl present, assertion not added this round):**
3. **Audit-row assertions for imaging writes/reads.** `logAuditEvent` is present on study create, finding create, patient-image list, ceph-analysis read, and CBCT viewer-link, but no test asserts the `dental_audit_log` row is actually written (by-source-present, not pinned). Mirrors the dental-perio cascade-audit-row gap.
4. **detectCephLandmarks kill-switch OFF path.** The addon-tier 403 is covered, but no test asserts the `dental_imaging_auto_landmark` feature-flag-OFF branch returns its disabled response (FakeDetector resolves synchronously in tests with the flag context defaulted).

**Doc/product decisions (not unilaterally changed):**
5. **403-vs-404 asymmetry across imaging.** Non-ceph image/finding handlers return **403** on no branch access; ceph handlers deliberately **404-mask** (info-hiding, CIMG-007). Both are defensible, but the split is implicit — a one-line API_CONVENTIONS note on *when* to mask would remove future ambiguity. Surfaced, not changed.

**KG-backlog:** finding FSM (SM-01), ceph-landmark FSM (placed/confirmed/locked), the addon-tier gate, and the legacy-attachment union are not modeled as distinct nodes — fix on next KG regeneration.

---

## STEP 8 — Gate

| Gate | Result |
|------|--------|
| `cd services/api-ts && bunx tsc --noEmit` | ✅ 0 errors |
| dental-imaging module suite (`test-with-db.ts`, 11 files) | ✅ **360 pass / 0 fail** (357 baseline + 3 new cross-branch cases) |
| `eslint` (changed test file) | ✅ 0 errors, 0 warnings |
| `check:boundaries` | ✅ no cross-module repo violations |
| br-registry.json | ✅ valid JSON |
| Contract suite (fresh `:7213`, restarted) | ✅ **`dental-imaging.hurl` Success (47 req)** + **`dental-imaging-cbct.hurl` Success (15 req)**. The 3 failures are **pre-existing environmental, outside this module** (auth-verification + auth-password-reset: mailpit down; billing-lifecycle: Stripe) — identical to the prior six rounds. |

---

## Files Changed

- `services/api-ts/src/handlers/dental-imaging/imaging-integration.test.ts` — **NEW** `OTHER_BRANCH_DENTIST` member + 3 cross-branch PHI-isolation tests (getImagingStudy 403 / listPatientImages 403 / own-branch no-leak)
- `docs/product/DOMAIN_MODEL.md` — fixed SM-01 mislabel (finding carries SM-01; annotation has none)
- `docs/product/modules/dental-imaging/MODULE_SPEC.md` — §6 permissions (capture roles + finalize/management split), §13 edge cases (no-calibration-for-placement; analysisType), §15 error table expanded
- `specs/api/docs/standards/br-registry.json` — CIMG-001/002 (strict `!== 'addon'`, basic blocked), CIMG-010 (6 analyses, param-selected, 422 on unknown)
- `docs/audits/modules/MODULE_dental-imaging_AUDIT_2026-06-08.md` — this report
- `docs/audits/MODULE_AUDIT_TRACKER.md` — rollup entry + BR-016c carry-forward resolved
