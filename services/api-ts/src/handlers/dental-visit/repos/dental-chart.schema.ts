/**
 * Drizzle schema for dental charts and tooth records
 *
 * Each visit has one DentalChart with an array of per-tooth states.
 */

import { pgTable, uuid, jsonb, integer, text, index, pgEnum } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

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

export interface ToothChartState {
  toothNumber: number;
  state: string;
  surfaces?: string[];
  conditionCode?: string;
  note?: string;
}

export const dentalCharts = pgTable('dental_chart', {
  ...baseEntityFields,
  visitId: uuid('visit_id').notNull(),
  patientId: uuid('patient_id').notNull(),
  teeth: jsonb('teeth').notNull().$type<ToothChartState[]>(),
}, (table) => ({
  visitIdx: index('dental_chart_visit_id_idx').on(table.visitId),
  patientIdx: index('dental_chart_patient_id_idx').on(table.patientId),
}));

export type DentalChart = typeof dentalCharts.$inferSelect;
export type NewDentalChart = typeof dentalCharts.$inferInsert;
