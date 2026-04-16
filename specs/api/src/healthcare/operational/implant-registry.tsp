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

namespace Healthcare.Operational.ImplantRegistry;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * Lifecycle status of a dental implant fixture from placement through to explantation.
 */
enum ImplantStatus {
  /** Fixture has been surgically placed but osseointegration has not yet been verified. */
  placed,
  /** Fixture is undergoing the osseointegration healing period. */
  osseointegrating,
  /** Fixture has been fully osseointegrated and a prosthetic restoration has been delivered. */
  restored,
  /** Fixture has failed to osseointegrate or has been lost after loading. */
  failed,
  /** Fixture has been surgically removed. */
  explanted,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

/**
 * Manufacturer and dimensional data for an implant fixture.
 */
model ImplantFixture {
  /** Name of the implant manufacturer. */
  manufacturer: string;

  /** Commercial implant system name (e.g. Straumann BLT, Nobel Replace CC). */
  system: string;

  /** Lot number used for traceability and recall management. */
  lotNumber: string;

  /** Outer diameter of the fixture body. */
  diameter: Quantity;

  /** Total length of the fixture. */
  length: Quantity;

  /** Platform connection size or type (e.g. regular, narrow, wide). */
  platform?: string;

  /** Surface treatment or coating applied to the fixture (e.g. SLA, TiUnite). */
  surface?: string;

  /** Insertion torque recorded at the time of placement. */
  torqueAtPlacement?: Quantity;
}

/**
 * Abutment component connecting the fixture to the prosthetic restoration.
 */
model ImplantAbutment {
  /** Manufacturer of the abutment component. */
  manufacturer?: string;

  /** Abutment type or commercial name (e.g. straight, angled, custom CAD/CAM). */
  type: string;

  /** Material of the abutment (e.g. titanium, zirconia). */
  material?: string;

  /** Gingival height of the abutment component. */
  height?: Quantity;

  /** Angulation in degrees for non-straight abutments. */
  angulation?: int32;
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

/**
 * A dental implant record tracking a single fixture from placement through restoration or failure.
 */
model Implant extends HealthcareBaseEntity {
  /** Patient who received the implant. */
  patient: Reference;

  /** Tooth position at which the implant was placed. */
  toothNumber: int32;

  /** Detailed fixture data including manufacturer, dimensions, and lot number. */
  fixture: ImplantFixture;

  /** Abutment component attached to the fixture. */
  abutment?: ImplantAbutment;

  /** Current lifecycle status of the implant. */
  status: ImplantStatus;

  /** Date and time the fixture was surgically placed. */
  placedDate: utcDateTime;

  /** Surgeon who placed the implant fixture. */
  placedBy: Reference;

  /** Date and time the prosthetic restoration was delivered. */
  restoredDate?: utcDateTime;

  /** Date and time the implant was declared failed. */
  failedDate?: utcDateTime;

  /** Clinical annotations about the implant. */
  note?: Annotation[];
}

/**
 * A stability check performed on an osseointegrating implant.
 */
model OsseointegrationCheck extends HealthcareBaseEntity {
  /** Implant being evaluated for osseointegration stability. */
  implant: Reference;

  /** Date and time the stability check was performed. */
  checkDate: utcDateTime;

  /** Clinician who performed the stability check. */
  performer: Reference;

  /** Resonance frequency analysis (RFA) or ISQ value recorded. */
  stabilityValue?: float64;

  /** Method used to assess stability (e.g. RFA/Osstell, percussion, torque reversal). */
  method?: string;

  /** Reference to a radiograph taken at this check. */
  xrayReference?: Reference;

  /** Narrative outcome of the stability check (e.g. adequate integration, re-check required). */
  outcome: string;

  /** Date by which the next stability check should be performed. */
  nextCheckDate?: plainDate;
}

/**
 * A safety recall notice affecting one or more implant lots.
 */
model ImplantRecall extends HealthcareBaseEntity {
  /** Implant record that triggered this recall entry. */
  implant: Reference;

  /** Lot number of the recalled fixture. */
  lotNumber: string;

  /** Manufacturer issuing the recall notice. */
  manufacturer: string;

  /** Clinical or quality reason for the recall. */
  reason: string;

  /** Date the recall was issued by the manufacturer or regulatory body. */
  recallDate: utcDateTime;

  /** Approximate number of patients potentially affected by this recall. */
  affectedPatients?: int32;
}

// ---------------------------------------------------------------------------
// Request / response wrappers
// ---------------------------------------------------------------------------

model ImplantCreateRequest {
  ...OmitProperties<Implant, "id" | "meta" | "createdAt" | "updatedAt">;
}

model ImplantSearchParams {
  patientId?: string;
  placedById?: string;
  status?: ImplantStatus;
  toothNumber?: int32;
  manufacturer?: string;
  dateFrom?: utcDateTime;
  dateTo?: utcDateTime;
  ...PaginationQuery;
}

model ImplantLotNumberParams {
  lotNumber: string;
  manufacturer?: string;
  ...PaginationQuery;
}

model OsseointegrationCheckCreateRequest {
  ...OmitProperties<OsseointegrationCheck, "id" | "meta" | "createdAt" | "updatedAt">;
}

model OsseointegrationCheckSearchParams {
  implantId?: string;
  performerId?: string;
  dateFrom?: utcDateTime;
  dateTo?: utcDateTime;
  ...PaginationQuery;
}

model ImplantRecallCreateRequest {
  ...OmitProperties<ImplantRecall, "id" | "meta" | "createdAt" | "updatedAt">;
}

model ImplantRecallSearchParams {
  lotNumber?: string;
  manufacturer?: string;
  dateFrom?: utcDateTime;
  dateTo?: utcDateTime;
  ...PaginationQuery;
}

model AffectedPatientsParams {
  recallId: string;
  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * CRUD, search, and lot-number lookup operations for dental implant records.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Operational")
interface ImplantManagement {
  /**
   * Register a new dental implant in the registry.
   * @param body Implant creation payload with fixture data.
   * @returns The newly created implant record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createImplant")
  create(@body body: ImplantCreateRequest): {
    @statusCode statusCode: 201;
    @body implant: Implant;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a dental implant record by its unique identifier.
   * @param id The implant identifier.
   * @returns The requested implant record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getImplant")
  read(@path id: string): Implant | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing dental implant record.
   * @param id The implant identifier.
   * @param body Updated implant payload.
   * @returns The updated implant record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateImplant")
  update(@path id: string, @body body: ImplantCreateRequest): Implant | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a dental implant record from the registry.
   * @param id The implant identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteImplant")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search implant records by patient, surgeon, status, tooth position, manufacturer, or date range.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching implant records.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchImplants")
  search(...ImplantSearchParams): PaginatedResponse<Implant> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve all implant records matching a specific fixture lot number for traceability purposes.
   * @param params Lot number and optional manufacturer filter with pagination.
   * @returns A paginated list of implants sharing the specified lot number.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getImplantsByLotNumber")
  @route("/by-lot")
  getByLotNumber(...ImplantLotNumberParams): PaginatedResponse<Implant> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD and search operations for implant osseointegration stability checks.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Operational")
interface OsseointegrationCheckManagement {
  /**
   * Record a new osseointegration stability check for an implant.
   * @param body Osseointegration check creation payload.
   * @returns The newly created osseointegration check record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createOsseointegrationCheck")
  create(@body body: OsseointegrationCheckCreateRequest): {
    @statusCode statusCode: 201;
    @body check: OsseointegrationCheck;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve an osseointegration check by its unique identifier.
   * @param id The osseointegration check identifier.
   * @returns The requested osseointegration check record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getOsseointegrationCheck")
  read(@path id: string): OsseointegrationCheck | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing osseointegration check record.
   * @param id The osseointegration check identifier.
   * @param body Updated osseointegration check payload.
   * @returns The updated osseointegration check record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateOsseointegrationCheck")
  update(@path id: string, @body body: OsseointegrationCheckCreateRequest): OsseointegrationCheck | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete an osseointegration check record.
   * @param id The osseointegration check identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteOsseointegrationCheck")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search osseointegration check records by implant, performer, or date range.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching osseointegration check records.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchOsseointegrationChecks")
  search(...OsseointegrationCheckSearchParams): PaginatedResponse<OsseointegrationCheck> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * Create, search, and affected-patient lookup operations for implant recall notices.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Operational")
interface ImplantRecallService {
  /**
   * Create a new implant recall notice.
   * @param body Implant recall creation payload.
   * @returns The newly created implant recall record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createImplantRecall")
  create(@body body: ImplantRecallCreateRequest): {
    @statusCode statusCode: 201;
    @body recall: ImplantRecall;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search implant recall notices by lot number, manufacturer, or recall date range.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching implant recall records.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchImplantRecalls")
  search(...ImplantRecallSearchParams): PaginatedResponse<ImplantRecall> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve all patients whose implants are within the scope of a specific recall.
   * @param params Recall identifier with pagination parameters.
   * @returns A paginated list of implant records for patients affected by the recall.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getImplantRecallAffectedPatients")
  @route("/affected-patients")
  getAffectedPatients(...AffectedPatientsParams): PaginatedResponse<Implant> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
