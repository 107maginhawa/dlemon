import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  NotFoundError,
} from '@/core/errors';
import type { DeactivatePractitionerParams } from '@/generated/openapi/validators';
import { PractitionerRepository } from './repos/practitioner.repo';

/**
 * deactivatePractitioner
 *
 * Path: DELETE /providers/practitioners/{id}
 * OperationId: deactivatePractitioner
 * Soft delete only — sets active=false, deactivatedAt=now()
 */
export async function deactivatePractitioner(
  ctx: ValidatedContext<never, never, DeactivatePractitionerParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new PractitionerRepository(db, logger);
  const existing = await repo.findOneById(params.id);
  if (!existing) {
    throw new NotFoundError('Practitioner not found', {
      resourceType: 'practitioner',
      resource: params.id,
      suggestions: ['Check practitioner ID format', 'Verify practitioner exists'],
    });
  }

  await repo.deactivateById(params.id);

  logger?.info({ practitionerId: params.id, action: 'deactivate' }, 'Practitioner deactivated');

  return new Response(null, { status: 204 });
}