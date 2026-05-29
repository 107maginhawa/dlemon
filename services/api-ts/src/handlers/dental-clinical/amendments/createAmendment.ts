/**
 * createAmendment handler
 *
 * POST /dental/visits/{visitId}/amendments
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import { AmendmentRepository } from '../repos/amendment.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getActiveMembershipForClinical } from '@/handlers/dental-org/repos/org-clinical.facade';
import type { User } from '@/types/auth';
import type { CreateAmendmentBody, CreateAmendmentParams } from '@/generated/openapi/validators';

export async function createAmendment(
  ctx: ValidatedContext<CreateAmendmentBody, never, CreateAmendmentParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization via parent visit.
  // EM-CLI-011: use assertBranchRole (role-aware) instead of getActiveMembershipId
  // (which only checks membership existence, not role). Amendments are restricted to
  // dentist_owner and dentist_associate per MODULE_SPEC §6.
  const visit = await getVisitOrThrow(db, visitId);
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);

  // Resolve caller's membership id for the audit trail (authorMemberId).
  // assertBranchRole above already guarantees this row exists; the cast is safe.
  const callerMembership = await getActiveMembershipForClinical(db, user.id, visit.branchId);

  const authorMemberId = callerMembership!.id;

  const repo = new AmendmentRepository(db);

  const amendment = await repo.createOne({
    visitId,
    patientId: body.patientId,
    authorMemberId,
    originalRecordType: body.originalRecordType,
    originalRecordId: body.originalRecordId,
    reason: body.reason,
    content: body.content,
  });

  return ctx.json(amendment, 201);
}
