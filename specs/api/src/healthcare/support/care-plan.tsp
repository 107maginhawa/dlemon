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
 * Healthcare Care Planning module.
 *
 * Provides FHIR R4-aligned models and operations for CarePlan, CareTeam, and Goal
 * resources. Supports longitudinal care coordination, multi-disciplinary team
 * management, and patient-centered goal tracking.
 */
namespace Healthcare.Support.CarePlanning;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Indicates the intent of the care plan. Aligns with FHIR CarePlan intent.")
enum CarePlanIntent {
  @doc("The care plan is a suggestion made without authorization to act")
  proposal,

  @doc("The care plan represents an intention to ensure something occurs")
  plan,

  @doc("The care plan represents a request and authorization for action")
  order,

  @doc("The care plan represents one of a set of potential plans")
  option,
}

@doc("Describes the progression of a care plan activity. Aligns with FHIR CarePlanActivityStatus.")
enum CarePlanActivityStatus {
  @doc("Activity has not yet started")
  notStarted,

  @doc("Activity is scheduled but not yet started")
  scheduled,

  @doc("Activity is currently in progress")
  inProgress,

  @doc("Activity has been temporarily halted")
  onHold,

  @doc("Activity has been completed")
  completed,

  @doc("Activity has been abandoned")
  cancelled,

  @doc("Activity has been permanently stopped before completion")
  stopped,

  @doc("Activity status is unknown")
  `unknown`: "unknown",

  @doc("Activity was created in error")
  enteredInError,
}

@doc("Indicates the current state of a care team. Aligns with FHIR CareTeamStatus.")
enum CareTeamStatus {
  @doc("The care team has been suggested but has not been activated")
  proposed,

  @doc("The care team is currently participating in the coordination of care")
  active,

  @doc("The care team is temporarily on hold waiting for a specific event")
  suspended,

  @doc("The care team was, but is no longer, participating in the coordination of care")
  inactive,

  @doc("The care team should have never existed")
  enteredInError,
}

@doc("Indicates the acceptance state of a goal and whether the goal is still being worked on. Aligns with FHIR GoalLifecycleStatus.")
enum GoalLifecycleStatus {
  @doc("A goal is proposed for this patient")
  proposed,

  @doc("A goal is planned for this patient")
  planned,

  @doc("A proposed goal was accepted or acknowledged")
  accepted,

  @doc("The goal is being sought actively")
  active,

  @doc("The goal remains a long term objective but current need requires focus elsewhere")
  onHold,

  @doc("The goal is no longer being sought")
  completed,

  @doc("The goal has been abandoned")
  cancelled,

  @doc("The goal was created in error and should not be used")
  enteredInError,

  @doc("A proposed goal was rejected")
  rejected,
}

// ---------------------------------------------------------------------------
// Supporting models — CarePlan
// ---------------------------------------------------------------------------

/**
 * Detail of a specific care plan activity, capturing how and when the activity
 * is to be performed.
 */
model CarePlanActivityDetail {
  /** High-level categorisation of the activity (e.g., MedicationRequest, ServiceRequest). */
  kind?: string;

  /** Detailed description of the type of planned activity. */
  code?: CodeableConcept;

  /** Why the activity should be done or why the activity was prohibited. */
  reasonCode?: CodeableConcept[];

  /** Condition or observation that drove the inclusion of this activity. */
  reasonReference?: Reference[];

  /** Internal reference to goals that this activity is intended to contribute towards. */
  goal?: Reference[];

  /** Identifies what progress is being made for the specific activity. */
  status: CarePlanActivityStatus;

  /** Textual reason for the current status of the activity. */
  statusReason?: CodeableConcept;

  /** If true, the activity should not be performed. */
  doNotPerform?: boolean;

  /** The period over which the activity is to occur. */
  scheduledPeriod?: Period;

  /** Identifies the facility where the activity will occur (e.g., hospital ward). */
  location?: Reference;

  /** Who will be responsible for performing the activity. */
  performer?: Reference[];

  /** Extra information about the activity not covered elsewhere. */
  description?: string;
}

