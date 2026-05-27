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
    .where(and(eq(consentForms.visitId, visitId), eq(consentForms.signed, true)))
    .limit(1);
  return row != null;
}
