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
 * Social Determinants of Health (SDOH) module.
 *
 * Provides CMS-mandated models and operations for SDOH screening, community
 * referrals, and social care goals. Implements the Gravity Project FHIR
 * Implementation Guide for interoperable SDOH data exchange.
 *
 * Supports validated instruments including AHC-HRSN, PRAPARE, and PREPARE
 * screening tools. Covers all CMS-required SDOH domains.
 *
 * @see https://hl7.org/fhir/us/sdoh-clinicalcare/
 */
namespace Healthcare.Support.SDOH;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Current workflow status of an SDOH screening encounter.")
enum SDOHScreeningStatus {
  @doc("Screening is planned but not yet started")
  planned,

  @doc("Screening is currently being administered")
  inProgress,

  @doc("Screening has been fully completed")
  completed,

  @doc("Screening was cancelled before completion")
  cancelled,

  @doc("Screening record was entered in error and should not be used")
  enteredInError,
}

@doc("Current workflow status of an SDOH referral to a community service.")
enum SDOHReferralStatus {
  @doc("Referral has been created but not yet submitted")
  draft,

  @doc("Referral is active and awaiting acceptance or completion by the recipient")
  active,

  @doc("Referral has been temporarily placed on hold")
  onHold,

  @doc("Referral has been fulfilled — the service was provided")
  completed,

  @doc("Referral was cancelled before the service was provided")
  cancelled,

  @doc("Referral was created in error and should not be used")
  enteredInError,
}

@doc("Social determinant of health domain categories. Aligned with Gravity Project SDOH Clinical Care IG and CMS mandatory screening domains.")
enum SDOHCategory {
  @doc("Lack of stable, safe, or adequate housing; includes homelessness and housing quality concerns")
  housingInstability,

  @doc("Limited or uncertain access to adequate, nutritious food")
  foodInsecurity,

  @doc("Lack of reliable transportation that affects access to healthcare, food, work, or education")
  transportationInsecurity,

  @doc("Difficulty paying utility bills (electricity, heat, water) that may affect health and safety")
  utilityDifficulties,

  @doc("Exposure to intimate partner violence, domestic abuse, or other forms of interpersonal violence")
  interpersonalViolence,

  @doc("Educational attainment, literacy, or ongoing educational barriers that affect health outcomes")
  education,

  @doc("Employment status, job quality, working conditions, or occupational hazards")
  employment,

  @doc("Financial insecurity, material hardship, or inability to meet basic needs")
  financialStrain,

  @doc("Special health considerations related to military service or veteran status")
  veteranStatus,

  @doc("Social isolation, loneliness, or lack of social support networks")
  socialIsolation,

  @doc("Stress, depression, anxiety, and other mental health concerns related to social circumstances")
  stressAndMentalHealth,
}

@doc("Overall SDOH risk level determined after scoring a completed screening instrument.")
enum SDOHRiskLevel {
  @doc("Screening identified no actionable social risk factors")
  noRisk,

  @doc("One or more low-severity risk factors identified; monitoring recommended")
  low,

  @doc("Moderate social risk factors identified; care team discussion recommended")
  medium,

  @doc("High social risk factors identified; immediate referral or intervention warranted")
  high,
}

@doc("Goal lifecycle status for SDOH goals. Mirrors GoalLifecycleStatus from FHIR R4 Goal resource.")
enum SDOHGoalLifecycleStatus {
  @doc("A goal has been proposed for this patient")
  proposed,

  @doc("A goal has been planned for this patient")
  planned,

  @doc("A proposed goal was accepted or acknowledged")
  accepted,

  @doc("The goal is being actively pursued")
  active,

  @doc("The goal remains a long-term objective but current need requires focus elsewhere")
  onHold,

  @doc("The goal has been achieved")
  completed,

  @doc("The goal has been abandoned")
  cancelled,

  @doc("The goal was created in error and should not be used")
  enteredInError,

  @doc("A proposed goal was rejected")
  rejected,
}

// ---------------------------------------------------------------------------
// Supporting models — SDOHScreening
// ---------------------------------------------------------------------------

/**
 * An individual question-and-answer pair within an SDOH screening instrument.
 * Captures both the question (coded) and the patient's response (coded), plus
 * optional numeric score and SDOH category assignment.
 */
