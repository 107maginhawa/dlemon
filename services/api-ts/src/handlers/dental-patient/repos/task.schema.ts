import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';

export const TASK_TYPES = ['follow_up', 'lab_order', 'referral', 'prescription', 'other'] as const;
export type TaskType = typeof TASK_TYPES[number];

export const TASK_STATUSES = ['open', 'in_progress', 'done', 'cancelled'] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

// FSM: valid transitions from each status
export const TASK_FSM: Record<TaskStatus, TaskStatus[]> = {
  open: ['in_progress', 'cancelled'],
  in_progress: ['done', 'cancelled'],
  done: [],
  cancelled: [],
};

export const dentalTasks = pgTable('dental_task', {
  ...baseEntityFields,
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  taskType: text('task_type').notNull().$type<TaskType>(),
  status: text('status').notNull().default('open').$type<TaskStatus>(),
  dueDate: text('due_date'),
  assignedTo: uuid('assigned_to'),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  patientIdx: index('dental_task_patient_idx').on(table.patientId),
  statusIdx: index('dental_task_status_idx').on(table.status),
}));

export type DentalTask = typeof dentalTasks.$inferSelect;
export type NewDentalTask = typeof dentalTasks.$inferInsert;
