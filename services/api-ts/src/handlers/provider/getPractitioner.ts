import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  NotFoundError,
} from '@/core/errors';
import type { GetPractitionerParams } from '@/generated/openapi/validators';
import { PractitionerRepository } from './repos/practitioner.repo';

/**
 * getPractitioner
 *
 * Path: GET /providers/practitioners/{id}
 * OperationId: getPractitioner
 */
export async function getPractitioner(
  ctx: ValidatedContext<never, never, GetPractitionerParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new PractitionerRepository(db, logger);
  const practitioner = await repo.findOneById(params.id);

  if (!practitioner) {
    throw new NotFoundError('Practitioner not found', {
      resourceType: 'practitioner',
      resource: params.id,
      suggestions: ['Check practitioner ID format', 'Verify practitioner exists'],
    });
  }

  logger?.info({ practitionerId: params.id, action: 'view' }, 'Practitioner retrieved');

  return ctx.json(practitioner, 200);
}