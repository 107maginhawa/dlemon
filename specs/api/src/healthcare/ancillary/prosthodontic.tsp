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

namespace Healthcare.Ancillary.Prosthodontic;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * Category of prosthetic restoration being fabricated or delivered.
 */
enum ProsthoType {
  /** Single-unit tooth-supported crown. */
  crown,
  /** Multi-unit fixed partial denture spanning one or more edentulous spaces. */
  bridge,
  /** Complete removable denture replacing an entire arch. */
  denture,
  /** Removable partial denture replacing some but not all teeth. */
  partialDenture,
  /** Thin porcelain or composite facing bonded to the labial surface. */
  veneer,
  /** Intracoronal restoration fabricated outside the mouth. */
  inlay,
  /** Extracoronal restoration covering one or more cusps. */
  onlay,
  /** Crown or bridge retained by an osseointegrated implant. */
  implantSupported,
}

/**
 * Lifecycle status of a prosthodontic case.
 */
enum ProsthoStatus {
  /** Restoration has been treatment-planned but not yet started. */
  planned,
  /** Impressions or digital scans have been taken. */
  impressionTaken,
  /** Case has been sent to the dental laboratory. */
  labSent,
  /** Provisional or final restoration has been tried in the mouth. */
  tryIn,
  /** Final restoration has been cemented or inserted. */
  delivered,
  /** Restoration required fabrication of a replacement prosthesis. */
  remade,
}

/**
 * Commercially available shade guide systems used for colour matching.
 */
enum ShadeGuideSystem {
  /** VITA Classical A1–D4 shade guide. */
  vitaClassical,
  /** VITA 3D-Master shade guide with lightness, chroma, and hue dimensions. */
  vita3dMaster,
  /** Ivoclar Chromascop shade guide. */
  chromascop,
  /** Any shade guide system not enumerated above. */
  other,
}

/**
 * Method used to capture an impression of the dental arch.
 */
enum ImpressionType {
  /** Traditional tray-and-material physical impression. */
  conventional,
  /** Intraoral scanning producing a digital impression file. */
  digital,
  /** Irreversible hydrocolloid (alginate) impression material. */
  alginate,
  /** Addition-cured polyvinyl siloxane impression material. */
  pvs,
  /** Polyether impression material. */
  polyether,
}

/**
 * Lifecycle status of a dental laboratory case link.
 */
