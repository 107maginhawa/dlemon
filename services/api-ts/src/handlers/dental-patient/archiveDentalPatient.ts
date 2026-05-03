/**
 * archiveDentalPatient — POST /dental/patients/:id/archive
 *
 * FR2.7: Archive patient with EC1 guard (block if active payment plan).
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { PatientRepository } from '../patient/repos/patient.repo';

export async function archiveDentalPatient(ctx: Context) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.param('id');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new PatientRepository(db, logger);
  const result = await repo.archivePatient(patientId);

  if (!result.success) {
    if (result.reason === 'Patient not found') {
      throw new NotFoundError(result.reason);
    }
    throw new BusinessLogicError(result.reason ?? 'Cannot archive patient', 'ARCHIVE_BLOCKED');
  }

  logger?.info({ action: 'archiveDentalPatient', patientId, actorId: user.id }, 'Patient archived');

  const updated = await repo.findOneById(patientId);
  return ctx.json(updated, 200);
}
