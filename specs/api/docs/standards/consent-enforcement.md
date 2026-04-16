# Consent Enforcement Specification

**Purpose:** Defines the runtime algorithm for evaluating patient consent and access control decisions
**FHIR Resource:** Consent (R4)
**Last Updated:** 2026-04-14

---

## Table of Contents

1. [Overview](#overview)
2. [Consent Evaluation Algorithm](#consent-evaluation-algorithm)
3. [Consent Resource Structure](#consent-resource-structure)
4. [Opt-In vs Opt-Out Defaults by Jurisdiction](#opt-in-vs-opt-out-defaults)
5. [Consent Cascade Rules](#consent-cascade-rules)
6. [Field-Level Consent](#field-level-consent)
7. [Break-Glass Override](#break-glass-override)
8. [42 CFR Part 2 Special Handling](#42-cfr-part-2-special-handling)
9. [Consent Lifecycle](#consent-lifecycle)
10. [Audit Integration](#audit-integration)

---

## Overview

The Monobase consent enforcement engine evaluates patient consent before any data access. It runs as a policy enforcement point (PEP) at the API gateway layer, after authentication and SMART scope validation but before resource retrieval.

### Enforcement Architecture

```
API Request
    ↓
1. Authentication (JWT validation)
    ↓
2. SMART Scope Authorization (coarse-grained)
    ↓
3. Consent Enforcement Engine (fine-grained)
    ↓
4. Resource Server (data retrieval)
    ↓
5. Field-Level Filtering (sensitive field removal)
    ↓
6. AuditEvent Creation
    ↓
Response
```

### Performance Requirements

| Metric | Target |
|--------|--------|
| Consent evaluation latency (p50) | < 5 ms |
| Consent evaluation latency (p99) | < 20 ms |
| Consent cache TTL | 60 seconds |
| Cache invalidation on Consent update | < 2 seconds |

---

## Consent Evaluation Algorithm

### Step-by-Step Algorithm

```
FUNCTION evaluateConsent(request):
  patient = request.patient
  requestor = request.actor
  purpose = request.purposeOfUse
  resourceType = request.resourceType
  action = request.action (read/write/search)

  // Step 1: Load active Consent resources
  consents = loadConsents(patient)
  if consents is empty:
    return applyDefaultPolicy(patient.organization.jurisdiction, purpose)

  // Step 2: Evaluate all provisions
  // Deny overrides permit
  denyDecisions = []
  permitDecisions = []

  for consent in consents:
    for provision in consent.provision:
      match = evaluateProvision(provision, requestor, purpose, resourceType, action)
      if match == "deny":
        denyDecisions.add(provision)
      else if match == "permit":
        permitDecisions.add(provision)

  // Step 3: Apply deny-overrides rule
  if denyDecisions is not empty:
    return DENY (reason: first matching deny provision)

  if permitDecisions is not empty:
    return PERMIT (matched provisions)

  // Step 4: No matching provision — apply default
  return applyDefaultPolicy(patient.organization.jurisdiction, purpose)

FUNCTION evaluateProvision(provision, requestor, purpose, resourceType, action):
  // Check time validity
  if provision.period is set:
    if now < provision.period.start OR now > provision.period.end:
      return NO_MATCH

  // Check actor match
  if provision.actor is set and not empty:
    if requestor.role not in provision.actor.role:
      if requestor.identity not in provision.actor.reference:
        return NO_MATCH

  // Check purpose match
  if provision.purpose is set and not empty:
    if purpose not in provision.purpose:
      return NO_MATCH

  // Check resource type match
  if provision.data is set and not empty:
    if resourceType not in provision.data.meaning:
      return NO_MATCH

  // Check security label match (for sensitive data)
  if provision.securityLabel is set:
    if resource.security not intersect provision.securityLabel:
      return NO_MATCH

  // All conditions matched
  return provision.type  // "deny" or "permit"
```

### Decision Matrix

| Deny Provisions | Permit Provisions | Default Policy | Final Decision |
|----------------|------------------|---------------|----------------|
| None | Present | N/A | **PERMIT** |
| None | None | Opt-in | **DENY** |
| None | None | Opt-out | **PERMIT** |
| Present (any) | Any | Any | **DENY** |

### Deny Always Wins

The consent model uses **deny-overrides** (XACML Deny Override combining algorithm): if any provision evaluates to deny, the final decision is deny regardless of any permit provisions.

---

## Consent Resource Structure

### Consent Provision Anatomy

```json
{
  "resourceType": "Consent",
  "id": "consent-patient-123-treatment",
  "status": "active",
  "scope": {
    "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/consentscope", "code": "patient-privacy" }]
  },
  "category": [
    { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/consentcategorycodes", "code": "INFAO" }] }
  ],
  "patient": { "reference": "Patient/patient-123" },
  "dateTime": "2026-01-01T00:00:00Z",
  "performer": [{ "reference": "Patient/patient-123" }],
  "policyRule": {
    "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": "OPTOUT" }]
  },
  "provision": {
    "type": "permit",
    "period": { "start": "2026-01-01", "end": "2026-12-31" },
    "actor": [
      {
        "role": { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType", "code": "PROV" }] },
        "reference": { "reference": "Organization/general-hospital" }
      }
    ],
    "purpose": [
      { "system": "http://terminology.hl7.org/CodeSystem/v3-ActReason", "code": "TREAT" }
    ],
    "provision": [
      {
        "type": "deny",
        "securityLabel": [
          { "system": "http://terminology.hl7.org/CodeSystem/v3-Confidentiality", "code": "R" }
        ]
      }
    ]
  }
}
```

### Provision Fields Reference

| Field | Description | Evaluation |
|-------|-------------|-----------|
| `provision.type` | `permit` or `deny` | Outcome when all conditions match |
| `provision.period` | Date range for provision | No match if current time outside range |
| `provision.actor` | Specific actors (role or individual) | Must match requestor if set |
| `provision.purpose` | Purpose of use codes | Must match request purpose if set |
| `provision.action` | Actions (read, write, etc.) | Must match request action if set |
| `provision.data` | Specific resources or resource types | Must match if set |
| `provision.securityLabel` | Security labels (sensitivity) | Must match resource labels if set |
| `provision.class` | FHIR resource type and valueset | Limits provision to resource types |
| `provision.code` | Clinical codes | Limits provision to specific codes |
| `provision.provision[]` | Nested provisions | Sub-provisions processed recursively |

### Active Consent Loading

```
Query: GET /fhir/Consent?patient={id}&status=active

Filter out:
- status != active
- dateTime older than organization's maximum consent age
- Consent.scope not applicable to the current access type
```

---

## Opt-In vs Opt-Out Defaults

When no applicable Consent resource exists, the system applies a jurisdiction-based default.

### Default Policy by Jurisdiction

| Jurisdiction | Default | Basis | Applies To |
|-------------|---------|-------|-----------|
| United States (HIPAA) | **Opt-out** | HIPAA permits TPO without consent | Treatment, Payment, Operations |
| European Union (GDPR) | **Opt-in** | GDPR Art. 9 — explicit consent for health data | All processing |
| United Kingdom | **Opt-in** | UK GDPR — same as EU | All processing |
| Canada (PIPEDA/PHIPA) | **Opt-in** | Meaningful consent required | All processing |
| Australia (Privacy Act) | **Opt-in** | APP 3 — consent for sensitive info | Health data |
| Brazil (LGPD) | **Opt-in** | LGPD Art. 11 — consent for health data | Health data |
| California (CMIA/CPRA) | **Opt-in** | CMIA requires consent for medical info | Health data |
| Washington (My Health MY Data) | **Opt-in** | Consumer health data requires consent | Consumer health data |

### Default Policy Configuration

The default policy is configured at the Organization level:

```json
{
  "resourceType": "Organization",
  "extension": [{
    "url": "https://monobase.health/fhir/StructureDefinition/organization-default-consent-model",
    "valueCode": "opt-out"
  }]
}
```

Values: `opt-in`, `opt-out`, `opt-out-treatment-only`

### Purpose-Specific Defaults (US HIPAA)

| Purpose | US Default Without Consent |
|---------|--------------------------|
| TREAT (Treatment) | **PERMIT** |
| PAY (Payment) | **PERMIT** |
| HOPERAT (Healthcare Operations) | **PERMIT** |
| ETREAT (Emergency Treatment) | **PERMIT** (always) |
| RESEARCH | **DENY** (unless IRB waiver) |
| MARKETING | **DENY** |
| HSYSADMIN (Health System Admin) | **PERMIT** |
| PUBHLTH (Public Health) | **PERMIT** (mandatory reporting) |
| HRELIABLE (Oversight) | **PERMIT** |

---

## Consent Cascade Rules

### Scope Hierarchy

Consent operates at multiple scopes. More specific provisions override less specific ones.

```
Patient-level consent
    ↓ overrides by
Resource-type-level consent
    ↓ overrides by
Specific-resource consent
    ↓ overrides by
Field-level consent (see Field-Level Consent)
```

### Organization and Patient Consent Interaction

| Scenario | Rule |
|----------|------|
| Organization has default opt-out for research | Unless patient has an active research consent, research access denied |
| Patient opts in to research but organization has additional restrictions | Both patient consent AND organization policy must permit |
| Patient's explicit denial | Always overrides organizational defaults |
| Minors (under consent age) | Parent/guardian consent applies; patient consent deferred to guardian |
| Incapacitated adults | Authorized representative consent applies |

### Multi-Provider Consent

When a patient is seen by multiple organizations in a network:

| Rule | Behavior |
|------|----------|
| Consent granted to Organization A | Does not automatically extend to Organization B |
| Consent granted to "all treating providers" | Extends to any provider in active treatment relationship |
| Consent granted to a specific role | Extends to all individuals in that role at the named organization |
| Network consent (e.g., HIE consent) | Extends to all participants in the named HIE |

---

## Field-Level Consent

Beyond resource-level access control, individual fields within a resource can be filtered based on sensitivity.

### Sensitive Field Categories

| Sensitivity Label | Security Tag | Field Examples |
|------------------|-------------|----------------|
| `R` (Restricted) | `{system: "Confidentiality", code: "R"}` | Mental health diagnoses, HIV status, reproductive health, SUD records |
| `V` (Very Restricted) | `{system: "Confidentiality", code: "V"}` | Sexual orientation/gender identity, abuse/DV, HIV results |
| `N` (Normal) | `{system: "Confidentiality", code: "N"}` | Standard clinical data |
| `M` (Moderate) | `{system: "Confidentiality", code: "M"}` | Internal only; not for patient view |

### Field Filtering Algorithm

```
FUNCTION filterFields(resource, request):
  if request.actor has role "system" with all-access:
    return resource unchanged

  for each field in resource:
    fieldSensitivity = getFieldSensitivity(field, resource)
    consentResult = evaluateConsent(request, securityLabel=fieldSensitivity)
    if consentResult == DENY:
      remove field from resource
      add DataAbsentReason extension or set to null

  return filtered resource
```

### Sensitive Field Registry

| Resource | Field | Sensitivity | Governed By |
|----------|-------|-------------|------------|
| Condition | SUD diagnosis (SNOMED/ICD-10 codes) | R | 42 CFR Part 2 |
| Condition | HIV diagnosis (Z21, B20) | R | State law |
| Condition | Mental health diagnosis | R | State law (varies) |
| Condition | Reproductive health | R/V | State law |
| Observation | Pregnancy test result | R | State law |
| Observation | Genetic test result | V | GINA |
| Observation | Sexual violence exam | V | State law |
| Patient | Sexual orientation | V | State law |
| Patient | Gender identity | V | State law |
| MedicationRequest | SUD medications (MAT: buprenorphine, methadone) | R | 42 CFR Part 2 |
| DocumentReference | Mental health notes, psychotherapy notes | R | State law |
| DocumentReference | SUD treatment records | R | 42 CFR Part 2 |

---

## Break-Glass Override

In a clinical emergency where a patient cannot consent and their life is at risk, authorized users may invoke a break-glass override.

### Break-Glass Conditions

The following conditions must ALL be met:

| Condition | Verification |
|-----------|-------------|
| Clinical emergency | User asserts "patient is in immediate risk to life" |
| Unable to obtain consent | Patient is incapacitated; guardian not immediately available |
| Authorized break-glass role | User has `PractitionerRole.extension[break-glass-authorized] = true` |
| Active encounter | There is an in-progress Encounter with the patient |
| System policy allows | Organization has break-glass enabled |

### Break-Glass Invocation

```http
POST /fhir/Patient/{id}/$everything
Authorization: Bearer {token}
X-Break-Glass: true
X-Break-Glass-Reason: Patient unresponsive following cardiac event
```

Or via SMART scope: `system/Patient.read?breakglass=true` (if granted).

### Break-Glass Process

```
1. User asserts break-glass need (reason required)
2. Consent engine records break-glass invocation:
   AuditEvent {
     type: "break-glass",
     purposeOfEvent: "ETREAT",
     agent[0]: { who: requestor, role: "break-glass-invoker" }
     outcome: 0
   }
3. All Consent provisions bypassed for duration of emergency encounter
4. Access granted to non-Part-2 records (Part 2 still restricted even in emergency)
5. Supervisory notification generated (Task to supervisor within 15 minutes)
6. Post-access review triggered (24 hours after break-glass event)
```

### Break-Glass Audit

All break-glass access creates enhanced audit records:
- `AuditEvent.type = 110113` (Security Alert)
- `AuditEvent.subtype = "break-glass-access"`
- `AuditEvent.purposeOfEvent = ETREAT`
- `AuditEvent.agent[]` — detailed actor record including reason
- Notification sent to privacy officer and supervisor
- Review Task created for post-access review

---

## 42 CFR Part 2 Special Handling

**Substance use disorder records require special handling beyond standard consent.**

### 42 CFR Part 2 Detection

Records are flagged as Part 2 protected when:
- `Resource.meta.security` contains `{system: "Confidentiality", code: "R"}` AND `{system: "ActCode", code: "42CFRPart2"}`
- Resource originates from an Organization with `extension[part2-program] = true`
- Resource contains SUD-specific clinical codes matching the Part 2 indicator value set

### Part 2 Consent Requirements

| Standard HIPAA Access | Part 2 Requirement |
|----------------------|--------------------|
| TPO access allowed without consent | **Explicit consent required for every disclosure** |
| General authorization OK for multiple purposes | **Specific consent per recipient AND per purpose** |
| Recipients may re-disclose | **Recipients are PROHIBITED from re-disclosing** |
| Consent withdrawal takes effect at next request | **Consent withdrawal immediate** |

### Part 2 Consent Structure

```json
{
  "resourceType": "Consent",
  "meta": {
    "security": [{ "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": "42CFRPart2" }]
  },
  "status": "active",
  "scope": { "coding": [{ "code": "patient-privacy" }] },
  "category": [{ "coding": [{ "code": "SUBSTANCE_ABUSE" }] }],
  "patient": { "reference": "Patient/patient-123" },
  "provision": {
    "type": "permit",
    "actor": [
      {
        "role": { "coding": [{ "code": "PROV" }] },
        "reference": { "reference": "Organization/receiving-org-specific" }
      }
    ],
    "purpose": [
      { "system": "http://terminology.hl7.org/CodeSystem/v3-ActReason", "code": "TREAT" }
    ]
  }
}
```

### Part 2 Override Rules

| Scenario | 42 CFR Part 2 Access |
|----------|---------------------|
| Emergency (life-threatening) | Permitted under limited disclosure rule; log and notify |
| Court order | Requires specific court findings; not a routine subpoena |
| Research with IRB | Permitted with IRB-approved protocol and de-identification |
| Program audit | Internal audit only; no external disclosure |
| Break-glass | **NOT permitted** — Part 2 requires consent even in emergency |

---

## Consent Lifecycle

### Consent States

| Status | Meaning | Transitions |
|--------|---------|-------------|
| `draft` | Consent being prepared; not yet active | → active, → rejected |
| `proposed` | Proposed to patient; not yet agreed | → active, → rejected |
| `active` | Patient has agreed; consent in effect | → inactive |
| `rejected` | Patient has refused | Terminal |
| `inactive` | Consent has been withdrawn or expired | Terminal |
| `entered-in-error` | Created in error | Terminal |

### Consent Expiration

Consents expire automatically based on:
1. `Consent.provision.period.end` — explicit expiration date
2. Organization policy — maximum consent duration (e.g., 1 year; EU recommended)
3. Patient revocation (`PATCH /fhir/Consent/{id}` sets `status: inactive`)

### Consent Versioning

When a patient updates or revokes consent:
1. Current Consent resource is updated (status → inactive or new provision added)
2. New Consent resource created with updated terms
3. Provenance resource links new to old version
4. Consent cache invalidated within 2 seconds
5. AuditEvent recorded for the change

---

## Audit Integration

### Every Consent Decision Creates an AuditEvent

```json
{
  "resourceType": "AuditEvent",
  "type": { "system": "http://dicom.nema.org/resources/ontology/DCM", "code": "110106", "display": "Export" },
  "subtype": [{ "system": "https://monobase.health/fhir/CodeSystem/audit-subtype", "code": "consent-decision" }],
  "action": "R",
  "period": { "start": "2026-04-14T12:00:00Z", "end": "2026-04-14T12:00:00Z" },
  "recorded": "2026-04-14T12:00:00Z",
  "outcome": "0",
  "purposeOfEvent": [{ "system": "http://terminology.hl7.org/CodeSystem/v3-ActReason", "code": "TREAT" }],
  "agent": [
    {
      "type": { "coding": [{ "code": "110153", "display": "Source Role ID" }] },
      "who": { "reference": "Practitioner/dr-smith" },
      "requestor": true,
      "network": { "address": "192.168.1.100" }
    }
  ],
  "source": { "site": "Monobase API Gateway", "observer": { "reference": "Device/monobase-gateway" } },
  "entity": [
    {
      "type": { "coding": [{ "code": "1", "display": "Person" }] },
      "role": { "coding": [{ "code": "1", "display": "Patient" }] },
      "what": { "reference": "Patient/patient-123" }
    },
    {
      "type": { "coding": [{ "code": "2", "display": "System Object" }] },
      "role": { "coding": [{ "code": "4", "display": "Domain Resource" }] },
      "what": { "reference": "Consent/consent-456" },
      "detail": [
        { "type": "decision", "valueString": "PERMIT" },
        { "type": "matchedProvision", "valueString": "provision[0] type=permit purpose=TREAT" }
      ]
    }
  ]
}
```

### Consent Audit Retention

| Audit Type | Retention Period |
|-----------|----------------|
| All consent decisions | 6 years (HIPAA minimum) |
| Break-glass events | 10 years |
| 42 CFR Part 2 disclosures | Minimum 7 years |
| Consent revocations | Until patient deceased + 7 years |
| EU/GDPR data access | 5 years (GDPR accountability) |
