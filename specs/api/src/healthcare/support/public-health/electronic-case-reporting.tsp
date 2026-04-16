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
 * Electronic Case Reporting (eCR) module.
 *
 * Provides models and operations for automated electronic case reporting to
 * public health authorities. Implements the eCR workflow per the HL7 FHIR
 * Electronic Case Reporting Implementation Guide and the Association of Public
 * Health Laboratories (APHL) Reportable Condition Knowledge Management System
 * (RCKMS) trigger definitions. Supports trigger-based case report generation,
 * submission to public health agencies, and reportability response handling.
 */
namespace Healthcare.Support.PublicHealth.ECR;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The type of clinical trigger that initiated the electronic case report.")
enum ECRTriggerType {
  @doc("Diagnosis trigger — a coded diagnosis in the encounter matches a reportable condition trigger code")
  diagnosis,

  @doc("Lab result trigger — a laboratory test result matches a reportable condition trigger")
  labResult,

  @doc("Medication trigger — a medication ordered or administered matches a reportable condition trigger (e.g., treatment for HIV, TB)")
  medication,

  @doc("Procedure trigger — a procedure ordered or performed matches a reportable condition trigger")
  procedure,
}

@doc("Lifecycle status of an electronic case report in the eCR workflow.")
enum ECRStatus {
  @doc("A clinical trigger has been detected and the eCR process has been initiated")
  triggered,

  @doc("The eICR (Initial Case Report) document has been generated and is ready for review")
  generated,

  @doc("The eICR has been submitted to the public health agency or AIMS platform")
  submitted,

  @doc("The public health agency has acknowledged receipt of the eICR and returned a Reportability Response")
  acknowledged,

  @doc("The Reportability Response determined that the condition is not reportable in the relevant jurisdiction")
  notReportable,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("The Reportability Response (RR) returned by the public health agency or RCKMS after evaluating the submitted eICR.")
model ReportabilityResponse {
  @doc("The reportability determination returned by the public health agency — indicates whether the condition is reportable in the jurisdiction")
  determination: ReportabilityDetermination;

  @doc("The condition for which the reportability determination was made (SNOMED CT or ICD-10-CM coded)")
  condition?: CodeableConcept;

  @doc("The public health jurisdiction that made this reportability determination (e.g., 'California Department of Public Health')")
  jurisdiction: string;

  @doc("Date and time the Reportability Response was received from the public health agency")
  receivedAt: utcDateTime;
}

@doc("Reportability determination codes from the Reportability Response document per the HL7 eCR FHIR IG.")
enum ReportabilityDetermination {
  @doc("The condition is reportable in the jurisdiction")
  reportable,

  @doc("The condition may be reportable pending additional clinical information")
  mayBeReportable,

  @doc("No RCKMS rule was triggered for this condition and jurisdiction combination")
  noRuleTriggered,

  @doc("The condition is not reportable in the jurisdiction based on the clinical data provided")
  notReportable,
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("An electronic case report (eCR) record representing the automated generation and submission of an Initial Case Report (eICR) to a public health agency following detection of a reportable condition trigger.")
model ElectronicCaseReport extends HealthcareBaseEntity {
  @doc("Reference to the Patient who is the subject of this case report")
  patient: Reference;

  @doc("Reference to the Encounter during which the triggering event occurred")
  encounter: Reference;

  @doc("Reference to the Organisation (reporting facility) submitting the case report")
  reportingFacility: Reference;

  @doc("The specific clinical concept that triggered the eCR workflow (SNOMED CT, ICD-10-CM, LOINC, or RxNorm coded)")
  triggeredBy: CodeableConcept;

  @doc("The type of clinical event that triggered case report generation")
  triggerType: ECRTriggerType;

  @doc("The reportable condition associated with this case report (SNOMED CT coded per RCKMS)")
  condition: CodeableConcept;

  @doc("Whether the condition was determined to be reportable to a public health jurisdiction")
  reportableIndicator: boolean;

  @doc("The public health jurisdiction to which this report is being sent (e.g., 'CA', 'NYC-DOHMH')")
  reportingJurisdiction: string;

  @doc("Current status in the eCR workflow")
  status: ECRStatus;

  @doc("Date and time the eICR document was generated by the EHR or eCR platform")
  generatedAt: utcDateTime;

  @doc("Date and time the eICR was submitted to the AIMS platform or public health agency")
  submittedAt?: utcDateTime;

  @doc("Identifier of the AIMS platform endpoint or public health agency to which the report was submitted")
  submittedTo?: string;

  @doc("The Reportability Response returned by the public health agency after evaluating the eICR")
  reportabilityResponse?: ReportabilityResponse;

  @doc("Additional notes from the infection prevention officer or public health liaison")
  note?: string;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for electronic case report queries.")
model ECRSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by reporting facility reference ID") @query reportingFacility?: string;
  @doc("Filter by trigger type") @query triggerType?: ECRTriggerType;
  @doc("Filter by reporting jurisdiction") @query reportingJurisdiction?: string;
  @doc("Filter by eCR status") @query status?: ECRStatus;
  @doc("Filter by reportable indicator") @query reportableIndicator?: boolean;
  @doc("Filter reports generated on or after this date") @query generatedFrom?: utcDateTime;
  @doc("Filter reports generated on or before this date") @query generatedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Electronic case reporting management — create, track, submit, and manage electronic case reports (eICRs) sent to public health agencies following detection of reportable condition triggers.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
@route("/public-health/ecr")
interface ECRManagement {
  @doc("Create a new electronic case report record triggered by a reportable condition detection.")
  @operationId("createElectronicCaseReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createElectronicCaseReport(
    @body body: ElectronicCaseReport,
  ): {
    @statusCode statusCode: 201;
    @body result: ElectronicCaseReport;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve an electronic case report by its logical ID.")
  @operationId("getElectronicCaseReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getElectronicCaseReport(
    @path @doc("ElectronicCaseReport logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: ElectronicCaseReport;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an electronic case report record.")
  @operationId("updateElectronicCaseReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateElectronicCaseReport(
    @path @doc("ElectronicCaseReport logical ID") id: UUID,
    @body body: ElectronicCaseReport,
  ): {
    @statusCode statusCode: 200;
    @body result: ElectronicCaseReport;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an electronic case report record.")
  @operationId("deleteElectronicCaseReport")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteElectronicCaseReport(
    @path @doc("ElectronicCaseReport logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search electronic case reports by patient, trigger type, jurisdiction, status, or date range.")
  @operationId("searchElectronicCaseReports")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchElectronicCaseReports(
    ...ECRSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ElectronicCaseReport>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Submit a generated eICR to the AIMS platform or target public health agency and update the status to 'submitted'.")
  @operationId("submitElectronicCaseReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{id}/submit")
  submitElectronicCaseReport(
    @path @doc("ElectronicCaseReport logical ID") id: UUID,
    @body body: { submittedTo: string; note?: string },
  ): {
    @statusCode statusCode: 200;
    @body result: ElectronicCaseReport;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
