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
 * Oncology module.
 *
 * Provides models and operations for managing the oncology care continuum:
 * cancer diagnosis with TNM staging, chemotherapy protocol library,
 * chemotherapy cycle administration, and radiation therapy planning and delivery.
 * Aligned with FHIR R4 Condition, MedicationAdministration, and Procedure resources.
 */
namespace Healthcare.Clinical.Hospital.Oncology;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Lifecycle status of a chemotherapy protocol in the protocol library.")
enum ProtocolStatus {
  @doc("The protocol is approved and available for use")
  active,

  @doc("The protocol has been retired and should no longer be used for new orders")
  retired,

  @doc("The protocol is in draft form and has not yet been approved")
  draft,
}

@doc("Lifecycle status of a chemotherapy cycle for a patient.")
enum CycleStatus {
  @doc("The cycle is scheduled but has not yet started")
  planned,

  @doc("The cycle is currently in progress")
  inProgress,

  @doc("The cycle has been completed as planned")
  completed,

  @doc("The cycle has been delayed (e.g., patient not well, lab values not met)")
  delayed,

  @doc("The cycle has been permanently cancelled")
  cancelled,

  @doc("The cycle is on hold due to toxicity or adverse events")
  toxicityHold,
}

@doc("Radiation therapy modality.")
enum RadiationModality {
  @doc("External beam radiation therapy delivered from outside the body")
  externalBeam,

  @doc("Brachytherapy — radioactive material placed inside or near the tumour")
  brachytherapy,

  @doc("Proton beam therapy")
  proton,

  @doc("Stereotactic radiosurgery or stereotactic body radiation therapy (SBRT)")
  stereotactic,
}

@doc("Lifecycle status of a radiation therapy course.")
enum RadiationStatus {
  @doc("The radiation therapy course is planned but treatment has not started")
  planned,

  @doc("The radiation therapy course is actively in progress")
  inProgress,

