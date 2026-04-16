# Medical Device Regulation Guide

**Purpose:** Guidance on when healthcare software constitutes a medical device and applicable regulatory requirements
**Regions Covered:** United States (FDA), European Union (MDR/IVDR), United Kingdom (MHRA)
**Last Updated:** 2026-04-14

---

## Table of Contents

1. [When Healthcare Software Is (and Is Not) a Medical Device](#when-healthcare-software-is-and-is-not-a-medical-device)
2. [FDA Software as a Medical Device (SaMD)](#fda-software-as-a-medical-device-samd)
3. [IEC 62304 — Software Lifecycle](#iec-62304--software-lifecycle)
4. [EU Medical Device Regulation (MDR 2017/745)](#eu-medical-device-regulation-mdr-2017745)
5. [EU In Vitro Diagnostic Regulation (IVDR 2017/746)](#eu-in-vitro-diagnostic-regulation-ivdr-2017746)
6. [CE Marking Process](#ce-marking-process)
7. [Unique Device Identification (UDI)](#unique-device-identification-udi)
8. [GMDN Coding](#gmdn-coding)
9. [UK Clinical Safety Standards (DCB0129/DCB0160)](#uk-clinical-safety-standards)
10. [Our Device Model Alignment](#our-device-model-alignment)

---

## When Healthcare Software Is (and Is Not) a Medical Device

### Decision Framework

The key question is whether software performs a **medical purpose** (diagnose, prevent, monitor, predict, treat, or compensate for disease or injury).

```
Does the software perform a function for a medical purpose?
├── NO  → Not a medical device (administrative, billing, general wellness)
└── YES → Potentially a medical device
          ├── Is it intended to analyze patient-specific data?
          │   ├── NO  → Lower risk (may qualify for regulatory discretion)
          │   └── YES → Higher likelihood of device classification
          └── Does it drive clinical decisions without human review?
              ├── NO  → May qualify for lower risk tier
              └── YES → Likely a medical device requiring regulation
```

### Examples: NOT a Medical Device

| Software Type | Reason |
|--------------|--------|
| Electronic health records (data storage) | Administrative; does not diagnose or treat |
| Appointment scheduling | Administrative function |
| Billing and claims processing | Administrative; financial |
| General wellness apps (step counting) | No medical purpose; general well-being |
| Population health analytics (no patient-specific output) | Not patient-specific clinical decision support |
| Data aggregation without clinical interpretation | Storage and display only |

### Examples: IS a Medical Device

| Software Type | Classification Basis |
|--------------|---------------------|
| AI diagnostic imaging (detecting cancer) | Provides diagnosis |
| Glucose monitoring app with dosing recommendation | Provides treatment recommendation |
| Arrhythmia detection from wearable data | Provides diagnosis |
| Drug interaction checker (prescriber-facing, patient-specific) | Drives prescribing decision |
| Sepsis early warning algorithm | Provides diagnosis/prognosis |
| Radiation therapy planning software | Treats disease |
| Computer-aided detection (CAD) for radiologists | Aids in diagnosis |

### FDA's CDS (Clinical Decision Support) Framework

The 21st Century Cures Act created a specific carve-out for **non-device CDS software**:

| Criterion | Requirement |
|-----------|-------------|
| Not acquire, process, analyze | Software must display, analyze, or print medical information from medical devices (not acquire from patients directly) |
| Not intended to replace clinical judgment | Clinician is expected to independently review basis for recommendation |
| Basis is transparent | The basis for the recommendation is displayed to the clinician |
| Not for serious/critical conditions | Not intended to acquire, process, or analyze images, signals, or patterns |

**If all four conditions are met:** NOT a medical device under FDA CDS exemption.

---

## FDA Software as a Medical Device (SaMD)

### IMDRF SaMD Classification Framework

The FDA follows the IMDRF (International Medical Device Regulators Forum) framework for SaMD risk categorization.

| SaMD Category | Healthcare Situation | SaMD Output | Examples |
|--------------|---------------------|-------------|---------|
| **IV (Highest Risk)** | Critical / serious | Treat or diagnose | Closed-loop insulin delivery, AI triage for life-threatening conditions |
| **III** | Serious | Treat or diagnose | Drug dosing calculator for oncology, sepsis alerting |
| **II** | Non-serious | Treat or diagnose; OR Critical/serious + inform only | Symptom checkers for minor conditions, population analytics |
| **I (Lowest Risk)** | Non-serious | Inform only | General health information software |

### FDA Device Classification by Risk

| Class | Risk Level | Regulatory Path | Examples |
|-------|-----------|----------------|---------|
| Class I | Low | Exempt or 510(k) | Most mobile apps, general wellness |
| Class II | Moderate | 510(k) Premarket Notification | Most SaMD; substantial equivalence required |
| Class III | High | PMA (Premarket Approval) | Novel, life-sustaining, or implanted devices |

### FDA 510(k) Pathway

**Substantial Equivalence Criteria:**
1. Same intended use as a legally marketed predicate device, AND
2. Same technological characteristics as predicate, OR different technological characteristics but do not raise new safety/effectiveness questions

**510(k) Submission Timeline:** FDA reviews within 90 days of acceptance; typically 3-6 months total.

### De Novo Classification

For novel low-to-moderate-risk devices without a predicate device:
- Creates a new classification with controls
- Once cleared, can serve as predicate for future 510(k)s
- Timeline: 150 days after acceptance

### FDA Software Pre-Certification (Pre-Cert) Program

FDA's excellence-based approach for software developers — evaluates the organization rather than only the product:
- Organization assessment (culture of quality and organizational excellence — CQOE)
- Streamlined marketing review for lower-risk SaMD from pre-certified organizations
- Ongoing transparency through real-world performance monitoring

---

## IEC 62304 — Software Lifecycle

**Standard:** IEC 62304:2006 + AMD 1:2015 — Medical device software: Software life cycle processes

### Safety Classes

| Safety Class | Potential Harm | Required Processes |
|-------------|---------------|-------------------|
| **Class A** | No injury or damage to health possible | All lifecycle processes; lighter documentation |
| **Class B** | Non-serious injury possible | Full lifecycle + SOUP management |
| **Class C** | Serious injury or death possible | Full lifecycle + strict SOUP + unit testing + full traceability |

### Software Lifecycle Processes (Abbreviated)

| Process | Key Activities | Class A | Class B | Class C |
|---------|---------------|---------|---------|---------|
| Software Development Planning | Define processes, deliverables, tools | Required | Required | Required |
| Software Requirements Analysis | Document and verify requirements | Required | Required | Required |
| Software Architectural Design | Define software items and their relationships | N/A | Required | Required |
| Software Detailed Design | Detailed design of each software unit | N/A | N/A | Required |
| Software Unit Implementation | Coding, code review | Required | Required | Required |
| Software Unit Verification | Unit testing | Required | Required | Required + coverage |
| Software Integration and Testing | Integration testing, traceability | Required | Required | Required |
| Software System Testing | System-level testing | Required | Required | Required |
| Software Release | Establish baseline, release documentation | Required | Required | Required |

### SOUP (Software of Unknown Provenance)

Third-party libraries and components that have not been developed to IEC 62304:

| Activity | Class A | Class B | Class C |
|----------|---------|---------|---------|
| Identify SOUP items | Required | Required | Required |
| Identify SOUP requirements | N/A | Required | Required |
| Verify correct SOUP integration | N/A | Required | Required |
| Evaluate published anomaly lists | N/A | Required | Required |

---

## EU Medical Device Regulation (MDR 2017/745)

**Effective:** May 26, 2021 (with phased transition periods)
**Replaces:** MDD (93/42/EEC) and AIMDD (90/385/EEC)

### MDR Device Classification

| Class | Risk | Examples | Required Conformity Assessment |
|-------|------|---------|-------------------------------|
| Class I | Low | Bandages, non-sterile surgical instruments | Self-declaration (unless sterile/measuring/reusable surgical) |
| Class IIa | Medium-low | Hearing aids, diagnostic ultrasound | Notified Body involvement |
| Class IIb | Medium-high | Ventilators, infusion pumps | Notified Body + design examination |
| Class III | High | Pacemakers, coronary stents | Notified Body + design dossier examination |

### Software Classification under MDR Annex VIII Rule 11

Software intended to provide information used to make decisions with diagnosis or therapeutic purposes:

| Decision Type | Classification |
|--------------|---------------|
| Decisions with serious consequences (prognosis, diagnosis, monitoring of physiological conditions) | **Class III** |
| Decisions that do not meet Class III criteria | **Class IIa** |
| Other software (administrative, financial) | **Class I** |

**Downclassification possible if:** Software aids in processing of images acquired by in vitro diagnostic medical devices only → Class IIa or IIb per Rule 10.

### Technical Documentation Requirements

| Document | Content |
|----------|---------|
| Device description | Intended purpose, indications, contraindications, target patient population |
| Design and manufacturing information | Architecture, components, verification and validation |
| General Safety and Performance Requirements (GSPR) | Demonstration of compliance with Annex I |
| Benefit-risk analysis | Benefit vs residual risk |
| Risk management report | ISO 14971 process |
| Clinical evaluation | Clinical data, PMCF plan |
| Post-market surveillance plan | Ongoing monitoring approach |

---

## EU In Vitro Diagnostic Regulation (IVDR 2017/746)

**Effective:** May 26, 2022 (with phased transition periods to 2025-2027)
**Replaces:** IVDD (98/79/EC)

### IVDR Device Classification

| Class | Examples | Required Assessment |
|-------|---------|---------------------|
| Class A | Specimen containers, general lab equipment | Self-declaration |
| Class B | Pregnancy tests, blood glucose for self-testing | Self-declaration + technical file |
| Class C | Rubella IgG tests, HbA1c tests | Notified Body required |
| Class D (Highest) | Blood grouping, HIV tests, hepatitis B | Notified Body + EMA/national body consultation |

### Software as IVD

Software that analyzes in vitro specimen data (lab values, genetic sequencing) for diagnostic purposes is an IVD:
- Laboratory information systems with diagnostic interpretation → IVD
- Algorithm calculating sepsis risk from lab panels → IVD
- Purely administrative lab management software → Not IVD

---

## CE Marking Process

### General CE Marking Steps

| Step | Description | Who |
|------|-------------|-----|
| 1. Classify device | Apply MDR/IVDR classification rules | Manufacturer |
| 2. Identify applicable regulations and standards | MDR/IVDR + harmonized standards (ISO 14971, IEC 62304, etc.) | Manufacturer |
| 3. Establish QMS | ISO 13485 quality management system | Manufacturer |
| 4. Compile technical documentation | Device description, design files, risk management, clinical evaluation | Manufacturer |
| 5. Select conformity assessment route | Based on device class; engage Notified Body if required | Manufacturer |
| 6. Notified Body review | Assessment of technical documentation, QMS audit | Notified Body |
| 7. Declaration of Conformity | Manufacturer declares compliance with MDR/IVDR | Manufacturer |
| 8. CE mark affixing | CE mark with Notified Body number (if applicable) | Manufacturer |
| 9. EUDAMED registration | Register device and manufacturer in EU database | Manufacturer |
| 10. Post-market surveillance | Ongoing safety monitoring, PMCF | Manufacturer |

### Harmonized Standards for Medical Software

| Standard | Scope |
|----------|-------|
| IEC 62304 | Medical device software lifecycle |
| ISO 14971 | Application of risk management to medical devices |
| IEC 62366-1 | Usability engineering for medical devices |
| ISO 13485 | Quality management systems for medical devices |
| IEC 80001-1 | Risk management for IT-networks incorporating medical devices |
| ISO 27001 | Information security management |

---

## Unique Device Identification (UDI)

### FDA UDI System

**Authority:** 21 CFR Part 830 and Part 801

| Element | Description |
|---------|-------------|
| Device Identifier (DI) | Mandatory fixed portion identifying labeler and specific version or model |
| Production Identifier (PI) | Conditional variable portion identifying lot/batch number, serial number, expiration date, manufacturing date |
| Human Readable Interpretation (HRI) | Text version on label |
| AIDC | Automatic identification and data capture (barcode, RFID) |

**GUDID (Global Unique Device Identification Database):** FDA's publicly searchable UDI database. Manufacturers must submit device information to GUDID.

### EU UDI System (MDR Article 27)

| Element | EU Requirement |
|---------|---------------|
| UDI-DI | Unique device identifier for model/version; registered in EUDAMED |
| UDI-PI | Production identifier on individual units |
| UDI carrier | Barcode or RFID on device label |
| EUDAMED registration | UDI-DI must be registered before placing on market |

### UDI Issuing Agencies

| Agency | System | Used In |
|--------|--------|---------|
| GS1 | GS1 DataMatrix, barcode | Global standard |
| HIBCC | HIBCC barcode | Healthcare distribution |
| ICCBBA | ISBT 128 | Blood, tissues, cellular therapy |
| IFA GmbH | Pharmacy-specific | Germany/Europe |

---

## GMDN Coding

**GMDN:** Global Medical Device Nomenclature — maintained by the GMDN Agency

- Each GMDN term describes a generic category of medical devices
- GMDN code (5-digit numeric) used in regulatory submissions, EUDAMED, and FDA GUDID
- Manufacturers must identify the appropriate GMDN term for each device

**Searching for GMDN codes:** GMDN Agency database at https://www.gmdnagency.org/

---

## UK Clinical Safety Standards

**Applicability:** Software used in clinical settings within the NHS or connected to NHS systems

### DCB0129 — Clinical Risk Management for Manufacturers

**Full Title:** Clinical Risk Management: its Application in the Manufacture of Health IT Systems

| Activity | Requirement |
|----------|------------|
| Hazard identification | Identify all reasonably foreseeable hazards |
| Risk analysis | Assess severity and probability for each hazard |
| Risk evaluation | Determine if risk is acceptable |
| Risk control | Implement controls; re-evaluate residual risk |
| Clinical Safety Case | Document overall safety argument |
| Clinical Safety Case Report | Formal sign-off by Clinical Safety Officer |

**Clinical Safety Officer (CSO):** Must be a clinically qualified person with appropriate training; responsible for clinical safety case sign-off.

### DCB0160 — Clinical Risk Management for Deployment

**Full Title:** Clinical Risk Management: its Application in the Deployment and Use of Health IT Systems

| Activity | Requirement |
|----------|------------|
| Hazard log | Receive and review manufacturer's hazard log |
| Local hazard assessment | Identify deployment-specific hazards |
| Integration risk | Assess risks from integration with other systems |
| Clinical Safety Case | Document deployment safety |
| Incident management | Report and learn from safety incidents |

---

## Our Device Model Alignment

### FHIR Device Resource Mapping

| Device Attribute | FHIR Device Field | MDR/FDA Equivalent |
|-----------------|-------------------|-------------------|
| UDI Device Identifier | `Device.udiCarrier.deviceIdentifier` | UDI-DI |
| UDI Carrier (barcode) | `Device.udiCarrier.carrierAIDC` | AIDC carrier |
| UDI Human Readable | `Device.udiCarrier.carrierHRF` | HRI |
| Manufacturer | `Device.manufacturer` | Manufacturer |
| Manufacturing date | `Device.manufactureDate` | UDI-PI manufacturing date |
| Expiry date | `Device.expirationDate` | UDI-PI expiry |
| Lot number | `Device.lotNumber` | UDI-PI lot/batch |
| Serial number | `Device.serialNumber` | UDI-PI serial |
| Model number | `Device.modelNumber` | Model/version |
| Device type | `Device.type` (SNOMED CT) | GMDN/device category |
| Safety status | `Device.safety` | Safety classification |
| Status | `Device.status` | Active/inactive status |

### DeviceDefinition Resource

| DeviceDefinition Attribute | Purpose |
|--------------------------|---------|
| `DeviceDefinition.udiDeviceIdentifier` | GUDID/EUDAMED registration link |
| `DeviceDefinition.manufacturerString` | Manufacturer name |
| `DeviceDefinition.classification` | MDR class or FDA class |
| `DeviceDefinition.hasPart` | Component devices (complex devices) |
| `DeviceDefinition.property` | Device-specific properties |
| `DeviceDefinition.capability` | Supported capabilities |

### Regulatory Classification Extensions

Our custom extensions for regulatory compliance:

| Extension URI | Purpose | Values |
|--------------|---------|--------|
| `https://monobase.health/fhir/StructureDefinition/device-fda-class` | FDA device class | Class I, II, III |
| `https://monobase.health/fhir/StructureDefinition/device-mdr-class` | EU MDR class | I, IIa, IIb, III |
| `https://monobase.health/fhir/StructureDefinition/device-gmdn-code` | GMDN code | 5-digit numeric |
| `https://monobase.health/fhir/StructureDefinition/device-ce-marking` | CE marking status | marked, pending, exempt |
| `https://monobase.health/fhir/StructureDefinition/device-iec62304-class` | IEC 62304 software class | A, B, C |
| `https://monobase.health/fhir/StructureDefinition/device-510k-number` | FDA 510(k) clearance number | K-number |
| `https://monobase.health/fhir/StructureDefinition/device-eudamed-srn` | EUDAMED SRN | EU registration |
