import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../../../common/models.tsp";
import "../../../../common/errors.tsp";
import "../../../../common/pagination.tsp";
import "../../../../common/security.tsp";
import "../../../core/primitives.tsp";
import "../../../core/terminology.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

/**
 * Palliative Care and Hospice module.
 *
 * Covers goals-of-care discussions (including advance directive review and
 * code status documentation), serial symptom burden assessments using the
 * Palliative Performance Scale and 0–10 symptom scales, hospice eligibility
 * certification and recertification, and interdisciplinary team (IDT) meeting
 * documentation. Aligns with FHIR CarePlan, Observation, Consent, and
 * ClinicalImpression resources.
 */
namespace Healthcare.Clinical.Hospital.Specialty.PalliativeHospice;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Patient's documented decision regarding a specific treatment option discussed during a goals-of-care conversation.")
enum PreferenceDecision {
  @doc("Patient wants the treatment to be provided")
  wantTreatment,
  @doc("Patient does not want the treatment")
  doNotWant,
  @doc("Patient is uncertain and requires further discussion or information")
  unsure,
  @doc("Patient defers the decision to a named surrogate decision-maker")
  deferToSurrogate,
}

@doc("Patient's documented code status — level of resuscitative intervention desired.")
enum CodeStatus {
  @doc("Full resuscitative measures including CPR, intubation, and all life-sustaining treatments")
  fullCode,
  @doc("Do Not Resuscitate / Do Not Intubate — no CPR and no mechanical ventilation")
  dnrDni,
  @doc("Do Not Intubate only — CPR is acceptable but mechanical ventilation is not")
  dniOnly,
  @doc("Comfort care only — no CPR, no intubation, focus on symptom management")
  comfortCareOnly,
  @doc("Code status is defined by conditions or preferences not captured in the standard options")
  other,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("A patient's stated preference regarding a specific treatment or life-sustaining intervention.")
model TreatmentPreference {
  @doc("The treatment or intervention under consideration (e.g., CPR, mechanical ventilation, artificial nutrition)")
  treatment: string;

  @doc("Patient's preference regarding the treatment")
  preference: PreferenceDecision;

  @doc("Conditions or context under which this preference applies (e.g., 'if no chance of meaningful recovery')")
  conditions?: string;
}

@doc("A patient's self-reported or clinician-assessed symptom burden entry.")
model SymptomEntry {
  @doc("The symptom being assessed (SNOMED CT coded)")
  symptom: CodeableConcept;

  @doc("Severity score on a 0–10 numeric rating scale (0 = none, 10 = worst imaginable)")
  @minValue(0)
  @maxValue(10)
  severity: int32;

  @doc("Frequency of the symptom (e.g., 'constant', 'intermittent', 'with activity')")
  frequency?: string;

  @doc("Intervention used to manage this symptom")
  intervention?: string;

  @doc("Patient's response to the intervention (e.g., 'partial relief', 'no relief', 'complete relief')")
  responseToIntervention?: string;
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A structured goals-of-care conversation record capturing patient values, treatment preferences, code status, and advance directive review. Extends HealthcareBaseEntity.")
model GoalsOfCareDiscussion extends HealthcareBaseEntity {
  @doc("Reference to the Patient with whom the goals-of-care discussion was held")
  patient: Reference;

  @doc("Reference to the Encounter during which this discussion took place, if applicable")
  encounter?: Reference;

  @doc("Reference to the Practitioner or palliative care clinician who facilitated the discussion")
  facilitator: Reference;

  @doc("References to all participants in the discussion (family members, surrogate decision-makers, interdisciplinary team)")
  participants: Reference[];

  @doc("Date the goals-of-care discussion was held")
  discussionDate: utcDateTime;

  @doc("Summary of the prognosis communicated to the patient and family")
  prognosis?: string;

  @doc("Patient's expressed values regarding quality of life, acceptable functional states, and what matters most")
  patientValues?: string[];

  @doc("Patient's treatment preferences documented during the discussion")
  treatmentPreferences: TreatmentPreference[];

  @doc("Patient's documented code status resulting from this discussion")
  codeStatus: CodeStatus;

  @doc("Whether the patient's existing advance directive was reviewed during this discussion")
  advanceDirectiveReviewed?: boolean;

  @doc("Reference to the Consent resource containing the patient's advance directive")
  advanceDirectiveReference?: Reference;

  @doc("Reference to the RelatedPerson designated as the surrogate decision-maker")
  surrogatDecisionMaker?: Reference;

  @doc("Free-text clinical note documenting additional context from the discussion")
  note?: string;
}

@doc("A serial symptom assessment capturing the patient's palliative symptom burden at a point in time. Extends HealthcareBaseEntity.")
model SymptomAssessment extends HealthcareBaseEntity {
  @doc("Reference to the Patient being assessed")
  patient: Reference;

  @doc("Reference to the Encounter, if performed in an inpatient or clinic setting")
  encounter?: Reference;

  @doc("Reference to the Practitioner who performed the symptom assessment")
  assessedBy: Reference;

  @doc("Date and time the symptom assessment was completed")
  assessedAt: utcDateTime;

  @doc("Individual symptom entries with severity scores and intervention responses")
  symptoms: SymptomEntry[];

  @doc("Overall distress score on a 0–10 scale (0 = no distress, 10 = worst imaginable distress)")
  @minValue(0)
  @maxValue(10)
  overallDistressScore?: int32;

  @doc("Palliative Performance Scale (PPS) score (0–100, in increments of 10). Reflects functional status and prognosis.")
  @minValue(0)
  @maxValue(100)
  palliativePerformanceScale?: int32;

  @doc("Free-text clinical note from the palliative care clinician")
  note?: string;
}

@doc("Hospice eligibility certification record documenting terminal prognosis, certifying physician, and benefit period. Extends HealthcareBaseEntity.")
model HospiceEligibility extends HealthcareBaseEntity {
  @doc("Reference to the Patient being certified for hospice eligibility")
  patient: Reference;

  @doc("Reference to the Practitioner (attending or hospice medical director) who certified hospice eligibility")
  certifyingPhysician: Reference;

  @doc("Date the hospice eligibility certification was completed")
  certificationDate: utcDateTime;

  @doc("Primary terminal diagnosis driving hospice eligibility (ICD-10 coded)")
  terminalDiagnosis: CodeableConcept;

  @doc("Clinical statement of prognosis — typically 'six months or less if the illness runs its normal course'")
  prognosis: string;

  @doc("Medicare hospice benefit period number (1 = first 90-day period, 2 = second 90-day period, 3 = subsequent 60-day periods)")
  benefitPeriod: int32;

  @doc("Date the recertification is due for the next benefit period")
  recertificationDue?: plainDate;

  @doc("Current certification status")
  status: "certified" | "recertified" | "revoked" | "discharged" | "expired";
}

@doc("Documentation of a hospice interdisciplinary team (IDT) meeting reviewing patient care plan and needs. Extends HealthcareBaseEntity.")
model HospiceIDTMeeting extends HealthcareBaseEntity {
  @doc("Reference to the Patient whose care is being reviewed")
  patient: Reference;

  @doc("Date the IDT meeting was held")
  meetingDate: utcDateTime;

  @doc("References to all IDT team members who attended (physician, nurse, social worker, chaplain, etc.)")
  attendees: Reference[];

  @doc("Whether the patient's plan of care was reviewed and updated during this meeting")
  carePlanReviewed: boolean;

  @doc("Whether symptom management was discussed during this meeting")
  symptomManagementDiscussed: boolean;

  @doc("Psychosocial assessment summary documented during the meeting")
  psychosocialAssessment?: string;

  @doc("Spiritual care needs identified and addressed during the meeting")
  spiritualCareNeeds?: string;

  @doc("Family and caregiver support needs identified during the meeting")
  familySupportNeeds?: string;

  @doc("Specific updates made to the patient's care plan as a result of this meeting")
  planUpdates?: string[];

  @doc("Date of the next scheduled IDT meeting")
  nextMeetingDate?: plainDate;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for goals-of-care discussion records.")
model GoalsOfCareSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by facilitator reference ID") @query facilitator?: string;
  @doc("Filter by code status") @query codeStatus?: CodeStatus;
  @doc("Filter discussions held at or after this date-time") @query discussedFrom?: utcDateTime;
  @doc("Filter discussions held at or before this date-time") @query discussedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for symptom assessments.")
model SymptomAssessmentSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by assessing clinician reference ID") @query assessedBy?: string;
  @doc("Filter assessments performed at or after this date-time") @query assessedFrom?: utcDateTime;
  @doc("Filter assessments performed at or before this date-time") @query assessedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for hospice eligibility certifications.")
model HospiceEligibilitySearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by certifying physician reference ID") @query certifyingPhysician?: string;
  @doc("Filter by certification status") @query status?: string;
  @doc("Filter by benefit period") @query benefitPeriod?: int32;
  @doc("Filter certifications issued at or after this date") @query certifiedFrom?: utcDateTime;
  @doc("Filter certifications issued at or before this date") @query certifiedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for hospice IDT meeting records.")
model HospiceIDTSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by attendee reference ID") @query attendee?: string;
  @doc("Filter meetings held at or after this date-time") @query meetingFrom?: utcDateTime;
  @doc("Filter meetings held at or before this date-time") @query meetingTo?: utcDateTime;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Goals-of-care discussion management — document, retrieve, update, and search structured advance care planning conversations.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/palliative/goals-of-care")
interface GoalsOfCareManagement {
  @doc("Create a new goals-of-care discussion record.")
  @operationId("createGoalsOfCareDiscussion")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createGoalsOfCareDiscussion(
    @body body: GoalsOfCareDiscussion,
  ): {
    @statusCode statusCode: 201;
    @body result: GoalsOfCareDiscussion;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a goals-of-care discussion record by its logical ID.")
  @operationId("getGoalsOfCareDiscussion")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getGoalsOfCareDiscussion(
    @path @doc("GoalsOfCareDiscussion logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: GoalsOfCareDiscussion;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a goals-of-care discussion record.")
  @operationId("updateGoalsOfCareDiscussion")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateGoalsOfCareDiscussion(
    @path @doc("GoalsOfCareDiscussion logical ID") id: UUID,
    @body body: GoalsOfCareDiscussion,
  ): {
    @statusCode statusCode: 200;
    @body result: GoalsOfCareDiscussion;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a goals-of-care discussion record.")
  @operationId("deleteGoalsOfCareDiscussion")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteGoalsOfCareDiscussion(
    @path @doc("GoalsOfCareDiscussion logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search goals-of-care discussions by patient, facilitator, code status, or date range.")
  @operationId("searchGoalsOfCareDiscussions")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchGoalsOfCareDiscussions(
    ...GoalsOfCareSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<GoalsOfCareDiscussion>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Symptom assessment management — record and retrieve serial palliative symptom burden assessments.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/palliative/symptom-assessments")
interface SymptomAssessmentManagement {
  @doc("Create a new palliative symptom assessment.")
  @operationId("createSymptomAssessment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createSymptomAssessment(
    @body body: SymptomAssessment,
  ): {
    @statusCode statusCode: 201;
    @body result: SymptomAssessment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a symptom assessment by its logical ID.")
  @operationId("getSymptomAssessment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getSymptomAssessment(
    @path @doc("SymptomAssessment logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: SymptomAssessment;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a symptom assessment.")
  @operationId("updateSymptomAssessment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateSymptomAssessment(
    @path @doc("SymptomAssessment logical ID") id: UUID,
    @body body: SymptomAssessment,
  ): {
    @statusCode statusCode: 200;
    @body result: SymptomAssessment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a symptom assessment.")
  @operationId("deleteSymptomAssessment")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteSymptomAssessment(
    @path @doc("SymptomAssessment logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search symptom assessments by patient, clinician, or date range.")
  @operationId("searchSymptomAssessments")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchSymptomAssessments(
    ...SymptomAssessmentSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<SymptomAssessment>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Hospice eligibility certification management — document, retrieve, update, and search hospice certification records.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/palliative/hospice-eligibility")
interface HospiceEligibilityManagement {
  @doc("Create a new hospice eligibility certification.")
  @operationId("createHospiceEligibility")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createHospiceEligibility(
    @body body: HospiceEligibility,
  ): {
    @statusCode statusCode: 201;
    @body result: HospiceEligibility;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a hospice eligibility certification by its logical ID.")
  @operationId("getHospiceEligibility")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getHospiceEligibility(
    @path @doc("HospiceEligibility logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: HospiceEligibility;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a hospice eligibility certification — used to record recertification or status changes.")
  @operationId("updateHospiceEligibility")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateHospiceEligibility(
    @path @doc("HospiceEligibility logical ID") id: UUID,
    @body body: HospiceEligibility,
  ): {
    @statusCode statusCode: 200;
    @body result: HospiceEligibility;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a hospice eligibility certification record.")
  @operationId("deleteHospiceEligibility")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteHospiceEligibility(
    @path @doc("HospiceEligibility logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search hospice eligibility certifications by patient, certifying physician, status, or date range.")
  @operationId("searchHospiceEligibilities")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchHospiceEligibilities(
    ...HospiceEligibilitySearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<HospiceEligibility>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Hospice IDT meeting management — document and retrieve interdisciplinary team care plan review meetings.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/palliative/idt-meetings")
interface HospiceIDTManagement {
  @doc("Document a new hospice IDT meeting.")
  @operationId("createHospiceIDTMeeting")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createHospiceIDTMeeting(
    @body body: HospiceIDTMeeting,
  ): {
    @statusCode statusCode: 201;
    @body result: HospiceIDTMeeting;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a hospice IDT meeting record by its logical ID.")
  @operationId("getHospiceIDTMeeting")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getHospiceIDTMeeting(
    @path @doc("HospiceIDTMeeting logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: HospiceIDTMeeting;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a hospice IDT meeting record.")
  @operationId("updateHospiceIDTMeeting")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateHospiceIDTMeeting(
    @path @doc("HospiceIDTMeeting logical ID") id: UUID,
    @body body: HospiceIDTMeeting,
  ): {
    @statusCode statusCode: 200;
    @body result: HospiceIDTMeeting;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a hospice IDT meeting record.")
  @operationId("deleteHospiceIDTMeeting")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteHospiceIDTMeeting(
    @path @doc("HospiceIDTMeeting logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search hospice IDT meeting records by patient, attendee, or date range.")
  @operationId("searchHospiceIDTMeetings")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchHospiceIDTMeetings(
    ...HospiceIDTSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<HospiceIDTMeeting>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
