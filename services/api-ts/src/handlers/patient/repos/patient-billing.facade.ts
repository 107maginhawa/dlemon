/**
 * patient-billing.facade.ts
 *
 * Facade exposing patient + person data to dental-billing handlers.
 * Cross-module schema import (persons) is intentional and permitted
 * within facade files, which are exempt from the boundary checker.
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { patients } from './patient.schema';
import { persons } from '@/handlers/person/repos/person.schema';

export async function getPatientWithPersonForInvoice(
  db: DatabaseInstance,
  patientId: string,
) {
  const [row] = await db
    .select({
      patientId: patients.id,
      personId: patients.person,
      firstName: persons.firstName,
      lastName: persons.lastName,
      dateOfBirth: persons.dateOfBirth,
    })
    .from(patients)
    .innerJoin(persons, eq(patients.person, persons.id))
    .where(eq(patients.id, patientId))
    .limit(1);
  return row ?? null;
}

/**
 * Patient id + preferred branch, for billing branch-level authorization.
 * Returns null when the patient does not exist.
 */
export async function getPatientBranchForBilling(
  db: DatabaseInstance,
  patientId: string,
): Promise<{ id: string; preferredBranchId: string | null; person: string | null } | null> {
  const [row] = await db
    .select({ id: patients.id, preferredBranchId: patients.preferredBranchId, person: patients.person })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  return row ?? null;
}