model SDOHScreeningResponse {
  /** The coded question from the screening instrument. */
  question: CodeableConcept;

  /** The patient's response, coded per the instrument's value set. */
  answer: CodeableConcept;

  /** Numeric score assigned to this response per the instrument's scoring algorithm. */
  score?: int32;

  /** The SDOH domain category this response maps to. */
  category?: SDOHCategory;
}

// ---------------------------------------------------------------------------
// Root resource — SDOHScreening
// ---------------------------------------------------------------------------

/**
 * Records the administration of a validated SDOH screening instrument to a
 * patient. Captures all responses, scores, and the resulting risk level.
 * Aligned with the Gravity Project SDOHClinicalCare IG Questionnaire/QuestionnaireResponse.
 */
model SDOHScreening extends HealthcareBaseEntity {
  /** Current workflow status of the screening. */
  status: SDOHScreeningStatus;

  /** The patient being screened. */
  patient: Reference;

  /** The encounter during which this screening was administered. */
  encounter?: Reference;

  /** The individual or organization that performed the screening. */
  performer?: Reference;

  /** Date and time the screening was administered. */
  date: utcDateTime;

  /**
   * The validated screening instrument used (e.g., AHC-HRSN, PRAPARE,
   * Protocol for Responding to and Assessing Patients' Assets, Risks,
   * and Experiences). Coded using LOINC panel codes.
   */
  instrument: CodeableConcept;

  /** SDOH domains assessed by this screening. */
  category: SDOHCategory[];

  /** Individual question-and-answer pairs from the screening instrument. */
  responses: SDOHScreeningResponse[];

  /** Overall SDOH risk level determined from the screening scores. */
  riskLevel?: SDOHRiskLevel;

  /** Additional clinical notes about the screening or its context. */
  note?: Annotation[];
}

// ---------------------------------------------------------------------------
// Root resource — SDOHReferral
// ---------------------------------------------------------------------------

/**
 * Records a referral from a healthcare provider to a community-based
 * organization or social service to address an identified SDOH need.
 * Aligned with Gravity Project Task/ServiceRequest patterns for community referrals.
 */
model SDOHReferral extends HealthcareBaseEntity {
  /** Current workflow status of the referral. */
  status: SDOHReferralStatus;

  /** The patient for whom the referral is being made. */
  patient: Reference;

  /** The SDOH screening that identified the need prompting this referral. */
  screening?: Reference;

  /** The SDOH domain category being addressed by this referral. */
  category: SDOHCategory;

  /** The type of community service being requested (e.g., food bank, housing assistance). */
  serviceType: CodeableConcept;

  /** The community-based organization or service recipient to whom the referral is directed. */
  recipient?: Reference;

  /** The practitioner or care team member making the referral. */
  requester: Reference;

  /** Date and time the referral was authored. */
  authoredOn: utcDateTime;

  /** A description of the patient's need and any instructions for the receiving organization. */
  description?: string;

  /** Clinical notes about the referral or patient's social circumstances. */
  note?: Annotation[];

  /** Coded outcome of the referral (e.g., accepted, declined, completed). */
  outcome?: CodeableConcept;

  /** Free-text notes about the referral outcome. */
  outcomeNote?: string;
}

// ---------------------------------------------------------------------------
// Supporting models — SDOHGoal
// ---------------------------------------------------------------------------

/**
 * Target outcome criteria for an SDOH goal.
 */
model SDOHGoalTarget {
  /** The parameter whose value is being tracked (e.g., housing stability score). */
  measure?: CodeableConcept;

  /** A free-text description of the target outcome. */
  detailString?: string;

  /** The date by which the goal target should be achieved. */
  dueDate?: plainDate;
}

// ---------------------------------------------------------------------------
// Root resource — SDOHGoal
// ---------------------------------------------------------------------------

/**
 * Records a social care goal established for a patient to address an
 * identified SDOH need. SDOH goals complement clinical goals (Goal resource)
 * and are linked to screening findings and community referrals.
 */
