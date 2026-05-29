/**
 * bulkArchiveDentalPatients — POST /dental/patients/bulk-archive
 *
 * FR2.13: Bulk archive multiple patients with EC1 guard per patient.
 *
 * Body: { ids: string[] (1–50), reason: string (5–500) }
 * Returns per-patient result: { id, success, reason? }
 *
 * V-PAT-012: body validated locally as { ids, reason } (renamed from patientIds,
 * reason now required, list capped at 50). The handler self-validates because the
 * generated validator is regenerated centrally from the TypeSpec change.
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import { PatientRepository } from '../../patient/repos/patient.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { z } from 'zod';

const bulkArchiveSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'ids must contain at least 1 patient').max(50, 'ids cannot exceed 50 patients'),
  reason: z.string().min(5, 'reason must be at least 5 characters').max(500, 'reason must be at most 500 characters'),
});

export async function bulkArchiveDentalPatients(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const rawBody = await ctx.req.json().catch(() => ({}));
  const parsed = bulkArchiveSchema.safeParse(rawBody);
  if (!parsed.success) {
    // Map to a 400 ValidationError so it surfaces consistently regardless of
    // whether a route-level zValidator is wired (V-PAT-012).
    throw new ValidationError(parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  const { ids, reason } = parsed.data;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new PatientRepository(db, logger);

  // Branch-level authorization: verify access to all unique branch IDs
  const patientsToCheck = await Promise.all(
    ids.map(id => repo.findOneById(id))
  );
  const uniqueBranchIds = [...new Set(
    patientsToCheck
      .filter((p): p is NonNullable<typeof p> => p != null && !!p.preferredBranchId)
      .map(p => p.preferredBranchId as string)
  )];
  for (const branchId of uniqueBranchIds) {
    await assertBranchRole(db, user.id, branchId, ['dentist_owner']);
  }

  const results = await Promise.all(
    ids.map(async (id) => {
      const result = await repo.archivePatient(id, reason);
      return { id, ...result };
    })
  );

  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  logger?.info(
    { action: 'bulkArchiveDentalPatients', total: ids.length, successCount, failCount, actorId: user.id, reason },
    'Bulk archive completed'
  );

  return ctx.json({ results, successCount, failCount }, 200);
}
