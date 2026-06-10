# dental-imaging — Module Gap Plan

**Module:** dental-imaging (Imaging & Attachments + Cephalometric workspace)
**Audit date:** 2026-06-09
**Method:** Live browser drive (webwright/Firefox) on branch `chore/workflow-verification-sweep`, app :3003 / API :7213, logged in as Dr. Maria Reyes (dentist-owner). Code + contract + wiring + test inspection.
**Audit decision:** **PARTIAL PASS** — all core clinical-imaging journeys work end-to-end live; gaps are advanced-feature wiring, image-management affordances, one product-alignment contradiction, and test-reachability — no P0 blocker.

---

## Audit Decision: PARTIAL PASS

Core imaging is **production-usable**: upload, view, annotate, findings lifecycle, cephalometric landmarks → analysis (6 protocols) → versioned report, and measurement/calibration all verified live. The 2 historical P0 contract-drift bugs (BUG-IMG-001 finding-create 400; BUG-IMG-002 findings-list shape) are fixed **on this branch** and confirmed non-regressed live (POST /findings → 201, list renders). What holds it back from full PASS: advanced features (CBCT finalize, persisted superimposition) are built+tested but **not wired into the production overlay**, two documented image-management capabilities have no UI, and an AI "Auto-detect" upsell contradicts the documented no-AI product stance.

---

## Expected vs Actual (live-verified)

| Expected (IDEAL §3.10 / §4.5 + ceph PRD) | Actual | Status |
|---|---|---|
| Upload / capture image, categorize by modality | Upload Image + FMX mount in overlay; modality shown | ✅ |
| Link to patient; list patient images | Image list loads (GET 200), ceph image listed | ✅ |
| Preview image | Cephalogram renders crisply, zoom/brightness/contrast/flip | ✅ |
| Annotate (line/angle/area/label/arrow/freehand/shape/tooth) | Full annotation toolbar present | ✅ |
| Finding lifecycle draft→confirmed→resolved | Findings panel: quick-add chips + form; POST 201; list updates | ✅ |
| Calibration + mm measurements | Distance/Angle/Area gated on calibration; "Calibrate now" present | ✅ |
| Ceph landmarking + analysis | Landmark palette (16 + supports), measurements (SNA/SNB/ANB…) | ✅ |
| Multi-protocol analysis | Switcher: Steiner/Ricketts/Downs/Tweed/McNamara/Jarabak; recompute verified | ✅ |
| Versioned ceph report | Generate Report → POST /ceph/reports 201 | ✅ |
| CBCT ingest → finalize → viewer handoff | Components exist on **test-harness route only**; `finalizeCbctStudy` never called from production FE | ⚠️ partial |
| Superimposition over time (durable, auditable) | Preview compute wired; **persist/get/list + SuperimpositionPanel not mounted in production overlay** | ⚠️ partial |
| Modality reclassification / soft-delete image (tsp module purpose) | No UI affordance | ❌ missing UI |
| No AI dependence (IDEAL §12 non-goal: ceph AI auto-tracing) | "Auto-detect landmarks" (FakeDetector behind addon) shipped in ceph panel | ⚠️ contradiction |

---

## Gaps (P0–P3)

### P0 — none
No blocked core workflow, no safety/security hole. RBAC (`assertBranchRole`/`assertBranchAccess`) and addon-tier/kill-switch gates are enforced server-side (verified: detect → 403). Historical P0 contract-drift fixed and live-verified.

### P1
| ID | Gap | Why it matters |
|---|---|---|
| IMG-P1-1 | **AI "Auto-detect landmarks" upsell contradicts the documented no-AI product stance.** Ceph panel (`CephWorkspacePanel.tsx:~295`) renders an enabled lemon-accent "Auto-detect landmarks" button wired to `cephMgmtDetectCephLandmarks`; backend is a **Phase-0 FakeDetector** gated by imaging addon tier + `dental_imaging_auto_landmark` kill-switch. IDEAL §12 + `STANDARDS_COMPLIANCE.md` explicitly list cephalometric **AI auto-tracing as an intentional non-goal** ("product is local-first / no-AI"). | Direct spec↔product contradiction. If the addon is ever enabled, a clinician clicks "Auto-detect" and a **fake detector** places plausible-but-synthetic landmark predictions presented as suggestions — a clinical-trust risk on a measurement tool. Needs an explicit product decision: remove/keep, and if kept, guarantee a real detector before the addon is sellable. `[NEEDS CONFIRMATION]` |

