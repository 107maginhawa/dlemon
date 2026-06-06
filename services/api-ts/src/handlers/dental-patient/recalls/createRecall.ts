/**
 * createRecall — POST /dental/patients/:patientId/recalls
 *
 * AC-001: Create a recall entry for a patient (status defaults to 'pending').
 */

import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { RecallRepository } from '../repos/recall.repo';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function createRecall(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param') as { patientId: string };
  const body = ctx.req.valid('json') as { type: 'cleaning' | 'checkup' | 'treatment' | 'other'; dueDate: string; notes?: string | null; intervalMonths?: number | null };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // patient lookup via facade
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // EF-PAT-004: branch-level authorization
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  // EF-PAT-001: block writes on archived patients
  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  const recallRepo = new RecallRepository(db, logger);
  const recall = await recallRepo.create({
    patientId,
    type: body.type,
    dueDate: body.dueDate,
    status: 'pending',
    notes: body.notes ?? null,
    // P1-24: optional recurrence interval (drives next-cycle seeding on completion)
    intervalMonths: body.intervalMonths ?? null,
    createdBy: user.id,
    updatedBy: user.id,
  });

  logger?.info({ action: 'createRecall', patientId, recallId: recall.id }, 'Recall created');

  return ctx.json(recall, 201);
}
