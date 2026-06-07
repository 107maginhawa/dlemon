# Provider module contract tests
# Tests: provider profile creation, practitioner CRUD, practitioner-role CRUD.
#
# Route summary:
#   POST   /providers                         create provider profile (auth: user)
#   GET    /providers                         list providers (public)
#   POST   /providers/practitioners           create practitioner (auth: admin|credentialing)
#   GET    /providers/practitioners           list practitioners  (auth: admin|clinician|support)
#   GET    /providers/practitioners/{id}      get practitioner    (auth: admin|clinician|support)
#   PATCH  /providers/practitioners/{id}      update practitioner (auth: admin|credentialing)
#   DELETE /providers/practitioners/{id}      deactivate (204)    (auth: admin)
#   POST   /providers/practitioner-roles      create role         (auth: admin|credentialing)
#   GET    /providers/practitioner-roles      list roles          (auth: admin|clinician|support)
#   GET    /providers/practitioner-roles/{id} get role            (auth: admin|clinician|support)
#   PATCH  /providers/practitioner-roles/{id} update role         (auth: admin|credentialing)
#   DELETE /providers/practitioner-roles/{id} deactivate (204)    (auth: admin)

# ============================================================
# 1. Auth-gate checks — run BEFORE any sign-up so the cookie jar is empty.
#    The auth gate fires before any resource lookup; placeholder UUIDs suffice.
# ============================================================

GET {{api}}/providers/practitioners
HTTP 401

POST {{api}}/providers/practitioners
Content-Type: application/json
{
  "name": [{"family": "Gate", "given": ["Test"]}]
}
HTTP 401

GET {{api}}/providers/practitioner-roles
HTTP 401


# ============================================================
# 2. Sign up a fresh user who will own the provider profile.
# ============================================================

POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "provider-owner-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dr. Provider Owner"
}
HTTP 200
[Captures]
session_token: cookie "better-auth.session_token"
owner_user_id: jsonpath "$.user.id"


# ============================================================
# 3. POST /providers — create a provider profile for this user.
#    The handler adds the 'provider' role and invalidates the current session
#    (lines 78-96 of createProvider.ts), so we re-sign-in afterwards.
# ============================================================

POST {{api}}/providers
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "providerType": "dentist",
  "yearsOfExperience": 8,
  "biography": "Contract test dentist specialising in preventive care"
}
HTTP 201
[Captures]
provider_id: jsonpath "$.id"
[Asserts]
jsonpath "$.providerType" == "dentist"
jsonpath "$.yearsOfExperience" == 8
jsonpath "$.biography" isString
jsonpath "$.person" not == null


# 3a. Session was invalidated by createProvider — re-sign-in to get a valid session.
POST {{api}}/auth/sign-in/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "provider-owner-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest"
}
HTTP 200
[Asserts]
jsonpath "$.user.role" contains "provider"


# ============================================================
# 4. Switch to admin session for credentialing operations.
#    Routes POST/PATCH /providers/practitioners require admin|credentialing.
# ============================================================

POST {{api}}/auth/sign-in/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "{{admin_email}}",
  "password": "{{admin_password}}"
}
HTTP 200
[Captures]
admin_session: cookie "better-auth.session_token"
[Asserts]
jsonpath "$.user.role" == "admin"


# ============================================================
# 5. POST /providers/practitioners — register a new practitioner.
#    providerId is an app-layer extension (not in TypeSpec) linking the
#    FHIR Practitioner to the pre-FHIR Provider record.
# ============================================================

POST {{api}}/providers/practitioners
Cookie: better-auth.session_token={{admin_session}}
Content-Type: application/json
{
  "name": [
    {
      "use": "official",
      "text": "Dr. Alice Nguyen",
      "family": "Nguyen",
      "given": ["Alice"],
      "prefix": ["Dr."]
    }
  ],
  "active": true,
  "gender": "female",
  "birthDate": "1985-03-15",
  "credential": [
    {
      "type": "npi",
      "number": "1234567890",
      "issuedDate": "2015-06-01",
      "expiryDate": "2030-06-01",
      "status": "active"
    }
  ],
  "specialties": [
    {
      "coding": [
        {
          "system": "http://snomed.info/sct",
          "code": "394812008",
          "display": "Dental medicine specialists"
        }
      ],
      "text": "Dental Medicine"
    }
  ],
  "qualification": [],
  "providerId": "{{provider_id}}"
}
HTTP 201
[Captures]
practitioner_id: jsonpath "$.id"
[Asserts]
jsonpath "$.active" == true
jsonpath "$.name[0].family" == "Nguyen"
jsonpath "$.name[0].given[0]" == "Alice"
jsonpath "$.credential[0].type" == "npi"
jsonpath "$.credential[0].number" == "1234567890"
jsonpath "$.credential[0].status" == "active"
jsonpath "$.specialties[0].text" == "Dental Medicine"
jsonpath "$.gender" == "female"
jsonpath "$.providerId" == "{{provider_id}}"


# ============================================================
# 6. GET /providers/practitioners — list; our new record must appear.
# ============================================================

