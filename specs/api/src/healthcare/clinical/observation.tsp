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

namespace Healthcare.Clinical.Observations;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Codes providing the status of an observation.
 */
enum ObservationStatus {
  registered,
  preliminary,
  `final`,
  amended,
  corrected,
  cancelled,
  enteredInError,
  `unknown`: "unknown",
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

/**
 * Guidance on how to interpret the value — normal, critical, high, low, etc.
 */
model ObservationReferenceRange {
  /** Low bound of the normal range. */
  low?: Quantity;

  /** High bound of the normal range. */
  high?: Quantity;

  /** Code for the meaning of the reference range (e.g. normal, therapeutic). */
  type?: CodeableConcept;

  /** Reference range is valid for these coded concepts. */
  appliesTo?: CodeableConcept[];

  /** Age range to which the reference range applies. */
  age?: Range;

  /** Text based reference range in an observation. */
  text?: string;
}

/**
 * A sub-observation used in panel-style results (e.g. individual analytes within a BMP).
 */
model ObservationComponent {
  /** Describes what was observed (LOINC). */
  code: CodeableConcept;

  /** Numeric measurement. */
  valueQuantity?: Quantity;

  /** Coded value. */
  valueCodeableConcept?: CodeableConcept;

  /** Free-text value. */
  valueString?: string;

  /** Boolean value. */
  valueBoolean?: boolean;

  /** Integer value. */
  valueInteger?: int32;

  /** Clinical interpretation of the component result. */
  interpretation?: CodeableConcept[];

  /** Reference ranges for the component. */
  referenceRange?: ObservationReferenceRange[];
}

// ---------------------------------------------------------------------------
// Root resource
// ---------------------------------------------------------------------------

/**
 * Measurements and simple assertions made about a patient, device, or other
 * subject.  Covers vital signs, laboratory results, imaging findings, and
 * clinical assessments.
 * Mapped to FHIR R4 Observation.
 */
@example(#{
  id: "obs-001",
  version: 1,
  tenantId: "tenant-001",
  createdAt: utcDateTime.fromISO("2024-06-10T09:15:00Z"),
  updatedAt: utcDateTime.fromISO("2024-06-10T09:15:00Z"),
  status: ObservationStatus.final,
  category: #[#{ coding: #[#{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs", display: "Vital Signs" }] }],
  code: #{ coding: #[#{ system: "http://loinc.org", code: "8480-6", display: "Systolic blood pressure" }] },
  subject: #{ resourceType: "Patient", id: "pat-001", display: "John Smith" },
  effectiveDateTime: utcDateTime.fromISO("2024-06-10T09:15:00Z"),
  performer: #[#{ resourceType: "Practitioner", id: "prac-001", display: "Dr. Jane Doe" }],
  valueQuantity: #{ value: 120.0, unit: "mmHg", system: "http://unitsofmeasure.org", code: "mm[Hg]" },
}, #{ title: "Systolic blood pressure vital sign" })
model Observation extends HealthcareBaseEntity {
  /** ServiceRequest(s) this observation is based on. */
  basedOn?: Reference[];

  /** Parent observation(s) — used to group panel members. */
  partOf?: Reference[];

  /** The status of the result value. */
  status: ObservationStatus;

  /**
   * Classification of the type of observation.
   * Common categories: vital-signs, laboratory, imaging, survey, exam, therapy.
   */
  category: CodeableConcept[];

  /** Type of observation (LOINC). */
  code: CodeableConcept;

  /** Patient, device, or other subject this observation is about. */
  subject: Reference;

  /** What the observation is focused on, if different from the subject. */
  focus?: Reference[];

  /** Encounter during which this observation was recorded. */
  encounter?: Reference;

  /** Clinically relevant time/time-period for the observation. */
  effectiveDateTime?: utcDateTime;

  /** Clinically relevant time period for the observation. */
  effectivePeriod?: Period;

  /** Date/time this version was made available. */
  issued?: utcDateTime;

  /** Who is responsible for the observation. */
  performer: Reference[];

  /** Actual numeric result (with units). */
  valueQuantity?: Quantity;

  /** Actual coded result. */
  valueCodeableConcept?: CodeableConcept;

  /** Actual free-text result. */
  valueString?: string;

  /** Actual boolean result. */
  valueBoolean?: boolean;

  /** Actual integer result. */
  valueInteger?: int32;

  /** Actual range result. */
  valueRange?: Range;

  /** Provides a reason why the expected value in the element Observation.value[x] is missing. */
  dataAbsentReason?: CodeableConcept;

  /** Clinical interpretation of the result (high, low, critical, etc.). */
  interpretation?: CodeableConcept[];

  /** Comments about the result. */
  note?: Annotation[];

  /** Indicates the site on the subject's body where the observation was made. */
  bodySite?: CodeableConcept;

  /** Indicates the mechanism used to perform the observation. */
  method?: CodeableConcept;

  /** Specimen used for this observation. */
  specimen?: Reference;

  /** Measuring and other observation instruments used. */
  device?: Reference;

  /** Guidance on how to interpret the value. */
  referenceRange?: ObservationReferenceRange[];

  /** References to other Observations that are part of the same panel. */
  hasMember?: Reference[];

  /** Component observations (e.g. systolic and diastolic for blood pressure). */
  component?: ObservationComponent[];
}

/**
 * Request body for bulk-creating multiple Observations in a single call.
 */
model ObservationBulkCreateRequest {
  /** List of observations to create. */
  observations: Observation[];
}

/**
 * Response from a bulk observation create operation.
 */
model ObservationBulkCreateResponse {
  /** Successfully created observations. */
  created: Observation[];

  /** Errors encountered for specific entries, keyed by input array index. */
  errors: Record<string>;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

/**
 * Query parameters for searching Observation resources.
 */
model ObservationSearchParams {
  /** Filter by patient (subject) reference id. */
  patient?: string;

  /** Filter by LOINC code value. */
  code?: string;

  /** Filter by category code. */
  category?: string;

  /** Filter observations with an effective date at or after this value. */
  dateFrom?: utcDateTime;

  /** Filter observations with an effective date at or before this value. */
  dateTo?: utcDateTime;

  /** Filter by observation status. */
  status?: ObservationStatus;

  /** Page number (1-based). */
  page?: int32;

  /** Number of results per page. */
  pageSize?: int32;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * CRUD, bulk-create, and search operations for Observation resources.
 */
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface ObservationService {
  /**
   * Create a new Observation.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createObservation")
  create(
    @body body: Observation,
  ): {
    @statusCode statusCode: 201;
    @body observation: Observation;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a single Observation by id.
   */
  @extension("x-security-required-roles", #["admin", "clinician", "patient:owner"])
  @get
  @operationId("getObservation")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body observation: Observation;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing Observation.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateObservation")
  @route("/{id}")
  update(
    @path id: string,
    @body body: Observation,
  ): {
    @statusCode statusCode: 200;
    @body observation: Observation;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Partially update an Observation.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @patch
  @operationId("patchObservation")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body observation: Observation;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete an Observation.
   */
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteObservation")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Bulk-create multiple Observations in one request.
   * Partial success is supported — the response reports both created records and errors.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("bulkCreateObservations")
  @route("/bulk")
  bulkCreate(
    @body body: ObservationBulkCreateRequest,
  ): {
    @statusCode statusCode: 207;
    @body result: ObservationBulkCreateResponse;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search for Observation resources using filter parameters.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchObservations")
  @route("/search")
  search(
    ...ObservationSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Observation>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
