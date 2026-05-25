/**
 * Patient-level cumulative dental chart baseline.
 *
 * One row per patient — updated after every visit chart save via merge logic.
 * Stores the latest known tooth state across all visits (last-write-wins per tooth).
 */

import { pgTable, uuid, jsonb, timestamp, unique } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';
import type { ToothChartState } from './dental-chart.schema';

export const dentalPatientChartBaselines = pgTable(
  'dental_patient_chart_baseline',
  {
    ...baseEntityFields,
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    teeth: jsonb('teeth').notNull().$type<ToothChartState[]>(),
    lastVisitId: uuid('last_visit_id'),
    snapshotAt: timestamp('snapshot_at').notNull().defaultNow(),
  },
  (table) => ({
    patientUniq: unique('dental_patient_chart_baseline_patient_uniq').on(table.patientId),
  }),
);

export type DentalPatientChartBaseline = typeof dentalPatientChartBaselines.$inferSelect;
export type NewDentalPatientChartBaseline = typeof dentalPatientChartBaselines.$inferInsert;
