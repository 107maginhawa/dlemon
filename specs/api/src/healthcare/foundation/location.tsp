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

/**
 * Location operational status enumeration
 */
@doc("Operational status of a physical location")
enum LocationStatus {
  @doc("The location is operational and available for use")
  active: "active",

  @doc("The location is temporarily unavailable or closed")
  suspended: "suspended",

  @doc("The location is permanently closed and no longer in use")
  inactive: "inactive",
}

/**
 * Location mode enumeration
 */
@doc("Indicates whether a resource instance represents a specific location or a class of locations")
enum LocationMode {
  @doc("The Location resource represents a specific instance of a location (e.g. a ward in a hospital)")
  instance: "instance",

  @doc("The Location resource represents a class of locations (e.g. any outpatient consulting room) which is not a specific location, but rather a resource that can be allocated when required")
  kind: "kind",
}

/**
 * Hours of operation for a location
 */
@doc("What days/times during a week the location is usually open")
model LocationHours {
  @doc("Days of the week on which the location is open (mon, tue, wed, thu, fri, sat, sun)")
  daysOfWeek?: string[];

  @doc("The location is open all day on the specified days")
  allDay?: boolean;

  @doc("Time that the location opens (HH:mm:ss, e.g. '08:00:00')")
  openingTime?: string;

  @doc("Time that the location closes (HH:mm:ss, e.g. '18:00:00')")
  closingTime?: string;
}

/**
 * Location model - FHIR R4 Location resource aligned
 */
@doc("FHIR R4-aligned location record representing details and position information for a physical place where services are provided and resources and participants may be stored, found, contained, or accommodated")
model Location extends HealthcareBaseEntity {
  @doc("The operational status of the location (whether it is currently operational)")
  status: LocationStatus;

  @doc("Name of the location as used by humans")
  name: string;

  @doc("A list of alternate names that the location is known as or was known as in the past")
  aliases?: string[];

  @doc("Description of the location; e.g. medical ward, or a specific room in a hospital")
  description?: string;

  @doc("Indicates whether a resource instance represents a specific location or a class of locations")
  mode: LocationMode;

  @doc("Indicates the type of function performed at the location (e.g. clinic, ward, room, building)")
  type?: CodeableConcept[];

  @doc("Contact details of the location (telephone, email, web address, etc.)")
  telecom?: ContactPoint[];

  @doc("Physical location for the location")
  address?: Address;

  @doc("Physical form of the location (e.g. room, wing, building, floor, corridor)")
  physicalType?: CodeableConcept;

  @doc("The absolute geographic location of the Location, expressed using WGS84 coordinates")
  position?: GeoCoordinates;

  @doc("The organization responsible for the provisioning and upkeep of the location")
  managingOrganization: Reference;

  @doc("Another Location of which this Location is physically a part of")
  partOf?: Reference;

  @doc("What days/times during a week is this location usually open")
  hoursOfOperation?: LocationHours[];
}

/**
 * Department model - an organizational unit within an organization at a location
 */
@doc("An organizational department or unit that provides a specific service, belongs to an organization, and is typically located at a physical location")
model Department extends HealthcareBaseEntity {
  @doc("The human-readable name of the department")
  name: string;

  @doc("Coded concept identifying the department type or function (e.g. cardiology, pharmacy, radiology)")
  code: CodeableConcept;

  @doc("Reference to the Organization this department belongs to")
  organization: Reference;

  @doc("Reference to the Location where this department is situated")
  location?: Reference;

  @doc("Reference to the Practitioner who heads this department")
  head?: Reference;

  @doc("Whether this department is currently active and operational")
  active: boolean;
}

/**
 * Location create request
 */
@doc("Request body for creating a new location record")
model CreateLocationRequest {
  @doc("Name of the location (required)")
  name: string;

  @doc("Reference to the managing organization (required)")
  managingOrganization: Reference;

  @doc("Operational status of the location")
  status?: LocationStatus;

  @doc("Instance vs. class mode of the location")
  mode?: LocationMode;

  @doc("Alternate names for the location")
  aliases?: string[];

  @doc("Human-readable description of the location")
  description?: string;

  @doc("Functional type(s) of the location")
  type?: CodeableConcept[];

  @doc("Contact details for the location")
  telecom?: ContactPoint[];

  @doc("Physical address of the location")
  address?: Address;

  @doc("Physical form of the location")
  physicalType?: CodeableConcept;

  @doc("Geo-coordinates of the location")
  position?: GeoCoordinates;

  @doc("Parent location reference")
  partOf?: Reference;

  @doc("Regular hours of operation")
  hoursOfOperation?: LocationHours[];
}

/**
 * Location update request - all fields optional, nullable for clearing
 */
@doc("Request body for updating a location record; null values clear the field")
model UpdateLocationRequest {
  @doc("Updated name - null clears the field (use with caution)")
  name?: string | null;

  @doc("Updated operational status")
  status?: LocationStatus | null;

  @doc("Updated alternate names - null clears all aliases")
  aliases?: string[] | null;

  @doc("Updated description - null clears the field")
  description?: string | null;

  @doc("Updated mode")
  mode?: LocationMode | null;

  @doc("Updated functional types - null clears all types")
  type?: CodeableConcept[] | null;

  @doc("Updated contact details - null clears all telecom entries")
  telecom?: ContactPoint[] | null;

  @doc("Updated address - null clears the field")
  address?: Address | null;

  @doc("Updated physical form - null clears the field")
  physicalType?: CodeableConcept | null;

  @doc("Updated geo-coordinates - null clears the field")
  position?: GeoCoordinates | null;

  @doc("Updated managing organization reference")
  managingOrganization?: Reference | null;

  @doc("Updated parent location reference - null removes the hierarchy relationship")
  partOf?: Reference | null;

  @doc("Updated hours of operation - null clears all hours")
  hoursOfOperation?: LocationHours[] | null;
}

