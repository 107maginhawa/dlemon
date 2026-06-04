/**
 * case-presentation-consent.facade.ts
 *
 * Narrow write surface so the P1-20 case-presentation accept handler (dental-patient)
 * can persist an immutable consent e-signature when a patient accepts a presented
 * plan, without reaching into the dental-clinical consent repo across the module
 * boundary. The consent_form row is created already-signed (the e-sig is captured
 * at the moment of acceptance) and is immutable thereafter (V-CLN-005).
 */

import type { DatabaseInstance } from '@/core/database';
import { consentForms, type ConsentForm } from './consent-form.schema';

export interface AcceptanceConsentInput {
  visitId: string;
  patientId: string;
  signatureData: string;
  signerName: string;
  /** Immutable plan-version snapshot the patient accepted, if any. */
  acceptedPlanVersionId?: string | null;
  createdBy: string;
}

/**
 * Write an already-signed, immutable consent e-sig for a case-presentation accept.
 * Reuses the consent_form store + V-CLN-005 immutability (signed=true, signedAt set,
 * never mutated afterward). Returns the created consent form.
 */
export async function writeAcceptanceConsent(
  db: DatabaseInstance,
  input: AcceptanceConsentInput,
): Promise<ConsentForm> {
  const now = new Date();
  const [row] = await db
    .insert(consentForms)
    .values({
      visitId: input.visitId,
      patientId: input.patientId,
      templateId: 'treatment-plan-acceptance',
      templateName: 'Treatment Plan Acceptance',
      signed: true,
      signedAt: now,
      signatureData: input.signatureData,
      acceptedPlanVersionId: input.acceptedPlanVersionId ?? null,
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
    })
    .returning();
  if (!row) throw new Error('Insert returned no row');
  return row;
}
