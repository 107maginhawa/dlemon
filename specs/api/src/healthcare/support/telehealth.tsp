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
 * Healthcare Support Telehealth — virtual care delivery management including
 * synchronous video and audio consultations, asynchronous store-and-forward
 * consultations, and remote patient monitoring enrolments with configurable
 * alert thresholds.
 */
namespace Healthcare.Support.Telehealth;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The lifecycle status of a telehealth session.")
enum TelehealthStatus {
  @doc("The session has been booked but has not yet started")
  scheduled,

  @doc("The patient has joined and is waiting in the virtual waiting room")
  waiting,

  @doc("The session is actively underway between provider and patient")
  inProgress,

  @doc("The session has concluded successfully")
  completed,

  @doc("The session was cancelled before commencement")
  cancelled,

  @doc("The patient did not attend the scheduled session")
  noShow,

  @doc("The session could not proceed due to a technical failure")
  technicalFailure,
}

@doc("The modality of the telehealth session.")
enum TelehealthSessionType {
  @doc("Real-time video consultation between patient and provider")
  synchronousVideo,

  @doc("Real-time audio-only consultation between patient and provider")
  synchronousAudio,

  @doc("Store-and-forward asynchronous consultation — patient submits information for later review")
  asynchronous,

  @doc("Ongoing remote physiological monitoring of the patient")
  remoteMonitoring,
}

@doc("The lifecycle status of an asynchronous consultation request.")
enum AsyncStatus {
  @doc("The patient has submitted the consultation request")
  submitted,

  @doc("A provider has accepted the request and is reviewing the clinical information")
  inReview,

  @doc("The provider has submitted a clinical response to the patient's request")
  responded,

  @doc("The consultation has been escalated to a synchronous appointment")
  escalatedToSync,

  @doc("The consultation has been closed with no further action required")
  closed,
}

@doc("The enrolment status of a remote monitoring programme.")
enum EnrollmentStatus {
  @doc("The patient is actively enrolled and being monitored")
  active,

  @doc("Monitoring has been temporarily suspended")
  paused,

  @doc("The monitoring programme has concluded as planned")
  completed,

