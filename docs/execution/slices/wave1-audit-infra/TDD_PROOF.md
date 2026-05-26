# TDD_PROOF.md — Wave 1: Audit Infrastructure (IDEAL-GAP-P1-001)

## Config Self-Check
- `workflow.tdd_mode: true` ✓
- `agent_skills.gsd-executor: ["skills/oli-execution-gate"]` ✓
- SLICE_SPEC: derived from `docs/audits/IDEAL_COMPLIANCE_GAPS.md` (no SLICE_SPEC.md present — WARNING, proceeding)

## Spec Items
| ID | Description | Test File | RED Output | Status |
|----|-------------|-----------|------------|--------|
| AC-001 | logAuditEvent with visit.complete writes to dental_audit | dental-audit-wiring.test.ts | Received: 3 (stale rows; fixed with tenantId filter) | COVERED |
| AC-002 | logAuditEvent with treatment.performed writes to dental_audit | dental-audit-wiring.test.ts | PASS immediately (logAuditEvent already worked) | COVERED |
| AC-003 | query() filters by branchId — multi-branch scoping | dental-audit-wiring.test.ts | **Received: 485 (no branchId filter)** → TRUE RED | COVERED |
| AC-004 | AUD-BR-004 required fields present on every entry | dental-audit-wiring.test.ts | PASS immediately | COVERED |
| AC-005 | logAuditEvent with discount.applied writes to dental_audit | dental-audit-wiring.test.ts | PASS immediately | COVERED |

## RED Phase
```
bun test src/db/dental-audit-wiring.test.ts

FAIL AC-003: query() filters by branchId
  Expected: 1
  Received: 485   ← no branchId column/filter existed
4 pass, 1 fail
```

## Implementation
| Change | File |
|--------|------|
| Add `branchId uuid` column + `branchTimestampIdx` index | `src/db/audit.schema.ts` |
| Add `branchId?: string` to `AuditFilters` + `eq` condition | `src/db/audit.repo.ts` |
| Add `branchId?: string` to `AuditEvent` interface + pass to repo.log | `src/core/audit-logger.ts` |
| Wire `logAuditEvent()` on `status === 'completed'` | `src/handlers/dental-visit/updateDentalVisit.ts` |
| Wire `logAuditEvent()` on `status === 'performed'` | `src/handlers/dental-visit/updateDentalTreatment.ts` |
| Wire `logAuditEvent()` after `voidInvoice()` | `src/handlers/dental-billing/voidDentalInvoice.ts` |
| Wire `logAuditEvent()` after `applyDiscount()` | `src/handlers/dental-billing/applyDentalDiscount.ts` |
| DB migration: `ALTER TABLE dental_audit ADD COLUMN branch_id uuid` | `src/generated/migrations/0059_slippery_colleen_wing.sql` |
| Add `branchId` to 4 existing seed rows + 2 new audit seed events | `scripts/seed-data/audit-logs.ts` |
| New IDs AUDIT_05, AUDIT_06 | `scripts/seed-data/ids.ts` |

## GREEN Phase
```
bun test src/db/dental-audit-wiring.test.ts

5 pass, 0 fail  ✓
```

## Coverage Verification
| ID | Test File:Line | Status |
|----|---------------|--------|
| AC-001 | dental-audit-wiring.test.ts:43 | COVERED |
| AC-002 | dental-audit-wiring.test.ts:57 | COVERED |
| AC-003 | dental-audit-wiring.test.ts:70 | COVERED |
| AUD-BR-004 | dental-audit-wiring.test.ts:95 | COVERED |
| AC-005 | dental-audit-wiring.test.ts:110 | COVERED |

## Regression Check
- Handler tests (billing + visit): 114 pass, 2 fail
- 2 pre-existing failures: `upsertDentalChart` (not touched by this slice)
- TypeScript errors: 0 in modified files; 4 pre-existing in unrelated files
- `logAuditEvent` is fire-and-forget — handler behavior unchanged on audit failure

## Spec Compliance
| Check | Result |
|-------|--------|
| Environment safety | No hardcoded secrets |
| branchId nullable | ✓ — org-level events allowed without branch context |
| Never propagates | ✓ — try/catch in audit-logger.ts |

## Drift Check
- API_CONTRACTS: not affected (no new endpoints)
- DOMAIN_MODEL: `dental_audit` entity gains `branchId` — consistent with IDEAL §3.13

## Spec Anchors
| Test | Spec Item | Source |
|------|-----------|--------|
| dental-audit-wiring.test.ts:43 | AC-001 | IDEAL §3.13 AuditLog.action |
| dental-audit-wiring.test.ts:70 | AC-003 | IDEAL §3.13 queryable by branchId |
| dental-audit-wiring.test.ts:95 | AUD-BR-004 | IDEAL §3.13 required fields |
