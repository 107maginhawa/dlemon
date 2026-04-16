# C-CDA Document Generation Guide

**Standard:** HL7 Consolidated Clinical Document Architecture (C-CDA) Release 4.0
**Use Cases:** Summary of Care Records, Transitions of Care, Patient Summaries
**Base Standard:** HL7 CDA Release 2 (ISO/HL7 27932)
**Last Updated:** 2026-04-14

---

## Table of Contents

1. [Overview](#overview)
2. [Generation API](#generation-api)
3. [Document Type Templates](#document-type-templates)
4. [Section-to-Template Mapping](#section-to-template-mapping)
5. [XML Structure Overview](#xml-structure-overview)
6. [CCD — Continuity of Care Document](#ccd)
7. [Discharge Summary](#discharge-summary)
8. [Consultation Note](#consultation-note)
9. [Progress Note](#progress-note)
10. [Referral Note](#referral-note)
11. [Data Source Mapping](#data-source-mapping)

---

## Overview

C-CDA (Consolidated Clinical Document Architecture) is an XML-based clinical document standard widely used for transitions of care, patient summaries, and information exchange. Our platform generates C-CDA documents from FHIR Composition resources and their referenced clinical data.

### C-CDA Versions Supported

| Version | TemplateId | Status |
|---------|-----------|--------|
| C-CDA R2.1 | `2.16.840.1.113883.10.20.22.*` | Supported (legacy) |
| C-CDA R3.0 | `2.16.840.1.113883.10.20.22.v3.*` | Supported |
| **C-CDA R4.0** | `2.16.840.1.113883.10.20.22.v4.*` | **Primary/Recommended** |

### Relationship to FHIR

C-CDA documents are generated from FHIR resources using a **FHIR-to-CDA transform**:

```
FHIR Composition
    + referenced Patient, Encounter, Condition, Medication, etc.
    ↓ (CDA Generation Engine)
C-CDA XML Document
```

The inverse (C-CDA to FHIR) is also supported for inbound documents.

---

## Generation API

### Generate C-CDA from Composition

```http
POST /fhir/Composition/{id}/$cda
Accept: application/xml
Content-Type: application/fhir+json
```

**Request Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `documentType` | string | CDA document type: `CCD`, `DischargeSummary`, `ConsultationNote`, `ProgressNote`, `ReferralNote` |
| `version` | string | C-CDA version: `R2.1`, `R3.0`, `R4.0` (default: R4.0) |
| `includeAttachments` | boolean | Include referenced PDF attachments as base64 content |

**Response:** `application/xml` — C-CDA XML document

### Generate from Encounter

Convenience operation to generate a context-appropriate C-CDA for an encounter:

```http
POST /fhir/Encounter/{id}/$cda
Accept: application/xml
```

The system selects the appropriate document type based on `Encounter.class`:
- `IMP` (inpatient) → Discharge Summary
- `EMER` (emergency) → Emergency Note
- `AMB` (outpatient) → Progress Note or Consultation Note
- `VR` (virtual) → Telehealth Encounter Note

---

## Document Type Templates

| Document Type | C-CDA Template OID | LOINC Code | Description |
|--------------|-------------------|------------|-------------|
| Continuity of Care Document (CCD) | `2.16.840.1.113883.10.20.22.1.2` | 34133-9 | Patient summary; transitions of care |
| Discharge Summary | `2.16.840.1.113883.10.20.22.1.8` | 18842-5 | Inpatient discharge documentation |
| Consultation Note | `2.16.840.1.113883.10.20.22.1.4` | 11488-4 | Specialist consultation |
| Progress Note | `2.16.840.1.113883.10.20.22.1.9` | 11506-3 | Ongoing outpatient care |
| Referral Note | `2.16.840.1.113883.10.20.22.1.14` | 57133-1 | Referral to specialist |
| History and Physical | `2.16.840.1.113883.10.20.22.1.3` | 34117-2 | Admission H&P |
| Operative Note | `2.16.840.1.113883.10.20.22.1.7` | 11504-8 | Surgical procedure documentation |
| Procedure Note | `2.16.840.1.113883.10.20.22.1.6` | 28570-0 | Procedure documentation |
| Diagnostic Imaging Report | `2.16.840.1.113883.10.20.22.1.5` | 18748-4 | Radiology report |
| Unstructured Document | `2.16.840.1.113883.10.20.22.1.10` | (document-type LOINC) | When structured sections not available |

---

## Section-to-Template Mapping

### Available C-CDA Sections

| Section | Template OID | LOINC | FHIR Source | Required In |
|---------|-------------|-------|-------------|------------|
| Allergies and Intolerances | `2.16.840.1.113883.10.20.22.2.6.1` | 48765-2 | AllergyIntolerance | CCD, Discharge, H&P |
| Medications | `2.16.840.1.113883.10.20.22.2.1.1` | 10160-0 | MedicationRequest/Statement | CCD, Discharge, H&P |
| Problem List | `2.16.840.1.113883.10.20.22.2.5.1` | 11450-4 | Condition (problem-list-item) | CCD, H&P, Consult |
| Procedures | `2.16.840.1.113883.10.20.22.2.7.1` | 47519-4 | Procedure | CCD, Discharge |
| Results | `2.16.840.1.113883.10.20.22.2.3.1` | 30954-2 | Observation + DiagnosticReport | CCD, Discharge |
| Vital Signs | `2.16.840.1.113883.10.20.22.2.4.1` | 8716-3 | Observation (vital-signs) | CCD, H&P |
| Immunizations | `2.16.840.1.113883.10.20.22.2.2.1` | 11369-6 | Immunization | CCD |
| Encounters | `2.16.840.1.113883.10.20.22.2.22.1` | 46240-8 | Encounter | CCD |
| Functional Status | `2.16.840.1.113883.10.20.22.2.14` | 47420-5 | Observation (functional-status) | CCD, Discharge |
| Assessment and Plan | `2.16.840.1.113883.10.20.22.2.9` | 51847-2 | CarePlan + ClinicalImpression | Progress, Consult |
| Chief Complaint | `2.16.840.1.113883.10.20.22.2.13` | 46239-0 | Encounter.reasonCode | H&P, ED Note |
| History of Present Illness | `2.16.840.1.113883.10.20.22.2.20` | 10164-2 | ClinicalImpression.summary | H&P, Consult |
| Past Medical History | `2.16.840.1.113883.10.20.22.2.20` | 11348-0 | Condition (historical) | H&P, Consult |
| Review of Systems | `2.16.840.1.113883.10.20.22.2.18` | 10187-3 | QuestionnaireResponse | H&P |
| Physical Examination | `2.16.840.1.113883.10.20.22.2.17` | 29545-1 | Observation (exam) | H&P |
| Family History | `2.16.840.1.113883.10.20.22.2.15` | 10157-6 | FamilyMemberHistory | H&P |
| Social History | `2.16.840.1.113883.10.20.22.2.17.1` | 29762-2 | Observation (social-history) | H&P, CCD |
| Mental Status | `2.16.840.1.113883.10.20.22.2.56` | 10190-7 | Observation + ClinicalImpression | Psych, H&P |
| Reason for Visit | `2.16.840.1.113883.10.20.22.2.12` | 29299-5 | Encounter.reasonCode | Progress, Consult |
| Hospital Discharge Diagnosis | `2.16.840.1.113883.10.20.22.2.24` | 11535-2 | Condition (encounter-diagnosis) | Discharge |
| Hospital Discharge Instructions | `2.16.840.1.113883.10.20.22.2.41` | 8653-8 | CarePlan | Discharge |
| Hospital Course | `2.16.840.1.113883.10.20.22.2.38` | 8648-8 | ClinicalImpression | Discharge |
| Discharge Medications | `2.16.840.1.113883.10.20.22.2.11.1` | 10183-2 | MedicationRequest (discharge) | Discharge |
| Discharge Condition | `2.16.840.1.113883.10.20.22.2.24` | 11535-2 | Condition | Discharge |
| Advance Directives | `2.16.840.1.113883.10.20.22.2.21` | 42348-3 | Consent | CCD |
| Payers/Insurance | `2.16.840.1.113883.10.20.22.2.18` | 48768-6 | Coverage | CCD, Discharge |
| Care Plan | `2.16.840.1.113883.10.20.22.2.60` | 18776-5 | CarePlan | CCD, Discharge |
| Goals | `2.16.840.1.113883.10.20.22.2.60` | 61146-7 | Goal | CCD |

---

## XML Structure Overview

### Document Header (All Document Types)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="CDA.xsl"?>
<ClinicalDocument xmlns="urn:hl7-org:v3"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:voc="urn:hl7-org:v3/voc"
                  xmlns:sdtc="urn:hl7-org:sdtc">

  <!-- Document Template ID -->
  <templateId root="2.16.840.1.113883.10.20.22.1.2"/>
  <templateId root="2.16.840.1.113883.10.20.22.1.2" extension="2024-05-01"/>

  <!-- Unique Document ID -->
  <id root="2.16.840.1.113883.3.MONOBASE" extension="DOC-UUID"/>

  <!-- Document Type Code (LOINC) -->
  <code code="34133-9"
        codeSystem="2.16.840.1.113883.6.1"
        codeSystemName="LOINC"
        displayName="Summarization of Episode Note"/>

  <!-- Document Title -->
  <title>Continuity of Care Document</title>

  <!-- Creation Date/Time -->
  <effectiveTime value="20260414120000+0000"/>

  <!-- Confidentiality Code -->
  <confidentialityCode code="N"
                       codeSystem="2.16.840.1.113883.5.25"
                       codeSystemName="Confidentiality"/>

  <!-- Language -->
  <languageCode code="en-US"/>

  <!-- Document Set/Version -->
  <setId root="2.16.840.1.113883.3.MONOBASE" extension="SET-UUID"/>
  <versionNumber value="1"/>
```

### Patient (recordTarget)

```xml
  <recordTarget>
    <patientRole>
      <!-- MRN -->
      <id root="2.16.840.1.113883.3.FACILITY_OID" extension="12345"/>
      <!-- Address -->
      <addr use="HP">
        <streetAddressLine>123 Main St</streetAddressLine>
        <city>Boston</city>
        <state>MA</state>
        <postalCode>02101</postalCode>
        <country>USA</country>
      </addr>
      <!-- Patient Demographics -->
      <patient>
        <name use="L">
          <given>John</given>
          <family>Doe</family>
        </name>
        <administrativeGenderCode code="M"
                                  codeSystem="2.16.840.1.113883.5.1"/>
        <birthTime value="19800115"/>
        <!-- Race (US Realm) -->
        <raceCode code="2106-3"
                  codeSystem="2.16.840.1.113883.6.238"
                  displayName="White"/>
        <!-- Language Communication -->
        <languageCommunication>
          <languageCode code="en"/>
          <preferenceInd value="true"/>
        </languageCommunication>
      </patient>
    </patientRole>
  </recordTarget>
```

### Author and Custodian

```xml
  <!-- Author (Practitioner) -->
  <author>
    <time value="20260414120000"/>
    <assignedAuthor>
      <id root="2.16.840.1.113883.4.6" extension="NPI-NUMBER"/>
      <assignedPerson>
        <name>
          <given>Jane</given>
          <family>Smith</family>
          <suffix>MD</suffix>
        </name>
      </assignedPerson>
      <representedOrganization>
        <id root="2.16.840.1.113883.4.6" extension="ORG-NPI"/>
        <name>General Hospital</name>
      </representedOrganization>
    </assignedAuthor>
  </author>

  <!-- Custodian (Organization) -->
  <custodian>
    <assignedCustodian>
      <representedCustodianOrganization>
        <id root="2.16.840.1.113883.4.6" extension="ORG-NPI"/>
        <name>General Hospital</name>
      </representedCustodianOrganization>
    </assignedCustodian>
  </custodian>
```

---

## CCD

### Required Sections

| # | Section | Requirement |
|---|---------|-------------|
| 1 | Allergies and Intolerances | SHALL |
| 2 | Medications | SHALL |
| 3 | Problem List | SHALL |
| 4 | Procedures | SHOULD |
| 5 | Results | SHOULD |
| 6 | Vital Signs | SHOULD |
| 7 | Immunizations | SHOULD |
| 8 | Encounters | SHOULD |
| 9 | Social History | SHOULD |
| 10 | Payers/Insurance | MAY |
| 11 | Advance Directives | MAY |
| 12 | Goals | MAY |
| 13 | Care Plan | MAY |

### Allergy Section XML Structure

```xml
<component>
  <section>
    <templateId root="2.16.840.1.113883.10.20.22.2.6.1"/>
    <templateId root="2.16.840.1.113883.10.20.22.2.6.1" extension="2024-05-01"/>
    <code code="48765-2" codeSystem="2.16.840.1.113883.6.1" displayName="Allergies and adverse reactions Document"/>
    <title>Allergies and Adverse Reactions</title>
    <text>
      <!-- Human-readable narrative (required) -->
      <table>
        <thead><tr><th>Substance</th><th>Reaction</th><th>Severity</th></tr></thead>
        <tbody>
          <tr><td>Penicillin</td><td>Hives</td><td>Moderate</td></tr>
        </tbody>
      </table>
    </text>
    <!-- Machine-readable entries -->
    <entry typeCode="DRIV">
      <act classCode="ACT" moodCode="EVN">
        <templateId root="2.16.840.1.113883.10.20.22.4.30"/>
        <id root="UUID"/>
        <code code="CONC" codeSystem="2.16.840.1.113883.5.6"/>
        <statusCode code="active"/>
        <effectiveTime><low value="20250101"/></effectiveTime>
        <entryRelationship typeCode="SUBJ">
          <observation classCode="OBS" moodCode="EVN">
            <templateId root="2.16.840.1.113883.10.20.22.4.7"/>
            <id root="UUID"/>
            <code code="ASSERTION" codeSystem="2.16.840.1.113883.5.4"/>
            <statusCode code="completed"/>
            <value xsi:type="CD"
                   code="416098002"
                   codeSystem="2.16.840.1.113883.6.96"
                   displayName="Drug allergy"/>
            <participant typeCode="CSM">
              <participantRole classCode="MANU">
                <playingEntity classCode="MMAT">
                  <code code="7980"
                        codeSystem="2.16.840.1.113883.6.88"
                        displayName="Penicillin"/>
                </playingEntity>
              </participantRole>
            </participant>
          </observation>
        </entryRelationship>
      </act>
    </entry>
  </section>
</component>
```

---

## Discharge Summary

### Required Sections

| # | Section | Requirement |
|---|---------|-------------|
| 1 | Hospital Course | SHALL |
| 2 | Discharge Diagnosis | SHALL |
| 3 | Discharge Medications | SHALL |
| 4 | Discharge Instructions | SHALL |
| 5 | Allergies and Intolerances | SHALL |
| 6 | Chief Complaint | SHOULD |
| 7 | Procedures | SHOULD |
| 8 | Results | SHOULD |
| 9 | Vital Signs | SHOULD |
| 10 | Family History | MAY |
| 11 | Social History | MAY |
| 12 | Review of Systems | MAY |
| 13 | Functional Status | MAY |
| 14 | Mental Status | MAY |

### FHIR Source for Discharge Summary

| C-CDA Section | FHIR Source |
|--------------|-------------|
| Hospital Course | `ClinicalImpression.summary` + `ClinicalImpression.finding[]` |
| Discharge Diagnosis | `Condition` where `category = encounter-diagnosis` and `encounter = {discharge encounter}` |
| Discharge Medications | `MedicationRequest` where `category = discharge` |
| Discharge Instructions | `CarePlan` associated with encounter |
| Admission Medications | `MedicationRequest` where `category = inpatient` at time of admission |

---

## Consultation Note

### Required Sections

| # | Section | Requirement |
|---|---------|-------------|
| 1 | Reason for Visit | SHALL |
| 2 | Assessment and Plan | SHALL |
| 3 | History of Present Illness | SHALL |
| 4 | Allergies and Intolerances | SHALL |
| 5 | Medications | SHALL |
| 6 | Physical Examination | SHOULD |
| 7 | Review of Systems | SHOULD |
| 8 | Problem List | SHOULD |
| 9 | Results | SHOULD |
| 10 | Vital Signs | SHOULD |

---

## Progress Note

### Required Sections

| # | Section | Requirement |
|---|---------|-------------|
| 1 | Assessment and Plan | SHALL |
| 2 | Reason for Visit | SHALL |
| 3 | Allergies and Intolerances | SHOULD |
| 4 | Medications | SHOULD |
| 5 | Vital Signs | SHOULD |
| 6 | Results | MAY |
| 7 | Procedures | MAY |

---

## Referral Note

### Required Sections

| # | Section | Requirement |
|---|---------|-------------|
| 1 | Reason for Referral | SHALL |
| 2 | Problem List | SHALL |
| 3 | Allergies and Intolerances | SHALL |
| 4 | Medications | SHALL |
| 5 | History of Present Illness | SHOULD |
| 6 | Past Medical History | SHOULD |
| 7 | Results | SHOULD |
| 8 | Vital Signs | SHOULD |
| 9 | Family History | MAY |
| 10 | Social History | MAY |
| 11 | Insurance | MAY |

---

## Data Source Mapping

### FHIR → C-CDA Terminology Mapping

| FHIR Coding System | C-CDA codeSystem OID |
|--------------------|---------------------|
| SNOMED CT | `2.16.840.1.113883.6.96` |
| LOINC | `2.16.840.1.113883.6.1` |
| RxNorm | `2.16.840.1.113883.6.88` |
| NDC | `2.16.840.1.113883.6.69` |
| ICD-10-CM | `2.16.840.1.113883.6.90` |
| ICD-10-PCS | `2.16.840.1.113883.6.4` |
| CPT-4 | `2.16.840.1.113883.6.12` |
| CVX (vaccines) | `2.16.840.1.113883.12.292` |
| HL7 Race codes | `2.16.840.1.113883.6.238` |
| HL7 ActCode | `2.16.840.1.113883.5.4` |
| NPI | `2.16.840.1.113883.4.6` |
| UCUM | `2.16.840.1.113883.6.8` |

### Narrative Generation

Every C-CDA section **must** contain a human-readable `<text>` block. Our system auto-generates narratives from structured FHIR data:

| Section | Narrative Format |
|---------|----------------|
| Allergies | HTML table: Substance, Reaction, Severity, Date |
| Medications | HTML table: Medication, Dose, Frequency, Route, Status |
| Problems | HTML table: Problem, Status, Onset Date, ICD-10 Code |
| Results | HTML table: Test, Value, Units, Reference Range, Flag, Date |
| Vital Signs | HTML table: Vital, Value, Date |
| Immunizations | HTML table: Vaccine (CVX), Date, Lot #, Site |