model SDOHGoal extends HealthcareBaseEntity {
  /** The state of the goal throughout its lifecycle. */
  lifecycleStatus: SDOHGoalLifecycleStatus;

  /** The SDOH domain category this goal addresses. */
  category: SDOHCategory;

  /** Human-readable and/or coded description of the desired social care outcome. */
  description: CodeableConcept;

  /** The patient for whom the goal is established. */
  subject: Reference;

  /** The date after which the goal should begin being pursued. */
  startDate?: plainDate;

  /** Measurable target outcome for the goal. */
  target?: SDOHGoalTarget;

  /** Additional notes about the goal or its clinical context. */
  note?: Annotation[];
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

/** Query parameters for searching SDOHScreening resources. */
model SDOHScreeningSearchParams {
  /** Filter by patient reference id. */
  @query patient?: string;

  /** Filter by SDOH category. */
  @query category?: string;

  /** Filter by screening status. */
  @query status?: string;

  /** Filter by screening date (ISO 8601 date, searches from this date onwards). */
  @query date?: string;

  /** Filter by risk level. */
  @query riskLevel?: string;

  /** Filter by instrument code. */
  @query instrument?: string;

  /** Filter by performer reference id. */
  @query performer?: string;

  /** Page number (1-based). */
  @query page?: int32;

  /** Number of results per page. */
  @query pageSize?: int32;
}

/** Query parameters for searching SDOHReferral resources. */
model SDOHReferralSearchParams {
  /** Filter by patient reference id. */
  @query patient?: string;

  /** Filter by SDOH category. */
  @query category?: string;

  /** Filter by referral status. */
  @query status?: string;

  /** Filter by service type code. */
  @query serviceType?: string;

  /** Filter by recipient (community organization) reference id. */
  @query recipient?: string;

  /** Filter by requester reference id. */
  @query requester?: string;

  /** Page number (1-based). */
  @query page?: int32;

  /** Number of results per page. */
  @query pageSize?: int32;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for SDOHScreening resources.
 */
@tag("Healthcare:Support")
@useAuth(bearerAuth)
interface SDOHScreeningManagement {
  /** Create a new SDOHScreening. */
  @post
  @operationId("createSDOHScreening")
  create(
    @body body: SDOHScreening,
  ): {
    @statusCode statusCode: 201;
    @body screening: SDOHScreening;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Retrieve a single SDOHScreening by id. */
  @get
  @operationId("getSDOHScreening")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body screening: SDOHScreening;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Replace an existing SDOHScreening. */
  @put
  @operationId("updateSDOHScreening")
  @route("/{id}")
  update(
    @path id: string,
    @body body: SDOHScreening,
  ): {
    @statusCode statusCode: 200;
    @body screening: SDOHScreening;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Partially update an SDOHScreening. */
  @patch
  @operationId("patchSDOHScreening")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body screening: SDOHScreening;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Delete an SDOHScreening by id. */
  @delete
  @operationId("deleteSDOHScreening")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Search for SDOHScreenings using filter parameters. */
  @get
  @operationId("searchSDOHScreenings")
  @route("/search")
  search(
    ...SDOHScreeningSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<SDOHScreening>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD and search operations for SDOHReferral resources.
 */
@tag("Healthcare:Support")
@useAuth(bearerAuth)
interface SDOHReferralManagement {
  /** Create a new SDOHReferral. */
  @post
  @operationId("createSDOHReferral")
  create(
    @body body: SDOHReferral,
  ): {
    @statusCode statusCode: 201;
    @body referral: SDOHReferral;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Retrieve a single SDOHReferral by id. */
  @get
  @operationId("getSDOHReferral")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body referral: SDOHReferral;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Replace an existing SDOHReferral. */
  @put
  @operationId("updateSDOHReferral")
  @route("/{id}")
  update(
    @path id: string,
    @body body: SDOHReferral,
  ): {
    @statusCode statusCode: 200;
    @body referral: SDOHReferral;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Partially update an SDOHReferral. */
  @patch
  @operationId("patchSDOHReferral")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body referral: SDOHReferral;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Delete an SDOHReferral by id. */
  @delete
  @operationId("deleteSDOHReferral")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Search for SDOHReferrals using filter parameters. */
  @get
  @operationId("searchSDOHReferrals")
  @route("/search")
  search(
    ...SDOHReferralSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<SDOHReferral>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
