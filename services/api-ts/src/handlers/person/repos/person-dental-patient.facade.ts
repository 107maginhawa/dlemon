/**
 * person-dental-patient.facade.ts
 *
 * Facade exposing person repo data to dental-patient handlers.
 * Isolates cross-module access behind typed functions.
 */

import type { DatabaseInstance } from '@/core/database';
import { persons } from './person.schema';

export async function createPersonForDentalPatient(
  db: DatabaseInstance,
  data: {
    id?: string;
    firstName: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: string;
  },
  actorId: string,
) {
  const [person] = await db
    .insert(persons)
    .values({
      ...(data.id ? { id: data.id } : {}),
      firstName: data.firstName,
      ...(data.lastName ? { lastName: data.lastName } : {}),
      ...(data.dateOfBirth ? { dateOfBirth: data.dateOfBirth } : {}),
      ...(data.gender ? { gender: data.gender as typeof persons.gender._.data } : {}),
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning();
  return person!;
}
