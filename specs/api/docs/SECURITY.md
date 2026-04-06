# Security System Documentation

## Overview

The Monobase Application Platform implements a comprehensive security system based on **Bearer Token Authentication** with **Role-Based Access Control (RBAC)**. This system ensures proper authorization for data access while maintaining security compliance.

## Authentication

### Bearer Token Authentication
- **Type**: JWT (JSON Web Tokens)
- **Header**: `Authorization: Bearer <token>`
- **Implementation**: All authenticated endpoints use the `@useAuth(bearerAuth)` decorator

### Token Format
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Authorization Model

### Role-Based Access Control (RBAC) with Permissions
The system implements a hierarchical role and permission system using role:permission syntax.

#### System Roles
- **user**: Base authenticated user (can create profiles and bookings)
- **admin**: System administrator with access to admin dashboards and system-wide operations  
- **support**: Support staff with read access to user data for customer service

#### Permissions
- **owner**: Resource ownership permission (user accessing their own data)

### Role:Permission Syntax
Role requirements are specified using the `x-security-required-roles` OpenAPI extension with the following syntax:

```typescript
// Single role requirement
@extension("x-security-required-roles", ["admin"])

// Role with permission requirement (both must be satisfied)
@extension("x-security-required-roles", ["user:owner"])

// Multiple options (OR conditions)
@extension("x-security-required-roles", ["admin", "support", "user:owner"])
```

**Syntax Rules:**
- `["admin"]` - Requires admin role only
- `["user:owner"]` - Requires user role AND owner permission
- `["admin", "user:owner"]` - Requires admin OR (user AND owner)
- When both role and permission are specified with ":", both conditions must be met
- Multiple array elements represent OR conditions

## Security Configuration by Module

### Person Module (`/persons`)

| Endpoint | Method | Security | Required Roles | Notes |
|----------|--------|----------|----------------|-------|
| `/persons` | POST | Bearer | user | Create own person profile |
| `/persons` | GET | Bearer | admin, support | List all persons for admin/support dashboards |
| `/persons/{person}` | GET | Bearer | admin, support, user:owner | View person details (admin/support = any, user:owner = self) |
| `/persons/{person}` | PATCH | Bearer | admin, user:owner | Update person record (admin = any, user:owner = self) |

### Booking Module (`/booking`)

| Endpoint | Method | Security | Required Roles | Notes |
|----------|--------|----------|----------------|-------|
| `/booking/events` | GET | None | Public | List public booking events |
| `/booking/events` | POST | Bearer | user | Create booking event (requires user role) |
| `/booking/events/{event}` | GET | None | Public | View event details |
| `/booking/events/{event}` | PATCH | Bearer | admin, user:owner | Update event (admin = any, user:owner = event creator) |
| `/booking/events/{event}/slots` | GET | None | Public | View available time slots |
| `/booking/bookings` | POST | Bearer | user | Create booking (requires user role) |
| `/booking/bookings/{booking}` | GET | Bearer | admin, support, user:owner | View booking (admin/support = any, user:owner = participant) |
| `/booking/bookings/{booking}` | PATCH | Bearer | user:owner | Update booking (must be participant) |

**Special Endpoint**: `/booking/events/me`
- Allows authenticated users to access their own booking events
- Automatically resolves to events created by the authenticated user

### Billing Module (`/billing`)

| Endpoint | Method | Security | Required Roles | Notes |
|----------|--------|----------|----------------|-------|
| `/billing/invoices` | GET | Bearer | admin, support | List all invoices (admin/support dashboard) |
| `/billing/invoices` | POST | Bearer | user | Create invoice (requires user role) |
| `/billing/invoices/{invoice}` | GET | Bearer | admin, support, user:owner | View invoice (admin/support = any, user:owner = invoice owner) |
| `/billing/merchants` | POST | Bearer | user | Register as merchant |
| `/billing/merchants/{merchant}` | GET | Bearer | admin, user:owner | View merchant account |

### Notification Module (`/notifs`)

