# Philippine Healthcare Localization Pack

**Jurisdiction**: Philippines (PH)
**ISO 3166-1 alpha-2**: PH
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
8. [PhilHealth Claims Requirements](#philhealth-claims-requirements)
9. [Medical Record Retention](#medical-record-retention)
10. [Key Regulations](#key-regulations)
11. [Official Sources](#official-sources)

---

## Overview

This localization pack adapts the Monobase Healthcare API Standards Foundation for deployment in Philippine healthcare facilities. It covers integration with the Philippine Health Insurance Corporation (PhilHealth), compliance with Department of Health (DOH) regulatory requirements, professional licensing via the Professional Regulation Commission (PRC), and Philippine-specific clinical value sets.

The pack is **standalone and non-imported by core**. It does not modify any core entity definitions. It provides URI constants, enumerations, and mapping documentation that Philippine implementations layer on top of the core model.

### Scope

- PhilHealth member and provider identifiers
- DOH facility licensing and registry identifiers
- PRC professional license identifiers
- Philippine National Drug Formulary (PNDF) code system URI
- PhilHealth Relative Value Scale (RVS) procedure codes
- PhilHealth Case Type classification (A, B, C, D)
- Philippine discharge disposition codes
- Philippine hospital ward type classifications
- Philippine hospital level classifications (DOH AO 2012-0012)
- Terminology mapping guidance: PNDF to RxNorm, RVS to CPT, local identifiers to FHIR

---

## Regulatory Context

### Department of Health (DOH)

The DOH is the principal health agency of the Philippine government. Its key regulatory roles affecting this pack:

- **Health facility licensing**: Issues the License to Operate (LTO) for all healthcare facilities under DOH Administrative Order 2012-0012.
- **National Health Facility Registry (NHFR)**: Assigns unique facility codes to all registered Philippine health facilities.
- **Philippine National Drug Formulary (PNDF)**: Maintains the list of essential medicines. Facilities receiving government funding must stock PNDF-listed drugs.
- **ICD-10 mandate**: DOH mandates use of the WHO edition of ICD-10 (not ICD-10-CM) for diagnosis coding in all Philippine healthcare facilities.
- **Hospital classification**: DOH classifies hospitals as Level 1, 2, or 3 based on service capability under DOH AO 2012-0012.

### Philippine Health Insurance Corporation (PhilHealth / PHIC)

PhilHealth administers the National Health Insurance Program (NHIP) under Republic Act 7875 (as amended by RA 9241 and RA 10606). Its key roles:

- **Member identification**: Issues the PhilHealth Identification Number (PIN) to all members. The PIN is required on all claims submissions.
- **Facility accreditation**: Accredits healthcare facilities for participation in the NHIP. Accreditation numbers are required for claims.
- **Claims processing**: Processes claims via the eClaims system (PBEF — PhilHealth Benefits Entry Form). Claims must use ICD-10 diagnosis codes and RVS procedure codes.
- **Case Type classification**: Assigns Case Types A through D to inpatient encounters, determining documentation requirements and reimbursement rates.
- **Benefit packages**: Defines covered services and All Case Rates (ACR) for inpatient and outpatient services.

### Professional Regulation Commission (PRC)

The PRC regulates professional licensure in the Philippines under RA 8981. For healthcare professionals:

- Issues license numbers to physicians, nurses, pharmacists, dentists, and other licensed health professionals.
- Under RA 2382 (Medical Act of 1959), medical practice in the Philippines requires a valid PRC license.
- PRC license numbers are 7-digit integers and must appear on prescriptions and clinical documents in Philippine facilities.

---

## Pack Contents

| File | Purpose |
|---|---|
| `code-systems.tsp` | URI constants for Philippine-specific code systems (PNDF, RVS, PhilHealth case types, NHFR) |
| `identifiers.tsp` | URI constants and validation patterns for Philippine identifier systems (PhilHealth PIN, PRC license, HRN, DOH LTO) |
| `value-sets.tsp` | Enumerated value sets: discharge dispositions, Case Types, ward types, hospital levels |
| `terminology-map.tsp` | Documented mapping relationships between Philippine local codes and international standards |
| `README.md` | This file |

---

## Identifier Systems

### Patient Identifiers

| Identifier | System URI | Format | Validation Pattern |
|---|---|---|---|
| PhilHealth PIN | `https://philhealth.gov.ph/pin` | XX-XXXXXXXXX-X | `^\d{2}-\d{9}-\d$` |
| Hospital Record Number (HRN) | `https://monobase.health/identifier/ph/hrn` | Facility-defined | Varies by facility |

**Usage on Patient resource:**

```json
{
  "resourceType": "Patient",
  "identifier": [
    {
      "system": "https://philhealth.gov.ph/pin",
      "value": "01-234567890-1"
    },
    {
      "system": "https://monobase.health/identifier/ph/hrn",
      "value": "2024-00001234"
    }
  ]
}
```

### Practitioner Identifiers

| Identifier | System URI | Format | Validation Pattern |
|---|---|---|---|
| PRC License Number | `https://prc.gov.ph/license` | 7-digit number | `^\d{7}$` |

**Usage on Practitioner resource:**

```json
{
  "resourceType": "Practitioner",
  "identifier": [
    {
      "system": "https://prc.gov.ph/license",
      "value": "0123456"
    }
  ]
}
```

### Facility / Organization Identifiers

| Identifier | System URI | Format | Notes |
|---|---|---|---|
| NHFR Facility Code | `https://nhfr.doh.gov.ph/facility-code` | Assigned by DOH | Unique per registered facility |
| PhilHealth Accreditation Number | `https://philhealth.gov.ph/accreditation` | Numeric | Required for claims submission |
| DOH License to Operate (LTO) | `https://doh.gov.ph/lto` | Varies by facility type | Renewed annually |

**Usage on Organization resource:**

```json
{
  "resourceType": "Organization",
  "identifier": [
    {
      "system": "https://nhfr.doh.gov.ph/facility-code",
      "value": "DOH-NCR-H-001234"
    },
    {
      "system": "https://philhealth.gov.ph/accreditation",
      "value": "000123456789"
    },
    {
      "system": "https://doh.gov.ph/lto",
      "value": "LTO-2024-NCR-00456"
    }
  ]
}
```

### Coverage Identifier

PhilHealth PIN is also carried on `Coverage` resources to identify the insurance membership:

```json
{
  "resourceType": "Coverage",
  "identifier": [
    {
      "system": "https://philhealth.gov.ph/pin",
      "value": "01-234567890-1"
    }
  ],
  "payor": [
    {
      "reference": "Organization/philhealth"
    }
  ]
}
```

---

## Code Systems

### Diagnosis Coding — WHO ICD-10

Philippine hospitals use the **WHO edition of ICD-10**, not ICD-10-CM (the US clinical modification). Use the following system URI:

```
http://hl7.org/fhir/sid/icd-10
```

Do **not** use `http://hl7.org/fhir/sid/icd-10-cm` in Philippine contexts. PhilHealth requires ICD-10 codes on all claims per Circular No. 27 S. 2003.

### Procedure Coding — RVS

PhilHealth uses the Relative Value Scale (RVS) for procedure pricing and reimbursement. RVS codes are required on PhilHealth claims.

```
https://philhealth.gov.ph/rvs
```

RVS codes are similar to CPT codes but are not identical. Many RVS codes have approximate CPT equivalents; however, the mapping is partial. For international interoperability, prefer SNOMED CT procedure codes alongside RVS codes.

### Drug Coding — PNDF

The Philippine National Drug Formulary code system is used for essential medicine identification:

```
https://doh.gov.ph/pndf
```

The PNDF is updated periodically by the DOH. PNDF codes can be mapped to the WHO ATC classification as an intermediate step toward RxNorm alignment. See `terminology-map.tsp` for the recommended mapping path: PNDF → ATC → RxNorm.

### Facility Registry — NHFR

```
https://nhfr.doh.gov.ph/facility-code
```

All registered Philippine health facilities have an NHFR code. This is the canonical facility identifier for DOH reporting.

---

## Value Sets

### PhilHealth Case Type

Case Types determine documentation requirements and reimbursement rates for inpatient claims. Set on the `Encounter` or `Claim` resource using the system URI `https://philhealth.gov.ph/case-type`.

| Code | Meaning | Documentation Requirement |
|---|---|---|
| `A` | Simple cases | Minimal — face sheet, order sheet |
| `B` | Moderate cases | Standard — history and PE, progress notes, discharge summary |
| `C` | Complex cases | Enhanced — complete medical records |
| `D` | Highly complex cases | Full clinical abstract and discharge summary REQUIRED |

Regulatory basis: PhilHealth Circular No. 18 S. 2009.

### Discharge Dispositions

Philippine-specific discharge disposition codes supplement the core NUBC disposition set. These are documented in `value-sets.tsp` as `PHDischargeDisposition`. Key codes:

| Code | Meaning |
|---|---|
| `may-go-home` | Standard discharge |
| `dama` | Discharge Against Medical Advice — signed DAMA form required |
| `hama` | Home Against Medical Advice — equivalent to DAMA |
| `expired` | Patient died during hospitalization |
| `transferred` | Transferred to another facility |
| `absconded` | Left without notifying staff |
| `referred-outpatient` | Continuing care as outpatient |

DAMA/HAMA discharges require a signed consent form per DOH guidelines. This code must be documented on the discharge summary submitted with PhilHealth claims.

### Hospital Ward Types

DOH AO 2012-0012 defines the service classification used for ward type coding. The `PHWardType` enum in `value-sets.tsp` covers: Emergency, ICU, ICCU, Medical Ward, Surgical Ward, Pediatric Ward, Obstetric Ward, Nursery, Burns Ward, Post-operative Ward, Postnatal Ward, Psychiatric Ward, Isolation Ward, Private Room, Semi-Private Room, and Charity/Service Ward.

### Hospital Levels

DOH AO 2012-0012 establishes a three-level hospital classification:

| Level | Code | Description |
|---|---|---|
| Level 1 | `L1` | Primary care. Basic emergency and outpatient services. |
| Level 2 | `L2` | Secondary care. Departmentalized with laboratory, imaging, pharmacy. |
| Level 3 | `L3` | Tertiary care. Teaching/training hospital with residency programs. |

---

## Terminology Mappings

Full mapping relationship documentation is in `terminology-map.tsp`. Summary:

| Source System | Target System | Method | Completeness |
|---|---|---|---|
| PNDF | RxNorm | Via ATC intermediate (PNDF → ATC → RxNorm) | Partial — PNDF covers essential medicines only |
| RVS | CPT-4 | Approximate code matching | Partial — not all RVS codes have CPT equivalents |
| RVS | SNOMED CT | Preferred for international exchange | Variable |
| PRC license | (none) | Carry as local identifier with PH system URI | N/A |
| PhilHealth PIN | (none) | Carry as local identifier with PH system URI | N/A |
| NHFR code | (none) | Carry as local identifier with PH system URI | N/A |

---

## PhilHealth Claims Requirements

### Claim Form Types

PhilHealth uses a family of claim forms depending on the benefit package:

| Form | Purpose |
|---|---|
| CF1 | Member data record / enrollment form |
| CF2 | Hospital claim form (inpatient) |
| CF3 | Outpatient claim form |

Electronic claims are submitted via the PBEF (PhilHealth Benefits Entry Form) eClaims portal.

### Required Data Elements on Claims

The following data elements must be present for a PhilHealth claim to be accepted without defect:

| Element | Resource Field | Notes |
|---|---|---|
| PhilHealth PIN | `Patient.identifier` (system: philhealth.gov.ph/pin) | Required on all claims |
| Facility accreditation number | `Organization.identifier` (system: philhealth.gov.ph/accreditation) | Required |
| ICD-10 diagnosis codes | `Condition.code` (system: icd-10) | At least one principal diagnosis required |
| RVS procedure codes | `Procedure.code` (system: philhealth.gov.ph/rvs) | Required for procedure-based claims |
| Case Type | `Encounter` extension (system: philhealth.gov.ph/case-type) | Required for inpatient claims |
| Admission and discharge dates | `Encounter.period.start` / `period.end` | Required for inpatient claims |
| Attending physician PRC license | `Practitioner.identifier` (system: prc.gov.ph/license) | Required |
| Discharge disposition | `Encounter.hospitalization.dischargeDisposition` | Required for inpatient claims |

### Case Type D — Additional Requirements

For Case Type D claims (highly complex cases), a complete clinical abstract or discharge summary is mandatory. The document must reference:

- Complete history and physical examination
- All diagnoses (principal and secondary) with ICD-10 codes
- All procedures performed with RVS codes
- Medication list
- Laboratory and imaging results
- Operative report (if surgical)
- Discharge instructions

Attach via `DocumentReference` linked to the `Encounter`, with `type.coding.code = "discharge-summary"`.

### Defect Codes

PhilHealth issues defect codes when claims are incomplete or incorrect. Defect codes use the system URI `https://philhealth.gov.ph/defect-code`. When a `ClaimResponse` is returned with a denial or defect, the defect code appears in `ClaimResponse.error[].code` with this system URI.

---

## Medical Record Retention

Under **DOH Administrative Order 2022-0007**, Philippine healthcare facilities are required to retain medical records for a minimum of **15 years** from the date of the last entry. Key rules:

- Retention applies to all inpatient and outpatient medical records.
- Records may be retained in electronic form provided they meet DOH digital record-keeping standards.
- Records of minors must be retained for 15 years after the patient reaches the age of majority (18 years).
- Upon facility closure, records must be transferred to a designated repository per DOH guidelines.
- Destruction of records before the retention period expires is prohibited without DOH approval.

Implementations must ensure that soft-delete and archival workflows respect the 15-year minimum before any permanent deletion is permitted for Philippine-jurisdiction records.

---

## Key Regulations

| Regulation | Subject | Relevance |
|---|---|---|
| Republic Act 7875 (as amended by RA 9241, RA 10606) | National Health Insurance Act | Establishes PhilHealth, the NHIP, and claims processing framework |
| Republic Act 2382 | Medical Act of 1959 | Requires PRC license for medical practice; basis for PRC license identifier |
| Republic Act 9439 | Hospital Detention Law | Prohibits hospitals from detaining patients for non-payment; affects discharge workflow |
| DOH Administrative Order 2012-0012 | Hospital licensure and classification | Defines Level 1/2/3 classification and ward type standards |
| DOH Administrative Order 2022-0007 | Medical record retention | Mandates 15-year retention of medical records |
| PhilHealth Circular No. 27 S. 2003 | ICD-10 diagnosis coding | Mandates use of WHO ICD-10 on all PhilHealth claims |
| PhilHealth Circular No. 18 S. 2009 | Case Type classification | Defines Case Types A–D and documentation requirements |

### Republic Act 9439 — Hospital Detention Law

RA 9439 prohibits hospitals from refusing to discharge patients due to inability to pay. Key implications for clinical workflows:

- Discharge must not be blocked by billing status.
- A DAMA/HAMA discharge initiated by the hospital for financial reasons is unlawful.
- Discharge disposition codes must reflect clinical reason, not financial reason.
- Facilities must provide a billing statement and allow installment payments under RA 9439.

---

## Official Sources

| Source | URL |
|---|---|
| PhilHealth official site | https://www.philhealth.gov.ph |
| PhilHealth eClaims portal | https://eclaims.philhealth.gov.ph |
| DOH official site | https://www.doh.gov.ph |
| National Health Facility Registry | https://nhfr.doh.gov.ph |
| Philippine National Drug Formulary | https://www.doh.gov.ph/pndf |
| Professional Regulation Commission | https://www.prc.gov.ph |
| PhilHealth Circular No. 27 S. 2003 | https://www.philhealth.gov.ph/circulars/2003/circ027-2003.pdf |
| PhilHealth Circular No. 18 S. 2009 | https://www.philhealth.gov.ph/circulars/2009/circ018-2009.pdf |
| DOH AO 2012-0012 | https://www.doh.gov.ph/sites/default/files/health_advisory/ao2012-0012.pdf |
| DOH AO 2022-0007 | https://www.doh.gov.ph/sites/default/files/health_advisory/ao2022-0007.pdf |
| RA 9439 (Hospital Detention Law) | https://www.officialgazette.gov.ph/2007/04/27/republic-act-no-9439 |
