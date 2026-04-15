# Monobase Healthcare API Standards Foundation — Standards Charter

**Version:** 1.0.0
**Status:** Ratified
**Last Revised:** 2026-04-14
**Owner:** Standards Lead

---

## 1. Purpose and Mission

The Monobase Healthcare API Standards Foundation exists to build and maintain a **universal, FHIR R4-informed healthcare API standards layer** that supports multiple health applications, ensures interoperability across organizational and national boundaries, and enables global implementations without sacrificing local clinical validity.

This foundation is not a single application's API. It is a **shared canonical standard** from which individual health products derive their API contracts. Any application built on Monobase derives its types, validators, and API shapes from this foundation — never the reverse.

### Mission Statement

> Define, maintain, and evolve a globally coherent healthcare API standard that makes it trivially correct to build interoperable health software, and structurally difficult to build siloed, non-interoperable systems.

---

## 2. Scope

The foundation governs API standards across six clinical and operational domains:

| Domain | Description | Examples |
|---|---|---|
| **Clinical** | Patient-facing clinical activity | Encounters, Conditions, Observations, Medications |
| **Administrative** | Scheduling, billing, coverage | Appointments, Claims, Coverage, Authorization |
| **Ancillary** | Diagnostics, pharmacy, imaging, dental | Lab results, Imaging studies, Medication dispensing |
| **Support** | Care coordination, consent, SDOH | Care plans, Goals, Consents, Questionnaires |
| **Operational** | Devices, supply chain, facilities | Inventory, Devices, Storage locations |
| **Analytics** | Research, de-identification, AI outputs | Cohorts, Research extracts, AI metadata |

The foundation also governs cross-cutting concerns that apply to all domains:

- **Identifier policy** — how entities are identified internally and externally
- **Terminology bindings** — which code systems attach to which fields
- **Security and privacy models** — how sensitive data is classified and governed
- **Versioning policy** — how the standard evolves without breaking consumers
- **Extension model** — how local implementations add fields without forking

---

## 3. Core Principles

These six principles are binding. They resolve conflicts between competing design proposals and serve as the authoritative rationale for design decisions recorded in ADRs.

### 3.1 Canonical Before Local

Every entity, field, and code binding defined in this foundation is the canonical definition. Local implementations **extend** the canonical model; they do not replace or shadow it. No application team may define their own version of `Patient` or `Encounter` that diverges from the canonical shape without an approved extension record.

**Implication:** If a field exists in the canonical model, every implementation must honor its name, type, and semantics. Renaming canonical fields in local code is a violation.

### 3.2 Standards Design Is Not Database Design

The API standard defines the **exchange shape** of data — the contract between systems. It is not a prescription for how data is stored. Implementations are free to normalize, denormalize, or otherwise organize their persistence layer. What must conform to the standard is what travels across system boundaries.

**Implication:** A field being present in the API model does not mean it must be a column in a table. A join that produces a canonical-shaped response is fully compliant.

### 3.3 Semantics Matter as Much as Structure

A field named `code` containing a SNOMED CT term and a field named `code` containing a free-text string are structurally identical and semantically incompatible. This foundation governs **both** structure and semantics. Terminology bindings, value set constraints, and code system designations are first-class governance artifacts, not optional annotations.

**Implication:** An API response that is structurally valid but uses the wrong code system for a bound field is non-compliant.

### 3.4 Global Core, Local Extensions

The canonical model defines what is universally true about healthcare entities across all jurisdictions. Jurisdiction-specific, specialty-specific, and organization-specific requirements are accommodated via a formal extension model. Extensions are additive, not substitutive.

**Implication:** Australia-specific patient identifiers, US billing codes, and UK NHS number fields are extensions — not changes to the core model. Core fields must remain valid and meaningful outside any specific jurisdiction.

### 3.5 Exchange Is Not Storage

Data exchanged via this API may be richer, more normalized, or differently shaped than data as stored in any system. The API layer is a semantic presentation layer. Systems receiving this data are responsible for their own persistence decisions. This standard governs the contract at the boundary, not what happens on either side of it.

**Implication:** Computed fields, denormalized references, and synthetic aggregations are all valid in API responses, provided they conform to the canonical shape and are semantically accurate.

### 3.6 Governance Is Part of the Standard

The processes by which this standard changes are as important as the standard itself. An undocumented change to a canonical type, even a well-intentioned one, is a governance violation. The change process is mandatory, not advisory. Breaking changes without a ratified migration path do not ship.

**Implication:** All changes to canonical entities, terminology bindings, identifier policy, or security classifications require a documented proposal, review, and approval before any implementation reflects them.

---

## 4. Technology Stack

The foundation uses a defined, opinionated technology pipeline. Each layer serves a distinct purpose.

