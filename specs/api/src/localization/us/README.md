# US Healthcare Localization Pack

**Jurisdiction**: United States of America (US)
**ISO 3166-1 alpha-2**: US
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
7. [Compliance Notes](#compliance-notes)
8. [Terminology Mappings](#terminology-mappings)
9. [Key Regulations](#key-regulations)
10. [Official Sources](#official-sources)

---

## Overview

This localization pack adapts the Monobase Healthcare API Standards Foundation for deployment in US healthcare facilities. It covers compliance with HIPAA (Health Insurance Portability and Accountability Act), HITECH (Health Information Technology for Economic and Clinical Health Act), the 21st Century Cures Act, CMS (Centers for Medicare & Medicaid Services) billing requirements, and FDA drug and device regulations.

The pack is **standalone and non-imported by core**. It does not modify any core entity definitions. It provides URI constants, enumerations, compliance flags, and mapping documentation that US implementations layer on top of the core model.

### Scope

- NPI, MBI, Medicaid ID, DEA number, state medical license identifiers
- ICD-10-CM, ICD-10-PCS, CPT, HCPCS, NDC, CVX/MVX, NUBC, DRG code systems
- NUBC discharge disposition codes (01–70)
- OMB race and ethnicity categories
- US Core birth sex and gender identity value sets
- DEA controlled substance schedules I–V
- HIPAA sensitivity flags (42 CFR Part 2, HIV, mental health, reproductive, genetic, psychotherapy notes)
- State consent law indicators and minimum necessary designations
- Terminology mapping guidance: NDC to RxNorm, ICD-10-CM to WHO ICD-10, CVX to SNOMED CT

---

## Regulatory Context

### HIPAA and HITECH

The Health Insurance Portability and Accountability Act (Pub. L. 104-191, 1996) and the Health Information Technology for Economic and Clinical Health Act (Pub. L. 111-5, 2009) form the primary federal framework for US healthcare data privacy and security.

- **HIPAA Privacy Rule** (45 CFR Part 164 Subpart E): Governs the use and disclosure of Protected Health Information (PHI). Establishes patient rights including access, amendment, and accounting of disclosures.
- **HIPAA Security Rule** (45 CFR Parts 160 and 164 Subparts A and C): Requires administrative, physical, and technical safeguards for electronic PHI (ePHI).
- **HIPAA Breach Notification Rule** (45 CFR Part 164 Subpart D): Mandates notification to affected individuals, HHS, and in some cases the media within 60 days of discovery of a breach of unsecured PHI.
- **HITECH Act**: Strengthened HIPAA enforcement, extended Privacy and Security Rule obligations to Business Associates, and increased civil monetary penalties.

### 21st Century Cures Act and Information Blocking

The 21st Century Cures Act (Pub. L. 114-255, 2016) and the ONC Information Blocking Rule (45 CFR Part 171) prohibit healthcare actors from taking actions that unreasonably restrict access, exchange, or use of Electronic Health Information (EHI).

- Providers, HIT developers, and health information networks must not engage in information blocking.
- EHI encompasses the USCDI (United States Core Data for Interoperability) data elements.
- Certified Health IT must implement standardized APIs (SMART on FHIR) per 45 CFR Part 170.315(g)(10).

### CMS and Billing Regulations

CMS administers Medicare and Medicaid and sets billing standards affecting all US healthcare entities:

- **ICD-10-CM/PCS mandate**: Required on all Medicare and Medicaid claims since October 1, 2015.
- **NPI mandate**: National Provider Identifier required on all HIPAA electronic transactions under 45 CFR 162.410.
- **HIPAA 5010 transactions**: Electronic claims, remittance, and eligibility transactions must conform to ASC X12N 5010 standards.
- **Inpatient PPS**: Medicare inpatient reimbursement based on MS-DRG (Medicare Severity Diagnosis Related Group) classification.

### FDA

The Food and Drug Administration regulates drugs, biologics, medical devices, and laboratory tests. Key identifiers:

- **NDC (National Drug Code)**: FDA-assigned 11-digit identifier required on all drug labeling and claims.
- **UDI (Unique Device Identifier)**: Required on medical device labels and in EHRs for implantable devices.
- **510(k), PMA clearance numbers**: Device market authorization identifiers.

### 42 CFR Part 2 — Substance Use Disorder Records

42 CFR Part 2 imposes stricter confidentiality requirements on SUD (substance use disorder) patient records from federally assisted programs than standard HIPAA. Key points:

- Disclosure requires explicit written patient consent with specific elements beyond standard HIPAA authorization.
- Records may not be re-disclosed without patient consent.
- Cannot be used in criminal investigations or prosecutions without a court order.
- Systems must implement segregated access controls for 42 CFR Part 2 records.

---

## Pack Contents

| File | Purpose |
|---|---|
| `code-systems.tsp` | URI constants for US-specific code systems (ICD-10-CM, CPT, HCPCS, NDC, NPI, NUBC, CVX, etc.) |
| `identifiers.tsp` | URI constants and validation patterns for US identifier systems (NPI, SSN, MBI, DEA, state licenses) |
| `value-sets.tsp` | Enumerated value sets: NUBC discharge dispositions, OMB race/ethnicity, US Core birth sex and gender identity, controlled substance schedules, preferred languages |
| `compliance-notes.tsp` | HIPAA sensitivity flags, state consent law indicators, minimum necessary designations |
| `terminology-map.tsp` | Documented mapping relationships between US local codes and international standards |
| `README.md` | This file |

---

## Identifier Systems

### Patient Identifiers

| Identifier | System URI | Format | Validation Pattern |
|---|---|---|---|
| MBI (Medicare) | `http://hl7.org/fhir/sid/us-medicare-beneficiary-id` | 11 chars alphanumeric | See identifiers.tsp |
| Medicaid ID | `http://hl7.org/fhir/sid/us-medicaid` | State-defined | Varies by state |
| SSN (RESTRICTED) | `http://hl7.org/fhir/sid/us-ssn` | XXX-XX-XXXX | Never store full; last 4 only |

**Usage on Patient resource:**

```json
{
  "resourceType": "Patient",
  "identifier": [
    {
      "system": "http://hl7.org/fhir/sid/us-medicare-beneficiary-id",
      "value": "1EG4-TE5-MK72"
    }
  ]
}
```

### Practitioner Identifiers

| Identifier | System URI | Format | Validation Pattern |
|---|---|---|---|
| NPI | `http://hl7.org/fhir/sid/us-npi` | 10 digits | `^\d{10}$` (Luhn check) |
| DEA Number | `https://www.deadiversion.usdoj.gov/registration` | 2 letters + 7 digits | `^[A-Z]{2}\d{7}$` |
| State Medical License | `https://www.fsmb.org/licensure` | State-defined | Varies by state board |

**Usage on Practitioner resource:**

```json
{
  "resourceType": "Practitioner",
  "identifier": [
    {
      "system": "http://hl7.org/fhir/sid/us-npi",
      "value": "1234567893"
    },
    {
      "system": "https://www.deadiversion.usdoj.gov/registration",
      "value": "AB1234563"
    }
  ]
}
```

### Facility / Organization Identifiers

| Identifier | System URI | Format | Notes |
|---|---|---|---|
| NPI (Type 2) | `http://hl7.org/fhir/sid/us-npi` | 10 digits | Organizational NPI |
| EIN | `urn:oid:2.16.840.1.113883.4.4` | XX-XXXXXXX | IRS tax ID |
| CLIA Number | `https://www.cms.gov/clia` | 10 chars | Required for labs |

---

## Code Systems

### Diagnosis Coding — ICD-10-CM

The US uses ICD-10-CM (Clinical Modification), not the WHO base ICD-10. System URI:

```
http://hl7.org/fhir/sid/icd-10-cm
```

ICD-10-CM codes are a superset of WHO ICD-10. The first three characters typically match the WHO parent code, with US-specific clinical specificity added in subsequent characters.

### Procedure Coding

- **Inpatient (ICD-10-PCS)**: `http://www.cms.gov/Medicare/Coding/ICD10`
- **Outpatient/Physician (CPT)**: `http://www.ama-assn.org/go/cpt`
- **Supplies/DME (HCPCS)**: `https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets`

### Drug Coding — NDC

The FDA National Drug Code (11-digit format) is the primary drug identifier for US claims:

```
http://hl7.org/fhir/sid/ndc
```

NDC → RxNorm mapping available via the NLM RxNorm API. For FHIR medication resources, RxNorm is preferred for clinical decision support; NDC is required on claims.

### Vaccine Coding — CVX/MVX

CDC CVX codes for vaccine products and MVX for manufacturers:

```
http://hl7.org/fhir/sid/cvx
http://hl7.org/fhir/sid/mvx
```

Required for immunization reporting to state IIS and CMS quality programs.

---

## Value Sets

### Discharge Dispositions (NUBC)

NUBC discharge disposition codes 01–70 are required on UB-04 claims. Key codes:

| Code | Meaning |
|---|---|
| `01` | Discharged to home (routine) |
| `07` | Left against medical advice (AMA) |
| `20` | Expired |
| `50` | Discharged to hospice — home |
| `62` | Transferred to inpatient rehabilitation |
| `65` | Transferred to psychiatric facility |

Full set documented in `value-sets.tsp` as `USDischargeDisposition`.

### Race and Ethnicity (OMB)

OMB 1997 race and ethnicity standards are required for federal reporting. Race and ethnicity are separate data elements. Self-reported data is preferred. Collected and stored per USCDI v3 requirements.

### Controlled Substance Schedules (DEA)

DEA schedules I–V determine prescribing authority and refill restrictions. Schedule II substances require a DEA-compliant electronic or paper prescription with no refills. See `value-sets.tsp` for `USControlledSubstanceSchedule`.

---

## Compliance Notes

See `compliance-notes.tsp` for the full enumeration. Key flags:

### HIPAA Sensitivity Flags

| Flag | Code | Description |
|---|---|---|
| 42 CFR Part 2 | `SUD` | Substance use disorder records — explicit consent required for all disclosures |
| HIV | `HIV` | State law heightened protections in most US states |
| Mental Health | `MH` | State mental health privacy laws — stricter than HIPAA in most states |
| Reproductive | `REP` | Post-Dobbs state law protections — apply strict data residency |
| Genetic | `GEN` | GINA protections — prohibited from use in insurance underwriting |
| Psychotherapy Notes | `PSY` | Separately defined under HIPAA; requires specific authorization |

### Minimum Necessary Standard

All access to PHI must be limited to the minimum necessary per 45 CFR 164.502(b). Designations:

| Level | Code | Use |
|---|---|---|
| Full PHI | `FULL` | Treating providers in active episode of care |
| Limited Data Set | `LDS` | Research/public health with Data Use Agreement |
| De-identified | `DEID` | Analytics, no HIPAA restrictions post-de-identification |
| Restricted | `RESTR` | 42 CFR Part 2, psychotherapy notes — explicit authorization required |

---

## Terminology Mappings

Full mapping documentation in `terminology-map.tsp`. Summary:

| Source System | Target System | Method | Completeness |
|---|---|---|---|
| NDC | RxNorm | NLM RxNorm API crosswalk | High — NLM maintains authoritative mapping |
| ICD-10-CM | WHO ICD-10 | Truncate to 3-character parent | Partial — loses US-specific clinical detail |
| CPT | SNOMED CT | SNOMED CT to CPT maps (NLM) | Partial |
| CVX | SNOMED CT | CDC published crosswalk | Near-complete for active CVX codes |
| NUBC disposition | HL7 v3 | Manual mapping | Partial |

---

## Key Regulations

| Regulation | Subject | Relevance |
|---|---|---|
| HIPAA Privacy Rule (45 CFR Part 164) | PHI use and disclosure | Primary US health data privacy law |
| HIPAA Security Rule (45 CFR Parts 160, 164) | ePHI safeguards | Technical and administrative security requirements |
| HIPAA Breach Notification Rule | Breach reporting | 60-day notification requirement |
| HITECH Act (Pub. L. 111-5, 2009) | HIPAA enforcement strengthening | Increased penalties, Business Associate liability |
| 21st Century Cures Act (Pub. L. 114-255, 2016) | Information blocking prohibition | Mandatory FHIR API access, EHI access rights |
| ONC Information Blocking Rule (45 CFR Part 171) | Information blocking enforcement | Applies to Providers, HIT Developers, HINs |
| 42 CFR Part 2 | SUD record confidentiality | Stricter than HIPAA; explicit consent required |
| GINA (Pub. L. 110-233, 2008) | Genetic information | Prohibits genetic discrimination in insurance/employment |
| FDA 21 CFR | Drug and device regulation | NDC, UDI requirements |
| CMS ICD-10 mandate (45 CFR Part 162) | Diagnosis/procedure coding | ICD-10-CM/PCS required on all CMS claims from Oct 2015 |
| ONC USCDI v3 | Interoperability data standard | Defines minimum EHI elements for certified HIT |

---

## Official Sources

| Source | URL |
|---|---|
| HHS HIPAA home | https://www.hhs.gov/hipaa |
| HHS Office for Civil Rights (OCR) | https://www.hhs.gov/ocr/privacy |
| CMS Medicare coding | https://www.cms.gov/Medicare/Coding |
| ONC Health IT | https://www.healthit.gov |
| FDA NDC directory | https://www.fda.gov/drugs/drug-approvals-and-databases/national-drug-code-directory |
| NLM RxNorm | https://www.nlm.nih.gov/research/umls/rxnorm |
| CDC CVX codes | https://www2.cdc.gov/vaccines/iis/iisstandards/vaccines.asp?rpt=cvx |
| NUBC | https://www.nubc.org |
| DEA diversion control | https://www.deadiversion.usdoj.gov |
| AMA CPT | https://www.ama-assn.org/practice-management/cpt |
| ONC USCDI | https://www.healthit.gov/isa/united-states-core-data-interoperability-uscdi |
| 42 CFR Part 2 (SAMHSA) | https://www.samhsa.gov/about-us/who-we-are/laws-regulations/confidentiality-regulations-faqs |
