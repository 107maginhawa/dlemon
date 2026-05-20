# Requirements: Dentalemon v1.2.1 Workspace Reconciliation Phases 3-6

**Defined:** 2026-05-10
**Core Value:** A practitioner can open any patient folder, view their dental chart, plan treatments, and record visits — all from a single cohesive workspace.

## v1.2.1 Requirements

Requirements for completing workspace reconciliation. Each maps to roadmap phases.

### Treatment Table & Interactivity

- [x] **TXTBL-01**: User can see separate subtotals for current visit vs carried-over treatments
- [x] **TXTBL-02**: User can inline-edit treatment price by clicking the price cell
- [x] **TXTBL-03**: User can dismiss a treatment from the table
- [x] **TXTBL-04**: User can add/edit inline notes on a treatment row
- [x] **TXTBL-05**: User can toggle visibility of completed treatments

### Visit Lifecycle

- [x] **VISIT-01**: User can complete a visit (transitions status to 'completed')
- [x] **VISIT-02**: Pre-completion checklist warns about missing consent, planned treatments, missing SOAP notes
- [x] **VISIT-03**: User can lock a completed visit (transitions status to 'locked')
- [x] **VISIT-04**: User can enter SOAP notes (S/O/A/P fields) for a visit

### Clinical Sheet Fixes

- [x] **CFIX-01**: ConsentSheet uses properly typed response (no `as any` cast)
- [x] **CFIX-02**: ConsentSheet signature canvas supports touch via Pointer Events
- [x] **CFIX-03**: LabOrdersSheet uses TanStack Query instead of imperative useState

### Bug Fixes & Polish

- [x] **BFIX-01**: Price unit mismatch fixed — save multiplies by 100, display divides by 100
- [x] **BFIX-02**: useTreatmentPlan uses generated SDK instead of raw fetch *(deviation accepted — raw fetch; no SDK hook generated)*
- [x] **BFIX-03**: Fullscreen button handles SSR + listens to fullscreenchange event
- [x] **BFIX-04**: Duplicate Profile/Share PMD buttons removed
- [x] **BFIX-05**: useOrgContextStore uses reactive hook instead of .getState() in render
- [x] **BFIX-06**: Orphaned WorkspaceTabs component + test deleted
- [x] **BFIX-07**: ResizableDivider tracks correct axis (Y for vertical layout)

### TypeSpec Migration

- [x] **TSMIG-01**: Remaining ~5 route groups migrated from manual registration to TypeSpec pipeline

---

## v1.2 Requirements

Requirements for Wire & Ship milestone. Each maps to roadmap phases.

### Workspace Action Bar

- [x] **WBAR-01**: Workspace footer shows action bar with icon triggers between treatment summary and payment button
- [x] **WBAR-02**: User can open RxSheet overlay from action bar (with prescriberMemberId plumbed)
- [x] **WBAR-03**: User can open ConsentSheet overlay from action bar
- [x] **WBAR-04**: User can open LabOrdersSheet overlay from action bar
- [x] **WBAR-05**: User can open PMDViewer overlay from action bar (wrapped in Shadcn Sheet)
- [x] **WBAR-06**: User can access PMDImport from Notes tab or within PMDViewer

### Treatment Plan

- [x] **TXPL-01**: Treatment Plan tab shows live data from getTreatmentPlan API (replaces "Coming in PR2")
- [x] **TXPL-02**: Treatments are grouped by urgency/phase
- [x] **TXPL-03**: User can view treatment plan summary with total cost

### Patient Profile

- [x] **PROF-01**: User can view patient demographics and contact info
- [x] **PROF-02**: User can view patient visit history
- [x] **PROF-03**: User can view patient balance/statement
- [x] **PROF-04**: Patient profile accessible from patient list or workspace

### Attachments

- [x] **ATCH-01**: User can upload clinical files (X-rays, photos) to a visit
- [x] **ATCH-02**: User can view attachment gallery for a visit
- [x] **ATCH-03**: User can delete attachments

### Payment

- [x] **PAY-01**: User can record a payment from workspace context
- [x] **PAY-02**: Payment modal captures method, amount, and reference
- [x] **PAY-03**: Payment updates invoice status

### Reports

- [x] **RPT-01**: User can click a revenue report row to see invoice detail
- [x] **RPT-02**: Report drilldown shows line items and payment history

## v1.3 Requirements

### Imaging Workspace

