/**
 * visit-pmd.facade.ts
 *
 * Facade exposing dental-visit repo data to dental-pmd handlers.
 * Isolates cross-module access behind typed functions.
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalTreatments } from './treatment.schema';

export async function getTreatmentsForPMD(
  db: DatabaseInstance,
  visitId: string,
): Promise<Array<{
  id: string;
  cdtCode: string;
  description: string;
  toothNumber: number | null;
  surfaces: string[] | null;
  conditionCode: string | null;
  status: string;
  priceCents: number;
}>> {
  return db
    .select({
      id: dentalTreatments.id,
      cdtCode: dentalTreatments.cdtCode,
      description: dentalTreatments.description,
      toothNumber: dentalTreatments.toothNumber,
      surfaces: dentalTreatments.surfaces,
      conditionCode: dentalTreatments.conditionCode,
      status: dentalTreatments.status,
      priceCents: dentalTreatments.priceCents,
    })
    .from(dentalTreatments)
    .where(eq(dentalTreatments.visitId, visitId));
}