```
TypeSpec definitions
       |
       v
OpenAPI 3.0 specification (generated, not hand-authored)
       |
       v
TypeScript types (generated from OpenAPI)
       |
       v
Zod validators (generated from TypeScript types)
       |
       v
Application code (consumes types and validators)
```

| Layer | Tool | Responsibility | Authorship |
|---|---|---|---|
| Source of truth | TypeSpec | Define canonical shapes, semantics, operations | Hand-authored by Standards team |
| API contract | OpenAPI 3.0 | Machine-readable exchange contract | Generated from TypeSpec |
| Type safety | TypeScript types | Compile-time correctness in consuming code | Generated from OpenAPI |
| Runtime validation | Zod schemas | Runtime boundary enforcement | Generated from TypeScript types |
| Application logic | Consumer code | Business logic, persistence, presentation | Authored by product teams |

**Critical constraint:** Product teams consume generated artifacts. They do not author TypeSpec, OpenAPI specs, or Zod schemas for canonical entities. Hand-authoring downstream layers for canonical entities is a governance violation and creates drift.

---

## 5. Ownership Model

### 5.1 Roles and Responsibilities

| Role | Responsibilities | Decision Authority |
|---|---|---|
| **Standards Lead** | Overall direction, cross-cutting decisions, charter maintenance | Final approval on breaking changes and charter amendments |
| **Domain Modeling Lead** | Entity catalog, relationship modeling, lifecycle definitions | Approval authority for new entities and field additions |
| **Terminology Lead** | Code system bindings, value set governance, SNOMED/LOINC/RxNorm alignment | Approval authority for terminology binding changes |
| **API / Interop Lead** | OpenAPI generation pipeline, FHIR alignment, exchange patterns | Approval authority for operation shapes and versioning decisions |
| **Security / Privacy Lead** | Data classification, consent model, sensitive field governance | Veto authority on any change that weakens data protection |
| **Governance Coordinator** | Proposal tracking, meeting facilitation, release coordination | No technical approval authority; process authority only |
| **Specialty Reviewers** | Domain-specific clinical review (e.g., dental, radiology, mental health) | Advisory; mandatory consultation for specialty domain changes |

### 5.2 Quorum and Decision Making

- **Routine changes** (non-breaking field additions, documentation updates): Standards Lead + Domain Modeling Lead
- **Terminology changes**: Standards Lead + Terminology Lead + Domain Modeling Lead
- **Breaking changes**: Full committee quorum (all named leads, excluding Specialty Reviewers unless relevant domain is affected)
- **Charter amendments**: Full committee + majority of active Specialty Reviewers

### 5.3 Conflict Resolution

When leads cannot reach consensus:

1. The proposal is returned to the author with written objections
2. The author may revise and resubmit within 30 days
3. If consensus is still not reached, the Standards Lead makes the binding decision with written rationale
4. Any lead may escalate to the governing organization's technical board within 14 days of a Standards Lead decision

---

## 6. Change Governance Process

All changes to canonical artifacts (entities, fields, terminology bindings, identifier policy, security classifications) follow this process.

### 6.1 Change Categories

| Category | Definition | Examples |
|---|---|---|
| **Non-breaking additive** | New optional fields, new entities, new value set members | Adding `preferredLanguage` to Patient |
| **Non-breaking clarification** | Documentation updates, description corrections, example changes | Clarifying the definition of `Encounter.status` |
| **Breaking — field** | Removing a field, changing a field's type, renaming a field | Removing `Patient.homeAddress` |
| **Breaking — entity** | Removing an entity, merging entities, splitting entities | Merging `Slot` into `Schedule` |
| **Breaking — operation** | Changing required parameters, changing response shape | Making `encounterId` required on Observation |
| **Breaking — terminology** | Changing a Required binding to a different code system | Switching CVX to SNOMED for vaccine codes |

### 6.2 Process Steps

```
1. PROPOSAL
   Author submits a Change Proposal document (CPD) to the governance tracker.
   CPD must include: motivation, proposed change, affected entities, migration path,
   rollback plan, and affected downstream consumers (if known).

2. TRIAGE (within 5 business days)
   Governance Coordinator assigns category and routes to relevant leads.
   Breaking changes are flagged for full committee review.

3. REVIEW (timeline varies by category)
   Non-breaking additive:    5 business days
   Non-breaking clarification: 3 business days
   Breaking:                 15 business days
   Breaking — entity:        30 business days

4. APPROVAL
   Leads record approval or rejection with written rationale.
   Approved proposals receive a Change Record number (CR-NNNN).

5. IMPLEMENTATION
   Standards team authors TypeSpec changes.
   Pipeline generates downstream artifacts.
   Implementation branch is reviewed against the approved CPD.

6. RELEASE
   Changes are assigned to a release milestone.
   Non-breaking changes: next minor release.
   Breaking changes: next major release, with deprecation notice issued
   minimum 90 days before the major release.
```

