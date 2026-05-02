import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { User } from '@/types/auth';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';
import type { DentalMembershipManagement_createBody, DentalMembershipManagement_createParams } from '@/generated/openapi/validators';

/**
 * DentalMembershipManagement_create
 *
 * Path: POST /dental/organizations/{orgId}/branches/{branchId}/members/
 * OperationId: DentalMembershipManagement_create
 */
export async function DentalMembershipManagement_create(
  ctx: ValidatedContext<DentalMembershipManagement_createBody, never, DentalMembershipManagement_createParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { branchId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new MembershipRepository(db, logger);
  const membership = await repo.createOne({
    branchId,
    displayName: body.displayName,
    role: body.role as any,
    personId: body.personId ?? null,
    avatarUrl: body.avatarUrl ?? null,
    status: 'active',
  });

  return ctx.json(membership, 201);
}