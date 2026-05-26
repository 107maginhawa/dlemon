# IDEAL Compliance Gaps — Dentalemon
<!-- oli-v1 | generated: 2026-05-26 | standard: IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md -->

> **Scope:** `apps/dentalemon` (frontend) + `services/api-ts` (backend)
> **Standard:** `docs/audits/reference/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md`
> **V1 Readiness:** 🟡 YELLOW — Core workflows present and tested; 2 structural V1-Required gaps remain

---

## Executive Summary

This document is the authoritative compliance gap registry for the Dentalemon dental management platform measured against the IDEAL Dental Module Workflow Standard. It supersedes `IDEAL_STANDARD_GAP_REVIEW.md` (stale — written before several fixes landed) with verified-in-code findings as of 2026-05-26.

**Key finding:** The system is substantially compliant. Many gaps flagged in the previous review are **already resolved** in the current codebase. Two structural V1-Required items remain open and must be addressed before a production release rating of Green.

| Category | Count | Status |
|----------|------:|-------|
| P1 — V1 Required, blocking | 2 | CLOSED (Wave 2) |
| P1 — V1 Required, verify-only | 1 | CLOSED (Wave 2) |
| P2 — V1 Recommended | 12 | Important, not blocking |
| P3 — V2/Deferred | 6 | Informational |
| Confirmed Closed (vs prior review) | 6 | No action needed |

---

## Module Coverage Map

| IDEAL §3 Context | Module | Backend | Tests | Frontend | Status |
|------------------|--------|---------|-------|----------|--------|
| 3.1 Clinic & Organization | dental-org | ✅ | ✅ | ✅ | **COMPLIANT** |
| 3.2 Patient | dental-patient | ✅ | ✅ | ✅ | **COMPLIANT** |
| 3.3 Appointment & Queue | dental-scheduling | ✅ | ✅ | ✅ | **COMPLIANT** |
| 3.4 Clinical Encounter | dental-visit | ✅ | ✅ | ✅ | **COMPLIANT** |
| 3.5 Dental Charting | dental-visit | ✅ | PARTIAL | ✅ | **⚠ CHART-BR-002 test gap** |
| 3.6 Treatment Plan | dental-patient | ✅ | ✅ | ✅ | **COMPLIANT** |
| 3.7 Procedure & Clinical Work | dental-visit | ✅ | ✅ | ✅ | **COMPLIANT** |
| 3.8 Billing & Payments | dental-billing | ✅ | ✅ | ✅ | **COMPLIANT** |
| 3.9 Claims / Insurance | — | PARTIAL | — | PARTIAL | **⚠ CDT exists; no insurance profile/claim draft** |
| 3.10 Imaging & Attachments | dental-imaging | ✅ | ✅ | ✅ | **COMPLIANT** |
| 3.11 Inventory / Materials | dental-clinical | ✅ | — | PARTIAL | **⚠ no lifecycle status field** |
| 3.12 Communication & Follow-up | — | PARTIAL | — | PARTIAL | **⚠ notifs/comms not audited** |
| 3.13 Audit, Local-First & Sync | dental-audit | PARTIAL | PARTIAL | PARTIAL | **❌ no queryable audit table** |

---

## P1 — V1 Required Gaps (2 open + 1 verify)

### IDEAL-GAP-P1-001 · Queryable Audit Log Table Missing
**Standard refs:** §3.13, §5.11 AUD-BR-001–004, §6.8 AuditLog, §7.2 "View audit logs", §10.1 seed
**Priority:** P1 — V1 Required
**Status:** OPEN

**Evidence:**
- `services/api-ts/src/handlers/dental-audit/` contains only `getAuditEvents.ts` — no `repos/*.schema.ts`
- No `dental_audit_log` table in any schema file
- Audit data lives in Pino structured logs (log files) — not queryable from the API
- `§6.8 AuditLog` prescribes `{ actorId, action, targetType, targetId, timestamp, reason, before, after }` as V1 Required
- `§7.2` permission matrix has a "View audit logs" row for Admin/Dentist/Billing — this UI cannot be implemented without a queryable store
- `§10.1` requires seed rows for audit logs: "Clinical and billing examples — V1 Required"