### 6.3 Emergency Changes

For patient safety or critical security issues, the Standards Lead may authorize an expedited review (24-hour turnaround). Emergency changes must still complete all process steps; the timeline is compressed, not bypassed.

---

## 7. FHIR Alignment Strategy

### 7.1 Positioning: FHIR-Informed, Not FHIR-Constrained

This foundation is **FHIR R4-informed**. We adopt FHIR's conceptual model, naming conventions, and code system selections where they serve our goals. We do not adopt FHIR's REST API conventions, bundle formats, or resource server expectations.

| We adopt from FHIR R4 | We do not adopt from FHIR R4 |
|---|---|
| Resource names and field names | FHIR REST API (`/Patient/{id}`, bundles, `_include`) |
| Identifier model (`system` + `value` + `assigner`) | FHIR server capability statements |
| Terminology bindings (SNOMED, LOINC, RxNorm, CVX) | FHIR operations (`$everything`, `$validate`) |
| Reference model (typed references between resources) | FHIR subscription and notification model |
| Coding model (`code` + `system` + `display`) | FHIR profiles and StructureDefinitions |
| Lifecycle states (where applicable) | FHIR search parameter conventions |
| Core data types (Period, Range, Quantity, Ratio) | FHIR narrative (`.text.div` HTML blobs) |

### 7.2 Named Divergences

The following are documented, intentional divergences from FHIR R4:

| Area | FHIR R4 Approach | Our Approach | Rationale |
|---|---|---|---|
| Identifiers | `identifier[]` with `use`, `type`, `system`, `value` | Same structure; `type` uses our extended value set | Superset of FHIR; backwards-compatible |
| References | `reference` string (URL or relative) | Typed reference object with `id` + `resourceType` | Stronger type safety in generated TypeScript |
| Extensions | `extension[]` FHIR extension mechanism | Named extension namespaces in TypeSpec | Legibility and type-safety of extensions |
| Contained resources | `contained[]` in-bundle resources | Not supported; all references are by ID | Simplicity; contained resources are an anti-pattern for our use cases |
| Date/time | FHIR dateTime string formats | ISO 8601 strict; full precision required | Eliminates partial date ambiguity |
| Narrative | `.text` with `status` + `div` HTML | Not included | Not an exchange concern at this layer |

### 7.3 FHIR Translation Layer

Implementations that need to exchange data with FHIR-native systems (EHR FHIR endpoints, national health record systems) are responsible for providing a **FHIR translation layer**. The translation layer maps our canonical models to FHIR R4 resources and back. This layer is outside the scope of this foundation but is documented in the Interoperability Playbook.

---

## 8. Versioning Policy

### 8.1 Semantic Versioning

The foundation follows semantic versioning (`MAJOR.MINOR.PATCH`).

| Increment | Trigger |
|---|---|
| `PATCH` | Documentation corrections, description clarifications, example updates |
| `MINOR` | Non-breaking additive changes (new optional fields, new entities) |
| `MAJOR` | Breaking changes (field removal, type changes, entity removal) |

### 8.2 Deprecation Policy

- Fields and entities may be marked `@deprecated` in TypeSpec before removal
- Minimum deprecation period before removal: **90 days** (non-breaking -> breaking transition)
- Deprecated items are removed only in `MAJOR` releases
- Consumers receive written notification at deprecation and again 30 days before removal

### 8.3 Compatibility Guarantees

- Consumers pinned to a `MAJOR` version are guaranteed no breaking changes within that major version
- `MINOR` releases are backward-compatible; consumers are encouraged to update
- `PATCH` releases contain no semantic changes; consumers should apply transparently

---

## 9. Governance Artifact Registry

All governance artifacts are stored and versioned in this repository under `specs/api/docs/standards/`:

| Artifact | File | Description |
|---|---|---|
| This charter | `standards-charter.md` | Mission, principles, process |
| Entity catalog | `entity-catalog.md` | All canonical entities |
| Standards crosswalk | `standards-crosswalk.md` | FHIR, OMOP, openEHR, DICOM mappings |
| Terminology bindings | `terminology-bindings.md` | Code system binding rules |
| Identifier policy | `identifier-policy.md` | ID strategy and merge rules |
| Change records | `change-records/CR-NNNN.md` | Individual approved change records |
| ADRs | `adr/ADR-NNNN.md` | Architecture decision records |

---

*This charter supersedes all prior informal agreements, Slack messages, and meeting notes regarding API standards governance. When in doubt, this document governs.*
