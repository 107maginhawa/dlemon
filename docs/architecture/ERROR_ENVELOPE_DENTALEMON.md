# Error Envelope

All error responses from the Dentalemon API share a standard envelope shape,
produced by `createBaseErrorFields()` in `services/api-ts/src/core/errors.ts`.

## Shape

```typescript
interface ErrorEnvelope {
  /** Human-readable description of what went wrong. */
  message: string;
  /** Machine-readable error code (SCREAMING_SNAKE_CASE). */
  code: string;
  /** Mirrors the HTTP status code for convenience. */
  statusCode: number;
  /** UUID echoed from X-Request-ID header or generated per-request. */
  requestId: string;
  /** ISO-8601 timestamp of when the error occurred. */
  timestamp: string;
  /** Request path — omitted in production (non-debug) mode. */
  path?: string;
  /** HTTP method — omitted in production (non-debug) mode. */
  method?: string;
  /** Extra structured context (error-class-specific, see below). */
  details?: unknown;
}
```

The minimum conformance contract is `{ code: string, message: string }` — every
error response is guaranteed to carry both fields regardless of environment.

## Standard Error Codes & HTTP Status Mapping

| Class | `code` | HTTP | Description |
|---|---|---|---|
| `ValidationError` | `VALIDATION_ERROR` | 400 | Input failed schema/business validation |
| `HipaaComplianceError` | `HIPAA_COMPLIANCE_ERROR` | 400 | HIPAA rule violation on input |
| `UnauthorizedError` | `UNAUTHORIZED` | 401 | No valid session / token |
| `AuthenticationError` | `AUTHENTICATION_ERROR` | 401 | Authentication attempt failed |
| `ForbiddenError` | `FORBIDDEN` | 403 | Authenticated but not permitted |
| `AuthorizationError` | `AUTHORIZATION_ERROR` | 403 | Missing required permission |
| `NotFoundError` | `NOT_FOUND` | 404 | Resource does not exist |
| `TimeoutError` | `TIMEOUT_ERROR` | 408 | Operation exceeded time limit |
| `ConflictError` | `CONFLICT` | 409 | Resource state conflict (duplicate, etc.) |
| `BusinessLogicError` | custom (e.g. `ARCHIVE_BLOCKED`) | 422 | Domain rule violation |
| `RateLimitError` | `RATE_LIMIT` | 429 | Too many requests |
| `AppError` (base) | `INTERNAL_ERROR` | 500 | Catch-all unexpected error |
| `ExternalServiceError` | `EXTERNAL_SERVICE_ERROR` | 503 | Downstream dependency failure |
| Zod parse failure | `VALIDATION_ERROR` | 400 | Route validator rejected body/params |
| Unhandled exception | `INTERNAL_SERVER_ERROR` | 500 | Bug / unrecognised throw |

`METHOD_NOT_ALLOWED` (405) and `NOT_FOUND` (404) are also emitted by the global
not-found handler for unmatched routes.

## Extra Fields Per Error Class

### `ValidationError` / Zod errors
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Validation failed: displayName: Required",
  "statusCode": 400,
  "requestId": "...",
  "timestamp": "...",
  "fieldErrors": [
    { "field": "displayName", "code": "invalid_type", "message": "Required" }
  ],
  "globalErrors": []
}
```

### `NotFoundError`
```json
{
  "code": "NOT_FOUND",
  "message": "Patient not found",
  "statusCode": 404,
  "requestId": "...",
  "timestamp": "...",
  "resourceType": "DentalPatient",
  "resource": "a1b2c3d4-..."
}
```

### `BusinessLogicError`
```json
{
  "code": "ARCHIVE_BLOCKED",
  "message": "Cannot archive patient with active payment plan",
  "statusCode": 422,
  "requestId": "...",
  "timestamp": "..."
}
```

### `RateLimitError`
```json
{
  "code": "RATE_LIMIT",
  "message": "Rate limit exceeded",
  "statusCode": 429,
  "requestId": "...",
  "timestamp": "...",
  "details": { "retryAfter": 60 }
}
```
The response also carries `Retry-After: 60` HTTP header.

### `ForbiddenError` / `AuthorizationError`
```json
{
  "code": "FORBIDDEN",
  "message": "Forbidden",
  "statusCode": 403,
  "requestId": "...",
  "timestamp": "..."
}
```

### `UnauthorizedError` / `AuthenticationError`
```json
{
  "code": "UNAUTHORIZED",
  "message": "Authentication required",
  "statusCode": 401,
  "requestId": "...",
  "timestamp": "..."
}
```

### `ConflictError`
```json
{
  "code": "CONFLICT",
  "message": "Resource conflict",
  "statusCode": 409,
  "requestId": "...",
  "timestamp": "..."
}
```

### `ExternalServiceError`
```json
{
  "code": "EXTERNAL_SERVICE_ERROR",
  "message": "Stripe API unavailable",
  "statusCode": 503,
  "requestId": "...",
  "timestamp": "...",
  "details": {
    "service": "stripe",
    "retryable": true,
    "retryAfter": 30
  }
}
```

### Unhandled exception (production)
```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "message": "Internal server error",
  "statusCode": 500,
  "requestId": "...",
  "timestamp": "...",
  "trackingId": "...",
  "reported": true
}
```
In debug mode the real `message` is included instead of the generic string.

## Adding a New Error Type

1. **Extend `AppError`** in `services/api-ts/src/core/errors.ts`:

```typescript
export class MyDomainError extends AppError {
  constructor(message: string = 'My domain error') {
    super(message, 'MY_DOMAIN_ERROR', 422);
  }
}
```

2. **Throw it from a handler** — the global `createErrorHandler` middleware
   picks it up automatically and formats it into the standard envelope.

3. **Add a specialised response shape** (optional) — if the error needs extra
   top-level fields beyond `details`, add a branch in `createErrorHandler`
   mirroring the `NotFoundError` or `RateLimitError` blocks.

4. **Document it** in the table above and update the TypeSpec model if the new
   code surfaces in the public API contract (`specs/api/src/modules/`).

## Conformance Guarantee

Every dental handler is verified by
`services/api-ts/src/tests/error-envelope.conformance.test.ts`.
That suite asserts `{ code: string, message: string }` on every representative
4xx error path (ValidationError, ForbiddenError, NotFoundError) to confirm the
envelope is always present.
