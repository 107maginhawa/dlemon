import "@typespec/http";
import "@typespec/rest";
import "./errors.tsp";

using TypeSpec.Http;

/**
 * Common data models used across the Monobase API
 */

/**
 * Unique identifier type
 */
@doc("Universally unique identifier")
@format("uuid")
scalar UUID extends string;

/**
 * Positive integer identifier
 */
@doc("Positive integer identifier")
@minValue(1)
scalar PositiveInteger extends int32;

/**
 * Non-negative integer
 */
@doc("Non-negative integer")
@minValue(0)
scalar NonNegativeInteger extends int32;

/**
 * Email address
 */
@doc("Valid email address")
@format("email")
@pattern("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$")
scalar Email extends string;

/**
 * Phone number in E.164 format
 */
@doc("Phone number in E.164 international format")
@format("phone")
@pattern("^\\+[1-9]\\d{1,14}$")
scalar PhoneNumber extends string;

/**
 * Fax number - more permissive than phone for extensions and pauses
 */
@doc("Fax number with optional extensions and pause characters")
@pattern("^\\+?[0-9\\s\\-\\(\\)\\,\\.ext]+$")
@maxLength(50)
scalar FaxNumber extends string;

/**
 * URL string
 */
@doc("Valid URL")
@format("uri")
scalar Url extends string;

/**
 * Currency amount in cents
 */
@doc("Monetary amount in cents to avoid floating point precision issues")
@minValue(0)
scalar CurrencyAmount extends int32;

/**
 * ISO 3166-1 alpha-2 country code
 *
 * MUST be uppercase two-letter code per ISO 3166-1 standard.
 * This ensures compatibility with:
 * - BCP 47 region subtags (e.g., "en-US", "fr-CA")
 * - Domain country codes (.US, .UK, .JP)
 * - International banking standards (IBAN, SWIFT)
 * - Geographic information systems and APIs
 *
 * @example "US" - United States
 * @example "GB" - United Kingdom
 * @example "JP" - Japan
 */
@doc("Two-letter uppercase country code (ISO 3166-1 alpha-2)")
@format("iso-3166-1-alpha-2")
@pattern("^[A-Z]{2}$")
scalar CountryCode extends string;

/**
 * ISO 639-1 language code
 *
 * MUST be lowercase two-letter code per ISO 639-1 standard.
 * This ensures compatibility with:
 * - BCP 47 language tags (e.g., "en-US", "fr-CA")
 * - HTTP Accept-Language headers
 * - HTML lang attributes
 * - Internationalization (i18n) libraries
 *
 * @example "en" - English
 * @example "es" - Spanish
 * @example "ja" - Japanese
 */
@doc("Two-letter lowercase language code (ISO 639-1)")
@format("iso-639-1")
@pattern("^[a-z]{2}$")
scalar LanguageCode extends string;

/**
 * Timezone identifier
 *
 * MUST be IANA timezone database format (Area/Location).
 * This ensures compatibility with:
 * - JavaScript Intl.DateTimeFormat API
 * - Database timezone columns (PostgreSQL, MySQL)
 * - Backend timezone handling libraries (dayjs, date-fns, luxon)
 * - Cross-platform date/time operations
 *
 * @example "America/New_York" - Eastern Time
 * @example "Europe/London" - British Time
 * @example "Asia/Tokyo" - Japan Standard Time
 */
@doc("IANA timezone identifier (Area/Location format)")
@format("iana-timezone")
@pattern("^[A-Za-z_]+\\/[A-Za-z_]+$")
scalar TimezoneId extends string;

/**
 * Base entity model with common audit fields
 */
@doc("Base entity with audit fields")
model BaseEntity {
  @doc("Unique identifier")
  @key
  id: UUID;

  @doc("Entity version for optimistic locking")
  version: int32;

  @doc("Creation timestamp")
  createdAt: utcDateTime;

  @doc("User who created the entity")
  createdBy?: UUID;

  @doc("Last update timestamp")
  updatedAt: utcDateTime;

  @doc("User who last updated the entity")
  updatedBy?: UUID;
}

/**
 * Geographical coordinates
 */
@doc("GPS coordinates")
model GeoCoordinates {
  @doc("Latitude in decimal degrees")
  @minValue(-90.0)
  @maxValue(90.0)
  latitude: float64;

  @doc("Longitude in decimal degrees") 
  @minValue(-180.0)
  @maxValue(180.0)
  longitude: float64;

  @doc("Accuracy in meters")
  @minValue(0)
  accuracy?: float64;
}

