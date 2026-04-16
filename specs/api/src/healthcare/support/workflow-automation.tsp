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
 * Workflow Automation module.
 *
 * Provides event-driven workflow automation for healthcare operations through
 * configurable rules, condition evaluation, and action execution. Supports
 * task queuing, notification dispatch, field updates, webhook calls, and
 * audit event generation. Includes safeguards against runaway automation
 * through configurable chain depth limits. Task queue management enables
 * role-based and department-based work distribution.
 */
namespace Healthcare.Support.WorkflowAutomation;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Type of automated action to be executed when a workflow rule triggers.")
enum WorkflowActionType {
  @doc("Create a task and assign it to a user, role, or queue")
  createTask,

  @doc("Send an in-application notification to specified recipients")
  sendNotification,

  @doc("Send a transactional email to specified recipients")
  sendEmail,

  @doc("Update a field on the triggering resource or a related resource")
  updateField,

  @doc("Make an outbound HTTP call to an external endpoint")
  callWebhook,

  @doc("Create a structured audit log event for compliance or reporting purposes")
  createAuditEvent,

  @doc("Place a task into a named work queue for team-based processing")
  assignToQueue,
}

@doc("Comparison operator used in a workflow condition to evaluate a field value.")
enum WorkflowConditionOperator {
  @doc("The field value exactly equals the specified value")
  equals,

  @doc("The field value does not equal the specified value")
  notEquals,

  @doc("The numeric or date field value is greater than the specified value")
  greaterThan,

  @doc("The numeric or date field value is less than the specified value")
  lessThan,

  @doc("The string or array field contains the specified substring or element")
  contains,

  @doc("The field value is one of the values in the specified set (comma-separated)")
  in,

  @doc("The field is present and non-null on the resource")
  exists,
}

@doc("Execution status of a workflow rule invocation.")
enum ExecutionStatus {
  @doc("The execution has been queued but has not yet started")
  pending,

  @doc("The execution is currently in progress — actions are being evaluated and run")
  running,

  @doc("All actions executed successfully")
  completed,

  @doc("One or more actions failed during execution")
  failed,

  @doc("The execution was skipped because conditions were not met at evaluation time")
  skipped,
}

@doc("Status of an item in a task queue.")
enum QueueItemStatus {
  @doc("The item is in the queue and has not been claimed by any worker")
  waiting,

  @doc("The item has been claimed by a worker but work has not formally started")
  claimed,

  @doc("Work on this item is actively in progress")
  inProgress,

  @doc("The item has been successfully processed and is complete")
  completed,

