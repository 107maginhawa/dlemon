# Audit Compliance Report — dental-audit
**Run ID:** run-6-strict-2026-05-29
**Scope:** AUDIT_CONTRACTS.md §3 — all 25 mandatory audit events
**Method:** Static analysis of `services/api-ts/src/handlers/` — grep for `logAuditEvent`, `audit.logEvent`, `logEvent`, Pino info calls at audit callsites

---

## Summary

| Metric | Value |
|--------|-------|
| Contracts checked | 25 |
| Contracts PRESENT (any audit call) | 9 |
| Contracts MISSING (no audit call) | 16 |
| Schema gaps (fields missing vs §2) | 5 |
| New findings | 22 |

### Severity breakdown
| Severity | Count |
|----------|-------|
| P0 (PHI operation — no audit) | 13 |
| P1 (audit present, missing required fields) | 3 |
| P2 (wrong schema / non-compliant call) | 3 |
| P3 (non-PHI gap) | 3 |

---

## §1 — Infrastructure Assessment

### 1.1 `logAuditEvent` (core shim)
Location: `services/api-ts/src/core/audit-logger.ts`

**Interface accepted:**
```
personId, tenantId, branchId?, action, resourceType, resourceId?,
metadata?, reason?, before?, after?
```
Writes to both `dental_audit` (legacy) and `dental_audit_log` (spec table). Never throws. ✅ correct pattern.

### 1.2 `dental_audit_log` schema vs §2 contract

| §2 Contract Field | Schema Column | Status |
|-------------------|---------------|--------|
| `id` | `id` (baseEntityFields) | ✅ |
| `event_type` | MISSING | ❌ |
| `actor_id` | `actor_id` | ✅ |
| `actor_role` | MISSING | ❌ |
| `branch_id` | `branch_id` | ✅ (nullable — but contract requires it) |
| `aggregate_type` | `target_type` | ⚠ renamed |
| `aggregate_id` | `target_id` | ⚠ renamed |
| `action` | `action` | ✅ |
| `occurred_at` | `timestamp` | ⚠ renamed |
| `ip_address` | MISSING | ❌ |
| `user_agent` | MISSING | ❌ |
| `metadata` | MISSING (has `before_snapshot`/`after_snapshot` instead) | ❌ |

**Schema gap count: 5** (`event_type`, `actor_role`, `ip_address`, `user_agent`, `metadata`)
Renamed fields (`target_type`/`aggregate_type`, `target_id`/`aggregate_id`, `timestamp`/`occurred_at`) are functional equivalents but break the §2 wire contract.

### 1.3 Consumer (pg-boss)
`registerAuditDomainEventConsumer` registered in `app.ts:510` for queue `dental.audit.domain-events`. ✅

**BUT:** Consumer handles a single generic queue — it does NOT route or validate individual DE-001…DE-024 event codes. No `event_type` routing/enumeration. P2 finding below.

---

## §2 — Per-Contract Findings

### dental-org

| Contract | Handler | Audit Call | Status |
|----------|---------|------------|--------|
| CREATED (org) | `DentalOrganizationManagement_create.ts` | None | ❌ MISSING |
| CREATED (branch) | `DentalBranchManagement_create.ts` | None | ❌ MISSING |
| CREATED (membership) | `DentalMembershipManagement_create.ts` | None | ❌ MISSING |
| DELETED (membership) | `DentalMembershipManagement_deactivate.ts` | None | ❌ MISSING |
| ACCESSED (audit log) | `getAuditEvents.ts` | None | ❌ MISSING |

Note: `DentalMembershipManagement_verifyPin.ts` and `verifyPin.ts` DO call `logAuditEvent` (via `@/handlers/audit/repos/audit.facade`) — but verifyPin is not a contracted event.

---

### dental-patient

| Contract | Handler | Audit Call | Status |
|----------|---------|------------|--------|
| CREATED | `createDentalPatient.ts` | None | ❌ MISSING |
| READ (view profile) | `getDentalPatient.ts` | `logAuditEvent` line 66 | ✅ |
| UPDATED (archive) | `archiveDentalPatient.ts` | `logger.info` only — no `logAuditEvent` | ⚠ P2 |
| ACCESSED (export) | `exportDentalPatients.ts` | `logger.info` only — no `logAuditEvent` | ❌ MISSING |

---

### dental-visit

