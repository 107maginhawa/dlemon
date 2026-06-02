<!-- oli-version: 1.1 | generated: 2026-06-02 | skill: oli-module-specs (manual, F9 — anchor orphan-by-design governance code to a spec, TR-RET-001) -->

# Module Specification: retention

---
Spec Version: 1.0 | Last Updated: 2026-06-02
implementation_status: implemented
handler_dir: services/api-ts/src/handlers/retention/
namespace: (none — engine + cron + policy registry; no HTTP surface)
---

## 0. Why this spec exists

The `retention` handler has code + tests but no MODULE_SPEC, so traceability flagged
it as an orphan (**TR-RET-001**). This is a lightweight spec that anchors the
retention engine, the `dental_retention_policy` table, the default-policy seeder, and
the enforcement cron to a contract so the code→test chain resolves. It is
**governance infrastructure** with **no HTTP endpoints** — it runs as a scheduled job
over policy-as-data rows.

This module is **platform/governance-level**, not a clinical `dental-*` domain module,
though its table carries the `dental` prefix (legacy alignment with the other
compliance tables).

---

## 1. Module Overview
**Purpose:** Enforce data-retention policy. Retention is **policy-as-data**: periods
and actions are editable `dental_retention_policy` rows, not code. A generic
enforcement engine (`retention-engine.ts`) evaluates the enabled policies on a daily
cron and applies the declared action to records past their retention period. All hard
SAFETY INVARIANTS live in the engine — they hold no matter what a policy row says, so
a bad policy edit cannot cause data loss.

**Users:** System (the scheduled cron actor, `RETENTION_SYSTEM_ACTOR`). Operators edit
policy rows (data) and gate real enforcement via env. No interactive API surface.

**Related:**
- [legal-hold](../legal-hold/MODULE_SPEC.md) — held subjects are always excluded from action.
- [dental-audit](../dental-audit/MODULE_SPEC.md) — every evaluation that touches a target writes a `compliance` audit event; the `audit` target is `protected` (never purged).
- `dental-clinical` (attachment retention facade), `dental-scheduling` (appointment retention facade) — the concrete archive targets.

---

## 2. Domain Terms
| Term | Definition |
|------|-----------|
| Retention Policy | Editable row binding an `entityType` to a `retentionPeriodDays` + `action` |
| Retention Target | Code binding an `entityType` to concrete, tenant/branch-scoped table operations (find-eligible + archive/anonymize) |
| Effective action | The safe action actually applied; `delete` is always DOWNGRADED to `archive` |
| Cutoff | `now − retentionPeriodDays`; records older than this are eligible |
| Dry-run | Default mode — evaluates + audits but performs no mutation |

---

## 3. Workflows
> Not yet enumerated in WORKFLOW_MAP.md as a numbered WF — these are the module's own
> workflows. They support DATA_GOVERNANCE.md §2 retention schedules (incl. V-DG-003
> appointment 1-year-from-date) and the WFG-006 erasure complement.

- **WF-RET-001: Seed default policies.** On org/tenant provisioning,
  `seedDefaultRetentionPolicies` idempotently seeds conservative defaults (clinical /
  visit / attachment ~10y archive, prescription ~5y, appointment 1y from
  `scheduledAt`, audit `retain`). A default is seeded `enabled` only when a real
  target is wired; otherwise `enabled: false` (V-RET-002).
- **WF-RET-002: Daily retention enforcement (cron).** `registerRetentionJobs`
  schedules `retention.enforcement` at 03:30 daily. DRY-RUN unless
  `RETENTION_ENFORCEMENT_ENABLED="true"`. Evaluates enabled policies, excludes
  legally-held + protected records, soft-archives eligible records, audits the run.
- **WF-RET-003 (engine): Evaluate a policy.** For each policy: skip disabled; refuse
  `retain`/`protected` (audit); skip `no-target`; compute cutoff; exclude legal-held;
  dry-run or archive/anonymize; write a `compliance` audit event.

---

## 5. Business Rules (SAFETY INVARIANTS — engine-enforced)
1. **DRY-RUN by default.** Real mutation only when `dryRun: false` is passed; the cron
   gates that on `RETENTION_ENFORCEMENT_ENABLED`.
2. **NEVER purge the audit trail.** Targets marked `protected` (and the `retain`
   action) are refused before any read.
3. **Soft-archive over hard-delete.** The `delete` action is DOWNGRADED to `archive`;
   the engine has no hard-delete path.
4. **Legal-hold exemption.** Records the target reports as legally held are always
   excluded (consults [legal-hold](../legal-hold/MODULE_SPEC.md) via
   `personsUnderLegalHold`). Never bypassable by `legalHoldExempt` on a policy row.
5. **Fully audited.** Every evaluation that touches a real target writes a
   `compliance` audit event via the append-only sink.
