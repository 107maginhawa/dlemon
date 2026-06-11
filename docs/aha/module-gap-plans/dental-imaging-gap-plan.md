# AHA Module/Group Gap Plan: Dental Imaging & Ceph

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Dental Imaging & Ceph |
| Module slug | dental-imaging |
| Type | Business Module |
| Output file | `docs/aha/module-gap-plans/dental-imaging-gap-plan.md` |
| Primary PRD/spec used | `docs/context/CEPH_TRACING_MODULE_PRD_AND_IMPLEMENTATION_GUIDE.md` (ceph PRD) + `docs/product/modules/dental-imaging/MODULE_SPEC.md` + `API_CONTRACTS.md` |
| Supporting PRDs/specs used | `docs/reviews/research/ceph-guide-reconciliation.md` (freshest reconciliation, G1–G6 verdicts + do-not-rebuild list); `docs/prd/BUSINESS_RULES.md` BR-023..047 + CIMG-001..015; PRD FR1.21 boundary; `docs/clinical/STANDARDS_COMPLIANCE.md` (ship-as-is; **no-AI non-goal binding**) |
| PRD/spec coverage quality | Strong |
| Paths inspected | `services/api-ts/src/handlers/dental-imaging/` (≈30 ops, 17 test files ~10K lines, 3 schema/repo pairs incl. `ceph-landmark-detector.ts`); FE `features/imaging/` (14 components + 9 hooks); `workspace-imaging-overlay.tsx` (mount chain); `dental-imaging.hurl` (47) + `dental-imaging-cbct.hurl` (15) |
| PRDs/specs inspected | All above |
| KG used | Yes — spine consumer mapping; **caveat: dual operationId naming (`ImagingMgmt_*` interface variants vs unwrapped ids) makes some spine zero-consumer rows artifacts — every orphan claim below was grep-verified individually** |
| KG refreshed | No |
| `/understand-domain` used | Yes (cross-check only) |
| `/understand-domain` refreshed | No |
| Webwright used | No — module live-driven repeatedly (2026-06-08 imaging run; 4 real-API ceph journeys); this round's claims are static (mounts, callers, snapshot fields) and orchestrator-verified |
| Playwright/E2E inspected | Yes (inspected): 4 ceph journeys (11–14), imaging-cbct (harness-route), imaging-comparison, imaging-findings, imaging-annotation, ipad-imaging |
| Existing tests inspected | 17 backend files (360+ assertions), 62 contract requests, 40 FE/E2E files |
| Cross-cutting audit reviewed | Not Available |
| Database/schema audit reviewed | Not Available |
| Limitations | No tests executed; seed data limits runtime verification (only Miguel Torres has a viewable ceph image) |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| Ceph PRD | `docs/context/CEPH_TRACING_..._GUIDE.md` | PRD (module) | Current | tracing workflow, landmarks ×16, calibration, analyses, immutable reports, sign-off |
| Ceph reconciliation | `docs/reviews/research/ceph-guide-reconciliation.md` | reconciliation | Current (2026-06-10) | G1 revision-lineage RESOLVED (9f16b0a0), G2 version-pinning RESOLVED (8975a1d2), G3 template DEFERRED, G4 sign-off split RESOLVED (075843ab), G5a/b metadata+links RESOLVED (ca018f79/bcc5dfab), G6 versioned calibration RESOLVED (4f2037a3); do-not-rebuild list binding |
| Business rules | BR-023..035 + BR-036..047 + CIMG-001..015 | business rules | Current (load-bearing) | 45/45 implemented+tested per prior audit |
| Clinical standards | `docs/clinical/STANDARDS_COMPLIANCE.md` | regulatory | Current | ceph meets/exceeds commercial tools; **no-AI auto-tracing is a product non-goal** |
| Module spec + contracts | `docs/product/modules/dental-imaging/` | module spec | Current (reconciled) | FSMs (landmark, finding), tier gating, RBAC |
| Prior audit + gap plan + matrix | 2026-06-08 artifacts | prior audit (pre-AHA) | Partially superseded (BUG-IMG-001/002 fixed+pinned; G-backlog landed) | §3 |

## 3. Expected vs Actual