**Impact:** Compliance reviewers, auditors, and the "View audit logs" UI screen have no queryable data source. AUD-BR-004 ("Audit logs should include actor, action, target, timestamp, before/after") cannot be tested.

**Fix:**
```
1. Create dental-audit/repos/audit-log.schema.ts:
   dental_audit_log { id, tenantId, branchId, actorId, action, targetType,
                      targetId, timestamp, reason, beforeSnapshot jsonb,
                      afterSnapshot jsonb }
2. Create AuditLogRepository with insert(event) + list(filters) methods
3. Wire insert() calls at: visit completed, treatment performed,
   discount applied, invoice voided, role changed, consent signed
4. Update getAuditEvents.ts to query dental_audit_log (not just mock/logs)
5. Add migration
6. Add seed rows in scripts/seed-demo.ts (5–10 representative events)
7. Add AUD-BR-004 test in dental-audit handler tests
```

---

### IDEAL-GAP-P1-002 · Chart Layer Immutability Test Missing
**Standard refs:** §3.5, §5.4 CHART-BR-001, CHART-BR-002
**Priority:** P1 — V1 Required
**Status:** CLOSED — 2026-05-26

**Evidence:**
- `dental-chart.schema.ts:53-61` stores teeth as a single `jsonb` array keyed by `visitId`
- `entryClassification` enum `('existing'|'existing_other'|'treatment_plan'|'condition')` separates layers as metadata inside the jsonb blob — not physically separate tables
- CHART-BR-001: "Baseline chart entries must be separate from proposed and completed work"
- CHART-BR-002: "Completed work must not overwrite baseline chart entries"
- Tests `dental-chart-baseline.test.ts`, `dental-visit-module3-6.test.ts` exist but grep confirms **no test explicitly asserts CHART-BR-002** (no test file matches `CHART-BR-002|baseline.*overwrite|immutab`)

**Impact:** A code change that accidentally allows a chart update to mutate baseline entries would pass all current tests silently. This is a clinical data integrity risk.

**Fix:**
```
Option A (preferred — minimal): Add explicit CHART-BR-002 property tests:
  - Test: upsertDentalChart({ classification: 'treatment_plan' }) does NOT
    alter any existing/existing_other entries in same visit
  - Test: completing a treatment item does NOT modify dental_chart_baseline row
  - Test: multiple chart updates are additive (append-only per classification)

Option B (structural): Split dental_chart into dental_chart_proposed +
  dental_chart_completed tables — more guarantees, larger migration.
  Recommend Option A first to prove safety, Option B in Wave G1+.
```

---

### IDEAL-GAP-P1-003 · J15 Offline E2E Journey — Verify Passes
**Standard refs:** §4.6, §9.2 E2E-009, §3.13 LF-BR-001–004
**Priority:** P1 — Verify (may already pass)
**Status:** CLOSED — 2026-05-26

**Evidence:**
- `apps/dentalemon/tests/e2e/journeys/15-offline-sync-metadata.journey.spec.ts:27` now says `expectedVerdict: 'PASS'`
- BUT file header comment (lines 2–10) still says "Expected verdict: BROKEN" — comment not updated
- `syncableEntityFields` IS applied to all 4 clinical entities (visit, chart, treatment, invoice) ✅
- Step 4 of J15 creates a Visit with `localId: 'offline-e2e-visit-001'` and asserts `visitBody.localId` is stored

**Impact:** If J15 actually passes, GAP-001/GAP-002 from the prior review are FULLY closed. If it fails, there's a backend handler gap (POST /dental/visits not accepting/returning `localId`).

**Fix:**
```
1. Run J15 in isolation: cd apps/dentalemon && bun run test:e2e --grep "J15"
2. If PASS → mark CLOSED, update file comment, add to BROWNFIELD_STATUS
3. If FAIL → check what specific step fails and fix the handler/response serialization
4. Also update J15 file header comment to remove the stale "BROKEN" text
```

---