/**
 * Department create request
 */
@doc("Request body for creating a new department")
model CreateDepartmentRequest {
  @doc("Human-readable name of the department (required)")
  name: string;

  @doc("Coded concept identifying the department type (required)")
  code: CodeableConcept;

  @doc("Reference to the owning organization (required)")
  organization: Reference;

  @doc("Whether this department is currently active")
  active?: boolean;

  @doc("Reference to the location where this department is situated")
  location?: Reference;

  @doc("Reference to the practitioner who heads this department")
  head?: Reference;
}

/**
 * Department update request - all fields optional, nullable for clearing
 */
@doc("Request body for updating a department record; null values clear the field")
model UpdateDepartmentRequest {
  @doc("Updated name - null clears the field (use with caution)")
  name?: string | null;

  @doc("Updated department type code - null clears the field")
  code?: CodeableConcept | null;

  @doc("Updated active status")
  active?: boolean | null;

  @doc("Updated location reference - null removes the location relationship")
  location?: Reference | null;

  @doc("Updated department head reference - null removes the head assignment")
  head?: Reference | null;
}

/**
 * Healthcare Foundation - Location and Department Management
 *
 * FHIR R4-aligned management of physical locations (wards, rooms, buildings, clinics)
 * and organizational departments. Supports hierarchical location structures via partOf,
 * geo-coordinate capture, and operational hours management.
 */
namespace Healthcare.Foundation {
  /**
   * Location management interface
   */
  @tag("Location")
  interface LocationManagement {
    @doc("Create a new location record.")
    @operationId("createLocation")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "org-admin"])
    createLocation(
      @body location: CreateLocationRequest
    ): ApiCreatedResponse<Location>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("List locations with optional filtering by name, type, organization, or status.")
    @operationId("listLocations")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "clinician", "support"])
    listLocations(
      ...PaginationQuery,
      @doc("Filter by location name (partial match)")
      @query name?: string,
      @doc("Filter by functional type code")
      @query type?: string,
      @doc("Filter by managing organization UUID")
      @query organization?: UUID,
      @doc("Filter by operational status")
      @query status?: LocationStatus,
      @doc("Filter by parent location UUID")
      @query partOf?: UUID
    ): ApiOkResponse<PaginatedResponse<Location>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Retrieve a single location record by ID.")
    @operationId("getLocation")
    @get
    @route("/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "clinician", "support"])
    getLocation(
      @path @doc("Location record UUID") id: UUID
    ): ApiOkResponse<Location>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a location record. Provide only the fields to change; null values clear optional fields.")
    @operationId("updateLocation")
    @patch(#{implicitOptionality: true})
    @route("/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "org-admin"])
    updateLocation(
      @path @doc("Location record UUID") id: UUID,
      @body updates: UpdateLocationRequest
    ): ApiOkResponse<Location>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Deactivate a location (sets status=inactive). Records are retained for audit and legal purposes.")
    @operationId("deactivateLocation")
    @delete
    @route("/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    deactivateLocation(
      @path @doc("Location record UUID") id: UUID
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }

  /**
   * Department management interface
   */
  @tag("Department")
  interface DepartmentManagement {
    @doc("Create a new department.")
    @operationId("createDepartment")
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "org-admin"])
    createDepartment(
      @body department: CreateDepartmentRequest
    ): ApiCreatedResponse<Department>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiConflictResponse;

    @doc("List departments with optional filtering by name, code, organization, or active status.")
    @operationId("listDepartments")
    @get
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "clinician", "support"])
    listDepartments(
      ...PaginationQuery,
      @doc("Filter by department name (partial match)")
      @query name?: string,
      @doc("Filter by department type code")
      @query code?: string,
      @doc("Filter by owning organization UUID")
      @query organization?: UUID,
      @doc("Filter by location UUID")
      @query location?: UUID,
      @doc("Filter by active status")
      @query active?: boolean
    ): ApiOkResponse<PaginatedResponse<Department>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Retrieve a single department record by ID.")
    @operationId("getDepartment")
    @get
    @route("/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "clinician", "support"])
    getDepartment(
      @path @doc("Department record UUID") id: UUID
    ): ApiOkResponse<Department>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update a department record. Provide only the fields to change; null values clear optional fields.")
    @operationId("updateDepartment")
    @patch(#{implicitOptionality: true})
    @route("/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "org-admin"])
    updateDepartment(
      @path @doc("Department record UUID") id: UUID,
      @body updates: UpdateDepartmentRequest
    ): ApiOkResponse<Department>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Deactivate a department (sets active=false).")
    @operationId("deactivateDepartment")
    @delete
    @route("/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    deactivateDepartment(
      @path @doc("Department record UUID") id: UUID
    ): ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;
  }
}
