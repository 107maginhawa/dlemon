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
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

/**
 * FHIR Bulk Data Export — implements the HL7 FHIR Bulk Data Access (Flat FHIR)
 * specification (https://hl7.org/fhir/uv/bulkdata/) for asynchronous export of
 * large FHIR datasets in NDJSON format.
 *
 * Supports system-level, patient-level, and group-level export kickoff,
 * status polling, and cancellation.
 */
namespace Healthcare.Conformance.BulkExport;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Lifecycle status of a bulk data export job.")
enum BulkExportStatus {
  @doc("The export request has been accepted and is queued for processing")
  accepted,

  @doc("The export job is actively running")
  inProgress,

  @doc("The export job has completed successfully; the manifest is available")
  complete,

  @doc("The export job encountered a fatal error and cannot continue")
  error,

  @doc("The export job was explicitly cancelled by the client or an administrator")
  cancelled,
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

@doc("Describes a single NDJSON output file produced by a bulk export job.")
model BulkExportOutputFile {
  @doc("The FHIR resource type contained in this output file (e.g., 'Patient', 'Observation')")
  type: string;

  @doc("Presigned URL where the NDJSON file can be downloaded. Valid for the duration indicated by the server's token expiry policy.")
  @format("uri")
  url: string;

  @doc("The number of resources in this output file. Useful for progress tracking and validation.")
  count?: int64;
}

@doc("The completion manifest returned when a bulk export job finishes successfully. Contains signed download URLs for all output and error files.")
model BulkExportManifest {
  @doc("Server timestamp indicating the transaction time boundary of the export. Resources modified after this time are not included.")
  transactionTime: utcDateTime;

  @doc("The original kickoff request URL that initiated this export")
  @format("uri")
  request: string;

  @doc("Whether the output files require a valid Bearer token for download. When true, the client must include an Authorization header when fetching files.")
  requiresAccessToken: boolean;

  @doc("List of successfully exported output files, one entry per resource type per shard")
  output: BulkExportOutputFile[];

  @doc("List of error files in NDJSON format (OperationOutcome resources describing individual resource export failures). Empty array when no errors occurred.")
  error: BulkExportOutputFile[];
}

@doc("Status response returned during polling of an in-progress or completed bulk export job.")
model BulkExportStatusResponse {
  @doc("Current lifecycle status of the export job")
  status: BulkExportStatus;

  @doc("Human-readable progress description (e.g., '42% complete', 'Processing Observation resources'). Present only while status is inProgress.")
  progress?: string;

  @doc("The export completion manifest. Present only when status is 'complete'.")
  manifest?: BulkExportManifest;
}

@doc("Query parameters for FHIR bulk export kickoff requests. All parameters are optional and allow fine-grained scoping of what data is exported.")
model BulkExportKickoffParams {
  @doc("Comma-separated list of FHIR resource types to include (e.g., 'Patient,Observation,Condition'). When omitted, all resource types in the export scope are included.")
  @query
  _type?: string;

  @doc("ISO 8601 date-time string. When provided, only resources with a lastUpdated timestamp at or after this value are exported. Used for incremental exports.")
  @query
  _since?: string;

  @doc("Comma-separated list of search URL queries that restrict the type of resources to be included. Format: '<resourceType>?<searchParams>'. Requires server support for _typeFilter.")
  @query
  _typeFilter?: string;

  @doc("Requested output format for exported files. Defaults to 'application/fhir+ndjson' if omitted. Other formats may include 'application/csv' for tabular output.")
  @query
  _outputFormat?: string;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

@doc("FHIR Bulk Data Export endpoints enabling large-scale asynchronous export of FHIR resources in NDJSON format. All kickoff operations return 202 Accepted with a Content-Location polling URL. Implements the HL7 Bulk Data Access specification.")
@tag("Healthcare:Conformance")
@useAuth(bearerAuth)
@route("/fhir")
interface BulkExportService {
  @doc("Initiate a system-level bulk export of all resources the caller is authorized to access. Returns 202 Accepted immediately; the response Content-Location header contains the URL for polling export status. Intended for full-system data extracts, analytics pipelines, and backup workflows.")
  @operationId("kickoffSystemExport")
  @extension("x-security-required-roles", #["admin", "researcher"])
  @post
  @route("/$export")
  kickoffSystemExport(
    ...BulkExportKickoffParams,
  ): {
    @statusCode statusCode: 202;
    @header("Content-Location") contentLocation: string;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiRateLimitResponse | ApiInternalServerErrorResponse;

  @doc("Initiate a patient-level bulk export that returns all resources in the patient compartment for every patient the caller has access to. The exported data covers the full patient record across all resource types in scope.")
  @operationId("kickoffPatientExport")
  @extension("x-security-required-roles", #["admin", "researcher"])
  @post
  @route("/Patient/$export")
  kickoffPatientExport(
    ...BulkExportKickoffParams,
  ): {
    @statusCode statusCode: 202;
    @header("Content-Location") contentLocation: string;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiRateLimitResponse | ApiInternalServerErrorResponse;

  @doc("Initiate a group-level bulk export that returns all resources for patients in the specified FHIR Group resource. Used for population health, care management cohorts, and payer-defined member lists.")
  @operationId("kickoffGroupExport")
  @extension("x-security-required-roles", #["admin", "researcher"])
  @post
  @route("/Group/{groupId}/$export")
  kickoffGroupExport(
    @path @doc("Logical ID of the FHIR Group resource defining the patient cohort to export") groupId: string,
    ...BulkExportKickoffParams,
  ): {
    @statusCode statusCode: 202;
    @header("Content-Location") contentLocation: string;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiRateLimitResponse | ApiInternalServerErrorResponse;

  @doc("Poll the status of an in-progress or completed bulk export job. Returns 202 with progress information while the job is running, or 200 with the completion manifest when the job is done. The X-Progress header may contain a human-readable progress description.")
  @operationId("getExportStatus")
  @extension("x-security-required-roles", #["admin", "researcher"])
  @get
  @route("/$export-status/{exportId}")
  getExportStatus(
    @path @doc("Unique identifier for the bulk export job") exportId: string,
  ): {
    @statusCode statusCode: 200;
    @body result: BulkExportStatusResponse;
  } | {
    @statusCode statusCode: 202;
    @header("X-Progress") progress: string;
    @body result: BulkExportStatusResponse;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Cancel an in-progress or pending bulk export job. Returns 204 No Content on success. Cancellation is best-effort — the job may already have completed by the time this request is processed. Any output files produced before cancellation are discarded.")
  @operationId("cancelExport")
  @extension("x-security-required-roles", #["admin", "researcher"])
  @delete
  @route("/$export-status/{exportId}")
  cancelExport(
    @path @doc("Unique identifier for the bulk export job to cancel") exportId: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

// ---------------------------------------------------------------------------
// FHIR Bulk Data $import
// ---------------------------------------------------------------------------

@doc("Status of a bulk import job.")
enum BulkImportStatus {
  @doc("Import request accepted, processing not yet started")
  accepted,
  @doc("Import is in progress")
  inProgress,
  @doc("Import completed successfully")
  complete,
  @doc("Import encountered errors")
  error,
  @doc("Import was cancelled")
  cancelled,
}

@doc("Parameters for a FHIR Bulk Data $import kickoff request.")
model BulkImportKickoffParams {
  @doc("The type of input — currently only 'ndjson' is supported")
  inputFormat?: string;

  @doc("Input source files to import")
  inputSource: BulkImportInputFile[];

  @doc("Storage detail — how/where the data is available")
  storageDetail?: Record<unknown>;
}

@doc("An input file for bulk import.")
model BulkImportInputFile {
  @doc("FHIR resource type contained in this file")
  type: string;

  @doc("URL where the NDJSON file can be retrieved")
  url: string;
}

@doc("Status response for a bulk import job.")
model BulkImportStatusResponse {
  @doc("Current status of the import")
  status: BulkImportStatus;

  @doc("Progress description")
  progress?: string;

  @doc("Number of resources successfully imported")
  resourcesImported?: int64;

  @doc("Number of resources that failed to import")
  resourcesFailed?: int64;

  @doc("Error details if status is 'error'")
  errors?: BulkImportError[];
}

@doc("An error encountered during bulk import.")
model BulkImportError {
  @doc("FHIR resource type that failed")
  type: string;

  @doc("The URL of the source file")
  url: string;

  @doc("Number of resources that failed from this file")
  count: int64;

  @doc("Error details")
  details?: string;
}

@doc("FHIR Bulk Data $import service. Complement to $export for loading data into the system.")
@tag("Healthcare:Conformance")
@useAuth(bearerAuth)
interface BulkImportService {
  @doc("Kick off a FHIR Bulk Data $import operation.")
  @operationId("kickoffBulkImport")
  @extension("x-security-required-roles", #["admin"])
  @post
  @route("/$import")
  kickoffImport(
    @body params: BulkImportKickoffParams
  ): {
    @statusCode statusCode: 202;
    @header("Content-Location") contentLocation: string;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

  @doc("Check the status of a bulk import job.")
  @operationId("getBulkImportStatus")
  @extension("x-security-required-roles", #["admin"])
  @get
  @route("/$import-status/{importId}")
  getImportStatus(
    @path importId: string
  ): {
    @statusCode statusCode: 200;
    @body body: BulkImportStatusResponse;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse;

  @doc("Cancel an in-progress bulk import job.")
  @operationId("cancelBulkImport")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/$import-status/{importId}")
  cancelImport(
    @path importId: string
  ): ApiNoContentResponse | ApiNotFoundResponse | ApiUnauthorizedResponse;
}
