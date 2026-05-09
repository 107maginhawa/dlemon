import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { User } from '@/types/auth';
import { BranchRepository } from '@/handlers/dental-org/repos/branch.repo';
import type { DentalBranchManagement_listParams } from '@/generated/openapi/validators';

/**
 * DentalBranchManagement_list
 *
 * Path: GET /dental/organizations/{orgId}/branches/
 * OperationId: DentalBranchManagement_list
 */
export async function DentalBranchManagement_list(
  ctx: ValidatedContext<never, never, DentalBranchManagement_listParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { orgId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new BranchRepository(db, logger);
  const items = await repo.listByOrg(orgId);

  return ctx.json({ items, total: items.length });
}