  @doc("The item was returned to the queue by the worker — available for re-claiming")
  returned,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("A single condition evaluated against the triggering event payload to determine whether a workflow rule should fire.")
model WorkflowCondition {
  @doc("JSON path or field name to evaluate on the trigger event payload (e.g., 'status', 'patient.age', 'priority')")
  field: string;

  @doc("Comparison operator to apply when evaluating this condition")
  operator: WorkflowConditionOperator;

  @doc("Value to compare against — serialized as a string regardless of the underlying data type")
  value: string;
}

@doc("A single automated action to be executed when the parent workflow rule's conditions are satisfied.")
model WorkflowAction {
  @doc("Type of action to execute")
  type: WorkflowActionType;

  @doc("Action-specific configuration parameters (e.g., recipient addresses, webhook URL, field name and value, queue name)")
  configuration: Record<unknown>;

  @doc("Number of minutes to wait before executing this action — enables delayed notifications or follow-up tasks")
  delayMinutes?: int32;
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A workflow rule defining the trigger event, evaluation conditions, and automated actions to execute when those conditions are satisfied.")
model WorkflowRule extends HealthcareBaseEntity {
  @doc("Human-readable name for this workflow rule")
  name: string;

  @doc("Optional description explaining the business purpose of this rule")
  description?: string;

  @doc("Domain event that activates evaluation of this rule — in the format 'domain.entity.action' (e.g., 'clinical.encounter.statusChanged', 'admin.appointment.created')")
  triggerEvent: string;

  @doc("List of conditions that must all evaluate to true for the rule to fire — conditions are ANDed together")
  conditions: WorkflowCondition[];

  @doc("Ordered list of actions to execute when conditions are met — executed in sequence")
  actions: WorkflowAction[];

  @doc("Whether this rule is currently enabled and will be evaluated on matching events")
  enabled: boolean;

  @doc("Priority of this rule relative to other rules triggered by the same event — lower numbers execute first")
  priority: int32;

  @doc("Maximum number of chained rule executions allowed starting from this rule — prevents infinite loops (default: 3)")
  maxChainDepth?: int32;

  @doc("Reference to the Organization this rule applies to — if omitted, the rule applies system-wide")
  organization?: Reference;

}

@doc("A record of a single execution of a workflow rule triggered by a domain event.")
model WorkflowExecution extends HealthcareBaseEntity {
  @doc("Reference to the WorkflowRule that was executed")
  rule: Reference;

  @doc("Unique identifier of the domain event that triggered this execution")
  triggerEventId: string;

  @doc("Current status of this execution")
  status: ExecutionStatus;

  @doc("Date and time execution began")
  startedAt: utcDateTime;

  @doc("Date and time execution completed or failed")
  completedAt?: utcDateTime;

  @doc("Number of actions that executed successfully")
  actionsExecuted: int32;

  @doc("Number of actions that failed during execution")
  actionsFailed: int32;

  @doc("Error message or stack trace if the execution failed")
  error?: string;

  @doc("Current chain depth — tracks how many workflow executions have been triggered transitively from the originating event")
  chainDepth: int32;
}

@doc("A named work queue for distributing tasks to a role or department for team-based processing.")
model TaskQueue extends HealthcareBaseEntity {
  @doc("Human-readable name of the queue (e.g., 'Prior Authorization Review', 'Coding Queue', 'Nurse Triage')")
  name: string;

  @doc("Optional description of the queue's purpose and processing expectations")
  description?: string;

  @doc("Role identifier that is authorized to claim and process items from this queue")
  assignedRole?: string;

  @doc("Reference to the department responsible for this queue")
  department?: Reference;

  @doc("Maximum number of items permitted in this queue simultaneously — enforces capacity limits")
  maxItems?: int32;

  @doc("Whether this queue is currently active and accepting new items")
  active: boolean;
}

@doc("An item in a task queue representing a task waiting to be claimed and processed by a queue worker.")
model TaskQueueItem extends HealthcareBaseEntity {
  @doc("Reference to the TaskQueue this item belongs to")
  queue: Reference;

  @doc("Reference to the Task resource this queue item represents")
  task: Reference;

  @doc("Ordinal position of this item in the queue — used for priority ordering within the queue")
  position: int32;

  @doc("Reference to the staff member who has claimed this item for processing")
  assignedTo?: Reference;

  @doc("Date and time the item was claimed from the queue")
  claimedAt?: utcDateTime;

  @doc("Date and time the item was completed and removed from active processing")
  completedAt?: utcDateTime;

  @doc("Current status of this queue item")
  status: QueueItemStatus;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for workflow rules.")
model WorkflowRuleSearchParams {
  @doc("Filter by trigger event name (exact or prefix match)") @query triggerEvent?: string;
  @doc("Filter by enabled status") @query enabled?: boolean;
  @doc("Filter by organization reference ID") @query organization?: string;
  @doc("Filter by creator reference ID") @query createdBy?: string;
  @doc("Free-text search on rule name") @query name?: string;
  ...OffsetPaginationParams;
}

@doc("Search parameters for workflow executions.")
model WorkflowExecutionSearchParams {
  @doc("Filter by rule reference ID") @query rule?: string;
  @doc("Filter by execution status") @query status?: ExecutionStatus;
  @doc("Filter by trigger event ID") @query triggerEventId?: string;
  @doc("Filter executions started on or after this date") @query startedFrom?: utcDateTime;
  @doc("Filter executions started on or before this date") @query startedTo?: utcDateTime;
  @doc("Filter by chain depth") @query chainDepth?: int32;
  ...OffsetPaginationParams;
}

@doc("Search parameters for task queues.")
model TaskQueueSearchParams {
  @doc("Filter by assigned role") @query assignedRole?: string;
  @doc("Filter by department reference ID") @query department?: string;
  @doc("Filter by active status") @query active?: boolean;
  @doc("Free-text search on queue name") @query name?: string;
  ...OffsetPaginationParams;
}

@doc("Search parameters for task queue items.")
model TaskQueueItemSearchParams {
  @doc("Filter by queue reference ID") @query queue?: string;
  @doc("Filter by task reference ID") @query task?: string;
  @doc("Filter by assigned worker reference ID") @query assignedTo?: string;
  @doc("Filter by queue item status") @query status?: QueueItemStatus;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Supporting request models
// ---------------------------------------------------------------------------

@doc("Request body for testing a workflow rule against a sample event payload without executing real actions.")
model WorkflowRuleTestRequest {
  @doc("Simulated trigger event payload to evaluate this rule against")
  eventPayload: Record<unknown>;

  @doc("Whether to perform a dry run — conditions are evaluated and matched actions are returned but not executed")
  dryRun: boolean;
}

@doc("Response body for a workflow rule test run.")
model WorkflowRuleTestResult {
  @doc("Whether all conditions evaluated to true for the provided payload")
  conditionsMet: boolean;

  @doc("List of actions that would be executed if this were a real event")
  actionsToExecute: WorkflowAction[];

  @doc("Detailed condition evaluation results for debugging")
  conditionResults: WorkflowConditionResult[];
}

@doc("Result of evaluating a single condition in a rule test.")
model WorkflowConditionResult {
  @doc("Field path that was evaluated")
  field: string;

  @doc("Operator that was applied")
  operator: WorkflowConditionOperator;

  @doc("Expected value from the rule definition")
  expectedValue: string;

  @doc("Actual value found in the event payload")
  actualValue?: string;

  @doc("Whether this specific condition evaluated to true")
  passed: boolean;
}

@doc("Request body for claiming a task queue item.")
model QueueItemClaimRequest {
  @doc("Reference to the staff member claiming this queue item")
  assignedTo: Reference;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Workflow rule management — create, manage, enable, disable, and test event-driven automation rules.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
@route("/workflow/rules")
interface WorkflowRuleManagement {
  @doc("Create a new workflow automation rule.")
  @operationId("createWorkflowRule")
  @extension("x-security-required-roles", #["admin", "clinician", "scheduler"])
  @post
  createWorkflowRule(
    @body body: WorkflowRule,
  ): {
    @statusCode statusCode: 201;
    @body result: WorkflowRule;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a workflow rule by its logical ID.")
  @operationId("getWorkflowRule")
  @extension("x-security-required-roles", #["admin", "clinician", "scheduler"])
  @get
  @route("/{id}")
  getWorkflowRule(
    @path @doc("WorkflowRule logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: WorkflowRule;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a workflow rule — trigger event, conditions, actions, priority, or chain depth limit.")
  @operationId("updateWorkflowRule")
  @extension("x-security-required-roles", #["admin", "clinician", "scheduler"])
  @put
  @route("/{id}")
  updateWorkflowRule(
    @path @doc("WorkflowRule logical ID") id: UUID,
    @body body: WorkflowRule,
  ): {
    @statusCode statusCode: 200;
    @body result: WorkflowRule;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a workflow rule.")
  @operationId("deleteWorkflowRule")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteWorkflowRule(
    @path @doc("WorkflowRule logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search workflow rules by trigger event, enabled status, organization, or creator.")
  @operationId("searchWorkflowRules")
  @extension("x-security-required-roles", #["admin", "clinician", "scheduler"])
  @get
  @route("/search")
  searchWorkflowRules(
    ...WorkflowRuleSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<WorkflowRule>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Enable a workflow rule — sets enabled to true so the rule will be evaluated on matching events.")
  @operationId("enableWorkflowRule")
  @extension("x-security-required-roles", #["admin", "clinician", "scheduler"])
  @post
  @route("/{id}/enable")
  enableWorkflowRule(
    @path @doc("WorkflowRule logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: WorkflowRule;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Disable a workflow rule — sets enabled to false so the rule will not fire on future events.")
  @operationId("disableWorkflowRule")
  @extension("x-security-required-roles", #["admin", "clinician", "scheduler"])
  @post
  @route("/{id}/disable")
  disableWorkflowRule(
    @path @doc("WorkflowRule logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: WorkflowRule;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Test a workflow rule against a sample event payload — evaluates conditions and returns matched actions without executing them.")
  @operationId("testWorkflowRule")
  @extension("x-security-required-roles", #["admin", "clinician", "scheduler"])
  @post
  @route("/{id}/test")
  testWorkflowRule(
    @path @doc("WorkflowRule logical ID") id: UUID,
    @body body: WorkflowRuleTestRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: WorkflowRuleTestResult;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Workflow execution management — query execution history and diagnose automation failures.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
@route("/workflow/executions")
interface WorkflowExecutionManagement {
  @doc("Search workflow executions by rule, status, trigger event ID, or date range.")
  @operationId("searchWorkflowExecutions")
  @extension("x-security-required-roles", #["admin", "clinician", "scheduler"])
  @get
  @route("/search")
  searchWorkflowExecutions(
    ...WorkflowExecutionSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<WorkflowExecution>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve all executions for a specific workflow rule — useful for auditing rule performance and failure rates.")
  @operationId("getExecutionsByRule")
  @extension("x-security-required-roles", #["admin", "clinician", "scheduler"])
  @get
  @route("/by-rule/{ruleId}")
  getExecutionsByRule(
    @path @doc("WorkflowRule logical ID") ruleId: UUID,
    ...OffsetPaginationParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<WorkflowExecution>;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Task queue management — configure named queues for role-based and department-based work distribution.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
@route("/workflow/queues")
interface TaskQueueManagement {
  @doc("Create a new task queue.")
  @operationId("createTaskQueue")
  @extension("x-security-required-roles", #["admin", "clinician", "scheduler"])
  @post
  createTaskQueue(
    @body body: TaskQueue,
  ): {
    @statusCode statusCode: 201;
    @body result: TaskQueue;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a task queue by its logical ID.")
  @operationId("getTaskQueue")
  @extension("x-security-required-roles", #["admin", "clinician", "scheduler"])
  @get
  @route("/{id}")
  getTaskQueue(
    @path @doc("TaskQueue logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: TaskQueue;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a task queue — name, assigned role, department, capacity limit, or active status.")
  @operationId("updateTaskQueue")
  @extension("x-security-required-roles", #["admin", "clinician", "scheduler"])
  @put
  @route("/{id}")
  updateTaskQueue(
    @path @doc("TaskQueue logical ID") id: UUID,
    @body body: TaskQueue,
  ): {
    @statusCode statusCode: 200;
    @body result: TaskQueue;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a task queue.")
  @operationId("deleteTaskQueue")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteTaskQueue(
    @path @doc("TaskQueue logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search task queues by role, department, or active status.")
  @operationId("searchTaskQueues")
  @extension("x-security-required-roles", #["admin", "clinician", "scheduler"])
  @get
  @route("/search")
  searchTaskQueues(
    ...TaskQueueSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<TaskQueue>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Task queue item management — claim, process, complete, and return work items within task queues.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
@route("/workflow/queue-items")
interface TaskQueueItemManagement {
  @doc("Claim a queue item — assigns it to the requesting worker and marks it as claimed.")
  @operationId("claimTaskQueueItem")
  @extension("x-security-required-roles", #["admin", "clinician", "scheduler"])
  @post
  @route("/{id}/claim")
  claimTaskQueueItem(
    @path @doc("TaskQueueItem logical ID") id: UUID,
    @body body: QueueItemClaimRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: TaskQueueItem;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Complete a queue item — marks processing as finished and removes the item from active work.")
  @operationId("completeTaskQueueItem")
  @extension("x-security-required-roles", #["admin", "clinician", "scheduler"])
  @post
  @route("/{id}/complete")
  completeTaskQueueItem(
    @path @doc("TaskQueueItem logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: TaskQueueItem;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Return a queue item — releases the claim and places the item back in waiting status for another worker to claim.")
  @operationId("returnTaskQueueItem")
  @extension("x-security-required-roles", #["admin", "clinician", "scheduler"])
  @post
  @route("/{id}/return")
  returnTaskQueueItem(
    @path @doc("TaskQueueItem logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: TaskQueueItem;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search task queue items by queue, task, assigned worker, or status.")
  @operationId("searchTaskQueueItems")
  @extension("x-security-required-roles", #["admin", "clinician", "scheduler"])
  @get
  @route("/search")
  searchTaskQueueItems(
    ...TaskQueueItemSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<TaskQueueItem>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
