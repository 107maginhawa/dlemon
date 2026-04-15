# Event Catalog — Monobase Healthcare API Standards Foundation

**Document ID**: MHASF-STD-006
**Version**: 1.0.0
**Status**: Active
**Last Updated**: 2026-04-14

---

## Table of Contents

1. [Event Naming Convention](#event-naming-convention)
2. [Event Payload Structure](#event-payload-structure)
3. [Status Transition Diagrams](#status-transition-diagrams)
4. [Domain Event Catalog](#domain-event-catalog)
5. [Audit Requirements per Event](#audit-requirements-per-event)

---

## 1. Event Naming Convention

All events follow the three-part dot-separated pattern:

```
{domain}.{entity}.{action}
```

### Domain Segments

| Domain         | Scope                                              | Examples                            |
|----------------|----------------------------------------------------|-------------------------------------|
| `clinical`     | Direct patient care activities                     | `clinical.encounter.started`        |
| `administrative` | Scheduling, registration, coverage               | `administrative.appointment.booked` |
| `ancillary`    | Lab, radiology, pharmacy, specimen management      | `ancillary.specimen.collected`      |
| `support`      | Infrastructure, audit, consent, notifications      | `support.consent.revoked`           |
| `billing`      | Claims, prior auth, payments                       | `billing.claim.submitted`           |

### Entity Segments

Use the singular, camelCase form of the FHIR resource name or logical entity:

- `encounter`, `appointment`, `patient`, `observation`, `medicationRequest`
- `serviceRequest`, `specimen`, `claim`, `priorAuth`, `task`
- `consent`, `coverage`, `diagnosticReport`, `procedure`

### Action Segments

Actions are lowercase past-tense verbs expressing what happened:

| Action           | Meaning                                              |
|------------------|------------------------------------------------------|
| `created`        | Resource was first persisted                         |
| `updated`        | One or more fields changed                           |
| `deleted`        | Resource was soft-deleted (enteredInError)           |
| `started`        | A lifecycle began (encounter, task)                  |
| `completed`      | A lifecycle reached its terminal success state       |
| `cancelled`      | A lifecycle was explicitly terminated                |
| `submitted`      | Resource was sent to an external system              |
| `approved`       | External or internal approval granted                |
| `denied`         | External or internal approval refused                |
| `booked`         | Appointment reserved                                 |
| `collected`      | Specimen or sample physically obtained               |
| `resulted`       | Diagnostic result available                          |
| `dispensed`      | Medication physically given or released              |
| `revoked`        | A previously active authorisation was withdrawn      |
| `accessed`       | A record was read (audit trail only)                 |
| `masked`         | A field was suppressed from a response               |
| `breakGlassUsed` | Emergency access override invoked                    |

### Examples

```
clinical.encounter.started
clinical.observation.resulted
administrative.appointment.booked
administrative.patient.registered
ancillary.specimen.collected
ancillary.diagnosticReport.resulted
billing.claim.submitted
billing.priorAuth.approved
support.consent.revoked
support.audit.breakGlassUsed
```

---

## 2. Event Payload Structure

Every event is wrapped in a standard envelope regardless of domain. Domain-specific content is isolated in the `data` field.

### Envelope Schema

```typescript
model EventEnvelope<T> {
  /** Full event type in {domain}.{entity}.{action} format */
  eventType: string;

  /** Globally unique event identifier (UUID v4) */
  eventId: string;

  /** ISO 8601 UTC timestamp of when the event occurred */
  timestamp: utcDateTime;

  /** System or service that emitted the event */
  source: EventSource;

  /** The human or system identity that triggered the action */
  actor: ActorReference;

  /** Tenant (organization) scope for multi-tenant deployments */
  tenantId: string;

  /** Domain-specific event payload */
  data: T;

  /** Optional correlation ID linking related events in a workflow */
  correlationId?: string;

  /** Schema version for the data payload */
  schemaVersion: string;
}
```

### Field Definitions

| Field           | Type          | Required | Description                                                        |
|-----------------|---------------|----------|--------------------------------------------------------------------|
| `eventType`     | string        | Yes      | Dot-separated event name, e.g. `clinical.encounter.started`        |
| `eventId`       | string (UUID) | Yes      | Unique ID per event emission; used for deduplication               |
| `timestamp`     | utcDateTime   | Yes      | When the underlying action occurred (not when the event was sent)  |
| `source`        | EventSource   | Yes      | Originating system, module, and version                            |
| `actor`         | ActorReference| Yes      | userId, roleCode, and purposeOfUse for the triggering identity     |
| `tenantId`      | string        | Yes      | Organisation or facility ID in the multi-tenant hierarchy          |
| `data`          | T             | Yes      | Event-specific payload; structure defined per event type           |
| `correlationId` | string        | No       | Links events that are part of the same business transaction        |
| `schemaVersion` | string        | Yes      | Semantic version of the `data` payload schema, e.g. `1.0.0`       |

### EventSource Sub-Object

```typescript
model EventSource {
  system:  string;   // e.g. "clinical-api", "pharmacy-service"
  module:  string;   // e.g. "encounter-management"
  version: string;   // Semantic version of the emitting service
}
```

### ActorReference Sub-Object

```typescript
model ActorReference {
  userId:       string;         // Internal user identifier
  userType:     ActorType;      // practitioner | patient | system | admin
  roleCode?:    string;         // SNOMED or local role code
  purposeOfUse: PurposeOfUse;   // TREAT | HPAYMT | HOPERAT | HRESCH | ETREAT
}
```

### Canonical Envelope Example

```json
{
  "eventType": "clinical.encounter.started",
  "eventId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "timestamp": "2026-04-14T08:32:00Z",
  "source": {
    "system": "clinical-api",
    "module": "encounter-management",
    "version": "2.1.0"
  },
  "actor": {
    "userId": "pract-00491",
    "userType": "practitioner",
    "roleCode": "224608005",
    "purposeOfUse": "TREAT"
  },
  "tenantId": "org-metro-hospital",
  "correlationId": "wf-admission-20260414-8821",
  "schemaVersion": "1.0.0",
  "data": {
    "encounterId": "enc-0049912",
    "patientId":   "pat-882200",
    "class":       "IMP",
    "priority":    "routine",
    "startTime":   "2026-04-14T08:30:00Z"
  }
}
```

---

## 3. Status Transition Diagrams

All state machines use the following conventions:

- Solid arrows (`-->`) represent allowed transitions.
- States in **bold** are terminal (no further transitions allowed).
- States in _italics_ are reversible intermediate states.

### 3.1 Encounter

```
planned --> arrived --> triaged --> inProgress
                                        |
                                   onLeave <--> inProgress
                                        |
                              finished (terminal)
                              cancelled (terminal)
```

| From        | To            | Trigger                                      |
|-------------|---------------|----------------------------------------------|
| `planned`   | `arrived`     | Patient presents at facility                 |
| `arrived`   | `triaged`     | Triage assessment completed                  |
| `triaged`   | `inProgress`  | Provider begins active care                  |
| `inProgress`| `onLeave`     | Patient temporarily leaves (e.g. test, break)|
| `onLeave`   | `inProgress`  | Patient returns to active care               |
| `inProgress`| `finished`    | Encounter formally closed                    |
| Any non-terminal | `cancelled` | Administrative cancellation              |

### 3.2 ServiceRequest

```
draft --> active --> onHold <--> active
              |
         completed (terminal)
         revoked   (terminal)
```

| From      | To          | Trigger                                      |
|-----------|-------------|----------------------------------------------|
| `draft`   | `active`    | Order signed and released                    |
| `active`  | `onHold`    | Temporarily suspended by ordering provider  |
| `onHold`  | `active`    | Hold released                                |
| `active`  | `completed` | Order fulfilled                              |
| `active`  | `revoked`   | Order explicitly cancelled before completion |

### 3.3 MedicationRequest

```
draft --> active --> onHold <--> active
              |
         completed (terminal)
         stopped   (terminal)
         cancelled (terminal)
```

| From      | To          | Trigger                                        |
|-----------|-------------|------------------------------------------------|
| `draft`   | `active`    | Prescription signed                            |
| `active`  | `onHold`    | Temporarily suspended (e.g. surgery prep)      |
| `onHold`  | `active`    | Suspension lifted                              |
| `active`  | `completed` | Full course dispensed and administered         |
| `active`  | `stopped`   | Clinician decides to discontinue early         |
| Any non-terminal | `cancelled` | Administrative void              |

### 3.4 Appointment

```
proposed --> pending --> booked --> arrived --> fulfilled (terminal)
                                         |
                                    cancelled (terminal)
                                    noShow    (terminal)
```

| From       | To          | Trigger                                       |
|------------|-------------|-----------------------------------------------|
| `proposed` | `pending`   | System or patient proposes; awaiting confirm  |
| `pending`  | `booked`    | All parties confirmed                         |
| `booked`   | `arrived`   | Patient checked in                            |
| `arrived`  | `fulfilled` | Appointment completed                         |
| Any non-terminal | `cancelled` | Patient or provider cancels          |
| `booked`   | `noShow`    | Patient did not arrive within grace window    |

### 3.5 Claim

```
draft --> active --> (ClaimResponse adjudication)
                              |
                         paid    (terminal)
                         denied  (terminal)
```

| From     | To           | Trigger                                           |
|----------|--------------|---------------------------------------------------|
| `draft`  | `active`     | Claim submitted to payer                          |
| `active` | `paid`       | ClaimResponse with `complete` and positive payment|
| `active` | `denied`     | ClaimResponse with denial outcome                 |

Note: Partial adjudication creates a separate ClaimResponse referencing the original Claim. The Claim status reflects the final adjudication outcome.

### 3.6 PriorAuthorization

```
draft --> submitted --> pending --> approved (terminal)
                                |
                           denied  (terminal)
                           expired (terminal)
```

| From        | To          | Trigger                                        |
|-------------|-------------|------------------------------------------------|
| `draft`     | `submitted` | Auth request transmitted to payer              |
| `submitted` | `pending`   | Payer acknowledged; review in progress         |
| `pending`   | `approved`  | Payer grants authorization                     |
| `pending`   | `denied`    | Payer refuses authorization                    |
| `pending`   | `expired`   | Time window elapsed without payer decision     |
| `approved`  | `expired`   | Auth validity period elapsed without use       |

### 3.7 Task

```
draft --> requested --> accepted --> inProgress --> completed (terminal)
                                                |
                                           failed    (terminal)
                                           cancelled (terminal)
```

| From        | To           | Trigger                                      |
|-------------|--------------|----------------------------------------------|
| `draft`     | `requested`  | Task formally issued to assignee             |
| `requested` | `accepted`   | Assignee confirms they will perform the task |
| `requested` | `cancelled`  | Requester withdraws before acceptance        |
| `accepted`  | `inProgress` | Assignee begins work                         |
| `inProgress`| `completed`  | Task performed successfully                  |
| `inProgress`| `failed`     | Task could not be completed                  |
| Any non-terminal | `cancelled` | Administrative or clinical cancellation|

---

## 4. Domain Event Catalog

The table below documents all defined events. Events marked **Audit Required** must produce an immutable audit record.

### Legend

- **Audit**: M = Mandatory, R = Recommended, N = Not required
- **Payload Fields**: listed as `field(type)` shorthand

---

### 4.1 Clinical Domain

| Event Name                          | Trigger                                 | Source Entity     | Key Payload Fields                                                        | Audit |
|-------------------------------------|-----------------------------------------|-------------------|---------------------------------------------------------------------------|-------|
| `clinical.encounter.created`        | New encounter record persisted          | Encounter         | encounterId, patientId, class, type, priority                             | M     |
| `clinical.encounter.started`        | Encounter moved to `inProgress`         | Encounter         | encounterId, patientId, startTime, practitionerId, locationId             | M     |
| `clinical.encounter.onLeave`        | Patient temporarily leaves              | Encounter         | encounterId, patientId, leaveReason, leaveTime                            | R     |
| `clinical.encounter.returned`       | Patient returns from leave              | Encounter         | encounterId, patientId, returnTime                                        | R     |
| `clinical.encounter.finished`       | Encounter formally closed               | Encounter         | encounterId, patientId, endTime, dischargeDisposition                     | M     |
| `clinical.encounter.cancelled`      | Encounter voided                        | Encounter         | encounterId, patientId, reason                                            | M     |
| `clinical.condition.created`        | Diagnosis recorded                      | Condition         | conditionId, patientId, code, clinicalStatus, verificationStatus          | M     |
| `clinical.condition.updated`        | Diagnosis fields modified               | Condition         | conditionId, patientId, changedFields[]                                   | M     |
| `clinical.condition.resolved`       | Condition set to `resolved`             | Condition         | conditionId, patientId, abatementDate                                     | M     |
| `clinical.observation.resulted`     | Observation value recorded              | Observation       | observationId, patientId, code, value, unit, effectiveDateTime, status    | M     |
| `clinical.observation.amended`      | Observation corrected after result      | Observation       | observationId, patientId, previousValue, newValue, amendReason            | M     |
| `clinical.procedure.started`        | Procedure begun                         | Procedure         | procedureId, patientId, code, performedStart, practitionerId              | M     |
| `clinical.procedure.completed`      | Procedure finished                      | Procedure         | procedureId, patientId, performedEnd, outcome                             | M     |
| `clinical.medicationRequest.created`| Prescription written                    | MedicationRequest | medRequestId, patientId, medicationCode, dose, prescriberId               | M     |
| `clinical.medicationRequest.stopped`| Medication discontinued                 | MedicationRequest | medRequestId, patientId, reason, stoppedBy                                | M     |
| `clinical.allergyIntolerance.recorded` | Allergy documented                  | AllergyIntolerance| allergyId, patientId, substance, criticality, recordedDate                | M     |
| `clinical.careplan.activated`       | CarePlan moved to active                | CarePlan          | carePlanId, patientId, category, period, goals[]                          | R     |

### 4.2 Administrative Domain

| Event Name                              | Trigger                                  | Source Entity  | Key Payload Fields                                                       | Audit |
|-----------------------------------------|------------------------------------------|----------------|--------------------------------------------------------------------------|-------|
| `administrative.patient.registered`     | New patient record created               | Patient        | patientId, birthDate, genderCode, identifiers[]                          | M     |
| `administrative.patient.updated`        | Patient demographics changed             | Patient        | patientId, changedFields[], updatedBy                                    | M     |
| `administrative.patient.merged`         | Duplicate patient records merged         | Patient        | survivingPatientId, retiredPatientId, mergedBy                           | M     |
| `administrative.appointment.proposed`   | Appointment suggestion created           | Appointment    | appointmentId, patientId, serviceType, proposedSlots[]                   | N     |
| `administrative.appointment.booked`     | Appointment confirmed                    | Appointment    | appointmentId, patientId, practitionerId, startTime, endTime, location   | M     |
| `administrative.appointment.cancelled`  | Appointment cancelled                    | Appointment    | appointmentId, patientId, cancelledBy, reason                            | M     |
| `administrative.appointment.noShow`     | Patient failed to attend                 | Appointment    | appointmentId, patientId, noShowRecordedBy                               | R     |
| `administrative.appointment.rescheduled`| Appointment time changed                 | Appointment    | appointmentId, patientId, oldStartTime, newStartTime                     | M     |
| `administrative.coverage.created`       | Insurance coverage added                 | Coverage       | coverageId, patientId, payorId, period, subscriberId                     | M     |
| `administrative.coverage.terminated`    | Insurance coverage ended                 | Coverage       | coverageId, patientId, terminationDate, reason                           | M     |
| `administrative.consent.recorded`       | Consent resource persisted               | Consent        | consentId, patientId, category, provisionType, scope                     | M     |
| `administrative.consent.revoked`        | Consent withdrawn by patient             | Consent        | consentId, patientId, revokedBy, revocationDate                          | M     |
| `administrative.organization.created`   | New org node added to hierarchy          | Organization   | organizationId, name, type, partOfId                                     | R     |
| `administrative.practitioner.credentialed` | Credentials verified and added        | Practitioner   | practitionerId, qualificationCode, issuer, period                        | R     |

### 4.3 Ancillary Domain

| Event Name                              | Trigger                                   | Source Entity    | Key Payload Fields                                                          | Audit |
|-----------------------------------------|-------------------------------------------|------------------|-----------------------------------------------------------------------------|-------|
| `ancillary.serviceRequest.created`      | Lab/imaging order written                 | ServiceRequest   | serviceRequestId, patientId, code, category, priority, requestedBy          | M     |
| `ancillary.serviceRequest.accepted`     | Lab/radiology accepts order               | ServiceRequest   | serviceRequestId, acceptedBy, accessionNumber                               | R     |
| `ancillary.serviceRequest.completed`    | Order fulfilled                           | ServiceRequest   | serviceRequestId, completedTime                                             | M     |
| `ancillary.serviceRequest.revoked`      | Order cancelled after acceptance          | ServiceRequest   | serviceRequestId, revokedBy, reason                                         | M     |
| `ancillary.specimen.collected`          | Specimen physically obtained              | Specimen         | specimenId, patientId, type, collectedBy, collectedTime, container          | M     |
| `ancillary.specimen.received`           | Specimen arrived at lab                   | Specimen         | specimenId, receivedBy, receivedTime, condition                             | R     |
| `ancillary.specimen.rejected`           | Specimen deemed unsuitable                | Specimen         | specimenId, rejectionReason, rejectedBy                                     | M     |
| `ancillary.diagnosticReport.resulted`   | Report with findings issued               | DiagnosticReport | reportId, patientId, code, status, conclusions[], effectiveDateTime         | M     |
| `ancillary.diagnosticReport.amended`    | Report corrected post-issue               | DiagnosticReport | reportId, patientId, previousStatus, amendedBy, amendReason                 | M     |
| `ancillary.diagnosticReport.cancelled`  | Report voided                             | DiagnosticReport | reportId, patientId, reason                                                 | M     |
| `ancillary.medication.dispensed`        | Medication released from pharmacy         | MedicationDispense| dispenseId, patientId, medRequestId, medicationCode, quantity, dispensedBy | M     |
| `ancillary.medication.administered`     | Medication given to patient               | MedicationAdministration | adminId, patientId, medRequestId, effectiveTime, dose, route        | M     |
| `ancillary.immunization.recorded`       | Vaccine administered and documented       | Immunization     | immunizationId, patientId, vaccineCode, lotNumber, occurenceDate            | M     |
| `ancillary.imaging.acquired`            | Imaging study captured                    | ImagingStudy     | studyId, patientId, modality, numberOfSeries, acquiredTime                  | R     |

### 4.4 Billing Domain

| Event Name                         | Trigger                                   | Source Entity    | Key Payload Fields                                                          | Audit |
|------------------------------------|-------------------------------------------|------------------|-----------------------------------------------------------------------------|-------|
| `billing.claim.created`            | Claim record drafted                      | Claim            | claimId, patientId, type, billablePeriod, providerId, payorId               | M     |
| `billing.claim.submitted`          | Claim transmitted to payer                | Claim            | claimId, submittedAt, transmissionId                                        | M     |
| `billing.claim.adjudicated`        | ClaimResponse received from payer         | ClaimResponse    | claimId, responseId, outcome, totalBenefit, totalCost                       | M     |
| `billing.claim.paid`               | Payment posted                            | Claim            | claimId, paymentDate, paymentAmount, paymentRef                             | M     |
| `billing.claim.denied`             | Payer denied claim                        | Claim            | claimId, denialCode, denialReason, appealDeadline                           | M     |
| `billing.priorAuth.submitted`      | Prior auth request sent to payer          | PriorAuth        | authId, patientId, serviceCode, requestedBy, submittedAt                    | M     |
| `billing.priorAuth.approved`       | Payer grants prior auth                   | PriorAuth        | authId, authNumber, approvedUnits, validFrom, validTo                       | M     |
| `billing.priorAuth.denied`         | Payer refuses prior auth                  | PriorAuth        | authId, denialCode, denialReason                                            | M     |
| `billing.priorAuth.expired`        | Auth not used within validity window      | PriorAuth        | authId, expiredAt                                                           | R     |

### 4.5 Support / Infrastructure Domain

| Event Name                         | Trigger                                    | Source Entity  | Key Payload Fields                                                          | Audit |
|------------------------------------|--------------------------------------------|----------------|-----------------------------------------------------------------------------|-------|
| `support.audit.recordAccessed`     | Clinical record read by any actor          | AuditEvent     | resourceType, resourceId, patientId, accessorId, purposeOfUse               | M     |
| `support.audit.breakGlassUsed`     | Emergency access override invoked          | AuditEvent     | resourceId, patientId, providerId, reason, overrideTime                     | M     |
| `support.task.created`             | Workflow task created                      | Task           | taskId, intent, code, forPatientId, assignedTo, dueDate                     | R     |
| `support.task.completed`           | Task completed                             | Task           | taskId, completedBy, completedTime, output                                  | R     |
| `support.task.failed`              | Task could not be completed                | Task           | taskId, failureReason, failedBy                                             | M     |
| `support.notification.sent`        | Outbound notification dispatched           | Communication  | communicationId, recipient, channel, subject, sentAt                        | R     |
| `support.notification.failed`      | Notification delivery failed               | Communication  | communicationId, recipient, failureReason                                   | M     |

---

## 5. Audit Requirements per Event

### 5.1 Mandatory Audit Events

The following categories of events MUST be captured in the immutable audit log. Non-compliance constitutes a HIPAA violation.

| Category                         | Examples                                                           | Retention   |
|----------------------------------|--------------------------------------------------------------------|-------------|
| All clinical write operations    | condition.created, observation.resulted, procedure.completed       | 6 years     |
| All access to clinical records   | support.audit.recordAccessed (any read)                            | 6 years     |
| All consent changes              | consent.recorded, consent.revoked                                  | 6 years     |
| All break-glass access           | support.audit.breakGlassUsed                                       | 6 years     |
| All patient identity changes     | patient.registered, patient.updated, patient.merged                | 6 years     |
| All medication events            | medicationRequest.created, medication.dispensed, medication.administered | 6 years |
| All sensitive record access      | Any access to records classified R or V                            | 6 years     |
| All billing submissions          | claim.submitted, claim.adjudicated, priorAuth.submitted            | 7 years     |
| All authentication events        | Login, logout, token issuance, MFA failures                        | 6 years     |

### 5.2 Audit Record Required Fields

Every mandatory audit log entry must include:

| Field            | Description                                              |
|------------------|----------------------------------------------------------|
| `auditId`        | Unique identifier for the audit record                   |
| `eventType`      | Full event name (e.g. `clinical.observation.resulted`)   |
| `timestamp`      | UTC time of event                                        |
| `actorId`        | Identity of the user or system                           |
| `actorType`      | practitioner, patient, system, admin                     |
| `purposeOfUse`   | Declared purpose (TREAT, HPAYMT, etc.)                   |
| `resourceType`   | FHIR resource type affected                              |
| `resourceId`     | ID of the affected resource                              |
| `patientId`      | Patient in context (if applicable)                       |
| `tenantId`       | Organisation scope                                       |
| `outcome`        | success, failure, partialSuccess                         |
| `ipAddress`      | Source IP (where available)                              |

### 5.3 Break-Glass Audit Requirements

Break-glass events carry additional obligations beyond the standard audit record:

1. The override reason MUST be captured in a free-text field (minimum 10 characters).
2. The event MUST trigger an immediate notification to the designated Privacy Officer.
3. A post-hoc review MUST be completed within 24 hours.
4. The audit record is flagged as `highRisk: true` and placed in an immutable, separately retained store.
5. Multiple break-glass events by the same actor within a 24-hour window trigger an automatic escalation alert.

### 5.4 Audit Record Immutability

- Audit records are **append-only**; no UPDATE or DELETE operations are permitted.
- Records are cryptographically signed at write time.
- A hash-chain links sequential records to detect tampering.
- Audit records reside in a dedicated store separate from transactional data.
- Access to the audit store is itself audited.
