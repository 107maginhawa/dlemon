# GDPR Compliance Guide

**Regulation:** General Data Protection Regulation (EU) 2016/679
**Applicability:** Any organization processing personal data of EU/EEA residents, regardless of where the organization is located
**Last Updated:** 2026-04-14

---

## Table of Contents

1. [Lawful Bases for Processing](#lawful-bases-for-processing)
2. [Article 9 — Special Category Data (Health)](#article-9--special-category-data)
3. [Data Subject Rights](#data-subject-rights)
4. [Data Protection Impact Assessments](#data-protection-impact-assessments)
5. [Data Protection Officer](#data-protection-officer)
6. [Cross-Border Transfer Mechanisms](#cross-border-transfer-mechanisms)
7. [Breach Notification](#breach-notification)
8. [Children's Data](#childrens-data)
9. [Mapping to Our API Spec](#mapping-to-our-api-spec)

---

## Lawful Bases for Processing

**Article 6 GDPR** requires at least one lawful basis for every processing activity. Health data also requires an Article 9 condition (see next section).

| Basis | Article | When It Applies | Healthcare Relevance |
|-------|---------|----------------|---------------------|
| Consent | Art. 6(1)(a) | Individual has given clear, specific, informed, unambiguous consent | Patient portal access, research studies, marketing |
| Contract | Art. 6(1)(b) | Processing necessary to perform a contract with the data subject | Provider-patient service agreement |
| Legal Obligation | Art. 6(1)(c) | Processing necessary for compliance with EU/member state law | Mandatory reporting, retention obligations |
| Vital Interests | Art. 6(1)(d) | Necessary to protect life of data subject or another person | Emergency treatment when consent cannot be obtained |
| Public Task | Art. 6(1)(e) | Necessary for public interest task or official authority | Public health surveillance, national registries |
| Legitimate Interests | Art. 6(1)(f) | Necessary for legitimate interests of controller or third party (balancing test required) | Fraud prevention, network security — NOT applicable for public authorities |

### Consent Requirements (Art. 7)

- Freely given, specific, informed, and unambiguous
- Separate from other terms and conditions
- As easy to withdraw as to give
- Cannot be bundled with service provision (no "take it or leave it")
- Must document when and how consent was obtained
- For health data: explicit consent required (verbal or implied insufficient)

---

## Article 9 — Special Category Data

Health data is a **special category** requiring both an Article 6 lawful basis AND one of the Article 9 conditions.

| Condition | Article 9(2) | Description |
|-----------|-------------|-------------|
| Explicit consent | (a) | Patient has given explicit consent for specific purpose(s) |
| Employment/social protection | (b) | Required by employment law or social security law |
| Vital interests | (c) | Data subject is physically/legally incapable of giving consent |
| Legitimate activities of non-profit | (d) | Non-profit body with appropriate safeguards (members/former members only) |
| Made manifestly public | (e) | Data subject has manifestly made it public themselves |
| Legal claims | (f) | Establishment, exercise, or defense of legal claims |
| Substantial public interest | (g) | Member state law with proportionate safeguards |
| **Healthcare** | **(h)** | **For preventive/occupational medicine, medical diagnosis, care/treatment, management of health systems; subject to professional secrecy** |
| Public health | (i) | Serious cross-border health threats; EU/member state law required |
| Research/statistics | (j) | Scientific/historical research with appropriate safeguards; must not permit identification of individuals |

**Art. 9(2)(h) is the primary basis for routine healthcare processing.** Member states may add further conditions or restrictions.

---

## Data Subject Rights

### Overview Table

| Right | Article | Response Deadline | Can Be Refused? |
|-------|---------|------------------|----------------|
| Right to Information | 13/14 | At time of collection | No |
| Right of Access | 15 | 1 month (extendable 2 months) | Rarely (adverse effect on others' rights) |
| Right to Rectification | 16 | 1 month (extendable 2 months) | If data is accurate |
| Right to Erasure ("Right to be Forgotten") | 17 | 1 month (extendable 2 months) | Yes — multiple grounds |
| Right to Restriction | 18 | Without undue delay | Limited grounds for refusal |
| Right to Data Portability | 20 | 1 month (extendable 2 months) | Only applies to consent/contract basis |
| Right to Object | 21 | Immediately upon receipt | If compelling legitimate grounds exist |
| Rights re: Automated Decision-Making | 22 | Upon request | Exceptions for contract/consent/law |

### Article 15 — Right of Access

Individuals may request confirmation of whether their data is processed and, if so:
- Copies of personal data
- Purposes of processing
- Categories of data
- Recipients or categories of recipients
- Envisaged retention period
- Source of data (if not collected from the individual)
- Existence of automated decision-making and logic involved

**Healthcare note:** Controllers may withhold information where disclosure would adversely affect the health of the data subject (Art. 15(4); member state law). A healthcare professional intermediary may be used.

### Article 16 — Right to Rectification

- Correct inaccurate personal data without undue delay
- Complete incomplete personal data (including supplementary statement)
- Notify all recipients to whom data was disclosed (unless impossible or disproportionate)
- Cannot change factual clinical records — append corrections/amendments instead

### Article 17 — Right to Erasure

**Grounds for erasure:**
- Data no longer necessary for the purpose collected
- Consent withdrawn and no other lawful basis
- Successful objection under Art. 21
- Unlawfully processed data
- Required by EU or member state law
- Collected in relation to an offer of information society services to a child (Art. 8)

**Exemptions — erasure may be refused:**
- Freedom of expression and information
- Legal obligation or public interest task
- Public health (Art. 9(2)(h) or (i))
- Archiving, research, or statistical purposes where erasure would seriously impair objectives
- Legal claims

**Healthcare practical guidance:** Clinical records typically cannot be fully erased due to legal retention requirements and patient safety. Document the exemption applied when refusing erasure.

### Article 18 — Right to Restriction

Processing must be restricted (stored only, not otherwise processed) when:
- Accuracy of data is contested (during verification period)
- Processing is unlawful but individual opposes erasure
- Controller no longer needs the data but individual needs it for legal claims
- Individual has objected pending verification of whether controller's grounds override

### Article 20 — Right to Data Portability

- Applies only when processing is based on **consent or contract** and is carried out by **automated means**
- Data must be provided in a **structured, commonly used, machine-readable format**
- Individuals may request direct transmission to another controller where technically feasible
- **Does not apply** to processing necessary for a public interest task or legal obligation
- **Healthcare relevance:** Patient access to their own health records for transfer to another provider

### Article 21 — Right to Object

- Individual may object at any time to processing based on Art. 6(1)(e) [public task] or 6(1)(f) [legitimate interests]
- Controller must stop processing unless it demonstrates compelling legitimate grounds overriding the individual's interests
- **Research exception:** May object to processing for scientific/historical research unless necessary for a public interest task

---

## Data Protection Impact Assessments

**Article 35** requires a DPIA before processing that is likely to result in a high risk to individuals.

### When a DPIA is Mandatory

| Scenario | Example |
|----------|---------|
| Systematic and extensive automated evaluation including profiling | Patient risk stratification algorithms |
| Large-scale processing of special category data | Electronic health records system |
| Systematic monitoring of publicly accessible areas | Hospital CCTV with biometric analysis |
| New technologies | AI diagnostic tools, wearable health monitors |
| Denial of service based on automated processing | Insurance eligibility determination |

### DPIA Required Content

1. Systematic description of processing operations and purposes
2. Assessment of necessity and proportionality of processing
3. Assessment of risks to the rights and freedoms of data subjects
4. Measures envisaged to address risks (safeguards, security measures)
5. Prior consultation with supervisory authority if residual risk remains high (Art. 36)

### DPIA Template Framework

| Section | Key Questions |
|---------|--------------|
| Processing description | What data? What purpose? Who processes it? Who has access? |
| Necessity | Is processing limited to what is necessary? Is there a less privacy-invasive alternative? |
| Risk assessment | Likelihood × severity for each identified risk |
| Mitigation | Technical and organizational measures for each risk |
| Residual risk | After mitigation, is risk acceptable? If not → DPA consultation |
| Review schedule | When will DPIA be reviewed? |

---

## Data Protection Officer

**Article 37** — DPO appointment is mandatory when:
- Controller/processor is a public authority
- Core activities involve large-scale systematic monitoring of individuals
- Core activities involve large-scale processing of special category data (Art. 9) or criminal conviction data (Art. 10)

**Healthcare organizations almost always require a DPO** due to large-scale health data processing.

### DPO Obligations

| Obligation | Description |
|-----------|-------------|
| Expert knowledge | Must have expert knowledge of data protection law and practices |
| Independence | Cannot receive instructions on tasks; cannot be dismissed for performing role |
| Resources | Must be provided with resources to carry out tasks |
| Point of contact | Primary point of contact for supervisory authority and data subjects |
| Record keeping | Maintain records of processing activities (Art. 30) |
| DPA registration | Contact details must be published and notified to supervisory authority |

---

## Cross-Border Transfer Mechanisms

**Chapter V GDPR** — Transfers outside EEA require adequate protection.

| Mechanism | Article | Description | Current Status |
|-----------|---------|-------------|---------------|
| Adequacy Decision | 45 | European Commission determines third country provides adequate protection | UK (adequate post-Brexit, review 2025), Canada (PIPEDA adequacy), Japan, Israel, others |
| Standard Contractual Clauses (SCCs) | 46(2)(c) | EC-approved contractual terms | 2021 SCCs required; supplementary measures may be needed |
| Binding Corporate Rules (BCRs) | 47 | Intra-group rules approved by lead DPA | Takes 2+ years to obtain; used by large multinationals |
| Derogations | 49 | Specific situations where transfer is permitted | Explicit consent, vital interests, public interest, legal claims, important public register |
| GDPR-EU Data Privacy Framework | 45 | US-EU adequacy decision | EU-US DPF effective July 2023; annual review by EC |
| Approved Codes of Conduct | 46(2)(e) | Binding codes with independent monitoring | Healthcare-specific codes emerging |
| Certification Mechanisms | 46(2)(f) | Approved certification schemes with binding commitments | Limited availability currently |

### Transfer Impact Assessment (TIA)

Required for SCCs following Schrems II (CJEU C-311/18):
1. Assess law and practice in the destination country
2. Evaluate whether SCCs can be effective given that law
3. Implement supplementary measures if necessary (encryption, pseudonymization, contractual restrictions)
4. Document assessment

---

## Breach Notification

**Articles 33 and 34 GDPR**

### Notification to Supervisory Authority (Article 33)

| Element | Requirement |
|---------|-------------|
| Threshold | Any personal data breach (unless no risk to individuals) |
| Timeline | **Without undue delay and where feasible within 72 hours** of becoming aware |
| Late notification | Reasons for delay must be provided |
| Content | Nature of breach, categories/numbers of individuals, DPO contact, likely consequences, measures taken |
| Phased notification | Permitted if full information not yet available; provide in phases |
| Record keeping | All breaches must be documented, even those not notified |

### Notification to Data Subjects (Article 34)

| Element | Requirement |
|---------|-------------|
| Threshold | Only when breach is likely to result in **high risk** to individuals |
| Timeline | Without undue delay |
| Content | Plain language description, DPO contact, likely consequences, measures taken |
| Exemptions | Not required if: data was encrypted/pseudonymized; measures make high risk unlikely; disproportionate effort (use public communication instead) |

### Risk Levels

| Risk Level | Examples | Action Required |
|-----------|---------|----------------|
| No risk | Encrypted backup lost; key retained | Document only |
| Risk | Employee accidentally emails one patient's record to wrong doctor | Notify DPA |
| High risk | Ransomware encrypts unencrypted patient database | Notify DPA + all affected individuals |

---

## Children's Data

**Article 8 GDPR** — Information Society Services directed at children

| Element | Requirement |
|---------|-------------|
| Age threshold | 16 years (member states may lower to 13) |
| Parental consent | Required for under-16s; verifiable parental consent |
| Reasonable verification | Controllers must make reasonable effort to verify parental consent |
| Healthcare exception | Art. 9(2)(h) may apply for direct healthcare regardless of age |
| Best interests | Children's best interests must be a primary consideration |

---

## Mapping to Our API Spec

### Patient/$everything — Right of Access (Art. 15)

| GDPR Requirement | Our Implementation |
|------------------|-------------------|
| Provide copy of personal data | `GET /patients/{id}/$everything` returns all resources |
| Machine-readable format | Returns FHIR R4 Bundle (JSON/XML) |
| Include processing purposes | Privacy notice linked in Patient.extension |
| 1-month deadline tracking | Request logged in `Task` resource with due date |
| Exemption documentation | `OperationOutcome` captures reason if access restricted |

### $export Endpoint — Right to Data Portability (Art. 20)

| GDPR Requirement | Our Implementation |
|------------------|-------------------|
| Structured, machine-readable format | FHIR Bulk Data export (NDJSON) |
| Common format | FHIR R4 — widely supported by EHR systems |
| Direct transfer where feasible | Export destination URL parameter supports push to another system |
| Scope limitation | Export scoped to patient's own data only via SMART patient-context token |

### Consent Resource — Legal Basis Documentation

| GDPR Requirement | Our Implementation |
|------------------|-------------------|
| Document lawful basis | `Consent.policyRule` references applicable legal basis |
| Record explicit consent | `Consent.status = "active"` with `provision.type = "permit"` |
| Withdrawal mechanism | `PATCH /consents/{id}` with `status: "inactive"` |
| Consent specificity | `Consent.provision.purpose[]` lists specific processing purposes |
| Expiry | `Consent.provision.period` defines validity period |
| Consent version tracking | `Consent.meta.versionId` + `Provenance` chain |

### Provenance Resource — Accountability (Art. 5(2))

| GDPR Requirement | Our Implementation |
|------------------|-------------------|
| Demonstrate lawful basis | `Provenance.reason` references Consent or legal obligation |
| Record of processing activities | `Provenance` + `AuditEvent` create comprehensive trail |
| Data source documentation | `Provenance.agent[].who` identifies original source |
| Amendment audit trail | `Provenance.activity = "amend"` with prior version reference |

### Erasure Workflow

| GDPR Requirement | Our Implementation |
|------------------|-------------------|
| Respond within 1 month | Erasure `Task` resource tracks request and deadline |
| Document exemption if refused | `OperationOutcome` records exemption basis (e.g., legal retention) |
| Cascade to processors | Deletion propagates to downstream systems via event stream |
| Notify recipients | Downstream system notifications via subscription mechanism |

### DPIA Support

| GDPR Requirement | Our Implementation |
|------------------|-------------------|
| Processing inventory | Each resource type documented with purpose in IG narrative |
| Risk register | Documented in compliance/security runbook |
| DPIA outputs | Drive security controls in our threat model |
