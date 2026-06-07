import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  NotFoundError,
} from '@/core/errors';
import type { CreatePractitionerBody } from '@/generated/openapi/validators';
import { PractitionerRepository } from './repos/practitioner.repo';
import { ProviderRepository } from './repos/provider.repo';
import type { NewPractitioner } from './repos/practitioner.schema';

/**
 * createPractitioner
 *
 * Path: POST /providers/practitioners
 * OperationId: createPractitioner
 */
export async function createPractitioner(
  ctx: ValidatedContext<CreatePractitionerBody, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // providerId links the FHIR Practitioner to its pre-FHIR Provider record
  // (FHIR: a Practitioner belongs to an organization/provider).
  const providerId = body.providerId;
  if (!providerId) {
    throw new NotFoundError('providerId is required in request body', {
      resourceType: 'provider',
      resource: 'providerId',
      suggestions: ['Include providerId in the request body'],
    });
  }

  // Validate provider exists
  const providerRepo = new ProviderRepository(db, logger);
  const provider = await providerRepo.findOneById(providerId);
  if (!provider) {
    throw new NotFoundError('Provider not found', {
      resourceType: 'provider',
      resource: providerId,
      suggestions: ['Check provider ID format', 'Verify provider exists'],
    });
  }

  const repo = new PractitionerRepository(db, logger);

  // DB element types for JSONB columns (Drizzle $type annotations).
  // Zod-validated shapes are structurally compatible at runtime (stored as JSONB);
  // explicit casts bridge optionality/shape mismatches between Zod and DB types.
  type DbQualification = NonNullable<NewPractitioner['qualification']>[number];
  type DbCredential    = NonNullable<NewPractitioner['credential']>[number];
  type DbSpecialty     = NonNullable<NewPractitioner['specialties']>[number];

  const practitioner = await repo.createOne({
    providerId,
    active: body.active ?? true,
    name: body.name ?? [],
    telecom: body.telecom ?? null,
    address: body.address ?? null,
    gender: body.gender ?? null,
    birthDate: body.birthDate ?? null,
    photo: body.photo ?? null,
    qualification: (body.qualification ?? []) as DbQualification[],
    credential: (body.credential ?? []) as DbCredential[],
    specialties: (body.specialties ?? []) as DbSpecialty[],
    languages: (body.languages ?? null) as DbSpecialty[] | null,
  });

  logger?.info(
    { practitionerId: practitioner.id, providerId, action: 'create' },
    'Practitioner created'
  );

  return ctx.json(practitioner, 201);
}