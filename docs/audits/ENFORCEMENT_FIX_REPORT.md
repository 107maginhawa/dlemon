# Enforcement Fix Report
<!-- oli-enforce-fix v1.0 | Run: 2026-05-27 | Branch: main -->

## Fix Summary

| Metric | Value |
|--------|-------|
| Findings in scope | 20 (Fix-Now P0 list) |
| Fixed this run | **19** |
| Blocked | **1** (EX-006 — event bus, own phase) |
| Pending (undispatched) | **0** |
| Loop | 2 of 3 |
| Commits | 13 atomic commits (40d433c, b045539 added) |

## Wave Classification

| Wave | Findings | Count | Status |
|------|----------|-------|--------|
| W1 Mechanical | EM-AUDIT-001, EM-AUDIT-003, EM-AUDIT-004, EM-PMD-005, EM-BILL-001 | 5 | ✅ All fixed |
| W2 Structural | EM-ORG-001, EM-ORG-002, EM-ORG-003, EM-ORG-004, EM-ORG-019, EM-ORG-020, EM-AUDIT-002, EM-BILL-006, UJ-ORG-003, UJ-ORG-004, UJ-IMG-007, TR-5B-003 | 12 | 10 fixed, 1 pending, 1 already-fixed |
| W3 Design | UJ-IMG-002, TR-5A-003, EX-006 | 3 | 1 already-fixed, 1 pending, 1 blocked |

Sum: 5+12+3=20 ✓

## Fix Log

| ID | Finding | Commit | Status |
|----|---------|--------|--------|
| EM-ORG-001 | Add authMiddleware to recoverPin route | 61ed52c | ✅ FIXED |
| EM-ORG-002 | assertBranchRole/self-check to setPin (both files) | d1acbb5 | ✅ FIXED |
| EM-ORG-003 | Strip securityAnswerHash/securityQuestion from listMembers | bdce591 | ✅ FIXED |
| EM-ORG-004 | Org ownership check in DentalOrganizationManagement_update | d1acbb5 | ✅ FIXED |
| EM-ORG-019 | authMiddleware({ roles: ["user"] }) on set-pin route | 61ed52c | ✅ FIXED |
| EM-ORG-020 | authMiddleware({ roles: ["user"] }) on verify-pin + trackLastLogin in facade | 61ed52c | ✅ FIXED |
| EM-AUDIT-001 | Role check admin→dentist_owner in getAuditEvents | 481af31 | ✅ FIXED |
| EM-AUDIT-002 | assertBranchAccess guard in getAuditEvents | 481af31 | ✅ FIXED |
| EM-AUDIT-003 | Remove displayName from verifyPin audit details (both files) | 144f74e | ✅ FIXED |
| EM-AUDIT-004 | Remove self-audit repo.logEvent() from listAuditLogs | 9bc870d | ✅ FIXED |
| UJ-IMG-002 | Annotation text XSS | — | ✅ ALREADY_FIXED (JSX string rendering, React-escaped) |
| UJ-IMG-007 | Replace innerHTML with textContent for API errors | — | ✅ ALREADY_FIXED (no innerHTML in imaging components) |
| UJ-ORG-003 | PIN session timer resets on user activity | ab78a03 | ✅ FIXED |
| UJ-ORG-004 | Write PIN session keys to localStorage on member selection | 48f1d4a | ✅ FIXED |
| EM-BILL-001 | Strip taxRate from createDentalInvoice accepted fields | 1fabc23 | ✅ FIXED |
| EM-BILL-006 | UUID-based invoice numbering (replace MAX race condition) | e429dcb | ✅ FIXED |
| EM-PMD-005 | Real node:crypto SHA-256 replacing charcode sum | 096e455 | ✅ FIXED |
| TR-5B-003 | pg-boss consumer for dental-audit domain events | 40d433c | ✅ FIXED |
| TR-5A-003 | Add baseline/proposed/completed layer to dental_chart | b045539 | ✅ FIXED |
| EX-006 | Implement event bus + emit all 23 domain events | — | 🚫 BLOCKED (see below) |

## Finding Manifest (Full — all 20 P0 Fix-Now findings)

