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

  // DB schema element types for JSONB columns (Drizzle $type annotations).
  // Zod-validated shapes are structurally compatible at runtime (stored as JSONB);
  // the explicit casts bridge optionality/enum mismatches between the Zod and DB types.
  type DbName         = NonNullable<Practitioner['name']>[number];
  type DbQualification = NonNullable<Practitioner['qualification']>[number];
  type DbCredential   = NonNullable<Practitioner['credential']>[number];
  type DbSpecialty    = NonNullable<Practitioner['specialties']>[number];

  const updateData: Partial<Practitioner> = {};
  if (body.name !== undefined) updateData.name = (body.name ?? undefined) as DbName[] | undefined;
  if (body.active !== undefined) updateData.active = body.active ?? undefined;
  if (body.telecom !== undefined) updateData.telecom = body.telecom ?? undefined;
  if (body.address !== undefined) updateData.address = body.address ?? undefined;
  if (body.gender !== undefined) updateData.gender = body.gender ?? undefined;
  if (body.birthDate !== undefined) updateData.birthDate = body.birthDate ?? undefined;
  if (body.photo !== undefined) updateData.photo = body.photo ?? undefined;
  if (body.qualification !== undefined) updateData.qualification = (body.qualification ?? undefined) as DbQualification[] | undefined;
  if (body.credential !== undefined) updateData.credential = (body.credential ?? undefined) as DbCredential[] | undefined;
  if (body.specialties !== undefined) updateData.specialties = (body.specialties ?? undefined) as DbSpecialty[] | undefined;
  if (body.languages !== undefined) updateData.languages = (body.languages ?? undefined) as DbSpecialty[] | undefined;

  const updated = await repo.updateOneById(params.id, updateData);

  logger?.info(
    { practitionerId: params.id, updatedFields: Object.keys(updateData), action: 'update' },
    'Practitioner updated'
  );

  return ctx.json(updated, 200);
}