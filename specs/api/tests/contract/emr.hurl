# EMR (consultations) contract tests — wire-level auth-gate proof.
# Routes: services/api-ts/src/generated/openapi/routes.ts (POST/GET /emr/consultations,
#         GET/PATCH /emr/consultations/{id}, POST /emr/consultations/{id}/finalize,
#         GET /emr/patients)
# Spec:   specs/api/src/modules/emr.tsp
#
# EMR is production-MOUNTED PHI (consultation notes + patient roster) but had no
# .hurl touching /emr — every sibling module has one, and endpoint-matrix marked
# all 6 EMR ops hasContractTest=false (emr-consultation-no-contract-test gap).
# These scenarios pin the security floor that matters most for an unfinished,
# still-mounted PHI surface: NONE of the 6 endpoints is reachable without a
# session. The auth guard fires before any resource lookup, so placeholder UUIDs
# and an empty body suffice — run BEFORE any sign-up so the cookie jar is empty.

# ============================================================
# 401 gates — no session ⇒ no PHI read or write.
# ============================================================

POST {{api}}/emr/consultations
Content-Type: application/json
{
  "patientId": "00000000-0000-4000-8000-000000000001"
}
HTTP 401
[Asserts]
jsonpath "$.code" == "UNAUTHORIZED"


GET {{api}}/emr/consultations
HTTP 401
[Asserts]
jsonpath "$.code" == "UNAUTHORIZED"


GET {{api}}/emr/consultations/{{suffix}}
HTTP 401
[Asserts]
jsonpath "$.code" == "UNAUTHORIZED"


PATCH {{api}}/emr/consultations/{{suffix}}
Content-Type: application/json
{
  "chiefComplaint": "gate check"
}
HTTP 401
[Asserts]
jsonpath "$.code" == "UNAUTHORIZED"


POST {{api}}/emr/consultations/{{suffix}}/finalize
HTTP 401
[Asserts]
jsonpath "$.code" == "UNAUTHORIZED"


GET {{api}}/emr/patients
HTTP 401
[Asserts]
jsonpath "$.code" == "UNAUTHORIZED"
