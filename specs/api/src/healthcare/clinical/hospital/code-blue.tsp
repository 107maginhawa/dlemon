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
 * Healthcare Clinical Code Blue — management of emergency code events including
 * rapid response activations, resuscitation records, team rosters, and
 * structured post-event debriefs to support quality improvement.
 */
namespace Healthcare.Clinical.Hospital.CodeBlue;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The type of emergency code or rapid response activation.")
enum EmergencyCodeType {
  @doc("Code Blue — cardiac or respiratory arrest in an adult patient")
  codeBlue,

  @doc("Rapid Response Team activation for a deteriorating patient before arrest")
  rapidResponse,

  @doc("Code Stroke — suspected acute stroke requiring immediate neurological assessment")
  codeStroke,

  @doc("Code Sepsis — suspected sepsis requiring immediate bundle initiation")
  codeSepsis,

  @doc("Code STEMI — suspected ST-elevation myocardial infarction requiring primary PCI pathway")
  codeSTEMI,

  @doc("Code Pink — paediatric cardiac or respiratory arrest")
  codePink,

  @doc("Code Orange — mass casualty or disaster alert")
  codeOrange,

  @doc("Medical Response Team — lower acuity rapid response variant")
  mrt,
}

@doc("The outcome of the emergency code event.")
enum CodeBlueOutcome {
  @doc("Return of spontaneous circulation achieved following cardiac arrest")
  rosc,

  @doc("Patient expired despite resuscitation efforts")
  expired,

  @doc("Patient stabilised and transferred to the intensive care unit")
  transferredToICU,

  @doc("Patient stabilised and remained on the ward or was transferred to a step-down unit")
  stabilized,

  @doc("The emergency activation was determined to be a false alarm")
  falseAlarm,
}

@doc("The role of a team member during a code blue event.")
enum CodeBlueRole {
  @doc("Team leader — directs the resuscitation and makes clinical decisions")
  teamLeader,

  @doc("Airway manager — responsible for airway management and ventilation")
  airway,

  @doc("Compressor — performs chest compressions")
  compressions,

  @doc("Medication nurse or pharmacist — prepares and administers resuscitation drugs")
  medications,

  @doc("Recorder — documents the timeline of interventions and observations")
  recorder,

