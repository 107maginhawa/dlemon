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
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

/**
 * Surgical Management — perioperative workflow resources covering the complete
 * surgical episode from scheduling through post-operative documentation.
 *
 * Encompasses: SurgicalCase (OR scheduling and documentation), OperatingRoom
 * (facility resource management), and AnesthesiaRecord (intraoperative
 * anesthesia documentation aligned with FHIR R4 Procedure and Observation).
 */
namespace Healthcare.Clinical.Surgical;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Lifecycle status of a surgical case from initial scheduling through completion or cancellation.")
enum SurgicalCaseStatus {
  @doc("The surgical case has been booked and is on the OR schedule")
  scheduled,

  @doc("The patient is in pre-operative preparation (consent, labs, marking, IV placement)")
  inPrep,

  @doc("Surgery is actively in progress in the operating room")
  inProgress,

  @doc("The procedure is complete and the patient is in the post-anesthesia care unit (PACU)")
  inRecovery,

  @doc("The surgical case and post-operative recovery are fully complete")
  completed,

  @doc("The case was cancelled before the procedure began")
  cancelled,

  @doc("The case has been postponed and rescheduled for a later date")
  postponed,
}

@doc("Current operational status of an operating room.")
enum OperatingRoomStatus {
  @doc("The operating room is available for scheduling")
  available,

  @doc("A surgical case is currently in progress in this room")
  inUse,

  @doc("The room is undergoing terminal cleaning between cases")
  cleaning,

  @doc("The room is out of service for scheduled or unscheduled maintenance")
  maintenance,

  @doc("The room is closed (e.g., decommissioned, renovation, staff shortage)")
  closed,
}

@doc("The clinical specialty type of an operating room, which determines compatible procedure types and equipment configurations.")
enum OperatingRoomType {
  @doc("General purpose operating room suitable for a broad range of procedures")
  general,

  @doc("Cardiac surgery suite with perfusion and cardiac monitoring equipment")
  cardiac,

  @doc("Neurosurgery suite with neuronavigation, microscope, and electrophysiology monitoring")
  neuro,

  @doc("Orthopaedic suite with imaging (C-arm), traction tables, and implant inventory")
  ortho,

  @doc("Ophthalmology suite with microscope and laser equipment")
  ophthalmology,

  @doc("Obstetric OR for caesarean sections and emergency deliveries")
  obstetric,

  @doc("Ear, nose, and throat surgery suite")
  ent,

  @doc("Urology suite with cystoscopy and lithotripsy equipment")
  urology,
}

@doc("Type of anesthesia administered during a surgical procedure.")
enum AnesthesiaType {
  @doc("The patient is rendered fully unconscious for the duration of the procedure")
  general,

  @doc("A specific region of the body is anaesthetised (e.g., spinal, epidural, nerve block)")
  regional,

  @doc("Only a localised area of tissue is anaesthetised")
  local,

  @doc("The patient receives intravenous agents for conscious or deep sedation without general anesthesia")
  sedation,

  @doc("Two or more anesthesia techniques are used together (e.g., general combined with epidural)")
  combined,
}

@doc("The anatomical laterality of the operative site.")
enum LateralityType {
  @doc("Left side of the body")
  left,

  @doc("Right side of the body")
  right,

  @doc("Both sides of the body")
  bilateral,

