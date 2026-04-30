# Healthcare API Standards-Alignment Audit
## Monobase Labs HealthcareAPI Spec

**Generated**: April 2026
**Scope**: Comprehensive audit of FHIR conformance, standards implementation, and global-grade foundation requirements.

---

## EXECUTIVE SUMMARY

The Monobase Labs healthcare API specification has **strong foundations** with FHIR R4 alignment at the data model level (primitives, core resources) but **lacks critical standards artifacts** required for:
- FHIR-level conformance and interoperability certification
- Production-grade global health data exchange
- Regulatory compliance (GDPR, HIPAA, EHDS)
- Cross-border and secondary use of health data

**Missing Critical Artifacts:**
1. CapabilityStatement (system capability declaration)
2. StructureDefinitions for custom profiles
3. Implementation Guide (IG) for publishing and standardization
4. Terminology service integration (ValueSets, CodeSystems)
5. Formal security/consent/audit frameworks
6. Conformance testing suite
7. FHIR validation pipeline
8. Data provenance standards alignment
9. Document standards (CDA/C-CDA) integration
10. Cross-border/IPS support

---

## 1. FHIR CONFORMANCE FRAMEWORK

### 1.1 Current State

**What Exists:**
- FHIR R4 data models in TypeSpec (primitives.tsp)
- HealthcareBaseEntity extending BaseEntity
- FHIR-aligned enums (IdentifierUse, NameUse, ContactSystem, etc.)
- Support for Coding, CodeableConcept, Reference, Period, Quantity, Identifier, HumanName, ContactPoint, Annotation, Attachment, Timing, Dosage, Money, Extension

**Locations:**
- `/specs/api/src/healthcare/core/primitives.tsp` - Core FHIR data types
- `/specs/api/src/healthcare/support/consent.tsp` - Consent support
- `/specs/api/src/healthcare/support/provenance.tsp` - Provenance support
- `/specs/api/src/healthcare/clinical/*` - Clinical resources
- `/specs/api/src/healthcare/administrative/*` - Administrative resources

**What's Missing:**
- CapabilityStatement resource
- StructureDefinitions for API-specific profiles
- Conformance testing declarations
- FHIR validation integration
- Formal conformance rules documentation

### 1.2 Conformance vs. Informed: Critical Distinction

**FHIR Conformance** means:
- A system declares that it fully implements specific FHIR resources and operations
- The system MUST publish a CapabilityStatement describing its capabilities
- The system can be tested against a conformance test suite
- Systems that claim conformance MAY be certified by third parties
- Critical for healthcare interoperability and regulatory compliance

**FHIR Informed** means:
- A system is inspired by FHIR concepts and patterns
- Implementation is not formally declared or testable
- No CapabilityStatement is published
- Useful for smaller/bespoke applications but limits interoperability

**Your Current Position**: FHIR-**Informed** (good foundation, but no formal conformance pathway)

### 1.3 Required CapabilityStatement

**What is it?**
A FHIR CapabilityStatement resource declares what FHIR resources, operations, and search parameters a FHIR server supports.

**What should be in yours?**
```
CapabilityStatement for Monobase Healthcare API should declare:
- Software name/version
- FHIR Version: 4.0.1 (R4)
- Kind: instance (operational server)
- Implementation Status: not-under-test | pilot | live

Supported Resources:
- Patient (from Patient module)
- Encounter (from Encounter module)
- MedicationRequest (from Medication module)
- Observation (from Observation module)
- Condition (from Condition module)
- Procedure (from Procedure module)
- ServiceRequest (from ServiceRequest module)
- Consent (from Consent module)
- Provenance (from Provenance module)
- Composition (from Composition module)
- DocumentReference (from DocumentReference module)
- [... etc for all 40+ resources implemented]

Operations:
- $validate (validate resources against profiles)
- $search (search with filters)
- $everything (fetch patient's complete record - with security controls!)
- Custom operations specific to Monobase

Security:
- SMART on FHIR OAuth 2.0
- Mutual TLS support
- Role-based access control (admin, clinician, patient:owner)

Search Parameters:
- Standard FHIR search params (patient, date, status, etc.)
```

**Location to Create:**
- `/specs/api/src/healthcare/foundation/capability-statement.tsp` (new)
- Generated via API and served at `/metadata` endpoint (FHIR standard)
- Should be auto-generated from TypeSpec definitions or published manually

**Tools:**
- HAPI FHIR can auto-generate from Spring configuration
- Firely Server can publish from server capabilities
- Manual definition in TypeSpec

### 1.4 StructureDefinitions for Custom Profiles

**What are they?**
StructureDefinitions are FHIR resources that define constraints and extensions on base FHIR resources. They enable:
- Defining organization-specific constraints (e.g., "PatientIdentifier MUST have MRN system")
- Adding custom extensions (e.g., "patient-preferred-language")
- Creating reusable profiles for specific use cases
- Enabling validation against your constraints

**Your Situation:**
You've defined custom models in TypeSpec (e.g., `Consent`, `Provenance`, `Observation`). These need to be:
1. **Mapped to FHIR StructureDefinitions** so external systems understand your constraints
2. **Published as part of an Implementation Guide** (see Section 3)
3. **Made available for validation** in your FHIR server

**Example: MonobaseCorePatient Profile**
```
StructureDefinition:
  Title: Monobase Core Patient
  Description: Base patient profile for Monobase platform
  Constraints:
    - identifier: MUST have at least one identifier with system starting with "http://monobase.io/"
    - contact: Telecom SHOULD include mobile phone number
    - birthDate: SHOULD be present for age-related functionality

Extensions:
  - preferred-language: Extension for patient language preference
  - care-coordinator: Extension referencing assigned care coordinator
  - insurance-member-id: Extension for insurance integration
```

**What to Create:**
- One StructureDefinition per major resource you've customized
- Locations: `/specs/api/src/healthcare/{domain}/{resource-name}-profile.fsh` (using FHIR Shorthand)
- Files needed:
  - `Patient-profile.fsh`
  - `Encounter-profile.fsh`
  - `Consent-profile.fsh`
  - `Observation-profile.fsh`
  - `MedicationRequest-profile.fsh`
  - `Composition-profile.fsh`
  - `DocumentReference-profile.fsh`
  - etc.

**Tools:**
- FHIR Shorthand (FSH) - most maintainable
- Manual XML/JSON definition
- Firely Forge (visual tool)
- Eclipse Modeling Framework

---

## 2. STANDARDS CONFORMANCE TESTING

### 2.1 Current State

**What Exists:**
- Basic API endpoint tests (likely in `/services/api/src/__tests__/`)
- TypeScript type safety
- No formal FHIR conformance testing

**What's Missing:**
- FHIR conformance test suite
- Automated validation of FHIR resources against profiles
- Interoperability testing
- Formal test results/certification

### 2.2 Testing Tools Landscape

| Tool | Purpose | Cost | Good For |
|------|---------|------|----------|
| **Inferno** | Open conformance testing framework | Free | Building custom conformance tests; ONC certification paths |
| **Touchstone** | FHIR TestScript engine | Free/Commercial | Running pre-built test scripts; vendor certification |
| **Gazelle** | IHE test bed & validation | Free | IHE profile testing; complex interop scenarios |
| **Simplifier** | Validation service | Freemium | Quick validation of individual resources |
| **FHIR Validator** (java) | Standalone validator | Free | Command-line validation; CI/CD integration |
| **Firely Validator** | .NET validator | Freemium | Validation via web service or library |
| **Aidbox** | FHIR Schema Validator | Freemium | Schema validation; Clojure-based |
| **Conformancelab** | Self-hosted testing environment | Freemium | Organizations wanting their own certification lab |

### 2.3 Recommended Testing Strategy for Monobase

**Phase 1: Self-Testing (Months 1-3)**
1. Deploy FHIR Validator (java tool) in your CI/CD pipeline
   ```bash
   # Validate all generated FHIR resources during build
   java -jar fhir-validator.jar <resource.json> -profile <profile-url>
   ```
2. Implement $validate endpoint in your API
   ```typescript
   // services/api-ts/src/handlers/healthcare/validate.ts
   POST /healthcare/validate
   - Input: FHIR resource + profile URL
   - Uses: FHIR Validator library or terminology service
   - Output: OperationOutcome with validation issues
   ```
3. Create conformance test suite (Node/Bun)
   ```typescript
   // Test that Encounter resources conform to your profile
   test('Encounter conforms to MonobaseEncounter profile', async () => {
     const encounter = await getEncounter('123');
     const result = await validateAgainstProfile(encounter, 'http://monobase.io/Encounter');
     expect(result.passed).toBe(true);
   });
   ```

**Phase 2: Inferno-based Testing (Months 4-6)**
1. Write Inferno test suite targeting your custom profiles
   ```ruby
   # test_definitions/patient_test.rb
   describe 'Monobase Patient Profile' do
     it 'returns a conformant Patient' do
       response = @client.read(FHIR::Patient, @patient_id)
       assert_valid_resource(response.resource, MonobasePatient)
     end
   end
   ```
