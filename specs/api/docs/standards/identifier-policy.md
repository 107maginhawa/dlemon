# Monobase Healthcare API Standards Foundation — Identifier Policy

**Version:** 1.0.0
**Status:** Ratified
**Last Revised:** 2026-04-14
**Owner:** API / Interop Lead

---

## Overview

This document defines the complete identifier strategy for the Monobase Healthcare API Standards Foundation. It covers internal identifiers, business identifiers, cross-tenant scoping, identifier lifecycle, and merge/deduplication policy.

Identifiers are fundamental to data integrity and interoperability. Mistakes in identifier design — mutable IDs, unscopable business identifiers, merge without audit trails — are among the most expensive problems to fix in healthcare systems. This policy is binding on all implementations.

---

## Section 1: Internal Identifiers

### 1.1 UUID v4 as Universal Internal ID

Every canonical entity MUST have an internal identifier field named `id` containing a **UUID version 4** value.

| Property | Rule |
|---|---|
| **Format** | UUID v4 (random), lowercase hyphenated: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` |
| **Generation** | Server-side only; clients MUST NOT supply `id` values at creation time |
| **Immutability** | The `id` value NEVER changes after the record is created, under any circumstances |
| **Uniqueness scope** | Unique within the entity type in a given tenant; globally unique by statistical probability of UUID v4 |
| **Case sensitivity** | Stored and returned in lowercase; comparison is case-insensitive |
| **Nullability** | NEVER null; generated at record creation before persistence |

### 1.2 Why UUID v4, Not Sequential Integers

Sequential integer IDs are rejected for healthcare records for the following reasons:

- **Enumeration attacks**: Sequential IDs allow attackers to enumerate all patient records by incrementing a number
- **Merge complexity**: When two databases merge, integer IDs collide; UUID v4 collisions are statistically impossible
- **Distributed generation**: UUIDs can be generated without a central authority; integers require a centralized sequence
- **External exposure safety**: Even if an ID leaks, it reveals no information about record count or sequence

### 1.3 ID Stability Guarantee

Once issued, a UUID `id` is a permanent address for that record. Systems that cache, index, or reference a record by its `id` must never be invalidated by a business operation (rename, merge, status change, etc.). This guarantee enables:

- Stable hyperlinks in clinical documents
- Consistent audit trail entries
- Reliable cross-system references
- Safe long-lived bookmarks in clinical workflows

**The only operation that invalidates an `id` is a physical deletion, which is governed by data retention policy — not this document.**

---

## Section 2: Business Identifiers

### 2.1 The `identifiers[]` Array Model

In addition to the internal `id`, entities carry a typed array of **business identifiers** — real-world identifiers issued by external authorities (government agencies, payers, regulatory bodies, health systems).

Business identifiers follow the FHIR Identifier model:

```typescript
interface Identifier {
  use: "usual" | "official" | "temp" | "secondary" | "old";
  type: CodeableConcept;        // What kind of identifier this is
  system: string;               // URI identifying the issuing authority
  value: string;                // The identifier value itself
  period?: Period;              // Validity period
  assigner?: Reference<Organization>; // Organization that issued the identifier
}
```

**Rules:**
- Multiple identifiers of different types are permitted and expected
- Multiple identifiers of the same `type` from different `system` values are permitted
- Two identifiers with the same `type` AND same `system` represent a conflict and must be resolved before saving
- The `value` field must contain only the identifier string, never include the system prefix or label

### 2.2 Business Identifier Registry

#### 2.2.1 Patient Identifiers

| Identifier | Type Code | System URI Pattern | Scope | Notes |
|---|---|---|---|---|
| Medical Record Number (MRN) | `MR` | `https://{orgId}.monobase.health/identifier/mrn` | Per organization | Each organization issues its own MRN; same patient has different MRNs at different orgs |
| National Patient ID (US SSN) | `SS` | `http://hl7.org/fhir/sid/us-ssn` | National (US) | Highly sensitive; storage requires explicit security classification; see Privacy Policy |
| National Patient ID (generic) | `NI` | Country-specific URI | National | Use country-specific FHIR sid where available |
| Insurance Member ID | `MB` | `https://{payerId}.monobase.health/identifier/member` | Per payer | `assigner` references the Coverage's payer Organization |
| UK NHS Number | `NH` | `https://fhir.nhs.uk/Id/nhs-number` | National (UK) | Luhn-validated 10-digit number |
| Australian IHI | `NI` | `http://ns.electronichealth.net.au/id/hi/ihi/1.0` | National (AU) | Individual Healthcare Identifier |
| Passport Number | `PPN` | `urn:ietf:rfc:3986` (country-scoped) | International | `system` scoped by issuing country code |
| Driver's License | `DL` | State/province-specific URI | Jurisdiction | |
| Account Number | `AN` | `https://{orgId}.monobase.health/identifier/account` | Per organization | Health system patient account number |

