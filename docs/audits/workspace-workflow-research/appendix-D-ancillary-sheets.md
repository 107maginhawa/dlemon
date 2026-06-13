<!-- Workspace-workflow research · Chunk D — Ancillary sheets (lab, PMD, attachments, external-records-import, imaging incl. ceph/FMX) -->
<!-- Researcher pass · read-only · branch chore/workflow-verification-sweep · 2026-06-10 -->

# Appendix D — Ancillary Sheets (lab · PMD · attachments · external-records-import · imaging)

**Scope:** the auxiliary sheets reachable (or *intended* to be reachable) from the workspace timeline
carousel: **lab orders**, **PMD** (Portable Medical Document generate/import/export), **attachments**,
**external-records-import** (bulk patient + external-PMD + future FHIR bridge), and **imaging**
(images, findings, measurements/calibration, cephalometric landmarks→analysis→report, CBCT,
superimposition, FMX). Per the prompt this appendix carries sections (2)(3)(4)(5); no exec summary.

**Surface map (where each sheet actually lives):**
- Lab orders — backend `services/api-ts/src/handlers/dental-clinical/lab-orders/` (NOT dental-visit); FE `apps/dentalemon/src/features/workspace/components/lab-orders-sheet.tsx`.
- Attachments — backend `dental-clinical/attachments/`; FE `…/workspace/components/attachments-sheet.tsx` + hook `…/workspace/hooks/use-attachments.ts`.
- PMD — backend `dental-pmd/`; FE `apps/dentalemon/src/features/pmd/components/` + hooks `…/workspace/hooks/use-pmd.ts`,`use-share-pmd.ts`.
- External-records-import — **no `external-records-import` handler dir** (verified: grep services/ = only `dental-patient/dental-patient.bulk-import.test.ts`). Surface is 3 disjoint artifacts: bulk import `dental-patient/identity/importPatients.ts`, external-PMD `dental-pmd/importPMD.ts`, and the deferred `/dental/emr-import` FHIR bridge (unbuilt).
- Imaging — backend `dental-imaging/`; FE `apps/dentalemon/src/features/imaging/` mounted via `…/workspace/components/workspace-imaging-overlay.tsx`.

---

## (2) Baseline inventory — implemented workflows + business rules

