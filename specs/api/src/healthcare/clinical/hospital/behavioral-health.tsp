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
 * Behavioral Health module.
 *
 * Provides models and operations for inpatient psychiatric and substance use
 * disorder care: psychiatric assessments, involuntary holds, behavioral health
 * treatment plans, and substance use assessments. Aligned with FHIR R4
 * Observation, EpisodeOfCare, and CarePlan resources.
 */
namespace Healthcare.Clinical.Hospital.BehavioralHealth;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Patient's legal admission status for psychiatric inpatient care.")
enum LegalStatus {
  @doc("The patient has voluntarily consented to inpatient psychiatric treatment")
  voluntary,

  @doc("The patient has been admitted against their will under applicable mental health legislation")
  involuntary,

  @doc("The patient is being held on an emergency psychiatric hold pending full evaluation")
  emergencyHold,
}

@doc("Type of involuntary psychiatric hold.")
enum HoldType {
  @doc("Short-term emergency hold for evaluation (typically 24–72 hours depending on jurisdiction)")
  emergencyHold,

  @doc("72-hour involuntary evaluation and treatment hold")
  seventyTwoHour,

  @doc("Involuntary commitment ordered by a court")
  courtOrdered,
}

@doc("Lifecycle status of an involuntary hold.")
enum HoldStatus {
  @doc("The hold is currently in effect")
  active,

  @doc("The original hold has been extended by clinical or legal action")
  extended,

  @doc("The hold has reached its maximum duration and lapsed without extension")
  expired,

  @doc("The patient has been discharged before the hold expired")
  discharged,

  @doc("The hold has been converted to a court-ordered commitment")
  converted,
}

@doc("Inpatient privileges granted to a behavioral health patient as part of their treatment plan.")
enum PatientPrivileges {
  @doc("Patient is restricted to the closed inpatient ward")
  openWard,

  @doc("Patient may access the hospital grounds with supervision")
  groundPrivileges,

  @doc("Patient may leave the unit with staff escort for therapeutic activities")
  offUnit,

  @doc("Patient may leave the facility on supervised or unsupervised passes")
  passes,
}

@doc("Validated substance use screening tool used for assessment.")
enum SubstanceScreeningTool {
  @doc("Alcohol Use Disorders Identification Test")
  audit,

  @doc("Drug Abuse Screening Test")
  dast,

  @doc("CAGE questionnaire for alcohol dependence")
  cage,