2. Publish on Inferno framework or self-host
3. Use for vendor/partner certification

**Phase 3: Interoperability Testing (Months 7-12)**
1. Test against Gazelle scenarios (IHE profiles)
2. Participate in FHIR Connectathons
3. Seek independent certification (optional but valuable)

### 2.4 What Conformance Tests Should Cover

**Core Tests:**
- ✓ All custom profiles validate correctly
- ✓ CapabilityStatement is accurate
- ✓ All declared endpoints work as specified
- ✓ Search parameters function correctly
- ✓ Pagination works (if implemented)
- ✓ Validation endpoint ($validate) works
- ✓ Error responses conform to OperationOutcome
- ✓ Authentication/authorization work (SMART on FHIR)
- ✓ Security headers present (CORS, CSP, etc.)
- ✓ Terminology operations work ($expand, $validate-code, $lookup)

**Extended Tests:**
- Bulk data export security
- Break-glass access logging
- Consent enforcement
- Audit logging completeness
- Provenance chain integrity

---

## 3. IMPLEMENTATION GUIDE (IG) PUBLISHING

### 3.1 Current State

**What Exists:**
- TypeSpec definitions scattered across `/specs/api/src/healthcare/`
- No unified IG documentation
- No published artifacts for external systems

**What's Missing:**
- Formal FHIR Implementation Guide
- Unified documentation website
- Published profiles and extensions
- Dependencies declared
- Use case documentation
- Examples and test data
- Integration patterns

### 3.2 What is a FHIR Implementation Guide?

An **Implementation Guide (IG)** is a comprehensive package that includes:

1. **Documentation** (web-published)
   - Overview and use cases
   - Security/privacy considerations
   - Implementation patterns
   - Workflow diagrams

2. **Artifacts** (FHIR resources)
   - StructureDefinitions (profiles/extensions)
   - ValueSets (enumerated lists of codes)
   - CodeSystems (terminology definitions)
   - ConceptMaps (mappings between code systems)
   - OperationDefinitions (custom operations)
   - CapabilityStatement (server capabilities)
   - Examples (test data)

3. **Metadata**
   - Dependencies on other IGs
   - Maturity level (Draft, Trial Use, Normative)
   - Conformance expectations
   - Versioning and release notes

**Why You Need One:**
- External systems (partners, regulators) need to know what you've built
- Enables certification and compliance verification
- Facilitates interoperability with other FHIR systems
- Provides a standard way to share your data model
- Required for GDPR/HIPAA compliance documentation

### 3.3 Publishing Options

**Option A: HL7 IG Publisher (Recommended for Healthcare)**
- **Cost**: Free
- **Hosting**: GitHub Pages (free) or your own server
- **Tools**: IG Publisher (Java), SUSHI (TypeScript)
- **Workflow**:
  ```
  1. Define profiles in FHIR Shorthand (FSH) or XML
  2. Run SUSHI to compile FSH → FHIR JSON
  3. Run IG Publisher to generate HTML documentation
  4. Publish to GitHub Pages or your server
  ```
- **Good For**: Standards-aligned, widely recognized, best interop
- **Examples**: US Core, IPS, Da Vinci profiles

**Option B: Firely Simplifier.net (Commercial but Integrated)**
- **Cost**: Freemium (~$200-500/month for enterprise)
- **Hosting**: Simplifier.net (included)
- **Tools**: Integrated profile editor, auto-publishing, social collaboration
- **Good For**: Teams wanting visual editor and collaboration
- **Trade-off**: Less control, vendor lock-in potential

**Option C: Custom Documentation (Not Recommended)**
- **Cost**: Development time
- **Hosting**: Your own server
- **Good For**: Internal use only
- **Trade-off**: Not FHIR-compliant, hard to integrate with external systems

### 3.4 Recommended IG Structure for Monobase

```
monobase-healthcare-ig/
├── input/
│   ├── fsh/                          # FHIR Shorthand definitions
│   │   ├── profiles/
│   │   │   ├── patient.fsh
│   │   │   ├── encounter.fsh
│   │   │   ├── consent.fsh
│   │   │   ├── provenance.fsh
│   │   │   ├── observation.fsh
│   │   │   ├── composition.fsh
│   │   │   └── [... all resources]
│   │   ├── extensions/
│   │   │   ├── preferred-language.fsh
│   │   │   ├── care-coordinator.fsh
│   │   │   └── [custom extensions]
│   │   ├── value-sets/
│   │   │   ├── encounter-types.fsh
│   │   │   ├── condition-codes.fsh
│   │   │   └── [terminology]
│   │   └── code-systems/
│   │       ├── monobase-identifiers.fsh
│   │       └── [custom code systems]
│   ├── examples/
│   │   ├── Patient-example.json
│   │   ├── Encounter-example.json
│   │   └── [test data]
│   ├── pagecontent/
│   │   ├── index.md                # Home page
│   │   ├── use-cases.md            # Use case descriptions
│   │   ├── security.md             # Security & privacy
│   │   ├── consent-management.md   # Consent workflows
│   │   ├── audit.md                # Audit requirements
│   │   ├── terminology.md          # Terminology bindings
│   │   ├── implementation.md       # How to implement
│   │   └── downloads.md            # Download artifacts
│   └── ig.ini                       # IG Publisher config
├── fsh-generated/                   # Generated by SUSHI
├── output/                          # Generated HTML by IG Publisher
└── README.md
```

### 3.5 Step-by-Step: Create Your IG

**Step 1: Set Up Project (2-3 hours)**
```bash
# Install tools
npm install -g fsh-sushi
npm install -g hl7.fhir.publisher

# Initialize FSH project
mkdir monobase-healthcare-ig
cd monobase-healthcare-ig
sushi init
```

**Step 2: Convert TypeSpec → FSH (1-2 weeks)**
```fsh
// input/fsh/profiles/patient.fsh
Profile: MonobasePatient
Parent: Patient
Id: monobase-patient
Title: "Monobase Patient"
Description: "Patient profile for Monobase platform"

* identifier ^slicing.discriminator.type = #value
* identifier ^slicing.discriminator.path = "system"
* identifier ^slicing.rules = #openAtEnd
* identifier contains
    mrn 0..1 and
    ssn 0..1

* identifier[mrn].system = "http://monobase.io/mrn" (exactly)
* identifier[mrn].value 1..1
* identifier[mrn].use = #official

* contact.telecom ^slicing.discriminator.type = #value
* contact.telecom ^slicing.discriminator.path = "system"
* contact.telecom contains
    mobile 1..1 and
    email 0..1

* contact.telecom[mobile].system = #phone
* contact.telecom[mobile].use = #mobile
```

**Step 3: Define Terminology (1 week)**
```fsh
// input/fsh/value-sets/encounter-types.fsh
ValueSet: MonobaseEncounterType
Id: monobase-encounter-type
Title: "Monobase Encounter Types"
* EncounterType#E ("Encounter")
* EncounterType#EMER ("Emergency")
* EncounterType#INPTATION ("Inpatient")

CodeSystem: MonobaseEncounterStatus
Id: monobase-encounter-status
* #pending "Scheduled but not started"
* #arrived "Patient has arrived"
* #completed "Encounter has finished"
```

**Step 4: Create Documentation Pages (2 weeks)**
```markdown
# input/pagecontent/index.md
# Monobase Healthcare API Implementation Guide

Welcome to the Monobase Healthcare API IG, version 1.0.0.

## Overview
The Monobase Healthcare API provides FHIR R4-compliant access to electronic health records...

## Key Profiles
- [MonobasePatient](StructureDefinition-monobase-patient.html)
- [MonobaseEncounter](StructureDefinition-monobase-encounter.html)
- [MonobaseConsent](StructureDefinition-monobase-consent.html)
```

**Step 5: Generate and Publish (1 week)**
```bash
# Compile FSH
sushi .

# Generate IG
./publish.sh

# Result: output/ contains published HTML
# Deploy to GitHub Pages
git add output/
git commit -m "Publish IG v1.0.0"
git push origin gh-pages
```

### 3.6 IG Publishing Timeline

| Phase | Duration | Activities |
|-------|----------|------------|
| **Planning** | 1-2 weeks | Define scope, maturity level, dependencies |
| **Profile Development** | 4-6 weeks | Convert all TypeSpec → FSH profiles |
| **Examples & Documentation** | 2-4 weeks | Create use cases, examples, integration guides |
| **Testing & Validation** | 2-3 weeks | Test all profiles, validate examples |
| **Publishing** | 1 week | Generate, review, deploy |
| **Total** | 10-16 weeks | ~2-4 months for complete v1.0 IG |

**Ongoing (Post-Launch):**
- Maintenance (1-2 hours/week)
- Version updates and bug fixes
- Community feedback incorporation

---

## 4. TERMINOLOGY SERVICES

### 4.1 Current State

**What Exists:**
```typespec
// specs/api/src/healthcare/core/terminology.tsp
- Coding (term system + code)
- CodeableConcept (multiple codings + text)
- Timing, DoseAndRate, Dosage (UCUM units)
```

