/**
 * detectDuplicatePatients — GET /dental/patients/duplicates?branchId=...
 *
 * P2-16: surface likely-duplicate patients (name + DOB + contact match) in a
 * branch so the front desk can review and merge them. Merge itself already
 * exists (patient/mergePatients.ts); this is the detection/surfacing half.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { findDuplicatePatientGroups } from '@/handlers/patient/repos/patient-dental-patient.facade';
import type { User } from '@/types/auth';
import type { DetectDuplicatePatientsQuery } from '@/generated/openapi/validators';

export async function detectDuplicatePatients(
  ctx: ValidatedContext<never, DetectDuplicatePatientsQuery, never>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { branchId } = ctx.req.valid('query');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Branch-level authorization — only members of the branch can scan it.
  await assertBranchAccess(db, user.id, branchId);

  const groups = await findDuplicatePatientGroups(db, branchId);

  logger?.info(
    { action: 'detectDuplicatePatients', branchId, groupCount: groups.length },
    'Duplicate-patient candidates detected',
  );

  return ctx.json({ groups, groupCount: groups.length }, 200);
}