| Endpoint | Method | Security | Required Roles | Notes |
|----------|--------|----------|----------------|-------|
| `/notifs` | GET | Bearer | user:owner | List own notifications |
| `/notifs/{notification}` | GET | Bearer | user:owner | View own notification |
| `/notifs/{notification}` | PATCH | Bearer | user:owner | Mark notification as read |

**Note**: Notification creation is internal-only (not exposed via API)

### Communication Module (`/comms`)

| Endpoint | Method | Security | Required Roles | Notes |
|----------|--------|----------|----------------|-------|
| `/comms/chats` | GET | Bearer | user:owner | List own chats |
| `/comms/chats` | POST | Bearer | user | Create new chat |
| `/comms/chats/{chat}` | GET | Bearer | user:owner | View chat (must be participant) |
| `/comms/chats/{chat}/messages` | POST | Bearer | user:owner | Send message (must be participant) |
| `/comms/video-calls` | POST | Bearer | user:owner | Start video call in chat |

### Storage Module (`/storage`)

| Endpoint | Method | Security | Required Roles | Notes |
|----------|--------|----------|----------------|-------|
| `/storage/files` | POST | Bearer | user | Upload file |
| `/storage/files/{file}` | GET | Bearer | user:owner | Download own file |
| `/storage/files/{file}` | DELETE | Bearer | user:owner | Delete own file |

### Email Module (`/email`)

| Endpoint | Method | Security | Required Roles | Notes |
|----------|--------|----------|----------------|-------|
| `/email/templates` | GET | Bearer | admin | List email templates |
| `/email/templates` | POST | Bearer | admin | Create email template |
| `/email/templates/{template}` | PATCH | Bearer | admin | Update email template |
| `/email/queue` | GET | Bearer | admin | View email queue |

### Audit Module (`/audit`)

| Endpoint | Method | Security | Required Roles | Notes |
|----------|--------|----------|----------------|-------|
| `/audit/logs` | GET | Bearer | admin, support | View audit logs |
| `/audit/logs/{log}` | GET | Bearer | admin, support | View specific audit entry |

### Reviews Module (`/reviews`)

| Endpoint | Method | Security | Required Roles | Notes |
|----------|--------|----------|----------------|-------|
| `/reviews` | POST | Bearer | user | Submit review |
| `/reviews` | GET | Bearer | admin, support | List all reviews |
| `/reviews/{review}` | GET | Bearer | admin, support, user:owner | View review |

## Security Patterns

### Public Endpoints
No authentication required:
- `GET /booking/events` - Public event listing
- `GET /booking/events/{event}` - Public event details
- `GET /booking/events/{event}/slots` - Public slot availability

### Protected Endpoints
Require bearer token authentication with specific role:permission combinations:
- **Admin/Support-only**: System administration operations (admin dashboards, system-wide listings)  
- **User:Owner**: Self-access operations (users managing their own resources)
- **Multiple Roles**: OR conditions allowing admin/support OR user:owner access

### Self-Access Pattern (`/me`)
Special endpoints allowing users to access their own data:
- Available for specific GET operations
- Uses the special path parameter value `"me"`  
- Automatically resolves to the authenticated user's resources
- Implements the owner permission pattern
- Example: `GET /booking/events/me` returns events created by current user

### Owner Permission Logic
The owner permission is dynamically determined based on resource ownership:
- **Person records**: User owns their own person record
- **Bookings**: User owns bookings they created or are attending
- **Events**: User owns events they created
- **Invoices**: User owns invoices for their transactions
- **Files**: User owns files they uploaded
- **Chats**: User owns chats they participate in
- **Notifications**: User owns their own notifications

## Error Responses

### Authentication Errors
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authorization header"
  }
}
```
**Status Code**: 401

### Authorization Errors
```json
{
  "error": {
    "code": "FORBIDDEN", 
    "message": "Insufficient permissions for this operation"
  }
}
```
**Status Code**: 403

## Implementation Details

### TypeSpec Security Definitions
```typescript
// security.tsp
@doc("Bearer token authentication using JWT")
model bearerAuth is Http.BearerAuth;

