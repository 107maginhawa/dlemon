# Australian Healthcare Localization Pack

**Jurisdiction**: Australia (AU)
**ISO 3166-1 alpha-2**: AU
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
8. [My Health Record Requirements](#my-health-record-requirements)
9. [Key Regulations](#key-regulations)
10. [Official Sources](#official-sources)

---

## Overview

This localization pack adapts the Monobase Healthcare API Standards Foundation for deployment in Australian healthcare settings. It covers compliance with the My Health Records Act 2012, the Privacy Act 1988, the Healthcare Identifiers Act 2010, ADHA (Australian Digital Health Agency) technical specifications, AIHW national data standards, NSQHS Standards (National Safety and Quality Health Service Standards), and TGA (Therapeutic Goods Administration) drug and device regulation.

The pack is **standalone and non-imported by core**. It does not modify any core entity definitions. It provides URI constants, enumerations, and mapping documentation that Australian implementations layer on top of the core model.

### Scope

- IHI, HPI-I, HPI-O, Medicare Card, DVA, and AHPRA identifier systems
- ICD-10-AM, ACHI, PBS, MBS, and AMT code systems
- AIHW indigenous status, source of referral, mode of separation, state/territory codes
- Establishment type classifications
- Terminology mapping: AMT to SNOMED CT, ICD-10-AM to WHO ICD-10, ACHI to SNOMED CT

---

## Regulatory Context

### My Health Record and ADHA

The Australian Digital Health Agency (ADHA) is the national agency responsible for digital health strategy and My Health Record:

- **My Health Record**: National opt-out health record repository. All registered healthcare providers may upload clinical documents (discharge summaries, shared health summaries, event summaries, prescriptions, dispense records). Governed by the My Health Records Act 2012.
- **ADHA technical specifications**: ADHA publishes FHIR implementation guides, SNOMED CT AU Edition, and AMT for use in Australian eHealth systems.
- **National Clinical Terminology Service (NCTS)**: ADHA's terminology service providing access to SNOMED CT AU Edition and AMT.

### Healthcare Identifiers Act 2010

The Healthcare Identifiers Act 2010 (Cth) governs the Healthcare Identifiers (HI) Service:

- **IHI (Individual Healthcare Identifier)**: A unique 16-digit number assigned to every patient. Used in My Health Record and secure messaging. Access is restricted to healthcare providers connected to the HI Service.
- **HPI-I and HPI-O**: Provider and organisational identifiers for eHealth contexts.
- IHI is sensitive information under the Act; misuse attracts civil and criminal penalties.

### Privacy Act 1988 and Australian Privacy Principles (APPs)

The Privacy Act 1988 (Cth) and the 13 Australian Privacy Principles govern the collection, use, and disclosure of personal information including health information:

- **APP 11**: Requires entities to take reasonable steps to protect personal information from misuse, interference, loss, unauthorised access, modification, or disclosure.
- **Notifiable Data Breaches (NDB) scheme** (Part IIIC): Requires notification to the OAIC and affected individuals when an eligible data breach occurs.
- Health information is sensitive information under the Privacy Act and has heightened protections.

### NSQHS Standards

The Australian Commission on Safety and Quality in Health Care (ACSQHC) administers the National Safety and Quality Health Service (NSQHS) Standards. Key standards with data implications:

- **Standard 1 (Clinical Governance)**: Requires documentation of safety and quality systems.
- **Standard 5 (Comprehensive Care)**: Mandates collection of Aboriginal and Torres Strait Islander status for all patients.
- **Standard 6 (Communicating for Safety)**: Requires correct patient identification — IHI and Medicare Card Number are the national identifiers.

### TGA (Therapeutic Goods Administration)

The TGA regulates therapeutic goods (medicines, biologics, medical devices, blood products) under the Therapeutic Goods Act 1989:

- All prescription medicines on the market must have a current ARTG (Australian Register of Therapeutic Goods) entry.
- PBS item codes are assigned to listed medicines subsidised under the National Health Act 1953.
- Medical devices must carry an ARTG number or UDI (Unique Device Identifier).

---

## Pack Contents

| File | Purpose |
|---|---|
| `code-systems.tsp` | URI constants for Australian code systems (ICD-10-AM, ACHI, PBS, MBS, AMT, NCTIS, AIR) |
| `identifiers.tsp` | URI constants and validation patterns for Australian identifier systems (IHI, HPI-I, HPI-O, Medicare, DVA, AHPRA, ABN) |
| `value-sets.tsp` | Enumerated value sets: indigenous status, source of referral, mode of separation, state/territory codes, establishment types |
| `terminology-map.tsp` | Documented mapping relationships between Australian local codes and international standards |
| `README.md` | This file |

---

## Identifier Systems

### Patient Identifiers

| Identifier | System URI | Format | Notes |
|---|---|---|---|
| IHI | `http://ns.electronichealth.net.au/id/hi/ihi/1.0` | 8003 60xx xxxx xxxx (16 digits) | Luhn check; HI Service verification required |
| Medicare Card Number | `http://ns.electronichealth.net.au/id/medicare-number` | 10 digits + IRN | Luhn-derived check on digits 1–9 |
| DVA File Number | `http://ns.electronichealth.net.au/id/dva` | State letter + alphanumeric | State prefix (N/V/Q/S/W/T) |

**Usage on Patient resource:**

```json
{
  "resourceType": "Patient",
  "identifier": [
    {
      "system": "http://ns.electronichealth.net.au/id/hi/ihi/1.0",
      "value": "8003608166690503"
    },
    {
      "system": "http://ns.electronichealth.net.au/id/medicare-number",
      "value": "32788511952"
    }
  ]
}
```

### Practitioner Identifiers

| Identifier | System URI | Format | Notes |
|---|---|---|---|
| HPI-I | `http://ns.electronichealth.net.au/id/hi/hpii/1.0` | 8003 61xx xxxx xxxx (16 digits) | HI Service registration |
| AHPRA Number | `http://ns.electronichealth.net.au/id/ahpra-registration-number` | 3 letters + 10 digits | Profession prefix |

### Organisation Identifiers

| Identifier | System URI | Format | Notes |
|---|---|---|---|
| HPI-O | `http://ns.electronichealth.net.au/id/hi/hpio/1.0` | 8003 62xx xxxx xxxx (16 digits) | HI Service registration |
| ABN | `http://ns.electronichealth.net.au/id/abn` | 11 digits | Modulus 89 check |

---

## Code Systems

### Diagnosis Coding — ICD-10-AM

Australian hospitals use ICD-10-AM (currently 12th edition), not WHO ICD-10. System URI:

```
https://www.aihw.gov.au/reports-data/myhospitals/content/data-sources/ICD-10-AM
```

ICD-10-AM shares the ICD-10 chapter structure but introduces Australian-specific codes. Required for all AIHW Admitted Patient Care (APC) national data submissions.

### Procedure Coding — ACHI

ACHI is the companion to ICD-10-AM for admitted patient procedure coding:

```
https://www.aihw.gov.au/reports-data/myhospitals/content/data-sources/ACHI
```

### Drug Coding — PBS and AMT

- **PBS item codes** (`http://pbs.gov.au/code/item`): Required on PBS prescription claims submitted to Services Australia.
- **AMT** (`http://snomed.info/sct`): SNOMED CT-based Australian medicines terminology for eHealth systems. Use in FHIR Medication resources.

### Medicare Benefits — MBS

MBS item codes identify Medicare-rebatable services:

```
http://www.health.gov.au/medicare-benefits-schedule
```

MBS items are required on Medicare claim forms submitted to Services Australia.

---

## Value Sets

### Indigenous Status

AIHW METeOR standard indigenous status codes (1–4, 9) are required under NSQHS Standard 5 and for AIHW national reporting. Self-reported data is strongly preferred. Documented in `value-sets.tsp` as `AUIndigenousStatus`.

| Code | Meaning |
|---|---|
| `1` | Aboriginal but not Torres Strait Islander |
| `2` | Torres Strait Islander but not Aboriginal |
| `3` | Both Aboriginal and Torres Strait Islander |
| `4` | Neither Aboriginal nor Torres Strait Islander |
| `9` | Not stated / inadequately described |

### Mode of Separation (Discharge Type)

AIHW mode of separation codes identify how an admitted patient episode ended. Required for Admitted Patient Care national data collection. Key codes: 2 (home), 3 (transfer), 4 (left AMA), 6 (death). Full set in `value-sets.tsp` as `AUModeOfSeparation`.

### State and Territory Codes

ISO 3166-2:AU-aligned codes for the eight states and territories. Documented in `value-sets.tsp` as `AUStateTerritoryCode`.

---

## Terminology Mappings

Full mapping documentation in `terminology-map.tsp`. Summary:

| Source System | Target System | Method | Completeness |
|---|---|---|---|
| AMT | SNOMED CT | Direct (AMT IS SNOMED CT) | Complete for AMT concepts |
| ICD-10-AM | WHO ICD-10 | Truncate to 3-char parent | Partial — loses AU-specific detail |
| ACHI | SNOMED CT | ADHA NCTIS reference sets | Partial |
| PBS | AMT | ADHA AMT/PBS crosswalk | Near-complete for listed items |

---

## My Health Record Requirements

Systems participating in My Health Record must:

1. Verify the patient IHI against the HI Service before uploading documents.
2. Use ADHA-defined FHIR document types and CDA templates (or FHIR R4 equivalents per ADHA IG).
3. Include HPI-I (or HPI-O) of the authoring provider and organisation.
4. Documents must include at least one ICD-10-AM or SNOMED CT coded diagnosis where clinically applicable.
5. Medications must be coded using AMT (SNOMED CT-based) concepts.
6. Comply with the My Health Records Act 2012, Regulations, and System Operator Rules.

---

## Key Regulations

| Regulation | Subject | Relevance |
|---|---|---|
| Privacy Act 1988 (Cth) | Personal information protection | Health information is sensitive; APPs apply |
| Healthcare Identifiers Act 2010 (Cth) | IHI, HPI-I, HPI-O management | Governs use of national healthcare identifiers |
| My Health Records Act 2012 (Cth) | My Health Record system | Legal framework for national health record repository |
| Therapeutic Goods Act 1989 (Cth) | Drug and device regulation | TGA approval, ARTG listing, PBS listing |
| National Health Act 1953 (Cth) | Medicare and PBS | Legal basis for Medicare Benefits Schedule and PBS |
| NSQHS Standards | Safety and quality | Standard 5 mandates indigenous status collection |
| ADHA FHIR IG | eHealth interoperability | Technical standards for My Health Record and secure messaging |
| Notifiable Data Breaches scheme (Privacy Act Part IIIC) | Breach notification | 30-day notification to OAIC and affected individuals |

---

## Official Sources

| Source | URL |
|---|---|
| Australian Digital Health Agency | https://www.digitalhealth.gov.au |
| ADHA FHIR Implementation Guide | https://build.fhir.org/ig/hl7au/au-fhir-base |
| AIHW METeOR | https://meteor.aihw.gov.au |
| National Clinical Terminology Service | https://www.healthterminologies.gov.au |
| Services Australia (Medicare/HI Service) | https://www.servicesaustralia.gov.au |
| TGA | https://www.tga.gov.au |
| PBS (Department of Health) | https://www.pbs.gov.au |
| MBS Online | http://www.mbsonline.gov.au |
| AHPRA | https://www.ahpra.gov.au |
| OAIC (Privacy) | https://www.oaic.gov.au |
| ACSQHC (NSQHS Standards) | https://www.safetyandquality.gov.au |
| Healthcare Identifiers Act 2010 | https://www.legislation.gov.au/Series/C2010A00072 |
| My Health Records Act 2012 | https://www.legislation.gov.au/Series/C2012A00063 |
