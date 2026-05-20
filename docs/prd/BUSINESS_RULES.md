# Dentalemon — Business Rules Catalog

**V3 Addendum · Plan B Phase 4 · May 2026**

Companion to `docs/prd/v3-dentalemon.md`. Formalizes implicit business rules extracted from handler code and the acceptance criteria document. Each rule has:

- **BR-NNN** — stable identifier (reference in code comments, tests, and bug reports)
- **Type** — category of rule
- **Source** — where the rule is implemented or implied
- **Status** — `implemented`, `partial`, or `not-implemented`

---

## Business Rules

### Visit Lifecycle

| ID | Rule | Type | Source | Status |
|----|------|------|--------|--------|
| BR-001 | A patient cannot have two active visits simultaneously. A new check-in is blocked if an `active` visit already exists for that patient at the same branch. | Conflict prevention | `dental-visit` handlers | implemented |
| BR-002 | Visit state transitions are strictly linear: `draft` → `active` → `completed` → `locked`. No state reversal is permitted. | State guard | `dental-visit` handlers | implemented |
| BR-003 | A visit is immutable after status reaches `completed` or `locked`. Chart entries, treatments, prescriptions, and lab orders cannot be added, edited, or deleted. | State guard | `_workspace/$patientId.tsx` — `isReadOnly` flag | implemented |
| BR-004 | An appointment check-in creates a visit record. Deleting the appointment does not delete the visit. | Lifecycle coupling | `dental-scheduling` + `dental-visit` handlers | implemented |
| BR-005 | A new visit created from the workspace carousel ("+") auto-discards if no chart entries or treatments are saved within the same session. | Lifecycle guard | Not yet enforced — planned | not-implemented | **Deferred to v1.3** — requires session timeout infrastructure (WebSocket heartbeat) |

### Treatment

| ID | Rule | Type | Source | Status |
|----|------|------|--------|--------|
| BR-006 | Treatment state transitions are forward-only: `diagnosed` → `planned` → `performed` → `verified`. `dismissed` is reachable from any non-terminal state. No reversal is permitted. | State guard | `treatment.schema.ts` — `TREATMENT_TRANSITIONS` | partial |
| BR-007 | A completed treatment is immutable — its procedure code, tooth, surface, and price cannot be changed. | State guard | `dental-clinical` handlers | implemented |
| BR-008 | Carried-over treatments from a treatment plan appear in the workspace treatment table as a visual indicator. They are not auto-added as charges until the dentist explicitly records them in the current visit. | Business logic | `_workspace/$patientId.tsx` — `carriedOverItems` | implemented |

### Billing and Invoicing

| ID | Rule | Type | Source | Status |
|----|------|------|--------|--------|
| BR-009 | An invoice requires at least one treatment line item. Creating an invoice with zero items is rejected. | Validation | `dental-billing` handlers | implemented |
| BR-010 | Tax is always 0. Fee schedule prices are pre-tax. Tax calculation is a stub pending per-country tax rules in Phase 2. | Calculation stub | `dental-billing/createInvoice.ts` (TODO comment) | partial |
| BR-011 | An active payment plan blocks invoice archival (void or uncollectible). Staff must resolve the payment plan before voiding. | Lifecycle guard | `dental-billing` handlers | implemented |
| BR-012 | Invoice state lifecycle: `draft` → `sent` → `paid` / `partial` / `overdue` / `void`. `partial` status requires a payment plan record. **Note:** Voiding from `paid` is intentional (admin correction for duplicate/error invoices). | State machine | `dental-billing` handlers | implemented |
| BR-013 | Dental invoices do not support an `uncollectible` status. The dental invoice status enum is closed (`draft → issued → partial → paid / overdue / voided`). The base billing module has a `markInvoiceUncollectible` handler, but it does not apply to dental invoices. | Deferred | `dental-billing/repos/dental-invoice.schema.ts` — no 'uncollectible' in status enum | deferred |

### Consent and Compliance

| ID | Rule | Type | Source | Status |
|----|------|------|--------|--------|
| BR-014 | Consent form is immutable once signed. No edits, no re-signing, no deletion. The signed record is append-only. | Compliance | `dental-clinical` handlers + `consent-sheet.tsx` | implemented |
| BR-015 | Patient registration requires explicit consent (`consentGiven: true`). Registration is rejected without it. | Validation | `dental-patient` handlers + `patient-registration-modal.tsx` | implemented |

### Authorization

| ID | Rule | Type | Source | Status |
|----|------|------|--------|--------|
| BR-016 | Branch membership is required for all clinical data access. Every handler calls `assertBranchAccess` which verifies the requesting user holds a `DentalMembership` record for the requested branch. | Authorization | `assert-branch-access.ts` | implemented |
| BR-017 | Prescription creation requires a `prescriberMemberId` — the ID of a dentist-role member. Non-dentist staff cannot write prescriptions. | Authorization | `dental-clinical` handlers + `rx-sheet.tsx` | implemented |

### Prescriptions and Lab Orders

| ID | Rule | Type | Source | Status |
|----|------|------|--------|--------|
| BR-018 | Lab order state lifecycle: `ordered` → `in_progress` → `completed` / `cancelled`. A completed order cannot transition to any other state. | State machine | `dental-clinical` handlers | implemented |

### Patient Records

