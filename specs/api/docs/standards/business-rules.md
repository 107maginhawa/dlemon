# Business Rules

Formal business rules for the Monobase Healthcare API. Each entity section defines the status lifecycle, transition guards, field mutability, invariants, and temporal constraints. This document is authoritative for validation logic and state machine implementation.

---

## Notation

State machines use the following text notation:

```
[StateA] --guard--> [StateB]
```

Where `guard` is the condition that must be satisfied for the transition to be allowed. A missing guard means the transition is unconditionally allowed (subject to the actor's authorization).

---

## Encounter

### Status Lifecycle FSM

```
[planned] --appointment exists or direct schedule--> [arrived]
[arrived] --triage initiated--> [triaged]
[arrived] --no triage pathway--> [inProgress]
[triaged] --clinician assigned--> [inProgress]
[inProgress] --care complete--> [finished]
[planned] --cancelled before arrival--> [cancelled]
[arrived] --patient leaves without being seen--> [cancelled]
[inProgress] --patient leaves against medical advice--> [finished]
[inProgress] --patient transferred--> [finished] (new Encounter created with partOf)
[any non-terminal] --administrative error--> [entered-in-error]
```

**Terminal states:** `finished`, `cancelled`, `entered-in-error`

### Transition Guards

| From | To | Guards |
|---|---|---|
| planned | arrived | Patient identity verified; Encounter.subject is active Patient |
| arrived | triaged | At least one Practitioner participant assigned |
| triaged | inProgress | At least one Practitioner participant with type=PART assigned |
| inProgress | finished | At least one `Encounter.diagnosis` present; Encounter.period.end is set |
| any | cancelled | No billing has been initiated (no ChargeItems linked) OR a reversal is created |
| any | entered-in-error | Requestor has admin role; no dependent clinical data created, OR all dependent data marked entered-in-error |

### Field Mutability Rules

| Field | Mutable After Creation | Notes |
|---|---|---|
| `subject` | Immutable | Patient identity cannot change after creation |
| `class` | Immutable | Encounter class (ambulatory, inpatient) cannot change; create a new Encounter for reclassification |
| `type` | Mutable (draft/planned only) | Cannot change after status=arrived |
| `status` | Mutable (via transition API only) | Direct writes rejected; use transitionEncounterStatus operation |
| `period.start` | Immutable after arrived | Set on first arrival |
| `period.end` | Set only on finish | Cannot be set while status is active |
| `participant` | Mutable | Can add/change participants throughout |
| `diagnosis` | Mutable | Can add/modify diagnoses throughout encounter |
| `hospitalization` | Mutable until finished | discharge disposition set on finish |

### Invariants

- INV-ENC-001: `period.start` MUST be before `period.end` (when both are present)
- INV-ENC-002: At least one `diagnosis` entry MUST exist before transitioning to `finished`
- INV-ENC-003: `subject` MUST reference an active Patient resource (Patient.active = true)
- INV-ENC-004: `class` MUST be bound to v3 ActCode (AMB, IMP, EMER, VR, HH, etc.)
- INV-ENC-005: For inpatient Encounters, `hospitalization.admitSource` MUST be present when status = inProgress
- INV-ENC-006: `participant` with type=ATND (attending) MUST be present before status = inProgress

### Temporal Constraints

- `period.start` MUST NOT be more than 24 hours in the future (planned encounters excluded)
- `period.end` MUST NOT be before `period.start`
- All `Observation.effectiveDateTime` values linked to this Encounter MUST fall within `period.start` and `period.end` (or `period.end` may be open)

---

## Appointment

### Status Lifecycle FSM

```
[proposed] --requester or scheduler accepts--> [pending]
[pending] --all participants accept--> [booked]
[booked] --patient arrives--> [arrived]
[arrived] --encounter created--> [fulfilled]
[booked] --patient cancels--> [cancelled]
[booked] --provider cancels--> [cancelled]
[booked] --patient does not arrive--> [noshow]
[proposed] --declined--> [cancelled]
[any non-terminal] --administrative error--> [entered-in-error]
```

**Terminal states:** `fulfilled`, `cancelled`, `noshow`, `entered-in-error`

### Transition Guards

| From | To | Guards |
|---|---|---|
| proposed | pending | At least one participant has accepted |
| pending | booked | All required participants have status=accepted; start < end |
| booked | arrived | Current time >= start - 30 minutes (configurable check-in window) |
| arrived | fulfilled | An Encounter with serviceType matching appointment exists and is active |
| booked | cancelled | Cancellation reason MUST be provided |
| booked | noshow | Current time > end (appointment window has passed) |

### Invariants

- INV-APPT-001: `start` MUST be before `end`
- INV-APPT-002: At least one `participant` MUST be present
- INV-APPT-003: At least one participant with type=ATND MUST have status=accepted before transitioning to booked
- INV-APPT-004: `serviceType` or `appointmentType` MUST be present
- INV-APPT-005: `participant.actor` MUST reference an active resource (Patient, Practitioner, Location)

### Field Mutability Rules

| Field | Mutable After Creation |
|---|---|
| `start` / `end` | Mutable until booked; use reschedule flow after booked |
| `participant` | Mutable until booked |
| `status` | Via transition API only |
| `serviceType` | Immutable after booked |
| `cancellationReason` | Set only when transitioning to cancelled |

---

## MedicationRequest

### Status Lifecycle FSM

```
[draft] --prescriber signs--> [active]
[active] --prescriber pauses--> [on-hold]
[on-hold] --prescriber resumes--> [active]
[active] --course complete--> [completed]
[active] --prescriber stops--> [stopped]
[draft] --prescriber discards--> [cancelled]
[active] --prescriber revokes--> [cancelled]
[any non-terminal] --data entry error--> [entered-in-error]
```

**Terminal states:** `completed`, `cancelled`, `stopped`, `entered-in-error`

### Transition Guards

| From | To | Guards |
|---|---|---|
| draft | active | Prescriber has valid PractitionerRole with prescribing authority; medication is not contraindicated per AllergyIntolerance |
| active | on-hold | Reason for hold MUST be documented |
| on-hold | active | Clinical review documented |
| active | stopped | Stop reason (statusReasonCode) MUST be provided |
| completed | active | FORBIDDEN — completed orders cannot be reopened; create a new MedicationRequest |
| stopped | active | FORBIDDEN — stopped orders cannot be reopened |

### Field Mutability Rules

| Field | Mutable After Creation |
|---|---|
| `subject` | Immutable |
| `medication[x]` | Immutable after status=active |
| `requester` | Immutable after status=active |
| `dosageInstruction` | Mutable while active (creates revision record) |
| `dispenseRequest` | Mutable while active |
| `priorPrescription` | Mutable while draft only |
| `authoredOn` | Immutable |

### Invariants

- INV-MR-001: MUST have either `medicationCodeableConcept` OR `medicationReference` — never both, never neither
- INV-MR-002: `subject` MUST reference an active Patient
- INV-MR-003: `requester` MUST reference an active Practitioner or PractitionerRole
- INV-MR-004: `authoredOn` MUST NOT be in the future
- INV-MR-005: If `dispenseRequest.numberOfRepeatsAllowed` > 0, `intent` MUST be `original-order` or `reflex-order`
- INV-MR-006: `dosageInstruction` MUST contain at least one entry when status=active

---

## ServiceRequest

### Status Lifecycle FSM

```
[draft] --ordering provider signs--> [active]
[active] --performed--> [completed]
[active] --revoked before performance--> [revoked]
[draft] --discarded--> [revoked]
[active] --no longer applicable--> [entered-in-error]
[any non-terminal] --data entry error--> [entered-in-error]
```

**Terminal states:** `completed`, `revoked`, `entered-in-error`

### Transition Guards

| From | To | Guards |
|---|---|---|
| draft | active | `requester` references active Practitioner/PractitionerRole; `subject` is active Patient |
| active | completed | A DiagnosticReport or Procedure exists referencing this ServiceRequest |
| active | revoked | Reason for revocation MUST be documented |

### Invariants

- INV-SR-001: `subject` MUST reference an active Patient or Group
- INV-SR-002: `requester` MUST reference an active Practitioner, PractitionerRole, or Organization
- INV-SR-003: `code` MUST be present and bound to an appropriate clinical terminology (LOINC for labs, SNOMED for procedures, CPT for billing)
- INV-SR-004: If `priority=stat`, `authoredOn` MUST be within the last 24 hours

---

## Claim

### Status Lifecycle FSM

```
[draft] --submitter finalizes--> [active]
[active] --submitted to payer--> [active] (payer transmission is a side effect, not a status change)
[active] --payer responds--> [adjudicated] (ClaimResponse created)
[draft] --abandoned--> [cancelled]
[active] --retracted before adjudication--> [cancelled]
[adjudicated] --error found--> [entered-in-error] (new corrected Claim created)
```

**Terminal states:** `cancelled`, `entered-in-error` (adjudicated is semi-terminal — can be followed by new Claim for corrections)

### Transition Guards

| From | To | Guards |
|---|---|---|
| draft | active | At least one `diagnosis` present; at least one `item` present; `patient` and `insurer` references valid; `billablePeriod` set |
| active | cancelled | No ClaimResponse linked (not yet adjudicated) |
| adjudicated | — | Cannot be directly changed; create replacement Claim |

### Invariants

- INV-CLM-001: `total` MUST equal the sum of `item[*].net` values
- INV-CLM-002: At least one `diagnosis` MUST be present when status=active
- INV-CLM-003: At least one `item` MUST be present when status=active
- INV-CLM-004: `patient` MUST reference an active Patient
- INV-CLM-005: `insurer` MUST reference an active Organization
- INV-CLM-006: `billablePeriod.start` MUST be before `billablePeriod.end`
- INV-CLM-007: `item[*].servicedDate` or `item[*].servicedPeriod` MUST fall within or equal `billablePeriod`

---

## PriorAuthorization

### Status Lifecycle FSM

```
[draft] --provider submits--> [active]
[active] --payer approves--> [approved] (ClaimResponse with outcome=complete)
[active] --payer denies--> [denied] (ClaimResponse with outcome=error)
[active] --payer requests more info--> [pended]
[pended] --provider provides info--> [active]
[approved] --expired--> [expired] (based on ClaimResponse.preAuthPeriod.end)
[draft] --abandoned--> [cancelled]
[any non-terminal] --error--> [entered-in-error]
```

**Terminal states:** `denied`, `expired`, `cancelled`, `entered-in-error`

### Transition Guards

| From | To | Guards |
|---|---|---|
| draft | active | `use=preauthorization`; at least one diagnosis and one item; Coverage reference valid |
| pended | active | Supporting information added (`supportingInfo`) |
| approved | expired | Current date > `ClaimResponse.preAuthPeriod.end` |

### Invariants

- INV-PA-001: `use` MUST be `preauthorization`
- INV-PA-002: `insurance[*].coverage` MUST reference an active Coverage with active patient
- INV-PA-003: `item[*].productOrService` MUST be present

---

## Task

### Status Lifecycle FSM

```
[draft] --task issued--> [requested]
[requested] --assigned to owner--> [accepted]
[requested] --owner declines--> [rejected]
[accepted] --work begins--> [in-progress]
[in-progress] --work complete--> [completed]
[in-progress] --work paused--> [on-hold]
[on-hold] --work resumed--> [in-progress]
[requested] --cancelled before acceptance--> [cancelled]
[accepted] --requester cancels--> [cancelled]
[in-progress] --requester cancels--> [cancelled]
[any non-terminal] --error--> [entered-in-error]
[any] --nullified--> [failed]
```

**Terminal states:** `completed`, `cancelled`, `rejected`, `failed`, `entered-in-error`

### Transition Guards

| From | To | Guards |
|---|---|---|
| requested | accepted | `owner` is set and references an active Practitioner, PractitionerRole, or Organization |
| accepted | in-progress | `executionPeriod.start` is set |
| in-progress | completed | `output` contains required outputs (if `Task.output` is defined in the Task template) |
| in-progress | on-hold | Reason MUST be provided in `statusReason` |

### Invariants

- INV-TASK-001: `focus` or `for` MUST be present (Task must reference something it acts on or is for)
- INV-TASK-002: `authoredOn` MUST NOT be in the future
- INV-TASK-003: `executionPeriod.start` MUST be before `executionPeriod.end` when both are set
- INV-TASK-004: `priority` MUST be one of: routine, urgent, asap, stat

---

## Composition

### Status Lifecycle FSM

```
[preliminary] --author completes draft--> [final]
[final] --amendment required--> [amended]
[amended] --new amendment--> [amended]
[preliminary] --error--> [entered-in-error]
[final] --retraction--> [entered-in-error]
```

**Terminal states:** `entered-in-error` (final and amended persist as historical records)

### Transition Guards

| From | To | Guards |
|---|---|---|
| preliminary | final | At least one `section` with content present; at least one `attester` with mode=legal; `date` set |
| final | amended | `relatesTo` entry with code=replaces pointing to the previous version MUST be added |
| any | entered-in-error | Admin role required; a Provenance record MUST be created |

### Field Mutability Rules

| Field | Mutable After Creation |
|---|---|
| `type` | Immutable |
| `subject` | Immutable |
| `author` | Immutable after final |
| `section` | Mutable while preliminary; amendment required after final |
| `attester` | Mutable until final |
| `date` | Set automatically; immutable after final |

### Invariants

- INV-COMP-001: At least one `section` MUST be present before transitioning to `final`
- INV-COMP-002: `subject` MUST reference an active Patient
- INV-COMP-003: `author` MUST reference an active Practitioner or PractitionerRole
- INV-COMP-004: `type` MUST be bound to LOINC document type codes

---

## Consent

### Status Lifecycle FSM

```
[draft] --patient signs--> [active]
[active] --patient revokes--> [inactive]
[inactive] --patient reinstates--> [active]
[draft] --discarded--> [entered-in-error]
[active] --rejected by review--> [rejected]
[any] --administrative error--> [entered-in-error]
```

**Terminal states:** `rejected`, `entered-in-error`

### Transition Guards

| From | To | Guards |
|---|---|---|
| draft | active | `patient` reference valid; `dateTime` set; at least one `provision` defined; `scope` and `category` set |
| active | inactive | Revocation reason documented in `provision` |
| inactive | active | New `dateTime` set; documented reason for reinstatement |

### Invariants

- INV-CON-001: `patient` MUST reference an active Patient
- INV-CON-002: `scope` MUST be present (patient-privacy, treatment, research, adr)
- INV-CON-003: `category` MUST be present with at least one entry
- INV-CON-004: When status=active, `provision` MUST be present

---

## EpisodeOfCare

### Status Lifecycle FSM

```
[planned] --referral or intake complete--> [waitlist]
[waitlist] --care begins--> [active]
[planned] --care begins immediately--> [active]
[active] --temporarily suspended--> [onhold]
[onhold] --care resumes--> [active]
[active] --care program complete--> [finished]
[active] --patient withdraws--> [cancelled]
[planned] --not needed--> [cancelled]
[any] --error--> [entered-in-error]
```

**Terminal states:** `finished`, `cancelled`, `entered-in-error`

### Transition Guards

| From | To | Guards |
|---|---|---|
| planned | active | `patient` is active; `managingOrganization` is present; at least one `diagnosis` |
| active | finished | `period.end` is set |
| active | onhold | `statusHistory` entry added with reason |

### Invariants

- INV-EOC-001: `patient` MUST reference an active Patient
- INV-EOC-002: `managingOrganization` MUST be present when status=active
- INV-EOC-003: `period.start` MUST be present when status=active or finished
- INV-EOC-004: `period.end` MUST be present when status=finished
- INV-EOC-005: All linked Encounters MUST have `subject` equal to `EpisodeOfCare.patient`

---

## Cross-Entity Rules

These rules span multiple resource types and must be enforced at the API layer.

### Temporal Cross-Entity Rules

| Rule ID | Rule |
|---|---|
| XENT-T-001 | `Encounter.period.start` MUST be before `Encounter.period.end` |
| XENT-T-002 | `Observation.effectiveDateTime` MUST be within `Encounter.period` for Observations linked to an Encounter context |
| XENT-T-003 | `MedicationRequest.authoredOn` MUST NOT be in the future |
| XENT-T-004 | `Appointment.start` MUST be before `Appointment.end` |
| XENT-T-005 | `Claim.billablePeriod` MUST overlap with the `Encounter.period` of the encounters being billed |
| XENT-T-006 | `Consent.dateTime` MUST NOT be in the future |
| XENT-T-007 | `EpisodeOfCare.period` MUST encompass all linked `Encounter.period` ranges |
| XENT-T-008 | `Goal.startDate` MUST be before `Goal.target.dueDate` when both are present |
| XENT-T-009 | `Immunization.occurrenceDateTime` MUST NOT be in the future |
| XENT-T-010 | `Procedure.performed[x]` MUST NOT be more than 1 year in the future for scheduled procedures |

### Mutual Exclusion Constraints

These constraints define fields where exactly one of two options must be chosen.

| Rule ID | Resource | Field A | Field B | Rule |
|---|---|---|---|---|
| MEX-001 | Observation | `effectiveDateTime` | `effectivePeriod` | Exactly one MUST be present; never both |
| MEX-002 | MedicationRequest | `medicationCodeableConcept` | `medicationReference` | Exactly one MUST be present; never both |
| MEX-003 | Procedure | `performedDateTime` | `performedPeriod` | At most one may be present |
| MEX-004 | ServiceRequest | `occurrenceDateTime` | `occurrencePeriod` | At most one may be present |
| MEX-005 | Condition | `onsetDateTime` | `onsetPeriod` | At most one onset type may be present |
| MEX-006 | Condition | `abatementDateTime` | `abatementPeriod` | At most one abatement type may be present |
| MEX-007 | Observation | `valueQuantity` | `valueCodeableConcept` | At most one value type may be present (value[x] polymorphism) |
| MEX-008 | Claim | `diagnosis[*].diagnosisCodeableConcept` | `diagnosis[*].diagnosisReference` | Exactly one per diagnosis entry |

### Referential Integrity Rules

| Rule ID | Source | Reference | Constraint |
|---|---|---|---|
| REF-001 | `Encounter.subject` | `Patient` | MUST reference an active Patient (Patient.active = true) |
| REF-002 | `ServiceRequest.requester` | `Practitioner` / `PractitionerRole` | MUST reference an active Practitioner or PractitionerRole |
| REF-003 | `MedicationRequest.requester` | `Practitioner` / `PractitionerRole` | MUST reference an active Practitioner or PractitionerRole |
| REF-004 | `Observation.subject` | `Patient` | MUST reference an existing Patient |
| REF-005 | `Claim.patient` | `Patient` | MUST reference an active Patient |
| REF-006 | `Claim.insurance[*].coverage` | `Coverage` | MUST reference an active Coverage resource |
| REF-007 | `Composition.subject` | `Patient` | MUST reference an active Patient |
| REF-008 | `Consent.patient` | `Patient` | MUST reference an active Patient |
| REF-009 | `EpisodeOfCare.patient` | `Patient` | MUST reference an active Patient |
| REF-010 | `Encounter.episodeOfCare` | `EpisodeOfCare` | If present, EpisodeOfCare.patient MUST equal Encounter.subject |
| REF-011 | `Task.owner` | `Practitioner` / `Organization` | MUST reference an active assignable entity |
| REF-012 | `AllergyIntolerance.patient` | `Patient` | MUST reference an active Patient |

---

## Validation Severity Levels

Business rules are enforced at three severity levels:

| Level | Code | Description | API Behavior |
|---|---|---|---|
| Error | `error` | Invariant violation — data cannot be persisted | 422 Unprocessable Entity with OperationOutcome |
| Warning | `warning` | Rule violation that may indicate a problem but is not blocking | 200/201 with OperationOutcome warnings in response |
| Information | `information` | Advisory note about a business rule | 200/201 with OperationOutcome informational |

All invariants (INV-*) are enforced as errors. Cross-entity temporal rules (XENT-T-*) may be warnings for historical data imports. Referential integrity rules (REF-*) are errors for writes and warnings for bulk imports.
