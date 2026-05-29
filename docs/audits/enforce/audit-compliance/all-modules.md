# Audit Compliance Report — All Modules (Wave3 Post-Fix)
**Run ID:** run-7-wave3-verify-2026-05-29
**Scope:** AUDIT_CONTRACTS.md §3 — all 25 mandatory audit events
**Method:** Static analysis of `services/api-ts/src/handlers/` — grep for `logAuditEvent` at handler callsites + route registry cross-check
**Baseline:** run-6-strict-2026-05-29 (dental-audit.md)

---

## Summary

| Metric | Value |
|--------|-------|
| Contracts checked | 25 |
| Contracts PRESENT (logAuditEvent in routed handler) | 13 |
| Contracts MISSING (no logAuditEvent in routed handler) | 12 |
| Newly fixed vs run-6 baseline | 4 |
| Still open P0 | 9 |
| Still open P1 | 3 |
| Still open P2 | 4 |
| Still open P3 | 2 |
| Schema gaps (§2 fields) | 5 (unchanged) |

---

## §1 — Infrastructure (unchanged from run-6)

`logAuditEvent` shim (`/core/audit-logger.ts`) — dual-writes to `dental_audit` (legacy) + `dental_audit_log` (spec). Never throws. Pattern is correct.

`dental_audit_log` schema still missing 5 §2 fields: `event_type`, `actor_role`, `ip_address`, `user_agent`, `metadata`. Column renames (`target_type`/`aggregate_type`, `target_id`/`aggregate_id`, `timestamp`/`occurred_at`) still unresolved.

---

## §2 — Wave3 Fix Verification

### AL-003 — dental-org: Assign membership (PARTIALLY FIXED)

**Wave3 fix:** `createMember.ts` (`POST /dental/org/members`) — `logAuditEvent` added at line 97 via `@/handlers/audit/repos/audit.facade`. Action: `create`. Comment: `// AL-003: HIPAA §164.312`.

**Gap remaining:** `DentalMembershipManagement_create.ts` (`POST /dental/organizations/:orgId/branches/:branchId/members`) — the TypeSpec-generated canonical route — has **no audit call**. Both handlers are registered in `generated/openapi/routes.ts`. The Wave3 fix only covers the informal `/dental/org/members` route; the spec-compliant route remains unaudited.

**Status: PARTIAL — canonical route still unaudited (P0)**

---

### AL-004 — dental-org: Revoke membership (NOT FIXED)

**Wave3 fix attempt:** `deactivateMember.ts` has `logAuditEvent` added at line 35. Action: `delete`. Comment: `// AL-004`.

**Gap:** `deactivateMember.ts` is **not registered in any route** (`generated/openapi/routes.ts` has no reference; `app.ts` has no reference). It is an orphan handler. The actual revoke route uses `DentalMembershipManagement_deactivate.ts` (`POST /dental/organizations/:orgId/branches/:branchId/members/:membershipId/deactivate`) which has **no audit call**. The fix was applied to the wrong file.

**Status: NOT FIXED — audit in unreachable handler (P0)**

---

### AL-006 — dental-patient: Export patient data (FIXED)

**Wave3 fix:** `exportDentalPatients.ts` — `logAuditEvent` at line 74 via `@/core/audit-logger`. Action: `patient.export`. Confirmed present and on the routed handler.

**Status: FIXED ✓**

---

### AL-007 (originally dental-scheduling book) — dental-scheduling: Book appointment (FIXED)

**Wave3 fix:** `createAppointment.ts` — `logAuditEvent` at line 79 via `@/core/audit-logger`. Action: `appointment.book`. Confirmed present.

**Status: FIXED ✓**

---

### AL-011 — dental-imaging: Upload imaging study (FIXED)

**Wave3 fix:** `createImagingStudy.ts` — `logAuditEvent` at line 86 via `@/core/audit-logger`. Action: `imaging_study.create`. Confirmed present.

**Status: FIXED ✓**

---

### AL-012 — dental-imaging: Access imaging study (FIXED)

**Wave3 fix:** `getImagingStudy.ts` — `logAuditEvent` at line 44 via `@/core/audit-logger`. Action: `imaging_study.read`. Confirmed present.

**Status: FIXED ✓**

---

## §3 — Full Contract Status (All 25)

### dental-org (5 contracts)

| ID | Contract | Handler (routed) | Audit Call | Status |
|----|----------|-----------------|------------|--------|
| AL-001 | Create org | `DentalOrganizationManagement_create.ts` | None | P0 OPEN |
| AL-002 | Create branch | `DentalBranchManagement_create.ts` | None | P0 OPEN |
| AL-003 | Assign membership | `DentalMembershipManagement_create.ts` (canonical route) | None | P0 OPEN (partial — see §2) |
| AL-004 | Revoke membership | `DentalMembershipManagement_deactivate.ts` (actual route) | None | P0 OPEN (orphan fix — see §2) |
| AL-020 | View audit log (self-audit) | `getAuditEvents.ts` | None | P3 OPEN |

### dental-patient (4 contracts)