**What's Missing:**
- Terminology server (ValueSets, CodeSystems)
- FHIR operations: $expand, $validate-code, $lookup
- Binding ValueSets to elements
- Terminology validation in API
- Code system mappings (ICD-10, SNOMED CT, LOINC, RxNorm)

### 4.2 FHIR Terminology Operations

**$expand** - Get all codes in a ValueSet
```
GET /fhir/ValueSet/$expand?url=http://monobase.io/vs/encounter-type
Response:
{
  "resourceType": "ValueSet",
  "expansion": {
    "total": 10,
    "contains": [
      {
        "system": "http://monobase.io/cs/encounter-type",
        "code": "OUTPATIENT",
        "display": "Outpatient Visit"
      },
      ...
    ]
  }
}
```

**$validate-code** - Check if a code is valid in a ValueSet
```
GET /fhir/ValueSet/$validate-code?url=...&code=OUTPATIENT&system=...
Response:
{
  "resourceType": "OperationOutcome",
  "parameter": [
    {
      "name": "result",
      "valueBoolean": true
    },
    {
      "name": "display",
      "valueString": "Outpatient Visit"
    }
  ]
}
```

**$lookup** - Get details about a code
```
GET /fhir/CodeSystem/$lookup?system=http://loinc.org&code=8867-4
Response:
{
  "resourceType": "OperationOutcome",
  "parameter": [
    {
      "name": "name",
      "valueString": "Heart rate"
    },
    {
      "name": "definition",
      "valueString": "The number of times the heart beats per minute"
    }
  ]
}
```

### 4.3 Implementation Approach

**Option A: Lightweight - ValueSet Registry (Recommended for MVP)**
```typescript
// services/api-ts/src/handlers/healthcare/terminology/repos/value-set.repo.ts
export class ValueSetRepository {
  async getValueSet(url: string): Promise<ValueSet> {
    // Return ValueSet definition for binding validation
  }

  async validateCode(
    url: string,
    code: string,
    system: string
  ): Promise<ValidationResult> {
    // Check if code exists in ValueSet
  }

  async expandValueSet(url: string): Promise<ValueSetExpansion> {
    // Return all codes in ValueSet
  }
}

// services/api-ts/src/handlers/healthcare/terminology/terminology.handler.ts
@post("/terminology/$validate-code")
async validateCode(@body req: ValidateCodeRequest): Promise<OperationOutcome> {
  const isValid = await valueSetRepo.validateCode(
    req.valueSet,
    req.code,
    req.system
  );
  return {
    resourceType: "OperationOutcome",
    issue: [{
      severity: isValid ? "success" : "error",
      code: isValid ? "processing" : "invalid",
      details: {
        text: isValid ? "Code is valid" : "Code not found in ValueSet"
      }
    }]
  };
}
```

**Option B: Full Terminology Server (Long-term)**
- Deploy dedicated server: Firely Server, OntoServer, or Aidbox
- Integrate with your API via proxy
- Connect to external code system servers (SNOMED CT, LOINC, RxNorm)
- Supports complex queries and concept hierarchies

### 4.4 Terminology Bindings for Your Profiles

Each element in your profiles should have a ValueSet binding:

```fsh
// input/fsh/profiles/encounter.fsh
Profile: MonobaseEncounter
Parent: Encounter

* type from MonobaseEncounterType (extensible)
  // Users can use codes from MonobaseEncounterType OR other systems

* status from EncounterStatus (required)
  // Users MUST use codes from EncounterStatus

* reasonCode from ICD10DiagnosisCodes (preferred)
  // Recommended to use ICD-10 codes, but others allowed
```

### 4.5 Recommended ValueSets to Define

```
For Monobase Healthcare API:

Clinical:
- EncounterTypes (outpatient, inpatient, emergency, virtual, etc.)
- EncounterStatus (planned, arrived, triaged, in-progress, onleave, finished, cancelled)
- ConditionStatus (active, recurrence, relapse, remission, resolved, unknown)
- ObservationStatus (registered, preliminary, final, amended, cancelled, entered-in-error, unknown)
- ProcedureStatus (preparation, in-progress, not-done, on-hold, stopped, completed, entered-in-error, unknown)

Administrative:
- InsuranceStatus (active, cancelled, draft, entered-in-error)
- ClaimStatus (active, cancelled, draft, entered-in-error)
- AuthorizationStatus (auth-pending, authorized, denied, pending-response)

Consent:
- ConsentScope (treatment, payment, operations, research, patientPrivacy)
- ConsentCategory (adr, dnr, emrgonly, hiv, psychotherapy, sab, sop, mental)

Audit:
- AuditEventType (create, read, update, delete, execute)
- AuditEventAction (C, R, U, D, E)
- AuditEventOutcome (0 (success), 4 (minor failure), 8 (serious failure), 12 (major failure))
```

---

## 5. CONSENT MANAGEMENT STANDARDS

### 5.1 Current State

**What Exists:**
```typespec
// specs/api/src/healthcare/support/consent.tsp
- Consent resource (FHIR R4 aligned)
- ConsentStatus enum
- ConsentProvisionType (deny/permit)
- ConsentDataMeaning (instance/related/dependents/authoredby)
- ConsentProvision with actor, action, securityLabel, purpose, class, code
- CRUD endpoints
```

**Mapping to Standards:**
- ✓ FHIR Consent resource (covers treatment/research)
- ✓ Policy references (for regulations)
- ✓ Verification tracking
- ✗ HIPAA-specific requirements (see below)
- ✗ GDPR-specific requirements (see below)
- ✗ Granular consent enforcement in API
- ✗ Consent audit trail

### 5.2 Standards Comparison

| Aspect | FHIR Consent | HIPAA Authorization | GDPR Consent |
|--------|--------------|-------------------|--------------|
| **Purpose** | General clinical consent framework | PHI disclosure authorization | Personal data processing authorization |
| **Key Elements** | scope, category, provision, verification | specific date, time, entity, purpose, expiration | freely given, specific, informed, unambiguous, documented, withdrawable |
| **Required Info** | Patient, performer, organization, policy | Person/class disclosed to, data description, expiration | Data usage, recipient, legal basis, retention period |
| **Clinical Consent** | Treatment, research, advance directive | Not applicable | Not primary focus |
| **Regulatory Focus** | Interoperability | HIPAA Privacy Rule compliance | GDPR compliance |
| **Withdrawal** | Via status update | Via new authorization | Via explicit request |
| **Duration** | Via period field | Via expiration date | Until revoked + record retention rules |
| **Validation** | signature/verification | Authorized representative signature | Timestamp + documented consent proof |

### 5.3 What's Missing from Your Implementation

**1. HIPAA Authorization Requirements**

Your Consent should track:
```typescript
model HIPAAAuthorization extends Consent {
  // §164.508(c) Core Elements:

  // 1. Description of information to be used/disclosed
  disclosureDescription: string;  // ✓ in ConsentProvision.class/code

  // 2. Persons/class authorized to request disclosure
  authorizedRequesters: Reference[];  // ✓ in ConsentProvisionActor

  // 3. Persons/class to whom info will be disclosed
  disclosureRecipients: Reference[];  // ✓ in ConsentProvisionActor

  // 4. Description of purpose (treatment, payment, operations, etc.)
  purpose: CodeableConcept[];  // ✓ in ConsentProvision.purpose

  // 5. Expiration date (REQUIRED)
  expirationDate: utcDateTime;  // ✓ in ConsentProvision.period.end

  // 6. Signature + Date
  signatureBlock: Signature;  // ✗ MISSING

  // 7. Patient/representative name & date
  signatoryName: string;  // ✗ MISSING
  signatureDate: utcDateTime;  // ✗ MISSING

  // 8. Authorizing representative relationship to patient
  represenativeRelationship?: string;  // ✗ MISSING

  // 9. If authorization revoked, date of revocation
  revocationDate?: utcDateTime;  // ✗ MISSING (use status change instead?)

  // 10. Statement that individual may revoke (required text)
  revocationStatement: string;  // ✗ MISSING (could be in sourceAttachment)
}
```

**2. GDPR Consent Requirements**

Your Consent should track:
```typescript
model GDPRConsent extends Consent {
  // Article 7 - Conditions for Consent:

  // 1. Freely Given
  freelyGiven: boolean;  // ✗ MISSING
  noIncentive: boolean;  // ✗ MISSING - must not be condition of service

  // 2. Specific
  dataProcessingPurposes: string[];  // ✗ MISSING - must list each purpose separately
  dataCategories: string[];  // ✗ MISSING - must specify data types
  recipients: string[];  // ✗ MISSING - must list who receives data

  // 3. Informed (Article 13/14)
  privacyNoticeProvided: boolean;  // ✗ MISSING
  privacyNoticeUrl?: string;  // ✗ MISSING

  // 4. Unambiguous
  consentMethod: "button_click" | "checkbox" | "signature" | "explicit_action";  // ✗ MISSING
  consentRecipient: Reference;  // ✓ in performer

  // 5. Documented
  proofOfConsent: Attachment;  // ✓ in sourceAttachment

  // 6. Withdrawable (Article 7(3))
  withdrawalDate?: utcDateTime;  // ✗ MISSING
  withdrawalMethod: "email" | "form" | "api" | "signature";  // ✗ MISSING

  // Additional GDPR:
  consentVersion: string;  // ✗ MISSING - track consent versioning
  ipAddress: string;  // ✓ in verification.verificationDate context
  userAgent?: string;  // ✗ MISSING - track where given
}
```

