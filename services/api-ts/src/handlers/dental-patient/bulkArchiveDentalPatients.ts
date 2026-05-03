/**
 * bulkArchiveDentalPatients — POST /dental/patients/bulk-archive
 *
 * FR2.13: Bulk archive multiple patients with EC1 guard per patient.
 *
 * Body: { patientIds: string[] }
 * Returns per-patient result: { id, success, reason? }
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import { PatientRepository } from '../patient/repos/patient.repo';

export async function bulkArchiveDentalPatients(ctx: Context) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  let body: any;
  try {
    body = await ctx.req.json();
  } catch {
    throw new ValidationError('Invalid JSON body');
  }

  const patientIds: string[] = body?.patientIds ?? [];
  if (!Array.isArray(patientIds) || patientIds.length === 0) {
    throw new ValidationError('patientIds must be a non-empty array');
  }

  if (patientIds.length > 100) {
    throw new ValidationError('Cannot bulk archive more than 100 patients at once');
  }

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new PatientRepository(db, logger);

  const results = await Promise.all(
    patientIds.map(async (id) => {
      const result = await repo.archivePatient(id);
      return { id, ...result };
    })
  );

  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  logger?.info(
    { action: 'bulkArchiveDentalPatients', total: patientIds.length, successCount, failCount, actorId: user.id },
    'Bulk archive completed'
  );

  return ctx.json({ results, successCount, failCount }, 200);
}
