/**
 * listDentalFindings handler — P0-C
 *
 * GET /dental/visits/{visitId}/findings
 *
 * Lists a visit's findings (active + resolved). The FE filters to active.
 */
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { VisitRepository } from './repos/visit.repo';
import { DentalFindingRepository } from './repos/dental-finding.repo';
import { buildPaginationMeta } from '@/utils/query';
import type { ListDentalFindingsParams } from '@/generated/openapi/validators';
import type { User } from '@/types/auth';

export async function listDentalFindings(
  ctx: ValidatedContext<never, never, ListDentalFindingsParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;

  const visit = await new VisitRepository(db).findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  await assertBranchAccess(db, user.id, visit.branchId);

  const findings = await new DentalFindingRepository(db).listByVisit(visitId);
  return ctx.json({
    data: findings,
    pagination: buildPaginationMeta(findings, findings.length, findings.length || 1, 0),
  });
}
