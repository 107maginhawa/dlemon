/**
 * clinical-pmd.facade.ts
 *
 * Facade exposing dental-clinical repo data to dental-pmd handlers.
 * Isolates cross-module access behind typed functions.
 */

import { eq, and, asc, inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { prescriptions } from './prescription.schema';
import { medicalHistoryEntries } from './medical-history.schema';

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

/** One safety-floor entry as captured in the PMD snapshot. */
export interface PMDSafetyFloorEntry {
  displayName: string;
  code: string | null;
  codeSystem: string | null;
  notes: string | null;
  onsetDate: string | null;
}

/**
 * The patient's "safety floor" for the PMD snapshot (FR12.1): the minimum
 * safety-critical clinical data the document exists to carry — active
 * allergies, current medications, and active conditions. Sourced from the
 * dental-clinical medical-history record (the same source as the Workspace
 * Safety Floor panel, FR12.3). Rows are deterministically ordered so the
 * checksum that seals the snapshot is reproducible on regeneration.
 */
export interface PMDSafetyFloor {
  allergies: PMDSafetyFloorEntry[];
  medications: PMDSafetyFloorEntry[];
  conditions: PMDSafetyFloorEntry[];
}

export async function getSafetyFloorForPMD(
  db: DatabaseInstance,
  patientId: string,
): Promise<PMDSafetyFloor> {
  const rows = await db
    .select({
      entryType: medicalHistoryEntries.entryType,
      displayName: medicalHistoryEntries.displayName,
      code: medicalHistoryEntries.code,
      codeSystem: medicalHistoryEntries.codeSystem,
      notes: medicalHistoryEntries.notes,
      onsetDate: medicalHistoryEntries.onsetDate,
    })
    .from(medicalHistoryEntries)
    .where(
      and(
        eq(medicalHistoryEntries.patientId, patientId),
        eq(medicalHistoryEntries.active, true),
        inArray(medicalHistoryEntries.entryType, ['allergy', 'medication', 'condition']),
      ),
    )
    // Stable ordering → deterministic snapshot → reproducible checksum.
    .orderBy(
      asc(medicalHistoryEntries.entryType),
      asc(medicalHistoryEntries.displayName),
      asc(medicalHistoryEntries.id),
    );

  const floor: PMDSafetyFloor = { allergies: [], medications: [], conditions: [] };
  for (const r of rows) {
    const entry: PMDSafetyFloorEntry = {
      displayName: r.displayName,
      code: r.code,
      codeSystem: r.codeSystem,
      notes: r.notes,
      onsetDate: r.onsetDate,
    };
    if (r.entryType === 'allergy') floor.allergies.push(entry);
    else if (r.entryType === 'medication') floor.medications.push(entry);
    else if (r.entryType === 'condition') floor.conditions.push(entry);
  }
  return floor;
}
