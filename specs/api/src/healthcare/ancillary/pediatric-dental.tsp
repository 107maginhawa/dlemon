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

namespace Healthcare.Ancillary.PediatricDental;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * Tooth numbering notation system used for primary and mixed dentition charting.
 */
enum ToothNotationSystem {
  /** FDI World Dental Federation two-digit notation (51–85 for primary teeth). */
  fdi,
  /** Universal Numbering System with letters A–T for primary teeth. */
  universal,
  /** Palmer Notation Method with primary-specific symbols. */
  palmer,
}

/**
 * Behavioural rating scale used during a paediatric dental assessment.
 */
enum BehaviorScale {
  /** Frankl Behavior Rating Scale (1–4). */
  frankl,
  /** American Academy of Pediatric Dentistry Behavior Rating Scale. */
  adpbrs,
}

/**
 * Method used to apply fluoride to tooth surfaces.
 */
enum FluorideMethod {
  /** Fluoride varnish painted onto tooth surfaces. */
  varnish,
  /** Fluoride gel applied via custom or stock tray. */
  tray,
  /** Fluoride mouth rinse swished and expectorated. */
  rinse,
  /** Fluoride foam applied via tray. */
  foam,
}

/**
 * Lifecycle status of a placed fissure sealant.
 */
enum SealantStatus {
  /** Sealant has just been placed. */
  placed,
  /** Sealant is present and fully intact on recall examination. */
  intact,
  /** Sealant was partially lost and has been repaired. */
  repaired,
  /** Sealant has been completely lost. */
  lost,
}

/**
 * Type of space maintainer appliance.
 */
enum SpaceMaintainerType {
  /** Unilateral fixed appliance with a band and a wire loop. */
  bandAndLoop,
  /** Appliance placed to guide eruption of the first permanent molar. */
  distalShoe,
  /** Mandibular bilateral space maintainer using a lingual arch wire. */
  lingual,
  /** Maxillary bilateral appliance using palatal acrylic button. */
  nance,
  /** Maxillary bilateral space maintainer using a transpalatal arch. */
  transpalatal,
}

/**
 * Lifecycle status of a space maintainer appliance.
 */
