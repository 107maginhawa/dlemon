import { pgTable, uuid, text, integer, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';

export const TREATMENT_PLAN_STATUSES = [
  'draft',
  'presented',
  'approved',
  'partially_completed',
  'completed',
  'cancelled',
] as const;
export type TreatmentPlanStatus = typeof TREATMENT_PLAN_STATUSES[number];

export const TREATMENT_PLAN_FSM: Record<TreatmentPlanStatus, TreatmentPlanStatus[]> = {
  draft: ['presented', 'cancelled'],
  presented: ['approved', 'cancelled'],
  approved: ['partially_completed', 'cancelled'],
  partially_completed: ['completed', 'cancelled'],
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

// ---------------------------------------------------------------------------
// CR-05 — Treatment-plan approval record (TR-P1-08)
// First-class, append-only record of who approved a plan, how, and against which
// snapshot. Reuses the existing consent-form linkage (loose ref, no hard FK).
// ---------------------------------------------------------------------------

export const TREATMENT_PLAN_APPROVAL_METHODS = ['signature', 'verbal', 'portal'] as const;
export type TreatmentPlanApprovalMethod = typeof TREATMENT_PLAN_APPROVAL_METHODS[number];

export const treatmentPlanApprovalMethodEnum = pgEnum(
  'dental_treatment_plan_approval_method',
  TREATMENT_PLAN_APPROVAL_METHODS,
);

export const dentalTreatmentPlanApprovals = pgTable('dental_treatment_plan_approval', {
  ...baseEntityFields,
  treatmentPlanId: uuid('treatment_plan_id')
    .notNull()
    .references(() => dentalTreatmentPlans.id, { onDelete: 'cascade' }),
  /** Loose ref to treatment_plan_version (dental-visit) — no hard FK, cross-module. */
  planVersionId: uuid('plan_version_id'),
  /** Person (patient/guardian) who approved. */
  approvedByPersonId: uuid('approved_by_person_id').notNull(),
  method: treatmentPlanApprovalMethodEnum('method').notNull(),
  /** Loose ref to consent_form (dental-clinical) when the approval was consented. */
  consentFormId: uuid('consent_form_id'),
  signatureData: text('signature_data'),
  approvedAt: timestamp('approved_at').notNull().defaultNow(),
}, (table) => ({
  planIdx: index('dental_treatment_plan_approval_plan_idx').on(table.treatmentPlanId),
}));

export type DentalTreatmentPlanApproval = typeof dentalTreatmentPlanApprovals.$inferSelect;
export type NewDentalTreatmentPlanApproval = typeof dentalTreatmentPlanApprovals.$inferInsert;
