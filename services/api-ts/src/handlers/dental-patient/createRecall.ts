/**
 * createRecall — POST /dental/patients/:patientId/recalls
 *
 * AC-001: Create a recall entry for a patient (status defaults to 'pending').
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { RecallRepository } from './repos/recall.repo';
import type { DatabaseInstance } from '@/core/database';

export async function createRecall(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // patient lookup via facade
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  const recallRepo = new RecallRepository(db, logger);
  const recall = await recallRepo.create({
    patientId,
    type: body.type,
    dueDate: body.dueDate,
    status: 'pending',
    notes: body.notes ?? null,
    createdBy: user.id,
    updatedBy: user.id,
  });

  logger?.info({ action: 'createRecall', patientId, recallId: recall.id }, 'Recall created');

  return ctx.json(recall, 201);
}
