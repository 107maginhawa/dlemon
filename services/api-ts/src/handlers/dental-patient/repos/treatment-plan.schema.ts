import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';

export const TREATMENT_PLAN_STATUSES = [
  'draft',
  'presented',
  'approved',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type TreatmentPlanStatus = typeof TREATMENT_PLAN_STATUSES[number];

export const TREATMENT_PLAN_FSM: Record<TreatmentPlanStatus, TreatmentPlanStatus[]> = {
  draft: ['presented', 'cancelled'],
  presented: ['approved', 'cancelled'],
  approved: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const dentalTreatmentPlans = pgTable('dental_treatment_plan', {
  ...baseEntityFields,
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  providerId: uuid('provider_id').notNull(),
  status: text('status').notNull().default('draft').$type<TreatmentPlanStatus>(),
  totalEstimateCents: integer('total_estimate_cents').notNull().default(0),
  notes: text('notes'),
  presentedAt: timestamp('presented_at'),
  approvedAt: timestamp('approved_at'),
}, (table) => ({
  patientIdx: index('dental_treatment_plan_patient_idx').on(table.patientId),
  statusIdx: index('dental_treatment_plan_status_idx').on(table.status),
}));

export type DentalTreatmentPlan = typeof dentalTreatmentPlans.$inferSelect;
export type NewDentalTreatmentPlan = typeof dentalTreatmentPlans.$inferInsert;
