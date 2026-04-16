# Localization Framework — Monobase Healthcare API Standards Foundation

**Document ID**: MHASF-STD-008
**Version**: 1.0.0
**Status**: Active
**Last Updated**: 2026-04-14

---

## Table of Contents

1. [Core vs Local Separation](#core-vs-local-separation)
2. [Localization Pack Structure](#localization-pack-structure)
3. [Country-Specific Examples](#country-specific-examples)
4. [Override Policy](#override-policy)
5. [Multi-Language Support](#multi-language-support)
6. [Address Formats by Country](#address-formats-by-country)
7. [Identifier Formats by Country](#identifier-formats-by-country)

---

## 1. Core vs Local Separation

The Monobase Healthcare API uses a layered model to accommodate international deployments without fragmenting the shared API contract.

### 1.1 Global Core Layer

The global core layer defines:

- **Entity definitions**: All FHIR-aligned resource models (Patient, Encounter, Observation, etc.)
- **Field semantics**: The meaning of every field in every model
- **Required binding sets**: Value sets with `required` binding and their international base (SNOMED CT International, LOINC, UCUM)
- **State machines**: Lifecycle status transitions for all stateful resources
- **Validation rules**: Structural and referential constraints that apply universally
- **Event schema**: Event envelope and naming conventions

Core layer artefacts live in the `core/` directory of the TypeSpec project. They must not be modified by localization packs.

### 1.2 Local Pack Layer

Localization packs extend and adapt the core for a specific jurisdiction. A pack:

- Adds jurisdiction-specific code systems and value sets
- Provides country-specific identifier validation rules
- Maps local codes to international codes
- Adds optional extension fields required by local regulation
- Tightens (but never loosens) binding strength where local law requires it

Local packs do not fork the core. They import from `core/` and layer on top.

### 1.3 Resolution Order

When a field is validated, the system applies rules in this order:

```
1. Core structural constraints
2. Core referential constraints
3. Core business logic rules
4. Local pack structural overrides
5. Local pack terminology constraints
6. Local pack validation rules
```

If a local rule conflicts with a core rule in a way that would loosen the core constraint, the local rule is rejected at pack compile time.

---

## 2. Localization Pack Structure

Each country-code directory contains a standardised set of TypeSpec files and a README.

```
localization/
  {country-code}/
    code-systems.tsp       # Local code systems (e.g. AU: PBS codes, CA: DIN codes)
    value-sets.tsp         # Local value set overrides and extensions
    validation-rules.tsp   # Country-specific validation (address format, ID format)
    terminology-map.tsp    # Mapping from local codes to international codes
    extensions.tsp         # Country-specific extension fields
    README.md              # Overview of this localization pack
```

### 2.1 `code-systems.tsp`

Declares the URIs and metadata for code systems that are specific to the jurisdiction and not present in the core.

```typescript
// localization/au/code-systems.tsp
namespace Localization.AU;

@codeSystem("http://pbs.gov.au/code/item")
enum PBSItemCode {
  // Pharmaceutical Benefits Scheme item codes
  // Values populated from PBS reference data
}

@codeSystem("http://ns.electronichealth.net.au/id/medicare-provider-number")
model MedicareProviderNumberSystem {}
```

### 2.2 `value-sets.tsp`

Extends core value sets with local codes or restricts them to a jurisdiction-specific subset.

```typescript
// localization/au/value-sets.tsp
namespace Localization.AU;

// Extend core medication code value set to include PBS codes
union AUMedicationCode {
  ...Core.MedicationCode,
  PBSItemCode
}
```

### 2.3 `validation-rules.tsp`

Country-specific validation annotations. These are additive constraints on top of core.

```typescript
// localization/au/validation-rules.tsp
namespace Localization.AU;

model AUPatientIdentifier extends Core.Identifier {
  @doc("Individual Healthcare Identifier — 16-digit number")
  @pattern("^800[0-9]{13}$")
  ihi?: string;
}
```

### 2.4 `terminology-map.tsp`

Declares ConceptMap-style mappings from local codes to international equivalents.

```typescript
// localization/au/terminology-map.tsp
namespace Localization.AU;

// Maps PBS item codes to RxNorm for interoperability
model PBSToRxNormMap {
  sourceSystem: "http://pbs.gov.au/code/item";
  targetSystem: "http://www.nlm.nih.gov/research/umls/rxnorm";
  // Mapping table generated from NLM crosswalk
}
```

### 2.5 `extensions.tsp`

Optional fields required by local law or regulation that do not exist in the core model.

```typescript
// localization/au/extensions.tsp
namespace Localization.AU;

model AUPatientExtension {
  @doc("Australian Indigenous Status — required for AIHW reporting")
  indigenousStatus?: AUIndigenousStatus;

  @doc("DVA file number for Department of Veterans Affairs patients")
  dvaFileNumber?: string;
}
```

### 2.6 `README.md`

Each localization pack must include a README that documents:

- Jurisdiction name and ISO 3166-1 alpha-2 code
- Regulatory basis (e.g. "Required by the My Health Record Act 2012")
- Maintainer contact
- Local code system sources and update frequency
- Known gaps or limitations

### 2.7 First Implementation — Philippines (PH)

The first localization pack implemented is `localization/ph/` for the Philippines, covering PhilHealth integration, DOH regulatory compliance, PRC provider licensing, and Philippine-specific value sets for discharge dispositions, ward types, and hospital classification levels.

The PH pack can be used as the reference implementation when authoring new localization packs. It demonstrates:

- How to declare local code system URIs (`code-systems.tsp`) without importing from core
- How to enumerate identifier system URIs and document validation patterns (`identifiers.tsp`)
- How to define jurisdiction-specific value set extensions for clinical and administrative concepts (`value-sets.tsp`)
- How to document terminology mapping relationships and policies without embedding code-level mapping tables in TypeSpec (`terminology-map.tsp`)
- How to write a comprehensive pack README covering regulatory context, usage examples, claims requirements, and retention obligations

Refer to `src/localization/ph/README.md` for the full regulatory and usage documentation for the Philippine pack.

---

## 3. Country-Specific Examples

### 3.1 United States (US)

| Element                  | Standard/System                                       | Notes                                       |
|--------------------------|-------------------------------------------------------|---------------------------------------------|
| Diagnosis coding         | ICD-10-CM                                             | Required for all inpatient claims           |
| Procedure coding         | CPT-4                                                 | AMA-licensed; required for professional billing |
| Drug coding              | NDC, RxNorm                                           | NDC on dispense; RxNorm for prescriptions   |
| Supply/DMEPOS coding     | HCPCS Level II                                        | CMS-maintained                              |
| Provider identifier      | NPI (10-digit)                                        | NPPES registry                              |
| Claim format             | X12 837P (professional), 837I (institutional)         | EDI standard for payer submission           |
| Remittance format        | X12 835                                               | ERA for payment reconciliation              |
| Patient identifier       | MRN (local), SSN (sensitive — masked by default)      | SSN masked unless specific purpose declared |
| Value set authority      | VSAC (NLM)                                            | For FHIR US Core profiles                   |

### 3.2 Australia (AU)

| Element                  | Standard/System                                       | Notes                                       |
|--------------------------|-------------------------------------------------------|---------------------------------------------|
| Drug coding              | PBS item codes                                        | Pharmaceutical Benefits Scheme              |
| Provider identifier      | Medicare Provider Number (8 alphanumeric)             | HW001 format                                |
| Patient identifier       | IHI (Individual Healthcare Identifier — 16 digits)    | My Health Record integration                |
| Organisation identifier  | HPI-O (Healthcare Provider Identifier — Organisation) | 16-digit                                    |
| Diagnosis coding         | ICD-10-AM (Australian Modification)                   | Differs from ICD-10-CM                      |
| Procedure coding         | ACHI (Australian Classification of Health Interventions) | Companion to ICD-10-AM                   |
| Claim format             | Medicare Online (MOL), ECLIPSE                        | For public billing                          |
| Indigenous status        | ABS Standard for Indigenous Status (5 values)         | AIHW reporting requirement                  |

### 3.3 Canada (CA)

| Element                  | Standard/System                                       | Notes                                       |
|--------------------------|-------------------------------------------------------|---------------------------------------------|
| Drug coding              | DIN (Drug Identification Number)                      | Health Canada issued                        |
| Provider identifier      | Provincial licence numbers (no national standard)     | Format varies by province                   |
| Patient identifier       | Provincial Health Number (PHN)                        | Format varies by province                   |
| Diagnosis coding         | ICD-10-CA (Canadian Modification)                     | CIHI-maintained                             |
| Procedure coding         | CCI (Canadian Classification of Health Interventions)| CIHI-maintained                             |
| Billing format           | Provincial claim formats (no national standard)        | Each province has its own format            |

### 3.4 United Kingdom (UK)

| Element                  | Standard/System                                       | Notes                                       |
|--------------------------|-------------------------------------------------------|---------------------------------------------|
| Patient identifier       | NHS Number (10-digit, Modulus-11 check)               | Mandatory for NHS systems                   |
| Drug coding              | dm+d (Dictionary of Medicines and Devices)            | SNOMED-aligned; NHS Digital maintained      |
| Diagnosis coding         | ICD-10 (5th edition) with NHS modifications           | NHS Digital mandates specific code use      |
| Procedure coding         | OPCS-4                                                | Office of Population Censuses and Surveys   |
| Terminology server       | SNOMED CT UK Edition                                  | Extension of SNOMED CT International        |
| Organisation identifier  | ODS code                                              | Organisation Data Service                   |
| Practitioner identifier  | GMC number (doctors), NMC number (nurses)             | Regulator-issued                            |

### 3.5 Philippines (PH)

| Element                  | Standard/System                                       | Notes                                       |
|--------------------------|-------------------------------------------------------|---------------------------------------------|
| Patient identifier       | PhilHealth ID (12-digit)                              | Philippine Health Insurance Corporation     |
| Insurance scheme         | NHIP (National Health Insurance Program)              | DOH/PhilHealth regulated                    |
| Provider identifier      | PHIC accreditation number                             | Facility and individual provider numbers    |
| Diagnosis coding         | ICD-10 (WHO edition)                                  | DOH mandated                                |
| Drug coding              | PNDF (Philippine National Drug Formulary)             | DOH-maintained formulary                    |
| Claim format             | PhilHealth eClaims (PBEF)                             | Electronic claims via PHIC portal           |

---

## 4. Override Policy

### 4.1 What Local Packs May Do

| Action                              | Allowed | Notes                                              |
|-------------------------------------|---------|----------------------------------------------------|
| Add new optional fields             | Yes     | Via extensions.tsp                                 |
| Add new code systems                | Yes     | Via code-systems.tsp                               |
| Add codes to extensible value sets  | Yes     | Via value-sets.tsp                                 |
| Tighten binding: extensible -> required | Yes | Permitted where local law mandates specific codes  |
| Tighten string constraints          | Yes     | May reduce maxLength; may increase minLength       |
| Add new validation rules            | Yes     | Additive only                                      |
| Restrict allowed status transitions | Yes     | Only to a subset of core-allowed transitions       |

### 4.2 What Local Packs Must Not Do

| Action                              | Prohibited | Reason                                             |
|-------------------------------------|------------|----------------------------------------------------|
| Remove any core field               | Yes        | Breaks core conformance contract                   |
| Make a core-optional field required | No*        | *Allowed only via local validation rules, not schema change |
| Loosen binding: required -> extensible | Yes     | Weakens data quality guarantees                    |
| Override core state machine with new states | No | New states must be proposed to the core working group |
| Modify event envelope schema        | Yes        | Event envelope is invariant                        |
| Change core field types             | Yes        | Breaking change; requires core version increment   |

### 4.3 Conflict Resolution

If a local pack update conflicts with a new core version:

1. The pack maintainer is notified via automated CI failure.
2. A 90-day remediation window is opened.
3. If unresolved, the local pack is marked `degraded` and a warning header is added to all requests from that jurisdiction's tenants.
4. After 180 days, the pack is suspended and jurisdictional deployments fall back to core-only behaviour.

---

## 5. Multi-Language Support

### 5.1 Display Text Strategy

The API separates coded meaning from human-readable display to support multiple languages.

| Field                    | Content                            | Language           |
|--------------------------|------------------------------------|--------------------|
| `Coding.code`            | Machine-readable code value        | Language-neutral   |
| `Coding.system`          | Code system URI                    | Language-neutral   |
| `Coding.display`         | Display name in source language    | Source system language |
| `CodeableConcept.text`   | Free-text override for this context| Client-specified language |

### 5.2 Client-Side Translation

Clients requiring translated display strings should:

1. Submit requests with `Accept-Language: {bcp47-tag}` header (e.g. `Accept-Language: fil-PH`).
2. The API returns `Coding.display` in the source language as-is.
3. The client calls the Terminology Service `/translate` endpoint to retrieve display names in the requested language.
4. `CodeableConcept.text` is populated by the API in English by default; clients may override this field on write.

### 5.3 Terminology Service Translation Endpoint

```
POST /terminology/translate
{
  "system": "http://snomed.info/sct",
  "code":   "73211009",
  "targetLanguage": "fil"
}

Response:
{
  "display": "Diabetes mellitus",
  "displayTranslated": "Diyabetis mellitus",
  "language": "fil",
  "source": "SNOMED CT Philippine Translation"
}
```

### 5.4 Narrative Generation

Resource `text.div` (XHTML narrative) is generated in the tenant's configured default language. Clients may request a specific language:

```
GET /Condition/123
Accept-Language: fr-CA
```

The server returns the narrative in Canadian French if a translation is available, otherwise falls back to English with a `Content-Language: en` response header.

---

## 6. Address Formats by Country

All address fields use the FHIR `Address` model. Country-specific validation applies to `line`, `city`, `state`, `postalCode`, and `country`.

| Country | Postal Code Pattern         | State/Province Required | Example                               |
|---------|-----------------------------|-------------------------|---------------------------------------|
| US      | `^\d{5}(-\d{4})?$`          | Yes (2-letter USPS code)| 90210, 90210-1234                     |
| AU      | `^\d{4}$`                   | Yes (VIC, NSW, QLD, etc.)| 3000                                 |
| CA      | `^[A-Z]\d[A-Z] \d[A-Z]\d$` | Yes (provincial code)   | M5V 3A8                               |
| UK      | `^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$` | No (county optional) | SW1A 1AA                    |
| PH      | `^\d{4}$`                   | Yes (region code)       | 1000                                  |
| DE      | `^\d{5}$`                   | Yes (Bundesland)        | 10115                                 |
| FR      | `^\d{5}$`                   | No                      | 75001                                 |
| SG      | `^\d{6}$`                   | No                      | 238823                                |
| NZ      | `^\d{4}$`                   | No                      | 6011                                  |
| IN      | `^\d{6}$`                   | Yes (state name)        | 400001                                |

**Address Format Validation Notes:**

- Postal code validation is applied when `country` field is populated and matches a known ISO 3166-1 alpha-2 code.
- Addresses without a `country` field bypass postal code pattern validation.
- US addresses additionally validate that the `state` code appears in the USPS state code list.
- AU addresses validate that `state` is one of: ACT, NSW, NT, QLD, SA, TAS, VIC, WA.

---

## 7. Identifier Formats by Country

Patient and provider identifiers are validated against jurisdiction-specific patterns. Identifiers are typed using `Identifier.system` URI.

### 7.1 Patient Identifiers

| Country | Identifier Name                | System URI                                                | Pattern / Validation                          |
|---------|--------------------------------|-----------------------------------------------------------|-----------------------------------------------|
| US      | SSN                            | `http://hl7.org/fhir/sid/us-ssn`                         | `^\d{3}-\d{2}-\d{4}$` (masked by default)     |
| US      | MBI (Medicare Beneficiary ID)  | `http://hl7.org/fhir/sid/us-mbi`                         | `^[1-9][A-HJ-NP-RT-Z]\d[A-HJ-NP-RT-Z]\d[A-HJ-NP-RT-Z]{2}\d[A-HJ-NP-RT-Z]{2}\d{2}$` |
| AU      | IHI                            | `http://ns.electronichealth.net.au/id/hi/ihi/1.0`        | `^800\d{13}$` (Luhn check required)           |
| CA      | Ontario Health Card            | `https://fhir.infoway-inforoute.ca/id/on-health-card`    | `^\d{10}[A-Z]{2}$`                            |
| CA      | BC Personal Health Number      | `https://fhir.infoway-inforoute.ca/id/bc-health-number`  | `^\d{10}$`                                    |
| UK      | NHS Number                     | `https://fhir.nhs.uk/Id/nhs-number`                      | `^\d{10}$` (Modulus-11 check required)        |
| PH      | PhilHealth ID                  | `http://philhealth.gov.ph/id/member`                      | `^\d{2}-\d{9}-\d$`                            |
| PH      | PSA / Philippine Statistics Authority | `http://psa.gov.ph/id/philsys`                   | `^\d{16}$`                                    |
| SG      | NRIC / FIN                     | `http://hl7.org/fhir/sid/sg-nric-fin`                    | `^[STFGM]\d{7}[A-Z]$` (check digit required) |
| NZ      | NHI Number                     | `https://standards.digital.health.nz/ns/nhi-id`          | `^[A-HJ-NP-Z]{3}\d{4}$` or new `^[A-HJ-NP-Z]{3}\d{5}$` |

### 7.2 Provider Identifiers

| Country | Identifier Name                | System URI                                                | Pattern                                       |
|---------|--------------------------------|-----------------------------------------------------------|-----------------------------------------------|
| US      | NPI                            | `http://hl7.org/fhir/sid/us-npi`                         | `^\d{10}$` (Luhn check required)              |
| US      | DEA Number                     | `http://hl7.org/fhir/sid/us-dea`                         | `^[A-Z]{2}\d{7}$`                             |
| AU      | Medicare Provider Number       | `http://ns.electronichealth.net.au/id/medicare-provider-number` | `^\d{6}[A-Z]{1,2}$`                  |
| AU      | HPI-I                          | `http://ns.electronichealth.net.au/id/hi/hpii/1.0`       | `^800[0-9]{13}$` (Luhn check required)        |
| UK      | GMC Number (doctors)           | `https://fhir.hl7.org.uk/Id/gmc-number`                  | `^\d{7}$`                                     |
| UK      | NMC Number (nurses)            | `https://fhir.hl7.org.uk/Id/nmc-number`                  | `^\d{2}[A-Z]\d{4}[A-Z]$`                     |
| PH      | PHIC Accreditation No.         | `http://philhealth.gov.ph/id/provider`                    | `^[0-9]{12}$`                                 |

### 7.3 Identifier Validation Enforcement

- Identifiers with a known `system` URI listed above are validated against the documented pattern.
- Identifiers with an unknown or unlisted `system` URI are accepted without pattern validation (no rejection).
- Luhn and Modulus-11 algorithmic checks are performed server-side for identifiers that require them.
- Validation failures produce HTTP 422 with `code: "invalid-identifier-format"`, identifying the `system` and failed field.
