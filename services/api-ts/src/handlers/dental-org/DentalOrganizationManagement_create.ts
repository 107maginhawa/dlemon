import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { User } from '@/types/auth';
import { OrganizationRepository } from '@/handlers/dental-org/repos/organization.repo';
import type { DentalOrganizationManagement_createBody } from '@/generated/openapi/validators';

/**
 * DentalOrganizationManagement_create
 *
 * Path: POST /dental/organizations/
 * OperationId: DentalOrganizationManagement_create
 */
export async function DentalOrganizationManagement_create(
  ctx: ValidatedContext<DentalOrganizationManagement_createBody, never, never>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new OrganizationRepository(db, logger);
  const org = await repo.createOne({
    name: body.name,
    tier: body.tier as any,
    countryCode: body.countryCode,
    ownerPersonId: user.id,
    active: true,
  });

  return ctx.json(org, 201);
}