  @doc("The radiation therapy course has been completed")
  completed,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("TNM staging tuple for a solid tumour.")
model TNMStage {
  @doc("TNM edition used for staging (e.g., '8th edition AJCC')")
  edition?: string;

  @doc("T — primary tumour size and extent (e.g., 'T2', 'T3a')")
  T?: string;

  @doc("N — regional lymph node involvement (e.g., 'N0', 'N1')")
  N?: string;

  @doc("M — distant metastasis (e.g., 'M0', 'M1b')")
  M?: string;

  @doc("Overall grouped stage (e.g., 'IIA', 'IIIB', 'IV')")
  groupStage?: string;
}

@doc("A single chemotherapy drug defined within a protocol, including dosing and scheduling information.")
model ChemoDrug {
  @doc("The medication (RxNorm or NCI Thesaurus coded)")
  medication: CodeableConcept;

  @doc("Prescribed dose with unit (e.g., '75 mg/m²' — value and unit as Quantity)")
  dose: Quantity;

  @doc("Route of administration (SNOMED CT coded — e.g., IV, oral, intrathecal)")
  route: CodeableConcept;

  @doc("Administration schedule within the cycle (e.g., 'Day 1', 'Days 1–5', 'Weekly')")
  schedule: string;

  @doc("Pre-medications to administer before this drug (e.g., antiemetics, steroids, hydration)")
  premedications?: CodeableConcept[];
}

@doc("A record of a single chemotherapy drug administration within a treatment cycle.")
model ChemoDrugAdministration {
  @doc("The drug administered (RxNorm or NCI Thesaurus coded)")
  drug: CodeableConcept;

  @doc("Actual dose administered")
  dose: Quantity;

  @doc("Route of administration")
  route: CodeableConcept;

  @doc("Date and time administration began")
  startTime: utcDateTime;

  @doc("Date and time administration was completed")
  endTime?: utcDateTime;

  @doc("Reference to the Practitioner (nurse or pharmacist) who administered the drug")
  administeredBy?: Reference;

  @doc("Whether an infusion reaction or adverse event was noted during administration")
  reactionNoted?: boolean;
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A cancer diagnosis record linking a patient to a confirmed malignancy with full staging and pathological characterisation.")
model CancerDiagnosis extends HealthcareBaseEntity {
  @doc("Reference to the Patient with this cancer diagnosis")
  patient: Reference;

  @doc("Reference to the Condition resource representing the oncological diagnosis")
  condition: Reference;

  @doc("Cancer type or site (SNOMED CT or ICD-O-3 coded — e.g., 'Adenocarcinoma of the breast')")
  cancerType: CodeableConcept;

  @doc("TNM staging at the time of diagnosis")
  stage: TNMStage;

  @doc("Histological grade (e.g., 'Grade 2', 'Moderately differentiated')")
  grade?: string;

  @doc("Histological type description (e.g., 'Invasive ductal carcinoma, NOS')")
  histology?: string;

  @doc("Biomarker and receptor status (e.g., ER+, PR+, HER2-, KRAS mutant) — key-value pairs")
  biomarkers?: Record<unknown>;

  @doc("Date the diagnosis was confirmed")
  diagnosisDate: utcDateTime;

  @doc("Reference to the Practitioner (oncologist or pathologist) who established the diagnosis")
  diagnosedBy: Reference;
}

@doc("A chemotherapy protocol definition in the institutional protocol library, representing a standardised multi-drug regimen for a given cancer type.")
model ChemotherapyProtocol extends HealthcareBaseEntity {
  @doc("Protocol name or acronym (e.g., 'FOLFOX6', 'AC-T', 'R-CHOP')")
  name: string;

  @doc("Cancer type or indication this protocol is approved for")
  cancerType: CodeableConcept;

  @doc("Constituent drugs, their doses, routes, and schedules")
  drugs: ChemoDrug[];

  @doc("Length of one treatment cycle in days")
  cycleLength: int32;

  @doc("Total number of planned cycles in the full course of treatment")
  totalCycles: int32;

  @doc("Clinical description of the protocol including evidence base and indications")
  description: string;

  @doc("Current library status of the protocol")
  status: ProtocolStatus;
}

@doc("A single chemotherapy treatment cycle administered to a patient according to a protocol.")
model ChemotherapyCycle extends HealthcareBaseEntity {
  @doc("Reference to the Patient receiving this chemotherapy cycle")
  patient: Reference;

  @doc("Reference to the Encounter during which this cycle was administered")
  encounter?: Reference;

  @doc("Reference to the ChemotherapyProtocol this cycle follows")
  protocol: Reference;

  @doc("Sequential cycle number within the overall treatment course (e.g., 1, 2, 3)")
  cycleNumber: int32;

  @doc("Total number of cycles planned in the complete treatment course")
  totalCycles: int32;

  @doc("Planned or actual start date of this cycle")
  startDate: utcDateTime;

  @doc("Actual end date of this cycle")
  endDate?: utcDateTime;

  @doc("Current lifecycle status of this treatment cycle")
  status: CycleStatus;

  @doc("Drug administration records for each drug given in this cycle")
  drugs: ChemoDrugAdministration[];

  @doc("References to laboratory results obtained prior to cycle administration (pre-chemo labs)")
  preChemoLabs?: Reference[];

  @doc("Adverse events documented during or after this cycle (SNOMED CT or MedDRA coded)")
  adverseEvents?: CodeableConcept[];
}

@doc("A radiation therapy course planned and delivered for a patient's cancer treatment.")
model RadiationTherapy extends HealthcareBaseEntity {
  @doc("Reference to the Patient receiving radiation therapy")
  patient: Reference;

  @doc("Cancer type or site being irradiated")
  cancerType: CodeableConcept;

  @doc("Radiation modality used for treatment delivery")
  modality: RadiationModality;

  @doc("Anatomical treatment site (SNOMED CT coded — e.g., 'Whole brain', 'Left breast', 'Pelvis')")
  site: CodeableConcept;

  @doc("Total planned radiation dose (e.g., '60 Gy')")
  totalDose?: Quantity;

  @doc("Total number of fractions (treatment sessions) in the course")
  fractions?: int32;

  @doc("Current status of the radiation therapy course")
  status: RadiationStatus;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for cancer diagnoses.")
model CancerDiagnosisSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by diagnosing clinician reference ID") @query diagnosedBy?: string;
  @doc("Filter by cancer type code") @query cancerTypeCode?: string;
  @doc("Filter diagnoses on or after this date") @query diagnosedFrom?: utcDateTime;
  @doc("Filter diagnoses on or before this date") @query diagnosedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for chemotherapy protocols.")
model ChemotherapyProtocolSearchParams {
  @doc("Filter by protocol status") @query status?: ProtocolStatus;
  @doc("Filter by cancer type code") @query cancerTypeCode?: string;
  @doc("Free-text search on protocol name") @query name?: string;
  ...OffsetPaginationParams;
}

@doc("Search parameters for chemotherapy cycles.")
model ChemotherapyCycleSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by protocol reference ID") @query protocol?: string;
  @doc("Filter by cycle status") @query status?: CycleStatus;
  @doc("Filter by cycle number") @query cycleNumber?: int32;
  @doc("Filter cycles starting at or after this date") @query startedFrom?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for radiation therapy courses.")
model RadiationTherapySearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by radiation modality") @query modality?: RadiationModality;
  @doc("Filter by therapy status") @query status?: RadiationStatus;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Cancer diagnosis management — create, retrieve, and manage oncological diagnoses with full TNM staging.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/oncology/diagnoses")
interface CancerDiagnosisManagement {
  @doc("Record a new cancer diagnosis.")
  @operationId("createCancerDiagnosis")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createCancerDiagnosis(
    @body body: CancerDiagnosis,
  ): {
    @statusCode statusCode: 201;
    @body result: CancerDiagnosis;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a cancer diagnosis by its logical ID.")
  @operationId("getCancerDiagnosis")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getCancerDiagnosis(
    @path @doc("CancerDiagnosis logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: CancerDiagnosis;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a cancer diagnosis record.")
  @operationId("updateCancerDiagnosis")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateCancerDiagnosis(
    @path @doc("CancerDiagnosis logical ID") id: UUID,
    @body body: CancerDiagnosis,
  ): {
    @statusCode statusCode: 200;
    @body result: CancerDiagnosis;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a cancer diagnosis record.")
  @operationId("deleteCancerDiagnosis")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteCancerDiagnosis(
    @path @doc("CancerDiagnosis logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search cancer diagnoses by patient, cancer type, diagnosing clinician, or date range.")
  @operationId("searchCancerDiagnoses")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchCancerDiagnoses(
    ...CancerDiagnosisSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<CancerDiagnosis>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Chemotherapy protocol library management — manage the institutional library of approved chemotherapy regimens.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/oncology/protocols")
interface ChemotherapyProtocolManagement {
  @doc("Add a new chemotherapy protocol to the library.")
  @operationId("createChemotherapyProtocol")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createChemotherapyProtocol(
    @body body: ChemotherapyProtocol,
  ): {
    @statusCode statusCode: 201;
    @body result: ChemotherapyProtocol;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a chemotherapy protocol by its logical ID.")
  @operationId("getChemotherapyProtocol")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getChemotherapyProtocol(
    @path @doc("ChemotherapyProtocol logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: ChemotherapyProtocol;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a chemotherapy protocol.")
  @operationId("updateChemotherapyProtocol")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateChemotherapyProtocol(
    @path @doc("ChemotherapyProtocol logical ID") id: UUID,
    @body body: ChemotherapyProtocol,
  ): {
    @statusCode statusCode: 200;
    @body result: ChemotherapyProtocol;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a chemotherapy protocol from the library.")
  @operationId("deleteChemotherapyProtocol")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteChemotherapyProtocol(
    @path @doc("ChemotherapyProtocol logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search chemotherapy protocols by name, cancer type, or status.")
  @operationId("searchChemotherapyProtocols")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchChemotherapyProtocols(
    ...ChemotherapyProtocolSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ChemotherapyProtocol>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Chemotherapy cycle management — document individual treatment cycles including drug administration, pre-chemo labs, and adverse events.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/oncology/cycles")
interface ChemotherapyCycleManagement {
  @doc("Create a new chemotherapy treatment cycle.")
  @operationId("createChemotherapyCycle")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createChemotherapyCycle(
    @body body: ChemotherapyCycle,
  ): {
    @statusCode statusCode: 201;
    @body result: ChemotherapyCycle;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a chemotherapy cycle by its logical ID.")
  @operationId("getChemotherapyCycle")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getChemotherapyCycle(
    @path @doc("ChemotherapyCycle logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: ChemotherapyCycle;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a chemotherapy cycle record.")
  @operationId("updateChemotherapyCycle")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateChemotherapyCycle(
    @path @doc("ChemotherapyCycle logical ID") id: UUID,
    @body body: ChemotherapyCycle,
  ): {
    @statusCode statusCode: 200;
    @body result: ChemotherapyCycle;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a chemotherapy cycle record.")
  @operationId("deleteChemotherapyCycle")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteChemotherapyCycle(
    @path @doc("ChemotherapyCycle logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search chemotherapy cycles by patient, protocol, status, or cycle number.")
  @operationId("searchChemotherapyCycles")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchChemotherapyCycles(
    ...ChemotherapyCycleSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ChemotherapyCycle>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Radiation therapy management — plan, track, and document radiation therapy courses for oncology patients.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/oncology/radiation-therapy")
interface RadiationTherapyManagement {
  @doc("Create a new radiation therapy course.")
  @operationId("createRadiationTherapy")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createRadiationTherapy(
    @body body: RadiationTherapy,
  ): {
    @statusCode statusCode: 201;
    @body result: RadiationTherapy;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a radiation therapy course by its logical ID.")
  @operationId("getRadiationTherapy")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getRadiationTherapy(
    @path @doc("RadiationTherapy logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: RadiationTherapy;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a radiation therapy course record.")
  @operationId("updateRadiationTherapy")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateRadiationTherapy(
    @path @doc("RadiationTherapy logical ID") id: UUID,
    @body body: RadiationTherapy,
  ): {
    @statusCode statusCode: 200;
    @body result: RadiationTherapy;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a radiation therapy course record.")
  @operationId("deleteRadiationTherapy")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteRadiationTherapy(
    @path @doc("RadiationTherapy logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search radiation therapy courses by patient, modality, or status.")
  @operationId("searchRadiationTherapy")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchRadiationTherapy(
    ...RadiationTherapySearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<RadiationTherapy>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
