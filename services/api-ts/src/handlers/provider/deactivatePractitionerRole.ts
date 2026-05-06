import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  NotFoundError,
} from '@/core/errors';
import type { DeactivatePractitionerRoleParams } from '@/generated/openapi/validators';
import { PractitionerRoleRepository } from './repos/practitioner-role.repo';

/**
 * deactivatePractitionerRole
 *
 * Path: DELETE /providers/practitioner-roles/{id}
 * OperationId: deactivatePractitionerRole
 * Soft delete only — sets active=false, deactivatedAt=now()
 */
export async function deactivatePractitionerRole(
  ctx: ValidatedContext<never, never, DeactivatePractitionerRoleParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new PractitionerRoleRepository(db, logger);
  const existing = await repo.findOneById(params.id);
  if (!existing) {
    throw new NotFoundError('PractitionerRole not found', {
      resourceType: 'practitioner-role',
      resource: params.id,
      suggestions: ['Check role ID format', 'Verify practitioner role exists'],
    });
  }

  await repo.deactivateById(params.id);

  logger?.info({ roleId: params.id, action: 'deactivate' }, 'PractitionerRole deactivated');

  return new Response(null, { status: 204 });
}