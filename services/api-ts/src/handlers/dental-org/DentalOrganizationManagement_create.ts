import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import type { User } from '@/types/auth';
import { OrganizationRepository } from '@/handlers/dental-org/repos/organization.repo';
import type { OrgTier } from '@/handlers/dental-org/repos/organization.schema';
import { logAuditEvent } from '@/handlers/audit/repos/audit.facade';
import type { DentalOrganizationManagement_createBody } from '@/generated/openapi/validators';

/**
 * DentalOrganizationManagement_create
 *
 * Path: POST /dental/organizations/
 * OperationId: DentalOrganizationManagement_create
 */
export async function DentalOrganizationManagement_create(
  ctx: ValidatedContext<DentalOrganizationManagement_createBody, never, never>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  // EM-ORG-002: Organization creation is an admin-level operation
  if (user.role !== 'admin') {
    throw new ForbiddenError('Only administrators can create organizations');
  }

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new OrganizationRepository(db, logger);
  const org = await repo.createOne({
    name: body.name,
    tier: body.tier as OrgTier,
    countryCode: body.countryCode,
    ownerPersonId: user.id,
    active: true,
  });

  // AL-001: HIPAA §164.312 — audit organization creation
  try {
    await logAuditEvent(db, logger, {
      eventType: 'data-modification',
      category: 'administrative',
      action: 'create',
      outcome: 'success',
      user: user.id,
      userType: 'host',
      resourceType: 'dental_organization',
      resource: org.id,
      description: `Organization created: ${body.name}`,
      details: { name: body.name, tier: body.tier },
    }, user.id);
  } catch (auditErr) {
    logger?.warn?.({ auditErr }, 'AL-001: failed to write createOrganization audit log');
  }

  return ctx.json(org, 201);
}
