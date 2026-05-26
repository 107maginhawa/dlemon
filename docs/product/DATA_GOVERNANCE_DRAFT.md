<!--
oli: oli-prd-audit v1.0 | generated: 2026-05-24 | [DRAFT] — /oli-domain-model owns final DATA_GOVERNANCE.md
triggered: regulated=YES (HIPAA, GDPR, RA 10173)
-->

# Data Governance — DRAFT

> DRAFT only. `/oli-domain-model` will produce the final `DATA_GOVERNANCE.md` with complete retention schedules and deletion workflows.

---

## PII / PHI Classification

| Data Element | Classification | Table | Retention | Deletion Method |
|-------------|---------------|-------|-----------|----------------|
| Name, DOB, contact info | PII — High | `person` | Duration of care + [locale-specific] | Anonymization on erasure request |
| Dental records (visits, treatments, charts) | PHI — Critical | `dental_visit`, `dental_treatment`, `dental_chart` | Clinical retention [VERIFY locale] | Retain for legal minimum; anonymize patient link |
| Medical history, prescriptions | PHI — Critical | `dental-clinical` tables | Clinical retention | Retain; anonymize patient link |
| Imaging studies (radiographs) | PHI — Critical | `imaging_study` + S3 | Clinical retention | Delete S3 object + metadata |
| PMD files | PHI — Critical | `pmd_document` + file storage | Permanent (signed export) | Cannot delete signed PMDs (compliance) |
| Invoice/billing records | Financial — High | `dental_invoice` | 7 years (tax compliance) | Anonymize patient link after retention |
| Audit logs | Compliance — High | `audit` module | [UNSPECIFIED — AG-2] | Append-only; no deletion |
| Authentication sessions | Security | Better-Auth store | Session expiry [UNSPECIFIED — ADR-007] | Auto-expire |

---

## Consent Framework

| Consent Type | Captured At | Stored As | Withdrawal Effect |
|-------------|------------|-----------|-------------------|
| Data processing consent | Patient registration | JSONB on `person` | Triggers anonymization workflow |
| Marketing consent | Optional (registration) | JSONB on `person` | Stop marketing communications |
| Treatment consent | Per visit (consent form) | `consent_form` table | Historical consent preserved |
| Pediatric guardian consent | Registration (age < 16 or locale threshold) | `person.guardian_name` | [VERIFY] |

---

## Locale-Specific Obligations

| Locale | Law | Key Obligation | Gap |
|--------|-----|---------------|-----|
| Philippines | RA 10173 (DPA 2012) | Privacy officer, DPA registration, breach notification 72h | ⚠️ Privacy officer role undefined |
| United States | HIPAA | PHI encryption at rest, Business Associate Agreements | ⚠️ No at-rest encryption (G-012) |
| European Union | GDPR | Right to erasure, data portability, DPO for large-scale | ⚠️ Erasure workflow undefined |
| Singapore | PDPA | Consent, purpose limitation, data breach notification | ⚠️ Breach notification flow undefined |
| Australia | Privacy Act (APPs) | Collection notice, access/correction rights | ⚠️ Access request workflow undefined |

---

## Open Items for `/oli-domain-model`

- Define exact retention periods per locale
- Specify erasure workflow (anonymization vs hard delete per entity type)
- Define audit log retention period (AG-2)
- PMD deletion policy for signed documents
- Data portability export format (GDPR Art. 20)