/**
 * Identifies a planned action to occur as part of the care plan.
 */
model CarePlanActivity {
  /** Identifies the outcome at the point when the status of the activity is assessed. */
  outcomeCodeableConcept?: CodeableConcept[];

  /** Details of the outcome or action that has occurred. */
  outcomeReference?: Reference[];

  /** Notes about the adherence/status/progress of the activity. */
  progress?: Annotation[];

  /** The details of the proposed activity represented in a specific resource. */
  reference?: Reference;

  /** A simple summary of a planned activity suitable for a general care plan system. */
  detail?: CarePlanActivityDetail;
}

// ---------------------------------------------------------------------------
// Root resource — CarePlan
// ---------------------------------------------------------------------------

/**
 * Describes the intention of how one or more practitioners intend to deliver
 * care for a particular patient, group or community for a period of time.
 * Mapped to FHIR R4 CarePlan.
 */
model CarePlan extends HealthcareBaseEntity {
  /** Indicates whether the plan is currently being acted upon, represents future intentions or is now historical. */
  status: CarePlanStatus;

  /** Indicates the level of authority/intentionality associated with the care plan. */
  intent: CarePlanIntent;

  /** Identifies what "kind" of plan this is to support differentiation between multiple co-existing plans. */
  category?: CodeableConcept[];

  /** Human-friendly name for the care plan. */
  title?: string;

  /** A description of the scope and nature of the plan. */
  description?: string;

  /** Identifies the patient or group whose intended care is described by the plan. */
  subject: Reference;

  /** The Encounter during which this CarePlan was created or to which the creation of this record is tightly associated. */
  encounter?: Reference;

  /** Indicates when the plan did (or is intended to) come into effect and end. */
  period?: Period;

  /** Represents when this particular CarePlan record was created in the system. */
  created: utcDateTime;

  /** When populated, the author is responsible for the care plan. The care plan is attributed to the author. */
  author?: Reference;

  /** Identifies the individual(s) or organization who provided the contents of the care plan. */
  contributor?: Reference[];

  /** Identifies all people and organisations who are expected to be involved in the care envisioned by this plan. */
  careTeam?: Reference[];

  /** Identifies the conditions/problems/concerns/diagnoses/etc. whose management and/or mitigation are handled by this plan. */
  addresses?: Reference[];

  /** Identifies portions of the patient's record that specifically influenced the formation of the plan. */
  supportingInfo?: Reference[];

  /** Describes the intended objective(s) of carrying out the care plan. */
  goal?: Reference[];

  /** Identifies a planned action to occur as part of the plan. */
  activity?: CarePlanActivity[];

  /** General notes about the care plan not covered elsewhere. */
  note?: Annotation[];
}

// ---------------------------------------------------------------------------
// Supporting models — CareTeam
// ---------------------------------------------------------------------------

/**
 * Identifies all people and organizations who are expected to be involved in
 * the care team.
 */
model CareTeamParticipant {
  /** Indicates specific responsibility of an individual within the care team (e.g., surgeon). */
  role?: CodeableConcept[];

  /** The specific person or organization who is participating/expected to participate in the care team. */
  member: Reference;

  /** The organization of the practitioner. */
  onBehalfOf?: Reference;

  /** Indicates when the specific member or organization did (or is intended to) come into effect and end. */
  period?: Period;
}

// ---------------------------------------------------------------------------
// Root resource — CareTeam
// ---------------------------------------------------------------------------

/**
 * The Care Team includes all the people and organisations who plan to participate
 * in the coordination and delivery of care for a patient.
 * Mapped to FHIR R4 CareTeam.
 */
