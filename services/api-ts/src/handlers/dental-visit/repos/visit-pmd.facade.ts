/**
 * visit-pmd.facade.ts
 *
 * Facade exposing dental-visit repo data to dental-pmd handlers.
 * Isolates cross-module access behind typed functions.
 */

import { eq, inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalTreatments } from './treatment.schema';
import { dentalVisits } from './visit.schema';

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

/**
 * P2-18: visit encounter metadata for the whole-patient continuity-of-care export.
 * Maps visit IDs (taken from the patient's PMD snapshots) to the dates and status
 * used when building each FHIR `Encounter` resource. Returns a map keyed by visitId.
 */
export async function getVisitEncounterMetaForPMD(
  db: DatabaseInstance,
  visitIds: string[],
): Promise<Map<string, {
  id: string;
  status: string;
  branchId: string;
  activatedAt: Date | null;
  completedAt: Date | null;
  chiefComplaint: string | null;
}>> {
  const map = new Map<string, {
    id: string;
    status: string;
    branchId: string;
    activatedAt: Date | null;
    completedAt: Date | null;
    chiefComplaint: string | null;
  }>();
  if (visitIds.length === 0) return map;
  const rows = await db
    .select({
      id: dentalVisits.id,
      status: dentalVisits.status,
      branchId: dentalVisits.branchId,
      activatedAt: dentalVisits.activatedAt,
      completedAt: dentalVisits.completedAt,
      chiefComplaint: dentalVisits.chiefComplaint,
    })
    .from(dentalVisits)
    .where(inArray(dentalVisits.id, visitIds));
  for (const r of rows) map.set(r.id, r);
  return map;
}