| ID | Rule | Type | Source | Status |
|----|------|------|--------|--------|
| BR-019 | Clinical records are immutable and append-only. Corrections are additive amendments — the original entry is preserved. | Compliance | Per V3 PRD §2.3 constraints | partial — enforced at API, no amendment UI yet |
| BR-020 | Patient merge and unmerge are not implemented. Duplicate patients must be manually managed. | Implementation gap | `dental-patient/mergePatients.ts`, `unmergePatients.ts` (TODO) | not-implemented |

### PMD — Portable Medical Document

| ID | Rule | Type | Source | Status |
|----|------|------|--------|--------|
| BR-021 | A PMD is generated per-visit and verified by checksum. Future changes to the visit record do not alter the PMD — it is a snapshot. | Compliance | `dental-pmd` handlers | implemented |
| BR-022 | An imported external PMD is stored as-is (read-only). Its data is not merged into the patient's editable records automatically. | Data integrity | `dental-pmd` handlers | implemented |

---

## Architectural Decisions

These are decisions made during development that constrain how the system behaves. They are recorded here to prevent re-litigating them and to inform future work.

### ADR-001: iPad-First with 44px Touch Targets

**Decision**: All interactive elements (buttons, tabs, drag handles) must be at least 44×44px.  
**Rationale**: Primary device is iPad, used chairside with gloved or damp hands. Apple HIG minimum touch target is 44pt. This is a hard constraint from V3 PRD §2.3.  
**Implementation**: Applied in Plan B Phase 3. `WorkspaceTopBar` icon buttons `h-11 w-11`, all calendar buttons `h-11`, `WorkspaceTabs` `min-h-[44px]`.

### ADR-002: SDK-Generated Hooks, No Mock API

**Decision**: All data fetching uses TanStack Query hooks generated from the OpenAPI spec (`@monobase/sdk-ts`). `mock-api.ts` is deleted.  
**Rationale**: Mock API diverged from real API causing silent integration failures. SDK hooks provide type-safe, contract-aligned data fetching.  
**Implementation**: Completed in Plan B Phase 2. `mock-api.ts` deleted, 9 hooks migrated to SDK hooks.

### ADR-003: SVG Dental Chart with FDI and Universal Notation

**Decision**: Dental chart uses SVG tooth paths stored in `public/teeth/`. Supports both FDI (international) and Universal (US) notation via `universal-tooth.tsx` and `universal-tooth-fdi.tsx`.  
**Rationale**: Dental-native charting is the #1 product differentiator. SVG allows per-tooth color coding, surface highlighting, and interactive tap targets.  
**Implementation**: Ported from `apps/sample-workspace/` in Plan B Phase 1. Tooth paths in `public/teeth/{01..32}.svg`.

### ADR-004: Timeline Carousel Uses Swiper with Touch Gestures

**Decision**: The visit timeline carousel is built on Swiper.js with touch events enabled.  
**Rationale**: Swiper provides production-quality swipe physics, momentum scrolling, and touch capture that are infeasible to replicate custom. The carousel is the primary UX differentiator and must feel native.  
**Implementation**: `timeline-carousel.tsx`. Touch events are captured by Swiper; the `ResizableDivider` uses `touch-none` to prevent gesture conflicts.

### ADR-005: Workspace Layout is Flex-Row (Carousel Left, Table Right)

**Decision**: The clinical workspace uses a horizontal split — dental chart/carousel on the left column, treatment table on the right column (`flex flex-row`).  
**Rationale**: On iPad landscape (the primary device), this layout uses horizontal space efficiently. The chart is the primary interaction point; the treatment table is secondary reference.  
**Implementation**: `_workspace/$patientId.tsx`. Carousel zone: `shrink-0`. Table zone: `flex-1 min-w-0`. Divider: `ResizableDivider` (vertical, `w-2 cursor-col-resize`).  
**Caveat**: `handleResize` is currently a no-op — the divider is visually correct but non-functional for resizing. Resizing is deferred.

### ADR-006: Version Column Exists but Optimistic Locking Is Not Enforced

**Decision**: The base entity schema includes a `version` column, but no handler enforces `WHERE version = ?` checks.  
**Rationale**: Multi-user concurrent editing is low-frequency in solo/small practices. Last-write-wins is acceptable for Phase 1.  
**Risk**: Concurrent edits from two devices could silently overwrite each other. Document R5 in the audit risk register.  
**Revisit in**: Phase 2 (multi-device sync with CRDT layer).

### ADR-007: Session Expiry UX Is Undefined

**Decision**: Better-Auth sessions expire after 7 days server-side. No frontend behavior is defined for mid-session expiry.  
**Rationale**: Not implemented yet — clinical flow interruption risk is low in Phase 1 (solo dentist).  
**Risk**: A dentist mid-charting could lose unsaved work if session expires. Audit risk R6.  
**Required before Phase 2**: Define UX: save draft → redirect to login → restore context on re-auth.

### ADR-008: Tax Is Stubbed at Zero

**Decision**: Tax calculation always returns `0`. Invoice totals are pre-tax.  
**Rationale**: Per-country tax rules (VAT, GST) vary. Philippines BIR rules are defined but not yet wired. Implementing partial tax rules would create false confidence.  
**Implementation**: `dental-billing/createInvoice.ts` — TODO comment.  
**Revisit in**: Phase 2 (per-country localization layer).

### ADR-009: Delete Semantics Are Mixed (Audit Gap)