model CareTeam extends HealthcareBaseEntity {
  /** Indicates the current state of the care team. */
  status: CareTeamStatus;

  /** Identifies what kind of team. This is to support differentiation between multiple co-existing teams. */
  category?: CodeableConcept[];

  /** A label for human use intended to distinguish like teams. */
  name?: string;

  /** Identifies the patient or group whose intended care is handled by the team. */
  subject: Reference;

  /** The Encounter during which this CareTeam was created or to which the creation of this record is tightly associated. */
  encounter?: Reference;

  /** Indicates when the team did (or is intended to) come into effect and end. */
  period?: Period;

  /** Identifies all people and organisations who are expected to be involved in the care team. */
  participant: CareTeamParticipant[];

  /** Describes why the care team exists. */
  reasonCode?: CodeableConcept[];

  /** Condition(s) that this care team addresses. */
  reasonReference?: Reference[];

  /** The organization responsible for the care team. */
  managingOrganization?: Reference[];

  /** A central contact detail for the care team (that applies to all members). */
  telecom?: ContactPoint[];

  /** Comments made about the CareTeam. */
  note?: Annotation[];
}

// ---------------------------------------------------------------------------
// Supporting models — Goal
// ---------------------------------------------------------------------------

/**
 * Indicates what should be done by when. Target outcome criteria.
 */
model GoalTarget {
  /** The parameter whose value is being tracked (e.g., body weight, blood pressure). */
  measure?: CodeableConcept;

  /** The target value of the focus to be achieved to signify the fulfillment of the goal (as a Quantity). */
  detailQuantity?: Quantity;

  /** The target value of the focus to be achieved to signify the fulfillment of the goal (as a Range). */
  detailRange?: Range;

  /** The target value of the focus to be achieved to signify the fulfillment of the goal (as a CodeableConcept). */
  detailCodeableConcept?: CodeableConcept;

  /** The target value of the focus to be achieved to signify the fulfillment of the goal (as a string). */
  detailString?: string;

  /** Indicates either the date or the duration after start by which the goal should be met. */
  dueDate?: plainDate;
}

// ---------------------------------------------------------------------------
// Root resource — Goal
// ---------------------------------------------------------------------------

/**
 * Describes the intended objective(s) for a patient, group or organization
 * care — for example, weight loss or to reduce time to remission.
 * Mapped to FHIR R4 Goal.
 */