**3. Consent Enforcement in API**

Your API should **check consent before processing data**:
```typescript
// services/api/src/core/consent-enforcer.ts
export class ConsentEnforcer {
  async checkConsent(
    patientId: string,
    action: "read" | "write",
    dataType: string,  // "encounter", "observation", "lab-result"
    requester: string,  // clinician ID
    purpose: "treatment" | "payment" | "operations" | "research"
  ): Promise<boolean> {
    // 1. Find active Consent for patient
    const consent = await consentRepo.findActiveConsent(patientId);

    // 2. Check if provision grants access for this action/purpose
    if (consent.status !== "active") return false;

    const provision = consent.provision;
    if (!provision) return false;

    // 3. Check provision type (permit vs deny)
    if (provision.type === "deny") {
      // Check if action matches denied actions
      const deniedActions = provision.action?.map(a => a.code);
      if (deniedActions?.includes(action)) return false;
    }

    if (provision.type === "permit") {
      // Check if action is explicitly permitted
      const permittedActions = provision.action?.map(a => a.code);
      if (permittedActions && !permittedActions.includes(action)) return false;
    }

    // 4. Check period
    if (provision.period) {
      const now = new Date();
      if (provision.period.start > now || (provision.period.end && provision.period.end < now)) {
        return false;
      }
    }

    // 5. Check actor (is requester authorized?)
    if (provision.actor) {
      const authorizedActors = provision.actor
        .filter(a => a.role.coding?.some(c => c.code === "performer"))
        .map(a => a.reference.id);
      if (!authorizedActors.includes(requester)) return false;
    }

    // 6. Check purpose
    if (provision.purpose) {
      const permittedPurposes = provision.purpose.map(p => p.code);
      if (!permittedPurposes.includes(purpose)) return false;
    }

    return true;
  }
}

// Usage in handler:
@get("/{patientId}/encounters")
async getPatientEncounters(@path patientId: string, @header userId: string) {
  const hasConsent = await consentEnforcer.checkConsent(
    patientId,
    "read",
    "encounter",
    userId,
    "treatment"
  );

  if (!hasConsent) {
    throw new ForbiddenError(
      "No active consent to access this data"
    );
  }

  return await encounterRepo.findByPatient(patientId);
}
```

**4. Consent Audit Trail**

Track all consent changes:
```typescript
// Log consent creation, updates, and withdrawals
await auditLog.record({
  eventType: "consent_created",
  resourceType: "Consent",
  resourceId: consent.id,
  patientId: consent.patient.id,
  actor: userId,
  action: "create",
  timestamp: new Date(),
  details: {
    scope: consent.scope,
    category: consent.category,
    expirationDate: consent.provision?.period?.end
  }
});
```

### 5.4 Recommendations

**Immediate (v1):**
1. ✓ Keep current FHIR Consent structure
2. Add HIPAA Authorization fields:
   - Signature block (Signature element)
   - Expiration date (required)
   - Revocation date
   - Signatory name/relationship
3. Add GDPR tracking:
   - Consent method
   - IP address
   - User agent
   - Withdrawal mechanism
4. Implement ConsentEnforcer in all data access handlers

**Short-term (v2):**
1. Create StructureDefinition for HIPAAAuthorization profile
2. Create StructureDefinition for GDPRConsent profile
3. Build consent management UI with opt-in granularity
4. Publish consent management guide in IG

**Long-term (v3):**
1. Support dynamic consent (change permissions without full update)
2. Consent delegation (patients delegate to proxy)
3. Population health consent (consent for aggregate data)
4. Emergency access with consent override + logging

---

## 6. AUDIT STANDARDS

### 6.1 Current State

**What Exists:**
- Audit module (location: `/services/api-ts/src/handlers/audit/`)
- Pino structured logging
- Likely basic audit logging

**What's Missing:**
- IHE ATNA compliance
- FHIR AuditEvent resource
- Audit log retention/querying
- Break-glass access logging
- Consent violation logging
- Data export logging

### 6.2 IHE ATNA Standard

**What is it?**
IHE ATNA (Audit Trail and Node Authentication) is an IHE profile that defines:
- **Audit Trail**: Secure recording of security-relevant events
- **Node Authentication**: Systems authenticate each other with certificates
- **Syslog Format**: Standardized audit message format (RFC 3881, now managed by DICOM)
- **Transport**: TLS-secured syslog over TCP/IP

**Key Requirements:**
1. All actors must generate audit logs for security-relevant events
2. Logs must be tamper-evident (centralized syslog or signed)
3. Logs must include: actor, action, timestamp, resource, outcome, purpose
4. Logs must be retained (minimum 6 years typical)
5. Logs must be queryable and exportable
6. Node authentication via certificates (mutual TLS)

### 6.3 FHIR AuditEvent Resource

Your audit module should generate FHIR AuditEvent resources:

```typescript
// Model from /specs/api/src/healthcare/support/audit.tsp (if exists) or create:
model AuditEvent extends HealthcareBaseEntity {
  /** When the activity was recorded. */
  recorded: utcDateTime;

  /** Whether the event succeeded or failed. */
  outcome: AuditEventOutcome;  // 0=success, 4=minor, 8=serious, 12=major failure

  /** Description of the activity. */
  type: Coding;  // system: "http://terminology.hl7.org/CodeSystem/audit-event-type"

  /** Identifies the action taken (C/R/U/D/E). */
  action?: AuditEventAction;  // Create, Read, Update, Delete, Execute

  /** The purposeOfUse for this event. */
  purposeOfUse?: CodeableConcept[];  // TREAT, HPAYMT, HOPERAT, etc.

  /** The agent (person/system) that took the action. */
  agent: AuditEventAgent[];

  /** The data/resource that was accessed. */
  entity?: AuditEventEntity[];

  /** Describes the source of the event. */
  source: AuditEventSource;
}

enum AuditEventOutcome {
  success = "0",
  minorFailure = "4",
  seriousFailure = "8",
  majorFailure = "12"
}

enum AuditEventAction {
  create = "C",
  read = "R",
  update = "U",
  delete = "D",
  execute = "E"
}
```

### 6.4 What to Audit

**MUST Audit:**
- ✓ Patient data access (read Encounter, Observation, etc.)
- ✓ Data modifications (create, update, delete any clinical data)
- ✓ Authentication events (login, logout, failed auth)
- ✓ Authorization decisions (access granted/denied)
- ✓ Consent changes (create, update, withdraw)
- ✓ Break-glass access (emergency access with override)
- ✓ Data exports/downloads (bulk export, $export)
- ✓ Administrative actions (user suspension, role change)
- ✓ Potential security violations (repeated access denials, SQL injection attempts)

**SHOULD Audit:**
- API calls (if not too verbose)
- Configuration changes
- Password changes
- MFA registration/deregistration

### 6.5 Implementation

```typescript
// services/api-ts/src/handlers/healthcare/audit/audit.handler.ts
export class AuditHandler {
  async recordDataAccess(
    patientId: string,
    resourceType: string,
    action: "read" | "create" | "update" | "delete",
    actor: string,  // user ID
    purpose: "treatment" | "payment" | "operations" | "research",
    outcome: "success" | "failure"
  ): Promise<void> {
    const auditEvent: AuditEvent = {
      id: generateUUID(),
      recorded: new Date(),
      outcome: outcome === "success" ? "0" : "4",
      type: {
        system: "http://terminology.hl7.org/CodeSystem/audit-event-type",
        code: "REST",
        display: "RESTful Operation"
      },
      action: this.mapActionToCode(action),  // C, R, U, D
      purposeOfUse: [{
        system: "http://terminology.hl7.org/CodeSystem/v3-ActReason",
        code: purpose === "treatment" ? "TREAT" : "HPAYMT" // etc
      }],
      agent: [{
        type: { text: "User" },
        who: { reference: `Practitioner/${actor}` },
        requestor: true
      }],
      entity: [{
        what: { reference: `${resourceType}/${patientId}` },
        type: { code: resourceType }
      }],
      source: {
        observer: { reference: "Device/api-server-1" }
      }
    };

    // Store audit event
    await this.auditRepo.create(auditEvent);

    // Also log to syslog (for IHE ATNA compliance)
    this.syslogWriter.write(this.formatATNA(auditEvent));
  }
}

// Usage in Encounter handler:
@get("/{patientId}/encounters")
async getEncounters(@path patientId: string, @header authorization: string) {
  const userId = extractUserFromToken(authorization);

  // Check consent
  const hasConsent = await consentEnforcer.checkConsent(
    patientId, "read", "encounter", userId, "treatment"
  );

  if (!hasConsent) {
    // Audit the denial
    await auditHandler.recordDataAccess(
      patientId, "Encounter", "read", userId, "treatment", "failure"
    );
    throw new ForbiddenError("No consent");
  }

  // Audit the success
  await auditHandler.recordDataAccess(
    patientId, "Encounter", "read", userId, "treatment", "success"
  );

  return await encounterRepo.findByPatient(patientId);
}
```

