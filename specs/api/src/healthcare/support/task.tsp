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
 * Healthcare Task module.
 *
 * Provides FHIR R4-aligned models and operations for workflow Task resources.
 * Supports clinical and administrative workflow automation including status
 * transitions, assignment management, and task prioritisation.
 */
namespace Healthcare.Support.Tasks;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The current status of a task. Aligns with FHIR TaskStatus.")
enum TaskStatus {
  @doc("The task is yet to be acted upon")
  draft,

  @doc("The task is ready to be acted upon and action is sought")
  requested,

  @doc("A potential performer has claimed ownership of the task and is evaluating whether to perform it")
  received,

  @doc("The potential performer has agreed to execute the task but has not yet started work")
  accepted,

  @doc("The potential performer who claimed ownership of the task has decided not to execute it prior to performing any action")
  rejected,

  @doc("The task is ready to be performed, but no action has yet been taken; used in place of requested/received/accepted/rejected when request assignment is not relevant")
  ready,

  @doc("The task was not completed")
  cancelled,

  @doc("The task has been started but is not yet complete")
  inProgress,

  @doc("The task has been started but work has been paused")
  onHold,

  @doc("The task was attempted but could not be completed due to some error")
  failed,

  @doc("The task has been completed")
  completed,

  @doc("The task should never have existed and is retained only because of the possibility it may have used")
  enteredInError,
}

@doc("Distinguishes whether the task is a proposal, plan or full order. Aligns with FHIR TaskIntent.")
enum TaskIntent {
  @doc("The request is a suggestion made by someone/something that doesn't have an intention to ensure it occurs and without providing an authorization to act")
  proposal,

  @doc("The request represents an intention to ensure something occurs without providing an authorization for others to act")
  plan,

  @doc("The request represents a request/demand and authorization for action")
  order,

  @doc("The request represents an original authorization for action")
  originalOrder,

  @doc("The request represents an automatically generated supplemental authorization for action based on a parent authorization")
  reflexOrder,

  @doc("The request represents the view of an authorization instantiated by a fulfilling system representing the details of the fulfiller's intention to act upon a submitted order")
  fillerOrder,

  @doc("The request represents an instance for the particular order, for example a medication administration record")
  instanceOrder,

  @doc("The request represents a component or option for a RequestGroup that establishes timing, conditionality and/or other constraints among a set of requests")
  option,

  @doc("The task is unknown in context")
  `unknown`: "unknown",
}

@doc("Identifies the priority of the task. Aligns with FHIR RequestPriority.")
enum TaskPriority {
  @doc("The task has normal priority")
  routine,

  @doc("The task should be actioned promptly — higher priority than routine")
  urgent,

  @doc("The task should be actioned as soon as possible — higher priority than urgent")
  asap,

