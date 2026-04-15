# Data Quality Policy — Monobase Healthcare API Standards Foundation

**Document ID**: MHASF-STD-009
**Version**: 1.0.0
**Status**: Active
**Last Updated**: 2026-04-14

---

## Table of Contents

1. [UTC Storage Policy](#utc-storage-policy)
2. [Effective Time vs Recorded Time](#effective-time-vs-recorded-time)
3. [Partial Date Handling](#partial-date-handling)
4. [Null Semantics and DataAbsentReason](#null-semantics-and-dataabsentreason)
5. [Unit-of-Measure Rules](#unit-of-measure-rules)
6. [Naming Conventions](#naming-conventions)
7. [State and Status Conventions](#state-and-status-conventions)

---

## 1. UTC Storage Policy

### 1.1 Rule

**All `utcDateTime` fields are stored and transmitted in UTC.** The server never assumes, infers, or stores timezone offsets for datetime fields that use the `utcDateTime` type.

### 1.2 Wire Format

UTC datetimes are serialised as ISO 8601 strings with explicit `Z` suffix:

```
2026-04-14T08:32:00Z
2026-04-14T08:32:00.000Z
```

Offset notation (e.g. `+10:00`) is accepted on inbound requests and immediately converted to UTC before storage. The stored and returned value is always UTC (`Z`).

### 1.3 Client Responsibilities

- Display timezone conversion is the responsibility of the client application.
- Clients should use the patient's or facility's local timezone for display.
- The timezone context (patient timezone, facility timezone) is available on the `Location` and `Patient` resources as an extension field.

### 1.4 What the Server Does Not Do

| Server behaviour          | Status         | Notes                                              |
|---------------------------|----------------|----------------------------------------------------|
| Store timezone offsets    | Not done       | UTC only                                           |
| Convert for display       | Not done       | Client responsibility                              |
| Assume local timezone     | Never          | Would create ambiguous data                        |
| Accept unzoned datetimes  | Rejected       | HTTP 422 returned for ISO 8601 without Z or offset |

### 1.5 TypeSpec Declaration

```typescript
model Encounter {
  /** UTC time when the encounter began */
  start: utcDateTime;

  /** UTC time when the encounter ended. Absent if encounter is ongoing. */
  end?: utcDateTime;
}
```

---

## 2. Effective Time vs Recorded Time

### 2.1 Definitions

| Field Name             | Type         | Meaning                                                                   |
|------------------------|--------------|---------------------------------------------------------------------------|
| `effectiveDateTime`    | utcDateTime  | When the clinical event actually occurred in the real world               |
| `createdAt`            | utcDateTime  | When the record was first persisted in the system                         |
| `updatedAt`            | utcDateTime  | When the record was last modified                                         |
| `recordedDate`         | utcDateTime  | When the information was formally documented (may differ from effective)  |

### 2.2 Why They Differ

In healthcare, documentation frequently occurs after the fact:

- A nurse administers a medication at 14:00 but documents it at 16:30 (`effectiveDateTime: 14:00`, `createdAt: 16:30`).
- A patient reports a past condition during a new encounter. The condition onset is months ago (`effectiveDateTime: past date`, `createdAt: today`).
- A practitioner retrospectively adds a diagnosis from a prior encounter.

**Systems must never use `createdAt` as a proxy for clinical occurrence time.** Clinical queries use `effectiveDateTime`; audit queries use `createdAt`.

### 2.3 Guidance per Resource

| Resource             | Effective Time Field       | Recorded Time Field | Notes                                       |
|----------------------|----------------------------|---------------------|---------------------------------------------|
| Observation          | `effectiveDateTime`        | `issued`            | `issued` = when result was released         |
| Condition            | `onsetDateTime`            | `recordedDate`      | Onset may predate the encounter             |
| Procedure            | `performedDateTime`        | `recorded`          | Performance may differ from documentation   |
| MedicationAdministration | `effectiveDateTime`   | `recorded`          |                                             |
| Immunization         | `occurrenceDateTime`       | `recorded`          |                                             |
| DiagnosticReport     | `effectiveDateTime`        | `issued`            |                                             |
| AllergyIntolerance   | `onsetDateTime`            | `recordedDate`      | Onset may be self-reported from memory      |

### 2.4 Audit Implication

Audit logs record both timestamps:

- `effectiveDateTime` or equivalent: when the clinical event occurred.
- `createdAt`: when the audit trail entry was written.
- If `createdAt` minus `effectiveDateTime` exceeds a configurable threshold (default: 24 hours), the record is flagged as `retrospectiveEntry: true` for review.

---

## 3. Partial Date Handling

### 3.1 Full Date Fields

Fields typed as `plainDate` use `YYYY-MM-DD` format (ISO 8601 date-only):

```typescript
birthDate: plainDate;     // "2000-03-15"
serviceDate: plainDate;   // "2026-04-14"
```

### 3.2 Partial Date Handling

When only partial date information is known, use a `string` field with a `@pattern` annotation specifying the allowed formats. Partial dates are never coerced to full dates (e.g. `YYYY` is never stored as `YYYY-01-01`).

```typescript
/** Partial date — YYYY, YYYY-MM, or YYYY-MM-DD */
@pattern("^\\d{4}(-\\d{2}(-\\d{2})?)?$")
onsetString?: string;
```

### 3.3 When Partial Dates Are Acceptable

| Resource                | Field                   | Allowed Partial Forms        | Rationale                                      |
|-------------------------|-------------------------|------------------------------|------------------------------------------------|
| `FamilyMemberHistory`   | `bornDate`              | YYYY, YYYY-MM, YYYY-MM-DD    | Patients often know only year or year-month    |
| `FamilyMemberHistory`   | `deceasedDate`          | YYYY, YYYY-MM, YYYY-MM-DD    | Same as above                                  |
| `Condition`             | `onsetString`           | YYYY, YYYY-MM, YYYY-MM-DD    | Chronic condition onset often approximate      |
| `Condition`             | `abatementString`       | YYYY, YYYY-MM, YYYY-MM-DD    | Approximate remission date                     |
| `AllergyIntolerance`    | `onsetString`           | YYYY, YYYY-MM, YYYY-MM-DD    | Historical allergies with imprecise dates      |
| `Patient`               | `birthDate`             | YYYY, YYYY-MM, YYYY-MM-DD    | Some countries permit year-only birth records  |

### 3.4 Partial Dates Are Not Allowed

| Field Type               | Partial Dates Prohibited | Reason                                         |
|--------------------------|--------------------------|------------------------------------------------|
| `effectiveDateTime`      | Yes                      | Clinical precision required                    |
| `Appointment.start`      | Yes                      | Scheduling requires full datetime              |
| `Appointment.end`        | Yes                      | Scheduling requires full datetime              |
| `Claim.billablePeriod`   | Yes                      | Billing requires complete date range           |
| `Coverage.period`        | Yes                      | Insurance validity requires full dates         |

---

## 4. Null Semantics and DataAbsentReason

### 4.1 Problem Statement

The absence of a value in an API response is ambiguous: does the server not have the value, was it intentionally not collected, is it masked for privacy, or does it not apply? The `DataAbsentReason` enum resolves this ambiguity.

### 4.2 DataAbsentReason Enum

| Code               | Meaning                                                                             | Example Use Case                                    |
|--------------------|-------------------------------------------------------------------------------------|-----------------------------------------------------|
| `unknown`          | The value exists but is not known to the system                                     | Vital sign was taken but not yet entered            |
| `asked-unknown`    | Patient was asked but could not provide the information                             | Patient unsure of medication dose                   |
| `temp-unknown`     | Value expected but not yet available (pending lab result)                           | Lab ordered but specimen not yet processed          |
| `not-asked`        | The question was not posed during this encounter                                    | Social history not assessed in emergency setting    |
| `asked-declined`   | Patient was asked and actively refused to provide the information                   | Patient declined to state ethnicity                 |
| `masked`           | Value exists and is known but is suppressed from this response due to access control| Sensitive field hidden from non-privileged requester |
| `not-applicable`   | The concept does not apply to this patient or context                               | Pregnancy status on a male patient                  |
| `unsupported`      | The system does not support capturing this type of information                      | Genomic data not supported by this implementation  |
| `as-text`          | Information is present as free text in a sibling field rather than coded value      | Diagnosis in `text` field, no code available        |
| `error`            | An error occurred preventing the value from being obtained                          | Device reading failed                               |
| `not-performed`    | The action was not performed, so no result exists                                   | Procedure was not done                              |
| `negative-infinity`| The numeric value is effectively negative infinity                                 | Mathematical edge case                              |
| `positive-infinity`| The numeric value is effectively positive infinity                                 | Mathematical edge case                              |

### 4.3 When to Use DataAbsentReason

`DataAbsentReason` is used when a field is typed as potentially absent AND the reason for absence is clinically or administratively significant.

**Required use:**

- `Observation.value[x]` — when no measurement value is present, `dataAbsentReason` must explain why.
- `Observation.component.value[x]` — same rule for component observations.

**Recommended use:**

- Any `?` (optional) field in a clinical resource where the reason for absence may affect care decisions.

**Not used for:**

- Administrative fields where absence is unremarkable (e.g. `Appointment.comment`).
- Fields that are genuinely inapplicable by design (model structure already communicates this).

### 4.4 Unknown vs Not-Asked vs Not-Applicable

These three codes are commonly confused:

| Scenario                                    | Correct Code      | Incorrect Code        |
|---------------------------------------------|-------------------|-----------------------|
| Patient was asked smoking status; couldn't recall | `asked-unknown` | `unknown`           |
| Smoking status was never addressed this visit | `not-asked`     | `unknown`             |
| Asking smoking status of a newborn          | `not-applicable`  | `not-asked`           |
| System error prevented capture              | `error`           | `unknown`             |
| Patient refused to answer                   | `asked-declined`  | `unknown`             |

### 4.5 Implementation Pattern

```typescript
model Observation {
  /** The result value. Exactly one of value[x] or dataAbsentReason must be present. */
  value?: ObservationValue;

  /** Reason value is absent. Required when value is not present. */
  dataAbsentReason?: DataAbsentReason;
}
```

The API validates that exactly one of `value` or `dataAbsentReason` is present for required observation types.

---

## 5. Unit-of-Measure Rules

### 5.1 Standard

**UCUM (Unified Code for Units of Measure) is the required standard for all quantity fields.** No custom or free-text unit strings are permitted. The UCUM system URI is `http://unitsofmeasure.org`.

### 5.2 TypeSpec Declaration

```typescript
model Quantity {
  value:  float64;
  unit:   string;    // UCUM code, e.g. "kg"
  system: string;    // Must be "http://unitsofmeasure.org"
  code:   string;    // Canonical UCUM code, same as unit in most cases
}
```

### 5.3 Common Clinical Units Reference

| Measurement           | UCUM Code        | Notes                                            |
|-----------------------|------------------|--------------------------------------------------|
| Body weight           | `kg`             | SI unit; `[lb_av]` permitted for US locale       |
| Body height           | `cm`             | SI unit; `[in_i]` permitted for US locale        |
| Body temperature      | `Cel`            | Celsius; `[degF]` permitted for US locale        |
| Blood pressure        | `mm[Hg]`         | Both systolic and diastolic                      |
| Heart rate            | `/min`           | Beats per minute                                 |
| Respiratory rate      | `/min`           | Breaths per minute                               |
| Oxygen saturation     | `%`              | SpO2                                             |
| Blood glucose         | `mg/dL`          | US; `mmol/L` for SI countries                   |
| Haemoglobin           | `g/dL`           |                                                  |
| Creatinine            | `mg/dL`          | US; `umol/L` for SI countries                   |
| eGFR                  | `mL/min/{1.73_m2}`|                                                 |
| Volume (medication)   | `mL`             |                                                  |
| Mass (medication)     | `mg`, `g`, `ug`  | Micrograms use `ug`, not `mcg`                   |
| International units   | `[iU]`           | For insulin, vitamins, etc.                      |
| Concentration         | `mg/mL`          |                                                  |
| Frequency (dosing)    | `/d`, `/wk`, `/mo`| Per day, per week, per month                    |
| Duration              | `h`, `min`, `s`, `d`, `wk`, `mo`, `a` | Hours through years        |
| Count                 | `1`              | Dimensionless count (tablets, units)             |

### 5.4 Validation

- `Quantity.system` must equal `http://unitsofmeasure.org` when present.
- `Quantity.code` must be a syntactically valid UCUM expression.
- For vital sign profiles, the UCUM code must match the expected unit for that LOINC code.
- Invalid UCUM codes return HTTP 422 with `code: "invalid-ucum-unit"`.

### 5.5 Unit Conversion

The API does not perform unit conversion. Clients submitting data in non-SI units (e.g. pounds) use the appropriate UCUM code for that unit. Conversion for display or analytics is a client or reporting-layer responsibility.

---

## 6. Naming Conventions

### 6.1 Field Names (camelCase)

All JSON field names and TypeSpec model properties use camelCase:

```
patientId        ✓
PatientId        ✗
patient_id       ✗
patient-id       ✗
```

Examples: `birthDate`, `effectiveDateTime`, `telecom`, `managingOrganization`, `dataAbsentReason`

### 6.2 Model and Enum Names (PascalCase)

TypeSpec model types, interfaces, and enums use PascalCase:

```
Patient                  ✓
Encounter                ✓
DataAbsentReason         ✓
EncounterStatus          ✓
patient                  ✗
encounterStatus          ✗
```

### 6.3 URL Paths (kebab-case)

REST API paths use kebab-case for multi-word path segments:

```
/api/v3/diagnostic-reports        ✓
/api/v3/diagnosticReports         ✗
/api/v3/DiagnosticReports         ✗
/api/v3/diagnostic_reports        ✗
```

Resource type names in paths match the FHIR resource name in kebab-case:

| FHIR Resource       | URL Path Segment        |
|---------------------|-------------------------|
| Patient             | `/patient`              |
| MedicationRequest   | `/medication-request`   |
| DiagnosticReport    | `/diagnostic-report`    |
| AllergyIntolerance  | `/allergy-intolerance`  |
| ServiceRequest      | `/service-request`      |

### 6.4 Event Names (dot-separated, lowercase)

Events use the three-part dot-separated format with all-lowercase segments:

```
clinical.encounter.started       ✓
Clinical.Encounter.Started       ✗
clinical_encounter_started       ✗
```

### 6.5 Enum Values (camelCase)

Enum member values use camelCase:

```typescript
enum EncounterStatus {
  planned,
  arrived,
  triaged,
  inProgress,   // ✓ camelCase
  onLeave,
  finished,
  cancelled,
}
```

Do not use:
- `PLANNED`, `IN_PROGRESS` (SCREAMING_SNAKE_CASE)
- `Planned`, `InProgress` (PascalCase)

### 6.6 Summary Table

| Context              | Convention    | Example                              |
|----------------------|---------------|--------------------------------------|
| JSON field name      | camelCase     | `effectiveDateTime`                  |
| TypeSpec model/enum  | PascalCase    | `MedicationRequest`                  |
| URL path segment     | kebab-case    | `/medication-request`                |
| Event name           | dot.lower     | `clinical.encounter.started`         |
| Enum value           | camelCase     | `inProgress`                         |
| TypeSpec namespace   | PascalCase    | `namespace Healthcare.Clinical`      |
| File name            | kebab-case    | `medication-request.tsp`             |

---

## 7. State and Status Conventions

### 7.1 Every Stateful Resource Defines an Enum

Any resource with a lifecycle must define a status enum. The enum name follows `{ResourceName}Status`:

```typescript
enum EncounterStatus { planned, arrived, triaged, inProgress, onLeave, finished, cancelled }
enum ServiceRequestStatus { draft, active, onHold, completed, revoked }
enum AppointmentStatus { proposed, pending, booked, arrived, fulfilled, cancelled, noShow }
```

### 7.2 Terminal States

Terminal states are irreversible. Once a resource reaches a terminal state, no further status transitions are permitted. The API returns HTTP 409 Conflict for any attempt to transition out of a terminal state.

**Universal terminal states:**

| State             | Applies To                            | Meaning                                             |
|-------------------|---------------------------------------|-----------------------------------------------------|
| `completed`       | Most clinical resources               | Successfully finished; no further action expected   |
| `cancelled`       | Most resources                        | Explicitly terminated before completion             |
| `enteredInError`  | All resources                         | Record was created in error; treated as soft-delete |
| `fulfilled`       | Appointment                           | Appointment occurred as planned                     |
| `stopped`         | MedicationRequest                     | Medication discontinued by clinician                |
| `revoked`         | ServiceRequest                        | Order withdrawn after being active                  |
| `failed`          | Task                                  | Task could not be completed                         |
| `denied`          | PriorAuth, Claim                      | Payer refused                                       |
| `paid`            | Claim                                 | Payment posted                                      |
| `expired`         | PriorAuth                             | Authorization window elapsed                        |
| `noShow`          | Appointment                           | Patient did not attend                              |

### 7.3 enteredInError as Soft Delete

`enteredInError` is the only form of deletion for clinical resources. Hard deletes are not permitted on any resource that has ever been used in a clinical context.

When a resource is set to `enteredInError`:
- The record remains readable to auditors and administrators.
- The record is excluded from all default search results (unless `_tag=entered-in-error` is specified).
- Downstream resources that referenced it display a visual indicator that the referenced resource is in error.
- An audit event `{domain}.{entity}.deleted` is emitted with the actor and reason.

### 7.4 Status Transition Enforcement

Status transitions are enforced at the API layer against the defined state machines. The state machine for each resource is declared in `core/state-machines.tsp` and referenced by the API operation handlers.

Illegal transition attempt response:

```json
HTTP 409 Conflict
{
  "error": {
    "code": "invalid-state-transition",
    "message": "Cannot transition Encounter from 'finished' to 'inProgress'. 'finished' is a terminal state.",
    "currentStatus": "finished",
    "requestedStatus": "inProgress",
    "resourceType": "Encounter",
    "resourceId": "enc-0049912"
  }
}
```

### 7.5 Status History

Resources that have undergone status changes maintain a `statusHistory` array. This provides an audit-accessible timeline of state transitions without querying the audit log.

```typescript
model StatusHistoryEntry {
  status:  string;      // The status at this point
  period:  Period;      // start: when this status began; end: when it ended
}
```
