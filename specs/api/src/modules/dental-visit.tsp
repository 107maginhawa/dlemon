/**
 * Dental Visit & Chart Module
 *
 * Visit lifecycle: draft → active → completed → locked
 * Treatment lifecycle: diagnosed → planned → performed → verified → dismissed
 */

import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/pagination.tsp";
import "../common/security.tsp";
import "../healthcare/core/primitives.tsp";
import "../healthcare/core/terminology.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

enum DentalVisitStatus {
  draft,
  active,
  completed,
  locked,
  // Abandoned before completion (BR-005 auto-discard of empty visits, and the
  // owner-initiated "Discard visit" escape hatch). The DB + FSM already produce
  // this state — declaring it here makes the wire type honest.
  discarded,
}

// E3: visit type scopes which roles may create/own/sign a visit.
//   general → dentist-led (owner/associate only); the default for all rows
//   hygiene → hygienist-led recall/prophy/perio (hygienist may create/check-in/sign)
enum DentalVisitType {
  general,
  hygiene,
}

enum DentalTreatmentStatus {
  diagnosed,
  planned,
  performed,
  verified,
  dismissed,
  declined,
}

@doc("P1-18: clinical sequencing phase (systemic → disease control → re-eval → definitive → maintenance)")
enum DentalTreatmentPhase {
  systemic,
  disease_control,
  re_evaluation,
  definitive,
  maintenance,
}

enum ToothState {
  healthy,
  caries,
  fractured,
  filled,
  crown,
  missing,
  implant,
  extracted,
  watchlist,
}

enum ToothSurfaceCode {
  mesial,
  distal,
  buccal,
  lingual,
  occlusal,
  incisal,
  cervical,
}