GET {{api}}/providers/practitioners
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.data" count >= 1
jsonpath "$.pagination.totalCount" >= 1
jsonpath "$.pagination.page" isInteger


# ============================================================
# 7a. GET /providers/practitioners/{id} — fetch by ID.
# ============================================================

GET {{api}}/providers/practitioners/{{practitioner_id}}
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{practitioner_id}}"
jsonpath "$.name[0].family" == "Nguyen"
jsonpath "$.active" == true


# ============================================================
# 7b. GET /providers/practitioners/{bogus-uuid} — must 404.
# ============================================================

GET {{api}}/providers/practitioners/00000000-0000-0000-0000-000000000000
Cookie: better-auth.session_token={{admin_session}}
HTTP 404


# ============================================================
# 8. PATCH /providers/practitioners/{id} — update telecom + specialties.
# ============================================================

PATCH {{api}}/providers/practitioners/{{practitioner_id}}
Cookie: better-auth.session_token={{admin_session}}
Content-Type: application/json
{
  "telecom": [
    {
      "system": "phone",
      "value": "+1-555-0100",
      "use": "work"
    }
  ],
  "specialties": [
    {
      "coding": [
        {
          "system": "http://snomed.info/sct",
          "code": "408466002",
          "display": "Endodontics"
        }
      ],
      "text": "Endodontics"
    }
  ]
}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{practitioner_id}}"
jsonpath "$.telecom[0].value" == "+1-555-0100"
jsonpath "$.specialties[0].text" == "Endodontics"


# ============================================================
# 9. POST /providers/practitioner-roles — create a role linking
#    the practitioner to an organization reference.
# ============================================================

POST {{api}}/providers/practitioner-roles
Cookie: better-auth.session_token={{admin_session}}
Content-Type: application/json
{
  "practitioner": {
    "resourceType": "Practitioner",
    "id": "{{practitioner_id}}",
    "display": "Dr. Alice Nguyen"
  },
  "organization": {
    "resourceType": "Organization",
    "id": "a0000000-0000-4000-8000-000000000001",
    "display": "Contract Test Clinic"
  },
  "code": [
    {
      "coding": [
        {
          "system": "http://snomed.info/sct",
          "code": "158965000",
          "display": "Doctor"
        }
      ],
      "text": "Doctor"
    }
  ],
  "specialty": [
    {
      "coding": [
        {
          "system": "http://snomed.info/sct",
          "code": "394814009",
          "display": "General practice"
        }
      ],
      "text": "General Practice"
    }
  ],
  "active": true,
  "availableTime": [
    {
      "daysOfWeek": ["mon", "tue", "wed", "thu", "fri"],
      "allDay": false,
      "availableStartTime": "08:00:00",
      "availableEndTime": "17:00:00"
    }
  ],
  "practitionerId": "{{practitioner_id}}"
}
HTTP 201
[Captures]
role_id: jsonpath "$.id"
[Asserts]
jsonpath "$.active" == true
jsonpath "$.practitionerRef.id" == "{{practitioner_id}}"
jsonpath "$.organizationRef.resourceType" == "Organization"
jsonpath "$.code[0].text" == "Doctor"
jsonpath "$.specialty[0].text" == "General Practice"


# ============================================================
# 10. GET /providers/practitioner-roles — list; our new role must appear.
# ============================================================

GET {{api}}/providers/practitioner-roles
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.data" count >= 1
jsonpath "$.pagination.totalCount" >= 1


# ============================================================
# 11a. GET /providers/practitioner-roles/{id} — fetch by ID.
# ============================================================

GET {{api}}/providers/practitioner-roles/{{role_id}}
Cookie: better-auth.session_token={{admin_session}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{role_id}}"
jsonpath "$.active" == true
jsonpath "$.code[0].text" == "Doctor"


# ============================================================
# 11b. GET /providers/practitioner-roles/{bogus-uuid} — must 404.
# ============================================================

GET {{api}}/providers/practitioner-roles/00000000-0000-0000-0000-000000000000
Cookie: better-auth.session_token={{admin_session}}
HTTP 404


# ============================================================
# 12. PATCH /providers/practitioner-roles/{id} — update the role code.
# ============================================================

PATCH {{api}}/providers/practitioner-roles/{{role_id}}
Cookie: better-auth.session_token={{admin_session}}
Content-Type: application/json
{
  "code": [
    {
      "coding": [
        {
          "system": "http://snomed.info/sct",
          "code": "106289002",
          "display": "Dentist"
        }
      ],
      "text": "Dentist"
    }
  ]
}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{role_id}}"
jsonpath "$.code[0].text" == "Dentist"


# ============================================================
# 13. DELETE /providers/practitioner-roles/{id} — deactivate (soft-delete → 204).
# ============================================================

DELETE {{api}}/providers/practitioner-roles/{{role_id}}
Cookie: better-auth.session_token={{admin_session}}
HTTP 204


# ============================================================
# 14. DELETE /providers/practitioners/{id} — deactivate (soft-delete → 204).
# ============================================================

DELETE {{api}}/providers/practitioners/{{practitioner_id}}
Cookie: better-auth.session_token={{admin_session}}
HTTP 204