## P2 — V1 Recommended Gaps (12 open)

### IDEAL-GAP-P2-001 · dental-clinical Direct Repo Imports from dental-visit
**Standard refs:** §3.4, §3.7, IDEAL bounded context isolation
**Status:** OPEN (reclassified MEDIUM by spec-consistency F-034)

`dental-clinical` imports directly from `dental-visit` schema files in 7 places:
```
repos/amendment.schema.ts     → import { dentalVisits }
repos/attachment.schema.ts    → import { dentalVisits }
repos/lab-order.schema.ts     → import { dentalVisits }
repos/prescription.schema.ts  → import { dentalVisits }
repos/consent-form.schema.ts  → import { dentalVisits }, { treatmentPlanVersions }
createAttachment.ts            → import { getVisitOrThrow }
... and 5 other handler files → import { getVisitOrThrow }
```

**Fix:** Route through dental-visit's API layer (`getVisitOrThrow` via service, not direct repo import for schema FKs). For schema FKs, use UUID references only with no FK constraint, or extract shared visit-id type. Full refactor in Wave G1.

---

### IDEAL-GAP-P2-002 · Pediatric Charting Unwired (Always Sends Permanent)
**Standard refs:** §3.5, §3.2 Patient (age-based dentition)
**Status:** OPEN (DENTAL-009)

- `universal-tooth-fdi.tsx` supports pediatric (FDI 1-20 / primary dentition)
- `initializeDentition` has `dentitionType` param but frontend always passes `permanent`
- Pediatric patients get 32-tooth adult layout regardless of age

**Fix:** Wire age-based dentition detection — if patient DOB < ~12 years, send `dentitionType: 'primary'` and switch UI to 20-tooth layout.

---

### IDEAL-GAP-P2-003 · dental-audit Has No Handler Directory Structure
**Standard refs:** §3.13, module organization
**Status:** OPEN (DENTAL-022)

`dental-audit/` contains only `getAuditEvents.ts` — no `repos/`, no `index.ts`, no test file. Pairs with P1-001 (creating the schema will fix this structurally).

**Fix:** Resolve as part of IDEAL-GAP-P1-001 — creating the full handler structure.

---

### IDEAL-GAP-P2-004 · Seed Has No Audit Log Rows
**Standard refs:** §10.1 "Audit logs — V1 Required"
**Status:** OPEN (IDEAL GAP-012)

`scripts/seed-demo.ts` has zero inserts into any audit table. `GET /dental/audit-events` returns empty list against demo seed.

**Fix:** After P1-001 creates the table, add 5–10 representative seed rows: visit-completed, treatment-performed, discount-applied, invoice-voided, role-changed.

---

### IDEAL-GAP-P2-005 · No Offline/Sync Records in Seed
**Standard refs:** §10.1 "Local/sync records — unsynced local record sample — V1 Required"
**Status:** OPEN

Seed has no row demonstrating `syncStatus = 'pending'` or a visit created with `localId`. Cannot demo offline-readiness from seed data.

**Fix:** Add 1 visit row with `localId: 'demo-offline-001', syncStatus: 'pending'` to seed.

---

### IDEAL-GAP-P2-006 · InventoryItem Missing Lifecycle Status Field
**Standard refs:** §3.11, §6.8 InventoryItem
**Status:** OPEN (IDEAL GAP-004)

`dental-clinical/repos/inventory.schema.ts` has no `status` field. IDEAL §6.8 prescribes `status: active | depleted | discontinued`.

**Fix:** Add `status text default 'active'` with enum `['active', 'depleted', 'discontinued']` + migration.

---

### IDEAL-GAP-P2-007 · Spec-Consistency MEDIUM Findings (12 items)
**Standard refs:** Various (C1–C8 checks)
**Status:** OPEN (CONSISTENCY_REPORT.md MEDIUM severity)

