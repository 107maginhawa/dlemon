/**
 * listPatientContacts — GET /dental/patients/:patientId/contacts
 *
 * AC-002 / BR-003: Returns active (non-soft-deleted) contacts for a patient.
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { PatientContactRepository } from './repos/patient-contact.repo';
import type { DatabaseInstance } from '@/core/database';

export async function listPatientContacts(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // patient lookup via facade
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  const contactRepo = new PatientContactRepository(db, logger);
  const contacts = await contactRepo.findByPatientId(patientId);

  return ctx.json(contacts, 200);
}
