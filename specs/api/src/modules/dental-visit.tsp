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

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

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
}

model UpdateToothRequest {
  toothNumber: int32;
  state: ToothState;
  surfaces?: ToothSurfaceCode[];
  conditionCode?: string;
  note?: string;
}

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
  /** Price in cents, locked at recording time (EC4) */
  priceCents: int64;
  carriedOver: boolean;
  sourceVisitId?: UUID;
  autoDismissed?: boolean;
}

model CreateDentalTreatmentRequest {
  visitId: UUID;
  patientId: UUID;
  toothNumber?: int32;
  surfaces?: ToothSurfaceCode[];
  cdtCode: string;
  description: string;
  conditionCode?: string;
  priceCents: int64;
}

model UpdateDentalTreatmentRequest {
  status?: DentalTreatmentStatus;
  dismissReason?: string;
  toothNumber?: int32;
  surfaces?: ToothSurfaceCode[];
  cdtCode?: string;
  description?: string;
  conditionCode?: string;
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
}

model UpsertVisitNotesRequest {
  visitId: UUID;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  notes?: string;
}

model ToothHistoryEntry {
  visitId: UUID;
  visitDate: utcDateTime;
  toothNumber: int32;
  state: ToothState;
  conditionCode?: string;
  treatmentCdtCode?: string;
  treatmentDescription?: string;
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
}