### 6.6 Break-Glass Access Logging

```typescript
// Break-glass: emergency access that overrides consent
@post("/{patientId}/encounters/break-glass")
async getEncountersBreakGlass(
  @path patientId: string,
  @body { reason }: { reason: string }
) {
  const userId = extractUserId();

  // Check if user has break-glass privilege
  if (!await hasBreakGlassPrivilege(userId)) {
    throw new ForbiddenError("Break-glass access denied");
  }

  // SPECIAL: Log to break-glass audit trail (might be tamper-evident, encrypted)
  await auditHandler.recordBreakGlassAccess({
    patientId,
    actor: userId,
    reason,
    timestamp: new Date(),
    emergencyCode: generateEmergencyAccessCode(),
    // Notify security team
    notifySecurityTeam: true
  });

  return await encounterRepo.findByPatient(patientId);
}
```

---

## 7. SECURITY STANDARDS

### 7.1 Current State

**What Exists:**
```
- Better-Auth integration (authentication)
- Role-based access control (admin, clinician, patient:owner)
- Extension headers: x-security-required-roles
- Bearer token authorization
```

**What's Missing:**
- SMART on FHIR OAuth 2.0 scopes (patient/*.read, user/*.read, etc.)
- Mutual TLS support
- Certificate-based authentication
- $everything operation security controls
- $export operation security controls
- Break-glass emergency access mechanism
- Security policy documentation

### 7.2 SMART on FHIR Best Practices

**What is SMART on FHIR?**
SMART (Substitutable Medical Applications, Reusable Technologies) on FHIR is an open standard for healthcare APIs to:
1. Authenticate users via OAuth 2.0
2. Authorize apps via FHIR-specific scopes
3. Support EHR launch context
4. Enable patient-facing apps

**Your API should support:**

```typescript
// 1. OAuth 2.0 endpoints
GET /.well-known/smart-configuration  // SMART metadata
POST /oauth/authorize                  // Authorization endpoint
POST /oauth/token                      // Token endpoint
POST /oauth/revoke                     // Revocation endpoint

// 2. SMART-specific scopes for tokens
patient/Patient.read              // Patient can read own Patient
patient/Encounter.read            // Patient can read own Encounters
user/Encounter.read               // Any authenticated user can read all Encounters
system/Encounter.read             // Registered systems can read all Encounters
openid profile email              // Standard OpenID Connect scopes

// 3. Scope enforcement in API
@get("/{patientId}/encounters")
async getEncounters(@path patientId: string) {
  const token = extractToken();
  const scopes = parseScopes(token);

  // Patient accessing own data?
  if (token.sub === patientId) {
    if (!scopes.includes("patient/Encounter.read")) {
      throw new ForbiddenError("Missing patient/Encounter.read scope");
    }
  } else {
    // Clinician accessing another patient?
    if (!scopes.includes("user/Encounter.read")) {
      throw new ForbiddenError("Missing user/Encounter.read scope");
    }
  }

  return await encounterRepo.findByPatient(patientId);
}
```

**Implementation:** Add to CapabilityStatement
```
Capability Statement:
  authorization:
    - type: "OAuth2"
      endpoint: "https://api.monobase.io/oauth/authorize"
      tokenEndpoint: "https://api.monobase.io/oauth/token"
      revokeEndpoint: "https://api.monobase.io/oauth/revoke"

    scopes:
      - "patient/Patient.read"
      - "patient/Encounter.read"
      - "user/Patient.read"
      - "user/Encounter.read"
      - "system/Patient.read"
      - "system/Encounter.read"
```

### 7.3 Mutual TLS Certificate Authentication

For system-to-system communication (not recommended for all scenarios, but common in healthcare):

```typescript
// Configure Hono to require client certificates
app.use('*', async (c, next) => {
  const clientCert = c.req.headers.get('x-client-cert');

  if (!clientCert) {
    throw new Error("Client certificate required");
  }

  // Verify certificate
  const cert = parseCertificate(clientCert);
  if (!isValidCertificate(cert)) {
    throw new Error("Invalid certificate");
  }

  // Extract system ID from certificate
  c.set('systemId', cert.subject.CN);

  // Verify OAuth token is bound to certificate
  const token = extractBearerToken(c);
  const tokenCert = parseTokenCertificate(token);

  if (cert.fingerprint !== tokenCert.fingerprint) {
    throw new Error("Token not bound to certificate");
  }

  await next();
});
```

**Note:** Per SMART specs, mutual TLS is an option but may not be practical due to:
- Lack of client libraries
- Load balancer complexity (terminates TLS)
- Certificate management overhead

Better approach: OAuth with strong client authentication (asymmetric keys, UDAP).

### 7.4 $everything and $export Security Controls

**Problem:** These powerful operations can expose lots of data unintentionally.

**$everything Operation** - Fetch patient's complete record
```typescript
@get("/{patientId}/$everything")
async getPatientEverything(@path patientId: string) {
  const userId = extractUserId();

  // 1. Verify access to patient
  if (!await userHasAccessToPatient(userId, patientId)) {
    throw new ForbiddenError("No access to this patient");
  }

  // 2. Verify consent for this scope
  const hasConsent = await consentEnforcer.checkConsent(
    patientId, "read", "everything", userId, "treatment"
  );
  if (!hasConsent) {
    throw new ForbiddenError("No consent for $everything");
  }

  // 3. Exclude sensitive compartments
  // Don't include resources that reference multiple patients
  const everything = await encounterRepo.getPatientEverything(patientId);

  // Filter out:
  // - Group resources (may reference other patients)
  // - List resources (may reference other patients)
  // - Documents from other patients

  // 4. Audit the access
  await auditHandler.recordDataAccess(
    patientId, "Bundle", "read", userId, "treatment", "success"
  );

  return {
    resourceType: "Bundle",
    type: "searchset",
    entry: everything
  };
}
```

**$export Operation** - Bulk data export
```typescript
@post("/$export")
async bulkExport(@body { _type, _since, _outputFormat }: ExportRequest) {
  const userId = extractUserId();
  const systemId = c.get('systemId');  // From mTLS or OAuth client

  // 1. Verify authorization for bulk export
  const token = extractToken();
  if (!token.scopes.includes("system/Encounter.read")) {
    throw new ForbiddenError("Missing system scopes for bulk export");
  }

  // 2. Start async export job
  const jobId = generateUUID();
  const exportJob = {
    id: jobId,
    requester: systemId || userId,
    type: _type,
    since: _since,
    outputFormat: _outputFormat || "application/fhir+ndjson",
    startTime: new Date(),
    status: "in-progress"
  };

  await exportJobRepo.create(exportJob);

  // 3. Audit the export initiation
  await auditHandler.recordDataAccess(
    "", "Bundle", "read", userId, "research", "success"
  );

  // 4. Queue async job to:
  //    - Generate NDJSON file with all requested resources
  //    - Store in secure location (S3 with encryption)
  //    - Generate signed URLs with expiration
  //    - Clean up after expiration

  return {
    statusCode: 202,
    headers: {
      "Content-Location": `/bulkstatus/${jobId}`
    }
  };
}

@get("/bulkstatus/{jobId}")
async getBulkExportStatus(@path jobId: string) {
  const job = await exportJobRepo.get(jobId);

  if (job.status === "in-progress") {
    return { statusCode: 202, body: job };
  }

  if (job.status === "completed") {
    return {
      statusCode: 200,
      body: {
        transactionTime: job.completionTime,
        request: job.request,
        output: [
          {
            type: "Encounter",
            url: generateSignedUrl(job.encounterFile, expiresIn: "7d")
          },
          {
            type: "Observation",
            url: generateSignedUrl(job.observationFile, expiresIn: "7d")
          }
          // ... etc
        ],
        error: []
      }
    };
  }
}
```

### 7.5 Security Recommendations

**Immediate:**
1. Add SMART on FHIR scope enforcement
2. Document security requirements in IG
3. Implement audit logging for sensitive operations
4. Add $everything and $export security controls

**Short-term:**
1. Support mutual TLS option (for system-to-system)
2. Implement certificate pinning for partner integrations
3. Publish security policy in IG
4. Create security test suite

**Long-term:**
1. Support UDAP (Unified Data Authorization Protocol) - next-gen SMART
2. Implement HIPAA minimum necessary rules
3. Support dynamic consent with real-time enforcement
4. Implement data minimization for exports

---

## 8. DATA PROVENANCE STANDARDS

### 8.1 Current State

**What Exists:**
```typescript
// specs/api/src/healthcare/support/provenance.tsp
- Provenance resource
- ProvenanceActivityType (create, update, delete, access, transmit, verify, sign, amend, merge, deidentify, reidentify)
- ProvenanceAgentRole (author, performer, verifier, approver, custodian, assembler, informant, onBehalfOf)
- ProvenanceEntityRole (derivation, revision, quotation, source, removal)
- ProvenanceAgent and ProvenanceEntity models
```

**What's Missing:**
- W3C PROV mapping
- Provenance enforcement (creating Provenance on data changes)
- Data lineage querying
- Provenance in clinical documents
- Integration with Composition/Document workflow

### 8.2 W3C PROV Ontology

**What is it?**
W3C PROV is a formal ontology for representing provenance information:
- **Entity** - Things that were produced/used/refined (data, document, dataset)
- **Activity** - Things that occurred (process, operation, update)
- **Agent** - Things that caused activities (person, system, organization)

**Relationships:**
- Entity wasGeneratedBy Activity
- Activity wasInformedBy Activity
- Activity wasAssociatedWith Agent
- Entity wasAttributedTo Agent
- Entity wasDerivedFrom Entity
- Entity wasRevisionOf Entity

**Your FHIR Provenance maps to PROV:**
- FHIR Provenance.entity → PROV Entity
- FHIR Provenance.activity → PROV Activity
- FHIR Provenance.agent → PROV Agent
- FHIR Provenance.target → PROV Entity (generated)

### 8.3 Implementation

**1. Provenance on Resource Creation**

Whenever a clinical resource is created, generate a Provenance record:

```typescript
// services/api-ts/src/handlers/healthcare/clinical/encounter.handler.ts
@post("/encounters")
async createEncounter(@body encounter: Encounter) {
  const userId = extractUserId();

  // 1. Validate encounter
  const validation = await validateAgainstProfile(encounter);
  if (!validation.passed) {
    throw new BadRequestError(validation.issues);
  }

  // 2. Create encounter
  const created = await encounterRepo.create({
    ...encounter,
    createdAt: new Date(),
    createdBy: userId
  });

  // 3. Create provenance record
  const provenance: Provenance = {
    id: generateUUID(),
    target: [{
      reference: `Encounter/${created.id}`
    }],
    recorded: new Date(),
    activity: {
      code: "create",  // from ProvenanceActivityType
      system: "http://monobase.io/provenance-activity"
    },
    agent: [{
      role: "author",
      who: {
        resourceType: "Practitioner",
        id: userId
      }
    }],
    entity: []  // If based on other resources, list them
  };

  await provenanceRepo.create(provenance);

  return created;
}
```

**2. Provenance on Data Amendment**

When data is corrected (important for clinical accuracy):

```typescript
@put("/encounters/{id}")
async updateEncounter(@path id: string, @body updates: Partial<Encounter>) {
  const userId = extractUserId();

  // 1. Get current version
  const original = await encounterRepo.get(id);

  // 2. Update
  const updated = await encounterRepo.update(id, {
    ...updates,
    updatedAt: new Date(),
    updatedBy: userId
  });

  // 3. Create amendment provenance
  const provenance: Provenance = {
    id: generateUUID(),
    target: [{ reference: `Encounter/${id}` }],
    recorded: new Date(),
    activity: {
      code: "amend",
      system: "http://monobase.io/provenance-activity"
    },
    agent: [{
      role: "performer",  // Who did the amendment
      who: { reference: `Practitioner/${userId}` }
    }],
    entity: [{
      role: "revision",  // Previous version
      what: { reference: `Encounter/${id}` }
    }],
    // Optional: reason for amendment
    reason: [{
      coding: [{
        system: "http://monobase.io/amendment-reason",
        code: "correction",
        display: "Error correction"
      }]
    }]
  };

  await provenanceRepo.create(provenance);

  return updated;
}
```

**3. Provenance Lineage Query**

Enable querying the complete history:

```typescript
@get("/encounters/{id}/provenance-chain")
async getProvenanceChain(@path id: string) {
  // 1. Get all Provenance records for this resource
  const chain = await provenanceRepo.findByTarget(`Encounter/${id}`);

  // 2. Order by timestamp
  chain.sort((a, b) => a.recorded.getTime() - b.recorded.getTime());

  // 3. Build chain with linked entities
  return {
    resourceType: "Bundle",
    type: "history",
    entry: chain.map(prov => ({
      resource: prov,
      response: {
        status: "200 OK",
        lastModified: prov.recorded
      }
    }))
  };
}
```

### 8.4 Recommendations

**Immediate:**
1. Add ProvenanceActivityType enum value: "amend" (for corrections)
2. Implement automatic Provenance creation on resource changes
3. Map FHIR Provenance fields to W3C PROV concepts in documentation

**Short-term:**
1. Create StructureDefinition for MonobaseProvenance
2. Add provenance chain query endpoint
3. Implement data lineage visualization in analytics

**Long-term:**
1. Support blockchain-based provenance (immutable audit trail)
2. Cross-system provenance (track data as it moves between systems)
3. Provenance-based compliance reporting

---

## 9. DOCUMENT STANDARDS (CDA/C-CDA/FHIR Composition)

### 9.1 Current State

**What Exists:**
```typescript
// specs/api/src/healthcare/clinical/composition.tsp (likely)
// specs/api/src/healthcare/clinical/document-reference.tsp (likely)
```

**What's Missing:**
- C-CDA profile support
- Discharge summary template
- Referral letter template
- Prescription document template
- PDF/A archival support
- Document signing workflow
- Clinical document architecture mapping

### 9.2 Standards Overview

| Standard | Format | Use Case | Maturity |
|----------|--------|----------|----------|
| **CDA (Clinical Document Architecture)** | XML | Structured clinical documents (discharge summary, referral) | Mature (HL7 v3) |
| **C-CDA (Consolidated CDA)** | XML + constraints | US-specific clinical documents | Widely adopted in US |
| **FHIR Composition** | JSON/XML | Modern equivalent of CDA | Current standard |
| **C-CDA on FHIR** | JSON/XML | Bridge between CDA and FHIR | STU |
| **PDF/A** | PDF (archival format) | Long-term storage | ISO standard |

**Key Decision:**
- **For new APIs**: Use FHIR Composition (recommended)
- **For legacy systems**: Support C-CDA on FHIR mapping
- **For archival**: PDF/A format with signature

### 9.3 FHIR Composition Structure

Your Composition resource should support these standardized document types:

```typescript
// specs/api/src/healthcare/clinical/composition-profiles.tsp

// 1. Discharge Summary (most common)
model DischargeSummary extends Composition {
  /**
   * Discharge Summary sections:
   * - Chief Complaint
   * - History of Present Illness
   * - Medications on Discharge
   * - Problem List
   * - Assessment and Plan
   * - Instructions/Follow-up
   */
}

