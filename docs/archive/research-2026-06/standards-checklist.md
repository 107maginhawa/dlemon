# Healthcare API Standards Implementation Checklist

Quick reference for standards alignment and compliance.

## 1. FHIR Conformance

- [ ] **CapabilityStatement** - Declare supported resources and operations
  - Location: `/.well-known/metadata` (FHIR standard)
  - Must include: FHIR version, supported resources, operations, security
  - Timeline: 2-3 days

- [ ] **StructureDefinitions** - Define custom profiles for all major resources
  - Count: ~15-20 profiles minimum
  - Format: FHIR Shorthand (FSH)
  - Timeline: 2-3 weeks

- [ ] **FHIR Validation** - Validate instances against profiles
  - Implement: `POST /fhir/$validate`
  - Tool: FHIR Validator (java library)
  - CI/CD integration: Validate on build
  - Timeline: 1 week

- [ ] **ValueSets** - Define coded concept enumerations
  - Create for: encounter types, status codes, purpose of use, confidentiality levels
  - Format: FSH or FHIR JSON
  - Timeline: 1 week

## 2. Consent Management

- [ ] **HIPAA Authorization Mapping**
  - Add fields: signature, expiration date, revocation date, signatory name
  - Validate against 45 CFR 164.508
  - Timeline: 1-2 weeks

- [ ] **GDPR Consent Mapping**
  - Add fields: freely given flag, specific purposes, consent method, withdrawal mechanism
  - Validate against GDPR Articles 4, 7, 13
  - Timeline: 1-2 weeks

- [ ] **Consent Enforcement**
  - Create: ConsentEnforcer class
  - Check consent in all data access handlers
  - Log consent violations
  - Timeline: 1-2 weeks

- [ ] **Consent Audit Trail**
  - Log all consent changes: create, update, withdraw
  - Track IP address, user agent, timestamp
  - Timeline: 3-5 days

## 3. Audit Logging

- [ ] **IHE ATNA Compliance**
  - Log format: Syslog (RFC 3881) OR FHIR AuditEvent
  - Transport: TLS-secured syslog
  - Retention: Minimum 6 years
  - Timeline: 2-3 weeks

- [ ] **FHIR AuditEvent Resource**
  - Create FHIR model in TypeSpec
  - Implement storage in database
  - Create query endpoint: `/AuditEvent/{id}`, `/AuditEvent?patient={id}`
  - Timeline: 1-2 weeks

- [ ] **Audit Coverage**
  - Patient data access (READ)
  - Data modifications (CREATE, UPDATE, DELETE)
  - Authentication events
  - Authorization decisions
  - Consent changes
  - Break-glass access
  - Data exports
  - Timeline: 2-3 weeks

## 4. Terminology Services

- [ ] **ValueSet Server**
  - Implement: `GET /fhir/ValueSet/$expand`
  - Implement: `GET /fhir/ValueSet/$validate-code`
  - Implement: `GET /fhir/CodeSystem/$lookup`
  - Timeline: 1-2 weeks

- [ ] **Code System Mappings**
  - Support: ICD-10, SNOMED CT, LOINC, RxNorm, custom systems
  - Implement ConceptMap resources
  - Timeline: 1-2 weeks

- [ ] **Terminology Bindings**
  - Define value set binding strength: required, extensible, preferred, example
  - Apply to all CodeableConcept elements
  - Timeline: 1 week

## 5. Security Standards

