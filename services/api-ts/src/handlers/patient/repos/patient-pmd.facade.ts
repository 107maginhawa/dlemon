/**
 * patient-pmd.facade.ts
 *
 * Facade exposing patient repo data to dental-pmd handlers.
 * Isolates cross-module access behind typed functions.
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { patients } from './patient.schema';
import { persons } from '../../person/repos/person.schema';

export async function getPatientForPMD(
  db: DatabaseInstance,
  patientId: string,
): Promise<{ id: string; preferredBranchId: string | null; person: string } | null> {
  const [row] = await db
    .select({ id: patients.id, preferredBranchId: patients.preferredBranchId, person: patients.person })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  return row ?? null;
}

/**
 * P2-18: patient demographics needed to build the FHIR `Patient` resource for a
 * whole-patient continuity-of-care export. Joins the backing person row.
 * Returns null when the patient/person isn't found.
 */
export async function getPatientDemographicsForPMD(
  db: DatabaseInstance,
  patientId: string,
): Promise<{
  patientId: string;
  personId: string;
  firstName: string;
  lastName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
} | null> {
  const [row] = await db
    .select({
      patientId: patients.id,
      personId: persons.id,
      firstName: persons.firstName,
      lastName: persons.lastName,
      dateOfBirth: persons.dateOfBirth,
      gender: persons.gender,
    })
    .from(patients)
    .innerJoin(persons, eq(persons.id, patients.person))
    .where(eq(patients.id, patientId))
    .limit(1);
  return row ?? null;
}
