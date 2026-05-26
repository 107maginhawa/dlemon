import { pgTable, uuid, text, boolean, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';

export const DENTAL_ALERT_TYPES = [
  'gag_reflex', 'latex_allergy', 'needle_phobia', 'dental_anxiety',
  'tmj_disorder', 'excessive_salivation', 'dry_socket_history',
  'bisphosphonate_use', 'bleeding_disorder', 'other'
] as const;
export type DentalAlertType = typeof DENTAL_ALERT_TYPES[number];

export const DENTAL_ALERT_SEVERITIES = ['low', 'medium', 'high'] as const;
export type DentalAlertSeverity = typeof DENTAL_ALERT_SEVERITIES[number];

export const dentalAlerts = pgTable('dental_alert', {
  ...baseEntityFields,
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  alertType: text('alert_type').notNull().$type<DentalAlertType>(),
  severity: text('severity').notNull().default('medium').$type<DentalAlertSeverity>(),
  description: text('description'),
  active: boolean('active').notNull().default(true),
}, (table) => ({
  patientIdx: index('dental_alert_patient_idx').on(table.patientId),
  activeIdx: index('dental_alert_active_idx').on(table.active),
}));

export type DentalAlert = typeof dentalAlerts.$inferSelect;
export type NewDentalAlert = typeof dentalAlerts.$inferInsert;
