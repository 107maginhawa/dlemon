# ISO Standards Alignment Guide

**Purpose:** Alignment of the Monobase Healthcare API with key ISO standards for health informatics, security, and interoperability
**Last Updated:** 2026-04-14

---

## Table of Contents

1. [ISO 27001 — Information Security Management](#iso-27001--information-security-management)
2. [ISO 27799 — Health Informatics Security](#iso-27799--health-informatics-security)
3. [ISO 22600 — Privilege Management](#iso-22600--privilege-management)
4. [ISO 13131 — Telehealth](#iso-13131--telehealth)
5. [ISO 13606 — EHR Communication](#iso-13606--ehr-communication)
6. [ISO IDMP Series — Medicinal Product Identification](#iso-idmp-series--medicinal-product-identification)
7. [ISO 18308 — EHR Architecture Requirements](#iso-18308--ehr-architecture-requirements)
8. [Standards Cross-Reference to Our Spec](#standards-cross-reference-to-our-spec)

---

## ISO 27001 — Information Security Management

**Standard:** ISO/IEC 27001:2022 — Information security, cybersecurity and privacy protection — Information security management systems — Requirements

### Overview

ISO 27001 specifies requirements for establishing, implementing, maintaining, and continually improving an information security management system (ISMS). Certification requires an independent third-party audit.

### Key Clauses

| Clause | Title | Key Requirements |
|--------|-------|-----------------|
| 4 | Context of the organization | Understand context, interested parties, scope, ISMS |
| 5 | Leadership | Management commitment, policy, roles and responsibilities |
| 6 | Planning | Risk assessment and treatment, information security objectives |
| 7 | Support | Resources, competence, awareness, communication, documented information |
| 8 | Operation | Operational planning, risk assessment and treatment |
| 9 | Performance evaluation | Monitoring, internal audit, management review |
| 10 | Improvement | Nonconformity, corrective action, continual improvement |

### Annex A Controls (ISO 27001:2022)

The 2022 version reorganized controls into 4 themes (93 controls total):

| Theme | Controls | Examples Relevant to Healthcare |
|-------|---------|--------------------------------|
| Organizational (37) | Policies, roles, asset management, supplier relationships | Information security policies (A.5.1), information classification (A.5.12), supplier security (A.5.19) |
| People (8) | Screening, training, disciplinary process, remote working | Security awareness training (A.6.3), remote working security (A.6.7) |
| Physical (14) | Perimeter security, equipment, media | Physical security perimeters (A.7.1), clear desk/screen (A.7.7), media disposal (A.7.14) |
| Technological (34) | Access control, cryptography, network, monitoring | Access control (A.8.2–A.8.6), cryptography (A.8.24), network segmentation (A.8.22), vulnerability management (A.8.8) |

### New Controls in ISO 27001:2022

| Control | Description | Healthcare Relevance |
|---------|-------------|---------------------|
| A.5.7 — Threat intelligence | Gathering and analyzing threat intelligence | Clinical system threats, ransomware targeting hospitals |
| A.5.23 — Information security for cloud services | Establishing cloud security policies | Cloud EHR security requirements |
| A.5.30 — ICT readiness for business continuity | Planning ICT availability for business continuity | Clinical system availability |
| A.8.9 — Configuration management | Managing secure configurations | EHR configuration standards |
| A.8.10 — Information deletion | Deleting information when no longer needed | PHI/EHI deletion after retention period |
| A.8.12 — Data leakage prevention | DLP controls | PHI exfiltration prevention |
| A.8.16 — Monitoring activities | Monitoring systems for anomalous behavior | Anomalous PHI access detection |
| A.8.23 — Web filtering | Filtering web access | Preventing malware download in clinical settings |
| A.8.28 — Secure coding | Secure development practices | API security, injection prevention |

### Relationship to HIPAA

| ISO 27001 Area | HIPAA Security Rule Equivalent |
|---------------|-------------------------------|
| Risk assessment (Clause 6.1) | §164.308(a)(1) Risk Analysis |
| Access control (A.8.2–A.8.6) | §164.312(a)(1) Access Control |
| Cryptography (A.8.24) | §164.312(a)(2)(iv) Encryption |
| Incident management (A.5.26) | §164.308(a)(6) Security Incident Procedures |
| Business continuity (A.5.30) | §164.308(a)(7) Contingency Plan |
| Audit logging (A.8.15) | §164.312(b) Audit Controls |
| Physical security (A.7) | §164.310 Physical Safeguards |

---

## ISO 27799 — Health Informatics Security

**Standard:** ISO 27799:2016 — Health informatics — Information security management in health using ISO/IEC 27002

### Overview

ISO 27799 provides guidance on implementing ISO 27001/27002 controls specifically for health informatics environments. It is not a certification standard but provides sector-specific guidance.

### Healthcare-Specific Guidance Areas

| Area | ISO 27799 Guidance |
|------|--------------------|
| Health information classification | PHI, de-identified data, administrative data sensitivity tiers |
| Mobile devices in clinical settings | Policies for mobile devices accessing EHI |
| Clinical workstations | Auto-logoff, screen privacy, session management |
| Medical devices on networks | IEC 80001 risk management for medical device networks |
| Health data backup | Clinical data backup frequency; RTO/RPO requirements |
| Remote access | VPN requirements for remote clinical access |
| Health data retention | Legal retention periods by data type and jurisdiction |
| Telemedicine security | Secure video, patient identity verification |
| External system interfaces | Security for HIE connections, API security |

### Clinical Safety Interaction

ISO 27799 recognizes that security controls may affect clinical safety — there must be mechanisms for emergency access even when security controls are active:

| Scenario | Security Consideration | Clinical Safety Consideration |
|----------|----------------------|------------------------------|
| Forgotten password | Account lockout | Break-glass emergency access |
| System outage | Data availability | Downtime procedures with paper backup |
| Loss of medical device | Device data wiping | Critical patient data backup |
| Unauthorized access alert | Automatic session termination | Must not interrupt active clinical procedure |

---

## ISO 22600 — Privilege Management

**Standard:** ISO 22600:2014 Parts 1–3 — Health informatics — Privilege management and access control

### Overview

ISO 22600 defines a comprehensive framework for privilege management in healthcare, covering the policies, models, and mechanisms for controlling access to health information.

### Part 1: Concepts and Policy (ISO 22600-1)

| Concept | Definition |
|---------|-----------|
| Privilege | Right to perform an operation on a protected resource |
| Access Control | Process of granting or denying requests to access resources |
| Role | Named function or position; collection of privileges |
| Policy | Set of rules governing access decisions |
| Delegation | Ability to grant one's privileges to another party |

### Access Control Models

| Model | Description | Healthcare Use Case |
|-------|-------------|---------------------|
| RBAC (Role-Based Access Control) | Access determined by assigned roles | Physician role can access clinical records; billing role can access financial data |
| ABAC (Attribute-Based Access Control) | Access determined by attributes of subject, object, environment | Treating physician (attribute) + active encounter (attribute) → access |
| Policy-Based Access Control (PBAC) | Access determined by formal policy | Consent-driven access; purpose-of-use-based policies |
| Mandatory Access Control (MAC) | Access determined by security labels | High-sensitivity records (VIP patients, HIV status) |

### Part 2: Formal Models (ISO 22600-2)

Formal mathematical models for role hierarchies and privilege delegation:

| Model Element | Description |
|--------------|-------------|
| Role hierarchy | Roles inherit permissions from parent roles (e.g., Physician inherits from Clinician) |
| Separation of duties | Certain role combinations are mutually exclusive (e.g., prescriber and dispenser) |
| Delegation constraints | Limits on how privileges can be delegated; maximum delegation depth |
| Temporal constraints | Access only during shift hours or active encounter |

### Part 3: Implementations (ISO 22600-3)

| Implementation Pattern | Description |
|-----------------------|-------------|
| Role-to-function mapping | Map clinical roles to specific function permissions |
| Policy distribution | Distribute access policies to enforcement points |
| Audit interface | Log all access decisions for accountability |
| Emergency override | Break-glass mechanism with automatic escalation |

### ISO 22600 Implementation in Practice

| Standard Concept | Our Implementation |
|-----------------|-------------------|
| Role | `PractitionerRole.code` (SNOMED CT role codes) |
| Privilege | SMART scope (e.g., `patient/Observation.read`) |
| RBAC | Role-to-scope mapping in `AccessPolicy` resource |
| ABAC | Dynamic scope evaluation based on `Encounter` participation |
| Consent policy | `Consent` resource provisions evaluated at runtime |
| Delegation | `PractitionerRole.practitioner` chain |
| Audit | `AuditEvent` with `purposeOfUse` field |

---

## ISO 13131 — Telehealth

**Standard:** ISO 13131:2021 — Health informatics — Telehealth services — Quality planning guidelines

### Overview

ISO 13131 provides guidance for planning, implementing, and evaluating telehealth services to ensure they are safe, effective, and appropriately governed.

### Key Quality Domains

| Domain | Key Requirements |
|--------|----------------|
| Governance | Organizational policies for telehealth; clinical responsibility assignment |
| Clinical processes | Patient assessment, consent, clinical protocols for remote care |
| Technology | Device requirements, connectivity, reliability, security |
| Workforce | Telehealth-specific training and competencies |
| Safety | Adverse event management; contraindications for telehealth |
| Privacy | Informed consent for video; secure channels |
| Access equity | Ensuring equitable access regardless of technology literacy |
| Evaluation | Systematic quality evaluation and improvement |

### Telehealth Data Elements

| Element | Description | FHIR Resource |
|---------|-------------|---------------|
| Virtual encounter | Remote consultation | `Encounter.class = "VR"` |
| Video consent | Patient consent for telehealth | `Consent` with `scope = "telehealth"` |
| Technology used | Platform, device type | `Encounter.extension.teletechType` |
| Clinical outcomes | Results of telehealth encounter | `Observation`, `DiagnosticReport` |
| Technical incidents | Connectivity failures affecting care | `AuditEvent` + `AdverseEvent` |

---

## ISO 13606 — EHR Communication

**Standard:** ISO 13606:2019 (5 parts) — Health informatics — Electronic health record communication

### Overview

ISO 13606 defines a Reference Model and archetype framework for EHR communication. It is the basis for the openEHR standard and informs FHIR design.

### Architecture

| Part | Title | Content |
|------|-------|---------|
| Part 1 | Reference model | Core EHR information model (EHR, FOLDER, COMPOSITION, ENTRY, CLUSTER, ELEMENT) |
| Part 2 | Archetype interchange specification | Archetype Definition Language (ADL) |
| Part 3 | Reference archetypes and term lists | Demographic archetype, common clinical archetypes |
| Part 4 | Security requirements | EHR security; access control; accountability |
| Part 5 | Interface specification | API definition for EHR communication |

### ISO 13606 to FHIR Mapping

| ISO 13606 Concept | FHIR Equivalent |
|------------------|----------------|
| EHR | Patient (with associated records) |
| FOLDER | List (grouping of related resources) |
| COMPOSITION | Composition |
| SECTION | Composition.section |
| OBSERVATION | Observation |
| EVALUATION | ClinicalImpression |
| INSTRUCTION | ServiceRequest, MedicationRequest |
| ACTION | Procedure, MedicationAdministration |
| CLUSTER | Complex Observation components |
| ELEMENT | Observation.value, Observation.component |
| Archetype | FHIR Profile / StructureDefinition |

### Part 4 — Security Requirements

ISO 13606-4 defines specific security requirements for EHR systems:

| Requirement | Description |
|-------------|-------------|
| Subject of care identity | Reliable patient identification in every EHR entry |
| Attestation | Author must attest to entries (digital signature or equivalent) |
| Sensitivity labels | Classification of sensitive EHR sections |
| Access control | Role-based and consent-based access |
| Audit trail | Complete log of access and modifications |
| Non-repudiation | Cannot deny authoring an entry |
| Data integrity | Detect unauthorized modifications |
| Anonymization | Support for research/statistical disclosure |

---

## ISO IDMP Series — Medicinal Product Identification

**Purpose:** Provide global, unambiguous identification of medicinal products for regulatory and clinical use

### IDMP Standards Family

| Standard | Title | Content |
|----------|-------|---------|
| ISO 11615 | Identification of Medicinal Products (IDMP) | Pharmaceutical product definition, authorization, packaging |
| ISO 11616 | Pharmaceutical product information | Pharmaceutical dose form, route of administration, units of presentation |
| ISO 11238 | Regulated information on substances | Substance identification, molecular structures |
| ISO 11239 | Pharmaceutical dose forms, routes of administration, packaging | Controlled vocabulary for dose forms |
| ISO 11240 | Units and controlled vocabularies for product information | Units of measurement for medicinal products |

### SPOR (Substance, Product, Organisation, Referential)

The EMA's SPOR Master Data Management system implements IDMP standards for EU regulatory submissions:

| Component | ISO Standard | Content |
|-----------|-------------|---------|
| SMS (Substance) | ISO 11238 | Substance identification; molecular structures |
| PMS (Product) | ISO 11615 | Medicinal product identification |
| OMS (Organisation) | N/A (EMA specific) | Marketing authorization holder, manufacturer |
| RMS (Referential) | ISO 11239, 11240 | Dose forms, routes, units, packaging |

### IDMP to FHIR Mapping

| IDMP Element | FHIR Resource | Field |
|-------------|---------------|-------|
| Medicinal product | MedicinalProductDefinition | All |
| Pharmaceutical product | AdministrableProductDefinition | All |
| Packaging | PackagedProductDefinition | All |
| Manufactured item | ManufacturedItemDefinition | All |
| Substance | SubstanceDefinition | All |
| Ingredient | Ingredient | All |
| Regulated authorization | RegulatedAuthorization | All |
| Clinical use definition | ClinicalUseDefinition | Interactions, contraindications |

### Coding in Medication Resources

| Coding System | ISO Standard | FHIR Element |
|--------------|-------------|--------------|
| PHPID (Pharmaceutical Product Identifier) | ISO 11615 | MedicinalProductDefinition.identifier |
| PCID (Packaged Clinical Item Descriptor) | ISO 11615 | PackagedProductDefinition.identifier |
| SPOR substance code | ISO 11238 | Ingredient.substance.code |
| EDQM dose form | ISO 11239 | AdministrableProductDefinition.administrableDoseForm |
| UCUM units | ISO 11240 | Quantity.system = "http://unitsofmeasure.org" |

---

## ISO 18308 — EHR Architecture Requirements

**Standard:** ISO 18308:2011 — Health informatics — Requirements for an electronic health record architecture

### Overview

ISO 18308 defines a set of requirements that an EHR architecture must satisfy. It does not specify implementation — it evaluates architectures against a requirement set.

### Core Requirement Categories

| Category | Key Requirements |
|----------|----------------|
| **Ethical** | Patient rights; privacy; confidentiality; consent |
| **Information** | Accurate representation; completeness; single logical record; longitudinal |
| **Medico-legal** | Indelibility; accountability; attestation; retention |
| **Architectural** | Openness; extensibility; scalability; interoperability |
| **Security** | Authentication; authorization; audit; integrity; availability |
| **Communication** | Communication standards; packaging; translation |
| **Terminological** | Terminology binding; concept representation |
| **Subject of care** | Accurate patient identification; demographics |

### Key Requirements with FHIR Alignment

| ISO 18308 Requirement | Description | FHIR Alignment |
|----------------------|-------------|----------------|
| R1.1 — Single logical record | All EHR data for a patient forms a single logical record | Patient resource as anchor; all resources reference Patient |
| R1.2 — Longitudinal record | EHR spans the entire lifetime of the patient | Resource history preserved; no deletion of clinical data |
| R2.1 — Indelibility | Clinical entries cannot be deleted, only flagged | FHIR resources have `meta.versionId`; updates create new versions |
| R2.3 — Attestation | Author must attest to each entry | `Composition.attester`; `Provenance.agent` |
| R3.1 — Interoperability | EHR can exchange with other systems | FHIR REST API; standard terminologies |
| R3.2 — Openness | Standard, publicly available specifications | FHIR is an open, publicly available standard |
| R4.1 — Patient consent | Patient consent controls access | `Consent` resource; consent enforcement at API gateway |
| R4.2 — Emergency access | Override privacy in genuine emergency | Break-glass mechanism; `Consent.provision.type = "override"` |
| R5.1 — Audit trail | Complete log of access and modifications | `AuditEvent` for every interaction |
| R5.2 — Accountability | Identify who accessed or modified any entry | `AuditEvent.agent`; `Provenance.agent` |
| R5.3 — Integrity | Detect tampering | Resource hashes; signed audit logs |
| R6.1 — Terminology binding | Consistent use of coding systems | SNOMED CT, LOINC, RxNorm required; extensible bindings |

---

## Standards Cross-Reference to Our Spec

### Comprehensive Mapping Table

| ISO Standard | Controls Addressed | Our API Module | FHIR Resources |
|-------------|-------------------|----------------|----------------|
| ISO 27001 | ISMS, access control, cryptography, audit, incident management | Security module, AuditEvent API | AuditEvent, Consent |
| ISO 27799 | Healthcare-specific security, emergency access, retention | Security runbook, break-glass, retention policy | AuditEvent, Consent, Provenance |
| ISO 22600 | RBAC, ABAC, role hierarchy, consent policy, delegation | AccessPolicy, PractitionerRole, SMART scopes | PractitionerRole, Consent |
| ISO 13131 | Telehealth governance, virtual encounter, consent | Encounter (VR class), Consent | Encounter, Consent |
| ISO 13606 | EHR communication, archetype, security, attestation | Composition API, Provenance | Composition, Provenance |
| ISO 11615/11238 | Medicinal product identification, substance coding | Medication API | Medication, MedicinalProductDefinition |
| ISO 11239/11240 | Dose forms, routes, units vocabulary | Terminology bindings | CodeSystem bindings |
| ISO 18308 | EHR architecture, longitudinal record, indelibility, attestation | Core data model, versioning | All resources; Composition.attester |

### Certification and Conformance Summary

| Standard | Certification Available? | Our Position |
|----------|--------------------------|-------------|
| ISO 27001 | Yes (third-party audit) | Target certification for production environments |
| ISO 27799 | No (guidance document) | Implemented as guidance in security runbook |
| ISO 22600 | No (framework document) | Implemented in access control design |
| ISO 13131 | No (quality guidelines) | Referenced in telehealth feature design |
| ISO 13606 | Conformance claim possible | Compositional architecture aligned |
| ISO 11615 series | Regulatory compliance (IDMP) | Medication resources aligned with IDMP |
| ISO 18308 | No (requirements framework) | Architecture evaluated against requirements |
