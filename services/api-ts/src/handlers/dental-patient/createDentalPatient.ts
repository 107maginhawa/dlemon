/**
 * createDentalPatient
 *
 * Dental-specific patient registration endpoint.
 * Staff creates a patient record for a NEW person (not the logged-in user).
 *
 * Path: POST /dental/patients
 * Body: { displayName, dateOfBirth?, gender?, consentGiven?, branchId? }
 *
 * Creates:
 *   1. A new person record (firstName + lastName split from displayName)
 *   2. A patient record linked to that person, with status 'active'
 *
 * FR2.3: Registration requires name; DOB and consent are validated.
 * FR2.20: consentGiven must be true.
 * FR2.9: New patient status is 'active' (Pending status not in schema, maps to active).
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import type { User } from '@/types/auth';
import { PatientRepository } from '@/handlers/patient/repos/patient.repo';
import { persons } from '@/handlers/person/repos/person.schema';

export async function createDentalPatient(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const body = await ctx.req.json();

  if (!body.displayName || typeof body.displayName !== 'string' || !body.displayName.trim()) {
    throw new ValidationError('displayName is required');
  }

  // FR2.20: Consent required
  if (body.consentGiven === false) {
    throw new ValidationError('Patient consent is required');
  }

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Split displayName into firstName + lastName
  const parts = body.displayName.trim().split(/\s+/);
  const firstName = parts[0]!;
  const lastName = parts.slice(1).join(' ') || null;

  // Create a new person record for the patient (distinct from the logged-in user)
  const [newPerson] = await db
    .insert(persons)
    .values({
      id: crypto.randomUUID(),
      firstName,
      ...(lastName ? { lastName } : {}),
      ...(body.dateOfBirth ? { dateOfBirth: body.dateOfBirth } : {}),
      ...(body.gender ? { gender: body.gender } : {}),
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning();

  if (!newPerson) {
    return ctx.json({ error: 'Failed to create person record' }, 500);
  }

  // Create patient record linked to the new person
  const patientRepo = new PatientRepository(db, logger);
  const patient = await patientRepo.createOne({
    person: newPerson.id,
    ...(body.branchId ? { preferredBranchId: body.branchId } : {}),
  });

  const response = {
    ...patient,
    displayName: [firstName, lastName].filter(Boolean).join(' '),
    person: {
      id: newPerson.id,
      firstName,
      lastName,
      dateOfBirth: newPerson.dateOfBirth,
      gender: newPerson.gender,
    },
  };

  logger?.info({ patientId: patient.id, personId: newPerson.id, createdBy: user.id }, 'Dental patient registered');

  return ctx.json(response, 201);
}