  @doc("Alcohol, Smoking and Substance Involvement Screening Test (WHO)")
  assist,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("Risk assessment levels documented as part of a psychiatric assessment.")
model RiskAssessment {
  @doc("Assessed level of suicide risk (none, low, moderate, high, imminent)")
  suicideRisk: string;

  @doc("Assessed level of homicide or harm-to-others risk (none, low, moderate, high)")
  homicideRisk: string;

  @doc("Assessed level of non-suicidal self-injury risk (none, low, moderate, high)")
  selfHarmRisk: string;

  @doc("Assessed level of elopement risk for inpatient patients (none, low, moderate, high)")
  elopementRisk: string;
}

@doc("Details of a patient's use of a specific substance.")
model SubstanceUseDetail {
  @doc("The substance used (SNOMED CT or RxNorm coded)")
  substance: CodeableConcept;

  @doc("Frequency of use (e.g., 'Daily', 'Weekly', 'Occasional')")
  frequency?: string;

  @doc("Date and time of last known use")
  lastUse?: utcDateTime;

  @doc("Route of administration (e.g., 'oral', 'intravenous', 'inhaled')")
  route?: string;

  @doc("Quantity typically used per episode (free text — e.g., '1 pint', '2–3 bags', '2 drinks/day')")
  quantity?: string;
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A structured psychiatric assessment documenting mental status, risk factors, legal status, and diagnoses for a behavioural health patient.")
model PsychiatricAssessment extends HealthcareBaseEntity {
  @doc("Reference to the Patient being assessed")
  patient: Reference;

  @doc("Reference to the Encounter during which this assessment was performed")
  encounter: Reference;

  @doc("Reference to the Practitioner (psychiatrist, psychologist, or APRN) who conducted the assessment")
  assessor: Reference;

  @doc("Date and time the assessment was performed")
  assessmentDate: utcDateTime;

  @doc("Patient's primary presenting problem or chief complaint in their own words or as documented by the assessor")
  presentingProblem: string;

  @doc("Mental status examination findings (orientation, affect, thought process, insight, judgment, etc.)")
  mentalStatusExam?: string;

  @doc("Structured risk assessment across four domains")
  riskAssessment: RiskAssessment;

  @doc("Safety plan agreed upon with the patient, including warning signs, coping strategies, and crisis contacts")
  safetyPlan?: string;

  @doc("Patient's legal admission status")
  legalStatus: LegalStatus;

  @doc("DSM-5 or ICD-10 psychiatric diagnoses established at this assessment (CodeableConcept[])")
  diagnoses?: CodeableConcept[];
}

@doc("An involuntary psychiatric hold record documenting the legal authority and timeline for holding a patient against their will.")
model InvoluntaryHold extends HealthcareBaseEntity {
  @doc("Reference to the Patient subject to this hold")
  patient: Reference;

  @doc("Reference to the Encounter during which this hold was initiated")
  encounter: Reference;

  @doc("Type of involuntary hold")
  type: HoldType;

  @doc("Reference to the Practitioner or Authority who initiated the hold")
  initiatedBy: Reference;

  @doc("Date and time the hold was initiated")
  initiatedAt: utcDateTime;

  @doc("Date and time at which the hold is scheduled to expire")
  expiresAt: utcDateTime;

  @doc("Date and time the hold was extended, if applicable")
  extendedAt?: utcDateTime;

  @doc("Date and time the patient was discharged from the hold, if before expiry")
  dischargedAt?: utcDateTime;

  @doc("Clinical and legal rationale for initiating the involuntary hold")
  reason: string;

  @doc("Current status of the hold")
  status: HoldStatus;

  @doc("Reference to the court order document, if a court-ordered commitment")
  courtOrderRef?: Reference;
}

@doc("A behavioral health treatment plan documenting goals, therapeutic interventions, restrictions, and patient privileges.")
model BehavioralHealthPlan extends HealthcareBaseEntity {
  @doc("Reference to the Patient this plan is for")
  patient: Reference;

  @doc("Reference to the Encounter associated with this treatment plan")
  encounter?: Reference;

  @doc("Reference to the Practitioner (psychiatrist or care team lead) responsible for this plan")
  provider: Reference;

  @doc("Therapeutic goals agreed upon with the patient and care team")
  goals?: string[];

  @doc("Therapeutic interventions prescribed (e.g., 'Individual therapy 3x/week', 'Group CBT', 'Medication management')")
  interventions?: string[];

  @doc("Behavioural restrictions in place (e.g., 'No sharps', 'No unsupervised bathroom access')")
  restrictions?: string[];

  @doc("Level of off-unit and off-facility privileges granted to the patient")
  privileges: PatientPrivileges;

  @doc("Restrictions on contacts or visitors (e.g., 'No contact with named individual', 'Supervised visits only')")
  contactRestrictions?: string;

  @doc("Current status of this treatment plan")
  status: string;
}

@doc("A substance use disorder assessment documenting the breadth and severity of a patient's substance use.")
model SubstanceUseAssessment extends HealthcareBaseEntity {
  @doc("Reference to the Patient being assessed")
  patient: Reference;

  @doc("Reference to the Encounter during which this assessment was performed")
  encounter: Reference;

  @doc("Reference to the Practitioner who conducted the assessment")
  assessor: Reference;

  @doc("Date and time the assessment was performed")
  assessmentDate: utcDateTime;

  @doc("List of substances used by the patient with frequency, route, and quantity details")
  substances: SubstanceUseDetail[];

  @doc("Validated screening tool used for quantitative assessment")
  screeningTool: SubstanceScreeningTool;

  @doc("Numerical score from the screening tool")
  score: float32;

  @doc("Risk level derived from the screening score (low, moderate, high, severe)")
  riskLevel: string;

  @doc("Whether a brief motivational intervention was delivered as part of this encounter")
  briefIntervention?: boolean;

  @doc("Whether the patient was referred to a substance use disorder treatment programme")
  referral?: boolean;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for psychiatric assessments.")
model PsychiatricAssessmentSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by assessor reference ID") @query assessor?: string;
  @doc("Filter by legal status") @query legalStatus?: LegalStatus;
  @doc("Filter assessments on or after this date") @query assessedFrom?: utcDateTime;
  @doc("Filter assessments on or before this date") @query assessedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for involuntary holds.")
model InvoluntaryHoldSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by hold type") @query type?: HoldType;
  @doc("Filter by hold status") @query status?: HoldStatus;
  @doc("Filter holds initiated at or after this date-time") @query initiatedFrom?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for behavioral health plans.")
model BehavioralHealthPlanSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by provider reference ID") @query provider?: string;
  @doc("Filter by plan status") @query status?: string;
  ...OffsetPaginationParams;
}

@doc("Search parameters for substance use assessments.")
model SubstanceUseAssessmentSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by assessor reference ID") @query assessor?: string;
  @doc("Filter by screening tool") @query screeningTool?: SubstanceScreeningTool;
  @doc("Filter by risk level") @query riskLevel?: string;
  @doc("Filter assessments on or after this date") @query assessedFrom?: utcDateTime;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Psychiatric assessment management — create and manage structured mental status and risk assessments for behavioral health patients.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/behavioral-health/psychiatric-assessments")
interface PsychiatricAssessmentManagement {
  @doc("Create a new psychiatric assessment.")
  @operationId("createPsychiatricAssessment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createPsychiatricAssessment(
    @body body: PsychiatricAssessment,
  ): {
    @statusCode statusCode: 201;
    @body result: PsychiatricAssessment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a psychiatric assessment by its logical ID.")
  @operationId("getPsychiatricAssessment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getPsychiatricAssessment(
    @path @doc("PsychiatricAssessment logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: PsychiatricAssessment;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a psychiatric assessment.")
  @operationId("updatePsychiatricAssessment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updatePsychiatricAssessment(
    @path @doc("PsychiatricAssessment logical ID") id: UUID,
    @body body: PsychiatricAssessment,
  ): {
    @statusCode statusCode: 200;
    @body result: PsychiatricAssessment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a psychiatric assessment.")
  @operationId("deletePsychiatricAssessment")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deletePsychiatricAssessment(
    @path @doc("PsychiatricAssessment logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search psychiatric assessments by patient, assessor, legal status, or date range.")
  @operationId("searchPsychiatricAssessments")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchPsychiatricAssessments(
    ...PsychiatricAssessmentSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<PsychiatricAssessment>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Involuntary hold management — initiate, extend, and discharge patients held under mental health legislation.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/behavioral-health/involuntary-holds")
interface InvoluntaryHoldManagement {
  @doc("Initiate an involuntary psychiatric hold.")
  @operationId("createInvoluntaryHold")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createInvoluntaryHold(
    @body body: InvoluntaryHold,
  ): {
    @statusCode statusCode: 201;
    @body result: InvoluntaryHold;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve an involuntary hold by its logical ID.")
  @operationId("getInvoluntaryHold")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getInvoluntaryHold(
    @path @doc("InvoluntaryHold logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: InvoluntaryHold;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an involuntary hold — used to record extensions, discharge, or conversion to court order.")
  @operationId("updateInvoluntaryHold")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateInvoluntaryHold(
    @path @doc("InvoluntaryHold logical ID") id: UUID,
    @body body: InvoluntaryHold,
  ): {
    @statusCode statusCode: 200;
    @body result: InvoluntaryHold;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an involuntary hold record.")
  @operationId("deleteInvoluntaryHold")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteInvoluntaryHold(
    @path @doc("InvoluntaryHold logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search involuntary holds by patient, type, or status.")
  @operationId("searchInvoluntaryHolds")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchInvoluntaryHolds(
    ...InvoluntaryHoldSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<InvoluntaryHold>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Behavioral health plan management — create and maintain individualized inpatient psychiatric treatment plans.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/behavioral-health/plans")
interface BehavioralHealthPlanManagement {
  @doc("Create a new behavioral health treatment plan.")
  @operationId("createBehavioralHealthPlan")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createBehavioralHealthPlan(
    @body body: BehavioralHealthPlan,
  ): {
    @statusCode statusCode: 201;
    @body result: BehavioralHealthPlan;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a behavioral health plan by its logical ID.")
  @operationId("getBehavioralHealthPlan")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getBehavioralHealthPlan(
    @path @doc("BehavioralHealthPlan logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: BehavioralHealthPlan;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a behavioral health treatment plan.")
  @operationId("updateBehavioralHealthPlan")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateBehavioralHealthPlan(
    @path @doc("BehavioralHealthPlan logical ID") id: UUID,
    @body body: BehavioralHealthPlan,
  ): {
    @statusCode statusCode: 200;
    @body result: BehavioralHealthPlan;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a behavioral health treatment plan.")
  @operationId("deleteBehavioralHealthPlan")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteBehavioralHealthPlan(
    @path @doc("BehavioralHealthPlan logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search behavioral health plans by patient, provider, or status.")
  @operationId("searchBehavioralHealthPlans")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchBehavioralHealthPlans(
    ...BehavioralHealthPlanSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<BehavioralHealthPlan>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Substance use assessment management — screen, assess, and document substance use disorders using validated tools.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/behavioral-health/substance-use-assessments")
interface SubstanceUseAssessmentManagement {
  @doc("Create a new substance use assessment.")
  @operationId("createSubstanceUseAssessment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createSubstanceUseAssessment(
    @body body: SubstanceUseAssessment,
  ): {
    @statusCode statusCode: 201;
    @body result: SubstanceUseAssessment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a substance use assessment by its logical ID.")
  @operationId("getSubstanceUseAssessment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getSubstanceUseAssessment(
    @path @doc("SubstanceUseAssessment logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: SubstanceUseAssessment;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a substance use assessment.")
  @operationId("updateSubstanceUseAssessment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateSubstanceUseAssessment(
    @path @doc("SubstanceUseAssessment logical ID") id: UUID,
    @body body: SubstanceUseAssessment,
  ): {
    @statusCode statusCode: 200;
    @body result: SubstanceUseAssessment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a substance use assessment.")
  @operationId("deleteSubstanceUseAssessment")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteSubstanceUseAssessment(
    @path @doc("SubstanceUseAssessment logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search substance use assessments by patient, assessor, screening tool, or risk level.")
  @operationId("searchSubstanceUseAssessments")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchSubstanceUseAssessments(
    ...SubstanceUseAssessmentSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<SubstanceUseAssessment>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
