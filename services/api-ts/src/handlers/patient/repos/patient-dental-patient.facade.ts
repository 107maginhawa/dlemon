/**
 * patient-dental-patient.facade.ts
 *
 * Facade exposing patient repo data to dental-patient handlers.
 * Isolates cross-module access behind typed functions.
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { patients } from './patient.schema';
import { PatientRepository } from './patient.repo';

/** Lookup patient for branch authorization. Returns { id, preferredBranchId, status } or null. */
export async function getPatientForDentalPatient(
  db: DatabaseInstance,
  patientId: string,
): Promise<{ id: string; preferredBranchId: string | null; status: string } | null> {
  const [row] = await db
    .select({ id: patients.id, preferredBranchId: patients.preferredBranchId, status: patients.status })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  return row ?? null;
}

/** Find potential duplicate patients by name. Returns id-only array. */
export async function findDuplicateDentalPatients(
  db: DatabaseInstance,
  firstName: string,
  lastName: string | null,
  branchId?: string,
): Promise<{ id: string }[]> {
  const repo = new PatientRepository(db);
  const results = await repo.findPotentialDuplicates(firstName, lastName, branchId);
  return results.map(p => ({ id: p.id }));
}

/** Create a patient record during registration. Returns the full Patient. */
export async function createPatientForRegistration(
  db: DatabaseInstance,
  personId: string,
  branchId?: string,
) {
  const repo = new PatientRepository(db);
  return repo.createOne({
    person: personId,
    ...(branchId ? { preferredBranchId: branchId } : {}),
  });
}

/** Insert a patient row inside a Drizzle transaction (importPatients use case). */
export async function insertPatientForImport(
  db: DatabaseInstance,
  personId: string,
  branchId: string,
  actorId: string,
) {
  const [patient] = await db
    .insert(patients)
    .values({
      person: personId,
      preferredBranchId: branchId,
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning();
  return patient!;
}
