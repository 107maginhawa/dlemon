/**
 * Drizzle schema for dental audit log
 *
 * Stores queryable audit events for PHI-touching operations.
 * Supplements Pino structured logging with a DB-persisted, queryable trail.
 */

import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const dentalAudit = pgTable('dental_audit', {
  id: uuid('id').primaryKey().defaultRandom(),
  // loose-coupling: actor — staff/patient/admin person.id (no DB-level FK)
  personId: uuid('person_id').notNull(),
  // e.g. 'visit.create', 'treatment.finalize', 'patient.view'
  action: text('action').notNull(),
  // e.g. 'dental_visit', 'dental_treatment', 'dental_patient'
  resourceType: text('resource_type').notNull(),
  // nullable for list/create actions where no single resource ID applies
  resourceId: uuid('resource_id'),
  // loose-coupling: org tenant — no DB-level FK
  tenantId: uuid('tenant_id').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  // extra context: IP, user agent, changed fields, etc.
  metadata: jsonb('metadata'),
}, (table) => ({
  personTimestampIdx: index('dental_audit_person_timestamp_idx').on(table.personId, table.timestamp),
  tenantTimestampIdx: index('dental_audit_tenant_timestamp_idx').on(table.tenantId, table.timestamp),
  resourceIdx: index('dental_audit_resource_idx').on(table.resourceType, table.resourceId),
}));

export type DentalAuditEntry = typeof dentalAudit.$inferSelect;
export type NewDentalAuditEntry = typeof dentalAudit.$inferInsert;
