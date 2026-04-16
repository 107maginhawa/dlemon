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
 * Healthcare Analytics Reporting — management of report definitions, report
 * execution runs, and configurable dashboards. Supports scheduled and
 * on-demand report generation across clinical, financial, operational,
 * quality, compliance, and research categories with multiple output formats.
 */
namespace Healthcare.Analytics.Reporting;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The category of a report or dashboard, indicating its primary domain and audience.")
enum ReportCategory {
  @doc("Clinical reports covering patient care quality, outcomes, and clinical metrics")
  clinical,

  @doc("Financial reports covering revenue, billing, and cost analysis")
  financial,

  @doc("Operational reports covering workflow efficiency, utilisation, and throughput")
  operational,

  @doc("Quality and safety reports covering indicators, benchmarks, and improvement programmes")
  quality,

  @doc("Compliance and regulatory reports for accreditation and statutory submissions")
  compliance,

  @doc("Research data extracts and analysis reports for approved research projects")
  research,

  @doc("Custom reports not fitting a standard category")
  custom,
}

@doc("The output file format for a generated report.")
enum ReportFormat {
  @doc("Portable Document Format — suitable for print and archiving")
  pdf,

  @doc("Comma-separated values — suitable for spreadsheet import")
  csv,

  @doc("Microsoft Excel workbook — suitable for rich spreadsheet analysis")
  xlsx,

  @doc("JSON — suitable for programmatic consumption by APIs and applications")
  json,

  @doc("HTML — suitable for web rendering and email delivery")
  html,
}

@doc("The schedule frequency for automatically running a report.")
enum ScheduleFrequency {
  @doc("The report is generated every day")
  daily,

  @doc("The report is generated once per week")
  weekly,

  @doc("The report is generated once per calendar month")
  monthly,

  @doc("The report is generated once per calendar quarter")
  quarterly,

  @doc("The report is generated once per calendar year")
  annually,
}

@doc("The current execution status of a report run.")
enum ReportRunStatus {
  @doc("The report run has been submitted and is waiting in the execution queue")
  queued,

  @doc("The report run is currently being executed")
  running,

  @doc("The report run completed successfully and the output is available")
  completed,

  @doc("The report run failed due to an error")
  failed,

  @doc("The report run was cancelled before completion")
  cancelled,
}

@doc("The type of widget displayed on a dashboard.")
enum WidgetType {
  @doc("A chart visualisation (bar, line, pie, scatter, etc.)")
  chart,

  @doc("A tabular data grid")
  table,

  @doc("A single key metric value with optional comparison indicator")
  metric,

  @doc("A gauge or dial chart showing a value relative to a range")
  gauge,

  @doc("A geographic map visualisation")
  map,

