# API Side Effects and Idempotency

This document catalogs all side effects triggered by Monobase Healthcare API operations, and defines idempotency guarantees for each. It is intended for AI agents, integration developers, and operations teams who need to understand what happens beyond the primary resource write.

A side effect is any action the API takes beyond persisting the primary resource — notifications sent, secondary resources created, external systems called, or access control refreshed.

---

## Notation

Each operation entry follows this structure:

```
### operationId: <operationId>
**Side effects:**
- <what happens>

**Idempotency:**
- <guarantee and deduplication strategy>
```

---

## Encounter Operations

### operationId: createEncounter
**Side effects:**
- Creates an `AuditEvent` resource (provenance record) capturing who created the Encounter, when, and from which system
- If `status=inProgress` at creation and a `location` is specified, creates a bed assignment (`Encounter.location` entry with status=active)
- If `episodeOfCare` reference is provided, updates the EpisodeOfCare status to `active` if it was `planned`
- If an `Appointment` reference is provided in `appointment`, automatically transitions that Appointment status to `arrived`
- Sends an internal event to the notification service (encounter.created) consumed by downstream systems (scheduling, clinical decision support)

**Idempotency:**
- Not idempotent. Each call creates a new Encounter resource with a new server-assigned ID.
- To deduplicate: query `GET /Encounter?identifier=<your-system>|<your-id>` before creating. If a result is returned, the Encounter already exists.
- Recommended pattern: set `Encounter.identifier` with a client-assigned business key before posting.

---

### operationId: transitionEncounterStatus
**Side effects:**

When transitioning to `arrived`:
- Updates linked `Appointment.status` to `arrived` (if not already)
- Creates `AuditEvent` for status change

When transitioning to `inProgress`:
- Activates bed assignment at specified location
- Notifies care team members via `Communication` resource creation
- Starts clinical decision support rules evaluation (allergy checks, drug interaction alerts)

When transitioning to `finished`:
- Sets `Encounter.period.end` to current timestamp (if not already set)
- **Triggers billing workflow**: creates pending `ChargeItem` resources for all services recorded during the Encounter
- Creates `AuditEvent` for status change
- If `hospitalization.dischargeDisposition` is set, updates bed to available
- Sends encounter.completed event to downstream systems (care management, billing, analytics)
- If linked `EpisodeOfCare` has no other active Encounters, evaluates whether EpisodeOfCare should be transitioned to `finished` (configurable per tenant)

When transitioning to `cancelled`:
- Voids any pending `ChargeItem` resources linked to this Encounter
- Updates linked `Appointment.status` to `cancelled` (if present and not already cancelled)
- Creates `AuditEvent`

**Idempotency:**
- Transitioning to the same status the Encounter is already in is a no-op (returns 200 with the unchanged resource).
- Transitioning to a different non-current status is idempotent only if no billing side effects have been triggered; once ChargeItems are created, re-triggering finish requires explicit reversal.

---

## Appointment Operations

### operationId: createAppointment
**Side effects:**
- Creates `AuditEvent` for creation
- Sends notification to all `participant[*].actor` resources with status=needs-action:
  - Practitioner/PractitionerRole participants receive a scheduling notification (email, SMS, or in-app depending on Communication preferences)
  - Patient participant receives appointment confirmation (channel per patient preference)
- Creates `Communication` resources to record notifications sent
- If `basedOn` references a `ServiceRequest` (referral), updates the ServiceRequest status

**Idempotency:**
- Not idempotent. Each call creates a new Appointment.
- Deduplicate by querying `GET /Appointment?identifier=<system>|<id>` before creating, or by checking `GET /Appointment?patient=<id>&date=<date>&status=booked`.

---

### operationId: transitionAppointmentStatus
**Side effects:**

When transitioning to `booked`:
- Sends booking confirmation notification to patient (email/SMS)
- Sends confirmation to all practitioner participants
- Creates `Communication` resources for each notification sent
- Creates `AuditEvent`

When transitioning to `cancelled`:
- Sends cancellation notification to patient
- Sends cancellation notification to all practitioner participants
- Creates `Communication` resources
- Frees time slot in scheduling system (releases `Slot` resource)
- Creates `AuditEvent`
- If `cancellationReason` indicates patient-initiated same-day cancellation, increments patient's cancellation counter (used for no-show risk scoring)

When transitioning to `noshow`:
- Creates a `Flag` resource on the patient record with code=no-show (configurable per tenant — may be suppressed for first offense)
- Sends no-show notification to care coordination team
- Creates `AuditEvent`
- Releases slot for rebooking

When transitioning to `fulfilled`:
- Requires a linked `Encounter` to exist (referential check)
- Creates `AuditEvent`

**Idempotency:**
- Status transitions to the current status are no-ops.
- Cancellation and no-show transitions are idempotent if retried before notifications are sent; notifications are deduplicated by Communication.identifier.