  @doc("The patient has withdrawn from the monitoring programme")
  withdrawn,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("A clinical parameter to be monitored remotely, including frequency and target range.")
model MonitoringParameter {
  @doc("The clinical code identifying the parameter (e.g., blood pressure, SpO2, blood glucose)")
  code: CodeableConcept;

  @doc("How frequently the parameter should be measured (e.g., 'twice daily', 'every 4 hours')")
  @maxLength(100)
  frequency: string;

  @doc("The clinically acceptable target range for this parameter")
  targetRange?: Range;
}

@doc("A threshold definition that triggers an alert when a monitored parameter crosses a specified boundary.")
model AlertThreshold {
  @doc("The clinical code identifying the monitored parameter this threshold applies to")
  parameter: CodeableConcept;

  @doc("The comparison operator (e.g., 'gt', 'lt', 'gte', 'lte', 'eq')")
  @maxLength(10)
  operator: string;

  @doc("The numeric threshold value that, when crossed, triggers an alert")
  value: float64;

  @doc("The clinical severity of the alert when this threshold is breached (e.g., info, warning, critical)")
  @maxLength(50)
  severity: string;
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

@doc("A telehealth session record tracking the lifecycle of a virtual care consultation.")
model TelehealthSession extends HealthcareBaseEntity {
  @doc("The patient participating in this telehealth session")
  patient: Reference;

  @doc("The healthcare provider conducting this session")
  provider: Reference;

  @doc("The clinical encounter associated with this session, if one has been created")
  encounter?: Reference;

  @doc("The date and time the session is scheduled to begin")
  scheduledAt?: utcDateTime;

  @doc("The date and time the session actually started")
  startedAt?: utcDateTime;

  @doc("The date and time the session concluded")
  endedAt?: utcDateTime;

  @doc("The current lifecycle status of the session")
  status: TelehealthStatus;

  @doc("The modality of the telehealth session")
  sessionType: TelehealthSessionType;

  @doc("The video or virtual care platform used for this session (e.g., Zoom, Teams, proprietary)")
  @maxLength(100)
  platform?: string;

  @doc("The URL for the patient or provider to join the virtual session")
  @maxLength(2048)
  meetingUrl?: string;

  @doc("Whether informed consent for telehealth was obtained from the patient prior to the session")
  consentObtained: boolean;

  @doc("Description of any technical issues encountered during the session")
  @maxLength(500)
  technicalIssues?: string;

  @doc("Additional clinical annotations about the session")
  note?: Annotation[];
}

@doc("An asynchronous store-and-forward clinical consultation request submitted by or for a patient.")
model AsyncConsultation extends HealthcareBaseEntity {
  @doc("The patient for whom the consultation is requested")
  patient: Reference;

  @doc("The provider who requested the consultation on the patient's behalf, if applicable")
  requestingProvider?: Reference;

  @doc("The provider who will review and respond to this consultation")
  respondingProvider: Reference;

  @doc("The clinical encounter associated with this consultation, if one exists")
  encounter?: Reference;

  @doc("The current lifecycle status of the asynchronous consultation")
  status: AsyncStatus;

  @doc("The patient's primary reason for the consultation")
  @maxLength(500)
  chiefComplaint: string;

  @doc("Relevant clinical history provided to assist the responding provider")
  @maxLength(5000)
  clinicalHistory?: string;

  @doc("Clinical documents, images, or other attachments submitted with the consultation")
  attachments?: Reference[];

  @doc("The clinical response provided by the responding provider")
  @maxLength(5000)
  response?: string;

  @doc("The date and time the responding provider submitted their response")
  respondedAt?: utcDateTime;

  @doc("The clinical reason for escalating this consultation to a synchronous appointment")
  @maxLength(500)
  escalationReason?: string;
}

@doc("A remote patient monitoring enrolment record linking a patient to monitoring devices, parameters, and alert thresholds.")
model RemoteMonitoringEnrollment extends HealthcareBaseEntity {
  @doc("The patient enrolled in remote monitoring")
  patient: Reference;

  @doc("The responsible provider overseeing the remote monitoring programme")
  provider: Reference;

  @doc("The clinical condition being monitored (e.g., heart failure, hypertension, diabetes)")
  condition: CodeableConcept;

  @doc("The monitoring devices assigned to this patient")
  devices: Reference[];

  @doc("The clinical parameters to be monitored and their required frequency")
  monitoringParameters: MonitoringParameter[];

  @doc("The date on which monitoring begins")
  startDate: plainDate;

  @doc("The planned end date of the monitoring programme, if defined")
  endDate?: plainDate;

  @doc("The current enrolment status of the monitoring programme")
  status: EnrollmentStatus;

  @doc("Alert thresholds that trigger notifications when parameter values cross defined boundaries")
  alertThresholds?: AlertThreshold[];
}

// ---------------------------------------------------------------------------
// Request models
// ---------------------------------------------------------------------------

@doc("Request body for starting a telehealth session, recording the actual start time.")
model StartSessionRequest {
  @doc("The actual date and time the session started (defaults to now if omitted)")
  startedAt?: utcDateTime;

  @doc("The platform URL generated for this session")
  @maxLength(2048)
  meetingUrl?: string;
}

@doc("Request body for ending a telehealth session, recording the completion time and any issues.")
model EndSessionRequest {
  @doc("The date and time the session ended (defaults to now if omitted)")
  endedAt?: utcDateTime;

  @doc("The final status to set on the session (completed, noShow, technicalFailure)")
  status: TelehealthStatus;

  @doc("Description of any technical issues encountered during the session")
  @maxLength(500)
  technicalIssues?: string;
}

@doc("Request body for submitting a clinical response to an asynchronous consultation.")
model AsyncConsultationRespondRequest {
  @doc("The clinical response from the reviewing provider")
  @maxLength(5000)
  response: string;
}

@doc("Request body for escalating an asynchronous consultation to a synchronous appointment.")
model AsyncConsultationEscalateRequest {
  @doc("The clinical reason for escalating to a synchronous session")
  @maxLength(500)
  escalationReason: string;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

@doc("Search parameters for TelehealthSession resources.")
model TelehealthSessionSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by provider reference id")
  @query provider?: string;

  @doc("Filter by session status")
  @query status?: TelehealthStatus;

  @doc("Filter by session type")
  @query sessionType?: TelehealthSessionType;

  @doc("Filter sessions scheduled on or after this date-time")
  @query scheduledFrom?: utcDateTime;

  @doc("Filter sessions scheduled on or before this date-time")
  @query scheduledTo?: utcDateTime;

  ...PaginationQuery;
}

@doc("Search parameters for AsyncConsultation resources.")
model AsyncConsultationSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by responding provider reference id")
  @query respondingProvider?: string;

  @doc("Filter by consultation status")
  @query status?: AsyncStatus;

  @doc("Filter consultations submitted on or after this date-time")
  @query submittedFrom?: utcDateTime;

  @doc("Filter consultations submitted on or before this date-time")
  @query submittedTo?: utcDateTime;

  ...PaginationQuery;
}

@doc("Search parameters for RemoteMonitoringEnrollment resources.")
model RemoteMonitoringSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by provider reference id")
  @query provider?: string;

  @doc("Filter by enrolment status")
  @query status?: EnrollmentStatus;