// 2. Referral Letter (common in outpatient)
model ReferralLetter extends Composition {
  /**
   * Referral sections:
   * - Reason for Referral
   * - History
   * - Current Problem
   * - Treatment to Date
   * - Recommendations
   */
}

// 3. Consultation Note (specialist response)
model ConsultationNote extends Composition {
  /**
   * Consultation sections:
   * - Request for Consultation
   * - History & Physical
   * - Assessment/Impression
   * - Recommendations
   */
}

// 4. Prescription (medication order)
model PrescriptionDocument extends Composition {
  /**
   * Prescription sections:
   * - Patient Information
   * - Medications
   * - Dosage Instructions
   * - Contraindications
   * - Pharmacy Instructions
   */
}

// 5. Lab Report / Diagnostic Imaging Report
model DiagnosticReport extends Composition {
  /**
   * Report sections:
   * - Clinical History
   * - Findings
   * - Impression
   * - Recommendations
   */
}
```

### 9.4 Implementation

**1. Create Discharge Summary**

```typescript
@post("/encounters/{encounterId}/discharge-summary")
async createDischargeSummary(
  @path encounterId: string,
  @body request: CreateDischargeSummaryRequest
) {
  const userId = extractUserId();
  const encounter = await encounterRepo.get(encounterId);

  const composition: DischargeSummary = {
    id: generateUUID(),
    status: "preliminary",  // Not final until reviewed
    type: {
      coding: [{
        system: "http://loinc.org",
        code: "18842-5",
        display: "Discharge summary"
      }]
    },
    subject: { reference: `Patient/${encounter.patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    date: new Date(),
    author: [{ reference: `Practitioner/${userId}` }],
    title: "Hospital Discharge Summary",

    section: [
      {
        code: {
          coding: [{
            system: "http://loinc.org",
            code: "29762-2",
            display: "Social history"
          }]
        },
        text: { status: "generated", div: request.socialHistory },
        entry: [] // Could reference RelatedPerson, Organization
      },
      {
        code: {
          coding: [{
            system: "http://loinc.org",
            code: "11450-4",
            display: "Problem list"
          }]
        },
        entry: request.problemReferences  // References to Condition resources
      },
      {
        code: {
          coding: [{
            system: "http://loinc.org",
            code: "10160-0",
            display: "History of medication use"
          }]
        },
        entry: request.medicationReferences  // References to MedicationRequest
      },
      {
        code: {
          coding: [{
            system: "http://loinc.org",
            code: "51848-0",
            display: "Assessments"
          }]
        },
        text: { status: "generated", div: request.assessment }
      },
      {
        code: {
          coding: [{
            system: "http://loinc.org",
            code: "18776-8",
            display: "Plan of care note"
          }]
        },
        text: { status: "generated", div: request.plan }
      }
    ]
  };

  const created = await compositionRepo.create(composition);

  // Create associated DocumentReference
  const docRef: DocumentReference = {
    id: generateUUID(),
    status: "current",
    type: {
      coding: [{
        system: "http://loinc.org",
        code: "18842-5",
        display: "Discharge summary"
      }]
    },
    subject: { reference: `Patient/${encounter.patientId}` },
    date: new Date(),
    content: [{
      attachment: {
        contentType: "application/fhir+json",
        url: `https://api.monobase.io/Composition/${created.id}`
      }
    }]
  };

  await documentReferenceRepo.create(docRef);

  return created;
}
```

**2. Finalize and Sign Document**

```typescript
@post("/compositions/{id}/finalize")
async finalizeComposition(@path id: string) {
  const composition = await compositionRepo.get(id);

  // 1. Verify document is complete
  if (!composition.section || composition.section.length === 0) {
    throw new BadRequestError("Composition is empty");
  }

  // 2. Validate against profile
  const validation = await validateAgainstProfile(
    composition,
    "http://monobase.io/DischargeSummary"
  );
  if (!validation.passed) {
    throw new BadRequestError("Invalid composition structure");
  }

  // 3. Sign (using digital signature)
  const signature = await signatureService.sign({
    resource: composition,
    signer: extractUserFromContext(),
    timestamp: new Date()
  });

  // 4. Update status to final
  const finalized = await compositionRepo.update(id, {
    status: "final",
    attester: [{
      mode: "legal",  // Legally authenticated
      party: { reference: `Practitioner/${signature.signer}` },
      time: new Date()
    }]
  });

  // 5. Create Signature resource (FHIR)
  const sigResource: Signature = {
    type: [{
      system: "urn:iso-astm:E1762-95:2013",
      code: "1.2.840.10065.1.12.1.5",
      display: "Verification Signature"
    }],
    when: new Date(),
    who: { reference: `Practitioner/${signature.signer}` },
    sigFormat: "application/signature+xml",  // Or application/cms+der
    data: signature.signatureValue
  };

  await signatureRepo.create(sigResource);

  // 6. Generate PDF/A for archival
  const pdfA = await generatePDFA(finalized);
  const pdfUrl = await storageService.upload(
    `compositions/${id}/discharge-summary.pdf`,
    pdfA
  );

  // Update DocumentReference with PDF URL
  await documentReferenceRepo.update(id, {
    content: [{
      attachment: {
        contentType: "application/pdf",
        url: pdfUrl,
        creation: new Date()
      }
    }]
  });

  return finalized;
}
```

**3. Export as C-CDA (Legacy Systems)**

```typescript
@get("/compositions/{id}/export/ccda")
async exportAsCCDA(@path id: string) {
  const composition = await compositionRepo.get(id);

  // Transform FHIR Composition → CDA XML
  const cda = transformFHIRToCDA(composition);

  // Validate against CDA schema
  const isValid = validateCDASchema(cda);
  if (!isValid) {
    throw new InternalServerError("CDA transformation failed");
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/xml" },
    body: cda
  };
}
```

### 9.5 Recommendations

**Immediate:**
1. Add DischargeSummary, ReferralLetter, ConsultationNote, PrescriptionDocument profiles
2. Implement Composition → PDF/A conversion
3. Add digital signature support

**Short-term:**
1. Create C-CDA on FHIR mapping document
2. Implement legacy system export (CDA XML)
3. Add document versioning and amendment tracking

**Long-term:**
1. Support clinical document workflows (draft → reviewed → signed → finalized)
2. Implement document retention policies
3. Support document sharing across organizations

---

## 10. CROSS-BORDER / INTERNATIONAL STANDARDS

### 10.1 International Patient Summary (IPS)

**What is it?**
IPS is an ISO 27269 standard for a minimal, globally useful patient summary:
- Created for unplanned or planned care
- Shared across borders via standardized format
- Contains essential clinical data only
- GDPR-compliant (minimal data collection)

**IPS Dataset includes:**
- Demographics (name, birthdate, gender, ID)
- Allergies & Intolerances
- Active Problems/Conditions
- Current Medications
- Past Medical History (surgeries, procedures)
- Lab Results (recent)
- Vital Signs (recent)
- Immunizations
- Care Team
- Functional Status
- Plan of Care

**Your API should support:**

```typescript
// 1. IPS Generation Endpoint
@get("/patients/{patientId}/$IPS")
async generateIPS(@path patientId: string) {
  const patient = await patientRepo.get(patientId);

  // Collect IPS-required data
  const ips: Composition = {
    id: generateUUID(),
    status: "final",
    type: {
      coding: [{
        system: "http://loinc.org",
        code: "60591-5",
        display: "International Patient Summary"
      }]
    },
    subject: { reference: `Patient/${patientId}` },
    date: new Date(),
    author: [{ reference: "Organization/monobase" }],
    title: "International Patient Summary",

    section: [
      // Demographics (implicit in Bundle.entry[0])
      {
        code: { coding: [{ system: "http://loinc.org", code: "48765-2" }] },
        title: "Allergies, adverse reactions, alerts",
        entry: await getPatientAllergies(patientId)
      },
      {
        code: { coding: [{ system: "http://loinc.org", code: "11450-4" }] },
        title: "Problem list",
        entry: await getPatientProblems(patientId)
      },
      {
        code: { coding: [{ system: "http://loinc.org", code: "10160-0" }] },
        title: "Medication use",
        entry: await getPatientMedications(patientId)
      },
      {
        code: { coding: [{ system: "http://loinc.org", code: "47519-4" }] },
        title: "History of procedures",
        entry: await getPatientProcedures(patientId)
      },
      {
        code: { coding: [{ system: "http://loinc.org", code: "30954-2" }] },
        title: "Immunizations",
        entry: await getPatientImmunizations(patientId)
      }
    ]
  };

  // Wrap in Bundle for SMART Health Links
  return {
    resourceType: "Bundle",
    type: "document",
    timestamp: new Date(),
    entry: [
      { resource: ips },
      { resource: patient },
      ...otherResources
    ]
  };
}