### P2
| ID | Gap | Why it matters |
|---|---|---|
| IMG-P2-1 | **Persisted superimposition unreachable.** `createCephSuperimposition` / `getCephSuperimposition` / `listCephSuperimpositions` have **zero FE consumers**; `SuperimpositionPanel.tsx` consumes only `previewCephSuperimposition` and is **not mounted** in the production ceph overlay (only the harness route). | Backend + TypeSpec (P1-11, D-I "immutable versioned, durable, auditable") promise a saved, longitudinal superimposition timeline; clinician can only compute an ephemeral preview — no save, no history, no audit. Capability exists but is dead from the UI. |
| IMG-P2-2 | **CBCT chain only wired on the test-harness route.** `imaging-cbct.spec.ts` drives `imaging-test.tsx` with a **mocked** viewer-link; `finalizeCbctStudy` is never called from production FE → volume metadata (`is_volume`/`frameCount`/`sliceThickness`) never populated in real use; CBCT study card / volume badge / open-viewer mount on the harness route, reachability from the patient overlay unconfirmed. | The documented CBCT ingest→finalize→viewer workflow (P2-7) is not completable by a clinician through the normal overlay. Passing E2E gives false confidence. `[NEEDS CONFIRMATION]` whether the upload form even offers `modality='cbct'` in the production overlay. |
| IMG-P2-3 | **Auto-detect 403 is retried, with delayed/absent feedback.** Clicking auto-detect fires the POST 3× (TanStack default retry) against a permanent `403 IMAGING_TIER_REQUIRED` / `FEATURE_DISABLED`; observed ≥5 s stuck on "Detecting…" with no error rendered. The `data-ai-detect-error` branch exists but only after retries exhaust; button isn't proactively disabled by known tier. | Retrying a permanent authz failure is wrong; the clinician sees a long misleading spinner. Fix is small (`retry:false` on 4xx + proactive gating). |