**Decision**: No unified delete strategy. Current behavior varies by entity: some entities use soft-delete (archive), some use hard-delete, some use void.  
**Rationale**: Each module was built independently and inherited the most natural semantic.  
**Risk**: Ambiguity Gate item §22 FAIL. This is a known gap.  
**Required**: Document per-entity delete semantics before Phase 2 exposes this to more surfaces.

### ADR-010: BR-005 Auto-Discard Empty Visit — Deferred

**Decision**: BR-005 (auto-discard a new visit if no chart entries or treatments are saved within the session) is formally deferred and will not be enforced in Phase 1.  
**Rationale**: Enforcement requires a WebSocket heartbeat or server-side session timeout mechanism to detect abandoned sessions. Neither is built. Implementing a naive TTL-based purge job risks discarding visits that were legitimately started but not yet charted (e.g., dentist pauses to answer a call).  
**Risk**: Abandoned `draft` visits accumulate in the DB. Low clinical risk — they hold no billable data and are invisible in the UI once the session ends. Staff can manually delete via admin tools.  
**Revisit in**: Phase 2 when WebSocket or SSE session infrastructure is added. At that point, implement a `draft` visit purge job gated on zero chart entries + zero treatments + session heartbeat timeout.

---

## Rule Test Coverage Map

This table maps business rules to the test files that verify them. Update when tests are added.

| Rule | Backend Test | Frontend Test | Status |
|------|-------------|---------------|--------|
| BR-001 | — | `use-visits.test.ts` — "activeVisit is the visit with status=active" `[BR-001]` | covered |
| BR-002 | — | — | no test |
| BR-003 | — | `treatment-table.test.ts` — "does not render Mark Done button when readOnly=true" `[BR-003]` | covered |
| BR-004 | `business-rules.test.ts` — describe('BR-004') cancel appointment, visit remains | `check-in-flow.test.ts` — "returns visitId and appointment" `[BR-004]` | covered |
| BR-005 | `business-rules.test.ts` — describe.skip (placeholder) | — | placeholder |
| BR-006 | — | `use-treatments.test.ts` `[BR-006]`, `use-save-treatment.test.ts` `[BR-006]` | covered |
| BR-007 | `business-rules.test.ts` — describe('BR-007') field-edit guard enforced | `treatment-table.test.ts` — "does not render Mark Done button when readOnly=true" `[BR-007]` | covered |
| BR-008 | — | `treatment-table.test.ts` — test.skip placeholder `[BR-008]` | placeholder |
| BR-009 | `business-rules.test.ts` — describe('BR-009') `[BR-009]` | `workspace-payment-modal.test.ts` — "Create Invoice disabled with no line items" `[BR-009]` | covered |
| BR-010 | `business-rules.test.ts` — describe('BR-010') taxCents===0 | — | covered |
| BR-011 | `business-rules.test.ts` — describe('BR-011') void blocked by active plan | `workspace-payment-modal.test.ts` — voided invoice filter `[BR-011]` | covered |
| BR-012 | `business-rules.test.ts` — describe('BR-012') `[BR-012]` (4 tests) | `workspace-payment-modal.test.ts` — invoice banner `[BR-012]` | covered |
| BR-013 | `business-rules.test.ts` — describe.skip (placeholder) | — | placeholder |
| BR-014 | — | `consent-sheet.test.ts` — signed immutability `[BR-014]` | covered |
| BR-015 | `business-rules.test.ts` — consent guard enforced (handler fix) | `patient-registration-modal.test.ts` — consent checkbox `[BR-015]` | covered |
| BR-016 | `business-rules.test.ts` — describe('BR-016') `[BR-016]` (3 tests) | — | covered |
| BR-017 | `business-rules.test.ts` — describe('BR-017') missing prescriberMemberId → 4xx | `rx-sheet.test.ts` — payload includes prescriberMemberId `[BR-017]` | covered |
| BR-018 | `business-rules.test.ts` — describe('BR-018') 7 lifecycle transitions | `lab-orders-sheet.test.ts` — status transitions `[BR-018]` | covered |
| BR-019 | `business-rules.test.ts` — test.skip (placeholder) | — | placeholder |
| BR-020 | `business-rules.test.ts` — describe.skip (placeholder) | — | placeholder |
| BR-021 | `business-rules.test.ts` — describe('BR-021') snapshot/checksum `[BR-021]` (4 tests) | — | covered |
| BR-022 | `business-rules.test.ts` — describe('BR-022') PATCH/DELETE/PUT → 404 | — | covered |
| BR-023 | `imaging.test.ts` — 21 tests, 8 geometry types `[BR-023]` | — | covered |
| BR-024 | `imaging.test.ts` — calibration + tier tests `[BR-024]` | — | covered |
| BR-025 | `imaging.test.ts` — patient_id referential integrity `[BR-025]` | — | covered |
| BR-026 | `imaging.test.ts` — all 4 role scenarios `[BR-026]` | — | covered |
| BR-027 | `imaging.test.ts` — associate own-only delete `[BR-027]` | — | covered |
| BR-028 | — | — | no test (P1 gap V-IMG-004) |
| BR-029 | `imaging.test.ts` — branch isolation 6 tests `[BR-029]` | — | covered |
| BR-030 | `imaging.test.ts` — legacy attachment adapter `[BR-030]` | — | covered |
| BR-031 | — | — | unauditable (frontend only) |
| BR-032 | `imaging.test.ts` — modality non-nullable `[BR-032]` | — | covered |
| BR-033 | `imaging.test.ts` — upload size delegates `[BR-033]` | — | covered |
| BR-034 | `imaging.test.ts` — MIME type validation `[BR-034]` | — | covered |
| BR-035 | `imaging.test.ts` — last-write-wins annotation `[BR-035]` | — | covered |
| BR-036 | `ceph.test.ts` — `CIMG-07 batch upsert landmarks` idempotency | — | covered |
| BR-037 | `ceph.test.ts` — `CIMG-14 lock matrix` batch rejection | — | covered |
| BR-038 | `ceph.test.ts` — `CIMG-15 recompute idempotent` | — | covered |
| BR-039 | `ceph.test.ts` — `D-J calibration provenance` | — | covered |
| BR-040 | `ceph.test.ts` — calibration unit display | — | no test |
| BR-041 | `ceph.test.ts` — `Branch isolation — non-member → 404` | — | covered |
| BR-042 | `ceph.test.ts` — `Version monotonicity` | — | covered |
| BR-043 | `ceph.test.ts` — `D-G label — steiner_hybrid_sn` | — | covered |
| BR-044 | `ceph.test.ts` — `CIMG-14 lock matrix` (confirmed DELETE permitted) | — | covered |
| BR-045 | `ceph.test.ts` — `D4 snapshot fields` nullable measurements | — | covered |
| BR-046 | `ceph.test.ts` — stale state after PATCH coordinates | — | no test |
| BR-047 | `ceph.test.ts` — `CIMG-07 batch upsert landmarks` 404 on missing image | — | covered |

