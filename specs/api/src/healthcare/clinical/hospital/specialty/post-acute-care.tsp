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
 * Post-Acute Care module.
 *
 * Provides models and operations for managing the full post-acute continuum:
 * skilled nursing facilities (SNF), home health agencies, and long-term care
 * settings. Includes MDS 3.0 assessments, OASIS-E instruments, ADL functional
 * status scoring, and home health certification management.
 * Aligned with CMS SNF PPS, PDPM, and Home Health PPS requirements.
 */
namespace Healthcare.Clinical.Hospital.Specialty.PostAcuteCare;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The level of post-acute care provided in a given admission, spanning the full continuum from intensive skilled nursing to home-based hospice.")
enum CareLevel {
  @doc("Skilled nursing facility level — daily skilled nursing or therapy services required")
  skilledNursing,

  @doc("Sub-acute rehabilitation — intensive therapy after acute hospitalisation, below SNF level")
  subAcute,

  @doc("Long-term care — custodial care for residents who cannot care for themselves independently")
  longTermCare,

  @doc("Assisted living — residential care with assistance for activities of daily living but not skilled nursing")
  assistedLiving,

  @doc("Home health — skilled nursing or therapy services delivered in the patient's home")
  homeHealth,

  @doc("Hospice — palliative and supportive care for patients with a terminal prognosis of six months or less")
  hospice,

  @doc("Inpatient rehabilitation facility (IRF) — intensive multi-disciplinary rehabilitation programme")
  inpatientRehab,
}

@doc("Lifecycle status of a post-acute admission.")
enum PostAcuteAdmissionStatus {
  @doc("The patient is currently admitted and receiving care")
  active,

  @doc("The patient has been discharged from the facility or programme")
  discharged,

  @doc("The patient has been transferred to another level of care or facility")
  transferred,

  @doc("The patient expired while admitted")
  expired,
}

@doc("Level of functional independence for a single activity of daily living, per CMS MDS 3.0 coding conventions.")
enum ADLLevel {
  @doc("Independent — no helper required; performs activity safely without any assistance")
  independent,

  @doc("Setup or clean-up assistance only — helper sets up or cleans up before/after, no physical or verbal assistance during")
  setupOnly,

  @doc("Supervision — helper watches, cues, or encourages; no physical assistance")
  supervision,

  @doc("Limited assistance — helper provides guided maneuvering of limbs for no more than one third of the activity")
  limitedAssistance,

  @doc("Extensive assistance — helper provides weight-bearing support or performs more than half of the activity")
  extensiveAssistance,

  @doc("Maximal assistance — helper performs more than three-quarters of the activity")
  maximalAssistance,

  @doc("Total dependence — helper performs 100% of the activity for the resident")
  totalDependence,
}

@doc("Type of MDS assessment submitted to CMS for Medicare or Medicaid reimbursement.")
enum MDSAssessmentType {
  @doc("Admission assessment — must be completed within 14 days of SNF admission")
  admission,

  @doc("Quarterly assessment — completed every 92 days for ongoing residents")
  quarterly,

  @doc("Annual assessment — comprehensive annual reassessment")
  annual,

  @doc("Significant change in status assessment — triggered by a major clinical change")
  significantChange,

  @doc("Significant correction to a prior comprehensive assessment")
  significantCorrection,

  @doc("Discharge assessment — completed at discharge or transfer")
  discharge,
}

@doc("Workflow status of an MDS assessment in the submission lifecycle.")
enum MDSAssessmentStatus {
  @doc("Assessment is being entered but is not yet complete")
  inProgress,

  @doc("All required sections have been completed and the assessment is locked")
  completed,

  @doc("The assessment has been submitted to the CMS QIES system")
  submitted,

  @doc("A corrected version of a previously submitted assessment")
  corrected,
}

@doc("Status of a home health plan of care certification.")
enum HomeHealthCertificationStatus {
  @doc("The plan of care has been certified by the physician for the initial episode")
  certified,