  @doc("The task should be actioned immediately — highest possible priority; used for life-threatening situations")
  stat,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

/**
 * Constraint on when this task should be performed, to whom it should be
 * offered and how many times it may recur.
 */
model TaskRestriction {
  /** Indicates the number of times the requested action should occur. */
  repetitions?: int32;

  /** Over what time period is fulfillment sought. */
  period?: Period;

  /** For requests that are targeted to more than one potential recipient/target, to identify who is fulfillment is sought for. */
  recipient?: Reference[];
}

/**
 * A named piece of data that is provided to or produced by a task.
 */
model TaskParameter {
  /** A code or description indicating how the input or output is intended to be used as part of the task execution. */
  type: CodeableConcept;

  /** The value of the input or output parameter as a string. */
  valueString?: string;

  /** The value of the input or output parameter as a boolean. */
  valueBoolean?: boolean;

  /** The value of the input or output parameter as an integer. */
  valueInteger?: int32;

  /** The value of the input or output parameter as a reference to another resource. */
  valueReference?: Reference;

  /** The value of the input or output parameter as a coded concept. */
  valueCodeableConcept?: CodeableConcept;

  /** The value of the input or output parameter as a quantity. */
  valueQuantity?: Quantity;
}

// ---------------------------------------------------------------------------
// Root resource — Task
// ---------------------------------------------------------------------------

/**
 * A task resource describes an activity that can be performed and tracks
 * the state of completion of that activity. It is a representation that
 * an activity should be or has been initiated, and eventually, represents
 * the successful or unsuccessful completion of that activity.
 * Mapped to FHIR R4 Task.
 */
model Task extends HealthcareBaseEntity {
  /** The current status of the task. */
  status: TaskStatus;

  /** An explanation as to why this task is held, failed, was refused, etc. */
  statusReason?: CodeableConcept;

  /** Contains business-specific nuances of the business state. */
  businessStatus?: CodeableConcept;

  /** Indicates the action that is being requested, not the intent of the requester. */
  intent: TaskIntent;

  /** Indicates how quickly the Task should be addressed with respect to other requests. */
  priority?: TaskPriority;

  /** A name or code (or both) briefly describing what the task involves. */
  code?: CodeableConcept;

  /** A free-text description of what is to be performed. */
  description?: string;

  /** The request being actioned or the resource being manipulated by this task. */
  focus?: Reference;

  /** The entity who benefits from the performance of the service specified in the task (e.g. the patient). */
  `for`?: Reference;

  /** The healthcare event (e.g. a patient and healthcare provider interaction) during which this task was created. */
  encounter?: Reference;

  /** Identifies the time action was first taken against the task (start) and/or the time final action was taken against the task prior to marking it as completed (end). */
  executionPeriod?: Period;

  /** The date and time this task was created. */
  authoredOn?: utcDateTime;

  /** The date and time of last modification to this task. */
  lastModified?: utcDateTime;

  /** The creator of the task. */
  requester?: Reference;

  /** The kind of participant that should perform the task. */
  performerType?: CodeableConcept[];

  /** Individual organization or Device currently responsible for task execution. */
  owner?: Reference;

  /** Principal physical location where the this task is performed. */
  location?: Reference;

  /** A description or code indicating why this task needs to be performed. */
  reasonCode?: CodeableConcept;

  /** A resource reference indicating why this task needs to be performed. */
  reasonReference?: Reference;

  /** Insurance plans, coverage extensions, pre-authorizations and/or pre-determinations that may be relevant to the Task. */
  insurance?: Reference[];

  /** Free-text information captured about the task as it progresses. */
  note?: Annotation[];

  /** If the Task.focus is a request resource and the task is seeking fulfillment (i.e. is asking for the current task to be actioned), this element identifies any limitations on what parts of the referenced request should be actioned. */
  restriction?: TaskRestriction;

  /** Additional information that may be needed in the execution of the task. */
  input?: TaskParameter[];

  /** Outputs produced by the Task. */
  output?: TaskParameter[];
}

// ---------------------------------------------------------------------------
// Status transition
// ---------------------------------------------------------------------------

/** Request body for transitioning a task to a new status. */
model TaskStatusTransitionRequest {
  /** The target status for this transition. */
  status: TaskStatus;

  /** An explanation for the status transition. */
  statusReason?: CodeableConcept;

  /** Business-specific nuance of the new status. */
  businessStatus?: CodeableConcept;

  /** Free-text note about the transition. */
  note?: string;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

/** Query parameters for searching Task resources. */
model TaskSearchParams {
  /** Filter by task status. */
  @query status?: string;

  /** Filter by task intent. */
  @query intent?: string;

  /** Filter by task priority. */
  @query priority?: string;

  /** Filter by owner reference id. */
  @query owner?: string;

  /** Filter by requester reference id. */
  @query requester?: string;

  /** Filter by patient (for) reference id. */
  @query patient?: string;

  /** Filter by task code. */
  @query code?: string;

  /** Page number (1-based). */
  @query page?: int32;

  /** Number of results per page. */
  @query pageSize?: int32;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * CRUD, status transitions, and search operations for Task resources.
 */
@tag("Healthcare:Support")
@useAuth(bearerAuth)
interface TaskManagement {
  /** Create a new Task. */
  @post
  @operationId("createTask")
  create(
    @body body: Task,
  ): {
    @statusCode statusCode: 201;
    @body task: Task;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Retrieve a single Task by id. */
  @get
  @operationId("getTask")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body task: Task;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Replace an existing Task. */
  @put
  @operationId("updateTask")
  @route("/{id}")
  update(
    @path id: string,
    @body body: Task,
  ): {
    @statusCode statusCode: 200;
    @body task: Task;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Partially update a Task. */
  @patch
  @operationId("patchTask")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body task: Task;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Delete a Task by id. */
  @delete
  @operationId("deleteTask")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Transition a Task to a new status. */
  @post
  @operationId("transitionTaskStatus")
  @route("/{id}/status")
  transitionStatus(
    @path id: string,
    @body body: TaskStatusTransitionRequest,
  ): {
    @statusCode statusCode: 200;
    @body task: Task;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  /** Search for Tasks using filter parameters. */
  @get
  @operationId("searchTasks")
  @route("/search")
  search(
    ...TaskSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Task>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
