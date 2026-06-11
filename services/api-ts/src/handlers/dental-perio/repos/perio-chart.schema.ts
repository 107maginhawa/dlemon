/**
 * Drizzle schema for periodontal charts.
 *
 * BR-P01: One chart per visit (unique constraint on visitId).
 */

import { pgTable, uuid, text, timestamp, integer, pgEnum, numeric, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalVisits } from '../../dental-visit/repos/visit.schema';
import { patients } from '../../patient/repos/patient.schema';
import { dentalBranches } from '../../dental-org/repos/branch.schema';

export const dentalPerioChartStatusEnum = pgEnum('dental_perio_chart_status', [
  'draft',
  'completed',
  'locked',
]);

export const dentalPerioCharts = pgTable('dental_perio_chart', {
  ...baseEntityFields,
  visitId: uuid('visit_id').notNull().references(() => dentalVisits.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  branchId: uuid('branch_id').notNull().references(() => dentalBranches.id),
  examinerMemberId: uuid('examiner_member_id').notNull(),
  status: dentalPerioChartStatusEnum('status').notNull().default('draft'),
  notes: text('notes'),
  completedAt: timestamp('completed_at'),
  summaryBopPercent: numeric('summary_bop_percent', { precision: 5, scale: 2 }),
  summaryMeanDepth: numeric('summary_mean_depth', { precision: 5, scale: 2 }),
  summaryDeepPocketCount: integer('summary_deep_pocket_count'),
  // FIX-001/002: the 2017 AAP/EFP diagnosis of record, frozen at completion.
  // Nullable + additive: legacy charts completed before this migration legitimately
  // have no persisted diagnosis (no backfill — recomputing history would manufacture
  // clinical records). `risk_factors` records the grading evidence so the grade is
  // reproducible/auditable. stage/extent are text (small closed sets; a pg enum adds
  // migration friction for zero V1 value).
  stage: text('stage'),
  grade: text('grade'),
  extent: text('extent'),
  riskFactors: jsonb('risk_factors').$type<Record<string, unknown>>(),
}, (table) => ({
  visitUnique: uniqueIndex('dental_perio_chart_visit_unique').on(table.visitId),
  patientIdx: index('dental_perio_chart_patient_idx').on(table.patientId),
  branchIdx: index('dental_perio_chart_branch_idx').on(table.branchId),
}));

export type DentalPerioChart = typeof dentalPerioCharts.$inferSelect;
export type NewDentalPerioChart = typeof dentalPerioCharts.$inferInsert;
