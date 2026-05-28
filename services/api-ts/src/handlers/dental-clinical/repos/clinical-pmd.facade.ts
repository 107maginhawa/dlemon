/**
 * clinical-pmd.facade.ts
 *
 * Facade exposing dental-clinical repo data to dental-pmd handlers.
 * Isolates cross-module access behind typed functions.
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { prescriptions } from './prescription.schema';

export async function getPrescriptionsForPMD(
  db: DatabaseInstance,
  visitId: string,
): Promise<Array<{
  id: string;
  rxNormCode: string | null;
  drugName: string;
  dosage: string;
  frequency: string;
}>> {
  return db
    .select({
      id: prescriptions.id,
      rxNormCode: prescriptions.rxNormCode,
      drugName: prescriptions.drugName,
      dosage: prescriptions.dosage,
      frequency: prescriptions.frequency,
    })
    .from(prescriptions)
    .where(eq(prescriptions.visitId, visitId));
}