---

## Clinical Imaging (v1.3 / v1.4) — BR-023 to BR-035

**Module:** `dental-imaging` | **Branch:** `feat/v1.4-clinical-imaging` | **Added:** 2026-05-16

These rules govern the imaging workspace, finding state machine, access control, and file handling implemented in `services/api-ts/src/handlers/dental-imaging/`.

| ID | Rule | Type | Source | Status | Notes |
|----|------|------|--------|--------|-------|
| BR-023 | Annotations are non-destructive overlays on top of immutable images. Geometry is stored in `imaging_annotation.data` (JSONB); the underlying image record is never mutated. | Data integrity | `imaging.schema.ts:89–109`, `updateAnnotation.ts` | implemented | 8 geometry types validated |
| BR-024 | Panoramic images display a measurement-accuracy warning until the branch has set calibration data for that image. | UX guard | `updateImageCalibration.ts`, calibration endpoint | partial | Warning delivery is Phase 3a; calibration endpoint exists |
| BR-025 | An image must be linked to a patient (`patient_id` NOT NULL). It may optionally be linked to a visit and/or specific teeth via join table. | Referential integrity | `imaging.schema.ts:56–87` | implemented | |
| BR-026 | Image deletion is default-deny. Only `dentist` and `associate` roles may delete images. All other roles receive 403. | Access control | `deleteImage.ts:21,43–46` — `ROLES_ALLOWED_TO_DELETE` | implemented | |
| BR-027 | An `associate` may only delete images they personally acquired (`acquiredBy === user.id`). Attempting to delete another user's image returns 403. | Access control | `deleteImage.ts:49–51` | implemented | |
| BR-028 | Image deletion is soft-only. DELETE sets `status='archived'`; no row is physically removed. | Data integrity | `imaging.repo.ts:110–114` — `archiveImage()` | implemented | |
| BR-029 | Branch isolation applies to all 13 imaging endpoints. Every handler calls `assertBranchAccess`. Finding details are hidden from users without branch membership (info-hiding). | Multi-tenancy | All 13 imaging handlers | implemented | |
| BR-030 | Legacy `dental_attachment` records (xray → other, photo → intraoral_photo) are surfaced as imaging items via a union adapter in `listPatientImages`. Document and deleted attachments are excluded. | Backwards compatibility | `listPatientImages.ts:82–130` | implemented | |
| BR-031 | Images are cached locally in IndexedDB for offline access in the imaging workspace. | Offline UX | Frontend feature | unauditable | Frontend only; backend unaffected |
| BR-032 | Image `modality` is non-nullable with default `'other'`. Applies to both study and individual image records. | Schema constraint | `imaging.schema.ts:62,75` | implemented | |
| BR-033 | Maximum upload file size is 100 MB. Enforcement is delegated to the storage multipart layer. | Validation | `createImagingStudy.ts`, storage multipart | partial | Handler delegates; no explicit byte-count guard at handler level |
| BR-034 | Allowed image formats: JPEG, PNG, TIFF, BMP. Uploads with other MIME types are rejected with 422. | Validation | `createImagingStudy.ts:39–43` — `ALLOWED_IMAGING_MIME_TYPES` | implemented | |
| BR-035 | Concurrent annotation writes use last-write-wins (no optimistic locking). The most recently committed write takes effect. | Concurrency | `imaging.repo.ts` | implemented | Acceptable given low concurrency in clinical context |

### Imaging Finding State Machine (SM-01)

Findings track diagnostic observations and transition through: `suspected` → `confirmed` → `resolved`. Invalid transitions (e.g., `resolved` → `suspected`) are rejected with `BusinessLogicError`.

| Transition | Allowed | Enforced in |
|------------|---------|-------------|
| `suspected` → `confirmed` | ✅ | `updateFinding.ts` — `FINDING_TRANSITIONS` |
| `confirmed` → `resolved` | ✅ | `updateFinding.ts` — `FINDING_TRANSITIONS` |
| `resolved` → `suspected` | ❌ | `updateFinding.ts` — throws `BusinessLogicError` |
| Any → previous state | ❌ | `updateFinding.ts` — throws `BusinessLogicError` |

