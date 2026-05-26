import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalAppointments } from './dental-appointment.schema';
import { patients } from '../../patient/repos/patient.schema';
import { dentalBranches } from '../../dental-org/repos/branch.schema';

export const QUEUE_ITEM_STATUSES = ['waiting', 'called', 'in_progress', 'completed', 'cancelled'] as const;
export type QueueItemStatus = typeof QUEUE_ITEM_STATUSES[number];

export const QUEUE_ITEM_FSM: Record<QueueItemStatus, QueueItemStatus[]> = {
  waiting: ['called', 'cancelled'],
  called: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const dentalQueueItems = pgTable('dental_queue_item', {
  ...baseEntityFields,
  appointmentId: uuid('appointment_id').notNull().references(() => dentalAppointments.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  branchId: uuid('branch_id').notNull().references(() => dentalBranches.id),
  status: text('status').notNull().default('waiting').$type<QueueItemStatus>(),
  calledAt: timestamp('called_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  notes: text('notes'),
}, (table) => ({
  branchIdx: index('dental_queue_item_branch_id_idx').on(table.branchId),
  statusIdx: index('dental_queue_item_status_idx').on(table.status),
  appointmentIdx: index('dental_queue_item_appointment_id_idx').on(table.appointmentId),
}));

export type DentalQueueItem = typeof dentalQueueItems.$inferSelect;
export type NewDentalQueueItem = typeof dentalQueueItems.$inferInsert;
