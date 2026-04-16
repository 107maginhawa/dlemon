import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../common/models.tsp";
import "../../common/errors.tsp";
import "../../common/pagination.tsp";
import "../../common/security.tsp";
import "../core/primitives.tsp";
import "../core/terminology.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

namespace Healthcare.Ancillary.Orthodontic;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * Lifecycle status of an orthodontic case.
 */
enum OrthoCaseStatus {
  /** Initial assessment phase before active treatment begins. */
  assessment,
  /** Patient is undergoing active orthodontic treatment. */
  activeTreatment,
  /** Patient has completed active treatment and is in the retention phase. */
  retention,
  /** Treatment has been fully completed including retention. */
  completed,
  /** Treatment was discontinued prior to completion. */
  discontinued,
}

/**
 * Type of orthodontic appliance used in a treatment stage.
 */
enum ApplianceType {
  /** Traditional fixed metal or ceramic brackets and wires. */
  fixedBraces,
  /** Removable thermoplastic aligner trays. */
  clearAligners,
  /** Removable or fixed appliance that modifies jaw growth. */
  functionalAppliance,
  /** Post-treatment retainer to maintain tooth positions. */
  retainer,
  /** Any appliance type not covered by the defined values. */
  other,
}

/**
 * Lifecycle status of a single aligner tray.
 */
