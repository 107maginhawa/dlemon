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

  // DB schema element types for JSONB columns.
  type DbCodeableConcept = NonNullable<PractitionerRole['code']>[number];
  type DbNotAvailable    = NonNullable<PractitionerRole['notAvailable']>[number];

  const updateData: Partial<PractitionerRole> = {};
  if (body.active !== undefined) updateData.active = body.active ?? undefined;
  if (body.code !== undefined) updateData.code = (body.code ?? undefined) as DbCodeableConcept[] | undefined;
  if (body.specialty !== undefined) updateData.specialty = (body.specialty ?? undefined) as DbCodeableConcept[] | undefined;
  if (body.location !== undefined) updateData.location = body.location ?? undefined;
  if (body.healthcareService !== undefined) updateData.healthcareService = body.healthcareService ?? undefined;
  if (body.telecom !== undefined) updateData.telecom = body.telecom ?? undefined;
  if (body.availableTime !== undefined) updateData.availableTime = body.availableTime ?? undefined;
  if (body.notAvailable !== undefined) {
    // Zod transforms period dates to Date objects; DB schema stores them as ISO strings.
    updateData.notAvailable = (body.notAvailable == null ? undefined : body.notAvailable.map(
      (na): DbNotAvailable => ({
        description: na.description,
        ...(na.during && {
          during: {
            start: na.during.start instanceof Date ? na.during.start.toISOString() : na.during.start,
            end: na.during.end instanceof Date ? na.during.end.toISOString() : na.during.end,
          },
        }),
      })
    ));
  }
  if (body.period?.start !== undefined) updateData.periodStart = body.period.start;
  if (body.period?.end !== undefined) updateData.periodEnd = body.period.end;

  const updated = await repo.updateOneById(params.id, updateData);

  logger?.info(
    { roleId: params.id, updatedFields: Object.keys(updateData), action: 'update' },
    'PractitionerRole updated'
  );

  return ctx.json(updated, 200);
}