enum LabCaseLinkStatus {
  /** Lab case has been created but not yet dispatched. */
  pending,
  /** Laboratory has received the case and is actively fabricating it. */
  inFabrication,
  /** Completed restoration has been dispatched by the laboratory. */
  shipped,
  /** Clinic has received the completed restoration from the laboratory. */
  received,
  /** Restoration was returned to the laboratory for correction or remake. */
  returned,
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

/**
 * A prosthodontic case record tracking all phases from planning through delivery.
 */
model ProsthoRecord extends HealthcareBaseEntity {
  /** Patient for whom the prosthesis is being fabricated. */
  patient: Reference;

  /** Clinical encounter during which the prosthodontic work was initiated. */
  encounter?: Reference;

  /** Provider responsible for the prosthodontic case. */
  provider: Reference;

  /** Tooth number involved, where applicable. */
  toothNumber?: int32;

  /** Category of prosthetic restoration. */
  type: ProsthoType;

  /** Current lifecycle status of the prosthodontic case. */
  status: ProsthoStatus;

  /** Restorative material selected for this prosthesis (e.g. zirconia, PFM, PMMA). */
  material?: CodeableConcept;

  /** Clinical annotations about the prosthodontic case. */
  note?: Annotation[];
}

/**
 * A shade selection record documenting the colour matching process.
 */
model ShadeSelection extends HealthcareBaseEntity {
  /** Prosthodontic record this shade selection is associated with. */
  prosthoRecord: Reference;

  /** Shade guide system used for colour matching. */
  guideSystem: ShadeGuideSystem;

  /** Shade tab or value selected from the guide system. */
  shadeValue: string;

  /** Clinician or technician who performed the shade selection. */
  selectedBy: Reference;

  /** Date and time the shade selection was made. */
  selectedDate: utcDateTime;

  /** Additional notes about lighting conditions, stump shade, or other factors. */
  notes?: string;
}

/**
 * A record of an impression taken to capture the dental preparation.
 */
model Impression extends HealthcareBaseEntity {
  /** Prosthodontic record this impression is associated with. */
  prosthoRecord: Reference;

  /** Method used to capture the impression. */
  type: ImpressionType;

  /** Specific impression material used (where applicable). */
  material?: string;

  /** Date and time the impression was taken. */
  date: utcDateTime;

  /** Clinician who took the impression. */
  performer: Reference;
}

/**
 * A link between a prosthodontic record and an external dental laboratory case.
 */
model LabCaseLink extends HealthcareBaseEntity {
  /** Prosthodontic record this laboratory case is associated with. */
  prosthoRecord: Reference;

  /** External identifier assigned by the laboratory to this case. */
  labCaseId: string;

  /** Laboratory provider responsible for fabricating the restoration. */
  labProvider: Reference;

  /** Date the case was dispatched to the laboratory. */
  sentDate: utcDateTime;

  /** Date by which the laboratory is expected to deliver the restoration. */
  dueDate?: plainDate;

  /** Date the completed restoration was received from the laboratory. */
  receivedDate?: utcDateTime;

  /** Current status of the laboratory case. */
  status: LabCaseLinkStatus;
}

// ---------------------------------------------------------------------------
// Request / response wrappers
// ---------------------------------------------------------------------------

model ProsthoRecordCreateRequest {
  ...OmitProperties<ProsthoRecord, "id" | "meta" | "createdAt" | "updatedAt">;
}

model ProsthoRecordSearchParams {
  patientId?: string;
  providerId?: string;
  type?: ProsthoType;
  status?: ProsthoStatus;
  dateFrom?: utcDateTime;
  dateTo?: utcDateTime;
  ...PaginationQuery;
}

model ProsthoStatusTransitionRequest {
  status: ProsthoStatus;
  note?: string;
}

model ShadeSelectionCreateRequest {
  ...OmitProperties<ShadeSelection, "id" | "meta" | "createdAt" | "updatedAt">;
}

model ImpressionCreateRequest {
  ...OmitProperties<Impression, "id" | "meta" | "createdAt" | "updatedAt">;
}

model LabCaseLinkCreateRequest {
  ...OmitProperties<LabCaseLink, "id" | "meta" | "createdAt" | "updatedAt">;
}

model LabCaseLinkSearchParams {
  prosthoRecordId?: string;
  labProviderId?: string;
  status?: LabCaseLinkStatus;
  dueDateFrom?: plainDate;
  dueDateTo?: plainDate;
  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * CRUD, search, and status-transition operations for prosthodontic case records.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface ProsthoRecordManagement {
  /**
   * Create a new prosthodontic case record.
   * @param body Prosthodontic record creation payload.
   * @returns The newly created prosthodontic record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createProsthoRecord")
  create(@body body: ProsthoRecordCreateRequest): {
    @statusCode statusCode: 201;
    @body record: ProsthoRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a prosthodontic record by its unique identifier.
   * @param id The prosthodontic record identifier.
   * @returns The requested prosthodontic record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getProsthoRecord")
  read(@path id: string): ProsthoRecord | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing prosthodontic record.
   * @param id The prosthodontic record identifier.
   * @param body Updated prosthodontic record payload.
   * @returns The updated prosthodontic record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateProsthoRecord")
  update(@path id: string, @body body: ProsthoRecordCreateRequest): ProsthoRecord | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a prosthodontic record.
   * @param id The prosthodontic record identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteProsthoRecord")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search prosthodontic records by patient, provider, type, status, or date range.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching prosthodontic records.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchProsthoRecords")
  search(...ProsthoRecordSearchParams): PaginatedResponse<ProsthoRecord> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Transition the status of a prosthodontic record to the next phase.
   * @param id The prosthodontic record identifier.
   * @param body Status transition payload with target status.
   * @returns The updated prosthodontic record with new status.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("transitionProsthoStatus")
  @route("/{id}/status")
  transitionStatus(@path id: string, @body body: ProsthoStatusTransitionRequest): ProsthoRecord | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD operations for shade selection records.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface ShadeSelectionManagement {
  /**
   * Create a new shade selection record.
   * @param body Shade selection creation payload.
   * @returns The newly created shade selection.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createShadeSelection")
  create(@body body: ShadeSelectionCreateRequest): {
    @statusCode statusCode: 201;
    @body selection: ShadeSelection;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a shade selection by its unique identifier.
   * @param id The shade selection identifier.
   * @returns The requested shade selection.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getShadeSelection")
  read(@path id: string): ShadeSelection | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing shade selection record.
   * @param id The shade selection identifier.
   * @param body Updated shade selection payload.
   * @returns The updated shade selection.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateShadeSelection")
  update(@path id: string, @body body: ShadeSelectionCreateRequest): ShadeSelection | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a shade selection record.
   * @param id The shade selection identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteShadeSelection")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD operations for dental impression records.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface ImpressionManagement {
  /**
   * Create a new impression record.
   * @param body Impression creation payload.
   * @returns The newly created impression record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createImpression")
  create(@body body: ImpressionCreateRequest): {
    @statusCode statusCode: 201;
    @body impression: Impression;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve an impression record by its unique identifier.
   * @param id The impression record identifier.
   * @returns The requested impression record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getImpression")
  read(@path id: string): Impression | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing impression record.
   * @param id The impression record identifier.
   * @param body Updated impression payload.
   * @returns The updated impression record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateImpression")
  update(@path id: string, @body body: ImpressionCreateRequest): Impression | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete an impression record.
   * @param id The impression record identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteImpression")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD and search operations for laboratory case links associated with prosthodontic records.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface LabCaseLinkManagement {
  /**
   * Create a new laboratory case link.
   * @param body Lab case link creation payload.
   * @returns The newly created lab case link.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createLabCaseLink")
  create(@body body: LabCaseLinkCreateRequest): {
    @statusCode statusCode: 201;
    @body link: LabCaseLink;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a laboratory case link by its unique identifier.
   * @param id The lab case link identifier.
   * @returns The requested lab case link.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getLabCaseLink")
  read(@path id: string): LabCaseLink | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing laboratory case link.
   * @param id The lab case link identifier.
   * @param body Updated lab case link payload.
   * @returns The updated lab case link.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateLabCaseLink")
  update(@path id: string, @body body: LabCaseLinkCreateRequest): LabCaseLink | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a laboratory case link.
   * @param id The lab case link identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteLabCaseLink")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search laboratory case links by prosthodontic record, lab provider, status, or due date range.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching lab case links.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchLabCaseLinks")
  search(...LabCaseLinkSearchParams): PaginatedResponse<LabCaseLink> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