**Milestone goal:** Dentist can upload, view, measure, and annotate X-rays inside the patient workspace — all offline. No separate imaging software needed.
**Tier:** Free (viewer) + Basic (measurement/annotation)
**Depends on:** Workspace Reconciliation complete
**Handler module:** `services/api-ts/src/handlers/dental-imaging/`
**Design doc:** `~/.gstack/projects/dentalemon/eladventures-feat-phase-5-report-detail-design-20260510-135956.md`

#### Features

| ID | Requirement | Priority | Tier |
|----|------------|----------|------|
| IMG-01 | User can upload X-ray images (JPEG, PNG, TIFF, BMP) to a visit | P0 | Free |
| IMG-02 | User can view images with zoom, pan, rotate, flip | P0 | Free |
| IMG-03 | User can adjust brightness and contrast | P0 | Free |
| IMG-04 | User can view images full-screen | P0 | Free |
| IMG-05 | Each image is linked to patient, visit, and tooth number(s) | P0 | Free |
| IMG-06 | User can classify image modality (periapical, bitewing, panoramic, cephalometric, intraoral photo, extraoral photo) | P0 | Free |
| IMG-07 | User can measure distance between two points with calibration | P0 | Basic |
| IMG-08 | User can measure angles between lines | P0 | Basic |
| IMG-09 | User can measure area of a region | P0 | Basic |
| IMG-10 | User can calibrate pixel-to-mm ratio using a known reference length | P0 | Basic |
| IMG-11 | User can add label annotations to images | P1 | Basic |
| IMG-12 | User can add arrow annotations | P1 | Basic |
| IMG-13 | User can add freehand drawing annotations | P1 | Basic |
| IMG-14 | User can add line and shape annotations | P1 | Basic |
| IMG-15 | User can add tooth-specific annotations | P1 | Basic |
| IMG-16 | Measurements and annotations are saved to chart and linked to the image | P0 | Basic |
| IMG-17 | User can compare past and current X-rays side-by-side | P1 | Basic |
| IMG-18 | Images and all overlay data (annotations, measurements) are stored locally for offline use | P0 | Free |

#### Business Rules

- **BR-023**: Annotations stored as structured overlay data, never burned into original image
- **BR-024**: Calibration required before measurement values display in mm (pixel values shown without calibration, with a warning for panoramic images noting magnification variation)
- **BR-025**: Original image file is immutable after upload — all modifications are overlay data
- **BR-026**: Image deletion is soft-delete; originals retained per data retention policy
- **BR-027**: Only the uploading provider or a provider with admin role can delete an image
- **BR-033**: Maximum upload file size is 100MB per image. Files exceeding limit are rejected before upload begins.
- **BR-034**: Unsupported file formats are rejected at upload with an error listing accepted formats (JPEG, PNG, TIFF, BMP)
- **BR-035**: Concurrent annotation editing uses last-write-wins strategy

#### State Transitions

- Image Study: `active` → `archived` → `deleted` (soft)
- Annotation: `visible` → `hidden` → `deleted` (soft)

#### Week-1 Gate (iPad Rendering Spike)

Before building annotation tools: load a real 2400×1200 panoramic in Tauri WKWebView on a 3-year-old iPad. Pass thresholds: first paint < 2s, pan/zoom ≥ 30fps with 10+ annotations, memory < 300MB with 4 images loaded. If any metric fails, evaluate cornerstone.js or tiled WebGL before proceeding.

---

## v1.4 Requirements

### Clinical Imaging

**Milestone goal:** Dentist can document structured clinical findings on radiographs and perform complete cephalometric analysis with auto-calculated measurements.
**Tier:** Addon/Professional
**Depends on:** v1.3 Imaging Workspace

#### Features

