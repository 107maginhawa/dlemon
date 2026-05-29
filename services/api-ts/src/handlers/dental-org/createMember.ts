/**
 * createMember — canonical endpoint for creating a branch member
 *
 * Path: POST /dental/org/members?branchId=...
 * Body: { displayName, role, avatarUrl?, personId?, pin? }
 *
 * Enforces FR6.3 tier-based member limits (migrated from DentalMembershipManagement_create).
 */

import { z } from 'zod';
import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, AppError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { User } from '@/types/auth';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';
import { VALID_MEMBER_ROLES } from '@/handlers/dental-org/repos/membership.schema';
import { BranchRepository } from '@/handlers/dental-org/repos/branch.repo';
import { OrganizationRepository } from '@/handlers/dental-org/repos/organization.repo';
import { logAuditEvent } from '@/handlers/audit/repos/audit.facade';

/** FR6.3: Deactivated members do NOT count toward the limit. */
const TIER_MEMBER_LIMITS: Record<string, number> = {
  solo: 2,
  clinic: 5,
  group: 20,
  enterprise: Infinity,
};

const createMemberSchema = z.object({
  displayName: z.string().min(1, 'displayName is required'),
  role: z.enum(VALID_MEMBER_ROLES, { error: () => ({ message: `role is required and must be one of: ${VALID_MEMBER_ROLES.join(', ')}` }) }),
  branchId: z.string().uuid().optional(),
  personId: z.string().uuid().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  pin: z.string().regex(/^\d{6}$/, 'PIN must be exactly 6 digits').optional(),
});

export async function createMember(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const branchIdQuery = ctx.req.query('branchId');
  const rawBody = await ctx.req.json();
  const body = createMemberSchema.parse(rawBody);

  const resolvedBranchId = branchIdQuery || body.branchId;
  if (!resolvedBranchId) {
    return ctx.json({ error: 'branchId is required (query param or body)' }, 400);
  }

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // EF-ORG-003: Only dentist_owner may invite new staff members
  await assertBranchRole(db, user.id, resolvedBranchId, ['dentist_owner']);

  const branchRepo = new BranchRepository(db, logger);
  const branch = await branchRepo.findOneById(resolvedBranchId);
  if (!branch) throw new AppError('Branch not found', 'NOT_FOUND', 404);

  const orgRepo = new OrganizationRepository(db, logger);
  const org = await orgRepo.findOneById(branch.organizationId);
  if (!org) throw new AppError('Organization not found', 'NOT_FOUND', 404);

  const memberRepo = new MembershipRepository(db, logger);
  const activeCount = await memberRepo.countActiveStaffByBranch(resolvedBranchId);
  const limit = TIER_MEMBER_LIMITS[org.tier] ?? Infinity;

  if (activeCount >= limit) {
    throw new AppError(
      `Tier limit reached: ${org.tier} plan allows a maximum of ${limit} active staff members`,
      'TIER_LIMIT_REACHED',
      409,
    );
  }

  let pinHash: string | null = null;
  if (body.pin) {
    pinHash = await Bun.password.hash(body.pin);
  }

  const membership = await memberRepo.createOne({
    branchId: resolvedBranchId,
    displayName: body.displayName.trim(),
    role: body.role,
    personId: body.personId ?? null,
    avatarUrl: body.avatarUrl ?? null,
    status: 'active',
    ...(pinHash ? { pinHash } : {}),
  });

  const { pinHash: _ph, ...safeResponse } = membership;

  // AL-003: HIPAA §164.312 — audit membership creation
  try {
    await logAuditEvent(db, logger, {
      eventType: 'data-modification',
      category: 'administrative',
      action: 'create',
      outcome: 'success',
      user: user.id,
      userType: 'host',
      resourceType: 'dental_membership',
      resource: membership.id,
      description: `Membership created for branch ${resolvedBranchId}`,
      details: { branchId: resolvedBranchId, role: body.role, displayName: body.displayName.trim() },
    }, user.id);
  } catch (auditErr) {
    logger?.warn?.({ auditErr }, 'AL-003: failed to write createMembership audit log');
  }

  return ctx.json(safeResponse, 201);
}