**Expected:** the imaging vertical — studies/images with metadata/quality/tags and context links, annotations as stateless overlays, radiographic findings with FSM, full manual ceph tracing (16 landmarks, FSM placed→confirmed→locked, calibration-safe math, 6 analyses × 6 norm populations, immutable versioned reports pinning every input, assistant-prepares/dentist-finalizes), CBCT (addon-tier gated), superimposition, comparison — **manual-first, no AI** per binding non-goal.

**Actual: the healthiest large module.** Re-verified this round:

- **The entire 2026-06-10 reconciliation backlog is landed:** G2 snapshot pinning in source (`createCephReport.ts:154-167` — analysis_type/norm_population/norm_version/formula_version/calibration.version from `@monobase/ceph-math` constants); G4 role split (`CEPH_DRAFT_ROLES` vs `CEPH_SIGNOFF_ROLES`, prepared_by≠finalized_by); G6 append-only `imaging_calibration` (mig 0097) with server-derived `pixelSpacingMm`; G5a metadata + PATCH endpoint (mig 0098); G5b `imaging_link` joins (mig 0099); G1 resolved as revision lineage (mig 0096) — no session FSM by decision.
- **BUG-IMG-001/002 fixes hold** (server-derived visitId/patientId/branchId in `createFinding.ts:75-86`; `{items}` envelope `listFindings.ts:61`) with contract pins.
- **Two finding systems are intentional and separate:** `imaging_finding` (radiographic, image-scoped, 15 types, draft→confirmed→resolved) vs `dental_finding` (visit-scoped condition vocabulary, converts to treatment — dental-visit slice C). No cross-call; loose `treatmentId` ref only.
- **Superimposition is partially reachable:** `ComparisonView` mounts in production via `workspace-imaging-overlay.tsx:4,48-50`, and **preview** is wired (`use-ceph-superimposition` → preview op). But the **persistence trio** (`createCephSuperimposition`/`getCephSuperimposition`/`listCephSuperimpositions`) has zero consumers — superimpositions are session-only, never saved (IMG-P2-1 narrowed, not closed).

What remains:

1. **IMG-P1-1 stands — the no-AI contradiction.** `CephWorkspacePanel.tsx:311-330` renders an enabled "Auto-detect landmarks" button calling `detectCephLandmarks`, backed by a **deterministic `FakeDetector`** (`ceph-landmark-detector.ts:52-64`, provider `'fake'`, Phase-0 fixture) behind the `dental_imaging_auto_landmark` flag + addon tier. Provenance badging ("AI · unconfirmed", confirm-each-before copy) is honest UX, but a fake detector behind a real production button contradicts the binding no-AI stance and the flag-OFF path is untested.
2. **CBCT finalize chain not production-wired:** `finalizeCbctStudy` (+ viewer-link flow) has zero production FE consumers; only the harness-route E2E exercises it.
3. **Superimposition persistence** (above) — wire save/list or declare preview-only.
4. **Small affordance/polish items:** no delete-image/reclassify-modality UI (handlers ready), autoDetect mutation lacks `retry:false` on 4xx (≥5s spinner on permanent 403), audit-row assertions missing for imaging `logAuditEvent` calls, seed has one ceph-viewable patient.

## 4. PRD / Spec Coverage Matrix

