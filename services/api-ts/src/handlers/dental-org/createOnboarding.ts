/**
 * createOnboarding — self-service clinic onboarding.
 *
 * Path: POST /dental/onboarding
 * OperationId: createOnboarding
 *
 * Pure self-service provisioning (NO admin branch). Transactionally creates, for
 * the authenticated caller:
 *   1. a dental_organization (ownerPersonId = caller, status = 'provisional')
 *   2. a default dental_branch
 *   3. the caller's dentist_owner dental_membership in that branch
 * and returns { organizationId, branchId, membershipId }.
 *
 * This is the compensated capability that lets real clinic owners onboard. The
 * audited admin endpoint POST /dental/organizations (EM-ORG-002) stays UNTOUCHED
 * and admin-only — see DECISIONS.md / docs/audits/enforce/module/dental-org.md.
 *
 * Guardrails (all on this endpoint, no role bypass):
 *   - per-IP rate limit (single-instance STOPGAP — the one-active-org index is the
 *     real control; a multi-instance deploy must swap this for a shared store)
 *   - verified email REQUIRED in production (its OWN check — deliberately decoupled
 *     from the sign-in requireEmailVerification flag so that operational lever can
 *     never silently drop this PHI-provisioning control)
 *   - one ACTIVE self-service org per owner (app pre-check + DB partial-unique index)
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { eq, and } from 'drizzle-orm';
import { UnauthorizedError, ForbiddenError, ConflictError, RateLimitError } from '@/core/errors';
import type { User } from '@/types/auth';
import { dentalOrganizations, type OrgTier } from './repos/organization.schema';
import { dentalBranches } from './repos/branch.schema';
import { dentalMemberships } from './repos/membership.schema';
import { logAuditEvent } from '@/core/audit-logger';
import { seedDefaultRetentionPolicies } from '@/handlers/retention/retention-defaults';
import { FixedWindowRateLimiter, clientIp } from '@/handlers/dental-scheduling/public-booking-ratelimit';
import type { CreateOnboardingBody } from '@/generated/openapi/validators';

/**
 * Per-IP fixed-window limiter for self-service onboarding. SINGLE-INSTANCE STOPGAP
 * (security review P1): the `dental_org_one_active_per_owner` partial unique index
 * is the load-bearing abuse control; a multi-instance/serverless deploy must swap
 * this for a shared store (Valkey) keyed per-identity. Exported so tests can reset it.
 */
export const onboardingLimiter = new FixedWindowRateLimiter(5, 60 * 60 * 1000); // 5/hour per ip

const DEFAULT_TIMEZONE = 'Asia/Manila';

/** group/enterprise practices legitimately own multiple orgs → provisioned via admin/sales. */
const SELF_SERVICE_TIERS: ReadonlyArray<OrgTier> = ['solo', 'clinic'];

const ONE_ACTIVE_ORG_INDEX = 'dental_org_one_active_per_owner';

function isOneActiveOrgViolation(err: unknown): boolean {
  const e = err as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const code = e?.cause?.code ?? e?.code;
  if (code !== '23505') return false;
  const constraint = e?.cause?.constraint ?? e?.constraint ?? '';
  // Fall back to the index name appearing anywhere in the message (driver variance).
  return constraint === ONE_ACTIVE_ORG_INDEX || String((err as Error)?.message ?? '').includes(ONE_ACTIVE_ORG_INDEX);
}

