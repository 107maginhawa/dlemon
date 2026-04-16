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
 * Healthcare Support Clinical Outcomes — structured outcome recording per
 * procedure or episode, clinical benchmark definitions for quality targets,
 * and aggregated outcome reporting to support performance measurement and
 * continuous quality improvement initiatives.
 */
namespace Healthcare.Support.ClinicalOutcomes;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The overall clinical outcome of a procedure or care episode.")
enum OutcomeStatus {
  @doc("The procedure or episode was completed without clinically significant issues")
  successful,

  @doc("The procedure was completed but goals were only partially achieved")
  partialSuccess,

  @doc("The procedure or episode failed to achieve its intended clinical goal")
  failure,

  @doc("The patient experienced a complication during or following the procedure")
  complication,

  @doc("The outcome could not be determined due to incomplete data or follow-up")
  `unknown`: "unknown",
}

@doc("The clinical severity of a complication following a procedure or care episode.")
enum ComplicationSeverity {
  @doc("Mild complication requiring only minimal or no additional intervention")
  mild,

  @doc("Moderate complication requiring additional clinical management but not life-threatening")
  moderate,

  @doc("Severe complication that is life-threatening or results in significant disability")
  severe,
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

@doc("A structured record of the clinical outcome of a procedure or care episode for a patient.")
model OutcomeRecord extends HealthcareBaseEntity {
  @doc("The patient for whom the outcome is recorded")
  patient: Reference;

  @doc("The clinical encounter associated with this outcome record, if applicable")
  encounter?: Reference;

  @doc("Reference to the specific procedure resource this outcome relates to, if applicable")
  procedure?: Reference;

  @doc("The coded procedure for which the outcome is being recorded")
  procedureCode: CodeableConcept;

  @doc("The provider who performed the procedure or managed the episode")
  provider?: Reference;

  @doc("The date and time the outcome was assessed or recorded")
  outcomeDate: utcDateTime;

  @doc("The overall clinical status of the outcome")
  status: OutcomeStatus;

  @doc("The interval in days until follow-up assessment is required")
  @minValue(0)
  followUpInterval?: int32;

  @doc("The coded complication that occurred, if applicable")
  complicationCode?: CodeableConcept;

  @doc("The clinical severity of the complication, if one occurred")
  complicationSeverity?: ComplicationSeverity;

  @doc("Whether the patient was readmitted to hospital within the standard monitoring period")
  readmission?: boolean;

  @doc("The clinical reason for readmission, if applicable")
  @maxLength(500)
  readmissionReason?: string;

  @doc("Patient satisfaction score on a standardised scale (e.g., 0–10 or 0–100)")
  @minValue(0)
  patientSatisfactionScore?: int32;

  @doc("Additional clinical annotations about this outcome record")
  note?: Annotation[];
}

@doc("A clinical benchmark defining a measurable quality target for a specific procedure or metric.")
model ClinicalBenchmark extends HealthcareBaseEntity {
  @doc("A human-readable name for this benchmark (e.g., '30-Day Readmission Rate — Hip Replacement')")
  @maxLength(250)
  name: string;

  @doc("The procedure code this benchmark applies to")
  procedureCode: CodeableConcept;

  @doc("The metric being measured (e.g., 'successRate', 'complicationRate', 'readmissionRate')")
  @maxLength(100)
  metric: string;

  @doc("The target value for this metric that constitutes meeting the benchmark")
  targetValue: float64;

  @doc("The unit of measurement for the target value (e.g., '%', 'days', 'score')")
  @maxLength(50)
  unit?: string;

  @doc("The time period over which this benchmark is measured")
  period: Period;

  @doc("The organisation this benchmark applies to, if facility-specific")
  organization?: Reference;

  @doc("The source or body that defined this benchmark (e.g., 'NHS England', 'CMS', 'internal')")
  @maxLength(200)
  source?: string;

  @doc("The publication status of this benchmark definition")
  status: PublicationStatus;
}

@doc("An aggregated summary report of clinical outcomes for a procedure within a defined period.")
model OutcomeReport extends HealthcareBaseEntity {
  @doc("The procedure code this report covers")
  procedureCode: CodeableConcept;

  @doc("The time period covered by this report")
  period: Period;

  @doc("The organisation this report covers, if scoped to a specific facility")
  organization?: Reference;

  @doc("The total number of cases included in this report")
  @minValue(0)
  totalCases: int64;

  @doc("The success rate for the procedure within the report period (0.0–1.0)")
  @minValue(0)
  @maxValue(1)
  successRate: float64;

  @doc("The complication rate for the procedure within the report period (0.0–1.0)")
  @minValue(0)
  @maxValue(1)
  complicationRate: float64;

  @doc("The hospital readmission rate within the report period (0.0–1.0), if applicable")
  @minValue(0)
  @maxValue(1)
  readmissionRate?: float64;

  @doc("The mean patient satisfaction score within the report period, if collected")
  averageSatisfaction?: float64;

  @doc("Reference to the benchmark used for comparison in this report, if applicable")
  benchmarkComparison?: Reference;
}

// ---------------------------------------------------------------------------
// Request models
// ---------------------------------------------------------------------------

@doc("Request body for generating a new OutcomeReport for a defined procedure and period.")
model GenerateOutcomeReportRequest {
  @doc("The procedure code to generate the report for")
  procedureCode: CodeableConcept;

  @doc("The time period the report should cover")
  period: Period;

  @doc("The organisation to scope the report to, if applicable")
  organization?: Reference;

  @doc("Reference to a benchmark to include in the comparison, if applicable")
  benchmarkId?: string;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

@doc("Search parameters for OutcomeRecord resources.")
model OutcomeRecordSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by encounter reference id")
  @query encounter?: string;

  @doc("Filter by provider reference id")
  @query provider?: string;

  @doc("Filter by outcome status")
  @query status?: OutcomeStatus;

  @doc("Filter by complication severity")
  @query complicationSeverity?: ComplicationSeverity;

  @doc("Filter by whether a readmission occurred")
  @query readmission?: boolean;

  @doc("Filter outcomes recorded on or after this date-time")
  @query outcomeDateFrom?: utcDateTime;

  @doc("Filter outcomes recorded on or before this date-time")
  @query outcomeDateTo?: utcDateTime;

  ...PaginationQuery;
}

@doc("Search parameters for ClinicalBenchmark resources.")
model ClinicalBenchmarkSearchParams {
  @doc("Filter by benchmark name keyword (partial match)")
  @query name?: string;

  @doc("Filter by metric name")
  @query metric?: string;

  @doc("Filter by organisation reference id")
  @query organization?: string;

  @doc("Filter by publication status")
  @query status?: PublicationStatus;

  ...PaginationQuery;
}

@doc("Search parameters for OutcomeReport resources.")
model OutcomeReportSearchParams {
  @doc("Filter by organisation reference id")
  @query organization?: string;

  @doc("Filter by benchmark comparison reference id")
  @query benchmarkComparison?: string;

  @doc("Filter reports covering periods starting on or after this date")
  @query periodFrom?: plainDate;

  @doc("Filter reports covering periods ending on or before this date")
  @query periodTo?: plainDate;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("CRUD and search operations for OutcomeRecord resources.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
interface OutcomeRecordManagement {
  @doc("Create a new OutcomeRecord.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createOutcomeRecord")
  create(
    @body body: OutcomeRecord,
  ): {
    @statusCode statusCode: 201;
    @body outcomeRecord: OutcomeRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single OutcomeRecord by id.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getOutcomeRecord")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body outcomeRecord: OutcomeRecord;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing OutcomeRecord.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateOutcomeRecord")
  @route("/{id}")
  update(
    @path id: string,
    @body body: OutcomeRecord,
  ): {
    @statusCode statusCode: 200;
    @body outcomeRecord: OutcomeRecord;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update an OutcomeRecord.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @patch
  @operationId("patchOutcomeRecord")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body outcomeRecord: OutcomeRecord;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an OutcomeRecord by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteOutcomeRecord")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for OutcomeRecord resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchOutcomeRecords")
  @route("/search")
  search(
    ...OutcomeRecordSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<OutcomeRecord>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD and search operations for ClinicalBenchmark resources.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
interface ClinicalBenchmarkManagement {
  @doc("Create a new ClinicalBenchmark.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createClinicalBenchmark")
  create(
    @body body: ClinicalBenchmark,
  ): {
    @statusCode statusCode: 201;
    @body clinicalBenchmark: ClinicalBenchmark;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single ClinicalBenchmark by id.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getClinicalBenchmark")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body clinicalBenchmark: ClinicalBenchmark;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing ClinicalBenchmark.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateClinicalBenchmark")
  @route("/{id}")
  update(
    @path id: string,
    @body body: ClinicalBenchmark,
  ): {
    @statusCode statusCode: 200;
    @body clinicalBenchmark: ClinicalBenchmark;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a ClinicalBenchmark (e.g., retire a superseded benchmark).")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @patch
  @operationId("patchClinicalBenchmark")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body clinicalBenchmark: ClinicalBenchmark;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a ClinicalBenchmark by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteClinicalBenchmark")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for ClinicalBenchmark resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchClinicalBenchmarks")
  @route("/search")
  search(
    ...ClinicalBenchmarkSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ClinicalBenchmark>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Generate, retrieve, and search operations for OutcomeReport resources.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
interface OutcomeReportService {
  @doc("Generate a new aggregated OutcomeReport for a specified procedure code and time period.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("generateOutcomeReport")
  generate(
    @body body: GenerateOutcomeReportRequest,
  ): {
    @statusCode statusCode: 201;
    @body outcomeReport: OutcomeReport;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single OutcomeReport by id.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getOutcomeReport")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body outcomeReport: OutcomeReport;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for OutcomeReport resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchOutcomeReports")
  @route("/search")
  search(
    ...OutcomeReportSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<OutcomeReport>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