// 2. Share via SMART Health Links
@post("/patients/{patientId}/share-ips")
async shareIPS(
  @path patientId: string,
  @body { recipients }: { recipients: string[] }
) {
  const ips = await generateIPS(patientId);

  // Encrypt Bundle for recipients
  const encrypted = await encryptForRecipients(ips, recipients);

  // Generate SMART Health Link
  const smartLink = await smartHealthLinksService.create({
    data: encrypted,
    expiresIn: 90,  // days
    passcode: generatePasscode()
  });

  return {
    url: smartLink.url,
    passcode: smartLink.passcode,
    expiresAt: smartLink.expiresAt
  };
}
```

### 10.2 EHDS (European Health Data Space) Compliance

**What does EHDS require?**
If you're serving European patients:

1. **APIs must be discoverable and accessible**
   - Publish CapabilityStatement
   - Implement FHIR Search endpoints
   - Support standard FHIR authentication

2. **Data must be portable** (Art. 5-7)
   - Patients can request their data
   - Must be in structured, machine-readable format
   - Can't be denied except for legal reasons

3. **Secondary use support** (Art. 8-17)
   - Data can be used for research/innovation
   - Requires Health Data Access Body (HDAB) permit
   - Must log all secondary use access

4. **Confidentiality classifications** (Art. 13)
   - Mark sensitive data (mental health, HIV, substance abuse)
   - Enforce stricter access controls
   - Support "exceptional processing conditions"

5. **Certification** (Art. 20-24)
   - EHR systems must pass conformance tests
   - Demonstrates interoperability & security
   - Valid for 3 years

**Your Implementation:**

```typescript
// 1. Portable data export (EHDS Article 5)
@get("/patients/{patientId}/$export")
async exportPatientData(@path patientId: string) {
  // Must return all patient data in structured format
  // No denial unless legally required

  const allData = await getPatientEverything(patientId);

  return {
    resourceType: "Bundle",
    type: "document",
    entry: allData
  };
}

// 2. Secondary use audit (EHDS Article 11)
@post("/audit/secondary-use-access")
async logSecondaryUseAccess(request: {
  dataCategory: string;
  purpose: "research" | "public-health" | "innovation";
  permitId: string;  // From Health Data Access Body
  dataElements: string[];
  recipient: string;
}) {
  await auditHandler.recordDataAccess(
    "",  // Multiple patients
    "Bundle",
    "read",
    request.recipient,
    request.purpose,
    "success"
  );
}

// 3. Confidentiality classification enforcement
@get("/encounters/{id}")
async getEncounter(@path id: string) {
  const encounter = await encounterRepo.get(id);

  // Check if data is restricted (e.g., mental health)
  if (encounter.confidentiality === "V") {  // Very restricted
    const userId = extractUserId();
    const permission = await checkExceptionalProcessingPermission(userId);
    if (!permission) {
      throw new ForbiddenError("Data access restricted");
    }
  }

  return encounter;
}

