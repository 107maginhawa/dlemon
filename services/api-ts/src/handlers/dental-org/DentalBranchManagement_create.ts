import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import type { User } from '@/types/auth';
import { BranchRepository } from '@/handlers/dental-org/repos/branch.repo';
import { OrganizationRepository } from '@/handlers/dental-org/repos/organization.repo';
import { logAuditEvent } from '@/handlers/audit/repos/audit.facade';
import type { DentalBranchManagement_createBody, DentalBranchManagement_createParams } from '@/generated/openapi/validators';

/**
 * DentalBranchManagement_create
 *
 * Path: POST /dental/organizations/{orgId}/branches/
 * OperationId: DentalBranchManagement_create
 *
 * Security (EF-ORG-001): Only the org owner may add branches to an org.
 */
export async function DentalBranchManagement_create(
  ctx: ValidatedContext<DentalBranchManagement_createBody, never, DentalBranchManagement_createParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { orgId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // EF-ORG-001: Verify caller owns the organization
  const orgRepo = new OrganizationRepository(db, logger);
  const org = await orgRepo.findOneById(orgId);
  if (!org) throw new NotFoundError('Organization');
  if (org.ownerPersonId !== user.id) {
    throw new ForbiddenError('Only the organization owner may add branches');
  }

  const repo = new BranchRepository(db, logger);
  const branch = await repo.createOne({
    organizationId: orgId,
    name: body.name,
    timezone: body.timezone,
    address: body.address ?? null,
    city: body.city ?? null,
    phone: body.phone ?? null,
    workingHours: body.workingHours ? JSON.stringify(body.workingHours) : null,
    active: true,
  });

  // AL-002: HIPAA §164.312 — audit branch creation
  try {
    await logAuditEvent(db, logger, {
      eventType: 'data-modification',
      category: 'administrative',
      action: 'create',
      outcome: 'success',
      user: user.id,
      userType: 'host',
      resourceType: 'dental_branch',
      resource: branch.id,
      description: `Branch created: ${body.name}`,
      details: { branchId: branch.id, organizationId: orgId, name: body.name },
    }, user.id);
  } catch (auditErr) {
    logger?.warn?.({ auditErr }, 'AL-002: failed to write createBranch audit log');
  }

  return ctx.json(branch, 201);
}