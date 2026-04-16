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
 * Dialysis module.
 *
 * Provides models and operations for managing renal replacement therapy:
 * dialysis orders, individual treatment sessions, and vascular access records.
 * Covers haemodialysis (intermittent and continuous) and peritoneal dialysis
 * modalities, aligned with FHIR R4 ServiceRequest and Procedure resources.
 */
namespace Healthcare.Clinical.Hospital.Dialysis;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Type of dialysis modality prescribed.")
enum DialysisType {
  @doc("Intermittent haemodialysis — blood is filtered through an external circuit typically 3–4 hours, 3 times per week")
  hemodialysis,

  @doc("Peritoneal dialysis — the peritoneal membrane is used as a filter, either continuous ambulatory or automated")
  peritonealDialysis,

  @doc("Continuous Renal Replacement Therapy — slow, continuous filtration for haemodynamically unstable patients")
  crrt,
}

@doc("Type of vascular or peritoneal access used for dialysis.")
enum AccessType {
  @doc("Arteriovenous fistula — surgically created connection between an artery and vein")
  avFistula,

  @doc("Arteriovenous graft — synthetic tube connecting artery to vein")
  avGraft,

  @doc("Non-tunnelled or tunnelled central venous catheter (e.g., Mahurkar, Permcath)")
  centralCatheter,

  @doc("Peritoneal dialysis catheter (e.g., Tenckhoff catheter)")
  peritonealCatheter,
}

@doc("Lifecycle status of a dialysis order.")
enum DialysisOrderStatus {
  @doc("The order is active and the patient should be receiving dialysis as prescribed")
  active,

  @doc("The order is temporarily suspended (e.g., patient is haemodynamically unstable, surgery)")
  onHold,

  @doc("The order has been fulfilled and the patient no longer requires dialysis")
  completed,

  @doc("The order has been permanently stopped")
  discontinued,
}

@doc("Lifecycle status of a dialysis session.")
enum SessionStatus {
  @doc("The session is scheduled but has not yet started")
  scheduled,

  @doc("The session is currently in progress")
  inProgress,

  @doc("The session completed as prescribed")
  completed,

  @doc("The session was started but ended before completion due to a complication or patient refusal")
  interrupted,
}

@doc("Functional status of a dialysis access site.")
enum AccessStatus {
  @doc("The access is patent and functioning adequately")
  functional,

  @doc("The access is not functioning adequately (e.g., poor flow, recirculation, thrombosis)")
  malfunctioning,

  @doc("The access is infected and requires treatment")
  infected,

