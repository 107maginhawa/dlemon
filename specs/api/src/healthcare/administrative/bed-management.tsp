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
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

/**
 * Healthcare Administrative Bed Management — real-time tracking of bed availability,
 * occupancy lifecycle, and assignment/release operations across wards and units.
 */
namespace Healthcare.Administrative.BedManagement;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

@doc("The clinical or physical type of a bed.")
enum BedType {
  @doc("Intensive care unit bed for critically ill patients requiring continuous monitoring")
  icu,

  @doc("Standard general ward bed for non-critical inpatients")
  general,

  @doc("Surgical unit bed for patients pre- or post-operative")
  surgical,

  @doc("Maternity unit bed for obstetric and post-partum care")
  maternity,

  @doc("Pediatric ward bed for patients under 18 years of age")
  pediatric,

  @doc("Psychiatric/behavioral health unit bed")
  psychiatric,

  @doc("Isolation room bed for patients requiring infection control precautions")
  isolation,

  @doc("Step-down or intermediate care unit bed — between ICU and general ward")
  stepDown,
}

@doc("The current operational status of a bed.")
enum BedStatus {
  @doc("The bed is clean, unoccupied, and ready to accept a new patient")
  available,

  @doc("The bed is currently occupied by a patient")
  occupied,

  @doc("The bed is being cleaned or prepared after a discharge")
  housekeeping,

  @doc("The bed is contaminated and requires decontamination before use")
  contaminated,

  @doc("The bed is permanently or temporarily out of service")
  closed,

  @doc("The bed is reserved/blocked and cannot be booked at this time")
  blocked,
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

@doc("A single physical bed within a healthcare facility location. Tracks type, status, and current occupant.")
model Bed extends HealthcareBaseEntity {
  @doc("Human-readable bed identifier (e.g., ICU-04, W2-12)")
  @minLength(1)
  @maxLength(50)
  identifier: string;

  @doc("Reference to the room or ward (Location resource) where this bed resides")
  location: Reference;

  @doc("Clinical or physical type of this bed")
  type: BedType;

  @doc("Current operational status of this bed")
  status: BedStatus;

  @doc("Physical or equipment features of this bed (e.g., 'ventilator', 'bariatric', 'telemetry')")
  features?: string[];

  @doc("Reference to the Patient currently occupying this bed; absent when bed is not occupied")
  currentOccupant?: Reference;
}

@doc("An occupancy record linking a patient-encounter pair to a specific bed for a period of time.")
model BedOccupancy {
  @doc("Reference to the Patient occupying the bed")
  patient: Reference;

  @doc("Reference to the Encounter associated with this bed occupancy")
  encounter: Reference;

  @doc("Reference to the Bed resource")
  bed: Reference;

  @doc("Date and time the patient was assigned to the bed")
  start: utcDateTime;

  @doc("Date and time the patient was released from the bed; absent if occupancy is ongoing")
  end?: utcDateTime;
}

// ---------------------------------------------------------------------------
// Request / search models
// ---------------------------------------------------------------------------

@doc("Request body for assigning a patient to a bed.")
model BedAssignRequest {
  @doc("Reference to the Patient to assign")
  patient: Reference;

  @doc("Reference to the Encounter that drives this bed assignment")
  encounter: Reference;
}

@doc("Search parameters for Bed resources.")
model BedSearchParams {
  @doc("Filter by bed type")
  @query type?: BedType;

  @doc("Filter by bed status")
  @query status?: BedStatus;

  @doc("Filter by location (room/ward) reference id")
  @query location?: string;

  @doc("Filter by a specific bed feature keyword")
  @query feature?: string;

  @doc("Page number (1-based)")
  @query page?: int32;

  @doc("Number of results per page")
  @query pageSize?: int32;
}

@doc("Search parameters for BedOccupancy history records.")
model BedOccupancySearchParams {
  @doc("Filter by bed reference id")
  @query bed?: string;

  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by encounter reference id")
  @query encounter?: string;

  @doc("Filter occupancies starting at or after this date-time")
  @query dateFrom?: utcDateTime;

  @doc("Filter occupancies starting at or before this date-time")
  @query dateTo?: utcDateTime;

  @doc("When true, return only currently active occupancies (no end date)")
  @query active?: boolean;

  @doc("Page number (1-based)")
  @query page?: int32;

  @doc("Number of results per page")
  @query pageSize?: int32;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

@doc("CRUD, assignment/release, and occupancy history operations for Bed resources.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface BedManagementService {
  @doc("Register a new Bed in the facility.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createBed")
  create(
    @body body: Bed,
  ): {
    @statusCode statusCode: 201;
    @body bed: Bed;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single Bed by id.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getBed")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body bed: Bed;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing Bed record.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateBed")
  @route("/{id}")
  update(
    @path id: string,
    @body body: Bed,
  ): {
    @statusCode statusCode: 200;
    @body bed: Bed;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a Bed record.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @patch
  @operationId("patchBed")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body bed: Bed;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a Bed record by id.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteBed")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for Bed resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchBeds")
  @route("/search")
  search(
    ...BedSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Bed>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Assign a patient to a bed, setting status to occupied and creating an occupancy record.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("assignBed")
  @route("/{id}/assign")
  assign(
    @path id: string,
    @body body: BedAssignRequest,
  ): {
    @statusCode statusCode: 200;
    @body bed: Bed;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("Release a bed from its current occupant, closing the occupancy record and resetting status to housekeeping.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("releaseBed")
  @route("/{id}/release")
  release(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body bed: Bed;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve the occupancy history for a specific bed or patient.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("listBedOccupancy")
  @route("/occupancy")
  listOccupancy(
    ...BedOccupancySearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<BedOccupancy>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