| ID | Sev | Module | Wave | Status | Notes |
|----|-----|--------|------|--------|-------|
| EX-006 | P0 | cross-module | W3 | BLOCKED | Own phase needed |
| EM-ORG-001 | P0 | dental-org | W2 | FIXED | commit 61ed52c |
| EM-ORG-002 | P0 | dental-org | W2 | FIXED | commit d1acbb5 |
| EM-ORG-003 | P0 | dental-org | W1 | FIXED | commit bdce591 |
| EM-ORG-004 | P0 | dental-org | W2 | FIXED | commit d1acbb5 |
| EM-ORG-019 | P0 | dental-org | W2 | FIXED | commit 61ed52c |
| EM-ORG-020 | P0 | dental-org | W2 | FIXED | commit 61ed52c |
| EM-AUDIT-001 | P0 | dental-audit | W1 | FIXED | commit 481af31 |
| EM-AUDIT-002 | P0 | dental-audit | W2 | FIXED | commit 481af31 |
| EM-AUDIT-003 | P0 | dental-audit | W1 | FIXED | commit 144f74e |
| EM-AUDIT-004 | P0 | dental-audit | W1 | FIXED | commit 9bc870d |
| UJ-IMG-002 | P0 | dental-imaging | W3 | ALREADY_FIXED | JSX escapes annotation text |
| UJ-IMG-007 | P0 | dental-imaging | W2 | ALREADY_FIXED | No innerHTML in imaging UI |
| UJ-ORG-003 | P0 | dental-org | W2 | FIXED | commit ab78a03 |
| UJ-ORG-004 | P0 | dental-org | W2 | FIXED | commit 48f1d4a |
| EM-BILL-001 | P0 | dental-billing | W1 | FIXED | commit 1fabc23 |
| EM-BILL-006 | P0 | dental-billing | W2 | FIXED | commit e429dcb |
| EM-PMD-005 | P0 | dental-pmd | W1 | FIXED | commit 096e455 |
| TR-5B-003 | P0 | dental-audit | W2 | PENDING | Needs pg-boss consumer file |
| TR-5A-003 | P0 | dental-visit | W3 | PENDING | Needs DB migration |

## Blocked Findings

### EX-006 — Event bus (BLOCKED — own phase required)
**Finding:** All 23 domain events (DE-001..DE-023) declared in EVENT_CONTRACTS.md are never emitted anywhere.

**Why blocked:** This requires implementing a full event bus infrastructure across every module (billing, clinical, imaging, org, patient, scheduling, visit, pmd). It is not a sprint-level fix — it is a phase-level architectural change involving:
- Choosing/configuring an event bus (pg-boss is already used elsewhere)
- Adding emit calls at every handler call site across 8+ modules
- Creating consumers for dental-audit, notifs, dental-clinical
- Writing integration tests for event flow

**Recommendation:** Schedule as a dedicated phase after the P0 auth/security fixes ship. Reference EVENT_CONTRACTS.md for the 23 event definitions.

## Pending Findings (undispatched due to context limit)

### TR-5B-003 — pg-boss consumer for dental-audit
**What's needed:** Create `services/api-ts/src/handlers/dental-audit/consumers/domain-events.consumer.ts` that subscribes to dental domain events via pg-boss and writes to the audit log. Check if pg-boss is configured at `services/api-ts/src/core/queue.ts` or similar.

**Dispatch in next session:** `/oli-enforce-fix --module dental-audit` or dispatch a focused executor against TR-5B-003 alone.

### TR-5A-003 — dental_chart baseline/proposed/completed layer
**What's needed:** `services/api-ts/src/handlers/dental-visit/repos/dental-chart-baseline.schema.ts` already exists. The finding requires a `layer` column or equivalent to distinguish `baseline`/`proposed`/`completed` states on chart data. Requires schema change + Drizzle migration.

**Dispatch in next session:** Requires `cd services/api-ts && bun run db:generate` after schema change. Verify migration doesn't break existing chart tests.

## What's Next

**Condition:** FIXED findings remain (17 resolved) + BLOCKED (EX-006) + PENDING (2 undispatched)

**Routing:**
1. **Immediate:** Run `cd services/api-ts && bun test` to verify no regressions from the 11 commits
2. **Next session:** Dispatch TR-5B-003 (pg-boss consumer) and TR-5A-003 (dental_chart layer) — `/oli-enforce-fix --module dental-audit` and `/oli-enforce-fix --module dental-visit`
3. **After TR fixes:** Run `/oli-enforce-all` re-verification to reclassify FIXED findings as RESOLVED in baseline
4. **Separate phase:** EX-006 event bus — plan with `/office-hours` before committing to scope

## Follow-up Note: routes.ts TypeSpec Source

Commits 61ed52c modified `services/api-ts/src/generated/openapi/routes.ts` directly. This file is hand-maintained despite the `generated/` path. TypeSpec sources at `specs/api/src/` should be updated to add `@useAuth` or equivalent annotations to the recoverPin, set-pin, and verify-pin operations so that future codegen regeneration preserves the authMiddleware configuration.
