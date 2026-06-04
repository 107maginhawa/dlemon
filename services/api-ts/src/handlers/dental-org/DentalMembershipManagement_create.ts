/**
 * @deprecated Use POST /dental/org/members (createMember) instead.
 *
 * This endpoint (POST /dental/organizations/{orgId}/branches/{branchId}/members/) is a
 * duplicate registration. The canonical endpoint is createMember which now includes
 * FR6.3 tier-limit enforcement. This shim is retained only because registry.ts imports
 * it by name — remove after regenerating routes from a spec that drops this operationId.
 *
 * Deprecation: true  (per RFC 8594)
 * Sunset: 2026-09-01
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, AppError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { User } from '@/types/auth';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';
import { OrganizationRepository } from '@/handlers/dental-org/repos/organization.repo';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { logAuditEvent } from '@/core/audit-logger';
import type { DentalMembershipManagement_createBody, DentalMembershipManagement_createParams } from '@/generated/openapi/validators';

const TIER_MEMBER_LIMITS: Record<string, number> = {
  solo: 2,
  clinic: 5,
  group: 20,
  enterprise: Infinity,
};

export async function DentalMembershipManagement_create(
  ctx: ValidatedContext<DentalMembershipManagement_createBody, never, DentalMembershipManagement_createParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { orgId, branchId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const orgRepo = new OrganizationRepository(db, logger);
  const org = await orgRepo.findOneById(orgId);
  if (!org) {
    throw new AppError('Organization not found', 'NOT_FOUND', 404);
  }

  const memberRepo = new MembershipRepository(db, logger);

  // EM-ORG-001: Only dentist_owner may create staff members on the branch.
  // Bootstrap exception: the org owner may create the FIRST membership when they
  // hold none yet — otherwise the very first member can never be added (the
  // branch-role check requires a membership the owner doesn't have). Once the
  // owner holds any membership, their membership role governs as normal.
  const callerIsOwner = user.id === org.ownerPersonId;
  const callerMembership = await memberRepo.findActiveByPersonAndBranch(user.id, branchId);
  const isOwnerBootstrap = callerIsOwner && !callerMembership;
  if (!isOwnerBootstrap) {
    await assertBranchRole(db, user.id, branchId, ['dentist_owner']);
  }

  const activeCount = await memberRepo.countActiveStaffByBranch(branchId);
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
    role: body.role as typeof dentalMemberships.role._.data,
    // Owner bootstrap: the owner's first membership IS the owner — link it to
    // their account so they gain branch access (set-pin and all subsequent
    // owner operations assert an active membership for user.id).
    personId: body.personId ?? (isOwnerBootstrap ? user.id : null),
    avatarUrl: body.avatarUrl ?? null,
    status: 'active',
  });

  // AL-003: HIPAA §164.312 — audit membership creation
  try {
    await logAuditEvent(db, logger, {
      personId: user.id,
      tenantId: org.id,
      branchId,
      eventType: 'data-modification',
      action: 'membership.create',
      resourceType: 'dental_membership',
      resourceId: membership.id,
      // V-AUD-001: NEVER put person PII into append-only audit metadata (HIPAA).
      metadata: { role: body.role },
    });
  } catch (auditErr) {
    logger?.warn?.({ auditErr }, 'AL-003: failed to write createMembership audit log');
  }

  // Add deprecation headers per RFC 8594
  const response = ctx.json(membership, 201) as Response;
  const headers = new Headers(response.headers);
  headers.set('Deprecation', 'true');
  headers.set('Sunset', 'Tue, 01 Sep 2026 00:00:00 GMT');
  headers.set('Link', '</dental/org/members>; rel="successor-version"');
  return new Response(response.body, { status: response.status, headers });
}
