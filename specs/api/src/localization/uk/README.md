# UK Healthcare Localization Pack

**Jurisdiction**: United Kingdom (UK)
**ISO 3166-1 alpha-2**: GB
**Pack Version**: 1.0.0
**Status**: Active
**Last Updated**: 2026-04-14

---

## Table of Contents

1. [Overview](#overview)
2. [Regulatory Context](#regulatory-context)
3. [Pack Contents](#pack-contents)
4. [Identifier Systems](#identifier-systems)
5. [Code Systems](#code-systems)
6. [Value Sets](#value-sets)
7. [Terminology Mappings](#terminology-mappings)
8. [NHS Nations Note](#nhs-nations-note)
9. [Key Regulations](#key-regulations)
10. [Official Sources](#official-sources)

---

## Overview

This localization pack adapts the Monobase Healthcare API Standards Foundation for deployment in UK healthcare settings, primarily NHS England, with notes for Scotland, Wales, and Northern Ireland divergence. It covers compliance with UK GDPR, the Data Protection Act 2018, NHS Digital data standards, DTAC (Digital Technology Assessment Criteria), and the DCB clinical safety standards (DCB0129/DCB0160).

The pack is **standalone and non-imported by core**. It does not modify any core entity definitions. It provides URI constants, enumerations, and mapping documentation that UK implementations layer on top of the core model.

### Scope

- NHS Number (England/Wales), CHI Number (Scotland), H&C Number (Northern Ireland)
- GMC, NMC, GPhC professional registration numbers
- ODS and SDS organisation/user identifiers
- SNOMED CT UK Edition, dm+d, OPCS-4, NHS Data Dictionary code systems
- READ/CTV3 legacy code systems (for historical migration only)
- NHS ethnic categories, discharge destinations, admission methods, specialty codes
- Terminology mapping: dm+d to SNOMED CT, SNOMED CT to ICD-10, READ to SNOMED CT

---

## Regulatory Context

### NHS Digital / NHS England

NHS Digital (now operating as NHS England's digital function) maintains core national data standards and infrastructure:

- **NHS Data Dictionary**: Defines mandatory data elements, code sets, and rules for NHS Commissioning Data Sets (CDS) submitted by providers to NHS England.
- **SNOMED CT UK Edition**: NHS Digital is the UK National Release Centre (NRC) for SNOMED CT. SNOMED CT is mandated for clinical recording in NHS acute and primary care systems.
- **dm+d (Dictionary of Medicines and Devices)**: Maintained jointly by NHSBSA and NHS Digital. Mandatory for ePrescribing in NHS England. dm+d codes are SNOMED CT-aligned.
- **Personal Demographics Service (PDS)**: The national patient demographic service. NHS Numbers must be verified against PDS before use in clinical data exchange across NHS systems.
- **Spine Directory Service (SDS)**: Directory of NHS-connected organisations, systems, and staff. SDS User IDs are issued to NHS Smartcard holders.

### UK GDPR and Data Protection Act 2018

The UK retained and amended the EU GDPR following Brexit. The UK GDPR, together with the Data Protection Act 2018, forms the primary data protection framework:

- **Lawful basis for processing health data**: Processing special category data (including health data) requires both a lawful basis under Article 6 and a condition under Article 9 of UK GDPR.
- **Data Subject Rights**: Right to access, rectification, erasure (qualified), restriction, portability, and objection.
- **ICO (Information Commissioner's Office)**: The UK supervisory authority. Breach notification required within 72 hours of discovery.
- **Data Protection Officer (DPO)**: Required for NHS organisations as public authorities and for organisations processing health data at scale.

### DTAC (Digital Technology Assessment Criteria)

DTAC is the NHS framework for assessing digital health technologies for deployment in NHS settings. It covers:

- Clinical safety (referencing DCB0129 and DCB0160)
- Data protection and information governance
- Technical security (Cyber Essentials Plus for higher-risk systems)
- Interoperability (FHIR, HL7, NHS API standards)
- Accessibility (WCAG 2.1 AA)
- Usability and user experience

### DCB Clinical Safety Standards

- **DCB0129**: Clinical Risk Management Standard for manufacturers of health IT systems. Requires a Clinical Safety Case and Clinical Safety Case Report.
- **DCB0160**: Clinical Risk Management Standard for NHS organisations deploying health IT. Requires a Hazard Log and Clinical Risk Management Plan.

Both standards are mandatory for health IT products deployed in NHS England.

---

## Pack Contents

| File | Purpose |
|---|---|
| `code-systems.tsp` | URI constants for UK-specific code systems (SNOMED CT UK Edition, dm+d, OPCS-4, NHS Data Dictionary, READ/CTV3) |
| `identifiers.tsp` | URI constants and validation patterns for UK identifier systems (NHS Number, GMC, NMC, GPhC, ODS, SDS) |
| `value-sets.tsp` | Enumerated value sets: NHS ethnic categories, discharge destinations, admission methods, specialty codes |
| `terminology-map.tsp` | Documented mapping relationships between UK local codes and international standards |
| `README.md` | This file |

---

## Identifier Systems

### Patient Identifiers

| Identifier | System URI | Format | Notes |
|---|---|---|---|
| NHS Number (England/Wales) | `https://fhir.nhs.uk/Id/nhs-number` | 10 digits | Modulus 11 check; verify via PDS |
| CHI Number (Scotland) | `https://fhir.nhs.uk/Id/chi-number` | 10 digits | Modulus 11 variant |
| H&C Number (Northern Ireland) | `https://fhir.nhs.uk/Id/hc-number` | 10 digits | Separate from NHS Number |

**NHS Number Modulus 11 Check Digit Algorithm:**

The NHS Number check digit (10th digit) is computed by:
1. Multiply digits 1–9 by weights 10 down to 2 respectively.
2. Sum the products.
3. Remainder = (11 - (sum mod 11)) mod 11.
4. If remainder is 10, the number is invalid. If 11, check digit is 0.

**Usage on Patient resource:**

```json
{
  "resourceType": "Patient",
  "identifier": [
    {
      "system": "https://fhir.nhs.uk/Id/nhs-number",
      "value": "9434765919"
    }
  ]
}
```

### Practitioner Identifiers

| Identifier | System URI | Format | Notes |
|---|---|---|---|
| GMC Number | `https://fhir.hl7.org.uk/Id/gmc-number` | 7 digits | Medical practitioners |
| NMC Number | `https://fhir.hl7.org.uk/Id/nmc-number` | 2 digits + 5 chars | Nurses, midwives |
| GPhC Number | `https://fhir.hl7.org.uk/Id/gphc-number` | 7 digits | Pharmacists, pharmacy technicians |
| SDS User ID | `https://fhir.nhs.uk/Id/sds-user-id` | 12 digits | NHS Smartcard holders |

### Organisation / Facility Identifiers

| Identifier | System URI | Format | Notes |
|---|---|---|---|
| ODS Organisation Code | `https://fhir.nhs.uk/Id/ods-organization-code` | 3–8 alphanumeric | Trusts, practices, CCGs |
| ODS Site Code | `https://fhir.nhs.uk/Id/ods-site-code` | 5–8 alphanumeric | Specific sites within an org |

---

## Code Systems

### Clinical Recording — SNOMED CT UK Edition

SNOMED CT UK Edition is the mandated clinical terminology for NHS England. System URI:

```
http://snomed.info/sct
```

The UK Edition is identified by its module ID (`999000041000000102`). Implementations must licence SNOMED CT through NHS Digital (provided free of charge to NHS organisations and their approved suppliers).

### Drug Coding — dm+d

The dm+d is the NHS standard for ePrescribing and dispensing:

```
https://dmd.nhs.uk
```

dm+d concepts are SNOMED CT-aligned. The dm+d hierarchy includes VTM (Virtual Therapeutic Moiety), VMP (Virtual Medicinal Product), VMPP (Virtual Medicinal Product Pack), AMP (Actual Medicinal Product), and AMPP (Actual Medicinal Product Pack) levels.

### Procedure Coding — OPCS-4

OPCS-4 is mandatory for NHS England inpatient procedure coding (CDS submissions):

```
https://www.datadictionary.nhs.uk/data_elements/main_operative_procedure_-_opcs_code.html
```

OPCS-4 is maintained by NHS Digital and updated annually. It does not map directly to ICD-10-PCS (US system) or CPT.

### Diagnosis Coding — WHO ICD-10

UK hospitals use WHO ICD-10 (5th edition) for CDS submissions. System URI:

```
http://hl7.org/fhir/sid/icd-10
```

Do not use ICD-10-CM (the US clinical modification) in UK contexts.

---

## Value Sets

### NHS Ethnic Categories

NHS Data Dictionary ethnic category codes (A–Z + 99) are required on CDS submissions for equality monitoring under the Equality Act 2010. Data is self-reported. Documented in `value-sets.tsp` as `UKEthnicCategory`.

### Discharge Destinations

NHS Data Dictionary discharge destination codes identify post-discharge location. Required on CDS. Key codes include: 19 (usual residence), 79 (died), 84/87 (non-NHS hospital), 85 (non-NHS care home). Full set in `value-sets.tsp` as `UKDischargeDestination`.

### Admission Methods

NHS Data Dictionary admission method codes identify how patients were admitted. Required on CDS. Key codes: 11 (waiting list), 21 (A&E), 81 (transfer), 82 (birth). Full set in `value-sets.tsp` as `UKAdmissionMethod`.

### NHS Specialty Codes

NHS main specialty codes identify the clinical specialty responsible for an episode. A representative set is documented in `value-sets.tsp` as `UKSpecialtyCode`. Full list maintained in the NHS Data Dictionary.

---

## Terminology Mappings

Full mapping documentation in `terminology-map.tsp`. Summary:

| Source System | Target System | Method | Completeness |
|---|---|---|---|
| dm+d | SNOMED CT | dm+d/SNOMED CT integration (NHS Digital) | Near-complete for current dm+d codes |
| SNOMED CT (UK Edition) | ICD-10 | SNOMED CT to ICD-10 map (NHS Digital) | Partial — not all SNOMED concepts have ICD-10 equivalents |
| OPCS-4 | SNOMED CT | NHS Digital OPCS-4/SNOMED map | Partial |
| READ v2 / CTV3 | SNOMED CT | NHS Digital READ to SNOMED maps (migration) | Near-complete for GP clinical codes |
| NHS ethnic categories | HL7 v3 | Manual mapping | Partial — NHS codes are more granular |

---

## NHS Nations Note

The UK is not a single healthcare jurisdiction. Key divergences:

| Nation | Patient ID | Payer | Regulator Notes |
|---|---|---|---|
| England | NHS Number | NHS England | NHS Digital standards apply |
| Scotland | CHI Number | NHS Scotland | Separate data standards (ISD Scotland) |
| Wales | NHS Number | NHS Wales | Broadly follows NHS England standards; some divergence in data dictionary |
| Northern Ireland | H&C Number | Health and Social Care NI | Separate from NHS England; pharmacists registered with PSNI not GPhC |

Implementations serving multiple UK nations must handle all three patient identifier systems.

---

## Key Regulations

| Regulation | Subject | Relevance |
|---|---|---|
| UK GDPR | Personal data protection | Primary data protection framework; health data is special category |
| Data Protection Act 2018 | UK GDPR implementation | Defines Schedule 3 conditions for health data processing |
| Health and Social Care Act 2012 | NHS restructuring | Establishes NHS England, CCGs, and Health Education England |
| NHS Act 2006 | NHS constitution and obligations | Foundation for NHS data governance obligations |
| DCB0129 | Clinical safety for manufacturers | Clinical Safety Case required for health IT products |
| DCB0160 | Clinical safety for deployers | Hazard Log and Clinical Risk Management Plan for NHS deployers |
| DTAC | Digital technology assessment | NHS assessment framework for health IT products |
| Cyber Essentials Plus | Cybersecurity baseline | Required for higher-risk NHS system certifications |
| Equality Act 2010 | Equality monitoring | Requires ethnic category data collection for NHS reporting |
| Access to Health Records Act 1990 | Legacy patient access rights | Superseded by UK GDPR for living patients; applies to deceased |

---

## Official Sources

| Source | URL |
|---|---|
| NHS Digital | https://digital.nhs.uk |
| NHS Data Dictionary | https://www.datadictionary.nhs.uk |
| ODS Portal | https://odsportal.nhsbsa.nhs.uk |
| Personal Demographics Service | https://digital.nhs.uk/services/personal-demographics-service |
| SNOMED CT UK | https://digital.nhs.uk/services/terminology-and-classifications/snomed-ct |
| dm+d browser | https://dmd.nhs.uk |
| GMC register | https://www.gmc-uk.org/registration-and-licensing/the-medical-register |
| NMC register | https://www.nmc.org.uk/registration/search-the-register |
| GPhC register | https://www.pharmacyregulation.org/registers |
| ICO (data protection) | https://ico.org.uk |
| DTAC | https://www.nhsx.nhs.uk/key-tools-and-info/digital-technology-assessment-criteria-dtac |
| DCB0129 | https://digital.nhs.uk/data-and-information/information-standards/information-standards-and-data-collections-including-extractions/publications-and-notifications/standards-and-collections/dcb0129-clinical-risk-management-its-application-in-the-manufacture-of-health-it-systems |
| DCB0160 | https://digital.nhs.uk/data-and-information/information-standards/information-standards-and-data-collections-including-extractions/publications-and-notifications/standards-and-collections/dcb0160-clinical-risk-management-its-application-in-the-deployment-and-use-of-health-it-systems |
