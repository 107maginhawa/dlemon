/**
 * createTask — POST /dental/patients/:patientId/tasks
 *
 * P2-003: Create a patient-level task (status defaults to 'open').
 */

import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { TaskRepository } from '../repos/task.repo';
import type { DatabaseInstance } from '@/core/database';

export async function createTask(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

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

  const taskRepo = new TaskRepository(db, logger);
  const task = await taskRepo.create({
    patientId,
    title: body.title,
    taskType: body.taskType,
    description: body.description ?? null,
    status: 'open',
    dueDate: body.dueDate ?? null,
    assignedTo: body.assignedTo ?? null,
    createdBy: user.id,
    updatedBy: user.id,
  });

  logger?.info({ action: 'createTask', patientId, taskId: task.id }, 'Task created');

  return ctx.json(task, 201);
}
