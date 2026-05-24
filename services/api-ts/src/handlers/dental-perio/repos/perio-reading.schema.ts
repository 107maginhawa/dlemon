/**
 * Drizzle schema for periodontal tooth readings.
 *
 * BR-P04: Tooth number validated at handler level (FDI 11-48 adult or 51-85 primary).
 * Unique on (chartId, toothNumber) — upsert target.
 */

import { pgTable, uuid, text, smallint, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalPerioCharts } from './perio-chart.schema';

export const dentalPerioToothReadings = pgTable('dental_perio_tooth_reading', {
  ...baseEntityFields,
  chartId: uuid('chart_id').notNull().references(() => dentalPerioCharts.id, { onDelete: 'cascade' }),
  toothNumber: smallint('tooth_number').notNull(),
  depthBM: smallint('depth_bm'),
  depthBC: smallint('depth_bc'),
  depthBD: smallint('depth_bd'),
  depthLM: smallint('depth_lm'),
  depthLC: smallint('depth_lc'),
  depthLD: smallint('depth_ld'),
  bopBM: boolean('bop_bm'),
  bopBC: boolean('bop_bc'),
  bopBD: boolean('bop_bd'),
  bopLM: boolean('bop_lm'),
  bopLC: boolean('bop_lc'),
  bopLD: boolean('bop_ld'),
  recession: smallint('recession'),
  mobility: smallint('mobility').notNull().default(0),
  furcation: smallint('furcation').notNull().default(0),
  plaque: boolean('plaque').notNull().default(false),
  suppuration: boolean('suppuration').notNull().default(false),
  notes: text('notes'),
}, (table) => ({
  chartToothUnique: uniqueIndex('dental_perio_tooth_reading_chart_tooth_unique').on(table.chartId, table.toothNumber),
  chartIdx: index('dental_perio_tooth_reading_chart_idx').on(table.chartId),
}));

export type DentalPerioToothReading = typeof dentalPerioToothReadings.$inferSelect;
export type NewDentalPerioToothReading = typeof dentalPerioToothReadings.$inferInsert;
