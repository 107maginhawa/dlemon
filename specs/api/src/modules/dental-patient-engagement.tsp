import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/pagination.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Dental Patient Engagement Module (TR-DG-002 migration)
 *
 * Patient-scoped engagement sub-resources that were formerly hand-registered in
 * app.ts and are now emitted via TypeSpec codegen. Four feature groups, all
 * nested under `/dental/patients/{patientId}`:
 *   - contacts        (guardians / emergency contacts) — PAT-BR-002
 *   - recalls         (recall scheduling)              — P0-B
 *   - dental-alerts   (chairside clinical alerts)      — P2-001
 *   - tasks           (patient task tracking)          — P2-003
 *
 * RBAC is membership-based and enforced in-handler; the Better-Auth role is
 * always `user`. Routes emit via the interfaces re-declared in main.tsp (the
 * base `@route`/`@tag` live there); operations below carry only relative
 * sub-routes. operationId on each op equals the exported handler function name.
 */
namespace DentalPatientEngagementModule {
  // ==========================================================================
  // Patient Contacts (guardians / emergency contacts)
  // ==========================================================================

  @doc("A patient contact — guardian and/or emergency contact")
  model PatientContact extends BaseEntity {
    @doc("Patient this contact belongs to")
    patientId: UUID;

    @doc("Contact full name")
    name: string;

    @doc("Relationship to the patient")
    relationship: string | null;

    @doc("Contact phone number")
    phone: string | null;

    @doc("Contact email address")
    email: string | null;

    @doc("True if this contact is a legal guardian")
    isGuardian: boolean;

    @doc("True if this contact is an emergency contact")
    isEmergencyContact: boolean;

    @doc("Free-text notes")
    notes: string | null;

    @doc("Soft-delete timestamp (ISO 8601 UTC); null if active")
    deletedAt: utcDateTime | null;
  }

  @doc("Body to create a patient contact")
  model CreatePatientContactRequest {
    @doc("Contact full name (required, non-blank)")
    name: string;

    @doc("Relationship to the patient")
    relationship?: string;

    @doc("Contact phone number")
    phone?: string;

    @doc("Contact email address")
    email?: string;

    @doc("True if this contact is a legal guardian (defaults to false)")
    isGuardian?: boolean;

    @doc("True if this contact is an emergency contact (defaults to false)")
    isEmergencyContact?: boolean;

    @doc("Free-text notes")
    notes?: string;
  }

  @doc("Body to update a patient contact (at least one field required)")
  model UpdatePatientContactRequest {
    @doc("Contact full name (non-blank)")
    name?: string;

    @doc("Relationship to the patient")
    relationship?: string | null;

    @doc("Contact phone number")
    phone?: string | null;

    @doc("Contact email address")
    email?: string | null;

    @doc("True if this contact is a legal guardian")
    isGuardian?: boolean;

    @doc("True if this contact is an emergency contact")
    isEmergencyContact?: boolean;

    @doc("Free-text notes")
    notes?: string | null;
  }

  @doc("Patient contact / guardian management (PAT-BR-002)")
  interface PatientContactManagement {
    @doc("Create a contact for a patient")
    @operationId("createPatientContact")
    @post
    @route("/{patientId}/contacts")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createPatientContact(
      @path patientId: UUID,
      @body body: CreatePatientContactRequest,
    ):
      | ApiCreatedResponse<PatientContact>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("List a patient's contacts")
    @operationId("listPatientContacts")
    @get
    @route("/{patientId}/contacts")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listPatientContacts(@path patientId: UUID):
      | ApiOkResponse<PatientContact[]>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Update a patient contact")
    @operationId("updatePatientContact")
    @patch
    @route("/{patientId}/contacts/{contactId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    updatePatientContact(
      @path patientId: UUID,
      @path contactId: UUID,
      @body body: UpdatePatientContactRequest,
    ):
      | ApiOkResponse<PatientContact>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Soft-delete a patient contact")
    @operationId("deletePatientContact")
    @delete
    @route("/{patientId}/contacts/{contactId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    deletePatientContact(@path patientId: UUID, @path contactId: UUID):
      | ApiNoContentResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }

  // ==========================================================================
  // Recalls
  // ==========================================================================

  @doc("Type of recall")
  enum RecallType {
    cleaning: "cleaning",
    checkup: "checkup",
    treatment: "treatment",
    other: "other",
  }

  @doc("Lifecycle status of a recall")
  enum RecallStatus {
    pending: "pending",
    sent: "sent",
    completed: "completed",
    cancelled: "cancelled",
  }