| ID | Requirement | Priority | Tier |
|----|------------|----------|------|
| CIMG-01 | User can document structured imaging findings (caries, bone loss, periapical lesion, fracture, calculus, impaction, resorption, missing, implant, root canal, crown, bridge, filling, abscess, cyst, other) | P0 | Addon |
| CIMG-02 | Each finding is linked to tooth number, surface, image, annotation, visit, and provider | P0 | Addon |
| CIMG-03 | Finding status follows workflow: suspected → confirmed → monitoring → resolved | P0 | Addon |
| CIMG-04 | Finding can be linked to a treatment plan item | P1 | Addon |
| CIMG-05 | User can use quick-select finding templates | P1 | Addon |
| CIMG-06 | User can select affected teeth via dental chart | P1 | Addon |
| CIMG-07 | User can manually place cephalometric landmarks (Sella, Nasion, A Point, B Point, Pogonion, Menton, Gonion, Orbitale, Porion, upper/lower incisor tip and apex, ANS, PNS) | P0 | Addon |
| CIMG-08 | System auto-calculates ceph measurements after landmark placement (SNA, SNB, ANB, mandibular plane angle, facial angle, interincisal angle, overjet, overbite, and others) | P0 | Addon |
| CIMG-09 | System renders tracing overlays (lines, planes, angles, landmark labels) | P0 | Addon |
| CIMG-10 | User can toggle visibility of each overlay layer | P1 | Addon |
| CIMG-11 | User can export tracing as image or PDF report | P1 | Addon |
| CIMG-12 | User can zoom in for precision landmark placement | P0 | Addon |
| CIMG-13 | User can drag landmarks to adjust; measurements recalculate instantly | P0 | Addon |
| CIMG-14 | User can lock confirmed landmark points | P1 | Addon |
| CIMG-15 | Ceph analysis results (measurements JSONB, analysis type) are stored per image | P0 | Addon |

#### Business Rules

- **BR-028**: Provider must confirm findings before they become part of the clinical record
- **BR-029**: Finding status transitions are one-directional. No backward transitions without creating a new finding entry.
- **BR-030**: Ceph measurements auto-recalculate when any landmark is moved
- **BR-031**: Ceph landmark `source` field tracks provenance: `manual`, `ai`, `ai_corrected` (forward-compatible with v2 AI layer)
- **BR-032**: Confirmed findings are immutable — corrections create a new finding referencing the original

#### State Transitions

- Finding: `suspected` → `confirmed` → `monitoring` → `resolved`
- Ceph Landmark: `placed` → `confirmed` → `locked`

---

## v1.5 Requirements

### Periodontal Charting

Deferred from v1.3. Scope unchanged.

- **PERIO-01**: User can record periodontal pocket depths per tooth
- **PERIO-02**: User can view periodontal chart with color-coded severity
- **PERIO-03**: User can track periodontal progression over visits

### Tech Debt

- **DEBT-01**: Refactor orphaned components from raw fetch() to TanStack Query hooks
- **DEBT-02**: Responsive/polish pass on all screens

---

## v2.x Requirements (Planned)

### AI Imaging (Premium Tier)

- AI-suggested cephalometric landmark placement
- AI-generated imaging notes from structured findings
- AI caries/pathology flagging with dentist review workflow
- Image comparison with AI-assisted alignment

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| iPad-native features (Apple Pencil, Split View) | Requires v2.0 platform work — iPad imaging via Tauri app |
| P2P sync / offline-first | Cadence integration — requires v2.1 infrastructure |
| TDD retrofit | Backend already tested (254 repo + 297 handler tests). Assembly milestone. |
| Responsive/polish pass | Ship functional first, polish in v1.3 |
| Claims EDI / insurance billing | Separate product concern, not practice management MVP |
| PACS integration | Medical imaging infrastructure, out of scope for web MVP |
| AI-assisted imaging | v2+ Premium tier — non-AI foundation first |
| DICOM support | Phase 1 imaging roadmap defers DICOM; JSONB column reserved on schema |
| CBCT / 3D DICOM | Advanced future feature, not MVP |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| WBAR-01 | Phase 1 | Done |
| WBAR-02 | Phase 1 | Done |
| WBAR-03 | Phase 1 | Done |
| WBAR-04 | Phase 1 | Done |
| WBAR-05 | Phase 1 | Done |
| WBAR-06 | Phase 1 | Done |
| TXPL-01 | Phase 2 | Done |
| TXPL-02 | Phase 2 | Done |
| TXPL-03 | Phase 2 | Done |
| PROF-01 | Phase 3 | Done |
| PROF-02 | Phase 3 | Done |
| PROF-03 | Phase 3 | Done |
| PROF-04 | Phase 3 | Done |
| ATCH-01 | Phase 4 | Done |
| ATCH-02 | Phase 4 | Done |
| ATCH-03 | Phase 4 | Done |
| PAY-01 | Phase 4 | Done |
| PAY-02 | Phase 4 | Done |
| PAY-03 | Phase 4 | Done |
| RPT-01 | Phase 5 | Done |
| RPT-02 | Phase 5 | Done |

**Coverage:**
- v1.2 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-06*
*Last updated: 2026-05-10 — all v1.2 items marked done (phases 1-5 shipped)*
