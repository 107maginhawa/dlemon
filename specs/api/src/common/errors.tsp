import "@typespec/http";
import "./models.tsp";

/**
 * Standard error models for the Monobase API
 */

/**
 * Base error detail structure
 */
@doc("Standard error response structure")
model ErrorDetail {
  @doc("Error code identifier")
  code: string;

  @doc("Human-readable error message")
  message: string;

  @doc("Additional error context")
  details?: Record<unknown>;

  @doc("Request identifier for debugging")
  requestId: string;

  @doc("Error timestamp")
  timestamp: utcDateTime;

  @doc("Request path")
  path: string;

  @doc("HTTP method")
  method: string;

  @doc("HTTP status code")
  statusCode: int32;

  @doc("Help URL for resolving the error")
  helpUrl?: Url;
}

/**
 * Validation error with field-specific details
 */
@doc("Input validation error")
model ValidationError extends ErrorDetail {
  @doc("Field-specific validation errors")
  fieldErrors?: FieldError[];

  @doc("Global validation errors")
  globalErrors?: string[];
}

/**
 * Field-specific validation error
 */
@doc("Individual field validation error")
model FieldError {
  @doc("Field name or path")
  field: string;

  @doc("Field value that caused the error")
  value?: unknown;

  @doc("Validation error code")
  code: string;

  @doc("Human-readable error message")
  message: string;

  @doc("Additional context")
  context?: Record<unknown>;
}

/**
 * Authentication error
 */
@doc("Authentication failure error")
model AuthenticationError extends ErrorDetail {
  @doc("Authentication scheme that failed")
  scheme?: "bearer" | "api-key" | "oauth2";

  @doc("Suggested authentication methods")
  supportedSchemes?: string[];
}

/**
 * Authorization error
 */
@doc("Authorization failure error")
model AuthorizationError extends ErrorDetail {
  @doc("Required permission")
  requiredPermission?: string;

  @doc("User's current permissions")
  userPermissions?: string[];

  @doc("Resource being accessed")
  resource?: string;
}

/**
 * Resource not found error
 */
@doc("Resource not found error")
model NotFoundError extends ErrorDetail {
  @doc("Resource type")
  resourceType?: string;

  @doc("Resource reference")
  resource?: string;

  @doc("Suggested alternatives")
  suggestions?: string[];
}

/**
 * Conflict error
 */
@doc("Resource conflict error")
model ConflictError extends ErrorDetail {
  @doc("Conflicting resource identifier")
  conflictingResource?: string;

  @doc("Conflict reason")
  reason?: "duplicate" | "version-mismatch" | "state-conflict" | "dependency";

  @doc("Current resource state")
  currentState?: Record<unknown>;

  @doc("Resolution suggestions")
  resolution?: string[];
}

/**
 * Rate limit exceeded error
 */
@doc("Rate limit exceeded error")
model RateLimitError extends ErrorDetail {
  @doc("Rate limit type")
  limitType: "requests" | "bandwidth" | "concurrent";

  @doc("Current limit value")
  limit: int32;

  @doc("Current usage count")
  usage: int32;

  @doc("Seconds until limit resets")
  resetTime: int32;

  @doc("Rate limit window in seconds")
  windowSize: int32;
}

/**
 * Internal server error
 */
@doc("Internal server error")
model InternalServerError extends ErrorDetail {
  @doc("Error tracking identifier")
  trackingId?: string;

  @doc("Whether error has been reported to monitoring")
  reported?: boolean;
}

/**
 * Entity reference for errors
 */
@doc("Reference to an entity in error context")
model EntityReference {
  @doc("Entity type")
  type: string;

  @doc("Entity identifier")
  id: string;

  @doc("Entity display name")
  name?: string;
}