| Contract | Handler | Audit Call | Status |
|----------|---------|------------|--------|
| CREATED | `createDentalVisit.ts` | `logAuditEvent` line 44 | ✅ |
| UPDATED (complete) | `updateDentalVisit.ts` | `logAuditEvent` line 127 | ✅ |
| UPDATED (lock) | `updateDentalVisit.ts` | `log.info` only at line 141 — no `logAuditEvent` | ⚠ P2 |

The `lock` path returns early (line 142) without calling `logAuditEvent`; only a Pino `info` log is emitted.

---

### dental-scheduling

| Contract | Handler | Audit Call | Status |
|----------|---------|------------|--------|
| CREATED (book) | `createAppointment.ts` | None | ❌ MISSING |
| DELETED (cancel) | `cancelAppointment.ts` | None | ❌ MISSING |

---

### dental-billing

| Contract | Handler | Audit Call | Status |
|----------|---------|------------|--------|
| CREATED (invoice) | `createDentalInvoice.ts` | None | ❌ MISSING |
| UPDATED (payment) | `recordDentalPayment.ts` | None | ❌ MISSING |
| UPDATED (void) | `voidDentalInvoice.ts` | `logAuditEvent` line 57 | ✅ |

---

### dental-clinical

| Contract | Handler | Audit Call | Status |
|----------|---------|------------|--------|
| CREATED (prescription) | `createPrescription.ts` | `logger.info` only (no `logAuditEvent`) | ⚠ P2 |
| UPDATED (consent sign) | `signConsentForm.ts` | `logger.info` only (no `logAuditEvent`) | ❌ MISSING |
| UPDATED (consent revoke) | No revoke handler exists | N/A — handler absent | ❌ MISSING |

---

### dental-imaging

| Contract | Handler | Audit Call | Status |
|----------|---------|------------|--------|
| CREATED (upload study) | `createImagingStudy.ts` | None | ❌ MISSING |
| READ (access study) | `getImagingStudy.ts` | None | ❌ MISSING |

---

### dental-pmd

| Contract | Handler | Audit Call | Status |
|----------|---------|------------|--------|
| CREATED (generate) | `generatePMD.ts` | None | ❌ MISSING |
| ACCESSED (download) | `exportPMD.ts` | None | ❌ MISSING |

Note: `getImportedPMD.ts` calls `audit.logEvent` (legacy pattern, wrong schema) — but this is not the contracted "download PMD" operation.

---

### dental-emr

| Contract | Handler | Audit Call | Status |
|----------|---------|------------|--------|
| CREATED (import) | Handler directory EMPTY | ❌ Module not implemented |
| READ (view) | Handler directory EMPTY | ❌ Module not implemented |

---

## §3 — Finding Register

### P0 Findings (PHI operation — no audit log)

| ID | Module | Operation | Handler | Notes |
|----|--------|-----------|---------|-------|
| AL-001 | dental-org | Create org | `DentalOrganizationManagement_create.ts` | Org creation creates tenant/PHI context |
| AL-002 | dental-org | Create branch | `DentalBranchManagement_create.ts` | Branch is PHI scope boundary |
| AL-003 | dental-org | Assign membership | `DentalMembershipManagement_create.ts` | Staff access grant — HIPAA identity mgmt |
| AL-004 | dental-org | Revoke membership | `DentalMembershipManagement_deactivate.ts` | Staff access revocation — HIPAA |
| AL-005 | dental-patient | Create patient | `createDentalPatient.ts` | PHI record creation — mandatory |
| AL-006 | dental-patient | Export patients | `exportDentalPatients.ts` | Bulk PHI export — highest risk |
| AL-007 | dental-scheduling | Book appointment | `createAppointment.ts` | Appointment is PHI (links patient + time) |
| AL-008 | dental-scheduling | Cancel appointment | `cancelAppointment.ts` | PHI modification |
| AL-009 | dental-billing | Create invoice | `createDentalInvoice.ts` | Financial PHI |
| AL-010 | dental-billing | Record payment | `recordDentalPayment.ts` | Financial PHI |
| AL-011 | dental-imaging | Upload study | `createImagingStudy.ts` | Radiograph = PHI |
| AL-012 | dental-imaging | Access study | `getImagingStudy.ts` | Radiograph access = HIPAA READ audit |
| AL-013 | dental-pmd | Generate PMD | `generatePMD.ts` | PMD = compiled patient PHI |

