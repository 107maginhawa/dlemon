import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, AppError } from '@/core/errors';
import type { User } from '@/types/auth';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';
import { OrganizationRepository } from '@/handlers/dental-org/repos/organization.repo';
import type { DentalMembershipManagement_createBody, DentalMembershipManagement_createParams } from '@/generated/openapi/validators';

/**
 * FR6.3: Tier-based member limits
 * Solo: 2 users, Clinic/Practice: 5 users
 * Deactivated members do NOT count toward the limit.
 */
const TIER_MEMBER_LIMITS: Record<string, number> = {
  solo: 2,
  clinic: 5,
  group: 20,
  enterprise: Infinity,
};

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

  const { orgId, branchId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // FR6.3: Enforce tier-based member limit
  const orgRepo = new OrganizationRepository(db, logger);
  const org = await orgRepo.findOneById(orgId);
  if (!org) {
    throw new AppError('Organization not found', 'NOT_FOUND', 404);
  }

  const memberRepo = new MembershipRepository(db, logger);
  const activeCount = await memberRepo.countActiveByBranch(branchId);
  const limit = TIER_MEMBER_LIMITS[org.tier] ?? Infinity;

  if (activeCount >= limit) {
    throw new AppError(
      `Tier limit reached: ${org.tier} plan allows a maximum of ${limit} active staff members`,
      'TIER_LIMIT_REACHED',
      409,
    );
  }

  const membership = await memberRepo.createOne({
    branchId,
    displayName: body.displayName,
    role: body.role as any,
    personId: body.personId ?? null,
    avatarUrl: body.avatarUrl ?? null,
    status: 'active',
  });

  return ctx.json(membership, 201);
}
