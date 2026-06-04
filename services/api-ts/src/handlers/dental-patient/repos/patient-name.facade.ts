/**
 * patient-name.facade.ts
 *
 * Narrow read so the P1-20 case-presentation aggregate can surface the patient's
 * first name — the only PII shown on the presentation. Joins patient → person via
 * relative schema imports (facade file = boundary-exempt), the same loose-coupling
 * pattern the other dental-patient facades use.
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { patients } from '../../patient/repos/patient.schema';
import { persons } from '../../person/repos/person.schema';

/** The patient's first name (from the linked Person), or '' if not found. */
export async function getPatientFirstName(
  db: DatabaseInstance,
  patientId: string,
): Promise<string> {
  const [row] = await db
    .select({ firstName: persons.firstName })
    .from(patients)
    .innerJoin(persons, eq(patients.person, persons.id))
    .where(eq(patients.id, patientId))
    .limit(1);
  return row?.firstName ?? '';
}