### P1 Findings (audit present, missing required §2 fields)

| ID | Module | Operation | Handler | Missing Fields |
|----|--------|-----------|---------|---------------|
| AL-014 | dental-visit | UPDATED (complete) | `updateDentalVisit.ts` | `event_type`, `actor_role` not in `logAuditEvent` call (shim doesn't map them) |
| AL-015 | dental-visit | CREATED | `createDentalVisit.ts` | `event_type`, `actor_role` not in `logAuditEvent` call |
| AL-016 | dental-billing | UPDATED (void) | `voidDentalInvoice.ts` | `event_type`, `actor_role` not in `logAuditEvent` call |

Root cause: `logAuditEvent` shim interface omits `event_type` (DE-NNN code) and `actor_role` fields entirely — all callers inherit this gap.

### P2 Findings (audit present, wrong schema / non-compliant)

| ID | Module | Operation | Handler | Issue |
|----|--------|-----------|---------|-------|
| AL-017 | dental-visit | UPDATED (lock) | `updateDentalVisit.ts` line 141 | `log.info()` only — not persisted to audit table |
| AL-018 | dental-patient | UPDATED (archive) | `archiveDentalPatient.ts` line 43 | `logger.info()` only — not persisted to audit table |
| AL-019 | dental-clinical | CREATED (prescription) | `createPrescription.ts` line 63 | `logger.info()` only — not persisted to audit table |

### P3 Findings (non-PHI gap)

| ID | Module | Operation | Handler | Issue |
|----|--------|-----------|---------|-------|
| AL-020 | dental-org | ACCESSED (audit log) | `getAuditEvents.ts` | Self-audit on audit log access not implemented |
| AL-021 | dental-clinical | UPDATED (consent sign) | `signConsentForm.ts` line 43 | `logger.info()` only — not persisted; consent signing is compliance-critical |
| AL-022 | dental-clinical | UPDATED (consent revoke) | N/A | No revoke handler exists at all |

### P3 — Module Not Implemented

| ID | Module | Status |
|----|--------|--------|
| AL-023 | dental-emr (CREATED import) | Handler directory empty — module not built |
| AL-024 | dental-emr (READ view) | Handler directory empty — module not built |
| AL-025 | dental-pmd (ACCESSED download) | `exportPMD.ts` has no audit call |

---

## §4 — Schema Gap Detail (AL-P1-ROOT)

**Root cause:** `logAuditEvent` shim (`/core/audit-logger.ts`) and `dental_audit_log` schema both omit fields mandated by §2:

| Field | §2 Required | In schema | In shim | Fix needed |
|-------|-------------|-----------|---------|------------|
| `event_type` | YES | NO | NO | Add to schema + shim |
| `actor_role` | YES | NO | NO | Add to schema + shim |
| `ip_address` | Optional | NO | NO | Add to schema + shim |
| `user_agent` | Optional | NO | NO | Add to schema + shim |
| `metadata` | YES | NO (has snapshots) | YES (`metadata` field) | Wire through to schema |

Column renames also break §2 wire contract:
- `target_type` → should be `aggregate_type`
- `target_id` → should be `aggregate_id`
- `timestamp` → should be `occurred_at`

---

## §5 — Consumer Gaps

The pg-boss consumer (`domain-events.consumer.ts`) handles a single generic queue `dental.audit.domain-events`. It correctly persists the event to `dental_audit_log`.

**Gaps:**
1. No `event_type` field in `DentalAuditDomainEvent` interface — DE-NNN codes never stored
2. No `actor_role` in interface
3. Consumer is registered but `publishAuditEvent` is never called by any handler — only `logAuditEvent` (direct write) is used; the async queue path is dead code

---

## §6 — Remediation Priority

**Immediate (before next prod deploy):**
1. Add `logAuditEvent` to all P0 handlers (AL-001 through AL-013)
2. Fix P2 handlers — replace `logger.info()` with `logAuditEvent` (AL-017, AL-018, AL-019)

**Sprint 1:**
3. Add `event_type` + `actor_role` to shim interface + schema migration
4. Wire `ip_address` + `user_agent` through shim
5. Fix column renames in `dental_audit_log` to match §2 contract

**Sprint 2:**
6. Implement consent revoke handler (AL-022)
7. Add self-audit to `getAuditEvents` (AL-020)
8. Implement dental-emr module or mark as out-of-scope (AL-023/024)