| Workflow | FE entry (`file:line`) | Backend handler / endpoint | Governing rules | Test coverage |
|---|---|---|---|---|
| **Create lab order** | `lab-orders-sheet.tsx:137` `handleCreate` (sheet unreachable — see SEQ-D + register D03) | `dental-clinical/lab-orders/createLabOrder.ts:18` `POST /dental/visits/{visitId}/lab-orders` | BR-018, V-CLN-004/DE-014, WF-017, V-CLI-003 | backend `dental-clinical/repos/lab-order.test.ts`; contract `dental-clinical.hurl`; FE `lab-orders-sheet.test.ts` (21 tests, mounts component directly); E2E `lab-order-tracking.spec.ts` (**API-only**, drives `fetch` not the sheet) |
| **Lab order status progression** ordered→in_fabrication→delivered→fitted | `lab-orders-sheet.tsx:121` `handleAdvanceStatus` (`NEXT_STATUS` map :39) | `dental-clinical/lab-orders/updateLabOrder.ts:39` `PATCH …/lab-orders/{orderId}` | BR-018, LAB_ORDER_TRANSITIONS (`lab-order.schema.ts:53`), V-CLN-008 (illegal→422), V-CLN-004/DE-015, WF-036 | backend lab-order.test.ts (FSM); contract dental-clinical.hurl; FE lab-orders-sheet.test.ts |
| **Cancel lab order** | `lab-orders-sheet.tsx:130` `handleCancel` | updateLabOrder.ts (status='cancelled' + cancelReason) | BR-018, WF-063 [INFERRED] | as above |
| **Lab order due / overdue badge** | `lab-orders-sheet.tsx:67` `labOrderDueState` | `dueDate` col (`lab-order.schema.ts:34`) | P2-12 | FE lab-orders-sheet.test.ts |
| **Lab orders dashboard metric** | `dashboard/components/morning-briefing.tsx:292` (pending+overdue counts) | `listLabOrders` (branch-scoped) | FR0.8 | (dashboard tests) |
| **Upload attachment** (drag/tap, ≤50 MB, type chip, tooth-tag) | `attachments-sheet.tsx:125` `handleFiles`→`useUploadAttachment` | `dental-clinical/attachments/createAttachment.ts:18` `POST /dental/visits/{visitId}/attachments` (+ storage `uploadFile`/`completeFileUpload`) | BR-003 (locked/completed→422 VISIT_LOCKED, `createAttachment.ts:33`), BR-033/BR-034 (size/format), E2 (assistant allowed) | backend `attachment.test.ts`; FE `attachments-sheet.test.ts`; E2E `attachments.spec.ts` |
| **List/download/delete attachment** (visit vs All tabs) | `attachments-sheet.tsx:272,211,205` | `listAttachments`/`deleteAttachment`; download via `/storage/files/{file}/download` | BR-025 (patient-linked), BR-030 (legacy union surfaced in imaging) | as above |
| **Generate + share PMD** (per-visit snapshot) | `$patientId.tsx:357` "Share PMD" → `use-share-pmd.ts:23` `generatePmd` | `dental-pmd/generatePMD.ts` `POST /dental/visits/{visitId}/pmd` | BR-021 (immutable, completed/locked visit only), N-PMD-02 (patientId from visit), V-PMD-007 (pmd.generate audit) | backend `dental-pmd.test.ts`; contract `dental-pmd.hurl`; E2E `pmd-generation.spec.ts` |
| **View PMD** | `$patientId.tsx:529` `PMDViewerSheet` (gated on `pmdViewerOpen`; **dead `onPmd`** — no top-bar button) | `dental-pmd/getPMDForVisit.ts` `GET …/pmd` | BR-021 | FE `pmd-viewer.test.ts` (mounts directly); E2E (bypasses trigger) |
| **Import external PMD** (verbatim, read-only, checksum) | `$patientId.tsx:539` `PMDImport` (reached only via dead viewer) | `dental-pmd/importPMD.ts` `POST /dental/pmd/import` | BR-022 (read-only after import), EF-PMD-001 (checksum), EF-PMD-005 (sourceDescription req), V-PMD-007, V-XRI-004 | backend `imported-pmd-immutable.test.ts`,`dental-pmd-events.test.ts`; contract dental-pmd.hurl; FE `pmd-import.test.ts`; E2E `pmd-import.spec.ts` |
| **Export patient care record (FHIR R4)** | none (no FE consumer) | `dental-pmd/exportPatientCareRecord.ts` | V-PMD-008 (HIPAA right-of-access), P2-18 | backend `exportPatientCareRecord.test.ts`; FHIR `care-record/fhir-bundle.test.ts` |
| **Bulk patient import (CSV/JSON)** | none (orphan — 0 FE consumers) | `dental-patient/identity/importPatients.ts` `POST /dental/patients/import` | V-XRI-001 (owner-only, cross-tenant per row), V-XRI-002 (ingestion safety), FR7.2 | backend `dental-patient.bulk-import.test.ts` (17 tests) |
| **Upload image / list patient images** | `workspace-imaging-overlay.tsx:2` `PatientImageList`; Imaging tab `$patientId.tsx:301` (reachable) | `createImagingStudy`,`listPatientImages` | BR-025, BR-030 (legacy union), BR-032 (modality default), BR-029 (branch isolation, all 13 endpoints) | backend `imaging.test.ts`,`imaging-integration.test.ts`; FE 35 files; E2E `imaging-*` |
| **Annotate image** (line/angle/area/label/arrow/freehand/tooth) | `imaging-workspace.tsx` toolbar | annotations are overlays (non-destructive) | BR-023, BR-035 (LWW concurrent) | FE imaging tests; E2E `imaging-annotation` |
| **Finding lifecycle** draft→confirmed→resolved | `imaging-workspace.tsx` findings panel | `createFinding`/`listFindings`/`updateFinding`/`deleteFinding` (`$.items` shape post BUG-IMG-002 fix) | imaging-finding FSM (`imaging-finding.fsm.property.test.ts`) | backend FSM property; contract `dental-imaging.hurl` (minimal-body→201, list `$.items`); E2E `imaging-findings` |
| **Measurement + calibration** (mm gating) | `imaging-workspace.tsx` | `createMeasurement`/`listMeasurements`/`deleteMeasurement`/`updateImageCalibration` | BR-040 (mm requires pixelSpacing>0), BR-024 (pano warning until calibrated) | FE imaging-measurement tests; E2E `imaging-measurement` |
| **Ceph landmarking → analysis** (6 protocols) | `CephWorkspacePanel.tsx:75` (mounted `imaging-workspace.tsx:501`); addon-gated | `batchUpsertCephLandmarks`,`updateCephLandmark`,`getCephAnalysis`,`recomputeCephAnalysis` | CIMG-001..015 (tier gate, forward-only transitions, locked immutable, 4-landmark gate), BR-036/037/038 (idempotent batch), BR-040/045 | backend `ceph.test.ts`,`ceph-business-rules.test.ts`,`ceph-landmark.fsm.property.test.ts`; contract; E2E journeys 11–14 |
| **Versioned ceph report** | `CephWorkspacePanel.tsx` Generate Report | `createCephReport`/`getCephReport` | CIMG-006/008/011/012, BR-042/043 (monotonic version, steiner_hybrid_sn mandatory) | backend ceph tests; E2E `imaging-ceph`,`imaging-ceph-export` |
| **Compare two images / superimposition (preview only)** | `workspace-imaging-overlay.tsx:49` `ComparisonView`→`comparison-view.tsx:206` `SuperimpositionPanel` | `previewCephSuperimposition` (ephemeral) — persist/list **unwired** | P1-11 (durable timeline — not met), BR-045 | FE comparison tests; E2E `imaging-comparison` |