(Condensed; 45/45 BR/CIMG rows were verified in the 2026-06-08 audit and are not re-litigated.)

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Manual tracing: 16 landmarks, FSM, guided placement | placed→confirmed→locked; locked immutable | ✓ | CephWorkspacePanel + palette | landmark handlers | landmark FSM | CIMG-003..005 (8) | Implemented | No |
| Calibration (manual ruler) + versioned record (G6) | server-derived mm/px, append-only versions | ✓ | calibration-dialog | calibration handlers | `imaging_calibration` mig 0097 | BR-039/040 | Implemented | No |
| 6 analyses × 6 norms, calibration-safe math | live compute; null-safe | ✓ | measurements panel | ceph-math pkg | norms.ts | geometry+dependency tests | Implemented | No |
| Immutable versioned reports + full pinning (G2) | snapshot pins all inputs | ✓ | CephReportView + export | `createCephReport.ts:154-167` | unique(image,version) | CIMG-008/BR-042 + pinning tests | Implemented | No |
| Sign-off split (G4) | assistant places; dentist finalizes | ✓ | signoff gate UI | role consts (075843ab) | prepared/finalized cols | 403 pins | Implemented | No |
| Revision lineage (G1 decision) | re-report links prior + reason | ✓ | — | mig 0096 | revision_of/reason | tests | Implemented | No |
| Library metadata + links (G5a/b) | diagnostic/quality/tags + context links | ✓ | metadata editor + badges | PATCH metadata; link CRUD | migs 0098/0099 | tests | Implemented | No |
| Radiographic findings FSM | draft→confirmed→resolved; server-derived scoping | ✓ (BUG-IMG-001/002 fixed) | FindingsSidebar | `createFinding.ts:75-86`; `listFindings.ts:61` | imaging_finding | contract pins :535/:606 | Implemented | No |
| **No-AI stance** | manual-first; no auto-tracing | **Contradicted by flag-gated FakeDetector button in production panel** | `CephWorkspacePanel.tsx:311-330` | `ceph-landmark-detector.ts:52-64` | — | flag-OFF path untested | Unclear | **GAP-1** |
| Superimposition | compare + persist sessions | Preview ✓ (production via overlay); persist trio 0 consumers | `workspace-imaging-overlay.tsx:48-50` | persist handlers | superimposition table | preview tests | Partially Implemented | **GAP-2** |
| CBCT chain (addon tier) | upload→finalize→viewer | Tier gating + handlers ✓; finalize/viewer not production-wired | harness route only | `finalizeCbctStudy` 0 prod consumers | study types | cbct hurl (15) via harness | Partially Implemented | **GAP-3** |
| Image admin (delete/reclassify) | soft-delete + modality fix affordances | ✓BE; no UI | — | handlers ready | archived status | BR-028 | Partially Implemented | GAP-4 (P3) |
| Tier gating + branch isolation + presigned storage | 403 ladders, 404 info-hiding | ✓ | — | per-handler | — | BR-016c/029 + cross-branch pins | Implemented | No |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| No-AI non-goal | **GAP-1**: production Auto-detect button backed by FakeDetector — fake data path in a clinical tracing tool + stance contradiction; flag-OFF path untested | P1 | `[NEEDS PRODUCT DECISION]` | panel :311-330; detector :52-64 | Decide: remove affordance / keep flag-gated-OFF-by-default until a real detector exists (then test OFF path) / formally amend the no-AI stance. Add flag-OFF test either way |
| Superimposition persistence | **GAP-2**: save/load/list superimpositions unreachable (preview-only sessions) | P2 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` (persist vs declare preview-only) | persist trio 0 consumers (grep) | If persist: save/list UI in comparison flow; else document preview-only + park handlers |
| CBCT production chain | **GAP-3**: finalize + viewer-link not wired into production upload/library flow (harness-only) | P2 | V1 RECOMMENDED `[NEEDS CONFIRMATION]` (is CBCT V1 for launch tier?) | `finalizeCbctStudy` 0 prod consumers | Wire finalize into upload completion + CBCT card; or scope CBCT post-V1 explicitly |
| Image admin affordances | **GAP-4**: deleteImage/updateImageModality no UI | P3 | V1 RECOMMENDED | grep | small library-view actions |
| Auto-detect UX | **GAP-5**: mutation retries 4xx (5s+ spinner on permanent 403) | P3 | V1 RECOMMENDED | panel :317-318 (no retry:false) | retry:false on 4xx + tier-gate disable |
| Audit assertions | **GAP-6**: imaging `logAuditEvent` calls have no row-written test pins | P3 | V1 RECOMMENDED `[TEST GAP]` | prior carry-forward | add row assertions opportunistically |
| Seed breadth | **GAP-7**: 1 ceph-viewable patient; compare/CBCT data-limited | P3 | V1 RECOMMENDED | seedCephChain | second seeded ceph patient + CBCT study |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| FakeDetector + detection-job polling op | detector repo + `getCephLandmarkDetectionJob` (0 consumers; detector synchronous) | Contradicts no-AI non-goal | clinical-trust risk if enabled | GAP-1 decision; do not expand `[DO NOT OVERBUILD]` |
| `recomputeCephAnalysis` endpoint | 0 consumers (reads compute live) | spec'd | benign redundancy | document benign (prior verdict) |
| 6 analyses (PRD MVP asked 3 measurements) | ceph-math | exceeds spec — sanctioned by reconciliation do-not-rebuild | none | Keep |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Upload → tag → per-tooth library | dentist/assistant | imaging taken | upload → metadata/quality → tooth links | Implemented | No | library + G5 |
| Trace → analyze → report → sign | assistant+dentist | ceph image | calibrate → place/confirm → lock → analysis → versioned report (pinned) → finalize | Implemented | No | 4 real-API journeys |
| Re-report after correction | dentist | revision | new version + revision_of/reason | Implemented | No | G1 lineage |
| Radiographic finding → (loose) treatment ref | dentist | pathology spotted | finding FSM; optional treatmentId | Implemented | No | findings tests |
| Compare / superimpose | dentist | progress review | compare overlay → superimpose preview → **save?** | Preview only | **GAP-2** | persist orphans |
| CBCT acquire → finalize → view | dentist | CBCT study | upload → finalize (DICOM parse) → viewer link | Backend + harness only | **GAP-3** | 0 prod consumers |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Landmark FSM + lock immutability | forward-only | Implemented | CIMG pins | V1 REQUIRED | done |
| Report gate (A/B/Go/Po confirmed) | enforced | Implemented | CIMG-006 | V1 REQUIRED | done |
| Snapshot pinning (all inputs) | reproducible | Implemented | G2 source | V1 REQUIRED | done |
| Sign-off split | role-laddered | Implemented | G4 | V1 REQUIRED | done |
| Auto-detect path | per no-AI stance | Unclear | GAP-1 | decision | |
| Superimposition save | persist sessions | Missing (preview ok) | GAP-2 | V1 RECOMMENDED | decision |
| CBCT finalize in product | reachable | Missing | GAP-3 | V1 RECOMMENDED | confirm scope |
| Archive/restore affordances | admin ops | Missing UI | GAP-4 | V1 RECOMMENDED | small |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Trace a ceph end-to-end and hand over a signed report | assistant+dentist | full chain | Implemented | No | V1 REQUIRED | journeys |
| Reproduce last year's report exactly | dentist | pinned snapshot | Implemented | No | V1 REQUIRED | G2/G6 |
| Compare before/after, keep the superimposition | dentist | saved session | Preview only | GAP-2 | V1 RECOMMENDED | |
| Work a CBCT case | dentist (addon) | finalize + view | Harness only | GAP-3 | V1 RECOMMENDED `[NC]` | |
| Trust the manual-first promise | clinic | no fake/AI paths | Contradicted (flag-gated) | GAP-1 | decision | |
| Fix a mis-classified image / remove a bad capture | dentist | reclassify/delete | BE ready, no UI | GAP-4 | V1 RECOMMENDED | |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| GAP-1 FakeDetector contradiction | product integrity / clinical trust | P1 | `[NEEDS PRODUCT DECISION]` | :311-330 + detector | A "fake" landmark source reachable in a clinical tool, against a binding non-goal; flag-OFF untested | decide + flag-OFF test |
| GAP-2 superimposition persistence | FE wiring | P2 | V1 RECOMMENDED (decision) | persist trio orphans | Built+tested backend unusable; clinician work lost between sessions | wire-or-declare |
| GAP-3 CBCT production chain | FE wiring / scope | P2 | V1 RECOMMENDED `[NC]` | finalize orphan | Addon tier sells a chain the product can't complete | confirm scope then wire |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Clinician presses Auto-detect believing real detection | real or absent | deterministic fixture output | GAP-1 | P1 | decision-dependent |
| Save a superimposition for next consult | persists | session-only | GAP-2 | P2 | post-decision FE |
| CBCT upload → finalized study card | finalize fires | not wired | GAP-3 | P2 | E2E post-wire |
| Auto-detect without addon tier | instant gate | 5s spinner → error | GAP-5 | P3 | retry:false pin |

## 12. Unused / Unwired Implementation

(Each grep-verified; spine `ImagingMgmt_*` duplicates excluded as naming artifacts.)

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `createCephSuperimposition`/`getCephSuperimposition`/`listCephSuperimpositions` | API ×3, 0 consumers | grep | GAP-2 | wire-or-park |
| `finalizeCbctStudy` (+ production viewer-link path) | API, 0 prod consumers | grep | GAP-3 | wire-or-scope |
| `deleteImage`, `updateImageModality` | API ×2, no UI | grep | GAP-4 | small affordances |
| `recomputeCephAnalysis`, `getCephLandmarkDetectionJob` | API ×2, benign redundancy | prior verdict | none | document |
| FakeDetector backend | fixture provider | detector repo | GAP-1 | decision |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Append-only calibration + report snapshots pin everything (G2+G6) | schema | migs 0096-0099 | — | none — exemplary reproducibility |
| Soft-delete only (archived), no hard-delete | schema | BR-028 | — | none |
| Findings server-derive scoping (no client-trusted ids) | API | createFinding :75-86 | — | none (BUG-IMG-001 class closed) |
| Dual operationId naming in spine (interface vs unwrapped) | tooling | spine rows | P3 | note for KG refresh backlog (false-orphan hazard) |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Tier ladder (free/basic/addon) + 403 pins; null tier = free | feature gating | BR-016c tests | — | none |
| Cross-branch isolation incl. same-org different-branch 403 + no-leak pins | tenancy | imaging-integration :501-517 | — | none — do not re-litigate |
| Sign-off roles (assistant cannot finalize) | clinical RBAC | G4 pins | — | none |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Reports immutable, versioned, race-safe (unique constraint) | clinical record | CIMG-008 | — | none |
| Revision lineage preserves correction trail | record history | G1 | — | none |
| `logAuditEvent` calls lack row-assertions | audit proof | GAP-6 | P3 | opportunistic pins |
| Fixture landmarks could enter a real chart if flag enabled | clinical integrity | GAP-1 | P1 | decision + OFF-test |

## 16. Knowledge Graph Findings

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Real orphan set is small (persist trio, CBCT finalize, 2 admin ops, 2 benign) — most of the module is consumed | grep-verified | healthy wiring | §12 |
| Spine dual-naming inflates imaging orphan counts | spine vs grep | audit-tooling hazard | KG backlog note |
| ceph-math is an isolated pure package consumed by BE+FE | package | safe to evolve independently | none |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Manual-first ceph is the product's clinical-trust differentiator (vs AI-tracing competitors) | STANDARDS_COMPLIANCE | GAP-1 decision is brand-level, not just technical | escalate crisply |
| Superimposition persistence matters for ortho progress consults | ceph PRD intent | GAP-2 | decision |
| PH GP clinics rarely own CBCT — addon tier may legitimately defer | market context `[INFERRED]` | GAP-3 scoping | confirm |

## 18. Webwright / Playwright Findings

Not used this round — prior live runs (2026-06-08 imaging workflow run; 4 real-API ceph journeys re-confirmed) plus statically conclusive claims. Inspection finding: `imaging-cbct.spec.ts` drives a **harness route** (IMAGING_TEST_URL) with mocked viewer-link — it proves the backend, not production reachability (consistent with GAP-3). No new evidence saved.

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `imaging.test.ts` + `ceph.test.ts` (+15 more; ~10K lines, 360+ assertions) | backend | 45/45 BR/CIMG, FSMs, tiers, isolation, snapshot pinning, idempotency | High |
| `imaging-integration.test.ts` (incl. :501-517 cross-branch, :535/:606 BUG pins) | backend | real-DB chains | High |
| `dental-imaging.hurl` (47) + `dental-imaging-cbct.hurl` (15) | contract | live flows incl. minimal-body 201 + {items} pins | High |
| FE: 14 component + hook tests | frontend | tracing canvas, palette, findings, comparison | High |
| E2E: 4 real-API ceph journeys (11-14) | E2E | genuine tracing chain | High |
| E2E: `imaging-cbct.spec.ts` | E2E | **harness-route only** | Low (production-blind) |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| `dental_imaging_auto_landmark` flag-OFF path (button absent/disabled) | frontend + backend | GAP-1 kill-switch proof | With decision |
| Superimposition save/list FE (if wired) | frontend + E2E | GAP-2 | Post-decision |
| Production CBCT chain E2E (real route, no harness) | E2E | GAP-3 | Post-wire |
| autoDetect retry:false on 4xx | frontend | GAP-5 | Anytime |
| Imaging audit-row assertions | backend | GAP-6 | Opportunistic |
| Second seeded ceph patient + CBCT study | seed-coherence | GAP-7 demo/test breadth | Anytime |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| `@monobase/ceph-math` package (BE+FE consumers) | shared/platform `[SHARED DEPENDENCY]` | imports | version constants feed report pinning | freeze constants semantics |
| Storage module (presigned S3/MinIO) | cross-module | upload path | working | none |
| Imaging findings ↔ dental-visit findings boundary (two systems by design) | cross-module | §3 clarification | future contributors may merge them wrongly | document in MODULE_SPEC `[CROSS-MODULE RISK]` |
| Tier config (dental-org settings) | cross-module | BR-016c | gating source | none |
| No-AI stance owned at product level | product decision | STANDARDS_COMPLIANCE | GAP-1 | escalate |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Auto-detect decision package (remove / OFF-by-default+test / amend stance) | GAP-1 | P1 | `[NEEDS PRODUCT DECISION]` | flag-OFF pin | do first; tiny code either way |
| Superimposition save/list wiring or preview-only declaration | GAP-2 | P2 | decision | FE + E2E | |
| CBCT finalize production wiring (post scope confirm) | GAP-3 | P2 | `[NC]` | E2E | |
| Library admin actions (delete/reclassify) | GAP-4 | P3 | V1 RECOMMENDED | FE | small |
| retry:false on autoDetect 4xx | GAP-5 | P3 | V1 RECOMMENDED | FE | trivial |
| Audit-row pins + seed breadth | GAP-6/7 | P3 | V1 RECOMMENDED | backend/seed | opportunistic |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Analysis-template abstraction (G3) | V2 DEFERRED | reconciliation verdict: speculative |
| Soft-tissue analysis, DICOM expansion, ABO 3-point superimposition | V2 DEFERRED | STANDARDS_COMPLIANCE backlog |
| Real AI landmark detector | `[NEEDS PRODUCT DECISION]` → currently DO NOT ADD | no-AI non-goal binding |
| Rebuilding anything on the do-not-rebuild list (landmark FSM, analyses, calibration math, viewer) | DO NOT ADD `[DO NOT OVERBUILD]` | reconciliation §2 |

## 24. Audit Decision

**PARTIAL PASS.**

The clinical core is outstanding and fully verified: the complete manual tracing chain (landmark FSM, versioned calibration, 6 analyses/6 norms with calibration-safe math, immutable fully-pinned reports, assistant/dentist sign-off split, revision lineage) shipped with its entire reconciliation backlog and is protected by 360+ backend assertions, 62 contract requests, and four genuine real-API browser journeys. BUG-IMG-001/002 remain fixed and pinned.

It is not a PASS because of one product-integrity P1 — a production-reachable "Auto-detect landmarks" button backed by a deterministic FakeDetector, contradicting the platform's binding no-AI stance with an untested kill-switch — plus two built-but-unreachable chains (superimposition persistence, CBCT finalize) that need wire-or-declare decisions. Nothing found is data-unsafe.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Q1: Auto-detect — remove, keep flag-gated-OFF until real detector, or amend the no-AI stance? | `[NEEDS PRODUCT DECISION]` | GAP-1; brand-level | Product |
| Q2: Superimposition — persist sessions in V1 or declare preview-only? | `[NEEDS PRODUCT DECISION]` | GAP-2 | Product |
| Q3: Is the CBCT addon chain in V1 launch scope? | `[NEEDS CONFIRMATION]` | GAP-3 | Product |

## 26. Notes for Gap Plan Organizer

- **Decision-first module:** GAP-1 (Q1) should be escalated before any imaging fix batch; the code change is small either way (remove button / OFF default + test).
- **Likely batch shape:** Batch A = GAP-1 resolution + flag-OFF pin + GAP-5 retry fix; Batch B (post-Q2) = superimposition save/list; Batch C (post-Q3) = CBCT production wiring + honest E2E; Batch D = GAP-4 admin affordances + GAP-6/7 pins/seed.
- **Blocked until decided:** GAP-2 (Q2), GAP-3 (Q3).
- **Must NOT implement:** anything on the do-not-rebuild list; template abstraction; real AI detector (absent Q1 reversal).
- **Tests first:** flag-OFF pin; persistence FE RED if Q2 wires.
- **Cross-module:** ceph-math constants frozen; two-finding-systems boundary documented; spine dual-naming noted for KG backlog.
- **Do not re-litigate:** G1/G2/G4/G5/G6 landings, BUG-IMG-001/002, tier/isolation RBAC, report immutability — all source-verified this round.

---

Next recommended step:
Module/group: Dental Imaging & Ceph
Module slug: dental-imaging
Primary PRD/spec: ceph PRD + docs/product/modules/dental-imaging/ + ceph-guide-reconciliation
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/dental-imaging-gap-plan.md
