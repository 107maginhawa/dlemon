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
 * Healthcare Support Data Import — bulk data ingestion pipeline management
 * including import job lifecycle, reusable field mapping configurations,
 * validation, dry-run execution, error reporting, and cancellation. Supports
 * clinical, administrative, and financial data in multiple standard formats.
 */
namespace Healthcare.Support.DataImport;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The type of clinical or administrative resource being imported.")
enum ImportType {
  @doc("Patient demographic and identity records")
  patient,

  @doc("Clinical encounter or visit records")
  encounter,

  @doc("Clinical observations, vital signs, or laboratory results")
  observation,

  @doc("Medication records including prescriptions and administrations")
  medication,

  @doc("Healthcare claims for billing and reimbursement")
  claim,

  @doc("A custom resource type defined by the implementation")
  custom,
}

@doc("The source file format of the data being imported.")
enum ImportFormat {
  @doc("Comma-separated values flat file")
  csv,

  @doc("Standard JSON object or array")
  json,

  @doc("Newline-delimited JSON — one JSON object per line (FHIR ndjson)")
  ndjson,

  @doc("HL7 v2 message format (pipe-delimited segments)")
  hl7v2,

  @doc("FHIR Bundle or individual FHIR resource in JSON or XML")
  fhir,

  @doc("Extensible Markup Language")
  xml,
}

@doc("The lifecycle status of an import job.")
enum ImportJobStatus {
  @doc("The import job has been created and the file upload is expected")
  created,

  @doc("The uploaded file is currently being validated against the mapping rules")
  validating,

  @doc("Validation completed successfully — the job is ready to execute")
  validated,

  @doc("The import is actively processing and writing records to the database")
  importing,

  @doc("All records have been processed and the job completed successfully")
  completed,

  @doc("The job encountered a fatal error and could not complete")
  failed,

