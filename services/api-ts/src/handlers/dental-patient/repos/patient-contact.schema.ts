import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';

export const dentalPatientContacts = pgTable('dental_patient_contact', {
  ...baseEntityFields,
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  relationship: text('relationship'),
  phone: text('phone'),
  email: text('email'),
  isGuardian: boolean('is_guardian').default(false).notNull(),
  isEmergencyContact: boolean('is_emergency_contact').default(false).notNull(),
  notes: text('notes'),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  patientIdx: index('dental_patient_contact_patient_idx').on(table.patientId),
}));

export type DentalPatientContact = typeof dentalPatientContacts.$inferSelect;
export type NewDentalPatientContact = typeof dentalPatientContacts.$inferInsert;