6. One policy per `(tenantId, branchId, entityType)`; NULL `branchId` = tenant-wide
   default.

---

## 6. Permissions
| Operation | Actor |
|-----------|-------|
| Enforcement run | System cron (`RETENTION_SYSTEM_ACTOR`), env-gated for real action |
| Policy edits | Operator (data-level; row edits) |
| Hard delete of records | NEVER (no code path) |

---

## 7. Data Requirements
**`dental_retention_policy`** (`retention-policy.schema.ts`): base entity fields +
`tenant_id` (uuid, not null), `branch_id` (uuid, nullable), `entity_type` (text, free
text so new domains add policies without migration), `retention_period_days`
(integer), `action` (`retention_policy_action` enum: `archive` | `anonymize` |
`delete` | `retain`, default `archive`), `enabled` (boolean, default true),
`legal_hold_exempt` (boolean, default false — forward-compat metadata, NEVER a
bypass), `notes` (text), `last_evaluated_at` (timestamp), `deleted_at` (timestamp).
Unique on `(tenant_id, branch_id, entity_type)`.

Wired targets (`SUPPORTED_RETENTION_ENTITY_TYPES`): `attachment`, `appointment`,
`audit` (protected). Other declared entity types (`clinical`, `visit`,
`prescription`) are seeded disabled until a target lands.

---

## 8. State Transitions
No record state machine. Per-policy evaluation OUTCOMES: `disabled`, `no-target`,
`protected-skip`, `dry-run`, `enforced`, `noop`.

---

## 10. API Expectations
**None.** Retention exposes no HTTP routes — it is an engine + cron + policy registry.
Operators interact via policy-row data and the `RETENTION_ENFORCEMENT_ENABLED` env
flag. (If a policy-management API surface is added later, document it here and in an
`API_CONTRACTS.md`.)

---

## 10b. Domain Events / Audit
| Outcome | Audit action | Category |
|---------|--------------|----------|
| `retain` / protected target | `retention.protected_skip` | `compliance` |
| Dry-run evaluation | `retention.dry_run` | `compliance` |
| Records archived/anonymized | `retention.enforced` | `compliance` |

Actor: `RETENTION_SYSTEM_ACTOR` (fixed sentinel UUID, never a real person).

---

## 11. Acceptance Criteria
- **AC-RET-001:** With no `dryRun` override, evaluation performs no mutation and emits
  `retention.dry_run` (default-safe).
- **AC-RET-002:** A `delete`-action policy soft-archives (never hard-deletes) eligible
  records — effective action is `archive`.
- **AC-RET-003:** The `audit` (protected) target / `retain` action is never read or
  actioned; emits `retention.protected_skip`.
- **AC-RET-004:** Records belonging to a person under an ACTIVE legal hold are excluded
  from action (`legalHeldCount` > 0, `actionedCount` excludes them) —
  `retention-legalhold.test.ts`.
- **AC-RET-005:** `seedDefaultRetentionPolicies` is idempotent and seeds targetless
  entity types as `enabled: false` (V-RET-002) — `retention-defaults.test.ts`,
  `retention-org-seeding.test.ts`.
- **AC-RET-006:** Appointment eligibility uses `scheduledAt` (date), 1-year cutoff
  (V-DG-003) — `retention-appointment.test.ts`.

---

## 14. Dependencies
**Internal:** [legal-hold](../legal-hold/MODULE_SPEC.md) (`personsUnderLegalHold`),
[dental-audit](../dental-audit/MODULE_SPEC.md) (audit writer), `dental-clinical` +
`dental-scheduling` retention facades (archive targets), `@/core/jobs` (scheduler).
**External:** none.

---

## 16. Performance Expectations
Runs off the request path as a nightly cron (03:30, offset from audit retention at
03:00). Per-policy queries are tenant/branch + cutoff scoped and paginated by the
target facades.

---

## 19. Vertical Slice Plan
RET-S1: Policy registry + schema + idempotent seeder | RET-S2: Generic engine with
safety invariants (dry-run, soft-archive, protected, audit) | RET-S3: Targets
(attachment, appointment, audit-protected) + legal-hold exclusion | RET-S4:
Env-gated enforcement cron.

---

## 20. AI Instructions
1. NEVER add a hard-delete path — `delete` is always downgraded to `archive`.
2. NEVER read or action a `protected` target (audit) or the `retain` action.
3. Real enforcement is opt-in: dry-run unless explicitly `dryRun: false` AND
   `RETENTION_ENFORCEMENT_ENABLED="true"`.
4. Legal-hold exclusion is mandatory and lives in the engine — never let
   `legalHoldExempt` bypass it.
5. New domains register a target in `retention-targets.ts` (via the owning module's
   facade) — never edit the engine to add a table.
6. Every real evaluation writes a `compliance` audit event.
7. Follow ARCHITECTURE.md, CONTRIBUTING.md, VERTICAL_TDD.md.
