import type { ValidatedContext } from '@/types/app';
import type { User } from '@/types/auth';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';
import type { DentalMembershipManagement_setPinBody, DentalMembershipManagement_setPinParams } from '@/generated/openapi/validators';

/**
 * DentalMembershipManagement_setPin
 *
 * Path: POST /dental/organizations/{orgId}/branches/{branchId}/members/{membershipId}/set-pin
 * OperationId: DentalMembershipManagement_setPin
 */
export async function DentalMembershipManagement_setPin(
  ctx: ValidatedContext<DentalMembershipManagement_setPinBody, never, DentalMembershipManagement_setPinParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { membershipId } = ctx.req.valid('param');
  const { pin } = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new MembershipRepository(db, logger);
  const member = await repo.findOneById(membershipId);
  if (!member) throw new NotFoundError('Membership');

  const pinHash = await Bun.password.hash(pin);
  const updated = await repo.updatePin(membershipId, pinHash);

  // Strip pinHash from response (never expose the hash)
  const { pinHash: _pinHash, ...safeResponse } = updated!;

  return ctx.json(safeResponse);
}
