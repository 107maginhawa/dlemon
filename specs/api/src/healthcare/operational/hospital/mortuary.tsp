import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../../common/models.tsp";
import "../../../common/errors.tsp";
import "../../../common/pagination.tsp";
import "../../../common/security.tsp";
import "../../core/primitives.tsp";
import "../../core/terminology.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

/**
 * Mortuary Services module.
 *
 * Provides models and operations for managing hospital mortuary services:
 * deceased patient records capturing death certification and medicolegal
 * information, body release documentation for funeral home handover, and
 * mortuary storage unit tracking. Supports medicolegal compliance and
 * chain-of-custody requirements.
 */
namespace Healthcare.Operational.Hospital.Mortuary;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Manner of death classification used for medicolegal and death certificate purposes.")
enum MannerOfDeath {
  @doc("Death resulting from disease or natural processes without external cause")
  natural,

  @doc("Death resulting from an unintentional injury or external cause")
  accident,

  @doc("Death resulting from self-inflicted intentional injury")
  suicide,

  @doc("Death resulting from intentional injury by another person")
  homicide,

  @doc("Manner of death cannot be determined based on available evidence")
  undetermined,

  @doc("Investigation is ongoing and manner of death has not yet been established")
  pending,
}

@doc("Current status of a mortuary storage compartment.")
enum StorageStatus {
  @doc("The compartment is empty and available for use")
  available,

  @doc("The compartment is occupied by a deceased individual")
  occupied,

  @doc("The compartment has been reserved for an expected admission")
  reserved,

