# Global Healthcare Privacy, Security & Compliance Frameworks for Universal Healthcare API Specification

## Executive Summary

This document provides a comprehensive mapping of healthcare privacy, security, and compliance frameworks globally that a universal healthcare API specification must support or account for. It goes beyond HIPAA and GDPR to cover every major jurisdiction and international standard.

---

## 1. UNITED STATES

### 1.1 HIPAA (Health Insurance Portability and Accountability Act)
- **Full Name:** Health Insurance Portability and Accountability Act of 1996
- **Jurisdiction:** United States (Federal)
- **Governing Body:** U.S. Department of Health and Human Services (HHS) - Office for Civil Rights (OCR)
- **Status:** Mandatory
- **Effective Date:** 1996; enforced since 2003
- **Key Components:**
  - Privacy Rule: Controls use/disclosure of protected health information (PHI)
  - Security Rule: Administrative, physical, technical safeguards for ePHI
  - Breach Notification Rule: Requires notification within 60 days (updated to 30 days in 2025)

**Key API Design Requirements:**
- Encryption of ePHI at rest and in transit (AES-256 minimum)
- Audit logging of all access to PHI with retention for minimum 6 years
- Minimum necessary principle: APIs must limit data to what's required for the purpose
- User authentication and authorization with role-based access control (RBAC)
- Consent before data access (with exceptions for treatment/payment/operations)
- Patient access rights: APIs must enable patients to access their own records
- Business associate agreements (BAAs) required for all vendors

**Penalties for Non-Compliance:**
- Civil penalties: $100–$50,000 per violation (updated with HIPAA Omnibus Rule)
- Criminal penalties: Up to $250,000 and 10 years imprisonment for intentional misuse
- Corrective action plans and ongoing monitoring

**Data Model Impact:**
- Structured data for audit trail (who, what, when, where, why)
- Metadata for consent tracking and purpose of use
- De-identification standards (Safe Harbor method or Expert Determination)

---

### 1.2 HITECH Act (Health Information Technology for Economic and Clinical Health)
- **Full Name:** HITECH Act, Title XIII of the American Recovery and Reinvestment Act of 2009
- **Jurisdiction:** United States
- **Governing Body:** HHS
- **Status:** Mandatory (amendments to HIPAA)
- **Effective Date:** February 17, 2009
- **Key Changes:**
  - Strengthened enforcement of HIPAA
  - Extended liability to business associates
  - Mandatory breach notification
  - Enhanced penalties

**API Design Impact:**
- Business associates must implement same HIPAA Security Rule safeguards
- Subprocessor disclosure required for cloud/API providers
- Incident response APIs must support breach detection and notification

---

### 1.3 21st Century Cures Act (Information Blocking Rule)
- **Full Name:** 21st Century Cures Act: Interoperability, Information Blocking, and ONC Health IT Certification
- **Jurisdiction:** United States
- **Governing Body:** Office of the National Coordinator for Health Information Technology (ONC); Centers for Medicare & Medicaid Services (CMS)
- **Status:** Mandatory
- **Effective Enforcement Date:** July 1, 2024 (for healthcare providers); April 5, 2021 (rules adopted)
- **Last Update:** 2025 ASTP/ONC HTI-5 Proposed Rule (deregulation/refinement)

**Key Requirements:**
- APIs must support FHIR-based interoperability standards
- Patient Access APIs: Required for all EHR systems
- No blocking of lawful, interoperable data exchange
- Exceptions for security, privacy, patient safety, and infeasibility

**API Design Mandates:**
- FHIR Release 4.0.1 and HL7 FHIR US Core Implementation Guide STU 3.1.1
- RESTful APIs with JSON/XML support
- Scope-based authorization (OAuth 2.0, SMART on FHIR)
- Real-time or near-real-time data availability
- Developer documentation and sandbox environments

**Penalties:**
- CMS: Up to $1 million per violation for covered entities
- FTC enforcement: Up to $43,792 per violation (2024 amounts)
- State attorneys general can also enforce

**Data Access Requirements:**
- Patient must have ability to download/export full health records
- Third-party app access without requiring patient to sign separate agreements
- Granular consent management (scoped permissions per app)
- No prohibition on patient-directed care with competing providers

---

### 1.4 42 CFR Part 2 (Substance Use Disorder Records)
- **Full Name:** Confidentiality of Substance Use Disorder Patient Records
- **Jurisdiction:** United States (Federal)
- **Governing Body:** SAMHSA (Substance Abuse and Mental Health Services Administration)
- **Status:** Mandatory
- **Final Rule Effective:** April 16, 2024; Compliance Deadline: February 16, 2026

**Key Requirements:**
- More stringent than HIPAA for substance use treatment records
- Single unified consent for treatment, payment, operations (no separate consents required)
- Segregation/segmentation NOT required (differs from prior rules)
- Same breach notification as HIPAA Breach Notification Rule applies
- Opioid treatment programs must comply
- Federal law clinics and federally funded programs covered

**API Design Requirements:**
- Separate audit trails for Part 2 records vs. general PHI
- Consent stored with API access requests (not in traditional EHR flows)
- Disclosure recipient must retain copy of written consent with data
- Electronic disclosure requires new API/data flow workflows
- Part 2 records cannot be accessed without explicit consent

**Penalties:**
- Same as HIPAA but higher scrutiny in enforcement
- Additional state enforcement possible

---

### 1.5 FDA Software as a Medical Device (SaMD) Regulations
- **Full Name:** FDA Regulations on Software as a Medical Device
- **Jurisdiction:** United States
- **Governing Body:** U.S. Food and Drug Administration (FDA) - Center for Devices and Radiological Health (CDRH)
- **Status:** Mandatory (if software constitutes medical device)

**Risk Categories (I–IV):** Based on impact on patient health

**API Design Requirements:**
- Design controls and risk analysis for all software components
- Cybersecurity threat modeling and risk assessment
- Predetermined Change Control Plans (PCCP) for AI/ML models
- Version control and update management via APIs
- For digital therapeutics: Real-world performance monitoring
- Software Bill of Materials (SBOM) disclosure

**Compliance Path:**
- 510(k) premarket notification (most SaMD)
- Premarket approval (higher-risk SaMD)
- De Novo pathway for novel software
- Continued postmarket surveillance

---

### 1.6 DEA Electronic Prescribing of Controlled Substances (EPCS)
- **Regulation:** 21 CFR Part 1311
- **Jurisdiction:** United States
- **Governing Body:** Drug Enforcement Administration (DEA)
- **Status:** Mandatory (if prescribing controlled substances)
- **Effective Date:** June 1, 2010

**API Requirements:**
- Two-factor authentication (2FA) required:
  - Username/password + hardware token
  - Username/password + biometric
  - Hardware token + biometric
- Digital certificates from DEA-approved Certificate Authorities
- Public Key Infrastructure (PKI) for digital signing
- Audit trails: Minimum 2-year retention, DEA inspection-ready
- Immutable records (cryptographic integrity)
- Pharmacy verification of prescriber credentials

**API Integration Points:**
- Prescriber authentication at API call
- Prescription signing before transmission
- Recipient verification (pharmacy validation)
- Revocation support (for cancelled prescriptions)
- Tamper detection mechanisms

---

