import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { User } from '@/types/auth';
import { BranchRepository } from '@/handlers/dental-org/repos/branch.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { DentalBranchManagement_getParams } from '@/generated/openapi/validators';

/**
 * DentalBranchManagement_get
 *
 * Path: GET /dental/organizations/{orgId}/branches/{branchId}
 * OperationId: DentalBranchManagement_get
 */
export async function DentalBranchManagement_get(
  ctx: ValidatedContext<never, never, DentalBranchManagement_getParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { branchId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new BranchRepository(db, logger);
  const branch = await repo.findOneById(branchId);
  if (!branch) throw new NotFoundError('Branch');

  await assertBranchAccess(db, user.id, branchId);

  return ctx.json(branch);
}