enum ChartEntryClassification {
  existing,
  existing_other,
  treatment_plan,
  condition,
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

@example(#{
  id: "v1a2b3c4-0000-4000-8000-000000000001",
  createdAt: utcDateTime.fromISO("2026-03-15T09:00:00Z"),
  updatedAt: utcDateTime.fromISO("2026-03-15T11:30:00Z"),
  version: 2,
  patientId: "d1a2b3c4-0000-4000-8000-000000000001",
  branchId: "b1a2b3c4-0000-4000-8000-000000000001",
  dentistMemberId: "m1a2b3c4-0000-4000-8000-000000000001",
  status: DentalVisitStatus.active,
  visitType: DentalVisitType.general,
  activatedAt: utcDateTime.fromISO("2026-03-15T09:05:00Z"),
  chiefComplaint: "Tooth sensitivity on lower left molar",
}, #{ title: "Active dental visit" })
model DentalVisit {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  version: int32;
  patientId: UUID;
  branchId: UUID;
  dentistMemberId: UUID;
  status: DentalVisitStatus;

  /** E3: 'general' (dentist-led, default) or 'hygiene' (hygienist-led). */
  visitType: DentalVisitType;
  activatedAt?: utcDateTime;
  completedAt?: utcDateTime;
  lockedAt?: utcDateTime;
  chiefComplaint?: string;
}

model CreateDentalVisitRequest {
  patientId: UUID;
  branchId: UUID;
  dentistMemberId: UUID;
  chiefComplaint?: string;

  /**
   * E3: 'general' (default, dentist-led) or 'hygiene' (hygienist-led recall/prophy/perio).
   * A hygienist may only create a 'hygiene'-typed visit; 'general' stays owner/associate-only.
   */
  visitType?: DentalVisitType;

  /** GAP-001: optional client-generated id for offline-first idempotent sync */
  localId?: string;
}

model UpdateDentalVisitRequest {
  status?: DentalVisitStatus;
  chiefComplaint?: string;
}

model ToothChartState {
  toothNumber: int32;
  state: ToothState;
  surfaces?: ToothSurfaceCode[];
  conditionCode?: string;
  note?: string;
  surfaceConditionMap?: Record<string>;
  entryClassification?: ChartEntryClassification;

  /**
   * SL-02 / F-G03: monotonic per-tooth logical clock for offline-first
   * last-write-wins merge. Higher clock wins; a lower incoming clock is a stale
   * offline write and is rejected by the server merge. Omit for online writes.
   */
  clock?: int32;
}

/**
 * Cumulative as-of treatment layer sets — FDI tooth numbers derived from the
 * patient's whole charted treatment history AS OF this visit's date (precedence
 * proposed > completed > declined). Lets each historical carousel card paint the
 * chart state at that point in time (e.g. a filling stays Treated on later cards),
 * instead of only this visit's deltas.
 */
model DentalChartLayerSets {
  proposed: int32[];
  completed: int32[];
  declined: int32[];
}

model DentalChart {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  visitId: UUID;
  patientId: UUID;
  teeth: ToothChartState[];
  /** Cumulative as-of status layers for this visit (see DentalChartLayerSets). Omitted on the baseline-fallback path. */
  layers?: DentalChartLayerSets;
  /** FDI tooth numbers whose layer transitioned IN this visit (drives the "changed this visit" cue). */
  changedThisVisit?: int32[];
  /** FDI tooth numbers in a terminal state (missing/extracted) as-of this visit — stripped from the actionable layers, painted at top precedence. */
  terminalTeeth?: int32[];
}

model CreateDentalChartRequest {
  visitId: UUID;
  patientId: UUID;
  teeth: ToothChartState[];

  /** GAP-001: optional client-generated id for offline-first idempotent sync */
  localId?: string;
}

model UpdateToothRequest {
  toothNumber: int32;
  state: ToothState;
  surfaces?: ToothSurfaceCode[];
  conditionCode?: string;
  note?: string;
  surfaceConditionMap?: Record<string>;
  entryClassification?: ChartEntryClassification;
}

// ---------------------------------------------------------------------------
// P0-A: Offline conflict visibility & resolution
//
// The server already rejects stale offline chart writes (clock-aware baseline
// merge) and persists the loser to dental_chart.conflictPayload with
// syncStatus='conflict' — but nothing could read or resolve them, so dropped
// clinical edits accumulated invisibly. These ops surface and resolve them.
// ---------------------------------------------------------------------------

/** How a clinician resolves an open chart sync conflict. */
enum ChartConflictResolution {
  /** The rejected (offline) write becomes the truth — re-applied as a NEW change
   *  with a NEW (higher) clock. Never mutates history. */
  accept,
  /** Keep the current value; discard the rejected offline write. Requires a reason. */
  dismiss,
}

/** A durable record of one chart write rejected as a stale offline edit. */
model ChartConflict {
  chartId: UUID;
  visitId: UUID;
  patientId: UUID;
  /** Machine reason the write was rejected (e.g. 'stale_clock_rejected'). */
  reason: string;
  /** The tooth states that lost the clock comparison and were not applied. */
  rejectedTeeth: ToothChartState[];
  /** When the conflict was recorded (chart updatedAt). */
  detectedAt: utcDateTime;
}

model ResolveChartConflictRequest {
  resolution: ChartConflictResolution;
  /**
   * Required when resolution = dismiss (5–500 chars): why the offline edit was
   * discarded. Ignored for 'accept'.
   */
  @minLength(5)
  @maxLength(500)
  reason?: string;
}

// ---------------------------------------------------------------------------
// P0-B: Structured chart export
//
// A structured (not screenshot) snapshot of a visit's chart: patient/provider/
// date header, the odontogram tooth/surface table with derived layers, a legend,
// and a treatment-plan summary (proposed/completed/declined). Mirrors exportPMD.
// ---------------------------------------------------------------------------

model ChartExportTooth {
  toothNumber: int32;
  state: string;
  /** Derived display layer: baseline | proposed | completed | declined | unset. */
  layer: string;
  surfaces?: string[];
  conditionCode?: string;
  entryClassification?: ChartEntryClassification;
  note?: string;
}

model ChartExportTreatment {
  toothNumber?: int32;
  cdtCode: string;
  description: string;
  surfaces?: string[];
  status: DentalTreatmentStatus;
  priceCents: int32;
}

model ChartExportLegendEntry {
  key: string;
  label: string;
}

model ChartExportSummary {
  proposedCount: int32;
  completedCount: int32;
  declinedCount: int32;
  /** Sum of priceCents of the proposed (diagnosed/planned) treatments. */
  totalProposedCents: int32;
}

model ChartExport {
  patientId: UUID;
  patientName: string;
  patientDateOfBirth?: string;
  visitId: UUID;
  visitDate: utcDateTime;
  visitStatus: DentalVisitStatus;
  providerMemberId?: UUID;
  providerName?: string;
  branchId: UUID;
  branchName?: string;
  /** Canonical tooth notation of the export — always FDI. */
  notation: string;
  generatedAt: utcDateTime;
  teeth: ChartExportTooth[];
  treatments: ChartExportTreatment[];
  summary: ChartExportSummary;
  legend: ChartExportLegendEntry[];
}

// ---------------------------------------------------------------------------
// P0-C: Condition-vocabulary enrichment + finding → treatment
//
// `state` stays the high-level visual layer on the odontogram. A curated
// findings vocabulary lets common diagnoses be recorded as structured findings
// (tooth- or surface-level) instead of collapsing into a generic note, and a
// finding can be converted into a treatment. Inactive (resolved) findings stop
// rendering as active.
// ---------------------------------------------------------------------------

/** Curated v1 clinical findings vocabulary. `other` requires a note. */
enum ConditionCode {
  caries,
  abscess,
  calculus,
  gingival_recession,
  impacted_unerupted,
  retained_root,
  sensitive_dentin,
  fracture_crack,
  wear_erosion,
  developmental_anomaly,
  other,
}

enum FindingStatus {
  active,
  resolved,
}

model DentalFinding {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  visitId: UUID;
  patientId: UUID;
  toothNumber: int32;
  surface?: ToothSurfaceCode;
  conditionCode: ConditionCode;
  note?: string;
  status: FindingStatus;
  /** Set when the finding has been converted to / linked with a treatment. */
  linkedTreatmentId?: UUID;
}

model CreateFindingRequest {
  toothNumber: int32;
  surface?: ToothSurfaceCode;
  conditionCode: ConditionCode;
  /** Required when conditionCode = other (free-text diagnosis). */
  note?: string;
  /** GAP-001: optional client-generated id for offline-first idempotent sync. */
  localId?: string;
}

model UpdateFindingRequest {
  conditionCode?: ConditionCode;
  surface?: ToothSurfaceCode;
  note?: string;
  status?: FindingStatus;
}

model ConvertFindingToTreatmentRequest {
  cdtCode: string;
  description: string;
  /** Optional — defaults from the branch fee schedule when omitted. */
  priceCents?: int32;
}

@example(#{
  id: "t1a2b3c4-0000-4000-8000-000000000001",
  createdAt: utcDateTime.fromISO("2026-03-15T09:10:00Z"),
  updatedAt: utcDateTime.fromISO("2026-03-15T10:00:00Z"),
  visitId: "v1a2b3c4-0000-4000-8000-000000000001",
  patientId: "d1a2b3c4-0000-4000-8000-000000000001",
  toothNumber: 36,
  surfaces: #[ToothSurfaceCode.occlusal, ToothSurfaceCode.mesial],
  cdtCode: "D2392",
  description: "Resin-based composite — three surfaces, posterior",
  conditionCode: "K02.1",
  status: DentalTreatmentStatus.planned,
  priceCents: 18000,
  carriedOver: false,
  phase: DentalTreatmentPhase.definitive,
  priority: 0,
}, #{ title: "Planned composite restoration" })
model DentalTreatment {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  visitId: UUID;
  patientId: UUID;
  toothNumber?: int32;
  surfaces?: ToothSurfaceCode[];
  cdtCode: string;
  description: string;
  conditionCode?: string;
  status: DentalTreatmentStatus;
  dismissReason?: string;
  refusalReason?: string;
  /** Price in cents, locked at recording time (EC4) */
  priceCents: int32;
  carriedOver: boolean;
  sourceVisitId?: UUID;
  autoDismissed?: boolean;
  clinicalNotes?: string;

  /** P1-18: clinical sequencing phase (null = unphased) */
  phase?: DentalTreatmentPhase;

  /** P1-18: intra-phase ordering — lower is scheduled sooner */
  priority: int32;

  /** P1-21: linked scheduled appointment (proposed → scheduled → done). */
  appointmentId?: UUID;
}

model CreateDentalTreatmentRequest {
  visitId: UUID;
  patientId: UUID;
  toothNumber?: int32;
  surfaces?: ToothSurfaceCode[];
  cdtCode: string;
  description: string;
  conditionCode?: string;
  /**
   * Price in cents. Optional: when omitted, the server defaults it from the
   * branch fee schedule (per-branch override, else catalog default) — closes
   * AC-ORG-002 / dental-org G2. An explicit value always wins.
   */
  priceCents?: int32;
  clinicalNotes?: string;

  /** P1-18: clinical sequencing phase */
  phase?: DentalTreatmentPhase;

  /** P1-18: intra-phase ordering (default 0) */
  @minValue(0)
  priority?: int32;

  /** GAP-001: optional client-generated id for offline-first idempotent sync */
  localId?: string;
}

model UpdateDentalTreatmentRequest {
  status?: DentalTreatmentStatus;
  dismissReason?: string;
  refusalReason?: string;
  toothNumber?: int32;
  surfaces?: ToothSurfaceCode[];
  cdtCode?: string;
  description?: string;
  conditionCode?: string;
  priceCents?: int32;
  clinicalNotes?: string;

  /** P1-18: re-phase a treatment item */
  phase?: DentalTreatmentPhase;

  /** P1-18: re-rank a treatment item within its phase */
  @minValue(0)
  priority?: int32;
}

model VisitNotes {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  visitId: UUID;
  authorMemberId: UUID;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  notes?: string;
  signed: boolean;
  signedAt?: utcDateTime;
  signedBy?: UUID;
  lockedAt?: utcDateTime;
}

model VisitNoteVersion {
  id: UUID;
  createdAt: utcDateTime;
  createdBy?: UUID;
  version: int32;
  noteId: UUID;
  snapshot: Record<unknown>;
}

model UpsertVisitNotesRequest {
  visitId: UUID;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  notes?: string;
}

model SignVisitNotesRequest {}

model CreateVisitNoteAddendumRequest {
  reason: string;
  content: string;
}

model ToothHistoryEntry {
  visitId: UUID;
  visitDate: utcDateTime;
  toothNumber: int32;
  state: ToothState;
  conditionCode?: string;
  treatmentCdtCode?: string;
  treatmentDescription?: string;
  // QA-003: surfaces / status / locked price of the tooth's treatment on the
  // visit, sourced from dental_treatments. Optional — a history row may have a
  // condition but no treatment.
  surfaces?: ToothSurfaceCode[];
  treatmentStatus?: DentalTreatmentStatus;
  treatmentPriceCents?: int32;
}

/** A single treatment item inside a treatment template (FR1.8). */
model TemplateTreatmentItem {
  cdtCode: string;
  description: string;
  priceCents: int32;
  toothNumber?: int32;
  surfaces?: string[];
}

model TreatmentTemplate {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  branchId: UUID;
  name: string;
  description?: string;
  /** Reusable treatment items applied to a visit in one action. */
  items: TemplateTreatmentItem[];
  active: boolean;
}

model CreateTreatmentTemplateRequest {
  name: string;
  branchId: UUID;
  description?: string;
  items: TemplateTreatmentItem[];
}

model UpdateTreatmentTemplateRequest {
  name?: string;
  description?: string;
  items?: TemplateTreatmentItem[];
  /** Activate/deactivate the template (handler accepts it; DELETE only sets false). */
  active?: boolean;
}

model ListTreatmentTemplatesResponse {
  templates: TreatmentTemplate[];
}

/** Real shape: the created treatment rows + their count (NOT { applied: int, visitId }). */
model ApplyTemplateResponse {
  applied: DentalTreatment[];
  count: int32;
}

model CarryOverTreatmentsRequest {
  /** Source visit to copy unperformed treatments from; auto-discovers recent prior visits when omitted. */
  sourceVisitId?: UUID;

  /** FR1.11: dismissed treatment ids to restore (as `planned`) into the current visit. */
  restoreDismissedIds?: UUID[];
}

/** Real shape: the carried + restored treatment rows + a human message (NOT { carried: int }). */
model CarryOverTreatmentsResponse {
  carriedOver: DentalTreatment[];
  restoredDismissed: DentalTreatment[];
  message: string;
}

/** One pending (diagnosed/planned/declined) treatment in the patient treatment-plan aggregate. */
model TreatmentPlanItem {
  id: UUID;
  toothNumber?: int32;
  cdtCode: string;
  description: string;
  surfaces?: ToothSurfaceCode[];
  priceCents: int32;
  status: DentalTreatmentStatus;
  conditionCode?: string;
  visitId: UUID;

  /** Optional: present on the flat `treatments[]` projection; the `byTooth`
   *  grouping omits it (and `toothNumber`), so it is optional on the shared item. */
  carriedOver?: boolean;
  phase?: DentalTreatmentPhase;
  priority: int32;
  reason?: string;
}

/** Patient treatment-plan aggregate across all visits (getTreatmentPlan). */
model TreatmentPlanResponse {
  patientId: UUID;
  version: int32;
  totalEstimateCents: int32;

  /** Count of pending treatments; omitted on the empty-plan response. */
  treatmentCount?: int32;
  toothCount: int32;

  /** Pending treatments grouped by FDI tooth number (and "general"); omitted on the empty-plan response. */
  byTooth?: Record<TreatmentPlanItem[]>;

  treatments: TreatmentPlanItem[];

  /** CHART-XV: FDI tooth numbers with a performed/verified treatment across ALL
   *  the patient's visits. Drives the odontogram's cumulative Completed layer
   *  (living document) rather than a per-visit completed view. */
  completedToothNumbers?: int32[];
}

model TreatmentPlanVersion {
  id: UUID;
  createdAt: utcDateTime;
  createdBy?: UUID;
  version: int32;
  patientId: UUID;
  snapshot: Record<unknown>;
}

model AcceptTreatmentPlanRequest {
  consentFormId?: UUID;
}

/** Per-tooth entry with entryClassification surfaced as `status` */
model PatientToothEntry {
  toothNumber: int32;
  state?: string;
  status?: string;
  entryClassification?: ChartEntryClassification;
  surfaces?: string[];
  conditionCode?: string;
}

/** Patient visit summary with embedded chart teeth (entryClassification → status) */
model PatientVisitRecord {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  patientId: UUID;
  branchId: UUID;
  status: DentalVisitStatus;
  chiefComplaint?: string;
  teeth?: PatientToothEntry[];
}

/** Patient-level condition / chart-entry record (status = entryClassification or treatment status) */
model PatientConditionEntry {
  id: string;
  visitId: UUID;
  toothNumber?: int32;
  status: string;
  surfaces?: string[];
  conditionCode?: string;
  state?: string;
  cdtCode?: string;
  description?: string;
  priceCents?: int32;
}

// ---------------------------------------------------------------------------
// API Interfaces
// ---------------------------------------------------------------------------

namespace DentalVisitModule {
  @doc("Body to discard (abandon) an open visit. Reason required (5–500 chars); audited.")
  model DiscardVisitRequest {
    @doc("Why the visit is being abandoned (e.g. 'patient left', 'created in error').")
    @minLength(5)
    @maxLength(500)
    reason: string;
  }

