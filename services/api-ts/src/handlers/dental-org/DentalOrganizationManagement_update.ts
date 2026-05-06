import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { User } from '@/types/auth';
import { OrganizationRepository } from '@/handlers/dental-org/repos/organization.repo';
import type { NewDentalOrganization } from '@/handlers/dental-org/repos/organization.schema';
import type { DentalOrganizationManagement_updateBody, DentalOrganizationManagement_updateParams } from '@/generated/openapi/validators';

/**
 * DentalOrganizationManagement_update
 *
 * Path: PATCH /dental/organizations/{id}
 * OperationId: DentalOrganizationManagement_update
 */
export async function DentalOrganizationManagement_update(
  ctx: ValidatedContext<DentalOrganizationManagement_updateBody, never, DentalOrganizationManagement_updateParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { id } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new OrganizationRepository(db, logger);
  const org = await repo.updateOne(id, body as Partial<NewDentalOrganization>);
  if (!org) throw new NotFoundError('Organization');

  return ctx.json(org);
}