- [ ] **SMART on FHIR OAuth 2.0**
  - Endpoints: authorize, token, revoke
  - Scopes: patient/*.read, user/*.read, system/*.read, etc.
  - Config: `/.well-known/smart-configuration`
  - Timeline: 1 week

- [ ] **Bearer Token Validation**
  - Verify signature
  - Check expiration
  - Extract scopes and enforce
  - Timeline: 3-5 days (integration with existing auth)

- [ ] **$everything Operation Security**
  - Verify access to patient
  - Check consent
  - Exclude multi-patient resources
  - Audit access
  - Timeline: 3-5 days

- [ ] **$export Operation Security**
  - Verify authorization (system scopes)
  - Implement async job model
  - Generate signed URLs (temporary)
  - Clean up after expiration
  - Timeline: 1 week

- [ ] **Break-Glass Access**
  - Implement override mechanism
  - Log all break-glass access separately
  - Notify security team
  - Require justification
  - Timeline: 1 week

## 6. Data Provenance

- [ ] **Provenance Resource**
  - Create FHIR Provenance model (if not exists)
  - Implement storage in database
  - Timeline: 3-5 days

- [ ] **Automatic Provenance Creation**
  - Generate Provenance on resource create
  - Generate Provenance on resource update (with "amend" activity)
  - Track: activity type, agent role, timestamp, entity lineage
  - Timeline: 1 week

- [ ] **Provenance Queries**
  - Implement: `/resource/{id}/provenance-chain`
  - Return linked provenance history
  - Timeline: 3-5 days

- [ ] **W3C PROV Alignment**
  - Document mapping: FHIR Provenance → W3C PROV concepts
  - Timeline: 2-3 days

## 7. Document Standards

- [ ] **Composition Profiles**
  - DischargeSummary
  - ReferralLetter
  - ConsultationNote
  - PrescriptionDocument
  - Timeline: 2 weeks

- [ ] **Document Signing**
  - Implement digital signature (FHIR Signature resource)
  - Support X.509 certificates
  - Timestamp signatures
  - Timeline: 1-2 weeks

- [ ] **PDF/A Archival**
  - Generate PDF/A from Composition
  - Store in secure location
  - Include signature in PDF
  - Timeline: 1 week

- [ ] **DocumentReference Management**
  - Link Composition to DocumentReference
  - Manage multiple attachments (FHIR, PDF, CDA)
  - Query by document type
  - Timeline: 1 week

## 8. Implementation Guide (IG)

- [ ] **IG Project Setup**
  - Directory structure
  - FSH files for profiles
  - IG configuration (ig.ini)
  - Timeline: 2-3 days

- [ ] **Profile Definitions (FSH)**
  - Convert TypeSpec → FSH
  - Define slices and constraints
  - Add examples
  - Count: ~15-20 profiles
  - Timeline: 2-3 weeks

- [ ] **Documentation Pages**
  - index.md (overview)
  - use-cases.md (clinical scenarios)
  - security.md (security & privacy)
  - consent.md (consent workflows)
  - audit.md (audit requirements)
  - terminology.md (code bindings)
  - implementation.md (how to integrate)
  - Timeline: 2 weeks

- [ ] **IG Publishing**
  - Install SUSHI and IG Publisher
  - Generate HTML documentation
  - Publish to GitHub Pages or custom server
  - Timeline: 1 week

## 9. Conformance Testing

- [ ] **Test Suite Setup**
  - Tool: Inferno Framework (recommended)
  - Or: Touchstone (if you prefer TestScript engine)
  - Timeline: 1 week

- [ ] **Test Coverage**
  - Profile conformance (instances validate)
  - CapabilityStatement accuracy
  - Endpoint functionality
  - Search parameters
  - Validation endpoint ($validate)
  - Terminology operations
  - Security (OAuth, authentication)
  - Consent enforcement
  - Audit logging
  - Timeline: 2-3 weeks

- [ ] **Test Data**
  - Create valid instances of each profile
  - Create invalid instances (for negative testing)
  - Version: At least 5-10 examples per resource type
  - Timeline: 1 week

## 10. Cross-Border / International

- [ ] **International Patient Summary (IPS)**
  - Create IPS Composition profile
  - Implement: `GET /patients/{id}/$IPS`
  - Wrap in FHIR Bundle
  - Timeline: 1 week

- [ ] **SMART Health Links**
  - Encrypt IPS for recipients
  - Generate shareable links
  - Support passcode protection
  - Timeline: 1 week

- [ ] **EHDS Compliance (if serving EU patients)**
  - Portable data export (Article 5)
  - Secondary use audit logging (Article 11)
  - Confidentiality classification enforcement
  - Certification declaration
  - Timeline: 4-8 weeks

## Scoring Your Standards Alignment

**Score each section (0-100):**

| Section | Current | Target | Effort |
|---------|---------|--------|--------|
| FHIR Conformance | 40% | 90% | 4-5 weeks |
| Consent Management | 30% | 95% | 3-4 weeks |
| Audit Logging | 20% | 90% | 3-4 weeks |
| Terminology Services | 20% | 80% | 2-3 weeks |
| Security Standards | 50% | 95% | 3-4 weeks |
| Data Provenance | 30% | 80% | 2 weeks |
| Document Standards | 20% | 90% | 3-4 weeks |
| Implementation Guide | 0% | 100% | 4-6 weeks |
| Conformance Testing | 10% | 85% | 3-4 weeks |
| Cross-Border / Intl | 5% | 80% | 2-3 weeks |
| **OVERALL** | **24%** | **89%** | **30-40 weeks** |

---

## Quick Priority Matrix

### Critical (Do First - Weeks 1-4)
1. CapabilityStatement (2-3 days)
2. FHIR Validation Pipeline (1 week)
3. Consent Enforcement (1-2 weeks)
4. Audit Logging (2-3 weeks)

### High (Weeks 5-12)
5. Implementation Guide (4-6 weeks)
6. Terminology Service (1-2 weeks)
7. Break-Glass Access (1 week)
8. $everything / $export Security (1-2 weeks)

### Medium (Weeks 13-20)
9. Document Composition Profiles (2-3 weeks)
10. Conformance Testing (2-3 weeks)
11. IPS Support (1-2 weeks)

### Nice-to-Have (Weeks 20+)
12. Mutual TLS (1-2 weeks)
13. C-CDA Mapping (1-2 weeks)
14. EHDS Certification (4-8 weeks)

---

## Key Questions to Answer

### Conformance
- [ ] Are you claiming FHIR conformance or just FHIR-informed?
- [ ] Which version of FHIR? (R4 is recommended)
- [ ] Which profiles do you absolutely need? (prioritize)

### Compliance
- [ ] Are you HIPAA-covered? (adds requirements)
- [ ] Do you serve EU patients? (GDPR + EHDS)
- [ ] Do you need ATNA-level audit? (healthcare organizations often do)

### Timeline
- [ ] What's your go-to-production date?
- [ ] Do you need certification? (adds 4-8 weeks)
- [ ] Can you work incrementally (v1, v1.1, v2)?

### Team
- [ ] Do you have FHIR expertise? (hire consultant if not)
- [ ] Dedicated FHIR engineer for 2-3 months?
- [ ] Access to healthcare standards expertise?

---

## Recommended Reading

- [HL7 FHIR R4](https://www.hl7.org/fhir/R4/)
- [SMART on FHIR Best Practices](https://docs.smarthealthit.org/authorization/best-practices/)
- [FHIR Shorthand Documentation](https://build.fhir.org/ig/HL7/fhir-shorthand/)
- [IHE ATNA Profile](https://www.ihe.net/)
- [GDPR & Healthcare](https://www.gdpr.org/)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)

---

Generated: April 2026
Status: Ready for Implementation Planning
Next Step: Schedule Standards Alignment Workshop with Team