  @doc("Other team member role")
  other,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("A medication administered during a code blue or resuscitation event.")
model CodeBlueMedication {
  @doc("The medication administered (e.g., adrenaline, amiodarone, atropine)")
  medication: CodeableConcept;

  @doc("The dose administered")
  dose: Quantity;

  @doc("The route of administration (e.g., IV, IO, ETT)")
  route: CodeableConcept;

  @doc("The date and time the medication was administered")
  administeredAt: utcDateTime;

  @doc("The team member who administered the medication, if known")
  administeredBy?: Reference;
}

@doc("A member of a code blue response team with their designated role.")
model CodeBlueTeamMember {
  @doc("Reference to the practitioner who is a member of this team")
  practitioner: Reference;

  @doc("The role this team member fulfils during a code blue event")
  role: CodeBlueRole;
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

@doc("A record of an emergency code or rapid response event, capturing the timeline, interventions, and outcome.")
model CodeBlueEvent extends HealthcareBaseEntity {
  @doc("The patient involved in the emergency event, if identified (may be unknown for code orange)")
  patient?: Reference;

  @doc("The physical location where the emergency event occurred")
  location: Reference;

  @doc("The date and time the emergency code was called")
  calledAt: utcDateTime;

  @doc("The person who initiated the emergency code call")
  calledBy: Reference;

  @doc("The type of emergency code activated")
  type: EmergencyCodeType;

  @doc("The members of the response team who attended this event")
  responseTeam?: Reference[];

  @doc("The date and time the first response team member arrived at the scene")
  arrivedAt?: utcDateTime;

  @doc("The date and time the event was formally resolved or concluded")
  resolvedAt?: utcDateTime;

  @doc("The clinical outcome of the emergency event")
  outcome: CodeBlueOutcome;

  @doc("Whether cardiopulmonary resuscitation was initiated during the event")
  cprInitiated?: boolean;

  @doc("Whether an automated external defibrillator was used during the event")
  aedUsed?: boolean;

  @doc("Whether the patient was intubated during the event")
  intubated?: boolean;

  @doc("List of medications administered during the event")
  medications?: CodeBlueMedication[];

  @doc("The number of defibrillation shocks delivered during the event")
  @minValue(0)
  defibrillations?: int32;

  @doc("The total duration of the resuscitation effort in minutes")
  @minValue(0)
  duration?: int32;

  @doc("Additional clinical annotations about the event")
  note?: Annotation[];
}

@doc("A standing code blue response team roster defining the members and roles for a defined team.")
model CodeBlueTeamRoster extends HealthcareBaseEntity {
  @doc("The name or identifier of the code blue team (e.g., 'Day Shift Rapid Response Team')")
  @maxLength(200)
  name: string;

  @doc("The department or unit this team is primarily assigned to")
  department?: Reference;

  @doc("The members of this team and their designated roles")
  members: CodeBlueTeamMember[];

  @doc("Whether this team roster is currently active and available for deployment")
  active: boolean;
}

@doc("A structured post-event debrief for a code blue or rapid response event, supporting quality improvement.")
model CodeBlueDebrief extends HealthcareBaseEntity {
  @doc("Reference to the CodeBlueEvent this debrief relates to")
  event: Reference;

  @doc("The date and time the debrief session took place")
  debriefDate: utcDateTime;

  @doc("The facilitator who led the debrief session")
  facilitator: Reference;

  @doc("The clinicians and staff who attended the debrief")
  attendees: Reference[];

  @doc("Whether the clinical protocol was followed correctly during the event")
  protocolFollowed: boolean;

  @doc("Whether all equipment functioned correctly during the event")
  equipmentFunctioned: boolean;

  @doc("Areas identified for improvement in future responses")
  improvements?: string[];

  @doc("Commendations or positive behaviours observed during the event")
  commendations?: string[];

  @doc("Specific action items assigned following the debrief")
  actionItems?: string[];
}

// ---------------------------------------------------------------------------
// Request models
// ---------------------------------------------------------------------------

@doc("Request body for retrieving currently active (unresolved) code blue events.")
model ActiveCodeBlueQuery {
  @doc("Filter active events by emergency code type")
  @query type?: EmergencyCodeType;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

@doc("Search parameters for CodeBlueEvent resources.")
model CodeBlueEventSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by emergency code type")
  @query type?: EmergencyCodeType;

  @doc("Filter by event outcome")
  @query outcome?: CodeBlueOutcome;

  @doc("Filter by location reference id")
  @query location?: string;

  @doc("Filter events called on or after this date-time")
  @query calledFrom?: utcDateTime;

  @doc("Filter events called on or before this date-time")
  @query calledTo?: utcDateTime;

  ...PaginationQuery;
}

@doc("Search parameters for CodeBlueDebrief resources.")
model CodeBlueDebriefSearchParams {
  @doc("Filter by event reference id")
  @query event?: string;

  @doc("Filter by facilitator reference id")
  @query facilitator?: string;

  @doc("Filter debriefs conducted on or after this date-time")
  @query debriefFrom?: utcDateTime;

  @doc("Filter debriefs conducted on or before this date-time")
  @query debriefTo?: utcDateTime;

  @doc("Filter by whether protocol was followed")
  @query protocolFollowed?: boolean;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("CRUD, search, and active event query operations for CodeBlueEvent resources.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface CodeBlueEventManagement {
  @doc("Create a new CodeBlueEvent record.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createCodeBlueEvent")
  create(
    @body body: CodeBlueEvent,
  ): {
    @statusCode statusCode: 201;
    @body codeBlueEvent: CodeBlueEvent;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single CodeBlueEvent by id.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getCodeBlueEvent")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body codeBlueEvent: CodeBlueEvent;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing CodeBlueEvent record.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateCodeBlueEvent")
  @route("/{id}")
  update(
    @path id: string,
    @body body: CodeBlueEvent,
  ): {
    @statusCode statusCode: 200;
    @body codeBlueEvent: CodeBlueEvent;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a CodeBlueEvent (e.g., record outcome after resolution).")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @patch
  @operationId("patchCodeBlueEvent")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body codeBlueEvent: CodeBlueEvent;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a CodeBlueEvent record by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteCodeBlueEvent")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for CodeBlueEvent resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchCodeBlueEvents")
  @route("/search")
  search(
    ...CodeBlueEventSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<CodeBlueEvent>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve all currently active (unresolved) code blue events in the facility.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getActiveCodeBlueEvents")
  @route("/active")
  getCurrentActive(
    ...ActiveCodeBlueQuery,
  ): {
    @statusCode statusCode: 200;
    @body result: CodeBlueEvent[];
  } | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD operations for CodeBlueTeamRoster resources.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface CodeBlueTeamManagement {
  @doc("Create a new CodeBlueTeamRoster.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createCodeBlueTeamRoster")
  create(
    @body body: CodeBlueTeamRoster,
  ): {
    @statusCode statusCode: 201;
    @body codeBlueTeamRoster: CodeBlueTeamRoster;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single CodeBlueTeamRoster by id.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getCodeBlueTeamRoster")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body codeBlueTeamRoster: CodeBlueTeamRoster;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing CodeBlueTeamRoster.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateCodeBlueTeamRoster")
  @route("/{id}")
  update(
    @path id: string,
    @body body: CodeBlueTeamRoster,
  ): {
    @statusCode statusCode: 200;
    @body codeBlueTeamRoster: CodeBlueTeamRoster;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a CodeBlueTeamRoster (e.g., activate or deactivate).")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @patch
  @operationId("patchCodeBlueTeamRoster")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body codeBlueTeamRoster: CodeBlueTeamRoster;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a CodeBlueTeamRoster by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteCodeBlueTeamRoster")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD and search operations for CodeBlueDebrief resources.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface CodeBlueDebriefManagement {
  @doc("Create a new CodeBlueDebrief record.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createCodeBlueDebrief")
  create(
    @body body: CodeBlueDebrief,
  ): {
    @statusCode statusCode: 201;
    @body codeBlueDebrief: CodeBlueDebrief;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single CodeBlueDebrief by id.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getCodeBlueDebrief")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body codeBlueDebrief: CodeBlueDebrief;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing CodeBlueDebrief record.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateCodeBlueDebrief")
  @route("/{id}")
  update(
    @path id: string,
    @body body: CodeBlueDebrief,
  ): {
    @statusCode statusCode: 200;
    @body codeBlueDebrief: CodeBlueDebrief;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a CodeBlueDebrief record by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteCodeBlueDebrief")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for CodeBlueDebrief resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchCodeBlueDebriefs")
  @route("/search")
  search(
    ...CodeBlueDebriefSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<CodeBlueDebrief>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
