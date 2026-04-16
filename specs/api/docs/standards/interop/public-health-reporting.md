# Public Health Reporting Guide

**Purpose:** Integration patterns for electronic public health reporting
**Standards:** eCR FHIR IG, NHSN FHIR IG, CMS FHIR IG, IIS FHIR IG
**Last Updated:** 2026-04-14

---

## Table of Contents

1. [Electronic Case Reporting (eCR)](#electronic-case-reporting-ecr)
2. [NHSN — National Healthcare Safety Network](#nhsn--national-healthcare-safety-network)
3. [Syndromic Surveillance](#syndromic-surveillance)
4. [Immunization Registries (IIS)](#immunization-registries)
5. [Cancer Registries](#cancer-registries)
6. [Our Spec Support Summary](#our-spec-support-summary)

---

## Electronic Case Reporting (eCR)

**Standard:** HL7 FHIR eClinical Quality Improvement (eCQI) — eCR FHIR IG
**Governing Body:** CDC, CSTE (Council of State and Territorial Epidemiologists), APHL
**FHIR IG:** `http://hl7.org/fhir/us/ecr/`

### eCR Overview

Electronic Case Reporting automates the submission of reportable condition information from healthcare providers to public health agencies. eCR replaces manual fax-based reporting.

### eCR Workflow

```
1. Patient presents with symptoms
2. EHR detects trigger codes (RCTC — Reportable Condition Trigger Codes)
3. EHR generates eICR (electronic Initial Case Report)
4. eICR transmitted to AIMS (Association of Immunization Managers) ECRN or RCKMS
5. RCKMS applies jurisdictional reporting rules
6. If reportable: Reportability Response (RR) sent to provider
7. eICR routed to appropriate public health jurisdiction
8. Public health agency receives and investigates
```

### Trigger Code Detection

Reportable Condition Trigger Codes (RCTC) are maintained by VSAC:

| Code System | Trigger Categories | FHIR Resource |
|------------|-------------------|---------------|
| SNOMED CT | Problem/condition codes | Condition.code |
| ICD-10-CM | Diagnosis codes | Condition.code |
| LOINC | Lab order and result codes | Observation.code, ServiceRequest.code |
| SNOMED CT | Lab test names | ServiceRequest.code |
| RxNorm | Medication triggers | MedicationRequest.medication[x] |
| ICD-10-CM | Procedure codes | Procedure.code |

**Trigger detection logic:**

```
For each Condition, Observation, ServiceRequest, MedicationRequest:
  if code ∈ RCTC_ValueSet:
    generateICR = true
    triggerCodes.add(code)
```

### eICR Generation

The eICR is a FHIR Document Bundle generated from an Encounter and its associated clinical data.

```http
POST /fhir/Encounter/{id}/$ecr-eicr
Accept: application/fhir+json
```

**eICR Document Bundle Contents:**

| Resource | Required | Source |
|----------|----------|--------|
| Composition (eICR) | Yes | Generated |
| Patient | Yes | Patient resource |
| Encounter | Yes | Current encounter |
| Condition (trigger codes) | Yes | Conditions matching RCTC |
| Observation (trigger labs) | Yes | Lab results matching RCTC |
| Immunization (recent) | Yes | Patient immunization history |
| MedicationRequest (trigger meds) | Conditional | If medication triggers present |
| Organization (facility) | Yes | Reporting facility |
| Practitioner (provider) | Yes | Ordering/attending provider |
| ServiceRequest (trigger orders) | Conditional | If lab order triggers present |
| Travel history | Conditional | If travel-related condition |

### eICR Composition Structure

```json
{
  "resourceType": "Composition",
  "meta": {
    "profile": ["http://hl7.org/fhir/us/ecr/StructureDefinition/eicr-composition"]
  },
  "status": "final",
  "type": {
    "coding": [{ "system": "http://loinc.org", "code": "55751-2", "display": "Public health Case report" }]
  },
  "subject": { "reference": "Patient/patient-123" },
  "encounter": { "reference": "Encounter/encounter-456" },
  "date": "2026-04-14T12:00:00Z",
  "author": [{ "reference": "Practitioner/dr-smith" }],
  "title": "Initial Public Health Case Report",
  "section": [
    { "title": "Reason for Visit", "code": { "coding": [{ "system": "http://loinc.org", "code": "29299-5" }] }, "entry": [] },
    { "title": "Chief Complaint", "code": { "coding": [{ "system": "http://loinc.org", "code": "10154-3" }] }, "entry": [] },
    { "title": "History of Present Illness", "code": { "coding": [{ "system": "http://loinc.org", "code": "10164-2" }] }, "entry": [] },
    { "title": "Medications Administered", "code": { "coding": [{ "system": "http://loinc.org", "code": "29549-3" }] }, "entry": [] },
    { "title": "Problem List", "code": { "coding": [{ "system": "http://loinc.org", "code": "11450-4" }] }, "entry": [] },
    { "title": "Results", "code": { "coding": [{ "system": "http://loinc.org", "code": "30954-2" }] }, "entry": [] },
    { "title": "Plan of Treatment", "code": { "coding": [{ "system": "http://loinc.org", "code": "18776-5" }] }, "entry": [] },
    { "title": "Social History", "code": { "coding": [{ "system": "http://loinc.org", "code": "29762-2" }] }, "entry": [] }
  ]
}
```

### Reportability Response (RR)

After the eICR is processed, the RCKMS sends back a Reportability Response:

```json
{
  "resourceType": "Bundle",
  "meta": { "profile": ["http://hl7.org/fhir/us/ecr/StructureDefinition/rr-composition"] },
  "type": "document",
  "entry": [
    {
      "resource": {
        "resourceType": "Composition",
        "status": "final",
        "type": { "coding": [{ "system": "http://loinc.org", "code": "88085-6" }] },
        "section": [
          {
            "title": "Reportability Response Subject",
            "text": {
              "div": "<div>Your report for a possible case of Salmonellosis was received by the CDC...</div>"
            },
            "extension": [{
              "url": "http://hl7.org/fhir/us/ecr/StructureDefinition/rr-reportability-information-extension",
              "extension": [
                { "url": "reportableStatus", "valueCodeableConcept": { "coding": [{ "code": "RRVS1", "display": "Reportable" }] } },
                { "url": "reportingJurisdiction", "valueReference": { "reference": "Organization/ma-dph" } }
              ]
            }]
          }
        ]
      }
    }
  ]
}
```

### Reportability Status Codes

| Code | Description | Action Required |
|------|-------------|----------------|
| RRVS1 | Reportable | Submit report to listed public health agency |
| RRVS2 | May be Reportable | Review and submit if clinical judgment supports |
| RRVS3 | Not reportable | No action required |
| RRVS4 | No reporting rule found | No jurisdictional rule; no action |

---

## NHSN — National Healthcare Safety Network

**Governing Body:** CDC
**FHIR IG:** `http://hl7.org/fhir/us/nhsn-dqm/`

### NHSN Reporting via Digital Quality Measures (dQM)

NHSN is transitioning from manual web-based reporting to FHIR-based digital quality measures:

| NHSN Module | Report Type | FHIR Measure |
|------------|------------|-------------|
| Healthcare-Associated Infections (HAI) | CLABSI, CAUTI, SSI, VAP, MRSA, CDI | MeasureReport with individual/population |
| COVID-19/Respiratory Virus | Weekly inpatient data | MeasureReport |
| Antimicrobial Use (AU) | Antibiotic use rates | MeasureReport |
| Antimicrobial Resistance (AR) | Resistance patterns | MeasureReport |
| Pediatric COVID-19 | Pediatric patient data | MeasureReport |

### HAI Reporting — CLABSI Example

```http
POST /fhir/MeasureReport
Content-Type: application/fhir+json

{
  "resourceType": "MeasureReport",
  "meta": {
    "profile": ["http://hl7.org/fhir/us/nhsn-dqm/StructureDefinition/nhsn-measure-report"]
  },
  "status": "complete",
  "type": "summary",
  "measure": "http://www.cdc.gov/nhsn/fhirportal/dqm/ig/Measure/CLABSIRateMeasure",
  "subject": { "reference": "Location/icu-unit" },
  "period": { "start": "2026-01-01", "end": "2026-01-31" },
  "reporter": { "reference": "Organization/general-hospital" },
  "group": [
    {
      "code": { "coding": [{ "code": "clabsi-numerator" }] },
      "population": [
        { "code": { "coding": [{ "code": "numerator" }] }, "count": 1 },
        { "code": { "coding": [{ "code": "denominator" }] }, "count": 847 }
      ],
      "measureScore": { "value": 1.18, "unit": "per 1000 central line-days" }
    }
  ]
}
```

### NHSN Data Elements

| NHSN Requirement | FHIR Source | Our Resource |
|----------------|-------------|--------------|
| Facility ID | Organization.identifier[CCN/NPI] | Organization |
| Patient identifier | Patient.identifier | Patient |
| Admission date | Encounter.period.start | Encounter |
| Discharge date | Encounter.period.end | Encounter |
| Discharge disposition | Encounter.hospitalization.dischargeDisposition | Encounter |
| ICU days | Encounter.location[ICU].period | Encounter.location |
| Device days (central lines, catheters) | DeviceUseStatement.timing | DeviceUseStatement |
| HAI events | Condition (HAI SNOMED codes) | Condition |
| Antibiotic orders | MedicationRequest (antibiotic codes) | MedicationRequest |
| Culture results | Observation (LOINC microbiology) + DiagnosticReport | Observation |

---

## Syndromic Surveillance

**Governing Body:** CDC BioSense Platform / State health departments
**Standard:** HL7 2.5.1 (HL7 v2) for traditional; FHIR for modern implementations

### Syndromic Surveillance Reporting

ED visits are reported to syndromic surveillance systems in near-real-time:

| Data Element | FHIR Source | Notes |
|-------------|-------------|-------|
| Facility ID | Organization.identifier[NPI] | |
| Visit ID | Encounter.identifier | |
| Registration date/time | Encounter.period.start | ED arrival time |
| Chief complaint | Encounter.reasonCode | Free text + coded |
| Triage notes | Condition (chief-complaint category) | |
| Diagnosis codes | Condition (encounter-diagnosis) | ICD-10-CM |
| Disposition | Encounter.hospitalization.dischargeDisposition | |
| Age | Patient.birthDate | |
| Sex | Patient.extension[birthSex] | |
| Zip code | Patient.address[0].postalCode | |
| ZIP code of facility | Location.address.postalCode | |
| Visit reason (free text) | Encounter.reasonCode[0].text | |

### Syndromic Reporting Trigger

ED encounters trigger automatic syndromic reporting on discharge/registration:

```
When Encounter.class = EMER and Encounter.status changes to:
  - arrived → send registration report
  - finished → send discharge report
```

---

## Immunization Registries

**Standard:** HL7 FHIR Immunization (IIS) IG + CDC VXU/QBP HL7 v2 (traditional)
**Governing Body:** CDC IIS Support Branch; state immunization programs

### IIS Integration via FHIR

Modern IIS integration uses the FHIR Immunization resource:

**Submit immunization to IIS:**
```http
POST /iis/fhir/Immunization
Content-Type: application/fhir+json
Authorization: Bearer {iis_token}

{
  "resourceType": "Immunization",
  "status": "completed",
  "vaccineCode": {
    "coding": [
      { "system": "http://hl7.org/fhir/sid/cvx", "code": "207", "display": "COVID-19, mRNA, LNP-S, PF, 100 mcg/0.5mL dose" }
    ]
  },
  "patient": { "reference": "Patient/patient-123" },
  "occurrenceDateTime": "2026-04-14T10:30:00Z",
  "lotNumber": "LOT-2026-001",
  "expirationDate": "2027-06-30",
  "site": { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/v3-ActSite", "code": "LA", "display": "Left arm" }] },
  "route": { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/v3-RouteOfAdministration", "code": "IM" }] },
  "doseQuantity": { "value": 0.5, "unit": "mL", "system": "http://unitsofmeasure.org", "code": "mL" },
  "performer": [{ "function": { "coding": [{ "code": "AP", "display": "Administering Provider" }] }, "actor": { "reference": "Practitioner/nurse-jones" } }],
  "education": [{ "publicationDate": "2025-09-01", "presentationDate": "2026-04-14" }]
}
```

**Query IIS for patient history:**
```http
GET /iis/fhir/Immunization?patient=patient-123&status=completed
Authorization: Bearer {iis_token}
```

### CVX → IIS Vaccine Code Requirements

| CVX Code | Vaccine | Notes |
|---------|---------|-------|
| 207 | COVID-19 mRNA | Pfizer-BioNTech |
| 208 | COVID-19 mRNA | Moderna |
| 217 | COVID-19 mRNA | Pfizer bivalent |
| 03 | MMR | Measles-Mumps-Rubella |
| 08 | Hep B (adult) | Hepatitis B adult |
| 43 | Hep B (peds) | Hepatitis B pediatric |
| 20 | DTaP | Diphtheria-Tetanus-acellular Pertussis |
| 33 | Pneumococcal | Pneumococcal polysaccharide |
| 100 | PCV13 | Pneumococcal conjugate 13-valent |
| 140 | Influenza (preservative-free) | Seasonal flu |

### Traditional HL7 v2 IIS Integration (VXU)

For IIS that do not support FHIR, our gateway translates Immunization → VXU^V04:

| Immunization Field | VXU Segment | Notes |
|------------------|-------------|-------|
| `vaccineCode` | RXA-5 (CVX code) | CVX preferred |
| `occurrenceDateTime` | RXA-3 (date of administration) | |
| `lotNumber` | RXA-15 | |
| `expirationDate` | RXA-16 | |
| `manufacturer` | RXA-17 | MVX code |
| `performer` | RXA-10 | XCN |
| `doseQuantity` | RXA-6/7 | |
| `site` | RXR-2 | HL70163 |
| `route` | RXR-1 | HL70162 |
| `status = not-done` | RXA-20 = NA | |

---

## Cancer Registries

**Governing Body:** North American Association of Central Cancer Registries (NAACCR), SEER (NCI)
**Standards:** NAACCR v24, HL7 FHIR Pathology Reporting IG

### Cancer Registry Reporting Requirements

Reportable conditions include new primary malignancies, certain benign tumors, and in-situ conditions.

| Data Element | Source | FHIR Resource |
|-------------|--------|---------------|
| Primary site | Pathology report | DiagnosticReport.code (LOINC) |
| Histology/morphology | Pathology report | Observation (histology SNOMED) |
| Behavior | Pathology report | Observation |
| Grade/differentiation | Pathology report | Observation |
| TNM staging | Clinical/pathologic staging | Observation (TNM SNOMED) |
| Date of first diagnosis | Condition.onset | Condition |
| Treatment (surgery, chemo, radiation) | Procedure, MedicationRequest | Procedure, MedicationRequest |
| Facility of diagnosis | Encounter.serviceProvider | Organization |
| Attending physician | Encounter.participant | Practitioner |
| Patient demographics | Patient | Patient |

### FHIR Pathology Reporting

```http
POST /fhir/DiagnosticReport
Content-Type: application/fhir+json

{
  "resourceType": "DiagnosticReport",
  "meta": {
    "profile": ["http://hl7.org/fhir/us/cancer-reporting/StructureDefinition/us-pathology-diagnostic-report"]
  },
  "status": "final",
  "category": [{ "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/v2-0074", "code": "PAT" }] }],
  "code": { "coding": [{ "system": "http://loinc.org", "code": "22637-3", "display": "Pathology report diagnosis" }] },
  "subject": { "reference": "Patient/patient-123" },
  "effectiveDateTime": "2026-04-14",
  "issued": "2026-04-14T16:00:00Z",
  "performer": [{ "reference": "Practitioner/pathologist-jones" }],
  "result": [
    { "reference": "Observation/primary-site-obs" },
    { "reference": "Observation/histology-obs" },
    { "reference": "Observation/tnm-stage-obs" }
  ],
  "conclusion": "Invasive ductal carcinoma, Grade 2, pT2N1M0",
  "conclusionCode": [
    { "coding": [{ "system": "http://snomed.info/sct", "code": "408643008", "display": "Infiltrating duct carcinoma of breast" }] }
  ]
}
```

---

## Our Spec Support Summary

### Reporting Capability Matrix

| Reporting Type | Status | Implementation | Standard |
|---------------|--------|----------------|---------|
| eCR (eICR generation) | Supported | `POST /Encounter/{id}/$ecr-eicr` | eCR FHIR IG |
| eCR (RR ingestion) | Supported | `POST /Composition` (RR document) | eCR FHIR IG |
| NHSN HAI dQM | Supported | MeasureReport API | NHSN dQM FHIR IG |
| Syndromic surveillance | Supported | Automatic on ED encounter events | HL7 2.5.1 / BioSense |
| IIS (FHIR) | Supported | Immunization resource push/pull | IIS FHIR IG |
| IIS (HL7 v2) | Supported | VXU^V04 via HL7 gateway | HL7 v2.5.1 |
| Cancer registry | Supported | DiagnosticReport (pathology) | NAACCR / FHIR Pathology |
| COVID-19/Respiratory NHSN | Supported | MeasureReport API | NHSN dQM FHIR IG |
| Vital records | Roadmap | Death notification to state VR | VRDR FHIR IG |
| PDMP | Supported | MedicationDispense event | FHIR / NCPDP |

### Trigger Code Maintenance

RCTC (Reportable Condition Trigger Codes) value sets are updated quarterly by VSAC:

| Value Set Update | Our Process |
|-----------------|------------|
| New RCTC release published on VSAC | Automated VSAC subscription triggers value set refresh |
| Value set refreshed in terminology server | New trigger codes active within 24 hours |
| Alert to engineering team | If RCTC changes significantly, review eCR logic |

### Public Health Endpoint Configuration

| Jurisdiction | Endpoint Type | Configuration |
|-------------|--------------|---------------|
| CDC RCKMS (trigger evaluation) | HTTPS REST | `https://rckms.aimsplatform.org/api/v1/eicr` |
| State health departments | HIE/QHIN | Configured per state via endpoint directory |
| CDC NHSN | FHIR REST | `https://nhsn.cdc.gov/fhir/R4` |
| IIS (state) | FHIR or HL7 v2 | Configured per state via `Organization.endpoint` |
| BioSense (syndromic) | HL7 2.5.1 MLLP | `mllps://biosense.state.gov:2576` |
