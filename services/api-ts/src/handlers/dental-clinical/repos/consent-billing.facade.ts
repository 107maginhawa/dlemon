/**
 * consent-billing.facade.ts
 *
 * Facade exposing dental-clinical consent data to dental-billing handlers.
 * Isolates cross-module access behind a typed function.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { consentForms } from './consent-form.schema';

export async function hasSignedConsentForVisit(
  db: DatabaseInstance,
  visitId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: consentForms.id })
    .from(consentForms)
    // V-CLN-010: a revoked consent never satisfies the billing gate either.
    .where(and(eq(consentForms.visitId, visitId), eq(consentForms.signed, true), eq(consentForms.revoked, false)))
    .limit(1);
  return row != null;
}
