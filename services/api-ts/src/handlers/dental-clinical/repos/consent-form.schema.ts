/**
 * Drizzle schema for consent forms (immutable after signing)
 */

import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalVisits } from '../../dental-visit/repos/visit.schema';
import { patients } from '../../patient/repos/patient.schema';
import { treatmentPlanVersions } from '../../dental-visit/repos/treatment-plan-version.schema';

export const consentForms = pgTable('consent_form', {
  ...baseEntityFields,
  visitId: uuid('visit_id').notNull().references(() => dentalVisits.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  templateId: text('template_id').notNull(),
  templateName: text('template_name').notNull(),
  // P1-3: ADA-required structured consent content fields
  procedureNature: text('procedure_nature'),
  benefits: text('benefits'),
  risks: text('risks'),
  alternatives: text('alternatives'),
  risksOfNonTreatment: text('risks_of_non_treatment'),
  signedAt: timestamp('signed_at'),
  signatureData: text('signature_data'),
  signed: boolean('signed').notNull().default(false),
  // Links this consent form to the treatment plan version that was accepted
  // during this visit. Nullable: consent forms for other purposes (e.g. x-ray)
  // do not have an associated plan version.
  acceptedPlanVersionId: uuid('accepted_plan_version_id').references(
    () => treatmentPlanVersions.id,
    { onDelete: 'set null' },
  ),
  // DE-013 revocation fields (EM-CLI-001)
  revoked: boolean('revoked').notNull().default(false),
  revokedAt: timestamp('revoked_at'),
  revokedBy: uuid('revoked_by'),
});

export type ConsentForm = typeof consentForms.$inferSelect;
export type NewConsentForm = typeof consentForms.$inferInsert;
