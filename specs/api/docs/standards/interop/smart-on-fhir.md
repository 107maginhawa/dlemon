# SMART on FHIR v2 Integration Guide

**Standard:** SMART App Launch Framework v2.0 (HL7 IG)
**OAuth Version:** OAuth 2.0 + PKCE (RFC 7636)
**Base Spec:** HL7 FHIR R4
**Last Updated:** 2026-04-14

---

## Table of Contents

1. [Overview](#overview)
2. [Well-Known Configuration](#well-known-configuration)
3. [Authorization Flows](#authorization-flows)
4. [Launch Contexts](#launch-contexts)
5. [SMART Scopes](#smart-scopes)
6. [Token Lifecycle](#token-lifecycle)
7. [Backend Services Flow](#backend-services-flow)
8. [Scope → Resource → Operation Mapping](#scope--resource--operation-mapping)
9. [Implementation Notes](#implementation-notes)

---

## Overview

SMART on FHIR enables third-party applications to securely access FHIR-based health data. It combines:
- **OAuth 2.0** for authorization
- **OpenID Connect** for authentication (user identity)
- **FHIR** as the data API
- **SMART scopes** for fine-grained access control

### Application Types

| App Type | Launch | Scope Prefix | Token Type | Use Case |
|----------|--------|-------------|-----------|---------|
| Patient-facing | Standalone or EHR launch | `patient/` | Authorization code + PKCE | Patient portals, personal health apps |
| Provider-facing | EHR launch (primary) | `user/` | Authorization code + PKCE | Clinical decision support, EHR add-ons |
| Backend service | Client credentials | `system/` | Client credentials + signed JWT | Data pipelines, payer systems, analytics |

---

## Well-Known Configuration

Our authorization server publishes its capabilities at:

```http
GET /.well-known/smart-configuration
Accept: application/json
```

### Response

```json
{
  "issuer": "https://auth.monobase.health",
  "jwks_uri": "https://auth.monobase.health/.well-known/jwks.json",
  "authorization_endpoint": "https://auth.monobase.health/oauth/authorize",
  "token_endpoint": "https://auth.monobase.health/oauth/token",
  "token_endpoint_auth_methods_supported": [
    "client_secret_basic",
    "client_secret_post",
    "private_key_jwt"
  ],
  "grant_types_supported": [
    "authorization_code",
    "client_credentials",
    "refresh_token"
  ],
  "registration_endpoint": "https://auth.monobase.health/oauth/register",
  "scopes_supported": [
    "openid", "profile", "fhirUser",
    "launch", "launch/patient", "launch/encounter",
    "offline_access",
    "patient/*.read", "patient/*.write",
    "user/*.read", "user/*.write", "user/*.cruds",
    "system/*.read", "system/*.write"
  ],
  "response_types_supported": ["code"],
  "management_endpoint": "https://auth.monobase.health/oauth/manage",
  "introspection_endpoint": "https://auth.monobase.health/oauth/introspect",
  "revocation_endpoint": "https://auth.monobase.health/oauth/revoke",
  "code_challenge_methods_supported": ["S256"],
  "capabilities": [
    "launch-ehr",
    "launch-standalone",
    "client-public",
    "client-confidential-symmetric",
    "client-confidential-asymmetric",
    "sso-openid-connect",
    "context-banner",
    "context-style",
    "context-ehr-patient",
    "context-ehr-encounter",
    "permission-patient",
    "permission-user",
    "permission-offline",
    "permission-v2",
    "authorize-post"
  ]
}
```

### Capability Flags

| Capability | Description |
|------------|-------------|
| `launch-ehr` | Supports EHR launch |
| `launch-standalone` | Supports standalone launch |
| `client-public` | Supports public clients (no client secret) |
| `client-confidential-symmetric` | Supports client_secret |
| `client-confidential-asymmetric` | Supports private_key_jwt |
| `sso-openid-connect` | Supports OpenID Connect for user authentication |
| `context-ehr-patient` | EHR launch can provide patient context |
| `context-ehr-encounter` | EHR launch can provide encounter context |
| `permission-v2` | SMART v2 granular scopes supported |
| `permission-offline` | Supports refresh tokens |

---

## Authorization Flows

### Standalone Launch (Authorization Code + PKCE)

Used by patient-facing apps and provider apps that launch outside an EHR.

```
1. App generates code_verifier and code_challenge (S256)
2. App redirects user to authorization endpoint

   GET /oauth/authorize?
       response_type=code
       &client_id=app-client-id
       &redirect_uri=https://app.example.com/callback
       &scope=patient/Patient.read patient/Observation.read openid fhirUser offline_access
       &state=random-state-value
       &aud=https://api.monobase.health/fhir
       &code_challenge=BASE64URL(SHA256(code_verifier))
       &code_challenge_method=S256

3. User authenticates (if not already) and approves requested scopes
4. Authorization server redirects to:
   https://app.example.com/callback?code=auth-code&state=random-state-value

5. App exchanges code for tokens:
   POST /oauth/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code
   &code=auth-code
   &redirect_uri=https://app.example.com/callback
   &client_id=app-client-id
   &code_verifier=code-verifier-value

6. Token response:
   {
     "access_token": "eyJ...",
     "token_type": "Bearer",
     "expires_in": 3600,
     "refresh_token": "eyJ...",
     "scope": "patient/Patient.read patient/Observation.read openid fhirUser offline_access",
     "id_token": "eyJ...",
     "patient": "patient-id-123",
     "smart_style_url": "https://api.monobase.health/smart-style.json",
     "need_patient_banner": true
   }
```

### EHR Launch

Used when the EHR launches an app in the context of an active patient session.

```
1. EHR provides launch token and iss parameter:
   https://app.example.com/?iss=https://api.monobase.health/fhir&launch=launch-token-123

2. App fetches smart-configuration to discover endpoints

3. App requests authorization with launch scope:
   GET /oauth/authorize?
       response_type=code
       &client_id=app-client-id
       &redirect_uri=https://app.example.com/callback
       &scope=launch openid fhirUser patient/Patient.read patient/Observation.read
       &state=random-state-value
       &aud=https://api.monobase.health/fhir
       &launch=launch-token-123
       &code_challenge=...
       &code_challenge_method=S256

4. Authorization server validates launch token, resolves context
5. (No user login required if SSO session active)
6. App receives code; exchanges for tokens with patient/encounter context included
```

---

## Launch Contexts

### Context Values in Token Response

| Context Value | Description | Token Field |
|--------------|-------------|-------------|
| `patient` | Current patient ID | `"patient": "patient-uuid"` |
| `encounter` | Current encounter ID | `"encounter": "encounter-uuid"` |
| `fhirContext` | Additional FHIR context resources | `"fhirContext": [{"reference": "Appointment/appt-id"}]` |
| `intent` | Clinical intent for the app | `"intent": "order-sign"` |
| `smart_style_url` | EHR branding/style information | URL string |
| `need_patient_banner` | Whether app should show patient banner | boolean |

### Requesting Launch Contexts

| Scope | Effect |
|-------|--------|
| `launch` | Request EHR to provide full launch context |
| `launch/patient` | Standalone launch: prompt user to select a patient |
| `launch/encounter` | Standalone launch: prompt user to select an encounter |

---

## SMART Scopes

### Scope Format (SMART v2)

```
{context}/{resource}.{action}
```

Where:
- `context`: `patient`, `user`, or `system`
- `resource`: FHIR resource type or `*` for all
- `action`: `read`, `write`, `create`, `update`, `delete`, `search`, `cruds` (compound), or granular

### Granular Scopes (SMART v2)

SMART v2 supports granular scope syntax:

```
patient/Observation.rs?category=vital-signs
user/MedicationRequest.c?intent=order
system/Patient.rs?_security=R
```

Modifiers:
- `c` = create
- `r` = read (individual resource)
- `u` = update
- `d` = delete
- `s` = search
- `cruds` = all operations

### Standard Scope Examples

| Scope | Access Granted |
|-------|---------------|
| `patient/Patient.read` | Read the current patient's Patient resource |
| `patient/*.read` | Read all resource types for current patient |
| `patient/*.write` | Write all resource types for current patient |
| `user/Patient.read` | Read any Patient the current user has access to |
| `user/*.cruds` | Full CRUD + search for all resources |
| `system/*.read` | System-level read access to all resources |
| `system/Patient.read` | System-level read of Patient resources |
| `openid` | OpenID Connect (user identity) |
| `fhirUser` | Include `fhirUser` claim (Practitioner/Patient/RelatedPerson) |
| `profile` | User profile information |
| `offline_access` | Issue refresh token |
| `launch` | EHR launch context |
| `launch/patient` | Patient selection in standalone launch |

---

## Token Lifecycle

### Access Token

| Property | Value |
|----------|-------|
| Format | JWT (RS256 signed) |
| Default expiry | 1 hour (3600 seconds) |
| Maximum expiry | 8 hours for user-facing apps; 1 hour for EHR launches |
| Payload includes | `sub`, `iss`, `aud`, `exp`, `iat`, `jti`, `scope`, `fhirUser`, `patient` (if in context) |

### Refresh Token

| Property | Value |
|----------|-------|
| Availability | Only when `offline_access` scope requested |
| Default expiry | 30 days (sliding window) |
| Maximum lifetime | 90 days |
| Single-use | Yes — each refresh issues a new refresh token |
| Revocation | Via `POST /oauth/revoke` |

### Token Introspection (RFC 7662)

Required by ONC certification criteria:

```http
POST /oauth/introspect
Content-Type: application/x-www-form-urlencoded
Authorization: Basic {client_credentials}

token=eyJ...
```

**Response:**
```json
{
  "active": true,
  "scope": "patient/Patient.read patient/Observation.read",
  "client_id": "app-client-id",
  "username": "user@example.com",
  "patient": "patient-uuid",
  "exp": 1744632000,
  "iat": 1744628400,
  "iss": "https://auth.monobase.health",
  "sub": "user-uuid",
  "fhirUser": "https://api.monobase.health/fhir/Practitioner/dr-123"
}
```

### ID Token (OpenID Connect)

```json
{
  "iss": "https://auth.monobase.health",
  "sub": "user-uuid",
  "aud": "app-client-id",
  "exp": 1744632000,
  "iat": 1744628400,
  "auth_time": 1744628395,
  "nonce": "app-nonce",
  "fhirUser": "https://api.monobase.health/fhir/Practitioner/dr-123",
  "profile": "https://api.monobase.health/fhir/Practitioner/dr-123",
  "name": "Dr. Jane Smith",
  "email": "jane.smith@hospital.org"
}
```

---

## Backend Services Flow

**SMART Backend Services** (formerly App Launch for Backend) — for system-to-system integration without user interaction.

### Registration

Backend services register a public key (JWKS) with the authorization server during app registration. No client secret.

### Token Request

```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
&client_assertion={signed-jwt}
&scope=system/Patient.read system/Observation.read
```

### Client Assertion JWT

The signed JWT includes:
```json
{
  "iss": "backend-client-id",
  "sub": "backend-client-id",
  "aud": "https://auth.monobase.health/oauth/token",
  "jti": "unique-token-id",
  "exp": 1744628460,
  "iat": 1744628400
}
```

Signed with the client's private key (RS384 or ES384). Authorization server verifies against registered public key (JWKS).

### Backend Services Scopes

```
system/Patient.read
system/Observation.read
system/Condition.read
system/*.read
system/Patient.cruds
```

Backend services do not have `patient/` or `user/` scopes — they access data outside patient context.

---

## Scope → Resource → Operation Mapping

### Patient Context Scopes

| Scope | FHIR Resource | HTTP Methods | Search Parameters |
|-------|--------------|-------------|-------------------|
| `patient/Patient.read` | Patient | GET | `id` (current patient only) |
| `patient/Observation.read` | Observation | GET | `patient`, `category`, `code`, `date` |
| `patient/Condition.read` | Condition | GET | `patient`, `category`, `code`, `clinical-status` |
| `patient/MedicationRequest.read` | MedicationRequest | GET | `patient`, `status`, `intent`, `medication` |
| `patient/AllergyIntolerance.read` | AllergyIntolerance | GET | `patient`, `clinical-status`, `verification-status` |
| `patient/Immunization.read` | Immunization | GET | `patient`, `status`, `vaccine-code`, `date` |
| `patient/Procedure.read` | Procedure | GET | `patient`, `status`, `code`, `date` |
| `patient/DiagnosticReport.read` | DiagnosticReport | GET | `patient`, `category`, `code`, `date`, `status` |
| `patient/DocumentReference.read` | DocumentReference | GET | `patient`, `type`, `category`, `date`, `status` |
| `patient/Encounter.read` | Encounter | GET | `patient`, `status`, `class`, `date`, `type` |
| `patient/Coverage.read` | Coverage | GET | `patient`, `status` |
| `patient/Goal.read` | Goal | GET | `patient`, `lifecycle-status` |
| `patient/CarePlan.read` | CarePlan | GET | `patient`, `status`, `category` |
| `patient/CareTeam.read` | CareTeam | GET | `patient`, `status` |
| `patient/Provenance.read` | Provenance | GET | `patient`, `target` |

### User Context Scopes

| Scope | Access Beyond Patient Scope |
|-------|----------------------------|
| `user/Patient.read` | Any patient the user is authorized to see |
| `user/Patient.write` | Update patients the user is authorized for |
| `user/Practitioner.read` | Read practitioner directory |
| `user/Organization.read` | Read organization directory |
| `user/Location.read` | Read location directory |
| `user/Schedule.read` | Read scheduling information |
| `user/Appointment.read` | Read appointments for the user's patients |
| `user/ServiceRequest.cruds` | Manage orders for the user's patients |

### System Scopes

| Scope | Access |
|-------|--------|
| `system/Patient.read` | All patients in the system |
| `system/*.read` | All resources, all patients |
| `system/$export` | Bulk data export |
| `system/AuditEvent.read` | Audit log access |

### Operations Requiring Specific Scopes

| Operation | Required Scope |
|-----------|---------------|
| `GET /fhir/Patient/{id}/$everything` | `patient/*.read` or `user/*.read` |
| `POST /fhir/$export` (system) | `system/*.read` or `system/$export` |
| `GET /fhir/Patient/{id}/$export` | `patient/*.read` |
| `POST /fhir/Composition/{id}/$document` | `patient/*.read` |
| `POST /fhir/Composition/{id}/$cda` | `patient/*.read` |
| `GET /fhir/AuditEvent?patient={id}` | `user/AuditEvent.read` or `system/AuditEvent.read` |
| `POST /fhir/$validate` | No scope required (no PHI) |

---

## Implementation Notes

### PKCE Requirements

PKCE (Proof Key for Code Exchange, RFC 7636) is **required** for all authorization code flows:
- `code_challenge_method` must be `S256` (SHA-256)
- Plain method is not supported
- `code_verifier` must be 43-128 characters, using unreserved URI characters

### Client Registration

Applications must register before accessing the API:

```http
POST /oauth/register
Content-Type: application/json

{
  "client_name": "My Clinical App",
  "redirect_uris": ["https://app.example.com/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "private_key_jwt",
  "jwks_uri": "https://app.example.com/.well-known/jwks.json",
  "scope": "launch patient/*.read openid fhirUser offline_access",
  "logo_uri": "https://app.example.com/logo.png",
  "contacts": ["developer@example.com"]
}
```

### Token Validation at API Gateway

The FHIR API validates tokens on every request:
1. Verify JWT signature against authorization server public key (cached JWKS)
2. Verify `iss` claim matches expected authorization server
3. Verify `aud` claim matches `https://api.monobase.health/fhir`
4. Verify `exp` — token not expired
5. Parse `scope` claims for authorization decisions
6. Extract `patient` context for patient-level scope enforcement
7. Log `AuditEvent` with actor from `sub` claim

### Multi-Tenant Considerations

For multi-tenant deployments, each tenant (healthcare organization) has:
- Separate authorization server issuer URL
- Separate FHIR base URL
- Tenant-specific `aud` claim validation
- Tenant-isolated patient data
