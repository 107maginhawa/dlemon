import { pgTable, uuid, text, date, timestamp, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';

export const RECALL_TYPES = ['cleaning', 'checkup', 'treatment', 'other'] as const;
export type RecallType = typeof RECALL_TYPES[number];

export const RECALL_STATUSES = ['pending', 'sent', 'completed', 'cancelled'] as const;
export type RecallStatus = typeof RECALL_STATUSES[number];

// FSM: valid transitions from each status
export const RECALL_FSM: Record<RecallStatus, RecallStatus[]> = {
  pending: ['sent', 'cancelled'],
  sent: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const dentalRecalls = pgTable('dental_recall', {
  ...baseEntityFields,
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  type: text('type').notNull().$type<RecallType>(),
  dueDate: text('due_date').notNull(),
  status: text('status').notNull().default('pending').$type<RecallStatus>(),
  notes: text('notes'),
  sentAt: timestamp('sent_at'),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  patientIdx: index('dental_recall_patient_idx').on(table.patientId),
  statusIdx: index('dental_recall_status_idx').on(table.status),
}));

export type DentalRecall = typeof dentalRecalls.$inferSelect;
export type NewDentalRecall = typeof dentalRecalls.$inferInsert;
