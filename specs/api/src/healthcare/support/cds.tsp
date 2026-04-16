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
 * Healthcare Clinical Decision Support (CDS) module.
 *
 * Models the CDS Hooks 2.0 specification for real-time clinical decision
 * support integration. These are request/response patterns for point-of-care
 * alerts and recommendations — not persisted resources.
 *
 * CDS Hooks enables EHR workflows to call external CDS services at defined
 * clinical workflow points (hooks), receiving structured card-based responses
 * with actionable suggestions.
 *
 * @see https://cds-hooks.hl7.org/2.0/
 */
namespace Healthcare.Support.CDS;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Urgency and severity of a CDS card. Drives visual display in the EHR. Aligns with CDS Hooks card.indicator values.")
enum CDSIndicator {
  @doc("Informational message with no required action; low urgency")
  info,

  @doc("Decision may warrant attention; moderate urgency")
  warning,

  @doc("Critical finding requiring immediate clinician attention")
  critical,
}

// ---------------------------------------------------------------------------
// Request models
// ---------------------------------------------------------------------------

/**
 * Contextual information supplied with a CDS Hooks invocation. The exact
 * fields depend on which hook is being called.
 */
model CDSContext {
  /** The id of the current user. Must be in the format [resourceType]/[id] (e.g., Practitioner/abc). */
  userId: string;

  /** The FHIR id of the current patient. */
  patientId: string;

  /** The FHIR id of the current encounter (if applicable). */
  encounterId?: string;

  /**
   * The FHIR ids of the order(s) or resource(s) the user is acting upon
   * (applicable to order-sign and order-select hooks).
   */
  selections?: string[];

  /**
   * A Bundle of FHIR resources representing the orders being newly signed
   * (applicable to order-sign hook).
   */
  draftOrders?: Record<unknown>;
}

/**
 * OAuth 2.0 access token granting the CDS service access to the FHIR server.
 * Provided by the EHR when the CDS service needs to access patient data beyond
 * what is included in the prefetch template.
 */
model CDSFhirAuthorization {
  /** The OAuth 2.0 access token that allows accessing FHIR resources. */
  accessToken: string;

  /** The type of the access token — always "Bearer". */
  tokenType: string;

  /** The lifetime in seconds of the access token. */
  expiresIn: int32;

  /** The scope of the access token in the format described in SMART on FHIR. */
  scope: string;

  /** The id of the principal that authorized the access token. */
  subject: string;
}

/**
 * The request object passed from the EHR to the CDS service at a hook trigger
 * point. Conforms to CDS Hooks 2.0 Hook Request schema.
 */
model CDSHookRequest {
  /**
   * The hook that triggered this request (e.g., "patient-view", "order-sign",
   * "order-select", "encounter-start", "encounter-discharge").
   */
  hook: string;

  /** A universally unique identifier (UUID v4) for this particular hook call. */
  hookInstance: string;

  /** Hook-specific contextual information relevant to this call. */
  context: CDSContext;

  /**
   * The FHIR data that was prefetched by the EHR as specified in the service's
   * prefetch template. Keys match the template keys; values are FHIR resources.
   */
  prefetch?: Record<unknown>;

  /**
   * The base URL of the CDS Client's FHIR server, used for accessing additional
   * patient data not in the prefetch payload.
   */
  fhirServer?: string;

  /**
   * OAuth 2.0 credentials for accessing the FHIR server.
   * Only present when fhirServer is provided.
   */
  fhirAuthorization?: CDSFhirAuthorization;
}

// ---------------------------------------------------------------------------
// Response models
// ---------------------------------------------------------------------------

/**
 * The originating source of a CDS card (the CDS service / knowledge base).
 */
model CDSSource {
  /** A short, human-readable label to display for the source of the information displayed on this card. */
  label: string;

  /** An optional absolute URL to load (via GET, in a browser context) when a user clicks on this link to learn more about the organization or tool making the recommendations. */
  url?: string;

  /** An absolute URL to an icon for the source of this card. */
  icon?: string;

  /** A topic describes the content of the card (e.g., clinical domain). */
  topic?: CodeableConcept;
}

/**
 * A proposed action (create, update, or delete a FHIR resource) that is part
 * of a CDS suggestion.
 */
model CDSAction {
  /**
   * The type of action being performed. Allowed values: "create", "update", "delete".
   */
  type: string;

  /** Human-readable description of the proposed action. */
  description: string;

  /**
   * A FHIR resource representing the proposed action (e.g., a MedicationRequest
   * to create, or a ServiceRequest to update). Required for create/update actions.
   */
  resource?: Record<unknown>;
}

/**
 * A suggestion offers the clinician a potential action to take. Suggestions
 * can be auto-applied or manually selected.
 */
model CDSSuggestion {
  /** Human-readable label describing the suggested action for display to the clinician. */
  label: string;

  /** A unique identifier for this suggestion — allows EHR to track accepted suggestions. */
  uuid?: string;

  /** When true, the CDS service considers this suggestion the most appropriate action. */
  isRecommended?: boolean;

  /** The FHIR actions to be taken when the suggestion is accepted. */
  actions?: CDSAction[];
}

/**
 * An app link associated with a CDS card. Links may open external web apps or
 * launch SMART on FHIR applications within the EHR.
 */