### P3
| ID | Gap | Why it matters |
|---|---|---|
| IMG-P3-1 | **No modality-reclassify / delete-image affordance.** `updateImageModality` + `deleteImage` (both explicit tsp module purposes) have no UI consumer (`deleteMeasurement` IS wired; `deleteImage` is not). | Documented capabilities unreachable; minor — admin/cleanup ops. |
| IMG-P3-2 | **`recomputeCephAnalysis` + `getCephLandmarkDetectionJob` unwired (benign).** `getCephAnalysis` already computes on read; Phase-0 detector resolves synchronously so the job-poll is never needed. | Informational — not real gaps; flag so future audits don't re-flag. |
| IMG-P3-3 | **Test-harness routes mask production reachability.** `imaging-test.tsx` + `imaging-comparison-test.tsx` mount CBCT/comparison/superimposition components that E2Es assert against (often with mocked network), independent of the production overlay. | Green E2Es can hide whether a clinician can actually reach a feature (echoes the project's recurring mocked-test-trust theme). |

---

## Broken / Misleading Journeys
1. **Auto-detect landmarks (IMG-P2-3 / IMG-P1-1):** enabled button → prolonged "Detecting…" → eventual (or no) upsell error; advertises an AI capability the product documents as a non-goal.
2. **CBCT (IMG-P2-2):** a clinician cannot complete upload→finalize→view through the production overlay; only the harness route + mock proves it.
3. **Superimposition (IMG-P2-1):** "compare over time" computes but cannot be saved or revisited.

## Unused / Unwired Implementation (zero production-FE consumer)
`getImagingStudy`, `updateImageModality`, `deleteImage`, `finalizeCbctStudy`, `recomputeCephAnalysis`, `getCephLandmarkDetectionJob`, `createCephSuperimposition`, `getCephSuperimposition`, `listCephSuperimpositions`. (`getImagingStudy` is likely covered by the union `listPatientImages` read; the rest are genuine wiring/affordance gaps above.)

---

## Knowledge-Graph Findings
- KG is **stale** (`meta.json` @ commit `1196799b`, ~Jun 6; HEAD `e49e411d`). Prior audits established the drift is **type-import-only**, no architectural change, so the graph was **not regenerated** (full rebuild ≈ multi-M tokens, poor ROI for one module). Wiring was established directly from code/contract/registry instead — authoritative.
- Authoritative wiring map for this audit: **29 backend operations** (registry-confirmed) across 4 interfaces; **20** have a production-FE consumer; **9** do not (listed above). RBAC verified present in all mutating handlers; addon-tier/kill-switch gating on detect verified live (403).

## Cross-Module Dependencies / Blast Radius
- **storage** (S3/MinIO presigned upload/download — `readyz` must be green), **dental-visit** (findings derive `visitId`/`patientId`/`branchId` from the parent study; finding has `treatmentId` link to convert finding→treatment), **dental-patient** (patient image list union with legacy `dental_attachment`), **dental-org** (branch role + addon tier + feature flags), **billing/treatment** (finding→treatment linkage). Changes to the finding wire-shape or the derive-from-resource invariant ripple to dental-visit; changes to `listPatientImages` union ripple to legacy attachments.

---

## Existing Tests
- **Backend:** 11 test files (`imaging.test.ts`, `imaging-integration.test.ts`, `ceph.test.ts`, `ceph-business-rules.test.ts`, `ceph-auto-landmark.test.ts`, `cephSuperimposition.test.ts`, `dicom-parse.test.ts`, FSM property tests, `imaging-coverage.test.ts`, `dental-imaging-events.test.ts`).
- **FE:** 35 test files across components/hooks/lib.
- **E2E:** `journeys/11-ceph-tier-gate`, `12-ceph-landmarks-numeric`, `13-ceph-locked-landmark`, `14-ceph-report-snapshot`; specs `imaging-ceph`, `imaging-ceph-export`, `imaging-ceph-auto-landmark`, `imaging-cbct`, `imaging-comparison`, `imaging-findings`, `imaging-annotation`, `imaging-measurement`, `ipad-imaging`.
- **Contract:** `dental-imaging.hurl` (incl. minimal-body finding → 201 + list `$.items` pins from the BUG-IMG-001/002 fix), `dental-imaging-cbct.hurl`.

## Missing / Recommended Tests (add before/during each fix)
| For gap | Test to add | Layer |
|---|---|---|
| IMG-P1-1 | Decision-dependent: if removed, FE test asserts no `detectCephLandmarks` affordance renders; if kept, a guard test that the detector is real (not FakeDetector) before addon-enabled, + disclosure copy test | FE / backend |
| IMG-P2-1 | FE: SuperimpositionPanel mounted in overlay drives preview→**persist** (`createCephSuperimposition`) and timeline (`listCephSuperimpositions`); contract hurl for persist/list `$.items` | FE + contract |
| IMG-P2-2 | **Production-overlay** CBCT E2E (not harness route): upload `cbct` → `finalizeCbctStudy` → volume badge/open-viewer; contract hurl for finalize populating `isVolume` | E2E + contract |
| IMG-P2-3 | FE/unit: auto-detect mutation `retry:false` on 4xx; tier-gate journey asserts upsell error surfaces **immediately** (no prolonged Detecting) | FE / E2E |
| IMG-P3-1 | FE: modality-reclassify + delete-image affordances drive `updateImageModality`/`deleteImage`; permission test (front-desk denied) | FE + backend |
| All | **One production-overlay golden journey** on a real seeded patient (Miguel): patient → imaging tab → image → finding 201 → ceph landmarks → analysis (switch protocol) → report 201 — codify the path this audit drove manually | E2E |

---

## Recommended Fix Order
1. **IMG-P1-1 (product decision first)** — resolve the AI auto-detect vs no-AI-non-goal contradiction. This determines whether IMG-P2-3 is "fix the upsell" or "remove the button." Add the corresponding test.
2. **IMG-P2-3** — quick win: `retry:false` on 4xx for the detect mutation + proactively disable/replace the button when tier/flag are known-off. (Trivial; pair with #1.)
3. **IMG-P2-1** — mount `SuperimpositionPanel` in the production ceph overlay and wire persist + timeline (preview→create→list). Add FE + contract tests.
4. **IMG-P2-2** — wire `finalizeCbctStudy` into the real upload flow and confirm the CBCT card/viewer is reachable from the patient overlay; replace the harness-route+mock E2E with a production-overlay E2E. `[NEEDS CONFIRMATION]` on upload-form CBCT modality option.
5. **IMG-P3-1** — add modality-reclassify + delete-image affordances with permission tests.
6. **IMG-P3-3 / IMG-P3-2** — add the production-overlay golden journey (covers reachability for the whole module); document the benign-unwired endpoints so future audits skip them.

## `[NEEDS CONFIRMATION]` items
- IMG-P1-1: Is shipping an AI "Auto-detect landmarks" upsell an intentional reversal of the documented no-AI non-goal, or should the affordance be removed? Is the addon-enabled detector real or still the FakeDetector?
- IMG-P2-2: Does the production imaging-upload form offer `modality='cbct'`, and is the CBCT study card reachable from the patient overlay (vs the `imaging-test.tsx` harness only)?
- IMG-P2-1: Is ephemeral preview-only superimposition an intentional V1 scope cut, or is the persisted timeline expected for V1?
- `getImagingStudy`: confirm it's intentionally superseded by the `listPatientImages` union read (no standalone study-detail view needed).
