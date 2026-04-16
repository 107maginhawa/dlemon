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
 * Mandatory Reporting module.
 *
 * Provides models and operations for tracking legally mandated reports to
 * public agencies. Covers child and elder abuse, communicable disease,
 * vital events (births, deaths, fetal deaths), trauma, device malfunctions,
 * adverse drug reactions, and other state- and federally-mandated reporting
 * obligations. Aligned with state mandatory reporting statutes, 21 CFR 803,
 * and CDC reporting requirements.
 */
namespace Healthcare.Support.MandatoryReporting;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The regulatory or clinical category of mandatory report.")
enum MandatoryReportType {
  @doc("Child abuse or neglect — mandated reporter obligation under state child protective services laws")
  childAbuse,

  @doc("Elder or dependent adult abuse — mandated reporter obligation under state adult protective services laws")
  elderAbuse,

  @doc("Domestic violence — required reporting of injuries resulting from domestic violence in applicable states")
  domesticViolence,

  @doc("Gunshot wound — required report to law enforcement of patients presenting with firearm injuries")
  gunShotWound,

  @doc("Stab wound — required report to law enforcement of patients presenting with stab wounds in applicable jurisdictions")
  stabWound,

  @doc("Communicable or reportable disease — required report to the local or state health department")
  communicableDisease,

  @doc("Sexual assault — required report under state law or VAWA Safe Harbor provisions")
  sexualAssault,

  @doc("Suspected death — report of a death that may require coroner or medical examiner investigation")
  suspectedDeath,

  @doc("Occupational injury or illness — OSHA reportable work-related injury requiring reporting to employer or OSHA")
  occupationalInjury,

  @doc("Adverse drug reaction — required report to FDA MedWatch for serious, unexpected adverse events")
  adverseDrugReaction,

  @doc("Medical device malfunction — required report to FDA under 21 CFR 803 (MDR)")
  deviceMalfunction,

  @doc("Birth certificate — required filing of a live birth certificate with the state vital records office")
  birthCertificate,

  @doc("Death certificate — required filing of a death certificate with the state vital records office")
  deathCertificate,

  @doc("Fetal death — required filing of a fetal death certificate for stillbirths meeting gestational age thresholds")
  fetalDeath,

  @doc("Cancer diagnosis — required report to the state cancer registry under state cancer reporting laws")
  cancerDiagnosis,

  @doc("Trauma case — required report to the state trauma registry for designated trauma cases")
  traumaCase,

  @doc("Poisoning or toxic exposure — required report to poison control or health department")
  poisoning,

  @doc("Animal bite — required report to animal control for bites with rabies exposure risk")
  dogBite,

  @doc("Other mandatory reporting obligation not captured by the above categories")
  other,
}

@doc("Lifecycle status of a mandatory report through the submission and acknowledgement workflow.")
enum ReportStatus {
  @doc("The report has been drafted but not yet submitted to the recipient agency")
  drafted,

  @doc("The report has been submitted to the required agency via the designated submission method")
  submitted,

  @doc("The recipient agency has acknowledged receipt of the report")
  acknowledged,

  @doc("The agency has requested additional information or a follow-up response")
  followUpRequested,

  @doc("The reporting obligation has been fulfilled and the matter is closed")
  closed,
}

@doc("Method by which the mandatory report was submitted to the recipient agency.")
enum SubmissionMethod {
  @doc("Electronic submission via a dedicated public health reporting portal or HL7 interface")
  electronic,

  @doc("Telephone report — verbal report made to the agency by phone")
  phone,

  @doc("Facsimile transmission of a completed report form")
  fax,

  @doc("In-person delivery or walk-in report to the agency office")
  inPerson,
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A mandatory report record documenting a legally-required report to a public agency, covering child abuse, communicable disease, vital events, device malfunctions, and other mandated reporting categories.")
model MandatoryReport extends HealthcareBaseEntity {
  @doc("Reference to the Patient involved in the reportable event (absent for device malfunction reports not involving a specific patient)")
  patient?: Reference;

  @doc("Reference to the Encounter during which the reportable condition was identified or event occurred")
  encounter?: Reference;

  @doc("The regulatory or clinical category of this mandatory report")
  reportType: MandatoryReportType;

  @doc("Reference to the Practitioner or mandated reporter who is making this report")
  reportedBy: Reference;

  @doc("Date and time the report was made or initiated")
  reportedAt: utcDateTime;

  @doc("Name of the agency to which the report is being submitted (e.g., 'Child Protective Services — Los Angeles County', 'CDPH Communicable Disease Control')")
  recipientAgency: string;

  @doc("Current status of the report in the submission and acknowledgement workflow")
  status: ReportStatus;

  @doc("Method used to submit the report to the recipient agency")
  submissionMethod: SubmissionMethod;

  @doc("Reference number or tracking number assigned by the recipient agency upon submission")
  submissionReference?: string;

  @doc("Narrative description of the reportable event, condition, or findings supporting the report")
  description: string;

  @doc("Date and time the report was formally submitted to the recipient agency")
  submittedAt?: utcDateTime;

  @doc("Date and time the agency formally acknowledged receipt of the report")
  acknowledgedAt?: utcDateTime;

  @doc("Additional notes from the reporting clinician, case manager, or compliance officer")
  note?: string;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for mandatory report queries.")
model MandatoryReportSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by mandatory report type") @query reportType?: MandatoryReportType;
  @doc("Filter by report status") @query status?: ReportStatus;
  @doc("Filter by reporting clinician reference ID") @query reportedBy?: string;
  @doc("Filter by recipient agency name (partial match)") @query recipientAgency?: string;
  @doc("Filter reports submitted on or after this date") @query reportedFrom?: utcDateTime;
  @doc("Filter reports submitted on or before this date") @query reportedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Mandatory report management — create, track, and manage all legally mandated reports to public agencies including child abuse, communicable disease, vital events, adverse drug reactions, and device malfunctions.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
@route("/support/mandatory-reports")
interface MandatoryReportManagement {
  @doc("Create a new mandatory report record.")
  @operationId("createMandatoryReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createMandatoryReport(
    @body body: MandatoryReport,
  ): {
    @statusCode statusCode: 201;
    @body result: MandatoryReport;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a mandatory report by its logical ID.")
  @operationId("getMandatoryReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getMandatoryReport(
    @path @doc("MandatoryReport logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: MandatoryReport;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a mandatory report record — typically to add a submission reference, acknowledge date, or change status.")
  @operationId("updateMandatoryReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateMandatoryReport(
    @path @doc("MandatoryReport logical ID") id: UUID,
    @body body: MandatoryReport,
  ): {
    @statusCode statusCode: 200;
    @body result: MandatoryReport;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a mandatory report record (only permitted for reports in 'drafted' status).")
  @operationId("deleteMandatoryReport")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteMandatoryReport(
    @path @doc("MandatoryReport logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search mandatory reports by type, patient, status, date range, or recipient agency.")
  @operationId("searchMandatoryReports")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchMandatoryReports(
    ...MandatoryReportSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<MandatoryReport>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