  @doc("The access has been removed or has failed and is no longer in use")
  removed,
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A standing dialysis order prescribing the modality, frequency, duration, and access for a patient's renal replacement therapy.")
model DialysisOrder extends HealthcareBaseEntity {
  @doc("Reference to the Patient for whom dialysis is ordered")
  patient: Reference;

  @doc("Reference to the Encounter associated with this order, if applicable")
  encounter?: Reference;

  @doc("Reference to the Practitioner (nephrologist) who placed this order")
  provider: Reference;

  @doc("Dialysis modality prescribed")
  dialysisType: DialysisType;

  @doc("Treatment frequency (e.g., 'Three times per week', 'Daily', 'Continuous')")
  frequency: string;

  @doc("Prescribed duration per session (e.g., '4 hours', '3.5 hours') — ISO 8601 duration or descriptive string")
  duration: string;

  @doc("Type of vascular or peritoneal access to be used")
  accessType: AccessType;

  @doc("Current status of this dialysis order")
  status: DialysisOrderStatus;
}

@doc("A single dialysis treatment session documenting pre/post vitals, fluid management, and outcomes.")
model DialysisSession extends HealthcareBaseEntity {
  @doc("Reference to the Patient receiving dialysis")
  patient: Reference;

  @doc("Reference to the Encounter during which this session occurred")
  encounter?: Reference;

  @doc("Reference to the DialysisOrder this session fulfils")
  order: Reference;

  @doc("Date on which this session was performed")
  sessionDate: utcDateTime;

  @doc("Actual start time of the dialysis session")
  startTime: utcDateTime;

  @doc("Actual end time of the dialysis session")
  endTime?: utcDateTime;

  @doc("Identifier or asset number of the dialysis machine used")
  machineId?: string;

  @doc("Vascular or peritoneal access site used for this session (free text — e.g., 'Left AVF — antecubital')")
  accessSite: string;

  @doc("Patient weight in kg before the session")
  preWeight?: Quantity;

  @doc("Patient weight in kg after the session")
  postWeight?: Quantity;

  @doc("Prescribed ultrafiltration goal in mL")
  ufGoal?: Quantity;

  @doc("Actual ultrafiltration achieved in mL")
  ufAchieved?: Quantity;

  @doc("Pre-dialysis blood pressure (systolic/diastolic in mmHg)")
  preBP?: string;

  @doc("Post-dialysis blood pressure (systolic/diastolic in mmHg)")
  postBP?: string;

  @doc("Complications occurring during or immediately after the session (SNOMED CT coded)")
  complications?: CodeableConcept[];

  @doc("Reference to the Practitioner who performed or supervised the session")
  performedBy: Reference;

  @doc("Current status of this session")
  status: SessionStatus;
}

@doc("A dialysis access site record documenting the placement, function, and current status of vascular or peritoneal access.")
model DialysisAccessRecord extends HealthcareBaseEntity {
  @doc("Reference to the Patient who holds this access")
  patient: Reference;

  @doc("Type of dialysis access")
  accessType: AccessType;

  @doc("Anatomical location of the access (e.g., 'Left radiocephalic AVF', 'Right internal jugular catheter')")
  location: string;

  @doc("Date the access was placed or created")
  placedDate: utcDateTime;

  @doc("Reference to the Practitioner (surgeon or interventional nephrologist) who placed the access")
  placedBy: Reference;

  @doc("Current functional status of the access")
  status: AccessStatus;

  @doc("Date and time of the most recent access assessment")
  lastAssessment?: utcDateTime;

  @doc("Date the access is expected to be mature and ready for use (applicable to AVF/AVG)")
  maturityDate?: utcDateTime;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for dialysis orders.")
model DialysisOrderSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by ordering provider reference ID") @query provider?: string;
  @doc("Filter by dialysis type") @query dialysisType?: DialysisType;
  @doc("Filter by order status") @query status?: DialysisOrderStatus;
  ...OffsetPaginationParams;
}

@doc("Search parameters for dialysis sessions.")
model DialysisSessionSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by dialysis order reference ID") @query order?: string;
  @doc("Filter by session status") @query status?: SessionStatus;
  @doc("Filter by session performer reference ID") @query performedBy?: string;
  @doc("Filter sessions on or after this date") @query sessionDateFrom?: utcDateTime;
  @doc("Filter sessions on or before this date") @query sessionDateTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for dialysis access records.")
model DialysisAccessSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by access type") @query accessType?: AccessType;
  @doc("Filter by access status") @query status?: AccessStatus;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Dialysis order management — prescribe, modify, and manage standing renal replacement therapy orders.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/dialysis/orders")
interface DialysisOrderManagement {
  @doc("Create a new dialysis order.")
  @operationId("createDialysisOrder")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createDialysisOrder(
    @body body: DialysisOrder,
  ): {
    @statusCode statusCode: 201;
    @body result: DialysisOrder;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a dialysis order by its logical ID.")
  @operationId("getDialysisOrder")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getDialysisOrder(
    @path @doc("DialysisOrder logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: DialysisOrder;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a dialysis order.")
  @operationId("updateDialysisOrder")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateDialysisOrder(
    @path @doc("DialysisOrder logical ID") id: UUID,
    @body body: DialysisOrder,
  ): {
    @statusCode statusCode: 200;
    @body result: DialysisOrder;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a dialysis order.")
  @operationId("deleteDialysisOrder")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteDialysisOrder(
    @path @doc("DialysisOrder logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search dialysis orders by patient, provider, type, or status.")
  @operationId("searchDialysisOrders")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchDialysisOrders(
    ...DialysisOrderSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<DialysisOrder>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Dialysis session management — document individual treatment runs including fluid management, vitals, and complications.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/dialysis/sessions")
interface DialysisSessionManagement {
  @doc("Create a new dialysis session record.")
  @operationId("createDialysisSession")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createDialysisSession(
    @body body: DialysisSession,
  ): {
    @statusCode statusCode: 201;
    @body result: DialysisSession;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a dialysis session by its logical ID.")
  @operationId("getDialysisSession")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getDialysisSession(
    @path @doc("DialysisSession logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: DialysisSession;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a dialysis session record — used to record outcomes, complications, and post-session data.")
  @operationId("updateDialysisSession")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateDialysisSession(
    @path @doc("DialysisSession logical ID") id: UUID,
    @body body: DialysisSession,
  ): {
    @statusCode statusCode: 200;
    @body result: DialysisSession;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a dialysis session record.")
  @operationId("deleteDialysisSession")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteDialysisSession(
    @path @doc("DialysisSession logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search dialysis sessions by patient, order, status, performer, or date range.")
  @operationId("searchDialysisSessions")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchDialysisSessions(
    ...DialysisSessionSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<DialysisSession>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Dialysis access management — track vascular and peritoneal access placement, function, and complications over time.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/dialysis/access-records")
interface DialysisAccessManagement {
  @doc("Create a new dialysis access record.")
  @operationId("createDialysisAccessRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createDialysisAccessRecord(
    @body body: DialysisAccessRecord,
  ): {
    @statusCode statusCode: 201;
    @body result: DialysisAccessRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a dialysis access record by its logical ID.")
  @operationId("getDialysisAccessRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getDialysisAccessRecord(
    @path @doc("DialysisAccessRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: DialysisAccessRecord;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a dialysis access record — status changes, assessment dates, or maturity updates.")
  @operationId("updateDialysisAccessRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateDialysisAccessRecord(
    @path @doc("DialysisAccessRecord logical ID") id: UUID,
    @body body: DialysisAccessRecord,
  ): {
    @statusCode statusCode: 200;
    @body result: DialysisAccessRecord;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a dialysis access record.")
  @operationId("deleteDialysisAccessRecord")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteDialysisAccessRecord(
    @path @doc("DialysisAccessRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search dialysis access records by patient, access type, or status.")
  @operationId("searchDialysisAccessRecords")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchDialysisAccessRecords(
    ...DialysisAccessSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<DialysisAccessRecord>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
