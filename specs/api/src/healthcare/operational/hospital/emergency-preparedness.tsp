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
 * Hospital Emergency Preparedness module.
 *
 * Supports Hospital Incident Command System (HICS) operations and disaster
 * management through models for emergency plan management, incident activation
 * and deactivation, real-time surge capacity reporting, and drill documentation.
 * Aligns with CMS Emergency Preparedness Rule (42 CFR 482.15) and HICS 2014
 * framework requirements.
 */
namespace Healthcare.Operational.Hospital.EmergencyPreparedness;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Type of emergency scenario covered by an emergency preparedness plan.")
enum EmergencyPlanType {
  @doc("Mass casualty incident — large number of casualties exceeding normal surge capacity")
  massCasualty,

  @doc("Infectious disease outbreak or pandemic response plan")
  pandemic,

  @doc("Natural disaster response (earthquake, flood, tornado, hurricane, wildfire)")
  naturalDisaster,

  @doc("Hazardous materials incident — chemical, biological, radiological, or nuclear")
  hazmat,

  @doc("Active threat or workplace violence — including active shooter response")
  activeThreat,

  @doc("Critical infrastructure failure — power, water, IT, or medical gas systems")
  infrastructure,

  @doc("Facility evacuation — partial or full evacuation of patients and staff")
  evacuation,

  @doc("Other emergency scenario not covered by the above categories")
  other,
}

@doc("Approval and lifecycle status of an emergency preparedness plan.")
enum PlanStatus {
  @doc("The plan is being developed and has not yet been reviewed or approved")
  draft,

  @doc("The plan has been reviewed and approved by the designated authority")
  approved,

  @doc("The plan is currently being executed in response to an active incident")
  active,

  @doc("The plan has been replaced by a newer approved version")
  superseded,

  @doc("The plan has been retired and is no longer in use")
  retired,
}

@doc("Level of emergency activation — determines the scope of HICS response and resource mobilization.")
enum ActivationLevel {
  @doc("Advisory level — monitoring an evolving situation; limited preparatory actions")
  advisory,

  @doc("Partial activation — some HICS positions staffed; targeted response underway")
  partial,

  @doc("Full activation — all HICS positions staffed; maximum resource mobilization")
  full,
}

@doc("Status of an emergency incident activation.")
enum ActivationStatus {
  @doc("The incident is active and the emergency response is ongoing")
  active,

  @doc("Operations are winding down; stand-down is in progress but not yet complete")
  standDown,

  @doc("The incident has been formally deactivated and normal operations have resumed")
  deactivated,
}

@doc("Format or scope of an emergency preparedness drill.")
enum DrillType {
  @doc("Discussion-based exercise — participants walk through the plan in a conference room")
  tabletop,

  @doc("Functional exercise — specific functions and operations are tested without full deployment")
  functional,