12 MEDIUM findings in CONSISTENCY_REPORT.md. Key items:
- F-001: `Focal Card` term missing from DOMAIN_GLOSSARY
- F-002: `Baseline` (chart snapshot) missing from DOMAIN_GLOSSARY
- F-003: `voided` vs `void` invoice terminal state inconsistency
- F-004: `booked` vs `scheduled` appointment initial state in API_CONTRACTS header comment
- F-005: `imagingTier` missing from DOMAIN_GLOSSARY
- F-006: `Carry-over` missing from DOMAIN_GLOSSARY
- F-007: `notes_count` field in MODULE_SPEC not in API_CONTRACTS
- F-008: Computed response fields (`subtotal_cents`, `paid_cents`, `outstanding_cents`) not documented in MODULE_SPEC §7
- F-009: `notes` field in API_CONTRACTS POST /invoices missing from MODULE_SPEC §7
- F-023: "Reopen" action in screens.md not in state machine
- F-024: discount fields in screens.md not in MODULE_SPEC §7 or API_CONTRACTS
- F-025: AppointmentRescheduled event gap

**Fix:** DOMAIN_GLOSSARY additions (4 terms), API_CONTRACTS/MODULE_SPEC reconciliation (8 items). Low effort per item, can batch.

---

### IDEAL-GAP-P2-008 · No Insurance Profile / Claim Readiness
**Standard refs:** §3.9 Claims / Insurance (V1 Recommended items)
**Status:** OPEN (untracked)

IDEAL §3.9 recommends: insurance profile (payer/policy), claim readiness review, claim draft. Only CDT code seeding exists. Not blocking V1 but a notable product gap for typical dental clinic billing workflow.

**Fix:** V1 Recommended — scope as a future wave feature. Document in MODULE_MAP as `dental-claims` planned module.

---

### IDEAL-GAP-P2-009 · dental-emr Zombie Spec Not Clarified
**Standard refs:** §3.4 Clinical Encounter (dental-visit IS the EMR)
**Status:** OPEN (DENTAL-007/020)

`docs/product/modules/dental-emr/MODULE_SPEC.md` exists with INFERRED-only workflows. No backend handler exists. Causes confusion: three things named "EMR" (dental-emr spec, dental-visit implementation, emr base handler).

**Fix:**
1. Rename `docs/product/modules/dental-emr/` → `docs/product/modules/dental-emr-integration/`
2. Update MODULE_SPEC: purpose = "external EMR data import (Open Dental, Dentrix bridge) — future phase"
3. Add comment in MODULE_MAP.md: "dental-visit is the active dental EMR"

---

### IDEAL-GAP-P2-010 · docs/modules/ Stale Duplicate Directory
**Standard refs:** N/A — developer confusion risk
**Status:** OPEN (DENTAL-024)

`docs/modules/` has 10 MODULE_SPEC files; `docs/product/modules/` has 11 (canonical, includes dental-perio). The older directory will drift.

**Fix:** `git rm -r docs/modules/` and update any cross-references in ARCHITECTURE.md/CLAUDE.md.

---

### IDEAL-GAP-P2-011 · QueueItem State Naming Drift
**Standard refs:** §3.3 Appointment & Queue, §6.3 QueueItem
**Status:** OPEN (IDEAL GAP-005, refined to P3/P2 borderline)

Implementation uses `ready_for_checkout`; IDEAL standard prescribes `with_provider`. Minor semantic drift.

**Fix:** Either rename the enum value and migrate, or note the deliberate deviation in MODULE_SPEC §8.

---

### IDEAL-GAP-P2-012 · Manual Route Overrides Bypass TypeSpec Pipeline
**Standard refs:** §architecture, API-first principle
**Status:** OPEN (DENTAL-012)

Some manual route registrations in `services/api-ts/src/app.ts` bypass the TypeSpec → OpenAPI → generated routes pipeline. This means those endpoints are not in the OpenAPI spec and cannot be tested via contract tests.

**Fix:** Migrate manual overrides to TypeSpec-first. Requires TypeSpec definition + regen cycle per endpoint.

---

## P3 — V2/Deferred Gaps (informational)

