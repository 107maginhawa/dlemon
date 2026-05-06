import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  NotFoundError,
} from '@/core/errors';
import type { CreatePractitionerBody } from '@/generated/openapi/validators';
import { PractitionerRepository } from './repos/practitioner.repo';
import { ProviderRepository } from './repos/provider.repo';

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

  // providerId must be supplied by the caller (FHIR: Practitioner belongs to an organization/provider)
  const providerId = (body as any).providerId as string | undefined;
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

  const practitioner = await repo.createOne({
    providerId,
    active: (body as any).active ?? true,
    name: (body as any).name ?? [],
    telecom: (body as any).telecom ?? null,
    address: (body as any).address ?? null,
    gender: (body as any).gender ?? null,
    birthDate: (body as any).birthDate ?? null,
    photo: (body as any).photo ?? null,
    qualification: (body as any).qualification ?? [],
    credential: (body as any).credential ?? [],
    specialties: (body as any).specialties ?? [],
    languages: (body as any).languages ?? null,
  });

  logger?.info(
    { practitionerId: practitioner.id, providerId, action: 'create' },
    'Practitioner created'
  );

  return ctx.json(practitioner, 201);
}