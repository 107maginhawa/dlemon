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
 * Rehabilitation Therapy module — PT / OT / SLP.
 *
 * Covers the full rehabilitation lifecycle: referral intake, initial
 * evaluation and goal-setting, individual treatment session documentation,
 * and standardised functional outcome measurement. Aligns with FHIR
 * ServiceRequest, CarePlan, Procedure, and Observation resources.
 * Supports CMS therapy cap tracking and FOTO/PROM reporting.
 */
namespace Healthcare.Clinical.Hospital.Specialty.RehabTherapy;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Rehabilitation therapy discipline.")
enum RehabDiscipline {
  @doc("Physical therapy — restoring movement, strength, and functional mobility")
  physicalTherapy,
  @doc("Occupational therapy — restoring independence in activities of daily living")
  occupationalTherapy,
  @doc("Speech-language pathology — addressing communication, cognition, and swallowing disorders")
  speechLanguagePathology,
}

@doc("Lifecycle status of a rehabilitation referral.")
enum RehabReferralStatus {
  @doc("Referral received but not yet assigned to a therapist")
  pending,
  @doc("Referral has been accepted by the therapy department")
  accepted,
  @doc("Initial evaluation has been completed and therapy is underway")
  inProgress,
  @doc("Patient has met goals or reached a maintenance plateau and been discharged")
  completed,
  @doc("Patient was discharged from the programme before goals were met")
  discharged,
  @doc("Referral was cancelled before evaluation")
  cancelled,
}

@doc("Lifecycle status of a rehabilitation goal.")
enum RehabGoalStatus {
  @doc("Goal has been set but no progress has been made")
  notStarted,
  @doc("Patient is working towards this goal")
  inProgress,
  @doc("Goal has been fully achieved")
  met,
  @doc("Goal was partially achieved at discharge")
  partiallyMet,
  @doc("Goal was not achieved by the target date or at discharge")
  notMet,
  @doc("Goal was discontinued due to clinical change or patient preference")
  discontinued,
}

@doc("Level of therapist or caregiver assistance required by the patient to perform an activity.")
enum AssistanceLevel {
  @doc("Patient performs activity safely without any cueing, supervision, or physical assistance")
  independent,
  @doc("Therapist is present for safety but provides no physical assistance")
  supervised,
  @doc("Therapist provides up to 25% physical assistance")
  minAssist,
  @doc("Therapist provides 26–50% physical assistance")
  modAssist,
  @doc("Therapist provides 51–75% physical assistance")
  maxAssist,
  @doc("Therapist provides more than 75% of the effort")
  dependent,
}

