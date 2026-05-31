/**
 * Drizzle schema for data-retention policies (V-DG-001).
 *
 * Retention is POLICY-AS-DATA: periods and actions are editable rows, not
 * code. A generic enforcement engine (see ../retention-engine.ts) evaluates
 * the enabled policies on a schedule. Safety invariants (dry-run default,
 * never-purge-audit, legal-hold exemption, soft-archive over hard-delete) are
 * enforced in the engine regardless of what any policy row says, so a bad
 * policy edit cannot cause data loss.
 */

import { pgTable, uuid, text, integer, boolean, pgEnum, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

/**
 * Action applied to records once their retention period elapses.
 *  - archive   : soft-archive (set deletedAt / archived flag) — record preserved, hidden.
 *  - anonymize : strip / generalise PII, keep the (de-identified) record.
 *  - delete    : DECLARED intent only — the engine DOWNGRADES this to soft-archive.
 *                The engine never performs a hard delete.
 *  - retain    : never action (used for the audit trail; documents "keep forever").
 */
export const retentionActionEnum = pgEnum('retention_policy_action', [
  'archive',
  'anonymize',
  'delete',
  'retain',
]);

export const dentalRetentionPolicies = pgTable(
  'dental_retention_policy',
  {
    ...baseEntityFields,
    // Tenant/branch scoping. No FK (mirrors dental_audit_log) so the policy
    // registry stays decoupled from any one domain module.
    tenantId: uuid('tenant_id').notNull(),
    branchId: uuid('branch_id'),
    // The kind of record this policy governs (e.g. 'clinical', 'visit',
    // 'prescription', 'attachment', 'audit'). Free text so new domains can add
    // policies without a schema migration; the engine maps it to a target.
    entityType: text('entity_type').notNull(),
    // Editable retention period, in days. Kept as days (not months) so the
    // engine can compute a precise cutoff timestamp.
    retentionPeriodDays: integer('retention_period_days').notNull(),
    action: retentionActionEnum('action').notNull().default('archive'),
    enabled: boolean('enabled').notNull().default(true),
    // Forward-compat metadata: declares whether this entity type participates
    // in legal-hold tracking. NOTE: this is NEVER a bypass — the engine always
    // excludes legally-held records via the target's hold predicate.
    legalHoldExempt: boolean('legal_hold_exempt').notNull().default(false),
    notes: text('notes'),
    lastEvaluatedAt: timestamp('last_evaluated_at'),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    tenantIdx: index('dental_retention_policy_tenant_idx').on(table.tenantId),
    enabledIdx: index('dental_retention_policy_enabled_idx').on(table.enabled),
    // One policy per (tenant, branch, entityType). branchId is nullable; NULL
    // branch = tenant-wide default. Postgres treats NULLs as distinct, which is
    // the behaviour we want (a tenant-wide row and branch rows can coexist).
    tenantEntityUq: uniqueIndex('dental_retention_policy_tenant_entity_uq').on(
      table.tenantId,
      table.branchId,
      table.entityType,
    ),
  }),
);

export type DentalRetentionPolicy = typeof dentalRetentionPolicies.$inferSelect;
export type NewDentalRetentionPolicy = typeof dentalRetentionPolicies.$inferInsert;

export const VALID_RETENTION_ACTIONS = ['archive', 'anonymize', 'delete', 'retain'] as const;
export type RetentionAction = (typeof VALID_RETENTION_ACTIONS)[number];