  @doc("The job was cancelled by the user or system before completion")
  cancelled,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("A mapping between a single source field in the import file and its target field in the destination resource.")
model FieldMapping {
  @doc("The source column name or JSON path in the import file")
  @maxLength(200)
  sourceField: string;

  @doc("The target field path in the destination resource (e.g., 'patient.name.family')")
  @maxLength(200)
  targetField: string;

  @doc("Whether this field mapping is required — import rows missing this source field will fail validation")
  required: boolean;

  @doc("The value to use when the source field is absent or empty, if the mapping is not required")
  @maxLength(500)
  defaultValue?: string;

  @doc("The name of a transform rule to apply to the source value before mapping it to the target")
  @maxLength(100)
  transformRule?: string;
}

@doc("A named transformation rule that can be applied to a source field value during import processing.")
model TransformRule {
  @doc("A unique name for this transformation rule (e.g., 'dateIso8601', 'trimWhitespace', 'genderCode')")
  @maxLength(100)
  name: string;

  @doc("The source field this rule primarily applies to")
  @maxLength(200)
  sourceField: string;

  @doc("A code or expression defining the transformation logic (e.g., a regex, function name, or DSL expression)")
  @maxLength(1000)
  rule: string;

  @doc("Named parameters passed to the transformation rule at execution time")
  parameters?: Record<unknown>;
}

@doc("A single error encountered while validating or importing a data record.")
model ImportError {
  @doc("The 1-indexed row number in the source file where the error occurred")
  @minValue(1)
  rowNumber: int64;

  @doc("The source field name or column that caused the error, if attributable to a specific field")
  @maxLength(200)
  field?: string;

  @doc("The raw source value that caused the error")
  @maxLength(1000)
  value?: string;

  @doc("A machine-readable error code identifying the type of validation or import failure")
  @maxLength(100)
  errorCode: string;

  @doc("A human-readable description of the error")
  @maxLength(1000)
  message: string;

  @doc("The severity level of this error (e.g., 'error', 'warning', 'info')")
  @maxLength(20)
  severity: string;
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

@doc("A bulk data import job tracking the lifecycle of a single import operation from upload through completion.")
model ImportJob extends HealthcareBaseEntity {
  @doc("A human-readable name for this import job (e.g., 'Q1 Patient Migration — Site A')")
  @maxLength(250)
  name: string;

  @doc("The type of resource being imported")
  type: ImportType;

  @doc("The format of the source file being imported")
  sourceFormat: ImportFormat;

  @doc("The current lifecycle status of this import job")
  status: ImportJobStatus;

  @doc("Reference to the uploaded source file stored in the document repository")
  uploadedFile?: Reference;

  @doc("The total number of data records identified in the source file")
  @minValue(0)
  totalRecords?: int64;

  @doc("The number of records successfully processed so far")
  @minValue(0)
  processedRecords?: int64;

  @doc("The number of records that failed validation or import")
  @minValue(0)
  failedRecords?: int64;

  @doc("The date and time processing began")
  startedAt?: utcDateTime;

  @doc("The date and time processing completed, whether successfully or with errors")
  completedAt?: utcDateTime;

  @doc("The user who submitted this import job")
  requestedBy: Reference;

  @doc("Whether this job is running in dry-run mode — records are validated but not persisted")
  dryRun: boolean;

  @doc("Reference to a document containing the detailed error report for this job, if errors occurred")
  errorReport?: Reference;
}

@doc("A reusable field mapping configuration defining how source file fields map to target resource fields for a specific format and resource type.")
model ImportMapping extends HealthcareBaseEntity {
  @doc("A human-readable name for this mapping configuration (e.g., 'Legacy EMR Patient CSV v2')")
  @maxLength(250)
  name: string;

  @doc("The source file format this mapping applies to")
  sourceFormat: ImportFormat;

  @doc("The target FHIR or internal resource type this mapping produces (e.g., 'Patient', 'Observation')")
  @maxLength(100)
  targetResourceType: string;

  @doc("The ordered list of field mappings defining how source columns translate to target fields")
  fieldMappings: FieldMapping[];

  @doc("Optional transformation rules that can be referenced by field mappings")
  transformRules?: TransformRule[];

  @doc("The publication status of this mapping — only active mappings should be used in production imports")
  status: PublicationStatus;
}

// ---------------------------------------------------------------------------
// Request models
// ---------------------------------------------------------------------------

@doc("Request body for uploading a source file to an existing import job.")
model UploadImportFileRequest {
  @doc("Reference to the document resource containing the uploaded file")
  fileReference: Reference;

  @doc("The MIME content type of the uploaded file (e.g., 'text/csv', 'application/json')")
  @maxLength(100)
  contentType: string;

  @doc("The size in bytes of the uploaded file")
  @minValue(0)
  fileSizeBytes: int64;
}

@doc("Request body for executing (or dry-running) a validated import job.")
model ExecuteImportJobRequest {
  @doc("Whether to execute as a dry run — records are validated and counted but not persisted")
  dryRun?: boolean;

  @doc("The reference id of the ImportMapping to apply during execution")
  mappingId?: string;
}

@doc("Request body for cancelling an active or queued import job.")
model CancelImportJobRequest {
  @doc("The reason for cancelling this import job")
  @maxLength(500)
  reason?: string;
}

@doc("Query parameters for retrieving import errors for a specific job.")
model ImportErrorQueryParams {
  @doc("Filter errors by severity level (e.g., 'error', 'warning', 'info')")
  @query severity?: string;

  @doc("Filter errors by error code")
  @query errorCode?: string;

  @doc("Filter errors attributed to a specific source field")
  @query field?: string;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

@doc("Search parameters for ImportJob resources.")
model ImportJobSearchParams {
  @doc("Filter by import type")
  @query type?: ImportType;

  @doc("Filter by source format")
  @query sourceFormat?: ImportFormat;

  @doc("Filter by job status")
  @query status?: ImportJobStatus;

  @doc("Filter by the user who requested the job")
  @query requestedBy?: string;

  @doc("Filter by dry-run flag")
  @query dryRun?: boolean;

  @doc("Filter jobs started on or after this date-time")
  @query startedFrom?: utcDateTime;

  @doc("Filter jobs started on or before this date-time")
  @query startedTo?: utcDateTime;

  ...PaginationQuery;
}

@doc("Search parameters for ImportMapping resources.")
model ImportMappingSearchParams {
  @doc("Filter by mapping name keyword (partial match)")
  @query name?: string;

  @doc("Filter by source format")
  @query sourceFormat?: ImportFormat;

  @doc("Filter by target resource type")
  @query targetResourceType?: string;

  @doc("Filter by publication status")
  @query status?: PublicationStatus;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Full lifecycle management for ImportJob resources: create, upload, validate, execute, status, errors, and cancel.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
interface ImportJobManagement {
  @doc("Create a new ImportJob record to begin the import lifecycle.")
  @extension("x-security-required-roles", #["admin"])
  @post
  @operationId("createImportJob")
  create(
    @body body: ImportJob,
  ): {
    @statusCode statusCode: 201;
    @body importJob: ImportJob;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve the current state and progress of a single ImportJob by id.")
  @extension("x-security-required-roles", #["admin"])
  @get
  @operationId("getImportJobStatus")
  @route("/{id}")
  getStatus(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body importJob: ImportJob;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Associate an uploaded source file with an import job, advancing it from created to ready for validation.")
  @extension("x-security-required-roles", #["admin"])
  @post
  @operationId("uploadImportFile")
  @route("/{id}/upload")
  upload(
    @path id: string,
    @body body: UploadImportFileRequest,
  ): {
    @statusCode statusCode: 200;
    @body importJob: ImportJob;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("Trigger validation of the uploaded source file against the configured import mapping, without persisting any records.")
  @extension("x-security-required-roles", #["admin"])
  @post
  @operationId("validateImportJob")
  @route("/{id}/validate")
  validate(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body importJob: ImportJob;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("Execute a validated import job, optionally as a dry run to preview the outcome without persisting data.")
  @extension("x-security-required-roles", #["admin"])
  @post
  @operationId("executeImportJob")
  @route("/{id}/execute")
  execute(
    @path id: string,
    @body body: ExecuteImportJobRequest,
  ): {
    @statusCode statusCode: 200;
    @body importJob: ImportJob;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a paginated list of validation and import errors for a specific import job.")
  @extension("x-security-required-roles", #["admin"])
  @get
  @operationId("getImportJobErrors")
  @route("/{id}/errors")
  getErrors(
    @path id: string,
    ...ImportErrorQueryParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ImportError>;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Cancel an import job that is in the created, validating, validated, or importing state.")
  @extension("x-security-required-roles", #["admin"])
  @post
  @operationId("cancelImportJob")
  @route("/{id}/cancel")
  cancel(
    @path id: string,
    @body body: CancelImportJobRequest,
  ): {
    @statusCode statusCode: 200;
    @body importJob: ImportJob;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD and search operations for ImportMapping resources.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
interface ImportMappingManagement {
  @doc("Create a new ImportMapping configuration.")
  @extension("x-security-required-roles", #["admin"])
  @post
  @operationId("createImportMapping")
  create(
    @body body: ImportMapping,
  ): {
    @statusCode statusCode: 201;
    @body importMapping: ImportMapping;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single ImportMapping by id.")
  @extension("x-security-required-roles", #["admin"])
  @get
  @operationId("getImportMapping")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body importMapping: ImportMapping;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing ImportMapping configuration.")
  @extension("x-security-required-roles", #["admin"])
  @put
  @operationId("updateImportMapping")
  @route("/{id}")
  update(
    @path id: string,
    @body body: ImportMapping,
  ): {
    @statusCode statusCode: 200;
    @body importMapping: ImportMapping;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update an ImportMapping (e.g., retire a superseded mapping).")
  @extension("x-security-required-roles", #["admin"])
  @patch
  @operationId("patchImportMapping")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body importMapping: ImportMapping;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an ImportMapping by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteImportMapping")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for ImportMapping resources using filter parameters.")
  @extension("x-security-required-roles", #["admin"])
  @get
  @operationId("searchImportMappings")
  @route("/search")
  search(
    ...ImportMappingSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ImportMapping>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
