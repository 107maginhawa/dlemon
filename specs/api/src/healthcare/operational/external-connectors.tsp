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
 * Healthcare Operational External Connectors — configuration and health monitoring
 * for third-party system integrations including payment gateways, communication
 * providers, imaging PACS, laboratory LIS, HL7 interfaces, FHIR endpoints,
 * e-prescribing hubs, and cloud storage backends. Credential management is
 * write-only — secret values are never returned in responses.
 */
namespace Healthcare.Operational.ExternalConnectors;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The type or category of the external connector integration.")
enum ConnectorType {
  @doc("Third-party payment processing gateway (e.g., Stripe, Square, Tyro)")
  paymentGateway,

  @doc("SMS messaging provider (e.g., Twilio, MessageBird)")
  smsProvider,

  @doc("Transactional email provider (e.g., Postmark, SendGrid, SES)")
  emailProvider,

  @doc("Picture archiving and communication system (PACS) for radiology imaging")
  imagingPacs,

  @doc("Electronic prescribing hub or pharmacy network connector")
  ePrescribing,

  @doc("Clearinghouse for medical claims submission and adjudication")
  clearinghouse,

  @doc("Video conferencing platform for telehealth sessions")
  videoConference,

  @doc("Laboratory information system (LIS) for ordering and receiving results")
  laboratoryLis,

  @doc("Traditional HL7 v2 messaging interface (MLLP or HTTP)")
  hl7Interface,

  @doc("FHIR RESTful API endpoint for data exchange with external systems")
  fhirEndpoint,

  @doc("Cloud object storage backend (e.g., S3, Azure Blob, GCS)")
  cloudStorage,

  @doc("A connector type not covered by the other categories")
  other,
}

@doc("The operational status of an external connector.")
enum ConnectorStatus {
  @doc("The connector has been configured but not yet verified in the target environment")
  configured,

  @doc("The connector is undergoing connectivity and functional testing")
  testing,

  @doc("The connector is active and operating normally")
  active,

  @doc("The connector is experiencing intermittent or degraded functionality")
  degraded,

  @doc("The connector has been administratively disabled")
  disabled,

  @doc("The connector is in a persistent error state and is not processing transactions")
  error,
}

@doc("The authentication method used by the external connector.")
enum ConnectorAuthMethod {
  @doc("API key passed in a request header or query parameter")
  apiKey,

  @doc("OAuth 2.0 client credentials or authorisation code flow")
  oauth2,

  @doc("HTTP Basic Authentication (username and password)")
  basicAuth,

  @doc("Mutual TLS or client certificate authentication")
  certificate,

  @doc("No authentication required (typically for internal or trusted network endpoints)")
  none,
}

@doc("The result of the most recent health check performed against the connector.")
enum ConnectorHealthStatus {
  @doc("The connector endpoint is reachable and responding normally")
  healthy,

  @doc("The connector is reachable but responding with degraded performance or partial errors")
  degraded,

  @doc("The connector endpoint is not reachable")
  unreachable,

  @doc("The health status is unknown (e.g., no check has been performed yet)")
  `unknown`: "unknown",
}

@doc("The status of a connector data synchronisation job.")
enum SyncStatus {
  @doc("The synchronisation job is currently executing")
  running,

  @doc("The synchronisation job completed without errors")
  completed,

  @doc("The synchronisation job encountered errors and did not complete successfully")
  failed,

