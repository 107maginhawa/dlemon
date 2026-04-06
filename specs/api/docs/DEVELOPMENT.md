# API Development Standards

This document provides comprehensive development standards for the Monobase Application Platform API. It outlines conventions, patterns, and best practices for maintaining consistency across all API modules.

## Table of Contents

1. [Field Naming Conventions](#field-naming-conventions)
2. [Response Patterns](#response-patterns)
3. [Request Body Standards](#request-body-standards)
4. [TypeSpec Best Practices](#typespec-best-practices)
5. [API Design Principles](#api-design-principles)
6. [Security and RBAC](#security-and-rbac)
7. [Common Anti-Patterns](#common-anti-patterns)

## Field Naming Conventions

### Primary Rules

**Use camelCase for all fields** - Consistent with JavaScript/TypeScript conventions:

```typescript
// ✅ Correct
model Entity {
  firstName: string;
  dateOfBirth: utcDateTime;
  relatedEntity: UUID;
}

// ❌ Incorrect
model Entity {
  first_name: string;        // snake_case
  DateOfBirth: utcDateTime;  // PascalCase  
  related_entity_id: UUID;   // mixed case with suffix
}
```

### Entity Reference Naming

**For entity references, use just the entity name, not entityId:**

```typescript
// ✅ Correct - Clean entity references
model Record {
  author: UUID;        // References author entity
  category: UUID;      // References category entity
  parent: UUID;        // References parent entity
}

// ❌ Incorrect - Redundant ID suffixes
model Record {
  authorId: UUID;      
  categoryId: UUID;    
  parentId: UUID;      
}
```

### Union Types for Flexibility

**Support both UUID references and expanded objects:**

```typescript
// ✅ Correct - Flexible referencing
model Entity {
  relatedRecord: UUID | RelatedRecord;  // Can be ID or full object
}

// Usage examples:
// As reference: { "relatedRecord": "550e8400-e29b-41d4-a716-446655440000" }
// As expanded: { "relatedRecord": { "id": "...", "name": "Example", ... } }
```

### Temporal Field Naming

**Use consistent patterns for time-related fields:**

```typescript
// ✅ Correct - Consistent temporal naming
model Record {
  scheduledAt: utcDateTime;      // When event is scheduled
  processedAt: utcDateTime;      // When processing occurred
  cancelledAt?: utcDateTime;     // When cancellation occurred
  createdAt: utcDateTime;        // From BaseEntity
  updatedAt: utcDateTime;        // From BaseEntity
}
```

### Optional vs Required Fields

**Use optional (?) syntax appropriately:**

```typescript
// ✅ Correct - Proper optionality
model Person {
  firstName: string;           // Required
  lastName?: string;           // Optional
  middleName?: string;         // Optional
  dateOfBirth?: utcDateTime;   // Optional (privacy)
}
```

## Response Patterns

### Paginated Responses

**All list endpoints MUST use `PaginatedResponse<T>`:**

```typescript
// ✅ Correct - Consistent pagination
@get
listEntities(
  @query q?: string,
  ...PaginationParams
): {
  @statusCode statusCode: 200;
  @body body: PaginatedResponse<Entity>;
};

// Response structure:
{
  "data": [/* Entity objects */],
  "pagination": {
    "offset": 0,
    "limit": 20,
    "count": 15,
    "totalCount": 150,
    "totalPages": 8,
    "currentPage": 1,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### Single Entity Responses

**Return the entity directly (no wrapper):**

```typescript
// ✅ Correct - Direct entity return
@get
getEntity(@path entity: UUID): {
  @statusCode statusCode: 200;
  @body body: Entity;  // Direct entity, no wrapper
};

// ❌ Incorrect - Unnecessary wrapper
@get
getEntity(@path entity: UUID): {
  @statusCode statusCode: 200;
  @body body: { data: Entity };  // Don't wrap single entities
};
```

### Entity Response Patterns

**For get/patch/create operations, always return the base entity:**

```typescript
// ✅ Correct - Consistent entity returns
@post
createEntity(@body request: EntityCreateRequest): {
  @statusCode statusCode: 201;
  @body body: Entity;  // Return base entity
};

@get
getEntity(@path entity: UUID): {
  @statusCode statusCode: 200;
  @body body: Entity;  // Return base entity
};

@patch
updateEntity(@path entity: UUID, @body request: EntityUpdateRequest): {
  @statusCode statusCode: 200;
  @body body: Entity;  // Return base entity
};

// ❌ Incorrect - EntityResponse anti-pattern
model EntityResponse extends Entity {
  relatedDetails?: RelatedEntity;  // Don't create response variants
  extraInfo?: ExtraData;
}

@get
getEntity(): {
  @body body: EntityResponse;  // Don't use EntityResponse
};
```

### Field Expansion Support

**Support expansion via query parameters instead of response models:**

```typescript
// ✅ Correct - Expansion via query parameter
@get
getEntity(
  @path entity: UUID,
  @query @doc("Comma-separated fields to expand (e.g., 'field1,field2,field3')") expand?: string
): {
  @statusCode statusCode: 200;
  @body body: Entity;  // Same model, expanded at runtime
};

@get
listEntities(
  @query expand?: string,  // Support expansion in list endpoints
  ...PaginationQuery
): {
  @statusCode statusCode: 200;
  @body body: PaginatedResponse<Entity>;
};
```

**Expansion behavior:**
- Without expansion: UUID fields remain as UUIDs
- With expansion: UUID fields become full objects
- Example: `GET /entities/123?expand=field1,field2`
  - `field1` field becomes full object
  - `field2` field becomes full object
  - Other UUID fields remain as UUIDs (not expanded)

### Error Response Consistency

**ALWAYS use explicit status code declarations for error responses:**

```typescript
// ✅ Correct - Explicit status codes for each error type
@post
createEntity(@body entity: EntityCreateRequest): {
  @statusCode statusCode: 201;
  @body body: Entity;
} | {
  @statusCode statusCode: 400;
  @body body: ValidationError;    // From common/errors.tsp
} | {
  @statusCode statusCode: 401;
  @body body: AuthenticationError;
} | {
  @statusCode statusCode: 403;
  @body body: AuthorizationError;
} | {
  @statusCode statusCode: 409;
  @body body: ConflictError;
};

// ❌ Incorrect - Shorthand error syntax (DO NOT USE)
@post
createEntity(@body entity: EntityCreateRequest): {
  @statusCode statusCode: 201;
  @body body: Entity;
} | ValidationError | AuthenticationError | ConflictError;  // Don't use shorthand
```

**Standard HTTP Status Code Mappings:**
- `ValidationError` → 400 Bad Request
- `AuthenticationError` → 401 Unauthorized
- `AuthorizationError` → 403 Forbidden  
- `NotFoundError` → 404 Not Found
- `ConflictError` → 409 Conflict
- `RateLimitError` → 429 Too Many Requests
- `InternalServerError` → 500 Internal Server Error

**Why explicit status codes?**
- Ensures correct HTTP status codes are generated in OpenAPI spec
- Provides clear contract for API consumers
- Prevents ambiguity in error handling
- Maintains consistency across all modules

### All Operations Must Have Error Responses

**EVERY operation must include appropriate error responses - never just success responses:**

```typescript
// ✅ Correct - Public endpoint with error responses
@get
@route("/entities")
listEntities(...): {
  @statusCode statusCode: 200;
  @body body: PaginatedResponse<Entity>;
} | {
  @statusCode statusCode: 400;
  @body body: ValidationError;  // For invalid query parameters
};

// ✅ Correct - Protected endpoint with auth errors
@get
@useAuth(bearerAuth)
@route("/entities/{entity}")
getEntity(@path entity: UUID): {
  @statusCode statusCode: 200;
  @body body: Entity;
} | {
  @statusCode statusCode: 401;
  @body body: AuthenticationError;  // Required for protected endpoints
} | {
  @statusCode statusCode: 403;
  @body body: AuthorizationError;   // Required for role-based access
} | {
  @statusCode statusCode: 404;
  @body body: NotFoundError;        // Required for path parameters
};

// ❌ Incorrect - No error responses
@get
@route("/entities")
listEntities(...): {
  @statusCode statusCode: 200;
  @body body: PaginatedResponse<Entity>;
};  // Missing error responses!
```

**Minimum Required Error Responses by Operation Type:**

| Operation Type | Required Error Responses |
|---------------|-------------------------|
| **Public GET** | 400 (if query params), 404 (if path params) |
| **Protected GET** | 401, 403, 404 (if path params) |
| **Public POST** | 400, 409 (if uniqueness constraints) |
| **Protected POST** | 400, 401, 403, 409 (if uniqueness) |
| **Protected PATCH** | 400, 401, 403, 404 |
| **Protected DELETE** | 401, 403, 404 |
| **Action Endpoints** | 400/401/403/404 as appropriate |

**Why require error responses?**
- Documents all possible failure scenarios for API consumers
- Forces developers to consider error handling during design
- Ensures proper HTTP status codes in all situations
- Improves API reliability and developer experience

## Request Body Standards

### Create Request Patterns

**Create request models should omit audit fields:**

```typescript
// ✅ Correct - Create request without audit fields
model EntityCreateRequest {
  relatedEntity?: RelatedEntityCreateRequest;  // Nested creation
  primaryReference?: ReferenceInfo;            // Optional references
  secondaryReference?: SecondaryInfo;
  // No id, createdAt, updatedAt, version, etc.
}
```

### Update Request Patterns

**Update requests should make most fields optional:**

```typescript
// ✅ Correct - Flexible update request
model EntityUpdateRequest {
  primaryReference?: ReferenceInfo | null;  // Can set or clear
  secondaryReference?: SecondaryInfo | null;
  // Only include updatable fields
}
```

### Required vs Optional Bodies

**Action endpoints requiring context should mandate request bodies:**

```typescript
// ✅ Correct - Required reason for audit trail
@post
@route("/entities/{entity}/action")
performAction(
  @path entity: UUID,
  @body request: EntityActionRequest  // Required body
): EntityResponse;

model EntityActionRequest {
  @doc("Action reason - required for audit trail")
  @maxLength(500)
  reason: string;  // Required for compliance
}
```

## TypeSpec Best Practices

### Model Inheritance

**Extend BaseEntity for persistent entities:**

```typescript
// ✅ Correct - Proper inheritance
model Entity extends BaseEntity {
  relatedEntity: UUID | RelatedEntity;
  referenceInfo?: ReferenceInfo;
  // BaseEntity provides: id, createdAt, updatedAt, version, etc.
}

// ✅ Correct - Value objects don't extend BaseEntity
model ReferenceInfo {
  name: string;
  category?: string;
  phone?: PhoneNumber;
  email?: Email;
}
```

### Import Organization

**Organize imports logically:**

```typescript
// ✅ Correct - Logical import order
import "@typespec/http";           // TypeSpec core
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";     // Common models first
import "../common/errors.tsp";    // Common errors
import "../common/pagination.tsp"; // Common pagination
import "../common/security.tsp";   // Security models
import "./person.tsp";             // Related modules
```

### Using Common Types

**Leverage types from common/*.tsp:**

```typescript
// ✅ Correct - Use common scalars
model ContactInfo {
  email?: Email;        // From common/models.tsp
  phone?: PhoneNumber;  // From common/models.tsp
}

model Address {
  country: CountryCode;      // From common/models.tsp
  coordinates?: GeoCoordinates; // From common/models.tsp
}
```

### Namespace Organization

**Use namespaces only for route grouping:**

```typescript
// ✅ Correct - Models outside namespace (reusable)
model Person extends BaseEntity {
  // Model definition
}

model PersonCreateRequest {
  // Request model
}

// ✅ Correct - Namespace only for endpoints
@route("/persons")
@tag("Person")
namespace PersonModule {
  interface PersonManagement {
    // Endpoint definitions only
  }
}
```

## API Design Principles

### RESTful Resource Design

**Follow REST conventions consistently:**

```typescript
// ✅ Correct - RESTful endpoint design
@route("/entities")
namespace EntityModule {
  interface EntityManagement {
    @get listEntities(...);              // GET /entities
    @post createEntity(...);            // POST /entities
    @get @route("/{entity}") getEntity(...);     // GET /entities/{id}
    @patch @route("/{entity}") updateEntity(...); // PATCH /entities/{id}
    @delete @route("/{entity}") deleteEntity(...); // DELETE /entities/{id}
  }
}
```

### DELETE Response Standard

**Always return 204 No Content for successful DELETE operations:**

```typescript
// ✅ Correct - NoContentResponse with 204 status
@delete
@route("/{entity}")
deleteEntity(@path entity: UUID): {
  @statusCode statusCode: 204;
  @body body: NoContentResponse;
} | {
  @statusCode statusCode: 404;
  @body body: NotFoundError;
} | {
  @statusCode statusCode: 403;
  @body body: AuthorizationError;
};

// ❌ Incorrect - Returning 200 with entity
@delete
deleteEntity(@path entity: UUID): {
  @statusCode statusCode: 200;
  @body body: Entity;  // Don't return deleted entity
};

// ❌ Incorrect - Returning 200 with no content
@delete
deleteEntity(@path entity: UUID): {
  @statusCode statusCode: 200;  // Should be 204
  @body body: {};
};
```

**Why 204 No Content?**
- DELETE operations don't need to return the deleted entity
- 204 status explicitly indicates successful deletion with no response body
- Reduces response payload and processing overhead
- Follows REST best practices and HTTP specification

### Action Endpoints

**Use consistent action patterns:**

```typescript
// ✅ Correct - Action endpoint patterns
@post
@route("/entities/{entity}/confirm")
confirmEntity(...);

@post
@route("/entities/{entity}/cancel")
cancelEntity(...);

@post
@route("/entities/{entity}/complete")
completeEntity(...);
```

### Query Parameter Standards

**Use consistent query patterns:**

```typescript
// ✅ Correct - Standard query parameters
@get
listEntities(
  @query category?: UUID,        // Filter parameters
  @query owner?: UUID,
  @query status?: EntityStatus,
  @query startDate?: plainDate,
  @query endDate?: plainDate,
  @query expand?: string[],      // Expansion control
  ...PaginationQuery             // Built-in pagination + search
);
```

### UTC DateTime Usage

**Always use UTC for stored timestamps:**

```typescript
// ✅ Correct - UTC datetime for storage
model Event {
  scheduledAt: utcDateTime;        // Stored in UTC
  processedAt: utcDateTime;        // Stored in UTC  
  cancelledAt?: utcDateTime;       // Stored in UTC
}

// ✅ Correct - Plain date for date-only fields
model Record {
  effectiveDate?: plainDate;       // Date only, no timezone
}

// ✅ Correct - Timezone context when needed
model Schedule {
  startTime: string;               // "09:00" format
  endTime: string;                 // "17:00" format
  timezone: string;                // "America/New_York"
}
```

## Security and RBAC

### Authentication Requirements

**Use bearerAuth for all protected endpoints:**

```typescript
// ✅ Correct - Consistent authentication
@get
@useAuth(bearerAuth)
@extension("x-security-required-roles", ["admin", "support"])
listEntities(...);
```

### Role-Based Access Control

**Define clear role requirements:**

```typescript
// ✅ Correct - Clear RBAC patterns

// Admin or support can list all
@extension("x-security-required-roles", ["admin", "support"])

// Owner permissions (user can access their own data)
@extension("x-security-required-roles", ["user:owner"])

// Multiple role options (OR logic)
@extension("x-security-required-roles", ["admin", "user:owner"])

// Role + permission (AND logic)
@extension("x-security-required-roles", ["user:owner"])
```

### Public vs Protected Endpoints

**Clearly distinguish public and protected endpoints:**

```typescript
// ✅ Correct - Public endpoint (no auth)
@get
@route("/public-entities")
listPublicEntities(...);  // No @useAuth

// ✅ Correct - Protected endpoint
@post
@useAuth(bearerAuth)
@extension("x-security-required-roles", ["user"])
createEntity(...);
```

### Special Path Parameters

**Support convenience patterns:**

```typescript
// ✅ Correct - Support "me" for current user
@get
@route("/{entity}")
getEntity(
  @path @doc("Entity ID (UUID) or 'me' for current user's record") 
  entity: UUID | "me",
  @query expand?: string[]
);
```

## Common Anti-Patterns

### Field Naming Anti-Patterns

```typescript
// ❌ DON'T: Mixed naming conventions
model Entity {
  firstName: string;      // camelCase
  last_name: string;      // snake_case
  MiddleName: string;     // PascalCase
}

// ❌ DON'T: Redundant ID suffixes
model Record {
  authorId: UUID;         // Just use "author"
  categoryId: UUID;       // Just use "category"
}

// ❌ DON'T: Inconsistent temporal naming
model Event {
  created: utcDateTime;   // Use "createdAt"
  modified: utcDateTime;  // Use "updatedAt"
  cancelled: utcDateTime; // Use "cancelledAt"
}
```

### Response Pattern Anti-Patterns

```typescript
// ❌ DON'T: Inconsistent pagination
@get
listEntities(): {
  @body body: {
    items: Entity[];      // Use "data" consistently
    total: int32;         // Use PaginatedResponse<Entity>
  };
};

// ❌ DON'T: Wrap single entities unnecessarily
@get
getEntity(): {
  @body body: {
    entity: Entity;       // Return Entity directly
  };
};

// ❌ DON'T: Create EntityResponse models
model EntityResponse extends Entity {
  relatedDetails?: RelatedEntity;  // Use expand parameter instead
  extraInfo?: ExtraData;            // Don't extend entities for responses
}

// ❌ DON'T: Return different models for create/get/update
@post
createEntity(): {
  @body body: EntityCreateResponse;  // Return Entity
};

@get
getEntity(): {
  @body body: EntityResponse;  // Return Entity
};

@patch
updateEntity(): {
  @body body: EntityUpdateResponse;  // Return Entity
};
```

### Request Model Anti-Patterns

```typescript
// ❌ DON'T: Include audit fields in create requests
model EntityCreateRequest {
  id: UUID;              // Generated by system
  createdAt: utcDateTime; // Set by system
  version: int32;         // Managed by system
  relatedEntity?: RelatedEntityCreateRequest;
}

// ❌ DON'T: Make action requests optional when context is needed
@post
@route("/entities/{entity}/action")
performAction(
  @path entity: UUID,
  @body request?: EntityActionRequest  // Should be required
);
```

### TypeSpec Organization Anti-Patterns

```typescript
// ❌ DON'T: Put models inside namespaces (reduces reusability)
@route("/entities")
namespace EntityModule {
  model Entity extends BaseEntity {  // Should be outside namespace
    // Model definition
  }
  
  interface EntityManagement {
    // Endpoints
  }
}

// ❌ DON'T: Inconsistent import organization
import "./related.tsp";            // Related modules first?
import "@typespec/http";           // Should be at top
import "../common/models.tsp";     // Out of order
```

### Security Anti-Patterns

```typescript
// ❌ DON'T: Inconsistent authentication patterns
@get
@useAuth(bearerAuth)
someEndpoint(...);

@get
// Missing @useAuth for protected endpoint
someOtherEndpoint(...);

// ❌ DON'T: Unclear or missing role specifications
@extension("x-security-required-roles", ["user"])  // Too vague
@extension("x-security-required-roles", [])        // Empty array
```

---

## Quick Reference

### Checklist for New Modules

- [ ] Models extend BaseEntity when appropriate
- [ ] Entity references use clean names (not entityId)
- [ ] All list endpoints return PaginatedResponse<T>
- [ ] Create requests omit audit fields
- [ ] Update requests make fields optional
- [ ] Action requests include required reason fields
- [ ] Security roles are clearly specified
- [ ] UTC datetime used for temporal storage
- [ ] Common types leveraged from common/*.tsp
- [ ] Imports organized logically

### Standard Model Template

```typescript
import "@typespec/http";
import "@typespec/rest"; 
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/pagination.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;

// Models first (outside namespace)
model EntityName extends BaseEntity {
  // Entity fields
}

model EntityCreateRequest {
  // Creation fields (no audit fields)
}

model EntityUpdateRequest {
  // Optional update fields
}

// Namespace for endpoints only
@route("/entities")
@tag("Entity")
namespace EntityModule {
  interface EntityManagement {
    // CRUD endpoints
  }
}
```

This document should be referenced when creating new API modules and reviewed during code reviews to ensure consistency across the Monobase Application Platform API.