**Deferred / interim markers flagged:** ceph "Auto-detect landmarks" = Phase-0 **FakeDetector** behind addon + `dental_imaging_auto_landmark` kill-switch (IMG-P1-1). CBCT chain wired on **harness route only** (IMG-P2-2). PMD `repo.sign()` and `markSafetyFloorMerged()` exist but are **never called** (PMD-P1-2/P1-4). `/dental/emr-import` FHIR bridge = **future-phase, by design** (V-XRI-003).

---

## (3) Per-family sequencing analysis + ordering-gap list

### D.1 Lab orders
**Ordered sequence (intended, WF-017/WF-036):**
`open visit (active)` → `[chart] select tooth/surface → "Send to Lab"` → `create order (status=ordered, audit lab_order.created)` → lab `in_fabrication` → `delivered (audit lab_order.completed)` → `fitted` *(→ link back to the treatment record on the chart, WF-017 step 5)*. Cancel allowed from ordered/in_fabrication/delivered.
Pre/post: create requires `visit.status ∉ {completed,locked}` (`createLabOrder.ts:33`); status moves obey `LAB_ORDER_TRANSITIONS`; illegal transition → 422 (V-CLN-008).

**Ordering gaps:**
- **SEQ-D1a (NEW)** — No **chart entry point** ("Send to Lab" from a tooth/treatment) and no **`treatmentId` link** on the order (verified: `lab-order.schema.ts` has `toothFdi` but **no `treatment_id`**; FE `handleCreate` never sends `toothFdi`). WF-017 steps 1 & 5 are unimplemented — the order floats free of the chart/treatment it serves.
- **SEQ-D1b (NEW)** — **Remake/defective loop unreachable.** Schema models `isDefective`+`replacedByOrderId` (`lab-order.schema.ts:42-43`) but no FE/handler path creates a replacement from a fitted/defective order; the real-practice "remake under warranty" sequence (fitted→defective→new order linked) has no workflow.
- **SEQ-D1c (KNOWN, dead-trigger)** — the whole sequence is **unreachable** because `WorkspaceTopBar` renders no Lab button (register D03).

### D.2 Attachments
**Sequence:** `open visit` → pick type chip + (optional) tooth-tag → drag/tap file (≤50 MB, image/pdf) → `uploadFile`→`completeFileUpload`→`createAttachment` → list/download/delete. Pre: `visit.status ∉ {locked,completed}` (BR-003). Post: visible in "This Visit" + "All" patient view; surfaced in imaging via legacy union (BR-030).
**Ordering gaps:**
- **SEQ-D2a (NEW)** — multi-file upload is a **sequential `for…await` loop** with **no per-file idempotency key** (`attachments-sheet.tsx:129-139`). A retried/duplicated upload (offline replay, double-tap) creates duplicate rows; no `localId` guard like GAP-001. Partial-failure is surfaced (errors array) but not resumable.
- **SEQ-D2b (KNOWN-adjacent)** — FE 50 MB cap vs BR-033 100 MB backend cap mismatch (FE rejects 50–100 MB files the backend would accept). Cosmetic/UX, but a silent ceiling.

### D.3 PMD
**Sequence:** `visit completed/locked` → generate snapshot (BR-021) → checksum → (intended: sign → status `signed`) → share/transport → external import (verbatim, read-only, checksum-verified) → (intended: Safety-Floor add-only merge). 
**Ordering gaps (all KNOWN):**
- **SEQ-D3a (KNOWN PMD-P1-2)** — signing step is **skipped** (`sign()` never called); status stuck `generated`; checksum co-located ≠ non-repudiation. The "do not emit unsigned PMD" ordering invariant is violated.
- **SEQ-D3b (KNOWN PMD-P1-4)** — import→**merge** step skipped (`markSafetyFloorMerged()` never called); imported allergies never reach the clinician. The import sequence terminates at dead storage.
- **SEQ-D3c (KNOWN PMD-P1-3)** — view/import **unreachable** (dead `onPmd`); only Share is wired.