| Gap | Standard Ref | Description | Suggested Action |
|-----|--------------|-------------|-----------------|
| IDEAL-GAP-P3-001 | §3.9 | Clearinghouse integration (ERA/EOB, electronic submission) | V2 feature — scope as dental-claims module |
| IDEAL-GAP-P3-002 | §3.12 | Communication & follow-up context not audited | Audit recalls/comms module coverage |
| IDEAL-GAP-P3-003 | §3.10 | dental-imaging + dental-ceph should split into two distinct modules | Architecture refactor — Wave G2+ |
| IDEAL-GAP-P3-004 | §5.5 PLAN-BR-005 | "Discount / write-off has permission check" — already done for invoices; treatment plan estimates not explicitly gated | Minor — add PLAN-BR-005 test |
| IDEAL-GAP-P3-005 | §9.2 | E2E journey coverage: J16-J20 (claims, comms, offline-conflict, report) not yet written | Write journeys as modules are implemented |
| IDEAL-GAP-P3-006 | §6.3 | `with_provider` vs `ready_for_checkout` QueueItem state naming | Document deliberate deviation OR rename |

---

## Items Confirmed Closed (prior review was stale)

These items were marked P1 in `IDEAL_STANDARD_GAP_REVIEW.md` but are **verified resolved in the current codebase** as of 2026-05-26:

| Prior Gap | Finding | Evidence |
|-----------|---------|----------|
| IDEAL GAP-001: sync fields missing | **RESOLVED** — `syncableEntityFields` spread on visit, chart, treatment, invoice | `visit.schema.ts:25`, `dental-chart.schema.ts:55`, `treatment.schema.ts:24`, `dental-invoice.schema.ts:22` |
| IDEAL GAP-003: `in_progress` FSM state | **RESOLVED** — schema uses `partially_completed` | `treatment-plan.schema.ts: approved: ['partially_completed', 'cancelled']` |
| IDEAL GAP-009: discount reason missing | **RESOLVED** — schema + validator both enforce reason | `dental-invoice.schema.ts:36-37` + `applyDentalDiscount.ts:41` |
| BROWNFIELD roles: Dental Assistant etc. missing | **RESOLVED** — roles exist | `membership.schema.ts: 'dental_assistant', 'front_desk', 'billing_staff'` |
| Spec-consistency HIGH failures | **ALL RESOLVED** | `CONSISTENCY_REPORT.md`: F-016, F-017, F-018, F-019, F-034, F-035 resolved |
| GAP-DENTAL-001–004 (P1 from system audit) | **ALL RESOLVED 2026-05-25** | BR-011, chart version, onError toasts, E2E CI gate |

---

## Execution Waves (for /oli-execution-gate)

Ordered by dependency and risk. Execute sequentially within each wave; waves are independent.

### Wave 1 — Audit Infrastructure (P1, foundation) [~4h]
**Depends on:** nothing
**Unblocks:** Wave 2, Wave 3 seed work

| Task | File(s) | Type |
|------|---------|------|
| Create `dental_audit_log` table schema | `dental-audit/repos/audit-log.schema.ts` | new-file |
| Create `AuditLogRepository` | `dental-audit/repos/audit-log.repo.ts` | new-file |
| Wire audit inserts at key events (visit complete, treatment perform, discount apply, invoice void) | 4 handler files | modify |
| Update `getAuditEvents.ts` to query audit table | `dental-audit/getAuditEvents.ts` | modify |
| Add migration | `generated/migrations/` | new-file |
| Add AUD-BR-004 handler tests | `dental-audit/audit.test.ts` | new-file |
| Seed: add 5–10 audit rows | `scripts/seed-demo.ts` | modify |

---

### Wave 2 — Chart Immutability + J15 Verification (P1) [~2h]
**Depends on:** nothing (parallel to Wave 1)

| Task | File(s) | Type |
|------|---------|------|
| Add CHART-BR-002 property tests | `dental-visit/dental-chart-baseline.test.ts` | modify |
| Run J15, fix handler if localId not returned | `15-offline-sync-metadata.journey.spec.ts` + visit handler | verify/fix |
| Update J15 file comment (remove stale "BROKEN" text) | `15-offline-sync-metadata.journey.spec.ts:2-10` | modify |
| Add seed offline record (`syncStatus: 'pending'`) | `scripts/seed-demo.ts` | modify |