/**
 * Physical address
 */
@doc("Physical mailing address")
model Address {
  @doc("Street address line 1")
  @minLength(1)
  @maxLength(100)
  street1: string;

  @doc("Street address line 2")
  @maxLength(100)
  street2?: string;

  @doc("City name")
  @minLength(1)
  @maxLength(50)
  city: string;

  @doc("State or province")
  @minLength(1)
  @maxLength(50)
  state: string;

  @doc("Postal or ZIP code")
  @minLength(1)
  @maxLength(20)
  postalCode: string;

  @doc("Country code")
  country: CountryCode;

  @doc("Address coordinates")
  coordinates?: GeoCoordinates;
}

/**
 * Physical address for updates (with nullable fields)
 */
@doc("Physical mailing address for updates - all fields optional, null clears field")
model AddressUpdate {
  @doc("Street address line 1")
  @minLength(1)
  @maxLength(100)
  street1?: string;

  @doc("Street address line 2 - can be null to clear")
  @maxLength(100)
  street2?: string | null;

  @doc("City name")
  @minLength(1)
  @maxLength(50)
  city?: string;

  @doc("State or province")
  @minLength(1)
  @maxLength(50)
  state?: string;

  @doc("Postal or ZIP code")
  @minLength(1)
  @maxLength(20)
  postalCode?: string;

  @doc("Country code")
  country?: CountryCode;

  @doc("Address coordinates - can be null to clear")
  coordinates?: GeoCoordinates | null;
}

/**
 * Date range
 */
@doc("Date range with start and end dates")
model DateRange {
  @doc("Start date")
  startDate: utcDateTime;

  @doc("End date")  
  endDate: utcDateTime;
}

/**
 * Time range within a day
 */
@doc("Time range within a single day")
model TimeRange {
  @doc("Start time")
  startTime: plainTime;

  @doc("End time")
  endTime: plainTime;
}

/**
 * Expand query parameters
 *
 * Enables automatic expansion of related resources in API responses.
 * Based on Stripe's expand pattern with secure internal service-to-service communication.
 *
 * Usage in TypeSpec:
 *   @extension("x-expandable-field", #{ opId: "getRelatedResource" })
 *   fieldName: string | RelatedModel;
 *
 * Example requests:
 *   GET /invoices/123?expand=customer
 *   GET /invoices/123?expand=customer,merchant
 *
 * Supports nested expansion up to 4 levels deep.
 */
@doc("Query parameters for expanding related entities")
model ExpandParams {
  @doc("Comma-separated list of related entities to expand (e.g., 'customer,merchant')")
  @query
  expand?: string;
}

/**
 * Common HTTP Response Models
 */

@doc("Standard error response")
model ErrorResponse {
  @doc("Error details")
  error: ErrorDetail;
}

@doc("Success response with no content")
model ApiNoContentResponse {
  @statusCode statusCode: 204;
}

@doc("Success response with data")
model ApiOkResponse<T> {
  @statusCode statusCode: 200;

  @doc("Response data")
  @body body: T;
}

@doc("Resource created response")
model ApiCreatedResponse<T> {
  @statusCode statusCode: 201;

  @doc("Created resource")
  @body body: T;

  @doc("Resource location")
  @header location?: string;
}

@doc("Validation error response")
model ApiBadRequestResponse {
  @statusCode statusCode: 400;

  @doc("Validation error details")
  @body body: ValidationError;
}

@doc("Unauthorized access response")
model ApiUnauthorizedResponse {
  @statusCode statusCode: 401;

  @doc("Authentication error")
  @body body: AuthenticationError;
}

@doc("Forbidden access response")
model ApiForbiddenResponse {
  @statusCode statusCode: 403;

  @doc("Authorization error")
  @body body: AuthorizationError;
}

@doc("Resource not found response")
model ApiNotFoundResponse {
  @statusCode statusCode: 404;

  @doc("Not found error")
  @body body: NotFoundError;
}

@doc("Conflict response")
model ApiConflictResponse {
  @statusCode statusCode: 409;

  @doc("Conflict error")
  @body body: ConflictError;
}

@doc("Rate limit exceeded response")
model ApiRateLimitResponse {
  @statusCode statusCode: 429;

  @doc("Rate limit error")
  @body body: RateLimitError;

  @doc("Seconds until rate limit resets")
  @header retryAfter: int32;
}

@doc("Internal server error response")
model ApiInternalServerErrorResponse {
  @statusCode statusCode: 500;

  @doc("Server error")
  @body body: InternalServerError;
}