### D.4 External-records-import
**Sequence (bulk):** owner uploads CSV/JSON → parse (RFC-4180, fixed Batch-3 G3) → validate every row → **all-or-nothing tx** → result summary. 
**Ordering gaps (KNOWN):**
- **SEQ-D4a (KNOWN G1)** — orphan: no FE step exists; the sequence cannot start from the UI.
- **SEQ-D4b (KNOWN G2)** — no `MAX_IMPORT_ROWS` cap before the validate/commit loops → unbounded-memory / long-tx self-DoS.

### D.5 Imaging
**Sequence:** upload/categorize → annotate → finding draft→confirmed→resolved → calibrate → measure (mm gated on calibration) → [ceph] place landmarks (forward-only) → analysis (protocol switch) → versioned report → [compare] superimposition. CBCT: upload(cbct) → `finalizeCbctStudy` → viewer.
**Ordering gaps:**
- **SEQ-D5a (KNOWN IMG-P2-1)** — superimposition computes a **preview only**; `createCephSuperimposition`/`listCephSuperimpositions` have **0 FE consumers** (grep-verified) → no persisted, ordered longitudinal timeline (P1-11 unmet). *(The gap-plan's "panel not mounted" is slightly stale — the panel IS mounted via `comparison-view.tsx:206`; the live gap is preview-only, no persist/list.)*
- **SEQ-D5b (KNOWN IMG-P2-2)** — CBCT `finalizeCbctStudy` only invoked on the **harness route**; the upload→finalize→viewer ordering can't complete from the production overlay.
- **SEQ-D5c (KNOWN IMG-P2-3)** — auto-detect retries a permanent 403 **3×** (TanStack default) → long misleading spinner; ordering of feedback is wrong (retry-then-error instead of immediate gate).
- **SEQ-D5d (NEW, clinical)** — calibration→measurement ordering is enforced for **mm display** (BR-040) but a measurement taken **before** calibration and then re-read **after** a *different* calibration is not re-validated/flagged; no audit that a stored measurement's calibration provenance changed (ceph reports snapshot provenance via BR-039, but ad-hoc measurements do not). Low-frequency metrology edge.

---

## (4) Gap & candidate register

Schema: `| id | finding | chunk | I/K/N | lenses{S,R,O,C} | KG-node | MODULE/WF | BR-id | spine-op/handler | severity | blast-radius |`
Lenses: **S**=sequencing · **R**=security/RBAC/multi-tenant · **O**=offline/P2P · **C**=clinical-correctness.

| id | finding | chunk | I/K/N | lenses | KG-node | MODULE/WF | BR-id | spine-op/handler | sev | blast |
|---|---|---|---|---|---|---|---|---|---|---|
| D01 | Lab order create + FSM + cancel + due/overdue fully implemented & tested backend; branch+role gated (owner/associate) | D | IMPLEMENTED | R,C | flow:lab-order | dental-clinical/WF-017,036,063 | BR-018,V-CLN-004/008 | createLabOrder/updateLabOrder | — | — |
| D02 | Attachments upload/list/download/delete; BR-003 lock guard; assistant-allowed (E2) | D | IMPLEMENTED | R | flow:attachment | dental-clinical/WF-039 | BR-003,025,030,033,034 | createAttachment/listAttachments | — | — |
| D03 | **Lab Orders sheet unreachable** — `LabOrdersSheet` mounted + `onLab` passed but `WorkspaceTopBar` renders **no Lab button** (`workspace-top-bar.tsx:189-203`; only Rx/Consent/Notes/Attach/TxPlan/Complete/FS). API-only E2E masks it. | D | KNOWN | S | flow:lab-order | dental-clinical | BR-018 | onLab dead-prop | P1 | cosmetic→workflow-breaking |
| D04 | **PMD viewer + import unreachable** — dead `onPmd` (same class as D03); only "Share PMD" wired | D | KNOWN | S | flow:pmd | dental-pmd | BR-021,022 | getPMDForVisit/importPMD | P1 | workflow-breaking |
| D05 | **PMD never signed** — `sign()` unused; status stuck `generated`; checksum mislabeled non-repudiation | D | KNOWN | R,C | flow:pmd | dental-pmd/WF-021 | BR-021;propose **BR-2001** | generatePMD | P1 | data-integrity/trust |
| D06 | **PMD omits Safety Floor + demographics** (treatments+Rx only) → allergy invisible at external facility | D | KNOWN | C | flow:pmd | dental-pmd/WF-021 | propose **BR-2002** | generatePMD | P1 | PHI-safety |
| D07 | **Per-visit PMD not a FHIR R4 Bundle** (bespoke JSON; reuse `buildCareRecordBundle`) | D | KNOWN | C | flow:pmd | dental-pmd | propose **BR-2003** | generatePMD | P1 | interop |
| D08 | **Imported PMD has no clinical effect** — Safety-Floor merge stubbed (`markSafetyFloorMerged` never called) | D | KNOWN | S,C | flow:import-external-pmd | dental-pmd/WF-022 | BR-022;propose **BR-2004** | importPMD | P1 | PHI-safety |
| D09 | **Bulk patient import orphan** — `POST /dental/patients/import` 0 FE consumers; FR7.2 unreachable | D | KNOWN | R,S | flow:bulk-import-patients (missing in KG, G9) | external-records-import/G1 | V-XRI-001 | importPatients | P1 | workflow-breaking |
| D10 | **No row cap on bulk import** (DoS-class: unbounded memory + long tx) | D | KNOWN | R | (none) | external-records-import/G2 | V-XRI-002 | importPatients | P1 | data-loss/availability |
| D11 | **Imaging AI "Auto-detect landmarks" upsell** contradicts no-AI non-goal; backend FakeDetector | D | KNOWN | C | domain:imaging | dental-imaging/IMG-P1-1 | CIMG-001 | detectCephLandmarks | P1 | clinical-trust |
| D12 | **Persisted superimposition unwired** — preview only; `createCephSuperimposition`/`list…` 0 FE consumers (grep-verified) | D | KNOWN | S,O | domain:imaging | dental-imaging/IMG-P2-1 | propose **BR-2005** | createCephSuperimposition | P2 | data-loss(history) |
| D13 | **CBCT finalize only on harness route** — `finalizeCbctStudy` never called in prod overlay | D | KNOWN | S | domain:imaging | dental-imaging/IMG-P2-2 | CIMG-001 | finalizeCbctStudy | P2 | workflow-breaking |
| D14 | **Auto-detect 403 retried 3×** → long misleading spinner | D | KNOWN | S,R | domain:imaging | dental-imaging/IMG-P2-3 | CIMG-002 | detectCephLandmarks | P2 | cosmetic |
| D15 | **No modality-reclassify / delete-image affordance** (`updateImageModality`/`deleteImage` unwired) | D | KNOWN | — | domain:imaging | dental-imaging/IMG-P3-1 | BR-026,027,028,032 | updateImageModality/deleteImage | P3 | cosmetic |
| D16 | **Lab order has no chart entry-point & no treatment link** — no "Send to Lab" from tooth; schema `toothFdi` never sent by FE; **no `treatment_id` col** (WF-017 steps 1&5 unimplemented) | D | NEW | S,C | flow:lab-order | dental-clinical/WF-017 | BR-018;propose **BR-2006** | createLabOrder | P2 | correctness |
| D17 | **No lab-order remake/defective workflow** — `isDefective`/`replacedByOrderId` modelled but no path creates a linked replacement (warranty remake) | D | NEW | S,C | flow:lab-order | dental-clinical/WF-037? | propose **BR-2007** | (no endpoint yet) | P2 | correctness |
| D18 | **Attachment uploads not idempotent** — sequential loop, no per-file `localId`; offline replay/double-tap → duplicate rows | D | NEW | O,S | flow:attachment | dental-clinical/WF-039 | GAP-001 (extend);propose **BR-2008** | createAttachment | P2 | data-loss(dupe) |
| D19 | **FE attachment cap (50 MB) < backend cap (BR-033 100 MB)** — silent ceiling, files 50–100 MB FE-rejected | D | NEW | — | flow:attachment | dental-clinical | BR-033 | (FE only) | P3 | cosmetic |
| D20 | **Lab order create→complete emits audit but no notification** — WF-017 says "pg-boss sends lab notification email"; only `dental_audit_log` written (ADR-006), no notifs to the lab | D | NEW | S | flow:lab-order | dental-clinical/WF-017,notifs | propose **BR-2009** | createLabOrder | P3 | cosmetic |
| D21 | **Ad-hoc measurement calibration-drift not re-flagged** — a measurement read after a calibration change isn't re-validated/audited (ceph reports snapshot provenance BR-039; loose measurements don't) | D | NEW | C | domain:imaging | dental-imaging | BR-039 (extend) | updateImageCalibration | P3 | correctness |
| D22 | **Care-record FHIR export has no FE trigger** (HIPAA right-of-access unreachable) | D | KNOWN | C | flow:pmd | dental-pmd/PMD-P2-6,P2-18 | V-PMD-008 | exportPatientCareRecord | P2 | workflow-breaking |
| D23 | **Imported-PMD list/history has no FE consumer** (`listImportedPmds`/`getImportedPmd`) | D | KNOWN | — | flow:import-external-pmd | dental-pmd/PMD-P2-7 | BR-022 | listImportedPMDs | P2 | cosmetic |
| D24 | **"Share PMD" delivers only a checksum text string** (no file/QR/SHL; silent no-op on desktop without `navigator.share`) | D | KNOWN | S | flow:pmd | dental-pmd/PMD-P2-8 | propose **BR-2010** | generatePMD | P2 | workflow-breaking |
| D25 | **`/dental/emr-import` FHIR/CDA/PDF bridge unbuilt** (Phase-3+, by design — NOT a defect) | D | KNOWN | — | (none) | external-records-import/G7 | V-XRI-003 (deferred) | (no endpoint) | P3 | n/a (deferred) |