  @doc("Full-scale exercise — realistic simulation involving all personnel, equipment, and external partners")
  fullScale,
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("An emergency preparedness plan defining the organization's response procedures for a specific type of emergency scenario.")
model EmergencyPlan extends HealthcareBaseEntity {
  @doc("Human-readable name of this emergency plan (e.g., 'Mass Casualty Incident Plan', 'Pandemic Response Plan')")
  name: string;

  @doc("Type of emergency scenario this plan addresses")
  type: EmergencyPlanType;

  @doc("Current lifecycle status of this plan")
  status: PlanStatus;

  @doc("Reference to the authority (practitioner or committee) who approved this plan")
  approvedBy?: Reference;

  @doc("Date and time this plan was formally approved")
  approvedDate?: utcDateTime;

  @doc("Date and time of the most recent drill conducted under this plan")
  lastDrillDate?: utcDateTime;

  @doc("Target date for the next scheduled drill")
  nextDrillDate?: plainDate;

  @doc("Narrative description of this plan's scope, objectives, and key procedures")
  description: string;

  @doc("Conditions or thresholds that would trigger activation of this plan")
  activationCriteria?: string;

  @doc("Conditions or thresholds that define when this plan should be deactivated")
  deactivationCriteria?: string;
}

@doc("An emergency incident activation record documenting the invocation of an emergency plan, HICS command structure, and deactivation details.")
model EmergencyActivation extends HealthcareBaseEntity {
  @doc("Reference to the EmergencyPlan being executed in this activation")
  plan: Reference;

  @doc("Date and time the incident was formally activated")
  activatedAt: utcDateTime;

  @doc("Reference to the staff member or administrator who activated the incident")
  activatedBy: Reference;

  @doc("Level of activation selected at time of incident declaration")
  level: ActivationLevel;

  @doc("Current status of this activation")
  status: ActivationStatus;

  @doc("Reference to the Practitioner or administrator serving as Incident Commander")
  incidentCommander?: Reference;

  @doc("Date and time the incident was formally deactivated and stand-down was completed")
  deactivatedAt?: utcDateTime;

  @doc("Reference to the staff member who formally deactivated the incident")
  deactivatedBy?: Reference;

  @doc("Due date for the After-Action Report (AAR) to be submitted")
  afterActionReportDue?: plainDate;

  @doc("Notes associated with this activation — situation reports, key decisions, timeline entries")
  note?: Annotation[];
}

@doc("A point-in-time surge capacity snapshot documenting available beds, staff, equipment, and supply status during an emergency activation.")
model SurgeCapacity extends HealthcareBaseEntity {
  @doc("Reference to the EmergencyActivation this capacity snapshot is associated with")
  activation: Reference;

  @doc("Date and time this surge capacity assessment was completed")
  assessedAt: utcDateTime;

  @doc("Total licensed inpatient beds in the facility")
  totalBeds: int32;

  @doc("Number of inpatient beds currently available for new admissions")
  availableBeds: int32;

  @doc("Total licensed ICU beds in the facility")
  icuBeds: int32;

  @doc("Number of ICU beds currently available")
  icuAvailable: int32;

  @doc("Emergency department treatment capacity (number of treatment spaces)")
  edCapacity: int32;

  @doc("Current number of patients in the emergency department")
  edCurrent: int32;

  @doc("Total mechanical ventilators in the facility")
  ventilators: int32;

  @doc("Number of ventilators currently available for patient use")
  ventilatorsAvailable: int32;

  @doc("Number of clinical and support staff currently on duty")
  staffOnDuty: int32;

  @doc("Number of additional staff available to be called in within 2 hours")
  additionalStaffAvailable: int32;

  @doc("Narrative status of blood product supply levels (e.g., 'Critical — O-negative below 24h supply')")
  bloodSupplyStatus?: string;

  @doc("Narrative status of key medical supply inventory (e.g., 'PPE adequate for 72h', 'Oxygen supply normal')")
  supplyStatus?: string;
}

@doc("An emergency preparedness drill record documenting the exercise type, objectives, participation, outcomes, and corrective actions.")
model EmergencyDrill extends HealthcareBaseEntity {
  @doc("Reference to the EmergencyPlan being exercised in this drill")
  plan: Reference;

  @doc("Date the drill is scheduled to occur")
  scheduledDate: plainDate;

  @doc("Date and time the drill was actually conducted")
  actualDate?: utcDateTime;

  @doc("Type of drill conducted")
  type: DrillType;

  @doc("Number of participants involved in the drill")
  participants: int32;

  @doc("Duration of the drill in minutes")
  duration: int32;

  @doc("List of specific objectives the drill was designed to test")
  objectives: string[];

  @doc("Key lessons learned identified during or after the drill")
  lessonsLearned?: string[];

  @doc("Overall performance score for the drill (0-100 or program-defined scale)")
  score?: int32;

  @doc("Objectives that were successfully met during the drill")
  passedObjectives?: string[];

  @doc("Objectives that were not met — require corrective action before the next drill")
  failedObjectives?: string[];

  @doc("Corrective actions assigned to address gaps identified during the drill")
  correctiveActions?: string[];
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for emergency plans.")
model EmergencyPlanSearchParams {
  @doc("Filter by plan type") @query type?: EmergencyPlanType;
  @doc("Filter by plan status") @query status?: PlanStatus;
  @doc("Filter by approving authority reference ID") @query approvedBy?: string;
  @doc("Filter by next drill date on or before this date") @query nextDrillBy?: plainDate;
  @doc("Free-text search on plan name") @query name?: string;
  ...OffsetPaginationParams;
}

@doc("Search parameters for emergency activations.")
model EmergencyActivationSearchParams {
  @doc("Filter by plan reference ID") @query plan?: string;
  @doc("Filter by activation level") @query level?: ActivationLevel;
  @doc("Filter by activation status") @query status?: ActivationStatus;
  @doc("Filter by incident commander reference ID") @query incidentCommander?: string;
  @doc("Filter activations started on or after this date") @query activatedFrom?: utcDateTime;
  @doc("Filter activations started on or before this date") @query activatedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for surge capacity snapshots.")
model SurgeCapacitySearchParams {
  @doc("Filter by activation reference ID") @query activation?: string;
  @doc("Filter assessments on or after this date") @query assessedFrom?: utcDateTime;
  @doc("Filter assessments on or before this date") @query assessedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for emergency drills.")
model EmergencyDrillSearchParams {
  @doc("Filter by plan reference ID") @query plan?: string;
  @doc("Filter by drill type") @query type?: DrillType;
  @doc("Filter by scheduled date on or after this date") @query scheduledFrom?: plainDate;
  @doc("Filter by scheduled date on or before this date") @query scheduledTo?: plainDate;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Supporting request models
// ---------------------------------------------------------------------------

@doc("Request body for activating an emergency plan.")
model EmergencyActivationRequest {
  @doc("Reference to the emergency plan being activated")
  plan: Reference;

  @doc("Activation level selected for this incident")
  level: ActivationLevel;

  @doc("Reference to the designated Incident Commander for this activation")
  incidentCommander?: Reference;

  @doc("Initial situation report or reason for activation")
  note?: string;
}

@doc("Request body for deactivating an active emergency incident.")
model EmergencyDeactivationRequest {
  @doc("Reference to the staff member formally declaring deactivation")
  deactivatedBy: Reference;

  @doc("Due date for the After-Action Report submission")
  afterActionReportDue?: plainDate;

  @doc("Summary note documenting the deactivation rationale and final status")
  note?: string;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Emergency plan management — develop, approve, and maintain the organization's library of emergency preparedness plans.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/emergency-preparedness/plans")
interface EmergencyPlanManagement {
  @doc("Create a new emergency preparedness plan.")
  @operationId("createEmergencyPlan")
  @extension("x-security-required-roles", #["admin"])
  @post
  createEmergencyPlan(
    @body body: EmergencyPlan,
  ): {
    @statusCode statusCode: 201;
    @body result: EmergencyPlan;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve an emergency plan by its logical ID.")
  @operationId("getEmergencyPlan")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/{id}")
  getEmergencyPlan(
    @path @doc("EmergencyPlan logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: EmergencyPlan;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an emergency plan — status, approval details, drill dates, or content.")
  @operationId("updateEmergencyPlan")
  @extension("x-security-required-roles", #["admin"])
  @put
  @route("/{id}")
  updateEmergencyPlan(
    @path @doc("EmergencyPlan logical ID") id: UUID,
    @body body: EmergencyPlan,
  ): {
    @statusCode statusCode: 200;
    @body result: EmergencyPlan;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an emergency plan.")
  @operationId("deleteEmergencyPlan")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteEmergencyPlan(
    @path @doc("EmergencyPlan logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search emergency plans by type, status, or next drill date.")
  @operationId("searchEmergencyPlans")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/search")
  searchEmergencyPlans(
    ...EmergencyPlanSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<EmergencyPlan>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Emergency activation management — activate and deactivate emergency incidents, manage HICS command structure, and track activation history.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/emergency-preparedness/activations")
interface EmergencyActivationManagement {
  @doc("Create a new emergency activation record (manual record entry — use /activate for real-time activation).")
  @operationId("createEmergencyActivation")
  @extension("x-security-required-roles", #["admin"])
  @post
  createEmergencyActivation(
    @body body: EmergencyActivation,
  ): {
    @statusCode statusCode: 201;
    @body result: EmergencyActivation;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve an emergency activation record by its logical ID.")
  @operationId("getEmergencyActivation")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/{id}")
  getEmergencyActivation(
    @path @doc("EmergencyActivation logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: EmergencyActivation;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an emergency activation — incident commander, level, or notes.")
  @operationId("updateEmergencyActivation")
  @extension("x-security-required-roles", #["admin"])
  @put
  @route("/{id}")
  updateEmergencyActivation(
    @path @doc("EmergencyActivation logical ID") id: UUID,
    @body body: EmergencyActivation,
  ): {
    @statusCode statusCode: 200;
    @body result: EmergencyActivation;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an emergency activation record.")
  @operationId("deleteEmergencyActivation")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteEmergencyActivation(
    @path @doc("EmergencyActivation logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Activate an emergency plan — creates a new activation record with timestamps and notifies HICS personnel.")
  @operationId("activateEmergencyPlan")
  @extension("x-security-required-roles", #["admin"])
  @post
  @route("/activate")
  activateEmergencyPlan(
    @body body: EmergencyActivationRequest,
  ): {
    @statusCode statusCode: 201;
    @body result: EmergencyActivation;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Deactivate an active emergency incident — records deactivation time, responsible party, and AAR due date.")
  @operationId("deactivateEmergency")
  @extension("x-security-required-roles", #["admin"])
  @post
  @route("/{id}/deactivate")
  deactivateEmergency(
    @path @doc("EmergencyActivation logical ID") id: UUID,
    @body body: EmergencyDeactivationRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: EmergencyActivation;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search emergency activations by plan, level, status, incident commander, or date range.")
  @operationId("searchEmergencyActivations")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/search")
  searchEmergencyActivations(
    ...EmergencyActivationSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<EmergencyActivation>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Surge capacity management — capture and retrieve real-time bed, staff, equipment, and supply status snapshots during emergency activations.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/emergency-preparedness/surge-capacity")
interface SurgeCapacityManagement {
  @doc("Record a new surge capacity snapshot for an active emergency activation.")
  @operationId("createSurgeCapacity")
  @extension("x-security-required-roles", #["admin"])
  @post
  createSurgeCapacity(
    @body body: SurgeCapacity,
  ): {
    @statusCode statusCode: 201;
    @body result: SurgeCapacity;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search surge capacity snapshots by activation reference or assessment date range.")
  @operationId("searchSurgeCapacity")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/search")
  searchSurgeCapacity(
    ...SurgeCapacitySearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<SurgeCapacity>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve the most recent surge capacity snapshot for the currently active emergency activation.")
  @operationId("getCurrentSurgeCapacity")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/current")
  getCurrentSurgeCapacity(): {
    @statusCode statusCode: 200;
    @body result: SurgeCapacity;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Emergency drill management — plan, document, and evaluate emergency preparedness drills and exercises.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/emergency-preparedness/drills")
interface EmergencyDrillManagement {
  @doc("Create a new emergency drill record.")
  @operationId("createEmergencyDrill")
  @extension("x-security-required-roles", #["admin"])
  @post
  createEmergencyDrill(
    @body body: EmergencyDrill,
  ): {
    @statusCode statusCode: 201;
    @body result: EmergencyDrill;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve an emergency drill record by its logical ID.")
  @operationId("getEmergencyDrill")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/{id}")
  getEmergencyDrill(
    @path @doc("EmergencyDrill logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: EmergencyDrill;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an emergency drill record — actual date, participants, score, lessons learned, or corrective actions.")
  @operationId("updateEmergencyDrill")
  @extension("x-security-required-roles", #["admin"])
  @put
  @route("/{id}")
  updateEmergencyDrill(
    @path @doc("EmergencyDrill logical ID") id: UUID,
    @body body: EmergencyDrill,
  ): {
    @statusCode statusCode: 200;
    @body result: EmergencyDrill;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an emergency drill record.")
  @operationId("deleteEmergencyDrill")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteEmergencyDrill(
    @path @doc("EmergencyDrill logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search emergency drills by plan, type, or scheduled date range.")
  @operationId("searchEmergencyDrills")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/search")
  searchEmergencyDrills(
    ...EmergencyDrillSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<EmergencyDrill>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