  @doc("A patient recall record")
  model Recall extends BaseEntity {
    @doc("Patient this recall belongs to")
    patientId: UUID;

    @doc("Recall type")
    type: RecallType;

    @doc("Due date (YYYY-MM-DD)")
    dueDate: string;

    @doc("Current lifecycle status")
    status: RecallStatus;

    @doc("Free-text notes")
    notes: string | null;

    @doc("P1-24: recurrence interval in months (drives auto-recompute + next-cycle seeding); null = one-off")
    intervalMonths: int32 | null;

    @doc("When the recall was sent (ISO 8601 UTC)")
    sentAt: utcDateTime | null;

    @doc("P1-24: when the most recent outreach was dispatched (re-attempt cadence)")
    lastSentAt: utcDateTime | null;

    @doc("P1-24: number of outreach attempts made")
    sendAttempts: int32;

    @doc("When the recall was completed (ISO 8601 UTC)")
    completedAt: utcDateTime | null;
  }

  @doc("Body to create a recall")
  model CreateRecallRequest {
    @doc("Recall type")
    type: RecallType;

    @doc("Due date (YYYY-MM-DD)")
    dueDate: string;

    @doc("P1-24: recurrence interval in months (e.g. cleaning = 6)")
    intervalMonths?: int32;

    @doc("Free-text notes")
    notes?: string;
  }

  @doc("Body to update a recall (at least one field required)")
  model UpdateRecallRequest {
    @doc("Recall type")
    type?: RecallType;

    @doc("Due date (YYYY-MM-DD)")
    dueDate?: string;

    @doc("P1-24: recurrence interval in months")
    intervalMonths?: int32;

    @doc("Current lifecycle status")
    status?: RecallStatus;

    @doc("Free-text notes")
    notes?: string;
  }

  @doc("P1-24: a due recall enriched with patient identity for the front-desk recare list")
  model RecallDueItem {
    @doc("Recall id")
    id: UUID;

    @doc("Patient this recall belongs to")
    patientId: UUID;

    @doc("Patient display name")
    patientName: string;

    @doc("Recall type")
    type: RecallType;

    @doc("Due date (YYYY-MM-DD)")
    dueDate: string;

    @doc("Current lifecycle status")
    status: RecallStatus;

    @doc("Recurrence interval in months; null = one-off")
    intervalMonths: int32 | null;

    @doc("Number of outreach attempts made")
    sendAttempts: int32;

    @doc("When the most recent outreach was dispatched (ISO 8601 UTC)")
    lastSentAt: utcDateTime | null;
  }

  @doc("Patient recall management (P0-B)")
  interface RecallManagement {
    @doc("Create a recall for a patient")
    @operationId("createRecall")
    @post
    @route("/{patientId}/recalls")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createRecall(@path patientId: UUID, @body body: CreateRecallRequest):
      | ApiCreatedResponse<Recall>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("List a patient's recalls")
    @operationId("listPatientRecalls")
    @get
    @route("/{patientId}/recalls")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listPatientRecalls(@path patientId: UUID):
      | ApiOkResponse<Recall[]>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Update a recall")
    @operationId("updateRecall")
    @patch
    @route("/{patientId}/recalls/{recallId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    updateRecall(
      @path patientId: UUID,
      @path recallId: UUID,
      @body body: UpdateRecallRequest,
    ):
      | ApiOkResponse<Recall>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }

  @doc("P1-24: recare due-list — branch-scoped continuing-care queue for the front desk")
  interface RecallDueListManagement {
    @doc("List recalls that are due (pending/sent, dueDate within window) for a branch")
    @operationId("listDueRecalls")
    @get
    @route("/due")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listDueRecalls(
      @query branchId: UUID,
      @query("from") from?: string,
      @query("to") to?: string,
      @query @minValue(1) page?: int32,
      @query("per_page") @minValue(1) @maxValue(200) perPage?: int32,
    ):
      | ApiOkResponse<RecallDueItem[]>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ErrorResponse;
  }

  // ==========================================================================
  // Dental Alerts
  // ==========================================================================

  @doc("Type of chairside dental alert")
  enum DentalAlertType {
    gag_reflex: "gag_reflex",
    latex_allergy: "latex_allergy",
    needle_phobia: "needle_phobia",
    dental_anxiety: "dental_anxiety",
    tmj_disorder: "tmj_disorder",
    excessive_salivation: "excessive_salivation",
    dry_socket_history: "dry_socket_history",
    bisphosphonate_use: "bisphosphonate_use",
    bleeding_disorder: "bleeding_disorder",
    other: "other",
  }

  @doc("Severity of a dental alert")
  enum DentalAlertSeverity {
    low: "low",
    medium: "medium",
    high: "high",
  }