### Imaging Permission Matrix

| Role | List/View | Upload | Annotate | Delete |
|------|-----------|--------|----------|--------|
| `dentist` | ✅ | ✅ | ✅ | ✅ own + others |
| `associate` | ✅ | ✅ | ✅ | ✅ own only (BR-027) |
| `hygienist` | ✅ | ✅ | ✅ | ❌ |
| `front_desk` | ✅ | ❌ | ❌ | ❌ |

### Coverage Summary (imaging.test.ts)

| BR | Tests | Strength |
|----|-------|----------|
| BR-023 | 21 | Strong — 8 geometry types |
| BR-024 | 8 | Moderate — calibration + tier; warning deferred |
| BR-025 | 4 | Strong |
| BR-026 | 4 | Strong — all 4 role scenarios covered (dentist/associate/hygienist/front_desk) |
| BR-027 | 2 | Strong |
| BR-028 | 0 | **None** — P1 gap (V-IMG-004) |
| BR-029 | 6 | Strong |
| BR-030 | 2 | Strong |
| BR-031 | — | Unauditable |
| BR-032 | 3 | Strong |
| BR-033 | 2 | Weak — delegates to storage |
| BR-034 | 3 | Strong |
| BR-035 | 1 | Strong |

---

## Ceph Workspace (v1.4) — CIMG-001 to CIMG-008

**Module:** `dental-imaging` | **Branch:** `feat/v1.4-clinical-imaging` | **Added:** 2026-05-18

These rules govern cephalometric analysis: landmark placement, tier gating, report generation, and access control implemented in `services/api-ts/src/handlers/dental-imaging/CephMgmt_*.ts`.

| ID | Rule | Type | Source | Status |
|----|------|------|--------|--------|
| CIMG-001 | Cephalometric features require a paid imaging tier. If the branch's `imagingTier` is `'free'` or `null`, all `CephMgmt_*` endpoints return 403. | Access control | All `CephMgmt_*.ts` handlers — tier check before any DB write | implemented |
| CIMG-002 | A `null` `imagingTier` is treated identically to `'free'` — 403 returned. Absence of tier data is never interpreted as unlimited access. | Access control | All `CephMgmt_*.ts` handlers | implemented |
| CIMG-003 | Ceph landmark status transitions are strictly forward: `placed` → `confirmed` → `locked`. `locked` is terminal — no further status changes are permitted. | State guard | `imaging_ceph.schema.ts` — `CEPH_LANDMARK_TRANSITIONS` | implemented |
| CIMG-004 | A `locked` landmark is fully immutable. Any PATCH to coordinates or status, or DELETE, returns 422 with code `LANDMARK_LOCKED`. | State guard | `CephMgmt_updateCephLandmark.ts`, `CephMgmt_deleteCephLandmark.ts` | implemented |
| CIMG-005 | Invalid landmark status transitions (e.g., `confirmed` → `placed`, `locked` → `confirmed`) are rejected with 422 and code `INVALID_STATUS_TRANSITION`. | State guard | `CephMgmt_updateCephLandmark.ts` | implemented |
| CIMG-006 | Ceph report generation is gated on four required landmarks (`A`, `B`, `Go`, `Po`) all having status `confirmed`. Attempting to generate a report without all four confirmed returns a validation error. | Business logic | `imaging_ceph.schema.ts` — `CEPH_REPORT_GATE_LANDMARKS`, `CephMgmt_createCephReport.ts` | implemented |
| CIMG-007 | Branch isolation applies to all ceph endpoints. A non-member requesting any `CephMgmt_*` endpoint receives 404 (not 403) to avoid leaking branch existence. | Multi-tenancy | All `CephMgmt_*.ts` handlers — `assertBranchAccess` | implemented |
| CIMG-008 | Ceph reports are immutable versioned snapshots. Each report has a monotonically incrementing `version` per image (1, 2, 3…). No update or delete handlers exist. The snapshot is append-only and frozen at creation. | Data integrity | `imaging_ceph.schema.ts` — `imagingCephReports` (no update handler) | implemented |

### Ceph Landmark State Machine (SM-02)

| Transition | Allowed | Enforced in |
|------------|---------|-------------|
| `placed` → `confirmed` | ✅ | `CephMgmt_updateCephLandmark.ts` — `CEPH_LANDMARK_TRANSITIONS` |
| `confirmed` → `locked` | ✅ | `CephMgmt_updateCephLandmark.ts` — `CEPH_LANDMARK_TRANSITIONS` |
| `locked` → any | ❌ | `CephMgmt_updateCephLandmark.ts` — throws 422 `LANDMARK_LOCKED` |
| Any → previous state | ❌ | `CephMgmt_updateCephLandmark.ts` — throws 422 `INVALID_STATUS_TRANSITION` |

### Ceph Permission Matrix

All ceph endpoints inherit the imaging module's branch membership requirement (CIMG-007). Tier gating (CIMG-001) applies uniformly across all roles.

