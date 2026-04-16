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

namespace Healthcare.Ancillary.DentalLab;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * Type of prosthetic or appliance item sent to the dental laboratory.
 */
enum LabCaseType {
  crown,
  bridge,
  denture,
  partial,
  veneer,
  /** Custom implant abutment fabrication. */
  implantAbutment,
  /** Occlusal nightguard or bruxism splint. */
  nightGuard,
  /** Orthodontic or post-prosthodontic retainer. */
  retainer,
  /** Occlusal or repositioning splint. */
  splint,
  /** Any case type not covered by defined values. */
  other,
}

/**
 * Lifecycle status of a dental laboratory case from draft through final delivery.
 */
enum DentalLabCaseStatus {
  /** Case has been created but not yet sent to the laboratory. */
  draft,
  /** Case has been dispatched to the laboratory. */
  sent,
  /** Laboratory has acknowledged receipt and is actively fabricating the item. */
  inFabrication,
  /** Completed item has been shipped by the laboratory to the clinic. */
  shippedToClinic,
  /** Clinic has received the completed item from the laboratory. */
  received,
  /** Item has been fitted and delivered to the patient. */
  delivered,
  /** Item was returned to the laboratory for correction or remake. */
  returned,
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

/**
 * A dental laboratory case representing a prosthetic work order sent to an external lab.
 */
model DentalLabCase extends HealthcareBaseEntity {
  /** Patient for whom the prosthesis or appliance is being fabricated. */
  patient: Reference;

  /** Clinician who initiated the laboratory case. */
  provider: Reference;

  /** External dental laboratory provider fulfilling the case. */
  labProvider: Reference;

  /** Treatment plan item this laboratory case is associated with. */
  treatmentPlanItem?: Reference;

  /** Type of prosthetic or appliance being fabricated. */
  type: LabCaseType;

  /** Current lifecycle status of the laboratory case. */
  status: DentalLabCaseStatus;

  /** Shade identifier selected for the restoration. */
  shade?: string;

  /** Restorative material specified for fabrication. */
  material?: CodeableConcept;

  /** Number of units being fabricated (teeth, pontics, or appliance count). */
  units: int32;

  /** Date by which the completed case must be returned to the clinic. */
  dueDate: plainDate;

  /** Date the case was dispatched to the laboratory. */
  sentDate?: utcDateTime;

  /** Date the completed case was received at the clinic. */
  receivedDate?: utcDateTime;

  /** Date the restoration was delivered and fitted to the patient. */
  deliveredDate?: utcDateTime;

  /** Laboratory fee charged for fabricating this case. */
  cost?: Money;

  /** Clinical annotations about the laboratory case. */
  note?: Annotation[];
}

/**
 * A dental laboratory provider record capturing contact and capability information.
 */
model DentalLabProvider extends HealthcareBaseEntity {
  /** Trading name of the dental laboratory. */
  name: string;

  /** Physical address of the laboratory. */
  address?: Address;

  /** Telecommunication contact details for the laboratory. */
  telecom?: ContactPoint[];

  /** Clinical specialties or appliance types the laboratory offers. */
  specialties?: CodeableConcept[];

  /** Whether the laboratory is currently available to accept new cases. */
  active: boolean;

  /** Average number of business days taken to return a completed case. */
  avgTurnaroundDays?: int32;
}

/**
 * A communication note exchanged between the clinic and the dental laboratory regarding a case.
 */
model LabCommunicationNote extends HealthcareBaseEntity {
  /** Laboratory case this communication note relates to. */
  labCase: Reference;

  /** Person who authored the communication note. */
  author: Reference;

  /** Text content of the message. */
  message: string;

  /** Date and time the message was sent. */
  sentAt: utcDateTime;

  /** Date and time the recipient confirmed they read the message. */
  readAt?: utcDateTime;

  /** Media or document attachments included with the message. */
  attachments?: Reference[];
}

/**
 * A record documenting the return of a completed or defective laboratory case.
 */
model LabCaseReturn extends HealthcareBaseEntity {
  /** Laboratory case being returned. */
  labCase: Reference;

  /** Person who initiated or processed the return. */
  returnedBy: Reference;

  /** Date and time the case was returned. */
  returnedDate: utcDateTime;

  /** Clinical or quality reason for the return. */
  reason: string;

  /** Whether the laboratory must fabricate a complete replacement item. */
  remakeRequired: boolean;
}

// ---------------------------------------------------------------------------
// Request / response wrappers
// ---------------------------------------------------------------------------

model DentalLabCaseCreateRequest {
  ...OmitProperties<DentalLabCase, "id" | "meta" | "createdAt" | "updatedAt">;
}

model DentalLabCaseSearchParams {
  patientId?: string;
  providerId?: string;
  labProviderId?: string;
  type?: LabCaseType;
  status?: DentalLabCaseStatus;
  dueDateFrom?: plainDate;
  dueDateTo?: plainDate;
  ...PaginationQuery;
}

model LabCaseReceiveRequest {
  receivedDate: utcDateTime;
  note?: string;
}

model LabCaseReturnCreateRequest {
  ...OmitProperties<LabCaseReturn, "id" | "meta" | "createdAt" | "updatedAt">;
}

model DentalLabProviderCreateRequest {
  ...OmitProperties<DentalLabProvider, "id" | "meta" | "createdAt" | "updatedAt">;
}

model DentalLabProviderSearchParams {
  name?: string;
  active?: boolean;
  specialty?: string;
  ...PaginationQuery;
}

model LabCommunicationNoteCreateRequest {
  ...OmitProperties<LabCommunicationNote, "id" | "meta" | "createdAt" | "updatedAt">;
}

model LabCommunicationSearchParams {
  labCaseId?: string;
  authorId?: string;
  dateFrom?: utcDateTime;
  dateTo?: utcDateTime;
  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * CRUD, search, receive, and return operations for dental laboratory cases.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface DentalLabCaseManagement {
  /**
   * Create a new dental laboratory case.
   * @param body Dental lab case creation payload.
   * @returns The newly created dental lab case.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createDentalLabCase")
  create(@body body: DentalLabCaseCreateRequest): {
    @statusCode statusCode: 201;
    @body labCase: DentalLabCase;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a dental laboratory case by its unique identifier.
   * @param id The dental lab case identifier.
   * @returns The requested dental lab case.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getDentalLabCase")
  read(@path id: string): DentalLabCase | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing dental laboratory case.
   * @param id The dental lab case identifier.
   * @param body Updated dental lab case payload.
   * @returns The updated dental lab case.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateDentalLabCase")
  update(@path id: string, @body body: DentalLabCaseCreateRequest): DentalLabCase | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a dental laboratory case.
   * @param id The dental lab case identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteDentalLabCase")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search dental laboratory cases by patient, provider, lab, type, status, or due date range.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching dental lab cases.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchDentalLabCases")
  search(...DentalLabCaseSearchParams): PaginatedResponse<DentalLabCase> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Record the receipt of a completed laboratory case at the clinic.
   * @param id The dental lab case identifier.
   * @param body Receipt confirmation payload including received date.
   * @returns The updated dental lab case with received status.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("receiveDentalLabCase")
  @route("/{id}/receive")
  receive(@path id: string, @body body: LabCaseReceiveRequest): DentalLabCase | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Return a defective or incorrect laboratory case and create a return record.
   * @param id The dental lab case identifier.
   * @param body Return record payload with reason and remake flag.
   * @returns The newly created lab case return record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("returnDentalLabCase")
  @route("/{id}/return")
  `return`(@path id: string, @body body: LabCaseReturnCreateRequest): LabCaseReturn | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD and search operations for dental laboratory provider records.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface DentalLabProviderManagement {
  /**
   * Register a new dental laboratory provider.
   * @param body Dental lab provider creation payload.
   * @returns The newly created dental lab provider record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createDentalLabProvider")
  create(@body body: DentalLabProviderCreateRequest): {
    @statusCode statusCode: 201;
    @body provider: DentalLabProvider;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a dental laboratory provider by its unique identifier.
   * @param id The dental lab provider identifier.
   * @returns The requested dental lab provider.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getDentalLabProvider")
  read(@path id: string): DentalLabProvider | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing dental laboratory provider record.
   * @param id The dental lab provider identifier.
   * @param body Updated provider payload.
   * @returns The updated dental lab provider.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateDentalLabProvider")
  update(@path id: string, @body body: DentalLabProviderCreateRequest): DentalLabProvider | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a dental laboratory provider record.
   * @param id The dental lab provider identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteDentalLabProvider")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search dental laboratory providers by name, active status, or specialty.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching dental lab providers.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchDentalLabProviders")
  search(...DentalLabProviderSearchParams): PaginatedResponse<DentalLabProvider> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD operations for lab-to-clinic communication notes on a laboratory case.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface LabCommunicationManagement {
  /**
   * Create a new communication note on a laboratory case.
   * @param body Communication note creation payload.
   * @returns The newly created communication note.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createLabCommunicationNote")
  create(@body body: LabCommunicationNoteCreateRequest): {
    @statusCode statusCode: 201;
    @body note: LabCommunicationNote;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a lab communication note by its unique identifier.
   * @param id The communication note identifier.
   * @returns The requested communication note.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getLabCommunicationNote")
  read(@path id: string): LabCommunicationNote | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing lab communication note.
   * @param id The communication note identifier.
   * @param body Updated communication note payload.
   * @returns The updated communication note.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateLabCommunicationNote")
  update(@path id: string, @body body: LabCommunicationNoteCreateRequest): LabCommunicationNote | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a lab communication note.
   * @param id The communication note identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteLabCommunicationNote")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