### 1.7 CMS Meaningful Use / Promoting Interoperability Program
- **Status:** Mandatory
- **Program Name Change:** "Meaningful Use" (2011–2019) → "Promoting Interoperability" (2019–present)
- **Governing Body:** Centers for Medicare & Medicaid Services (CMS)

**Current Requirements (2024–2025):**
- Patient Access API (FHIR-based)
- Prior Authorization API
- Claims/Clinical data export via APIs
- Provider-to-Provider Care Coordination

**Penalties:** Payment adjustments (1–3% Medicare payment reductions for non-compliance)

---

### 1.8 State-Level Laws

#### California: CCPA/CPRA (California Consumer Privacy Act / California Privacy Rights Act)
- **Scope:** Applies to for-profit entities collecting CA residents' personal information
- **Healthcare Exemption:** HIPAA-covered entities exempt for PHI under HIPAA
- **Coverage:** Non-PHI healthcare data (employee info, website analytics, etc.)
- **Key Rights:**
  - Right to access, delete, correct, opt-out, and data portability
  - Right to know what data is collected
  - Sale prohibition default

**API Requirements:**
- Opt-out mechanisms (do-not-sell signals)
- Data deletion API support
- Data export in portable format

#### New York: SHIELD Act (Stop Hacks and Improve Electronic Data Security)
- **Scope:** All entities handling NY resident data
- **Key Requirements:**
  - Encryption of personal information at rest and in transit
  - Multifactor authentication
  - Cybersecurity monitoring
  - Business associate notification within reasonable timeframe (no specific deadline)

#### California: CMIA (California Medical Information Act)
- **Scope:** Psychotherapy notes, HIV testing, STI records
- **Key Requirement:** Patient authorization required (more stringent than HIPAA)

---

## 2. EUROPEAN UNION / EEA

### 2.1 GDPR (General Data Protection Regulation)
- **Full Name:** Regulation (EU) 2016/679
- **Jurisdiction:** EU/EEA; applies globally to organizations processing EU residents' data
- **Governing Body:** EU Data Protection Board; National Data Protection Authorities
- **Status:** Mandatory
- **Effective Date:** May 25, 2018

**Healthcare Specifics:**
- Article 9: Processing of special categories (health data)
- Requires lawful basis + separate consent (in most cases)
- GDPR + ePrivacy Directive + national healthcare laws apply

**Key API Design Requirements:**
- Data minimization: APIs only return data necessary for purpose
- Purpose limitation: Document each API purpose; prevent repurposing
- Consent management:
  - Granular, withdrawable consent per use case
  - Consent API for tracking/revoking permissions
  - Record consent with timestamp/signature
- Right to be forgotten: Delete API capability
- Right to data portability: Export in machine-readable format (JSON preferred)
- Privacy by design: Encryption, access controls, audit logs built-in
- Data Protection Impact Assessment (DPIA) required for high-risk processing
- Data Processing Agreement (DPA) with all data processors

**Audit & Logging:**
- Log retention: Minimum 3 years (often longer per national law)
- User activity tracking (who, what, when, where, why)
- Automatic logging of API access

**Breach Notification:**
- Notification within 72 hours of discovery (not breach occurrence)
- Notify supervisory authority + affected individuals
- No exemption for encrypted data if key also compromised

**Cross-Border Transfer Restrictions:**
- Standard Contractual Clauses (SCCs) required for non-EU transfers
- Adequacy decisions limited to: UK, Canada, Japan, South Korea, Israel, Argentina, Uruguay, New Zealand, etc.
- Data residency in EU often required (or equivalent protection)

**Penalties:**
- Up to €20 million or 4% of global annual revenue (whichever is higher)
- Tiered enforcement: smaller fines (€10 million / 2% revenue) for less severe violations

---

### 2.2 EHDS (European Health Data Space Regulation)
- **Full Name:** Regulation (EU) 2025/327 of the European Parliament and of the Council
- **Jurisdiction:** EU/EEA
- **Governing Body:** European Commission; National Health Data Access Bodies (member states)
- **Status:** Mandatory
- **Entry into Force:** March 26, 2025
- **Implementation Timeline:**
  - Member states must establish digital health authorities within 2 years (by March 26, 2027)
  - First cross-border functionalities available March 26, 2029

**Two Purposes:**
1. **Primary use:** Patients' control over personal electronic health data (healthcare)
2. **Secondary use:** Researchers, companies, policymakers to access health data (research/innovation)

**Key API Requirements:**
- Patient Health Records Exchange (PHR) APIs for primary use
- Health Data Access Bodies (HDABs) manage secondary use requests
- Data holders must provide APIs for data access/portability
- Explicit patient consent for secondary use (strong default)
- No personal data downloads allowed (processing in secure environments only)
- Standardized formats and interoperability (FHIR expected)

**Data Residency:**
- Data must be processed in EU (no downloads outside)
- Cloud infrastructure must comply with EU data residency

**Penalties:**
- Enforced via GDPR penalties (same framework)
- Additional administrative fines possible

---

### 2.3 ePrivacy Regulation (Draft)
- **Status:** Under legislative negotiation (not yet finalized)
- **Expected Impact:** Enhanced requirements for electronic communications (SMS, email, telehealth)
- **Key Point:** Will require consent for direct marketing, tracking, etc.

---

### 2.4 Medical Device Regulation (MDR) / In Vitro Diagnostic Regulation (IVDR)
- **Governing Body:** European Commission; Notified Bodies (CE marking)
- **Status:** Mandatory
- **MDR Effective:** May 26, 2021; Full compliance deadline: May 26, 2025
- **IVDR Effective:** May 26, 2022; Full compliance deadline: May 26, 2027

**API Requirements:**
- Software Bill of Materials (SBOM)
- Cybersecurity risk management
- Post-market surveillance data via APIs
- Traceability (unique device identification)
- For SaMD: Design & development controls, validation/verification

**CE Marking Path:**
- Class I: Self-certification
- Class II/III: Notified Body review

---

### 2.5 EU Clinical Trials Regulation
- **Status:** Mandatory (for clinical studies)
- **Key Requirement:** Advanced electronic systems for data reporting and safety monitoring
- **API Impact:** Clinical trial management systems must be interoperable

---

## 3. UNITED KINGDOM (Post-Brexit)

### 3.1 UK GDPR
- **Full Name:** UK General Data Protection Regulation
- **Jurisdiction:** United Kingdom
- **Governing Body:** Information Commissioner's Office (ICO)
- **Status:** Mandatory
- **Effective Date:** January 1, 2020 (post-Brexit; mirrors EU GDPR with modifications)

**Key Difference from EU GDPR:**
- UK government can override some requirements
- ICO enforcement (no European Data Protection Board involvement)
- Adequate level determination: EU GDPR countries recognized as adequate

**API Requirements:** Same as EU GDPR

---

### 3.2 UK Data Protection Act 2018
- **Scope:** Complements UK GDPR
- **Key Provisions:** Exemptions for national security, law enforcement, royal functions

---

### 3.3 NHS Digital Standards
- **DCB0129:** Clinical Risk Management: Application in Health IT Systems Manufacturing
  - Mandatory for all digital health manufacturers
  - Manufacturers must assure clinical safety during design/development

- **DCB0160:** Clinical Risk Management: Application for the Use of Digital Technology
  - Mandatory for NHS organizations implementing digital health tech
  - Organizations must assess risks in their environment before deployment
  - Both standards are under review (updated guidance expected 2025–2026)

