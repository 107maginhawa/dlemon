# Security and Privacy for Healthcare — Monobase Healthcare API Standards Foundation

**Document ID**: MHASF-STD-010
**Version**: 1.0.0
**Status**: Active
**Last Updated**: 2026-04-14

---

## Table of Contents

1. [Confidentiality Classifications](#confidentiality-classifications)
2. [Sensitive Record Types](#sensitive-record-types)
3. [Break-Glass Access Pattern](#break-glass-access-pattern)
4. [Purpose-of-Use Handling](#purpose-of-use-handling)
5. [Consent Enforcement](#consent-enforcement)
6. [Data Masking for API Responses](#data-masking-for-api-responses)
7. [Minimum Necessary Principle](#minimum-necessary-principle)
8. [Audit Requirements](#audit-requirements)
9. [HIPAA Safe Harbor De-identification](#hipaa-safe-harbor-de-identification)
10. [Cross-Border Data Transfer](#cross-border-data-transfer)

---

## 1. Confidentiality Classifications

### 1.1 ConfidentialityClassification Enum

All resources carry a `meta.security` tag using the HL7 Confidentiality code system (`http://terminology.hl7.org/CodeSystem/v3-Confidentiality`). The Monobase platform enforces access control based on these classifications.

| Code | Name              | Description                                                                                  | Default For                                     |
|------|-------------------|----------------------------------------------------------------------------------------------|-------------------------------------------------|
| `U`  | Unrestricted      | Information available to anyone; no PHI                                                      | Public provider directories, facility info      |
| `L`  | Low               | Available to clinical staff with minimal access requirements                                 | Appointment slots, general schedules            |
| `M`  | Moderate          | Requires authenticated clinical role                                                         | Non-sensitive clinical summaries                |
| `N`  | Normal            | Standard clinical data. Default for all clinical records unless overridden                   | Encounter, Observation, Condition (routine)     |
| `R`  | Restricted        | Sensitive categories requiring explicit purpose and elevated role                            | Mental health, substance use, HIV/STI, genetics |
| `V`  | Very Restricted   | Highest sensitivity; break-glass or explicit consent required for access                     | VIP patients, celebrity, witness protection     |

### 1.2 Classification Assignment

Classification is applied in the following order of precedence:

1. **Explicit patient request**: Patient may request that their entire record be elevated to `R` or `V`.
2. **Sensitive content detection**: API layer scans submitted data for sensitive content triggers and auto-classifies (see Section 2).
3. **Resource type defaults**: Some resource types default to elevated classifications (e.g. Consent defaults to `R`).
4. **Tenant policy**: Organisations may define minimum floor classifications for resource categories.
5. **System default**: `N` (Normal) for all clinical data.

### 1.3 Downgrade Restrictions

- A classification may be **raised** by any system actor with appropriate authority.
- A classification may only be **lowered** by the Privacy Officer or a system process that has verified the content is no longer sensitive.
- All classification changes produce an audit event `support.audit.classificationChanged`.

---

## 2. Sensitive Record Types

The following categories receive automatic elevated classification when content is detected. Detection occurs at write time based on code systems, resource types, and content analysis.

| Category                  | Classification | Detection Triggers                                                        | Regulatory Basis                                 |
|---------------------------|----------------|---------------------------------------------------------------------------|--------------------------------------------------|
| Mental health             | `R`            | Encounter type codes (psychiatric), Condition ICD codes F00-F99, CarePlan category `mental-health` | 42 CFR Part 2 (where applicable), state law |
| Substance use disorder    | `R`            | Condition codes F10-F19, ServiceRequest category `substance-abuse`, MedicationRequest for methadone/buprenorphine | 42 CFR Part 2 |
| HIV / AIDS                | `R`            | Condition codes B20-B24, Z21, DiagnosticReport with HIV panel LOINC codes | State HIV confidentiality laws                  |
| STI / Sexual health       | `R`            | Condition codes A50-A64, Z11.3, Z11.4                                     | State STI reporting laws                         |
| Reproductive health       | `R`            | Condition codes related to abortion, contraception (jurisdiction-sensitive) | Variable by jurisdiction                        |
| Genetic information       | `R`            | Observation category `genetic`, DiagnosticReport category `genetics`      | GINA (US), GDPR Article 9 (EU)                  |
| VIP / Celebrity           | `V`            | `meta.tag` with `VIP` code, or manual flag by Privacy Officer             | Institutional policy                            |
| Paediatric records        | `R`            | Patient.birthDate within 18 years combined with sensitive content         | COPPA, state minor consent laws                 |
| Domestic violence flag    | `R`            | Observation `domestic-violence` LOINC panel, safety planning CarePlan     | Variable by jurisdiction                         |

### 2.1 Sensitive Category Tagging

When a resource is auto-classified as sensitive, the `meta.security` array is updated with both the classification and a sensitive category tag:

```json
"meta": {
  "security": [
    {
      "system": "http://terminology.hl7.org/CodeSystem/v3-Confidentiality",
      "code": "R",
      "display": "Restricted"
    },
    {
      "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      "code": "42CFRPart2",
      "display": "Substance Use Disorder Record"
    }
  ]
}
```

---

## 3. Break-Glass Access Pattern

### 3.1 Definition

Break-glass is an emergency override mechanism that allows a provider to access records that would normally be blocked by classification or consent restrictions. It is named for the practice of breaking a glass seal to access an emergency resource.

### 3.2 When Break-Glass Applies

| Scenario                                                          | Break-Glass Required |
|-------------------------------------------------------------------|----------------------|
| Provider accesses `V`-classified record without prior consent     | Yes                  |
| Provider accesses `R`-classified record outside their normal scope| Yes                  |
| Treating provider accesses record of patient who has opted out    | Yes (with limitations) |
| Emergency clinician accesses restricted mental health records     | Yes                  |
| System admin accesses clinical records for troubleshooting        | Yes                  |

### 3.3 Break-Glass Request Flow

```
1. Client calls API endpoint with X-Break-Glass: true header
2. API validates that:
   a. Actor has a clinical role (not admin/billing/system)
   b. Actor declares a valid emergency purpose: ETREAT
   c. A reason is provided (minimum 10 characters)
3. API grants time-limited access token (default: 2-hour window)
4. All resources accessed during this window are tagged with break-glass flag
5. Audit event emitted: support.audit.breakGlassUsed
6. Privacy Officer notified immediately (push notification + email)
7. Post-hoc review task created, assigned to Privacy Officer, due within 24 hours
```

### 3.4 Break-Glass Request Headers

```
X-Break-Glass: true
X-Break-Glass-Reason: Patient is unconscious in ER. No prior treating relationship. Emergency care required.
X-Break-Glass-Purpose: ETREAT
```

### 3.5 Multiple Break-Glass Events (Escalation)

| Pattern                                                      | Automatic Action                               |
|--------------------------------------------------------------|------------------------------------------------|
| Same actor, same patient, 2+ break-glass events in 24 hours  | Escalation alert to department head            |
| Same actor, 5+ unique patients in 24 hours                   | Immediate flag for investigation               |
| Any break-glass outside normal working hours                 | Immediate alert to on-call Privacy Officer     |
| Break-glass on `V`-classified record                         | Always triggers immediate notification         |

### 3.6 Post-Hoc Review

Within 24 hours of a break-glass event, the Privacy Officer must:

1. Review the accessed records.
2. Confirm the clinical necessity.
3. Document the review outcome in the Task resource created at break-glass time.
4. If access was inappropriate, initiate the breach notification process.

---

## 4. Purpose-of-Use Handling

### 4.1 PurposeOfUse Enum

Every data access request must declare a purpose of use. The purpose is carried in the JWT claims and in the event envelope's `actor.purposeOfUse` field.

| Code       | Name                       | Description                                                             | Default For            |
|------------|----------------------------|-------------------------------------------------------------------------|------------------------|
| `TREAT`    | Treatment                  | Direct patient care by the treating care team                           | Clinical users         |
| `ETREAT`   | Emergency Treatment        | Emergency care; may override consent restrictions                       | Break-glass access     |
| `HPAYMT`   | Healthcare Payment         | Processing of claims, prior auth, remittance                            | Billing staff          |
| `HOPERAT`  | Healthcare Operations      | QA, scheduling, administration, workforce management                   | Admin users            |
| `HRESCH`   | Healthcare Research        | Research with IRB approval; de-identified data preferred                | Research systems       |
| `PUBHLTH`  | Public Health               | Mandatory disease reporting to public health authorities                | Reporting systems      |
| `HDIRECT`  | Health Data Direct          | Patient-directed access (patient accessing their own data)              | Patient portal users   |
| `LEGAL`    | Legal                       | Legal proceedings; subpoena response                                    | Compliance/legal team  |

### 4.2 Purpose-Based Access Rules

| Purpose    | Can Access `N` | Can Access `R`    | Can Access `V`         | Notes                                     |
|------------|----------------|-------------------|------------------------|-------------------------------------------|
| `TREAT`    | Yes            | With role match   | No (break-glass only)  |                                           |
| `ETREAT`   | Yes            | Yes (break-glass) | Yes (break-glass)      | Always audited; break-glass required for V |
| `HPAYMT`   | Billing fields only | No           | No                     | Field-level filter applied                |
| `HOPERAT`  | Aggregate only | No                | No                     | De-identified or aggregate data only      |
| `HRESCH`   | De-identified  | De-identified     | No                     | IRB approval token required               |
| `PUBHLTH`  | Reportable fields only | Reportable fields only | No         | Limited to reportable disease fields      |
| `HDIRECT`  | Own data only  | Own R-data        | Own V-data             | Patients access their own records         |

### 4.3 IRB Approval for Research

Requests with `HRESCH` purpose must include an `X-IRB-Protocol` header containing a valid IRB protocol identifier. The API validates the identifier against the IRB registry before granting access. Expired or revoked IRB protocols are rejected.

---

## 5. Consent Enforcement

### 5.1 Consent Resource

The `Consent` resource captures the patient's expressed preferences for how their data may be used. The API consent engine evaluates Consent resources before returning data.

### 5.2 Consent Provision Types

| Provision Type | Meaning                                                                              |
|----------------|--------------------------------------------------------------------------------------|
| `permit`       | Patient permits access matching this provision                                       |
| `deny`         | Patient denies access matching this provision                                        |

Provisions can specify:
- Actor (who is permitted or denied)
- Purpose of use
- Data categories (resource types or sensitivity classes)
- Time period

### 5.3 Opt-Out

When a patient has an active `deny` provision:

- Resources matching the denied scope are **suppressed** from API responses.
- The API returns an empty result set or a 200 with zero matches — it does not reveal that records exist.
- Exception: Emergency treatment (`ETREAT`) may override opt-out with break-glass; this is always audited.
- The Consent resource itself is accessible to the patient and their designated representatives.

### 5.4 Consent Evaluation Algorithm

```
For each resource in the response set:
  1. Find all active Consent resources for the patient
  2. Evaluate provisions in order (most specific first):
     a. Match actor (requesting user's role/identity)
     b. Match purpose (declared purpose of use)
     c. Match data category (resource type or security tag)
  3. If any deny provision matches: suppress resource
  4. If a permit provision matches and no deny: include resource
  5. If no provision matches: apply default consent policy
     - Default policy is configurable per tenant
     - Recommended default: permit for TREAT, deny for all others
```

### 5.5 Consent Changes

Consent changes (recorded, revoked, updated) emit `administrative.consent.*` events and are immediately reflected in the consent evaluation engine. There is no caching period; consent revocation is effective within 1 second of the API acknowledging the update.

---

## 6. Data Masking for API Responses

### 6.1 Definition

Data masking replaces the value of a sensitive field with a mask indicator while keeping the field present in the response. Masking is transparent — the client knows the field exists but cannot see its value. This differs from field omission.

### 6.2 Mask Indicator Format

```json
{
  "identifier": [
    {
      "system": "http://hl7.org/fhir/sid/us-ssn",
      "value": "***-**-****",
      "_value": {
        "extension": [{
          "url": "http://hl7.org/fhir/StructureDefinition/data-absent-reason",
          "valueCode": "masked"
        }]
      }
    }
  ]
}
```

### 6.3 Fields Masked by Default

| Field                          | Masked For                                        | Unmasked For                          |
|--------------------------------|---------------------------------------------------|---------------------------------------|
| Patient SSN                    | All roles except Privacy Officer, Legal           | Privacy Officer, Legal with LEGAL purpose |
| Patient full DOB (minor)       | All roles except treating provider and HDIRECT    | Treating provider, patient themselves |
| Financial account numbers      | All clinical roles                                | Billing staff with HPAYMT             |
| Full address of DV patients    | All roles except treating provider                | Treating provider with active consent |
| Sensitive `V`-classified field values | All except break-glass or patient         | Break-glass override, HDIRECT         |

### 6.4 Masking Does Not Apply To

- The field's existence (presence/absence is always revealed).
- Non-PHI fields.
- Fields the patient is reading about themselves (`HDIRECT` purpose).
- Audit records (unmasked in audit store, restricted access to audit store itself).

---

## 7. Minimum Necessary Principle

### 7.1 Policy

The API returns only the data needed for the declared purpose. This is the HIPAA minimum necessary standard applied at the API layer.

### 7.2 OAuth Scope Enforcement

Access tokens must include scopes that reflect the purpose and data categories needed. Scopes are evaluated per-resource on every request.

| Scope                 | Access Granted                                          |
|-----------------------|---------------------------------------------------------|
| `patient/*.read`      | Read any resource for patients in the token's scope     |
| `clinical:read`       | Read clinical resources (Encounter, Condition, Obs, etc)|
| `clinical:write`      | Write clinical resources                                |
| `billing:read`        | Read Claim, Coverage, PriorAuth                         |
| `billing:write`       | Write Claim, Coverage, PriorAuth                        |
| `admin:read`          | Read Patient, Practitioner, Organization demographics   |
| `admin:write`         | Write Patient, Practitioner, Organization demographics  |
| `consent:read`        | Read Consent resources                                  |
| `consent:write`       | Write Consent resources                                 |
| `audit:read`          | Read AuditEvent resources (Privacy Officer only)        |
| `sensitive:read`      | Read R-classified resources (requires elevated role)    |

### 7.3 Field-Level Access Control

For requests with `HPAYMT` purpose, the API applies a billing-specific field projection that returns only fields relevant to payment processing. Clinical narrative, mental health records, and sensitive identifiers are stripped from billing responses even if the actor has broad read scope.

Similarly, `HOPERAT` requests receive aggregate or de-identified data for operational analytics, not individual patient records.

---

## 8. Audit Requirements

### 8.1 What Must Be Audited

**ALL access to clinical data must be logged.** This is a HIPAA requirement (45 CFR §164.312(b)) and a platform non-negotiable.

| Event Category                      | Audit Required | Retention  |
|-------------------------------------|----------------|------------|
| Any read of a clinical resource     | Mandatory      | 6 years    |
| Any write to a clinical resource    | Mandatory      | 6 years    |
| Any consent change                  | Mandatory      | 6 years    |
| Any break-glass override            | Mandatory      | 6 years    |
| Any confidentiality classification change | Mandatory | 6 years   |
| Any patient identity change (merge, update) | Mandatory | 6 years |
| Any access to `R` or `V` resources  | Mandatory      | 6 years    |
| Any authentication event            | Mandatory      | 6 years    |
| Any authorisation failure           | Mandatory      | 6 years    |
| Billing submissions                 | Mandatory      | 7 years    |
| System configuration changes        | Mandatory      | 3 years    |

### 8.2 Audit Record Immutability

- Audit records are **append-only**. No modification or deletion is possible via any API or direct database operation.
- Records are cryptographically signed (HMAC-SHA256) at write time using a key held in the HSM.
- Sequential audit records are hash-chained. Tampering detection runs on a configurable schedule (minimum: daily).
- Audit store access is itself audited in a separate, isolated log.

### 8.3 Break-Glass Audit Obligations

Break-glass events carry elevated audit obligations:

1. The event must be written **synchronously** before the break-glass access is granted. If the audit write fails, the break-glass access is denied.
2. The Privacy Officer receives an immediate push notification and email.
3. A review Task is created and must be completed within 24 hours.
4. The audit record is tagged `highRisk: true` and replicated to a secondary immutable store.

### 8.4 Audit Access

The audit store is accessible only to:
- Privacy Officers (`audit:read` scope with HOPERAT purpose)
- Compliance/Legal roles (`audit:read` scope with LEGAL purpose)
- Automated compliance reporting systems (service account with `audit:read`)

No clinical, billing, or admin role has direct access to the audit store.

---

## 9. HIPAA Safe Harbor De-identification

### 9.1 The 18 Identifiers

Under HIPAA Safe Harbor (45 CFR §164.514(b)), the following 18 identifier categories must be removed or generalised before data is considered de-identified:

| # | Identifier Category                    | De-identification Action                               |
|---|----------------------------------------|--------------------------------------------------------|
| 1 | Names                                  | Remove all names (first, last, middle, maiden)         |
| 2 | Geographic subdivisions smaller than state | Reduce ZIP to first 3 digits; suppress if population < 20,000 |
| 3 | Dates (except year)                    | Remove month/day; retain year; generalise ages 90+     |
| 4 | Phone numbers                          | Remove completely                                      |
| 5 | Fax numbers                            | Remove completely                                      |
| 6 | Email addresses                        | Remove completely                                      |
| 7 | Social Security numbers                | Remove completely                                      |
| 8 | Medical record numbers                 | Remove or replace with pseudonym                       |
| 9 | Health plan beneficiary numbers        | Remove completely                                      |
|10 | Account numbers                        | Remove completely                                      |
|11 | Certificate/license numbers            | Remove completely                                      |
|12 | Vehicle identifiers (VIN, plate)       | Remove completely                                      |
|13 | Device identifiers and serial numbers  | Remove or generalise                                   |
|14 | Web URLs                               | Remove completely                                      |
|15 | IP addresses                           | Remove completely                                      |
|16 | Biometric identifiers (fingerprint, voice) | Remove completely                                  |
|17 | Full-face photographs                  | Remove completely                                      |
|18 | Any other unique identifying number    | Remove or pseudonymise                                 |

### 9.2 DeIdentificationProfile Resource

The `DeIdentificationProfile` resource codifies the de-identification rules applied to a dataset. It must be referenced by any data export or research data release.

```typescript
model DeIdentificationProfile {
  id:              string;
  name:            string;
  method:          "safe-harbor" | "expert-determination";
  identifierActions: IdentifierAction[];  // One per identifier category
  dateHandling:    DateHandlingPolicy;
  geographyHandling: GeographyHandlingPolicy;
  appliedBy:       Reference<Practitioner>;  // Privacy Officer
  appliedDate:     utcDateTime;
  certificationStatement?: string;
}
```

### 9.3 Expert Determination Alternative

Where Safe Harbor is insufficient for research utility, Expert Determination (45 CFR §164.514(b)(1)) may be used. This requires:
- A qualified statistical expert signs off on the de-identification.
- The expert's determination document is attached to the `DeIdentificationProfile`.
- Re-identification risk must be "very small" per the expert's analysis.

### 9.4 Pseudonymisation

For research datasets that need longitudinal linkage without direct identifiers, pseudonymisation replaces identifiers with consistent pseudonyms:
- Patient ID is replaced with a study-specific pseudonym derived from a one-way function.
- The mapping table is held separately, accessible only to Privacy Officers.
- Pseudonymised data is not considered de-identified under HIPAA but may satisfy GDPR pseudonymisation requirements.

---

## 10. Cross-Border Data Transfer

### 10.1 Jurisdiction Flagging

Every resource carries a `meta.tag` indicating the primary jurisdiction of the data subject:

```json
"meta": {
  "tag": [
    {
      "system": "http://monobase.health/fhir/CodeSystem/jurisdiction",
      "code": "AU",
      "display": "Australia"
    }
  ]
}
```

The jurisdiction tag is set at resource creation based on the patient's primary address or the tenant's declared jurisdiction. It does not change when a patient travels.

### 10.2 Transfer Prohibition by Default

Cross-border transfer (replication, bulk export, or query routing to infrastructure outside the declared jurisdiction) is **prohibited by default**. Transfer requires one of the following legal bases.

### 10.3 Legal Bases for Cross-Border Transfer

| Framework    | Mechanism                              | Documentation Required                              |
|--------------|----------------------------------------|-----------------------------------------------------|
| GDPR (EU/UK) | Adequacy decision                      | Destination country has EU adequacy status          |
| GDPR (EU/UK) | Standard Contractual Clauses (SCCs)    | Executed SCCs in the tenant's legal record          |
| GDPR (EU/UK) | Binding Corporate Rules (BCRs)         | Approved BCRs covering the transfer                 |
| GDPR Article 49 | Explicit consent                    | Patient's explicit consent for the specific transfer|
| GDPR Article 49 | Vital interests                      | Emergency with no alternative; logged and reviewed  |
| HIPAA (US)   | Business Associate Agreement (BAA)    | Executed BAA with the receiving entity              |
| PIPEDA (CA)  | Comparable protection standard        | Assessment documented                               |
| My Health Records Act (AU) | System Operator authorisation | ADHA authorisation in place                  |
| PhilHealth regulations (PH)| PhilHealth data sharing agreement | Executed agreement on file                |

### 10.4 Consent for Cross-Border Transfer

When explicit consent is the legal basis:
- A `Consent` resource with `category: cross-border-transfer` must exist and be active.
- The consent must name the destination jurisdiction(s) or entity.
- Consent must be revocable at any time; revocation takes effect within 72 hours for automated transfers.

### 10.5 Transfer Audit

Every cross-border transfer event must be logged with:
- Source jurisdiction
- Destination jurisdiction
- Legal basis code
- Reference to supporting legal instrument (SCC document ID, BAA reference, etc.)
- Data categories transferred
- Volume (number of records)
- Timestamp

Transfer audit records are retained for the longer of 6 years or the term of the legal instrument.

### 10.6 Data Residency Configuration

Tenants may configure data residency requirements in the platform settings. When a data residency constraint is active:
- Write operations for patients in the covered jurisdiction are routed to infrastructure in that jurisdiction.
- Query results are assembled within the jurisdiction and transferred only as a finalised response.
- Backup and DR replicas remain within the jurisdiction unless an explicit cross-border agreement covers disaster recovery.