  @doc("The compartment is out of service for cleaning or maintenance")
  maintenance,
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A deceased patient record created when a patient's death is pronounced in the facility, capturing medicolegal and administrative data required for death certification and coroner notification.")
model DeceasedRecord extends HealthcareBaseEntity {
  @doc("Reference to the Patient (deceased) this record belongs to")
  patient: Reference;

  @doc("Reference to the Encounter during which death occurred, if applicable (e.g., inpatient admission)")
  encounter?: Reference;

  @doc("Date and time death was pronounced")
  deathDateTime: utcDateTime;

  @doc("Reference to the Practitioner (physician or nurse practitioner) who pronounced death")
  pronouncedBy: Reference;

  @doc("Immediate and underlying cause(s) of death (ICD-10-CM coded)")
  causeOfDeath?: CodeableConcept;

  @doc("Manner of death classification for the death certificate")
  mannerOfDeath: MannerOfDeath;

  @doc("Whether an autopsy was requested (e.g., by family, clinical team, or coroner)")
  autopsyRequested?: boolean;

  @doc("Whether an autopsy was performed")
  autopsyPerformed?: boolean;

  @doc("Whether the coroner or medical examiner was notified (required for certain manners of death or unwitnessed deaths)")
  coronerNotified?: boolean;

  @doc("Whether the deceased had registered as an organ or tissue donor")
  organDonor?: boolean;
}

@doc("A body release record documenting the formal handover of the deceased to next of kin or a funeral home, including chain-of-custody signatures and documentation verification.")
model BodyRelease extends HealthcareBaseEntity {
  @doc("Reference to the DeceasedRecord for the individual being released")
  deceasedRecord: Reference;

  @doc("Full name of the person or organisation receiving the remains")
  releasedTo: string;

  @doc("Relationship of the recipient to the deceased (e.g., 'Spouse', 'Next of kin', 'Funeral Director')")
  relationship: string;

  @doc("Name of the funeral home collecting the remains, if applicable")
  funeralHome?: string;

  @doc("Date and time the body was released from mortuary custody")
  releasedAt: utcDateTime;

  @doc("Reference to the Practitioner or mortuary staff member who authorised and carried out the release")
  releasedBy: Reference;

  @doc("Whether a certified death certificate has been issued prior to release")
  deathCertificateIssued: boolean;

  @doc("Whether the identity of the deceased was formally verified before release (e.g., wristband, photo ID, coroner tag)")
  identificationVerified: boolean;

  @doc("Whether the personal effects of the deceased were released to the recipient at the same time")
  personalEffectsReleased: boolean;

  @doc("References to signed release form documents or signature capture records")
  signatures?: Reference[];
}

@doc("A mortuary storage unit compartment record tracking availability, occupancy, and environmental conditions.")
model MortuaryStorage extends HealthcareBaseEntity {
  @doc("Identifier of the storage unit or refrigeration bank (e.g., 'Unit-A', 'Refrigerator-2')")
  unit: string;

  @doc("Compartment or drawer number within the storage unit (e.g., '1', '2A', 'Top-Left')")
  compartment: string;

  @doc("Current status of this storage compartment")
  status: StorageStatus;

  @doc("Reference to the DeceasedRecord of the individual currently occupying this compartment, if status is 'occupied'")
  deceasedRecord?: Reference;

  @doc("Date and time the current occupant was admitted to this compartment")
  admittedAt?: utcDateTime;

  @doc("Date and time the occupant was released from this compartment")
  releasedAt?: utcDateTime;

  @doc("Current temperature of the storage compartment (Quantity with unit '°C')")
  temperature?: Quantity;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for deceased records.")
model DeceasedRecordSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by pronouncing clinician reference ID") @query pronouncedBy?: string;
  @doc("Filter by manner of death") @query mannerOfDeath?: MannerOfDeath;
  @doc("Filter by coroner notified status") @query coronerNotified?: boolean;
  @doc("Filter by autopsy requested status") @query autopsyRequested?: boolean;
  @doc("Filter deaths at or after this date-time") @query deathFrom?: utcDateTime;
  @doc("Filter deaths at or before this date-time") @query deathTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for body release records.")
model BodyReleaseSearchParams {
  @doc("Filter by deceased record reference ID") @query deceasedRecord?: string;
  @doc("Filter by releasing staff reference ID") @query releasedBy?: string;
  @doc("Filter by funeral home name (partial match)") @query funeralHome?: string;
  @doc("Filter by death certificate issued status") @query deathCertificateIssued?: boolean;
  @doc("Filter releases at or after this date-time") @query releasedFrom?: utcDateTime;
  @doc("Filter releases at or before this date-time") @query releasedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for mortuary storage compartments.")
model MortuaryStorageSearchParams {
  @doc("Filter by storage unit identifier") @query unit?: string;
  @doc("Filter by compartment status") @query status?: StorageStatus;
  @doc("Filter by current occupant deceased record reference ID") @query deceasedRecord?: string;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Deceased record management — create and manage death records capturing pronouncement details, cause and manner of death, and medicolegal notifications.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/mortuary/deceased-records")
interface DeceasedRecordManagement {
  @doc("Create a new deceased record when a patient's death is pronounced.")
  @operationId("createDeceasedRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createDeceasedRecord(
    @body body: DeceasedRecord,
  ): {
    @statusCode statusCode: 201;
    @body result: DeceasedRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a deceased record by its logical ID.")
  @operationId("getDeceasedRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getDeceasedRecord(
    @path @doc("DeceasedRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: DeceasedRecord;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a deceased record — used to record autopsy results, coroner notification, organ donor confirmation, or death certificate issuance.")
  @operationId("updateDeceasedRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateDeceasedRecord(
    @path @doc("DeceasedRecord logical ID") id: UUID,
    @body body: DeceasedRecord,
  ): {
    @statusCode statusCode: 200;
    @body result: DeceasedRecord;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a deceased record.")
  @operationId("deleteDeceasedRecord")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteDeceasedRecord(
    @path @doc("DeceasedRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search deceased records by patient, manner of death, pronouncing clinician, or date range.")
  @operationId("searchDeceasedRecords")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchDeceasedRecords(
    ...DeceasedRecordSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<DeceasedRecord>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Body release management — document the formal chain-of-custody handover of remains to next of kin or funeral services.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/mortuary/body-releases")
interface BodyReleaseManagement {
  @doc("Create a new body release record.")
  @operationId("createBodyRelease")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createBodyRelease(
    @body body: BodyRelease,
  ): {
    @statusCode statusCode: 201;
    @body result: BodyRelease;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a body release record by its logical ID.")
  @operationId("getBodyRelease")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getBodyRelease(
    @path @doc("BodyRelease logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: BodyRelease;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a body release record — record signatures or correct administrative details.")
  @operationId("updateBodyRelease")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateBodyRelease(
    @path @doc("BodyRelease logical ID") id: UUID,
    @body body: BodyRelease,
  ): {
    @statusCode statusCode: 200;
    @body result: BodyRelease;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a body release record.")
  @operationId("deleteBodyRelease")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteBodyRelease(
    @path @doc("BodyRelease logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search body release records by deceased record, releasing staff, funeral home, or date range.")
  @operationId("searchBodyReleases")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchBodyReleases(
    ...BodyReleaseSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<BodyRelease>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Mortuary storage management — track refrigeration unit capacity, compartment availability, and current occupancy.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/mortuary/storage")
interface MortuaryStorageManagement {
  @doc("Create a mortuary storage compartment record.")
  @operationId("createMortuaryStorage")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createMortuaryStorage(
    @body body: MortuaryStorage,
  ): {
    @statusCode statusCode: 201;
    @body result: MortuaryStorage;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a mortuary storage compartment by its logical ID.")
  @operationId("getMortuaryStorage")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getMortuaryStorage(
    @path @doc("MortuaryStorage logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: MortuaryStorage;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a mortuary storage compartment — record admission, release, status changes, or temperature readings.")
  @operationId("updateMortuaryStorage")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateMortuaryStorage(
    @path @doc("MortuaryStorage logical ID") id: UUID,
    @body body: MortuaryStorage,
  ): {
    @statusCode statusCode: 200;
    @body result: MortuaryStorage;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a mortuary storage compartment record.")
  @operationId("deleteMortuaryStorage")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteMortuaryStorage(
    @path @doc("MortuaryStorage logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search mortuary storage compartments by unit, status, or current occupant.")
  @operationId("searchMortuaryStorage")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchMortuaryStorage(
    ...MortuaryStorageSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<MortuaryStorage>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
