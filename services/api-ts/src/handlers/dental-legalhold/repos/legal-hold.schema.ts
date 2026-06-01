/**
 * Drizzle schema for legal holds (V-DG-002 support).
 *
 * A legal hold suspends data-governance actions (retention + erasure) for a
 * subject while litigation/investigation is pending (compliance-program.tsp
 * LegalHold). The engines consult this store: a subject with an ACTIVE hold is
 * never erased or auto-retained. Releasing a hold resumes normal schedules.
 */

import { pgTable, uuid, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const legalHoldStatusEnum = pgEnum('legal_hold_status', ['active', 'released']);

export const dentalLegalHolds = pgTable(
  'dental_legal_hold',
  {
    ...baseEntityFields,
    tenantId: uuid('tenant_id').notNull(),
    branchId: uuid('branch_id'),
    // The Person whose records are held. No FK (mirrors audit/erasure decoupling).
    subjectPersonId: uuid('subject_person_id').notNull(),
    name: text('name').notNull(),
    reason: text('reason').notNull(),
    status: legalHoldStatusEnum('status').notNull().default('active'),
    initiatedBy: uuid('initiated_by').notNull(),
    releasedBy: uuid('released_by'),
    releasedAt: timestamp('released_at'),
    note: text('note'),
  },
  (table) => ({
    tenantIdx: index('dental_legal_hold_tenant_idx').on(table.tenantId),
    subjectIdx: index('dental_legal_hold_subject_idx').on(table.subjectPersonId),
    statusIdx: index('dental_legal_hold_status_idx').on(table.status),
  }),
);

export type DentalLegalHold = typeof dentalLegalHolds.$inferSelect;
export type NewDentalLegalHold = typeof dentalLegalHolds.$inferInsert;

export const VALID_LEGAL_HOLD_STATUSES = ['active', 'released'] as const;
export type LegalHoldStatus = (typeof VALID_LEGAL_HOLD_STATUSES)[number];