---

## Medication Operations

### operationId: createMedicationRequest
**Side effects:**
- Creates `AuditEvent`
- Runs drug allergy check: queries `AllergyIntolerance` for the patient, evaluates against medication; if a match is found, creates a `DetectedIssue` resource with severity=high and returns a 200 with warning OperationOutcome (does not block creation by default — configurable)
- Runs drug-drug interaction check against all active MedicationRequests for the patient; creates `DetectedIssue` for each interaction found
- If `dispenseRequest` is present and routes to a pharmacy: sends pharmacy notification event (medication-order.created) — pharmacy system creates a `Task` for dispensing
- If `intent=reflex-order`, links to the originating MedicationRequest via `priorPrescription`

**Idempotency:**
- Not idempotent. Each call creates a new MedicationRequest.
- Deduplicate by querying `GET /MedicationRequest?identifier=<system>|<id>` before creating.
- Clinical safety note: duplicating a MedicationRequest can result in double-dosing. Always deduplicate before retry.

---

### operationId: transitionMedicationRequestStatus
**Side effects:**

When transitioning to `active` from `draft`:
- Sends pharmacy notification if `dispenseRequest` routing is configured
- Creates `AuditEvent`

When transitioning to `on-hold`:
- Sends hold notification to pharmacy system (suspends active dispense Task)
- Creates `AuditEvent`

When transitioning to `stopped`:
- Sends stop notification to pharmacy system (cancels any pending dispense Task)
- If medication was active and patient had a scheduled dose within the next 24 hours, sends alert to nursing staff via `Communication`
- Creates `AuditEvent`

When transitioning to `completed`:
- Creates `AuditEvent`
- No pharmacy side effects (completion is typically auto-triggered when dispense count reaches `numberOfRepeatsAllowed`)

**Idempotency:**
- Status transitions to the current status are no-ops.

---

## ServiceRequest Operations

### operationId: createServiceRequest
**Side effects:**
- Creates `AuditEvent`
- Based on `category`:
  - `laboratory`: sends lab order event (service-request.created) to laboratory information system (LIS); LIS creates a `Specimen` collection `Task` and assigns an accession number
  - `imaging`: sends imaging order event to radiology information system (RIS); RIS creates a `Task` for scheduling
  - `procedure`: sends procedure scheduling notification
  - `referral`: sends referral notification to target organization/practitioner
- If `priority=stat`, sends urgent notification to relevant department
- Creates a result-expected `Task` with deadline based on `occurrenceDateTime` or `occurrencePeriod`

**Idempotency:**
- Not idempotent. Each call creates a new ServiceRequest.
- Deduplicate by querying `GET /ServiceRequest?identifier=<system>|<id>` before creating.
- For lab orders, duplicate ServiceRequests may result in duplicate specimen collections — always deduplicate before retry.

---

### operationId: transitionServiceRequestStatus
**Side effects:**

When transitioning to `active`:
- Activates the associated result-expected Task
- Sends acknowledgment back to ordering system if `requester` is an external system

When transitioning to `completed`:
- Marks result-expected Task as completed
- Sends result-available notification to `requester`
- Creates `AuditEvent`

When transitioning to `revoked`:
- Cancels the associated collection or scheduling Task in the downstream system
- Sends revocation notification to performing system
- Creates `AuditEvent`

**Idempotency:**
- Status transitions to current status are no-ops.
- Revocation is idempotent — revoking an already-revoked ServiceRequest returns 200 with no additional side effects.

---

## Claim Operations

### operationId: createClaim
**Side effects:**
- Creates `AuditEvent`
- Validates that referenced `Coverage` is active (eligibility pre-check)
- If validation fails, creates an OperationOutcome warning (does not block creation)
- Locks referenced `ChargeItem` resources to prevent modification while claim is active

**Idempotency:**
- Not idempotent. Each call creates a new Claim.
- Financial deduplication is critical: use `Claim.identifier` with a client-assigned idempotency key.
- Query `GET /Claim?identifier=<system>|<id>` before retrying failed submissions.

---

### operationId: submitClaim
**Side effects:**
- Transmits claim data to the payer via configured clearinghouse or direct payer connection (EDI 837P/837I or FHIR $submit)
- Creates `AuditEvent` with payer transmission details
- Sets `Claim.status=active` upon successful transmission acceptance
- Creates a pending `PaymentReconciliation` placeholder for tracking
- If payer rejects the transmission (EDI-level rejection, not clinical denial), creates an error `Task` assigned to billing team

**Idempotency:**
- MUST use idempotency key (client-assigned `Claim.identifier`) for all financial operations.
- Submitting the same Claim identifier twice with the same payload: returns existing Claim (idempotent if not yet acknowledged by payer).
- Submitting after payer acknowledgment: returns 409 Conflict — do not resubmit; create an adjustment Claim if correction is needed.