| Role | Read landmarks/analysis | Place/update landmarks | Delete landmark | Create report |
|------|------------------------|----------------------|-----------------|---------------|
| `dentist` | ✅ (paid tier) | ✅ (paid tier) | ✅ (paid tier) | ✅ (paid tier) |
| `associate` | ✅ (paid tier) | ✅ (paid tier) | ✅ (paid tier) | ✅ (paid tier) |
| `hygienist` | ✅ (paid tier) | ✅ (paid tier) | ✅ (paid tier) | ✅ (paid tier) |
| `front_desk` | ✅ (paid tier) | ✅ (paid tier) | ✅ (paid tier) | ✅ (paid tier) |
| Any role (free tier) | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| Non-member | ❌ 404 | ❌ 404 | ❌ 404 | ❌ 404 |

### Coverage Summary (ceph.test.ts)

| CIMG | Tests | Strength |
|------|-------|----------|
| CIMG-001 | 5+ | Strong — all major CephMgmt handlers tested on free tier |
| CIMG-002 | 1 | Strong — null tier → 403 |
| CIMG-003 | 3 | Strong — placed→confirmed→locked forward only |
| CIMG-004 | 3 | Strong — PATCH x, PATCH y, DELETE on locked → 422 |
| CIMG-005 | 2+ | Strong — invalid transition → 422 INVALID_STATUS_TRANSITION |
| CIMG-006 | 2+ | Strong — report gate on confirmed landmarks |
| CIMG-007 | 2 | Strong — non-member → 404 not 403 |
| CIMG-008 | 1 | Moderate — append-only verified via schema; no update handler exists |

---

## Ceph Workspace (v1.4) — CIMG-009 to CIMG-015

**Module:** `dental-imaging` | **Branch:** `feat/v1.4-clinical-imaging` | **Added:** 2026-05-19

Extends CIMG-001–008. Documents response contracts, recompute semantics, calibration provenance, and design decisions D-G, D-I, D-J, D-L, D-4.

> **Numbering note:** `ceph.test.ts` uses shorthand labels (`CIMG-07`, `CIMG-11`, etc.) that do not map 1:1 to the three-digit canonical IDs in this file. The test header `Covers: CIMG-07..15` refers to the test's own internal sequence. The Coverage Summary below provides the canonical↔test mapping.

| ID | Rule | Type | Source | Status |
|----|------|------|--------|--------|
| CIMG-009 | Every write handler (`batchUpsertCephLandmarks`, `updateCephLandmark`) triggers an inline analysis recompute and returns `{ items, analysis }`. Analysis is always fresh after any landmark write — callers never need a separate recompute call after a write. | Response contract | `CephMgmt_batchUpsertCephLandmarks.ts`, `CephMgmt_updateCephLandmark.ts` | implemented |
| CIMG-010 | The `analysisType` field on all analysis responses is always `'steiner_hybrid_sn'`. No other analysis type exists in v1.4. Clients must not hardcode `'standard'` or any other label. | Response contract | All `CephMgmt_*.ts` handlers returning analysis | implemented |
| CIMG-011 | `createCephReport` returns 201 with `{ id, imageId, version, snapshot, createdAt }`. The `snapshot` is a frozen JSON blob containing all measurement data at creation time and never changes afterwards. | Response contract | `CephMgmt_createCephReport.ts` | implemented |
| CIMG-012 | Version numbers for ceph reports are monotonically increasing per image (1, 2, 3…). A DB unique constraint on `(imageId, version)` prevents duplicate versions. Concurrent report creation is race-safe via the DB constraint. | Data integrity | `imaging_ceph.schema.ts` — unique index on `(imageId, version)`; `createReportVersion()` | implemented |
| CIMG-013 | `updateCephLandmark` (PATCH) returns `{ items, analysis }` — the full landmark list plus recomputed analysis, not just the patched landmark. Callers must not assume a single-landmark response shape. | Response contract | `CephMgmt_updateCephLandmark.ts` | implemented |
| CIMG-014 | A `locked` landmark is immutable across all three mutation axes: (a) coordinate PATCH → 422 `LANDMARK_LOCKED`; (b) status PATCH → 422 `LANDMARK_LOCKED`; (c) DELETE → 422 `LANDMARK_LOCKED`. | State guard | `CephMgmt_updateCephLandmark.ts`, `CephMgmt_deleteCephLandmark.ts` | implemented |
| CIMG-015 | `recomputeCephAnalysis` (`POST /analysis/recompute`) returns a single `CephAnalysis` object — not `{ items, analysis }`. The endpoint is idempotent: identical landmark state produces identical output. | Response contract | `CephMgmt_recomputeCephAnalysis.ts` | implemented |

### Design Decisions (D-G, D-I, D-J, D-L, D-4)

Architectural invariants baked into v1.4. Violation would break clients or corrupt historical data.

| ID | Decision | Rationale | Enforced in |
|----|----------|-----------|-------------|
| D-G | Snapshot `analysis_label` is always `'steiner_hybrid_sn'`. No other analysis type exists in v1.4. | Simplifies client rendering; extendable in v2 via a new analysis type. | `CephMgmt_createCephReport.ts` snapshot builder |
| D-I | `recomputeCephAnalysis` writes to `imagingCephAnalyses` only. It never touches `imagingCephReports` rows. Reports are frozen at creation — recompute updates the live analysis view, not the historical record. | Ensures report immutability; historical snapshots remain auditable. | `CephMgmt_recomputeCephAnalysis.ts` — no report mutation |
| D-J | `calibrationMethod` is `'manual_ruler'` when `pixelSpacingMm` is provided; `'not_calibrated'` when `pixelSpacingMm` is `null`. No other values. Set at recompute time, not at snapshot time. | Provenance traceability for measurements — uncalibrated values are flagged, not silently wrong. | `CephMgmt_recomputeCephAnalysis.ts` calibration logic |
| D-L | `getCephAnalysis` returns an empty/default analysis state when no analysis exists for a given image — never 404. 404 is reserved for an unknown `imageId`. | Simplifies client state machine: "no analysis yet" is a valid state, not an error. | `getCephAnalysis` handler — empty-state branch |
| D-4 | The report `snapshot` JSON must include all eight fields: `study_date`, `patient_display_id`, `branch_name`, `analysis_label`, `landmarks`, `measurements`, `calibration_value`, `calibration_method`. Missing fields indicate a snapshot builder bug. | Snapshot completeness is required for forensic and clinical review without querying live tables. | `CephMgmt_createCephReport.ts` snapshot builder |