  @doc("The synchronisation job was cancelled before completion")
  cancelled,
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

@doc("An external system connector configuration representing an integration with a third-party service.")
model Connector extends HealthcareBaseEntity {
  @doc("A human-readable name for this connector (e.g., 'Stripe Production', 'Twilio AU SMS')")
  @maxLength(200)
  name: string;

  @doc("The category of the external service this connector integrates with")
  type: ConnectorType;

  @doc("The current operational status of this connector")
  status: ConnectorStatus;

  @doc("The base URL or endpoint for this external service")
  @maxLength(2048)
  endpoint?: string;

  @doc("The authentication method used to authenticate with this connector")
  authMethod?: ConnectorAuthMethod;

  @doc("The organisation this connector belongs to, if applicable")
  organization?: Reference;

  @doc("The date and time of the most recent health check probe")
  lastHealthCheck?: utcDateTime;

  @doc("The result of the most recent health check")
  healthStatus?: ConnectorHealthStatus;

  @doc("Additional non-sensitive configuration metadata specific to this connector type")
  metadata?: Record<unknown>;
}

@doc("A credential record for an external connector. Secret values are write-only and are NEVER returned in API responses.")
model ConnectorCredential extends HealthcareBaseEntity {
  @doc("Reference to the Connector this credential belongs to")
  connector: Reference;

  @doc("The type or purpose of this credential (e.g., 'apiKey', 'clientSecret', 'privateKey')")
  @maxLength(100)
  credentialType: string;

  @doc("The date and time this credential expires, if applicable")
  expiresAt?: utcDateTime;

  @doc("The date and time this credential was last rotated")
  rotatedAt?: utcDateTime;

  @doc("Optional free-text notes about this credential (e.g., key rotation policy, owner)")
  @maxLength(500)
  note?: string;
}

@doc("A log entry recording the outcome of a data synchronisation operation performed by a connector.")
model ConnectorSyncLog extends HealthcareBaseEntity {
  @doc("Reference to the Connector that performed the synchronisation")
  connector: Reference;

  @doc("The type or direction of synchronisation performed (e.g., 'inbound', 'outbound', 'bidirectional')")
  @maxLength(100)
  syncType: string;

  @doc("The date and time the synchronisation job started")
  startedAt: utcDateTime;

  @doc("The date and time the synchronisation job completed, if finished")
  completedAt?: utcDateTime;

  @doc("The final status of this synchronisation job")
  status: SyncStatus;

  @doc("The total number of records processed by this sync job")
  @minValue(0)
  recordsProcessed?: int64;

  @doc("The number of records that failed to be processed during this sync job")
  @minValue(0)
  recordsFailed?: int64;

  @doc("Detailed error information if the sync job failed or produced errors")
  @maxLength(5000)
  errorDetails?: string;
}

// ---------------------------------------------------------------------------
// Request models
// ---------------------------------------------------------------------------

@doc("Request body for writing a new connector credential. The secret value is accepted but never returned.")
model CreateConnectorCredentialRequest {
  @doc("Reference to the Connector this credential belongs to")
  connector: Reference;

  @doc("The type or purpose of this credential")
  @maxLength(100)
  credentialType: string;

  @doc("The secret credential value — write-only, never returned in responses")
  @maxLength(4096)
  secretValue: string;

  @doc("The date and time this credential expires, if applicable")
  expiresAt?: utcDateTime;

  @doc("Optional notes about this credential")
  @maxLength(500)
  note?: string;
}

@doc("Request body for rotating an existing connector credential to a new secret value.")
model RotateConnectorCredentialRequest {
  @doc("The new secret credential value — write-only, never returned in responses")
  @maxLength(4096)
  newSecretValue: string;

  @doc("The updated expiry date for the rotated credential, if applicable")
  expiresAt?: utcDateTime;

  @doc("Notes about this rotation (e.g., reason, approver)")
  @maxLength(500)
  note?: string;
}

@doc("Request body for triggering a connectivity test against a connector endpoint.")
model ConnectorTestRequest {
  @doc("Whether to perform an extended functional test beyond a basic connectivity ping")
  extended?: boolean;
}

@doc("Response body for a connector test operation.")
model ConnectorTestResponse {
  @doc("Whether the connectivity test passed")
  success: boolean;

  @doc("A human-readable description of the test result")
  @maxLength(500)
  message: string;

  @doc("The round-trip latency of the test in milliseconds")
  latencyMs?: int32;
}

@doc("Response body for a connector health status query.")
model ConnectorHealthResponse {
  @doc("The connector this health status applies to")
  connector: Reference;

  @doc("The current health status")
  healthStatus: ConnectorHealthStatus;

  @doc("The date and time of the last health check probe")
  lastCheckedAt?: utcDateTime;

  @doc("A human-readable description of the health status")
  @maxLength(500)
  message?: string;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

@doc("Search parameters for Connector resources.")
model ConnectorSearchParams {
  @doc("Filter by connector type")
  @query type?: ConnectorType;

  @doc("Filter by connector operational status")
  @query status?: ConnectorStatus;

  @doc("Filter by health status result")
  @query healthStatus?: ConnectorHealthStatus;

  @doc("Filter by organisation reference id")
  @query organization?: string;

  @doc("Filter by connector name keyword (partial match)")
  @query name?: string;

  ...PaginationQuery;
}

@doc("Search parameters for ConnectorSyncLog resources.")
model ConnectorSyncLogSearchParams {
  @doc("Filter by connector reference id")
  @query connector?: string;

  @doc("Filter by sync type")
  @query syncType?: string;

  @doc("Filter by sync job status")
  @query status?: SyncStatus;

  @doc("Filter sync jobs started on or after this date-time")
  @query startedFrom?: utcDateTime;

  @doc("Filter sync jobs started on or before this date-time")
  @query startedTo?: utcDateTime;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("CRUD, search, test, and health operations for Connector resources.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
interface ConnectorManagement {
  @doc("Create a new Connector configuration.")
  @extension("x-security-required-roles", #["admin"])
  @post
  @operationId("createConnector")
  create(
    @body body: Connector,
  ): {
    @statusCode statusCode: 201;
    @body connector: Connector;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single Connector by id.")
  @extension("x-security-required-roles", #["admin"])
  @get
  @operationId("getConnector")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body connector: Connector;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing Connector configuration.")
  @extension("x-security-required-roles", #["admin"])
  @put
  @operationId("updateConnector")
  @route("/{id}")
  update(
    @path id: string,
    @body body: Connector,
  ): {
    @statusCode statusCode: 200;
    @body connector: Connector;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a Connector (e.g., enable, disable, or update endpoint URL).")
  @extension("x-security-required-roles", #["admin"])
  @patch
  @operationId("patchConnector")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body connector: Connector;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a Connector configuration by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteConnector")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for Connector resources using filter parameters.")
  @extension("x-security-required-roles", #["admin"])
  @get
  @operationId("searchConnectors")
  @route("/search")
  search(
    ...ConnectorSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Connector>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Execute a connectivity test against the connector endpoint.")
  @extension("x-security-required-roles", #["admin"])
  @post
  @operationId("testConnector")
  @route("/{id}/test")
  test(
    @path id: string,
    @body body: ConnectorTestRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: ConnectorTestResponse;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve the current health status of a connector, performing an immediate probe if requested.")
  @extension("x-security-required-roles", #["admin"])
  @get
  @operationId("getConnectorHealth")
  @route("/{id}/health")
  getHealth(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body result: ConnectorHealthResponse;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Create and rotate operations for ConnectorCredential resources. Secret values are write-only and are never returned.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
interface ConnectorCredentialManagement {
  @doc("Store a new credential for a connector. The secret value is accepted but never returned in any response.")
  @extension("x-security-required-roles", #["admin"])
  @post
  @operationId("createConnectorCredential")
  create(
    @body body: CreateConnectorCredentialRequest,
  ): {
    @statusCode statusCode: 201;
    @body connectorCredential: ConnectorCredential;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Rotate an existing connector credential to a new secret value. The new secret is accepted but never returned.")
  @extension("x-security-required-roles", #["admin"])
  @post
  @operationId("rotateConnectorCredential")
  @route("/{id}/rotate")
  rotate(
    @path id: string,
    @body body: RotateConnectorCredentialRequest,
  ): {
    @statusCode statusCode: 200;
    @body connectorCredential: ConnectorCredential;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Search and latest-entry operations for ConnectorSyncLog resources.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
interface ConnectorSyncLogManagement {
  @doc("Search for ConnectorSyncLog entries using filter parameters.")
  @extension("x-security-required-roles", #["admin"])
  @get
  @operationId("searchConnectorSyncLogs")
  @route("/search")
  search(
    ...ConnectorSyncLogSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ConnectorSyncLog>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve the most recent sync log entry for a given connector.")
  @extension("x-security-required-roles", #["admin"])
  @get
  @operationId("getLatestConnectorSyncLog")
  @route("/latest")
  getLatest(
    @doc("The connector reference id to retrieve the latest sync log for")
    @query connector: string,
  ): {
    @statusCode statusCode: 200;
    @body connectorSyncLog: ConnectorSyncLog;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
