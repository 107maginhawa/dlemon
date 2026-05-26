import { pgTable, uuid, text, integer, boolean, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';

export const OCCLUSION_CLASSES = ['class_i', 'class_ii_div1', 'class_ii_div2', 'class_iii', 'edge_to_edge'] as const;
export type OcclusionClass = typeof OCCLUSION_CLASSES[number];

export const dentalOcclusionScreenings = pgTable('dental_occlusion_screening', {
  ...baseEntityFields,
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  visitId: uuid('visit_id'),
  angleClass: text('angle_class').$type<OcclusionClass>(),
  overbiteMm: integer('overbite_mm'),
  overjetMm: integer('overjet_mm'),
  crossbite: boolean('crossbite').default(false),
  crowding: boolean('crowding').default(false),
  spacing: boolean('spacing').default(false),
  midlineDeviation: text('midline_deviation'),
  notes: text('notes'),
}, (table) => ({
  patientIdx: index('dental_occlusion_patient_idx').on(table.patientId),
}));

export type DentalOcclusionScreening = typeof dentalOcclusionScreenings.$inferSelect;
export type NewDentalOcclusionScreening = typeof dentalOcclusionScreenings.$inferInsert;
