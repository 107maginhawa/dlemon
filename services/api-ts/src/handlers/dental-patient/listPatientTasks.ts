/**
 * listPatientTasks — GET /dental/patients/:patientId/tasks
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PatientRepository } from '@/handlers/patient/repos/patient.repo';
import { TaskRepository } from './repos/task.repo';
import type { DatabaseInstance } from '@/core/database';

export async function listPatientTasks(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patientRepo = new PatientRepository(db, logger);
  const patient = await patientRepo.findOneById(patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  const taskRepo = new TaskRepository(db, logger);
  const tasks = await taskRepo.findByPatientId(patientId);

  return ctx.json(tasks, 200);
}