---

## Observation Operations

### operationId: createObservation
**Side effects:**
- Creates `AuditEvent`
- If `category=vital-signs` and value is outside reference range: creates a `Flag` resource (configurable) and sends an alert to the care team via `Communication`
- If `category=laboratory` and value is critically abnormal (based on `referenceRange` and `interpretation=critical-high` or `critical-low`): sends critical value notification to ordering provider (required by CLIA regulations)
- If observation is linked to a `DiagnosticReport`, updates the DiagnosticReport status to `preliminary` if it was `registered`

**Idempotency:**
- Not idempotent. Each call creates a new Observation.
- Deduplicate by querying `GET /Observation?identifier=<system>|<id>` before creating, or by checking subject + code + effective date/time.

---

### operationId: bulkCreateObservations
**Side effects:**
- Same individual side effects as `createObservation` for each successfully created Observation
- Critical value notifications may be batched (sent as a digest) or individual depending on tenant configuration
- Creates one `AuditEvent` per successfully created Observation
- Returns `207 Multi-Status` — some Observations may succeed and others may fail within the same request

**Partial success semantics:**
- Each item in the response body has its own status code (200/201 for success, 4xx for failure)
- Successfully created Observations are persisted even if others fail
- Side effects (notifications, flags) are only triggered for successfully created Observations
- The response body contains a `Bundle` of type `batch-response` with one entry per input item
- Clients MUST check each entry's `response.status` individually

**Idempotency:**
- Not idempotent at the batch level. Individual items may be deduplicated using their `identifier` fields.
- Retry strategy: re-submit only the failed items from the 207 response; do not re-submit the full batch.

---

## MedicationDispense Operations

### operationId: createMedicationDispense
**Side effects:**
- Creates `AuditEvent`
- **Inventory deduction**: decrements the medication quantity in the pharmacy inventory system for the dispensing `Location`
- If inventory falls below reorder threshold, creates a supply `Task` for pharmacy staff
- Updates the linked `MedicationRequest` dispense count (increments against `dispenseRequest.numberOfRepeatsAllowed`)
- If this dispense fulfills the final allowed fill, triggers notification to prescriber
- Sends dispense confirmation to patient (if direct-to-patient dispensing model)

**Idempotency:**
- Not idempotent. Each call deducts inventory and increments dispense count.
- Duplicate dispense records result in incorrect inventory counts. Deduplicate using `MedicationDispense.identifier`.
- Query `GET /MedicationDispense?identifier=<system>|<id>` before retrying.

---

## Consent Operations

### operationId: createConsent
**Side effects:**
- Creates `AuditEvent`
- **Refreshes access control**: triggers re-evaluation of the patient's data access policies in the authorization layer — effective immediately
- If `scope=patient-privacy` and `provision.type=deny`, restricts data access for the denied parties immediately
- Sends consent acknowledgment to patient (if contact info available)

**Idempotency:**
- Not idempotent. Each call creates a new Consent resource with a new effective date.
- For retries: query `GET /Consent?patient=<id>&status=active` and compare `provision` before creating.
- Note: Multiple active Consents for the same patient and scope are allowed (layered consent model); the most specific and most recent provision applies.

---

### operationId: updateConsent
**Side effects:**
- Creates `AuditEvent` with changed fields recorded
- **Refreshes access control**: triggers immediate re-evaluation of access policies
- If changing from `active` to `inactive` (revocation): sends revocation event to all systems that were granted access under this Consent; those systems must honor the revocation within their configured compliance window
- Creates a new version of the Consent resource (version history preserved)

**Idempotency:**
- Updating with identical content is a no-op (returns 200 with existing resource).
- Access control refresh is idempotent — refreshing when nothing changed has no user-visible effect.
- Revocation events are sent exactly once per update; retrying an already-revoked Consent update returns 200 with no additional revocation events.

---

## Composition Operations

### operationId: createComposition
**Side effects:**
- Creates `AuditEvent`
- If `type` is a discharge summary LOINC code (e.g., 18842-5):
  - Triggers discharge workflow evaluation: checks if linked Encounter is in `finished` status
  - If Encounter is still `inProgress`, sends alert to care team that discharge summary is being prepared
  - May auto-trigger Encounter status transition to `finished` depending on tenant workflow configuration
- Creates `DocumentReference` pointing to this Composition (enables document search without loading full Composition)

**Idempotency:**
- Not idempotent. Each call creates a new Composition.
- Deduplicate by querying `GET /Composition?subject=<patient>&type=<loinc-code>&encounter=<id>` before creating.

---

## PriorAuthorization Operations