  @doc("A ranked or filtered list")
  list,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("A parameter definition for a report, specifying its name, type, and optionality.")
model ReportParameter {
  @doc("The programmatic name of the parameter (e.g., 'startDate', 'organizationId')")
  @maxLength(100)
  name: string;

  @doc("The data type of the parameter (e.g., 'date', 'string', 'integer', 'boolean')")
  @maxLength(50)
  type: string;

  @doc("Whether this parameter must be supplied when running the report")
  required: boolean;

  @doc("The default value used when the parameter is not supplied, if optional")
  @maxLength(500)
  defaultValue?: string;

  @doc("A human-readable description of what this parameter controls")
  @maxLength(300)
  description?: string;
}

@doc("A schedule definition controlling when a report is automatically generated and delivered.")
model ReportSchedule {
  @doc("How frequently the report should be generated")
  frequency: ScheduleFrequency;

  @doc("For weekly schedules, the day of the week to run (e.g., 'monday', 'friday')")
  @maxLength(20)
  dayOfWeek?: string;

  @doc("For monthly schedules, the day of the month to run (1–31)")
  @minValue(1)
  @maxValue(31)
  dayOfMonth?: int32;

  @doc("The time of day to generate the report in HH:MM format (24-hour UTC)")
  @maxLength(5)
  time?: string;

  @doc("Email addresses to which the generated report should be delivered")
  recipients?: string[];

  @doc("Whether this schedule is currently active")
  active: boolean;
}

@doc("A widget displayed within a dashboard, combining a visualisation type with its data source and layout position.")
model DashboardWidget {
  @doc("The display title of the widget shown in the dashboard UI")
  @maxLength(200)
  title: string;

  @doc("The visualisation type of this widget")
  type: WidgetType;

  @doc("The identifier of the data source or query backing this widget")
  @maxLength(200)
  dataSource: string;

  @doc("Widget-specific configuration controlling appearance, filters, and aggregation")
  configuration: Record<unknown>;

  @doc("The layout position and dimensions of this widget on the dashboard grid")
  position: WidgetPosition;
}

@doc("The grid-based layout position and size of a dashboard widget.")
model WidgetPosition {
  @doc("The starting row of the widget on the dashboard grid (0-indexed)")
  @minValue(0)
  row: int32;

  @doc("The starting column of the widget on the dashboard grid (0-indexed)")
  @minValue(0)
  column: int32;

  @doc("The number of grid columns the widget spans")
  @minValue(1)
  width: int32;

  @doc("The number of grid rows the widget spans")
  @minValue(1)
  height: int32;
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

@doc("A reusable report definition specifying the data source, parameters, output format, and optional schedule for a report.")
model ReportDefinition extends HealthcareBaseEntity {
  @doc("A human-readable name for this report (e.g., '30-Day Readmission Rate by Facility')")
  @maxLength(250)
  name: string;

  @doc("A description of the report's purpose and intended audience")
  @maxLength(1000)
  description?: string;

  @doc("The domain category of this report")
  category: ReportCategory;

  @doc("The identifier of the underlying data source or query this report draws from")
  @maxLength(200)
  dataSource: string;

  @doc("The parameter definitions that control the scope and filters of this report")
  parameters: ReportParameter[];

  @doc("The file format in which this report is generated")
  outputFormat: ReportFormat;

  @doc("The schedule on which this report is automatically generated, if applicable")
  schedule?: ReportSchedule;

  @doc("The publication status of this report definition")
  status: PublicationStatus;

  @doc("The practitioner or user who authored this report definition")
  author?: Reference;
}

@doc("A record of a single report execution run, tracking its status, output location, and any errors.")
model ReportRun extends HealthcareBaseEntity {
  @doc("Reference to the ReportDefinition that was executed")
  definition: Reference;

  @doc("The runtime parameter values used for this execution, keyed by parameter name")
  parameters?: Record<unknown>;

  @doc("The current execution status of this report run")
  status: ReportRunStatus;

  @doc("The date and time execution began")
  startedAt?: utcDateTime;

  @doc("The date and time execution completed, if finished")
  completedAt?: utcDateTime;

  @doc("The user or system that requested this report run")
  requestedBy: Reference;

  @doc("A pre-signed or internal URL from which the completed report output can be downloaded")
  @maxLength(2048)
  outputUrl?: string;

  @doc("The size in bytes of the generated output file")
  @minValue(0)
  outputSize?: int64;

  @doc("A description of the error that caused this run to fail, if applicable")
  @maxLength(2000)
  errorMessage?: string;

  @doc("The date and time after which the output file will no longer be available for download")
  expiresAt?: utcDateTime;
}

@doc("A configurable dashboard composed of multiple data widgets for at-a-glance monitoring.")
model Dashboard extends HealthcareBaseEntity {
  @doc("A human-readable name for this dashboard (e.g., 'Emergency Department Operations')")
  @maxLength(250)
  name: string;

  @doc("A description of the dashboard's purpose and intended audience")
  @maxLength(1000)
  description?: string;

  @doc("The domain category of this dashboard")
  category: ReportCategory;

  @doc("The widgets displayed on this dashboard")
  widgets: DashboardWidget[];

  @doc("The user who owns and manages this dashboard")
  owner?: Reference;

  @doc("Whether this dashboard is shared with other users in the organisation")
  shared: boolean;

  @doc("The publication status of this dashboard")
  status: PublicationStatus;
}

// ---------------------------------------------------------------------------
// Request models
// ---------------------------------------------------------------------------

@doc("Request body for creating a new report run (immediate or queued execution).")
model CreateReportRunRequest {
  @doc("Reference to the report definition to execute")
  definitionId: string;

  @doc("Runtime parameter values for this execution, overriding definition defaults")
  parameters?: Record<unknown>;
}

@doc("Request body for cancelling an in-progress or queued report run.")
model CancelReportRunRequest {
  @doc("The reason for cancelling this report run")
  @maxLength(500)
  reason?: string;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

@doc("Search parameters for ReportDefinition resources.")
model ReportDefinitionSearchParams {
  @doc("Filter by report name keyword (partial match)")
  @query name?: string;

  @doc("Filter by report category")
  @query category?: ReportCategory;

  @doc("Filter by publication status")
  @query status?: PublicationStatus;

  @doc("Filter by author reference id")
  @query author?: string;

  @doc("Filter by output format")
  @query outputFormat?: ReportFormat;

  ...PaginationQuery;
}

@doc("Search parameters for ReportRun resources.")
model ReportRunSearchParams {
  @doc("Filter by report definition reference id")
  @query definition?: string;

  @doc("Filter by run status")
  @query status?: ReportRunStatus;

  @doc("Filter by requestedBy reference id")
  @query requestedBy?: string;

  @doc("Filter runs started on or after this date-time")
  @query startedFrom?: utcDateTime;

  @doc("Filter runs started on or before this date-time")
  @query startedTo?: utcDateTime;

  ...PaginationQuery;
}

@doc("Search parameters for Dashboard resources.")
model DashboardSearchParams {
  @doc("Filter by dashboard name keyword (partial match)")
  @query name?: string;

  @doc("Filter by dashboard category")
  @query category?: ReportCategory;

  @doc("Filter by publication status")
  @query status?: PublicationStatus;

  @doc("Filter by owner reference id")
  @query owner?: string;

  @doc("Filter by whether the dashboard is shared")
  @query shared?: boolean;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("CRUD and search operations for ReportDefinition resources.")
@tag("Healthcare:Analytics")
@useAuth(bearerAuth)
interface ReportDefinitionManagement {
  @doc("Create a new ReportDefinition.")
  @extension("x-security-required-roles", #["admin", "researcher", "clinician"])
  @post
  @operationId("createReportDefinition")
  create(
    @body body: ReportDefinition,
  ): {
    @statusCode statusCode: 201;
    @body reportDefinition: ReportDefinition;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single ReportDefinition by id.")
  @extension("x-security-required-roles", #["admin", "researcher", "clinician"])
  @get
  @operationId("getReportDefinition")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body reportDefinition: ReportDefinition;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing ReportDefinition.")
  @extension("x-security-required-roles", #["admin", "researcher", "clinician"])
  @put
  @operationId("updateReportDefinition")
  @route("/{id}")
  update(
    @path id: string,
    @body body: ReportDefinition,
  ): {
    @statusCode statusCode: 200;
    @body reportDefinition: ReportDefinition;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a ReportDefinition (e.g., retire or update schedule).")
  @extension("x-security-required-roles", #["admin", "researcher", "clinician"])
  @patch
  @operationId("patchReportDefinition")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body reportDefinition: ReportDefinition;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a ReportDefinition by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteReportDefinition")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for ReportDefinition resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "researcher", "clinician"])
  @get
  @operationId("searchReportDefinitions")
  @route("/search")
  search(
    ...ReportDefinitionSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ReportDefinition>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Create, search, status, download, and cancel operations for ReportRun resources.")
@tag("Healthcare:Analytics")
@useAuth(bearerAuth)
interface ReportRunManagement {
  @doc("Submit a new ReportRun for immediate or queued execution.")
  @extension("x-security-required-roles", #["admin", "researcher", "clinician"])
  @post
  @operationId("createReportRun")
  create(
    @body body: CreateReportRunRequest,
  ): {
    @statusCode statusCode: 201;
    @body reportRun: ReportRun;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve the current status and metadata for a single ReportRun.")
  @extension("x-security-required-roles", #["admin", "researcher", "clinician"])
  @get
  @operationId("getReportRunStatus")
  @route("/{id}")
  getStatus(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body reportRun: ReportRun;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for ReportRun resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "researcher", "clinician"])
  @get
  @operationId("searchReportRuns")
  @route("/search")
  search(
    ...ReportRunSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ReportRun>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a time-limited download URL for the output of a completed ReportRun.")
  @extension("x-security-required-roles", #["admin", "researcher", "clinician"])
  @get
  @operationId("downloadReportRun")
  @route("/{id}/download")
  download(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body result: ReportRun;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("Cancel a queued or running ReportRun.")
  @extension("x-security-required-roles", #["admin", "researcher", "clinician"])
  @post
  @operationId("cancelReportRun")
  @route("/{id}/cancel")
  cancel(
    @path id: string,
    @body body: CancelReportRunRequest,
  ): {
    @statusCode statusCode: 200;
    @body reportRun: ReportRun;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD and search operations for Dashboard resources.")
@tag("Healthcare:Analytics")
@useAuth(bearerAuth)
interface DashboardManagement {
  @doc("Create a new Dashboard.")
  @extension("x-security-required-roles", #["admin", "researcher", "clinician"])
  @post
  @operationId("createDashboard")
  create(
    @body body: Dashboard,
  ): {
    @statusCode statusCode: 201;
    @body dashboard: Dashboard;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single Dashboard by id.")
  @extension("x-security-required-roles", #["admin", "researcher", "clinician"])
  @get
  @operationId("getDashboard")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body dashboard: Dashboard;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing Dashboard.")
  @extension("x-security-required-roles", #["admin", "researcher", "clinician"])
  @put
  @operationId("updateDashboard")
  @route("/{id}")
  update(
    @path id: string,
    @body body: Dashboard,
  ): {
    @statusCode statusCode: 200;
    @body dashboard: Dashboard;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a Dashboard (e.g., add or rearrange widgets, change sharing).")
  @extension("x-security-required-roles", #["admin", "researcher", "clinician"])
  @patch
  @operationId("patchDashboard")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body dashboard: Dashboard;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a Dashboard by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteDashboard")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for Dashboard resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "researcher", "clinician"])
  @get
  @operationId("searchDashboards")
  @route("/search")
  search(
    ...DashboardSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Dashboard>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
