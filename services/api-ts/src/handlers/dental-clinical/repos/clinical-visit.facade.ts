/**
 * clinical-visit.facade.ts
 *
 * Facade exposing dental-clinical data to dental-visit handlers.
 * Isolates cross-module access behind typed functions.
 */

import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalAttachments } from './attachment.schema';
import { consentForms } from './consent-form.schema';

/**
 * Count attachments linked to a visit. Used by BR-005 (auto-discard empty visit).
 */
export async function countAttachmentsForVisit(
  db: DatabaseInstance,
  visitId: string,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dentalAttachments)
    .where(eq(dentalAttachments.visitId, visitId));
  return row?.count ?? 0;
}

/**
 * True if any consent form for the visit is signed.
 * Used by visit-completion guard and treatment status=performed guard.
 */
export async function hasSignedConsentForVisit(
  db: DatabaseInstance,
  visitId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: consentForms.id })
    .from(consentForms)
    // V-CLN-010: a revoked consent never satisfies the gate (WF-035: treatment blocked).
    .where(and(eq(consentForms.visitId, visitId), eq(consentForms.signed, true), eq(consentForms.revoked, false)))
    .limit(1);
  return row != null;
}