model Goal extends HealthcareBaseEntity {
  /** The state of the goal throughout its lifecycle. */
  lifecycleStatus: GoalLifecycleStatus;

  /** Describes the progression, or lack thereof, towards the goal against the target. */
  achievementStatus?: CodeableConcept;

  /** Indicates a category the goal falls within. */
  category?: CodeableConcept[];

  /** Identifies the mutually agreed level of importance associated with reaching/sustaining the goal. */
  priority?: CodeableConcept;

  /** Human-readable and/or coded description of a specific desired objective of care. */
  description: CodeableConcept;

  /** Identifies the patient, group or organization for whom the goal is being established. */
  subject: Reference;

  /** The date or event after which the goal should begin being pursued. */
  startDate?: plainDate;

  /** Indicates what should be done by when. */
  target?: GoalTarget[];

  /** Identifies when the current status was set. */
  statusDate?: plainDate;

  /** Captures the reason for the current status. */
  statusReason?: string;

  /** Indicates whose goal this is: patient, practitioner, related person, etc. */
  expressedBy?: Reference;

  /** The identified conditions and other health record elements that are intended to be addressed by the goal. */
  addresses?: Reference[];

  /** Any comments related to the goal. */
  note?: Annotation[];
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

/** Query parameters for searching CarePlan resources. */
model CarePlanSearchParams {
  /** Filter by patient (subject) reference id. */
  @query patient?: string;

  /** Filter by care plan status. */
  @query status?: string;

  /** Filter by category code. */
  @query category?: string;

  /** Filter by author reference id. */
  @query author?: string;

  /** Filter by encounter reference id. */
  @query encounter?: string;

  /** Page number (1-based). */
  @query page?: int32;

  /** Number of results per page. */
  @query pageSize?: int32;
}

/** Query parameters for searching CareTeam resources. */
model CareTeamSearchParams {
  /** Filter by patient (subject) reference id. */
  @query patient?: string;

  /** Filter by care team status. */
  @query status?: string;

  /** Filter by category code. */
  @query category?: string;

  /** Page number (1-based). */
  @query page?: int32;

  /** Number of results per page. */
  @query pageSize?: int32;
}

/** Query parameters for searching Goal resources. */
model GoalSearchParams {
  /** Filter by patient (subject) reference id. */
  @query patient?: string;

  /** Filter by lifecycle status. */
  @query lifecycleStatus?: string;

  /** Filter by category code. */
  @query category?: string;

  /** Filter by start date (ISO 8601 date). */
  @query startDate?: string;

  /** Page number (1-based). */
  @query page?: int32;

  /** Number of results per page. */
  @query pageSize?: int32;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for CarePlan resources.
 */
@tag("Healthcare:Support")
@useAuth(bearerAuth)
interface CarePlanManagement {
  /** Create a new CarePlan. */
  @post
  @operationId("createCarePlan")
  create(
    @body body: CarePlan,
  ): {
    @statusCode statusCode: 201;
    @body carePlan: CarePlan;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Retrieve a single CarePlan by id. */
  @get
  @operationId("getCarePlan")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body carePlan: CarePlan;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Replace an existing CarePlan. */
  @put
  @operationId("updateCarePlan")
  @route("/{id}")
  update(
    @path id: string,
    @body body: CarePlan,
  ): {
    @statusCode statusCode: 200;
    @body carePlan: CarePlan;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Partially update a CarePlan. */
  @patch
  @operationId("patchCarePlan")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body carePlan: CarePlan;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Delete a CarePlan by id. */
  @delete
  @operationId("deleteCarePlan")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Search for CarePlans using filter parameters. */
  @get
  @operationId("searchCarePlans")
  @route("/search")
  search(
    ...CarePlanSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<CarePlan>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD and search operations for CareTeam resources.
 */
@tag("Healthcare:Support")
@useAuth(bearerAuth)
interface CareTeamManagement {
  /** Create a new CareTeam. */
  @post
  @operationId("createCareTeam")
  create(
    @body body: CareTeam,
  ): {
    @statusCode statusCode: 201;
    @body careTeam: CareTeam;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Retrieve a single CareTeam by id. */
  @get
  @operationId("getCareTeam")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body careTeam: CareTeam;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Replace an existing CareTeam. */
  @put
  @operationId("updateCareTeam")
  @route("/{id}")
  update(
    @path id: string,
    @body body: CareTeam,
  ): {
    @statusCode statusCode: 200;
    @body careTeam: CareTeam;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Partially update a CareTeam. */
  @patch
  @operationId("patchCareTeam")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body careTeam: CareTeam;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Delete a CareTeam by id. */
  @delete
  @operationId("deleteCareTeam")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Search for CareTeams using filter parameters. */
  @get
  @operationId("searchCareTeams")
  @route("/search")
  search(
    ...CareTeamSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<CareTeam>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD and search operations for Goal resources.
 */
@tag("Healthcare:Support")
@useAuth(bearerAuth)
interface GoalManagement {
  /** Create a new Goal. */
  @post
  @operationId("createGoal")
  create(
    @body body: Goal,
  ): {
    @statusCode statusCode: 201;
    @body goal: Goal;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Retrieve a single Goal by id. */
  @get
  @operationId("getGoal")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body goal: Goal;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Replace an existing Goal. */
  @put
  @operationId("updateGoal")
  @route("/{id}")
  update(
    @path id: string,
    @body body: Goal,
  ): {
    @statusCode statusCode: 200;
    @body goal: Goal;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Partially update a Goal. */
  @patch
  @operationId("patchGoal")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body goal: Goal;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Delete a Goal by id. */
  @delete
  @operationId("deleteGoal")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Search for Goals using filter parameters. */
  @get
  @operationId("searchGoals")
  @route("/search")
  search(
    ...GoalSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Goal>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
