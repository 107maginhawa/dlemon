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
 * Clinical Communication — structured clinical handoffs and secure messaging
 * between clinical team members, supporting patient safety during care transitions
 * and enabling timely communication of critical clinical information.
 *
 * ClinicalHandoff implements the SBAR (Situation–Background–Assessment–
 * Recommendation) framework endorsed by The Joint Commission for standardised
 * handoff communication (NPSG 02.05.01).
 *
 * ClinicalMessage provides secure, HIPAA-compliant intra-facility messaging
 * with delivery acknowledgement and priority routing.
 */
namespace Healthcare.Clinical.Communication;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The clinical context in which a handoff communication occurs.")
enum HandoffType {
  @doc("End-of-shift handoff — transfer of patient care responsibility at a nursing or physician shift change")
  shiftChange,

  @doc("Inter-unit or inter-facility transfer handoff — patient is physically moving to a different care setting")
  transfer,

  @doc("Discharge handoff — care responsibility is transitioning to outpatient, home care, or another facility")
  discharge,

  @doc("Escalation handoff — a deteriorating patient is being escalated to a higher level of care or senior clinician")
  escalation,

  @doc("Procedural handoff — transfer of care responsibility immediately before or after a procedure or surgery")
  procedural,
}

@doc("Priority level of a clinical message, used for routing and alert generation.")
enum MessagePriority {
  @doc("Routine — non-urgent message that does not require immediate attention")
  routine,

  @doc("Urgent — requires prompt attention within a defined timeframe (e.g., 30–60 minutes)")
  urgent,

  @doc("STAT — requires immediate attention; triggers audible alert and escalation if not acknowledged")
  stat,
}

@doc("Clinical workflow category of a message, used for filtering and routing.")
enum MessageCategory {
  @doc("Order-related message (e.g., order clarification, order update notification)")
  order,

  @doc("Result notification (e.g., critical lab value, imaging result available)")
  result,

  @doc("Consultation request or response")
  consultation,

  @doc("Administrative or operational message not related to direct patient care")
  administrative,

  @doc("Referral communication — inbound or outbound patient referral information")
  referral,