model CDSLink {
  /** Human-readable link label for display. */
  label: string;

  /** The absolute URL of the link target. */
  url: string;

  /**
   * The type of link. Allowed values: "absolute" (opens a web page in a new
   * tab) or "smart" (launches a SMART on FHIR app within the EHR).
   */
  type: string;

  /**
   * An optional field that allows the CDS Service to pass context to a
   * SMART on FHIR app launched by this link.
   */
  appContext?: string;
}

/**
 * A Card represents a piece of guidance from the CDS service. Cards may contain
 * summary text, detail, suggestions for action, and links to additional
 * resources. Cards are displayed to clinicians within the EHR workflow.
 */
model CDSCard {
  /** A unique identifier for this card — allows EHR to de-duplicate across multiple calls. */
  uuid?: string;

  /** One-sentence, <140-character summary message for display to the user inside of this card. */
  summary: string;

  /** Optional detailed information to display; supports GitHub-Flavored Markdown. */
  detail?: string;

  /** Urgency and severity of this card — drives visual styling in the EHR. */
  indicator: CDSIndicator;

  /** Grouping structure for the source of the information displayed on this card. */
  source: CDSSource;

  /** Suggest a set of changes in the context of the current activity. */
  suggestions?: CDSSuggestion[];

  /**
   * Describes the intended selection behavior of the suggestions in this card.
   * Allowed values: "at-most-one" (zero or one suggestion may be chosen).
   */
  selectionBehavior?: string;

  /** Allows a clinician to document a reason for overriding a card with indicator "critical". */
  overrideReasons?: CodeableConcept[];

  /** Allows a service to suggest a link to an app that the user might want to run for additional information or to help guide a decision. */
  links?: CDSLink[];
}

/**
 * The response object returned by a CDS service. Contains zero or more cards.
 */
model CDSHookResponse {
  /** An array of Cards. Cards can provide a combination of information, suggested actions, and links. */
  cards: CDSCard[];
}

/**
 * A descriptor for a single CDS service available at this endpoint.
 * Used in the discovery response.
 */
model CDSServiceDescriptor {
  /** The hook this service should be invoked on (e.g., "patient-view"). */
  hook: string;

  /** The human-friendly name of this service. */
  title?: string;

  /** The description of this service. */
  description: string;

  /** The unique id of this service; used in the request URL. */
  id: string;

  /**
   * An object containing key/value pairs of FHIR queries to pre-fetch
   * and include in the hook request.
   */
  prefetch?: Record<unknown>;
}

/**
 * Discovery endpoint response listing all CDS services available on this server.
 * EHRs call this at registration time to know which hooks the service supports.
 */
model CDSServicesResponse {
  /** List of available CDS services. */
  services: CDSServiceDescriptor[];
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * CDS Hooks integration endpoints.
 *
 * Exposes one POST operation per supported hook type, plus a GET discovery
 * endpoint. All hook endpoints accept a CDSHookRequest and return a
 * CDSHookResponse containing zero or more clinical decision support cards.
 *
 * Each hook is triggered at a specific EHR workflow point:
 * - patient-view: Clinician opens a patient chart
 * - order-sign: Clinician signs one or more orders
 * - order-select: Clinician selects one or more items from a catalog
 * - encounter-start: Clinician starts an encounter
 */
@tag("Healthcare:Support")
@useAuth(bearerAuth)
interface CDSService {
  /**
   * Discover available CDS services.
   *
   * Returns the list of all hooks and services this server supports. EHRs
   * call this endpoint once during registration to configure which hook calls
   * to make and what prefetch data to include.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("discoverCDSServices")
  @route("/services")
  discover(): {
    @statusCode statusCode: 200;
    @body response: CDSServicesResponse;
  } | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Handle a patient-view hook call.
   *
   * Triggered when a clinician opens a patient chart. Allows CDS services
   * to surface relevant alerts, reminders, or recommendations based on the
   * patient's record at the time of chart review.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("cdsPatientView")
  @route("/patient-view")
  patientView(
    @body body: CDSHookRequest,
  ): {
    @statusCode statusCode: 200;
    @body response: CDSHookResponse;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Handle an order-sign hook call.
   *
   * Triggered when a clinician is about to sign one or more orders. Allows
   * CDS services to evaluate the pending orders and return drug–drug
   * interaction alerts, dose-range checks, or formulary guidance before
   * the orders are committed.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("cdsOrderSign")
  @route("/order-sign")
  orderSign(
    @body body: CDSHookRequest,
  ): {
    @statusCode statusCode: 200;
    @body response: CDSHookResponse;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Handle an order-select hook call.
   *
   * Triggered when a clinician selects one or more items from an order
   * catalog (before signing). Allows CDS services to provide real-time
   * guidance during order entry.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("cdsOrderSelect")
  @route("/order-select")
  orderSelect(
    @body body: CDSHookRequest,
  ): {
    @statusCode statusCode: 200;
    @body response: CDSHookResponse;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Handle an encounter-start hook call.
   *
   * Triggered when a new clinical encounter begins. Allows CDS services to
   * surface care gap reminders, preventive care recommendations, chronic
   * disease management alerts, and SDOH screening prompts at the start of care.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("cdsEncounterStart")
  @route("/encounter-start")
  encounterStart(
    @body body: CDSHookRequest,
  ): {
    @statusCode statusCode: 200;
    @body response: CDSHookResponse;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