---

### Wave 3 — Product Gaps (P2) [~6h]
**Depends on:** Wave 1 (for audit-related seed)

| Task | File(s) | Type |
|------|---------|------|
| Pediatric charting: wire dentitionType based on patient DOB | `workspace/components/dental/universal-tooth-fdi.tsx` + parent | modify |
| InventoryItem status field | `dental-clinical/repos/inventory.schema.ts` + migration | modify |
| dental-emr zombie spec rename | `docs/product/modules/dental-emr/` → `dental-emr-integration/` | rename |
| docs/modules/ stale duplicate removal | `git rm -r docs/modules/` | delete |
| dental-clinical cross-domain imports: extract `getVisitOrThrow` to shared service boundary | `dental-clinical/*.ts` (7 files) | modify |

---

### Wave 4 — Spec & Docs Cleanup (P2, low-risk) [~2h]
**Depends on:** nothing

| Task | File(s) | Type |
|------|---------|------|
| DOMAIN_GLOSSARY: add Focal Card, Baseline, imagingTier, Carry-over | `docs/product/DOMAIN_GLOSSARY.md` | modify |
| Fix `voided` → `void` in DOMAIN_GLOSSARY | `docs/product/DOMAIN_GLOSSARY.md` | modify |
| Fix `booked` → `scheduled` in API_CONTRACTS appointment header | `dental-scheduling/API_CONTRACTS.md` | modify |
| Add notes_count, subtotal/paid/outstanding_cents, notes field to MODULE_SPECs | 3 MODULE_SPEC files | modify |
| Fix screens.md "Reopen" reference + discount fields | 2 screens.md files | modify |
| Note QueueItem state deviation in MODULE_SPEC §8 | `dental-scheduling/MODULE_SPEC.md` | modify |

---

### Wave 5 — Architecture & TypeSpec (P2/P3, larger scope) [~8h]
**Depends on:** Wave 3

| Task | File(s) | Type |
|------|---------|------|
| Manual route → TypeSpec migration for bypassed endpoints | `app.ts` + TypeSpec sources | modify |
| dental-imaging/dental-ceph module split (V3 decision point) | architecture review | decision |
| dental-claims module: insurance profile + claim draft (V1 Recommended) | new module scope | new-feature |

---

## Running This with /oli-execution-gate

Each wave above maps to a GSD phase. Execute with:

```bash
# Wave 1 first — audit infrastructure unblocks everything
/gsd-execute-phase  # select Wave 1

# After Wave 1 passes: Wave 2 + Wave 3 can run in parallel
/gsd-execute-phase  # Wave 2
/gsd-execute-phase  # Wave 3

# Then cleanup
/gsd-execute-phase  # Wave 4
/gsd-execute-phase  # Wave 5 (optional, larger scope)
```

The `/oli-execution-gate` skill gates each phase on:
- `bun run typecheck` — must pass
- `bun run lint` — must pass
- `bun test` — must pass (no regressions)
- TDD: tests written RED before implementation, GREEN after

---

## V1 Acceptance Criteria (§13) Status

| Criterion | Status | Gap |
|-----------|--------|-----|
| Core clinic workflows function end-to-end | ✅ PASS | — |
| All business rules have at least one test | ✅ PASS | CHART-BR-002 covered (Wave 2) |
| Roles and permissions enforced | ✅ PASS | Roles exist, enforcement tested |
| Audit trail for clinical/billing actions | ❌ FAIL | No queryable audit table |
| Offline-readiness structural support | ✅ PASS | syncableEntityFields on all entities |
| Offline E2E journey passes | ✅ PASS | J15 comment fixed; offline seed added (Wave 2) |
| Seed data supports full demo workflow | PARTIAL | No audit rows (P1-001); offline record added (Wave 2) |
| iPad-first layout | ✅ PASS | Touch targets, carousel, responsive |
| No P0/P1 unresolved after remediation | PARTIAL | 1 P1 item remains (P1-001: audit table) |