enum SpaceMaintainerStatus {
  /** Appliance has been placed at this appointment. */
  placed,
  /** Appliance is present and functioning. */
  active,
  /** Appliance has been removed (planned or unplanned). */
  removed,
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

/**
 * A record of a primary or permanent tooth eruption event.
 */
model EruptionRecord extends HealthcareBaseEntity {
  /** Paediatric patient for whom the eruption is recorded. */
  patient: Reference;

  /** Numeric identifier of the tooth that erupted. */
  toothNumber: int32;

  /** Tooth notation system used to identify the erupted tooth. */
  notation: ToothNotationSystem;

  /** Date the tooth was observed to have erupted into the oral cavity. */
  eruptionDate: plainDate;

  /** Clinician or caregiver who recorded the eruption event. */
  recordedBy: Reference;

  /** Free-text observations about the eruption. */
  notes?: string;
}

/**
 * A record of a primary tooth exfoliation (natural shedding) event.
 */
model ExfoliationRecord extends HealthcareBaseEntity {
  /** Paediatric patient for whom the exfoliation is recorded. */
  patient: Reference;

  /** Numeric identifier of the tooth that exfoliated. */
  toothNumber: int32;

  /** Tooth notation system used to identify the exfoliated tooth. */
  notation: ToothNotationSystem;

  /** Date the tooth exfoliated or was extracted due to natural shedding. */
  exfoliationDate: plainDate;

  /** Clinician or caregiver who recorded the exfoliation event. */
  recordedBy: Reference;
}

/**
 * A behavioural assessment of a paediatric patient during a dental visit.
 */
model BehaviorAssessment extends HealthcareBaseEntity {
  /** Paediatric patient being assessed. */
  patient: Reference;

  /** Clinical encounter during which the assessment was performed. */
  encounter: Reference;

  /** Behavioural rating scale used for assessment. */
  scale: BehaviorScale;

  /** Numerical score on the selected rating scale. */
  score: int32;

  /** Narrative description of the patient's behaviour during the visit. */
  description?: string;

  /** Clinician who performed the assessment. */
  assessedBy: Reference;

  /** Date and time the assessment was conducted. */
  assessedAt: utcDateTime;

  /** List of behaviour guidance techniques applied during the visit. */
  managementTechniques?: string[];
}

/**
 * A record of a topical fluoride application performed during a paediatric dental visit.
 */
model FluorideApplication extends HealthcareBaseEntity {
  /** Patient who received the fluoride application. */
  patient: Reference;

  /** Clinical encounter during which fluoride was applied. */
  encounter: Reference;

  /** Commercial product name of the fluoride agent used. */
  product: string;

  /** Fluoride concentration of the agent (e.g. 5%, 2.26%). */
  concentration?: string;

  /** Application method used to deliver the fluoride. */
  method: FluorideMethod;

  /** Clinician who performed the application. */
  performedBy: Reference;

  /** Date and time the fluoride was applied. */
  performedAt: utcDateTime;

  /** Free-text note about patient tolerance, instructions, or product details. */
  note?: string;
}

/**
 * A record of a fissure sealant placed on a tooth surface.
 */
model SealantRecord extends HealthcareBaseEntity {
  /** Patient who received the sealant. */
  patient: Reference;

  /** Clinical encounter during which the sealant was placed. */
  encounter: Reference;

  /** Tooth on which the sealant was placed. */
  toothNumber: int32;

  /** Tooth surface(s) covered by the sealant (e.g. occlusal, buccal pit). */
  surface: string;

  /** Current clinical status of the sealant. */
  status: SealantStatus;

  /** Date the sealant was originally placed. */
  placedDate: utcDateTime;

  /** Clinician who placed the sealant. */
  placedBy: Reference;

  /** Sealant material used (e.g. resin-based, glass ionomer). */
  material?: string;
}

/**
 * A space maintainer appliance fitted to preserve arch space after early tooth loss.
 */
model SpaceMaintainer extends HealthcareBaseEntity {
  /** Patient for whom the space maintainer was placed. */
  patient: Reference;

  /** Clinical encounter during which the space maintainer was placed. */
  encounter?: Reference;

  /** Type of space maintainer appliance. */
  type: SpaceMaintainerType;

  /** Tooth number of the prematurely lost primary tooth the appliance is maintaining space for. */
  extractedTooth: int32;

  /** Current status of the space maintainer. */
  status: SpaceMaintainerStatus;

  /** Date the appliance was placed. */
  placedDate: utcDateTime;

  /** Clinician who placed the appliance. */
  placedBy: Reference;

  /** Date the appliance was removed. */
  removedDate?: utcDateTime;
}

// ---------------------------------------------------------------------------
// Request / response wrappers
// ---------------------------------------------------------------------------

model EruptionRecordCreateRequest {
  ...OmitProperties<EruptionRecord, "id" | "meta" | "createdAt" | "updatedAt">;
}

model ExfoliationRecordCreateRequest {
  ...OmitProperties<ExfoliationRecord, "id" | "meta" | "createdAt" | "updatedAt">;
}

model BehaviorAssessmentCreateRequest {
  ...OmitProperties<BehaviorAssessment, "id" | "meta" | "createdAt" | "updatedAt">;
}

model BehaviorAssessmentSearchParams {
  patientId?: string;
  encounterId?: string;
  scale?: BehaviorScale;
  dateFrom?: utcDateTime;
  dateTo?: utcDateTime;
  ...PaginationQuery;
}

model FluorideApplicationCreateRequest {
  ...OmitProperties<FluorideApplication, "id" | "meta" | "createdAt" | "updatedAt">;
}

model FluorideApplicationSearchParams {
  patientId?: string;
  encounterId?: string;
  method?: FluorideMethod;
  dateFrom?: utcDateTime;
  dateTo?: utcDateTime;
  ...PaginationQuery;
}

model SealantRecordCreateRequest {
  ...OmitProperties<SealantRecord, "id" | "meta" | "createdAt" | "updatedAt">;
}

model SealantSearchParams {
  patientId?: string;
  toothNumber?: int32;
  status?: SealantStatus;
  dateFrom?: utcDateTime;
  dateTo?: utcDateTime;
  ...PaginationQuery;
}

model SpaceMaintainerCreateRequest {
  ...OmitProperties<SpaceMaintainer, "id" | "meta" | "createdAt" | "updatedAt">;
}

model SpaceMaintainerSearchParams {
  patientId?: string;
  type?: SpaceMaintainerType;
  status?: SpaceMaintainerStatus;
  extractedTooth?: int32;
  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * CRUD operations for tooth eruption event records.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface EruptionManagement {
  /**
   * Create a new tooth eruption record.
   * @param body Eruption record creation payload.
   * @returns The newly created eruption record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createEruptionRecord")
  create(@body body: EruptionRecordCreateRequest): {
    @statusCode statusCode: 201;
    @body record: EruptionRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve an eruption record by its unique identifier.
   * @param id The eruption record identifier.
   * @returns The requested eruption record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getEruptionRecord")
  read(@path id: string): EruptionRecord | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing eruption record.
   * @param id The eruption record identifier.
   * @param body Updated eruption record payload.
   * @returns The updated eruption record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateEruptionRecord")
  update(@path id: string, @body body: EruptionRecordCreateRequest): EruptionRecord | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete an eruption record.
   * @param id The eruption record identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteEruptionRecord")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD operations for tooth exfoliation event records.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface ExfoliationManagement {
  /**
   * Create a new tooth exfoliation record.
   * @param body Exfoliation record creation payload.
   * @returns The newly created exfoliation record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createExfoliationRecord")
  create(@body body: ExfoliationRecordCreateRequest): {
    @statusCode statusCode: 201;
    @body record: ExfoliationRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve an exfoliation record by its unique identifier.
   * @param id The exfoliation record identifier.
   * @returns The requested exfoliation record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getExfoliationRecord")
  read(@path id: string): ExfoliationRecord | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing exfoliation record.
   * @param id The exfoliation record identifier.
   * @param body Updated exfoliation record payload.
   * @returns The updated exfoliation record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateExfoliationRecord")
  update(@path id: string, @body body: ExfoliationRecordCreateRequest): ExfoliationRecord | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete an exfoliation record.
   * @param id The exfoliation record identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteExfoliationRecord")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD and search operations for paediatric behaviour assessments.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface BehaviorAssessmentManagement {
  /**
   * Create a new behaviour assessment record.
   * @param body Behaviour assessment creation payload.
   * @returns The newly created behaviour assessment.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createBehaviorAssessment")
  create(@body body: BehaviorAssessmentCreateRequest): {
    @statusCode statusCode: 201;
    @body assessment: BehaviorAssessment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a behaviour assessment by its unique identifier.
   * @param id The behaviour assessment identifier.
   * @returns The requested behaviour assessment.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getBehaviorAssessment")
  read(@path id: string): BehaviorAssessment | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing behaviour assessment record.
   * @param id The behaviour assessment identifier.
   * @param body Updated behaviour assessment payload.
   * @returns The updated behaviour assessment.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateBehaviorAssessment")
  update(@path id: string, @body body: BehaviorAssessmentCreateRequest): BehaviorAssessment | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a behaviour assessment record.
   * @param id The behaviour assessment identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteBehaviorAssessment")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search behaviour assessments by patient, encounter, scale, or date range.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching behaviour assessments.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchBehaviorAssessments")
  search(...BehaviorAssessmentSearchParams): PaginatedResponse<BehaviorAssessment> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD and search operations for topical fluoride application records.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface FluorideApplicationManagement {
  /**
   * Create a new fluoride application record.
   * @param body Fluoride application creation payload.
   * @returns The newly created fluoride application record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createFluorideApplication")
  create(@body body: FluorideApplicationCreateRequest): {
    @statusCode statusCode: 201;
    @body application: FluorideApplication;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a fluoride application record by its unique identifier.
   * @param id The fluoride application identifier.
   * @returns The requested fluoride application record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getFluorideApplication")
  read(@path id: string): FluorideApplication | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing fluoride application record.
   * @param id The fluoride application identifier.
   * @param body Updated fluoride application payload.
   * @returns The updated fluoride application record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateFluorideApplication")
  update(@path id: string, @body body: FluorideApplicationCreateRequest): FluorideApplication | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a fluoride application record.
   * @param id The fluoride application identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteFluorideApplication")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search fluoride application records by patient, encounter, method, or date range.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching fluoride application records.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchFluorideApplications")
  search(...FluorideApplicationSearchParams): PaginatedResponse<FluorideApplication> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD and search operations for fissure sealant records.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface SealantManagement {
  /**
   * Create a new fissure sealant record.
   * @param body Sealant record creation payload.
   * @returns The newly created sealant record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createSealantRecord")
  create(@body body: SealantRecordCreateRequest): {
    @statusCode statusCode: 201;
    @body record: SealantRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a sealant record by its unique identifier.
   * @param id The sealant record identifier.
   * @returns The requested sealant record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getSealantRecord")
  read(@path id: string): SealantRecord | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing sealant record.
   * @param id The sealant record identifier.
   * @param body Updated sealant record payload.
   * @returns The updated sealant record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateSealantRecord")
  update(@path id: string, @body body: SealantRecordCreateRequest): SealantRecord | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a sealant record.
   * @param id The sealant record identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteSealantRecord")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search sealant records by patient, tooth number, status, or date range.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching sealant records.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchSealantRecords")
  search(...SealantSearchParams): PaginatedResponse<SealantRecord> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD and search operations for space maintainer appliance records.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface SpaceMaintainerManagement {
  /**
   * Create a new space maintainer record.
   * @param body Space maintainer creation payload.
   * @returns The newly created space maintainer record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createSpaceMaintainer")
  create(@body body: SpaceMaintainerCreateRequest): {
    @statusCode statusCode: 201;
    @body maintainer: SpaceMaintainer;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a space maintainer record by its unique identifier.
   * @param id The space maintainer identifier.
   * @returns The requested space maintainer record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getSpaceMaintainer")
  read(@path id: string): SpaceMaintainer | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing space maintainer record.
   * @param id The space maintainer identifier.
   * @param body Updated space maintainer payload.
   * @returns The updated space maintainer record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateSpaceMaintainer")
  update(@path id: string, @body body: SpaceMaintainerCreateRequest): SpaceMaintainer | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a space maintainer record.
   * @param id The space maintainer identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteSpaceMaintainer")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search space maintainer records by patient, type, status, or extracted tooth.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching space maintainer records.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchSpaceMaintainers")
  search(...SpaceMaintainerSearchParams): PaginatedResponse<SpaceMaintainer> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
