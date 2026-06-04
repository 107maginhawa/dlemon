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
}

model DentalChart {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  visitId: UUID;
  patientId: UUID;
  teeth: ToothChartState[];
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
  priceCents: int32;
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

model TreatmentTemplate {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  name: string;
  description?: string;
  treatments: string;
}

model CreateTreatmentTemplateRequest {
  name: string;
  description?: string;
  treatments: string;
}

model UpdateTreatmentTemplateRequest {
  name?: string;
  description?: string;
  treatments?: string;
}

model ApplyTemplateResponse {
  applied: int32;
  visitId: UUID;
}

model CarryOverTreatmentsRequest {
  sourceVisitId?: UUID;
}

model CarryOverTreatmentsResponse {
  carried: int32;
}

model TreatmentPlanResponse {
  patientId: UUID;
  visits: string;
  treatments: string;
  acceptedPlanVersionId?: UUID;
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
    listTreatmentTemplates(): ApiOkResponse<TreatmentTemplate[]>
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
    ): ApiOkResponse<ApplyTemplateResponse>
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
      @path patientId: UUID
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