**API Design Requirements:**
- Clinical safety case documentation
- Hazard analysis and risk assessment for API integration
- Incident reporting for clinical safety issues
- Version control and change management
- Contingency/fallback mechanisms if API fails

---

### 3.4 Digital Technology Assessment Criteria (DTAC)
- **Status:** Framework (non-binding guidance, becoming more mandatory)
- **Coverage:** Digital health technologies
- **Key Areas:** Clinical safety, data security, user-centeredness, accessibility

---

## 4. CANADA

### 4.1 PIPEDA (Personal Information Protection and Electronic Documents Act)
- **Full Name:** PIPEDA (Federal)
- **Jurisdiction:** Canada (Federal, private sector)
- **Governing Body:** Office of the Privacy Commissioner of Canada
- **Status:** Mandatory
- **Coverage:** Private-sector organizations; provincial health-specific laws apply to health custodians

**Key Principles:**
- Accountability, Transparency, Consent, Accuracy, Security, Openness, Individual Access

**API Requirements:**
- Consent management (opt-in for healthcare)
- Transparency in data collection/use
- Minimal data collection (API should limit scope)
- Secure transmission (encryption mandatory)
- Breach notification (no specific deadline in PIPEDA; varies by province)

---

### 4.2 Provincial Health-Specific Laws

#### Ontario: PHIPA (Personal Health Information Protection Act)
- **Jurisdiction:** Ontario
- **Governing Body:** Office of the Information and Privacy Commissioner (OIPC)
- **Status:** Mandatory for health information custodians (HICs)
- **Coverage:** Doctors, hospitals, pharmacies, nursing homes, clinics

**Key Requirements:**
- Consent before collection/use/disclosure of personal health information (PHI)
- Patients can request access/correction
- Breach notification: "Without unreasonable delay" (no specific timeline)
- Security safeguards (physical, administrative, technical)

**Penalties:** $2,000–$10,000 for individuals; $50,000–$250,000 for organizations

#### Alberta: Health Information Act (HIA)
- **Coverage:** Health information custodians and affiliates
- **Key Requirements:** Similar to PHIPA
- **Penalties:** $2,000–$10,000 (individuals); $200,000–$500,000 (organizations)

#### British Columbia: FIPPA (Freedom of Information and Protection of Privacy Act) & Health Information Act
- **Status:** Mandatory

#### Quebec: Law 25 (LPRPDE - Bill 64)
- **Status:** New privacy law (enforced 2023–2024)
- **Key Change:** Stricter consent requirements, higher penalties

---

## 5. AUSTRALIA

### 5.1 Privacy Act 1988 & Australian Privacy Principles (APPs)
- **Jurisdiction:** Australia
- **Governing Body:** Office of the Australian Information Commissioner (OAIC)
- **Status:** Mandatory (for entities with >AUD $3M turnover; all government agencies)
- **APPs:** 13 principles covering data lifecycle

**Healthcare Specifics:**
- APP 3: Collection of solicited personal information (consent-based)
- APP 6: Use/disclosure (purpose limitation)
- APP 11: Security of personal information
- APP 12: Access and correction

**API Requirements:**
- Encryption at rest and in transit
- Access controls and RBAC
- Audit logging (retention period: Generally not mandated, but best practice is 6+ years)
- Breach notification: "Without unreasonable delay" (no specific timeline)

---

### 5.2 My Health Records Act 2012
- **Scope:** National electronic health record system (My Health Records)
- **Key Points:**
  - Information in My Health Records is protected under My Health Records Act
  - Once downloaded to local systems, Privacy Act + state/territory health laws apply
  - Patients can exclude records (opt-out of My Health Records)

**API Requirements:**
- Must support patient access and portability (download capability)
- Secure communication channels
- Audit trails of access

---

### 5.3 Therapeutic Goods Act (Medical Devices)
- **Scope:** Software medical devices
- **Key Requirement:** TGA registration/approval required
- **API Impact:** Quality management systems, risk management, design controls

---

### 5.4 NSQHS Standards (National Safety and Quality Health Service Standards)
- **Status:** Mandatory for accredited hospitals and aged care
- **Key Areas:** Safety, quality, governance, incident management
- **API Impact:** Safety reporting integration required

---

## 6. ASIA-PACIFIC

### 6.1 Singapore

#### PDPA (Personal Data Protection Act)
- **Jurisdiction:** Singapore
- **Governing Body:** Personal Data Protection Commission (PDPC)
- **Status:** Mandatory
- **Effective Date:** January 2, 2014

**Healthcare Specifics:**
- Healthcare providers subject to PDPA + sector-specific requirements
- Healthcare Services (General) Regulations 2021

**Key API Requirements:**
- Consent for data collection
- Notification of purposes
- Accuracy and protection
- No sensitive data transfer without explicit consent

**Penalties:** Up to SGD $1 million

#### HCSA (Healthcare Services Act)
- **Scope:** Licensable healthcare services
- **Key Requirements:**
  - Patient confidentiality mandatory
  - Health records retained minimum 6 years
  - Telemedicine services licensable

---

### 6.2 Japan

#### APPI (Act on Protection of Personal Information)
- **Jurisdiction:** Japan
- **Governing Body:** Personal Information Protection Commission (PPC)
- **Status:** Mandatory
- **2022 Amendments Effective:** April 1, 2022

**Key Healthcare Changes:**
- "Special care-required" personal information (health data) = higher protection
- Mandatory breach notification (previously "best efforts")
- Cross-border transfer restrictions:
  - Only to countries with "adequate" protection level
  - Contracts with overseas recipients required
  - Prior consent from data subjects

**Penalties:**
- Organizations: Up to ¥100 million (~$815,000 USD)
- Individuals: Up to 1 year imprisonment or ¥1 million fine

**API Requirements:**
- Consent per purpose (cannot repurpose data)
- Anonymization support (API to support de-identification)
- Cross-border transfer logging

---

### 6.3 South Korea

#### PIPA (Personal Information Protection Act)
- **Jurisdiction:** South Korea
- **Governing Body:** Ministry of Interior and Safety
- **Status:** Mandatory

**Healthcare Requirements:**
- Explicit consent for sensitive data (health = sensitive)
- Chief Privacy Officer (CPO) mandated for large organizations
- Data Protection Impact Assessment (DPIA)

**Penalties:**
- Up to KRW 1 billion (~$750,000 USD) + 5 years imprisonment

**Cross-Border Transfers:**
- Only to countries with adequate protection
- Contracts required
- Explicit consent for overseas transfers

---

### 6.4 India

#### DPDP Act 2023 (Digital Personal Data Protection Act)
- **Jurisdiction:** India
- **Governing Body:** Data Protection Board of India
- **Status:** Mandatory
- **Effective Date:** August 4, 2023

**Healthcare Applicability:**
- All healthcare providers (hospitals, diagnostic labs, telemedicine platforms)
- Covers patient data collection, processing, storage, distribution, disposal

**Key Requirements:**
- Explicit consent per purpose
- Security safeguards (encryption, access controls, audit trails)
- Breach notification (within timeline to be specified in rules)
- Right to access, correct, erase data
- Data retention: Only as long as necessary

**Exemptions:** Healthcare data for specific purposes (child monitoring, behavioral tracking) exempted under DPDP Rules 2025

---

### 6.5 Philippines

