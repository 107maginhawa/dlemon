import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  NotFoundError,
} from '@/core/errors';
import type { GetPractitionerRoleParams } from '@/generated/openapi/validators';
import { PractitionerRoleRepository } from './repos/practitioner-role.repo';

/**
 * getPractitionerRole
 *
 * Path: GET /providers/practitioner-roles/{id}
 * OperationId: getPractitionerRole
 */
export async function getPractitionerRole(
  ctx: ValidatedContext<never, never, GetPractitionerRoleParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new PractitionerRoleRepository(db, logger);
  const role = await repo.findOneById(params.id);

  if (!role) {
    throw new NotFoundError('PractitionerRole not found', {
      resourceType: 'practitioner-role',
      resource: params.id,
      suggestions: ['Check role ID format', 'Verify practitioner role exists'],
    });
  }

  logger?.info({ roleId: params.id, action: 'view' }, 'PractitionerRole retrieved');

  return ctx.json(role, 200);
}