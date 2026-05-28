/**
 * importPMD handler
 *
 * POST /dental/pmd/import
 * Imports an external PMD record (read-only, links to patient).
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { ImportedPMDRepository } from './repos/imported-pmd.repo';
import { getPatientForPMD } from '@/handlers/patient/repos/patient-pmd.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { User } from '@/types/auth';
import type { ImportPMDBody } from '@/generated/openapi/validators';

export async function importPMD(
  ctx: ValidatedContext<ImportPMDBody>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization via patient's preferred branch
  const patient = await getPatientForPMD(db, body.patientId);
  if (!patient) throw new NotFoundError('Patient');
  if (!patient.preferredBranchId) throw new ForbiddenError('Patient has no assigned branch');
  await assertBranchRole(db, user.id, patient.preferredBranchId, ['dentist_owner', 'dentist_associate', 'staff_full']);

  const repo = new ImportedPMDRepository(db);

  const imported = await repo.createOne({
    patientId: body.patientId,
    sourceFacility: body.sourceFacility,
    sourceReference: body.sourceReference,
    content: body.content,
  });

  return ctx.json({ ...imported, safetyFloorMerged: imported.safetyFloorMerged === 'true' }, 201);
}
