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
 * Cancer Registry module.
 *
 * Provides models and operations for facility-level cancer case abstraction and
 * submission to state, SEER, and NPCR registries. Implements the NAACCR
 * (North American Association of Central Cancer Registries) data standards,
 * ICD-O-3 topography and morphology coding, and AJCC TNM staging (7th and
 * 8th editions). Supports complete cancer abstract creation including first
 * course of treatment and follow-up status.
 */
namespace Healthcare.Support.PublicHealth.CancerRegistry;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Behaviour code per ICD-O-3 indicating the biological behaviour of the tumour.")
enum TumourBehaviour {
  @doc("Benign — code /0 in ICD-O-3; tumour is non-invasive and does not metastasise")
  benign,

  @doc("Uncertain — code /1 in ICD-O-3; borderline malignancy or uncertain behaviour")
  uncertain,

  @doc("In situ — code /2 in ICD-O-3; tumour is localised with no invasion of surrounding tissue")
  inSitu,

  @doc("Malignant — code /3 in ICD-O-3; invasive tumour with potential to metastasise")
  malignant,
}

@doc("Type of cancer registry to which the case is being reported.")
enum RegistryType {
  @doc("State central cancer registry — state-mandated reporting per state cancer reporting laws")
  state,

  @doc("SEER (Surveillance, Epidemiology, and End Results) — NCI-funded population-based registry")
  seer,

  @doc("NPCR (National Program of Cancer Registries) — CDC-funded state registry programme")
  npcr,
}

@doc("Lifecycle status of a cancer registry case record.")
enum CancerCaseStatus {
  @doc("The case has been abstracted but not yet submitted to the registry")
  abstracted,

  @doc("The case has been submitted to the central registry")
  submitted,

  @doc("The registry has acknowledged receipt of the case")
  acknowledged,

  @doc("The case is undergoing quality review at the registry or facility level")
  qualityReview,
}

@doc("TNM staging edition used for staging classification.")
enum TNMStagingSystem {
  @doc("AJCC 8th edition (current) — published 2017, effective for cases diagnosed 2018 onwards")
  ajcc8th,