enum TrayStatus {
  /** Tray has not yet been started by the patient. */
  pending,
  /** Tray is currently being worn. */
  active,
  /** Tray wear period has concluded. */
  completed,
  /** Tray was intentionally bypassed by clinical decision. */
  skipped,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

/**
 * An individual aligner tray within a clear-aligner series.
 */
model AlignerTray {
  /** Sequential position of this tray within the series. */
  trayNumber: int32;

  /** Current wear status of this tray. */
  status: TrayStatus;

  /** Date the patient began wearing this tray. */
  startDate?: utcDateTime;

  /** Date the patient stopped wearing this tray. */
  endDate?: utcDateTime;

  /** Prescribed number of hours per day the tray should be worn. */
  wearHoursPerDay?: int32;

  /** Clinical notes associated with this tray. */
  notes?: string;
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

/**
 * An orthodontic case representing the full scope of treatment for a patient.
 */
model OrthoCase extends HealthcareBaseEntity {
  /** Patient who is the subject of the orthodontic case. */
  patient: Reference;

  /** Orthodontist responsible for the case. */
  provider: Reference;

  /** Current phase of the orthodontic case. */
  status: OrthoCaseStatus;

  /** Date active treatment or assessment began. */
  startDate: utcDateTime;

  /** Projected date of treatment completion. */
  estimatedEndDate?: utcDateTime;

  /** Actual date the case was concluded. */
  actualEndDate?: utcDateTime;

  /** Coded orthodontic diagnosis (e.g. Class II malocclusion). */
  diagnosis?: CodeableConcept;

  /** Enumerated goals established at the start of treatment. */
  treatmentObjectives?: string[];

  /** Clinical annotations about the case. */
  note?: Annotation[];
}

/**
 * A discrete phase or stage within an orthodontic case.
 */
model OrthoStage extends HealthcareBaseEntity {
  /** Parent orthodontic case to which this stage belongs. */
  orthoCase: Reference;

  /** Human-readable name of the stage (e.g. "Alignment Phase"). */
  name: string;

  /** Ordered position of this stage within the case. */
  sequence: int32;

  /** Date the stage commenced. */
  startDate?: utcDateTime;

  /** Date the stage concluded. */
  endDate?: utcDateTime;

  /** Narrative description of clinical goals for this stage. */
  description?: string;

  /** Type of appliance used during this stage. */
  applianceType?: ApplianceType;
}

/**
 * A numbered series of clear-aligner trays for an orthodontic case.
 */
model AlignerSeries extends HealthcareBaseEntity {
  /** Orthodontic case this aligner series belongs to. */
  orthoCase: Reference;

  /** Total number of trays prescribed in the series. */
  totalTrays: int32;

  /** One-based index of the tray currently in use. */
  currentTray: int32;

  /** Ordered list of individual trays comprising the series. */
  trays: AlignerTray[];
}

/**
 * A progress appointment record capturing clinical findings and adjustments.
 */
model OrthoProgressRecord extends HealthcareBaseEntity {
  /** Orthodontic case this progress record relates to. */
  orthoCase: Reference;

  /** Clinical encounter associated with this progress visit. */
  encounter?: Reference;

  /** Date of the progress appointment. */
  date: utcDateTime;

  /** Provider who conducted the appointment. */
  provider: Reference;

  /** Narrative description of clinical findings at this visit. */
  findings: string;

  /** References to intraoral or extraoral photographs taken at this visit. */
  photosReference?: Reference[];

  /** Description of any appliance adjustments made at this visit. */
  adjustmentsMade?: string;

  /** Plan and instructions for the next scheduled visit. */
  nextVisitPlan?: string;
}

// ---------------------------------------------------------------------------
// Request / response wrappers
// ---------------------------------------------------------------------------

model OrthoCaseCreateRequest {
  ...OmitProperties<OrthoCase, "id" | "meta" | "createdAt" | "updatedAt">;
}

model OrthoCaseSearchParams {
  patientId?: string;
  providerId?: string;
  status?: OrthoCaseStatus;
  dateFrom?: utcDateTime;
  dateTo?: utcDateTime;
  ...PaginationQuery;
}

model OrthoCaseStatusTransitionRequest {
  status: OrthoCaseStatus;
  reason?: string;
}

model OrthoStageCreateRequest {
  ...OmitProperties<OrthoStage, "id" | "meta" | "createdAt" | "updatedAt">;
}

model AlignerSeriesCreateRequest {
  ...OmitProperties<AlignerSeries, "id" | "meta" | "createdAt" | "updatedAt">;
}

model AdvanceTrayRequest {
  notes?: string;
}

model OrthoProgressRecordCreateRequest {
  ...OmitProperties<OrthoProgressRecord, "id" | "meta" | "createdAt" | "updatedAt">;
}

model OrthoProgressSearchParams {
  orthoCaseId?: string;
  providerId?: string;
  dateFrom?: utcDateTime;
  dateTo?: utcDateTime;
  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * CRUD, search, and status-transition operations for orthodontic cases.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface OrthoCaseManagement {
  /**
   * Create a new orthodontic case.
   * @param body Orthodontic case creation payload.
   * @returns The newly created orthodontic case.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createOrthoCase")
  create(@body body: OrthoCaseCreateRequest): {
    @statusCode statusCode: 201;
    @body orthoCase: OrthoCase;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve an orthodontic case by its unique identifier.
   * @param id The orthodontic case identifier.
   * @returns The requested orthodontic case.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getOrthoCase")
  read(@path id: string): OrthoCase | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing orthodontic case.
   * @param id The orthodontic case identifier.
   * @param body Updated case payload.
   * @returns The updated orthodontic case.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateOrthoCase")
  update(@path id: string, @body body: OrthoCaseCreateRequest): OrthoCase | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete an orthodontic case.
   * @param id The orthodontic case identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteOrthoCase")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search orthodontic cases by patient, provider, status, or date range.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching orthodontic cases.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchOrthoCases")
  search(...OrthoCaseSearchParams): PaginatedResponse<OrthoCase> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Transition the status of an orthodontic case.
   * @param id The orthodontic case identifier.
   * @param body Status transition payload including the target status.
   * @returns The updated orthodontic case with new status.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("transitionOrthoCaseStatus")
  @route("/{id}/status")
  transitionStatus(@path id: string, @body body: OrthoCaseStatusTransitionRequest): OrthoCase | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD operations for orthodontic treatment stages.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface OrthoStageManagement {
  /**
   * Create a new orthodontic treatment stage.
   * @param body Orthodontic stage creation payload.
   * @returns The newly created orthodontic stage.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createOrthoStage")
  create(@body body: OrthoStageCreateRequest): {
    @statusCode statusCode: 201;
    @body stage: OrthoStage;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve an orthodontic stage by its unique identifier.
   * @param id The orthodontic stage identifier.
   * @returns The requested orthodontic stage.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getOrthoStage")
  read(@path id: string): OrthoStage | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing orthodontic stage.
   * @param id The orthodontic stage identifier.
   * @param body Updated stage payload.
   * @returns The updated orthodontic stage.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateOrthoStage")
  update(@path id: string, @body body: OrthoStageCreateRequest): OrthoStage | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete an orthodontic stage.
   * @param id The orthodontic stage identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteOrthoStage")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD and tray-advancement operations for clear-aligner series.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface AlignerSeriesManagement {
  /**
   * Create a new aligner series for an orthodontic case.
   * @param body Aligner series creation payload.
   * @returns The newly created aligner series.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createAlignerSeries")
  create(@body body: AlignerSeriesCreateRequest): {
    @statusCode statusCode: 201;
    @body series: AlignerSeries;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve an aligner series by its unique identifier.
   * @param id The aligner series identifier.
   * @returns The requested aligner series.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getAlignerSeries")
  read(@path id: string): AlignerSeries | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing aligner series.
   * @param id The aligner series identifier.
   * @param body Updated aligner series payload.
   * @returns The updated aligner series.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateAlignerSeries")
  update(@path id: string, @body body: AlignerSeriesCreateRequest): AlignerSeries | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete an aligner series record.
   * @param id The aligner series identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteAlignerSeries")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Advance the current tray index to the next tray in the series.
   * @param id The aligner series identifier.
   * @param body Optional notes for the tray advancement.
   * @returns The updated aligner series with incremented currentTray.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("advanceAlignerTray")
  @route("/{id}/advance-tray")
  advanceTray(@path id: string, @body body: AdvanceTrayRequest): AlignerSeries | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD operations for orthodontic progress appointment records.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface OrthoProgressManagement {
  /**
   * Create a new orthodontic progress record.
   * @param body Orthodontic progress record creation payload.
   * @returns The newly created orthodontic progress record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createOrthoProgressRecord")
  create(@body body: OrthoProgressRecordCreateRequest): {
    @statusCode statusCode: 201;
    @body record: OrthoProgressRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve an orthodontic progress record by its unique identifier.
   * @param id The orthodontic progress record identifier.
   * @returns The requested orthodontic progress record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getOrthoProgressRecord")
  read(@path id: string): OrthoProgressRecord | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing orthodontic progress record.
   * @param id The orthodontic progress record identifier.
   * @param body Updated orthodontic progress record payload.
   * @returns The updated orthodontic progress record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateOrthoProgressRecord")
  update(@path id: string, @body body: OrthoProgressRecordCreateRequest): OrthoProgressRecord | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete an orthodontic progress record.
   * @param id The orthodontic progress record identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteOrthoProgressRecord")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