  @doc("Laterality is not applicable to this procedure (e.g., midline or systemic)")
  notApplicable,
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

@doc("A surgeon's preference card capturing the standard instruments, supplies, equipment, and room setup preferences for a specific procedure. Used to pre-populate surgical case picking lists and reduce preparation time.")
model SurgicalPreferenceCard extends HealthcareBaseEntity {
  @doc("Reference to the Practitioner (surgeon) who owns this preference card")
  surgeon: Reference;

  @doc("The surgical procedure this card applies to (SNOMED CT or CPT coded)")
  procedure: CodeableConcept;

  @doc("Surgical instruments required for this procedure")
  instruments?: CodeableConcept[];

  @doc("Disposable supplies (sutures, staples, drapes, etc.) required")
  supplies?: CodeableConcept[];

  @doc("Powered equipment (tables, microscopes, electrosurgical units) required")
  equipment?: CodeableConcept[];

  @doc("Patient positioning requirements (e.g., 'supine with left arm abducted', 'prone with Wilson frame')")
  positioning?: string;

  @doc("Skin preparation agent and technique (e.g., 'ChloraPrep — paint entire abdomen and groin')")
  skinPrep?: string;

  @doc("Draping instructions specifying sterile field boundaries and exposed anatomy")
  draping?: string;

  @doc("Free-text special instructions not captured in structured fields (e.g., implant sizing tables, allergy considerations)")
  specialInstructions?: string;
}

@doc("An operating room — a physical facility resource that can be scheduled for surgical cases. Tracks real-time availability and lists installed equipment and room-specific capabilities.")
model OperatingRoom extends HealthcareBaseEntity {
  @doc("Human-readable name or number for the operating room (e.g., 'OR-7', 'Cardiac Suite A')")
  name: string;

  @doc("Reference to the Location resource representing the physical facility this room belongs to")
  location: Reference;

  @doc("Clinical specialty type that determines compatible procedures and standard equipment")
  type: OperatingRoomType;

  @doc("Current operational availability of this room")
  status: OperatingRoomStatus;

  @doc("Permanently installed equipment in this room (e.g., 'Robotic Surgical System', 'Intraoperative CT')")
  equipment?: CodeableConcept[];

  @doc("Special capabilities or certifications of this room (e.g., 'HEPA filtered air', 'Lead shielded', 'Class 100 laminar flow')")
  features?: string[];
}

@doc("An intraoperative anesthesia record documenting the complete anesthetic management of a patient during a surgical procedure, including agent administration, airway management, monitoring, and complications.")
model AnesthesiaRecord extends HealthcareBaseEntity {
  @doc("Reference to the Patient who received anesthesia")
  patient: Reference;

  @doc("Reference to the Encounter (surgical admission) associated with this anesthesia record")
  encounter: Reference;

  @doc("Reference to the SurgicalCase this anesthesia record is associated with")
  surgicalCase?: Reference;

  @doc("Reference to the Practitioner (anesthesiologist or CRNA) responsible for this anesthesia")
  anesthesiologist: Reference;

  @doc("Type of anesthesia administered")
  type: AnesthesiaType;

  @doc("ASA Physical Status Classification (1–6) assigned at pre-operative assessment. ASA 1 = normal healthy patient, ASA 6 = brain-dead organ donor.")
  @minValue(1)
  @maxValue(6)
  asaClassification?: int32;

  @doc("Anesthetic agents administered (coded with RxNorm)")
  agents?: CodeableConcept[];

  @doc("Airway management technique used (e.g., 'endotracheal intubation', 'laryngeal mask airway', 'nasal cannula')")
  airwayManagement?: string;

  @doc("Free-text intraoperative monitoring notes (e.g., hemodynamic events, EEG findings)")
  monitoringNotes?: string;

  @doc("Date and time when anesthesia was initiated")
  startTime: utcDateTime;

  @doc("Date and time when anesthesia was discontinued and the patient was handed to recovery")
  endTime?: utcDateTime;

  @doc("Intraoperative or immediate post-operative complications (coded with SNOMED CT)")
  complications?: CodeableConcept[];

  @doc("Free-text and attributed annotations from the anesthesia care team")
  note?: Annotation[];
}

@doc("A SurgicalCase represents the complete perioperative record for a single surgical episode — from scheduling and pre-operative assessment through intraoperative documentation and post-operative outcomes.")
model SurgicalCase extends HealthcareBaseEntity {
  @doc("Reference to the Patient undergoing surgery")
  patient: Reference;

  @doc("Reference to the Encounter (surgical admission or outpatient visit) associated with this case")
  encounter: Reference;

  @doc("The surgical procedure to be or that was performed (SNOMED CT or CPT coded)")
  procedure: CodeableConcept;

  @doc("Reference to the primary Practitioner (surgeon) responsible for this case")
  surgeon: Reference;

  @doc("References to assistant surgeons or surgical residents")
  assistants?: Reference[];

  @doc("Reference to the Practitioner (anesthesiologist) assigned to this case")
  anesthesiologist?: Reference;

  @doc("References to scrub and circulating nurses assigned to this case")
  nurses?: Reference[];

  @doc("Scheduled date and time for the procedure to begin")
  scheduledDateTime: utcDateTime;

  @doc("Estimated duration of the procedure in minutes, used for OR scheduling")
  estimatedDurationMinutes?: int32;

  @doc("Actual date and time when the procedure was started (time of first incision or procedure commencement)")
  actualStartTime?: utcDateTime;

  @doc("Actual date and time when the procedure was completed (time of wound closure or procedure conclusion)")
  actualEndTime?: utcDateTime;

  @doc("Current lifecycle status of the surgical case")
  status: SurgicalCaseStatus;

  @doc("Reference to the OperatingRoom assigned to this case")
  operatingRoom?: Reference;

  @doc("Anatomical laterality of the operative site")
  laterality?: LateralityType;

  @doc("Implants placed during the procedure (e.g., prostheses, hardware, stents — coded with SNOMED CT)")
  implants?: CodeableConcept[];

  @doc("Reference to the SurgicalPreferenceCard used to prepare this case")
  preferenceCard?: Reference;

  @doc("Pre-operative diagnosis (ICD-10-CM or SNOMED CT coded)")
  preOpDiagnosis?: CodeableConcept;

  @doc("Post-operative diagnosis, which may differ from pre-operative when intraoperative findings change the working diagnosis")
  postOpDiagnosis?: CodeableConcept;

  @doc("Intraoperative and immediate post-operative complications")
  complications?: CodeableConcept[];

  @doc("Whether surgical specimens were collected and sent to pathology")
  specimenCollected?: boolean;

  @doc("Estimated intraoperative blood loss in millilitres")
  bloodLossEstimate?: Quantity;

  @doc("Attached clinical annotations from the surgical team")
  note?: Annotation[];
}

// ---------------------------------------------------------------------------
// Search Parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for querying surgical cases.")
model SurgicalCaseSearchParams {
  @doc("Filter by patient reference ID")
  @query
  patient?: string;

  @doc("Filter by encounter reference ID")
  @query
  encounter?: string;

  @doc("Filter by surgeon reference ID")
  @query
  surgeon?: string;

  @doc("Filter by case status")
  @query
  status?: SurgicalCaseStatus;

  @doc("Filter by operating room reference ID")
  @query
  operatingRoom?: string;

  @doc("Filter cases scheduled at or after this date-time")
  @query
  scheduledFrom?: utcDateTime;

  @doc("Filter cases scheduled at or before this date-time")
  @query
  scheduledTo?: utcDateTime;

  ...OffsetPaginationParams;
}

@doc("Search parameters for querying anesthesia records.")
model AnesthesiaRecordSearchParams {
  @doc("Filter by patient reference ID")
  @query
  patient?: string;

  @doc("Filter by encounter reference ID")
  @query
  encounter?: string;

  @doc("Filter by anesthesiologist reference ID")
  @query
  anesthesiologist?: string;

  @doc("Filter by anesthesia type")
  @query
  type?: AnesthesiaType;

  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Full lifecycle management of surgical cases — scheduling, perioperative documentation, and status transitions through the surgical episode.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/surgical/cases")
interface SurgicalCaseManagement {
  @doc("Schedule a new surgical case. Validates OR availability and assigns the case to the specified operating room and time slot.")
  @operationId("createSurgicalCase")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createSurgicalCase(
    @body body: SurgicalCase,
  ): {
    @statusCode statusCode: 201;
    @body result: SurgicalCase;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single surgical case by its logical ID.")
  @operationId("getSurgicalCase")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getSurgicalCase(
    @path @doc("SurgicalCase logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: SurgicalCase;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a surgical case record. Use to record actual start/end times, post-operative diagnosis, complications, and specimen information.")
  @operationId("updateSurgicalCase")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateSurgicalCase(
    @path @doc("SurgicalCase logical ID") id: UUID,
    @body body: SurgicalCase,
  ): {
    @statusCode statusCode: 200;
    @body result: SurgicalCase;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a surgical case. Allowed only for cases in 'scheduled' or 'cancelled' status.")
  @operationId("deleteSurgicalCase")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteSurgicalCase(
    @path @doc("SurgicalCase logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Transition a surgical case to a new lifecycle status (e.g., scheduled → inPrep → inProgress → inRecovery → completed).")
  @operationId("transitionSurgicalCaseStatus")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{id}/status")
  transitionStatus(
    @path @doc("SurgicalCase logical ID") id: UUID,
    @body body: { status: SurgicalCaseStatus; reason?: string },
  ): {
    @statusCode statusCode: 200;
    @body result: SurgicalCase;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search surgical cases using filter criteria. Supports filtering by patient, surgeon, status, operating room, and scheduled date range.")
  @operationId("searchSurgicalCases")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchSurgicalCases(
    ...SurgicalCaseSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<SurgicalCase>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Operating room facility management — track availability, equipment, and room status across the surgical department.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/surgical/operating-rooms")
interface OperatingRoomManagement {
  @doc("Register a new operating room in the facility.")
  @operationId("createOperatingRoom")
  @extension("x-security-required-roles", #["admin"])
  @post
  createOperatingRoom(
    @body body: OperatingRoom,
  ): {
    @statusCode statusCode: 201;
    @body result: OperatingRoom;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve an operating room by its logical ID.")
  @operationId("getOperatingRoom")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getOperatingRoom(
    @path @doc("OperatingRoom logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: OperatingRoom;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update operating room details, status, or equipment list.")
  @operationId("updateOperatingRoom")
  @extension("x-security-required-roles", #["admin"])
  @put
  @route("/{id}")
  updateOperatingRoom(
    @path @doc("OperatingRoom logical ID") id: UUID,
    @body body: OperatingRoom,
  ): {
    @statusCode statusCode: 200;
    @body result: OperatingRoom;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Remove an operating room from the facility inventory.")
  @operationId("deleteOperatingRoom")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteOperatingRoom(
    @path @doc("OperatingRoom logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("List and filter operating rooms. Supports filtering by status, type, and location.")
  @operationId("searchOperatingRooms")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchOperatingRooms(
    ...PaginationQuery,
    @doc("Filter by operational status") @query status?: OperatingRoomStatus,
    @doc("Filter by room type") @query type?: OperatingRoomType,
    @doc("Filter by location reference ID") @query location?: string,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<OperatingRoom>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Anesthesia record management — create and manage intraoperative anesthesia documentation.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/surgical/anesthesia-records")
interface AnesthesiaRecordManagement {
  @doc("Create a new anesthesia record for a surgical case.")
  @operationId("createAnesthesiaRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createAnesthesiaRecord(
    @body body: AnesthesiaRecord,
  ): {
    @statusCode statusCode: 201;
    @body result: AnesthesiaRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve an anesthesia record by its logical ID.")
  @operationId("getAnesthesiaRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getAnesthesiaRecord(
    @path @doc("AnesthesiaRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: AnesthesiaRecord;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an anesthesia record with intraoperative findings, agent administration details, and complications.")
  @operationId("updateAnesthesiaRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateAnesthesiaRecord(
    @path @doc("AnesthesiaRecord logical ID") id: UUID,
    @body body: AnesthesiaRecord,
  ): {
    @statusCode statusCode: 200;
    @body result: AnesthesiaRecord;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an anesthesia record.")
  @operationId("deleteAnesthesiaRecord")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteAnesthesiaRecord(
    @path @doc("AnesthesiaRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search anesthesia records by patient, encounter, anesthesiologist, or type.")
  @operationId("searchAnesthesiaRecords")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchAnesthesiaRecords(
    ...AnesthesiaRecordSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<AnesthesiaRecord>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