| ID | Contract | Handler (routed) | Audit Call | Status |
|----|----------|-----------------|------------|--------|
| AL-005 | Create patient | `createDentalPatient.ts` | None | P0 OPEN |
| AL-026 | View patient profile | `getDentalPatient.ts` | `logAuditEvent` (action: `patient.view`) | PRESENT ✓ |
| AL-018 | Archive patient | `archiveDentalPatient.ts` | `logger.info` only — no `logAuditEvent` | P2 OPEN |
| AL-006 | Export patient data | `exportDentalPatients.ts` | `logAuditEvent` (action: `patient.export`) | FIXED ✓ |

### dental-visit (3 contracts)

| ID | Contract | Handler (routed) | Audit Call | Status |
|----|----------|-----------------|------------|--------|
| AL-027 | Create visit | `createDentalVisit.ts` | `logAuditEvent` (action: `visit.create`) | PRESENT ✓ |
| AL-028 | Complete visit | `updateDentalVisit.ts` (complete path) | `logAuditEvent` (action: `visit.complete`) | PRESENT ✓ |
| AL-017 | Lock visit | `updateDentalVisit.ts` (lock path) | `log.info` only — no `logAuditEvent` | P2 OPEN |

### dental-scheduling (2 contracts)

| ID | Contract | Handler (routed) | Audit Call | Status |
|----|----------|-----------------|------------|--------|
| AL-007 | Book appointment | `createAppointment.ts` | `logAuditEvent` (action: `appointment.book`) | FIXED ✓ |
| AL-008 | Cancel appointment | `cancelAppointment.ts` | None | P0 OPEN |

### dental-billing (3 contracts)

| ID | Contract | Handler (routed) | Audit Call | Status |
|----|----------|-----------------|------------|--------|
| AL-009 | Create invoice | `createDentalInvoice.ts` | None | P0 OPEN |
| AL-010 | Record payment | `recordDentalPayment.ts` | `logger.info` only — no `logAuditEvent` | P2 OPEN |
| AL-029 | Void invoice | `voidDentalInvoice.ts` | `logAuditEvent` (action: `invoice.voided`) | PRESENT ✓ |

### dental-clinical (3 contracts)

| ID | Contract | Handler (routed) | Audit Call | Status |
|----|----------|-----------------|------------|--------|
| AL-019 | Write prescription | `createPrescription.ts` | `logger.info` only — no `logAuditEvent` | P2 OPEN |
| AL-021 | Sign consent | `signConsentForm.ts` | `logger.info` only — no `logAuditEvent` | P3 OPEN |
| AL-022 | Revoke consent | `revokeConsentForm.ts` | `logger.info` only — no `logAuditEvent` | P3 OPEN |

Note: `revokeConsentForm.ts` was added (handler now exists, previously missing), but no `logAuditEvent` call was included.

### dental-imaging (2 contracts)

| ID | Contract | Handler (routed) | Audit Call | Status |
|----|----------|-----------------|------------|--------|
| AL-011 | Upload imaging study | `createImagingStudy.ts` | `logAuditEvent` (action: `imaging_study.create`) | FIXED ✓ |
| AL-012 | Access imaging study | `getImagingStudy.ts` | `logAuditEvent` (action: `imaging_study.read`) | FIXED ✓ |

### dental-pmd (2 contracts)

| ID | Contract | Handler (routed) | Audit Call | Status |
|----|----------|-----------------|------------|--------|
| AL-013 | Generate PMD | `generatePMD.ts` | None | P0 OPEN |
| AL-025 | Download PMD | `exportPMD.ts` | None | P0 OPEN |

### dental-emr (2 contracts)

| ID | Contract | Handler | Audit Call | Status |
|----|----------|---------|------------|--------|
| AL-023 | Import EMR record | `emr/createConsultation.ts` | `logger.info` only — no `logAuditEvent` | P0 OPEN |
| AL-024 | View EMR record | `emr/getConsultation.ts` | `logger.info` only — no `logAuditEvent` | P0 OPEN |

Note: Module exists (`/handlers/emr/`) but is the generic EMR module, not a dental-specific implementation. It uses `logger.info` Pino calls only, no `logAuditEvent` to either audit table.

---

## §4 — Finding Register (Current Open Issues)

### P0 — PHI operation with no persisted audit record (9 open)

| ID | Module | Operation | Routed Handler | Fix Needed |
|----|--------|-----------|---------------|------------|
| AL-001 | dental-org | Create org | `DentalOrganizationManagement_create.ts` | Add `logAuditEvent` |
| AL-002 | dental-org | Create branch | `DentalBranchManagement_create.ts` | Add `logAuditEvent` |
| AL-003 | dental-org | Assign membership (canonical) | `DentalMembershipManagement_create.ts` | Add `logAuditEvent` (fix was applied to wrong handler) |
| AL-004 | dental-org | Revoke membership | `DentalMembershipManagement_deactivate.ts` | Add `logAuditEvent` (deactivateMember.ts is unrouted) |
| AL-005 | dental-patient | Create patient | `createDentalPatient.ts` | Add `logAuditEvent` |
| AL-008 | dental-scheduling | Cancel appointment | `cancelAppointment.ts` | Add `logAuditEvent` |
| AL-009 | dental-billing | Create invoice | `createDentalInvoice.ts` | Add `logAuditEvent` |
| AL-013 | dental-pmd | Generate PMD | `generatePMD.ts` | Add `logAuditEvent` |
| AL-025 | dental-pmd | Download PMD | `exportPMD.ts` | Add `logAuditEvent` |

