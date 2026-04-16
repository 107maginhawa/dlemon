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
 * Healthcare Clinical Nursing Assessment — structured nursing assessments including
 * general nursing evaluation, fall risk, pressure injury risk, and pain assessment
 * tools for inpatient and outpatient encounters.
 */
namespace Healthcare.Clinical.Hospital.NursingAssessment;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The type of nursing assessment performed.")
enum NursingAssessmentType {
  @doc("Comprehensive assessment performed at time of admission")
  admission,

  @doc("Routine assessment performed at the start or end of a nursing shift")
  shift,

  @doc("Focused assessment targeted at a specific clinical concern")
  focused,

  @doc("Assessment performed in preparation for patient discharge")
  discharge,

  @doc("Assessment performed when transferring a patient between units")
  transfer,

  @doc("Assessment performed following a fall event")
  fall,

  @doc("Assessment of patient pain")
  pain,

  @doc("Assessment of skin integrity")
  skin,

  @doc("Nutritional status assessment")
  nutrition,

  @doc("Assessment of patient functional status and independence")
  functional,
}

@doc("The completion status of an assessment.")
enum AssessmentStatus {
  @doc("The assessment has been started but not yet completed")
  inProgress,

  @doc("The assessment is complete")
  completed,

  @doc("A completed assessment that has been subsequently corrected")
  amended,
}

@doc("The validated tool used to assess fall risk.")
enum FallRiskTool {
  @doc("Morse Fall Scale — validated adult fall risk tool")
  morse,

  @doc("Hendrich II Fall Risk Model")
  hendrich,

  @doc("Humpty Dumpty Falls Scale — paediatric fall risk tool")
  humptyDumpty,

  @doc("STRATIFY fall risk assessment tool")
  stratify,
}

@doc("The validated tool used to assess pressure injury risk.")
enum PressureInjuryTool {
  @doc("Braden Scale for Predicting Pressure Sore Risk")
  braden,

  @doc("Norton Pressure Sore Risk Assessment Scale")
  norton,

  @doc("Waterlow Pressure Ulcer Risk Assessment")
  waterlow,
}

@doc("A categorical risk level derived from an assessment score.")
enum RiskLevel {
  @doc("Low risk — routine care is sufficient")
  low,

  @doc("Moderate risk — enhanced monitoring and prevention measures required")
  moderate,

  @doc("High risk — intensive prevention measures and frequent reassessment required")
  high,
}

@doc("The pain assessment scale used.")
enum PainScale {
  @doc("Numeric Rating Scale (0–10)")
  numeric,

  @doc("Visual Analogue Scale")
  vas,

  @doc("Wong-Baker FACES Pain Rating Scale")
  faces,

  @doc("Face, Legs, Activity, Cry, Consolability scale — paediatric/non-verbal")
  flacc,