### Coverage Summary (CIMG-009–015 + design decisions)

Mapping between `ceph.test.ts` shorthand labels and canonical IDs in this file:

| Canonical ID | Test Describe Label | Tests | Strength |
|--------------|---------------------|-------|----------|
| CIMG-009 | `BR-030 recompute-on-write` | 3 | Strong |
| CIMG-010 | `D-G label — steiner_hybrid_sn` (shared with D-G) | 2 | Strong |
| CIMG-011 | `CIMG-11 report assembly` | 3 | Strong |
| CIMG-012 | `Version monotonicity` | 2 | Strong |
| CIMG-013 | `CIMG-13 PATCH landmark` | 3 | Strong |
| CIMG-014 | `CIMG-14 lock matrix` | 3 | Strong |
| CIMG-015 | `CIMG-15 recompute idempotent` | 2 | Strong |
| D-G | `D-G label — steiner_hybrid_sn` | 2 | Strong |
| D-I | `D-I immutability` | 2 | Strong |
| D-J | `D-J calibration provenance` | 2 | Strong |
| D-L | `D-L confirm-gate` | 3 | Strong |
| D-4 | `D4 snapshot fields` | 4 | Strong |

---

## Ceph Workspace (v1.4) — BR-036 to BR-047

**Module:** `dental-imaging` | **Branch:** `feat/v1.4-clinical-imaging` | **Added:** 2026-05-20

Formal BR-numbered rules for ceph-specific behaviors. These rules complement the CIMG-NNN section (which documents implementation details and design decisions) by providing stable identifiers suitable for `br-registry.json`, code comments, and bug reports. Cross-references to CIMG counterparts are noted in the Notes column.

| ID | Rule | Type | Source | Status | Notes |
|----|------|------|--------|--------|-------|
| BR-036 | Ceph landmark batch upsert is idempotent — upserting the same landmark `id` with new coordinates replaces the existing entry without creating a duplicate row. Upsert semantics are enforced at the DB layer via `onConflictDoUpdate`. | Data integrity | `CephMgmt_batchUpsertCephLandmarks.ts`; `imaging_ceph.repo.ts` — `upsertLandmarks()` | implemented | Formalizes CIMG-007 (write path) |
| BR-037 | A batch upsert of landmarks is rejected in its entirety if any landmark in the batch is `locked`. The handler skips locked landmarks silently (no partial application, no error). This protects locked entries without requiring the caller to pre-filter. | State guard | `CephMgmt_batchUpsertCephLandmarks.ts` — locked-skip logic before upsert | implemented | Formalizes CIMG-004 applied to batch writes |
| BR-038 | `recomputeCephAnalysis` is idempotent — calling it multiple times with unchanged landmark state produces identical measurement output each time. It writes to `imagingCephAnalyses` only and never creates a report row. | Computation contract | `CephMgmt_recomputeCephAnalysis.ts`; design decision D-I | implemented | Formalizes CIMG-015 + D-I |
| BR-039 | Calibration provenance is captured in the report snapshot at creation time. The `pixelSpacingMm` value used to compute measurements is frozen into `snapshot.calibration`. Subsequent calibration changes do not retroactively update existing report snapshots. | Data integrity | `CephMgmt_createCephReport.ts` snapshot builder — `calibration: { value, method }` | implemented | Formalizes D-J (snapshot-time provenance) |
| BR-040 | Ceph analysis requires calibration (`pixelSpacingMm > 0`) to display mm-unit measurements. When `pixelSpacingMm` is `null` or `0`, raw pixel distances are computed but the calibration method is `'not_calibrated'` — clients must label uncalibrated measurements visually to prevent clinical misinterpretation. | UX guard | `CephMgmt_recomputeCephAnalysis.ts` — `calibrationMethod` logic; `CephMgmt_createCephReport.ts` snapshot | implemented | Extends D-J; no dedicated test for UI labeling (P2 gap) |
| BR-041 | Any `CephMgmt_*` operation on a non-existent image returns 404. Non-members also receive 404 (not 403) to avoid leaking image existence. 403 is never returned for missing images. | Multi-tenancy / security | All `CephMgmt_*.ts` handlers — `assertBranchAccess` produces 404 for non-members; `ImagingRepository.getById` returns 404 for unknown image | implemented | Formalizes CIMG-007 |
| BR-042 | Ceph report version numbers are monotonically increasing per image (1, 2, 3…). Gaps in version numbers are not permitted. A DB unique constraint on `(imageId, version)` enforces this and makes concurrent report creation race-safe. | Data integrity | `imaging_ceph.schema.ts` — unique index on `(imageId, version)`; `ImagingCephRepository.createReportVersion()` | implemented | Formalizes CIMG-008 + CIMG-012 |
| BR-043 | The `steiner_hybrid_sn` label is the mandatory analysis type for all v1.4 ceph analysis responses. Deviating from this label in analysis computations or response payloads is a schema violation. No other analysis type exists in v1.4. | Schema constraint | All `CephMgmt_*.ts` handlers returning analysis; `@monobase/ceph-math` `computeCephAnalysis` | implemented | Formalizes CIMG-010 + D-G |
| BR-044 | `DELETE /dental/imaging/images/:imageId/ceph/landmarks/:landmarkId` is permitted on landmarks with status `confirmed` or `placed`. Only `locked` landmarks are fully protected from deletion (returns 422 `LANDMARK_LOCKED`). Successful deletion resets the analysis state (triggers recompute or marks stale). | State guard | `CephMgmt_deleteCephLandmark.ts` — lock check; CIMG-014 lock matrix | implemented | Clarifies CIMG-004 and CIMG-014 — `confirmed` is mutable, `locked` is not |
| BR-045 | Ceph report snapshot measurement fields (`sna`, `snb`, `anb`, `witsAppraisal`, etc.) are nullable. If a required landmark is absent at report-creation time, the corresponding measurement is `null` in the snapshot rather than blocking report creation. Missing measurements produce `null` values — not errors. | Data integrity | `CephMgmt_createCephReport.ts` snapshot — `measurements` from `computeCephAnalysis`; D-4 snapshot completeness | implemented | Formalizes D-4 (null-safe measurements in snapshot) |
| BR-046 | After a landmark's coordinates are updated via PATCH, the ceph analysis is marked stale. The analysis is **not** automatically recomputed — the user must explicitly trigger `POST /analysis/recompute`. Until recomputed, the `{ items, analysis }` response from `updateCephLandmark` reflects the freshly recomputed state inline (CIMG-009), but subsequent `getCephAnalysis` reads may reflect pre-patch data until a standalone recompute is triggered. | Computation contract | `CephMgmt_updateCephLandmark.ts` — inline recompute on write (CIMG-009); `CephMgmt_recomputeCephAnalysis.ts` | implemented | Refines CIMG-009 — write handlers recompute inline; explicit recompute endpoint is idempotent but not mandatory after each write |
| BR-047 | All image-scoped `CephMgmt_*` routes require a valid `imageId` that exists in the `imagingImages` table. A request for a ceph operation on an `imageId` that does not exist returns 404. There is no study-level ceph endpoint — all ceph operations are image-scoped. | Referential integrity | All `CephMgmt_*.ts` handlers — `ImagingRepository.getById()` guard | implemented | Formalizes the 404-on-missing-image contract established by tests in `CIMG-07 batch upsert landmarks > returns 404 when image not found` |

