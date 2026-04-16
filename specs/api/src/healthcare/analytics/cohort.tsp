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
 * Healthcare Cohort and Research Extract module.
 *
 * Provides models and operations for defining patient cohorts from criteria,
 * executing cohort evaluations, requesting de-identified research data extracts,
 * and recording data lineage for audit and reproducibility purposes.
 */
namespace Healthcare.Analytics.Cohorts;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The publication status of a cohort definition.")
enum CohortStatus {
  @doc("The cohort definition is under development and has not been approved for use")
  draft,

  @doc("The cohort definition is approved and actively used for patient identification")
  active,

  @doc("The cohort definition has been superseded or withdrawn")
  retired,
}

@doc("The comparison operator used in a cohort inclusion criterion.")
enum CriteriaOperator {
  @doc("The field value must equal the specified value")
  equals,

  @doc("The field value must not equal the specified value")
  notEquals,

  @doc("The field value must be greater than the specified value")
  greaterThan,

  @doc("The field value must be less than the specified value")
  lessThan,

  @doc("The field value must contain the specified string (for text fields)")
  contains,

  @doc("The field value must be one of the values in the specified list")
  `in`,

  @doc("The field value must fall between two values (inclusive)")
  between,

  @doc("The field must have a non-null value")
  exists,

  @doc("The field must be null or absent")
  notExists,
}

@doc("The logical conjunction connecting this criterion to the next criterion in the list.")
enum CriteriaConjunction {
  @doc("Both this criterion and the next criterion must be satisfied")
  and,

  @doc("Either this criterion or the next criterion must be satisfied")
  or,
}

@doc("The status of a research data extract request.")
enum ExtractStatus {
  @doc("The extract has been requested and is queued for processing")
  requested,

  @doc("The extract is currently being generated")
  inProgress,

  @doc("The extract has been successfully generated and is available for download")
  completed,

  @doc("The extract generation failed")
  failed,

  @doc("The extract request was cancelled before completion")
  cancelled,
}

@doc("The output format for a research data extract.")
enum ExportFormat {
  @doc("Comma-separated values format, suitable for spreadsheet analysis")
  csv,

  @doc("Newline-delimited JSON format, suitable for streaming processing")
  ndjson,

  @doc("Apache Parquet columnar format, suitable for large-scale analytics")
  parquet,

  @doc("FHIR Bundle format (JSON), suitable for interoperability and clinical tooling")
  fhirBundle,
}

@doc("The type of transformation applied in a data lineage record.")
enum TransformationType {
  @doc("Data was copied verbatim from the source to the target")
  copy,

  @doc("Data was aggregated (e.g., summed, averaged) from multiple source records")
  aggregate,

  @doc("New data was derived or calculated from the source")
  derive,

  @doc("A subset of the source data was selected")
  filter,

  @doc("Multiple source datasets were combined into a single target")
  merge,

  @doc("The source data was de-identified to produce the target")
  deIdentify,

  @doc("Identifiers in the source data were pseudonymised in the target")
  pseudonymize,

