<!--
oli: oli-prd-audit v1.0 | generated: 2026-05-24 | triggered: regulated=YES, security=YES
source: docs/prd/v3-dentalemon.md §8 NFR + codebase audit
-->

# Threat Model — Dentalemon

**Date**: 2026-05-24 | **Classification**: CONFIDENTIAL — PHI SYSTEM

---

## Assets

| Asset | Classification | Location |
|-------|---------------|---------|
| Patient dental records (visits, treatments, charts) | PHI — Critical | PostgreSQL `dental_visit`, `dental_treatment`, `dental_chart` |
| Medical history, prescriptions, lab orders | PHI — Critical | `dental-clinical` tables |
| Patient PII (name, DOB, contact, insurance) | PII — High | `person`, `patient` tables |
| Imaging studies (radiographs) | PHI — Critical | S3/MinIO + `imaging_study` tables |
| PMD files (signed visit exports) | PHI — Critical | File storage + `pmd_document` table |
| Invoice / billing records | Financial — High | `dental_invoice` tables |
| Authentication credentials | Security — Critical | Better-Auth session store |
| Audit logs | Compliance — High | `audit` module (Pino + pg-boss) |
| Signing certificates (PMD) | Security — High | Stored per-facility |

---

## Threat Matrix (STRIDE)

### S — Spoofing

| Threat | Likelihood | Impact | Mitigation | Status |
|--------|-----------|--------|-----------|--------|
| Session token theft via XSS | LOW | HIGH | Better-Auth httpOnly cookies; React escapes output | ✅ Mitigated |
| Brute-force login | MEDIUM | HIGH | Better-Auth progressive lockout; email+password with min 8 chars | ✅ Mitigated |
| PIN brute-force (device PIN) | MEDIUM | HIGH | 6-digit PIN with progressive lockout (NFR §8) | ✅ Documented |
| API key leak → impersonation | MEDIUM | HIGH | API keys for external providers; rotation policy [UNSPECIFIED] | ⚠️ Partial |

### T — Tampering

| Threat | Likelihood | Impact | Mitigation | Status |
|--------|-----------|--------|-----------|--------|
| Modify past treatment records | LOW | CRITICAL | Past records immutable; corrections via amendments only (CLAUDE.md) | ✅ Mitigated |
| SQL injection via API inputs | LOW | CRITICAL | Drizzle ORM throughout; parameterized queries | ✅ Mitigated |
| Tamper with PMD after signing | LOW | HIGH | Digital signatures + immutable PMD document record | ✅ Mitigated |
| CRDT conflict injection (sync) | LOW | HIGH | CRDT merge semantics [UNSPECIFIED — AG-1] | ⚠️ Open |

### R — Repudiation

| Threat | Likelihood | Impact | Mitigation | Status |
|--------|-----------|--------|-----------|--------|
| Deny clinical action (no audit) | LOW | HIGH | Audit module logs all READ+WRITE with who/when/what | ✅ Mitigated |
| Forged PMD signature | LOW | CRITICAL | Facility certificate + digital signature on PMD | ✅ Mitigated |
| Admin impersonation abuse | LOW | HIGH | Break-glass audit trail [UNSPECIFIED] | ⚠️ Open |

### I — Information Disclosure

| Threat | Likelihood | Impact | Mitigation | Status |
|--------|-----------|--------|-----------|--------|
| PHI in application logs | **HIGH** | CRITICAL | Pino logs email+userId at `info` level (G-005) | ❌ **OPEN** |
| PHI cached in browser | MEDIUM | HIGH | `Cache-Control: no-store` on all non-exempt routes | ✅ Mitigated |
| PHI exposure via CORS misconfiguration | LOW | HIGH | Dynamic origin validator; credentials=true only for allowlisted origins | ✅ Mitigated |
| PHI at-rest not encrypted | MEDIUM | HIGH | No column-level encryption (G-012) | ⚠️ Open |
| Associate dentist accessing other's patients | MEDIUM | HIGH | "Own patients" check in repo layer [VERIFY enforcement] | ⚠️ Partial |

### D — Denial of Service

| Threat | Likelihood | Impact | Mitigation | Status |
|--------|-----------|--------|-----------|--------|
| Unbounded list query flood | MEDIUM | MEDIUM | Pagination [VERIFY in all list handlers] (G-016) | ⚠️ Open |
| Job queue exhaustion | LOW | MEDIUM | pg-boss with concurrency limits [VERIFY] | ⚠️ Unknown |

### E — Elevation of Privilege

| Threat | Likelihood | Impact | Mitigation | Status |
|--------|-----------|--------|-----------|--------|
| Role string injection (comma exploit) | LOW | HIGH | `user.role.split(',')` — if role field ever written from input | ⚠️ Open |
| Membership role bypass | LOW | HIGH | `assertBranchRole` in all clinical handlers | ✅ Mitigated |
| Email verification bypass | MEDIUM | MEDIUM | `requireEmailVerification: false` hardcoded (G-004) | ❌ **OPEN** |

---

## Open Threats (action required)

| ID | Threat | Priority | Fix |
|----|--------|---------|-----|
| T-001 | PHI in logs (`logger.info` with email/userId) | **P1** | Pino redaction config for PHI fields |
| T-002 | Email verification disabled in all envs | **P1** | Gate `requireEmailVerification` with NODE_ENV |
| T-003 | No at-rest column encryption for PHI | **P2** | Column-level encryption or PG TDE |
| T-004 | Admin impersonation: no break-glass audit trail | **P1** | Log impersonation events with reason field |
| T-005 | CRDT conflict resolution semantics undefined | **P1** | Document and enforce conflict resolution rules |
| T-006 | API key rotation policy undefined | **P2** | Define and implement key rotation |
| T-007 | Unbounded list queries | **P2** | Enforce pagination in all list handlers |

---

## Compliance Mapping

| Regulation | Key Requirements | Status |
|-----------|-----------------|--------|
| HIPAA (US) | PHI encryption at rest + transit, audit logs, access controls | ⚠️ Partial (no at-rest encryption, PHI in logs) |
| GDPR (EU) | Consent, right to erasure, data retention, DPA | ⚠️ Partial (consent implemented, retention period unspecified) |
| RA 10173 (PH) | DPA consent, data breach notification, privacy officer | ⚠️ Partial |
| WCAG 2.1 AA | Accessibility for all UI | ⚠️ Declared but not verified |