  @doc("Critical-Care Pain Observation Tool — ICU/ventilated patients")
  cpot,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("A wound or pressure injury record documenting location, characteristics, and treatment.")
model WoundRecord {
  @doc("Anatomical location of the wound")
  location: CodeableConcept;

  @doc("Classification or type of wound")
  type: CodeableConcept;

  @doc("Pressure injury stage (1–4, unstageable, deep tissue injury)")
  stage?: int32;

  @doc("Length of the wound")
  length?: Quantity;

  @doc("Width of the wound")
  width?: Quantity;

  @doc("Depth of the wound")
  depth?: Quantity;

  @doc("Description of wound drainage (e.g., none, serous, sanguineous)")
  @maxLength(200)
  drainage?: string;

  @doc("Description of wound bed appearance (e.g., granulation, slough, eschar)")
  @maxLength(500)
  appearance?: string;

  @doc("Wound treatment applied")
  @maxLength(500)
  treatment?: string;
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

@doc("A general nursing assessment capturing structured findings for a patient encounter.")
model NursingAssessment extends HealthcareBaseEntity {
  @doc("The patient who was assessed")
  patient: Reference;

  @doc("The encounter during which the assessment was performed")
  encounter: Reference;

  @doc("The type of nursing assessment performed")
  assessmentType: NursingAssessmentType;

  @doc("The nurse or clinician who performed the assessment")
  performer: Reference;

  @doc("The date and time the assessment was performed")
  performedAt: utcDateTime;

  @doc("The current completion status of the assessment")
  status: AssessmentStatus;

  @doc("Structured assessment findings (schema varies by assessmentType)")
  findings: Record<unknown>;

  @doc("Additional free-text or coded annotations")
  note?: Annotation[];
}

@doc("A validated fall risk assessment using a standardised tool.")
model FallRiskAssessment extends HealthcareBaseEntity {
  @doc("The patient who was assessed")
  patient: Reference;

  @doc("The encounter during which the assessment was performed")
  encounter: Reference;

  @doc("The clinician who performed the assessment")
  performer: Reference;

  @doc("The date and time the assessment was performed")
  performedAt: utcDateTime;

  @doc("The validated fall risk assessment tool used")
  tool: FallRiskTool;

  @doc("The total score computed by the assessment tool")
  score: int32;

  @doc("The risk level derived from the score")
  riskLevel: RiskLevel;

  @doc("Fall prevention interventions implemented based on this assessment")
  interventions?: CodeableConcept[];

  @doc("Additional free-text clinical notes")
  @maxLength(1000)
  note?: string;
}

@doc("A validated pressure injury risk assessment using a standardised tool.")
model PressureInjuryRisk extends HealthcareBaseEntity {
  @doc("The patient who was assessed")
  patient: Reference;

  @doc("The encounter during which the assessment was performed")
  encounter: Reference;

  @doc("The clinician who performed the assessment")
  performer: Reference;

  @doc("The date and time the assessment was performed")
  performedAt: utcDateTime;

  @doc("The validated pressure injury risk assessment tool used")
  tool: PressureInjuryTool;

  @doc("The total score computed by the assessment tool")
  score: int32;

  @doc("The risk level derived from the score")
  riskLevel: RiskLevel;

  @doc("Narrative summary of the skin assessment findings")
  @maxLength(1000)
  skinAssessment?: string;

  @doc("Prevention interventions implemented based on this assessment")
  interventions?: CodeableConcept[];

  @doc("Existing wounds or pressure injuries identified during skin assessment")
  existingInjuries?: WoundRecord[];
}

@doc("A pain assessment using a validated pain measurement scale.")
model PainAssessment extends HealthcareBaseEntity {
  @doc("The patient who was assessed")
  patient: Reference;

  @doc("The encounter during which the assessment was performed")
  encounter: Reference;

  @doc("The clinician who performed the assessment")
  performer: Reference;

  @doc("The date and time the assessment was performed")
  performedAt: utcDateTime;

  @doc("The pain measurement scale used")
  scale: PainScale;

  @doc("The pain score obtained using the selected scale")
  score: int32;

  @doc("The body location of the pain")
  location?: CodeableConcept;

  @doc("Qualitative description of pain characteristics (e.g., sharp, burning, throbbing)")
  @maxLength(500)
  characteristics?: string;

  @doc("Pain relief interventions provided (medication, positioning, etc.)")
  @maxLength(500)
  interventionsProvided?: string;

  @doc("Date and time at which the pain should be reassessed")
  reassessmentDue?: utcDateTime;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

@doc("Search parameters for NursingAssessment resources.")
model NursingAssessmentSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by encounter reference id")
  @query encounter?: string;

  @doc("Filter by assessment type")
  @query assessmentType?: NursingAssessmentType;

  @doc("Filter by assessment status")
  @query status?: AssessmentStatus;

  @doc("Filter by performer reference id")
  @query performer?: string;

  @doc("Filter assessments performed on or after this date-time")
  @query performedFrom?: utcDateTime;

  @doc("Filter assessments performed on or before this date-time")
  @query performedTo?: utcDateTime;

  ...PaginationQuery;
}

@doc("Search parameters for FallRiskAssessment resources.")
model FallRiskSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by encounter reference id")
  @query encounter?: string;

  @doc("Filter by risk level")
  @query riskLevel?: RiskLevel;

  @doc("Filter by tool used")
  @query tool?: FallRiskTool;

  ...PaginationQuery;
}

@doc("Search parameters for PressureInjuryRisk resources.")
model PressureInjuryRiskSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by encounter reference id")
  @query encounter?: string;

  @doc("Filter by risk level")
  @query riskLevel?: RiskLevel;

