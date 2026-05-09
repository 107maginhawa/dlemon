import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  NotFoundError,
} from '@/core/errors';
import type { UpdatePractitionerRoleBody, UpdatePractitionerRoleParams } from '@/generated/openapi/validators';
import { PractitionerRoleRepository } from './repos/practitioner-role.repo';
import type { PractitionerRole } from './repos/practitioner.schema';

/**
 * updatePractitionerRole
 *
 * Path: PATCH /providers/practitioner-roles/{id}
 * OperationId: updatePractitionerRole
 */
export async function updatePractitionerRole(
  ctx: ValidatedContext<UpdatePractitionerRoleBody, never, UpdatePractitionerRoleParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
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

  const updateData: Partial<PractitionerRole> = {};
  if ((body as any).active !== undefined) updateData.active = (body as any).active;
  if ((body as any).code !== undefined) updateData.code = (body as any).code;
  if ((body as any).specialty !== undefined) updateData.specialty = (body as any).specialty;
  if ((body as any).location !== undefined) updateData.location = (body as any).location;
  if ((body as any).healthcareService !== undefined) updateData.healthcareService = (body as any).healthcareService;
  if ((body as any).telecom !== undefined) updateData.telecom = (body as any).telecom;
  if ((body as any).availableTime !== undefined) updateData.availableTime = (body as any).availableTime;
  if ((body as any).notAvailable !== undefined) updateData.notAvailable = (body as any).notAvailable;
  if ((body as any).period?.start !== undefined) updateData.periodStart = new Date((body as any).period.start);
  if ((body as any).period?.end !== undefined) updateData.periodEnd = new Date((body as any).period.end);

  const updated = await repo.updateOneById(params.id, updateData);

  logger?.info(
    { roleId: params.id, updatedFields: Object.keys(updateData), action: 'update' },
    'PractitionerRole updated'
  );

  return ctx.json(updated, 200);
}