### Coverage Summary (BR-036–047)

| BR | Test Describe Label | Tests | Strength |
|----|---------------------|-------|----------|
| BR-036 | `CIMG-07 batch upsert landmarks` | 4 | Strong — idempotency via upsert semantics |
| BR-037 | `CIMG-14 lock matrix` (batch path) | 3 | Strong |
| BR-038 | `CIMG-15 recompute idempotent` | 2 | Strong |
| BR-039 | `D-J calibration provenance` | 2 | Strong |
| BR-040 | _(no dedicated test)_ | 0 | **None** — P2 gap; calibration method logic is covered by D-J tests but UI labeling is untested |
| BR-041 | `Branch isolation — non-member → 404` | 2 | Strong |
| BR-042 | `Version monotonicity` | 2 | Strong |
| BR-043 | `D-G label — steiner_hybrid_sn` | 2 | Strong |
| BR-044 | `CIMG-14 lock matrix` (confirmed vs locked delete) | 3 | Strong |
| BR-045 | `D4 snapshot fields` (null measurements) | 4 | Strong |
| BR-046 | _(no dedicated stale-read test)_ | 0 | **None** — P2 gap; inline recompute on write is tested (CIMG-009) but stale-after-patch read path is not |
| BR-047 | `CIMG-07 batch upsert landmarks > returns 404 when image not found` | 1 | Moderate |

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-05-09 | 1.0 | Initial business rules catalog (22 rules) + 9 architectural decisions — Plan B Phase 4 |
| 2026-05-09 | 1.1 | Fixed BR-002 and BR-006 status terminology to match code (V3 audit correction) |
| 2026-05-09 | 1.2 | Full coverage map update — Plan B Phase 4 BR test suite complete (16 covered, 5 placeholder) |
| 2026-05-16 | 1.3 | Added BR-023–035 (dental-imaging module, v1.3/v1.4) — closes P3-SPEC-04 gap |
| 2026-05-18 | 1.4 | Added CIMG-001–008 (ceph workspace, v1.4) + SM-02 + ceph permission matrix — closes compliance spec gap V-DIMAG-spec-ceph; added ADR-010 (BR-005 formal deferral) |
| 2026-05-19 | 1.5 | Added CIMG-009–015 + design decisions D-G, D-I, D-J, D-L, D-4 — documents response contracts, recompute semantics, calibration provenance, and snapshot completeness; closes gap between ceph.test.ts coverage and spec |
| 2026-05-20 | 1.6 | Added BR-036–047 (ceph workspace formal BRs, G2-S2) — formalizes CIMG rules as stable BR identifiers for br-registry.json; expanded Rule Test Coverage Map to include BR-023–047 |
