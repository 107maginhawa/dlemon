import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import type { User } from '@/types/auth';
import { OrganizationRepository } from '@/handlers/dental-org/repos/organization.repo';
import type { OrgTier } from '@/handlers/dental-org/repos/organization.schema';
import { logAuditEvent } from '@/core/audit-logger';
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

  // AL-001 / EM-AUD-008: HIPAA §164.312 — audit organization creation.
  // Routed through @/core/audit-logger so the event lands in dental_audit_log
  // (the table the dental audit viewer reads), not only the platform audit_log_entry.
  try {
    await logAuditEvent(db, logger, {
      personId: user.id,
      tenantId: org.id,
      eventType: 'data-modification',
      actorRole: 'admin',
      action: 'org.create',
      resourceType: 'dental_organization',
      resourceId: org.id,
      metadata: { name: body.name, tier: body.tier },
    });
  } catch (auditErr) {
    logger?.warn?.({ auditErr }, 'AL-001: failed to write createOrganization audit log');
  }

  return ctx.json(org, 201);
}