export async function createOnboarding(
  ctx: ValidatedContext<CreateOnboardingBody, never, never>,
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  // Guardrail 1 — per-IP rate limit BEFORE any DB work. Stopgap (see note above).
  const ip = clientIp(ctx.req.raw.headers);
  const rl = onboardingLimiter.check(`onboard:${ip}`);
  if (!rl.allowed) {
    throw new RateLimitError('Too many onboarding attempts. Please try again later.', {
      retryAfter: Math.max(0, Math.ceil((rl.resetAt - Date.now()) / 1000)),
    });
  }

  // Guardrail 2 — verified email REQUIRED in production (its OWN check, not the
  // sign-in requireEmailVerification flag). Relaxed in dev/test so local/CI onboards.
  if (process.env['NODE_ENV'] === 'production' && !user.emailVerified) {
    throw new ForbiddenError('A verified email is required to create a clinic', 'EMAIL_NOT_VERIFIED');
  }

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const tier = body.tier as OrgTier;
  if (!SELF_SERVICE_TIERS.includes(tier)) {
    throw new ForbiddenError(
      'Group and enterprise plans are provisioned by our team',
      'TIER_NOT_SELF_SERVICE',
    );
  }

  // Guardrail 3 — one ACTIVE self-service org per owner. App pre-check is the friendly
  // path; the DB partial-unique index is the race-safe backstop (caught below as 409).
  const existing = await db
    .select({ id: dentalOrganizations.id })
    .from(dentalOrganizations)
    .where(and(eq(dentalOrganizations.ownerPersonId, user.id), eq(dentalOrganizations.active, true)));
  if (existing.length > 0) {
    throw new ConflictError('You already have an active clinic', 'ORG_LIMIT_REACHED');
  }

  const orgName = body.organizationName.trim();
  const branchName = body.branchName?.trim() || orgName;
  const timezone = body.timezone?.trim() || DEFAULT_TIMEZONE;
  const countryCode = body.countryCode.toUpperCase().slice(0, 2);
  const ownerDisplayName = body.ownerDisplayName?.trim() || user.name?.trim() || user.email || 'Owner';

  let provisioned: {
    orgId: string;
    branchId: string;
    membershipId: string;
    orgTier: string;
  };
  try {
    provisioned = await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(dentalOrganizations)
        .values({
          name: orgName,
          tier,
          ownerPersonId: user.id,
          countryCode,
          active: true,
          status: 'provisional', // PHI go-live gating hook — enforcement is a fast-follow
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();
      if (!org) throw new Error('org insert returned no row');

      const [branch] = await tx
        .insert(dentalBranches)
        .values({
          organizationId: org.id,
          name: branchName,
          timezone,
          address: body.address?.trim() || null,
          city: body.city?.trim() || null,
          phone: body.phone?.trim() || null,
          active: true,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();
      if (!branch) throw new Error('branch insert returned no row');

      // Owner-bootstrap membership: the caller's first membership IS the owner,
      // linked to their account so they gain branch access (mirrors createMember).
      const [membership] = await tx
        .insert(dentalMemberships)
        .values({
          branchId: branch.id,
          personId: user.id,
          displayName: ownerDisplayName,
          role: 'dentist_owner',
          status: 'active',
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();
      if (!membership) throw new Error('membership insert returned no row');

      return { orgId: org.id, branchId: branch.id, membershipId: membership.id, orgTier: org.tier };
    });
  } catch (err) {
    // Concurrent create lost the race on the one-active-org index → same friendly 409.
    if (isOneActiveOrgViolation(err)) {
      throw new ConflictError('You already have an active clinic', 'ORG_LIMIT_REACHED');
    }
    throw err;
  }

  // Audit (security review P2 fix): the REAL actor role, never a hardcoded 'admin'.
  try {
    await logAuditEvent(db, logger, {
      personId: user.id,
      tenantId: provisioned.orgId,
      branchId: provisioned.branchId,
      eventType: 'data-modification',
      actorRole: 'dentist_owner',
      action: 'org.onboard',
      resourceType: 'dental_organization',
      resourceId: provisioned.orgId,
      // V-AUD-001: no PII — tier + provisioning mode only.
      metadata: { tier: provisioned.orgTier, mode: 'self-service' },
    });
  } catch (auditErr) {
    logger?.warn?.({ auditErr }, 'failed to write onboarding audit log');
  }

  // Seed default data-retention policy registry for the new org (best-effort —
  // never fail onboarding on a governance-seed hiccup). Mirrors the admin path.
  try {
    await seedDefaultRetentionPolicies(db, provisioned.orgId, { createdBy: user.id });
  } catch (seedErr) {
    logger?.warn?.({ seedErr }, 'failed to seed default retention policies for onboarded org');
  }

  return ctx.json(
    {
      organizationId: provisioned.orgId,
      branchId: provisioned.branchId,
      membershipId: provisioned.membershipId,
    },
    201,
  );
}
