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

/**
 * P2-16: surface likely duplicate-patient groups in a branch for staff review.
 * Maps the repo clusters to a lean, PII-minimal shape (id, displayName, dob,
 * email/phone) suitable for the dedup review UI.
 */
export async function findDuplicatePatientGroups(
  db: DatabaseInstance,
  branchId: string,
): Promise<Array<{
  matchType: 'strong' | 'name';
  matchKey: string;
  patients: Array<{
    id: string;
    displayName: string;
    dateOfBirth: string | null;
    email: string | null;
    phone: string | null;
    createdAt: string;
  }>;
}>> {
  const repo = new PatientRepository(db);
  const groups = await repo.findDuplicateCandidates(branchId);
  return groups.map((g) => ({
    matchType: g.matchType,
    matchKey: g.matchKey,
    patients: g.patients.map((p) => {
      const contact = p.person.contactInfo as { email?: string; phone?: string } | null | undefined;
      const displayName = [p.person.firstName, p.person.lastName].filter(Boolean).join(' ');
      return {
        id: p.id,
        displayName,
        dateOfBirth: p.person.dateOfBirth ?? null,
        email: contact?.email ?? null,
        phone: contact?.phone ?? null,
        createdAt: (p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt as any)).toISOString(),
      };
    }),
  }));
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
