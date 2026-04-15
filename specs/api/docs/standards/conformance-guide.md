# Conformance and Validation Guide — Monobase Healthcare API Standards Foundation

**Document ID**: MHASF-STD-007
**Version**: 1.0.0
**Status**: Active
**Last Updated**: 2026-04-14

---

## Table of Contents

1. [Conformance Levels](#conformance-levels)
2. [Required Fields per Conformance Level](#required-fields-per-conformance-level)
3. [Validation Rules Framework](#validation-rules-framework)
4. [Backward Compatibility Guarantees](#backward-compatibility-guarantees)
5. [Deprecation Policy](#deprecation-policy)
6. [Version Support Matrix](#version-support-matrix)

---

## 1. Conformance Levels

Conformance is declared in the API's CapabilityStatement and validated during certification. There are three levels: Core, Extended, and Specialty.

### 1.1 Core (Required)

**All implementations must support Core.** Core defines the minimum viable healthcare API surface. Systems that cannot pass Core conformance testing are not considered conformant with the Monobase Healthcare API Standards.

**Required Resources:**

| Resource            | Minimum Operations                  | Notes                                  |
|---------------------|-------------------------------------|----------------------------------------|
| `Patient`           | read, create, update, search        | Foundation of all other resources      |
| `Practitioner`      | read, create, update, search        | Required for clinical attribution      |
| `Organization`      | read, create, search                | Tenant hierarchy root                  |
| `Encounter`         | read, create, update, search        | Clinical activity container            |
| `Condition`         | read, create, update, search        | Diagnosis list                         |
| `Observation`       | read, create, search                | Vital signs and lab results            |
| `MedicationRequest` | read, create, update, search        | Prescription management                |
| `Appointment`       | read, create, update, search, cancel| Scheduling                             |

### 1.2 Extended (Recommended)

**Recommended for hospital and clinic systems.** Extended builds on Core and adds resources needed for complete care coordination, coverage, and ancillary services. Systems claiming Extended conformance must also satisfy all Core requirements.

**Additional Resources Beyond Core:**

| Resource           | Minimum Operations              | Notes                                     |
|--------------------|---------------------------------|-------------------------------------------|
| `CarePlan`         | read, create, update, search    | Multi-condition longitudinal care         |
| `Coverage`         | read, create, update, search    | Insurance and benefit management          |
| `Claim`            | read, create, submit, search    | Billing and reimbursement                 |
| `Specimen`         | read, create, update, search    | Laboratory specimen management            |
| `DiagnosticReport` | read, create, update, search    | Lab and imaging report container          |
| `Immunization`     | read, create, search            | Vaccine administration record             |
| `Procedure`        | read, create, update, search    | Documented procedures                     |
| `Consent`          | read, create, update, revoke    | Patient consent management                |

### 1.3 Specialty (Optional)

Optional domain-specific modules. Specialty modules are declared independently. A system may support one or more Specialty modules without supporting all of them.

| Module       | Resources Included                                     | Target Implementations           |
|--------------|--------------------------------------------------------|----------------------------------|
| `dental`     | OralHealthClaim, ToothCondition, DentalProcedure       | Dental practice management       |
| `radiology`  | ImagingStudy, ImagingSelection, BodyStructure          | Radiology information systems    |
| `inventory`  | SupplyDelivery, SupplyRequest, Device                  | Pharmacy and supply management   |
| `analytics`  | MeasureReport, Measure, Group, Library                 | Population health and reporting  |

---

## 2. Required Fields per Conformance Level

### 2.1 Patient

| Field                   | Core | Extended | Notes                                       |
|-------------------------|------|----------|---------------------------------------------|
| `id`                    | Yes  | Yes      | Server-assigned, immutable                  |
| `identifier`            | Yes  | Yes      | At least one identifier required            |
| `name`                  | Yes  | Yes      | At least one HumanName required             |
| `birthDate`             | Yes  | Yes      | YYYY-MM-DD or partial                       |
| `gender`                | Yes  | Yes      | AdministrativeGender code                   |
| `active`                | Yes  | Yes      | Defaults to true                            |
| `telecom`               | No   | Yes      | Phone or email recommended                  |
| `address`               | No   | Yes      | Required for billing/extended               |
| `communication`         | No   | Yes      | Preferred language                          |
| `maritalStatus`         | No   | No       | Optional in all levels                      |
| `contact`               | No   | Yes      | Emergency contact                           |
| `generalPractitioner`   | No   | Yes      | Reference to PCP                            |
| `managingOrganization`  | No   | Yes      | Owning organisation                         |

### 2.2 Encounter

| Field                   | Core | Extended | Notes                                       |
|-------------------------|------|----------|---------------------------------------------|
| `id`                    | Yes  | Yes      |                                             |
| `status`                | Yes  | Yes      | Must match EncounterStatus enum             |
| `class`                 | Yes  | Yes      | V3 ActCode: IMP, AMB, EMER, etc.            |
| `subject`               | Yes  | Yes      | Reference to Patient                        |
| `participant`           | Yes  | Yes      | At least one participant required           |
| `period`                | Yes  | Yes      | start required; end on finished             |
| `type`                  | No   | Yes      | Encounter type (e.g. outpatient visit)      |
| `serviceType`           | No   | Yes      | Service being performed                     |
| `priority`              | No   | Yes      | Triage priority                             |
| `location`              | No   | Yes      | Where encounter takes place                 |
| `diagnosis`             | No   | Yes      | At minimum one for Extended                 |
| `hospitalization`       | No   | Yes      | Admit/discharge details for inpatient       |
| `reasonCode`            | No   | No       | Optional across levels                      |

### 2.3 Observation

| Field                   | Core | Extended | Notes                                             |
|-------------------------|------|----------|---------------------------------------------------|
| `id`                    | Yes  | Yes      |                                                   |
| `status`                | Yes  | Yes      | ObservationStatus enum                            |
| `category`              | Yes  | Yes      | At least one category code required               |
| `code`                  | Yes  | Yes      | LOINC preferred                                   |
| `subject`               | Yes  | Yes      | Reference to Patient                              |
| `effectiveDateTime`     | Yes  | Yes      | When the observation occurred                     |
| `value[x]`              | Yes  | Yes      | Either value or dataAbsentReason required         |
| `dataAbsentReason`      | Yes  | Yes      | Required when value is absent                     |
| `interpretation`        | No   | Yes      | H/L/N critical flags                             |
| `referenceRange`        | No   | Yes      | Normal range for numeric values                   |
| `note`                  | No   | No       | Optional free text                                |
| `bodySite`              | No   | No       | Anatomical location                               |

### 2.4 MedicationRequest

| Field                   | Core | Extended | Notes                                         |
|-------------------------|------|----------|-----------------------------------------------|
| `id`                    | Yes  | Yes      |                                               |
| `status`                | Yes  | Yes      | MedicationRequestStatus enum                  |
| `intent`                | Yes  | Yes      | proposal, plan, order, etc.                   |
| `medication[x]`         | Yes  | Yes      | Code or Reference to Medication               |
| `subject`               | Yes  | Yes      | Reference to Patient                          |
| `requester`             | Yes  | Yes      | Ordering practitioner                         |
| `authoredOn`            | Yes  | Yes      | Date/time of prescription                     |
| `dosageInstruction`     | Yes  | Yes      | At least one dosage required                  |
| `dispenseRequest`       | No   | Yes      | Quantity and refills for Extended             |
| `reasonCode`            | No   | Yes      | Indication for Extended                       |
| `note`                  | No   | No       |                                               |
| `priorPrescription`     | No   | No       |                                               |

### 2.5 Appointment

| Field                   | Core | Extended | Notes                                         |
|-------------------------|------|----------|-----------------------------------------------|
| `id`                    | Yes  | Yes      |                                               |
| `status`                | Yes  | Yes      | AppointmentStatus enum                        |
| `serviceType`           | Yes  | Yes      | What service is being provided                |
| `participant`           | Yes  | Yes      | Patient and at least one provider             |
| `start`                 | Yes  | Yes      | UTC start time                                |
| `end`                   | Yes  | Yes      | UTC end time                                  |
| `minutesDuration`       | No   | Yes      | Computed from start/end                       |
| `slot`                  | No   | Yes      | Reference to booked Slot                      |
| `reasonCode`            | No   | Yes      |                                               |
| `priority`              | No   | No       |                                               |
| `comment`               | No   | No       |                                               |

---

## 3. Validation Rules Framework

Validation is applied in four sequential layers. A request must pass all applicable layers before being accepted.

### 3.1 Structural Validation

Enforced by TypeSpec constraints at schema compilation and runtime deserialization.

| Constraint          | TypeSpec Decorator          | Example                                         |
|---------------------|-----------------------------|-------------------------------------------------|
| String length       | `@minLength`, `@maxLength`  | `@maxLength(64) name: string`                   |
| Numeric range       | `@minValue`, `@maxValue`    | `@minValue(0) @maxValue(300) heartRate: float32`|
| Pattern             | `@pattern`                  | `@pattern("[0-9]{10}") npi: string`             |
| Required field      | non-optional type           | `patientId: string` (not `patientId?: string`)  |
| Enum membership     | `enum` type                 | `status: EncounterStatus`                       |
| Array length        | `@minItems`, `@maxItems`    | `@minItems(1) participants: Participant[]`       |
| Format              | `@format`                   | `@format("date") birthDate: string`             |

Structural validation failures return HTTP 422 with a structured error body identifying each failing field.

### 3.2 Referential Integrity Validation

Reference fields must resolve to existing resources at the time of the write. Validation occurs at the API layer before persistence.

**Rules:**

- `subject` on clinical resources must reference an existing, active `Patient`.
- `requester` must reference an existing `Practitioner` or `PractitionerRole`.
- `encounter` references must point to an encounter in a non-terminal status.
- `specimen` references on `DiagnosticReport` must exist before the report is created.
- `coverage` references on `Claim` must be active at the time of the claim's service date.
- `organization` references must resolve within the same tenant hierarchy.

Referential validation failures return HTTP 422 with `code: "reference-not-found"` and the failing reference path.

### 3.3 Business Logic Validation

Enforces domain rules that cannot be expressed as pure structural constraints.

| Rule                                          | Applies To              | Error Code                    |
|-----------------------------------------------|-------------------------|-------------------------------|
| Status transitions must follow the state machine | All stateful resources | `invalid-state-transition`    |
| Encounter must have at least one participant  | Encounter               | `participant-required`        |
| Claim must have at least one diagnosis        | Claim                   | `diagnosis-required`          |
| Claim must have at least one item line        | Claim                   | `item-required`               |
| MedicationRequest stop date must be after start | MedicationRequest     | `invalid-date-range`          |
| Appointment end must be after start           | Appointment             | `invalid-date-range`          |
| Observation value or dataAbsentReason required| Observation             | `value-or-absent-reason-required` |
| Consent provisions must not contradict        | Consent                 | `conflicting-consent-provisions`  |
| CarePlan must reference at least one goal     | CarePlan                | `goal-required`               |
| PriorAuth must reference a ServiceRequest     | PriorAuth               | `service-request-required`    |

### 3.4 Terminology Validation

Coded fields have a binding strength that determines how strictly the value set is enforced.

| Binding Strength | Behaviour                                                                          |
|------------------|------------------------------------------------------------------------------------|
| `required`       | Value MUST come from the specified value set. Rejects unknown codes with HTTP 422. |
| `extensible`     | Value SHOULD come from the specified value set. Unknown codes accepted with warning header. |
| `preferred`      | Value set is recommended. Any code accepted without warning.                       |
| `example`        | Value set is illustrative only. Any code accepted.                                 |

**Required Bindings (examples):**

| Field                           | Value Set                        |
|---------------------------------|----------------------------------|
| `Patient.gender`                | `AdministrativeGender`           |
| `Encounter.status`              | `EncounterStatus`                |
| `Encounter.class`               | `v3-ActCode` (inpatient/outpatient subset) |
| `Observation.status`            | `ObservationStatus`              |
| `Condition.clinicalStatus`      | `ConditionClinicalStatusCodes`   |
| `Condition.verificationStatus`  | `ConditionVerificationStatus`    |
| `MedicationRequest.status`      | `MedicationRequestStatus`        |
| `Appointment.status`            | `AppointmentStatus`              |
| `Claim.status`                  | `ClaimStatus`                    |
| `Consent.status`                | `ConsentState`                   |
| `Quantity.system`               | `http://unitsofmeasure.org` (UCUM) |

---

## 4. Backward Compatibility Guarantees

### 4.1 Within a Major Version

The following changes are **additive** and do not constitute a breaking change:

- Adding a new optional field to a request or response model.
- Adding a new value to an enum with `extensible` binding.
- Adding a new endpoint or operation.
- Adding a new HTTP response header.
- Relaxing a constraint (e.g. reducing `@minLength`).
- Adding a new conformance level or specialty module.

The following changes are **breaking** and require a major version increment:

- Removing or renaming any field.
- Changing a field's type.
- Tightening a constraint (e.g. increasing `@minLength` on an existing field).
- Adding a new `required` field to an existing request model.
- Adding a new value to an enum with `required` binding.
- Changing the URL path structure of an existing endpoint.
- Removing an HTTP method from an existing endpoint.
- Changing authentication or authorization requirements.

### 4.2 Sunset Header

When an endpoint or field is scheduled for removal, responses include:

```
Sunset: Sat, 14 Apr 2028 00:00:00 GMT
Deprecation: true
Link: <https://docs.monobase.health/migration/v2-to-v3>; rel="deprecation"
```

The `Sunset` date must be at least 12 months from the first deprecation announcement.

---

## 5. Deprecation Policy

### 5.1 Process

1. **Mark in TypeSpec**: Deprecated fields and operations are annotated with `@deprecated("reason and migration path")`.
2. **Announce**: Deprecation notice published in release notes and developer newsletter.
3. **Sunset Header**: All responses from deprecated endpoints include the `Sunset` header.
4. **Migration Guide**: A dedicated migration guide must be published at the same time as the deprecation announcement.
5. **12-Month Minimum**: The field or endpoint remains functional for at minimum 12 months after the Sunset header first appears.
6. **Removal**: Field or endpoint removed in the next major version after the sunset date passes.

### 5.2 TypeSpec Deprecation Example

```typescript
model Patient {
  /** @deprecated Use `identifier` with system "http://hl7.org/fhir/sid/us-ssn" instead. Sunset: 2028-04-14 */
  @deprecated("Use identifier array with SSN system. Removal scheduled 2028-04-14.")
  ssn?: string;
}
```

### 5.3 Deprecation Notice Format

Each deprecation notice must document:

| Item                | Required Content                                              |
|---------------------|---------------------------------------------------------------|
| What is deprecated  | Field name, endpoint, or module                               |
| Why                 | Reason for deprecation                                        |
| Sunset date         | Earliest possible removal date (min 12 months from notice)   |
| Migration path      | What to use instead, with code examples                       |
| Breaking change?    | Confirmation it will be a breaking change in the next major   |
| Affected versions   | Which API versions are affected                               |

---

## 6. Version Support Matrix

### 6.1 Policy

- **v1 is Long-Term Support (LTS).** It will be supported indefinitely unless a mandatory regulatory change forces retirement, with at minimum 36 months notice.
- **New major versions** are released on an annual cycle.
- **Security patches** are applied to all supported versions simultaneously.
- **Non-LTS versions** are supported for 24 months from release date.

### 6.2 Current Version Support Status

| API Version | Status    | Release Date | End of Support     | Notes                           |
|-------------|-----------|--------------|--------------------|---------------------------------|
| v1          | LTS       | 2024-01-01   | Indefinite         | Minimum conformance baseline    |
| v2          | Active    | 2025-01-01   | 2027-01-01         | Adds Extended conformance       |
| v3          | Active    | 2026-01-01   | 2028-01-01         | Current latest                  |
| v4          | Planned   | 2027-Q1      | TBD                |                                 |

### 6.3 Version Negotiation

Clients declare the requested API version via the `Accept-Version` header or URL path prefix:

```
GET /api/v3/Patient/123
Accept-Version: 3.0
```

If a client requests a retired version, the server responds with HTTP 410 Gone and a `Link` header pointing to the migration guide.

### 6.4 Conformance Testing

Conformance testing artifacts are published for each version at:

```
https://docs.monobase.health/conformance/{version}/
```

Each test suite includes:

- Postman/Newman collection with all required test cases
- FHIR Validator profiles for each conformance level
- Sample data fixtures for all required resources
- Automated regression suite compatible with CI/CD pipelines
- Badge issuance process for certified implementations