  @doc("The plan of care has been recertified for an additional 60-day episode")
  recertified,

  @doc("The patient has been discharged from the home health programme")
  discharged,

  @doc("The patient has been transferred to another home health agency or setting")
  transferred,
}

@doc("OASIS assessment reason for which the assessment is being completed.")
enum OASISAssessmentType {
  @doc("Start of care — completed within 5 days of the first billable skilled visit")
  startOfCare,

  @doc("Recertification — completed during the last 5 days of a 60-day episode")
  recertification,

  @doc("Resumption of care — completed within 2 days of a resumption after an inpatient stay")
  resumption,

  @doc("Follow-up assessment — optional clinical reassessment mid-episode")
  followUp,

  @doc("Transfer to inpatient — completed within 2 days of an inpatient transfer")
  transferToInpatient,

  @doc("Discharge from agency — completed on or within 2 days before discharge")
  discharge,

  @doc("Death at home — completed within 2 days of a patient death in the home")
  deathAtHome,
}

@doc("Lifecycle status of an OASIS assessment in the iQIES submission workflow.")
enum OASISAssessmentStatus {
  @doc("The OASIS assessment is being completed and has not been locked")
  inProgress,

  @doc("All required items have been entered and the OASIS is locked")
  completed,

  @doc("The OASIS has been successfully transmitted to CMS iQIES")
  transmitted,
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A post-acute care admission record covering placement from an acute hospital or community setting into a post-acute or long-term care programme.")
model PostAcuteAdmission extends HealthcareBaseEntity {
  @doc("Reference to the Patient being admitted")
  patient: Reference;

  @doc("Reference to the Facility or Organisation providing the post-acute care")
  facility: Reference;

  @doc("Date the patient was admitted to this post-acute setting")
  admissionDate: plainDate;

  @doc("Date the patient was discharged, transferred, or expired (absent if currently admitted)")
  dischargeDate?: plainDate;

  @doc("Level of care provided in this admission")
  careLevel: CareLevel;

  @doc("Primary admitting diagnosis (ICD-10-CM coded)")
  admittingDiagnosis: CodeableConcept;

  @doc("Narrative description of the patient's functional and cognitive status at admission")
  functionalStatus?: string;

  @doc("Current status of the admission")
  status: PostAcuteAdmissionStatus;
}

@doc("An Activities of Daily Living (ADL) functional assessment completed by a clinician, scoring the resident's independence across six domains per CMS MDS 3.0 conventions.")
model ADLAssessment extends HealthcareBaseEntity {
  @doc("Reference to the Patient (resident) being assessed")
  patient: Reference;

  @doc("Reference to the Practitioner who completed the assessment")
  assessedBy: Reference;

  @doc("Date and time the assessment was performed")
  assessedAt: utcDateTime;

  @doc("Bathing — ability to wash body and hair, excluding back")
  bathing: ADLLevel;

  @doc("Dressing — ability to dress upper and lower body, including fasteners and footwear")
  dressing: ADLLevel;

  @doc("Eating — ability to eat and drink, excluding meal preparation")
  eating: ADLLevel;

  @doc("Toilet use — ability to use toilet room, bedpan, or bedside commode including transfer and clothing management")
  toileting: ADLLevel;

  @doc("Bed mobility and transfer — ability to move between lying and sitting positions and between surfaces")
  transferring: ADLLevel;

  @doc("Continence — ability to control bladder and bowel functions")
  continence: ADLLevel;

  @doc("Aggregate ADL score (0–28 scale, higher scores indicate greater dependence)")
  totalScore: int32;

  @doc("Clinical notes or contextual observations recorded by the assessor")
  note?: string;
}

@doc("A Minimum Data Set (MDS) 3.0 assessment submitted to CMS for Medicare Part A or Medicaid reimbursement in a skilled nursing facility.")
model MDSAssessment extends HealthcareBaseEntity {
  @doc("Reference to the Patient (resident) being assessed")
  patient: Reference;

  @doc("Reference to the Facility where the assessment was completed")
  facility: Reference;

  @doc("Type of MDS assessment being completed")
  assessmentType: MDSAssessmentType;

  @doc("The Assessment Reference Date (ARD) — the last day of the observation period")
  assessmentReferenceDate: plainDate;

  @doc("Reference to the Registered Nurse (RN) Assessment Coordinator who completed and signed the MDS")
  completedBy: Reference;

  @doc("Date and time the MDS was completed and electronically signed")
  completedDate: utcDateTime;

  @doc("Raw MDS section data as structured key-value pairs keyed by MDS item identifier (e.g., 'B0100', 'C0500')")
  section?: Record<unknown>;

  @doc("CMS Case Mix Group (CMG) classification for IRF-PAI or PDPM classification for SNF billing")
  casesMixGroup?: string;

  @doc("Version of the RUG or PDPM classification system applied (e.g., 'RUG-IV', 'PDPM')")
  rugVersion?: string;

  @doc("Current status in the CMS QIES/iQIES submission lifecycle")
  status: MDSAssessmentStatus;
}

@doc("A home health plan of care certification signed by the certifying physician, authorising a 60-day episode of covered home health services.")
model HomeHealthCertification extends HealthcareBaseEntity {
  @doc("Reference to the Patient receiving home health services")
  patient: Reference;

  @doc("Reference to the Practitioner (physician or allowed NPP) certifying the plan of care")
  certifyingPhysician: Reference;

  @doc("Date care was first initiated under this plan of care (Start of Care date)")
  startOfCare: plainDate;

  @doc("Length of the certified episode in days (standard Medicare episode is 60 days)")
  certificationPeriod: int32;

  @doc("Recertification sequence number (absent for initial certifications; 1 = first recertification)")
  recertificationNumber?: int32;

  @doc("Whether the patient qualifies as homebound — a condition of Medicare home health coverage")
  homebound: boolean;

  @doc("Primary diagnosis driving the home health plan of care (ICD-10-CM coded)")
  primaryDiagnosis: CodeableConcept;

  @doc("Therapy and nursing disciplines ordered on the plan of care (e.g., SN, PT, OT, SLP, MSW, HHA)")
  disciplines: string[];

  @doc("Narrative description of visit frequency and duration (e.g., 'SN 3×/week × 4 weeks then 2×/week × 4 weeks')")
  frequency: string;

  @doc("Current certification status")
  status: HomeHealthCertificationStatus;
}

@doc("An OASIS (Outcome and Assessment Information Set) assessment for a home health patient, submitted to CMS iQIES for outcome measurement and case-mix reimbursement.")
model OASISAssessment extends HealthcareBaseEntity {
  @doc("Reference to the Patient receiving home health care")
  patient: Reference;

  @doc("Reason this OASIS assessment is being completed")
  assessmentType: OASISAssessmentType;

  @doc("Date the assessment was performed at the patient's home")
  assessmentDate: utcDateTime;

  @doc("Reference to the clinician who completed the OASIS assessment")
  completedBy: Reference;

  @doc("Version of the OASIS instrument used (e.g., 'OASIS-E', 'OASIS-D1')")
  oasisVersion?: string;

  @doc("Raw OASIS item-level clinical data keyed by OASIS item identifier (e.g., 'M1800', 'M2020')")
  clinicalData?: Record<unknown>;

  @doc("Current status in the CMS iQIES submission lifecycle")
  status: OASISAssessmentStatus;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for post-acute admission queries.")
model PostAcuteAdmissionSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by facility reference ID") @query facility?: string;
  @doc("Filter by care level") @query careLevel?: CareLevel;
  @doc("Filter by admission status") @query status?: PostAcuteAdmissionStatus;
  @doc("Filter admissions on or after this date") @query admittedFrom?: plainDate;
  @doc("Filter admissions on or before this date") @query admittedTo?: plainDate;
  ...OffsetPaginationParams;
}

@doc("Search parameters for ADL assessment queries.")
model ADLAssessmentSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by assessing clinician reference ID") @query assessedBy?: string;
  @doc("Filter assessments completed at or after this date") @query assessedFrom?: utcDateTime;
  @doc("Filter assessments completed at or before this date") @query assessedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for MDS assessment queries.")
model MDSAssessmentSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by facility reference ID") @query facility?: string;
  @doc("Filter by assessment type") @query assessmentType?: MDSAssessmentType;
  @doc("Filter by submission status") @query status?: MDSAssessmentStatus;
  @doc("Filter by ARD on or after this date") @query ardFrom?: plainDate;
  @doc("Filter by ARD on or before this date") @query ardTo?: plainDate;
  ...OffsetPaginationParams;
}

