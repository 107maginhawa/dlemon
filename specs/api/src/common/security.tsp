import "@typespec/http";
import "@typespec/openapi";
import "./models.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Security definitions for the Monobase API
 */

/**
 * Bearer token authentication
 */
@doc("Bearer token authentication using JWT")
model bearerAuth is Http.BearerAuth;

/**
 * Bearer authentication is used for all authenticated endpoints
 * Role requirements are specified per operation using x-security-required-roles
 * 
 * Optional authentication (bearerAuth | Http.NoAuth):
 * - Endpoint is accessible without authentication
 * - User context IS extracted if Bearer token is provided
 * - Handlers can check user context for personalization or enhanced features
 * - Use for public endpoints that benefit from optional user context
 * 
 * Role Syntax:
 * - ["admin"] - Requires admin role only
 * - ["patient:owner"] - Requires patient role AND owner permission
 * - ["admin", "provider:owner"] - Requires admin OR (provider AND owner)
 * 
 * The format is "role:permission" where:
 * - role: The user's role (e.g., admin, patient, provider, user, support)
 * - permission: Additional permission requirement (e.g., owner, read, write)
 * - When both are specified with ":", both conditions must be met
 * - Multiple array elements represent OR conditions
 */