  interface DentalVisitManagement {
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("createDentalVisit")
    createVisit(
      @body body: CreateDentalVisitRequest
    ): ApiCreatedResponse<DentalVisit>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listDentalVisits")
    listVisits(
      @query patientId?: UUID,
      @query branchId?: UUID,
      @query status?: DentalVisitStatus,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<DentalVisit>>
      | ApiUnauthorizedResponse;

    @get
    @route("/{visitId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getDentalVisit")
    getVisit(
      @path visitId: UUID
    ): ApiOkResponse<DentalVisit>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @patch(#{implicitOptionality: true})
    @route("/{visitId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("updateDentalVisit")
    updateVisit(
      @path visitId: UUID,
      @body body: UpdateDentalVisitRequest
    ): ApiOkResponse<DentalVisit>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @post
    @route("/{visitId}/discard")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("discardVisit")
    discardVisit(
      @path visitId: UUID,
      @body body: DiscardVisitRequest
    ): ApiOkResponse<DentalVisit>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;
  }

  interface DentalChartManagement {
    @post
    @route("/{visitId}/chart")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("upsertDentalChart")
    upsertChart(
      @path visitId: UUID,
      @body body: CreateDentalChartRequest
    ): ApiCreatedResponse<DentalChart>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/{visitId}/chart")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getDentalChart")
    getChart(
      @path visitId: UUID
    ): ApiOkResponse<DentalChart>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @patch(#{implicitOptionality: true})
    @route("/{visitId}/chart/teeth/{toothNumber}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("updateTooth")
    updateTooth(
      @path visitId: UUID,
      @path toothNumber: int32,
      @body body: UpdateToothRequest
    ): ApiOkResponse<DentalChart>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @doc("P0-A: list open (unresolved) chart sync conflicts for a patient across visits.")
    @get
    @route("/chart-conflicts/{patientId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listChartConflicts")
    listChartConflicts(
      @path patientId: UUID
    ): ApiOkResponse<ChartConflict[]>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @doc("P0-A: resolve a visit chart's open sync conflict. 'accept' re-applies the rejected write with a NEW clock; 'dismiss' (reason required) discards it. Never mutates history.")
    @post
    @route("/{visitId}/chart/resolve-conflict")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("resolveChartConflict")
    resolveChartConflict(
      @path visitId: UUID,
      @body body: ResolveChartConflictRequest
    ): ApiOkResponse<DentalChart>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @doc("P0-B: structured (not screenshot) chart export for a visit — header (patient/provider/date), odontogram tooth/surface table with derived layers, legend, and proposed/completed/declined treatment summary.")
    @get
    @route("/{visitId}/chart/export")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("exportDentalChart")
    exportDentalChart(
      @path visitId: UUID
    ): ApiOkResponse<ChartExport>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;
  }

  interface DentalFindingManagement {
    @doc("P0-C: record a structured clinical finding (curated vocabulary) on a tooth/surface.")
    @post
    @route("/{visitId}/findings")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("createDentalFinding")
    createFinding(
      @path visitId: UUID,
      @body body: CreateFindingRequest
    ): ApiCreatedResponse<DentalFinding>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @doc("P0-C: list findings for a visit (active + resolved).")
    @get
    @route("/{visitId}/findings")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listDentalFindings")
    listFindings(
      @path visitId: UUID
    ): ApiOkResponse<PaginatedResponse<DentalFinding>>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @doc("P0-C: edit a finding or resolve it (status='resolved' → stops rendering as active).")
    @patch(#{implicitOptionality: true})
    @route("/{visitId}/findings/{findingId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("updateDentalFinding")
    updateFinding(
      @path visitId: UUID,
      @path findingId: UUID,
      @body body: UpdateFindingRequest
    ): ApiOkResponse<DentalFinding>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @doc("P0-C: convert a finding into a treatment (carries tooth/surface) and link them.")
    @post
    @route("/{visitId}/findings/{findingId}/treatment")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("convertFindingToTreatment")
    convertFindingToTreatment(
      @path visitId: UUID,
      @path findingId: UUID,
      @body body: ConvertFindingToTreatmentRequest
    ): ApiCreatedResponse<DentalTreatment>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;
  }

  interface DentalTreatmentManagement {
    @post
    @route("/{visitId}/treatments")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("createDentalTreatment")
    createTreatment(
      @path visitId: UUID,
      @body body: CreateDentalTreatmentRequest
    ): ApiCreatedResponse<DentalTreatment>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/{visitId}/treatments")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listDentalTreatments")
    listTreatments(
      @path visitId: UUID
    ): ApiOkResponse<PaginatedResponse<DentalTreatment>>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @patch(#{implicitOptionality: true})
    @route("/{visitId}/treatments/{treatmentId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("updateDentalTreatment")
    updateTreatment(
      @path visitId: UUID,
      @path treatmentId: UUID,
      @body body: UpdateDentalTreatmentRequest
    ): ApiOkResponse<DentalTreatment>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;
  }

  interface VisitNotesManagement {
    @post
    @route("/{visitId}/notes")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("upsertVisitNotes")
    upsertNotes(
      @path visitId: UUID,
      @body body: UpsertVisitNotesRequest
    ): ApiCreatedResponse<VisitNotes>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/{visitId}/notes")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getVisitNotes")
    getNotes(
      @path visitId: UUID
    ): ApiOkResponse<VisitNotes>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @post
    @route("/{visitId}/notes/sign")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("signVisitNotes")
    signNotes(
      @path visitId: UUID,
      @body body: SignVisitNotesRequest
    ): ApiOkResponse<VisitNotes>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @post
    @route("/{visitId}/notes/addendum")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("createVisitNoteAddendum")
    createAddendum(
      @path visitId: UUID,
      @body body: CreateVisitNoteAddendumRequest
    ): ApiCreatedResponse<VisitNoteVersion>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/{visitId}/notes/history")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getVisitNoteHistory")
    getNoteHistory(
      @path visitId: UUID
    ): ApiOkResponse<VisitNoteVersion[]>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;
  }

  interface ToothHistoryManagement {
    @get
    @route("/history/{patientId}/teeth/{toothNumber}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getToothHistory")
    getToothHistory(
      @path patientId: UUID,
      @path toothNumber: int32
    ): ApiOkResponse<PaginatedResponse<ToothHistoryEntry>>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;
  }

  interface TreatmentTemplateManagement {
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listTreatmentTemplates")
    listTreatmentTemplates(
      @query branchId: UUID
    ): ApiOkResponse<ListTreatmentTemplatesResponse>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("createTreatmentTemplate")
    createTreatmentTemplate(
      @body body: CreateTreatmentTemplateRequest
    ): ApiCreatedResponse<TreatmentTemplate>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @patch(#{implicitOptionality: true})
    @route("/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("updateTreatmentTemplate")
    updateTreatmentTemplate(
      @path id: UUID,
      @body body: UpdateTreatmentTemplateRequest
    ): ApiOkResponse<TreatmentTemplate>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @delete
    @route("/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("deleteTreatmentTemplate")
    deleteTreatmentTemplate(
      @path id: UUID
    ): ApiOkResponse<{}>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;
  }

  interface VisitTemplateActions {
    @post
    @route("/{visitId}/apply-template/{templateId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("applyTemplate")
    applyTemplate(
      @path visitId: UUID,
      @path templateId: UUID
    ): ApiCreatedResponse<ApplyTemplateResponse>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @post
    @route("/{visitId}/carry-over")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("carryOverTreatments")
    carryOverTreatments(
      @path visitId: UUID,
      @body body: CarryOverTreatmentsRequest
    ): ApiOkResponse<CarryOverTreatmentsResponse>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;
  }

  interface TreatmentPlanPresentation {
    @get
    @route("/{patientId}/treatment-plan")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getTreatmentPlan")
    getTreatmentPlan(
      @path patientId: UUID,

      @doc("Branch context — required by the handler (contract field; auth is via patient-branch access).")
      @query branchId: UUID
    ): ApiOkResponse<TreatmentPlanResponse>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @post
    @route("/{patientId}/treatment-plan/accept")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("acceptTreatmentPlan")
    acceptTreatmentPlan(
      @path patientId: UUID,

      @doc("Branch context — required by the handler (contract field; auth is via patient-branch access).")
      @query branchId: UUID,
      @body body: AcceptTreatmentPlanRequest
    ): ApiCreatedResponse<TreatmentPlanVersion>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/{patientId}/treatment-plan/versions/{versionId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getTreatmentPlanVersion")
    getTreatmentPlanVersion(
      @path patientId: UUID,
      @path versionId: UUID
    ): ApiOkResponse<TreatmentPlanVersion>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;
  }

  interface PatientRecordsView {
    @get
    @route("/{patientId}/visits")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listPatientVisits")
    listPatientVisits(
      @path patientId: UUID,
      @query branchId?: UUID
    ): ApiOkResponse<PaginatedResponse<PatientVisitRecord>>
      | ApiUnauthorizedResponse;

    @get
    @route("/{patientId}/treatments")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listPatientConditions")
    listPatientConditions(
      @path patientId: UUID,
      @query branchId?: UUID
    ): ApiOkResponse<PaginatedResponse<PatientConditionEntry>>
      | ApiUnauthorizedResponse;
  }
}
