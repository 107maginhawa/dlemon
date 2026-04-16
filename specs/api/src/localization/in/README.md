# Indian Healthcare Localization Pack

**Jurisdiction**: India (IN)
**ISO 3166-1 alpha-2**: IN
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
8. [ABDM Integration Requirements](#abdm-integration-requirements)
9. [Key Regulations](#key-regulations)
10. [Official Sources](#official-sources)

---

## Overview

This localization pack adapts the Monobase Healthcare API Standards Foundation for deployment in Indian healthcare settings under the Ayushman Bharat Digital Mission (ABDM) / National Digital Health Mission (NDHM). It covers compliance with the DPDP Act 2023 (Digital Personal Data Protection Act), ABDM Health Data Management Policy, NMC Act 2020, CDSCO drug regulations, and PM-JAY (Pradhan Mantri Jan Arogya Yojana) insurance scheme requirements.

The pack is **standalone and non-imported by core**. It does not modify any core entity definitions. It provides URI constants, enumerations, and mapping documentation that Indian implementations layer on top of the core model.

### Scope

- ABHA Number, ABHA Address, Aadhaar (restricted), HFIR, HPR, and NMC identifier systems
- ABDM-mandated code systems: SNOMED CT, LOINC, ICD-10, NLEM, AYUSH, PM-JAY HBP
- Indian state/UT codes, hospital types, AYUSH treatment systems, PM-JAY package categories
- Terminology mapping: NLEM to ATC/SNOMED CT, ICD-10 (already WHO standard), HPR to FHIR

---

## Regulatory Context

### ABDM / NDHM (Ayushman Bharat Digital Mission)

The Ayushman Bharat Digital Mission (originally the National Digital Health Mission) is India's flagship digital health initiative launched in 2021. Key components:

- **ABHA (Ayushman Bharat Health Account)**: National health ID system. Every citizen can register for a 14-digit ABHA Number and ABHA Address (username@abdm).
- **Health Facility Registry (HFR)**: National registry of health facilities. All registered facilities receive an HFIR ID.
- **Healthcare Professionals Registry (HPR)**: National registry of healthcare professionals. All regulated practitioners receive an HPR ID.
- **Health Information Exchange (HIE-CM)**: Federated infrastructure for sharing health records between consenting patients and providers using ABHA Address.
- **Unified Health Interface (UHI)**: Open protocol for interoperable telemedicine and health services.
- **ABDM Health Data Management Policy**: Governs data collection, storage, sharing, and consent within the ABDM ecosystem.

ABDM mandates FHIR R4 for all connected health applications. Detailed technical specifications are published by the NHA.

### DPDP Act 2023 (Digital Personal Data Protection Act)

The Digital Personal Data Protection Act 2023 (Pub. L. No. 22 of 2023) is India's primary data protection law:

- **Data Fiduciary**: Entity collecting and processing personal data. Analogous to GDPR data controller.
- **Data Principal**: The individual whose data is processed (the patient).
- **Consent**: Processing requires valid consent (free, specific, informed, unconditional, and unambiguous) except for specified legitimate uses.
- **Purpose limitation**: Data may be used only for the stated purpose.
- **Data minimisation**: Collect only data necessary for the stated purpose.
- **Data Principal rights**: Right to access, correction, erasure, and grievance redressal.
- **Data Protection Board**: Adjudicatory body for complaints and penalties.
- **Significant penalties**: Financial penalties up to INR 250 crore for specified violations.

Health data is not yet separately defined as "sensitive personal data" in the 2023 Act (unlike the earlier PDPB 2019 draft), but ABDM and sector-specific regulations impose additional protections.

### Aadhaar Restrictions

The Supreme Court of India in K.S. Puttaswamy v. Union of India (2018) held that Aadhaar may only be used for government welfare schemes and tax purposes. The Aadhaar Act 2016 prohibits:

- Mandatory collection of Aadhaar by private entities.
- Storage of biometric data (fingerprints, iris scans) by anyone other than UIDAI.
- Use of Aadhaar as a prerequisite for any service by private health facilities.

Health information systems must NOT collect, store, or use Aadhaar as a patient identifier. ABHA Number is the correct substitute.

### NMC (National Medical Commission)

The National Medical Commission Act 2020 replaced the Medical Council of India (MCI). NMC regulates:

- Medical education standards and medical colleges.
- Registration of medical practitioners (MBBS, postgraduate specialists).
- Ethics and professional conduct.
- NMC maintains the Indian Medical Register (IMR) of all licensed allopathic practitioners.

State Medical Councils register practitioners at the state level; NMC maintains the federal register.

### CDSCO (Central Drugs Standard Control Organisation)

CDSCO is the national regulatory authority for drugs and medical devices under the Drugs and Cosmetics Act 1940:

- Schedule H drugs require a valid prescription from a registered practitioner.
- Schedule H1 drugs (antibiotics, anti-TB, anti-cancer) require additional prescription record retention.
- Schedule X drugs (narcotic/psychotropic) are highly controlled substances.
- Medical devices are regulated under the Medical Devices Rules 2017.

### PM-JAY (Pradhan Mantri Jan Arogya Yojana)

PM-JAY (Ayushman Bharat — Health and Wellness Centres component) provides health coverage of INR 5 lakh per family per year for secondary and tertiary hospitalisation. Key aspects:

- Covers approximately 500 million people (lower income quintiles).
- Cashless treatment at empanelled public and private hospitals.
- Claims processed using HBP (Health Benefit Package) codes published by NHA.
- State variants (e.g., Arogyasri in Andhra Pradesh, Mahatma Jyotiba Phule Jan Arogya Yojana in Maharashtra) may have additional package codes.

---

## Pack Contents

| File | Purpose |
|---|---|
| `code-systems.tsp` | URI constants for Indian code systems (SNOMED CT ABDM, LOINC, ICD-10, NLEM, AYUSH, NMC, CDSCO, PM-JAY HBP) |
| `identifiers.tsp` | URI constants and validation patterns for Indian identifier systems (ABHA Number, ABHA Address, Aadhaar RESTRICTED, HFIR, HPR, NMC, PMJAY) |
| `value-sets.tsp` | Enumerated value sets: state/UT codes, hospital types, AYUSH systems, PM-JAY package categories |
| `terminology-map.tsp` | Documented mapping relationships between Indian local codes and international standards |
| `README.md` | This file |

---

## Identifier Systems

### Patient Identifiers

| Identifier | System URI | Format | Notes |
|---|---|---|---|
| ABHA Number | `https://healthid.ndhm.gov.in` | XX-XXXX-XXXX-XXXX (14 digits) | Verhoeff check digit; primary ABDM patient ID |
| ABHA Address | `https://healthid.ndhm.gov.in/abha-address` | username@abdm | Human-readable health record address |
| Aadhaar | `https://uidai.gov.in` | 12 digits | RESTRICTED — NEVER store; do not use as health ID |
| PMJAY Beneficiary ID | `https://pmjay.gov.in/beneficiary` | Alphanumeric | PM-JAY scheme beneficiaries only |

**Usage on Patient resource:**

```json
{
  "resourceType": "Patient",
  "identifier": [
    {
      "system": "https://healthid.ndhm.gov.in",
      "value": "91-1234-5678-9012"
    },
    {
      "system": "https://healthid.ndhm.gov.in/abha-address",
      "value": "john.doe@abdm"
    }
  ]
}
```

### Practitioner Identifiers

| Identifier | System URI | Format | Notes |
|---|---|---|---|
| HPR ID | `https://hpr.abdm.gov.in` | 14-digit numeric | All ABDM-registered practitioners |
| NMC Registration | `https://www.nmc.org.in/registration` | State code + number | Allopathic physicians only |
| State Medical Council | `https://abdm.gov.in/hpr/practitioner` | Varies by state | Carry alongside NMC registration |

### Facility / Organisation Identifiers

| Identifier | System URI | Format | Notes |
|---|---|---|---|
| HFIR ID | `https://facility.abdm.gov.in` | Alphanumeric | ABDM Health Facility Registry |

---

## Code Systems

### Clinical Coding — SNOMED CT

ABDM mandates SNOMED CT for clinical data coding (diagnoses, procedures, clinical findings) in FHIR resources. System URI:

```
http://snomed.info/sct
```

NRCeS (National Resource Centre for EHR Standards, Pune) provides guidance on SNOMED CT implementation in Indian EHR systems. India has access to SNOMED CT via the SNOMED CT India National Member agreement.

### Diagnosis Coding — ICD-10

For billing and statistical reporting, ICD-10 (WHO base edition) is used. System URI:

```
http://hl7.org/fhir/sid/icd-10
```

India does not use a national modification (ICD-10-IN does not exist). The WHO ICD-10 base edition is used directly.

### Drug Coding — NLEM

The National List of Essential Medicines (2022 edition, 384 medicines) is used for public procurement and PM-JAY package definitions:

```
https://main.mohfw.gov.in/NLEM
```

For clinical FHIR Medication resources, SNOMED CT drug concepts are preferred. NLEM codes are used in PM-JAY HBP package definitions and government procurement.

### PM-JAY Health Benefit Packages

HBP codes are used for PM-JAY claim processing at empanelled hospitals:

```
https://pmjay.gov.in/hbp
```

The NHA publishes the authoritative HBP code list, rates, and package inclusions/exclusions annually.

---

## Value Sets

### Indian State and UT Codes

ISO 3166-2:IN-aligned codes for all 28 states and 8 Union Territories. Required in HFR and HPR registrations. Documented in `value-sets.tsp` as `INStateTerritoryCode`.

### Hospital Types

ABDM HFR hospital type codes classify facilities by ownership. Key codes: `GOVT`, `PRIV`, `TRUST`, `ESI`, `CGHS`, `AYUSH`. Full set in `value-sets.tsp` as `INHospitalType`.

### AYUSH Systems

Ministry of AYUSH recognised traditional medicine systems: Ayurveda (AY), Yoga and Naturopathy (YO), Unani (UN), Siddha (SI), Homeopathy (HO), Sowa Rigpa (SO). Documented as `INAYUSHSystem`.

### PM-JAY Package Categories

NHA HBP package categories used for PM-JAY claim classification. 15 categories including Medical, Surgical, Oncology, Cardiology, ICU, AYUSH, and others. Documented as `INPMJAYPackageCategory`.

---

## Terminology Mappings

Full mapping documentation in `terminology-map.tsp`. Summary:

| Source System | Target System | Method | Completeness |
|---|---|---|---|
| ICD-10 (India) | WHO ICD-10 | Direct (India uses WHO ICD-10 unmodified) | Complete |
| NLEM generic name | ATC / SNOMED CT | Via WHO INN / ATC classification | Partial — covers essential medicines only |
| PM-JAY HBP | SNOMED CT | NHA HBP-to-SNOMED mapping | Partial |
| AYUSH | SNOMED CT | ABDM AYUSH SNOMED extension | Growing — in active development |

---

## ABDM Integration Requirements

Systems connecting to ABDM must:

1. Implement FHIR R4 per ABDM Technical Specification (published by NHA).
2. Support ABHA Number verification via the ABDM gateway API before creating health records.
3. Obtain explicit patient consent before accessing or sharing health records through HIE-CM.
4. Use ABDM sandbox (https://sandbox.abdm.gov.in) for development and testing.
5. Complete ABDM Sandbox milestone certification before production onboarding.
6. Comply with the ABDM Health Data Management Policy for data retention, security, and audit logging.
7. Implement audit logs for all access to health records per ABDM requirements.
8. Must NOT link Aadhaar in application logic — Aadhaar linkage is managed by the patient through NHA services only.

---

## Key Regulations

| Regulation | Subject | Relevance |
|---|---|---|
| DPDP Act 2023 (Pub. L. No. 22 of 2023) | Digital personal data protection | Primary Indian data protection law; consent, minimisation, Principal rights |
| Aadhaar Act 2016 | Aadhaar unique identity | Restricts private sector use; prohibits storing biometrics |
| K.S. Puttaswamy v. Union of India (2018) | Supreme Court privacy judgment | Privacy is a fundamental right; limits Aadhaar use in health |
| NMC Act 2020 | Medical practitioner regulation | Replaced MCI; NMC registers allopathic practitioners |
| Drugs and Cosmetics Act 1940 | Drug regulation | CDSCO authority; Schedule H, H1, X prescription requirements |
| Medical Devices Rules 2017 | Device regulation | UDI-equivalent requirements for medical devices |
| National Health Policy 2017 | Health system direction | Policy framework for ABDM and universal health coverage goals |
| ABDM Health Data Management Policy | ABDM data governance | Binding policy for all ABDM-connected entities |
| IT Act 2000 (as amended 2008) | Electronic records and cybercrime | Legal validity of electronic health records and digital signatures |
| PMJAY Scheme Guidelines | PM-JAY insurance scheme | Empanelment, claims processing, HBP code usage |
| Clinical Establishments Act 2010 | Clinical establishment registration | Registration and standards for clinical establishments |

---

## Official Sources

| Source | URL |
|---|---|
| ABDM (Ayushman Bharat Digital Mission) | https://abdm.gov.in |
| NHA (National Health Authority) | https://www.nha.gov.in |
| ABDM Developer Portal | https://sandbox.abdm.gov.in |
| ABHA Health ID | https://healthid.ndhm.gov.in |
| Health Facility Registry | https://facility.abdm.gov.in |
| Healthcare Professionals Registry | https://hpr.abdm.gov.in |
| PM-JAY (Ayushman Bharat) | https://pmjay.gov.in |
| NMC (National Medical Commission) | https://www.nmc.org.in |
| CDSCO | https://cdsco.gov.in |
| Ministry of AYUSH | https://main.ayush.gov.in |
| NRCeS (EHR Standards) | http://www.nrces.in |
| MoHFW (NLEM) | https://main.mohfw.gov.in |
| UIDAI (Aadhaar) | https://uidai.gov.in |
| DPDP Act 2023 | https://www.meity.gov.in/data-protection-framework |
| IT Act 2000 | https://www.meity.gov.in/content/information-technology-act |
