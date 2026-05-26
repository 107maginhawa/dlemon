# Error Envelope

Every error response from the Monobase API is a JSON object with a consistent
base shape, optionally extended with type-specific fields. All error handling
flows through `createErrorHandler` in `services/api-ts/src/core/errors.ts`.

---

## Base Envelope

```json
{
  "message":   "Human-readable description of the error",
  "code":      "MACHINE_READABLE_CODE",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-05-21T12:34:56.789Z",
  "statusCode": 404,
  "path":      "/api/v1/patients/123",
  "method":    "GET"
}
```

### Field Reference

| Field | Type | Always Present | Description |
|-------|------|---------------|-------------|
| `message` | `string` | Yes | Human-readable error description safe to surface to end-users |
| `code` | `string` | Yes | Machine-readable error code (see [Error Codes](#error-codes) below) |
| `requestId` | `string` (UUID) | Yes | Correlation ID; use this when filing support tickets or matching logs |
| `timestamp` | `string` (ISO 8601) | Yes | Server-side time the error was generated |
| `statusCode` | `number` | Yes | HTTP status code (mirrors the HTTP response status line) |
| `path` | `string` | **Dev only** | Request path that triggered the error; `undefined` in production |
| `method` | `string` | **Dev only** | HTTP method of the request; `undefined` in production |

### Dev-only vs Production Fields

Fields marked **Dev only** above are present when:
- `NODE_ENV` is not `"production"`, **or**
- `config.logging.level` is `"debug"` (overrides production suppression)

In production without debug mode, `path` and `method` are stripped from every
response to avoid leaking internal routing details.

---

## HTTP Status Codes and Error Codes

| HTTP Status | `code` value | Error class | Notes |
|-------------|-------------|-------------|-------|
| 400 | `VALIDATION_ERROR` | `ValidationError` / `ZodError` | Input failed schema or business validation |
| 400 | `HIPAA_COMPLIANCE_ERROR` | `HipaaComplianceError` | HIPAA rule violation |
| 401 | `UNAUTHORIZED` | `UnauthorizedError` | No valid credentials supplied |
| 401 | `AUTHENTICATION_ERROR` | `AuthenticationError` | Credentials present but authentication failed |
| 403 | `FORBIDDEN` | `ForbiddenError` | Authenticated but insufficient general permission |
| 403 | `AUTHORIZATION_ERROR` | `AuthorizationError` | Missing specific required permission |
| 404 | `NOT_FOUND` | `NotFoundError` | Resource does not exist |
| 405 | `METHOD_NOT_ALLOWED` | (built-in) | Path exists; HTTP method not registered |
| 408 | `TIMEOUT_ERROR` | `TimeoutError` | Upstream or internal operation timed out |
| 409 | `CONFLICT` | `ConflictError` | State conflict (e.g. duplicate, optimistic-lock) |
| 422 | *(custom)* | `BusinessLogicError` | Business rule violation; `code` is caller-supplied |
| 429 | `RATE_LIMIT` | `RateLimitError` | Too many requests |
| 500 | `INTERNAL_SERVER_ERROR` | (unhandled) | Unexpected server-side error |
| 503 | `EXTERNAL_SERVICE_ERROR` | `ExternalServiceError` | Downstream service unavailable or errored |

---

## Specialised Extension Fields

Each specialised error type adds fields on top of the base envelope.

### 400 — ValidationError / ZodError

```json
{
  ...base,
  "fieldErrors": [
    {
      "field":   "email",
      "value":   "not-an-email",
      "code":    "invalid_string",
      "message": "Invalid email address",
      "context": { "fatal": false }
    }
  ],
  "globalErrors": ["At least one contact method is required"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `fieldErrors` | `FieldError[]` \| `undefined` | Per-field validation failures (omitted when empty) |
| `fieldErrors[].field` | `string` | Dot-path to the offending field |
| `fieldErrors[].value` | `unknown` \| `undefined` | Offending value; stripped in production |
| `fieldErrors[].code` | `string` | Zod issue code or custom code |
| `fieldErrors[].message` | `string` | Field-level human-readable message |
| `fieldErrors[].context` | `Record<string,unknown>` \| `undefined` | Additional context (e.g. `{ fatal }`) |
| `globalErrors` | `string[]` \| `undefined` | Errors not tied to a specific field (omitted when empty) |

### 400 — HipaaComplianceError

```json
{
  ...base,
  "hipaaRule": "164.312(a)(1)",
  "violationType": "access-control",
  "auditLog": "audit-event-id-xyz",
  "remediationRequired": ["Revoke session", "Notify Privacy Officer"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `hipaaRule` | `string` | HIPAA regulation reference |
| `violationType` | `"privacy" \| "security" \| "breach" \| "access-control"` | Category of violation |
| `auditLog` | `string` \| `undefined` | Audit event identifier |
| `remediationRequired` | `string[]` \| `undefined` | Steps required to remediate |

### 401 — AuthenticationError

```json
{
  ...base,
  "scheme": "Bearer",
  "supportedSchemes": ["Bearer", "ApiKey"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `scheme` | `string` \| `undefined` | Authentication scheme that was attempted |
| `supportedSchemes` | `string[]` \| `undefined` | Schemes this endpoint accepts |

### 403 — AuthorizationError

```json
{
  ...base,
  "requiredPermission": "patient:write",
  "userPermissions": ["patient:read"],
  "resource": "/patients/abc123"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `requiredPermission` | `string` \| `undefined` | Permission required to perform the action |
| `userPermissions` | `string[]` \| `undefined` | Permissions the caller currently holds |
| `resource` | `string` \| `undefined` | Resource the action was attempted on |

### 404 — NotFoundError

```json
{
  ...base,
  "resourceType": "Patient",
  "resource": "abc123",
  "suggestions": ["Did you mean patient bcd234?"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `resourceType` | `string` \| `undefined` | Type of resource that was not found |
| `resource` | `string` \| `undefined` | Identifier that was looked up |
| `suggestions` | `string[]` \| `undefined` | Optional hints for the caller |

### 408 — TimeoutError

```json
{
  ...base,
  "timeoutMs": 5000,
  "operation": "fetchExternalRecord",
  "retryable": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `timeoutMs` | `number` \| `undefined` | Configured timeout in milliseconds |
| `operation` | `string` \| `undefined` | Name of the operation that timed out |
| `retryable` | `boolean` \| `undefined` | Whether retrying the request may succeed |

### 429 — RateLimitError

Response also includes the `Retry-After` HTTP header (seconds).

```json
{
  ...base,
  "limitType": "requests",
  "limit": 100,
  "usage": 101,
  "resetTime": 60,
  "windowSize": 60
}
```

| Field | Type | Description |
|-------|------|-------------|
| `limitType` | `"requests"` | Type of limit that was breached |
| `limit` | `number` | Maximum allowed within the window |
| `usage` | `number` | Actual usage that triggered the limit |
| `resetTime` | `number` | Seconds until the limit resets |
| `windowSize` | `number` | Size of the rate-limit window in seconds |

### 500 — InternalServerError

```json
{
  ...base,
  "trackingId": "550e8400-e29b-41d4-a716-446655440000",
  "reported": true
}
```

> `trackingId` is stripped in production (matches `requestId`). Use the
> `requestId` field for support correlation in all environments.

| Field | Type | Description |
|-------|------|-------------|
| `trackingId` | `string` | Equals `requestId`; dev-only (stripped in production) |
| `reported` | `boolean` | Whether the error was forwarded to error tracking infrastructure |

### 503 — ExternalServiceError

Response may include the `Retry-After` HTTP header when `retryAfter` is set.

```json
{
  ...base,
  "service": "stripe",
  "operation": "createPaymentIntent",
  "externalCode": "rate_limit_error",
  "externalMessage": "Too many requests",
  "retryable": true,
  "retryAfter": 30
}
```

| Field | Type | Description |
|-------|------|-------------|
| `service` | `string` \| `undefined` | Name of the external service |
| `operation` | `string` \| `undefined` | Operation that was being performed |
| `externalCode` | `string` \| `undefined` | Error code returned by the external service |
| `externalMessage` | `string` \| `undefined` | Raw message from the external service |
| `retryable` | `boolean` \| `undefined` | Whether retrying may succeed |
| `retryAfter` | `number` \| `undefined` | Seconds to wait before retrying |

### 422 — BusinessLogicError

Uses the generic `AppError` shape. The `code` field carries the caller-supplied
domain code (not `BUSINESS_ERROR` unless explicitly passed).

```json
{
  ...base,
  "details": { "appointmentId": "xyz" }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `details` | `unknown` \| `undefined` | Arbitrary caller-supplied context |

---

## Implementation Reference

- Error classes: `services/api-ts/src/core/errors.ts`
- Conformance tests: `services/api-ts/src/handlers/error-envelope.conformance.test.ts`
- TypeSpec models: `specs/api/src/modules/`