  @doc("Patient safety alert or critical information notification")
  safety,
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

@doc("A structured clinical handoff using the SBAR (Situation–Background–Assessment–Recommendation) framework. Documents the transfer of responsibility for a patient between providers to ensure continuity of safe care. Aligns with Joint Commission NPSG 02.05.01.")
model ClinicalHandoff extends HealthcareBaseEntity {
  @doc("Reference to the Patient whose care is being transferred")
  patient: Reference;

  @doc("Reference to the Encounter (admission or visit) associated with this handoff")
  encounter: Reference;

  @doc("Reference to the Practitioner transferring care (the 'giving' provider)")
  fromProvider: Reference;

  @doc("Reference to the Practitioner receiving care responsibility (the 'accepting' provider)")
  toProvider: Reference;

  @doc("Date and time the handoff occurred or is scheduled to occur")
  handoffTime: utcDateTime;

  @doc("The type of clinical transition requiring this handoff")
  type: HandoffType;

  @doc("SBAR — Situation: A concise statement of the current problem or reason for the handoff (e.g., 'Mr. Smith is a 72-year-old male admitted for CHF exacerbation who is now showing signs of respiratory distress')")
  situation: string;

  @doc("SBAR — Background: Relevant clinical history and context needed to understand the situation (e.g., prior admissions, baseline status, current treatment)")
  background: string;

  @doc("SBAR — Assessment: The provider's clinical assessment of the patient's current status and the severity of the situation")
  assessment: string;

  @doc("SBAR — Recommendation: Specific actions requested or recommended for the accepting provider (e.g., orders to follow, monitoring parameters, escalation triggers)")
  recommendation: string;

  @doc("Outstanding tasks and pending items the accepting provider must complete (e.g., 'Await culture results', 'Follow up with radiology re: chest X-ray read')")
  tasksOutstanding?: string[];

  @doc("Critical laboratory or monitoring values the accepting provider must be aware of (e.g., 'K+ 2.8 — repletion ordered', 'INR 6.2 — hold anticoagulation')")
  criticalValues?: string[];

  @doc("Current isolation status and precautions in effect (e.g., 'Contact precautions — MRSA', 'Droplet precautions — influenza')")
  isolationStatus?: string;

  @doc("Whether the patient has been identified as a fall risk using a validated fall risk assessment tool (e.g., Morse, Hendrich)")
  fallRisk?: boolean;

  @doc("Current code status or advance directive preference (e.g., 'Full Code', 'DNR/DNI', 'Comfort Care Only')")
  codeStatus?: string;

  @doc("Summary of known allergies and adverse drug reactions relevant to the receiving provider (e.g., 'PCN — anaphylaxis', 'Contrast — urticaria')")
  allergies?: string;

  @doc("Summary of current medications relevant to ongoing management (e.g., 'Heparin drip at 1200 units/hr — see pharmacy orders')")
  medications?: string;

  @doc("Additional handoff notes not captured in the SBAR structure")
  note?: Annotation[];
}

@doc("A secure clinical message sent between members of the care team, with delivery tracking, acknowledgement, and priority routing. Supports HIPAA-compliant intra-facility clinical communication.")
model ClinicalMessage extends HealthcareBaseEntity {
  @doc("Reference to the Practitioner or User who sent this message")
  sender: Reference;

  @doc("References to the Practitioners or Groups who are the intended recipients")
  recipient: Reference[];

  @doc("Reference to the Patient this message concerns. Required for patient-specific messages; omitted for administrative messages.")
  patient?: Reference;

  @doc("Reference to the Encounter this message is related to")
  encounter?: Reference;

  @doc("Priority level determining routing, alert behaviour, and escalation policy")
  priority: MessagePriority;

  @doc("The clinical workflow category of this message")
  category: MessageCategory;

  @doc("Brief subject line summarising the message content (required for message list display)")
  subject: string;

  @doc("The full message body. May contain structured clinical information or free-text. HIPAA-protected — do not include in logs.")
  body: string;

  @doc("Date and time the message was sent")
  sentAt: utcDateTime;

  @doc("Date and time the message was first read by at least one recipient")
  readAt?: utcDateTime;

  @doc("Date and time the message was formally acknowledged (if acknowledgement was required)")
  acknowledgedAt?: utcDateTime;

  @doc("Whether the sender requires explicit acknowledgement from the recipient. When true, unacknowledged STAT messages trigger escalation after a configured timeout.")
  requiresAcknowledgment?: boolean;

  @doc("Reference to a related FHIR resource (e.g., the MedicationRequest that prompted an order message, the DiagnosticReport for a result notification)")
  relatedResource?: Reference;

  @doc("Additional notes or context attached to the message thread")
  note?: Annotation[];
}

// ---------------------------------------------------------------------------
// Search Parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for clinical handoff queries.")
model HandoffSearchParams {
  @doc("Filter by patient reference ID")
  @query
  patient?: string;

  @doc("Filter by encounter reference ID")
  @query
  encounter?: string;

  @doc("Filter by the sending provider reference ID")
  @query
  fromProvider?: string;

  @doc("Filter by the receiving provider reference ID")
  @query
  toProvider?: string;

  @doc("Filter by handoff type")
  @query
  type?: HandoffType;

  @doc("Filter handoffs occurring at or after this date-time")
  @query
  dateFrom?: utcDateTime;

  @doc("Filter handoffs occurring at or before this date-time")
  @query
  dateTo?: utcDateTime;

  ...OffsetPaginationParams;
}

@doc("Search parameters for clinical message queries.")
model MessageSearchParams {
  @doc("Filter by sender reference ID")
  @query
  sender?: string;

  @doc("Filter by recipient reference ID")
  @query
  recipient?: string;

  @doc("Filter by patient reference ID")
  @query
  patient?: string;

  @doc("Filter by message priority")
  @query
  priority?: MessagePriority;

  @doc("Filter by message category")
  @query
  category?: MessageCategory;

  @doc("Filter to only unread messages")
  @query
  unreadOnly?: boolean;

  @doc("Filter to only unacknowledged messages that require acknowledgement")
  @query
  requiresAcknowledgmentOnly?: boolean;

  @doc("Filter messages sent at or after this date-time")
  @query
  sentFrom?: utcDateTime;

  @doc("Filter messages sent at or before this date-time")
  @query
  sentTo?: utcDateTime;

  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Clinical handoff management — create and retrieve SBAR-structured handoff records for safe care transitions at shift change, transfer, discharge, escalation, and procedural handoff events.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/clinical/handoffs")
interface ClinicalHandoffManagement {
  @doc("Document a new clinical handoff using the SBAR framework. Creating a handoff automatically notifies the receiving provider and records the time-stamped transfer of care responsibility.")
  @operationId("createClinicalHandoff")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createClinicalHandoff(
    @body body: ClinicalHandoff,
  ): {
    @statusCode statusCode: 201;
    @body result: ClinicalHandoff;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a clinical handoff record by its logical ID.")
  @operationId("getClinicalHandoff")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getClinicalHandoff(
    @path @doc("ClinicalHandoff logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: ClinicalHandoff;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a clinical handoff record — typically to add notes or correct documentation errors. Handoffs are generally immutable once created; significant changes should be documented as addendum notes.")
  @operationId("updateClinicalHandoff")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateClinicalHandoff(
    @path @doc("ClinicalHandoff logical ID") id: UUID,
    @body body: ClinicalHandoff,
  ): {
    @statusCode statusCode: 200;
    @body result: ClinicalHandoff;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a clinical handoff record. Permitted only for records created in error.")
  @operationId("deleteClinicalHandoff")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteClinicalHandoff(
    @path @doc("ClinicalHandoff logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search clinical handoff records by patient, encounter, provider, handoff type, and date range. Supports care continuity audits, shift overlap analysis, and Joint Commission survey preparation.")
  @operationId("searchClinicalHandoffs")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchClinicalHandoffs(
    ...HandoffSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ClinicalHandoff>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Secure clinical message management — send, receive, search, and acknowledge HIPAA-compliant clinical messages between care team members with priority routing and delivery tracking.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/clinical/messages")
interface ClinicalMessageManagement {
  @doc("Send a new clinical message to one or more recipients. STAT priority messages immediately trigger audible alerts and push notifications to recipient devices.")
  @operationId("sendClinicalMessage")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  sendClinicalMessage(
    @body body: ClinicalMessage,
  ): {
    @statusCode statusCode: 201;
    @body result: ClinicalMessage;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a clinical message by its logical ID.")
  @operationId("getClinicalMessage")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getClinicalMessage(
    @path @doc("ClinicalMessage logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: ClinicalMessage;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a clinical message record — e.g., to add a read timestamp when the message is opened, or to append follow-up notes.")
  @operationId("updateClinicalMessage")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateClinicalMessage(
    @path @doc("ClinicalMessage logical ID") id: UUID,
    @body body: ClinicalMessage,
  ): {
    @statusCode statusCode: 200;
    @body result: ClinicalMessage;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a clinical message. Permitted only for messages in unsent state or created in error. Delivered messages are retained for audit purposes.")
  @operationId("deleteClinicalMessage")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteClinicalMessage(
    @path @doc("ClinicalMessage logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search clinical messages by sender, recipient, patient, priority, category, and date range. Supports inbox management, unread message counts, and compliance audit queries.")
  @operationId("searchClinicalMessages")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchClinicalMessages(
    ...MessageSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ClinicalMessage>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Acknowledge a clinical message that was sent with requiresAcknowledgment=true. Records the acknowledgedAt timestamp and, for STAT messages, stops the escalation timer. A recipient must call this endpoint to confirm they have received and acted upon the message.")
  @operationId("acknowledgeClinicalMessage")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{id}/acknowledge")
  acknowledgeClinicalMessage(
    @path @doc("ClinicalMessage logical ID") id: UUID,
    @body body: { note?: string },
  ): {
    @statusCode statusCode: 200;
    @body result: ClinicalMessage;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
