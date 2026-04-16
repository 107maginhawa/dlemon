# HIPAA Compliance Guide

**Regulation:** Health Insurance Portability and Accountability Act (1996) + HITECH Act (2009)
**Applicability:** All covered entities (health plans, healthcare clearinghouses, healthcare providers) and their business associates
**Last Updated:** 2026-04-14

---

## Table of Contents

1. [Privacy Rule](#privacy-rule)
2. [Security Rule](#security-rule)
3. [Breach Notification Rule](#breach-notification-rule)
4. [42 CFR Part 2 — Substance Abuse Records](#42-cfr-part-2)
5. [Mapping to Our API Spec](#mapping-to-our-api-spec)

---

## Privacy Rule

**Authority:** 45 CFR Parts 160 and 164, Subparts A and E
**Scope:** Governs use and disclosure of Protected Health Information (PHI)

### What Constitutes PHI

PHI is individually identifiable health information that relates to:
- Past, present, or future physical or mental health condition
- Provision of healthcare to an individual
- Past, present, or future payment for healthcare

PHI includes information in any form: electronic (ePHI), paper, or oral.

### Minimum Necessary Standard

| Scenario | Requirement |
|----------|-------------|
| Routine disclosures | Limit to a defined data set; implement role-based policies |
| Non-routine requests | Review each request individually |
| Requests from public officials | Establish criteria to limit information disclosed |
| Treatment purposes | Minimum necessary does NOT apply to treating providers |
| Patient requests | Minimum necessary does NOT apply to the individual's own records |

### De-identification Methods

**Method 1: Expert Determination (§164.514(b)(1))**
A qualified statistical or scientific expert certifies that the risk of identifying an individual is very small.

**Method 2: Safe Harbor (§164.514(b)(2))**
Remove all 18 identifiers AND have no actual knowledge that the remaining information could identify an individual.

### 18 Safe Harbor Identifiers

| # | Identifier | Examples |
|---|------------|---------|
| 1 | Names | First, last, maiden |
| 2 | Geographic data | Street address, city, county, ZIP (first 3 digits restricted if population < 20,000) |
| 3 | Dates (except year) | Birth date, admission date, discharge date, date of death |
| 4 | Phone numbers | All telephone numbers |
| 5 | Fax numbers | All fax numbers |
| 6 | Email addresses | All email addresses |
| 7 | Social Security numbers | Full or partial SSN |
| 8 | Medical record numbers | Any health plan/account MRN |
| 9 | Health plan beneficiary numbers | Member IDs |
| 10 | Account numbers | Financial account identifiers |
| 11 | Certificate/license numbers | State license numbers |
| 12 | Vehicle identifiers | License plates, VINs |
| 13 | Device identifiers | Serial numbers, UDIs |
| 14 | Web URLs | Any URL that could identify a person |
| 15 | IP addresses | IPv4 and IPv6 |
| 16 | Biometric identifiers | Finger/voice prints |
| 17 | Full-face photographs | Images and comparable images |
| 18 | Any other unique identifying number | Codes or characteristics |

### Permitted Uses and Disclosures Without Authorization

| Category | Description |
|----------|-------------|
| Treatment | To treating providers for continuity of care |
| Payment | For billing, claims processing, collections |
| Healthcare Operations | Quality assessment, training, accreditation |
| Required by Law | Court orders, subpoenas, public health activities |
| Public Health Activities | Reportable conditions, vital statistics |
| Health Oversight | CMS, OIG, state health departments |
| Judicial/Administrative | Pursuant to a court order |
| Law Enforcement | Specific, limited circumstances |
| Decedents | Coroners, funeral directors |
| Research | With IRB waiver or de-identified data |
| Serious Threat | Avert imminent threat to health or safety |

### Business Associate Requirements

A Business Associate Agreement (BAA) is required when a vendor:
- Creates, receives, maintains, or transmits PHI on behalf of a covered entity
- Provides services involving disclosure of PHI (legal, accounting, IT, storage)

**BAA Required Provisions:**
- Permitted uses and disclosures of PHI
- Prohibition on unauthorized use/disclosure
- Safeguards to prevent unauthorized use/disclosure
- Reporting of security incidents and breaches
- Ensuring sub-contractors comply with same obligations
- Return or destruction of PHI at contract termination
- Access to PHI for HHS investigations

---

## Security Rule

**Authority:** 45 CFR Parts 160 and 164, Subparts A and C
**Scope:** Electronic PHI (ePHI) only

### Administrative Safeguards (§164.308)

| Standard | Required/Addressable | Implementation |
|----------|---------------------|----------------|
| Security Management Process | Required | Risk analysis, risk management, sanction policy, information system activity review |
| Assigned Security Responsibility | Required | Designate a security official |
| Workforce Security | Addressable | Authorization/supervision, workforce clearance, termination procedures |
| Information Access Management | Required | Isolate healthcare clearinghouse functions, access authorization, access establishment/modification |
| Security Awareness and Training | Addressable | Security reminders, protection from malicious software, log-in monitoring, password management |
| Security Incident Procedures | Required | Identify and respond to incidents, document and mitigate |
| Contingency Plan | Required | Data backup, disaster recovery, emergency mode operations, testing, applications/data criticality analysis |
| Evaluation | Required | Periodic technical and non-technical evaluations |
| Business Associate Contracts | Required | Written contracts with all BAs |

### Physical Safeguards (§164.310)

| Standard | Required/Addressable | Implementation |
|----------|---------------------|----------------|
| Facility Access Controls | Addressable | Contingency operations, facility security plan, access control/validation, maintenance records |
| Workstation Use | Required | Policies for workstation functions and physical surroundings |
| Workstation Security | Required | Physical safeguards for workstations accessing ePHI |
| Device and Media Controls | Addressable | Disposal of ePHI, media re-use, accountability/tracking, data backup/storage |

### Technical Safeguards (§164.312)

| Standard | Required/Addressable | Implementation |
|----------|---------------------|----------------|
| Access Control | Required | Unique user identification (Required), emergency access (Required), automatic logoff (Addressable), encryption/decryption (Addressable) |
| Audit Controls | Required | Hardware, software, and procedural mechanisms to record and examine ePHI access |
| Integrity | Addressable | Authentication mechanisms to verify ePHI is not improperly altered or destroyed |
| Person Authentication | Required | Verify that the person seeking access is who they claim to be |
| Transmission Security | Addressable | Guard against unauthorized access during transmission; encryption is addressable but strongly recommended |

### Minimum Encryption Standards (Industry Best Practice)

| Data State | Minimum Standard |
|------------|-----------------|
| At Rest | AES-256 |
| In Transit | TLS 1.2+ (TLS 1.3 preferred) |
| Database | Column-level encryption for PHI fields |
| Backups | Encrypted with separate key management |
| Key Management | HSM or equivalent; annual key rotation |

---

## Breach Notification Rule

**Authority:** 45 CFR Parts 160 and 164, Subparts A and D
**Effective:** HITECH Act 2009, strengthened 2013 Omnibus Rule

### Breach Definition

A breach is an impermissible use or disclosure that compromises the security or privacy of PHI.

**Exceptions (not a breach):**
- Unintentional acquisition by workforce member acting in good faith
- Inadvertent disclosure to another authorized person
- Disclosure where the covered entity has a good-faith belief the recipient could not retain the information

### Risk Assessment (Low Probability Exception)

Before invoking breach notification, perform a four-factor risk assessment:

| Factor | Considerations |
|--------|---------------|
| 1. Nature and extent of PHI | Types of identifiers, likelihood of re-identification |
| 2. Who accessed/could access | Authorized person, unauthorized person, or unknown |
| 3. Whether PHI was acquired or viewed | Was it actually accessed or just potentially accessible? |
| 4. Extent to which risk has been mitigated | Recovery of media, assurances from recipient |

### Notification Requirements

| Recipient | Timeline | Method | Content |
|-----------|----------|--------|---------|
| Affected individuals | Without unreasonable delay, no later than 60 days after discovery | First-class mail; email if patient opted in; substitute notice if contact info outdated | (see below) |
| HHS Secretary | Breaches of 500+ individuals: within 60 days of discovery; Breaches of <500: annual log by March 1 | HHS online portal | Summary of breach |
| Prominent media | If breach affects 500+ in a state/jurisdiction | Press release to major print or broadcast media | Same as individual notice |

### Required Content of Individual Notice

1. Brief description of what happened (date of breach and date of discovery)
2. Description of types of PHI involved
3. Steps individuals should take to protect themselves
4. Description of what the covered entity is doing to investigate, mitigate, and prevent future breaches
5. Contact information (toll-free number, email, website, or postal address)

### Business Associate Breach Notification to Covered Entity

- BA must notify covered entity without unreasonable delay and no later than **60 days** after discovery
- BA must provide information necessary for covered entity to fulfill its notification obligations
- Covered entity is ultimately responsible for notification to individuals and HHS

---

## 42 CFR Part 2

**Full Title:** Confidentiality of Substance Use Disorder Patient Records
**Authority:** 42 CFR Part 2 (2020 revised rule)
**Scope:** Federally assisted substance use disorder (SUD) programs

### Key Distinctions from HIPAA

| Aspect | HIPAA | 42 CFR Part 2 |
|--------|-------|----------------|
| Scope | All PHI | SUD records from Part 2 programs only |
| TPO Exception | Allowed without consent | **NOT allowed** — consent required for every disclosure |
| Consent Specificity | General authorization OK for many uses | Must name each specific recipient |
| Re-disclosure | Recipients may re-disclose per HIPAA | Recipients are **prohibited** from re-disclosing without patient consent |
| Court Orders | Subpoena sufficient in some cases | Court order required with specific findings |
| Audit Trail | Recommended | Mandatory disclosure log |

### When 42 CFR Part 2 Applies

- Records created by a federally assisted SUD program
- Any records that identify a patient as having or having had a SUD
- Applies to all forms of records (paper, electronic, oral)

### Permitted Disclosures Without Patient Consent

| Scenario | Conditions |
|----------|-----------|
| Medical emergency | Immediate threat; log the disclosure; notify patient afterward |
| Research | IRB approval + prohibition on re-disclosure + no direct patient identification in reports |
| Audit/evaluation | Government auditors; prohibition on re-disclosure; no patient identification in reports |
| Court order | Specific court findings required (insufficient need does not suffice) |
| Crime on program premises | Report to law enforcement only; limited information |

### Consent Requirements for Disclosures

A 42 CFR Part 2 compliant consent must include:
1. Name of patient
2. Specific name(s) of program(s) making the disclosure
3. Specific name(s) of individual(s) or organization(s) receiving the disclosure
4. Specific nature of the information to be disclosed
5. Purpose of the disclosure
6. Statement that the patient may revoke the consent
7. Date, event, or condition upon which the consent expires
8. Signature of patient (or legal guardian)
9. Date signed

---

## Mapping to Our API Spec

### Audit Module

| HIPAA Requirement | Our Implementation |
|-------------------|-------------------|
| Audit Controls (§164.312(b)) | `AuditEvent` resource captures actor, action, outcome, timestamp, resource accessed |
| Sanction policy evidence | `AuditEvent.outcome` records policy violations |
| Activity review | Query `GET /audit-events?patient={id}&dateRange=...` |
| 42 CFR Part 2 disclosure log | `AuditEvent.subtype = "part2-disclosure"` with recipient identity |

### Consent Model

| HIPAA/42 CFR Requirement | Our Implementation |
|--------------------------|-------------------|
| Authorization tracking | `Consent` resource with `status`, `scope`, `provision[]` |
| 42 CFR Part 2 specificity | `Consent.provision.actor[]` names specific recipients |
| Revocation | `PATCH /consents/{id}` sets `status: "inactive"` |
| Expiration | `Consent.provision.period.end` enforces automatic expiry |
| Break-glass override | `Consent.provision.type = "permit"` with `purpose = "ETREAT"` |

### Encryption Controls

| Security Rule Requirement | Our Implementation |
|---------------------------|-------------------|
| ePHI at rest | AES-256 at database and storage layer |
| ePHI in transit | TLS 1.3 enforced; HSTS headers |
| Key management | AWS KMS / Azure Key Vault with annual rotation |
| Transmission security | All API endpoints HTTPS-only; no HTTP fallback |

### Access Control

| Security Rule Requirement | Our Implementation |
|---------------------------|-------------------|
| Unique user identification | `subject.identifier` in every access token (SMART on FHIR) |
| Emergency access | Break-glass role grants temporary elevated access; logged |
| Automatic logoff | Session tokens expire per `AccessPolicy.sessionTimeout` |
| Minimum necessary | SMART scopes limit resource type and operation access |
| Role-based access | `PractitionerRole` + scope enforcement at API gateway |

### Provenance

| HIPAA Requirement | Our Implementation |
|-------------------|-------------------|
| Accountability for disclosures | `Provenance` resource links every write to an actor and reason |
| Amendment tracking | `Provenance.activity = "amend"` with prior version reference |
| Record of disclosures | `Provenance.target` + `AuditEvent` cross-reference |
