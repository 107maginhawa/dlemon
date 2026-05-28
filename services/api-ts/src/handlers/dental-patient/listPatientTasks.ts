/**
 * listPatientTasks — GET /dental/patients/:patientId/tasks
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { TaskRepository } from './repos/task.repo';
import type { DatabaseInstance } from '@/core/database';

export async function listPatientTasks(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // patient lookup via facade
  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  const taskRepo = new TaskRepository(db, logger);
  const tasks = await taskRepo.findByPatientId(patientId);

  return ctx.json(tasks, 200);
}