**Proposed new BRs (business-rules.md style guards):**
- **BR-2001** — A PMD MUST be cryptographically signed before emission; an unsigned snapshot is never returned as a shareable PMD (signing failure → do not emit, 5xx-free 422).
- **BR-2002** — A generated PMD MUST include patient demographics + the Safety Floor (active allergies/medications/conditions), with explicit `nilknown` when empty.
- **BR-2003** — The per-visit PMD MUST be a FHIR R4 `Bundle(type=document)` (Composition + Patient + AllergyIntolerance/MedicationRequest/Condition + Signature).
- **BR-2004** — On PMD import, safety-critical items merge **add-only** into the patient Safety Floor and `safety_floor_merged` flips true; no overwrite of existing entries.
- **BR-2005** — A cephalometric superimposition, once computed for two timepoints, MUST be persistable and listable as an ordered, immutable longitudinal record (no silent ephemeral-only state).
- **BR-2006** — A tooth-specific lab order MUST carry its FDI tooth + (where applicable) the originating treatment id, and a fitted order links back to that treatment on the chart.
- **BR-2007** — A defective fitted lab order may spawn exactly one replacement order linked via `replacedByOrderId`; the original is marked `isDefective` and is not re-advanced.
- **BR-2008** — Attachment uploads are idempotent per client-supplied `localId`; a replayed upload returns the existing row, never a duplicate.
- **BR-2009** — Lab order creation emits a lab-directed notification (notifs) in addition to the audit marker; absence of a delivery channel must surface, not silently no-op.
- **BR-2010** — "Share PMD" delivers a real transportable artifact (file/SHL); on an unsupported platform the UI reports a truthful no-delivery state, never a false success.

