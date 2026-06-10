/**
 * Drizzle schema for dental charts and tooth records
 *
 * Each visit has one DentalChart with an array of per-tooth states.
 */

import { pgTable, uuid, jsonb, integer, text, index, pgEnum, unique, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntityFields, syncableEntityFields, versionedSnapshotFields } from '@/core/database.schema';
import { dentalVisits } from './visit.schema';
import { patients } from '../../patient/repos/patient.schema';

export const toothStateEnum = pgEnum('tooth_state', [
  'healthy',
  'caries',
  'fractured',
  'filled',
  'crown',
  'missing',
  'implant',
  'extracted',
  'watchlist',
]);

export const toothSurfaceEnum = pgEnum('tooth_surface', [
  'mesial',
  'distal',
  'buccal',
  'lingual',
  'occlusal',
  'incisal',
  'cervical',
]);

export const chartEntryClassificationEnum = pgEnum('chart_entry_classification', [
  'existing',
  'existing_other',
  'treatment_plan',
  'condition',
]);

export type ChartEntryClassification = typeof chartEntryClassificationEnum.enumValues[number];

export const chartLayerEnum = pgEnum('chart_layer', [
  'baseline',
  'proposed',
  'completed',
]);

export type ChartLayer = typeof chartLayerEnum.enumValues[number];

export interface ToothChartState {
  toothNumber: number;
  state: string;
  surfaces?: string[];
  conditionCode?: string;
  note?: string;
  surfaceConditionMap?: Record<string, unknown>;
  entryClassification?: ChartEntryClassification;
}

export const dentalCharts = pgTable('dental_chart', {
  ...baseEntityFields,
  ...syncableEntityFields,
  visitId: uuid('visit_id').notNull().references(() => dentalVisits.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  layer: chartLayerEnum('layer').notNull().default('proposed'),
  teeth: jsonb('teeth').notNull().$type<ToothChartState[]>(),
}, (table) => ({
  visitIdx: index('dental_chart_visit_id_idx').on(table.visitId),
  patientIdx: index('dental_chart_patient_id_idx').on(table.patientId),
  // SL-01 / B-G3: offline-replay idempotency backstop — a (visit, localId) pair may
  // exist at most once. The handler pre-check short-circuits a replayed create op;
  // this index guards against a concurrent-retry race.
  visitLocalIdUnique: uniqueIndex('dental_chart_visit_local_id_unique')
    .on(table.visitId, table.localId)
    .where(sql`local_id is not null`),
}));

export type DentalChart = typeof dentalCharts.$inferSelect;
export type NewDentalChart = typeof dentalCharts.$inferInsert;

export const dentalChartVersions = pgTable(
  'dental_chart_version',
  {
    ...versionedSnapshotFields(),
    chartId: uuid('chart_id').notNull().references(() => dentalCharts.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    uniqueChartVersion: unique('dental_chart_version_chart_version_uniq').on(table.chartId, table.version),
    chartIdx: index('dental_chart_version_chart_idx').on(table.chartId),
  }),
);

export type DentalChartVersion = typeof dentalChartVersions.$inferSelect;
export type NewDentalChartVersion = typeof dentalChartVersions.$inferInsert;