#### Data Privacy Act 2012 (RA 10173)
- **Jurisdiction:** Philippines
- **Governing Body:** National Privacy Commission (NPC)
- **Status:** Mandatory
- **Effective Date:** September 8, 2012

**Healthcare Specifics:**
- Health records = sensitive personal information
- Requires explicit consent for processing
- Higher security standards for sensitive data

**Key Requirements:**
- Consent must be clear, specific, and freely given
- Healthcare providers must register with NPC if handling sensitive data for 1,000+ individuals
- Security safeguards mandatory

**Penalties:** Up to PHP 5,000,000 + 6 years imprisonment

**Patient Rights:**
- Right to access, correct, erase, portability, object, restrict processing

---

### 6.6 Thailand

#### PDPA (Personal Data Protection Act)
- **Jurisdiction:** Thailand
- **Governing Body:** Personal Data Protection Committee
- **Status:** Mandatory
- **Effective Date:** Full force June 1, 2022

**Key Features:**
- GDPR-influenced but with local differences
- Consent required for processing
- Cross-border transfer restrictions
- Mandatory breach notification

---

### 6.7 Malaysia

#### PDPA 2010 (Personal Data Protection Act)
- **Jurisdiction:** Malaysia
- **Governing Body:** Ministry of Communications and Digital (formerly Malaysian Communications and Multimedia Commission)
- **Status:** Mandatory
- **Recent Amendment:** Personal Data Protection (Amendment) Act (pending implementation)

**Key Requirements:**
- Processing principles (notice, choice, security, access, accuracy)
- Consent management
- Mandatory notification of security breaches

---

### 6.8 Indonesia

#### Personal Data Protection Law 2022
- **Jurisdiction:** Indonesia
- **Governing Body:** Personal Data Protection Commission (newly established)
- **Status:** Mandatory
- **Effective Date:** October 17, 2023

**Penalties:**
- Criminal: Up to 6 years imprisonment; IDR 6 billion (~$400,000 USD) fine
- Corporate: Tenfold higher fines; dissolution possible

**Key Requirements:**
- Explicit consent for sensitive data (health = sensitive)
- Security measures mandatory
- Breach notification required
- Data subject rights (access, correction, erasure)

---

## 7. MIDDLE EAST & AFRICA

### 7.1 UAE

#### Federal Decree-Law No. 45/2021 (Personal Data Protection Law)
- **Jurisdiction:** United Arab Emirates
- **Governing Body:** General Authority for Regulation of Communications (GARC)
- **Status:** Mandatory
- **Effective Date:** January 2, 2022

**Key Features:**
- Aligns with GDPR principles
- Applies globally if processing data of UAE residents
- Data cannot leave country without consent/safeguards

**Healthcare Specifics:**
- ADHICS (Abu Dhabi Healthcare Information and Cyber Security): 692 controls across 11 domains for healthcare organizations
- Stringent patient data protection

---

### 7.2 Saudi Arabia

#### Personal Data Protection Law (PDPL)
- **Jurisdiction:** Saudi Arabia
- **Governing Body:** Saudi Data and Artificial Intelligence Authority (SDAIA)
- **Status:** Mandatory
- **Effective Date:** September 23, 2021

**Key Requirements:**
- Strict data residency: Data cannot leave kingdom without regulatory clearance
- Explicit consent required
- Security safeguards
- Breach notification

**Penalties:** Up to SAR 10 million (~$2.7M USD) + 5 years imprisonment

---

### 7.3 South Africa

#### POPIA (Protection of Personal Information Act)
- **Jurisdiction:** South Africa
- **Governing Body:** Information Regulator
- **Status:** Mandatory
- **Effective Date:** July 1, 2021 (compliance deadline: June 30, 2022)

**Key Principles:**
- Accountability, Processing Limitation, Purpose Limitation, Further Processing, Information Quality, Openness, Security, Data Subject Participation

**Healthcare Requirements:**
- Consent for sensitive data processing
- Security measures mandatory
- Breach notification (timeline varies)

**Penalties:** Up to ZAR 10 million (~$540,000 USD) + 10 years imprisonment

**Enforcement Record:** Most active on African continent

---

### 7.4 Kenya

#### Data Protection Act 2019
- **Jurisdiction:** Kenya
- **Governing Body:** Office of the Data Protection Commissioner (ODPC)
- **Status:** Mandatory
- **Effective Date:** November 26, 2019

**Key Requirements:**
- Consent for data processing
- Purpose limitation
- Data subject rights (access, correction, erasure)
- Security safeguards

---

### 7.5 Nigeria

#### Nigeria Data Protection Act (NDPA) 2023
- **Jurisdiction:** Nigeria
- **Governing Body:** Nigeria Data Protection Commission (NDPC) (established June 2023)
- **Status:** Mandatory (replaced NDPR 2019 regulation)
- **Effective Date:** June 15, 2023

**Healthcare Specifics:**
- Health data classified as sensitive personal data
- Explicit consent required
- Healthcare establishments must maintain health records and confidentiality

**Key Requirements:**
- Consent management
- Security safeguards
- Breach notification to NDPC and affected individuals
- Data subject rights

**Penalties:** Substantial fines and potential imprisonment for officers

---

## 8. LATIN AMERICA

### 8.1 Brazil

#### LGPD (Lei Geral de Proteção de Dados)
- **Jurisdiction:** Brazil
- **Governing Body:** National Data Protection Authority (ANPD - Autoridade Nacional de Proteção de Dados)
- **Status:** Mandatory
- **Effective Date:** August 14, 2020; Enforcement began August 2, 2021

**Healthcare Enforcement (2023–2025):**
- Healthcare sector fined R$12 million across 15 institutions
- 40% of audited hospitals lacked breach response plans or encryption

**Key Requirements:**
- Explicit consent for processing
- Consent management and withdrawal capability
- Data Security Officer or Data Protection Officer appointment
- Breach notification per Resolution CD/ANPD No. 15 (April 2024)

**Penalties:**
- Up to 4% of annual revenue (or up to BRL 50 million per violation)
- Remediation orders
- Service suspension possible

**ANPD Enforcement:** BRL 98 million in fines (2023–2025); "very active" enforcement phase

---

### 8.2 Mexico

#### LFPDPPP (Federal Law on Protection of Personal Data Held by Private Parties)
- **Jurisdiction:** Mexico
- **Governing Body:** Federal Institute for Access to Information and Data Protection (IFAI, now Instituto Nacional de Transparencia, Acceso a la Información y Protección de Datos Personales - INAI)
- **Status:** Mandatory
- **Updated:** 2025 version (stronger than 2010 original)

**Healthcare Specifics:**
- Health information = special category (requires express written consent)
- Biometric data, racial origin, religious beliefs also protected

**Key Requirements:**
- Explicit consent for sensitive data
- Transparency in data use
- Security safeguards
- Data subject rights

---

### 8.3 Argentina

#### PDPA (Personal Data Protection Act)
- **Jurisdiction:** Argentina
- **Governing Body:** Personal Data Protection Authority (Autoridad de Protección de Datos Personales)
- **Status:** Mandatory

**Key Requirements:**
- Database registration
- Written consent (especially for sensitive data)
- International data transfer restrictions
- Data subject rights

**Penalties:** Up to 5 million Argentine pesos

---

### 8.4 Colombia