---

## (5) TDD-ready slice specs (value-ordered)

> Conventions (per `VERTICAL_TDD.md`): backend tests run **from `services/api-ts/`** via
> `bun run scripts/test-with-db.ts <file>` with `DATABASE_URL=postgresql://postgres:password@localhost:5432/monobase_test`
> (**per-file**, never `bun test <path>`, never directory-arg). Contract `*.hurl` via `scripts/run-contract-tests.ts`
> against `$API_URL` — **restart the API server first**. FE unit: **DentalChart is globally stubbed**
> (`apps/dentalemon/src/test-setup.ts`, `data-testid="dental-chart-stub"`) — chart logic tested as pure fns,
> rendered-chart asserted **only in E2E**. E2E self-seeds via `tests/e2e/helpers/e2e-seed.ts`. Gate per slice:
> api-ts `bunx tsc` (root `bun run typecheck` is FE-only) + `bun run check:boundaries` + backend + contract + FE tsc/unit + E2E.

### SL-D01 — Wire the dead Lab + PMD triggers (D03, D04) · P1 · `depends: —`
Highest leverage, smallest change; unblocks SL-D02/D03/D06. **Backend-skip** for the wiring itself (FE-only) — but pair with a real-UI E2E because the existing lab E2E is API-only.
- Steps: 7 (FE tests RED) → 8 (FE impl) → 9 (E2E) → 10 (verify). No TypeSpec/backend/contract change.
- RED tests:
  - FE `workspace-top-bar.test.ts` — asserts a "Lab orders" IconButton and a "PMD" IconButton render and fire `onLab`/`onPmd` (RED today; bind AC-D03/AC-D04).
  - E2E `tests/e2e/lab-order-tracking.spec.ts` — **re-author to drive the real UI**: open workspace → click Lab button → sheet opens → create order → advance FSM in the sheet → assert badge. **Relabel the current API-only spec** `lab-order-tracking-api.spec.ts`. E2E `pmd-viewer.spec.ts` — click PMD button → viewer opens → reach Import.