// 4. Conformance certification declaration
@get("/.well-known/capability-statement")
async getCapabilityStatement() {
  return {
    resourceType: "CapabilityStatement",
    name: "Monobase EHDS Compliant API",
    software: {
      name: "MonobaseAPI",
      version: "1.0.0",
      // Certification details:
      certification: {
        certificationId: "EU-2025-...",
        certificationBody: "European Commission",
        certificationDate: "2025-03-15",
        expirationDate: "2028-03-15",
        conformsTo: ["EHDS", "FHIR R4", "SMART on FHIR", "GDPR"]
      }
    },
    // ... rest of capability statement
  };
}
```

### 10.3 WHO Smart Guidelines

WHO Smart Guidelines focus on evidence-based care protocols:
- Clinical decision support
- Population health recommendations
- Standardized care workflows

**Integration approach:**
```typescript
// Embed WHO guidelines in clinical workflows
@post("/care-plan")
async createCarePlan(@body request: CreateCarePlanRequest) {
  const patient = await patientRepo.get(request.patientId);

  // Apply WHO guidelines based on patient condition
  const applicableGuidelines = await whoGuidelineService.getApplicableGuidelines({
    condition: request.condition,
    age: patient.birthDate,
    gender: patient.gender,
    comorbidities: request.conditions
  });

  // Include guideline recommendations in care plan
  const carePlan = {
    ...request,
    supportingInfo: [
      ...applicableGuidelines.recommendations
    ]
  };

  return await carePlanRepo.create(carePlan);
}
```

---

## MISSING ARTIFACTS SUMMARY

### Critical (Required for v1.0 / Production)

| Artifact | Current State | Priority | Effort | Timeline |
|----------|---------------|----------|--------|----------|
| **CapabilityStatement** | ✗ Missing | CRITICAL | 2-3 days | Week 1 |
| **StructureDefinitions (10-15 profiles)** | ✗ Missing | CRITICAL | 2-3 weeks | Months 1-2 |
| **Implementation Guide** | ✗ Missing | CRITICAL | 4-6 weeks | Months 2-3 |
| **FHIR Validation Pipeline** | ✗ Missing | CRITICAL | 1 week | Week 1-2 |
| **Consent Enforcement** | Partial (Consent model exists) | CRITICAL | 1-2 weeks | Weeks 2-3 |
| **Audit Logging (ATNA)** | Partial | CRITICAL | 2-3 weeks | Weeks 3-4 |
| **Terminology Service** | ✗ Missing | HIGH | 1-2 weeks | Weeks 2-3 |

### High Priority (v1.x / First Release)

| Artifact | Current State | Priority | Effort | Timeline |
|----------|---------------|----------|--------|----------|
| **Conformance Testing Suite** | ✗ Missing | HIGH | 2-4 weeks | Months 2-3 |
| **Document Standards (Composition profiles)** | Partial | HIGH | 2-3 weeks | Months 2-3 |
| **Break-Glass Access Framework** | ✗ Missing | HIGH | 1 week | Week 2 |
| **SMART on FHIR OAuth Scopes** | ✗ Missing | HIGH | 1 week | Week 2 |
| **$everything / $export Security** | ✗ Missing | HIGH | 1-2 weeks | Weeks 2-3 |
| **Data Provenance Enforcement** | Partial (Provenance model exists) | HIGH | 1-2 weeks | Weeks 3-4 |
| **IPS Support** | ✗ Missing | HIGH | 1-2 weeks | Month 3 |

### Medium Priority (v2.x / Later Releases)

| Artifact | Current State | Priority | Effort | Timeline |
|----------|---------------|----------|--------|----------|
| **C-CDA on FHIR Mapping** | ✗ Missing | MEDIUM | 1-2 weeks | Month 4 |
| **EHDS Certification** | ✗ Missing | MEDIUM | 4-8 weeks | Months 4-6 |
| **Mutual TLS Support** | ✗ Missing | MEDIUM | 1-2 weeks | Month 4 |
| **W3C PROV Compliance** | Partial | MEDIUM | 1 week | Month 4 |
| **Blockchain Provenance** | ✗ Missing | MEDIUM | 4-6 weeks | Months 5-6 |
| **Dynamic Consent** | ✗ Missing | MEDIUM | 2-3 weeks | Month 5 |
| **UDAP (next-gen SMART)** | ✗ Missing | MEDIUM | 2-3 weeks | Month 6 |

---

## IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Months 1-2) - 8-10 weeks
**Goal**: Basic FHIR conformance and compliance

**Week 1-2:**
- [ ] Create CapabilityStatement resource in TypeSpec
- [ ] Implement /.well-known/smart-configuration endpoint
- [ ] Add FHIR Validator to CI/CD pipeline
- [ ] Implement $validate endpoint

**Week 3-4:**
- [ ] Begin Converting all major profiles to FSH (20-30 profiles)
- [ ] Add HIPAA authorization fields to Consent
- [ ] Add GDPR tracking to Consent
- [ ] Implement ConsentEnforcer in handlers

**Week 5-6:**
- [ ] Implement audit logging for data access (ATNA format)
- [ ] Add break-glass access logging
- [ ] Create Terminology Service (basic ValueSet registry)
- [ ] Add SMART on FHIR scope enforcement

**Week 7-8:**
- [ ] Initialize IG project structure
- [ ] Create documentation pages (index, use cases, security, consent, audit)
- [ ] Generate initial HTML documentation
- [ ] Implement $everything and $export security

**Week 9-10:**
- [ ] Testing and refinement
- [ ] Internal validation
- [ ] Documentation updates

### Phase 2: Publishing & Certification (Months 3-4) - 6-8 weeks
**Goal**: Publish IG and establish conformance pathway

**Week 1-2:**
- [ ] Finish IG publication setup
- [ ] Publish v1.0 IG online
- [ ] Create test suite (Inferno)
- [ ] Begin partner testing

**Week 3-4:**
- [ ] Implement Document Composition profiles (Discharge Summary, Referral, etc.)
- [ ] Add PDF/A support for archival
- [ ] Implement document signing workflow

**Week 5-6:**
- [ ] Add IPS support
- [ ] Implement IPS generation endpoint
- [ ] Add SMART Health Links support
- [ ] Testing with external partners

**Week 7-8:**
- [ ] Begin EHDS compliance roadmap
- [ ] Create compliance documentation
- [ ] Preliminary certification assessment

### Phase 3: Advanced Features (Months 5-6+) - Ongoing
**Goal**: Full standards compliance and advanced features

**Ongoing:**
- [ ] Mutual TLS support
- [ ] C-CDA on FHIR mapping
- [ ] EHDS certification
- [ ] UDAP support (when released)
- [ ] Blockchain provenance (optional)
- [ ] Dynamic consent UI
- [ ] Population health features

---

## RECOMMENDED READING & STANDARDS DOCUMENTS

### Core FHIR Standards
- [HL7 FHIR R4 Specification](https://www.hl7.org/fhir/R4/)
- [FHIR Validation](https://www.hl7.org/fhir/validation.html)
- [FHIR Profiling Guide](https://build.fhir.org/profiling.html)
- [SMART on FHIR](https://docs.smarthealthit.org/)

### Compliance & Regulations
- [HIPAA Security Rule §164.312](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [GDPR Articles on Consent](https://gdpr-info.eu/issues/consent/)
- [EHDS Regulation (EU 2025/327)](https://eur-lex.europa.eu/eli/reg/2025/327/oj/eng)

### Specialized Standards
- [IPS Implementation Guide](https://www.hl7.org/fhir/uv/ips/)
- [C-CDA on FHIR](https://hl7.org/fhir/us/ccda/)
- [IHE ATNA](https://www.ihe.net/)
- [W3C PROV Ontology](https://www.w3.org/2001/sw/wiki/PROV)

### Testing & Tools
- [Inferno Framework](https://inferno-framework.github.io/)
- [FHIR Shorthand](https://build.fhir.org/ig/HL7/fhir-shorthand/)
- [SUSHI Compiler](https://github.com/FHIR/sushi)
- [IG Publisher](https://confluence.hl7.org/display/FHIR/IG+Publisher+Documentation)

---

## CONCLUSION

Your healthcare API has **excellent foundations** with FHIR R4 data models but needs **critical standards artifacts** to achieve:
- ✓ FHIR conformance and interoperability
- ✓ Regulatory compliance (HIPAA, GDPR, EHDS)
- ✓ Cross-border healthcare data exchange
- ✓ Global market readiness

**Recommended immediate focus:**
1. **CapabilityStatement** (2-3 days)
2. **FHIR Validation** (1 week)
3. **Consent Enforcement** (2 weeks)
4. **Audit Logging** (2 weeks)
5. **Implementation Guide** (4-6 weeks)

**Total for "production-ready foundation"**: 10-16 weeks (2.5-4 months)

This roadmap provides a clear path to transform your API-Spec-First foundation into a globally compliant, interoperable healthcare platform.

