/**
 * createMember — canonical endpoint for creating a branch member
 *
 * Path: POST /dental/org/members?branchId=...
 * Body: { displayName, role, avatarUrl?, personId? }
 *
 * Enforces FR6.3 tier-based member limits (migrated from DentalMembershipManagement_create).
 *
 * NOTE: there is intentionally NO create-time `pin`. The generated CreateMemberBody
 * contract carries no pin field, and PINs are set only through the owner-gated
 * resetMemberPin flow (two-call create → reset-pin, decision #9) so every PIN write
 * goes through the audited reset path. Do not re-add pin handling here.
 */

import { z } from 'zod';
import { sql } from 'drizzle-orm';
import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, AppError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { User } from '@/types/auth';
import { MembershipRepository } from '@/handlers/dental-org/repos/membership.repo';
import { VALID_MEMBER_ROLES } from '@/handlers/dental-org/repos/membership.schema';
import { BranchRepository } from '@/handlers/dental-org/repos/branch.repo';
import { OrganizationRepository } from '@/handlers/dental-org/repos/organization.repo';
import { logAuditEvent } from '@/core/audit-logger';

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

  const branchRepo = new BranchRepository(db, logger);
  const branch = await branchRepo.findOneById(resolvedBranchId);
  if (!branch) throw new AppError('Branch not found', 'NOT_FOUND', 404);

  const orgRepo = new OrganizationRepository(db, logger);
  const org = await orgRepo.findOneById(branch.organizationId);
  if (!org) throw new AppError('Organization not found', 'NOT_FOUND', 404);

  const memberRepo = new MembershipRepository(db, logger);

  // EF-ORG-003: Only dentist_owner may invite new staff members.
  // Bootstrap exception: the org owner may create the FIRST membership when they
  // hold none yet — otherwise the very first member can never be added (the
  // branch-role check requires a membership the owner doesn't have). Once the
  // owner holds any membership, their membership role governs as normal.
  const callerIsOwner = user.id === org.ownerPersonId;
  const callerMembership = await memberRepo.findActiveByPersonAndBranch(user.id, resolvedBranchId);
  const isOwnerBootstrap = callerIsOwner && !callerMembership;
  if (!isOwnerBootstrap) {
    await assertBranchRole(db, user.id, resolvedBranchId, ['dentist_owner']);
  }

  const limit = TIER_MEMBER_LIMITS[org.tier] ?? Infinity;

  // FR6.3 tier-limit race: countActiveStaffByBranch → createOne is a check-then-act with
  // no row to lock (a count), and PIN-only staff have personId=null so no unique index
  // bounds it. Two concurrent creates at limit-1 both pass the >= check and both insert,
  // overshooting the cap. Serialize creation per branch with an advisory xact lock and
  // re-count under it inside the tx so the losing writer sees the winner's committed member
  // and is rejected. (db.transaction, not withTenantTx — membership is not RLS-activated.)
  const membership = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(3001, hashtext(${resolvedBranchId}))`);
    const txMemberRepo = new MembershipRepository(tx, logger);
    const activeCount = await txMemberRepo.countActiveStaffByBranch(resolvedBranchId);
    if (activeCount >= limit) {
      throw new AppError(
        `Tier limit reached: ${org.tier} plan allows a maximum of ${limit} active staff members`,
        'TIER_LIMIT_REACHED',
        409,
      );
    }
    return txMemberRepo.createOne({
      branchId: resolvedBranchId,
      displayName: body.displayName.trim(),
      role: body.role,
      // Owner bootstrap: the owner's first membership IS the owner — link it to
      // their account so they gain branch access (set-pin and all subsequent
      // owner operations assert an active membership for user.id).
      personId: body.personId ?? (isOwnerBootstrap ? user.id : null),
      avatarUrl: body.avatarUrl ?? null,
      status: 'active',
    });
  });

  // Defensive: never surface a pin hash on the create response (the column is
  // populated only by the owner-gated resetMemberPin flow).
  const { pinHash: _ph, ...safeResponse } = membership;

  // AL-003: HIPAA §164.312 — audit membership creation
  try {
    await logAuditEvent(db, logger, {
      personId: user.id,
      tenantId: org.id,
      branchId: resolvedBranchId,
      eventType: 'data-modification',
      actorRole: 'dentist_owner',
      action: 'membership.create',
      resourceType: 'dental_membership',
      resourceId: membership.id,
      // V-AUD-001: NEVER put person PII (displayName/name/email/etc.) into audit
      // metadata — the dental_audit_log is append-only and never deleted, so PHI
      // written here is unremediable (AC-AUD-004 / HIPAA). The membership id +
      // role are sufficient; displayName is resolvable via the membership row.
      metadata: { role: body.role },
    });
  } catch (auditErr) {
    logger?.warn?.({ auditErr }, 'AL-003: failed to write createMembership audit log');
  }

  return ctx.json(safeResponse, 201);
}
