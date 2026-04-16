import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../common/models.tsp";
import "../../common/errors.tsp";
import "../../common/pagination.tsp";
import "../../common/security.tsp";
import "../core/primitives.tsp";
import "../core/terminology.tsp";
import "./capability-statement.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;
using Healthcare.Conformance.Capabilities;

/**
 * FHIR Subscriptions — event-driven notifications for FHIR resource changes.
 * Implements the FHIR R4B / R5 Subscriptions framework
 * (http://hl7.org/fhir/subscription.html) including SubscriptionTopic-based
 * filtering, multi-channel delivery (REST hook, WebSocket, email), and
 * notification status tracking.
 */
namespace Healthcare.Conformance.Subscriptions;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Lifecycle status of a FHIR Subscription resource.")
enum SubscriptionStatus {
  @doc("The subscription has been created and is awaiting server activation")
  requested,

  @doc("The subscription is active and delivering notifications")
  active,

  @doc("The server has encountered an error delivering notifications")
  error,

  @doc("The subscription has been deliberately turned off — no notifications are delivered")
  off,

  @doc("The subscription was created in error and should be ignored")
  enteredInError,
}

@doc("The delivery channel type for subscription notifications.")
enum ChannelType {
  @doc("Notifications are delivered via HTTP POST to a REST endpoint (webhook)")
  restHook,

  @doc("Notifications are delivered via a persistent WebSocket connection")
  websocket,

