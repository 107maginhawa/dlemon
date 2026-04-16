# Canadian Healthcare Localization Pack

**Jurisdiction**: Canada (CA)
**ISO 3166-1 alpha-2**: CA
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
7. [Provincial Variations](#provincial-variations)
8. [Terminology Mappings](#terminology-mappings)
9. [Key Regulations](#key-regulations)
10. [Official Sources](#official-sources)

---

## Overview

This localization pack adapts the Monobase Healthcare API Standards Foundation for deployment in Canadian healthcare settings. It covers compliance with PIPEDA (federal), provincial health privacy laws, CIHI national data standards, Canada Health Infoway pan-Canadian specifications, and Health Canada drug regulation (Food and Drugs Act).

The pack is **standalone and non-imported by core**. It does not modify any core entity definitions. It provides URI constants, enumerations, and mapping documentation that Canadian implementations layer on top of the core model.

### Scope

- Provincial health card number identifiers for all 13 provinces and territories
- Provincial physician licence number identifiers
- ICD-10-CA, CCI, DIN, NPN, and CCDD code systems
- Province/territory codes, CIHI discharge dispositions, admission categories, service delivery types
- Terminology mapping: DIN to CCDD, ICD-10-CA to WHO ICD-10, CCI to SNOMED CT

---

## Regulatory Context

### Canada Health Act

The Canada Health Act (R.S.C. 1985, c. C-6) establishes the five criteria for provincial/territorial health insurance plans to qualify for federal transfer payments:

- **Public administration**: Plan must be administered on a non-profit basis by a public authority.
- **Comprehensiveness**: All medically necessary hospital and physician services must be covered.
- **Universality**: All insured persons must be entitled to insured services on uniform terms and conditions.
- **Portability**: Insured persons remain covered when temporarily absent from their province.
- **Accessibility**: Insured services must be provided on uniform terms and conditions without barriers.

Because the Act governs federal-provincial funding, most healthcare delivery and regulation occurs at the provincial level.

### PIPEDA and Provincial Health Privacy Laws

**PIPEDA** (Personal Information Protection and Electronic Documents Act, S.C. 2000, c. 5) applies to private sector organisations collecting personal information in commercial activities. However, provinces with substantially similar legislation are exempt from PIPEDA for intra-provincial activities:

- **Alberta**: Health Information Act (HIA, RSA 2000, c. H-5) — substantially similar, PIPEDA exempt for health data.
- **British Columbia**: Personal Information Protection Act (PIPA, SBC 2003, c. 63) — substantially similar.
- **Quebec**: Act respecting the protection of personal information in the private sector (Law 25, updated 2023) — substantially similar. Law 25 introduces GDPR-inspired requirements including privacy impact assessments.
- **Ontario**: Personal Health Information Protection Act (PHIPA, 2004, S.O. 2004, c. 3, Sched. A).
- **New Brunswick, Nova Scotia, PEI, Newfoundland**: Subject to PIPEDA for private sector; provincial public sector health laws apply to public facilities.
- **Manitoba, Saskatchewan**: No substantially similar legislation for private sector; PIPEDA applies.

Key obligations across all jurisdictions:
- Consent before collection, use, or disclosure of personal health information (with named exceptions).
- Minimum collection principle (collect only what is necessary).
- Breach notification to the relevant provincial commissioner (timelines vary by province).

### CIHI (Canadian Institute for Health Information)

CIHI maintains national health data standards and collects national databases:

- **Discharge Abstract Database (DAD)**: Acute care inpatient data submission standard using ICD-10-CA and CCI.
- **National Ambulatory Care Reporting System (NACRS)**: Emergency and ambulatory care data.
- **Home Care Reporting System (HCRS)** and others.
- CIHI publishes the official ICD-10-CA and CCI classification manuals updated annually.

### Canada Health Infoway

Canada Health Infoway is a federally funded, not-for-profit corporation that leads pan-Canadian digital health standards:

- **CCDD**: Canadian Clinical Drug Dataset — national drug terminology aligned with SNOMED CT.
- **pCLOCD**: pan-Canadian LOINC Observation Code Database — curated LOINC subset for Canadian lab reporting.
- **SNOMED CT CA**: Canadian national release of SNOMED CT including a Canadian Extension module.
- **pan-Canadian FHIR profiles**: Infoway publishes pan-Canadian FHIR implementation guides (CA Core+).

---

## Pack Contents

| File | Purpose |
|---|---|
| `code-systems.tsp` | URI constants for Canadian code systems (ICD-10-CA, CCI, DIN, NPN, CCDD, SNOMED CT CA, pCLOCD) |
| `identifiers.tsp` | URI constants and validation patterns for all provincial/territorial health card numbers, provincial physician licences, and facility OOIDs |
| `value-sets.tsp` | Enumerated value sets: province/territory codes, CIHI discharge dispositions, admission categories, service delivery types, official languages |
| `terminology-map.tsp` | Documented mapping relationships between Canadian local codes and international standards |
| `README.md` | This file |

---

## Identifier Systems

### Patient Identifiers — Provincial Health Card Numbers

Canada has no national patient identifier. Each province and territory issues its own health card number:

| Province/Territory | Identifier | System URI | Format |
|---|---|---|---|
| Ontario | OHIP number | `https://fhir.infoway-inforoute.ca/NamingSystem/ca-on-patient-hcn` | 4-3-3-AA |
| British Columbia | BC PHN | `https://fhir.infoway-inforoute.ca/NamingSystem/ca-bc-patient-hcn` | 10 digits (Luhn) |
| Alberta | AB PHN (AHCIP) | `https://fhir.infoway-inforoute.ca/NamingSystem/ca-ab-patient-hcn` | 9 digits |
| Quebec | RAMQ number | `https://fhir.infoway-inforoute.ca/NamingSystem/ca-qc-patient-hcn` | 4 letters + 8 digits |
| Manitoba | MB HCN | `https://fhir.infoway-inforoute.ca/NamingSystem/ca-mb-patient-hcn` | 9 digits |
| Saskatchewan | SK HCN | `https://fhir.infoway-inforoute.ca/NamingSystem/ca-sk-patient-hcn` | 9 digits |
| Nova Scotia | NS HCN | `https://fhir.infoway-inforoute.ca/NamingSystem/ca-ns-patient-hcn` | Varies |
| New Brunswick | NB HCN | `https://fhir.infoway-inforoute.ca/NamingSystem/ca-nb-patient-hcn` | 9 digits |
| Newfoundland | NL MCP | `https://fhir.infoway-inforoute.ca/NamingSystem/ca-nl-patient-hcn` | Varies |
| PEI | PE HCN | `https://fhir.infoway-inforoute.ca/NamingSystem/ca-pe-patient-hcn` | Varies |
| Northwest Territories | NT HCN | `https://fhir.infoway-inforoute.ca/NamingSystem/ca-nt-patient-hcn` | Varies |
| Yukon | YT HCN | `https://fhir.infoway-inforoute.ca/NamingSystem/ca-yt-patient-hcn` | Varies |
| Nunavut | NU HCN | `https://fhir.infoway-inforoute.ca/NamingSystem/ca-nu-patient-hcn` | Varies |

**Usage on Patient resource (example — Ontario):**

```json
{
  "resourceType": "Patient",
  "identifier": [
    {
      "system": "https://fhir.infoway-inforoute.ca/NamingSystem/ca-on-patient-hcn",
      "value": "1234-567-890-AB"
    }
  ]
}
```

### Practitioner Identifiers

| Identifier | System URI | Notes |
|---|---|---|
| CPSO Number (ON) | `https://www.cpso.on.ca` | 5–6 digit numeric |
| Provincial licence (generic root) | `https://fhir.infoway-inforoute.ca/NamingSystem/ca-license-number` | Append province code |

Provincial physician colleges (CPSBC, CPSA, CMQ, CPSNS, etc.) each issue their own licence numbers. Use the college-specific system URI wherever possible.

---

## Code Systems

### Diagnosis Coding — ICD-10-CA

Canadian hospitals submit acute care diagnoses using ICD-10-CA. System URI:

```
https://www.cihi.ca/en/canadian-classification-health-interventions
```

ICD-10-CA maintains alignment with WHO ICD-10 at the chapter (3-character) level. For international data exchange, truncate to the 3-character WHO parent code.

### Procedure Coding — CCI

CIHI's Canadian Classification of Health Interventions. System URI:

```
https://www.cihi.ca/en/canadian-classification-health-interventions
```

CCI uses a 7-character code structure. Updated annually by CIHI alongside ICD-10-CA.

### Drug Coding — DIN and CCDD

- **DIN** (`https://health-products.canada.ca/api/drug/`): Health Canada regulatory drug identifier. Required on drug product labels. 8-digit numeric.
- **CCDD** (`https://www.infoway-inforoute.ca/en/solutions/digital-health-foundation/standards/ccdd`): Pan-Canadian clinical drug dataset for use in clinical systems. SNOMED CT-aligned.

For pharmacy dispensing, use DIN. For clinical information systems and FHIR Medication resources, use CCDD (SNOMED CT-based).

### Natural Health Products — NPN

Natural Health Products are regulated separately from drugs in Canada:

```
https://health-products.canada.ca/lnhpd-bdpsnh/
```

NPN is required on licensed natural health product labels and in pharmacy dispensing records.

---

## Value Sets

### Province and Territory Codes

ISO 3166-2:CA-aligned codes for all 13 provinces and territories. Documented in `value-sets.tsp` as `CAProvinceTerritory`.

### CIHI Discharge Dispositions

CIHI DAD discharge disposition codes identify post-discharge destination. Key codes: 1 (home), 2 (transfer acute), 7 (died), 8 (left AMA). Full set in `value-sets.tsp` as `CADischargeDisposition`.

### Admission Categories

CIHI codes for elective (1), urgent (2), and emergency (3) admissions. Documented as `CAAdmissionCategory`.

### Service Delivery Types

CIHI NACRS service delivery type codes (1–10, 99). Documented as `CAServiceDeliveryType`.

---

## Provincial Variations

Healthcare in Canada is primarily a provincial jurisdiction. Key variations affecting implementations:

| Topic | Ontario | British Columbia | Quebec | Other |
|---|---|---|---|---|
| Privacy law | PHIPA | PIPA | Law 25 | PIPEDA (federal) or provincial equivalent |
| Patient ID | OHIP (4-3-3-AA) | PHN (10 digits, Luhn) | RAMQ (4L+8N) | Province-specific |
| Physician ID | CPSO number | CPSBC number | CMQ number | Provincial college number |
| Drug formulary | ODB (Ontario Drug Benefit) | BC PharmaCare | RAMQ drug list | Province-specific formulary |
| Lab coding | pCLOCD + OML IG | pCLOCD | pCLOCD | pCLOCD pan-Canadian |

Implementations deploying in multiple provinces must implement all applicable patient identifier systems and must apply the most restrictive applicable privacy law.

---

## Terminology Mappings

Full mapping documentation in `terminology-map.tsp`. Summary:

| Source System | Target System | Method | Completeness |
|---|---|---|---|
| DIN | CCDD | Infoway DIN/CCDD crosswalk | Near-complete for currently marketed products |
| ICD-10-CA | WHO ICD-10 | Truncate to 3-char parent | Partial — loses CA-specific detail |
| CCI | SNOMED CT | Infoway pan-Canadian terminology service | Partial |
| pCLOCD | LOINC | Direct (pCLOCD IS LOINC subset) | Complete — all pCLOCD codes are valid LOINC codes |

---

## Key Regulations

| Regulation | Subject | Relevance |
|---|---|---|
| Canada Health Act (R.S.C. 1985, c. C-6) | National health insurance criteria | Defines covered services; provincial plans must comply for federal funding |
| PIPEDA (S.C. 2000, c. 5) | Federal privacy law | Applies to private sector where no substantially similar provincial law |
| Ontario PHIPA (S.O. 2004, c. 3, Sched. A) | Ontario health privacy | Governs collection/use/disclosure of PHI by health information custodians |
| BC PIPA (SBC 2003, c. 63) | BC privacy | Private sector privacy law substantially similar to PIPEDA |
| Alberta HIA (RSA 2000, c. H-5) | Alberta health privacy | Governs custodians, trustees, and affiliates handling health information |
| Quebec Law 25 | Quebec privacy | GDPR-inspired modernisation including mandatory PIAs, breach notification |
| Food and Drugs Act (R.S.C. 1985, c. F-27) | Drug/device regulation | Governs DIN assignment, NPN licensing, and drug market authorisation |
| Natural Health Products Regulations (SOR/2003-196) | NHP regulation | NPN assignment for licensed natural health products |
| Official Languages Act (R.S.C. 1985, c. 31) | Bilingual obligations | Federal institutions must provide services in English and French |

---

## Official Sources

| Source | URL |
|---|---|
| Canada Health Infoway | https://www.infoway-inforoute.ca |
| CIHI | https://www.cihi.ca |
| CIHI ICD-10-CA and CCI | https://www.cihi.ca/en/data-standards-and-quality/classification-and-coding |
| Health Canada Drug Product Database | https://health-products.canada.ca/dpd-bdpp |
| CCDD | https://www.infoway-inforoute.ca/en/solutions/digital-health-foundation/standards/ccdd |
| pCLOCD | https://www.infoway-inforoute.ca/en/solutions/digital-health-foundation/standards/pclocd |
| SNOMED CT Canada | https://www.infoway-inforoute.ca/en/solutions/digital-health-foundation/standards/snomed-ct |
| CA Core+ FHIR IG | https://build.fhir.org/ig/HL7-Canada/ca-baseline |
| OPC (federal privacy commissioner) | https://www.priv.gc.ca |
| Ontario IPC (privacy commissioner) | https://www.ipc.on.ca |
| BC OIPC | https://www.oipc.bc.ca |
| Alberta OIPC | https://www.oipc.ab.ca |
| Quebec CAI | https://www.cai.gouv.qc.ca |
| CPSO | https://www.cpso.on.ca |
| CPSBC | https://www.cpsbc.ca |
| CPSA (Alberta) | https://www.cpsa.ca |
| CMQ (Quebec) | https://www.cmq.org |
