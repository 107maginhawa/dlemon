import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  NotFoundError,
} from '@/core/errors';
import type { CreatePractitionerRoleBody } from '@/generated/openapi/validators';
import { PractitionerRoleRepository } from './repos/practitioner-role.repo';
import { PractitionerRepository } from './repos/practitioner.repo';

/**
 * createPractitionerRole
 *
 * Path: POST /providers/practitioner-roles
 * OperationId: createPractitionerRole
 */
export async function createPractitionerRole(
  ctx: ValidatedContext<CreatePractitionerRoleBody, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // practitionerId must be supplied — links FHIR PractitionerRole to our practitioner row
  const practitionerId = (body as any).practitionerId as string | undefined;
  if (!practitionerId) {
    throw new NotFoundError('practitionerId is required in request body', {
      resourceType: 'practitioner',
      resource: 'practitionerId',
      suggestions: ['Include practitionerId in the request body'],
    });
  }

  const practitionerRepo = new PractitionerRepository(db, logger);
  const practitioner = await practitionerRepo.findOneById(practitionerId);
  if (!practitioner) {
    throw new NotFoundError('Practitioner not found', {
      resourceType: 'practitioner',
      resource: practitionerId,
      suggestions: ['Check practitioner ID format', 'Verify practitioner exists'],
    });
  }

  const repo = new PractitionerRoleRepository(db, logger);

  const role = await repo.createOne({
    practitionerId,
    active: (body as any).active ?? true,
    practitionerRef: (body as any).practitioner,
    organizationRef: (body as any).organization,
    code: (body as any).code ?? [],
    specialty: (body as any).specialty ?? [],
    periodStart: (body as any).period?.start ? new Date((body as any).period.start) : null,
    periodEnd: (body as any).period?.end ? new Date((body as any).period.end) : null,
    location: (body as any).location ?? null,
    healthcareService: (body as any).healthcareService ?? null,
    telecom: (body as any).telecom ?? null,
    availableTime: null,
    notAvailable: null,
  });

  logger?.info(
    { roleId: role.id, practitionerId, action: 'create' },
    'PractitionerRole created'
  );

  return ctx.json(role, 201);
}