  @doc("A chairside dental alert")
  model DentalAlert extends BaseEntity {
    @doc("Patient this alert belongs to")
    patientId: UUID;

    @doc("Alert type")
    alertType: DentalAlertType;

    @doc("Alert severity (defaults to medium)")
    severity: DentalAlertSeverity;

    @doc("Free-text description")
    description: string | null;

    @doc("Whether the alert is active")
    active: boolean;
  }

  @doc("Body to create a dental alert")
  model CreateDentalAlertRequest {
    @doc("Alert type")
    alertType: DentalAlertType;

    @doc("Alert severity (defaults to medium)")
    severity?: DentalAlertSeverity;

    @doc("Free-text description")
    description?: string;
  }

  @doc("Body to update a dental alert (at least one field required)")
  model UpdateDentalAlertRequest {
    @doc("Alert type")
    alertType?: DentalAlertType;

    @doc("Alert severity")
    severity?: DentalAlertSeverity;

    @doc("Free-text description")
    description?: string;

    @doc("Whether the alert is active")
    active?: boolean;
  }

  @doc("Dental alert management (P2-001)")
  interface DentalAlertManagement {
    @doc("Create a dental alert for a patient")
    @operationId("createDentalAlert")
    @post
    @route("/{patientId}/dental-alerts")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createDentalAlert(
      @path patientId: UUID,
      @body body: CreateDentalAlertRequest,
    ):
      | ApiCreatedResponse<DentalAlert>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("List a patient's dental alerts")
    @operationId("listDentalAlerts")
    @get
    @route("/{patientId}/dental-alerts")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listDentalAlerts(@path patientId: UUID):
      | ApiOkResponse<DentalAlert[]>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Update a dental alert")
    @operationId("updateDentalAlert")
    @patch
    @route("/{patientId}/dental-alerts/{alertId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    updateDentalAlert(
      @path patientId: UUID,
      @path alertId: UUID,
      @body body: UpdateDentalAlertRequest,
    ):
      | ApiOkResponse<DentalAlert>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }

  // ==========================================================================
  // Patient Tasks
  // ==========================================================================

  @doc("Type of patient task")
  enum TaskType {
    follow_up: "follow_up",
    lab_order: "lab_order",
    referral: "referral",
    prescription: "prescription",
    other: "other",
  }

  @doc("Lifecycle status of a patient task")
  enum TaskStatus {
    open: "open",
    in_progress: "in_progress",
    done: "done",
    cancelled: "cancelled",
  }

  @doc("A patient task record")
  model PatientTask extends BaseEntity {
    @doc("Patient this task belongs to")
    patientId: UUID;

    @doc("Task title")
    title: string;

    @doc("Free-text description")
    description: string | null;

    @doc("Task type")
    taskType: TaskType;

    @doc("Current lifecycle status")
    status: TaskStatus;

    @doc("Due date (YYYY-MM-DD)")
    dueDate: string | null;

    @doc("Person assigned to the task")
    assignedTo: UUID | null;

    @doc("When the task was completed (ISO 8601 UTC)")
    completedAt: utcDateTime | null;
  }

  @doc("Body to create a patient task")
  model CreateTaskRequest {
    @doc("Task title (required, non-blank)")
    title: string;

    @doc("Task type")
    taskType: TaskType;

    @doc("Free-text description")
    description?: string;

    @doc("Due date (YYYY-MM-DD)")
    dueDate?: string;

    @doc("Person assigned to the task")
    assignedTo?: UUID;
  }

  @doc("Body to update a patient task (at least one field required)")
  model UpdateTaskRequest {
    @doc("Task title (non-blank)")
    title?: string;

    @doc("Task type")
    taskType?: TaskType;

    @doc("Free-text description")
    description?: string;

    @doc("Due date (YYYY-MM-DD)")
    dueDate?: string;

    @doc("Person assigned to the task")
    assignedTo?: UUID;

    @doc("Current lifecycle status")
    status?: TaskStatus;
  }

  @doc("Patient task management (P2-003)")
  interface PatientTaskManagement {
    @doc("Create a task for a patient")
    @operationId("createTask")
    @post
    @route("/{patientId}/tasks")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createTask(@path patientId: UUID, @body body: CreateTaskRequest):
      | ApiCreatedResponse<PatientTask>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("List a patient's tasks")
    @operationId("listPatientTasks")
    @get
    @route("/{patientId}/tasks")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listPatientTasks(@path patientId: UUID):
      | ApiOkResponse<PatientTask[]>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Update a patient task")
    @operationId("updateTask")
    @patch
    @route("/{patientId}/tasks/{taskId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    updateTask(
      @path patientId: UUID,
      @path taskId: UUID,
      @body body: UpdateTaskRequest,
    ):
      | ApiOkResponse<PatientTask>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;
  }
}