  @doc("AJCC 7th edition — used for cases diagnosed 2010–2017")
  ajcc7th,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("AJCC TNM stage data including clinical and pathologic classifications and overall stage group, per NAACCR data item standards.")
model TNMStageData {
  @doc("Clinical T — primary tumour extent based on physical examination and imaging (e.g., 'cT2', 'cT3a')")
  clinicalT?: string;

  @doc("Clinical N — regional lymph node involvement based on clinical assessment (e.g., 'cN0', 'cN1b')")
  clinicalN?: string;

  @doc("Clinical M — distant metastasis based on clinical assessment (e.g., 'cM0', 'cM1')")
  clinicalM?: string;

  @doc("Pathologic T — primary tumour extent based on pathological examination of the resected specimen")
  pathologicT?: string;

  @doc("Pathologic N — regional lymph node involvement based on pathological examination")
  pathologicN?: string;

  @doc("Pathologic M — distant metastasis based on pathological examination")
  pathologicM?: string;

  @doc("Overall stage group derived from TNM components (e.g., 'IIA', 'IIIB', 'IV')")
  stageGroup?: string;

  @doc("AJCC staging edition applied for this classification")
  stagingSystem: TNMStagingSystem;
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A cancer registry case representing an incident cancer diagnosis abstracted at the facility level for reporting to state, SEER, or NPCR registries per NAACCR data standards.")
model CancerRegistryCase extends HealthcareBaseEntity {
  @doc("Reference to the Patient diagnosed with cancer")
  patient: Reference;

  @doc("Reference to the Organisation (facility) at which the diagnosis was made or treatment was initiated")
  facility: Reference;

  @doc("ICD-O-3 topography code for the primary cancer site (e.g., 'C50.1 — Central portion of breast')")
  primarySite: CodeableConcept;

  @doc("ICD-O-3 morphology code for the histological type (e.g., '8500/3 — Infiltrating duct carcinoma, NOS')")
  histology: CodeableConcept;

  @doc("Biological behaviour per ICD-O-3 behaviour code")
  behavior: TumourBehaviour;

  @doc("Histological grade (e.g., 'Grade 1 — Well differentiated', 'Grade 3 — Poorly differentiated')")
  grade?: string;

  @doc("AJCC TNM clinical and pathologic staging information")
  stage?: TNMStageData;

  @doc("Date the primary diagnosis was first confirmed (incidence date per NAACCR definition)")
  diagnosisDate: plainDate;

  @doc("Reference to the Practitioner (pathologist or diagnosing physician) who confirmed the diagnosis")
  reportingPathologist?: Reference;

  @doc("Whether the case has been reported to the central cancer registry")
  reportedToRegistry?: boolean;

  @doc("Date the case was submitted to the central cancer registry")
  registrySubmissionDate?: plainDate;

  @doc("Type of cancer registry to which this case is being reported")
  registryType: RegistryType;

  @doc("Facility-assigned accession number for this cancer case (NAACCR Item 0020)")
  accessionNumber?: string;

  @doc("Current status of the case in the abstraction and submission workflow")
  status: CancerCaseStatus;
}

@doc("A cancer abstract representing the detailed data abstracted from the medical record for a registry case, including first course of treatment and follow-up status.")
model CancerAbstract extends HealthcareBaseEntity {
  @doc("Reference to the CancerRegistryCase for which this abstract was prepared")
  registryCase: Reference;

  @doc("Reference to the Practitioner (Certified Tumour Registrar — CTR) who abstracted the case")
  abstractor: Reference;

  @doc("Date the abstraction was completed")
  abstractedDate: utcDateTime;

  @doc("Narrative summary of first course of treatment including all modalities initiated within four months of diagnosis (or later if still first course)")
  treatmentSummary?: string;

  @doc("Whether systemic chemotherapy was part of the first course of treatment")
  firstCourseChemo?: boolean;

  @doc("Whether radiation therapy was part of the first course of treatment")
  firstCourseRadiation?: boolean;

  @doc("Whether surgical treatment was part of the first course of treatment")
  firstCourseSurgery?: boolean;

  @doc("Whether hormone therapy was part of the first course of treatment")
  firstCourseHormone?: boolean;

  @doc("Whether immunotherapy or biological response modifier therapy was part of the first course of treatment")
  firstCourseImmuno?: boolean;

  @doc("Follow-up status code at last contact (e.g., 'Alive', 'Dead of this cancer', 'Dead of other cause')")
  followUpStatus?: string;

  @doc("Vital status at last contact ('Alive' or 'Dead')")
  vitalStatus?: string;

  @doc("Date of last contact with the patient or their care team")
  lastContactDate?: plainDate;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for cancer registry case queries.")
model CancerRegistryCaseSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by reporting facility reference ID") @query facility?: string;
  @doc("Filter by tumour behaviour") @query behavior?: TumourBehaviour;
  @doc("Filter by registry type") @query registryType?: RegistryType;
  @doc("Filter by case status") @query status?: CancerCaseStatus;
  @doc("Filter by whether the case has been reported to registry") @query reportedToRegistry?: boolean;
  @doc("Filter diagnoses on or after this date") @query diagnosedFrom?: plainDate;
  @doc("Filter diagnoses on or before this date") @query diagnosedTo?: plainDate;
  ...OffsetPaginationParams;
}

@doc("Search parameters for cancer abstract queries.")
model CancerAbstractSearchParams {
  @doc("Filter by registry case reference ID") @query registryCase?: string;
  @doc("Filter by abstractor reference ID") @query abstractor?: string;
  @doc("Filter by vital status") @query vitalStatus?: string;
  @doc("Filter abstracts completed on or after this date") @query abstractedFrom?: utcDateTime;
  @doc("Filter abstracts completed on or before this date") @query abstractedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Cancer registry case management — abstract, track, and submit incident cancer cases to state, SEER, and NPCR central registries per NAACCR data standards.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
@route("/public-health/cancer-registry/cases")
interface CancerRegistryCaseManagement {
  @doc("Create a new cancer registry case record.")
  @operationId("createCancerRegistryCase")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createCancerRegistryCase(
    @body body: CancerRegistryCase,
  ): {
    @statusCode statusCode: 201;
    @body result: CancerRegistryCase;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a cancer registry case by its logical ID.")
  @operationId("getCancerRegistryCase")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getCancerRegistryCase(
    @path @doc("CancerRegistryCase logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: CancerRegistryCase;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a cancer registry case record.")
  @operationId("updateCancerRegistryCase")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateCancerRegistryCase(
    @path @doc("CancerRegistryCase logical ID") id: UUID,
    @body body: CancerRegistryCase,
  ): {
    @statusCode statusCode: 200;
    @body result: CancerRegistryCase;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a cancer registry case record (only permitted for cases in 'abstracted' status).")
  @operationId("deleteCancerRegistryCase")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteCancerRegistryCase(
    @path @doc("CancerRegistryCase logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search cancer registry cases by patient, facility, behaviour, registry type, status, or diagnosis date range.")
  @operationId("searchCancerRegistryCases")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchCancerRegistryCases(
    ...CancerRegistryCaseSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<CancerRegistryCase>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Submit an abstracted cancer case to the central cancer registry and update status to 'submitted'.")
  @operationId("submitCancerRegistryCase")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{id}/submit")
  submitCancerRegistryCase(
    @path @doc("CancerRegistryCase logical ID") id: UUID,
    @body body: { registryType: RegistryType; note?: string },
  ): {
    @statusCode statusCode: 200;
    @body result: CancerRegistryCase;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Cancer abstract management — create and maintain detailed cancer abstracts including first course of treatment and follow-up status for each registry case.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
@route("/public-health/cancer-registry/abstracts")
interface CancerAbstractManagement {
  @doc("Create a new cancer abstract for a registry case.")
  @operationId("createCancerAbstract")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createCancerAbstract(
    @body body: CancerAbstract,
  ): {
    @statusCode statusCode: 201;
    @body result: CancerAbstract;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a cancer abstract by its logical ID.")
  @operationId("getCancerAbstract")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getCancerAbstract(
    @path @doc("CancerAbstract logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: CancerAbstract;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a cancer abstract record.")
  @operationId("updateCancerAbstract")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateCancerAbstract(
    @path @doc("CancerAbstract logical ID") id: UUID,
    @body body: CancerAbstract,
  ): {
    @statusCode statusCode: 200;
    @body result: CancerAbstract;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a cancer abstract record.")
  @operationId("deleteCancerAbstract")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteCancerAbstract(
    @path @doc("CancerAbstract logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search cancer abstracts by registry case, abstractor, vital status, or abstraction date range.")
  @operationId("searchCancerAbstracts")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchCancerAbstracts(
    ...CancerAbstractSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<CancerAbstract>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
