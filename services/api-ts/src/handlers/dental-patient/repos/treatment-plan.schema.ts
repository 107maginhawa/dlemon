import { pgTable, uuid, text, integer, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';

/**
 * P2-10: default ADA CDT code-set year stamped onto new plans. The catalog is
 * versioned annually; this is the year DentaLemon's bundled code set tracks. Bump
 * when the bundled catalog is refreshed — existing plans keep their stamped year.
 */
export const DEFAULT_CDT_CODE_SET_YEAR = 2025;

export const TREATMENT_PLAN_STATUSES = [
  'draft',
  'presented',
  'approved',
  // P2-8: explicit lifecycle states for case acceptance + scheduling.
  // `rejected` is the negative counterpart of `approved` (patient declined the
  // presented case). `scheduled` sits between approval and active delivery — the
  // case has been booked to the calendar but no item is performed yet. Both are
  // additive; the legacy draft→presented→approved→… spine is unchanged.
  'rejected',
  'scheduled',
  'partially_completed',
  'completed',
  'cancelled',
] as const;
export type TreatmentPlanStatus = typeof TREATMENT_PLAN_STATUSES[number];

export const TREATMENT_PLAN_FSM: Record<TreatmentPlanStatus, TreatmentPlanStatus[]> = {
  draft: ['presented', 'cancelled'],
  // A presented case can be approved (accepted) or rejected (declined) by the patient.
  presented: ['approved', 'rejected', 'cancelled'],
  // An approved case may be scheduled to the calendar, or move straight into delivery.
  approved: ['scheduled', 'partially_completed', 'cancelled'],
  // A scheduled case proceeds into delivery as items are performed.
  scheduled: ['partially_completed', 'cancelled'],
  rejected: [], // terminal — patient declined the case
  partially_completed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

/**
 * TP-BR-005 derivation — given a plan's current status and its item (treatment)
 * statuses, derive the plan status. Pure & DB-free.
 *
 * Rule: completing ONE item must not complete the whole plan unless ALL items are
 * complete. `dismissed`/`declined` items are excluded from the denominator (a
 * fully-declined plan does not auto-complete). Only the active lifecycle
 * (approved/partially_completed/completed) is derived — draft/presented/cancelled
 * are returned untouched so manual lifecycle control is preserved.
 */
const TREATMENT_DONE_STATUSES = new Set(['performed', 'verified']);
const TREATMENT_EXCLUDED_STATUSES = new Set(['dismissed', 'declined']);

export function deriveTreatmentPlanStatus(
  current: TreatmentPlanStatus,
  itemStatuses: readonly string[],
): TreatmentPlanStatus {
  // P2-8: `scheduled` is a derivable active state too — once any item is performed
  // a scheduled case advances to partially_completed/completed; until then it holds
  // its `scheduled` (or `approved`) baseline rather than being recomputed away.
  if (
    current !== 'approved' &&
    current !== 'scheduled' &&
    current !== 'partially_completed' &&
    current !== 'completed'
  ) {
    return current;
  }
  const active = itemStatuses.filter((s) => !TREATMENT_EXCLUDED_STATUSES.has(s));
  const done = active.filter((s) => TREATMENT_DONE_STATUSES.has(s));
  if (active.length > 0 && done.length === active.length) return 'completed';
  if (done.length > 0) return 'partially_completed';
  // No items done yet: preserve whichever pre-delivery baseline the case is in.
  return current === 'scheduled' ? 'scheduled' : 'approved';
}

export const dentalTreatmentPlans = pgTable('dental_treatment_plan', {
  ...baseEntityFields,
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  providerId: uuid('provider_id').notNull(),
  status: text('status').notNull().default('draft').$type<TreatmentPlanStatus>(),
  totalEstimateCents: integer('total_estimate_cents').notNull().default(0),
  notes: text('notes'),
  /**
   * P2-10: the ADA CDT code-set year the plan's procedure codes were authored
   * against (e.g. 2025). Stamped so a plan remains interpretable as the catalog
   * is updated annually. Defaults to the current default code-set year.
   */
  cdtCodeSetYear: integer('cdt_code_set_year').notNull().default(DEFAULT_CDT_CODE_SET_YEAR),
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

// ---------------------------------------------------------------------------
// P2-8 — Treatment-plan status-history record
// Append-only audit trail of every status transition a plan undergoes
// (who / when / from → to). Complements the CR-05 approval record (which only
// captures the accept event); this captures the full case-status timeline so the
// front desk can see "presented → approved → scheduled → …" with attribution.
// ---------------------------------------------------------------------------

export const dentalTreatmentPlanStatusHistory = pgTable('dental_treatment_plan_status_history', {
  ...baseEntityFields,
  treatmentPlanId: uuid('treatment_plan_id')
    .notNull()
    .references(() => dentalTreatmentPlans.id, { onDelete: 'cascade' }),
  /** Status before the transition (null for the initial 'draft' creation event). */
  fromStatus: text('from_status').$type<TreatmentPlanStatus | null>(),
  toStatus: text('to_status').notNull().$type<TreatmentPlanStatus>(),
  /** Person (membership/user) who performed the transition. */
  changedByPersonId: uuid('changed_by_person_id').notNull(),
  changedAt: timestamp('changed_at').notNull().defaultNow(),
}, (table) => ({
  planIdx: index('dental_treatment_plan_status_history_plan_idx').on(table.treatmentPlanId),
}));

export type DentalTreatmentPlanStatusHistory = typeof dentalTreatmentPlanStatusHistory.$inferSelect;
export type NewDentalTreatmentPlanStatusHistory = typeof dentalTreatmentPlanStatusHistory.$inferInsert;
