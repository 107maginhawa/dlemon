import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { User } from '@/types/auth';
import { OrganizationRepository } from '@/handlers/dental-org/repos/organization.repo';
import type { DentalOrganizationManagement_getParams } from '@/generated/openapi/validators';

/**
 * DentalOrganizationManagement_get
 *
 * Path: GET /dental/organizations/{id}
 * OperationId: DentalOrganizationManagement_get
 */
export async function DentalOrganizationManagement_get(
  ctx: ValidatedContext<never, never, DentalOrganizationManagement_getParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { id } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new OrganizationRepository(db, logger);
  const org = await repo.findOneById(id);
  if (!org) throw new NotFoundError('Organization');

  return ctx.json(org);
}