@doc("Search parameters for home health certification queries.")
model HomeHealthCertificationSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by certifying physician reference ID") @query certifyingPhysician?: string;
  @doc("Filter by certification status") @query status?: HomeHealthCertificationStatus;
  @doc("Filter by start of care on or after this date") @query socFrom?: plainDate;
  @doc("Filter by start of care on or before this date") @query socTo?: plainDate;
  ...OffsetPaginationParams;
}

@doc("Search parameters for OASIS assessment queries.")
model OASISAssessmentSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by assessment type") @query assessmentType?: OASISAssessmentType;
  @doc("Filter by submission status") @query status?: OASISAssessmentStatus;
  @doc("Filter by assessment date on or after this value") @query assessedFrom?: utcDateTime;
  @doc("Filter by assessment date on or before this value") @query assessedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Post-acute admission management — create and manage admission records across the SNF, home health, and long-term care continuum.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/post-acute/admissions")
interface PostAcuteAdmissionManagement {
  @doc("Create a new post-acute admission record.")
  @operationId("createPostAcuteAdmission")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createPostAcuteAdmission(
    @body body: PostAcuteAdmission,
  ): {
    @statusCode statusCode: 201;
    @body result: PostAcuteAdmission;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a post-acute admission by its logical ID.")
  @operationId("getPostAcuteAdmission")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getPostAcuteAdmission(
    @path @doc("PostAcuteAdmission logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: PostAcuteAdmission;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a post-acute admission record.")
  @operationId("updatePostAcuteAdmission")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updatePostAcuteAdmission(
    @path @doc("PostAcuteAdmission logical ID") id: UUID,
    @body body: PostAcuteAdmission,
  ): {
    @statusCode statusCode: 200;
    @body result: PostAcuteAdmission;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a post-acute admission record.")
  @operationId("deletePostAcuteAdmission")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deletePostAcuteAdmission(
    @path @doc("PostAcuteAdmission logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search post-acute admissions by patient, facility, care level, status, or date range.")
  @operationId("searchPostAcuteAdmissions")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchPostAcuteAdmissions(
    ...PostAcuteAdmissionSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<PostAcuteAdmission>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("ADL assessment management — document and track functional status assessments across the post-acute continuum.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/post-acute/adl-assessments")
interface ADLAssessmentManagement {
  @doc("Record a new ADL functional assessment.")
  @operationId("createADLAssessment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createADLAssessment(
    @body body: ADLAssessment,
  ): {
    @statusCode statusCode: 201;
    @body result: ADLAssessment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve an ADL assessment by its logical ID.")
  @operationId("getADLAssessment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getADLAssessment(
    @path @doc("ADLAssessment logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: ADLAssessment;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an ADL assessment record.")
  @operationId("updateADLAssessment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateADLAssessment(
    @path @doc("ADLAssessment logical ID") id: UUID,
    @body body: ADLAssessment,
  ): {
    @statusCode statusCode: 200;
    @body result: ADLAssessment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an ADL assessment record.")
  @operationId("deleteADLAssessment")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteADLAssessment(
    @path @doc("ADLAssessment logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search ADL assessments by patient, assessor, or date range.")
  @operationId("searchADLAssessments")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchADLAssessments(
    ...ADLAssessmentSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ADLAssessment>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("MDS 3.0 assessment management — create, complete, and submit Minimum Data Set assessments for SNF residents to CMS.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/post-acute/mds-assessments")
interface MDSAssessmentManagement {
  @doc("Create a new MDS assessment record.")
  @operationId("createMDSAssessment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createMDSAssessment(
    @body body: MDSAssessment,
  ): {
    @statusCode statusCode: 201;
    @body result: MDSAssessment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve an MDS assessment by its logical ID.")
  @operationId("getMDSAssessment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getMDSAssessment(
    @path @doc("MDSAssessment logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: MDSAssessment;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an MDS assessment.")
  @operationId("updateMDSAssessment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateMDSAssessment(
    @path @doc("MDSAssessment logical ID") id: UUID,
    @body body: MDSAssessment,
  ): {
    @statusCode statusCode: 200;
    @body result: MDSAssessment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an MDS assessment record.")
  @operationId("deleteMDSAssessment")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteMDSAssessment(
    @path @doc("MDSAssessment logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search MDS assessments by patient, facility, type, status, or ARD date range.")
  @operationId("searchMDSAssessments")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchMDSAssessments(
    ...MDSAssessmentSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<MDSAssessment>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Home health certification management — manage physician certifications and recertifications for Medicare home health episodes.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/post-acute/home-health-certifications")
interface HomeHealthCertificationManagement {
  @doc("Create a new home health plan of care certification.")
  @operationId("createHomeHealthCertification")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createHomeHealthCertification(
    @body body: HomeHealthCertification,
  ): {
    @statusCode statusCode: 201;
    @body result: HomeHealthCertification;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a home health certification by its logical ID.")
  @operationId("getHomeHealthCertification")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getHomeHealthCertification(
    @path @doc("HomeHealthCertification logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: HomeHealthCertification;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a home health certification.")
  @operationId("updateHomeHealthCertification")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateHomeHealthCertification(
    @path @doc("HomeHealthCertification logical ID") id: UUID,
    @body body: HomeHealthCertification,
  ): {
    @statusCode statusCode: 200;
    @body result: HomeHealthCertification;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a home health certification record.")
  @operationId("deleteHomeHealthCertification")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteHomeHealthCertification(
    @path @doc("HomeHealthCertification logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search home health certifications by patient, physician, status, or episode date range.")
  @operationId("searchHomeHealthCertifications")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchHomeHealthCertifications(
    ...HomeHealthCertificationSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<HomeHealthCertification>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("OASIS assessment management — create, complete, and transmit OASIS assessments for home health patients to CMS iQIES.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/post-acute/oasis-assessments")
interface OASISAssessmentManagement {
  @doc("Create a new OASIS assessment record.")
  @operationId("createOASISAssessment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createOASISAssessment(
    @body body: OASISAssessment,
  ): {
    @statusCode statusCode: 201;
    @body result: OASISAssessment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve an OASIS assessment by its logical ID.")
  @operationId("getOASISAssessment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getOASISAssessment(
    @path @doc("OASISAssessment logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: OASISAssessment;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an OASIS assessment.")
  @operationId("updateOASISAssessment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateOASISAssessment(
    @path @doc("OASISAssessment logical ID") id: UUID,
    @body body: OASISAssessment,
  ): {
    @statusCode statusCode: 200;
    @body result: OASISAssessment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an OASIS assessment record.")
  @operationId("deleteOASISAssessment")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteOASISAssessment(
    @path @doc("OASISAssessment logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search OASIS assessments by patient, assessment type, status, or date range.")
  @operationId("searchOASISAssessments")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchOASISAssessments(
    ...OASISAssessmentSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<OASISAssessment>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
