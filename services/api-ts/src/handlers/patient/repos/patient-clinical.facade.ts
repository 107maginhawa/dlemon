/**
 * patient-clinical.facade.ts
 *
 * Facade exposing patient data to dental-clinical handlers.
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { patients } from './patient.schema';

export async function getPatientForClinical(
  db: DatabaseInstance,
  patientId: string,
): Promise<{ id: string; preferredBranchId: string | null } | null> {
  const [row] = await db
    .select({ id: patients.id, preferredBranchId: patients.preferredBranchId })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  return row ?? null;
}
