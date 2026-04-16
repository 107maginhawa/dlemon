# 21st Century Cures Act Compliance Guide

**Legislation:** 21st Century Cures Act (Public Law 114-255, December 2016)
**Key Rules:** ONC 21st Century Cures Act Final Rule (85 FR 25642, May 2020)
**Applicability:** Health IT developers, healthcare providers, health information networks, health information exchanges
**Last Updated:** 2026-04-14

---

## Table of Contents

1. [Information Blocking](#information-blocking)
2. [Eight Information Blocking Exceptions](#eight-information-blocking-exceptions)
3. [ONC Health IT Certification](#onc-health-it-certification)
4. [USCDI Data Classes](#uscdi-data-classes)
5. [Patient Access API Requirements](#patient-access-api-requirements)
6. [Promoting Interoperability Program](#promoting-interoperability-program)
7. [Penalties for Information Blocking](#penalties-for-information-blocking)
8. [How Our Spec Prevents Information Blocking](#how-our-spec-prevents-information-blocking)

---

## Information Blocking

**Statutory definition (45 CFR 171.103):** A practice by a health IT developer, health information network, health information exchange, or healthcare provider that is likely to interfere with, prevent, or materially discourage access, exchange, or use of electronic health information (EHI).

### Who Is Subject to Information Blocking Rules

| Actor | Definition | Examples |
|-------|-----------|---------|
| Health IT Developer | Develops or offers certified health IT | EHR vendors, API platform providers |
| Health Information Network (HIN) | Facilitates EHI exchange for multiple providers | CommonWell, Carequality, statewide HIEs |
| Health Information Exchange (HIE) | Facilitates EHI exchange | Regional HIEs, prescription drug monitoring programs |
| Healthcare Provider | Provides health services | Hospitals, physician groups, health systems |

### What Constitutes Electronic Health Information (EHI)

- Initially (until October 2022): Limited to data elements represented in the USCDI
- **After October 2023:** All EHI in a designated record set (expanded scope)

### Interference Presumption

A practice is **presumed** to be information blocking if it is:
1. Likely to interfere with, prevent, or materially discourage access, exchange, or use of EHI
2. The actor knew or should have known it would have this effect (health IT developers and HINs/HIEs — "knew or should have known" is presumed)

---

## Eight Information Blocking Exceptions

If a practice meets **all the conditions** of an exception, it is **not** information blocking.

### Exception 1: Preventing Harm

**Purpose:** Permit refusal when providing EHI creates unreasonable risk of harm.

| Condition | Requirement |
|-----------|-------------|
| Harm basis | Reasonable and articulable belief that providing EHI will endanger patient life or physical safety, or risk misidentification |
| Individualized | Must be based on individual facts and circumstances, not a blanket policy |
| Proportionality | Practice must be no broader than necessary to prevent the harm |
| Not permanent | Must be limited to duration of risk |

**Common applications:** Withholding psychiatric notes that could endanger a patient, third-party information in records.

### Exception 2: Privacy

**Purpose:** Allow EHI to be withheld when required or permitted by law.

| Scenario | Conditions |
|----------|-----------|
| Legal restriction | State or federal law prohibits or restricts disclosure (e.g., 42 CFR Part 2, HIV status laws) |
| Patient privacy preference | Patient has requested restriction on disclosure |
| De-identification | Providing de-identified data instead of PHI |
| Permission not obtained | Actor cannot practicably obtain required consent |

**Note:** This exception does not permit actors to create new privacy restrictions not required by law. Existing laws must restrict the disclosure.

### Exception 3: Security

**Purpose:** Allow practices to protect EHI security.

| Condition | Requirement |
|-----------|-------------|
| Uniform application | Security practices must apply equally to all requestors regardless of who they are |
| Documented policies | Must be grounded in a written security policy |
| Reasonable belief | Actor must reasonably believe the practice is necessary to protect security |
| ONC recognized standards | Practices should align with recognized security frameworks (NIST, CIS) |

### Exception 4: Infeasibility

**Purpose:** Address situations where it is not technically or operationally feasible to provide EHI.

| Condition | Requirement |
|-----------|-------------|
| Genuine infeasibility | Uncontrollable circumstances make compliance infeasible |
| Alternative provision | Provide EHI in an alternative manner where possible |
| Notification | Explain infeasibility to requestor |
| Time limitation | Infeasibility must be genuinely time-limited |

**Examples:** Natural disaster, equipment failure, data migration in progress, legacy system incapable of producing FHIR output.

### Exception 5: Health IT Performance

**Purpose:** Allow maintenance activities that may temporarily limit EHI access.

| Condition | Requirement |
|-----------|-------------|
| System maintenance | Downtime for upgrades, maintenance, or improvements |
| Reasonable duration | Maintenance window must be reasonable |
| Uniform impact | Must affect all users equally (not targeted restriction) |
| Advance notice | Provide users reasonable advance notice |

### Exception 6: Content and Manner

**Purpose:** Allow actors to provide EHI in a different format than requested, under specific conditions.

| Tier | Description | Conditions |
|------|-------------|-----------|
| Tier 1 | Alternative format still meets requestor's needs | Any alternative that satisfies the request |
| Tier 2 | Specific format is technically infeasible | Must provide via alternative readily available format |
| Tier 3 | Cannot provide in alternative format | May deny, but must explain |

**FHIR API requirement:** After April 2023, certified health IT must support the ONC-required FHIR API as the content/manner alternative.

### Exception 7: Fees

**Purpose:** Allow actors to charge fees for EHI access in some circumstances.

| Allowed | Not Allowed |
|---------|------------|
| Reasonable cost-based fees for third-party EHI requests | Fees that are unreasonably high or interfere with access |
| Fees for value-added services | Fees that discriminate based on requestor type |
| Fees for non-standard formats | Fees for patient access to their own data in standard format |
| Market-rate API licensing | Per-query fees designed to discourage use |

**Patient access:** Actors may **NOT** charge patients for access to their own EHI via the required Patient Access API.

### Exception 8: Licensing

**Purpose:** Allow actors to protect intellectual property through licensing.

| Condition | Requirement |
|-----------|-------------|
| Non-discriminatory | Licensing terms must be non-discriminatory |
| Reasonable terms | Terms and conditions must be reasonable and customary |
| Not weaponized | Cannot use licensing to effectively block EHI exchange |

---

## ONC Health IT Certification

### ONC Health IT Certification Program

The 2015 Edition Cures Update (2015 Edition Cures) health IT criteria required by the ONC Final Rule.

### Mandatory Certification Criteria for Patient Access

| Criterion | Reference | Requirement |
|-----------|-----------|-------------|
| Standardized API for Patient Services | §170.315(g)(10) | FHIR R4 + US Core + SMART on FHIR |
| Electronic Access to Health Records | §170.315(e)(1) | Patient electronic access to health information |
| Transmit to Third Party | §170.315(e)(3) | Transmit summary of care records |
| Clinical Quality Measures | §170.315(c)(1)–(c)(4) | Record and export CQMs |
| Audit Log | §170.315(d)(2) | Log user actions against EHI |
| Accounting of Disclosures | §170.315(d)(9) | Track who accessed EHI |

### §170.315(g)(10) — Standardized API for Patient Services

This is the core certification criterion for interoperability:

| Requirement | Specification |
|-------------|--------------|
| FHIR version | R4 (4.0.1) |
| US Core version | US Core 3.1.1 (USCDI v1) or later |
| SMART App Launch | SMART on FHIR v1.0 or v2 |
| OAuth 2.0 | Required for authentication |
| Standalone launch | Must support launch without EHR context |
| EHR launch | Must support launch within EHR workflow |
| Patient scope | patient/[resource].read |
| Granted access | Must honor patient's granted access |
| Token introspection | Must support RFC 7662 |
| Multi-patient API | Bulk data access for authorized payers |

---

## USCDI Data Classes

The **United States Core Data for Interoperability (USCDI)** defines the minimum data set for nationwide interoperability.

### USCDI v3 Data Classes (ONC Required 2023)

| Data Class | Data Elements | FHIR Resources |
|------------|--------------|----------------|
| Allergies and Intolerances | Substance, Reaction, Severity | AllergyIntolerance |
| Assessment and Plan of Treatment | Assessment/plan narrative | CarePlan, ClinicalImpression |
| Care Team Members | Providers and roles | CareTeam |
| Clinical Notes | Consultation notes, discharge summaries, history/physicals, imaging narratives, lab reports, pathology reports, procedure notes, progress notes | DocumentReference, DiagnosticReport |
| Cognitive Status | Functional/cognitive assessments | Observation, QuestionnaireResponse |
| Diagnoses (Problems) | Problem/diagnosis, date | Condition |
| Diagnostic Imaging | Study type, body part, modality, report | ImagingStudy, DiagnosticReport |
| Encounter Information | Type, date, location, disposition | Encounter |
| Goals | Goal description, progress | Goal |
| Health Concerns | Health concern narrative | Condition |
| Immunizations | Vaccine code, date, manufacturer | Immunization |
| Laboratory | Tests, values, reference ranges | Observation, DiagnosticReport |
| Medications | Medication, dose, frequency | MedicationRequest |
| Patient Demographics | Name, DOB, sex, race, ethnicity, address, language | Patient |
| Procedures | Procedure, date | Procedure |
| Provenance | Author, author role, date | Provenance |
| Reason for Referral | Reason narrative | ServiceRequest |
| Smoking Status | Current status | Observation |
| Sexual Orientation | Sexual orientation value | Observation |
| Gender Identity | Gender identity value | Observation |
| Vital Signs | BP, HR, RR, temp, height, weight, BMI, O2 sat, head circumference | Observation |
| Unique Device Identifier(s) | Device identifier, type | Device |
| Health Insurance Information | Payer, member ID, coverage type | Coverage |

### USCDI v4 Data Classes (Additional, 2024)

| Data Class | Key Additions |
|------------|--------------|
| Functional Status | ADLs, mobility assessments |
| Medications | Adherence, supply duration |
| Procedures | Body site, laterality |
| Patient Demographics | Tribal affiliation, preferred contact method |
| Pregnancy Status | Gestational age, estimated delivery date |
| Screening Assessments | SDOH screening, mental health screening |
| Substance Use | Alcohol use, drug use screening results |

---

## Patient Access API Requirements

### Regulatory Requirements

| Requirement | Source | Deadline |
|-------------|--------|---------|
| FHIR R4 Patient Access API | CMS Interoperability Rule (CMS-9115-F) | 2021 (payers); 2023 (providers via certification) |
| Provider Directory API | CMS Rule | 2021 |
| Payer-to-Payer API | CMS-0057-F (2024) | 2027 |
| Drug Formulary API | CMS Rule | 2021 |
| Prior Authorization API | CMS-0057-F | 2026–2027 |

### CMS Interoperability Rule — Payer Patient Access API

Required data for Medicare Advantage, Medicaid, CHIP, and QHP payers:

| Data | FHIR Resources | US Core Profile |
|------|---------------|----------------|
| Claims and encounters | ExplanationOfBenefit | US Core EOB |
| Clinical data | Patient, Condition, Observation, etc. | US Core |
| Coverage/benefits | Coverage | HRex Coverage |
| Drug formulary | List, MedicationKnowledge | DaVinci Drug Formulary |
| Provider directory | Practitioner, Organization, Location | DaVinci PDex |

### Patient Access API Performance Requirements

| Metric | Requirement |
|--------|------------|
| Response time | No unreasonable delay (ONC guidance: similar to standard web response) |
| Availability | High availability; planned maintenance with advance notice |
| Rate limiting | May apply reasonable rate limits; must document |
| Errors | Return standard FHIR OperationOutcome with actionable messages |

---

## Promoting Interoperability Program

**Formerly Meaningful Use (2011–2018), then Advancing Care Information (2017–2018)**

### Current Measures (2024 Program Year)

| Objective | Measures | Points |
|-----------|---------|--------|
| Health Information Exchange | Support Electronic Referral Loops, Provide Patients Electronic Access | Required |
| Electronic Prescribing | e-Prescribing, Query of PDMP, Verify Opioid Treatment Agreement | Bonus |
| Provider to Patient Exchange | Provide Patients Electronic Access to Health Information | Required |
| Public Health and Clinical Data Exchange | Immunization Registry, Electronic Case Reporting, Syndromic Surveillance, Electronic Reportable Lab, Cancer Registry | Bonus |

### Automatic Numerator Credit for API Use

If the certified FHIR API is enabled and patients access their data via third-party apps, this counts automatically toward the patient electronic access measure.

---

## Penalties for Information Blocking

### ONC Penalties (Health IT Developers and HINs/HIEs)

| Violation | Maximum Civil Monetary Penalty |
|-----------|-------------------------------|
| Information blocking by health IT developer or HIN/HIE | Up to **$1,000,000 per violation** |

**Enforcement:** OIG (Office of Inspector General) enforces per 42 CFR Part 1003

### OIG Disincentives (Healthcare Providers)

| Violation | Disincentive |
|-----------|-------------|
| Information blocking by healthcare provider | Loss of Medicare/Medicaid incentive payments; removal from federal programs in egregious cases |
| Initial penalty (2024 interim final rule) | Up to the amount of the base EHR incentive payment |

### Factors Considered in Penalty Assessment

- Nature and extent of the information blocking
- Harm caused (financial, reputational, health outcomes)
- History of compliance or noncompliance
- Financial condition of the actor
- Cooperation with OIG investigation
- Corrective action taken

---

## How Our Spec Prevents Information Blocking

### FHIR API Availability

| Requirement | Our Implementation |
|-------------|-------------------|
| FHIR R4 Patient Access API | Full FHIR R4 REST API for all USCDI data elements |
| SMART on FHIR | SMART App Launch v2 supported; patient and user launch |
| US Core profiles | All resources conform to US Core 6.1.0 (USCDI v3) profiles |
| No unreasonable delay | API SLA: p95 < 500ms for read operations |
| No fees for patient access | Patient-context token access has no per-query fees |

### Data Completeness

| USCDI Requirement | Our Implementation |
|-------------------|-------------------|
| All USCDI v3 data classes | Every data class mapped to corresponding FHIR resource |
| Clinical notes | `DocumentReference` captures all note types |
| Provenance | `Provenance` resource auto-generated for every write |
| Encounter information | `Encounter` with all required status, period, participant fields |
| USCDI v4 data classes | Supported via extension on relevant resources |

### Non-Discriminatory Access

| Information Blocking Concern | Our Implementation |
|------------------------------|-------------------|
| Equal access regardless of requestor | SMART scopes apply uniformly; no actor-specific restrictions |
| No competitor blocking | API access not conditioned on business relationship |
| Standard format always available | FHIR R4 JSON is always available; no proprietary-only format |
| Documented exceptions | Any access restriction generates `OperationOutcome` with reason code |

### Audit and Accountability

| Requirement | Our Implementation |
|-------------|-------------------|
| Log all EHI access | `AuditEvent` created for every read and write |
| Information blocking complaints | `AuditEvent` provides evidence of access patterns |
| Exception documentation | Refusals recorded with reason code referencing applicable exception |
| Retention | Audit logs retained per applicable law (minimum 6 years per HIPAA) |

### Patient Rights Support

| Cures Act Requirement | Our Implementation |
|-----------------------|-------------------|
| Patient access to own EHI | `GET /patients/{id}/$everything` with patient SMART token |
| No blocking of authorized third parties | SMART app authorization flow grants third-party access |
| Payer-to-payer data exchange | Bulk export endpoint supports payer transition requests |
| Timely access | Same-day access for standard queries; async for bulk |
