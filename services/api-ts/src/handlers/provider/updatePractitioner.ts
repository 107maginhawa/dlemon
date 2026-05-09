import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  NotFoundError,
} from '@/core/errors';
import type { UpdatePractitionerBody, UpdatePractitionerParams } from '@/generated/openapi/validators';
import { PractitionerRepository } from './repos/practitioner.repo';
import type { Practitioner } from './repos/practitioner.schema';

/**
 * updatePractitioner
 *
 * Path: PATCH /providers/practitioners/{id}
 * OperationId: updatePractitioner
 */
export async function updatePractitioner(
  ctx: ValidatedContext<UpdatePractitionerBody, never, UpdatePractitionerParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
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

  const updateData: Partial<Practitioner> = {};
  if ((body as any).name !== undefined) updateData.name = (body as any).name;
  if ((body as any).active !== undefined) updateData.active = (body as any).active;
  if ((body as any).telecom !== undefined) updateData.telecom = (body as any).telecom;
  if ((body as any).address !== undefined) updateData.address = (body as any).address;
  if ((body as any).gender !== undefined) updateData.gender = (body as any).gender;
  if ((body as any).birthDate !== undefined) updateData.birthDate = (body as any).birthDate;
  if ((body as any).photo !== undefined) updateData.photo = (body as any).photo;
  if ((body as any).qualification !== undefined) updateData.qualification = (body as any).qualification;
  if ((body as any).credential !== undefined) updateData.credential = (body as any).credential;
  if ((body as any).specialties !== undefined) updateData.specialties = (body as any).specialties;
  if ((body as any).languages !== undefined) updateData.languages = (body as any).languages;

  const updated = await repo.updateOneById(params.id, updateData);

  logger?.info(
    { practitionerId: params.id, updatedFields: Object.keys(updateData), action: 'update' },
    'Practitioner updated'
  );

  return ctx.json(updated, 200);
}