#### Law 1581 (Ley de Habeas Data)
- **Jurisdiction:** Colombia
- **Governing Body:** Superintendent of Industry and Commerce (SIC)
- **Status:** Mandatory

**Key Requirements:**
- Express consent for data collection
- Sensitive personal information (health = sensitive) has enhanced protection
- Data subject access, correction, deletion rights
- Security safeguards

---

## 9. INTERNATIONAL & CROSS-BORDER FRAMEWORKS

### 9.1 APEC CBPR (Asia-Pacific Economic Cooperation Cross-Border Privacy Rules)
- **Full Name:** APEC Cross-Border Privacy Rules System
- **Jurisdiction:** APEC member economies (Australia, Canada, Japan, Mexico, Philippines, South Korea, Singapore, Chinese Taipei, USA)
- **Status:** Voluntary but enforceable certification
- **Governing Body:** APEC Accountability Agents

**Framework Principles:**
- Accountability, Prevent Harm, Notice, Choice, Collection Limitation, Use of Personal Information, Integrity of Personal Information, Security Safeguards, Access and Correction

**Key API Requirements:**
- Accountability in data handling
- Harm prevention measures
- Transparency in data use
- Granular choice/consent mechanisms
- Integrity and security controls
- User access/correction capabilities

**Global CBPR Forum (2022–Present):**
- Expands APEC CBPR to non-APEC jurisdictions
- Member economies: Original APEC members + commitment to expand

---

### 9.2 Convention 108+ (Council of Europe)
- **Full Name:** Council of Europe Convention for the Protection of Individuals with Regard to Automatic Processing of Personal Data (1981, modernized 2018)
- **Jurisdiction:** 57 Council of Europe member states + signatories globally (expanding)
- **Status:** Binding international treaty
- **Governing Body:** Council of Europe; Signatory states' authorities

**Key Principles:**
- Data quality and lawfulness
- Purpose limitation
- Security safeguards
- Individual participation rights
- Transborder data flow controls

**Healthcare-Specific Impact:**
- Cross-border transfers must have safeguards
- Prompt breach notification required
- National supervisory authorities oversight
- Data protection authorities enforcement

**Expansion:** Global signatories including Canada, Japan, Morocco, Tunisia, Mauritius seeking accession

---

### 9.3 WHO Digital Health Guidelines
- **Organization:** World Health Organization (WHO)
- **Status:** Guidance (non-binding but influential)
- **Key Initiative:** WHO Global Strategy on Digital Health (2020–2025)

**Interoperability Standards Endorsed:**
- HL7 FHIR (Fast Healthcare Interoperability Resources)
- SMART on FHIR (app authorization)
- Open standards for data exchange

**SMART Guidelines Initiative:**
- Standards-based, Machine-readable, Adaptive, Requirements-based, Testable
- Digital health components (standards, code libraries, algorithms, specifications)
- Global applicability with local adaptation

**API Design Guidance:**
- Use of open standards (FHIR, HL7)
- Structured data for interoperability
- Support for telemedicine and mobile health
- Privacy and security by default

---

### 9.4 ISO Standards

#### ISO/IEC 27001:2022 (Information Security Management Systems)
- **Scope:** General information security standard
- **Status:** Widely adopted for healthcare
- **Key Requirements:**
  - Security policies and controls
  - Risk assessment and management
  - Incident response
  - Business continuity
  - Audit and monitoring

#### ISO/IEC 27799:2016 (Health Informatics — Information Security Management in Health Using ISO/IEC 27002)
- **Scope:** Healthcare-specific extension of ISO 27001
- **Status:** Certification available; often required by healthcare organizations
- **Key Requirements:**
  - Healthcare data classification
  - Consent and patient privacy
  - De-identification and anonymization
  - PHI lifecycle management
  - Healthcare-specific risk assessment
  - Third-party vendor management

**Certification Prerequisites:**
- Active ISO/IEC 27001 certification required
- 3-year certification cycle with annual surveillance audits

#### ISO 22600 (Privilege Management and Access Control)
- **Healthcare Application:** Access control for health data APIs

#### ISO 13131 (Telehealth / Telemedicine)
- **Scope:** Telehealth system security and interoperability

---

## 10. HEALTHCARE-SPECIFIC CERTIFICATIONS & FRAMEWORKS

### 10.1 HITRUST CSF (Health Information Trust Alliance Common Security Framework)
- **Organization:** Health Information Trust Alliance (HITRUST)
- **Status:** Widely adopted; increasingly required by healthcare organizations
- **Scope:** Certifiable security framework consolidating 60+ regulations/standards

**Regulations Harmonized:**
- HIPAA, HITECH, NIST CSF, ISO 27001/27002/27799, PCI DSS, GDPR, SOC 2, FedRAMP, and more

**Certification Levels:**
- Self-assessment (lowest assurance)
- CSF Validated (intermediate assurance; independent validation)
- CSF Certified (highest assurance; third-party assessment; recognized by healthcare industry)

**Certification Duration:** 2 years with interim review in year 2

**2025 Benchmark:** 99.62% of HITRUST-certified organizations reported zero breaches

**API Requirements:**
- Access controls (user authentication, role-based access, MFA)
- Encryption (data at rest, in transit)
- Audit logging (comprehensive, tamper-proof, searchable)
- Incident response capability
- Vulnerability management
- Security monitoring and alerting
- Encryption key management
- Business continuity/disaster recovery

---

### 10.2 SOC 2 Type II (Service Organization Control)
- **Organization:** American Institute of Certified Public Accountants (AICPA)
- **Status:** Widely required by healthcare cloud/SaaS providers
- **Scope:** External audit of security controls over 6–12 months

**Trust Service Criteria:**
1. **CC (Common Criteria):** Security controls
2. **A (Availability):** System availability
3. **C (Confidentiality):** Confidential information protection
4. **PI (Processing Integrity):** Complete, accurate data processing
5. **PR (Privacy):** Personal information governed per privacy policies

**Healthcare Focus:** CC controls primarily; PI and PR increasingly important

**Controls Audited:**
- Logical access (MFA, RBAC, least privilege)
- Physical safeguards
- System monitoring (SIEM)
- Vulnerability management
- Incident response
- Change management
- Encryption standards
- Data retention/destruction

**Relationship to HIPAA:** SOC 2 provides baseline for HIPAA compliance but doesn't address all HIPAA requirements

---

### 10.3 ONC Health IT Certification Program (US)
- **Organization:** Office of the National Coordinator (ONC)
- **Status:** Mandatory for EHR systems and digital health technologies used by covered entities
- **Certification Basis:** 21st Century Cures Act

**Current Requirements (2025):**
- FHIR Release 4.0.1 compliance
- Patient Access API (real-time or near-real-time)
- Developer documentation and sandbox
- No information blocking
- SMART on FHIR support
- Encryption and audit logging

**Certification Validity:** 3 years with ongoing compliance monitoring

---

### 10.4 CE Marking (EU Medical Device)
- **Governing Body:** Notified Bodies (third-party assessors); EU member states
- **Status:** Mandatory for medical devices/SaMD in EU
- **Regulation:** Medical Device Regulation (MDR, effective 2025) and In Vitro Diagnostic Regulation (IVDR, effective 2027)

**Classification:** I, IIa, IIb, III (by risk level)