  @doc("Notifications are delivered via email")
  email,
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

@doc("A filter criterion applied to resources matched by a SubscriptionTopic, restricting which resource changes trigger a notification.")
model SubscriptionFilterBy {
  @doc("The FHIR resource type the filter applies to. When omitted, the filter applies to all resource types matched by the topic.")
  resourceType?: string;

  @doc("The name of a search parameter or filter parameter defined by the SubscriptionTopic to filter on")
  filterParameter: string;

  @doc("The comparator used for filter evaluation (e.g., eq, ne, gt, lt, ge, le, sa, eb, ap). Defaults to 'eq' when omitted.")
  comparator?: string;

  @doc("A modifier applied to the filter parameter (e.g., 'not', 'above', 'below', 'in', 'not-in', 'of-type')")
  modifier?: string;

  @doc("The value to compare against using the specified comparator and modifier")
  value: string;
}

@doc("Delivery channel configuration for a Subscription — describes how and where notifications are sent.")
model SubscriptionChannel {
  @doc("The type of channel to use for notifications")
  type: ChannelType;

  @doc("The endpoint URL for REST hook or email channels. For rest-hook, this is the webhook URL. For email, this is the mailto: URI.")
  @format("uri")
  endpoint: string;

  @doc("Additional headers to include in notification requests, such as authentication tokens (e.g., 'Authorization: Bearer <token>'). Stored and transmitted securely.")
  header?: string[];

  @doc("Interval in seconds between heartbeat notifications sent when no events have occurred, confirming the channel is alive. Set to 0 to disable heartbeats.")
  heartbeatPeriod?: int32;

  @doc("Timeout in seconds after which an unacknowledged notification delivery attempt is considered failed and retried")
  timeout?: int32;

  @doc("MIME type of the notification payload (e.g., 'application/fhir+json', 'application/fhir+xml')")
  contentType?: string;

  @doc("How much content is delivered in notifications: 'empty' (no payload), 'id-only' (resource references only), or 'full-resource' (complete resources)")
  content?: string;
}

@doc("A FHIR Subscription resource represents a request by a client to be notified of changes to a set of FHIR resources matching a SubscriptionTopic. Extends HealthcareBaseEntity for audit and multi-tenancy.")
model Subscription extends HealthcareBaseEntity {
  @doc("Current delivery status of this subscription")
  status: SubscriptionStatus;

  @doc("Canonical URL of the SubscriptionTopic that defines what events trigger notifications for this subscription")
  @format("uri")
  topic: string;

  @doc("Contact details for the subscription owner — used for operational communications such as error alerts")
  contact?: ContactPoint[];

  @doc("Scheduled expiry time for the subscription. When reached, the server sets status to 'off'. When omitted, the subscription remains active until explicitly deleted.")
  end?: utcDateTime;

  @doc("Human-readable description of the reason this subscription was created")
  reason?: string;

  @doc("Filter criteria restricting which resource changes trigger notifications. Multiple filters are ANDed together.")
  filterBy?: SubscriptionFilterBy[];

  @doc("Delivery channel configuration")
  channel: SubscriptionChannel;

  @doc("Maximum number of events to accumulate before sending a notification bundle. Use 1 for immediate delivery; higher values batch notifications for efficiency.")
  maxCount?: int32;
}

@doc("Describes the criteria under which a resource change triggers a notification, and the filter parameters available to subscribers.")
model SubscriptionTopicResourceTrigger {
  @doc("Human-readable description of when this trigger fires")
  description?: string;

  @doc("The FHIR resource type that is monitored for changes")
  resource: string;

  @doc("The FHIR interactions that trigger notifications on this resource type (e.g., 'create', 'update', 'delete')")
  supportedInteraction?: string[];

  @doc("FHIRPath or FHIR search criteria expression that must evaluate to true for the trigger to fire")
  queryCriteria?: string;
}

@doc("Describes a filter parameter that subscribers can use to restrict which events trigger their subscription.")
model SubscriptionTopicCanFilterBy {
  @doc("Human-readable description of this filter parameter and valid values")
  description?: string;

  @doc("The FHIR resource type this filter parameter applies to")
  resource?: string;

  @doc("The name of the filter parameter (used as the filterParameter value in a Subscription.filterBy)")
  filterParameter: string;

  @doc("Allowed comparator modifiers for this filter parameter (e.g., 'eq', 'ne', 'gt', 'in')")
  modifier?: string[];
}

@doc("A SubscriptionTopic defines the triggering events and available filter parameters for FHIR subscriptions. Topics are server-defined and cannot be created by clients. Extends HealthcareBaseEntity.")
model SubscriptionTopic extends HealthcareBaseEntity {
  @doc("Canonical URL that uniquely identifies this subscription topic")
  @format("uri")
  url: string;

  @doc("Human-readable title for the topic (e.g., 'Patient Admission', 'New Lab Result')")
  title: string;

  @doc("Publication status of this topic definition")
  status: PublicationStatus;

  @doc("A free text natural language description of what this topic monitors")
  description?: string;

  @doc("Resource types and trigger conditions monitored by this topic")
  resourceTrigger?: SubscriptionTopicResourceTrigger[];

  @doc("Filter parameters available to subscribers for scoping which events they receive")
  canFilterBy?: SubscriptionTopicCanFilterBy[];
}

@doc("A notification bundle sent to a subscription channel when the subscription criteria are met.")
model SubscriptionNotification {
  @doc("Logical ID of the Subscription that triggered this notification")
  subscriptionId: string;

  @doc("Canonical URL of the SubscriptionTopic that matched")
  @format("uri")
  topic: string;

  @doc("The type of notification (handshake | heartbeat | event-notification | query-status | query-event)")
  type: string;

  @doc("The total number of events since the subscription was created (used for gap detection)")
  eventsSinceLastDelivery?: int64;

  @doc("References to the resources that triggered this notification. Presence depends on the channel's content setting.")
  entry?: Reference[];
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

@doc("Manage FHIR Subscriptions and discover available SubscriptionTopics. Subscriptions enable event-driven architectures by pushing notifications when FHIR resources change.")
@tag("Healthcare:Conformance")
@useAuth(bearerAuth)
@route("/fhir")
interface SubscriptionManagement {
  @doc("Create a new Subscription. The server will validate the topic, channel endpoint reachability, and send a handshake notification before activating the subscription.")
  @operationId("createSubscription")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/Subscription")
  createSubscription(
    @body body: Subscription,
  ): {
    @statusCode statusCode: 201;
    @body result: Subscription;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a Subscription by its logical ID.")
  @operationId("getSubscription")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/Subscription/{id}")
  getSubscription(
    @path @doc("Subscription resource logical ID") id: string,
  ): {
    @statusCode statusCode: 200;
    @body result: Subscription;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an existing Subscription. Note: changing the topic or channel type may require re-validation and a new handshake.")
  @operationId("updateSubscription")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/Subscription/{id}")
  updateSubscription(
    @path @doc("Subscription resource logical ID") id: string,
    @body body: Subscription,
  ): {
    @statusCode statusCode: 200;
    @body result: Subscription;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a Subscription by its logical ID. The server will cease delivering notifications immediately.")
  @operationId("deleteSubscription")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @route("/Subscription/{id}")
  deleteSubscription(
    @path @doc("Subscription resource logical ID") id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("List all available SubscriptionTopics on this server. SubscriptionTopics are server-defined and describe the events that clients can subscribe to.")
  @operationId("listSubscriptionTopics")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/SubscriptionTopic")
  listSubscriptionTopics(
    ...PaginationQuery,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<SubscriptionTopic>;
  } | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve the current delivery status of a Subscription, including any error details, the last notification timestamp, and cumulative event counts. Use this endpoint for health-checking and troubleshooting subscription delivery issues.")
  @operationId("getSubscriptionStatus")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/Subscription/{id}/status")
  getSubscriptionStatus(
    @path @doc("Subscription resource logical ID") id: string,
  ): {
    @statusCode statusCode: 200;
    @body result: SubscriptionNotification;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