### P0 — PHI operation with Pino-only audit (no persisted record) (2 open)

| ID | Module | Operation | Handler | Issue |
|----|--------|-----------|---------|-------|
| AL-023 | dental-emr | Import EMR | `emr/createConsultation.ts` | `logger.info` only |
| AL-024 | dental-emr | View EMR | `emr/getConsultation.ts` | `logger.info` only |

Total P0: 11

### P1 — Audit present but missing required §2 fields (3 open, unchanged)

Root cause: `logAuditEvent` shim does not accept `event_type` or `actor_role`; all callers inherit the gap.

| ID | Module | Handler | Missing Fields |
|----|--------|---------|---------------|
| AL-014 | dental-visit | `updateDentalVisit.ts` (complete) | `event_type`, `actor_role` |
| AL-015 | dental-visit | `createDentalVisit.ts` | `event_type`, `actor_role` |
| AL-016 | dental-billing | `voidDentalInvoice.ts` | `event_type`, `actor_role` |

### P2 — Logger.info only, no persistence to audit table (4 open)

| ID | Module | Operation | Handler |
|----|--------|-----------|---------|
| AL-017 | dental-visit | Lock visit | `updateDentalVisit.ts` line 141 |
| AL-018 | dental-patient | Archive patient | `archiveDentalPatient.ts` line 56 |
| AL-019 | dental-clinical | Write prescription | `createPrescription.ts` line 80 |
| AL-010 | dental-billing | Record payment | `recordDentalPayment.ts` line 76 |

### P3 — Compliance-important, lower PHI risk (2 open)

| ID | Module | Operation | Handler | Issue |
|----|--------|-----------|---------|-------|
| AL-020 | dental-audit | View audit log | `getAuditEvents.ts` | Self-audit not implemented |
| AL-021 | dental-clinical | Sign consent | `signConsentForm.ts` | `logger.info` only |
| AL-022 | dental-clinical | Revoke consent | `revokeConsentForm.ts` | `logger.info` only — handler added but audit omitted |

---

## §5 — Wave3 Routing Defect Detail

**AL-003/AL-004 root cause:** Wave3 fixes targeted legacy informal routes (`/dental/org/members`) instead of the TypeSpec-generated canonical routes (`/dental/organizations/:orgId/branches/:branchId/members`). The canonical routes use `DentalMembershipManagement_create.ts` and `DentalMembershipManagement_deactivate.ts` respectively.

Additionally, `deactivateMember.ts` (which received the AL-004 fix) is imported in `generated/openapi/registry.ts` but has no corresponding route entry in `generated/openapi/routes.ts` and no manual registration in `app.ts`. The handler is dead code in production.

**Corrective action required:**
1. Add `logAuditEvent` to `DentalMembershipManagement_create.ts` (AL-003)
2. Add `logAuditEvent` to `DentalMembershipManagement_deactivate.ts` (AL-004)
3. Either route `deactivateMember.ts` or remove it (it duplicates `DentalMembershipManagement_deactivate`)

---

## §6 — Remediation Priority (Updated)

**Immediate (P0 — before next prod deploy):**

1. AL-003: `DentalMembershipManagement_create.ts` — add `logAuditEvent`
2. AL-004: `DentalMembershipManagement_deactivate.ts` — add `logAuditEvent`
3. AL-005: `createDentalPatient.ts` — add `logAuditEvent`
4. AL-008: `cancelAppointment.ts` — add `logAuditEvent`
5. AL-009: `createDentalInvoice.ts` — add `logAuditEvent`
6. AL-013: `generatePMD.ts` — add `logAuditEvent`
7. AL-025: `exportPMD.ts` — add `logAuditEvent`
8. AL-001: `DentalOrganizationManagement_create.ts` — add `logAuditEvent`
9. AL-002: `DentalBranchManagement_create.ts` — add `logAuditEvent`
10. AL-023/024: `emr/createConsultation.ts` + `emr/getConsultation.ts` — replace `logger.info` with `logAuditEvent`

**Sprint 1 (P2 — replace logger.info with logAuditEvent):**

11. AL-017: `updateDentalVisit.ts` lock path
12. AL-018: `archiveDentalPatient.ts`
13. AL-019: `createPrescription.ts`
14. AL-010: `recordDentalPayment.ts`

**Sprint 1 (schema):**

15. Add `event_type` + `actor_role` to shim + `dental_audit_log` schema migration (fixes AL-014/015/016)
16. Wire `ip_address` + `user_agent` through shim

**Sprint 2 (P3):**

17. AL-020: Self-audit in `getAuditEvents.ts`
18. AL-021/022: `signConsentForm.ts` + `revokeConsentForm.ts` — add `logAuditEvent`
