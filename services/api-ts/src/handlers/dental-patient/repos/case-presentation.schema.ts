/**
 * dental_case_presentation — P1-20 patient-facing treatment case presentation.
 *
 * A presentation turns a *presented* treatment plan into a decision the patient can
 * make: a read-only, patient-readable surface (phased ₱ breakdown + alternates +
 * annotated imaging refs) plus an accept (e-sign) / reject action.
 *
 * Phase 1 (this pass) drives the in-app, staff-`bearerAuth` path only. The
 * `shareToken*` columns are reserved for the deferred Phase-2 public link family
 * (docs/reviews/plans/04-case-presentation.md §3.3) and are nullable + unused for now.
 *
 * Immutability (reuses the consent e-sig V-CLN-005 pattern): once `decision` is set
 * the presentation is terminal. Re-deciding is a 422 PRESENTATION_DECIDED business
 * error, exactly like re-signing a consent form; the signature payload, once
 * captured, is never mutated.
 *
 * Additive + append-only: composes the existing stores (treatment-plan header,
 * immutable plan-version snapshot, consent_form e-sig, status-history). No change
 * to treatment-plan / treatment / treatment-plan-version / consent-form schemas.
 */

import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';
import { dentalTreatmentPlans } from './treatment-plan.schema';

export const CASE_PRESENTATION_STATUSES = [
  'draft',
  'sent',
  'viewed',
  'accepted',
  'rejected',
  'expired',
  'revoked',
] as const;
export type CasePresentationStatus = typeof CASE_PRESENTATION_STATUSES[number];

export const CASE_PRESENTATION_DECISIONS = ['accepted', 'rejected'] as const;
export type CasePresentationDecision = typeof CASE_PRESENTATION_DECISIONS[number];

export const dentalCasePresentations = pgTable('dental_case_presentation', {
  ...baseEntityFields,
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  treatmentPlanId: uuid('treatment_plan_id')
    .notNull()
    .references(() => dentalTreatmentPlans.id, { onDelete: 'cascade' }),
  /** Loose ref to treatment_plan_version (dental-visit) — no hard FK, cross-module. */
  planVersionId: uuid('plan_version_id'),
  status: text('status').notNull().default('draft').$type<CasePresentationStatus>(),
  /** Terminal patient decision; null until accept/reject. */
  decision: text('decision').$type<CasePresentationDecision | null>(),
  decisionAt: timestamp('decision_at'),
  /** Captured e-sig payload on accept (reuses consent e-sig payload shape). */
  signatureData: text('signature_data'),
  /** Name typed at signing (patient/guardian). */
  signerName: text('signer_name'),
  /** Loose ref to consent_form (dental-clinical) written on accept. */
  consentFormId: uuid('consent_form_id'),
  rejectionReason: text('rejection_reason'),
  // --- Phase-2 (deferred) shareable-link columns; reserved, nullable, unused. ---
  /** High-entropy opaque token for the deferred public link (NOT the plan id). */
  shareToken: text('share_token').unique(),
  shareTokenExpiresAt: timestamp('share_token_expires_at'),
  // --- engagement telemetry ---
  firstViewedAt: timestamp('first_viewed_at'),
  lastViewedAt: timestamp('last_viewed_at'),
}, (table) => ({
  patientIdx: index('dental_case_presentation_patient_idx').on(table.patientId),
  planIdx: index('dental_case_presentation_plan_idx').on(table.treatmentPlanId),
  shareTokenIdx: index('dental_case_presentation_share_token_idx').on(table.shareToken),
}));

export type DentalCasePresentation = typeof dentalCasePresentations.$inferSelect;
export type NewDentalCasePresentation = typeof dentalCasePresentations.$inferInsert;