#### 2.2.2 Practitioner Identifiers

| Identifier | Type Code | System URI | Scope | Notes |
|---|---|---|---|---|
| National Provider Identifier (NPI) | `NPI` | `http://hl7.org/fhir/sid/us-npi` | National (US) | 10-digit; required for US billing; unique to the individual, not the role |
| DEA Number | `DEA` | `https://monobase.health/identifier/dea` | National (US) | Drug Enforcement Administration registration; required for prescribing controlled substances |
| State Medical License | `MD` | `https://monobase.health/identifier/state-license/{stateCode}` | State (US) | One per state of licensure; `assigner` references the state medical board org |
| UK GMC Number | `PRN` | `https://fhir.nhs.uk/Id/gmc-number` | National (UK) | General Medical Council registration |
| AU AHPRA Number | `PRN` | `http://ns.electronichealth.net.au/id/hi/hpii/1.0` | National (AU) | |
| Provider Tax ID (EIN) | `TAX` | `https://monobase.health/identifier/ein` | National (US) | For group billing |
| Internal Staff ID | `EI` | `https://{orgId}.monobase.health/identifier/staff` | Per organization | Payroll / HR system ID |

#### 2.2.3 Organization Identifiers

| Identifier | Type Code | System URI | Scope | Notes |
|---|---|---|---|---|
| Organization NPI | `NPI` | `http://hl7.org/fhir/sid/us-npi` | National (US) | 10-digit; organization-level NPI (Type 2) |
| Tax Identification Number (TIN/EIN) | `TAX` | `https://monobase.health/identifier/ein` | National (US) | Federal tax ID; used in claims |
| OID (Object Identifier) | `XX` | `urn:ietf:rfc:3986` | Global | ISO OID scoped to the organization |
| CLIA Number | `CLIA` | `https://monobase.health/identifier/clia` | National (US) | Clinical Laboratory Improvement Amendments number; required for labs |
| CMS Certification Number | `CCN` | `https://monobase.health/identifier/ccn` | National (US) | Medicare/Medicaid certification |

#### 2.2.4 Other Entity Identifiers

| Entity | Identifier | Type Code | System URI | Notes |
|---|---|---|---|---|
| Specimen | Accession Number | `ACSN` | `https://{labId}.monobase.health/identifier/accession` | Lab-issued; unique per specimen per lab |
| Claim | Payer Claim ID | `PLAC` | `https://{payerId}.monobase.health/identifier/claim` | Issued by payer upon claim receipt |
| Claim | Provider Claim Number | `PRLN` | `https://{orgId}.monobase.health/identifier/claim` | Issued by provider billing system |
| Device | UDI (Device Identifier) | `UDI` | `https://monobase.health/identifier/udi` | FDA Unique Device Identifier; `value` contains the DI portion |
| Device | Serial Number | `SNO` | Manufacturer URI | |
| Medication | NDC | `NDC` | `http://hl7.org/fhir/sid/ndc` | National Drug Code (11-digit) |

---

## Section 3: Identifier Lifecycle

### 3.1 Lifecycle States

| State | Definition |
|---|---|
| `active` | The identifier is current and valid for use in transactions and references |
| `inactive` | The identifier was previously valid but is no longer in active use; historical references remain valid |
| `retired` | The identifier has been formally retired by its issuing authority; should not be used in new transactions |
| `replaced-by` | The identifier has been superseded by a new identifier; the replacement is recorded |
| `invalid` | The identifier was found to be incorrect (data entry error, fraud, etc.); was never legitimately valid |

### 3.2 Lifecycle Transitions

```
issued
  |
  v
active <---------> inactive   (temporary suspension; reactivation permitted)
  |                    |
  v                    v
retired             replaced-by (new identifier issued)
  |
  v
invalid (if never legitimate)
```

**Immutability rule**: The `value` field of an Identifier may NEVER be changed. If an identifier value was entered incorrectly, the incorrect identifier must be moved to `invalid` state and a new correct identifier created. This preserves the audit trail of what was believed to be true at each point in time.

### 3.3 Identifier Verification

For regulated identifiers (NPI, DEA, CLIA, NHS Number), implementations SHOULD perform verification against the issuing authority before storing the identifier as `active`. Unverified identifiers may be stored with `use: "temp"` pending verification.

| Identifier | Verification Source |
|---|---|
| NPI (individual or org) | NPPES NPI Registry API (npiregistry.cms.hhs.gov) |
| DEA | DEA closed verification (no public API; NCPDP or state PMP) |
| CLIA | CMS CLIA database |
| NHS Number | NHS Personal Demographics Service (PDS) |
| CVX (vaccine) | CDC CVX database |