### operationId: submitPriorAuthorization
**Side effects:**
- Transmits the prior authorization request to the insurer via configured channel (FHIR $submit, X12 278, or portal)
- Creates `AuditEvent` with insurer transmission details
- Creates a pending `Task` for tracking the authorization decision with `deadline` = expected response time per insurer SLA
- Sets `Claim.status=active` upon successful submission
- Sends acknowledgment notification to requesting provider
- If response is synchronous (real-time PA): immediately creates `ClaimResponse` and returns decision inline

**Idempotency:**
- MUST use idempotency key (`Claim.identifier`) for all PA submissions.
- Duplicate submission of same PA: returns 409 Conflict if already submitted to payer.
- Always query `GET /Claim?identifier=<system>|<id>` before retrying.

---

## Idempotency Guidelines

### Financial Operations

Financial operations carry the highest risk of duplicate processing. All financial API operations SHOULD use idempotency keys.

**Supported idempotency mechanisms:**

1. **Client-assigned identifier**: Set a `<system>|<value>` identifier on the resource before POSTing. The API returns 200 with the existing resource if the identifier already exists.
2. **Idempotency-Key header**: For operations that do not create a persistent resource (e.g., $submit), include `Idempotency-Key: <uuid>` in the request header. The API stores the response for 24 hours and returns the cached response on retry.

**Operations requiring idempotency keys:**

| Operation | Mechanism | Window |
|---|---|---|
| `submitClaim` | `Claim.identifier` + `Idempotency-Key` header | 24 hours |
| `createClaim` | `Claim.identifier` | Permanent |
| `submitPriorAuthorization` | `Claim.identifier` + `Idempotency-Key` header | 24 hours |
| `createMedicationDispense` | `MedicationDispense.identifier` | Permanent |
| `createInvoice` | `Invoice.identifier` | Permanent |
| `recordPayment` | `PaymentReconciliation.identifier` | Permanent |

### Clinical Writes

Clinical writes (Encounter, Observation, MedicationRequest) use **identifier-based deduplication** rather than idempotency keys.

**Pattern:**
1. Before creating, query by business identifier: `GET /<Resource>?identifier=<system>|<value>`
2. If the resource exists, return the existing resource to the caller
3. If it does not exist, proceed with POST

This is a **client responsibility** — the API does not automatically deduplicate clinical writes by default. Tenants may enable server-side identifier deduplication as a configuration option.

### Status Transitions

Status transitions are **naturally idempotent**:
- Transitioning a resource to the status it already holds returns `200 OK` with the unchanged resource
- No side effects are re-triggered
- This makes status transitions safe to retry without consequence

**Exception**: Transitions that trigger financial side effects (e.g., Encounter→finished triggers billing) are idempotent only once. Attempting to re-trigger from the same terminal state returns 200 but does NOT re-trigger billing.

### Bulk Operations

Bulk operations that create multiple resources in a single call return `207 Multi-Status` to report partial success.

**Semantics:**
- The response body contains one result entry per input item
- Successful items: HTTP status 201 (created) or 200 (updated)
- Failed items: HTTP status 4xx with OperationOutcome detail
- Successfully created resources are persisted even when other items in the same batch fail
- Side effects are applied only for successfully processed items
- The overall HTTP status of the response is 207 regardless of whether all items succeeded or all failed

**Retry guidance for bulk operations:**
- Extract the failed items from the 207 response (items where `response.status` starts with 4 or 5)
- Re-submit only the failed items as a new batch
- Do not re-submit the entire original batch — already-successful items will either duplicate (clinical) or conflict (financial)

### Operation-Level Idempotency Summary

| Operation | Idempotent | Dedup Mechanism | Notes |
|---|---|---|---|
| `createEncounter` | No | identifier query | Check before create |
| `transitionEncounterStatus` | Yes (same state) | Status check | Billing side effects not re-triggered |
| `createAppointment` | No | identifier query | — |
| `transitionAppointmentStatus` | Yes (same state) | Status check | Notifications deduplicated by Communication.identifier |
| `createMedicationRequest` | No | identifier query | Clinical safety risk if duplicated |
| `transitionMedicationRequestStatus` | Yes (same state) | Status check | — |
| `createServiceRequest` | No | identifier query | Duplicate may cause duplicate specimen collection |
| `createClaim` | No | identifier (required) | Financial — must use identifier |
| `submitClaim` | Conditional | identifier + header | 409 after payer acknowledgment |
| `createObservation` | No | identifier query | — |
| `bulkCreateObservations` | No (batch) | identifier per item | Retry failed items only |
| `createMedicationDispense` | No | identifier (required) | Inventory deduction risk |
| `createConsent` | No | query before create | Multiple active Consents allowed |
| `updateConsent` | Yes (same content) | Content hash | — |
| `createComposition` | No | query by subject+type | — |
| `submitPriorAuthorization` | Conditional | identifier + header | 409 after payer acknowledgment |
