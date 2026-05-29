/**
 * updateRecall — PATCH /dental/patients/:patientId/recalls/:recallId
 *
 * AC-003 / AC-004: Update recall fields. Enforces FSM for status transitions.
 * BR-003: completed and cancelled are terminal states.
 */

import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors'; // BusinessLogicError used for FSM + PATIENT_ARCHIVED
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { RecallRepository } from '../repos/recall.repo';
import { RECALL_FSM, type RecallStatus } from '../repos/recall.schema';
import type { DatabaseInstance } from '@/core/database';

export async function updateRecall(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, recallId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // patient lookup via facade
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // EF-PAT-001: block writes on archived patients
  if (patient.status === 'archived') {
    throw new BusinessLogicError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  const recallRepo = new RecallRepository(db, logger);
  const existing = await recallRepo.findOneById(recallId, patientId);
  if (!existing) throw new NotFoundError('Recall not found');

  const updates: Record<string, unknown> = {};

  if (body['type'] !== undefined) updates['type'] = body['type'];
  if (body['dueDate'] !== undefined) updates['dueDate'] = body['dueDate'];
  if (body['notes'] !== undefined) updates['notes'] = body['notes'];

  if (body['status'] !== undefined) {
    const from = existing.status as RecallStatus;
    const to = body['status'] as RecallStatus;
    const allowed = RECALL_FSM[from];

    if (!allowed.includes(to)) {
      throw new BusinessLogicError(
        `Invalid status transition: ${from} → ${to}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
        'RECALL_INVALID_TRANSITION',
      );
    }

    updates['status'] = to;
    if (to === 'sent') updates['sentAt'] = new Date();
    if (to === 'completed') updates['completedAt'] = new Date();
  }

  const recall = await recallRepo.update(recallId, patientId, updates as any);
  if (!recall) throw new NotFoundError('Recall not found');

  logger?.info({ action: 'updateRecall', patientId, recallId, updates }, 'Recall updated');

  return ctx.json(recall, 200);
}