@doc("Validated functional outcome measurement tool used in rehabilitation.")
enum FunctionalTool {
  @doc("Functional Independence Measure (FIM) — 18-item functional assessment (18–126 scale)")
  fim,
  @doc("Barthel Index — 10-item activities of daily living scale (0–100)")
  barthel,
  @doc("Berg Balance Scale — 14-item balance assessment (0–56)")
  berg,
  @doc("Tinetti Balance Assessment (0–16)")
  tinettiBalance,
  @doc("Tinetti Gait Assessment (0–12)")
  tinettiGait,
  @doc("Six Minute Walk Test — distance walked in 6 minutes in metres")
  sixMinuteWalk,
  @doc("Timed Up and Go (TUG) Test — time in seconds to rise, walk 3m, return, sit")
  tugTest,
  @doc("DASH Score — Disabilities of the Arm, Shoulder, and Hand (0–100, lower = less disability)")
  dashScore,
  @doc("Grip strength measured in kg using a dynamometer")
  gripStrength,
  @doc("Range of motion measured in degrees using a goniometer")
  rangeOfMotion,
  @doc("Amputee Mobility Predictor (AMP) — predicts ambulatory potential for lower limb amputees")
  amputeeMobility,
  @doc("Another validated tool not listed above — specify in interpretation field")
  other,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("A measurable rehabilitation goal with a target date and progress status.")
model RehabGoal {
  @doc("Narrative description of the goal (e.g., 'Patient will ambulate 150 feet with rolling walker independently')")
  description: string;

  @doc("Target date by which the goal should be achieved")
  targetDate?: plainDate;

  @doc("Observable, measurable outcome criterion for goal attainment")
  measurableOutcome: string;

  @doc("Current status of this goal")
  status: RehabGoalStatus;
}

@doc("A specific therapeutic intervention delivered during a rehabilitation session.")
model RehabIntervention {
  @doc("Type of intervention (SNOMED CT or facility-defined code — e.g., therapeutic exercise, gait training, manual therapy)")
  type: CodeableConcept;

  @doc("Narrative description of the specific intervention performed")
  description: string;

  @doc("Number of sets performed (for exercise-based interventions)")
  sets?: int32;

  @doc("Number of repetitions per set")
  reps?: int32;

  @doc("Duration of the intervention in minutes")
  duration?: int32;

  @doc("Level of assistance the patient required to perform this intervention")
  assistanceLevel?: AssistanceLevel;
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A rehabilitation therapy referral initiating an episode of PT, OT, or SLP care. Extends HealthcareBaseEntity.")
model RehabReferral extends HealthcareBaseEntity {
  @doc("Reference to the Patient for whom rehabilitation is being requested")
  patient: Reference;

  @doc("Reference to the Encounter, if the referral originated during a hospitalisation or clinic visit")
  encounter?: Reference;

  @doc("Reference to the Practitioner who placed the referral")
  referringProvider: Reference;

  @doc("Therapy discipline being requested")
  discipline: RehabDiscipline;

  @doc("Primary diagnosis driving the rehabilitation need (SNOMED CT or ICD-10 coded)")
  diagnosis: CodeableConcept;

  @doc("Clinical reason for the referral")
  reason: string;

  @doc("Recommended treatment frequency (e.g., '3x/week', 'daily')")
  frequency?: string;

  @doc("Recommended treatment duration (e.g., '6 weeks', '12 sessions')")
  duration?: string;

  @doc("Clinical precautions or contraindications the treating therapist should observe")
  precautions?: string[];

  @doc("Current lifecycle status of the referral")
  status: RehabReferralStatus;
}

@doc("A rehabilitation therapy evaluation documenting baseline function, impairments, goals, and the treatment plan. Extends HealthcareBaseEntity.")
model RehabEvaluation extends HealthcareBaseEntity {
  @doc("Reference to the Patient being evaluated")
  patient: Reference;

  @doc("Reference to the Encounter, if the evaluation was performed in an inpatient or clinic setting")
  encounter?: Reference;

  @doc("Reference to the Practitioner (therapist) who performed the evaluation")
  therapist: Reference;

  @doc("Therapy discipline of the evaluating therapist")
  discipline: RehabDiscipline;

  @doc("Date the initial evaluation was performed")
  evaluationDate: utcDateTime;

  @doc("Primary diagnosis being addressed in rehabilitation (SNOMED CT or ICD-10 coded)")
  diagnosis: CodeableConcept;

  @doc("Patient's functional limitations identified during evaluation")
  functionalLimitations: string[];

  @doc("Patient's prior level of function before the current illness, injury, or surgery")
  priorLevel: string;

  @doc("Patient's current level of function at time of evaluation")
  currentLevel: string;

  @doc("Measurable rehabilitation goals agreed upon with the patient and care team")
  goals: RehabGoal[];

  @doc("Narrative description of the planned treatment approach and interventions")
  treatmentPlan: string;

  @doc("Recommended therapy frequency (e.g., '5x/week', 'BID')")
  frequencyRecommended: string;

  @doc("Recommended duration of the treatment programme (e.g., '4 weeks', '20 sessions')")
  durationRecommended: string;

  @doc("Free-text clinical note from the evaluating therapist")
  note?: string;
}

@doc("Documentation of a single rehabilitation therapy treatment session. Extends HealthcareBaseEntity.")
model RehabSession extends HealthcareBaseEntity {
  @doc("Reference to the Patient receiving therapy")
  patient: Reference;

  @doc("Reference to the Encounter, if performed in an inpatient or outpatient clinic setting")
  encounter?: Reference;

  @doc("Reference to the Practitioner (therapist) who delivered the session")
  therapist: Reference;

  @doc("Therapy discipline delivered in this session")
  discipline: RehabDiscipline;

  @doc("Date the session was delivered")
  sessionDate: utcDateTime;

  @doc("Duration of the treatment session in minutes")
  duration: int32;

  @doc("List of therapeutic interventions performed during the session")
  interventions: RehabIntervention[];

  @doc("Narrative description of the patient's response to treatment during this session")
  patientResponse?: string;

  @doc("Progress made toward established rehabilitation goals during this session")
  progressTowardGoals?: string;

  @doc("Whether a home exercise programme was provided or updated during this session")
  homeExerciseProvided?: boolean;

  @doc("Free-text note from the treating therapist")
  note?: string;
}

@doc("A standardised functional outcome measurement recorded at a point in time during or after a rehabilitation episode. Extends HealthcareBaseEntity.")
model FunctionalOutcomeMeasure extends HealthcareBaseEntity {
  @doc("Reference to the Patient being assessed")
  patient: Reference;

  @doc("Therapy discipline conducting the outcome measurement")
  discipline: RehabDiscipline;

  @doc("Validated functional outcome measurement tool used")
  tool: FunctionalTool;

  @doc("Score achieved by the patient on the selected tool")
  score: float64;

  @doc("Maximum possible score for the selected tool (for percentage calculation)")
  maxScore?: float64;

  @doc("Date and time the outcome measurement was administered")
  assessedAt: utcDateTime;

  @doc("Reference to the Practitioner who administered the outcome measure")
  assessedBy: Reference;

  @doc("Clinical interpretation of the score (e.g., 'Score indicates high fall risk — implement fall prevention protocol')")
  interpretation?: string;

  @doc("Change in score compared to the baseline measurement at evaluation (positive = improvement)")
  comparedToBaseline?: float64;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for rehabilitation referrals.")
model RehabReferralSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by referring provider reference ID") @query referringProvider?: string;
  @doc("Filter by therapy discipline") @query discipline?: RehabDiscipline;
  @doc("Filter by referral status") @query status?: RehabReferralStatus;
  ...OffsetPaginationParams;
}

@doc("Search parameters for rehabilitation evaluations.")
model RehabEvaluationSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by therapist reference ID") @query therapist?: string;
  @doc("Filter by therapy discipline") @query discipline?: RehabDiscipline;
  @doc("Filter evaluations performed at or after this date-time") @query evaluatedFrom?: utcDateTime;
  @doc("Filter evaluations performed at or before this date-time") @query evaluatedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for rehabilitation treatment sessions.")
model RehabSessionSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by therapist reference ID") @query therapist?: string;
  @doc("Filter by therapy discipline") @query discipline?: RehabDiscipline;
  @doc("Filter sessions on or after this date") @query sessionFrom?: utcDateTime;
  @doc("Filter sessions on or before this date") @query sessionTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for functional outcome measures.")
model FunctionalOutcomeSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by therapy discipline") @query discipline?: RehabDiscipline;
  @doc("Filter by outcome tool") @query tool?: FunctionalTool;
  @doc("Filter measures recorded at or after this date-time") @query assessedFrom?: utcDateTime;
  @doc("Filter measures recorded at or before this date-time") @query assessedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Rehabilitation referral management — intake, track, and update PT/OT/SLP referrals.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/rehab-therapy/referrals")
interface RehabReferralManagement {
  @doc("Create a new rehabilitation therapy referral.")
  @operationId("createRehabReferral")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createRehabReferral(
    @body body: RehabReferral,
  ): {
    @statusCode statusCode: 201;
    @body result: RehabReferral;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a rehabilitation referral by its logical ID.")
  @operationId("getRehabReferral")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getRehabReferral(
    @path @doc("RehabReferral logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: RehabReferral;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a rehabilitation referral.")
  @operationId("updateRehabReferral")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateRehabReferral(
    @path @doc("RehabReferral logical ID") id: UUID,
    @body body: RehabReferral,
  ): {
    @statusCode statusCode: 200;
    @body result: RehabReferral;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a rehabilitation referral.")
  @operationId("deleteRehabReferral")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteRehabReferral(
    @path @doc("RehabReferral logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search rehabilitation referrals by patient, discipline, referring provider, or status.")
  @operationId("searchRehabReferrals")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchRehabReferrals(
    ...RehabReferralSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<RehabReferral>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Rehabilitation evaluation management — create, retrieve, update, and search initial therapy evaluations.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/rehab-therapy/evaluations")
interface RehabEvaluationManagement {
  @doc("Create a new rehabilitation evaluation.")
  @operationId("createRehabEvaluation")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createRehabEvaluation(
    @body body: RehabEvaluation,
  ): {
    @statusCode statusCode: 201;
    @body result: RehabEvaluation;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a rehabilitation evaluation by its logical ID.")
  @operationId("getRehabEvaluation")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getRehabEvaluation(
    @path @doc("RehabEvaluation logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: RehabEvaluation;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a rehabilitation evaluation.")
  @operationId("updateRehabEvaluation")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateRehabEvaluation(
    @path @doc("RehabEvaluation logical ID") id: UUID,
    @body body: RehabEvaluation,
  ): {
    @statusCode statusCode: 200;
    @body result: RehabEvaluation;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a rehabilitation evaluation.")
  @operationId("deleteRehabEvaluation")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteRehabEvaluation(
    @path @doc("RehabEvaluation logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search rehabilitation evaluations by patient, therapist, discipline, or date range.")
  @operationId("searchRehabEvaluations")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchRehabEvaluations(
    ...RehabEvaluationSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<RehabEvaluation>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Rehabilitation session management — document and retrieve individual therapy treatment sessions.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/rehab-therapy/sessions")
interface RehabSessionManagement {
  @doc("Document a new rehabilitation therapy session.")
  @operationId("createRehabSession")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createRehabSession(
    @body body: RehabSession,
  ): {
    @statusCode statusCode: 201;
    @body result: RehabSession;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a rehabilitation session by its logical ID.")
  @operationId("getRehabSession")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getRehabSession(
    @path @doc("RehabSession logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: RehabSession;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a rehabilitation session note or intervention details.")
  @operationId("updateRehabSession")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateRehabSession(
    @path @doc("RehabSession logical ID") id: UUID,
    @body body: RehabSession,
  ): {
    @statusCode statusCode: 200;
    @body result: RehabSession;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a rehabilitation session record.")
  @operationId("deleteRehabSession")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteRehabSession(
    @path @doc("RehabSession logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search rehabilitation sessions by patient, therapist, discipline, or date range.")
  @operationId("searchRehabSessions")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchRehabSessions(
    ...RehabSessionSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<RehabSession>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Functional outcome measure management — record and track standardised outcome scores over a rehabilitation episode.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/rehab-therapy/outcome-measures")
interface FunctionalOutcomeManagement {
  @doc("Record a new functional outcome measure score.")
  @operationId("createFunctionalOutcome")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createFunctionalOutcome(
    @body body: FunctionalOutcomeMeasure,
  ): {
    @statusCode statusCode: 201;
    @body result: FunctionalOutcomeMeasure;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a functional outcome measure by its logical ID.")
  @operationId("getFunctionalOutcome")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getFunctionalOutcome(
    @path @doc("FunctionalOutcomeMeasure logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: FunctionalOutcomeMeasure;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a functional outcome measure record.")
  @operationId("updateFunctionalOutcome")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateFunctionalOutcome(
    @path @doc("FunctionalOutcomeMeasure logical ID") id: UUID,
    @body body: FunctionalOutcomeMeasure,
  ): {
    @statusCode statusCode: 200;
    @body result: FunctionalOutcomeMeasure;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a functional outcome measure record.")
  @operationId("deleteFunctionalOutcome")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteFunctionalOutcome(
    @path @doc("FunctionalOutcomeMeasure logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search functional outcome measures by patient, discipline, tool, or date range.")
  @operationId("searchFunctionalOutcomes")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchFunctionalOutcomes(
    ...FunctionalOutcomeSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<FunctionalOutcomeMeasure>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