/**
 * Bearer authentication is used for all authenticated endpoints
 * Role requirements are specified per operation using x-security-required-roles
 * 
 * Role Syntax:
 * - ["admin"] - Requires admin role only
 * - ["user:owner"] - Requires user role AND owner permission
 * - ["admin", "user:owner"] - Requires admin OR (user AND owner)
 * 
 * The format is "role:permission" where:
 * - role: The user's role (e.g., admin, user, support)
 * - permission: Additional permission requirement (e.g., owner)
 * - When both are specified with ":", both conditions must be met
 * - Multiple array elements represent OR conditions
 */
```

### Operation-Level Security Examples
```typescript
// Basic user role requirement
@doc("Create new booking event. Requires 'user' role.")
@post
@useAuth(bearerAuth)
@extension("x-security-required-roles", ["user"])
createBookingEvent(@body event: BookingEventCreateRequest): ...

// User:owner permission (self-access)
@doc("Get person profile. Requires 'admin', 'support', or 'user:owner' role.")
@get
@useAuth(bearerAuth)
@extension("x-security-required-roles", ["admin", "support", "user:owner"])
getPerson(@path person: UUID): ...

// Admin-only operation
@doc("View audit logs. Requires 'admin' or 'support' role.")
@get
@useAuth(bearerAuth)
@extension("x-security-required-roles", ["admin", "support"])
listAuditLogs(): ...
```

### Role Assignment Logic

#### System Roles
- **user**: Base authenticated user (assigned to all authenticated users)
- **admin**: System administrator with full system privileges  
- **support**: Customer support staff with read access to user data

#### Permissions
- **owner**: User is accessing/modifying their own resource (determined by resource ownership)

### Middleware Implementation
The API service implements authentication middleware to:
1. Validate JWT tokens from Better-Auth
2. Extract user identity and assigned roles from the token
3. Parse and enforce role:permission combinations from `x-security-required-roles`
4. Handle special `/me` endpoint resolution (mapping to owner permission)
5. Determine resource ownership for owner permission validation
6. Support OR conditions across multiple role:permission combinations

## Compliance Considerations

### Data Security Compliance
- All sensitive data access requires authentication
- Administrative operations require admin or support roles
- Resource ownership validation through owner permission ensures data isolation
- Role:permission combinations provide fine-grained access control
- Audit trails maintained for all authenticated operations with role context

### Security Best Practices
- Bearer tokens have configurable expiration through Better-Auth
- Role:permission system follows principle of least privilege
- Owner permission ensures users can only access their own resources
- System roles (admin/support) provide necessary administration capabilities
- Public endpoints limited to non-sensitive data only (booking events)
- Self-access patterns (/me) prevent unauthorized resource access
- Multiple role options provide flexibility while maintaining security

## Better-Auth Integration

### Admin Plugin Integration
The Monobase API integrates with Better-Auth's admin plugin for user and role management:

- **User Management**: Create, update, and manage user accounts
- **Role Assignment**: Assign system roles (admin, support)
- **Permission Management**: Configure role-based permissions and access levels
- **Session Management**: Handle user sessions and token lifecycle

### Better-Auth Admin Endpoints
Better-Auth provides dedicated admin endpoints that are merged with the TypeSpec-generated API:

```
POST /api/auth/admin/create-user     # Create user with roles
PATCH /api/auth/admin/update-user    # Update user roles and permissions
GET /api/auth/admin/list-users       # List users with role information
DELETE /api/auth/admin/delete-user   # Remove user and revoke access
```

### Role Synchronization
The API middleware synchronizes roles between Better-Auth and the TypeSpec role:permission system:

1. **JWT Token**: Contains roles assigned through Better-Auth admin
2. **Middleware Parsing**: Extracts roles and validates against endpoint requirements
3. **Dynamic Permission**: Determines owner permission based on resource ownership
4. **Access Decision**: Grants access if any role:permission combination matches

## Future Enhancements

### Planned Security Features
- Multi-factor authentication support through Better-Auth
- Enhanced token refresh mechanisms
- Additional permission types (read, write, modify)
- Resource-level permission inheritance
- Enhanced audit logging with full role context
- Role-based feature toggles for different applications
- Fine-grained admin scopes (user-admin, system-admin, etc.)
