/**
 * bulkArchiveDentalPatients — POST /dental/patients/bulk-archive
 *
 * FR2.13: Bulk archive multiple patients with EC1 guard per patient.
 *
 * Body: { patientIds: string[] }
 * Returns per-patient result: { id, success, reason? }
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { PatientRepository } from '../../patient/repos/patient.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { BulkArchiveDentalPatientsBody } from '@/generated/openapi/validators';

export async function bulkArchiveDentalPatients(
  ctx: ValidatedContext<BulkArchiveDentalPatientsBody, never, never>
) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientIds } = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new PatientRepository(db, logger);

  // Branch-level authorization: verify access to all unique branch IDs
  const patientsToCheck = await Promise.all(
    patientIds.map(id => repo.findOneById(id))
  );
  const uniqueBranchIds = [...new Set(
    patientsToCheck
      .filter((p): p is NonNullable<typeof p> => p != null && !!p.preferredBranchId)
      .map(p => p.preferredBranchId as string)
  )];
  for (const branchId of uniqueBranchIds) {
    await assertBranchAccess(db, user.id, branchId);
  }

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
