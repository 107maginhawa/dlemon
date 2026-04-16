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

namespace Healthcare.Ancillary.Endodontic;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * Lifecycle status of an endodontic treatment record.
 */
enum EndoRecordStatus {
  /** Treatment record has been created but access cavity has not yet been opened. */
  initiated,
  /** Access cavity has been opened and pulp chamber accessed. */
  accessOpened,
  /** Root canals have been instrumented and shaped. */
  canalsShaped,
  /** Root canals have been filled with obturating material. */
  obturated,
  /** All endodontic treatment steps have been completed. */
  completed,
  /** Case has been forwarded to an endodontic specialist. */
  referredOut,
}

/**
 * Technique used to obturate a root canal.
 */
enum ObturationMethod {
  /** Multiple gutta-percha cones condensed laterally within the canal. */
  lateralCondensation,
  /** Gutta-percha condensed vertically using heat-softened technique. */
  warmVertical,
  /** A single pre-fitted gutta-percha cone placed to working length. */
  singleCone,
  /** Gutta-percha coated carrier inserted to working length. */
  carrierBased,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

/**
 * Detailed record for a single root canal within an endodontic treatment.
 */
model CanalRecord {
  /**
   * Anatomical name of the canal.
   * Common values: MB (mesio-buccal), DB (disto-buccal), P (palatal),
   * ML (mesio-lingual), DL (disto-lingual), MB2 (second mesio-buccal).
   */
  canalName: string;

  /** Established working length from a fixed reference point. */
  workingLength?: Quantity;

  /** Apex locator electronic reading at the apical terminus. */
  apexLocatorReading?: string;

  /** Whether the working length was confirmed radiographically. */
  radiographicConfirmation?: boolean;

  /** ISO size and taper of the master apical file used. */
  masterApicalFile?: string;

  /** Whether this canal has been obturated. */
  obturated?: boolean;

  /** Obturation technique applied to this canal. */
  obturationMethod?: ObturationMethod;

  /** Obturating material used (e.g. gutta-percha, MTA). */
  material?: string;

  /** Length of the obturating fill from reference point. */
  fillLength?: Quantity;
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

/**
 * A complete endodontic treatment record tracking all phases of root canal therapy.
 */
model EndoRecord extends HealthcareBaseEntity {
  /** Patient receiving the endodontic treatment. */
  patient: Reference;

  /** Clinical encounter associated with this treatment. */
  encounter?: Reference;

  /** Tooth receiving endodontic therapy. */
  toothNumber: int32;

  /** Provider performing the endodontic treatment. */
  provider: Reference;

  /** Current lifecycle status of the endodontic treatment. */
  status: EndoRecordStatus;

  /** Date treatment was initiated. */
  startDate: utcDateTime;

  /** Date all treatment steps were completed. */
  completionDate?: utcDateTime;

  /** Individual canal records for each root canal treated. */
  canals: CanalRecord[];

  /** Clinical annotations associated with this treatment record. */
  note?: Annotation[];
}

/**
 * A record of a specific irrigation step performed during endodontic treatment.
 */
model IrrigationRecord extends HealthcareBaseEntity {
  /** Endodontic record this irrigation step is part of. */
  endoRecord: Reference;

  /** Irrigant solution used (e.g. sodium hypochlorite, EDTA, chlorhexidine). */
  irrigant: CodeableConcept;

  /** Concentration of the irrigant solution. */
  concentration?: string;

  /** Volume of irrigant delivered. */
  volume?: Quantity;

  /** Irrigation technique used (e.g. passive ultrasonic, syringe). */
  technique?: string;

  /** Free-text note about the irrigation step. */
  note?: string;
}

/**
 * A record documenting an endodontic retreatment case linked to a prior treatment.
 */
model EndoRetreatment extends HealthcareBaseEntity {
  /** Original endodontic treatment record being retreated. */
  originalEndoRecord: Reference;

  /** Patient receiving the retreatment. */
  patient: Reference;

  /** Clinical reason necessitating retreatment (e.g. persistent infection, missed canal). */
  reason: string;

  /** Provider performing the retreatment. */
  provider: Reference;

  /** Date retreatment was initiated. */
  startDate: utcDateTime;
}

// ---------------------------------------------------------------------------
// Request / response wrappers
// ---------------------------------------------------------------------------

model EndoRecordCreateRequest {
  ...OmitProperties<EndoRecord, "id" | "meta" | "createdAt" | "updatedAt">;
}

model EndoRecordSearchParams {
  patientId?: string;
  providerId?: string;
  status?: EndoRecordStatus;
  toothNumber?: int32;
  dateFrom?: utcDateTime;
  dateTo?: utcDateTime;
  ...PaginationQuery;
}

model EndoStatusTransitionRequest {
  status: EndoRecordStatus;
  note?: string;
}

model IrrigationRecordCreateRequest {
  ...OmitProperties<IrrigationRecord, "id" | "meta" | "createdAt" | "updatedAt">;
}

model EndoRetreatmentCreateRequest {
  ...OmitProperties<EndoRetreatment, "id" | "meta" | "createdAt" | "updatedAt">;
}

model EndoRetreatmentSearchParams {
  patientId?: string;
  providerId?: string;
  originalEndoRecordId?: string;
  dateFrom?: utcDateTime;
  dateTo?: utcDateTime;
  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * CRUD, search, and status-transition operations for endodontic treatment records.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface EndoRecordManagement {
  /**
   * Create a new endodontic treatment record.
   * @param body Endodontic record creation payload.
   * @returns The newly created endodontic record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createEndoRecord")
  create(@body body: EndoRecordCreateRequest): {
    @statusCode statusCode: 201;
    @body record: EndoRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve an endodontic record by its unique identifier.
   * @param id The endodontic record identifier.
   * @returns The requested endodontic record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getEndoRecord")
  read(@path id: string): EndoRecord | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing endodontic record.
   * @param id The endodontic record identifier.
   * @param body Updated endodontic record payload.
   * @returns The updated endodontic record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateEndoRecord")
  update(@path id: string, @body body: EndoRecordCreateRequest): EndoRecord | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete an endodontic record.
   * @param id The endodontic record identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteEndoRecord")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search endodontic records by patient, provider, status, tooth number, or date range.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching endodontic records.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchEndoRecords")
  search(...EndoRecordSearchParams): PaginatedResponse<EndoRecord> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Transition the status of an endodontic record to the next treatment phase.
   * @param id The endodontic record identifier.
   * @param body Status transition payload with target status and optional clinical note.
   * @returns The updated endodontic record reflecting the new status.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("transitionEndoRecordStatus")
  @route("/{id}/status")
  transitionStatus(@path id: string, @body body: EndoStatusTransitionRequest): EndoRecord | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD operations for irrigation step records within an endodontic treatment.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface IrrigationManagement {
  /**
   * Create a new irrigation step record.
   * @param body Irrigation record creation payload.
   * @returns The newly created irrigation record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createIrrigationRecord")
  create(@body body: IrrigationRecordCreateRequest): {
    @statusCode statusCode: 201;
    @body record: IrrigationRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve an irrigation record by its unique identifier.
   * @param id The irrigation record identifier.
   * @returns The requested irrigation record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getIrrigationRecord")
  read(@path id: string): IrrigationRecord | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing irrigation record.
   * @param id The irrigation record identifier.
   * @param body Updated irrigation record payload.
   * @returns The updated irrigation record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateIrrigationRecord")
  update(@path id: string, @body body: IrrigationRecordCreateRequest): IrrigationRecord | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete an irrigation record.
   * @param id The irrigation record identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteIrrigationRecord")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD and search operations for endodontic retreatment cases.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface EndoRetreatmentManagement {
  /**
   * Create a new endodontic retreatment record.
   * @param body Endodontic retreatment creation payload.
   * @returns The newly created endodontic retreatment record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createEndoRetreatment")
  create(@body body: EndoRetreatmentCreateRequest): {
    @statusCode statusCode: 201;
    @body retreatment: EndoRetreatment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve an endodontic retreatment record by its unique identifier.
   * @param id The endodontic retreatment identifier.
   * @returns The requested endodontic retreatment record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getEndoRetreatment")
  read(@path id: string): EndoRetreatment | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing endodontic retreatment record.
   * @param id The endodontic retreatment identifier.
   * @param body Updated retreatment payload.
   * @returns The updated endodontic retreatment record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateEndoRetreatment")
  update(@path id: string, @body body: EndoRetreatmentCreateRequest): EndoRetreatment | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete an endodontic retreatment record.
   * @param id The endodontic retreatment identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteEndoRetreatment")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search endodontic retreatment records by patient, provider, original record, or date range.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching endodontic retreatment records.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchEndoRetreatments")
  search(...EndoRetreatmentSearchParams): PaginatedResponse<EndoRetreatment> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
