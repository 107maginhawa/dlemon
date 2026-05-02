/**
 * createOrganization handler
 *
 * POST /dental/organizations
 * Creates a new dental practice organization owned by the authenticated user.
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { ValidationError, UnauthorizedError } from '@/core/errors';
import { OrganizationRepository } from './repos/organization.repo';
import { VALID_ORG_TIERS } from './repos/organization.schema';
import type { User } from '@/types/auth';

export async function createOrganization(ctx: HandlerContext) {
  // Require authentication
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) {
    throw new UnauthorizedError('Authentication required');
  }

  const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;

  // Validate required fields
  const name = body['name'];
  const tier = body['tier'];
  const countryCode = body['countryCode'];

  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new ValidationError('name is required');
  }
  if (!tier || !(VALID_ORG_TIERS as readonly string[]).includes(tier as string)) {
    throw new ValidationError(`tier must be one of: ${VALID_ORG_TIERS.join(', ')}`);
  }
  if (!countryCode || typeof countryCode !== 'string') {
    throw new ValidationError('countryCode is required');
  }

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new OrganizationRepository(db, logger);

  const org = await repo.createOne({
    name: name.trim(),
    tier: tier as any,
    ownerPersonId: user.id,
    countryCode: countryCode.toUpperCase().slice(0, 2),
    active: true,
  });

  return ctx.json(org, 201);
}