  @doc("The source data was enriched with additional information")
  enrich,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

/**
 * A single inclusion or exclusion criterion used to define a cohort.
 */
model CohortCriteria {
  /** The field or attribute to evaluate (e.g., "condition.code", "age", "gender"). */
  field: string;

  /** The comparison operator to apply. */
  operator: CriteriaOperator;

  /** The value to compare against for single-value operators. */
  value?: string;

  /** The list of values to compare against for the 'in' operator. */
  valueList?: string[];

  /** The logical conjunction connecting this criterion to the next one in the list. */
  conjunction: CriteriaConjunction;
}

// ---------------------------------------------------------------------------
// Root resource — CohortDefinition
// ---------------------------------------------------------------------------

/**
 * A formal definition of a patient or subject cohort, specifying the inclusion
 * and exclusion criteria used to identify members. Cohorts can be evaluated
 * to produce a count or list of matching subjects.
 */
model CohortDefinition extends HealthcareBaseEntity {
  /** A human-friendly name for the cohort definition. */
  name: string;

  /** A free-text description of the cohort and its intended use. */
  description?: string;

  /** The publication status of this cohort definition. */
  status: CohortStatus;

  /** The FHIR resource type of subjects in this cohort (e.g., "Patient", "Practitioner"). */
  subjectType: string;

  /** The ordered list of inclusion and exclusion criteria that define membership in this cohort. */
  criteria: CohortCriteria[];

  /** The estimated number of subjects matching this cohort, if a recent evaluation has been performed. */
  estimatedSize?: int32;

  /** The date and time at which this cohort definition was last evaluated. */
  lastEvaluated?: utcDateTime;

  /** The practitioner or researcher who authored this cohort definition. */
  author?: Reference;

  /** The research or clinical purpose for which this cohort was defined. */
  purpose?: string;
}

// ---------------------------------------------------------------------------
// Root resource — ResearchExtract
// ---------------------------------------------------------------------------

/**
 * A request for a de-identified dataset derived from a specific cohort,
 * intended for research or analytics use. Tracks the full lifecycle of
 * the extract from request through completion.
 */
model ResearchExtract extends HealthcareBaseEntity {
  /** The cohort definition from which this extract was generated. */
  cohort: Reference;

  /** The de-identification profile applied to the extract, if any. */
  deIdentificationProfile?: Reference;

  /** The current status of the extract request. */
  status: ExtractStatus;

  /** The file format for the extract output. */
  format: ExportFormat;

  /** The date and time at which the extract was requested. */
  requestedAt: utcDateTime;

  /** The date and time at which the extract completed (successfully or with failure). */
  completedAt?: utcDateTime;

  /** The researcher or system that requested the extract. */
  requestedBy: Reference;

  /** The total number of records included in the completed extract. */
  recordCount?: int64;

  /** The storage reference (e.g., S3 URI or storage key) for the completed extract file. */
  fileReference?: string;

  /** The stated purpose of use for this data extract. */
  purpose: PurposeOfUse;

  /** The IRB (Institutional Review Board) approval number for the associated research study, if applicable. */
  irbApproval?: string;

  /** Additional notes about the extract request or its intended use. */
  note?: string;
}

// ---------------------------------------------------------------------------
// Root resource — DataLineageRecord
// ---------------------------------------------------------------------------

/**
 * An immutable record documenting the provenance and transformation of a
 * dataset, enabling downstream consumers to trace data back to its origin
 * and understand how it was derived.
 */
model DataLineageRecord extends HealthcareBaseEntity {
  /** The source dataset or resource from which the target was derived. */
  source: Reference;

  /** The target dataset or resource produced by the transformation. */
  target: Reference;

  /** The type of transformation applied to produce the target from the source. */
  transformationType: TransformationType;

  /** A human-readable description of the transformation. */
  description?: string;

  /** The date and time at which the transformation was performed. */
  performedAt: utcDateTime;

  /** The practitioner, system, or service that performed the transformation. */
  performedBy?: Reference;

  /** Additional parameters or configuration used during the transformation. */
  parameters?: Record<unknown>;
}

// ---------------------------------------------------------------------------
// Operation models
// ---------------------------------------------------------------------------

/** Request body for evaluating a cohort definition. */
model CohortEvaluateRequest {
  /** If true, return the ids of matching subjects in addition to the count. */
  includeSubjectIds?: boolean;

  /** The maximum number of subject ids to return (if includeSubjectIds is true). */
  maxResults?: int32;
}

/** Response body for a cohort evaluation. */
model CohortEvaluateResponse {
  /** The number of subjects matching the cohort criteria. */
  count: int64;

  /** The ids of matching subjects, if requested and within the maxResults limit. */
  subjectIds?: string[];

  /** The date and time at which the evaluation was performed. */
  evaluatedAt: utcDateTime;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

/** Query parameters for searching CohortDefinition resources. */
model CohortSearchParams {
  /** Filter by cohort name (partial match). */
  @query name?: string;

  /** Filter by status. */
  @query status?: string;

  /** Filter by subject type. */
  @query subjectType?: string;

  /** Filter by author reference id. */
  @query author?: string;

  ...PaginationQuery;
}

/** Query parameters for searching ResearchExtract resources. */
model ResearchExtractSearchParams {
  /** Filter by cohort definition reference id. */
  @query cohort?: string;

  /** Filter by extract status. */
  @query status?: string;

  /** Filter by requester reference id. */
  @query requestedBy?: string;

  /** Filter by purpose of use. */
  @query purpose?: string;

  ...PaginationQuery;
}

/** Query parameters for searching DataLineageRecord resources. */
model DataLineageSearchParams {
  /** Filter by source reference id. */
  @query source?: string;

  /** Filter by target reference id. */
  @query target?: string;

  /** Filter by transformation type. */
  @query transformationType?: string;

  /** Filter by performer reference id. */
  @query performedBy?: string;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * CRUD, evaluation, and search operations for CohortDefinition resources.
 */
@tag("Healthcare:Analytics")
@useAuth(bearerAuth)
interface CohortManagement {
  /** Create a new CohortDefinition. */
  @post
  @operationId("createCohortDefinition")
  create(
    @body body: CohortDefinition,
  ): {
    @statusCode statusCode: 201;
    @body cohortDefinition: CohortDefinition;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Retrieve a single CohortDefinition by id. */
  @get
  @operationId("getCohortDefinition")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body cohortDefinition: CohortDefinition;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Replace an existing CohortDefinition. */
  @put
  @operationId("updateCohortDefinition")
  @route("/{id}")
  update(
    @path id: string,
    @body body: CohortDefinition,
  ): {
    @statusCode statusCode: 200;
    @body cohortDefinition: CohortDefinition;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Partially update a CohortDefinition. */
  @patch
  @operationId("patchCohortDefinition")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body cohortDefinition: CohortDefinition;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Delete a CohortDefinition by id. */
  @delete
  @operationId("deleteCohortDefinition")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Evaluate a cohort definition against the current patient population. */
  @post
  @operationId("evaluateCohort")
  @route("/{id}/evaluate")
  evaluate(
    @path id: string,
    @body body: CohortEvaluateRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: CohortEvaluateResponse;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Search for CohortDefinitions using filter parameters. */
  @get
  @operationId("searchCohortDefinitions")
  @route("/search")
  search(
    ...CohortSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<CohortDefinition>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * Create, search, and download operations for ResearchExtract resources.
 */
@tag("Healthcare:Analytics")
@useAuth(bearerAuth)
interface ResearchExtractManagement {
  /** Request a new research data extract. */
  @post
  @operationId("createResearchExtract")
  create(
    @body body: ResearchExtract,
  ): {
    @statusCode statusCode: 201;
    @body researchExtract: ResearchExtract;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Retrieve a single ResearchExtract record by id. */
  @get
  @operationId("getResearchExtract")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body researchExtract: ResearchExtract;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Search for ResearchExtracts using filter parameters. */
  @get
  @operationId("searchResearchExtracts")
  @route("/search")
  search(
    ...ResearchExtractSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ResearchExtract>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Obtain a pre-signed download URL for a completed research extract. */
  @get
  @operationId("downloadResearchExtract")
  @route("/{id}/download")
  download(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body result: {
      /** A pre-signed URL from which the extract file can be downloaded. */
      downloadUrl: string;

      /** The number of seconds until the pre-signed URL expires. */
      expiresIn: int32;
    };
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;
}

/**
 * Create and search operations for DataLineageRecord resources.
 * Lineage records are append-only to preserve audit integrity.
 */
@tag("Healthcare:Analytics")
@useAuth(bearerAuth)
interface DataLineageManagement {
  /** Create a new DataLineageRecord. */
  @post
  @operationId("createDataLineageRecord")
  create(
    @body body: DataLineageRecord,
  ): {
    @statusCode statusCode: 201;
    @body dataLineageRecord: DataLineageRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Retrieve a single DataLineageRecord by id. */
  @get
  @operationId("getDataLineageRecord")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body dataLineageRecord: DataLineageRecord;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Search for DataLineageRecords using filter parameters. */
  @get
  @operationId("searchDataLineageRecords")
  @route("/search")
  search(
    ...DataLineageSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<DataLineageRecord>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
