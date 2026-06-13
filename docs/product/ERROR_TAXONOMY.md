<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-24 -->
<!-- skill: oli-api-contracts --all -->
<!-- based-on: MODULE_SPEC.md ×10, core/errors.ts, DOMAIN_MODEL.md -->

# Error Taxonomy — Dentalemon

> All error responses use the **FLAT** envelope serialized by `core/errors.ts`
> (`createBaseErrorFields`) and declared by TypeSpec `ErrorDetail`
> (`specs/api/src/common/errors.tsp`). Error codes are SCREAMING_SNAKE_CASE strings.
> HTTP status drives client behavior; code drives display/logging.
>
> ⚠️ **History:** this section previously documented a *nested* `{ error: { code,
> message }, meta }` envelope. That shape was never emitted by the server, and the
> frontend error parser was written to it — causing every error toast to show a
> generic fallback instead of the real message (the "Failed to create visit. Please
> try again." bug, 2026-06-09). The shape below is the real one.

---

## 1. Standard Error Response Shape

The server returns a **flat** object (no `error:` wrapper, no `meta:` wrapper):

```typescript
interface ErrorResponse {
  code: string;           // SCREAMING_SNAKE_CASE from catalog below
  message: string;        // Human-readable, safe to display
  statusCode: number;     // mirrors the HTTP status
  requestId: string;
  timestamp: string;      // ISO 8601
  path?: string;          // omitted in production unless debug logging
  method?: string;        // omitted in production unless debug logging
  // Validation (400) adds field-level detail at the top level:
  fieldErrors?: { field: string; message: string }[];
  globalErrors?: string[];
}
```

**Frontend reception.** The TS SDK's error interceptor
(`packages/sdk-ts/src/client.ts` → installed in `react/provider.tsx`) wraps every
non-2xx into an **`SdkError`** (an `Error` subclass): `err.message` = the human
message, `err.body` = the flat envelope above, `err.status` = HTTP status. Parse it
via `apps/dentalemon/src/lib/error-toast.ts` (`extractApiError` / `getErrorMessage`)
— never read `err.error` (that nested path does not exist).

---

## 2. HTTP Status → Error Category Mapping

| HTTP Status | Category | When to Use |
|-------------|----------|-------------|
| 400 | Validation | Malformed request, invalid field values |
| 401 | Authentication | No/invalid session token |
| 403 | Authorization | Valid session, insufficient role/branch access |
| 404 | Not Found | Resource doesn't exist or not visible to caller |
| 405 | Method Not Allowed | Append-only endpoints, immutable resources |
| 409 | Conflict | Duplicate creation, concurrent active resource |
| 422 | Business Logic | Valid request format, violates business rule |
| 429 | Rate Limit | Too many requests |
| 500 | Internal | Unexpected server error |
| 501 | Not Implemented | Feature stub (e.g., patient merge) |
| 503 | External Service | Third-party unavailable (Stripe, OneSignal) |

---

## 3. Platform-Level Error Codes (all modules)

| Code | HTTP | Message Template | Source Class |
|------|------|-----------------|--------------|
| `UNAUTHORIZED` | 401 | "Authentication required" | UnauthorizedError |
| `AUTHENTICATION_ERROR` | 401 | "Authentication failed" | AuthenticationError |
| `FORBIDDEN` | 403 | "Insufficient permissions" | ForbiddenError |
| `AUTHORIZATION_ERROR` | 403 | "Insufficient permissions for operation" | AuthorizationError |
| `VALIDATION_ERROR` | 400 | "Validation failed" | ValidationError |
| `NOT_FOUND` | 404 | "{Resource} not found" | AppError(404) |
| `METHOD_NOT_ALLOWED` | 405 | "Operation not permitted on this resource" | AppError(405) |
| `CONFLICT` | 409 | "Resource conflict" | ConflictError |
| `RATE_LIMIT` | 429 | "Too many requests" | RateLimitError |
| `INTERNAL_ERROR` | 500 | "An unexpected error occurred" | AppError |
| `NOT_IMPLEMENTED` | 501 | "Feature not yet implemented" | AppError(501) |
| `EXTERNAL_SERVICE_ERROR` | 503 | "External service unavailable" | AppError(503) |
| `HIPAA_COMPLIANCE_ERROR` | 400 | "HIPAA compliance violation" | HipaaComplianceError |

---

## 4. Module Error Code Ranges

| Module | Range | Prefix |
|--------|-------|--------|
| dental-org | ORG-001 – ORG-099 | `ORG_` |
| dental-patient | PAT-001 – PAT-099 | `PAT_` |
| dental-visit | VIS-001 – VIS-099 | `VIS_` |
| dental-scheduling | SCH-001 – SCH-099 | `SCH_` |
| dental-billing | BIL-001 – BIL-099 | `BIL_` |
| dental-clinical | CLI-001 – CLI-099 | `CLI_` |
| dental-perio | PER-001 – PER-099 | `PER_` |
| dental-imaging | IMG-001 – IMG-099 | `IMG_` |
| dental-pmd | PMD-001 – PMD-099 | `PMD_` |
| dental-emr | EMR-001 – EMR-099 | `EMR_` |
| dental-audit | AUD-001 – AUD-099 | `AUD_` |

---

## 5. Module Error Code Catalog

### dental-org

| Code | HTTP | Trigger |
|------|------|---------|
| `BRANCH_NOT_FOUND` | 404 | Branch ID doesn't exist |
| `ORG_NOT_FOUND` | 404 | Org ID doesn't exist |
| `MEMBERSHIP_NOT_FOUND` | 404 | Membership record not found |
| `MEMBERSHIP_CONFLICT` | 409 | Staff already a member of branch |
| `TIER_LIMIT_REACHED` | 409 | Org tier active-staff limit reached (FR6.3) |
| `BRANCH_ROLE_REQUIRED` | 403 | Operation needs specific role |
| `INVALID_CDT_CODE` | 422 | CDT code not in catalog |
| `CONSENT_TEMPLATE_NOT_FOUND` | 404 | Template ID doesn't exist |
| `PIN_LOCKED` | 403 | Account PIN locked after max attempts |
| `PIN_INVALID` | 422 | Incorrect PIN |

### dental-patient

| Code | HTTP | Trigger |
|------|------|---------|
| `PATIENT_NOT_FOUND` | 404 | Patient ID not found in branch |
| `PATIENT_ARCHIVED` | 403 | Write attempt on an archived patient |
| `PATIENT_ALREADY_ARCHIVED` | 409 | Archive on already-archived patient |
| `DUPLICATE_PATIENT` | 409 | Same person already a patient in branch |
| `CONSENT_REQUIRED` | 422 | Missing marketing/data consent on create (BR-015) |
| `FOLLOW_UP_IMMUTABLE` | 405 | PATCH/DELETE on follow-up note |
| `PATIENT_MERGE_NOT_IMPLEMENTED` | 501 | Merge endpoint not implemented |
| `INVALID_IMPORT_FORMAT` | 422 | CSV/JSON import file malformed |
| `IMPORT_VALIDATION_FAILED` | 422 | Import rows failed validation |

### dental-visit

| Code | HTTP | Trigger |
|------|------|---------|
| `VISIT_NOT_FOUND` | 404 | Visit ID not found |
| `ACTIVE_VISIT_EXISTS` | 409 | Patient already has active visit (BR-001) |
| `VISIT_IMMUTABLE` | 422 | Write to locked/completed visit (BR-003) |
| `VISIT_LOCKED` | 422 | Write to a visit locked post-completion (BR-003) |
| `INVALID_STATUS_TRANSITION` | 422 | Visit FSM violation |
| `TREATMENT_NOT_FOUND` | 404 | Treatment ID not on visit |
| `TREATMENT_IMMUTABLE` | 422 | Modify performed treatment (BR-007) |
| `DENTITION_ALREADY_INITIALIZED` | 409 | Dentition chart already exists |

### dental-scheduling

| Code | HTTP | Trigger |
|------|------|---------|
| `APPOINTMENT_NOT_FOUND` | 404 | Appointment ID not found |
| `DOUBLE_BOOKING` | 409 | Provider already booked that slot (FR3.7) |
| `RESCHEDULE_CONFLICT` | 409 | New slot also conflicts |
| `OUTSIDE_WORKING_HOURS` | 422 | Slot outside branch operating hours |
| `REASON_REQUIRED` | 422 | Cancel without cancellation reason |
| `CHECKIN_ACTIVE_VISIT` | 409 | Check-in when active visit already exists |

### dental-billing

| Code | HTTP | Trigger |
|------|------|---------|
| `INVOICE_NOT_FOUND` | 404 | Invoice ID not found |
| `NO_BILLABLE_TREATMENTS` | 422 | Invoice create with no performed treatments (BR-009) |
| `INVALID_STATUS_TRANSITION` | 422 | Invoice FSM violation |
| `ACTIVE_PAYMENT_PLAN` | 409 | Void blocked by active payment plan (BR-011) |
| `ALREADY_VOIDED` | 422 | Void already-voided invoice |
| `PAYMENT_EXCEEDS_BALANCE` | 422 | Payment > outstanding balance (BR-012) |
| `INVOICE_IMMUTABLE` | 422 | Modify paid/voided invoice |

### dental-clinical

| Code | HTTP | Trigger |
|------|------|---------|
| `PRESCRIPTION_NOT_FOUND` | 404 | Rx ID not found |
| `PRESCRIBER_REQUIRED` | 422 | Missing prescriberMemberId (BR-017) |
| `DENTIST_ROLE_REQUIRED` | 403 | Non-dentist tries clinical write |
| `LAB_ORDER_NOT_FOUND` | 404 | Lab order ID not found |
| `INVALID_STATUS_TRANSITION` | 422 | Lab order FSM violation |
| `CONSENT_FORM_NOT_FOUND` | 404 | Consent form ID not found |
| `CONSENT_FORM_SIGNED` | 422 | PATCH on already-signed form |
| `CONSENT_ALREADY_SIGNED` | 422 | Revoke attempt on a signed consent form — illegal signed→revoked transition (revokeConsentForm.ts; NEW-P1-B) |
| `CONFLICT` | 409 | Revoke attempt on an already-revoked consent form, incl. the read-then-update revoke race (revokeConsentForm.ts → ConflictError default code; NEW-P1-B) |
| `CONSENT_FORM_IMMUTABLE` | 405 | DELETE/replace on signed form |
| `MEDICAL_HISTORY_IMMUTABLE` | 405 | PATCH/DELETE on medical history entry |
| `VISIT_IMMUTABLE` | 422 | Clinical write to locked visit (BR-003) |
| `AMENDMENT_REQUIRES_REASON` | 422 | Amendment without reason field |

### dental-perio

| Code | HTTP | Trigger |
|------|------|---------|
| `CHART_EXISTS` | 409 | Second perio chart for the same visitId (BR-P01) |
| `CHART_COMPLETED` | 409 | Write/edit attempt on a completed perio chart |
| `INVALID_DEPTH` | 422 | Probing depth value < 0 or > 20 (BR-P03) |
| `INVALID_TOOTH_NUMBER` | 422 | FDI tooth number not in the valid set (BR-P04) |
| `INSUFFICIENT_READINGS` | 422 | Chart complete with fewer than the required readings |

> `VISIT_LOCKED` (422) and `FORBIDDEN` (403) returned by perio handlers are shared platform codes — see §3 and dental-visit.

### dental-imaging

| Code | HTTP | Trigger |
|------|------|---------|
| `STUDY_NOT_FOUND` | 404 | ImagingStudy ID not found |
| `IMAGING_TIER_REQUIRED` | 403 | Feature needs higher subscription tier |
| `UNSUPPORTED_MIME_TYPE` | 422 | Image MIME type not in allowed list |
| `ANNOTATION_NOT_FOUND` | 404 | Annotation ID not found |
| `INVALID_STATUS_TRANSITION` | 422 | Annotation/finding FSM violation |
| `CEPH_ANALYSIS_NOT_FOUND` | 404 | CephAnalysis ID not found |
| `NOT_CALIBRATED` | 422 | Ceph computation requires calibration first |
| `INSUFFICIENT_LANDMARKS` | 422 | Minimum landmark count not met |
| `FINDING_NOT_FOUND` | 404 | Finding ID not found |

### dental-pmd

| Code | HTTP | Trigger |
|------|------|---------|
| `PMD_NOT_FOUND` | 404 | PMD ID not found |
| `VISIT_NOT_COMPLETED` | 422 | PMD generate when visit not completed (BR-021) |
| `PMD_IMMUTABLE` | 405 | PATCH/DELETE on generated PMD (BR-022) |
| `CHECKSUM_MISMATCH` | 422 | Import file checksum invalid |
| `IMPORTED_PMD_IMMUTABLE` | 405 | PATCH on imported PMD |

### dental-emr

| Code | HTTP | Trigger |
|------|------|---------|
| `EMR_NOT_FOUND` | 404 | EMR record ID not found |
| `EMR_IMMUTABLE` | 405 | PATCH/DELETE on imported EMR |
| `UNSUPPORTED_SOURCE_SYSTEM` | 422 | Source system not in allowed list |
| `IMPORT_PARSE_ERROR` | 422 | File cannot be parsed |

### dental-audit

| Code | HTTP | Trigger |
|------|------|---------|
| `AUDIT_EVENT_IMMUTABLE` | 405 | Any write attempt on audit event |
| `INVALID_DATE_RANGE` | 422 | date_from > date_to |
| `BRANCH_ACCESS_DENIED` | 403 | Caller not member of requested branch |

### emr-consultation

| Code | HTTP | Trigger |
|------|------|---------|
| `CONSULTATION_NOT_DRAFT` | 422 | Finalize attempt on a non-draft consultation note |

> This is the **platform** `/emr` consultation-notes module (Better-Auth `provider`/`patient`/`admin`), distinct from the dental `dental-emr` external-records-import range (`EMR-001 – EMR-099`, §4) which covers third-party EMR/EHR import.

---

## 6. Validation Error Detail Format

For 400 validation errors, the flat envelope adds `fieldErrors` (and optional
`globalErrors`) at the top level — per TypeSpec `ValidationError`/`FieldError`:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "statusCode": 400,
  "requestId": "…",
  "timestamp": "…",
  "fieldErrors": [
    { "field": "branchId", "code": "required", "message": "Required" },
    { "field": "startAt", "code": "invalid_datetime", "message": "Must be a valid ISO 8601 datetime" }
  ],
  "globalErrors": []
}
```

---

## 7. Not-Implemented Stubs

| Endpoint | Code | HTTP |
|----------|------|------|
| `POST /dental/patients/merge` | `PATIENT_MERGE_NOT_IMPLEMENTED` | 501 |