---

## Section 4: Merge and Deduplication Policy

### 4.1 The Patient Merge Problem

A patient may have multiple records in a health system due to registration errors, name changes, duplicate enrollment, or multi-facility encounters. Merging patient records is a high-stakes operation: getting it wrong can result in clinical data from one patient appearing in another patient's record, with potentially lethal consequences.

This policy defines the safe merge pattern. No implementation may deviate from this pattern.

### 4.2 Merge Terminology

| Term | Definition |
|---|---|
| **Target record** | The surviving Patient record after a merge — the master identity |
| **Source record** | The Patient record that is being merged into the target — the subordinate identity |
| **Merge link** | A `Patient.link` entry recording that the source was merged into the target |
| **Redirect** | A response mechanism that forwards requests for the source ID to the target ID |

### 4.3 Patient.link Model

The `link` field on Patient records the merge relationship:

```typescript
interface PatientLink {
  other: Reference<Patient | RelatedPerson>;
  type: "replaced-by" | "replaces" | "refer" | "seealso";
}
```

After a merge:

- **Target record**: `link` contains an entry with `type: "replaces"` pointing to the source record
- **Source record**: `link` contains an entry with `type: "replaced-by"` pointing to the target record; `active` is set to `false`

Both records remain in the database. The source is NOT deleted.

### 4.4 Merge Process Steps

```
1. PRE-MERGE REVIEW
   A qualified clinical informatics reviewer (not an automated system alone)
   confirms that the two records represent the same patient.
   Evidence reviewed: name, date of birth, identifiers, address, contact,
   clinical data plausibility.
   Merge authorization is recorded with reviewer identity and timestamp.

2. SELECT TARGET (master) AND SOURCE (subordinate)
   Typically: the record with more complete clinical data becomes the target.
   When clinical data volume is equal: the record with the earlier creation date.
   The choice must be documented in the merge authorization record.

3. LINK SOURCE TO TARGET
   Source record: set active = false; add link { type: "replaced-by", other: [target.id] }
   Target record: add link { type: "replaces", other: [source.id] }

4. CARRY FORWARD IDENTIFIERS
   All business identifiers from the source record are added to the target record
   with use: "old" to record they were previously associated with this patient.
   Duplicate identifiers (same system + value) are not added again.

5. DO NOT MOVE CLINICAL DATA
   Clinical data (Encounters, Conditions, Observations, etc.) references the
   Patient by the source `id`. This data is NOT re-pointed to the target `id`.
   Instead, the Patient lookup must follow merge links to surface all data.

6. ENABLE REDIRECT
   API requests for the source Patient `id` must return HTTP 301 or include a
   `X-Replaced-By` header pointing to the target `id`, alongside the source record
   (which contains the replaced-by link for machine-readable confirmation).

7. AUDIT LOG
   A merge event is recorded in the audit log with:
   - Source patient id
   - Target patient id
   - Authorizing reviewer identity
   - Timestamp
   - Reason/evidence summary
```

### 4.5 Unmerge Policy

Merges may be reversed only when the merge was performed in error (the records represent different patients). Unmerge requires:

- A clinical informatics review confirming the records are distinct patients
- All link entries created by the merge are removed from both records
- The source record is returned to `active: true`
- An unmerge event is recorded in the audit log

Unmerge does NOT undo any manual data corrections made after the merge was performed. Those are addressed separately on a case-by-case basis.

### 4.6 Automated Deduplication

Automated deduplication algorithms (probabilistic matching, deterministic matching) MAY be used to identify candidate duplicates, but they MAY NOT execute merges without human authorization. The output of automated deduplication is a list of **merge candidates** requiring human review, not a merge operation.

---

## Section 5: External Identifier Handling

### 5.1 system URI Requirement

Every business identifier MUST have a `system` URI that uniquely identifies the issuing authority. The system URI is the namespace for the identifier value — the same `value` string in two different `system` namespaces represents two different identifiers.

**Rules for system URIs:**

- MUST be an absolute URI (starts with `http://`, `https://`, or `urn:`)
- SHOULD be a resolvable URL where documentation about the identifier type can be found
- MUST NOT change once established for an identifier type
- Organization-specific system URIs MUST use the org's canonical domain, not a generic placeholder

**Canonical system URIs for common identifiers are defined in Section 2.2.** Do not invent new URIs for well-known identifier types.

### 5.2 assigner Reference

The `assigner` field on an Identifier is a reference to the `Organization` record that issued the identifier. It is required for:

- Any identifier issued by a specific organization (MRN, member ID, accession number)
- Any identifier where the `system` URI alone is insufficient to identify the specific issuing organization

The `assigner` is optional for national registries where the `system` URI unambiguously identifies the authority (e.g., NPI, NHS Number).

### 5.3 Identifier Matching Logic

When matching an incoming identifier to an existing record:

1. Match on `system` + `value` (exact, case-sensitive on `value` unless the identifier type is known to be case-insensitive)
2. If `system` match but `value` difference: these are different identifiers, not the same
3. If `value` match but `system` difference: treat as different identifiers; do not assume equivalence
4. Do not match on `value` alone without `system`

---

## Section 6: Cross-Tenant Identifier Scoping

### 6.1 Tenant Isolation Principle

The Monobase platform is multi-tenant. A `tenantId` scopes all data. The same business identifier value (e.g., a Medical Record Number of `"12345"`) may legitimately exist in multiple tenants and represent different patients in each.

**Cross-tenant identifier rules:**

- Business identifier uniqueness is scoped to: `tenantId` + `system` + `value`
- When an identifier needs to be globally unique (e.g., NPI), the `system` URI provides the global namespace; the `tenantId` is still required for record isolation but the NPI value should be globally unique by external authority
- Queries that search by identifier MUST be scoped to a tenant; cross-tenant searches require explicit authorization and return results from each tenant separately

### 6.2 Cross-Tenant Patient Matching

When a patient presents at a facility belonging to a different tenant in the same health network, the matching process must:

1. Query the patient's known identifiers against the receiving tenant
2. Identify candidate matches using the cross-tenant matching service
3. Require explicit human confirmation before linking records across tenants
4. Create a cross-tenant link using the `Patient.link` model with `type: "seealso"` and a fully-qualified reference including the tenant identifier

Cross-tenant links are informational (`seealso`), not merge links. They indicate that the same physical person has records in multiple tenants, but the records remain separate and neither supersedes the other.

---

## Section 7: Immutability Rules Summary

| Field | Immutable? | Notes |
|---|---|---|
| `id` (UUID) | Yes — permanently | Never changes; even if the record is logically deleted, the ID is never reused |
| `Identifier.system` | Yes — after creation | System URI for an identifier may not be changed; create a new identifier if needed |
| `Identifier.value` | Yes — after creation | If the value was wrong, retire the identifier and create a correct one |
| `Identifier.type` | Yes — after creation | |
| `Identifier.use` | No | `use` may change (e.g., `temp` -> `official` after verification, `active` -> `old` after merge) |
| `Identifier.period` | No | Validity period may be updated |
| Resource `status` / `active` | No | Lifecycle state changes are normal operations |
| `Patient.link` | Append-only | Links may be added; existing links are not removed except on authorized unmerge |
| `ProvenanceRecord` | Yes — permanently | All provenance records are immutable audit artifacts |

---

## Appendix A: Identifier Type Code Quick Reference

| Type Code | Meaning |
|---|---|
| `MR` | Medical Record Number |
| `NPI` | National Provider Identifier |
| `DEA` | DEA Registration Number |
| `SS` | Social Security Number |
| `NI` | National unique individual identifier |
| `DL` | Driver's License Number |
| `PPN` | Passport Number |
| `MB` | Member Number (insurance) |
| `AN` | Account Number |
| `ACSN` | Accession Number |
| `PLAC` | Placer Identifier (payer claim ID) |
| `PRLN` | Provider Number |
| `TAX` | Tax ID Number |
| `NH` | National Health Plan Identifier |
| `EI` | Employee Number |
| `XX` | Organization Identifier |
| `UDI` | Universal Device Identifier |
| `SNO` | Serial Number |
| `NDC` | National Drug Code |

---

## Appendix B: Common Mistakes and How to Avoid Them

| Mistake | Consequence | Correct Approach |
|---|---|---|
| Generating `id` client-side | ID collisions; no server-side audit of creation | Always generate UUID server-side at record creation |
| Using integer IDs for patient records | Enumeration attacks; merge collisions | UUID v4 only |
| Storing MRN without `system` URI | No way to distinguish MRN from Hospital A vs Hospital B | Always include the issuing org's `system` URI |
| Mutating `Identifier.value` to fix a typo | Loses audit trail of what was believed to be true | Retire incorrect identifier; create correct one |
| Merging records without human review | Clinical data mix-up; patient safety risk | Automated matching only; human authorization required to execute merge |
| Searching by identifier `value` without `system` | False matches across identifier types | Always include `system` in identifier lookup queries |
| Treating `replaced-by` patient as deleted | Historical clinical data becomes inaccessible | Source patient remains in the database; redirect to target |
