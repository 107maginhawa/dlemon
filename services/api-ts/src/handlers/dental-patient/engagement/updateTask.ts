/**
 * updateTask — PATCH /dental/patients/:patientId/tasks/:taskId
 *
 * P2-003: Update task fields. Enforces FSM for status transitions.
 * done and cancelled are terminal states.
 */

import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { TaskRepository } from '../repos/task.repo';
import { TASK_FSM, type TaskStatus } from '../repos/task.schema';
import type { DatabaseInstance } from '@/core/database';

export async function updateTask(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, taskId } = ctx.req.valid('param');
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

  const taskRepo = new TaskRepository(db, logger);
  const existing = await taskRepo.findOneById(taskId, patientId);
  if (!existing) throw new NotFoundError('Task not found');

  const updates: Record<string, unknown> = {};

  if (body['title'] !== undefined) updates['title'] = body['title'];
  if (body['description'] !== undefined) updates['description'] = body['description'];
  if (body['taskType'] !== undefined) updates['taskType'] = body['taskType'];
  if (body['dueDate'] !== undefined) updates['dueDate'] = body['dueDate'];
  if (body['assignedTo'] !== undefined) updates['assignedTo'] = body['assignedTo'];

  if (body['status'] !== undefined) {
    const from = existing.status as TaskStatus;
    const to = body['status'] as TaskStatus;
    const allowed = TASK_FSM[from];

    if (!allowed.includes(to)) {
      throw new BusinessLogicError(
        `Invalid status transition: ${from} → ${to}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
        'TASK_INVALID_TRANSITION',
      );
    }

    updates['status'] = to;
    if (to === 'done') updates['completedAt'] = new Date();
  }

  updates['updatedBy'] = user.id;

  const task = await taskRepo.update(taskId, patientId, updates as any);
  if (!task) throw new NotFoundError('Task not found');

  logger?.info({ action: 'updateTask', patientId, taskId, updates }, 'Task updated');

  return ctx.json(task, 200);
}
