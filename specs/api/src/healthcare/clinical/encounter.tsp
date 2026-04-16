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

namespace Healthcare.Clinical.Encounters;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Lifecycle status values for an Encounter.
 */
enum EncounterStatus {
  planned,
  arrived,
  triaged,
  inProgress,
  onLeave,
  finished,
  cancelled,
  enteredInError,
  `unknown`: "unknown",
}

/**
 * Status of the encounter location assignment.
 */
enum EncounterLocationStatus {
  planned,
  active,
  reserved,
  completed,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

/**
 * A snapshot of the encounter status at a point in time.
 */
model EncounterStatusHistory {
  /** The encounter status during this history period. */
  status: EncounterStatus;

  /** The time period this status was in effect. */
  period: Period;
}

/**
 * A participant (practitioner, related person, etc.) in the encounter.
 */
model EncounterParticipant {
  /** Role(s) the participant played during the encounter. */
  type: CodeableConcept[];

  /** Period during which this participant was present. */
  period?: Period;

  /** Reference to the individual who participated. */
  individual: Reference;

  /** Whether this participant is the primary responsible clinician. */
  isPrimary?: boolean;
}

/**
 * A diagnosis associated with the encounter.
 */
model EncounterDiagnosis {
  /** Reference to the Condition or Procedure serving as the diagnosis. */
  condition: Reference;

  /** Role the diagnosis plays (admission, billing, discharge, etc.). */
  use?: CodeableConcept;

  /** Ranking of the diagnosis among encounter diagnoses. */
  rank?: int32;
}

/**
 * Details about hospitalisation for an in-patient encounter.
 */
model EncounterHospitalization {
  /** From where the patient was admitted. */
  admitSource?: CodeableConcept;

  /** Whether the admission is a re-admission and its category. */
  reAdmission?: CodeableConcept;

  /** Diet preferences reported by the patient. */
  dietPreference?: CodeableConcept[];

  /** Category or kind of location after discharge. */
  dischargeDisposition?: CodeableConcept;

  /** Location/organization to which the patient is discharged. */
  destination?: Reference;

  @doc("Free-text discharge instructions for the simple inline case. For structured discharge instructions, use a Composition resource with a discharge-instructions section (LOINC 8653-8).")
  dischargeInstruction?: string;
}

/**
 * A location the patient was at during the encounter.
 */
model EncounterLocation {
  /** Reference to the Location resource. */
  location: Reference;

  /** Current status of the location assignment. */
  status?: EncounterLocationStatus;

  /** Time period during which the patient was at this location. */
  period?: Period;
}

// ---------------------------------------------------------------------------
// Root resource
// ---------------------------------------------------------------------------

/**
 * An Encounter represents a clinical event: an interaction between a patient
 * and a healthcare provider for the purpose of providing healthcare service(s).
 * Mapped to FHIR R4 Encounter.
 */
model Encounter extends HealthcareBaseEntity {
  /** Current lifecycle status of the encounter. */
  status: EncounterStatus;

  /** History of status transitions. */
  statusHistory?: EncounterStatusHistory[];

  /**
   * Classification of the encounter (ambulatory, inpatient, emergency, etc.).
   * Bound to v3 ActCode.
   */
  `class`: EncounterClass;

  /** Specific type of encounter (SNOMED, CPT). */
  type?: CodeableConcept[];

  /** Specific type of service delivered. */
  serviceType?: CodeableConcept;

  /** Indicates the urgency of the encounter (routine, urgent, emergency). */
  priority?: CodeableConcept;

  /** Reference to the patient who is the subject of the encounter. */
  subject: Reference;

  /** Service requests (referrals) this encounter is based on. */
  basedOn?: Reference[];

  /** Participants involved in the encounter. */
  participant: EncounterParticipant[];

  /** Appointment(s) that scheduled this encounter. */
  appointment?: Reference[];

  /** Start and end time of the encounter. */
  period?: Period;

  /** Quantity of time the encounter lasted, as an ISO 8601 duration string. */
  length?: string;

  /** Coded reason the encounter takes place. */
  reasonCode?: CodeableConcept[];

  /** References to Condition or Procedure resources explaining the encounter. */
  reasonReference?: Reference[];

  /** Diagnoses relevant to this encounter. */
  diagnosis: EncounterDiagnosis[];

  /** Details about an in-patient hospitalisation associated with the encounter. */
  hospitalization?: EncounterHospitalization;

  /** List of locations visited during the encounter. */
  location: EncounterLocation[];

  /** Organisation that is primarily responsible for this encounter. */
  serviceProvider: Reference;

  /** Another encounter of which this encounter is a part. */
  partOf?: Reference;

  /** Patient's stated chief complaint at the start of the encounter. */
  chiefComplaint?: string;

  /** Freeform clinical notes attached to this encounter. */
  notes?: Annotation[];
}

/**
 * Body for requesting an encounter status transition.
 */
model EncounterStatusTransitionRequest {
  /** Target status to transition the encounter to. */
  status: EncounterStatus;

  /** Coded reason for the transition (e.g. cancellation reason). */
  reason?: CodeableConcept;
}

/**
 * Search parameters accepted by the encounter search endpoint.
 */
model EncounterSearchParams {
  /** Filter by patient (subject) reference id. */
  patient?: string;

  /** Filter by encounter status. */
  status?: EncounterStatus;

  /** Filter by encounter class code. */
  `class`?: string;

  /** Filter encounters that start at or after this date-time (ISO 8601). */
  dateFrom?: utcDateTime;

  /** Filter encounters that start at or before this date-time (ISO 8601). */
  dateTo?: utcDateTime;

  /** Filter by participating practitioner reference id. */
  practitioner?: string;

  /** Page number (1-based). */
  page?: int32;

  /** Number of results per page. */
  pageSize?: int32;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for Encounter resources.
 */
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface EncounterService {
  /**
   * Create a new Encounter.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createEncounter")
  create(
    @body body: Encounter,
  ): {
    @statusCode statusCode: 201;
    @body encounter: Encounter;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a single Encounter by id.
   */
  @extension("x-security-required-roles", #["admin", "clinician", "patient:owner"])
  @get
  @operationId("getEncounter")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body encounter: Encounter;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing Encounter.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateEncounter")
  @route("/{id}")
  update(
    @path id: string,
    @body body: Encounter,
  ): {
    @statusCode statusCode: 200;
    @body encounter: Encounter;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Partially update an Encounter.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @patch
  @operationId("patchEncounter")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body encounter: Encounter;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete an Encounter by id.
   */
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteEncounter")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Transition an Encounter to a new lifecycle status.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("transitionEncounterStatus")
  @route("/{id}/status")
  transitionStatus(
    @path id: string,
    @body body: EncounterStatusTransitionRequest,
  ): {
    @statusCode statusCode: 200;
    @body encounter: Encounter;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search for Encounters using filter parameters.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchEncounters")
  @route("/search")
  search(
    ...EncounterSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Encounter>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
