import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { User } from '@/types/auth';
import { BranchRepository } from '@/handlers/dental-org/repos/branch.repo';
import type { DentalBranchManagement_createBody, DentalBranchManagement_createParams } from '@/generated/openapi/validators';

/**
 * DentalBranchManagement_create
 *
 * Path: POST /dental/organizations/{orgId}/branches/
 * OperationId: DentalBranchManagement_create
 */
export async function DentalBranchManagement_create(
  ctx: ValidatedContext<DentalBranchManagement_createBody, never, DentalBranchManagement_createParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { orgId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new BranchRepository(db, logger);
  const branch = await repo.createOne({
    organizationId: orgId,
    name: body.name,
    timezone: body.timezone,
    address: body.address ?? null,
    city: body.city ?? null,
    phone: body.phone ?? null,
    workingHours: body.workingHours ? JSON.stringify(body.workingHours) : null,
    active: true,
  });

  return ctx.json(branch, 201);
}