**API Requirements:**
- Design and development lifecycle controls
- Risk management (hazard analysis)
- Cybersecurity threat modeling
- Software Bill of Materials (SBOM)
- Post-market surveillance data collection via APIs
- Traceability (unique device identifiers)
- Version control and update mechanisms

---

## 11. CROSS-CUTTING API DESIGN REQUIREMENTS

### 11.1 Data Model Requirements

**Core Elements:**
```json
{
  "healthcare_record": {
    "patient_id": "uuid",
    "data_classified_sensitivity": "public|standard|confidential|highly_confidential",
    "created_date": "ISO8601_timestamp",
    "last_modified": "ISO8601_timestamp",
    "consent_metadata": {
      "consent_type": "treatment|research|disclosure|secondary_use",
      "consent_date": "ISO8601_timestamp",
      "consent_withdrawn_date": "ISO8601_timestamp_or_null",
      "scope": ["data_category_1", "data_category_2"],
      "purpose": "treatment_of_condition_X",
      "recipient": "provider_or_research_entity",
      "expires": "ISO8601_timestamp_or_null"
    },
    "audit_trail": [
      {
        "timestamp": "ISO8601_timestamp",
        "actor": "user_id",
        "action": "read|write|delete|export",
        "resource": "path_to_data",
        "purpose": "treatment|research|audit",
        "ip_address": "xxx",
        "user_agent": "xxx",
        "result": "success|failure",
        "failure_reason": "unauthorized|invalid_consent|etc"
      }
    ],
    "data_residency": "country_code",
    "encryption_status": "encrypted_at_rest|encrypted_in_transit",
    "classification": "PHI|PII|sensitive|non_sensitive"
  }
}
```

---

### 11.2 Consent Management API

**Required Operations:**
- `POST /consents` - Create consent record
- `GET /consents/{consent_id}` - Retrieve consent details
- `PATCH /consents/{consent_id}` - Update consent scope/expiry
- `DELETE /consents/{consent_id}` - Revoke consent
- `GET /consents/active` - List active patient consents
- `POST /consents/{consent_id}/verify` - Verify consent validity before data access

**Consent Attributes:**
- Granular scope (per data category, recipient, purpose, time period)
- Explicit withdrawal capability
- Audit trail of consent changes
- Expiration management
- Re-consent workflow support

---

### 11.3 Access Control & Authorization

**Standards:**
- OAuth 2.0 with OpenID Connect
- SMART on FHIR (healthcare-specific OAuth flows)
- JWT tokens with claims for purpose, scope, recipient
- Role-Based Access Control (RBAC)
- Attribute-Based Access Control (ABAC) for contextual decisions

**API Enforcement:**
- Enforce scope per API endpoint
- Validate token signature and expiration
- Log all authorization decisions (granted + denied)
- Short-lived tokens (15–60 minutes)
- Refresh token rotation

---

### 11.4 Audit Logging

**Mandatory Log Fields:**
- Timestamp (UTC, millisecond precision)
- Actor (user ID, system ID, application ID)
- Action (read, write, delete, export, login, logout)
- Resource (full path to data accessed)
- Purpose of use (treatment, research, audit, operations)
- Result (success, failure)
- Failure reason
- IP address / User agent
- Data sensitivity level
- Consent/authorization reference

**Log Retention:**
- Minimum 6 years (HIPAA requirement in US)
- Varies by jurisdiction (3–7 years typical)
- Immutable storage (append-only, encrypted)
- Searchable indices for audit queries

