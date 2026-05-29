import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const dentalAuditLog = pgTable('dental_audit_log', {
  ...baseEntityFields,
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  actorId: uuid('actor_id').notNull(),
  // AUDIT_CONTRACTS §2: classifies the event against the domain event catalog
  // (DE-* / ACCESS_*) — e.g. 'data-modification', 'security', 'authentication'.
  eventType: text('event_type'),
  // AUDIT_CONTRACTS §2: membership role the actor held at time of the event.
  actorRole: text('actor_role'),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: uuid('target_id'),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  // AUDIT_CONTRACTS §2: request provenance (web requests only; null offline-first).
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  reason: text('reason'),
  // AUDIT_CONTRACTS §2: safe, non-PHI context (IDs, counts, status/CDT codes, flags).
  metadata: jsonb('metadata'),
  beforeSnapshot: jsonb('before_snapshot'),
  afterSnapshot: jsonb('after_snapshot'),
}, (table) => ({
  actorTimestampIdx: index('dental_audit_log_actor_ts_idx').on(table.actorId, table.timestamp),
  tenantTimestampIdx: index('dental_audit_log_tenant_ts_idx').on(table.tenantId, table.timestamp),
  targetIdx: index('dental_audit_log_target_idx').on(table.targetType, table.targetId),
  branchTimestampIdx: index('dental_audit_log_branch_ts_idx').on(table.branchId, table.timestamp),
}));

export type DentalAuditLog = typeof dentalAuditLog.$inferSelect;
export type NewDentalAuditLog = typeof dentalAuditLog.$inferInsert;