  @doc("Filter by tool used")
  @query tool?: PressureInjuryTool;

  ...PaginationQuery;
}

@doc("Search parameters for PainAssessment resources.")
model PainAssessmentSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by encounter reference id")
  @query encounter?: string;

  @doc("Filter by pain scale used")
  @query scale?: PainScale;

  @doc("Filter assessments performed on or after this date-time")
  @query performedFrom?: utcDateTime;

  @doc("Filter assessments performed on or before this date-time")
  @query performedTo?: utcDateTime;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("CRUD and search operations for NursingAssessment resources.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface NursingAssessmentManagement {
  @doc("Create a new NursingAssessment.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createNursingAssessment")
  create(
    @body body: NursingAssessment,
  ): {
    @statusCode statusCode: 201;
    @body nursingAssessment: NursingAssessment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single NursingAssessment by id.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getNursingAssessment")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body nursingAssessment: NursingAssessment;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing NursingAssessment.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateNursingAssessment")
  @route("/{id}")
  update(
    @path id: string,
    @body body: NursingAssessment,
  ): {
    @statusCode statusCode: 200;
    @body nursingAssessment: NursingAssessment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a NursingAssessment.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @patch
  @operationId("patchNursingAssessment")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body nursingAssessment: NursingAssessment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a NursingAssessment by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteNursingAssessment")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for NursingAssessment resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchNursingAssessments")
  @route("/search")
  search(
    ...NursingAssessmentSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<NursingAssessment>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD and search operations for FallRiskAssessment resources.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface FallRiskManagement {
  @doc("Create a new FallRiskAssessment.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createFallRiskAssessment")
  create(
    @body body: FallRiskAssessment,
  ): {
    @statusCode statusCode: 201;
    @body fallRiskAssessment: FallRiskAssessment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single FallRiskAssessment by id.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getFallRiskAssessment")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body fallRiskAssessment: FallRiskAssessment;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing FallRiskAssessment.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateFallRiskAssessment")
  @route("/{id}")
  update(
    @path id: string,
    @body body: FallRiskAssessment,
  ): {
    @statusCode statusCode: 200;
    @body fallRiskAssessment: FallRiskAssessment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a FallRiskAssessment by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteFallRiskAssessment")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for FallRiskAssessment resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchFallRiskAssessments")
  @route("/search")
  search(
    ...FallRiskSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<FallRiskAssessment>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD and search operations for PressureInjuryRisk resources.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface PressureInjuryRiskManagement {
  @doc("Create a new PressureInjuryRisk assessment.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createPressureInjuryRisk")
  create(
    @body body: PressureInjuryRisk,
  ): {
    @statusCode statusCode: 201;
    @body pressureInjuryRisk: PressureInjuryRisk;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single PressureInjuryRisk assessment by id.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getPressureInjuryRisk")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body pressureInjuryRisk: PressureInjuryRisk;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing PressureInjuryRisk assessment.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updatePressureInjuryRisk")
  @route("/{id}")
  update(
    @path id: string,
    @body body: PressureInjuryRisk,
  ): {
    @statusCode statusCode: 200;
    @body pressureInjuryRisk: PressureInjuryRisk;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a PressureInjuryRisk assessment by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deletePressureInjuryRisk")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for PressureInjuryRisk assessments using filter parameters.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchPressureInjuryRisks")
  @route("/search")
  search(
    ...PressureInjuryRiskSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<PressureInjuryRisk>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD and search operations for PainAssessment resources.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface PainAssessmentManagement {
  @doc("Create a new PainAssessment.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createPainAssessment")
  create(
    @body body: PainAssessment,
  ): {
    @statusCode statusCode: 201;
    @body painAssessment: PainAssessment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single PainAssessment by id.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getPainAssessment")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body painAssessment: PainAssessment;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing PainAssessment.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updatePainAssessment")
  @route("/{id}")
  update(
    @path id: string,
    @body body: PainAssessment,
  ): {
    @statusCode statusCode: 200;
    @body painAssessment: PainAssessment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a PainAssessment by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deletePainAssessment")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for PainAssessment resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchPainAssessments")
  @route("/search")
  search(
    ...PainAssessmentSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<PainAssessment>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