**Breach Response Logging:**
- Incident detection timestamp
- Scope of breach (# records, data types)
- Notification sent timestamp
- Recipients notified
- Remediation actions taken

---

### 11.5 Encryption

**At Rest:**
- AES-256 (minimum)
- Key management: Separate from encrypted data
- Hardware security modules (HSM) for key storage recommended
- Key rotation: Annual minimum

**In Transit:**
- TLS 1.2+ (TLS 1.3 preferred)
- HTTPS only
- Certificate pinning recommended for APIs
- Encryption of API request/response body

---

### 11.6 Data Residency Requirements

**By Jurisdiction:**

| Jurisdiction | Requirement | API Impact |
|---|---|---|
| EU/GDPR | EU data center (Standard Contractual Clauses for non-EU) | Store/process flag in metadata |
| UK | UK data center (mutual recognition with EU) | Similar to EU |
| Brazil | Brazil data center (for sensitive) | Residency flag in record |
| Saudi Arabia | Saudi Arabia (strict) | Residency enforced before API returns data |
| China | Not directly applicable to healthcare APIs; may apply if serving China |  |
| Indonesia | Indonesia (preferred) | Residency tracking |
| Japan | Japan (for sensitive) | Residency validation per APPI |
| UAE | UAE data center | Mandatory |
| Singapore | Singapore (flexible; adequate protection overseas acceptable) | Residency optional |
| Australia | Australia (flexible for overseas with safeguards) | Residency tracking |
| USA | No federal mandate; HIPAA requires "reasonable safeguards" (cloud OK) | Optional residency tracking |

**API Requirement:**
- `POST /records` should validate patient residency and enforce data residency before storage
- `GET /records` should confirm data residency matches authorized jurisdictions

---

### 11.7 Right to Erasure / Right to Deletion

**Implementation:**
- `DELETE /records/{record_id}` - Soft delete (pseudonymization, retention for audit)
- Permanent deletion after retention period
- Exceptions: Legal holds, ongoing treatment, audit trails
- Compliance by jurisdiction varies:
  - GDPR: Required with limited exceptions
  - HIPAA: Not mandated; data retention often required
  - CCPA/CPRA: Required with exceptions
  - APPI: Required (special care data)
  - LGPD: Required

**API Design:**
- Support both soft and hard deletes
- Audit trail retained even after deletion
- Cross-system cleanup (notify linked systems to delete references)

---

### 11.8 Data Portability

**Implementation:**
- `GET /records/export` - Download all patient records in standard format
- Format: JSON, XML, or proprietary (with conversion option)
- Compression: Gzip recommended
- Encryption: Optional (highly recommended)

**Jurisdictions Requiring It:**
- GDPR (mandatory)
- CCPA/CPRA (mandatory)
- LGPD (strong recommendation)
- India DPDP (mandatory)
- Japan APPI (mandatory)
- UK GDPR (mandatory)

---

### 11.9 Breach Notification Timelines

**By Jurisdiction:**

| Jurisdiction | Timeline | Notification To |
|---|---|---|
| HIPAA (US) | 30 days (updated 2025; was 60 days) | Patients, HHS, media (if 500+) |
| GDPR (EU) | 72 hours of discovery | Supervisory authority; individuals if high risk |
| UK GDPR | 72 hours of discovery | ICO; individuals if high risk |
| APPI (Japan) | Mandatory (timeline in rules) | PPC, individuals |
| LGPD (Brazil) | Per ANPD Resolution CD/ANPD No. 15 | ANPD, individuals |
| POPIA (South Africa) | Unreasonable delay | Regulator, individuals |
| CCPA/CPRA (California) | Without unreasonable delay | Consumers; can notify all if more efficient |
| PHIPA (Ontario) | Without unreasonable delay | Privacy commissioner; individuals |
| PIPEDA (Canada) | As soon as feasible | Privacy Commissioner; individuals |

**API Support:**
- Incident reporting endpoint: `POST /incidents`
- Incident tracking: `GET /incidents/{incident_id}`
- Notification status API: `GET /incidents/{incident_id}/notifications`

---

### 11.10 Data Minimization in APIs

**Principle:** APIs must return only data necessary for stated purpose

**Implementation:**
- Define purpose per endpoint
- FHIR resource filtering (return only requested fields)
- Projection queries: `GET /records?fields=name,dob,bloodtype`
- Scope-based filtering: OAuth scope determines accessible fields
- De-identification by default for non-direct-care uses

---

### 11.11 Third-Party / API Vendor Management

**Requirements:**
- Business Associate Agreements (BAAs) / Data Processing Agreements (DPAs)
- Vendor security assessments (SOC 2, ISO 27001, HITRUST)
- Incident reporting obligations
- Data location/residency contractual guarantees
- Audit rights
- Sub-processor disclosures
- Termination data handling

**API Implementation:**
- Vendor metadata in system: `GET /vendors` - List integrated systems with security status
- Approval workflows: `POST /vendor-access-requests` - Track vendor API access grants

---

## 12. SPECIFIC API SCENARIOS & COMPLIANCE

### 12.1 Patient Access API (21st Century Cures Act / CMS Interoperability)

**Standards:** FHIR R4.0.1 + HL7 FHIR US Core IG STU 3.1.1

**Required Endpoints:**
- `GET /Patient/{id}` - Patient demographics
- `GET /Patient/{id}/AllergyIntolerance` - Allergies
- `GET /Patient/{id}/Condition` - Active conditions
- `GET /Patient/{id}/Medication` - Medications
- `GET /Patient/{id}/MedicationRequest` - Prescriptions
- `GET /Patient/{id}/Observation` - Lab results
- `GET /Patient/{id}/DiagnosticReport` - Reports
- `GET /Patient/{id}/Procedure` - Procedures
- `GET /Patient/{id}/Immunization` - Vaccines

**Authorization:** SMART on FHIR with patient/user scope

**Real-Time Requirement:** Data must be available within 1 business day (2025 rules); trending toward real-time

**Penalties for Non-Compliance:**
- CMS: Up to $1 million per violation
- State attorneys general enforcement

---

### 12.2 Substance Use Disorder (Part 2) API

**Special Handling:**
- Separate consent tracking (cannot use standard HIPAA consent)
- Part 2 records must be tagged as such
- Audit trail must note Part 2 specific accesses
- Electronic disclosure workflows (new requirement post-2026)

**API Design:**
- Flag records with `dataClass: "substance_use"` or `confidentiality: "restricted"`
- Separate access control rules
- Cannot be combined with other PHI in aggregate exports without explicit consent

---

### 12.3 EPCS (Electronic Prescribing of Controlled Substances) API

**Authentication Required:**
- 2FA (two of three: username/password, hardware token, biometric)
- DEA-approved certificate
- PKI digital signature

**API Flow:**
1. Prescriber authenticates with 2FA
2. System validates DEA registration
3. Prescriber signs prescription cryptographically
4. Pharmacy receives and verifies signature
5. Audit trail immutable (2-year retention)

**No Exemptions:** Unlike regular prescriptions, EPCS cannot be transmitted without full authentication

---

### 12.4 Telehealth / Remote Monitoring APIs

**Jurisdiction-Specific Requirements:**
- **US (HIPAA):** Video/audio must be encrypted; state telehealth laws vary
- **UK (NHS/DCB0129):** Clinical safety case required; fail-safe mechanisms
- **Singapore (HCSA):** Telemedicine services licensable; medical practitioner-led
- **Canada (PHIPA):** Consent required; jurisdictions differ
- **EU (GDPR):** ePrivacy Directive applies; confidentiality essential

**API Design:**
- Secure video/audio channels (SRTP, DTLS)
- Real-time encryption
- Consent per telehealth session
- Session recording opt-in/opt-out
- Fallback mechanisms if connection drops

---

### 12.5 Secondary Use / Research Data Access APIs

**Compliance Model:**
- **GDPR/EHDS:** Explicit consent or legitimate interest (varies)
- **HIPAA:** De-identification (Safe Harbor or Expert Determination)
- **Australia:** De-identification standard (common law + Privacy Act)
- **Japan (APPI):** Original purpose cannot be used; new consent required
- **Brazil (LGPD):** Separate consent for secondary use

**API Design:**
- Separate endpoint for research access: `GET /records/research`
- Mandatory de-identification: `GET /records/{id}?anonymize=true`
- Audit trail flags research access distinctly
- Data use agreement reference in API response

---

### 12.6 Medical Device / SaMD API Integration

**FDA Requirements:**
- Software Bill of Materials (SBOM) available
- Design controls documented
- Risk management plan accessible
- Cybersecurity threat model documented
- Post-market surveillance data collection API

**API Design:**
- Version control: `GET /device/{id}/versions` - List all versions with change notes
- Incident reporting: `POST /device-incidents` - Report adverse events
- SBOM endpoint: `GET /device/{id}/sbom` - Component list

---

## 13. SUMMARY TABLE: FRAMEWORK COMPARISON

| Framework | Jurisdiction | Mandatory | Key API Requirements | Penalties | Key Difference |
|---|---|---|---|---|---|
| HIPAA | US | Yes | Audit logs, encryption, RBAC, consent | Up to $50K/violation | Privacy focus |
| GDPR | EU/EEA | Yes | Consent mgmt, right to deletion, DPA | Up to 4% revenue | Data subject rights |
| UK GDPR | UK | Yes | Same as GDPR | Similar | Data transfer: SCCs optional |
| EHDS | EU | Yes | PHR APIs, HDAB integration, de-id | GDPR penalties | Secondary use governance |
| POPIA | South Africa | Yes | RBAC, encryption, incident response | Up to ZAR 10M | Alignment with GDPR |
| LGPD | Brazil | Yes | Consent, DPO, breach notification | Up to 4% revenue | Consent withdrawal |
| APPI | Japan | Yes | Cross-border restrictions, consent per use | Up to ¥100M | Purpose limitation strict |
| DPDP | India | Yes | Explicit consent, security safeguards | Fines TBD in rules | New law; exemptions for health |
| PDPA | Singapore | Yes | Consent, data minimization, breach notify | Up to SGD 1M | Sector-specific regulation overlay |
| 21st Cures | US | Yes | FHIR APIs, SMART on FHIR, no blocking | Up to $1M | Interoperability focus |
| Convention 108+ | International | Yes (treaty) | Cross-border safeguards, breach notify | Enforced by signatories | International treaty |
| HITRUST CSF | US (healthcare) | Increasingly Yes | 49+ security controls, encryption, audit | Certification revocation | Industry-standard harmonization |
| SOC 2 Type II | Global (SaaS) | Increasingly Yes | Security controls, availability, confidentiality | Audit failure | Third-party attestation |

---

## 14. KEY TAKEAWAYS FOR UNIVERSAL HEALTHCARE API DESIGN

1. **No One-Size-Fits-All:** A single API must support multiple compliance modes based on data residency/jurisdiction.

2. **Consent is Central:** Implement granular, withdrawable consent management as core, not bolt-on:
   - Consent per purpose, recipient, data category, time period
   - Revocation in real-time
   - Audit trail immutable

3. **Data Residency Mandatory:** APIs must enforce data location rules:
   - EU data stays in EU (GDPR)
   - Saudi/UAE data doesn't leave country
   - Metadata must track jurisdictional rules

4. **Audit Logging is Non-Negotiable:** Comprehensive, tamper-proof logs:
   - 6+ year retention (HIPAA baseline)
   - Searchable, analyzable for breach detection
   - Include failed access attempts

5. **Encryption Everywhere:** TLS 1.2+ in transit, AES-256 at rest, key management separate from data

6. **FHIR as Foundation:** Adopt HL7 FHIR R4 for data modeling + SMART on FHIR for OAuth flows

7. **Third-Party Risk:** BAAs/DPAs, vendor security assessments, sub-processor disclosures

8. **Breach Response Capability:** APIs must support:
   - Incident detection/logging
   - Notification workflow per jurisdiction
   - Remediation tracking

9. **Right to Access/Erasure/Portability:** Implement as first-class API features, not afterthoughts

10. **Sector-Specific Overlays:** Healthcare laws layer atop general privacy laws:
    - HIPAA + state laws (US)
    - GDPR + ePrivacy + MDR (EU)
    - Provincial laws (Canada)
    - Each adds restrictions, not just GDPR/HIPAA

---

## Sources

- [Federal Register: ONC ASTP Deregulation](https://www.federalregister.gov/documents/2025/12/29/2025-23896/health-data-technology-and-interoperability-astponc-deregulatory-actions-to-unleash-prosperity)
- [Federal Register: 21st Century Cures Act Final Rule](https://www.federalregister.gov/documents/2020/05/01/2020-07419/21st-century-cures-act-interoperability-information-blocking-and-the-onc-health-it-certification-program)
- [Information Blocking Enforcement (2026)](https://www.hklaw.com/en/insights/publications/2026/02/the-wait-is-over-information-blocking-enforcement-is-officially-here)
- [HHS 42 CFR Part 2 Final Rule](https://www.hhs.gov/hipaa/for-professionals/regulatory-initiatives/fact-sheet-42-cfr-part-2-final-rule/index.html)
- [eCFR 42 CFR Part 2](https://www.ecfr.gov/current/title-42/chapter-I/subchapter-A/part-2)
- [FDA SaMD Global Approach](https://www.fda.gov/medical-devices/software-medical-device-samd/global-approach-software-medical-device)
- [European Health Data Space Regulation 2025/327](https://health.ec.europa.eu/ehealth-digital-health-and-care/european-health-data-space-regulation-ehds_en)
- [EHDS Implementation: GA4GH News](https://www.ga4gh.org/news_item/the-european-health-data-space-from-approval-to-national-implementation/)
- [NHS Digital DCB0129/DCB0160 Review](https://digital.nhs.uk/data-and-information/information-standards/governance/latest-activity/standards-and-collections/review-of-digital-clinical-safety-standards-dcb0129-and-dcb0160)
- [PIPEDA vs Provincial Laws (Accountable HQ)](https://www.accountablehq.com/post/does-canada-have-hipaa-laws-canada-s-equivalents-explained-pipeda-phipa-and-more)
- [Australia Privacy Act & My Health Records (OAIC)](https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/health-service-providers/my-health-record/handling-information-in-a-my-health-record)
- [Singapore PDPA & HCSA Advisory Guidelines (PDPC/MOH)](https://www.pdpc.gov.sg/organisations/best-practices-and-guidance/sectoral-guidance)
- [Japan APPI 2022 Amendments (Morgan Lewis)](https://www.morganlewis.com/pubs/2022/08/how-japans-privacy-act-amendments-affect-global-healthcare-businesses)
- [India DPDP Act 2023 Implementation](https://truecopy.in/blog/dpdp-act-2023-guide-for-the-healthcare-industry/)
- [South Korea PIPA Compliance (Didomi)](https://www.didomi.io/blog/south-korea-pipa-everything-you-need-to-know)
- [Brazil LGPD Enforcement (ANPD Fines 2023–2025)](https://breached.company/real-world-examples-of-lgpd-fines-and-enforcement-actions-in-brazil/)
- [UAE PDPL & ADHICS (PwC Middle East)](https://www.pwc.com/m1/en/publications/healthcare-data-protection-in-the-uae.html)
- [Nigeria NDPA 2023 (NDPC)](https://www.ndpc.gov.ng/)
- [South Africa POPIA Enforcement (Information Regulator)](https://www.justice.gov.za/inforeg/)
- [APEC CBPR System](https://cbprs.org/)
- [Convention 108+ (Council of Europe)](https://www.coe.int/en/web/data-protection/convention108-and-protocol)
- [WHO HL7 Collaboration](https://www.who.int/news/item/03-07-2023-who-and-hl7-collaborate-to-support-adoption-of-open-interoperability-standards)
- [HITRUST CSF Framework](https://hitrustalliance.net/)
- [HITRUST 2025 Breach Statistics](https://hitrustalliance.net/hitrust-csf-certified-organizations-maintain-exceptional-data-security-standards/)
- [ISO 27799:2016 Health Informatics](https://www.iso.org/standard/62777.html)
- [FHIR & APIs: Building Secure Healthcare Systems (Censinet)](https://censinet.com/perspectives/fhir-apis-building-secure-healthcare-systems/)
- [CMS Interoperability Rules & FHIR APIs](https://www.cms.gov/priorities/burden-reduction/overview/interoperability/implementation-guides-standards/application-programming-interfaces-apis-relevant-standards-implementation-guides-igs)
- [SMART on FHIR Documentation](https://docs.smarthealthit.org/)
- [Google Cloud Healthcare API FHIR Consent Management](https://cloud.google.com/healthcare-api/docs/fhir-consent)
- [DEA EPCS Requirements (21 CFR 1311)](https://www.ecfr.gov/current/title-21/chapter-II/part-1311)
- [SOC 2 Compliance Checklist (HIPAA Journal)](https://www.hipaajournal.com/soc-2-compliance-checklist/)
- [HIPAA Audit Log Requirements (Optro)](https://optro.ai/blog/hipaa-audit-trail-requirements)
- [HIPAA Breach Notification Timelines (2025 Updates)](https://www.kiteworks.com/hipaa-compliance/hipaa-audit-log-requirements/)
- [Philippines RA 10173 Data Privacy Act (National Privacy Commission)](https://privacy.gov.ph/data-privacy-act/)
- [Thailand PDPA (DLA Piper Data Protection Laws)](https://www.dlapiperdataprotection.com/index.html?t=law&c=TH)
- [Malaysia PDPA & Amendments (FPF Blog)](https://fpf.org/blog/malaysia-charts-its-digital-course-a-guide-to-the-new-frameworks-for-data-protection-and-ai-ethics/)
- [Indonesia Personal Data Protection Law 2022](https://www.dlapiperdataprotection.com/index.html?t=law&c=ID)
- [Mexico LFPDPPP Healthcare Guide (MyData-TRUST)](https://www.mydata-trust.com/industry-areas/data-protection-for-hospitals-and-healthcare-institutions/)
- [Colombia Law 1581 (MyData-TRUST)](https://www.mydata-trust.com/colombia/)
- [Argentina PDPA (DLA Piper Data Protection Laws)](https://www.dlapiperdataprotection.com/index.html?t=law&c=AR)

---

**Document Version:** 1.0
**Last Updated:** April 2026
**Compiled by:** Comprehensive Global Healthcare Compliance Research