  @doc("Filter enrolments starting on or after this date")
  @query startFrom?: plainDate;

  @doc("Filter enrolments starting on or before this date")
  @query startTo?: plainDate;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("CRUD, search, start, and end operations for TelehealthSession resources.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
interface TelehealthSessionManagement {
  @doc("Create a new TelehealthSession.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createTelehealthSession")
  create(
    @body body: TelehealthSession,
  ): {
    @statusCode statusCode: 201;
    @body telehealthSession: TelehealthSession;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single TelehealthSession by id.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getTelehealthSession")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body telehealthSession: TelehealthSession;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing TelehealthSession.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateTelehealthSession")
  @route("/{id}")
  update(
    @path id: string,
    @body body: TelehealthSession,
  ): {
    @statusCode statusCode: 200;
    @body telehealthSession: TelehealthSession;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a TelehealthSession (e.g., update status or meeting URL).")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @patch
  @operationId("patchTelehealthSession")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body telehealthSession: TelehealthSession;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a TelehealthSession by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteTelehealthSession")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for TelehealthSession resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchTelehealthSessions")
  @route("/search")
  search(
    ...TelehealthSessionSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<TelehealthSession>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Start a scheduled telehealth session, marking it as in-progress and recording the start time.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("startTelehealthSession")
  @route("/{id}/start")
  start(
    @path id: string,
    @body body: StartSessionRequest,
  ): {
    @statusCode statusCode: 200;
    @body telehealthSession: TelehealthSession;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("End an in-progress telehealth session, recording the end time and outcome.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("endTelehealthSession")
  @route("/{id}/end")
  end(
    @path id: string,
    @body body: EndSessionRequest,
  ): {
    @statusCode statusCode: 200;
    @body telehealthSession: TelehealthSession;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD, search, respond, and escalate operations for AsyncConsultation resources.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
interface AsyncConsultationManagement {
  @doc("Create a new AsyncConsultation request.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createAsyncConsultation")
  create(
    @body body: AsyncConsultation,
  ): {
    @statusCode statusCode: 201;
    @body asyncConsultation: AsyncConsultation;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single AsyncConsultation by id.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getAsyncConsultation")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body asyncConsultation: AsyncConsultation;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing AsyncConsultation.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateAsyncConsultation")
  @route("/{id}")
  update(
    @path id: string,
    @body body: AsyncConsultation,
  ): {
    @statusCode statusCode: 200;
    @body asyncConsultation: AsyncConsultation;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an AsyncConsultation by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteAsyncConsultation")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for AsyncConsultation resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchAsyncConsultations")
  @route("/search")
  search(
    ...AsyncConsultationSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<AsyncConsultation>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Submit a clinical response to an asynchronous consultation.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("respondToAsyncConsultation")
  @route("/{id}/respond")
  respond(
    @path id: string,
    @body body: AsyncConsultationRespondRequest,
  ): {
    @statusCode statusCode: 200;
    @body asyncConsultation: AsyncConsultation;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("Escalate an asynchronous consultation to a synchronous appointment.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("escalateAsyncConsultation")
  @route("/{id}/escalate")
  escalate(
    @path id: string,
    @body body: AsyncConsultationEscalateRequest,
  ): {
    @statusCode statusCode: 200;
    @body asyncConsultation: AsyncConsultation;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD and search operations for RemoteMonitoringEnrollment resources.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
interface RemoteMonitoringManagement {
  @doc("Create a new RemoteMonitoringEnrollment.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createRemoteMonitoringEnrollment")
  create(
    @body body: RemoteMonitoringEnrollment,
  ): {
    @statusCode statusCode: 201;
    @body remoteMonitoringEnrollment: RemoteMonitoringEnrollment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single RemoteMonitoringEnrollment by id.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getRemoteMonitoringEnrollment")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body remoteMonitoringEnrollment: RemoteMonitoringEnrollment;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing RemoteMonitoringEnrollment.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateRemoteMonitoringEnrollment")
  @route("/{id}")
  update(
    @path id: string,
    @body body: RemoteMonitoringEnrollment,
  ): {
    @statusCode statusCode: 200;
    @body remoteMonitoringEnrollment: RemoteMonitoringEnrollment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a RemoteMonitoringEnrollment (e.g., change status or update thresholds).")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @patch
  @operationId("patchRemoteMonitoringEnrollment")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body remoteMonitoringEnrollment: RemoteMonitoringEnrollment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a RemoteMonitoringEnrollment by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteRemoteMonitoringEnrollment")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for RemoteMonitoringEnrollment resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchRemoteMonitoringEnrollments")
  @route("/search")
  search(
    ...RemoteMonitoringSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<RemoteMonitoringEnrollment>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
