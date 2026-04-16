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
 * ADT Event Log module.
 *
 * Captures Admission, Discharge, and Transfer events for HL7 v2 parity.
 * Each ADT event is an immutable audit record of a patient movement or
 * administrative state change within the facility. Aligns with HL7 v2
 * ADT message types (A01–A53) and FHIR Encounter state transitions.
 */
namespace Healthcare.Clinical.ADTEvents;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Type of ADT event, corresponding to HL7 v2 ADT message trigger events.")
enum ADTEventType {
  @doc("Pre-admit — patient pre-registration before arrival (A05)")
  preAdmit,
  @doc("Admit — inpatient admission (A01)")
  admit,
  @doc("Transfer — patient transferred to a different unit, bed, or service (A02)")
  transfer,
  @doc("Discharge — patient discharged from the facility (A03)")
  discharge,
  @doc("Cancel admit — previously recorded admission is cancelled (A11)")
  cancelAdmit,
  @doc("Cancel transfer — previously recorded transfer is cancelled (A12)")
  cancelTransfer,
  @doc("Cancel discharge — previously recorded discharge is cancelled (A13)")
  cancelDischarge,
  @doc("Update patient information — demographic or administrative update (A08)")
  updatePatient,
  @doc("Merge patient records (A18, A34, A39–A45)")
  mergePatient,
  @doc("Swap patients between two beds (A17)")
  swapPatient,
  @doc("Register outpatient — outpatient encounter registration (A04)")
  registerOutpatient,
  @doc("Cancel outpatient registration (A21)")
  cancelRegistration,
  @doc("Leave of absence — patient temporarily leaves the facility (A21)")
  leaveOfAbsence,
  @doc("Return from leave of absence (A22)")
  returnFromLeave,
}

@doc("Lifecycle status of an ADT event record.")
enum ADTEventStatus {
  @doc("The ADT event was successfully processed and represents the current state")
  completed,
  @doc("The ADT event was cancelled by a subsequent cancel-type event")
  cancelled,
  @doc("The ADT event was entered in error and should be disregarded")
  enteredInError,
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

@doc("An Admission, Discharge, or Transfer event log entry. Immutable audit record of patient movement and administrative state changes. Aligns with HL7 v2 ADT messages and FHIR Encounter resource state transitions.")
model ADTEvent extends HealthcareBaseEntity {
  @doc("Reference to the Patient subject to this ADT event")
  patient: Reference;

  @doc("Reference to the Encounter associated with this ADT event")
  encounter: Reference;

  @doc("Type of ADT event (admit, transfer, discharge, etc.)")
  eventType: ADTEventType;

  @doc("Date and time the ADT event occurred")
  eventDateTime: utcDateTime;

  @doc("Processing status of this ADT event record")
  status: ADTEventStatus;

  @doc("Location the patient was transferred FROM (applicable for transfer events)")
  fromLocation?: Reference;

  @doc("Location the patient was transferred TO or admitted INTO")
  toLocation?: Reference;

  @doc("Specific bed the patient was transferred FROM")
  fromBed?: Reference;

  @doc("Specific bed the patient was assigned TO")
  toBed?: Reference;

  @doc("Reference to the Practitioner who admitted the patient")
  admittingProvider?: Reference;

  @doc("Reference to the Practitioner currently attending the patient")
  attendingProvider?: Reference;

  @doc("Reference to the Practitioner who referred the patient")
  referringProvider?: Reference;

  @doc("Source of admission (e.g., emergency room, physician referral, transfer from another facility)")
  admitSource?: CodeableConcept;

  @doc("Discharge disposition — where the patient was discharged to (e.g., home, SNF, expired)")
  dischargeDisposition?: CodeableConcept;

  @doc("Reference to the location or facility to which the patient was discharged")
  dischargeDestination?: Reference;

  @doc("Reference to the immediately preceding Encounter, used to identify readmissions")
  previousEncounter?: Reference;

  @doc("HL7 v2 trigger event code that corresponds to this event type (e.g., A01, A02, A03)")
  triggerEvent?: string;

  @doc("Free-text note or additional context for this ADT event")
  note?: string;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for ADT event records.")
model ADTEventSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by event type") @query eventType?: ADTEventType;
  @doc("Filter by event status") @query status?: ADTEventStatus;
  @doc("Filter events occurring at or after this date-time") @query eventFrom?: utcDateTime;
  @doc("Filter events occurring at or before this date-time") @query eventTo?: utcDateTime;
  @doc("Filter by admitting provider reference ID") @query admittingProvider?: string;
  @doc("Filter by attending provider reference ID") @query attendingProvider?: string;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

@doc("ADT event management — create and query Admission, Discharge, and Transfer events. Provides a patient-level timeline view for care coordination and census management.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/adt-events")
interface ADTEventManagement {
  @doc("Create a new ADT event record.")
  @operationId("createADTEvent")
  @extension("x-security-required-roles", #["admin", "clinician", "scheduler"])
  @post
  createADTEvent(
    @body body: ADTEvent,
  ): {
    @statusCode statusCode: 201;
    @body result: ADTEvent;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single ADT event by its logical ID.")
  @operationId("getADTEvent")
  @extension("x-security-required-roles", #["admin", "clinician", "scheduler"])
  @get
  @route("/{id}")
  getADTEvent(
    @path @doc("ADTEvent logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: ADTEvent;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search ADT events by patient, encounter, event type, or date range.")
  @operationId("searchADTEvents")
  @extension("x-security-required-roles", #["admin", "clinician", "scheduler"])
  @get
  @route("/search")
  searchADTEvents(
    ...ADTEventSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ADTEvent>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve the complete chronological ADT timeline for a specific patient. Returns all ADT events across all encounters, ordered by eventDateTime ascending.")
  @operationId("getPatientADTTimeline")
  @extension("x-security-required-roles", #["admin", "clinician", "scheduler"])
  @get
  @route("/patient/{patientId}/timeline")
  getPatientADTTimeline(
    @path @doc("Patient logical ID") patientId: UUID,
    @doc("Filter timeline events at or after this date-time") @query from?: utcDateTime,
    @doc("Filter timeline events at or before this date-time") @query to?: utcDateTime,
    ...OffsetPaginationParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ADTEvent>;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