- Binds: BR-018, BR-021/022. FSM: none. Gate: FE tsc/unit + E2E (+ `check:boundaries`).

### SL-D02 — PMD becomes a signed FHIR Bundle with Safety Floor + demographics (D05, D06, D07) · P1 · `depends: SL-D01`
Route `generatePMD` through `buildCareRecordBundle` extended with demographics + medical-history safety slice; add JWS signing (jose ES256, self-signed facility key); transition `generated→signed`. **`[NEEDS CONFIRMATION]`** product intent (true canonical PMD vs narrowed snapshot) — gates whether D05/06/07 are bugs or accepted scope.
- Steps: 1 (TypeSpec: signature fields on PmdDocument) → 2 codegen → 3 backend RED → 4 impl → 5 contract RED → 6 impl → (7/8 FE viewer trust-badge) → 9 E2E → 10 verify.
- RED tests:
  - backend `dental-pmd/generatePMD.fhir-conformance.test.ts` — generated bundle is `Bundle(type=document)`, validates against `/Users/eladventures/Desktop/pmd/spec/schema/pmd-bundle.schema.json`, contains AllergyIntolerance/MedicationRequest/Condition (+ `nilknown` when empty) + Patient demographics (binds BR-2002/BR-2003).
  - backend `dental-pmd/pmd-signing.test.ts` — sign→verify round-trip; tampered content → verify fails; status `generated→signed` (binds BR-2001). Add **FSM property test** `pmd-document.fsm.property.test.ts` (status transitions) à la `treatment.fsm.property.test.ts`.
  - contract `dental-pmd.hurl` — generate returns signed bundle with required sections.
- Gate: api-ts tsc + backend + contract + FE.

### SL-D03 — PMD import add-only Safety-Floor merge (D08) · P1 · `depends: SL-D01`
Call `markSafetyFloorMerged` on import; surface imported safety items in the top-bar Safety Floor.
- RED: backend `dental-pmd/import-safety-merge.test.ts` — import a PMD carrying a penicillin allergy → assert it appears in the patient Safety Floor and `safety_floor_merged=true`; re-import → no duplicate/overwrite (add-only) (binds BR-2004). E2E `pmd-import.spec.ts` extended: post-import, top-bar shows the imported allergy.
- Gate: backend + E2E.

### SL-D04 — Bulk patient import: row cap + owner-only UI (D09, D10) · P1 · `depends: —` (after Step-0 product decision G1)
G2 (cap) is worth doing regardless of A/B; G1 (UI) gated on decision.
- RED:
  - backend `dental-patient.bulk-import.test.ts` (extend) — payload of `MAX_IMPORT_ROWS+1` → `422 IMPORT_TOO_LARGE`, **0 rows written** (binds V-XRI-002).
  - (Path A) FE `import-patients.test.ts` — file select → validate preview → confirm → result summary; E2E `bulk-import.spec.ts` — owner uploads CSV → patients appear; **contract walker** asserting FE consumes `{success,imported,total,patients}` (or normalize to `{data,meta}` first — G6).
- Gate: backend (+ FE/E2E/contract if Path A).

### SL-D05 — Lab order chart linkage + remake loop (D16, D17) · P2 · `depends: SL-D01`
Add `treatment_id` to `lab_order`; surface "Send to Lab" from a tooth/treatment; build the defective→replacement linked order.
- Steps: 1 (TypeSpec: `treatmentId` on CreateLabOrderBody; remake op) → 2 codegen → 3 backend RED → 4 impl → 5 contract RED → 6 impl → 7/8 FE → 9 E2E → 10 verify.
- RED: backend `lab-order-remake.test.ts` — create order with `treatmentId`; fitted+defective → spawn replacement linked via `replacedByOrderId`; original cannot re-advance (binds BR-2006/BR-2007). FE `lab-orders-sheet.test.ts` — "Send to Lab" prefills tooth/treatment. Migration: add `treatment_id` col (review generated SQL; nullable, FK set-null).
- Gate: api-ts tsc + backend + contract + FE + E2E.

