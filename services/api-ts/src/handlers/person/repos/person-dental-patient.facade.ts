/**
 * person-dental-patient.facade.ts
 *
 * Facade exposing person repo data to dental-patient handlers.
 * Isolates cross-module access behind typed functions.
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { persons } from './person.schema';
import type { PersonConsent, CommunicationChannelConsent } from './person.schema';
import { patients } from '../../patient/repos/patient.schema';

export async function createPersonForDentalPatient(
  db: DatabaseInstance,
  data: {
    id?: string;
    firstName: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: string;
    // V-PAT-005: persisted registration consent captured at creation.
    consent?: PersonConsent;
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
      ...(data.consent ? { consent: data.consent } : {}),
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning();
  return person!;
}

/**
 * FR2.4: update the demographics (name / DOB / gender) on the person backing a
 * dental patient. Only the fields supplied are changed (partial update). The
 * caller (updateDentalPatient handler) owns authorization, the archived guard,
 * and field validation; this facade is pure persistence. Returns the updated
 * declared person subset, or null if the patient/person isn't found.
 *
 * Contact info (phone/email) is intentionally NOT writable here: V-PAT-014 keeps
 * person.contactInfo out of the patient profile response, so it has no read
 * surface to edit against.
 */
export async function updatePatientDemographics(
  db: DatabaseInstance,
  patientId: string,
  demographics: {
    firstName?: string;
    lastName?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
  },
  actorId: string,
): Promise<{
  id: string;
  firstName: string;
  lastName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
} | null> {
  const [link] = await db
    .select({ personId: patients.person })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  if (!link?.personId) return null;

  const updateData: {
    updatedBy: string;
    updatedAt: Date;
    firstName?: string;
    lastName?: string | null;
    dateOfBirth?: string | null;
    gender?: typeof persons.gender._.data | null;
  } = { updatedBy: actorId, updatedAt: new Date() };

  if (demographics.firstName !== undefined) updateData.firstName = demographics.firstName;
  if (demographics.lastName !== undefined) updateData.lastName = demographics.lastName;
  if (demographics.dateOfBirth !== undefined) updateData.dateOfBirth = demographics.dateOfBirth;
  if (demographics.gender !== undefined) {
    updateData.gender = demographics.gender as typeof persons.gender._.data | null;
  }

  const [updated] = await db
    .update(persons)
    .set(updateData)
    .where(eq(persons.id, link.personId))
    .returning({
      id: persons.id,
      firstName: persons.firstName,
      lastName: persons.lastName,
      dateOfBirth: persons.dateOfBirth,
      gender: persons.gender,
    });
  if (!updated) return null;

  return {
    id: updated.id,
    firstName: updated.firstName,
    lastName: updated.lastName ?? null,
    dateOfBirth: updated.dateOfBirth ?? null,
    gender: updated.gender ?? null,
  };
}

/**
 * P1-28: read the persisted consent (registration + per-channel) for the person
 * backing a dental patient. Returns null if the patient/person isn't found.
 */
export async function getPatientPersonConsent(
  db: DatabaseInstance,
  patientId: string,
): Promise<PersonConsent | null> {
  const [row] = await db
    .select({ consent: persons.consent })
    .from(patients)
    .innerJoin(persons, eq(persons.id, patients.person))
    .where(eq(patients.id, patientId))
    .limit(1);
  if (!row) return null;
  return (row.consent as PersonConsent | null) ?? null;
}

/**
 * P1-28: merge per-channel communication consent onto the person backing a dental
 * patient. Only the channels supplied are changed (partial update); the
 * registration consent and capturedAt are preserved. Returns the updated consent,
 * or null if the patient/person isn't found.
 */
export async function updatePatientChannelConsent(
  db: DatabaseInstance,
  patientId: string,
  channels: CommunicationChannelConsent,
  actorId: string,
): Promise<PersonConsent | null> {
  const [link] = await db
    .select({ personId: patients.person })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  if (!link?.personId) return null;

  const [existingPerson] = await db
    .select({ consent: persons.consent })
    .from(persons)
    .where(eq(persons.id, link.personId))
    .limit(1);

  const prev = (existingPerson?.consent as PersonConsent | null) ?? null;
  const nextConsent: PersonConsent = {
    registrationConsent: prev?.registrationConsent ?? false,
    capturedAt: prev?.capturedAt ?? new Date().toISOString(),
    channels: { ...(prev?.channels ?? {}), ...channels },
    channelsUpdatedAt: new Date().toISOString(),
  };

  const [updated] = await db
    .update(persons)
    .set({ consent: nextConsent, updatedBy: actorId, updatedAt: new Date() })
    .where(eq(persons.id, link.personId))
    .returning({ consent: persons.consent });

  return (updated?.consent as PersonConsent | null) ?? null;
}