### SL-D06 — Persisted ceph superimposition timeline (D12) · P2 · `depends: —`
Wire `SuperimpositionPanel` preview→**persist** (`createCephSuperimposition`) + timeline (`listCephSuperimpositions`). Backend already exists — FE-wiring + contract pins.
- RED: FE `SuperimpositionPanel.test.ts` (pure-fn / hook) — "Save" calls `createCephSuperimposition`; timeline lists via `listCephSuperimpositions` (binds BR-2005). contract `dental-imaging.hurl` — persist→`201`, list→`$.items`. E2E `imaging-comparison.spec.ts` (prod overlay) — compute→save→reopen→appears in history.
- Gate: FE tsc/unit + contract + E2E.

### SL-D07 — Attachment upload idempotency (D18) · P2 · `depends: —`
Add client `localId` to `createAttachment`; replayed upload returns existing row.
- RED: backend `attachment-idempotency.test.ts` — two creates with same `localId` → one row, second returns existing (binds GAP-001/BR-2008). FE `attachments-sheet.test.ts` — upload loop assigns/sends a stable `localId`. (TypeSpec: add `localId` to CreateAttachmentBody → codegen.)
- Gate: api-ts tsc + backend + contract + FE.

### SL-D08 — Imaging auto-detect: resolve no-AI contradiction + stop retrying 403 (D11, D14) · P1/P2 · `depends: —`
**`[NEEDS CONFIRMATION]`** product decision (remove vs ship real detector). Regardless: `retry:false` on 4xx + proactive tier-gate.
- RED: FE `CephWorkspacePanel.test.ts` — detect mutation has `retry:false`; when tier known-off the button is disabled/replaced and upsell surfaces **immediately** (binds CIMG-002). If removed: assert no `detectCephLandmarks` affordance renders. E2E `imaging-ceph-auto-landmark.spec.ts` — no prolonged "Detecting…".
- Gate: FE tsc/unit + E2E.

### SL-D09 — CBCT finalize reachable from prod overlay (D13) · P2 · `depends: —`
Confirm/enable `modality='cbct'` in the production upload form; wire `finalizeCbctStudy`; replace harness E2E with a prod-overlay one. **`[NEEDS CONFIRMATION]`** whether prod upload offers cbct.
- RED: contract `dental-imaging-cbct.hurl` — finalize populates `isVolume`/`frameCount`/`sliceThickness`. E2E `imaging-cbct.spec.ts` rewritten to drive the **patient overlay** (not `imaging-test.tsx`).
- Gate: contract + E2E.

### SL-D10 — Wire care-record FHIR export + imported-PMD history (D22, D23, D24) · P2/P3 · `depends: SL-D01`
Add export button + imported-PMD list/detail; replace checksum-text share with a real file/SHL (D24).
- RED: FE tests that the export button calls `exportPatientCareRecord` and the list calls `listImportedPmds` (binds V-PMD-008, BR-022, BR-2010). E2E export + history journeys.
- Gate: FE tsc/unit + E2E.

**Slice dependency order:** SL-D01 → {SL-D02, SL-D03, SL-D05, SL-D10}; SL-D04, SL-D06, SL-D07, SL-D08, SL-D09 are independent. Build SL-D01 first (unblocks four), then SL-D02/D03 (PMD conformance/safety), then the independents by severity.

---

## Open questions / `[ASSUMPTION]` for the user

1. **PMD product intent** (gates D05/D06/D07) — true canonical FHIR+signed+Safety-Floor PMD, or intentionally-narrowed "visit snapshot compliance record"? `MODULE_SPEC §7.1` excludes Safety Floor "by design" while §2 V-PMD-009 adopts the canonical PMD name. **`[NEEDS CONFIRMATION]`**
2. **Imaging AI auto-detect** (D11/D14) — intentional reversal of the no-AI non-goal (keep + ship a real detector), or remove the affordance? Is the addon-enabled detector real or still FakeDetector? **`[NEEDS CONFIRMATION]`**
3. **CBCT / superimposition V1 scope** (D12/D13) — is ephemeral preview-only superimposition an intentional V1 cut? Does the prod upload form offer `modality='cbct'`? **`[NEEDS CONFIRMATION]`**
4. **Bulk patient import V1** (D09/D10) — build owner-only UI vs dormant primitive; max row count + reject-vs-partial on oversized; canonical owner of import UX? **`[NEEDS CONFIRMATION]`**
5. **Lab order chart linkage scope** (D16/D17) — is "Send to Lab from chart" + treatment linkage + remake loop in V1, or deferred? Schema models the columns but no workflow exists. `[ASSUMPTION]` it is desired (WF-017 specifies it) but unconfirmed as V1.
6. **PMD signing trust model** (D05) — self-signed facility cert (canonical §12 bilateral/unverified) acceptable for V1? **`[NEEDS CONFIRMATION]`**
